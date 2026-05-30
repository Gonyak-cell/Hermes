import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_BATCH_CLASSIFICATION_RESULT_OUT_DIR = "artifacts/batch-classification-result/latest";
export const DEFAULT_BATCH_CLASSIFICATION_RESULT_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  resourceExpansionPath: "artifacts/resource-expansion/latest/resource-expansion-job.json",
  expansionCursorLedgerPath: "artifacts/expansion-cursor-ledger/latest/expansion-cursor-ledger.json",
  expansionDedupLedgerPath: "artifacts/expansion-dedup-ledger/latest/expansion-dedup-ledger.json",
  expansionQuarantineLedgerPath: "artifacts/expansion-quarantine-ledger/latest/expansion-quarantine-ledger.json",
  dataClassificationRuleEnginePath: "artifacts/data-classification-rules/latest/data-classification-rule-engine.json",
  backfillJobContractPath: "artifacts/backfill-job-contract/latest/backfill-job-contract.json",
};

const RESULT_SCHEMA_VERSION = "batch-classification-result.v1";
const PACK_ID = "resource-expansion";
const CAPABILITY_ID = "resource.batch_classification_result";
const PHASE_SLOT = "P281";
const PREVIOUS_PHASE_SLOT = "P280";
const NEXT_PHASE_SLOT = "P282";
const HUMAN_REVIEW_NOTE = "Batch Classification Result is a read-only metadata classification report. It does not execute backfill, read source file contents, run models, mutate resources or state, deliver output, produce legal advice, or create client-facing output.";

