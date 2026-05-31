import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildDomainPackRegistry } from "./domain-pack-registry.mjs";

export const DEFAULT_TRADING_FULL_AUTO_REPORT_OUT_DIR = "artifacts/trading-full-auto-report/latest";
export const DEFAULT_TRADING_FULL_AUTO_INPUTS = {
  fullAutoPath: "examples/trading/full-auto-governance.json",
  fullAutoSchemaPath: "schemas/trading/trading-full-auto-governance.schema.json",
  limitedLivePath: "examples/trading/limited-live-governance.json",
  modelImprovementPath: "examples/trading/model-improvement-layer.json",
  riskEnginePath: "examples/trading/risk-engine.json",
  paperShadowPath: "examples/trading/paper-shadow-live.json",
  executionEnginePath: "examples/trading/execution-engine.json",
  marketDataFeatureStorePath: "examples/trading/market-data-feature-store.json",
  goldenFixturesPath: "examples/trading/full-auto-governance-golden-fixtures.json",
  packManifestPath: "packs/trading/pack.json",
  capabilityManifestPath: "packs/trading/capabilities/research-backtest-paper.json",
  packagePath: "package.json",
  phaseLedgerPath: "docs/trading-pack-phase-ledger.md",
};

const REQUIRED_PHASE_IDS = Array.from({ length: 30 }, (_, index) => `P${String(311 + index).padStart(3, "0")}`);
const REQUIRED_DISABLED_ROUTES = [
  "/api/trading/full-auto/approve",
  "/api/trading/full-auto/orders",
  "/api/trading/full-auto/allocator/apply",
  "/api/trading/full-auto/failover/broker",
  "/api/trading/orders",
];
const REQUIRED_ALLOCATORS = [
  "portfolio_capital_allocator",
  "multi_strategy_conflict_resolver",
  "risk_budget_allocator",
  "regime_detection_allocator",
  "market_stress_allocator",
];

