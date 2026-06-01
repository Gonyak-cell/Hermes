import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_INPUTS,
  buildPlatformOperationsFreezeReceiptQueue,
} from "./platform-operations-freeze-receipt-queue.mjs";

export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_OUT_DIR = "artifacts/platform-operations-freeze-receipt-validation-rules/latest";
export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_INPUTS,
  operationsFreezeReceiptQueueSchemaPath: DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_QUEUE_INPUTS.schemaPath,
  schemaPath: "schemas/platform-operations-freeze-receipt-validation-rules.schema.json",
};

const COMMAND_NAME = "platform:operations-freeze-receipt-validation-rules";
const SCHEMA_VERSION = "platform-operations-freeze-receipt-validation-rules.v1";
const CAPABILITY_ID = "platform.operations_freeze_receipt_validation_rules";
const PHASE_SLOT = "P491";
const PREVIOUS_PHASE_SLOT = "P490";
const NEXT_PHASE_SLOT = "P492";
const SOURCE_READY_STATUS = "queued_for_human_receipt";
const RULE_READY_STATUS = "ready_for_future_receipt_validation";
const REQUIRED_RECEIPT_FIELDS = ["reviewer_id", "reviewed_at", "source_signoff_row_id", "decision", "evidence_reference", "command_result_reference", "blocker_note"];
const ALLOWED_RECEIPT_DECISIONS = ["approve_ready_evidence", "return_with_blocker"];

