import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_INPUTS,
  buildPlatformReleaseCheckReceiptValidationRules,
} from "./platform-release-check-receipt-validation-rules.mjs";

export const DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_OUT_DIR = "artifacts/platform-release-check-receipt-workspace/latest";
export const DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS = {
  ...DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_INPUTS,
  releaseCheckReceiptValidationRulesSchemaPath: DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_RULES_INPUTS.schemaPath,
  schemaPath: "schemas/platform-release-check-receipt-workspace.schema.json",
};

const SCHEMA_VERSION = "platform-release-check-receipt-workspace.v1";
const CAPABILITY_ID = "platform.release_check_receipt_workspace";
const PHASE_SLOT = "P374";
const PREVIOUS_PHASE_SLOT = "P373";
const NEXT_PHASE_SLOT = "P375";

export async function runPlatformReleaseCheckReceiptWorkspace(options = {}) {
  const result = await buildPlatformReleaseCheckReceiptWorkspace(options);
  if (options.write !== false) await writePlatformReleaseCheckReceiptWorkspace(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform release-check receipt workspace failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReleaseCheckReceiptWorkspace(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const validationRules = await buildPlatformReleaseCheckReceiptValidationRules({
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
    schemaPath: inputs.release_check_receipt_validation_rules_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const workspaceAnchor = buildWorkspaceAnchor(validationRules);
  const workspaceRows = buildWorkspaceRows(validationRules);
  const workspaceBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const workspaceGateRows = buildWorkspaceGateRows({ validationRules, packageJson, platformOpsLedger, workspaceRows, workspaceBoundary });
  const validationItems = buildValidationItems({ validationRules, packageJson, platformOpsLedger, workspaceRows, workspaceGateRows, workspaceBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ validationRules, workspaceRows, workspaceGateRows, workspaceBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_release_check_receipt_workspace_id: `platform-release-check-receipt-workspace.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    release_check_receipt_workspace_anchor: workspaceAnchor,
    release_check_receipt_workspace_rows: workspaceRows,
    release_check_receipt_workspace_gate_rows: workspaceGateRows,
    release_check_receipt_workspace_boundary: workspaceBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_release_check_receipt_workspace") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ validationRules, workspaceRows, workspaceGateRows, workspaceBoundary, validation: result.validation });
  result.summary.platform_release_check_receipt_workspace_id = result.platform_release_check_receipt_workspace_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReleaseCheckReceiptWorkspace(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-release-check-receipt-workspace.json"), serializableResult(result));
  await writeJson(path.join(outDir, "release-check-receipt-workspace-rows.json"), collectionEnvelope("platform-release-check-receipt-workspace-rows.v1", "release_check_receipt_workspace_rows", result.release_check_receipt_workspace_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-receipt-workspace-gate-rows.json"), collectionEnvelope("platform-release-check-receipt-workspace-gate-rows.v1", "release_check_receipt_workspace_gate_rows", result.release_check_receipt_workspace_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-receipt-workspace-boundary.json"), result.release_check_receipt_workspace_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-release-check-receipt-workspace-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReleaseCheckReceiptWorkspaceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReleaseCheckReceiptWorkspace(args);
    console.log(`Platform release-check receipt workspace ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_release_check_receipt_workspace_status}`);
    console.log(`Workspace rows: ${result.summary.ready_workspace_row_count}/${result.summary.workspace_row_count}`);
    console.log(`Workspace gates: ${result.summary.ready_workspace_gate_count}/${result.summary.workspace_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildWorkspaceAnchor(validationRules) {
  return {
    schema_version: "platform-release-check-receipt-workspace-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_validation_rules_id: validationRules.platform_release_check_receipt_validation_rules_id,
    source_receipt_validation_rules_status: validationRules.summary.platform_release_check_receipt_validation_rules_status,
    source_receipt_validation_rules_hash: hashValue({
      id: validationRules.platform_release_check_receipt_validation_rules_id,
      status: validationRules.summary.platform_release_check_receipt_validation_rules_status,
      rule_rows: validationRules.summary.rule_row_count,
      gate_rows: validationRules.summary.rule_gate_count,
    }),
  };
}

function buildWorkspaceRows(validationRules) {
  const sourceReady = validationRules.validation.valid && validationRules.summary.platform_release_check_receipt_validation_rules_status === "ready_for_future_receipt_validation";
  return validationRules.release_check_receipt_validation_rule_rows.map((ruleRow, index) => {
    const workspaceStatus = sourceReady && ruleRow.receipt_validation_rule_status === "ready_for_future_receipt_validation" ? "ready_for_human_receipt_input" : "blocked";
    const row = {
      schema_version: "platform-release-check-receipt-workspace-row.v1",
      release_check_receipt_workspace_row_id: `platform-release-check-receipt-workspace.row.${ruleRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_validation_rule_row_id: ruleRow.release_check_receipt_validation_rule_row_id,
      source_evidence_row_key: ruleRow.source_evidence_row_key,
      queue_position: ruleRow.queue_position,
      package_script_name: ruleRow.package_script_name,
      required_reviewer_role: ruleRow.required_reviewer_role,
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
      release_check_execution_performed_by_workspace: false,
      artifact_read_performed_by_workspace: false,
      artifact_write_performed_by_workspace: false,
      release_published_by_workspace: false,
      git_operation_performed_by_workspace: false,
      protected_action_executed_by_workspace: false,
      trading_order_submission_performed_by_workspace: false,
      desktop_source_of_truth_by_workspace: false,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "release_check_receipt_workspace_row_hash");
  });
}

function buildWorkspaceGateRows({ validationRules, packageJson, platformOpsLedger, workspaceRows, workspaceBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p373_receipt_validation_rules_ready", "P373 release-check receipt validation rules source is ready.", validationRules.validation.valid && validationRules.summary.platform_release_check_receipt_validation_rules_status === "ready_for_future_receipt_validation"),
    gateRow("platform_package_script_registered", "package.json registers the P374 release-check receipt workspace command.", typeof scripts["platform:release-check-receipt-workspace"] === "string" && scripts["platform:release-check-receipt-workspace"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P374 release-check receipt workspace.", validateScript.includes("npm run platform:release-check-receipt-workspace -- --check")),
    gateRow("p374_ledger_acceptance_declared", "P374 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P374: `platform:release-check-receipt-workspace`")),
    gateRow("workspace_rows_ready", "All release-check receipt workspace rows are ready for human input.", workspaceRows.length >= 4 && workspaceRows.every((row) => row.workspace_status === "ready_for_human_receipt_input" && row.editable_receipt_fields_declared && !row.receipt_input_file_materialized && !row.receipt_payload_present && !row.ready_for_validation)),
    gateRow("no_receipt_payload_materialization", "Workspace declares editable fields without materializing receipt input files or receiving payloads.", workspaceBoundary.editable_receipt_fields_declared && !workspaceBoundary.receipt_input_file_materialized && !workspaceBoundary.receipt_payload_present && !workspaceBoundary.receipt_received && !workspaceBoundary.receipt_validated && !workspaceBoundary.signoff_completed && !workspaceBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Workspace does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !workspaceBoundary.command_execution_performed && !workspaceBoundary.artifact_read_performed && !workspaceBoundary.artifact_write_performed && !workspaceBoundary.release_published && !workspaceBoundary.git_operation_performed && !workspaceBoundary.protected_action_executed),
    gateRow("trading_and_desktop_boundaries_enforced", "Trading writes remain disabled and Desktop remains outside source-of-truth boundaries.", !workspaceBoundary.trading_live_enabled && !workspaceBoundary.trading_full_auto_enabled && !workspaceBoundary.trading_order_submission_allowed && !workspaceBoundary.desktop_source_of_truth),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "release_check_receipt_workspace_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-check-receipt-workspace-gate-row.v1",
    release_check_receipt_workspace_gate_row_id: `platform-release-check-receipt-workspace.gate.${rowKey}`,
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
    release_check_execution_performed_by_workspace: false,
    artifact_read_performed_by_workspace: false,
    artifact_write_performed_by_workspace: false,
    release_published_by_workspace: false,
    git_operation_performed_by_workspace: false,
    protected_action_executed_by_workspace: false,
    trading_order_submission_performed_by_workspace: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-release-check-receipt-workspace-boundary.v1",
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

function buildValidationItems({ validationRules, packageJson, platformOpsLedger, workspaceRows, workspaceGateRows, workspaceBoundary }) {
  return [
    validationItem("source.release_check_receipt_validation_rules", "p373_receipt_validation_rules_ready", validationRules.validation.valid && validationRules.summary.platform_release_check_receipt_validation_rules_status === "ready_for_future_receipt_validation", "P373 release-check receipt validation rules source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P374 receipt workspace checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("release_check_receipt_workspace_rows", "workspace_rows_ready", workspaceRows.length >= 4 && workspaceRows.every((row) => row.workspace_status === "ready_for_human_receipt_input" && row.editable_receipt_fields_declared && !row.receipt_input_file_materialized && !row.receipt_payload_present && !row.ready_for_validation), "Release-check receipt workspace rows must be ready for human input without payloads."),
    validationItem("release_check_receipt_workspace_gate_rows", "workspace_gates_ready", workspaceGateRows.length >= 8 && workspaceGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_workspace && !row.protected_action_executed_by_workspace), "P374 release-check receipt workspace gates are ready."),
    validationItem("boundary.no_receipt_payload", "no_receipt_payload", workspaceBoundary.read_only && workspaceBoundary.report_only && workspaceBoundary.validation_rules_consumed_in_memory && !workspaceBoundary.validation_rules_artifact_read_performed && workspaceBoundary.workspace_rows_declared && workspaceBoundary.editable_receipt_fields_declared && !workspaceBoundary.receipt_input_file_materialized && !workspaceBoundary.receipt_payload_present && !workspaceBoundary.ready_for_validation && !workspaceBoundary.receipt_received && !workspaceBoundary.receipt_validated && !workspaceBoundary.signoff_completed && !workspaceBoundary.approval_applied, "Release-check receipt workspace declares human input rows without materializing or validating receipts."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !workspaceBoundary.command_execution_performed && !workspaceBoundary.package_command_execution_performed && !workspaceBoundary.release_check_execution_performed && !workspaceBoundary.artifact_read_performed && !workspaceBoundary.artifact_write_performed, "Release-check receipt workspace does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !workspaceBoundary.dependency_install_performed && !workspaceBoundary.package_mutation_performed && !workspaceBoundary.lockfile_mutation_performed && !workspaceBoundary.release_published && !workspaceBoundary.git_operation_performed && !workspaceBoundary.protected_action_executed, "Release-check receipt workspace performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled", !workspaceBoundary.trading_live_enabled && !workspaceBoundary.trading_full_auto_enabled && !workspaceBoundary.trading_order_submission_allowed && !workspaceBoundary.broker_write_allowed && !workspaceBoundary.exchange_write_allowed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only", !workspaceBoundary.desktop_source_of_truth && !workspaceBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ validationRules, workspaceRows, workspaceGateRows, workspaceBoundary, validation }) {
  return {
    platform_release_check_receipt_workspace_status: validation.valid ? "ready_for_human_receipt_workspace" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_validation_rules_status: validationRules.summary.platform_release_check_receipt_validation_rules_status,
    workspace_row_count: workspaceRows.length,
    ready_workspace_row_count: workspaceRows.filter((row) => row.workspace_status === "ready_for_human_receipt_input").length,
    workspace_gate_count: workspaceGateRows.length,
    ready_workspace_gate_count: workspaceGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: workspaceBoundary.read_only,
    report_only: workspaceBoundary.report_only,
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
    release_check_execution_performed: workspaceBoundary.release_check_execution_performed,
    artifact_read_performed: workspaceBoundary.artifact_read_performed,
    artifact_write_performed: workspaceBoundary.artifact_write_performed,
    dependency_install_performed: workspaceBoundary.dependency_install_performed,
    package_mutation_performed: workspaceBoundary.package_mutation_performed,
    lockfile_mutation_performed: workspaceBoundary.lockfile_mutation_performed,
    release_published: workspaceBoundary.release_published,
    git_operation_performed: workspaceBoundary.git_operation_performed,
    protected_action_executed: workspaceBoundary.protected_action_executed,
    trading_live_enabled: workspaceBoundary.trading_live_enabled,
    trading_full_auto_enabled: workspaceBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: workspaceBoundary.trading_order_submission_allowed,
    broker_write_allowed: workspaceBoundary.broker_write_allowed,
    exchange_write_allowed: workspaceBoundary.exchange_write_allowed,
    desktop_source_of_truth: workspaceBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: workspaceBoundary.desktop_mutation_allowed,
    human_review_required: workspaceBoundary.human_review_required,
    human_signoff_required: workspaceBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Release-Check Receipt Workspace",
    "",
    `Status: ${result.summary.platform_release_check_receipt_workspace_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source validation rules: ${result.summary.source_receipt_validation_rules_status}`,
    `Workspace rows: ${result.summary.ready_workspace_row_count}/${result.summary.workspace_row_count}`,
    `Workspace gates: ${result.summary.ready_workspace_gate_count}/${result.summary.workspace_gate_count}`,
    "",
    "## Workspace Rows",
    "",
    ...result.release_check_receipt_workspace_rows.map((row) => `- ${row.package_script_name} (${row.required_reviewer_role}): ${row.workspace_status}`),
    "",
    "## Workspace Gates",
    "",
    ...result.release_check_receipt_workspace_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-release-check-receipt-workspace.mjs [options]

Options:
  --out-dir <folder>                     Output directory. Default: ${DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_OUT_DIR}
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
  --schema <path>                        Output schema path.
  --check                                Validate only, do not write artifacts.
  -h, --help                             Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS.platformOpsLedgerPath),
    trading_release_check_doc_path: path.resolve(options.tradingReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS.tradingReleaseCheckDocPath),
    platform_ops_check_doc_path: path.resolve(options.platformOpsCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS.platformOpsCheckDocPath),
    platform_release_check_doc_path: path.resolve(options.platformReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS.platformReleaseCheckDocPath),
    no_write_audit_doc_path: path.resolve(options.noWriteAuditDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS.noWriteAuditDocPath),
    release_check_evidence_index_schema_path: path.resolve(options.releaseCheckEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS.releaseCheckEvidenceIndexSchemaPath),
    release_check_review_packet_schema_path: path.resolve(options.releaseCheckReviewPacketSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS.releaseCheckReviewPacketSchemaPath),
    release_check_signoff_ledger_schema_path: path.resolve(options.releaseCheckSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS.releaseCheckSignoffLedgerSchemaPath),
    release_check_signoff_receipt_template_schema_path: path.resolve(options.releaseCheckSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS.releaseCheckSignoffReceiptTemplateSchemaPath),
    release_check_signoff_receipt_intake_schema_path: path.resolve(options.releaseCheckSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS.releaseCheckSignoffReceiptIntakeSchemaPath),
    release_check_signoff_closeout_schema_path: path.resolve(options.releaseCheckSignoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS.releaseCheckSignoffCloseoutSchemaPath),
    release_check_status_ledger_schema_path: path.resolve(options.releaseCheckStatusLedgerSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS.releaseCheckStatusLedgerSchemaPath),
    release_check_receipt_queue_schema_path: path.resolve(options.releaseCheckReceiptQueueSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS.releaseCheckReceiptQueueSchemaPath),
    release_check_receipt_validation_rules_schema_path: path.resolve(options.releaseCheckReceiptValidationRulesSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS.releaseCheckReceiptValidationRulesSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_WORKSPACE_INPUTS.schemaPath),
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
    validation_item_id: `platform-release-check-receipt-workspace.${slugify(itemPath)}.${checkId}`,
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
