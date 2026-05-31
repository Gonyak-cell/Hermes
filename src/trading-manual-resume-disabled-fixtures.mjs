import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS,
  buildTradingSafetyBoundaryFixtures,
} from "./trading-safety-boundary-fixtures.mjs";

export const DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_OUT_DIR = "artifacts/trading-manual-resume-disabled-fixtures/latest";
export const DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS,
  safetyBoundaryFixturesSchemaPath: DEFAULT_TRADING_SAFETY_BOUNDARY_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-manual-resume-disabled-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-manual-resume-disabled-fixtures.v1";
const CAPABILITY_ID = "trading.manual_resume_disabled_fixtures";
const PHASE_SLOT = "P389";
const PREVIOUS_PHASE_SLOT = "P388";
const NEXT_PHASE_SLOT = "P390";
const READY_STATUS = "ready_for_trading_manual_resume_disabled_regression";
const REQUIRED_FIXTURE_KEYS = [
  "execution_emergency_halt_manual_resume_required",
  "execution_manual_resume_route_disabled",
  "paper_kill_switch_manual_resume_required",
  "limited_live_rollback_manual_resume_required",
  "full_auto_disaster_recovery_manual_resume_required",
  "full_auto_operator_handbook_manual_resume_only",
];

export async function runTradingManualResumeDisabledFixtures(options = {}) {
  const result = await buildTradingManualResumeDisabledFixtures(options);
  if (options.write !== false) await writeTradingManualResumeDisabledFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading manual resume disabled fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingManualResumeDisabledFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const safetyBoundaryFixtures = await buildTradingSafetyBoundaryFixtures({
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
    limitedLivePath: inputs.limited_live_path,
    fullAutoPath: inputs.full_auto_path,
    paperShadowPath: inputs.paper_shadow_path,
    executionEnginePath: inputs.execution_engine_path,
    modelImprovementPath: inputs.model_improvement_path,
    riskEnginePath: inputs.risk_engine_path,
    marketDataFeatureStorePath: inputs.market_data_feature_store_path,
    researchBacktestPaperPath: inputs.research_backtest_paper_path,
    routeSourcePaths: inputs.route_source_paths,
    schemaPath: inputs.safety_boundary_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const executionEngine = await readJsonSource(inputs.execution_engine_path);
  const paperShadow = await readJsonSource(inputs.paper_shadow_path);
  const limitedLive = await readJsonSource(inputs.limited_live_path);
  const fullAuto = await readJsonSource(inputs.full_auto_path);
  const manualResumeAnchor = buildManualResumeAnchor({ safetyBoundaryFixtures });
  const manualResumeEvidenceRows = buildManualResumeEvidenceRows({
    executionEngine: executionEngine.data,
    paperShadow: paperShadow.data,
    limitedLive: limitedLive.data,
    fullAuto: fullAuto.data,
  });
  const manualResumeFixtureRows = buildManualResumeFixtureRows(manualResumeEvidenceRows);
  const manualResumeBoundary = buildManualResumeBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    safetyBoundaryFixtures,
    evidenceRows: manualResumeEvidenceRows,
    fixtureRows: manualResumeFixtureRows,
  });
  const manualResumeGateRows = buildManualResumeGateRows({
    safetyBoundaryFixtures,
    packageJson,
    platformOpsLedger,
    sources: [executionEngine, paperShadow, limitedLive, fullAuto],
    evidenceRows: manualResumeEvidenceRows,
    fixtureRows: manualResumeFixtureRows,
    boundary: manualResumeBoundary,
  });
  const validationItems = buildValidationItems({
    safetyBoundaryFixtures,
    packageJson,
    platformOpsLedger,
    sources: [executionEngine, paperShadow, limitedLive, fullAuto],
    evidenceRows: manualResumeEvidenceRows,
    fixtureRows: manualResumeFixtureRows,
    gateRows: manualResumeGateRows,
    boundary: manualResumeBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    safetyBoundaryFixtures,
    evidenceRows: manualResumeEvidenceRows,
    fixtureRows: manualResumeFixtureRows,
    gateRows: manualResumeGateRows,
    boundary: manualResumeBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_manual_resume_disabled_fixtures_id: `trading-manual-resume-disabled-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    manual_resume_disabled_anchor: manualResumeAnchor,
    manual_resume_disabled_evidence_rows: manualResumeEvidenceRows,
    manual_resume_disabled_fixture_rows: manualResumeFixtureRows,
    manual_resume_disabled_gate_rows: manualResumeGateRows,
    manual_resume_disabled_boundary: manualResumeBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_manual_resume_disabled_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    safetyBoundaryFixtures,
    evidenceRows: manualResumeEvidenceRows,
    fixtureRows: manualResumeFixtureRows,
    gateRows: manualResumeGateRows,
    boundary: manualResumeBoundary,
    validation: result.validation,
  });
  result.summary.trading_manual_resume_disabled_fixtures_id = result.trading_manual_resume_disabled_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingManualResumeDisabledFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-manual-resume-disabled-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "manual-resume-disabled-evidence-rows.json"), collectionEnvelope("trading-manual-resume-disabled-evidence-rows.v1", "manual_resume_disabled_evidence_rows", result.manual_resume_disabled_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "manual-resume-disabled-fixture-rows.json"), collectionEnvelope("trading-manual-resume-disabled-fixture-rows.v1", "manual_resume_disabled_fixture_rows", result.manual_resume_disabled_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "manual-resume-disabled-gate-rows.json"), collectionEnvelope("trading-manual-resume-disabled-gate-rows.v1", "manual_resume_disabled_gate_rows", result.manual_resume_disabled_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "manual-resume-disabled-boundary.json"), result.manual_resume_disabled_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-manual-resume-disabled-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingManualResumeDisabledFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingManualResumeDisabledFixtures(args);
    console.log(`Trading manual resume disabled fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_manual_resume_disabled_fixtures_status}`);
    console.log(`Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
    console.log(`Unsafe manual resume signals: ${result.summary.unsafe_manual_resume_signal_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildManualResumeAnchor({ safetyBoundaryFixtures }) {
  return {
    schema_version: "trading-manual-resume-disabled-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_safety_boundary_fixtures_id: safetyBoundaryFixtures.trading_safety_boundary_fixtures_id,
    source_safety_boundary_status: safetyBoundaryFixtures.summary.trading_safety_boundary_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    required_fixture_keys: REQUIRED_FIXTURE_KEYS,
    source_hash: hashValue({
      id: safetyBoundaryFixtures.trading_safety_boundary_fixtures_id,
      status: safetyBoundaryFixtures.summary.trading_safety_boundary_fixtures_status,
      fixtures: REQUIRED_FIXTURE_KEYS,
    }),
  };
}

function buildManualResumeEvidenceRows({ executionEngine, paperShadow, limitedLive, fullAuto }) {
  const paperDryRunId = valueAt(paperShadow, ["kill_switch_dry_run", "dry_run_id"]);
  const rows = [
    manualResumeEvidenceRow("execution_emergency_halt_manual_resume_required", "execution_engine", "emergency_halt", [
      observedCondition("emergency_halt.available", valueAt(executionEngine, ["emergency_halt", "available"]), true),
      observedCondition("emergency_halt.halt_state", valueAt(executionEngine, ["emergency_halt", "halt_state"]), "halted"),
      observedCondition("emergency_halt.manual_resume_required", valueAt(executionEngine, ["emergency_halt", "manual_resume_required"]), true),
      observedCondition("emergency_halt.cancels_live_orders", valueAt(executionEngine, ["emergency_halt", "cancels_live_orders"]), false),
      observedCondition("safety_boundary.manual_resume_required", valueAt(executionEngine, ["safety_boundary", "manual_resume_required"]), true),
    ]),
    manualResumeEvidenceRow("execution_manual_resume_route_disabled", "execution_engine", "manual_resume_policy", [
      observedCondition("manual_resume_policy.manual_resume_only", valueAt(executionEngine, ["manual_resume_policy", "manual_resume_only"]), true),
      observedCondition("manual_resume_policy.human_approval_required", valueAt(executionEngine, ["manual_resume_policy", "human_approval_required"]), true),
      observedCondition("manual_resume_policy.resume_route_enabled", valueAt(executionEngine, ["manual_resume_policy", "resume_route_enabled"]), false),
      observedCondition("dashboard_api_stub.disabled_routes.execution_resume", hasDisabledRoute(valueAt(executionEngine, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/execution/resume"), true),
    ]),
    manualResumeEvidenceRow("paper_kill_switch_manual_resume_required", "paper_shadow_live", "kill_switch_dry_run", [
      observedCondition("kill_switch_dry_run.executed", valueAt(paperShadow, ["kill_switch_dry_run", "executed"]), true),
      observedCondition("kill_switch_dry_run.manual_resume_required", valueAt(paperShadow, ["kill_switch_dry_run", "manual_resume_required"]), true),
      observedCondition("kill_switch_dry_run.live_orders_cancelled", valueAt(paperShadow, ["kill_switch_dry_run", "live_orders_cancelled"]), 0),
      observedCondition("safety_boundary.real_order_submitted", valueAt(paperShadow, ["safety_boundary", "real_order_submitted"]), false),
    ]),
    manualResumeEvidenceRow("limited_live_rollback_manual_resume_required", "limited_live_governance", "rollback_policy", [
      observedCondition("limited_live.rollback_policy.rollback_to_paper_mode", valueAt(limitedLive, ["rollback_policy", "rollback_to_paper_mode"]), true),
      observedCondition("limited_live.rollback_policy.rollback_stage", valueAt(limitedLive, ["rollback_policy", "rollback_stage"]), "paper"),
      observedCondition("limited_live.rollback_policy.manual_resume_required", valueAt(limitedLive, ["rollback_policy", "manual_resume_required"]), true),
      observedCondition("limited_live.safety_boundary.limited_live_enabled", valueAt(limitedLive, ["safety_boundary", "limited_live_enabled"]), false),
      observedCondition("limited_live.safety_boundary.live_order_submission_allowed", valueAt(limitedLive, ["safety_boundary", "live_order_submission_allowed"]), false),
    ]),
    manualResumeEvidenceRow("full_auto_disaster_recovery_manual_resume_required", "full_auto_governance", "disaster_recovery", [
      observedCondition("full_auto.disaster_recovery.rollback_stage", valueAt(fullAuto, ["disaster_recovery", "rollback_stage"]), "paper"),
      observedCondition("full_auto.disaster_recovery.manual_resume_required", valueAt(fullAuto, ["disaster_recovery", "manual_resume_required"]), true),
      observedCondition("full_auto.disaster_recovery.restore_from_artifacts_only", valueAt(fullAuto, ["disaster_recovery", "restore_from_artifacts_only"]), true),
      observedCondition("full_auto.disaster_recovery.external_broker_recovery_allowed", valueAt(fullAuto, ["disaster_recovery", "external_broker_recovery_allowed"]), false),
      observedCondition("full_auto.disaster_recovery.dry_run_ref", valueAt(fullAuto, ["disaster_recovery", "dry_run_ref"]), paperDryRunId),
    ]),
    manualResumeEvidenceRow("full_auto_operator_handbook_manual_resume_only", "full_auto_governance", "operator_handbook", [
      observedCondition("full_auto.operator_handbook.required", valueAt(fullAuto, ["operator_handbook", "required"]), true),
      observedCondition("full_auto.operator_handbook.human_review_queue_required", valueAt(fullAuto, ["operator_handbook", "human_review_queue_required"]), true),
      observedCondition("full_auto.operator_handbook.protected_action_routes_disabled", valueAt(fullAuto, ["operator_handbook", "protected_action_routes_disabled"]), true),
      observedCondition("full_auto.operator_handbook.manual_resume_only", valueAt(fullAuto, ["operator_handbook", "manual_resume_only"]), true),
    ]),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "manual_resume_disabled_evidence_hash"));
}

function manualResumeEvidenceRow(rowKey, artifactId, evidencePath, observedConditions) {
  const allConditionsPresent = observedConditions.every((condition) => condition.condition_present);
  const unsafeConditions = observedConditions.filter((condition) => condition.observed_value !== condition.expected_safe_value);
  return {
    schema_version: "trading-manual-resume-disabled-evidence-row.v1",
    manual_resume_disabled_evidence_row_id: `trading-manual-resume-disabled.evidence.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    artifact_id: artifactId,
    evidence_path: evidencePath,
    observed_conditions: observedConditions,
    observed_condition_count: observedConditions.length,
    all_conditions_present: allConditionsPresent,
    unsafe_manual_resume_signal_detected: unsafeConditions.length > 0,
    unsafe_condition_refs: unsafeConditions.map((condition) => condition.condition_path),
    evidence_status: allConditionsPresent && unsafeConditions.length === 0 ? "manual_resume_disabled" : "unsafe_or_incomplete",
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

function buildManualResumeFixtureRows(evidenceRows) {
  return REQUIRED_FIXTURE_KEYS.map((fixtureKey, index) => {
    const evidenceRow = evidenceRows.find((row) => row.row_key === fixtureKey);
    const row = {
      schema_version: "trading-manual-resume-disabled-fixture-row.v1",
      manual_resume_disabled_fixture_row_id: `trading-manual-resume-disabled-fixtures.row.${fixtureKey}`,
      phase_slot: PHASE_SLOT,
      row_key: fixtureKey,
      expected_manual_resume_route_enabled: false,
      unsafe_manual_resume_signal_detected: evidenceRow?.unsafe_manual_resume_signal_detected === true,
      evidence_status: evidenceRow?.evidence_status ?? "missing",
      fixture_should_fail_when_resume_route_enabled: true,
      fixture_should_fail_when_manual_resume_not_required: true,
      fixture_should_fail_when_live_orders_cancelled: true,
      fixture_status: evidenceRow?.evidence_status === "manual_resume_disabled" ? "passed" : "failed",
      manual_resume_route_enabled_by_fixture: false,
      live_order_submission_allowed_by_fixture: false,
      live_orders_cancelled_by_fixture: false,
      command_execution_performed_by_fixture: false,
      artifact_write_performed_by_fixture: false,
      protected_action_executed_by_fixture: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "manual_resume_disabled_fixture_hash");
  });
}

function buildManualResumeBoundary({ generatedAt, writeRequested, safetyBoundaryFixtures, evidenceRows, fixtureRows }) {
  const unsafeRows = evidenceRows.filter((row) => row.unsafe_manual_resume_signal_detected);
  const sourceBoundary = safetyBoundaryFixtures.summary;
  return {
    schema_version: "trading-manual-resume-disabled-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    manual_resume_disabled_artifact_write_requested: writeRequested,
    manual_resume_disabled_fixture_execution_performed: false,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    manual_resume_evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    unsafe_manual_resume_signal_count: unsafeRows.length,
    unsafe_manual_resume_signal_refs: unsafeRows.map((row) => row.row_key),
    manual_resume_disabled_covered: evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "manual_resume_disabled"),
    source_safety_boundary_status: sourceBoundary.trading_safety_boundary_fixtures_status,
    source_safety_boundary_ready: safetyBoundaryFixtures.validation.valid && sourceBoundary.trading_safety_boundary_fixtures_status === "ready_for_trading_safety_boundary_regression",
    manual_resume_required_missing: observedUnsafeCondition(evidenceRows, "emergency_halt.manual_resume_required") || observedUnsafeCondition(evidenceRows, "safety_boundary.manual_resume_required") || observedUnsafeCondition(evidenceRows, "manual_resume_policy.manual_resume_only") || observedUnsafeCondition(evidenceRows, "manual_resume_policy.human_approval_required") || observedUnsafeCondition(evidenceRows, "kill_switch_dry_run.manual_resume_required") || observedUnsafeCondition(evidenceRows, "limited_live.rollback_policy.manual_resume_required") || observedUnsafeCondition(evidenceRows, "full_auto.disaster_recovery.manual_resume_required") || observedUnsafeCondition(evidenceRows, "full_auto.operator_handbook.manual_resume_only"),
    manual_resume_route_enabled: observedUnsafeCondition(evidenceRows, "manual_resume_policy.resume_route_enabled") || observedUnsafeCondition(evidenceRows, "dashboard_api_stub.disabled_routes.execution_resume"),
    live_orders_cancelled: observedUnsafeCondition(evidenceRows, "emergency_halt.cancels_live_orders") || observedUnsafeCondition(evidenceRows, "kill_switch_dry_run.live_orders_cancelled"),
    rollback_to_paper_missing: observedUnsafeCondition(evidenceRows, "limited_live.rollback_policy.rollback_to_paper_mode") || observedUnsafeCondition(evidenceRows, "limited_live.rollback_policy.rollback_stage") || observedUnsafeCondition(evidenceRows, "full_auto.disaster_recovery.rollback_stage") || observedUnsafeCondition(evidenceRows, "full_auto.disaster_recovery.restore_from_artifacts_only") || observedUnsafeCondition(evidenceRows, "full_auto.disaster_recovery.dry_run_ref"),
    protected_action_route_enabled: observedUnsafeCondition(evidenceRows, "full_auto.operator_handbook.protected_action_routes_disabled"),
    external_broker_recovery_allowed: observedUnsafeCondition(evidenceRows, "full_auto.disaster_recovery.external_broker_recovery_allowed"),
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
    live_cancel_allowed: sourceBoundary.live_cancel_allowed,
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

function buildManualResumeGateRows({ safetyBoundaryFixtures, packageJson, platformOpsLedger, sources, evidenceRows, fixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p388_safety_boundary_fixtures_ready", "P388 safety boundary fixtures source is ready.", safetyBoundaryFixtures.validation.valid && safetyBoundaryFixtures.summary.trading_safety_boundary_fixtures_status === "ready_for_trading_safety_boundary_regression"),
    gateRow("platform_package_script_registered", "package.json registers the P389 trading manual resume disabled fixtures command.", typeof scripts["trading:manual-resume-disabled-fixtures"] === "string" && scripts["trading:manual-resume-disabled-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P389 trading manual resume disabled fixtures command.", validateScript.includes("npm run trading:manual-resume-disabled-fixtures -- --check")),
    gateRow("p389_ledger_acceptance_declared", "P389 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P389: `trading:manual-resume-disabled-fixtures`")),
    gateRow("manual_resume_sources_readable", "Trading manual resume disabled sources are readable.", sources.every((source) => source.available)),
    gateRow("required_manual_resume_fixtures_declared", "All required manual resume disabled fixtures are declared.", REQUIRED_FIXTURE_KEYS.every((fixtureKey) => fixtureRows.some((row) => row.row_key === fixtureKey)) && fixtureRows.length === REQUIRED_FIXTURE_KEYS.length),
    gateRow("manual_resume_required", "Emergency halt, kill-switch dry-run, rollback, disaster recovery, and operator handbook require manual resume.", boundary.manual_resume_disabled_covered && !boundary.manual_resume_required_missing),
    gateRow("manual_resume_routes_disabled", "Manual resume routes and protected action routes remain disabled.", !boundary.manual_resume_route_enabled && !boundary.protected_action_route_enabled),
    gateRow("rollback_to_paper_only", "Rollback and disaster recovery remain paper-only without live order cancellation or external broker recovery.", !boundary.rollback_to_paper_missing && !boundary.live_orders_cancelled && !boundary.external_broker_recovery_allowed),
    gateRow("no_trading_or_artifact_mutation", "Manual resume disabled fixtures do not execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "manual_resume_disabled_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-manual-resume-disabled-gate-row.v1",
    manual_resume_disabled_gate_row_id: `trading-manual-resume-disabled-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    manual_resume_route_enabled_by_gate: false,
    live_order_submission_allowed_by_gate: false,
    live_orders_cancelled_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ safetyBoundaryFixtures, packageJson, platformOpsLedger, sources, evidenceRows, fixtureRows, gateRows, boundary }) {
  return [
    validationItem("source.safety_boundary_fixtures", "p388_safety_boundary_fixtures_ready", safetyBoundaryFixtures.validation.valid && safetyBoundaryFixtures.summary.trading_safety_boundary_fixtures_status === "ready_for_trading_safety_boundary_regression", "P388 safety boundary fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P389 manual resume disabled fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.manual_resume_sources", "manual_resume_sources_readable", sources.every((source) => source.available), "Trading manual resume disabled sources are readable."),
    validationItem("manual_resume_disabled_evidence_rows", "manual_resume_evidence_ready", evidenceRows.length === REQUIRED_FIXTURE_KEYS.length && evidenceRows.every((row) => row.evidence_status === "manual_resume_disabled"), "Manual resume evidence rows must show disabled/manual-gated state."),
    validationItem("manual_resume_disabled_fixture_rows", "required_manual_resume_fixtures_pass", fixtureRows.length === REQUIRED_FIXTURE_KEYS.length && fixtureRows.every((row) => row.fixture_status === "passed" && row.fixture_should_fail_when_resume_route_enabled && row.fixture_should_fail_when_manual_resume_not_required), "All manual resume disabled fixtures must pass."),
    validationItem("manual_resume_disabled_gate_rows", "manual_resume_disabled_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P389 manual resume disabled gates are ready."),
    validationItem("boundary.manual_resume_required", "manual_resume_required", boundary.manual_resume_disabled_covered && !boundary.manual_resume_required_missing && !boundary.manual_resume_route_enabled, "Manual resume must be required and resume routes must stay disabled."),
    validationItem("boundary.rollback_to_paper", "rollback_to_paper_only", !boundary.rollback_to_paper_missing && !boundary.live_orders_cancelled && !boundary.external_broker_recovery_allowed, "Rollback and recovery must stay paper-only without live order cancellation or external broker recovery."),
    validationItem("boundary.trading_disabled", "trading_disabled", !boundary.limited_live_enabled && !boundary.full_auto_enabled && !boundary.trading_live_enabled && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.trading_order_submission_allowed && !boundary.real_order_submitted && !boundary.live_adapter_enabled && !boundary.broker_write_allowed && !boundary.exchange_write_allowed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
    validationItem("boundary.no_mutation", "no_trading_or_artifact_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed, "P389 manual resume disabled fixtures perform no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ safetyBoundaryFixtures, evidenceRows, fixtureRows, gateRows, boundary, validation }) {
  return {
    trading_manual_resume_disabled_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_safety_boundary_status: safetyBoundaryFixtures.summary.trading_safety_boundary_fixtures_status,
    required_fixture_count: REQUIRED_FIXTURE_KEYS.length,
    evidence_count: evidenceRows.length,
    fixture_count: fixtureRows.length,
    passed_fixture_count: fixtureRows.filter((row) => row.fixture_status === "passed").length,
    failed_fixture_count: fixtureRows.filter((row) => row.fixture_status !== "passed").length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    unsafe_manual_resume_signal_count: boundary.unsafe_manual_resume_signal_count,
    manual_resume_disabled_covered: boundary.manual_resume_disabled_covered,
    manual_resume_required_missing: boundary.manual_resume_required_missing,
    manual_resume_route_enabled: boundary.manual_resume_route_enabled,
    live_orders_cancelled: boundary.live_orders_cancelled,
    rollback_to_paper_missing: boundary.rollback_to_paper_missing,
    protected_action_route_enabled: boundary.protected_action_route_enabled,
    external_broker_recovery_allowed: boundary.external_broker_recovery_allowed,
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
    live_cancel_allowed: boundary.live_cancel_allowed,
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
    "# Trading Manual Resume Disabled Fixtures",
    "",
    `Status: ${result.summary.trading_manual_resume_disabled_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source safety boundary: ${result.summary.source_safety_boundary_status}`,
    `Fixtures: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`,
    `Unsafe manual resume signals: ${result.summary.unsafe_manual_resume_signal_count}`,
    "",
    "## Fixtures",
    "",
    ...result.manual_resume_disabled_fixture_rows.map((row) => `- ${row.row_key}: ${row.fixture_status}`),
    "",
    "## Gates",
    "",
    ...result.manual_resume_disabled_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_OUT_DIR, routeSourcePaths: [] };
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
  console.log(`Usage: node scripts/trading-manual-resume-disabled-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_OUT_DIR}
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
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  const routeSourcePaths = options.routeSourcePaths ?? options.routeSources ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.routeSourcePaths;
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.platformOpsLedgerPath),
    release_check_receipt_closeout_schema_path: path.resolve(options.releaseCheckReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.releaseCheckReceiptCloseoutSchemaPath),
    safety_regression_fixtures_schema_path: path.resolve(options.safetyRegressionFixturesSchemaPath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.safetyRegressionFixturesSchemaPath),
    route_inventory_fixtures_schema_path: path.resolve(options.routeInventoryFixturesSchemaPath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.routeInventoryFixturesSchemaPath),
    approval_absence_fixtures_schema_path: path.resolve(options.approvalAbsenceFixturesSchemaPath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.approvalAbsenceFixturesSchemaPath),
    live_adapter_disabled_fixtures_schema_path: path.resolve(options.liveAdapterDisabledFixturesSchemaPath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.liveAdapterDisabledFixturesSchemaPath),
    credential_lookup_disabled_fixtures_schema_path: path.resolve(options.credentialLookupDisabledFixturesSchemaPath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.credentialLookupDisabledFixturesSchemaPath),
    broker_write_disabled_fixtures_schema_path: path.resolve(options.brokerWriteDisabledFixturesSchemaPath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.brokerWriteDisabledFixturesSchemaPath),
    exchange_write_disabled_fixtures_schema_path: path.resolve(options.exchangeWriteDisabledFixturesSchemaPath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.exchangeWriteDisabledFixturesSchemaPath),
    safety_boundary_fixtures_schema_path: path.resolve(options.safetyBoundaryFixturesSchemaPath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.safetyBoundaryFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.executionEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.modelImprovementPath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.riskEnginePath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.marketDataFeatureStorePath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.researchBacktestPaperPath),
    route_source_paths: routeSourcePaths.map((sourcePath) => path.resolve(sourcePath)),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_MANUAL_RESUME_DISABLED_FIXTURES_INPUTS.schemaPath),
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
    validation_item_id: `trading-manual-resume-disabled-fixtures.${slugify(itemPath)}.${checkId}`,
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