export async function runBatchClassificationResult(options = {}) {
  const result = await buildBatchClassificationResult(options);
  if (options.write !== false) await writeBatchClassificationResult(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Batch classification result validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildBatchClassificationResult(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_BATCH_CLASSIFICATION_RESULT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);

  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const implementationRoadmapText = await readTextOrError(path.resolve(repoRoot, inputs.implementation_roadmap_path));
  const controlPlaneLoopText = await readTextOrError(path.resolve(repoRoot, inputs.control_plane_loop_path));
  const reviewDashboardText = await readTextOrError(path.resolve(repoRoot, inputs.review_dashboard_path));
  const reviewApiText = await readTextOrError(path.resolve(repoRoot, inputs.review_api_path));
  const resourceExpansionRead = await readJsonOrError(inputs.resource_expansion_path);
  const expansionCursorLedgerRead = await readJsonOrError(inputs.expansion_cursor_ledger_path);
  const expansionDedupLedgerRead = await readJsonOrError(inputs.expansion_dedup_ledger_path);
  const expansionQuarantineLedgerRead = await readJsonOrError(inputs.expansion_quarantine_ledger_path);
  const dataClassificationRuleEngineRead = await readJsonOrError(inputs.data_classification_rule_engine_path);
  const backfillJobContractRead = await readJsonOrError(inputs.backfill_job_contract_path);

  const resourceExpansion = resourceExpansionRead.value ?? {};
  const expansionCursorLedger = expansionCursorLedgerRead.value ?? {};
  const expansionDedupLedger = expansionDedupLedgerRead.value ?? {};
  const expansionQuarantineLedger = expansionQuarantineLedgerRead.value ?? {};
  const dataClassificationRuleEngine = dataClassificationRuleEngineRead.value ?? {};
  const backfillJobContract = backfillJobContractRead.value ?? {};
  const classificationRules = buildClassificationRuleRows(dataClassificationRuleEngine, generatedAt);
  const classificationRows = buildClassificationRows(resourceExpansion, classificationRules, generatedAt);
  const confidenceRows = buildConfidenceRows(classificationRows, generatedAt);
  const policyBindingRows = buildPolicyBindingRows(classificationRows, classificationRules, generatedAt);
  const boundary = buildBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson,
    roadmapText,
    implementationRoadmapText,
    controlPlaneLoopText,
    reviewDashboardText,
    reviewApiText,
    resourceExpansionRead,
    expansionCursorLedgerRead,
    expansionDedupLedgerRead,
    expansionQuarantineLedgerRead,
    dataClassificationRuleEngineRead,
    backfillJobContractRead,
    resourceExpansion,
    expansionCursorLedger,
    expansionDedupLedger,
    expansionQuarantineLedger,
    dataClassificationRuleEngine,
    backfillJobContract,
    classificationRules,
    classificationRows,
    confidenceRows,
    policyBindingRows,
    boundary,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    checkpoint_id: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeBatchClassification({
    resourceExpansion,
    expansionCursorLedger,
    expansionDedupLedger,
    expansionQuarantineLedger,
    dataClassificationRuleEngine,
    backfillJobContract,
    classificationRules,
    classificationRows,
    confidenceRows,
    policyBindingRows,
    boundary,
    validation,
  });

  const result = {
    schema_version: RESULT_SCHEMA_VERSION,
    generated_at: generatedAt,
    batch_classification_result_id: `batch-classification-result.${dateStamp(generatedAt)}`,
    batch_classification_result_status: summary.batch_classification_result_status,
    output_dir: outputDir,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    inputs,
    source_contracts: buildSourceContracts({
      packageJson,
      roadmapText,
      implementationRoadmapText,
      controlPlaneLoopText,
      reviewDashboardText,
      reviewApiText,
      resourceExpansionRead,
      expansionCursorLedgerRead,
      expansionDedupLedgerRead,
      expansionQuarantineLedgerRead,
      dataClassificationRuleEngineRead,
      backfillJobContractRead,
    }),
    batch_classification_contract: buildClassificationContract({ generatedAt, classificationRows, confidenceRows }),
    batch_classification_rule_rows: classificationRules,
    batch_classification_rows: classificationRows,
    classification_confidence_rows: confidenceRows,
    classification_policy_binding_rows: policyBindingRows,
    batch_classification_checks: validationItems,
    batch_classification_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    summary_markdown: renderSummary(result),
  };
}

export async function writeBatchClassificationResult(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableBatchClassificationResult(result);
  await writeJson(path.join(outDir, "batch-classification-result.json"), serializable);
  await writeJson(path.join(outDir, "batch-classification-rule-rows.json"), {
    schema_version: "batch-classification-rule-rows.v1",
    generated_at: result.generated_at,
    rule_count: result.batch_classification_rule_rows.length,
    batch_classification_rule_rows: result.batch_classification_rule_rows,
  });
  await writeJson(path.join(outDir, "batch-classification-rows.json"), {
    schema_version: "batch-classification-rows.v1",
    generated_at: result.generated_at,
    classification_row_count: result.batch_classification_rows.length,
    batch_classification_rows: result.batch_classification_rows,
  });
  await writeJson(path.join(outDir, "classification-confidence-rows.json"), {
    schema_version: "classification-confidence-rows.v1",
    generated_at: result.generated_at,
    confidence_row_count: result.classification_confidence_rows.length,
    classification_confidence_rows: result.classification_confidence_rows,
  });
  await writeJson(path.join(outDir, "classification-policy-binding-rows.json"), {
    schema_version: "batch-classification-policy-binding-rows.v1",
    generated_at: result.generated_at,
    policy_binding_row_count: result.classification_policy_binding_rows.length,
    classification_policy_binding_rows: result.classification_policy_binding_rows,
  });
  await writeJson(path.join(outDir, "batch-classification-checks.json"), {
    schema_version: "batch-classification-checks.v1",
    generated_at: result.generated_at,
    check_count: result.batch_classification_checks.length,
    batch_classification_checks: result.batch_classification_checks,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "batch-classification-result-validation-report.v1",
    generated_at: result.generated_at,
    batch_classification_result_id: result.batch_classification_result_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

export async function runBatchClassificationResultCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runBatchClassificationResult(args);
    console.log(`Batch classification result ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.batch_classification_result_status}`);
    console.log(`Classified resources: ${result.summary.classified_resource_count}/${result.summary.resource_item_count}`);
    console.log(`Confidence rows: ${result.summary.confidence_present_count}/${result.summary.classification_row_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    if (error.validation?.errors?.length) {
      for (const validationError of error.validation.errors) console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildClassificationRuleRows(dataClassificationRuleEngine, generatedAt) {
  const rules = dataClassificationRuleEngine.classification_rule_catalog?.classification_rules ?? [];
  return rules.map((rule) => ({
    batch_classification_rule_row_id: `batch-classification-rule.${slugify(rule.classification)}`,
    generated_at: generatedAt,
    source_classification_rule_id: rule.classification_rule_id ?? null,
    classification: rule.classification,
    ordinal: integerOrZero(rule.ordinal),
    rule_status: rule.rule_status === "active" ? "active" : "attention",
    default_policy_decision: rule.default_policy_decision ?? "review",
    external_model_decision: rule.external_model_decision ?? "review",
    redaction_required: Boolean(rule.redaction_required),
    required_gates: Array.isArray(rule.required_gates) ? rule.required_gates : [],
    human_review_required: true,
    client_facing_ready: false,
  })).sort(by("ordinal", "classification"));
}

function buildClassificationRows(resourceExpansion, classificationRules, generatedAt) {
  const ruleByClassification = new Map(classificationRules.map((rule) => [rule.classification, rule]));
  return (resourceExpansion.items ?? []).map((item, index) => {
    const classification = item.data_classification ?? null;
    const rule = ruleByClassification.get(classification);
    const confidence = confidenceForItem(item, classification, rule);
    const statusHistory = Array.isArray(item.status_history) ? item.status_history : [];
    const classificationPresent = typeof classification === "string" && classification.length > 0;
    const policyBound = Boolean(rule);
    const passed = classificationPresent && policyBound && confidence.score >= 0.7;
    return {
      batch_classification_row_id: `batch-classification-row.${String(index + 1).padStart(4, "0")}`,
      generated_at: generatedAt,
      item_id: item.item_id ?? null,
      resource_id: item.resource_id ?? null,
      resource_version_id: item.resource_version_id ?? null,
      relative_path: item.relative_path ?? null,
      extension: item.extension ?? null,
      candidate_domain: item.candidate_domain ?? "unknown",
      resource_type: item.resource_type ?? "unknown",
      item_status: item.status ?? "unknown",
      data_classification: classification,
      classification_present: classificationPresent,
      classification_status: passed ? "classified_pending_human_review" : "attention",
      confidence_score: confidence.score,
      confidence_label: confidence.label,
      confidence_present: confidence.score > 0,
      confidence_reason_codes: confidence.reason_codes,
      classification_source: "resource_expansion_metadata",
      policy_binding_status: policyBound ? "bound" : "missing_policy_rule",
      policy_decision: rule?.default_policy_decision ?? null,
      external_model_decision: rule?.external_model_decision ?? null,
      redaction_required: Boolean(rule?.redaction_required),
      status_history_count: statusHistory.length,
      source_path_reference_hash: item.source_path ? sha256(item.source_path) : null,
      source_path_used_for_classification_identity: false,
      file_content_read_performed: false,
      external_model_used: false,
      backfill_execution_performed: false,
      source_mutation_performed: false,
      resource_mutation_performed: false,
      state_mutation_performed: false,
      human_review_required: true,
      legal_advice_generated: false,
      client_facing_ready: false,
    };
  });
}

function buildConfidenceRows(classificationRows, generatedAt) {
  const rowsByKey = new Map();
  for (const row of classificationRows) {
    const key = `${row.data_classification ?? "missing"}|${row.confidence_label}`;
    const rows = rowsByKey.get(key) ?? [];
    rows.push(row);
    rowsByKey.set(key, rows);
  }
  return [...rowsByKey.entries()].map(([key, rows], index) => {
    const [classification, confidenceLabel] = key.split("|");
    const scores = rows.map((row) => row.confidence_score);
    return {
      classification_confidence_row_id: `classification-confidence.${String(index + 1).padStart(4, "0")}`,
      generated_at: generatedAt,
      data_classification: classification === "missing" ? null : classification,
      confidence_label: confidenceLabel,
      classified_item_count: rows.length,
      min_confidence_score: Math.min(...scores),
      max_confidence_score: Math.max(...scores),
      average_confidence_score: round(scores.reduce((sum, value) => sum + value, 0) / scores.length),
      confidence_status: rows.every((row) => row.confidence_present && row.confidence_score >= 0.7) ? "passed" : "attention",
      missing_confidence_count: rows.filter((row) => !row.confidence_present).length,
      human_review_required: true,
      client_facing_ready: false,
    };
  }).sort(by("data_classification", "confidence_label"));
}

function buildPolicyBindingRows(classificationRows, classificationRules, generatedAt) {
  const rowsByClassification = groupBy(classificationRows, "data_classification");
  return [...rowsByClassification.entries()].map(([classification, rows], index) => {
    const rule = classificationRules.find((candidate) => candidate.classification === classification);
    return {
      classification_policy_binding_row_id: `batch-classification-policy-binding.${String(index + 1).padStart(4, "0")}`,
      generated_at: generatedAt,
      data_classification: classification,
      source_classification_rule_id: rule?.source_classification_rule_id ?? null,
      policy_binding_status: rule ? "bound" : "missing_policy_rule",
      classified_item_count: rows.length,
      classified_pending_human_review_count: rows.filter((row) => row.classification_status === "classified_pending_human_review").length,
      policy_decision: rule?.default_policy_decision ?? null,
      external_model_decision: rule?.external_model_decision ?? null,
      redaction_required: Boolean(rule?.redaction_required),
      human_review_required: true,
      client_facing_ready: false,
    };
  }).sort(by("data_classification"));
}

function confidenceForItem(item, classification, rule) {
  const reasonCodes = [];
  let score = 0.72;
  if (classification) reasonCodes.push("classification_present");
  if (rule) reasonCodes.push("policy_rule_bound");
  if (item.status === "quarantined" || item.status === "failed") {
    score = 0.9;
    reasonCodes.push("hold_status_requires_review");
  }
  if (classification === "P5_SECRET" || item.quarantine_reason === "secret_or_credential_path") {
    score = 0.99;
    reasonCodes.push("secret_or_credential_path");
  } else if (classification === "P2_CLIENT_CONFIDENTIAL" || item.candidate_domain === "law-firm") {
    score = Math.max(score, 0.92);
    reasonCodes.push("law_firm_domain_signal");
  } else if (["email", "chat"].includes(item.resource_type)) {
    score = Math.max(score, 0.82);
    reasonCodes.push("communication_resource_type");
  } else if (classification === "P1_INTERNAL") {
    reasonCodes.push("default_internal_classification");
  }
  return {
    score: round(score),
    label: score >= 0.9 ? "high" : score >= 0.7 ? "medium" : "low",
    reason_codes: unique(reasonCodes),
  };
}

function buildClassificationContract({ generatedAt, classificationRows, confidenceRows }) {
  return {
    schema_version: "batch-classification-contract.v1",
    generated_at: generatedAt,
    contract_id: RESULT_SCHEMA_VERSION,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    classification_result_rule: "Every Resource Expansion item receives a data classification, confidence score, confidence label, policy binding, and human-review status.",
    confidence_floor: 0.7,
    classification_row_count: classificationRows.length,
    confidence_row_count: confidenceRows.length,
    source_file_content_read_allowed: false,
    external_model_use_allowed: false,
    client_facing_output_allowed: false,
  };
}

function buildBoundary(generatedAt) {
  return {
    boundary_id: "batch-classification-result.boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    batch_classification_report_only: true,
    source_artifact_read_performed: true,
    backfill_execution_performed: false,
    classification_write_performed: false,
    source_ingest_performed: false,
    file_content_read_performed: false,
    external_model_used: false,
    source_mutation_performed: false,
    resource_mutation_performed: false,
    state_mutation_performed: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    client_facing_ready_count: 0,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
    human_review_note: HUMAN_REVIEW_NOTE,
  };
}

function buildCheckpoints(context) {
  const {
    packageJson,
    roadmapText,
    implementationRoadmapText,
    controlPlaneLoopText,
    reviewDashboardText,
    reviewApiText,
    resourceExpansionRead,
    expansionCursorLedgerRead,
    expansionDedupLedgerRead,
    expansionQuarantineLedgerRead,
    dataClassificationRuleEngineRead,
    backfillJobContractRead,
    resourceExpansion,
    expansionCursorLedger,
    expansionDedupLedger,
    expansionQuarantineLedger,
    dataClassificationRuleEngine,
    backfillJobContract,
    classificationRules,
    classificationRows,
    confidenceRows,
    policyBindingRows,
    boundary,
  } = context;
  const items = resourceExpansion.items ?? [];
  const cursorSummary = expansionCursorLedger.summary ?? {};
  const dedupSummary = expansionDedupLedger.summary ?? {};
  const quarantineSummary = expansionQuarantineLedger.summary ?? {};
  const ruleEngineSummary = dataClassificationRuleEngine.summary ?? {};
  const backfillSummary = backfillJobContract.summary ?? {};
  return [
    checkpoint("source.resource_expansion", resourceExpansionRead.available && resourceExpansion.schema_version === "resource-expansion-job.v1", "Resource Expansion Job is readable."),
    checkpoint("source.expansion_cursor_ledger", expansionCursorLedgerRead.available && cursorSummary.expansion_cursor_ledger_status === "complete" && cursorSummary.phase_slot === "P278", "P278 Expansion Cursor Ledger is complete."),
    checkpoint("source.expansion_dedup_ledger", expansionDedupLedgerRead.available && dedupSummary.expansion_dedup_ledger_status === "complete" && dedupSummary.phase_slot === "P279", "P279 Expansion Dedup Ledger is complete."),
    checkpoint("source.expansion_quarantine_ledger", expansionQuarantineLedgerRead.available && quarantineSummary.expansion_quarantine_ledger_status === "complete" && quarantineSummary.phase_slot === "P280", "P280 Expansion Quarantine Ledger is complete."),
    checkpoint("source.data_classification_rule_engine", dataClassificationRuleEngineRead.available && ruleEngineSummary.classification_rule_engine_status === "complete", "Data Classification Rule Engine is complete."),
    checkpoint("source.backfill_job_contract", backfillJobContractRead.available && backfillSummary.backfill_job_contract_status === "complete" && backfillSummary.phase_slot === "P277", "P277 Backfill Job Contract is complete."),
    checkpoint("surface.package_script", hasScript(packageJson.value, "resource:batch-classification"), "package.json exposes resource:batch-classification."),
    checkpoint("surface.loop_dashboard_api", includesAll(controlPlaneLoopText.value, ["batch_classification_result", "resource:batch-classification"]) && includesAll(reviewDashboardText.value, ["batch_classification_result", "buildBatchClassificationResultStage"]) && includesAll(reviewApiText.value, ["/api/batch-classification-results", "/api/batch-classification-rows"]), "Control-plane loop, dashboard, and API expose Batch Classification Result."),
    checkpoint("surface.ledger_roadmap", includesAll(roadmapText.value, ["P281", "batch classification result"]) && includesAll(implementationRoadmapText.value, ["Phase 281", "Batch Classification Result"]), "Ledger and implementation roadmap promote Phase 281."),
    checkpoint("rules.available", classificationRules.length >= 3 && classificationRules.every((row) => row.rule_status === "active"), "Classification rules are available and active."),
    checkpoint("rows.coverage", classificationRows.length === items.length && classificationRows.length > 0, "Classification rows cover every expansion item."),
    checkpoint("rows.classification_present", classificationRows.every((row) => row.classification_present && row.classification_status === "classified_pending_human_review"), "Every classification row has a classification and pending human-review status."),
    checkpoint("rows.confidence_present", classificationRows.every((row) => row.confidence_present && row.confidence_score >= 0.7 && ["high", "medium"].includes(row.confidence_label)), "Every classification row has confidence above the batch floor."),
    checkpoint("rows.policy_bound", classificationRows.every((row) => row.policy_binding_status === "bound") && policyBindingRows.every((row) => row.policy_binding_status === "bound"), "Every classification row is bound to a policy rule."),
    checkpoint("rows.human_review", classificationRows.every((row) => row.human_review_required && row.client_facing_ready === false), "Every row remains human-review gated and not client-facing."),
    checkpoint("confidence.groups", confidenceRows.length > 0 && confidenceRows.every((row) => row.confidence_status === "passed" && row.missing_confidence_count === 0), "Confidence summary rows pass."),
    checkpoint("boundary.no_content_or_model", boundary.file_content_read_performed === false && boundary.external_model_used === false, "No source file content read or external model use occurs."),
    checkpoint("boundary.no_execution", boundary.backfill_execution_performed === false && boundary.classification_write_performed === false && boundary.source_ingest_performed === false, "No backfill execution, classification write, or source ingest occurs."),
    checkpoint("boundary.no_mutation_delivery", boundary.source_mutation_performed === false && boundary.resource_mutation_performed === false && boundary.state_mutation_performed === false && boundary.delivery_execution_performed === false, "No source/resource/state mutation or delivery occurs."),
    checkpoint("boundary.no_legal_client", boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false && boundary.client_facing_ready_count === 0, "No legal advice or client-facing output is generated."),
    checkpoint("boundary.windows_baseline", boundary.windows_baseline_stability_preserved === true && boundary.mac_windows_completion_instability_guard === true && quarantineSummary.windows_baseline_stability_preserved === true, "Windows baseline and Mac/Windows completion guard are preserved."),
  ];
}

function summarizeBatchClassification({ resourceExpansion, expansionCursorLedger, expansionDedupLedger, expansionQuarantineLedger, dataClassificationRuleEngine, backfillJobContract, classificationRules, classificationRows, confidenceRows, policyBindingRows, boundary, validation }) {
  const summary = resourceExpansion.summary ?? {};
  const cursorSummary = expansionCursorLedger.summary ?? {};
  const dedupSummary = expansionDedupLedger.summary ?? {};
  const quarantineSummary = expansionQuarantineLedger.summary ?? {};
  const ruleEngineSummary = dataClassificationRuleEngine.summary ?? {};
  const backfillSummary = backfillJobContract.summary ?? {};
  return {
    batch_classification_result_status: validation.valid ? "complete" : "attention",
    batch_classification_result_id: RESULT_SCHEMA_VERSION,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_resource_expansion_schema_version: resourceExpansion.schema_version ?? null,
    source_resource_expansion_job_id: resourceExpansion.job_id ?? null,
    source_resource_expansion_source_id: resourceExpansion.source_id ?? null,
    source_expansion_cursor_ledger_status: cursorSummary.expansion_cursor_ledger_status ?? "unknown",
    source_expansion_cursor_phase_slot: cursorSummary.phase_slot ?? null,
    source_expansion_dedup_ledger_status: dedupSummary.expansion_dedup_ledger_status ?? "unknown",
    source_expansion_dedup_phase_slot: dedupSummary.phase_slot ?? null,
    source_expansion_quarantine_ledger_status: quarantineSummary.expansion_quarantine_ledger_status ?? "unknown",
    source_expansion_quarantine_phase_slot: quarantineSummary.phase_slot ?? null,
    source_data_classification_rule_engine_status: ruleEngineSummary.classification_rule_engine_status ?? "unknown",
    source_backfill_job_contract_status: backfillSummary.backfill_job_contract_status ?? "unknown",
    source_backfill_job_contract_phase_slot: backfillSummary.phase_slot ?? null,
    resource_item_count: integerOrZero(summary.discovered_count) || classificationRows.length,
    terminal_count: integerOrZero(summary.terminal_count),
    classification_rule_count: classificationRules.length,
    classification_row_count: classificationRows.length,
    classified_resource_count: classificationRows.filter((row) => row.classification_status === "classified_pending_human_review").length,
    classification_present_count: classificationRows.filter((row) => row.classification_present).length,
    missing_classification_count: classificationRows.filter((row) => !row.classification_present).length,
    confidence_present_count: classificationRows.filter((row) => row.confidence_present).length,
    missing_confidence_count: classificationRows.filter((row) => !row.confidence_present).length,
    high_confidence_count: classificationRows.filter((row) => row.confidence_label === "high").length,
    medium_confidence_count: classificationRows.filter((row) => row.confidence_label === "medium").length,
    low_confidence_count: classificationRows.filter((row) => row.confidence_label === "low").length,
    policy_bound_classification_count: classificationRows.filter((row) => row.policy_binding_status === "bound").length,
    unbound_classification_count: classificationRows.filter((row) => row.policy_binding_status !== "bound").length,
    confidence_summary_row_count: confidenceRows.length,
    passed_confidence_summary_row_count: confidenceRows.filter((row) => row.confidence_status === "passed").length,
    classification_policy_binding_row_count: policyBindingRows.length,
    passed_policy_binding_row_count: policyBindingRows.filter((row) => row.policy_binding_status === "bound").length,
    human_review_required_count: classificationRows.filter((row) => row.human_review_required).length,
    client_facing_ready_count: classificationRows.filter((row) => row.client_facing_ready).length,
    source_path_used_for_classification_identity_count: classificationRows.filter((row) => row.source_path_used_for_classification_identity).length,
    file_content_read_performed_count: classificationRows.filter((row) => row.file_content_read_performed).length,
    external_model_used_count: classificationRows.filter((row) => row.external_model_used).length,
    read_only: boundary.read_only,
    batch_classification_report_only: boundary.batch_classification_report_only,
    source_artifact_read_performed: boundary.source_artifact_read_performed,
    backfill_execution_performed: boundary.backfill_execution_performed,
    classification_write_performed: boundary.classification_write_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    file_content_read_performed: boundary.file_content_read_performed,
    external_model_used: boundary.external_model_used,
    source_mutation_performed: boundary.source_mutation_performed,
    resource_mutation_performed: boundary.resource_mutation_performed,
    state_mutation_performed: boundary.state_mutation_performed,
    delivery_execution_performed: boundary.delivery_execution_performed,
    protected_action_executed: boundary.protected_action_executed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved && quarantineSummary.windows_baseline_stability_preserved === true,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: validation.items.length,
    failed_checkpoint_count: validation.items.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
  };
}

function buildSourceContracts(reads) {
  return [
    sourceContract("package.json", reads.packageJson),
    sourceContract("final-completion-phase-ledger", reads.roadmapText),
    sourceContract("implementation-roadmap", reads.implementationRoadmapText),
    sourceContract("control-plane-loop", reads.controlPlaneLoopText),
    sourceContract("review-dashboard", reads.reviewDashboardText),
    sourceContract("review-api", reads.reviewApiText),
    sourceContract("resource-expansion-job", reads.resourceExpansionRead),
    sourceContract("expansion-cursor-ledger", reads.expansionCursorLedgerRead),
    sourceContract("expansion-dedup-ledger", reads.expansionDedupLedgerRead),
    sourceContract("expansion-quarantine-ledger", reads.expansionQuarantineLedgerRead),
    sourceContract("data-classification-rule-engine", reads.dataClassificationRuleEngineRead),
    sourceContract("backfill-job-contract", reads.backfillJobContractRead),
  ];
}

function sourceContract(label, readResult) {
  return {
    label,
    available: readResult.available,
    schema_version: readResult.value?.schema_version ?? null,
    content_hash: readResult.content_hash ?? null,
    error: readResult.error ?? null,
  };
}

function renderSummary(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Batch Classification Result");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.batch_classification_result_status}`);
  lines.push(`Phase: ${summary.phase_slot}`);
  lines.push(`Source job: ${summary.source_resource_expansion_job_id}`);
  lines.push("");
  lines.push("## Classification");
  lines.push("");
  lines.push(`- Classified resources: ${summary.classified_resource_count}/${summary.classification_row_count}`);
  lines.push(`- Confidence present: ${summary.confidence_present_count}/${summary.classification_row_count}`);
  lines.push(`- Policy bound: ${summary.policy_bound_classification_count}/${summary.classification_row_count}`);
  lines.push(`- High/medium/low confidence: ${summary.high_confidence_count}/${summary.medium_confidence_count}/${summary.low_confidence_count}`);
  lines.push("");
  lines.push("## Boundary");
  lines.push("");
  lines.push("- The result reads existing Resource Expansion and policy artifacts only.");
  lines.push("- It performs no backfill execution, classification write, source ingest, source file content read, external model use, mutation, delivery, protected action, legal advice, or client-facing output.");
  lines.push("- Classification rows remain human-review gated and not client-facing.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function serializableBatchClassificationResult(result) {
  const { summary_markdown: _summaryMarkdown, ...serializable } = result;
  return serializable;
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.path,
      message: item.message,
      status: item.status,
    }));
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
    items,
  };
}