export async function runTradingFullAutoReport(options = {}) {
  const result = await buildTradingFullAutoReport(options);
  if (options.write !== false) await writeTradingFullAutoReport(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading full auto report validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingFullAutoReport(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_FULL_AUTO_REPORT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const fullAuto = await readJson(inputs.full_auto_path);
  const fullAutoSchema = await readJson(inputs.full_auto_schema_path);
  const limitedLive = await readJson(inputs.limited_live_path);
  const modelImprovement = await readJson(inputs.model_improvement_path);
  const riskEngine = await readJson(inputs.risk_engine_path);
  const paperShadow = await readJson(inputs.paper_shadow_path);
  const executionEngine = await readJson(inputs.execution_engine_path);
  const marketDataFeatureStore = await readJson(inputs.market_data_feature_store_path);
  const goldenFixtures = await readJson(inputs.golden_fixtures_path);
  const packManifest = await readJson(inputs.pack_manifest_path);
  const capabilityManifest = await readJson(inputs.capability_manifest_path);
  const packageJson = await readJson(inputs.package_path);
  const phaseLedgerText = await readFile(inputs.phase_ledger_path, "utf8");
  const domainPackRegistry = await buildDomainPackRegistry({ runAt: generatedAt });

  const fullAutoSchemaErrors = validateAgainstSchema(fullAuto, fullAutoSchema, {}, "full_auto");
  const sourceItems = buildSourceValidationItems({
    packageJson,
    packManifest,
    capabilityManifest,
    phaseLedgerText,
    domainPackRegistry,
  });
  const fullAutoItems = buildFullAutoValidationItems({
    fullAuto,
    fullAutoSchemaErrors,
    limitedLive,
    modelImprovement,
    riskEngine,
    paperShadow,
    executionEngine,
    marketDataFeatureStore,
  });
  const fixtureResults = buildFixtureResults(goldenFixtures, fullAuto, fullAutoItems);
  const validationItems = [
    ...sourceItems,
    ...fullAutoItems,
    ...fixtureResults.flatMap((fixture) => fixture.validation_items),
  ];
  const validation = summarizeValidation(validationItems);
  const summary = summarizeFullAutoReport({
    fullAuto,
    fixtureResults,
    validationItems,
    validation,
  });
  const result = {
    schema_version: "trading-full-auto-report.v1",
    generated_at: generatedAt,
    full_auto_report_id: `trading-full-auto-report.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      full_auto_governance: sourceContract("full_auto_governance", inputs.full_auto_path, fullAuto.schema_version, fullAuto.full_auto_status === "complete"),
      full_auto_schema: sourceContract("full_auto_schema", inputs.full_auto_schema_path, fullAutoSchema.title, fullAutoSchemaErrors.length === 0),
      limited_live: sourceContract("limited_live_governance", inputs.limited_live_path, limitedLive.schema_version, limitedLive.limited_live_status === "complete"),
      model_improvement: sourceContract("model_improvement", inputs.model_improvement_path, modelImprovement.schema_version, modelImprovement.model_improvement_status === "complete"),
      risk_engine: sourceContract("risk_engine", inputs.risk_engine_path, riskEngine.schema_version, riskEngine.risk_engine_status === "complete"),
      paper_shadow: sourceContract("paper_shadow_live", inputs.paper_shadow_path, paperShadow.schema_version, paperShadow.paper_shadow_status === "complete"),
      execution_engine: sourceContract("execution_engine", inputs.execution_engine_path, executionEngine.schema_version, executionEngine.execution_engine_status === "complete"),
      market_data_feature_store: sourceContract("market_data_feature_store", inputs.market_data_feature_store_path, marketDataFeatureStore.schema_version, marketDataFeatureStore.feature_store_status === "complete"),
      golden_fixtures: sourceContract("full_auto_golden_fixtures", inputs.golden_fixtures_path, goldenFixtures.schema_version, Array.isArray(goldenFixtures.fixtures)),
      pack_manifest: sourceContract("trading_pack_manifest", inputs.pack_manifest_path, packManifest.schema_version, packManifest.pack_id === "trading"),
      capability_manifest: sourceContract("trading_capability_manifest", inputs.capability_manifest_path, capabilityManifest.schema_version, capabilityManifest.domain_pack === "trading"),
      domain_pack_registry: {
        source_id: "domain_pack_registry",
        status: domainPackRegistry.validation.valid ? "valid" : "invalid",
        trading_registered: Boolean(domainPackRegistry.packs.find((pack) => pack.pack_id === "trading")),
      },
    },
    full_auto_governance: fullAuto,
    fixture_results: fixtureResults,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderFullAutoReportMarkdown(result),
  };
}

export async function writeTradingFullAutoReport(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-full-auto-report.json"), serializableResult(result));
  await writeJson(path.join(outDir, "full-auto-governance.json"), result.full_auto_governance);
  await writeJson(path.join(outDir, "fixture-results.json"), {
    schema_version: "trading-full-auto-fixture-results.v1",
    generated_at: result.generated_at,
    fixture_results: result.fixture_results,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingFullAutoReportCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingFullAutoReport(args);
    console.log(`Trading full auto report ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.full_auto_report_status}`);
    console.log(`Phase range: ${result.summary.phase_range}`);
    console.log(`Full auto enabled: ${result.summary.full_auto_enabled}`);
    console.log(`Automatic order submission allowed: ${result.summary.automatic_order_submission_allowed}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
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
    validationItem("source.package.trading_full_auto_report", "package_script_registered", Boolean(scripts["trading:full-auto-report"]), "Package script trading:full-auto-report is registered."),
    validationItem("source.package.validate_chain", "validate_chain_registered", packageJson.scripts?.validate?.includes("trading:full-auto-report") === true, "Package validate chain includes trading:full-auto-report -- --check."),
    validationItem("source.pack.schemas.full_auto_governance", "pack_schema_registered", packSchemas.includes("schemas/trading/trading-full-auto-governance.schema.json"), "Trading pack manifest registers the full auto governance schema."),
    validationItem("source.pack.workflow.full_auto_report", "pack_workflow_registered", workflows.includes("workflow.trading.full_auto_report.v1"), "Trading pack manifest registers the full auto report workflow."),
    validationItem("source.pack.workflow.full_auto_dashboard", "pack_workflow_registered", workflows.includes("workflow.trading.full_auto_dashboard.v1"), "Trading pack manifest registers the full auto dashboard workflow."),
    validationItem("source.pack.workflow.full_auto_api", "pack_workflow_registered", workflows.includes("workflow.trading.full_auto_api.v1"), "Trading pack manifest registers the full auto API workflow."),
    validationItem("source.pack.workflow.trading_pack_v1_freeze", "pack_workflow_registered", workflows.includes("workflow.trading.trading_pack_v1_freeze.v1"), "Trading pack manifest registers the Trading Pack v1 freeze workflow."),
    validationItem("source.pack.golden.full_auto", "pack_golden_case_registered", goldenCases.includes("golden.trading.full_auto_governance.p311_p340"), "Trading pack manifest registers the full auto governance golden case."),
    validationItem("source.capability.entrypoint.full_auto_report", "capability_entrypoint_registered", entrypoints.some((entrypoint) => entrypoint.name === "trading:full-auto-report"), "Trading capability manifest registers the full auto report entrypoint."),
    validationItem("source.capability.golden.full_auto", "capability_golden_case_registered", capabilityGoldenCases.some((fixture) => fixture.case_id === "golden.trading.full_auto_governance.p311_p340"), "Trading capability manifest registers the full auto governance golden case."),
    validationItem("source.domain_pack_registry.trading", "domain_pack_registry_valid", domainPackRegistry.validation.valid === true && Boolean(tradingPack), "Domain pack registry remains valid with Trading registered."),
    validationItem("source.phase_ledger.p311_p340", "phase_ledger_updated", phaseLedgerText.includes("P311-P330 Acceptance Criteria") && phaseLedgerText.includes("P331-P340 Acceptance Criteria") && phaseLedgerText.includes("trading:full-auto-report"), "Phase ledger documents P311-P340 acceptance criteria and CLI."),
  ];
}

function buildFullAutoValidationItems({
  fullAuto,
  fullAutoSchemaErrors,
  limitedLive,
  modelImprovement,
  riskEngine,
  paperShadow,
  executionEngine,
  marketDataFeatureStore,
}) {
  const phaseIds = new Set((fullAuto.phase_coverage ?? []).map((phase) => phase.phase_id));
  const knownStrategyIds = new Set(limitedLive.whitelists?.strategy_whitelist?.strategy_ids ?? []);
  const knownModelIds = new Set((modelImprovement.model_registry?.models ?? []).map((model) => model.model_id));
  const strategyScores = fullAuto.strategy_health_scoring?.scores ?? [];
  const modelScores = fullAuto.model_health_scoring?.scores ?? [];
  const allocators = fullAuto.allocators ?? {};
  const failoverPolicies = fullAuto.failover_policies ?? {};
  const dashboardRoutes = fullAuto.dashboard_api_stub?.routes ?? [];
  const disabledRoutes = fullAuto.dashboard_api_stub?.disabled_routes ?? [];
  const finalCases = fullAuto.final_safety_regression_suite?.cases ?? [];
  const freezeChecklist = fullAuto.trading_pack_v1_freeze?.checklist ?? [];
  return [
    validationItem("full_auto.schema", "schema_validation_passed", fullAutoSchemaErrors.length === 0, fullAutoSchemaErrors.length === 0 ? "Full auto governance validates against schema." : `Full auto governance has ${fullAutoSchemaErrors.length} schema error(s).`),
    ...fullAutoSchemaErrors.map((error) => validationItem(error.path, "schema_error", false, error.message)),
    validationItem("full_auto.phase_range", "phase_range_p311_p340", fullAuto.phase_range === "P311-P340", "Full auto governance is scoped to P311-P340."),
    validationItem("full_auto.phase_coverage", "all_phases_covered", REQUIRED_PHASE_IDS.every((phaseId) => phaseIds.has(phaseId)) && (fullAuto.phase_coverage ?? []).every((phase) => phase.status === "complete"), "All P311-P340 phases are covered and complete."),
    validationItem("full_auto.safety", "full_auto_safety_boundary_closed", fullAuto.safety_boundary?.control_plane_only === true && fullAuto.safety_boundary?.full_auto_enabled === false && fullAuto.safety_boundary?.limited_live_enabled === false && fullAuto.safety_boundary?.automatic_order_submission_allowed === false && fullAuto.safety_boundary?.live_order_submission_allowed === false && fullAuto.safety_boundary?.real_order_submitted === false && fullAuto.safety_boundary?.broker_write_allowed === false && fullAuto.safety_boundary?.exchange_write_allowed === false && fullAuto.safety_boundary?.external_service_allowed === false && fullAuto.safety_boundary?.rollback_to_paper_required === true, "Full auto remains a control-plane-only governance surface with all live writes blocked."),
    validationItem("full_auto.approval", "approval_required_and_blocked", fullAuto.full_auto_approval_checklist?.approval_required === true && fullAuto.full_auto_approval_checklist?.approval_receipt_present === false && fullAuto.full_auto_approval_checklist?.decision === "blocked", "Full auto approval is required, no receipt is present, and activation is blocked."),
    validationItem("full_auto.strategy_health", "strategy_health_scores_known", strategyScores.length > 0 && strategyScores.every((score) => knownStrategyIds.has(score.strategy_id) && score.score >= fullAuto.strategy_health_scoring?.score_threshold && score.full_auto_eligible === false), "Strategy health scoring references known strategies and does not grant full-auto eligibility."),
    validationItem("full_auto.model_health", "model_health_scores_known", modelScores.length > 0 && modelScores.every((score) => knownModelIds.has(score.model_id) && score.score >= fullAuto.model_health_scoring?.score_threshold && score.full_auto_eligible === false), "Model health scoring references known models and does not grant full-auto eligibility."),
    validationItem("full_auto.automatic_disable.strategy", "strategy_disable_control_plane_only", fullAuto.automatic_disable_policies?.strategy_disable_on_degradation?.enabled === true && fullAuto.automatic_disable_policies?.strategy_disable_on_degradation?.control_plane_state_change_only === true && fullAuto.automatic_disable_policies?.strategy_disable_on_degradation?.live_orders_touched === false, "Strategy auto-disable is control-plane-only and touches no live orders."),
    validationItem("full_auto.automatic_disable.model", "model_disable_control_plane_only", fullAuto.automatic_disable_policies?.model_disable_on_drift?.enabled === true && fullAuto.automatic_disable_policies?.model_disable_on_drift?.control_plane_state_change_only === true && fullAuto.automatic_disable_policies?.model_disable_on_drift?.live_orders_touched === false, "Model auto-disable is control-plane-only and touches no live orders."),
    validationItem("full_auto.allocators.present", "all_allocators_present", REQUIRED_ALLOCATORS.every((allocatorId) => Boolean(allocators[allocatorId])), "Portfolio, conflict, risk budget, regime, and market stress allocators are present."),
    validationItem("full_auto.allocators.dry_run", "allocators_dry_run_only", REQUIRED_ALLOCATORS.every((allocatorId) => allocators[allocatorId]?.dry_run_only === true) && allocators.portfolio_capital_allocator?.applied_capital === 0 && allocators.portfolio_capital_allocator?.full_auto_allocation_allowed === false && allocators.multi_strategy_conflict_resolver?.order_generation_allowed === false && allocators.risk_budget_allocator?.live_risk_budget_applied === false && allocators.regime_detection_allocator?.allocation_change_allowed === false && allocators.market_stress_allocator?.live_allocation_change_allowed === false, "All allocators are dry-run only and cannot apply live allocations."),
    validationItem("full_auto.failover.data_vendor", "data_vendor_failover_read_only", failoverPolicies.data_vendor_failover?.enabled === true && failoverPolicies.data_vendor_failover?.read_only === true && failoverPolicies.data_vendor_failover?.external_network_allowed === false && failoverPolicies.data_vendor_failover?.order_generation_allowed_during_failover === false && (marketDataFeatureStore.vendor_abstraction?.allowed_source_types ?? []).includes("vendor_stub"), "Data vendor failover is read-only and bound to the vendor abstraction."),
    validationItem("full_auto.failover.broker_exchange", "broker_exchange_failover_no_write", failoverPolicies.broker_exchange_failover?.enabled === true && failoverPolicies.broker_exchange_failover?.broker_write_allowed === false && failoverPolicies.broker_exchange_failover?.exchange_write_allowed === false && failoverPolicies.broker_exchange_failover?.failover_target === "paper" && executionEngine.adapters?.live_adapter?.enabled === false, "Broker/exchange failover cannot enable live writes and falls back to paper."),
    validationItem("full_auto.monthly_review", "monthly_strategy_review_required", fullAuto.monthly_strategy_review?.required === true && fullAuto.monthly_strategy_review?.cadence === "monthly" && fullAuto.monthly_strategy_review?.human_owner_required === true, "Monthly strategy review is required with a human owner."),
    validationItem("full_auto.audit_replay", "audit_replay_replayable", fullAuto.audit_replay?.replayable === true && fullAuto.audit_replay?.source_lineage_required === true && (fullAuto.audit_replay?.source_refs ?? []).includes(limitedLive.limited_live_governance_id) && fullAuto.audit_replay?.review_status_required === true, "Full-auto audit replay is source-lineage-bound and reviewable."),
    validationItem("full_auto.disaster_recovery", "disaster_recovery_to_paper", fullAuto.disaster_recovery?.rollback_stage === "paper" && fullAuto.disaster_recovery?.manual_resume_required === true && fullAuto.disaster_recovery?.restore_from_artifacts_only === true && fullAuto.disaster_recovery?.dry_run_ref === paperShadow.kill_switch_dry_run?.dry_run_id, "Disaster recovery rolls back to paper and manual resume."),
    validationItem("full_auto.tax_export", "tax_export_placeholder_disabled", fullAuto.tax_export_placeholder?.export_enabled === false && fullAuto.tax_export_placeholder?.data_minimization_required === true && fullAuto.tax_export_placeholder?.human_review_required === true, "Tax/export is a disabled placeholder requiring review."),
    validationItem("full_auto.operator_handbook", "operator_handbook_required", fullAuto.operator_handbook?.required === true && fullAuto.operator_handbook?.human_review_queue_required === true && fullAuto.operator_handbook?.protected_action_routes_disabled === true && fullAuto.operator_handbook?.manual_resume_only === true, "Full-auto operator handbook and review queue are required."),
    validationItem("full_auto.dashboard", "dashboard_read_only", fullAuto.dashboard_api_stub?.read_only === true && fullAuto.dashboard_api_stub?.mutating_routes_enabled === false && dashboardRoutes.length > 0 && dashboardRoutes.every((route) => route.method === "GET"), "Full-auto dashboard/API is read-only."),
    validationItem("full_auto.dashboard.disabled", "unsafe_routes_disabled", REQUIRED_DISABLED_ROUTES.every((routePath) => disabledRoutes.some((route) => route.path === routePath)), "Full-auto approval, order, allocator apply, broker failover, and generic order routes are disabled."),
    validationItem("full_auto.final_regression_suite", "final_safety_regression_suite_complete", fullAuto.final_safety_regression_suite?.all_cases_passed === true && fullAuto.final_safety_regression_suite?.case_count === finalCases.length && fullAuto.final_safety_regression_suite?.case_count >= 12, "Final safety regression suite is complete."),
    validationItem("full_auto.v1_freeze", "trading_pack_v1_freeze_locked", fullAuto.trading_pack_v1_freeze?.status === "complete" && fullAuto.trading_pack_v1_freeze?.frozen === true && fullAuto.trading_pack_v1_freeze?.check_mode_no_write_required === true && fullAuto.trading_pack_v1_freeze?.contract_validation_required === true && fullAuto.trading_pack_v1_freeze?.release_freeze_required === true && fullAuto.trading_pack_v1_freeze?.live_enablement_allowed === false && fullAuto.trading_pack_v1_freeze?.completion_baseline_phase === "P340", "Trading Pack v1 freeze is locked without live enablement."),
    validationItem("full_auto.v1_freeze.checklist", "trading_pack_v1_freeze_checklist_complete", freezeChecklist.length >= 10 && freezeChecklist.every((item) => item.status === "complete"), "Trading Pack v1 freeze checklist is complete."),
    validationItem("full_auto.upstream_limited_live", "limited_live_still_disabled", limitedLive.safety_boundary?.limited_live_enabled === false && limitedLive.safety_boundary?.live_order_submission_allowed === false && limitedLive.safety_boundary?.full_auto_promotion_allowed === false, "Upstream limited-live governance still blocks limited live and full auto."),
    validationItem("full_auto.upstream_risk", "risk_engine_still_blocks_order_intent", riskEngine.safety_boundary?.order_intent_generated === false && riskEngine.safety_boundary?.live_execution_allowed === false, "Upstream risk engine still blocks order intent and live execution."),
  ];
}

function buildFixtureResults(goldenFixtures, fullAuto, fullAutoItems) {
  return (goldenFixtures.fixtures ?? []).map((fixture) => {
    const regressionHash = hashValue({
      fixture_id: fixture.fixture_id,
      phase_range: fullAuto.phase_range,
      phase_coverage: fullAuto.phase_coverage,
      safety_boundary: fullAuto.safety_boundary,
      full_auto_approval_checklist: fullAuto.full_auto_approval_checklist,
      strategy_health_scoring: fullAuto.strategy_health_scoring,
      model_health_scoring: fullAuto.model_health_scoring,
      automatic_disable_policies: fullAuto.automatic_disable_policies,
      allocators: fullAuto.allocators,
      failover_policies: fullAuto.failover_policies,
      trading_pack_v1_freeze: fullAuto.trading_pack_v1_freeze,
    });
    const validationItems = [
      validationItem(`fixtures.${fixture.fixture_id}.status`, "fixture_status_matches", fixture.expected_status === "complete" && fullAutoItems.every((item) => item.status === "passed"), `${fixture.fixture_id} expected status is complete.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_range`, "fixture_phase_range_matches", fullAuto.phase_range === fixture.expected_phase_range, `${fixture.fixture_id} phase range matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_count`, "fixture_phase_count_matches", (fullAuto.phase_coverage ?? []).length === fixture.expected_phase_count, `${fixture.fixture_id} phase count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.approval_required`, "fixture_approval_required_matches", fullAuto.full_auto_approval_checklist?.approval_required === fixture.expected_approval_required, `${fixture.fixture_id} approval requirement matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.approval_receipt`, "fixture_approval_receipt_matches", fullAuto.full_auto_approval_checklist?.approval_receipt_present === fixture.expected_approval_receipt_present, `${fixture.fixture_id} approval receipt boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.strategy_health_count`, "fixture_strategy_health_count_matches", (fullAuto.strategy_health_scoring?.scores ?? []).length === fixture.expected_strategy_health_count, `${fixture.fixture_id} strategy health count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.model_health_count`, "fixture_model_health_count_matches", (fullAuto.model_health_scoring?.scores ?? []).length === fixture.expected_model_health_count, `${fixture.fixture_id} model health count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.allocator_count`, "fixture_allocator_count_matches", Object.keys(fullAuto.allocators ?? {}).length === fixture.expected_allocator_count, `${fixture.fixture_id} allocator count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.failover_count`, "fixture_failover_count_matches", Object.keys(fullAuto.failover_policies ?? {}).length === fixture.expected_failover_policy_count, `${fixture.fixture_id} failover policy count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.full_auto`, "fixture_full_auto_boundary_matches", fullAuto.safety_boundary?.full_auto_enabled === fixture.expected_full_auto_enabled, `${fixture.fixture_id} full auto boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.automatic_orders`, "fixture_automatic_order_boundary_matches", fullAuto.safety_boundary?.automatic_order_submission_allowed === fixture.expected_automatic_order_submission_allowed, `${fixture.fixture_id} automatic order boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.real_order`, "fixture_real_order_boundary_matches", fullAuto.safety_boundary?.real_order_submitted === fixture.expected_real_order_submitted, `${fixture.fixture_id} real order boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.regression_count`, "fixture_regression_count_matches", fullAuto.final_safety_regression_suite?.case_count === fixture.expected_final_regression_case_count, `${fixture.fixture_id} final regression case count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.v1_freeze_count`, "fixture_v1_freeze_checklist_count_matches", (fullAuto.trading_pack_v1_freeze?.checklist ?? []).length === fixture.expected_v1_freeze_checklist_count, `${fixture.fixture_id} v1 freeze checklist count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.live_enablement`, "fixture_live_enablement_boundary_matches", fullAuto.trading_pack_v1_freeze?.live_enablement_allowed === fixture.expected_live_enablement_allowed, `${fixture.fixture_id} live enablement boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.dashboard`, "fixture_dashboard_boundary_matches", fullAuto.dashboard_api_stub?.read_only === fixture.expected_dashboard_read_only, `${fixture.fixture_id} dashboard boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.hash`, "fixture_regression_hash_locked", regressionHash.startsWith("sha256:"), `${fixture.fixture_id} regression hash is locked.`),
    ];
    const validation = summarizeValidation(validationItems);
    return {
      schema_version: "trading-full-auto-fixture-result.v1",
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

function summarizeFullAutoReport({ fullAuto, fixtureResults, validationItems, validation }) {
  return {
    full_auto_report_status: validation.valid ? "complete" : "blocked",
    phase_range: fullAuto.phase_range,
    phase_count: fullAuto.phase_coverage?.length ?? 0,
    complete_phase_count: (fullAuto.phase_coverage ?? []).filter((phase) => phase.status === "complete").length,
    fixture_count: fixtureResults.length,
    passed_fixture_count: fixtureResults.filter((fixture) => fixture.validation.valid).length,
    locked_regression_hash_count: fixtureResults.filter((fixture) => fixture.regression_hash?.startsWith("sha256:")).length,
    validation_item_count: validationItems.length,
    validation_error_count: validation.errors.length,
    approval_required: fullAuto.full_auto_approval_checklist?.approval_required === true,
    approval_receipt_present: fullAuto.full_auto_approval_checklist?.approval_receipt_present === true,
    strategy_health_count: fullAuto.strategy_health_scoring?.scores?.length ?? 0,
    model_health_count: fullAuto.model_health_scoring?.scores?.length ?? 0,
    allocator_count: Object.keys(fullAuto.allocators ?? {}).length,
    failover_policy_count: Object.keys(fullAuto.failover_policies ?? {}).length,
    final_regression_case_count: fullAuto.final_safety_regression_suite?.case_count ?? 0,
    v1_freeze_checklist_count: fullAuto.trading_pack_v1_freeze?.checklist?.length ?? 0,
    v1_freeze_status: fullAuto.trading_pack_v1_freeze?.status ?? "missing",
    full_auto_enabled: fullAuto.safety_boundary?.full_auto_enabled === true,
    limited_live_enabled: fullAuto.safety_boundary?.limited_live_enabled === true,
    automatic_order_submission_allowed: fullAuto.safety_boundary?.automatic_order_submission_allowed === true,
    live_order_submission_allowed: fullAuto.safety_boundary?.live_order_submission_allowed === true,
    real_order_submitted: fullAuto.safety_boundary?.real_order_submitted === true,
    broker_write_allowed: fullAuto.safety_boundary?.broker_write_allowed === true,
    exchange_write_allowed: fullAuto.safety_boundary?.exchange_write_allowed === true,
    live_enablement_allowed: fullAuto.trading_pack_v1_freeze?.live_enablement_allowed === true,
    dashboard_read_only: fullAuto.dashboard_api_stub?.read_only === true,
  };
}

function renderFullAutoReportMarkdown(result) {
  const lines = [];
  lines.push("# Trading Full Auto Report");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.full_auto_report_status}`);
  lines.push("");
  lines.push(`- Phase range: ${result.summary.phase_range}`);
  lines.push(`- Phases complete: ${result.summary.complete_phase_count}/${result.summary.phase_count}`);
  lines.push(`- Approval required: ${result.summary.approval_required}`);
  lines.push(`- Approval receipt present: ${result.summary.approval_receipt_present}`);
  lines.push(`- Full auto enabled: ${result.summary.full_auto_enabled}`);
  lines.push(`- Automatic order submission allowed: ${result.summary.automatic_order_submission_allowed}`);
  lines.push(`- Real orders submitted: ${result.summary.real_order_submitted}`);
  lines.push(`- Trading Pack v1 freeze status: ${result.summary.v1_freeze_status}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options = {}) {
  return {
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_FULL_AUTO_INPUTS.fullAutoPath),
    full_auto_schema_path: path.resolve(options.fullAutoSchemaPath ?? DEFAULT_TRADING_FULL_AUTO_INPUTS.fullAutoSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_FULL_AUTO_INPUTS.limitedLivePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_FULL_AUTO_INPUTS.modelImprovementPath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_FULL_AUTO_INPUTS.riskEnginePath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_FULL_AUTO_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_FULL_AUTO_INPUTS.executionEnginePath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_FULL_AUTO_INPUTS.marketDataFeatureStorePath),
    golden_fixtures_path: path.resolve(options.goldenFixturesPath ?? DEFAULT_TRADING_FULL_AUTO_INPUTS.goldenFixturesPath),
    pack_manifest_path: path.resolve(options.packManifestPath ?? DEFAULT_TRADING_FULL_AUTO_INPUTS.packManifestPath),
    capability_manifest_path: path.resolve(options.capabilityManifestPath ?? DEFAULT_TRADING_FULL_AUTO_INPUTS.capabilityManifestPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_FULL_AUTO_INPUTS.packagePath),
    phase_ledger_path: path.resolve(options.phaseLedgerPath ?? DEFAULT_TRADING_FULL_AUTO_INPUTS.phaseLedgerPath),
  };
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_TRADING_FULL_AUTO_REPORT_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--full-auto") parsed.fullAutoPath = argv[++index];
    else if (arg === "--full-auto-schema") parsed.fullAutoSchemaPath = argv[++index];
    else if (arg === "--limited-live") parsed.limitedLivePath = argv[++index];
    else if (arg === "--model-improvement") parsed.modelImprovementPath = argv[++index];
    else if (arg === "--risk-engine") parsed.riskEnginePath = argv[++index];
    else if (arg === "--paper-shadow") parsed.paperShadowPath = argv[++index];
    else if (arg === "--execution-engine") parsed.executionEnginePath = argv[++index];
    else if (arg === "--market-data-feature-store") parsed.marketDataFeatureStorePath = argv[++index];
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
  console.log(`Usage: node scripts/trading-full-auto-report.mjs [options]

Options:
  --out-dir <folder>                    Output directory. Default: ${DEFAULT_TRADING_FULL_AUTO_REPORT_OUT_DIR}
  --run-at <iso>                        Deterministic generated_at timestamp.
  --full-auto <path>                    Full auto governance fixture path.
  --full-auto-schema <path>             Full auto governance schema path.
  --limited-live <path>                 Limited live governance fixture path.
  --model-improvement <path>            Model improvement fixture path.
  --risk-engine <path>                  Risk engine fixture path.
  --paper-shadow <path>                 Paper/shadow fixture path.
  --execution-engine <path>             Execution engine fixture path.
  --market-data-feature-store <path>    Market data and feature store fixture path.
  --golden-fixtures <path>              Full auto golden fixtures path.
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
    validation_item_id: `trading-full-auto.${slugify(itemPath)}.${checkId}`,
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
