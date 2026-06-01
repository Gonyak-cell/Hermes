import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_INTAKE_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationReceiptIntakeFixtures,
} from "./trading-secret-scan-remediation-receipt-intake-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_RULES_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-validation-rules-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_INTAKE_FIXTURES_INPUTS,
  secretScanRemediationReceiptIntakeSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_INTAKE_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-validation-rules-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-validation-rules-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_validation_rules_fixtures";
const PHASE_SLOT = "P431";
const PREVIOUS_PHASE_SLOT = "P430";
const NEXT_PHASE_SLOT = "P432";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_validation_rules";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_intake";
const SOURCE_QUEUE_STATUS = "pending_human_input";
const COMMAND_NAME = "trading:secret-scan-remediation-receipt-validation-rules-fixtures";
const REQUIRED_VALIDATION_RULES = [
  "receipt_status_is_allowed",
  "outcome_is_allowed_for_template",
  "reviewer_identity_present",
  "decided_at_is_iso_timestamp",
  "external_reference_present_when_required",
  "blocker_note_required_when_request_changes",
  "secret_material_fields_absent",
  "closeout_requires_clean_rerun_reference",
];
const FORBIDDEN_RECEIPT_FIELD_SNIPPETS = [
  "secret_value",
  "raw_secret",
  "plaintext_secret",
  "provider_api_key",
  "desktop_config_content",
  "env_file_content",
  "token_value",
  "private_key",
  "credential_material",
  "password",
];

