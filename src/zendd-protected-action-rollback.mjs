import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildZenddCrossSystemFreeze } from "./zendd-cross-system-freeze.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";

export const DEFAULT_ZENDD_PROTECTED_ACTION_ROLLBACK_OUT_DIR = "artifacts/zendd-protected-action-rollback/latest";
export const DEFAULT_ZENDD_PROTECTED_ACTION_ROLLBACK_INPUTS = {
  schemaPath: "schemas/zendd-protected-action-rollback.schema.json",
  phaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  packagePath: "package.json",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-protected-action-rollback";
const CROSS_SYSTEM_FREEZE_COMMAND_NAME = "project:zendd-cross-system-freeze";
const SCHEMA_VERSION = "zendd-protected-action-rollback.v1";
const CAPABILITY_ID = "project.zendd.protected_action_rollback";
const PHASE_RANGE = "P721-P740";
const PHASE_SLOT = "P721";
const PREVIOUS_PHASE_SLOT = "P720";
const NEXT_PHASE_SLOT = "P741";
const READY_STATUS = "ready_for_physical_integration_decision";

export async function runZenddProtectedActionRollback(options = {}) {
  const result = await buildZenddProtectedActionRollback(options);
  if (options.write !== false) await writeZenddProtectedActionRollback(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd protected action rollback failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddProtectedActionRollback(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_PROTECTED_ACTION_ROLLBACK_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const phaseLedger = await readTextSource(inputs.phase_ledger_path);
  const crossSystemFreeze = await buildZenddCrossSystemFreeze({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    phaseLedgerPath: inputs.phase_ledger_path,
    write: false,
  });
  const policy = buildProtectedActionRollbackPolicy(generatedAt);
  const protectedActionRows = buildProtectedActionRows(crossSystemFreeze);
  const rollbackTargetRows = buildRollbackTargetRows(protectedActionRows);
  const workOrderRows = buildWorkOrderRows(protectedActionRows);
  const failClosedRows = buildFailClosedRows({ protectedActionRows, rollbackTargetRows, workOrderRows, crossSystemFreeze });
  const nextActionRows = buildNextActionRows({ protectedActionRows, rollbackTargetRows, workOrderRows, failClosedRows });
  const closeoutRows = buildCloseoutRows({ protectedActionRows, rollbackTargetRows, workOrderRows, failClosedRows, nextActionRows });
  const anchor = buildAnchor({ packageJson, phaseLedger, crossSystemFreeze, policy, protectedActionRows, rollbackTargetRows, workOrderRows, failClosedRows, nextActionRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, phaseLedger, crossSystemFreeze, policy, protectedActionRows, rollbackTargetRows, workOrderRows, failClosedRows, nextActionRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, policy, protectedActionRows, rollbackTargetRows, workOrderRows, failClosedRows, nextActionRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ crossSystemFreeze, protectedActionRows, rollbackTargetRows, workOrderRows, failClosedRows, nextActionRows, closeoutRows, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_protected_action_rollback_id: `zendd-protected-action-rollback.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    protected_action_rollback_anchor: anchor,
    cross_system_freeze_summary: crossSystemFreeze.summary,
    protected_action_rollback_policy: policy,
    protected_action_rows: protectedActionRows,
    rollback_target_rows: rollbackTargetRows,
    protected_work_order_rows: workOrderRows,
    fail_closed_fixture_rows: failClosedRows,
    next_action_rows: nextActionRows,
    protected_action_rollback_closeout_rows: closeoutRows,
    protected_action_rollback_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_protected_action_rollback")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ crossSystemFreeze, protectedActionRows, rollbackTargetRows, workOrderRows, failClosedRows, nextActionRows, closeoutRows, validation: result.validation });
  result.summary.zendd_protected_action_rollback_id = result.zendd_protected_action_rollback_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddProtectedActionRollback(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-protected-action-rollback.json"), serializableResult(result));
  await writeJson(path.join(outDir, "protected-action-rollback-policy.json"), result.protected_action_rollback_policy);
  await writeJson(path.join(outDir, "protected-action-rows.json"), collectionEnvelope("zendd-protected-action-rows.v1", "protected_action_rows", result.protected_action_rows, result.generated_at));
  await writeJson(path.join(outDir, "rollback-target-rows.json"), collectionEnvelope("zendd-protected-rollback-target-rows.v1", "rollback_target_rows", result.rollback_target_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-work-order-rows.json"), collectionEnvelope("zendd-protected-work-order-rows.v1", "protected_work_order_rows", result.protected_work_order_rows, result.generated_at));
  await writeJson(path.join(outDir, "fail-closed-fixture-rows.json"), collectionEnvelope("zendd-protected-fail-closed-fixture-rows.v1", "fail_closed_fixture_rows", result.fail_closed_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "next-action-rows.json"), collectionEnvelope("zendd-protected-next-action-rows.v1", "next_action_rows", result.next_action_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-action-rollback-closeout-rows.json"), collectionEnvelope("zendd-protected-action-rollback-closeout-rows.v1", "protected_action_rollback_closeout_rows", result.protected_action_rollback_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-action-rollback-gate-rows.json"), collectionEnvelope("zendd-protected-action-rollback-gate-rows.v1", "protected_action_rollback_gate_rows", result.protected_action_rollback_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-protected-action-rollback-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddProtectedActionRollbackCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddProtectedActionRollback(args);
    console.log(`Zendd protected action rollback ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_protected_action_rollback_status}`);
    console.log(`Zendd path: ${result.summary.zendd_project_root}`);
    console.log(`Protected actions: ${result.summary.protected_action_row_count}`);
    console.log(`Rollback targets: ${result.summary.rollback_target_row_count}`);
    console.log(`Work orders: ${result.summary.work_order_row_count}`);
    console.log(`Fail-closed fixtures: ${result.summary.fail_closed_fixture_row_count}`);
    console.log(`Execution allowed: ${result.summary.protected_action_execution_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildProtectedActionRollbackPolicy(generatedAt) {
  return {
    schema_version: "zendd-protected-action-rollback-policy.v1",
    phase_slot: PHASE_SLOT,
    project_id: "project.zendd",
    protected_action_execution_allowed_now: false,
    release_command_execution_allowed_now: false,
    database_migration_allowed_now: false,
    client_export_allowed_now: false,
    rollback_rehearsal_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    physical_code_move_allowed_now: false,
    pass_requires: ["cross_system_freeze_ref", "protected_work_order_ref", "rollback_target_ref", "hard_gate_ref", "human_receipt_ref", "recovery_receipt_ref", "responsible_owner"],
    block_requires: ["block_reason", "responsible_owner", "next_allowed_action"],
    next_allowed_action: "draft protected work orders and rollback receipts before physical integration decision",
    created_at: generatedAt,
  };
}

function buildProtectedActionRows(crossSystemFreeze) {
  const freezeRef = crossSystemFreeze.zendd_cross_system_freeze_id;
  const rows = [
    ["execute_zendd_release_command", "release_command_execution", "Run Zendd release/build/check command", "external_zendd_checkout_unmodified", "capture command evidence and release receipt before execution"],
    ["run_zendd_build_or_package", "package_build", "Build or package Zendd frontend/Electron artifacts", "previous_package_candidate", "prepare package rollback target and human receipt"],
    ["run_database_migration", "database_migration", "Run Alembic/PostgreSQL migration", "database_snapshot", "prepare database snapshot, migration evidence, and receipt"],
    ["write_vdr_or_ldd_source_data", "domain_data_write", "Write VDR/LDD source or source-control data", "zendd_vdr_source_of_truth", "bind redacted source evidence and attorney approval receipt"],
    ["export_client_report", "client_output_export", "Export client-facing report or LDD output", "last_known_safe_client_output_state", "bind client output gate and attorney receipt"],
    ["publish_desktop_package", "desktop_publish", "Publish Zendd desktop package", "previous_desktop_package", "prepare desktop rollback and release signoff receipt"],
    ["apply_human_approval_or_receipt", "receipt_application", "Apply human approval or receipt into Hermes/Zendd state", "receipt_quarantine_state", "validate receipt packet before any application"],
    ["execute_rollback", "rollback_execution", "Execute rollback from a failed protected action", "documented_rollback_target", "collect recovery receipt before rollback execution"],
    ["move_zendd_code_directory", "physical_integration", "Move or import Zendd code directory", "external_project_adapter", "defer movement until P741-P760 physical integration decision"],
    ["mutate_external_zendd_checkout", "external_checkout_mutation", "Edit external Zendd checkout through Hermes", "external_zendd_checkout_unmodified", "create scoped work order and dirty-tree receipt before mutation"],
  ];
  return rows.map(([actionKey, actionType, description, rollbackTarget, nextAllowedAction], index) => ({
    schema_version: "zendd-protected-action-row.v1",
    phase_slot: "P722-P726",
    row_id: `zendd-protected-action.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    action_id: `protected-action.zendd.${actionKey}`,
    action_type: actionType,
    action_description: description,
    cross_system_freeze_ref: freezeRef,
    related_freeze_claim_refs: relatedFreezeClaimRefs(crossSystemFreeze, actionKey, actionType),
    protected_work_order_ref: `work-order.zendd.protected.${actionKey}`,
    rollback_target: rollbackTarget,
    rollback_target_ref: `rollback-target.zendd.protected.${normalizeKey(rollbackTarget)}`,
    hard_gate_ref: `hard-gate.zendd.protected.${actionKey}`,
    human_receipt_ref: `receipt.zendd.protected.${actionKey}`,
    recovery_receipt_ref: `receipt-template.zendd.protected_recovery.${actionKey}`,
    evidence_ref: `evidence.zendd.protected.${actionKey}`,
    action_allowed_now: false,
    rollback_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    physical_code_move_allowed_now: actionKey === "move_zendd_code_directory" ? false : false,
    current_verdict: "blocked",
    block_reason: "protected_action_requires_work_order_rollback_gate_and_human_receipt",
    responsible_owner: "integration_operator",
    next_allowed_action: nextAllowedAction,
  }));
}

function relatedFreezeClaimRefs(crossSystemFreeze, actionKey, actionType) {
  const terms = normalizeKey(`${actionKey} ${actionType}`).split("_").filter((term) => term.length > 3);
  const refs = crossSystemFreeze.cross_system_freeze_claim_rows
    .filter((row) => terms.some((term) => normalizeKey(`${row.claim_id} ${row.source_collection} ${row.source_current_verdict}`).includes(term)))
    .slice(0, 12)
    .map((row) => row.claim_id);
  return refs.length > 0 ? refs : ["claim.zendd.cross_system_freeze.documented_block"];
}

function buildRollbackTargetRows(protectedActionRows) {
  const targetMap = new Map();
  for (const row of protectedActionRows) targetMap.set(row.rollback_target, row.rollback_target_ref);
  return [...targetMap.entries()].map(([rollbackTarget, rollbackTargetRef], index) => ({
    schema_version: "zendd-protected-rollback-target-row.v1",
    phase_slot: "P727-P730",
    row_id: `zendd-protected-rollback-target.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    rollback_target: rollbackTarget,
    rollback_target_ref: rollbackTargetRef,
    rollback_target_type: rollbackTargetType(rollbackTarget),
    rollback_evidence_ref: `evidence.zendd.protected.rollback.${normalizeKey(rollbackTarget)}`,
    rollback_rehearsal_allowed_now: false,
    rollback_execution_allowed_now: false,
    recovery_receipt_ref: `receipt-template.zendd.protected_rollback.${normalizeKey(rollbackTarget)}`,
    human_receipt_ref: `receipt.zendd.protected_rollback.${normalizeKey(rollbackTarget)}`,
    current_verdict: "blocked",
    block_reason: "rollback_target_requires_evidence_and_recovery_receipt",
    responsible_owner: "integration_operator",
    next_allowed_action: "document rollback evidence and recovery receipt before rollback rehearsal or execution",
  }));
}

function buildWorkOrderRows(protectedActionRows) {
  return protectedActionRows.map((row, index) => ({
    schema_version: "zendd-protected-work-order-row.v1",
    phase_slot: "P731-P733",
    row_id: `zendd-protected-work-order.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    action_id: row.action_id,
    protected_work_order_ref: row.protected_work_order_ref,
    cross_system_freeze_ref: row.cross_system_freeze_ref,
    rollback_target_ref: row.rollback_target_ref,
    evidence_ref: row.evidence_ref,
    hard_gate_ref: row.hard_gate_ref,
    human_receipt_ref: row.human_receipt_ref,
    work_order_payload_present: false,
    work_order_validated: false,
    action_execution_allowed_now: false,
    current_verdict: "blocked",
    block_reason: "protected_work_order_payload_missing",
    responsible_owner: "integration_operator",
    next_allowed_action: "draft protected action work order with rollback target, evidence, hard gate, and human receipt",
  }));
}

function buildFailClosedRows({ protectedActionRows, rollbackTargetRows, workOrderRows, crossSystemFreeze }) {
  const rows = [
    ["missing_work_order_blocks_action", protectedActionRows.every((row) => row.protected_work_order_ref) && workOrderRows.every((row) => row.work_order_payload_present === false), "Protected actions stay blocked until work order payloads exist.", "draft protected action work orders"],
    ["missing_rollback_target_blocks_action", protectedActionRows.every((row) => row.rollback_target_ref) && rollbackTargetRows.every((row) => row.rollback_execution_allowed_now === false), "Protected actions have rollback targets and rollback execution is disabled.", "bind rollback evidence and receipt"],
    ["missing_human_receipt_blocks_action", protectedActionRows.every((row) => row.human_receipt_ref && row.recovery_receipt_ref), "Protected actions expose human and recovery receipt refs.", "collect validated human receipts"],
    ["unsafe_true_flag_blocks_action", crossSystemFreeze.summary.unsafe_true_flag_count === 0 && protectedActionRows.every((row) => row.action_allowed_now === false), "Unsafe flags are false and protected actions are disabled.", "disable unsafe protected-action flag"],
    ["receipt_application_blocked", protectedActionRows.every((row) => row.receipt_application_allowed_now === false), "Receipt application is not enabled by this tranche.", "validate receipt packet before application"],
    ["rollback_rehearsal_future_only", rollbackTargetRows.every((row) => row.rollback_rehearsal_allowed_now === false), "Rollback rehearsal remains future-only.", "document rehearsal work order before running rollback rehearsal"],
    ["physical_move_blocked_before_p741", protectedActionRows.some((row) => row.action_id === "protected-action.zendd.move_zendd_code_directory" && row.physical_code_move_allowed_now === false), "Physical Zendd code movement remains blocked until P741-P760.", "defer physical integration decision to P741-P760"],
    ["dirty_tree_mutation_blocked", protectedActionRows.some((row) => row.action_id === "protected-action.zendd.mutate_external_zendd_checkout" && row.action_allowed_now === false), "External Zendd mutation remains blocked behind dirty-tree work order.", "classify dirty rows and prepare work order receipt"],
  ];
  return rows.map(([fixtureId, passed, message, nextAllowedAction], index) => ({
    schema_version: "zendd-protected-fail-closed-fixture-row.v1",
    phase_slot: "P734-P738",
    row_id: `zendd-protected-fail-closed-fixture.row.${String(index + 1).padStart(2, "0")}`,
    fixture_id: `fixture.zendd.protected.${fixtureId}`,
    project_id: "project.zendd",
    fixture_status: passed ? "pass" : "blocked",
    protected_action_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    physical_code_move_allowed_now: false,
    message,
    next_allowed_action: passed ? "continue_to_next_protected_action_fixture" : nextAllowedAction,
  }));
}

function buildNextActionRows({ protectedActionRows, rollbackTargetRows, workOrderRows, failClosedRows }) {
  const blockedRows = [
    ...protectedActionRows.map((row) => ["protected_action", row.action_id, row.next_allowed_action]),
    ...rollbackTargetRows.map((row) => ["rollback_target", row.rollback_target_ref, row.next_allowed_action]),
    ...workOrderRows.map((row) => ["work_order", row.protected_work_order_ref, row.next_allowed_action]),
    ...failClosedRows.filter((row) => row.fixture_status !== "pass").map((row) => ["fail_closed_fixture", row.fixture_id, row.next_allowed_action]),
  ];
  return blockedRows.map(([sourceType, sourceRef, nextAllowedAction], index) => ({
    schema_version: "zendd-protected-next-action-row.v1",
    phase_slot: "P739",
    row_id: `zendd-protected-next-action.row.${String(index + 1).padStart(3, "0")}`,
    project_id: "project.zendd",
    source_type: sourceType,
    source_ref: sourceRef,
    queue_status: "pending_protected_action_evidence",
    responsible_owner: "integration_operator",
    next_allowed_action: nextAllowedAction,
    action_execution_allowed_now: false,
  }));
}

function buildCloseoutRows({ protectedActionRows, rollbackTargetRows, workOrderRows, failClosedRows, nextActionRows }) {
  const ready = protectedActionRows.every(documentedProtectedBlock)
    && rollbackTargetRows.every(documentedProtectedBlock)
    && workOrderRows.every(documentedProtectedBlock)
    && failClosedRows.every((row) => row.fixture_status === "pass")
    && nextActionRows.every((row) => row.next_allowed_action && row.action_execution_allowed_now === false);
  return [{
    schema_version: "zendd-protected-action-rollback-closeout-row.v1",
    phase_slot: "P740",
    row_id: "zendd-protected-action-rollback-closeout.p740",
    project_id: "project.zendd",
    closeout_status: ready ? "ready_for_protected_action_rollback_closeout" : "blocked",
    protected_action_row_count: protectedActionRows.length,
    rollback_target_row_count: rollbackTargetRows.length,
    work_order_row_count: workOrderRows.length,
    fail_closed_fixture_row_count: failClosedRows.length,
    next_action_row_count: nextActionRows.length,
    protected_action_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    physical_code_move_allowed_now: false,
    pass_promoted: false,
    next_integration_phase_slot: NEXT_PHASE_SLOT,
    next_allowed_action: "run physical integration decision only after protected action rollback hardening closes",
    read_only: true,
  }];
}

function buildAnchor({ packageJson, phaseLedger, crossSystemFreeze, policy, protectedActionRows, rollbackTargetRows, workOrderRows, failClosedRows, nextActionRows, closeoutRows }) {
  return {
    schema_version: "zendd-protected-action-rollback-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    cross_system_freeze_command_name: CROSS_SYSTEM_FREEZE_COMMAND_NAME,
    source_cross_system_freeze_id: crossSystemFreeze.zendd_cross_system_freeze_id,
    source_cross_system_freeze_status: crossSystemFreeze.summary.zendd_cross_system_freeze_status,
    package_json_hash: packageJson.content_hash,
    phase_ledger_hash: phaseLedger.content_hash,
    policy_hash: hashValue(policy),
    protected_action_rows_hash: hashRows(protectedActionRows, ["action_id", "rollback_target_ref", "action_allowed_now", "next_allowed_action"]),
    rollback_target_rows_hash: hashRows(rollbackTargetRows, ["rollback_target_ref", "rollback_execution_allowed_now", "next_allowed_action"]),
    work_order_rows_hash: hashRows(workOrderRows, ["protected_work_order_ref", "work_order_payload_present", "next_allowed_action"]),
    fail_closed_rows_hash: hashRows(failClosedRows, ["fixture_id", "fixture_status", "next_allowed_action"]),
    next_action_rows_hash: hashRows(nextActionRows, ["source_ref", "queue_status", "next_allowed_action"]),
    closeout_rows_hash: hashRows(closeoutRows, ["row_id", "closeout_status", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, phaseLedger, crossSystemFreeze, policy, protectedActionRows, rollbackTargetRows, workOrderRows, failClosedRows, nextActionRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  return [
    gateRow("p721_cross_system_freeze_ready", "P721", crossSystemFreeze.validation.valid && crossSystemFreeze.summary.zendd_cross_system_freeze_status === "ready_for_protected_action_rollback_hardening", "P701-P720 cross-system freeze is ready.", "repair cross-system freeze before protected action rollback"),
    gateRow("p722_policy_declared", "P722", !policy.protected_action_execution_allowed_now && !policy.rollback_execution_allowed_now && !policy.physical_code_move_allowed_now, "Protected action rollback policy disables execution.", "declare protected action rollback policy"),
    gateRow("p723_protected_actions_blocked", "P723-P726", protectedActionRows.length >= 10 && protectedActionRows.every(documentedProtectedBlock) && protectedActionRows.every((row) => row.action_allowed_now === false), "Protected action rows are documented BLOCK.", "complete protected action rows"),
    gateRow("p727_rollback_targets_blocked", "P727-P730", rollbackTargetRows.length >= 8 && rollbackTargetRows.every(documentedProtectedBlock) && rollbackTargetRows.every((row) => row.rollback_execution_allowed_now === false), "Rollback targets are documented and not executable.", "complete rollback target rows"),
    gateRow("p731_work_orders_future_only", "P731-P733", workOrderRows.length === protectedActionRows.length && workOrderRows.every((row) => row.work_order_payload_present === false && row.action_execution_allowed_now === false), "Protected work orders are declared but not materialized.", "complete protected work order rows"),
    gateRow("p734_fail_closed_fixtures_pass", "P734-P738", failClosedRows.length >= 8 && failClosedRows.every((row) => row.fixture_status === "pass"), "Fail-closed fixtures pass.", "repair fail-closed fixture rows"),
    gateRow("p739_next_actions_declared", "P739", nextActionRows.length >= protectedActionRows.length && nextActionRows.every((row) => row.next_allowed_action && row.action_execution_allowed_now === false), "Next action queue rows are declared without execution.", "complete protected action next actions"),
    gateRow("p740_closeout_ready", "P740", closeoutRows.length === 1 && closeoutRows.every((row) => row.closeout_status === "ready_for_protected_action_rollback_closeout" && !row.pass_promoted), "Protected action rollback closes without PASS promotion.", "complete protected action rollback closeout"),
    gateRow("package_script_registered", "P740", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("validate_chain_registered", "P740", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`), `${COMMAND_NAME} is included in npm run validate.`, `add ${COMMAND_NAME} to validate chain`),
    gateRow("phase_ledger_acceptance_declared", "P740", phaseLedger.available && phaseLedger.text.includes("P721-P740") && phaseLedger.text.includes(COMMAND_NAME), "P721-P740 phase ledger declares protected action rollback acceptance.", "record P721-P740 in phase ledger"),
  ];
}

function buildValidationItems({ gateRows, policy, protectedActionRows, rollbackTargetRows, workOrderRows, failClosedRows, nextActionRows, closeoutRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "protected_action_rollback_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.no_execution", "protected_action_boundary", !policy.protected_action_execution_allowed_now && !policy.rollback_execution_allowed_now && !policy.physical_code_move_allowed_now, "Protected action, rollback, and physical movement execution are disabled"));
  items.push(validationItem("protected_actions.documented_block", "protected_action_boundary", protectedActionRows.every(documentedProtectedBlock), "Protected actions are documented BLOCK"));
  items.push(validationItem("rollback_targets.documented_block", "rollback_boundary", rollbackTargetRows.every(documentedProtectedBlock), "Rollback targets are documented BLOCK"));
  items.push(validationItem("work_orders.future_only", "work_order_boundary", workOrderRows.every((row) => documentedProtectedBlock(row) && !row.work_order_payload_present && !row.work_order_validated), "Work orders are future-only"));
  items.push(validationItem("fail_closed.pass", "fixture_boundary", failClosedRows.every((row) => row.fixture_status === "pass"), "Fail-closed fixtures pass"));
  items.push(validationItem("next_actions.no_execution", "operator_boundary", nextActionRows.every((row) => row.next_allowed_action && !row.action_execution_allowed_now), "Next actions do not execute"));
  items.push(validationItem("closeout.no_promotion", "closeout_boundary", closeoutRows.every((row) => row.closeout_status === "ready_for_protected_action_rollback_closeout" && !row.pass_promoted), "Closeout does not promote PASS"));
  return items;
}

function buildSummary({ crossSystemFreeze, protectedActionRows, rollbackTargetRows, workOrderRows, failClosedRows, nextActionRows, closeoutRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_protected_action_rollback_status: validation.valid ? READY_STATUS : "documented_block_pending_protected_action_rollback",
    zendd_project_root: crossSystemFreeze.summary.zendd_project_root,
    zendd_git_head_short: crossSystemFreeze.summary.zendd_git_head_short,
    cross_system_freeze_status: crossSystemFreeze.summary.zendd_cross_system_freeze_status,
    protected_action_row_count: protectedActionRows.length,
    rollback_target_row_count: rollbackTargetRows.length,
    work_order_row_count: workOrderRows.length,
    fail_closed_fixture_row_count: failClosedRows.length,
    next_action_row_count: nextActionRows.length,
    protected_action_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    physical_code_move_allowed_now: false,
    pass_promoted: false,
    validation_error_count: validation.errors.length,
  };
}

function documentedProtectedBlock(row) {
  return row.current_verdict === "blocked" && Boolean(row.block_reason) && Boolean(row.responsible_owner) && Boolean(row.next_allowed_action);
}

function rollbackTargetType(target) {
  if (target.includes("database")) return "database_snapshot";
  if (target.includes("client")) return "client_output_state";
  if (target.includes("package") || target.includes("desktop")) return "package_state";
  if (target.includes("vdr") || target.includes("source")) return "source_of_truth_state";
  if (target.includes("receipt")) return "receipt_quarantine_state";
  return "integration_or_checkout_state";
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-protected-action-rollback-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_protected_action_rollback_gate" : nextAllowedAction,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_PROTECTED_ACTION_ROLLBACK_INPUTS.schemaPath,
    phase_ledger_path: options.phaseLedgerPath ?? DEFAULT_ZENDD_PROTECTED_ACTION_ROLLBACK_INPUTS.phaseLedgerPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_PROTECTED_ACTION_ROLLBACK_INPUTS.packagePath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_PROTECTED_ACTION_ROLLBACK_INPUTS.zenddProjectRoot,
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

Creates the P721-P740 Zendd-Hermes protected action and rollback hardening layer.
--check validates without executing protected actions, rollbacks, release commands,
database migrations, client exports, receipt applications, or physical code movement.
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
    "# Zendd Protected Action Rollback Summary",
    "",
    `- Status: ${summary.zendd_protected_action_rollback_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Zendd root: ${summary.zendd_project_root}`,
    `- Zendd HEAD: ${summary.zendd_git_head_short ?? "unavailable"}`,
    `- Protected actions: ${summary.protected_action_row_count}`,
    `- Rollback targets: ${summary.rollback_target_row_count}`,
    `- Work orders: ${summary.work_order_row_count}`,
    `- Fail-closed fixtures: ${summary.fail_closed_fixture_row_count}`,
    `- Next actions: ${summary.next_action_row_count}`,
    `- Execution allowed: ${summary.protected_action_execution_allowed_now}`,
    `- PASS promoted: ${summary.pass_promoted}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "## Next Action",
    "",
    "Run the physical integration decision tranche only after protected action and rollback hardening closes.",
    "",
  ].join("\n");
}
