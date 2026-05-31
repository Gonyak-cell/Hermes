import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS,
  buildTradingShortSellingDisabledFixtures,
} from "./trading-short-selling-disabled-fixtures.mjs";

export const DEFAULT_TRADING_ORDER_FREQUENCY_THROTTLE_FIXTURES_OUT_DIR = "artifacts/trading-order-frequency-throttle-fixtures/latest";
export const DEFAULT_TRADING_ORDER_FREQUENCY_THROTTLE_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS,
  shortSellingDisabledFixturesSchemaPath: DEFAULT_TRADING_SHORT_SELLING_DISABLED_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-order-frequency-throttle-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-order-frequency-throttle-fixtures.v1";
const CAPABILITY_ID = "trading.order_frequency_throttle_fixtures";
const PHASE_SLOT = "P397";
const PREVIOUS_PHASE_SLOT = "P396";
const NEXT_PHASE_SLOT = "P398";
const READY_STATUS = "ready_for_trading_order_frequency_throttle_regression";
const REQUIRED_FIXTURE_KEYS = [
  "signal_order_intent_generation_disabled",
  "risk_order_frequency_throttle_blocks",
  "execution_order_throttle_blocks_submission",
  "limited_live_daily_order_cap_blocks",
  "shadow_order_intents_non_executable",
  "full_auto_order_generation_disabled",
];

