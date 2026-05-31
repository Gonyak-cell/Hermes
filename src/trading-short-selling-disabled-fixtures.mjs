import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS,
  buildTradingLeverageDisabledFixtures,
} from "./trading-leverage-disabled-fixtures.mjs";

export const DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_OUT_DIR = "artifacts/trading-short-selling-disabled-fixtures/latest";
export const DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS,
  leverageDisabledFixturesSchemaPath: DEFAULT_TRADING_LEVERAGE_DISABLED_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-short-selling-disabled-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-short-selling-disabled-fixtures.v1";
const CAPABILITY_ID = "trading.short_selling_disabled_fixtures";
const PHASE_SLOT = "P396";
const PREVIOUS_PHASE_SLOT = "P395";
const NEXT_PHASE_SLOT = "P397";
const READY_STATUS = "ready_for_trading_short_selling_disabled_regression";
const REQUIRED_FIXTURE_KEYS = [
  "research_short_selling_policy_disabled",
  "asset_short_selling_capability_disabled",
  "strategy_no_short_constraint_declared",
  "paper_short_order_absent",
  "risk_short_selling_capability_gate_blocks",
];

export async function runTradingShortSellingDisabledFixtures(options = {}) {
  const result = await buildTradingShortSellingDisabledFixtures(options);
  if (options.write !== false) await writeTradingShortSellingDisabledFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading short selling disabled fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingShortSellingDisabledFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const leverageDisabledFixtures = await buildTradingLeverageDisabledFixtures({
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
    marketOrderDisabledFixturesSchemaPath: inputs.market_order_disabled_fixtures_schema_path,
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
    schemaPath: inputs.leverage_disabled_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const researchBacktestPaper = await readJsonSource(inputs.research_backtest_paper_path);
  const riskEngine = await readJsonSource(inputs.risk_engine_path);
  const shortSellingAnchor = buildShortSellingAnchor({ leverageDisabledFixtures });
  const shortSellingEvidenceRows = buildShortSellingEvidenceRows({
    researchBacktestPaper: researchBacktestPaper.data,
    riskEngine: riskEngine.data,
  });
  const shortSellingFixtureRows = buildShortSellingFixtureRows(shortSellingEvidenceRows);
  const shortSellingBoundary = buildShortSellingBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    leverageDisabledFixtures,
    evidenceRows: shortSellingEvidenceRows,
    fixtureRows: shortSellingFixtureRows,
  });
  const shortSellingGateRows = buildShortSellingGateRows({
    leverageDisabledFixtures,
    packageJson,
    platformOpsLedger,
    researchBacktestPaper,
    riskEngine,
    fixtureRows: shortSellingFixtureRows,
    boundary: shortSellingBoundary,
  });
  const validationItems = buildValidationItems({
    leverageDisabledFixtures,
    packageJson,
    platformOpsLedger,
    researchBacktestPaper,
    riskEngine,
    evidenceRows: shortSellingEvidenceRows,
    fixtureRows: shortSellingFixtureRows,
    gateRows: shortSellingGateRows,
    boundary: shortSellingBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    leverageDisabledFixtures,
    evidenceRows: shortSellingEvidenceRows,
    fixtureRows: shortSellingFixtureRows,
    gateRows: shortSellingGateRows,
    boundary: shortSellingBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_short_selling_disabled_fixtures_id: `trading-short-selling-disabled-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    short_selling_disabled_anchor: shortSellingAnchor,
    short_selling_disabled_evidence_rows: shortSellingEvidenceRows,
    short_selling_disabled_fixture_rows: shortSellingFixtureRows,
    short_selling_disabled_gate_rows: shortSellingGateRows,
    short_selling_disabled_boundary: shortSellingBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_short_selling_disabled_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    leverageDisabledFixtures,
    evidenceRows: shortSellingEvidenceRows,
    fixtureRows: shortSellingFixtureRows,
    gateRows: shortSellingGateRows,
    boundary: shortSellingBoundary,
    validation: result.validation,
  });
  result.summary.trading_short_selling_disabled_fixtures_id = result.trading_short_selling_disabled_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingShortSellingDisabledFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-short-selling-disabled-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "short-selling-disabled-evidence-rows.json"), collectionEnvelope("trading-short-selling-disabled-evidence-rows.v1", "short_selling_disabled_evidence_rows", result.short_selling_disabled_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "short-selling-disabled-fixture-rows.json"), collectionEnvelope("trading-short-selling-disabled-fixture-rows.v1", "short_selling_disabled_fixture_rows", result.short_selling_disabled_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "short-selling-disabled-gate-rows.json"), collectionEnvelope("trading-short-selling-disabled-gate-rows.v1", "short_selling_disabled_gate_rows", result.short_selling_disabled_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "short-selling-disabled-boundary.json"), result.short_selling_disabled_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-short-selling-disabled-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingShortSellingDisabledFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingShortSellingDisabledFixtures(args);
    console.log(`Trading short selling disabled fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_short_selling_disabled_fixtures_status}`);
    console.log(`Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
    console.log(`Unsafe short selling signals: ${result.summary.unsafe_short_selling_signal_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildShortSellingAnchor({ leverageDisabledFixtures }) {
  return {
    schema_version: "trading-short-selling-disabled-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_leverage_disabled_fixtures_id: leverageDisabledFixtures.trading_leverage_disabled_fixtures_id,
    source_leverage_disabled_status: leverageDisabledFixtures.summary.trading_leverage_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    required_fixture_keys: REQUIRED_FIXTURE_KEYS,
    source_hash: hashValue({
      id: leverageDisabledFixtures.trading_leverage_disabled_fixtures_id,
      status: leverageDisabledFixtures.summary.trading_leverage_disabled_fixtures_status,
      fixtures: REQUIRED_FIXTURE_KEYS,
    }),
  };
}

function buildShortSellingEvidenceRows({ researchBacktestPaper, riskEngine }) {
  const asset = valueAt(researchBacktestPaper, ["contract_examples", "trading-asset"]);
  const strategy = valueAt(researchBacktestPaper, ["contract_examples", "trading-strategy"]);
  const paperTrade = valueAt(researchBacktestPaper, ["contract_examples", "trading-paper-trade"]);
  const riskGate = valueAt(riskEngine, ["risk_guards", "short_selling_capability_gate"]);
  const rows = [
    shortSellingEvidenceRow("research_short_selling_policy_disabled", "research_backtest_paper", "safety_policy", [
      observedCondition("research.safety_policy.short_selling_enabled", valueAt(researchBacktestPaper, ["safety_policy", "short_selling_enabled"]), false),
      observedCondition("research.safety_policy.derivatives_enabled", valueAt(researchBacktestPaper, ["safety_policy", "derivatives_enabled"]), false),
      observedCondition("research.safety_policy.live_trading_enabled", valueAt(researchBacktestPaper, ["safety_policy", "live_trading_enabled"]), false),
      observedCondition("research.safety_policy.real_broker_adapters_enabled", valueAt(researchBacktestPaper, ["safety_policy", "real_broker_adapters_enabled"]), false),
    ]),
    shortSellingEvidenceRow("asset_short_selling_capability_disabled", "research_backtest_paper", "contract_examples.trading-asset", [
      observedCondition("research.contract_examples.trading_asset.capability_flags.short_allowed", valueAt(asset, ["capability_flags", "short_allowed"]), false),
      observedCondition("research.contract_examples.trading_asset.capability_flags.derivatives_allowed", valueAt(asset, ["capability_flags", "derivatives_allowed"]), false),
      observedCondition("research.contract_examples.trading_asset.capability_flags.live_trading_allowed", valueAt(asset, ["capability_flags", "live_trading_allowed"]), false),
      observedCondition("research.contract_examples.trading_asset.tradability_status", valueAt(asset, ["tradability_status"]), "paper_allowed"),
    ]),
    shortSellingEvidenceRow("strategy_no_short_constraint_declared", "research_backtest_paper", "contract_examples.trading-strategy", [
      observedCondition("research.contract_examples.trading_strategy.no_short", hasArrayValue(valueAt(strategy, ["tradability_constraints"]), "no_short"), true),
      observedCondition("research.contract_examples.trading_strategy.live_eligible", valueAt(strategy, ["live_eligible"]), false),
      observedCondition("research.contract_examples.trading_strategy.allowed_stages.live_absent", !hasArrayValue(valueAt(strategy, ["allowed_stages"]), "live"), true),
      observedCondition("research.contract_examples.trading_strategy.allowed_stages.full_auto_absent", !hasArrayValue(valueAt(strategy, ["allowed_stages"]), "full_auto"), true),
    ]),
    shortSellingEvidenceRow("paper_short_order_absent", "research_backtest_paper", "contract_examples.trading-paper-trade", [
      observedCondition("research.contract_examples.trading_paper_trade.orders.short_side_absent", paperOrdersHaveNoShortSide(valueAt(paperTrade, ["orders"])), true),
      observedCondition("research.contract_examples.trading_paper_trade.promotion_status", valueAt(paperTrade, ["promotion_status"]), "not_eligible"),
      observedCondition("research.contract_examples.trading_order_intent.order_side", valueAt(researchBacktestPaper, ["contract_examples", "trading-order-intent", "order_side"]), "none"),
      observedCondition("research.contract_examples.trading_order_intent.live_execution_allowed", valueAt(researchBacktestPaper, ["contract_examples", "trading-order-intent", "live_execution_allowed"]), false),
    ]),
    shortSellingEvidenceRow("risk_short_selling_capability_gate_blocks", "risk_engine", "risk_guards.short_selling_capability_gate", [
      observedCondition("risk.risk_guards.short_selling_capability_gate.short_selling_allowed", valueAt(riskGate, ["short_selling_allowed"]), false),
      observedCondition("risk.risk_guards.short_selling_capability_gate.korea_short_check_required", valueAt(riskGate, ["korea_short_check_required"]), true),
      observedCondition("risk.risk_guards.short_selling_capability_gate.result", valueAt(riskGate, ["result"]), "block"),
      observedCondition("risk.risk_guards.short_selling_capability_gate.blocks_order_intent", valueAt(riskGate, ["blocks_order_intent"]), true),
      observedCondition("risk.risk_check_artifacts[0].checks.short_selling_capability_gate.status", riskCheckStatus(riskEngine, "short_selling_capability_gate"), "block"),
    ]),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "short_selling_disabled_evidence_hash"));
}

function shortSellingEvidenceRow(rowKey, artifactId, evidencePath, observedConditions) {
  const allConditionsPresent = observedConditions.every((condition) => condition.condition_present);
  const unsafeConditions = observedConditions.filter((condition) => condition.observed_value !== condition.expected_safe_value);
  return {
    schema_version: "trading-short-selling-disabled-evidence-row.v1",
    short_selling_disabled_evidence_row_id: `trading-short-selling-disabled.evidence.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    artifact_id: artifactId,
    evidence_path: evidencePath,
    observed_conditions: observedConditions,
    observed_condition_count: observedConditions.length,
    all_conditions_present: allConditionsPresent,
    unsafe_short_selling_signal_detected: unsafeConditions.length > 0,
    unsafe_condition_refs: unsafeConditions.map((condition) => condition.condition_path),
    evidence_status: allConditionsPresent && unsafeConditions.length === 0 ? "short_selling_disabled" : "unsafe_or_incomplete",
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

function buildShortSellingFixtureRows(evidenceRows) {
  return REQUIRED_FIXTURE_KEYS.map((fixtureKey, index) => {
    const evidenceRow = evidenceRows.find((row) => row.row_key === fixtureKey);
    const row = {
      schema_version: "trading-short-selling-disabled-fixture-row.v1",
      short_selling_disabled_fixture_row_id: `trading-short-selling-disabled-fixtures.row.${fixtureKey}`,
      phase_slot: PHASE_SLOT,
      row_key: fixtureKey,
      expected_short_selling_allowed: false,
      expected_margin_allowed: false,
      unsafe_short_selling_signal_detected: evidenceRow?.unsafe_short_selling_signal_detected === true,
      evidence_status: evidenceRow?.evidence_status ?? "missing",
      fixture_should_fail_when_short_selling_enabled: true,
      fixture_should_fail_when_margin_enabled: true,
      fixture_should_fail_when_order_submit_enabled: true,
      fixture_status: evidenceRow?.evidence_status === "short_selling_disabled" ? "passed" : "failed",
      short_selling_allowed_by_fixture: false,
      margin_allowed_by_fixture: false,
      order_submit_enabled_by_fixture: false,
      live_execution_allowed_by_fixture: false,
      command_execution_performed_by_fixture: false,
      artifact_write_performed_by_fixture: false,
      protected_action_executed_by_fixture: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "short_selling_disabled_fixture_hash");
  });
}

function buildShortSellingBoundary({ generatedAt, writeRequested, leverageDisabledFixtures, evidenceRows, fixtureRows }) {
  const unsafeRows = evidenceRows.filter((row) => row.unsafe_short_selling_signal_detected);
  const sourceBoundary = leverageDisabledFixtures.summary;
  return {
    schema_version: "trading-short-selling-disabled-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    short_selling_disabled_artifact_write_requested: writeRequested,
    short_selling_disabled_fixture_execution_performed: false,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    short_selling_evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    unsafe_short_selling_signal_count: unsafeRows.length,
    unsafe_short_selling_signal_refs: unsafeRows.map((row) => row.row_key),
    short_selling_disabled_covered: evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "short_selling_disabled"),
    source_leverage_disabled_status: sourceBoundary.trading_leverage_disabled_fixtures_status,
    source_leverage_disabled_ready: leverageDisabledFixtures.validation.valid && sourceBoundary.trading_leverage_disabled_fixtures_status === "ready_for_trading_leverage_disabled_regression",
    short_selling_enabled: observedUnsafeCondition(evidenceRows, "research.safety_policy.short_selling_enabled"),
    derivatives_enabled: observedUnsafeCondition(evidenceRows, "research.safety_policy.derivatives_enabled"),
    research_live_trading_enabled: observedUnsafeCondition(evidenceRows, "research.safety_policy.live_trading_enabled"),
    research_real_broker_adapters_enabled: observedUnsafeCondition(evidenceRows, "research.safety_policy.real_broker_adapters_enabled"),
    asset_short_allowed: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_asset.capability_flags.short_allowed"),
    asset_derivatives_allowed: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_asset.capability_flags.derivatives_allowed"),
    asset_live_trading_allowed: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_asset.capability_flags.live_trading_allowed"),
    asset_not_paper_allowed: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_asset.tradability_status"),
    strategy_no_short_missing: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_strategy.no_short"),
    strategy_live_eligible: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_strategy.live_eligible"),
    strategy_live_stage_allowed: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_strategy.allowed_stages.live_absent") || observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_strategy.allowed_stages.full_auto_absent"),
    paper_short_order_present: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_paper_trade.orders.short_side_absent"),
    paper_promotion_eligible: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_paper_trade.promotion_status"),
    order_intent_short_side_present: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_order_intent.order_side"),
    order_intent_live_execution_allowed: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_order_intent.live_execution_allowed"),
    risk_short_selling_allowed: observedUnsafeCondition(evidenceRows, "risk.risk_guards.short_selling_capability_gate.short_selling_allowed"),
    risk_korea_short_check_missing: observedUnsafeCondition(evidenceRows, "risk.risk_guards.short_selling_capability_gate.korea_short_check_required"),
    short_selling_gate_not_blocking: observedUnsafeCondition(evidenceRows, "risk.risk_guards.short_selling_capability_gate.result"),
    short_selling_not_blocking_order_intent: observedUnsafeCondition(evidenceRows, "risk.risk_guards.short_selling_capability_gate.blocks_order_intent"),
    short_selling_risk_check_not_blocking: observedUnsafeCondition(evidenceRows, "risk.risk_check_artifacts[0].checks.short_selling_capability_gate.status"),
    market_order_allowed: sourceBoundary.market_order_allowed,
    market_orders_enabled: sourceBoundary.market_orders_enabled,
    order_submit_route_enabled: sourceBoundary.order_submit_route_enabled,
    order_intent_generated: sourceBoundary.order_intent_generated || observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_order_intent.order_side"),
    order_intent_route_enabled: sourceBoundary.order_intent_route_enabled,
    order_submit_route_enabled_source: sourceBoundary.order_submit_route_enabled,
    real_order_submitted: sourceBoundary.real_order_submitted,
    live_execution_allowed: sourceBoundary.live_execution_allowed || observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_order_intent.live_execution_allowed"),
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

function buildShortSellingGateRows({ leverageDisabledFixtures, packageJson, platformOpsLedger, researchBacktestPaper, riskEngine, fixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p395_leverage_disabled_fixtures_ready", "P395 leverage disabled fixtures source is ready.", leverageDisabledFixtures.validation.valid && leverageDisabledFixtures.summary.trading_leverage_disabled_fixtures_status === "ready_for_trading_leverage_disabled_regression"),
    gateRow("platform_package_script_registered", "package.json registers the P396 trading short selling disabled fixtures command.", typeof scripts["trading:short-selling-disabled-fixtures"] === "string" && scripts["trading:short-selling-disabled-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P396 trading short selling disabled fixtures command.", validateScript.includes("npm run trading:short-selling-disabled-fixtures -- --check")),
    gateRow("p396_ledger_acceptance_declared", "P396 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P396: `trading:short-selling-disabled-fixtures`")),
    gateRow("short_selling_sources_readable", "All short selling source artifacts are readable.", researchBacktestPaper.available && riskEngine.available),
    gateRow("required_short_selling_fixtures_declared", "All required short selling disabled fixtures are declared.", REQUIRED_FIXTURE_KEYS.every((fixtureKey) => fixtureRows.some((row) => row.row_key === fixtureKey)) && fixtureRows.length === REQUIRED_FIXTURE_KEYS.length),
    gateRow("research_short_selling_policy_disabled", "Research policy disables short selling, derivatives, live trading, and real broker adapters.", !boundary.short_selling_enabled && !boundary.derivatives_enabled && !boundary.research_live_trading_enabled && !boundary.research_real_broker_adapters_enabled),
    gateRow("asset_strategy_short_selling_disabled", "Asset capability and strategy constraints keep short selling blocked.", !boundary.asset_short_allowed && !boundary.asset_derivatives_allowed && !boundary.asset_live_trading_allowed && !boundary.asset_not_paper_allowed && !boundary.strategy_no_short_missing && !boundary.strategy_live_eligible && !boundary.strategy_live_stage_allowed),
    gateRow("paper_short_orders_absent", "Paper trade and order-intent examples do not contain short-side or live execution paths.", !boundary.paper_short_order_present && !boundary.paper_promotion_eligible && !boundary.order_intent_short_side_present && !boundary.order_intent_live_execution_allowed),
    gateRow("risk_short_selling_capability_blocks", "Risk short-selling capability gate blocks short selling and order-intent generation.", !boundary.risk_short_selling_allowed && !boundary.risk_korea_short_check_missing && !boundary.short_selling_gate_not_blocking && !boundary.short_selling_not_blocking_order_intent && !boundary.short_selling_risk_check_not_blocking),
    gateRow("no_trading_or_artifact_mutation", "Short-selling disabled fixtures do not execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "short_selling_disabled_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-short-selling-disabled-gate-row.v1",
    short_selling_disabled_gate_row_id: `trading-short-selling-disabled-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    short_selling_allowed_by_gate: false,
    order_submit_enabled_by_gate: false,
    live_execution_allowed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ leverageDisabledFixtures, packageJson, platformOpsLedger, researchBacktestPaper, riskEngine, evidenceRows, fixtureRows, gateRows, boundary }) {
  return [
    validationItem("source.leverage_disabled_fixtures", "p395_leverage_disabled_fixtures_ready", leverageDisabledFixtures.validation.valid && leverageDisabledFixtures.summary.trading_leverage_disabled_fixtures_status === "ready_for_trading_leverage_disabled_regression", "P395 leverage disabled fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P396 short selling disabled fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.short_selling_sources", "short_selling_sources_available", researchBacktestPaper.available && riskEngine.available, "Short selling source artifacts are readable."),
    validationItem("short_selling_disabled_evidence_rows", "short_selling_evidence_ready", evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "short_selling_disabled"), "Short selling evidence rows must show disabled state."),
    validationItem("short_selling_disabled_fixture_rows", "required_short_selling_fixtures_pass", fixtureRows.length === REQUIRED_FIXTURE_KEYS.length && fixtureRows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_short_selling_enabled), "All short selling disabled fixtures must pass."),
    validationItem("short_selling_disabled_gate_rows", "short_selling_disabled_gates_ready", gateRows.length >= 11 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P396 short selling disabled gates are ready."),
    validationItem("boundary.research_short_selling", "research_short_selling_policy_disabled", boundary.short_selling_disabled_covered && !boundary.short_selling_enabled && !boundary.derivatives_enabled && !boundary.research_live_trading_enabled && !boundary.research_real_broker_adapters_enabled, "Research policy disables short selling and related live capabilities."),
    validationItem("boundary.asset_strategy_short_selling", "asset_strategy_short_selling_disabled", !boundary.asset_short_allowed && !boundary.asset_derivatives_allowed && !boundary.asset_live_trading_allowed && !boundary.asset_not_paper_allowed && !boundary.strategy_no_short_missing && !boundary.strategy_live_eligible && !boundary.strategy_live_stage_allowed, "Asset and strategy short selling paths remain disabled."),
    validationItem("boundary.paper_short_orders", "paper_short_orders_absent", !boundary.paper_short_order_present && !boundary.paper_promotion_eligible && !boundary.order_intent_short_side_present && !boundary.order_intent_live_execution_allowed, "Paper trade and order-intent examples contain no short-side live path."),
    validationItem("boundary.risk_short_selling_capability", "risk_short_selling_capability_blocks", !boundary.risk_short_selling_allowed && !boundary.risk_korea_short_check_missing && !boundary.short_selling_gate_not_blocking && !boundary.short_selling_not_blocking_order_intent && !boundary.short_selling_risk_check_not_blocking, "Risk short-selling capability gate blocks short selling and order intent."),
    validationItem("boundary.no_mutation", "no_trading_or_artifact_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed, "P396 short-selling disabled fixtures perform no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ leverageDisabledFixtures, evidenceRows, fixtureRows, gateRows, boundary, validation }) {
  return {
    trading_short_selling_disabled_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_leverage_disabled_status: leverageDisabledFixtures.summary.trading_leverage_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    passed_fixture_count: fixtureRows.filter((row) => row.fixture_status === "passed").length,
    failed_fixture_count: fixtureRows.filter((row) => row.fixture_status !== "passed").length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    unsafe_short_selling_signal_count: boundary.unsafe_short_selling_signal_count,
    short_selling_disabled_covered: boundary.short_selling_disabled_covered,
    short_selling_enabled: boundary.short_selling_enabled,
    derivatives_enabled: boundary.derivatives_enabled,
    research_live_trading_enabled: boundary.research_live_trading_enabled,
    research_real_broker_adapters_enabled: boundary.research_real_broker_adapters_enabled,
    asset_short_allowed: boundary.asset_short_allowed,
    asset_derivatives_allowed: boundary.asset_derivatives_allowed,
    asset_live_trading_allowed: boundary.asset_live_trading_allowed,
    asset_not_paper_allowed: boundary.asset_not_paper_allowed,
    strategy_no_short_missing: boundary.strategy_no_short_missing,
    strategy_live_eligible: boundary.strategy_live_eligible,
    strategy_live_stage_allowed: boundary.strategy_live_stage_allowed,
    paper_short_order_present: boundary.paper_short_order_present,
    paper_promotion_eligible: boundary.paper_promotion_eligible,
    order_intent_short_side_present: boundary.order_intent_short_side_present,
    order_intent_live_execution_allowed: boundary.order_intent_live_execution_allowed,
    risk_short_selling_allowed: boundary.risk_short_selling_allowed,
    risk_korea_short_check_missing: boundary.risk_korea_short_check_missing,
    short_selling_gate_not_blocking: boundary.short_selling_gate_not_blocking,
    short_selling_not_blocking_order_intent: boundary.short_selling_not_blocking_order_intent,
    short_selling_risk_check_not_blocking: boundary.short_selling_risk_check_not_blocking,
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
    "# Trading Short Selling Disabled Fixtures",
    "",
    `Status: ${result.summary.trading_short_selling_disabled_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source leverage disabled: ${result.summary.source_leverage_disabled_status}`,
    `Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`,
    `Unsafe short selling signals: ${result.summary.unsafe_short_selling_signal_count}`,
    "",
    "## Fixtures",
    "",
    ...result.short_selling_disabled_fixture_rows.map((row) => `- ${row.row_key}: ${row.fixture_status}`),
    "",
    "## Gates",
    "",
    ...result.short_selling_disabled_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_OUT_DIR, routeSourcePaths: [] };
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
    else if (arg === "--leverage-disabled-fixtures-schema") parsed.leverageDisabledFixturesSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-short-selling-disabled-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_OUT_DIR}
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
  --leverage-disabled-fixtures-schema <path>
                                           P395 leverage disabled fixtures schema path.
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  const routeSourcePaths = options.routeSourcePaths ?? options.routeSources ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.routeSourcePaths;
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.platformOpsLedgerPath),
    release_check_receipt_closeout_schema_path: path.resolve(options.releaseCheckReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.releaseCheckReceiptCloseoutSchemaPath),
    safety_regression_fixtures_schema_path: path.resolve(options.safetyRegressionFixturesSchemaPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.safetyRegressionFixturesSchemaPath),
    route_inventory_fixtures_schema_path: path.resolve(options.routeInventoryFixturesSchemaPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.routeInventoryFixturesSchemaPath),
    approval_absence_fixtures_schema_path: path.resolve(options.approvalAbsenceFixturesSchemaPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.approvalAbsenceFixturesSchemaPath),
    live_adapter_disabled_fixtures_schema_path: path.resolve(options.liveAdapterDisabledFixturesSchemaPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.liveAdapterDisabledFixturesSchemaPath),
    credential_lookup_disabled_fixtures_schema_path: path.resolve(options.credentialLookupDisabledFixturesSchemaPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.credentialLookupDisabledFixturesSchemaPath),
    broker_write_disabled_fixtures_schema_path: path.resolve(options.brokerWriteDisabledFixturesSchemaPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.brokerWriteDisabledFixturesSchemaPath),
    exchange_write_disabled_fixtures_schema_path: path.resolve(options.exchangeWriteDisabledFixturesSchemaPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.exchangeWriteDisabledFixturesSchemaPath),
    safety_boundary_fixtures_schema_path: path.resolve(options.safetyBoundaryFixturesSchemaPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.safetyBoundaryFixturesSchemaPath),
    manual_resume_disabled_fixtures_schema_path: path.resolve(options.manualResumeDisabledFixturesSchemaPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.manualResumeDisabledFixturesSchemaPath),
    risk_override_disabled_fixtures_schema_path: path.resolve(options.riskOverrideDisabledFixturesSchemaPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.riskOverrideDisabledFixturesSchemaPath),
    promotion_disabled_fixtures_schema_path: path.resolve(options.promotionDisabledFixturesSchemaPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.promotionDisabledFixturesSchemaPath),
    first_trade_disabled_fixtures_schema_path: path.resolve(options.firstTradeDisabledFixturesSchemaPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.firstTradeDisabledFixturesSchemaPath),
    order_intent_disabled_fixtures_schema_path: path.resolve(options.orderIntentDisabledFixturesSchemaPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.orderIntentDisabledFixturesSchemaPath),
    market_order_disabled_fixtures_schema_path: path.resolve(options.marketOrderDisabledFixturesSchemaPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.marketOrderDisabledFixturesSchemaPath),
    leverage_disabled_fixtures_schema_path: path.resolve(options.leverageDisabledFixturesSchemaPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.leverageDisabledFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.executionEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.modelImprovementPath),
    backtest_validation_path: path.resolve(options.backtestValidationPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.backtestValidationPath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.riskEnginePath),
    signal_engine_path: path.resolve(options.signalEnginePath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.signalEnginePath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.marketDataFeatureStorePath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.researchBacktestPaperPath),
    route_source_paths: routeSourcePaths.map((sourcePath) => path.resolve(sourcePath)),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.schemaPath),
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

function paperOrdersHaveNoShortSide(orders) {
  return Array.isArray(orders) && orders.every((order) => !["short", "sell_short", "short_sell"].includes(order?.side));
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
    validation_item_id: `trading-short-selling-disabled-fixtures.${slugify(itemPath)}.${checkId}`,
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
