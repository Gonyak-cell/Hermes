import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_TEMPLATE_INPUTS,
  buildPlatformOperationsFreezeSignoffReceiptTemplate,
} from "./platform-operations-freeze-signoff-receipt-template.mjs";

export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_INTAKE_OUT_DIR = "artifacts/platform-operations-freeze-signoff-receipt-intake/latest";
export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_INTAKE_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_TEMPLATE_INPUTS,
  operationsFreezeSignoffReceiptTemplateSchemaPath: DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_TEMPLATE_INPUTS.schemaPath,
  schemaPath: "schemas/platform-operations-freeze-signoff-receipt-intake.schema.json",
};

const COMMAND_NAME = "platform:operations-freeze-signoff-receipt-intake";
const SCHEMA_VERSION = "platform-operations-freeze-signoff-receipt-intake.v1";
const CAPABILITY_ID = "platform.operations_freeze_signoff_receipt_intake";
const PHASE_SLOT = "P487";
const PREVIOUS_PHASE_SLOT = "P486";
const NEXT_PHASE_SLOT = "P488";
const RECEIPT_TEMPLATE_STATUS = "ready_for_operations_freeze_signoff_receipt_template";
const RECEIPT_INTAKE_STATUS = "ready_for_operations_freeze_signoff_receipt_intake";

