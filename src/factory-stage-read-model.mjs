import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_FACTORY_LEDGER_DIR,
  DEFAULT_FACTORY_SEED_DIR,
  readFactoryLedgerFile,
} from "./factory-product-registry-store.mjs";

export const DEFAULT_FACTORY_STAGE_READ_MODEL_OUT_DIR = "artifacts/factory-stage-read-model/latest";

const COMMAND_NAME = "factory:stage";
const SCHEMA_VERSION = "factory-stage-read-model.v1";
const CAPABILITY_ID = "factory.stage_read_model";
const PROGRAM_RANGE = "FCORE-FB.1";
const READY_STATUS = "ready_factory_stage_read_model";
const BLOCKED_STATUS = "blocked_factory_stage_read_model";
const STAGE_LADDER = [
  ["PS0_seed", "Product row exists as seed or initial intake"],
  ["PS1_schema_valid", "Required product schema is valid"],
  ["PS2_receipt_bound", "State movement is tied to a receipt envelope"],
  ["PS3_candidate_ready", "Candidate generation can be prepared"],
  ["PS4_apply_ready", "Apply candidate can be considered after protected gate"],
  ["PS5_limited_execution", "Limited execution candidate exists"],
  ["PS6_release_candidate", "Release candidate can be evaluated"],
  ["PS7_deploy_ready", "Deploy-ready classification can be considered"],
];

const AUTHORITY_CLOSED = {
  project_creation_allowed_now: false,
  repo_write_allowed_now: false,
  connector_write_allowed_now: false,
  deployment_allowed_now: false,
  protected_action_allowed_now: false,
  production_pass_enabled: false,
  enterprise_pass_enabled: false,
};

