import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_GATE_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationReceiptChainSecretScanGateFixtures,
} from "./trading-secret-scan-remediation-receipt-chain-secret-scan-gate-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_ATTENTION_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-chain-secret-scan-attention-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_ATTENTION_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_GATE_FIXTURES_INPUTS,
  secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_GATE_FIXTURES_INPUTS.schemaPath,
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiDocPath: "docs/review-api.md",
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-chain-secret-scan-attention-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-chain-secret-scan-attention-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures";
const PHASE_SLOT = "P452";
const PREVIOUS_PHASE_SLOT = "P451";
const NEXT_PHASE_SLOT = "P453";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_attention";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_gate";
const COMMAND_NAME = "trading:secret-scan-remediation-receipt-chain-secret-scan-attention-fixtures";
const REQUIRED_ROW_KEYS = [
  "p451_secret_scan_remediation_receipt_chain_secret_scan_gate_ready",
  "review_dashboard_secret_scan_stage_registered",
  "review_dashboard_leakage_counters_registered",
  "review_dashboard_fix_action_registered",
  "review_api_attention_filters_registered",
  "review_api_docs_attention_filters_registered",
  "secret_scan_doc_attention_state_declared",
  "secret_scan_attention_no_secret_exposure",
];

export async function runTradingSecretScanRemediationReceiptChainSecretScanAttentionFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptChainSecretScanAttentionFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptChainSecretScanAttentionFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt chain secret scan attention fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptChainSecretScanAttentionFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_ATTENTION_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const secretScanGate = await buildTradingSecretScanRemediationReceiptChainSecretScanGateFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    schemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const reviewDashboard = await readTextSource(inputs.review_dashboard_path);
  const reviewApi = await readTextSource(inputs.review_api_path);
  const reviewApiDoc = await readTextSource(inputs.review_api_doc_path);
  const secretsScanGateDoc = await readTextSource(inputs.secrets_scan_gate_doc_path);
  const sources = { packageJson, platformOpsLedger, reviewDashboard, reviewApi, reviewApiDoc, secretsScanGateDoc };
  const sourceReady = secretScanGate.validation.valid && secretScanGate.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_status === SOURCE_READY_STATUS;
  const coverage = buildSecretScanAttentionCoverage({ secretScanGate, sources });
  const anchor = buildSecretScanAttentionAnchor(secretScanGate, coverage);
  const rows = buildSecretScanAttentionRows({ sourceReady, secretScanGate, coverage });
  const boundary = buildSecretScanAttentionBoundary({ generatedAt, writeRequested: options.write !== false, secretScanGate, rows, coverage });
  const gateRows = buildSecretScanAttentionGateRows({ secretScanGate, packageJson, platformOpsLedger, rows, boundary });
  const validationItems = buildValidationItems({ secretScanGate, sources, rows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ secretScanGate, rows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-attention-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_scan_attention_anchor: anchor,
    secret_scan_attention_rows: rows,
    secret_scan_attention_gate_rows: gateRows,
    secret_scan_attention_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ secretScanGate, rows, gateRows, boundary, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures_id = result.trading_secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptChainSecretScanAttentionFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-chain-secret-scan-attention-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-scan-attention-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-attention-rows.v1", "secret_scan_attention_rows", result.secret_scan_attention_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-attention-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-attention-gate-rows.v1", "secret_scan_attention_gate_rows", result.secret_scan_attention_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-attention-boundary.json"), result.secret_scan_attention_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-attention-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptChainSecretScanAttentionFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptChainSecretScanAttentionFixtures(args);
    console.log(`Trading secret scan remediation receipt chain secret scan attention fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures_status}`);
    console.log(`Secret scan attention rows: ${result.summary.ready_secret_scan_attention_row_count}/${result.summary.secret_scan_attention_row_count}`);
    console.log(`Secret scan attention gates: ${result.summary.ready_secret_scan_attention_gate_count}/${result.summary.secret_scan_attention_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildSecretScanAttentionCoverage({ secretScanGate, sources }) {
  const dashboardText = sources.reviewDashboard.text ?? "";
  const reviewApiText = sources.reviewApi.text ?? "";
  const reviewApiDocText = sources.reviewApiDoc.text ?? "";
  const secretsScanGateDocText = sources.secretsScanGateDoc.text ?? "";
  return {
    p451_ready: secretScanGate.validation.valid && secretScanGate.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_status === SOURCE_READY_STATUS,
    dashboard_stage_registered: includesAll(dashboardText, ["label: \"Secrets Scan Gate\"", "missingStage(\"secrets_scan_gate\"", "secrets_scan_gate_status"]),
    dashboard_leakage_counters_registered: includesAll(dashboardText, [
      "credential_leakage_detected_count",
      "token_leakage_detected_count",
      "env_leakage_detected_count",
      "desktop_config_leakage_detected_count",
      "provider_key_leakage_detected_count",
    ]),
    dashboard_fix_action_registered: includesAll(dashboardText, ["title: \"Fix Secrets Scan Gate\"", "secrets_scan_gate"]),
    review_api_attention_filters_registered: includesAll(reviewApiText, ["/api/secrets-scan-gate-results", "/api/desktop-config-leakage-checks", "leakage_detected", "gate_status"]),
    review_api_docs_attention_filters_registered: includesAll(reviewApiDocText, ["leakage_detected", "gate_fail_on_leakage", "secret_material_read", "desktop_config_read"]),
    secret_scan_doc_attention_state_declared: includesAll(secretsScanGateDocText, ["attention state", "failing operational gate", "credential/token/env/Desktop config leakage"]),
    no_secret_exposure: secretScanGate.summary.no_secret_material_read && !secretScanGate.summary.secret_values_read && !secretScanGate.summary.env_file_read && !secretScanGate.summary.desktop_config_content_inspected && !secretScanGate.summary.desktop_config_read && !secretScanGate.summary.raw_secret_material_exposed && !secretScanGate.summary.provider_key_material_present && !secretScanGate.summary.desktop_provider_key_visible,
    no_secret_or_trading_mutation: secretScanGate.summary.no_secret_or_trading_mutation && !secretScanGate.summary.secret_scan_remediation_action_allowed && !secretScanGate.summary.credential_lookup_allowed && !secretScanGate.summary.broker_write_allowed && !secretScanGate.summary.exchange_write_allowed && !secretScanGate.summary.command_execution_performed && !secretScanGate.summary.artifact_write_performed && !secretScanGate.summary.protected_action_executed,
  };
}

function buildSecretScanAttentionAnchor(secretScanGate, coverage) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-attention-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_id: secretScanGate.trading_secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_id,
    source_secret_scan_remediation_receipt_chain_secret_scan_gate_status: secretScanGate.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_status,
    required_row_count: REQUIRED_ROW_KEYS.length,
    required_row_keys: REQUIRED_ROW_KEYS,
    coverage_hash: hashValue(coverage),
    source_hash: hashValue({
      id: secretScanGate.trading_secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_id,
      status: secretScanGate.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_status,
      row_count: secretScanGate.summary.secret_scan_gate_row_count,
      gate_count: secretScanGate.summary.secret_scan_gate_gate_count,
    }),
  };
}

function buildSecretScanAttentionRows({ sourceReady, secretScanGate, coverage }) {
  const rowInputs = [
    attentionRowInput("p451_secret_scan_remediation_receipt_chain_secret_scan_gate_ready", "trading_secret_scan_remediation_receipt_chain_secret_scan_gate", "summary", [
      condition("source.trading_secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_status", secretScanGate.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_status, SOURCE_READY_STATUS),
      condition("source.ready_secret_scan_gate_row_count", secretScanGate.summary.ready_secret_scan_gate_row_count, 8),
      condition("source.no_secret_material_read", secretScanGate.summary.no_secret_material_read, true),
      condition("source.no_secret_or_trading_mutation", secretScanGate.summary.no_secret_or_trading_mutation, true),
      condition("source.secret_scan_remediation_action_allowed", secretScanGate.summary.secret_scan_remediation_action_allowed, false),
      condition("source.secret_values_read", secretScanGate.summary.secret_values_read, false),
      condition("source.env_file_read", secretScanGate.summary.env_file_read, false),
      condition("source.desktop_config_content_inspected", secretScanGate.summary.desktop_config_content_inspected, false),
      condition("source.desktop_config_read", secretScanGate.summary.desktop_config_read, false),
    ]),
    attentionRowInput("review_dashboard_secret_scan_stage_registered", "review_dashboard", "src/review-dashboard.mjs", [
      condition("dashboard.stage_registered", coverage.dashboard_stage_registered, true),
    ]),
    attentionRowInput("review_dashboard_leakage_counters_registered", "review_dashboard", "secrets_scan_gate.summary", [
      condition("dashboard.leakage_counters_registered", coverage.dashboard_leakage_counters_registered, true),
    ]),
    attentionRowInput("review_dashboard_fix_action_registered", "review_dashboard", "operator_fix_action", [
      condition("dashboard.fix_action_registered", coverage.dashboard_fix_action_registered, true),
    ]),
    attentionRowInput("review_api_attention_filters_registered", "review_api", "src/review-api.mjs", [
      condition("review_api.attention_filters_registered", coverage.review_api_attention_filters_registered, true),
    ]),
    attentionRowInput("review_api_docs_attention_filters_registered", "review_api_doc", "docs/review-api.md", [
      condition("review_api_doc.attention_filters_registered", coverage.review_api_docs_attention_filters_registered, true),
    ]),
    attentionRowInput("secret_scan_doc_attention_state_declared", "secrets_scan_gate_doc", "docs/secrets-scan-gate.md", [
      condition("doc.attention_state_declared", coverage.secret_scan_doc_attention_state_declared, true),
    ]),
    attentionRowInput("secret_scan_attention_no_secret_exposure", "secret_scan_attention_boundary", "boundary", [
      condition("boundary.no_secret_exposure", coverage.no_secret_exposure, true),
      condition("boundary.no_secret_or_trading_mutation", coverage.no_secret_or_trading_mutation, true),
    ]),
  ];
  return rowInputs.map((input, index) => buildSecretScanAttentionRow(input, sourceReady, index));
}

function attentionRowInput(rowKey, artifactId, evidencePath, observedConditions) {
  return { rowKey, artifactId, evidencePath, observedConditions };
}

function buildSecretScanAttentionRow(input, sourceReady, index) {
  const unsafeConditions = input.observedConditions.filter((item) => item.observed_value !== item.expected_safe_value || !item.condition_present);
  const rowReady = sourceReady && unsafeConditions.length === 0;
  const row = {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-attention-row.v1",
    secret_scan_attention_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-attention.row.${input.rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: input.rowKey,
    artifact_id: input.artifactId,
    evidence_path: input.evidencePath,
    observed_conditions: input.observedConditions,
    observed_condition_count: input.observedConditions.length,
    unsafe_condition_refs: unsafeConditions.map((item) => item.condition_path),
    secret_scan_attention_status: rowReady ? READY_STATUS : "blocked",
    source_secret_scan_remediation_receipt_chain_secret_scan_gate_ready: sourceReady,
    dashboard_stage_registered: input.rowKey === "review_dashboard_secret_scan_stage_registered" ? rowReady : true,
    attention_state_visible: rowReady,
    failing_gate_visible: rowReady,
    raw_secret_material_materialized: false,
    raw_secret_material_exposed: false,
    provider_key_material_present: false,
    environment_dump_present: false,
    desktop_provider_key_visible: false,
    no_secret_material_read: true,
    no_secret_or_trading_mutation: true,
    secret_scan_remediation_action_allowed: false,
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    desktop_config_read: false,
    credential_lookup_allowed: false,
    plaintext_secret_allowed: false,
    model_context_secret_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    command_execution_performed: false,
    artifact_read_performed: false,
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
  return withOrdinalAndHash(row, index, "secret_scan_attention_hash");
}

function buildSecretScanAttentionBoundary({ generatedAt, writeRequested, secretScanGate, rows, coverage }) {
  const sourceReady = secretScanGate.validation.valid && secretScanGate.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_status === SOURCE_READY_STATUS;
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-attention-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_scan_attention_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_receipt_chain_secret_scan_gate_status: secretScanGate.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_status,
    source_secret_scan_remediation_receipt_chain_secret_scan_gate_ready: sourceReady,
    secret_scan_attention_row_count: rows.length,
    ready_secret_scan_attention_row_count: rows.filter((row) => row.secret_scan_attention_status === READY_STATUS).length,
    dashboard_stage_registered: coverage.dashboard_stage_registered,
    dashboard_leakage_counters_registered: coverage.dashboard_leakage_counters_registered,
    dashboard_fix_action_registered: coverage.dashboard_fix_action_registered,
    review_api_attention_filters_registered: coverage.review_api_attention_filters_registered,
    review_api_docs_attention_filters_registered: coverage.review_api_docs_attention_filters_registered,
    secret_scan_doc_attention_state_declared: coverage.secret_scan_doc_attention_state_declared,
    attention_state_visible: coverage.dashboard_stage_registered && coverage.dashboard_leakage_counters_registered && coverage.secret_scan_doc_attention_state_declared,
    failing_gate_visible: coverage.secret_scan_doc_attention_state_declared && coverage.review_api_attention_filters_registered,
    no_secret_exposure: coverage.no_secret_exposure,
    no_secret_or_trading_mutation: coverage.no_secret_or_trading_mutation,
    raw_secret_material_materialized: false,
    raw_secret_material_exposed: false,
    provider_key_material_present: false,
    environment_dump_present: false,
    desktop_provider_key_visible: false,
    no_secret_material_read: secretScanGate.summary.no_secret_material_read && rows.every((row) => row.no_secret_material_read),
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    desktop_config_read: false,
    secret_scan_remediation_action_allowed: secretScanGate.summary.secret_scan_remediation_action_allowed || rows.some((row) => row.secret_scan_remediation_action_allowed),
    credential_lookup_allowed: false,
    plaintext_secret_allowed: false,
    model_context_secret_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    command_execution_performed: false,
    artifact_read_performed: false,
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildSecretScanAttentionGateRows({ secretScanGate, packageJson, platformOpsLedger, rows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const gateInputs = [
    ["p451_secret_scan_remediation_receipt_chain_secret_scan_gate_ready", "P451 secret scan gate source is ready.", secretScanGate.validation.valid && secretScanGate.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_status === SOURCE_READY_STATUS],
    ["platform_package_script_registered", "package.json registers the P452 trading secret scan attention fixtures command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0],
    ["platform_validation_chain_registered", "Validation chain includes the P452 trading secret scan attention fixtures command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)],
    ["p452_ledger_acceptance_declared", "P452 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P452: `trading:secret-scan-remediation-receipt-chain-secret-scan-attention-fixtures`")],
    ["review_dashboard_secret_scan_stage_registered", "Review Dashboard exposes the Secrets Scan Gate stage.", boundary.dashboard_stage_registered],
    ["review_dashboard_leakage_counters_registered", "Review Dashboard keeps leakage counters visible.", boundary.dashboard_leakage_counters_registered],
    ["review_api_attention_filters_registered", "Review API exposes leakage attention filters.", boundary.review_api_attention_filters_registered],
    ["review_api_docs_attention_filters_registered", "Review API docs declare attention filters.", boundary.review_api_docs_attention_filters_registered],
    ["secret_scan_doc_attention_state_declared", "Secrets scan docs declare attention state and failing operational gate behavior.", boundary.secret_scan_doc_attention_state_declared],
    ["no_secret_or_trading_mutation", "P452 performs no secret reads, secret scan remediation action, credential lookup, trading writes, artifact mutation, release, git, or protected action.", boundary.no_secret_exposure && boundary.no_secret_material_read && boundary.no_secret_or_trading_mutation && !boundary.secret_scan_remediation_action_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read && !boundary.artifact_write_performed && !boundary.protected_action_executed],
  ];
  return gateInputs.map(([rowKey, description, passed], index) => withOrdinalAndHash(gateRow(rowKey, description, passed), index, "secret_scan_attention_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-attention-gate-row.v1",
    secret_scan_attention_gate_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-attention-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    raw_secret_material_materialized_by_gate: false,
    raw_secret_material_exposed_by_gate: false,
    provider_key_material_present_by_gate: false,
    environment_dump_present_by_gate: false,
    secret_scan_remediation_action_allowed_by_gate: false,
    secret_values_read_by_gate: false,
    env_file_read_by_gate: false,
    desktop_config_content_inspected_by_gate: false,
    desktop_config_read_by_gate: false,
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

function buildValidationItems({ secretScanGate, sources, rows, gateRows, boundary }) {
  return [
    validationItem("source.secret_scan_gate", "p451_secret_scan_remediation_receipt_chain_secret_scan_gate_ready", secretScanGate.validation.valid && secretScanGate.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_status === SOURCE_READY_STATUS, "P451 secret scan gate fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", sources.packageJson.available, "package.json is readable for P452 secret scan attention fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", sources.platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.review_dashboard", "review_dashboard_available", sources.reviewDashboard.available, "Review Dashboard source is readable."),
    validationItem("source.review_api", "review_api_available", sources.reviewApi.available, "Review API source is readable."),
    validationItem("source.review_api_doc", "review_api_doc_available", sources.reviewApiDoc.available, "Review API docs are readable."),
    validationItem("source.secrets_scan_gate_doc", "secrets_scan_gate_doc_available", sources.secretsScanGateDoc.available, "Secrets scan gate docs are readable."),
    validationItem("secret_scan_attention_rows", "secret_scan_attention_rows_ready", rows.length === REQUIRED_ROW_KEYS.length && REQUIRED_ROW_KEYS.every((rowKey) => rows.some((row) => row.row_key === rowKey)) && rows.every((row) => row.secret_scan_attention_status === READY_STATUS), "All secret scan attention rows must be ready."),
    validationItem("secret_scan_attention_gate_rows", "secret_scan_attention_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P452 secret scan attention gates are ready."),
    validationItem("boundary.dashboard_stage", "review_dashboard_secret_scan_stage_registered", boundary.dashboard_stage_registered, "Review Dashboard must expose the Secrets Scan Gate stage."),
    validationItem("boundary.dashboard_counters", "review_dashboard_leakage_counters_registered", boundary.dashboard_leakage_counters_registered, "Review Dashboard must keep leakage counters visible."),
    validationItem("boundary.review_api_filters", "review_api_attention_filters_registered", boundary.review_api_attention_filters_registered, "Review API must expose attention filters."),
    validationItem("boundary.review_api_docs", "review_api_docs_attention_filters_registered", boundary.review_api_docs_attention_filters_registered, "Review API docs must declare attention filters."),
    validationItem("boundary.attention_doc", "secret_scan_doc_attention_state_declared", boundary.secret_scan_doc_attention_state_declared, "Secrets scan docs must declare attention-state behavior."),
    validationItem("boundary.no_mutation", "no_secret_or_trading_mutation", boundary.no_secret_exposure && boundary.no_secret_material_read && boundary.no_secret_or_trading_mutation && !boundary.secret_scan_remediation_action_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read && !boundary.credential_lookup_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.protected_action_executed, "P452 performs no secret reads, secret scan remediation action, trading mutation, artifact mutation, or protected action."),
  ];
}

function buildSummary({ secretScanGate, rows, gateRows, boundary, validation }) {
  return {
    trading_secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_secret_scan_gate_status: secretScanGate.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_status,
    source_secret_scan_remediation_receipt_chain_secret_scan_gate_ready: boundary.source_secret_scan_remediation_receipt_chain_secret_scan_gate_ready,
    required_row_count: REQUIRED_ROW_KEYS.length,
    secret_scan_attention_row_count: rows.length,
    ready_secret_scan_attention_row_count: boundary.ready_secret_scan_attention_row_count,
    secret_scan_attention_gate_count: gateRows.length,
    ready_secret_scan_attention_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    dashboard_stage_registered: boundary.dashboard_stage_registered,
    dashboard_leakage_counters_registered: boundary.dashboard_leakage_counters_registered,
    dashboard_fix_action_registered: boundary.dashboard_fix_action_registered,
    review_api_attention_filters_registered: boundary.review_api_attention_filters_registered,
    review_api_docs_attention_filters_registered: boundary.review_api_docs_attention_filters_registered,
    secret_scan_doc_attention_state_declared: boundary.secret_scan_doc_attention_state_declared,
    attention_state_visible: boundary.attention_state_visible,
    failing_gate_visible: boundary.failing_gate_visible,
    no_secret_exposure: boundary.no_secret_exposure,
    no_secret_or_trading_mutation: boundary.no_secret_or_trading_mutation,
    raw_secret_material_materialized: boundary.raw_secret_material_materialized,
    raw_secret_material_exposed: boundary.raw_secret_material_exposed,
    provider_key_material_present: boundary.provider_key_material_present,
    environment_dump_present: boundary.environment_dump_present,
    desktop_provider_key_visible: boundary.desktop_provider_key_visible,
    no_secret_material_read: boundary.no_secret_material_read,
    secret_values_read: boundary.secret_values_read,
    env_file_read: boundary.env_file_read,
    desktop_config_content_inspected: boundary.desktop_config_content_inspected,
    desktop_config_read: boundary.desktop_config_read,
    secret_scan_remediation_action_allowed: boundary.secret_scan_remediation_action_allowed,
    credential_lookup_allowed: boundary.credential_lookup_allowed,
    plaintext_secret_allowed: boundary.plaintext_secret_allowed,
    model_context_secret_allowed: boundary.model_context_secret_allowed,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    command_execution_performed: boundary.command_execution_performed,
    artifact_read_performed: boundary.artifact_read_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    protected_action_executed: boundary.protected_action_executed,
    human_review_required: boundary.human_review_required,
    human_signoff_required: boundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Secret Scan Remediation Receipt Chain Secret Scan Attention Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source secret scan gate: ${result.summary.source_secret_scan_remediation_receipt_chain_secret_scan_gate_status}`,
    `Secret scan attention rows: ${result.summary.ready_secret_scan_attention_row_count}/${result.summary.secret_scan_attention_row_count}`,
    `Secret scan attention gates: ${result.summary.ready_secret_scan_attention_gate_count}/${result.summary.secret_scan_attention_gate_count}`,
    "",
    "## Rows",
    "",
    ...result.secret_scan_attention_rows.map((row) => `- ${row.row_key}: ${row.secret_scan_attention_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_scan_attention_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_ATTENTION_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-gate-fixtures-schema") parsed.secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath = argv[++index];
    else if (arg === "--review-dashboard") parsed.reviewDashboardPath = argv[++index];
    else if (arg === "--review-api") parsed.reviewApiPath = argv[++index];
    else if (arg === "--review-api-doc") parsed.reviewApiDocPath = argv[++index];
    else if (arg === "--secrets-scan-gate-doc") parsed.secretsScanGateDocPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-chain-secret-scan-attention-fixtures.mjs [options]

Options:
  --out-dir <folder>                         Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_ATTENTION_FIXTURES_OUT_DIR}
  --run-at <iso>                             Deterministic generated_at timestamp.
  --package <path>                           package.json path.
  --platform-ops-ledger <path>               P341-P500 platform operations ledger path.
  --secret-scan-remediation-receipt-chain-secret-scan-gate-fixtures-schema <path>  P451 secret scan gate fixtures schema path.
  --review-dashboard <path>                  Review Dashboard source path.
  --review-api <path>                        Review API source path.
  --review-api-doc <path>                    Review API docs path.
  --secrets-scan-gate-doc <path>             Secrets scan gate docs path.
  --schema <path>                            Output schema path.
  --check                                    Validate only, do not write artifacts.
  -h, --help                                 Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_ATTENTION_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_ATTENTION_FIXTURES_INPUTS.platformOpsLedgerPath),
    secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_ATTENTION_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_ATTENTION_FIXTURES_INPUTS.reviewDashboardPath),
    review_api_path: path.resolve(options.reviewApiPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_ATTENTION_FIXTURES_INPUTS.reviewApiPath),
    review_api_doc_path: path.resolve(options.reviewApiDocPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_ATTENTION_FIXTURES_INPUTS.reviewApiDocPath),
    secrets_scan_gate_doc_path: path.resolve(options.secretsScanGateDocPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_ATTENTION_FIXTURES_INPUTS.secretsScanGateDocPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_ATTENTION_FIXTURES_INPUTS.schemaPath),
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

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dateStamp(isoDate) {
  return isoDate.slice(0, 10).replaceAll("-", "");
}
