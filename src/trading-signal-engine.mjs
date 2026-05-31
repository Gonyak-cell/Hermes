import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildDomainPackRegistry } from "./domain-pack-registry.mjs";

export const DEFAULT_TRADING_SIGNAL_REPORT_OUT_DIR = "artifacts/trading-signal-report/latest";
export const DEFAULT_TRADING_SIGNAL_ENGINE_INPUTS = {
  signalEnginePath: "examples/trading/signal-engine.json",
  signalEngineSchemaPath: "schemas/trading/trading-signal-engine.schema.json",
  signalSchemaPath: "schemas/trading/trading-signal.schema.json",
  strategyTaxonomyPath: "examples/trading/strategy-archetype-registry.json",
  featureStorePath: "examples/trading/market-data-feature-store.json",
  goldenFixturesPath: "examples/trading/signal-engine-golden-fixtures.json",
  packManifestPath: "packs/trading/pack.json",
  capabilityManifestPath: "packs/trading/capabilities/research-backtest-paper.json",
  packagePath: "package.json",
  phaseLedgerPath: "docs/trading-pack-phase-ledger.md",
};

const REQUIRED_PHASE_IDS = Array.from({ length: 35 }, (_, index) => `P${String(91 + index).padStart(3, "0")}`);
const REQUIRED_ADAPTER_TYPES = [
  "rule_based",
  "technical_indicator",
  "factor",
  "macro",
  "event_driven",
  "crypto_on_chain_placeholder",
  "sentiment_placeholder",
  "dl_model",
];
const ACTIVE_STAGES = new Set(["research", "backtest", "paper"]);

