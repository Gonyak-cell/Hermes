import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS,
  buildPlatformOperationsFreezeReceiptChainRegression,
} from "./platform-operations-freeze-receipt-chain-regression.mjs";

export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_OUT_DIR = "artifacts/platform-operations-freeze-closeout/latest";
export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS,
  operationsFreezeReceiptChainRegressionSchemaPath: DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.schemaPath,
  schemaPath: "schemas/platform-operations-freeze-closeout.schema.json",
};

const COMMAND_NAME = "platform:operations-freeze-closeout";
const SCHEMA_VERSION = "platform-operations-freeze-closeout.v1";
const CAPABILITY_ID = "platform.operations_freeze_closeout";
const PHASE_SLOT = "P500";
const PREVIOUS_PHASE_SLOT = "P499";
const NEXT_PHASE_SLOT = "complete";
const SOURCE_READY_STATUS = "ready_for_operations_freeze_receipt_chain_regression";
const CLOSEOUT_READY_STATUS = "ready_for_platform_operations_stability_closeout";
const CLOSEOUT_LANES = [
  ["p341_p480_source_inventory", "P481 source inventory proves every P341-P480 source is complete or explicitly human-gated."],
  ["acceptance_command_matrix", "P482 command matrix registers all seven P481-P500 acceptance commands without execution."],
  ["evidence_and_review_chain", "P483-P485 evidence, review, and signoff rows remain human-reviewed and non-mutating."],
  ["signoff_receipt_chain", "P486-P489 signoff receipt readiness remains pending external human receipts."],
  ["receipt_workspace_chain", "P490-P494 receipt queue, workspace, merge, and preflight rows remain payload-free."],
  ["approval_closeout_chain", "P495-P498 validation packet, approval plan, approval closeout, and receipt closeout remain declarative."],
  ["chain_regression_handoff", "P499 receipt-chain regression is ready for final program closeout."],
].map(([laneKey, description]) => ({ laneKey, description }));

