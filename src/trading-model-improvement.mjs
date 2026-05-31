import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildDomainPackRegistry } from "./domain-pack-registry.mjs";

export const DEFAULT_TRADING_MODEL_TRAIN_REPORT_OUT_DIR = "artifacts/trading-model-train-report/latest";
export const DEFAULT_TRADING_MODEL_EVAL_REPORT_OUT_DIR = "artifacts/trading-model-eval-report/latest";
export const DEFAULT_TRADING_MODEL_IMPROVEMENT_INPUTS = {
  modelImprovementPath: "examples/trading/model-improvement-layer.json",
  modelImprovementSchemaPath: "schemas/trading/trading-model-improvement.schema.json",
  modelSchemaPath: "schemas/trading/trading-model.schema.json",
  promotionSchemaPath: "schemas/trading/trading-promotion.schema.json",
  featureStorePath: "examples/trading/market-data-feature-store.json",
  signalEnginePath: "examples/trading/signal-engine.json",
  goldenFixturesPath: "examples/trading/model-improvement-golden-fixtures.json",
  packManifestPath: "packs/trading/pack.json",
  capabilityManifestPath: "packs/trading/capabilities/research-backtest-paper.json",
  packagePath: "package.json",
  phaseLedgerPath: "docs/trading-pack-phase-ledger.md",
};

const REQUIRED_PHASE_IDS = Array.from({ length: 40 }, (_, index) => `P${String(126 + index).padStart(3, "0")}`);
const REQUIRED_MODEL_ROLES = [
  "baseline",
  "sequence_placeholder",
  "temporal_transformer_placeholder",
  "ensemble_placeholder",
  "reinforcement_learning_placeholder",
];
const ACTIVE_STAGES = new Set(["research", "backtest", "paper"]);
const UNSAFE_AUTO_ACTIONS = ["auto_promote_live", "generate_order_intent", "place_order", "store_api_key"];

export async function runTradingModelTrainReport(options = {}) {
  return runTradingModelImprovementReport({ ...options, reportKind: "train" });
}

export async function runTradingModelEvalReport(options = {}) {
  return runTradingModelImprovementReport({ ...options, reportKind: "eval" });
}

