import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationFixtures,
} from "./trading-secret-scan-remediation-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_TEMPLATE_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-template-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_TEMPLATE_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_FIXTURES_INPUTS,
  secretScanRemediationSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_FIXTURES_INPUTS.schemaPath,
  controlPlaneHumanGateReceiptsPath: "src/control-plane-human-gate-receipts.mjs",
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-template-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-template-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_template_fixtures";
const PHASE_SLOT = "P429";
const PREVIOUS_PHASE_SLOT = "P428";
const NEXT_PHASE_SLOT = "P430";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_template";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation";
const COMMAND_NAME = "trading:secret-scan-remediation-receipt-template-fixtures";
const REQUIRED_ROW_KEYS = [
  "p428_secret_scan_remediation_ready",
  "template_review_findings_reference",
  "template_external_removal_reference",
  "template_external_rotation_reference",
  "template_clean_rerun_reference",
  "template_human_closeout_decision",
  "template_no_secret_material_fields",
  "template_no_receipt_or_mutation",
];
const REQUIRED_RECEIPT_FIELDS = [
  "receipt_status",
  "outcome",
  "decided_by",
  "decided_at",
  "reviewer",
  "decision_reference",
  "decision_notes",
  "completed_action_refs",
];
const TEMPLATE_DEFINITIONS = [
  {
    template_key: "review_findings_reference",
    title: "Review Secrets Scan Gate findings",
    remediation_step: "review_findings",
    additional_fields: ["finding_reference", "source_artifact_reference"],
    allowed_outcomes: ["reviewed", "request_changes", "defer"],
  },
  {
    template_key: "external_removal_reference",
    title: "Record external secret removal reference",
    remediation_step: "external_removal_reference",
    additional_fields: ["external_removal_reference", "external_system_reference"],
    allowed_outcomes: ["removed_externally", "request_changes", "defer"],
  },
  {
    template_key: "external_rotation_reference",
    title: "Record external secret rotation reference",
    remediation_step: "external_rotation_reference",
    additional_fields: ["external_rotation_reference", "external_system_reference"],
    allowed_outcomes: ["rotated_externally", "request_changes", "defer"],
  },
  {
    template_key: "clean_rerun_reference",
    title: "Record clean Secrets Scan Gate rerun reference",
    remediation_step: "clean_rerun_reference",
    additional_fields: ["clean_rerun_reference", "validation_report_reference"],
    allowed_outcomes: ["clean_rerun_confirmed", "request_changes", "defer"],
  },
  {
    template_key: "human_closeout_decision",
    title: "Record human remediation closeout decision",
    remediation_step: "human_closeout_decision",
    additional_fields: ["closeout_reference", "residual_risk_note"],
    allowed_outcomes: ["resolved", "rejected", "defer"],
  },
];
const FORBIDDEN_TEMPLATE_FIELD_SNIPPETS = [
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

export async function runTradingSecretScanRemediationReceiptTemplateFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptTemplateFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptTemplateFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt template fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptTemplateFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_TEMPLATE_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const secretScanRemediation = await buildTradingSecretScanRemediationFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    controlPlaneHumanGateReceiptsPath: inputs.control_plane_human_gate_receipts_path,
    schemaPath: inputs.secret_scan_remediation_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const controlPlaneHumanGateReceipts = await readTextSource(inputs.control_plane_human_gate_receipts_path);
  const templates = buildReceiptTemplates(generatedAt);
  const sources = { packageJson, platformOpsLedger, controlPlaneHumanGateReceipts };
  const sourceReady = secretScanRemediation.validation.valid && secretScanRemediation.summary.trading_secret_scan_remediation_fixtures_status === SOURCE_READY_STATUS;
  const coverage = buildReceiptTemplateCoverage({ secretScanRemediation, templates, sources });
  const anchor = buildReceiptTemplateAnchor(secretScanRemediation, coverage);
  const rows = buildReceiptTemplateRows({ sourceReady, secretScanRemediation, coverage });
  const boundary = buildReceiptTemplateBoundary({ generatedAt, writeRequested: options.write !== false, sourceReady, secretScanRemediation, templates, rows, coverage });
  const gateRows = buildReceiptTemplateGateRows({ secretScanRemediation, packageJson, platformOpsLedger, boundary });
  const validationItems = buildValidationItems({ secretScanRemediation, sources, rows, gateRows, boundary, coverage });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ secretScanRemediation, templates, rows, gateRows, boundary, coverage, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_scan_remediation_receipt_template_fixtures_id: `trading-secret-scan-remediation-receipt-template-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_scan_remediation_receipt_template_anchor: anchor,
    secret_scan_remediation_receipt_templates: templates,
    secret_scan_remediation_receipt_template_rows: rows,
    secret_scan_remediation_receipt_template_gate_rows: gateRows,
    secret_scan_remediation_receipt_template_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_template_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ secretScanRemediation, templates, rows, gateRows, boundary, coverage, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_template_fixtures_id = result.trading_secret_scan_remediation_receipt_template_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptTemplateFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-template-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-templates.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-templates.v1", "secret_scan_remediation_receipt_templates", result.secret_scan_remediation_receipt_templates, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-template-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-template-rows.v1", "secret_scan_remediation_receipt_template_rows", result.secret_scan_remediation_receipt_template_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-template-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-template-gate-rows.v1", "secret_scan_remediation_receipt_template_gate_rows", result.secret_scan_remediation_receipt_template_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-template-boundary.json"), result.secret_scan_remediation_receipt_template_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-remediation-receipt-template-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptTemplateFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptTemplateFixtures(args);
    console.log(`Trading secret scan remediation receipt template fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_template_fixtures_status}`);
    console.log(`Secret scan remediation receipt templates: ${result.summary.ready_secret_scan_remediation_receipt_template_count}/${result.summary.secret_scan_remediation_receipt_template_count}`);
    console.log(`Secret scan remediation receipt template rows: ${result.summary.ready_secret_scan_remediation_receipt_template_row_count}/${result.summary.secret_scan_remediation_receipt_template_row_count}`);
    console.log(`Secret scan remediation receipt template gates: ${result.summary.ready_secret_scan_remediation_receipt_template_gate_count}/${result.summary.secret_scan_remediation_receipt_template_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildReceiptTemplates(generatedAt) {
  return TEMPLATE_DEFINITIONS.map((definition, index) => {
    const template = {
      schema_version: "trading-secret-scan-remediation-receipt-template.v1",
      receipt_template_id: `trading-secret-scan-remediation-receipt-template.${definition.template_key}`,
      phase_slot: PHASE_SLOT,
      template_key: definition.template_key,
      title: definition.title,
      remediation_step: definition.remediation_step,
      template_status: "pending_human_receipt",
      generated_at: generatedAt,
      required_receipt_fields: [...new Set([...REQUIRED_RECEIPT_FIELDS, ...definition.additional_fields])],
      allowed_outcomes: definition.allowed_outcomes,
      default_receipt_status: "pending",
      default_outcome: "pending",
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
    return withOrdinalAndHash(template, index, "receipt_template_hash");
  });
}

function buildReceiptTemplateCoverage({ secretScanRemediation, templates, sources }) {
  const humanGateReceiptsText = sources.controlPlaneHumanGateReceipts.text ?? "";
  const templatesHaveRequiredFields = templates.every((template) => REQUIRED_RECEIPT_FIELDS.every((field) => template.required_receipt_fields.includes(field)));
  const templatesHaveExternalReferences = templates.every((template) => template.required_receipt_fields.some((field) => field.endsWith("_reference")));
  const templatesAvoidForbiddenFields = templates.every((template) => !includesAny(JSON.stringify(template.required_receipt_fields), FORBIDDEN_TEMPLATE_FIELD_SNIPPETS));
  const noReceiptPayloadOrApplication = templates.every((template) => template.receipt_payload_received === false && template.receipt_validated === false && template.receipt_applied === false && template.approval_applied === false);
  const noTemplateMutation = templates.every((template) => template.auto_fix_command_registered === false
    && template.auto_redaction_allowed === false
    && template.auto_deletion_allowed === false
    && template.auto_rotation_allowed === false
    && template.credential_lookup_allowed === false
    && template.broker_write_allowed === false
    && template.exchange_write_allowed === false
    && template.command_execution_performed === false
    && template.artifact_write_performed === false
    && template.protected_action_executed === false);
  return {
    p428_ready: secretScanRemediation.validation.valid && secretScanRemediation.summary.trading_secret_scan_remediation_fixtures_status === SOURCE_READY_STATUS,
    human_gate_receipts_keep_pending_manual: includesAll(humanGateReceiptsText, [
      "Pending rows do not close gates and do not trigger protected actions.",
      "receipt_status",
      "outcome",
      "completed_action_refs",
    ]),
    expected_receipt_template_count: TEMPLATE_DEFINITIONS.length,
    receipt_template_count: templates.length,
    template_keys: templates.map((template) => template.template_key),
    templates_have_required_fields: templatesHaveRequiredFields,
    templates_have_external_references: templatesHaveExternalReferences,
    templates_avoid_forbidden_secret_fields: templatesAvoidForbiddenFields,
    no_receipt_payload_or_application: noReceiptPayloadOrApplication,
    no_secret_material_read: secretScanRemediation.summary.no_secret_material_read === true
      && secretScanRemediation.summary.secret_values_read === false
      && secretScanRemediation.summary.env_file_read === false
      && secretScanRemediation.summary.desktop_config_content_inspected === false
      && secretScanRemediation.summary.desktop_config_read === false
      && templates.every((template) => template.secret_values_read === false && template.env_file_read === false && template.desktop_config_content_inspected === false && template.desktop_config_read === false),
    no_secret_or_trading_mutation: secretScanRemediation.summary.no_secret_or_trading_mutation === true
      && secretScanRemediation.summary.credential_lookup_allowed === false
      && secretScanRemediation.summary.broker_write_allowed === false
      && secretScanRemediation.summary.exchange_write_allowed === false
      && secretScanRemediation.summary.artifact_write_performed === false
      && secretScanRemediation.summary.protected_action_executed === false
      && noTemplateMutation,
  };
}

function buildReceiptTemplateAnchor(secretScanRemediation, coverage) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-template-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_fixtures_id: secretScanRemediation.trading_secret_scan_remediation_fixtures_id,
    source_secret_scan_remediation_status: secretScanRemediation.summary.trading_secret_scan_remediation_fixtures_status,
    required_row_count: REQUIRED_ROW_KEYS.length,
    required_row_keys: REQUIRED_ROW_KEYS,
    expected_receipt_template_count: TEMPLATE_DEFINITIONS.length,
    coverage_hash: hashValue(coverage),
    source_hash: hashValue({
      id: secretScanRemediation.trading_secret_scan_remediation_fixtures_id,
      status: secretScanRemediation.summary.trading_secret_scan_remediation_fixtures_status,
      row_count: secretScanRemediation.summary.secret_scan_remediation_row_count,
      gate_count: secretScanRemediation.summary.secret_scan_remediation_gate_count,
    }),
  };
}

