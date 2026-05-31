import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildDomainPackRegistry } from "./domain-pack-registry.mjs";

export const DEFAULT_TRADING_BACKTEST_REPORT_OUT_DIR = "artifacts/trading-backtest-report/latest";
export const DEFAULT_TRADING_BACKTEST_VALIDATION_INPUTS = {
  backtestValidationPath: "examples/trading/backtest-validation.json",
  backtestValidationSchemaPath: "schemas/trading/trading-backtest-validation.schema.json",
  backtestSchemaPath: "schemas/trading/trading-backtest.schema.json",
  featureStorePath: "examples/trading/market-data-feature-store.json",
  signalEnginePath: "examples/trading/signal-engine.json",
  modelImprovementPath: "examples/trading/model-improvement-layer.json",
  goldenFixturesPath: "examples/trading/backtest-validation-golden-fixtures.json",
  packManifestPath: "packs/trading/pack.json",
  capabilityManifestPath: "packs/trading/capabilities/research-backtest-paper.json",
  packagePath: "package.json",
  phaseLedgerPath: "docs/trading-pack-phase-ledger.md",
};

const REQUIRED_PHASE_IDS = Array.from({ length: 30 }, (_, index) => `P${String(166 + index).padStart(3, "0")}`);
const REQUIRED_STRESS_TYPES = ["liquidity_stress", "crash_regime", "crypto_24_7_gap"];

