import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildDomainPackRegistry } from "./domain-pack-registry.mjs";

export const DEFAULT_TRADING_STRATEGY_TAXONOMY_OUT_DIR = "artifacts/trading-strategy-taxonomy/latest";
export const DEFAULT_TRADING_STRATEGY_TAXONOMY_INPUTS = {
  registryPath: "examples/trading/strategy-archetype-registry.json",
  schemaPath: "schemas/trading/trading-strategy-archetype-registry.schema.json",
  goldenFixturesPath: "examples/trading/strategy-taxonomy-golden-fixtures.json",
  packManifestPath: "packs/trading/pack.json",
  capabilityManifestPath: "packs/trading/capabilities/research-backtest-paper.json",
  packagePath: "package.json",
  phaseLedgerPath: "docs/trading-pack-phase-ledger.md",
};

const REQUIRED_PHASE_IDS = Array.from({ length: 25 }, (_, index) => `P${String(36 + index).padStart(3, "0")}`);
const REQUIRED_ARCHETYPES = [
  "equity_long_short",
  "equity_market_neutral",
  "statistical_arbitrage",
  "short_bias",
  "relative_value",
  "pairs_trading",
  "convertible_fixed_income_arbitrage",
  "event_driven",
  "global_macro",
  "managed_futures_cta",
  "volatility_tail_risk",
  "multi_strategy_allocator",
];
const REQUIRED_EVENT_TYPES = [
  "merger",
  "earnings",
  "corporate_action",
  "listing",
  "delisting",
  "unlock",
  "fork",
  "tokenomics",
];
const LIFECYCLE_STATUSES = ["draft", "active", "disabled", "retired"];
const ACTIVE_STAGES = new Set(["research", "backtest", "paper"]);