export async function runPlatformOperationsFreezeCloseout(options = {}) {
  const result = await buildPlatformOperationsFreezeCloseout(options);
  if (options.write !== false) await writePlatformOperationsFreezeCloseout(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operations freeze closeout failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperationsFreezeCloseout(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const chainRegression = await buildPlatformOperationsFreezeReceiptChainRegression({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    operationsFreezeSourceInventorySchemaPath: inputs.operations_freeze_source_inventory_schema_path,
    operationsFreezeCommandMatrixSchemaPath: inputs.operations_freeze_command_matrix_schema_path,
    operationsFreezeEvidenceIndexSchemaPath: inputs.operations_freeze_evidence_index_schema_path,
    operationsFreezeReviewPacketSchemaPath: inputs.operations_freeze_review_packet_schema_path,
    operationsFreezeSignoffLedgerSchemaPath: inputs.operations_freeze_signoff_ledger_schema_path,
    operationsFreezeSignoffReceiptTemplateSchemaPath: inputs.operations_freeze_signoff_receipt_template_schema_path,
    operationsFreezeSignoffReceiptIntakeSchemaPath: inputs.operations_freeze_signoff_receipt_intake_schema_path,
    operationsFreezeSignoffCloseoutSchemaPath: inputs.operations_freeze_signoff_closeout_schema_path,
    operationsFreezeStatusLedgerSchemaPath: inputs.operations_freeze_status_ledger_schema_path,
    operationsFreezeReceiptQueueSchemaPath: inputs.operations_freeze_receipt_queue_schema_path,
    operationsFreezeReceiptValidationRulesSchemaPath: inputs.operations_freeze_receipt_validation_rules_schema_path,
    operationsFreezeReceiptWorkspaceSchemaPath: inputs.operations_freeze_receipt_workspace_schema_path,
    operationsFreezeReceiptWorkspaceMergeSchemaPath: inputs.operations_freeze_receipt_workspace_merge_schema_path,
    operationsFreezeReceiptValidationPacketSchemaPath: inputs.operations_freeze_receipt_validation_packet_schema_path,
    operationsFreezeReceiptApprovalPlanSchemaPath: inputs.operations_freeze_receipt_approval_plan_schema_path,
    operationsFreezeReceiptApprovalCloseoutSchemaPath: inputs.operations_freeze_receipt_approval_closeout_schema_path,
    operationsFreezeReceiptCloseoutSchemaPath: inputs.operations_freeze_receipt_closeout_schema_path,
    schemaPath: inputs.operations_freeze_receipt_chain_regression_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const closeoutRows = buildCloseoutRows(chainRegression);
  const boundary = buildBoundary({ generatedAt, writeRequested: options.write !== false, chainRegression, closeoutRows });
  const anchor = buildAnchor({ chainRegression, packageJson, platformOpsLedger, closeoutRows });
  const gateRows = buildGateRows({ chainRegression, packageJson, platformOpsLedger, closeoutRows, boundary });
  const validationItems = buildValidationItems({ chainRegression, packageJson, platformOpsLedger, closeoutRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ chainRegression, closeoutRows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operations_freeze_closeout_id: `platform-operations-freeze-closeout.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operations_freeze_closeout_anchor: anchor,
    operations_freeze_closeout_rows: closeoutRows,
    operations_freeze_closeout_gate_rows: gateRows,
    operations_freeze_closeout_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operations_freeze_closeout") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ chainRegression, closeoutRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_operations_freeze_closeout_id = result.platform_operations_freeze_closeout_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperationsFreezeCloseout(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-operations-freeze-closeout.json"), serializableResult(result));
  await writeJson(path.join(outDir, "operations-freeze-closeout-rows.json"), collectionEnvelope("platform-operations-freeze-closeout-rows.v1", "operations_freeze_closeout_rows", result.operations_freeze_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "operations-freeze-closeout-gate-rows.json"), collectionEnvelope("platform-operations-freeze-closeout-gate-rows.v1", "operations_freeze_closeout_gate_rows", result.operations_freeze_closeout_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "operations-freeze-closeout-boundary.json"), result.operations_freeze_closeout_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operations-freeze-closeout-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperationsFreezeCloseoutCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperationsFreezeCloseout(args);
    console.log(`Platform operations freeze closeout ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operations_freeze_closeout_status}`);
    console.log(`Closeout rows: ${result.summary.ready_closeout_row_count}/${result.summary.closeout_row_count}`);
    console.log(`Closeout gates: ${result.summary.ready_closeout_gate_count}/${result.summary.closeout_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildAnchor({ chainRegression, packageJson, platformOpsLedger, closeoutRows }) {
  return {
    schema_version: "platform-operations-freeze-closeout-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_chain_regression_id: chainRegression.platform_operations_freeze_receipt_chain_regression_id,
    source_receipt_chain_regression_status: chainRegression.summary.platform_operations_freeze_receipt_chain_regression_status,
    source_receipt_chain_regression_hash: hashValue({
      id: chainRegression.platform_operations_freeze_receipt_chain_regression_id,
      status: chainRegression.summary.platform_operations_freeze_receipt_chain_regression_status,
      chain_phase_count: chainRegression.summary.chain_phase_count,
      ready_chain_phase_count: chainRegression.summary.ready_chain_phase_count,
    }),
    package_json_hash: packageJson.content_hash,
    platform_ops_ledger_hash: platformOpsLedger.content_hash,
    closeout_rows_hash: hashValue(closeoutRows.map((row) => ({
      lane_key: row.closeout_lane_key,
      closeout_status: row.closeout_status,
    }))),
  };
}

function buildCloseoutRows(chainRegression) {
  const sourceReady = chainRegression.validation.valid && chainRegression.summary.platform_operations_freeze_receipt_chain_regression_status === SOURCE_READY_STATUS;
  return CLOSEOUT_LANES.map((lane, index) => {
    const row = {
      schema_version: "platform-operations-freeze-closeout-row.v1",
      operations_freeze_closeout_row_id: `platform-operations-freeze-closeout.row.${lane.laneKey}`,
      phase_slot: PHASE_SLOT,
      closeout_lane_key: lane.laneKey,
      description: lane.description,
      closeout_status: sourceReady ? CLOSEOUT_READY_STATUS : "blocked",
      source_receipt_chain_regression_status: chainRegression.summary.platform_operations_freeze_receipt_chain_regression_status,
      source_chain_phase_count: chainRegression.summary.chain_phase_count,
      source_ready_chain_phase_count: chainRegression.summary.ready_chain_phase_count,
      closeout_declared: true,
      human_review_required: true,
      human_signoff_required: true,
      human_receipts_pending: true,
      p341_p500_program_ready: sourceReady,
      receipt_payload_present: false,
      ready_for_validation: false,
      ready_for_approval_application: false,
      receipt_received_by_closeout: false,
      receipt_validated_by_closeout: false,
      signoff_completed_by_closeout: false,
      approval_applied_by_closeout: false,
      acceptance_command_execution_performed_by_closeout: false,
      generated_artifact_read_performed_by_closeout: false,
      artifact_write_performed_by_closeout: false,
      dependency_install_performed_by_closeout: false,
      package_mutation_performed_by_closeout: false,
      lockfile_mutation_performed_by_closeout: false,
      release_published_by_closeout: false,
      git_operation_performed_by_closeout: false,
      protected_action_executed_by_closeout: false,
      protected_recovery_execution_allowed_by_closeout: false,
      trading_live_enabled_by_closeout: false,
      trading_full_auto_enabled_by_closeout: false,
      trading_order_submission_allowed_by_closeout: false,
      broker_write_allowed_by_closeout: false,
      exchange_write_allowed_by_closeout: false,
      desktop_source_of_truth_by_closeout: false,
      desktop_mutation_allowed_by_closeout: false,
      secret_exposure_allowed_by_closeout: false,
      secret_values_read_by_closeout: false,
      env_file_read_by_closeout: false,
      desktop_config_content_inspected_by_closeout: false,
      desktop_provider_key_visible_by_closeout: false,
      credential_lookup_allowed_by_closeout: false,
    };
    return withOrdinalAndHash(row, index, "operations_freeze_closeout_row_hash");
  });
}

function buildBoundary({ generatedAt, writeRequested, chainRegression, closeoutRows }) {
  const sourceReady = chainRegression.validation.valid && chainRegression.summary.platform_operations_freeze_receipt_chain_regression_status === SOURCE_READY_STATUS;
  const readyRows = closeoutRows.filter((row) => row.closeout_status === CLOSEOUT_READY_STATUS).length;
  return {
    schema_version: "platform-operations-freeze-closeout-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    closeout_artifact_write_requested: writeRequested,
    source_receipt_chain_regression_status: chainRegression.summary.platform_operations_freeze_receipt_chain_regression_status,
    source_receipt_chain_regression_ready: sourceReady,
    closeout_row_count: closeoutRows.length,
    ready_closeout_row_count: readyRows,
    closeout_declared: true,
    p341_p500_program_ready: sourceReady && readyRows === CLOSEOUT_LANES.length,
    human_receipts_pending: true,
    final_program_phase: true,
    receipt_payload_present: false,
    ready_for_validation: false,
    ready_for_approval_application: false,
    receipt_received: false,
    receipt_validated: false,
    signoff_completed: false,
    approval_applied: false,
    command_execution_performed: false,
    package_command_execution_performed: false,
    acceptance_command_execution_performed: false,
    generated_artifact_read_performed: false,
    artifact_read_performed: false,
    artifact_write_performed: false,
    dependency_install_performed: false,
    package_mutation_performed: false,
    lockfile_mutation_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    protected_recovery_execution_allowed: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    desktop_source_of_truth: false,
    desktop_mutation_allowed: false,
    secret_exposure_allowed: false,
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    desktop_provider_key_visible: false,
    credential_lookup_allowed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildGateRows({ chainRegression, packageJson, platformOpsLedger, closeoutRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p499_chain_regression_ready", "P499 operations freeze receipt-chain regression source is ready.", chainRegression.validation.valid && chainRegression.summary.platform_operations_freeze_receipt_chain_regression_status === SOURCE_READY_STATUS && chainRegression.summary.ready_chain_phase_count === 18),
    gateRow("platform_package_script_registered", "package.json registers the P500 operations freeze closeout command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P500 operations freeze closeout command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p500_ledger_acceptance_declared", "P500 acceptance row is declared in the platform operations ledger.", ledgerText.includes(`P500: \`${COMMAND_NAME}\``)),
    gateRow("closeout_rows_ready", "All platform operations freeze closeout lanes are ready.", closeoutRows.length === CLOSEOUT_LANES.length && closeoutRows.every((row) => row.closeout_status === CLOSEOUT_READY_STATUS && row.closeout_declared && row.p341_p500_program_ready && !row.receipt_payload_present && !row.approval_applied_by_closeout && !row.secret_exposure_allowed_by_closeout)),
    gateRow("human_receipts_remain_pending", "P500 does not claim or apply human receipts.", boundary.human_receipts_pending && !boundary.receipt_payload_present && !boundary.receipt_received && !boundary.receipt_validated && !boundary.signoff_completed && !boundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "P500 executes no commands, reads/writes no generated artifacts, mutates no packages/lockfiles/dependencies, publishes no release, runs no git, and executes no protected recovery.", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.acceptance_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed && !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.protected_recovery_execution_allowed),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed),
    gateRow("p341_p500_program_closeout_ready", "The P341-P500 platform operations stability program is ready for human-reviewed closeout evidence.", boundary.p341_p500_program_ready),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operations_freeze_closeout_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-operations-freeze-closeout-gate-row.v1",
    operations_freeze_closeout_gate_row_id: `platform-operations-freeze-closeout.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_payload_present_by_closeout: false,
    ready_for_validation_by_closeout: false,
    ready_for_approval_application_by_closeout: false,
    receipt_received_by_closeout: false,
    receipt_validated_by_closeout: false,
    signoff_completed_by_closeout: false,
    approval_applied_by_closeout: false,
    acceptance_command_execution_performed_by_closeout: false,
    generated_artifact_read_performed_by_closeout: false,
    artifact_write_performed_by_closeout: false,
    protected_action_executed_by_closeout: false,
    protected_recovery_execution_allowed_by_closeout: false,
    trading_order_submission_allowed_by_closeout: false,
    broker_write_allowed_by_closeout: false,
    exchange_write_allowed_by_closeout: false,
    desktop_source_of_truth_by_closeout: false,
    desktop_mutation_allowed_by_closeout: false,
    secret_exposure_allowed_by_closeout: false,
    secret_values_read_by_closeout: false,
    env_file_read_by_closeout: false,
    desktop_config_content_inspected_by_closeout: false,
    desktop_provider_key_visible_by_closeout: false,
    credential_lookup_allowed_by_closeout: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ chainRegression, packageJson, platformOpsLedger, closeoutRows, gateRows, boundary }) {
  return [
    validationItem("source.operations_freeze_receipt_chain_regression", "p499_chain_regression_ready", chainRegression.validation.valid && chainRegression.summary.platform_operations_freeze_receipt_chain_regression_status === SOURCE_READY_STATUS, "P499 operations freeze receipt-chain regression source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P500 closeout."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("operations_freeze_closeout_rows", "closeout_rows_ready", closeoutRows.length === CLOSEOUT_LANES.length && closeoutRows.every((row) => row.closeout_status === CLOSEOUT_READY_STATUS && row.closeout_declared && row.p341_p500_program_ready && row.human_receipts_pending && !row.receipt_payload_present && !row.ready_for_validation && !row.ready_for_approval_application && !row.approval_applied_by_closeout && !row.acceptance_command_execution_performed_by_closeout && !row.secret_exposure_allowed_by_closeout), "P500 closeout rows must be ready and declarative only."),
    validationItem("operations_freeze_closeout_gate_rows", "closeout_gates_ready", gateRows.length >= 9 && gateRows.every((row) => row.gate_status === "ready" && !row.approval_applied_by_closeout && !row.acceptance_command_execution_performed_by_closeout && !row.protected_action_executed_by_closeout && !row.secret_exposure_allowed_by_closeout), "P500 closeout gates must be ready."),
    validationItem("boundary.no_receipt_payload", "no_receipt_payload", boundary.read_only && boundary.report_only && boundary.closeout_declared && boundary.p341_p500_program_ready && boundary.human_receipts_pending && !boundary.receipt_payload_present && !boundary.ready_for_validation && !boundary.ready_for_approval_application && !boundary.receipt_received && !boundary.receipt_validated && !boundary.signoff_completed && !boundary.approval_applied, "P500 closeout does not materialize, validate, complete, or apply receipts."),
    validationItem("boundary.no_execution_or_mutation", "no_execution_or_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.acceptance_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed && !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.protected_recovery_execution_allowed, "P500 performs no command execution, artifact read/write, dependency/package/lockfile mutation, release, git, protected, or recovery action."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed, "Trading, Desktop, and secret boundaries remain disabled."),
  ];
}

function buildSummary({ chainRegression, closeoutRows, gateRows, boundary, validation }) {
  return {
    platform_operations_freeze_closeout_status: validation.valid ? CLOSEOUT_READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_chain_regression_status: chainRegression.summary.platform_operations_freeze_receipt_chain_regression_status,
    closeout_row_count: closeoutRows.length,
    ready_closeout_row_count: closeoutRows.filter((row) => row.closeout_status === CLOSEOUT_READY_STATUS).length,
    closeout_gate_count: gateRows.length,
    ready_closeout_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    closeout_declared: boundary.closeout_declared,
    p341_p500_program_ready: boundary.p341_p500_program_ready,
    human_receipts_pending: boundary.human_receipts_pending,
    final_program_phase: boundary.final_program_phase,
    receipt_payload_present: boundary.receipt_payload_present,
    ready_for_validation: boundary.ready_for_validation,
    ready_for_approval_application: boundary.ready_for_approval_application,
    receipt_received: boundary.receipt_received,
    receipt_validated: boundary.receipt_validated,
    signoff_completed: boundary.signoff_completed,
    approval_applied: boundary.approval_applied,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
    acceptance_command_execution_performed: boundary.acceptance_command_execution_performed,
    generated_artifact_read_performed: boundary.generated_artifact_read_performed,
    artifact_read_performed: boundary.artifact_read_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    dependency_install_performed: boundary.dependency_install_performed,
    package_mutation_performed: boundary.package_mutation_performed,
    lockfile_mutation_performed: boundary.lockfile_mutation_performed,
    release_published: boundary.release_published,
    git_operation_performed: boundary.git_operation_performed,
    protected_action_executed: boundary.protected_action_executed,
    protected_recovery_execution_allowed: boundary.protected_recovery_execution_allowed,
    trading_live_enabled: boundary.trading_live_enabled,
    trading_full_auto_enabled: boundary.trading_full_auto_enabled,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    desktop_source_of_truth: boundary.desktop_source_of_truth,
    desktop_mutation_allowed: boundary.desktop_mutation_allowed,
    secret_exposure_allowed: boundary.secret_exposure_allowed,
    secret_values_read: boundary.secret_values_read,
    env_file_read: boundary.env_file_read,
    desktop_config_content_inspected: boundary.desktop_config_content_inspected,
    desktop_provider_key_visible: boundary.desktop_provider_key_visible,
    credential_lookup_allowed: boundary.credential_lookup_allowed,
    human_review_required: boundary.human_review_required,
    human_signoff_required: boundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Operations Freeze Closeout",
    "",
    `Status: ${result.summary.platform_operations_freeze_closeout_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source chain regression: ${result.summary.source_receipt_chain_regression_status}`,
    `Closeout rows: ${result.summary.ready_closeout_row_count}/${result.summary.closeout_row_count}`,
    `Closeout gates: ${result.summary.ready_closeout_gate_count}/${result.summary.closeout_gate_count}`,
    "",
    "## Closeout Rows",
    "",
    ...result.operations_freeze_closeout_rows.map((row) => `- ${row.closeout_lane_key}: ${row.closeout_status}`),
    "",
    "## Gates",
    "",
    ...result.operations_freeze_closeout_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--receipt-chain-regression-schema") parsed.operationsFreezeReceiptChainRegressionSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operations-freeze-closeout.mjs [options]

Options:
  --out-dir <folder>                     Output directory. Default: ${DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_OUT_DIR}
  --run-at <iso>                         Deterministic generated_at timestamp.
  --package <path>                       package.json path.
  --platform-ops-ledger <path>           P341-P500 platform operations ledger path.
  --receipt-chain-regression-schema <path>
                                         P499 receipt chain regression schema path.
  --schema <path>                        Output schema path.
  --check                                Validate only, do not write artifacts.
  -h, --help                             Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.platformOpsLedgerPath),
    operations_freeze_source_inventory_schema_path: path.resolve(options.operationsFreezeSourceInventorySchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.operationsFreezeSourceInventorySchemaPath),
    operations_freeze_command_matrix_schema_path: path.resolve(options.operationsFreezeCommandMatrixSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.operationsFreezeCommandMatrixSchemaPath),
    operations_freeze_evidence_index_schema_path: path.resolve(options.operationsFreezeEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.operationsFreezeEvidenceIndexSchemaPath),
    operations_freeze_review_packet_schema_path: path.resolve(options.operationsFreezeReviewPacketSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.operationsFreezeReviewPacketSchemaPath),
    operations_freeze_signoff_ledger_schema_path: path.resolve(options.operationsFreezeSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.operationsFreezeSignoffLedgerSchemaPath),
    operations_freeze_signoff_receipt_template_schema_path: path.resolve(options.operationsFreezeSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.operationsFreezeSignoffReceiptTemplateSchemaPath),
    operations_freeze_signoff_receipt_intake_schema_path: path.resolve(options.operationsFreezeSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.operationsFreezeSignoffReceiptIntakeSchemaPath),
    operations_freeze_signoff_closeout_schema_path: path.resolve(options.operationsFreezeSignoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.operationsFreezeSignoffCloseoutSchemaPath),
    operations_freeze_status_ledger_schema_path: path.resolve(options.operationsFreezeStatusLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.operationsFreezeStatusLedgerSchemaPath),
    operations_freeze_receipt_queue_schema_path: path.resolve(options.operationsFreezeReceiptQueueSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.operationsFreezeReceiptQueueSchemaPath),
    operations_freeze_receipt_validation_rules_schema_path: path.resolve(options.operationsFreezeReceiptValidationRulesSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.operationsFreezeReceiptValidationRulesSchemaPath),
    operations_freeze_receipt_workspace_schema_path: path.resolve(options.operationsFreezeReceiptWorkspaceSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.operationsFreezeReceiptWorkspaceSchemaPath),
    operations_freeze_receipt_workspace_merge_schema_path: path.resolve(options.operationsFreezeReceiptWorkspaceMergeSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.operationsFreezeReceiptWorkspaceMergeSchemaPath),
    operations_freeze_receipt_validation_packet_schema_path: path.resolve(options.operationsFreezeReceiptValidationPacketSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.operationsFreezeReceiptValidationPacketSchemaPath),
    operations_freeze_receipt_approval_plan_schema_path: path.resolve(options.operationsFreezeReceiptApprovalPlanSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.operationsFreezeReceiptApprovalPlanSchemaPath),
    operations_freeze_receipt_approval_closeout_schema_path: path.resolve(options.operationsFreezeReceiptApprovalCloseoutSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.operationsFreezeReceiptApprovalCloseoutSchemaPath),
    operations_freeze_receipt_closeout_schema_path: path.resolve(options.operationsFreezeReceiptCloseoutSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.operationsFreezeReceiptCloseoutSchemaPath),
    operations_freeze_receipt_chain_regression_schema_path: path.resolve(options.operationsFreezeReceiptChainRegressionSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.operationsFreezeReceiptChainRegressionSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.schemaPath),
  };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    count: rows.length,
    [key]: rows,
  };
}

async function readJsonSource(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return { path: filePath, available: true, data: JSON.parse(raw), content_hash: sha256(raw) };
  } catch (error) {
    return { path: filePath, available: false, data: null, content_hash: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, text, content_hash: sha256(text) };
  } catch (error) {
    return { path: filePath, available: false, text: "", content_hash: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `platform-operations-freeze-closeout.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return { valid: errors.length === 0, errors };
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function withOrdinalAndHash(row, index, hashKey) {
  const rowWithOrdinal = { ...row, ordinal: index + 1 };
  return { ...rowWithOrdinal, [hashKey]: hashValue(rowWithOrdinal) };
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function dateStamp(isoString) {
  return isoString.slice(0, 10).replace(/-/g, "");
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