export async function runTradingSignalReport(options = {}) {
  const result = await buildTradingSignalReport(options);
  if (options.write !== false) await writeTradingSignalReport(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading signal report validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSignalReport(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SIGNAL_REPORT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const signalEngine = await readJson(inputs.signal_engine_path);
  const signalEngineSchema = await readJson(inputs.signal_engine_schema_path);
  const signalSchema = await readJson(inputs.signal_schema_path);
  const strategyTaxonomy = await readJson(inputs.strategy_taxonomy_path);
  const featureStore = await readJson(inputs.feature_store_path);
  const goldenFixtures = await readJson(inputs.golden_fixtures_path);
  const packManifest = await readJson(inputs.pack_manifest_path);
  const capabilityManifest = await readJson(inputs.capability_manifest_path);
  const packageJson = await readJson(inputs.package_path);
  const phaseLedgerText = await readFile(inputs.phase_ledger_path, "utf8");
  const domainPackRegistry = await buildDomainPackRegistry({ runAt: generatedAt });

  const signalEngineSchemaErrors = validateAgainstSchema(signalEngine, signalEngineSchema, {}, "signal_engine");
  const signalValidationResults = validateSignalArtifacts(signalEngine, signalSchema);
  const sourceItems = buildSourceValidationItems({
    packageJson,
    packManifest,
    capabilityManifest,
    phaseLedgerText,
    domainPackRegistry,
  });
  const signalItems = buildSignalEngineValidationItems({
    signalEngine,
    signalEngineSchemaErrors,
    signalValidationResults,
    strategyTaxonomy,
    featureStore,
  });
  const fixtureResults = buildFixtureResults(goldenFixtures, signalEngine, signalItems);
  const validationItems = [
    ...sourceItems,
    ...signalItems,
    ...fixtureResults.flatMap((fixture) => fixture.validation_items),
  ];
  const validation = summarizeValidation(validationItems);
  const summary = summarizeSignalReport({ signalEngine, signalValidationResults, fixtureResults, validationItems, validation });
  const result = {
    schema_version: "trading-signal-report.v1",
    generated_at: generatedAt,
    signal_report_id: `trading-signal-report.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      signal_engine: sourceContract("signal_engine", inputs.signal_engine_path, signalEngine.schema_version, signalEngine.signal_engine_status === "complete"),
      signal_engine_schema: sourceContract("signal_engine_schema", inputs.signal_engine_schema_path, signalEngineSchema.title, signalEngineSchemaErrors.length === 0),
      signal_schema: sourceContract("trading_signal_schema", inputs.signal_schema_path, signalSchema.title, signalValidationResults.every((item) => item.validation.valid)),
      strategy_taxonomy: sourceContract("strategy_taxonomy", inputs.strategy_taxonomy_path, strategyTaxonomy.schema_version, strategyTaxonomy.taxonomy_status === "complete"),
      feature_store: sourceContract("market_data_feature_store", inputs.feature_store_path, featureStore.schema_version, featureStore.feature_store_status === "complete"),
      golden_fixtures: sourceContract("signal_engine_golden_fixtures", inputs.golden_fixtures_path, goldenFixtures.schema_version, Array.isArray(goldenFixtures.fixtures)),
      pack_manifest: sourceContract("trading_pack_manifest", inputs.pack_manifest_path, packManifest.schema_version, packManifest.pack_id === "trading"),
      capability_manifest: sourceContract("trading_capability_manifest", inputs.capability_manifest_path, capabilityManifest.schema_version, capabilityManifest.domain_pack === "trading"),
      domain_pack_registry: {
        source_id: "domain_pack_registry",
        status: domainPackRegistry.validation.valid ? "valid" : "invalid",
        trading_registered: Boolean(domainPackRegistry.packs.find((pack) => pack.pack_id === "trading")),
      },
    },
    signal_engine: signalEngine,
    signal_validation_results: signalValidationResults,
    fixture_results: fixtureResults,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderSignalReportMarkdown(result),
  };
}

export async function writeTradingSignalReport(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-signal-report.json"), serializableResult(result));
  await writeJson(path.join(outDir, "signal-engine.json"), result.signal_engine);
  await writeJson(path.join(outDir, "signal-validation-results.json"), {
    schema_version: "trading-signal-validation-results.v1",
    generated_at: result.generated_at,
    signal_validation_results: result.signal_validation_results,
  });
  await writeJson(path.join(outDir, "fixture-results.json"), {
    schema_version: "trading-signal-engine-fixture-results.v1",
    generated_at: result.generated_at,
    fixture_results: result.fixture_results,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSignalReportCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSignalReport(args);
    console.log(`Trading signal-report ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.signal_report_status}`);
    console.log(`Phase range: ${result.summary.phase_range}`);
    console.log(`Signals: ${result.summary.signal_candidate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function validateSignalArtifacts(signalEngine, signalSchema) {
  return (signalEngine.signal_candidates ?? []).map((candidate, index) => {
    const signalArtifact = candidate.signal_artifact ?? {};
    const errors = validateAgainstSchema(signalArtifact, signalSchema, {}, `signal_candidates[${index}].signal_artifact`);
    return {
      schema_version: "trading-signal-validation-result.v1",
      candidate_id: candidate.candidate_id ?? null,
      signal_id: signalArtifact.signal_id ?? null,
      validation: {
        valid: errors.length === 0,
        errors,
      },
      validation_items: [
        validationItem(`signal_candidates.${candidate.candidate_id ?? index}`, "signal_schema_valid", errors.length === 0, errors.length === 0 ? "Signal artifact validates." : `Signal artifact has ${errors.length} schema error(s).`),
        ...errors.map((error) => validationItem(error.path, "signal_schema_error", false, error.message)),
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
    validationItem("source.package.trading_signal_report", "package_script_registered", Boolean(scripts["trading:signal-report"]), "Package script trading:signal-report is registered."),
    validationItem("source.pack.schemas.signal_engine", "pack_schema_registered", packSchemas.includes("schemas/trading/trading-signal-engine.schema.json"), "Trading pack manifest registers the signal engine schema."),
    validationItem("source.pack.workflow.signal_report", "pack_workflow_registered", workflows.includes("workflow.trading.signal_report.v1"), "Trading pack manifest registers the signal report workflow."),
    validationItem("source.pack.workflow.signal_dashboard", "pack_workflow_registered", workflows.includes("workflow.trading.signal_dashboard.v1"), "Trading pack manifest registers the signal dashboard/API workflow."),
    validationItem("source.pack.golden.signal_engine", "pack_golden_case_registered", goldenCases.includes("golden.trading.signal_engine.p091_p125"), "Trading pack manifest registers the signal engine golden case."),
    validationItem("source.capability.entrypoint.signal_report", "capability_entrypoint_registered", entrypoints.some((entrypoint) => entrypoint.name === "trading:signal-report"), "Trading capability manifest registers the signal report entrypoint."),
    validationItem("source.capability.golden.signal_engine", "capability_golden_case_registered", capabilityGoldenCases.some((fixture) => fixture.case_id === "golden.trading.signal_engine.p091_p125"), "Trading capability manifest registers the signal engine golden case."),
    validationItem("source.domain_pack_registry.trading", "domain_pack_registry_valid", domainPackRegistry.validation.valid === true && Boolean(tradingPack), "Domain pack registry remains valid with Trading registered."),
    validationItem("source.phase_ledger.p091_p125", "phase_ledger_updated", phaseLedgerText.includes("P091-P125 Acceptance Criteria") && phaseLedgerText.includes("trading:signal-report"), "Phase ledger documents P091-P125 acceptance criteria and CLI."),
  ];
}

function buildSignalEngineValidationItems({
  signalEngine,
  signalEngineSchemaErrors,
  signalValidationResults,
  strategyTaxonomy,
  featureStore,
}) {
  const phaseIds = new Set((signalEngine.phase_coverage ?? []).map((phase) => phase.phase_id));
  const adapterTypes = new Set((signalEngine.strategy_adapters ?? []).map((adapter) => adapter.adapter_type));
  const candidateIds = new Set((signalEngine.signal_candidates ?? []).map((candidate) => candidate.candidate_id));
  const reviewIds = new Set((signalEngine.review_queue?.items ?? []).map((item) => item.candidate_id));
  const archetypeIds = new Set((strategyTaxonomy.strategy_archetypes ?? []).map((archetype) => archetype.archetype_id));
  const featureSnapshotIds = new Set((featureStore.feature_snapshots ?? []).map((snapshot) => snapshot.snapshot_id));
  const datasetIds = new Set((featureStore.market_data_artifacts ?? []).map((artifact) => artifact.dataset_id));
  const sourceBindingsValid = (signalEngine.signal_candidates ?? []).every((candidate) => (candidate.source_bindings ?? []).every((binding) => {
    if (binding.source_type === "strategy_archetype") return archetypeIds.has(binding.source_ref);
    if (binding.source_type === "feature_snapshot") return featureSnapshotIds.has(binding.source_ref);
    if (binding.source_type === "market_data_dataset") return datasetIds.has(binding.source_ref);
    return true;
  }));
  const weightSum = (signalEngine.aggregation_model?.strategy_weights ?? []).reduce((sum, item) => sum + Number(item.weight ?? 0), 0);
  return [
    validationItem("signal_engine.schema", "schema_validation_passed", signalEngineSchemaErrors.length === 0, signalEngineSchemaErrors.length === 0 ? "Signal engine validates against schema." : `Signal engine has ${signalEngineSchemaErrors.length} schema error(s).`),
    ...signalEngineSchemaErrors.map((error) => validationItem(error.path, "schema_error", false, error.message)),
    validationItem("signal_engine.phase_range", "phase_range_p091_p125", signalEngine.phase_range === "P091-P125", "Signal engine is scoped to P091-P125."),
    validationItem("signal_engine.phase_coverage", "all_phases_covered", REQUIRED_PHASE_IDS.every((phaseId) => phaseIds.has(phaseId)) && (signalEngine.phase_coverage ?? []).every((phase) => phase.status === "complete"), "All P091-P125 phases are covered and complete."),
    validationItem("signal_engine.safety.signal_only", "signal_only_boundary", signalEngine.safety_boundary?.signal_only === true, "Signal engine is signal-only."),
    validationItem("signal_engine.safety.no_advice_or_orders", "no_advice_recommendation_order_or_live", signalEngine.safety_boundary?.investment_advice_generated === false && signalEngine.safety_boundary?.trade_recommendation_generated === false && signalEngine.safety_boundary?.order_intent_generated === false && signalEngine.safety_boundary?.live_execution_allowed === false, "Signal engine does not generate advice, recommendations, orders, or live execution."),
    validationItem("signal_engine.adapter_interface", "adapter_interface_declared", signalEngine.adapter_interface?.output_contract === "trading-signal.v1" && signalEngine.adapter_interface?.order_intent_generation_allowed === false && signalEngine.adapter_interface?.live_execution_allowed === false, "Strategy adapter interface outputs trading-signal.v1 and blocks execution."),
    validationItem("signal_engine.adapters.required", "required_adapter_types_present", REQUIRED_ADAPTER_TYPES.every((adapterType) => adapterTypes.has(adapterType)), "All P092-P099 adapter types are present."),
    validationItem("signal_engine.adapters.stage_boundary", "adapter_stages_are_safe", (signalEngine.strategy_adapters ?? []).every((adapter) => (adapter.allowed_stages ?? []).every((stage) => ACTIVE_STAGES.has(stage))), "Adapter allowed stages are limited to research/backtest/paper."),
    validationItem("signal_engine.adapters.no_order_or_live", "adapters_block_order_and_live", (signalEngine.strategy_adapters ?? []).every((adapter) => adapter.order_intent_generation_allowed === false && adapter.live_execution_allowed === false), "Adapters do not generate orders or live execution."),
    validationItem("signal_engine.signals.schema", "signal_artifacts_validate", signalValidationResults.length > 0 && signalValidationResults.every((result) => result.validation.valid), "All signal artifacts validate against trading-signal.v1."),
    ...signalValidationResults.flatMap((result) => result.validation_items),
    validationItem("signal_engine.signals.confidence", "signal_confidence_in_range", (signalEngine.signal_candidates ?? []).every((candidate) => Number.isFinite(candidate.confidence) && candidate.confidence >= 0 && candidate.confidence <= 1), "Signal candidate confidence values are bounded."),
    validationItem("signal_engine.signals.rationale", "signal_rationales_present", (signalEngine.signal_candidates ?? []).every((candidate) => typeof candidate.rationale === "string" && candidate.rationale.length > 0), "Signal candidates include rationales."),
    validationItem("signal_engine.signals.source_bindings", "signal_source_bindings_valid", sourceBindingsValid, "Signal source bindings reference the strategy taxonomy and feature store fixtures."),
    validationItem("signal_engine.freshness", "freshness_gate_passed", signalEngine.freshness_gate?.default_result === "pass" && signalEngine.freshness_gate?.stale_blocks_aggregation === true && (signalEngine.signal_candidates ?? []).every((candidate) => candidate.freshness_status === "fresh"), "Freshness gate passes and stale signals would block aggregation."),
    validationItem("signal_engine.conflicts", "conflict_detection_human_review", signalEngine.conflict_detection?.auto_resolution_allowed === false && signalEngine.conflict_detection?.human_review_required === true, "Conflict detection requires human review and no auto-resolution."),
    validationItem("signal_engine.aggregation", "signal_aggregation_declared", signalEngine.aggregation_model?.vote_model === "weighted_vote" && Math.abs(weightSum - 1) < 0.000001, "Signal aggregation uses a weighted vote with normalized weights."),
    validationItem("signal_engine.aggregation.correlation", "correlation_penalty_enabled", signalEngine.aggregation_model?.correlation_penalty?.enabled === true, "Correlation penalty is enabled."),
    validationItem("signal_engine.aggregation.risk_score", "risk_adjusted_signal_score_declared", Number.isFinite(signalEngine.aggregation_model?.risk_adjusted_signal_score?.score), "Risk-adjusted signal score is declared."),
    validationItem("signal_engine.review_queue", "review_queue_covers_candidates", signalEngine.review_queue?.human_review_required === true && candidateIds.size > 0 && [...candidateIds].every((candidateId) => reviewIds.has(candidateId)), "Signal review queue covers every candidate."),
    validationItem("signal_engine.order_intent_boundary", "order_intent_boundary_blocked", signalEngine.order_intent_boundary?.signal_to_order_intent_allowed === false && signalEngine.order_intent_boundary?.generated_order_intent_count === 0 && signalEngine.order_intent_boundary?.live_execution_allowed === false, "Signal-to-order-intent boundary is blocked."),
    validationItem("signal_engine.drift", "signal_drift_detection_declared", signalEngine.drift_detection?.enabled === true && signalEngine.drift_detection?.default_result === "pass", "Signal drift detection is declared."),
    validationItem("signal_engine.decay", "signal_decay_tracking_declared", signalEngine.decay_tracking?.enabled === true && signalEngine.decay_tracking?.decay_blocks_stale_signals === true, "Signal decay tracking is declared."),
    validationItem("signal_engine.attribution", "signal_attribution_required", signalEngine.attribution_model?.source_binding_required === true && signalEngine.attribution_model?.feature_attribution_required === true && signalEngine.attribution_model?.human_review_required === true, "Signal attribution requires source and feature bindings plus human review."),
    validationItem("signal_engine.dashboard", "dashboard_read_only", signalEngine.dashboard_api_stub?.read_only === true && signalEngine.dashboard_api_stub?.mutating_routes_enabled === false && (signalEngine.dashboard_api_stub?.routes ?? []).every((route) => route.method === "GET"), "Signal dashboard/API is read-only."),
  ];
}

function buildFixtureResults(goldenFixtures, signalEngine, signalItems) {
  return (goldenFixtures.fixtures ?? []).map((fixture) => {
    const regressionHash = hashValue({
      fixture_id: fixture.fixture_id,
      phase_range: signalEngine.phase_range,
      phase_coverage: signalEngine.phase_coverage,
      adapter_types: (signalEngine.strategy_adapters ?? []).map((adapter) => adapter.adapter_type).sort(),
      candidate_ids: (signalEngine.signal_candidates ?? []).map((candidate) => candidate.candidate_id).sort(),
      safety_boundary: signalEngine.safety_boundary,
      order_intent_boundary: signalEngine.order_intent_boundary,
      aggregation_model: signalEngine.aggregation_model,
    });
    const validationItems = [
      validationItem(`fixtures.${fixture.fixture_id}.status`, "fixture_status_matches", fixture.expected_status === "complete" && signalItems.every((item) => item.status === "passed"), `${fixture.fixture_id} expected status is complete.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_range`, "fixture_phase_range_matches", signalEngine.phase_range === fixture.expected_phase_range, `${fixture.fixture_id} phase range matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_count`, "fixture_phase_count_matches", (signalEngine.phase_coverage ?? []).length === fixture.expected_phase_count, `${fixture.fixture_id} phase count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.adapter_count`, "fixture_adapter_count_matches", (signalEngine.strategy_adapters ?? []).length === fixture.expected_adapter_count, `${fixture.fixture_id} adapter count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.signal_candidate_count`, "fixture_signal_candidate_count_matches", (signalEngine.signal_candidates ?? []).length === fixture.expected_signal_candidate_count, `${fixture.fixture_id} signal candidate count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.review_queue_count`, "fixture_review_queue_count_matches", (signalEngine.review_queue?.items ?? []).length === fixture.expected_review_queue_item_count, `${fixture.fixture_id} review queue count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.order_intent_count`, "fixture_order_intent_count_matches", signalEngine.order_intent_boundary?.generated_order_intent_count === fixture.expected_generated_order_intent_count, `${fixture.fixture_id} order intent count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.live_boundary`, "fixture_live_boundary_matches", signalEngine.safety_boundary?.live_execution_allowed === fixture.expected_live_execution_allowed, `${fixture.fixture_id} live execution boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.dashboard`, "fixture_dashboard_boundary_matches", signalEngine.dashboard_api_stub?.read_only === fixture.expected_dashboard_read_only, `${fixture.fixture_id} dashboard boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.hash`, "fixture_regression_hash_locked", regressionHash.startsWith("sha256:"), `${fixture.fixture_id} regression hash is locked.`),
    ];
    const validation = summarizeValidation(validationItems);
    return {
      schema_version: "trading-signal-engine-fixture-result.v1",
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

function summarizeSignalReport({ signalEngine, signalValidationResults, fixtureResults, validationItems, validation }) {
  const adapters = signalEngine.strategy_adapters ?? [];
  const candidates = signalEngine.signal_candidates ?? [];
  return {
    signal_report_status: validation.valid ? "complete" : "blocked",
    phase_range: signalEngine.phase_range,
    phase_count: signalEngine.phase_coverage?.length ?? 0,
    complete_phase_count: (signalEngine.phase_coverage ?? []).filter((phase) => phase.status === "complete").length,
    adapter_count: adapters.length,
    enabled_adapter_count: adapters.filter((adapter) => adapter.enabled === true).length,
    placeholder_adapter_count: adapters.filter((adapter) => adapter.status === "placeholder").length,
    signal_candidate_count: candidates.length,
    signal_schema_valid_count: signalValidationResults.filter((result) => result.validation.valid).length,
    fresh_signal_count: candidates.filter((candidate) => candidate.freshness_status === "fresh").length,
    review_queue_item_count: signalEngine.review_queue?.items?.length ?? 0,
    generated_order_intent_count: signalEngine.order_intent_boundary?.generated_order_intent_count ?? 0,
    fixture_count: fixtureResults.length,
    passed_fixture_count: fixtureResults.filter((fixture) => fixture.validation.valid).length,
    locked_regression_hash_count: fixtureResults.filter((fixture) => fixture.regression_hash?.startsWith("sha256:")).length,
    validation_item_count: validationItems.length,
    validation_error_count: validation.errors.length,
    signal_only: signalEngine.safety_boundary?.signal_only === true,
    live_execution_allowed: signalEngine.safety_boundary?.live_execution_allowed === true,
    order_intent_generated: signalEngine.safety_boundary?.order_intent_generated === true,
    dashboard_read_only: signalEngine.dashboard_api_stub?.read_only === true,
  };
}

function renderSignalReportMarkdown(result) {
  const lines = [];
  lines.push("# Trading Signal Report");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.signal_report_status}`);
  lines.push("");
  lines.push(`- Phase range: ${result.summary.phase_range}`);
  lines.push(`- Phases complete: ${result.summary.complete_phase_count}/${result.summary.phase_count}`);
  lines.push(`- Adapters: ${result.summary.adapter_count}`);
  lines.push(`- Signal candidates: ${result.summary.signal_candidate_count}`);
  lines.push(`- Review queue: ${result.summary.review_queue_item_count}`);
  lines.push(`- Generated order intents: ${result.summary.generated_order_intent_count}`);
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
    signal_engine_path: path.resolve(options.signalEnginePath ?? DEFAULT_TRADING_SIGNAL_ENGINE_INPUTS.signalEnginePath),
    signal_engine_schema_path: path.resolve(options.signalEngineSchemaPath ?? DEFAULT_TRADING_SIGNAL_ENGINE_INPUTS.signalEngineSchemaPath),
    signal_schema_path: path.resolve(options.signalSchemaPath ?? DEFAULT_TRADING_SIGNAL_ENGINE_INPUTS.signalSchemaPath),
    strategy_taxonomy_path: path.resolve(options.strategyTaxonomyPath ?? DEFAULT_TRADING_SIGNAL_ENGINE_INPUTS.strategyTaxonomyPath),
    feature_store_path: path.resolve(options.featureStorePath ?? DEFAULT_TRADING_SIGNAL_ENGINE_INPUTS.featureStorePath),
    golden_fixtures_path: path.resolve(options.goldenFixturesPath ?? DEFAULT_TRADING_SIGNAL_ENGINE_INPUTS.goldenFixturesPath),
    pack_manifest_path: path.resolve(options.packManifestPath ?? DEFAULT_TRADING_SIGNAL_ENGINE_INPUTS.packManifestPath),
    capability_manifest_path: path.resolve(options.capabilityManifestPath ?? DEFAULT_TRADING_SIGNAL_ENGINE_INPUTS.capabilityManifestPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SIGNAL_ENGINE_INPUTS.packagePath),
    phase_ledger_path: path.resolve(options.phaseLedgerPath ?? DEFAULT_TRADING_SIGNAL_ENGINE_INPUTS.phaseLedgerPath),
  };
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_TRADING_SIGNAL_REPORT_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--signal-engine") parsed.signalEnginePath = argv[++index];
    else if (arg === "--signal-engine-schema") parsed.signalEngineSchemaPath = argv[++index];
    else if (arg === "--signal-schema") parsed.signalSchemaPath = argv[++index];
    else if (arg === "--strategy-taxonomy") parsed.strategyTaxonomyPath = argv[++index];
    else if (arg === "--feature-store") parsed.featureStorePath = argv[++index];
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
  console.log(`Usage: node scripts/trading-signal-report.mjs [options]

Options:
  --out-dir <folder>             Output directory. Default: ${DEFAULT_TRADING_SIGNAL_REPORT_OUT_DIR}
  --run-at <iso>                 Deterministic generated_at timestamp.
  --signal-engine <path>         Signal engine fixture path.
  --signal-engine-schema <path>  Signal engine schema path.
  --signal-schema <path>         trading-signal schema path.
  --strategy-taxonomy <path>     Strategy taxonomy fixture path.
  --feature-store <path>         Market data feature store fixture path.
  --golden-fixtures <path>       Signal engine golden fixtures path.
  --pack-manifest <path>         Trading pack manifest path.
  --capability-manifest <path>   Trading capability manifest path.
  --package <path>               package.json path.
  --phase-ledger <path>          Trading phase ledger path.
  --check                        Validate only, do not write artifacts.
  -h, --help                     Show this help.
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
    validation_item_id: `trading-signal-engine.${slugify(itemPath)}.${checkId}`,
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
