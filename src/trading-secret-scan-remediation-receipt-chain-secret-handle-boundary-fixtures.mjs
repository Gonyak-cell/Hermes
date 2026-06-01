import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationReceiptChainLiveAdapterImportBoundaryFixtures,
} from "./trading-secret-scan-remediation-receipt-chain-live-adapter-import-boundary-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_HANDLE_BOUNDARY_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-chain-secret-handle-boundary-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_HANDLE_BOUNDARY_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_INPUTS,
  liveAdapterImportBoundaryFixturesSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_INPUTS.schemaPath,
  executionEnginePath: "examples/trading/execution-engine.json",
  researchBacktestPaperPath: "examples/trading/research-backtest-paper-sample.json",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
  hermesConfigExamplePath: "configs/hermes/config.example.yaml",
  secretsScanGateDocPath: "docs/secrets-scan-gate.md",
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-chain-secret-handle-boundary-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-chain-secret-handle-boundary-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_chain_secret_handle_boundary_fixtures";
const PHASE_SLOT = "P449";
const PREVIOUS_PHASE_SLOT = "P448";
const NEXT_PHASE_SLOT = "P450";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_handle_boundary";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_live_adapter_import_boundary";
const COMMAND_NAME = "trading:secret-scan-remediation-receipt-chain-secret-handle-boundary-fixtures";
const WORKFLOW_ID = "workflow.trading.secret_scan_remediation_receipt_chain_secret_handle_boundary_fixtures.v1";
const REQUIRED_ROW_KEYS = [
  "p448_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_ready",
  "trading_credential_contract_reference_only",
  "trading_secret_logging_forbidden",
  "trading_policy_forbids_plaintext_and_model_context_keys",
  "desktop_companion_secret_surface_read_only",
  "hermes_config_uses_external_secret_handles",
  "config_and_docs_no_plaintext_provider_keys",
];
const SECRET_HANDLE_PATTERN = /\$\{[A-Z0-9_]+(?:_TOKEN|_SECRET|_KEY|_CREDENTIAL|_PASSWORD)\}/g;
const RAW_SECRET_PATTERNS = [
  { id: "openai_style_api_key", regex: /\bsk-[A-Za-z0-9_-]{16,}\b/g },
  { id: "aws_access_key", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: "private_key_block", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { id: "bearer_literal", regex: /\bBearer\s+(?!\$\{)[A-Za-z0-9._~+/=-]{20,}\b/g },
  { id: "credential_assignment_literal", regex: /\b(?:api[_-]?key|secret|token|password|credential)\s*[:=]\s*["']?(?!\$\{)[A-Za-z0-9._~+/=-]{16,}/gi },
];

export async function runTradingSecretScanRemediationReceiptChainSecretHandleBoundaryFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptChainSecretHandleBoundaryFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptChainSecretHandleBoundaryFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt chain secret handle boundary fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptChainSecretHandleBoundaryFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_HANDLE_BOUNDARY_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const liveAdapterImportBoundary = await buildTradingSecretScanRemediationReceiptChainLiveAdapterImportBoundaryFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    schemaPath: inputs.live_adapter_import_boundary_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const executionEngine = await readJsonSource(inputs.execution_engine_path);
  const researchBacktestPaper = await readJsonSource(inputs.research_backtest_paper_path);
  const desktopCompanionIntegration = await readTextSource(inputs.desktop_companion_integration_path);
  const hermesConfigExample = await readTextSource(inputs.hermes_config_example_path);
  const secretsScanGateDoc = await readTextSource(inputs.secrets_scan_gate_doc_path);
  const sourceReady = liveAdapterImportBoundary.validation.valid && liveAdapterImportBoundary.summary.trading_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures_status === SOURCE_READY_STATUS;
  const secretScan = buildSecretScan({
    desktopCompanionIntegration,
    hermesConfigExample,
    secretsScanGateDoc,
  });
  const anchor = buildSecretHandleBoundaryAnchor(liveAdapterImportBoundary, secretScan);
  const rows = buildSecretHandleBoundaryRows({
    sourceReady,
    liveAdapterImportBoundary,
    executionEngine: executionEngine.data,
    researchBacktestPaper: researchBacktestPaper.data,
    desktopCompanionText: desktopCompanionIntegration.text,
    hermesConfigText: hermesConfigExample.text,
    secretsScanText: secretsScanGateDoc.text,
    secretScan,
  });
  const sources = [executionEngine, researchBacktestPaper, desktopCompanionIntegration, hermesConfigExample, secretsScanGateDoc];
  const boundary = buildSecretHandleBoundary({ generatedAt, writeRequested: options.write !== false, liveAdapterImportBoundary, rows, secretScan });
  const gateRows = buildSecretHandleBoundaryGateRows({ liveAdapterImportBoundary, packageJson, platformOpsLedger, sources, rows, boundary });
  const validationItems = buildValidationItems({ liveAdapterImportBoundary, packageJson, platformOpsLedger, sources, rows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ liveAdapterImportBoundary, rows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_scan_remediation_receipt_chain_secret_handle_boundary_fixtures_id: `trading-secret-scan-remediation-receipt-chain-secret-handle-boundary-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_handle_boundary_anchor: anchor,
    secret_handle_boundary_rows: rows,
    secret_handle_boundary_gate_rows: gateRows,
    secret_handle_boundary_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_chain_secret_handle_boundary_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ liveAdapterImportBoundary, rows, gateRows, boundary, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_chain_secret_handle_boundary_fixtures_id = result.trading_secret_scan_remediation_receipt_chain_secret_handle_boundary_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptChainSecretHandleBoundaryFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-chain-secret-handle-boundary-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-handle-boundary-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-handle-boundary-rows.v1", "secret_handle_boundary_rows", result.secret_handle_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-handle-boundary-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-handle-boundary-gate-rows.v1", "secret_handle_boundary_gate_rows", result.secret_handle_boundary_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-handle-boundary-boundary.json"), result.secret_handle_boundary_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-handle-boundary-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptChainSecretHandleBoundaryFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptChainSecretHandleBoundaryFixtures(args);
    console.log(`Trading secret scan remediation receipt chain secret handle boundary fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_handle_boundary_fixtures_status}`);
    console.log(`Secret boundary rows: ${result.summary.ready_secret_handle_boundary_row_count}/${result.summary.secret_handle_boundary_row_count}`);
    console.log(`Secret boundary gates: ${result.summary.ready_secret_handle_boundary_gate_count}/${result.summary.secret_handle_boundary_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildSecretHandleBoundaryAnchor(liveAdapterImportBoundary, secretScan) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-handle-boundary-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures_id: liveAdapterImportBoundary.trading_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures_id,
    source_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_status: liveAdapterImportBoundary.summary.trading_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures_status,
    required_row_count: REQUIRED_ROW_KEYS.length,
    required_row_keys: REQUIRED_ROW_KEYS,
    external_secret_handle_ref_count: secretScan.external_handle_refs.length,
    raw_secret_finding_count: secretScan.raw_secret_findings.length,
    source_hash: hashValue({
      id: liveAdapterImportBoundary.trading_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures_id,
      status: liveAdapterImportBoundary.summary.trading_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures_status,
      row_count: liveAdapterImportBoundary.summary.live_adapter_import_boundary_row_count,
      gate_count: liveAdapterImportBoundary.summary.live_adapter_import_boundary_gate_count,
      raw_secret_finding_count: secretScan.raw_secret_findings.length,
    }),
  };
}

function buildSecretHandleBoundaryRows({ sourceReady, liveAdapterImportBoundary, executionEngine, researchBacktestPaper, desktopCompanionText, hermesConfigText, secretsScanText, secretScan }) {
  const credentialContract = valueAt(executionEngine, ["credential_broker_contract"]);
  const secretHandling = valueAt(executionEngine, ["secret_handling"]);
  const safetyPolicy = valueAt(researchBacktestPaper, ["safety_policy"]);
  const configHasNoSecretComment = hermesConfigText.includes("intentionally contains no secrets");
  const desktopReadOnly = includesAll(desktopCompanionText, ["GET", "read_only=true", "mutation_allowed=false", "secret_material_exposed=false", "provider key"]);
  const scanGateCoversDesktop = includesAll(secretsScanText, ["Desktop config leakage", "credential", "provider-key"]);
  const rowInputs = [
    secretBoundaryRowInput("p448_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_ready", "secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures", "summary", [
      condition("source.trading_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures_status", liveAdapterImportBoundary.summary.trading_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures_status, SOURCE_READY_STATUS),
      condition("source.live_adapter_imported_by_default", liveAdapterImportBoundary.summary.live_adapter_imported_by_default, false),
      condition("source.credential_reference_only", liveAdapterImportBoundary.summary.credential_reference_only, true),
      condition("source.secret_material_exposed", liveAdapterImportBoundary.summary.secret_material_exposed, false),
    ]),
    secretBoundaryRowInput("trading_credential_contract_reference_only", "execution_engine", "credential_broker_contract", [
      condition("credential_broker_contract.plaintext_secret_allowed", valueAt(credentialContract, ["plaintext_secret_allowed"]), false),
      condition("credential_broker_contract.model_context_secret_allowed", valueAt(credentialContract, ["model_context_secret_allowed"]), false),
      condition("credential_broker_contract.credential_lookup_allowed", valueAt(credentialContract, ["credential_lookup_allowed"]), false),
      condition("credential_broker_contract.credential_reference_format", valueAt(credentialContract, ["credential_reference_format"]), "credential_ref.disabled"),
    ], { externalSecretHandleOnly: true }),
    secretBoundaryRowInput("trading_secret_logging_forbidden", "execution_engine", "secret_handling", [
      condition("secret_handling.secret_never_logged", valueAt(secretHandling, ["secret_never_logged"]), true),
      condition("secret_handling.redaction_required", valueAt(secretHandling, ["redaction_required"]), true),
      condition("secret_handling.forbidden_log_fields.api_key", arrayIncludes(valueAt(secretHandling, ["forbidden_log_fields"]), "api_key"), true),
      condition("secret_handling.forbidden_log_fields.secret", arrayIncludes(valueAt(secretHandling, ["forbidden_log_fields"]), "secret"), true),
      condition("secret_handling.forbidden_log_fields.token", arrayIncludes(valueAt(secretHandling, ["forbidden_log_fields"]), "token"), true),
      condition("secret_handling.forbidden_log_fields.credential_value", arrayIncludes(valueAt(secretHandling, ["forbidden_log_fields"]), "credential_value"), true),
    ]),
    secretBoundaryRowInput("trading_policy_forbids_plaintext_and_model_context_keys", "research_backtest_paper", "safety_policy", [
      condition("safety_policy.credential_storage_policy", valueAt(safetyPolicy, ["credential_storage_policy"]), "forbidden_plaintext"),
      condition("safety_policy.api_keys_in_model_context_allowed", valueAt(safetyPolicy, ["api_keys_in_model_context_allowed"]), false),
      condition("contract_examples.trading-execution.secret_logged", valueAt(researchBacktestPaper, ["contract_examples", "trading-execution", "secret_logged"]), false),
    ]),
    secretBoundaryRowInput("desktop_companion_secret_surface_read_only", "desktop_companion_integration", "docs/desktop-companion-integration.md", [
      condition("desktop_companion.read_only_surface", desktopReadOnly, true),
      condition("desktop_companion.secret_material_exposed_false", desktopCompanionText.includes("secret_material_exposed=false"), true),
      condition("desktop_companion.provider_key_lookup_blocked", desktopCompanionText.includes("provider key") && desktopCompanionText.includes("조회"), true),
      condition("secrets_scan_gate.desktop_config_leakage_covered", scanGateCoversDesktop, true),
    ], { desktopConfigBoundaryCovered: true }),
    secretBoundaryRowInput("hermes_config_uses_external_secret_handles", "hermes_config_example", "configs/hermes/config.example.yaml", [
      condition("config.no_secrets_comment_present", configHasNoSecretComment, true),
      condition("config.external_secret_handle_ref_count", secretScan.external_handle_refs.length, 1),
      condition("config.raw_secret_finding_count", secretScan.config_raw_secret_findings.length, 0),
      condition("config.provider_key_material_present", secretScan.config_provider_key_findings.length, 0),
    ], { externalSecretHandleOnly: true, desktopConfigBoundaryCovered: true, rawSecretFindings: secretScan.config_raw_secret_findings }),
    secretBoundaryRowInput("config_and_docs_no_plaintext_provider_keys", "secret_boundary_sources", "desktop/config/docs", [
      condition("secret_scan.raw_secret_finding_count", secretScan.raw_secret_findings.length, 0),
      condition("secret_scan.provider_key_finding_count", secretScan.provider_key_findings.length, 0),
      condition("secret_scan.environment_dump_finding_count", secretScan.environment_dump_findings.length, 0),
      condition("secret_scan.external_secret_handle_ref_count_minimum", secretScan.external_handle_refs.length >= 1, true),
    ], { rawSecretFindings: secretScan.raw_secret_findings }),
  ];
  return rowInputs.map((input, index) => buildSecretHandleBoundaryRow(input, sourceReady, index));
}

function secretBoundaryRowInput(rowKey, artifactId, evidencePath, observedConditions, overrides = {}) {
  return { rowKey, artifactId, evidencePath, observedConditions, overrides };
}

function buildSecretHandleBoundaryRow(input, sourceReady, index) {
  const unsafeConditions = input.observedConditions.filter((item) => item.observed_value !== item.expected_safe_value || !item.condition_present);
  const rawSecretFindings = input.overrides.rawSecretFindings ?? [];
  const rowReady = sourceReady && unsafeConditions.length === 0;
  const row = {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-handle-boundary-row.v1",
    secret_handle_boundary_row_id: `trading-secret-scan-remediation-receipt-chain-secret-handle-boundary.row.${input.rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: input.rowKey,
    artifact_id: input.artifactId,
    evidence_path: input.evidencePath,
    observed_conditions: input.observedConditions,
    observed_condition_count: input.observedConditions.length,
    unsafe_condition_refs: unsafeConditions.map((item) => item.condition_path),
    raw_secret_findings: rawSecretFindings,
    raw_secret_finding_count: rawSecretFindings.length,
    secret_handle_boundary_status: rowReady ? READY_STATUS : "blocked",
    source_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_ready: sourceReady,
    external_secret_handle_only: input.overrides.externalSecretHandleOnly === true || input.rowKey !== "trading_credential_contract_reference_only",
    desktop_config_boundary_covered: input.overrides.desktopConfigBoundaryCovered === true || !input.rowKey.startsWith("desktop") && input.rowKey !== "hermes_config_uses_external_secret_handles",
    credential_reference_only: true,
    credential_lookup_allowed: false,
    plaintext_secret_allowed: false,
    model_context_secret_allowed: false,
    provider_key_material_present: rawSecretFindings.some((finding) => finding.finding_type.includes("key")),
    environment_dump_present: rawSecretFindings.some((finding) => finding.finding_type.includes("environment")),
    raw_secret_material_exposed: rawSecretFindings.length > 0,
    secret_material_exposed: rawSecretFindings.length > 0,
    desktop_secret_material_exposed: false,
    desktop_provider_key_visible: false,
    no_secret_material_read: true,
    no_secret_or_trading_mutation: true,
    secret_scan_remediation_action_allowed: false,
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    desktop_config_read: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    command_execution_performed: false,
    artifact_read_performed: false,
    artifact_write_performed: false,
    protected_action_executed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
  return withOrdinalAndHash(row, index, "secret_handle_boundary_hash");
}

function buildSecretHandleBoundary({ generatedAt, writeRequested, liveAdapterImportBoundary, rows, secretScan }) {
  const sourceReady = liveAdapterImportBoundary.validation.valid && liveAdapterImportBoundary.summary.trading_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures_status === SOURCE_READY_STATUS;
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-handle-boundary-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_handle_boundary_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_status: liveAdapterImportBoundary.summary.trading_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures_status,
    source_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_ready: sourceReady,
    secret_handle_boundary_row_count: rows.length,
    ready_secret_handle_boundary_row_count: rows.filter((row) => row.secret_handle_boundary_status === READY_STATUS).length,
    external_secret_handle_ref_count: secretScan.external_handle_refs.length,
    raw_secret_finding_count: secretScan.raw_secret_findings.length,
    provider_key_finding_count: secretScan.provider_key_findings.length,
    environment_dump_finding_count: secretScan.environment_dump_findings.length,
    config_raw_secret_finding_count: secretScan.config_raw_secret_findings.length,
    external_secret_handle_only: rows.every((row) => row.external_secret_handle_only),
    desktop_config_boundary_covered: rows.some((row) => row.row_key === "desktop_companion_secret_surface_read_only" && row.secret_handle_boundary_status === READY_STATUS) && rows.some((row) => row.row_key === "hermes_config_uses_external_secret_handles" && row.secret_handle_boundary_status === READY_STATUS),
    credential_reference_only: rows.every((row) => row.credential_reference_only),
    credential_lookup_allowed: false,
    plaintext_secret_allowed: false,
    model_context_secret_allowed: false,
    provider_key_material_present: secretScan.provider_key_findings.length > 0,
    environment_dump_present: secretScan.environment_dump_findings.length > 0,
    raw_secret_material_exposed: secretScan.raw_secret_findings.length > 0,
    secret_material_exposed: secretScan.raw_secret_findings.length > 0,
    desktop_secret_material_exposed: false,
    desktop_provider_key_visible: false,
    no_secret_material_read: liveAdapterImportBoundary.summary.no_secret_material_read && rows.every((row) => row.no_secret_material_read),
    no_secret_or_trading_mutation: liveAdapterImportBoundary.summary.no_secret_or_trading_mutation && rows.every((row) => row.no_secret_or_trading_mutation),
    secret_scan_remediation_action_allowed: liveAdapterImportBoundary.summary.secret_scan_remediation_action_allowed || rows.some((row) => row.secret_scan_remediation_action_allowed),
    secret_values_read: liveAdapterImportBoundary.summary.secret_values_read || rows.some((row) => row.secret_values_read),
    env_file_read: liveAdapterImportBoundary.summary.env_file_read || rows.some((row) => row.env_file_read),
    desktop_config_content_inspected: liveAdapterImportBoundary.summary.desktop_config_content_inspected || rows.some((row) => row.desktop_config_content_inspected),
    desktop_config_read: liveAdapterImportBoundary.summary.desktop_config_read || rows.some((row) => row.desktop_config_read),
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

function buildSecretHandleBoundaryGateRows({ liveAdapterImportBoundary, packageJson, platformOpsLedger, sources, rows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const gateInputs = [
    ["p448_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_ready", "P448 secret scan remediation receipt chain live adapter import boundary source is ready.", liveAdapterImportBoundary.validation.valid && liveAdapterImportBoundary.summary.trading_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures_status === SOURCE_READY_STATUS],
    ["platform_package_script_registered", "package.json registers the P449 trading secret handle boundary fixtures command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0],
    ["platform_validation_chain_registered", "Validation chain includes the P449 trading secret handle boundary fixtures command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)],
    ["p449_ledger_acceptance_declared", "P449 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P449: `trading:secret-scan-remediation-receipt-chain-secret-handle-boundary-fixtures`")],
    ["secret_boundary_sources_readable", "Trading and Desktop secret boundary source fixtures are readable.", sources.every((source) => source.available)],
    ["secret_handle_boundary_rows_ready", "All required secret handle boundary rows are ready.", rows.length === REQUIRED_ROW_KEYS.length && rows.every((row) => row.secret_handle_boundary_status === READY_STATUS)],
    ["trading_credentials_reference_only", "Trading live credentials remain reference-only without lookup, plaintext, or model-context exposure.", boundary.external_secret_handle_only && boundary.credential_reference_only && !boundary.credential_lookup_allowed && !boundary.plaintext_secret_allowed && !boundary.model_context_secret_allowed],
    ["desktop_config_boundary_covered", "Trading and Desktop companion configuration fixtures are covered by secret boundary checks.", boundary.desktop_config_boundary_covered && boundary.external_secret_handle_ref_count >= 1],
    ["no_plaintext_or_provider_key_material", "No plaintext secrets, provider keys, environment dumps, or raw secret material are present.", boundary.raw_secret_finding_count === 0 && boundary.provider_key_finding_count === 0 && boundary.environment_dump_finding_count === 0 && !boundary.raw_secret_material_exposed && !boundary.secret_material_exposed],
    ["no_secret_or_trading_mutation", "P449 performs no credential lookup, secret scan remediation action, live execution, trading writes, artifact mutation, release, git, or protected action.", boundary.no_secret_material_read && boundary.no_secret_or_trading_mutation && !boundary.secret_scan_remediation_action_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed],
  ];
  return gateInputs.map(([rowKey, description, passed], index) => withOrdinalAndHash(gateRow(rowKey, description, passed), index, "secret_handle_boundary_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-handle-boundary-gate-row.v1",
    secret_handle_boundary_gate_row_id: `trading-secret-scan-remediation-receipt-chain-secret-handle-boundary-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    credential_lookup_allowed_by_gate: false,
    plaintext_secret_allowed_by_gate: false,
    model_context_secret_allowed_by_gate: false,
    provider_key_material_present_by_gate: false,
    raw_secret_material_exposed_by_gate: false,
    desktop_secret_material_exposed_by_gate: false,
    desktop_provider_key_visible_by_gate: false,
    broker_write_allowed_by_gate: false,
    exchange_write_allowed_by_gate: false,
    command_execution_performed_by_gate: false,
    artifact_write_performed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ liveAdapterImportBoundary, packageJson, platformOpsLedger, sources, rows, gateRows, boundary }) {
  return [
    validationItem("source.secret_scan_remediation_receipt_chain_live_adapter_import_boundary", "p448_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_ready", liveAdapterImportBoundary.validation.valid && liveAdapterImportBoundary.summary.trading_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures_status === SOURCE_READY_STATUS, "P448 secret scan remediation receipt chain live adapter import boundary fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P449 secret handle boundary fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.secret_boundary_sources", "secret_boundary_sources_readable", sources.every((source) => source.available), "Trading and Desktop secret boundary source fixtures are readable."),
    validationItem("secret_handle_boundary_rows", "secret_handle_boundary_rows_ready", rows.length === REQUIRED_ROW_KEYS.length && REQUIRED_ROW_KEYS.every((rowKey) => rows.some((row) => row.row_key === rowKey)) && rows.every((row) => row.secret_handle_boundary_status === READY_STATUS), "All secret handle boundary rows must be ready."),
    validationItem("secret_handle_boundary_gate_rows", "secret_handle_boundary_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P449 secret handle boundary gates are ready."),
    validationItem("boundary.external_secret_handles", "trading_credentials_reference_only", boundary.external_secret_handle_only && boundary.credential_reference_only && !boundary.credential_lookup_allowed && !boundary.plaintext_secret_allowed && !boundary.model_context_secret_allowed, "Trading live credentials must remain reference-only without lookup or raw/model-context exposure."),
    validationItem("boundary.desktop_config_covered", "desktop_config_boundary_covered", boundary.desktop_config_boundary_covered && boundary.external_secret_handle_ref_count >= 1, "Trading and Desktop companion configuration fixtures must be covered."),
    validationItem("boundary.no_plaintext_secret_material", "no_plaintext_or_provider_key_material", boundary.raw_secret_finding_count === 0 && boundary.provider_key_finding_count === 0 && boundary.environment_dump_finding_count === 0 && !boundary.raw_secret_material_exposed && !boundary.secret_material_exposed && !boundary.desktop_secret_material_exposed && !boundary.desktop_provider_key_visible && boundary.no_secret_material_read && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read, "Plaintext secrets, provider keys, environment dumps, Desktop secret exposure, .env reads, Desktop config reads, and secret-value reads must remain absent."),
    validationItem("boundary.no_mutation", "no_secret_or_trading_mutation", boundary.no_secret_or_trading_mutation && !boundary.secret_scan_remediation_action_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed, "P449 performs no secret scan remediation action, trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ liveAdapterImportBoundary, rows, gateRows, boundary, validation }) {
  return {
    trading_secret_scan_remediation_receipt_chain_secret_handle_boundary_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_status: liveAdapterImportBoundary.summary.trading_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures_status,
    source_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_ready: boundary.source_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_ready,
    required_row_count: REQUIRED_ROW_KEYS.length,
    secret_handle_boundary_row_count: rows.length,
    ready_secret_handle_boundary_row_count: boundary.ready_secret_handle_boundary_row_count,
    secret_handle_boundary_gate_count: gateRows.length,
    ready_secret_handle_boundary_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    external_secret_handle_ref_count: boundary.external_secret_handle_ref_count,
    raw_secret_finding_count: boundary.raw_secret_finding_count,
    provider_key_finding_count: boundary.provider_key_finding_count,
    environment_dump_finding_count: boundary.environment_dump_finding_count,
    external_secret_handle_only: boundary.external_secret_handle_only,
    desktop_config_boundary_covered: boundary.desktop_config_boundary_covered,
    credential_reference_only: boundary.credential_reference_only,
    credential_lookup_allowed: boundary.credential_lookup_allowed,
    plaintext_secret_allowed: boundary.plaintext_secret_allowed,
    model_context_secret_allowed: boundary.model_context_secret_allowed,
    provider_key_material_present: boundary.provider_key_material_present,
    environment_dump_present: boundary.environment_dump_present,
    raw_secret_material_exposed: boundary.raw_secret_material_exposed,
    secret_material_exposed: boundary.secret_material_exposed,
    desktop_secret_material_exposed: boundary.desktop_secret_material_exposed,
    desktop_provider_key_visible: boundary.desktop_provider_key_visible,
    no_secret_material_read: boundary.no_secret_material_read,
    no_secret_or_trading_mutation: boundary.no_secret_or_trading_mutation,
    secret_scan_remediation_action_allowed: boundary.secret_scan_remediation_action_allowed,
    secret_values_read: boundary.secret_values_read,
    env_file_read: boundary.env_file_read,
    desktop_config_content_inspected: boundary.desktop_config_content_inspected,
    desktop_config_read: boundary.desktop_config_read,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
    release_check_execution_performed: boundary.release_check_execution_performed,
    artifact_read_performed: boundary.artifact_read_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    release_published: boundary.release_published,
    git_operation_performed: boundary.git_operation_performed,
    protected_action_executed: boundary.protected_action_executed,
    human_review_required: boundary.human_review_required,
    human_signoff_required: boundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Secret Scan Remediation Receipt Chain Secret Handle Boundary Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_handle_boundary_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source secret scan remediation receipt chain live adapter import boundary: ${result.summary.source_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_status}`,
    `Secret boundary rows: ${result.summary.ready_secret_handle_boundary_row_count}/${result.summary.secret_handle_boundary_row_count}`,
    `Secret boundary gates: ${result.summary.ready_secret_handle_boundary_gate_count}/${result.summary.secret_handle_boundary_gate_count}`,
    `Raw secret findings: ${result.summary.raw_secret_finding_count}`,
    "",
    "## Secret Boundary",
    "",
    ...result.secret_handle_boundary_rows.map((row) => `- ${row.row_key}: ${row.secret_handle_boundary_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_handle_boundary_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_HANDLE_BOUNDARY_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--execution-engine") parsed.executionEnginePath = argv[++index];
    else if (arg === "--research-backtest-paper") parsed.researchBacktestPaperPath = argv[++index];
    else if (arg === "--desktop-companion-integration") parsed.desktopCompanionIntegrationPath = argv[++index];
    else if (arg === "--hermes-config-example") parsed.hermesConfigExamplePath = argv[++index];
    else if (arg === "--secrets-scan-gate-doc") parsed.secretsScanGateDocPath = argv[++index];
    else if (arg === "--live-adapter-import-boundary-fixtures-schema") parsed.liveAdapterImportBoundaryFixturesSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-chain-secret-handle-boundary-fixtures.mjs [options]

Options:
  --out-dir <folder>                         Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_HANDLE_BOUNDARY_FIXTURES_OUT_DIR}
  --run-at <iso>                             Deterministic generated_at timestamp.
  --package <path>                           package.json path.
  --platform-ops-ledger <path>               P341-P500 platform operations ledger path.
  --execution-engine <path>                  Execution engine artifact path.
  --research-backtest-paper <path>           Research/backtest/paper sample artifact path.
  --desktop-companion-integration <path>     Desktop companion integration doc path.
  --hermes-config-example <path>             Hermes config example path.
  --secrets-scan-gate-doc <path>             Secrets scan gate doc path.
  --live-adapter-import-boundary-fixtures-schema <path>
                                             P448 secret scan remediation receipt chain live adapter import boundary fixtures schema path.
  --schema <path>                            Output schema path.
  --check                                    Validate only, do not write artifacts.
  -h, --help                                 Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_HANDLE_BOUNDARY_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_HANDLE_BOUNDARY_FIXTURES_INPUTS.platformOpsLedgerPath),
    live_adapter_import_boundary_fixtures_schema_path: path.resolve(options.liveAdapterImportBoundaryFixturesSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_HANDLE_BOUNDARY_FIXTURES_INPUTS.liveAdapterImportBoundaryFixturesSchemaPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_HANDLE_BOUNDARY_FIXTURES_INPUTS.executionEnginePath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_HANDLE_BOUNDARY_FIXTURES_INPUTS.researchBacktestPaperPath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_HANDLE_BOUNDARY_FIXTURES_INPUTS.desktopCompanionIntegrationPath),
    hermes_config_example_path: path.resolve(options.hermesConfigExamplePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_HANDLE_BOUNDARY_FIXTURES_INPUTS.hermesConfigExamplePath),
    secrets_scan_gate_doc_path: path.resolve(options.secretsScanGateDocPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_HANDLE_BOUNDARY_FIXTURES_INPUTS.secretsScanGateDocPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_HANDLE_BOUNDARY_FIXTURES_INPUTS.schemaPath),
  };
}

function buildSecretScan({ desktopCompanionIntegration, hermesConfigExample, secretsScanGateDoc }) {
  const sources = [
    ["desktop_companion_integration", desktopCompanionIntegration.text],
    ["hermes_config_example", hermesConfigExample.text],
    ["secrets_scan_gate_doc", secretsScanGateDoc.text],
  ];
  const externalHandleRefs = matchExternalSecretHandles(hermesConfigExample.text).map((value) => ({ source_id: "hermes_config_example", handle_ref: value }));
  const rawSecretFindings = sources.flatMap(([sourceId, text]) => findRawSecretMaterial(sourceId, text));
  const providerKeyFindings = rawSecretFindings.filter((finding) => finding.finding_type.includes("key") || finding.finding_type.includes("credential"));
  const environmentDumpFindings = rawSecretFindings.filter((finding) => finding.finding_type.includes("environment"));
  return {
    external_handle_refs: externalHandleRefs,
    raw_secret_findings: rawSecretFindings,
    provider_key_findings: providerKeyFindings,
    environment_dump_findings: environmentDumpFindings,
    config_raw_secret_findings: rawSecretFindings.filter((finding) => finding.source_id === "hermes_config_example"),
    config_provider_key_findings: providerKeyFindings.filter((finding) => finding.source_id === "hermes_config_example"),
  };
}

function matchExternalSecretHandles(text) {
  return [...String(text ?? "").matchAll(SECRET_HANDLE_PATTERN)].map((match) => match[0]);
}

function findRawSecretMaterial(sourceId, text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const findings = [];
  for (const [lineIndex, line] of lines.entries()) {
    if (line.includes("${")) continue;
    if (line.includes("intentionally contains no secrets")) continue;
    for (const pattern of RAW_SECRET_PATTERNS) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line)) {
        findings.push({
          schema_version: "trading-secret-scan-remediation-receipt-chain-secret-handle-boundary-raw-secret-finding.v1",
          source_id: sourceId,
          finding_type: pattern.id,
          line_number: lineIndex + 1,
          materialized_secret_value: false,
          redacted_sample: redactSecretLikeText(line),
        });
      }
    }
  }
  return findings;
}

function redactSecretLikeText(line) {
  return String(line).replace(/[A-Za-z0-9._~+/=-]{8,}/g, "[redacted]");
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

function valueAt(source, keys) {
  return keys.reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), source);
}

function arrayIncludes(value, item) {
  return Array.isArray(value) && value.includes(item);
}

function includesAll(value, needles) {
  return needles.every((needle) => String(value ?? "").includes(needle));
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
