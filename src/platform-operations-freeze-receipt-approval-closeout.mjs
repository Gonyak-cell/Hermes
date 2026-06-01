import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_PLAN_INPUTS,
  buildPlatformOperationsFreezeReceiptApprovalPlan,
} from "./platform-operations-freeze-receipt-approval-plan.mjs";

export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_OUT_DIR = "artifacts/platform-operations-freeze-receipt-approval-closeout/latest";
export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_PLAN_INPUTS,
  operationsFreezeReceiptApprovalPlanSchemaPath: DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_PLAN_INPUTS.schemaPath,
  schemaPath: "schemas/platform-operations-freeze-receipt-approval-closeout.schema.json",
};

const COMMAND_NAME = "platform:operations-freeze-receipt-approval-closeout";
const SCHEMA_VERSION = "platform-operations-freeze-receipt-approval-closeout.v1";
const CAPABILITY_ID = "platform.operations_freeze_receipt_approval_closeout";
const PHASE_SLOT = "P497";
const PREVIOUS_PHASE_SLOT = "P496";
const NEXT_PHASE_SLOT = "P498";
const SOURCE_READY_STATUS = "ready_for_future_receipt_approval_plan";
const CLOSEOUT_READY_STATUS = "ready_for_future_receipt_approval_closeout";
const APPROVAL_CLOSEOUT_CHECKS = [
  "approval_plan_ready",
  "future_receipt_decision_allows_signoff",
  "reviewer_role_matches_plan",
  "evidence_reference_confirmed",
  "command_result_reference_confirmed",
  "blocker_note_resolved_or_recorded",
  "human_gate_application_future_only",
];

