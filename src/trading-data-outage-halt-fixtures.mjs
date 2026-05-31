import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_INPUTS,
  buildTradingModelDegradationHaltFixtures,
} from "./trading-model-degradation-halt-fixtures.mjs";

export const DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_OUT_DIR = "artifacts/trading-data-outage-halt-fixtures/latest";
export const DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_INPUTS,
  modelDegradationHaltFixturesSchemaPath: DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-data-outage-halt-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-data-outage-halt-fixtures.v1";
const CAPABILITY_ID = "trading.data_outage_halt_fixtures";
const PHASE_SLOT = "P400";
const PREVIOUS_PHASE_SLOT = "P399";
const NEXT_PHASE_SLOT = "P401";
const READY_STATUS = "ready_for_trading_data_outage_halt_regression";
const SOURCE_READY_STATUS = "ready_for_trading_model_degradation_halt_regression";
const DATA_OUTAGE_SOURCE_REF = "market_data_quality_report.p061_p090";
const REQUIRED_QUALITY_CHECKS = ["stale_data", "missing_data", "duplicate_candle", "abnormal_price_spread"];
const REQUIRED_FIXTURE_KEYS = [
  "risk_data_outage_halt_declared",
  "market_data_quality_blocks_usage",
  "paper_shadow_data_outage_halt_armed",
  "limited_live_data_outage_halts_armed",
  "full_auto_data_failover_control_plane_only",
  "data_outage_no_live_mutation",
];

