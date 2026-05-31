import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS,
  buildTradingFirstTradeDisabledFixtures,
} from "./trading-first-trade-disabled-fixtures.mjs";

export const DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_OUT_DIR = "artifacts/trading-order-intent-disabled-fixtures/latest";
export const DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS,
  firstTradeDisabledFixturesSchemaPath: DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.schemaPath,
  signalEnginePath: "examples/trading/signal-engine.json",
  schemaPath: "schemas/trading/trading-order-intent-disabled-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-order-intent-disabled-fixtures.v1";
const CAPABILITY_ID = "trading.order_intent_disabled_fixtures";
const PHASE_SLOT = "P393";
const PREVIOUS_PHASE_SLOT = "P392";
const NEXT_PHASE_SLOT = "P394";
const READY_STATUS = "ready_for_trading_order_intent_disabled_regression";
const REQUIRED_FIXTURE_KEYS = [
  "signal_to_order_intent_disabled",
  "model_to_order_intent_disabled",
  "backtest_to_order_intent_disabled",
  "risk_blocks_order_intent",
  "shadow_order_intent_non_executable",
  "execution_order_submit_disabled",
];

export async function runTradingOrderIntentDisabledFixtures(options = {}) {
  const result = await buildTradingOrderIntentDisabledFixtures(options);
  if (options.write !== false) await writeTradingOrderIntentDisabledFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading order intent disabled fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingOrderIntentDisabledFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const firstTradeDisabledFixtures = await buildTradingFirstTradeDisabledFixtures({
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
    limitedLivePath: inputs.limited_live_path,
    fullAutoPath: inputs.full_auto_path,
    paperShadowPath: inputs.paper_shadow_path,
    executionEnginePath: inputs.execution_engine_path,
    modelImprovementPath: inputs.model_improvement_path,
    backtestValidationPath: inputs.backtest_validation_path,
    riskEnginePath: inputs.risk_engine_path,
    marketDataFeatureStorePath: inputs.market_data_feature_store_path,
    researchBacktestPaperPath: inputs.research_backtest_paper_path,
    routeSourcePaths: inputs.route_source_paths,
    schemaPath: inputs.first_trade_disabled_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const signalEngine = await readJsonSource(inputs.signal_engine_path);
  const modelImprovement = await readJsonSource(inputs.model_improvement_path);
  const backtestValidation = await readJsonSource(inputs.backtest_validation_path);
  const riskEngine = await readJsonSource(inputs.risk_engine_path);
  const paperShadow = await readJsonSource(inputs.paper_shadow_path);
  const executionEngine = await readJsonSource(inputs.execution_engine_path);
  const orderIntentAnchor = buildOrderIntentAnchor({ firstTradeDisabledFixtures });
  const orderIntentEvidenceRows = buildOrderIntentEvidenceRows({
    signalEngine: signalEngine.data,
    modelImprovement: modelImprovement.data,
    backtestValidation: backtestValidation.data,
    riskEngine: riskEngine.data,
    paperShadow: paperShadow.data,
    executionEngine: executionEngine.data,
  });
  const orderIntentFixtureRows = buildOrderIntentFixtureRows(orderIntentEvidenceRows);
  const orderIntentBoundary = buildOrderIntentBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    firstTradeDisabledFixtures,
    evidenceRows: orderIntentEvidenceRows,
    fixtureRows: orderIntentFixtureRows,
  });
  const orderIntentGateRows = buildOrderIntentGateRows({
    firstTradeDisabledFixtures,
    packageJson,
    platformOpsLedger,
    signalEngine,
    modelImprovement,
    backtestValidation,
    riskEngine,
    paperShadow,
    executionEngine,
    fixtureRows: orderIntentFixtureRows,
    boundary: orderIntentBoundary,
  });
  const validationItems = buildValidationItems({
    firstTradeDisabledFixtures,
    packageJson,
    platformOpsLedger,
    signalEngine,
    modelImprovement,
    backtestValidation,
    riskEngine,
    paperShadow,
    executionEngine,
    evidenceRows: orderIntentEvidenceRows,
    fixtureRows: orderIntentFixtureRows,
    gateRows: orderIntentGateRows,
    boundary: orderIntentBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    firstTradeDisabledFixtures,
    evidenceRows: orderIntentEvidenceRows,
    fixtureRows: orderIntentFixtureRows,
    gateRows: orderIntentGateRows,
    boundary: orderIntentBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_order_intent_disabled_fixtures_id: `trading-order-intent-disabled-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    order_intent_disabled_anchor: orderIntentAnchor,
    order_intent_disabled_evidence_rows: orderIntentEvidenceRows,
    order_intent_disabled_fixture_rows: orderIntentFixtureRows,
    order_intent_disabled_gate_rows: orderIntentGateRows,
    order_intent_disabled_boundary: orderIntentBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_order_intent_disabled_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    firstTradeDisabledFixtures,
    evidenceRows: orderIntentEvidenceRows,
    fixtureRows: orderIntentFixtureRows,
    gateRows: orderIntentGateRows,
    boundary: orderIntentBoundary,
    validation: result.validation,
  });
  result.summary.trading_order_intent_disabled_fixtures_id = result.trading_order_intent_disabled_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingOrderIntentDisabledFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-order-intent-disabled-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "order-intent-disabled-evidence-rows.json"), collectionEnvelope("trading-order-intent-disabled-evidence-rows.v1", "order_intent_disabled_evidence_rows", result.order_intent_disabled_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "order-intent-disabled-fixture-rows.json"), collectionEnvelope("trading-order-intent-disabled-fixture-rows.v1", "order_intent_disabled_fixture_rows", result.order_intent_disabled_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "order-intent-disabled-gate-rows.json"), collectionEnvelope("trading-order-intent-disabled-gate-rows.v1", "order_intent_disabled_gate_rows", result.order_intent_disabled_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "order-intent-disabled-boundary.json"), result.order_intent_disabled_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-order-intent-disabled-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingOrderIntentDisabledFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingOrderIntentDisabledFixtures(args);
    console.log(`Trading order intent disabled fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_order_intent_disabled_fixtures_status}`);
    console.log(`Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
    console.log(`Unsafe order intent signals: ${result.summary.unsafe_order_intent_signal_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildOrderIntentAnchor({ firstTradeDisabledFixtures }) {
  return {
    schema_version: "trading-order-intent-disabled-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_first_trade_disabled_fixtures_id: firstTradeDisabledFixtures.trading_first_trade_disabled_fixtures_id,
    source_first_trade_disabled_status: firstTradeDisabledFixtures.summary.trading_first_trade_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    required_fixture_keys: REQUIRED_FIXTURE_KEYS,
    source_hash: hashValue({
      id: firstTradeDisabledFixtures.trading_first_trade_disabled_fixtures_id,
      status: firstTradeDisabledFixtures.summary.trading_first_trade_disabled_fixtures_status,
      fixtures: REQUIRED_FIXTURE_KEYS,
    }),
  };
}

function buildOrderIntentEvidenceRows({ signalEngine, modelImprovement, backtestValidation, riskEngine, paperShadow, executionEngine }) {
  const shadowIntent = Array.isArray(paperShadow?.shadow_order_intents) ? paperShadow.shadow_order_intents[0] : null;
  const rows = [
    orderIntentEvidenceRow("signal_to_order_intent_disabled", "signal_engine", "order_intent_boundary", [
      observedCondition("signal.safety_boundary.order_intent_generated", valueAt(signalEngine, ["safety_boundary", "order_intent_generated"]), false),
      observedCondition("signal.order_intent_boundary.signal_to_order_intent_allowed", valueAt(signalEngine, ["order_intent_boundary", "signal_to_order_intent_allowed"]), false),
      observedCondition("signal.order_intent_boundary.generated_order_intent_count", valueAt(signalEngine, ["order_intent_boundary", "generated_order_intent_count"]), 0),
      observedCondition("signal.dashboard_api_stub.disabled_routes.to_order_intent", hasDisabledRoute(valueAt(signalEngine, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/signals/to-order-intent"), true),
    ]),
    orderIntentEvidenceRow("model_to_order_intent_disabled", "model_improvement", "safety_boundary", [
      observedCondition("model.safety_boundary.order_intent_generated", valueAt(modelImprovement, ["safety_boundary", "order_intent_generated"]), false),
      observedCondition("model.model_registry.order_intent_generation_allowed", allModelRecordsBlockOrderIntent(valueAt(modelImprovement, ["model_registry"])), true),
      observedCondition("model.auto_improvement_loop.forbidden_actions.generate_order_intent", hasArrayValue(valueAt(modelImprovement, ["auto_improvement_loop", "forbidden_actions"]), "generate_order_intent"), true),
      observedCondition("model.dashboard_api_stub.disabled_routes.to_order_intent", hasDisabledRoute(valueAt(modelImprovement, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/models/to-order-intent"), true),
    ]),
    orderIntentEvidenceRow("backtest_to_order_intent_disabled", "backtest_validation", "safety_boundary", [
      observedCondition("backtest.safety_boundary.order_intent_generated", valueAt(backtestValidation, ["safety_boundary", "order_intent_generated"]), false),
      observedCondition("backtest.safety_boundary.paper_order_generated", valueAt(backtestValidation, ["safety_boundary", "paper_order_generated"]), false),
      observedCondition("backtest.safety_boundary.live_execution_allowed", valueAt(backtestValidation, ["safety_boundary", "live_execution_allowed"]), false),
      observedCondition("backtest.dashboard_api_stub.disabled_routes.to_order_intent", hasDisabledRoute(valueAt(backtestValidation, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/backtests/to-order-intent"), true),
    ]),
    orderIntentEvidenceRow("risk_blocks_order_intent", "risk_engine", "safety_boundary", [
      observedCondition("risk.safety_boundary.pre_order_gate_only", valueAt(riskEngine, ["safety_boundary", "pre_order_gate_only"]), true),
      observedCondition("risk.safety_boundary.order_intent_generated", valueAt(riskEngine, ["safety_boundary", "order_intent_generated"]), false),
      observedCondition("risk.risk_result_policy.block_prevents_order_intent", valueAt(riskEngine, ["risk_result_policy", "block_prevents_order_intent"]), true),
      observedCondition("risk.dashboard_api_stub.disabled_routes.to_order_intent", hasDisabledRoute(valueAt(riskEngine, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/signals/to-order-intent"), true),
    ]),
    orderIntentEvidenceRow("shadow_order_intent_non_executable", "paper_shadow_live", "shadow_order_intents[0]", [
      observedCondition("shadow_order_intents[0].non_executable", valueAt(shadowIntent, ["non_executable"]), true),
      observedCondition("shadow_order_intents[0].review_only", valueAt(shadowIntent, ["review_only"]), true),
      observedCondition("shadow_order_intents[0].live_execution_allowed", valueAt(shadowIntent, ["live_execution_allowed"]), false),
      observedCondition("shadow_order_intents[0].market_order_allowed", valueAt(shadowIntent, ["market_order_allowed"]), false),
      observedCondition("no_order_shadow_mode.real_order_count", valueAt(paperShadow, ["no_order_shadow_mode", "real_order_count"]), 0),
    ]),
    orderIntentEvidenceRow("execution_order_submit_disabled", "execution_engine", "dashboard_api_stub", [
      observedCondition("execution.pre_trade_risk_gate.current_result", valueAt(executionEngine, ["pre_trade_risk_gate", "current_result"]), "block"),
      observedCondition("execution.order_controls.order_throttle.max_orders_per_day", valueAt(executionEngine, ["order_controls", "order_throttle", "max_orders_per_day"]), 0),
      observedCondition("execution.order_controls.order_throttle.blocks_order_submission", valueAt(executionEngine, ["order_controls", "order_throttle", "blocks_order_submission"]), true),
      observedCondition("execution.dashboard_api_stub.disabled_routes.submit", hasDisabledRoute(valueAt(executionEngine, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/orders/submit"), true),
      observedCondition("execution.safety_boundary.real_order_submitted", valueAt(executionEngine, ["safety_boundary", "real_order_submitted"]), false),
    ]),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "order_intent_disabled_evidence_hash"));
}

function orderIntentEvidenceRow(rowKey, artifactId, evidencePath, observedConditions) {
  const allConditionsPresent = observedConditions.every((condition) => condition.condition_present);
  const unsafeConditions = observedConditions.filter((condition) => condition.observed_value !== condition.expected_safe_value);
  return {
    schema_version: "trading-order-intent-disabled-evidence-row.v1",
    order_intent_disabled_evidence_row_id: `trading-order-intent-disabled.evidence.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    artifact_id: artifactId,
    evidence_path: evidencePath,
    observed_conditions: observedConditions,
    observed_condition_count: observedConditions.length,
    all_conditions_present: allConditionsPresent,
    unsafe_order_intent_signal_detected: unsafeConditions.length > 0,
    unsafe_condition_refs: unsafeConditions.map((condition) => condition.condition_path),
    evidence_status: allConditionsPresent && unsafeConditions.length === 0 ? "order_intent_disabled" : "unsafe_or_incomplete",
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

function buildOrderIntentFixtureRows(evidenceRows) {
  return REQUIRED_FIXTURE_KEYS.map((fixtureKey, index) => {
    const evidenceRow = evidenceRows.find((row) => row.row_key === fixtureKey);
    const row = {
      schema_version: "trading-order-intent-disabled-fixture-row.v1",
      order_intent_disabled_fixture_row_id: `trading-order-intent-disabled-fixtures.row.${fixtureKey}`,
      phase_slot: PHASE_SLOT,
      row_key: fixtureKey,
      expected_order_intent_generated: false,
      unsafe_order_intent_signal_detected: evidenceRow?.unsafe_order_intent_signal_detected === true,
      evidence_status: evidenceRow?.evidence_status ?? "missing",
      fixture_should_fail_when_order_intent_generated: true,
      fixture_should_fail_when_order_intent_route_enabled: true,
      fixture_should_fail_when_order_submit_enabled: true,
      fixture_status: evidenceRow?.evidence_status === "order_intent_disabled" ? "passed" : "failed",
      order_intent_generated_by_fixture: false,
      order_intent_route_enabled_by_fixture: false,
      order_submit_enabled_by_fixture: false,
      live_execution_allowed_by_fixture: false,
      command_execution_performed_by_fixture: false,
      artifact_write_performed_by_fixture: false,
      protected_action_executed_by_fixture: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "order_intent_disabled_fixture_hash");
  });
}

function buildOrderIntentBoundary({ generatedAt, writeRequested, firstTradeDisabledFixtures, evidenceRows, fixtureRows }) {
  const unsafeRows = evidenceRows.filter((row) => row.unsafe_order_intent_signal_detected);
  const sourceBoundary = firstTradeDisabledFixtures.summary;
  return {
    schema_version: "trading-order-intent-disabled-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    order_intent_disabled_artifact_write_requested: writeRequested,
    order_intent_disabled_fixture_execution_performed: false,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    order_intent_evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    unsafe_order_intent_signal_count: unsafeRows.length,
    unsafe_order_intent_signal_refs: unsafeRows.map((row) => row.row_key),
    order_intent_disabled_covered: evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "order_intent_disabled"),
    source_first_trade_disabled_status: sourceBoundary.trading_first_trade_disabled_fixtures_status,
    source_first_trade_disabled_ready: firstTradeDisabledFixtures.validation.valid && sourceBoundary.trading_first_trade_disabled_fixtures_status === "ready_for_trading_first_trade_disabled_regression",
    signal_to_order_intent_allowed: observedUnsafeCondition(evidenceRows, "signal.order_intent_boundary.signal_to_order_intent_allowed"),
    generated_order_intent_count_present: observedUnsafeCondition(evidenceRows, "signal.order_intent_boundary.generated_order_intent_count"),
    model_order_intent_generation_allowed: observedUnsafeCondition(evidenceRows, "model.model_registry.order_intent_generation_allowed"),
    model_generate_order_intent_forbidden_missing: observedUnsafeCondition(evidenceRows, "model.auto_improvement_loop.forbidden_actions.generate_order_intent"),
    backtest_order_intent_generated: observedUnsafeCondition(evidenceRows, "backtest.safety_boundary.order_intent_generated"),
    risk_order_intent_block_missing: observedUnsafeCondition(evidenceRows, "risk.risk_result_policy.block_prevents_order_intent"),
    shadow_order_intent_executable: observedUnsafeCondition(evidenceRows, "shadow_order_intents[0].non_executable") || observedUnsafeCondition(evidenceRows, "shadow_order_intents[0].review_only"),
    market_order_allowed: observedUnsafeCondition(evidenceRows, "shadow_order_intents[0].market_order_allowed"),
    order_intent_route_enabled: observedUnsafeCondition(evidenceRows, "signal.dashboard_api_stub.disabled_routes.to_order_intent") || observedUnsafeCondition(evidenceRows, "model.dashboard_api_stub.disabled_routes.to_order_intent") || observedUnsafeCondition(evidenceRows, "backtest.dashboard_api_stub.disabled_routes.to_order_intent") || observedUnsafeCondition(evidenceRows, "risk.dashboard_api_stub.disabled_routes.to_order_intent"),
    order_submit_route_enabled: observedUnsafeCondition(evidenceRows, "execution.dashboard_api_stub.disabled_routes.submit"),
    order_throttle_missing: observedUnsafeCondition(evidenceRows, "execution.order_controls.order_throttle.max_orders_per_day") || observedUnsafeCondition(evidenceRows, "execution.order_controls.order_throttle.blocks_order_submission"),
    pre_trade_risk_gate_not_blocking: observedUnsafeCondition(evidenceRows, "execution.pre_trade_risk_gate.current_result"),
    order_intent_generated: observedUnsafeCondition(evidenceRows, "signal.safety_boundary.order_intent_generated") || observedUnsafeCondition(evidenceRows, "model.safety_boundary.order_intent_generated") || observedUnsafeCondition(evidenceRows, "risk.safety_boundary.order_intent_generated") || sourceBoundary.order_intent_generated,
    paper_order_generated: observedUnsafeCondition(evidenceRows, "backtest.safety_boundary.paper_order_generated"),
    real_order_submitted: observedUnsafeCondition(evidenceRows, "execution.safety_boundary.real_order_submitted") || sourceBoundary.real_order_submitted,
    live_execution_allowed: observedUnsafeCondition(evidenceRows, "backtest.safety_boundary.live_execution_allowed") || observedUnsafeCondition(evidenceRows, "shadow_order_intents[0].live_execution_allowed") || sourceBoundary.live_execution_allowed,
    limited_live_enabled: sourceBoundary.limited_live_enabled,
    full_auto_enabled: sourceBoundary.full_auto_enabled,
    automatic_order_submission_allowed: sourceBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: sourceBoundary.live_order_submission_allowed,
    live_order_route_enabled: sourceBoundary.live_order_route_enabled,
    live_cancel_allowed: sourceBoundary.live_cancel_allowed,
    promotion_route_enabled: sourceBoundary.promotion_route_enabled,
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

function buildOrderIntentGateRows({ firstTradeDisabledFixtures, packageJson, platformOpsLedger, signalEngine, modelImprovement, backtestValidation, riskEngine, paperShadow, executionEngine, fixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p392_first_trade_disabled_fixtures_ready", "P392 first trade disabled fixtures source is ready.", firstTradeDisabledFixtures.validation.valid && firstTradeDisabledFixtures.summary.trading_first_trade_disabled_fixtures_status === "ready_for_trading_first_trade_disabled_regression"),
    gateRow("platform_package_script_registered", "package.json registers the P393 trading order intent disabled fixtures command.", typeof scripts["trading:order-intent-disabled-fixtures"] === "string" && scripts["trading:order-intent-disabled-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P393 trading order intent disabled fixtures command.", validateScript.includes("npm run trading:order-intent-disabled-fixtures -- --check")),
    gateRow("p393_ledger_acceptance_declared", "P393 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P393: `trading:order-intent-disabled-fixtures`")),
    gateRow("order_intent_sources_readable", "All order-intent source artifacts are readable.", signalEngine.available && modelImprovement.available && backtestValidation.available && riskEngine.available && paperShadow.available && executionEngine.available),
    gateRow("required_order_intent_fixtures_declared", "All required order-intent disabled fixtures are declared.", REQUIRED_FIXTURE_KEYS.every((fixtureKey) => fixtureRows.some((row) => row.row_key === fixtureKey)) && fixtureRows.length === REQUIRED_FIXTURE_KEYS.length),
    gateRow("order_intent_generation_disabled", "Signals, models, backtests, and risk do not generate executable order intents.", !boundary.signal_to_order_intent_allowed && !boundary.generated_order_intent_count_present && !boundary.model_order_intent_generation_allowed && !boundary.backtest_order_intent_generated && !boundary.order_intent_generated && !boundary.paper_order_generated),
    gateRow("order_intent_routes_disabled", "Signal/model/backtest/risk order-intent routes and execution submit routes remain disabled.", !boundary.order_intent_route_enabled && !boundary.order_submit_route_enabled),
    gateRow("shadow_intents_non_executable", "Shadow order intents remain review-only, non-executable, and cannot become market orders.", !boundary.shadow_order_intent_executable && !boundary.market_order_allowed && !boundary.live_execution_allowed),
    gateRow("execution_submit_blocked", "Execution submit path is blocked by pre-trade risk gate and zero-order throttle.", !boundary.pre_trade_risk_gate_not_blocking && !boundary.order_throttle_missing && !boundary.real_order_submitted),
    gateRow("no_trading_or_artifact_mutation", "Order-intent disabled fixtures do not execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "order_intent_disabled_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-order-intent-disabled-gate-row.v1",
    order_intent_disabled_gate_row_id: `trading-order-intent-disabled-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    order_intent_generated_by_gate: false,
    order_intent_route_enabled_by_gate: false,
    order_submit_enabled_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ firstTradeDisabledFixtures, packageJson, platformOpsLedger, signalEngine, modelImprovement, backtestValidation, riskEngine, paperShadow, executionEngine, evidenceRows, fixtureRows, gateRows, boundary }) {
  return [
    validationItem("source.first_trade_disabled_fixtures", "p392_first_trade_disabled_fixtures_ready", firstTradeDisabledFixtures.validation.valid && firstTradeDisabledFixtures.summary.trading_first_trade_disabled_fixtures_status === "ready_for_trading_first_trade_disabled_regression", "P392 first trade disabled fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P393 order intent disabled fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.order_intent_sources", "order_intent_sources_available", signalEngine.available && modelImprovement.available && backtestValidation.available && riskEngine.available && paperShadow.available && executionEngine.available, "Order-intent source artifacts are readable."),
    validationItem("order_intent_disabled_evidence_rows", "order_intent_evidence_ready", evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "order_intent_disabled"), "Order-intent evidence rows must show disabled/non-executable state."),
    validationItem("order_intent_disabled_fixture_rows", "required_order_intent_fixtures_pass", fixtureRows.length === REQUIRED_FIXTURE_KEYS.length && fixtureRows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_order_intent_generated && row.fixture_should_fail_when_order_intent_route_enabled), "All order-intent disabled fixtures must pass."),
    validationItem("order_intent_disabled_gate_rows", "order_intent_disabled_gates_ready", gateRows.length >= 11 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P393 order-intent disabled gates are ready."),
    validationItem("boundary.order_intent_generation", "order_intent_generation_disabled", boundary.order_intent_disabled_covered && !boundary.signal_to_order_intent_allowed && !boundary.generated_order_intent_count_present && !boundary.model_order_intent_generation_allowed && !boundary.backtest_order_intent_generated && !boundary.order_intent_generated && !boundary.paper_order_generated, "Order intent generation remains disabled."),
    validationItem("boundary.routes", "order_intent_routes_disabled", !boundary.order_intent_route_enabled && !boundary.order_submit_route_enabled, "Order-intent and order-submit routes remain disabled."),
    validationItem("boundary.shadow_intents", "shadow_intents_non_executable", !boundary.shadow_order_intent_executable && !boundary.market_order_allowed && !boundary.live_execution_allowed, "Shadow order intents remain non-executable and cannot become market/live orders."),
    validationItem("boundary.execution_submit", "execution_submit_blocked", !boundary.pre_trade_risk_gate_not_blocking && !boundary.order_throttle_missing && !boundary.real_order_submitted, "Execution submit path is blocked."),
    validationItem("boundary.no_mutation", "no_trading_or_artifact_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed, "P393 order-intent disabled fixtures perform no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ firstTradeDisabledFixtures, evidenceRows, fixtureRows, gateRows, boundary, validation }) {
  return {
    trading_order_intent_disabled_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_first_trade_disabled_status: firstTradeDisabledFixtures.summary.trading_first_trade_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    passed_fixture_count: fixtureRows.filter((row) => row.fixture_status === "passed").length,
    failed_fixture_count: fixtureRows.filter((row) => row.fixture_status !== "passed").length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    unsafe_order_intent_signal_count: boundary.unsafe_order_intent_signal_count,
    order_intent_disabled_covered: boundary.order_intent_disabled_covered,
    signal_to_order_intent_allowed: boundary.signal_to_order_intent_allowed,
    generated_order_intent_count_present: boundary.generated_order_intent_count_present,
    model_order_intent_generation_allowed: boundary.model_order_intent_generation_allowed,
    model_generate_order_intent_forbidden_missing: boundary.model_generate_order_intent_forbidden_missing,
    backtest_order_intent_generated: boundary.backtest_order_intent_generated,
    risk_order_intent_block_missing: boundary.risk_order_intent_block_missing,
    shadow_order_intent_executable: boundary.shadow_order_intent_executable,
    market_order_allowed: boundary.market_order_allowed,
    order_intent_route_enabled: boundary.order_intent_route_enabled,
    order_submit_route_enabled: boundary.order_submit_route_enabled,
    order_throttle_missing: boundary.order_throttle_missing,
    pre_trade_risk_gate_not_blocking: boundary.pre_trade_risk_gate_not_blocking,
    order_intent_generated: boundary.order_intent_generated,
    paper_order_generated: boundary.paper_order_generated,
    real_order_submitted: boundary.real_order_submitted,
    live_execution_allowed: boundary.live_execution_allowed,
    limited_live_enabled: boundary.limited_live_enabled,
    full_auto_enabled: boundary.full_auto_enabled,
    automatic_order_submission_allowed: boundary.automatic_order_submission_allowed,
    live_order_submission_allowed: boundary.live_order_submission_allowed,
    live_order_route_enabled: boundary.live_order_route_enabled,
    live_cancel_allowed: boundary.live_cancel_allowed,
    promotion_route_enabled: boundary.promotion_route_enabled,
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
    "# Trading Order Intent Disabled Fixtures",
    "",
    `Status: ${result.summary.trading_order_intent_disabled_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source first trade disabled: ${result.summary.source_first_trade_disabled_status}`,
    `Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`,
    `Unsafe order intent signals: ${result.summary.unsafe_order_intent_signal_count}`,
    "",
    "## Fixtures",
    "",
    ...result.order_intent_disabled_fixture_rows.map((row) => `- ${row.row_key}: ${row.fixture_status}`),
    "",
    "## Gates",
    "",
    ...result.order_intent_disabled_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_OUT_DIR, routeSourcePaths: [] };
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
  console.log(`Usage: node scripts/trading-order-intent-disabled-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_OUT_DIR}
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
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  const routeSourcePaths = options.routeSourcePaths ?? options.routeSources ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.routeSourcePaths;
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.platformOpsLedgerPath),
    release_check_receipt_closeout_schema_path: path.resolve(options.releaseCheckReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.releaseCheckReceiptCloseoutSchemaPath),
    safety_regression_fixtures_schema_path: path.resolve(options.safetyRegressionFixturesSchemaPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.safetyRegressionFixturesSchemaPath),
    route_inventory_fixtures_schema_path: path.resolve(options.routeInventoryFixturesSchemaPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.routeInventoryFixturesSchemaPath),
    approval_absence_fixtures_schema_path: path.resolve(options.approvalAbsenceFixturesSchemaPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.approvalAbsenceFixturesSchemaPath),
    live_adapter_disabled_fixtures_schema_path: path.resolve(options.liveAdapterDisabledFixturesSchemaPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.liveAdapterDisabledFixturesSchemaPath),
    credential_lookup_disabled_fixtures_schema_path: path.resolve(options.credentialLookupDisabledFixturesSchemaPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.credentialLookupDisabledFixturesSchemaPath),
    broker_write_disabled_fixtures_schema_path: path.resolve(options.brokerWriteDisabledFixturesSchemaPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.brokerWriteDisabledFixturesSchemaPath),
    exchange_write_disabled_fixtures_schema_path: path.resolve(options.exchangeWriteDisabledFixturesSchemaPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.exchangeWriteDisabledFixturesSchemaPath),
    safety_boundary_fixtures_schema_path: path.resolve(options.safetyBoundaryFixturesSchemaPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.safetyBoundaryFixturesSchemaPath),
    manual_resume_disabled_fixtures_schema_path: path.resolve(options.manualResumeDisabledFixturesSchemaPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.manualResumeDisabledFixturesSchemaPath),
    risk_override_disabled_fixtures_schema_path: path.resolve(options.riskOverrideDisabledFixturesSchemaPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.riskOverrideDisabledFixturesSchemaPath),
    promotion_disabled_fixtures_schema_path: path.resolve(options.promotionDisabledFixturesSchemaPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.promotionDisabledFixturesSchemaPath),
    first_trade_disabled_fixtures_schema_path: path.resolve(options.firstTradeDisabledFixturesSchemaPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.firstTradeDisabledFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.executionEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.modelImprovementPath),
    backtest_validation_path: path.resolve(options.backtestValidationPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.backtestValidationPath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.riskEnginePath),
    signal_engine_path: path.resolve(options.signalEnginePath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.signalEnginePath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.marketDataFeatureStorePath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.researchBacktestPaperPath),
    route_source_paths: routeSourcePaths.map((sourcePath) => path.resolve(sourcePath)),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_ORDER_INTENT_DISABLED_FIXTURES_INPUTS.schemaPath),
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

function allModelRecordsBlockOrderIntent(modelRegistry) {
  const records = Array.isArray(modelRegistry) ? modelRegistry : modelRegistry?.models;
  return Array.isArray(records) && records.length > 0 && records.every((record) => record.order_intent_generation_allowed === false);
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `trading-order-intent-disabled-fixtures.${slugify(itemPath)}.${checkId}`,
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
