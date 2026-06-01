import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_INPUTS,
  buildPlatformOperationsFreezeReceiptWorkspace,
} from "./platform-operations-freeze-receipt-workspace.mjs";

export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_OUT_DIR = "artifacts/platform-operations-freeze-receipt-workspace-merge/latest";
export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_INPUTS,
  operationsFreezeReceiptWorkspaceSchemaPath: DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_INPUTS.schemaPath,
  schemaPath: "schemas/platform-operations-freeze-receipt-workspace-merge.schema.json",
};

const COMMAND_NAME = "platform:operations-freeze-receipt-workspace-merge";
const SCHEMA_VERSION = "platform-operations-freeze-receipt-workspace-merge.v1";
const CAPABILITY_ID = "platform.operations_freeze_receipt_workspace_merge";
const PHASE_SLOT = "P493";
const PREVIOUS_PHASE_SLOT = "P492";
const NEXT_PHASE_SLOT = "P494";
const SOURCE_READY_STATUS = "ready_for_human_receipt_workspace";
const SOURCE_WORKSPACE_ROW_READY_STATUS = "ready_for_human_receipt_input";
const MERGE_READY_STATUS = "ready_for_future_receipt_merge";

export async function runPlatformOperationsFreezeReceiptWorkspaceMerge(options = {}) {
  const result = await buildPlatformOperationsFreezeReceiptWorkspaceMerge(options);
  if (options.write !== false) await writePlatformOperationsFreezeReceiptWorkspaceMerge(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operations freeze receipt workspace merge failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperationsFreezeReceiptWorkspaceMerge(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const workspace = await buildPlatformOperationsFreezeReceiptWorkspace({
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
    schemaPath: inputs.operations_freeze_receipt_workspace_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const mergeRows = buildMergeRows({ workspace });
  const mergeBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const mergeAnchor = buildMergeAnchor({ workspace, packageJson, platformOpsLedger, mergeRows });
  const mergeGateRows = buildMergeGateRows({ workspace, packageJson, platformOpsLedger, mergeRows, mergeBoundary });
  const validationItems = buildValidationItems({ workspace, packageJson, platformOpsLedger, mergeRows, mergeGateRows, mergeBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ workspace, mergeRows, mergeGateRows, mergeBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operations_freeze_receipt_workspace_merge_id: `platform-operations-freeze-receipt-workspace-merge.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operations_freeze_receipt_workspace_merge_anchor: mergeAnchor,
    operations_freeze_receipt_workspace_merge_rows: mergeRows,
    operations_freeze_receipt_workspace_merge_gate_rows: mergeGateRows,
    operations_freeze_receipt_workspace_merge_boundary: mergeBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operations_freeze_receipt_workspace_merge") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ workspace, mergeRows, mergeGateRows, mergeBoundary, validation: result.validation });
  result.summary.platform_operations_freeze_receipt_workspace_merge_id = result.platform_operations_freeze_receipt_workspace_merge_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperationsFreezeReceiptWorkspaceMerge(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-operations-freeze-receipt-workspace-merge.json"), serializableResult(result));
  await writeJson(path.join(outDir, "freeze-receipt-workspace-merge-rows.json"), collectionEnvelope("platform-operations-freeze-receipt-workspace-merge-rows.v1", "operations_freeze_receipt_workspace_merge_rows", result.operations_freeze_receipt_workspace_merge_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-receipt-workspace-merge-gate-rows.json"), collectionEnvelope("platform-operations-freeze-receipt-workspace-merge-gate-rows.v1", "operations_freeze_receipt_workspace_merge_gate_rows", result.operations_freeze_receipt_workspace_merge_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-receipt-workspace-merge-boundary.json"), result.operations_freeze_receipt_workspace_merge_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operations-freeze-receipt-workspace-merge-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperationsFreezeReceiptWorkspaceMergeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperationsFreezeReceiptWorkspaceMerge(args);
    console.log(`Platform operations freeze receipt workspace merge ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operations_freeze_receipt_workspace_merge_status}`);
    console.log(`Merge rows: ${result.summary.ready_merge_row_count}/${result.summary.merge_row_count}`);
    console.log(`Merge gates: ${result.summary.ready_merge_gate_count}/${result.summary.merge_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildMergeAnchor({ workspace, packageJson, platformOpsLedger, mergeRows }) {
  return {
    schema_version: "platform-operations-freeze-receipt-workspace-merge-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_workspace_id: workspace.platform_operations_freeze_receipt_workspace_id,
    source_receipt_workspace_status: workspace.summary.platform_operations_freeze_receipt_workspace_status,
    source_receipt_workspace_hash: hashValue({
      id: workspace.platform_operations_freeze_receipt_workspace_id,
      status: workspace.summary.platform_operations_freeze_receipt_workspace_status,
      workspace_rows: workspace.summary.workspace_row_count,
      ready_workspace_rows: workspace.summary.ready_workspace_row_count,
      gate_rows: workspace.summary.workspace_gate_count,
    }),
    package_json_hash: packageJson.content_hash,
    platform_ops_ledger_hash: platformOpsLedger.content_hash,
    merge_rows_hash: hashValue(mergeRows.map((row) => ({
      row_key: row.source_evidence_row_key,
      merge_status: row.merge_status,
      actor_workspace_input_present: row.actor_workspace_input_present,
      merged_receipt_input_materialized: row.merged_receipt_input_materialized,
      receipt_payload_present: row.receipt_payload_present,
    }))),
  };
}

function buildMergeRows({ workspace }) {
  const sourceReady = workspace.validation.valid && workspace.summary.platform_operations_freeze_receipt_workspace_status === SOURCE_READY_STATUS;
  return workspace.operations_freeze_receipt_workspace_rows.map((workspaceRow, index) => {
    const mergeStatus = sourceReady && workspaceRow.workspace_status === SOURCE_WORKSPACE_ROW_READY_STATUS ? MERGE_READY_STATUS : "blocked";
    const row = {
      schema_version: "platform-operations-freeze-receipt-workspace-merge-row.v1",
      operations_freeze_receipt_workspace_merge_row_id: `platform-operations-freeze-receipt-workspace-merge.row.${workspaceRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_workspace_row_id: workspaceRow.operations_freeze_receipt_workspace_row_id,
      source_evidence_row_key: workspaceRow.source_evidence_row_key,
      queue_position: workspaceRow.queue_position,
      package_script_name: workspaceRow.package_script_name,
      invocation: workspaceRow.invocation,
      evidence_kind: workspaceRow.evidence_kind,
      expected_report_path: workspaceRow.expected_report_path,
      required_reviewer_role: workspaceRow.required_reviewer_role,
      required_signoff_role: workspaceRow.required_signoff_role,
      merge_status: mergeStatus,
      source_workspace_status: workspaceRow.workspace_status,
      actor_workspace_required: true,
      actor_workspace_input_present: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      ready_for_validation: false,
      receipt_received_by_merge: false,
      receipt_validated_by_merge: false,
      signoff_completed_by_merge: false,
      approval_applied_by_merge: false,
      receipt_workspace_consumed_in_memory: true,
      receipt_workspace_artifact_read_performed_by_merge: false,
      command_execution_performed_by_merge: false,
      package_command_execution_performed_by_merge: false,
      acceptance_command_execution_performed_by_merge: false,
      generated_artifact_read_performed_by_merge: false,
      artifact_read_performed_by_merge: false,
      artifact_write_performed_by_merge: false,
      dependency_install_performed_by_merge: false,
      package_mutation_performed_by_merge: false,
      lockfile_mutation_performed_by_merge: false,
      release_published_by_merge: false,
      git_operation_performed_by_merge: false,
      protected_action_executed_by_merge: false,
      protected_recovery_execution_allowed_by_merge: false,
      trading_live_enabled_by_merge: false,
      trading_full_auto_enabled_by_merge: false,
      trading_order_submission_allowed_by_merge: false,
      broker_write_allowed_by_merge: false,
      exchange_write_allowed_by_merge: false,
      desktop_source_of_truth_by_merge: false,
      desktop_mutation_allowed_by_merge: false,
      secret_exposure_allowed_by_merge: false,
      secret_values_read_by_merge: false,
      env_file_read_by_merge: false,
      desktop_config_content_inspected_by_merge: false,
      desktop_provider_key_visible_by_merge: false,
      credential_lookup_allowed_by_merge: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Future merge is declared for ${workspaceRow.invocation}; no actor workspace input or receipt payload is read by this phase.`,
    };
    return withOrdinalAndHash(row, index, "operations_freeze_receipt_workspace_merge_row_hash");
  });
}

function buildMergeGateRows({ workspace, packageJson, platformOpsLedger, mergeRows, mergeBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p492_receipt_workspace_ready", "P492 operations freeze receipt workspace source is ready.", workspace.validation.valid && workspace.summary.platform_operations_freeze_receipt_workspace_status === SOURCE_READY_STATUS && workspace.summary.ready_workspace_row_count === 7),
    gateRow("platform_package_script_registered", "package.json registers the P493 platform operations freeze receipt workspace merge command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P493 platform operations freeze receipt workspace merge command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p493_ledger_acceptance_declared", "P493 acceptance row is declared in the platform operations ledger.", ledgerText.includes(`P493: \`${COMMAND_NAME}\``)),
    gateRow("merge_rows_ready", "All operations freeze receipt workspace merge rows are ready for future merge without actor input.", mergeRows.length === 7 && mergeRows.every((row) => row.merge_status === MERGE_READY_STATUS && row.actor_workspace_required && !row.actor_workspace_input_present && !row.receipt_input_file_materialized && !row.merged_receipt_input_materialized && !row.receipt_payload_present && !row.ready_for_validation && !row.receipt_validated_by_merge && !row.secret_exposure_allowed_by_merge)),
    gateRow("no_receipt_payload_merge", "Merge manifest does not read actor workspace files, materialize merged receipt input, or receive payloads.", !mergeBoundary.actor_workspace_input_present && !mergeBoundary.receipt_input_file_materialized && !mergeBoundary.merged_receipt_input_materialized && !mergeBoundary.receipt_payload_present && !mergeBoundary.ready_for_validation && !mergeBoundary.receipt_received && !mergeBoundary.receipt_validated && !mergeBoundary.signoff_completed && !mergeBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Merge manifest does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !mergeBoundary.command_execution_performed && !mergeBoundary.package_command_execution_performed && !mergeBoundary.acceptance_command_execution_performed && !mergeBoundary.generated_artifact_read_performed && !mergeBoundary.artifact_read_performed && !mergeBoundary.artifact_write_performed && !mergeBoundary.dependency_install_performed && !mergeBoundary.package_mutation_performed && !mergeBoundary.lockfile_mutation_performed && !mergeBoundary.release_published && !mergeBoundary.git_operation_performed && !mergeBoundary.protected_action_executed && !mergeBoundary.protected_recovery_execution_allowed),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !mergeBoundary.trading_live_enabled && !mergeBoundary.trading_full_auto_enabled && !mergeBoundary.trading_order_submission_allowed && !mergeBoundary.broker_write_allowed && !mergeBoundary.exchange_write_allowed && !mergeBoundary.desktop_source_of_truth && !mergeBoundary.desktop_mutation_allowed && !mergeBoundary.secret_exposure_allowed && !mergeBoundary.secret_values_read && !mergeBoundary.env_file_read && !mergeBoundary.desktop_config_content_inspected && !mergeBoundary.desktop_provider_key_visible && !mergeBoundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operations_freeze_receipt_workspace_merge_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-operations-freeze-receipt-workspace-merge-gate-row.v1",
    operations_freeze_receipt_workspace_merge_gate_row_id: `platform-operations-freeze-receipt-workspace-merge.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    actor_workspace_input_present_by_merge: false,
    receipt_input_file_materialized_by_merge: false,
    merged_receipt_input_materialized_by_merge: false,
    receipt_payload_present_by_merge: false,
    ready_for_validation_by_merge: false,
    receipt_received_by_merge: false,
    receipt_validated_by_merge: false,
    signoff_completed_by_merge: false,
    approval_applied_by_merge: false,
    receipt_workspace_artifact_read_performed_by_merge: false,
    command_execution_performed_by_merge: false,
    package_command_execution_performed_by_merge: false,
    acceptance_command_execution_performed_by_merge: false,
    generated_artifact_read_performed_by_merge: false,
    artifact_read_performed_by_merge: false,
    artifact_write_performed_by_merge: false,
    release_published_by_merge: false,
    git_operation_performed_by_merge: false,
    protected_action_executed_by_merge: false,
    protected_recovery_execution_allowed_by_merge: false,
    trading_order_submission_performed_by_merge: false,
    broker_write_allowed_by_merge: false,
    exchange_write_allowed_by_merge: false,
    desktop_source_of_truth_by_merge: false,
    desktop_mutation_allowed_by_merge: false,
    secret_exposure_allowed_by_merge: false,
    secret_values_read_by_merge: false,
    env_file_read_by_merge: false,
    desktop_config_content_inspected_by_merge: false,
    desktop_provider_key_visible_by_merge: false,
    credential_lookup_allowed_by_merge: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-operations-freeze-receipt-workspace-merge-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    receipt_workspace_merge_artifact_write_requested: writeRequested,
    receipt_workspace_consumed_in_memory: true,
    receipt_workspace_artifact_read_performed: false,
    merge_manifest_declared: true,
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
    human_review_note: "Receipt workspace merge rows are declarative only; this phase does not read actor files, merge payloads, validate, complete, or apply receipts.",
  };
}

function buildValidationItems({ workspace, packageJson, platformOpsLedger, mergeRows, mergeGateRows, mergeBoundary }) {
  return [
    validationItem("source.operations_freeze_receipt_workspace", "p492_receipt_workspace_ready", workspace.validation.valid && workspace.summary.platform_operations_freeze_receipt_workspace_status === SOURCE_READY_STATUS && workspace.summary.ready_workspace_row_count === 7, "P492 operations freeze receipt workspace source must be ready before P493 merge rows."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P493 operations freeze receipt workspace merge."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("operations_freeze_receipt_workspace_merge_rows", "merge_rows_ready", mergeRows.length === 7 && mergeRows.every((row) => row.merge_status === MERGE_READY_STATUS && row.source_workspace_status === SOURCE_WORKSPACE_ROW_READY_STATUS && row.actor_workspace_required && !row.actor_workspace_input_present && !row.receipt_input_file_materialized && !row.merged_receipt_input_materialized && !row.receipt_payload_present && !row.ready_for_validation && !row.receipt_received_by_merge && !row.receipt_validated_by_merge && !row.approval_applied_by_merge && !row.secret_exposure_allowed_by_merge), "Every operations freeze receipt workspace merge row must declare future merge without actor files, merged input, or payloads."),
    validationItem("operations_freeze_receipt_workspace_merge_gate_rows", "merge_gates_ready", mergeGateRows.length >= 8 && mergeGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_merge && !row.protected_action_executed_by_merge && !row.secret_exposure_allowed_by_merge), "P493 operations freeze receipt workspace merge gates must be ready and declarative-only."),
    validationItem("boundary.no_receipt_payload", "no_receipt_payload", mergeBoundary.read_only && mergeBoundary.report_only && mergeBoundary.receipt_workspace_consumed_in_memory && !mergeBoundary.receipt_workspace_artifact_read_performed && mergeBoundary.merge_manifest_declared && !mergeBoundary.actor_workspace_input_present && !mergeBoundary.receipt_input_file_materialized && !mergeBoundary.merged_receipt_input_materialized && !mergeBoundary.receipt_payload_present && !mergeBoundary.ready_for_validation && !mergeBoundary.receipt_received && !mergeBoundary.receipt_validated && !mergeBoundary.signoff_completed && !mergeBoundary.approval_applied, "P493 receipt workspace merge declares future merge rows without materializing or validating receipts."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !mergeBoundary.command_execution_performed && !mergeBoundary.package_command_execution_performed && !mergeBoundary.acceptance_command_execution_performed && !mergeBoundary.generated_artifact_read_performed && !mergeBoundary.artifact_read_performed && !mergeBoundary.artifact_write_performed, "P493 receipt workspace merge does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !mergeBoundary.dependency_install_performed && !mergeBoundary.package_mutation_performed && !mergeBoundary.lockfile_mutation_performed && !mergeBoundary.release_published && !mergeBoundary.git_operation_performed && !mergeBoundary.protected_action_executed && !mergeBoundary.protected_recovery_execution_allowed, "P493 receipt workspace merge performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !mergeBoundary.trading_live_enabled && !mergeBoundary.trading_full_auto_enabled && !mergeBoundary.trading_order_submission_allowed && !mergeBoundary.broker_write_allowed && !mergeBoundary.exchange_write_allowed && !mergeBoundary.desktop_source_of_truth && !mergeBoundary.desktop_mutation_allowed && !mergeBoundary.secret_exposure_allowed && !mergeBoundary.secret_values_read && !mergeBoundary.env_file_read && !mergeBoundary.desktop_config_content_inspected && !mergeBoundary.desktop_provider_key_visible && !mergeBoundary.credential_lookup_allowed, "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled."),
  ];
}

function buildSummary({ workspace, mergeRows, mergeGateRows, mergeBoundary, validation }) {
  return {
    platform_operations_freeze_receipt_workspace_merge_status: validation.valid ? MERGE_READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_workspace_status: workspace.summary.platform_operations_freeze_receipt_workspace_status,
    merge_row_count: mergeRows.length,
    ready_merge_row_count: mergeRows.filter((row) => row.merge_status === MERGE_READY_STATUS).length,
    merge_gate_count: mergeGateRows.length,
    ready_merge_gate_count: mergeGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: mergeBoundary.read_only,
    report_only: mergeBoundary.report_only,
    receipt_workspace_merge_artifact_write_requested: mergeBoundary.receipt_workspace_merge_artifact_write_requested,
    receipt_workspace_consumed_in_memory: mergeBoundary.receipt_workspace_consumed_in_memory,
    receipt_workspace_artifact_read_performed: mergeBoundary.receipt_workspace_artifact_read_performed,
    merge_manifest_declared: mergeBoundary.merge_manifest_declared,
    actor_workspace_input_present: mergeBoundary.actor_workspace_input_present,
    receipt_input_file_materialized: mergeBoundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: mergeBoundary.merged_receipt_input_materialized,
    receipt_payload_present: mergeBoundary.receipt_payload_present,
    ready_for_validation: mergeBoundary.ready_for_validation,
    receipt_received: mergeBoundary.receipt_received,
    receipt_validated: mergeBoundary.receipt_validated,
    signoff_completed: mergeBoundary.signoff_completed,
    approval_applied: mergeBoundary.approval_applied,
    command_execution_performed: mergeBoundary.command_execution_performed,
    package_command_execution_performed: mergeBoundary.package_command_execution_performed,
    acceptance_command_execution_performed: mergeBoundary.acceptance_command_execution_performed,
    generated_artifact_read_performed: mergeBoundary.generated_artifact_read_performed,
    artifact_read_performed: mergeBoundary.artifact_read_performed,
    artifact_write_performed: mergeBoundary.artifact_write_performed,
    dependency_install_performed: mergeBoundary.dependency_install_performed,
    package_mutation_performed: mergeBoundary.package_mutation_performed,
    lockfile_mutation_performed: mergeBoundary.lockfile_mutation_performed,
    release_published: mergeBoundary.release_published,
    git_operation_performed: mergeBoundary.git_operation_performed,
    protected_action_executed: mergeBoundary.protected_action_executed,
    protected_recovery_execution_allowed: mergeBoundary.protected_recovery_execution_allowed,
    trading_live_enabled: mergeBoundary.trading_live_enabled,
    trading_full_auto_enabled: mergeBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: mergeBoundary.trading_order_submission_allowed,
    broker_write_allowed: mergeBoundary.broker_write_allowed,
    exchange_write_allowed: mergeBoundary.exchange_write_allowed,
    desktop_source_of_truth: mergeBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: mergeBoundary.desktop_mutation_allowed,
    secret_exposure_allowed: mergeBoundary.secret_exposure_allowed,
    secret_values_read: mergeBoundary.secret_values_read,
    env_file_read: mergeBoundary.env_file_read,
    desktop_config_content_inspected: mergeBoundary.desktop_config_content_inspected,
    desktop_provider_key_visible: mergeBoundary.desktop_provider_key_visible,
    credential_lookup_allowed: mergeBoundary.credential_lookup_allowed,
    human_review_required: mergeBoundary.human_review_required,
    human_signoff_required: mergeBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Operations Freeze Receipt Workspace Merge",
    "",
    `Status: ${result.summary.platform_operations_freeze_receipt_workspace_merge_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source receipt workspace: ${result.summary.source_receipt_workspace_status}`,
    `Merge rows: ${result.summary.ready_merge_row_count}/${result.summary.merge_row_count}`,
    `Merge gates: ${result.summary.ready_merge_gate_count}/${result.summary.merge_gate_count}`,
    "",
    "## Merge Rows",
    "",
    ...result.operations_freeze_receipt_workspace_merge_rows.map((row) => `- ${row.invocation} (${row.required_signoff_role}): ${row.merge_status}`),
    "",
    "## Merge Gates",
    "",
    ...result.operations_freeze_receipt_workspace_merge_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operations-freeze-receipt-workspace-merge.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_OUT_DIR}
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
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_INPUTS.platformOpsLedgerPath),
    operations_freeze_source_inventory_schema_path: path.resolve(options.operationsFreezeSourceInventorySchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_INPUTS.operationsFreezeSourceInventorySchemaPath),
    operations_freeze_command_matrix_schema_path: path.resolve(options.operationsFreezeCommandMatrixSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_INPUTS.operationsFreezeCommandMatrixSchemaPath),
    operations_freeze_evidence_index_schema_path: path.resolve(options.operationsFreezeEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_INPUTS.operationsFreezeEvidenceIndexSchemaPath),
    operations_freeze_review_packet_schema_path: path.resolve(options.operationsFreezeReviewPacketSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_INPUTS.operationsFreezeReviewPacketSchemaPath),
    operations_freeze_signoff_ledger_schema_path: path.resolve(options.operationsFreezeSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_INPUTS.operationsFreezeSignoffLedgerSchemaPath),
    operations_freeze_signoff_receipt_template_schema_path: path.resolve(options.operationsFreezeSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_INPUTS.operationsFreezeSignoffReceiptTemplateSchemaPath),
    operations_freeze_signoff_receipt_intake_schema_path: path.resolve(options.operationsFreezeSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_INPUTS.operationsFreezeSignoffReceiptIntakeSchemaPath),
    operations_freeze_signoff_closeout_schema_path: path.resolve(options.operationsFreezeSignoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_INPUTS.operationsFreezeSignoffCloseoutSchemaPath),
    operations_freeze_status_ledger_schema_path: path.resolve(options.operationsFreezeStatusLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_INPUTS.operationsFreezeStatusLedgerSchemaPath),
    operations_freeze_receipt_queue_schema_path: path.resolve(options.operationsFreezeReceiptQueueSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_INPUTS.operationsFreezeReceiptQueueSchemaPath),
    operations_freeze_receipt_validation_rules_schema_path: path.resolve(options.operationsFreezeReceiptValidationRulesSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_INPUTS.operationsFreezeReceiptValidationRulesSchemaPath),
    operations_freeze_receipt_workspace_schema_path: path.resolve(options.operationsFreezeReceiptWorkspaceSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_INPUTS.operationsFreezeReceiptWorkspaceSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_MERGE_INPUTS.schemaPath),
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
    validation_item_id: `platform-operations-freeze-receipt-workspace-merge.${slugify(itemPath)}.${checkId}`,
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
