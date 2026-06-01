import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_CLOSEOUT_INPUTS,
  buildPlatformOperationsFreezeSignoffCloseout,
} from "./platform-operations-freeze-signoff-closeout.mjs";

export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_STATUS_LEDGER_OUT_DIR = "artifacts/platform-operations-freeze-status-ledger/latest";
export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_STATUS_LEDGER_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_CLOSEOUT_INPUTS,
  operationsFreezeSignoffCloseoutSchemaPath: DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_CLOSEOUT_INPUTS.schemaPath,
  schemaPath: "schemas/platform-operations-freeze-status-ledger.schema.json",
};

const COMMAND_NAME = "platform:operations-freeze-status-ledger";
const SCHEMA_VERSION = "platform-operations-freeze-status-ledger.v1";
const CAPABILITY_ID = "platform.operations_freeze_status_ledger";
const PHASE_SLOT = "P489";
const PREVIOUS_PHASE_SLOT = "P488";
const NEXT_PHASE_SLOT = "P490";
const SOURCE_READY_STATUS = "ready_for_operations_freeze_signoff_closeout";
const SOURCE_ROW_READY_STATUS = "ready_for_human_receipt_collection";
const STATUS_READY = "ready_pending_human_receipt";

export async function runPlatformOperationsFreezeStatusLedger(options = {}) {
  const result = await buildPlatformOperationsFreezeStatusLedger(options);
  if (options.write !== false) await writePlatformOperationsFreezeStatusLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operations freeze status ledger failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperationsFreezeStatusLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_STATUS_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const closeout = await buildPlatformOperationsFreezeSignoffCloseout({
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
    schemaPath: inputs.operations_freeze_signoff_closeout_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const statusRows = buildStatusRows({ closeout });
  const statusBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const statusAnchor = buildStatusAnchor({ closeout, packageJson, platformOpsLedger, statusRows });
  const statusGateRows = buildStatusGateRows({ closeout, packageJson, platformOpsLedger, statusRows, statusBoundary });
  const validationItems = buildValidationItems({ closeout, packageJson, platformOpsLedger, statusRows, statusGateRows, statusBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ closeout, statusRows, statusGateRows, statusBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operations_freeze_status_ledger_id: `platform-operations-freeze-status-ledger.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operations_freeze_status_ledger_anchor: statusAnchor,
    operations_freeze_status_rows: statusRows,
    operations_freeze_status_gate_rows: statusGateRows,
    operations_freeze_status_boundary: statusBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operations_freeze_status_ledger") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ closeout, statusRows, statusGateRows, statusBoundary, validation: result.validation });
  result.summary.platform_operations_freeze_status_ledger_id = result.platform_operations_freeze_status_ledger_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperationsFreezeStatusLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-operations-freeze-status-ledger.json"), serializableResult(result));
  await writeJson(path.join(outDir, "freeze-status-rows.json"), collectionEnvelope("platform-operations-freeze-status-rows.v1", "operations_freeze_status_rows", result.operations_freeze_status_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-status-gate-rows.json"), collectionEnvelope("platform-operations-freeze-status-gate-rows.v1", "operations_freeze_status_gate_rows", result.operations_freeze_status_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-status-boundary.json"), result.operations_freeze_status_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operations-freeze-status-ledger-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperationsFreezeStatusLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperationsFreezeStatusLedger(args);
    console.log(`Platform operations freeze status ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operations_freeze_status_ledger_status}`);
    console.log(`Status rows: ${result.summary.ready_status_row_count}/${result.summary.status_row_count}`);
    console.log(`Status gates: ${result.summary.ready_status_gate_count}/${result.summary.status_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildStatusAnchor({ closeout, packageJson, platformOpsLedger, statusRows }) {
  return {
    schema_version: "platform-operations-freeze-status-ledger-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_signoff_closeout_id: closeout.platform_operations_freeze_signoff_closeout_id,
    source_signoff_closeout_status: closeout.summary.platform_operations_freeze_signoff_closeout_status,
    source_signoff_closeout_hash: hashValue({
      id: closeout.platform_operations_freeze_signoff_closeout_id,
      status: closeout.summary.platform_operations_freeze_signoff_closeout_status,
      closeout_rows: closeout.summary.closeout_row_count,
      ready_closeout_rows: closeout.summary.ready_closeout_row_count,
      gate_rows: closeout.summary.closeout_gate_count,
    }),
    package_json_hash: packageJson.content_hash,
    platform_ops_ledger_hash: platformOpsLedger.content_hash,
    status_rows_hash: hashValue(statusRows.map((row) => ({
      row_key: row.source_evidence_row_key,
      operations_freeze_status: row.operations_freeze_status,
      human_receipt_pending: row.human_receipt_pending,
    }))),
  };
}

function buildStatusRows({ closeout }) {
  const sourceReady = closeout.validation.valid && closeout.summary.platform_operations_freeze_signoff_closeout_status === SOURCE_READY_STATUS;
  return closeout.operations_freeze_signoff_closeout_rows.map((closeoutRow, index) => {
    const status = sourceReady && closeoutRow.closeout_status === SOURCE_ROW_READY_STATUS ? STATUS_READY : "blocked";
    const row = {
      schema_version: "platform-operations-freeze-status-ledger-row.v1",
      operations_freeze_status_row_id: `platform-operations-freeze-status-ledger.row.${closeoutRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_closeout_row_id: closeoutRow.operations_freeze_signoff_closeout_row_id,
      source_evidence_row_key: closeoutRow.source_evidence_row_key,
      package_script_name: closeoutRow.package_script_name,
      invocation: closeoutRow.invocation,
      evidence_kind: closeoutRow.evidence_kind,
      expected_report_path: closeoutRow.expected_report_path,
      required_reviewer_role: closeoutRow.required_reviewer_role,
      required_signoff_role: closeoutRow.required_signoff_role,
      operations_freeze_status: status,
      source_closeout_status: closeoutRow.closeout_status,
      human_receipt_collection_required: true,
      human_receipt_pending: true,
      operations_freeze_ready_without_human_receipt: false,
      receipt_received_by_status_ledger: false,
      receipt_validated_by_status_ledger: false,
      ready_for_validation_by_status_ledger: false,
      signoff_completed_by_status_ledger: false,
      approval_applied_by_status_ledger: false,
      signoff_closeout_consumed_in_memory: true,
      signoff_closeout_artifact_read_performed_by_status_ledger: false,
      command_execution_performed_by_status_ledger: false,
      package_command_execution_performed_by_status_ledger: false,
      acceptance_command_execution_performed_by_status_ledger: false,
      generated_artifact_read_performed_by_status_ledger: false,
      artifact_read_performed_by_status_ledger: false,
      artifact_write_performed_by_status_ledger: false,
      dependency_install_performed_by_status_ledger: false,
      package_mutation_performed_by_status_ledger: false,
      lockfile_mutation_performed_by_status_ledger: false,
      release_published_by_status_ledger: false,
      git_operation_performed_by_status_ledger: false,
      protected_action_executed_by_status_ledger: false,
      protected_recovery_execution_allowed_by_status_ledger: false,
      trading_live_enabled_by_status_ledger: false,
      trading_full_auto_enabled_by_status_ledger: false,
      trading_order_submission_allowed_by_status_ledger: false,
      broker_write_allowed_by_status_ledger: false,
      exchange_write_allowed_by_status_ledger: false,
      desktop_source_of_truth_by_status_ledger: false,
      desktop_mutation_allowed_by_status_ledger: false,
      secret_exposure_allowed_by_status_ledger: false,
      secret_values_read_by_status_ledger: false,
      env_file_read_by_status_ledger: false,
      desktop_config_content_inspected_by_status_ledger: false,
      desktop_provider_key_visible_by_status_ledger: false,
      credential_lookup_allowed_by_status_ledger: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Status remains pending human receipt collection for ${closeoutRow.invocation}; no receipt is received or applied by this ledger.`,
    };
    return withOrdinalAndHash(row, index, "operations_freeze_status_row_hash");
  });
}

function buildStatusGateRows({ closeout, packageJson, platformOpsLedger, statusRows, statusBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p488_signoff_closeout_ready", "P488 operations freeze signoff closeout source is ready.", closeout.validation.valid && closeout.summary.platform_operations_freeze_signoff_closeout_status === SOURCE_READY_STATUS && closeout.summary.ready_closeout_row_count === 7),
    gateRow("platform_package_script_registered", "package.json registers the P489 platform operations freeze status ledger command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P489 platform operations freeze status ledger command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p489_ledger_acceptance_declared", "P489 acceptance row is declared in the platform operations ledger.", ledgerText.includes(`P489: \`${COMMAND_NAME}\``)),
    gateRow("status_rows_ready", "All operations freeze status rows are ready and pending human receipts.", statusRows.length === 7 && statusRows.every((row) => row.operations_freeze_status === STATUS_READY && row.human_receipt_collection_required && row.human_receipt_pending && !row.operations_freeze_ready_without_human_receipt)),
    gateRow("human_receipts_still_pending", "Status ledger records pending human receipt collection without receiving receipts, validating receipts, completing signoff, or applying approval.", statusBoundary.human_receipt_collection_required && statusBoundary.human_receipt_pending && !statusBoundary.operations_freeze_ready_without_human_receipt && !statusBoundary.receipt_received && !statusBoundary.receipt_validated && !statusBoundary.ready_for_validation && !statusBoundary.signoff_completed && !statusBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Status ledger executes no commands, reads/writes no artifacts, and performs no package, release, git, or protected mutation.", !statusBoundary.command_execution_performed && !statusBoundary.package_command_execution_performed && !statusBoundary.acceptance_command_execution_performed && !statusBoundary.generated_artifact_read_performed && !statusBoundary.artifact_read_performed && !statusBoundary.artifact_write_performed && !statusBoundary.dependency_install_performed && !statusBoundary.package_mutation_performed && !statusBoundary.lockfile_mutation_performed && !statusBoundary.release_published && !statusBoundary.git_operation_performed && !statusBoundary.protected_action_executed && !statusBoundary.protected_recovery_execution_allowed),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !statusBoundary.trading_live_enabled && !statusBoundary.trading_full_auto_enabled && !statusBoundary.trading_order_submission_allowed && !statusBoundary.broker_write_allowed && !statusBoundary.exchange_write_allowed && !statusBoundary.desktop_source_of_truth && !statusBoundary.desktop_mutation_allowed && !statusBoundary.secret_exposure_allowed && !statusBoundary.secret_values_read && !statusBoundary.env_file_read && !statusBoundary.desktop_config_content_inspected && !statusBoundary.desktop_provider_key_visible && !statusBoundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operations_freeze_status_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-operations-freeze-status-ledger-gate-row.v1",
    operations_freeze_status_gate_row_id: `platform-operations-freeze-status-ledger.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_received_by_status_ledger: false,
    receipt_validated_by_status_ledger: false,
    ready_for_validation_by_status_ledger: false,
    signoff_completed_by_status_ledger: false,
    approval_applied_by_status_ledger: false,
    signoff_closeout_artifact_read_performed_by_status_ledger: false,
    command_execution_performed_by_status_ledger: false,
    package_command_execution_performed_by_status_ledger: false,
    acceptance_command_execution_performed_by_status_ledger: false,
    generated_artifact_read_performed_by_status_ledger: false,
    artifact_read_performed_by_status_ledger: false,
    artifact_write_performed_by_status_ledger: false,
    release_published_by_status_ledger: false,
    git_operation_performed_by_status_ledger: false,
    protected_action_executed_by_status_ledger: false,
    protected_recovery_execution_allowed_by_status_ledger: false,
    trading_order_submission_allowed_by_status_ledger: false,
    broker_write_allowed_by_status_ledger: false,
    exchange_write_allowed_by_status_ledger: false,
    desktop_source_of_truth_by_status_ledger: false,
    desktop_mutation_allowed_by_status_ledger: false,
    secret_exposure_allowed_by_status_ledger: false,
    secret_values_read_by_status_ledger: false,
    env_file_read_by_status_ledger: false,
    desktop_config_content_inspected_by_status_ledger: false,
    desktop_provider_key_visible_by_status_ledger: false,
    credential_lookup_allowed_by_status_ledger: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-operations-freeze-status-ledger-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    status_ledger_artifact_write_requested: writeRequested,
    signoff_closeout_consumed_in_memory: true,
    signoff_closeout_artifact_read_performed: false,
    human_receipt_collection_required: true,
    human_receipt_pending: true,
    operations_freeze_ready_without_human_receipt: false,
    receipt_received: false,
    receipt_validated: false,
    ready_for_validation: false,
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
    human_review_note: "Status ledger records readiness pending external human receipts; it does not receive, validate, complete, or apply receipts.",
  };
}

function buildValidationItems({ closeout, packageJson, platformOpsLedger, statusRows, statusGateRows, statusBoundary }) {
  return [
    validationItem("source.operations_freeze_signoff_closeout", "p488_signoff_closeout_ready", closeout.validation.valid && closeout.summary.platform_operations_freeze_signoff_closeout_status === SOURCE_READY_STATUS && closeout.summary.ready_closeout_row_count === 7, "P488 operations freeze signoff closeout source must be ready before P489 status ledger."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P489 operations freeze status ledger."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("operations_freeze_status_rows", "status_rows_ready", statusRows.length === 7 && statusRows.every((row) => row.operations_freeze_status === STATUS_READY && row.human_receipt_collection_required && row.human_receipt_pending && !row.operations_freeze_ready_without_human_receipt && !row.receipt_received_by_status_ledger && !row.receipt_validated_by_status_ledger && !row.approval_applied_by_status_ledger), "Every operations freeze status row must remain pending external human receipt collection."),
    validationItem("operations_freeze_status_gate_rows", "status_gates_ready", statusGateRows.length >= 8 && statusGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_status_ledger && !row.protected_action_executed_by_status_ledger), "P489 operations freeze status ledger gates must be ready and status-only."),
    validationItem("boundary.signoff_not_completed", "signoff_not_completed", statusBoundary.read_only && statusBoundary.report_only && statusBoundary.signoff_closeout_consumed_in_memory && !statusBoundary.signoff_closeout_artifact_read_performed && statusBoundary.human_receipt_collection_required && statusBoundary.human_receipt_pending && !statusBoundary.operations_freeze_ready_without_human_receipt && !statusBoundary.receipt_received && !statusBoundary.receipt_validated && !statusBoundary.ready_for_validation && !statusBoundary.signoff_completed && !statusBoundary.approval_applied, "P489 status ledger remains pending human receipts and does not complete signoff."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !statusBoundary.command_execution_performed && !statusBoundary.package_command_execution_performed && !statusBoundary.acceptance_command_execution_performed && !statusBoundary.generated_artifact_read_performed && !statusBoundary.artifact_read_performed && !statusBoundary.artifact_write_performed, "P489 status ledger does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !statusBoundary.dependency_install_performed && !statusBoundary.package_mutation_performed && !statusBoundary.lockfile_mutation_performed && !statusBoundary.release_published && !statusBoundary.git_operation_performed && !statusBoundary.protected_action_executed && !statusBoundary.protected_recovery_execution_allowed, "P489 status ledger performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !statusBoundary.trading_live_enabled && !statusBoundary.trading_full_auto_enabled && !statusBoundary.trading_order_submission_allowed && !statusBoundary.broker_write_allowed && !statusBoundary.exchange_write_allowed && !statusBoundary.desktop_source_of_truth && !statusBoundary.desktop_mutation_allowed && !statusBoundary.secret_exposure_allowed && !statusBoundary.secret_values_read && !statusBoundary.env_file_read && !statusBoundary.desktop_config_content_inspected && !statusBoundary.desktop_provider_key_visible && !statusBoundary.credential_lookup_allowed, "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled."),
  ];
}

function buildSummary({ closeout, statusRows, statusGateRows, statusBoundary, validation }) {
  return {
    platform_operations_freeze_status_ledger_status: validation.valid ? STATUS_READY : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_signoff_closeout_status: closeout.summary.platform_operations_freeze_signoff_closeout_status,
    status_row_count: statusRows.length,
    ready_status_row_count: statusRows.filter((row) => row.operations_freeze_status === STATUS_READY).length,
    status_gate_count: statusGateRows.length,
    ready_status_gate_count: statusGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: statusBoundary.read_only,
    report_only: statusBoundary.report_only,
    status_ledger_artifact_write_requested: statusBoundary.status_ledger_artifact_write_requested,
    signoff_closeout_consumed_in_memory: statusBoundary.signoff_closeout_consumed_in_memory,
    signoff_closeout_artifact_read_performed: statusBoundary.signoff_closeout_artifact_read_performed,
    human_receipt_collection_required: statusBoundary.human_receipt_collection_required,
    human_receipt_pending: statusBoundary.human_receipt_pending,
    operations_freeze_ready_without_human_receipt: statusBoundary.operations_freeze_ready_without_human_receipt,
    receipt_received: statusBoundary.receipt_received,
    receipt_validated: statusBoundary.receipt_validated,
    ready_for_validation: statusBoundary.ready_for_validation,
    signoff_completed: statusBoundary.signoff_completed,
    approval_applied: statusBoundary.approval_applied,
    command_execution_performed: statusBoundary.command_execution_performed,
    package_command_execution_performed: statusBoundary.package_command_execution_performed,
    acceptance_command_execution_performed: statusBoundary.acceptance_command_execution_performed,
    generated_artifact_read_performed: statusBoundary.generated_artifact_read_performed,
    artifact_read_performed: statusBoundary.artifact_read_performed,
    artifact_write_performed: statusBoundary.artifact_write_performed,
    dependency_install_performed: statusBoundary.dependency_install_performed,
    package_mutation_performed: statusBoundary.package_mutation_performed,
    lockfile_mutation_performed: statusBoundary.lockfile_mutation_performed,
    release_published: statusBoundary.release_published,
    git_operation_performed: statusBoundary.git_operation_performed,
    protected_action_executed: statusBoundary.protected_action_executed,
    protected_recovery_execution_allowed: statusBoundary.protected_recovery_execution_allowed,
    trading_live_enabled: statusBoundary.trading_live_enabled,
    trading_full_auto_enabled: statusBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: statusBoundary.trading_order_submission_allowed,
    broker_write_allowed: statusBoundary.broker_write_allowed,
    exchange_write_allowed: statusBoundary.exchange_write_allowed,
    desktop_source_of_truth: statusBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: statusBoundary.desktop_mutation_allowed,
    secret_exposure_allowed: statusBoundary.secret_exposure_allowed,
    secret_values_read: statusBoundary.secret_values_read,
    env_file_read: statusBoundary.env_file_read,
    desktop_config_content_inspected: statusBoundary.desktop_config_content_inspected,
    desktop_provider_key_visible: statusBoundary.desktop_provider_key_visible,
    credential_lookup_allowed: statusBoundary.credential_lookup_allowed,
    human_review_required: statusBoundary.human_review_required,
    human_signoff_required: statusBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Operations Freeze Status Ledger",
    "",
    `Status: ${result.summary.platform_operations_freeze_status_ledger_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source signoff closeout: ${result.summary.source_signoff_closeout_status}`,
    `Status rows: ${result.summary.ready_status_row_count}/${result.summary.status_row_count}`,
    `Status gates: ${result.summary.ready_status_gate_count}/${result.summary.status_gate_count}`,
    "",
    "## Status Rows",
    "",
    ...result.operations_freeze_status_rows.map((row) => `- ${row.invocation} (${row.required_signoff_role}): ${row.operations_freeze_status}`),
    "",
    "## Status Gates",
    "",
    ...result.operations_freeze_status_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATIONS_FREEZE_STATUS_LEDGER_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--source-inventory-schema") parsed.operationsFreezeSourceInventorySchemaPath = argv[++index];
    else if (arg === "--command-matrix-schema") parsed.operationsFreezeCommandMatrixSchemaPath = argv[++index];
    else if (arg === "--evidence-index-schema") parsed.operationsFreezeEvidenceIndexSchemaPath = argv[++index];
    else if (arg === "--review-packet-schema") parsed.operationsFreezeReviewPacketSchemaPath = argv[++index];
    else if (arg === "--signoff-ledger-schema") parsed.operationsFreezeSignoffLedgerSchemaPath = argv[++index];
    else if (arg === "--receipt-template-schema") parsed.operationsFreezeSignoffReceiptTemplateSchemaPath = argv[++index];
    else if (arg === "--receipt-intake-schema") parsed.operationsFreezeSignoffReceiptIntakeSchemaPath = argv[++index];
    else if (arg === "--signoff-closeout-schema") parsed.operationsFreezeSignoffCloseoutSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operations-freeze-status-ledger.mjs [options]

Options:
  --out-dir <folder>                  Output directory. Default: ${DEFAULT_PLATFORM_OPERATIONS_FREEZE_STATUS_LEDGER_OUT_DIR}
  --run-at <iso>                      Deterministic generated_at timestamp.
  --package <path>                    package.json path.
  --platform-ops-ledger <path>        P341-P500 platform operations ledger path.
  --source-inventory-schema <path>    P481 source inventory schema path.
  --command-matrix-schema <path>      P482 command matrix schema path.
  --evidence-index-schema <path>      P483 evidence index schema path.
  --review-packet-schema <path>       P484 review packet schema path.
  --signoff-ledger-schema <path>      P485 signoff ledger schema path.
  --receipt-template-schema <path>    P486 receipt template schema path.
  --receipt-intake-schema <path>      P487 receipt intake schema path.
  --signoff-closeout-schema <path>    P488 signoff closeout schema path.
  --schema <path>                     Output schema path.
  --check                             Validate only, do not write artifacts.
  -h, --help                          Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_STATUS_LEDGER_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_STATUS_LEDGER_INPUTS.platformOpsLedgerPath),
    operations_freeze_source_inventory_schema_path: path.resolve(options.operationsFreezeSourceInventorySchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_STATUS_LEDGER_INPUTS.operationsFreezeSourceInventorySchemaPath),
    operations_freeze_command_matrix_schema_path: path.resolve(options.operationsFreezeCommandMatrixSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_STATUS_LEDGER_INPUTS.operationsFreezeCommandMatrixSchemaPath),
    operations_freeze_evidence_index_schema_path: path.resolve(options.operationsFreezeEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_STATUS_LEDGER_INPUTS.operationsFreezeEvidenceIndexSchemaPath),
    operations_freeze_review_packet_schema_path: path.resolve(options.operationsFreezeReviewPacketSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_STATUS_LEDGER_INPUTS.operationsFreezeReviewPacketSchemaPath),
    operations_freeze_signoff_ledger_schema_path: path.resolve(options.operationsFreezeSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_STATUS_LEDGER_INPUTS.operationsFreezeSignoffLedgerSchemaPath),
    operations_freeze_signoff_receipt_template_schema_path: path.resolve(options.operationsFreezeSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_STATUS_LEDGER_INPUTS.operationsFreezeSignoffReceiptTemplateSchemaPath),
    operations_freeze_signoff_receipt_intake_schema_path: path.resolve(options.operationsFreezeSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_STATUS_LEDGER_INPUTS.operationsFreezeSignoffReceiptIntakeSchemaPath),
    operations_freeze_signoff_closeout_schema_path: path.resolve(options.operationsFreezeSignoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_STATUS_LEDGER_INPUTS.operationsFreezeSignoffCloseoutSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_STATUS_LEDGER_INPUTS.schemaPath),
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
    validation_item_id: `platform-operations-freeze-status-ledger.${slugify(itemPath)}.${checkId}`,
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
