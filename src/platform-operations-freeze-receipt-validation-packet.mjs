import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS,
  buildPlatformOperationsFreezeReceiptMergePreflight,
} from "./platform-operations-freeze-receipt-merge-preflight.mjs";

export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_OUT_DIR = "artifacts/platform-operations-freeze-receipt-validation-packet/latest";
export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS,
  operationsFreezeReceiptMergePreflightSchemaPath: DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS.schemaPath,
  schemaPath: "schemas/platform-operations-freeze-receipt-validation-packet.schema.json",
};

const COMMAND_NAME = "platform:operations-freeze-receipt-validation-packet";
const SCHEMA_VERSION = "platform-operations-freeze-receipt-validation-packet.v1";
const CAPABILITY_ID = "platform.operations_freeze_receipt_validation_packet";
const PHASE_SLOT = "P495";
const PREVIOUS_PHASE_SLOT = "P494";
const NEXT_PHASE_SLOT = "P496";
const SOURCE_READY_STATUS = "ready_for_future_receipt_merge_validation";
const PACKET_READY_STATUS = "ready_for_future_receipt_validation_packet";
const VALIDATION_PACKET_CHECKS = [
  "reviewer_id_present",
  "reviewed_at_iso_timestamp",
  "source_signoff_row_id_matches",
  "decision_allowed",
  "evidence_reference_present",
  "command_result_reference_present",
  "blocker_note_present",
];

