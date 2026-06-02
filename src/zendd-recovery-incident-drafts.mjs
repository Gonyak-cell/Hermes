import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddDiffReviewRollbackBinding } from "./zendd-diff-review-rollback-binding.mjs";
import { buildZenddHumanReceiptIntake } from "./zendd-human-receipt-intake.mjs";
import { buildZenddReleaseCandidateSandbox } from "./zendd-release-candidate-sandbox.mjs";

export const DEFAULT_ZENDD_RECOVERY_INCIDENT_DRAFTS_OUT_DIR = "artifacts/zendd-recovery-incident-drafts/latest";
export const DEFAULT_ZENDD_RECOVERY_INCIDENT_DRAFTS_INPUTS = {
  schemaPath: "schemas/zendd-recovery-incident-drafts.schema.json",
  packagePath: "package.json",
  integrationPhaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  developmentPhaseLedgerPath: "docs/zendd-hermes-development-operations-phase-ledger.md",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-recovery-incident-drafts";
const HUMAN_RECEIPT_INTAKE_COMMAND_NAME = "project:zendd-human-receipt-intake";
const RELEASE_CANDIDATE_SANDBOX_COMMAND_NAME = "project:zendd-release-candidate-sandbox";
const DIFF_REVIEW_COMMAND_NAME = "project:zendd-diff-review-rollback-binding";
const SCHEMA_VERSION = "zendd-recovery-incident-drafts.v1";
const CAPABILITY_ID = "project.zendd.recovery_incident_drafts";
const PHASE_RANGE = "P941-P960";
const PHASE_SLOT = "P941";
const PREVIOUS_PHASE_SLOT = "P940";
const NEXT_PHASE_SLOT = "P961";
const READY_STATUS = "ready_for_zendd_recovery_incident_drafts";

export async function runZenddRecoveryIncidentDrafts(options = {}) {
  const result = await buildZenddRecoveryIncidentDrafts(options);
  if (options.write !== false) await writeZenddRecoveryIncidentDrafts(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd recovery incident drafts failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddRecoveryIncidentDrafts(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_RECOVERY_INCIDENT_DRAFTS_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const developmentPhaseLedger = await readTextSource(inputs.development_phase_ledger_path);
  const humanReceiptIntake = await buildZenddHumanReceiptIntake({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    integrationPhaseLedgerPath: inputs.integration_phase_ledger_path,
    developmentPhaseLedgerPath: inputs.development_phase_ledger_path,
    write: false,
  });
  const releaseCandidateSandbox = await buildZenddReleaseCandidateSandbox({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    integrationPhaseLedgerPath: inputs.integration_phase_ledger_path,
    developmentPhaseLedgerPath: inputs.development_phase_ledger_path,
    write: false,
  });
  const diffReview = await buildZenddDiffReviewRollbackBinding({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    integrationPhaseLedgerPath: inputs.integration_phase_ledger_path,
    developmentPhaseLedgerPath: inputs.development_phase_ledger_path,
    write: false,
  });

  const policy = buildRecoveryIncidentPolicy(generatedAt, humanReceiptIntake, releaseCandidateSandbox, diffReview);
  const incidentRows = buildIncidentDraftRows({ releaseCandidateSandbox, humanReceiptIntake, diffReview });
  const rollbackRows = buildRollbackTargetRows(incidentRows);
  const receiptDraftRows = buildRecoveryReceiptDraftRows(incidentRows);
  const operatorSurfaceRows = buildOperatorIncidentSurfaceRows(incidentRows);
  const failClosedRows = buildFailClosedRows({ policy, humanReceiptIntake, releaseCandidateSandbox, diffReview, incidentRows, rollbackRows, receiptDraftRows, operatorSurfaceRows });
  const closeoutRows = buildCloseoutRows({ policy, humanReceiptIntake, releaseCandidateSandbox, diffReview, incidentRows, rollbackRows, receiptDraftRows, operatorSurfaceRows, failClosedRows });
  const anchor = buildAnchor({ packageJson, developmentPhaseLedger, humanReceiptIntake, releaseCandidateSandbox, diffReview, policy, incidentRows, rollbackRows, receiptDraftRows, operatorSurfaceRows, failClosedRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, developmentPhaseLedger, humanReceiptIntake, releaseCandidateSandbox, diffReview, policy, incidentRows, rollbackRows, receiptDraftRows, operatorSurfaceRows, failClosedRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, policy, incidentRows, rollbackRows, receiptDraftRows, operatorSurfaceRows, failClosedRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_recovery_incident_drafts_id: `zendd-recovery-incident-drafts.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    recovery_incident_drafts_anchor: anchor,
    source_human_receipt_intake_summary: humanReceiptIntake.summary,
    source_release_candidate_sandbox_summary: releaseCandidateSandbox.summary,
    source_diff_review_rollback_binding_summary: diffReview.summary,
    recovery_incident_policy: policy,
    recovery_incident_draft_rows: incidentRows,
    recovery_rollback_target_rows: rollbackRows,
    recovery_receipt_draft_rows: receiptDraftRows,
    operator_incident_surface_rows: operatorSurfaceRows,
    recovery_incident_fail_closed_rows: failClosedRows,
    recovery_incident_closeout_rows: closeoutRows,
    recovery_incident_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ humanReceiptIntake, releaseCandidateSandbox, diffReview, incidentRows, rollbackRows, receiptDraftRows, operatorSurfaceRows, failClosedRows, closeoutRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_recovery_incident_drafts")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ humanReceiptIntake, releaseCandidateSandbox, diffReview, incidentRows, rollbackRows, receiptDraftRows, operatorSurfaceRows, failClosedRows, closeoutRows, validation: result.validation });
  result.summary.zendd_recovery_incident_drafts_id = result.zendd_recovery_incident_drafts_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddRecoveryIncidentDrafts(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-recovery-incident-drafts.json"), serializableResult(result));
  await writeJson(path.join(outDir, "recovery-incident-policy.json"), result.recovery_incident_policy);
  await writeJson(path.join(outDir, "recovery-incident-draft-rows.json"), collectionEnvelope("zendd-recovery-incident-draft-rows.v1", "recovery_incident_draft_rows", result.recovery_incident_draft_rows, result.generated_at));
  await writeJson(path.join(outDir, "recovery-rollback-target-rows.json"), collectionEnvelope("zendd-recovery-rollback-target-rows.v1", "recovery_rollback_target_rows", result.recovery_rollback_target_rows, result.generated_at));
  await writeJson(path.join(outDir, "recovery-receipt-draft-rows.json"), collectionEnvelope("zendd-recovery-receipt-draft-rows.v1", "recovery_receipt_draft_rows", result.recovery_receipt_draft_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-incident-surface-rows.json"), collectionEnvelope("zendd-operator-incident-surface-rows.v1", "operator_incident_surface_rows", result.operator_incident_surface_rows, result.generated_at));
  await writeJson(path.join(outDir, "recovery-incident-fail-closed-rows.json"), collectionEnvelope("zendd-recovery-incident-fail-closed-rows.v1", "recovery_incident_fail_closed_rows", result.recovery_incident_fail_closed_rows, result.generated_at));
  await writeJson(path.join(outDir, "recovery-incident-closeout-rows.json"), collectionEnvelope("zendd-recovery-incident-closeout-rows.v1", "recovery_incident_closeout_rows", result.recovery_incident_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "recovery-incident-gate-rows.json"), collectionEnvelope("zendd-recovery-incident-gate-rows.v1", "recovery_incident_gate_rows", result.recovery_incident_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-recovery-incident-drafts-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddRecoveryIncidentDraftsCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddRecoveryIncidentDrafts(args);
    console.log(`Zendd recovery incident drafts ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_recovery_incident_drafts_status}`);
    console.log(`Incident drafts: ${result.summary.recovery_incident_draft_count}`);
    console.log(`Rollback targets: ${result.summary.recovery_rollback_target_count}`);
    console.log(`Recovery receipt drafts: ${result.summary.recovery_receipt_draft_count}`);
    console.log(`Recovery execution allowed: ${result.summary.recovery_execution_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildRecoveryIncidentPolicy(generatedAt, humanReceiptIntake, releaseCandidateSandbox, diffReview) {
  return {
    schema_version: "zendd-recovery-incident-policy.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    project_id: "project.zendd",
    source_human_receipt_intake_ref: humanReceiptIntake.zendd_human_receipt_intake_id,
    source_release_candidate_sandbox_ref: releaseCandidateSandbox.zendd_release_candidate_sandbox_id,
    source_diff_review_rollback_binding_ref: diffReview.zendd_diff_review_rollback_binding_id,
    incident_draft_surface_creation_allowed: true,
    incident_pass_allowed_now: false,
    recovery_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    command_execution_allowed_now: false,
    zendd_file_write_allowed_now: false,
    database_migration_allowed_now: false,
    client_export_allowed_now: false,
    client_delivery_allowed_now: false,
    receipt_payload_present: false,
    receipt_payload_validation_allowed_now: false,
    receipt_application_allowed_now: false,
    raw_log_storage_allowed: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    incident_pass_requires: [
      "incident_draft_ref",
      "source_surface_ref",
      "evidence_ref",
      "rollback_target_ref",
      "recovery_receipt_draft_ref",
      "reviewer_ref",
      "hard_gate_ref",
      "human_receipt_ref",
    ],
    blocked_status_requires: ["block_reason", "responsible_owner", "rollback_target_ref", "next_allowed_action"],
    next_allowed_action: "draft incident, bind rollback target and recovery receipt, then wait for scoped human review before any recovery action",
    created_at: generatedAt,
  };
}

function buildIncidentDraftRows({ releaseCandidateSandbox, humanReceiptIntake, diffReview }) {
  const candidateRows = releaseCandidateSandbox.release_candidate_sandbox_rows;
  const receiptRows = humanReceiptIntake.zendd_receipt_template_rows;
  const workflowReceiptRows = receiptRows.filter((row) => row.source_type === "vdr_ldd_workflow_adapter");
  const protectedReceiptRows = receiptRows.filter((row) => row.source_type === "protected_action_human_gate");
  const scenarios = [
    ["broken_root_build", "build_failure", "high", candidateRows[0], "clean_external_checkout", "checkout_state", "capture failed build evidence packet and keep root build blocked"],
    ["frontend_build_failure", "build_failure", "medium", candidateRows[1], "last_known_good_frontend_commit", "checkout_state", "capture frontend failure evidence and bind diff review before retry"],
    ["failed_command_capture", "command_evidence_failure", "medium", candidateRows[9], "command_evidence_packet_redraft", "evidence_packet", "redraft command evidence packet without executing the command"],
    ["stale_vdr_classification", "stale_domain_data", "high", workflowReceiptRows[0], "vdr_source_refs_unchanged", "domain_source_refs", "refresh VDR source refs through reference-only evidence before retry"],
    ["stale_ldd_source_spans", "stale_domain_data", "high", workflowReceiptRows[1], "ldd_source_span_refs_unchanged", "domain_source_refs", "refresh LDD source span evidence and keep legal PASS blocked"],
    ["bad_migration_draft", "database_migration_failure", "critical", protectedReceiptRows[0], "database_snapshot_required", "database_snapshot", "prepare migration rollback target and receipt draft before any migration retry"],
    ["dirty_tree_conflict", "dirty_tree_conflict", "medium", diffReview.diff_review_packet_rows?.[0], "external_zendd_checkout_unmodified", "checkout_state", "review dirty diff packet and create scoped work order before applying changes"],
    ["receipt_intake_failure", "receipt_intake_failure", "medium", humanReceiptIntake.zendd_receipt_queue_rows[0], "receipt_queue_state_preserved", "receipt_queue_state", "quarantine malformed receipt and request corrected scoped human receipt"],
    ["release_sandbox_failure", "release_candidate_failure", "high", candidateRows[2], "release_candidate_sandbox_state", "sandbox_state", "preserve sandbox packet and bind artifact hash before reconsidering release"],
    ["rollback_to_clean_checkout", "rollback_draft", "high", diffReview.rollback_binding_rows?.[0], "clean_external_checkout", "checkout_state", "document rollback receipt before reverting any Zendd file"],
    ["client_output_recovery", "client_output_recovery", "critical", candidateRows[5], "last_known_safe_client_output_state", "client_output_state", "keep client output blocked and require attorney recovery receipt"],
    ["backend_outage", "service_outage", "high", candidateRows[3], "backend_service_last_known_good_state", "service_state", "draft outage recovery receipt and keep migrations and API writes blocked"],
  ];
  return scenarios.map(([key, incidentType, severity, sourceRow, rollbackTarget, rollbackTargetType, nextAllowedAction], index) => {
    const source = sourceRow ?? candidateRows[index % candidateRows.length] ?? receiptRows[index % receiptRows.length] ?? {};
    const sourceRef = source.release_candidate_ref ?? source.receipt_template_ref ?? source.diff_review_packet_ref ?? source.rollback_binding_ref ?? source.receipt_queue_ref ?? `source.zendd.recovery.${key}`;
    const claimId = source.source_release_claim_ref ?? source.claim_id ?? source.protected_action_request_ref ?? `claim.zendd.recovery.${key}`;
    const evidenceRef = source.sandbox_evidence_packet_ref ?? source.evidence_ref ?? source.command_execution_evidence_ref ?? source.rollback_evidence_ref ?? `evidence.zendd.recovery.${key}`;
    const reviewerRef = source.reviewer_ref ?? `review.zendd.recovery.${key}`;
    const hardGateRef = source.hard_gate_ref ?? `gate.zendd.recovery.${key}`;
    const humanReceiptRef = source.human_receipt_ref ?? `receipt.zendd.recovery.${key}`;
    const rollbackTargetRef = `rollback-target.zendd.recovery.${normalizeKey(rollbackTarget)}`;
    return {
      schema_version: "zendd-recovery-incident-draft-row.v1",
      phase_slot: "P944-P948",
      row_id: `zendd-recovery-incident-draft.row.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      incident_draft_ref: `incident-draft.zendd.${key}`,
      incident_type: incidentType,
      severity,
      source_surface_ref: sourceRef,
      source_claim_id: claimId,
      evidence_ref: evidenceRef,
      diff_review_ref: diffReview.zendd_diff_review_rollback_binding_id,
      reviewer_ref: reviewerRef,
      hard_gate_ref: hardGateRef,
      human_receipt_ref: humanReceiptRef,
      rollback_target: rollbackTarget,
      rollback_target_type: rollbackTargetType,
      rollback_target_ref: rollbackTargetRef,
      recovery_receipt_draft_ref: `receipt-draft.zendd.recovery.${key}`,
      incident_status: "draft_only_not_executed",
      incident_pass_allowed_now: false,
      recovery_execution_allowed_now: false,
      rollback_execution_allowed_now: false,
      command_execution_allowed_now: false,
      zendd_file_write_allowed_now: false,
      database_migration_allowed_now: false,
      client_export_allowed_now: false,
      client_delivery_allowed_now: false,
      receipt_payload_present: false,
      raw_log_storage_allowed: false,
      raw_vdr_or_client_material_copy_allowed_now: false,
      secret_read_allowed_now: false,
      current_verdict: "blocked",
      block_reason: "incident_recovery_requires_evidence_rollback_target_and_human_receipt",
      responsible_owner: incidentType.includes("client") || incidentType.includes("stale_domain") ? "legal_domain_operator" : "development_operator",
      next_allowed_action: nextAllowedAction,
    };
  });
}

function buildRollbackTargetRows(incidentRows) {
  const targets = new Map();
  for (const row of incidentRows) {
    if (!targets.has(row.rollback_target_ref)) targets.set(row.rollback_target_ref, row);
  }
  return [...targets.values()].map((row, index) => ({
    schema_version: "zendd-recovery-rollback-target-row.v1",
    phase_slot: "P949-P951",
    row_id: `zendd-recovery-rollback-target.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    rollback_target_ref: row.rollback_target_ref,
    rollback_target: row.rollback_target,
    rollback_target_type: row.rollback_target_type,
    source_incident_draft_ref: row.incident_draft_ref,
    rollback_evidence_ref: `evidence.zendd.recovery.rollback.${normalizeKey(row.rollback_target_ref)}`,
    rollback_receipt_draft_ref: `receipt-draft.zendd.rollback.${normalizeKey(row.rollback_target_ref)}`,
    rollback_target_materialized_now: false,
    rollback_execution_allowed_now: false,
    zendd_file_write_allowed_now: false,
    database_migration_allowed_now: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    current_verdict: "blocked",
    block_reason: "rollback_target_evidence_or_receipt_missing",
    responsible_owner: row.responsible_owner,
    next_allowed_action: "bind rollback evidence and human recovery receipt before any rollback execution",
  }));
}

function buildRecoveryReceiptDraftRows(incidentRows) {
  return incidentRows.map((row, index) => ({
    schema_version: "zendd-recovery-receipt-draft-row.v1",
    phase_slot: "P952-P954",
    row_id: `zendd-recovery-receipt-draft.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    recovery_receipt_draft_ref: row.recovery_receipt_draft_ref,
    incident_draft_ref: row.incident_draft_ref,
    source_claim_id: row.source_claim_id,
    evidence_ref: row.evidence_ref,
    rollback_target_ref: row.rollback_target_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    human_receipt_ref: row.human_receipt_ref,
    required_receipt_fields: ["human_reviewer_id", "reviewer_role", "incident_draft_ref", "evidence_ref", "rollback_target_ref", "verdict", "scope_statement", "reviewed_at", "signature_or_ack_ref"],
    receipt_draft_status: "draft_only_not_sent",
    receipt_payload_present: false,
    receipt_payload_materialized: false,
    receipt_validation_allowed_now: false,
    receipt_application_allowed_now: false,
    recovery_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    synthetic_receipt_allowed: false,
    current_verdict: "blocked",
    block_reason: "recovery_receipt_payload_missing",
    responsible_owner: row.responsible_owner,
    next_allowed_action: "send scoped recovery receipt draft to authorized reviewer after evidence refs are complete",
  }));
}

function buildOperatorIncidentSurfaceRows(incidentRows) {
  return incidentRows.map((row, index) => ({
    schema_version: "zendd-operator-incident-surface-row.v1",
    phase_slot: "P955-P957",
    row_id: `zendd-operator-incident-surface.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    surface_ref: `operator-surface.zendd.recovery.${normalizeKey(row.incident_draft_ref)}`,
    incident_draft_ref: row.incident_draft_ref,
    current_verdict: row.current_verdict,
    missing_evidence: ["executed_command_evidence", "rollback_evidence", "validated_human_receipt"],
    missing_receipt: row.human_receipt_ref,
    hard_gate_ref: row.hard_gate_ref,
    block_reason: row.block_reason,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
    recovery_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    command_execution_allowed_now: false,
    client_delivery_allowed_now: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
  }));
}

function buildFailClosedRows({ policy, humanReceiptIntake, releaseCandidateSandbox, diffReview, incidentRows, rollbackRows, receiptDraftRows, operatorSurfaceRows }) {
  const guardedRows = [...incidentRows, ...rollbackRows, ...receiptDraftRows, ...operatorSurfaceRows];
  const rows = [
    ["human_receipt_intake_ready", humanReceiptIntake.validation.valid && humanReceiptIntake.summary.zendd_human_receipt_intake_status === "ready_for_zendd_human_receipt_intake", "P921-P940 human receipt intake is ready.", "repair human receipt intake"],
    ["release_candidate_sandbox_ready", releaseCandidateSandbox.validation.valid && releaseCandidateSandbox.summary.zendd_release_candidate_sandbox_status === "ready_for_zendd_release_candidate_sandbox", "P881-P900 release candidate sandbox is ready.", "repair release candidate sandbox"],
    ["diff_review_ready", diffReview.validation.valid && diffReview.summary.zendd_diff_review_rollback_binding_status === "ready_for_zendd_diff_review_rollback_binding", "P861-P880 diff review rollback binding is ready.", "repair diff review rollback binding"],
    ["incident_drafts_blocked", incidentRows.length >= 10 && incidentRows.every(documentedIncidentDraft), "Incident drafts are documented BLOCK rows.", "complete incident draft rows"],
    ["rollback_targets_blocked", rollbackRows.length >= 6 && rollbackRows.every(documentedRollbackTarget), "Rollback targets are present and not executable.", "complete rollback target rows"],
    ["recovery_receipt_drafts_future_only", receiptDraftRows.length === incidentRows.length && receiptDraftRows.every(documentedReceiptDraft), "Recovery receipt drafts contain no payload and cannot be applied.", "complete recovery receipt draft rows"],
    ["operator_surface_visible", operatorSurfaceRows.length === incidentRows.length && operatorSurfaceRows.every(documentedOperatorSurface), "Operator surface rows expose block reason, missing inputs, and next action.", "complete operator incident surface rows"],
    ["no_recovery_or_rollback_execution", noExecutionAllowed(policy) && guardedRows.every(noExecutionAllowed), "No recovery, rollback, command execution, file write, migration, delivery, receipt application, or PASS is allowed.", "restore recovery no-execution policy"],
    ["no_raw_logs_vdr_client_or_secret", !policy.raw_log_storage_allowed && !policy.raw_vdr_or_client_material_copy_allowed_now && !policy.secret_read_allowed_now && guardedRows.every(noRawMaterial), "No raw logs, raw VDR/client material, or secrets are stored or read.", "restore reference-only incident boundary"],
    ["client_output_remains_blocked", incidentRows.filter((row) => row.incident_type === "client_output_recovery").every((row) => row.client_delivery_allowed_now === false && row.current_verdict === "blocked"), "Client-output recovery stays blocked pending attorney receipt.", "keep client output blocked"],
  ];
  return rows.map(([fixtureId, passed, message, nextAllowedAction], index) => ({
    schema_version: "zendd-recovery-incident-fail-closed-row.v1",
    phase_slot: "P958-P959",
    row_id: `zendd-recovery-incident-fail-closed.row.${String(index + 1).padStart(2, "0")}`,
    fixture_id: `fixture.zendd.recovery_incident.${fixtureId}`,
    project_id: "project.zendd",
    fixture_status: passed ? "pass" : "blocked",
    incident_pass_allowed_now: false,
    recovery_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    command_execution_allowed_now: false,
    zendd_file_write_allowed_now: false,
    database_migration_allowed_now: false,
    client_export_allowed_now: false,
    client_delivery_allowed_now: false,
    receipt_payload_present: false,
    receipt_application_allowed_now: false,
    raw_log_storage_allowed: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    message,
    next_allowed_action: passed ? "continue_to_next_recovery_incident_fixture" : nextAllowedAction,
  }));
}

function buildCloseoutRows({ policy, humanReceiptIntake, releaseCandidateSandbox, diffReview, incidentRows, rollbackRows, receiptDraftRows, operatorSurfaceRows, failClosedRows }) {
  const ready = humanReceiptIntake.validation.valid
    && humanReceiptIntake.summary.zendd_human_receipt_intake_status === "ready_for_zendd_human_receipt_intake"
    && releaseCandidateSandbox.validation.valid
    && releaseCandidateSandbox.summary.zendd_release_candidate_sandbox_status === "ready_for_zendd_release_candidate_sandbox"
    && diffReview.validation.valid
    && diffReview.summary.zendd_diff_review_rollback_binding_status === "ready_for_zendd_diff_review_rollback_binding"
    && noExecutionAllowed(policy)
    && incidentRows.every(documentedIncidentDraft)
    && rollbackRows.every(documentedRollbackTarget)
    && receiptDraftRows.every(documentedReceiptDraft)
    && operatorSurfaceRows.every(documentedOperatorSurface)
    && failClosedRows.every((row) => row.fixture_status === "pass");
  return [{
    schema_version: "zendd-recovery-incident-closeout-row.v1",
    phase_slot: "P960",
    row_id: "zendd-recovery-incident-closeout.p960",
    project_id: "project.zendd",
    closeout_status: ready ? READY_STATUS : "blocked",
    recovery_incident_drafts_ready: ready,
    incident_draft_count: incidentRows.length,
    rollback_target_count: rollbackRows.length,
    recovery_receipt_draft_count: receiptDraftRows.length,
    operator_incident_surface_count: operatorSurfaceRows.length,
    incident_pass_allowed_now: false,
    recovery_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    command_execution_allowed_now: false,
    zendd_file_write_allowed_now: false,
    database_migration_allowed_now: false,
    client_export_allowed_now: false,
    client_delivery_allowed_now: false,
    receipt_payload_present: false,
    receipt_application_allowed_now: false,
    raw_log_storage_allowed: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    next_integration_phase_slot: NEXT_PHASE_SLOT,
    next_allowed_action: "advance to P961-P980 active operator dashboard without executing recovery or rollback",
  }];
}

function buildAnchor({ packageJson, developmentPhaseLedger, humanReceiptIntake, releaseCandidateSandbox, diffReview, policy, incidentRows, rollbackRows, receiptDraftRows, operatorSurfaceRows, failClosedRows, closeoutRows }) {
  return {
    schema_version: "zendd-recovery-incident-drafts-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    human_receipt_intake_command_name: HUMAN_RECEIPT_INTAKE_COMMAND_NAME,
    release_candidate_sandbox_command_name: RELEASE_CANDIDATE_SANDBOX_COMMAND_NAME,
    diff_review_command_name: DIFF_REVIEW_COMMAND_NAME,
    source_human_receipt_intake_ref: humanReceiptIntake.zendd_human_receipt_intake_id,
    source_human_receipt_intake_status: humanReceiptIntake.summary.zendd_human_receipt_intake_status,
    source_release_candidate_sandbox_ref: releaseCandidateSandbox.zendd_release_candidate_sandbox_id,
    source_release_candidate_sandbox_status: releaseCandidateSandbox.summary.zendd_release_candidate_sandbox_status,
    source_diff_review_rollback_binding_ref: diffReview.zendd_diff_review_rollback_binding_id,
    source_diff_review_rollback_binding_status: diffReview.summary.zendd_diff_review_rollback_binding_status,
    package_json_hash: packageJson.content_hash,
    development_phase_ledger_hash: developmentPhaseLedger.content_hash,
    policy_hash: hashValue(policy),
    incident_rows_hash: hashRows(incidentRows, ["incident_draft_ref", "incident_type", "current_verdict"]),
    rollback_rows_hash: hashRows(rollbackRows, ["rollback_target_ref", "rollback_execution_allowed_now", "current_verdict"]),
    receipt_draft_rows_hash: hashRows(receiptDraftRows, ["recovery_receipt_draft_ref", "receipt_payload_present", "current_verdict"]),
    operator_surface_rows_hash: hashRows(operatorSurfaceRows, ["surface_ref", "block_reason", "next_allowed_action"]),
    fail_closed_rows_hash: hashRows(failClosedRows, ["fixture_id", "fixture_status", "message"]),
    closeout_rows_hash: hashRows(closeoutRows, ["closeout_status", "recovery_incident_drafts_ready", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, developmentPhaseLedger, humanReceiptIntake, releaseCandidateSandbox, diffReview, policy, incidentRows, rollbackRows, receiptDraftRows, operatorSurfaceRows, failClosedRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  return [
    gateRow("p941_human_receipt_intake_ready", "P941", humanReceiptIntake.validation.valid && humanReceiptIntake.summary.zendd_human_receipt_intake_status === "ready_for_zendd_human_receipt_intake", "P921-P940 human receipt intake is ready.", "repair human receipt intake"),
    gateRow("p942_release_candidate_sandbox_ready", "P942", releaseCandidateSandbox.validation.valid && releaseCandidateSandbox.summary.zendd_release_candidate_sandbox_status === "ready_for_zendd_release_candidate_sandbox", "P881-P900 release candidate sandbox is ready.", "repair release candidate sandbox"),
    gateRow("p943_diff_review_ready", "P943", diffReview.validation.valid && diffReview.summary.zendd_diff_review_rollback_binding_status === "ready_for_zendd_diff_review_rollback_binding", "P861-P880 diff review rollback binding is ready.", "repair diff review rollback binding"),
    gateRow("p944_policy_draft_only", "P944", policy.incident_draft_surface_creation_allowed && noExecutionAllowed(policy), "Recovery incident policy creates draft surfaces only and keeps execution disabled.", "restore recovery incident policy"),
    gateRow("p945_incident_drafts", "P945-P948", incidentRows.length >= 10 && incidentRows.every(documentedIncidentDraft), "Incident drafts cover build, command, stale data, migration, dirty tree, receipt, release sandbox, client output, outage, and rollback scenarios.", "complete incident draft rows"),
    gateRow("p949_rollback_targets", "P949-P951", rollbackRows.length >= 6 && rollbackRows.every(documentedRollbackTarget), "Rollback targets are recorded but not executable.", "complete rollback target rows"),
    gateRow("p952_recovery_receipt_drafts", "P952-P954", receiptDraftRows.length === incidentRows.length && receiptDraftRows.every(documentedReceiptDraft), "Recovery receipt drafts are payload-free and future-only.", "complete recovery receipt draft rows"),
    gateRow("p955_operator_incident_surface", "P955-P957", operatorSurfaceRows.length === incidentRows.length && operatorSurfaceRows.every(documentedOperatorSurface), "Operator incident surface exposes block reason, missing evidence, missing receipt, and next action.", "complete operator incident surface rows"),
    gateRow("p958_fail_closed", "P958-P959", failClosedRows.length >= 10 && failClosedRows.every((row) => row.fixture_status === "pass"), "Fail-closed fixtures prove no recovery execution, rollback, Zendd write, raw exposure, or receipt application.", "complete fail-closed fixtures"),
    gateRow("p960_closeout_ready", "P960", closeoutRows.every((row) => row.closeout_status === READY_STATUS && row.recovery_incident_drafts_ready), "P941-P960 closes with recovery incident drafts ready.", "complete recovery incident closeout"),
    gateRow("package_script_registered", "P960", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("validate_chain_registered", "P960", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`), `${COMMAND_NAME} is included in npm run validate.`, `add ${COMMAND_NAME} to validate chain`),
    gateRow("development_phase_ledger_declared", "P960", developmentPhaseLedger.available && developmentPhaseLedger.text.includes("P941-P960") && developmentPhaseLedger.text.includes(COMMAND_NAME), "Development operations phase ledger declares P941-P960.", "record P941-P960 in phase ledger"),
  ];
}

function buildValidationItems({ gateRows, policy, incidentRows, rollbackRows, receiptDraftRows, operatorSurfaceRows, failClosedRows, closeoutRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "recovery_incident_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.no_execution", "recovery_boundary", noExecutionAllowed(policy), "Recovery incident policy keeps recovery, rollback, command execution, writes, delivery, and receipt application disabled."));
  items.push(validationItem("incidents.blocked", "incident_boundary", incidentRows.every(documentedIncidentDraft), "Incident drafts are documented BLOCK rows."));
  items.push(validationItem("rollback.blocked", "rollback_boundary", rollbackRows.every(documentedRollbackTarget), "Rollback targets are documented BLOCK rows."));
  items.push(validationItem("receipts.future_only", "receipt_boundary", receiptDraftRows.every(documentedReceiptDraft), "Recovery receipt drafts are future-only without payload."));
  items.push(validationItem("surface.visible", "operator_surface_boundary", operatorSurfaceRows.every(documentedOperatorSurface), "Operator surface rows show block reason, missing inputs, and next action."));
  items.push(validationItem("fail_closed.pass", "recovery_boundary", failClosedRows.every((row) => row.fixture_status === "pass"), "Fail-closed fixtures pass."));
  items.push(validationItem("closeout.ready", "closeout_boundary", closeoutRows.every((row) => row.closeout_status === READY_STATUS), "Closeout is ready without execution."));
  return items;
}

function buildSummary({ humanReceiptIntake, releaseCandidateSandbox, diffReview, incidentRows, rollbackRows, receiptDraftRows, operatorSurfaceRows, failClosedRows, closeoutRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_recovery_incident_drafts_status: validation.valid ? READY_STATUS : "documented_block_pending_recovery_incident_drafts",
    source_human_receipt_intake_status: humanReceiptIntake.summary.zendd_human_receipt_intake_status,
    source_release_candidate_sandbox_status: releaseCandidateSandbox.summary.zendd_release_candidate_sandbox_status,
    source_diff_review_rollback_binding_status: diffReview.summary.zendd_diff_review_rollback_binding_status,
    recovery_incident_draft_count: incidentRows.length,
    recovery_rollback_target_count: rollbackRows.length,
    recovery_receipt_draft_count: receiptDraftRows.length,
    operator_incident_surface_count: operatorSurfaceRows.length,
    recovery_incident_fail_closed_count: failClosedRows.length,
    recovery_incident_drafts_ready: closeoutRows.every((row) => row.recovery_incident_drafts_ready),
    incident_pass_allowed_now: false,
    recovery_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    command_execution_allowed_now: false,
    zendd_file_write_allowed_now: false,
    database_migration_allowed_now: false,
    client_delivery_allowed_now: false,
    receipt_payload_present: false,
    receipt_application_allowed_now: false,
    raw_log_storage_allowed: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    validation_error_count: validation.errors.length,
  };
}

function documentedIncidentDraft(row) {
  return row.current_verdict === "blocked"
    && row.incident_status === "draft_only_not_executed"
    && Boolean(row.incident_draft_ref)
    && Boolean(row.source_surface_ref)
    && Boolean(row.evidence_ref)
    && Boolean(row.rollback_target_ref)
    && Boolean(row.recovery_receipt_draft_ref)
    && Boolean(row.reviewer_ref)
    && Boolean(row.hard_gate_ref)
    && Boolean(row.human_receipt_ref)
    && noExecutionAllowed(row)
    && noRawMaterial(row)
    && documentedBlock(row);
}

function documentedRollbackTarget(row) {
  return row.current_verdict === "blocked"
    && Boolean(row.rollback_target_ref)
    && Boolean(row.rollback_evidence_ref)
    && row.rollback_target_materialized_now === false
    && row.rollback_execution_allowed_now === false
    && noRawMaterial(row)
    && documentedBlock(row);
}

function documentedReceiptDraft(row) {
  return row.current_verdict === "blocked"
    && Boolean(row.recovery_receipt_draft_ref)
    && Boolean(row.incident_draft_ref)
    && Boolean(row.rollback_target_ref)
    && row.receipt_draft_status === "draft_only_not_sent"
    && row.required_receipt_fields?.length >= 8
    && row.receipt_payload_present === false
    && row.receipt_payload_materialized === false
    && row.receipt_validation_allowed_now === false
    && row.receipt_application_allowed_now === false
    && row.synthetic_receipt_allowed === false
    && noExecutionAllowed(row)
    && documentedBlock(row);
}

function documentedOperatorSurface(row) {
  return row.current_verdict === "blocked"
    && Boolean(row.surface_ref)
    && Boolean(row.incident_draft_ref)
    && Array.isArray(row.missing_evidence)
    && row.missing_evidence.length >= 3
    && Boolean(row.missing_receipt)
    && Boolean(row.hard_gate_ref)
    && noExecutionAllowed(row)
    && noRawMaterial(row)
    && documentedBlock(row);
}

function documentedBlock(row) {
  return row.current_verdict === "blocked"
    && Boolean(row.block_reason)
    && Boolean(row.responsible_owner)
    && Boolean(row.next_allowed_action);
}

function noExecutionAllowed(row) {
  return row.incident_pass_allowed_now !== true
    && row.recovery_execution_allowed_now !== true
    && row.rollback_execution_allowed_now !== true
    && row.command_execution_allowed_now !== true
    && row.zendd_file_write_allowed_now !== true
    && row.database_migration_allowed_now !== true
    && row.client_export_allowed_now !== true
    && row.client_delivery_allowed_now !== true
    && row.receipt_payload_validation_allowed_now !== true
    && row.receipt_validation_allowed_now !== true
    && row.receipt_application_allowed_now !== true;
}

function noRawMaterial(row) {
  return row.raw_log_storage_allowed !== true
    && row.raw_vdr_or_client_material_copy_allowed_now !== true
    && row.secret_read_allowed_now !== true;
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-recovery-incident-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_recovery_incident_gate" : nextAllowedAction,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_RECOVERY_INCIDENT_DRAFTS_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_RECOVERY_INCIDENT_DRAFTS_INPUTS.packagePath,
    integration_phase_ledger_path: options.integrationPhaseLedgerPath ?? DEFAULT_ZENDD_RECOVERY_INCIDENT_DRAFTS_INPUTS.integrationPhaseLedgerPath,
    development_phase_ledger_path: options.developmentPhaseLedgerPath ?? DEFAULT_ZENDD_RECOVERY_INCIDENT_DRAFTS_INPUTS.developmentPhaseLedgerPath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_RECOVERY_INCIDENT_DRAFTS_INPUTS.zenddProjectRoot,
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
    } else if (arg === "--integration-ledger") {
      args.integrationPhaseLedgerPath = argv[++index];
    } else if (arg === "--development-ledger") {
      args.developmentPhaseLedgerPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: npm run ${COMMAND_NAME} -- [--check] [--zendd-root <path>] [--out-dir <path>]

Creates the P941-P960 Zendd recovery and incident draft layer. --check validates
without executing recovery, rollback, commands, migrations, Zendd writes, receipt
application, client delivery, raw VDR/client copy, raw log storage, or secret
reads.
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

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# Zendd Recovery Incident Drafts Summary",
    "",
    `- Status: ${summary.zendd_recovery_incident_drafts_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Incident drafts: ${summary.recovery_incident_draft_count}`,
    `- Rollback targets: ${summary.recovery_rollback_target_count}`,
    `- Recovery receipt drafts: ${summary.recovery_receipt_draft_count}`,
    `- Recovery execution allowed: ${summary.recovery_execution_allowed_now}`,
    `- Rollback execution allowed: ${summary.rollback_execution_allowed_now}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
  ].join("\n");
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

function hashRows(rows, keys) {
  return hashValue(rows.map((row) => Object.fromEntries(keys.map((key) => [key, row[key]]))));
}

function hashValue(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}

function normalizeKey(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}
