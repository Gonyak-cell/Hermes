import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildDomainPackRegistry } from "./domain-pack-registry.mjs";

export const DEFAULT_TRADING_MARKET_DATA_REPORT_OUT_DIR = "artifacts/trading-market-data-report/latest";
export const DEFAULT_TRADING_FEATURE_REPORT_OUT_DIR = "artifacts/trading-feature-report/latest";
export const DEFAULT_TRADING_MARKET_DATA_FEATURE_STORE_INPUTS = {
  featureStorePath: "examples/trading/market-data-feature-store.json",
  featureStoreSchemaPath: "schemas/trading/trading-market-data-feature-store.schema.json",
  marketDataSchemaPath: "schemas/trading/trading-market-data.schema.json",
  featureSchemaPath: "schemas/trading/trading-feature.schema.json",
  goldenFixturesPath: "examples/trading/market-data-feature-store-golden-fixtures.json",
  packManifestPath: "packs/trading/pack.json",
  capabilityManifestPath: "packs/trading/capabilities/research-backtest-paper.json",
  packagePath: "package.json",
  phaseLedgerPath: "docs/trading-pack-phase-ledger.md",
};

const REQUIRED_PHASE_IDS = Array.from({ length: 30 }, (_, index) => `P${String(61 + index).padStart(3, "0")}`);
const REQUIRED_SOURCE_TYPES = ["csv_manual", "manual_entry", "vendor_stub"];
const REQUIRED_SESSION_SCOPES = ["kr_stock", "us_stock", "crypto_24_7"];
const REQUIRED_QUALITY_CHECKS = ["stale_data", "missing_data", "duplicate_candle", "abnormal_price_spread"];
const REQUIRED_FEATURE_CATEGORIES = [
  "liquidity",
  "volatility",
  "momentum",
  "mean_reversion",
  "correlation",
  "regime",
  "macro_placeholder",
  "event_placeholder",
  "on_chain_placeholder",
  "sentiment_placeholder",
];

