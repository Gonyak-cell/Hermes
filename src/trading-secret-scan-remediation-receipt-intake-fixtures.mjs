import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_TEMPLATE_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationReceiptTemplateFixtures,
} from "./trading-secret-scan-remediation-receipt-template-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_INTAKE_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-intake-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_INTAKE_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_TEMPLATE_FIXTURES_INPUTS,
  secretScanRemediationReceiptTemplateSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_TEMPLATE_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-intake-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-intake-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_intake_fixtures";
const PHASE_SLOT = "P430";
const PREVIOUS_PHASE_SLOT = "P429";
const NEXT_PHASE_SLOT = "P431";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_intake";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_template";
const COMMAND_NAME = "trading:secret-scan-remediation-receipt-intake-fixtures";
const REQUIRED_ROW_KEYS = [
  "p429_secret_scan_remediation_receipt_template_ready",
  "intake_review_findings_pending",
  "intake_external_removal_pending",
  "intake_external_rotation_pending",
  "intake_clean_rerun_pending",
  "intake_human_closeout_pending",
  "intake_no_receipt_payload",
  "intake_no_secret_or_mutation",
];
const TEMPLATE_TO_INTAKE_KEYS = {
  review_findings_reference: "intake_review_findings_pending",
  external_removal_reference: "intake_external_removal_pending",
  external_rotation_reference: "intake_external_rotation_pending",
  clean_rerun_reference: "intake_clean_rerun_pending",
  human_closeout_decision: "intake_human_closeout_pending",
};

