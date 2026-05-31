import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS,
  buildTradingManualResumeDisabledFixtures,
} from "./trading-manual-resume-disabled-fixtures.mjs";

export const DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_OUT_DIR = "artifacts/trading-risk-override-disabled-fixtures/latest";
export const DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS,
  manualResumeDisabledFixturesSchemaPath: DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-risk-override-disabled-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-risk-override-disabled-fixtures.v1";
const CAPABILITY_ID = "trading.risk_override_disabled_fixtures";
const PHASE_SLOT = "P390";
const PREVIOUS_PHASE_SLOT = "P389";
const NEXT_PHASE_SLOT = "P391";
const READY_STATUS = "ready_for_trading_risk_override_disabled_regression";
const REQUIRED_FIXTURE_KEYS = [
  "risk_override_policy_human_gate_required",
  "risk_artifact_override_review_required",
  "risk_safety_boundary_override_without_human_disabled",
  "risk_override_route_disabled",
  "risk_override_order_intent_blocked",
];

export async function runTradingRiskOverrideDisabledFixtures(options = {}) {
  const result = await buildTradingRiskOverrideDisabledFixtures(options);
  if (options.write !== false) await writeTradingRiskOverrideDisabledFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading risk override disabled fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingRiskOverrideDisabledFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const manualResumeDisabledFixtures = await buildTradingManualResumeDisabledFixtures({
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
    limitedLivePath: inputs.limited_live_path,
    fullAutoPath: inputs.full_auto_path,
    paperShadowPath: inputs.paper_shadow_path,
    executionEnginePath: inputs.execution_engine_path,
    modelImprovementPath: inputs.model_improvement_path,
    riskEnginePath: inputs.risk_engine_path,
    marketDataFeatureStorePath: inputs.market_data_feature_store_path,
    researchBacktestPaperPath: inputs.research_backtest_paper_path,
    routeSourcePaths: inputs.route_source_paths,
    schemaPath: inputs.manual_resume_disabled_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const riskEngine = await readJsonSource(inputs.risk_engine_path);
  const riskOverrideAnchor = buildRiskOverrideAnchor({ manualResumeDisabledFixtures });
  const riskOverrideEvidenceRows = buildRiskOverrideEvidenceRows({ riskEngine: riskEngine.data });
  const riskOverrideFixtureRows = buildRiskOverrideFixtureRows(riskOverrideEvidenceRows);
  const riskOverrideBoundary = buildRiskOverrideBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    manualResumeDisabledFixtures,
    evidenceRows: riskOverrideEvidenceRows,
    fixtureRows: riskOverrideFixtureRows,
  });
  const riskOverrideGateRows = buildRiskOverrideGateRows({
    manualResumeDisabledFixtures,
    packageJson,
    platformOpsLedger,
    riskEngine,
    fixtureRows: riskOverrideFixtureRows,
    boundary: riskOverrideBoundary,
  });
  const validationItems = buildValidationItems({
    manualResumeDisabledFixtures,
    packageJson,
    platformOpsLedger,
    riskEngine,
    evidenceRows: riskOverrideEvidenceRows,
    fixtureRows: riskOverrideFixtureRows,
    gateRows: riskOverrideGateRows,
    boundary: riskOverrideBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    manualResumeDisabledFixtures,
    evidenceRows: riskOverrideEvidenceRows,
    fixtureRows: riskOverrideFixtureRows,
    gateRows: riskOverrideGateRows,
    boundary: riskOverrideBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_risk_override_disabled_fixtures_id: `trading-risk-override-disabled-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    risk_override_disabled_anchor: riskOverrideAnchor,
    risk_override_disabled_evidence_rows: riskOverrideEvidenceRows,
    risk_override_disabled_fixture_rows: riskOverrideFixtureRows,
    risk_override_disabled_gate_rows: riskOverrideGateRows,
    risk_override_disabled_boundary: riskOverrideBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_risk_override_disabled_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    manualResumeDisabledFixtures,
    evidenceRows: riskOverrideEvidenceRows,
    fixtureRows: riskOverrideFixtureRows,
    gateRows: riskOverrideGateRows,
    boundary: riskOverrideBoundary,
    validation: result.validation,
  });
  result.summary.trading_risk_override_disabled_fixtures_id = result.trading_risk_override_disabled_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingRiskOverrideDisabledFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-risk-override-disabled-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "risk-override-disabled-evidence-rows.json"), collectionEnvelope("trading-risk-override-disabled-evidence-rows.v1", "risk_override_disabled_evidence_rows", result.risk_override_disabled_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "risk-override-disabled-fixture-rows.json"), collectionEnvelope("trading-risk-override-disabled-fixture-rows.v1", "risk_override_disabled_fixture_rows", result.risk_override_disabled_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "risk-override-disabled-gate-rows.json"), collectionEnvelope("trading-risk-override-disabled-gate-rows.v1", "risk_override_disabled_gate_rows", result.risk_override_disabled_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "risk-override-disabled-boundary.json"), result.risk_override_disabled_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-risk-override-disabled-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingRiskOverrideDisabledFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingRiskOverrideDisabledFixtures(args);
    console.log(`Trading risk override disabled fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_risk_override_disabled_fixtures_status}`);
    console.log(`Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
    console.log(`Unsafe risk override signals: ${result.summary.unsafe_risk_override_signal_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildRiskOverrideAnchor({ manualResumeDisabledFixtures }) {
  return {
    schema_version: "trading-risk-override-disabled-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_manual_resume_disabled_fixtures_id: manualResumeDisabledFixtures.trading_manual_resume_disabled_fixtures_id,
    source_manual_resume_disabled_status: manualResumeDisabledFixtures.summary.trading_manual_resume_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    required_fixture_keys: REQUIRED_FIXTURE_KEYS,
    source_hash: hashValue({
      id: manualResumeDisabledFixtures.trading_manual_resume_disabled_fixtures_id,
      status: manualResumeDisabledFixtures.summary.trading_manual_resume_disabled_fixtures_status,
      fixtures: REQUIRED_FIXTURE_KEYS,
    }),
  };
}

function buildRiskOverrideEvidenceRows({ riskEngine }) {
  const primaryRiskArtifact = Array.isArray(riskEngine?.risk_check_artifacts) ? riskEngine.risk_check_artifacts[0] : null;
  const rows = [
    riskOverrideEvidenceRow("risk_override_policy_human_gate_required", "risk_engine", "override_policy", [
      observedCondition("override_policy.override_allowed", valueAt(riskEngine, ["override_policy", "override_allowed"]), true),
      observedCondition("override_policy.requires_human_approval", valueAt(riskEngine, ["override_policy", "requires_human_approval"]), true),
      observedCondition("override_policy.protected_action_gate_required", valueAt(riskEngine, ["override_policy", "protected_action_gate_required"]), true),
      observedCondition("override_policy.override_receipt_required", valueAt(riskEngine, ["override_policy", "override_receipt_required"]), true),
    ]),
    riskOverrideEvidenceRow("risk_artifact_override_review_required", "risk_engine", "risk_check_artifacts[0]", [
      observedCondition("risk_check_artifacts[0].result", valueAt(primaryRiskArtifact, ["result"]), "block"),
      observedCondition("risk_check_artifacts[0].live_trade_allowed", valueAt(primaryRiskArtifact, ["live_trade_allowed"]), false),
      observedCondition("risk_check_artifacts[0].override_requires_human_approval", valueAt(primaryRiskArtifact, ["override_requires_human_approval"]), true),
      observedCondition("risk_check_artifacts[0].kill_switch_status", valueAt(primaryRiskArtifact, ["kill_switch_status"]), "armed"),
    ]),
    riskOverrideEvidenceRow("risk_safety_boundary_override_without_human_disabled", "risk_engine", "safety_boundary", [
      observedCondition("safety_boundary.pre_order_gate_only", valueAt(riskEngine, ["safety_boundary", "pre_order_gate_only"]), true),
      observedCondition("safety_boundary.risk_override_without_human_allowed", valueAt(riskEngine, ["safety_boundary", "risk_override_without_human_allowed"]), false),
      observedCondition("safety_boundary.human_review_required", valueAt(riskEngine, ["safety_boundary", "human_review_required"]), true),
      observedCondition("safety_boundary.live_execution_allowed", valueAt(riskEngine, ["safety_boundary", "live_execution_allowed"]), false),
    ]),
    riskOverrideEvidenceRow("risk_override_route_disabled", "risk_engine", "dashboard_api_stub", [
      observedCondition("dashboard_api_stub.read_only", valueAt(riskEngine, ["dashboard_api_stub", "read_only"]), true),
      observedCondition("dashboard_api_stub.mutating_routes_enabled", valueAt(riskEngine, ["dashboard_api_stub", "mutating_routes_enabled"]), false),
      observedCondition("dashboard_api_stub.disabled_routes.risk_override", hasDisabledRoute(valueAt(riskEngine, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/risk/override"), true),
      observedCondition("dashboard_api_stub.disabled_routes.orders", hasDisabledRoute(valueAt(riskEngine, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/orders"), true),
    ]),
    riskOverrideEvidenceRow("risk_override_order_intent_blocked", "risk_engine", "safety_boundary_order_intent", [
      observedCondition("safety_boundary.investment_advice_generated", valueAt(riskEngine, ["safety_boundary", "investment_advice_generated"]), false),
      observedCondition("safety_boundary.trade_recommendation_generated", valueAt(riskEngine, ["safety_boundary", "trade_recommendation_generated"]), false),
      observedCondition("safety_boundary.order_intent_generated", valueAt(riskEngine, ["safety_boundary", "order_intent_generated"]), false),
      observedCondition("safety_boundary.live_execution_allowed", valueAt(riskEngine, ["safety_boundary", "live_execution_allowed"]), false),
    ]),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "risk_override_disabled_evidence_hash"));
}

function riskOverrideEvidenceRow(rowKey, artifactId, evidencePath, observedConditions) {
  const allConditionsPresent = observedConditions.every((condition) => condition.condition_present);
  const unsafeConditions = observedConditions.filter((condition) => condition.observed_value !== condition.expected_safe_value);
  return {
    schema_version: "trading-risk-override-disabled-evidence-row.v1",
    risk_override_disabled_evidence_row_id: `trading-risk-override-disabled.evidence.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    artifact_id: artifactId,
    evidence_path: evidencePath,
    observed_conditions: observedConditions,
    observed_condition_count: observedConditions.length,
    all_conditions_present: allConditionsPresent,
    unsafe_risk_override_signal_detected: unsafeConditions.length > 0,
    unsafe_condition_refs: unsafeConditions.map((condition) => condition.condition_path),
    evidence_status: allConditionsPresent && unsafeConditions.length === 0 ? "risk_override_disabled" : "unsafe_or_incomplete",
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

function buildRiskOverrideFixtureRows(evidenceRows) {
  return REQUIRED_FIXTURE_KEYS.map((fixtureKey, index) => {
    const evidenceRow = evidenceRows.find((row) => row.row_key === fixtureKey);
    const row = {
      schema_version: "trading-risk-override-disabled-fixture-row.v1",
      risk_override_disabled_fixture_row_id: `trading-risk-override-disabled-fixtures.row.${fixtureKey}`,
      phase_slot: PHASE_SLOT,
      row_key: fixtureKey,
      expected_risk_override_without_human_allowed: false,
      unsafe_risk_override_signal_detected: evidenceRow?.unsafe_risk_override_signal_detected === true,
      evidence_status: evidenceRow?.evidence_status ?? "missing",
      fixture_should_fail_when_override_without_human_allowed: true,
      fixture_should_fail_when_override_route_enabled: true,
      fixture_should_fail_when_order_intent_generated: true,
      fixture_status: evidenceRow?.evidence_status === "risk_override_disabled" ? "passed" : "failed",
      risk_override_without_human_allowed_by_fixture: false,
      risk_override_route_enabled_by_fixture: false,
      order_intent_generated_by_fixture: false,
      live_execution_allowed_by_fixture: false,
      command_execution_performed_by_fixture: false,
      artifact_write_performed_by_fixture: false,
      protected_action_executed_by_fixture: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "risk_override_disabled_fixture_hash");
  });
}

function buildRiskOverrideBoundary({ generatedAt, writeRequested, manualResumeDisabledFixtures, evidenceRows, fixtureRows }) {
  const unsafeRows = evidenceRows.filter((row) => row.unsafe_risk_override_signal_detected);
  const sourceBoundary = manualResumeDisabledFixtures.summary;
  return {
    schema_version: "trading-risk-override-disabled-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    risk_override_disabled_artifact_write_requested: writeRequested,
    risk_override_disabled_fixture_execution_performed: false,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    risk_override_evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    unsafe_risk_override_signal_count: unsafeRows.length,
    unsafe_risk_override_signal_refs: unsafeRows.map((row) => row.row_key),
    risk_override_disabled_covered: evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "risk_override_disabled"),
    source_manual_resume_disabled_status: sourceBoundary.trading_manual_resume_disabled_fixtures_status,
    source_manual_resume_disabled_ready: manualResumeDisabledFixtures.validation.valid && sourceBoundary.trading_manual_resume_disabled_fixtures_status === "ready_for_trading_manual_resume_disabled_regression",
    human_approval_required_missing: observedUnsafeCondition(evidenceRows, "override_policy.requires_human_approval") || observedUnsafeCondition(evidenceRows, "risk_check_artifacts[0].override_requires_human_approval") || observedUnsafeCondition(evidenceRows, "safety_boundary.human_review_required"),
    protected_action_gate_missing: observedUnsafeCondition(evidenceRows, "override_policy.protected_action_gate_required"),
    override_receipt_required_missing: observedUnsafeCondition(evidenceRows, "override_policy.override_receipt_required"),
    risk_override_without_human_allowed: observedUnsafeCondition(evidenceRows, "safety_boundary.risk_override_without_human_allowed"),
    risk_override_route_enabled: observedUnsafeCondition(evidenceRows, "dashboard_api_stub.mutating_routes_enabled") || observedUnsafeCondition(evidenceRows, "dashboard_api_stub.disabled_routes.risk_override"),
    order_intent_generated: observedUnsafeCondition(evidenceRows, "safety_boundary.order_intent_generated"),
    investment_advice_generated: observedUnsafeCondition(evidenceRows, "safety_boundary.investment_advice_generated"),
    trade_recommendation_generated: observedUnsafeCondition(evidenceRows, "safety_boundary.trade_recommendation_generated"),
    live_trade_allowed: observedUnsafeCondition(evidenceRows, "risk_check_artifacts[0].live_trade_allowed"),
    live_execution_allowed: observedUnsafeCondition(evidenceRows, "safety_boundary.live_execution_allowed"),
    limited_live_enabled: sourceBoundary.limited_live_enabled,
    full_auto_enabled: sourceBoundary.full_auto_enabled,
    trading_live_enabled: sourceBoundary.trading_live_enabled,
    trading_order_submission_allowed: sourceBoundary.trading_order_submission_allowed,
    automatic_order_submission_allowed: sourceBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: sourceBoundary.live_order_submission_allowed,
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

function buildRiskOverrideGateRows({ manualResumeDisabledFixtures, packageJson, platformOpsLedger, riskEngine, fixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p389_manual_resume_disabled_fixtures_ready", "P389 manual resume disabled fixtures source is ready.", manualResumeDisabledFixtures.validation.valid && manualResumeDisabledFixtures.summary.trading_manual_resume_disabled_fixtures_status === "ready_for_trading_manual_resume_disabled_regression"),
    gateRow("platform_package_script_registered", "package.json registers the P390 trading risk override disabled fixtures command.", typeof scripts["trading:risk-override-disabled-fixtures"] === "string" && scripts["trading:risk-override-disabled-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P390 trading risk override disabled fixtures command.", validateScript.includes("npm run trading:risk-override-disabled-fixtures -- --check")),
    gateRow("p390_ledger_acceptance_declared", "P390 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P390: `trading:risk-override-disabled-fixtures`")),
    gateRow("risk_override_source_readable", "Trading risk override source is readable.", riskEngine.available),
    gateRow("required_risk_override_fixtures_declared", "All required risk override disabled fixtures are declared.", REQUIRED_FIXTURE_KEYS.every((fixtureKey) => fixtureRows.some((row) => row.row_key === fixtureKey)) && fixtureRows.length === REQUIRED_FIXTURE_KEYS.length),
    gateRow("human_approval_and_protected_gate_required", "Risk override requires human approval, protected action gate, and receipt.", !boundary.human_approval_required_missing && !boundary.protected_action_gate_missing && !boundary.override_receipt_required_missing),
    gateRow("risk_override_without_human_disabled", "Risk override without human review and override routes remain disabled.", !boundary.risk_override_without_human_allowed && !boundary.risk_override_route_enabled),
    gateRow("no_order_intent_or_live_execution", "Risk override cannot create order intent, advice, recommendation, live trade, or live execution.", !boundary.order_intent_generated && !boundary.investment_advice_generated && !boundary.trade_recommendation_generated && !boundary.live_trade_allowed && !boundary.live_execution_allowed),
    gateRow("no_trading_or_artifact_mutation", "Risk override disabled fixtures do not execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "risk_override_disabled_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-risk-override-disabled-gate-row.v1",
    risk_override_disabled_gate_row_id: `trading-risk-override-disabled-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    risk_override_without_human_allowed_by_gate: false,
    risk_override_route_enabled_by_gate: false,
    order_intent_generated_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ manualResumeDisabledFixtures, packageJson, platformOpsLedger, riskEngine, evidenceRows, fixtureRows, gateRows, boundary }) {
  return [
    validationItem("source.manual_resume_disabled_fixtures", "p389_manual_resume_disabled_fixtures_ready", manualResumeDisabledFixtures.validation.valid && manualResumeDisabledFixtures.summary.trading_manual_resume_disabled_fixtures_status === "ready_for_trading_manual_resume_disabled_regression", "P389 manual resume disabled fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P390 risk override disabled fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.risk_engine", "risk_engine_available", riskEngine.available, "Trading risk engine source is readable."),
    validationItem("risk_override_disabled_evidence_rows", "risk_override_evidence_ready", evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "risk_override_disabled"), "Risk override evidence rows must show human-gated/disabled state."),
    validationItem("risk_override_disabled_fixture_rows", "required_risk_override_fixtures_pass", fixtureRows.length === REQUIRED_FIXTURE_KEYS.length && fixtureRows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_override_without_human_allowed && row.fixture_should_fail_when_override_route_enabled), "All risk override disabled fixtures must pass."),
    validationItem("risk_override_disabled_gate_rows", "risk_override_disabled_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P390 risk override disabled gates are ready."),
    validationItem("boundary.human_gate_required", "human_approval_and_protected_gate_required", boundary.risk_override_disabled_covered && !boundary.human_approval_required_missing && !boundary.protected_action_gate_missing && !boundary.override_receipt_required_missing, "Risk override must require human approval, protected action gate, and receipt."),
    validationItem("boundary.override_without_human_disabled", "risk_override_without_human_disabled", !boundary.risk_override_without_human_allowed && !boundary.risk_override_route_enabled, "Risk override without human review and override routes remain disabled."),
    validationItem("boundary.no_order_intent_or_live_execution", "no_order_intent_or_live_execution", !boundary.order_intent_generated && !boundary.investment_advice_generated && !boundary.trade_recommendation_generated && !boundary.live_trade_allowed && !boundary.live_execution_allowed, "Risk override cannot generate advice, order intent, live trade, or live execution."),
    validationItem("boundary.no_mutation", "no_trading_or_artifact_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed, "P390 risk override disabled fixtures perform no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ manualResumeDisabledFixtures, evidenceRows, fixtureRows, gateRows, boundary, validation }) {
  return {
    trading_risk_override_disabled_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_manual_resume_disabled_status: manualResumeDisabledFixtures.summary.trading_manual_resume_disabled_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    passed_fixture_count: fixtureRows.filter((row) => row.fixture_status === "passed").length,
    failed_fixture_count: fixtureRows.filter((row) => row.fixture_status !== "passed").length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    unsafe_risk_override_signal_count: boundary.unsafe_risk_override_signal_count,
    risk_override_disabled_covered: boundary.risk_override_disabled_covered,
    human_approval_required_missing: boundary.human_approval_required_missing,
    protected_action_gate_missing: boundary.protected_action_gate_missing,
    override_receipt_required_missing: boundary.override_receipt_required_missing,
    risk_override_without_human_allowed: boundary.risk_override_without_human_allowed,
    risk_override_route_enabled: boundary.risk_override_route_enabled,
    order_intent_generated: boundary.order_intent_generated,
    investment_advice_generated: boundary.investment_advice_generated,
    trade_recommendation_generated: boundary.trade_recommendation_generated,
    live_trade_allowed: boundary.live_trade_allowed,
    live_execution_allowed: boundary.live_execution_allowed,
    limited_live_enabled: boundary.limited_live_enabled,
    full_auto_enabled: boundary.full_auto_enabled,
    trading_live_enabled: boundary.trading_live_enabled,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    automatic_order_submission_allowed: boundary.automatic_order_submission_allowed,
    live_order_submission_allowed: boundary.live_order_submission_allowed,
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
    "# Trading Risk Override Disabled Fixtures",
    "",
    `Status: ${result.summary.trading_risk_override_disabled_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source manual resume disabled: ${result.summary.source_manual_resume_disabled_status}`,
    `Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`,
    `Unsafe risk override signals: ${result.summary.unsafe_risk_override_signal_count}`,
    "",
    "## Fixtures",
    "",
    ...result.risk_override_disabled_fixture_rows.map((row) => `- ${row.row_key}: ${row.fixture_status}`),
    "",
    "## Gates",
    "",
    ...result.risk_override_disabled_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_OUT_DIR, routeSourcePaths: [] };
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
  console.log(`Usage: node scripts/trading-risk-override-disabled-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_OUT_DIR}
  --run-at <iso>                           Deterministic generated_at timestamp.
  --package <path>                         package.json path.
  --platform-ops-ledger <path>             P341-P500 platform operations ledger path.
  --limited-live <path>                    Limited-live governance artifact path.
  --full-auto <path>                       Full-auto governance artifact path.
  --paper-shadow <path>                    Paper/shadow governance artifact path.
  --execution-engine <path>                Execution engine artifact path.
  --model-improvement <path>               Model improvement artifact path.
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
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  const routeSourcePaths = options.routeSourcePaths ?? options.routeSources ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.routeSourcePaths;
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.platformOpsLedgerPath),
    release_check_receipt_closeout_schema_path: path.resolve(options.releaseCheckReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.releaseCheckReceiptCloseoutSchemaPath),
    safety_regression_fixtures_schema_path: path.resolve(options.safetyRegressionFixturesSchemaPath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.safetyRegressionFixturesSchemaPath),
    route_inventory_fixtures_schema_path: path.resolve(options.routeInventoryFixturesSchemaPath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.routeInventoryFixturesSchemaPath),
    approval_absence_fixtures_schema_path: path.resolve(options.approvalAbsenceFixturesSchemaPath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.approvalAbsenceFixturesSchemaPath),
    live_adapter_disabled_fixtures_schema_path: path.resolve(options.liveAdapterDisabledFixturesSchemaPath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.liveAdapterDisabledFixturesSchemaPath),
    credential_lookup_disabled_fixtures_schema_path: path.resolve(options.credentialLookupDisabledFixturesSchemaPath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.credentialLookupDisabledFixturesSchemaPath),
    broker_write_disabled_fixtures_schema_path: path.resolve(options.brokerWriteDisabledFixturesSchemaPath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.brokerWriteDisabledFixturesSchemaPath),
    exchange_write_disabled_fixtures_schema_path: path.resolve(options.exchangeWriteDisabledFixturesSchemaPath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.exchangeWriteDisabledFixturesSchemaPath),
    safety_boundary_fixtures_schema_path: path.resolve(options.safetyBoundaryFixturesSchemaPath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.safetyBoundaryFixturesSchemaPath),
    manual_resume_disabled_fixtures_schema_path: path.resolve(options.manualResumeDisabledFixturesSchemaPath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.manualResumeDisabledFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.executionEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.modelImprovementPath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.riskEnginePath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.marketDataFeatureStorePath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.researchBacktestPaperPath),
    route_source_paths: routeSourcePaths.map((sourcePath) => path.resolve(sourcePath)),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_RISK_OVERRIDE_DISABLED_FIXTURES_INPUTS.schemaPath),
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
    validation_item_id: `trading-risk-override-disabled-fixtures.${slugify(itemPath)}.${checkId}`,
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
