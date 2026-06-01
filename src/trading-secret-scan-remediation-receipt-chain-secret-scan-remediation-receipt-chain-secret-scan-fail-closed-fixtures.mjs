import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_SECRETS_SCAN_GATE_INPUTS,
  buildSecretsScanGate,
} from "./secrets-scan-gate.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_ATTENTION_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSecretScanAttentionFixtures,
} from "./trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-attention-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-fail-closed-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS = {
  ...DEFAULT_SECRETS_SCAN_GATE_INPUTS,
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_ATTENTION_FIXTURES_INPUTS,
  secretScanRemediationReceiptChainSecretScanRemediationReceiptChainSecretScanAttentionSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_ATTENTION_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-fail-closed-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-fail-closed-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures";
const PHASE_SLOT = "P479";
const PREVIOUS_PHASE_SLOT = "P478";
const NEXT_PHASE_SLOT = "P480";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_fail_closed";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention";
const SECRETS_SCAN_GATE_READY_STATUS = "complete";
const COMMAND_NAME = "trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-fail-closed-fixtures";
const EXPECTED_FAIL_CLOSED_KINDS = [
  "credential_material",
  "raw_token_material",
  "env_file",
  "desktop_config",
  "provider_api_key",
  "desktop_provider_key",
  "protected_config_write",
  "secret_external_transfer",
];
const REQUIRED_ROW_KEYS = [
  "p478_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_ready",
  "secrets_scan_gate_complete",
  "secrets_scan_gate_fail_on_credential_leakage",
  "secrets_scan_gate_fail_on_token_leakage",
  "secrets_scan_gate_fail_on_env_leakage",
  "secrets_scan_gate_fail_on_provider_key_leakage",
  "secrets_scan_gate_fail_on_desktop_config_leakage",
  "secrets_scan_gate_no_secret_material_read",
];

