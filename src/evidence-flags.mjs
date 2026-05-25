import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EVIDENCE_FLAGS_OUT_DIR = "artifacts/evidence-flags/latest";
export const DEFAULT_EVIDENCE_FLAGS_INPUTS = {
  evidenceCoveragePath: "artifacts/evidence-coverage/latest/evidence-coverage-score.json",
  sourceSpanStorePath: "artifacts/source-span-store/latest/source-span-store.json",
  evidenceItemStorePath: "artifacts/evidence-item-store/latest/evidence-item-store.json",
  factClaimStorePath: "artifacts/fact-claim-store/latest/fact-claim-store.json",
  issueGraphStorePath: "artifacts/issue-graph-store/latest/issue-graph-store.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const EVIDENCE_FLAGS_CONTRACT_ID = "evidence-flags.v1";
const EVIDENCE_FLAG_RECORD_SCHEMA_VERSION = "evidence-flag-record.v1";
const FLAG_DECISION_SCHEMA_VERSION = "evidence-flag-decision.v1";
const FLAG_TYPES = ["extraction", "human_confirmation", "privilege", "redaction", "external_transfer"];
const EXTRACTION_FLAGS = ["machine_extracted", "human_submitted", "unknown_extraction_state"];
const HUMAN_CONFIRMATION_FLAGS = ["pending_human_confirmation", "human_confirmed", "human_rejected"];
const PRIVILEGE_FLAGS = ["privileged_review_required", "client_confidential_review_required", "no_privilege_signal_detected"];
const REDACTION_FLAGS = ["redaction_required", "redaction_review_required", "redaction_not_required"];
const EXTERNAL_TRANSFER_FLAGS = ["external_transfer_blocked", "external_transfer_requires_approval", "external_transfer_allowed_by_classification"];
const SENSITIVE_CLASSIFICATIONS = new Set(["P3_PRIVILEGED", "P4_HIGHLY_RESTRICTED", "P5_SECRET_CREDENTIAL"]);
const BLOCKED_EXTERNAL_CLASSIFICATIONS = new Set(["P3_PRIVILEGED", "P4_HIGHLY_RESTRICTED", "P5_SECRET_CREDENTIAL"]);
const REVIEW_EXTERNAL_CLASSIFICATIONS = new Set(["P2_CLIENT_CONFIDENTIAL"]);

export async function runEvidenceFlags(options = {}) {
  const result = await buildEvidenceFlags(options);
  if (options.write !== false) await writeEvidenceFlags(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Evidence flags failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildEvidenceFlags(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EVIDENCE_FLAGS_OUT_DIR);
  const inputs = normalizeInputs(options);
  const evidenceCoverage = await readJson(inputs.evidence_coverage_path);
  const sourceSpanStore = await readJson(inputs.source_span_store_path);
  const evidenceItemStore = await readJson(inputs.evidence_item_store_path);
  const factClaimStore = await readJson(inputs.fact_claim_store_path);
  const issueGraphStore = await readJson(inputs.issue_graph_store_path);
  const packageText = await readText(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);
  const catalogs = buildCatalogLookups({
    evidenceCoverage,
    sourceSpanStore,
    evidenceItemStore,
    factClaimStore,
    issueGraphStore,
  });
  const evidenceFlagRecords = catalogs.coverageScores.map((score, index) => buildEvidenceFlagRecord(score, catalogs, index, generatedAt));
  const flagDecisions = evidenceFlagRecords.flatMap((record) => record.flag_decisions);
  const flagIndexes = buildFlagIndexes(evidenceFlagRecords, flagDecisions, generatedAt);
  const validationItems = validateEvidenceFlags({
    packageText,
    roadmapText,
    evidenceCoverage,
    sourceSpanStore,
    evidenceItemStore,
    factClaimStore,
    issueGraphStore,
    catalogs,
    evidenceFlagRecords,
    flagDecisions,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeEvidenceFlags({
    evidenceCoverage,
    sourceSpanStore,
    evidenceItemStore,
    factClaimStore,
    issueGraphStore,
    evidenceFlagRecords,
    flagDecisions,
    validationItems,
    validation,
  });
  const result = {
    schema_version: "evidence-flags.v1",
    generated_at: generatedAt,
    evidence_flags_id: `evidence-flags.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_stores: [
      summarizeSource("evidence_coverage_score", evidenceCoverage),
      summarizeSource("source_span_store", sourceSpanStore),
      summarizeSource("evidence_item_store", evidenceItemStore),
      summarizeSource("fact_claim_store", factClaimStore),
      summarizeSource("issue_graph_store", issueGraphStore),
    ],
    evidence_flags_contract: buildEvidenceFlagsContract(generatedAt),
    evidence_flag_catalog: {
      schema_version: "evidence-flag-catalog.v1",
      generated_at: generatedAt,
      evidence_flag_records: evidenceFlagRecords,
      flag_decisions: flagDecisions,
      flag_indexes: flagIndexes,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderEvidenceFlagsMarkdown(result),
  };
}

export async function writeEvidenceFlags(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableEvidenceFlags(result);
  await writeJson(path.join(outDir, "evidence-flags.json"), serializable);
  await writeJson(path.join(outDir, "evidence-flag-records.json"), {
    schema_version: "evidence-flag-records.v1",
    generated_at: result.generated_at,
    evidence_flag_record_count: result.evidence_flag_catalog.evidence_flag_records.length,
    evidence_flag_records: result.evidence_flag_catalog.evidence_flag_records,
  });
  await writeJson(path.join(outDir, "flag-decisions.json"), {
    schema_version: "evidence-flag-decisions.v1",
    generated_at: result.generated_at,
    flag_decision_count: result.evidence_flag_catalog.flag_decisions.length,
    flag_decisions: result.evidence_flag_catalog.flag_decisions,
  });
  await writeJson(path.join(outDir, "flag-indexes.json"), {
    schema_version: "evidence-flag-indexes.v1",
    generated_at: result.generated_at,
    flag_indexes: result.evidence_flag_catalog.flag_indexes,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    evidence_flags_id: result.evidence_flags_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runEvidenceFlagsCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runEvidenceFlags(args);
    console.log(`Evidence flags written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.evidence_flags_status}`);
    console.log(`Flag records: ${result.summary.evidence_flag_record_count}`);
    console.log(`Flag decisions: ${result.summary.flag_decision_count}`);
    console.log(`Pending human confirmation: ${result.summary.pending_human_confirmation_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildEvidenceFlagsContract(generatedAt) {
  return {
    schema_version: "evidence-flags-contract.v1",
    evidence_flags_contract_id: EVIDENCE_FLAGS_CONTRACT_ID,
    generated_at: generatedAt,
    evidence_flag_record_schema_version: EVIDENCE_FLAG_RECORD_SCHEMA_VERSION,
    flag_decision_schema_version: FLAG_DECISION_SCHEMA_VERSION,
    flag_types: FLAG_TYPES,
    source_inputs: [
      "evidence-coverage-score.v1",
      "source-span-store.v1",
      "evidence-item-store.v1",
      "fact-claim-store.v1",
      "issue-graph-store.v1",
    ],
    separation_rule: "extraction_reliability_and_human_confirmation_are_separate_flags",
    privilege_rule: "privileged_or_client_confidential_signals_require_review_before_client_facing_use",
    redaction_rule: "restricted_or_sensitive_signals_block_or_require_redaction_before_external_transfer",
    output_rule: "evidence_flags_are_needs_review_and_not_client_facing_until_human_approval",
  };
}

function buildCatalogLookups({ evidenceCoverage, sourceSpanStore, evidenceItemStore, factClaimStore, issueGraphStore }) {
  const coverageScores = evidenceCoverage.evidence_coverage_catalog?.coverage_scores ?? [];
  const sourceSpans = sourceSpanStore.source_span_catalog?.source_spans ?? [];
  const evidenceItems = evidenceItemStore.evidence_item_catalog?.evidence_items ?? [];
  const factClaims = factClaimStore.fact_claim_catalog?.fact_claims ?? [];
  const issues = issueGraphStore.issue_graph_catalog?.issues ?? [];
  return {
    coverageScores,
    sourceSpans,
    evidenceItems,
    factClaims,
    issues,
    coverageScoreById: indexBy(coverageScores, "coverage_score_id"),
    sourceSpanById: indexBy(sourceSpans, "source_span_id"),
    evidenceById: indexBy(evidenceItems, "evidence_id"),
    factById: indexBy(factClaims, "fact_id"),
    issueById: indexBy(issues, "issue_id"),
  };
}

function buildEvidenceFlagRecord(score, catalogs, index, generatedAt) {
  const source = catalogs.sourceSpanById.get(score.source_span_id);
  const evidence = catalogs.evidenceById.get(score.evidence_item_id);
  const fact = catalogs.factById.get(score.fact_id);
  const issue = catalogs.issueById.get(score.issue_id);
  const text = collectSignalText({ source, evidence, fact, issue, score });
  const extractionFlag = deriveExtractionFlag({ evidence, fact, score });
  const humanConfirmationFlag = deriveHumanConfirmationFlag({ evidence, fact, issue, score });
  const privilegeFlag = derivePrivilegeFlag({ score, evidence, fact, issue, text });
  const redactionFlag = deriveRedactionFlag({ score, evidence, text, privilegeFlag });
  const externalTransferFlag = deriveExternalTransferFlag({ score, redactionFlag });
  const evidenceFlagRecordId = `evidence-flag-record.${slugify(score.coverage_score_id)}`;
  const flagContext = {
    evidenceFlagRecordId,
    coverageScoreId: score.coverage_score_id,
    tenantId: score.tenant_id,
    matterId: score.matter_id,
    classification: score.classification,
    policySnapshotId: score.policy_snapshot_id,
    generatedAt,
  };
  const decisions = [
    buildFlagDecision(flagContext, "extraction", extractionFlag, "evidence_item.reliability_and_fact.reliability", "Extraction source is recorded independently from human confirmation."),
    buildFlagDecision(flagContext, "human_confirmation", humanConfirmationFlag, "review_status_chain", "Human confirmation remains pending until an attorney or authorized reviewer approves it."),
    buildFlagDecision(flagContext, "privilege", privilegeFlag, "classification_and_privilege_signals", "Privilege and client-confidential handling is evaluated before downstream use."),
    buildFlagDecision(flagContext, "redaction", redactionFlag, "classification_sensitive_signals_and_privilege_flag", "Redaction status is separated from privilege status."),
    buildFlagDecision(flagContext, "external_transfer", externalTransferFlag, "classification_redaction_policy", "External transfer is derived from classification and redaction state."),
  ];
  return {
    schema_version: EVIDENCE_FLAG_RECORD_SCHEMA_VERSION,
    evidence_flag_record_id: evidenceFlagRecordId,
    coverage_score_id: score.coverage_score_id,
    lineage_path_id: score.lineage_path_id,
    output_paragraph_id: score.output_paragraph_id,
    citation_id: score.citation_id,
    issue_id: score.issue_id,
    fact_id: score.fact_id,
    evidence_item_id: score.evidence_item_id,
    source_span_id: score.source_span_id,
    tenant_id: score.tenant_id,
    matter_id: score.matter_id,
    classification: score.classification,
    policy_snapshot_id: score.policy_snapshot_id,
    extraction_flag: extractionFlag,
    human_confirmation_flag: humanConfirmationFlag,
    privilege_flag: privilegeFlag,
    redaction_flag: redactionFlag,
    external_transfer_flag: externalTransferFlag,
    flag_decision_ids: decisions.map((decision) => decision.flag_decision_id),
    flag_decisions: decisions,
    review_status: "needs_review",
    human_review_required: true,
    output_client_facing_status: score.output_client_facing_status ?? "not_client_facing",
    client_facing_ready: false,
    matter_preserved: score.matter_preserved === true,
    classification_preserved: score.classification_preserved === true,
    policy_snapshot_preserved: score.policy_snapshot_preserved === true,
    source_binding_status: score.source_binding_status ?? "unknown",
    coverage_status: score.coverage_status,
    coverage_score: score.coverage_score,
    missing_required_dimension_count: score.missing_required_dimension_count,
    required_dimension_count: score.required_dimension_count,
    covered_required_dimension_count: score.covered_required_dimension_count,
    created_at: generatedAt,
    metadata: {
      sequence: index + 1,
      evidence_reliability: evidence?.reliability ?? null,
      evidence_review_status: evidence?.review_status ?? null,
      evidence_verification_state: evidence?.verification_state ?? null,
      fact_reliability: fact?.reliability ?? null,
      issue_review_status: issue?.review_status ?? null,
      issue_risk_severity: issue?.risk_severity ?? null,
      source_location_type: source?.location_type ?? null,
      signal_matches: {
        privilege: detectPrivilegeSignals(text),
        sensitive: detectSensitiveSignals(text),
      },
    },
  };
}

function buildFlagDecision(context, flagType, flagValue, decisionBasis, rationale) {
  return {
    schema_version: FLAG_DECISION_SCHEMA_VERSION,
    flag_decision_id: `evidence-flag-decision.${slugify(context.evidenceFlagRecordId)}.${flagType}`,
    evidence_flag_record_id: context.evidenceFlagRecordId,
    coverage_score_id: context.coverageScoreId,
    flag_type: flagType,
    flag_value: flagValue,
    tenant_id: context.tenantId,
    matter_id: context.matterId,
    classification: context.classification,
    policy_snapshot_id: context.policySnapshotId,
    decision_source: "deterministic_evidence_flags_v1",
    decision_basis: decisionBasis,
    human_review_required: true,
    created_at: context.generatedAt,
    rationale,
  };
}

function deriveExtractionFlag({ evidence, fact }) {
  if (evidence?.reliability === "machine_extracted" || fact?.reliability === "machine_extracted") return "machine_extracted";
  if (evidence?.reliability === "human_submitted" || fact?.reliability === "human_submitted") return "human_submitted";
  return "unknown_extraction_state";
}

function deriveHumanConfirmationFlag({ evidence, fact, issue, score }) {
  const statuses = [evidence?.review_status, fact?.review_status, issue?.review_status, score.review_status].filter(Boolean);
  if (statuses.some((status) => ["rejected", "human_rejected"].includes(status))) return "human_rejected";
  if (statuses.length > 0 && statuses.every((status) => ["approved", "human_confirmed"].includes(status))) return "human_confirmed";
  return "pending_human_confirmation";
}

function derivePrivilegeFlag({ score, evidence, fact, issue, text }) {
  if (SENSITIVE_CLASSIFICATIONS.has(score.classification) || evidence?.privilege_flag === true || detectPrivilegeSignals(text).length > 0) {
    return "privileged_review_required";
  }
  if (score.classification === "P2_CLIENT_CONFIDENTIAL" || fact?.classification === "P2_CLIENT_CONFIDENTIAL" || issue?.classification === "P2_CLIENT_CONFIDENTIAL") {
    return "client_confidential_review_required";
  }
  return "no_privilege_signal_detected";
}

function deriveRedactionFlag({ score, evidence, text, privilegeFlag }) {
  if (["P4_HIGHLY_RESTRICTED", "P5_SECRET_CREDENTIAL"].includes(score.classification) || evidence?.redaction_state === "redacted_required" || detectSensitiveSignals(text).length > 0) {
    return "redaction_required";
  }
  if (score.classification === "P2_CLIENT_CONFIDENTIAL" || score.classification === "P3_PRIVILEGED" || privilegeFlag !== "no_privilege_signal_detected") {
    return "redaction_review_required";
  }
  return "redaction_not_required";
}

function deriveExternalTransferFlag({ score, redactionFlag }) {
  if (redactionFlag === "redaction_required" || BLOCKED_EXTERNAL_CLASSIFICATIONS.has(score.classification)) return "external_transfer_blocked";
  if (redactionFlag === "redaction_review_required" || REVIEW_EXTERNAL_CLASSIFICATIONS.has(score.classification)) return "external_transfer_requires_approval";
  return "external_transfer_allowed_by_classification";
}

function collectSignalText({ source, evidence, fact, issue, score }) {
  return [
    source?.content_preview,
    evidence?.summary,
    evidence?.metadata?.content_preview,
    fact?.statement,
    issue?.title,
    issue?.metadata?.fact_statement,
    score?.classification,
  ].filter(Boolean).join("\n");
}

function detectPrivilegeSignals(text) {
  return extractSignals(text, [
    /\b(?:privileged|attorney[-\s]?client|work\s*product|legal\s*advice|counsel)\b/gi,
    /(?:변호사|법률검토|비밀유지|비공개|특권|소송전략|의뢰인)/g,
  ]);
}

function detectSensitiveSignals(text) {
  return extractSignals(text, [
    /\b(?:password|api[_-\s]?key|secret|token|credential|resident registration|bank account)\b/gi,
    /(?:주민등록번호|계좌번호|비밀번호|토큰|자격증명|영업비밀|개인정보)/g,
    /\b\d{6}-\d{7}\b/g,
  ]);
}

function extractSignals(text, regexes) {
  const signals = [];
  for (const regex of regexes) {
    for (const match of text.matchAll(regex)) {
      const value = match[0].trim();
      if (value && !signals.includes(value)) signals.push(value);
      if (signals.length >= 8) return signals;
    }
  }
  return signals;
}

function buildFlagIndexes(records, decisions, generatedAt) {
  return {
    schema_version: "evidence-flag-indexes.v1",
    generated_at: generatedAt,
    by_matter_id: countBy(records, "matter_id"),
    by_classification: countBy(records, "classification"),
    by_extraction_flag: countBy(records, "extraction_flag"),
    by_human_confirmation_flag: countBy(records, "human_confirmation_flag"),
    by_privilege_flag: countBy(records, "privilege_flag"),
    by_redaction_flag: countBy(records, "redaction_flag"),
    by_external_transfer_flag: countBy(records, "external_transfer_flag"),
    by_review_status: countBy(records, "review_status"),
    by_flag_type: countBy(decisions, "flag_type"),
    by_flag_value: countBy(decisions, "flag_value"),
  };
}

function validateEvidenceFlags({
  packageText,
  roadmapText,
  evidenceCoverage,
  sourceSpanStore,
  evidenceItemStore,
  factClaimStore,
  issueGraphStore,
  catalogs,
  evidenceFlagRecords,
  flagDecisions,
}) {
  const validationItems = [];
  const packageJson = JSON.parse(packageText);
  const recordsByCoverageScoreId = new Map(evidenceFlagRecords.map((record) => [record.coverage_score_id, record]));

  pushCheck(validationItems, "contract", "package_script_registered", Boolean(packageJson.scripts?.["resource:evidence-flags"]), "package.json must expose resource:evidence-flags.");
  pushCheck(validationItems, "contract", "roadmap_phase_documented", roadmapText.includes("## Phase 145: Evidence Flags"), "Implementation roadmap must document Phase 145.");
  pushCheck(validationItems, "source", "evidence_coverage_complete", evidenceCoverage.summary?.evidence_coverage_status === "complete", "Evidence Coverage Score must be complete.");
  pushCheck(validationItems, "source", "source_span_store_complete", sourceSpanStore.summary?.source_span_store_status === "complete", "Source Span Store must be complete.");
  pushCheck(validationItems, "source", "evidence_item_store_complete", evidenceItemStore.summary?.evidence_item_store_status === "complete", "Evidence Item Store must be complete.");
  pushCheck(validationItems, "source", "fact_claim_store_complete", factClaimStore.summary?.fact_claim_store_status === "complete", "Fact Claim Store must be complete.");
  pushCheck(validationItems, "source", "issue_graph_store_complete", issueGraphStore.summary?.issue_graph_store_status === "complete", "Issue Graph Store must be complete.");
  pushCheck(validationItems, "catalog", "coverage_scores_present", catalogs.coverageScores.length > 0, "Coverage scores are required.");
  pushCheck(validationItems, "catalog", "flag_records_match_scores", evidenceFlagRecords.length === catalogs.coverageScores.length, "Every coverage score must produce one evidence flag record.");
  pushCheck(validationItems, "catalog", "flag_decisions_match_records", flagDecisions.length === evidenceFlagRecords.length * FLAG_TYPES.length, "Every evidence flag record must produce one decision for each flag type.");

  for (const score of catalogs.coverageScores) {
    pushCheck(validationItems, `coverage_scores.${score.coverage_score_id}`, "flag_record_present", recordsByCoverageScoreId.has(score.coverage_score_id), "Every coverage score must have a flag record.");
  }

  for (const record of evidenceFlagRecords) {
    const prefix = `evidence_flags.${record.evidence_flag_record_id}`;
    const decisionTypes = new Set(record.flag_decisions.map((decision) => decision.flag_type));
    pushCheck(validationItems, prefix, "schema_version_canonical", record.schema_version === EVIDENCE_FLAG_RECORD_SCHEMA_VERSION, "Evidence flag record must use evidence-flag-record.v1.");
    pushCheck(validationItems, prefix, "extraction_flag_canonical", EXTRACTION_FLAGS.includes(record.extraction_flag), "Extraction flag must be canonical.");
    pushCheck(validationItems, prefix, "human_confirmation_flag_canonical", HUMAN_CONFIRMATION_FLAGS.includes(record.human_confirmation_flag), "Human confirmation flag must be canonical.");
    pushCheck(validationItems, prefix, "privilege_flag_canonical", PRIVILEGE_FLAGS.includes(record.privilege_flag), "Privilege flag must be canonical.");
    pushCheck(validationItems, prefix, "redaction_flag_canonical", REDACTION_FLAGS.includes(record.redaction_flag), "Redaction flag must be canonical.");
    pushCheck(validationItems, prefix, "external_transfer_flag_canonical", EXTERNAL_TRANSFER_FLAGS.includes(record.external_transfer_flag), "External transfer flag must be canonical.");
    pushCheck(validationItems, prefix, "flag_types_complete", FLAG_TYPES.every((type) => decisionTypes.has(type)), "Each record must separate extraction, human confirmation, privilege, redaction, and external transfer decisions.");
    pushCheck(validationItems, prefix, "machine_extraction_separated_from_human_confirmation", record.extraction_flag !== record.human_confirmation_flag, "Extraction reliability and human confirmation must be separate states.");
    pushCheck(validationItems, prefix, "coverage_score_resolves", catalogs.coverageScoreById.has(record.coverage_score_id), "Flag record coverage score must resolve.");
    pushCheck(validationItems, prefix, "source_span_resolves", catalogs.sourceSpanById.has(record.source_span_id), "Flag record source span must resolve.");
    pushCheck(validationItems, prefix, "evidence_item_resolves", catalogs.evidenceById.has(record.evidence_item_id), "Flag record evidence item must resolve.");
    pushCheck(validationItems, prefix, "fact_resolves", catalogs.factById.has(record.fact_id), "Flag record fact must resolve.");
    pushCheck(validationItems, prefix, "issue_resolves", catalogs.issueById.has(record.issue_id), "Flag record issue must resolve.");
    pushCheck(validationItems, prefix, "matter_preserved", record.matter_preserved === true, "Flag record must preserve matter_id.");
    pushCheck(validationItems, prefix, "classification_preserved", record.classification_preserved === true, "Flag record must preserve classification.");
    pushCheck(validationItems, prefix, "policy_snapshot_preserved", record.policy_snapshot_preserved === true, "Flag record must preserve policy snapshot.");
    pushCheck(validationItems, prefix, "review_pending", record.review_status === "needs_review" && record.human_review_required === true, "Flag record must remain pending human review.");
    pushCheck(validationItems, prefix, "not_client_facing", record.output_client_facing_status === "not_client_facing" && record.client_facing_ready === false, "Flag record must stay not client-facing.");
  }

  for (const decision of flagDecisions) {
    const allowedValues = flagValuesForType(decision.flag_type);
    const prefix = `flag_decisions.${decision.flag_decision_id}`;
    pushCheck(validationItems, prefix, "schema_version_canonical", decision.schema_version === FLAG_DECISION_SCHEMA_VERSION, "Flag decision must use evidence-flag-decision.v1.");
    pushCheck(validationItems, prefix, "type_canonical", FLAG_TYPES.includes(decision.flag_type), "Flag decision type must be canonical.");
    pushCheck(validationItems, prefix, "value_canonical", allowedValues.includes(decision.flag_value), "Flag decision value must be canonical for its type.");
    pushCheck(validationItems, prefix, "human_review_required", decision.human_review_required === true, "Every flag decision must require human review.");
  }

  return validationItems;
}

function flagValuesForType(flagType) {
  if (flagType === "extraction") return EXTRACTION_FLAGS;
  if (flagType === "human_confirmation") return HUMAN_CONFIRMATION_FLAGS;
  if (flagType === "privilege") return PRIVILEGE_FLAGS;
  if (flagType === "redaction") return REDACTION_FLAGS;
  if (flagType === "external_transfer") return EXTERNAL_TRANSFER_FLAGS;
  return [];
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.path}.${item.check_id}`, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeEvidenceFlags({
  evidenceCoverage,
  sourceSpanStore,
  evidenceItemStore,
  factClaimStore,
  issueGraphStore,
  evidenceFlagRecords,
  flagDecisions,
  validationItems,
  validation,
}) {
  return {
    evidence_flags_status: validation.valid ? "complete" : "blocked",
    evidence_flags_contract_id: EVIDENCE_FLAGS_CONTRACT_ID,
    evidence_flag_record_schema_version: EVIDENCE_FLAG_RECORD_SCHEMA_VERSION,
    flag_decision_schema_version: FLAG_DECISION_SCHEMA_VERSION,
    evidence_coverage_status: evidenceCoverage.summary?.evidence_coverage_status ?? "unknown",
    source_span_store_status: sourceSpanStore.summary?.source_span_store_status ?? "unknown",
    evidence_item_store_status: evidenceItemStore.summary?.evidence_item_store_status ?? "unknown",
    fact_claim_store_status: factClaimStore.summary?.fact_claim_store_status ?? "unknown",
    issue_graph_store_status: issueGraphStore.summary?.issue_graph_store_status ?? "unknown",
    coverage_score_count: evidenceCoverage.summary?.coverage_score_count ?? 0,
    evidence_flag_record_count: evidenceFlagRecords.length,
    flag_decision_count: flagDecisions.length,
    expected_flag_decision_count: evidenceFlagRecords.length * FLAG_TYPES.length,
    machine_extracted_count: evidenceFlagRecords.filter((record) => record.extraction_flag === "machine_extracted").length,
    pending_human_confirmation_count: evidenceFlagRecords.filter((record) => record.human_confirmation_flag === "pending_human_confirmation").length,
    privileged_review_required_count: evidenceFlagRecords.filter((record) => record.privilege_flag === "privileged_review_required").length,
    client_confidential_review_required_count: evidenceFlagRecords.filter((record) => record.privilege_flag === "client_confidential_review_required").length,
    no_privilege_signal_detected_count: evidenceFlagRecords.filter((record) => record.privilege_flag === "no_privilege_signal_detected").length,
    redaction_required_count: evidenceFlagRecords.filter((record) => record.redaction_flag === "redaction_required").length,
    redaction_review_required_count: evidenceFlagRecords.filter((record) => record.redaction_flag === "redaction_review_required").length,
    redaction_not_required_count: evidenceFlagRecords.filter((record) => record.redaction_flag === "redaction_not_required").length,
    external_transfer_blocked_count: evidenceFlagRecords.filter((record) => record.external_transfer_flag === "external_transfer_blocked").length,
    external_transfer_requires_approval_count: evidenceFlagRecords.filter((record) => record.external_transfer_flag === "external_transfer_requires_approval").length,
    external_transfer_allowed_count: evidenceFlagRecords.filter((record) => record.external_transfer_flag === "external_transfer_allowed_by_classification").length,
    matter_preserved_record_count: evidenceFlagRecords.filter((record) => record.matter_preserved).length,
    classification_preserved_record_count: evidenceFlagRecords.filter((record) => record.classification_preserved).length,
    policy_snapshot_preserved_record_count: evidenceFlagRecords.filter((record) => record.policy_snapshot_preserved).length,
    needs_review_record_count: evidenceFlagRecords.filter((record) => record.review_status === "needs_review").length,
    not_client_facing_record_count: evidenceFlagRecords.filter((record) => record.output_client_facing_status === "not_client_facing").length,
    client_facing_ready_record_count: evidenceFlagRecords.filter((record) => record.client_facing_ready === true).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_matter_id: countBy(evidenceFlagRecords, "matter_id"),
    by_classification: countBy(evidenceFlagRecords, "classification"),
    by_extraction_flag: countBy(evidenceFlagRecords, "extraction_flag"),
    by_human_confirmation_flag: countBy(evidenceFlagRecords, "human_confirmation_flag"),
    by_privilege_flag: countBy(evidenceFlagRecords, "privilege_flag"),
    by_redaction_flag: countBy(evidenceFlagRecords, "redaction_flag"),
    by_external_transfer_flag: countBy(evidenceFlagRecords, "external_transfer_flag"),
  };
}

function renderEvidenceFlagsMarkdown(result) {
  const lines = [];
  lines.push("# Evidence Flags");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.evidence_flags_status}`);
  lines.push("");
  lines.push(`- Contract: ${result.summary.evidence_flags_contract_id}`);
  lines.push(`- Flag records: ${result.summary.evidence_flag_record_count}`);
  lines.push(`- Flag decisions: ${result.summary.flag_decision_count}`);
  lines.push(`- Machine extracted: ${result.summary.machine_extracted_count}`);
  lines.push(`- Pending human confirmation: ${result.summary.pending_human_confirmation_count}`);
  lines.push(`- Privileged review required: ${result.summary.privileged_review_required_count}`);
  lines.push(`- Client-confidential review required: ${result.summary.client_confidential_review_required_count}`);
  lines.push(`- Redaction required: ${result.summary.redaction_required_count}`);
  lines.push(`- Redaction review required: ${result.summary.redaction_review_required_count}`);
  lines.push(`- External transfer blocked: ${result.summary.external_transfer_blocked_count}`);
  lines.push(`- External transfer requires approval: ${result.summary.external_transfer_requires_approval_count}`);
  lines.push(`- Client-facing ready: ${result.summary.client_facing_ready_record_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function pushCheck(validationItems, pathLabel, checkId, passed, message) {
  validationItems.push({
    validation_id: `evidence-flags-validation.${slugify(pathLabel)}.${checkId}`,
    path: pathLabel,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

function normalizeInputs(options) {
  return {
    evidence_coverage_path: path.resolve(options.evidenceCoveragePath ?? DEFAULT_EVIDENCE_FLAGS_INPUTS.evidenceCoveragePath),
    source_span_store_path: path.resolve(options.sourceSpanStorePath ?? DEFAULT_EVIDENCE_FLAGS_INPUTS.sourceSpanStorePath),
    evidence_item_store_path: path.resolve(options.evidenceItemStorePath ?? DEFAULT_EVIDENCE_FLAGS_INPUTS.evidenceItemStorePath),
    fact_claim_store_path: path.resolve(options.factClaimStorePath ?? DEFAULT_EVIDENCE_FLAGS_INPUTS.factClaimStorePath),
    issue_graph_store_path: path.resolve(options.issueGraphStorePath ?? DEFAULT_EVIDENCE_FLAGS_INPUTS.issueGraphStorePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_EVIDENCE_FLAGS_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_EVIDENCE_FLAGS_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--evidence-coverage") parsed.evidenceCoveragePath = argv[++index];
    else if (arg === "--source-span-store") parsed.sourceSpanStorePath = argv[++index];
    else if (arg === "--evidence-item-store") parsed.evidenceItemStorePath = argv[++index];
    else if (arg === "--fact-claim-store") parsed.factClaimStorePath = argv[++index];
    else if (arg === "--issue-graph-store") parsed.issueGraphStorePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/evidence-flags.mjs [options]

Options:
  --evidence-coverage <path>        evidence-coverage-score.json path.
  --source-span-store <path>        source-span-store.json path.
  --evidence-item-store <path>      evidence-item-store.json path.
  --fact-claim-store <path>         fact-claim-store.json path.
  --issue-graph-store <path>        issue-graph-store.json path.
  --out-dir <path>                  Output directory.
  --run-at <iso>                    Deterministic generated_at timestamp.
  --check                           Exit non-zero when validation fails.
  --no-write                        Build without writing artifacts.
`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableEvidenceFlags(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function summarizeSource(sourceId, data) {
  return {
    source_id: sourceId,
    schema_version: data.schema_version ?? null,
    generated_at: data.generated_at ?? null,
    summary: data.summary ?? null,
  };
}

function indexBy(items, key) {
  return new Map(items.map((item) => [item[key], item]));
}

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([a], [b]) => String(a).localeCompare(String(b))),
  );
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "unknown";
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
