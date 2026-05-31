import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildDomainPackRegistry } from "./domain-pack-registry.mjs";

export const DEFAULT_TRADING_PAPER_REPORT_OUT_DIR = "artifacts/trading-paper-report/latest";
export const DEFAULT_TRADING_SHADOW_REPORT_OUT_DIR = "artifacts/trading-shadow-report/latest";
export const DEFAULT_TRADING_PAPER_SHADOW_INPUTS = {
  paperShadowPath: "examples/trading/paper-shadow-live.json",
  paperShadowSchemaPath: "schemas/trading/trading-paper-shadow-live.schema.json",
  paperTradeSchemaPath: "schemas/trading/trading-paper-trade.schema.json",
  orderIntentSchemaPath: "schemas/trading/trading-order-intent.schema.json",
  fillReconciliationSchemaPath: "schemas/trading/trading-fill-reconciliation.schema.json",
  signalEnginePath: "examples/trading/signal-engine.json",
  modelImprovementPath: "examples/trading/model-improvement-layer.json",
  riskEnginePath: "examples/trading/risk-engine.json",
  goldenFixturesPath: "examples/trading/paper-shadow-live-golden-fixtures.json",
  packManifestPath: "packs/trading/pack.json",
  capabilityManifestPath: "packs/trading/capabilities/research-backtest-paper.json",
  packagePath: "package.json",
  phaseLedgerPath: "docs/trading-pack-phase-ledger.md",
};

const REQUIRED_PHASE_IDS = Array.from({ length: 25 }, (_, index) => `P${String(221 + index).padStart(3, "0")}`);

export async function runTradingPaperReport(options = {}) {
  return runTradingPaperShadowReport({ ...options, reportKind: "paper" });
}

export async function runTradingShadowReport(options = {}) {
  return runTradingPaperShadowReport({ ...options, reportKind: "shadow" });
}

