import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddProtectedActionRollback } from "./zendd-protected-action-rollback.mjs";

export const DEFAULT_ZENDD_PHYSICAL_INTEGRATION_DECISION_OUT_DIR = "artifacts/zendd-physical-integration-decision/latest";
export const DEFAULT_ZENDD_PHYSICAL_INTEGRATION_DECISION_INPUTS = {
  schemaPath: "schemas/zendd-physical-integration-decision.schema.json",
  phaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  packagePath: "package.json",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-physical-integration-decision";
const PROTECTED_ACTION_ROLLBACK_COMMAND_NAME = "project:zendd-protected-action-rollback";
const SCHEMA_VERSION = "zendd-physical-integration-decision.v1";
const CAPABILITY_ID = "project.zendd.physical_integration_decision";
const PHASE_RANGE = "P741-P760";
const PHASE_SLOT = "P741";
const PREVIOUS_PHASE_SLOT = "P740";
const NEXT_PHASE_SLOT = "P761";
const READY_STATUS = "external_adapter_selected_for_safe_operation";

export async function runZenddPhysicalIntegrationDecision(options = {}) {
  const result = await buildZenddPhysicalIntegrationDecision(options);
  if (options.write !== false) await writeZenddPhysicalIntegrationDecision(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd physical integration decision failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddPhysicalIntegrationDecision(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_PHYSICAL_INTEGRATION_DECISION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const phaseLedger = await readTextSource(inputs.phase_ledger_path);
  const protectedActionRollback = await buildZenddProtectedActionRollback({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    phaseLedgerPath: inputs.phase_ledger_path,
    write: false,
  });
  const policy = buildPhysicalIntegrationPolicy(generatedAt);
  const optionRows = buildIntegrationOptionRows(protectedActionRollback);
  const evidenceRows = buildEvidenceComparisonRows(optionRows, protectedActionRollback);
  const movementBlockRows = buildMovementBlockRows(optionRows);
  const operatingModeRows = buildOperatingModeRows(optionRows, protectedActionRollback);
  const nextActionRows = buildNextActionRows({ optionRows, movementBlockRows, operatingModeRows });
  const closeoutRows = buildCloseoutRows({ optionRows, evidenceRows, movementBlockRows, operatingModeRows, nextActionRows });
  const anchor = buildAnchor({ packageJson, phaseLedger, protectedActionRollback, policy, optionRows, evidenceRows, movementBlockRows, operatingModeRows, nextActionRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, phaseLedger, protectedActionRollback, policy, optionRows, evidenceRows, movementBlockRows, operatingModeRows, nextActionRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, policy, optionRows, evidenceRows, movementBlockRows, operatingModeRows, nextActionRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ protectedActionRollback, optionRows, evidenceRows, movementBlockRows, operatingModeRows, nextActionRows, closeoutRows, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_physical_integration_decision_id: `zendd-physical-integration-decision.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    physical_integration_decision_anchor: anchor,
    protected_action_rollback_summary: protectedActionRollback.summary,
    physical_integration_policy: policy,
    integration_option_rows: optionRows,
    evidence_comparison_rows: evidenceRows,
    physical_movement_block_rows: movementBlockRows,
    operating_mode_rows: operatingModeRows,
    next_action_rows: nextActionRows,
    physical_integration_closeout_rows: closeoutRows,
    physical_integration_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_physical_integration_decision")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ protectedActionRollback, optionRows, evidenceRows, movementBlockRows, operatingModeRows, nextActionRows, closeoutRows, validation: result.validation });
  result.summary.zendd_physical_integration_decision_id = result.zendd_physical_integration_decision_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddPhysicalIntegrationDecision(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-physical-integration-decision.json"), serializableResult(result));
  await writeJson(path.join(outDir, "physical-integration-policy.json"), result.physical_integration_policy);
  await writeJson(path.join(outDir, "integration-option-rows.json"), collectionEnvelope("zendd-integration-option-rows.v1", "integration_option_rows", result.integration_option_rows, result.generated_at));
  await writeJson(path.join(outDir, "evidence-comparison-rows.json"), collectionEnvelope("zendd-evidence-comparison-rows.v1", "evidence_comparison_rows", result.evidence_comparison_rows, result.generated_at));
  await writeJson(path.join(outDir, "physical-movement-block-rows.json"), collectionEnvelope("zendd-physical-movement-block-rows.v1", "physical_movement_block_rows", result.physical_movement_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "operating-mode-rows.json"), collectionEnvelope("zendd-operating-mode-rows.v1", "operating_mode_rows", result.operating_mode_rows, result.generated_at));
  await writeJson(path.join(outDir, "next-action-rows.json"), collectionEnvelope("zendd-physical-integration-next-action-rows.v1", "next_action_rows", result.next_action_rows, result.generated_at));
  await writeJson(path.join(outDir, "physical-integration-closeout-rows.json"), collectionEnvelope("zendd-physical-integration-closeout-rows.v1", "physical_integration_closeout_rows", result.physical_integration_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "physical-integration-gate-rows.json"), collectionEnvelope("zendd-physical-integration-gate-rows.v1", "physical_integration_gate_rows", result.physical_integration_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-physical-integration-decision-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddPhysicalIntegrationDecisionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddPhysicalIntegrationDecision(args);
    console.log(`Zendd physical integration decision ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_physical_integration_decision_status}`);
    console.log(`Zendd path: ${result.summary.zendd_project_root}`);
    console.log(`Selected mode: ${result.summary.selected_integration_mode}`);
    console.log(`Integration options: ${result.summary.integration_option_row_count}`);
    console.log(`Blocked movement options: ${result.summary.blocked_movement_option_count}`);
    console.log(`Physical movement allowed: ${result.summary.physical_code_move_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPhysicalIntegrationPolicy(generatedAt) {
  return {
    schema_version: "zendd-physical-integration-policy.v1",
    phase_slot: PHASE_SLOT,
    project_id: "project.zendd",
    selected_integration_mode: "external_project_adapter",
    physical_code_move_allowed_now: false,
    subtree_allowed_now: false,
    submodule_allowed_now: false,
    workspace_move_allowed_now: false,
    monorepo_directory_move_allowed_now: false,
    raw_project_copy_allowed_now: false,
    external_adapter_write_allowed_now: false,
    selected_mode_requires: ["protected_action_rollback_ref", "cross_system_freeze_ref", "boundary_evidence_ref", "rollback_target_ref", "operator_next_action_ref"],
    rejected_modes_require: ["block_reason", "responsible_owner", "next_allowed_action"],
    next_allowed_action: "operate Zendd through the external adapter until a future evidence-backed migration work order proves a physical move safer",
    created_at: generatedAt,
  };
}

function buildIntegrationOptionRows(protectedActionRollback) {
  const sourceRef = protectedActionRollback.zendd_protected_action_rollback_id;
  const rows = [
    ["external_project_adapter", "Keep Zendd in its current external checkout and bridge it through Hermes adapters", true, "pass", "selected_external_adapter_has_freeze_and_rollback_evidence", "continue operating through external adapter"],
    ["git_submodule", "Import Zendd as a git submodule", false, "blocked", "submodule_governance_and_rollback_evidence_missing", "prepare submodule-specific rollback and ownership evidence before reconsidering"],
    ["git_subtree", "Import Zendd as a git subtree", false, "blocked", "subtree_history_and_conflict_evidence_missing", "prepare subtree conflict, history, and rollback evidence before reconsidering"],
    ["workspace_link", "Attach Zendd through workspace or symlink style linkage", false, "blocked", "workspace_boundary_and_secret_evidence_missing", "prove workspace boundary and secret isolation before reconsidering"],
    ["monorepo_directory_move", "Move Zendd code directory under Hermes", false, "blocked", "physical_directory_move_protected_and_not_safer_than_adapter", "defer physical directory movement until migration work order proves safer"],
    ["raw_project_copy", "Copy Zendd source or raw project files into Hermes", false, "blocked", "raw_project_copy_forbidden_by_boundary", "keep Zendd source of truth external and reference-only"],
    ["hybrid_adapter_with_future_work_orders", "Keep external adapter while future work orders may patch Zendd intentionally", false, "blocked", "future_work_order_receipts_missing", "create scoped protected work orders before mutating Zendd"],
  ];
  return rows.map(([mode, description, selected, verdict, reason, nextAllowedAction], index) => ({
    schema_version: "zendd-integration-option-row.v1",
    phase_slot: "P742-P745",
    row_id: `zendd-integration-option.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    integration_mode: mode,
    option_description: description,
    selected,
    decision_verdict: verdict,
    protected_action_rollback_ref: sourceRef,
    boundary_evidence_ref: `evidence.zendd.integration.${mode}.boundary`,
    rollback_target_ref: selected ? "rollback-target.zendd.protected.external_project_adapter" : `rollback-target.zendd.integration.${mode}`,
    hard_gate_ref: `hard-gate.zendd.integration.${mode}`,
    reviewer_ref: "reviewer.integration_operator",
    human_receipt_ref: selected ? null : `receipt.zendd.integration.${mode}`,
    physical_code_move_required: mode !== "external_project_adapter" && mode !== "hybrid_adapter_with_future_work_orders",
    physical_code_move_allowed_now: false,
    current_verdict: verdict,
    block_reason: verdict === "blocked" ? reason : null,
    responsible_owner: "integration_operator",
    next_allowed_action: nextAllowedAction,
  }));
}

function buildEvidenceComparisonRows(optionRows, protectedActionRollback) {
  const selected = optionRows.find((row) => row.selected);
  const factors = [
    ["boundary_preservation", "External adapter preserves source, secret, and raw-material boundaries better than physical movement."],
    ["rollback_simplicity", "External adapter rollback is the current safe target and does not require repo topology surgery."],
    ["dirty_tree_safety", "Current Zendd dirty-tree rows remain classified without mutating the external checkout."],
    ["receipt_boundary", "Protected actions still require work orders and receipts before any Zendd mutation."],
    ["operator_visibility", "Hermes can surface block reasons and next actions without becoming Zendd source of truth."],
    ["migration_evidence_gap", "Submodule, subtree, workspace, and directory move options lack migration-specific evidence."],
  ];
  return factors.map(([factorId, message], index) => ({
    schema_version: "zendd-evidence-comparison-row.v1",
    phase_slot: "P746-P750",
    row_id: `zendd-evidence-comparison.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    comparison_factor: factorId,
    selected_integration_mode: selected.integration_mode,
    selected_mode_evidence_ref: selected.boundary_evidence_ref,
    protected_action_rollback_ref: protectedActionRollback.zendd_protected_action_rollback_id,
    comparison_status: "pass",
    message,
    next_allowed_action: "keep external adapter selected unless future migration evidence changes the safety comparison",
  }));
}

function buildMovementBlockRows(optionRows) {
  return optionRows.filter((row) => row.physical_code_move_required || row.integration_mode === "raw_project_copy" || row.integration_mode === "hybrid_adapter_with_future_work_orders")
    .map((row, index) => ({
      schema_version: "zendd-physical-movement-block-row.v1",
      phase_slot: "P751-P754",
      row_id: `zendd-physical-movement-block.row.${String(index + 1).padStart(2, "0")}`,
      project_id: "project.zendd",
      integration_mode: row.integration_mode,
      option_ref: row.row_id,
      movement_or_mutation_allowed_now: false,
      physical_code_move_allowed_now: false,
      raw_project_copy_allowed_now: false,
      receipt_required: true,
      rollback_target_ref: row.rollback_target_ref,
      current_verdict: "blocked",
      block_reason: row.block_reason ?? "future_work_order_receipts_missing",
      responsible_owner: "integration_operator",
      next_allowed_action: row.next_allowed_action,
    }));
}

function buildOperatingModeRows(optionRows, protectedActionRollback) {
  const selected = optionRows.find((row) => row.selected);
  return [{
    schema_version: "zendd-operating-mode-row.v1",
    phase_slot: "P755-P758",
    row_id: "zendd-operating-mode.external-adapter",
    project_id: "project.zendd",
    selected_integration_mode: selected.integration_mode,
    operating_mode_status: "selected",
    protected_action_rollback_ref: protectedActionRollback.zendd_protected_action_rollback_id,
    external_adapter_active: true,
    hermes_controls_zendd_by_reference: true,
    zendd_code_directory_moved: false,
    raw_project_copy_allowed_now: false,
    protected_work_orders_required_for_mutation: true,
    operator_next_action_ref: "next-action.zendd.integration.external_adapter",
    next_allowed_action: "use external adapter and protected work orders for future Zendd development",
  }];
}

function buildNextActionRows({ optionRows, movementBlockRows, operatingModeRows }) {
  const rows = [
    ...optionRows.filter((row) => row.decision_verdict === "blocked").map((row) => ["integration_option", row.integration_mode, row.next_allowed_action]),
    ...movementBlockRows.map((row) => ["movement_block", row.integration_mode, row.next_allowed_action]),
    ...operatingModeRows.map((row) => ["operating_mode", row.selected_integration_mode, row.next_allowed_action]),
  ];
  return rows.map(([sourceType, sourceRef, nextAllowedAction], index) => ({
    schema_version: "zendd-physical-integration-next-action-row.v1",
    phase_slot: "P759",
    row_id: `zendd-physical-integration-next-action.row.${String(index + 1).padStart(2, "0")}`,
    project_id: "project.zendd",
    source_type: sourceType,
    source_ref: sourceRef,
    queue_status: "pending_future_evidence_or_operation",
    responsible_owner: "integration_operator",
    next_allowed_action: nextAllowedAction,
    physical_code_move_allowed_now: false,
  }));
}

function buildCloseoutRows({ optionRows, evidenceRows, movementBlockRows, operatingModeRows, nextActionRows }) {
  const selectedRows = optionRows.filter((row) => row.selected);
  const ready = selectedRows.length === 1
    && selectedRows[0].integration_mode === "external_project_adapter"
    && selectedRows[0].decision_verdict === "pass"
    && optionRows.filter((row) => !row.selected).every(documentedBlock)
    && evidenceRows.every((row) => row.comparison_status === "pass")
    && movementBlockRows.every(documentedBlock)
    && operatingModeRows.every((row) => row.external_adapter_active && !row.zendd_code_directory_moved)
    && nextActionRows.every((row) => row.next_allowed_action && row.physical_code_move_allowed_now === false);
  return [{
    schema_version: "zendd-physical-integration-closeout-row.v1",
    phase_slot: "P760",
    row_id: "zendd-physical-integration-closeout.p760",
    project_id: "project.zendd",
    closeout_status: ready ? "ready_for_external_adapter_operation" : "blocked",
    selected_integration_mode: selectedRows[0]?.integration_mode ?? null,
    integration_option_row_count: optionRows.length,
    blocked_movement_option_count: movementBlockRows.length,
    evidence_comparison_row_count: evidenceRows.length,
    operating_mode_row_count: operatingModeRows.length,
    next_action_row_count: nextActionRows.length,
    physical_code_move_allowed_now: false,
    subtree_allowed_now: false,
    submodule_allowed_now: false,
    workspace_move_allowed_now: false,
    monorepo_directory_move_allowed_now: false,
    raw_project_copy_allowed_now: false,
    external_adapter_selected: true,
    pass_promoted_for_physical_move: false,
    next_integration_phase_slot: NEXT_PHASE_SLOT,
    next_allowed_action: "operate through external adapter; future physical movement requires a new evidence-backed migration work order",
    read_only: true,
  }];
}

function buildAnchor({ packageJson, phaseLedger, protectedActionRollback, policy, optionRows, evidenceRows, movementBlockRows, operatingModeRows, nextActionRows, closeoutRows }) {
  return {
    schema_version: "zendd-physical-integration-decision-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    protected_action_rollback_command_name: PROTECTED_ACTION_ROLLBACK_COMMAND_NAME,
    source_protected_action_rollback_id: protectedActionRollback.zendd_protected_action_rollback_id,
    source_protected_action_rollback_status: protectedActionRollback.summary.zendd_protected_action_rollback_status,
    package_json_hash: packageJson.content_hash,
    phase_ledger_hash: phaseLedger.content_hash,
    policy_hash: hashValue(policy),
    option_rows_hash: hashRows(optionRows, ["integration_mode", "selected", "decision_verdict", "next_allowed_action"]),
    evidence_rows_hash: hashRows(evidenceRows, ["comparison_factor", "comparison_status", "next_allowed_action"]),
    movement_block_rows_hash: hashRows(movementBlockRows, ["integration_mode", "current_verdict", "block_reason", "next_allowed_action"]),
    operating_mode_rows_hash: hashRows(operatingModeRows, ["selected_integration_mode", "external_adapter_active", "zendd_code_directory_moved"]),
    next_action_rows_hash: hashRows(nextActionRows, ["source_ref", "queue_status", "next_allowed_action"]),
    closeout_rows_hash: hashRows(closeoutRows, ["row_id", "closeout_status", "selected_integration_mode", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, phaseLedger, protectedActionRollback, policy, optionRows, evidenceRows, movementBlockRows, operatingModeRows, nextActionRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  return [
    gateRow("p741_protected_action_rollback_ready", "P741", protectedActionRollback.validation.valid && protectedActionRollback.summary.zendd_protected_action_rollback_status === "ready_for_physical_integration_decision", "P721-P740 protected action rollback is ready.", "repair protected action rollback before physical integration decision"),
    gateRow("p742_policy_selects_external_adapter", "P742", policy.selected_integration_mode === "external_project_adapter" && !policy.physical_code_move_allowed_now, "Physical integration policy selects external adapter and blocks movement.", "declare external adapter decision policy"),
    gateRow("p743_option_matrix_complete", "P743-P745", optionRows.length >= 7 && optionRows.filter((row) => row.selected).length === 1, "Integration option matrix is complete with one selected mode.", "complete integration option matrix"),
    gateRow("p746_evidence_comparison_passes", "P746-P750", evidenceRows.length >= 6 && evidenceRows.every((row) => row.comparison_status === "pass"), "Evidence comparison favors the external adapter.", "complete evidence comparison rows"),
    gateRow("p751_physical_movement_blocked", "P751-P754", movementBlockRows.length >= 5 && movementBlockRows.every(documentedBlock) && movementBlockRows.every((row) => !row.physical_code_move_allowed_now), "Physical movement options are documented BLOCK.", "complete physical movement block rows"),
    gateRow("p755_operating_mode_selected", "P755-P758", operatingModeRows.length === 1 && operatingModeRows[0].external_adapter_active && !operatingModeRows[0].zendd_code_directory_moved, "External adapter operating mode is selected without moving Zendd.", "complete external adapter operating mode row"),
    gateRow("p759_next_actions_declared", "P759", nextActionRows.length >= movementBlockRows.length && nextActionRows.every((row) => row.next_allowed_action && !row.physical_code_move_allowed_now), "Next actions are declared without movement.", "complete physical integration next actions"),
    gateRow("p760_closeout_ready", "P760", closeoutRows.length === 1 && closeoutRows.every((row) => row.closeout_status === "ready_for_external_adapter_operation" && row.external_adapter_selected && !row.pass_promoted_for_physical_move), "Physical integration decision closes with external adapter selected.", "complete physical integration closeout"),
    gateRow("package_script_registered", "P760", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("validate_chain_registered", "P760", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`), `${COMMAND_NAME} is included in npm run validate.`, `add ${COMMAND_NAME} to validate chain`),
    gateRow("phase_ledger_acceptance_declared", "P760", phaseLedger.available && phaseLedger.text.includes("P741-P760") && phaseLedger.text.includes(COMMAND_NAME), "P741-P760 phase ledger declares physical integration acceptance.", "record P741-P760 in phase ledger"),
  ];
}

function buildValidationItems({ gateRows, policy, optionRows, evidenceRows, movementBlockRows, operatingModeRows, nextActionRows, closeoutRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "physical_integration_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.no_physical_move", "movement_boundary", !policy.physical_code_move_allowed_now && !policy.monorepo_directory_move_allowed_now && !policy.raw_project_copy_allowed_now, "Policy blocks physical movement and raw copy"));
  items.push(validationItem("option.selected_external_adapter", "decision_boundary", optionRows.filter((row) => row.selected && row.integration_mode === "external_project_adapter" && row.decision_verdict === "pass").length === 1, "External adapter is the selected PASS option"));
  items.push(validationItem("options.blocked_have_next_action", "block_boundary", optionRows.filter((row) => !row.selected).every(documentedBlock), "Rejected options are documented BLOCK"));
  items.push(validationItem("movement.blocked", "movement_boundary", movementBlockRows.every((row) => documentedBlock(row) && !row.physical_code_move_allowed_now && !row.raw_project_copy_allowed_now), "Physical movement rows are blocked"));
  items.push(validationItem("operating_mode.external_adapter", "operating_mode_boundary", operatingModeRows.every((row) => row.external_adapter_active && !row.zendd_code_directory_moved), "Operating mode keeps Zendd external"));
  items.push(validationItem("next_actions.no_move", "operator_boundary", nextActionRows.every((row) => row.next_allowed_action && !row.physical_code_move_allowed_now), "Next action rows do not move code"));
  items.push(validationItem("closeout.external_adapter", "closeout_boundary", closeoutRows.every((row) => row.closeout_status === "ready_for_external_adapter_operation" && row.external_adapter_selected && !row.pass_promoted_for_physical_move), "Closeout selects external adapter without physical move PASS"));
  return items;
}

function buildSummary({ protectedActionRollback, optionRows, evidenceRows, movementBlockRows, operatingModeRows, nextActionRows, closeoutRows, validation }) {
  const selected = optionRows.find((row) => row.selected);
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_physical_integration_decision_status: validation.valid ? READY_STATUS : "documented_block_pending_physical_integration_decision",
    zendd_project_root: protectedActionRollback.summary.zendd_project_root,
    zendd_git_head_short: protectedActionRollback.summary.zendd_git_head_short,
    protected_action_rollback_status: protectedActionRollback.summary.zendd_protected_action_rollback_status,
    selected_integration_mode: selected?.integration_mode ?? null,
    integration_option_row_count: optionRows.length,
    evidence_comparison_row_count: evidenceRows.length,
    blocked_movement_option_count: movementBlockRows.length,
    operating_mode_row_count: operatingModeRows.length,
    next_action_row_count: nextActionRows.length,
    physical_code_move_allowed_now: false,
    subtree_allowed_now: false,
    submodule_allowed_now: false,
    workspace_move_allowed_now: false,
    monorepo_directory_move_allowed_now: false,
    raw_project_copy_allowed_now: false,
    external_adapter_selected: true,
    pass_promoted_for_physical_move: false,
    validation_error_count: validation.errors.length,
  };
}

function documentedBlock(row) {
  return row.current_verdict === "blocked" && Boolean(row.block_reason) && Boolean(row.responsible_owner) && Boolean(row.next_allowed_action);
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-physical-integration-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_physical_integration_gate" : nextAllowedAction,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_PHYSICAL_INTEGRATION_DECISION_INPUTS.schemaPath,
    phase_ledger_path: options.phaseLedgerPath ?? DEFAULT_ZENDD_PHYSICAL_INTEGRATION_DECISION_INPUTS.phaseLedgerPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_PHYSICAL_INTEGRATION_DECISION_INPUTS.packagePath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_PHYSICAL_INTEGRATION_DECISION_INPUTS.zenddProjectRoot,
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

Creates the P741-P760 Zendd-Hermes physical integration decision.
--check validates without moving Zendd code, creating submodules/subtrees,
copying raw project files, mutating Zendd, applying receipts, or promoting
physical movement PASS.
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
    "# Zendd Physical Integration Decision Summary",
    "",
    `- Status: ${summary.zendd_physical_integration_decision_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Zendd root: ${summary.zendd_project_root}`,
    `- Zendd HEAD: ${summary.zendd_git_head_short ?? "unavailable"}`,
    `- Selected mode: ${summary.selected_integration_mode}`,
    `- Integration options: ${summary.integration_option_row_count}`,
    `- Blocked movement options: ${summary.blocked_movement_option_count}`,
    `- Physical movement allowed: ${summary.physical_code_move_allowed_now}`,
    `- External adapter selected: ${summary.external_adapter_selected}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "## Decision",
    "",
    "Keep Zendd in the external checkout and operate through the Hermes external-project adapter. Future physical movement requires a new evidence-backed migration work order.",
    "",
  ].join("\n");
}
