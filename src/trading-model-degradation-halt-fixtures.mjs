import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_LOSS_STREAK_COOLDOWN_FIXTURES_INPUTS,
  buildTradingLossStreakCooldownFixtures,
} from "./trading-loss-streak-cooldown-fixtures.mjs";

export const DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_OUT_DIR = "artifacts/trading-model-degradation-halt-fixtures/latest";
export const DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_LOSS_STREAK_COOLDOWN_FIXTURES_INPUTS,
  lossStreakCooldownFixturesSchemaPath: DEFAULT_TRADING_LOSS_STREAK_COOLDOWN_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-model-degradation-halt-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-model-degradation-halt-fixtures.v1";
const CAPABILITY_ID = "trading.model_degradation_halt_fixtures";
const PHASE_SLOT = "P399";
const PREVIOUS_PHASE_SLOT = "P398";
const NEXT_PHASE_SLOT = "P400";
const READY_STATUS = "ready_for_trading_model_degradation_halt_regression";
const SOURCE_READY_STATUS = "ready_for_trading_loss_streak_cooldown_regression";
const REQUIRED_FIXTURE_KEYS = [
  "risk_model_degradation_halt_declared",
  "model_improvement_degradation_checks_block_promotion",
  "research_model_degradation_safe",
  "limited_live_model_degradation_halt_armed",
  "full_auto_degradation_disable_control_plane_only",
  "model_degradation_no_live_mutation",
];

