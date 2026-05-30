import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_ISSUE_GRAPH_STORE_OUT_DIR = "artifacts/issue-graph-store/latest";
export const DEFAULT_ISSUE_GRAPH_STORE_INPUTS = {
  factClaimStorePath: "artifacts/fact-claim-store/latest/fact-claim-store.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const ISSUE_GRAPH_STORE_CONTRACT_ID = "issue-graph-store.v1";
const ISSUE_SCHEMA_VERSION = "issue.v2";
const FACT_CLAIM_SCHEMA_VERSION = "fact-claim.v2";
const LEGAL_RULE_SCHEMA_VERSION = "legal-rule.v1";
const ISSUE_TYPES = new Set(["corporate_approval", "monetary_exposure", "deadline_or_chronology", "contract_obligation", "risk_signal", "general_review"]);
const SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const REVIEW_STATUSES = new Set(["needs_review", "approved", "rejected", "changes_requested", "waived"]);

export async function runIssueGraphStore(options = {}) {
  const result = await buildIssueGraphStore(options);
  if (options.write !== false) await writeIssueGraphStore(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Issue graph store failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildIssueGraphStore(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ISSUE_GRAPH_STORE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const factClaimStore = await readJson(inputs.fact_claim_store_path);
  const packageText = await readText(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);
  const factClaims = factClaimStore.fact_claim_catalog?.fact_claims ?? [];
  const issues = factClaims.map((fact) => buildIssue(fact, generatedAt));
  const factIssueBindings = issues.map((issue) => buildFactIssueBinding(issue, factClaims));
  const legalRules = buildLegalRules(issues, generatedAt);
  const legalRuleBindings = issues.map((issue) => buildLegalRuleBinding(issue, generatedAt));
  const riskSeverityAssessments = issues.map((issue) => buildRiskSeverityAssessment(issue, generatedAt));
  const reviewQueueItems = issues.map((issue) => buildReviewQueueItem(issue, generatedAt));
  const issueGraphIndexes = buildIssueGraphIndexes(issues, factIssueBindings, legalRuleBindings, riskSeverityAssessments, generatedAt);
  const validationItems = validateIssueGraphStore({
    packageText,
    roadmapText,
    factClaimStore,
    factClaims,
    issues,
    factIssueBindings,
    legalRules,
    legalRuleBindings,
    riskSeverityAssessments,
    reviewQueueItems,
    issueGraphIndexes,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeStore({
    factClaimStore,
    factClaims,
    issues,
    factIssueBindings,
    legalRules,
    legalRuleBindings,
    riskSeverityAssessments,
    reviewQueueItems,
    validationItems,
    validation,
  });
  const result = {
    schema_version: "issue-graph-store.v1",
    generated_at: generatedAt,
    issue_graph_store_id: `issue-graph-store.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_fact_claim_store: summarizeSource("fact_claim_store", factClaimStore),
    issue_graph_store_contract: buildStoreContract(generatedAt),
    issue_graph_catalog: {
      schema_version: "issue-graph-catalog.v1",
      generated_at: generatedAt,
      issues,
      fact_issue_bindings: factIssueBindings,
      legal_rules: legalRules,
      legal_rule_bindings: legalRuleBindings,
      risk_severity_assessments: riskSeverityAssessments,
      review_queue_items: reviewQueueItems,
      issue_graph_indexes: issueGraphIndexes,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderIssueGraphStoreMarkdown(result),
  };
}

export async function writeIssueGraphStore(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableStore(result);
  await writeJson(path.join(outDir, "issue-graph-store.json"), serializable);
  await writeJson(path.join(outDir, "issues.json"), {
    generated_at: result.generated_at,
    issue_count: result.issue_graph_catalog.issues.length,
    issues: result.issue_graph_catalog.issues,
  });
  await writeJson(path.join(outDir, "fact-issue-bindings.json"), {
    generated_at: result.generated_at,
    fact_issue_binding_count: result.issue_graph_catalog.fact_issue_bindings.length,
    fact_issue_bindings: result.issue_graph_catalog.fact_issue_bindings,
  });
  await writeJson(path.join(outDir, "legal-rules.json"), {
    generated_at: result.generated_at,
    legal_rule_count: result.issue_graph_catalog.legal_rules.length,
    legal_rules: result.issue_graph_catalog.legal_rules,
  });
  await writeJson(path.join(outDir, "issue-legal-rule-bindings.json"), {
    generated_at: result.generated_at,
    legal_rule_binding_count: result.issue_graph_catalog.legal_rule_bindings.length,
    legal_rule_bindings: result.issue_graph_catalog.legal_rule_bindings,
  });
  await writeJson(path.join(outDir, "risk-severity-assessments.json"), {
    generated_at: result.generated_at,
    risk_severity_assessment_count: result.issue_graph_catalog.risk_severity_assessments.length,
    risk_severity_assessments: result.issue_graph_catalog.risk_severity_assessments,
  });
  await writeJson(path.join(outDir, "issue-review-queue.json"), {
    generated_at: result.generated_at,
    review_queue_item_count: result.issue_graph_catalog.review_queue_items.length,
    review_queue_items: result.issue_graph_catalog.review_queue_items,
  });
  await writeJson(path.join(outDir, "issue-graph-indexes.json"), {
    generated_at: result.generated_at,
    issue_graph_indexes: result.issue_graph_catalog.issue_graph_indexes,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    issue_graph_store_id: result.issue_graph_store_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runIssueGraphStoreCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runIssueGraphStore(args);
    console.log(`Issue graph store written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.issue_graph_store_status}`);
    console.log(`Fact claims: ${result.summary.fact_claim_count}`);
    console.log(`Issues: ${result.summary.issue_count}`);
    console.log(`Fact-issue bindings: ${result.summary.fact_issue_binding_count}`);
    console.log(`Legal rule bindings: ${result.summary.legal_rule_binding_count}`);
    console.log(`Risk severity assessments: ${result.summary.risk_severity_assessment_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildStoreContract(generatedAt) {
  return {
    schema_version: "issue-graph-store-contract.v1",
    issue_graph_store_contract_id: ISSUE_GRAPH_STORE_CONTRACT_ID,
    generated_at: generatedAt,
    fact_claim_schema_version: FACT_CLAIM_SCHEMA_VERSION,
    issue_schema_version: ISSUE_SCHEMA_VERSION,
    legal_rule_schema_version: LEGAL_RULE_SCHEMA_VERSION,
    source_inputs: ["fact-claim-store.v1", "fact-claim.v2"],
    required_identity_fields: ["tenant_id", "matter_id", "classification", "policy_snapshot_id"],
    required_lineage_links: ["linked_fact_ids", "evidence_item_ids", "legal_rule_ids", "lineage_id"],
    issue_rule: "each_machine_extracted_fact_claim_creates_one_review_pending_issue_candidate",
    legal_rule_rule: "each_issue_candidate_links_to_a_review_placeholder_legal_rule",
    risk_rule: "risk_severity_is_machine_assessed_and_requires_human_review_before_output",
    matter_boundary_rule: "issue_inherits_matter_boundary_from_linked_fact_claim",
  };
}

function buildIssue(fact, generatedAt) {
  const issueType = inferIssueType(fact);
  const severity = inferSeverity(fact, issueType);
  const legalRuleId = legalRuleIdForIssueType(issueType);
  const issueId = `issue.${slugify(fact.fact_id)}`;
  return {
    schema_version: ISSUE_SCHEMA_VERSION,
    issue_id: issueId,
    issue_graph_record_id: `issue-graph-record.${slugify(fact.fact_id)}`,
    tenant_id: fact.tenant_id ?? null,
    matter_id: fact.matter_id ?? null,
    classification: fact.classification ?? null,
    policy_snapshot_id: fact.policy_snapshot_id ?? null,
    issue_type: issueType,
    title: buildIssueTitle(fact, issueType),
    linked_fact_ids: [fact.fact_id],
    linked_fact_count: 1,
    primary_fact_id: fact.fact_id,
    evidence_item_ids: fact.evidence_item_ids ?? [],
    evidence_item_count: fact.evidence_item_count ?? fact.evidence_item_ids?.length ?? 0,
    legal_rule_ids: [legalRuleId],
    legal_rule_count: 1,
    severity,
    risk_severity: severity,
    risk_score: severityScore(severity),
    status: "needs_review",
    review_status: "needs_review",
    verification_state: "machine_extracted_pending_review",
    lineage_id: `lineage.issue.${slugify(issueId)}`,
    created_at: generatedAt,
    metadata: {
      source_schema_version: fact.schema_version ?? null,
      fact_store_record_id: fact.fact_store_record_id ?? null,
      fact_type: fact.fact_type ?? null,
      fact_confidence: fact.confidence ?? null,
      fact_reliability: fact.reliability ?? null,
      fact_statement: fact.statement ?? "",
      primary_evidence_item_id: fact.primary_evidence_item_id ?? null,
      source_span_ids: fact.source_span_ids ?? [],
      machine_assessment_note: "Issue candidate, legal rule, and risk severity require attorney review before client-facing use.",
    },
  };
}

function buildFactIssueBinding(issue, factClaims) {
  const factById = new Map(factClaims.map((fact) => [fact.fact_id, fact]));
  const fact = factById.get(issue.primary_fact_id);
  return {
    schema_version: "fact-issue-binding.v1",
    fact_issue_binding_id: `fact-issue-binding.${slugify(issue.primary_fact_id)}.${slugify(issue.issue_id)}`,
    fact_id: issue.primary_fact_id,
    issue_id: issue.issue_id,
    binding_status: fact ? "bound" : "broken",
    tenant_id: issue.tenant_id,
    matter_id: issue.matter_id,
    classification: issue.classification,
    fact_type: fact?.fact_type ?? null,
    issue_type: issue.issue_type,
    risk_severity: issue.risk_severity,
    evidence_item_ids: issue.evidence_item_ids,
    matter_preserved: Boolean(fact && fact.matter_id === issue.matter_id),
    classification_preserved: Boolean(fact && fact.classification === issue.classification),
    policy_snapshot_preserved: Boolean(fact && fact.policy_snapshot_id === issue.policy_snapshot_id),
    evidence_links_preserved: Boolean(fact && issue.evidence_item_ids.every((evidenceId) => fact.evidence_item_ids.includes(evidenceId))),
    created_at: issue.created_at,
  };
}

function buildLegalRules(issues, generatedAt) {
  const issueTypes = [...new Set(issues.map((issue) => issue.issue_type))].sort();
  return issueTypes.map((issueType) => ({
    schema_version: LEGAL_RULE_SCHEMA_VERSION,
    legal_rule_id: legalRuleIdForIssueType(issueType),
    issue_type: issueType,
    jurisdiction: "KR",
    rule_category: ruleCategoryForIssueType(issueType),
    rule_label: ruleLabelForIssueType(issueType),
    source_status: "placeholder_requires_attorney_confirmation",
    verification_status: "requires_attorney_confirmation",
    human_review_required: true,
    created_at: generatedAt,
    metadata: {
      rule_scope: "issue_graph_candidate",
      citation_required_before_output: true,
    },
  }));
}

function buildLegalRuleBinding(issue, generatedAt) {
  const legalRuleId = issue.legal_rule_ids[0];
  return {
    schema_version: "issue-legal-rule-binding.v1",
    issue_legal_rule_binding_id: `issue-legal-rule-binding.${slugify(issue.issue_id)}.${slugify(legalRuleId)}`,
    issue_id: issue.issue_id,
    legal_rule_id: legalRuleId,
    binding_status: "bound",
    issue_type: issue.issue_type,
    risk_severity: issue.risk_severity,
    verification_status: "requires_attorney_confirmation",
    human_review_required: true,
    created_at: generatedAt,
  };
}

function buildRiskSeverityAssessment(issue, generatedAt) {
  return {
    schema_version: "risk-severity-assessment.v1",
    risk_severity_assessment_id: `risk-severity-assessment.${slugify(issue.issue_id)}`,
    issue_id: issue.issue_id,
    linked_fact_ids: issue.linked_fact_ids,
    linked_fact_count: issue.linked_fact_count,
    severity: issue.risk_severity,
    risk_score: issue.risk_score,
    risk_basis: riskBasisForIssue(issue),
    review_status: issue.review_status,
    human_review_required: true,
    created_at: generatedAt,
  };
}

function buildReviewQueueItem(issue, generatedAt) {
  return {
    schema_version: "issue-review-queue-item.v1",
    review_queue_item_id: `issue-review-queue-item.${slugify(issue.issue_id)}`,
    issue_id: issue.issue_id,
    subject_type: "issue",
    subject_id: issue.issue_id,
    matter_id: issue.matter_id,
    classification: issue.classification,
    review_status: issue.review_status,
    review_required: issue.review_status === "needs_review",
    approval_required_before_output: true,
    queue_reason: "machine_extracted_issue_candidate",
    assigned_role: "attorney_reviewer",
    created_at: generatedAt,
  };
}

function buildIssueGraphIndexes(issues, factIssueBindings, legalRuleBindings, riskSeverityAssessments, generatedAt) {
  return {
    schema_version: "issue-graph-indexes.v1",
    generated_at: generatedAt,
    by_matter_id: countBy(issues, "matter_id"),
    by_classification: countBy(issues, "classification"),
    by_issue_type: countBy(issues, "issue_type"),
    by_risk_severity: countBy(issues, "risk_severity"),
    by_review_status: countBy(issues, "review_status"),
    by_fact_binding_status: countBy(factIssueBindings, "binding_status"),
    by_legal_rule_binding_status: countBy(legalRuleBindings, "binding_status"),
    by_assessment_severity: countBy(riskSeverityAssessments, "severity"),
  };
}

function validateIssueGraphStore({
  packageText,
  roadmapText,
  factClaimStore,
  factClaims,
  issues,
  factIssueBindings,
  legalRules,
  legalRuleBindings,
  riskSeverityAssessments,
  reviewQueueItems,
  issueGraphIndexes,
}) {
  const validationItems = [];
  const packageJson = JSON.parse(packageText);
  const factById = new Map(factClaims.map((fact) => [fact.fact_id, fact]));
  const legalRuleIds = new Set(legalRules.map((rule) => rule.legal_rule_id));
  const factIssueBindingByIssueId = new Map(factIssueBindings.map((binding) => [binding.issue_id, binding]));
  const legalRuleBindingByIssueId = new Map(legalRuleBindings.map((binding) => [binding.issue_id, binding]));
  const riskByIssueId = new Map(riskSeverityAssessments.map((assessment) => [assessment.issue_id, assessment]));
  const reviewByIssueId = new Map(reviewQueueItems.map((item) => [item.issue_id, item]));

  pushCheck(validationItems, "contract", "package_script_registered", Boolean(packageJson.scripts?.["resource:issue-graph"]), "package.json must expose resource:issue-graph.");
  pushCheck(validationItems, "contract", "roadmap_phase_documented", roadmapText.includes("## Phase 141: Issue Graph Store"), "Implementation roadmap must document Phase 141.");
  pushCheck(validationItems, "source", "fact_claim_store_complete", factClaimStore.summary?.fact_claim_store_status === "complete", "Fact Claim Store must be complete.");
  pushCheck(validationItems, "catalog", "fact_claims_present", factClaims.length > 0, "At least one fact claim is required.");
  pushCheck(validationItems, "catalog", "issues_present", issues.length > 0, "At least one issue candidate must be materialized.");
  pushCheck(validationItems, "catalog", "issue_count_matches_facts", issues.length === factClaims.length, "Every fact claim must produce one issue candidate.");
  pushCheck(validationItems, "catalog", "fact_binding_count_matches_issue", factIssueBindings.length === issues.length, "Every issue must have one fact binding.");
  pushCheck(validationItems, "catalog", "legal_rule_binding_count_matches_issue", legalRuleBindings.length === issues.length, "Every issue must have one legal rule binding.");
  pushCheck(validationItems, "catalog", "risk_assessment_count_matches_issue", riskSeverityAssessments.length === issues.length, "Every issue must have one risk severity assessment.");
  pushCheck(validationItems, "catalog", "review_queue_count_matches_issue", reviewQueueItems.length === issues.length, "Every issue must have one review queue item.");
  pushCheck(validationItems, "catalog", "legal_rules_present", legalRules.length > 0, "At least one legal rule placeholder must be present.");
  pushCheck(validationItems, "catalog", "issue_index_present", Boolean(issueGraphIndexes.by_issue_type), "Issue graph indexes must be present.");

  for (const rule of legalRules) {
    pushCheck(validationItems, `legal_rules.${rule.legal_rule_id}`, "schema_version_canonical", rule.schema_version === LEGAL_RULE_SCHEMA_VERSION, "Legal rule must use legal-rule.v1.");
    pushCheck(validationItems, `legal_rules.${rule.legal_rule_id}`, "human_review_required", rule.human_review_required === true && rule.verification_status === "requires_attorney_confirmation", "Legal rule placeholder must require attorney confirmation.");
  }

  for (const issue of issues) {
    const factId = issue.primary_fact_id;
    const fact = factById.get(factId);
    const factBinding = factIssueBindingByIssueId.get(issue.issue_id);
    const legalRuleBinding = legalRuleBindingByIssueId.get(issue.issue_id);
    const risk = riskByIssueId.get(issue.issue_id);
    const review = reviewByIssueId.get(issue.issue_id);
    const pathPrefix = `issues.${issue.issue_id}`;
    pushCheck(validationItems, pathPrefix, "schema_version_canonical", issue.schema_version === ISSUE_SCHEMA_VERSION, "Issue must use issue.v2.");
    pushCheck(validationItems, pathPrefix, "fact_link_resolves", Boolean(fact), "Issue must link to a fact claim.");
    pushCheck(validationItems, pathPrefix, "fact_count_canonical", issue.linked_fact_count === 1 && issue.linked_fact_ids.length === 1, "P141 issue must bind one primary fact claim.");
    pushCheck(validationItems, pathPrefix, "fact_id_referenced", issue.linked_fact_ids.includes(factId), "Issue must reference its primary fact id.");
    pushCheck(validationItems, pathPrefix, "issue_type_canonical", ISSUE_TYPES.has(issue.issue_type), "Issue type must be canonical.");
    pushCheck(validationItems, pathPrefix, "severity_canonical", SEVERITIES.has(issue.risk_severity) && issue.severity === issue.risk_severity, "Issue severity must be canonical and mirrored to risk_severity.");
    pushCheck(validationItems, pathPrefix, "review_status_canonical", REVIEW_STATUSES.has(issue.review_status), "Issue review_status must be canonical.");
    pushCheck(validationItems, pathPrefix, "machine_review_pending", issue.review_status === "needs_review" && issue.status === "needs_review" && issue.verification_state === "machine_extracted_pending_review", "Machine extracted issues must remain pending human review.");
    pushCheck(validationItems, pathPrefix, "legal_rule_link_present", issue.legal_rule_count === 1 && issue.legal_rule_ids.length === 1 && legalRuleIds.has(issue.legal_rule_ids[0]), "Issue must link to one legal rule placeholder.");
    pushCheck(validationItems, pathPrefix, "evidence_links_preserved", Boolean(fact && issue.evidence_item_count === fact.evidence_item_count && issue.evidence_item_ids.every((evidenceId) => fact.evidence_item_ids.includes(evidenceId))), "Issue must preserve evidence item links from fact claim.");
    pushCheck(validationItems, pathPrefix, "matter_preserved", Boolean(fact && fact.matter_id === issue.matter_id), "Issue must preserve matter_id from fact claim.");
    pushCheck(validationItems, pathPrefix, "classification_preserved", Boolean(fact && fact.classification === issue.classification), "Issue must preserve classification from fact claim.");
    pushCheck(validationItems, pathPrefix, "policy_snapshot_preserved", Boolean(fact && fact.policy_snapshot_id === issue.policy_snapshot_id), "Issue must preserve policy snapshot from fact claim.");
    pushCheck(validationItems, pathPrefix, "fact_binding_row_present", factBinding?.binding_status === "bound", "Issue must have a bound fact issue binding.");
    pushCheck(validationItems, pathPrefix, "legal_rule_binding_row_present", legalRuleBinding?.binding_status === "bound" && legalRuleBinding.human_review_required === true, "Issue must have a bound legal rule binding requiring review.");
    pushCheck(validationItems, pathPrefix, "risk_assessment_present", risk?.severity === issue.risk_severity && risk.human_review_required === true, "Issue must have a matching risk severity assessment.");
    pushCheck(validationItems, pathPrefix, "review_queue_present", review?.review_required === true, "Issue must have a review queue item.");
  }

  return validationItems;
}

function pushCheck(validationItems, pathLabel, checkId, passed, message) {
  validationItems.push({
    validation_id: `issue-graph-store-validation.${slugify(pathLabel)}.${checkId}`,
    path: pathLabel,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
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

function summarizeStore({ factClaimStore, factClaims, issues, factIssueBindings, legalRules, legalRuleBindings, riskSeverityAssessments, reviewQueueItems, validationItems, validation }) {
  return {
    issue_graph_store_status: validation.valid ? "complete" : "blocked",
    issue_graph_store_contract_id: ISSUE_GRAPH_STORE_CONTRACT_ID,
    issue_schema_version: ISSUE_SCHEMA_VERSION,
    legal_rule_schema_version: LEGAL_RULE_SCHEMA_VERSION,
    fact_claim_store_status: factClaimStore.summary?.fact_claim_store_status ?? "unknown",
    fact_claim_count: factClaims.length,
    issue_count: issues.length,
    fact_issue_binding_count: factIssueBindings.length,
    legal_rule_count: legalRules.length,
    legal_rule_binding_count: legalRuleBindings.length,
    risk_severity_assessment_count: riskSeverityAssessments.length,
    review_queue_item_count: reviewQueueItems.length,
    fact_linked_issue_count: issues.filter((issue) => issue.linked_fact_ids.length > 0).length,
    legal_rule_linked_issue_count: issues.filter((issue) => issue.legal_rule_ids.length > 0).length,
    risk_severity_linked_issue_count: riskSeverityAssessments.filter((assessment) => SEVERITIES.has(assessment.severity)).length,
    matter_preserved_issue_count: factIssueBindings.filter((binding) => binding.matter_preserved).length,
    classification_preserved_issue_count: factIssueBindings.filter((binding) => binding.classification_preserved).length,
    policy_snapshot_preserved_issue_count: factIssueBindings.filter((binding) => binding.policy_snapshot_preserved).length,
    evidence_links_preserved_issue_count: factIssueBindings.filter((binding) => binding.evidence_links_preserved).length,
    needs_review_count: issues.filter((issue) => issue.review_status === "needs_review").length,
    approved_count: issues.filter((issue) => issue.review_status === "approved").length,
    critical_severity_count: issues.filter((issue) => issue.risk_severity === "critical").length,
    high_severity_count: issues.filter((issue) => issue.risk_severity === "high").length,
    medium_severity_count: issues.filter((issue) => issue.risk_severity === "medium").length,
    low_severity_count: issues.filter((issue) => issue.risk_severity === "low").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_matter_id: countBy(issues, "matter_id"),
    by_classification: countBy(issues, "classification"),
    by_issue_type: countBy(issues, "issue_type"),
    by_risk_severity: countBy(issues, "risk_severity"),
    by_review_status: countBy(issues, "review_status"),
  };
}

function renderIssueGraphStoreMarkdown(result) {
  const lines = [];
  lines.push("# Issue Graph Store");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.issue_graph_store_status}`);
  lines.push("");
  lines.push(`- Contract: ${result.summary.issue_graph_store_contract_id}`);
  lines.push(`- Fact claims: ${result.summary.fact_claim_count}`);
  lines.push(`- Issues: ${result.summary.issue_count}`);
  lines.push(`- Fact-issue bindings: ${result.summary.fact_issue_binding_count}`);
  lines.push(`- Legal rules: ${result.summary.legal_rule_count}`);
  lines.push(`- Legal rule bindings: ${result.summary.legal_rule_binding_count}`);
  lines.push(`- Risk severity assessments: ${result.summary.risk_severity_assessment_count}`);
  lines.push(`- Review queue items: ${result.summary.review_queue_item_count}`);
  lines.push(`- Fact linked issues: ${result.summary.fact_linked_issue_count}`);
  lines.push(`- Legal rule linked issues: ${result.summary.legal_rule_linked_issue_count}`);
  lines.push(`- Risk severity linked issues: ${result.summary.risk_severity_linked_issue_count}`);
  lines.push(`- Needs review: ${result.summary.needs_review_count}`);
  lines.push(`- Auto approved: ${result.summary.approved_count}`);
  lines.push(`- High severity: ${result.summary.high_severity_count}`);
  lines.push(`- Medium severity: ${result.summary.medium_severity_count}`);
  lines.push(`- Low severity: ${result.summary.low_severity_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function inferIssueType(fact) {
  if (fact.fact_type === "approval") return "corporate_approval";
  if (fact.fact_type === "amount") return "monetary_exposure";
  if (fact.fact_type === "date" || fact.fact_type === "procedural_event") return "deadline_or_chronology";
  if (fact.fact_type === "obligation") return "contract_obligation";
  if (fact.fact_type === "risk_signal" || fact.fact_type === "missing_document") return "risk_signal";
  return "general_review";
}

function inferSeverity(fact, issueType) {
  if (issueType === "risk_signal") return "high";
  if (issueType === "monetary_exposure" || issueType === "corporate_approval" || issueType === "contract_obligation") return "medium";
  if (fact.classification === "P4_HIGHLY_RESTRICTED") return "high";
  return "low";
}

function severityScore(severity) {
  if (severity === "critical") return 0.95;
  if (severity === "high") return 0.78;
  if (severity === "medium") return 0.55;
  return 0.28;
}

function buildIssueTitle(fact, issueType) {
  const label = issueType.replace(/_/g, " ");
  const statement = String(fact.statement ?? "").replace(/\s+/g, " ").trim();
  const clipped = statement.length > 90 ? `${statement.slice(0, 89)}...` : statement;
  return `${label}: ${clipped || fact.fact_id}`;
}

function legalRuleIdForIssueType(issueType) {
  return `legal-rule.${slugify(issueType)}`;
}

function ruleCategoryForIssueType(issueType) {
  if (issueType === "corporate_approval") return "corporate_governance";
  if (issueType === "monetary_exposure") return "materiality_and_disclosure";
  if (issueType === "deadline_or_chronology") return "deadline_and_timeline";
  if (issueType === "contract_obligation") return "contract_obligation_review";
  if (issueType === "risk_signal") return "risk_escalation";
  return "general_legal_review";
}

function ruleLabelForIssueType(issueType) {
  if (issueType === "corporate_approval") return "Review corporate approval authority and board/shareholder records.";
  if (issueType === "monetary_exposure") return "Review monetary exposure, thresholds, and supporting evidence.";
  if (issueType === "deadline_or_chronology") return "Review timeline, deadline, and chronology impact.";
  if (issueType === "contract_obligation") return "Review contractual obligation, covenant, and performance status.";
  if (issueType === "risk_signal") return "Review red flag, missing document, breach, or escalation signal.";
  return "Review general legal significance and source support.";
}

function riskBasisForIssue(issue) {
  return `${issue.issue_type} issue candidate assessed as ${issue.risk_severity}; attorney review required before legal conclusion or client-facing output.`;
}

function normalizeInputs(options) {
  return {
    fact_claim_store_path: path.resolve(options.factClaimStorePath ?? DEFAULT_ISSUE_GRAPH_STORE_INPUTS.factClaimStorePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_ISSUE_GRAPH_STORE_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_ISSUE_GRAPH_STORE_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--fact-claim-store") parsed.factClaimStorePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/issue-graph-store.mjs [options]

Options:
  --fact-claim-store <path>            fact-claim-store.json path.
  --out-dir <path>                     Output directory.
  --run-at <iso>                       Deterministic generated_at timestamp.
  --check                              Exit non-zero when validation fails.
  --no-write                           Build without writing artifacts.
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

function serializableStore(result) {
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
