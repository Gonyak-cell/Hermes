import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddOperatorSurface } from "./zendd-operator-surface.mjs";

export const DEFAULT_ZENDD_RELEASE_RECOVERY_OUT_DIR = "artifacts/zendd-release-recovery/latest";
export const DEFAULT_ZENDD_RELEASE_RECOVERY_INPUTS = {
  schemaPath: "schemas/zendd-release-recovery.schema.json",
  phaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  packagePath: "package.json",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-release-recovery";
const OPERATOR_SURFACE_COMMAND_NAME = "project:zendd-operator-surface";
const SCHEMA_VERSION = "zendd-release-recovery.v1";
const CAPABILITY_ID = "project.zendd.release_recovery";
const PHASE_RANGE = "P681-P700";
const PHASE_SLOT = "P681";
const PREVIOUS_PHASE_SLOT = "P680";
const NEXT_PHASE_SLOT = "P701";
const READY_STATUS = "ready_for_cross_system_claim_freeze";

export async function runZenddReleaseRecovery(options = {}) {
  const result = await buildZenddReleaseRecovery(options);
  if (options.write !== false) await writeZenddReleaseRecovery(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd release recovery failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddReleaseRecovery(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_RELEASE_RECOVERY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const phaseLedger = await readTextSource(inputs.phase_ledger_path);
  const operatorSurface = await buildZenddOperatorSurface({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    phaseLedgerPath: inputs.phase_ledger_path,
    write: false,
  });
  const policy = buildReleaseRecoveryPolicy(generatedAt);
  const releaseClaimRows = buildReleaseClaimRows(operatorSurface);
  const recoveryScenarioRows = buildRecoveryScenarioRows(releaseClaimRows);
  const rollbackTargetRows = buildRollbackTargetRows(releaseClaimRows, recoveryScenarioRows);
  const protectedActionRows = buildProtectedActionRows(releaseClaimRows);
  const recoveryReceiptRows = buildRecoveryReceiptRows(releaseClaimRows, recoveryScenarioRows);
  const closeoutRows = buildCloseoutRows({ releaseClaimRows, recoveryScenarioRows, rollbackTargetRows, protectedActionRows, recoveryReceiptRows });
  const anchor = buildAnchor({ packageJson, phaseLedger, operatorSurface, policy, releaseClaimRows, recoveryScenarioRows, rollbackTargetRows, protectedActionRows, recoveryReceiptRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, phaseLedger, operatorSurface, policy, releaseClaimRows, recoveryScenarioRows, rollbackTargetRows, protectedActionRows, recoveryReceiptRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, policy, releaseClaimRows, recoveryScenarioRows, rollbackTargetRows, protectedActionRows, recoveryReceiptRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ operatorSurface, releaseClaimRows, recoveryScenarioRows, rollbackTargetRows, protectedActionRows, recoveryReceiptRows, closeoutRows, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_release_recovery_id: `zendd-release-recovery.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    release_recovery_anchor: anchor,
    operator_surface_summary: operatorSurface.summary,
    release_recovery_policy: policy,
    release_claim_rows: releaseClaimRows,
    recovery_scenario_rows: recoveryScenarioRows,
    rollback_target_rows: rollbackTargetRows,
    protected_release_action_rows: protectedActionRows,
    recovery_receipt_rows: recoveryReceiptRows,
    release_recovery_closeout_rows: closeoutRows,
    release_recovery_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_release_recovery")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ operatorSurface, releaseClaimRows, recoveryScenarioRows, rollbackTargetRows, protectedActionRows, recoveryReceiptRows, closeoutRows, validation: result.validation });
  result.summary.zendd_release_recovery_id = result.zendd_release_recovery_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddReleaseRecovery(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-release-recovery.json"), serializableResult(result));
  await writeJson(path.join(outDir, "release-recovery-policy.json"), result.release_recovery_policy);
  await writeJson(path.join(outDir, "release-claim-rows.json"), collectionEnvelope("zendd-release-claim-rows.v1", "release_claim_rows", result.release_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "recovery-scenario-rows.json"), collectionEnvelope("zendd-recovery-scenario-rows.v1", "recovery_scenario_rows", result.recovery_scenario_rows, result.generated_at));
  await writeJson(path.join(outDir, "rollback-target-rows.json"), collectionEnvelope("zendd-rollback-target-rows.v1", "rollback_target_rows", result.rollback_target_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-release-action-rows.json"), collectionEnvelope("zendd-protected-release-action-rows.v1", "protected_release_action_rows", result.protected_release_action_rows, result.generated_at));
  await writeJson(path.join(outDir, "recovery-receipt-rows.json"), collectionEnvelope("zendd-recovery-receipt-rows.v1", "recovery_receipt_rows", result.recovery_receipt_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-recovery-closeout-rows.json"), collectionEnvelope("zendd-release-recovery-closeout-rows.v1", "release_recovery_closeout_rows", result.release_recovery_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-recovery-gate-rows.json"), collectionEnvelope("zendd-release-recovery-gate-rows.v1", "release_recovery_gate_rows", result.release_recovery_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-release-recovery-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddReleaseRecoveryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddReleaseRecovery(args);
    console.log(`Zendd release recovery ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_release_recovery_status}`);
    console.log(`Zendd path: ${result.summary.zendd_project_root}`);
    console.log(`Release claims: ${result.summary.release_claim_row_count}`);
    console.log(`Recovery scenarios: ${result.summary.recovery_scenario_row_count}`);
    console.log(`Protected actions: ${result.summary.protected_release_action_row_count}`);
    console.log(`Release execution allowed: ${result.summary.release_execution_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildReleaseRecoveryPolicy(generatedAt) {
  return {
    schema_version: "zendd-release-recovery-policy.v1",
    phase_slot: "P681",
    project_id: "project.zendd",
    release_execution_allowed_now: false,
    package_build_allowed_now: false,
    electron_package_allowed_now: false,
    database_migration_allowed_now: false,
    client_export_allowed_now: false,
    rollback_execution_allowed_now: false,
    recovery_execution_allowed_now: false,
    protected_release_pass_allowed_without_receipt: false,
    release_pass_requires: ["operator_surface_ref", "command_evidence_ref", "release_evidence_ref", "rollback_target", "reviewer_ref", "hard_gate_ref", "human_receipt_ref"],
    blocked_status_requires: ["block_reason", "responsible_owner", "next_allowed_action"],
    rollback_target_required_for_all_release_claims: true,
    next_allowed_action: "bind release evidence, rollback target, recovery receipt, and human approval before any Zendd release PASS",
    created_at: generatedAt,
  };
}

function buildReleaseClaimRows(operatorSurface) {
  const operatorSurfaceRef = operatorSurface.zendd_operator_surface_id;
  const rows = [
    ["root_build_check", "Root package build or validation", "root.build", "package_or_release", "external_zendd_checkout_unmodified", "capture root build/check evidence in a receipt-gated work order"],
    ["frontend_build_check", "Frontend build, lint, or test", "frontend.build", "package_or_release", "external_zendd_checkout_unmodified", "capture frontend build/check evidence in a receipt-gated work order"],
    ["electron_package", "Electron package or installer", "root.package", "package_or_release", "external_zendd_checkout_unmodified", "defer Electron packaging until release receipt and rollback plan exist"],
    ["backend_migration", "Backend Alembic/PostgreSQL migration", "backend.migrate", "database_migration", "database_snapshot_and_external_adapter", "prepare migration evidence, backup snapshot, and human receipt before execution"],
    ["vdr_data_migration", "VDR data or source-control migration", "vdr.migrate", "domain_data_write", "zendd_vdr_source_of_truth", "prepare VDR rollback and redacted source evidence before any data write"],
    ["client_report_export", "Client-facing report or export", "client.output.export", "client_output", "no_client_export_until_receipt", "bind client-output gate evidence and attorney receipt before export"],
    ["desktop_release", "Zendd desktop app release", "desktop.release", "desktop_release", "external_zendd_checkout_unmodified", "prepare release package evidence and rollback-to-previous build target"],
    ["failed_output_recovery", "Failed client-output or report recovery", "client.output.recovery", "protected_recovery", "last_known_safe_client_output_state", "draft recovery receipt and keep client output blocked"],
    ["rollback_to_external_adapter", "Rollback to external adapter integration mode", "integration.rollback", "rollback", "external_project_adapter", "document rollback receipt before changing integration mode"],
    ["post_release_smoke", "Post-release smoke/check command", "release.smoke", "post_release_check", "external_zendd_checkout_unmodified", "capture post-release smoke evidence only after release work order exists"],
  ];
  return rows.map(([key, description, commandRef, releaseType, rollbackTarget, nextAllowedAction], index) => ({
    schema_version: "zendd-release-claim-row.v1",
    phase_slot: "P682-P686",
    row_id: `zendd-release-claim.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    claim_id: `claim.zendd.release.${key}`,
    release_type: releaseType,
    release_description: description,
    operator_surface_ref: operatorSurfaceRef,
    command_ref: `command.zendd.${normalizeKey(commandRef)}`,
    command_evidence_ref: `evidence.zendd.release.command.${normalizeKey(commandRef)}`,
    release_evidence_ref: `evidence.zendd.release.${key}`,
    rollback_target: rollbackTarget,
    rollback_target_ref: `rollback-target.zendd.${normalizeKey(rollbackTarget)}`,
    recovery_receipt_ref: `receipt-template.zendd.release_recovery.${key}`,
    reviewer_ref: `review.zendd.release.${key}`,
    hard_gate_ref: `gate.zendd.release.${key}`,
    human_receipt_ref: `receipt.zendd.release.${key}`,
    protected_release_claim: true,
    release_execution_allowed_now: false,
    current_verdict: "blocked",
    block_reason: "release_evidence_review_receipt_or_rollback_target_missing",
    responsible_owner: "integration_operator",
    next_allowed_action: nextAllowedAction,
  }));
}

function buildRecoveryScenarioRows(releaseRows) {
  const rows = [
    ["stale_vdr_or_source_data", "stale VDR classification or stale source control data", "zendd_vdr_source_of_truth", "refresh source refs and bind redacted evidence before retry"],
    ["backend_outage", "backend/API/database outage during Zendd release", "database_snapshot_and_external_adapter", "draft outage recovery receipt and keep release blocked"],
    ["failed_database_migration", "failed Alembic/PostgreSQL migration", "database_snapshot_and_external_adapter", "prepare migration rollback receipt before any retry"],
    ["failed_electron_package", "failed Electron package or installer", "external_zendd_checkout_unmodified", "return to previous package candidate and capture failure evidence"],
    ["failed_client_report_export", "failed client-facing report/export", "last_known_safe_client_output_state", "keep client output blocked and bind attorney recovery receipt"],
    ["missing_human_receipt_after_release_request", "release request without validated human receipt", "no_release_state_change", "collect validated human receipt before release claim can PASS"],
    ["dirty_tree_conflict_before_release", "dirty Zendd tree conflicts with release request", "external_zendd_checkout_unmodified", "classify dirty rows and create work order before release"],
    ["integration_mode_rollback", "rollback from future physical integration to external adapter", "external_project_adapter", "document physical rollback receipt before mode change"],
  ];
  return rows.map(([scenarioId, description, rollbackTarget, nextAllowedAction], index) => ({
    schema_version: "zendd-recovery-scenario-row.v1",
    phase_slot: "P687-P690",
    row_id: `zendd-recovery-scenario.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    scenario_id: `recovery.zendd.${scenarioId}`,
    claim_id: releaseRows[index % releaseRows.length].claim_id,
    recovery_description: description,
    rollback_target: rollbackTarget,
    rollback_target_ref: `rollback-target.zendd.${normalizeKey(rollbackTarget)}`,
    recovery_receipt_ref: `receipt-template.zendd.recovery.${scenarioId}`,
    recovery_draft_receipt_status: "draft_only_not_applied",
    release_or_recovery_execution_allowed_now: false,
    current_verdict: "blocked",
    block_reason: "recovery_receipt_or_rollback_evidence_missing",
    responsible_owner: "integration_operator",
    next_allowed_action: nextAllowedAction,
  }));
}

function buildRollbackTargetRows(releaseRows, recoveryRows) {
  const targets = new Map();
  for (const row of [...releaseRows, ...recoveryRows]) {
    targets.set(row.rollback_target, row.rollback_target_ref);
  }
  return [...targets.entries()].map(([rollbackTarget, rollbackTargetRef], index) => ({
    schema_version: "zendd-rollback-target-row.v1",
    phase_slot: "P691",
    row_id: `zendd-rollback-target.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    rollback_target: rollbackTarget,
    rollback_target_ref: rollbackTargetRef,
    rollback_target_type: rollbackTarget.includes("database") ? "database_snapshot" : rollbackTarget.includes("client") ? "client_output_state" : "integration_or_checkout_state",
    rollback_execution_allowed_now: false,
    rollback_receipt_required: true,
    rollback_evidence_ref: `evidence.zendd.rollback.${normalizeKey(rollbackTarget)}`,
    current_verdict: "blocked",
    block_reason: "rollback_target_not_receipted_or_evidenced",
    responsible_owner: "integration_operator",
    next_allowed_action: "bind rollback evidence and human recovery receipt before rollback execution",
  }));
}

function buildProtectedActionRows(releaseRows) {
  const actions = [
    ["execute_zendd_release_command", "release_command_execution", "Zendd release/package/build command execution"],
    ["run_database_migration", "database_migration", "Alembic/PostgreSQL migration"],
    ["write_vdr_or_source_data", "domain_data_write", "VDR or LDD source data write"],
    ["export_client_report", "client_output_export", "Client-facing report/export"],
    ["publish_desktop_package", "desktop_release_publish", "Desktop package publication"],
    ["apply_release_approval", "approval_application", "Release approval application"],
    ["execute_rollback", "rollback_execution", "Rollback execution"],
    ["move_zendd_code_directory", "physical_integration", "Zendd code directory move"],
  ];
  return actions.map(([actionId, actionType, description], index) => ({
    schema_version: "zendd-protected-release-action-row.v1",
    phase_slot: "P692-P694",
    row_id: `zendd-protected-release-action.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    action_id: `protected-action.zendd.${actionId}`,
    action_type: actionType,
    action_description: description,
    related_release_claim_refs: releaseRows.filter((row) => row.release_type === actionType || row.release_type.includes(actionType.split("_")[0])).map((row) => row.claim_id),
    action_allowed_now: false,
    human_receipt_required: true,
    release_evidence_required: true,
    rollback_target_required: true,
    current_verdict: "blocked",
    block_reason: "protected_release_action_requires_evidence_receipt_and_rollback_target",
    responsible_owner: "integration_operator",
    next_allowed_action: "create protected release work order with evidence, rollback target, and human receipt",
  }));
}

function buildRecoveryReceiptRows(releaseRows, recoveryRows) {
  return [...releaseRows.map((row) => ["release", row.claim_id, row.recovery_receipt_ref, row.rollback_target]), ...recoveryRows.map((row) => ["recovery", row.scenario_id, row.recovery_receipt_ref, row.rollback_target])]
    .map(([receiptType, sourceRef, receiptRef, rollbackTarget], index) => ({
      schema_version: "zendd-recovery-receipt-row.v1",
      phase_slot: "P695-P697",
      row_id: `zendd-recovery-receipt.row.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      receipt_type: receiptType,
      source_ref: sourceRef,
      recovery_receipt_ref: receiptRef,
      rollback_target: rollbackTarget,
      receipt_payload_present: false,
      receipt_materialized: false,
      receipt_validated: false,
      approval_applied: false,
      current_verdict: "blocked",
      block_reason: "recovery_receipt_payload_missing",
      responsible_owner: "integration_operator",
      next_allowed_action: "collect explicit human recovery receipt before release or recovery PASS",
    }));
}

function buildCloseoutRows({ releaseClaimRows, recoveryScenarioRows, rollbackTargetRows, protectedActionRows, recoveryReceiptRows }) {
  const ready = releaseClaimRows.every(documentedBlock)
    && recoveryScenarioRows.every(documentedBlock)
    && rollbackTargetRows.every(documentedBlock)
    && protectedActionRows.every((row) => documentedBlock(row) && row.action_allowed_now === false)
    && recoveryReceiptRows.every((row) => documentedBlock(row) && row.receipt_payload_present === false);
  return [{
    schema_version: "zendd-release-recovery-closeout-row.v1",
    phase_slot: "P700",
    row_id: "zendd-release-recovery-closeout.p700",
    project_id: "project.zendd",
    closeout_status: ready ? "ready_for_release_recovery_closeout" : "blocked",
    release_claim_row_count: releaseClaimRows.length,
    recovery_scenario_row_count: recoveryScenarioRows.length,
    rollback_target_row_count: rollbackTargetRows.length,
    protected_release_action_row_count: protectedActionRows.length,
    recovery_receipt_row_count: recoveryReceiptRows.length,
    release_execution_allowed_now: false,
    package_build_allowed_now: false,
    database_migration_allowed_now: false,
    client_export_allowed_now: false,
    rollback_execution_allowed_now: false,
    recovery_execution_allowed_now: false,
    receipt_validated: false,
    approval_applied: false,
    pass_promoted: false,
    next_integration_phase_slot: NEXT_PHASE_SLOT,
    next_allowed_action: "run cross-system Zendd claim freeze only after all release/recovery claims are PASS or documented BLOCK",
    read_only: true,
  }];
}

function buildAnchor({ packageJson, phaseLedger, operatorSurface, policy, releaseClaimRows, recoveryScenarioRows, rollbackTargetRows, protectedActionRows, recoveryReceiptRows, closeoutRows }) {
  return {
    schema_version: "zendd-release-recovery-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    operator_surface_command_name: OPERATOR_SURFACE_COMMAND_NAME,
    source_operator_surface_id: operatorSurface.zendd_operator_surface_id,
    source_operator_surface_status: operatorSurface.summary.zendd_operator_surface_status,
    package_json_hash: packageJson.content_hash,
    phase_ledger_hash: phaseLedger.content_hash,
    policy_hash: hashValue(policy),
    release_claim_rows_hash: hashRows(releaseClaimRows, ["claim_id", "rollback_target", "current_verdict", "next_allowed_action"]),
    recovery_scenario_rows_hash: hashRows(recoveryScenarioRows, ["scenario_id", "rollback_target", "recovery_receipt_ref", "next_allowed_action"]),
    rollback_target_rows_hash: hashRows(rollbackTargetRows, ["rollback_target", "rollback_execution_allowed_now", "next_allowed_action"]),
    protected_action_rows_hash: hashRows(protectedActionRows, ["action_id", "action_allowed_now", "block_reason", "next_allowed_action"]),
    recovery_receipt_rows_hash: hashRows(recoveryReceiptRows, ["source_ref", "receipt_payload_present", "receipt_validated"]),
    closeout_rows_hash: hashRows(closeoutRows, ["row_id", "closeout_status", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, phaseLedger, operatorSurface, policy, releaseClaimRows, recoveryScenarioRows, rollbackTargetRows, protectedActionRows, recoveryReceiptRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  return [
    gateRow("p681_operator_surface_ready", "P681", operatorSurface.validation.valid && operatorSurface.summary.zendd_operator_surface_status === "ready_for_release_recovery_bridge", "P661-P680 operator surface is ready.", "repair operator surface before release/recovery bridge"),
    gateRow("p681_policy_declared", "P681", !policy.release_execution_allowed_now && !policy.database_migration_allowed_now && policy.rollback_target_required_for_all_release_claims, "Release/recovery policy blocks execution and requires rollback targets.", "declare release/recovery policy"),
    gateRow("p682_release_claims_documented_block", "P682-P686", releaseClaimRows.length >= 10 && releaseClaimRows.every(documentedBlock) && releaseClaimRows.every((row) => row.rollback_target && row.recovery_receipt_ref), "Release claims remain documented BLOCK with rollback target and recovery receipt ref.", "complete release claim rows"),
    gateRow("p687_recovery_scenarios_documented", "P687-P690", recoveryScenarioRows.length >= 8 && recoveryScenarioRows.every(documentedBlock) && recoveryScenarioRows.every((row) => row.rollback_target && row.recovery_receipt_ref), "Recovery scenarios keep rollback targets and draft receipts.", "complete recovery scenario rows"),
    gateRow("p691_rollback_targets_blocked", "P691", rollbackTargetRows.length >= 5 && rollbackTargetRows.every((row) => documentedBlock(row) && row.rollback_execution_allowed_now === false), "Rollback targets are explicit but not executable.", "complete rollback target rows"),
    gateRow("p692_protected_actions_blocked", "P692-P694", protectedActionRows.length >= 8 && protectedActionRows.every((row) => documentedBlock(row) && row.action_allowed_now === false), "Protected release actions stay blocked.", "complete protected action rows"),
    gateRow("p695_recovery_receipts_future_only", "P695-P697", recoveryReceiptRows.length >= releaseClaimRows.length && recoveryReceiptRows.every((row) => documentedBlock(row) && !row.receipt_payload_present && !row.receipt_validated), "Recovery receipts are declared but not materialized or validated.", "complete recovery receipt rows"),
    gateRow("p700_closeout_ready", "P700", closeoutRows.length === 1 && closeoutRows.every((row) => row.closeout_status === "ready_for_release_recovery_closeout" && !row.pass_promoted), "Release/recovery bridge closes without PASS promotion or execution.", "complete release/recovery closeout"),
    gateRow("package_script_registered", "P700", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("validate_chain_registered", "P700", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`), `${COMMAND_NAME} is included in npm run validate.`, `add ${COMMAND_NAME} to validate chain`),
    gateRow("phase_ledger_acceptance_declared", "P700", phaseLedger.available && phaseLedger.text.includes("P681-P700") && phaseLedger.text.includes(COMMAND_NAME), "P681-P700 phase ledger declares release/recovery acceptance.", "record P681-P700 in phase ledger"),
  ];
}

function buildValidationItems({ gateRows, policy, releaseClaimRows, recoveryScenarioRows, rollbackTargetRows, protectedActionRows, recoveryReceiptRows, closeoutRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "release_recovery_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.no_execution", "release_boundary", !policy.release_execution_allowed_now && !policy.rollback_execution_allowed_now && !policy.recovery_execution_allowed_now, "Release, rollback, and recovery execution are disabled"));
  items.push(validationItem("release_claims.rollback_target", "rollback_boundary", releaseClaimRows.every((row) => row.rollback_target && row.rollback_target_ref && row.recovery_receipt_ref), "Release claims include rollback target and recovery receipt ref"));
  items.push(validationItem("release_claims.documented_block", "claim_boundary", releaseClaimRows.every(documentedBlock), "Release claims are documented BLOCK"));
  items.push(validationItem("recovery_scenarios.documented_block", "recovery_boundary", recoveryScenarioRows.every(documentedBlock), "Recovery scenarios are documented BLOCK"));
  items.push(validationItem("rollback_targets.no_execution", "rollback_boundary", rollbackTargetRows.every((row) => row.rollback_execution_allowed_now === false && documentedBlock(row)), "Rollback targets are not executable"));
  items.push(validationItem("protected_actions.no_execution", "protected_action_boundary", protectedActionRows.every((row) => row.action_allowed_now === false && documentedBlock(row)), "Protected release actions are blocked"));
  items.push(validationItem("recovery_receipts.future_only", "receipt_boundary", recoveryReceiptRows.every((row) => !row.receipt_payload_present && !row.receipt_validated && !row.approval_applied && documentedBlock(row)), "Recovery receipts are future-only"));
  items.push(validationItem("closeout.no_promotion", "release_boundary", closeoutRows.every((row) => !row.pass_promoted && !row.receipt_validated && !row.approval_applied), "Closeout does not promote PASS"));
  return items;
}

function buildSummary({ operatorSurface, releaseClaimRows, recoveryScenarioRows, rollbackTargetRows, protectedActionRows, recoveryReceiptRows, closeoutRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_release_recovery_status: validation.valid ? READY_STATUS : "documented_block_pending_release_recovery",
    zendd_project_root: operatorSurface.summary.zendd_project_root,
    zendd_git_head_short: operatorSurface.summary.zendd_git_head_short,
    operator_surface_status: operatorSurface.summary.zendd_operator_surface_status,
    release_claim_row_count: releaseClaimRows.length,
    recovery_scenario_row_count: recoveryScenarioRows.length,
    rollback_target_row_count: rollbackTargetRows.length,
    protected_release_action_row_count: protectedActionRows.length,
    recovery_receipt_row_count: recoveryReceiptRows.length,
    closeout_row_count: closeoutRows.length,
    release_execution_allowed_now: false,
    package_build_allowed_now: false,
    database_migration_allowed_now: false,
    client_export_allowed_now: false,
    rollback_execution_allowed_now: false,
    recovery_execution_allowed_now: false,
    receipt_validated: false,
    approval_applied: false,
    pass_promoted: false,
    validation_error_count: validation.errors.length,
  };
}

function documentedBlock(row) {
  return row.current_verdict === "blocked" && Boolean(row.block_reason) && Boolean(row.responsible_owner) && Boolean(row.next_allowed_action);
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-release-recovery-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_release_recovery_gate" : nextAllowedAction,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_RELEASE_RECOVERY_INPUTS.schemaPath,
    phase_ledger_path: options.phaseLedgerPath ?? DEFAULT_ZENDD_RELEASE_RECOVERY_INPUTS.phaseLedgerPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_RELEASE_RECOVERY_INPUTS.packagePath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_RELEASE_RECOVERY_INPUTS.zenddProjectRoot,
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

Creates the P681-P700 Zendd-Hermes release and recovery bridge.
--check validates without executing Zendd commands, running migrations, exporting client reports,
publishing packages, executing rollback, validating receipts, or promoting PASS.
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
    "# Zendd Release Recovery Summary",
    "",
    `- Status: ${summary.zendd_release_recovery_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Zendd root: ${summary.zendd_project_root}`,
    `- Zendd HEAD: ${summary.zendd_git_head_short ?? "unavailable"}`,
    `- Release claims: ${summary.release_claim_row_count}`,
    `- Recovery scenarios: ${summary.recovery_scenario_row_count}`,
    `- Rollback targets: ${summary.rollback_target_row_count}`,
    `- Protected actions: ${summary.protected_release_action_row_count}`,
    `- Recovery receipts: ${summary.recovery_receipt_row_count}`,
    `- Release execution allowed: ${summary.release_execution_allowed_now}`,
    `- Database migration allowed: ${summary.database_migration_allowed_now}`,
    `- Client export allowed: ${summary.client_export_allowed_now}`,
    `- PASS promoted: ${summary.pass_promoted}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "## Next Action",
    "",
    "Run the cross-system Zendd claim freeze only after release and recovery rows are PASS or documented BLOCK.",
    "",
  ].join("\n");
}