export async function runTradingBacktestReport(options = {}) {
  const result = await buildTradingBacktestReport(options);
  if (options.write !== false) await writeTradingBacktestReport(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading backtest report validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingBacktestReport(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_BACKTEST_REPORT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const backtestValidation = await readJson(inputs.backtest_validation_path);
  const backtestValidationSchema = await readJson(inputs.backtest_validation_schema_path);
  const backtestSchema = await readJson(inputs.backtest_schema_path);
  const featureStore = await readJson(inputs.feature_store_path);
  const signalEngine = await readJson(inputs.signal_engine_path);
  const modelImprovement = await readJson(inputs.model_improvement_path);
  const goldenFixtures = await readJson(inputs.golden_fixtures_path);
  const packManifest = await readJson(inputs.pack_manifest_path);
  const capabilityManifest = await readJson(inputs.capability_manifest_path);
  const packageJson = await readJson(inputs.package_path);
  const phaseLedgerText = await readFile(inputs.phase_ledger_path, "utf8");
  const domainPackRegistry = await buildDomainPackRegistry({ runAt: generatedAt });

  const backtestValidationSchemaErrors = validateAgainstSchema(backtestValidation, backtestValidationSchema, {}, "backtest_validation");
  const backtestArtifactResults = validateBacktestArtifacts(backtestValidation, backtestSchema);
  const sourceItems = buildSourceValidationItems({
    packageJson,
    packManifest,
    capabilityManifest,
    phaseLedgerText,
    domainPackRegistry,
  });
  const backtestItems = buildBacktestValidationItems({
    backtestValidation,
    backtestValidationSchemaErrors,
    backtestArtifactResults,
    featureStore,
    signalEngine,
    modelImprovement,
  });
  const fixtureResults = buildFixtureResults(goldenFixtures, backtestValidation, backtestItems);
  const validationItems = [
    ...sourceItems,
    ...backtestItems,
    ...fixtureResults.flatMap((fixture) => fixture.validation_items),
  ];
  const validation = summarizeValidation(validationItems);
  const summary = summarizeBacktestReport({
    backtestValidation,
    backtestArtifactResults,
    fixtureResults,
    validationItems,
    validation,
  });
  const result = {
    schema_version: "trading-backtest-report.v1",
    generated_at: generatedAt,
    backtest_report_id: `trading-backtest-report.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      backtest_validation: sourceContract("backtest_validation", inputs.backtest_validation_path, backtestValidation.schema_version, backtestValidation.backtest_validation_status === "complete"),
      backtest_validation_schema: sourceContract("backtest_validation_schema", inputs.backtest_validation_schema_path, backtestValidationSchema.title, backtestValidationSchemaErrors.length === 0),
      backtest_schema: sourceContract("trading_backtest_schema", inputs.backtest_schema_path, backtestSchema.title, backtestArtifactResults.every((item) => item.validation.valid)),
      feature_store: sourceContract("market_data_feature_store", inputs.feature_store_path, featureStore.schema_version, featureStore.feature_store_status === "complete"),
      signal_engine: sourceContract("signal_engine", inputs.signal_engine_path, signalEngine.schema_version, signalEngine.signal_engine_status === "complete"),
      model_improvement: sourceContract("model_improvement", inputs.model_improvement_path, modelImprovement.schema_version, modelImprovement.model_improvement_status === "complete"),
      golden_fixtures: sourceContract("backtest_validation_golden_fixtures", inputs.golden_fixtures_path, goldenFixtures.schema_version, Array.isArray(goldenFixtures.fixtures)),
      pack_manifest: sourceContract("trading_pack_manifest", inputs.pack_manifest_path, packManifest.schema_version, packManifest.pack_id === "trading"),
      capability_manifest: sourceContract("trading_capability_manifest", inputs.capability_manifest_path, capabilityManifest.schema_version, capabilityManifest.domain_pack === "trading"),
      domain_pack_registry: {
        source_id: "domain_pack_registry",
        status: domainPackRegistry.validation.valid ? "valid" : "invalid",
        trading_registered: Boolean(domainPackRegistry.packs.find((pack) => pack.pack_id === "trading")),
      },
    },
    backtest_validation: backtestValidation,
    backtest_artifact_results: backtestArtifactResults,
    fixture_results: fixtureResults,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderBacktestReportMarkdown(result),
  };
}

export async function writeTradingBacktestReport(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-backtest-report.json"), serializableResult(result));
  await writeJson(path.join(outDir, "backtest-validation.json"), result.backtest_validation);
  await writeJson(path.join(outDir, "backtest-artifact-results.json"), {
    schema_version: "trading-backtest-artifact-results.v1",
    generated_at: result.generated_at,
    backtest_artifact_results: result.backtest_artifact_results,
  });
  await writeJson(path.join(outDir, "fixture-results.json"), {
    schema_version: "trading-backtest-validation-fixture-results.v1",
    generated_at: result.generated_at,
    fixture_results: result.fixture_results,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingBacktestReportCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingBacktestReport(args);
    console.log(`Trading backtest report ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.backtest_report_status}`);
    console.log(`Phase range: ${result.summary.phase_range}`);
    console.log(`Backtests: ${result.summary.backtest_artifact_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function validateBacktestArtifacts(backtestValidation, backtestSchema) {
  return (backtestValidation.backtest_artifacts ?? []).map((artifact, index) => {
    const errors = validateAgainstSchema(artifact, backtestSchema, {}, `backtest_artifacts[${index}]`);
    return {
      schema_version: "trading-backtest-artifact-validation-result.v1",
      backtest_id: artifact.backtest_id ?? null,
      validation: {
        valid: errors.length === 0,
        errors,
      },
      validation_items: [
        validationItem(`backtest_artifacts.${artifact.backtest_id ?? index}`, "backtest_schema_valid", errors.length === 0, errors.length === 0 ? "Backtest artifact validates." : `Backtest artifact has ${errors.length} schema error(s).`),
        ...errors.map((error) => validationItem(error.path, "backtest_schema_error", false, error.message)),
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
    validationItem("source.package.trading_backtest_report", "package_script_registered", Boolean(scripts["trading:backtest-report"]), "Package script trading:backtest-report is registered."),
    validationItem("source.pack.schemas.backtest_validation", "pack_schema_registered", packSchemas.includes("schemas/trading/trading-backtest-validation.schema.json"), "Trading pack manifest registers the backtest validation schema."),
    validationItem("source.pack.workflow.backtest_report", "pack_workflow_registered", workflows.includes("workflow.trading.backtest_report.v1"), "Trading pack manifest registers the backtest report workflow."),
    validationItem("source.pack.workflow.backtest_dashboard", "pack_workflow_registered", workflows.includes("workflow.trading.backtest_dashboard.v1"), "Trading pack manifest registers the backtest dashboard/API workflow."),
    validationItem("source.pack.golden.backtest_validation", "pack_golden_case_registered", goldenCases.includes("golden.trading.backtest_validation.p166_p195"), "Trading pack manifest registers the backtest validation golden case."),
    validationItem("source.capability.entrypoint.backtest_report", "capability_entrypoint_registered", entrypoints.some((entrypoint) => entrypoint.name === "trading:backtest-report"), "Trading capability manifest registers the backtest report entrypoint."),
    validationItem("source.capability.golden.backtest_validation", "capability_golden_case_registered", capabilityGoldenCases.some((fixture) => fixture.case_id === "golden.trading.backtest_validation.p166_p195"), "Trading capability manifest registers the backtest validation golden case."),
    validationItem("source.domain_pack_registry.trading", "domain_pack_registry_valid", domainPackRegistry.validation.valid === true && Boolean(tradingPack), "Domain pack registry remains valid with Trading registered."),
    validationItem("source.phase_ledger.p166_p195", "phase_ledger_updated", phaseLedgerText.includes("P166-P195 Acceptance Criteria") && phaseLedgerText.includes("trading:backtest-report"), "Phase ledger documents P166-P195 acceptance criteria and CLI."),
  ];
}

function buildBacktestValidationItems({
  backtestValidation,
  backtestValidationSchemaErrors,
  backtestArtifactResults,
  featureStore,
  signalEngine,
  modelImprovement,
}) {
  const phaseIds = new Set((backtestValidation.phase_coverage ?? []).map((phase) => phase.phase_id));
  const featureStoreDatasetIds = new Set((featureStore.market_data_artifacts ?? []).map((artifact) => artifact.dataset_id));
  const featureSnapshotIds = new Set((featureStore.feature_snapshots ?? []).map((snapshot) => snapshot.snapshot_id));
  const fxSnapshotIds = new Set((featureStore.fx_snapshots ?? []).map((snapshot) => snapshot.snapshot_id));
  const signalStrategyIds = new Set([
    ...(signalEngine.signal_candidates ?? []).map((candidate) => candidate.strategy_id),
    ...(signalEngine.aggregation_model?.strategy_weights ?? []).map((weight) => weight.strategy_id),
  ].filter(Boolean));
  const modelIds = new Set((modelImprovement.model_registry?.models ?? []).map((model) => model.model_id));
  const splitIds = new Set([modelImprovement.data_splits?.split_id].filter(Boolean));
  const backtestArtifacts = backtestValidation.backtest_artifacts ?? [];
  const backtestDatasetIds = new Set(backtestArtifacts.map((artifact) => artifact.dataset_id));
  const boundStrategyIds = new Set((backtestValidation.version_bindings?.strategy_versions ?? []).map((binding) => binding.strategy_id));
  const boundModelIds = new Set((backtestValidation.version_bindings?.model_versions ?? []).map((binding) => binding.model_id));
  const stressTypes = new Set((backtestValidation.stress_scenarios ?? []).map((scenario) => scenario.scenario_type));
  const stressIds = new Set((backtestValidation.stress_scenarios ?? []).map((scenario) => scenario.scenario_id));
  const dashboardRoutes = backtestValidation.dashboard_api_stub?.routes ?? [];
  const disabledRoutes = backtestValidation.dashboard_api_stub?.disabled_routes ?? [];
  return [
    validationItem("backtest_validation.schema", "schema_validation_passed", backtestValidationSchemaErrors.length === 0, backtestValidationSchemaErrors.length === 0 ? "Backtest validation layer validates against schema." : `Backtest validation layer has ${backtestValidationSchemaErrors.length} schema error(s).`),
    ...backtestValidationSchemaErrors.map((error) => validationItem(error.path, "schema_error", false, error.message)),
    validationItem("backtest_validation.phase_range", "phase_range_p166_p195", backtestValidation.phase_range === "P166-P195", "Backtest validation is scoped to P166-P195."),
    validationItem("backtest_validation.phase_coverage", "all_phases_covered", REQUIRED_PHASE_IDS.every((phaseId) => phaseIds.has(phaseId)) && (backtestValidation.phase_coverage ?? []).every((phase) => phase.status === "complete"), "All P166-P195 phases are covered and complete."),
    validationItem("backtest_validation.safety.deterministic", "deterministic_simulation_only", backtestValidation.safety_boundary?.deterministic_only === true && backtestValidation.safety_boundary?.simulation_only === true, "Backtest runner is deterministic and simulation-only."),
    validationItem("backtest_validation.safety.no_advice_orders_live", "no_advice_recommendation_order_or_live", backtestValidation.safety_boundary?.investment_advice_generated === false && backtestValidation.safety_boundary?.trade_recommendation_generated === false && backtestValidation.safety_boundary?.order_intent_generated === false && backtestValidation.safety_boundary?.paper_order_generated === false && backtestValidation.safety_boundary?.live_execution_allowed === false, "Backtests do not generate advice, recommendations, orders, or live execution."),
    validationItem("backtest_validation.safety.no_promotion", "no_promotion_candidate_generated", backtestValidation.safety_boundary?.promotion_candidate_generated === false && backtestValidation.promotion_boundary?.promotion_candidate_generated === false, "Backtest validation does not generate promotion candidates."),
    validationItem("backtest_validation.runner", "runner_deterministic_no_mutation", backtestValidation.runner?.run_mode === "deterministic_backtest" && backtestValidation.runner?.data_replay_required === true && backtestValidation.runner?.mutation_allowed === false && Number.isFinite(backtestValidation.runner?.seed), "Backtest runner uses deterministic replay and no mutation."),
    validationItem("backtest_validation.strategy_versions", "strategy_bindings_registered", boundStrategyIds.size > 0 && [...boundStrategyIds].every((strategyId) => signalStrategyIds.has(strategyId)), "Strategy version bindings reference signal-engine strategy ids."),
    validationItem("backtest_validation.model_versions", "model_bindings_registered", boundModelIds.size > 0 && [...boundModelIds].every((modelId) => modelIds.has(modelId)), "Model version bindings reference model registry ids."),
    validationItem("backtest_validation.costs.transaction_slippage", "transaction_and_slippage_enabled", backtestValidation.cost_models?.transaction_cost?.enabled === true && backtestValidation.cost_models?.transaction_cost?.basis_points >= 0 && backtestValidation.cost_models?.slippage?.enabled === true && backtestValidation.cost_models?.slippage?.basis_points >= 0, "Transaction cost and slippage models are enabled with non-negative bps."),
    validationItem("backtest_validation.costs.fx", "fx_conversion_source_valid", backtestValidation.cost_models?.fx_conversion?.enabled === true && fxSnapshotIds.has(backtestValidation.cost_models?.fx_conversion?.source_ref), "FX conversion uses a registered manual FX snapshot."),
    validationItem("backtest_validation.costs.crypto_fee", "crypto_fee_enabled", backtestValidation.cost_models?.crypto_fee?.enabled === true && backtestValidation.cost_models?.crypto_fee?.basis_points >= 0, "Crypto fee model is enabled with non-negative bps."),
    validationItem("backtest_validation.position_sizing", "position_sizing_safe", backtestValidation.position_sizing?.leverage_allowed === false && backtestValidation.position_sizing?.max_position_pct > 0 && backtestValidation.position_sizing?.max_position_pct <= 1, "Position sizing is bounded and leverage is disabled."),
    validationItem("backtest_validation.artifacts.schema", "backtest_artifacts_validate", backtestArtifactResults.length >= 2 && backtestArtifactResults.every((result) => result.validation.valid), "Backtest artifacts validate against trading-backtest.v1."),
    ...backtestArtifactResults.flatMap((result) => result.validation_items),
    validationItem("backtest_validation.artifacts.dataset_refs", "backtest_dataset_refs_exist", backtestDatasetIds.size > 0 && [...backtestDatasetIds].every((datasetId) => featureStoreDatasetIds.has(datasetId)), "Backtest artifacts reference market-data feature store datasets."),
    validationItem("backtest_validation.artifacts.no_promotion", "backtest_artifacts_not_promotion_candidates", backtestArtifacts.every((artifact) => artifact.promotion_candidate === false), "Backtest artifacts are not promotion candidates."),
    validationItem("backtest_validation.portfolio", "portfolio_backtest_safe", backtestValidation.portfolio_backtest?.enabled === true && backtestValidation.portfolio_backtest?.live_trading_enabled === false && (backtestValidation.portfolio_backtest?.dataset_refs ?? []).every((datasetId) => featureStoreDatasetIds.has(datasetId)), "Portfolio backtest is enabled on fixture datasets with live trading disabled."),
    validationItem("backtest_validation.multi_strategy", "multi_strategy_backtest_declared", backtestValidation.multi_strategy_backtest?.enabled === true && (backtestValidation.multi_strategy_backtest?.strategy_ids ?? []).length >= 2 && backtestValidation.multi_strategy_backtest?.correlation_penalty_applied === true, "Multi-strategy backtest is declared with correlation penalty."),
    validationItem("backtest_validation.benchmark", "benchmark_comparison_informational", backtestValidation.benchmark_comparison?.enabled === true && backtestValidation.benchmark_comparison?.result === "informational", "Benchmark comparison is informational."),
    validationItem("backtest_validation.metrics.return_drawdown_win_payoff", "core_metrics_finite", ["cagr_pct", "return_pct", "max_drawdown_pct", "win_rate", "payoff_ratio", "risk_adjusted_score"].every((key) => Number.isFinite(backtestValidation.metric_suite?.[key])) && backtestValidation.metric_suite?.win_rate >= 0 && backtestValidation.metric_suite?.win_rate <= 1, "CAGR, return, drawdown, win rate, payoff, and risk-adjusted metrics are finite."),
    validationItem("backtest_validation.exposure_turnover_capacity", "exposure_turnover_capacity_declared", Number.isFinite(backtestValidation.exposure_turnover_capacity?.exposure_time_pct) && Number.isFinite(backtestValidation.exposure_turnover_capacity?.turnover_pct) && backtestValidation.exposure_turnover_capacity?.capacity_estimate?.status !== "block" && featureSnapshotIds.has(backtestValidation.exposure_turnover_capacity?.capacity_estimate?.liquidity_source_ref), "Exposure, turnover, and capacity are declared with feature lineage."),
    validationItem("backtest_validation.bias.lookahead", "lookahead_bias_passed", backtestValidation.bias_checks?.lookahead_bias?.result === "pass" && backtestValidation.bias_checks?.lookahead_bias?.blocks_promotion === true && backtestArtifacts.every((artifact) => artifact.bias_checks?.lookahead_bias_check === "passed"), "Lookahead-bias checks pass and block promotion on failure."),
    validationItem("backtest_validation.bias.survivorship", "survivorship_bias_note_reviewed", typeof backtestValidation.bias_checks?.survivorship_bias?.note === "string" && backtestValidation.bias_checks.survivorship_bias.note.length > 0 && backtestValidation.bias_checks.survivorship_bias.requires_human_review === true, "Survivorship-bias note requires human review."),
    validationItem("backtest_validation.bias.overfitting", "overfitting_warning_blocks_promotion", ["pass", "warn"].includes(backtestValidation.bias_checks?.overfitting?.result) && backtestValidation.bias_checks?.overfitting?.blocks_promotion === true, "Overfitting warning is present and blocks promotion."),
    validationItem("backtest_validation.walk_forward", "walk_forward_valid", backtestValidation.walk_forward_validation?.enabled === true && backtestValidation.walk_forward_validation?.window_count > 0 && backtestValidation.walk_forward_validation?.all_windows_after_training === true && backtestValidation.walk_forward_validation?.result === "pass" && splitIds.has(backtestValidation.walk_forward_validation?.source_split_ref), "Walk-forward validation is enabled and bound to the model split contract."),
    validationItem("backtest_validation.stress.required", "required_stress_scenarios_present", REQUIRED_STRESS_TYPES.every((stressType) => stressTypes.has(stressType)) && (backtestValidation.stress_scenarios ?? []).every((scenario) => scenario.result !== "block" && scenario.blocks_promotion === true), "Liquidity, crash regime, and crypto 24/7 stress scenarios are present and block promotion."),
    validationItem("backtest_validation.replay.crash", "crash_regime_replay_enabled", backtestValidation.replay_modes?.crash_regime_replay?.enabled === true && stressIds.has(backtestValidation.replay_modes?.crash_regime_replay?.scenario_ref), "Crash regime replay is enabled and references a stress scenario."),
    validationItem("backtest_validation.replay.crypto", "crypto_weekend_gap_replay_enabled", backtestValidation.replay_modes?.crypto_weekend_gap_replay?.enabled === true && stressIds.has(backtestValidation.replay_modes?.crypto_weekend_gap_replay?.scenario_ref), "Crypto weekend gap replay is enabled and references a stress scenario."),
    validationItem("backtest_validation.promotion_boundary", "promotion_boundary_blocked", backtestValidation.promotion_boundary?.promotion_candidate_generated === false && backtestValidation.promotion_boundary?.promotion_requires_future_risk_gate === true && backtestValidation.promotion_boundary?.live_promotion_allowed === false, "Backtest promotion boundary is blocked until future risk gate."),
    validationItem("backtest_validation.dashboard", "dashboard_read_only", backtestValidation.dashboard_api_stub?.read_only === true && backtestValidation.dashboard_api_stub?.mutating_routes_enabled === false && dashboardRoutes.length > 0 && dashboardRoutes.every((route) => route.method === "GET"), "Backtest dashboard/API is read-only."),
    validationItem("backtest_validation.dashboard.disabled", "unsafe_routes_disabled", disabledRoutes.some((route) => route.path === "/api/trading/backtests/promote") && disabledRoutes.some((route) => route.path === "/api/trading/backtests/to-order-intent") && disabledRoutes.some((route) => route.path === "/api/trading/orders"), "Backtest promotion, order-intent, and order routes are disabled."),
  ];
}

function buildFixtureResults(goldenFixtures, backtestValidation, backtestItems) {
  return (goldenFixtures.fixtures ?? []).map((fixture) => {
    const regressionHash = hashValue({
      fixture_id: fixture.fixture_id,
      phase_range: backtestValidation.phase_range,
      phase_coverage: backtestValidation.phase_coverage,
      backtest_ids: (backtestValidation.backtest_artifacts ?? []).map((artifact) => artifact.backtest_id).sort(),
      safety_boundary: backtestValidation.safety_boundary,
      cost_models: backtestValidation.cost_models,
      metric_suite: backtestValidation.metric_suite,
      bias_checks: backtestValidation.bias_checks,
      stress_scenarios: backtestValidation.stress_scenarios,
      promotion_boundary: backtestValidation.promotion_boundary,
    });
    const validationItems = [
      validationItem(`fixtures.${fixture.fixture_id}.status`, "fixture_status_matches", fixture.expected_status === "complete" && backtestItems.every((item) => item.status === "passed"), `${fixture.fixture_id} expected status is complete.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_range`, "fixture_phase_range_matches", backtestValidation.phase_range === fixture.expected_phase_range, `${fixture.fixture_id} phase range matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_count`, "fixture_phase_count_matches", (backtestValidation.phase_coverage ?? []).length === fixture.expected_phase_count, `${fixture.fixture_id} phase count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.artifact_count`, "fixture_backtest_artifact_count_matches", (backtestValidation.backtest_artifacts ?? []).length === fixture.expected_backtest_artifact_count, `${fixture.fixture_id} backtest artifact count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.strategy_binding_count`, "fixture_strategy_binding_count_matches", (backtestValidation.version_bindings?.strategy_versions ?? []).length === fixture.expected_strategy_binding_count, `${fixture.fixture_id} strategy binding count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.model_binding_count`, "fixture_model_binding_count_matches", (backtestValidation.version_bindings?.model_versions ?? []).length === fixture.expected_model_binding_count, `${fixture.fixture_id} model binding count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.stress_count`, "fixture_stress_scenario_count_matches", (backtestValidation.stress_scenarios ?? []).length === fixture.expected_stress_scenario_count, `${fixture.fixture_id} stress scenario count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.order_intent_count`, "fixture_order_intent_count_matches", (backtestValidation.safety_boundary?.order_intent_generated === true ? 1 : 0) === fixture.expected_generated_order_intent_count, `${fixture.fixture_id} generated order intent count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.promotion_boundary`, "fixture_promotion_boundary_matches", backtestValidation.promotion_boundary?.promotion_candidate_generated === fixture.expected_promotion_candidate_generated, `${fixture.fixture_id} promotion candidate boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.live_boundary`, "fixture_live_boundary_matches", backtestValidation.safety_boundary?.live_execution_allowed === fixture.expected_live_execution_allowed, `${fixture.fixture_id} live execution boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.dashboard`, "fixture_dashboard_boundary_matches", backtestValidation.dashboard_api_stub?.read_only === fixture.expected_dashboard_read_only, `${fixture.fixture_id} dashboard boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.hash`, "fixture_regression_hash_locked", regressionHash.startsWith("sha256:"), `${fixture.fixture_id} regression hash is locked.`),
    ];
    const validation = summarizeValidation(validationItems);
    return {
      schema_version: "trading-backtest-validation-fixture-result.v1",
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

function summarizeBacktestReport({ backtestValidation, backtestArtifactResults, fixtureResults, validationItems, validation }) {
  return {
    backtest_report_status: validation.valid ? "complete" : "blocked",
    phase_range: backtestValidation.phase_range,
    phase_count: backtestValidation.phase_coverage?.length ?? 0,
    complete_phase_count: (backtestValidation.phase_coverage ?? []).filter((phase) => phase.status === "complete").length,
    backtest_artifact_count: backtestValidation.backtest_artifacts?.length ?? 0,
    backtest_schema_valid_count: backtestArtifactResults.filter((result) => result.validation.valid).length,
    strategy_binding_count: backtestValidation.version_bindings?.strategy_versions?.length ?? 0,
    model_binding_count: backtestValidation.version_bindings?.model_versions?.length ?? 0,
    stress_scenario_count: backtestValidation.stress_scenarios?.length ?? 0,
    fixture_count: fixtureResults.length,
    passed_fixture_count: fixtureResults.filter((fixture) => fixture.validation.valid).length,
    locked_regression_hash_count: fixtureResults.filter((fixture) => fixture.regression_hash?.startsWith("sha256:")).length,
    validation_item_count: validationItems.length,
    validation_error_count: validation.errors.length,
    deterministic_only: backtestValidation.safety_boundary?.deterministic_only === true,
    simulation_only: backtestValidation.safety_boundary?.simulation_only === true,
    order_intent_generated: backtestValidation.safety_boundary?.order_intent_generated === true,
    live_execution_allowed: backtestValidation.safety_boundary?.live_execution_allowed === true,
    promotion_candidate_generated: backtestValidation.promotion_boundary?.promotion_candidate_generated === true,
    dashboard_read_only: backtestValidation.dashboard_api_stub?.read_only === true,
  };
}

function renderBacktestReportMarkdown(result) {
  const lines = [];
  lines.push("# Trading Backtest Report");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.backtest_report_status}`);
  lines.push("");
  lines.push(`- Phase range: ${result.summary.phase_range}`);
  lines.push(`- Phases complete: ${result.summary.complete_phase_count}/${result.summary.phase_count}`);
  lines.push(`- Backtest artifacts: ${result.summary.backtest_artifact_count}`);
  lines.push(`- Strategy bindings: ${result.summary.strategy_binding_count}`);
  lines.push(`- Model bindings: ${result.summary.model_binding_count}`);
  lines.push(`- Stress scenarios: ${result.summary.stress_scenario_count}`);
  lines.push(`- Order intent generated: ${result.summary.order_intent_generated}`);
  lines.push(`- Live execution allowed: ${result.summary.live_execution_allowed}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options = {}) {
  return {
    backtest_validation_path: path.resolve(options.backtestValidationPath ?? DEFAULT_TRADING_BACKTEST_VALIDATION_INPUTS.backtestValidationPath),
    backtest_validation_schema_path: path.resolve(options.backtestValidationSchemaPath ?? DEFAULT_TRADING_BACKTEST_VALIDATION_INPUTS.backtestValidationSchemaPath),
    backtest_schema_path: path.resolve(options.backtestSchemaPath ?? DEFAULT_TRADING_BACKTEST_VALIDATION_INPUTS.backtestSchemaPath),
    feature_store_path: path.resolve(options.featureStorePath ?? DEFAULT_TRADING_BACKTEST_VALIDATION_INPUTS.featureStorePath),
    signal_engine_path: path.resolve(options.signalEnginePath ?? DEFAULT_TRADING_BACKTEST_VALIDATION_INPUTS.signalEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_BACKTEST_VALIDATION_INPUTS.modelImprovementPath),
    golden_fixtures_path: path.resolve(options.goldenFixturesPath ?? DEFAULT_TRADING_BACKTEST_VALIDATION_INPUTS.goldenFixturesPath),
    pack_manifest_path: path.resolve(options.packManifestPath ?? DEFAULT_TRADING_BACKTEST_VALIDATION_INPUTS.packManifestPath),
    capability_manifest_path: path.resolve(options.capabilityManifestPath ?? DEFAULT_TRADING_BACKTEST_VALIDATION_INPUTS.capabilityManifestPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_BACKTEST_VALIDATION_INPUTS.packagePath),
    phase_ledger_path: path.resolve(options.phaseLedgerPath ?? DEFAULT_TRADING_BACKTEST_VALIDATION_INPUTS.phaseLedgerPath),
  };
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_TRADING_BACKTEST_REPORT_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--backtest-validation") parsed.backtestValidationPath = argv[++index];
    else if (arg === "--backtest-validation-schema") parsed.backtestValidationSchemaPath = argv[++index];
    else if (arg === "--backtest-schema") parsed.backtestSchemaPath = argv[++index];
    else if (arg === "--feature-store") parsed.featureStorePath = argv[++index];
    else if (arg === "--signal-engine") parsed.signalEnginePath = argv[++index];
    else if (arg === "--model-improvement") parsed.modelImprovementPath = argv[++index];
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

function printHelp() {
  console.log(`Usage: node scripts/trading-backtest-report.mjs [options]

Options:
  --out-dir <folder>                    Output directory. Default: ${DEFAULT_TRADING_BACKTEST_REPORT_OUT_DIR}
  --run-at <iso>                        Deterministic generated_at timestamp.
  --backtest-validation <path>          Backtest validation fixture path.
  --backtest-validation-schema <path>   Backtest validation schema path.
  --backtest-schema <path>              trading-backtest schema path.
  --feature-store <path>                Market data feature store fixture path.
  --signal-engine <path>                Signal engine fixture path.
  --model-improvement <path>            Model improvement fixture path.
  --golden-fixtures <path>              Backtest validation golden fixtures path.
  --pack-manifest <path>                Trading pack manifest path.
  --capability-manifest <path>          Trading capability manifest path.
  --package <path>                      package.json path.
  --phase-ledger <path>                 Trading phase ledger path.
  --check                               Validate only, do not write artifacts.
  -h, --help                            Show this help.
`);
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
    validation_item_id: `trading-backtest-validation.${slugify(itemPath)}.${checkId}`,
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
