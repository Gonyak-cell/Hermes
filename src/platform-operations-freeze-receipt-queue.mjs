import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATIONS_FREEZE_STATUS_LEDGER_INPUTS,
  buildPlatformOperationsFreezeStatusLedger,
} from "./platform-operations-freeze-status-ledger.mjs";

export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_OUT_DIR = "artifacts/platform-operations-freeze-receipt-queue/latest";
export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATIONS_FREEZE_STATUS_LEDGER_INPUTS,
  operationsFreezeStatusLedgerSchemaPath: DEFAULT_PLATFORM_OPERATIONS_FREEZE_STATUS_LEDGER_INPUTS.schemaPath,
  schemaPath: "schemas/platform-operations-freeze-receipt-queue.schema.json",
};

const COMMAND_NAME = "platform:operations-freeze-receipt-queue";
const SCHEMA_VERSION = "platform-operations-freeze-receipt-queue.v1";
const CAPABILITY_ID = "platform.operations_freeze_receipt_queue";
const PHASE_SLOT = "P490";
const PREVIOUS_PHASE_SLOT = "P489";
const NEXT_PHASE_SLOT = "P491";
const SOURCE_READY_STATUS = "ready_pending_human_receipt";
const SOURCE_ROW_READY_STATUS = "ready_pending_human_receipt";
const QUEUE_READY_STATUS = "queued_for_human_receipt";

