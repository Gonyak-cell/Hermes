import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_INTAKE_INPUTS,
  buildPlatformOperationsFreezeSignoffReceiptIntake,
} from "./platform-operations-freeze-signoff-receipt-intake.mjs";

export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_CLOSEOUT_OUT_DIR = "artifacts/platform-operations-freeze-signoff-closeout/latest";
export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_CLOSEOUT_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_INTAKE_INPUTS,
  operationsFreezeSignoffReceiptIntakeSchemaPath: DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_INTAKE_INPUTS.schemaPath,
  schemaPath: "schemas/platform-operations-freeze-signoff-closeout.schema.json",
};

const COMMAND_NAME = "platform:operations-freeze-signoff-closeout";
const SCHEMA_VERSION = "platform-operations-freeze-signoff-closeout.v1";
const CAPABILITY_ID = "platform.operations_freeze_signoff_closeout";
const PHASE_SLOT = "P488";
const PREVIOUS_PHASE_SLOT = "P487";
const NEXT_PHASE_SLOT = "P489";
const SOURCE_READY_STATUS = "ready_for_operations_freeze_signoff_receipt_intake";
const CLOSEOUT_READY_STATUS = "ready_for_operations_freeze_signoff_closeout";
const ROW_READY_STATUS = "ready_for_human_receipt_collection";

