import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_BROKER_ADAPTER_SEPARATION_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainBrokerAdapterSeparationFixtures,
} from "./trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-broker-adapter-separation-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-live-adapter-import-boundary-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_BROKER_ADAPTER_SEPARATION_FIXTURES_INPUTS,
  brokerAdapterSeparationFixturesSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_BROKER_ADAPTER_SEPARATION_FIXTURES_INPUTS.schemaPath,
  executionEnginePath: "examples/trading/execution-engine.json",
  paperShadowPath: "examples/trading/paper-shadow-live.json",
  limitedLivePath: "examples/trading/limited-live-governance.json",
  fullAutoPath: "examples/trading/full-auto-governance.json",
  researchBacktestPaperPath: "examples/trading/research-backtest-paper-sample.json",
  packManifestPath: "packs/trading/pack.json",
  capabilityPath: "packs/trading/capabilities/research-backtest-paper.json",
  futureLiveAdapterPath: "src/trading-live-adapter.future.disabled.mjs",
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-live-adapter-import-boundary-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-live-adapter-import-boundary-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures";
const PHASE_SLOT = "P474";
const PREVIOUS_PHASE_SLOT = "P473";
const NEXT_PHASE_SLOT = "P475";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_live_adapter_import_boundary";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation";
const COMMAND_NAME = "trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-live-adapter-import-boundary-fixtures";
const WORKFLOW_ID = "workflow.trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures.v1";
const REQUIRED_ROW_KEYS = [
  "p473_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_ready",
  "package_scripts_no_future_live_adapter_import",
  "validate_chain_no_future_live_adapter_import",
  "pack_manifest_no_future_live_adapter_import",
  "capability_entrypoints_no_future_live_adapter_import",
  "governance_default_paths_no_live_import",
  "future_live_adapter_reference_non_executable",
];
const PROHIBITED_IMPORT_PATTERNS = [
  "scripts/trading-live-adapter.mjs",
  "src/trading-live-adapter.mjs",
  "node scripts/trading-live-adapter.mjs",
  "node src/trading-live-adapter.mjs",
  "--enable-live-adapter",
  "--import-live-adapter",
  "enable_live_adapter",
  "live_adapter_imported_by_default=true",
  "live_adapter_enabled=true",
  "LIVE_BROKER_API_KEY=",
  "LIVE_EXCHANGE_API_KEY=",
];

