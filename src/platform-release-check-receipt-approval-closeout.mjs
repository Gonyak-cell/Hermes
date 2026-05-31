import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_PLAN_INPUTS,
  buildPlatformReleaseCheckReceiptApprovalPlan,
} from "./platform-release-check-receipt-approval-plan.mjs";

export const DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_OUT_DIR = "artifacts/platform-release-check-receipt-approval-closeout/latest";
export const DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS = {
  ...DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_PLAN_INPUTS,
  releaseCheckReceiptApprovalPlanSchemaPath: DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_PLAN_INPUTS.schemaPath,
  schemaPath: "schemas/platform-release-check-receipt-approval-closeout.schema.json",
};

const SCHEMA_VERSION = "platform-release-check-receipt-approval-closeout.v1";
const CAPABILITY_ID = "platform.release_check_receipt_approval_closeout";
const PHASE_SLOT = "P379";
const PREVIOUS_PHASE_SLOT = "P378";
const NEXT_PHASE_SLOT = "P380";
const APPROVAL_CLOSEOUT_CHECKS = [
  "approval_plan_ready",
  "future_receipt_decision_allows_signoff",
  "reviewer_role_matches_plan",
  "evidence_reference_confirmed",
  "blocker_note_resolved_or_recorded",
  "human_gate_application_future_only",
];