export async function runPlatformOperationsFreezeSignoffReceiptIntake(options = {}) {
  const result = await buildPlatformOperationsFreezeSignoffReceiptIntake(options);
  if (options.write !== false) await writePlatformOperationsFreezeSignoffReceiptIntake(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operations freeze signoff receipt intake failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperationsFreezeSignoffReceiptIntake(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_INTAKE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const receiptTemplate = await buildPlatformOperationsFreezeSignoffReceiptTemplate({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    operationsFreezeSourceInventorySchemaPath: inputs.operations_freeze_source_inventory_schema_path,
    operationsFreezeCommandMatrixSchemaPath: inputs.operations_freeze_command_matrix_schema_path,
    operationsFreezeEvidenceIndexSchemaPath: inputs.operations_freeze_evidence_index_schema_path,
    operationsFreezeReviewPacketSchemaPath: inputs.operations_freeze_review_packet_schema_path,
    operationsFreezeSignoffLedgerSchemaPath: inputs.operations_freeze_signoff_ledger_schema_path,
    schemaPath: inputs.operations_freeze_signoff_receipt_template_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const intakeRows = buildIntakeRows({ receiptTemplate });
  const boundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const anchor = buildAnchor({ receiptTemplate, packageJson, platformOpsLedger, intakeRows });
  const gateRows = buildGateRows({
    receiptTemplate,
    scripts,
    validateScript,
    ledgerText: platformOpsLedger.text ?? "",
    intakeRows,
    boundary,
  });
  const validationItems = buildValidationItems({ receiptTemplate, packageJson, platformOpsLedger, intakeRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ receiptTemplate, intakeRows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operations_freeze_signoff_receipt_intake_id: `platform-operations-freeze-signoff-receipt-intake.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operations_freeze_signoff_receipt_intake_anchor: anchor,
    operations_freeze_signoff_receipt_intake_rows: intakeRows,
    operations_freeze_signoff_receipt_intake_gate_rows: gateRows,
    operations_freeze_signoff_receipt_intake_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operations_freeze_signoff_receipt_intake") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ receiptTemplate, intakeRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_operations_freeze_signoff_receipt_intake_id = result.platform_operations_freeze_signoff_receipt_intake_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperationsFreezeSignoffReceiptIntake(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-operations-freeze-signoff-receipt-intake.json"), serializableResult(result));
  await writeJson(path.join(outDir, "freeze-signoff-receipt-intake-rows.json"), collectionEnvelope("platform-operations-freeze-signoff-receipt-intake-rows.v1", "operations_freeze_signoff_receipt_intake_rows", result.operations_freeze_signoff_receipt_intake_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-signoff-receipt-intake-gate-rows.json"), collectionEnvelope("platform-operations-freeze-signoff-receipt-intake-gates.v1", "operations_freeze_signoff_receipt_intake_gate_rows", result.operations_freeze_signoff_receipt_intake_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-signoff-receipt-intake-boundary.json"), result.operations_freeze_signoff_receipt_intake_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operations-freeze-signoff-receipt-intake-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperationsFreezeSignoffReceiptIntakeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperationsFreezeSignoffReceiptIntake(args);
    console.log(`Platform operations freeze signoff receipt intake ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operations_freeze_signoff_receipt_intake_status}`);
    console.log(`Intake rows: ${result.summary.ready_intake_row_count}/${result.summary.intake_row_count}`);
    console.log(`Intake gates: ${result.summary.ready_intake_gate_count}/${result.summary.intake_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildAnchor({ receiptTemplate, packageJson, platformOpsLedger, intakeRows }) {
  return {
    schema_version: "platform-operations-freeze-signoff-receipt-intake-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_template_id: receiptTemplate.platform_operations_freeze_signoff_receipt_template_id,
    source_receipt_template_status: receiptTemplate.summary.platform_operations_freeze_signoff_receipt_template_status,
    source_receipt_template_hash: hashValue({
      id: receiptTemplate.platform_operations_freeze_signoff_receipt_template_id,
      status: receiptTemplate.summary.platform_operations_freeze_signoff_receipt_template_status,
      templates: receiptTemplate.summary.receipt_template_count,
      ready_templates: receiptTemplate.summary.ready_receipt_template_count,
    }),
    package_json_hash: packageJson.content_hash,
    platform_ops_ledger_hash: platformOpsLedger.content_hash,
    receipt_intake_hash: hashValue(intakeRows.map((row) => ({
      row_key: row.source_evidence_row_key,
      receipt_intake_status: row.receipt_intake_status,
      ready_for_human_input: row.ready_for_human_input,
      ready_for_validation: row.ready_for_validation,
    }))),
  };
}

function buildIntakeRows({ receiptTemplate }) {
  const sourceReady = receiptTemplate.validation.valid && receiptTemplate.summary.platform_operations_freeze_signoff_receipt_template_status === RECEIPT_TEMPLATE_STATUS;
  return receiptTemplate.operations_freeze_signoff_receipt_templates.map((template, index) => {
    const intakeStatus = sourceReady && template.receipt_template_status === "ready_for_human_receipt" ? "awaiting_human_receipt" : "blocked";
    const row = {
      schema_version: "platform-operations-freeze-signoff-receipt-intake-row.v1",
      operations_freeze_signoff_receipt_intake_row_id: `platform-operations-freeze-signoff-receipt-intake.row.${template.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_receipt_template_row_id: template.operations_freeze_signoff_receipt_template_row_id,
      source_signoff_row_id: template.source_signoff_row_id,
      source_evidence_row_key: template.source_evidence_row_key,
      package_script_name: template.package_script_name,
      invocation: template.invocation,
      evidence_kind: template.evidence_kind,
      expected_report_path: template.expected_report_path,
      human_review_evidence_slot: template.human_review_evidence_slot,
      required_reviewer_role: template.required_reviewer_role,
      required_signoff_role: template.required_signoff_role,
      required_receipt_type: template.required_receipt_type,
      required_receipt_fields: template.required_receipt_fields,
      allowed_decisions: template.allowed_decisions,
      receipt_intake_status: intakeStatus,
      source_receipt_template_status: template.receipt_template_status,
      source_signoff_status: template.source_signoff_status,
      source_review_packet_status: template.source_review_packet_status,
      source_evidence_status: template.source_evidence_status,
      ready_for_human_input: intakeStatus === "awaiting_human_receipt",
      ready_for_validation: false,
      receipt_received_by_intake: false,
      receipt_validated_by_intake: false,
      signoff_completed_by_intake: false,
      approval_applied_by_intake: false,
      receipt_materialized_by_intake: false,
      receipt_template_consumed_in_memory: true,
      receipt_template_artifact_read_performed_by_intake: false,
      command_execution_performed_by_intake: false,
      package_command_execution_performed_by_intake: false,
      acceptance_command_execution_performed_by_intake: false,
      generated_artifact_read_performed_by_intake: false,
      artifact_read_performed_by_intake: false,
      artifact_write_performed_by_intake: false,
      release_published_by_intake: false,
      git_operation_performed_by_intake: false,
      protected_action_executed_by_intake: false,
      protected_recovery_execution_allowed_by_intake: false,
      trading_live_enabled_by_intake: false,
      trading_full_auto_enabled_by_intake: false,
      trading_order_submission_allowed_by_intake: false,
      broker_write_allowed_by_intake: false,
      exchange_write_allowed_by_intake: false,
      desktop_source_of_truth_by_intake: false,
      desktop_mutation_allowed_by_intake: false,
      secret_exposure_allowed_by_intake: false,
      secret_values_read_by_intake: false,
      env_file_read_by_intake: false,
      desktop_config_content_inspected_by_intake: false,
      desktop_provider_key_visible_by_intake: false,
      credential_lookup_allowed_by_intake: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Await an external human receipt for ${template.invocation}; this intake row does not receive, validate, or apply it.`,
    };
    return withOrdinalAndHash(row, index, "operations_freeze_signoff_receipt_intake_row_hash");
  });
}

function buildGateRows({ receiptTemplate, scripts, validateScript, ledgerText, intakeRows, boundary }) {
  const rows = [
    gateRow("p486_receipt_template_ready", "P486 operations freeze signoff receipt template source is ready.", receiptTemplate.validation.valid && receiptTemplate.summary.platform_operations_freeze_signoff_receipt_template_status === RECEIPT_TEMPLATE_STATUS && receiptTemplate.summary.ready_receipt_template_count === 7),
    gateRow("platform_package_script_registered", "package.json registers the P487 platform operations freeze signoff receipt intake command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P487 platform operations freeze signoff receipt intake command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p487_ledger_acceptance_declared", "P487 acceptance row is declared in the platform operations ledger.", ledgerText.includes(`P487: \`${COMMAND_NAME}\``)),
    gateRow("intake_rows_ready", "All operations freeze signoff receipt intake rows are awaiting external human receipts.", intakeRows.length === 7 && intakeRows.every((row) => row.receipt_intake_status === "awaiting_human_receipt" && row.ready_for_human_input)),
    gateRow("no_receipt_validation_or_approval_application", "Receipt intake records pending receipt slots without receiving or validating receipts, completing signoff, or applying approval.", !boundary.receipt_received && !boundary.receipt_validated && !boundary.ready_for_validation && !boundary.signoff_completed && !boundary.approval_applied),
    gateRow("no_command_or_artifact_access", "Receipt intake executes no commands and reads/writes no generated artifacts.", boundary.read_only && boundary.report_only && boundary.receipt_template_consumed_in_memory && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.acceptance_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operations_freeze_signoff_receipt_intake_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-operations-freeze-signoff-receipt-intake-gate-row.v1",
    operations_freeze_signoff_receipt_intake_gate_row_id: `platform-operations-freeze-signoff-receipt-intake.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_received_by_intake: false,
    receipt_validated_by_intake: false,
    signoff_completed_by_intake: false,
    approval_applied_by_intake: false,
    receipt_materialized_by_intake: false,
    receipt_template_artifact_read_performed_by_intake: false,
    command_execution_performed_by_intake: false,
    package_command_execution_performed_by_intake: false,
    acceptance_command_execution_performed_by_intake: false,
    generated_artifact_read_performed_by_intake: false,
    artifact_read_performed_by_intake: false,
    artifact_write_performed_by_intake: false,
    release_published_by_intake: false,
    git_operation_performed_by_intake: false,
    protected_action_executed_by_intake: false,
    protected_recovery_execution_allowed_by_intake: false,
    trading_order_submission_performed_by_intake: false,
    broker_write_allowed_by_intake: false,
    exchange_write_allowed_by_intake: false,
    desktop_source_of_truth_by_intake: false,
    desktop_mutation_allowed_by_intake: false,
    secret_exposure_allowed_by_intake: false,
    secret_values_read_by_intake: false,
    env_file_read_by_intake: false,
    desktop_config_content_inspected_by_intake: false,
    desktop_provider_key_visible_by_intake: false,
    credential_lookup_allowed_by_intake: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-operations-freeze-signoff-receipt-intake-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    receipt_intake_artifact_write_requested: writeRequested,
    receipt_template_consumed_in_memory: true,
    receipt_template_artifact_read_performed: false,
    receipt_received: false,
    receipt_validated: false,
    ready_for_validation: false,
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
    human_review_note: "Receipt intake rows wait for external human receipts; this command does not receive, validate, or apply them.",
  };
}

function buildValidationItems({ receiptTemplate, packageJson, platformOpsLedger, intakeRows, gateRows, boundary }) {
  return [
    validationItem("source.operations_freeze_signoff_receipt_template", "p486_receipt_template_ready", receiptTemplate.validation.valid && receiptTemplate.summary.platform_operations_freeze_signoff_receipt_template_status === RECEIPT_TEMPLATE_STATUS && receiptTemplate.summary.ready_receipt_template_count === 7, "P486 receipt template must be ready before P487 receipt intake."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P487 receipt intake."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("operations_freeze_signoff_receipt_intake_rows", "intake_rows_ready", intakeRows.length === 7 && intakeRows.every((row) => row.receipt_intake_status === "awaiting_human_receipt" && row.ready_for_human_input && !row.receipt_received_by_intake && !row.receipt_validated_by_intake && !row.approval_applied_by_intake), "Every operations freeze receipt intake row must be awaiting external human input."),
    validationItem("operations_freeze_signoff_receipt_intake_gate_rows", "intake_gates_ready", gateRows.length >= 8 && gateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_intake && !row.protected_action_executed_by_intake), "P487 operations freeze receipt intake gates must be ready and intake-only."),
    validationItem("boundary.receipt_not_received", "receipt_not_received", boundary.read_only && boundary.report_only && boundary.receipt_template_consumed_in_memory && !boundary.receipt_template_artifact_read_performed && !boundary.receipt_received && !boundary.receipt_validated && !boundary.ready_for_validation && !boundary.signoff_completed && !boundary.approval_applied, "P487 receipt intake consumes P486 in memory and does not receive, validate, or apply receipts."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.acceptance_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed, "P487 receipt intake does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.protected_recovery_execution_allowed, "P487 receipt intake performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed, "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled."),
  ];
}

function buildSummary({ receiptTemplate, intakeRows, gateRows, boundary, validation }) {
  return {
    platform_operations_freeze_signoff_receipt_intake_status: validation.valid ? RECEIPT_INTAKE_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_template_status: receiptTemplate.summary.platform_operations_freeze_signoff_receipt_template_status,
    source_receipt_template_count: receiptTemplate.summary.receipt_template_count,
    source_receipt_template_ready_count: receiptTemplate.summary.ready_receipt_template_count,
    intake_row_count: intakeRows.length,
    ready_intake_row_count: intakeRows.filter((row) => row.receipt_intake_status === "awaiting_human_receipt").length,
    intake_gate_count: gateRows.length,
    ready_intake_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    receipt_intake_artifact_write_requested: boundary.receipt_intake_artifact_write_requested,
    receipt_template_consumed_in_memory: boundary.receipt_template_consumed_in_memory,
    receipt_template_artifact_read_performed: boundary.receipt_template_artifact_read_performed,
    receipt_received: boundary.receipt_received,
    receipt_validated: boundary.receipt_validated,
    ready_for_validation: boundary.ready_for_validation,
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
    "# Platform Operations Freeze Signoff Receipt Intake",
    "",
    `Status: ${result.summary.platform_operations_freeze_signoff_receipt_intake_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source receipt template: ${result.summary.source_receipt_template_status}`,
    `Intake rows: ${result.summary.ready_intake_row_count}/${result.summary.intake_row_count}`,
    `Intake gates: ${result.summary.ready_intake_gate_count}/${result.summary.intake_gate_count}`,
    "",
    "## Intake Rows",
    "",
    ...result.operations_freeze_signoff_receipt_intake_rows.map((row) => `- ${row.invocation} (${row.required_signoff_role}): ${row.receipt_intake_status}`),
    "",
    "## Intake Gates",
    "",
    ...result.operations_freeze_signoff_receipt_intake_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_INTAKE_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operations-freeze-signoff-receipt-intake.mjs [options]

Options:
  --out-dir <folder>                  Output directory. Default: ${DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_INTAKE_OUT_DIR}
  --run-at <iso>                      Deterministic generated_at timestamp.
  --package <path>                    package.json path.
  --platform-ops-ledger <path>        P341-P500 platform operations ledger path.
  --source-inventory-schema <path>    P481 source inventory schema path.
  --command-matrix-schema <path>      P482 command matrix schema path.
  --evidence-index-schema <path>      P483 evidence index schema path.
  --review-packet-schema <path>       P484 review packet schema path.
  --signoff-ledger-schema <path>      P485 signoff ledger schema path.
  --receipt-template-schema <path>    P486 receipt template schema path.
  --schema <path>                     Output schema path.
  --check                             Validate only, do not write artifacts.
  -h, --help                          Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_INTAKE_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_INTAKE_INPUTS.platformOpsLedgerPath),
    operations_freeze_source_inventory_schema_path: path.resolve(options.operationsFreezeSourceInventorySchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_INTAKE_INPUTS.operationsFreezeSourceInventorySchemaPath),
    operations_freeze_command_matrix_schema_path: path.resolve(options.operationsFreezeCommandMatrixSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_INTAKE_INPUTS.operationsFreezeCommandMatrixSchemaPath),
    operations_freeze_evidence_index_schema_path: path.resolve(options.operationsFreezeEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_INTAKE_INPUTS.operationsFreezeEvidenceIndexSchemaPath),
    operations_freeze_review_packet_schema_path: path.resolve(options.operationsFreezeReviewPacketSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_INTAKE_INPUTS.operationsFreezeReviewPacketSchemaPath),
    operations_freeze_signoff_ledger_schema_path: path.resolve(options.operationsFreezeSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_INTAKE_INPUTS.operationsFreezeSignoffLedgerSchemaPath),
    operations_freeze_signoff_receipt_template_schema_path: path.resolve(options.operationsFreezeSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_INTAKE_INPUTS.operationsFreezeSignoffReceiptTemplateSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_RECEIPT_INTAKE_INPUTS.schemaPath),
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
    validation_item_id: `platform-operations-freeze-signoff-receipt-intake.${slugify(itemPath)}.${checkId}`,
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