export async function runTradingDataOutageHaltFixtures(options = {}) {
  const result = await buildTradingDataOutageHaltFixtures(options);
  if (options.write !== false) await writeTradingDataOutageHaltFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading data outage halt fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingDataOutageHaltFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const modelDegradationHaltFixtures = await buildTradingModelDegradationHaltFixtures({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    limitedLivePath: inputs.limited_live_path,
    fullAutoPath: inputs.full_auto_path,
    paperShadowPath: inputs.paper_shadow_path,
    executionEnginePath: inputs.execution_engine_path,
    riskEnginePath: inputs.risk_engine_path,
    signalEnginePath: inputs.signal_engine_path,
    modelImprovementPath: inputs.model_improvement_path,
    researchBacktestPaperPath: inputs.research_backtest_paper_path,
    schemaPath: inputs.model_degradation_halt_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const riskEngine = await readJsonSource(inputs.risk_engine_path);
  const marketDataFeatureStore = await readJsonSource(inputs.market_data_feature_store_path);
  const paperShadow = await readJsonSource(inputs.paper_shadow_path);
  const limitedLive = await readJsonSource(inputs.limited_live_path);
  const fullAuto = await readJsonSource(inputs.full_auto_path);
  const dataOutageAnchor = buildDataOutageAnchor({ modelDegradationHaltFixtures });
  const dataOutageEvidenceRows = buildDataOutageEvidenceRows({
    riskEngine: riskEngine.data,
    marketDataFeatureStore: marketDataFeatureStore.data,
    paperShadow: paperShadow.data,
    limitedLive: limitedLive.data,
    fullAuto: fullAuto.data,
    modelDegradationHaltFixtures,
  });
  const dataOutageFixtureRows = buildDataOutageFixtureRows(dataOutageEvidenceRows);
  const dataOutageBoundary = buildDataOutageBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    modelDegradationHaltFixtures,
    evidenceRows: dataOutageEvidenceRows,
    fixtureRows: dataOutageFixtureRows,
  });
  const dataOutageGateRows = buildDataOutageGateRows({
    modelDegradationHaltFixtures,
    packageJson,
    platformOpsLedger,
    riskEngine,
    marketDataFeatureStore,
    paperShadow,
    limitedLive,
    fullAuto,
    fixtureRows: dataOutageFixtureRows,
    boundary: dataOutageBoundary,
  });
  const validationItems = buildValidationItems({
    modelDegradationHaltFixtures,
    packageJson,
    platformOpsLedger,
    riskEngine,
    marketDataFeatureStore,
    paperShadow,
    limitedLive,
    fullAuto,
    evidenceRows: dataOutageEvidenceRows,
    fixtureRows: dataOutageFixtureRows,
    gateRows: dataOutageGateRows,
    boundary: dataOutageBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    modelDegradationHaltFixtures,
    evidenceRows: dataOutageEvidenceRows,
    fixtureRows: dataOutageFixtureRows,
    gateRows: dataOutageGateRows,
    boundary: dataOutageBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_data_outage_halt_fixtures_id: `trading-data-outage-halt-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    data_outage_halt_anchor: dataOutageAnchor,
    data_outage_halt_evidence_rows: dataOutageEvidenceRows,
    data_outage_halt_fixture_rows: dataOutageFixtureRows,
    data_outage_halt_gate_rows: dataOutageGateRows,
    data_outage_halt_boundary: dataOutageBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_data_outage_halt_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    modelDegradationHaltFixtures,
    evidenceRows: dataOutageEvidenceRows,
    fixtureRows: dataOutageFixtureRows,
    gateRows: dataOutageGateRows,
    boundary: dataOutageBoundary,
    validation: result.validation,
  });
  result.summary.trading_data_outage_halt_fixtures_id = result.trading_data_outage_halt_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingDataOutageHaltFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-data-outage-halt-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "data-outage-halt-evidence-rows.json"), collectionEnvelope("trading-data-outage-halt-evidence-rows.v1", "data_outage_halt_evidence_rows", result.data_outage_halt_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "data-outage-halt-fixture-rows.json"), collectionEnvelope("trading-data-outage-halt-fixture-rows.v1", "data_outage_halt_fixture_rows", result.data_outage_halt_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "data-outage-halt-gate-rows.json"), collectionEnvelope("trading-data-outage-halt-gate-rows.v1", "data_outage_halt_gate_rows", result.data_outage_halt_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "data-outage-halt-boundary.json"), result.data_outage_halt_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-data-outage-halt-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingDataOutageHaltFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingDataOutageHaltFixtures(args);
    console.log(`Trading data outage halt fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_data_outage_halt_fixtures_status}`);
    console.log(`Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
    console.log(`Unsafe data outage signals: ${result.summary.unsafe_data_outage_signal_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildDataOutageAnchor({ modelDegradationHaltFixtures }) {
  return {
    schema_version: "trading-data-outage-halt-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_model_degradation_halt_fixtures_id: modelDegradationHaltFixtures.trading_model_degradation_halt_fixtures_id,
    source_model_degradation_halt_status: modelDegradationHaltFixtures.summary.trading_model_degradation_halt_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    required_fixture_keys: REQUIRED_FIXTURE_KEYS,
    source_hash: hashValue({
      id: modelDegradationHaltFixtures.trading_model_degradation_halt_fixtures_id,
      status: modelDegradationHaltFixtures.summary.trading_model_degradation_halt_fixtures_status,
      fixtures: REQUIRED_FIXTURE_KEYS,
    }),
  };
}

function buildDataOutageEvidenceRows({ riskEngine, marketDataFeatureStore, paperShadow, limitedLive, fullAuto, modelDegradationHaltFixtures }) {
  const outageGuard = valueAt(riskEngine, ["risk_guards", "data_outage_halt"]);
  const staleGuard = valueAt(riskEngine, ["risk_guards", "stale_data_trade_block"]);
  const paperOutage = valueAt(paperShadow, ["data_outage_detection"]);
  const readOnlyAdapter = valueAt(paperShadow, ["read_only_live_data_adapter"]);
  const exchangeOutageHalt = valueAt(limitedLive, ["halt_gates", "exchange_broker_outage_halt"]);
  const staleDataHalt = valueAt(limitedLive, ["halt_gates", "stale_data_halt"]);
  const dataVendorFailover = valueAt(fullAuto, ["failover_policies", "data_vendor_failover"]);
  const brokerExchangeFailover = valueAt(fullAuto, ["failover_policies", "broker_exchange_failover"]);
  const rows = [
    dataOutageEvidenceRow("risk_data_outage_halt_declared", "risk_engine", "risk_guards.data_outage_halt", [
      observedCondition("risk.risk_guards.data_outage_halt.source_ref", valueAt(outageGuard, ["source_ref"]), DATA_OUTAGE_SOURCE_REF),
      observedCondition("risk.risk_guards.data_outage_halt.data_outage_detected", valueAt(outageGuard, ["data_outage_detected"]), false),
      observedCondition("risk.risk_guards.data_outage_halt.halt_on_outage", valueAt(outageGuard, ["halt_on_outage"]), true),
      observedCondition("risk.risk_guards.data_outage_halt.result", valueAt(outageGuard, ["result"]), "pass"),
      observedCondition("risk.risk_check_artifacts[0].checks.data_outage_halt.status", riskCheckStatus(riskEngine, "data_outage_halt"), "pass"),
      observedCondition("risk.risk_guards.stale_data_trade_block.stale_data_detected", valueAt(staleGuard, ["stale_data_detected"]), false),
      observedCondition("risk.risk_guards.stale_data_trade_block.blocks_order_intent", valueAt(staleGuard, ["blocks_order_intent"]), true),
    ]),
    dataOutageEvidenceRow("market_data_quality_blocks_usage", "market_data_feature_store", "quality_gate_model", [
      observedCondition("market_data.market_data_artifacts.present", marketDataArtifacts(marketDataFeatureStore).length > 0, true),
      observedCondition("market_data.market_data_artifacts.quality_clean", marketArtifactsQualityClean(marketDataFeatureStore), true),
      observedCondition("market_data.quality_gate_model.required_checks_present", requiredQualityChecksPresent(marketDataFeatureStore), true),
      observedCondition("market_data.quality_gate_model.checks_pass_and_block_usage", qualityChecksPassAndBlockUsage(marketDataFeatureStore), true),
      observedCondition("market_data.quality_gate_model.blocks_feature_generation_on_failure", valueAt(marketDataFeatureStore, ["quality_gate_model", "blocks_feature_generation_on_failure"]), true),
      observedCondition("market_data.safety_boundary.live_vendor_feeds_enabled", valueAt(marketDataFeatureStore, ["safety_boundary", "live_vendor_feeds_enabled"]), false),
      observedCondition("market_data.safety_boundary.real_time_trading_feed_enabled", valueAt(marketDataFeatureStore, ["safety_boundary", "real_time_trading_feed_enabled"]), false),
      observedCondition("market_data.safety_boundary.order_intent_generated", valueAt(marketDataFeatureStore, ["safety_boundary", "order_intent_generated"]), false),
    ]),
    dataOutageEvidenceRow("paper_shadow_data_outage_halt_armed", "paper_shadow_live", "data_outage_detection", [
      observedCondition("paper_shadow.data_outage_detection.outage_detected", valueAt(paperOutage, ["outage_detected"]), false),
      observedCondition("paper_shadow.data_outage_detection.halt_shadow_generation_on_outage", valueAt(paperOutage, ["halt_shadow_generation_on_outage"]), true),
      observedCondition("paper_shadow.read_only_live_data_adapter.read_only", valueAt(readOnlyAdapter, ["read_only"]), true),
      observedCondition("paper_shadow.read_only_live_data_adapter.credentials_required", valueAt(readOnlyAdapter, ["credentials_required"]), false),
      observedCondition("paper_shadow.read_only_live_data_adapter.external_network_required", valueAt(readOnlyAdapter, ["external_network_required"]), false),
      observedCondition("paper_shadow.read_only_live_data_adapter.order_routes_enabled", valueAt(readOnlyAdapter, ["order_routes_enabled"]), false),
      observedCondition("paper_shadow.safety_boundary.real_order_submitted", valueAt(paperShadow, ["safety_boundary", "real_order_submitted"]), false),
    ]),
    dataOutageEvidenceRow("limited_live_data_outage_halts_armed", "limited_live_governance", "halt_gates.exchange_broker_outage_halt", [
      observedCondition("limited_live.halt_gates.exchange_broker_outage_halt.enabled", valueAt(exchangeOutageHalt, ["enabled"]), true),
      observedCondition("limited_live.halt_gates.exchange_broker_outage_halt.outage_detected", valueAt(exchangeOutageHalt, ["outage_detected"]), false),
      observedCondition("limited_live.halt_gates.exchange_broker_outage_halt.halt_on_trigger", valueAt(exchangeOutageHalt, ["halt_on_trigger"]), true),
      observedCondition("limited_live.halt_gates.stale_data_halt.enabled", valueAt(staleDataHalt, ["enabled"]), true),
      observedCondition("limited_live.halt_gates.stale_data_halt.stale_data_detected", valueAt(staleDataHalt, ["stale_data_detected"]), false),
      observedCondition("limited_live.halt_gates.stale_data_halt.halt_on_trigger", valueAt(staleDataHalt, ["halt_on_trigger"]), true),
      observedCondition("limited_live.safety_boundary.live_order_submission_allowed", valueAt(limitedLive, ["safety_boundary", "live_order_submission_allowed"]), false),
    ]),
    dataOutageEvidenceRow("full_auto_data_failover_control_plane_only", "full_auto_governance", "failover_policies.data_vendor_failover", [
      observedCondition("full_auto.failover_policies.data_vendor_failover.enabled", valueAt(dataVendorFailover, ["enabled"]), true),
      observedCondition("full_auto.failover_policies.data_vendor_failover.read_only", valueAt(dataVendorFailover, ["read_only"]), true),
      observedCondition("full_auto.failover_policies.data_vendor_failover.external_network_allowed", valueAt(dataVendorFailover, ["external_network_allowed"]), false),
      observedCondition("full_auto.failover_policies.data_vendor_failover.order_generation_allowed_during_failover", valueAt(dataVendorFailover, ["order_generation_allowed_during_failover"]), false),
      observedCondition("full_auto.failover_policies.broker_exchange_failover.enabled", valueAt(brokerExchangeFailover, ["enabled"]), true),
      observedCondition("full_auto.failover_policies.broker_exchange_failover.broker_write_allowed", valueAt(brokerExchangeFailover, ["broker_write_allowed"]), false),
      observedCondition("full_auto.failover_policies.broker_exchange_failover.exchange_write_allowed", valueAt(brokerExchangeFailover, ["exchange_write_allowed"]), false),
      observedCondition("full_auto.failover_policies.broker_exchange_failover.failover_target", valueAt(brokerExchangeFailover, ["failover_target"]), "paper"),
      observedCondition("full_auto.failover_policies.broker_exchange_failover.manual_resume_required", valueAt(brokerExchangeFailover, ["manual_resume_required"]), true),
      observedCondition("full_auto.safety_boundary.full_auto_enabled", valueAt(fullAuto, ["safety_boundary", "full_auto_enabled"]), false),
      observedCondition("full_auto.safety_boundary.automatic_order_submission_allowed", valueAt(fullAuto, ["safety_boundary", "automatic_order_submission_allowed"]), false),
    ]),
    dataOutageEvidenceRow("data_outage_no_live_mutation", "platform_boundary", "source_p399_and_trading_safety_boundaries", [
      observedCondition("source.model_degradation_halt_fixtures.ready", modelDegradationHaltFixtures.validation.valid && modelDegradationHaltFixtures.summary.trading_model_degradation_halt_fixtures_status === SOURCE_READY_STATUS, true),
      observedCondition("risk.safety_boundary.order_intent_generated", valueAt(riskEngine, ["safety_boundary", "order_intent_generated"]), false),
      observedCondition("risk.safety_boundary.live_execution_allowed", valueAt(riskEngine, ["safety_boundary", "live_execution_allowed"]), false),
      observedCondition("market_data.safety_boundary.live_vendor_feeds_enabled", valueAt(marketDataFeatureStore, ["safety_boundary", "live_vendor_feeds_enabled"]), false),
      observedCondition("market_data.safety_boundary.order_intent_generated", valueAt(marketDataFeatureStore, ["safety_boundary", "order_intent_generated"]), false),
      observedCondition("paper_shadow.safety_boundary.live_execution_allowed", valueAt(paperShadow, ["safety_boundary", "live_execution_allowed"]), false),
      observedCondition("limited_live.safety_boundary.broker_write_allowed", valueAt(limitedLive, ["safety_boundary", "broker_write_allowed"]), false),
      observedCondition("limited_live.safety_boundary.exchange_write_allowed", valueAt(limitedLive, ["safety_boundary", "exchange_write_allowed"]), false),
      observedCondition("full_auto.safety_boundary.broker_write_allowed", valueAt(fullAuto, ["safety_boundary", "broker_write_allowed"]), false),
      observedCondition("full_auto.safety_boundary.exchange_write_allowed", valueAt(fullAuto, ["safety_boundary", "exchange_write_allowed"]), false),
      observedCondition("full_auto.safety_boundary.external_service_allowed", valueAt(fullAuto, ["safety_boundary", "external_service_allowed"]), false),
    ]),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "data_outage_halt_evidence_hash"));
}

function dataOutageEvidenceRow(rowKey, artifactId, evidencePath, observedConditions) {
  const allConditionsPresent = observedConditions.every((condition) => condition.condition_present);
  const unsafeConditions = observedConditions.filter((condition) => condition.observed_value !== condition.expected_safe_value);
  return {
    schema_version: "trading-data-outage-halt-evidence-row.v1",
    data_outage_halt_evidence_row_id: `trading-data-outage-halt.evidence.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    artifact_id: artifactId,
    evidence_path: evidencePath,
    observed_conditions: observedConditions,
    observed_condition_count: observedConditions.length,
    all_conditions_present: allConditionsPresent,
    unsafe_data_outage_signal_detected: unsafeConditions.length > 0,
    unsafe_condition_refs: unsafeConditions.map((condition) => condition.condition_path),
    evidence_status: allConditionsPresent && unsafeConditions.length === 0 ? "data_outage_halt_ready" : "unsafe_or_incomplete",
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

function buildDataOutageFixtureRows(evidenceRows) {
  return REQUIRED_FIXTURE_KEYS.map((fixtureKey, index) => {
    const evidenceRow = evidenceRows.find((row) => row.row_key === fixtureKey);
    const row = {
      schema_version: "trading-data-outage-halt-fixture-row.v1",
      data_outage_halt_fixture_row_id: `trading-data-outage-halt-fixtures.row.${fixtureKey}`,
      phase_slot: PHASE_SLOT,
      row_key: fixtureKey,
      unsafe_data_outage_signal_detected: evidenceRow?.unsafe_data_outage_signal_detected === true,
      evidence_status: evidenceRow?.evidence_status ?? "missing",
      fixture_should_fail_when_data_outage_bypassed: true,
      fixture_should_fail_when_quality_gate_disabled: true,
      fixture_should_fail_when_live_feed_enabled: true,
      fixture_status: evidenceRow?.evidence_status === "data_outage_halt_ready" ? "passed" : "failed",
      data_outage_bypassed_by_fixture: false,
      quality_gate_disabled_by_fixture: false,
      live_feed_enabled_by_fixture: false,
      live_execution_allowed_by_fixture: false,
      command_execution_performed_by_fixture: false,
      artifact_write_performed_by_fixture: false,
      protected_action_executed_by_fixture: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "data_outage_halt_fixture_hash");
  });
}

function buildDataOutageBoundary({ generatedAt, writeRequested, modelDegradationHaltFixtures, evidenceRows, fixtureRows }) {
  const unsafeRows = evidenceRows.filter((row) => row.unsafe_data_outage_signal_detected);
  const sourceBoundary = modelDegradationHaltFixtures.summary;
  return {
    schema_version: "trading-data-outage-halt-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    data_outage_halt_artifact_write_requested: writeRequested,
    data_outage_halt_fixture_execution_performed: false,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    data_outage_evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    unsafe_data_outage_signal_count: unsafeRows.length,
    unsafe_data_outage_signal_refs: unsafeRows.map((row) => row.row_key),
    data_outage_halt_covered: evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "data_outage_halt_ready"),
    source_model_degradation_halt_status: sourceBoundary.trading_model_degradation_halt_fixtures_status,
    source_model_degradation_halt_ready: modelDegradationHaltFixtures.validation.valid && sourceBoundary.trading_model_degradation_halt_fixtures_status === SOURCE_READY_STATUS,
    risk_data_outage_source_unbound: observedUnsafeCondition(evidenceRows, "risk.risk_guards.data_outage_halt.source_ref"),
    risk_data_outage_detected: observedUnsafeCondition(evidenceRows, "risk.risk_guards.data_outage_halt.data_outage_detected"),
    risk_data_outage_halt_not_armed: observedUnsafeCondition(evidenceRows, "risk.risk_guards.data_outage_halt.halt_on_outage"),
    risk_data_outage_result_not_pass: observedUnsafeCondition(evidenceRows, "risk.risk_guards.data_outage_halt.result"),
    risk_data_outage_check_not_pass: observedUnsafeCondition(evidenceRows, "risk.risk_check_artifacts[0].checks.data_outage_halt.status"),
    risk_stale_data_detected: observedUnsafeCondition(evidenceRows, "risk.risk_guards.stale_data_trade_block.stale_data_detected"),
    risk_stale_data_not_blocking_order_intent: observedUnsafeCondition(evidenceRows, "risk.risk_guards.stale_data_trade_block.blocks_order_intent"),
    market_data_artifacts_missing: observedUnsafeCondition(evidenceRows, "market_data.market_data_artifacts.present"),
    market_data_quality_not_clean: observedUnsafeCondition(evidenceRows, "market_data.market_data_artifacts.quality_clean"),
    market_data_quality_checks_missing: observedUnsafeCondition(evidenceRows, "market_data.quality_gate_model.required_checks_present"),
    market_data_quality_checks_not_blocking_usage: observedUnsafeCondition(evidenceRows, "market_data.quality_gate_model.checks_pass_and_block_usage") || observedUnsafeCondition(evidenceRows, "market_data.quality_gate_model.blocks_feature_generation_on_failure"),
    market_data_live_feed_enabled: observedUnsafeCondition(evidenceRows, "market_data.safety_boundary.live_vendor_feeds_enabled") || observedUnsafeCondition(evidenceRows, "market_data.safety_boundary.real_time_trading_feed_enabled"),
    market_data_order_intent_generated: observedUnsafeCondition(evidenceRows, "market_data.safety_boundary.order_intent_generated"),
    paper_shadow_data_outage_detected: observedUnsafeCondition(evidenceRows, "paper_shadow.data_outage_detection.outage_detected"),
    paper_shadow_data_outage_halt_not_armed: observedUnsafeCondition(evidenceRows, "paper_shadow.data_outage_detection.halt_shadow_generation_on_outage"),
    paper_shadow_live_adapter_not_read_only: observedUnsafeCondition(evidenceRows, "paper_shadow.read_only_live_data_adapter.read_only") || observedUnsafeCondition(evidenceRows, "paper_shadow.read_only_live_data_adapter.credentials_required") || observedUnsafeCondition(evidenceRows, "paper_shadow.read_only_live_data_adapter.external_network_required"),
    paper_shadow_order_routes_enabled: observedUnsafeCondition(evidenceRows, "paper_shadow.read_only_live_data_adapter.order_routes_enabled"),
    paper_real_order_submitted: observedUnsafeCondition(evidenceRows, "paper_shadow.safety_boundary.real_order_submitted"),
    limited_live_exchange_outage_halt_not_armed: observedUnsafeCondition(evidenceRows, "limited_live.halt_gates.exchange_broker_outage_halt.enabled") || observedUnsafeCondition(evidenceRows, "limited_live.halt_gates.exchange_broker_outage_halt.halt_on_trigger"),
    limited_live_exchange_outage_detected: observedUnsafeCondition(evidenceRows, "limited_live.halt_gates.exchange_broker_outage_halt.outage_detected"),
    limited_live_stale_data_halt_not_armed: observedUnsafeCondition(evidenceRows, "limited_live.halt_gates.stale_data_halt.enabled") || observedUnsafeCondition(evidenceRows, "limited_live.halt_gates.stale_data_halt.halt_on_trigger"),
    limited_live_stale_data_detected: observedUnsafeCondition(evidenceRows, "limited_live.halt_gates.stale_data_halt.stale_data_detected"),
    limited_live_order_submission_allowed: sourceBoundary.live_order_submission_allowed || observedUnsafeCondition(evidenceRows, "limited_live.safety_boundary.live_order_submission_allowed"),
    live_order_submission_allowed: sourceBoundary.live_order_submission_allowed || observedUnsafeCondition(evidenceRows, "limited_live.safety_boundary.live_order_submission_allowed"),
    full_auto_data_failover_not_read_only: observedUnsafeCondition(evidenceRows, "full_auto.failover_policies.data_vendor_failover.enabled") || observedUnsafeCondition(evidenceRows, "full_auto.failover_policies.data_vendor_failover.read_only"),
    full_auto_data_failover_external_network_allowed: observedUnsafeCondition(evidenceRows, "full_auto.failover_policies.data_vendor_failover.external_network_allowed"),
    full_auto_order_generation_during_failover_allowed: observedUnsafeCondition(evidenceRows, "full_auto.failover_policies.data_vendor_failover.order_generation_allowed_during_failover"),
    full_auto_broker_exchange_failover_allows_writes: observedUnsafeCondition(evidenceRows, "full_auto.failover_policies.broker_exchange_failover.enabled") || observedUnsafeCondition(evidenceRows, "full_auto.failover_policies.broker_exchange_failover.broker_write_allowed") || observedUnsafeCondition(evidenceRows, "full_auto.failover_policies.broker_exchange_failover.exchange_write_allowed") || observedUnsafeCondition(evidenceRows, "full_auto.failover_policies.broker_exchange_failover.failover_target") || observedUnsafeCondition(evidenceRows, "full_auto.failover_policies.broker_exchange_failover.manual_resume_required"),
    full_auto_enabled: sourceBoundary.full_auto_enabled || observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.full_auto_enabled"),
    automatic_order_submission_allowed: sourceBoundary.automatic_order_submission_allowed || observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.automatic_order_submission_allowed"),
    external_service_allowed: observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.external_service_allowed"),
    order_intent_generated: sourceBoundary.order_intent_generated || observedUnsafeCondition(evidenceRows, "risk.safety_boundary.order_intent_generated") || observedUnsafeCondition(evidenceRows, "market_data.safety_boundary.order_intent_generated"),
    real_order_submitted: sourceBoundary.real_order_submitted || observedUnsafeCondition(evidenceRows, "paper_shadow.safety_boundary.real_order_submitted"),
    live_execution_allowed: sourceBoundary.live_execution_allowed || observedUnsafeCondition(evidenceRows, "risk.safety_boundary.live_execution_allowed") || observedUnsafeCondition(evidenceRows, "paper_shadow.safety_boundary.live_execution_allowed"),
    broker_write_allowed: sourceBoundary.broker_write_allowed || observedUnsafeCondition(evidenceRows, "limited_live.safety_boundary.broker_write_allowed") || observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.broker_write_allowed"),
    exchange_write_allowed: sourceBoundary.exchange_write_allowed || observedUnsafeCondition(evidenceRows, "limited_live.safety_boundary.exchange_write_allowed") || observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.exchange_write_allowed"),
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

function buildDataOutageGateRows({ modelDegradationHaltFixtures, packageJson, platformOpsLedger, riskEngine, marketDataFeatureStore, paperShadow, limitedLive, fullAuto, fixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p399_model_degradation_halt_fixtures_ready", "P399 model degradation halt fixtures source is ready.", modelDegradationHaltFixtures.validation.valid && modelDegradationHaltFixtures.summary.trading_model_degradation_halt_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P400 trading data outage halt fixtures command.", typeof scripts["trading:data-outage-halt-fixtures"] === "string" && scripts["trading:data-outage-halt-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P400 trading data outage halt fixtures command.", validateScript.includes("npm run trading:data-outage-halt-fixtures -- --check")),
    gateRow("p400_ledger_acceptance_declared", "P400 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P400: `trading:data-outage-halt-fixtures`")),
    gateRow("data_outage_sources_readable", "All data outage halt source artifacts are readable.", riskEngine.available && marketDataFeatureStore.available && paperShadow.available && limitedLive.available && fullAuto.available),
    gateRow("required_data_outage_fixtures_declared", "All required data outage halt fixtures are declared.", REQUIRED_FIXTURE_KEYS.every((fixtureKey) => fixtureRows.some((row) => row.row_key === fixtureKey)) && fixtureRows.length === REQUIRED_FIXTURE_KEYS.length),
    gateRow("risk_data_outage_halt_declared", "Risk data outage halt and stale-data block are declared, armed, and currently passing.", !boundary.risk_data_outage_source_unbound && !boundary.risk_data_outage_detected && !boundary.risk_data_outage_halt_not_armed && !boundary.risk_data_outage_result_not_pass && !boundary.risk_data_outage_check_not_pass && !boundary.risk_stale_data_detected && !boundary.risk_stale_data_not_blocking_order_intent),
    gateRow("market_data_quality_blocks_usage", "Market-data quality checks cover required checks, pass, and block usage on failure without live feeds.", !boundary.market_data_artifacts_missing && !boundary.market_data_quality_not_clean && !boundary.market_data_quality_checks_missing && !boundary.market_data_quality_checks_not_blocking_usage && !boundary.market_data_live_feed_enabled && !boundary.market_data_order_intent_generated),
    gateRow("paper_shadow_data_outage_halt_armed", "Paper/shadow data outage detection is armed and the live-data adapter is read-only.", !boundary.paper_shadow_data_outage_detected && !boundary.paper_shadow_data_outage_halt_not_armed && !boundary.paper_shadow_live_adapter_not_read_only && !boundary.paper_shadow_order_routes_enabled && !boundary.paper_real_order_submitted),
    gateRow("limited_live_data_outage_halts_armed", "Limited-live exchange outage and stale-data halt gates are armed with no live submission.", !boundary.limited_live_exchange_outage_halt_not_armed && !boundary.limited_live_exchange_outage_detected && !boundary.limited_live_stale_data_halt_not_armed && !boundary.limited_live_stale_data_detected && !boundary.limited_live_order_submission_allowed),
    gateRow("full_auto_data_failover_control_plane_only", "Full-auto data and broker/exchange failover stays read-only, paper-targeted, and non-order-generating.", !boundary.full_auto_data_failover_not_read_only && !boundary.full_auto_data_failover_external_network_allowed && !boundary.full_auto_order_generation_during_failover_allowed && !boundary.full_auto_broker_exchange_failover_allows_writes && !boundary.full_auto_enabled && !boundary.automatic_order_submission_allowed && !boundary.external_service_allowed),
    gateRow("no_trading_or_artifact_mutation", "Data outage halt fixtures do not enable live feeds, submit orders, execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.market_data_live_feed_enabled && !boundary.order_intent_generated && !boundary.live_execution_allowed && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "data_outage_halt_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-data-outage-halt-gate-row.v1",
    data_outage_halt_gate_row_id: `trading-data-outage-halt-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    data_outage_bypassed_by_gate: false,
    quality_gate_disabled_by_gate: false,
    live_feed_enabled_by_gate: false,
    live_order_submission_allowed_by_gate: false,
    live_execution_allowed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ modelDegradationHaltFixtures, packageJson, platformOpsLedger, riskEngine, marketDataFeatureStore, paperShadow, limitedLive, fullAuto, evidenceRows, fixtureRows, gateRows, boundary }) {
  return [
    validationItem("source.model_degradation_halt_fixtures", "p399_model_degradation_halt_fixtures_ready", modelDegradationHaltFixtures.validation.valid && modelDegradationHaltFixtures.summary.trading_model_degradation_halt_fixtures_status === SOURCE_READY_STATUS, "P399 model degradation halt fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P400 data outage halt fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.data_outage_sources", "data_outage_sources_available", riskEngine.available && marketDataFeatureStore.available && paperShadow.available && limitedLive.available && fullAuto.available, "Data outage halt source artifacts are readable."),
    validationItem("data_outage_halt_evidence_rows", "data_outage_evidence_ready", evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "data_outage_halt_ready"), "Data outage halt evidence rows must show safe current state and armed gates."),
    validationItem("data_outage_halt_fixture_rows", "required_data_outage_fixtures_pass", fixtureRows.length === REQUIRED_FIXTURE_KEYS.length && fixtureRows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_data_outage_bypassed), "All data outage halt fixtures must pass."),
    validationItem("data_outage_halt_gate_rows", "data_outage_halt_gates_ready", gateRows.length >= 12 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P400 data outage halt gates are ready."),
    validationItem("boundary.risk_data_outage", "risk_data_outage_halt_declared", !boundary.risk_data_outage_source_unbound && !boundary.risk_data_outage_detected && !boundary.risk_data_outage_halt_not_armed && !boundary.risk_data_outage_result_not_pass && !boundary.risk_data_outage_check_not_pass && !boundary.risk_stale_data_detected && !boundary.risk_stale_data_not_blocking_order_intent, "Risk data outage halt and stale-data block are armed and safe."),
    validationItem("boundary.market_data_quality", "market_data_quality_blocks_usage", !boundary.market_data_artifacts_missing && !boundary.market_data_quality_not_clean && !boundary.market_data_quality_checks_missing && !boundary.market_data_quality_checks_not_blocking_usage && !boundary.market_data_live_feed_enabled && !boundary.market_data_order_intent_generated, "Market-data quality gates pass and block usage without live feeds."),
    validationItem("boundary.paper_shadow_data_outage", "paper_shadow_data_outage_halt_armed", !boundary.paper_shadow_data_outage_detected && !boundary.paper_shadow_data_outage_halt_not_armed && !boundary.paper_shadow_live_adapter_not_read_only && !boundary.paper_shadow_order_routes_enabled && !boundary.paper_real_order_submitted, "Paper/shadow outage detection is armed and read-only."),
    validationItem("boundary.limited_live_data_outage", "limited_live_data_outage_halts_armed", !boundary.limited_live_exchange_outage_halt_not_armed && !boundary.limited_live_exchange_outage_detected && !boundary.limited_live_stale_data_halt_not_armed && !boundary.limited_live_stale_data_detected && !boundary.limited_live_order_submission_allowed, "Limited-live outage and stale-data halt gates are armed."),
    validationItem("boundary.full_auto_data_failover", "full_auto_data_failover_control_plane_only", !boundary.full_auto_data_failover_not_read_only && !boundary.full_auto_data_failover_external_network_allowed && !boundary.full_auto_order_generation_during_failover_allowed && !boundary.full_auto_broker_exchange_failover_allows_writes && !boundary.full_auto_enabled && !boundary.automatic_order_submission_allowed && !boundary.external_service_allowed, "Full-auto failover remains read-only and control-plane-only."),
    validationItem("boundary.no_mutation", "no_trading_or_artifact_mutation", !boundary.market_data_live_feed_enabled && !boundary.order_intent_generated && !boundary.live_execution_allowed && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed, "P400 data outage halt fixtures perform no live-feed, trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ modelDegradationHaltFixtures, evidenceRows, fixtureRows, gateRows, boundary, validation }) {
  return {
    trading_data_outage_halt_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_model_degradation_halt_status: modelDegradationHaltFixtures.summary.trading_model_degradation_halt_fixtures_status,
    source_model_degradation_halt_ready: boundary.source_model_degradation_halt_ready,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    passed_fixture_count: fixtureRows.filter((row) => row.fixture_status === "passed").length,
    failed_fixture_count: fixtureRows.filter((row) => row.fixture_status !== "passed").length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    unsafe_data_outage_signal_count: boundary.unsafe_data_outage_signal_count,
    data_outage_halt_covered: boundary.data_outage_halt_covered,
    risk_data_outage_source_unbound: boundary.risk_data_outage_source_unbound,
    risk_data_outage_detected: boundary.risk_data_outage_detected,
    risk_data_outage_halt_not_armed: boundary.risk_data_outage_halt_not_armed,
    risk_data_outage_result_not_pass: boundary.risk_data_outage_result_not_pass,
    risk_data_outage_check_not_pass: boundary.risk_data_outage_check_not_pass,
    risk_stale_data_detected: boundary.risk_stale_data_detected,
    risk_stale_data_not_blocking_order_intent: boundary.risk_stale_data_not_blocking_order_intent,
    market_data_artifacts_missing: boundary.market_data_artifacts_missing,
    market_data_quality_not_clean: boundary.market_data_quality_not_clean,
    market_data_quality_checks_missing: boundary.market_data_quality_checks_missing,
    market_data_quality_checks_not_blocking_usage: boundary.market_data_quality_checks_not_blocking_usage,
    market_data_live_feed_enabled: boundary.market_data_live_feed_enabled,
    market_data_order_intent_generated: boundary.market_data_order_intent_generated,
    paper_shadow_data_outage_detected: boundary.paper_shadow_data_outage_detected,
    paper_shadow_data_outage_halt_not_armed: boundary.paper_shadow_data_outage_halt_not_armed,
    paper_shadow_live_adapter_not_read_only: boundary.paper_shadow_live_adapter_not_read_only,
    paper_shadow_order_routes_enabled: boundary.paper_shadow_order_routes_enabled,
    paper_real_order_submitted: boundary.paper_real_order_submitted,
    limited_live_exchange_outage_halt_not_armed: boundary.limited_live_exchange_outage_halt_not_armed,
    limited_live_exchange_outage_detected: boundary.limited_live_exchange_outage_detected,
    limited_live_stale_data_halt_not_armed: boundary.limited_live_stale_data_halt_not_armed,
    limited_live_stale_data_detected: boundary.limited_live_stale_data_detected,
    limited_live_order_submission_allowed: boundary.limited_live_order_submission_allowed,
    live_order_submission_allowed: boundary.live_order_submission_allowed,
    full_auto_data_failover_not_read_only: boundary.full_auto_data_failover_not_read_only,
    full_auto_data_failover_external_network_allowed: boundary.full_auto_data_failover_external_network_allowed,
    full_auto_order_generation_during_failover_allowed: boundary.full_auto_order_generation_during_failover_allowed,
    full_auto_broker_exchange_failover_allows_writes: boundary.full_auto_broker_exchange_failover_allows_writes,
    full_auto_enabled: boundary.full_auto_enabled,
    automatic_order_submission_allowed: boundary.automatic_order_submission_allowed,
    external_service_allowed: boundary.external_service_allowed,
    order_intent_generated: boundary.order_intent_generated,
    real_order_submitted: boundary.real_order_submitted,
    live_execution_allowed: boundary.live_execution_allowed,
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
    "# Trading Data Outage Halt Fixtures",
    "",
    `Status: ${result.summary.trading_data_outage_halt_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source model degradation halt: ${result.summary.source_model_degradation_halt_status}`,
    `Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`,
    `Unsafe data outage signals: ${result.summary.unsafe_data_outage_signal_count}`,
    "",
    "## Fixtures",
    "",
    ...result.data_outage_halt_fixture_rows.map((row) => `- ${row.row_key}: ${row.fixture_status}`),
    "",
    "## Gates",
    "",
    ...result.data_outage_halt_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_OUT_DIR };
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
    else if (arg === "--model-improvement") parsed.modelImprovementPath = argv[++index];
    else if (arg === "--research-backtest-paper") parsed.researchBacktestPaperPath = argv[++index];
    else if (arg === "--market-data-feature-store") parsed.marketDataFeatureStorePath = argv[++index];
    else if (arg === "--model-degradation-halt-fixtures-schema") parsed.modelDegradationHaltFixturesSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-data-outage-halt-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_OUT_DIR}
  --run-at <iso>                           Deterministic generated_at timestamp.
  --package <path>                         package.json path.
  --platform-ops-ledger <path>             P341-P500 platform operations ledger path.
  --limited-live <path>                    Limited-live governance artifact path.
  --full-auto <path>                       Full-auto governance artifact path.
  --paper-shadow <path>                    Paper/shadow governance artifact path.
  --execution-engine <path>                Execution engine artifact path.
  --risk-engine <path>                     Risk engine artifact path.
  --signal-engine <path>                   Signal engine artifact path.
  --model-improvement <path>               Model-improvement layer artifact path.
  --research-backtest-paper <path>         Research/backtest/paper sample artifact path.
  --market-data-feature-store <path>       Market-data feature store artifact path.
  --model-degradation-halt-fixtures-schema <path>
                                           P399 model degradation halt fixtures schema path.
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_INPUTS.platformOpsLedgerPath),
    model_degradation_halt_fixtures_schema_path: path.resolve(options.modelDegradationHaltFixturesSchemaPath ?? DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_INPUTS.modelDegradationHaltFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_INPUTS.executionEnginePath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_INPUTS.riskEnginePath),
    signal_engine_path: path.resolve(options.signalEnginePath ?? DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_INPUTS.signalEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_INPUTS.modelImprovementPath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_INPUTS.researchBacktestPaperPath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_INPUTS.marketDataFeatureStorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_INPUTS.schemaPath),
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

function hasArrayValue(values, target) {
  return Array.isArray(values) && values.includes(target);
}

function marketDataArtifacts(marketDataFeatureStore) {
  const artifacts = valueAt(marketDataFeatureStore, ["market_data_artifacts"]);
  return Array.isArray(artifacts) ? artifacts : [];
}

function marketArtifactsQualityClean(marketDataFeatureStore) {
  const artifacts = marketDataArtifacts(marketDataFeatureStore);
  return artifacts.length > 0 && artifacts.every((artifact) => {
    const checks = artifact?.quality_checks ?? {};
    return checks.stale_data_detected === false
      && checks.missing_data_detected === false
      && checks.duplicate_candle_detected === false
      && checks.abnormal_price_detected === false;
  });
}

function requiredQualityChecksPresent(marketDataFeatureStore) {
  const checks = valueAt(marketDataFeatureStore, ["quality_gate_model", "checks"]);
  if (!Array.isArray(checks)) return false;
  const checkIds = new Set(checks.map((check) => check?.check_id));
  return REQUIRED_QUALITY_CHECKS.every((checkId) => checkIds.has(checkId));
}

function qualityChecksPassAndBlockUsage(marketDataFeatureStore) {
  const checks = valueAt(marketDataFeatureStore, ["quality_gate_model", "checks"]);
  return Array.isArray(checks) && checks.length >= REQUIRED_QUALITY_CHECKS.length && checks.every((check) => check?.status === "pass" && check?.blocks_usage === true);
}

function riskCheckStatus(riskEngine, checkId) {
  const checks = valueAt(riskEngine, ["risk_check_artifacts", 0, "checks"]);
  if (!Array.isArray(checks)) return undefined;
  return checks.find((check) => check?.check_id === checkId)?.status;
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `trading-data-outage-halt-fixtures.${slugify(itemPath)}.${checkId}`,
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
