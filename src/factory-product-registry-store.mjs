import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_FACTORY_PRODUCT_REGISTRY_STORE_OUT_DIR = "artifacts/factory-product-registry-store/latest";
export const DEFAULT_FACTORY_LEDGER_DIR = "data/factory/local";
export const DEFAULT_FACTORY_SEED_DIR = "data/factory/seed";
export const FACTORY_LEDGER_FILES = {
  products: "products.jsonl",
  state_transitions: "state-transitions.jsonl",
  receipts_index: "receipts-index.jsonl",
};
export const DEFAULT_FACTORY_PRODUCT_REGISTRY_STORE_INPUTS = {
  productRegistrySchemaPath: "schemas/factory-product-registry-store.schema.json",
  receiptEnvelopeSchemaPath: "schemas/factory-receipt-envelope.schema.json",
  stateStoreDocPath: "docs/factory-state-store.md",
  gitignorePath: ".gitignore",
  ledgerDir: DEFAULT_FACTORY_LEDGER_DIR,
  seedDir: DEFAULT_FACTORY_SEED_DIR,
};

const COMMAND_NAME = "platform:factory-product-registry-store";
const SCHEMA_VERSION = "factory-product-registry-store.v1";
const CAPABILITY_ID = "factory.product_registry_store";
const PROGRAM_RANGE = "FCORE-FA.4";
const READY_STATUS = "ready_factory_seed_migration";
const BLOCKED_STATUS = "blocked_factory_seed_migration";
const SEED_MIGRATION_COMMAND_NAME = "factory:seed-migration";
const SEED_MIGRATION_RECEIPT_ID = "rcpt-fa4-seed-migration";
const HASH_RE = /^[a-f0-9]{64}$/;
const LEDGER_LOCKS = new Map();
const RECEIPT_DRIVEN_TRANSITIONS = [
  ["PS0_seed", "PS1_schema_valid"],
  ["PS1_schema_valid", "PS2_receipt_bound"],
];

const FACTORY_SEED_PRODUCT_SPECS = [
  ["control_plan", "product.hr_solution_internalization", "project.hr_solution_internalization", "HR Solution", ["pack.human_resources"], "src/product-domain-saas-factory.mjs", "SAAS_PROJECT_SPECS"],
  ["control_plan", "product.law_firm_os", "project.law_firm_os", "Law Firm OS", ["pack.law_firm"], "src/product-domain-saas-factory.mjs", "SAAS_PROJECT_SPECS"],
  ["control_plan", "product.hermes_harness", "project.hermes_harness", "Hermes Harness", ["pack.platform"], "src/product-domain-saas-factory.mjs", "SAAS_PROJECT_SPECS"],
  ["control_plan", "product.zendd_bridge", "project.zendd_bridge", "Zendd Bridge", ["pack.external_adapter"], "src/product-domain-saas-factory.mjs", "SAAS_PROJECT_SPECS"],
  ["fixture_portfolio", "product.fixture_hermes", "project.hermes", "Hermes Harness", ["pack.personal_dev"], "src/work-os-live-control-surface.mjs", "PROJECT_SPECS"],
  ["fixture_portfolio", "product.fixture_law_firm_os", "project.law_firm_os", "Law Firm OS", ["pack.law_firm"], "src/work-os-live-control-surface.mjs", "PROJECT_SPECS"],
  ["fixture_portfolio", "product.fixture_hr_solution", "project.hr_solution", "HR Solution", ["pack.personal_dev"], "src/work-os-live-control-surface.mjs", "PROJECT_SPECS"],
  ["fixture_portfolio", "product.fixture_zendd_bridge", "project.zendd_bridge", "Zendd Bridge", ["pack.law_firm"], "src/work-os-live-control-surface.mjs", "PROJECT_SPECS"],
  ["fixture_portfolio", "product.fixture_trading_read_only", "project.trading_read_only", "Trading Read-Only", ["pack.trading"], "src/work-os-live-control-surface.mjs", "PROJECT_SPECS"],
];