function buildReceiptTemplateRows({ sourceReady, secretScanRemediation, coverage }) {
  const rowInputs = [
    receiptTemplateRowInput("p428_secret_scan_remediation_ready", "trading_secret_scan_remediation", "summary", [
      condition("source.trading_secret_scan_remediation_fixtures_status", secretScanRemediation.summary.trading_secret_scan_remediation_fixtures_status, SOURCE_READY_STATUS),
      condition("source.ready_secret_scan_remediation_row_count", secretScanRemediation.summary.ready_secret_scan_remediation_row_count, 8),
      condition("source.action_plan_no_auto_secret_fix_command", secretScanRemediation.summary.action_plan_no_auto_secret_fix_command, true),
    ]),
    receiptTemplateRowInput("template_review_findings_reference", "secret_scan_remediation_receipt_templates", "review_findings_reference", [
      condition("templates.review_findings_reference_declared", templateKeyPresent(coverage, "review_findings_reference"), true),
      condition("templates.have_required_fields", coverage.templates_have_required_fields, true),
    ]),
    receiptTemplateRowInput("template_external_removal_reference", "secret_scan_remediation_receipt_templates", "external_removal_reference", [
      condition("templates.external_removal_reference_declared", templateKeyPresent(coverage, "external_removal_reference"), true),
      condition("templates.have_external_references", coverage.templates_have_external_references, true),
    ]),
    receiptTemplateRowInput("template_external_rotation_reference", "secret_scan_remediation_receipt_templates", "external_rotation_reference", [
      condition("templates.external_rotation_reference_declared", templateKeyPresent(coverage, "external_rotation_reference"), true),
      condition("templates.have_external_references", coverage.templates_have_external_references, true),
    ]),
    receiptTemplateRowInput("template_clean_rerun_reference", "secret_scan_remediation_receipt_templates", "clean_rerun_reference", [
      condition("templates.clean_rerun_reference_declared", templateKeyPresent(coverage, "clean_rerun_reference"), true),
      condition("templates.have_external_references", coverage.templates_have_external_references, true),
    ]),
    receiptTemplateRowInput("template_human_closeout_decision", "secret_scan_remediation_receipt_templates", "human_closeout_decision", [
      condition("templates.human_closeout_decision_declared", templateKeyPresent(coverage, "human_closeout_decision"), true),
      condition("human_gate.pending_rows_do_not_trigger_actions", coverage.human_gate_receipts_keep_pending_manual, true),
    ]),
    receiptTemplateRowInput("template_no_secret_material_fields", "secret_scan_remediation_receipt_templates", "required_receipt_fields", [
      condition("templates.avoid_forbidden_secret_fields", coverage.templates_avoid_forbidden_secret_fields, true),
      condition("boundary.no_secret_material_read", coverage.no_secret_material_read, true),
    ]),
    receiptTemplateRowInput("template_no_receipt_or_mutation", "secret_scan_remediation_receipt_template_boundary", "boundary", [
      condition("templates.no_receipt_payload_or_application", coverage.no_receipt_payload_or_application, true),
      condition("boundary.no_secret_or_trading_mutation", coverage.no_secret_or_trading_mutation, true),
    ]),
  ];
  return rowInputs.map((input, index) => buildReceiptTemplateRow(input, sourceReady, index));
}

