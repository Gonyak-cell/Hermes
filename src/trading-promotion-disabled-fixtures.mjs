import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS,
  buildTradingRiskOverrideDisabledFixtures,
} from "./trading-risk-override-disabled-fixtures.mjs";

export const DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_OUT_DIR = "artifacts/trading-promotion-disabled-fixtures/latest";
export const DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS,
  riskOverrideDisabledFixturesSchemaPath: DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.schemaPath,
  backtestValidationPath: "examples/trading/backtest-validation.json",
  schemaPath: "schemas/trading/trading-promotion-disabled-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-promotion-disabled-fixtures.v1";
const CAPABILITY_ID = "trading.promotion_disabled_fixtures";
const PHASE_SLOT = "P391";
const PREVIOUS_PHASE_SLOT = "P390";
const NEXT_PHASE_SLOT = "P392";
const READY_STATUS = "ready_for_trading_promotion_disabled_regression";
const REQUIRED_FIXTURE_KEYS = [
  "model_promotion_policy_gate_blocks_live",
  "backtest_promotion_boundary_disabled",
  "paper_to_shadow_promotion_human_gate",
  "shadow_to_limited_live_promotion_blocked",
  "limited_live_to_full_auto_promotion_blocked",
  "full_auto_approval_without_receipt_blocked",
];

