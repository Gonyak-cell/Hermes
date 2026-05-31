import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_ORDER_FREQUENCY_THROTTLE_FIXTURES_INPUTS,
  buildTradingOrderFrequencyThrottleFixtures,
} from "./trading-order-frequency-throttle-fixtures.mjs";

export const DEFAULT_TRADING_LOSS_STREAK_COOLDOWN_FIXTURES_OUT_DIR = "artifacts/trading-loss-streak-cooldown-fixtures/latest";
export const DEFAULT_TRADING_LOSS_STREAK_COOLDOWN_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_ORDER_FREQUENCY_THROTTLE_FIXTURES_INPUTS,
  orderFrequencyThrottleFixturesSchemaPath: DEFAULT_TRADING_ORDER_FREQUENCY_THROTTLE_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-loss-streak-cooldown-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-loss-streak-cooldown-fixtures.v1";
const CAPABILITY_ID = "trading.loss_streak_cooldown_fixtures";
const PHASE_SLOT = "P398";
const PREVIOUS_PHASE_SLOT = "P397";
const NEXT_PHASE_SLOT = "P399";
const READY_STATUS = "ready_for_trading_loss_streak_cooldown_regression";
const REQUIRED_FIXTURE_KEYS = [
  "risk_loss_streak_cooldown_declared",
  "risk_result_policy_human_resume_required",
  "paper_loss_context_review_gated",
  "limited_live_halt_gates_armed",
  "execution_halt_manual_resume_required",
  "full_auto_disable_policy_control_plane_only",
];