export async function runTradingOrderFrequencyThrottleFixtures(options = {}) {
  const result = await buildTradingOrderFrequencyThrottleFixtures(options);
  if (options.write !== false) await writeTradingOrderFrequencyThrottleFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading order frequency throttle fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingOrderFrequencyThrottleFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_ORDER_FREQUENCY_THROTTLE_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const shortSellingDisabledFixtures = await buildTradingShortSellingDisabledFixtures({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    limitedLivePath: inputs.limited_live_path,
    fullAutoPath: inputs.full_auto_path,
    paperShadowPath: inputs.paper_shadow_path,
    executionEnginePath: inputs.execution_engine_path,
    riskEnginePath: inputs.risk_engine_path,
    signalEnginePath: inputs.signal_engine_path,
    schemaPath: inputs.short_selling_disabled_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const signalEngine = await readJsonSource(inputs.signal_engine_path);
  const riskEngine = await readJsonSource(inputs.risk_engine_path);
  const executionEngine = await readJsonSource(inputs.execution_engine_path);
  const paperShadow = await readJsonSource(inputs.paper_shadow_path);
  const limitedLive = await readJsonSource(inputs.limited_live_path);
  const fullAuto = await readJsonSource(inputs.full_auto_path);
  const orderFrequencyAnchor = buildOrderFrequencyAnchor({ shortSellingDisabledFixtures });
  const orderFrequencyEvidenceRows = buildOrderFrequencyEvidenceRows({
    signalEngine: signalEngine.data,
    riskEngine: riskEngine.data,
    executionEngine: executionEngine.data,
    paperShadow: paperShadow.data,
    limitedLive: limitedLive.data,
    fullAuto: fullAuto.data,
  });
  const orderFrequencyFixtureRows = buildOrderFrequencyFixtureRows(orderFrequencyEvidenceRows);
  const orderFrequencyBoundary = buildOrderFrequencyBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    shortSellingDisabledFixtures,
    evidenceRows: orderFrequencyEvidenceRows,
    fixtureRows: orderFrequencyFixtureRows,
  });
  const orderFrequencyGateRows = buildOrderFrequencyGateRows({
    shortSellingDisabledFixtures,
    packageJson,
    platformOpsLedger,
    signalEngine,
    riskEngine,
    executionEngine,
    paperShadow,
    limitedLive,
    fullAuto,
    fixtureRows: orderFrequencyFixtureRows,
    boundary: orderFrequencyBoundary,
  });
  const validationItems = buildValidationItems({
    shortSellingDisabledFixtures,
    packageJson,
    platformOpsLedger,
    signalEngine,
    riskEngine,
    executionEngine,
    paperShadow,
    limitedLive,
    fullAuto,
    evidenceRows: orderFrequencyEvidenceRows,
    fixtureRows: orderFrequencyFixtureRows,
    gateRows: orderFrequencyGateRows,
    boundary: orderFrequencyBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    shortSellingDisabledFixtures,
    evidenceRows: orderFrequencyEvidenceRows,
    fixtureRows: orderFrequencyFixtureRows,
    gateRows: orderFrequencyGateRows,
    boundary: orderFrequencyBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_order_frequency_throttle_fixtures_id: `trading-order-frequency-throttle-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    order_frequency_throttle_anchor: orderFrequencyAnchor,
    order_frequency_throttle_evidence_rows: orderFrequencyEvidenceRows,
    order_frequency_throttle_fixture_rows: orderFrequencyFixtureRows,
    order_frequency_throttle_gate_rows: orderFrequencyGateRows,
    order_frequency_throttle_boundary: orderFrequencyBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_order_frequency_throttle_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    shortSellingDisabledFixtures,
    evidenceRows: orderFrequencyEvidenceRows,
    fixtureRows: orderFrequencyFixtureRows,
    gateRows: orderFrequencyGateRows,
    boundary: orderFrequencyBoundary,
    validation: result.validation,
  });
  result.summary.trading_order_frequency_throttle_fixtures_id = result.trading_order_frequency_throttle_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingOrderFrequencyThrottleFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-order-frequency-throttle-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "order-frequency-throttle-evidence-rows.json"), collectionEnvelope("trading-order-frequency-throttle-evidence-rows.v1", "order_frequency_throttle_evidence_rows", result.order_frequency_throttle_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "order-frequency-throttle-fixture-rows.json"), collectionEnvelope("trading-order-frequency-throttle-fixture-rows.v1", "order_frequency_throttle_fixture_rows", result.order_frequency_throttle_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "order-frequency-throttle-gate-rows.json"), collectionEnvelope("trading-order-frequency-throttle-gate-rows.v1", "order_frequency_throttle_gate_rows", result.order_frequency_throttle_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "order-frequency-throttle-boundary.json"), result.order_frequency_throttle_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-order-frequency-throttle-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingOrderFrequencyThrottleFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingOrderFrequencyThrottleFixtures(args);
    console.log(`Trading order frequency throttle fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_order_frequency_throttle_fixtures_status}`);
    console.log(`Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
    console.log(`Unsafe order frequency signals: ${result.summary.unsafe_order_frequency_signal_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildOrderFrequencyAnchor({ shortSellingDisabledFixtures }) {
  return {
    schema_version: "trading-order-frequency-throttle-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_short_selling_disabled_fixtures_id: shortSellingDisabledFixtures.trading_short_selling_disabled_fixtures_id,
    source_short_selling_disabled_status: shortSellingDisabledFixtures.summary.trading_short_selling_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    required_fixture_keys: REQUIRED_FIXTURE_KEYS,
    source_hash: hashValue({
      id: shortSellingDisabledFixtures.trading_short_selling_disabled_fixtures_id,
      status: shortSellingDisabledFixtures.summary.trading_short_selling_disabled_fixtures_status,
      fixtures: REQUIRED_FIXTURE_KEYS,
    }),
  };
}

function buildOrderFrequencyEvidenceRows({ signalEngine, riskEngine, executionEngine, paperShadow, limitedLive, fullAuto }) {
  const riskThrottle = valueAt(riskEngine, ["risk_guards", "order_frequency_throttle"]);
  const executionThrottle = valueAt(executionEngine, ["order_controls", "order_throttle"]);
  const limitedDailyCap = valueAt(limitedLive, ["order_caps", "daily_order_count_cap"]);
  const fullAutoResolver = valueAt(fullAuto, ["allocators", "multi_strategy_conflict_resolver"]);
  const rows = [
    orderFrequencyEvidenceRow("signal_order_intent_generation_disabled", "signal_engine", "safety_boundary", [
      observedCondition("signal.safety_boundary.signal_only", valueAt(signalEngine, ["safety_boundary", "signal_only"]), true),
      observedCondition("signal.safety_boundary.order_intent_generated", valueAt(signalEngine, ["safety_boundary", "order_intent_generated"]), false),
      observedCondition("signal.safety_boundary.live_execution_allowed", valueAt(signalEngine, ["safety_boundary", "live_execution_allowed"]), false),
      observedCondition("signal.dashboard_api_stub.signals_to_order_intent_disabled", hasDisabledRoute(valueAt(signalEngine, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/signals/to-order-intent"), true),
    ]),
    orderFrequencyEvidenceRow("risk_order_frequency_throttle_blocks", "risk_engine", "risk_guards.order_frequency_throttle", [
      observedCondition("risk.risk_guards.order_frequency_throttle.max_orders_per_day", valueAt(riskThrottle, ["max_orders_per_day"]), 0),
      observedCondition("risk.risk_guards.order_frequency_throttle.current_orders_today", valueAt(riskThrottle, ["current_orders_today"]), 0),
      observedCondition("risk.risk_guards.order_frequency_throttle.result", valueAt(riskThrottle, ["result"]), "block"),
      observedCondition("risk.risk_guards.order_frequency_throttle.blocks_order_intent", valueAt(riskThrottle, ["blocks_order_intent"]), true),
      observedCondition("risk.risk_check_artifacts[0].checks.order_frequency_throttle.status", riskCheckStatus(riskEngine, "order_frequency_throttle"), "block"),
    ]),
    orderFrequencyEvidenceRow("execution_order_throttle_blocks_submission", "execution_engine", "order_controls.order_throttle", [
      observedCondition("execution.order_controls.order_throttle.max_orders_per_day", valueAt(executionThrottle, ["max_orders_per_day"]), 0),
      observedCondition("execution.order_controls.order_throttle.current_orders_today", valueAt(executionThrottle, ["current_orders_today"]), 0),
      observedCondition("execution.order_controls.order_throttle.blocks_order_submission", valueAt(executionThrottle, ["blocks_order_submission"]), true),
      observedCondition("execution.dashboard_api_stub.orders_submit_disabled", hasDisabledRoute(valueAt(executionEngine, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/orders/submit"), true),
    ]),
    orderFrequencyEvidenceRow("limited_live_daily_order_cap_blocks", "limited_live_governance", "order_caps.daily_order_count_cap", [
      observedCondition("limited_live.order_caps.daily_order_count_cap.max_orders_per_day", valueAt(limitedDailyCap, ["max_orders_per_day"]), 0),
      observedCondition("limited_live.order_caps.daily_order_count_cap.current_orders_today", valueAt(limitedDailyCap, ["current_orders_today"]), 0),
      observedCondition("limited_live.order_caps.daily_order_count_cap.enforced", valueAt(limitedDailyCap, ["enforced"]), true),
      observedCondition("limited_live.order_caps.daily_order_count_cap.blocks_submission", valueAt(limitedDailyCap, ["blocks_submission"]), true),
      observedCondition("limited_live.order_caps.order_submission_allowed", valueAt(limitedLive, ["order_caps", "order_submission_allowed"]), false),
    ]),
    orderFrequencyEvidenceRow("shadow_order_intents_non_executable", "paper_shadow_live", "shadow_order_intents", [
      observedCondition("paper_shadow.safety_boundary.shadow_order_intent_non_executable", valueAt(paperShadow, ["safety_boundary", "shadow_order_intent_non_executable"]), true),
      observedCondition("paper_shadow.shadow_order_intents.non_executable", shadowIntentsNonExecutable(valueAt(paperShadow, ["shadow_order_intents"])), true),
      observedCondition("paper_shadow.shadow_order_intents.review_only", shadowIntentsReviewOnly(valueAt(paperShadow, ["shadow_order_intents"])), true),
      observedCondition("paper_shadow.no_order_shadow_mode.real_order_count", valueAt(paperShadow, ["no_order_shadow_mode", "real_order_count"]), 0),
    ]),
    orderFrequencyEvidenceRow("full_auto_order_generation_disabled", "full_auto_governance", "allocators.multi_strategy_conflict_resolver", [
      observedCondition("full_auto.allocators.multi_strategy_conflict_resolver.order_generation_allowed", valueAt(fullAutoResolver, ["order_generation_allowed"]), false),
      observedCondition("full_auto.safety_boundary.automatic_order_submission_allowed", valueAt(fullAuto, ["safety_boundary", "automatic_order_submission_allowed"]), false),
      observedCondition("full_auto.safety_boundary.live_order_submission_allowed", valueAt(fullAuto, ["safety_boundary", "live_order_submission_allowed"]), false),
      observedCondition("full_auto.dashboard_api_stub.full_auto_orders_disabled", hasDisabledRoute(valueAt(fullAuto, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/full-auto/orders"), true),
      observedCondition("full_auto.dashboard_api_stub.orders_disabled", hasDisabledRoute(valueAt(fullAuto, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/orders"), true),
    ]),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "order_frequency_throttle_evidence_hash"));
}

function orderFrequencyEvidenceRow(rowKey, artifactId, evidencePath, observedConditions) {
  const allConditionsPresent = observedConditions.every((condition) => condition.condition_present);
  const unsafeConditions = observedConditions.filter((condition) => condition.observed_value !== condition.expected_safe_value);
  return {
    schema_version: "trading-order-frequency-throttle-evidence-row.v1",
    order_frequency_throttle_evidence_row_id: `trading-order-frequency-throttle.evidence.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    artifact_id: artifactId,
    evidence_path: evidencePath,
    observed_conditions: observedConditions,
    observed_condition_count: observedConditions.length,
    all_conditions_present: allConditionsPresent,
    unsafe_order_frequency_signal_detected: unsafeConditions.length > 0,
    unsafe_condition_refs: unsafeConditions.map((condition) => condition.condition_path),
    evidence_status: allConditionsPresent && unsafeConditions.length === 0 ? "order_frequency_throttled" : "unsafe_or_incomplete",
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

function buildOrderFrequencyFixtureRows(evidenceRows) {
  return REQUIRED_FIXTURE_KEYS.map((fixtureKey, index) => {
    const evidenceRow = evidenceRows.find((row) => row.row_key === fixtureKey);
    const row = {
      schema_version: "trading-order-frequency-throttle-fixture-row.v1",
      order_frequency_throttle_fixture_row_id: `trading-order-frequency-throttle-fixtures.row.${fixtureKey}`,
      phase_slot: PHASE_SLOT,
      row_key: fixtureKey,
      expected_max_orders_per_day: 0,
      expected_current_orders_today: 0,
      unsafe_order_frequency_signal_detected: evidenceRow?.unsafe_order_frequency_signal_detected === true,
      evidence_status: evidenceRow?.evidence_status ?? "missing",
      fixture_should_fail_when_order_frequency_enabled: true,
      fixture_should_fail_when_order_intent_generated: true,
      fixture_should_fail_when_order_submit_enabled: true,
      fixture_status: evidenceRow?.evidence_status === "order_frequency_throttled" ? "passed" : "failed",
      order_frequency_enabled_by_fixture: false,
      order_intent_generated_by_fixture: false,
      order_submit_enabled_by_fixture: false,
      live_execution_allowed_by_fixture: false,
      command_execution_performed_by_fixture: false,
      artifact_write_performed_by_fixture: false,
      protected_action_executed_by_fixture: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "order_frequency_throttle_fixture_hash");
  });
}

function buildOrderFrequencyBoundary({ generatedAt, writeRequested, shortSellingDisabledFixtures, evidenceRows, fixtureRows }) {
  const unsafeRows = evidenceRows.filter((row) => row.unsafe_order_frequency_signal_detected);
  const sourceBoundary = shortSellingDisabledFixtures.summary;
  return {
    schema_version: "trading-order-frequency-throttle-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    order_frequency_throttle_artifact_write_requested: writeRequested,
    order_frequency_throttle_fixture_execution_performed: false,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    order_frequency_evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    unsafe_order_frequency_signal_count: unsafeRows.length,
    unsafe_order_frequency_signal_refs: unsafeRows.map((row) => row.row_key),
    order_frequency_throttle_covered: evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "order_frequency_throttled"),
    source_short_selling_disabled_status: sourceBoundary.trading_short_selling_disabled_fixtures_status,
    source_short_selling_disabled_ready: shortSellingDisabledFixtures.validation.valid && sourceBoundary.trading_short_selling_disabled_fixtures_status === "ready_for_trading_short_selling_disabled_regression",
    signal_order_intent_generated: observedUnsafeCondition(evidenceRows, "signal.safety_boundary.order_intent_generated"),
    signal_live_execution_allowed: observedUnsafeCondition(evidenceRows, "signal.safety_boundary.live_execution_allowed"),
    signal_to_order_intent_route_enabled: observedUnsafeCondition(evidenceRows, "signal.dashboard_api_stub.signals_to_order_intent_disabled"),
    risk_order_frequency_max_not_zero: observedUnsafeCondition(evidenceRows, "risk.risk_guards.order_frequency_throttle.max_orders_per_day"),
    risk_order_frequency_current_nonzero: observedUnsafeCondition(evidenceRows, "risk.risk_guards.order_frequency_throttle.current_orders_today"),
    risk_order_frequency_not_blocking: observedUnsafeCondition(evidenceRows, "risk.risk_guards.order_frequency_throttle.result"),
    risk_order_frequency_not_blocking_order_intent: observedUnsafeCondition(evidenceRows, "risk.risk_guards.order_frequency_throttle.blocks_order_intent"),
    risk_order_frequency_check_not_blocking: observedUnsafeCondition(evidenceRows, "risk.risk_check_artifacts[0].checks.order_frequency_throttle.status"),
    execution_order_frequency_max_not_zero: observedUnsafeCondition(evidenceRows, "execution.order_controls.order_throttle.max_orders_per_day"),
    execution_current_orders_nonzero: observedUnsafeCondition(evidenceRows, "execution.order_controls.order_throttle.current_orders_today"),
    execution_order_throttle_not_blocking: observedUnsafeCondition(evidenceRows, "execution.order_controls.order_throttle.blocks_order_submission"),
    execution_submit_route_enabled: observedUnsafeCondition(evidenceRows, "execution.dashboard_api_stub.orders_submit_disabled"),
    limited_live_order_cap_max_not_zero: observedUnsafeCondition(evidenceRows, "limited_live.order_caps.daily_order_count_cap.max_orders_per_day"),
    limited_live_current_orders_nonzero: observedUnsafeCondition(evidenceRows, "limited_live.order_caps.daily_order_count_cap.current_orders_today"),
    limited_live_order_cap_not_enforced: observedUnsafeCondition(evidenceRows, "limited_live.order_caps.daily_order_count_cap.enforced"),
    limited_live_order_cap_not_blocking: observedUnsafeCondition(evidenceRows, "limited_live.order_caps.daily_order_count_cap.blocks_submission"),
    limited_live_order_submission_allowed: observedUnsafeCondition(evidenceRows, "limited_live.order_caps.order_submission_allowed"),
    shadow_order_intents_executable: observedUnsafeCondition(evidenceRows, "paper_shadow.safety_boundary.shadow_order_intent_non_executable") || observedUnsafeCondition(evidenceRows, "paper_shadow.shadow_order_intents.non_executable") || observedUnsafeCondition(evidenceRows, "paper_shadow.shadow_order_intents.review_only"),
    shadow_real_order_count_nonzero: observedUnsafeCondition(evidenceRows, "paper_shadow.no_order_shadow_mode.real_order_count"),
    full_auto_order_generation_allowed: observedUnsafeCondition(evidenceRows, "full_auto.allocators.multi_strategy_conflict_resolver.order_generation_allowed"),
    full_auto_automatic_order_submission_allowed: observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.automatic_order_submission_allowed"),
    full_auto_live_order_submission_allowed: observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.live_order_submission_allowed"),
    full_auto_orders_route_enabled: observedUnsafeCondition(evidenceRows, "full_auto.dashboard_api_stub.full_auto_orders_disabled") || observedUnsafeCondition(evidenceRows, "full_auto.dashboard_api_stub.orders_disabled"),
    short_selling_enabled: sourceBoundary.short_selling_enabled,
    market_order_allowed: sourceBoundary.market_order_allowed,
    order_submit_route_enabled_source: sourceBoundary.order_submit_route_enabled,
    order_intent_generated: sourceBoundary.order_intent_generated || observedUnsafeCondition(evidenceRows, "signal.safety_boundary.order_intent_generated"),
    real_order_submitted: sourceBoundary.real_order_submitted || observedUnsafeCondition(evidenceRows, "paper_shadow.no_order_shadow_mode.real_order_count"),
    live_execution_allowed: sourceBoundary.live_execution_allowed || observedUnsafeCondition(evidenceRows, "signal.safety_boundary.live_execution_allowed") || observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.live_order_submission_allowed"),
    limited_live_enabled: sourceBoundary.limited_live_enabled,
    full_auto_enabled: sourceBoundary.full_auto_enabled,
    automatic_order_submission_allowed: sourceBoundary.automatic_order_submission_allowed || observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.automatic_order_submission_allowed"),
    live_order_submission_allowed: sourceBoundary.live_order_submission_allowed || observedUnsafeCondition(evidenceRows, "limited_live.order_caps.order_submission_allowed") || observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.live_order_submission_allowed"),
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

function buildOrderFrequencyGateRows({ shortSellingDisabledFixtures, packageJson, platformOpsLedger, signalEngine, riskEngine, executionEngine, paperShadow, limitedLive, fullAuto, fixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p396_short_selling_disabled_fixtures_ready", "P396 short-selling disabled fixtures source is ready.", shortSellingDisabledFixtures.validation.valid && shortSellingDisabledFixtures.summary.trading_short_selling_disabled_fixtures_status === "ready_for_trading_short_selling_disabled_regression"),
    gateRow("platform_package_script_registered", "package.json registers the P397 trading order frequency throttle fixtures command.", typeof scripts["trading:order-frequency-throttle-fixtures"] === "string" && scripts["trading:order-frequency-throttle-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P397 trading order frequency throttle fixtures command.", validateScript.includes("npm run trading:order-frequency-throttle-fixtures -- --check")),
    gateRow("p397_ledger_acceptance_declared", "P397 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P397: `trading:order-frequency-throttle-fixtures`")),
    gateRow("order_frequency_sources_readable", "All order-frequency source artifacts are readable.", signalEngine.available && riskEngine.available && executionEngine.available && paperShadow.available && limitedLive.available && fullAuto.available),
    gateRow("required_order_frequency_fixtures_declared", "All required order-frequency throttle fixtures are declared.", REQUIRED_FIXTURE_KEYS.every((fixtureKey) => fixtureRows.some((row) => row.row_key === fixtureKey)) && fixtureRows.length === REQUIRED_FIXTURE_KEYS.length),
    gateRow("signal_order_intent_generation_disabled", "Signal engine cannot generate order intents or route signal-to-order-intent conversion.", !boundary.signal_order_intent_generated && !boundary.signal_live_execution_allowed && !boundary.signal_to_order_intent_route_enabled),
    gateRow("risk_order_frequency_throttle_blocks", "Risk order-frequency throttle keeps the per-day order cap at zero and blocks order intents.", !boundary.risk_order_frequency_max_not_zero && !boundary.risk_order_frequency_current_nonzero && !boundary.risk_order_frequency_not_blocking && !boundary.risk_order_frequency_not_blocking_order_intent && !boundary.risk_order_frequency_check_not_blocking),
    gateRow("execution_order_throttle_blocks_submission", "Execution order throttle keeps order submission blocked and submit routes disabled.", !boundary.execution_order_frequency_max_not_zero && !boundary.execution_current_orders_nonzero && !boundary.execution_order_throttle_not_blocking && !boundary.execution_submit_route_enabled),
    gateRow("limited_live_daily_order_cap_blocks", "Limited-live daily order cap keeps submission blocked with zero order capacity.", !boundary.limited_live_order_cap_max_not_zero && !boundary.limited_live_current_orders_nonzero && !boundary.limited_live_order_cap_not_enforced && !boundary.limited_live_order_cap_not_blocking && !boundary.limited_live_order_submission_allowed),
    gateRow("shadow_and_full_auto_order_generation_disabled", "Shadow intents and full-auto paths remain non-executable and unable to generate orders.", !boundary.shadow_order_intents_executable && !boundary.shadow_real_order_count_nonzero && !boundary.full_auto_order_generation_allowed && !boundary.full_auto_automatic_order_submission_allowed && !boundary.full_auto_live_order_submission_allowed && !boundary.full_auto_orders_route_enabled),
    gateRow("no_trading_or_artifact_mutation", "Order-frequency throttle fixtures do not execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "order_frequency_throttle_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-order-frequency-throttle-gate-row.v1",
    order_frequency_throttle_gate_row_id: `trading-order-frequency-throttle-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    order_frequency_enabled_by_gate: false,
    order_intent_generated_by_gate: false,
    order_submit_enabled_by_gate: false,
    live_execution_allowed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ shortSellingDisabledFixtures, packageJson, platformOpsLedger, signalEngine, riskEngine, executionEngine, paperShadow, limitedLive, fullAuto, evidenceRows, fixtureRows, gateRows, boundary }) {
  return [
    validationItem("source.short_selling_disabled_fixtures", "p396_short_selling_disabled_fixtures_ready", shortSellingDisabledFixtures.validation.valid && shortSellingDisabledFixtures.summary.trading_short_selling_disabled_fixtures_status === "ready_for_trading_short_selling_disabled_regression", "P396 short-selling disabled fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P397 order frequency throttle fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.order_frequency_sources", "order_frequency_sources_available", signalEngine.available && riskEngine.available && executionEngine.available && paperShadow.available && limitedLive.available && fullAuto.available, "Order-frequency source artifacts are readable."),
    validationItem("order_frequency_throttle_evidence_rows", "order_frequency_evidence_ready", evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "order_frequency_throttled"), "Order-frequency evidence rows must show throttled state."),
    validationItem("order_frequency_throttle_fixture_rows", "required_order_frequency_fixtures_pass", fixtureRows.length === REQUIRED_FIXTURE_KEYS.length && fixtureRows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_order_frequency_enabled), "All order-frequency throttle fixtures must pass."),
    validationItem("order_frequency_throttle_gate_rows", "order_frequency_throttle_gates_ready", gateRows.length >= 12 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P397 order-frequency throttle gates are ready."),
    validationItem("boundary.signal_order_intent", "signal_order_intent_generation_disabled", !boundary.signal_order_intent_generated && !boundary.signal_live_execution_allowed && !boundary.signal_to_order_intent_route_enabled, "Signal-to-order-intent generation remains disabled."),
    validationItem("boundary.risk_order_frequency", "risk_order_frequency_throttle_blocks", !boundary.risk_order_frequency_max_not_zero && !boundary.risk_order_frequency_current_nonzero && !boundary.risk_order_frequency_not_blocking && !boundary.risk_order_frequency_not_blocking_order_intent && !boundary.risk_order_frequency_check_not_blocking, "Risk order-frequency throttle blocks order intent."),
    validationItem("boundary.execution_order_frequency", "execution_order_throttle_blocks_submission", !boundary.execution_order_frequency_max_not_zero && !boundary.execution_current_orders_nonzero && !boundary.execution_order_throttle_not_blocking && !boundary.execution_submit_route_enabled, "Execution order throttle blocks submission."),
    validationItem("boundary.limited_live_order_frequency", "limited_live_daily_order_cap_blocks", !boundary.limited_live_order_cap_max_not_zero && !boundary.limited_live_current_orders_nonzero && !boundary.limited_live_order_cap_not_enforced && !boundary.limited_live_order_cap_not_blocking && !boundary.limited_live_order_submission_allowed, "Limited-live daily order cap blocks submission."),
    validationItem("boundary.shadow_full_auto_order_frequency", "shadow_and_full_auto_order_generation_disabled", !boundary.shadow_order_intents_executable && !boundary.shadow_real_order_count_nonzero && !boundary.full_auto_order_generation_allowed && !boundary.full_auto_automatic_order_submission_allowed && !boundary.full_auto_live_order_submission_allowed && !boundary.full_auto_orders_route_enabled, "Shadow and full-auto order generation remains disabled."),
    validationItem("boundary.no_mutation", "no_trading_or_artifact_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed, "P397 order-frequency throttle fixtures perform no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ shortSellingDisabledFixtures, evidenceRows, fixtureRows, gateRows, boundary, validation }) {
  return {
    trading_order_frequency_throttle_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_short_selling_disabled_status: shortSellingDisabledFixtures.summary.trading_short_selling_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    passed_fixture_count: fixtureRows.filter((row) => row.fixture_status === "passed").length,
    failed_fixture_count: fixtureRows.filter((row) => row.fixture_status !== "passed").length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    unsafe_order_frequency_signal_count: boundary.unsafe_order_frequency_signal_count,
    order_frequency_throttle_covered: boundary.order_frequency_throttle_covered,
    signal_order_intent_generated: boundary.signal_order_intent_generated,
    signal_live_execution_allowed: boundary.signal_live_execution_allowed,
    signal_to_order_intent_route_enabled: boundary.signal_to_order_intent_route_enabled,
    risk_order_frequency_max_not_zero: boundary.risk_order_frequency_max_not_zero,
    risk_order_frequency_current_nonzero: boundary.risk_order_frequency_current_nonzero,
    risk_order_frequency_not_blocking: boundary.risk_order_frequency_not_blocking,
    risk_order_frequency_not_blocking_order_intent: boundary.risk_order_frequency_not_blocking_order_intent,
    risk_order_frequency_check_not_blocking: boundary.risk_order_frequency_check_not_blocking,
    execution_order_frequency_max_not_zero: boundary.execution_order_frequency_max_not_zero,
    execution_current_orders_nonzero: boundary.execution_current_orders_nonzero,
    execution_order_throttle_not_blocking: boundary.execution_order_throttle_not_blocking,
    execution_submit_route_enabled: boundary.execution_submit_route_enabled,
    limited_live_order_cap_max_not_zero: boundary.limited_live_order_cap_max_not_zero,
    limited_live_current_orders_nonzero: boundary.limited_live_current_orders_nonzero,
    limited_live_order_cap_not_enforced: boundary.limited_live_order_cap_not_enforced,
    limited_live_order_cap_not_blocking: boundary.limited_live_order_cap_not_blocking,
    limited_live_order_submission_allowed: boundary.limited_live_order_submission_allowed,
    shadow_order_intents_executable: boundary.shadow_order_intents_executable,
    shadow_real_order_count_nonzero: boundary.shadow_real_order_count_nonzero,
    full_auto_order_generation_allowed: boundary.full_auto_order_generation_allowed,
    full_auto_automatic_order_submission_allowed: boundary.full_auto_automatic_order_submission_allowed,
    full_auto_live_order_submission_allowed: boundary.full_auto_live_order_submission_allowed,
    full_auto_orders_route_enabled: boundary.full_auto_orders_route_enabled,
    order_intent_generated: boundary.order_intent_generated,
    real_order_submitted: boundary.real_order_submitted,
    live_execution_allowed: boundary.live_execution_allowed,
    automatic_order_submission_allowed: boundary.automatic_order_submission_allowed,
    live_order_submission_allowed: boundary.live_order_submission_allowed,
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
    "# Trading Order Frequency Throttle Fixtures",
    "",
    `Status: ${result.summary.trading_order_frequency_throttle_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source short selling disabled: ${result.summary.source_short_selling_disabled_status}`,
    `Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`,
    `Unsafe order frequency signals: ${result.summary.unsafe_order_frequency_signal_count}`,
    "",
    "## Fixtures",
    "",
    ...result.order_frequency_throttle_fixture_rows.map((row) => `- ${row.row_key}: ${row.fixture_status}`),
    "",
    "## Gates",
    "",
    ...result.order_frequency_throttle_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_ORDER_FREQUENCY_THROTTLE_FIXTURES_OUT_DIR };
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
    else if (arg === "--risk-engine") parsed.riskEnginePath = argv[++index];
    else if (arg === "--signal-engine") parsed.signalEnginePath = argv[++index];
    else if (arg === "--short-selling-disabled-fixtures-schema") parsed.shortSellingDisabledFixturesSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-order-frequency-throttle-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_ORDER_FREQUENCY_THROTTLE_FIXTURES_OUT_DIR}
  --run-at <iso>                           Deterministic generated_at timestamp.
  --package <path>                         package.json path.
  --platform-ops-ledger <path>             P341-P500 platform operations ledger path.
  --limited-live <path>                    Limited-live governance artifact path.
  --full-auto <path>                       Full-auto governance artifact path.
  --paper-shadow <path>                    Paper/shadow governance artifact path.
  --execution-engine <path>                Execution engine artifact path.
  --risk-engine <path>                     Risk engine artifact path.
  --signal-engine <path>                   Signal engine artifact path.
  --short-selling-disabled-fixtures-schema <path>
                                           P396 short-selling disabled fixtures schema path.
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_ORDER_FREQUENCY_THROTTLE_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_ORDER_FREQUENCY_THROTTLE_FIXTURES_INPUTS.platformOpsLedgerPath),
    short_selling_disabled_fixtures_schema_path: path.resolve(options.shortSellingDisabledFixturesSchemaPath ?? DEFAULT_TRADING_ORDER_FREQUENCY_THROTTLE_FIXTURES_INPUTS.shortSellingDisabledFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_ORDER_FREQUENCY_THROTTLE_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_ORDER_FREQUENCY_THROTTLE_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_ORDER_FREQUENCY_THROTTLE_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_ORDER_FREQUENCY_THROTTLE_FIXTURES_INPUTS.executionEnginePath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_ORDER_FREQUENCY_THROTTLE_FIXTURES_INPUTS.riskEnginePath),
    signal_engine_path: path.resolve(options.signalEnginePath ?? DEFAULT_TRADING_ORDER_FREQUENCY_THROTTLE_FIXTURES_INPUTS.signalEnginePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_ORDER_FREQUENCY_THROTTLE_FIXTURES_INPUTS.schemaPath),
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

function shadowIntentsNonExecutable(intents) {
  return Array.isArray(intents) && intents.length > 0 && intents.every((intent) => intent?.non_executable === true && intent?.live_execution_allowed === false && intent?.risk_gate_status === "block");
}

function shadowIntentsReviewOnly(intents) {
  return Array.isArray(intents) && intents.length > 0 && intents.every((intent) => intent?.review_only === true);
}

function riskCheckStatus(riskEngine, checkId) {
  const checks = valueAt(riskEngine, ["risk_check_artifacts", 0, "checks"]);
  if (!Array.isArray(checks)) return undefined;
  return checks.find((check) => check?.check_id === checkId)?.status;
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `trading-order-frequency-throttle-fixtures.${slugify(itemPath)}.${checkId}`,
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
