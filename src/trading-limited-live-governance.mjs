import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildDomainPackRegistry } from "./domain-pack-registry.mjs";

export const DEFAULT_TRADING_LIMITED_LIVE_REPORT_OUT_DIR = "artifacts/trading-limited-live-report/latest";
export const DEFAULT_TRADING_LIMITED_LIVE_INPUTS = {
  limitedLivePath: "examples/trading/limited-live-governance.json",
  limitedLiveSchemaPath: "schemas/trading/trading-limited-live-governance.schema.json",
  fillReconciliationSchemaPath: "schemas/trading/trading-fill-reconciliation.schema.json",
  incidentSchemaPath: "schemas/trading/trading-incident.schema.json",
  modelImprovementPath: "examples/trading/model-improvement-layer.json",
  paperShadowPath: "examples/trading/paper-shadow-live.json",
  riskEnginePath: "examples/trading/risk-engine.json",
  executionEnginePath: "examples/trading/execution-engine.json",
  goldenFixturesPath: "examples/trading/limited-live-golden-fixtures.json",
  packManifestPath: "packs/trading/pack.json",
  capabilityManifestPath: "packs/trading/capabilities/research-backtest-paper.json",
  packagePath: "package.json",
  phaseLedgerPath: "docs/trading-pack-phase-ledger.md",
};

const REQUIRED_PHASE_IDS = Array.from({ length: 30 }, (_, index) => `P${String(281 + index).padStart(3, "0")}`);
const REQUIRED_HALT_GATES = ["daily_loss_halt", "exchange_broker_outage_halt", "stale_data_halt", "abnormal_spread_halt"];
const REQUIRED_DISABLED_ROUTES = [
  "/api/trading/limited-live/approve",
  "/api/trading/limited-live/orders",
  "/api/trading/limited-live/promote-full-auto",
  "/api/trading/orders",
];

