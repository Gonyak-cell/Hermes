import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_INPUTS,
  buildPlatformOperationsFreezeReceiptWorkspaceMerge,
} from "./platform-operations-freeze-receipt-workspace-merge.mjs";

export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_OUT_DIR = "artifacts/platform-operations-freeze-receipt-merge-preflight/latest";
export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_INPUTS,
  operationsFreezeReceiptWorkspaceMergeSchemaPath: DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_INPUTS.schemaPath,
  schemaPath: "schemas/platform-operations-freeze-receipt-merge-preflight.schema.json",
};

const COMMAND_NAME = "platform:operations-freeze-receipt-merge-preflight";
const SCHEMA_VERSION = "platform-operations-freeze-receipt-merge-preflight.v1";
const CAPABILITY_ID = "platform.operations_freeze_receipt_merge_preflight";
const PHASE_SLOT = "P494";
const PREVIOUS_PHASE_SLOT = "P493";
const NEXT_PHASE_SLOT = "P495";
const SOURCE_READY_STATUS = "ready_for_future_receipt_merge";
const PREFLIGHT_READY_STATUS = "ready_for_future_receipt_merge_validation";
const FUTURE_VALIDATION_CHECKS = [
  "reviewer_id_present",
  "reviewed_at_iso_timestamp",
  "source_signoff_row_id_matches",
  "decision_allowed",
  "evidence_reference_present",
  "command_result_reference_present",
  "blocker_note_present",
];