export async function runTradingMarketDataReport(options = {}) {
  const result = await buildTradingMarketDataReport(options);
  if (options.write !== false) await writeTradingMarketDataReport(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading market data report validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function runTradingFeatureReport(options = {}) {
  const result = await buildTradingFeatureReport(options);
  if (options.write !== false) await writeTradingFeatureReport(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading feature report validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingMarketDataReport(options = {}) {
  return buildTradingMarketDataFeatureStoreReport("market_data", {
    ...options,
    outDir: options.outDir ?? DEFAULT_TRADING_MARKET_DATA_REPORT_OUT_DIR,
  });
}

export async function buildTradingFeatureReport(options = {}) {
  return buildTradingMarketDataFeatureStoreReport("feature", {
    ...options,
    outDir: options.outDir ?? DEFAULT_TRADING_FEATURE_REPORT_OUT_DIR,
  });
}

async function buildTradingMarketDataFeatureStoreReport(reportKind, options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir);
  const inputs = normalizeInputs(options);
  const store = await readJson(inputs.feature_store_path);
  const storeSchema = await readJson(inputs.feature_store_schema_path);
  const marketDataSchema = await readJson(inputs.market_data_schema_path);
  const featureSchema = await readJson(inputs.feature_schema_path);
  const goldenFixtures = await readJson(inputs.golden_fixtures_path);
  const packManifest = await readJson(inputs.pack_manifest_path);
  const capabilityManifest = await readJson(inputs.capability_manifest_path);
  const packageJson = await readJson(inputs.package_path);
  const phaseLedgerText = await readFile(inputs.phase_ledger_path, "utf8");
  const domainPackRegistry = await buildDomainPackRegistry({ runAt: generatedAt });

  const storeSchemaErrors = validateAgainstSchema(store, storeSchema, {}, "market_data_feature_store");
  const marketDataValidationResults = validateMarketDataArtifacts(store, marketDataSchema);
  const featureValidationResults = validateFeatureArtifacts(store, featureSchema);
  const sourceItems = buildSourceValidationItems({
    packageJson,
    packManifest,
    capabilityManifest,
    phaseLedgerText,
    domainPackRegistry,
  });
  const marketDataItems = buildMarketDataValidationItems({
    store,
    storeSchemaErrors,
    marketDataValidationResults,
  });
  const featureItems = buildFeatureValidationItems({
    store,
    featureValidationResults,
  });
  const fixtureResults = buildFixtureResults(goldenFixtures, store, [...marketDataItems, ...featureItems]);
  const validationItems = [
    ...sourceItems,
    ...marketDataItems,
    ...featureItems,
    ...fixtureResults.flatMap((fixture) => fixture.validation_items),
  ];
  const validation = summarizeValidation(validationItems);
  const summary = summarizeReport({ reportKind, store, marketDataValidationResults, featureValidationResults, fixtureResults, validationItems, validation });
  const result = {
    schema_version: reportKind === "market_data" ? "trading-market-data-report.v1" : "trading-feature-report.v1",
    generated_at: generatedAt,
    report_id: reportKind === "market_data"
      ? `trading-market-data-report.${dateStamp(generatedAt)}`
      : `trading-feature-report.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      feature_store: sourceContract("market_data_feature_store", inputs.feature_store_path, store.schema_version, store.feature_store_status === "complete"),
      feature_store_schema: sourceContract("market_data_feature_store_schema", inputs.feature_store_schema_path, storeSchema.title, storeSchemaErrors.length === 0),
      market_data_schema: sourceContract("trading_market_data_schema", inputs.market_data_schema_path, marketDataSchema.title, marketDataValidationResults.every((item) => item.validation.valid)),
      feature_schema: sourceContract("trading_feature_schema", inputs.feature_schema_path, featureSchema.title, featureValidationResults.every((item) => item.validation.valid)),
      golden_fixtures: sourceContract("market_data_feature_store_golden_fixtures", inputs.golden_fixtures_path, goldenFixtures.schema_version, Array.isArray(goldenFixtures.fixtures)),
      pack_manifest: sourceContract("trading_pack_manifest", inputs.pack_manifest_path, packManifest.schema_version, packManifest.pack_id === "trading"),
      capability_manifest: sourceContract("trading_capability_manifest", inputs.capability_manifest_path, capabilityManifest.schema_version, capabilityManifest.domain_pack === "trading"),
      domain_pack_registry: {
        source_id: "domain_pack_registry",
        status: domainPackRegistry.validation.valid ? "valid" : "invalid",
        trading_registered: Boolean(domainPackRegistry.packs.find((pack) => pack.pack_id === "trading")),
      },
    },
    market_data_feature_store: store,
    market_data_validation_results: marketDataValidationResults,
    feature_validation_results: featureValidationResults,
    fixture_results: fixtureResults,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: reportKind === "market_data" ? renderMarketDataMarkdown(result) : renderFeatureMarkdown(result),
  };
}

export async function writeTradingMarketDataReport(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-market-data-report.json"), serializableResult(result));
  await writeJson(path.join(outDir, "market-data-feature-store.json"), result.market_data_feature_store);
  await writeJson(path.join(outDir, "market-data-validation-results.json"), {
    schema_version: "trading-market-data-validation-results.v1",
    generated_at: result.generated_at,
    market_data_validation_results: result.market_data_validation_results,
  });
  await writeJson(path.join(outDir, "fixture-results.json"), {
    schema_version: "trading-market-data-feature-store-fixture-results.v1",
    generated_at: result.generated_at,
    fixture_results: result.fixture_results,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function writeTradingFeatureReport(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-feature-report.json"), serializableResult(result));
  await writeJson(path.join(outDir, "market-data-feature-store.json"), result.market_data_feature_store);
  await writeJson(path.join(outDir, "feature-validation-results.json"), {
    schema_version: "trading-feature-validation-results.v1",
    generated_at: result.generated_at,
    feature_validation_results: result.feature_validation_results,
  });
  await writeJson(path.join(outDir, "fixture-results.json"), {
    schema_version: "trading-market-data-feature-store-fixture-results.v1",
    generated_at: result.generated_at,
    fixture_results: result.fixture_results,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingMarketDataReportCli(argv = process.argv.slice(2)) {
  await runTradingMarketDataFeatureStoreCli("market-data-report", argv, runTradingMarketDataReport, DEFAULT_TRADING_MARKET_DATA_REPORT_OUT_DIR);
}

export async function runTradingFeatureReportCli(argv = process.argv.slice(2)) {
  await runTradingMarketDataFeatureStoreCli("feature-report", argv, runTradingFeatureReport, DEFAULT_TRADING_FEATURE_REPORT_OUT_DIR);
}

async function runTradingMarketDataFeatureStoreCli(label, argv, runner, defaultOutDir) {
  const args = parseArgs(argv, defaultOutDir);
  if (args.help) {
    printHelp(label, defaultOutDir);
    return;
  }
  try {
    const result = await runner(args);
    console.log(`Trading ${label} ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.report_status}`);
    console.log(`Phase range: ${result.summary.phase_range}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function validateMarketDataArtifacts(store, marketDataSchema) {
  return (store.market_data_artifacts ?? []).map((artifact, index) => {
    const errors = validateAgainstSchema(artifact, marketDataSchema, {}, `market_data_artifacts[${index}]`);
    return {
      schema_version: "trading-market-data-validation-result.v1",
      dataset_id: artifact.dataset_id ?? null,
      validation: {
        valid: errors.length === 0,
        errors,
      },
      validation_items: [
        validationItem(`market_data_artifacts.${artifact.dataset_id ?? index}`, "market_data_schema_valid", errors.length === 0, errors.length === 0 ? "Market data artifact validates." : `Market data artifact has ${errors.length} schema error(s).`),
        ...errors.map((error) => validationItem(error.path, "market_data_schema_error", false, error.message)),
      ],
    };
  });
}

function validateFeatureArtifacts(store, featureSchema) {
  return (store.feature_snapshots ?? []).map((snapshot, index) => {
    const featureArtifact = snapshot.feature_artifact ?? {};
    const errors = validateAgainstSchema(featureArtifact, featureSchema, {}, `feature_snapshots[${index}].feature_artifact`);
    return {
      schema_version: "trading-feature-validation-result.v1",
      snapshot_id: snapshot.snapshot_id ?? null,
      feature_set_id: featureArtifact.feature_set_id ?? null,
      validation: {
        valid: errors.length === 0,
        errors,
      },
      validation_items: [
        validationItem(`feature_snapshots.${snapshot.snapshot_id ?? index}`, "feature_schema_valid", errors.length === 0, errors.length === 0 ? "Feature artifact validates." : `Feature artifact has ${errors.length} schema error(s).`),
        ...errors.map((error) => validationItem(error.path, "feature_schema_error", false, error.message)),
      ],
    };
  });
}

function buildSourceValidationItems({ packageJson, packManifest, capabilityManifest, phaseLedgerText, domainPackRegistry }) {
  const scripts = packageJson.scripts ?? {};
  const packSchemas = packManifest.schemas ?? [];
  const workflows = packManifest.workflows ?? [];
  const goldenCases = packManifest.golden_cases ?? [];
  const entrypoints = capabilityManifest.entrypoints ?? [];
  const capabilityGoldenCases = capabilityManifest.golden_cases ?? [];
  const tradingPack = domainPackRegistry.packs.find((pack) => pack.pack_id === "trading");
  return [
    validationItem("source.package.trading_market_data_report", "package_script_registered", Boolean(scripts["trading:market-data-report"]), "Package script trading:market-data-report is registered."),
    validationItem("source.package.trading_feature_report", "package_script_registered", Boolean(scripts["trading:feature-report"]), "Package script trading:feature-report is registered."),
    validationItem("source.pack.schemas.market_data_feature_store", "pack_schema_registered", packSchemas.includes("schemas/trading/trading-market-data-feature-store.schema.json"), "Trading pack manifest registers the market data feature store schema."),
    validationItem("source.pack.workflow.market_data_report", "pack_workflow_registered", workflows.includes("workflow.trading.market_data_report.v1"), "Trading pack manifest registers the market data report workflow."),
    validationItem("source.pack.workflow.feature_report", "pack_workflow_registered", workflows.includes("workflow.trading.feature_report.v1"), "Trading pack manifest registers the feature report workflow."),
    validationItem("source.pack.workflow.feature_store_dashboard", "pack_workflow_registered", workflows.includes("workflow.trading.feature_store_dashboard.v1"), "Trading pack manifest registers the feature store dashboard/API workflow."),
    validationItem("source.pack.golden.market_data_feature_store", "pack_golden_case_registered", goldenCases.includes("golden.trading.market_data_feature_store.p061_p090"), "Trading pack manifest registers the market data feature store golden case."),
    validationItem("source.capability.entrypoint.market_data_report", "capability_entrypoint_registered", entrypoints.some((entrypoint) => entrypoint.name === "trading:market-data-report"), "Trading capability manifest registers the market data report entrypoint."),
    validationItem("source.capability.entrypoint.feature_report", "capability_entrypoint_registered", entrypoints.some((entrypoint) => entrypoint.name === "trading:feature-report"), "Trading capability manifest registers the feature report entrypoint."),
    validationItem("source.capability.golden.market_data_feature_store", "capability_golden_case_registered", capabilityGoldenCases.some((fixture) => fixture.case_id === "golden.trading.market_data_feature_store.p061_p090"), "Trading capability manifest registers the market data feature store golden case."),
    validationItem("source.domain_pack_registry.trading", "domain_pack_registry_valid", domainPackRegistry.validation.valid === true && Boolean(tradingPack), "Domain pack registry remains valid with Trading registered."),
    validationItem("source.phase_ledger.p061_p090", "phase_ledger_updated", phaseLedgerText.includes("P061-P090 Acceptance Criteria") && phaseLedgerText.includes("trading:market-data-report") && phaseLedgerText.includes("trading:feature-report"), "Phase ledger documents P061-P090 acceptance criteria and CLIs."),
  ];
}

function buildMarketDataValidationItems({ store, storeSchemaErrors, marketDataValidationResults }) {
  const phaseIds = new Set((store.phase_coverage ?? []).map((phase) => phase.phase_id));
  const sourceTypes = new Set((store.import_adapters ?? []).map((adapter) => adapter.source_type));
  const sessionScopes = new Set((store.market_sessions ?? []).map((session) => session.asset_scope));
  const qualityCheckIds = new Set((store.quality_gate_model?.checks ?? []).map((check) => check.check_id));
  const artifacts = store.market_data_artifacts ?? [];
  const artifactQualityClean = artifacts.every((artifact) => {
    const checks = artifact.quality_checks ?? {};
    return checks.stale_data_detected === false
      && checks.missing_data_detected === false
      && checks.duplicate_candle_detected === false
      && checks.abnormal_price_detected === false;
  });
  return [
    validationItem("market_data_feature_store.schema", "schema_validation_passed", storeSchemaErrors.length === 0, storeSchemaErrors.length === 0 ? "Market data feature store validates against schema." : `Market data feature store has ${storeSchemaErrors.length} schema error(s).`),
    ...storeSchemaErrors.map((error) => validationItem(error.path, "schema_error", false, error.message)),
    validationItem("market_data_feature_store.phase_range", "phase_range_p061_p090", store.phase_range === "P061-P090", "Market data feature store is scoped to P061-P090."),
    validationItem("market_data_feature_store.phase_coverage", "all_phases_covered", REQUIRED_PHASE_IDS.every((phaseId) => phaseIds.has(phaseId)) && (store.phase_coverage ?? []).every((phase) => phase.status === "complete"), "All P061-P090 phases are covered and complete."),
    validationItem("market_data_feature_store.safety.manual_fixture_only", "manual_or_fixture_only", store.safety_boundary?.manual_or_fixture_only === true, "Market data ingestion is limited to manual or fixture sources."),
    validationItem("market_data_feature_store.safety.no_live_feeds", "live_vendor_feeds_disabled", store.safety_boundary?.live_vendor_feeds_enabled === false && store.safety_boundary?.real_time_trading_feed_enabled === false, "Live vendor and real-time trading feeds are disabled."),
    validationItem("market_data_feature_store.safety.no_advice_or_orders", "no_advice_recommendation_or_order", store.safety_boundary?.investment_advice_generated === false && store.safety_boundary?.trade_recommendation_generated === false && store.safety_boundary?.order_intent_generated === false, "Market data and feature reports do not generate advice, recommendations, or orders."),
    validationItem("market_data_feature_store.import_adapters.required", "required_import_adapters_present", REQUIRED_SOURCE_TYPES.every((sourceType) => sourceTypes.has(sourceType)), "CSV/manual import and vendor stub adapters are declared."),
    validationItem("market_data_feature_store.import_adapters.no_credentials", "import_adapters_do_not_need_credentials", (store.import_adapters ?? []).every((adapter) => adapter.credential_required === false), "Import adapters require no credentials."),
    validationItem("market_data_feature_store.market_data.schemas", "market_data_artifacts_validate", marketDataValidationResults.length > 0 && marketDataValidationResults.every((result) => result.validation.valid), "All market data artifacts validate against trading-market-data.v1."),
    ...marketDataValidationResults.flatMap((result) => result.validation_items),
    validationItem("market_data_feature_store.market_data.normalized", "ohlcv_normalized", artifacts.length > 0 && artifacts.every((artifact) => artifact.normalized_ohlcv === true), "Market data artifacts declare normalized OHLCV."),
    validationItem("market_data_feature_store.market_data.sorted_unique", "bars_sorted_and_unique", artifacts.length > 0 && artifacts.every((artifact) => barsSortedAndUnique(artifact.bars ?? [])), "Market data bars are sorted and unique by timestamp."),
    validationItem("market_data_feature_store.sessions.required", "required_market_sessions_present", REQUIRED_SESSION_SCOPES.every((scope) => sessionScopes.has(scope)), "Korea stock, US stock, and crypto 24/7 sessions are declared."),
    validationItem("market_data_feature_store.fx_snapshots", "fx_snapshot_present", (store.fx_snapshots ?? []).length > 0, "FX snapshot is present."),
    validationItem("market_data_feature_store.corporate_actions", "corporate_action_placeholders_present", (store.corporate_action_placeholders ?? []).length > 0 && (store.corporate_action_placeholders ?? []).every((placeholder) => placeholder.live_action_allowed === false), "Corporate action placeholders are present and do not allow live action."),
    validationItem("market_data_feature_store.quality.required", "required_quality_checks_present", REQUIRED_QUALITY_CHECKS.every((checkId) => qualityCheckIds.has(checkId)), "Stale, missing, duplicate, and abnormal price/spread checks are declared."),
    validationItem("market_data_feature_store.quality.status", "quality_checks_pass", (store.quality_gate_model?.checks ?? []).every((check) => check.status === "pass" && check.blocks_usage === true) && artifactQualityClean, "Quality checks pass and block usage on failure."),
    validationItem("market_data_feature_store.vendor", "vendor_abstraction_stub_only", store.vendor_abstraction?.adapter_state === "stub_only" && store.vendor_abstraction?.live_vendor_calls_allowed === false && store.vendor_abstraction?.credentials_required === false, "Vendor abstraction is stub-only and requires no credentials."),
    validationItem("market_data_feature_store.replay", "data_replay_mode_enabled", store.replay_mode?.enabled === true && store.replay_mode?.source_snapshot_required === true, "Data replay mode is enabled with source snapshot requirements."),
    validationItem("market_data_feature_store.dashboard", "dashboard_read_only", store.dashboard_api_stub?.read_only === true && store.dashboard_api_stub?.mutating_routes_enabled === false && (store.dashboard_api_stub?.routes ?? []).every((route) => route.method === "GET"), "Feature store dashboard/API is read-only."),
  ];
}

function buildFeatureValidationItems({ store, featureValidationResults }) {
  const featureCategories = new Set((store.feature_definitions ?? []).map((feature) => feature.category));
  const snapshotCategories = new Set((store.feature_snapshots ?? []).flatMap((snapshot) => (snapshot.feature_artifact?.features ?? []).map((feature) => feature.category)));
  const snapshots = store.feature_snapshots ?? [];
  return [
    validationItem("feature_store.definitions.required", "required_feature_categories_present", REQUIRED_FEATURE_CATEGORIES.every((category) => featureCategories.has(category)), "Liquidity, volatility, momentum, mean-reversion, correlation, regime, and placeholder features are declared."),
    validationItem("feature_store.definitions.lookahead", "feature_definitions_lookahead_safe", (store.feature_definitions ?? []).every((feature) => feature.lookahead_safe === true), "Feature definitions are marked lookahead-safe."),
    validationItem("feature_store.snapshots.present", "feature_snapshots_present", snapshots.length > 0, "At least one feature snapshot is present."),
    validationItem("feature_store.snapshots.versioned", "feature_snapshots_versioned", snapshots.every((snapshot) => typeof snapshot.snapshot_version === "string" && snapshot.snapshot_version.length > 0), "Feature snapshots are versioned."),
    validationItem("feature_store.snapshots.lineage", "feature_lineage_declared", snapshots.every((snapshot) => (snapshot.lineage_refs ?? []).length > 0 && (snapshot.source_dataset_ids ?? []).length > 0), "Feature snapshots declare lineage and source dataset ids."),
    validationItem("feature_store.snapshots.leakage", "feature_leakage_checks_pass", snapshots.every((snapshot) => snapshot.leakage_check_status === "passed" && snapshot.feature_artifact?.leakage_check_status === "passed"), "Feature leakage checks pass."),
    validationItem("feature_store.snapshots.quality", "feature_quality_score_threshold", snapshots.every((snapshot) => snapshot.quality_score >= 0.9 && snapshot.feature_artifact?.quality_score >= 0.9), "Feature quality scores meet the P061-P090 threshold."),
    validationItem("feature_store.snapshots.categories", "feature_artifact_categories_present", REQUIRED_FEATURE_CATEGORIES.every((category) => snapshotCategories.has(category)), "Feature artifact contains all required feature categories."),
    validationItem("feature_store.snapshots.schemas", "feature_artifacts_validate", featureValidationResults.length > 0 && featureValidationResults.every((result) => result.validation.valid), "Feature artifacts validate against trading-feature.v1."),
    ...featureValidationResults.flatMap((result) => result.validation_items),
  ];
}

function buildFixtureResults(goldenFixtures, store, coreValidationItems) {
  return (goldenFixtures.fixtures ?? []).map((fixture) => {
    const featureCategories = new Set((store.feature_definitions ?? []).map((feature) => feature.category));
    const regressionHash = hashValue({
      fixture_id: fixture.fixture_id,
      phase_range: store.phase_range,
      phase_coverage: store.phase_coverage,
      dataset_ids: (store.market_data_artifacts ?? []).map((artifact) => artifact.dataset_id).sort(),
      session_scopes: (store.market_sessions ?? []).map((session) => session.asset_scope).sort(),
      quality_checks: (store.quality_gate_model?.checks ?? []).map((check) => check.check_id).sort(),
      feature_categories: [...featureCategories].sort(),
      safety_boundary: store.safety_boundary,
      vendor_abstraction: store.vendor_abstraction,
      dashboard_api_stub: store.dashboard_api_stub,
    });
    const validationItems = [
      validationItem(`fixtures.${fixture.fixture_id}.status`, "fixture_status_matches", fixture.expected_status === "complete" && coreValidationItems.every((item) => item.status === "passed"), `${fixture.fixture_id} expected status is complete.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_range`, "fixture_phase_range_matches", store.phase_range === fixture.expected_phase_range, `${fixture.fixture_id} phase range matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_count`, "fixture_phase_count_matches", (store.phase_coverage ?? []).length === fixture.expected_phase_count, `${fixture.fixture_id} phase count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.dataset_count`, "fixture_dataset_count_matches", (store.market_data_artifacts ?? []).length === fixture.expected_dataset_count, `${fixture.fixture_id} dataset count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.market_session_count`, "fixture_market_session_count_matches", (store.market_sessions ?? []).length === fixture.expected_market_session_count, `${fixture.fixture_id} market session count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.fx_snapshot_count`, "fixture_fx_snapshot_count_matches", (store.fx_snapshots ?? []).length === fixture.expected_fx_snapshot_count, `${fixture.fixture_id} FX snapshot count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.quality_check_count`, "fixture_quality_check_count_matches", (store.quality_gate_model?.checks ?? []).length === fixture.expected_quality_check_count, `${fixture.fixture_id} quality check count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.feature_category_count`, "fixture_feature_category_count_matches", featureCategories.size === fixture.expected_feature_category_count, `${fixture.fixture_id} feature category count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.feature_snapshot_count`, "fixture_feature_snapshot_count_matches", (store.feature_snapshots ?? []).length === fixture.expected_feature_snapshot_count, `${fixture.fixture_id} feature snapshot count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.live_vendor_feeds`, "fixture_live_vendor_feed_boundary_matches", store.safety_boundary?.live_vendor_feeds_enabled === fixture.expected_live_vendor_feeds_enabled, `${fixture.fixture_id} live vendor feed boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.dashboard`, "fixture_dashboard_boundary_matches", store.dashboard_api_stub?.read_only === fixture.expected_dashboard_read_only, `${fixture.fixture_id} dashboard boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.hash`, "fixture_regression_hash_locked", regressionHash.startsWith("sha256:"), `${fixture.fixture_id} regression hash is locked.`),
    ];
    const validation = summarizeValidation(validationItems);
    return {
      schema_version: "trading-market-data-feature-store-fixture-result.v1",
      fixture_id: fixture.fixture_id,
      input_ref: fixture.input_ref,
      expected_status: fixture.expected_status,
      fixture_status: validation.valid ? "complete" : "failed",
      regression_hash: regressionHash,
      validation_items: validationItems,
      validation,
    };
  });
}

function summarizeReport({ reportKind, store, marketDataValidationResults, featureValidationResults, fixtureResults, validationItems, validation }) {
  const featureCategories = new Set((store.feature_definitions ?? []).map((feature) => feature.category));
  const qualityScores = (store.feature_snapshots ?? []).map((snapshot) => snapshot.quality_score).filter(Number.isFinite);
  const summary = {
    report_status: validation.valid ? "complete" : "blocked",
    phase_range: store.phase_range,
    phase_count: store.phase_coverage?.length ?? 0,
    complete_phase_count: (store.phase_coverage ?? []).filter((phase) => phase.status === "complete").length,
    dataset_count: store.market_data_artifacts?.length ?? 0,
    market_data_schema_valid_count: marketDataValidationResults.filter((result) => result.validation.valid).length,
    market_session_count: store.market_sessions?.length ?? 0,
    fx_snapshot_count: store.fx_snapshots?.length ?? 0,
    quality_check_count: store.quality_gate_model?.checks?.length ?? 0,
    quality_check_pass_count: (store.quality_gate_model?.checks ?? []).filter((check) => check.status === "pass").length,
    feature_category_count: featureCategories.size,
    feature_snapshot_count: store.feature_snapshots?.length ?? 0,
    feature_schema_valid_count: featureValidationResults.filter((result) => result.validation.valid).length,
    min_feature_quality_score: qualityScores.length > 0 ? Math.min(...qualityScores) : 0,
    leakage_check_passed_count: (store.feature_snapshots ?? []).filter((snapshot) => snapshot.leakage_check_status === "passed").length,
    fixture_count: fixtureResults.length,
    passed_fixture_count: fixtureResults.filter((fixture) => fixture.validation.valid).length,
    locked_regression_hash_count: fixtureResults.filter((fixture) => fixture.regression_hash?.startsWith("sha256:")).length,
    validation_item_count: validationItems.length,
    validation_error_count: validation.errors.length,
    live_vendor_feeds_enabled: store.safety_boundary?.live_vendor_feeds_enabled === true,
    real_time_trading_feed_enabled: store.safety_boundary?.real_time_trading_feed_enabled === true,
    external_api_keys_required: store.safety_boundary?.external_api_keys_required === true,
    order_intent_generated: store.safety_boundary?.order_intent_generated === true,
    dashboard_read_only: store.dashboard_api_stub?.read_only === true,
  };
  if (reportKind === "market_data") summary.market_data_report_status = summary.report_status;
  else summary.feature_report_status = summary.report_status;
  return summary;
}

function renderMarketDataMarkdown(result) {
  const lines = [];
  lines.push("# Trading Market Data Report");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.market_data_report_status}`);
  lines.push("");
  lines.push(`- Phase range: ${result.summary.phase_range}`);
  lines.push(`- Phases complete: ${result.summary.complete_phase_count}/${result.summary.phase_count}`);
  lines.push(`- Datasets: ${result.summary.dataset_count}`);
  lines.push(`- Market sessions: ${result.summary.market_session_count}`);
  lines.push(`- Quality checks passed: ${result.summary.quality_check_pass_count}/${result.summary.quality_check_count}`);
  lines.push(`- Live vendor feeds enabled: ${result.summary.live_vendor_feeds_enabled}`);
  lines.push(`- Real-time trading feed enabled: ${result.summary.real_time_trading_feed_enabled}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderFeatureMarkdown(result) {
  const lines = [];
  lines.push("# Trading Feature Report");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.feature_report_status}`);
  lines.push("");
  lines.push(`- Phase range: ${result.summary.phase_range}`);
  lines.push(`- Phases complete: ${result.summary.complete_phase_count}/${result.summary.phase_count}`);
  lines.push(`- Feature categories: ${result.summary.feature_category_count}`);
  lines.push(`- Feature snapshots: ${result.summary.feature_snapshot_count}`);
  lines.push(`- Min feature quality score: ${result.summary.min_feature_quality_score}`);
  lines.push(`- Leakage checks passed: ${result.summary.leakage_check_passed_count}`);
  lines.push(`- Order intent generated: ${result.summary.order_intent_generated}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options = {}) {
  return {
    feature_store_path: path.resolve(options.featureStorePath ?? DEFAULT_TRADING_MARKET_DATA_FEATURE_STORE_INPUTS.featureStorePath),
    feature_store_schema_path: path.resolve(options.featureStoreSchemaPath ?? DEFAULT_TRADING_MARKET_DATA_FEATURE_STORE_INPUTS.featureStoreSchemaPath),
    market_data_schema_path: path.resolve(options.marketDataSchemaPath ?? DEFAULT_TRADING_MARKET_DATA_FEATURE_STORE_INPUTS.marketDataSchemaPath),
    feature_schema_path: path.resolve(options.featureSchemaPath ?? DEFAULT_TRADING_MARKET_DATA_FEATURE_STORE_INPUTS.featureSchemaPath),
    golden_fixtures_path: path.resolve(options.goldenFixturesPath ?? DEFAULT_TRADING_MARKET_DATA_FEATURE_STORE_INPUTS.goldenFixturesPath),
    pack_manifest_path: path.resolve(options.packManifestPath ?? DEFAULT_TRADING_MARKET_DATA_FEATURE_STORE_INPUTS.packManifestPath),
    capability_manifest_path: path.resolve(options.capabilityManifestPath ?? DEFAULT_TRADING_MARKET_DATA_FEATURE_STORE_INPUTS.capabilityManifestPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_MARKET_DATA_FEATURE_STORE_INPUTS.packagePath),
    phase_ledger_path: path.resolve(options.phaseLedgerPath ?? DEFAULT_TRADING_MARKET_DATA_FEATURE_STORE_INPUTS.phaseLedgerPath),
  };
}

function parseArgs(argv, defaultOutDir) {
  const parsed = {
    outDir: defaultOutDir,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--feature-store") parsed.featureStorePath = argv[++index];
    else if (arg === "--feature-store-schema") parsed.featureStoreSchemaPath = argv[++index];
    else if (arg === "--market-data-schema") parsed.marketDataSchemaPath = argv[++index];
    else if (arg === "--feature-schema") parsed.featureSchemaPath = argv[++index];
    else if (arg === "--golden-fixtures") parsed.goldenFixturesPath = argv[++index];
    else if (arg === "--pack-manifest") parsed.packManifestPath = argv[++index];
    else if (arg === "--capability-manifest") parsed.capabilityManifestPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--phase-ledger") parsed.phaseLedgerPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp(label, defaultOutDir) {
  console.log(`Usage: node scripts/trading-${label}.mjs [options]

Options:
  --out-dir <folder>             Output directory. Default: ${defaultOutDir}
  --run-at <iso>                 Deterministic generated_at timestamp.
  --feature-store <path>         Market data feature store path.
  --feature-store-schema <path>  Market data feature store schema path.
  --market-data-schema <path>    trading-market-data schema path.
  --feature-schema <path>        trading-feature schema path.
  --golden-fixtures <path>       Market data feature store golden fixtures path.
  --pack-manifest <path>         Trading pack manifest path.
  --capability-manifest <path>   Trading capability manifest path.
  --package <path>               package.json path.
  --phase-ledger <path>          Trading phase ledger path.
  --check                        Validate only, do not write artifacts.
  -h, --help                     Show this help.
`);
}

function barsSortedAndUnique(bars) {
  const timestamps = bars.map((bar) => bar.timestamp);
  const unique = new Set(timestamps);
  if (unique.size !== timestamps.length) return false;
  return timestamps.every((timestamp, index) => index === 0 || Date.parse(timestamp) >= Date.parse(timestamps[index - 1]));
}

function sourceContract(sourceId, sourcePath, schemaVersion, ok) {
  return {
    source_id: sourceId,
    path: sourcePath,
    schema_version: schemaVersion ?? null,
    status: ok ? "loaded" : "attention",
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `trading-market-data-feature-store.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