export async function runTradingPromotionDisabledFixtures(options = {}) {
  const result = await buildTradingPromotionDisabledFixtures(options);
  if (options.write !== false) await writeTradingPromotionDisabledFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading promotion disabled fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingPromotionDisabledFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const riskOverrideDisabledFixtures = await buildTradingRiskOverrideDisabledFixtures({
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
    limitedLivePath: inputs.limited_live_path,
    fullAutoPath: inputs.full_auto_path,
    paperShadowPath: inputs.paper_shadow_path,
    executionEnginePath: inputs.execution_engine_path,
    modelImprovementPath: inputs.model_improvement_path,
    riskEnginePath: inputs.risk_engine_path,
    marketDataFeatureStorePath: inputs.market_data_feature_store_path,
    researchBacktestPaperPath: inputs.research_backtest_paper_path,
    routeSourcePaths: inputs.route_source_paths,
    schemaPath: inputs.risk_override_disabled_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const modelImprovement = await readJsonSource(inputs.model_improvement_path);
  const backtestValidation = await readJsonSource(inputs.backtest_validation_path);
  const paperShadow = await readJsonSource(inputs.paper_shadow_path);
  const limitedLive = await readJsonSource(inputs.limited_live_path);
  const fullAuto = await readJsonSource(inputs.full_auto_path);
  const promotionAnchor = buildPromotionAnchor({ riskOverrideDisabledFixtures });
  const promotionEvidenceRows = buildPromotionEvidenceRows({
    modelImprovement: modelImprovement.data,
    backtestValidation: backtestValidation.data,
    paperShadow: paperShadow.data,
    limitedLive: limitedLive.data,
    fullAuto: fullAuto.data,
  });
  const promotionFixtureRows = buildPromotionFixtureRows(promotionEvidenceRows);
  const promotionBoundary = buildPromotionBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    riskOverrideDisabledFixtures,
    evidenceRows: promotionEvidenceRows,
    fixtureRows: promotionFixtureRows,
  });
  const promotionGateRows = buildPromotionGateRows({
    riskOverrideDisabledFixtures,
    packageJson,
    platformOpsLedger,
    modelImprovement,
    backtestValidation,
    paperShadow,
    limitedLive,
    fullAuto,
    fixtureRows: promotionFixtureRows,
    boundary: promotionBoundary,
  });
  const validationItems = buildValidationItems({
    riskOverrideDisabledFixtures,
    packageJson,
    platformOpsLedger,
    modelImprovement,
    backtestValidation,
    paperShadow,
    limitedLive,
    fullAuto,
    evidenceRows: promotionEvidenceRows,
    fixtureRows: promotionFixtureRows,
    gateRows: promotionGateRows,
    boundary: promotionBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    riskOverrideDisabledFixtures,
    evidenceRows: promotionEvidenceRows,
    fixtureRows: promotionFixtureRows,
    gateRows: promotionGateRows,
    boundary: promotionBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_promotion_disabled_fixtures_id: `trading-promotion-disabled-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    promotion_disabled_anchor: promotionAnchor,
    promotion_disabled_evidence_rows: promotionEvidenceRows,
    promotion_disabled_fixture_rows: promotionFixtureRows,
    promotion_disabled_gate_rows: promotionGateRows,
    promotion_disabled_boundary: promotionBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_promotion_disabled_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    riskOverrideDisabledFixtures,
    evidenceRows: promotionEvidenceRows,
    fixtureRows: promotionFixtureRows,
    gateRows: promotionGateRows,
    boundary: promotionBoundary,
    validation: result.validation,
  });
  result.summary.trading_promotion_disabled_fixtures_id = result.trading_promotion_disabled_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingPromotionDisabledFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-promotion-disabled-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "promotion-disabled-evidence-rows.json"), collectionEnvelope("trading-promotion-disabled-evidence-rows.v1", "promotion_disabled_evidence_rows", result.promotion_disabled_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-disabled-fixture-rows.json"), collectionEnvelope("trading-promotion-disabled-fixture-rows.v1", "promotion_disabled_fixture_rows", result.promotion_disabled_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-disabled-gate-rows.json"), collectionEnvelope("trading-promotion-disabled-gate-rows.v1", "promotion_disabled_gate_rows", result.promotion_disabled_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-disabled-boundary.json"), result.promotion_disabled_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-promotion-disabled-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingPromotionDisabledFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingPromotionDisabledFixtures(args);
    console.log(`Trading promotion disabled fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_promotion_disabled_fixtures_status}`);
    console.log(`Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
    console.log(`Unsafe promotion signals: ${result.summary.unsafe_promotion_signal_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPromotionAnchor({ riskOverrideDisabledFixtures }) {
  return {
    schema_version: "trading-promotion-disabled-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_risk_override_disabled_fixtures_id: riskOverrideDisabledFixtures.trading_risk_override_disabled_fixtures_id,
    source_risk_override_disabled_status: riskOverrideDisabledFixtures.summary.trading_risk_override_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    required_fixture_keys: REQUIRED_FIXTURE_KEYS,
    source_hash: hashValue({
      id: riskOverrideDisabledFixtures.trading_risk_override_disabled_fixtures_id,
      status: riskOverrideDisabledFixtures.summary.trading_risk_override_disabled_fixtures_status,
      fixtures: REQUIRED_FIXTURE_KEYS,
    }),
  };
}

function buildPromotionEvidenceRows({ modelImprovement, backtestValidation, paperShadow, limitedLive, fullAuto }) {
  const candidate = Array.isArray(modelImprovement?.promotion_candidates) ? modelImprovement.promotion_candidates[0] : null;
  const rows = [
    promotionEvidenceRow("model_promotion_policy_gate_blocks_live", "model_improvement", "promotion_policy_gate", [
      observedCondition("promotion_policy_gate.human_approval_required", valueAt(modelImprovement, ["promotion_policy_gate", "human_approval_required"]), true),
      observedCondition("promotion_policy_gate.auto_live_promotion_allowed", valueAt(modelImprovement, ["promotion_policy_gate", "auto_live_promotion_allowed"]), false),
      observedCondition("promotion_policy_gate.live_promotion_allowed", valueAt(modelImprovement, ["promotion_policy_gate", "live_promotion_allowed"]), false),
      observedCondition("promotion_candidates[0].promotion_artifact.live_promotion_allowed", valueAt(candidate, ["promotion_artifact", "live_promotion_allowed"]), false),
    ]),
    promotionEvidenceRow("backtest_promotion_boundary_disabled", "backtest_validation", "promotion_boundary", [
      observedCondition("promotion_boundary.promotion_candidate_generated", valueAt(backtestValidation, ["promotion_boundary", "promotion_candidate_generated"]), false),
      observedCondition("promotion_boundary.promotion_requires_future_risk_gate", valueAt(backtestValidation, ["promotion_boundary", "promotion_requires_future_risk_gate"]), true),
      observedCondition("promotion_boundary.live_promotion_allowed", valueAt(backtestValidation, ["promotion_boundary", "live_promotion_allowed"]), false),
      observedCondition("dashboard_api_stub.disabled_routes.backtest_promote", hasDisabledRoute(valueAt(backtestValidation, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/backtests/promote"), true),
    ]),
    promotionEvidenceRow("paper_to_shadow_promotion_human_gate", "paper_shadow_live", "promotion_criteria_to_shadow", [
      observedCondition("promotion_criteria_to_shadow.decision", valueAt(paperShadow, ["promotion_criteria_to_shadow", "decision"]), "pending_human_review"),
      observedCondition("promotion_criteria_to_shadow.human_approval_required", valueAt(paperShadow, ["promotion_criteria_to_shadow", "human_approval_required"]), true),
      observedCondition("promotion_criteria_to_shadow.shadow_live_enabled", valueAt(paperShadow, ["promotion_criteria_to_shadow", "shadow_live_enabled"]), false),
      observedCondition("dashboard_api_stub.disabled_routes.shadow_enable_live", hasDisabledRoute(valueAt(paperShadow, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/shadow/enable-live"), true),
    ]),
    promotionEvidenceRow("shadow_to_limited_live_promotion_blocked", "paper_shadow_live", "promotion_criteria_to_limited_live", [
      observedCondition("promotion_criteria_to_limited_live.decision", valueAt(paperShadow, ["promotion_criteria_to_limited_live", "decision"]), "blocked"),
      observedCondition("promotion_criteria_to_limited_live.human_approval_required", valueAt(paperShadow, ["promotion_criteria_to_limited_live", "human_approval_required"]), true),
      observedCondition("promotion_criteria_to_limited_live.limited_live_enabled", valueAt(paperShadow, ["promotion_criteria_to_limited_live", "limited_live_enabled"]), false),
      observedCondition("dashboard_api_stub.disabled_routes.shadow_orders", hasDisabledRoute(valueAt(paperShadow, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/shadow/orders"), true),
    ]),
    promotionEvidenceRow("limited_live_to_full_auto_promotion_blocked", "limited_live_governance", "promotion_criteria_to_full_auto", [
      observedCondition("promotion_criteria_to_full_auto.decision", valueAt(limitedLive, ["promotion_criteria_to_full_auto", "decision"]), "blocked"),
      observedCondition("promotion_criteria_to_full_auto.human_approval_required", valueAt(limitedLive, ["promotion_criteria_to_full_auto", "human_approval_required"]), true),
      observedCondition("promotion_criteria_to_full_auto.full_auto_enabled", valueAt(limitedLive, ["promotion_criteria_to_full_auto", "full_auto_enabled"]), false),
      observedCondition("safety_boundary.full_auto_promotion_allowed", valueAt(limitedLive, ["safety_boundary", "full_auto_promotion_allowed"]), false),
      observedCondition("dashboard_api_stub.disabled_routes.promote_full_auto", hasDisabledRoute(valueAt(limitedLive, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/limited-live/promote-full-auto"), true),
    ]),
    promotionEvidenceRow("full_auto_approval_without_receipt_blocked", "full_auto_governance", "full_auto_approval_checklist", [
      observedCondition("full_auto_approval_checklist.approval_required", valueAt(fullAuto, ["full_auto_approval_checklist", "approval_required"]), true),
      observedCondition("full_auto_approval_checklist.approval_receipt_present", valueAt(fullAuto, ["full_auto_approval_checklist", "approval_receipt_present"]), false),
      observedCondition("full_auto_approval_checklist.decision", valueAt(fullAuto, ["full_auto_approval_checklist", "decision"]), "blocked"),
      observedCondition("safety_boundary.full_auto_enabled", valueAt(fullAuto, ["safety_boundary", "full_auto_enabled"]), false),
      observedCondition("safety_boundary.automatic_order_submission_allowed", valueAt(fullAuto, ["safety_boundary", "automatic_order_submission_allowed"]), false),
      observedCondition("dashboard_api_stub.disabled_routes.full_auto_approve", hasDisabledRoute(valueAt(fullAuto, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/full-auto/approve"), true),
    ]),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "promotion_disabled_evidence_hash"));
}

function promotionEvidenceRow(rowKey, artifactId, evidencePath, observedConditions) {
  const allConditionsPresent = observedConditions.every((condition) => condition.condition_present);
  const unsafeConditions = observedConditions.filter((condition) => condition.observed_value !== condition.expected_safe_value);
  return {
    schema_version: "trading-promotion-disabled-evidence-row.v1",
    promotion_disabled_evidence_row_id: `trading-promotion-disabled.evidence.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    artifact_id: artifactId,
    evidence_path: evidencePath,
    observed_conditions: observedConditions,
    observed_condition_count: observedConditions.length,
    all_conditions_present: allConditionsPresent,
    unsafe_promotion_signal_detected: unsafeConditions.length > 0,
    unsafe_condition_refs: unsafeConditions.map((condition) => condition.condition_path),
    evidence_status: allConditionsPresent && unsafeConditions.length === 0 ? "promotion_disabled" : "unsafe_or_incomplete",
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

function buildPromotionFixtureRows(evidenceRows) {
  return REQUIRED_FIXTURE_KEYS.map((fixtureKey, index) => {
    const evidenceRow = evidenceRows.find((row) => row.row_key === fixtureKey);
    const row = {
      schema_version: "trading-promotion-disabled-fixture-row.v1",
      promotion_disabled_fixture_row_id: `trading-promotion-disabled-fixtures.row.${fixtureKey}`,
      phase_slot: PHASE_SLOT,
      row_key: fixtureKey,
      expected_live_promotion_allowed: false,
      unsafe_promotion_signal_detected: evidenceRow?.unsafe_promotion_signal_detected === true,
      evidence_status: evidenceRow?.evidence_status ?? "missing",
      fixture_should_fail_when_human_approval_missing: true,
      fixture_should_fail_when_live_promotion_allowed: true,
      fixture_should_fail_when_promotion_route_enabled: true,
      fixture_status: evidenceRow?.evidence_status === "promotion_disabled" ? "passed" : "failed",
      live_promotion_allowed_by_fixture: false,
      promotion_route_enabled_by_fixture: false,
      order_intent_generated_by_fixture: false,
      live_execution_allowed_by_fixture: false,
      command_execution_performed_by_fixture: false,
      artifact_write_performed_by_fixture: false,
      protected_action_executed_by_fixture: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "promotion_disabled_fixture_hash");
  });
}

function buildPromotionBoundary({ generatedAt, writeRequested, riskOverrideDisabledFixtures, evidenceRows, fixtureRows }) {
  const unsafeRows = evidenceRows.filter((row) => row.unsafe_promotion_signal_detected);
  const sourceBoundary = riskOverrideDisabledFixtures.summary;
  return {
    schema_version: "trading-promotion-disabled-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    promotion_disabled_artifact_write_requested: writeRequested,
    promotion_disabled_fixture_execution_performed: false,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    promotion_evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    unsafe_promotion_signal_count: unsafeRows.length,
    unsafe_promotion_signal_refs: unsafeRows.map((row) => row.row_key),
    promotion_disabled_covered: evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "promotion_disabled"),
    source_risk_override_disabled_status: sourceBoundary.trading_risk_override_disabled_fixtures_status,
    source_risk_override_disabled_ready: riskOverrideDisabledFixtures.validation.valid && sourceBoundary.trading_risk_override_disabled_fixtures_status === "ready_for_trading_risk_override_disabled_regression",
    human_approval_required_missing: observedUnsafeCondition(evidenceRows, "promotion_policy_gate.human_approval_required") || observedUnsafeCondition(evidenceRows, "promotion_criteria_to_shadow.human_approval_required") || observedUnsafeCondition(evidenceRows, "promotion_criteria_to_limited_live.human_approval_required") || observedUnsafeCondition(evidenceRows, "promotion_criteria_to_full_auto.human_approval_required") || observedUnsafeCondition(evidenceRows, "full_auto_approval_checklist.approval_required"),
    approval_receipt_present: observedUnsafeCondition(evidenceRows, "full_auto_approval_checklist.approval_receipt_present"),
    promotion_candidate_generated: observedUnsafeCondition(evidenceRows, "promotion_boundary.promotion_candidate_generated"),
    auto_live_promotion_allowed: observedUnsafeCondition(evidenceRows, "promotion_policy_gate.auto_live_promotion_allowed"),
    live_promotion_allowed: observedUnsafeCondition(evidenceRows, "promotion_policy_gate.live_promotion_allowed") || observedUnsafeCondition(evidenceRows, "promotion_candidates[0].promotion_artifact.live_promotion_allowed") || observedUnsafeCondition(evidenceRows, "promotion_boundary.live_promotion_allowed"),
    shadow_live_enabled: observedUnsafeCondition(evidenceRows, "promotion_criteria_to_shadow.shadow_live_enabled"),
    limited_live_enabled: observedUnsafeCondition(evidenceRows, "promotion_criteria_to_limited_live.limited_live_enabled") || sourceBoundary.limited_live_enabled,
    full_auto_enabled: observedUnsafeCondition(evidenceRows, "promotion_criteria_to_full_auto.full_auto_enabled") || observedUnsafeCondition(evidenceRows, "safety_boundary.full_auto_enabled") || sourceBoundary.full_auto_enabled,
    full_auto_promotion_allowed: observedUnsafeCondition(evidenceRows, "safety_boundary.full_auto_promotion_allowed"),
    automatic_order_submission_allowed: observedUnsafeCondition(evidenceRows, "safety_boundary.automatic_order_submission_allowed") || sourceBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: sourceBoundary.live_order_submission_allowed,
    promotion_route_enabled: observedUnsafeCondition(evidenceRows, "dashboard_api_stub.disabled_routes.backtest_promote") || observedUnsafeCondition(evidenceRows, "dashboard_api_stub.disabled_routes.shadow_enable_live") || observedUnsafeCondition(evidenceRows, "dashboard_api_stub.disabled_routes.promote_full_auto") || observedUnsafeCondition(evidenceRows, "dashboard_api_stub.disabled_routes.full_auto_approve"),
    order_route_enabled: observedUnsafeCondition(evidenceRows, "dashboard_api_stub.disabled_routes.shadow_orders"),
    risk_override_route_enabled: sourceBoundary.risk_override_route_enabled,
    order_intent_generated: sourceBoundary.order_intent_generated,
    investment_advice_generated: sourceBoundary.investment_advice_generated,
    trade_recommendation_generated: sourceBoundary.trade_recommendation_generated,
    live_trade_allowed: sourceBoundary.live_trade_allowed,
    live_execution_allowed: sourceBoundary.live_execution_allowed,
    trading_live_enabled: sourceBoundary.trading_live_enabled,
    trading_order_submission_allowed: sourceBoundary.trading_order_submission_allowed,
    real_order_submitted: sourceBoundary.real_order_submitted,
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

function buildPromotionGateRows({ riskOverrideDisabledFixtures, packageJson, platformOpsLedger, modelImprovement, backtestValidation, paperShadow, limitedLive, fullAuto, fixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p390_risk_override_disabled_fixtures_ready", "P390 risk override disabled fixtures source is ready.", riskOverrideDisabledFixtures.validation.valid && riskOverrideDisabledFixtures.summary.trading_risk_override_disabled_fixtures_status === "ready_for_trading_risk_override_disabled_regression"),
    gateRow("platform_package_script_registered", "package.json registers the P391 trading promotion disabled fixtures command.", typeof scripts["trading:promotion-disabled-fixtures"] === "string" && scripts["trading:promotion-disabled-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P391 trading promotion disabled fixtures command.", validateScript.includes("npm run trading:promotion-disabled-fixtures -- --check")),
    gateRow("p391_ledger_acceptance_declared", "P391 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P391: `trading:promotion-disabled-fixtures`")),
    gateRow("promotion_sources_readable", "All promotion source artifacts are readable.", modelImprovement.available && backtestValidation.available && paperShadow.available && limitedLive.available && fullAuto.available),
    gateRow("required_promotion_fixtures_declared", "All required promotion disabled fixtures are declared.", REQUIRED_FIXTURE_KEYS.every((fixtureKey) => fixtureRows.some((row) => row.row_key === fixtureKey)) && fixtureRows.length === REQUIRED_FIXTURE_KEYS.length),
    gateRow("human_approval_gates_required", "Promotion stages require human approval and missing/full-auto receipts block approval.", !boundary.human_approval_required_missing && !boundary.approval_receipt_present),
    gateRow("promotion_routes_disabled", "Promotion and approval routes remain disabled.", !boundary.promotion_route_enabled && !boundary.order_route_enabled),
    gateRow("live_promotion_stages_disabled", "Promotion cannot enable shadow live, limited live, full auto, or auto-live promotion.", !boundary.live_promotion_allowed && !boundary.auto_live_promotion_allowed && !boundary.shadow_live_enabled && !boundary.limited_live_enabled && !boundary.full_auto_enabled && !boundary.full_auto_promotion_allowed),
    gateRow("no_order_intent_or_live_execution", "Promotion cannot create order intent, advice, recommendation, live trade, live execution, or order submission.", !boundary.order_intent_generated && !boundary.investment_advice_generated && !boundary.trade_recommendation_generated && !boundary.live_trade_allowed && !boundary.live_execution_allowed && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed),
    gateRow("no_trading_or_artifact_mutation", "Promotion disabled fixtures do not execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "promotion_disabled_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-promotion-disabled-gate-row.v1",
    promotion_disabled_gate_row_id: `trading-promotion-disabled-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    live_promotion_allowed_by_gate: false,
    promotion_route_enabled_by_gate: false,
    order_intent_generated_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ riskOverrideDisabledFixtures, packageJson, platformOpsLedger, modelImprovement, backtestValidation, paperShadow, limitedLive, fullAuto, evidenceRows, fixtureRows, gateRows, boundary }) {
  return [
    validationItem("source.risk_override_disabled_fixtures", "p390_risk_override_disabled_fixtures_ready", riskOverrideDisabledFixtures.validation.valid && riskOverrideDisabledFixtures.summary.trading_risk_override_disabled_fixtures_status === "ready_for_trading_risk_override_disabled_regression", "P390 risk override disabled fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P391 promotion disabled fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.model_improvement", "model_improvement_available", modelImprovement.available, "Trading model improvement source is readable."),
    validationItem("source.backtest_validation", "backtest_validation_available", backtestValidation.available, "Trading backtest validation source is readable."),
    validationItem("source.paper_shadow", "paper_shadow_available", paperShadow.available, "Trading paper/shadow source is readable."),
    validationItem("source.limited_live", "limited_live_available", limitedLive.available, "Trading limited-live source is readable."),
    validationItem("source.full_auto", "full_auto_available", fullAuto.available, "Trading full-auto source is readable."),
    validationItem("promotion_disabled_evidence_rows", "promotion_evidence_ready", evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "promotion_disabled"), "Promotion evidence rows must show human-gated/disabled state."),
    validationItem("promotion_disabled_fixture_rows", "required_promotion_fixtures_pass", fixtureRows.length === REQUIRED_FIXTURE_KEYS.length && fixtureRows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_live_promotion_allowed && row.fixture_should_fail_when_promotion_route_enabled), "All promotion disabled fixtures must pass."),
    validationItem("promotion_disabled_gate_rows", "promotion_disabled_gates_ready", gateRows.length >= 11 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P391 promotion disabled gates are ready."),
    validationItem("boundary.human_gate_required", "human_approval_gates_required", boundary.promotion_disabled_covered && !boundary.human_approval_required_missing && !boundary.approval_receipt_present, "Promotion must require human approval and remain blocked without approval receipts."),
    validationItem("boundary.promotion_routes_disabled", "promotion_routes_disabled", !boundary.promotion_route_enabled && !boundary.order_route_enabled, "Promotion and approval routes remain disabled."),
    validationItem("boundary.live_promotion_stages_disabled", "live_promotion_stages_disabled", !boundary.live_promotion_allowed && !boundary.auto_live_promotion_allowed && !boundary.shadow_live_enabled && !boundary.limited_live_enabled && !boundary.full_auto_enabled && !boundary.full_auto_promotion_allowed, "Promotion cannot enable shadow-live, limited-live, full-auto, or auto-live paths."),
    validationItem("boundary.no_order_intent_or_live_execution", "no_order_intent_or_live_execution", !boundary.order_intent_generated && !boundary.investment_advice_generated && !boundary.trade_recommendation_generated && !boundary.live_trade_allowed && !boundary.live_execution_allowed && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed, "Promotion cannot generate advice, order intent, live trade, or live execution."),
    validationItem("boundary.no_mutation", "no_trading_or_artifact_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed, "P391 promotion disabled fixtures perform no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ riskOverrideDisabledFixtures, evidenceRows, fixtureRows, gateRows, boundary, validation }) {
  return {
    trading_promotion_disabled_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_risk_override_disabled_status: riskOverrideDisabledFixtures.summary.trading_risk_override_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    passed_fixture_count: fixtureRows.filter((row) => row.fixture_status === "passed").length,
    failed_fixture_count: fixtureRows.filter((row) => row.fixture_status !== "passed").length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    unsafe_promotion_signal_count: boundary.unsafe_promotion_signal_count,
    promotion_disabled_covered: boundary.promotion_disabled_covered,
    human_approval_required_missing: boundary.human_approval_required_missing,
    approval_receipt_present: boundary.approval_receipt_present,
    promotion_candidate_generated: boundary.promotion_candidate_generated,
    auto_live_promotion_allowed: boundary.auto_live_promotion_allowed,
    live_promotion_allowed: boundary.live_promotion_allowed,
    shadow_live_enabled: boundary.shadow_live_enabled,
    limited_live_enabled: boundary.limited_live_enabled,
    full_auto_enabled: boundary.full_auto_enabled,
    full_auto_promotion_allowed: boundary.full_auto_promotion_allowed,
    automatic_order_submission_allowed: boundary.automatic_order_submission_allowed,
    live_order_submission_allowed: boundary.live_order_submission_allowed,
    promotion_route_enabled: boundary.promotion_route_enabled,
    order_route_enabled: boundary.order_route_enabled,
    risk_override_route_enabled: boundary.risk_override_route_enabled,
    order_intent_generated: boundary.order_intent_generated,
    investment_advice_generated: boundary.investment_advice_generated,
    trade_recommendation_generated: boundary.trade_recommendation_generated,
    live_trade_allowed: boundary.live_trade_allowed,
    live_execution_allowed: boundary.live_execution_allowed,
    trading_live_enabled: boundary.trading_live_enabled,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    real_order_submitted: boundary.real_order_submitted,
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
    "# Trading Promotion Disabled Fixtures",
    "",
    `Status: ${result.summary.trading_promotion_disabled_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source risk override disabled: ${result.summary.source_risk_override_disabled_status}`,
    `Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`,
    `Unsafe promotion signals: ${result.summary.unsafe_promotion_signal_count}`,
    "",
    "## Fixtures",
    "",
    ...result.promotion_disabled_fixture_rows.map((row) => `- ${row.row_key}: ${row.fixture_status}`),
    "",
    "## Gates",
    "",
    ...result.promotion_disabled_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_OUT_DIR, routeSourcePaths: [] };
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
  console.log(`Usage: node scripts/trading-promotion-disabled-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_OUT_DIR}
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
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  const routeSourcePaths = options.routeSourcePaths ?? options.routeSources ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.routeSourcePaths;
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.platformOpsLedgerPath),
    release_check_receipt_closeout_schema_path: path.resolve(options.releaseCheckReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.releaseCheckReceiptCloseoutSchemaPath),
    safety_regression_fixtures_schema_path: path.resolve(options.safetyRegressionFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.safetyRegressionFixturesSchemaPath),
    route_inventory_fixtures_schema_path: path.resolve(options.routeInventoryFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.routeInventoryFixturesSchemaPath),
    approval_absence_fixtures_schema_path: path.resolve(options.approvalAbsenceFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.approvalAbsenceFixturesSchemaPath),
    live_adapter_disabled_fixtures_schema_path: path.resolve(options.liveAdapterDisabledFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.liveAdapterDisabledFixturesSchemaPath),
    credential_lookup_disabled_fixtures_schema_path: path.resolve(options.credentialLookupDisabledFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.credentialLookupDisabledFixturesSchemaPath),
    broker_write_disabled_fixtures_schema_path: path.resolve(options.brokerWriteDisabledFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.brokerWriteDisabledFixturesSchemaPath),
    exchange_write_disabled_fixtures_schema_path: path.resolve(options.exchangeWriteDisabledFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.exchangeWriteDisabledFixturesSchemaPath),
    safety_boundary_fixtures_schema_path: path.resolve(options.safetyBoundaryFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.safetyBoundaryFixturesSchemaPath),
    manual_resume_disabled_fixtures_schema_path: path.resolve(options.manualResumeDisabledFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.manualResumeDisabledFixturesSchemaPath),
    risk_override_disabled_fixtures_schema_path: path.resolve(options.riskOverrideDisabledFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.riskOverrideDisabledFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.executionEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.modelImprovementPath),
    backtest_validation_path: path.resolve(options.backtestValidationPath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.backtestValidationPath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.riskEnginePath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.marketDataFeatureStorePath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.researchBacktestPaperPath),
    route_source_paths: routeSourcePaths.map((sourcePath) => path.resolve(sourcePath)),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.schemaPath),
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

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `trading-promotion-disabled-fixtures.${slugify(itemPath)}.${checkId}`,
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
