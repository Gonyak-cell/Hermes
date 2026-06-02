import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildZenddBoundary } from "./zendd-boundary.mjs";
import { buildZenddClientOutputGate } from "./zendd-client-output-gate.mjs";
import { buildZenddCommandEvidence } from "./zendd-command-evidence.mjs";
import { buildZenddDevHarness } from "./zendd-dev-harness.mjs";
import { buildZenddFactIssueBridge } from "./zendd-fact-issue-bridge.mjs";
import { buildZenddIntegrationSetup, DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddReviewReceipts } from "./zendd-review-receipts.mjs";
import { buildZenddSourceContract } from "./zendd-source-contract.mjs";

export const DEFAULT_ZENDD_OPERATOR_SURFACE_OUT_DIR = "artifacts/zendd-operator-surface/latest";
export const DEFAULT_ZENDD_OPERATOR_SURFACE_INPUTS = {
  schemaPath: "schemas/zendd-operator-surface.schema.json",
  phaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  packagePath: "package.json",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-operator-surface";
const CLIENT_OUTPUT_COMMAND_NAME = "project:zendd-client-output-gate";
const SCHEMA_VERSION = "zendd-operator-surface.v1";
const CAPABILITY_ID = "project.zendd.operator_surface";
const PHASE_RANGE = "P661-P680";
const PHASE_SLOT = "P661";
const PREVIOUS_PHASE_SLOT = "P660";
const NEXT_PHASE_SLOT = "P681";
const READY_STATUS = "ready_for_release_recovery_bridge";
const FILTER_READY_STATUS = "ready_for_zendd_operator_filtering";
const DASHBOARD_READY_STATUS = "ready_for_zendd_operator_dashboard_projection";
const API_READY_STATUS = "ready_for_zendd_operator_api_projection";
const AUDIT_READY_STATUS = "ready_for_zendd_operator_audit_projection";
const CLOSEOUT_READY_STATUS = "ready_for_zendd_operator_surface_closeout";
const CLAIM_ROUTE = "/api/project-zendd/operator-claims";
const FILTER_ROUTE = "/api/project-zendd/operator-filters";
const MISSING_ROUTE = "/api/project-zendd/operator-missing-inputs";
const NEXT_ACTION_ROUTE = "/api/project-zendd/operator-next-actions";
const GATE_ROUTE = "/api/project-zendd/operator-gates";

export async function runZenddOperatorSurface(options = {}) {
  const result = await buildZenddOperatorSurface(options);
  if (options.write !== false) await writeZenddOperatorSurface(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd operator surface failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddOperatorSurface(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_OPERATOR_SURFACE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const phaseLedger = await readTextSource(inputs.phase_ledger_path);
  const sourceOptions = {
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    phaseLedgerPath: inputs.phase_ledger_path,
    write: false,
  };
  const snapshots = {
    setup: await buildZenddIntegrationSetup(sourceOptions),
    boundary: await buildZenddBoundary(sourceOptions),
    devHarness: await buildZenddDevHarness(sourceOptions),
    commandEvidence: await buildZenddCommandEvidence(sourceOptions),
    sourceContract: await buildZenddSourceContract(sourceOptions),
    factIssue: await buildZenddFactIssueBridge(sourceOptions),
    reviewReceipts: await buildZenddReviewReceipts(sourceOptions),
    clientOutput: await buildZenddClientOutputGate(sourceOptions),
  };
  const operatorClaimRows = buildOperatorClaimRows(snapshots);
  const filterRows = buildFilterRows(operatorClaimRows);
  const missingRows = buildMissingInputRows(operatorClaimRows);
  const nextActionRows = buildNextActionRows(operatorClaimRows);
  const dashboardRows = buildDashboardRows({ operatorClaimRows, filterRows, missingRows, nextActionRows, snapshots });
  const apiRows = buildApiProjectionRows({ filterRows, missingRows, nextActionRows });
  const auditRows = buildAuditRows({ operatorClaimRows, snapshots });
  const closeoutRows = buildCloseoutRows({ operatorClaimRows, filterRows, dashboardRows, apiRows, missingRows, nextActionRows, auditRows });
  const boundary = buildBoundary({ generatedAt, writeRequested: options.write !== false, operatorClaimRows, filterRows, dashboardRows, apiRows, missingRows, nextActionRows, auditRows, closeoutRows, snapshots });
  const anchor = buildAnchor({ packageJson, phaseLedger, snapshots, operatorClaimRows, filterRows, dashboardRows, apiRows, missingRows, nextActionRows, auditRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, phaseLedger, snapshots, operatorClaimRows, filterRows, dashboardRows, apiRows, missingRows, nextActionRows, auditRows, closeoutRows, boundary });
  const validationItems = buildValidationItems({ gateRows, operatorClaimRows, filterRows, dashboardRows, apiRows, missingRows, nextActionRows, auditRows, closeoutRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ snapshots, operatorClaimRows, filterRows, dashboardRows, apiRows, missingRows, nextActionRows, auditRows, closeoutRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_operator_surface_id: `zendd-operator-surface.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operator_surface_anchor: anchor,
    source_tranche_summaries: buildSourceTrancheSummaries(snapshots),
    zendd_operator_claim_rows: operatorClaimRows,
    zendd_operator_filter_rows: filterRows,
    zendd_operator_dashboard_projection_rows: dashboardRows,
    zendd_operator_api_projection_rows: apiRows,
    zendd_operator_missing_input_rows: missingRows,
    zendd_operator_next_action_rows: nextActionRows,
    zendd_operator_audit_rows: auditRows,
    zendd_operator_closeout_rows: closeoutRows,
    zendd_operator_gate_rows: gateRows,
    zendd_operator_surface_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_operator_surface")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ snapshots, operatorClaimRows, filterRows, dashboardRows, apiRows, missingRows, nextActionRows, auditRows, closeoutRows, boundary, validation: result.validation });
  result.summary.zendd_operator_surface_id = result.zendd_operator_surface_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddOperatorSurface(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-operator-surface.json"), serializableResult(result));
  await writeJson(path.join(outDir, "operator-claim-rows.json"), collectionEnvelope("zendd-operator-claim-rows.v1", "zendd_operator_claim_rows", result.zendd_operator_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-filter-rows.json"), collectionEnvelope("zendd-operator-filter-rows.v1", "zendd_operator_filter_rows", result.zendd_operator_filter_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-dashboard-projection-rows.json"), collectionEnvelope("zendd-operator-dashboard-projection-rows.v1", "zendd_operator_dashboard_projection_rows", result.zendd_operator_dashboard_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-api-projection-rows.json"), collectionEnvelope("zendd-operator-api-projection-rows.v1", "zendd_operator_api_projection_rows", result.zendd_operator_api_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-missing-input-rows.json"), collectionEnvelope("zendd-operator-missing-input-rows.v1", "zendd_operator_missing_input_rows", result.zendd_operator_missing_input_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-next-action-rows.json"), collectionEnvelope("zendd-operator-next-action-rows.v1", "zendd_operator_next_action_rows", result.zendd_operator_next_action_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-audit-rows.json"), collectionEnvelope("zendd-operator-audit-rows.v1", "zendd_operator_audit_rows", result.zendd_operator_audit_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-closeout-rows.json"), collectionEnvelope("zendd-operator-closeout-rows.v1", "zendd_operator_closeout_rows", result.zendd_operator_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-gate-rows.json"), collectionEnvelope("zendd-operator-gate-rows.v1", "zendd_operator_gate_rows", result.zendd_operator_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-surface-boundary.json"), result.zendd_operator_surface_boundary);
  await writeJson(path.join(outDir, "source-tranche-summaries.json"), collectionEnvelope("zendd-source-tranche-summaries.v1", "source_tranche_summaries", result.source_tranche_summaries, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-operator-surface-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddOperatorSurfaceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddOperatorSurface(args);
    console.log(`Zendd operator surface ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_operator_surface_status}`);
    console.log(`Zendd path: ${result.summary.zendd_project_root}`);
    console.log(`Operator claims: ${result.summary.operator_claim_row_count}`);
    console.log(`Blocked claims: ${result.summary.blocked_operator_claim_count}`);
    console.log(`Missing inputs: ${result.summary.missing_input_row_count}`);
    console.log(`Next actions: ${result.summary.next_action_row_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildOperatorClaimRows(snapshots) {
  const sources = [
    sourceRows("P521-P525", "dirty_tree_safety_inventory_rows", "dirty_tree", snapshots.setup.dirty_tree_safety_inventory_rows),
    sourceRows("P521-P525", "feature_parity_matrix_rows", "feature_parity", snapshots.setup.feature_parity_matrix_rows),
    sourceRows("P521-P525", "zendd_integration_gate_rows", "gate", snapshots.setup.zendd_integration_gate_rows),
    sourceRows("P526-P540", "observation_policy_rows", "observation", snapshots.boundary.observation_policy_rows),
    sourceRows("P526-P540", "zendd_command_catalog_rows", "command_catalog", snapshots.boundary.zendd_command_catalog_rows),
    sourceRows("P526-P540", "prohibited_operation_rows", "prohibited_operation", snapshots.boundary.prohibited_operation_rows),
    sourceRows("P526-P540", "blocked_capability_ledger_rows", "blocked_capability", snapshots.boundary.blocked_capability_ledger_rows),
    sourceRows("P541-P560", "intake_mapping_rows", "intake", snapshots.devHarness.intake_mapping_rows),
    sourceRows("P541-P560", "lane_policy_rows", "lane_policy", snapshots.devHarness.lane_policy_rows),
    sourceRows("P541-P560", "test_command_candidate_rows", "command_candidate", snapshots.devHarness.test_command_candidate_rows),
    sourceRows("P541-P560", "protected_route_rows", "protected_route", snapshots.devHarness.protected_route_rows, { protected: true }),
    sourceRows("P541-P560", "operator_status_rows", "operator_status", snapshots.devHarness.operator_status_rows),
    sourceRows("P541-P560", "hermes_function_coverage_rows", "function_coverage", snapshots.devHarness.hermes_function_coverage_rows),
    sourceRows("P561-P580", "command_evidence_rows", "command_evidence", snapshots.commandEvidence.command_evidence_rows),
    sourceRows("P561-P580", "command_review_binding_rows", "review_binding", snapshots.commandEvidence.command_review_binding_rows),
    sourceRows("P561-P580", "protected_command_rows", "protected_command", snapshots.commandEvidence.protected_command_rows, { protected: true }),
    sourceRows("P561-P580", "command_evidence_freeze_rows", "freeze", snapshots.commandEvidence.command_evidence_freeze_rows),
    sourceRows("P581-P600", "gate_comparison_rows", "gate_comparison", snapshots.sourceContract.gate_comparison_rows),
    sourceRows("P581-P600", "vdr_ldd_source_contract_rows", "source_contract", snapshots.sourceContract.vdr_ldd_source_contract_rows, { protected: true }),
    sourceRows("P581-P600", "cross_gate_improvement_rows", "improvement", snapshots.sourceContract.cross_gate_improvement_rows),
    sourceRows("P581-P600", "source_review_binding_rows", "review_binding", snapshots.sourceContract.source_review_binding_rows),
    sourceRows("P581-P600", "source_freeze_rows", "freeze", snapshots.sourceContract.source_freeze_rows),
    sourceRows("P601-P620", "fact_claim_rows", "fact_claim", snapshots.factIssue.fact_claim_rows, { protected: true }),
    sourceRows("P601-P620", "issue_bridge_rows", "issue_bridge", snapshots.factIssue.issue_bridge_rows, { protected: true }),
    sourceRows("P601-P620", "conflict_fixture_rows", "fail_closed_fixture", snapshots.factIssue.conflict_fixture_rows),
    sourceRows("P601-P620", "fact_issue_review_binding_rows", "review_binding", snapshots.factIssue.fact_issue_review_binding_rows),
    sourceRows("P601-P620", "fact_issue_freeze_rows", "freeze", snapshots.factIssue.fact_issue_freeze_rows),
    sourceRows("P621-P640", "receipt_template_rows", "receipt_template", snapshots.reviewReceipts.receipt_template_rows, { protected: true }),
    sourceRows("P621-P640", "receipt_queue_rows", "receipt_queue", snapshots.reviewReceipts.receipt_queue_rows, { protected: true }),
    sourceRows("P621-P640", "receipt_validation_rule_rows", "receipt_rule", snapshots.reviewReceipts.receipt_validation_rule_rows),
    sourceRows("P621-P640", "receipt_workspace_rows", "receipt_workspace", snapshots.reviewReceipts.receipt_workspace_rows),
    sourceRows("P621-P640", "receipt_approval_plan_rows", "receipt_approval_plan", snapshots.reviewReceipts.receipt_approval_plan_rows),
    sourceRows("P621-P640", "receipt_closeout_rows", "receipt_closeout", snapshots.reviewReceipts.receipt_closeout_rows),
    sourceRows("P621-P640", "receipt_freeze_rows", "freeze", snapshots.reviewReceipts.receipt_freeze_rows),
    sourceRows("P641-P660", "client_output_claim_rows", "client_output", snapshots.clientOutput.client_output_claim_rows, { protected: true }),
    sourceRows("P641-P660", "korean_language_quality_rows", "language_quality", snapshots.clientOutput.korean_language_quality_rows, { protected: true }),
    sourceRows("P641-P660", "citation_gate_rows", "citation_gate", snapshots.clientOutput.citation_gate_rows, { protected: true }),
    sourceRows("P641-P660", "client_exposure_control_rows", "exposure_control", snapshots.clientOutput.client_exposure_control_rows, { protected: true }),
    sourceRows("P641-P660", "client_receipt_binding_rows", "receipt_binding", snapshots.clientOutput.client_receipt_binding_rows, { protected: true }),
    sourceRows("P641-P660", "client_output_freeze_rows", "freeze", snapshots.clientOutput.client_output_freeze_rows, { protected: true }),
  ].flat();
  return sources.map((item, index) => normalizeOperatorRow(item.row, item.meta, index));
}

function sourceRows(sourceTranche, sourceCollection, claimType, rows, meta = {}) {
  return (rows ?? []).map((row) => ({ row, meta: { sourceTranche, sourceCollection, claimType, ...meta } }));
}

function normalizeOperatorRow(row, meta, index) {
  const sourceRowId = row.row_id ?? row.gate_id ?? row.operation_id ?? row.observation_id ?? row.feature_id ?? row.route_id ?? row.status_id ?? row.rule_id ?? `row.${index + 1}`;
  const verdictInfo = normalizeVerdict(row);
  const blockReason = row.block_reason ?? (verdictInfo.family === "blocked" ? row.message ?? "documented_block" : null);
  const nextAllowedAction = row.next_allowed_action ?? (verdictInfo.family === "blocked" ? "inspect source row and document next allowed action" : "continue_to_next_operator_surface_gate");
  const evidenceRefs = collectEvidenceRefs(row);
  const reviewerRef = row.reviewer_ref ?? row.reviewer_ref_or_gate_ref ?? (row.required_reviewer_role ? `role.${row.required_reviewer_role}` : null);
  const hardGateRef = row.hard_gate_ref ?? row.hermes_resource_gate_ref ?? row.zendd_vdr_ldd_gate_ref ?? (row.gate_id ? `gate.${row.gate_id}` : null);
  const humanReceiptRef = row.human_receipt_ref ?? row.receipt_template_ref ?? row.human_receipt_ref_when_protected ?? row.human_receipt_ref_if_protected ?? null;
  const protectedClaim = Boolean(meta.protected || row.protected || row.protected_output || row.human_receipt_ref_required || row.pass_without_receipt_allowed === false || row.protected_pass_allowed_without_receipt === false || row.receipt_payload_present === false);
  const missingEvidence = deriveMissingEvidence(row, meta, verdictInfo.family, evidenceRefs);
  const missingReviewerOrGate = deriveMissingReviewerOrGate(row, verdictInfo.family, reviewerRef, hardGateRef);
  const missingHumanReceipt = deriveMissingHumanReceipt(row, verdictInfo.family, protectedClaim);
  const hardGateResult = deriveHardGateResult(row, verdictInfo.family, hardGateRef, missingReviewerOrGate);
  return {
    schema_version: "zendd-operator-claim-row.v1",
    phase_range: PHASE_RANGE,
    phase_slot: "P662-P666",
    row_id: `zendd-operator-claim.row.${String(index + 1).padStart(4, "0")}`,
    project_id: "project.zendd",
    source_tranche: meta.sourceTranche,
    source_collection: meta.sourceCollection,
    source_row_id: String(sourceRowId),
    claim_type: meta.claimType,
    claim_id: explicitClaimId(row, meta, sourceRowId),
    claim_label: row.output_description ?? row.source_description ?? row.description ?? row.message ?? row.script_name ?? row.operation_id ?? row.feature_id ?? String(sourceRowId),
    current_verdict: verdictInfo.current,
    verdict_family: verdictInfo.family,
    evidence_refs: evidenceRefs,
    reviewer_ref: reviewerRef,
    hard_gate_ref: hardGateRef,
    human_receipt_ref: humanReceiptRef,
    missing_evidence: missingEvidence,
    missing_reviewer_or_gate: missingReviewerOrGate,
    missing_human_receipt: missingHumanReceipt,
    hard_gate_result: hardGateResult,
    block_reason: blockReason,
    responsible_owner: row.responsible_owner ?? row.standard_owner ?? "integration_operator",
    next_allowed_action: nextAllowedAction,
    protected_claim: protectedClaim,
    raw_material_copy_allowed_in_hermes: row.raw_material_copy_allowed_in_hermes ?? row.raw_vdr_copy_allowed ?? false,
    command_execution_allowed_now: row.execution_allowed_now ?? row.execution_allowed_in_boundary_phase ?? false,
    receipt_payload_present: row.receipt_payload_present ?? false,
    read_only: true,
    operator_surface_projection_only: true,
  };
}

function explicitClaimId(row, meta, sourceRowId) {
  if (row.claim_id) return row.claim_id;
  if (row.issue_ref) return `claim.${row.issue_ref}`;
  if (row.capability_id) return `claim.zendd.capability.${normalizeKey(row.capability_id)}`;
  if (row.operation_id) return `claim.zendd.operation.${normalizeKey(row.operation_id)}`;
  if (row.feature_id) return `claim.zendd.feature.${normalizeKey(row.feature_id)}`;
  if (row.script_name) return `claim.zendd.command_catalog.${normalizeKey(`${row.command_scope ?? "root"}.${row.script_name}`)}`;
  return `claim.zendd.${normalizeKey(meta.claimType)}.${normalizeKey(sourceRowId)}`;
}

function normalizeVerdict(row) {
  const raw = row.current_verdict ?? row.verdict ?? row.gate_status ?? row.filter_status ?? row.registration_status ?? row.closeout_status ?? row.audit_status ?? null;
  const text = String(raw ?? "").toLowerCase();
  if (row.gate_status === "pass" || text === "pass") return { current: "pass", family: "pass" };
  if (/blocked|candidate_not_executed|pending|missing|not_allowed|disabled|defer|not_executed/.test(text)) return { current: "blocked", family: "blocked" };
  if (row.path_classification && row.path_classification !== "clean_worktree") return { current: "blocked", family: "blocked" };
  if (row.path_classification === "clean_worktree") return { current: "pass", family: "pass" };
  if (row.allowed === false) return { current: "blocked", family: "blocked" };
  if (row.execution_allowed_now === false || row.execution_allowed_in_boundary_phase === false) return { current: "blocked", family: "blocked" };
  if (raw) return { current: String(raw), family: text.includes("ready") || text.includes("documented") ? "documented" : "pass" };
  return { current: "documented", family: "documented" };
}

function collectEvidenceRefs(row) {
  const fields = [
    "evidence_ref",
    "command_evidence_ref",
    "quality_evidence_ref",
    "redacted_summary_ref",
    "source_trace_ref",
    "citation_ref",
    "expected_artifact_ref",
  ];
  return fields.map((field) => row[field]).filter((value) => typeof value === "string" && value.length > 0);
}

function deriveMissingEvidence(row, meta, verdictFamily, evidenceRefs) {
  const missing = new Set();
  const rowMissing = Array.isArray(row.missing_evidence) ? row.missing_evidence : row.missing_evidence ? [row.missing_evidence] : [];
  for (const item of rowMissing) missing.add(item);
  const reason = String(row.block_reason ?? row.current_verdict ?? row.verdict ?? "").toLowerCase();
  if (row.evidence_ref === null) missing.add("evidence_ref");
  if (row.evidence_capture_status === "pending_capture" || row.command_evidence_ref) missing.add("captured_command_result");
  if (row.command_evidence_ref && verdictFamily === "blocked") missing.add("redaction_report_ref");
  if (row.quality_evidence_ref && verdictFamily === "blocked") missing.add("quality_evidence_ref");
  if (row.citation_required && verdictFamily === "blocked") missing.add("citation_source_trace_review");
  if (reason.includes("not_captured") || reason.includes("missing") || reason.includes("not_executed")) missing.add("evidence_ref");
  if (reason.includes("quality")) missing.add("quality_gate_evidence");
  if (reason.includes("source")) missing.add("source_gate_evidence");
  if (reason.includes("review")) missing.add("review_evidence_ref");
  if (reason.includes("receipt")) missing.add("validated_human_receipt");
  if (meta.claimType === "dirty_tree" && row.path_classification !== "clean_worktree") missing.add("dirty_tree_review");
  if (verdictFamily === "blocked" && evidenceRefs.length === 0 && missing.size === 0) missing.add("evidence_ref");
  return [...missing].sort();
}

function deriveMissingReviewerOrGate(row, verdictFamily, reviewerRef, hardGateRef) {
  const reason = String(row.block_reason ?? row.current_verdict ?? row.verdict ?? "").toLowerCase();
  if (reason.includes("review") || reason.includes("reviewer")) return true;
  if (row.reviewer_required_for_pass || row.pass_without_review_allowed === false) return !(reviewerRef || hardGateRef);
  return verdictFamily === "blocked" && row.hard_gate_ref === null && row.reviewer_ref === null;
}

function deriveMissingHumanReceipt(row, verdictFamily, protectedClaim) {
  const reason = String(row.block_reason ?? row.current_verdict ?? row.verdict ?? "").toLowerCase();
  if (reason.includes("receipt")) return true;
  if (!protectedClaim) return false;
  if (row.receipt_payload_present === true) return false;
  return verdictFamily === "blocked" || row.human_receipt_ref_required || row.pass_without_receipt_allowed === false || row.protected_pass_allowed_without_receipt === false;
}

function deriveHardGateResult(row, verdictFamily, hardGateRef, missingReviewerOrGate) {
  if (row.gate_status === "pass") return "pass";
  if (row.gate_status === "blocked") return "blocked";
  if (verdictFamily === "pass") return "pass";
  if (hardGateRef && verdictFamily === "blocked") return "blocked_pending_gate";
  if (missingReviewerOrGate) return "missing_reviewer_or_gate";
  return "not_required";
}

function buildFilterRows(operatorClaimRows) {
  const definitions = [
    filterDefinition("all_claims", {}, 1, "All Zendd integration operator rows are queryable."),
    filterDefinition("blocked_claims", { verdict_family: "blocked" }, 1, "Documented BLOCK rows are queryable."),
    filterDefinition("missing_evidence", { missing_evidence: true }, 1, "Rows with missing evidence are queryable."),
    filterDefinition("missing_reviewer_or_gate", { missing_reviewer_or_gate: true }, 1, "Rows with missing reviewer or hard gate are queryable."),
    filterDefinition("missing_human_receipt", { missing_human_receipt: true }, 1, "Rows with missing human receipt are queryable."),
    filterDefinition("protected_claims", { protected_claim: true }, 1, "Protected Zendd rows are queryable."),
    filterDefinition("client_output_blocks", { source_tranche: "P641-P660", verdict_family: "blocked" }, 1, "Client-output blocks are queryable."),
    filterDefinition("source_contract_blocks", { source_collection: "vdr_ldd_source_contract_rows", verdict_family: "blocked" }, 1, "VDR/LDD source contract blocks are queryable."),
    filterDefinition("command_execution_disabled", { command_execution_allowed_now: false }, 1, "Rows that keep command execution disabled are queryable."),
    filterDefinition("raw_material_copy_blocked", { raw_material_copy_allowed_in_hermes: false }, 1, "Rows that keep raw material out of Hermes are queryable."),
    filterDefinition("next_action_queue", { next_action_required: true }, 1, "Rows with next allowed actions are queryable."),
  ];
  return definitions.map((definition, index) => {
    const actualRows = operatorClaimRows.filter((row) => operatorRowMatches(row, definition.filters));
    const row = {
      schema_version: "zendd-operator-filter-row.v1",
      phase_range: PHASE_RANGE,
      phase_slot: "P667-P668",
      row_id: `zendd-operator-filter.${definition.row_key}`,
      row_key: definition.row_key,
      route_path: FILTER_ROUTE,
      query_path: buildQueryPath(CLAIM_ROUTE, definition.filters),
      filters: definition.filters,
      expected_min_count: definition.expectedMinCount,
      actual_count: actualRows.length,
      filter_status: actualRows.length >= definition.expectedMinCount ? FILTER_READY_STATUS : "blocked",
      description: definition.description,
      reads_operator_claim_rows_directly: true,
      source_collection: "zendd_operator_claim_rows",
      claim_verdict_mutation_performed: false,
      pass_promotion_performed: false,
      receipt_validation_performed: false,
      read_only: true,
    };
    return withOrdinalAndHash(row, index, "operator_filter_row_hash");
  });
}

function buildDashboardRows({ operatorClaimRows, filterRows, missingRows, nextActionRows, snapshots }) {
  const blockedRows = operatorClaimRows.filter((row) => row.verdict_family === "blocked");
  const rows = [
    dashboardDefinition("claim_status_summary", "Expose claim, verdict, block reason, and next action counts.", {
      claim_count: operatorClaimRows.length,
      blocked_count: blockedRows.length,
      pass_count: operatorClaimRows.filter((row) => row.verdict_family === "pass").length,
    }),
    dashboardDefinition("missing_input_queue", "Expose missing evidence, reviewer/gate, and receipt queues.", {
      missing_evidence_count: missingRows.filter((row) => row.missing_input_type === "evidence").length,
      missing_reviewer_or_gate_count: missingRows.filter((row) => row.missing_input_type === "reviewer_or_gate").length,
      missing_human_receipt_count: missingRows.filter((row) => row.missing_input_type === "human_receipt").length,
    }),
    dashboardDefinition("client_output_blocks", "Expose protected client-output language, citation, exposure, and receipt blocks.", {
      client_output_claim_count: snapshots.clientOutput.summary.client_output_claim_row_count,
      korean_quality_row_count: snapshots.clientOutput.summary.korean_language_quality_row_count,
      protected_client_output_pass_allowed: false,
    }),
    dashboardDefinition("source_command_boundary", "Expose command execution, raw material, source, and hard-gate boundaries.", {
      command_execution_disabled_count: operatorClaimRows.filter((row) => row.command_execution_allowed_now === false).length,
      raw_material_copy_blocked_count: operatorClaimRows.filter((row) => row.raw_material_copy_allowed_in_hermes === false).length,
      source_contract_row_count: snapshots.sourceContract.summary.source_contract_row_count,
    }),
    dashboardDefinition("next_action_queue", "Expose operator next allowed action rows for every documented BLOCK.", {
      next_action_count: nextActionRows.length,
      filter_ready_count: filterRows.filter((row) => row.filter_status === FILTER_READY_STATUS).length,
    }),
  ];
  return rows.map((definition, index) => {
    const row = {
      schema_version: "zendd-operator-dashboard-projection-row.v1",
      phase_range: PHASE_RANGE,
      phase_slot: "P669-P672",
      row_id: `zendd-operator-dashboard.${definition.row_key}`,
      row_key: definition.row_key,
      dashboard_projection_status: DASHBOARD_READY_STATUS,
      description: definition.description,
      visible_fields: ["claim", "current_verdict", "missing_evidence", "missing_reviewer_or_receipt", "hard_gate_result", "block_reason", "next_allowed_action"],
      metrics: definition.metrics,
      source_collection: "zendd_operator_claim_rows",
      live_dashboard_mutation_performed: false,
      claim_verdict_mutation_performed: false,
      receipt_validation_performed: false,
      pass_promotion_performed: false,
      read_only: true,
    };
    return withOrdinalAndHash(row, index, "operator_dashboard_projection_row_hash");
  });
}

function buildApiProjectionRows({ filterRows, missingRows, nextActionRows }) {
  const routes = [
    apiRouteDefinition("operator_claims", CLAIM_ROUTE, "zendd_operator_claim_rows", filterRows.length),
    apiRouteDefinition("operator_filters", FILTER_ROUTE, "zendd_operator_filter_rows", filterRows.length),
    apiRouteDefinition("operator_missing_inputs", MISSING_ROUTE, "zendd_operator_missing_input_rows", missingRows.length),
    apiRouteDefinition("operator_next_actions", NEXT_ACTION_ROUTE, "zendd_operator_next_action_rows", nextActionRows.length),
    apiRouteDefinition("operator_gates", GATE_ROUTE, "zendd_operator_gate_rows", 0),
  ];
  return routes.map((definition, index) => {
    const row = {
      schema_version: "zendd-operator-api-projection-row.v1",
      phase_range: PHASE_RANGE,
      phase_slot: "P673-P675",
      row_id: `zendd-operator-api.${definition.row_key}`,
      row_key: definition.row_key,
      route_path: definition.routePath,
      collection: definition.collection,
      api_projection_status: API_READY_STATUS,
      projection_declared: true,
      live_route_registered: false,
      expected_projection_row_count: definition.expectedProjectionRowCount,
      supported_filter_keys: ["source_tranche", "source_collection", "claim_type", "verdict_family", "missing_evidence", "missing_reviewer_or_gate", "missing_human_receipt", "protected_claim"],
      server_start_required: false,
      mutating_method_allowed: false,
      route_mutation_performed: false,
      claim_verdict_mutation_performed: false,
      pass_promotion_performed: false,
      protected_action_executed: false,
      read_only: true,
    };
    return withOrdinalAndHash(row, index, "operator_api_projection_row_hash");
  });
}

function buildMissingInputRows(operatorClaimRows) {
  const rows = [];
  for (const row of operatorClaimRows) {
    if (row.missing_evidence.length) {
      rows.push(missingInputRow(row, "evidence", row.missing_evidence, "collect or bind the missing evidence refs before PASS"));
    }
    if (row.missing_reviewer_or_gate) {
      rows.push(missingInputRow(row, "reviewer_or_gate", ["reviewer_ref_or_hard_gate_ref"], "bind reviewer or hard gate before PASS"));
    }
    if (row.missing_human_receipt) {
      rows.push(missingInputRow(row, "human_receipt", ["validated_human_receipt"], "collect validated human receipt before protected PASS"));
    }
  }
  return rows.map((row, index) => withOrdinalAndHash({
    ...row,
    row_id: `zendd-operator-missing-input.row.${String(index + 1).padStart(4, "0")}`,
  }, index, "operator_missing_input_row_hash"));
}

function missingInputRow(row, missingInputType, missingFields, fallbackNextAction) {
  return {
    schema_version: "zendd-operator-missing-input-row.v1",
    phase_range: PHASE_RANGE,
    phase_slot: "P676-P677",
    project_id: "project.zendd",
    claim_id: row.claim_id,
    source_tranche: row.source_tranche,
    source_collection: row.source_collection,
    current_verdict: row.current_verdict,
    missing_input_type: missingInputType,
    missing_fields: missingFields,
    block_reason: row.block_reason ?? `${missingInputType}_missing`,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action ?? fallbackNextAction,
    read_only: true,
  };
}

function buildNextActionRows(operatorClaimRows) {
  return operatorClaimRows
    .filter((row) => row.verdict_family === "blocked" && row.next_allowed_action)
    .map((row, index) => withOrdinalAndHash({
      schema_version: "zendd-operator-next-action-row.v1",
      phase_range: PHASE_RANGE,
      phase_slot: "P678",
      row_id: `zendd-operator-next-action.row.${String(index + 1).padStart(4, "0")}`,
      project_id: "project.zendd",
      claim_id: row.claim_id,
      source_tranche: row.source_tranche,
      source_collection: row.source_collection,
      current_verdict: row.current_verdict,
      block_reason: row.block_reason,
      responsible_owner: row.responsible_owner,
      next_allowed_action: row.next_allowed_action,
      action_execution_allowed_now: false,
      protected_action_executed: false,
      read_only: true,
    }, index, "operator_next_action_row_hash"));
}

function buildAuditRows({ operatorClaimRows, snapshots }) {
  const blockedRows = operatorClaimRows.filter((row) => row.verdict_family === "blocked");
  const protectedPassRows = operatorClaimRows.filter((row) => row.protected_claim && row.verdict_family === "pass");
  const rows = [
    auditDefinition("unsupported_complete_verdicts_absent", "No complete/ready/done/approved wording is treated as PASS.", operatorClaimRows.filter((row) => /complete|ready|done|approved|governance complete/i.test(row.current_verdict) && row.verdict_family === "pass").length, 0),
    auditDefinition("blocked_rows_have_reason_owner_next_action", "Every documented BLOCK exposes block reason, owner, and next allowed action.", blockedRows.filter((row) => !row.block_reason || !row.responsible_owner || !row.next_allowed_action).length, 0),
    auditDefinition("protected_pass_without_receipt_absent", "Protected rows cannot PASS without receipt payload.", protectedPassRows.filter((row) => !row.receipt_payload_present).length, 0),
    auditDefinition("operator_display_fields_present", "Operator rows expose claim, verdict, missing inputs, hard gate, block reason, and next action fields.", operatorClaimRows.filter((row) => !row.claim_id || !row.current_verdict || !Array.isArray(row.missing_evidence) || row.hard_gate_result === undefined || row.next_allowed_action === undefined).length, 0),
    auditDefinition("unsafe_surface_flags_absent", "Operator surface does not enable Zendd commands, raw material copies, approval, receipt application, or pass promotion.", unsafeSnapshotCount(snapshots), 0),
    auditDefinition("client_output_pass_disabled", "Protected Zendd client-output PASS remains disabled.", snapshots.clientOutput.summary.protected_client_output_pass_allowed ? 1 : 0, 0),
  ];
  return rows.map((definition, index) => {
    const row = {
      schema_version: "zendd-operator-audit-row.v1",
      phase_range: PHASE_RANGE,
      phase_slot: "P679",
      row_id: `zendd-operator-audit.${definition.row_key}`,
      row_key: definition.row_key,
      description: definition.description,
      audit_status: definition.actualCount === definition.expectedCount ? AUDIT_READY_STATUS : "blocked",
      actual_count: definition.actualCount,
      expected_count: definition.expectedCount,
      claim_verdict_mutation_performed: false,
      pass_promotion_performed: false,
      receipt_validation_performed: false,
      approval_applied: false,
      protected_action_executed: false,
      read_only: true,
    };
    return withOrdinalAndHash(row, index, "operator_audit_row_hash");
  });
}

function buildCloseoutRows({ operatorClaimRows, filterRows, dashboardRows, apiRows, missingRows, nextActionRows, auditRows }) {
  const ready = operatorClaimRows.length > 0
    && filterRows.every((row) => row.filter_status === FILTER_READY_STATUS)
    && dashboardRows.every((row) => row.dashboard_projection_status === DASHBOARD_READY_STATUS)
    && apiRows.every((row) => row.api_projection_status === API_READY_STATUS)
    && auditRows.every((row) => row.audit_status === AUDIT_READY_STATUS)
    && nextActionRows.every((row) => row.block_reason && row.next_allowed_action);
  const row = {
    schema_version: "zendd-operator-closeout-row.v1",
    phase_range: PHASE_RANGE,
    phase_slot: "P680",
    row_id: "zendd-operator-closeout.p680",
    closeout_status: ready ? CLOSEOUT_READY_STATUS : "blocked",
    operator_claim_row_count: operatorClaimRows.length,
    blocked_operator_claim_count: operatorClaimRows.filter((item) => item.verdict_family === "blocked").length,
    missing_input_row_count: missingRows.length,
    next_action_row_count: nextActionRows.length,
    filter_projection_ready: filterRows.every((item) => item.filter_status === FILTER_READY_STATUS),
    dashboard_projection_ready: dashboardRows.every((item) => item.dashboard_projection_status === DASHBOARD_READY_STATUS),
    api_projection_ready: apiRows.every((item) => item.api_projection_status === API_READY_STATUS),
    audit_projection_ready: auditRows.every((item) => item.audit_status === AUDIT_READY_STATUS),
    pass_promoted: false,
    receipt_validated: false,
    receipt_applied: false,
    approval_applied: false,
    zendd_command_executed: false,
    raw_material_copied: false,
    operator_surface_mutation_performed: false,
    protected_action_executed: false,
    next_integration_phase_slot: NEXT_PHASE_SLOT,
    next_allowed_action: "build Zendd release and recovery bridge with rollback targets and receipt gates",
    read_only: true,
  };
  return [withOrdinalAndHash(row, 0, "operator_closeout_row_hash")];
}

function buildBoundary({ generatedAt, writeRequested, operatorClaimRows, filterRows, dashboardRows, apiRows, missingRows, nextActionRows, auditRows, closeoutRows, snapshots }) {
  return {
    schema_version: "zendd-operator-surface-boundary.v1",
    generated_at: generatedAt,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    boundary_status: "enforced",
    read_only: true,
    projection_only: true,
    operator_surface_write_requested: writeRequested,
    source_client_output_gate_status: snapshots.clientOutput.summary.zendd_client_output_gate_status,
    operator_claim_row_count: operatorClaimRows.length,
    blocked_operator_claim_count: operatorClaimRows.filter((row) => row.verdict_family === "blocked").length,
    missing_input_row_count: missingRows.length,
    next_action_row_count: nextActionRows.length,
    filter_row_count: filterRows.length,
    dashboard_projection_row_count: dashboardRows.length,
    api_projection_row_count: apiRows.length,
    audit_row_count: auditRows.length,
    closeout_row_count: closeoutRows.length,
    all_blocked_rows_have_next_action: operatorClaimRows.filter((row) => row.verdict_family === "blocked").every((row) => row.block_reason && row.responsible_owner && row.next_allowed_action),
    operator_fields_visible: operatorClaimRows.every((row) => row.claim_id && row.current_verdict && Array.isArray(row.missing_evidence) && row.hard_gate_result !== undefined && row.next_allowed_action !== undefined),
    live_dashboard_mutation_performed: false,
    live_api_route_registered: false,
    server_started: false,
    route_mutation_performed: false,
    claim_verdict_mutation_performed: false,
    pass_promotion_performed: false,
    receipt_materialized: false,
    receipt_validated: false,
    receipt_applied: false,
    approval_applied: false,
    zendd_command_executed: false,
    zendd_command_execution_allowed_now: false,
    zendd_mutation_allowed: false,
    zendd_code_directory_move_allowed: false,
    raw_vdr_copy_allowed: false,
    raw_client_document_copy_allowed: false,
    raw_material_copied: false,
    secret_values_read: false,
    env_file_read: false,
    protected_action_executed: false,
    protected_pass_without_receipt_allowed: false,
    ready_for_pass_promotion: false,
    human_review_required: true,
  };
}

function buildAnchor({ packageJson, phaseLedger, snapshots, operatorClaimRows, filterRows, dashboardRows, apiRows, missingRows, nextActionRows, auditRows, closeoutRows }) {
  return {
    schema_version: "zendd-operator-surface-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    client_output_command_name: CLIENT_OUTPUT_COMMAND_NAME,
    source_client_output_gate_id: snapshots.clientOutput.zendd_client_output_gate_id,
    source_client_output_gate_status: snapshots.clientOutput.summary.zendd_client_output_gate_status,
    source_review_receipts_status: snapshots.reviewReceipts.summary.zendd_review_receipts_status,
    source_fact_issue_status: snapshots.factIssue.summary.zendd_fact_issue_bridge_status,
    source_source_contract_status: snapshots.sourceContract.summary.zendd_source_contract_status,
    source_command_evidence_status: snapshots.commandEvidence.summary.zendd_command_evidence_status,
    package_json_hash: packageJson.content_hash,
    phase_ledger_hash: phaseLedger.content_hash,
    source_summary_hash: hashValue(buildSourceTrancheSummaries(snapshots)),
    operator_claim_rows_hash: hashRows(operatorClaimRows, ["claim_id", "source_tranche", "current_verdict", "block_reason", "next_allowed_action"]),
    filter_rows_hash: hashRows(filterRows, ["row_key", "actual_count", "filter_status"]),
    dashboard_rows_hash: hashRows(dashboardRows, ["row_key", "dashboard_projection_status"]),
    api_rows_hash: hashRows(apiRows, ["row_key", "route_path", "api_projection_status"]),
    missing_rows_hash: hashRows(missingRows, ["claim_id", "missing_input_type", "next_allowed_action"]),
    next_action_rows_hash: hashRows(nextActionRows, ["claim_id", "block_reason", "next_allowed_action"]),
    audit_rows_hash: hashRows(auditRows, ["row_key", "audit_status", "actual_count"]),
    closeout_rows_hash: hashRows(closeoutRows, ["row_id", "closeout_status", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, phaseLedger, snapshots, operatorClaimRows, filterRows, dashboardRows, apiRows, missingRows, nextActionRows, auditRows, closeoutRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  return [
    gateRow("p661_source_chain_ready", "P661", snapshots.clientOutput.validation.valid && snapshots.clientOutput.summary.zendd_client_output_gate_status === "ready_for_operator_surface_bridge", "P641-P660 client output gate is ready for operator surface.", "repair client output gate before operator projection"),
    gateRow("p662_operator_claim_rows_expose_required_fields", "P662-P666", operatorClaimRows.length > 0 && operatorClaimRows.every((row) => row.claim_id && row.current_verdict && Array.isArray(row.missing_evidence) && row.hard_gate_result !== undefined && row.next_allowed_action !== undefined), "Operator claim rows expose claim, verdict, missing inputs, hard gate, block reason, and next action.", "complete operator claim row normalization"),
    gateRow("p667_filter_rows_ready", "P667-P668", filterRows.length >= 10 && filterRows.every((row) => row.filter_status === FILTER_READY_STATUS), "Operator filters cover blocked, missing evidence, missing receipt, protected, command, source, and client-output queues.", "complete operator filters"),
    gateRow("p669_dashboard_projection_ready", "P669-P672", dashboardRows.length >= 5 && dashboardRows.every((row) => row.dashboard_projection_status === DASHBOARD_READY_STATUS), "Dashboard projection rows expose Zendd claim and missing-input queues.", "complete dashboard projection rows"),
    gateRow("p673_api_projection_ready", "P673-P675", apiRows.length >= 5 && apiRows.every((row) => row.api_projection_status === API_READY_STATUS && row.mutating_method_allowed === false), "API projection rows are read-only and do not require server start.", "complete API projection rows"),
    gateRow("p676_missing_input_rows_ready", "P676-P677", missingRows.length > 0 && missingRows.every((row) => row.missing_fields.length && row.next_allowed_action), "Missing evidence/reviewer/receipt rows are visible.", "complete missing input projection rows"),
    gateRow("p678_next_action_rows_ready", "P678", nextActionRows.length > 0 && nextActionRows.every((row) => row.block_reason && row.responsible_owner && row.next_allowed_action && !row.action_execution_allowed_now), "Blocked rows have next action rows without executing actions.", "complete next action rows"),
    gateRow("p679_audit_projection_ready", "P679", auditRows.length >= 6 && auditRows.every((row) => row.audit_status === AUDIT_READY_STATUS), "Audit rows prove unsupported PASS, protected PASS without receipt, and missing next action remain absent.", "repair operator audit rows"),
    gateRow("p680_closeout_ready", "P680", closeoutRows.length === 1 && closeoutRows.every((row) => row.closeout_status === CLOSEOUT_READY_STATUS && !row.pass_promoted && !row.zendd_command_executed), "Operator surface closes read-only and keeps all blocked rows blocked.", "complete operator closeout"),
    gateRow("boundary_read_only", "P680", boundary.read_only && !boundary.zendd_command_executed && !boundary.raw_material_copied && !boundary.receipt_applied && !boundary.pass_promotion_performed, "Operator boundary remains read-only with no command, raw copy, receipt application, or PASS promotion.", "restore read-only operator boundary"),
    gateRow("package_script_registered", "P680", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("validate_chain_registered", "P680", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`), `${COMMAND_NAME} is included in npm run validate.`, `add ${COMMAND_NAME} to validate chain`),
    gateRow("phase_ledger_acceptance_declared", "P680", phaseLedger.available && phaseLedger.text.includes("P661-P680") && phaseLedger.text.includes(COMMAND_NAME), "P661-P680 phase ledger declares operator surface acceptance.", "record P661-P680 in phase ledger"),
  ];
}

function buildValidationItems({ gateRows, operatorClaimRows, filterRows, dashboardRows, apiRows, missingRows, nextActionRows, auditRows, closeoutRows, boundary }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "operator_surface_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("operator_claim_rows.display_fields", "operator_surface", operatorClaimRows.every((row) => row.claim_id && row.current_verdict && Array.isArray(row.missing_evidence) && row.hard_gate_result !== undefined && row.next_allowed_action !== undefined), "Operator rows expose required display fields"));
  items.push(validationItem("blocked_rows.next_action", "claim_boundary", operatorClaimRows.filter((row) => row.verdict_family === "blocked").every((row) => row.block_reason && row.responsible_owner && row.next_allowed_action), "Blocked rows include reason, owner, and next action"));
  items.push(validationItem("filters.ready", "operator_surface", filterRows.every((row) => row.filter_status === FILTER_READY_STATUS), "Operator filters are ready"));
  items.push(validationItem("dashboard.ready", "operator_surface", dashboardRows.every((row) => row.dashboard_projection_status === DASHBOARD_READY_STATUS), "Dashboard projections are ready"));
  items.push(validationItem("api.read_only", "operator_surface", apiRows.every((row) => row.api_projection_status === API_READY_STATUS && row.mutating_method_allowed === false && row.server_start_required === false), "API projections are read-only"));
  items.push(validationItem("missing_inputs.visible", "operator_surface", missingRows.length > 0 && missingRows.every((row) => row.missing_fields.length && row.next_allowed_action), "Missing inputs are visible"));
  items.push(validationItem("next_actions.not_executed", "operator_surface", nextActionRows.length > 0 && nextActionRows.every((row) => row.action_execution_allowed_now === false && row.protected_action_executed === false), "Next actions are not executed by the surface"));
  items.push(validationItem("audit.ready", "operator_surface", auditRows.every((row) => row.audit_status === AUDIT_READY_STATUS), "Audit rows are ready"));
  items.push(validationItem("closeout.ready", "operator_surface", closeoutRows.every((row) => row.closeout_status === CLOSEOUT_READY_STATUS), "Closeout row is ready"));
  items.push(validationItem("boundary.no_mutation", "operator_boundary", boundary.read_only && !boundary.server_started && !boundary.route_mutation_performed && !boundary.zendd_command_executed && !boundary.raw_material_copied && !boundary.receipt_applied && !boundary.approval_applied && !boundary.pass_promotion_performed, "Operator surface performs no mutation"));
  return items;
}

function buildSummary({ snapshots, operatorClaimRows, filterRows, dashboardRows, apiRows, missingRows, nextActionRows, auditRows, closeoutRows, boundary, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_operator_surface_status: validation.valid ? READY_STATUS : "documented_block_pending_operator_surface",
    zendd_project_root: snapshots.setup.summary.zendd_project_root,
    zendd_git_head_short: snapshots.setup.summary.zendd_git_head_short,
    source_client_output_gate_status: snapshots.clientOutput.summary.zendd_client_output_gate_status,
    operator_claim_row_count: operatorClaimRows.length,
    blocked_operator_claim_count: operatorClaimRows.filter((row) => row.verdict_family === "blocked").length,
    pass_operator_claim_count: operatorClaimRows.filter((row) => row.verdict_family === "pass").length,
    protected_operator_claim_count: operatorClaimRows.filter((row) => row.protected_claim).length,
    missing_input_row_count: missingRows.length,
    next_action_row_count: nextActionRows.length,
    filter_row_count: filterRows.length,
    dashboard_projection_row_count: dashboardRows.length,
    api_projection_row_count: apiRows.length,
    audit_row_count: auditRows.length,
    closeout_row_count: closeoutRows.length,
    live_api_route_registered: boundary.live_api_route_registered,
    zendd_command_executed: boundary.zendd_command_executed,
    raw_material_copied: boundary.raw_material_copied,
    receipt_applied: boundary.receipt_applied,
    pass_promotion_performed: boundary.pass_promotion_performed,
    validation_error_count: validation.errors.length,
  };
}

function buildSourceTrancheSummaries(snapshots) {
  return [
    sourceSummary("P521-P525", "zendd_integration_setup", snapshots.setup.summary.zendd_integration_setup_status, snapshots.setup.validation.valid),
    sourceSummary("P526-P540", "zendd_boundary", snapshots.boundary.summary.zendd_boundary_status, snapshots.boundary.validation.valid),
    sourceSummary("P541-P560", "zendd_dev_harness", snapshots.devHarness.summary.zendd_dev_harness_status, snapshots.devHarness.validation.valid),
    sourceSummary("P561-P580", "zendd_command_evidence", snapshots.commandEvidence.summary.zendd_command_evidence_status, snapshots.commandEvidence.validation.valid),
    sourceSummary("P581-P600", "zendd_source_contract", snapshots.sourceContract.summary.zendd_source_contract_status, snapshots.sourceContract.validation.valid),
    sourceSummary("P601-P620", "zendd_fact_issue_bridge", snapshots.factIssue.summary.zendd_fact_issue_bridge_status, snapshots.factIssue.validation.valid),
    sourceSummary("P621-P640", "zendd_review_receipts", snapshots.reviewReceipts.summary.zendd_review_receipts_status, snapshots.reviewReceipts.validation.valid),
    sourceSummary("P641-P660", "zendd_client_output_gate", snapshots.clientOutput.summary.zendd_client_output_gate_status, snapshots.clientOutput.validation.valid),
  ];
}

function sourceSummary(phaseRange, sourceId, status, validationValid) {
  return {
    schema_version: "zendd-source-tranche-summary-row.v1",
    phase_range: phaseRange,
    source_id: sourceId,
    source_status: status,
    validation_valid: validationValid,
  };
}

function operatorRowMatches(row, filters) {
  return Object.entries(filters).every(([key, value]) => {
    if (key === "missing_evidence") return value ? row.missing_evidence.length > 0 : row.missing_evidence.length === 0;
    if (key === "next_action_required") return value ? Boolean(row.next_allowed_action) : !row.next_allowed_action;
    return row[key] === value;
  });
}

function filterDefinition(rowKey, filters, expectedMinCount, description) {
  return { row_key: rowKey, filters, expectedMinCount, description };
}

function dashboardDefinition(rowKey, description, metrics) {
  return { row_key: rowKey, description, metrics };
}

function apiRouteDefinition(rowKey, routePath, collection, expectedProjectionRowCount) {
  return { row_key: rowKey, routePath, collection, expectedProjectionRowCount };
}

function auditDefinition(rowKey, description, actualCount, expectedCount) {
  return { row_key: rowKey, description, actualCount, expectedCount };
}

function unsafeSnapshotCount(snapshots) {
  const checks = [
    snapshots.clientOutput.summary.protected_client_output_pass_allowed,
    snapshots.clientOutput.summary.weak_korean_language_can_pass,
    snapshots.boundary.summary.zendd_mutation_allowed,
    snapshots.boundary.summary.raw_vdr_copy_allowed,
    snapshots.commandEvidence.summary.command_execution_allowed_now,
    snapshots.sourceContract.summary.raw_material_copy_allowed_in_hermes,
  ];
  return checks.filter(Boolean).length;
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-operator-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_operator_surface_gate" : nextAllowedAction,
  };
}

function validationItem(pathValue, checkId, passed, message) {
  return {
    path: pathValue,
    check_id: checkId,
    status: passed ? "pass" : "fail",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "pass").map((item) => ({ path: item.path, message: item.message }));
  return { valid: errors.length === 0, errors };
}

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_OPERATOR_SURFACE_INPUTS.schemaPath,
    phase_ledger_path: options.phaseLedgerPath ?? DEFAULT_ZENDD_OPERATOR_SURFACE_INPUTS.phaseLedgerPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_OPERATOR_SURFACE_INPUTS.packagePath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_OPERATOR_SURFACE_INPUTS.zenddProjectRoot,
  };
}

function parseArgs(argv) {
  const args = { write: true, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--zendd-root") {
      args.zenddProjectRoot = argv[++index];
    } else if (arg === "--schema") {
      args.schemaPath = argv[++index];
    } else if (arg === "--phase-ledger") {
      args.phaseLedgerPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: npm run ${COMMAND_NAME} -- [--check] [--zendd-root <path>] [--out-dir <path>]

Creates the P661-P680 Zendd-Hermes operator surface projection.
--check validates without starting a server, registering live routes, executing Zendd commands,
copying raw VDR/client material, validating receipts, or promoting PASS.
`);
}

async function readJsonSource(filePath) {
  const source = await readTextSource(filePath);
  if (!source.available) return { ...source, data: null };
  try {
    return { ...source, data: JSON.parse(source.text) };
  } catch (error) {
    return { ...source, available: false, data: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return {
      path: resolved,
      available: true,
      text,
      content_hash: hashValue(text),
    };
  } catch (error) {
    return {
      path: resolved,
      available: false,
      text: "",
      content_hash: null,
      error: error.message,
    };
  }
}

function buildQueryPath(routePath, filters) {
  const params = Object.entries(filters).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return params.length ? `${routePath}?${params.join("&")}` : routePath;
}

function withOrdinalAndHash(row, index, hashKey) {
  const ordinal = index + 1;
  const withOrdinal = { ordinal, ...row };
  return { ...withOrdinal, [hashKey]: hashValue(withOrdinal) };
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    [`${key.slice(0, -1)}_count`]: rows.length,
    [key]: rows,
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashRows(rows, fields) {
  return hashValue(rows.map((row) => Object.fromEntries(fields.map((field) => [field, row[field] ?? null]))));
}

function hashValue(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}

function dateStamp(value) {
  return String(value).replace(/[-:]/g, "").replace(/\..*$/, "Z");
}

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# Zendd Operator Surface Summary",
    "",
    `- Status: ${summary.zendd_operator_surface_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Zendd root: ${summary.zendd_project_root}`,
    `- Zendd HEAD: ${summary.zendd_git_head_short ?? "unavailable"}`,
    `- Operator claims: ${summary.operator_claim_row_count}`,
    `- Blocked claims: ${summary.blocked_operator_claim_count}`,
    `- Missing input rows: ${summary.missing_input_row_count}`,
    `- Next action rows: ${summary.next_action_row_count}`,
    `- API projection rows: ${summary.api_projection_row_count}`,
    `- Zendd commands executed: ${summary.zendd_command_executed}`,
    `- Raw material copied: ${summary.raw_material_copied}`,
    `- PASS promotion performed: ${summary.pass_promotion_performed}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "## Next Action",
    "",
    "Build the Zendd release and recovery bridge with rollback targets, recovery receipts, and protected release gates.",
    "",
  ].join("\n");
}
