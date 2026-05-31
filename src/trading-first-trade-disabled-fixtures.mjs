import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS,
  buildTradingPromotionDisabledFixtures,
} from "./trading-promotion-disabled-fixtures.mjs";

export const DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_OUT_DIR = "artifacts/trading-first-trade-disabled-fixtures/latest";
export const DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS,
  promotionDisabledFixturesSchemaPath: DEFAULT_TRADING_PROMOTION_DISABLED_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-first-trade-disabled-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-first-trade-disabled-fixtures.v1";
const CAPABILITY_ID = "trading.first_trade_disabled_fixtures";
const PHASE_SLOT = "P392";
const PREVIOUS_PHASE_SLOT = "P391";
const NEXT_PHASE_SLOT = "P393";
const READY_STATUS = "ready_for_trading_first_trade_disabled_regression";
const REQUIRED_FIXTURE_KEYS = [
  "limited_live_approval_blocks_first_trade",
  "first_trade_confirmation_missing_blocks_submission",
  "order_caps_block_first_trade_submission",
  "limited_live_order_routes_disabled",
  "no_live_cancel_fill_or_report",
];

export async function runTradingFirstTradeDisabledFixtures(options = {}) {
  const result = await buildTradingFirstTradeDisabledFixtures(options);
  if (options.write !== false) await writeTradingFirstTradeDisabledFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading first trade disabled fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingFirstTradeDisabledFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const promotionDisabledFixtures = await buildTradingPromotionDisabledFixtures({
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
    schemaPath: inputs.promotion_disabled_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const limitedLive = await readJsonSource(inputs.limited_live_path);
  const firstTradeAnchor = buildFirstTradeAnchor({ promotionDisabledFixtures });
  const firstTradeEvidenceRows = buildFirstTradeEvidenceRows({ limitedLive: limitedLive.data });
  const firstTradeFixtureRows = buildFirstTradeFixtureRows(firstTradeEvidenceRows);
  const firstTradeBoundary = buildFirstTradeBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    promotionDisabledFixtures,
    evidenceRows: firstTradeEvidenceRows,
    fixtureRows: firstTradeFixtureRows,
  });
  const firstTradeGateRows = buildFirstTradeGateRows({
    promotionDisabledFixtures,
    packageJson,
    platformOpsLedger,
    limitedLive,
    fixtureRows: firstTradeFixtureRows,
    boundary: firstTradeBoundary,
  });
  const validationItems = buildValidationItems({
    promotionDisabledFixtures,
    packageJson,
    platformOpsLedger,
    limitedLive,
    evidenceRows: firstTradeEvidenceRows,
    fixtureRows: firstTradeFixtureRows,
    gateRows: firstTradeGateRows,
    boundary: firstTradeBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    promotionDisabledFixtures,
    evidenceRows: firstTradeEvidenceRows,
    fixtureRows: firstTradeFixtureRows,
    gateRows: firstTradeGateRows,
    boundary: firstTradeBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_first_trade_disabled_fixtures_id: `trading-first-trade-disabled-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    first_trade_disabled_anchor: firstTradeAnchor,
    first_trade_disabled_evidence_rows: firstTradeEvidenceRows,
    first_trade_disabled_fixture_rows: firstTradeFixtureRows,
    first_trade_disabled_gate_rows: firstTradeGateRows,
    first_trade_disabled_boundary: firstTradeBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_first_trade_disabled_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    promotionDisabledFixtures,
    evidenceRows: firstTradeEvidenceRows,
    fixtureRows: firstTradeFixtureRows,
    gateRows: firstTradeGateRows,
    boundary: firstTradeBoundary,
    validation: result.validation,
  });
  result.summary.trading_first_trade_disabled_fixtures_id = result.trading_first_trade_disabled_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingFirstTradeDisabledFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-first-trade-disabled-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "first-trade-disabled-evidence-rows.json"), collectionEnvelope("trading-first-trade-disabled-evidence-rows.v1", "first_trade_disabled_evidence_rows", result.first_trade_disabled_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "first-trade-disabled-fixture-rows.json"), collectionEnvelope("trading-first-trade-disabled-fixture-rows.v1", "first_trade_disabled_fixture_rows", result.first_trade_disabled_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "first-trade-disabled-gate-rows.json"), collectionEnvelope("trading-first-trade-disabled-gate-rows.v1", "first_trade_disabled_gate_rows", result.first_trade_disabled_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "first-trade-disabled-boundary.json"), result.first_trade_disabled_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-first-trade-disabled-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingFirstTradeDisabledFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingFirstTradeDisabledFixtures(args);
    console.log(`Trading first trade disabled fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_first_trade_disabled_fixtures_status}`);
    console.log(`Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
    console.log(`Unsafe first trade signals: ${result.summary.unsafe_first_trade_signal_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildFirstTradeAnchor({ promotionDisabledFixtures }) {
  return {
    schema_version: "trading-first-trade-disabled-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_disabled_fixtures_id: promotionDisabledFixtures.trading_promotion_disabled_fixtures_id,
    source_promotion_disabled_status: promotionDisabledFixtures.summary.trading_promotion_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    required_fixture_keys: REQUIRED_FIXTURE_KEYS,
    source_hash: hashValue({
      id: promotionDisabledFixtures.trading_promotion_disabled_fixtures_id,
      status: promotionDisabledFixtures.summary.trading_promotion_disabled_fixtures_status,
      fixtures: REQUIRED_FIXTURE_KEYS,
    }),
  };
}

function buildFirstTradeEvidenceRows({ limitedLive }) {
  const rows = [
    firstTradeEvidenceRow("limited_live_approval_blocks_first_trade", "limited_live_governance", "approval_gate", [
      observedCondition("approval_gate.approval_required", valueAt(limitedLive, ["approval_gate", "approval_required"]), true),
      observedCondition("approval_gate.approval_receipt_present", valueAt(limitedLive, ["approval_gate", "approval_receipt_present"]), false),
      observedCondition("approval_gate.decision", valueAt(limitedLive, ["approval_gate", "decision"]), "blocked"),
      observedCondition("safety_boundary.limited_live_enabled", valueAt(limitedLive, ["safety_boundary", "limited_live_enabled"]), false),
    ]),
    firstTradeEvidenceRow("first_trade_confirmation_missing_blocks_submission", "limited_live_governance", "first_trade_confirmation", [
      observedCondition("first_trade_confirmation.required", valueAt(limitedLive, ["first_trade_confirmation", "required"]), true),
      observedCondition("first_trade_confirmation.confirmation_present", valueAt(limitedLive, ["first_trade_confirmation", "confirmation_present"]), false),
      observedCondition("first_trade_confirmation.blocks_first_trade", valueAt(limitedLive, ["first_trade_confirmation", "blocks_first_trade"]), true),
      observedCondition("first_trade_confirmation.first_trade_submitted", valueAt(limitedLive, ["first_trade_confirmation", "first_trade_submitted"]), false),
    ]),
    firstTradeEvidenceRow("order_caps_block_first_trade_submission", "limited_live_governance", "order_caps", [
      observedCondition("order_caps.order_size_cap.enforced", valueAt(limitedLive, ["order_caps", "order_size_cap", "enforced"]), true),
      observedCondition("order_caps.order_size_cap.blocks_submission", valueAt(limitedLive, ["order_caps", "order_size_cap", "blocks_submission"]), true),
      observedCondition("order_caps.daily_order_count_cap.max_orders_per_day", valueAt(limitedLive, ["order_caps", "daily_order_count_cap", "max_orders_per_day"]), 0),
      observedCondition("order_caps.daily_order_count_cap.blocks_submission", valueAt(limitedLive, ["order_caps", "daily_order_count_cap", "blocks_submission"]), true),
      observedCondition("order_caps.order_submission_allowed", valueAt(limitedLive, ["order_caps", "order_submission_allowed"]), false),
    ]),
    firstTradeEvidenceRow("limited_live_order_routes_disabled", "limited_live_governance", "dashboard_api_stub", [
      observedCondition("dashboard_api_stub.read_only", valueAt(limitedLive, ["dashboard_api_stub", "read_only"]), true),
      observedCondition("dashboard_api_stub.mutating_routes_enabled", valueAt(limitedLive, ["dashboard_api_stub", "mutating_routes_enabled"]), false),
      observedCondition("dashboard_api_stub.disabled_routes.limited_live_orders", hasDisabledRoute(valueAt(limitedLive, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/limited-live/orders"), true),
      observedCondition("dashboard_api_stub.disabled_routes.orders", hasDisabledRoute(valueAt(limitedLive, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/orders"), true),
    ]),
    firstTradeEvidenceRow("no_live_cancel_fill_or_report", "limited_live_governance", "post_trade_reconciliation", [
      observedCondition("auto_cancel_stale_orders.live_cancel_allowed", valueAt(limitedLive, ["auto_cancel_stale_orders", "live_cancel_allowed"]), false),
      observedCondition("post_trade_reconciliation.live_fill_count", valueAt(limitedLive, ["post_trade_reconciliation", "live_fill_count"]), 0),
      observedCondition("daily_live_report.real_order_count", valueAt(limitedLive, ["daily_live_report", "real_order_count"]), 0),
      observedCondition("safety_boundary.live_order_submission_allowed", valueAt(limitedLive, ["safety_boundary", "live_order_submission_allowed"]), false),
    ]),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "first_trade_disabled_evidence_hash"));
}

function firstTradeEvidenceRow(rowKey, artifactId, evidencePath, observedConditions) {
  const allConditionsPresent = observedConditions.every((condition) => condition.condition_present);
  const unsafeConditions = observedConditions.filter((condition) => condition.observed_value !== condition.expected_safe_value);
  return {
    schema_version: "trading-first-trade-disabled-evidence-row.v1",
    first_trade_disabled_evidence_row_id: `trading-first-trade-disabled.evidence.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    artifact_id: artifactId,
    evidence_path: evidencePath,
    observed_conditions: observedConditions,
    observed_condition_count: observedConditions.length,
    all_conditions_present: allConditionsPresent,
    unsafe_first_trade_signal_detected: unsafeConditions.length > 0,
    unsafe_condition_refs: unsafeConditions.map((condition) => condition.condition_path),
    evidence_status: allConditionsPresent && unsafeConditions.length === 0 ? "first_trade_disabled" : "unsafe_or_incomplete",
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

function buildFirstTradeFixtureRows(evidenceRows) {
  return REQUIRED_FIXTURE_KEYS.map((fixtureKey, index) => {
    const evidenceRow = evidenceRows.find((row) => row.row_key === fixtureKey);
    const row = {
      schema_version: "trading-first-trade-disabled-fixture-row.v1",
      first_trade_disabled_fixture_row_id: `trading-first-trade-disabled-fixtures.row.${fixtureKey}`,
      phase_slot: PHASE_SLOT,
      row_key: fixtureKey,
      expected_first_trade_submitted: false,
      unsafe_first_trade_signal_detected: evidenceRow?.unsafe_first_trade_signal_detected === true,
      evidence_status: evidenceRow?.evidence_status ?? "missing",
      fixture_should_fail_when_confirmation_present: true,
      fixture_should_fail_when_first_trade_submitted: true,
      fixture_should_fail_when_order_route_enabled: true,
      fixture_status: evidenceRow?.evidence_status === "first_trade_disabled" ? "passed" : "failed",
      first_trade_submitted_by_fixture: false,
      order_submission_allowed_by_fixture: false,
      live_cancel_allowed_by_fixture: false,
      live_fill_recorded_by_fixture: false,
      command_execution_performed_by_fixture: false,
      artifact_write_performed_by_fixture: false,
      protected_action_executed_by_fixture: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "first_trade_disabled_fixture_hash");
  });
}

function buildFirstTradeBoundary({ generatedAt, writeRequested, promotionDisabledFixtures, evidenceRows, fixtureRows }) {
  const unsafeRows = evidenceRows.filter((row) => row.unsafe_first_trade_signal_detected);
  const sourceBoundary = promotionDisabledFixtures.summary;
  return {
    schema_version: "trading-first-trade-disabled-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    first_trade_disabled_artifact_write_requested: writeRequested,
    first_trade_disabled_fixture_execution_performed: false,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    first_trade_evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    unsafe_first_trade_signal_count: unsafeRows.length,
    unsafe_first_trade_signal_refs: unsafeRows.map((row) => row.row_key),
    first_trade_disabled_covered: evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "first_trade_disabled"),
    source_promotion_disabled_status: sourceBoundary.trading_promotion_disabled_fixtures_status,
    source_promotion_disabled_ready: promotionDisabledFixtures.validation.valid && sourceBoundary.trading_promotion_disabled_fixtures_status === "ready_for_trading_promotion_disabled_regression",
    approval_required_missing: observedUnsafeCondition(evidenceRows, "approval_gate.approval_required"),
    approval_receipt_present: observedUnsafeCondition(evidenceRows, "approval_gate.approval_receipt_present"),
    first_trade_confirmation_required_missing: observedUnsafeCondition(evidenceRows, "first_trade_confirmation.required"),
    first_trade_confirmation_present: observedUnsafeCondition(evidenceRows, "first_trade_confirmation.confirmation_present"),
    first_trade_not_blocked: observedUnsafeCondition(evidenceRows, "first_trade_confirmation.blocks_first_trade"),
    first_trade_submitted: observedUnsafeCondition(evidenceRows, "first_trade_confirmation.first_trade_submitted"),
    order_size_cap_missing: observedUnsafeCondition(evidenceRows, "order_caps.order_size_cap.enforced") || observedUnsafeCondition(evidenceRows, "order_caps.order_size_cap.blocks_submission"),
    daily_order_cap_missing: observedUnsafeCondition(evidenceRows, "order_caps.daily_order_count_cap.max_orders_per_day") || observedUnsafeCondition(evidenceRows, "order_caps.daily_order_count_cap.blocks_submission"),
    order_submission_allowed: observedUnsafeCondition(evidenceRows, "order_caps.order_submission_allowed"),
    live_order_route_enabled: observedUnsafeCondition(evidenceRows, "dashboard_api_stub.mutating_routes_enabled") || observedUnsafeCondition(evidenceRows, "dashboard_api_stub.disabled_routes.limited_live_orders") || observedUnsafeCondition(evidenceRows, "dashboard_api_stub.disabled_routes.orders"),
    live_cancel_allowed: observedUnsafeCondition(evidenceRows, "auto_cancel_stale_orders.live_cancel_allowed"),
    live_fill_recorded: observedUnsafeCondition(evidenceRows, "post_trade_reconciliation.live_fill_count"),
    real_order_reported: observedUnsafeCondition(evidenceRows, "daily_live_report.real_order_count"),
    limited_live_enabled: observedUnsafeCondition(evidenceRows, "safety_boundary.limited_live_enabled") || sourceBoundary.limited_live_enabled,
    full_auto_enabled: sourceBoundary.full_auto_enabled,
    automatic_order_submission_allowed: sourceBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: observedUnsafeCondition(evidenceRows, "safety_boundary.live_order_submission_allowed") || sourceBoundary.live_order_submission_allowed,
    promotion_route_enabled: sourceBoundary.promotion_route_enabled,
    order_intent_generated: sourceBoundary.order_intent_generated,
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

function buildFirstTradeGateRows({ promotionDisabledFixtures, packageJson, platformOpsLedger, limitedLive, fixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p391_promotion_disabled_fixtures_ready", "P391 promotion disabled fixtures source is ready.", promotionDisabledFixtures.validation.valid && promotionDisabledFixtures.summary.trading_promotion_disabled_fixtures_status === "ready_for_trading_promotion_disabled_regression"),
    gateRow("platform_package_script_registered", "package.json registers the P392 trading first trade disabled fixtures command.", typeof scripts["trading:first-trade-disabled-fixtures"] === "string" && scripts["trading:first-trade-disabled-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P392 trading first trade disabled fixtures command.", validateScript.includes("npm run trading:first-trade-disabled-fixtures -- --check")),
    gateRow("p392_ledger_acceptance_declared", "P392 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P392: `trading:first-trade-disabled-fixtures`")),
    gateRow("limited_live_source_readable", "Limited-live governance source is readable.", limitedLive.available),
    gateRow("required_first_trade_fixtures_declared", "All required first trade disabled fixtures are declared.", REQUIRED_FIXTURE_KEYS.every((fixtureKey) => fixtureRows.some((row) => row.row_key === fixtureKey)) && fixtureRows.length === REQUIRED_FIXTURE_KEYS.length),
    gateRow("approval_and_confirmation_block_first_trade", "Missing approval receipt and missing first-trade confirmation block first trade submission.", !boundary.approval_required_missing && !boundary.approval_receipt_present && !boundary.first_trade_confirmation_required_missing && !boundary.first_trade_confirmation_present && !boundary.first_trade_not_blocked && !boundary.first_trade_submitted),
    gateRow("order_caps_block_submission", "Order size and daily order count caps block submission.", !boundary.order_size_cap_missing && !boundary.daily_order_cap_missing && !boundary.order_submission_allowed),
    gateRow("order_routes_and_live_cancel_disabled", "Limited-live order routes and live cancel remain disabled.", !boundary.live_order_route_enabled && !boundary.live_cancel_allowed),
    gateRow("no_live_fills_or_reports", "No live fills, real order reports, live execution, or order submission are recorded.", !boundary.live_fill_recorded && !boundary.real_order_reported && !boundary.live_execution_allowed && !boundary.live_order_submission_allowed && !boundary.automatic_order_submission_allowed),
    gateRow("no_trading_or_artifact_mutation", "First trade disabled fixtures do not execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "first_trade_disabled_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-first-trade-disabled-gate-row.v1",
    first_trade_disabled_gate_row_id: `trading-first-trade-disabled-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    first_trade_submitted_by_gate: false,
    order_submission_allowed_by_gate: false,
    live_cancel_allowed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ promotionDisabledFixtures, packageJson, platformOpsLedger, limitedLive, evidenceRows, fixtureRows, gateRows, boundary }) {
  return [
    validationItem("source.promotion_disabled_fixtures", "p391_promotion_disabled_fixtures_ready", promotionDisabledFixtures.validation.valid && promotionDisabledFixtures.summary.trading_promotion_disabled_fixtures_status === "ready_for_trading_promotion_disabled_regression", "P391 promotion disabled fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P392 first trade disabled fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.limited_live", "limited_live_available", limitedLive.available, "Trading limited-live source is readable."),
    validationItem("first_trade_disabled_evidence_rows", "first_trade_evidence_ready", evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "first_trade_disabled"), "First trade evidence rows must show human-gated/disabled state."),
    validationItem("first_trade_disabled_fixture_rows", "required_first_trade_fixtures_pass", fixtureRows.length === REQUIRED_FIXTURE_KEYS.length && fixtureRows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_first_trade_submitted && row.fixture_should_fail_when_order_route_enabled), "All first trade disabled fixtures must pass."),
    validationItem("first_trade_disabled_gate_rows", "first_trade_disabled_gates_ready", gateRows.length >= 11 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P392 first trade disabled gates are ready."),
    validationItem("boundary.approval_and_confirmation", "approval_and_confirmation_block_first_trade", boundary.first_trade_disabled_covered && !boundary.approval_required_missing && !boundary.approval_receipt_present && !boundary.first_trade_confirmation_required_missing && !boundary.first_trade_confirmation_present && !boundary.first_trade_not_blocked && !boundary.first_trade_submitted, "Approval receipt and first-trade confirmation are required and missing state blocks first trade."),
    validationItem("boundary.order_caps", "order_caps_block_submission", !boundary.order_size_cap_missing && !boundary.daily_order_cap_missing && !boundary.order_submission_allowed, "Order caps block first trade submission."),
    validationItem("boundary.routes_and_cancel", "order_routes_and_live_cancel_disabled", !boundary.live_order_route_enabled && !boundary.live_cancel_allowed, "Limited-live order routes and live cancel remain disabled."),
    validationItem("boundary.no_live_activity", "no_live_fills_or_reports", !boundary.live_fill_recorded && !boundary.real_order_reported && !boundary.live_execution_allowed && !boundary.live_order_submission_allowed && !boundary.automatic_order_submission_allowed, "No live fills, real order reports, live execution, or order submission are recorded."),
    validationItem("boundary.no_mutation", "no_trading_or_artifact_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed, "P392 first trade disabled fixtures perform no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ promotionDisabledFixtures, evidenceRows, fixtureRows, gateRows, boundary, validation }) {
  return {
    trading_first_trade_disabled_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_disabled_status: promotionDisabledFixtures.summary.trading_promotion_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    passed_fixture_count: fixtureRows.filter((row) => row.fixture_status === "passed").length,
    failed_fixture_count: fixtureRows.filter((row) => row.fixture_status !== "passed").length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    unsafe_first_trade_signal_count: boundary.unsafe_first_trade_signal_count,
    first_trade_disabled_covered: boundary.first_trade_disabled_covered,
    approval_required_missing: boundary.approval_required_missing,
    approval_receipt_present: boundary.approval_receipt_present,
    first_trade_confirmation_required_missing: boundary.first_trade_confirmation_required_missing,
    first_trade_confirmation_present: boundary.first_trade_confirmation_present,
    first_trade_not_blocked: boundary.first_trade_not_blocked,
    first_trade_submitted: boundary.first_trade_submitted,
    order_size_cap_missing: boundary.order_size_cap_missing,
    daily_order_cap_missing: boundary.daily_order_cap_missing,
    order_submission_allowed: boundary.order_submission_allowed,
    live_order_route_enabled: boundary.live_order_route_enabled,
    live_cancel_allowed: boundary.live_cancel_allowed,
    live_fill_recorded: boundary.live_fill_recorded,
    real_order_reported: boundary.real_order_reported,
    limited_live_enabled: boundary.limited_live_enabled,
    full_auto_enabled: boundary.full_auto_enabled,
    automatic_order_submission_allowed: boundary.automatic_order_submission_allowed,
    live_order_submission_allowed: boundary.live_order_submission_allowed,
    promotion_route_enabled: boundary.promotion_route_enabled,
    order_intent_generated: boundary.order_intent_generated,
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
    "# Trading First Trade Disabled Fixtures",
    "",
    `Status: ${result.summary.trading_first_trade_disabled_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source promotion disabled: ${result.summary.source_promotion_disabled_status}`,
    `Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`,
    `Unsafe first trade signals: ${result.summary.unsafe_first_trade_signal_count}`,
    "",
    "## Fixtures",
    "",
    ...result.first_trade_disabled_fixture_rows.map((row) => `- ${row.row_key}: ${row.fixture_status}`),
    "",
    "## Gates",
    "",
    ...result.first_trade_disabled_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_OUT_DIR, routeSourcePaths: [] };
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
    else if (arg === "--promotion-disabled-fixtures-schema") parsed.promotionDisabledFixturesSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-first-trade-disabled-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_OUT_DIR}
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
  --promotion-disabled-fixtures-schema <path>
                                           P391 promotion disabled fixtures schema path.
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  const routeSourcePaths = options.routeSourcePaths ?? options.routeSources ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.routeSourcePaths;
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.platformOpsLedgerPath),
    release_check_receipt_closeout_schema_path: path.resolve(options.releaseCheckReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.releaseCheckReceiptCloseoutSchemaPath),
    safety_regression_fixtures_schema_path: path.resolve(options.safetyRegressionFixturesSchemaPath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.safetyRegressionFixturesSchemaPath),
    route_inventory_fixtures_schema_path: path.resolve(options.routeInventoryFixturesSchemaPath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.routeInventoryFixturesSchemaPath),
    approval_absence_fixtures_schema_path: path.resolve(options.approvalAbsenceFixturesSchemaPath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.approvalAbsenceFixturesSchemaPath),
    live_adapter_disabled_fixtures_schema_path: path.resolve(options.liveAdapterDisabledFixturesSchemaPath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.liveAdapterDisabledFixturesSchemaPath),
    credential_lookup_disabled_fixtures_schema_path: path.resolve(options.credentialLookupDisabledFixturesSchemaPath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.credentialLookupDisabledFixturesSchemaPath),
    broker_write_disabled_fixtures_schema_path: path.resolve(options.brokerWriteDisabledFixturesSchemaPath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.brokerWriteDisabledFixturesSchemaPath),
    exchange_write_disabled_fixtures_schema_path: path.resolve(options.exchangeWriteDisabledFixturesSchemaPath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.exchangeWriteDisabledFixturesSchemaPath),
    safety_boundary_fixtures_schema_path: path.resolve(options.safetyBoundaryFixturesSchemaPath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.safetyBoundaryFixturesSchemaPath),
    manual_resume_disabled_fixtures_schema_path: path.resolve(options.manualResumeDisabledFixturesSchemaPath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.manualResumeDisabledFixturesSchemaPath),
    risk_override_disabled_fixtures_schema_path: path.resolve(options.riskOverrideDisabledFixturesSchemaPath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.riskOverrideDisabledFixturesSchemaPath),
    promotion_disabled_fixtures_schema_path: path.resolve(options.promotionDisabledFixturesSchemaPath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.promotionDisabledFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.executionEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.modelImprovementPath),
    backtest_validation_path: path.resolve(options.backtestValidationPath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.backtestValidationPath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.riskEnginePath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.marketDataFeatureStorePath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.researchBacktestPaperPath),
    route_source_paths: routeSourcePaths.map((sourcePath) => path.resolve(sourcePath)),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_FIRST_TRADE_DISABLED_FIXTURES_INPUTS.schemaPath),
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
    validation_item_id: `trading-first-trade-disabled-fixtures.${slugify(itemPath)}.${checkId}`,
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