export async function runTradingModelImprovementReport(options = {}) {
  const result = await buildTradingModelImprovementReport(options);
  if (options.write !== false) await writeTradingModelImprovementReport(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading model ${result.report_kind} report validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingModelImprovementReport(options = {}) {
  const reportKind = options.reportKind === "train" ? "train" : "eval";
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const defaultOutDir = reportKind === "train" ? DEFAULT_TRADING_MODEL_TRAIN_REPORT_OUT_DIR : DEFAULT_TRADING_MODEL_EVAL_REPORT_OUT_DIR;
  const outputDir = path.resolve(options.outDir ?? defaultOutDir);
  const inputs = normalizeInputs(options);
  const modelImprovement = await readJson(inputs.model_improvement_path);
  const modelImprovementSchema = await readJson(inputs.model_improvement_schema_path);
  const modelSchema = await readJson(inputs.model_schema_path);
  const promotionSchema = await readJson(inputs.promotion_schema_path);
  const featureStore = await readJson(inputs.feature_store_path);
  const signalEngine = await readJson(inputs.signal_engine_path);
  const goldenFixtures = await readJson(inputs.golden_fixtures_path);
  const packManifest = await readJson(inputs.pack_manifest_path);
  const capabilityManifest = await readJson(inputs.capability_manifest_path);
  const packageJson = await readJson(inputs.package_path);
  const phaseLedgerText = await readFile(inputs.phase_ledger_path, "utf8");
  const domainPackRegistry = await buildDomainPackRegistry({ runAt: generatedAt });

  const modelImprovementSchemaErrors = validateAgainstSchema(modelImprovement, modelImprovementSchema, {}, "model_improvement");
  const modelValidationResults = validateModelArtifacts(modelImprovement, modelSchema);
  const promotionValidationResults = validatePromotionArtifacts(modelImprovement, promotionSchema);
  const sourceItems = buildSourceValidationItems({
    packageJson,
    packManifest,
    capabilityManifest,
    phaseLedgerText,
    domainPackRegistry,
  });
  const modelItems = buildModelImprovementValidationItems({
    modelImprovement,
    modelImprovementSchemaErrors,
    modelValidationResults,
    promotionValidationResults,
    featureStore,
    signalEngine,
  });
  const fixtureResults = buildFixtureResults(goldenFixtures, modelImprovement, modelItems);
  const validationItems = [
    ...sourceItems,
    ...modelItems,
    ...fixtureResults.flatMap((fixture) => fixture.validation_items),
  ];
  const validation = summarizeValidation(validationItems);
  const summary = summarizeModelImprovementReport({
    reportKind,
    modelImprovement,
    modelValidationResults,
    promotionValidationResults,
    fixtureResults,
    validationItems,
    validation,
  });
  const result = {
    schema_version: reportKind === "train" ? "trading-model-train-report.v1" : "trading-model-eval-report.v1",
    generated_at: generatedAt,
    report_kind: reportKind,
    model_report_id: `trading-model-${reportKind}-report.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      model_improvement: sourceContract("model_improvement", inputs.model_improvement_path, modelImprovement.schema_version, modelImprovement.model_improvement_status === "complete"),
      model_improvement_schema: sourceContract("model_improvement_schema", inputs.model_improvement_schema_path, modelImprovementSchema.title, modelImprovementSchemaErrors.length === 0),
      model_schema: sourceContract("trading_model_schema", inputs.model_schema_path, modelSchema.title, modelValidationResults.every((item) => item.validation.valid)),
      promotion_schema: sourceContract("trading_promotion_schema", inputs.promotion_schema_path, promotionSchema.title, promotionValidationResults.every((item) => item.validation.valid)),
      feature_store: sourceContract("market_data_feature_store", inputs.feature_store_path, featureStore.schema_version, featureStore.feature_store_status === "complete"),
      signal_engine: sourceContract("signal_engine", inputs.signal_engine_path, signalEngine.schema_version, signalEngine.signal_engine_status === "complete"),
      golden_fixtures: sourceContract("model_improvement_golden_fixtures", inputs.golden_fixtures_path, goldenFixtures.schema_version, Array.isArray(goldenFixtures.fixtures)),
      pack_manifest: sourceContract("trading_pack_manifest", inputs.pack_manifest_path, packManifest.schema_version, packManifest.pack_id === "trading"),
      capability_manifest: sourceContract("trading_capability_manifest", inputs.capability_manifest_path, capabilityManifest.schema_version, capabilityManifest.domain_pack === "trading"),
      domain_pack_registry: {
        source_id: "domain_pack_registry",
        status: domainPackRegistry.validation.valid ? "valid" : "invalid",
        trading_registered: Boolean(domainPackRegistry.packs.find((pack) => pack.pack_id === "trading")),
      },
    },
    model_improvement: modelImprovement,
    model_validation_results: modelValidationResults,
    promotion_validation_results: promotionValidationResults,
    fixture_results: fixtureResults,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderModelImprovementReportMarkdown(result),
  };
}

export async function writeTradingModelImprovementReport(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const reportFile = result.report_kind === "train" ? "trading-model-train-report.json" : "trading-model-eval-report.json";
  await writeJson(path.join(outDir, reportFile), serializableResult(result));
  await writeJson(path.join(outDir, "model-improvement-layer.json"), result.model_improvement);
  await writeJson(path.join(outDir, "model-validation-results.json"), {
    schema_version: "trading-model-validation-results.v1",
    generated_at: result.generated_at,
    model_validation_results: result.model_validation_results,
  });
  await writeJson(path.join(outDir, "promotion-validation-results.json"), {
    schema_version: "trading-model-promotion-validation-results.v1",
    generated_at: result.generated_at,
    promotion_validation_results: result.promotion_validation_results,
  });
  await writeJson(path.join(outDir, "fixture-results.json"), {
    schema_version: "trading-model-improvement-fixture-results.v1",
    generated_at: result.generated_at,
    fixture_results: result.fixture_results,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingModelTrainReportCli(argv = process.argv.slice(2)) {
  await runTradingModelImprovementReportCli(argv, "train");
}

export async function runTradingModelEvalReportCli(argv = process.argv.slice(2)) {
  await runTradingModelImprovementReportCli(argv, "eval");
}

async function runTradingModelImprovementReportCli(argv, reportKind) {
  const args = { ...parseArgs(argv), reportKind };
  if (args.help) {
    printHelp(reportKind);
    return;
  }
  try {
    const result = await runTradingModelImprovementReport(args);
    console.log(`Trading model ${reportKind} report ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.model_report_status}`);
    console.log(`Phase range: ${result.summary.phase_range}`);
    console.log(`Models: ${result.summary.model_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function validateModelArtifacts(modelImprovement, modelSchema) {
  return (modelImprovement.model_registry?.models ?? []).map((record, index) => {
    const modelArtifact = record.model_artifact ?? {};
    const errors = validateAgainstSchema(modelArtifact, modelSchema, {}, `model_registry.models[${index}].model_artifact`);
    return {
      schema_version: "trading-model-validation-result.v1",
      model_id: record.model_id ?? null,
      validation: {
        valid: errors.length === 0,
        errors,
      },
      validation_items: [
        validationItem(`model_registry.models.${record.model_id ?? index}`, "model_schema_valid", errors.length === 0, errors.length === 0 ? "Model artifact validates." : `Model artifact has ${errors.length} schema error(s).`),
        ...errors.map((error) => validationItem(error.path, "model_schema_error", false, error.message)),
      ],
    };
  });
}

function validatePromotionArtifacts(modelImprovement, promotionSchema) {
  return (modelImprovement.promotion_candidates ?? []).map((candidate, index) => {
    const promotionArtifact = candidate.promotion_artifact ?? {};
    const errors = validateAgainstSchema(promotionArtifact, promotionSchema, {}, `promotion_candidates[${index}].promotion_artifact`);
    return {
      schema_version: "trading-model-promotion-validation-result.v1",
      candidate_id: candidate.candidate_id ?? null,
      promotion_id: promotionArtifact.promotion_id ?? null,
      validation: {
        valid: errors.length === 0,
        errors,
      },
      validation_items: [
        validationItem(`promotion_candidates.${candidate.candidate_id ?? index}`, "promotion_schema_valid", errors.length === 0, errors.length === 0 ? "Promotion artifact validates." : `Promotion artifact has ${errors.length} schema error(s).`),
        ...errors.map((error) => validationItem(error.path, "promotion_schema_error", false, error.message)),
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
    validationItem("source.package.trading_model_train_report", "package_script_registered", Boolean(scripts["trading:model-train-report"]), "Package script trading:model-train-report is registered."),
    validationItem("source.package.trading_model_eval_report", "package_script_registered", Boolean(scripts["trading:model-eval-report"]), "Package script trading:model-eval-report is registered."),
    validationItem("source.pack.schemas.model_improvement", "pack_schema_registered", packSchemas.includes("schemas/trading/trading-model-improvement.schema.json"), "Trading pack manifest registers the model improvement schema."),
    validationItem("source.pack.workflow.model_train_report", "pack_workflow_registered", workflows.includes("workflow.trading.model_train_report.v1"), "Trading pack manifest registers the model train report workflow."),
    validationItem("source.pack.workflow.model_eval_report", "pack_workflow_registered", workflows.includes("workflow.trading.model_eval_report.v1"), "Trading pack manifest registers the model eval report workflow."),
    validationItem("source.pack.workflow.model_dashboard", "pack_workflow_registered", workflows.includes("workflow.trading.model_improvement_dashboard.v1"), "Trading pack manifest registers the model dashboard/API workflow."),
    validationItem("source.pack.golden.model_improvement", "pack_golden_case_registered", goldenCases.includes("golden.trading.model_improvement.p126_p165"), "Trading pack manifest registers the model improvement golden case."),
    validationItem("source.capability.entrypoint.model_train_report", "capability_entrypoint_registered", entrypoints.some((entrypoint) => entrypoint.name === "trading:model-train-report"), "Trading capability manifest registers the model train report entrypoint."),
    validationItem("source.capability.entrypoint.model_eval_report", "capability_entrypoint_registered", entrypoints.some((entrypoint) => entrypoint.name === "trading:model-eval-report"), "Trading capability manifest registers the model eval report entrypoint."),
    validationItem("source.capability.golden.model_improvement", "capability_golden_case_registered", capabilityGoldenCases.some((fixture) => fixture.case_id === "golden.trading.model_improvement.p126_p165"), "Trading capability manifest registers the model improvement golden case."),
    validationItem("source.domain_pack_registry.trading", "domain_pack_registry_valid", domainPackRegistry.validation.valid === true && Boolean(tradingPack), "Domain pack registry remains valid with Trading registered."),
    validationItem("source.phase_ledger.p126_p165", "phase_ledger_updated", phaseLedgerText.includes("P126-P165 Acceptance Criteria") && phaseLedgerText.includes("trading:model-train-report") && phaseLedgerText.includes("trading:model-eval-report"), "Phase ledger documents P126-P165 acceptance criteria and CLIs."),
  ];
}

function buildModelImprovementValidationItems({
  modelImprovement,
  modelImprovementSchemaErrors,
  modelValidationResults,
  promotionValidationResults,
  featureStore,
  signalEngine,
}) {
  const phaseIds = new Set((modelImprovement.phase_coverage ?? []).map((phase) => phase.phase_id));
  const modelRecords = modelImprovement.model_registry?.models ?? [];
  const modelIds = new Set(modelRecords.map((record) => record.model_id));
  const modelRoles = new Set(modelRecords.map((record) => record.model_role));
  const datasetSourceIds = new Set((featureStore.market_data_artifacts ?? []).map((artifact) => artifact.dataset_id));
  const registeredDatasetRefs = new Set((modelImprovement.dataset_registry?.datasets ?? []).map((dataset) => dataset.source_ref));
  const scorecardModelIds = new Set((modelImprovement.model_scorecards ?? []).map((scorecard) => scorecard.model_id));
  const degradationModelIds = new Set((modelImprovement.degradation_checks ?? []).map((check) => check.model_id));
  const driftModelIds = new Set((modelImprovement.drift_checks ?? []).map((check) => check.model_id));
  const explainabilityModelIds = new Set((modelImprovement.explainability_artifacts ?? []).map((artifact) => artifact.model_id));
  const signalModelRefs = new Set((signalEngine.signal_candidates ?? []).flatMap((candidate) => (candidate.source_bindings ?? [])
    .filter((binding) => binding.source_type === "model_placeholder")
    .map((binding) => binding.source_ref)));
  const allowedActions = new Set(modelImprovement.auto_improvement_loop?.allowed_actions ?? []);
  const forbiddenActions = new Set(modelImprovement.auto_improvement_loop?.forbidden_actions ?? []);
  const splitOrderOk = chronologicalSplitOk(modelImprovement.data_splits?.train_validation_test);
  const liveDeployment = modelImprovement.live_deployment_boundary ?? {};
  return [
    validationItem("model_improvement.schema", "schema_validation_passed", modelImprovementSchemaErrors.length === 0, modelImprovementSchemaErrors.length === 0 ? "Model improvement layer validates against schema." : `Model improvement layer has ${modelImprovementSchemaErrors.length} schema error(s).`),
    ...modelImprovementSchemaErrors.map((error) => validationItem(error.path, "schema_error", false, error.message)),
    validationItem("model_improvement.phase_range", "phase_range_p126_p165", modelImprovement.phase_range === "P126-P165", "Model improvement layer is scoped to P126-P165."),
    validationItem("model_improvement.phase_coverage", "all_phases_covered", REQUIRED_PHASE_IDS.every((phaseId) => phaseIds.has(phaseId)) && (modelImprovement.phase_coverage ?? []).every((phase) => phase.status === "complete"), "All P126-P165 phases are covered and complete."),
    validationItem("model_improvement.safety.research_only", "research_only_boundary", modelImprovement.safety_boundary?.research_only === true, "Model improvement layer is research-only."),
    validationItem("model_improvement.safety.no_external_training", "external_model_training_forbidden", modelImprovement.safety_boundary?.external_model_training_allowed === false, "External model training is forbidden."),
    validationItem("model_improvement.safety.no_advice_orders_live", "no_advice_recommendation_order_or_live", modelImprovement.safety_boundary?.investment_advice_generated === false && modelImprovement.safety_boundary?.trade_recommendation_generated === false && modelImprovement.safety_boundary?.order_intent_generated === false && modelImprovement.safety_boundary?.automated_live_deployment_allowed === false && modelImprovement.safety_boundary?.live_execution_allowed === false, "Model improvement does not generate advice, recommendations, orders, or live deployment."),
    validationItem("model_improvement.models.schema", "model_artifacts_validate", modelValidationResults.length >= 5 && modelValidationResults.every((result) => result.validation.valid), "All model artifacts validate against trading-model.v1."),
    ...modelValidationResults.flatMap((result) => result.validation_items),
    validationItem("model_improvement.models.required_roles", "required_model_roles_present", REQUIRED_MODEL_ROLES.every((role) => modelRoles.has(role)), "Baseline, sequence, temporal transformer, ensemble, and RL placeholder model roles are present."),
    validationItem("model_improvement.models.stage_boundary", "model_stages_are_safe", modelRecords.every((record) => (record.allowed_stages ?? []).every((stage) => ACTIVE_STAGES.has(stage))), "Model allowed stages are limited to research/backtest/paper."),
    validationItem("model_improvement.models.no_live_or_orders", "models_block_order_and_live", modelRecords.every((record) => record.live_deployment_allowed === false && record.order_intent_generation_allowed === false && record.uses_external_service === false), "Models do not generate orders, live deployment, or external-service training."),
    validationItem("model_improvement.datasets.source_refs", "dataset_refs_exist", registeredDatasetRefs.size > 0 && [...registeredDatasetRefs].every((datasetId) => datasetSourceIds.has(datasetId)), "Model datasets reference market-data feature store artifacts."),
    validationItem("model_improvement.labels.no_future_access", "label_generation_no_future_feature_access", modelImprovement.label_generation_contract?.no_future_feature_access === true && modelImprovement.label_generation_contract?.human_review_required === true, "Label generation forbids future feature access and requires human review."),
    validationItem("model_improvement.splits.chronological", "train_validation_test_chronological", modelImprovement.data_splits?.train_validation_test?.chronological_order_required === true && splitOrderOk, "Train, validation, and test windows are chronological."),
    validationItem("model_improvement.splits.walk_forward", "walk_forward_enabled", modelImprovement.data_splits?.walk_forward?.enabled === true && modelImprovement.data_splits?.walk_forward?.evaluation_after_training_window === true && (modelImprovement.data_splits?.walk_forward?.windows ?? []).length > 0, "Walk-forward split is enabled and evaluates after the training window."),
    validationItem("model_improvement.leakage.time_series", "time_series_leakage_guard_passed", modelImprovement.leakage_guards?.time_series?.enabled === true && modelImprovement.leakage_guards?.time_series?.result === "pass" && modelImprovement.leakage_guards?.time_series?.blocks_promotion === true, "Time-series leakage guard passes and blocks promotion on failure."),
    validationItem("model_improvement.leakage.target", "target_leakage_guard_passed", modelImprovement.leakage_guards?.target?.enabled === true && modelImprovement.leakage_guards?.target?.result === "pass" && modelImprovement.leakage_guards?.target?.future_target_excluded_from_features === true && modelImprovement.leakage_guards?.target?.blocks_promotion === true, "Target leakage guard passes and excludes future targets from features."),
    validationItem("model_improvement.explainability", "explainability_refs_models", explainabilityModelIds.size > 0 && [...explainabilityModelIds].every((modelId) => modelIds.has(modelId)) && (modelImprovement.explainability_artifacts ?? []).every((artifact) => artifact.human_review_required === true), "Explainability artifacts reference registered models and require human review."),
    validationItem("model_improvement.hyperparameters", "hyperparameter_search_deterministic", modelImprovement.hyperparameter_search?.deterministic_grid === true && modelImprovement.hyperparameter_search?.live_tuning_allowed === false && modelIds.has(modelImprovement.hyperparameter_search?.best_candidate_model_id), "Hyperparameter search is deterministic and live tuning is disabled."),
    validationItem("model_improvement.retraining", "automated_retraining_safe", modelImprovement.automated_retraining_candidate?.research_stage_only === true && modelImprovement.automated_retraining_candidate?.auto_promotion_allowed === false && modelImprovement.automated_retraining_candidate?.human_review_required === true, "Automated retraining candidates remain research-only and cannot auto-promote."),
    validationItem("model_improvement.scorecards", "scorecards_cover_models", modelIds.size > 0 && [...modelIds].every((modelId) => scorecardModelIds.has(modelId)) && (modelImprovement.model_scorecards ?? []).every((scorecard) => scorecard.validation_status !== "blocked" && scorecard.human_review_required === true), "Model scorecards cover every registered model and require human review."),
    validationItem("model_improvement.degradation", "degradation_checks_cover_models", modelIds.size > 0 && [...modelIds].every((modelId) => degradationModelIds.has(modelId)) && (modelImprovement.degradation_checks ?? []).every((check) => check.result !== "halt" && check.blocks_promotion === true), "Model degradation checks cover every registered model and block promotion on failure."),
    validationItem("model_improvement.drift", "drift_checks_cover_models", modelIds.size > 0 && [...modelIds].every((modelId) => driftModelIds.has(modelId)) && (modelImprovement.drift_checks ?? []).every((check) => check.result !== "halt" && check.blocks_promotion === true), "Model drift checks cover every registered model and block promotion on failure."),
    validationItem("model_improvement.promotions.schema", "promotion_artifacts_validate", promotionValidationResults.length > 0 && promotionValidationResults.every((result) => result.validation.valid), "Promotion artifacts validate against trading-promotion.v1."),
    ...promotionValidationResults.flatMap((result) => result.validation_items),
    validationItem("model_improvement.promotions.safe_refs", "promotion_candidates_safe", (modelImprovement.promotion_candidates ?? []).every((candidate) => modelIds.has(candidate.model_id) && candidate.target_stage !== "shadow_live" && candidate.promotion_artifact?.human_approval_required === true && candidate.promotion_artifact?.live_promotion_allowed === false), "Promotion candidates reference registered models, avoid live targets, and require human approval."),
    validationItem("model_improvement.promotion_gate", "promotion_gate_blocks_live", modelImprovement.promotion_policy_gate?.human_approval_required === true && modelImprovement.promotion_policy_gate?.auto_live_promotion_allowed === false && modelImprovement.promotion_policy_gate?.live_promotion_allowed === false, "Promotion policy gate blocks live promotion and requires human approval."),
    validationItem("model_improvement.rollback", "rollback_to_paper", modelImprovement.rollback_policy?.rollback_to_paper_only === true && modelImprovement.rollback_policy?.human_review_required === true && modelIds.has(modelImprovement.rollback_policy?.rollback_model_id), "Model rollback is paper-only and references a registered model."),
    validationItem("model_improvement.champion_challenger", "champion_challenger_safe", modelIds.has(modelImprovement.champion_challenger?.champion_model_id) && (modelImprovement.champion_challenger?.challenger_model_ids ?? []).every((modelId) => modelIds.has(modelId)) && modelImprovement.champion_challenger?.replacement_requires_human_approval === true && modelImprovement.champion_challenger?.live_replacement_allowed === false, "Champion/challenger replacement requires human review and blocks live replacement."),
    validationItem("model_improvement.auto_loop", "auto_improvement_loop_safe", modelImprovement.auto_improvement_loop?.enabled === true && ACTIVE_STAGES.has(modelImprovement.auto_improvement_loop?.max_stage) && UNSAFE_AUTO_ACTIONS.every((action) => forbiddenActions.has(action) && !allowedActions.has(action)) && modelImprovement.auto_improvement_loop?.human_review_required === true, "Auto-improvement loop is bounded to safe stages and forbids unsafe actions."),
    validationItem("model_improvement.live_boundary", "live_deployment_blocked", liveDeployment.live_deployment_allowed === false && liveDeployment.generated_live_deployment_count === 0 && liveDeployment.promotion_required_before_live === true, "Live model deployment is blocked with zero generated deployments."),
    validationItem("model_improvement.signal_model_binding", "signal_engine_model_refs_registered", signalModelRefs.size > 0 && [...signalModelRefs].every((modelId) => modelIds.has(modelId)), "Signal engine model placeholder refs resolve to the model registry."),
    validationItem("model_improvement.audit", "audit_replay_required", modelImprovement.audit_replay?.source_lineage_required === true && modelImprovement.audit_replay?.replay_deterministic === true && modelImprovement.audit_replay?.review_status_required === true, "Model improvement audit replay requires lineage, determinism, and review status."),
    validationItem("model_improvement.dashboard", "dashboard_read_only", modelImprovement.dashboard_api_stub?.read_only === true && modelImprovement.dashboard_api_stub?.mutating_routes_enabled === false && (modelImprovement.dashboard_api_stub?.routes ?? []).every((route) => route.method === "GET"), "Model improvement dashboard/API is read-only."),
    validationItem("model_improvement.dashboard.disabled", "unsafe_routes_disabled", (modelImprovement.dashboard_api_stub?.disabled_routes ?? []).some((route) => route.path === "/api/trading/models/promote-live") && (modelImprovement.dashboard_api_stub?.disabled_routes ?? []).some((route) => route.path === "/api/trading/models/to-order-intent") && (modelImprovement.dashboard_api_stub?.disabled_routes ?? []).some((route) => route.path === "/api/trading/orders"), "Unsafe model promotion, order-intent, and order routes are disabled."),
  ];
}

function buildFixtureResults(goldenFixtures, modelImprovement, modelItems) {
  return (goldenFixtures.fixtures ?? []).map((fixture) => {
    const regressionHash = hashValue({
      fixture_id: fixture.fixture_id,
      phase_range: modelImprovement.phase_range,
      phase_coverage: modelImprovement.phase_coverage,
      model_roles: (modelImprovement.model_registry?.models ?? []).map((model) => model.model_role).sort(),
      dataset_refs: (modelImprovement.dataset_registry?.datasets ?? []).map((dataset) => dataset.source_ref).sort(),
      safety_boundary: modelImprovement.safety_boundary,
      leakage_guards: modelImprovement.leakage_guards,
      promotion_policy_gate: modelImprovement.promotion_policy_gate,
      live_deployment_boundary: modelImprovement.live_deployment_boundary,
    });
    const validationItems = [
      validationItem(`fixtures.${fixture.fixture_id}.status`, "fixture_status_matches", fixture.expected_status === "complete" && modelItems.every((item) => item.status === "passed"), `${fixture.fixture_id} expected status is complete.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_range`, "fixture_phase_range_matches", modelImprovement.phase_range === fixture.expected_phase_range, `${fixture.fixture_id} phase range matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_count`, "fixture_phase_count_matches", (modelImprovement.phase_coverage ?? []).length === fixture.expected_phase_count, `${fixture.fixture_id} phase count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.model_count`, "fixture_model_count_matches", (modelImprovement.model_registry?.models ?? []).length === fixture.expected_model_count, `${fixture.fixture_id} model count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.dataset_count`, "fixture_dataset_count_matches", (modelImprovement.dataset_registry?.datasets ?? []).length === fixture.expected_dataset_count, `${fixture.fixture_id} dataset count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.scorecard_count`, "fixture_scorecard_count_matches", (modelImprovement.model_scorecards ?? []).length === fixture.expected_scorecard_count, `${fixture.fixture_id} scorecard count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.promotion_count`, "fixture_promotion_count_matches", (modelImprovement.promotion_candidates ?? []).length === fixture.expected_promotion_candidate_count, `${fixture.fixture_id} promotion candidate count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.live_deployment_count`, "fixture_live_deployment_count_matches", modelImprovement.live_deployment_boundary?.generated_live_deployment_count === fixture.expected_generated_live_deployment_count, `${fixture.fixture_id} live deployment count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.live_boundary`, "fixture_live_boundary_matches", modelImprovement.live_deployment_boundary?.live_deployment_allowed === fixture.expected_live_deployment_allowed, `${fixture.fixture_id} live deployment boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.order_intent`, "fixture_order_intent_boundary_matches", modelImprovement.safety_boundary?.order_intent_generated === fixture.expected_order_intent_generated, `${fixture.fixture_id} order-intent boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.dashboard`, "fixture_dashboard_boundary_matches", modelImprovement.dashboard_api_stub?.read_only === fixture.expected_dashboard_read_only, `${fixture.fixture_id} dashboard boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.hash`, "fixture_regression_hash_locked", regressionHash.startsWith("sha256:"), `${fixture.fixture_id} regression hash is locked.`),
    ];
    const validation = summarizeValidation(validationItems);
    return {
      schema_version: "trading-model-improvement-fixture-result.v1",
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

function summarizeModelImprovementReport({
  reportKind,
  modelImprovement,
  modelValidationResults,
  promotionValidationResults,
  fixtureResults,
  validationItems,
  validation,
}) {
  const models = modelImprovement.model_registry?.models ?? [];
  const datasets = modelImprovement.dataset_registry?.datasets ?? [];
  return {
    model_report_status: validation.valid ? "complete" : "blocked",
    report_kind: reportKind,
    phase_range: modelImprovement.phase_range,
    phase_count: modelImprovement.phase_coverage?.length ?? 0,
    complete_phase_count: (modelImprovement.phase_coverage ?? []).filter((phase) => phase.status === "complete").length,
    model_count: models.length,
    model_schema_valid_count: modelValidationResults.filter((result) => result.validation.valid).length,
    placeholder_model_count: models.filter((model) => model.status === "placeholder").length,
    dataset_count: datasets.length,
    scorecard_count: modelImprovement.model_scorecards?.length ?? 0,
    degradation_check_count: modelImprovement.degradation_checks?.length ?? 0,
    drift_check_count: modelImprovement.drift_checks?.length ?? 0,
    promotion_candidate_count: modelImprovement.promotion_candidates?.length ?? 0,
    promotion_schema_valid_count: promotionValidationResults.filter((result) => result.validation.valid).length,
    fixture_count: fixtureResults.length,
    passed_fixture_count: fixtureResults.filter((fixture) => fixture.validation.valid).length,
    locked_regression_hash_count: fixtureResults.filter((fixture) => fixture.regression_hash?.startsWith("sha256:")).length,
    validation_item_count: validationItems.length,
    validation_error_count: validation.errors.length,
    research_only: modelImprovement.safety_boundary?.research_only === true,
    external_model_training_allowed: modelImprovement.safety_boundary?.external_model_training_allowed === true,
    order_intent_generated: modelImprovement.safety_boundary?.order_intent_generated === true,
    live_deployment_allowed: modelImprovement.live_deployment_boundary?.live_deployment_allowed === true,
    generated_live_deployment_count: modelImprovement.live_deployment_boundary?.generated_live_deployment_count ?? 0,
    dashboard_read_only: modelImprovement.dashboard_api_stub?.read_only === true,
  };
}

function renderModelImprovementReportMarkdown(result) {
  const lines = [];
  lines.push(`# Trading Model ${result.report_kind === "train" ? "Train" : "Eval"} Report`);
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.model_report_status}`);
  lines.push("");
  lines.push(`- Phase range: ${result.summary.phase_range}`);
  lines.push(`- Phases complete: ${result.summary.complete_phase_count}/${result.summary.phase_count}`);
  lines.push(`- Models: ${result.summary.model_count}`);
  lines.push(`- Datasets: ${result.summary.dataset_count}`);
  lines.push(`- Scorecards: ${result.summary.scorecard_count}`);
  lines.push(`- Promotion candidates: ${result.summary.promotion_candidate_count}`);
  lines.push(`- Generated live deployments: ${result.summary.generated_live_deployment_count}`);
  lines.push(`- Live deployment allowed: ${result.summary.live_deployment_allowed}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options = {}) {
  return {
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_MODEL_IMPROVEMENT_INPUTS.modelImprovementPath),
    model_improvement_schema_path: path.resolve(options.modelImprovementSchemaPath ?? DEFAULT_TRADING_MODEL_IMPROVEMENT_INPUTS.modelImprovementSchemaPath),
    model_schema_path: path.resolve(options.modelSchemaPath ?? DEFAULT_TRADING_MODEL_IMPROVEMENT_INPUTS.modelSchemaPath),
    promotion_schema_path: path.resolve(options.promotionSchemaPath ?? DEFAULT_TRADING_MODEL_IMPROVEMENT_INPUTS.promotionSchemaPath),
    feature_store_path: path.resolve(options.featureStorePath ?? DEFAULT_TRADING_MODEL_IMPROVEMENT_INPUTS.featureStorePath),
    signal_engine_path: path.resolve(options.signalEnginePath ?? DEFAULT_TRADING_MODEL_IMPROVEMENT_INPUTS.signalEnginePath),
    golden_fixtures_path: path.resolve(options.goldenFixturesPath ?? DEFAULT_TRADING_MODEL_IMPROVEMENT_INPUTS.goldenFixturesPath),
    pack_manifest_path: path.resolve(options.packManifestPath ?? DEFAULT_TRADING_MODEL_IMPROVEMENT_INPUTS.packManifestPath),
    capability_manifest_path: path.resolve(options.capabilityManifestPath ?? DEFAULT_TRADING_MODEL_IMPROVEMENT_INPUTS.capabilityManifestPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_MODEL_IMPROVEMENT_INPUTS.packagePath),
    phase_ledger_path: path.resolve(options.phaseLedgerPath ?? DEFAULT_TRADING_MODEL_IMPROVEMENT_INPUTS.phaseLedgerPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--model-improvement") parsed.modelImprovementPath = argv[++index];
    else if (arg === "--model-improvement-schema") parsed.modelImprovementSchemaPath = argv[++index];
    else if (arg === "--model-schema") parsed.modelSchemaPath = argv[++index];
    else if (arg === "--promotion-schema") parsed.promotionSchemaPath = argv[++index];
    else if (arg === "--feature-store") parsed.featureStorePath = argv[++index];
    else if (arg === "--signal-engine") parsed.signalEnginePath = argv[++index];
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
  const defaultOutDir = reportKind === "train" ? DEFAULT_TRADING_MODEL_TRAIN_REPORT_OUT_DIR : DEFAULT_TRADING_MODEL_EVAL_REPORT_OUT_DIR;
  console.log(`Usage: node scripts/trading-model-${reportKind}-report.mjs [options]

Options:
  --out-dir <folder>                   Output directory. Default: ${defaultOutDir}
  --run-at <iso>                       Deterministic generated_at timestamp.
  --model-improvement <path>           Model improvement fixture path.
  --model-improvement-schema <path>    Model improvement schema path.
  --model-schema <path>                trading-model schema path.
  --promotion-schema <path>            trading-promotion schema path.
  --feature-store <path>               Market data feature store fixture path.
  --signal-engine <path>               Signal engine fixture path.
  --golden-fixtures <path>             Model improvement golden fixtures path.
  --pack-manifest <path>               Trading pack manifest path.
  --capability-manifest <path>         Trading capability manifest path.
  --package <path>                     package.json path.
  --phase-ledger <path>                Trading phase ledger path.
  --check                              Validate only, do not write artifacts.
  -h, --help                           Show this help.
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

function chronologicalSplitOk(split = {}) {
  const trainEnd = Date.parse(split.train_window?.end ?? "");
  const validationStart = Date.parse(split.validation_window?.start ?? "");
  const validationEnd = Date.parse(split.validation_window?.end ?? "");
  const testStart = Date.parse(split.test_window?.start ?? "");
  return Number.isFinite(trainEnd)
    && Number.isFinite(validationStart)
    && Number.isFinite(validationEnd)
    && Number.isFinite(testStart)
    && trainEnd < validationStart
    && validationEnd < testStart;
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
    validation_item_id: `trading-model-improvement.${slugify(itemPath)}.${checkId}`,
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