export async function runPlatformOperationsFreezeReceiptValidationPacket(options = {}) {
  const result = await buildPlatformOperationsFreezeReceiptValidationPacket(options);
  if (options.write !== false) await writePlatformOperationsFreezeReceiptValidationPacket(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operations freeze receipt validation packet failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperationsFreezeReceiptValidationPacket(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_OUT_DIR);
  const inputs = normalizeInputs(options);
  const mergePreflight = await buildPlatformOperationsFreezeReceiptMergePreflight({
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
    schemaPath: inputs.operations_freeze_receipt_merge_preflight_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const packetRows = buildPacketRows({ mergePreflight });
  const packetBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const packetAnchor = buildPacketAnchor({ mergePreflight, packageJson, platformOpsLedger, packetRows });
  const packetGateRows = buildPacketGateRows({ mergePreflight, packageJson, platformOpsLedger, packetRows, packetBoundary });
  const validationItems = buildValidationItems({ mergePreflight, packageJson, platformOpsLedger, packetRows, packetGateRows, packetBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ mergePreflight, packetRows, packetGateRows, packetBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operations_freeze_receipt_validation_packet_id: `platform-operations-freeze-receipt-validation-packet.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operations_freeze_receipt_validation_packet_anchor: packetAnchor,
    operations_freeze_receipt_validation_packet_rows: packetRows,
    operations_freeze_receipt_validation_packet_gate_rows: packetGateRows,
    operations_freeze_receipt_validation_packet_boundary: packetBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operations_freeze_receipt_validation_packet") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ mergePreflight, packetRows, packetGateRows, packetBoundary, validation: result.validation });
  result.summary.platform_operations_freeze_receipt_validation_packet_id = result.platform_operations_freeze_receipt_validation_packet_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperationsFreezeReceiptValidationPacket(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-operations-freeze-receipt-validation-packet.json"), serializableResult(result));
  await writeJson(path.join(outDir, "freeze-receipt-validation-packet-rows.json"), collectionEnvelope("platform-operations-freeze-receipt-validation-packet-rows.v1", "operations_freeze_receipt_validation_packet_rows", result.operations_freeze_receipt_validation_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-receipt-validation-packet-gate-rows.json"), collectionEnvelope("platform-operations-freeze-receipt-validation-packet-gate-rows.v1", "operations_freeze_receipt_validation_packet_gate_rows", result.operations_freeze_receipt_validation_packet_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-receipt-validation-packet-boundary.json"), result.operations_freeze_receipt_validation_packet_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operations-freeze-receipt-validation-packet-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperationsFreezeReceiptValidationPacketCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperationsFreezeReceiptValidationPacket(args);
    console.log(`Platform operations freeze receipt validation packet ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operations_freeze_receipt_validation_packet_status}`);
    console.log(`Packet rows: ${result.summary.ready_packet_row_count}/${result.summary.packet_row_count}`);
    console.log(`Packet gates: ${result.summary.ready_packet_gate_count}/${result.summary.packet_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPacketAnchor({ mergePreflight, packageJson, platformOpsLedger, packetRows }) {
  return {
    schema_version: "platform-operations-freeze-receipt-validation-packet-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_merge_preflight_id: mergePreflight.platform_operations_freeze_receipt_merge_preflight_id,
    source_receipt_merge_preflight_status: mergePreflight.summary.platform_operations_freeze_receipt_merge_preflight_status,
    source_receipt_merge_preflight_hash: hashValue({
      id: mergePreflight.platform_operations_freeze_receipt_merge_preflight_id,
      status: mergePreflight.summary.platform_operations_freeze_receipt_merge_preflight_status,
      preflight_rows: mergePreflight.summary.preflight_row_count,
      ready_preflight_rows: mergePreflight.summary.ready_preflight_row_count,
      gate_rows: mergePreflight.summary.preflight_gate_count,
    }),
    package_json_hash: packageJson.content_hash,
    platform_ops_ledger_hash: platformOpsLedger.content_hash,
    packet_rows_hash: hashValue(packetRows.map((row) => ({
      row_key: row.source_evidence_row_key,
      validation_packet_status: row.validation_packet_status,
      receipt_payload_present: row.receipt_payload_present,
    }))),
  };
}

function buildPacketRows({ mergePreflight }) {
  const sourceReady = mergePreflight.validation.valid && mergePreflight.summary.platform_operations_freeze_receipt_merge_preflight_status === SOURCE_READY_STATUS;
  return mergePreflight.operations_freeze_receipt_merge_preflight_rows.map((preflightRow, index) => {
    const packetStatus = sourceReady && preflightRow.preflight_status === SOURCE_READY_STATUS ? PACKET_READY_STATUS : "blocked";
    const row = {
      schema_version: "platform-operations-freeze-receipt-validation-packet-row.v1",
      operations_freeze_receipt_validation_packet_row_id: `platform-operations-freeze-receipt-validation-packet.row.${preflightRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_merge_preflight_row_id: preflightRow.operations_freeze_receipt_merge_preflight_row_id,
      source_evidence_row_key: preflightRow.source_evidence_row_key,
      queue_position: preflightRow.queue_position,
      package_script_name: preflightRow.package_script_name,
      invocation: preflightRow.invocation,
      evidence_kind: preflightRow.evidence_kind,
      expected_report_path: preflightRow.expected_report_path,
      required_reviewer_role: preflightRow.required_reviewer_role,
      required_signoff_role: preflightRow.required_signoff_role,
      validation_packet_status: packetStatus,
      source_merge_preflight_status: preflightRow.preflight_status,
      actor_workspace_required: true,
      actor_workspace_input_present: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      validation_packet_declared: true,
      validation_packet_checks: VALIDATION_PACKET_CHECKS,
      ready_for_validation: false,
      receipt_received_by_packet: false,
      receipt_validated_by_packet: false,
      signoff_completed_by_packet: false,
      approval_applied_by_packet: false,
      receipt_merge_preflight_consumed_in_memory: true,
      receipt_merge_preflight_artifact_read_performed_by_packet: false,
      command_execution_performed_by_packet: false,
      package_command_execution_performed_by_packet: false,
      acceptance_command_execution_performed_by_packet: false,
      generated_artifact_read_performed_by_packet: false,
      artifact_read_performed_by_packet: false,
      artifact_write_performed_by_packet: false,
      dependency_install_performed_by_packet: false,
      package_mutation_performed_by_packet: false,
      lockfile_mutation_performed_by_packet: false,
      release_published_by_packet: false,
      git_operation_performed_by_packet: false,
      protected_action_executed_by_packet: false,
      protected_recovery_execution_allowed_by_packet: false,
      trading_live_enabled_by_packet: false,
      trading_full_auto_enabled_by_packet: false,
      trading_order_submission_allowed_by_packet: false,
      broker_write_allowed_by_packet: false,
      exchange_write_allowed_by_packet: false,
      desktop_source_of_truth_by_packet: false,
      desktop_mutation_allowed_by_packet: false,
      secret_exposure_allowed_by_packet: false,
      secret_values_read_by_packet: false,
      env_file_read_by_packet: false,
      desktop_config_content_inspected_by_packet: false,
      desktop_provider_key_visible_by_packet: false,
      credential_lookup_allowed_by_packet: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Future validation packet is declared for ${preflightRow.invocation}; no receipt payload is received or validated by this phase.`,
    };
    return withOrdinalAndHash(row, index, "operations_freeze_receipt_validation_packet_row_hash");
  });
}

function buildPacketGateRows({ mergePreflight, packageJson, platformOpsLedger, packetRows, packetBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p494_receipt_merge_preflight_ready", "P494 operations freeze receipt merge preflight source is ready.", mergePreflight.validation.valid && mergePreflight.summary.platform_operations_freeze_receipt_merge_preflight_status === SOURCE_READY_STATUS && mergePreflight.summary.ready_preflight_row_count === 7),
    gateRow("platform_package_script_registered", "package.json registers the P495 platform operations freeze receipt validation packet command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P495 platform operations freeze receipt validation packet command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p495_ledger_acceptance_declared", "P495 acceptance row is declared in the platform operations ledger.", ledgerText.includes(`P495: \`${COMMAND_NAME}\``)),
    gateRow("validation_packet_rows_ready", "All operations freeze receipt validation packet rows are ready for future validation without receipt payloads.", packetRows.length === 7 && packetRows.every((row) => row.validation_packet_status === PACKET_READY_STATUS && row.source_merge_preflight_status === SOURCE_READY_STATUS && row.validation_packet_declared && row.validation_packet_checks.length >= 7 && row.actor_workspace_required && !row.actor_workspace_input_present && !row.receipt_input_file_materialized && !row.merged_receipt_input_materialized && !row.receipt_payload_present && !row.ready_for_validation && !row.receipt_validated_by_packet && !row.secret_exposure_allowed_by_packet)),
    gateRow("no_receipt_payload_validation", "Validation packet does not read actor files, materialize merged receipt input, receive payloads, validate receipts, complete signoff, or apply approvals.", !packetBoundary.actor_workspace_input_present && !packetBoundary.receipt_input_file_materialized && !packetBoundary.merged_receipt_input_materialized && !packetBoundary.receipt_payload_present && !packetBoundary.ready_for_validation && !packetBoundary.receipt_received && !packetBoundary.receipt_validated && !packetBoundary.signoff_completed && !packetBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Validation packet does not execute commands, read/write artifacts, publish releases, run git, execute protected actions, or mutate dependencies/packages/lockfiles.", !packetBoundary.command_execution_performed && !packetBoundary.package_command_execution_performed && !packetBoundary.acceptance_command_execution_performed && !packetBoundary.generated_artifact_read_performed && !packetBoundary.artifact_read_performed && !packetBoundary.artifact_write_performed && !packetBoundary.dependency_install_performed && !packetBoundary.package_mutation_performed && !packetBoundary.lockfile_mutation_performed && !packetBoundary.release_published && !packetBoundary.git_operation_performed && !packetBoundary.protected_action_executed && !packetBoundary.protected_recovery_execution_allowed),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !packetBoundary.trading_live_enabled && !packetBoundary.trading_full_auto_enabled && !packetBoundary.trading_order_submission_allowed && !packetBoundary.broker_write_allowed && !packetBoundary.exchange_write_allowed && !packetBoundary.desktop_source_of_truth && !packetBoundary.desktop_mutation_allowed && !packetBoundary.secret_exposure_allowed && !packetBoundary.secret_values_read && !packetBoundary.env_file_read && !packetBoundary.desktop_config_content_inspected && !packetBoundary.desktop_provider_key_visible && !packetBoundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operations_freeze_receipt_validation_packet_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-operations-freeze-receipt-validation-packet-gate-row.v1",
    operations_freeze_receipt_validation_packet_gate_row_id: `platform-operations-freeze-receipt-validation-packet.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    actor_workspace_input_present_by_packet: false,
    receipt_input_file_materialized_by_packet: false,
    merged_receipt_input_materialized_by_packet: false,
    receipt_payload_present_by_packet: false,
    ready_for_validation_by_packet: false,
    receipt_received_by_packet: false,
    receipt_validated_by_packet: false,
    signoff_completed_by_packet: false,
    approval_applied_by_packet: false,
    receipt_merge_preflight_artifact_read_performed_by_packet: false,
    command_execution_performed_by_packet: false,
    package_command_execution_performed_by_packet: false,
    acceptance_command_execution_performed_by_packet: false,
    generated_artifact_read_performed_by_packet: false,
    artifact_read_performed_by_packet: false,
    artifact_write_performed_by_packet: false,
    release_published_by_packet: false,
    git_operation_performed_by_packet: false,
    protected_action_executed_by_packet: false,
    protected_recovery_execution_allowed_by_packet: false,
    trading_order_submission_allowed_by_packet: false,
    broker_write_allowed_by_packet: false,
    exchange_write_allowed_by_packet: false,
    desktop_source_of_truth_by_packet: false,
    desktop_mutation_allowed_by_packet: false,
    secret_exposure_allowed_by_packet: false,
    secret_values_read_by_packet: false,
    env_file_read_by_packet: false,
    desktop_config_content_inspected_by_packet: false,
    desktop_provider_key_visible_by_packet: false,
    credential_lookup_allowed_by_packet: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-operations-freeze-receipt-validation-packet-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    receipt_validation_packet_artifact_write_requested: writeRequested,
    receipt_merge_preflight_consumed_in_memory: true,
    receipt_merge_preflight_artifact_read_performed: false,
    validation_packet_declared: true,
    actor_workspace_input_present: false,
    receipt_input_file_materialized: false,
    merged_receipt_input_materialized: false,
    receipt_payload_present: false,
    ready_for_validation: false,
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
    human_review_note: "Receipt validation packet rows are declarative only; this phase does not receive, validate, complete, approve, or apply receipts.",
  };
}

function buildValidationItems({ mergePreflight, packageJson, platformOpsLedger, packetRows, packetGateRows, packetBoundary }) {
  return [
    validationItem("source.operations_freeze_receipt_merge_preflight", "p494_receipt_merge_preflight_ready", mergePreflight.validation.valid && mergePreflight.summary.platform_operations_freeze_receipt_merge_preflight_status === SOURCE_READY_STATUS && mergePreflight.summary.ready_preflight_row_count === 7, "P494 operations freeze receipt merge preflight source must be ready before P495 validation packet rows."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P495 operations freeze receipt validation packet."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("operations_freeze_receipt_validation_packet_rows", "validation_packet_rows_ready", packetRows.length === 7 && packetRows.every((row) => row.validation_packet_status === PACKET_READY_STATUS && row.source_merge_preflight_status === SOURCE_READY_STATUS && row.validation_packet_declared && row.validation_packet_checks.length >= 7 && row.actor_workspace_required && !row.actor_workspace_input_present && !row.receipt_input_file_materialized && !row.merged_receipt_input_materialized && !row.receipt_payload_present && !row.ready_for_validation && !row.receipt_received_by_packet && !row.receipt_validated_by_packet && !row.approval_applied_by_packet && !row.secret_exposure_allowed_by_packet), "Every operations freeze receipt validation packet row must declare future validation without actor files, merged input, payloads, or secret exposure."),
    validationItem("operations_freeze_receipt_validation_packet_gate_rows", "validation_packet_gates_ready", packetGateRows.length >= 8 && packetGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_packet && !row.protected_action_executed_by_packet && !row.secret_exposure_allowed_by_packet), "P495 operations freeze receipt validation packet gates must be ready and declarative-only."),
    validationItem("boundary.no_receipt_payload", "no_receipt_payload", packetBoundary.read_only && packetBoundary.report_only && packetBoundary.receipt_merge_preflight_consumed_in_memory && !packetBoundary.receipt_merge_preflight_artifact_read_performed && packetBoundary.validation_packet_declared && !packetBoundary.actor_workspace_input_present && !packetBoundary.receipt_input_file_materialized && !packetBoundary.merged_receipt_input_materialized && !packetBoundary.receipt_payload_present && !packetBoundary.ready_for_validation && !packetBoundary.receipt_received && !packetBoundary.receipt_validated && !packetBoundary.signoff_completed && !packetBoundary.approval_applied, "P495 receipt validation packet declares validation packets without materializing or validating receipts."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !packetBoundary.command_execution_performed && !packetBoundary.package_command_execution_performed && !packetBoundary.acceptance_command_execution_performed && !packetBoundary.generated_artifact_read_performed && !packetBoundary.artifact_read_performed && !packetBoundary.artifact_write_performed, "P495 receipt validation packet does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !packetBoundary.dependency_install_performed && !packetBoundary.package_mutation_performed && !packetBoundary.lockfile_mutation_performed && !packetBoundary.release_published && !packetBoundary.git_operation_performed && !packetBoundary.protected_action_executed && !packetBoundary.protected_recovery_execution_allowed, "P495 receipt validation packet performs no dependency, package, lockfile, release, git, protected, or recovery mutation."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !packetBoundary.trading_live_enabled && !packetBoundary.trading_full_auto_enabled && !packetBoundary.trading_order_submission_allowed && !packetBoundary.broker_write_allowed && !packetBoundary.exchange_write_allowed && !packetBoundary.desktop_source_of_truth && !packetBoundary.desktop_mutation_allowed && !packetBoundary.secret_exposure_allowed && !packetBoundary.secret_values_read && !packetBoundary.env_file_read && !packetBoundary.desktop_config_content_inspected && !packetBoundary.desktop_provider_key_visible && !packetBoundary.credential_lookup_allowed, "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled."),
  ];
}

function buildSummary({ mergePreflight, packetRows, packetGateRows, packetBoundary, validation }) {
  return {
    platform_operations_freeze_receipt_validation_packet_status: validation.valid ? PACKET_READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_merge_preflight_status: mergePreflight.summary.platform_operations_freeze_receipt_merge_preflight_status,
    packet_row_count: packetRows.length,
    ready_packet_row_count: packetRows.filter((row) => row.validation_packet_status === PACKET_READY_STATUS).length,
    packet_gate_count: packetGateRows.length,
    ready_packet_gate_count: packetGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: packetBoundary.read_only,
    report_only: packetBoundary.report_only,
    receipt_validation_packet_artifact_write_requested: packetBoundary.receipt_validation_packet_artifact_write_requested,
    receipt_merge_preflight_consumed_in_memory: packetBoundary.receipt_merge_preflight_consumed_in_memory,
    receipt_merge_preflight_artifact_read_performed: packetBoundary.receipt_merge_preflight_artifact_read_performed,
    validation_packet_declared: packetBoundary.validation_packet_declared,
    actor_workspace_input_present: packetBoundary.actor_workspace_input_present,
    receipt_input_file_materialized: packetBoundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: packetBoundary.merged_receipt_input_materialized,
    receipt_payload_present: packetBoundary.receipt_payload_present,
    ready_for_validation: packetBoundary.ready_for_validation,
    receipt_received: packetBoundary.receipt_received,
    receipt_validated: packetBoundary.receipt_validated,
    signoff_completed: packetBoundary.signoff_completed,
    approval_applied: packetBoundary.approval_applied,
    command_execution_performed: packetBoundary.command_execution_performed,
    package_command_execution_performed: packetBoundary.package_command_execution_performed,
    acceptance_command_execution_performed: packetBoundary.acceptance_command_execution_performed,
    generated_artifact_read_performed: packetBoundary.generated_artifact_read_performed,
    artifact_read_performed: packetBoundary.artifact_read_performed,
    artifact_write_performed: packetBoundary.artifact_write_performed,
    dependency_install_performed: packetBoundary.dependency_install_performed,
    package_mutation_performed: packetBoundary.package_mutation_performed,
    lockfile_mutation_performed: packetBoundary.lockfile_mutation_performed,
    release_published: packetBoundary.release_published,
    git_operation_performed: packetBoundary.git_operation_performed,
    protected_action_executed: packetBoundary.protected_action_executed,
    protected_recovery_execution_allowed: packetBoundary.protected_recovery_execution_allowed,
    trading_live_enabled: packetBoundary.trading_live_enabled,
    trading_full_auto_enabled: packetBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: packetBoundary.trading_order_submission_allowed,
    broker_write_allowed: packetBoundary.broker_write_allowed,
    exchange_write_allowed: packetBoundary.exchange_write_allowed,
    desktop_source_of_truth: packetBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: packetBoundary.desktop_mutation_allowed,
    secret_exposure_allowed: packetBoundary.secret_exposure_allowed,
    secret_values_read: packetBoundary.secret_values_read,
    env_file_read: packetBoundary.env_file_read,
    desktop_config_content_inspected: packetBoundary.desktop_config_content_inspected,
    desktop_provider_key_visible: packetBoundary.desktop_provider_key_visible,
    credential_lookup_allowed: packetBoundary.credential_lookup_allowed,
    human_review_required: packetBoundary.human_review_required,
    human_signoff_required: packetBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Operations Freeze Receipt Validation Packet",
    "",
    `Status: ${result.summary.platform_operations_freeze_receipt_validation_packet_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source receipt merge preflight: ${result.summary.source_receipt_merge_preflight_status}`,
    `Packet rows: ${result.summary.ready_packet_row_count}/${result.summary.packet_row_count}`,
    `Packet gates: ${result.summary.ready_packet_gate_count}/${result.summary.packet_gate_count}`,
    "",
    "## Packet Rows",
    "",
    ...result.operations_freeze_receipt_validation_packet_rows.map((row) => `- ${row.invocation} (${row.required_signoff_role}): ${row.validation_packet_status}`),
    "",
    "## Packet Gates",
    "",
    ...result.operations_freeze_receipt_validation_packet_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_OUT_DIR };
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
    else if (arg === "--receipt-queue-schema") parsed.operationsFreezeReceiptQueueSchemaPath = argv[++index];
    else if (arg === "--receipt-validation-rules-schema") parsed.operationsFreezeReceiptValidationRulesSchemaPath = argv[++index];
    else if (arg === "--receipt-workspace-schema") parsed.operationsFreezeReceiptWorkspaceSchemaPath = argv[++index];
    else if (arg === "--receipt-workspace-merge-schema") parsed.operationsFreezeReceiptWorkspaceMergeSchemaPath = argv[++index];
    else if (arg === "--receipt-merge-preflight-schema") parsed.operationsFreezeReceiptMergePreflightSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operations-freeze-receipt-validation-packet.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_OUT_DIR}
  --run-at <iso>                           Deterministic generated_at timestamp.
  --package <path>                         package.json path.
  --platform-ops-ledger <path>             P341-P500 platform operations ledger path.
  --source-inventory-schema <path>         P481 source inventory schema path.
  --command-matrix-schema <path>           P482 command matrix schema path.
  --evidence-index-schema <path>           P483 evidence index schema path.
  --review-packet-schema <path>            P484 review packet schema path.
  --signoff-ledger-schema <path>           P485 signoff ledger schema path.
  --receipt-template-schema <path>         P486 receipt template schema path.
  --receipt-intake-schema <path>           P487 receipt intake schema path.
  --signoff-closeout-schema <path>         P488 signoff closeout schema path.
  --status-ledger-schema <path>            P489 status ledger schema path.
  --receipt-queue-schema <path>            P490 receipt queue schema path.
  --receipt-validation-rules-schema <path> P491 receipt validation rules schema path.
  --receipt-workspace-schema <path>        P492 receipt workspace schema path.
  --receipt-workspace-merge-schema <path>  P493 receipt workspace merge schema path.
  --receipt-merge-preflight-schema <path>  P494 receipt merge preflight schema path.
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_INPUTS.platformOpsLedgerPath),
    operations_freeze_source_inventory_schema_path: path.resolve(options.operationsFreezeSourceInventorySchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_INPUTS.operationsFreezeSourceInventorySchemaPath),
    operations_freeze_command_matrix_schema_path: path.resolve(options.operationsFreezeCommandMatrixSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_INPUTS.operationsFreezeCommandMatrixSchemaPath),
    operations_freeze_evidence_index_schema_path: path.resolve(options.operationsFreezeEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_INPUTS.operationsFreezeEvidenceIndexSchemaPath),
    operations_freeze_review_packet_schema_path: path.resolve(options.operationsFreezeReviewPacketSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_INPUTS.operationsFreezeReviewPacketSchemaPath),
    operations_freeze_signoff_ledger_schema_path: path.resolve(options.operationsFreezeSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_INPUTS.operationsFreezeSignoffLedgerSchemaPath),
    operations_freeze_signoff_receipt_template_schema_path: path.resolve(options.operationsFreezeSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_INPUTS.operationsFreezeSignoffReceiptTemplateSchemaPath),
    operations_freeze_signoff_receipt_intake_schema_path: path.resolve(options.operationsFreezeSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_INPUTS.operationsFreezeSignoffReceiptIntakeSchemaPath),
    operations_freeze_signoff_closeout_schema_path: path.resolve(options.operationsFreezeSignoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_INPUTS.operationsFreezeSignoffCloseoutSchemaPath),
    operations_freeze_status_ledger_schema_path: path.resolve(options.operationsFreezeStatusLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_INPUTS.operationsFreezeStatusLedgerSchemaPath),
    operations_freeze_receipt_queue_schema_path: path.resolve(options.operationsFreezeReceiptQueueSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_INPUTS.operationsFreezeReceiptQueueSchemaPath),
    operations_freeze_receipt_validation_rules_schema_path: path.resolve(options.operationsFreezeReceiptValidationRulesSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_INPUTS.operationsFreezeReceiptValidationRulesSchemaPath),
    operations_freeze_receipt_workspace_schema_path: path.resolve(options.operationsFreezeReceiptWorkspaceSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_INPUTS.operationsFreezeReceiptWorkspaceSchemaPath),
    operations_freeze_receipt_workspace_merge_schema_path: path.resolve(options.operationsFreezeReceiptWorkspaceMergeSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_INPUTS.operationsFreezeReceiptWorkspaceMergeSchemaPath),
    operations_freeze_receipt_merge_preflight_schema_path: path.resolve(options.operationsFreezeReceiptMergePreflightSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_INPUTS.operationsFreezeReceiptMergePreflightSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_PACKET_INPUTS.schemaPath),
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
    validation_item_id: `platform-operations-freeze-receipt-validation-packet.${slugify(itemPath)}.${checkId}`,
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