export async function runTradingSecretScanRemediationReceiptIntakeFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptIntakeFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptIntakeFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt intake fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptIntakeFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_INTAKE_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const receiptTemplate = await buildTradingSecretScanRemediationReceiptTemplateFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    controlPlaneHumanGateReceiptsPath: inputs.control_plane_human_gate_receipts_path,
    schemaPath: inputs.secret_scan_remediation_receipt_template_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const intakeRows = buildIntakeQueueRows(receiptTemplate.secret_scan_remediation_receipt_templates ?? [], generatedAt);
  const sources = { packageJson, platformOpsLedger };
  const sourceReady = receiptTemplate.validation.valid && receiptTemplate.summary.trading_secret_scan_remediation_receipt_template_fixtures_status === SOURCE_READY_STATUS;
  const coverage = buildIntakeCoverage({ receiptTemplate, intakeRows });
  const anchor = buildIntakeAnchor(receiptTemplate, coverage);
  const rows = buildIntakeRows({ sourceReady, receiptTemplate, coverage });
  const boundary = buildIntakeBoundary({ generatedAt, writeRequested: options.write !== false, sourceReady, receiptTemplate, intakeRows, rows, coverage });
  const gateRows = buildIntakeGateRows({ receiptTemplate, packageJson, platformOpsLedger, boundary });
  const validationItems = buildValidationItems({ receiptTemplate, sources, rows, gateRows, boundary, coverage });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ receiptTemplate, intakeRows, rows, gateRows, boundary, coverage, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_scan_remediation_receipt_intake_fixtures_id: `trading-secret-scan-remediation-receipt-intake-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_scan_remediation_receipt_intake_anchor: anchor,
    secret_scan_remediation_receipt_intake_queue_rows: intakeRows,
    secret_scan_remediation_receipt_intake_rows: rows,
    secret_scan_remediation_receipt_intake_gate_rows: gateRows,
    secret_scan_remediation_receipt_intake_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_intake_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ receiptTemplate, intakeRows, rows, gateRows, boundary, coverage, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_intake_fixtures_id = result.trading_secret_scan_remediation_receipt_intake_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptIntakeFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-intake-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-intake-queue-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-intake-queue-rows.v1", "secret_scan_remediation_receipt_intake_queue_rows", result.secret_scan_remediation_receipt_intake_queue_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-intake-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-intake-rows.v1", "secret_scan_remediation_receipt_intake_rows", result.secret_scan_remediation_receipt_intake_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-intake-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-intake-gate-rows.v1", "secret_scan_remediation_receipt_intake_gate_rows", result.secret_scan_remediation_receipt_intake_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-intake-boundary.json"), result.secret_scan_remediation_receipt_intake_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-remediation-receipt-intake-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptIntakeFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptIntakeFixtures(args);
    console.log(`Trading secret scan remediation receipt intake fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_intake_fixtures_status}`);
    console.log(`Secret scan remediation receipt intake queue rows: ${result.summary.ready_secret_scan_remediation_receipt_intake_queue_count}/${result.summary.secret_scan_remediation_receipt_intake_queue_count}`);
    console.log(`Secret scan remediation receipt intake rows: ${result.summary.ready_secret_scan_remediation_receipt_intake_row_count}/${result.summary.secret_scan_remediation_receipt_intake_row_count}`);
    console.log(`Secret scan remediation receipt intake gates: ${result.summary.ready_secret_scan_remediation_receipt_intake_gate_count}/${result.summary.secret_scan_remediation_receipt_intake_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildIntakeQueueRows(templates, generatedAt) {
  return templates.map((template, index) => {
    const queueRow = {
      schema_version: "trading-secret-scan-remediation-receipt-intake-queue-row.v1",
      receipt_intake_queue_row_id: `trading-secret-scan-remediation-receipt-intake.queue.${template.template_key}`,
      phase_slot: PHASE_SLOT,
      source_receipt_template_id: template.receipt_template_id,
      template_key: template.template_key,
      intake_key: TEMPLATE_TO_INTAKE_KEYS[template.template_key] ?? `intake.${template.template_key}`,
      queue_status: "pending_human_input",
      generated_at: generatedAt,
      required_receipt_fields: template.required_receipt_fields ?? [],
      allowed_outcomes: template.allowed_outcomes ?? [],
      receipt_payload_received: false,
      receipt_validated: false,
      receipt_applied: false,
      approval_applied: false,
      secret_values_read: false,
      env_file_read: false,
      desktop_config_content_inspected: false,
      desktop_config_read: false,
      raw_secret_material_materialized: false,
      raw_secret_material_exposed: false,
      provider_key_material_present: false,
      auto_fix_command_registered: false,
      auto_redaction_allowed: false,
      auto_deletion_allowed: false,
      auto_rotation_allowed: false,
      credential_lookup_allowed: false,
      broker_write_allowed: false,
      exchange_write_allowed: false,
      command_execution_performed: false,
      artifact_write_performed: false,
      release_published: false,
      git_operation_performed: false,
      protected_action_executed: false,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(queueRow, index, "receipt_intake_queue_hash");
  });
}

function buildIntakeCoverage({ receiptTemplate, intakeRows }) {
  const intakeKeys = intakeRows.map((row) => row.intake_key);
  const expectedKeys = Object.values(TEMPLATE_TO_INTAKE_KEYS);
  const allExpectedIntakesQueued = expectedKeys.every((key) => intakeKeys.includes(key));
  const allRowsPending = intakeRows.every((row) => row.queue_status === "pending_human_input");
  const allRowsReferenceTemplates = intakeRows.every((row) => typeof row.source_receipt_template_id === "string" && row.source_receipt_template_id.includes("receipt-template"));
  const noReceiptPayloadOrApplication = intakeRows.every((row) => row.receipt_payload_received === false && row.receipt_validated === false && row.receipt_applied === false && row.approval_applied === false);
  const noQueueMutation = intakeRows.every((row) => row.auto_fix_command_registered === false
    && row.auto_redaction_allowed === false
    && row.auto_deletion_allowed === false
    && row.auto_rotation_allowed === false
    && row.credential_lookup_allowed === false
    && row.broker_write_allowed === false
    && row.exchange_write_allowed === false
    && row.command_execution_performed === false
    && row.artifact_write_performed === false
    && row.protected_action_executed === false);
  return {
    p429_ready: receiptTemplate.validation.valid && receiptTemplate.summary.trading_secret_scan_remediation_receipt_template_fixtures_status === SOURCE_READY_STATUS,
    expected_intake_queue_count: expectedKeys.length,
    intake_queue_count: intakeRows.length,
    intake_keys: intakeKeys,
    all_expected_intakes_queued: allExpectedIntakesQueued,
    all_intake_rows_pending_human_input: allRowsPending,
    all_intake_rows_reference_templates: allRowsReferenceTemplates,
    no_receipt_payload_or_application: noReceiptPayloadOrApplication,
    no_secret_material_read: receiptTemplate.summary.no_secret_material_read === true
      && receiptTemplate.summary.secret_values_read === false
      && receiptTemplate.summary.env_file_read === false
      && receiptTemplate.summary.desktop_config_content_inspected === false
      && receiptTemplate.summary.desktop_config_read === false
      && intakeRows.every((row) => row.secret_values_read === false && row.env_file_read === false && row.desktop_config_content_inspected === false && row.desktop_config_read === false),
    no_secret_or_trading_mutation: receiptTemplate.summary.no_secret_or_trading_mutation === true
      && receiptTemplate.summary.credential_lookup_allowed === false
      && receiptTemplate.summary.broker_write_allowed === false
      && receiptTemplate.summary.exchange_write_allowed === false
      && receiptTemplate.summary.artifact_write_performed === false
      && receiptTemplate.summary.protected_action_executed === false
      && noQueueMutation,
  };
}

function buildIntakeAnchor(receiptTemplate, coverage) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-intake-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_template_fixtures_id: receiptTemplate.trading_secret_scan_remediation_receipt_template_fixtures_id,
    source_secret_scan_remediation_receipt_template_status: receiptTemplate.summary.trading_secret_scan_remediation_receipt_template_fixtures_status,
    required_row_count: REQUIRED_ROW_KEYS.length,
    required_row_keys: REQUIRED_ROW_KEYS,
    expected_intake_queue_count: coverage.expected_intake_queue_count,
    coverage_hash: hashValue(coverage),
    source_hash: hashValue({
      id: receiptTemplate.trading_secret_scan_remediation_receipt_template_fixtures_id,
      status: receiptTemplate.summary.trading_secret_scan_remediation_receipt_template_fixtures_status,
      template_count: receiptTemplate.summary.secret_scan_remediation_receipt_template_count,
      gate_count: receiptTemplate.summary.secret_scan_remediation_receipt_template_gate_count,
    }),
  };
}

