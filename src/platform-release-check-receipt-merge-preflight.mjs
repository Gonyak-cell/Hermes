import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS,
  buildPlatformReleaseCheckReceiptWorkspaceMerge,
} from "./platform-release-check-receipt-workspace-merge.mjs";

export const DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_OUT_DIR = "artifacts/platform-release-check-receipt-merge-preflight/latest";
export const DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS = {
  ...DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS,
  releaseCheckReceiptWorkspaceMergeSchemaPath: DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS.schemaPath,
  schemaPath: "schemas/platform-release-check-receipt-merge-preflight.schema.json",
};

const SCHEMA_VERSION = "platform-release-check-receipt-merge-preflight.v1";
const CAPABILITY_ID = "platform.release_check_receipt_merge_preflight";
const PHASE_SLOT = "P376";
const PREVIOUS_PHASE_SLOT = "P375";
const NEXT_PHASE_SLOT = "P377";
const FUTURE_VALIDATION_CHECKS = [
  "reviewer_id_present",
  "reviewed_at_iso_timestamp",
  "source_signoff_row_id_matches",
  "decision_allowed",
  "evidence_reference_present",
  "blocker_note_present",
];

export async function runPlatformReleaseCheckReceiptMergePreflight(options = {}) {
  const result = await buildPlatformReleaseCheckReceiptMergePreflight(options);
  if (options.write !== false) await writePlatformReleaseCheckReceiptMergePreflight(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform release-check receipt merge preflight failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReleaseCheckReceiptMergePreflight(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const workspaceMerge = await buildPlatformReleaseCheckReceiptWorkspaceMerge({
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
    schemaPath: inputs.release_check_receipt_workspace_merge_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const preflightAnchor = buildPreflightAnchor(workspaceMerge);
  const preflightRows = buildPreflightRows(workspaceMerge);
  const preflightBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const preflightGateRows = buildPreflightGateRows({ workspaceMerge, packageJson, platformOpsLedger, preflightRows, preflightBoundary });
  const validationItems = buildValidationItems({ workspaceMerge, packageJson, platformOpsLedger, preflightRows, preflightGateRows, preflightBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ workspaceMerge, preflightRows, preflightGateRows, preflightBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_release_check_receipt_merge_preflight_id: `platform-release-check-receipt-merge-preflight.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    release_check_receipt_merge_preflight_anchor: preflightAnchor,
    release_check_receipt_merge_preflight_rows: preflightRows,
    release_check_receipt_merge_preflight_gate_rows: preflightGateRows,
    release_check_receipt_merge_preflight_boundary: preflightBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_release_check_receipt_merge_preflight") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ workspaceMerge, preflightRows, preflightGateRows, preflightBoundary, validation: result.validation });
  result.summary.platform_release_check_receipt_merge_preflight_id = result.platform_release_check_receipt_merge_preflight_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReleaseCheckReceiptMergePreflight(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-release-check-receipt-merge-preflight.json"), serializableResult(result));
  await writeJson(path.join(outDir, "release-check-receipt-merge-preflight-rows.json"), collectionEnvelope("platform-release-check-receipt-merge-preflight-rows.v1", "release_check_receipt_merge_preflight_rows", result.release_check_receipt_merge_preflight_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-receipt-merge-preflight-gate-rows.json"), collectionEnvelope("platform-release-check-receipt-merge-preflight-gate-rows.v1", "release_check_receipt_merge_preflight_gate_rows", result.release_check_receipt_merge_preflight_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-receipt-merge-preflight-boundary.json"), result.release_check_receipt_merge_preflight_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-release-check-receipt-merge-preflight-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReleaseCheckReceiptMergePreflightCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReleaseCheckReceiptMergePreflight(args);
    console.log(`Platform release-check receipt merge preflight ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_release_check_receipt_merge_preflight_status}`);
    console.log(`Preflight rows: ${result.summary.ready_preflight_row_count}/${result.summary.preflight_row_count}`);
    console.log(`Preflight gates: ${result.summary.ready_preflight_gate_count}/${result.summary.preflight_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPreflightAnchor(workspaceMerge) {
  return {
    schema_version: "platform-release-check-receipt-merge-preflight-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_workspace_merge_id: workspaceMerge.platform_release_check_receipt_workspace_merge_id,
    source_receipt_workspace_merge_status: workspaceMerge.summary.platform_release_check_receipt_workspace_merge_status,
    source_receipt_workspace_merge_hash: hashValue({
      id: workspaceMerge.platform_release_check_receipt_workspace_merge_id,
      status: workspaceMerge.summary.platform_release_check_receipt_workspace_merge_status,
      merge_rows: workspaceMerge.summary.merge_row_count,
      merge_gate_rows: workspaceMerge.summary.merge_gate_count,
    }),
  };
}

function buildPreflightRows(workspaceMerge) {
  const sourceReady = workspaceMerge.validation.valid && workspaceMerge.summary.platform_release_check_receipt_workspace_merge_status === "ready_for_future_receipt_merge";
  return workspaceMerge.release_check_receipt_workspace_merge_rows.map((mergeRow, index) => {
    const preflightStatus = sourceReady && mergeRow.merge_status === "ready_for_future_receipt_merge" ? "ready_for_future_receipt_merge_validation" : "blocked";
    const row = {
      schema_version: "platform-release-check-receipt-merge-preflight-row.v1",
      release_check_receipt_merge_preflight_row_id: `platform-release-check-receipt-merge-preflight.row.${mergeRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_workspace_merge_row_id: mergeRow.release_check_receipt_workspace_merge_row_id,
      source_evidence_row_key: mergeRow.source_evidence_row_key,
      queue_position: mergeRow.queue_position,
      package_script_name: mergeRow.package_script_name,
      required_reviewer_role: mergeRow.required_reviewer_role,
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
      release_check_execution_performed_by_preflight: false,
      artifact_read_performed_by_preflight: false,
      artifact_write_performed_by_preflight: false,
      release_published_by_preflight: false,
      git_operation_performed_by_preflight: false,
      protected_action_executed_by_preflight: false,
      trading_order_submission_performed_by_preflight: false,
      desktop_source_of_truth_by_preflight: false,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "release_check_receipt_merge_preflight_row_hash");
  });
}

function buildPreflightGateRows({ workspaceMerge, packageJson, platformOpsLedger, preflightRows, preflightBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p375_receipt_workspace_merge_ready", "P375 release-check receipt workspace merge source is ready.", workspaceMerge.validation.valid && workspaceMerge.summary.platform_release_check_receipt_workspace_merge_status === "ready_for_future_receipt_merge"),
    gateRow("platform_package_script_registered", "package.json registers the P376 release-check receipt merge preflight command.", typeof scripts["platform:release-check-receipt-merge-preflight"] === "string" && scripts["platform:release-check-receipt-merge-preflight"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P376 release-check receipt merge preflight.", validateScript.includes("npm run platform:release-check-receipt-merge-preflight -- --check")),
    gateRow("p376_ledger_acceptance_declared", "P376 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P376: `platform:release-check-receipt-merge-preflight`")),
    gateRow("preflight_rows_ready", "All release-check receipt merge preflight rows are ready for future receipt merge validation.", preflightRows.length >= 4 && preflightRows.every((row) => row.preflight_status === "ready_for_future_receipt_merge_validation" && row.merge_validation_preflight_declared && row.actor_workspace_required && !row.actor_workspace_input_present && !row.merged_receipt_input_materialized && !row.ready_for_validation)),
    gateRow("no_receipt_payload_validation", "Preflight does not read actor files, materialize merged receipt input, receive payloads, or validate receipts.", !preflightBoundary.actor_workspace_input_present && !preflightBoundary.merged_receipt_input_materialized && !preflightBoundary.receipt_payload_present && !preflightBoundary.receipt_received && !preflightBoundary.receipt_validated && !preflightBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Preflight does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !preflightBoundary.command_execution_performed && !preflightBoundary.artifact_read_performed && !preflightBoundary.artifact_write_performed && !preflightBoundary.release_published && !preflightBoundary.git_operation_performed && !preflightBoundary.protected_action_executed),
    gateRow("trading_and_desktop_boundaries_enforced", "Trading writes remain disabled and Desktop remains outside source-of-truth boundaries.", !preflightBoundary.trading_live_enabled && !preflightBoundary.trading_full_auto_enabled && !preflightBoundary.trading_order_submission_allowed && !preflightBoundary.desktop_source_of_truth),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "release_check_receipt_merge_preflight_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-check-receipt-merge-preflight-gate-row.v1",
    release_check_receipt_merge_preflight_gate_row_id: `platform-release-check-receipt-merge-preflight.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    actor_workspace_input_present_by_preflight: false,
    merged_receipt_input_materialized_by_preflight: false,
    receipt_payload_present_by_preflight: false,
    ready_for_validation_by_preflight: false,
    receipt_received_by_preflight: false,
    receipt_validated_by_preflight: false,
    signoff_completed_by_preflight: false,
    approval_applied_by_preflight: false,
    receipt_workspace_merge_artifact_read_performed_by_preflight: false,
    command_execution_performed_by_preflight: false,
    release_check_execution_performed_by_preflight: false,
    artifact_read_performed_by_preflight: false,
    artifact_write_performed_by_preflight: false,
    release_published_by_preflight: false,
    git_operation_performed_by_preflight: false,
    protected_action_executed_by_preflight: false,
    trading_order_submission_performed_by_preflight: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-release-check-receipt-merge-preflight-boundary.v1",
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

function buildValidationItems({ workspaceMerge, packageJson, platformOpsLedger, preflightRows, preflightGateRows, preflightBoundary }) {
  return [
    validationItem("source.release_check_receipt_workspace_merge", "p375_receipt_workspace_merge_ready", workspaceMerge.validation.valid && workspaceMerge.summary.platform_release_check_receipt_workspace_merge_status === "ready_for_future_receipt_merge", "P375 release-check receipt workspace merge source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P376 receipt merge preflight checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("release_check_receipt_merge_preflight_rows", "preflight_rows_ready", preflightRows.length >= 4 && preflightRows.every((row) => row.preflight_status === "ready_for_future_receipt_merge_validation" && row.merge_validation_preflight_declared && row.future_validation_checks.length >= 6 && row.actor_workspace_required && !row.actor_workspace_input_present && !row.merged_receipt_input_materialized && !row.ready_for_validation), "Release-check receipt merge preflight rows must be ready for future validation without payloads."),
    validationItem("release_check_receipt_merge_preflight_gate_rows", "preflight_gates_ready", preflightGateRows.length >= 8 && preflightGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_preflight && !row.protected_action_executed_by_preflight), "P376 release-check receipt merge preflight gates are ready."),
    validationItem("boundary.no_receipt_payload", "no_receipt_payload", preflightBoundary.read_only && preflightBoundary.report_only && preflightBoundary.receipt_workspace_merge_consumed_in_memory && !preflightBoundary.receipt_workspace_merge_artifact_read_performed && preflightBoundary.merge_validation_preflight_declared && !preflightBoundary.actor_workspace_input_present && !preflightBoundary.receipt_input_file_materialized && !preflightBoundary.merged_receipt_input_materialized && !preflightBoundary.receipt_payload_present && !preflightBoundary.ready_for_validation && !preflightBoundary.receipt_received && !preflightBoundary.receipt_validated && !preflightBoundary.signoff_completed && !preflightBoundary.approval_applied, "Release-check receipt merge preflight declares validation preflight rows without materializing or validating receipts."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !preflightBoundary.command_execution_performed && !preflightBoundary.package_command_execution_performed && !preflightBoundary.release_check_execution_performed && !preflightBoundary.artifact_read_performed && !preflightBoundary.artifact_write_performed, "Release-check receipt merge preflight does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !preflightBoundary.dependency_install_performed && !preflightBoundary.package_mutation_performed && !preflightBoundary.lockfile_mutation_performed && !preflightBoundary.release_published && !preflightBoundary.git_operation_performed && !preflightBoundary.protected_action_executed, "Release-check receipt merge preflight performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled", !preflightBoundary.trading_live_enabled && !preflightBoundary.trading_full_auto_enabled && !preflightBoundary.trading_order_submission_allowed && !preflightBoundary.broker_write_allowed && !preflightBoundary.exchange_write_allowed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only", !preflightBoundary.desktop_source_of_truth && !preflightBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ workspaceMerge, preflightRows, preflightGateRows, preflightBoundary, validation }) {
  return {
    platform_release_check_receipt_merge_preflight_status: validation.valid ? "ready_for_future_receipt_merge_validation" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_workspace_merge_status: workspaceMerge.summary.platform_release_check_receipt_workspace_merge_status,
    preflight_row_count: preflightRows.length,
    ready_preflight_row_count: preflightRows.filter((row) => row.preflight_status === "ready_for_future_receipt_merge_validation").length,
    preflight_gate_count: preflightGateRows.length,
    ready_preflight_gate_count: preflightGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: preflightBoundary.read_only,
    report_only: preflightBoundary.report_only,
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
    release_check_execution_performed: preflightBoundary.release_check_execution_performed,
    artifact_read_performed: preflightBoundary.artifact_read_performed,
    artifact_write_performed: preflightBoundary.artifact_write_performed,
    dependency_install_performed: preflightBoundary.dependency_install_performed,
    package_mutation_performed: preflightBoundary.package_mutation_performed,
    lockfile_mutation_performed: preflightBoundary.lockfile_mutation_performed,
    release_published: preflightBoundary.release_published,
    git_operation_performed: preflightBoundary.git_operation_performed,
    protected_action_executed: preflightBoundary.protected_action_executed,
    trading_live_enabled: preflightBoundary.trading_live_enabled,
    trading_full_auto_enabled: preflightBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: preflightBoundary.trading_order_submission_allowed,
    broker_write_allowed: preflightBoundary.broker_write_allowed,
    exchange_write_allowed: preflightBoundary.exchange_write_allowed,
    desktop_source_of_truth: preflightBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: preflightBoundary.desktop_mutation_allowed,
    human_review_required: preflightBoundary.human_review_required,
    human_signoff_required: preflightBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Release-Check Receipt Merge Preflight",
    "",
    `Status: ${result.summary.platform_release_check_receipt_merge_preflight_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source receipt workspace merge: ${result.summary.source_receipt_workspace_merge_status}`,
    `Preflight rows: ${result.summary.ready_preflight_row_count}/${result.summary.preflight_row_count}`,
    `Preflight gates: ${result.summary.ready_preflight_gate_count}/${result.summary.preflight_gate_count}`,
    "",
    "## Preflight Rows",
    "",
    ...result.release_check_receipt_merge_preflight_rows.map((row) => `- ${row.package_script_name} (${row.required_reviewer_role}): ${row.preflight_status}`),
    "",
    "## Preflight Gates",
    "",
    ...result.release_check_receipt_merge_preflight_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-release-check-receipt-merge-preflight.mjs [options]

Options:
  --out-dir <folder>                     Output directory. Default: ${DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_OUT_DIR}
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
  --schema <path>                        Output schema path.
  --check                                Validate only, do not write artifacts.
  -h, --help                             Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS.platformOpsLedgerPath),
    trading_release_check_doc_path: path.resolve(options.tradingReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS.tradingReleaseCheckDocPath),
    platform_ops_check_doc_path: path.resolve(options.platformOpsCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS.platformOpsCheckDocPath),
    platform_release_check_doc_path: path.resolve(options.platformReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS.platformReleaseCheckDocPath),
    no_write_audit_doc_path: path.resolve(options.noWriteAuditDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS.noWriteAuditDocPath),
    release_check_evidence_index_schema_path: path.resolve(options.releaseCheckEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS.releaseCheckEvidenceIndexSchemaPath),
    release_check_review_packet_schema_path: path.resolve(options.releaseCheckReviewPacketSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS.releaseCheckReviewPacketSchemaPath),
    release_check_signoff_ledger_schema_path: path.resolve(options.releaseCheckSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS.releaseCheckSignoffLedgerSchemaPath),
    release_check_signoff_receipt_template_schema_path: path.resolve(options.releaseCheckSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS.releaseCheckSignoffReceiptTemplateSchemaPath),
    release_check_signoff_receipt_intake_schema_path: path.resolve(options.releaseCheckSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS.releaseCheckSignoffReceiptIntakeSchemaPath),
    release_check_signoff_closeout_schema_path: path.resolve(options.releaseCheckSignoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS.releaseCheckSignoffCloseoutSchemaPath),
    release_check_status_ledger_schema_path: path.resolve(options.releaseCheckStatusLedgerSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS.releaseCheckStatusLedgerSchemaPath),
    release_check_receipt_queue_schema_path: path.resolve(options.releaseCheckReceiptQueueSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS.releaseCheckReceiptQueueSchemaPath),
    release_check_receipt_validation_rules_schema_path: path.resolve(options.releaseCheckReceiptValidationRulesSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS.releaseCheckReceiptValidationRulesSchemaPath),
    release_check_receipt_workspace_schema_path: path.resolve(options.releaseCheckReceiptWorkspaceSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS.releaseCheckReceiptWorkspaceSchemaPath),
    release_check_receipt_workspace_merge_schema_path: path.resolve(options.releaseCheckReceiptWorkspaceMergeSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS.releaseCheckReceiptWorkspaceMergeSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS.schemaPath),
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
    validation_item_id: `platform-release-check-receipt-merge-preflight.${slugify(itemPath)}.${checkId}`,
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