export async function runTradingSecretScanRemediationReceiptValidationRulesFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptValidationRulesFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptValidationRulesFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt validation rules fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptValidationRulesFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_RULES_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const receiptIntake = await buildTradingSecretScanRemediationReceiptIntakeFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    controlPlaneHumanGateReceiptsPath: inputs.control_plane_human_gate_receipts_path,
    secretScanRemediationReceiptTemplateSchemaPath: inputs.secret_scan_remediation_receipt_template_schema_path,
    schemaPath: inputs.secret_scan_remediation_receipt_intake_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const validationRuleRows = buildValidationRuleRows(receiptIntake);
  const summaryRows = buildValidationRuleSummaryRows(validationRuleRows);
  const coverage = buildValidationRulesCoverage({ receiptIntake, validationRuleRows, summaryRows });
  const anchor = buildValidationRulesAnchor(receiptIntake, coverage);
  const boundary = buildValidationRulesBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    receiptIntake,
    validationRuleRows,
    summaryRows,
    coverage,
  });
  const gateRows = buildValidationRulesGateRows({ receiptIntake, packageJson, platformOpsLedger, boundary, coverage });
  const validationItems = buildValidationItems({
    receiptIntake,
    packageJson,
    platformOpsLedger,
    validationRuleRows,
    summaryRows,
    gateRows,
    boundary,
    coverage,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ receiptIntake, validationRuleRows, summaryRows, gateRows, boundary, coverage, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_scan_remediation_receipt_validation_rules_fixtures_id: `trading-secret-scan-remediation-receipt-validation-rules-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_scan_remediation_receipt_validation_rules_anchor: anchor,
    secret_scan_remediation_receipt_validation_rule_rows: validationRuleRows,
    secret_scan_remediation_receipt_validation_rule_summary_rows: summaryRows,
    secret_scan_remediation_receipt_validation_rules_gate_rows: gateRows,
    secret_scan_remediation_receipt_validation_rules_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_validation_rules_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ receiptIntake, validationRuleRows, summaryRows, gateRows, boundary, coverage, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_validation_rules_fixtures_id = result.trading_secret_scan_remediation_receipt_validation_rules_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptValidationRulesFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-validation-rules-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-validation-rule-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-validation-rule-rows.v1", "secret_scan_remediation_receipt_validation_rule_rows", result.secret_scan_remediation_receipt_validation_rule_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-validation-rule-summary-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-validation-rule-summary-rows.v1", "secret_scan_remediation_receipt_validation_rule_summary_rows", result.secret_scan_remediation_receipt_validation_rule_summary_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-validation-rules-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-validation-rules-gate-rows.v1", "secret_scan_remediation_receipt_validation_rules_gate_rows", result.secret_scan_remediation_receipt_validation_rules_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-validation-rules-boundary.json"), result.secret_scan_remediation_receipt_validation_rules_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-remediation-receipt-validation-rules-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptValidationRulesFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptValidationRulesFixtures(args);
    console.log(`Trading secret scan remediation receipt validation rules fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_validation_rules_fixtures_status}`);
    console.log(`Secret scan remediation receipt validation rule rows: ${result.summary.ready_secret_scan_remediation_receipt_validation_rule_count}/${result.summary.secret_scan_remediation_receipt_validation_rule_count}`);
    console.log(`Secret scan remediation receipt validation rules gates: ${result.summary.ready_secret_scan_remediation_receipt_validation_rules_gate_count}/${result.summary.secret_scan_remediation_receipt_validation_rules_gate_count}`);
    console.log(`Receipt payload present: ${result.summary.receipt_payload_present}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildValidationRuleRows(receiptIntake) {
  const sourceReady = receiptIntake.validation.valid && receiptIntake.summary.trading_secret_scan_remediation_receipt_intake_fixtures_status === SOURCE_READY_STATUS;
  return receiptIntake.secret_scan_remediation_receipt_intake_queue_rows.map((queueRow, index) => {
    const rulesReady = sourceReady && queueRow.queue_status === SOURCE_QUEUE_STATUS;
    const row = {
      schema_version: "trading-secret-scan-remediation-receipt-validation-rule-row.v1",
      secret_scan_remediation_receipt_validation_rule_row_id: `trading-secret-scan-remediation-receipt-validation-rules.row.${queueRow.template_key}`,
      phase_slot: PHASE_SLOT,
      source_receipt_intake_queue_row_id: queueRow.receipt_intake_queue_row_id,
      source_receipt_template_id: queueRow.source_receipt_template_id,
      template_key: queueRow.template_key,
      intake_key: queueRow.intake_key,
      source_queue_status: queueRow.queue_status,
      source_secret_scan_remediation_receipt_intake_status: receiptIntake.summary.trading_secret_scan_remediation_receipt_intake_fixtures_status,
      secret_scan_remediation_receipt_validation_rules_status: rulesReady ? READY_STATUS : "blocked",
      required_receipt_fields: queueRow.required_receipt_fields ?? [],
      required_receipt_field_count: (queueRow.required_receipt_fields ?? []).length,
      allowed_outcomes: queueRow.allowed_outcomes ?? [],
      allowed_outcome_count: (queueRow.allowed_outcomes ?? []).length,
      required_validation_rules: REQUIRED_VALIDATION_RULES,
      future_receipt_validation_required: true,
      receipt_queue_consumed_in_memory: true,
      receipt_queue_artifact_read_performed_by_rules: false,
      receipt_payload_present: false,
      ready_to_validate_receipt_payload: false,
      receipt_received_by_rules: false,
      receipt_validated_by_rules: false,
      receipt_application_performed_by_rules: false,
      approval_applied_by_rules: false,
      secret_values_read_by_rules: false,
      env_file_read_by_rules: false,
      desktop_config_content_inspected_by_rules: false,
      desktop_config_read_by_rules: false,
      raw_secret_material_materialized_by_rules: false,
      raw_secret_material_exposed_by_rules: false,
      provider_key_material_present_by_rules: false,
      forbidden_receipt_fields_allowed_by_rules: false,
      auto_fix_command_registered_by_rules: false,
      auto_redaction_allowed_by_rules: false,
      auto_deletion_allowed_by_rules: false,
      auto_rotation_allowed_by_rules: false,
      credential_lookup_allowed_by_rules: false,
      plaintext_secret_allowed_by_rules: false,
      model_context_secret_allowed_by_rules: false,
      broker_write_allowed_by_rules: false,
      exchange_write_allowed_by_rules: false,
      command_execution_performed_by_rules: false,
      artifact_read_performed_by_rules: false,
      artifact_write_performed_by_rules: false,
      release_published_by_rules: false,
      git_operation_performed_by_rules: false,
      protected_action_executed_by_rules: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Validation rules are declared for future ${queueRow.template_key} receipts; this row does not receive, validate, or apply a receipt payload.`,
    };
    return withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_validation_rule_hash");
  });
}

function buildValidationRuleSummaryRows(ruleRows) {
  return ruleRows.map((ruleRow, index) => {
    const row = {
      schema_version: "trading-secret-scan-remediation-receipt-validation-rule-summary-row.v1",
      secret_scan_remediation_receipt_validation_rule_summary_row_id: `trading-secret-scan-remediation-receipt-validation-rules.summary.${ruleRow.template_key}`,
      phase_slot: PHASE_SLOT,
      template_key: ruleRow.template_key,
      intake_key: ruleRow.intake_key,
      receipt_validation_rules_status: ruleRow.secret_scan_remediation_receipt_validation_rules_status,
      required_receipt_field_count: ruleRow.required_receipt_field_count,
      allowed_outcome_count: ruleRow.allowed_outcome_count,
      required_validation_rule_count: ruleRow.required_validation_rules.length,
      future_receipt_validation_required: ruleRow.future_receipt_validation_required,
      receipt_payload_present: ruleRow.receipt_payload_present,
      receipt_validated_by_rules: ruleRow.receipt_validated_by_rules,
      approval_applied_by_rules: ruleRow.approval_applied_by_rules,
      secret_values_read_by_rules: ruleRow.secret_values_read_by_rules,
      summary_status: ruleRow.secret_scan_remediation_receipt_validation_rules_status === READY_STATUS ? "future_receipt_validation_rules_ready" : "blocked",
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_validation_rule_summary_hash");
  });
}

function buildValidationRulesCoverage({ receiptIntake, validationRuleRows, summaryRows }) {
  const sourceReady = receiptIntake.validation.valid && receiptIntake.summary.trading_secret_scan_remediation_receipt_intake_fixtures_status === SOURCE_READY_STATUS;
  const sourceQueueRows = receiptIntake.secret_scan_remediation_receipt_intake_queue_rows ?? [];
  const sourceIntakeKeys = sourceQueueRows.map((row) => row.intake_key);
  const ruleIntakeKeys = validationRuleRows.map((row) => row.intake_key);
  const allIntakeRowsCovered = sourceIntakeKeys.length > 0 && sourceIntakeKeys.every((key) => ruleIntakeKeys.includes(key));
  const noForbiddenReceiptFields = validationRuleRows.every((row) => !includesAny(JSON.stringify(row.required_receipt_fields), FORBIDDEN_RECEIPT_FIELD_SNIPPETS));
  const requiredFieldsCopied = validationRuleRows.every((row) => row.required_receipt_fields.length >= 8 && row.allowed_outcomes.length >= 3);
  const noReceiptPayloadOrApplication = validationRuleRows.every((row) => row.receipt_payload_present === false
    && row.receipt_received_by_rules === false
    && row.receipt_validated_by_rules === false
    && row.receipt_application_performed_by_rules === false
    && row.approval_applied_by_rules === false);
  const noSecretMaterialRead = receiptIntake.summary.no_secret_material_read === true
    && receiptIntake.summary.secret_values_read === false
    && receiptIntake.summary.env_file_read === false
    && receiptIntake.summary.desktop_config_content_inspected === false
    && receiptIntake.summary.desktop_config_read === false
    && validationRuleRows.every((row) => row.secret_values_read_by_rules === false
      && row.env_file_read_by_rules === false
      && row.desktop_config_content_inspected_by_rules === false
      && row.desktop_config_read_by_rules === false);
  const noSecretOrTradingMutation = receiptIntake.summary.no_secret_or_trading_mutation === true
    && validationRuleRows.every((row) => row.auto_fix_command_registered_by_rules === false
      && row.auto_redaction_allowed_by_rules === false
      && row.auto_deletion_allowed_by_rules === false
      && row.auto_rotation_allowed_by_rules === false
      && row.credential_lookup_allowed_by_rules === false
      && row.broker_write_allowed_by_rules === false
      && row.exchange_write_allowed_by_rules === false
      && row.command_execution_performed_by_rules === false
      && row.artifact_write_performed_by_rules === false
      && row.protected_action_executed_by_rules === false);
  return {
    p430_ready: sourceReady,
    source_intake_queue_count: sourceQueueRows.length,
    validation_rule_count: validationRuleRows.length,
    validation_rule_summary_count: summaryRows.length,
    expected_validation_rule_count: sourceQueueRows.length,
    all_intake_rows_covered: allIntakeRowsCovered,
    all_validation_rules_ready: validationRuleRows.every((row) => row.secret_scan_remediation_receipt_validation_rules_status === READY_STATUS),
    validation_rules_declared: validationRuleRows.every((row) => row.required_validation_rules.length === REQUIRED_VALIDATION_RULES.length && row.future_receipt_validation_required),
    required_receipt_fields_copied: requiredFieldsCopied,
    allowed_outcomes_copied: validationRuleRows.every((row) => row.allowed_outcomes.length >= 3),
    no_forbidden_receipt_fields: noForbiddenReceiptFields,
    no_receipt_payload_or_application: noReceiptPayloadOrApplication,
    no_secret_material_read: noSecretMaterialRead,
    no_secret_or_trading_mutation: noSecretOrTradingMutation,
  };
}

function buildValidationRulesAnchor(receiptIntake, coverage) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-validation-rules-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_intake_fixtures_id: receiptIntake.trading_secret_scan_remediation_receipt_intake_fixtures_id,
    source_secret_scan_remediation_receipt_intake_status: receiptIntake.summary.trading_secret_scan_remediation_receipt_intake_fixtures_status,
    expected_validation_rule_count: coverage.expected_validation_rule_count,
    required_validation_rule_count: REQUIRED_VALIDATION_RULES.length,
    coverage_hash: hashValue(coverage),
    source_hash: hashValue({
      id: receiptIntake.trading_secret_scan_remediation_receipt_intake_fixtures_id,
      status: receiptIntake.summary.trading_secret_scan_remediation_receipt_intake_fixtures_status,
      queue_rows: receiptIntake.summary.secret_scan_remediation_receipt_intake_queue_count,
      gates: receiptIntake.summary.secret_scan_remediation_receipt_intake_gate_count,
    }),
  };
}

function buildValidationRulesBoundary({ generatedAt, writeRequested, receiptIntake, validationRuleRows, summaryRows, coverage }) {
  const sourceSummary = receiptIntake.summary;
  return {
    schema_version: "trading-secret-scan-remediation-receipt-validation-rules-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_scan_remediation_receipt_validation_rules_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_receipt_intake_status: sourceSummary.trading_secret_scan_remediation_receipt_intake_fixtures_status,
    source_secret_scan_remediation_receipt_intake_ready: coverage.p430_ready,
    secret_scan_remediation_receipt_validation_rule_count: validationRuleRows.length,
    ready_secret_scan_remediation_receipt_validation_rule_count: validationRuleRows.filter((row) => row.secret_scan_remediation_receipt_validation_rules_status === READY_STATUS).length,
    secret_scan_remediation_receipt_validation_rule_summary_count: summaryRows.length,
    all_intake_rows_covered: coverage.all_intake_rows_covered,
    validation_rules_declared: coverage.validation_rules_declared,
    required_validation_rule_count: REQUIRED_VALIDATION_RULES.length,
    required_receipt_fields_copied: coverage.required_receipt_fields_copied,
    allowed_outcomes_copied: coverage.allowed_outcomes_copied,
    no_forbidden_receipt_fields: coverage.no_forbidden_receipt_fields,
    receipt_queue_consumed_in_memory: true,
    receipt_queue_artifact_read_performed: false,
    receipt_payload_present: false,
    ready_to_validate_receipt_payload: false,
    receipt_received: false,
    receipt_validated: false,
    receipt_application_performed: false,
    receipt_applied: false,
    approval_applied: false,
    source_receipt_payload_received: sourceSummary.receipt_payload_received,
    source_receipt_validated: sourceSummary.receipt_validated,
    source_receipt_applied: sourceSummary.receipt_applied,
    source_approval_applied: sourceSummary.approval_applied,
    no_receipt_payload_or_application: coverage.no_receipt_payload_or_application,
    no_secret_material_read: coverage.no_secret_material_read,
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    desktop_config_read: false,
    raw_secret_material_materialized: false,
    raw_secret_material_exposed: false,
    provider_key_material_present: false,
    forbidden_receipt_fields_allowed: false,
    no_secret_or_trading_mutation: coverage.no_secret_or_trading_mutation,
    auto_fix_command_registered: false,
    auto_redaction_allowed: false,
    auto_deletion_allowed: false,
    auto_rotation_allowed: false,
    credential_lookup_allowed: false,
    plaintext_secret_allowed: false,
    model_context_secret_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    command_execution_performed: false,
    package_command_execution_performed: false,
    release_check_execution_performed: false,
    artifact_read_performed: false,
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationRulesGateRows({ receiptIntake, packageJson, platformOpsLedger, boundary, coverage }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const gateInputs = [
    ["p430_secret_scan_remediation_receipt_intake_ready", "P430 secret scan remediation receipt intake source is ready.", receiptIntake.validation.valid && receiptIntake.summary.trading_secret_scan_remediation_receipt_intake_fixtures_status === SOURCE_READY_STATUS],
    ["platform_package_script_registered", "package.json registers the P431 trading secret scan remediation receipt validation rules fixtures command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0],
    ["platform_validation_chain_registered", "Validation chain includes the P431 trading secret scan remediation receipt validation rules fixtures command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)],
    ["p431_ledger_acceptance_declared", "P431 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P431: `trading:secret-scan-remediation-receipt-validation-rules-fixtures`")],
    ["all_intake_rows_covered", "Every P430 intake queue row has a matching validation-rule row.", coverage.all_intake_rows_covered],
    ["validation_rules_declared", "Future validation rules are declared for each queued receipt.", coverage.validation_rules_declared],
    ["receipt_fields_safe", "Required receipt fields and outcomes are copied without forbidden secret-material fields.", coverage.required_receipt_fields_copied && coverage.allowed_outcomes_copied && coverage.no_forbidden_receipt_fields],
    ["no_receipt_payload_or_application", "No receipt payload is received, validated, applied, or converted into approval.", boundary.no_receipt_payload_or_application && !boundary.receipt_payload_present && !boundary.receipt_validated && !boundary.approval_applied],
    ["no_secret_material_read", "P431 reads no secret values, env files, or Desktop config content.", boundary.no_secret_material_read && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read],
    ["no_secret_or_trading_mutation", "P431 performs no credential lookup, trading writes, artifact mutation, release, git, or protected action.", boundary.no_secret_or_trading_mutation && !boundary.artifact_write_performed && !boundary.protected_action_executed],
  ];
  return gateInputs.map(([rowKey, description, passed], index) => withOrdinalAndHash(gateRow(rowKey, description, passed), index, "secret_scan_remediation_receipt_validation_rules_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-validation-rules-gate-row.v1",
    secret_scan_remediation_receipt_validation_rules_gate_row_id: `trading-secret-scan-remediation-receipt-validation-rules-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_payload_received_by_gate: false,
    receipt_validated_by_gate: false,
    receipt_applied_by_gate: false,
    approval_applied_by_gate: false,
    secret_values_read_by_gate: false,
    env_file_read_by_gate: false,
    desktop_config_content_inspected_by_gate: false,
    desktop_config_read_by_gate: false,
    raw_secret_material_materialized_by_gate: false,
    raw_secret_material_exposed_by_gate: false,
    provider_key_material_present_by_gate: false,
    auto_fix_command_registered_by_gate: false,
    auto_redaction_allowed_by_gate: false,
    auto_deletion_allowed_by_gate: false,
    auto_rotation_allowed_by_gate: false,
    credential_lookup_allowed_by_gate: false,
    plaintext_secret_allowed_by_gate: false,
    broker_write_allowed_by_gate: false,
    exchange_write_allowed_by_gate: false,
    command_execution_performed_by_gate: false,
    artifact_write_performed_by_gate: false,
    release_published_by_gate: false,
    git_operation_performed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ receiptIntake, packageJson, platformOpsLedger, validationRuleRows, summaryRows, gateRows, boundary, coverage }) {
  return [
    validationItem("source.secret_scan_remediation_receipt_intake", "p430_secret_scan_remediation_receipt_intake_ready", receiptIntake.validation.valid && receiptIntake.summary.trading_secret_scan_remediation_receipt_intake_fixtures_status === SOURCE_READY_STATUS, "P430 secret scan remediation receipt intake fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P431 secret scan remediation receipt validation rules fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("secret_scan_remediation_receipt_validation_rule_rows", "validation_rule_rows_ready", validationRuleRows.length === coverage.expected_validation_rule_count && validationRuleRows.length === 5 && validationRuleRows.every((row) => row.secret_scan_remediation_receipt_validation_rules_status === READY_STATUS), "All secret scan remediation receipt validation rule rows must be ready."),
    validationItem("secret_scan_remediation_receipt_validation_rule_summary_rows", "validation_rule_summary_rows_ready", summaryRows.length === validationRuleRows.length && summaryRows.every((row) => row.summary_status === "future_receipt_validation_rules_ready"), "All validation rule summary rows must be ready."),
    validationItem("secret_scan_remediation_receipt_validation_rules_gate_rows", "validation_rules_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P431 secret scan remediation receipt validation rules gates are ready."),
    validationItem("coverage.all_intake_rows_covered", "all_intake_rows_covered", coverage.all_intake_rows_covered, "All P430 receipt intake rows must have validation-rule rows."),
    validationItem("coverage.validation_rules_declared", "validation_rules_declared", coverage.validation_rules_declared, "Future receipt validation rules must be declared."),
    validationItem("coverage.receipt_fields_safe", "receipt_fields_safe", coverage.required_receipt_fields_copied && coverage.allowed_outcomes_copied && coverage.no_forbidden_receipt_fields, "Receipt validation rule fields must be copied and avoid secret material fields."),
    validationItem("boundary.no_receipt_payload", "no_receipt_payload_or_application", boundary.no_receipt_payload_or_application && !boundary.receipt_payload_present && !boundary.receipt_validated && !boundary.approval_applied, "P431 must not receive, validate, apply, or approve receipt payloads."),
    validationItem("boundary.no_secret_material_read", "no_secret_material_read", boundary.no_secret_material_read && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read, "P431 reads no secret values, env files, or Desktop config content."),
    validationItem("boundary.no_mutation", "no_secret_or_trading_mutation", boundary.no_secret_or_trading_mutation && !boundary.credential_lookup_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.artifact_write_performed && !boundary.protected_action_executed, "P431 performs no credential lookup, trading mutation, artifact mutation, or protected action."),
  ];
}

function buildSummary({ receiptIntake, validationRuleRows, summaryRows, gateRows, boundary, coverage, validation }) {
  return {
    trading_secret_scan_remediation_receipt_validation_rules_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_intake_status: receiptIntake.summary.trading_secret_scan_remediation_receipt_intake_fixtures_status,
    source_secret_scan_remediation_receipt_intake_ready: boundary.source_secret_scan_remediation_receipt_intake_ready,
    expected_validation_rule_count: coverage.expected_validation_rule_count,
    secret_scan_remediation_receipt_validation_rule_count: validationRuleRows.length,
    ready_secret_scan_remediation_receipt_validation_rule_count: boundary.ready_secret_scan_remediation_receipt_validation_rule_count,
    secret_scan_remediation_receipt_validation_rule_summary_count: summaryRows.length,
    ready_secret_scan_remediation_receipt_validation_rule_summary_count: summaryRows.filter((row) => row.summary_status === "future_receipt_validation_rules_ready").length,
    secret_scan_remediation_receipt_validation_rules_gate_count: gateRows.length,
    ready_secret_scan_remediation_receipt_validation_rules_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    required_validation_rule_count: boundary.required_validation_rule_count,
    all_intake_rows_covered: boundary.all_intake_rows_covered,
    validation_rules_declared: boundary.validation_rules_declared,
    required_receipt_fields_copied: boundary.required_receipt_fields_copied,
    allowed_outcomes_copied: boundary.allowed_outcomes_copied,
    no_forbidden_receipt_fields: boundary.no_forbidden_receipt_fields,
    no_receipt_payload_or_application: boundary.no_receipt_payload_or_application,
    no_secret_material_read: boundary.no_secret_material_read,
    no_secret_or_trading_mutation: boundary.no_secret_or_trading_mutation,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    receipt_payload_present: boundary.receipt_payload_present,
    ready_to_validate_receipt_payload: boundary.ready_to_validate_receipt_payload,
    receipt_received: boundary.receipt_received,
    receipt_validated: boundary.receipt_validated,
    receipt_application_performed: boundary.receipt_application_performed,
    receipt_applied: boundary.receipt_applied,
    approval_applied: boundary.approval_applied,
    secret_values_read: boundary.secret_values_read,
    env_file_read: boundary.env_file_read,
    desktop_config_content_inspected: boundary.desktop_config_content_inspected,
    desktop_config_read: boundary.desktop_config_read,
    raw_secret_material_materialized: boundary.raw_secret_material_materialized,
    raw_secret_material_exposed: boundary.raw_secret_material_exposed,
    provider_key_material_present: boundary.provider_key_material_present,
    forbidden_receipt_fields_allowed: boundary.forbidden_receipt_fields_allowed,
    auto_fix_command_registered: boundary.auto_fix_command_registered,
    auto_redaction_allowed: boundary.auto_redaction_allowed,
    auto_deletion_allowed: boundary.auto_deletion_allowed,
    auto_rotation_allowed: boundary.auto_rotation_allowed,
    credential_lookup_allowed: boundary.credential_lookup_allowed,
    plaintext_secret_allowed: boundary.plaintext_secret_allowed,
    model_context_secret_allowed: boundary.model_context_secret_allowed,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    command_execution_performed: boundary.command_execution_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    protected_action_executed: boundary.protected_action_executed,
    human_review_required: boundary.human_review_required,
    human_signoff_required: boundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Secret Scan Remediation Receipt Validation Rules Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_validation_rules_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source receipt intake: ${result.summary.source_secret_scan_remediation_receipt_intake_status}`,
    `Validation rule rows: ${result.summary.ready_secret_scan_remediation_receipt_validation_rule_count}/${result.summary.secret_scan_remediation_receipt_validation_rule_count}`,
    `Validation rule gates: ${result.summary.ready_secret_scan_remediation_receipt_validation_rules_gate_count}/${result.summary.secret_scan_remediation_receipt_validation_rules_gate_count}`,
    "",
    "## Rule Rows",
    "",
    ...result.secret_scan_remediation_receipt_validation_rule_rows.map((row) => `- ${row.template_key}: ${row.secret_scan_remediation_receipt_validation_rules_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_scan_remediation_receipt_validation_rules_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_RULES_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-template-schema") parsed.secretScanRemediationReceiptTemplateSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-intake-schema") parsed.secretScanRemediationReceiptIntakeSchemaPath = argv[++index];
    else if (arg === "--control-plane-human-gate-receipts") parsed.controlPlaneHumanGateReceiptsPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else {
      parsed.__passthrough ??= [];
      parsed.__passthrough.push(arg);
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-validation-rules-fixtures.mjs [options]

Options:
  --out-dir <folder>                                           Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_RULES_FIXTURES_OUT_DIR}
  --run-at <iso>                                               Deterministic generated_at timestamp.
  --package <path>                                             package.json path.
  --platform-ops-ledger <path>                                 P341-P500 platform operations ledger path.
  --secret-scan-remediation-receipt-template-schema <path>     P429 receipt template fixtures schema path.
  --secret-scan-remediation-receipt-intake-schema <path>       P430 receipt intake fixtures schema path.
  --control-plane-human-gate-receipts <path>                   Control-plane human gate receipts source path.
  --schema <path>                                              Output schema path.
  --check                                                      Validate only, do not write artifacts.
  -h, --help                                                   Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.platformOpsLedgerPath),
    control_plane_human_gate_receipts_path: path.resolve(options.controlPlaneHumanGateReceiptsPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.controlPlaneHumanGateReceiptsPath),
    secret_scan_remediation_receipt_template_schema_path: path.resolve(options.secretScanRemediationReceiptTemplateSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.secretScanRemediationReceiptTemplateSchemaPath),
    secret_scan_remediation_receipt_intake_schema_path: path.resolve(options.secretScanRemediationReceiptIntakeSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.secretScanRemediationReceiptIntakeSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.schemaPath),
  };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, count: rows.length, [key]: rows };
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function withOrdinalAndHash(row, index, hashField) {
  const withoutHash = { ...row, ordinal: index + 1 };
  return { ...withoutHash, [hashField]: hashValue(withoutHash) };
}

function validationItem(pathValue, rule, passed, message) {
  return { path: pathValue, rule, status: passed ? "passed" : "failed", message };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({ path: item.path, message: item.message, rule: item.rule }));
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function includesAny(value, snippets) {
  return snippets.some((snippet) => value.includes(snippet));
}

async function readJsonSource(filePath) {
  try {
    return { path: path.resolve(filePath), available: true, data: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return { path: path.resolve(filePath), available: false, error: error.message, data: null };
  }
}

async function readTextSource(filePath) {
  try {
    return { path: path.resolve(filePath), available: true, text: await readFile(filePath, "utf8") };
  } catch (error) {
    return { path: path.resolve(filePath), available: false, error: error.message, text: "" };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dateStamp(isoDate) {
  return isoDate.slice(0, 10).replaceAll("-", "");
}