export async function runPlatformOperationsFreezeReceiptQueue(options = {}) {
  const result = await buildPlatformOperationsFreezeReceiptQueue(options);
  if (options.write !== false) await writePlatformOperationsFreezeReceiptQueue(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operations freeze receipt queue failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperationsFreezeReceiptQueue(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const statusLedger = await buildPlatformOperationsFreezeStatusLedger({
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
    schemaPath: inputs.operations_freeze_status_ledger_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const queueRows = buildQueueRows({ statusLedger });
  const queueBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const queueAnchor = buildQueueAnchor({ statusLedger, packageJson, platformOpsLedger, queueRows });
  const queueGateRows = buildQueueGateRows({ statusLedger, packageJson, platformOpsLedger, queueRows, queueBoundary });
  const validationItems = buildValidationItems({ statusLedger, packageJson, platformOpsLedger, queueRows, queueGateRows, queueBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ statusLedger, queueRows, queueGateRows, queueBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operations_freeze_receipt_queue_id: `platform-operations-freeze-receipt-queue.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operations_freeze_receipt_queue_anchor: queueAnchor,
    operations_freeze_receipt_queue_rows: queueRows,
    operations_freeze_receipt_queue_gate_rows: queueGateRows,
    operations_freeze_receipt_queue_boundary: queueBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operations_freeze_receipt_queue") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ statusLedger, queueRows, queueGateRows, queueBoundary, validation: result.validation });
  result.summary.platform_operations_freeze_receipt_queue_id = result.platform_operations_freeze_receipt_queue_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperationsFreezeReceiptQueue(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-operations-freeze-receipt-queue.json"), serializableResult(result));
  await writeJson(path.join(outDir, "freeze-receipt-queue-rows.json"), collectionEnvelope("platform-operations-freeze-receipt-queue-rows.v1", "operations_freeze_receipt_queue_rows", result.operations_freeze_receipt_queue_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-receipt-queue-gate-rows.json"), collectionEnvelope("platform-operations-freeze-receipt-queue-gate-rows.v1", "operations_freeze_receipt_queue_gate_rows", result.operations_freeze_receipt_queue_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-receipt-queue-boundary.json"), result.operations_freeze_receipt_queue_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operations-freeze-receipt-queue-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperationsFreezeReceiptQueueCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperationsFreezeReceiptQueue(args);
    console.log(`Platform operations freeze receipt queue ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operations_freeze_receipt_queue_status}`);
    console.log(`Queue rows: ${result.summary.ready_queue_row_count}/${result.summary.queue_row_count}`);
    console.log(`Queue gates: ${result.summary.ready_queue_gate_count}/${result.summary.queue_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildQueueAnchor({ statusLedger, packageJson, platformOpsLedger, queueRows }) {
  return {
    schema_version: "platform-operations-freeze-receipt-queue-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_status_ledger_id: statusLedger.platform_operations_freeze_status_ledger_id,
    source_status_ledger_status: statusLedger.summary.platform_operations_freeze_status_ledger_status,
    source_status_ledger_hash: hashValue({
      id: statusLedger.platform_operations_freeze_status_ledger_id,
      status: statusLedger.summary.platform_operations_freeze_status_ledger_status,
      status_rows: statusLedger.summary.status_row_count,
      ready_status_rows: statusLedger.summary.ready_status_row_count,
      gate_rows: statusLedger.summary.status_gate_count,
    }),
    package_json_hash: packageJson.content_hash,
    platform_ops_ledger_hash: platformOpsLedger.content_hash,
    queue_rows_hash: hashValue(queueRows.map((row) => ({
      row_key: row.source_evidence_row_key,
      receipt_queue_status: row.receipt_queue_status,
      human_receipt_pending: row.human_receipt_pending,
    }))),
  };
}

function buildQueueRows({ statusLedger }) {
  const sourceReady = statusLedger.validation.valid && statusLedger.summary.platform_operations_freeze_status_ledger_status === SOURCE_READY_STATUS;
  return statusLedger.operations_freeze_status_rows.map((statusRow, index) => {
    const queueStatus = sourceReady && statusRow.operations_freeze_status === SOURCE_ROW_READY_STATUS ? QUEUE_READY_STATUS : "blocked";
    const row = {
      schema_version: "platform-operations-freeze-receipt-queue-row.v1",
      operations_freeze_receipt_queue_row_id: `platform-operations-freeze-receipt-queue.row.${statusRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_status_row_id: statusRow.operations_freeze_status_row_id,
      source_evidence_row_key: statusRow.source_evidence_row_key,
      queue_position: index + 1,
      package_script_name: statusRow.package_script_name,
      invocation: statusRow.invocation,
      evidence_kind: statusRow.evidence_kind,
      expected_report_path: statusRow.expected_report_path,
      required_reviewer_role: statusRow.required_reviewer_role,
      required_signoff_role: statusRow.required_signoff_role,
      receipt_queue_status: queueStatus,
      source_operations_freeze_status: statusRow.operations_freeze_status,
      human_receipt_collection_required: true,
      human_receipt_pending: true,
      ready_for_human_input: true,
      ready_for_validation: false,
      operations_freeze_ready_without_human_receipt: false,
      receipt_received_by_queue: false,
      receipt_validated_by_queue: false,
      ready_for_validation_by_queue: false,
      signoff_completed_by_queue: false,
      approval_applied_by_queue: false,
      status_ledger_consumed_in_memory: true,
      status_ledger_artifact_read_performed_by_queue: false,
      command_execution_performed_by_queue: false,
      package_command_execution_performed_by_queue: false,
      acceptance_command_execution_performed_by_queue: false,
      generated_artifact_read_performed_by_queue: false,
      artifact_read_performed_by_queue: false,
      artifact_write_performed_by_queue: false,
      dependency_install_performed_by_queue: false,
      package_mutation_performed_by_queue: false,
      lockfile_mutation_performed_by_queue: false,
      release_published_by_queue: false,
      git_operation_performed_by_queue: false,
      protected_action_executed_by_queue: false,
      protected_recovery_execution_allowed_by_queue: false,
      trading_live_enabled_by_queue: false,
      trading_full_auto_enabled_by_queue: false,
      trading_order_submission_allowed_by_queue: false,
      broker_write_allowed_by_queue: false,
      exchange_write_allowed_by_queue: false,
      desktop_source_of_truth_by_queue: false,
      desktop_mutation_allowed_by_queue: false,
      secret_exposure_allowed_by_queue: false,
      secret_values_read_by_queue: false,
      env_file_read_by_queue: false,
      desktop_config_content_inspected_by_queue: false,
      desktop_provider_key_visible_by_queue: false,
      credential_lookup_allowed_by_queue: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Receipt queue exposes ${statusRow.invocation} for external human input; it does not receive, validate, or apply a receipt.`,
    };
    return withOrdinalAndHash(row, index, "operations_freeze_receipt_queue_row_hash");
  });
}

function buildQueueGateRows({ statusLedger, packageJson, platformOpsLedger, queueRows, queueBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p489_status_ledger_ready", "P489 operations freeze status ledger source is ready.", statusLedger.validation.valid && statusLedger.summary.platform_operations_freeze_status_ledger_status === SOURCE_READY_STATUS && statusLedger.summary.ready_status_row_count === 7),
    gateRow("platform_package_script_registered", "package.json registers the P490 platform operations freeze receipt queue command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P490 platform operations freeze receipt queue command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p490_ledger_acceptance_declared", "P490 acceptance row is declared in the platform operations ledger.", ledgerText.includes(`P490: \`${COMMAND_NAME}\``)),
    gateRow("queue_rows_ready", "All operations freeze receipt queue rows are queued for external human input.", queueRows.length === 7 && queueRows.every((row) => row.receipt_queue_status === QUEUE_READY_STATUS && row.human_receipt_collection_required && row.human_receipt_pending && row.ready_for_human_input && !row.ready_for_validation && !row.operations_freeze_ready_without_human_receipt)),
    gateRow("human_receipts_still_pending", "Receipt queue records pending human receipt collection without receiving receipts, validating receipts, completing signoff, or applying approval.", queueBoundary.human_receipt_collection_required && queueBoundary.human_receipt_pending && queueBoundary.ready_for_human_input && !queueBoundary.ready_for_validation && !queueBoundary.operations_freeze_ready_without_human_receipt && !queueBoundary.receipt_received && !queueBoundary.receipt_validated && !queueBoundary.signoff_completed && !queueBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Receipt queue executes no commands, reads/writes no artifacts, and performs no package, release, git, or protected mutation.", !queueBoundary.command_execution_performed && !queueBoundary.package_command_execution_performed && !queueBoundary.acceptance_command_execution_performed && !queueBoundary.generated_artifact_read_performed && !queueBoundary.artifact_read_performed && !queueBoundary.artifact_write_performed && !queueBoundary.dependency_install_performed && !queueBoundary.package_mutation_performed && !queueBoundary.lockfile_mutation_performed && !queueBoundary.release_published && !queueBoundary.git_operation_performed && !queueBoundary.protected_action_executed && !queueBoundary.protected_recovery_execution_allowed),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !queueBoundary.trading_live_enabled && !queueBoundary.trading_full_auto_enabled && !queueBoundary.trading_order_submission_allowed && !queueBoundary.broker_write_allowed && !queueBoundary.exchange_write_allowed && !queueBoundary.desktop_source_of_truth && !queueBoundary.desktop_mutation_allowed && !queueBoundary.secret_exposure_allowed && !queueBoundary.secret_values_read && !queueBoundary.env_file_read && !queueBoundary.desktop_config_content_inspected && !queueBoundary.desktop_provider_key_visible && !queueBoundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operations_freeze_receipt_queue_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-operations-freeze-receipt-queue-gate-row.v1",
    operations_freeze_receipt_queue_gate_row_id: `platform-operations-freeze-receipt-queue.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_received_by_queue: false,
    receipt_validated_by_queue: false,
    ready_for_validation_by_queue: false,
    signoff_completed_by_queue: false,
    approval_applied_by_queue: false,
    status_ledger_artifact_read_performed_by_queue: false,
    command_execution_performed_by_queue: false,
    package_command_execution_performed_by_queue: false,
    acceptance_command_execution_performed_by_queue: false,
    generated_artifact_read_performed_by_queue: false,
    artifact_read_performed_by_queue: false,
    artifact_write_performed_by_queue: false,
    release_published_by_queue: false,
    git_operation_performed_by_queue: false,
    protected_action_executed_by_queue: false,
    protected_recovery_execution_allowed_by_queue: false,
    trading_order_submission_allowed_by_queue: false,
    broker_write_allowed_by_queue: false,
    exchange_write_allowed_by_queue: false,
    desktop_source_of_truth_by_queue: false,
    desktop_mutation_allowed_by_queue: false,
    secret_exposure_allowed_by_queue: false,
    secret_values_read_by_queue: false,
    env_file_read_by_queue: false,
    desktop_config_content_inspected_by_queue: false,
    desktop_provider_key_visible_by_queue: false,
    credential_lookup_allowed_by_queue: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-operations-freeze-receipt-queue-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    receipt_queue_artifact_write_requested: writeRequested,
    status_ledger_consumed_in_memory: true,
    status_ledger_artifact_read_performed: false,
    human_receipt_collection_required: true,
    human_receipt_pending: true,
    ready_for_human_input: true,
    ready_for_validation: false,
    operations_freeze_ready_without_human_receipt: false,
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
    human_review_note: "Receipt queue records external human input readiness only; it does not receive, validate, complete, or apply receipts.",
  };
}

function buildValidationItems({ statusLedger, packageJson, platformOpsLedger, queueRows, queueGateRows, queueBoundary }) {
  return [
    validationItem("source.operations_freeze_status_ledger", "p489_status_ledger_ready", statusLedger.validation.valid && statusLedger.summary.platform_operations_freeze_status_ledger_status === SOURCE_READY_STATUS && statusLedger.summary.ready_status_row_count === 7, "P489 operations freeze status ledger source must be ready before P490 receipt queue."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P490 operations freeze receipt queue."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("operations_freeze_receipt_queue_rows", "queue_rows_ready", queueRows.length === 7 && queueRows.every((row) => row.receipt_queue_status === QUEUE_READY_STATUS && row.source_operations_freeze_status === SOURCE_ROW_READY_STATUS && row.human_receipt_collection_required && row.human_receipt_pending && row.ready_for_human_input && !row.ready_for_validation && !row.operations_freeze_ready_without_human_receipt && !row.receipt_received_by_queue && !row.receipt_validated_by_queue && !row.approval_applied_by_queue), "Every operations freeze receipt queue row must be queued for external human input while receipts remain pending."),
    validationItem("operations_freeze_receipt_queue_gate_rows", "queue_gates_ready", queueGateRows.length >= 8 && queueGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_queue && !row.protected_action_executed_by_queue), "P490 operations freeze receipt queue gates must be ready and queue-only."),
    validationItem("boundary.receipts_pending", "receipts_pending", queueBoundary.read_only && queueBoundary.report_only && queueBoundary.status_ledger_consumed_in_memory && !queueBoundary.status_ledger_artifact_read_performed && queueBoundary.human_receipt_collection_required && queueBoundary.human_receipt_pending && queueBoundary.ready_for_human_input && !queueBoundary.ready_for_validation && !queueBoundary.operations_freeze_ready_without_human_receipt && !queueBoundary.receipt_received && !queueBoundary.receipt_validated && !queueBoundary.signoff_completed && !queueBoundary.approval_applied, "P490 receipt queue remains pending human receipts and does not complete signoff."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !queueBoundary.command_execution_performed && !queueBoundary.package_command_execution_performed && !queueBoundary.acceptance_command_execution_performed && !queueBoundary.generated_artifact_read_performed && !queueBoundary.artifact_read_performed && !queueBoundary.artifact_write_performed, "P490 receipt queue does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !queueBoundary.dependency_install_performed && !queueBoundary.package_mutation_performed && !queueBoundary.lockfile_mutation_performed && !queueBoundary.release_published && !queueBoundary.git_operation_performed && !queueBoundary.protected_action_executed && !queueBoundary.protected_recovery_execution_allowed, "P490 receipt queue performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !queueBoundary.trading_live_enabled && !queueBoundary.trading_full_auto_enabled && !queueBoundary.trading_order_submission_allowed && !queueBoundary.broker_write_allowed && !queueBoundary.exchange_write_allowed && !queueBoundary.desktop_source_of_truth && !queueBoundary.desktop_mutation_allowed && !queueBoundary.secret_exposure_allowed && !queueBoundary.secret_values_read && !queueBoundary.env_file_read && !queueBoundary.desktop_config_content_inspected && !queueBoundary.desktop_provider_key_visible && !queueBoundary.credential_lookup_allowed, "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled."),
  ];
}

function buildSummary({ statusLedger, queueRows, queueGateRows, queueBoundary, validation }) {
  return {
    platform_operations_freeze_receipt_queue_status: validation.valid ? QUEUE_READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_status_ledger_status: statusLedger.summary.platform_operations_freeze_status_ledger_status,
    queue_row_count: queueRows.length,
    ready_queue_row_count: queueRows.filter((row) => row.receipt_queue_status === QUEUE_READY_STATUS).length,
    queue_gate_count: queueGateRows.length,
    ready_queue_gate_count: queueGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: queueBoundary.read_only,
    report_only: queueBoundary.report_only,
    receipt_queue_artifact_write_requested: queueBoundary.receipt_queue_artifact_write_requested,
    status_ledger_consumed_in_memory: queueBoundary.status_ledger_consumed_in_memory,
    status_ledger_artifact_read_performed: queueBoundary.status_ledger_artifact_read_performed,
    human_receipt_collection_required: queueBoundary.human_receipt_collection_required,
    human_receipt_pending: queueBoundary.human_receipt_pending,
    ready_for_human_input: queueBoundary.ready_for_human_input,
    ready_for_validation: queueBoundary.ready_for_validation,
    operations_freeze_ready_without_human_receipt: queueBoundary.operations_freeze_ready_without_human_receipt,
    receipt_received: queueBoundary.receipt_received,
    receipt_validated: queueBoundary.receipt_validated,
    signoff_completed: queueBoundary.signoff_completed,
    approval_applied: queueBoundary.approval_applied,
    command_execution_performed: queueBoundary.command_execution_performed,
    package_command_execution_performed: queueBoundary.package_command_execution_performed,
    acceptance_command_execution_performed: queueBoundary.acceptance_command_execution_performed,
    generated_artifact_read_performed: queueBoundary.generated_artifact_read_performed,
    artifact_read_performed: queueBoundary.artifact_read_performed,
    artifact_write_performed: queueBoundary.artifact_write_performed,
    dependency_install_performed: queueBoundary.dependency_install_performed,
    package_mutation_performed: queueBoundary.package_mutation_performed,
    lockfile_mutation_performed: queueBoundary.lockfile_mutation_performed,
    release_published: queueBoundary.release_published,
    git_operation_performed: queueBoundary.git_operation_performed,
    protected_action_executed: queueBoundary.protected_action_executed,
    protected_recovery_execution_allowed: queueBoundary.protected_recovery_execution_allowed,
    trading_live_enabled: queueBoundary.trading_live_enabled,
    trading_full_auto_enabled: queueBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: queueBoundary.trading_order_submission_allowed,
    broker_write_allowed: queueBoundary.broker_write_allowed,
    exchange_write_allowed: queueBoundary.exchange_write_allowed,
    desktop_source_of_truth: queueBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: queueBoundary.desktop_mutation_allowed,
    secret_exposure_allowed: queueBoundary.secret_exposure_allowed,
    secret_values_read: queueBoundary.secret_values_read,
    env_file_read: queueBoundary.env_file_read,
    desktop_config_content_inspected: queueBoundary.desktop_config_content_inspected,
    desktop_provider_key_visible: queueBoundary.desktop_provider_key_visible,
    credential_lookup_allowed: queueBoundary.credential_lookup_allowed,
    human_review_required: queueBoundary.human_review_required,
    human_signoff_required: queueBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Operations Freeze Receipt Queue",
    "",
    `Status: ${result.summary.platform_operations_freeze_receipt_queue_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source status ledger: ${result.summary.source_status_ledger_status}`,
    `Queue rows: ${result.summary.ready_queue_row_count}/${result.summary.queue_row_count}`,
    `Queue gates: ${result.summary.ready_queue_gate_count}/${result.summary.queue_gate_count}`,
    "",
    "## Queue Rows",
    "",
    ...result.operations_freeze_receipt_queue_rows.map((row) => `- ${row.queue_position}. ${row.invocation} (${row.required_signoff_role}): ${row.receipt_queue_status}`),
    "",
    "## Queue Gates",
    "",
    ...result.operations_freeze_receipt_queue_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_OUT_DIR };
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
    else if (arg === "--status-ledger-schema") parsed.operationsFreezeStatusLedgerSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operations-freeze-receipt-queue.mjs [options]

Options:
  --out-dir <folder>                  Output directory. Default: ${DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_OUT_DIR}
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
  --status-ledger-schema <path>       P489 status ledger schema path.
  --schema <path>                     Output schema path.
  --check                             Validate only, do not write artifacts.
  -h, --help                          Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_INPUTS.platformOpsLedgerPath),
    operations_freeze_source_inventory_schema_path: path.resolve(options.operationsFreezeSourceInventorySchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_INPUTS.operationsFreezeSourceInventorySchemaPath),
    operations_freeze_command_matrix_schema_path: path.resolve(options.operationsFreezeCommandMatrixSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_INPUTS.operationsFreezeCommandMatrixSchemaPath),
    operations_freeze_evidence_index_schema_path: path.resolve(options.operationsFreezeEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_INPUTS.operationsFreezeEvidenceIndexSchemaPath),
    operations_freeze_review_packet_schema_path: path.resolve(options.operationsFreezeReviewPacketSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_INPUTS.operationsFreezeReviewPacketSchemaPath),
    operations_freeze_signoff_ledger_schema_path: path.resolve(options.operationsFreezeSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_INPUTS.operationsFreezeSignoffLedgerSchemaPath),
    operations_freeze_signoff_receipt_template_schema_path: path.resolve(options.operationsFreezeSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_INPUTS.operationsFreezeSignoffReceiptTemplateSchemaPath),
    operations_freeze_signoff_receipt_intake_schema_path: path.resolve(options.operationsFreezeSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_INPUTS.operationsFreezeSignoffReceiptIntakeSchemaPath),
    operations_freeze_signoff_closeout_schema_path: path.resolve(options.operationsFreezeSignoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_INPUTS.operationsFreezeSignoffCloseoutSchemaPath),
    operations_freeze_status_ledger_schema_path: path.resolve(options.operationsFreezeStatusLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_INPUTS.operationsFreezeStatusLedgerSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_INPUTS.schemaPath),
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
    validation_item_id: `platform-operations-freeze-receipt-queue.${slugify(itemPath)}.${checkId}`,
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
