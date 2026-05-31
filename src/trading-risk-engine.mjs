import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildDomainPackRegistry } from "./domain-pack-registry.mjs";

export const DEFAULT_TRADING_RISK_CHECK_OUT_DIR = "artifacts/trading-risk-check/latest";
export const DEFAULT_TRADING_RISK_ENGINE_INPUTS = {
  riskEnginePath: "examples/trading/risk-engine.json",
  riskEngineSchemaPath: "schemas/trading/trading-risk-engine.schema.json",
  riskSchemaPath: "schemas/trading/trading-risk.schema.json",
  featureStorePath: "examples/trading/market-data-feature-store.json",
  modelImprovementPath: "examples/trading/model-improvement-layer.json",
  backtestValidationPath: "examples/trading/backtest-validation.json",
  goldenFixturesPath: "examples/trading/risk-engine-golden-fixtures.json",
  packManifestPath: "packs/trading/pack.json",
  capabilityManifestPath: "packs/trading/capabilities/research-backtest-paper.json",
  packagePath: "package.json",
  phaseLedgerPath: "docs/trading-pack-phase-ledger.md",
};

const REQUIRED_PHASE_IDS = Array.from({ length: 25 }, (_, index) => `P${String(196 + index).padStart(3, "0")}`);
const REQUIRED_RESULT_VALUES = ["pass", "warn", "block", "halt"];
const REQUIRED_RISK_GUARDS = [
  "volatility_guard",
  "liquidity_guard",
  "stale_data_trade_block",
  "abnormal_spread_block",
  "correlated_exposure_warning",
  "fx_exposure_warning",
  "leverage_margin_gate",
  "short_selling_capability_gate",
  "order_frequency_throttle",
  "loss_streak_cooldown",
  "model_degradation_halt",
  "data_outage_halt",
];
const REQUIRED_RISK_CHECK_IDS = [
  "portfolio_exposure_limit",
  "asset_class_exposure_limit",
  "single_name_concentration",
  "altcoin_max_allocation",
  "daily_loss_limit",
  "weekly_loss_limit",
  "max_drawdown_halt",
  "volatility_guard",
  "liquidity_guard",
  "stale_data_trade_block",
  "abnormal_spread_block",
  "correlated_exposure_warning",
  "fx_exposure_warning",
  "leverage_margin_disabled",
  "short_selling_capability_gate",
  "order_frequency_throttle",
  "loss_streak_cooldown",
  "model_degradation_halt",
  "data_outage_halt",
];