export async function runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSecretScanFailClosedFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSecretScanFailClosedFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSecretScanFailClosedFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt chain secret scan remediation receipt chain secret scan fail-closed fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSecretScanFailClosedFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const secretScanAttention = await buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSecretScanAttentionFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    reviewDashboardPath: inputs.review_dashboard_path,
    reviewApiPath: inputs.review_api_path,
    reviewApiDocPath: inputs.review_api_doc_path,
    secretsScanGateDocPath: inputs.secrets_scan_gate_doc_path,
    schemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_schema_path,
    write: false,
  });
  const secretsScanGate = await buildSecretsScanGate({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const sources = { packageJson, platformOpsLedger };
  const sourceReady = secretScanAttention.validation.valid && secretScanAttention.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures_status === SOURCE_READY_STATUS;
  const secretsScanGateComplete = secretsScanGate.validation.valid && secretsScanGate.summary.secrets_scan_gate_status === SECRETS_SCAN_GATE_READY_STATUS;
  const coverage = buildFailClosedCoverage({ secretScanAttention, secretsScanGate });
  const anchor = buildFailClosedAnchor({ secretScanAttention, secretsScanGate, coverage });
  const rows = buildFailClosedRows({ sourceReady, secretsScanGateComplete, coverage, secretScanAttention, secretsScanGate });
  const boundary = buildFailClosedBoundary({ generatedAt, writeRequested: options.write !== false, sourceReady, secretsScanGateComplete, coverage, secretScanAttention, secretsScanGate, rows });
  const gateRows = buildFailClosedGateRows({ packageJson, platformOpsLedger, rows, boundary, sourceReady, secretsScanGateComplete, coverage });
  const validationItems = buildValidationItems({ secretScanAttention, secretsScanGate, sources, rows, gateRows, boundary, coverage });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ secretScanAttention, secretsScanGate, rows, gateRows, boundary, coverage, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-fail-closed-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_scan_fail_closed_anchor: anchor,
    secret_scan_fail_closed_rows: rows,
    secret_scan_fail_closed_gate_rows: gateRows,
    secret_scan_fail_closed_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ secretScanAttention, secretsScanGate, rows, gateRows, boundary, coverage, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures_id = result.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSecretScanFailClosedFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-fail-closed-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-scan-fail-closed-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-fail-closed-rows.v1", "secret_scan_fail_closed_rows", result.secret_scan_fail_closed_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-fail-closed-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-fail-closed-gate-rows.v1", "secret_scan_fail_closed_gate_rows", result.secret_scan_fail_closed_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-fail-closed-boundary.json"), result.secret_scan_fail_closed_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-fail-closed-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSecretScanFailClosedFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSecretScanFailClosedFixtures(args);
    console.log(`Trading secret scan remediation receipt chain secret scan remediation receipt chain secret scan fail-closed fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures_status}`);
    console.log(`Secret scan fail-closed rows: ${result.summary.ready_secret_scan_fail_closed_row_count}/${result.summary.secret_scan_fail_closed_row_count}`);
    console.log(`Secret scan fail-closed gates: ${result.summary.ready_secret_scan_fail_closed_gate_count}/${result.summary.secret_scan_fail_closed_gate_count}`);
    console.log(`Fail-closed gate results: ${result.summary.fail_closed_gate_result_count}/${result.summary.expected_fail_closed_kind_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildFailClosedCoverage({ secretScanAttention, secretsScanGate }) {
  const gateRows = secretsScanGate.secrets_scan_gate_results ?? [];
  const gateByKind = new Map(gateRows.map((row) => [row.leakage_kind, row]));
  const failClosedByKind = Object.fromEntries(EXPECTED_FAIL_CLOSED_KINDS.map((kind) => [kind, isFailClosedGateRow(gateByKind.get(kind))]));
  const cleanBaselineByKind = Object.fromEntries(EXPECTED_FAIL_CLOSED_KINDS.map((kind) => [kind, isCleanBaselineGateRow(gateByKind.get(kind))]));
  const statusMatchesByKind = Object.fromEntries(EXPECTED_FAIL_CLOSED_KINDS.map((kind) => [kind, gateStatusMatchesObservation(gateByKind.get(kind))]));
  const failClosedKinds = EXPECTED_FAIL_CLOSED_KINDS.filter((kind) => failClosedByKind[kind]);
  const cleanKinds = EXPECTED_FAIL_CLOSED_KINDS.filter((kind) => cleanBaselineByKind[kind]);
  const statusMatchKinds = EXPECTED_FAIL_CLOSED_KINDS.filter((kind) => statusMatchesByKind[kind]);
  const p300Summary = secretsScanGate.summary ?? {};
  const p300Boundary = secretsScanGate.secrets_scan_boundary ?? {};
  return {
    p478_ready: secretScanAttention.validation.valid && secretScanAttention.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures_status === SOURCE_READY_STATUS,
    p300_complete: secretsScanGate.validation.valid && p300Summary.secrets_scan_gate_status === SECRETS_SCAN_GATE_READY_STATUS,
    expected_fail_closed_kind_count: EXPECTED_FAIL_CLOSED_KINDS.length,
    p300_gate_result_count: gateRows.length,
    fail_closed_by_kind: failClosedByKind,
    clean_baseline_by_kind: cleanBaselineByKind,
    gate_status_matches_by_kind: statusMatchesByKind,
    fail_closed_kind_count: failClosedKinds.length,
    clean_baseline_gate_count: cleanKinds.length,
    gate_status_match_count: statusMatchKinds.length,
    all_gate_rows_fail_closed: failClosedKinds.length === EXPECTED_FAIL_CLOSED_KINDS.length,
    all_gate_statuses_match_observation: statusMatchKinds.length === EXPECTED_FAIL_CLOSED_KINDS.length,
    clean_baseline_has_no_leakage: cleanKinds.length === EXPECTED_FAIL_CLOSED_KINDS.length
      && p300Summary.leakage_allowed_count === 0
      && p300Summary.credential_leakage_detected_count === 0
      && p300Summary.token_leakage_detected_count === 0
      && p300Summary.env_leakage_detected_count === 0
      && p300Summary.desktop_config_leakage_detected_count === 0
      && p300Summary.provider_key_leakage_detected_count === 0,
    credential_leakage_fail_closed: Boolean(failClosedByKind.credential_material),
    token_leakage_fail_closed: Boolean(failClosedByKind.raw_token_material),
    env_leakage_fail_closed: Boolean(failClosedByKind.env_file),
    desktop_config_leakage_fail_closed: Boolean(failClosedByKind.desktop_config),
    provider_key_leakage_fail_closed: Boolean(failClosedByKind.provider_api_key && failClosedByKind.desktop_provider_key),
    no_secret_material_read: p300Summary.secret_material_read === false
      && p300Summary.secret_material_materialized === false
      && p300Summary.env_file_read === false
      && p300Summary.desktop_config_read === false
      && p300Boundary.secret_material_read === false
      && p300Boundary.secret_material_materialized === false
      && p300Boundary.env_file_read === false
      && p300Boundary.desktop_config_read === false
      && secretScanAttention.summary.no_secret_material_read === true
      && secretScanAttention.summary.secret_values_read === false
      && secretScanAttention.summary.env_file_read === false
      && secretScanAttention.summary.desktop_config_content_inspected === false
      && secretScanAttention.summary.desktop_config_read === false
      && secretScanAttention.summary.desktop_provider_key_visible === false
      && secretScanAttention.summary.secret_scan_remediation_action_allowed === false,
    no_secret_or_trading_mutation: secretScanAttention.summary.no_secret_or_trading_mutation === true
      && secretScanAttention.summary.secret_scan_remediation_action_allowed === false
      && secretScanAttention.summary.credential_lookup_allowed === false
      && secretScanAttention.summary.broker_write_allowed === false
      && secretScanAttention.summary.exchange_write_allowed === false
      && secretScanAttention.summary.command_execution_performed === false
      && secretScanAttention.summary.artifact_write_performed === false
      && secretScanAttention.summary.protected_action_executed === false
      && p300Boundary.desktop_setting_mutation_allowed === false
      && p300Boundary.network_access_performed === false
      && p300Boundary.route_execution_performed === false
      && p300Boundary.server_started === false
      && p300Boundary.protected_action_executed === false
      && p300Boundary.delivery_execution_performed === false,
  };
}

function buildFailClosedAnchor({ secretScanAttention, secretsScanGate, coverage }) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-fail-closed-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures_id: secretScanAttention.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures_id,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_status: secretScanAttention.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures_status,
    source_secrets_scan_gate_id: secretsScanGate.secrets_scan_gate_id,
    source_secrets_scan_gate_status: secretsScanGate.summary.secrets_scan_gate_status,
    required_row_count: REQUIRED_ROW_KEYS.length,
    required_row_keys: REQUIRED_ROW_KEYS,
    expected_fail_closed_kinds: EXPECTED_FAIL_CLOSED_KINDS,
    coverage_hash: hashValue(coverage),
    source_hash: hashValue({
      p478_id: secretScanAttention.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures_id,
      p478_status: secretScanAttention.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures_status,
      p300_id: secretsScanGate.secrets_scan_gate_id,
      p300_status: secretsScanGate.summary.secrets_scan_gate_status,
      p300_gate_result_count: secretsScanGate.summary.gate_result_count,
    }),
  };
}

function buildFailClosedRows({ sourceReady, secretsScanGateComplete, coverage, secretScanAttention, secretsScanGate }) {
  const rowInputs = [
    failClosedRowInput("p478_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_ready", "trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention", "summary", [], [
      condition("source.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures_status", secretScanAttention.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures_status, SOURCE_READY_STATUS),
      condition("source.ready_secret_scan_attention_row_count", secretScanAttention.summary.ready_secret_scan_attention_row_count, 8),
      condition("source.no_secret_material_read", secretScanAttention.summary.no_secret_material_read, true),
      condition("source.no_secret_or_trading_mutation", secretScanAttention.summary.no_secret_or_trading_mutation, true),
      condition("source.secret_scan_remediation_action_allowed", secretScanAttention.summary.secret_scan_remediation_action_allowed, false),
      condition("source.desktop_config_read", secretScanAttention.summary.desktop_config_read, false),
    ]),
    failClosedRowInput("secrets_scan_gate_complete", "secrets_scan_gate", "summary", EXPECTED_FAIL_CLOSED_KINDS, [
      condition("p300.secrets_scan_gate_status", secretsScanGate.summary.secrets_scan_gate_status, SECRETS_SCAN_GATE_READY_STATUS),
      condition("p300.gate_fail_on_leakage_count", secretsScanGate.summary.gate_fail_on_leakage_count, EXPECTED_FAIL_CLOSED_KINDS.length),
      condition("p300.leakage_allowed_count", secretsScanGate.summary.leakage_allowed_count, 0),
    ]),
    categoryRowInput("secrets_scan_gate_fail_on_credential_leakage", ["credential_material"], coverage),
    categoryRowInput("secrets_scan_gate_fail_on_token_leakage", ["raw_token_material"], coverage),
    categoryRowInput("secrets_scan_gate_fail_on_env_leakage", ["env_file"], coverage),
    categoryRowInput("secrets_scan_gate_fail_on_provider_key_leakage", ["provider_api_key", "desktop_provider_key"], coverage),
    categoryRowInput("secrets_scan_gate_fail_on_desktop_config_leakage", ["desktop_config"], coverage),
    failClosedRowInput("secrets_scan_gate_no_secret_material_read", "secrets_scan_boundary", "boundary", EXPECTED_FAIL_CLOSED_KINDS, [
      condition("boundary.no_secret_material_read", coverage.no_secret_material_read, true),
      condition("boundary.no_secret_or_trading_mutation", coverage.no_secret_or_trading_mutation, true),
      condition("boundary.clean_baseline_has_no_leakage", coverage.clean_baseline_has_no_leakage, true),
    ]),
  ];
  return rowInputs.map((input, index) => buildFailClosedRow(input, sourceReady, secretsScanGateComplete, coverage, index));
}

function categoryRowInput(rowKey, leakageKinds, coverage) {
  return failClosedRowInput(rowKey, "secrets_scan_gate_results", leakageKinds.join(","), leakageKinds, [
    ...leakageKinds.flatMap((kind) => [
      condition(`gate.${kind}.fail_closed`, coverage.fail_closed_by_kind[kind], true),
      condition(`gate.${kind}.status_matches_observation`, coverage.gate_status_matches_by_kind[kind], true),
      condition(`gate.${kind}.clean_baseline_no_leakage`, coverage.clean_baseline_by_kind[kind], true),
    ]),
  ]);
}

function failClosedRowInput(rowKey, artifactId, evidencePath, leakageKinds, observedConditions) {
  return { rowKey, artifactId, evidencePath, leakageKinds, observedConditions };
}

function buildFailClosedRow(input, sourceReady, secretsScanGateComplete, coverage, index) {
  const unsafeConditions = input.observedConditions.filter((item) => item.observed_value !== item.expected_safe_value || !item.condition_present);
  const relatedKinds = input.leakageKinds.length > 0 ? input.leakageKinds : EXPECTED_FAIL_CLOSED_KINDS;
  const relatedFailClosed = relatedKinds.every((kind) => coverage.fail_closed_by_kind[kind]);
  const relatedClean = relatedKinds.every((kind) => coverage.clean_baseline_by_kind[kind]);
  const relatedStatusMatches = relatedKinds.every((kind) => coverage.gate_status_matches_by_kind[kind]);
  const syntheticProbeStatus = relatedFailClosed ? "fail_closed" : "open";
  const rowReady = sourceReady && secretsScanGateComplete && unsafeConditions.length === 0 && relatedFailClosed && relatedClean && relatedStatusMatches;
  const row = {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-fail-closed-row.v1",
    secret_scan_fail_closed_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-fail-closed.row.${input.rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: input.rowKey,
    artifact_id: input.artifactId,
    evidence_path: input.evidencePath,
    leakage_kinds: input.leakageKinds,
    observed_conditions: input.observedConditions,
    observed_condition_count: input.observedConditions.length,
    unsafe_condition_refs: unsafeConditions.map((item) => item.condition_path),
    secret_scan_fail_closed_status: rowReady ? READY_STATUS : "blocked",
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_ready: sourceReady,
    secrets_scan_gate_complete: secretsScanGateComplete,
    gate_decision_fail_on_leakage: relatedFailClosed,
    gate_fail_on_leakage: relatedFailClosed,
    leakage_allowed: false,
    fail_closed_on_leakage: relatedFailClosed && syntheticProbeStatus === "fail_closed",
    clean_baseline_no_leakage: relatedClean,
    gate_status_matches_observation: relatedStatusMatches,
    synthetic_leakage_probe_detected: true,
    synthetic_leakage_probe_status: syntheticProbeStatus,
    synthetic_leakage_probe_expected_gate_status: "failed",
    synthetic_probe_materialized_secret_value: false,
    synthetic_probe_read_secret_value: false,
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
    source_artifact_read_performed: true,
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
  return withOrdinalAndHash(row, index, "secret_scan_fail_closed_hash");
}

function buildFailClosedBoundary({ generatedAt, writeRequested, sourceReady, secretsScanGateComplete, coverage, secretScanAttention, secretsScanGate, rows }) {
  const p300Summary = secretsScanGate.summary ?? {};
  const p300Boundary = secretsScanGate.secrets_scan_boundary ?? {};
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-fail-closed-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_scan_fail_closed_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_status: secretScanAttention.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures_status,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_ready: sourceReady,
    source_secrets_scan_gate_status: p300Summary.secrets_scan_gate_status,
    secrets_scan_gate_complete: secretsScanGateComplete,
    expected_fail_closed_kind_count: coverage.expected_fail_closed_kind_count,
    p300_gate_result_count: coverage.p300_gate_result_count,
    fail_closed_gate_result_count: coverage.fail_closed_kind_count,
    clean_baseline_gate_count: coverage.clean_baseline_gate_count,
    gate_status_match_count: coverage.gate_status_match_count,
    secret_scan_fail_closed_row_count: rows.length,
    ready_secret_scan_fail_closed_row_count: rows.filter((row) => row.secret_scan_fail_closed_status === READY_STATUS).length,
    all_gate_rows_fail_closed: coverage.all_gate_rows_fail_closed,
    all_gate_statuses_match_observation: coverage.all_gate_statuses_match_observation,
    clean_baseline_has_no_leakage: coverage.clean_baseline_has_no_leakage,
    credential_leakage_fail_closed: coverage.credential_leakage_fail_closed,
    token_leakage_fail_closed: coverage.token_leakage_fail_closed,
    env_leakage_fail_closed: coverage.env_leakage_fail_closed,
    desktop_config_leakage_fail_closed: coverage.desktop_config_leakage_fail_closed,
    provider_key_leakage_fail_closed: coverage.provider_key_leakage_fail_closed,
    no_secret_material_read: coverage.no_secret_material_read,
    no_secret_or_trading_mutation: coverage.no_secret_or_trading_mutation,
    source_artifact_read_performed: p300Summary.source_artifact_read_performed === true,
    source_content_read_performed: p300Summary.source_content_read_performed === true,
    source_ingest_performed: p300Summary.source_ingest_performed === true,
    filesystem_secret_scan_performed: p300Summary.filesystem_secret_scan_performed === true,
    raw_secret_material_materialized: p300Summary.secret_material_materialized === true || secretScanAttention.summary.raw_secret_material_materialized === true,
    raw_secret_material_exposed: Number(p300Summary.raw_secret_material_exposed_count ?? 0) > 0 || secretScanAttention.summary.raw_secret_material_exposed === true,
    provider_key_material_present: Number(p300Summary.provider_key_direct_access_allowed_count ?? 0) > 0 || Number(p300Summary.desktop_provider_key_visible_count ?? 0) > 0 || secretScanAttention.summary.provider_key_material_present === true,
    environment_dump_present: secretScanAttention.summary.environment_dump_present === true,
    desktop_provider_key_visible: Number(p300Summary.desktop_provider_key_visible_count ?? 0) > 0 || secretScanAttention.summary.desktop_provider_key_visible === true,
    secret_values_read: p300Summary.secret_material_read === true || p300Boundary.secret_material_read === true || secretScanAttention.summary.secret_values_read === true,
    env_file_read: p300Summary.env_file_read === true || p300Boundary.env_file_read === true || secretScanAttention.summary.env_file_read === true,
    desktop_config_content_inspected: secretScanAttention.summary.desktop_config_content_inspected === true,
    desktop_config_read: p300Summary.desktop_config_read === true || p300Boundary.desktop_config_read === true || secretScanAttention.summary.desktop_config_read === true,
    secret_scan_remediation_action_allowed: secretScanAttention.summary.secret_scan_remediation_action_allowed === true,
    credential_lookup_allowed: secretScanAttention.summary.credential_lookup_allowed === true,
    plaintext_secret_allowed: false,
    model_context_secret_allowed: false,
    broker_write_allowed: secretScanAttention.summary.broker_write_allowed === true,
    exchange_write_allowed: secretScanAttention.summary.exchange_write_allowed === true,
    command_execution_performed: secretScanAttention.summary.command_execution_performed === true,
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: p300Boundary.protected_action_executed === true,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildFailClosedGateRows({ packageJson, platformOpsLedger, rows, boundary, sourceReady, secretsScanGateComplete, coverage }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const gateInputs = [
    ["p478_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_ready", "P478 secret scan attention source is ready.", sourceReady],
    ["p300_secrets_scan_gate_complete", "P300 Secrets Scan Gate is complete.", secretsScanGateComplete],
    ["platform_package_script_registered", "package.json registers the P479 trading secret scan fail-closed fixtures command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0],
    ["platform_validation_chain_registered", "Validation chain includes the P479 trading secret scan fail-closed fixtures command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)],
    ["p479_ledger_acceptance_declared", "P479 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P479: `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-fail-closed-fixtures`")],
    ["p300_gate_rows_fail_closed", "Every Secrets Scan Gate row is configured to fail on leakage.", coverage.all_gate_rows_fail_closed],
    ["p300_gate_status_matches_observation", "Every Secrets Scan Gate status matches its leakage observation.", coverage.all_gate_statuses_match_observation],
    ["clean_baseline_has_no_leakage", "The current P300 baseline observes no credential, token, env, Desktop config, or provider-key leakage.", coverage.clean_baseline_has_no_leakage],
    ["p300_boundary_no_secret_material_read", "P300 and P478 boundaries read no secret values, env files, or Desktop config content.", coverage.no_secret_material_read],
    ["no_secret_or_trading_mutation", "P479 performs no secret scan remediation action, credential lookup, trading writes, artifact mutation, release, git, or protected action.", boundary.no_secret_material_read && boundary.no_secret_or_trading_mutation && !boundary.secret_scan_remediation_action_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_read && !boundary.artifact_write_performed && !boundary.protected_action_executed],
  ];
  return gateInputs.map(([rowKey, description, passed], index) => withOrdinalAndHash(gateRow(rowKey, description, passed), index, "secret_scan_fail_closed_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-fail-closed-gate-row.v1",
    secret_scan_fail_closed_gate_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-fail-closed-fixtures.gate.${rowKey}`,
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

function buildValidationItems({ secretScanAttention, secretsScanGate, sources, rows, gateRows, boundary, coverage }) {
  return [
    validationItem("source.secret_scan_attention", "p478_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_ready", secretScanAttention.validation.valid && secretScanAttention.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures_status === SOURCE_READY_STATUS, "P478 secret scan attention fixtures must be ready."),
    validationItem("source.secrets_scan_gate", "p300_secrets_scan_gate_complete", secretsScanGate.validation.valid && secretsScanGate.summary.secrets_scan_gate_status === SECRETS_SCAN_GATE_READY_STATUS, "P300 Secrets Scan Gate must be complete."),
    validationItem("source.package_json", "package_json_available", sources.packageJson.available, "package.json is readable for P479 secret scan fail-closed fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", sources.platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("secret_scan_fail_closed_rows", "secret_scan_fail_closed_rows_ready", rows.length === REQUIRED_ROW_KEYS.length && REQUIRED_ROW_KEYS.every((rowKey) => rows.some((row) => row.row_key === rowKey)) && rows.every((row) => row.secret_scan_fail_closed_status === READY_STATUS), "All secret scan fail-closed rows must be ready."),
    validationItem("secret_scan_fail_closed_gate_rows", "secret_scan_fail_closed_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P479 secret scan fail-closed gates are ready."),
    validationItem("coverage.fail_closed", "all_gate_rows_fail_closed", coverage.all_gate_rows_fail_closed && coverage.fail_closed_kind_count === EXPECTED_FAIL_CLOSED_KINDS.length, "Every P300 Secrets Scan Gate row must fail on leakage."),
    validationItem("coverage.status_matches", "all_gate_statuses_match_observation", coverage.all_gate_statuses_match_observation, "Every P300 gate status must match leakage observation."),
    validationItem("coverage.clean_baseline", "clean_baseline_has_no_leakage", coverage.clean_baseline_has_no_leakage, "The current P300 baseline must show no leakage."),
    validationItem("coverage.credential", "credential_leakage_fail_closed", coverage.credential_leakage_fail_closed, "Credential material leakage must fail closed."),
    validationItem("coverage.token", "token_leakage_fail_closed", coverage.token_leakage_fail_closed, "Raw token leakage must fail closed."),
    validationItem("coverage.env", "env_leakage_fail_closed", coverage.env_leakage_fail_closed, "Environment-file leakage must fail closed."),
    validationItem("coverage.desktop", "desktop_config_leakage_fail_closed", coverage.desktop_config_leakage_fail_closed, "Desktop config leakage must fail closed."),
    validationItem("coverage.provider", "provider_key_leakage_fail_closed", coverage.provider_key_leakage_fail_closed, "Provider-key leakage must fail closed."),
    validationItem("boundary.no_secret_material_read", "no_secret_material_read", boundary.no_secret_material_read && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read && !boundary.desktop_provider_key_visible, "P479 reads no secret values, env files, Desktop config content, or Desktop provider keys."),
    validationItem("boundary.no_mutation", "no_secret_or_trading_mutation", boundary.no_secret_or_trading_mutation && !boundary.secret_scan_remediation_action_allowed && !boundary.credential_lookup_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.protected_action_executed, "P479 performs no secret scan remediation action, credential lookup, trading mutation, artifact mutation, or protected action."),
  ];
}

function buildSummary({ secretScanAttention, secretsScanGate, rows, gateRows, boundary, coverage, validation }) {
  return {
    trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_status: secretScanAttention.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_fixtures_status,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_ready: boundary.source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_ready,
    source_secrets_scan_gate_status: secretsScanGate.summary.secrets_scan_gate_status,
    secrets_scan_gate_complete: boundary.secrets_scan_gate_complete,
    required_row_count: REQUIRED_ROW_KEYS.length,
    secret_scan_fail_closed_row_count: rows.length,
    ready_secret_scan_fail_closed_row_count: boundary.ready_secret_scan_fail_closed_row_count,
    secret_scan_fail_closed_gate_count: gateRows.length,
    ready_secret_scan_fail_closed_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    expected_fail_closed_kind_count: coverage.expected_fail_closed_kind_count,
    p300_gate_result_count: coverage.p300_gate_result_count,
    fail_closed_gate_result_count: coverage.fail_closed_kind_count,
    clean_baseline_gate_count: coverage.clean_baseline_gate_count,
    gate_status_match_count: coverage.gate_status_match_count,
    all_gate_rows_fail_closed: coverage.all_gate_rows_fail_closed,
    all_gate_statuses_match_observation: coverage.all_gate_statuses_match_observation,
    clean_baseline_has_no_leakage: coverage.clean_baseline_has_no_leakage,
    credential_leakage_fail_closed: coverage.credential_leakage_fail_closed,
    token_leakage_fail_closed: coverage.token_leakage_fail_closed,
    env_leakage_fail_closed: coverage.env_leakage_fail_closed,
    desktop_config_leakage_fail_closed: coverage.desktop_config_leakage_fail_closed,
    provider_key_leakage_fail_closed: coverage.provider_key_leakage_fail_closed,
    no_secret_material_read: boundary.no_secret_material_read,
    no_secret_or_trading_mutation: boundary.no_secret_or_trading_mutation,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    source_artifact_read_performed: boundary.source_artifact_read_performed,
    source_content_read_performed: boundary.source_content_read_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    filesystem_secret_scan_performed: boundary.filesystem_secret_scan_performed,
    raw_secret_material_materialized: boundary.raw_secret_material_materialized,
    raw_secret_material_exposed: boundary.raw_secret_material_exposed,
    provider_key_material_present: boundary.provider_key_material_present,
    environment_dump_present: boundary.environment_dump_present,
    desktop_provider_key_visible: boundary.desktop_provider_key_visible,
    secret_scan_remediation_action_allowed: boundary.secret_scan_remediation_action_allowed,
    secret_values_read: boundary.secret_values_read,
    env_file_read: boundary.env_file_read,
    desktop_config_content_inspected: boundary.desktop_config_content_inspected,
    desktop_config_read: boundary.desktop_config_read,
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
    "# Trading Secret Scan Remediation Receipt Chain Secret Scan Remediation Receipt Chain Secret Scan Fail-Closed Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source secret scan attention: ${result.summary.source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_status}`,
    `P300 Secrets Scan Gate: ${result.summary.source_secrets_scan_gate_status}`,
    `Secret scan fail-closed rows: ${result.summary.ready_secret_scan_fail_closed_row_count}/${result.summary.secret_scan_fail_closed_row_count}`,
    `Secret scan fail-closed gates: ${result.summary.ready_secret_scan_fail_closed_gate_count}/${result.summary.secret_scan_fail_closed_gate_count}`,
    `Fail-closed gate results: ${result.summary.fail_closed_gate_result_count}/${result.summary.expected_fail_closed_kind_count}`,
    "",
    "## Rows",
    "",
    ...result.secret_scan_fail_closed_rows.map((row) => `- ${row.row_key}: ${row.secret_scan_fail_closed_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_scan_fail_closed_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function isFailClosedGateRow(row) {
  return row != null
    && row.gate_decision === "fail_on_leakage"
    && row.gate_fail_on_leakage === true
    && row.leakage_allowed === false
    && row.human_review_required === true
    && row.client_facing_ready === false;
}

function isCleanBaselineGateRow(row) {
  return row != null
    && row.leakage_detected === false
    && Number.isFinite(Number(row.observed_leakage_count))
    && Number(row.observed_leakage_count) === 0
    && row.gate_status === "passed";
}

function gateStatusMatchesObservation(row) {
  if (row == null) return false;
  if (row.leakage_detected === true) return row.gate_status === "failed";
  if (row.leakage_detected === false) return row.gate_status === "passed";
  return false;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-attention-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptChainSecretScanAttentionSchemaPath = argv[++index];
    else if (arg === "--secrets-broker-contract") parsed.secretsBrokerContractPath = argv[++index];
    else if (arg === "--dev-protected-scan") parsed.devProtectedScanPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-fail-closed-fixtures.mjs [options]

Options:
  --out-dir <folder>                         Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_OUT_DIR}
  --run-at <iso>                             Deterministic generated_at timestamp.
  --package <path>                           package.json path.
  --platform-ops-ledger <path>               P341-P500 platform operations ledger path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-secret-scan-attention-schema <path>
                                             P478 secret scan attention fixtures schema path.
  --secrets-broker-contract <path>           P300 Secrets Broker Contract source path.
  --dev-protected-scan <path>                P300 Dev Protected Scan source path.
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
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.platformOpsLedgerPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_secret_scan_attention_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptChainSecretScanAttentionSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptChainSecretScanAttentionSchemaPath),
    external_model_policy_audit_path: path.resolve(options.externalModelPolicyAuditPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.externalModelPolicyAuditPath),
    secrets_broker_contract_path: path.resolve(options.secretsBrokerContractPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.secretsBrokerContractPath),
    protected_file_gate_path: path.resolve(options.protectedFileGatePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.protectedFileGatePath),
    dev_protected_scan_path: path.resolve(options.devProtectedScanPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.devProtectedScanPath),
    connector_freeze_path: path.resolve(options.connectorFreezePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.connectorFreezePath),
    connector_contract_v2_path: path.resolve(options.connectorContractV2Path ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.connectorContractV2Path),
    expansion_quarantine_ledger_path: path.resolve(options.expansionQuarantineLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.expansionQuarantineLedgerPath),
    runtime_api_dashboard_path: path.resolve(options.runtimeApiDashboardPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.runtimeApiDashboardPath),
    capability_registry_api_path: path.resolve(options.capabilityRegistryApiPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.capabilityRegistryApiPath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.roadmapPath),
    implementation_roadmap_path: path.resolve(options.implementationRoadmapPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.implementationRoadmapPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.reviewDashboardPath),
    review_dashboard_source_path: path.resolve(options.reviewDashboardSourcePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.reviewDashboardSourcePath),
    review_api_path: path.resolve(options.reviewApiPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.reviewApiPath),
    review_api_source_path: path.resolve(options.reviewApiSourcePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.reviewApiSourcePath),
    review_api_doc_path: path.resolve(options.reviewApiDocPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.reviewApiDocPath),
    secrets_scan_gate_doc_path: path.resolve(options.secretsScanGateDocPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.secretsScanGateDocPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.schemaPath),
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