const AUTHORITY_CLOSED = {
  project_creation_allowed_now: false,
  review_decision_allowed_now: false,
  approval_allowed_now: false,
  apply_allowed_now: false,
  apply_engine_runtime_enabled_now: false,
  rollback_executor_runtime_enabled_now: false,
  source_file_write_allowed_now: false,
  ledger_append_allowed_now: false,
  persistent_ledger_append_allowed_now: false,
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
  if (options.requirePass && result.summary.tracked_seed_migration_ready !== true) {
    const error = new Error("Factory Product Registry Store seed migration is not ready.");
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
  const ledgerStore = await verifyFactoryLedgerStore({
    ...options,
    ledgerDir: inputs.ledger_dir,
    productRegistrySchemaPath: inputs.product_registry_schema_path,
    receiptEnvelopeSchemaPath: inputs.receipt_envelope_schema_path,
  });
  const seedMigration = await verifyFactorySeedMigration({
    ...options,
    seedDir: inputs.seed_dir,
    productRegistrySchemaPath: inputs.product_registry_schema_path,
    receiptEnvelopeSchemaPath: inputs.receipt_envelope_schema_path,
  });
  const samples = buildSamples(generatedAt);
  const boundary = buildBoundary({ gitignore, ledgerStore, seedMigration });
  const validationItems = buildValidationItems({
    productSchema,
    receiptSchema,
    stateStoreDoc,
    gitignore,
    ledgerStore,
    seedMigration,
    samples,
    boundary,
  });
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
      ledger_dir: ledgerStore.ledger_dir,
      seed_dir: seedMigration.seed_dir,
    },
    store_policy: {
      tracked_seed_root: "data/factory/seed/",
      local_operational_ledger_root: "data/factory/local/",
      raw_confidential_material_tracked_allowed: false,
      local_operational_ledger_gitignored: boundary.local_operational_ledger_gitignored,
      seed_migration_command_name: SEED_MIGRATION_COMMAND_NAME,
      tracked_seed_migration_ready: seedMigration.validation.valid,
    },
    product_record_sample: samples.productRecord,
    state_transition_sample: samples.stateTransition,
    receipt_envelope_sample: samples.receiptEnvelope,
    ledger_store_summary: ledgerStore.summary,
    ledger_store_files: ledgerStore.files,
    seed_migration_summary: seedMigration.summary,
    seed_migration_files: seedMigration.files,
    factory_product_registry_store_boundary: boundary,
    factory_product_registry_store_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, ledgerStore, seedMigration, validation: preliminaryValidation }),
  };

  const schemaErrors = productSchema.available
    ? validateAgainstSchema(result, productSchema.data, {}, "factory_product_registry_store")
    : [{ path: "schema", message: productSchema.error ?? "Product registry schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message, error.path));
  result.factory_product_registry_store_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.factory_product_registry_store_validation_items);
  result.summary = buildSummary({ boundary, ledgerStore, seedMigration, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryProductRegistryStore(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-product-registry-store.json"), serializableResult(result));
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-product-registry-store-validation-items.v1", "validation_items", result.factory_product_registry_store_validation_items, result.generated_at));
  await writeJson(path.join(outDir, "ledger-store-summary.json"), result.ledger_store_summary);
  await writeJson(path.join(outDir, "seed-migration-summary.json"), result.seed_migration_summary);
  await writeJson(path.join(outDir, "boundary.json"), result.factory_product_registry_store_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function appendFactoryLedgerEntry(ledgerName, draftEntry, options = {}) {
  assertKnownLedgerName(ledgerName);
  const ledgerFile = resolveFactoryLedgerFile(ledgerName, options);
  return withLedgerLock(ledgerFile, async () => {
    assertLedgerWriteAllowed(options);
    await mkdir(path.dirname(ledgerFile), { recursive: true });
    const ledger = await readFactoryLedgerFile(ledgerName, options);
    if (!ledger.validation.valid) {
      throwValidationError(`Cannot append to invalid ${ledgerName} ledger.`, ledger.validation.errors);
    }

    const previousHash = ledger.valid_entries.at(-1)?.entry_hash ?? null;
    const expectedPayloadHash = computeFactoryPayloadHash(draftEntry);
    if (draftEntry.payload_sha256 !== undefined && draftEntry.payload_sha256 !== expectedPayloadHash) {
      throwValidationError("Factory ledger append rejected: payload_sha256 does not match canonical payload.", [
        ledgerError("append.payload_sha256", "hash", `Expected payload_sha256 ${expectedPayloadHash}`, ledgerFile),
      ]);
    }
    if (Object.prototype.hasOwnProperty.call(draftEntry, "prev_entry_hash") && draftEntry.prev_entry_hash !== previousHash) {
      throwValidationError("Factory ledger append rejected: prev_entry_hash does not match current ledger tail.", [
        ledgerError("append.prev_entry_hash", "hash_chain", `Expected prev_entry_hash ${previousHash}`, ledgerFile),
      ]);
    }

    const row = {
      ...draftEntry,
      payload_sha256: expectedPayloadHash,
      prev_entry_hash: previousHash,
    };
    const schemaErrors = await validateFactoryLedgerRow(ledgerName, row, options);
    if (schemaErrors.length > 0) {
      throwValidationError(`Factory ledger append rejected: ${ledgerName} row failed schema validation.`, schemaErrors.map((error, index) => ledgerError(`append.schema.${index}`, "schema", error.message, error.path)));
    }

    const expectedEntryHash = computeFactoryEntryHash(ledgerName, row);
    if (draftEntry.entry_hash !== undefined && draftEntry.entry_hash !== expectedEntryHash) {
      throwValidationError("Factory ledger append rejected: entry_hash does not match canonical row.", [
        ledgerError("append.entry_hash", "hash_chain", `Expected entry_hash ${expectedEntryHash}`, ledgerFile),
      ]);
    }

    const stored = { ...row, entry_hash: expectedEntryHash };
    await appendFile(ledgerFile, `${canonicalize(stored)}\n`, "utf8");
    return stored;
  });
}

export async function readFactoryProductScope(options = {}) {
  const productId = options.productId;
  if (!productId) throw new Error("Factory product scoped read requires product_id.");
  if (options.scopeProductId && options.scopeProductId !== productId) {
    throw new Error(`Factory product scoped read rejected: ${productId} is outside ${options.scopeProductId}.`);
  }

  const store = await verifyFactoryLedgerStore(options);
  if (!store.validation.valid) throwValidationError("Factory product scoped read rejected: ledger validation failed.", store.validation.errors);
  return {
    schema_version: "factory-product-scope-read.v1",
    product_id: productId,
    ledger_dir: store.ledger_dir,
    products: store.files.products.entries.filter((row) => row.product_id === productId),
    state_transitions: store.files.state_transitions.entries.filter((row) => row.product_id === productId),
    receipts: store.files.receipts_index.entries.filter((row) => row.subject?.product_id === productId),
  };
}

export async function applyFactoryReceiptDrivenTransition(options = {}) {
  const {
    productId,
    fromState,
    toState,
    receipt,
    receiptPath,
    transitionId,
    createdAt = new Date().toISOString(),
  } = options;
  if (!productId) throw new Error("Factory receipt-driven transition requires product_id.");
  if (!fromState || !toState) throw new Error("Factory receipt-driven transition requires from_state and to_state.");
  if (!isAllowedReceiptDrivenTransition(fromState, toState)) {
    throw new Error(`Factory receipt-driven transition rejected: ${fromState} -> ${toState} is not enabled in FA.3.`);
  }

  const receiptEnvelope = receipt ?? await readReceiptEnvelope(receiptPath);
  if (!receiptEnvelope) throw new Error("Factory receipt-driven transition requires a receipt envelope.");
  const receiptId = receiptEnvelope.receipt_id;
  if (!receiptId) throw new Error("Factory receipt-driven transition receipt is missing receipt_id.");
  if (receiptEnvelope.subject?.product_id !== productId) {
    throw new Error(`Factory receipt-driven transition rejected: receipt product ${receiptEnvelope.subject?.product_id ?? "missing"} does not match ${productId}.`);
  }

  const scope = await readFactoryProductScope({ ...options, productId });
  const currentState = resolveCurrentProductState(scope);
  if (currentState !== fromState) {
    throw new Error(`Factory receipt-driven transition rejected: current state ${currentState ?? "missing"} does not match ${fromState}.`);
  }
  if (scope.state_transitions.some((row) => row.receipt_id === receiptId)) {
    throw new Error(`Factory receipt-driven transition rejected: receipt ${receiptId} was already used.`);
  }

  const transitionDraft = {
    schema_version: "product-state-transition.v1",
    transition_id: transitionId ?? `transition.${slug(productId)}.${slug(fromState)}.${slug(toState)}.${slug(receiptId)}`,
    product_id: productId,
    from_state: fromState,
    to_state: toState,
    receipt_id: receiptId,
    created_at: createdAt,
    authority_flags: AUTHORITY_CLOSED,
  };
  const expectedBoundPayload = computeFactoryPayloadHash(transitionDraft);
  if (receiptEnvelope.subject?.bound_transition_payload_sha256 !== expectedBoundPayload) {
    throw new Error(`Factory receipt-driven transition rejected: receipt bound_transition_payload_sha256 must equal ${expectedBoundPayload}.`);
  }

  const storedReceipt = await appendFactoryLedgerEntry("receipts_index", receiptEnvelope, options);
  const storedTransition = await appendFactoryLedgerEntry("state_transitions", transitionDraft, options);
  return {
    schema_version: "factory-receipt-driven-state-transition-result.v1",
    product_id: productId,
    from_state: fromState,
    to_state: toState,
    receipt_id: receiptId,
    stored_receipt: storedReceipt,
    stored_transition: storedTransition,
  };
}

export async function verifyFactoryLedgerStore(options = {}) {
  const files = {};
  for (const ledgerName of Object.keys(FACTORY_LEDGER_FILES)) {
    files[ledgerName] = await readFactoryLedgerFile(ledgerName, options);
  }
  const errors = Object.values(files).flatMap((file) => file.validation.errors);
  const validation = { valid: errors.length === 0, error_count: errors.length, errors };
  const totalEntries = Object.values(files).reduce((sum, file) => sum + file.entries.length, 0);
  const summary = {
    schema_version: "factory-ledger-store-summary.v1",
    ledger_dir: path.resolve(options.ledgerDir ?? DEFAULT_FACTORY_LEDGER_DIR),
    append_jsonl_store_ready: validation.valid,
    receipt_driven_transition_handlers_ready: true,
    ps3_transition_handler_enabled: false,
    ledger_file_count: Object.keys(files).length,
    ledger_total_entry_count: totalEntries,
    products_entry_count: files.products.entries.length,
    state_transition_entry_count: files.state_transitions.entries.length,
    receipts_index_entry_count: files.receipts_index.entries.length,
    ledger_validation_errors: validation.errors.length,
  };
  return {
    schema_version: "factory-ledger-store-validation.v1",
    ledger_dir: summary.ledger_dir,
    files,
    validation,
    summary,
  };
}

export async function writeFactorySeedMigration(options = {}) {
  if (options.check || options.write === false) {
    throw new Error("Factory seed migration write rejected: --check/no-write mode is active.");
  }
  const seedDir = path.resolve(options.seedDir ?? DEFAULT_FACTORY_SEED_DIR);
  const defaultSeedDir = path.resolve(DEFAULT_FACTORY_SEED_DIR);
  const tempDir = path.resolve(os.tmpdir());
  const testRootAllowed = options.allowTestSeedRoot === true && isInsideOrEqual(seedDir, tempDir);
  if (!isInsideOrEqual(seedDir, defaultSeedDir) && !testRootAllowed) {
    throw new Error(`Factory seed migration write rejected: seed dir must stay under ${defaultSeedDir}.`);
  }

  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const migration = buildFactorySeedMigrationRows(generatedAt);
  await mkdir(seedDir, { recursive: true });
  await writeFile(path.join(seedDir, FACTORY_LEDGER_FILES.products), `${migration.products.map(canonicalize).join("\n")}\n`, "utf8");
  await writeFile(path.join(seedDir, FACTORY_LEDGER_FILES.receipts_index), `${migration.receipts_index.map(canonicalize).join("\n")}\n`, "utf8");
  await writeFile(path.join(seedDir, FACTORY_LEDGER_FILES.state_transitions), "", "utf8");
  return verifyFactorySeedMigration({ ...options, seedDir });
}

export async function verifyFactorySeedMigration(options = {}) {
  const seedDir = path.resolve(options.seedDir ?? DEFAULT_FACTORY_SEED_DIR);
  const files = {};
  for (const ledgerName of Object.keys(FACTORY_LEDGER_FILES)) {
    files[ledgerName] = await readFactoryLedgerFile(ledgerName, {
      ...options,
      ledgerDir: seedDir,
    });
  }

  const expectedProductIds = new Set(FACTORY_SEED_PRODUCT_SPECS.map(([, productId]) => productId));
  const productIds = new Set(files.products.entries.map((row) => row.product_id));
  const receiptIds = new Set(files.products.entries.map((row) => row.receipt_id));
  const migrationReceipt = files.receipts_index.entries.find((row) => row.receipt_id === SEED_MIGRATION_RECEIPT_ID);
  const serializedProducts = JSON.stringify(files.products.entries);
  const validationItems = [
    seedValidationItem("seed.products.valid", files.products.validation.valid, "Seed products ledger hash chain is invalid", files.products.file_path),
    seedValidationItem("seed.receipts.valid", files.receipts_index.validation.valid, "Seed receipts ledger hash chain is invalid", files.receipts_index.file_path),
    seedValidationItem("seed.transitions.empty_or_valid", files.state_transitions.validation.valid && files.state_transitions.entries.length === 0, "Seed state transitions must be empty and valid in FA.4", files.state_transitions.file_path),
    seedValidationItem("seed.products.count", files.products.entries.length === 9, "Seed migration must include 9 product records", files.products.file_path),
    seedValidationItem("seed.receipts.count", files.receipts_index.entries.length === 1, "Seed migration must include 1 migration receipt", files.receipts_index.file_path),
    seedValidationItem("seed.products.expected_ids", sameSet(productIds, expectedProductIds), "Seed migration product ids do not match the FA.4 source set", files.products.file_path),
    seedValidationItem("seed.products.receipt_binding", receiptIds.size === 1 && receiptIds.has(SEED_MIGRATION_RECEIPT_ID), "Seed product records must bind to the FA.4 migration receipt", files.products.file_path),
    seedValidationItem("seed.receipt.kind", migrationReceipt?.receipt_kind === "migration", "Seed receipt must be a migration receipt", files.receipts_index.file_path),
    seedValidationItem("seed.receipt.product_count", migrationReceipt?.migrated_product_count === 9, "Seed receipt must bind the 9 migrated product records", files.receipts_index.file_path),
    seedValidationItem("seed.raw_confidential_absent", !/(secret|token|password|client_document|transcript_body|external_connector_payload)/i.test(serializedProducts), "Tracked seed must not contain raw confidential material", files.products.file_path),
    seedValidationItem("seed.authority_closed", files.products.entries.every((row) => allAuthorityClosed(row.authority_flags ?? {})) && files.receipts_index.entries.every((row) => allAuthorityClosed(row.authority_flags ?? {})), "Seed migration opened authority flags", seedDir),
  ];
  const errors = [
    ...Object.values(files).flatMap((file) => file.validation.errors),
    ...validationItems.filter((item) => item.current_verdict !== "pass"),
  ];
  const validation = { valid: errors.length === 0, error_count: errors.length, errors };
  return {
    schema_version: "factory-seed-migration-validation.v1",
    seed_dir: seedDir,
    files,
    validation_items: validationItems,
    validation,
    summary: {
      schema_version: "factory-seed-migration-summary.v1",
      seed_dir: seedDir,
      seed_migration_status: validation.valid ? "ready_factory_seed_migration" : "blocked_factory_seed_migration",
      migrated_product_record_count: files.products.entries.length,
      migration_receipt_count: files.receipts_index.entries.length,
      seed_state_transition_count: files.state_transitions.entries.length,
      expected_product_record_count: 9,
      migration_receipt_id: SEED_MIGRATION_RECEIPT_ID,
      migration_receipt_recorded: Boolean(migrationReceipt),
      seed_validation_errors: errors.length,
    },
  };
}

export async function runFactorySeedMigrationCli(argv = process.argv.slice(2)) {
  const args = parseSeedMigrationArgs(argv);
  if (args.help) {
    printSeedMigrationHelp();
    return null;
  }
  try {
    const result = args.check
      ? await verifyFactorySeedMigration(args)
      : await writeFactorySeedMigration(args);
    if (args.requirePass && !result.validation.valid) {
      const error = new Error("Factory seed migration is not ready.");
      error.validation = result.validation;
      throw error;
    }
    console.log(`Factory Seed Migration ${args.check ? "validated" : "written"} at ${result.seed_dir}`);
    console.log(`Status: ${result.summary.seed_migration_status}`);
    console.log(`Products: ${result.summary.migrated_product_record_count}/9`);
    console.log(`Migration receipts: ${result.summary.migration_receipt_count}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

export async function readFactoryLedgerFile(ledgerName, options = {}) {
  assertKnownLedgerName(ledgerName);
  const filePath = resolveFactoryLedgerFile(ledgerName, options);
  let text = "";
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return emptyLedgerFile(ledgerName, filePath);
  }

  const rawLines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const schemaContext = await loadFactoryLedgerSchemas(options);
  const entries = [];
  const errors = [...schemaContext.errors];
  let expectedPrevHash = null;
  let firstInvalidLineIndex = null;
  let validPrefixLineCount = 0;

  rawLines.forEach((line, index) => {
    const lineNumber = index + 1;
    let row;
    const rowErrors = [];
    try {
      row = JSON.parse(line);
      entries.push(row);
    } catch (error) {
      rowErrors.push(ledgerError(`${ledgerName}.${lineNumber}.json`, "parse", error.message, filePath));
      entries.push({ parse_error: error.message, raw_line: line });
    }

    if (row) {
      const expectedPayloadHash = computeFactoryPayloadHash(row);
      const expectedEntryHash = computeFactoryEntryHash(ledgerName, row);
      if (row.payload_sha256 !== expectedPayloadHash) {
        rowErrors.push(ledgerError(`${ledgerName}.${lineNumber}.payload_sha256`, "hash", `Expected payload_sha256 ${expectedPayloadHash}`, filePath));
      }
      if (row.prev_entry_hash !== expectedPrevHash) {
        rowErrors.push(ledgerError(`${ledgerName}.${lineNumber}.prev_entry_hash`, "hash_chain", `Expected prev_entry_hash ${expectedPrevHash}`, filePath));
      }
      if (!HASH_RE.test(row.entry_hash ?? "") || row.entry_hash !== expectedEntryHash) {
        rowErrors.push(ledgerError(`${ledgerName}.${lineNumber}.entry_hash`, "hash_chain", `Expected entry_hash ${expectedEntryHash}`, filePath));
      }
      rowErrors.push(...validateFactoryLedgerRowWithSchemas(ledgerName, row, schemaContext).map((error, errorIndex) => (
        ledgerError(`${ledgerName}.${lineNumber}.schema.${errorIndex}`, "schema", error.message, error.path)
      )));
    }

    if (rowErrors.length > 0) {
      if (firstInvalidLineIndex === null) firstInvalidLineIndex = index;
      errors.push(...rowErrors);
      return;
    }

    if (firstInvalidLineIndex === null) {
      validPrefixLineCount = lineNumber;
      expectedPrevHash = row.entry_hash;
    }
  });

  const validation = { valid: errors.length === 0, error_count: errors.length, errors };
  return {
    schema_version: "factory-ledger-file.v1",
    ledger_name: ledgerName,
    file_path: filePath,
    line_count: rawLines.length,
    raw_lines: rawLines,
    entries,
    valid_entries: entries.slice(0, validPrefixLineCount),
    valid_prefix_line_count: validPrefixLineCount,
    first_invalid_line_number: firstInvalidLineIndex === null ? null : firstInvalidLineIndex + 1,
    validation,
  };
}

export async function recoverFactoryLedgerFile(ledgerName, options = {}) {
  assertKnownLedgerName(ledgerName);
  const ledger = await readFactoryLedgerFile(ledgerName, options);
  if (ledger.validation.valid) {
    return recoveryReport(ledger, false, "ledger_already_valid");
  }
  if (options.check || options.write === false) {
    return recoveryReport(ledger, false, "check_mode_no_write");
  }
  assertLedgerWriteAllowed(options);
  await mkdir(path.dirname(ledger.file_path), { recursive: true });
  const recoveredLines = ledger.raw_lines.slice(0, ledger.valid_prefix_line_count);
  await writeFile(ledger.file_path, recoveredLines.length > 0 ? `${recoveredLines.join("\n")}\n` : "", "utf8");
  const recovered = await readFactoryLedgerFile(ledgerName, options);
  return {
    ...recoveryReport(recovered, true, "truncated_to_valid_prefix"),
    removed_line_count: ledger.raw_lines.length - recoveredLines.length,
  };
}

export function computeFactoryPayloadHash(row) {
  return sha256(canonicalize(omitKeys(row, ["payload_sha256", "prev_entry_hash", "entry_hash"])));
}

export function computeFactoryEntryHash(ledgerName, row) {
  return sha256(canonicalize({
    ledger_name: ledgerName,
    entry: omitKeys(row, ["entry_hash"]),
  }));
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
    console.log(`Append JSONL store ready: ${result.summary.append_jsonl_store_ready}`);
    console.log(`Receipt-driven transitions ready: ${result.summary.receipt_driven_transition_handlers_ready}`);
    console.log(`Tracked seed migration ready: ${result.summary.tracked_seed_migration_ready}`);
    console.log(`Local ledger gitignored: ${result.summary.local_operational_ledger_gitignored}`);
    console.log(`Ledger entries: ${result.summary.ledger_total_entry_count}`);
    console.log(`Seed products: ${result.summary.seed_product_record_count}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    if (error.summary) console.error(`- append_jsonl_store_ready: ${error.summary.append_jsonl_store_ready}`);
    process.exitCode = 1;
    return null;
  }
}

function buildSamples(generatedAt) {
  const productRecord = withFactoryLedgerHashes("products", {
    schema_version: "product-record.v1",
    product_id: "product.hermes_harness",
    tenant_id: "tenant.local",
    workspace_id: "workspace.factory",
    domain_pack_ids: ["pack.personal_dev"],
    product_state: "PS0_seed",
    receipt_id: "rcpt-fa2-append-ledger",
    created_at: generatedAt,
    updated_at: generatedAt,
    authority_flags: AUTHORITY_CLOSED,
  });
  const stateTransition = withFactoryLedgerHashes("state_transitions", {
    schema_version: "product-state-transition.v1",
    transition_id: "transition.hermes_harness.ps0_seed",
    product_id: "product.hermes_harness",
    from_state: "PS0_seed",
    to_state: "PS1_schema_valid",
    receipt_id: "rcpt-fa2-append-ledger",
    created_at: generatedAt,
    authority_flags: AUTHORITY_CLOSED,
  });
  const receiptEnvelope = withFactoryLedgerHashes("receipts_index", {
    schema_version: "factory-receipt-envelope.v1",
    receipt_id: "rcpt-fa2-append-ledger",
    receipt_kind: "schema_contract_readiness",
    issued_at: generatedAt,
    issuer: {
      issuer_role: "codex_implementer",
      issuer_id: "codex",
      engine_resolved_model_id: null,
    },
    subject: {
      product_id: "product.hermes_harness",
      artifact_id: "artifact.factory_append_ledger",
      scope_id: "FCORE-FA.3",
      bound_transition_payload_sha256: stateTransition.payload_sha256,
      reviewed_commit_sha: null,
    },
    authority_flags: AUTHORITY_CLOSED,
  });
  return { productRecord, stateTransition, receiptEnvelope };
}

function buildFactorySeedMigrationRows(generatedAt) {
  const products = [];
  let previousProductHash = null;
  for (const [seedRecordKind, productId, sourceProjectId, displayName, domainPackIds, sourceModule, sourceConst] of FACTORY_SEED_PRODUCT_SPECS) {
    const product = withFactoryLedgerHashes("products", {
      schema_version: "product-record.v1",
      product_id: productId,
      tenant_id: "tenant.factory_seed",
      workspace_id: "workspace.factory_seed",
      domain_pack_ids: domainPackIds,
      product_state: "PS0_seed",
      receipt_id: SEED_MIGRATION_RECEIPT_ID,
      created_at: generatedAt,
      updated_at: generatedAt,
      seed_record_kind: seedRecordKind,
      display_name: displayName,
      source_project_id: sourceProjectId,
      source_module: sourceModule,
      source_const: sourceConst,
      fallback_const_preserved: true,
      raw_confidential_material_included: false,
      authority_flags: AUTHORITY_CLOSED,
    }, previousProductHash);
    products.push(product);
    previousProductHash = product.entry_hash;
  }

  const receipt = withFactoryLedgerHashes("receipts_index", {
    schema_version: "factory-receipt-envelope.v1",
    receipt_id: SEED_MIGRATION_RECEIPT_ID,
    receipt_kind: "migration",
    issued_at: generatedAt,
    issuer: {
      issuer_role: "system",
      issuer_id: "factory-seed-migration",
      engine_resolved_model_id: null,
    },
    subject: {
      product_id: "product.hermes_harness",
      artifact_id: "artifact.factory_seed_migration",
      scope_id: "FCORE-FA.4",
      reviewed_commit_sha: null,
    },
    migrated_product_count: products.length,
    migrated_product_ids: products.map((row) => row.product_id),
    source_modules: [...new Set(products.map((row) => row.source_module))],
    products_ledger_tail_hash: products.at(-1)?.entry_hash ?? null,
    tracked_seed_root: "data/factory/seed/",
    local_operational_ledger_root: "data/factory/local/",
    fallback_const_preserved: true,
    raw_confidential_material_included: false,
    authority_flags: AUTHORITY_CLOSED,
  });

  return {
    products,
    state_transitions: [],
    receipts_index: [receipt],
  };
}

function withFactoryLedgerHashes(ledgerName, draft, prevEntryHash = null) {
  const payload_sha256 = computeFactoryPayloadHash(draft);
  const row = { ...draft, payload_sha256, prev_entry_hash: prevEntryHash };
  return { ...row, entry_hash: computeFactoryEntryHash(ledgerName, row) };
}

function buildBoundary({ gitignore, ledgerStore, seedMigration }) {
  return {
    tracked_seed_root: "data/factory/seed/",
    local_operational_ledger_root: "data/factory/local/",
    local_operational_ledger_gitignored: gitignore.text.includes("data/factory/local/"),
    raw_confidential_material_tracked_allowed: false,
    append_jsonl_store_ready: ledgerStore.validation.valid,
    receipt_driven_transition_handlers_ready: true,
    ps3_transition_handler_enabled: false,
    tracked_seed_migration_ready: seedMigration.validation.valid,
    migrated_seed_product_record_count: seedMigration.summary.migrated_product_record_count,
    migration_receipt_recorded: seedMigration.summary.migration_receipt_recorded,
    ledger_validation_errors: ledgerStore.validation.errors.length,
    seed_validation_errors: seedMigration.validation.errors.length,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  };
}

function buildValidationItems({ productSchema, receiptSchema, stateStoreDoc, gitignore, ledgerStore, seedMigration, samples, boundary }) {
  const items = [
    validationItem("schema.product.available", "schema", productSchema.available === true, "Product registry schema unavailable", productSchema.path),
    validationItem("schema.receipt.available", "schema", receiptSchema.available === true, "Receipt envelope schema unavailable", receiptSchema.path),
    validationItem("doc.state_store.available", "documentation", stateStoreDoc.available === true, "Factory state store doc unavailable", stateStoreDoc.path),
    validationItem("gitignore.local_ledger", "store_policy", boundary.local_operational_ledger_gitignored === true, "Local operational ledger root is not gitignored", gitignore.path),
    validationItem("ledger.store.valid", "ledger", ledgerStore.validation.valid === true, "Append JSONL ledger validation failed", ledgerStore.ledger_dir),
    validationItem("seed.migration.valid", "seed_migration", seedMigration.validation.valid === true, "Tracked seed migration is invalid or missing", seedMigration.seed_dir),
    validationItem("seed.migration.count", "seed_migration", seedMigration.summary.migrated_product_record_count === 9 && seedMigration.summary.migration_receipt_count === 1, "Tracked seed migration must contain 9 product records and 1 receipt", seedMigration.seed_dir),
    validationItem("transition.ps0_ps2_handlers_only", "state_transition", receiptDrivenHandlersClosed(), "FA.3 receipt-driven handlers must be limited to PS0-PS2", "src/factory-product-registry-store.mjs"),
    validationItem("boundary.authority_closed", "authority", allAuthorityClosed(boundary), "Factory schema contract opened authority", "factory_product_registry_store_boundary"),
  ];
  for (const [ledgerName, file] of Object.entries(ledgerStore.files)) {
    items.push(validationItem(`ledger.${ledgerName}.valid`, "ledger", file.validation.valid === true, `${ledgerName} ledger is invalid`, file.file_path));
  }
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
    for (const term of ["data/factory/seed/", "data/factory/local/", "products.jsonl", "state-transitions.jsonl", "receipts-index.jsonl", "product-record.v1", "product-state-transition.v1", "factory-receipt-envelope.v1", "factory:seed-migration"]) {
      items.push(validationItem(`doc.term.${slug(term)}`, "documentation", stateStoreDoc.text.includes(term), `Factory state store doc missing ${term}`, stateStoreDoc.path));
    }
  }
  return items;
}

function buildSummary({ boundary, ledgerStore, seedMigration, validation }) {
  const ready = validation.valid === true && boundary.local_operational_ledger_gitignored === true && ledgerStore.validation.valid === true && seedMigration.validation.valid === true && allAuthorityClosed(boundary);
  return {
    factory_product_registry_store_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    schema_contracts_ready: ready,
    append_jsonl_store_ready: ready,
    receipt_driven_transition_handlers_ready: ready,
    tracked_seed_migration_ready: ready,
    tracked_seed_root: "data/factory/seed/",
    local_operational_ledger_root: "data/factory/local/",
    local_operational_ledger_gitignored: boundary.local_operational_ledger_gitignored,
    ledger_dir: ledgerStore.ledger_dir,
    ledger_total_entry_count: ledgerStore.summary.ledger_total_entry_count,
    ledger_validation_errors: ledgerStore.validation.errors.length,
    ps3_transition_handler_enabled: false,
    seed_dir: seedMigration.seed_dir,
    seed_product_record_count: seedMigration.summary.migrated_product_record_count,
    seed_migration_receipt_count: seedMigration.summary.migration_receipt_count,
    seed_validation_errors: seedMigration.validation.errors.length,
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

function isAllowedReceiptDrivenTransition(fromState, toState) {
  return RECEIPT_DRIVEN_TRANSITIONS.some(([allowedFrom, allowedTo]) => fromState === allowedFrom && toState === allowedTo);
}

function receiptDrivenHandlersClosed() {
  return RECEIPT_DRIVEN_TRANSITIONS.length === 2
    && RECEIPT_DRIVEN_TRANSITIONS.every(([fromState, toState]) => !fromState.startsWith("PS3") && !toState.startsWith("PS3"));
}

function resolveCurrentProductState(scope) {
  const latestTransition = scope.state_transitions.at(-1);
  if (latestTransition) return latestTransition.to_state;
  return scope.products.at(-1)?.product_state ?? null;
}

async function readReceiptEnvelope(receiptPath) {
  if (!receiptPath) return null;
  return JSON.parse(await readFile(path.resolve(receiptPath), "utf8"));
}

async function validateFactoryLedgerRow(ledgerName, row, options = {}) {
  const schemas = await loadFactoryLedgerSchemas(options);
  return validateFactoryLedgerRowWithSchemas(ledgerName, row, schemas);
}

function validateFactoryLedgerRowWithSchemas(ledgerName, row, schemas) {
  if (schemas.errors.length > 0) return schemas.errors.map((error) => ({ path: error.path, message: error.message }));
  if (ledgerName === "products") {
    return validateAgainstSchema(row, schemas.productSchema.$defs.productRecord, {}, ledgerName, schemas.productSchema);
  }
  if (ledgerName === "state_transitions") {
    return validateAgainstSchema(row, schemas.productSchema.$defs.productStateTransition, {}, ledgerName, schemas.productSchema);
  }
  return validateAgainstSchema(row, schemas.receiptSchema, {}, ledgerName);
}

async function loadFactoryLedgerSchemas(options = {}) {
  const inputs = normalizeInputs(options);
  const productSchema = await readJsonSource(inputs.product_registry_schema_path);
  const receiptSchema = await readJsonSource(inputs.receipt_envelope_schema_path);
  const errors = [];
  if (!productSchema.available) errors.push(ledgerError("schema.product.available", "schema", productSchema.error ?? "Product registry schema unavailable", productSchema.path));
  if (!receiptSchema.available) errors.push(ledgerError("schema.receipt.available", "schema", receiptSchema.error ?? "Receipt envelope schema unavailable", receiptSchema.path));
  return { productSchema: productSchema.data, receiptSchema: receiptSchema.data, errors };
}

function emptyLedgerFile(ledgerName, filePath) {
  return {
    schema_version: "factory-ledger-file.v1",
    ledger_name: ledgerName,
    file_path: filePath,
    line_count: 0,
    raw_lines: [],
    entries: [],
    valid_entries: [],
    valid_prefix_line_count: 0,
    first_invalid_line_number: null,
    validation: { valid: true, error_count: 0, errors: [] },
  };
}

function recoveryReport(ledger, recovered, recoveryStatus) {
  return {
    schema_version: "factory-ledger-recovery-report.v1",
    ledger_name: ledger.ledger_name,
    file_path: ledger.file_path,
    recovered,
    recovery_status: recoveryStatus,
    valid_prefix_line_count: ledger.valid_prefix_line_count,
    validation: ledger.validation,
  };
}

function assertLedgerWriteAllowed(options) {
  if (options.check || options.write === false) {
    throw new Error("Factory ledger write rejected: --check/no-write mode is active.");
  }
  const ledgerDir = path.resolve(options.ledgerDir ?? DEFAULT_FACTORY_LEDGER_DIR);
  const defaultLedgerDir = path.resolve(DEFAULT_FACTORY_LEDGER_DIR);
  const tempDir = path.resolve(os.tmpdir());
  const testRootAllowed = options.allowTestLedgerRoot === true && isInsideOrEqual(ledgerDir, tempDir);
  if (!isInsideOrEqual(ledgerDir, defaultLedgerDir) && !testRootAllowed) {
    throw new Error(`Factory ledger write rejected: ledger dir must stay under ${defaultLedgerDir}.`);
  }
}

function assertKnownLedgerName(ledgerName) {
  if (!Object.hasOwn(FACTORY_LEDGER_FILES, ledgerName)) {
    throw new Error(`Unknown factory ledger: ${ledgerName}`);
  }
}

function resolveFactoryLedgerFile(ledgerName, options = {}) {
  assertKnownLedgerName(ledgerName);
  return path.join(path.resolve(options.ledgerDir ?? DEFAULT_FACTORY_LEDGER_DIR), FACTORY_LEDGER_FILES[ledgerName]);
}

function withLedgerLock(lockKey, task) {
  const previous = LEDGER_LOCKS.get(lockKey) ?? Promise.resolve();
  const next = previous.then(task, task);
  const guarded = next.catch(() => {});
  LEDGER_LOCKS.set(lockKey, guarded);
  return next.finally(() => {
    if (LEDGER_LOCKS.get(lockKey) === guarded) LEDGER_LOCKS.delete(lockKey);
  });
}

function throwValidationError(message, errors) {
  const error = new Error(message);
  error.validation = {
    valid: false,
    error_count: errors.length,
    errors,
  };
  throw error;
}

function ledgerError(itemId, category, message, filePath) {
  return {
    item_id: itemId,
    category,
    current_verdict: "fail",
    message,
    path: filePath,
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

function seedValidationItem(itemId, observed, message, pathRef = null) {
  return {
    item_id: itemId,
    category: "seed_migration",
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
    `Append JSONL store ready: ${result.summary.append_jsonl_store_ready}`,
    `Receipt-driven transitions ready: ${result.summary.receipt_driven_transition_handlers_ready}`,
    `Tracked seed migration ready: ${result.summary.tracked_seed_migration_ready}`,
    `Tracked seed root: ${result.summary.tracked_seed_root}`,
    `Local operational ledger root: ${result.summary.local_operational_ledger_root}`,
    `Local operational ledger gitignored: ${result.summary.local_operational_ledger_gitignored}`,
    `Ledger entries: ${result.summary.ledger_total_entry_count}`,
    `Seed products: ${result.summary.seed_product_record_count}`,
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
    ledger_dir: options.ledgerDir ?? DEFAULT_FACTORY_PRODUCT_REGISTRY_STORE_INPUTS.ledgerDir,
    seed_dir: options.seedDir ?? DEFAULT_FACTORY_PRODUCT_REGISTRY_STORE_INPUTS.seedDir,
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
    else if (value === "--ledger-dir") args.ledgerDir = argv[++index];
    else if (value === "--seed-dir") args.seedDir = argv[++index];
    else if (value === "--product-registry-schema-path") args.productRegistrySchemaPath = argv[++index];
    else if (value === "--receipt-envelope-schema-path") args.receiptEnvelopeSchemaPath = argv[++index];
    else if (value === "--state-store-doc-path") args.stateStoreDocPath = argv[++index];
    else if (value === "--gitignore-path") args.gitignorePath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--require-pass] [--ledger-dir <path>] [--seed-dir <path>]`);
  console.log("Validates FA.4 factory product registry schemas, append JSONL ledgers, tracked seed migration, receipt envelopes, and split-store documentation.");
}

function parseSeedMigrationArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--check") {
      args.check = true;
      args.write = false;
    } else if (value === "--require-pass") args.requirePass = true;
    else if (value === "--seed-dir") args.seedDir = argv[++index];
    else if (value === "--run-at") args.runAt = argv[++index];
    else if (value === "--product-registry-schema-path") args.productRegistrySchemaPath = argv[++index];
    else if (value === "--receipt-envelope-schema-path") args.receiptEnvelopeSchemaPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function printSeedMigrationHelp() {
  console.log(`Usage: npm run ${SEED_MIGRATION_COMMAND_NAME} -- [--check] [--require-pass] [--seed-dir <path>] [--run-at <iso>]`);
  console.log("Writes or validates the FA.4 tracked seed migration under data/factory/seed/.");
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

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function omitKeys(value, keys) {
  const blocked = new Set(keys);
  return Object.fromEntries(Object.entries(value ?? {}).filter(([key]) => !blocked.has(key)));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isInsideOrEqual(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function sameSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