function receiptTemplateRowInput(rowKey, artifactId, evidencePath, observedConditions) {
  return { rowKey, artifactId, evidencePath, observedConditions };
}

function buildReceiptTemplateRow(input, sourceReady, index) {
  const unsafeConditions = input.observedConditions.filter((item) => item.observed_value !== item.expected_safe_value || !item.condition_present);
  const rowReady = sourceReady && unsafeConditions.length === 0;
  const row = {
    schema_version: "trading-secret-scan-remediation-receipt-template-row.v1",
    secret_scan_remediation_receipt_template_row_id: `trading-secret-scan-remediation-receipt-template.row.${input.rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: input.rowKey,
    artifact_id: input.artifactId,
    evidence_path: input.evidencePath,
    observed_conditions: input.observedConditions,
    observed_condition_count: input.observedConditions.length,
    unsafe_condition_refs: unsafeConditions.map((item) => item.condition_path),
    secret_scan_remediation_receipt_template_status: rowReady ? READY_STATUS : "blocked",
    source_secret_scan_remediation_ready: sourceReady,
    receipt_template_declared: rowReady,
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
  return withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_template_hash");
}

function buildReceiptTemplateBoundary({ generatedAt, writeRequested, sourceReady, secretScanRemediation, templates, rows, coverage }) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-template-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_scan_remediation_receipt_template_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_status: secretScanRemediation.summary.trading_secret_scan_remediation_fixtures_status,
    source_secret_scan_remediation_ready: sourceReady,
    secret_scan_remediation_receipt_template_count: templates.length,
    ready_secret_scan_remediation_receipt_template_count: templates.filter((template) => template.template_status === "pending_human_receipt").length,
    secret_scan_remediation_receipt_template_row_count: rows.length,
    ready_secret_scan_remediation_receipt_template_row_count: rows.filter((row) => row.secret_scan_remediation_receipt_template_status === READY_STATUS).length,
    human_gate_receipts_keep_pending_manual: coverage.human_gate_receipts_keep_pending_manual,
    templates_have_required_fields: coverage.templates_have_required_fields,
    templates_have_external_references: coverage.templates_have_external_references,
    templates_avoid_forbidden_secret_fields: coverage.templates_avoid_forbidden_secret_fields,
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

function buildReceiptTemplateGateRows({ secretScanRemediation, packageJson, platformOpsLedger, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const gateInputs = [
    ["p428_secret_scan_remediation_ready", "P428 secret scan remediation source is ready.", secretScanRemediation.validation.valid && secretScanRemediation.summary.trading_secret_scan_remediation_fixtures_status === SOURCE_READY_STATUS],
    ["platform_package_script_registered", "package.json registers the P429 trading secret scan remediation receipt template fixtures command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0],
    ["platform_validation_chain_registered", "Validation chain includes the P429 trading secret scan remediation receipt template fixtures command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)],
    ["p429_ledger_acceptance_declared", "P429 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P429: `trading:secret-scan-remediation-receipt-template-fixtures`")],
    ["human_gate_receipts_keep_pending_manual", "Human gate receipts keep pending rows manual and non-triggering.", boundary.human_gate_receipts_keep_pending_manual],
    ["receipt_templates_declared", "P429 declares the expected receipt templates.", boundary.secret_scan_remediation_receipt_template_count === TEMPLATE_DEFINITIONS.length && boundary.ready_secret_scan_remediation_receipt_template_count === TEMPLATE_DEFINITIONS.length],
    ["receipt_templates_have_required_fields", "Receipt templates include required human decision fields.", boundary.templates_have_required_fields && boundary.templates_have_external_references],
    ["receipt_templates_avoid_secret_fields", "Receipt templates avoid secret-value, raw-token, provider-key, env-content, and Desktop-config-content fields.", boundary.templates_avoid_forbidden_secret_fields],
    ["no_receipt_payload_or_application", "No receipt payload is received, validated, applied, or converted into approval.", boundary.no_receipt_payload_or_application && !boundary.receipt_payload_received && !boundary.receipt_applied && !boundary.approval_applied],
    ["no_secret_or_trading_mutation", "P429 performs no secret reads, credential lookup, trading writes, artifact mutation, release, git, or protected action.", boundary.no_secret_material_read && boundary.no_secret_or_trading_mutation && !boundary.artifact_write_performed && !boundary.protected_action_executed],
  ];
  return gateInputs.map(([rowKey, description, passed], index) => withOrdinalAndHash(gateRow(rowKey, description, passed), index, "secret_scan_remediation_receipt_template_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-template-gate-row.v1",
    secret_scan_remediation_receipt_template_gate_row_id: `trading-secret-scan-remediation-receipt-template-fixtures.gate.${rowKey}`,
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

function buildValidationItems({ secretScanRemediation, sources, rows, gateRows, boundary, coverage }) {
  return [
    validationItem("source.secret_scan_remediation", "p428_secret_scan_remediation_ready", secretScanRemediation.validation.valid && secretScanRemediation.summary.trading_secret_scan_remediation_fixtures_status === SOURCE_READY_STATUS, "P428 secret scan remediation fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", sources.packageJson.available, "package.json is readable for P429 secret scan remediation receipt template fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", sources.platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.control_plane_human_gate_receipts", "control_plane_human_gate_receipts_available", sources.controlPlaneHumanGateReceipts.available, "Control-plane human gate receipt source is readable."),
    validationItem("secret_scan_remediation_receipt_template_rows", "secret_scan_remediation_receipt_template_rows_ready", rows.length === REQUIRED_ROW_KEYS.length && REQUIRED_ROW_KEYS.every((rowKey) => rows.some((row) => row.row_key === rowKey)) && rows.every((row) => row.secret_scan_remediation_receipt_template_status === READY_STATUS), "All secret scan remediation receipt template rows must be ready."),
    validationItem("secret_scan_remediation_receipt_template_gate_rows", "secret_scan_remediation_receipt_template_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P429 secret scan remediation receipt template gates are ready."),
    validationItem("coverage.human_receipts", "human_gate_receipts_keep_pending_manual", coverage.human_gate_receipts_keep_pending_manual, "Human gate receipts must keep pending rows manual and non-triggering."),
    validationItem("coverage.templates_count", "receipt_templates_declared", coverage.receipt_template_count === coverage.expected_receipt_template_count, "Expected secret scan remediation receipt templates must be declared."),
    validationItem("coverage.templates_fields", "receipt_templates_have_required_fields", coverage.templates_have_required_fields && coverage.templates_have_external_references, "Receipt templates must include required human decision and external reference fields."),
    validationItem("coverage.no_secret_fields", "templates_avoid_forbidden_secret_fields", coverage.templates_avoid_forbidden_secret_fields, "Receipt templates must avoid secret material fields."),
    validationItem("coverage.no_receipt_payload", "no_receipt_payload_or_application", coverage.no_receipt_payload_or_application, "P429 must not receive, validate, apply, or approve receipt payloads."),
    validationItem("boundary.no_secret_material_read", "no_secret_material_read", boundary.no_secret_material_read && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read, "P429 reads no secret values, env files, or Desktop config content."),
    validationItem("boundary.no_mutation", "no_secret_or_trading_mutation", boundary.no_secret_or_trading_mutation && !boundary.credential_lookup_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.artifact_write_performed && !boundary.protected_action_executed, "P429 performs no credential lookup, trading mutation, artifact mutation, or protected action."),
  ];
}

function buildSummary({ secretScanRemediation, templates, rows, gateRows, boundary, coverage, validation }) {
  return {
    trading_secret_scan_remediation_receipt_template_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_status: secretScanRemediation.summary.trading_secret_scan_remediation_fixtures_status,
    source_secret_scan_remediation_ready: boundary.source_secret_scan_remediation_ready,
    required_row_count: REQUIRED_ROW_KEYS.length,
    secret_scan_remediation_receipt_template_count: templates.length,
    ready_secret_scan_remediation_receipt_template_count: boundary.ready_secret_scan_remediation_receipt_template_count,
    secret_scan_remediation_receipt_template_row_count: rows.length,
    ready_secret_scan_remediation_receipt_template_row_count: boundary.ready_secret_scan_remediation_receipt_template_row_count,
    secret_scan_remediation_receipt_template_gate_count: gateRows.length,
    ready_secret_scan_remediation_receipt_template_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    human_gate_receipts_keep_pending_manual: boundary.human_gate_receipts_keep_pending_manual,
    templates_have_required_fields: boundary.templates_have_required_fields,
    templates_have_external_references: boundary.templates_have_external_references,
    templates_avoid_forbidden_secret_fields: boundary.templates_avoid_forbidden_secret_fields,
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
    expected_receipt_template_count: coverage.expected_receipt_template_count,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Secret Scan Remediation Receipt Template Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_template_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source secret scan remediation: ${result.summary.source_secret_scan_remediation_status}`,
    `Receipt templates: ${result.summary.ready_secret_scan_remediation_receipt_template_count}/${result.summary.secret_scan_remediation_receipt_template_count}`,
    `Receipt template rows: ${result.summary.ready_secret_scan_remediation_receipt_template_row_count}/${result.summary.secret_scan_remediation_receipt_template_row_count}`,
    `Receipt template gates: ${result.summary.ready_secret_scan_remediation_receipt_template_gate_count}/${result.summary.secret_scan_remediation_receipt_template_gate_count}`,
    "",
    "## Templates",
    "",
    ...result.secret_scan_remediation_receipt_templates.map((template) => `- ${template.template_key}: ${template.template_status}`),
    "",
    "## Rows",
    "",
    ...result.secret_scan_remediation_receipt_template_rows.map((row) => `- ${row.row_key}: ${row.secret_scan_remediation_receipt_template_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_scan_remediation_receipt_template_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_TEMPLATE_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--secret-scan-remediation-schema") parsed.secretScanRemediationSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-template-fixtures.mjs [options]

Options:
  --out-dir <folder>                           Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_TEMPLATE_FIXTURES_OUT_DIR}
  --run-at <iso>                               Deterministic generated_at timestamp.
  --package <path>                             package.json path.
  --platform-ops-ledger <path>                 P341-P500 platform operations ledger path.
  --secret-scan-remediation-schema <path>      P428 secret scan remediation fixtures schema path.
  --control-plane-human-gate-receipts <path>   Control-plane human gate receipts source path.
  --schema <path>                              Output schema path.
  --check                                      Validate only, do not write artifacts.
  -h, --help                                   Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_TEMPLATE_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_TEMPLATE_FIXTURES_INPUTS.platformOpsLedgerPath),
    secret_scan_remediation_schema_path: path.resolve(options.secretScanRemediationSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_TEMPLATE_FIXTURES_INPUTS.secretScanRemediationSchemaPath),
    control_plane_human_gate_receipts_path: path.resolve(options.controlPlaneHumanGateReceiptsPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_TEMPLATE_FIXTURES_INPUTS.controlPlaneHumanGateReceiptsPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_TEMPLATE_FIXTURES_INPUTS.schemaPath),
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

function includesAll(text, snippets) {
  return snippets.every((snippet) => text.includes(snippet));
}

function includesAny(text, snippets) {
  return snippets.some((snippet) => text.includes(snippet));
}

function templateKeyPresent(coverage, templateKey) {
  return coverage.template_keys?.includes(templateKey) ?? false;
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dateStamp(isoDate) {
  return isoDate.slice(0, 10).replaceAll("-", "");
}