function checkpoint(checkpointId, condition, message) {
  return {
    checkpoint_id: checkpointId,
    status: condition ? "passed" : "failed",
    message,
    human_review_required: true,
    client_facing_ready: false,
  };
}

function normalizeInputs(options) {
  return {
    repo_root: options.repoRoot ?? DEFAULT_BATCH_CLASSIFICATION_RESULT_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_BATCH_CLASSIFICATION_RESULT_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_BATCH_CLASSIFICATION_RESULT_INPUTS.roadmapPath,
    implementation_roadmap_path: options.implementationRoadmapPath ?? DEFAULT_BATCH_CLASSIFICATION_RESULT_INPUTS.implementationRoadmapPath,
    control_plane_loop_path: options.controlPlaneLoopPath ?? DEFAULT_BATCH_CLASSIFICATION_RESULT_INPUTS.controlPlaneLoopPath,
    review_dashboard_path: options.reviewDashboardPath ?? DEFAULT_BATCH_CLASSIFICATION_RESULT_INPUTS.reviewDashboardPath,
    review_api_path: options.reviewApiPath ?? DEFAULT_BATCH_CLASSIFICATION_RESULT_INPUTS.reviewApiPath,
    resource_expansion_path: options.resourceExpansionPath ?? DEFAULT_BATCH_CLASSIFICATION_RESULT_INPUTS.resourceExpansionPath,
    expansion_cursor_ledger_path: options.expansionCursorLedgerPath ?? DEFAULT_BATCH_CLASSIFICATION_RESULT_INPUTS.expansionCursorLedgerPath,
    expansion_dedup_ledger_path: options.expansionDedupLedgerPath ?? DEFAULT_BATCH_CLASSIFICATION_RESULT_INPUTS.expansionDedupLedgerPath,
    expansion_quarantine_ledger_path: options.expansionQuarantineLedgerPath ?? DEFAULT_BATCH_CLASSIFICATION_RESULT_INPUTS.expansionQuarantineLedgerPath,
    data_classification_rule_engine_path: options.dataClassificationRuleEnginePath ?? DEFAULT_BATCH_CLASSIFICATION_RESULT_INPUTS.dataClassificationRuleEnginePath,
    backfill_job_contract_path: options.backfillJobContractPath ?? DEFAULT_BATCH_CLASSIFICATION_RESULT_INPUTS.backfillJobContractPath,
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--resource-expansion") parsed.resourceExpansionPath = argv[++index];
    else if (arg === "--expansion-cursor-ledger") parsed.expansionCursorLedgerPath = argv[++index];
    else if (arg === "--expansion-dedup-ledger") parsed.expansionDedupLedgerPath = argv[++index];
    else if (arg === "--expansion-quarantine-ledger") parsed.expansionQuarantineLedgerPath = argv[++index];
    else if (arg === "--data-classification-rule-engine") parsed.dataClassificationRuleEnginePath = argv[++index];
    else if (arg === "--backfill-job-contract") parsed.backfillJobContractPath = argv[++index];
    else if (arg === "--repo-root") parsed.repoRoot = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/batch-classification-result.mjs [options]

Options:
  --resource-expansion <path>              resource-expansion-job.json path.
  --expansion-cursor-ledger <path>         expansion-cursor-ledger.json path.
  --expansion-dedup-ledger <path>          expansion-dedup-ledger.json path.
  --expansion-quarantine-ledger <path>     expansion-quarantine-ledger.json path.
  --data-classification-rule-engine <path> data-classification-rule-engine.json path.
  --backfill-job-contract <path>           backfill-job-contract.json path.
  --out-dir <folder>                       Output folder.
  --check                                  Fail if validation does not pass.
  -h, --help                               Show this help.
`);
}

async function readJsonOrError(filePath) {
  try {
    const text = await readFileWithRetry(filePath, "utf8");
    return {
      available: true,
      path: filePath,
      value: JSON.parse(text),
      content_hash: sha256(text),
    };
  } catch (error) {
    return {
      available: false,
      path: filePath,
      value: null,
      error: String(error?.message ?? error),
    };
  }
}

async function readTextOrError(filePath) {
  try {
    const text = await readFileWithRetry(filePath, "utf8");
    return {
      available: true,
      path: filePath,
      value: text,
      content_hash: sha256(text),
    };
  } catch (error) {
    return {
      available: false,
      path: filePath,
      value: "",
      error: String(error?.message ?? error),
    };
  }
}

async function readFileWithRetry(filePath, encoding, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await readFile(filePath, encoding);
    } catch (error) {
      lastError = error;
      if (!["EIO", "ENOENT", "EBUSY", "EPERM"].includes(error?.code) || attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 50));
    }
  }
  throw lastError;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName]);
}

function includesAll(text, needles) {
  return needles.every((needle) => String(text ?? "").includes(needle));
}

function groupBy(items, key) {
  const grouped = new Map();
  for (const item of items) {
    const value = item[key] ?? "unknown";
    const rows = grouped.get(value) ?? [];
    rows.push(item);
    grouped.set(value, rows);
  }
  return grouped;
}

function integerOrZero(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function unique(values) {
  return [...new Set(values)];
}

function by(...keys) {
  return (left, right) => {
    for (const key of keys) {
      const comparison = String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
      if (comparison !== 0) return comparison;
    }
    return 0;
  };
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.TZ]/g, "").slice(0, 14);
}

function slugify(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "unknown";
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}