export async function runTradingPaperShadowReport(options = {}) {
  const result = await buildTradingPaperShadowReport(options);
  if (options.write !== false) await writeTradingPaperShadowReport(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading ${result.report_kind} report validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingPaperShadowReport(options = {}) {
  const reportKind = options.reportKind === "shadow" ? "shadow" : "paper";
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const defaultOutDir = reportKind === "paper" ? DEFAULT_TRADING_PAPER_REPORT_OUT_DIR : DEFAULT_TRADING_SHADOW_REPORT_OUT_DIR;
  const outputDir = path.resolve(options.outDir ?? defaultOutDir);
  const inputs = normalizeInputs(options);
  const paperShadow = await readJson(inputs.paper_shadow_path);
  const paperShadowSchema = await readJson(inputs.paper_shadow_schema_path);
  const paperTradeSchema = await readJson(inputs.paper_trade_schema_path);
  const orderIntentSchema = await readJson(inputs.order_intent_schema_path);
  const fillReconciliationSchema = await readJson(inputs.fill_reconciliation_schema_path);
  const signalEngine = await readJson(inputs.signal_engine_path);
  const modelImprovement = await readJson(inputs.model_improvement_path);
  const riskEngine = await readJson(inputs.risk_engine_path);
  const goldenFixtures = await readJson(inputs.golden_fixtures_path);
  const packManifest = await readJson(inputs.pack_manifest_path);
  const capabilityManifest = await readJson(inputs.capability_manifest_path);
  const packageJson = await readJson(inputs.package_path);
  const phaseLedgerText = await readFile(inputs.phase_ledger_path, "utf8");
  const domainPackRegistry = await buildDomainPackRegistry({ runAt: generatedAt });

  const paperShadowSchemaErrors = validateAgainstSchema(paperShadow, paperShadowSchema, {}, "paper_shadow_live");
  const paperLedgerValidation = validateSingleArtifact("paper_order_ledger", paperShadow.paper_order_ledger, paperTradeSchema);
  const shadowIntentResults = validateShadowOrderIntents(paperShadow, orderIntentSchema);
  const fillReconciliationValidation = validateSingleArtifact("intended_fill_vs_market.reconciliation_artifact", paperShadow.intended_fill_vs_market?.reconciliation_artifact, fillReconciliationSchema);
  const sourceItems = buildSourceValidationItems({
    packageJson,
    packManifest,
    capabilityManifest,
    phaseLedgerText,
    domainPackRegistry,
  });
  const paperShadowItems = buildPaperShadowValidationItems({
    paperShadow,
    paperShadowSchemaErrors,
    paperLedgerValidation,
    shadowIntentResults,
    fillReconciliationValidation,
    signalEngine,
    modelImprovement,
    riskEngine,
  });
  const fixtureResults = buildFixtureResults(goldenFixtures, paperShadow, paperShadowItems);
  const validationItems = [
    ...sourceItems,
    ...paperShadowItems,
    ...fixtureResults.flatMap((fixture) => fixture.validation_items),
  ];
  const validation = summarizeValidation(validationItems);
  const summary = summarizePaperShadowReport({
    reportKind,
    paperShadow,
    shadowIntentResults,
    fixtureResults,
    validationItems,
    validation,
  });
  const result = {
    schema_version: reportKind === "paper" ? "trading-paper-report.v1" : "trading-shadow-report.v1",
    generated_at: generatedAt,
    report_kind: reportKind,
    paper_shadow_report_id: `trading-${reportKind}-report.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      paper_shadow_live: sourceContract("paper_shadow_live", inputs.paper_shadow_path, paperShadow.schema_version, paperShadow.paper_shadow_status === "complete"),
      paper_shadow_schema: sourceContract("paper_shadow_schema", inputs.paper_shadow_schema_path, paperShadowSchema.title, paperShadowSchemaErrors.length === 0),
      paper_trade_schema: sourceContract("trading_paper_trade_schema", inputs.paper_trade_schema_path, paperTradeSchema.title, paperLedgerValidation.validation.valid),
      order_intent_schema: sourceContract("trading_order_intent_schema", inputs.order_intent_schema_path, orderIntentSchema.title, shadowIntentResults.every((item) => item.validation.valid)),
      fill_reconciliation_schema: sourceContract("trading_fill_reconciliation_schema", inputs.fill_reconciliation_schema_path, fillReconciliationSchema.title, fillReconciliationValidation.validation.valid),
      signal_engine: sourceContract("signal_engine", inputs.signal_engine_path, signalEngine.schema_version, signalEngine.signal_engine_status === "complete"),
      model_improvement: sourceContract("model_improvement", inputs.model_improvement_path, modelImprovement.schema_version, modelImprovement.model_improvement_status === "complete"),
      risk_engine: sourceContract("risk_engine", inputs.risk_engine_path, riskEngine.schema_version, riskEngine.risk_engine_status === "complete"),
      golden_fixtures: sourceContract("paper_shadow_golden_fixtures", inputs.golden_fixtures_path, goldenFixtures.schema_version, Array.isArray(goldenFixtures.fixtures)),
      pack_manifest: sourceContract("trading_pack_manifest", inputs.pack_manifest_path, packManifest.schema_version, packManifest.pack_id === "trading"),
      capability_manifest: sourceContract("trading_capability_manifest", inputs.capability_manifest_path, capabilityManifest.schema_version, capabilityManifest.domain_pack === "trading"),
      domain_pack_registry: {
        source_id: "domain_pack_registry",
        status: domainPackRegistry.validation.valid ? "valid" : "invalid",
        trading_registered: Boolean(domainPackRegistry.packs.find((pack) => pack.pack_id === "trading")),
      },
    },
    paper_shadow_live: paperShadow,
    paper_ledger_validation: paperLedgerValidation,
    shadow_intent_results: shadowIntentResults,
    fill_reconciliation_validation: fillReconciliationValidation,
    fixture_results: fixtureResults,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderPaperShadowReportMarkdown(result),
  };
}

export async function writeTradingPaperShadowReport(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const reportFile = result.report_kind === "paper" ? "trading-paper-report.json" : "trading-shadow-report.json";
  await writeJson(path.join(outDir, reportFile), serializableResult(result));
  await writeJson(path.join(outDir, "paper-shadow-live.json"), result.paper_shadow_live);
  await writeJson(path.join(outDir, "shadow-intent-results.json"), {
    schema_version: "trading-shadow-intent-results.v1",
    generated_at: result.generated_at,
    shadow_intent_results: result.shadow_intent_results,
  });
  await writeJson(path.join(outDir, "fixture-results.json"), {
    schema_version: "trading-paper-shadow-fixture-results.v1",
    generated_at: result.generated_at,
    fixture_results: result.fixture_results,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingPaperReportCli(argv = process.argv.slice(2)) {
  await runTradingPaperShadowReportCli(argv, "paper");
}

export async function runTradingShadowReportCli(argv = process.argv.slice(2)) {
  await runTradingPaperShadowReportCli(argv, "shadow");
}

async function runTradingPaperShadowReportCli(argv, reportKind) {
  const args = { ...parseArgs(argv), reportKind };
  if (args.help) {
    printHelp(reportKind);
    return;
  }
  try {
    const result = await runTradingPaperShadowReport(args);
    console.log(`Trading ${reportKind} report ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.paper_shadow_report_status}`);
    console.log(`Phase range: ${result.summary.phase_range}`);
    console.log(`Paper orders: ${result.summary.paper_order_count}`);
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
    schema_version: "trading-single-artifact-validation-result.v1",
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

function validateShadowOrderIntents(paperShadow, orderIntentSchema) {
  return (paperShadow.shadow_order_intents ?? []).map((intent, index) => {
    const errors = validateAgainstSchema(intent, orderIntentSchema, {}, `shadow_order_intents[${index}]`);
    return {
      schema_version: "trading-shadow-order-intent-validation-result.v1",
      order_intent_id: intent.order_intent_id ?? null,
      validation: {
        valid: errors.length === 0,
        errors,
      },
      validation_items: [
        validationItem(`shadow_order_intents.${intent.order_intent_id ?? index}`, "order_intent_schema_valid", errors.length === 0, errors.length === 0 ? "Shadow order intent artifact validates." : `Shadow order intent has ${errors.length} schema error(s).`),
        ...errors.map((error) => validationItem(error.path, "order_intent_schema_error", false, error.message)),
      ],
    };
  });
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
    validationItem("source.package.trading_paper_report", "package_script_registered", Boolean(scripts["trading:paper-report"]), "Package script trading:paper-report is registered."),
    validationItem("source.package.trading_shadow_report", "package_script_registered", Boolean(scripts["trading:shadow-report"]), "Package script trading:shadow-report is registered."),
    validationItem("source.pack.schemas.paper_shadow", "pack_schema_registered", packSchemas.includes("schemas/trading/trading-paper-shadow-live.schema.json"), "Trading pack manifest registers the paper/shadow schema."),
    validationItem("source.pack.workflow.paper_report", "pack_workflow_registered", workflows.includes("workflow.trading.paper_report.v1"), "Trading pack manifest registers the paper report workflow."),
    validationItem("source.pack.workflow.shadow_report", "pack_workflow_registered", workflows.includes("workflow.trading.shadow_report.v1"), "Trading pack manifest registers the shadow report workflow."),
    validationItem("source.pack.workflow.paper_shadow_dashboard", "pack_workflow_registered", workflows.includes("workflow.trading.paper_shadow_dashboard.v1"), "Trading pack manifest registers the paper/shadow dashboard/API workflow."),
    validationItem("source.pack.golden.paper_shadow", "pack_golden_case_registered", goldenCases.includes("golden.trading.paper_shadow_live.p221_p245"), "Trading pack manifest registers the paper/shadow golden case."),
    validationItem("source.capability.entrypoint.paper_report", "capability_entrypoint_registered", entrypoints.some((entrypoint) => entrypoint.name === "trading:paper-report"), "Trading capability manifest registers the paper report entrypoint."),
    validationItem("source.capability.entrypoint.shadow_report", "capability_entrypoint_registered", entrypoints.some((entrypoint) => entrypoint.name === "trading:shadow-report"), "Trading capability manifest registers the shadow report entrypoint."),
    validationItem("source.capability.golden.paper_shadow", "capability_golden_case_registered", capabilityGoldenCases.some((fixture) => fixture.case_id === "golden.trading.paper_shadow_live.p221_p245"), "Trading capability manifest registers the paper/shadow golden case."),
    validationItem("source.domain_pack_registry.trading", "domain_pack_registry_valid", domainPackRegistry.validation.valid === true && Boolean(tradingPack), "Domain pack registry remains valid with Trading registered."),
    validationItem("source.phase_ledger.p221_p245", "phase_ledger_updated", phaseLedgerText.includes("P221-P245 Acceptance Criteria") && phaseLedgerText.includes("trading:paper-report") && phaseLedgerText.includes("trading:shadow-report"), "Phase ledger documents P221-P245 acceptance criteria and CLIs."),
  ];
}

function buildPaperShadowValidationItems({
  paperShadow,
  paperShadowSchemaErrors,
  paperLedgerValidation,
  shadowIntentResults,
  fillReconciliationValidation,
  signalEngine,
  modelImprovement,
  riskEngine,
}) {
  const phaseIds = new Set((paperShadow.phase_coverage ?? []).map((phase) => phase.phase_id));
  const paperOrders = paperShadow.paper_order_ledger?.orders ?? [];
  const signalIds = new Set((signalEngine.signal_candidates ?? []).map((candidate) => candidate.signal_artifact?.signal_id).filter(Boolean));
  const modelIds = new Set((modelImprovement.model_registry?.models ?? []).map((model) => model.model_id));
  const riskCheckIds = new Set((riskEngine.risk_check_artifacts ?? []).map((artifact) => artifact.risk_check_id));
  const shadowIntents = paperShadow.shadow_order_intents ?? [];
  const disabledRoutes = paperShadow.dashboard_api_stub?.disabled_routes ?? [];
  const dashboardRoutes = paperShadow.dashboard_api_stub?.routes ?? [];
  return [
    validationItem("paper_shadow.schema", "schema_validation_passed", paperShadowSchemaErrors.length === 0, paperShadowSchemaErrors.length === 0 ? "Paper/shadow layer validates against schema." : `Paper/shadow layer has ${paperShadowSchemaErrors.length} schema error(s).`),
    ...paperShadowSchemaErrors.map((error) => validationItem(error.path, "schema_error", false, error.message)),
    validationItem("paper_shadow.phase_range", "phase_range_p221_p245", paperShadow.phase_range === "P221-P245", "Paper/shadow layer is scoped to P221-P245."),
    validationItem("paper_shadow.phase_coverage", "all_phases_covered", REQUIRED_PHASE_IDS.every((phaseId) => phaseIds.has(phaseId)) && (paperShadow.phase_coverage ?? []).every((phase) => phase.status === "complete"), "All P221-P245 phases are covered and complete."),
    validationItem("paper_shadow.safety", "paper_shadow_safety_boundary", paperShadow.safety_boundary?.paper_simulation_only === true && paperShadow.safety_boundary?.shadow_read_only === true && paperShadow.safety_boundary?.shadow_order_intent_non_executable === true && paperShadow.safety_boundary?.real_order_submitted === false && paperShadow.safety_boundary?.live_execution_allowed === false, "Paper is simulation-only and shadow is read-only with non-executable intents."),
    validationItem("paper_shadow.safety.adapters", "live_adapters_credentials_disabled", paperShadow.safety_boundary?.broker_adapter_enabled === false && paperShadow.safety_boundary?.exchange_adapter_enabled === false && paperShadow.safety_boundary?.credential_required === false, "Broker/exchange adapters and credentials are disabled."),
    validationItem("paper_shadow.paper_ledger.schema", "paper_ledger_schema_valid", paperLedgerValidation.validation.valid, "Paper order ledger validates against trading-paper-trade.v1."),
    ...paperLedgerValidation.validation_items,
    validationItem("paper_shadow.paper_ledger.orders", "paper_orders_cover_fill_states", paperOrders.length === 3 && ["filled", "partial", "rejected"].every((status) => paperOrders.some((order) => order.status === status)), "Paper ledger covers filled, partial, and rejected simulated orders."),
    validationItem("paper_shadow.paper_fill_simulator", "paper_fill_simulator_deterministic", paperShadow.paper_fill_simulator?.deterministic === true && paperShadow.paper_fill_simulator?.live_fill_source_allowed === false, "Paper fill simulator is deterministic and uses no live fill source."),
    validationItem("paper_shadow.paper_fill_models", "partial_and_rejected_fill_models_present", paperShadow.paper_fill_models?.partial_fill_model?.enabled === true && paperShadow.paper_fill_models?.partial_fill_model?.partial_fill_supported === true && paperShadow.paper_fill_models?.rejected_fill_model?.enabled === true && paperShadow.paper_fill_models?.rejected_fill_model?.rejection_supported === true, "Partial and rejected fill models are present."),
    validationItem("paper_shadow.paper_pnl", "paper_pnl_matches_ledger", paperShadow.paper_pnl?.pnl === paperShadow.paper_order_ledger?.pnl && paperShadow.paper_pnl?.source_ref === paperShadow.paper_order_ledger?.paper_ledger_id, "Paper PnL is bound to the paper ledger."),
    validationItem("paper_shadow.paper_drawdown", "paper_drawdown_matches_ledger", paperShadow.paper_drawdown?.drawdown_pct === paperShadow.paper_order_ledger?.drawdown_pct && paperShadow.paper_drawdown?.source_ref === paperShadow.paper_order_ledger?.paper_ledger_id, "Paper drawdown is bound to the paper ledger."),
    validationItem("paper_shadow.strategy_scorecards", "strategy_scorecards_reviewable", (paperShadow.strategy_paper_scorecards ?? []).length >= 1 && (paperShadow.strategy_paper_scorecards ?? []).every((scorecard) => scorecard.human_review_required === true && scorecard.paper_status !== "approved_live"), "Strategy paper scorecards require human review."),
    validationItem("paper_shadow.model_scorecards", "model_scorecards_reference_models", (paperShadow.model_paper_scorecards ?? []).length >= 1 && (paperShadow.model_paper_scorecards ?? []).every((scorecard) => modelIds.has(scorecard.model_id) && scorecard.human_review_required === true && scorecard.shadow_ready === false), "Model paper scorecards reference registered models and are not shadow-ready by default."),
    validationItem("paper_shadow.parity", "paper_live_parity_contract_reviewable", paperShadow.paper_live_parity_contract?.paper_live_parity_required === true && paperShadow.paper_live_parity_contract?.max_drift_pct <= 0.02 && paperShadow.paper_live_parity_contract?.human_review_required === true, "Paper/live parity contract is reviewable."),
    validationItem("paper_shadow.promotion_to_shadow", "promotion_to_shadow_not_enabled", paperShadow.promotion_criteria_to_shadow?.decision === "pending_human_review" && paperShadow.promotion_criteria_to_shadow?.human_approval_required === true && paperShadow.promotion_criteria_to_shadow?.shadow_live_enabled === false && riskCheckIds.size >= 1, "Promotion to shadow requires human review and remains disabled."),
    validationItem("paper_shadow.live_data_adapter", "read_only_live_data_adapter_stub", paperShadow.read_only_live_data_adapter?.read_only === true && paperShadow.read_only_live_data_adapter?.credentials_required === false && paperShadow.read_only_live_data_adapter?.external_network_required === false && paperShadow.read_only_live_data_adapter?.order_routes_enabled === false, "Live data adapter is read-only fixture replay with no credentials or order routes."),
    validationItem("paper_shadow.shadow_signals", "shadow_signal_refs_registered", paperShadow.shadow_signal_generation?.enabled === true && paperShadow.shadow_signal_generation?.live_execution_allowed === false && (paperShadow.shadow_signal_generation?.source_signal_refs ?? []).every((signalId) => signalIds.has(signalId)), "Shadow signal generation references signal engine outputs and blocks live execution."),
    validationItem("paper_shadow.shadow_intents.schema", "shadow_order_intents_validate", shadowIntentResults.length >= 1 && shadowIntentResults.every((result) => result.validation.valid), "Shadow order intents validate against trading-order-intent.v1."),
    ...shadowIntentResults.flatMap((result) => result.validation_items),
    validationItem("paper_shadow.shadow_intents.boundary", "shadow_intents_non_executable", shadowIntents.length >= 1 && shadowIntents.every((intent) => intent.execution_mode === "shadow" && intent.live_execution_allowed === false && intent.market_order_allowed === false && intent.risk_gate_status === "block" && intent.non_executable === true && intent.review_only === true), "Shadow intents are non-executable, review-only, and risk-blocked."),
    validationItem("paper_shadow.no_order_mode", "no_order_shadow_mode_enabled", paperShadow.no_order_shadow_mode?.enabled === true && paperShadow.no_order_shadow_mode?.real_order_count === 0 && paperShadow.no_order_shadow_mode?.broker_write_allowed === false && paperShadow.no_order_shadow_mode?.exchange_write_allowed === false, "No-order shadow mode blocks broker/exchange writes."),
    validationItem("paper_shadow.fill_reconciliation.schema", "fill_reconciliation_schema_valid", fillReconciliationValidation.validation.valid, "Intended fill vs market reconciliation validates."),
    ...fillReconciliationValidation.validation_items,
    validationItem("paper_shadow.fill_reconciliation.boundary", "intended_fill_no_live_fill", paperShadow.intended_fill_vs_market?.status === "not_applicable" && paperShadow.intended_fill_vs_market?.reconciliation_artifact?.status === "not_applicable" && (paperShadow.intended_fill_vs_market?.reconciliation_artifact?.observed_fills ?? []).length === 0, "Intended fill comparison records no live fills."),
    validationItem("paper_shadow.latency", "latency_measurement_declared", Number.isFinite(paperShadow.latency_measurement?.p50_ms) && Number.isFinite(paperShadow.latency_measurement?.p95_ms) && paperShadow.latency_measurement.p95_ms >= paperShadow.latency_measurement.p50_ms, "Latency measurement is declared."),
    validationItem("paper_shadow.data_outage", "data_outage_detection_declared", paperShadow.data_outage_detection?.outage_detected === false && paperShadow.data_outage_detection?.halt_shadow_generation_on_outage === true, "Data outage detector would halt shadow generation."),
    validationItem("paper_shadow.shadow_pnl", "shadow_pnl_informational", paperShadow.shadow_pnl_estimate?.informational_only === true && Number.isFinite(paperShadow.shadow_pnl_estimate?.pnl), "Shadow PnL estimate is informational only."),
    validationItem("paper_shadow.drift", "shadow_drift_reviewable", paperShadow.shadow_live_drift_report?.result === "pass" && paperShadow.shadow_live_drift_report?.drift_pct <= paperShadow.paper_live_parity_contract?.max_drift_pct && paperShadow.shadow_live_drift_report?.human_review_required === true, "Shadow/live drift is within parity threshold and requires review."),
    validationItem("paper_shadow.kill_switch", "kill_switch_dry_run_safe", paperShadow.kill_switch_dry_run?.executed === true && paperShadow.kill_switch_dry_run?.manual_resume_required === true && paperShadow.kill_switch_dry_run?.live_orders_cancelled === 0, "Kill switch dry run executed without live orders."),
    validationItem("paper_shadow.promotion_to_limited_live", "limited_live_blocked", paperShadow.promotion_criteria_to_limited_live?.decision === "blocked" && paperShadow.promotion_criteria_to_limited_live?.human_approval_required === true && paperShadow.promotion_criteria_to_limited_live?.limited_live_enabled === false, "Promotion to limited live remains blocked."),
    validationItem("paper_shadow.dashboard", "dashboard_read_only", paperShadow.dashboard_api_stub?.read_only === true && paperShadow.dashboard_api_stub?.mutating_routes_enabled === false && dashboardRoutes.length > 0 && dashboardRoutes.every((route) => route.method === "GET"), "Paper/shadow dashboard/API is read-only."),
    validationItem("paper_shadow.dashboard.disabled", "unsafe_routes_disabled", disabledRoutes.some((route) => route.path === "/api/trading/shadow/enable-live") && disabledRoutes.some((route) => route.path === "/api/trading/shadow/orders") && disabledRoutes.some((route) => route.path === "/api/trading/orders"), "Shadow live, shadow orders, and real orders routes are disabled."),
    validationItem("paper_shadow.operator", "operator_integration_reviewable", paperShadow.operator_integration?.operator_handbook_note_required === true && paperShadow.operator_integration?.human_review_queue_required === true && paperShadow.operator_integration?.protected_action_routes_disabled === true, "Operator integration requires handbook note, review queue, and disabled protected routes."),
  ];
}

function buildFixtureResults(goldenFixtures, paperShadow, paperShadowItems) {
  return (goldenFixtures.fixtures ?? []).map((fixture) => {
    const regressionHash = hashValue({
      fixture_id: fixture.fixture_id,
      phase_range: paperShadow.phase_range,
      phase_coverage: paperShadow.phase_coverage,
      safety_boundary: paperShadow.safety_boundary,
      paper_order_statuses: (paperShadow.paper_order_ledger?.orders ?? []).map((order) => order.status).sort(),
      shadow_order_intents: paperShadow.shadow_order_intents,
      no_order_shadow_mode: paperShadow.no_order_shadow_mode,
      promotion_criteria_to_shadow: paperShadow.promotion_criteria_to_shadow,
      promotion_criteria_to_limited_live: paperShadow.promotion_criteria_to_limited_live,
    });
    const validationItems = [
      validationItem(`fixtures.${fixture.fixture_id}.status`, "fixture_status_matches", fixture.expected_status === "complete" && paperShadowItems.every((item) => item.status === "passed"), `${fixture.fixture_id} expected status is complete.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_range`, "fixture_phase_range_matches", paperShadow.phase_range === fixture.expected_phase_range, `${fixture.fixture_id} phase range matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_count`, "fixture_phase_count_matches", (paperShadow.phase_coverage ?? []).length === fixture.expected_phase_count, `${fixture.fixture_id} phase count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.paper_order_count`, "fixture_paper_order_count_matches", (paperShadow.paper_order_ledger?.orders ?? []).length === fixture.expected_paper_order_count, `${fixture.fixture_id} paper order count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.shadow_intent_count`, "fixture_shadow_intent_count_matches", (paperShadow.shadow_order_intents ?? []).length === fixture.expected_shadow_order_intent_count, `${fixture.fixture_id} shadow intent count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.real_order_count`, "fixture_real_order_count_matches", paperShadow.no_order_shadow_mode?.real_order_count === fixture.expected_real_order_count, `${fixture.fixture_id} real order count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.live_boundary`, "fixture_live_boundary_matches", paperShadow.safety_boundary?.live_execution_allowed === fixture.expected_live_execution_allowed, `${fixture.fixture_id} live execution boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.shadow_read_only`, "fixture_shadow_read_only_matches", paperShadow.safety_boundary?.shadow_read_only === fixture.expected_shadow_read_only, `${fixture.fixture_id} shadow read-only boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.broker_adapter`, "fixture_broker_adapter_matches", paperShadow.safety_boundary?.broker_adapter_enabled === fixture.expected_broker_adapter_enabled, `${fixture.fixture_id} broker adapter boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.exchange_adapter`, "fixture_exchange_adapter_matches", paperShadow.safety_boundary?.exchange_adapter_enabled === fixture.expected_exchange_adapter_enabled, `${fixture.fixture_id} exchange adapter boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.dashboard`, "fixture_dashboard_boundary_matches", paperShadow.dashboard_api_stub?.read_only === fixture.expected_dashboard_read_only, `${fixture.fixture_id} dashboard boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.hash`, "fixture_regression_hash_locked", regressionHash.startsWith("sha256:"), `${fixture.fixture_id} regression hash is locked.`),
    ];
    const validation = summarizeValidation(validationItems);
    return {
      schema_version: "trading-paper-shadow-live-fixture-result.v1",
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

function summarizePaperShadowReport({ reportKind, paperShadow, shadowIntentResults, fixtureResults, validationItems, validation }) {
  return {
    paper_shadow_report_status: validation.valid ? "complete" : "blocked",
    report_kind: reportKind,
    phase_range: paperShadow.phase_range,
    phase_count: paperShadow.phase_coverage?.length ?? 0,
    complete_phase_count: (paperShadow.phase_coverage ?? []).filter((phase) => phase.status === "complete").length,
    paper_order_count: paperShadow.paper_order_ledger?.orders?.length ?? 0,
    partial_paper_order_count: (paperShadow.paper_order_ledger?.orders ?? []).filter((order) => order.status === "partial").length,
    rejected_paper_order_count: (paperShadow.paper_order_ledger?.orders ?? []).filter((order) => order.status === "rejected").length,
    shadow_order_intent_count: paperShadow.shadow_order_intents?.length ?? 0,
    shadow_order_intent_schema_valid_count: shadowIntentResults.filter((result) => result.validation.valid).length,
    real_order_count: paperShadow.no_order_shadow_mode?.real_order_count ?? 0,
    fixture_count: fixtureResults.length,
    passed_fixture_count: fixtureResults.filter((fixture) => fixture.validation.valid).length,
    locked_regression_hash_count: fixtureResults.filter((fixture) => fixture.regression_hash?.startsWith("sha256:")).length,
    validation_item_count: validationItems.length,
    validation_error_count: validation.errors.length,
    paper_simulation_only: paperShadow.safety_boundary?.paper_simulation_only === true,
    shadow_read_only: paperShadow.safety_boundary?.shadow_read_only === true,
    shadow_order_intent_non_executable: paperShadow.safety_boundary?.shadow_order_intent_non_executable === true,
    live_execution_allowed: paperShadow.safety_boundary?.live_execution_allowed === true,
    broker_adapter_enabled: paperShadow.safety_boundary?.broker_adapter_enabled === true,
    exchange_adapter_enabled: paperShadow.safety_boundary?.exchange_adapter_enabled === true,
    limited_live_enabled: paperShadow.promotion_criteria_to_limited_live?.limited_live_enabled === true,
    dashboard_read_only: paperShadow.dashboard_api_stub?.read_only === true,
  };
}

function renderPaperShadowReportMarkdown(result) {
  const label = result.report_kind === "paper" ? "Paper" : "Shadow";
  const lines = [];
  lines.push(`# Trading ${label} Report`);
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.paper_shadow_report_status}`);
  lines.push("");
  lines.push(`- Phase range: ${result.summary.phase_range}`);
  lines.push(`- Phases complete: ${result.summary.complete_phase_count}/${result.summary.phase_count}`);
  lines.push(`- Paper orders: ${result.summary.paper_order_count}`);
  lines.push(`- Shadow intents: ${result.summary.shadow_order_intent_count}`);
  lines.push(`- Real orders: ${result.summary.real_order_count}`);
  lines.push(`- Live execution allowed: ${result.summary.live_execution_allowed}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options = {}) {
  return {
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_PAPER_SHADOW_INPUTS.paperShadowPath),
    paper_shadow_schema_path: path.resolve(options.paperShadowSchemaPath ?? DEFAULT_TRADING_PAPER_SHADOW_INPUTS.paperShadowSchemaPath),
    paper_trade_schema_path: path.resolve(options.paperTradeSchemaPath ?? DEFAULT_TRADING_PAPER_SHADOW_INPUTS.paperTradeSchemaPath),
    order_intent_schema_path: path.resolve(options.orderIntentSchemaPath ?? DEFAULT_TRADING_PAPER_SHADOW_INPUTS.orderIntentSchemaPath),
    fill_reconciliation_schema_path: path.resolve(options.fillReconciliationSchemaPath ?? DEFAULT_TRADING_PAPER_SHADOW_INPUTS.fillReconciliationSchemaPath),
    signal_engine_path: path.resolve(options.signalEnginePath ?? DEFAULT_TRADING_PAPER_SHADOW_INPUTS.signalEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_PAPER_SHADOW_INPUTS.modelImprovementPath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_PAPER_SHADOW_INPUTS.riskEnginePath),
    golden_fixtures_path: path.resolve(options.goldenFixturesPath ?? DEFAULT_TRADING_PAPER_SHADOW_INPUTS.goldenFixturesPath),
    pack_manifest_path: path.resolve(options.packManifestPath ?? DEFAULT_TRADING_PAPER_SHADOW_INPUTS.packManifestPath),
    capability_manifest_path: path.resolve(options.capabilityManifestPath ?? DEFAULT_TRADING_PAPER_SHADOW_INPUTS.capabilityManifestPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_PAPER_SHADOW_INPUTS.packagePath),
    phase_ledger_path: path.resolve(options.phaseLedgerPath ?? DEFAULT_TRADING_PAPER_SHADOW_INPUTS.phaseLedgerPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--paper-shadow") parsed.paperShadowPath = argv[++index];
    else if (arg === "--paper-shadow-schema") parsed.paperShadowSchemaPath = argv[++index];
    else if (arg === "--paper-trade-schema") parsed.paperTradeSchemaPath = argv[++index];
    else if (arg === "--order-intent-schema") parsed.orderIntentSchemaPath = argv[++index];
    else if (arg === "--fill-reconciliation-schema") parsed.fillReconciliationSchemaPath = argv[++index];
    else if (arg === "--signal-engine") parsed.signalEnginePath = argv[++index];
    else if (arg === "--model-improvement") parsed.modelImprovementPath = argv[++index];
    else if (arg === "--risk-engine") parsed.riskEnginePath = argv[++index];
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

function printHelp(reportKind) {
  const defaultOutDir = reportKind === "paper" ? DEFAULT_TRADING_PAPER_REPORT_OUT_DIR : DEFAULT_TRADING_SHADOW_REPORT_OUT_DIR;
  console.log(`Usage: node scripts/trading-${reportKind}-report.mjs [options]

Options:
  --out-dir <folder>                    Output directory. Default: ${defaultOutDir}
  --run-at <iso>                        Deterministic generated_at timestamp.
  --paper-shadow <path>                 Paper/shadow fixture path.
  --paper-shadow-schema <path>          Paper/shadow schema path.
  --paper-trade-schema <path>           trading-paper-trade schema path.
  --order-intent-schema <path>          trading-order-intent schema path.
  --fill-reconciliation-schema <path>   trading-fill-reconciliation schema path.
  --signal-engine <path>                Signal engine fixture path.
  --model-improvement <path>            Model improvement fixture path.
  --risk-engine <path>                  Risk engine fixture path.
  --golden-fixtures <path>              Paper/shadow golden fixtures path.
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
    validation_item_id: `trading-paper-shadow.${slugify(itemPath)}.${checkId}`,
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