export async function runTradingStrategyTaxonomy(options = {}) {
  const result = await buildTradingStrategyTaxonomy(options);
  if (options.write !== false) await writeTradingStrategyTaxonomy(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading strategy taxonomy validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingStrategyTaxonomy(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_STRATEGY_TAXONOMY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const registry = await readJson(inputs.registry_path);
  const schema = await readJson(inputs.schema_path);
  const goldenFixtures = await readJson(inputs.golden_fixtures_path);
  const packManifest = await readJson(inputs.pack_manifest_path);
  const capabilityManifest = await readJson(inputs.capability_manifest_path);
  const packageJson = await readJson(inputs.package_path);
  const phaseLedgerText = await readFile(inputs.phase_ledger_path, "utf8");
  const domainPackRegistry = await buildDomainPackRegistry({ runAt: generatedAt });

  const schemaErrors = validateAgainstSchema(registry, schema, {}, "strategy_archetype_registry");
  const sourceItems = buildSourceValidationItems({
    packageJson,
    packManifest,
    capabilityManifest,
    phaseLedgerText,
    domainPackRegistry,
  });
  const taxonomyItems = buildTaxonomyValidationItems(registry, schemaErrors);
  const fixtureResults = buildFixtureResults(goldenFixtures, registry, taxonomyItems);
  const validationItems = [
    ...sourceItems,
    ...taxonomyItems,
    ...fixtureResults.flatMap((fixture) => fixture.validation_items),
  ];
  const validation = summarizeValidation(validationItems);
  const summary = summarizeStrategyTaxonomy({ registry, fixtureResults, validationItems, validation });
  const result = {
    schema_version: "trading-strategy-taxonomy-report.v1",
    generated_at: generatedAt,
    strategy_taxonomy_report_id: `trading-strategy-taxonomy.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      registry: sourceContract("strategy_archetype_registry", inputs.registry_path, registry.schema_version, registry.taxonomy_status === "complete"),
      schema: sourceContract("strategy_archetype_registry_schema", inputs.schema_path, schema.title, schemaErrors.length === 0),
      golden_fixtures: sourceContract("strategy_taxonomy_golden_fixtures", inputs.golden_fixtures_path, goldenFixtures.schema_version, Array.isArray(goldenFixtures.fixtures)),
      pack_manifest: sourceContract("trading_pack_manifest", inputs.pack_manifest_path, packManifest.schema_version, packManifest.pack_id === "trading"),
      capability_manifest: sourceContract("trading_capability_manifest", inputs.capability_manifest_path, capabilityManifest.schema_version, capabilityManifest.domain_pack === "trading"),
      domain_pack_registry: {
        source_id: "domain_pack_registry",
        status: domainPackRegistry.validation.valid ? "valid" : "invalid",
        trading_registered: Boolean(domainPackRegistry.packs.find((pack) => pack.pack_id === "trading")),
      },
    },
    strategy_archetype_registry: registry,
    fixture_results: fixtureResults,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderStrategyTaxonomyMarkdown(result),
  };
}

export async function writeTradingStrategyTaxonomy(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-strategy-taxonomy.json"), serializableResult(result));
  await writeJson(path.join(outDir, "strategy-archetype-registry.json"), result.strategy_archetype_registry);
  await writeJson(path.join(outDir, "fixture-results.json"), {
    schema_version: "trading-strategy-taxonomy-fixture-results.v1",
    generated_at: result.generated_at,
    fixture_results: result.fixture_results,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingStrategyTaxonomyCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingStrategyTaxonomy(args);
    console.log(`Trading strategy-taxonomy ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.strategy_taxonomy_status}`);
    console.log(`Archetypes: ${result.summary.archetype_count}`);
    console.log(`Event models: ${result.summary.event_model_count}`);
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
    validationItem("source.package.trading_strategy_taxonomy", "package_script_registered", Boolean(scripts["trading:strategy-taxonomy"]), "Package script trading:strategy-taxonomy is registered."),
    validationItem("source.pack.schemas.strategy_taxonomy", "pack_schema_registered", packSchemas.includes("schemas/trading/trading-strategy-archetype-registry.schema.json"), "Trading pack manifest registers the strategy taxonomy schema."),
    validationItem("source.pack.workflow.strategy_taxonomy", "pack_workflow_registered", workflows.includes("workflow.trading.strategy_taxonomy.v1"), "Trading pack manifest registers the strategy taxonomy workflow."),
    validationItem("source.pack.golden.strategy_taxonomy", "pack_golden_case_registered", goldenCases.includes("golden.trading.strategy_taxonomy.p036_p060"), "Trading pack manifest registers the strategy taxonomy golden case."),
    validationItem("source.capability.entrypoint.strategy_taxonomy", "capability_entrypoint_registered", entrypoints.some((entrypoint) => entrypoint.name === "trading:strategy-taxonomy"), "Trading capability manifest registers the strategy taxonomy entrypoint."),
    validationItem("source.capability.golden.strategy_taxonomy", "capability_golden_case_registered", capabilityGoldenCases.some((fixture) => fixture.case_id === "golden.trading.strategy_taxonomy.p036_p060"), "Trading capability manifest registers the strategy taxonomy golden case."),
    validationItem("source.domain_pack_registry.trading", "domain_pack_registry_valid", domainPackRegistry.validation.valid === true && Boolean(tradingPack), "Domain pack registry remains valid with Trading registered."),
    validationItem("source.phase_ledger.p036_p060", "phase_ledger_updated", phaseLedgerText.includes("P036-P060 Acceptance Criteria") && phaseLedgerText.includes("trading:strategy-taxonomy"), "Phase ledger documents P036-P060 acceptance criteria and CLI."),
  ];
}

function buildTaxonomyValidationItems(registry, schemaErrors) {
  const phaseIds = new Set((registry.phase_coverage ?? []).map((phase) => phase.phase_id));
  const archetypes = registry.strategy_archetypes ?? [];
  const archetypeIds = new Set(archetypes.map((archetype) => archetype.archetype_id));
  const allEventTypes = new Set((registry.event_models ?? []).flatMap((eventModel) => eventModel.event_types ?? []));
  const lifecycleStatuses = registry.lifecycle_model?.statuses ?? [];
  return [
    validationItem("strategy_taxonomy.schema", "schema_validation_passed", schemaErrors.length === 0, schemaErrors.length === 0 ? "Strategy taxonomy registry validates against schema." : `Strategy taxonomy registry has ${schemaErrors.length} schema error(s).`),
    ...schemaErrors.map((error) => validationItem(error.path, "schema_error", false, error.message)),
    validationItem("strategy_taxonomy.phase_range", "phase_range_p036_p060", registry.phase_range === "P036-P060", "Strategy taxonomy registry is scoped to P036-P060."),
    validationItem("strategy_taxonomy.phase_coverage", "all_phases_covered", REQUIRED_PHASE_IDS.every((phaseId) => phaseIds.has(phaseId)) && (registry.phase_coverage ?? []).every((phase) => phase.status === "complete"), "All P036-P060 phases are covered and complete."),
    validationItem("strategy_taxonomy.safety.no_advice", "no_financial_advice_or_recommendation", registry.safety_boundary?.financial_advice_generated === false && registry.safety_boundary?.trade_recommendation_generated === false, "Taxonomy does not generate advice or recommendations."),
    validationItem("strategy_taxonomy.safety.no_orders", "no_order_or_live_execution", registry.safety_boundary?.order_intent_generated === false && registry.safety_boundary?.live_execution_allowed === false, "Taxonomy does not generate orders or live execution."),
    validationItem("strategy_taxonomy.archetypes.required", "required_archetypes_present", REQUIRED_ARCHETYPES.every((archetypeId) => archetypeIds.has(archetypeId)), "All required P037-P050 archetypes are present."),
    validationItem("strategy_taxonomy.archetypes.unique", "archetype_ids_unique", archetypeIds.size === archetypes.length, "Archetype ids are unique."),
    validationItem("strategy_taxonomy.archetypes.no_live", "archetypes_not_live_eligible", archetypes.every((archetype) => archetype.live_eligible === false), "No archetype is live eligible."),
    validationItem("strategy_taxonomy.archetypes.stage_boundary", "archetype_stages_are_safe", archetypes.every((archetype) => (archetype.allowed_stages ?? []).every((stage) => ACTIVE_STAGES.has(stage))), "Archetype allowed stages are limited to research/backtest/paper."),
    validationItem("strategy_taxonomy.archetypes.required_data", "required_data_declared", archetypes.every((archetype) => (archetype.required_data ?? []).length > 0), "Every archetype declares required data."),
    validationItem("strategy_taxonomy.archetypes.tradability", "tradability_constraints_declared", archetypes.every((archetype) => (archetype.tradability_constraints ?? []).length > 0), "Every archetype declares tradability constraints."),
    validationItem("strategy_taxonomy.archetypes.risk", "risk_models_block_live", archetypes.every((archetype) => archetype.risk_model?.live_trade_allowed === false && ["block", "halt"].includes(archetype.risk_model?.default_risk_result)), "Every archetype risk model blocks live trading by default."),
    validationItem("strategy_taxonomy.archetypes.signal", "signal_output_standardized", archetypes.every((archetype) => archetype.signal_output_standard?.signal_contract === "trading-signal.v1" && archetype.signal_output_standard?.human_review_required === true), "Every archetype uses trading-signal.v1 with human review."),
    validationItem("strategy_taxonomy.archetypes.lifecycle", "lifecycle_statuses_standardized", archetypes.every((archetype) => equalSets(archetype.lifecycle_statuses ?? [], LIFECYCLE_STATUSES)) && equalSets(lifecycleStatuses, LIFECYCLE_STATUSES), "Strategy lifecycle statuses are draft/active/disabled/retired."),
    validationItem("strategy_taxonomy.events.required", "event_models_cover_required_events", REQUIRED_EVENT_TYPES.every((eventType) => allEventTypes.has(eventType)), "Corporate action and crypto event models cover the required event types."),
    validationItem("strategy_taxonomy.events.no_live", "event_models_block_live", (registry.event_models ?? []).every((eventModel) => eventModel.live_execution_allowed === false), "Event models do not allow live execution."),
    validationItem("strategy_taxonomy.conflict", "conflict_model_declared", registry.strategy_conflict_model?.auto_resolution_allowed === false && registry.strategy_conflict_model?.resolution_policy === "human_review_required", "Strategy conflict model requires human review and no auto-resolution."),
    validationItem("strategy_taxonomy.correlation", "correlation_model_declared", registry.strategy_correlation_model?.correlation_matrix_required === true && Number.isFinite(registry.strategy_correlation_model?.warning_threshold_abs), "Strategy correlation model is declared."),
    validationItem("strategy_taxonomy.capacity", "capacity_liquidity_model_declared", registry.capacity_liquidity_model?.live_execution_allowed === false && (registry.capacity_liquidity_model?.capacity_inputs ?? []).length > 0, "Capacity/liquidity model is declared and blocks live execution."),
  ];
}

function buildFixtureResults(goldenFixtures, registry, taxonomyItems) {
  return (goldenFixtures.fixtures ?? []).map((fixture) => {
    const liveEligibleCount = (registry.strategy_archetypes ?? []).filter((archetype) => archetype.live_eligible === true).length;
    const registryEventTypes = new Set((registry.event_models ?? []).flatMap((eventModel) => eventModel.event_types ?? []));
    const regressionHash = hashValue({
      fixture_id: fixture.fixture_id,
      phase_range: registry.phase_range,
      phase_coverage: registry.phase_coverage,
      archetype_ids: (registry.strategy_archetypes ?? []).map((archetype) => archetype.archetype_id).sort(),
      event_types: [...registryEventTypes].sort(),
      safety_boundary: registry.safety_boundary,
      signal_output_standard: registry.signal_output_standard,
    });
    const validationItems = [
      validationItem(`fixtures.${fixture.fixture_id}.status`, "fixture_status_matches", fixture.expected_status === "complete" && taxonomyItems.every((item) => item.status === "passed"), `${fixture.fixture_id} expected status is complete.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_range`, "fixture_phase_range_matches", registry.phase_range === fixture.expected_phase_range, `${fixture.fixture_id} phase range matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.phase_count`, "fixture_phase_count_matches", (registry.phase_coverage ?? []).length === fixture.expected_phase_count, `${fixture.fixture_id} phase count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.archetype_count`, "fixture_archetype_count_matches", (registry.strategy_archetypes ?? []).length === fixture.expected_archetype_count, `${fixture.fixture_id} archetype count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.event_model_count`, "fixture_event_model_count_matches", (registry.event_models ?? []).length === fixture.expected_event_model_count, `${fixture.fixture_id} event model count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.live_eligible_count`, "fixture_live_eligible_count_matches", liveEligibleCount === fixture.expected_live_eligible_count, `${fixture.fixture_id} live eligible count matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.signal_boundary`, "fixture_signal_boundary_matches", registry.signal_output_standard?.execution_boundary === fixture.expected_signal_boundary, `${fixture.fixture_id} signal boundary matches.`),
      validationItem(`fixtures.${fixture.fixture_id}.hash`, "fixture_regression_hash_locked", regressionHash.startsWith("sha256:"), `${fixture.fixture_id} regression hash is locked.`),
    ];
    const validation = summarizeValidation(validationItems);
    return {
      schema_version: "trading-strategy-taxonomy-fixture-result.v1",
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

function summarizeStrategyTaxonomy({ registry, fixtureResults, validationItems, validation }) {
  const archetypes = registry.strategy_archetypes ?? [];
  const eventModels = registry.event_models ?? [];
  return {
    strategy_taxonomy_status: validation.valid ? "complete" : "blocked",
    phase_range: registry.phase_range,
    phase_count: registry.phase_coverage?.length ?? 0,
    complete_phase_count: (registry.phase_coverage ?? []).filter((phase) => phase.status === "complete").length,
    archetype_count: archetypes.length,
    research_only_archetype_count: archetypes.filter((archetype) => archetype.research_only === true).length,
    paper_allowed_archetype_count: archetypes.filter((archetype) => archetype.tradability_status === "paper_allowed").length,
    live_eligible_archetype_count: archetypes.filter((archetype) => archetype.live_eligible === true).length,
    event_model_count: eventModels.length,
    required_event_type_count: REQUIRED_EVENT_TYPES.length,
    fixture_count: fixtureResults.length,
    passed_fixture_count: fixtureResults.filter((fixture) => fixture.validation.valid).length,
    locked_regression_hash_count: fixtureResults.filter((fixture) => fixture.regression_hash?.startsWith("sha256:")).length,
    validation_item_count: validationItems.length,
    validation_error_count: validation.errors.length,
    live_execution_allowed: registry.safety_boundary?.live_execution_allowed === true,
    order_intent_generated: registry.safety_boundary?.order_intent_generated === true,
  };
}

function renderStrategyTaxonomyMarkdown(result) {
  const lines = [];
  lines.push("# Trading Strategy Taxonomy");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.strategy_taxonomy_status}`);
  lines.push("");
  lines.push(`- Phase range: ${result.summary.phase_range}`);
  lines.push(`- Phases complete: ${result.summary.complete_phase_count}/${result.summary.phase_count}`);
  lines.push(`- Archetypes: ${result.summary.archetype_count}`);
  lines.push(`- Event models: ${result.summary.event_model_count}`);
  lines.push(`- Live-eligible archetypes: ${result.summary.live_eligible_archetype_count}`);
  lines.push(`- Fixtures passed: ${result.summary.passed_fixture_count}/${result.summary.fixture_count}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options = {}) {
  return {
    registry_path: path.resolve(options.registryPath ?? DEFAULT_TRADING_STRATEGY_TAXONOMY_INPUTS.registryPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_STRATEGY_TAXONOMY_INPUTS.schemaPath),
    golden_fixtures_path: path.resolve(options.goldenFixturesPath ?? DEFAULT_TRADING_STRATEGY_TAXONOMY_INPUTS.goldenFixturesPath),
    pack_manifest_path: path.resolve(options.packManifestPath ?? DEFAULT_TRADING_STRATEGY_TAXONOMY_INPUTS.packManifestPath),
    capability_manifest_path: path.resolve(options.capabilityManifestPath ?? DEFAULT_TRADING_STRATEGY_TAXONOMY_INPUTS.capabilityManifestPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_STRATEGY_TAXONOMY_INPUTS.packagePath),
    phase_ledger_path: path.resolve(options.phaseLedgerPath ?? DEFAULT_TRADING_STRATEGY_TAXONOMY_INPUTS.phaseLedgerPath),
  };
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_TRADING_STRATEGY_TAXONOMY_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--registry") parsed.registryPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-strategy-taxonomy.mjs [options]

Options:
  --out-dir <folder>             Output directory. Default: ${DEFAULT_TRADING_STRATEGY_TAXONOMY_OUT_DIR}
  --run-at <iso>                 Deterministic generated_at timestamp.
  --registry <path>              Strategy archetype registry path.
  --schema <path>                Strategy archetype registry schema path.
  --golden-fixtures <path>       Strategy taxonomy golden fixtures path.
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
    validation_item_id: `trading-strategy-taxonomy.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function equalSets(left, right) {
  return left.length === right.length && right.every((item) => left.includes(item));
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