export async function runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainLiveAdapterImportBoundaryFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainLiveAdapterImportBoundaryFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainLiveAdapterImportBoundaryFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt chain secret scan remediation receipt chain live adapter import boundary fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainLiveAdapterImportBoundaryFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const brokerAdapterSeparation = await buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainBrokerAdapterSeparationFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    schemaPath: inputs.broker_adapter_separation_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const executionEngine = await readJsonSource(inputs.execution_engine_path);
  const paperShadow = await readJsonSource(inputs.paper_shadow_path);
  const limitedLive = await readJsonSource(inputs.limited_live_path);
  const fullAuto = await readJsonSource(inputs.full_auto_path);
  const researchBacktestPaper = await readJsonSource(inputs.research_backtest_paper_path);
  const packManifest = await readJsonSource(inputs.pack_manifest_path);
  const capability = await readJsonSource(inputs.capability_path);
  const sourceReady = brokerAdapterSeparation.validation.valid && brokerAdapterSeparation.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_fixtures_status === SOURCE_READY_STATUS;
  const importRefs = buildImportReferenceScan({ packageJson, packManifest, capability });
  const anchor = buildLiveAdapterImportBoundaryAnchor(brokerAdapterSeparation, importRefs);
  const rows = buildLiveAdapterImportBoundaryRows({
    sourceReady,
    brokerAdapterSeparation,
    packageJson: packageJson.data,
    packManifest: packManifest.data,
    capability: capability.data,
    executionEngine: executionEngine.data,
    paperShadow: paperShadow.data,
    limitedLive: limitedLive.data,
    fullAuto: fullAuto.data,
    researchBacktestPaper: researchBacktestPaper.data,
    futureLiveAdapterPath: inputs.future_live_adapter_path,
    importRefs,
  });
  const sources = [executionEngine, paperShadow, limitedLive, fullAuto, researchBacktestPaper, packManifest, capability];
  const boundary = buildLiveAdapterImportBoundary({ generatedAt, writeRequested: options.write !== false, brokerAdapterSeparation, rows, importRefs, futureLiveAdapterPath: inputs.future_live_adapter_path });
  const gateRows = buildLiveAdapterImportBoundaryGateRows({ brokerAdapterSeparation, packageJson, platformOpsLedger, packManifest, capability, sources, rows, boundary });
  const validationItems = buildValidationItems({ brokerAdapterSeparation, packageJson, platformOpsLedger, packManifest, capability, sources, rows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ brokerAdapterSeparation, rows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-live-adapter-import-boundary-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    live_adapter_import_boundary_anchor: anchor,
    live_adapter_import_boundary_rows: rows,
    live_adapter_import_boundary_gate_rows: gateRows,
    live_adapter_import_boundary_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ brokerAdapterSeparation, rows, gateRows, boundary, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures_id = result.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainLiveAdapterImportBoundaryFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-live-adapter-import-boundary-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "live-adapter-import-boundary-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-live-adapter-import-boundary-rows.v1", "live_adapter_import_boundary_rows", result.live_adapter_import_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "live-adapter-import-boundary-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-live-adapter-import-boundary-gate-rows.v1", "live_adapter_import_boundary_gate_rows", result.live_adapter_import_boundary_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "live-adapter-import-boundary-boundary.json"), result.live_adapter_import_boundary_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-live-adapter-import-boundary-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainLiveAdapterImportBoundaryFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainLiveAdapterImportBoundaryFixtures(args);
    console.log(`Trading secret scan remediation receipt chain secret scan remediation receipt chain live adapter import boundary fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures_status}`);
    console.log(`Import boundary rows: ${result.summary.ready_live_adapter_import_boundary_row_count}/${result.summary.live_adapter_import_boundary_row_count}`);
    console.log(`Import boundary gates: ${result.summary.ready_live_adapter_import_boundary_gate_count}/${result.summary.live_adapter_import_boundary_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildLiveAdapterImportBoundaryAnchor(brokerAdapterSeparation, importRefs) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-live-adapter-import-boundary-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_fixtures_id: brokerAdapterSeparation.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_fixtures_id,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_status: brokerAdapterSeparation.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_fixtures_status,
    required_row_count: REQUIRED_ROW_KEYS.length,
    required_row_keys: REQUIRED_ROW_KEYS,
    prohibited_import_pattern_count: PROHIBITED_IMPORT_PATTERNS.length,
    prohibited_import_ref_count: importRefs.all.length,
    source_hash: hashValue({
      id: brokerAdapterSeparation.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_fixtures_id,
      status: brokerAdapterSeparation.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_fixtures_status,
      row_count: brokerAdapterSeparation.summary.adapter_separation_row_count,
      gate_count: brokerAdapterSeparation.summary.adapter_separation_gate_count,
      prohibited_import_ref_count: importRefs.all.length,
    }),
  };
}

function buildLiveAdapterImportBoundaryRows({ sourceReady, brokerAdapterSeparation, packageJson, packManifest, capability, executionEngine, paperShadow, limitedLive, fullAuto, researchBacktestPaper, futureLiveAdapterPath, importRefs }) {
  const validateScript = packageJson?.scripts?.validate ?? "";
  const scriptRegistered = typeof packageJson?.scripts?.[COMMAND_NAME] === "string" && packageJson.scripts[COMMAND_NAME].length > 0;
  const workflowRegistered = Array.isArray(packManifest?.workflows) && packManifest.workflows.includes(WORKFLOW_ID);
  const schemaRegistered = Array.isArray(packManifest?.schemas) && packManifest.schemas.includes(DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_INPUTS.schemaPath);
  const entrypointRegistered = Array.isArray(capability?.entrypoints) && capability.entrypoints.some((entrypoint) => entrypoint?.name === COMMAND_NAME && entrypoint?.path === "scripts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-live-adapter-import-boundary-fixtures.mjs");
  const credentialContract = valueAt(executionEngine, ["credential_broker_contract"]);
  const secretHandling = valueAt(executionEngine, ["secret_handling"]);
  const safetyPolicy = valueAt(researchBacktestPaper, ["safety_policy"]);
  const rowInputs = [
    liveImportRowInput("p473_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_ready", "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_fixtures", "summary", [
      condition("source.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_fixtures_status", brokerAdapterSeparation.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_fixtures_status, SOURCE_READY_STATUS),
      condition("source.default_control_plane_imports_live_adapter", brokerAdapterSeparation.summary.default_control_plane_imports_live_adapter, false),
      condition("source.live_adapter_imported_by_default", brokerAdapterSeparation.summary.live_adapter_imported_by_default, false),
      condition("source.live_adapter_enabled", brokerAdapterSeparation.summary.live_adapter_enabled, false),
      condition("source.credential_reference_only", brokerAdapterSeparation.summary.credential_reference_only, true),
    ]),
    liveImportRowInput("package_scripts_no_future_live_adapter_import", "package_json", "scripts", [
      condition("package.scripts.prohibited_live_adapter_import_ref_count", importRefs.packageScripts.length, 0),
      condition(`package.scripts.${COMMAND_NAME}.registered`, scriptRegistered, true),
      condition("package.scripts.validate.contains_p474_check", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`), true),
    ], { prohibitedRefs: importRefs.packageScripts }),
    liveImportRowInput("validate_chain_no_future_live_adapter_import", "package_json", "scripts.validate", [
      condition("package.scripts.validate.prohibited_live_adapter_import_ref_count", importRefs.validateScript.length, 0),
      condition("package.scripts.validate.contains_p473_check", validateScript.includes("npm run trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-broker-adapter-separation-fixtures -- --check"), true),
      condition("package.scripts.validate.contains_p474_check", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`), true),
    ], { prohibitedRefs: importRefs.validateScript }),
    liveImportRowInput("pack_manifest_no_future_live_adapter_import", "packs.trading.pack", "schemas/workflows", [
      condition("pack_manifest.prohibited_live_adapter_import_ref_count", importRefs.packManifest.length, 0),
      condition("pack_manifest.workflow_registered", workflowRegistered, true),
      condition("pack_manifest.schema_registered", schemaRegistered, true),
    ], { prohibitedRefs: importRefs.packManifest }),
    liveImportRowInput("capability_entrypoints_no_future_live_adapter_import", "packs.trading.research_backtest_paper", "entrypoints", [
      condition("capability.entrypoints.prohibited_live_adapter_import_ref_count", importRefs.capability.length, 0),
      condition("capability.entrypoint_registered", entrypointRegistered, true),
    ], { prohibitedRefs: importRefs.capability }),
    liveImportRowInput("governance_default_paths_no_live_import", "trading_governance_artifacts", "execution/paper/limited/full_auto", [
      condition("execution_engine.safety_boundary.live_adapter_enabled", valueAt(executionEngine, ["safety_boundary", "live_adapter_enabled"]), false),
      condition("execution_engine.safety_boundary.live_execution_allowed", valueAt(executionEngine, ["safety_boundary", "live_execution_allowed"]), false),
      condition("execution_engine.execution_artifacts.live_disabled_state_blocked", artifactState(executionEngine, "live_disabled"), "blocked"),
      condition("paper_shadow.read_only_live_data_adapter.order_routes_enabled", valueAt(paperShadow, ["read_only_live_data_adapter", "order_routes_enabled"]), false),
      condition("paper_shadow.read_only_live_data_adapter.external_network_required", valueAt(paperShadow, ["read_only_live_data_adapter", "external_network_required"]), false),
      condition("limited_live.safety_boundary.live_order_submission_allowed", valueAt(limitedLive, ["safety_boundary", "live_order_submission_allowed"]), false),
      condition("full_auto.failover.live_adapter_required", valueAt(fullAuto, ["failover_policies", "broker_exchange_failover", "live_adapter_required"]), false),
    ]),
    liveImportRowInput("future_live_adapter_reference_non_executable", "future_live_adapter_reference", futureLiveAdapterPath, [
      condition("future_live_adapter_file_may_exist", true, true),
      condition("future_live_adapter_default_import_allowed", false, false),
      condition("future_live_adapter_file_read_performed", false, false),
      condition("future_live_adapter_file_import_performed", false, false),
      condition("future_live_adapter_file_execution_performed", false, false),
      condition("credential_broker_contract.credential_lookup_allowed", valueAt(credentialContract, ["credential_lookup_allowed"]), false),
      condition("credential_broker_contract.plaintext_secret_allowed", valueAt(credentialContract, ["plaintext_secret_allowed"]), false),
      condition("credential_broker_contract.model_context_secret_allowed", valueAt(credentialContract, ["model_context_secret_allowed"]), false),
      condition("secret_handling.secret_never_logged", valueAt(secretHandling, ["secret_never_logged"]), true),
      condition("safety_policy.api_keys_in_model_context_allowed", valueAt(safetyPolicy, ["api_keys_in_model_context_allowed"]), false),
    ], { futureLiveAdapterPath }),
  ];
  return rowInputs.map((input, index) => buildLiveAdapterImportBoundaryRow(input, sourceReady, index));
}

function liveImportRowInput(rowKey, artifactId, evidencePath, observedConditions, overrides = {}) {
  return { rowKey, artifactId, evidencePath, observedConditions, overrides };
}

function buildLiveAdapterImportBoundaryRow(input, sourceReady, index) {
  const unsafeConditions = input.observedConditions.filter((item) => item.observed_value !== item.expected_safe_value || !item.condition_present);
  const prohibitedRefs = input.overrides.prohibitedRefs ?? [];
  const importDetected = prohibitedRefs.length > 0;
  const rowReady = sourceReady && unsafeConditions.length === 0;
  const row = {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-live-adapter-import-boundary-row.v1",
    live_adapter_import_boundary_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-live-adapter-import-boundary.row.${input.rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: input.rowKey,
    artifact_id: input.artifactId,
    evidence_path: input.evidencePath,
    observed_conditions: input.observedConditions,
    observed_condition_count: input.observedConditions.length,
    unsafe_condition_refs: unsafeConditions.map((item) => item.condition_path),
    prohibited_import_refs: prohibitedRefs,
    prohibited_import_ref_count: prohibitedRefs.length,
    live_adapter_import_boundary_status: rowReady ? READY_STATUS : "blocked",
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_ready: sourceReady,
    future_live_adapter_path: input.overrides.futureLiveAdapterPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_INPUTS.futureLiveAdapterPath,
    future_live_adapter_file_may_exist: true,
    future_live_adapter_default_import_allowed: false,
    default_control_plane_imports_live_adapter: importDetected,
    live_adapter_imported_by_default: importDetected,
    live_adapter_enabled: unsafeConditions.some((item) => item.condition_path.endsWith("live_adapter_enabled")),
    live_adapter_file_read_performed: false,
    live_adapter_file_import_performed: false,
    live_adapter_file_execution_performed: false,
    credential_reference_only: true,
    credential_lookup_allowed: false,
    plaintext_secret_allowed: false,
    provider_key_material_present: false,
    environment_dump_present: false,
    secret_material_exposed: false,
    raw_secret_material_materialized: false,
    raw_secret_material_exposed: false,
    desktop_provider_key_visible: false,
    forbidden_receipt_fields_allowed: false,
    no_secret_material_read: true,
    no_secret_or_trading_mutation: true,
    secret_scan_remediation_action_allowed: false,
    auto_fix_command_registered: false,
    auto_redaction_allowed: false,
    auto_deletion_allowed: false,
    auto_rotation_allowed: false,
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
  return withOrdinalAndHash(row, index, "live_adapter_import_boundary_hash");
}

function buildLiveAdapterImportBoundary({ generatedAt, writeRequested, brokerAdapterSeparation, rows, importRefs, futureLiveAdapterPath }) {
  const sourceReady = brokerAdapterSeparation.validation.valid && brokerAdapterSeparation.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_fixtures_status === SOURCE_READY_STATUS;
  const prohibitedImportRefCount = importRefs.all.length;
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-live-adapter-import-boundary-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    live_adapter_import_boundary_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_status: brokerAdapterSeparation.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_fixtures_status,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_ready: sourceReady,
    live_adapter_import_boundary_row_count: rows.length,
    ready_live_adapter_import_boundary_row_count: rows.filter((row) => row.live_adapter_import_boundary_status === READY_STATUS).length,
    prohibited_import_pattern_count: PROHIBITED_IMPORT_PATTERNS.length,
    prohibited_import_ref_count: prohibitedImportRefCount,
    package_scripts_prohibited_import_ref_count: importRefs.packageScripts.length,
    validate_chain_prohibited_import_ref_count: importRefs.validateScript.length,
    pack_manifest_prohibited_import_ref_count: importRefs.packManifest.length,
    capability_entrypoints_prohibited_import_ref_count: importRefs.capability.length,
    future_live_adapter_path: futureLiveAdapterPath,
    future_live_adapter_file_may_exist: true,
    future_live_adapter_default_import_allowed: false,
    default_control_plane_imports_live_adapter: prohibitedImportRefCount > 0 || brokerAdapterSeparation.summary.default_control_plane_imports_live_adapter,
    live_adapter_imported_by_default: prohibitedImportRefCount > 0 || brokerAdapterSeparation.summary.live_adapter_imported_by_default,
    live_adapter_enabled: brokerAdapterSeparation.summary.live_adapter_enabled || rows.some((row) => row.live_adapter_enabled),
    live_adapter_file_read_performed: false,
    live_adapter_file_import_performed: false,
    live_adapter_file_execution_performed: false,
    credential_reference_only: brokerAdapterSeparation.summary.credential_reference_only && rows.every((row) => row.credential_reference_only),
    credential_lookup_allowed: brokerAdapterSeparation.summary.credential_lookup_allowed || rows.some((row) => row.credential_lookup_allowed),
    plaintext_secret_allowed: brokerAdapterSeparation.summary.plaintext_secret_allowed || rows.some((row) => row.plaintext_secret_allowed),
    provider_key_material_present: false,
    environment_dump_present: false,
    secret_material_exposed: false,
    raw_secret_material_materialized: brokerAdapterSeparation.summary.raw_secret_material_materialized === true || rows.some((row) => row.raw_secret_material_materialized),
    raw_secret_material_exposed: brokerAdapterSeparation.summary.raw_secret_material_exposed === true || rows.some((row) => row.raw_secret_material_exposed),
    desktop_provider_key_visible: brokerAdapterSeparation.summary.desktop_provider_key_visible === true || rows.some((row) => row.desktop_provider_key_visible),
    forbidden_receipt_fields_allowed: brokerAdapterSeparation.summary.forbidden_receipt_fields_allowed === true || rows.some((row) => row.forbidden_receipt_fields_allowed),
    no_secret_material_read: brokerAdapterSeparation.summary.no_secret_material_read && rows.every((row) => row.no_secret_material_read),
    no_secret_or_trading_mutation: brokerAdapterSeparation.summary.no_secret_or_trading_mutation && rows.every((row) => row.no_secret_or_trading_mutation),
    secret_scan_remediation_action_allowed: brokerAdapterSeparation.summary.secret_scan_remediation_action_allowed || rows.some((row) => row.secret_scan_remediation_action_allowed),
    auto_fix_command_registered: brokerAdapterSeparation.summary.auto_fix_command_registered === true || rows.some((row) => row.auto_fix_command_registered),
    auto_redaction_allowed: brokerAdapterSeparation.summary.auto_redaction_allowed === true || rows.some((row) => row.auto_redaction_allowed),
    auto_deletion_allowed: brokerAdapterSeparation.summary.auto_deletion_allowed === true || rows.some((row) => row.auto_deletion_allowed),
    auto_rotation_allowed: brokerAdapterSeparation.summary.auto_rotation_allowed === true || rows.some((row) => row.auto_rotation_allowed),
    secret_values_read: brokerAdapterSeparation.summary.secret_values_read || rows.some((row) => row.secret_values_read),
    env_file_read: brokerAdapterSeparation.summary.env_file_read || rows.some((row) => row.env_file_read),
    desktop_config_content_inspected: brokerAdapterSeparation.summary.desktop_config_content_inspected || rows.some((row) => row.desktop_config_content_inspected),
    desktop_config_read: brokerAdapterSeparation.summary.desktop_config_read || rows.some((row) => row.desktop_config_read),
    broker_write_allowed: brokerAdapterSeparation.summary.broker_write_allowed || rows.some((row) => row.broker_write_allowed),
    exchange_write_allowed: brokerAdapterSeparation.summary.exchange_write_allowed || rows.some((row) => row.exchange_write_allowed),
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

function buildLiveAdapterImportBoundaryGateRows({ brokerAdapterSeparation, packageJson, platformOpsLedger, packManifest, capability, sources, rows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const gateInputs = [
    ["p473_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_ready", "P473 secret scan remediation receipt chain secret scan remediation receipt chain broker adapter separation source is ready.", brokerAdapterSeparation.validation.valid && brokerAdapterSeparation.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_fixtures_status === SOURCE_READY_STATUS],
    ["platform_package_script_registered", "package.json registers the P474 trading live adapter import boundary fixtures command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0],
    ["platform_validation_chain_registered", "Validation chain includes the P474 trading live adapter import boundary fixtures command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)],
    ["p474_ledger_acceptance_declared", "P474 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P474: `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-live-adapter-import-boundary-fixtures`")],
    ["import_boundary_sources_readable", "Live adapter import boundary source artifacts are readable.", sources.every((source) => source.available) && packManifest.available && capability.available],
    ["import_boundary_rows_ready", "All required live adapter import boundary rows are ready.", rows.length === REQUIRED_ROW_KEYS.length && rows.every((row) => row.live_adapter_import_boundary_status === READY_STATUS)],
    ["default_package_and_validate_no_live_import", "Default package and validation paths contain no prohibited future live-adapter imports.", boundary.package_scripts_prohibited_import_ref_count === 0 && boundary.validate_chain_prohibited_import_ref_count === 0],
    ["pack_and_capability_no_live_import", "Trading pack manifest and capability entrypoints contain no prohibited future live-adapter imports.", boundary.pack_manifest_prohibited_import_ref_count === 0 && boundary.capability_entrypoints_prohibited_import_ref_count === 0],
    ["future_live_adapter_reference_non_executable", "Future live adapter path is reference-only and is not read, imported, or executed.", boundary.future_live_adapter_file_may_exist && !boundary.future_live_adapter_default_import_allowed && !boundary.live_adapter_file_read_performed && !boundary.live_adapter_file_import_performed && !boundary.live_adapter_file_execution_performed],
    ["no_secret_or_trading_mutation", "P474 keeps credentials reference-only and performs no secret scan remediation action, trading, artifact, release, git, or protected mutation.", boundary.credential_reference_only && !boundary.credential_lookup_allowed && !boundary.plaintext_secret_allowed && !boundary.provider_key_material_present && !boundary.environment_dump_present && !boundary.secret_material_exposed && !boundary.raw_secret_material_materialized && !boundary.raw_secret_material_exposed && !boundary.desktop_provider_key_visible && !boundary.forbidden_receipt_fields_allowed && boundary.no_secret_material_read && boundary.no_secret_or_trading_mutation && !boundary.secret_scan_remediation_action_allowed && !boundary.auto_fix_command_registered && !boundary.auto_redaction_allowed && !boundary.auto_deletion_allowed && !boundary.auto_rotation_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed],
  ];
  return gateInputs.map(([rowKey, description, passed], index) => withOrdinalAndHash(gateRow(rowKey, description, passed), index, "live_adapter_import_boundary_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-live-adapter-import-boundary-gate-row.v1",
    live_adapter_import_boundary_gate_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-live-adapter-import-boundary-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    live_adapter_imported_by_gate: false,
    live_adapter_enabled_by_gate: false,
    live_adapter_file_read_performed_by_gate: false,
    live_adapter_file_import_performed_by_gate: false,
    live_adapter_file_execution_performed_by_gate: false,
    credential_lookup_allowed_by_gate: false,
    plaintext_secret_allowed_by_gate: false,
    raw_secret_material_materialized_by_gate: false,
    raw_secret_material_exposed_by_gate: false,
    desktop_provider_key_visible_by_gate: false,
    forbidden_receipt_fields_allowed_by_gate: false,
    secret_scan_remediation_action_allowed_by_gate: false,
    auto_fix_command_registered_by_gate: false,
    auto_redaction_allowed_by_gate: false,
    auto_deletion_allowed_by_gate: false,
    auto_rotation_allowed_by_gate: false,
    broker_write_allowed_by_gate: false,
    exchange_write_allowed_by_gate: false,
    command_execution_performed_by_gate: false,
    artifact_write_performed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ brokerAdapterSeparation, packageJson, platformOpsLedger, packManifest, capability, sources, rows, gateRows, boundary }) {
  return [
    validationItem("source.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation", "p473_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_ready", brokerAdapterSeparation.validation.valid && brokerAdapterSeparation.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_fixtures_status === SOURCE_READY_STATUS, "P473 secret scan remediation receipt chain secret scan remediation receipt chain broker adapter separation fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P474 live adapter import boundary fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.pack_manifest", "pack_manifest_available", packManifest.available, "Trading pack manifest is readable for P474 live adapter import boundary fixtures."),
    validationItem("source.capability", "capability_available", capability.available, "Trading capability manifest is readable for P474 live adapter import boundary fixtures."),
    validationItem("source.import_boundary_sources", "import_boundary_sources_readable", sources.every((source) => source.available), "Live adapter import boundary source artifacts are readable."),
    validationItem("live_adapter_import_boundary_rows", "import_boundary_rows_ready", rows.length === REQUIRED_ROW_KEYS.length && REQUIRED_ROW_KEYS.every((rowKey) => rows.some((row) => row.row_key === rowKey)) && rows.every((row) => row.live_adapter_import_boundary_status === READY_STATUS), "All live adapter import boundary rows must be ready."),
    validationItem("live_adapter_import_boundary_gate_rows", "import_boundary_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P474 live adapter import boundary gates are ready."),
    validationItem("boundary.default_control_plane_no_live_import", "default_control_plane_no_live_import", !boundary.default_control_plane_imports_live_adapter && !boundary.live_adapter_imported_by_default && !boundary.live_adapter_enabled && !boundary.live_adapter_file_import_performed, "Default control-plane paths must not import or enable future live adapter files."),
    validationItem("boundary.future_live_adapter_non_executable", "future_live_adapter_reference_non_executable", boundary.future_live_adapter_file_may_exist && !boundary.future_live_adapter_default_import_allowed && !boundary.live_adapter_file_read_performed && !boundary.live_adapter_file_import_performed && !boundary.live_adapter_file_execution_performed, "Future live adapter references must remain non-readable, non-imported, and non-executable by default."),
    validationItem("boundary.secret_boundary", "reference_only_credentials", boundary.credential_reference_only && !boundary.credential_lookup_allowed && !boundary.plaintext_secret_allowed && !boundary.provider_key_material_present && !boundary.environment_dump_present && !boundary.secret_material_exposed && !boundary.raw_secret_material_materialized && !boundary.raw_secret_material_exposed && !boundary.desktop_provider_key_visible && boundary.no_secret_material_read && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read, "Credential handling must remain reference-only with no plaintext, environment dump, provider key, model-context secret, raw secret material, .env, Desktop provider key, Desktop config, or secret-value exposure."),
    validationItem("boundary.no_mutation", "no_secret_or_trading_mutation", boundary.no_secret_or_trading_mutation && !boundary.forbidden_receipt_fields_allowed && !boundary.secret_scan_remediation_action_allowed && !boundary.auto_fix_command_registered && !boundary.auto_redaction_allowed && !boundary.auto_deletion_allowed && !boundary.auto_rotation_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed, "P474 performs no secret scan remediation action, automatic fix/redaction/deletion/rotation, trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ brokerAdapterSeparation, rows, gateRows, boundary, validation }) {
  return {
    trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_status: brokerAdapterSeparation.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_fixtures_status,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_ready: boundary.source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_ready,
    required_row_count: REQUIRED_ROW_KEYS.length,
    live_adapter_import_boundary_row_count: rows.length,
    ready_live_adapter_import_boundary_row_count: boundary.ready_live_adapter_import_boundary_row_count,
    live_adapter_import_boundary_gate_count: gateRows.length,
    ready_live_adapter_import_boundary_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    prohibited_import_ref_count: boundary.prohibited_import_ref_count,
    package_scripts_prohibited_import_ref_count: boundary.package_scripts_prohibited_import_ref_count,
    validate_chain_prohibited_import_ref_count: boundary.validate_chain_prohibited_import_ref_count,
    pack_manifest_prohibited_import_ref_count: boundary.pack_manifest_prohibited_import_ref_count,
    capability_entrypoints_prohibited_import_ref_count: boundary.capability_entrypoints_prohibited_import_ref_count,
    future_live_adapter_path: boundary.future_live_adapter_path,
    future_live_adapter_file_may_exist: boundary.future_live_adapter_file_may_exist,
    future_live_adapter_default_import_allowed: boundary.future_live_adapter_default_import_allowed,
    default_control_plane_imports_live_adapter: boundary.default_control_plane_imports_live_adapter,
    live_adapter_imported_by_default: boundary.live_adapter_imported_by_default,
    live_adapter_enabled: boundary.live_adapter_enabled,
    live_adapter_file_read_performed: boundary.live_adapter_file_read_performed,
    live_adapter_file_import_performed: boundary.live_adapter_file_import_performed,
    live_adapter_file_execution_performed: boundary.live_adapter_file_execution_performed,
    credential_reference_only: boundary.credential_reference_only,
    credential_lookup_allowed: boundary.credential_lookup_allowed,
    plaintext_secret_allowed: boundary.plaintext_secret_allowed,
    provider_key_material_present: boundary.provider_key_material_present,
    environment_dump_present: boundary.environment_dump_present,
    secret_material_exposed: boundary.secret_material_exposed,
    raw_secret_material_materialized: boundary.raw_secret_material_materialized,
    raw_secret_material_exposed: boundary.raw_secret_material_exposed,
    desktop_provider_key_visible: boundary.desktop_provider_key_visible,
    forbidden_receipt_fields_allowed: boundary.forbidden_receipt_fields_allowed,
    no_secret_material_read: boundary.no_secret_material_read,
    no_secret_or_trading_mutation: boundary.no_secret_or_trading_mutation,
    secret_scan_remediation_action_allowed: boundary.secret_scan_remediation_action_allowed,
    auto_fix_command_registered: boundary.auto_fix_command_registered,
    auto_redaction_allowed: boundary.auto_redaction_allowed,
    auto_deletion_allowed: boundary.auto_deletion_allowed,
    auto_rotation_allowed: boundary.auto_rotation_allowed,
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
    "# Trading Secret Scan Remediation Receipt Chain Secret Scan Remediation Receipt Chain Live Adapter Import Boundary Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_live_adapter_import_boundary_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source secret scan remediation receipt chain secret scan remediation receipt chain broker adapter separation: ${result.summary.source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_broker_adapter_separation_status}`,
    `Import boundary rows: ${result.summary.ready_live_adapter_import_boundary_row_count}/${result.summary.live_adapter_import_boundary_row_count}`,
    `Import boundary gates: ${result.summary.ready_live_adapter_import_boundary_gate_count}/${result.summary.live_adapter_import_boundary_gate_count}`,
    `Prohibited import refs: ${result.summary.prohibited_import_ref_count}`,
    "",
    "## Import Boundary",
    "",
    ...result.live_adapter_import_boundary_rows.map((row) => `- ${row.row_key}: ${row.live_adapter_import_boundary_status}`),
    "",
    "## Gates",
    "",
    ...result.live_adapter_import_boundary_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--execution-engine") parsed.executionEnginePath = argv[++index];
    else if (arg === "--paper-shadow") parsed.paperShadowPath = argv[++index];
    else if (arg === "--limited-live") parsed.limitedLivePath = argv[++index];
    else if (arg === "--full-auto") parsed.fullAutoPath = argv[++index];
    else if (arg === "--research-backtest-paper") parsed.researchBacktestPaperPath = argv[++index];
    else if (arg === "--pack-manifest") parsed.packManifestPath = argv[++index];
    else if (arg === "--capability") parsed.capabilityPath = argv[++index];
    else if (arg === "--future-live-adapter") parsed.futureLiveAdapterPath = argv[++index];
    else if (arg === "--broker-adapter-separation-fixtures-schema") parsed.brokerAdapterSeparationFixturesSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-live-adapter-import-boundary-fixtures.mjs [options]

Options:
  --out-dir <folder>                         Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_OUT_DIR}
  --run-at <iso>                             Deterministic generated_at timestamp.
  --package <path>                           package.json path.
  --platform-ops-ledger <path>               P341-P500 platform operations ledger path.
  --execution-engine <path>                  Execution engine artifact path.
  --paper-shadow <path>                      Paper/shadow governance artifact path.
  --limited-live <path>                      Limited-live governance artifact path.
  --full-auto <path>                         Full-auto governance artifact path.
  --research-backtest-paper <path>           Research/backtest/paper sample artifact path.
  --pack-manifest <path>                     Trading pack manifest path.
  --capability <path>                        Trading capability manifest path.
  --future-live-adapter <path>               Reference-only future live adapter path.
  --broker-adapter-separation-fixtures-schema <path>
                                             P473 secret scan remediation receipt chain secret scan remediation receipt chain broker adapter separation fixtures schema path.
  --schema <path>                            Output schema path.
  --check                                    Validate only, do not write artifacts.
  -h, --help                                 Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_INPUTS.platformOpsLedgerPath),
    broker_adapter_separation_fixtures_schema_path: path.resolve(options.brokerAdapterSeparationFixturesSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_INPUTS.brokerAdapterSeparationFixturesSchemaPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_INPUTS.executionEnginePath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_INPUTS.paperShadowPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_INPUTS.fullAutoPath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_INPUTS.researchBacktestPaperPath),
    pack_manifest_path: path.resolve(options.packManifestPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_INPUTS.packManifestPath),
    capability_path: path.resolve(options.capabilityPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_INPUTS.capabilityPath),
    future_live_adapter_path: options.futureLiveAdapterPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_INPUTS.futureLiveAdapterPath,
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_LIVE_ADAPTER_IMPORT_BOUNDARY_FIXTURES_INPUTS.schemaPath),
  };
}

