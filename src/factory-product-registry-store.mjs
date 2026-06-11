import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_FACTORY_PRODUCT_REGISTRY_STORE_OUT_DIR = "artifacts/factory-product-registry-store/latest";
export const DEFAULT_FACTORY_PRODUCT_REGISTRY_STORE_INPUTS = {
  productRegistrySchemaPath: "schemas/factory-product-registry-store.schema.json",
  receiptEnvelopeSchemaPath: "schemas/factory-receipt-envelope.schema.json",
  stateStoreDocPath: "docs/factory-state-store.md",
  gitignorePath: ".gitignore",
};

const COMMAND_NAME = "platform:factory-product-registry-store";
const SCHEMA_VERSION = "factory-product-registry-store.v1";
const CAPABILITY_ID = "factory.product_registry_store";
const PROGRAM_RANGE = "FCORE-FA.1";
const READY_STATUS = "ready_factory_product_registry_store_schema_contracts";
const BLOCKED_STATUS = "blocked_factory_product_registry_store_schema_contracts";

const AUTHORITY_CLOSED = {
  project_creation_allowed_now: false,
  repo_write_allowed_now: false,
  connector_write_allowed_now: false,
  deployment_allowed_now: false,
  protected_action_allowed_now: false,
  production_pass_enabled: false,
  enterprise_pass_enabled: false,
};