export async function runPlatformReleaseCheckReceiptApprovalCloseout(options = {}) {
  const result = await buildPlatformReleaseCheckReceiptApprovalCloseout(options);
  if (options.write !== false) await writePlatformReleaseCheckReceiptApprovalCloseout(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform release-check receipt approval closeout failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReleaseCheckReceiptApprovalCloseout(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const approvalPlan = await buildPlatformReleaseCheckReceiptApprovalPlan({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    tradingReleaseCheckDocPath: inputs.trading_release_check_doc_path,
    platformOpsCheckDocPath: inputs.platform_ops_check_doc_path,
    platformReleaseCheckDocPath: inputs.platform_release_check_doc_path,
    noWriteAuditDocPath: inputs.no_write_audit_doc_path,
    releaseCheckEvidenceIndexSchemaPath: inputs.release_check_evidence_index_schema_path,
    releaseCheckReviewPacketSchemaPath: inputs.release_check_review_packet_schema_path,
    releaseCheckSignoffLedgerSchemaPath: inputs.release_check_signoff_ledger_schema_path,
    releaseCheckSignoffReceiptTemplateSchemaPath: inputs.release_check_signoff_receipt_template_schema_path,
    releaseCheckSignoffReceiptIntakeSchemaPath: inputs.release_check_signoff_receipt_intake_schema_path,
    releaseCheckSignoffCloseoutSchemaPath: inputs.release_check_signoff_closeout_schema_path,
    releaseCheckStatusLedgerSchemaPath: inputs.release_check_status_ledger_schema_path,
    releaseCheckReceiptQueueSchemaPath: inputs.release_check_receipt_queue_schema_path,
    releaseCheckReceiptValidationRulesSchemaPath: inputs.release_check_receipt_validation_rules_schema_path,
    releaseCheckReceiptWorkspaceSchemaPath: inputs.release_check_receipt_workspace_schema_path,
    releaseCheckReceiptWorkspaceMergeSchemaPath: inputs.release_check_receipt_workspace_merge_schema_path,
    releaseCheckReceiptMergePreflightSchemaPath: inputs.release_check_receipt_merge_preflight_schema_path,
    releaseCheckReceiptValidationPacketSchemaPath: inputs.release_check_receipt_validation_packet_schema_path,
    schemaPath: inputs.release_check_receipt_approval_plan_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const closeoutAnchor = buildCloseoutAnchor(approvalPlan);
  const closeoutRows = buildCloseoutRows(approvalPlan);
  const closeoutBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const closeoutGateRows = buildCloseoutGateRows({ approvalPlan, packageJson, platformOpsLedger, closeoutRows, closeoutBoundary });
  const validationItems = buildValidationItems({ approvalPlan, packageJson, platformOpsLedger, closeoutRows, closeoutGateRows, closeoutBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ approvalPlan, closeoutRows, closeoutGateRows, closeoutBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_release_check_receipt_approval_closeout_id: `platform-release-check-receipt-approval-closeout.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    release_check_receipt_approval_closeout_anchor: closeoutAnchor,
    release_check_receipt_approval_closeout_rows: closeoutRows,
    release_check_receipt_approval_closeout_gate_rows: closeoutGateRows,
    release_check_receipt_approval_closeout_boundary: closeoutBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_release_check_receipt_approval_closeout") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ approvalPlan, closeoutRows, closeoutGateRows, closeoutBoundary, validation: result.validation });
  result.summary.platform_release_check_receipt_approval_closeout_id = result.platform_release_check_receipt_approval_closeout_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReleaseCheckReceiptApprovalCloseout(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-release-check-receipt-approval-closeout.json"), serializableResult(result));
  await writeJson(path.join(outDir, "release-check-receipt-approval-closeout-rows.json"), collectionEnvelope("platform-release-check-receipt-approval-closeout-rows.v1", "release_check_receipt_approval_closeout_rows", result.release_check_receipt_approval_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-receipt-approval-closeout-gate-rows.json"), collectionEnvelope("platform-release-check-receipt-approval-closeout-gate-rows.v1", "release_check_receipt_approval_closeout_gate_rows", result.release_check_receipt_approval_closeout_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-receipt-approval-closeout-boundary.json"), result.release_check_receipt_approval_closeout_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-release-check-receipt-approval-closeout-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReleaseCheckReceiptApprovalCloseoutCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReleaseCheckReceiptApprovalCloseout(args);
    console.log(`Platform release-check receipt approval closeout ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_release_check_receipt_approval_closeout_status}`);
    console.log(`Approval closeout rows: ${result.summary.ready_approval_closeout_row_count}/${result.summary.approval_closeout_row_count}`);
    console.log(`Approval closeout gates: ${result.summary.ready_approval_closeout_gate_count}/${result.summary.approval_closeout_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildCloseoutAnchor(approvalPlan) {
  return {
    schema_version: "platform-release-check-receipt-approval-closeout-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_approval_plan_id: approvalPlan.platform_release_check_receipt_approval_plan_id,
    source_receipt_approval_plan_status: approvalPlan.summary.platform_release_check_receipt_approval_plan_status,
    source_receipt_approval_plan_hash: hashValue({
      id: approvalPlan.platform_release_check_receipt_approval_plan_id,
      status: approvalPlan.summary.platform_release_check_receipt_approval_plan_status,
      approval_plan_rows: approvalPlan.summary.approval_plan_row_count,
      approval_plan_gate_rows: approvalPlan.summary.approval_plan_gate_count,
    }),
  };
}

function buildCloseoutRows(approvalPlan) {
  const sourceReady = approvalPlan.validation.valid && approvalPlan.summary.platform_release_check_receipt_approval_plan_status === "ready_for_future_receipt_approval_plan";
  return approvalPlan.release_check_receipt_approval_plan_rows.map((planRow, index) => {
    const closeoutStatus = sourceReady && planRow.approval_plan_status === "ready_for_future_receipt_approval_plan" ? "ready_for_future_receipt_approval_closeout" : "blocked";
    const row = {
      schema_version: "platform-release-check-receipt-approval-closeout-row.v1",
      release_check_receipt_approval_closeout_row_id: `platform-release-check-receipt-approval-closeout.row.${planRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_approval_plan_row_id: planRow.release_check_receipt_approval_plan_row_id,
      source_evidence_row_key: planRow.source_evidence_row_key,
      queue_position: planRow.queue_position,
      package_script_name: planRow.package_script_name,
      required_reviewer_role: planRow.required_reviewer_role,
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
      release_check_execution_performed_by_closeout: false,
      artifact_read_performed_by_closeout: false,
      artifact_write_performed_by_closeout: false,
      release_published_by_closeout: false,
      git_operation_performed_by_closeout: false,
      protected_action_executed_by_closeout: false,
      trading_order_submission_performed_by_closeout: false,
      desktop_source_of_truth_by_closeout: false,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "release_check_receipt_approval_closeout_row_hash");
  });
}

function buildCloseoutGateRows({ approvalPlan, packageJson, platformOpsLedger, closeoutRows, closeoutBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p378_receipt_approval_plan_ready", "P378 release-check receipt approval plan source is ready.", approvalPlan.validation.valid && approvalPlan.summary.platform_release_check_receipt_approval_plan_status === "ready_for_future_receipt_approval_plan"),
    gateRow("platform_package_script_registered", "package.json registers the P379 release-check receipt approval closeout command.", typeof scripts["platform:release-check-receipt-approval-closeout"] === "string" && scripts["platform:release-check-receipt-approval-closeout"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P379 release-check receipt approval closeout.", validateScript.includes("npm run platform:release-check-receipt-approval-closeout -- --check")),
    gateRow("p379_ledger_acceptance_declared", "P379 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P379: `platform:release-check-receipt-approval-closeout`")),
    gateRow("approval_closeout_rows_ready", "All release-check receipt approval closeout rows are ready for future receipt approval closeout.", closeoutRows.length >= 4 && closeoutRows.every((row) => row.approval_closeout_status === "ready_for_future_receipt_approval_closeout" && row.approval_closeout_declared && !row.actor_workspace_input_present && !row.merged_receipt_input_materialized && !row.ready_for_approval_application)),
    gateRow("no_receipt_payload_or_approval", "Approval closeout does not read actor files, materialize merged receipt input, receive payloads, validate receipts, or apply approvals.", !closeoutBoundary.actor_workspace_input_present && !closeoutBoundary.merged_receipt_input_materialized && !closeoutBoundary.receipt_payload_present && !closeoutBoundary.receipt_received && !closeoutBoundary.receipt_validated && !closeoutBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Approval closeout does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !closeoutBoundary.command_execution_performed && !closeoutBoundary.artifact_read_performed && !closeoutBoundary.artifact_write_performed && !closeoutBoundary.release_published && !closeoutBoundary.git_operation_performed && !closeoutBoundary.protected_action_executed),
    gateRow("trading_and_desktop_boundaries_enforced", "Trading writes remain disabled and Desktop remains outside source-of-truth boundaries.", !closeoutBoundary.trading_live_enabled && !closeoutBoundary.trading_full_auto_enabled && !closeoutBoundary.trading_order_submission_allowed && !closeoutBoundary.desktop_source_of_truth),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "release_check_receipt_approval_closeout_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-check-receipt-approval-closeout-gate-row.v1",
    release_check_receipt_approval_closeout_gate_row_id: `platform-release-check-receipt-approval-closeout.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    actor_workspace_input_present_by_closeout: false,
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
    release_check_execution_performed_by_closeout: false,
    artifact_read_performed_by_closeout: false,
    artifact_write_performed_by_closeout: false,
    release_published_by_closeout: false,
    git_operation_performed_by_closeout: false,
    protected_action_executed_by_closeout: false,
    trading_order_submission_performed_by_closeout: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-release-check-receipt-approval-closeout-boundary.v1",
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
    release_check_execution_performed: false,
    artifact_read_performed: false,
    artifact_write_performed: false,
    dependency_install_performed: false,
    package_mutation_performed: false,
    lockfile_mutation_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    desktop_source_of_truth: false,
    desktop_mutation_allowed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ approvalPlan, packageJson, platformOpsLedger, closeoutRows, closeoutGateRows, closeoutBoundary }) {
  return [
    validationItem("source.release_check_receipt_approval_plan", "p378_receipt_approval_plan_ready", approvalPlan.validation.valid && approvalPlan.summary.platform_release_check_receipt_approval_plan_status === "ready_for_future_receipt_approval_plan", "P378 release-check receipt approval plan source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P379 receipt approval closeout checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("release_check_receipt_approval_closeout_rows", "approval_closeout_rows_ready", closeoutRows.length >= 4 && closeoutRows.every((row) => row.approval_closeout_status === "ready_for_future_receipt_approval_closeout" && row.approval_closeout_declared && row.approval_closeout_checks.length >= 6 && !row.actor_workspace_input_present && !row.merged_receipt_input_materialized && !row.ready_for_approval_application), "Release-check receipt approval closeout rows must be ready for future approval closeouts without payloads."),
    validationItem("release_check_receipt_approval_closeout_gate_rows", "approval_closeout_gates_ready", closeoutGateRows.length >= 8 && closeoutGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_closeout && !row.approval_applied_by_closeout && !row.protected_action_executed_by_closeout), "P379 release-check receipt approval closeout gates are ready."),
    validationItem("boundary.no_receipt_payload", "no_receipt_payload", closeoutBoundary.read_only && closeoutBoundary.report_only && closeoutBoundary.receipt_approval_plan_consumed_in_memory && !closeoutBoundary.receipt_approval_plan_artifact_read_performed && closeoutBoundary.approval_closeout_declared && !closeoutBoundary.actor_workspace_input_present && !closeoutBoundary.receipt_input_file_materialized && !closeoutBoundary.merged_receipt_input_materialized && !closeoutBoundary.receipt_payload_present && !closeoutBoundary.ready_for_validation && !closeoutBoundary.ready_for_approval_application && !closeoutBoundary.receipt_received && !closeoutBoundary.receipt_validated && !closeoutBoundary.signoff_completed && !closeoutBoundary.approval_applied, "Release-check receipt approval closeout declares approval closeout rows without materializing, validating, or applying receipts."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !closeoutBoundary.command_execution_performed && !closeoutBoundary.package_command_execution_performed && !closeoutBoundary.release_check_execution_performed && !closeoutBoundary.artifact_read_performed && !closeoutBoundary.artifact_write_performed, "Release-check receipt approval closeout does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !closeoutBoundary.dependency_install_performed && !closeoutBoundary.package_mutation_performed && !closeoutBoundary.lockfile_mutation_performed && !closeoutBoundary.release_published && !closeoutBoundary.git_operation_performed && !closeoutBoundary.protected_action_executed, "Release-check receipt approval closeout performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled", !closeoutBoundary.trading_live_enabled && !closeoutBoundary.trading_full_auto_enabled && !closeoutBoundary.trading_order_submission_allowed && !closeoutBoundary.broker_write_allowed && !closeoutBoundary.exchange_write_allowed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only", !closeoutBoundary.desktop_source_of_truth && !closeoutBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ approvalPlan, closeoutRows, closeoutGateRows, closeoutBoundary, validation }) {
  return {
    platform_release_check_receipt_approval_closeout_status: validation.valid ? "ready_for_future_receipt_approval_closeout" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_approval_plan_status: approvalPlan.summary.platform_release_check_receipt_approval_plan_status,
    approval_closeout_row_count: closeoutRows.length,
    ready_approval_closeout_row_count: closeoutRows.filter((row) => row.approval_closeout_status === "ready_for_future_receipt_approval_closeout").length,
    approval_closeout_gate_count: closeoutGateRows.length,
    ready_approval_closeout_gate_count: closeoutGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: closeoutBoundary.read_only,
    report_only: closeoutBoundary.report_only,
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
    release_check_execution_performed: closeoutBoundary.release_check_execution_performed,
    artifact_read_performed: closeoutBoundary.artifact_read_performed,
    artifact_write_performed: closeoutBoundary.artifact_write_performed,
    dependency_install_performed: closeoutBoundary.dependency_install_performed,
    package_mutation_performed: closeoutBoundary.package_mutation_performed,
    lockfile_mutation_performed: closeoutBoundary.lockfile_mutation_performed,
    release_published: closeoutBoundary.release_published,
    git_operation_performed: closeoutBoundary.git_operation_performed,
    protected_action_executed: closeoutBoundary.protected_action_executed,
    trading_live_enabled: closeoutBoundary.trading_live_enabled,
    trading_full_auto_enabled: closeoutBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: closeoutBoundary.trading_order_submission_allowed,
    broker_write_allowed: closeoutBoundary.broker_write_allowed,
    exchange_write_allowed: closeoutBoundary.exchange_write_allowed,
    desktop_source_of_truth: closeoutBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: closeoutBoundary.desktop_mutation_allowed,
    human_review_required: closeoutBoundary.human_review_required,
    human_signoff_required: closeoutBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Release-Check Receipt Approval Closeout",
    "",
    `Status: ${result.summary.platform_release_check_receipt_approval_closeout_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source receipt approval plan: ${result.summary.source_receipt_approval_plan_status}`,
    `Approval closeout rows: ${result.summary.ready_approval_closeout_row_count}/${result.summary.approval_closeout_row_count}`,
    `Approval closeout gates: ${result.summary.ready_approval_closeout_gate_count}/${result.summary.approval_closeout_gate_count}`,
    "",
    "## Approval Closeout Rows",
    "",
    ...result.release_check_receipt_approval_closeout_rows.map((row) => `- ${row.package_script_name} (${row.required_reviewer_role}): ${row.approval_closeout_status}`),
    "",
    "## Approval Closeout Gates",
    "",
    ...result.release_check_receipt_approval_closeout_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--trading-release-check-doc") parsed.tradingReleaseCheckDocPath = argv[++index];
    else if (arg === "--platform-ops-check-doc") parsed.platformOpsCheckDocPath = argv[++index];
    else if (arg === "--platform-release-check-doc") parsed.platformReleaseCheckDocPath = argv[++index];
    else if (arg === "--no-write-audit-doc") parsed.noWriteAuditDocPath = argv[++index];
    else if (arg === "--release-check-evidence-index-schema") parsed.releaseCheckEvidenceIndexSchemaPath = argv[++index];
    else if (arg === "--release-check-review-packet-schema") parsed.releaseCheckReviewPacketSchemaPath = argv[++index];
    else if (arg === "--release-check-signoff-ledger-schema") parsed.releaseCheckSignoffLedgerSchemaPath = argv[++index];
    else if (arg === "--release-check-signoff-receipt-template-schema") parsed.releaseCheckSignoffReceiptTemplateSchemaPath = argv[++index];
    else if (arg === "--release-check-signoff-receipt-intake-schema") parsed.releaseCheckSignoffReceiptIntakeSchemaPath = argv[++index];
    else if (arg === "--release-check-signoff-closeout-schema") parsed.releaseCheckSignoffCloseoutSchemaPath = argv[++index];
    else if (arg === "--release-check-status-ledger-schema") parsed.releaseCheckStatusLedgerSchemaPath = argv[++index];
    else if (arg === "--release-check-receipt-queue-schema") parsed.releaseCheckReceiptQueueSchemaPath = argv[++index];
    else if (arg === "--release-check-receipt-validation-rules-schema") parsed.releaseCheckReceiptValidationRulesSchemaPath = argv[++index];
    else if (arg === "--release-check-receipt-workspace-schema") parsed.releaseCheckReceiptWorkspaceSchemaPath = argv[++index];
    else if (arg === "--release-check-receipt-workspace-merge-schema") parsed.releaseCheckReceiptWorkspaceMergeSchemaPath = argv[++index];
    else if (arg === "--release-check-receipt-merge-preflight-schema") parsed.releaseCheckReceiptMergePreflightSchemaPath = argv[++index];
    else if (arg === "--release-check-receipt-validation-packet-schema") parsed.releaseCheckReceiptValidationPacketSchemaPath = argv[++index];
    else if (arg === "--release-check-receipt-approval-plan-schema") parsed.releaseCheckReceiptApprovalPlanSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-release-check-receipt-approval-closeout.mjs [options]

Options:
  --out-dir <folder>                     Output directory. Default: ${DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_OUT_DIR}
  --run-at <iso>                         Deterministic generated_at timestamp.
  --package <path>                       package.json path.
  --platform-ops-ledger <path>           P341-P500 platform operations ledger path.
  --trading-release-check-doc <path>     Trading release-check doc path.
  --platform-ops-check-doc <path>        Platform ops-check doc path.
  --platform-release-check-doc <path>    Platform release-check doc path.
  --no-write-audit-doc <path>            Release-check no-write audit doc path.
  --release-check-evidence-index-schema <path>
                                         P365 evidence index schema path.
  --release-check-review-packet-schema <path>
                                         P366 review packet schema path.
  --release-check-signoff-ledger-schema <path>
                                         P367 signoff ledger schema path.
  --release-check-signoff-receipt-template-schema <path>
                                         P368 receipt template schema path.
  --release-check-signoff-receipt-intake-schema <path>
                                         P369 receipt intake schema path.
  --release-check-signoff-closeout-schema <path>
                                         P370 closeout schema path.
  --release-check-status-ledger-schema <path>
                                         P371 status ledger schema path.
  --release-check-receipt-queue-schema <path>
                                         P372 receipt queue schema path.
  --release-check-receipt-validation-rules-schema <path>
                                         P373 receipt validation rules schema path.
  --release-check-receipt-workspace-schema <path>
                                         P374 receipt workspace schema path.
  --release-check-receipt-workspace-merge-schema <path>
                                         P375 receipt workspace merge schema path.
  --release-check-receipt-merge-preflight-schema <path>
                                         P376 receipt merge preflight schema path.
  --release-check-receipt-validation-packet-schema <path>
                                         P377 receipt validation packet schema path.
  --release-check-receipt-approval-plan-schema <path>
                                         P378 receipt approval plan schema path.
  --schema <path>                        Output schema path.
  --check                                Validate only, do not write artifacts.
  -h, --help                             Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.platformOpsLedgerPath),
    trading_release_check_doc_path: path.resolve(options.tradingReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.tradingReleaseCheckDocPath),
    platform_ops_check_doc_path: path.resolve(options.platformOpsCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.platformOpsCheckDocPath),
    platform_release_check_doc_path: path.resolve(options.platformReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.platformReleaseCheckDocPath),
    no_write_audit_doc_path: path.resolve(options.noWriteAuditDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.noWriteAuditDocPath),
    release_check_evidence_index_schema_path: path.resolve(options.releaseCheckEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.releaseCheckEvidenceIndexSchemaPath),
    release_check_review_packet_schema_path: path.resolve(options.releaseCheckReviewPacketSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.releaseCheckReviewPacketSchemaPath),
    release_check_signoff_ledger_schema_path: path.resolve(options.releaseCheckSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.releaseCheckSignoffLedgerSchemaPath),
    release_check_signoff_receipt_template_schema_path: path.resolve(options.releaseCheckSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.releaseCheckSignoffReceiptTemplateSchemaPath),
    release_check_signoff_receipt_intake_schema_path: path.resolve(options.releaseCheckSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.releaseCheckSignoffReceiptIntakeSchemaPath),
    release_check_signoff_closeout_schema_path: path.resolve(options.releaseCheckSignoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.releaseCheckSignoffCloseoutSchemaPath),
    release_check_status_ledger_schema_path: path.resolve(options.releaseCheckStatusLedgerSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.releaseCheckStatusLedgerSchemaPath),
    release_check_receipt_queue_schema_path: path.resolve(options.releaseCheckReceiptQueueSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.releaseCheckReceiptQueueSchemaPath),
    release_check_receipt_validation_rules_schema_path: path.resolve(options.releaseCheckReceiptValidationRulesSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.releaseCheckReceiptValidationRulesSchemaPath),
    release_check_receipt_workspace_schema_path: path.resolve(options.releaseCheckReceiptWorkspaceSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.releaseCheckReceiptWorkspaceSchemaPath),
    release_check_receipt_workspace_merge_schema_path: path.resolve(options.releaseCheckReceiptWorkspaceMergeSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.releaseCheckReceiptWorkspaceMergeSchemaPath),
    release_check_receipt_merge_preflight_schema_path: path.resolve(options.releaseCheckReceiptMergePreflightSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.releaseCheckReceiptMergePreflightSchemaPath),
    release_check_receipt_validation_packet_schema_path: path.resolve(options.releaseCheckReceiptValidationPacketSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.releaseCheckReceiptValidationPacketSchemaPath),
    release_check_receipt_approval_plan_schema_path: path.resolve(options.releaseCheckReceiptApprovalPlanSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.releaseCheckReceiptApprovalPlanSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_APPROVAL_CLOSEOUT_INPUTS.schemaPath),
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
    validation_item_id: `platform-release-check-receipt-approval-closeout.${slugify(itemPath)}.${checkId}`,
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