function buildImportReferenceScan({ packageJson, packManifest, capability }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const packageScriptRefs = collectProhibitedImportRefs(scripts, "package.scripts");
  return {
    packageScripts: packageScriptRefs,
    validateScript: collectProhibitedImportRefs(validateScript, "package.scripts.validate"),
    packManifest: collectProhibitedImportRefs({ schemas: packManifest.data?.schemas ?? [], workflows: packManifest.data?.workflows ?? [] }, "packs.trading.pack"),
    capability: collectProhibitedImportRefs(capability.data?.entrypoints ?? [], "packs.trading.capability.entrypoints"),
    all: [
      ...packageScriptRefs,
      ...collectProhibitedImportRefs(validateScript, "package.scripts.validate"),
      ...collectProhibitedImportRefs({ schemas: packManifest.data?.schemas ?? [], workflows: packManifest.data?.workflows ?? [] }, "packs.trading.pack"),
      ...collectProhibitedImportRefs(capability.data?.entrypoints ?? [], "packs.trading.capability.entrypoints"),
    ],
  };
}

function collectProhibitedImportRefs(value, prefix = "$") {
  if (typeof value === "string") return prohibitedMatches(value).map((pattern) => ({ path: prefix, pattern, value }));
  if (Array.isArray(value)) return value.flatMap((item, index) => collectProhibitedImportRefs(item, `${prefix}[${index}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => collectProhibitedImportRefs(child, `${prefix}.${key}`));
  }
  return [];
}

function prohibitedMatches(value) {
  return PROHIBITED_IMPORT_PATTERNS.filter((pattern) => value.includes(pattern));
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

function artifactState(source, adapterId) {
  return (valueAt(source, ["execution_artifacts"]) ?? []).find((artifact) => artifact?.adapter_id === adapterId)?.state;
}

function valueAt(source, keys) {
  return keys.reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), source);
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