export async function runFactoryProductRegistryStore(options = {}) {
  const result = await buildFactoryProductRegistryStore(options);
  if (options.write !== false) await writeFactoryProductRegistryStore(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Product Registry Store failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (options.requirePass && result.summary.schema_contracts_ready !== true) {
    const error = new Error("Factory Product Registry Store schema contracts are not ready.");
    error.summary = result.summary;
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildFactoryProductRegistryStore(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_PRODUCT_REGISTRY_STORE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const productSchema = await readJsonSource(inputs.product_registry_schema_path);
  const receiptSchema = await readJsonSource(inputs.receipt_envelope_schema_path);
  const stateStoreDoc = await readTextSource(inputs.state_store_doc_path);
  const gitignore = await readTextSource(inputs.gitignore_path);
  const samples = buildSamples(generatedAt);
  const boundary = buildBoundary({ gitignore });
  const validationItems = buildValidationItems({ productSchema, receiptSchema, stateStoreDoc, gitignore, samples, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      product_registry_schema_path: productSchema.path,
      receipt_envelope_schema_path: receiptSchema.path,
      state_store_doc_path: stateStoreDoc.path,
      gitignore_path: gitignore.path,
    },
    store_policy: {
      tracked_seed_root: "data/factory/seed/",
      local_operational_ledger_root: "data/factory/local/",
      raw_confidential_material_tracked_allowed: false,
      local_operational_ledger_gitignored: boundary.local_operational_ledger_gitignored,
    },
    product_record_sample: samples.productRecord,
    state_transition_sample: samples.stateTransition,
    receipt_envelope_sample: samples.receiptEnvelope,
    factory_product_registry_store_boundary: boundary,
    factory_product_registry_store_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = productSchema.available
    ? validateAgainstSchema(result, productSchema.data, {}, "factory_product_registry_store")
    : [{ path: "schema", message: productSchema.error ?? "Product registry schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message, error.path));
  result.factory_product_registry_store_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.factory_product_registry_store_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryProductRegistryStore(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-product-registry-store.json"), serializableResult(result));
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-product-registry-store-validation-items.v1", "validation_items", result.factory_product_registry_store_validation_items, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_product_registry_store_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryProductRegistryStoreCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryProductRegistryStore(args);
    console.log(`Factory Product Registry Store ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_product_registry_store_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Schema contracts ready: ${result.summary.schema_contracts_ready}`);
    console.log(`Local ledger gitignored: ${result.summary.local_operational_ledger_gitignored}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    if (error.summary) console.error(`- schema_contracts_ready: ${error.summary.schema_contracts_ready}`);
    process.exitCode = 1;
    return null;
  }
}

function buildSamples(generatedAt) {
  const payloadSha = sha256("factory-product-registry-store.fa1.sample");
  const productRecord = {
    schema_version: "product-record.v1",
    product_id: "product.hermes_harness",
    tenant_id: "tenant.local",
    workspace_id: "workspace.factory",
    domain_pack_ids: ["pack.personal_dev"],
    product_state: "PS0_seed",
    created_at: generatedAt,
    updated_at: generatedAt,
    authority_flags: AUTHORITY_CLOSED,
  };
  const stateTransition = {
    schema_version: "product-state-transition.v1",
    transition_id: "transition.hermes_harness.ps0_seed",
    product_id: "product.hermes_harness",
    from_state: "PS0_seed",
    to_state: "PS1_schema_valid",
    receipt_id: "rcpt-fa1-schema-contracts",
    payload_sha256: payloadSha,
    prev_entry_hash: null,
    created_at: generatedAt,
    authority_flags: AUTHORITY_CLOSED,
  };
  const receiptEnvelope = {
    schema_version: "factory-receipt-envelope.v1",
    receipt_id: "rcpt-fa1-schema-contracts",
    receipt_kind: "schema_contract_readiness",
    issued_at: generatedAt,
    issuer: {
      issuer_role: "codex_implementer",
      issuer_id: "codex",
      engine_resolved_model_id: null,
    },
    subject: {
      product_id: "product.hermes_harness",
      artifact_id: "artifact.factory_schema_contracts",
      scope_id: "FCORE-FA.1",
      reviewed_commit_sha: null,
    },
    payload_sha256: payloadSha,
    prev_entry_hash: null,
    authority_flags: AUTHORITY_CLOSED,
  };
  return { productRecord, stateTransition, receiptEnvelope };
}

function buildBoundary({ gitignore }) {
  return {
    tracked_seed_root: "data/factory/seed/",
    local_operational_ledger_root: "data/factory/local/",
    local_operational_ledger_gitignored: gitignore.text.includes("data/factory/local/"),
    raw_confidential_material_tracked_allowed: false,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function buildValidationItems({ productSchema, receiptSchema, stateStoreDoc, gitignore, samples, boundary }) {
  const items = [
    validationItem("schema.product.available", "schema", productSchema.available === true, "Product registry schema unavailable", productSchema.path),
    validationItem("schema.receipt.available", "schema", receiptSchema.available === true, "Receipt envelope schema unavailable", receiptSchema.path),
    validationItem("doc.state_store.available", "documentation", stateStoreDoc.available === true, "Factory state store doc unavailable", stateStoreDoc.path),
    validationItem("gitignore.local_ledger", "store_policy", boundary.local_operational_ledger_gitignored === true, "Local operational ledger root is not gitignored", gitignore.path),
    validationItem("boundary.authority_closed", "authority", allAuthorityClosed(boundary), "Factory schema contract opened authority", "factory_product_registry_store_boundary"),
  ];
  if (productSchema.available) {
    items.push(...validateAgainstSchema(samples.productRecord, productSchema.data.$defs.productRecord, {}, "product_record_sample", productSchema.data)
      .map((error, index) => validationItem(`sample.product.${index}`, "schema_sample", false, error.message, error.path)));
    items.push(...validateAgainstSchema(samples.stateTransition, productSchema.data.$defs.productStateTransition, {}, "state_transition_sample", productSchema.data)
      .map((error, index) => validationItem(`sample.transition.${index}`, "schema_sample", false, error.message, error.path)));
  }
  if (receiptSchema.available) {
    items.push(...validateAgainstSchema(samples.receiptEnvelope, receiptSchema.data, {}, "receipt_envelope_sample")
      .map((error, index) => validationItem(`sample.receipt.${index}`, "schema_sample", false, error.message, error.path)));
  }
  if (stateStoreDoc.available) {
    for (const term of ["data/factory/seed/", "data/factory/local/", "product-record.v1", "product-state-transition.v1", "factory-receipt-envelope.v1"]) {
      items.push(validationItem(`doc.term.${slug(term)}`, "documentation", stateStoreDoc.text.includes(term), `Factory state store doc missing ${term}`, stateStoreDoc.path));
    }
  }
  return items;
}

function buildSummary({ boundary, validation }) {
  const ready = validation.valid === true && boundary.local_operational_ledger_gitignored === true && allAuthorityClosed(boundary);
  return {
    factory_product_registry_store_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    schema_contracts_ready: ready,
    tracked_seed_root: "data/factory/seed/",
    local_operational_ledger_root: "data/factory/local/",
    local_operational_ledger_gitignored: boundary.local_operational_ledger_gitignored,
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

function allAuthorityClosed(value) {
  return [
    "project_creation_allowed_now",
    "repo_write_allowed_now",
    "connector_write_allowed_now",
    "deployment_allowed_now",
    "protected_action_allowed_now",
    "production_pass_enabled",
    "enterprise_pass_enabled",
  ].every((key) => value[key] === false);
}

function validationItem(itemId, category, observed, message, pathRef = null) {
  return {
    item_id: itemId,
    category,
    observed,
    current_verdict: observed ? "pass" : "fail",
    message: observed ? "OK" : message,
    path: pathRef,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.current_verdict !== "pass");
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function renderMarkdown(result) {
  return [
    "# Factory Product Registry Store",
    "",
    `Status: ${result.summary.factory_product_registry_store_status}`,
    `Program: ${result.program_range}`,
    `Schema contracts ready: ${result.summary.schema_contracts_ready}`,
    `Tracked seed root: ${result.summary.tracked_seed_root}`,
    `Local operational ledger root: ${result.summary.local_operational_ledger_root}`,
    `Local operational ledger gitignored: ${result.summary.local_operational_ledger_gitignored}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    `Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Validation",
    "",
    `Valid: ${result.validation.valid}`,
    `Errors: ${result.validation.errors.length}`,
    "",
  ].join("\n");
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(path.resolve(filePath), "utf8");
    return { available: true, parseable: true, path: filePath, data: JSON.parse(text), text };
  } catch (error) {
    return { available: false, parseable: false, path: filePath, data: null, text: "", error: error.message };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(path.resolve(filePath), "utf8");
    return { available: true, path: filePath, text };
  } catch (error) {
    return { available: false, path: filePath, text: "", error: error.message };
  }
}

function normalizeInputs(options) {
  return {
    product_registry_schema_path: options.productRegistrySchemaPath ?? DEFAULT_FACTORY_PRODUCT_REGISTRY_STORE_INPUTS.productRegistrySchemaPath,
    receipt_envelope_schema_path: options.receiptEnvelopeSchemaPath ?? DEFAULT_FACTORY_PRODUCT_REGISTRY_STORE_INPUTS.receiptEnvelopeSchemaPath,
    state_store_doc_path: options.stateStoreDocPath ?? DEFAULT_FACTORY_PRODUCT_REGISTRY_STORE_INPUTS.stateStoreDocPath,
    gitignore_path: options.gitignorePath ?? DEFAULT_FACTORY_PRODUCT_REGISTRY_STORE_INPUTS.gitignorePath,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--check") {
      args.check = true;
      args.write = false;
    } else if (value === "--require-pass") args.requirePass = true;
    else if (value === "--out-dir") args.outDir = argv[++index];
    else if (value === "--product-registry-schema-path") args.productRegistrySchemaPath = argv[++index];
    else if (value === "--receipt-envelope-schema-path") args.receiptEnvelopeSchemaPath = argv[++index];
    else if (value === "--state-store-doc-path") args.stateStoreDocPath = argv[++index];
    else if (value === "--gitignore-path") args.gitignorePath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--require-pass]`);
  console.log("Validates FA.1 factory product registry schemas, receipt envelope schema, and split-store documentation.");
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, [key]: rows };
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
