import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_LEDGER_INPUTS,
  buildPlatformOperationsFreezeSignoffLedger,
} from "./platform-operations-freeze-signoff-ledger.mjs";

export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_TEMPLATE_OUT_DIR = "artifacts/platform-operations-freeze-signoff-receipt-template/latest";
export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_TEMPLATE_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_LEDGER_INPUTS,
  operationsFreezeSignoffLedgerSchemaPath: DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_LEDGER_INPUTS.schemaPath,
  schemaPath: "schemas/platform-operations-freeze-signoff-receipt-template.schema.json",
};

const COMMAND_NAME = "platform:operations-freeze-signoff-receipt-template";
const SCHEMA_VERSION = "platform-operations-freeze-signoff-receipt-template.v1";
const CAPABILITY_ID = "platform.operations_freeze_signoff_receipt_template";
const PHASE_SLOT = "P486";
const PREVIOUS_PHASE_SLOT = "P485";
const NEXT_PHASE_SLOT = "P487";
const SIGNOFF_LEDGER_STATUS = "ready_for_operations_freeze_signoff_ledger";
const RECEIPT_TEMPLATE_STATUS = "ready_for_operations_freeze_signoff_receipt_template";

export async function runPlatformOperationsFreezeSignoffReceiptTemplate(options = {}) {
  const result = await buildPlatformOperationsFreezeSignoffReceiptTemplate(options);
  if (options.write !== false) await writePlatformOperationsFreezeSignoffReceiptTemplate(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operations freeze signoff receipt template failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperationsFreezeSignoffReceiptTemplate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_TEMPLATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const signoffLedger = await buildPlatformOperationsFreezeSignoffLedger({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    operationsFreezeSourceInventorySchemaPath: inputs.operations_freeze_source_inventory_schema_path,
    operationsFreezeCommandMatrixSchemaPath: inputs.operations_freeze_command_matrix_schema_path,
    operationsFreezeEvidenceIndexSchemaPath: inputs.operations_freeze_evidence_index_schema_path,
    operationsFreezeReviewPacketSchemaPath: inputs.operations_freeze_review_packet_schema_path,
    schemaPath: inputs.operations_freeze_signoff_ledger_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const receiptTemplates = buildReceiptTemplates({ signoffLedger });
  const boundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const anchor = buildAnchor({ signoffLedger, packageJson, platformOpsLedger, receiptTemplates });
  const gateRows = buildGateRows({
    signoffLedger,
    scripts,
    validateScript,
    ledgerText: platformOpsLedger.text ?? "",
    receiptTemplates,
    boundary,
  });
  const validationItems = buildValidationItems({ signoffLedger, packageJson, platformOpsLedger, receiptTemplates, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ signoffLedger, receiptTemplates, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operations_freeze_signoff_receipt_template_id: `platform-operations-freeze-signoff-receipt-template.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operations_freeze_signoff_receipt_template_anchor: anchor,
    operations_freeze_signoff_receipt_templates: receiptTemplates,
    operations_freeze_signoff_receipt_template_gate_rows: gateRows,
    operations_freeze_signoff_receipt_template_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operations_freeze_signoff_receipt_template") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ signoffLedger, receiptTemplates, gateRows, boundary, validation: result.validation });
  result.summary.platform_operations_freeze_signoff_receipt_template_id = result.platform_operations_freeze_signoff_receipt_template_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperationsFreezeSignoffReceiptTemplate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-operations-freeze-signoff-receipt-template.json"), serializableResult(result));
  await writeJson(path.join(outDir, "freeze-signoff-receipt-templates.json"), collectionEnvelope("platform-operations-freeze-signoff-receipt-templates.v1", "operations_freeze_signoff_receipt_templates", result.operations_freeze_signoff_receipt_templates, result.generated_at));
  await writeJson(path.join(outDir, "freeze-signoff-receipt-template-gate-rows.json"), collectionEnvelope("platform-operations-freeze-signoff-receipt-template-gates.v1", "operations_freeze_signoff_receipt_template_gate_rows", result.operations_freeze_signoff_receipt_template_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-signoff-receipt-template-boundary.json"), result.operations_freeze_signoff_receipt_template_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operations-freeze-signoff-receipt-template-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperationsFreezeSignoffReceiptTemplateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperationsFreezeSignoffReceiptTemplate(args);
    console.log(`Platform operations freeze signoff receipt template ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operations_freeze_signoff_receipt_template_status}`);
    console.log(`Receipt templates: ${result.summary.ready_receipt_template_count}/${result.summary.receipt_template_count}`);
    console.log(`Template gates: ${result.summary.ready_template_gate_count}/${result.summary.template_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildAnchor({ signoffLedger, packageJson, platformOpsLedger, receiptTemplates }) {
  return {
    schema_version: "platform-operations-freeze-signoff-receipt-template-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_signoff_ledger_id: signoffLedger.platform_operations_freeze_signoff_ledger_id,
    source_signoff_ledger_status: signoffLedger.summary.platform_operations_freeze_signoff_ledger_status,
    source_signoff_ledger_hash: hashValue({
      id: signoffLedger.platform_operations_freeze_signoff_ledger_id,
      status: signoffLedger.summary.platform_operations_freeze_signoff_ledger_status,
      signoff_rows: signoffLedger.summary.signoff_row_count,
      ready_signoff_rows: signoffLedger.summary.ready_signoff_row_count,
    }),
    package_json_hash: packageJson.content_hash,
    platform_ops_ledger_hash: platformOpsLedger.content_hash,
    receipt_template_hash: hashValue(receiptTemplates.map((row) => ({
      row_key: row.source_evidence_row_key,
      receipt_template_status: row.receipt_template_status,
      required_signoff_role: row.required_signoff_role,
      allowed_decisions: row.allowed_decisions,
    }))),
  };
}

function buildReceiptTemplates({ signoffLedger }) {
  const sourceReady = signoffLedger.validation.valid && signoffLedger.summary.platform_operations_freeze_signoff_ledger_status === SIGNOFF_LEDGER_STATUS;
  return signoffLedger.operations_freeze_signoff_rows.map((signoffRow, index) => {
    const templateStatus = sourceReady && signoffRow.signoff_status === "ready_for_human_signoff" ? "ready_for_human_receipt" : "blocked";
    const template = {
      schema_version: "platform-operations-freeze-signoff-receipt-template-row.v1",
      operations_freeze_signoff_receipt_template_row_id: `platform-operations-freeze-signoff-receipt-template.row.${signoffRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_signoff_row_id: signoffRow.operations_freeze_signoff_row_id,
      source_review_packet_row_id: signoffRow.source_review_packet_row_id,
      source_evidence_row_key: signoffRow.source_evidence_row_key,
      package_script_name: signoffRow.package_script_name,
      invocation: signoffRow.invocation,
      evidence_kind: signoffRow.evidence_kind,
      expected_report_path: signoffRow.expected_report_path,
      human_review_evidence_slot: signoffRow.human_review_evidence_slot,
      required_reviewer_role: signoffRow.required_reviewer_role,
      required_signoff_role: signoffRow.required_signoff_role,
      required_receipt_type: signoffRow.required_receipt_type,
      signoff_policy: signoffRow.signoff_policy,
      expected_review_decision: signoffRow.expected_review_decision,
      expected_signoff_decision: signoffRow.expected_signoff_decision,
      receipt_template_status: templateStatus,
      source_signoff_status: signoffRow.signoff_status,
      source_review_packet_status: signoffRow.source_review_packet_status,
      source_evidence_status: signoffRow.source_evidence_status,
      required_receipt_fields: [
        "reviewer_id",
        "reviewed_at",
        "source_signoff_row_id",
        "decision",
        "evidence_reference",
        "command_result_reference",
        "blocker_note",
      ],
      allowed_decisions: ["approve_ready_evidence", "return_with_blocker"],
      signoff_ledger_consumed_in_memory: true,
      signoff_ledger_artifact_read_performed_by_template: false,
      receipt_completed_by_template: false,
      receipt_received_by_template: false,
      signoff_completed_by_template: false,
      approval_applied_by_template: false,
      receipt_materialized_by_template: false,
      command_execution_performed_by_template: false,
      package_command_execution_performed_by_template: false,
      acceptance_command_execution_performed_by_template: false,
      generated_artifact_read_performed_by_template: false,
      artifact_read_performed_by_template: false,
      artifact_write_performed_by_template: false,
      release_published_by_template: false,
      git_operation_performed_by_template: false,
      protected_action_executed_by_template: false,
      protected_recovery_execution_allowed_by_template: false,
      trading_live_enabled_by_template: false,
      trading_full_auto_enabled_by_template: false,
      trading_order_submission_allowed_by_template: false,
      broker_write_allowed_by_template: false,
      exchange_write_allowed_by_template: false,
      desktop_source_of_truth_by_template: false,
      desktop_mutation_allowed_by_template: false,
      secret_exposure_allowed_by_template: false,
      secret_values_read_by_template: false,
      env_file_read_by_template: false,
      desktop_config_content_inspected_by_template: false,
      desktop_provider_key_visible_by_template: false,
      credential_lookup_allowed_by_template: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Fill this receipt template externally before ${signoffRow.invocation} can be treated as operations-freeze signed off.`,
    };
    return withOrdinalAndHash(template, index, "operations_freeze_signoff_receipt_template_hash");
  });
}

function buildGateRows({ signoffLedger, scripts, validateScript, ledgerText, receiptTemplates, boundary }) {
  const rows = [
    gateRow("p485_signoff_ledger_ready", "P485 operations freeze signoff ledger source is ready.", signoffLedger.validation.valid && signoffLedger.summary.platform_operations_freeze_signoff_ledger_status === SIGNOFF_LEDGER_STATUS && signoffLedger.summary.ready_signoff_row_count === 7),
    gateRow("platform_package_script_registered", "package.json registers the P486 platform operations freeze signoff receipt template command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P486 platform operations freeze signoff receipt template command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p486_ledger_acceptance_declared", "P486 acceptance row is declared in the platform operations ledger.", ledgerText.includes(`P486: \`${COMMAND_NAME}\``)),
    gateRow("receipt_templates_ready", "All operations freeze signoff receipt templates are ready for human completion.", receiptTemplates.length === 7 && receiptTemplates.every((row) => row.receipt_template_status === "ready_for_human_receipt")),
    gateRow("no_receipt_or_approval_application", "Receipt template records required fields without completing receipts, signoff, or approvals.", !boundary.receipt_completed && !boundary.receipt_received && !boundary.signoff_completed && !boundary.approval_applied && !boundary.receipt_materialized),
    gateRow("no_command_or_artifact_access", "Receipt template executes no commands and reads/writes no generated artifacts.", boundary.read_only && boundary.report_only && boundary.signoff_ledger_consumed_in_memory && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.acceptance_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operations_freeze_signoff_receipt_template_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-operations-freeze-signoff-receipt-template-gate-row.v1",
    operations_freeze_signoff_receipt_template_gate_row_id: `platform-operations-freeze-signoff-receipt-template.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_completed_by_template: false,
    receipt_received_by_template: false,
    signoff_completed_by_template: false,
    approval_applied_by_template: false,
    receipt_materialized_by_template: false,
    signoff_ledger_artifact_read_performed_by_template: false,
    command_execution_performed_by_template: false,
    package_command_execution_performed_by_template: false,
    acceptance_command_execution_performed_by_template: false,
    generated_artifact_read_performed_by_template: false,
    artifact_read_performed_by_template: false,
    artifact_write_performed_by_template: false,
    release_published_by_template: false,
    git_operation_performed_by_template: false,
    protected_action_executed_by_template: false,
    protected_recovery_execution_allowed_by_template: false,
    trading_order_submission_performed_by_template: false,
    broker_write_allowed_by_template: false,
    exchange_write_allowed_by_template: false,
    desktop_source_of_truth_by_template: false,
    desktop_mutation_allowed_by_template: false,
    secret_exposure_allowed_by_template: false,
    secret_values_read_by_template: false,
    env_file_read_by_template: false,
    desktop_config_content_inspected_by_template: false,
    desktop_provider_key_visible_by_template: false,
    credential_lookup_allowed_by_template: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-operations-freeze-signoff-receipt-template-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    receipt_template_artifact_write_requested: writeRequested,
    signoff_ledger_consumed_in_memory: true,
    signoff_ledger_artifact_read_performed: false,
    receipt_completed: false,
    receipt_received: false,
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
    human_review_note: "Receipt templates must be completed externally by humans before operations-freeze signoff can be claimed.",
  };
}

function buildValidationItems({ signoffLedger, packageJson, platformOpsLedger, receiptTemplates, gateRows, boundary }) {
  return [
    validationItem("source.operations_freeze_signoff_ledger", "p485_signoff_ledger_ready", signoffLedger.validation.valid && signoffLedger.summary.platform_operations_freeze_signoff_ledger_status === SIGNOFF_LEDGER_STATUS && signoffLedger.summary.ready_signoff_row_count === 7, "P485 signoff ledger must be ready before P486 receipt templates."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P486 receipt templates."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("operations_freeze_signoff_receipt_templates", "receipt_templates_ready", receiptTemplates.length === 7 && receiptTemplates.every((row) => row.receipt_template_status === "ready_for_human_receipt" && row.source_signoff_status === "ready_for_human_signoff" && !row.receipt_completed_by_template && !row.receipt_received_by_template && !row.approval_applied_by_template && !row.command_execution_performed_by_template), "Every operations freeze receipt template must be ready and template-only."),
    validationItem("operations_freeze_signoff_receipt_template_gate_rows", "template_gates_ready", gateRows.length >= 8 && gateRows.every((row) => row.gate_status === "ready" && !row.receipt_completed_by_template && !row.protected_action_executed_by_template), "P486 operations freeze receipt template gates must be ready and template-only."),
    validationItem("boundary.receipt_not_completed", "receipt_not_completed", boundary.read_only && boundary.report_only && boundary.signoff_ledger_consumed_in_memory && !boundary.signoff_ledger_artifact_read_performed && !boundary.receipt_completed && !boundary.receipt_received && !boundary.signoff_completed && !boundary.approval_applied && !boundary.receipt_materialized, "P486 receipt template consumes P485 in memory and does not complete receipts, signoff, approvals, or receipt materialization."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.acceptance_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed, "P486 receipt template does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.protected_recovery_execution_allowed, "P486 receipt template performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed, "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled."),
  ];
}

function buildSummary({ signoffLedger, receiptTemplates, gateRows, boundary, validation }) {
  return {
    platform_operations_freeze_signoff_receipt_template_status: validation.valid ? RECEIPT_TEMPLATE_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_signoff_ledger_status: signoffLedger.summary.platform_operations_freeze_signoff_ledger_status,
    source_signoff_row_count: signoffLedger.summary.signoff_row_count,
    source_signoff_ready_row_count: signoffLedger.summary.ready_signoff_row_count,
    receipt_template_count: receiptTemplates.length,
    ready_receipt_template_count: receiptTemplates.filter((row) => row.receipt_template_status === "ready_for_human_receipt").length,
    template_gate_count: gateRows.length,
    ready_template_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    receipt_template_artifact_write_requested: boundary.receipt_template_artifact_write_requested,
    signoff_ledger_consumed_in_memory: boundary.signoff_ledger_consumed_in_memory,
    signoff_ledger_artifact_read_performed: boundary.signoff_ledger_artifact_read_performed,
    receipt_completed: boundary.receipt_completed,
    receipt_received: boundary.receipt_received,
    signoff_completed: boundary.signoff_completed,
    approval_applied: boundary.approval_applied,
    receipt_materialized: boundary.receipt_materialized,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
    acceptance_command_execution_performed: boundary.acceptance_command_execution_performed,
    generated_artifact_read_performed: boundary.generated_artifact_read_performed,
    artifact_read_performed: boundary.artifact_read_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    dependency_install_performed: boundary.dependency_install_performed,
    package_mutation_performed: boundary.package_mutation_performed,
    lockfile_mutation_performed: boundary.lockfile_mutation_performed,
    release_published: boundary.release_published,
    git_operation_performed: boundary.git_operation_performed,
    protected_action_executed: boundary.protected_action_executed,
    protected_recovery_execution_allowed: boundary.protected_recovery_execution_allowed,
    trading_live_enabled: boundary.trading_live_enabled,
    trading_full_auto_enabled: boundary.trading_full_auto_enabled,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    desktop_source_of_truth: boundary.desktop_source_of_truth,
    desktop_mutation_allowed: boundary.desktop_mutation_allowed,
    secret_exposure_allowed: boundary.secret_exposure_allowed,
    secret_values_read: boundary.secret_values_read,
    env_file_read: boundary.env_file_read,
    desktop_config_content_inspected: boundary.desktop_config_content_inspected,
    desktop_provider_key_visible: boundary.desktop_provider_key_visible,
    credential_lookup_allowed: boundary.credential_lookup_allowed,
    human_review_required: boundary.human_review_required,
    human_signoff_required: boundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Operations Freeze Signoff Receipt Template",
    "",
    `Status: ${result.summary.platform_operations_freeze_signoff_receipt_template_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source signoff ledger: ${result.summary.source_signoff_ledger_status}`,
    `Receipt templates: ${result.summary.ready_receipt_template_count}/${result.summary.receipt_template_count}`,
    `Template gates: ${result.summary.ready_template_gate_count}/${result.summary.template_gate_count}`,
    "",
    "## Receipt Templates",
    "",
    ...result.operations_freeze_signoff_receipt_templates.map((row) => `- ${row.invocation} (${row.required_signoff_role}): ${row.receipt_template_status}`),
    "",
    "## Template Gates",
    "",
    ...result.operations_freeze_signoff_receipt_template_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_TEMPLATE_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operations-freeze-signoff-receipt-template.mjs [options]

Options:
  --out-dir <folder>                  Output directory. Default: ${DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_TEMPLATE_OUT_DIR}
  --run-at <iso>                      Deterministic generated_at timestamp.
  --package <path>                    package.json path.
  --platform-ops-ledger <path>        P341-P500 platform operations ledger path.
  --source-inventory-schema <path>    P481 source inventory schema path.
  --command-matrix-schema <path>      P482 command matrix schema path.
  --evidence-index-schema <path>      P483 evidence index schema path.
  --review-packet-schema <path>       P484 review packet schema path.
  --signoff-ledger-schema <path>      P485 signoff ledger schema path.
  --schema <path>                     Output schema path.
  --check                             Validate only, do not write artifacts.
  -h, --help                          Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.platformOpsLedgerPath),
    operations_freeze_source_inventory_schema_path: path.resolve(options.operationsFreezeSourceInventorySchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.operationsFreezeSourceInventorySchemaPath),
    operations_freeze_command_matrix_schema_path: path.resolve(options.operationsFreezeCommandMatrixSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.operationsFreezeCommandMatrixSchemaPath),
    operations_freeze_evidence_index_schema_path: path.resolve(options.operationsFreezeEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.operationsFreezeEvidenceIndexSchemaPath),
    operations_freeze_review_packet_schema_path: path.resolve(options.operationsFreezeReviewPacketSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.operationsFreezeReviewPacketSchemaPath),
    operations_freeze_signoff_ledger_schema_path: path.resolve(options.operationsFreezeSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.operationsFreezeSignoffLedgerSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.schemaPath),
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
    validation_item_id: `platform-operations-freeze-signoff-receipt-template.${slugify(itemPath)}.${checkId}`,
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