function buildIntakeRows({ sourceReady, receiptTemplate, coverage }) {
  const rowInputs = [
    intakeRowInput("p429_secret_scan_remediation_receipt_template_ready", "trading_secret_scan_remediation_receipt_template", "summary", [
      condition("source.trading_secret_scan_remediation_receipt_template_fixtures_status", receiptTemplate.summary.trading_secret_scan_remediation_receipt_template_fixtures_status, SOURCE_READY_STATUS),
      condition("source.ready_secret_scan_remediation_receipt_template_count", receiptTemplate.summary.ready_secret_scan_remediation_receipt_template_count, 5),
      condition("source.no_receipt_payload_or_application", receiptTemplate.summary.no_receipt_payload_or_application, true),
    ]),
    ...Object.entries(TEMPLATE_TO_INTAKE_KEYS).map(([templateKey, rowKey]) => intakeRowInput(rowKey, "secret_scan_remediation_receipt_intake_queue", templateKey, [
      condition(`queue.${templateKey}.queued`, coverage.intake_keys.includes(rowKey), true),
      condition("queue.all_pending_human_input", coverage.all_intake_rows_pending_human_input, true),
      condition("queue.all_reference_templates", coverage.all_intake_rows_reference_templates, true),
    ])),
    intakeRowInput("intake_no_receipt_payload", "secret_scan_remediation_receipt_intake_boundary", "boundary", [
      condition("boundary.no_receipt_payload_or_application", coverage.no_receipt_payload_or_application, true),
    ]),
    intakeRowInput("intake_no_secret_or_mutation", "secret_scan_remediation_receipt_intake_boundary", "boundary", [
      condition("boundary.no_secret_material_read", coverage.no_secret_material_read, true),
      condition("boundary.no_secret_or_trading_mutation", coverage.no_secret_or_trading_mutation, true),
    ]),
  ];
  return rowInputs.map((input, index) => buildIntakeRow(input, sourceReady, index));
}

function intakeRowInput(rowKey, artifactId, evidencePath, observedConditions) {
  return { rowKey, artifactId, evidencePath, observedConditions };
}