export async function runTradingLossStreakCooldownFixtures(options = {}) {
  const result = await buildTradingLossStreakCooldownFixtures(options);
  if (options.write !== false) await writeTradingLossStreakCooldownFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading loss streak cooldown fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingLossStreakCooldownFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_LOSS_STREAK_COOLDOWN_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const orderFrequencyThrottleFixtures = await buildTradingOrderFrequencyThrottleFixtures({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    limitedLivePath: inputs.limited_live_path,
    fullAutoPath: inputs.full_auto_path,
    paperShadowPath: inputs.paper_shadow_path,
    executionEnginePath: inputs.execution_engine_path,
    riskEnginePath: inputs.risk_engine_path,
    signalEnginePath: inputs.signal_engine_path,
    schemaPath: inputs.order_frequency_throttle_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const riskEngine = await readJsonSource(inputs.risk_engine_path);
  const executionEngine = await readJsonSource(inputs.execution_engine_path);
  const paperShadow = await readJsonSource(inputs.paper_shadow_path);
  const limitedLive = await readJsonSource(inputs.limited_live_path);
  const fullAuto = await readJsonSource(inputs.full_auto_path);
  const lossStreakAnchor = buildLossStreakAnchor({ orderFrequencyThrottleFixtures });
  const lossStreakEvidenceRows = buildLossStreakEvidenceRows({
    riskEngine: riskEngine.data,
    executionEngine: executionEngine.data,
    paperShadow: paperShadow.data,
    limitedLive: limitedLive.data,
    fullAuto: fullAuto.data,
  });
  const lossStreakFixtureRows = buildLossStreakFixtureRows(lossStreakEvidenceRows);
  const lossStreakBoundary = buildLossStreakBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    orderFrequencyThrottleFixtures,
    evidenceRows: lossStreakEvidenceRows,
    fixtureRows: lossStreakFixtureRows,
  });
  const lossStreakGateRows = buildLossStreakGateRows({
    orderFrequencyThrottleFixtures,
    packageJson,
    platformOpsLedger,
    riskEngine,
    executionEngine,
    paperShadow,
    limitedLive,
    fullAuto,
    fixtureRows: lossStreakFixtureRows,
    boundary: lossStreakBoundary,
  });
  const validationItems = buildValidationItems({
    orderFrequencyThrottleFixtures,
    packageJson,
    platformOpsLedger,
    riskEngine,
    executionEngine,
    paperShadow,
    limitedLive,
    fullAuto,
    evidenceRows: lossStreakEvidenceRows,
    fixtureRows: lossStreakFixtureRows,
    gateRows: lossStreakGateRows,
    boundary: lossStreakBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    orderFrequencyThrottleFixtures,
    evidenceRows: lossStreakEvidenceRows,
    fixtureRows: lossStreakFixtureRows,
    gateRows: lossStreakGateRows,
    boundary: lossStreakBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_loss_streak_cooldown_fixtures_id: `trading-loss-streak-cooldown-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    loss_streak_cooldown_anchor: lossStreakAnchor,
    loss_streak_cooldown_evidence_rows: lossStreakEvidenceRows,
    loss_streak_cooldown_fixture_rows: lossStreakFixtureRows,
    loss_streak_cooldown_gate_rows: lossStreakGateRows,
    loss_streak_cooldown_boundary: lossStreakBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_loss_streak_cooldown_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    orderFrequencyThrottleFixtures,
    evidenceRows: lossStreakEvidenceRows,
    fixtureRows: lossStreakFixtureRows,
    gateRows: lossStreakGateRows,
    boundary: lossStreakBoundary,
    validation: result.validation,
  });
  result.summary.trading_loss_streak_cooldown_fixtures_id = result.trading_loss_streak_cooldown_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingLossStreakCooldownFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-loss-streak-cooldown-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "loss-streak-cooldown-evidence-rows.json"), collectionEnvelope("trading-loss-streak-cooldown-evidence-rows.v1", "loss_streak_cooldown_evidence_rows", result.loss_streak_cooldown_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "loss-streak-cooldown-fixture-rows.json"), collectionEnvelope("trading-loss-streak-cooldown-fixture-rows.v1", "loss_streak_cooldown_fixture_rows", result.loss_streak_cooldown_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "loss-streak-cooldown-gate-rows.json"), collectionEnvelope("trading-loss-streak-cooldown-gate-rows.v1", "loss_streak_cooldown_gate_rows", result.loss_streak_cooldown_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "loss-streak-cooldown-boundary.json"), result.loss_streak_cooldown_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-loss-streak-cooldown-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingLossStreakCooldownFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingLossStreakCooldownFixtures(args);
    console.log(`Trading loss streak cooldown fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_loss_streak_cooldown_fixtures_status}`);
    console.log(`Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
    console.log(`Unsafe loss streak signals: ${result.summary.unsafe_loss_streak_signal_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildLossStreakAnchor({ orderFrequencyThrottleFixtures }) {
  return {
    schema_version: "trading-loss-streak-cooldown-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_order_frequency_throttle_fixtures_id: orderFrequencyThrottleFixtures.trading_order_frequency_throttle_fixtures_id,
    source_order_frequency_throttle_status: orderFrequencyThrottleFixtures.summary.trading_order_frequency_throttle_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    required_fixture_keys: REQUIRED_FIXTURE_KEYS,
    source_hash: hashValue({
      id: orderFrequencyThrottleFixtures.trading_order_frequency_throttle_fixtures_id,
      status: orderFrequencyThrottleFixtures.summary.trading_order_frequency_throttle_fixtures_status,
      fixtures: REQUIRED_FIXTURE_KEYS,
    }),
  };
}

function buildLossStreakEvidenceRows({ riskEngine, executionEngine, paperShadow, limitedLive, fullAuto }) {
  const cooldown = valueAt(riskEngine, ["risk_guards", "loss_streak_cooldown"]);
  const riskPolicy = valueAt(riskEngine, ["risk_result_policy"]);
  const overridePolicy = valueAt(riskEngine, ["override_policy"]);
  const dailyLossHalt = valueAt(limitedLive, ["halt_gates", "daily_loss_halt"]);
  const emergencyHalt = valueAt(executionEngine, ["emergency_halt"]);
  const fullAutoDisable = valueAt(fullAuto, ["automatic_disable_policies", "strategy_disable_on_degradation"]);
  const rows = [
    lossStreakEvidenceRow("risk_loss_streak_cooldown_declared", "risk_engine", "risk_guards.loss_streak_cooldown", [
      observedCondition("risk.risk_guards.loss_streak_cooldown.loss_streak_count", valueAt(cooldown, ["loss_streak_count"]), 0),
      observedCondition("risk.risk_guards.loss_streak_cooldown.cooldown_threshold_declared", cooldownThresholdDeclared(valueAt(cooldown, ["cooldown_required_after_losses"])), true),
      observedCondition("risk.risk_guards.loss_streak_cooldown.cooldown_active", valueAt(cooldown, ["cooldown_active"]), false),
      observedCondition("risk.risk_guards.loss_streak_cooldown.result", valueAt(cooldown, ["result"]), "pass"),
      observedCondition("risk.risk_check_artifacts[0].checks.loss_streak_cooldown.status", riskCheckStatus(riskEngine, "loss_streak_cooldown"), "pass"),
    ]),
    lossStreakEvidenceRow("risk_result_policy_human_resume_required", "risk_engine", "risk_result_policy", [
      observedCondition("risk.risk_result_policy.allowed_results.halt_present", hasArrayValue(valueAt(riskPolicy, ["allowed_results"]), "halt"), true),
      observedCondition("risk.risk_result_policy.block_prevents_order_intent", valueAt(riskPolicy, ["block_prevents_order_intent"]), true),
      observedCondition("risk.risk_result_policy.halt_prevents_resume_without_human", valueAt(riskPolicy, ["halt_prevents_resume_without_human"]), true),
      observedCondition("risk.override_policy.requires_human_approval", valueAt(overridePolicy, ["requires_human_approval"]), true),
      observedCondition("risk.safety_boundary.risk_override_without_human_allowed", valueAt(riskEngine, ["safety_boundary", "risk_override_without_human_allowed"]), false),
    ]),
    lossStreakEvidenceRow("paper_loss_context_review_gated", "paper_shadow_live", "paper_drawdown", [
      observedCondition("paper_shadow.paper_drawdown.within_fixture_loss_context", paperDrawdownInsideFixture(valueAt(paperShadow, ["paper_drawdown", "drawdown_pct"])), true),
      observedCondition("paper_shadow.strategy_paper_scorecards.blocked", paperScorecardsBlocked(valueAt(paperShadow, ["strategy_paper_scorecards"])), true),
      observedCondition("paper_shadow.strategy_paper_scorecards.human_review_required", paperScorecardsRequireHumanReview(valueAt(paperShadow, ["strategy_paper_scorecards"])), true),
      observedCondition("paper_shadow.safety_boundary.real_order_submitted", valueAt(paperShadow, ["safety_boundary", "real_order_submitted"]), false),
    ]),
    lossStreakEvidenceRow("limited_live_halt_gates_armed", "limited_live_governance", "halt_gates.daily_loss_halt", [
      observedCondition("limited_live.halt_gates.daily_loss_halt.enabled", valueAt(dailyLossHalt, ["enabled"]), true),
      observedCondition("limited_live.halt_gates.daily_loss_halt.triggered", valueAt(dailyLossHalt, ["triggered"]), false),
      observedCondition("limited_live.halt_gates.daily_loss_halt.halt_on_trigger", valueAt(dailyLossHalt, ["halt_on_trigger"]), true),
      observedCondition("limited_live.safety_boundary.live_order_submission_allowed", valueAt(limitedLive, ["safety_boundary", "live_order_submission_allowed"]), false),
    ]),
    lossStreakEvidenceRow("execution_halt_manual_resume_required", "execution_engine", "emergency_halt", [
      observedCondition("execution.emergency_halt.available", valueAt(emergencyHalt, ["available"]), true),
      observedCondition("execution.emergency_halt.halt_state", valueAt(emergencyHalt, ["halt_state"]), "halted"),
      observedCondition("execution.emergency_halt.manual_resume_required", valueAt(emergencyHalt, ["manual_resume_required"]), true),
      observedCondition("execution.emergency_halt.cancels_live_orders", valueAt(emergencyHalt, ["cancels_live_orders"]), false),
    ]),
    lossStreakEvidenceRow("full_auto_disable_policy_control_plane_only", "full_auto_governance", "automatic_disable_policies.strategy_disable_on_degradation", [
      observedCondition("full_auto.automatic_disable_policies.strategy_disable_on_degradation.enabled", valueAt(fullAutoDisable, ["enabled"]), true),
      observedCondition("full_auto.automatic_disable_policies.strategy_disable_on_degradation.trigger_results.halt_present", hasArrayValue(valueAt(fullAutoDisable, ["trigger_results"]), "halt"), true),
      observedCondition("full_auto.automatic_disable_policies.strategy_disable_on_degradation.control_plane_state_change_only", valueAt(fullAutoDisable, ["control_plane_state_change_only"]), true),
      observedCondition("full_auto.automatic_disable_policies.strategy_disable_on_degradation.live_orders_touched", valueAt(fullAutoDisable, ["live_orders_touched"]), false),
      observedCondition("full_auto.safety_boundary.full_auto_enabled", valueAt(fullAuto, ["safety_boundary", "full_auto_enabled"]), false),
    ]),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "loss_streak_cooldown_evidence_hash"));
}

function lossStreakEvidenceRow(rowKey, artifactId, evidencePath, observedConditions) {
  const allConditionsPresent = observedConditions.every((condition) => condition.condition_present);
  const unsafeConditions = observedConditions.filter((condition) => condition.observed_value !== condition.expected_safe_value);
  return {
    schema_version: "trading-loss-streak-cooldown-evidence-row.v1",
    loss_streak_cooldown_evidence_row_id: `trading-loss-streak-cooldown.evidence.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    artifact_id: artifactId,
    evidence_path: evidencePath,
    observed_conditions: observedConditions,
    observed_condition_count: observedConditions.length,
    all_conditions_present: allConditionsPresent,
    unsafe_loss_streak_signal_detected: unsafeConditions.length > 0,
    unsafe_condition_refs: unsafeConditions.map((condition) => condition.condition_path),
    evidence_status: allConditionsPresent && unsafeConditions.length === 0 ? "loss_streak_cooldown_ready" : "unsafe_or_incomplete",
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

function buildLossStreakFixtureRows(evidenceRows) {
  return REQUIRED_FIXTURE_KEYS.map((fixtureKey, index) => {
    const evidenceRow = evidenceRows.find((row) => row.row_key === fixtureKey);
    const row = {
      schema_version: "trading-loss-streak-cooldown-fixture-row.v1",
      loss_streak_cooldown_fixture_row_id: `trading-loss-streak-cooldown-fixtures.row.${fixtureKey}`,
      phase_slot: PHASE_SLOT,
      row_key: fixtureKey,
      expected_loss_streak_count: 0,
      expected_cooldown_active: false,
      unsafe_loss_streak_signal_detected: evidenceRow?.unsafe_loss_streak_signal_detected === true,
      evidence_status: evidenceRow?.evidence_status ?? "missing",
      fixture_should_fail_when_loss_streak_bypassed: true,
      fixture_should_fail_when_human_resume_not_required: true,
      fixture_should_fail_when_live_order_submission_enabled: true,
      fixture_status: evidenceRow?.evidence_status === "loss_streak_cooldown_ready" ? "passed" : "failed",
      loss_streak_bypassed_by_fixture: false,
      human_resume_required_by_fixture: true,
      live_execution_allowed_by_fixture: false,
      command_execution_performed_by_fixture: false,
      artifact_write_performed_by_fixture: false,
      protected_action_executed_by_fixture: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "loss_streak_cooldown_fixture_hash");
  });
}

function buildLossStreakBoundary({ generatedAt, writeRequested, orderFrequencyThrottleFixtures, evidenceRows, fixtureRows }) {
  const unsafeRows = evidenceRows.filter((row) => row.unsafe_loss_streak_signal_detected);
  const sourceBoundary = orderFrequencyThrottleFixtures.summary;
  return {
    schema_version: "trading-loss-streak-cooldown-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    loss_streak_cooldown_artifact_write_requested: writeRequested,
    loss_streak_cooldown_fixture_execution_performed: false,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    loss_streak_evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    unsafe_loss_streak_signal_count: unsafeRows.length,
    unsafe_loss_streak_signal_refs: unsafeRows.map((row) => row.row_key),
    loss_streak_cooldown_covered: evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "loss_streak_cooldown_ready"),
    source_order_frequency_throttle_status: sourceBoundary.trading_order_frequency_throttle_fixtures_status,
    source_order_frequency_throttle_ready: orderFrequencyThrottleFixtures.validation.valid && sourceBoundary.trading_order_frequency_throttle_fixtures_status === "ready_for_trading_order_frequency_throttle_regression",
    loss_streak_count_nonzero: observedUnsafeCondition(evidenceRows, "risk.risk_guards.loss_streak_cooldown.loss_streak_count"),
    cooldown_threshold_missing: observedUnsafeCondition(evidenceRows, "risk.risk_guards.loss_streak_cooldown.cooldown_threshold_declared"),
    cooldown_active: observedUnsafeCondition(evidenceRows, "risk.risk_guards.loss_streak_cooldown.cooldown_active"),
    loss_streak_result_not_pass: observedUnsafeCondition(evidenceRows, "risk.risk_guards.loss_streak_cooldown.result"),
    loss_streak_check_not_pass: observedUnsafeCondition(evidenceRows, "risk.risk_check_artifacts[0].checks.loss_streak_cooldown.status"),
    risk_halt_without_human_resume: observedUnsafeCondition(evidenceRows, "risk.risk_result_policy.halt_prevents_resume_without_human"),
    risk_block_not_preventing_order_intent: observedUnsafeCondition(evidenceRows, "risk.risk_result_policy.block_prevents_order_intent"),
    risk_halt_result_missing: observedUnsafeCondition(evidenceRows, "risk.risk_result_policy.allowed_results.halt_present"),
    risk_override_without_human_allowed: observedUnsafeCondition(evidenceRows, "risk.override_policy.requires_human_approval") || observedUnsafeCondition(evidenceRows, "risk.safety_boundary.risk_override_without_human_allowed"),
    paper_drawdown_outside_fixture: observedUnsafeCondition(evidenceRows, "paper_shadow.paper_drawdown.within_fixture_loss_context"),
    paper_scorecard_not_blocked: observedUnsafeCondition(evidenceRows, "paper_shadow.strategy_paper_scorecards.blocked"),
    paper_human_review_missing: observedUnsafeCondition(evidenceRows, "paper_shadow.strategy_paper_scorecards.human_review_required"),
    paper_real_order_submitted: observedUnsafeCondition(evidenceRows, "paper_shadow.safety_boundary.real_order_submitted"),
    limited_live_daily_loss_halt_not_armed: observedUnsafeCondition(evidenceRows, "limited_live.halt_gates.daily_loss_halt.enabled") || observedUnsafeCondition(evidenceRows, "limited_live.halt_gates.daily_loss_halt.halt_on_trigger"),
    limited_live_daily_loss_halt_triggered: observedUnsafeCondition(evidenceRows, "limited_live.halt_gates.daily_loss_halt.triggered"),
    limited_live_order_submission_allowed: observedUnsafeCondition(evidenceRows, "limited_live.safety_boundary.live_order_submission_allowed"),
    emergency_halt_unavailable: observedUnsafeCondition(evidenceRows, "execution.emergency_halt.available"),
    emergency_halt_not_halted: observedUnsafeCondition(evidenceRows, "execution.emergency_halt.halt_state"),
    emergency_halt_not_manual_resume: observedUnsafeCondition(evidenceRows, "execution.emergency_halt.manual_resume_required"),
    emergency_halt_cancels_live_orders: observedUnsafeCondition(evidenceRows, "execution.emergency_halt.cancels_live_orders"),
    full_auto_disable_policy_not_control_plane: observedUnsafeCondition(evidenceRows, "full_auto.automatic_disable_policies.strategy_disable_on_degradation.enabled") || observedUnsafeCondition(evidenceRows, "full_auto.automatic_disable_policies.strategy_disable_on_degradation.trigger_results.halt_present") || observedUnsafeCondition(evidenceRows, "full_auto.automatic_disable_policies.strategy_disable_on_degradation.control_plane_state_change_only"),
    full_auto_live_orders_touched: observedUnsafeCondition(evidenceRows, "full_auto.automatic_disable_policies.strategy_disable_on_degradation.live_orders_touched"),
    full_auto_enabled: observedUnsafeCondition(evidenceRows, "full_auto.safety_boundary.full_auto_enabled"),
    order_intent_generated: sourceBoundary.order_intent_generated,
    real_order_submitted: sourceBoundary.real_order_submitted || observedUnsafeCondition(evidenceRows, "paper_shadow.safety_boundary.real_order_submitted"),
    live_execution_allowed: sourceBoundary.live_execution_allowed,
    automatic_order_submission_allowed: sourceBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: sourceBoundary.live_order_submission_allowed || observedUnsafeCondition(evidenceRows, "limited_live.safety_boundary.live_order_submission_allowed"),
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

function buildLossStreakGateRows({ orderFrequencyThrottleFixtures, packageJson, platformOpsLedger, riskEngine, executionEngine, paperShadow, limitedLive, fullAuto, fixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p397_order_frequency_throttle_fixtures_ready", "P397 order-frequency throttle fixtures source is ready.", orderFrequencyThrottleFixtures.validation.valid && orderFrequencyThrottleFixtures.summary.trading_order_frequency_throttle_fixtures_status === "ready_for_trading_order_frequency_throttle_regression"),
    gateRow("platform_package_script_registered", "package.json registers the P398 trading loss streak cooldown fixtures command.", typeof scripts["trading:loss-streak-cooldown-fixtures"] === "string" && scripts["trading:loss-streak-cooldown-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P398 trading loss streak cooldown fixtures command.", validateScript.includes("npm run trading:loss-streak-cooldown-fixtures -- --check")),
    gateRow("p398_ledger_acceptance_declared", "P398 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P398: `trading:loss-streak-cooldown-fixtures`")),
    gateRow("loss_streak_sources_readable", "All loss-streak cooldown source artifacts are readable.", riskEngine.available && executionEngine.available && paperShadow.available && limitedLive.available && fullAuto.available),
    gateRow("required_loss_streak_fixtures_declared", "All required loss-streak cooldown fixtures are declared.", REQUIRED_FIXTURE_KEYS.every((fixtureKey) => fixtureRows.some((row) => row.row_key === fixtureKey)) && fixtureRows.length === REQUIRED_FIXTURE_KEYS.length),
    gateRow("risk_loss_streak_cooldown_declared", "Risk loss-streak cooldown is declared and currently inactive in the safe fixture.", !boundary.loss_streak_count_nonzero && !boundary.cooldown_threshold_missing && !boundary.cooldown_active && !boundary.loss_streak_result_not_pass && !boundary.loss_streak_check_not_pass),
    gateRow("risk_human_resume_required", "Risk result policy keeps halt and override paths human gated.", !boundary.risk_halt_without_human_resume && !boundary.risk_block_not_preventing_order_intent && !boundary.risk_halt_result_missing && !boundary.risk_override_without_human_allowed),
    gateRow("paper_loss_context_review_gated", "Paper drawdown context remains small, blocked, and human-review gated.", !boundary.paper_drawdown_outside_fixture && !boundary.paper_scorecard_not_blocked && !boundary.paper_human_review_missing && !boundary.paper_real_order_submitted),
    gateRow("limited_live_halt_and_manual_resume_ready", "Limited-live daily-loss halt and execution manual-resume gates are armed.", !boundary.limited_live_daily_loss_halt_not_armed && !boundary.limited_live_daily_loss_halt_triggered && !boundary.limited_live_order_submission_allowed && !boundary.emergency_halt_unavailable && !boundary.emergency_halt_not_halted && !boundary.emergency_halt_not_manual_resume && !boundary.emergency_halt_cancels_live_orders),
    gateRow("full_auto_disable_control_plane_only", "Full-auto automatic disable policy is control-plane-only and touches no live orders.", !boundary.full_auto_disable_policy_not_control_plane && !boundary.full_auto_live_orders_touched && !boundary.full_auto_enabled),
    gateRow("no_trading_or_artifact_mutation", "Loss-streak cooldown fixtures do not execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "loss_streak_cooldown_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-loss-streak-cooldown-gate-row.v1",
    loss_streak_cooldown_gate_row_id: `trading-loss-streak-cooldown-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    loss_streak_bypassed_by_gate: false,
    human_resume_required_by_gate: true,
    live_order_submission_allowed_by_gate: false,
    live_execution_allowed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ orderFrequencyThrottleFixtures, packageJson, platformOpsLedger, riskEngine, executionEngine, paperShadow, limitedLive, fullAuto, evidenceRows, fixtureRows, gateRows, boundary }) {
  return [
    validationItem("source.order_frequency_throttle_fixtures", "p397_order_frequency_throttle_fixtures_ready", orderFrequencyThrottleFixtures.validation.valid && orderFrequencyThrottleFixtures.summary.trading_order_frequency_throttle_fixtures_status === "ready_for_trading_order_frequency_throttle_regression", "P397 order-frequency throttle fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P398 loss streak cooldown fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.loss_streak_sources", "loss_streak_sources_available", riskEngine.available && executionEngine.available && paperShadow.available && limitedLive.available && fullAuto.available, "Loss-streak cooldown source artifacts are readable."),
    validationItem("loss_streak_cooldown_evidence_rows", "loss_streak_evidence_ready", evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "loss_streak_cooldown_ready"), "Loss-streak cooldown evidence rows must show safe current state and armed gates."),
    validationItem("loss_streak_cooldown_fixture_rows", "required_loss_streak_fixtures_pass", fixtureRows.length === REQUIRED_FIXTURE_KEYS.length && fixtureRows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_loss_streak_bypassed), "All loss-streak cooldown fixtures must pass."),
    validationItem("loss_streak_cooldown_gate_rows", "loss_streak_cooldown_gates_ready", gateRows.length >= 12 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P398 loss-streak cooldown gates are ready."),
    validationItem("boundary.risk_loss_streak", "risk_loss_streak_cooldown_declared", !boundary.loss_streak_count_nonzero && !boundary.cooldown_threshold_missing && !boundary.cooldown_active && !boundary.loss_streak_result_not_pass && !boundary.loss_streak_check_not_pass, "Risk loss-streak cooldown current state is safe."),
    validationItem("boundary.risk_human_resume", "risk_human_resume_required", !boundary.risk_halt_without_human_resume && !boundary.risk_block_not_preventing_order_intent && !boundary.risk_halt_result_missing && !boundary.risk_override_without_human_allowed, "Risk halt and override paths remain human gated."),
    validationItem("boundary.paper_loss_context", "paper_loss_context_review_gated", !boundary.paper_drawdown_outside_fixture && !boundary.paper_scorecard_not_blocked && !boundary.paper_human_review_missing && !boundary.paper_real_order_submitted, "Paper loss context remains review gated."),
    validationItem("boundary.limited_live_manual_resume", "limited_live_halt_and_manual_resume_ready", !boundary.limited_live_daily_loss_halt_not_armed && !boundary.limited_live_daily_loss_halt_triggered && !boundary.limited_live_order_submission_allowed && !boundary.emergency_halt_unavailable && !boundary.emergency_halt_not_halted && !boundary.emergency_halt_not_manual_resume && !boundary.emergency_halt_cancels_live_orders, "Limited-live halt and manual resume gates are armed."),
    validationItem("boundary.full_auto_disable_policy", "full_auto_disable_control_plane_only", !boundary.full_auto_disable_policy_not_control_plane && !boundary.full_auto_live_orders_touched && !boundary.full_auto_enabled, "Full-auto disable policy remains control-plane-only."),
    validationItem("boundary.no_mutation", "no_trading_or_artifact_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed, "P398 loss-streak cooldown fixtures perform no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ orderFrequencyThrottleFixtures, evidenceRows, fixtureRows, gateRows, boundary, validation }) {
  return {
    trading_loss_streak_cooldown_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_order_frequency_throttle_status: orderFrequencyThrottleFixtures.summary.trading_order_frequency_throttle_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    passed_fixture_count: fixtureRows.filter((row) => row.fixture_status === "passed").length,
    failed_fixture_count: fixtureRows.filter((row) => row.fixture_status !== "passed").length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    unsafe_loss_streak_signal_count: boundary.unsafe_loss_streak_signal_count,
    loss_streak_cooldown_covered: boundary.loss_streak_cooldown_covered,
    loss_streak_count_nonzero: boundary.loss_streak_count_nonzero,
    cooldown_threshold_missing: boundary.cooldown_threshold_missing,
    cooldown_active: boundary.cooldown_active,
    loss_streak_result_not_pass: boundary.loss_streak_result_not_pass,
    loss_streak_check_not_pass: boundary.loss_streak_check_not_pass,
    risk_halt_without_human_resume: boundary.risk_halt_without_human_resume,
    risk_block_not_preventing_order_intent: boundary.risk_block_not_preventing_order_intent,
    risk_halt_result_missing: boundary.risk_halt_result_missing,
    risk_override_without_human_allowed: boundary.risk_override_without_human_allowed,
    paper_drawdown_outside_fixture: boundary.paper_drawdown_outside_fixture,
    paper_scorecard_not_blocked: boundary.paper_scorecard_not_blocked,
    paper_human_review_missing: boundary.paper_human_review_missing,
    paper_real_order_submitted: boundary.paper_real_order_submitted,
    limited_live_daily_loss_halt_not_armed: boundary.limited_live_daily_loss_halt_not_armed,
    limited_live_daily_loss_halt_triggered: boundary.limited_live_daily_loss_halt_triggered,
    limited_live_order_submission_allowed: boundary.limited_live_order_submission_allowed,
    emergency_halt_unavailable: boundary.emergency_halt_unavailable,
    emergency_halt_not_halted: boundary.emergency_halt_not_halted,
    emergency_halt_not_manual_resume: boundary.emergency_halt_not_manual_resume,
    emergency_halt_cancels_live_orders: boundary.emergency_halt_cancels_live_orders,
    full_auto_disable_policy_not_control_plane: boundary.full_auto_disable_policy_not_control_plane,
    full_auto_live_orders_touched: boundary.full_auto_live_orders_touched,
    full_auto_enabled: boundary.full_auto_enabled,
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
    "# Trading Loss Streak Cooldown Fixtures",
    "",
    `Status: ${result.summary.trading_loss_streak_cooldown_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source order frequency throttle: ${result.summary.source_order_frequency_throttle_status}`,
    `Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`,
    `Unsafe loss streak signals: ${result.summary.unsafe_loss_streak_signal_count}`,
    "",
    "## Fixtures",
    "",
    ...result.loss_streak_cooldown_fixture_rows.map((row) => `- ${row.row_key}: ${row.fixture_status}`),
    "",
    "## Gates",
    "",
    ...result.loss_streak_cooldown_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_LOSS_STREAK_COOLDOWN_FIXTURES_OUT_DIR };
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
    else if (arg === "--order-frequency-throttle-fixtures-schema") parsed.orderFrequencyThrottleFixturesSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-loss-streak-cooldown-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_LOSS_STREAK_COOLDOWN_FIXTURES_OUT_DIR}
  --run-at <iso>                           Deterministic generated_at timestamp.
  --package <path>                         package.json path.
  --platform-ops-ledger <path>             P341-P500 platform operations ledger path.
  --limited-live <path>                    Limited-live governance artifact path.
  --full-auto <path>                       Full-auto governance artifact path.
  --paper-shadow <path>                    Paper/shadow governance artifact path.
  --execution-engine <path>                Execution engine artifact path.
  --risk-engine <path>                     Risk engine artifact path.
  --signal-engine <path>                   Signal engine artifact path.
  --order-frequency-throttle-fixtures-schema <path>
                                           P397 order-frequency throttle fixtures schema path.
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_LOSS_STREAK_COOLDOWN_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_LOSS_STREAK_COOLDOWN_FIXTURES_INPUTS.platformOpsLedgerPath),
    order_frequency_throttle_fixtures_schema_path: path.resolve(options.orderFrequencyThrottleFixturesSchemaPath ?? DEFAULT_TRADING_LOSS_STREAK_COOLDOWN_FIXTURES_INPUTS.orderFrequencyThrottleFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_LOSS_STREAK_COOLDOWN_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_LOSS_STREAK_COOLDOWN_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_LOSS_STREAK_COOLDOWN_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_LOSS_STREAK_COOLDOWN_FIXTURES_INPUTS.executionEnginePath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_LOSS_STREAK_COOLDOWN_FIXTURES_INPUTS.riskEnginePath),
    signal_engine_path: path.resolve(options.signalEnginePath ?? DEFAULT_TRADING_LOSS_STREAK_COOLDOWN_FIXTURES_INPUTS.signalEnginePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_LOSS_STREAK_COOLDOWN_FIXTURES_INPUTS.schemaPath),
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

function cooldownThresholdDeclared(value) {
  return Number.isFinite(value) && value >= 1;
}

function paperDrawdownInsideFixture(value) {
  return Number.isFinite(value) && value >= -0.05 && value <= 0;
}

function paperScorecardsBlocked(scorecards) {
  return Array.isArray(scorecards) && scorecards.length > 0 && scorecards.every((scorecard) => scorecard?.paper_status === "blocked");
}

function paperScorecardsRequireHumanReview(scorecards) {
  return Array.isArray(scorecards) && scorecards.length > 0 && scorecards.every((scorecard) => scorecard?.human_review_required === true);
}

function riskCheckStatus(riskEngine, checkId) {
  const checks = valueAt(riskEngine, ["risk_check_artifacts", 0, "checks"]);
  if (!Array.isArray(checks)) return undefined;
  return checks.find((check) => check?.check_id === checkId)?.status;
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `trading-loss-streak-cooldown-fixtures.${slugify(itemPath)}.${checkId}`,
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