export async function runPlatformOperationsFreezeSignoffCloseout(options = {}) {
  const result = await buildPlatformOperationsFreezeSignoffCloseout(options);
  if (options.write !== false) await writePlatformOperationsFreezeSignoffCloseout(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operations freeze signoff closeout failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperationsFreezeSignoffCloseout(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_CLOSEOUT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const receiptIntake = await buildPlatformOperationsFreezeSignoffReceiptIntake({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    operationsFreezeSourceInventorySchemaPath: inputs.operations_freeze_source_inventory_schema_path,
    operationsFreezeCommandMatrixSchemaPath: inputs.operations_freeze_command_matrix_schema_path,
    operationsFreezeEvidenceIndexSchemaPath: inputs.operations_freeze_evidence_index_schema_path,
    operationsFreezeReviewPacketSchemaPath: inputs.operations_freeze_review_packet_schema_path,
    operationsFreezeSignoffLedgerSchemaPath: inputs.operations_freeze_signoff_ledger_schema_path,
    operationsFreezeSignoffReceiptTemplateSchemaPath: inputs.operations_freeze_signoff_receipt_template_schema_path,
    schemaPath: inputs.operations_freeze_signoff_receipt_intake_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const closeoutRows = buildCloseoutRows({ receiptIntake });
  const closeoutBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const closeoutAnchor = buildCloseoutAnchor({ receiptIntake, packageJson, platformOpsLedger, closeoutRows });
  const closeoutGateRows = buildCloseoutGateRows({
    receiptIntake,
    packageJson,
    platformOpsLedger,
    closeoutRows,
    closeoutBoundary,
  });
  const validationItems = buildValidationItems({
    receiptIntake,
    packageJson,
    platformOpsLedger,
    closeoutRows,
    closeoutGateRows,
    closeoutBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ receiptIntake, closeoutRows, closeoutGateRows, closeoutBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operations_freeze_signoff_closeout_id: `platform-operations-freeze-signoff-closeout.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operations_freeze_signoff_closeout_anchor: closeoutAnchor,
    operations_freeze_signoff_closeout_rows: closeoutRows,
    operations_freeze_signoff_closeout_gate_rows: closeoutGateRows,
    operations_freeze_signoff_closeout_boundary: closeoutBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operations_freeze_signoff_closeout") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ receiptIntake, closeoutRows, closeoutGateRows, closeoutBoundary, validation: result.validation });
  result.summary.platform_operations_freeze_signoff_closeout_id = result.platform_operations_freeze_signoff_closeout_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperationsFreezeSignoffCloseout(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-operations-freeze-signoff-closeout.json"), serializableResult(result));
  await writeJson(path.join(outDir, "freeze-signoff-closeout-rows.json"), collectionEnvelope("platform-operations-freeze-signoff-closeout-rows.v1", "operations_freeze_signoff_closeout_rows", result.operations_freeze_signoff_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-signoff-closeout-gate-rows.json"), collectionEnvelope("platform-operations-freeze-signoff-closeout-gate-rows.v1", "operations_freeze_signoff_closeout_gate_rows", result.operations_freeze_signoff_closeout_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-signoff-closeout-boundary.json"), result.operations_freeze_signoff_closeout_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operations-freeze-signoff-closeout-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperationsFreezeSignoffCloseoutCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperationsFreezeSignoffCloseout(args);
    console.log(`Platform operations freeze signoff closeout ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operations_freeze_signoff_closeout_status}`);
    console.log(`Closeout rows: ${result.summary.ready_closeout_row_count}/${result.summary.closeout_row_count}`);
    console.log(`Closeout gates: ${result.summary.ready_closeout_gate_count}/${result.summary.closeout_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildCloseoutAnchor({ receiptIntake, packageJson, platformOpsLedger, closeoutRows }) {
  return {
    schema_version: "platform-operations-freeze-signoff-closeout-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_intake_id: receiptIntake.platform_operations_freeze_signoff_receipt_intake_id,
    source_receipt_intake_status: receiptIntake.summary.platform_operations_freeze_signoff_receipt_intake_status,
    source_receipt_intake_hash: hashValue({
      id: receiptIntake.platform_operations_freeze_signoff_receipt_intake_id,
      status: receiptIntake.summary.platform_operations_freeze_signoff_receipt_intake_status,
      intake_rows: receiptIntake.summary.intake_row_count,
      ready_intake_rows: receiptIntake.summary.ready_intake_row_count,
      gate_rows: receiptIntake.summary.intake_gate_count,
    }),
    package_json_hash: packageJson.content_hash,
    platform_ops_ledger_hash: platformOpsLedger.content_hash,
    closeout_hash: hashValue(closeoutRows.map((row) => ({
      row_key: row.source_evidence_row_key,
      closeout_status: row.closeout_status,
      human_receipt_collection_required: row.human_receipt_collection_required,
    }))),
  };
}

function buildCloseoutRows({ receiptIntake }) {
  const sourceReady = receiptIntake.validation.valid && receiptIntake.summary.platform_operations_freeze_signoff_receipt_intake_status === SOURCE_READY_STATUS;
  return receiptIntake.operations_freeze_signoff_receipt_intake_rows.map((intakeRow, index) => {
    const closeoutStatus = sourceReady && intakeRow.receipt_intake_status === "awaiting_human_receipt" ? ROW_READY_STATUS : "blocked";
    const row = {
      schema_version: "platform-operations-freeze-signoff-closeout-row.v1",
      operations_freeze_signoff_closeout_row_id: `platform-operations-freeze-signoff-closeout.row.${intakeRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_receipt_intake_row_id: intakeRow.operations_freeze_signoff_receipt_intake_row_id,
      source_signoff_row_id: intakeRow.source_signoff_row_id,
      source_evidence_row_key: intakeRow.source_evidence_row_key,
      package_script_name: intakeRow.package_script_name,
      invocation: intakeRow.invocation,
      evidence_kind: intakeRow.evidence_kind,
      expected_report_path: intakeRow.expected_report_path,
      human_review_evidence_slot: intakeRow.human_review_evidence_slot,
      required_reviewer_role: intakeRow.required_reviewer_role,
      required_signoff_role: intakeRow.required_signoff_role,
      required_receipt_type: intakeRow.required_receipt_type,
      required_receipt_fields: intakeRow.required_receipt_fields,
      allowed_decisions: intakeRow.allowed_decisions,
      closeout_status: closeoutStatus,
      source_receipt_intake_status: intakeRow.receipt_intake_status,
      source_receipt_template_status: intakeRow.source_receipt_template_status,
      source_signoff_status: intakeRow.source_signoff_status,
      source_review_packet_status: intakeRow.source_review_packet_status,
      source_evidence_status: intakeRow.source_evidence_status,
      human_receipt_collection_required: true,
      receipt_received_by_closeout: false,
      receipt_validated_by_closeout: false,
      ready_for_validation_by_closeout: false,
      signoff_completed_by_closeout: false,
      approval_applied_by_closeout: false,
      receipt_materialized_by_closeout: false,
      receipt_intake_consumed_in_memory: true,
      receipt_intake_artifact_read_performed_by_closeout: false,
      command_execution_performed_by_closeout: false,
      package_command_execution_performed_by_closeout: false,
      acceptance_command_execution_performed_by_closeout: false,
      generated_artifact_read_performed_by_closeout: false,
      artifact_read_performed_by_closeout: false,
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
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Closeout marks ${intakeRow.invocation} ready for external human receipt collection; it does not receive, validate, complete, or apply the receipt.`,
    };
    return withOrdinalAndHash(row, index, "operations_freeze_signoff_closeout_row_hash");
  });
}

function buildCloseoutGateRows({ receiptIntake, packageJson, platformOpsLedger, closeoutRows, closeoutBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p487_receipt_intake_ready", "P487 operations freeze signoff receipt intake source is ready.", receiptIntake.validation.valid && receiptIntake.summary.platform_operations_freeze_signoff_receipt_intake_status === SOURCE_READY_STATUS && receiptIntake.summary.ready_intake_row_count === 7),
    gateRow("platform_package_script_registered", "package.json registers the P488 platform operations freeze signoff closeout command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P488 platform operations freeze signoff closeout command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p488_ledger_acceptance_declared", "P488 acceptance row is declared in the platform operations ledger.", ledgerText.includes(`P488: \`${COMMAND_NAME}\``)),
    gateRow("closeout_rows_ready", "All operations freeze signoff closeout rows are ready for external human receipt collection.", closeoutRows.length === 7 && closeoutRows.every((row) => row.closeout_status === ROW_READY_STATUS && row.human_receipt_collection_required)),
    gateRow("no_receipt_validation_or_approval_application", "Closeout records readiness without receiving or validating receipts, completing signoff, or applying approval.", !closeoutBoundary.receipt_received && !closeoutBoundary.receipt_validated && !closeoutBoundary.ready_for_validation && !closeoutBoundary.signoff_completed && !closeoutBoundary.approval_applied && !closeoutBoundary.receipt_materialized),
    gateRow("no_command_or_artifact_mutation", "Closeout executes no commands, reads/writes no artifacts, and performs no package, release, git, or protected mutation.", !closeoutBoundary.command_execution_performed && !closeoutBoundary.package_command_execution_performed && !closeoutBoundary.acceptance_command_execution_performed && !closeoutBoundary.generated_artifact_read_performed && !closeoutBoundary.artifact_read_performed && !closeoutBoundary.artifact_write_performed && !closeoutBoundary.dependency_install_performed && !closeoutBoundary.package_mutation_performed && !closeoutBoundary.lockfile_mutation_performed && !closeoutBoundary.release_published && !closeoutBoundary.git_operation_performed && !closeoutBoundary.protected_action_executed && !closeoutBoundary.protected_recovery_execution_allowed),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !closeoutBoundary.trading_live_enabled && !closeoutBoundary.trading_full_auto_enabled && !closeoutBoundary.trading_order_submission_allowed && !closeoutBoundary.broker_write_allowed && !closeoutBoundary.exchange_write_allowed && !closeoutBoundary.desktop_source_of_truth && !closeoutBoundary.desktop_mutation_allowed && !closeoutBoundary.secret_exposure_allowed && !closeoutBoundary.secret_values_read && !closeoutBoundary.env_file_read && !closeoutBoundary.desktop_config_content_inspected && !closeoutBoundary.desktop_provider_key_visible && !closeoutBoundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operations_freeze_signoff_closeout_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-operations-freeze-signoff-closeout-gate-row.v1",
    operations_freeze_signoff_closeout_gate_row_id: `platform-operations-freeze-signoff-closeout.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_received_by_closeout: false,
    receipt_validated_by_closeout: false,
    ready_for_validation_by_closeout: false,
    signoff_completed_by_closeout: false,
    approval_applied_by_closeout: false,
    receipt_materialized_by_closeout: false,
    receipt_intake_artifact_read_performed_by_closeout: false,
    command_execution_performed_by_closeout: false,
    package_command_execution_performed_by_closeout: false,
    acceptance_command_execution_performed_by_closeout: false,
    generated_artifact_read_performed_by_closeout: false,
    artifact_read_performed_by_closeout: false,
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
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-operations-freeze-signoff-closeout-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    closeout_artifact_write_requested: writeRequested,
    receipt_intake_consumed_in_memory: true,
    receipt_intake_artifact_read_performed: false,
    receipt_received: false,
    receipt_validated: false,
    ready_for_validation: false,
    human_receipt_collection_required: true,
    signoff_completed: false,
    approval_applied: false,
    receipt_materialized: false,
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
    human_review_note: "Signoff closeout rows declare readiness for external human receipt collection; this command does not receive, validate, complete, or apply receipts.",
  };
}

function buildValidationItems({ receiptIntake, packageJson, platformOpsLedger, closeoutRows, closeoutGateRows, closeoutBoundary }) {
  return [
    validationItem("source.operations_freeze_signoff_receipt_intake", "p487_receipt_intake_ready", receiptIntake.validation.valid && receiptIntake.summary.platform_operations_freeze_signoff_receipt_intake_status === SOURCE_READY_STATUS && receiptIntake.summary.ready_intake_row_count === 7, "P487 operations freeze signoff receipt intake source must be ready before P488 closeout."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P488 operations freeze signoff closeout."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("operations_freeze_signoff_closeout_rows", "closeout_rows_ready", closeoutRows.length === 7 && closeoutRows.every((row) => row.closeout_status === ROW_READY_STATUS && row.human_receipt_collection_required && !row.receipt_received_by_closeout && !row.receipt_validated_by_closeout && !row.signoff_completed_by_closeout && !row.approval_applied_by_closeout), "Every operations freeze signoff closeout row must be ready for external human receipt collection without receiving receipts."),
    validationItem("operations_freeze_signoff_closeout_gate_rows", "closeout_gates_ready", closeoutGateRows.length >= 8 && closeoutGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_closeout && !row.protected_action_executed_by_closeout), "P488 operations freeze signoff closeout gates must be ready and closeout-only."),
    validationItem("boundary.signoff_not_completed", "signoff_not_completed", closeoutBoundary.read_only && closeoutBoundary.report_only && closeoutBoundary.receipt_intake_consumed_in_memory && !closeoutBoundary.receipt_intake_artifact_read_performed && closeoutBoundary.human_receipt_collection_required && !closeoutBoundary.receipt_received && !closeoutBoundary.receipt_validated && !closeoutBoundary.ready_for_validation && !closeoutBoundary.signoff_completed && !closeoutBoundary.approval_applied && !closeoutBoundary.receipt_materialized, "P488 closeout consumes P487 in memory and does not receive, validate, complete, or apply receipts."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !closeoutBoundary.command_execution_performed && !closeoutBoundary.package_command_execution_performed && !closeoutBoundary.acceptance_command_execution_performed && !closeoutBoundary.generated_artifact_read_performed && !closeoutBoundary.artifact_read_performed && !closeoutBoundary.artifact_write_performed, "P488 closeout does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !closeoutBoundary.dependency_install_performed && !closeoutBoundary.package_mutation_performed && !closeoutBoundary.lockfile_mutation_performed && !closeoutBoundary.release_published && !closeoutBoundary.git_operation_performed && !closeoutBoundary.protected_action_executed && !closeoutBoundary.protected_recovery_execution_allowed, "P488 closeout performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !closeoutBoundary.trading_live_enabled && !closeoutBoundary.trading_full_auto_enabled && !closeoutBoundary.trading_order_submission_allowed && !closeoutBoundary.broker_write_allowed && !closeoutBoundary.exchange_write_allowed && !closeoutBoundary.desktop_source_of_truth && !closeoutBoundary.desktop_mutation_allowed && !closeoutBoundary.secret_exposure_allowed && !closeoutBoundary.secret_values_read && !closeoutBoundary.env_file_read && !closeoutBoundary.desktop_config_content_inspected && !closeoutBoundary.desktop_provider_key_visible && !closeoutBoundary.credential_lookup_allowed, "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled."),
  ];
}

function buildSummary({ receiptIntake, closeoutRows, closeoutGateRows, closeoutBoundary, validation }) {
  return {
    platform_operations_freeze_signoff_closeout_status: validation.valid ? CLOSEOUT_READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_intake_status: receiptIntake.summary.platform_operations_freeze_signoff_receipt_intake_status,
    closeout_row_count: closeoutRows.length,
    ready_closeout_row_count: closeoutRows.filter((row) => row.closeout_status === ROW_READY_STATUS).length,
    closeout_gate_count: closeoutGateRows.length,
    ready_closeout_gate_count: closeoutGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: closeoutBoundary.read_only,
    report_only: closeoutBoundary.report_only,
    closeout_artifact_write_requested: closeoutBoundary.closeout_artifact_write_requested,
    receipt_intake_consumed_in_memory: closeoutBoundary.receipt_intake_consumed_in_memory,
    receipt_intake_artifact_read_performed: closeoutBoundary.receipt_intake_artifact_read_performed,
    receipt_received: closeoutBoundary.receipt_received,
    receipt_validated: closeoutBoundary.receipt_validated,
    ready_for_validation: closeoutBoundary.ready_for_validation,
    human_receipt_collection_required: closeoutBoundary.human_receipt_collection_required,
    signoff_completed: closeoutBoundary.signoff_completed,
    approval_applied: closeoutBoundary.approval_applied,
    receipt_materialized: closeoutBoundary.receipt_materialized,
    command_execution_performed: closeoutBoundary.command_execution_performed,
    package_command_execution_performed: closeoutBoundary.package_command_execution_performed,
    acceptance_command_execution_performed: closeoutBoundary.acceptance_command_execution_performed,
    generated_artifact_read_performed: closeoutBoundary.generated_artifact_read_performed,
    artifact_read_performed: closeoutBoundary.artifact_read_performed,
    artifact_write_performed: closeoutBoundary.artifact_write_performed,
    dependency_install_performed: closeoutBoundary.dependency_install_performed,
    package_mutation_performed: closeoutBoundary.package_mutation_performed,
    lockfile_mutation_performed: closeoutBoundary.lockfile_mutation_performed,
    release_published: closeoutBoundary.release_published,
    git_operation_performed: closeoutBoundary.git_operation_performed,
    protected_action_executed: closeoutBoundary.protected_action_executed,
    protected_recovery_execution_allowed: closeoutBoundary.protected_recovery_execution_allowed,
    trading_live_enabled: closeoutBoundary.trading_live_enabled,
    trading_full_auto_enabled: closeoutBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: closeoutBoundary.trading_order_submission_allowed,
    broker_write_allowed: closeoutBoundary.broker_write_allowed,
    exchange_write_allowed: closeoutBoundary.exchange_write_allowed,
    desktop_source_of_truth: closeoutBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: closeoutBoundary.desktop_mutation_allowed,
    secret_exposure_allowed: closeoutBoundary.secret_exposure_allowed,
    secret_values_read: closeoutBoundary.secret_values_read,
    env_file_read: closeoutBoundary.env_file_read,
    desktop_config_content_inspected: closeoutBoundary.desktop_config_content_inspected,
    desktop_provider_key_visible: closeoutBoundary.desktop_provider_key_visible,
    credential_lookup_allowed: closeoutBoundary.credential_lookup_allowed,
    human_review_required: closeoutBoundary.human_review_required,
    human_signoff_required: closeoutBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Operations Freeze Signoff Closeout",
    "",
    `Status: ${result.summary.platform_operations_freeze_signoff_closeout_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source receipt intake: ${result.summary.source_receipt_intake_status}`,
    `Closeout rows: ${result.summary.ready_closeout_row_count}/${result.summary.closeout_row_count}`,
    `Closeout gates: ${result.summary.ready_closeout_gate_count}/${result.summary.closeout_gate_count}`,
    "",
    "## Closeout Rows",
    "",
    ...result.operations_freeze_signoff_closeout_rows.map((row) => `- ${row.invocation} (${row.required_signoff_role}): ${row.closeout_status}`),
    "",
    "## Closeout Gates",
    "",
    ...result.operations_freeze_signoff_closeout_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_CLOSEOUT_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operations-freeze-signoff-closeout.mjs [options]

Options:
  --out-dir <folder>                  Output directory. Default: ${DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_CLOSEOUT_OUT_DIR}
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
  --schema <path>                     Output schema path.
  --check                             Validate only, do not write artifacts.
  -h, --help                          Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_CLOSEOUT_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_CLOSEOUT_INPUTS.platformOpsLedgerPath),
    operations_freeze_source_inventory_schema_path: path.resolve(options.operationsFreezeSourceInventorySchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_CLOSEOUT_INPUTS.operationsFreezeSourceInventorySchemaPath),
    operations_freeze_command_matrix_schema_path: path.resolve(options.operationsFreezeCommandMatrixSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_CLOSEOUT_INPUTS.operationsFreezeCommandMatrixSchemaPath),
    operations_freeze_evidence_index_schema_path: path.resolve(options.operationsFreezeEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_CLOSEOUT_INPUTS.operationsFreezeEvidenceIndexSchemaPath),
    operations_freeze_review_packet_schema_path: path.resolve(options.operationsFreezeReviewPacketSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_CLOSEOUT_INPUTS.operationsFreezeReviewPacketSchemaPath),
    operations_freeze_signoff_ledger_schema_path: path.resolve(options.operationsFreezeSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_CLOSEOUT_INPUTS.operationsFreezeSignoffLedgerSchemaPath),
    operations_freeze_signoff_receipt_template_schema_path: path.resolve(options.operationsFreezeSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_CLOSEOUT_INPUTS.operationsFreezeSignoffReceiptTemplateSchemaPath),
    operations_freeze_signoff_receipt_intake_schema_path: path.resolve(options.operationsFreezeSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_CLOSEOUT_INPUTS.operationsFreezeSignoffReceiptIntakeSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_CLOSEOUT_INPUTS.schemaPath),
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
    validation_item_id: `platform-operations-freeze-signoff-closeout.${slugify(itemPath)}.${checkId}`,
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