function buildIntakeRow(input, sourceReady, index) {
  const unsafeConditions = input.observedConditions.filter((item) => item.observed_value !== item.expected_safe_value || !item.condition_present);
  const rowReady = sourceReady && unsafeConditions.length === 0;
  const row = {
    schema_version: "trading-secret-scan-remediation-receipt-intake-row.v1",
    secret_scan_remediation_receipt_intake_row_id: `trading-secret-scan-remediation-receipt-intake.row.${input.rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: input.rowKey,
    artifact_id: input.artifactId,
    evidence_path: input.evidencePath,
    observed_conditions: input.observedConditions,
    observed_condition_count: input.observedConditions.length,
    unsafe_condition_refs: unsafeConditions.map((item) => item.condition_path),
    secret_scan_remediation_receipt_intake_status: rowReady ? READY_STATUS : "blocked",
    source_secret_scan_remediation_receipt_template_ready: sourceReady,
    receipt_intake_queued: rowReady,
    receipt_payload_received: false,
    receipt_validated: false,
    receipt_applied: false,
    approval_applied: false,
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    desktop_config_read: false,
    raw_secret_material_materialized: false,
    raw_secret_material_exposed: false,
    provider_key_material_present: false,
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
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
  return withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_intake_hash");
}

function buildIntakeBoundary({ generatedAt, writeRequested, sourceReady, receiptTemplate, intakeRows, rows, coverage }) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-intake-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_scan_remediation_receipt_intake_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_receipt_template_status: receiptTemplate.summary.trading_secret_scan_remediation_receipt_template_fixtures_status,
    source_secret_scan_remediation_receipt_template_ready: sourceReady,
    secret_scan_remediation_receipt_intake_queue_count: intakeRows.length,
    ready_secret_scan_remediation_receipt_intake_queue_count: intakeRows.filter((row) => row.queue_status === "pending_human_input").length,
    secret_scan_remediation_receipt_intake_row_count: rows.length,
    ready_secret_scan_remediation_receipt_intake_row_count: rows.filter((row) => row.secret_scan_remediation_receipt_intake_status === READY_STATUS).length,
    all_expected_intakes_queued: coverage.all_expected_intakes_queued,
    all_intake_rows_pending_human_input: coverage.all_intake_rows_pending_human_input,
    all_intake_rows_reference_templates: coverage.all_intake_rows_reference_templates,
    no_receipt_payload_or_application: coverage.no_receipt_payload_or_application,
    no_secret_material_read: coverage.no_secret_material_read,
    no_secret_or_trading_mutation: coverage.no_secret_or_trading_mutation,
    receipt_payload_received: false,
    receipt_validated: false,
    receipt_applied: false,
    approval_applied: false,
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    desktop_config_read: false,
    raw_secret_material_materialized: false,
    raw_secret_material_exposed: false,
    provider_key_material_present: false,
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
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildIntakeGateRows({ receiptTemplate, packageJson, platformOpsLedger, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const gateInputs = [
    ["p429_secret_scan_remediation_receipt_template_ready", "P429 secret scan remediation receipt template source is ready.", receiptTemplate.validation.valid && receiptTemplate.summary.trading_secret_scan_remediation_receipt_template_fixtures_status === SOURCE_READY_STATUS],
    ["platform_package_script_registered", "package.json registers the P430 trading secret scan remediation receipt intake fixtures command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0],
    ["platform_validation_chain_registered", "Validation chain includes the P430 trading secret scan remediation receipt intake fixtures command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)],
    ["p430_ledger_acceptance_declared", "P430 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P430: `trading:secret-scan-remediation-receipt-intake-fixtures`")],
    ["all_expected_intakes_queued", "All P429 receipt templates are represented by pending intake rows.", boundary.all_expected_intakes_queued],
    ["all_intake_rows_pending_human_input", "Receipt intake rows stay pending human input.", boundary.all_intake_rows_pending_human_input],
    ["all_intake_rows_reference_templates", "Receipt intake rows reference the source templates.", boundary.all_intake_rows_reference_templates],
    ["no_receipt_payload_or_application", "No receipt payload is received, validated, applied, or converted into approval.", boundary.no_receipt_payload_or_application && !boundary.receipt_payload_received && !boundary.receipt_applied && !boundary.approval_applied],
    ["no_secret_material_read", "P430 reads no secret values, env files, or Desktop config content.", boundary.no_secret_material_read && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read],
    ["no_secret_or_trading_mutation", "P430 performs no credential lookup, trading writes, artifact mutation, release, git, or protected action.", boundary.no_secret_or_trading_mutation && !boundary.artifact_write_performed && !boundary.protected_action_executed],
  ];
  return gateInputs.map(([rowKey, description, passed], index) => withOrdinalAndHash(gateRow(rowKey, description, passed), index, "secret_scan_remediation_receipt_intake_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-intake-gate-row.v1",
    secret_scan_remediation_receipt_intake_gate_row_id: `trading-secret-scan-remediation-receipt-intake-fixtures.gate.${rowKey}`,
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
    protected_action_executed_by_gate: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ receiptTemplate, sources, rows, gateRows, boundary, coverage }) {
  return [
    validationItem("source.secret_scan_remediation_receipt_template", "p429_secret_scan_remediation_receipt_template_ready", receiptTemplate.validation.valid && receiptTemplate.summary.trading_secret_scan_remediation_receipt_template_fixtures_status === SOURCE_READY_STATUS, "P429 secret scan remediation receipt template fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", sources.packageJson.available, "package.json is readable for P430 secret scan remediation receipt intake fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", sources.platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("secret_scan_remediation_receipt_intake_rows", "secret_scan_remediation_receipt_intake_rows_ready", rows.length === REQUIRED_ROW_KEYS.length && REQUIRED_ROW_KEYS.every((rowKey) => rows.some((row) => row.row_key === rowKey)) && rows.every((row) => row.secret_scan_remediation_receipt_intake_status === READY_STATUS), "All secret scan remediation receipt intake rows must be ready."),
    validationItem("secret_scan_remediation_receipt_intake_gate_rows", "secret_scan_remediation_receipt_intake_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P430 secret scan remediation receipt intake gates are ready."),
    validationItem("coverage.intake_count", "all_expected_intakes_queued", coverage.intake_queue_count === coverage.expected_intake_queue_count && coverage.all_expected_intakes_queued, "Expected secret scan remediation receipt intakes must be queued."),
    validationItem("coverage.intake_pending", "all_intake_rows_pending_human_input", coverage.all_intake_rows_pending_human_input, "Receipt intake rows must stay pending human input."),
    validationItem("coverage.intake_references", "all_intake_rows_reference_templates", coverage.all_intake_rows_reference_templates, "Receipt intake rows must reference source templates."),
    validationItem("coverage.no_receipt_payload", "no_receipt_payload_or_application", coverage.no_receipt_payload_or_application, "P430 must not receive, validate, apply, or approve receipt payloads."),
    validationItem("boundary.no_secret_material_read", "no_secret_material_read", boundary.no_secret_material_read && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read, "P430 reads no secret values, env files, or Desktop config content."),
    validationItem("boundary.no_mutation", "no_secret_or_trading_mutation", boundary.no_secret_or_trading_mutation && !boundary.credential_lookup_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.artifact_write_performed && !boundary.protected_action_executed, "P430 performs no credential lookup, trading mutation, artifact mutation, or protected action."),
  ];
}

function buildSummary({ receiptTemplate, intakeRows, rows, gateRows, boundary, coverage, validation }) {
  return {
    trading_secret_scan_remediation_receipt_intake_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_template_status: receiptTemplate.summary.trading_secret_scan_remediation_receipt_template_fixtures_status,
    source_secret_scan_remediation_receipt_template_ready: boundary.source_secret_scan_remediation_receipt_template_ready,
    required_row_count: REQUIRED_ROW_KEYS.length,
    expected_intake_queue_count: coverage.expected_intake_queue_count,
    secret_scan_remediation_receipt_intake_queue_count: intakeRows.length,
    ready_secret_scan_remediation_receipt_intake_queue_count: boundary.ready_secret_scan_remediation_receipt_intake_queue_count,
    secret_scan_remediation_receipt_intake_row_count: rows.length,
    ready_secret_scan_remediation_receipt_intake_row_count: boundary.ready_secret_scan_remediation_receipt_intake_row_count,
    secret_scan_remediation_receipt_intake_gate_count: gateRows.length,
    ready_secret_scan_remediation_receipt_intake_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    all_expected_intakes_queued: boundary.all_expected_intakes_queued,
    all_intake_rows_pending_human_input: boundary.all_intake_rows_pending_human_input,
    all_intake_rows_reference_templates: boundary.all_intake_rows_reference_templates,
    no_receipt_payload_or_application: boundary.no_receipt_payload_or_application,
    no_secret_material_read: boundary.no_secret_material_read,
    no_secret_or_trading_mutation: boundary.no_secret_or_trading_mutation,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    receipt_payload_received: boundary.receipt_payload_received,
    receipt_validated: boundary.receipt_validated,
    receipt_applied: boundary.receipt_applied,
    approval_applied: boundary.approval_applied,
    secret_values_read: boundary.secret_values_read,
    env_file_read: boundary.env_file_read,
    desktop_config_content_inspected: boundary.desktop_config_content_inspected,
    desktop_config_read: boundary.desktop_config_read,
    raw_secret_material_materialized: boundary.raw_secret_material_materialized,
    raw_secret_material_exposed: boundary.raw_secret_material_exposed,
    provider_key_material_present: boundary.provider_key_material_present,
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
    "# Trading Secret Scan Remediation Receipt Intake Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_intake_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source receipt templates: ${result.summary.source_secret_scan_remediation_receipt_template_status}`,
    `Receipt intake queue rows: ${result.summary.ready_secret_scan_remediation_receipt_intake_queue_count}/${result.summary.secret_scan_remediation_receipt_intake_queue_count}`,
    `Receipt intake rows: ${result.summary.ready_secret_scan_remediation_receipt_intake_row_count}/${result.summary.secret_scan_remediation_receipt_intake_row_count}`,
    `Receipt intake gates: ${result.summary.ready_secret_scan_remediation_receipt_intake_gate_count}/${result.summary.secret_scan_remediation_receipt_intake_gate_count}`,
    "",
    "## Queue",
    "",
    ...result.secret_scan_remediation_receipt_intake_queue_rows.map((row) => `- ${row.intake_key}: ${row.queue_status}`),
    "",
    "## Rows",
    "",
    ...result.secret_scan_remediation_receipt_intake_rows.map((row) => `- ${row.row_key}: ${row.secret_scan_remediation_receipt_intake_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_scan_remediation_receipt_intake_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_INTAKE_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-template-schema") parsed.secretScanRemediationReceiptTemplateSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-intake-fixtures.mjs [options]

Options:
  --out-dir <folder>                                           Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_INTAKE_FIXTURES_OUT_DIR}
  --run-at <iso>                                               Deterministic generated_at timestamp.
  --package <path>                                             package.json path.
  --platform-ops-ledger <path>                                 P341-P500 platform operations ledger path.
  --secret-scan-remediation-receipt-template-schema <path>     P429 receipt template fixtures schema path.
  --control-plane-human-gate-receipts <path>                   Control-plane human gate receipts source path.
  --schema <path>                                              Output schema path.
  --check                                                      Validate only, do not write artifacts.
  -h, --help                                                   Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_INTAKE_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_INTAKE_FIXTURES_INPUTS.platformOpsLedgerPath),
    control_plane_human_gate_receipts_path: path.resolve(options.controlPlaneHumanGateReceiptsPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_INTAKE_FIXTURES_INPUTS.controlPlaneHumanGateReceiptsPath),
    secret_scan_remediation_receipt_template_schema_path: path.resolve(options.secretScanRemediationReceiptTemplateSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_INTAKE_FIXTURES_INPUTS.secretScanRemediationReceiptTemplateSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_INTAKE_FIXTURES_INPUTS.schemaPath),
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

function condition(conditionPath, observedValue, expectedSafeValue) {
  return {
    condition_path: conditionPath,
    expected_safe_value: expectedSafeValue,
    observed_value: observedValue,
    condition_present: typeof observedValue === "boolean" || typeof observedValue === "string" || typeof observedValue === "number",
    unsafe_when_not_safe: true,
  };
}

function validationItem(pathValue, rule, passed, message) {
  return { path: pathValue, rule, status: passed ? "passed" : "failed", message };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({ path: item.path, message: item.message, rule: item.rule }));
  return { valid: errors.length === 0, error_count: errors.length, errors };
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