export async function runPlatformOperationsFreezeReceiptValidationRules(options = {}) {
  const result = await buildPlatformOperationsFreezeReceiptValidationRules(options);
  if (options.write !== false) await writePlatformOperationsFreezeReceiptValidationRules(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operations freeze receipt validation rules failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperationsFreezeReceiptValidationRules(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const receiptQueue = await buildPlatformOperationsFreezeReceiptQueue({
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
    schemaPath: inputs.operations_freeze_receipt_queue_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const ruleRows = buildRuleRows({ receiptQueue });
  const rulesBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const rulesAnchor = buildRulesAnchor({ receiptQueue, packageJson, platformOpsLedger, ruleRows });
  const rulesGateRows = buildRulesGateRows({ receiptQueue, packageJson, platformOpsLedger, ruleRows, rulesBoundary });
  const validationItems = buildValidationItems({ receiptQueue, packageJson, platformOpsLedger, ruleRows, rulesGateRows, rulesBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ receiptQueue, ruleRows, rulesGateRows, rulesBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operations_freeze_receipt_validation_rules_id: `platform-operations-freeze-receipt-validation-rules.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operations_freeze_receipt_validation_rules_anchor: rulesAnchor,
    operations_freeze_receipt_validation_rule_rows: ruleRows,
    operations_freeze_receipt_validation_rules_gate_rows: rulesGateRows,
    operations_freeze_receipt_validation_rules_boundary: rulesBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operations_freeze_receipt_validation_rules") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ receiptQueue, ruleRows, rulesGateRows, rulesBoundary, validation: result.validation });
  result.summary.platform_operations_freeze_receipt_validation_rules_id = result.platform_operations_freeze_receipt_validation_rules_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperationsFreezeReceiptValidationRules(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-operations-freeze-receipt-validation-rules.json"), serializableResult(result));
  await writeJson(path.join(outDir, "freeze-receipt-validation-rule-rows.json"), collectionEnvelope("platform-operations-freeze-receipt-validation-rule-rows.v1", "operations_freeze_receipt_validation_rule_rows", result.operations_freeze_receipt_validation_rule_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-receipt-validation-rules-gate-rows.json"), collectionEnvelope("platform-operations-freeze-receipt-validation-rules-gate-rows.v1", "operations_freeze_receipt_validation_rules_gate_rows", result.operations_freeze_receipt_validation_rules_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-receipt-validation-rules-boundary.json"), result.operations_freeze_receipt_validation_rules_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operations-freeze-receipt-validation-rules-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperationsFreezeReceiptValidationRulesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperationsFreezeReceiptValidationRules(args);
    console.log(`Platform operations freeze receipt validation rules ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operations_freeze_receipt_validation_rules_status}`);
    console.log(`Rule rows: ${result.summary.ready_rule_row_count}/${result.summary.rule_row_count}`);
    console.log(`Rule gates: ${result.summary.ready_rule_gate_count}/${result.summary.rule_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildRulesAnchor({ receiptQueue, packageJson, platformOpsLedger, ruleRows }) {
  return {
    schema_version: "platform-operations-freeze-receipt-validation-rules-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_queue_id: receiptQueue.platform_operations_freeze_receipt_queue_id,
    source_receipt_queue_status: receiptQueue.summary.platform_operations_freeze_receipt_queue_status,
    source_receipt_queue_hash: hashValue({
      id: receiptQueue.platform_operations_freeze_receipt_queue_id,
      status: receiptQueue.summary.platform_operations_freeze_receipt_queue_status,
      queue_rows: receiptQueue.summary.queue_row_count,
      ready_queue_rows: receiptQueue.summary.ready_queue_row_count,
      gate_rows: receiptQueue.summary.queue_gate_count,
    }),
    package_json_hash: packageJson.content_hash,
    platform_ops_ledger_hash: platformOpsLedger.content_hash,
    rule_rows_hash: hashValue(ruleRows.map((row) => ({
      row_key: row.source_evidence_row_key,
      receipt_validation_rule_status: row.receipt_validation_rule_status,
      receipt_payload_present: row.receipt_payload_present,
    }))),
  };
}

function buildRuleRows({ receiptQueue }) {
  const sourceReady = receiptQueue.validation.valid && receiptQueue.summary.platform_operations_freeze_receipt_queue_status === SOURCE_READY_STATUS;
  return receiptQueue.operations_freeze_receipt_queue_rows.map((queueRow, index) => {
    const ruleStatus = sourceReady && queueRow.receipt_queue_status === SOURCE_READY_STATUS ? RULE_READY_STATUS : "blocked";
    const row = {
      schema_version: "platform-operations-freeze-receipt-validation-rule-row.v1",
      operations_freeze_receipt_validation_rule_row_id: `platform-operations-freeze-receipt-validation-rules.row.${queueRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_queue_row_id: queueRow.operations_freeze_receipt_queue_row_id,
      source_evidence_row_key: queueRow.source_evidence_row_key,
      queue_position: queueRow.queue_position,
      package_script_name: queueRow.package_script_name,
      invocation: queueRow.invocation,
      evidence_kind: queueRow.evidence_kind,
      expected_report_path: queueRow.expected_report_path,
      required_reviewer_role: queueRow.required_reviewer_role,
      required_signoff_role: queueRow.required_signoff_role,
      receipt_validation_rule_status: ruleStatus,
      source_receipt_queue_status: queueRow.receipt_queue_status,
      required_receipt_fields: REQUIRED_RECEIPT_FIELDS,
      allowed_receipt_decisions: ALLOWED_RECEIPT_DECISIONS,
      future_receipt_validation_required: true,
      receipt_payload_present: false,
      ready_to_validate_receipt_payload: false,
      receipt_received_by_rules: false,
      receipt_validated_by_rules: false,
      ready_for_validation_by_rules: false,
      signoff_completed_by_rules: false,
      approval_applied_by_rules: false,
      receipt_queue_consumed_in_memory: true,
      receipt_queue_artifact_read_performed_by_rules: false,
      command_execution_performed_by_rules: false,
      package_command_execution_performed_by_rules: false,
      acceptance_command_execution_performed_by_rules: false,
      generated_artifact_read_performed_by_rules: false,
      artifact_read_performed_by_rules: false,
      artifact_write_performed_by_rules: false,
      dependency_install_performed_by_rules: false,
      package_mutation_performed_by_rules: false,
      lockfile_mutation_performed_by_rules: false,
      release_published_by_rules: false,
      git_operation_performed_by_rules: false,
      protected_action_executed_by_rules: false,
      protected_recovery_execution_allowed_by_rules: false,
      trading_live_enabled_by_rules: false,
      trading_full_auto_enabled_by_rules: false,
      trading_order_submission_allowed_by_rules: false,
      broker_write_allowed_by_rules: false,
      exchange_write_allowed_by_rules: false,
      desktop_source_of_truth_by_rules: false,
      desktop_mutation_allowed_by_rules: false,
      secret_exposure_allowed_by_rules: false,
      secret_values_read_by_rules: false,
      env_file_read_by_rules: false,
      desktop_config_content_inspected_by_rules: false,
      desktop_provider_key_visible_by_rules: false,
      credential_lookup_allowed_by_rules: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Validation rules are declared for ${queueRow.invocation}; no receipt payload is received or validated by this phase.`,
    };
    return withOrdinalAndHash(row, index, "operations_freeze_receipt_validation_rule_row_hash");
  });
}

function buildRulesGateRows({ receiptQueue, packageJson, platformOpsLedger, ruleRows, rulesBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p490_receipt_queue_ready", "P490 operations freeze receipt queue source is ready.", receiptQueue.validation.valid && receiptQueue.summary.platform_operations_freeze_receipt_queue_status === SOURCE_READY_STATUS && receiptQueue.summary.ready_queue_row_count === 7),
    gateRow("platform_package_script_registered", "package.json registers the P491 platform operations freeze receipt validation rules command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P491 platform operations freeze receipt validation rules command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p491_ledger_acceptance_declared", "P491 acceptance row is declared in the platform operations ledger.", ledgerText.includes(`P491: \`${COMMAND_NAME}\``)),
    gateRow("validation_rule_rows_ready", "All operations freeze receipt validation rule rows are ready for future receipt validation.", ruleRows.length === 7 && ruleRows.every((row) => row.receipt_validation_rule_status === RULE_READY_STATUS && row.future_receipt_validation_required && !row.receipt_payload_present && !row.ready_to_validate_receipt_payload && REQUIRED_RECEIPT_FIELDS.every((field) => row.required_receipt_fields.includes(field)) && ALLOWED_RECEIPT_DECISIONS.every((decision) => row.allowed_receipt_decisions.includes(decision)))),
    gateRow("no_receipt_payload_validation", "Validation rules declare future checks without receiving or validating receipt payloads.", !rulesBoundary.receipt_payload_present && !rulesBoundary.ready_to_validate_receipt_payload && !rulesBoundary.receipt_received && !rulesBoundary.receipt_validated && !rulesBoundary.ready_for_validation && !rulesBoundary.signoff_completed && !rulesBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Validation rules execute no commands, read/write no artifacts, and perform no package, release, git, or protected mutation.", !rulesBoundary.command_execution_performed && !rulesBoundary.package_command_execution_performed && !rulesBoundary.acceptance_command_execution_performed && !rulesBoundary.generated_artifact_read_performed && !rulesBoundary.artifact_read_performed && !rulesBoundary.artifact_write_performed && !rulesBoundary.dependency_install_performed && !rulesBoundary.package_mutation_performed && !rulesBoundary.lockfile_mutation_performed && !rulesBoundary.release_published && !rulesBoundary.git_operation_performed && !rulesBoundary.protected_action_executed && !rulesBoundary.protected_recovery_execution_allowed),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !rulesBoundary.trading_live_enabled && !rulesBoundary.trading_full_auto_enabled && !rulesBoundary.trading_order_submission_allowed && !rulesBoundary.broker_write_allowed && !rulesBoundary.exchange_write_allowed && !rulesBoundary.desktop_source_of_truth && !rulesBoundary.desktop_mutation_allowed && !rulesBoundary.secret_exposure_allowed && !rulesBoundary.secret_values_read && !rulesBoundary.env_file_read && !rulesBoundary.desktop_config_content_inspected && !rulesBoundary.desktop_provider_key_visible && !rulesBoundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operations_freeze_receipt_validation_rules_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-operations-freeze-receipt-validation-rules-gate-row.v1",
    operations_freeze_receipt_validation_rules_gate_row_id: `platform-operations-freeze-receipt-validation-rules.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_payload_present_by_rules: false,
    ready_to_validate_receipt_payload_by_rules: false,
    receipt_received_by_rules: false,
    receipt_validated_by_rules: false,
    ready_for_validation_by_rules: false,
    signoff_completed_by_rules: false,
    approval_applied_by_rules: false,
    receipt_queue_artifact_read_performed_by_rules: false,
    command_execution_performed_by_rules: false,
    package_command_execution_performed_by_rules: false,
    acceptance_command_execution_performed_by_rules: false,
    generated_artifact_read_performed_by_rules: false,
    artifact_read_performed_by_rules: false,
    artifact_write_performed_by_rules: false,
    release_published_by_rules: false,
    git_operation_performed_by_rules: false,
    protected_action_executed_by_rules: false,
    protected_recovery_execution_allowed_by_rules: false,
    trading_order_submission_allowed_by_rules: false,
    broker_write_allowed_by_rules: false,
    exchange_write_allowed_by_rules: false,
    desktop_source_of_truth_by_rules: false,
    desktop_mutation_allowed_by_rules: false,
    secret_exposure_allowed_by_rules: false,
    secret_values_read_by_rules: false,
    env_file_read_by_rules: false,
    desktop_config_content_inspected_by_rules: false,
    desktop_provider_key_visible_by_rules: false,
    credential_lookup_allowed_by_rules: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-operations-freeze-receipt-validation-rules-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    receipt_validation_rules_artifact_write_requested: writeRequested,
    receipt_queue_consumed_in_memory: true,
    receipt_queue_artifact_read_performed: false,
    validation_rules_declared: true,
    future_receipt_validation_required: true,
    receipt_payload_present: false,
    ready_to_validate_receipt_payload: false,
    receipt_received: false,
    receipt_validated: false,
    ready_for_validation: false,
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
    human_review_note: "Receipt validation rules are declarative only; this phase does not receive, validate, complete, or apply receipts.",
  };
}

function buildValidationItems({ receiptQueue, packageJson, platformOpsLedger, ruleRows, rulesGateRows, rulesBoundary }) {
  return [
    validationItem("source.operations_freeze_receipt_queue", "p490_receipt_queue_ready", receiptQueue.validation.valid && receiptQueue.summary.platform_operations_freeze_receipt_queue_status === SOURCE_READY_STATUS && receiptQueue.summary.ready_queue_row_count === 7, "P490 operations freeze receipt queue source must be ready before P491 validation rules."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P491 operations freeze receipt validation rules."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("operations_freeze_receipt_validation_rule_rows", "validation_rule_rows_ready", ruleRows.length === 7 && ruleRows.every((row) => row.receipt_validation_rule_status === RULE_READY_STATUS && row.source_receipt_queue_status === SOURCE_READY_STATUS && row.future_receipt_validation_required && !row.receipt_payload_present && !row.ready_to_validate_receipt_payload && !row.receipt_received_by_rules && !row.receipt_validated_by_rules && !row.approval_applied_by_rules && REQUIRED_RECEIPT_FIELDS.every((field) => row.required_receipt_fields.includes(field)) && ALLOWED_RECEIPT_DECISIONS.every((decision) => row.allowed_receipt_decisions.includes(decision))), "Every operations freeze receipt validation rule row must declare future validation requirements without receipt payloads."),
    validationItem("operations_freeze_receipt_validation_rules_gate_rows", "rule_gates_ready", rulesGateRows.length >= 8 && rulesGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_rules && !row.protected_action_executed_by_rules), "P491 operations freeze receipt validation rules gates must be ready and declarative-only."),
    validationItem("boundary.no_receipt_payload", "no_receipt_payload", rulesBoundary.read_only && rulesBoundary.report_only && rulesBoundary.receipt_queue_consumed_in_memory && !rulesBoundary.receipt_queue_artifact_read_performed && rulesBoundary.validation_rules_declared && rulesBoundary.future_receipt_validation_required && !rulesBoundary.receipt_payload_present && !rulesBoundary.ready_to_validate_receipt_payload && !rulesBoundary.receipt_received && !rulesBoundary.receipt_validated && !rulesBoundary.ready_for_validation && !rulesBoundary.signoff_completed && !rulesBoundary.approval_applied, "P491 receipt validation rules declare future requirements without validating receipts."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !rulesBoundary.command_execution_performed && !rulesBoundary.package_command_execution_performed && !rulesBoundary.acceptance_command_execution_performed && !rulesBoundary.generated_artifact_read_performed && !rulesBoundary.artifact_read_performed && !rulesBoundary.artifact_write_performed, "P491 receipt validation rules do not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !rulesBoundary.dependency_install_performed && !rulesBoundary.package_mutation_performed && !rulesBoundary.lockfile_mutation_performed && !rulesBoundary.release_published && !rulesBoundary.git_operation_performed && !rulesBoundary.protected_action_executed && !rulesBoundary.protected_recovery_execution_allowed, "P491 receipt validation rules perform no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !rulesBoundary.trading_live_enabled && !rulesBoundary.trading_full_auto_enabled && !rulesBoundary.trading_order_submission_allowed && !rulesBoundary.broker_write_allowed && !rulesBoundary.exchange_write_allowed && !rulesBoundary.desktop_source_of_truth && !rulesBoundary.desktop_mutation_allowed && !rulesBoundary.secret_exposure_allowed && !rulesBoundary.secret_values_read && !rulesBoundary.env_file_read && !rulesBoundary.desktop_config_content_inspected && !rulesBoundary.desktop_provider_key_visible && !rulesBoundary.credential_lookup_allowed, "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled."),
  ];
}

function buildSummary({ receiptQueue, ruleRows, rulesGateRows, rulesBoundary, validation }) {
  return {
    platform_operations_freeze_receipt_validation_rules_status: validation.valid ? RULE_READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_queue_status: receiptQueue.summary.platform_operations_freeze_receipt_queue_status,
    rule_row_count: ruleRows.length,
    ready_rule_row_count: ruleRows.filter((row) => row.receipt_validation_rule_status === RULE_READY_STATUS).length,
    rule_gate_count: rulesGateRows.length,
    ready_rule_gate_count: rulesGateRows.filter((row) => row.gate_status === "ready").length,
    required_receipt_field_count: REQUIRED_RECEIPT_FIELDS.length,
    allowed_receipt_decision_count: ALLOWED_RECEIPT_DECISIONS.length,
    read_only: rulesBoundary.read_only,
    report_only: rulesBoundary.report_only,
    receipt_validation_rules_artifact_write_requested: rulesBoundary.receipt_validation_rules_artifact_write_requested,
    receipt_queue_consumed_in_memory: rulesBoundary.receipt_queue_consumed_in_memory,
    receipt_queue_artifact_read_performed: rulesBoundary.receipt_queue_artifact_read_performed,
    validation_rules_declared: rulesBoundary.validation_rules_declared,
    future_receipt_validation_required: rulesBoundary.future_receipt_validation_required,
    receipt_payload_present: rulesBoundary.receipt_payload_present,
    ready_to_validate_receipt_payload: rulesBoundary.ready_to_validate_receipt_payload,
    receipt_received: rulesBoundary.receipt_received,
    receipt_validated: rulesBoundary.receipt_validated,
    ready_for_validation: rulesBoundary.ready_for_validation,
    signoff_completed: rulesBoundary.signoff_completed,
    approval_applied: rulesBoundary.approval_applied,
    command_execution_performed: rulesBoundary.command_execution_performed,
    package_command_execution_performed: rulesBoundary.package_command_execution_performed,
    acceptance_command_execution_performed: rulesBoundary.acceptance_command_execution_performed,
    generated_artifact_read_performed: rulesBoundary.generated_artifact_read_performed,
    artifact_read_performed: rulesBoundary.artifact_read_performed,
    artifact_write_performed: rulesBoundary.artifact_write_performed,
    dependency_install_performed: rulesBoundary.dependency_install_performed,
    package_mutation_performed: rulesBoundary.package_mutation_performed,
    lockfile_mutation_performed: rulesBoundary.lockfile_mutation_performed,
    release_published: rulesBoundary.release_published,
    git_operation_performed: rulesBoundary.git_operation_performed,
    protected_action_executed: rulesBoundary.protected_action_executed,
    protected_recovery_execution_allowed: rulesBoundary.protected_recovery_execution_allowed,
    trading_live_enabled: rulesBoundary.trading_live_enabled,
    trading_full_auto_enabled: rulesBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: rulesBoundary.trading_order_submission_allowed,
    broker_write_allowed: rulesBoundary.broker_write_allowed,
    exchange_write_allowed: rulesBoundary.exchange_write_allowed,
    desktop_source_of_truth: rulesBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: rulesBoundary.desktop_mutation_allowed,
    secret_exposure_allowed: rulesBoundary.secret_exposure_allowed,
    secret_values_read: rulesBoundary.secret_values_read,
    env_file_read: rulesBoundary.env_file_read,
    desktop_config_content_inspected: rulesBoundary.desktop_config_content_inspected,
    desktop_provider_key_visible: rulesBoundary.desktop_provider_key_visible,
    credential_lookup_allowed: rulesBoundary.credential_lookup_allowed,
    human_review_required: rulesBoundary.human_review_required,
    human_signoff_required: rulesBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Operations Freeze Receipt Validation Rules",
    "",
    `Status: ${result.summary.platform_operations_freeze_receipt_validation_rules_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source receipt queue: ${result.summary.source_receipt_queue_status}`,
    `Rule rows: ${result.summary.ready_rule_row_count}/${result.summary.rule_row_count}`,
    `Rule gates: ${result.summary.ready_rule_gate_count}/${result.summary.rule_gate_count}`,
    "",
    "## Rule Rows",
    "",
    ...result.operations_freeze_receipt_validation_rule_rows.map((row) => `- ${row.invocation} (${row.required_signoff_role}): ${row.receipt_validation_rule_status}`),
    "",
    "## Rule Gates",
    "",
    ...result.operations_freeze_receipt_validation_rules_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operations-freeze-receipt-validation-rules.mjs [options]

Options:
  --out-dir <folder>                  Output directory. Default: ${DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_OUT_DIR}
  --run-at <iso>                      Deterministic generated_at timestamp.
  --package <path>                    package.json path.
  --platform-ops-ledger <path>        P341-P500 platform operations ledger path.
  --source-inventory-schema <path>    P481 source inventory schema path.
  --command-matrix-schema <path>      P482 command matrix schema path.
  --evidence-index-schema <path>      P483 evidence index schema path.
  --review-packet-schema <path>       P484 review packet schema path.
  --signoff-ledger-schema <path>      P485 signoff ledger schema path.
  --receipt-template-schema <path>    P486 receipt template schema path.
  --receipt-intake-schema <path>      P487 receipt intake schema path.
  --signoff-closeout-schema <path>    P488 signoff closeout schema path.
  --status-ledger-schema <path>       P489 status ledger schema path.
  --receipt-queue-schema <path>       P490 receipt queue schema path.
  --schema <path>                     Output schema path.
  --check                             Validate only, do not write artifacts.
  -h, --help                          Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_INPUTS.platformOpsLedgerPath),
    operations_freeze_source_inventory_schema_path: path.resolve(options.operationsFreezeSourceInventorySchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_INPUTS.operationsFreezeSourceInventorySchemaPath),
    operations_freeze_command_matrix_schema_path: path.resolve(options.operationsFreezeCommandMatrixSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_INPUTS.operationsFreezeCommandMatrixSchemaPath),
    operations_freeze_evidence_index_schema_path: path.resolve(options.operationsFreezeEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_INPUTS.operationsFreezeEvidenceIndexSchemaPath),
    operations_freeze_review_packet_schema_path: path.resolve(options.operationsFreezeReviewPacketSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_INPUTS.operationsFreezeReviewPacketSchemaPath),
    operations_freeze_signoff_ledger_schema_path: path.resolve(options.operationsFreezeSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_INPUTS.operationsFreezeSignoffLedgerSchemaPath),
    operations_freeze_signoff_receipt_template_schema_path: path.resolve(options.operationsFreezeSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_INPUTS.operationsFreezeSignoffReceiptTemplateSchemaPath),
    operations_freeze_signoff_receipt_intake_schema_path: path.resolve(options.operationsFreezeSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_INPUTS.operationsFreezeSignoffReceiptIntakeSchemaPath),
    operations_freeze_signoff_closeout_schema_path: path.resolve(options.operationsFreezeSignoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_INPUTS.operationsFreezeSignoffCloseoutSchemaPath),
    operations_freeze_status_ledger_schema_path: path.resolve(options.operationsFreezeStatusLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_INPUTS.operationsFreezeStatusLedgerSchemaPath),
    operations_freeze_receipt_queue_schema_path: path.resolve(options.operationsFreezeReceiptQueueSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_INPUTS.operationsFreezeReceiptQueueSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_VALIDATION_RULES_INPUTS.schemaPath),
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
    validation_item_id: `platform-operations-freeze-receipt-validation-rules.${slugify(itemPath)}.${checkId}`,
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
