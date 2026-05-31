import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS,
  buildTradingMarketOrderDisabledFixtures,
} from "./trading-market-order-disabled-fixtures.mjs";

export const DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_OUT_DIR = "artifacts/trading-leverage-disabled-fixtures/latest";
export const DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS,
  marketOrderDisabledFixturesSchemaPath: DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-leverage-disabled-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-leverage-disabled-fixtures.v1";
const CAPABILITY_ID = "trading.leverage_disabled_fixtures";
const PHASE_SLOT = "P395";
const PREVIOUS_PHASE_SLOT = "P394";
const NEXT_PHASE_SLOT = "P396";
const READY_STATUS = "ready_for_trading_leverage_disabled_regression";
const REQUIRED_FIXTURE_KEYS = [
  "research_leverage_policy_disabled",
  "asset_leverage_capability_disabled",
  "strategy_no_leverage_constraint_declared",
  "backtest_position_sizing_leverage_disabled",
  "risk_leverage_margin_gate_blocks",
];

export async function runTradingLeverageDisabledFixtures(options = {}) {
  const result = await buildTradingLeverageDisabledFixtures(options);
  if (options.write !== false) await writeTradingLeverageDisabledFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading leverage disabled fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingLeverageDisabledFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const marketOrderDisabledFixtures = await buildTradingMarketOrderDisabledFixtures({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    releaseCheckReceiptCloseoutSchemaPath: inputs.release_check_receipt_closeout_schema_path,
    safetyRegressionFixturesSchemaPath: inputs.safety_regression_fixtures_schema_path,
    routeInventoryFixturesSchemaPath: inputs.route_inventory_fixtures_schema_path,
    approvalAbsenceFixturesSchemaPath: inputs.approval_absence_fixtures_schema_path,
    liveAdapterDisabledFixturesSchemaPath: inputs.live_adapter_disabled_fixtures_schema_path,
    credentialLookupDisabledFixturesSchemaPath: inputs.credential_lookup_disabled_fixtures_schema_path,
    brokerWriteDisabledFixturesSchemaPath: inputs.broker_write_disabled_fixtures_schema_path,
    exchangeWriteDisabledFixturesSchemaPath: inputs.exchange_write_disabled_fixtures_schema_path,
    safetyBoundaryFixturesSchemaPath: inputs.safety_boundary_fixtures_schema_path,
    manualResumeDisabledFixturesSchemaPath: inputs.manual_resume_disabled_fixtures_schema_path,
    riskOverrideDisabledFixturesSchemaPath: inputs.risk_override_disabled_fixtures_schema_path,
    promotionDisabledFixturesSchemaPath: inputs.promotion_disabled_fixtures_schema_path,
    firstTradeDisabledFixturesSchemaPath: inputs.first_trade_disabled_fixtures_schema_path,
    orderIntentDisabledFixturesSchemaPath: inputs.order_intent_disabled_fixtures_schema_path,
    limitedLivePath: inputs.limited_live_path,
    fullAutoPath: inputs.full_auto_path,
    paperShadowPath: inputs.paper_shadow_path,
    executionEnginePath: inputs.execution_engine_path,
    modelImprovementPath: inputs.model_improvement_path,
    backtestValidationPath: inputs.backtest_validation_path,
    riskEnginePath: inputs.risk_engine_path,
    signalEnginePath: inputs.signal_engine_path,
    marketDataFeatureStorePath: inputs.market_data_feature_store_path,
    researchBacktestPaperPath: inputs.research_backtest_paper_path,
    routeSourcePaths: inputs.route_source_paths,
    schemaPath: inputs.market_order_disabled_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const researchBacktestPaper = await readJsonSource(inputs.research_backtest_paper_path);
  const backtestValidation = await readJsonSource(inputs.backtest_validation_path);
  const riskEngine = await readJsonSource(inputs.risk_engine_path);
  const leverageAnchor = buildLeverageAnchor({ marketOrderDisabledFixtures });
  const leverageEvidenceRows = buildLeverageEvidenceRows({
    researchBacktestPaper: researchBacktestPaper.data,
    backtestValidation: backtestValidation.data,
    riskEngine: riskEngine.data,
  });
  const leverageFixtureRows = buildLeverageFixtureRows(leverageEvidenceRows);
  const leverageBoundary = buildLeverageBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    marketOrderDisabledFixtures,
    evidenceRows: leverageEvidenceRows,
    fixtureRows: leverageFixtureRows,
  });
  const leverageGateRows = buildLeverageGateRows({
    marketOrderDisabledFixtures,
    packageJson,
    platformOpsLedger,
    researchBacktestPaper,
    backtestValidation,
    riskEngine,
    fixtureRows: leverageFixtureRows,
    boundary: leverageBoundary,
  });
  const validationItems = buildValidationItems({
    marketOrderDisabledFixtures,
    packageJson,
    platformOpsLedger,
    researchBacktestPaper,
    backtestValidation,
    riskEngine,
    evidenceRows: leverageEvidenceRows,
    fixtureRows: leverageFixtureRows,
    gateRows: leverageGateRows,
    boundary: leverageBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    marketOrderDisabledFixtures,
    evidenceRows: leverageEvidenceRows,
    fixtureRows: leverageFixtureRows,
    gateRows: leverageGateRows,
    boundary: leverageBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_leverage_disabled_fixtures_id: `trading-leverage-disabled-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    leverage_disabled_anchor: leverageAnchor,
    leverage_disabled_evidence_rows: leverageEvidenceRows,
    leverage_disabled_fixture_rows: leverageFixtureRows,
    leverage_disabled_gate_rows: leverageGateRows,
    leverage_disabled_boundary: leverageBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_leverage_disabled_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    marketOrderDisabledFixtures,
    evidenceRows: leverageEvidenceRows,
    fixtureRows: leverageFixtureRows,
    gateRows: leverageGateRows,
    boundary: leverageBoundary,
    validation: result.validation,
  });
  result.summary.trading_leverage_disabled_fixtures_id = result.trading_leverage_disabled_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingLeverageDisabledFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-leverage-disabled-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "leverage-disabled-evidence-rows.json"), collectionEnvelope("trading-leverage-disabled-evidence-rows.v1", "leverage_disabled_evidence_rows", result.leverage_disabled_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "leverage-disabled-fixture-rows.json"), collectionEnvelope("trading-leverage-disabled-fixture-rows.v1", "leverage_disabled_fixture_rows", result.leverage_disabled_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "leverage-disabled-gate-rows.json"), collectionEnvelope("trading-leverage-disabled-gate-rows.v1", "leverage_disabled_gate_rows", result.leverage_disabled_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "leverage-disabled-boundary.json"), result.leverage_disabled_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-leverage-disabled-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingLeverageDisabledFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingLeverageDisabledFixtures(args);
    console.log(`Trading leverage disabled fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_leverage_disabled_fixtures_status}`);
    console.log(`Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
    console.log(`Unsafe leverage signals: ${result.summary.unsafe_leverage_signal_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildLeverageAnchor({ marketOrderDisabledFixtures }) {
  return {
    schema_version: "trading-leverage-disabled-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_market_order_disabled_fixtures_id: marketOrderDisabledFixtures.trading_market_order_disabled_fixtures_id,
    source_market_order_disabled_status: marketOrderDisabledFixtures.summary.trading_market_order_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    required_fixture_keys: REQUIRED_FIXTURE_KEYS,
    source_hash: hashValue({
      id: marketOrderDisabledFixtures.trading_market_order_disabled_fixtures_id,
      status: marketOrderDisabledFixtures.summary.trading_market_order_disabled_fixtures_status,
      fixtures: REQUIRED_FIXTURE_KEYS,
    }),
  };
}

function buildLeverageEvidenceRows({ researchBacktestPaper, backtestValidation, riskEngine }) {
  const asset = valueAt(researchBacktestPaper, ["contract_examples", "trading-asset"]);
  const strategy = valueAt(researchBacktestPaper, ["contract_examples", "trading-strategy"]);
  const riskGate = valueAt(riskEngine, ["risk_guards", "leverage_margin_gate"]);
  const rows = [
    leverageEvidenceRow("research_leverage_policy_disabled", "research_backtest_paper", "safety_policy", [
      observedCondition("research.safety_policy.leverage_enabled", valueAt(researchBacktestPaper, ["safety_policy", "leverage_enabled"]), false),
      observedCondition("research.safety_policy.derivatives_enabled", valueAt(researchBacktestPaper, ["safety_policy", "derivatives_enabled"]), false),
      observedCondition("research.safety_policy.live_trading_enabled", valueAt(researchBacktestPaper, ["safety_policy", "live_trading_enabled"]), false),
      observedCondition("research.safety_policy.real_broker_adapters_enabled", valueAt(researchBacktestPaper, ["safety_policy", "real_broker_adapters_enabled"]), false),
    ]),
    leverageEvidenceRow("asset_leverage_capability_disabled", "research_backtest_paper", "contract_examples.trading-asset", [
      observedCondition("research.contract_examples.trading_asset.capability_flags.leverage_allowed", valueAt(asset, ["capability_flags", "leverage_allowed"]), false),
      observedCondition("research.contract_examples.trading_asset.capability_flags.derivatives_allowed", valueAt(asset, ["capability_flags", "derivatives_allowed"]), false),
      observedCondition("research.contract_examples.trading_asset.capability_flags.live_trading_allowed", valueAt(asset, ["capability_flags", "live_trading_allowed"]), false),
      observedCondition("research.contract_examples.trading_asset.tradability_status", valueAt(asset, ["tradability_status"]), "paper_allowed"),
    ]),
    leverageEvidenceRow("strategy_no_leverage_constraint_declared", "research_backtest_paper", "contract_examples.trading-strategy", [
      observedCondition("research.contract_examples.trading_strategy.no_leverage", hasArrayValue(valueAt(strategy, ["tradability_constraints"]), "no_leverage"), true),
      observedCondition("research.contract_examples.trading_strategy.live_eligible", valueAt(strategy, ["live_eligible"]), false),
      observedCondition("research.contract_examples.trading_strategy.allowed_stages.live_absent", !hasArrayValue(valueAt(strategy, ["allowed_stages"]), "live"), true),
      observedCondition("research.contract_examples.trading_strategy.allowed_stages.full_auto_absent", !hasArrayValue(valueAt(strategy, ["allowed_stages"]), "full_auto"), true),
    ]),
    leverageEvidenceRow("backtest_position_sizing_leverage_disabled", "backtest_validation", "position_sizing", [
      observedCondition("backtest.position_sizing.leverage_allowed", valueAt(backtestValidation, ["position_sizing", "leverage_allowed"]), false),
      observedCondition("backtest.position_sizing.max_position_pct_bounded", positionSizeBounded(valueAt(backtestValidation, ["position_sizing", "max_position_pct"])), true),
      observedCondition("backtest.safety_boundary.live_execution_allowed", valueAt(backtestValidation, ["safety_boundary", "live_execution_allowed"]), false),
      observedCondition("backtest.safety_boundary.order_intent_generated", valueAt(backtestValidation, ["safety_boundary", "order_intent_generated"]), false),
    ]),
    leverageEvidenceRow("risk_leverage_margin_gate_blocks", "risk_engine", "risk_guards.leverage_margin_gate", [
      observedCondition("risk.risk_guards.leverage_margin_gate.leverage_allowed", valueAt(riskGate, ["leverage_allowed"]), false),
      observedCondition("risk.risk_guards.leverage_margin_gate.margin_allowed", valueAt(riskGate, ["margin_allowed"]), false),
      observedCondition("risk.risk_guards.leverage_margin_gate.result", valueAt(riskGate, ["result"]), "block"),
      observedCondition("risk.risk_guards.leverage_margin_gate.blocks_order_intent", valueAt(riskGate, ["blocks_order_intent"]), true),
      observedCondition("risk.risk_check_artifacts[0].checks.leverage_margin_disabled.status", riskCheckStatus(riskEngine, "leverage_margin_disabled"), "block"),
    ]),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "leverage_disabled_evidence_hash"));
}

function leverageEvidenceRow(rowKey, artifactId, evidencePath, observedConditions) {
  const allConditionsPresent = observedConditions.every((condition) => condition.condition_present);
  const unsafeConditions = observedConditions.filter((condition) => condition.observed_value !== condition.expected_safe_value);
  return {
    schema_version: "trading-leverage-disabled-evidence-row.v1",
    leverage_disabled_evidence_row_id: `trading-leverage-disabled.evidence.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    artifact_id: artifactId,
    evidence_path: evidencePath,
    observed_conditions: observedConditions,
    observed_condition_count: observedConditions.length,
    all_conditions_present: allConditionsPresent,
    unsafe_leverage_signal_detected: unsafeConditions.length > 0,
    unsafe_condition_refs: unsafeConditions.map((condition) => condition.condition_path),
    evidence_status: allConditionsPresent && unsafeConditions.length === 0 ? "leverage_disabled" : "unsafe_or_incomplete",
    human_review_required: true,
  };
}

function observedCondition(conditionPath, observedValue, expectedSafeValue) {
  return {
    condition_path: conditionPath,
    expected_safe_value: expectedSafeValue,
    observed_value: observedValue,
    condition_present: typeof observedValue === "boolean" || typeof observedValue === "string" || typeof observedValue === "number",
    unsafe_when_not_safe: true,
  };
}

function buildLeverageFixtureRows(evidenceRows) {
  return REQUIRED_FIXTURE_KEYS.map((fixtureKey, index) => {
    const evidenceRow = evidenceRows.find((row) => row.row_key === fixtureKey);
    const row = {
      schema_version: "trading-leverage-disabled-fixture-row.v1",
      leverage_disabled_fixture_row_id: `trading-leverage-disabled-fixtures.row.${fixtureKey}`,
      phase_slot: PHASE_SLOT,
      row_key: fixtureKey,
      expected_leverage_allowed: false,
      expected_margin_allowed: false,
      unsafe_leverage_signal_detected: evidenceRow?.unsafe_leverage_signal_detected === true,
      evidence_status: evidenceRow?.evidence_status ?? "missing",
      fixture_should_fail_when_leverage_enabled: true,
      fixture_should_fail_when_margin_enabled: true,
      fixture_should_fail_when_order_submit_enabled: true,
      fixture_status: evidenceRow?.evidence_status === "leverage_disabled" ? "passed" : "failed",
      leverage_allowed_by_fixture: false,
      margin_allowed_by_fixture: false,
      order_submit_enabled_by_fixture: false,
      live_execution_allowed_by_fixture: false,
      command_execution_performed_by_fixture: false,
      artifact_write_performed_by_fixture: false,
      protected_action_executed_by_fixture: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "leverage_disabled_fixture_hash");
  });
}

function buildLeverageBoundary({ generatedAt, writeRequested, marketOrderDisabledFixtures, evidenceRows, fixtureRows }) {
  const unsafeRows = evidenceRows.filter((row) => row.unsafe_leverage_signal_detected);
  const sourceBoundary = marketOrderDisabledFixtures.summary;
  return {
    schema_version: "trading-leverage-disabled-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    leverage_disabled_artifact_write_requested: writeRequested,
    leverage_disabled_fixture_execution_performed: false,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    leverage_evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    unsafe_leverage_signal_count: unsafeRows.length,
    unsafe_leverage_signal_refs: unsafeRows.map((row) => row.row_key),
    leverage_disabled_covered: evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "leverage_disabled"),
    source_market_order_disabled_status: sourceBoundary.trading_market_order_disabled_fixtures_status,
    source_market_order_disabled_ready: marketOrderDisabledFixtures.validation.valid && sourceBoundary.trading_market_order_disabled_fixtures_status === "ready_for_trading_market_order_disabled_regression",
    leverage_enabled: observedUnsafeCondition(evidenceRows, "research.safety_policy.leverage_enabled"),
    derivatives_enabled: observedUnsafeCondition(evidenceRows, "research.safety_policy.derivatives_enabled"),
    research_live_trading_enabled: observedUnsafeCondition(evidenceRows, "research.safety_policy.live_trading_enabled"),
    research_real_broker_adapters_enabled: observedUnsafeCondition(evidenceRows, "research.safety_policy.real_broker_adapters_enabled"),
    asset_leverage_allowed: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_asset.capability_flags.leverage_allowed"),
    asset_derivatives_allowed: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_asset.capability_flags.derivatives_allowed"),
    asset_live_trading_allowed: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_asset.capability_flags.live_trading_allowed"),
    asset_not_paper_allowed: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_asset.tradability_status"),
    strategy_no_leverage_missing: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_strategy.no_leverage"),
    strategy_live_eligible: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_strategy.live_eligible"),
    strategy_live_stage_allowed: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_strategy.allowed_stages.live_absent") || observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_strategy.allowed_stages.full_auto_absent"),
    backtest_leverage_allowed: observedUnsafeCondition(evidenceRows, "backtest.position_sizing.leverage_allowed"),
    backtest_position_size_unbounded: observedUnsafeCondition(evidenceRows, "backtest.position_sizing.max_position_pct_bounded"),
    backtest_live_execution_allowed: observedUnsafeCondition(evidenceRows, "backtest.safety_boundary.live_execution_allowed"),
    backtest_order_intent_generated: observedUnsafeCondition(evidenceRows, "backtest.safety_boundary.order_intent_generated"),
    risk_leverage_allowed: observedUnsafeCondition(evidenceRows, "risk.risk_guards.leverage_margin_gate.leverage_allowed"),
    risk_margin_allowed: observedUnsafeCondition(evidenceRows, "risk.risk_guards.leverage_margin_gate.margin_allowed"),
    leverage_margin_gate_not_blocking: observedUnsafeCondition(evidenceRows, "risk.risk_guards.leverage_margin_gate.result"),
    leverage_margin_not_blocking_order_intent: observedUnsafeCondition(evidenceRows, "risk.risk_guards.leverage_margin_gate.blocks_order_intent"),
    leverage_risk_check_not_blocking: observedUnsafeCondition(evidenceRows, "risk.risk_check_artifacts[0].checks.leverage_margin_disabled.status"),
    market_order_allowed: sourceBoundary.market_order_allowed,
    market_orders_enabled: sourceBoundary.market_orders_enabled,
    order_submit_route_enabled: sourceBoundary.order_submit_route_enabled,
    order_intent_generated: sourceBoundary.order_intent_generated || observedUnsafeCondition(evidenceRows, "backtest.safety_boundary.order_intent_generated"),
    order_intent_route_enabled: sourceBoundary.order_intent_route_enabled,
    order_submit_route_enabled_source: sourceBoundary.order_submit_route_enabled,
    real_order_submitted: sourceBoundary.real_order_submitted,
    live_execution_allowed: sourceBoundary.live_execution_allowed || observedUnsafeCondition(evidenceRows, "backtest.safety_boundary.live_execution_allowed"),
    limited_live_enabled: sourceBoundary.limited_live_enabled,
    full_auto_enabled: sourceBoundary.full_auto_enabled,
    automatic_order_submission_allowed: sourceBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: sourceBoundary.live_order_submission_allowed,
    live_order_route_enabled: sourceBoundary.live_order_route_enabled,
    trading_live_enabled: sourceBoundary.trading_live_enabled,
    trading_order_submission_allowed: sourceBoundary.trading_order_submission_allowed,
    live_adapter_enabled: sourceBoundary.live_adapter_enabled,
    credential_lookup_enabled: sourceBoundary.credential_lookup_enabled,
    broker_write_allowed: sourceBoundary.broker_write_allowed,
    exchange_write_allowed: sourceBoundary.exchange_write_allowed,
    command_execution_performed: false,
    package_command_execution_performed: false,
    release_check_execution_performed: false,
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    human_review_required: true,
  };
}