export async function runTradingRiskCheck(options = {}) {
  const result = await buildTradingRiskCheck(options);
  if (options.write !== false) await writeTradingRiskCheck(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading risk check validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingRiskCheck(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_RISK_CHECK_OUT_DIR);
  const inputs = normalizeInputs(options);
  const riskEngine = await readJson(inputs.risk_engine_path);
  const riskEngineSchema = await readJson(inputs.risk_engine_schema_path);
  const riskSchema = await readJson(inputs.risk_schema_path);
  const featureStore = await readJson(inputs.feature_store_path);
  const modelImprovement = await readJson(inputs.model_improvement_path);
  const backtestValidation = await readJson(inputs.backtest_validation_path);
  const goldenFixtures = await readJson(inputs.golden_fixtures_path);
  const packManifest = await readJson(inputs.pack_manifest_path);
  const capabilityManifest = await readJson(inputs.capability_manifest_path);
  const packageJson = await readJson(inputs.package_path);
  const phaseLedgerText = await readFile(inputs.phase_ledger_path, "utf8");
  const domainPackRegistry = await buildDomainPackRegistry({ runAt: generatedAt });

  const riskEngineSchemaErrors = validateAgainstSchema(riskEngine, riskEngineSchema, {}, "risk_engine");
  const riskArtifactResults = validateRiskArtifacts(riskEngine, riskSchema);
  const sourceItems = buildSourceValidationItems({
    packageJson,
    packManifest,
    capabilityManifest,
    phaseLedgerText,
    domainPackRegistry,
  });
  const riskItems = buildRiskEngineValidationItems({
    riskEngine,
    riskEngineSchemaErrors,
    riskArtifactResults,
    featureStore,
    modelImprovement,
    backtestValidation,
  });
  const fixtureResults = buildFixtureResults(goldenFixtures, riskEngine, riskItems);
  const validationItems = [
    ...sourceItems,
    ...riskItems,
    ...fixtureResults.flatMap((fixture) => fixture.validation_items),
  ];
  const validation = summarizeValidation(validationItems);
  const summary = summarizeRiskCheck({ riskEngine, riskArtifactResults, fixtureResults, validationItems, validation });
  const result = {
    schema_version: "trading-risk-check-report.v1",
    generated_at: generatedAt,
    risk_check_report_id: `trading-risk-check.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      risk_engine: sourceContract("risk_engine", inputs.risk_engine_path, riskEngine.schema_version, riskEngine.risk_engine_status === "complete"),
      risk_engine_schema: sourceContract("risk_engine_schema", inputs.risk_engine_schema_path, riskEngineSchema.title, riskEngineSchemaErrors.length === 0),
      risk_schema: sourceContract("trading_risk_schema", inputs.risk_schema_path, riskSchema.title, riskArtifactResults.every((item) => item.validation.valid)),
      feature_store: sourceContract("market_data_feature_store", inputs.feature_store_path, featureStore.schema_version, featureStore.feature_store_status === "complete"),
      model_improvement: sourceContract("model_improvement", inputs.model_improvement_path, modelImprovement.schema_version, modelImprovement.model_improvement_status === "complete"),
      backtest_validation: sourceContract("backtest_validation", inputs.backtest_validation_path, backtestValidation.schema_version, backtestValidation.backtest_validation_status === "complete"),
      golden_fixtures: sourceContract("risk_engine_golden_fixtures", inputs.golden_fixtures_path, goldenFixtures.schema_version, Array.isArray(goldenFixtures.fixtures)),
      pack_manifest: sourceContract("trading_pack_manifest", inputs.pack_manifest_path, packManifest.schema_version, packManifest.pack_id === "trading"),
      capability_manifest: sourceContract("trading_capability_manifest", inputs.capability_manifest_path, capabilityManifest.schema_version, capabilityManifest.domain_pack === "trading"),
      domain_pack_registry: {
        source_id: "domain_pack_registry",
        status: domainPackRegistry.validation.valid ? "valid" : "invalid",
        trading_registered: Boolean(domainPackRegistry.packs.find((pack) => pack.pack_id === "trading")),
      },
    },
    risk_engine: riskEngine,
    risk_artifact_results: riskArtifactResults,
    fixture_results: fixtureResults,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderRiskCheckMarkdown(result),
  };
}

export async function writeTradingRiskCheck(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-risk-check.json"), serializableResult(result));
  await writeJson(path.join(outDir, "risk-engine.json"), result.risk_engine);
  await writeJson(path.join(outDir, "risk-artifact-results.json"), {
    schema_version: "trading-risk-artifact-results.v1",
    generated_at: result.generated_at,
    risk_artifact_results: result.risk_artifact_results,
  });
  await writeJson(path.join(outDir, "fixture-results.json"), {
    schema_version: "trading-risk-engine-fixture-results.v1",
    generated_at: result.generated_at,
    fixture_results: result.fixture_results,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingRiskCheckCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingRiskCheck(args);
    console.log(`Trading risk check ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.risk_check_status}`);
    console.log(`Phase range: ${result.summary.phase_range}`);
    console.log(`Risk result: ${result.summary.primary_risk_result}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function validateRiskArtifacts(riskEngine, riskSchema) {
  return (riskEngine.risk_check_artifacts ?? []).map((artifact, index) => {
    const errors = validateAgainstSchema(artifact, riskSchema, {}, `risk_check_artifacts[${index}]`);
    return {
      schema_version: "trading-risk-artifact-validation-result.v1",
      risk_check_id: artifact.risk_check_id ?? null,
      validation: {
        valid: errors.length === 0,
        errors,
      },
      validation_items: [
        validationItem(`risk_check_artifacts.${artifact.risk_check_id ?? index}`, "risk_schema_valid", errors.length === 0, errors.length === 0 ? "Risk artifact validates." : `Risk artifact has ${errors.length} schema error(s).`),
        ...errors.map((error) => validationItem(error.path, "risk_schema_error", false, error.message)),
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
    validationItem("source.package.trading_risk_check", "package_script_registered", Boolean(scripts["trading:risk-check"]), "Package script trading:risk-check is registered."),
    validationItem("source.pack.schemas.risk_engine", "pack_schema_registered", packSchemas.includes("schemas/trading/trading-risk-engine.schema.json"), "Trading pack manifest registers the risk engine schema."),
    validationItem("source.pack.workflow.risk_check", "pack_workflow_registered", workflows.includes("workflow.trading.risk_check.v1"), "Trading pack manifest registers the risk check workflow."),
    validationItem("source.pack.workflow.risk_dashboard", "pack_workflow_registered", workflows.includes("workflow.trading.risk_dashboard.v1"), "Trading pack manifest registers the risk dashboard/API workflow."),
    validationItem("source.pack.workflow.risk_freeze", "pack_workflow_registered", workflows.includes("workflow.trading.risk_freeze.v1"), "Trading pack manifest registers the risk freeze workflow."),
    validationItem("source.pack.golden.risk_engine", "pack_golden_case_registered", goldenCases.includes("golden.trading.risk_engine.p196_p220"), "Trading pack manifest registers the risk engine golden case."),
    validationItem("source.capability.entrypoint.risk_check", "capability_entrypoint_registered", entrypoints.some((entrypoint) => entrypoint.name === "trading:risk-check"), "Trading capability manifest registers the risk check entrypoint."),
    validationItem("source.capability.golden.risk_engine", "capability_golden_case_registered", capabilityGoldenCases.some((fixture) => fixture.case_id === "golden.trading.risk_engine.p196_p220"), "Trading capability manifest registers the risk engine golden case."),
    validationItem("source.domain_pack_registry.trading", "domain_pack_registry_valid", domainPackRegistry.validation.valid === true && Boolean(tradingPack), "Domain pack registry remains valid with Trading registered."),
    validationItem("source.phase_ledger.p196_p220", "phase_ledger_updated", phaseLedgerText.includes("P196-P220 Acceptance Criteria") && phaseLedgerText.includes("trading:risk-check"), "Phase ledger documents P196-P220 acceptance criteria and CLI."),
  ];
}

function buildRiskEngineValidationItems({
  riskEngine,
  riskEngineSchemaErrors,
  riskArtifactResults,
  featureStore,
  modelImprovement,
  backtestValidation,
}) {
  const phaseIds = new Set((riskEngine.phase_coverage ?? []).map((phase) => phase.phase_id));
  const featureSnapshotIds = new Set((featureStore.feature_snapshots ?? []).map((snapshot) => snapshot.snapshot_id));
  const fxSnapshotIds = new Set((featureStore.fx_snapshots ?? []).map((snapshot) => snapshot.snapshot_id));
  const modelDegradationCheckIds = new Set((modelImprovement.degradation_checks ?? []).map((check) => check.check_id));
  const backtestFeatureRefs = new Set([
    backtestValidation.exposure_turnover_capacity?.capacity_estimate?.liquidity_source_ref,
    ...(backtestValidation.portfolio_backtest?.dataset_refs ?? []),
  ].filter(Boolean));
  const riskLimits = riskEngine.risk_limits ?? {};
  const riskGuards = riskEngine.risk_guards ?? {};
  const primaryRiskArtifact = riskEngine.risk_check_artifacts?.[0] ?? {};
  const primaryRiskCheckIds = new Set((primaryRiskArtifact.checks ?? []).map((check) => check.check_id));
  const allowedResults = riskEngine.risk_result_policy?.allowed_results ?? [];
  const dashboardRoutes = riskEngine.dashboard_api_stub?.routes ?? [];
  const disabledRoutes = riskEngine.dashboard_api_stub?.disabled_routes ?? [];
  const guardResults = Object.values(riskGuards).map((guard) => guard?.result).filter(Boolean);
  const assetClassLimits = riskLimits.asset_class_exposure_limits ?? [];
  return [
    validationItem("risk_engine.schema", "schema_validation_passed", riskEngineSchemaErrors.length === 0, riskEngineSchemaErrors.length === 0 ? "Risk engine validates against schema." : `Risk engine has ${riskEngineSchemaErrors.length} schema error(s).`),
    ...riskEngineSchemaErrors.map((error) => validationItem(error.path, "schema_error", false, error.message)),
    validationItem("risk_engine.phase_range", "phase_range_p196_p220", riskEngine.phase_range === "P196-P220", "Risk engine is scoped to P196-P220."),
    validationItem("risk_engine.phase_coverage", "all_phases_covered", REQUIRED_PHASE_IDS.every((phaseId) => phaseIds.has(phaseId)) && (riskEngine.phase_coverage ?? []).every((phase) => phase.status === "complete"), "All P196-P220 phases are covered and complete."),
    validationItem("risk_engine.safety.pre_order", "pre_order_gate_only", riskEngine.safety_boundary?.pre_order_gate_only === true, "Risk engine is pre-order gate only."),
    validationItem("risk_engine.safety.no_advice_orders_live", "no_advice_recommendation_order_or_live", riskEngine.safety_boundary?.investment_advice_generated === false && riskEngine.safety_boundary?.trade_recommendation_generated === false && riskEngine.safety_boundary?.order_intent_generated === false && riskEngine.safety_boundary?.live_execution_allowed === false, "Risk engine does not generate advice, recommendations, order intent, or live execution."),
    validationItem("risk_engine.safety.override", "override_without_human_forbidden", riskEngine.safety_boundary?.risk_override_without_human_allowed === false && riskEngine.safety_boundary?.human_review_required === true, "Risk override without human review is forbidden."),
    validationItem("risk_engine.portfolio", "portfolio_context_safe", riskEngine.portfolio_context?.stage === "paper" && riskEngine.portfolio_context?.live_trading_enabled === false && (riskEngine.portfolio_context?.asset_ids ?? []).length >= 1, "Portfolio context is paper-stage with live trading disabled."),
    validationItem("risk_engine.limits.portfolio_exposure", "portfolio_exposure_limit_safe", riskLimits.portfolio_exposure_limit?.current_pct <= riskLimits.portfolio_exposure_limit?.limit_pct && riskLimits.portfolio_exposure_limit?.result === "pass", "Portfolio exposure is inside limit."),
    validationItem("risk_engine.limits.asset_class", "asset_class_limits_safe", assetClassLimits.length >= 3 && assetClassLimits.every((limit) => limit.current_pct <= limit.limit_pct && limit.result === "pass"), "Asset-class exposures are inside limits."),
    validationItem("risk_engine.limits.single_name", "single_name_concentration_safe", riskLimits.single_name_concentration?.largest_name_pct <= riskLimits.single_name_concentration?.limit_pct && riskLimits.single_name_concentration?.result === "pass", "Single-name concentration is inside limit."),
    validationItem("risk_engine.limits.altcoin", "altcoin_allocation_safe", riskLimits.altcoin_max_allocation?.current_pct <= riskLimits.altcoin_max_allocation?.limit_pct && riskLimits.altcoin_max_allocation?.result === "pass", "Altcoin allocation is inside limit."),
    validationItem("risk_engine.limits.daily_loss", "daily_loss_limit_safe", riskLimits.daily_loss_limit?.current_pct >= riskLimits.daily_loss_limit?.limit_pct && riskLimits.daily_loss_limit?.result === "pass", "Daily loss is inside limit."),
    validationItem("risk_engine.limits.weekly_loss", "weekly_loss_limit_safe", riskLimits.weekly_loss_limit?.current_pct >= riskLimits.weekly_loss_limit?.limit_pct && riskLimits.weekly_loss_limit?.result === "pass", "Weekly loss is inside limit."),
    validationItem("risk_engine.limits.drawdown", "max_drawdown_halt_safe", riskLimits.max_drawdown_halt?.current_drawdown_pct >= riskLimits.max_drawdown_halt?.halt_pct && riskLimits.max_drawdown_halt?.result === "pass", "Max drawdown halt is not triggered."),
    validationItem("risk_engine.guards.required", "required_guards_present", REQUIRED_RISK_GUARDS.every((guardId) => Boolean(riskGuards[guardId])), "All P203-P214 risk guards are present."),
    validationItem("risk_engine.guards.volatility", "volatility_guard_bound_to_feature_store", riskGuards.volatility_guard?.result === "pass" && featureSnapshotIds.has(riskGuards.volatility_guard?.source_ref) && riskGuards.volatility_guard?.blocks_order_intent === true, "Volatility guard is bound to feature store and blocks order intent."),
    validationItem("risk_engine.guards.liquidity", "liquidity_guard_bound_to_feature_store", riskGuards.liquidity_guard?.result === "pass" && featureSnapshotIds.has(riskGuards.liquidity_guard?.source_ref) && riskGuards.liquidity_guard?.blocks_order_intent === true && backtestFeatureRefs.has(riskGuards.liquidity_guard?.source_ref), "Liquidity guard is bound to feature/backtest lineage and blocks order intent."),
    validationItem("risk_engine.guards.stale_data", "stale_data_blocks_trade", riskGuards.stale_data_trade_block?.stale_data_detected === false && riskGuards.stale_data_trade_block?.result === "pass" && riskGuards.stale_data_trade_block?.blocks_order_intent === true, "Stale data guard would block order intent."),
    validationItem("risk_engine.guards.abnormal_spread", "abnormal_spread_blocks_trade", riskGuards.abnormal_spread_block?.abnormal_spread_detected === false && riskGuards.abnormal_spread_block?.result === "pass" && riskGuards.abnormal_spread_block?.blocks_order_intent === true, "Abnormal spread guard would block order intent."),
    validationItem("risk_engine.guards.correlated_exposure", "correlated_exposure_warning_review", riskGuards.correlated_exposure_warning?.result === "pass" && riskGuards.correlated_exposure_warning?.warning_requires_review === true, "Correlated exposure warning requires review."),
    validationItem("risk_engine.guards.fx_exposure", "fx_exposure_warning_review", riskGuards.fx_exposure_warning?.result === "pass" && riskGuards.fx_exposure_warning?.warning_requires_review === true && fxSnapshotIds.has(riskGuards.fx_exposure_warning?.source_ref), "FX exposure warning is bound to FX snapshot and requires review."),
    validationItem("risk_engine.guards.leverage_margin", "leverage_margin_disabled", riskGuards.leverage_margin_gate?.leverage_allowed === false && riskGuards.leverage_margin_gate?.margin_allowed === false && riskGuards.leverage_margin_gate?.result === "block" && riskGuards.leverage_margin_gate?.blocks_order_intent === true, "Leverage and margin are disabled and block order intent."),
    validationItem("risk_engine.guards.short_selling", "short_selling_disabled", riskGuards.short_selling_capability_gate?.short_selling_allowed === false && riskGuards.short_selling_capability_gate?.korea_short_check_required === true && riskGuards.short_selling_capability_gate?.result === "block" && riskGuards.short_selling_capability_gate?.blocks_order_intent === true, "Short-selling capability gate blocks order intent."),
    validationItem("risk_engine.guards.order_throttle", "order_frequency_throttle_blocks", riskGuards.order_frequency_throttle?.max_orders_per_day === 0 && riskGuards.order_frequency_throttle?.result === "block" && riskGuards.order_frequency_throttle?.blocks_order_intent === true, "Order frequency throttle blocks order generation."),
    validationItem("risk_engine.guards.cooldown", "loss_streak_cooldown_declared", riskGuards.loss_streak_cooldown?.cooldown_active === false && riskGuards.loss_streak_cooldown?.result === "pass", "Loss streak cooldown is declared."),
    validationItem("risk_engine.guards.model_degradation", "model_degradation_halt_bound", riskGuards.model_degradation_halt?.result === "pass" && riskGuards.model_degradation_halt?.halt_on_degradation === true && modelDegradationCheckIds.has(riskGuards.model_degradation_halt?.source_ref), "Model degradation halt references model-improvement checks."),
    validationItem("risk_engine.guards.data_outage", "data_outage_halt_declared", riskGuards.data_outage_halt?.data_outage_detected === false && riskGuards.data_outage_halt?.halt_on_outage === true && riskGuards.data_outage_halt?.result === "pass", "Data outage halt is declared."),
    validationItem("risk_engine.guards.results", "guard_results_allowed", guardResults.every((result) => REQUIRED_RESULT_VALUES.includes(result)), "Guard results use pass/warn/block/halt."),
    validationItem("risk_engine.artifacts.schema", "risk_artifacts_validate", riskArtifactResults.length >= 1 && riskArtifactResults.every((result) => result.validation.valid), "Risk artifacts validate against trading-risk.v1."),
    ...riskArtifactResults.flatMap((result) => result.validation_items),
    validationItem("risk_engine.artifacts.check_coverage", "risk_artifact_covers_required_checks", REQUIRED_RISK_CHECK_IDS.every((checkId) => primaryRiskCheckIds.has(checkId)), "Risk artifact covers P196-P214 checks."),
    validationItem("risk_engine.artifacts.boundary", "risk_artifact_blocks_live_and_requires_override_review", primaryRiskArtifact.result === "block" && primaryRiskArtifact.live_trade_allowed === false && primaryRiskArtifact.override_requires_human_approval === true && primaryRiskArtifact.kill_switch_status === "armed", "Primary risk artifact blocks live trade and requires human approval for override."),
    validationItem("risk_engine.result_policy", "risk_result_policy_declared", REQUIRED_RESULT_VALUES.every((value) => allowedResults.includes(value)) && riskEngine.risk_result_policy?.default_result === "block" && riskEngine.risk_result_policy?.block_prevents_order_intent === true && riskEngine.risk_result_policy?.halt_prevents_resume_without_human === true, "Risk result policy supports pass/warn/block/halt and blocks unsafe flow."),
    validationItem("risk_engine.override_policy", "override_requires_human_approval", riskEngine.override_policy?.override_allowed === true && riskEngine.override_policy?.requires_human_approval === true && riskEngine.override_policy?.protected_action_gate_required === true, "Risk override requires human approval and protected action gate."),
    validationItem("risk_engine.audit", "risk_audit_event_reviewable", riskEngine.risk_audit_event?.source_lineage_required === true && riskEngine.risk_audit_event?.replayable === true && riskEngine.risk_audit_event?.responsible_owner_required === true && riskEngine.risk_audit_event?.review_status === "pending_review", "Risk audit event is replayable and pending human review."),
    validationItem("risk_engine.freeze", "risk_freeze_locked", riskEngine.risk_freeze?.frozen === true && riskEngine.risk_freeze?.fixture_ref === "examples/trading/risk-engine.json" && riskEngine.risk_freeze?.regression_hash_locked === true, "Risk freeze is locked to the fixture."),
    validationItem("risk_engine.dashboard", "dashboard_read_only", riskEngine.dashboard_api_stub?.read_only === true && riskEngine.dashboard_api_stub?.mutating_routes_enabled === false && dashboardRoutes.length > 0 && dashboardRoutes.every((route) => route.method === "GET"), "Risk dashboard/API is read-only."),
    validationItem("risk_engine.dashboard.disabled", "unsafe_routes_disabled", disabledRoutes.some((route) => route.path === "/api/trading/risk/override") && disabledRoutes.some((route) => route.path === "/api/trading/signals/to-order-intent") && disabledRoutes.some((route) => route.path === "/api/trading/orders"), "Risk override, order-intent, and order routes are disabled."),
  ];
}

function buildFixtureResults(goldenFixtures, riskEngine, riskItems) {
  return (goldenFixtures.fixtures ?? []).map((fixture) => {
    const guardCount = Object.keys(riskEngine.risk_guards ?? {}).length;
    const limitGroupCount = countLimitGroups(riskEngine.risk_limits);
    const regressionHash = hashValue({
      fixture_id: fixture.fixture_id,
      phase_range: riskEngine.phase_range,
      phase_coverage: riskEngine.phase_coverage,
      safety_boundary: riskEngine.safety_boundary,
      risk_limits: riskEngine.risk_limits,
      risk_guards: riskEngine.risk_guards,
      risk_result_policy: riskEngine.risk_result_policy,
      override_policy: riskEngine.override_policy,
      risk_freeze: riskEngine.risk_freeze,
    });
    const primaryRiskArtifact = riskEngine.risk_check_artifacts?.[0] ?? {};
    const validationItems = [
      validationItem(`fixtures.${fixture.fixture_id}.status`, "fixture_status_matches", fixture.expected_status === "complete" && riskItems.every((item) => item.status === "passed"), `${fixture.fixture_id} expected status is complete.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_range`, "fixture_phase_range_matches", riskEngine.phase_range === fixture.expected_phase_range, `${fixture.fixture_id} phase range matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_count`, "fixture_phase_count_matches", (riskEngine.phase_coverage ?? []).length === fixture.expected_phase_count, `${fixture.fixture_id} phase count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.risk_artifact_count`, "fixture_risk_artifact_count_matches", (riskEngine.risk_check_artifacts ?? []).length === fixture.expected_risk_check_artifact_count, `${fixture.fixture_id} risk artifact count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.risk_result`, "fixture_risk_result_matches", primaryRiskArtifact.result === fixture.expected_risk_result, `${fixture.fixture_id} risk result matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.guard_count`, "fixture_guard_count_matches", guardCount === fixture.expected_guard_count, `${fixture.fixture_id} guard count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.limit_count`, "fixture_limit_group_count_matches", limitGroupCount === fixture.expected_limit_group_count, `${fixture.fixture_id} limit group count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.order_intent_count`, "fixture_order_intent_count_matches", (riskEngine.safety_boundary?.order_intent_generated === true ? 1 : 0) === fixture.expected_generated_order_intent_count, `${fixture.fixture_id} generated order intent count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.live_boundary`, "fixture_live_boundary_matches", riskEngine.safety_boundary?.live_execution_allowed === fixture.expected_live_execution_allowed, `${fixture.fixture_id} live execution boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.override`, "fixture_override_boundary_matches", riskEngine.override_policy?.requires_human_approval === fixture.expected_override_requires_human, `${fixture.fixture_id} override boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.freeze`, "fixture_freeze_boundary_matches", riskEngine.risk_freeze?.regression_hash_locked === fixture.expected_freeze_locked, `${fixture.fixture_id} freeze boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.dashboard`, "fixture_dashboard_boundary_matches", riskEngine.dashboard_api_stub?.read_only === fixture.expected_dashboard_read_only, `${fixture.fixture_id} dashboard boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.hash`, "fixture_regression_hash_locked", regressionHash.startsWith("sha256:"), `${fixture.fixture_id} regression hash is locked.`),
    ];
    const validation = summarizeValidation(validationItems);
    return {
      schema_version: "trading-risk-engine-fixture-result.v1",
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

function summarizeRiskCheck({ riskEngine, riskArtifactResults, fixtureResults, validationItems, validation }) {
  return {
    risk_check_status: validation.valid ? "complete" : "blocked",
    phase_range: riskEngine.phase_range,
    phase_count: riskEngine.phase_coverage?.length ?? 0,
    complete_phase_count: (riskEngine.phase_coverage ?? []).filter((phase) => phase.status === "complete").length,
    risk_check_artifact_count: riskEngine.risk_check_artifacts?.length ?? 0,
    risk_schema_valid_count: riskArtifactResults.filter((result) => result.validation.valid).length,
    primary_risk_result: riskEngine.risk_check_artifacts?.[0]?.result ?? null,
    guard_count: Object.keys(riskEngine.risk_guards ?? {}).length,
    limit_group_count: countLimitGroups(riskEngine.risk_limits),
    block_guard_count: Object.values(riskEngine.risk_guards ?? {}).filter((guard) => guard?.result === "block").length,
    fixture_count: fixtureResults.length,
    passed_fixture_count: fixtureResults.filter((fixture) => fixture.validation.valid).length,
    locked_regression_hash_count: fixtureResults.filter((fixture) => fixture.regression_hash?.startsWith("sha256:")).length,
    validation_item_count: validationItems.length,
    validation_error_count: validation.errors.length,
    pre_order_gate_only: riskEngine.safety_boundary?.pre_order_gate_only === true,
    order_intent_generated: riskEngine.safety_boundary?.order_intent_generated === true,
    live_execution_allowed: riskEngine.safety_boundary?.live_execution_allowed === true,
    override_requires_human_approval: riskEngine.override_policy?.requires_human_approval === true,
    risk_freeze_locked: riskEngine.risk_freeze?.regression_hash_locked === true,
    dashboard_read_only: riskEngine.dashboard_api_stub?.read_only === true,
  };
}

function renderRiskCheckMarkdown(result) {
  const lines = [];
  lines.push("# Trading Risk Check");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.risk_check_status}`);
  lines.push("");
  lines.push(`- Phase range: ${result.summary.phase_range}`);
  lines.push(`- Phases complete: ${result.summary.complete_phase_count}/${result.summary.phase_count}`);
  lines.push(`- Risk artifacts: ${result.summary.risk_check_artifact_count}`);
  lines.push(`- Primary risk result: ${result.summary.primary_risk_result}`);
  lines.push(`- Guards: ${result.summary.guard_count}`);
  lines.push(`- Block guards: ${result.summary.block_guard_count}`);
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
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_RISK_ENGINE_INPUTS.riskEnginePath),
    risk_engine_schema_path: path.resolve(options.riskEngineSchemaPath ?? DEFAULT_TRADING_RISK_ENGINE_INPUTS.riskEngineSchemaPath),
    risk_schema_path: path.resolve(options.riskSchemaPath ?? DEFAULT_TRADING_RISK_ENGINE_INPUTS.riskSchemaPath),
    feature_store_path: path.resolve(options.featureStorePath ?? DEFAULT_TRADING_RISK_ENGINE_INPUTS.featureStorePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_RISK_ENGINE_INPUTS.modelImprovementPath),
    backtest_validation_path: path.resolve(options.backtestValidationPath ?? DEFAULT_TRADING_RISK_ENGINE_INPUTS.backtestValidationPath),
    golden_fixtures_path: path.resolve(options.goldenFixturesPath ?? DEFAULT_TRADING_RISK_ENGINE_INPUTS.goldenFixturesPath),
    pack_manifest_path: path.resolve(options.packManifestPath ?? DEFAULT_TRADING_RISK_ENGINE_INPUTS.packManifestPath),
    capability_manifest_path: path.resolve(options.capabilityManifestPath ?? DEFAULT_TRADING_RISK_ENGINE_INPUTS.capabilityManifestPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_RISK_ENGINE_INPUTS.packagePath),
    phase_ledger_path: path.resolve(options.phaseLedgerPath ?? DEFAULT_TRADING_RISK_ENGINE_INPUTS.phaseLedgerPath),
  };
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_TRADING_RISK_CHECK_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--risk-engine") parsed.riskEnginePath = argv[++index];
    else if (arg === "--risk-engine-schema") parsed.riskEngineSchemaPath = argv[++index];
    else if (arg === "--risk-schema") parsed.riskSchemaPath = argv[++index];
    else if (arg === "--feature-store") parsed.featureStorePath = argv[++index];
    else if (arg === "--model-improvement") parsed.modelImprovementPath = argv[++index];
    else if (arg === "--backtest-validation") parsed.backtestValidationPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-risk-check.mjs [options]

Options:
  --out-dir <folder>              Output directory. Default: ${DEFAULT_TRADING_RISK_CHECK_OUT_DIR}
  --run-at <iso>                  Deterministic generated_at timestamp.
  --risk-engine <path>            Risk engine fixture path.
  --risk-engine-schema <path>     Risk engine schema path.
  --risk-schema <path>            trading-risk schema path.
  --feature-store <path>          Market data feature store fixture path.
  --model-improvement <path>      Model improvement fixture path.
  --backtest-validation <path>    Backtest validation fixture path.
  --golden-fixtures <path>        Risk engine golden fixtures path.
  --pack-manifest <path>          Trading pack manifest path.
  --capability-manifest <path>    Trading capability manifest path.
  --package <path>                package.json path.
  --phase-ledger <path>           Trading phase ledger path.
  --check                         Validate only, do not write artifacts.
  -h, --help                      Show this help.
`);
}

function countLimitGroups(riskLimits = {}) {
  const scalarLimitKeys = [
    "portfolio_exposure_limit",
    "single_name_concentration",
    "altcoin_max_allocation",
    "daily_loss_limit",
    "weekly_loss_limit",
    "max_drawdown_halt",
  ];
  return scalarLimitKeys.filter((key) => Boolean(riskLimits[key])).length + (Array.isArray(riskLimits.asset_class_exposure_limits) ? 1 : 0);
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
    validation_item_id: `trading-risk-engine.${slugify(itemPath)}.${checkId}`,
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