export async function runPlatformOperationsFreezeReceiptApprovalCloseout(options = {}) {
  const result = await buildPlatformOperationsFreezeReceiptApprovalCloseout(options);
  if (options.write !== false) await writePlatformOperationsFreezeReceiptApprovalCloseout(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operations freeze receipt approval closeout failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperationsFreezeReceiptApprovalCloseout(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const approvalPlan = await buildPlatformOperationsFreezeReceiptApprovalPlan({
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
    schemaPath: inputs.operations_freeze_receipt_approval_plan_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const closeoutRows = buildCloseoutRows({ approvalPlan });
  const closeoutBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const closeoutAnchor = buildCloseoutAnchor({ approvalPlan, packageJson, platformOpsLedger, closeoutRows });
  const closeoutGateRows = buildCloseoutGateRows({ approvalPlan, packageJson, platformOpsLedger, closeoutRows, closeoutBoundary });
  const validationItems = buildValidationItems({ approvalPlan, packageJson, platformOpsLedger, closeoutRows, closeoutGateRows, closeoutBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ approvalPlan, closeoutRows, closeoutGateRows, closeoutBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operations_freeze_receipt_approval_closeout_id: `platform-operations-freeze-receipt-approval-closeout.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operations_freeze_receipt_approval_closeout_anchor: closeoutAnchor,
    operations_freeze_receipt_approval_closeout_rows: closeoutRows,
    operations_freeze_receipt_approval_closeout_gate_rows: closeoutGateRows,
    operations_freeze_receipt_approval_closeout_boundary: closeoutBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operations_freeze_receipt_approval_closeout") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ approvalPlan, closeoutRows, closeoutGateRows, closeoutBoundary, validation: result.validation });
  result.summary.platform_operations_freeze_receipt_approval_closeout_id = result.platform_operations_freeze_receipt_approval_closeout_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperationsFreezeReceiptApprovalCloseout(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-operations-freeze-receipt-approval-closeout.json"), serializableResult(result));
  await writeJson(path.join(outDir, "freeze-receipt-approval-closeout-rows.json"), collectionEnvelope("platform-operations-freeze-receipt-approval-closeout-rows.v1", "operations_freeze_receipt_approval_closeout_rows", result.operations_freeze_receipt_approval_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-receipt-approval-closeout-gate-rows.json"), collectionEnvelope("platform-operations-freeze-receipt-approval-closeout-gate-rows.v1", "operations_freeze_receipt_approval_closeout_gate_rows", result.operations_freeze_receipt_approval_closeout_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-receipt-approval-closeout-boundary.json"), result.operations_freeze_receipt_approval_closeout_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operations-freeze-receipt-approval-closeout-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperationsFreezeReceiptApprovalCloseoutCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperationsFreezeReceiptApprovalCloseout(args);
    console.log(`Platform operations freeze receipt approval closeout ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operations_freeze_receipt_approval_closeout_status}`);
    console.log(`Approval closeout rows: ${result.summary.ready_approval_closeout_row_count}/${result.summary.approval_closeout_row_count}`);
    console.log(`Approval closeout gates: ${result.summary.ready_approval_closeout_gate_count}/${result.summary.approval_closeout_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildCloseoutAnchor({ approvalPlan, packageJson, platformOpsLedger, closeoutRows }) {
  return {
    schema_version: "platform-operations-freeze-receipt-approval-closeout-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_approval_plan_id: approvalPlan.platform_operations_freeze_receipt_approval_plan_id,
    source_receipt_approval_plan_status: approvalPlan.summary.platform_operations_freeze_receipt_approval_plan_status,
    source_receipt_approval_plan_hash: hashValue({
      id: approvalPlan.platform_operations_freeze_receipt_approval_plan_id,
      status: approvalPlan.summary.platform_operations_freeze_receipt_approval_plan_status,
      approval_plan_rows: approvalPlan.summary.approval_plan_row_count,
      ready_approval_plan_rows: approvalPlan.summary.ready_approval_plan_row_count,
      gate_rows: approvalPlan.summary.approval_plan_gate_count,
    }),
    package_json_hash: packageJson.content_hash,
    platform_ops_ledger_hash: platformOpsLedger.content_hash,
    closeout_rows_hash: hashValue(closeoutRows.map((row) => ({
      row_key: row.source_evidence_row_key,
      approval_closeout_status: row.approval_closeout_status,
      receipt_payload_present: row.receipt_payload_present,
    }))),
  };
}

function buildCloseoutRows({ approvalPlan }) {
  const sourceReady = approvalPlan.validation.valid && approvalPlan.summary.platform_operations_freeze_receipt_approval_plan_status === SOURCE_READY_STATUS;
  return approvalPlan.operations_freeze_receipt_approval_plan_rows.map((planRow, index) => {
    const closeoutStatus = sourceReady && planRow.approval_plan_status === SOURCE_READY_STATUS ? CLOSEOUT_READY_STATUS : "blocked";
    const row = {
      schema_version: "platform-operations-freeze-receipt-approval-closeout-row.v1",
      operations_freeze_receipt_approval_closeout_row_id: `platform-operations-freeze-receipt-approval-closeout.row.${planRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_approval_plan_row_id: planRow.operations_freeze_receipt_approval_plan_row_id,
      source_evidence_row_key: planRow.source_evidence_row_key,
      queue_position: planRow.queue_position,
      package_script_name: planRow.package_script_name,
      invocation: planRow.invocation,
      evidence_kind: planRow.evidence_kind,
      expected_report_path: planRow.expected_report_path,
      required_reviewer_role: planRow.required_reviewer_role,
      required_signoff_role: planRow.required_signoff_role,
      approval_closeout_status: closeoutStatus,
      source_approval_plan_status: planRow.approval_plan_status,
      actor_workspace_required: true,
      actor_workspace_input_present: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      approval_closeout_declared: true,
      approval_closeout_checks: APPROVAL_CLOSEOUT_CHECKS,
      ready_for_validation: false,
      ready_for_approval_application: false,
      receipt_received_by_closeout: false,
      receipt_validated_by_closeout: false,
      signoff_completed_by_closeout: false,
      approval_applied_by_closeout: false,
      receipt_approval_plan_consumed_in_memory: true,
      receipt_approval_plan_artifact_read_performed_by_closeout: false,
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
      human_review_note: `Future approval closeout is declared for ${planRow.invocation}; no receipt payload is received, validated, approved, or applied by this phase.`,
    };
    return withOrdinalAndHash(row, index, "operations_freeze_receipt_approval_closeout_row_hash");
  });
}

function buildCloseoutGateRows({ approvalPlan, packageJson, platformOpsLedger, closeoutRows, closeoutBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p496_receipt_approval_plan_ready", "P496 operations freeze receipt approval plan source is ready.", approvalPlan.validation.valid && approvalPlan.summary.platform_operations_freeze_receipt_approval_plan_status === SOURCE_READY_STATUS && approvalPlan.summary.ready_approval_plan_row_count === 7),
    gateRow("platform_package_script_registered", "package.json registers the P497 platform operations freeze receipt approval closeout command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P497 platform operations freeze receipt approval closeout command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p497_ledger_acceptance_declared", "P497 acceptance row is declared in the platform operations ledger.", ledgerText.includes(`P497: \`${COMMAND_NAME}\``)),
    gateRow("approval_closeout_rows_ready", "All operations freeze receipt approval closeout rows are ready for future approval closeout without receipt payloads.", closeoutRows.length === 7 && closeoutRows.every((row) => row.approval_closeout_status === CLOSEOUT_READY_STATUS && row.source_approval_plan_status === SOURCE_READY_STATUS && row.approval_closeout_declared && row.approval_closeout_checks.length >= 7 && row.actor_workspace_required && !row.actor_workspace_input_present && !row.receipt_input_file_materialized && !row.merged_receipt_input_materialized && !row.receipt_payload_present && !row.ready_for_validation && !row.ready_for_approval_application && !row.receipt_validated_by_closeout && !row.approval_applied_by_closeout && !row.secret_exposure_allowed_by_closeout)),
    gateRow("no_receipt_payload_or_approval", "Approval closeout does not read actor files, materialize merged receipt input, receive payloads, validate receipts, complete signoff, prepare approval application, or apply approvals.", !closeoutBoundary.actor_workspace_input_present && !closeoutBoundary.receipt_input_file_materialized && !closeoutBoundary.merged_receipt_input_materialized && !closeoutBoundary.receipt_payload_present && !closeoutBoundary.ready_for_validation && !closeoutBoundary.ready_for_approval_application && !closeoutBoundary.receipt_received && !closeoutBoundary.receipt_validated && !closeoutBoundary.signoff_completed && !closeoutBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Approval closeout does not execute commands, read/write artifacts, publish releases, run git, execute protected actions, or mutate dependencies/packages/lockfiles.", !closeoutBoundary.command_execution_performed && !closeoutBoundary.package_command_execution_performed && !closeoutBoundary.acceptance_command_execution_performed && !closeoutBoundary.generated_artifact_read_performed && !closeoutBoundary.artifact_read_performed && !closeoutBoundary.artifact_write_performed && !closeoutBoundary.dependency_install_performed && !closeoutBoundary.package_mutation_performed && !closeoutBoundary.lockfile_mutation_performed && !closeoutBoundary.release_published && !closeoutBoundary.git_operation_performed && !closeoutBoundary.protected_action_executed && !closeoutBoundary.protected_recovery_execution_allowed),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !closeoutBoundary.trading_live_enabled && !closeoutBoundary.trading_full_auto_enabled && !closeoutBoundary.trading_order_submission_allowed && !closeoutBoundary.broker_write_allowed && !closeoutBoundary.exchange_write_allowed && !closeoutBoundary.desktop_source_of_truth && !closeoutBoundary.desktop_mutation_allowed && !closeoutBoundary.secret_exposure_allowed && !closeoutBoundary.secret_values_read && !closeoutBoundary.env_file_read && !closeoutBoundary.desktop_config_content_inspected && !closeoutBoundary.desktop_provider_key_visible && !closeoutBoundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operations_freeze_receipt_approval_closeout_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-operations-freeze-receipt-approval-closeout-gate-row.v1",
    operations_freeze_receipt_approval_closeout_gate_row_id: `platform-operations-freeze-receipt-approval-closeout.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    actor_workspace_input_present_by_closeout: false,
    receipt_input_file_materialized_by_closeout: false,
    merged_receipt_input_materialized_by_closeout: false,
    receipt_payload_present_by_closeout: false,
    ready_for_validation_by_closeout: false,
    ready_for_approval_application_by_closeout: false,
    receipt_received_by_closeout: false,
    receipt_validated_by_closeout: false,
    signoff_completed_by_closeout: false,
    approval_applied_by_closeout: false,
    receipt_approval_plan_artifact_read_performed_by_closeout: false,
    command_execution_performed_by_closeout: false,
    package_command_execution_performed_by_closeout: false,
    acceptance_command_execution_performed_by_closeout: false,
    generated_artifact_read_performed_by_closeout: false,
    artifact_read_performed_by_closeout: false,
    artifact_write_performed_by_closeout: false,
    release_published_by_closeout: false,
    git_operation_performed_by_closeout: false,
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

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-operations-freeze-receipt-approval-closeout-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    receipt_approval_closeout_artifact_write_requested: writeRequested,
    receipt_approval_plan_consumed_in_memory: true,
    receipt_approval_plan_artifact_read_performed: false,
    approval_closeout_declared: true,
    actor_workspace_input_present: false,
    receipt_input_file_materialized: false,
    merged_receipt_input_materialized: false,
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
    human_review_note: "Receipt approval closeout rows are declarative only; this phase does not receive, validate, complete, prepare, approve, or apply receipts.",
  };
}

function buildValidationItems({ approvalPlan, packageJson, platformOpsLedger, closeoutRows, closeoutGateRows, closeoutBoundary }) {
  return [
    validationItem("source.operations_freeze_receipt_approval_plan", "p496_receipt_approval_plan_ready", approvalPlan.validation.valid && approvalPlan.summary.platform_operations_freeze_receipt_approval_plan_status === SOURCE_READY_STATUS && approvalPlan.summary.ready_approval_plan_row_count === 7, "P496 operations freeze receipt approval plan source must be ready before P497 approval closeout rows."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P497 operations freeze receipt approval closeout."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("operations_freeze_receipt_approval_closeout_rows", "approval_closeout_rows_ready", closeoutRows.length === 7 && closeoutRows.every((row) => row.approval_closeout_status === CLOSEOUT_READY_STATUS && row.source_approval_plan_status === SOURCE_READY_STATUS && row.approval_closeout_declared && row.approval_closeout_checks.length >= 7 && row.actor_workspace_required && !row.actor_workspace_input_present && !row.receipt_input_file_materialized && !row.merged_receipt_input_materialized && !row.receipt_payload_present && !row.ready_for_validation && !row.ready_for_approval_application && !row.receipt_received_by_closeout && !row.receipt_validated_by_closeout && !row.approval_applied_by_closeout && !row.secret_exposure_allowed_by_closeout), "Every operations freeze receipt approval closeout row must declare future approval closeout without actor files, merged input, payloads, approval application, or secret exposure."),
    validationItem("operations_freeze_receipt_approval_closeout_gate_rows", "approval_closeout_gates_ready", closeoutGateRows.length >= 8 && closeoutGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_closeout && !row.protected_action_executed_by_closeout && !row.secret_exposure_allowed_by_closeout), "P497 operations freeze receipt approval closeout gates must be ready and declarative-only."),
    validationItem("boundary.no_receipt_payload", "no_receipt_payload", closeoutBoundary.read_only && closeoutBoundary.report_only && closeoutBoundary.receipt_approval_plan_consumed_in_memory && !closeoutBoundary.receipt_approval_plan_artifact_read_performed && closeoutBoundary.approval_closeout_declared && !closeoutBoundary.actor_workspace_input_present && !closeoutBoundary.receipt_input_file_materialized && !closeoutBoundary.merged_receipt_input_materialized && !closeoutBoundary.receipt_payload_present && !closeoutBoundary.ready_for_validation && !closeoutBoundary.ready_for_approval_application && !closeoutBoundary.receipt_received && !closeoutBoundary.receipt_validated && !closeoutBoundary.signoff_completed && !closeoutBoundary.approval_applied, "P497 receipt approval closeout declares approval closeouts without materializing, validating, or applying receipts."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !closeoutBoundary.command_execution_performed && !closeoutBoundary.package_command_execution_performed && !closeoutBoundary.acceptance_command_execution_performed && !closeoutBoundary.generated_artifact_read_performed && !closeoutBoundary.artifact_read_performed && !closeoutBoundary.artifact_write_performed, "P497 receipt approval closeout does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !closeoutBoundary.dependency_install_performed && !closeoutBoundary.package_mutation_performed && !closeoutBoundary.lockfile_mutation_performed && !closeoutBoundary.release_published && !closeoutBoundary.git_operation_performed && !closeoutBoundary.protected_action_executed && !closeoutBoundary.protected_recovery_execution_allowed, "P497 receipt approval closeout performs no dependency, package, lockfile, release, git, protected, or recovery mutation."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !closeoutBoundary.trading_live_enabled && !closeoutBoundary.trading_full_auto_enabled && !closeoutBoundary.trading_order_submission_allowed && !closeoutBoundary.broker_write_allowed && !closeoutBoundary.exchange_write_allowed && !closeoutBoundary.desktop_source_of_truth && !closeoutBoundary.desktop_mutation_allowed && !closeoutBoundary.secret_exposure_allowed && !closeoutBoundary.secret_values_read && !closeoutBoundary.env_file_read && !closeoutBoundary.desktop_config_content_inspected && !closeoutBoundary.desktop_provider_key_visible && !closeoutBoundary.credential_lookup_allowed, "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled."),
  ];
}

function buildSummary({ approvalPlan, closeoutRows, closeoutGateRows, closeoutBoundary, validation }) {
  return {
    platform_operations_freeze_receipt_approval_closeout_status: validation.valid ? CLOSEOUT_READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_approval_plan_status: approvalPlan.summary.platform_operations_freeze_receipt_approval_plan_status,
    approval_closeout_row_count: closeoutRows.length,
    ready_approval_closeout_row_count: closeoutRows.filter((row) => row.approval_closeout_status === CLOSEOUT_READY_STATUS).length,
    approval_closeout_gate_count: closeoutGateRows.length,
    ready_approval_closeout_gate_count: closeoutGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: closeoutBoundary.read_only,
    report_only: closeoutBoundary.report_only,
    receipt_approval_closeout_artifact_write_requested: closeoutBoundary.receipt_approval_closeout_artifact_write_requested,
    receipt_approval_plan_consumed_in_memory: closeoutBoundary.receipt_approval_plan_consumed_in_memory,
    receipt_approval_plan_artifact_read_performed: closeoutBoundary.receipt_approval_plan_artifact_read_performed,
    approval_closeout_declared: closeoutBoundary.approval_closeout_declared,
    actor_workspace_input_present: closeoutBoundary.actor_workspace_input_present,
    receipt_input_file_materialized: closeoutBoundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: closeoutBoundary.merged_receipt_input_materialized,
    receipt_payload_present: closeoutBoundary.receipt_payload_present,
    ready_for_validation: closeoutBoundary.ready_for_validation,
    ready_for_approval_application: closeoutBoundary.ready_for_approval_application,
    receipt_received: closeoutBoundary.receipt_received,
    receipt_validated: closeoutBoundary.receipt_validated,
    signoff_completed: closeoutBoundary.signoff_completed,
    approval_applied: closeoutBoundary.approval_applied,
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
    "# Platform Operations Freeze Receipt Approval Closeout",
    "",
    `Status: ${result.summary.platform_operations_freeze_receipt_approval_closeout_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source receipt approval plan: ${result.summary.source_receipt_approval_plan_status}`,
    `Approval closeout rows: ${result.summary.ready_approval_closeout_row_count}/${result.summary.approval_closeout_row_count}`,
    `Approval closeout gates: ${result.summary.ready_approval_closeout_gate_count}/${result.summary.approval_closeout_gate_count}`,
    "",
    "## Approval Closeout Rows",
    "",
    ...result.operations_freeze_receipt_approval_closeout_rows.map((row) => `- ${row.invocation} (${row.required_signoff_role}): ${row.approval_closeout_status}`),
    "",
    "## Approval Closeout Gates",
    "",
    ...result.operations_freeze_receipt_approval_closeout_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_OUT_DIR };
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
    else if (arg === "--receipt-validation-packet-schema") parsed.operationsFreezeReceiptValidationPacketSchemaPath = argv[++index];
    else if (arg === "--receipt-approval-plan-schema") parsed.operationsFreezeReceiptApprovalPlanSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operations-freeze-receipt-approval-closeout.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_OUT_DIR}
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
  --receipt-validation-packet-schema <path>
                                            P495 receipt validation packet schema path.
  --receipt-approval-plan-schema <path>    P496 receipt approval plan schema path.
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.platformOpsLedgerPath),
    operations_freeze_source_inventory_schema_path: path.resolve(options.operationsFreezeSourceInventorySchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.operationsFreezeSourceInventorySchemaPath),
    operations_freeze_command_matrix_schema_path: path.resolve(options.operationsFreezeCommandMatrixSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.operationsFreezeCommandMatrixSchemaPath),
    operations_freeze_evidence_index_schema_path: path.resolve(options.operationsFreezeEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.operationsFreezeEvidenceIndexSchemaPath),
    operations_freeze_review_packet_schema_path: path.resolve(options.operationsFreezeReviewPacketSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.operationsFreezeReviewPacketSchemaPath),
    operations_freeze_signoff_ledger_schema_path: path.resolve(options.operationsFreezeSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.operationsFreezeSignoffLedgerSchemaPath),
    operations_freeze_signoff_receipt_template_schema_path: path.resolve(options.operationsFreezeSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.operationsFreezeSignoffReceiptTemplateSchemaPath),
    operations_freeze_signoff_receipt_intake_schema_path: path.resolve(options.operationsFreezeSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.operationsFreezeSignoffReceiptIntakeSchemaPath),
    operations_freeze_signoff_closeout_schema_path: path.resolve(options.operationsFreezeSignoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.operationsFreezeSignoffCloseoutSchemaPath),
    operations_freeze_status_ledger_schema_path: path.resolve(options.operationsFreezeStatusLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.operationsFreezeStatusLedgerSchemaPath),
    operations_freeze_receipt_queue_schema_path: path.resolve(options.operationsFreezeReceiptQueueSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.operationsFreezeReceiptQueueSchemaPath),
    operations_freeze_receipt_validation_rules_schema_path: path.resolve(options.operationsFreezeReceiptValidationRulesSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.operationsFreezeReceiptValidationRulesSchemaPath),
    operations_freeze_receipt_workspace_schema_path: path.resolve(options.operationsFreezeReceiptWorkspaceSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.operationsFreezeReceiptWorkspaceSchemaPath),
    operations_freeze_receipt_workspace_merge_schema_path: path.resolve(options.operationsFreezeReceiptWorkspaceMergeSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.operationsFreezeReceiptWorkspaceMergeSchemaPath),
    operations_freeze_receipt_validation_packet_schema_path: path.resolve(options.operationsFreezeReceiptValidationPacketSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.operationsFreezeReceiptValidationPacketSchemaPath),
    operations_freeze_receipt_approval_plan_schema_path: path.resolve(options.operationsFreezeReceiptApprovalPlanSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.operationsFreezeReceiptApprovalPlanSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.schemaPath),
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
    validation_item_id: `platform-operations-freeze-receipt-approval-closeout.${slugify(itemPath)}.${checkId}`,
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