export async function runFactoryStageReadModel(options = {}) {
  const result = await buildFactoryStageReadModel(options);
  if (options.write !== false) await writeFactoryStageReadModel(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Stage Read Model failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (options.requirePass && result.summary.factory_stage_read_model_status !== READY_STATUS) {
    const error = new Error("Factory Stage Read Model is not ready.");
    error.summary = result.summary;
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildFactoryStageReadModel(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_STAGE_READ_MODEL_OUT_DIR);
  const ledgerDir = path.resolve(options.factoryLedgerDir ?? options.ledgerDir ?? DEFAULT_FACTORY_LEDGER_DIR);
  const seedDir = path.resolve(options.factorySeedDir ?? options.seedDir ?? DEFAULT_FACTORY_SEED_DIR);
  const productSource = await readFactoryProductSource({ ledgerDir, seedDir });
  const transitionSource = await readFactoryTransitionSource({ ledgerDir, seedDir });
  const stageRows = buildStageRows(productSource, transitionSource);
  const boundary = buildBoundary(productSource, transitionSource, stageRows);
  const validationItems = buildValidationItems(productSource, transitionSource, stageRows, boundary);
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary(productSource, transitionSource, stageRows, boundary, validation);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs: {
      ledger_dir: ledgerDir,
      seed_dir: seedDir,
    },
    factory_stage_ladder: STAGE_LADDER.map(([state, description], index) => ({
      schema_version: "factory-stage-ladder-row.v1",
      product_state: state,
      stage_rank: index,
      description,
    })),
    factory_stage_source: {
      schema_version: "factory-stage-source.v1",
      product_source_tier: productSource.source_tier,
      product_source_error: productSource.error,
      product_source_validation_error_count: productSource.validation_error_count,
      transition_source_tiers: transitionSource.source_tiers,
      transition_source_error: transitionSource.error,
      transition_source_validation_error_count: transitionSource.validation_error_count,
    },
    factory_stage_rows: stageRows,
    factory_stage_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryStageReadModel(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-stage-read-model.json"), serializableResult(result));
  await writeJson(path.join(outDir, "stage-rows.json"), collectionEnvelope("factory-stage-rows.v1", "factory_stage_rows", result.factory_stage_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-stage-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_stage_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryStageReadModelCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryStageReadModel(args);
    console.log(`Factory Stage Read Model validated at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_stage_read_model_status}`);
    console.log(`Products: ${result.summary.product_count}`);
    console.log(`Product source: ${result.summary.product_source_tier}`);
    console.log(`Transitions: ${result.summary.transition_count}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

async function readFactoryProductSource({ ledgerDir, seedDir }) {
  // Products are single-source truth: local operational rows override tracked seed.
  const operational = await readFactoryLedgerFile("products", { ledgerDir });
  if (operational.line_count > 0 && !operational.validation.valid) {
    return sourceResult("operational_ledger", [], operational.validation.errors.length, `Operational products ledger is invalid: ${operational.validation.errors.length} error(s).`, operational);
  }
  if (operational.entries.length > 0) {
    return sourceResult("operational_ledger", operational.entries, 0, null, operational);
  }

  const seed = await readFactoryLedgerFile("products", { ledgerDir: seedDir });
  if (seed.line_count > 0 && !seed.validation.valid) {
    return sourceResult("tracked_seed", [], seed.validation.errors.length, `Tracked seed products ledger is invalid: ${seed.validation.errors.length} error(s).`, seed);
  }
  if (seed.entries.length > 0) {
    return sourceResult("tracked_seed", seed.entries, 0, null, seed);
  }
  return sourceResult("missing", [], 0, "Factory product store is empty.", seed);
}

async function readFactoryTransitionSource({ ledgerDir, seedDir }) {
  // Transitions are append events: seed and local tiers are unioned, and either tier can block PS3+ promotion.
  const seed = await readFactoryLedgerFile("state_transitions", { ledgerDir: seedDir });
  const operational = await readFactoryLedgerFile("state_transitions", { ledgerDir });
  const errors = [];
  if (seed.line_count > 0 && !seed.validation.valid) errors.push(...seed.validation.errors);
  if (operational.line_count > 0 && !operational.validation.valid) errors.push(...operational.validation.errors);
  const sourceTiers = [];
  const transitions = [];
  if (seed.entries.length > 0 && seed.validation.valid) {
    sourceTiers.push("tracked_seed");
    transitions.push(...seed.entries.map((row) => ({ ...row, source_tier: "tracked_seed" })));
  }
  if (operational.entries.length > 0 && operational.validation.valid) {
    sourceTiers.push("operational_ledger");
    transitions.push(...operational.entries.map((row) => ({ ...row, source_tier: "operational_ledger" })));
  }
  return {
    available: errors.length === 0,
    source_tiers: sourceTiers.length > 0 ? sourceTiers : ["none"],
    transitions,
    validation_error_count: errors.length,
    error: errors.length > 0 ? `Factory transition ledger is invalid: ${errors.length} error(s).` : null,
    ledgers: { seed, operational },
  };
}

function sourceResult(sourceTier, products, validationErrorCount, error, ledger) {
  return {
    available: error === null,
    source_tier: sourceTier,
    products,
    validation_error_count: validationErrorCount,
    error,
    ledger,
  };
}

function buildStageRows(productSource, transitionSource) {
  const transitionsByProduct = groupBy(transitionSource.transitions, (row) => row.product_id);
  return productSource.products.map((product) => {
    const transitions = sortTransitions(transitionsByProduct.get(product.product_id) ?? []);
    const latestTransition = transitions.at(-1) ?? null;
    const currentState = latestTransition?.to_state ?? product.product_state;
    return {
      schema_version: "factory-stage-row.v1",
      product_id: product.product_id,
      tenant_id: product.tenant_id,
      workspace_id: product.workspace_id,
      display_name: product.display_name ?? product.product_id,
      product_source_tier: productSource.source_tier,
      transition_source_tiers: unique(transitions.map((row) => row.source_tier)),
      domain_pack_ids: product.domain_pack_ids ?? [],
      base_product_state: product.product_state,
      current_product_state: currentState,
      current_stage_rank: stageRank(currentState),
      transition_count: transitions.length,
      latest_transition_id: latestTransition?.transition_id ?? null,
      latest_transition_receipt_id: latestTransition?.receipt_id ?? null,
      ps3_or_later_transition_present: transitions.some((row) => isPs3OrLater(row.from_state) || isPs3OrLater(row.to_state)),
      ps3_transition_append_allowed_now: false,
      candidate_manifest_write_allowed_now: false,
      apply_allowed_now: false,
      authority_flags: AUTHORITY_CLOSED,
    };
  });
}

function buildBoundary(productSource, transitionSource, stageRows) {
  return {
    schema_version: "factory-stage-boundary.v1",
    read_only: true,
    product_source_tier: productSource.source_tier,
    transition_source_tiers: transitionSource.source_tiers,
    product_count: stageRows.length,
    transition_count: transitionSource.transitions.length,
    ps3_transition_handler_enabled: false,
    ps3_transition_append_allowed_now: false,
    candidate_manifest_write_allowed_now: false,
    apply_allowed_now: false,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function buildValidationItems(productSource, transitionSource, stageRows, boundary) {
  const productIds = new Set(productSource.products.map((row) => row.product_id));
  const unknownTransitionProducts = transitionSource.transitions.filter((row) => !productIds.has(row.product_id));
  return [
    validationItem("products.available", "source", productSource.available && productSource.products.length > 0, productSource.error ?? "Factory products are available"),
    validationItem("transitions.available", "source", transitionSource.available, transitionSource.error ?? "Factory transitions are available"),
    validationItem("stage.rows.present", "read_model", stageRows.length > 0, "Factory stage rows are present"),
    validationItem("stage.known_states", "read_model", stageRows.every((row) => row.current_stage_rank >= 0), "Factory stage rows use known PS states"),
    validationItem("stage.no_unknown_transition_products", "scope", unknownTransitionProducts.length === 0, "Factory transitions reference unknown product ids"),
    validationItem("stage.no_ps3_transition_present", "authority", stageRows.every((row) => row.ps3_or_later_transition_present === false), "PS3+ transitions must not appear before FB promotion"),
    validationItem("boundary.ps3_closed", "authority", boundary.ps3_transition_handler_enabled === false && boundary.ps3_transition_append_allowed_now === false, "PS3 transition handler must remain closed"),
    validationItem("boundary.no_write", "authority", boundary.candidate_manifest_write_allowed_now === false && boundary.apply_allowed_now === false, "Factory stage read model must keep write/apply authority closed"),
    validationItem("boundary.authority_closed", "authority", allAuthorityClosed(boundary), "Factory stage read model authority flags must remain closed"),
  ];
}

function buildSummary(productSource, transitionSource, stageRows, boundary, validation) {
  const ready = validation.valid && productSource.available && transitionSource.available && stageRows.length > 0 && allAuthorityClosed(boundary);
  return {
    factory_stage_read_model_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    product_source_tier: productSource.source_tier,
    transition_source_tiers: transitionSource.source_tiers,
    product_count: stageRows.length,
    transition_count: transitionSource.transitions.length,
    state_counts: countBy(stageRows, (row) => row.current_product_state),
    ps3_transition_handler_enabled: false,
    ps3_transition_append_allowed_now: false,
    candidate_manifest_write_allowed_now: false,
    apply_allowed_now: false,
    validation_errors: validation.errors.length,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function renderMarkdown(result) {
  return [
    "# Factory Stage Read Model",
    "",
    `Status: ${result.summary.factory_stage_read_model_status}`,
    `Program: ${result.summary.program_range}`,
    `Products: ${result.summary.product_count}`,
    `Product source: ${result.summary.product_source_tier}`,
    `Transitions: ${result.summary.transition_count}`,
    `PS3 transition append allowed: ${result.summary.ps3_transition_append_allowed_now}`,
    `Candidate manifest write allowed: ${result.summary.candidate_manifest_write_allowed_now}`,
    `Apply allowed: ${result.summary.apply_allowed_now}`,
    `Validation errors: ${result.summary.validation_errors}`,
    "",
  ].join("\n");
}

function validationItem(itemId, category, pass, message) {
  return {
    schema_version: "factory-stage-validation-item.v1",
    item_id: itemId,
    category,
    current_verdict: pass ? "pass" : "block",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.current_verdict !== "pass");
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

function unique(items) {
  return [...new Set(items)];
}

function countBy(items, keyFn) {
  return Object.fromEntries([...groupBy(items, keyFn)].map(([key, rows]) => [key, rows.length]));
}

function sortTransitions(transitions) {
  return [...transitions].sort((left, right) => {
    const createdAtOrder = String(left.created_at ?? "").localeCompare(String(right.created_at ?? ""));
    if (createdAtOrder !== 0) return createdAtOrder;
    return String(left.transition_id ?? "").localeCompare(String(right.transition_id ?? ""));
  });
}

function stageRank(productState) {
  return STAGE_LADDER.findIndex(([state]) => state === productState);
}

function isPs3OrLater(productState = "") {
  const rank = stageRank(productState);
  const ps3Rank = stageRank("PS3_candidate_ready");
  return rank >= ps3Rank && ps3Rank >= 0;
}

function allAuthorityClosed(value) {
  return Object.entries(AUTHORITY_CLOSED).every(([key, expected]) => value[key] === expected);
}

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection,
    count: items.length,
    items,
  };
}

function serializableResult(result) {
  const { markdown, ...json } = result;
  return json;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const args = {
    outDir: DEFAULT_FACTORY_STAGE_READ_MODEL_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") args.check = true;
    else if (arg === "--require-pass") args.requirePass = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--factory-ledger-dir" || arg === "--ledger-dir") args.factoryLedgerDir = argv[++index];
    else if (arg === "--factory-seed-dir" || arg === "--seed-dir") args.factorySeedDir = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/factory-stage-read-model.mjs [options]

Options:
  --check                 Fail when the stage read model is not ready.
  --require-pass          Require ready_factory_stage_read_model.
  --out-dir <path>        Output artifact directory.
  --factory-ledger-dir    Factory operational ledger directory.
  --factory-seed-dir      Factory tracked seed directory.
  --run-at <iso>          Deterministic timestamp.
  -h, --help              Show this help.
`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runFactoryStageReadModelCli();
}
