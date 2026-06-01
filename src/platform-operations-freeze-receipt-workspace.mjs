import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_INPUTS,
  buildPlatformOperationsFreezeReceiptValidationRules,
} from "./platform-operations-freeze-receipt-validation-rules.mjs";

export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_OUT_DIR = "artifacts/platform-operations-freeze-receipt-workspace/latest";
export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_INPUTS,
  operationsFreezeReceiptValidationRulesSchemaPath: DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_INPUTS.schemaPath,
  schemaPath: "schemas/platform-operations-freeze-receipt-workspace.schema.json",
};

const COMMAND_NAME = "platform:operations-freeze-receipt-workspace";
const SCHEMA_VERSION = "platform-operations-freeze-receipt-workspace.v1";
const CAPABILITY_ID = "platform.operations_freeze_receipt_workspace";
const PHASE_SLOT = "P492";
const PREVIOUS_PHASE_SLOT = "P491";
const NEXT_PHASE_SLOT = "P493";
const SOURCE_READY_STATUS = "ready_for_future_receipt_validation";
const WORKSPACE_ROW_READY_STATUS = "ready_for_human_receipt_input";
const WORKSPACE_READY_STATUS = "ready_for_human_receipt_workspace";

export async function runPlatformOperationsFreezeReceiptWorkspace(options = {}) {
  const result = await buildPlatformOperationsFreezeReceiptWorkspace(options);
  if (options.write !== false) await writePlatformOperationsFreezeReceiptWorkspace(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operations freeze receipt workspace failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperationsFreezeReceiptWorkspace(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const validationRules = await buildPlatformOperationsFreezeReceiptValidationRules({
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
    schemaPath: inputs.operations_freeze_receipt_validation_rules_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const workspaceRows = buildWorkspaceRows({ validationRules });
  const workspaceBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const workspaceAnchor = buildWorkspaceAnchor({ validationRules, packageJson, platformOpsLedger, workspaceRows });
  const workspaceGateRows = buildWorkspaceGateRows({ validationRules, packageJson, platformOpsLedger, workspaceRows, workspaceBoundary });
  const validationItems = buildValidationItems({ validationRules, packageJson, platformOpsLedger, workspaceRows, workspaceGateRows, workspaceBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ validationRules, workspaceRows, workspaceGateRows, workspaceBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operations_freeze_receipt_workspace_id: `platform-operations-freeze-receipt-workspace.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operations_freeze_receipt_workspace_anchor: workspaceAnchor,
    operations_freeze_receipt_workspace_rows: workspaceRows,
    operations_freeze_receipt_workspace_gate_rows: workspaceGateRows,
    operations_freeze_receipt_workspace_boundary: workspaceBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operations_freeze_receipt_workspace") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ validationRules, workspaceRows, workspaceGateRows, workspaceBoundary, validation: result.validation });
  result.summary.platform_operations_freeze_receipt_workspace_id = result.platform_operations_freeze_receipt_workspace_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperationsFreezeReceiptWorkspace(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-operations-freeze-receipt-workspace.json"), serializableResult(result));
  await writeJson(path.join(outDir, "freeze-receipt-workspace-rows.json"), collectionEnvelope("platform-operations-freeze-receipt-workspace-rows.v1", "operations_freeze_receipt_workspace_rows", result.operations_freeze_receipt_workspace_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-receipt-workspace-gate-rows.json"), collectionEnvelope("platform-operations-freeze-receipt-workspace-gate-rows.v1", "operations_freeze_receipt_workspace_gate_rows", result.operations_freeze_receipt_workspace_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-receipt-workspace-boundary.json"), result.operations_freeze_receipt_workspace_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operations-freeze-receipt-workspace-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperationsFreezeReceiptWorkspaceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperationsFreezeReceiptWorkspace(args);
    console.log(`Platform operations freeze receipt workspace ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operations_freeze_receipt_workspace_status}`);
    console.log(`Workspace rows: ${result.summary.ready_workspace_row_count}/${result.summary.workspace_row_count}`);
    console.log(`Workspace gates: ${result.summary.ready_workspace_gate_count}/${result.summary.workspace_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildWorkspaceAnchor({ validationRules, packageJson, platformOpsLedger, workspaceRows }) {
  return {
    schema_version: "platform-operations-freeze-receipt-workspace-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_validation_rules_id: validationRules.platform_operations_freeze_receipt_validation_rules_id,
    source_receipt_validation_rules_status: validationRules.summary.platform_operations_freeze_receipt_validation_rules_status,
    source_receipt_validation_rules_hash: hashValue({
      id: validationRules.platform_operations_freeze_receipt_validation_rules_id,
      status: validationRules.summary.platform_operations_freeze_receipt_validation_rules_status,
      rule_rows: validationRules.summary.rule_row_count,
      ready_rule_rows: validationRules.summary.ready_rule_row_count,
      gate_rows: validationRules.summary.rule_gate_count,
    }),
    package_json_hash: packageJson.content_hash,
    platform_ops_ledger_hash: platformOpsLedger.content_hash,
    workspace_rows_hash: hashValue(workspaceRows.map((row) => ({
      row_key: row.source_evidence_row_key,
      workspace_status: row.workspace_status,
      receipt_input_file_materialized: row.receipt_input_file_materialized,
      receipt_payload_present: row.receipt_payload_present,
    }))),
  };
}

function buildWorkspaceRows({ validationRules }) {
  const sourceReady = validationRules.validation.valid && validationRules.summary.platform_operations_freeze_receipt_validation_rules_status === SOURCE_READY_STATUS;
  return validationRules.operations_freeze_receipt_validation_rule_rows.map((ruleRow, index) => {
    const workspaceStatus = sourceReady && ruleRow.receipt_validation_rule_status === SOURCE_READY_STATUS ? WORKSPACE_ROW_READY_STATUS : "blocked";
    const row = {
      schema_version: "platform-operations-freeze-receipt-workspace-row.v1",
      operations_freeze_receipt_workspace_row_id: `platform-operations-freeze-receipt-workspace.row.${ruleRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_validation_rule_row_id: ruleRow.operations_freeze_receipt_validation_rule_row_id,
      source_evidence_row_key: ruleRow.source_evidence_row_key,
      queue_position: ruleRow.queue_position,
      package_script_name: ruleRow.package_script_name,
      invocation: ruleRow.invocation,
      evidence_kind: ruleRow.evidence_kind,
      expected_report_path: ruleRow.expected_report_path,
      required_reviewer_role: ruleRow.required_reviewer_role,
      required_signoff_role: ruleRow.required_signoff_role,
      workspace_status: workspaceStatus,
      source_receipt_validation_rule_status: ruleRow.receipt_validation_rule_status,
      required_receipt_fields: ruleRow.required_receipt_fields,
      allowed_receipt_decisions: ruleRow.allowed_receipt_decisions,
      editable_receipt_fields_declared: true,
      receipt_input_file_materialized: false,
      receipt_payload_present: false,
      ready_for_validation: false,
      receipt_received_by_workspace: false,
      receipt_validated_by_workspace: false,
      signoff_completed_by_workspace: false,
      approval_applied_by_workspace: false,
      validation_rules_consumed_in_memory: true,
      validation_rules_artifact_read_performed_by_workspace: false,
      command_execution_performed_by_workspace: false,
      package_command_execution_performed_by_workspace: false,
      acceptance_command_execution_performed_by_workspace: false,
      generated_artifact_read_performed_by_workspace: false,
      artifact_read_performed_by_workspace: false,
      artifact_write_performed_by_workspace: false,
      dependency_install_performed_by_workspace: false,
      package_mutation_performed_by_workspace: false,
      lockfile_mutation_performed_by_workspace: false,
      release_published_by_workspace: false,
      git_operation_performed_by_workspace: false,
      protected_action_executed_by_workspace: false,
      protected_recovery_execution_allowed_by_workspace: false,
      trading_live_enabled_by_workspace: false,
      trading_full_auto_enabled_by_workspace: false,
      trading_order_submission_allowed_by_workspace: false,
      broker_write_allowed_by_workspace: false,
      exchange_write_allowed_by_workspace: false,
      desktop_source_of_truth_by_workspace: false,
      desktop_mutation_allowed_by_workspace: false,
      secret_exposure_allowed_by_workspace: false,
      secret_values_read_by_workspace: false,
      env_file_read_by_workspace: false,
      desktop_config_content_inspected_by_workspace: false,
      desktop_provider_key_visible_by_workspace: false,
      credential_lookup_allowed_by_workspace: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Workspace fields are declared for ${ruleRow.invocation}; no receipt input file or payload is materialized by this phase.`,
    };
    return withOrdinalAndHash(row, index, "operations_freeze_receipt_workspace_row_hash");
  });
}

function buildWorkspaceGateRows({ validationRules, packageJson, platformOpsLedger, workspaceRows, workspaceBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p491_receipt_validation_rules_ready", "P491 operations freeze receipt validation rules source is ready.", validationRules.validation.valid && validationRules.summary.platform_operations_freeze_receipt_validation_rules_status === SOURCE_READY_STATUS && validationRules.summary.ready_rule_row_count === 7),
    gateRow("platform_package_script_registered", "package.json registers the P492 platform operations freeze receipt workspace command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P492 platform operations freeze receipt workspace command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p492_ledger_acceptance_declared", "P492 acceptance row is declared in the platform operations ledger.", ledgerText.includes(`P492: \`${COMMAND_NAME}\``)),
    gateRow("workspace_rows_ready", "All operations freeze receipt workspace rows are ready for external human receipt input.", workspaceRows.length === 7 && workspaceRows.every((row) => row.workspace_status === WORKSPACE_ROW_READY_STATUS && row.editable_receipt_fields_declared && !row.receipt_input_file_materialized && !row.receipt_payload_present && !row.ready_for_validation && !row.receipt_validated_by_workspace && !row.secret_exposure_allowed_by_workspace)),
    gateRow("no_receipt_payload_materialization", "Workspace declares editable fields without materializing receipt input files or receiving payloads.", workspaceBoundary.editable_receipt_fields_declared && !workspaceBoundary.receipt_input_file_materialized && !workspaceBoundary.receipt_payload_present && !workspaceBoundary.ready_for_validation && !workspaceBoundary.receipt_received && !workspaceBoundary.receipt_validated && !workspaceBoundary.signoff_completed && !workspaceBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Workspace does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !workspaceBoundary.command_execution_performed && !workspaceBoundary.package_command_execution_performed && !workspaceBoundary.acceptance_command_execution_performed && !workspaceBoundary.generated_artifact_read_performed && !workspaceBoundary.artifact_read_performed && !workspaceBoundary.artifact_write_performed && !workspaceBoundary.dependency_install_performed && !workspaceBoundary.package_mutation_performed && !workspaceBoundary.lockfile_mutation_performed && !workspaceBoundary.release_published && !workspaceBoundary.git_operation_performed && !workspaceBoundary.protected_action_executed && !workspaceBoundary.protected_recovery_execution_allowed),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !workspaceBoundary.trading_live_enabled && !workspaceBoundary.trading_full_auto_enabled && !workspaceBoundary.trading_order_submission_allowed && !workspaceBoundary.broker_write_allowed && !workspaceBoundary.exchange_write_allowed && !workspaceBoundary.desktop_source_of_truth && !workspaceBoundary.desktop_mutation_allowed && !workspaceBoundary.secret_exposure_allowed && !workspaceBoundary.secret_values_read && !workspaceBoundary.env_file_read && !workspaceBoundary.desktop_config_content_inspected && !workspaceBoundary.desktop_provider_key_visible && !workspaceBoundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operations_freeze_receipt_workspace_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-operations-freeze-receipt-workspace-gate-row.v1",
    operations_freeze_receipt_workspace_gate_row_id: `platform-operations-freeze-receipt-workspace.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_input_file_materialized_by_workspace: false,
    receipt_payload_present_by_workspace: false,
    ready_for_validation_by_workspace: false,
    receipt_received_by_workspace: false,
    receipt_validated_by_workspace: false,
    signoff_completed_by_workspace: false,
    approval_applied_by_workspace: false,
    validation_rules_artifact_read_performed_by_workspace: false,
    command_execution_performed_by_workspace: false,
    package_command_execution_performed_by_workspace: false,
    acceptance_command_execution_performed_by_workspace: false,
    generated_artifact_read_performed_by_workspace: false,
    artifact_read_performed_by_workspace: false,
    artifact_write_performed_by_workspace: false,
    release_published_by_workspace: false,
    git_operation_performed_by_workspace: false,
    protected_action_executed_by_workspace: false,
    protected_recovery_execution_allowed_by_workspace: false,
    trading_order_submission_performed_by_workspace: false,
    broker_write_allowed_by_workspace: false,
    exchange_write_allowed_by_workspace: false,
    desktop_source_of_truth_by_workspace: false,
    desktop_mutation_allowed_by_workspace: false,
    secret_exposure_allowed_by_workspace: false,
    secret_values_read_by_workspace: false,
    env_file_read_by_workspace: false,
    desktop_config_content_inspected_by_workspace: false,
    desktop_provider_key_visible_by_workspace: false,
    credential_lookup_allowed_by_workspace: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-operations-freeze-receipt-workspace-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    receipt_workspace_artifact_write_requested: writeRequested,
    validation_rules_consumed_in_memory: true,
    validation_rules_artifact_read_performed: false,
    workspace_rows_declared: true,
    editable_receipt_fields_declared: true,
    receipt_input_file_materialized: false,
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
    human_review_note: "Receipt workspace rows are declarative only; this phase does not materialize, receive, validate, complete, or apply receipts.",
  };
}

function buildValidationItems({ validationRules, packageJson, platformOpsLedger, workspaceRows, workspaceGateRows, workspaceBoundary }) {
  return [
    validationItem("source.operations_freeze_receipt_validation_rules", "p491_receipt_validation_rules_ready", validationRules.validation.valid && validationRules.summary.platform_operations_freeze_receipt_validation_rules_status === SOURCE_READY_STATUS && validationRules.summary.ready_rule_row_count === 7, "P491 operations freeze receipt validation rules source must be ready before P492 workspace rows."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P492 operations freeze receipt workspace."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("operations_freeze_receipt_workspace_rows", "workspace_rows_ready", workspaceRows.length === 7 && workspaceRows.every((row) => row.workspace_status === WORKSPACE_ROW_READY_STATUS && row.source_receipt_validation_rule_status === SOURCE_READY_STATUS && row.editable_receipt_fields_declared && !row.receipt_input_file_materialized && !row.receipt_payload_present && !row.ready_for_validation && !row.receipt_received_by_workspace && !row.receipt_validated_by_workspace && !row.approval_applied_by_workspace && !row.secret_exposure_allowed_by_workspace), "Every operations freeze receipt workspace row must declare editable fields without materialized receipt files or payloads."),
    validationItem("operations_freeze_receipt_workspace_gate_rows", "workspace_gates_ready", workspaceGateRows.length >= 8 && workspaceGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_workspace && !row.protected_action_executed_by_workspace && !row.secret_exposure_allowed_by_workspace), "P492 operations freeze receipt workspace gates must be ready and declarative-only."),
    validationItem("boundary.no_receipt_payload", "no_receipt_payload", workspaceBoundary.read_only && workspaceBoundary.report_only && workspaceBoundary.validation_rules_consumed_in_memory && !workspaceBoundary.validation_rules_artifact_read_performed && workspaceBoundary.workspace_rows_declared && workspaceBoundary.editable_receipt_fields_declared && !workspaceBoundary.receipt_input_file_materialized && !workspaceBoundary.receipt_payload_present && !workspaceBoundary.ready_for_validation && !workspaceBoundary.receipt_received && !workspaceBoundary.receipt_validated && !workspaceBoundary.signoff_completed && !workspaceBoundary.approval_applied, "P492 receipt workspace declares human input rows without materializing or validating receipts."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !workspaceBoundary.command_execution_performed && !workspaceBoundary.package_command_execution_performed && !workspaceBoundary.acceptance_command_execution_performed && !workspaceBoundary.generated_artifact_read_performed && !workspaceBoundary.artifact_read_performed && !workspaceBoundary.artifact_write_performed, "P492 receipt workspace does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !workspaceBoundary.dependency_install_performed && !workspaceBoundary.package_mutation_performed && !workspaceBoundary.lockfile_mutation_performed && !workspaceBoundary.release_published && !workspaceBoundary.git_operation_performed && !workspaceBoundary.protected_action_executed && !workspaceBoundary.protected_recovery_execution_allowed, "P492 receipt workspace performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !workspaceBoundary.trading_live_enabled && !workspaceBoundary.trading_full_auto_enabled && !workspaceBoundary.trading_order_submission_allowed && !workspaceBoundary.broker_write_allowed && !workspaceBoundary.exchange_write_allowed && !workspaceBoundary.desktop_source_of_truth && !workspaceBoundary.desktop_mutation_allowed && !workspaceBoundary.secret_exposure_allowed && !workspaceBoundary.secret_values_read && !workspaceBoundary.env_file_read && !workspaceBoundary.desktop_config_content_inspected && !workspaceBoundary.desktop_provider_key_visible && !workspaceBoundary.credential_lookup_allowed, "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled."),
  ];
}

function buildSummary({ validationRules, workspaceRows, workspaceGateRows, workspaceBoundary, validation }) {
  return {
    platform_operations_freeze_receipt_workspace_status: validation.valid ? WORKSPACE_READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_validation_rules_status: validationRules.summary.platform_operations_freeze_receipt_validation_rules_status,
    workspace_row_count: workspaceRows.length,
    ready_workspace_row_count: workspaceRows.filter((row) => row.workspace_status === WORKSPACE_ROW_READY_STATUS).length,
    workspace_gate_count: workspaceGateRows.length,
    ready_workspace_gate_count: workspaceGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: workspaceBoundary.read_only,
    report_only: workspaceBoundary.report_only,
    receipt_workspace_artifact_write_requested: workspaceBoundary.receipt_workspace_artifact_write_requested,
    validation_rules_consumed_in_memory: workspaceBoundary.validation_rules_consumed_in_memory,
    validation_rules_artifact_read_performed: workspaceBoundary.validation_rules_artifact_read_performed,
    workspace_rows_declared: workspaceBoundary.workspace_rows_declared,
    editable_receipt_fields_declared: workspaceBoundary.editable_receipt_fields_declared,
    receipt_input_file_materialized: workspaceBoundary.receipt_input_file_materialized,
    receipt_payload_present: workspaceBoundary.receipt_payload_present,
    ready_for_validation: workspaceBoundary.ready_for_validation,
    receipt_received: workspaceBoundary.receipt_received,
    receipt_validated: workspaceBoundary.receipt_validated,
    signoff_completed: workspaceBoundary.signoff_completed,
    approval_applied: workspaceBoundary.approval_applied,
    command_execution_performed: workspaceBoundary.command_execution_performed,
    package_command_execution_performed: workspaceBoundary.package_command_execution_performed,
    acceptance_command_execution_performed: workspaceBoundary.acceptance_command_execution_performed,
    generated_artifact_read_performed: workspaceBoundary.generated_artifact_read_performed,
    artifact_read_performed: workspaceBoundary.artifact_read_performed,
    artifact_write_performed: workspaceBoundary.artifact_write_performed,
    dependency_install_performed: workspaceBoundary.dependency_install_performed,
    package_mutation_performed: workspaceBoundary.package_mutation_performed,
    lockfile_mutation_performed: workspaceBoundary.lockfile_mutation_performed,
    release_published: workspaceBoundary.release_published,
    git_operation_performed: workspaceBoundary.git_operation_performed,
    protected_action_executed: workspaceBoundary.protected_action_executed,
    protected_recovery_execution_allowed: workspaceBoundary.protected_recovery_execution_allowed,
    trading_live_enabled: workspaceBoundary.trading_live_enabled,
    trading_full_auto_enabled: workspaceBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: workspaceBoundary.trading_order_submission_allowed,
    broker_write_allowed: workspaceBoundary.broker_write_allowed,
    exchange_write_allowed: workspaceBoundary.exchange_write_allowed,
    desktop_source_of_truth: workspaceBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: workspaceBoundary.desktop_mutation_allowed,
    secret_exposure_allowed: workspaceBoundary.secret_exposure_allowed,
    secret_values_read: workspaceBoundary.secret_values_read,
    env_file_read: workspaceBoundary.env_file_read,
    desktop_config_content_inspected: workspaceBoundary.desktop_config_content_inspected,
    desktop_provider_key_visible: workspaceBoundary.desktop_provider_key_visible,
    credential_lookup_allowed: workspaceBoundary.credential_lookup_allowed,
    human_review_required: workspaceBoundary.human_review_required,
    human_signoff_required: workspaceBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Operations Freeze Receipt Workspace",
    "",
    `Status: ${result.summary.platform_operations_freeze_receipt_workspace_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source validation rules: ${result.summary.source_receipt_validation_rules_status}`,
    `Workspace rows: ${result.summary.ready_workspace_row_count}/${result.summary.workspace_row_count}`,
    `Workspace gates: ${result.summary.ready_workspace_gate_count}/${result.summary.workspace_gate_count}`,
    "",
    "## Workspace Rows",
    "",
    ...result.operations_freeze_receipt_workspace_rows.map((row) => `- ${row.invocation} (${row.required_signoff_role}): ${row.workspace_status}`),
    "",
    "## Workspace Gates",
    "",
    ...result.operations_freeze_receipt_workspace_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operations-freeze-receipt-workspace.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_OUT_DIR}
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
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_INPUTS.platformOpsLedgerPath),
    operations_freeze_source_inventory_schema_path: path.resolve(options.operationsFreezeSourceInventorySchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_INPUTS.operationsFreezeSourceInventorySchemaPath),
    operations_freeze_command_matrix_schema_path: path.resolve(options.operationsFreezeCommandMatrixSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_INPUTS.operationsFreezeCommandMatrixSchemaPath),
    operations_freeze_evidence_index_schema_path: path.resolve(options.operationsFreezeEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_INPUTS.operationsFreezeEvidenceIndexSchemaPath),
    operations_freeze_review_packet_schema_path: path.resolve(options.operationsFreezeReviewPacketSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_INPUTS.operationsFreezeReviewPacketSchemaPath),
    operations_freeze_signoff_ledger_schema_path: path.resolve(options.operationsFreezeSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_INPUTS.operationsFreezeSignoffLedgerSchemaPath),
    operations_freeze_signoff_receipt_template_schema_path: path.resolve(options.operationsFreezeSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_INPUTS.operationsFreezeSignoffReceiptTemplateSchemaPath),
    operations_freeze_signoff_receipt_intake_schema_path: path.resolve(options.operationsFreezeSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_INPUTS.operationsFreezeSignoffReceiptIntakeSchemaPath),
    operations_freeze_signoff_closeout_schema_path: path.resolve(options.operationsFreezeSignoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_INPUTS.operationsFreezeSignoffCloseoutSchemaPath),
    operations_freeze_status_ledger_schema_path: path.resolve(options.operationsFreezeStatusLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_INPUTS.operationsFreezeStatusLedgerSchemaPath),
    operations_freeze_receipt_queue_schema_path: path.resolve(options.operationsFreezeReceiptQueueSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_INPUTS.operationsFreezeReceiptQueueSchemaPath),
    operations_freeze_receipt_validation_rules_schema_path: path.resolve(options.operationsFreezeReceiptValidationRulesSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_INPUTS.operationsFreezeReceiptValidationRulesSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_WORKSPACE_INPUTS.schemaPath),
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
    validation_item_id: `platform-operations-freeze-receipt-workspace.${slugify(itemPath)}.${checkId}`,
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
