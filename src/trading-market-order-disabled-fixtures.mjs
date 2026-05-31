import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS,
  buildTradingOrderIntentDisabledFixtures,
} from "./trading-order-intent-disabled-fixtures.mjs";

export const DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_OUT_DIR = "artifacts/trading-market-order-disabled-fixtures/latest";
export const DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS,
  orderIntentDisabledFixturesSchemaPath: DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-market-order-disabled-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-market-order-disabled-fixtures.v1";
const CAPABILITY_ID = "trading.market_order_disabled_fixtures";
const PHASE_SLOT = "P394";
const PREVIOUS_PHASE_SLOT = "P393";
const NEXT_PHASE_SLOT = "P395";
const READY_STATUS = "ready_for_trading_market_order_disabled_regression";
const REQUIRED_FIXTURE_KEYS = [
  "research_market_order_policy_disabled",
  "shadow_market_order_intent_disabled",
  "execution_order_type_whitelist_blocks_market",
  "limited_live_market_order_routes_disabled",
  "full_auto_market_order_routes_disabled",
];

export async function runTradingMarketOrderDisabledFixtures(options = {}) {
  const result = await buildTradingMarketOrderDisabledFixtures(options);
  if (options.write !== false) await writeTradingMarketOrderDisabledFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading market order disabled fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingMarketOrderDisabledFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const orderIntentDisabledFixtures = await buildTradingOrderIntentDisabledFixtures({
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
    schemaPath: inputs.order_intent_disabled_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const researchBacktestPaper = await readJsonSource(inputs.research_backtest_paper_path);
  const paperShadow = await readJsonSource(inputs.paper_shadow_path);
  const executionEngine = await readJsonSource(inputs.execution_engine_path);
  const limitedLive = await readJsonSource(inputs.limited_live_path);
  const fullAuto = await readJsonSource(inputs.full_auto_path);
  const marketOrderAnchor = buildMarketOrderAnchor({ orderIntentDisabledFixtures });
  const marketOrderEvidenceRows = buildMarketOrderEvidenceRows({
    researchBacktestPaper: researchBacktestPaper.data,
    paperShadow: paperShadow.data,
    executionEngine: executionEngine.data,
    limitedLive: limitedLive.data,
    fullAuto: fullAuto.data,
  });
  const marketOrderFixtureRows = buildMarketOrderFixtureRows(marketOrderEvidenceRows);
  const marketOrderBoundary = buildMarketOrderBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    orderIntentDisabledFixtures,
    evidenceRows: marketOrderEvidenceRows,
    fixtureRows: marketOrderFixtureRows,
  });
  const marketOrderGateRows = buildMarketOrderGateRows({
    orderIntentDisabledFixtures,
    packageJson,
    platformOpsLedger,
    researchBacktestPaper,
    paperShadow,
    executionEngine,
    limitedLive,
    fullAuto,
    fixtureRows: marketOrderFixtureRows,
    boundary: marketOrderBoundary,
  });
  const validationItems = buildValidationItems({
    orderIntentDisabledFixtures,
    packageJson,
    platformOpsLedger,
    researchBacktestPaper,
    paperShadow,
    executionEngine,
    limitedLive,
    fullAuto,
    evidenceRows: marketOrderEvidenceRows,
    fixtureRows: marketOrderFixtureRows,
    gateRows: marketOrderGateRows,
    boundary: marketOrderBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    orderIntentDisabledFixtures,
    evidenceRows: marketOrderEvidenceRows,
    fixtureRows: marketOrderFixtureRows,
    gateRows: marketOrderGateRows,
    boundary: marketOrderBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_market_order_disabled_fixtures_id: `trading-market-order-disabled-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    market_order_disabled_anchor: marketOrderAnchor,
    market_order_disabled_evidence_rows: marketOrderEvidenceRows,
    market_order_disabled_fixture_rows: marketOrderFixtureRows,
    market_order_disabled_gate_rows: marketOrderGateRows,
    market_order_disabled_boundary: marketOrderBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_market_order_disabled_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    orderIntentDisabledFixtures,
    evidenceRows: marketOrderEvidenceRows,
    fixtureRows: marketOrderFixtureRows,
    gateRows: marketOrderGateRows,
    boundary: marketOrderBoundary,
    validation: result.validation,
  });
  result.summary.trading_market_order_disabled_fixtures_id = result.trading_market_order_disabled_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingMarketOrderDisabledFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-market-order-disabled-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "market-order-disabled-evidence-rows.json"), collectionEnvelope("trading-market-order-disabled-evidence-rows.v1", "market_order_disabled_evidence_rows", result.market_order_disabled_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "market-order-disabled-fixture-rows.json"), collectionEnvelope("trading-market-order-disabled-fixture-rows.v1", "market_order_disabled_fixture_rows", result.market_order_disabled_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "market-order-disabled-gate-rows.json"), collectionEnvelope("trading-market-order-disabled-gate-rows.v1", "market_order_disabled_gate_rows", result.market_order_disabled_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "market-order-disabled-boundary.json"), result.market_order_disabled_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-market-order-disabled-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingMarketOrderDisabledFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingMarketOrderDisabledFixtures(args);
    console.log(`Trading market order disabled fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_market_order_disabled_fixtures_status}`);
    console.log(`Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
    console.log(`Unsafe market order signals: ${result.summary.unsafe_market_order_signal_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildMarketOrderAnchor({ orderIntentDisabledFixtures }) {
  return {
    schema_version: "trading-market-order-disabled-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_order_intent_disabled_fixtures_id: orderIntentDisabledFixtures.trading_order_intent_disabled_fixtures_id,
    source_order_intent_disabled_status: orderIntentDisabledFixtures.summary.trading_order_intent_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    required_fixture_keys: REQUIRED_FIXTURE_KEYS,
    source_hash: hashValue({
      id: orderIntentDisabledFixtures.trading_order_intent_disabled_fixtures_id,
      status: orderIntentDisabledFixtures.summary.trading_order_intent_disabled_fixtures_status,
      fixtures: REQUIRED_FIXTURE_KEYS,
    }),
  };
}

function buildMarketOrderEvidenceRows({ researchBacktestPaper, paperShadow, executionEngine, limitedLive, fullAuto }) {
  const researchIntent = valueAt(researchBacktestPaper, ["contract_examples", "trading-order-intent"]);
  const shadowIntent = Array.isArray(paperShadow?.shadow_order_intents) ? paperShadow.shadow_order_intents[0] : null;
  const rows = [
    marketOrderEvidenceRow("research_market_order_policy_disabled", "research_backtest_paper", "safety_policy", [
      observedCondition("research.safety_policy.market_orders_enabled", valueAt(researchBacktestPaper, ["safety_policy", "market_orders_enabled"]), false),
      observedCondition("research.contract_examples.trading_order_intent.market_order_allowed", valueAt(researchIntent, ["market_order_allowed"]), false),
      observedCondition("research.contract_examples.trading_order_intent.order_type", valueAt(researchIntent, ["order_type"]), "none"),
      observedCondition("research.contract_examples.trading_strategy.no_market_order", hasArrayValue(valueAt(researchBacktestPaper, ["contract_examples", "trading-strategy", "tradability_constraints"]), "no_market_order"), true),
    ]),
    marketOrderEvidenceRow("shadow_market_order_intent_disabled", "paper_shadow_live", "shadow_order_intents[0]", [
      observedCondition("shadow_order_intents[0].market_order_allowed", valueAt(shadowIntent, ["market_order_allowed"]), false),
      observedCondition("shadow_order_intents[0].order_type", valueAt(shadowIntent, ["order_type"]), "none"),
      observedCondition("shadow_order_intents[0].non_executable", valueAt(shadowIntent, ["non_executable"]), true),
      observedCondition("no_order_shadow_mode.real_order_count", valueAt(paperShadow, ["no_order_shadow_mode", "real_order_count"]), 0),
    ]),
    marketOrderEvidenceRow("execution_order_type_whitelist_blocks_market", "execution_engine", "order_type_whitelist", [
      observedCondition("execution.order_type_whitelist.limit_cancel_only", limitCancelOnly(valueAt(executionEngine, ["order_type_whitelist", "allowed_order_types"])), true),
      observedCondition("execution.order_type_whitelist.market_order_allowed", valueAt(executionEngine, ["order_type_whitelist", "market_order_allowed"]), false),
      observedCondition("execution.order_controls.order_throttle.max_orders_per_day", valueAt(executionEngine, ["order_controls", "order_throttle", "max_orders_per_day"]), 0),
      observedCondition("execution.order_controls.order_throttle.blocks_order_submission", valueAt(executionEngine, ["order_controls", "order_throttle", "blocks_order_submission"]), true),
      observedCondition("execution.dashboard_api_stub.disabled_routes.submit", hasDisabledRoute(valueAt(executionEngine, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/orders/submit"), true),
    ]),
    marketOrderEvidenceRow("limited_live_market_order_routes_disabled", "limited_live_governance", "order_caps", [
      observedCondition("limited_live.safety_boundary.live_order_submission_allowed", valueAt(limitedLive, ["safety_boundary", "live_order_submission_allowed"]), false),
      observedCondition("limited_live.order_caps.order_submission_allowed", valueAt(limitedLive, ["order_caps", "order_submission_allowed"]), false),
      observedCondition("limited_live.dashboard_api_stub.disabled_routes.orders", hasDisabledRoute(valueAt(limitedLive, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/orders"), true),
      observedCondition("limited_live.dashboard_api_stub.disabled_routes.limited_live_orders", hasDisabledRoute(valueAt(limitedLive, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/limited-live/orders"), true),
    ]),
    marketOrderEvidenceRow("full_auto_market_order_routes_disabled", "full_auto_governance", "safety_boundary", [
      observedCondition("full_auto.safety_boundary.full_auto_enabled", valueAt(fullAuto, ["safety_boundary", "full_auto_enabled"]), false),
      observedCondition("full_auto.safety_boundary.automatic_order_submission_allowed", valueAt(fullAuto, ["safety_boundary", "automatic_order_submission_allowed"]), false),
      observedCondition("full_auto.safety_boundary.live_order_submission_allowed", valueAt(fullAuto, ["safety_boundary", "live_order_submission_allowed"]), false),
      observedCondition("full_auto.dashboard_api_stub.disabled_routes.orders", hasDisabledRoute(valueAt(fullAuto, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/orders"), true),
      observedCondition("full_auto.dashboard_api_stub.disabled_routes.full_auto_orders", hasDisabledRoute(valueAt(fullAuto, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/full-auto/orders"), true),
    ]),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "market_order_disabled_evidence_hash"));
}

function marketOrderEvidenceRow(rowKey, artifactId, evidencePath, observedConditions) {
  const allConditionsPresent = observedConditions.every((condition) => condition.condition_present);
  const unsafeConditions = observedConditions.filter((condition) => condition.observed_value !== condition.expected_safe_value);
  return {
    schema_version: "trading-market-order-disabled-evidence-row.v1",
    market_order_disabled_evidence_row_id: `trading-market-order-disabled.evidence.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    artifact_id: artifactId,
    evidence_path: evidencePath,
    observed_conditions: observedConditions,
    observed_condition_count: observedConditions.length,
    all_conditions_present: allConditionsPresent,
    unsafe_market_order_signal_detected: unsafeConditions.length > 0,
    unsafe_condition_refs: unsafeConditions.map((condition) => condition.condition_path),
    evidence_status: allConditionsPresent && unsafeConditions.length === 0 ? "market_order_disabled" : "unsafe_or_incomplete",
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

function buildMarketOrderFixtureRows(evidenceRows) {
  return REQUIRED_FIXTURE_KEYS.map((fixtureKey, index) => {
    const evidenceRow = evidenceRows.find((row) => row.row_key === fixtureKey);
    const row = {
      schema_version: "trading-market-order-disabled-fixture-row.v1",
      market_order_disabled_fixture_row_id: `trading-market-order-disabled-fixtures.row.${fixtureKey}`,
      phase_slot: PHASE_SLOT,
      row_key: fixtureKey,
      expected_market_order_allowed: false,
      unsafe_market_order_signal_detected: evidenceRow?.unsafe_market_order_signal_detected === true,
      evidence_status: evidenceRow?.evidence_status ?? "missing",
      fixture_should_fail_when_market_orders_enabled: true,
      fixture_should_fail_when_market_order_allowed: true,
      fixture_should_fail_when_order_submit_enabled: true,
      fixture_status: evidenceRow?.evidence_status === "market_order_disabled" ? "passed" : "failed",
      market_order_allowed_by_fixture: false,
      market_order_route_enabled_by_fixture: false,
      order_submit_enabled_by_fixture: false,
      live_execution_allowed_by_fixture: false,
      command_execution_performed_by_fixture: false,
      artifact_write_performed_by_fixture: false,
      protected_action_executed_by_fixture: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "market_order_disabled_fixture_hash");
  });
}

function buildMarketOrderBoundary({ generatedAt, writeRequested, orderIntentDisabledFixtures, evidenceRows, fixtureRows }) {
  const unsafeRows = evidenceRows.filter((row) => row.unsafe_market_order_signal_detected);
  const sourceBoundary = orderIntentDisabledFixtures.summary;
  return {
    schema_version: "trading-market-order-disabled-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    market_order_disabled_artifact_write_requested: writeRequested,
    market_order_disabled_fixture_execution_performed: false,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    market_order_evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    unsafe_market_order_signal_count: unsafeRows.length,
    unsafe_market_order_signal_refs: unsafeRows.map((row) => row.row_key),
    market_order_disabled_covered: evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "market_order_disabled"),
    source_order_intent_disabled_status: sourceBoundary.trading_order_intent_disabled_fixtures_status,
    source_order_intent_disabled_ready: orderIntentDisabledFixtures.validation.valid && sourceBoundary.trading_order_intent_disabled_fixtures_status === "ready_for_trading_order_intent_disabled_regression",
    market_orders_enabled: observedUnsafeCondition(evidenceRows, "research.safety_policy.market_orders_enabled"),
    research_market_order_allowed: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_order_intent.market_order_allowed"),
    research_order_type_not_none: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_order_intent.order_type"),
    strategy_no_market_order_missing: observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_strategy.no_market_order"),
    shadow_market_order_allowed: observedUnsafeCondition(evidenceRows, "shadow_order_intents[0].market_order_allowed"),
    shadow_order_type_not_none: observedUnsafeCondition(evidenceRows, "shadow_order_intents[0].order_type"),
    shadow_order_intent_executable: observedUnsafeCondition(evidenceRows, "shadow_order_intents[0].non_executable"),
    execution_order_type_whitelist_invalid: observedUnsafeCondition(evidenceRows, "execution.order_type_whitelist.limit_cancel_only"),
    execution_market_order_allowed: observedUnsafeCondition(evidenceRows, "execution.order_type_whitelist.market_order_allowed"),
    order_throttle_missing: observedUnsafeCondition(evidenceRows, "execution.order_controls.order_throttle.max_orders_per_day") || observedUnsafeCondition(evidenceRows, "execution.order_controls.order_throttle.blocks_order_submission"),
    order_submit_route_enabled: observedUnsafeCondition(evidenceRows, "execution.dashboard_api_stub.disabled_routes.submit"),
    limited_live_order_submission_allowed: observedUnsafeCondition(evidenceRows, "limited_live.safety_boundary.live_order_submission_allowed") || observedUnsafeCondition(evidenceRows, "limited_live.order_caps.order_submission_allowed"),
    limited_live_order_route_enabled: observedUnsafeCondition(evidenceRows, "limited_live.dashboard_api_stub.disabled_routes.orders") || observedUnsafeCondition(evidenceRows, "limited_live.dashboard_api_stub.disabled_routes.limited_live_orders"),
    full_auto_order_submission_allowed: observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.automatic_order_submission_allowed") || observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.live_order_submission_allowed"),
    full_auto_order_route_enabled: observedUnsafeCondition(evidenceRows, "full_auto.dashboard_api_stub.disabled_routes.orders") || observedUnsafeCondition(evidenceRows, "full_auto.dashboard_api_stub.disabled_routes.full_auto_orders"),
    full_auto_enabled: observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.full_auto_enabled") || sourceBoundary.full_auto_enabled,
    market_order_allowed: sourceBoundary.market_order_allowed || observedUnsafeCondition(evidenceRows, "research.contract_examples.trading_order_intent.market_order_allowed") || observedUnsafeCondition(evidenceRows, "shadow_order_intents[0].market_order_allowed") || observedUnsafeCondition(evidenceRows, "execution.order_type_whitelist.market_order_allowed"),
    order_intent_generated: sourceBoundary.order_intent_generated,
    order_intent_route_enabled: sourceBoundary.order_intent_route_enabled,
    order_submit_route_enabled_source: sourceBoundary.order_submit_route_enabled,
    real_order_submitted: sourceBoundary.real_order_submitted,
    live_execution_allowed: sourceBoundary.live_execution_allowed,
    limited_live_enabled: sourceBoundary.limited_live_enabled,
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

function buildMarketOrderGateRows({ orderIntentDisabledFixtures, packageJson, platformOpsLedger, researchBacktestPaper, paperShadow, executionEngine, limitedLive, fullAuto, fixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p393_order_intent_disabled_fixtures_ready", "P393 order intent disabled fixtures source is ready.", orderIntentDisabledFixtures.validation.valid && orderIntentDisabledFixtures.summary.trading_order_intent_disabled_fixtures_status === "ready_for_trading_order_intent_disabled_regression"),
    gateRow("platform_package_script_registered", "package.json registers the P394 trading market order disabled fixtures command.", typeof scripts["trading:market-order-disabled-fixtures"] === "string" && scripts["trading:market-order-disabled-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P394 trading market order disabled fixtures command.", validateScript.includes("npm run trading:market-order-disabled-fixtures -- --check")),
    gateRow("p394_ledger_acceptance_declared", "P394 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P394: `trading:market-order-disabled-fixtures`")),
    gateRow("market_order_sources_readable", "All market-order source artifacts are readable.", researchBacktestPaper.available && paperShadow.available && executionEngine.available && limitedLive.available && fullAuto.available),
    gateRow("required_market_order_fixtures_declared", "All required market-order disabled fixtures are declared.", REQUIRED_FIXTURE_KEYS.every((fixtureKey) => fixtureRows.some((row) => row.row_key === fixtureKey)) && fixtureRows.length === REQUIRED_FIXTURE_KEYS.length),
    gateRow("research_market_orders_disabled", "Research policy, strategy constraints, and sample order intent block market orders.", !boundary.market_orders_enabled && !boundary.research_market_order_allowed && !boundary.research_order_type_not_none && !boundary.strategy_no_market_order_missing),
    gateRow("shadow_market_orders_disabled", "Shadow intents remain non-executable and cannot become market orders.", !boundary.shadow_market_order_allowed && !boundary.shadow_order_type_not_none && !boundary.shadow_order_intent_executable && !boundary.market_order_allowed && !boundary.real_order_submitted),
    gateRow("execution_market_orders_disabled", "Execution order-type whitelist blocks market orders and submit route stays disabled.", !boundary.execution_order_type_whitelist_invalid && !boundary.execution_market_order_allowed && !boundary.order_throttle_missing && !boundary.order_submit_route_enabled && !boundary.order_submit_route_enabled_source),
    gateRow("live_stage_order_submission_disabled", "Limited-live and full-auto order submission remain disabled.", !boundary.limited_live_order_submission_allowed && !boundary.limited_live_order_route_enabled && !boundary.full_auto_order_submission_allowed && !boundary.full_auto_order_route_enabled && !boundary.full_auto_enabled),
    gateRow("no_trading_or_artifact_mutation", "Market-order disabled fixtures do not execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "market_order_disabled_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-market-order-disabled-gate-row.v1",
    market_order_disabled_gate_row_id: `trading-market-order-disabled-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    market_order_allowed_by_gate: false,
    order_submit_enabled_by_gate: false,
    live_execution_allowed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ orderIntentDisabledFixtures, packageJson, platformOpsLedger, researchBacktestPaper, paperShadow, executionEngine, limitedLive, fullAuto, evidenceRows, fixtureRows, gateRows, boundary }) {
  return [
    validationItem("source.order_intent_disabled_fixtures", "p393_order_intent_disabled_fixtures_ready", orderIntentDisabledFixtures.validation.valid && orderIntentDisabledFixtures.summary.trading_order_intent_disabled_fixtures_status === "ready_for_trading_order_intent_disabled_regression", "P393 order intent disabled fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P394 market order disabled fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.market_order_sources", "market_order_sources_available", researchBacktestPaper.available && paperShadow.available && executionEngine.available && limitedLive.available && fullAuto.available, "Market-order source artifacts are readable."),
    validationItem("market_order_disabled_evidence_rows", "market_order_evidence_ready", evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "market_order_disabled"), "Market-order evidence rows must show disabled/non-executable state."),
    validationItem("market_order_disabled_fixture_rows", "required_market_order_fixtures_pass", fixtureRows.length === REQUIRED_FIXTURE_KEYS.length && fixtureRows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_market_order_allowed && row.fixture_should_fail_when_order_submit_enabled), "All market-order disabled fixtures must pass."),
    validationItem("market_order_disabled_gate_rows", "market_order_disabled_gates_ready", gateRows.length >= 11 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P394 market-order disabled gates are ready."),
    validationItem("boundary.research_market_orders", "research_market_orders_disabled", boundary.market_order_disabled_covered && !boundary.market_orders_enabled && !boundary.research_market_order_allowed && !boundary.research_order_type_not_none && !boundary.strategy_no_market_order_missing, "Research policy and examples block market orders."),
    validationItem("boundary.shadow_market_orders", "shadow_market_orders_disabled", !boundary.shadow_market_order_allowed && !boundary.shadow_order_type_not_none && !boundary.shadow_order_intent_executable && !boundary.market_order_allowed && !boundary.real_order_submitted, "Shadow intents remain non-executable and cannot become market orders."),
    validationItem("boundary.execution_market_orders", "execution_market_orders_disabled", !boundary.execution_order_type_whitelist_invalid && !boundary.execution_market_order_allowed && !boundary.order_throttle_missing && !boundary.order_submit_route_enabled && !boundary.order_submit_route_enabled_source, "Execution order type whitelist and submit route block market orders."),
    validationItem("boundary.live_order_submission", "live_stage_order_submission_disabled", !boundary.limited_live_order_submission_allowed && !boundary.limited_live_order_route_enabled && !boundary.full_auto_order_submission_allowed && !boundary.full_auto_order_route_enabled && !boundary.full_auto_enabled && !boundary.live_execution_allowed, "Live-stage order submission remains disabled."),
    validationItem("boundary.no_mutation", "no_trading_or_artifact_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed, "P394 market-order disabled fixtures perform no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ orderIntentDisabledFixtures, evidenceRows, fixtureRows, gateRows, boundary, validation }) {
  return {
    trading_market_order_disabled_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_order_intent_disabled_status: orderIntentDisabledFixtures.summary.trading_order_intent_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    passed_fixture_count: fixtureRows.filter((row) => row.fixture_status === "passed").length,
    failed_fixture_count: fixtureRows.filter((row) => row.fixture_status !== "passed").length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    unsafe_market_order_signal_count: boundary.unsafe_market_order_signal_count,
    market_order_disabled_covered: boundary.market_order_disabled_covered,
    market_orders_enabled: boundary.market_orders_enabled,
    research_market_order_allowed: boundary.research_market_order_allowed,
    research_order_type_not_none: boundary.research_order_type_not_none,
    strategy_no_market_order_missing: boundary.strategy_no_market_order_missing,
    shadow_market_order_allowed: boundary.shadow_market_order_allowed,
    shadow_order_type_not_none: boundary.shadow_order_type_not_none,
    shadow_order_intent_executable: boundary.shadow_order_intent_executable,
    execution_order_type_whitelist_invalid: boundary.execution_order_type_whitelist_invalid,
    execution_market_order_allowed: boundary.execution_market_order_allowed,
    order_throttle_missing: boundary.order_throttle_missing,
    order_submit_route_enabled: boundary.order_submit_route_enabled,
    order_submit_route_enabled_source: boundary.order_submit_route_enabled_source,
    limited_live_order_submission_allowed: boundary.limited_live_order_submission_allowed,
    limited_live_order_route_enabled: boundary.limited_live_order_route_enabled,
    full_auto_order_submission_allowed: boundary.full_auto_order_submission_allowed,
    full_auto_order_route_enabled: boundary.full_auto_order_route_enabled,
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
    "# Trading Market Order Disabled Fixtures",
    "",
    `Status: ${result.summary.trading_market_order_disabled_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source order intent disabled: ${result.summary.source_order_intent_disabled_status}`,
    `Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`,
    `Unsafe market order signals: ${result.summary.unsafe_market_order_signal_count}`,
    "",
    "## Fixtures",
    "",
    ...result.market_order_disabled_fixture_rows.map((row) => `- ${row.row_key}: ${row.fixture_status}`),
    "",
    "## Gates",
    "",
    ...result.market_order_disabled_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_OUT_DIR, routeSourcePaths: [] };
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
  console.log(`Usage: node scripts/trading-market-order-disabled-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_OUT_DIR}
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
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  const routeSourcePaths = options.routeSourcePaths ?? options.routeSources ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.routeSourcePaths;
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.platformOpsLedgerPath),
    release_check_receipt_closeout_schema_path: path.resolve(options.releaseCheckReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.releaseCheckReceiptCloseoutSchemaPath),
    safety_regression_fixtures_schema_path: path.resolve(options.safetyRegressionFixturesSchemaPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.safetyRegressionFixturesSchemaPath),
    route_inventory_fixtures_schema_path: path.resolve(options.routeInventoryFixturesSchemaPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.routeInventoryFixturesSchemaPath),
    approval_absence_fixtures_schema_path: path.resolve(options.approvalAbsenceFixturesSchemaPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.approvalAbsenceFixturesSchemaPath),
    live_adapter_disabled_fixtures_schema_path: path.resolve(options.liveAdapterDisabledFixturesSchemaPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.liveAdapterDisabledFixturesSchemaPath),
    credential_lookup_disabled_fixtures_schema_path: path.resolve(options.credentialLookupDisabledFixturesSchemaPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.credentialLookupDisabledFixturesSchemaPath),
    broker_write_disabled_fixtures_schema_path: path.resolve(options.brokerWriteDisabledFixturesSchemaPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.brokerWriteDisabledFixturesSchemaPath),
    exchange_write_disabled_fixtures_schema_path: path.resolve(options.exchangeWriteDisabledFixturesSchemaPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.exchangeWriteDisabledFixturesSchemaPath),
    safety_boundary_fixtures_schema_path: path.resolve(options.safetyBoundaryFixturesSchemaPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.safetyBoundaryFixturesSchemaPath),
    manual_resume_disabled_fixtures_schema_path: path.resolve(options.manualResumeDisabledFixturesSchemaPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.manualResumeDisabledFixturesSchemaPath),
    risk_override_disabled_fixtures_schema_path: path.resolve(options.riskOverrideDisabledFixturesSchemaPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.riskOverrideDisabledFixturesSchemaPath),
    promotion_disabled_fixtures_schema_path: path.resolve(options.promotionDisabledFixturesSchemaPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.promotionDisabledFixturesSchemaPath),
    first_trade_disabled_fixtures_schema_path: path.resolve(options.firstTradeDisabledFixturesSchemaPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.firstTradeDisabledFixturesSchemaPath),
    order_intent_disabled_fixtures_schema_path: path.resolve(options.orderIntentDisabledFixturesSchemaPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.orderIntentDisabledFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.executionEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.modelImprovementPath),
    backtest_validation_path: path.resolve(options.backtestValidationPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.backtestValidationPath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.riskEnginePath),
    signal_engine_path: path.resolve(options.signalEnginePath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.signalEnginePath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.marketDataFeatureStorePath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.researchBacktestPaperPath),
    route_source_paths: routeSourcePaths.map((sourcePath) => path.resolve(sourcePath)),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_MARKET_ORDER_DISABLED_FIXTURES_INPUTS.schemaPath),
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

function limitCancelOnly(allowedOrderTypes) {
  return Array.isArray(allowedOrderTypes) && allowedOrderTypes.length === 2 && allowedOrderTypes.includes("limit") && allowedOrderTypes.includes("cancel");
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `trading-market-order-disabled-fixtures.${slugify(itemPath)}.${checkId}`,
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