export async function runTradingModelDegradationHaltFixtures(options = {}) {
  const result = await buildTradingModelDegradationHaltFixtures(options);
  if (options.write !== false) await writeTradingModelDegradationHaltFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading model degradation halt fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingModelDegradationHaltFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const lossStreakCooldownFixtures = await buildTradingLossStreakCooldownFixtures({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    limitedLivePath: inputs.limited_live_path,
    fullAutoPath: inputs.full_auto_path,
    paperShadowPath: inputs.paper_shadow_path,
    executionEnginePath: inputs.execution_engine_path,
    riskEnginePath: inputs.risk_engine_path,
    signalEnginePath: inputs.signal_engine_path,
    schemaPath: inputs.loss_streak_cooldown_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const riskEngine = await readJsonSource(inputs.risk_engine_path);
  const modelImprovement = await readJsonSource(inputs.model_improvement_path);
  const researchBacktestPaper = await readJsonSource(inputs.research_backtest_paper_path);
  const limitedLive = await readJsonSource(inputs.limited_live_path);
  const fullAuto = await readJsonSource(inputs.full_auto_path);
  const modelDegradationAnchor = buildModelDegradationAnchor({ lossStreakCooldownFixtures });
  const modelDegradationEvidenceRows = buildModelDegradationEvidenceRows({
    riskEngine: riskEngine.data,
    modelImprovement: modelImprovement.data,
    researchBacktestPaper: researchBacktestPaper.data,
    limitedLive: limitedLive.data,
    fullAuto: fullAuto.data,
    lossStreakCooldownFixtures,
  });
  const modelDegradationFixtureRows = buildModelDegradationFixtureRows(modelDegradationEvidenceRows);
  const modelDegradationBoundary = buildModelDegradationBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    lossStreakCooldownFixtures,
    evidenceRows: modelDegradationEvidenceRows,
    fixtureRows: modelDegradationFixtureRows,
  });
  const modelDegradationGateRows = buildModelDegradationGateRows({
    lossStreakCooldownFixtures,
    packageJson,
    platformOpsLedger,
    riskEngine,
    modelImprovement,
    researchBacktestPaper,
    limitedLive,
    fullAuto,
    fixtureRows: modelDegradationFixtureRows,
    boundary: modelDegradationBoundary,
  });
  const validationItems = buildValidationItems({
    lossStreakCooldownFixtures,
    packageJson,
    platformOpsLedger,
    riskEngine,
    modelImprovement,
    researchBacktestPaper,
    limitedLive,
    fullAuto,
    evidenceRows: modelDegradationEvidenceRows,
    fixtureRows: modelDegradationFixtureRows,
    gateRows: modelDegradationGateRows,
    boundary: modelDegradationBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    lossStreakCooldownFixtures,
    evidenceRows: modelDegradationEvidenceRows,
    fixtureRows: modelDegradationFixtureRows,
    gateRows: modelDegradationGateRows,
    boundary: modelDegradationBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_model_degradation_halt_fixtures_id: `trading-model-degradation-halt-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    model_degradation_halt_anchor: modelDegradationAnchor,
    model_degradation_halt_evidence_rows: modelDegradationEvidenceRows,
    model_degradation_halt_fixture_rows: modelDegradationFixtureRows,
    model_degradation_halt_gate_rows: modelDegradationGateRows,
    model_degradation_halt_boundary: modelDegradationBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_model_degradation_halt_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    lossStreakCooldownFixtures,
    evidenceRows: modelDegradationEvidenceRows,
    fixtureRows: modelDegradationFixtureRows,
    gateRows: modelDegradationGateRows,
    boundary: modelDegradationBoundary,
    validation: result.validation,
  });
  result.summary.trading_model_degradation_halt_fixtures_id = result.trading_model_degradation_halt_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingModelDegradationHaltFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-model-degradation-halt-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "model-degradation-halt-evidence-rows.json"), collectionEnvelope("trading-model-degradation-halt-evidence-rows.v1", "model_degradation_halt_evidence_rows", result.model_degradation_halt_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "model-degradation-halt-fixture-rows.json"), collectionEnvelope("trading-model-degradation-halt-fixture-rows.v1", "model_degradation_halt_fixture_rows", result.model_degradation_halt_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "model-degradation-halt-gate-rows.json"), collectionEnvelope("trading-model-degradation-halt-gate-rows.v1", "model_degradation_halt_gate_rows", result.model_degradation_halt_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "model-degradation-halt-boundary.json"), result.model_degradation_halt_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-model-degradation-halt-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingModelDegradationHaltFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingModelDegradationHaltFixtures(args);
    console.log(`Trading model degradation halt fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_model_degradation_halt_fixtures_status}`);
    console.log(`Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
    console.log(`Unsafe model degradation signals: ${result.summary.unsafe_model_degradation_signal_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildModelDegradationAnchor({ lossStreakCooldownFixtures }) {
  return {
    schema_version: "trading-model-degradation-halt-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_loss_streak_cooldown_fixtures_id: lossStreakCooldownFixtures.trading_loss_streak_cooldown_fixtures_id,
    source_loss_streak_cooldown_status: lossStreakCooldownFixtures.summary.trading_loss_streak_cooldown_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    required_fixture_keys: REQUIRED_FIXTURE_KEYS,
    source_hash: hashValue({
      id: lossStreakCooldownFixtures.trading_loss_streak_cooldown_fixtures_id,
      status: lossStreakCooldownFixtures.summary.trading_loss_streak_cooldown_fixtures_status,
      fixtures: REQUIRED_FIXTURE_KEYS,
    }),
  };
}

function buildModelDegradationEvidenceRows({ riskEngine, modelImprovement, researchBacktestPaper, limitedLive, fullAuto, lossStreakCooldownFixtures }) {
  const riskGuard = valueAt(riskEngine, ["risk_guards", "model_degradation_halt"]);
  const riskGuardSourceRef = valueAt(riskGuard, ["source_ref"]);
  const researchModel = valueAt(researchBacktestPaper, ["contract_examples", "trading-model"]);
  const limitedLiveModelCheck = valueAt(limitedLive, ["model_live_degradation_check"]);
  const fullAutoDegradationPolicy = valueAt(fullAuto, ["automatic_disable_policies", "strategy_disable_on_degradation"]);
  const fullAutoDriftPolicy = valueAt(fullAuto, ["automatic_disable_policies", "model_disable_on_drift"]);
  const rows = [
    modelDegradationEvidenceRow("risk_model_degradation_halt_declared", "risk_engine", "risk_guards.model_degradation_halt", [
      observedCondition("risk.risk_guards.model_degradation_halt.source_ref_bound", degradationCheckExists(modelImprovement, riskGuardSourceRef), true),
      observedCondition("risk.risk_guards.model_degradation_halt.degradation_result", valueAt(riskGuard, ["degradation_result"]), "pass"),
      observedCondition("risk.risk_guards.model_degradation_halt.halt_on_degradation", valueAt(riskGuard, ["halt_on_degradation"]), true),
      observedCondition("risk.risk_guards.model_degradation_halt.result", valueAt(riskGuard, ["result"]), "pass"),
      observedCondition("risk.risk_check_artifacts[0].checks.model_degradation_halt.status", riskCheckStatus(riskEngine, "model_degradation_halt"), "pass"),
    ]),
    modelDegradationEvidenceRow("model_improvement_degradation_checks_block_promotion", "model_improvement_layer", "degradation_checks", [
      observedCondition("model_improvement.model_registry.models_present", modelRegistryModels(modelImprovement).length > 0, true),
      observedCondition("model_improvement.degradation_checks.cover_registered_models", degradationChecksCoverModels(modelImprovement), true),
      observedCondition("model_improvement.degradation_checks.block_promotion", degradationChecksBlockPromotion(modelImprovement), true),
      observedCondition("model_improvement.degradation_checks.no_halt_result_present", degradationChecksNotHalted(modelImprovement), true),
      observedCondition("model_improvement.promotion_policy_gate.auto_live_promotion_allowed", valueAt(modelImprovement, ["promotion_policy_gate", "auto_live_promotion_allowed"]), false),
      observedCondition("model_improvement.live_deployment_boundary.live_deployment_allowed", valueAt(modelImprovement, ["live_deployment_boundary", "live_deployment_allowed"]), false),
    ]),
    modelDegradationEvidenceRow("research_model_degradation_safe", "research_backtest_paper_sample", "contract_examples.trading-model", [
      observedCondition("research.trading_model.research_only", valueAt(researchModel, ["research_only"]), true),
      observedCondition("research.trading_model.deployment_stage", valueAt(researchModel, ["deployment_stage"]), "paper"),
      observedCondition("research.trading_model.scorecard.degradation_status", valueAt(researchModel, ["scorecard", "degradation_status"]), "none"),
      observedCondition("research.trading_model.scorecard.drift_status", valueAt(researchModel, ["scorecard", "drift_status"]), "none"),
      observedCondition("research.safety_policy.live_trading_enabled", valueAt(researchBacktestPaper, ["safety_policy", "live_trading_enabled"]), false),
      observedCondition("research.stage_policy.full_auto", valueAt(researchBacktestPaper, ["stage_policy", "full_auto"]), "blocked"),
    ]),
    modelDegradationEvidenceRow("limited_live_model_degradation_halt_armed", "limited_live_governance", "model_live_degradation_check", [
      observedCondition("limited_live.model_live_degradation_check.source_ref_bound", valueAt(limitedLiveModelCheck, ["source_ref"]) === riskGuardSourceRef && degradationCheckExists(modelImprovement, valueAt(limitedLiveModelCheck, ["source_ref"])), true),
      observedCondition("limited_live.model_live_degradation_check.result", valueAt(limitedLiveModelCheck, ["result"]), "pass"),
      observedCondition("limited_live.model_live_degradation_check.halt_on_degradation", valueAt(limitedLiveModelCheck, ["halt_on_degradation"]), true),
      observedCondition("limited_live.model_live_degradation_check.live_model_enabled", valueAt(limitedLiveModelCheck, ["live_model_enabled"]), false),
      observedCondition("limited_live.safety_boundary.live_order_submission_allowed", valueAt(limitedLive, ["safety_boundary", "live_order_submission_allowed"]), false),
    ]),
    modelDegradationEvidenceRow("full_auto_degradation_disable_control_plane_only", "full_auto_governance", "automatic_disable_policies.strategy_disable_on_degradation", [
      observedCondition("full_auto.automatic_disable_policies.strategy_disable_on_degradation.enabled", valueAt(fullAutoDegradationPolicy, ["enabled"]), true),
      observedCondition("full_auto.automatic_disable_policies.strategy_disable_on_degradation.trigger_results.halt_present", hasArrayValue(valueAt(fullAutoDegradationPolicy, ["trigger_results"]), "halt"), true),
      observedCondition("full_auto.automatic_disable_policies.strategy_disable_on_degradation.control_plane_state_change_only", valueAt(fullAutoDegradationPolicy, ["control_plane_state_change_only"]), true),
      observedCondition("full_auto.automatic_disable_policies.strategy_disable_on_degradation.live_orders_touched", valueAt(fullAutoDegradationPolicy, ["live_orders_touched"]), false),
      observedCondition("full_auto.automatic_disable_policies.model_disable_on_drift.control_plane_state_change_only", valueAt(fullAutoDriftPolicy, ["control_plane_state_change_only"]), true),
      observedCondition("full_auto.safety_boundary.full_auto_enabled", valueAt(fullAuto, ["safety_boundary", "full_auto_enabled"]), false),
      observedCondition("full_auto.safety_boundary.automatic_order_submission_allowed", valueAt(fullAuto, ["safety_boundary", "automatic_order_submission_allowed"]), false),
    ]),
    modelDegradationEvidenceRow("model_degradation_no_live_mutation", "platform_boundary", "source_p398_and_trading_safety_boundaries", [
      observedCondition("source.loss_streak_cooldown_fixtures.ready", lossStreakCooldownFixtures.validation.valid && lossStreakCooldownFixtures.summary.trading_loss_streak_cooldown_fixtures_status === SOURCE_READY_STATUS, true),
      observedCondition("risk.safety_boundary.order_intent_generated", valueAt(riskEngine, ["safety_boundary", "order_intent_generated"]), false),
      observedCondition("risk.safety_boundary.live_execution_allowed", valueAt(riskEngine, ["safety_boundary", "live_execution_allowed"]), false),
      observedCondition("model_improvement.safety_boundary.automated_live_deployment_allowed", valueAt(modelImprovement, ["safety_boundary", "automated_live_deployment_allowed"]), false),
      observedCondition("model_improvement.safety_boundary.order_intent_generated", valueAt(modelImprovement, ["safety_boundary", "order_intent_generated"]), false),
      observedCondition("limited_live.safety_boundary.broker_write_allowed", valueAt(limitedLive, ["safety_boundary", "broker_write_allowed"]), false),
      observedCondition("full_auto.safety_boundary.broker_write_allowed", valueAt(fullAuto, ["safety_boundary", "broker_write_allowed"]), false),
      observedCondition("full_auto.safety_boundary.exchange_write_allowed", valueAt(fullAuto, ["safety_boundary", "exchange_write_allowed"]), false),
    ]),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "model_degradation_halt_evidence_hash"));
}

function modelDegradationEvidenceRow(rowKey, artifactId, evidencePath, observedConditions) {
  const allConditionsPresent = observedConditions.every((condition) => condition.condition_present);
  const unsafeConditions = observedConditions.filter((condition) => condition.observed_value !== condition.expected_safe_value);
  return {
    schema_version: "trading-model-degradation-halt-evidence-row.v1",
    model_degradation_halt_evidence_row_id: `trading-model-degradation-halt.evidence.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    artifact_id: artifactId,
    evidence_path: evidencePath,
    observed_conditions: observedConditions,
    observed_condition_count: observedConditions.length,
    all_conditions_present: allConditionsPresent,
    unsafe_model_degradation_signal_detected: unsafeConditions.length > 0,
    unsafe_condition_refs: unsafeConditions.map((condition) => condition.condition_path),
    evidence_status: allConditionsPresent && unsafeConditions.length === 0 ? "model_degradation_halt_ready" : "unsafe_or_incomplete",
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

function buildModelDegradationFixtureRows(evidenceRows) {
  return REQUIRED_FIXTURE_KEYS.map((fixtureKey, index) => {
    const evidenceRow = evidenceRows.find((row) => row.row_key === fixtureKey);
    const row = {
      schema_version: "trading-model-degradation-halt-fixture-row.v1",
      model_degradation_halt_fixture_row_id: `trading-model-degradation-halt-fixtures.row.${fixtureKey}`,
      phase_slot: PHASE_SLOT,
      row_key: fixtureKey,
      unsafe_model_degradation_signal_detected: evidenceRow?.unsafe_model_degradation_signal_detected === true,
      evidence_status: evidenceRow?.evidence_status ?? "missing",
      fixture_should_fail_when_model_degradation_bypassed: true,
      fixture_should_fail_when_promotion_enabled: true,
      fixture_should_fail_when_live_model_enabled: true,
      fixture_status: evidenceRow?.evidence_status === "model_degradation_halt_ready" ? "passed" : "failed",
      model_degradation_bypassed_by_fixture: false,
      model_promotion_enabled_by_fixture: false,
      live_model_enabled_by_fixture: false,
      live_execution_allowed_by_fixture: false,
      command_execution_performed_by_fixture: false,
      artifact_write_performed_by_fixture: false,
      protected_action_executed_by_fixture: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "model_degradation_halt_fixture_hash");
  });
}

function buildModelDegradationBoundary({ generatedAt, writeRequested, lossStreakCooldownFixtures, evidenceRows, fixtureRows }) {
  const unsafeRows = evidenceRows.filter((row) => row.unsafe_model_degradation_signal_detected);
  const sourceBoundary = lossStreakCooldownFixtures.summary;
  return {
    schema_version: "trading-model-degradation-halt-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    model_degradation_halt_artifact_write_requested: writeRequested,
    model_degradation_halt_fixture_execution_performed: false,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    model_degradation_evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    unsafe_model_degradation_signal_count: unsafeRows.length,
    unsafe_model_degradation_signal_refs: unsafeRows.map((row) => row.row_key),
    model_degradation_halt_covered: evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "model_degradation_halt_ready"),
    source_loss_streak_cooldown_status: sourceBoundary.trading_loss_streak_cooldown_fixtures_status,
    source_loss_streak_cooldown_ready: lossStreakCooldownFixtures.validation.valid && sourceBoundary.trading_loss_streak_cooldown_fixtures_status === SOURCE_READY_STATUS,
    risk_model_degradation_source_unbound: observedUnsafeCondition(evidenceRows, "risk.risk_guards.model_degradation_halt.source_ref_bound"),
    risk_degradation_result_not_pass: observedUnsafeCondition(evidenceRows, "risk.risk_guards.model_degradation_halt.degradation_result"),
    risk_model_degradation_halt_not_armed: observedUnsafeCondition(evidenceRows, "risk.risk_guards.model_degradation_halt.halt_on_degradation"),
    risk_model_degradation_result_not_pass: observedUnsafeCondition(evidenceRows, "risk.risk_guards.model_degradation_halt.result"),
    risk_model_degradation_check_not_pass: observedUnsafeCondition(evidenceRows, "risk.risk_check_artifacts[0].checks.model_degradation_halt.status"),
    model_registry_missing: observedUnsafeCondition(evidenceRows, "model_improvement.model_registry.models_present"),
    model_degradation_checks_missing: observedUnsafeCondition(evidenceRows, "model_improvement.degradation_checks.cover_registered_models"),
    model_degradation_checks_allow_promotion: observedUnsafeCondition(evidenceRows, "model_improvement.degradation_checks.block_promotion"),
    model_degradation_halt_present: observedUnsafeCondition(evidenceRows, "model_improvement.degradation_checks.no_halt_result_present"),
    model_auto_live_promotion_allowed: observedUnsafeCondition(evidenceRows, "model_improvement.promotion_policy_gate.auto_live_promotion_allowed"),
    model_live_deployment_allowed: observedUnsafeCondition(evidenceRows, "model_improvement.live_deployment_boundary.live_deployment_allowed"),
    research_model_not_research_only: observedUnsafeCondition(evidenceRows, "research.trading_model.research_only"),
    research_model_live_deployed: observedUnsafeCondition(evidenceRows, "research.trading_model.deployment_stage"),
    research_model_degradation_not_none: observedUnsafeCondition(evidenceRows, "research.trading_model.scorecard.degradation_status"),
    research_model_drift_not_none: observedUnsafeCondition(evidenceRows, "research.trading_model.scorecard.drift_status"),
    research_live_trading_enabled: observedUnsafeCondition(evidenceRows, "research.safety_policy.live_trading_enabled"),
    research_full_auto_not_blocked: observedUnsafeCondition(evidenceRows, "research.stage_policy.full_auto"),
    limited_live_model_degradation_source_unbound: observedUnsafeCondition(evidenceRows, "limited_live.model_live_degradation_check.source_ref_bound"),
    limited_live_model_degradation_result_not_pass: observedUnsafeCondition(evidenceRows, "limited_live.model_live_degradation_check.result"),
    limited_live_model_degradation_halt_not_armed: observedUnsafeCondition(evidenceRows, "limited_live.model_live_degradation_check.halt_on_degradation"),
    limited_live_model_enabled: observedUnsafeCondition(evidenceRows, "limited_live.model_live_degradation_check.live_model_enabled"),
    limited_live_order_submission_allowed: sourceBoundary.live_order_submission_allowed || observedUnsafeCondition(evidenceRows, "limited_live.safety_boundary.live_order_submission_allowed"),
    live_order_submission_allowed: sourceBoundary.live_order_submission_allowed || observedUnsafeCondition(evidenceRows, "limited_live.safety_boundary.live_order_submission_allowed"),
    full_auto_degradation_disable_not_control_plane: observedUnsafeCondition(evidenceRows, "full_auto.automatic_disable_policies.strategy_disable_on_degradation.enabled") || observedUnsafeCondition(evidenceRows, "full_auto.automatic_disable_policies.strategy_disable_on_degradation.trigger_results.halt_present") || observedUnsafeCondition(evidenceRows, "full_auto.automatic_disable_policies.strategy_disable_on_degradation.control_plane_state_change_only"),
    full_auto_model_drift_disable_not_control_plane: observedUnsafeCondition(evidenceRows, "full_auto.automatic_disable_policies.model_disable_on_drift.control_plane_state_change_only"),
    full_auto_live_orders_touched: observedUnsafeCondition(evidenceRows, "full_auto.automatic_disable_policies.strategy_disable_on_degradation.live_orders_touched"),
    full_auto_enabled: observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.full_auto_enabled"),
    automatic_order_submission_allowed: sourceBoundary.automatic_order_submission_allowed || observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.automatic_order_submission_allowed"),
    model_automated_live_deployment_allowed: observedUnsafeCondition(evidenceRows, "model_improvement.safety_boundary.automated_live_deployment_allowed"),
    model_order_intent_generated: observedUnsafeCondition(evidenceRows, "model_improvement.safety_boundary.order_intent_generated"),
    order_intent_generated: sourceBoundary.order_intent_generated || observedUnsafeCondition(evidenceRows, "risk.safety_boundary.order_intent_generated") || observedUnsafeCondition(evidenceRows, "model_improvement.safety_boundary.order_intent_generated"),
    real_order_submitted: sourceBoundary.real_order_submitted,
    live_execution_allowed: sourceBoundary.live_execution_allowed || observedUnsafeCondition(evidenceRows, "risk.safety_boundary.live_execution_allowed"),
    broker_write_allowed: sourceBoundary.broker_write_allowed || observedUnsafeCondition(evidenceRows, "limited_live.safety_boundary.broker_write_allowed") || observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.broker_write_allowed"),
    exchange_write_allowed: sourceBoundary.exchange_write_allowed || observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.exchange_write_allowed"),
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

function buildModelDegradationGateRows({ lossStreakCooldownFixtures, packageJson, platformOpsLedger, riskEngine, modelImprovement, researchBacktestPaper, limitedLive, fullAuto, fixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p398_loss_streak_cooldown_fixtures_ready", "P398 loss-streak cooldown fixtures source is ready.", lossStreakCooldownFixtures.validation.valid && lossStreakCooldownFixtures.summary.trading_loss_streak_cooldown_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P399 trading model degradation halt fixtures command.", typeof scripts["trading:model-degradation-halt-fixtures"] === "string" && scripts["trading:model-degradation-halt-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P399 trading model degradation halt fixtures command.", validateScript.includes("npm run trading:model-degradation-halt-fixtures -- --check")),
    gateRow("p399_ledger_acceptance_declared", "P399 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P399: `trading:model-degradation-halt-fixtures`")),
    gateRow("model_degradation_sources_readable", "All model degradation halt source artifacts are readable.", riskEngine.available && modelImprovement.available && researchBacktestPaper.available && limitedLive.available && fullAuto.available),
    gateRow("required_model_degradation_fixtures_declared", "All required model degradation halt fixtures are declared.", REQUIRED_FIXTURE_KEYS.every((fixtureKey) => fixtureRows.some((row) => row.row_key === fixtureKey)) && fixtureRows.length === REQUIRED_FIXTURE_KEYS.length),
    gateRow("risk_model_degradation_halt_declared", "Risk model degradation halt is bound to model-improvement degradation checks and currently passes.", !boundary.risk_model_degradation_source_unbound && !boundary.risk_degradation_result_not_pass && !boundary.risk_model_degradation_halt_not_armed && !boundary.risk_model_degradation_result_not_pass && !boundary.risk_model_degradation_check_not_pass),
    gateRow("model_improvement_degradation_checks_block_promotion", "Model-improvement degradation checks cover registered models and block promotion.", !boundary.model_registry_missing && !boundary.model_degradation_checks_missing && !boundary.model_degradation_checks_allow_promotion && !boundary.model_degradation_halt_present && !boundary.model_auto_live_promotion_allowed && !boundary.model_live_deployment_allowed),
    gateRow("research_model_degradation_safe", "Research trading-model sample remains paper-stage with no degradation or drift.", !boundary.research_model_not_research_only && !boundary.research_model_live_deployed && !boundary.research_model_degradation_not_none && !boundary.research_model_drift_not_none && !boundary.research_live_trading_enabled && !boundary.research_full_auto_not_blocked),
    gateRow("limited_live_model_degradation_halt_armed", "Limited-live model degradation halt is source-bound, armed, and no live model is enabled.", !boundary.limited_live_model_degradation_source_unbound && !boundary.limited_live_model_degradation_result_not_pass && !boundary.limited_live_model_degradation_halt_not_armed && !boundary.limited_live_model_enabled && !boundary.limited_live_order_submission_allowed),
    gateRow("full_auto_degradation_disable_control_plane_only", "Full-auto degradation disable policy is control-plane-only and touches no live orders.", !boundary.full_auto_degradation_disable_not_control_plane && !boundary.full_auto_model_drift_disable_not_control_plane && !boundary.full_auto_live_orders_touched && !boundary.full_auto_enabled && !boundary.automatic_order_submission_allowed),
    gateRow("no_trading_or_artifact_mutation", "Model degradation halt fixtures do not deploy models, submit orders, execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.model_automated_live_deployment_allowed && !boundary.model_order_intent_generated && !boundary.order_intent_generated && !boundary.live_execution_allowed && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "model_degradation_halt_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-model-degradation-halt-gate-row.v1",
    model_degradation_halt_gate_row_id: `trading-model-degradation-halt-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    model_degradation_bypassed_by_gate: false,
    model_promotion_enabled_by_gate: false,
    live_model_enabled_by_gate: false,
    live_order_submission_allowed_by_gate: false,
    live_execution_allowed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ lossStreakCooldownFixtures, packageJson, platformOpsLedger, riskEngine, modelImprovement, researchBacktestPaper, limitedLive, fullAuto, evidenceRows, fixtureRows, gateRows, boundary }) {
  return [
    validationItem("source.loss_streak_cooldown_fixtures", "p398_loss_streak_cooldown_fixtures_ready", lossStreakCooldownFixtures.validation.valid && lossStreakCooldownFixtures.summary.trading_loss_streak_cooldown_fixtures_status === SOURCE_READY_STATUS, "P398 loss-streak cooldown fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P399 model degradation halt fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.model_degradation_sources", "model_degradation_sources_available", riskEngine.available && modelImprovement.available && researchBacktestPaper.available && limitedLive.available && fullAuto.available, "Model degradation halt source artifacts are readable."),
    validationItem("model_degradation_halt_evidence_rows", "model_degradation_evidence_ready", evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "model_degradation_halt_ready"), "Model degradation halt evidence rows must show safe current state and armed gates."),
    validationItem("model_degradation_halt_fixture_rows", "required_model_degradation_fixtures_pass", fixtureRows.length === REQUIRED_FIXTURE_KEYS.length && fixtureRows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_model_degradation_bypassed), "All model degradation halt fixtures must pass."),
    validationItem("model_degradation_halt_gate_rows", "model_degradation_halt_gates_ready", gateRows.length >= 12 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P399 model degradation halt gates are ready."),
    validationItem("boundary.risk_model_degradation", "risk_model_degradation_halt_declared", !boundary.risk_model_degradation_source_unbound && !boundary.risk_degradation_result_not_pass && !boundary.risk_model_degradation_halt_not_armed && !boundary.risk_model_degradation_result_not_pass && !boundary.risk_model_degradation_check_not_pass, "Risk model degradation halt is declared, source-bound, armed, and currently passing."),
    validationItem("boundary.model_improvement_checks", "model_improvement_degradation_checks_block_promotion", !boundary.model_registry_missing && !boundary.model_degradation_checks_missing && !boundary.model_degradation_checks_allow_promotion && !boundary.model_degradation_halt_present && !boundary.model_auto_live_promotion_allowed && !boundary.model_live_deployment_allowed, "Model improvement degradation checks cover models and block promotion."),
    validationItem("boundary.research_model", "research_model_degradation_safe", !boundary.research_model_not_research_only && !boundary.research_model_live_deployed && !boundary.research_model_degradation_not_none && !boundary.research_model_drift_not_none && !boundary.research_live_trading_enabled && !boundary.research_full_auto_not_blocked, "Research model remains paper-stage with no degradation or drift."),
    validationItem("boundary.limited_live_model_degradation", "limited_live_model_degradation_halt_armed", !boundary.limited_live_model_degradation_source_unbound && !boundary.limited_live_model_degradation_result_not_pass && !boundary.limited_live_model_degradation_halt_not_armed && !boundary.limited_live_model_enabled && !boundary.limited_live_order_submission_allowed, "Limited-live model degradation halt is source-bound and armed."),
    validationItem("boundary.full_auto_disable_policy", "full_auto_degradation_disable_control_plane_only", !boundary.full_auto_degradation_disable_not_control_plane && !boundary.full_auto_model_drift_disable_not_control_plane && !boundary.full_auto_live_orders_touched && !boundary.full_auto_enabled && !boundary.automatic_order_submission_allowed, "Full-auto degradation disable policy remains control-plane-only."),
    validationItem("boundary.no_mutation", "no_trading_or_artifact_mutation", !boundary.model_automated_live_deployment_allowed && !boundary.model_order_intent_generated && !boundary.order_intent_generated && !boundary.live_execution_allowed && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed, "P399 model degradation halt fixtures perform no model deployment, trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ lossStreakCooldownFixtures, evidenceRows, fixtureRows, gateRows, boundary, validation }) {
  return {
    trading_model_degradation_halt_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_loss_streak_cooldown_status: lossStreakCooldownFixtures.summary.trading_loss_streak_cooldown_fixtures_status,
    source_loss_streak_cooldown_ready: boundary.source_loss_streak_cooldown_ready,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    passed_fixture_count: fixtureRows.filter((row) => row.fixture_status === "passed").length,
    failed_fixture_count: fixtureRows.filter((row) => row.fixture_status !== "passed").length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    unsafe_model_degradation_signal_count: boundary.unsafe_model_degradation_signal_count,
    model_degradation_halt_covered: boundary.model_degradation_halt_covered,
    risk_model_degradation_source_unbound: boundary.risk_model_degradation_source_unbound,
    risk_degradation_result_not_pass: boundary.risk_degradation_result_not_pass,
    risk_model_degradation_halt_not_armed: boundary.risk_model_degradation_halt_not_armed,
    risk_model_degradation_result_not_pass: boundary.risk_model_degradation_result_not_pass,
    risk_model_degradation_check_not_pass: boundary.risk_model_degradation_check_not_pass,
    model_registry_missing: boundary.model_registry_missing,
    model_degradation_checks_missing: boundary.model_degradation_checks_missing,
    model_degradation_checks_allow_promotion: boundary.model_degradation_checks_allow_promotion,
    model_degradation_halt_present: boundary.model_degradation_halt_present,
    model_auto_live_promotion_allowed: boundary.model_auto_live_promotion_allowed,
    model_live_deployment_allowed: boundary.model_live_deployment_allowed,
    research_model_not_research_only: boundary.research_model_not_research_only,
    research_model_live_deployed: boundary.research_model_live_deployed,
    research_model_degradation_not_none: boundary.research_model_degradation_not_none,
    research_model_drift_not_none: boundary.research_model_drift_not_none,
    research_live_trading_enabled: boundary.research_live_trading_enabled,
    research_full_auto_not_blocked: boundary.research_full_auto_not_blocked,
    limited_live_model_degradation_source_unbound: boundary.limited_live_model_degradation_source_unbound,
    limited_live_model_degradation_result_not_pass: boundary.limited_live_model_degradation_result_not_pass,
    limited_live_model_degradation_halt_not_armed: boundary.limited_live_model_degradation_halt_not_armed,
    limited_live_model_enabled: boundary.limited_live_model_enabled,
    limited_live_order_submission_allowed: boundary.limited_live_order_submission_allowed,
    live_order_submission_allowed: boundary.live_order_submission_allowed,
    full_auto_degradation_disable_not_control_plane: boundary.full_auto_degradation_disable_not_control_plane,
    full_auto_model_drift_disable_not_control_plane: boundary.full_auto_model_drift_disable_not_control_plane,
    full_auto_live_orders_touched: boundary.full_auto_live_orders_touched,
    full_auto_enabled: boundary.full_auto_enabled,
    automatic_order_submission_allowed: boundary.automatic_order_submission_allowed,
    model_automated_live_deployment_allowed: boundary.model_automated_live_deployment_allowed,
    model_order_intent_generated: boundary.model_order_intent_generated,
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
    "# Trading Model Degradation Halt Fixtures",
    "",
    `Status: ${result.summary.trading_model_degradation_halt_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source loss-streak cooldown: ${result.summary.source_loss_streak_cooldown_status}`,
    `Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`,
    `Unsafe model degradation signals: ${result.summary.unsafe_model_degradation_signal_count}`,
    "",
    "## Fixtures",
    "",
    ...result.model_degradation_halt_fixture_rows.map((row) => `- ${row.row_key}: ${row.fixture_status}`),
    "",
    "## Gates",
    "",
    ...result.model_degradation_halt_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_OUT_DIR };
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
    else if (arg === "--loss-streak-cooldown-fixtures-schema") parsed.lossStreakCooldownFixturesSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-model-degradation-halt-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_OUT_DIR}
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
  --loss-streak-cooldown-fixtures-schema <path>
                                           P398 loss-streak cooldown fixtures schema path.
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_INPUTS.platformOpsLedgerPath),
    loss_streak_cooldown_fixtures_schema_path: path.resolve(options.lossStreakCooldownFixturesSchemaPath ?? DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_INPUTS.lossStreakCooldownFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_INPUTS.executionEnginePath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_INPUTS.riskEnginePath),
    signal_engine_path: path.resolve(options.signalEnginePath ?? DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_INPUTS.signalEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_INPUTS.modelImprovementPath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_INPUTS.researchBacktestPaperPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_MODEL_DEGRADATION_HALT_FIXTURES_INPUTS.schemaPath),
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

function modelRegistryModels(modelImprovement) {
  const models = valueAt(modelImprovement, ["model_registry", "models"]);
  return Array.isArray(models) ? models : [];
}

function degradationChecks(modelImprovement) {
  const checks = valueAt(modelImprovement, ["degradation_checks"]);
  return Array.isArray(checks) ? checks : [];
}

function degradationCheckExists(modelImprovement, checkId) {
  return typeof checkId === "string" && degradationChecks(modelImprovement).some((check) => check?.check_id === checkId);
}

function degradationChecksCoverModels(modelImprovement) {
  const models = modelRegistryModels(modelImprovement);
  const checks = degradationChecks(modelImprovement);
  return models.length > 0 && checks.length >= models.length && models.every((model) => checks.some((check) => check?.model_id === model?.model_id));
}

function degradationChecksBlockPromotion(modelImprovement) {
  const checks = degradationChecks(modelImprovement);
  return checks.length > 0 && checks.every((check) => check?.blocks_promotion === true);
}

function degradationChecksNotHalted(modelImprovement) {
  const checks = degradationChecks(modelImprovement);
  return checks.length > 0 && checks.every((check) => !["fail", "halt"].includes(check?.result));
}

function riskCheckStatus(riskEngine, checkId) {
  const checks = valueAt(riskEngine, ["risk_check_artifacts", 0, "checks"]);
  if (!Array.isArray(checks)) return undefined;
  return checks.find((check) => check?.check_id === checkId)?.status;
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `trading-model-degradation-halt-fixtures.${slugify(itemPath)}.${checkId}`,
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