function observedUnsafeCondition(evidenceRows, conditionPath) {
  return evidenceRows
    .flatMap((row) => row.observed_conditions)
    .some((condition) => condition.condition_path === conditionPath && condition.observed_value !== condition.expected_safe_value);
}

function buildLeverageGateRows({ marketOrderDisabledFixtures, packageJson, platformOpsLedger, researchBacktestPaper, backtestValidation, riskEngine, fixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p394_market_order_disabled_fixtures_ready", "P394 market order disabled fixtures source is ready.", marketOrderDisabledFixtures.validation.valid && marketOrderDisabledFixtures.summary.trading_market_order_disabled_fixtures_status === "ready_for_trading_market_order_disabled_regression"),
    gateRow("platform_package_script_registered", "package.json registers the P395 trading leverage disabled fixtures command.", typeof scripts["trading:leverage-disabled-fixtures"] === "string" && scripts["trading:leverage-disabled-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P395 trading leverage disabled fixtures command.", validateScript.includes("npm run trading:leverage-disabled-fixtures -- --check")),
    gateRow("p395_ledger_acceptance_declared", "P395 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P395: `trading:leverage-disabled-fixtures`")),
    gateRow("leverage_sources_readable", "All leverage source artifacts are readable.", researchBacktestPaper.available && backtestValidation.available && riskEngine.available),
    gateRow("required_leverage_fixtures_declared", "All required leverage disabled fixtures are declared.", REQUIRED_FIXTURE_KEYS.every((fixtureKey) => fixtureRows.some((row) => row.row_key === fixtureKey)) && fixtureRows.length === REQUIRED_FIXTURE_KEYS.length),
    gateRow("research_leverage_policy_disabled", "Research policy disables leverage, derivatives, live trading, and real broker adapters.", !boundary.leverage_enabled && !boundary.derivatives_enabled && !boundary.research_live_trading_enabled && !boundary.research_real_broker_adapters_enabled),
    gateRow("asset_strategy_leverage_disabled", "Asset capability and strategy constraints keep leverage blocked.", !boundary.asset_leverage_allowed && !boundary.asset_derivatives_allowed && !boundary.asset_live_trading_allowed && !boundary.asset_not_paper_allowed && !boundary.strategy_no_leverage_missing && !boundary.strategy_live_eligible && !boundary.strategy_live_stage_allowed),
    gateRow("backtest_leverage_disabled", "Backtest position sizing stays bounded and leverage-free.", !boundary.backtest_leverage_allowed && !boundary.backtest_position_size_unbounded && !boundary.backtest_live_execution_allowed && !boundary.backtest_order_intent_generated),
    gateRow("risk_leverage_margin_blocks", "Risk leverage/margin gate blocks leverage, margin, and order-intent generation.", !boundary.risk_leverage_allowed && !boundary.risk_margin_allowed && !boundary.leverage_margin_gate_not_blocking && !boundary.leverage_margin_not_blocking_order_intent && !boundary.leverage_risk_check_not_blocking),
    gateRow("no_trading_or_artifact_mutation", "Leverage disabled fixtures do not execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "leverage_disabled_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-leverage-disabled-gate-row.v1",
    leverage_disabled_gate_row_id: `trading-leverage-disabled-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    leverage_allowed_by_gate: false,
    margin_allowed_by_gate: false,
    order_submit_enabled_by_gate: false,
    live_execution_allowed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ marketOrderDisabledFixtures, packageJson, platformOpsLedger, researchBacktestPaper, backtestValidation, riskEngine, evidenceRows, fixtureRows, gateRows, boundary }) {
  return [
    validationItem("source.market_order_disabled_fixtures", "p394_market_order_disabled_fixtures_ready", marketOrderDisabledFixtures.validation.valid && marketOrderDisabledFixtures.summary.trading_market_order_disabled_fixtures_status === "ready_for_trading_market_order_disabled_regression", "P394 market order disabled fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P395 leverage disabled fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.leverage_sources", "leverage_sources_available", researchBacktestPaper.available && backtestValidation.available && riskEngine.available, "Leverage source artifacts are readable."),
    validationItem("leverage_disabled_evidence_rows", "leverage_evidence_ready", evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "leverage_disabled"), "Leverage evidence rows must show disabled state."),
    validationItem("leverage_disabled_fixture_rows", "required_leverage_fixtures_pass", fixtureRows.length === REQUIRED_FIXTURE_KEYS.length && fixtureRows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_leverage_enabled && row.fixture_should_fail_when_margin_enabled), "All leverage disabled fixtures must pass."),
    validationItem("leverage_disabled_gate_rows", "leverage_disabled_gates_ready", gateRows.length >= 11 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P395 leverage disabled gates are ready."),
    validationItem("boundary.research_leverage", "research_leverage_policy_disabled", boundary.leverage_disabled_covered && !boundary.leverage_enabled && !boundary.derivatives_enabled && !boundary.research_live_trading_enabled && !boundary.research_real_broker_adapters_enabled, "Research policy disables leverage and related live capabilities."),
    validationItem("boundary.asset_strategy_leverage", "asset_strategy_leverage_disabled", !boundary.asset_leverage_allowed && !boundary.asset_derivatives_allowed && !boundary.asset_live_trading_allowed && !boundary.asset_not_paper_allowed && !boundary.strategy_no_leverage_missing && !boundary.strategy_live_eligible && !boundary.strategy_live_stage_allowed, "Asset and strategy leverage paths remain disabled."),
    validationItem("boundary.backtest_leverage", "backtest_leverage_disabled", !boundary.backtest_leverage_allowed && !boundary.backtest_position_size_unbounded && !boundary.backtest_live_execution_allowed && !boundary.backtest_order_intent_generated, "Backtest leverage remains disabled and bounded."),
    validationItem("boundary.risk_leverage_margin", "risk_leverage_margin_blocks", !boundary.risk_leverage_allowed && !boundary.risk_margin_allowed && !boundary.leverage_margin_gate_not_blocking && !boundary.leverage_margin_not_blocking_order_intent && !boundary.leverage_risk_check_not_blocking, "Risk leverage/margin gate blocks leverage, margin, and order intent."),
    validationItem("boundary.no_mutation", "no_trading_or_artifact_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed, "P395 leverage disabled fixtures perform no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ marketOrderDisabledFixtures, evidenceRows, fixtureRows, gateRows, boundary, validation }) {
  return {
    trading_leverage_disabled_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_market_order_disabled_status: marketOrderDisabledFixtures.summary.trading_market_order_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    passed_fixture_count: fixtureRows.filter((row) => row.fixture_status === "passed").length,
    failed_fixture_count: fixtureRows.filter((row) => row.fixture_status !== "passed").length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    unsafe_leverage_signal_count: boundary.unsafe_leverage_signal_count,
    leverage_disabled_covered: boundary.leverage_disabled_covered,
    leverage_enabled: boundary.leverage_enabled,
    derivatives_enabled: boundary.derivatives_enabled,
    research_live_trading_enabled: boundary.research_live_trading_enabled,
    research_real_broker_adapters_enabled: boundary.research_real_broker_adapters_enabled,
    asset_leverage_allowed: boundary.asset_leverage_allowed,
    asset_derivatives_allowed: boundary.asset_derivatives_allowed,
    asset_live_trading_allowed: boundary.asset_live_trading_allowed,
    asset_not_paper_allowed: boundary.asset_not_paper_allowed,
    strategy_no_leverage_missing: boundary.strategy_no_leverage_missing,
    strategy_live_eligible: boundary.strategy_live_eligible,
    strategy_live_stage_allowed: boundary.strategy_live_stage_allowed,
    backtest_leverage_allowed: boundary.backtest_leverage_allowed,
    backtest_position_size_unbounded: boundary.backtest_position_size_unbounded,
    backtest_live_execution_allowed: boundary.backtest_live_execution_allowed,
    backtest_order_intent_generated: boundary.backtest_order_intent_generated,
    risk_leverage_allowed: boundary.risk_leverage_allowed,
    risk_margin_allowed: boundary.risk_margin_allowed,
    leverage_margin_gate_not_blocking: boundary.leverage_margin_gate_not_blocking,
    leverage_margin_not_blocking_order_intent: boundary.leverage_margin_not_blocking_order_intent,
    leverage_risk_check_not_blocking: boundary.leverage_risk_check_not_blocking,
    market_orders_enabled: boundary.market_orders_enabled,
    order_submit_route_enabled: boundary.order_submit_route_enabled,
    order_submit_route_enabled_source: boundary.order_submit_route_enabled_source,
    market_order_allowed: boundary.market_order_allowed,
    order_intent_generated: boundary.order_intent_generated,
    order_intent_route_enabled: boundary.order_intent_route_enabled,
    real_order_submitted: boundary.real_order_submitted,
    live_execution_allowed: boundary.live_execution_allowed,
    limited_live_enabled: boundary.limited_live_enabled,
    full_auto_enabled: boundary.full_auto_enabled,
    automatic_order_submission_allowed: boundary.automatic_order_submission_allowed,
    live_order_submission_allowed: boundary.live_order_submission_allowed,
    live_order_route_enabled: boundary.live_order_route_enabled,
    trading_live_enabled: boundary.trading_live_enabled,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    live_adapter_enabled: boundary.live_adapter_enabled,
    credential_lookup_enabled: boundary.credential_lookup_enabled,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
    release_check_execution_performed: boundary.release_check_execution_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    release_published: boundary.release_published,
    git_operation_performed: boundary.git_operation_performed,
    protected_action_executed: boundary.protected_action_executed,
    human_review_required: boundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Leverage Disabled Fixtures",
    "",
    `Status: ${result.summary.trading_leverage_disabled_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source market order disabled: ${result.summary.source_market_order_disabled_status}`,
    `Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`,
    `Unsafe leverage signals: ${result.summary.unsafe_leverage_signal_count}`,
    "",
    "## Fixtures",
    "",
    ...result.leverage_disabled_fixture_rows.map((row) => `- ${row.row_key}: ${row.fixture_status}`),
    "",
    "## Gates",
    "",
    ...result.leverage_disabled_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_OUT_DIR, routeSourcePaths: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--limited-live") parsed.limitedLivePath = argv[++index];
    else if (arg === "--full-auto") parsed.fullAutoPath = argv[++index];
    else if (arg === "--paper-shadow") parsed.paperShadowPath = argv[++index];
    else if (arg === "--execution-engine") parsed.executionEnginePath = argv[++index];
    else if (arg === "--model-improvement") parsed.modelImprovementPath = argv[++index];
    else if (arg === "--backtest-validation") parsed.backtestValidationPath = argv[++index];
    else if (arg === "--risk-engine") parsed.riskEnginePath = argv[++index];
    else if (arg === "--signal-engine") parsed.signalEnginePath = argv[++index];
    else if (arg === "--market-data-feature-store") parsed.marketDataFeatureStorePath = argv[++index];
    else if (arg === "--research-backtest-paper") parsed.researchBacktestPaperPath = argv[++index];
    else if (arg === "--route-source") parsed.routeSourcePaths.push(argv[++index]);
    else if (arg === "--release-check-receipt-closeout-schema") parsed.releaseCheckReceiptCloseoutSchemaPath = argv[++index];
    else if (arg === "--safety-regression-fixtures-schema") parsed.safetyRegressionFixturesSchemaPath = argv[++index];
    else if (arg === "--route-inventory-fixtures-schema") parsed.routeInventoryFixturesSchemaPath = argv[++index];
    else if (arg === "--approval-absence-fixtures-schema") parsed.approvalAbsenceFixturesSchemaPath = argv[++index];
    else if (arg === "--live-adapter-disabled-fixtures-schema") parsed.liveAdapterDisabledFixturesSchemaPath = argv[++index];
    else if (arg === "--credential-lookup-disabled-fixtures-schema") parsed.credentialLookupDisabledFixturesSchemaPath = argv[++index];
    else if (arg === "--broker-write-disabled-fixtures-schema") parsed.brokerWriteDisabledFixturesSchemaPath = argv[++index];
    else if (arg === "--exchange-write-disabled-fixtures-schema") parsed.exchangeWriteDisabledFixturesSchemaPath = argv[++index];
    else if (arg === "--safety-boundary-fixtures-schema") parsed.safetyBoundaryFixturesSchemaPath = argv[++index];
    else if (arg === "--manual-resume-disabled-fixtures-schema") parsed.manualResumeDisabledFixturesSchemaPath = argv[++index];
    else if (arg === "--risk-override-disabled-fixtures-schema") parsed.riskOverrideDisabledFixturesSchemaPath = argv[++index];
    else if (arg === "--promotion-disabled-fixtures-schema") parsed.promotionDisabledFixturesSchemaPath = argv[++index];
    else if (arg === "--first-trade-disabled-fixtures-schema") parsed.firstTradeDisabledFixturesSchemaPath = argv[++index];
    else if (arg === "--order-intent-disabled-fixtures-schema") parsed.orderIntentDisabledFixturesSchemaPath = argv[++index];
    else if (arg === "--market-order-disabled-fixtures-schema") parsed.marketOrderDisabledFixturesSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (parsed.routeSourcePaths.length === 0) delete parsed.routeSourcePaths;
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-leverage-disabled-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_OUT_DIR}
  --run-at <iso>                           Deterministic generated_at timestamp.
  --package <path>                         package.json path.
  --platform-ops-ledger <path>             P341-P500 platform operations ledger path.
  --limited-live <path>                    Limited-live governance artifact path.
  --full-auto <path>                       Full-auto governance artifact path.
  --paper-shadow <path>                    Paper/shadow governance artifact path.
  --execution-engine <path>                Execution engine artifact path.
  --model-improvement <path>               Model improvement artifact path.
  --backtest-validation <path>             Backtest validation artifact path.
  --risk-engine <path>                     Risk engine artifact path.
  --signal-engine <path>                   Signal engine artifact path.
  --market-data-feature-store <path>       Market data/feature store artifact path.
  --research-backtest-paper <path>         Research/backtest/paper sample artifact path.
  --route-source <path>                    Trading route source JSON for P382 source. Repeat to override defaults.
  --release-check-receipt-closeout-schema <path>
                                           P380 receipt closeout schema path.
  --safety-regression-fixtures-schema <path>
                                           P381 safety regression fixtures schema path.
  --route-inventory-fixtures-schema <path> P382 route inventory fixtures schema path.
  --approval-absence-fixtures-schema <path>
                                           P383 approval absence fixtures schema path.
  --live-adapter-disabled-fixtures-schema <path>
                                           P384 live adapter disabled fixtures schema path.
  --credential-lookup-disabled-fixtures-schema <path>
                                           P385 credential lookup disabled fixtures schema path.
  --broker-write-disabled-fixtures-schema <path>
                                           P386 broker write disabled fixtures schema path.
  --exchange-write-disabled-fixtures-schema <path>
                                           P387 exchange write disabled fixtures schema path.
  --safety-boundary-fixtures-schema <path>
                                           P388 safety boundary fixtures schema path.
  --manual-resume-disabled-fixtures-schema <path>
                                           P389 manual resume disabled fixtures schema path.
  --risk-override-disabled-fixtures-schema <path>
                                           P390 risk override disabled fixtures schema path.
  --promotion-disabled-fixtures-schema <path>
                                           P391 promotion disabled fixtures schema path.
  --first-trade-disabled-fixtures-schema <path>
                                           P392 first trade disabled fixtures schema path.
  --order-intent-disabled-fixtures-schema <path>
                                           P393 order intent disabled fixtures schema path.
  --market-order-disabled-fixtures-schema <path>
                                           P394 market order disabled fixtures schema path.
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  const routeSourcePaths = options.routeSourcePaths ?? options.routeSources ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.routeSourcePaths;
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.platformOpsLedgerPath),
    release_check_receipt_closeout_schema_path: path.resolve(options.releaseCheckReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.releaseCheckReceiptCloseoutSchemaPath),
    safety_regression_fixtures_schema_path: path.resolve(options.safetyRegressionFixturesSchemaPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.safetyRegressionFixturesSchemaPath),
    route_inventory_fixtures_schema_path: path.resolve(options.routeInventoryFixturesSchemaPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.routeInventoryFixturesSchemaPath),
    approval_absence_fixtures_schema_path: path.resolve(options.approvalAbsenceFixturesSchemaPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.approvalAbsenceFixturesSchemaPath),
    live_adapter_disabled_fixtures_schema_path: path.resolve(options.liveAdapterDisabledFixturesSchemaPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.liveAdapterDisabledFixturesSchemaPath),
    credential_lookup_disabled_fixtures_schema_path: path.resolve(options.credentialLookupDisabledFixturesSchemaPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.credentialLookupDisabledFixturesSchemaPath),
    broker_write_disabled_fixtures_schema_path: path.resolve(options.brokerWriteDisabledFixturesSchemaPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.brokerWriteDisabledFixturesSchemaPath),
    exchange_write_disabled_fixtures_schema_path: path.resolve(options.exchangeWriteDisabledFixturesSchemaPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.exchangeWriteDisabledFixturesSchemaPath),
    safety_boundary_fixtures_schema_path: path.resolve(options.safetyBoundaryFixturesSchemaPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.safetyBoundaryFixturesSchemaPath),
    manual_resume_disabled_fixtures_schema_path: path.resolve(options.manualResumeDisabledFixturesSchemaPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.manualResumeDisabledFixturesSchemaPath),
    risk_override_disabled_fixtures_schema_path: path.resolve(options.riskOverrideDisabledFixturesSchemaPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.riskOverrideDisabledFixturesSchemaPath),
    promotion_disabled_fixtures_schema_path: path.resolve(options.promotionDisabledFixturesSchemaPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.promotionDisabledFixturesSchemaPath),
    first_trade_disabled_fixtures_schema_path: path.resolve(options.firstTradeDisabledFixturesSchemaPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.firstTradeDisabledFixturesSchemaPath),
    order_intent_disabled_fixtures_schema_path: path.resolve(options.orderIntentDisabledFixturesSchemaPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.orderIntentDisabledFixturesSchemaPath),
    market_order_disabled_fixtures_schema_path: path.resolve(options.marketOrderDisabledFixturesSchemaPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.marketOrderDisabledFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.executionEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.modelImprovementPath),
    backtest_validation_path: path.resolve(options.backtestValidationPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.backtestValidationPath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.riskEnginePath),
    signal_engine_path: path.resolve(options.signalEnginePath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.signalEnginePath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.marketDataFeatureStorePath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.researchBacktestPaperPath),
    route_source_paths: routeSourcePaths.map((sourcePath) => path.resolve(sourcePath)),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.schemaPath),
  };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    count: rows.length,
    [key]: rows,
  };
}

async function readJsonSource(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return { path: filePath, available: true, data: JSON.parse(raw), content_hash: sha256(raw) };
  } catch (error) {
    return { path: filePath, available: false, data: null, content_hash: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, text, content_hash: sha256(text) };
  } catch (error) {
    return { path: filePath, available: false, text: "", content_hash: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function valueAt(source, keys) {
  return keys.reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), source);
}

function hasDisabledRoute(routes, routePath) {
  return Array.isArray(routes) && routes.some((route) => route?.path === routePath);
}

function hasArrayValue(values, target) {
  return Array.isArray(values) && values.includes(target);
}

function positionSizeBounded(value) {
  return typeof value === "number" && value > 0 && value <= 1;
}

function riskCheckStatus(riskEngine, checkId) {
  const checks = valueAt(riskEngine, ["risk_check_artifacts", 0, "checks"]);
  if (!Array.isArray(checks)) return undefined;
  return checks.find((check) => check?.check_id === checkId)?.status;
}

function limitCancelOnly(allowedOrderTypes) {
  return Array.isArray(allowedOrderTypes) && allowedOrderTypes.length === 2 && allowedOrderTypes.includes("limit") && allowedOrderTypes.includes("cancel");
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `trading-leverage-disabled-fixtures.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return { valid: errors.length === 0, errors };
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function withOrdinalAndHash(row, index, hashKey) {
  const rowWithOrdinal = { ...row, ordinal: index + 1 };
  return { ...rowWithOrdinal, [hashKey]: hashValue(rowWithOrdinal) };
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
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
