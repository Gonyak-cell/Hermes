import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS,
  buildPlatformReleaseCheckReceiptWorkspace,
} from "./platform-release-check-receipt-workspace.mjs";

export const DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_OUT_DIR = "artifacts/platform-release-check-receipt-workspace-merge/latest";
export const DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS = {
  ...DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS,
  releaseCheckReceiptWorkspaceSchemaPath: DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS.schemaPath,
  schemaPath: "schemas/platform-release-check-receipt-workspace-merge.schema.json",
};

const SCHEMA_VERSION = "platform-release-check-receipt-workspace-merge.v1";
const CAPABILITY_ID = "platform.release_check_receipt_workspace_merge";
const PHASE_SLOT = "P375";
const PREVIOUS_PHASE_SLOT = "P374";
const NEXT_PHASE_SLOT = "P376";

export async function runPlatformReleaseCheckReceiptWorkspaceMerge(options = {}) {
  const result = await buildPlatformReleaseCheckReceiptWorkspaceMerge(options);
  if (options.write !== false) await writePlatformReleaseCheckReceiptWorkspaceMerge(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform release-check receipt workspace merge failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReleaseCheckReceiptWorkspaceMerge(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const workspace = await buildPlatformReleaseCheckReceiptWorkspace({
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
    schemaPath: inputs.release_check_receipt_workspace_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const mergeAnchor = buildMergeAnchor(workspace);
  const mergeRows = buildMergeRows(workspace);
  const mergeBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const mergeGateRows = buildMergeGateRows({ workspace, packageJson, platformOpsLedger, mergeRows, mergeBoundary });
  const validationItems = buildValidationItems({ workspace, packageJson, platformOpsLedger, mergeRows, mergeGateRows, mergeBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ workspace, mergeRows, mergeGateRows, mergeBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_release_check_receipt_workspace_merge_id: `platform-release-check-receipt-workspace-merge.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    release_check_receipt_workspace_merge_anchor: mergeAnchor,
    release_check_receipt_workspace_merge_rows: mergeRows,
    release_check_receipt_workspace_merge_gate_rows: mergeGateRows,
    release_check_receipt_workspace_merge_boundary: mergeBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_release_check_receipt_workspace_merge") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ workspace, mergeRows, mergeGateRows, mergeBoundary, validation: result.validation });
  result.summary.platform_release_check_receipt_workspace_merge_id = result.platform_release_check_receipt_workspace_merge_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReleaseCheckReceiptWorkspaceMerge(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-release-check-receipt-workspace-merge.json"), serializableResult(result));
  await writeJson(path.join(outDir, "release-check-receipt-workspace-merge-rows.json"), collectionEnvelope("platform-release-check-receipt-workspace-merge-rows.v1", "release_check_receipt_workspace_merge_rows", result.release_check_receipt_workspace_merge_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-receipt-workspace-merge-gate-rows.json"), collectionEnvelope("platform-release-check-receipt-workspace-merge-gate-rows.v1", "release_check_receipt_workspace_merge_gate_rows", result.release_check_receipt_workspace_merge_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-receipt-workspace-merge-boundary.json"), result.release_check_receipt_workspace_merge_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-release-check-receipt-workspace-merge-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReleaseCheckReceiptWorkspaceMergeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReleaseCheckReceiptWorkspaceMerge(args);
    console.log(`Platform release-check receipt workspace merge ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_release_check_receipt_workspace_merge_status}`);
    console.log(`Merge rows: ${result.summary.ready_merge_row_count}/${result.summary.merge_row_count}`);
    console.log(`Merge gates: ${result.summary.ready_merge_gate_count}/${result.summary.merge_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildMergeAnchor(workspace) {
  return {
    schema_version: "platform-release-check-receipt-workspace-merge-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_workspace_id: workspace.platform_release_check_receipt_workspace_id,
    source_receipt_workspace_status: workspace.summary.platform_release_check_receipt_workspace_status,
    source_receipt_workspace_hash: hashValue({
      id: workspace.platform_release_check_receipt_workspace_id,
      status: workspace.summary.platform_release_check_receipt_workspace_status,
      workspace_rows: workspace.summary.workspace_row_count,
      gate_rows: workspace.summary.workspace_gate_count,
    }),
  };
}

function buildMergeRows(workspace) {
  const sourceReady = workspace.validation.valid && workspace.summary.platform_release_check_receipt_workspace_status === "ready_for_human_receipt_workspace";
  return workspace.release_check_receipt_workspace_rows.map((workspaceRow, index) => {
    const mergeStatus = sourceReady && workspaceRow.workspace_status === "ready_for_human_receipt_input" ? "ready_for_future_receipt_merge" : "blocked";
    const row = {
      schema_version: "platform-release-check-receipt-workspace-merge-row.v1",
      release_check_receipt_workspace_merge_row_id: `platform-release-check-receipt-workspace-merge.row.${workspaceRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_workspace_row_id: workspaceRow.release_check_receipt_workspace_row_id,
      source_evidence_row_key: workspaceRow.source_evidence_row_key,
      queue_position: workspaceRow.queue_position,
      package_script_name: workspaceRow.package_script_name,
      required_reviewer_role: workspaceRow.required_reviewer_role,
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
      release_check_execution_performed_by_merge: false,
      artifact_read_performed_by_merge: false,
      artifact_write_performed_by_merge: false,
      release_published_by_merge: false,
      git_operation_performed_by_merge: false,
      protected_action_executed_by_merge: false,
      trading_order_submission_performed_by_merge: false,
      desktop_source_of_truth_by_merge: false,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "release_check_receipt_workspace_merge_row_hash");
  });
}

function buildMergeGateRows({ workspace, packageJson, platformOpsLedger, mergeRows, mergeBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p374_receipt_workspace_ready", "P374 release-check receipt workspace source is ready.", workspace.validation.valid && workspace.summary.platform_release_check_receipt_workspace_status === "ready_for_human_receipt_workspace"),
    gateRow("platform_package_script_registered", "package.json registers the P375 release-check receipt workspace merge command.", typeof scripts["platform:release-check-receipt-workspace-merge"] === "string" && scripts["platform:release-check-receipt-workspace-merge"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P375 release-check receipt workspace merge.", validateScript.includes("npm run platform:release-check-receipt-workspace-merge -- --check")),
    gateRow("p375_ledger_acceptance_declared", "P375 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P375: `platform:release-check-receipt-workspace-merge`")),
    gateRow("merge_rows_ready", "All release-check receipt workspace merge rows are ready for future merge.", mergeRows.length >= 4 && mergeRows.every((row) => row.merge_status === "ready_for_future_receipt_merge" && row.actor_workspace_required && !row.actor_workspace_input_present && !row.merged_receipt_input_materialized && !row.ready_for_validation)),
    gateRow("no_receipt_payload_merge", "Merge manifest does not read actor files, materialize merged receipt input, or receive payloads.", !mergeBoundary.actor_workspace_input_present && !mergeBoundary.merged_receipt_input_materialized && !mergeBoundary.receipt_payload_present && !mergeBoundary.receipt_received && !mergeBoundary.receipt_validated && !mergeBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Merge manifest does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !mergeBoundary.command_execution_performed && !mergeBoundary.artifact_read_performed && !mergeBoundary.artifact_write_performed && !mergeBoundary.release_published && !mergeBoundary.git_operation_performed && !mergeBoundary.protected_action_executed),
    gateRow("trading_and_desktop_boundaries_enforced", "Trading writes remain disabled and Desktop remains outside source-of-truth boundaries.", !mergeBoundary.trading_live_enabled && !mergeBoundary.trading_full_auto_enabled && !mergeBoundary.trading_order_submission_allowed && !mergeBoundary.desktop_source_of_truth),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "release_check_receipt_workspace_merge_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-check-receipt-workspace-merge-gate-row.v1",
    release_check_receipt_workspace_merge_gate_row_id: `platform-release-check-receipt-workspace-merge.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    actor_workspace_input_present_by_merge: false,
    merged_receipt_input_materialized_by_merge: false,
    receipt_payload_present_by_merge: false,
    ready_for_validation_by_merge: false,
    receipt_received_by_merge: false,
    receipt_validated_by_merge: false,
    signoff_completed_by_merge: false,
    approval_applied_by_merge: false,
    receipt_workspace_artifact_read_performed_by_merge: false,
    command_execution_performed_by_merge: false,
    release_check_execution_performed_by_merge: false,
    artifact_read_performed_by_merge: false,
    artifact_write_performed_by_merge: false,
    release_published_by_merge: false,
    git_operation_performed_by_merge: false,
    protected_action_executed_by_merge: false,
    trading_order_submission_performed_by_merge: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-release-check-receipt-workspace-merge-boundary.v1",
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

function buildValidationItems({ workspace, packageJson, platformOpsLedger, mergeRows, mergeGateRows, mergeBoundary }) {
  return [
    validationItem("source.release_check_receipt_workspace", "p374_receipt_workspace_ready", workspace.validation.valid && workspace.summary.platform_release_check_receipt_workspace_status === "ready_for_human_receipt_workspace", "P374 release-check receipt workspace source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P375 receipt workspace merge checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("release_check_receipt_workspace_merge_rows", "merge_rows_ready", mergeRows.length >= 4 && mergeRows.every((row) => row.merge_status === "ready_for_future_receipt_merge" && row.actor_workspace_required && !row.actor_workspace_input_present && !row.merged_receipt_input_materialized && !row.ready_for_validation), "Release-check receipt workspace merge rows must be ready for future merge without payloads."),
    validationItem("release_check_receipt_workspace_merge_gate_rows", "merge_gates_ready", mergeGateRows.length >= 8 && mergeGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_merge && !row.protected_action_executed_by_merge), "P375 release-check receipt workspace merge gates are ready."),
    validationItem("boundary.no_receipt_payload", "no_receipt_payload", mergeBoundary.read_only && mergeBoundary.report_only && mergeBoundary.receipt_workspace_consumed_in_memory && !mergeBoundary.receipt_workspace_artifact_read_performed && mergeBoundary.merge_manifest_declared && !mergeBoundary.actor_workspace_input_present && !mergeBoundary.receipt_input_file_materialized && !mergeBoundary.merged_receipt_input_materialized && !mergeBoundary.receipt_payload_present && !mergeBoundary.ready_for_validation && !mergeBoundary.receipt_received && !mergeBoundary.receipt_validated && !mergeBoundary.signoff_completed && !mergeBoundary.approval_applied, "Release-check receipt workspace merge declares merge rows without materializing or validating receipts."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !mergeBoundary.command_execution_performed && !mergeBoundary.package_command_execution_performed && !mergeBoundary.release_check_execution_performed && !mergeBoundary.artifact_read_performed && !mergeBoundary.artifact_write_performed, "Release-check receipt workspace merge does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !mergeBoundary.dependency_install_performed && !mergeBoundary.package_mutation_performed && !mergeBoundary.lockfile_mutation_performed && !mergeBoundary.release_published && !mergeBoundary.git_operation_performed && !mergeBoundary.protected_action_executed, "Release-check receipt workspace merge performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled", !mergeBoundary.trading_live_enabled && !mergeBoundary.trading_full_auto_enabled && !mergeBoundary.trading_order_submission_allowed && !mergeBoundary.broker_write_allowed && !mergeBoundary.exchange_write_allowed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only", !mergeBoundary.desktop_source_of_truth && !mergeBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ workspace, mergeRows, mergeGateRows, mergeBoundary, validation }) {
  return {
    platform_release_check_receipt_workspace_merge_status: validation.valid ? "ready_for_future_receipt_merge" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_workspace_status: workspace.summary.platform_release_check_receipt_workspace_status,
    merge_row_count: mergeRows.length,
    ready_merge_row_count: mergeRows.filter((row) => row.merge_status === "ready_for_future_receipt_merge").length,
    merge_gate_count: mergeGateRows.length,
    ready_merge_gate_count: mergeGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: mergeBoundary.read_only,
    report_only: mergeBoundary.report_only,
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
    release_check_execution_performed: mergeBoundary.release_check_execution_performed,
    artifact_read_performed: mergeBoundary.artifact_read_performed,
    artifact_write_performed: mergeBoundary.artifact_write_performed,
    dependency_install_performed: mergeBoundary.dependency_install_performed,
    package_mutation_performed: mergeBoundary.package_mutation_performed,
    lockfile_mutation_performed: mergeBoundary.lockfile_mutation_performed,
    release_published: mergeBoundary.release_published,
    git_operation_performed: mergeBoundary.git_operation_performed,
    protected_action_executed: mergeBoundary.protected_action_executed,
    trading_live_enabled: mergeBoundary.trading_live_enabled,
    trading_full_auto_enabled: mergeBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: mergeBoundary.trading_order_submission_allowed,
    broker_write_allowed: mergeBoundary.broker_write_allowed,
    exchange_write_allowed: mergeBoundary.exchange_write_allowed,
    desktop_source_of_truth: mergeBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: mergeBoundary.desktop_mutation_allowed,
    human_review_required: mergeBoundary.human_review_required,
    human_signoff_required: mergeBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Release-Check Receipt Workspace Merge",
    "",
    `Status: ${result.summary.platform_release_check_receipt_workspace_merge_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source receipt workspace: ${result.summary.source_receipt_workspace_status}`,
    `Merge rows: ${result.summary.ready_merge_row_count}/${result.summary.merge_row_count}`,
    `Merge gates: ${result.summary.ready_merge_gate_count}/${result.summary.merge_gate_count}`,
    "",
    "## Merge Rows",
    "",
    ...result.release_check_receipt_workspace_merge_rows.map((row) => `- ${row.package_script_name} (${row.required_reviewer_role}): ${row.merge_status}`),
    "",
    "## Merge Gates",
    "",
    ...result.release_check_receipt_workspace_merge_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-release-check-receipt-workspace-merge.mjs [options]

Options:
  --out-dir <folder>                     Output directory. Default: ${DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_OUT_DIR}
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
  --schema <path>                        Output schema path.
  --check                                Validate only, do not write artifacts.
  -h, --help                             Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS.platformOpsLedgerPath),
    trading_release_check_doc_path: path.resolve(options.tradingReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS.tradingReleaseCheckDocPath),
    platform_ops_check_doc_path: path.resolve(options.platformOpsCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS.platformOpsCheckDocPath),
    platform_release_check_doc_path: path.resolve(options.platformReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS.platformReleaseCheckDocPath),
    no_write_audit_doc_path: path.resolve(options.noWriteAuditDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS.noWriteAuditDocPath),
    release_check_evidence_index_schema_path: path.resolve(options.releaseCheckEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS.releaseCheckEvidenceIndexSchemaPath),
    release_check_review_packet_schema_path: path.resolve(options.releaseCheckReviewPacketSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS.releaseCheckReviewPacketSchemaPath),
    release_check_signoff_ledger_schema_path: path.resolve(options.releaseCheckSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS.releaseCheckSignoffLedgerSchemaPath),
    release_check_signoff_receipt_template_schema_path: path.resolve(options.releaseCheckSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS.releaseCheckSignoffReceiptTemplateSchemaPath),
    release_check_signoff_receipt_intake_schema_path: path.resolve(options.releaseCheckSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS.releaseCheckSignoffReceiptIntakeSchemaPath),
    release_check_signoff_closeout_schema_path: path.resolve(options.releaseCheckSignoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS.releaseCheckSignoffCloseoutSchemaPath),
    release_check_status_ledger_schema_path: path.resolve(options.releaseCheckStatusLedgerSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS.releaseCheckStatusLedgerSchemaPath),
    release_check_receipt_queue_schema_path: path.resolve(options.releaseCheckReceiptQueueSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS.releaseCheckReceiptQueueSchemaPath),
    release_check_receipt_validation_rules_schema_path: path.resolve(options.releaseCheckReceiptValidationRulesSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS.releaseCheckReceiptValidationRulesSchemaPath),
    release_check_receipt_workspace_schema_path: path.resolve(options.releaseCheckReceiptWorkspaceSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS.releaseCheckReceiptWorkspaceSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_MERGE_INPUTS.schemaPath),
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
    validation_item_id: `platform-release-check-receipt-workspace-merge.${slugify(itemPath)}.${checkId}`,
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