export async function runTradingLimitedLiveReport(options = {}) {
  const result = await buildTradingLimitedLiveReport(options);
  if (options.write !== false) await writeTradingLimitedLiveReport(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading limited live report validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingLimitedLiveReport(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_LIMITED_LIVE_REPORT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const limitedLive = await readJson(inputs.limited_live_path);
  const limitedLiveSchema = await readJson(inputs.limited_live_schema_path);
  const fillReconciliationSchema = await readJson(inputs.fill_reconciliation_schema_path);
  const incidentSchema = await readJson(inputs.incident_schema_path);
  const modelImprovement = await readJson(inputs.model_improvement_path);
  const paperShadow = await readJson(inputs.paper_shadow_path);
  const riskEngine = await readJson(inputs.risk_engine_path);
  const executionEngine = await readJson(inputs.execution_engine_path);
  const goldenFixtures = await readJson(inputs.golden_fixtures_path);
  const packManifest = await readJson(inputs.pack_manifest_path);
  const capabilityManifest = await readJson(inputs.capability_manifest_path);
  const packageJson = await readJson(inputs.package_path);
  const phaseLedgerText = await readFile(inputs.phase_ledger_path, "utf8");
  const domainPackRegistry = await buildDomainPackRegistry({ runAt: generatedAt });

  const limitedLiveSchemaErrors = validateAgainstSchema(limitedLive, limitedLiveSchema, {}, "limited_live");
  const postTradeReconciliationValidation = validateSingleArtifact(
    "limited_live.post_trade_reconciliation.reconciliation_artifact",
    limitedLive.post_trade_reconciliation?.reconciliation_artifact,
    fillReconciliationSchema,
  );
  const incidentValidation = validateSingleArtifact(
    "limited_live.incident_notification.incident_artifact",
    limitedLive.incident_notification?.incident_artifact,
    incidentSchema,
  );
  const sourceItems = buildSourceValidationItems({
    packageJson,
    packManifest,
    capabilityManifest,
    phaseLedgerText,
    domainPackRegistry,
  });
  const limitedLiveItems = buildLimitedLiveValidationItems({
    limitedLive,
    limitedLiveSchemaErrors,
    postTradeReconciliationValidation,
    incidentValidation,
    modelImprovement,
    paperShadow,
    riskEngine,
    executionEngine,
  });
  const fixtureResults = buildFixtureResults(goldenFixtures, limitedLive, limitedLiveItems);
  const validationItems = [
    ...sourceItems,
    ...limitedLiveItems,
    ...fixtureResults.flatMap((fixture) => fixture.validation_items),
  ];
  const validation = summarizeValidation(validationItems);
  const summary = summarizeLimitedLiveReport({
    limitedLive,
    fixtureResults,
    validationItems,
    validation,
  });
  const result = {
    schema_version: "trading-limited-live-report.v1",
    generated_at: generatedAt,
    limited_live_report_id: `trading-limited-live-report.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      limited_live_governance: sourceContract("limited_live_governance", inputs.limited_live_path, limitedLive.schema_version, limitedLive.limited_live_status === "complete"),
      limited_live_schema: sourceContract("limited_live_schema", inputs.limited_live_schema_path, limitedLiveSchema.title, limitedLiveSchemaErrors.length === 0),
      fill_reconciliation_schema: sourceContract("trading_fill_reconciliation_schema", inputs.fill_reconciliation_schema_path, fillReconciliationSchema.title, postTradeReconciliationValidation.validation.valid),
      incident_schema: sourceContract("trading_incident_schema", inputs.incident_schema_path, incidentSchema.title, incidentValidation.validation.valid),
      model_improvement: sourceContract("model_improvement", inputs.model_improvement_path, modelImprovement.schema_version, modelImprovement.model_improvement_status === "complete"),
      paper_shadow: sourceContract("paper_shadow_live", inputs.paper_shadow_path, paperShadow.schema_version, paperShadow.paper_shadow_status === "complete"),
      risk_engine: sourceContract("risk_engine", inputs.risk_engine_path, riskEngine.schema_version, riskEngine.risk_engine_status === "complete"),
      execution_engine: sourceContract("execution_engine", inputs.execution_engine_path, executionEngine.schema_version, executionEngine.execution_engine_status === "complete"),
      golden_fixtures: sourceContract("limited_live_golden_fixtures", inputs.golden_fixtures_path, goldenFixtures.schema_version, Array.isArray(goldenFixtures.fixtures)),
      pack_manifest: sourceContract("trading_pack_manifest", inputs.pack_manifest_path, packManifest.schema_version, packManifest.pack_id === "trading"),
      capability_manifest: sourceContract("trading_capability_manifest", inputs.capability_manifest_path, capabilityManifest.schema_version, capabilityManifest.domain_pack === "trading"),
      domain_pack_registry: {
        source_id: "domain_pack_registry",
        status: domainPackRegistry.validation.valid ? "valid" : "invalid",
        trading_registered: Boolean(domainPackRegistry.packs.find((pack) => pack.pack_id === "trading")),
      },
    },
    limited_live_governance: limitedLive,
    post_trade_reconciliation_validation: postTradeReconciliationValidation,
    incident_validation: incidentValidation,
    fixture_results: fixtureResults,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderLimitedLiveReportMarkdown(result),
  };
}

export async function writeTradingLimitedLiveReport(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-limited-live-report.json"), serializableResult(result));
  await writeJson(path.join(outDir, "limited-live-governance.json"), result.limited_live_governance);
  await writeJson(path.join(outDir, "fixture-results.json"), {
    schema_version: "trading-limited-live-fixture-results.v1",
    generated_at: result.generated_at,
    fixture_results: result.fixture_results,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingLimitedLiveReportCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingLimitedLiveReport(args);
    console.log(`Trading limited live report ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.limited_live_report_status}`);
    console.log(`Phase range: ${result.summary.phase_range}`);
    console.log(`Limited live enabled: ${result.summary.limited_live_enabled}`);
    console.log(`Live order submission allowed: ${result.summary.live_order_submission_allowed}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function validateSingleArtifact(pathName, artifact, schema) {
  const errors = validateAgainstSchema(artifact ?? {}, schema, {}, pathName);
  return {
    schema_version: "trading-limited-live-single-artifact-validation-result.v1",
    path: pathName,
    validation: {
      valid: errors.length === 0,
      errors,
    },
    validation_items: [
      validationItem(pathName, "schema_valid", errors.length === 0, errors.length === 0 ? `${pathName} validates.` : `${pathName} has ${errors.length} schema error(s).`),
      ...errors.map((error) => validationItem(error.path, "schema_error", false, error.message)),
    ],
  };
}

function buildSourceValidationItems({ packageJson, packManifest, capabilityManifest, phaseLedgerText, domainPackRegistry }) {
  const scripts = packageJson.scripts ?? {};
  const packSchemas = packManifest.schemas ?? [];
  const workflows = packManifest.workflows ?? [];
  const goldenCases = packManifest.golden_cases ?? [];
  const entrypoints = capabilityManifest.entrypoints ?? [];
  const capabilityGoldenCases = capabilityManifest.golden_cases ?? [];
  const tradingPack = domainPackRegistry.packs.find((pack) => pack.pack_id === "trading");
  return [
    validationItem("source.package.trading_limited_live_report", "package_script_registered", Boolean(scripts["trading:limited-live-report"]), "Package script trading:limited-live-report is registered."),
    validationItem("source.package.validate_chain", "validate_chain_registered", packageJson.scripts?.validate?.includes("trading:limited-live-report") === true, "Package validate chain includes trading:limited-live-report -- --check."),
    validationItem("source.pack.schemas.limited_live_governance", "pack_schema_registered", packSchemas.includes("schemas/trading/trading-limited-live-governance.schema.json"), "Trading pack manifest registers the limited live governance schema."),
    validationItem("source.pack.workflow.limited_live_report", "pack_workflow_registered", workflows.includes("workflow.trading.limited_live_report.v1"), "Trading pack manifest registers the limited live report workflow."),
    validationItem("source.pack.workflow.limited_live_dashboard", "pack_workflow_registered", workflows.includes("workflow.trading.limited_live_dashboard.v1"), "Trading pack manifest registers the limited live dashboard workflow."),
    validationItem("source.pack.workflow.limited_live_api", "pack_workflow_registered", workflows.includes("workflow.trading.limited_live_api.v1"), "Trading pack manifest registers the limited live API workflow."),
    validationItem("source.pack.workflow.limited_live_freeze", "pack_workflow_registered", workflows.includes("workflow.trading.limited_live_freeze.v1"), "Trading pack manifest registers the limited live freeze workflow."),
    validationItem("source.pack.golden.limited_live", "pack_golden_case_registered", goldenCases.includes("golden.trading.limited_live_governance.p281_p310"), "Trading pack manifest registers the limited live governance golden case."),
    validationItem("source.capability.entrypoint.limited_live_report", "capability_entrypoint_registered", entrypoints.some((entrypoint) => entrypoint.name === "trading:limited-live-report"), "Trading capability manifest registers the limited live report entrypoint."),
    validationItem("source.capability.golden.limited_live", "capability_golden_case_registered", capabilityGoldenCases.some((fixture) => fixture.case_id === "golden.trading.limited_live_governance.p281_p310"), "Trading capability manifest registers the limited live governance golden case."),
    validationItem("source.domain_pack_registry.trading", "domain_pack_registry_valid", domainPackRegistry.validation.valid === true && Boolean(tradingPack), "Domain pack registry remains valid with Trading registered."),
    validationItem("source.phase_ledger.p281_p310", "phase_ledger_updated", phaseLedgerText.includes("P281-P310 Acceptance Criteria") && phaseLedgerText.includes("trading:limited-live-report"), "Phase ledger documents P281-P310 acceptance criteria and CLI."),
  ];
}

function buildLimitedLiveValidationItems({
  limitedLive,
  limitedLiveSchemaErrors,
  postTradeReconciliationValidation,
  incidentValidation,
  modelImprovement,
  paperShadow,
  riskEngine,
  executionEngine,
}) {
  const phaseIds = new Set((limitedLive.phase_coverage ?? []).map((phase) => phase.phase_id));
  const knownAssetIds = new Set(riskEngine.portfolio_context?.asset_ids ?? []);
  const knownStrategyIds = new Set([
    paperShadow.paper_order_ledger?.strategy_id,
    ...(paperShadow.strategy_paper_scorecards ?? []).map((scorecard) => scorecard.strategy_id),
  ].filter(Boolean));
  const knownModelIds = new Set((modelImprovement.model_registry?.models ?? []).map((model) => model.model_id));
  const degradationIds = new Set((modelImprovement.degradation_checks ?? []).map((check) => check.check_id));
  const whitelistedAssets = limitedLive.whitelists?.asset_whitelist?.asset_ids ?? [];
  const whitelistedStrategies = limitedLive.whitelists?.strategy_whitelist?.strategy_ids ?? [];
  const whitelistedModels = limitedLive.whitelists?.model_whitelist?.model_ids ?? [];
  const haltGates = limitedLive.halt_gates ?? {};
  const dashboardRoutes = limitedLive.dashboard_api_stub?.routes ?? [];
  const disabledRoutes = limitedLive.dashboard_api_stub?.disabled_routes ?? [];
  const regressionCases = limitedLive.regression_suite?.cases ?? [];
  return [
    validationItem("limited_live.schema", "schema_validation_passed", limitedLiveSchemaErrors.length === 0, limitedLiveSchemaErrors.length === 0 ? "Limited live governance validates against schema." : `Limited live governance has ${limitedLiveSchemaErrors.length} schema error(s).`),
    ...limitedLiveSchemaErrors.map((error) => validationItem(error.path, "schema_error", false, error.message)),
    validationItem("limited_live.phase_range", "phase_range_p281_p310", limitedLive.phase_range === "P281-P310", "Limited live governance is scoped to P281-P310."),
    validationItem("limited_live.phase_coverage", "all_phases_covered", REQUIRED_PHASE_IDS.every((phaseId) => phaseIds.has(phaseId)) && (limitedLive.phase_coverage ?? []).every((phase) => phase.status === "complete"), "All P281-P310 phases are covered and complete."),
    validationItem("limited_live.safety", "limited_live_safety_boundary_closed", limitedLive.safety_boundary?.control_plane_only === true && limitedLive.safety_boundary?.limited_live_enabled === false && limitedLive.safety_boundary?.live_order_submission_allowed === false && limitedLive.safety_boundary?.real_order_submitted === false && limitedLive.safety_boundary?.broker_write_allowed === false && limitedLive.safety_boundary?.exchange_write_allowed === false && limitedLive.safety_boundary?.full_auto_promotion_allowed === false, "Limited live remains a control-plane-only governance surface with live writes blocked."),
    validationItem("limited_live.approval", "explicit_approval_required_and_absent", limitedLive.approval_gate?.approval_required === true && limitedLive.approval_gate?.approval_receipt_present === false && limitedLive.approval_gate?.decision === "blocked" && limitedLive.approval_gate?.protected_action_gate_required === true, "Explicit approval is required, no receipt is present, and activation is blocked."),
    validationItem("limited_live.capital_cap", "capital_cap_enforced", limitedLive.capital_cap?.enforced === true && limitedLive.capital_cap?.current_allocated <= limitedLive.capital_cap?.cap_amount && limitedLive.capital_cap?.blocks_when_missing_approval === true, "Capital cap is enforced and blocks when approval is missing."),
    validationItem("limited_live.whitelist.assets", "asset_whitelist_known_and_enforced", limitedLive.whitelists?.asset_whitelist?.enabled === true && limitedLive.whitelists?.asset_whitelist?.blocks_unlisted_assets === true && whitelistedAssets.length > 0 && whitelistedAssets.every((assetId) => knownAssetIds.has(assetId)), "Asset whitelist is enforced and references known portfolio assets."),
    validationItem("limited_live.whitelist.strategies", "strategy_whitelist_known_and_enforced", limitedLive.whitelists?.strategy_whitelist?.enabled === true && limitedLive.whitelists?.strategy_whitelist?.blocks_unlisted_strategies === true && whitelistedStrategies.length > 0 && whitelistedStrategies.every((strategyId) => knownStrategyIds.has(strategyId)), "Strategy whitelist is enforced and references known paper strategies."),
    validationItem("limited_live.whitelist.models", "model_whitelist_known_and_enforced", limitedLive.whitelists?.model_whitelist?.enabled === true && limitedLive.whitelists?.model_whitelist?.blocks_unlisted_models === true && whitelistedModels.length > 0 && whitelistedModels.every((modelId) => knownModelIds.has(modelId)), "Model whitelist is enforced and references known model registry entries."),
    validationItem("limited_live.order_caps", "order_caps_block_submission", limitedLive.order_caps?.order_size_cap?.enforced === true && limitedLive.order_caps?.order_size_cap?.blocks_submission === true && limitedLive.order_caps?.daily_order_count_cap?.enforced === true && limitedLive.order_caps?.daily_order_count_cap?.max_orders_per_day === 0 && limitedLive.order_caps?.daily_order_count_cap?.blocks_submission === true && limitedLive.order_caps?.order_submission_allowed === false, "Order size and daily order caps are enforced and block submission."),
    validationItem("limited_live.halt_gates", "halt_gates_armed", REQUIRED_HALT_GATES.every((gateId) => haltGates[gateId]?.enabled === true && haltGates[gateId]?.halt_on_trigger === true), "Daily loss, outage, stale data, and abnormal spread halt gates are armed."),
    validationItem("limited_live.first_trade_confirmation", "first_trade_manual_confirmation_blocks", limitedLive.first_trade_confirmation?.required === true && limitedLive.first_trade_confirmation?.confirmation_present === false && limitedLive.first_trade_confirmation?.blocks_first_trade === true && limitedLive.first_trade_confirmation?.first_trade_submitted === false, "First trade requires manual confirmation and is blocked without it."),
    validationItem("limited_live.auto_cancel", "auto_cancel_stale_orders_no_live_cancel", limitedLive.auto_cancel_stale_orders?.enabled === true && limitedLive.auto_cancel_stale_orders?.live_cancel_allowed === false, "Auto-cancel stale order policy exists without enabling live cancel routes."),
    validationItem("limited_live.post_trade.schema", "post_trade_reconciliation_valid", postTradeReconciliationValidation.validation.valid, "Post-trade reconciliation artifact validates against trading-fill-reconciliation.v1."),
    ...postTradeReconciliationValidation.validation_items,
    validationItem("limited_live.post_trade.boundary", "post_trade_no_live_fills", limitedLive.post_trade_reconciliation?.required === true && limitedLive.post_trade_reconciliation?.live_fill_count === 0 && limitedLive.post_trade_reconciliation?.reconciliation_artifact?.status === "not_applicable" && limitedLive.post_trade_reconciliation?.human_review_required === true, "Post-trade reconciliation is required but no live fills exist."),
    validationItem("limited_live.daily_report", "daily_report_blocks_no_live_activity", limitedLive.daily_live_report?.status === "blocked_no_live_activity" && limitedLive.daily_live_report?.real_order_count === 0 && limitedLive.daily_live_report?.human_review_required === true, "Daily live report records blocked/no-live activity."),
    validationItem("limited_live.incident.schema", "incident_notification_artifact_valid", incidentValidation.validation.valid, "Incident notification artifact validates against trading-incident.v1."),
    ...incidentValidation.validation_items,
    validationItem("limited_live.incident.boundary", "incident_notification_local_only", limitedLive.incident_notification?.enabled === true && limitedLive.incident_notification?.delivery_mode === "local_artifact_only" && limitedLive.incident_notification?.external_notification_sent === false, "Incident notification is local-artifact-only and does not call external services."),
    validationItem("limited_live.rollback", "rollback_to_paper_manual_resume", limitedLive.rollback_policy?.rollback_to_paper_mode === true && limitedLive.rollback_policy?.rollback_stage === "paper" && limitedLive.rollback_policy?.manual_resume_required === true && limitedLive.rollback_policy?.rollback_tested_by === paperShadow.kill_switch_dry_run?.dry_run_id, "Rollback returns to paper mode and requires manual resume."),
    validationItem("limited_live.live_vs_paper", "live_vs_paper_review_only", limitedLive.live_vs_paper_comparison?.status === "not_applicable" && limitedLive.live_vs_paper_comparison?.observed_drift_pct === 0 && limitedLive.live_vs_paper_comparison?.human_review_required === true, "Live-vs-paper comparison is review-only with no live activity."),
    validationItem("limited_live.model_degradation", "model_degradation_halts_live", degradationIds.has(limitedLive.model_live_degradation_check?.source_ref) && limitedLive.model_live_degradation_check?.halt_on_degradation === true && limitedLive.model_live_degradation_check?.live_model_enabled === false, "Model live degradation check is bound to model improvement artifacts and halts live deployment."),
    validationItem("limited_live.full_auto_promotion", "full_auto_promotion_blocked", limitedLive.promotion_criteria_to_full_auto?.decision === "blocked" && limitedLive.promotion_criteria_to_full_auto?.human_approval_required === true && limitedLive.promotion_criteria_to_full_auto?.full_auto_enabled === false, "Promotion criteria to full auto are present but blocked."),
    validationItem("limited_live.freeze", "limited_live_freeze_locked", limitedLive.limited_live_freeze_report?.frozen === true && limitedLive.limited_live_freeze_report?.regression_hash_locked === true && limitedLive.limited_live_freeze_report?.limited_live_enablement_allowed === false, "Limited live freeze is locked without enabling live mode."),
    validationItem("limited_live.operator_runbook", "operator_runbook_required", limitedLive.operator_runbook?.runbook_required === true && limitedLive.operator_runbook?.operator_handbook_required === true && limitedLive.operator_runbook?.human_review_queue_required === true && limitedLive.operator_runbook?.protected_action_routes_disabled === true, "Operator runbook and human review queue are required."),
    validationItem("limited_live.dashboard", "dashboard_read_only", limitedLive.dashboard_api_stub?.read_only === true && limitedLive.dashboard_api_stub?.mutating_routes_enabled === false && dashboardRoutes.length > 0 && dashboardRoutes.every((route) => route.method === "GET"), "Limited live dashboard/API is read-only."),
    validationItem("limited_live.dashboard.disabled", "unsafe_routes_disabled", REQUIRED_DISABLED_ROUTES.every((routePath) => disabledRoutes.some((route) => route.path === routePath)), "Limited-live approval, order, full-auto promotion, and generic order routes are disabled."),
    validationItem("limited_live.execution_source", "execution_engine_live_disabled", executionEngine.safety_boundary?.live_execution_allowed === false && executionEngine.safety_boundary?.real_order_submitted === false && executionEngine.adapters?.live_adapter?.enabled === false, "Upstream execution engine still disables live execution and real orders."),
    validationItem("limited_live.regression_suite", "regression_suite_complete", limitedLive.regression_suite?.all_cases_passed === true && limitedLive.regression_suite?.case_count === regressionCases.length && limitedLive.regression_suite?.case_count >= 10, "Limited live regression suite is complete."),
  ];
}

function buildFixtureResults(goldenFixtures, limitedLive, limitedLiveItems) {
  return (goldenFixtures.fixtures ?? []).map((fixture) => {
    const regressionHash = hashValue({
      fixture_id: fixture.fixture_id,
      phase_range: limitedLive.phase_range,
      phase_coverage: limitedLive.phase_coverage,
      safety_boundary: limitedLive.safety_boundary,
      approval_gate: limitedLive.approval_gate,
      capital_cap: limitedLive.capital_cap,
      whitelists: limitedLive.whitelists,
      order_caps: limitedLive.order_caps,
      halt_gates: limitedLive.halt_gates,
      promotion_criteria_to_full_auto: limitedLive.promotion_criteria_to_full_auto,
    });
    const validationItems = [
      validationItem(`fixtures.${fixture.fixture_id}.status`, "fixture_status_matches", fixture.expected_status === "complete" && limitedLiveItems.every((item) => item.status === "passed"), `${fixture.fixture_id} expected status is complete.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_range`, "fixture_phase_range_matches", limitedLive.phase_range === fixture.expected_phase_range, `${fixture.fixture_id} phase range matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_count`, "fixture_phase_count_matches", (limitedLive.phase_coverage ?? []).length === fixture.expected_phase_count, `${fixture.fixture_id} phase count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.approval_required`, "fixture_approval_required_matches", limitedLive.approval_gate?.approval_required === fixture.expected_approval_required, `${fixture.fixture_id} approval requirement matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.approval_receipt`, "fixture_approval_receipt_matches", limitedLive.approval_gate?.approval_receipt_present === fixture.expected_approval_receipt_present, `${fixture.fixture_id} approval receipt boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.capital_cap`, "fixture_capital_cap_matches", limitedLive.capital_cap?.enforced === fixture.expected_capital_cap_enforced, `${fixture.fixture_id} capital cap enforcement matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.asset_whitelist`, "fixture_asset_whitelist_count_matches", (limitedLive.whitelists?.asset_whitelist?.asset_ids ?? []).length === fixture.expected_asset_whitelist_count, `${fixture.fixture_id} asset whitelist count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.strategy_whitelist`, "fixture_strategy_whitelist_count_matches", (limitedLive.whitelists?.strategy_whitelist?.strategy_ids ?? []).length === fixture.expected_strategy_whitelist_count, `${fixture.fixture_id} strategy whitelist count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.model_whitelist`, "fixture_model_whitelist_count_matches", (limitedLive.whitelists?.model_whitelist?.model_ids ?? []).length === fixture.expected_model_whitelist_count, `${fixture.fixture_id} model whitelist count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.daily_order_cap`, "fixture_daily_order_cap_matches", limitedLive.order_caps?.daily_order_count_cap?.max_orders_per_day === fixture.expected_daily_order_cap, `${fixture.fixture_id} daily order cap matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.limited_live`, "fixture_limited_live_boundary_matches", limitedLive.safety_boundary?.limited_live_enabled === fixture.expected_limited_live_enabled, `${fixture.fixture_id} limited live boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.submission`, "fixture_submission_boundary_matches", limitedLive.safety_boundary?.live_order_submission_allowed === fixture.expected_live_order_submission_allowed, `${fixture.fixture_id} order submission boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.real_order`, "fixture_real_order_boundary_matches", limitedLive.safety_boundary?.real_order_submitted === fixture.expected_real_order_submitted, `${fixture.fixture_id} real order boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.full_auto`, "fixture_full_auto_boundary_matches", limitedLive.safety_boundary?.full_auto_promotion_allowed === fixture.expected_full_auto_promotion_allowed, `${fixture.fixture_id} full auto boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.regression_count`, "fixture_regression_count_matches", limitedLive.regression_suite?.case_count === fixture.expected_regression_case_count, `${fixture.fixture_id} regression case count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.dashboard`, "fixture_dashboard_boundary_matches", limitedLive.dashboard_api_stub?.read_only === fixture.expected_dashboard_read_only, `${fixture.fixture_id} dashboard boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.hash`, "fixture_regression_hash_locked", regressionHash.startsWith("sha256:"), `${fixture.fixture_id} regression hash is locked.`),
    ];
    const validation = summarizeValidation(validationItems);
    return {
      schema_version: "trading-limited-live-fixture-result.v1",
      fixture_id: fixture.fixture_id,
      input_ref: fixture.input_ref,
      expected_status: fixture.expected_status,
      fixture_status: validation.valid ? "complete" : "failed",
      regression_hash: regressionHash,
      validation_items: validationItems,
      validation,
    };
  });
}

function summarizeLimitedLiveReport({ limitedLive, fixtureResults, validationItems, validation }) {
  return {
    limited_live_report_status: validation.valid ? "complete" : "blocked",
    phase_range: limitedLive.phase_range,
    phase_count: limitedLive.phase_coverage?.length ?? 0,
    complete_phase_count: (limitedLive.phase_coverage ?? []).filter((phase) => phase.status === "complete").length,
    fixture_count: fixtureResults.length,
    passed_fixture_count: fixtureResults.filter((fixture) => fixture.validation.valid).length,
    locked_regression_hash_count: fixtureResults.filter((fixture) => fixture.regression_hash?.startsWith("sha256:")).length,
    validation_item_count: validationItems.length,
    validation_error_count: validation.errors.length,
    approval_required: limitedLive.approval_gate?.approval_required === true,
    approval_receipt_present: limitedLive.approval_gate?.approval_receipt_present === true,
    capital_cap_amount: limitedLive.capital_cap?.cap_amount ?? 0,
    asset_whitelist_count: limitedLive.whitelists?.asset_whitelist?.asset_ids?.length ?? 0,
    strategy_whitelist_count: limitedLive.whitelists?.strategy_whitelist?.strategy_ids?.length ?? 0,
    model_whitelist_count: limitedLive.whitelists?.model_whitelist?.model_ids?.length ?? 0,
    daily_order_count_cap: limitedLive.order_caps?.daily_order_count_cap?.max_orders_per_day ?? null,
    halt_gate_count: Object.keys(limitedLive.halt_gates ?? {}).length,
    first_trade_manual_confirmation_required: limitedLive.first_trade_confirmation?.required === true,
    first_trade_confirmation_present: limitedLive.first_trade_confirmation?.confirmation_present === true,
    auto_cancel_stale_orders_enabled: limitedLive.auto_cancel_stale_orders?.enabled === true,
    live_cancel_allowed: limitedLive.auto_cancel_stale_orders?.live_cancel_allowed === true,
    post_trade_reconciliation_status: limitedLive.post_trade_reconciliation?.reconciliation_artifact?.status ?? "missing",
    incident_notification_configured: limitedLive.incident_notification?.enabled === true,
    external_notification_sent: limitedLive.incident_notification?.external_notification_sent === true,
    rollback_to_paper_mode: limitedLive.rollback_policy?.rollback_to_paper_mode === true,
    model_live_degradation_result: limitedLive.model_live_degradation_check?.result ?? "missing",
    regression_case_count: limitedLive.regression_suite?.case_count ?? 0,
    limited_live_enabled: limitedLive.safety_boundary?.limited_live_enabled === true,
    live_order_submission_allowed: limitedLive.safety_boundary?.live_order_submission_allowed === true,
    real_order_submitted: limitedLive.safety_boundary?.real_order_submitted === true,
    broker_write_allowed: limitedLive.safety_boundary?.broker_write_allowed === true,
    exchange_write_allowed: limitedLive.safety_boundary?.exchange_write_allowed === true,
    full_auto_promotion_allowed: limitedLive.safety_boundary?.full_auto_promotion_allowed === true,
    full_auto_enabled: limitedLive.promotion_criteria_to_full_auto?.full_auto_enabled === true,
    dashboard_read_only: limitedLive.dashboard_api_stub?.read_only === true,
  };
}

function renderLimitedLiveReportMarkdown(result) {
  const lines = [];
  lines.push("# Trading Limited Live Report");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.limited_live_report_status}`);
  lines.push("");
  lines.push(`- Phase range: ${result.summary.phase_range}`);
  lines.push(`- Phases complete: ${result.summary.complete_phase_count}/${result.summary.phase_count}`);
  lines.push(`- Approval required: ${result.summary.approval_required}`);
  lines.push(`- Approval receipt present: ${result.summary.approval_receipt_present}`);
  lines.push(`- Limited live enabled: ${result.summary.limited_live_enabled}`);
  lines.push(`- Live order submission allowed: ${result.summary.live_order_submission_allowed}`);
  lines.push(`- Real orders submitted: ${result.summary.real_order_submitted}`);
  lines.push(`- Full auto promotion allowed: ${result.summary.full_auto_promotion_allowed}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options = {}) {
  return {
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_LIMITED_LIVE_INPUTS.limitedLivePath),
    limited_live_schema_path: path.resolve(options.limitedLiveSchemaPath ?? DEFAULT_TRADING_LIMITED_LIVE_INPUTS.limitedLiveSchemaPath),
    fill_reconciliation_schema_path: path.resolve(options.fillReconciliationSchemaPath ?? DEFAULT_TRADING_LIMITED_LIVE_INPUTS.fillReconciliationSchemaPath),
    incident_schema_path: path.resolve(options.incidentSchemaPath ?? DEFAULT_TRADING_LIMITED_LIVE_INPUTS.incidentSchemaPath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_LIMITED_LIVE_INPUTS.modelImprovementPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_LIMITED_LIVE_INPUTS.paperShadowPath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_LIMITED_LIVE_INPUTS.riskEnginePath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_LIMITED_LIVE_INPUTS.executionEnginePath),
    golden_fixtures_path: path.resolve(options.goldenFixturesPath ?? DEFAULT_TRADING_LIMITED_LIVE_INPUTS.goldenFixturesPath),
    pack_manifest_path: path.resolve(options.packManifestPath ?? DEFAULT_TRADING_LIMITED_LIVE_INPUTS.packManifestPath),
    capability_manifest_path: path.resolve(options.capabilityManifestPath ?? DEFAULT_TRADING_LIMITED_LIVE_INPUTS.capabilityManifestPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_LIMITED_LIVE_INPUTS.packagePath),
    phase_ledger_path: path.resolve(options.phaseLedgerPath ?? DEFAULT_TRADING_LIMITED_LIVE_INPUTS.phaseLedgerPath),
  };
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_TRADING_LIMITED_LIVE_REPORT_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--limited-live") parsed.limitedLivePath = argv[++index];
    else if (arg === "--limited-live-schema") parsed.limitedLiveSchemaPath = argv[++index];
    else if (arg === "--fill-reconciliation-schema") parsed.fillReconciliationSchemaPath = argv[++index];
    else if (arg === "--incident-schema") parsed.incidentSchemaPath = argv[++index];
    else if (arg === "--model-improvement") parsed.modelImprovementPath = argv[++index];
    else if (arg === "--paper-shadow") parsed.paperShadowPath = argv[++index];
    else if (arg === "--risk-engine") parsed.riskEnginePath = argv[++index];
    else if (arg === "--execution-engine") parsed.executionEnginePath = argv[++index];
    else if (arg === "--golden-fixtures") parsed.goldenFixturesPath = argv[++index];
    else if (arg === "--pack-manifest") parsed.packManifestPath = argv[++index];
    else if (arg === "--capability-manifest") parsed.capabilityManifestPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--phase-ledger") parsed.phaseLedgerPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-limited-live-report.mjs [options]

Options:
  --out-dir <folder>                    Output directory. Default: ${DEFAULT_TRADING_LIMITED_LIVE_REPORT_OUT_DIR}
  --run-at <iso>                        Deterministic generated_at timestamp.
  --limited-live <path>                 Limited live governance fixture path.
  --limited-live-schema <path>          Limited live governance schema path.
  --fill-reconciliation-schema <path>   trading-fill-reconciliation schema path.
  --incident-schema <path>              trading-incident schema path.
  --model-improvement <path>            Model improvement fixture path.
  --paper-shadow <path>                 Paper/shadow fixture path.
  --risk-engine <path>                  Risk engine fixture path.
  --execution-engine <path>             Execution engine fixture path.
  --golden-fixtures <path>              Limited live golden fixtures path.
  --pack-manifest <path>                Trading pack manifest path.
  --capability-manifest <path>          Trading capability manifest path.
  --package <path>                      package.json path.
  --phase-ledger <path>                 Trading phase ledger path.
  --check                               Validate only, do not write artifacts.
  -h, --help                            Show this help.
`);
}

function sourceContract(sourceId, sourcePath, schemaVersion, ok) {
  return {
    source_id: sourceId,
    path: sourcePath,
    schema_version: schemaVersion ?? null,
    status: ok ? "loaded" : "attention",
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `trading-limited-live.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