export async function runPlatformOperationsFreezeReceiptMergePreflight(options = {}) {
  const result = await buildPlatformOperationsFreezeReceiptMergePreflight(options);
  if (options.write !== false) await writePlatformOperationsFreezeReceiptMergePreflight(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operations freeze receipt merge preflight failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperationsFreezeReceiptMergePreflight(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const workspaceMerge = await buildPlatformOperationsFreezeReceiptWorkspaceMerge({
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
    schemaPath: inputs.operations_freeze_receipt_workspace_merge_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const preflightRows = buildPreflightRows({ workspaceMerge });
  const preflightBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const preflightAnchor = buildPreflightAnchor({ workspaceMerge, packageJson, platformOpsLedger, preflightRows });
  const preflightGateRows = buildPreflightGateRows({ workspaceMerge, packageJson, platformOpsLedger, preflightRows, preflightBoundary });
  const validationItems = buildValidationItems({ workspaceMerge, packageJson, platformOpsLedger, preflightRows, preflightGateRows, preflightBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ workspaceMerge, preflightRows, preflightGateRows, preflightBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operations_freeze_receipt_merge_preflight_id: `platform-operations-freeze-receipt-merge-preflight.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operations_freeze_receipt_merge_preflight_anchor: preflightAnchor,
    operations_freeze_receipt_merge_preflight_rows: preflightRows,
    operations_freeze_receipt_merge_preflight_gate_rows: preflightGateRows,
    operations_freeze_receipt_merge_preflight_boundary: preflightBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operations_freeze_receipt_merge_preflight") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ workspaceMerge, preflightRows, preflightGateRows, preflightBoundary, validation: result.validation });
  result.summary.platform_operations_freeze_receipt_merge_preflight_id = result.platform_operations_freeze_receipt_merge_preflight_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperationsFreezeReceiptMergePreflight(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-operations-freeze-receipt-merge-preflight.json"), serializableResult(result));
  await writeJson(path.join(outDir, "freeze-receipt-merge-preflight-rows.json"), collectionEnvelope("platform-operations-freeze-receipt-merge-preflight-rows.v1", "operations_freeze_receipt_merge_preflight_rows", result.operations_freeze_receipt_merge_preflight_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-receipt-merge-preflight-gate-rows.json"), collectionEnvelope("platform-operations-freeze-receipt-merge-preflight-gate-rows.v1", "operations_freeze_receipt_merge_preflight_gate_rows", result.operations_freeze_receipt_merge_preflight_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-receipt-merge-preflight-boundary.json"), result.operations_freeze_receipt_merge_preflight_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operations-freeze-receipt-merge-preflight-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperationsFreezeReceiptMergePreflightCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperationsFreezeReceiptMergePreflight(args);
    console.log(`Platform operations freeze receipt merge preflight ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operations_freeze_receipt_merge_preflight_status}`);
    console.log(`Preflight rows: ${result.summary.ready_preflight_row_count}/${result.summary.preflight_row_count}`);
    console.log(`Preflight gates: ${result.summary.ready_preflight_gate_count}/${result.summary.preflight_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPreflightAnchor({ workspaceMerge, packageJson, platformOpsLedger, preflightRows }) {
  return {
    schema_version: "platform-operations-freeze-receipt-merge-preflight-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_workspace_merge_id: workspaceMerge.platform_operations_freeze_receipt_workspace_merge_id,
    source_receipt_workspace_merge_status: workspaceMerge.summary.platform_operations_freeze_receipt_workspace_merge_status,
    source_receipt_workspace_merge_hash: hashValue({
      id: workspaceMerge.platform_operations_freeze_receipt_workspace_merge_id,
      status: workspaceMerge.summary.platform_operations_freeze_receipt_workspace_merge_status,
      merge_rows: workspaceMerge.summary.merge_row_count,
      ready_merge_rows: workspaceMerge.summary.ready_merge_row_count,
      gate_rows: workspaceMerge.summary.merge_gate_count,
    }),
    package_json_hash: packageJson.content_hash,
    platform_ops_ledger_hash: platformOpsLedger.content_hash,
    preflight_rows_hash: hashValue(preflightRows.map((row) => ({
      row_key: row.source_evidence_row_key,
      preflight_status: row.preflight_status,
      receipt_payload_present: row.receipt_payload_present,
    }))),
  };
}

function buildPreflightRows({ workspaceMerge }) {
  const sourceReady = workspaceMerge.validation.valid && workspaceMerge.summary.platform_operations_freeze_receipt_workspace_merge_status === SOURCE_READY_STATUS;
  return workspaceMerge.operations_freeze_receipt_workspace_merge_rows.map((mergeRow, index) => {
    const preflightStatus = sourceReady && mergeRow.merge_status === SOURCE_READY_STATUS ? PREFLIGHT_READY_STATUS : "blocked";
    const row = {
      schema_version: "platform-operations-freeze-receipt-merge-preflight-row.v1",
      operations_freeze_receipt_merge_preflight_row_id: `platform-operations-freeze-receipt-merge-preflight.row.${mergeRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_workspace_merge_row_id: mergeRow.operations_freeze_receipt_workspace_merge_row_id,
      source_evidence_row_key: mergeRow.source_evidence_row_key,
      queue_position: mergeRow.queue_position,
      package_script_name: mergeRow.package_script_name,
      invocation: mergeRow.invocation,
      evidence_kind: mergeRow.evidence_kind,
      expected_report_path: mergeRow.expected_report_path,
      required_reviewer_role: mergeRow.required_reviewer_role,
      required_signoff_role: mergeRow.required_signoff_role,
      preflight_status: preflightStatus,
      source_workspace_merge_status: mergeRow.merge_status,
      actor_workspace_required: true,
      actor_workspace_input_present: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      merge_validation_preflight_declared: true,
      future_validation_checks: FUTURE_VALIDATION_CHECKS,
      ready_for_validation: false,
      receipt_received_by_preflight: false,
      receipt_validated_by_preflight: false,
      signoff_completed_by_preflight: false,
      approval_applied_by_preflight: false,
      receipt_workspace_merge_consumed_in_memory: true,
      receipt_workspace_merge_artifact_read_performed_by_preflight: false,
      command_execution_performed_by_preflight: false,
      package_command_execution_performed_by_preflight: false,
      acceptance_command_execution_performed_by_preflight: false,
      generated_artifact_read_performed_by_preflight: false,
      artifact_read_performed_by_preflight: false,
      artifact_write_performed_by_preflight: false,
      dependency_install_performed_by_preflight: false,
      package_mutation_performed_by_preflight: false,
      lockfile_mutation_performed_by_preflight: false,
      release_published_by_preflight: false,
      git_operation_performed_by_preflight: false,
      protected_action_executed_by_preflight: false,
      protected_recovery_execution_allowed_by_preflight: false,
      trading_live_enabled_by_preflight: false,
      trading_full_auto_enabled_by_preflight: false,
      trading_order_submission_allowed_by_preflight: false,
      broker_write_allowed_by_preflight: false,
      exchange_write_allowed_by_preflight: false,
      desktop_source_of_truth_by_preflight: false,
      desktop_mutation_allowed_by_preflight: false,
      secret_exposure_allowed_by_preflight: false,
      secret_values_read_by_preflight: false,
      env_file_read_by_preflight: false,
      desktop_config_content_inspected_by_preflight: false,
      desktop_provider_key_visible_by_preflight: false,
      credential_lookup_allowed_by_preflight: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Future merge validation preflight is declared for ${mergeRow.invocation}; no actor workspace input or receipt payload is read by this phase.`,
    };
    return withOrdinalAndHash(row, index, "operations_freeze_receipt_merge_preflight_row_hash");
  });
}

function buildPreflightGateRows({ workspaceMerge, packageJson, platformOpsLedger, preflightRows, preflightBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p493_receipt_workspace_merge_ready", "P493 operations freeze receipt workspace merge source is ready.", workspaceMerge.validation.valid && workspaceMerge.summary.platform_operations_freeze_receipt_workspace_merge_status === SOURCE_READY_STATUS && workspaceMerge.summary.ready_merge_row_count === 7),
    gateRow("platform_package_script_registered", "package.json registers the P494 platform operations freeze receipt merge preflight command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P494 platform operations freeze receipt merge preflight command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p494_ledger_acceptance_declared", "P494 acceptance row is declared in the platform operations ledger.", ledgerText.includes(`P494: \`${COMMAND_NAME}\``)),
    gateRow("preflight_rows_ready", "All operations freeze receipt merge preflight rows are ready for future validation without actor input.", preflightRows.length === 7 && preflightRows.every((row) => row.preflight_status === PREFLIGHT_READY_STATUS && row.source_workspace_merge_status === SOURCE_READY_STATUS && row.merge_validation_preflight_declared && row.future_validation_checks.length >= 7 && row.actor_workspace_required && !row.actor_workspace_input_present && !row.receipt_input_file_materialized && !row.merged_receipt_input_materialized && !row.receipt_payload_present && !row.ready_for_validation && !row.receipt_validated_by_preflight && !row.secret_exposure_allowed_by_preflight)),
    gateRow("no_receipt_payload_validation", "Preflight does not read actor files, materialize merged receipt input, receive payloads, validate receipts, complete signoff, or apply approvals.", !preflightBoundary.actor_workspace_input_present && !preflightBoundary.receipt_input_file_materialized && !preflightBoundary.merged_receipt_input_materialized && !preflightBoundary.receipt_payload_present && !preflightBoundary.ready_for_validation && !preflightBoundary.receipt_received && !preflightBoundary.receipt_validated && !preflightBoundary.signoff_completed && !preflightBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Preflight does not execute commands, read/write artifacts, publish releases, run git, execute protected actions, or mutate dependencies/packages/lockfiles.", !preflightBoundary.command_execution_performed && !preflightBoundary.package_command_execution_performed && !preflightBoundary.acceptance_command_execution_performed && !preflightBoundary.generated_artifact_read_performed && !preflightBoundary.artifact_read_performed && !preflightBoundary.artifact_write_performed && !preflightBoundary.dependency_install_performed && !preflightBoundary.package_mutation_performed && !preflightBoundary.lockfile_mutation_performed && !preflightBoundary.release_published && !preflightBoundary.git_operation_performed && !preflightBoundary.protected_action_executed && !preflightBoundary.protected_recovery_execution_allowed),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !preflightBoundary.trading_live_enabled && !preflightBoundary.trading_full_auto_enabled && !preflightBoundary.trading_order_submission_allowed && !preflightBoundary.broker_write_allowed && !preflightBoundary.exchange_write_allowed && !preflightBoundary.desktop_source_of_truth && !preflightBoundary.desktop_mutation_allowed && !preflightBoundary.secret_exposure_allowed && !preflightBoundary.secret_values_read && !preflightBoundary.env_file_read && !preflightBoundary.desktop_config_content_inspected && !preflightBoundary.desktop_provider_key_visible && !preflightBoundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operations_freeze_receipt_merge_preflight_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-operations-freeze-receipt-merge-preflight-gate-row.v1",
    operations_freeze_receipt_merge_preflight_gate_row_id: `platform-operations-freeze-receipt-merge-preflight.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    actor_workspace_input_present_by_preflight: false,
    receipt_input_file_materialized_by_preflight: false,
    merged_receipt_input_materialized_by_preflight: false,
    receipt_payload_present_by_preflight: false,
    ready_for_validation_by_preflight: false,
    receipt_received_by_preflight: false,
    receipt_validated_by_preflight: false,
    signoff_completed_by_preflight: false,
    approval_applied_by_preflight: false,
    receipt_workspace_merge_artifact_read_performed_by_preflight: false,
    command_execution_performed_by_preflight: false,
    package_command_execution_performed_by_preflight: false,
    acceptance_command_execution_performed_by_preflight: false,
    generated_artifact_read_performed_by_preflight: false,
    artifact_read_performed_by_preflight: false,
    artifact_write_performed_by_preflight: false,
    release_published_by_preflight: false,
    git_operation_performed_by_preflight: false,
    protected_action_executed_by_preflight: false,
    protected_recovery_execution_allowed_by_preflight: false,
    trading_order_submission_allowed_by_preflight: false,
    broker_write_allowed_by_preflight: false,
    exchange_write_allowed_by_preflight: false,
    desktop_source_of_truth_by_preflight: false,
    desktop_mutation_allowed_by_preflight: false,
    secret_exposure_allowed_by_preflight: false,
    secret_values_read_by_preflight: false,
    env_file_read_by_preflight: false,
    desktop_config_content_inspected_by_preflight: false,
    desktop_provider_key_visible_by_preflight: false,
    credential_lookup_allowed_by_preflight: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-operations-freeze-receipt-merge-preflight-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    receipt_merge_preflight_artifact_write_requested: writeRequested,
    receipt_workspace_merge_consumed_in_memory: true,
    receipt_workspace_merge_artifact_read_performed: false,
    merge_validation_preflight_declared: true,
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
    human_review_note: "Receipt merge preflight rows are declarative only; this phase does not read actor files, materialize merged payloads, validate, complete, or apply receipts.",
  };
}

function buildValidationItems({ workspaceMerge, packageJson, platformOpsLedger, preflightRows, preflightGateRows, preflightBoundary }) {
  return [
    validationItem("source.operations_freeze_receipt_workspace_merge", "p493_receipt_workspace_merge_ready", workspaceMerge.validation.valid && workspaceMerge.summary.platform_operations_freeze_receipt_workspace_merge_status === SOURCE_READY_STATUS && workspaceMerge.summary.ready_merge_row_count === 7, "P493 operations freeze receipt workspace merge source must be ready before P494 preflight rows."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P494 operations freeze receipt merge preflight."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("operations_freeze_receipt_merge_preflight_rows", "preflight_rows_ready", preflightRows.length === 7 && preflightRows.every((row) => row.preflight_status === PREFLIGHT_READY_STATUS && row.source_workspace_merge_status === SOURCE_READY_STATUS && row.merge_validation_preflight_declared && row.future_validation_checks.length >= 7 && row.actor_workspace_required && !row.actor_workspace_input_present && !row.receipt_input_file_materialized && !row.merged_receipt_input_materialized && !row.receipt_payload_present && !row.ready_for_validation && !row.receipt_received_by_preflight && !row.receipt_validated_by_preflight && !row.approval_applied_by_preflight && !row.secret_exposure_allowed_by_preflight), "Every operations freeze receipt merge preflight row must declare future validation without actor files, merged input, payloads, or secret exposure."),
    validationItem("operations_freeze_receipt_merge_preflight_gate_rows", "preflight_gates_ready", preflightGateRows.length >= 8 && preflightGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_preflight && !row.protected_action_executed_by_preflight && !row.secret_exposure_allowed_by_preflight), "P494 operations freeze receipt merge preflight gates must be ready and declarative-only."),
    validationItem("boundary.no_receipt_payload", "no_receipt_payload", preflightBoundary.read_only && preflightBoundary.report_only && preflightBoundary.receipt_workspace_merge_consumed_in_memory && !preflightBoundary.receipt_workspace_merge_artifact_read_performed && preflightBoundary.merge_validation_preflight_declared && !preflightBoundary.actor_workspace_input_present && !preflightBoundary.receipt_input_file_materialized && !preflightBoundary.merged_receipt_input_materialized && !preflightBoundary.receipt_payload_present && !preflightBoundary.ready_for_validation && !preflightBoundary.receipt_received && !preflightBoundary.receipt_validated && !preflightBoundary.signoff_completed && !preflightBoundary.approval_applied, "P494 receipt merge preflight declares validation readiness without materializing or validating receipts."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !preflightBoundary.command_execution_performed && !preflightBoundary.package_command_execution_performed && !preflightBoundary.acceptance_command_execution_performed && !preflightBoundary.generated_artifact_read_performed && !preflightBoundary.artifact_read_performed && !preflightBoundary.artifact_write_performed, "P494 receipt merge preflight does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !preflightBoundary.dependency_install_performed && !preflightBoundary.package_mutation_performed && !preflightBoundary.lockfile_mutation_performed && !preflightBoundary.release_published && !preflightBoundary.git_operation_performed && !preflightBoundary.protected_action_executed && !preflightBoundary.protected_recovery_execution_allowed, "P494 receipt merge preflight performs no dependency, package, lockfile, release, git, protected, or recovery mutation."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !preflightBoundary.trading_live_enabled && !preflightBoundary.trading_full_auto_enabled && !preflightBoundary.trading_order_submission_allowed && !preflightBoundary.broker_write_allowed && !preflightBoundary.exchange_write_allowed && !preflightBoundary.desktop_source_of_truth && !preflightBoundary.desktop_mutation_allowed && !preflightBoundary.secret_exposure_allowed && !preflightBoundary.secret_values_read && !preflightBoundary.env_file_read && !preflightBoundary.desktop_config_content_inspected && !preflightBoundary.desktop_provider_key_visible && !preflightBoundary.credential_lookup_allowed, "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled."),
  ];
}

function buildSummary({ workspaceMerge, preflightRows, preflightGateRows, preflightBoundary, validation }) {
  return {
    platform_operations_freeze_receipt_merge_preflight_status: validation.valid ? PREFLIGHT_READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_workspace_merge_status: workspaceMerge.summary.platform_operations_freeze_receipt_workspace_merge_status,
    preflight_row_count: preflightRows.length,
    ready_preflight_row_count: preflightRows.filter((row) => row.preflight_status === PREFLIGHT_READY_STATUS).length,
    preflight_gate_count: preflightGateRows.length,
    ready_preflight_gate_count: preflightGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: preflightBoundary.read_only,
    report_only: preflightBoundary.report_only,
    receipt_merge_preflight_artifact_write_requested: preflightBoundary.receipt_merge_preflight_artifact_write_requested,
    receipt_workspace_merge_consumed_in_memory: preflightBoundary.receipt_workspace_merge_consumed_in_memory,
    receipt_workspace_merge_artifact_read_performed: preflightBoundary.receipt_workspace_merge_artifact_read_performed,
    merge_validation_preflight_declared: preflightBoundary.merge_validation_preflight_declared,
    actor_workspace_input_present: preflightBoundary.actor_workspace_input_present,
    receipt_input_file_materialized: preflightBoundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: preflightBoundary.merged_receipt_input_materialized,
    receipt_payload_present: preflightBoundary.receipt_payload_present,
    ready_for_validation: preflightBoundary.ready_for_validation,
    receipt_received: preflightBoundary.receipt_received,
    receipt_validated: preflightBoundary.receipt_validated,
    signoff_completed: preflightBoundary.signoff_completed,
    approval_applied: preflightBoundary.approval_applied,
    command_execution_performed: preflightBoundary.command_execution_performed,
    package_command_execution_performed: preflightBoundary.package_command_execution_performed,
    acceptance_command_execution_performed: preflightBoundary.acceptance_command_execution_performed,
    generated_artifact_read_performed: preflightBoundary.generated_artifact_read_performed,
    artifact_read_performed: preflightBoundary.artifact_read_performed,
    artifact_write_performed: preflightBoundary.artifact_write_performed,
    dependency_install_performed: preflightBoundary.dependency_install_performed,
    package_mutation_performed: preflightBoundary.package_mutation_performed,
    lockfile_mutation_performed: preflightBoundary.lockfile_mutation_performed,
    release_published: preflightBoundary.release_published,
    git_operation_performed: preflightBoundary.git_operation_performed,
    protected_action_executed: preflightBoundary.protected_action_executed,
    protected_recovery_execution_allowed: preflightBoundary.protected_recovery_execution_allowed,
    trading_live_enabled: preflightBoundary.trading_live_enabled,
    trading_full_auto_enabled: preflightBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: preflightBoundary.trading_order_submission_allowed,
    broker_write_allowed: preflightBoundary.broker_write_allowed,
    exchange_write_allowed: preflightBoundary.exchange_write_allowed,
    desktop_source_of_truth: preflightBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: preflightBoundary.desktop_mutation_allowed,
    secret_exposure_allowed: preflightBoundary.secret_exposure_allowed,
    secret_values_read: preflightBoundary.secret_values_read,
    env_file_read: preflightBoundary.env_file_read,
    desktop_config_content_inspected: preflightBoundary.desktop_config_content_inspected,
    desktop_provider_key_visible: preflightBoundary.desktop_provider_key_visible,
    credential_lookup_allowed: preflightBoundary.credential_lookup_allowed,
    human_review_required: preflightBoundary.human_review_required,
    human_signoff_required: preflightBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Operations Freeze Receipt Merge Preflight",
    "",
    `Status: ${result.summary.platform_operations_freeze_receipt_merge_preflight_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source receipt workspace merge: ${result.summary.source_receipt_workspace_merge_status}`,
    `Preflight rows: ${result.summary.ready_preflight_row_count}/${result.summary.preflight_row_count}`,
    `Preflight gates: ${result.summary.ready_preflight_gate_count}/${result.summary.preflight_gate_count}`,
    "",
    "## Preflight Rows",
    "",
    ...result.operations_freeze_receipt_merge_preflight_rows.map((row) => `- ${row.invocation} (${row.required_signoff_role}): ${row.preflight_status}`),
    "",
    "## Preflight Gates",
    "",
    ...result.operations_freeze_receipt_merge_preflight_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operations-freeze-receipt-merge-preflight.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_OUT_DIR}
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
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS.platformOpsLedgerPath),
    operations_freeze_source_inventory_schema_path: path.resolve(options.operationsFreezeSourceInventorySchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS.operationsFreezeSourceInventorySchemaPath),
    operations_freeze_command_matrix_schema_path: path.resolve(options.operationsFreezeCommandMatrixSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS.operationsFreezeCommandMatrixSchemaPath),
    operations_freeze_evidence_index_schema_path: path.resolve(options.operationsFreezeEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS.operationsFreezeEvidenceIndexSchemaPath),
    operations_freeze_review_packet_schema_path: path.resolve(options.operationsFreezeReviewPacketSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS.operationsFreezeReviewPacketSchemaPath),
    operations_freeze_signoff_ledger_schema_path: path.resolve(options.operationsFreezeSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS.operationsFreezeSignoffLedgerSchemaPath),
    operations_freeze_signoff_receipt_template_schema_path: path.resolve(options.operationsFreezeSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS.operationsFreezeSignoffReceiptTemplateSchemaPath),
    operations_freeze_signoff_receipt_intake_schema_path: path.resolve(options.operationsFreezeSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS.operationsFreezeSignoffReceiptIntakeSchemaPath),
    operations_freeze_signoff_closeout_schema_path: path.resolve(options.operationsFreezeSignoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS.operationsFreezeSignoffCloseoutSchemaPath),
    operations_freeze_status_ledger_schema_path: path.resolve(options.operationsFreezeStatusLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS.operationsFreezeStatusLedgerSchemaPath),
    operations_freeze_receipt_queue_schema_path: path.resolve(options.operationsFreezeReceiptQueueSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS.operationsFreezeReceiptQueueSchemaPath),
    operations_freeze_receipt_validation_rules_schema_path: path.resolve(options.operationsFreezeReceiptValidationRulesSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS.operationsFreezeReceiptValidationRulesSchemaPath),
    operations_freeze_receipt_workspace_schema_path: path.resolve(options.operationsFreezeReceiptWorkspaceSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS.operationsFreezeReceiptWorkspaceSchemaPath),
    operations_freeze_receipt_workspace_merge_schema_path: path.resolve(options.operationsFreezeReceiptWorkspaceMergeSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS.operationsFreezeReceiptWorkspaceMergeSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_MERGE_PREFLIGHT_INPUTS.schemaPath),
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
    validation_item_id: `platform-operations-freeze-receipt-merge-preflight.${slugify(itemPath)}.${checkId}`,
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
