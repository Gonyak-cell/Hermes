import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildFactoryApplyEngineClosed } from "./factory-apply-engine-closed.mjs";
import { buildFactoryCandidateReviewDocket } from "./factory-candidate-review-docket.mjs";
import { buildFactoryReceiptVerify, buildOwnerAttestationReceipts } from "./factory-receipt-verifier.mjs";
import { readFactoryLedgerFile } from "./factory-product-registry-store.mjs";

export const DEFAULT_FACTORY_RECEIPT_AUTHORITY_SCHEMA_FREEZE_OUT_DIR = "artifacts/factory-receipt-authority-schema-freeze/latest";
export const DEFAULT_FACTORY_RECEIPT_AUTHORITY_SCHEMA_FREEZE_INPUTS = {
  packagePath: "package.json",
  receiptEnvelopeSchemaPath: "schemas/factory-receipt-envelope.schema.json",
  seedReceiptLedgerDir: "data/factory/seed",
  structuredSummaryPath: "docs/factory-promotion/99-structured-summary.json",
};

const COMMAND_NAME = "factory:receipt-authority-schema-freeze";
const SCHEMA_VERSION = "factory-receipt-authority-schema-freeze.v1";
const CAPABILITY_ID = "factory.receipt_authority_schema_freeze";
const PROGRAM_RANGE = "FCORE-FD.3";
const SOURCE_PROGRAM_RANGE = "FCORE-FD.1-FD.2";
const READY_STATUS = "ready_factory_receipt_authority_schema_freeze";
const BLOCKED_STATUS = "blocked_factory_receipt_authority_schema_freeze";
const RECEIPTS_LEDGER = "receipts_index";

const AUTHORITY_FALSE_FLAGS = [
  "project_creation_allowed_now",
  "review_decision_allowed_now",
  "approval_allowed_now",
  "apply_allowed_now",
  "apply_engine_runtime_enabled_now",
  "rollback_executor_runtime_enabled_now",
  "source_file_write_allowed_now",
  "ledger_append_allowed_now",
  "persistent_ledger_append_allowed_now",
  "repo_write_allowed_now",
  "connector_write_allowed_now",
  "deployment_allowed_now",
  "protected_action_allowed_now",
  "production_pass_enabled",
  "enterprise_pass_enabled",
];

const FD_RUNTIME_FALSE_FIELDS = [
  "apply_engine_runtime_enabled_now",
  "rollback_executor_runtime_enabled_now",
  "apply_attempted_now",
  "rollback_attempted_now",
];

const AUTHORITY_CLOSED = Object.fromEntries(AUTHORITY_FALSE_FLAGS.map((flag) => [flag, false]));

export async function runFactoryReceiptAuthoritySchemaFreeze(options = {}) {
  const result = await buildFactoryReceiptAuthoritySchemaFreeze(options);
  if (!options.check && options.write !== false) await writeFactoryReceiptAuthoritySchemaFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Receipt Authority Schema Freeze failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_receipt_authority_schema_freeze_status !== READY_STATUS) {
    const error = new Error("Factory Receipt Authority Schema Freeze is not ready.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryReceiptAuthoritySchemaFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_RECEIPT_AUTHORITY_SCHEMA_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const receiptSchema = await readJsonSource(inputs.receipt_envelope_schema_path);
  const structuredSummary = await readJsonSource(inputs.structured_summary_path);
  const seedReceipts = Object.prototype.hasOwnProperty.call(options, "seedReceipts")
    ? options.seedReceipts
    : await readFactoryLedgerFile(RECEIPTS_LEDGER, { ledgerDir: inputs.seed_receipt_ledger_dir });
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);
  const candidateReviewDocket = Object.prototype.hasOwnProperty.call(options, "candidateReviewDocket")
    ? options.candidateReviewDocket
    : await buildFactoryCandidateReviewDocket({
      ...options,
      outDir: path.join(outputDir, "source-docket"),
      runAt: generatedAt,
      write: false,
    });
  const receiptVerify = Object.prototype.hasOwnProperty.call(options, "receiptVerify")
    ? options.receiptVerify
    : await buildFactoryReceiptVerify({
      ...options,
      candidateReviewDocket,
      outDir: path.join(outputDir, "source-receipt-verify"),
      runAt: generatedAt,
      write: false,
      commitRef,
    });
  const fd1ReceiptRows = Object.prototype.hasOwnProperty.call(options, "fd1ReceiptRows")
    ? options.fd1ReceiptRows
    : buildOwnerAttestationReceipts({
      candidateRows: extractCandidateRows(candidateReviewDocket),
      generatedAt,
      commitRef,
    });
  const applyEngineClosed = Object.prototype.hasOwnProperty.call(options, "applyEngineClosed")
    ? options.applyEngineClosed
    : await buildFactoryApplyEngineClosed({
      ...options,
      candidateReviewDocket,
      receiptVerify,
      outDir: path.join(outputDir, "source-apply-engine-closed"),
      runAt: generatedAt,
      write: false,
      commitRef,
  });
  const authoritySchemaRows = buildAuthoritySchemaRows(receiptSchema, generatedAt);
  const runtimeSchemaRows = buildRuntimeSchemaRows(receiptSchema, generatedAt);
  const positiveFixtureRows = buildPositiveFixtureRows({ receiptSchema, seedReceipts, fd1ReceiptRows, generatedAt });
  const negativeFixtureRows = buildNegativeFixtureRows({ receiptSchema, fd1ReceiptRows, generatedAt });
  const boundary = buildBoundary({ seedReceipts, receiptVerify, applyEngineClosed, authoritySchemaRows, runtimeSchemaRows, positiveFixtureRows, negativeFixtureRows, generatedAt });
  const validationItems = buildValidationItems({
    packageJson,
    structuredSummary,
    receiptSchema,
    seedReceipts,
    receiptVerify,
    applyEngineClosed,
    authoritySchemaRows,
    runtimeSchemaRows,
    positiveFixtureRows,
    negativeFixtureRows,
    boundary,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ authoritySchemaRows, runtimeSchemaRows, positiveFixtureRows, negativeFixtureRows, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      current_commit_ref: commitRef || null,
      package_path: packageJson.path,
      receipt_envelope_schema_path: receiptSchema.path,
      structured_summary_path: structuredSummary.path,
      seed_receipt_ledger_dir: seedReceipts.ledger_dir ?? inputs.seed_receipt_ledger_dir,
    },
    source_summaries: {
      fd1_receipt_verify: receiptVerify.summary ?? null,
      fd2_apply_engine_closed: applyEngineClosed.summary ?? null,
      fc3_candidate_review_docket: candidateReviewDocket.summary ?? null,
      seed_receipts: summarizeSeedReceipts(seedReceipts),
      structured_summary_fd3_command: structuredSummary.data?.fd3_command ?? null,
    },
    factory_receipt_authority_schema_rows: authoritySchemaRows,
    factory_receipt_runtime_schema_rows: runtimeSchemaRows,
    factory_receipt_schema_positive_fixture_rows: positiveFixtureRows,
    factory_receipt_schema_negative_fixture_rows: negativeFixtureRows,
    factory_receipt_authority_schema_freeze_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryReceiptAuthoritySchemaFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-receipt-authority-schema-freeze.json"), serializableResult(result));
  await writeJson(path.join(outDir, "authority-schema-rows.json"), collectionEnvelope("factory-receipt-authority-schema-rows.v1", "factory_receipt_authority_schema_rows", result.factory_receipt_authority_schema_rows, result.generated_at));
  await writeJson(path.join(outDir, "runtime-schema-rows.json"), collectionEnvelope("factory-receipt-runtime-schema-rows.v1", "factory_receipt_runtime_schema_rows", result.factory_receipt_runtime_schema_rows, result.generated_at));
  await writeJson(path.join(outDir, "positive-fixture-rows.json"), collectionEnvelope("factory-receipt-schema-positive-fixture-rows.v1", "factory_receipt_schema_positive_fixture_rows", result.factory_receipt_schema_positive_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "negative-fixture-rows.json"), collectionEnvelope("factory-receipt-schema-negative-fixture-rows.v1", "factory_receipt_schema_negative_fixture_rows", result.factory_receipt_schema_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_receipt_authority_schema_freeze_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-receipt-authority-schema-freeze-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryReceiptAuthoritySchemaFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryReceiptAuthoritySchemaFreeze(args);
    console.log(`Factory Receipt Authority Schema Freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_receipt_authority_schema_freeze_status}`);
    console.log(`Authority schema flags frozen: ${result.summary.authority_schema_frozen_count}/${result.summary.authority_schema_flag_count}`);
    console.log(`Runtime schema fields frozen: ${result.summary.runtime_schema_frozen_count}/${result.summary.runtime_schema_field_count}`);
    console.log(`Schema negatives blocked: ${result.summary.negative_fixture_blocked_count}/${result.summary.negative_fixture_count}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

function buildAuthoritySchemaRows(receiptSchema, generatedAt) {
  const required = new Set(receiptSchema.data?.properties?.authority_flags?.required ?? []);
  const properties = receiptSchema.data?.properties?.authority_flags?.properties ?? {};
  return AUTHORITY_FALSE_FLAGS.map((flag, index) => {
    const row = {
      schema_version: "factory-receipt-authority-schema-row.v1",
      authority_schema_row_id: `factory-receipt-authority-schema.${String(index + 1).padStart(4, "0")}`,
      authority_flag: flag,
      required_by_schema: required.has(flag),
      const_false_by_schema: properties[flag]?.const === false,
      schema_freeze_status: required.has(flag) && properties[flag]?.const === false ? "frozen_false" : "not_frozen",
      generated_at: generatedAt,
    };
    return { ...row, authority_schema_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildRuntimeSchemaRows(receiptSchema, generatedAt) {
  const properties = receiptSchema.data?.properties?.fd_receipt_verify?.properties ?? {};
  return FD_RUNTIME_FALSE_FIELDS.map((field, index) => {
    const row = {
      schema_version: "factory-receipt-runtime-schema-row.v1",
      runtime_schema_row_id: `factory-receipt-runtime-schema.${String(index + 1).padStart(4, "0")}`,
      runtime_field: `fd_receipt_verify.${field}`,
      const_false_by_schema: properties[field]?.const === false,
      schema_freeze_status: properties[field]?.const === false ? "frozen_false_if_present" : "not_frozen",
      generated_at: generatedAt,
    };
    return { ...row, runtime_schema_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildPositiveFixtureRows({ receiptSchema, seedReceipts, fd1ReceiptRows, generatedAt }) {
  return [
    ...seedReceipts.entries.map((receipt, index) => positiveFixture(`seed_receipt.${String(index + 1).padStart(4, "0")}`, receipt, receiptSchema, generatedAt)),
    ...fd1ReceiptRows.map((receipt, index) => positiveFixture(`fd1_receipt.${String(index + 1).padStart(4, "0")}`, receipt, receiptSchema, generatedAt)),
  ];
}

function positiveFixture(fixtureKey, receipt, receiptSchema, generatedAt) {
  const schemaErrors = validateReceipt(receipt, receiptSchema, fixtureKey);
  const row = {
    schema_version: "factory-receipt-schema-positive-fixture-row.v1",
    fixture_id: `factory-receipt-schema-positive.${fixtureKey}`,
    fixture_key: fixtureKey,
    receipt_id: receipt?.receipt_id ?? null,
    expected_result: "schema_valid",
    actual_result: schemaErrors.length === 0 ? "schema_valid" : "schema_invalid",
    fixture_status: schemaErrors.length === 0 ? "passed" : "failed",
    schema_error_count: schemaErrors.length,
    schema_errors: schemaErrors,
    generated_at: generatedAt,
  };
  return { ...row, positive_fixture_row_sha256: sha256(canonicalize(row)) };
}

function buildNegativeFixtureRows({ receiptSchema, fd1ReceiptRows, generatedAt }) {
  const base = fd1ReceiptRows[0] ?? buildFallbackReceipt(generatedAt);
  return [
    negativeFixture("missing_apply_allowed_flag", omitAuthorityFlag(base, "apply_allowed_now"), receiptSchema, generatedAt),
    negativeFixture("apply_allowed_true", mutateAuthorityFlag(base, "apply_allowed_now", true), receiptSchema, generatedAt),
    negativeFixture("source_file_write_allowed_true", mutateAuthorityFlag(base, "source_file_write_allowed_now", true), receiptSchema, generatedAt),
    negativeFixture("ledger_append_allowed_true", mutateAuthorityFlag(base, "ledger_append_allowed_now", true), receiptSchema, generatedAt),
    negativeFixture("rollback_executor_runtime_enabled_true", mutateAuthorityFlag(base, "rollback_executor_runtime_enabled_now", true), receiptSchema, generatedAt),
    negativeFixture("deployment_allowed_true", mutateAuthorityFlag(base, "deployment_allowed_now", true), receiptSchema, generatedAt),
    negativeFixture("protected_action_allowed_true", mutateAuthorityFlag(base, "protected_action_allowed_now", true), receiptSchema, generatedAt),
    negativeFixture("production_pass_enabled_true", mutateAuthorityFlag(base, "production_pass_enabled", true), receiptSchema, generatedAt),
    negativeFixture("enterprise_pass_enabled_true", mutateAuthorityFlag(base, "enterprise_pass_enabled", true), receiptSchema, generatedAt),
    negativeFixture("unexpected_authority_flag_true", mutateAuthorityFlag(base, "unexpected_authority_allowed_now", true), receiptSchema, generatedAt),
    negativeFixture("fd_receipt_verify_apply_runtime_true", mutateFdRuntimeFlag(base, "apply_engine_runtime_enabled_now", true), receiptSchema, generatedAt),
    negativeFixture("fd_receipt_verify_unexpected_runtime_flag_true", mutateFdRuntimeFlag(base, "unexpected_runtime_allowed_now", true), receiptSchema, generatedAt),
  ];
}

function negativeFixture(fixtureKey, receipt, receiptSchema, generatedAt) {
  const schemaErrors = validateReceipt(receipt, receiptSchema, fixtureKey);
  const blocked = schemaErrors.length > 0;
  const row = {
    schema_version: "factory-receipt-schema-negative-fixture-row.v1",
    fixture_id: `factory-receipt-schema-negative.${fixtureKey}`,
    fixture_key: fixtureKey,
    attempted_receipt_id: receipt?.receipt_id ?? null,
    expected_result: "schema_blocked",
    actual_result: blocked ? "schema_blocked" : "unexpected_schema_valid",
    fixture_status: blocked ? "passed" : "failed",
    schema_error_count: schemaErrors.length,
    schema_error_paths: schemaErrors.map((error) => error.path),
    schema_errors: schemaErrors,
    generated_at: generatedAt,
    ...AUTHORITY_CLOSED,
  };
  return { ...row, negative_fixture_row_sha256: sha256(canonicalize(row)) };
}

function validateReceipt(receipt, receiptSchema, fixtureKey) {
  if (!receiptSchema.available) return [{ path: "schema", message: receiptSchema.error ?? "Receipt schema unavailable" }];
  return validateAgainstSchema(receipt, receiptSchema.data, {}, `receipt.${fixtureKey}`);
}

function mutateAuthorityFlag(receipt, flag, value) {
  return {
    ...deepClone(receipt),
    authority_flags: {
      ...receipt.authority_flags,
      [flag]: value,
    },
  };
}

function omitAuthorityFlag(receipt, flag) {
  const clone = deepClone(receipt);
  delete clone.authority_flags?.[flag];
  return clone;
}

function mutateFdRuntimeFlag(receipt, flag, value) {
  return {
    ...deepClone(receipt),
    fd_receipt_verify: {
      ...(receipt.fd_receipt_verify ?? {}),
      [flag]: value,
    },
  };
}

function buildFallbackReceipt(generatedAt) {
  return {
    schema_version: "factory-receipt-envelope.v1",
    receipt_id: "rcpt-fd3-fallback",
    receipt_kind: "schema_freeze_fixture",
    issued_at: generatedAt,
    issuer: {
      issuer_role: "validator",
      issuer_id: "factory-receipt-authority-schema-freeze",
      engine_resolved_model_id: null,
    },
    subject: {
      product_id: "product.hermes_harness",
      artifact_id: "artifact.factory_receipt_authority_schema_freeze",
      scope_id: PROGRAM_RANGE,
      reviewed_commit_sha: null,
    },
    authority_flags: AUTHORITY_CLOSED,
    payload_sha256: "0".repeat(64),
    prev_entry_hash: null,
    entry_hash: "0".repeat(64),
  };
}

function extractCandidateRows(candidateReviewDocket) {
  return (candidateReviewDocket.factory_candidate_review_docket_rows ?? []).map((row) => ({
    product_id: row.product_id,
    candidate_packet_id: row.candidate_packet_id,
    candidate_packet_sha256: row.candidate_packet_sha256,
    review_docket_row_sha256: row.review_docket_row_sha256,
  }));
}

function buildBoundary({ seedReceipts, receiptVerify, applyEngineClosed, authoritySchemaRows, runtimeSchemaRows, positiveFixtureRows, negativeFixtureRows, generatedAt }) {
  return {
    schema_version: "factory-receipt-authority-schema-freeze-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    report_only: true,
    seed_receipts_valid_now: seedReceipts.validation?.valid === true,
    fd1_receipt_verify_ready_now: receiptVerify.summary?.factory_receipt_verify_status === "ready_factory_receipt_verify",
    fd2_apply_engine_closed_ready_now: applyEngineClosed.summary?.factory_apply_engine_closed_status === "ready_factory_apply_engine_closed",
    authority_schema_flag_count: authoritySchemaRows.length,
    authority_schema_frozen_count: authoritySchemaRows.filter((row) => row.schema_freeze_status === "frozen_false").length,
    runtime_schema_field_count: runtimeSchemaRows.length,
    runtime_schema_frozen_count: runtimeSchemaRows.filter((row) => row.schema_freeze_status === "frozen_false_if_present").length,
    positive_fixture_count: positiveFixtureRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    receipt_apply_engine_reachable_now: false,
    receipt_apply_engine_opened_now: false,
    runtime_state_mutated_now: false,
    ...AUTHORITY_CLOSED,
  };
}

function buildValidationItems({ packageJson, structuredSummary, receiptSchema, seedReceipts, receiptVerify, applyEngineClosed, authoritySchemaRows, runtimeSchemaRows, positiveFixtureRows, negativeFixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    validationItem("package.script", "package", scripts[COMMAND_NAME] === "node scripts/factory-receipt-authority-schema-freeze.mjs", `${COMMAND_NAME} package script missing`, packageJson.path),
    validationItem("summary.fd3_command", "structured_summary", structuredSummary.data?.fd3_command === "npm run factory:receipt-authority-schema-freeze -- --check --require-pass", "Structured summary does not expose FD.3 command", structuredSummary.path),
    validationItem("schema.available", "schema", receiptSchema.available === true, "Receipt envelope schema unavailable", receiptSchema.path),
    validationItem("source.seed_receipts.valid", "source", seedReceipts.validation?.valid === true, "Seed receipt ledger is invalid under frozen schema", seedReceipts.file_path ?? seedReceipts.ledger_dir),
    validationItem("source.fd1.ready", "source", receiptVerify.summary?.factory_receipt_verify_status === "ready_factory_receipt_verify" && receiptVerify.validation?.valid === true, "FD.1 receipt verifier is not ready", "factory_receipt_verify"),
    validationItem("source.fd2.ready", "source", applyEngineClosed.summary?.factory_apply_engine_closed_status === "ready_factory_apply_engine_closed" && applyEngineClosed.validation?.valid === true, "FD.2 apply-engine-closed verifier is not ready", "factory_apply_engine_closed"),
    validationItem("authority.flags.frozen", "schema", authoritySchemaRows.length === AUTHORITY_FALSE_FLAGS.length && authoritySchemaRows.every((row) => row.schema_freeze_status === "frozen_false"), "Not all authority flags are required and const false in receipt schema", "factory_receipt_authority_schema_rows"),
    validationItem("runtime.fields.frozen", "schema", runtimeSchemaRows.length === FD_RUNTIME_FALSE_FIELDS.length && runtimeSchemaRows.every((row) => row.schema_freeze_status === "frozen_false_if_present"), "FD runtime fields are not const false when present", "factory_receipt_runtime_schema_rows"),
    validationItem("positive.fixtures.valid", "positive_fixture", positiveFixtureRows.length >= 4 && positiveFixtureRows.every((row) => row.fixture_status === "passed"), "Positive receipt fixtures failed frozen schema validation", "factory_receipt_schema_positive_fixture_rows"),
    validationItem("negative.fixtures.blocked", "negative_fixture", negativeFixtureRows.length === 12 && negativeFixtureRows.every((row) => row.fixture_status === "passed" && row.actual_result === "schema_blocked"), "Schema negative fixtures did not block open authority receipts", "factory_receipt_schema_negative_fixture_rows"),
    validationItem("boundary.closed", "authority", boundaryFlagsClosed(boundary), "FD.3 boundary opened apply/write/deploy/protected/production authority", "factory_receipt_authority_schema_freeze_boundary"),
  ];
}

function buildSummary({ authoritySchemaRows, runtimeSchemaRows, positiveFixtureRows, negativeFixtureRows, boundary, validation }) {
  const authorityFrozenCount = authoritySchemaRows.filter((row) => row.schema_freeze_status === "frozen_false").length;
  const runtimeFrozenCount = runtimeSchemaRows.filter((row) => row.schema_freeze_status === "frozen_false_if_present").length;
  const positivePassedCount = positiveFixtureRows.filter((row) => row.fixture_status === "passed").length;
  const negativeBlockedCount = negativeFixtureRows.filter((row) => row.fixture_status === "passed" && row.actual_result === "schema_blocked").length;
  const ready = validation.valid
    && authorityFrozenCount === AUTHORITY_FALSE_FLAGS.length
    && runtimeFrozenCount === FD_RUNTIME_FALSE_FIELDS.length
    && positivePassedCount === positiveFixtureRows.length
    && negativeBlockedCount === negativeFixtureRows.length
    && negativeFixtureRows.length === 12
    && boundaryFlagsClosed(boundary);
  return {
    factory_receipt_authority_schema_freeze_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    authority_schema_flag_count: authoritySchemaRows.length,
    authority_schema_frozen_count: authorityFrozenCount,
    runtime_schema_field_count: runtimeSchemaRows.length,
    runtime_schema_frozen_count: runtimeFrozenCount,
    positive_fixture_count: positiveFixtureRows.length,
    positive_fixture_passed_count: positivePassedCount,
    negative_fixture_count: negativeFixtureRows.length,
    negative_fixture_blocked_count: negativeBlockedCount,
    schema_blocks_missing_apply_allowed_flag: negativeFixtureRows.some((row) => row.fixture_key === "missing_apply_allowed_flag" && row.fixture_status === "passed"),
    schema_blocks_apply_allowed_true: negativeFixtureRows.some((row) => row.fixture_key === "apply_allowed_true" && row.fixture_status === "passed"),
    schema_blocks_source_file_write_true: negativeFixtureRows.some((row) => row.fixture_key === "source_file_write_allowed_true" && row.fixture_status === "passed"),
    schema_blocks_ledger_append_true: negativeFixtureRows.some((row) => row.fixture_key === "ledger_append_allowed_true" && row.fixture_status === "passed"),
    schema_blocks_rollback_runtime_true: negativeFixtureRows.some((row) => row.fixture_key === "rollback_executor_runtime_enabled_true" && row.fixture_status === "passed"),
    schema_blocks_deployment_allowed_true: negativeFixtureRows.some((row) => row.fixture_key === "deployment_allowed_true" && row.fixture_status === "passed"),
    schema_blocks_protected_action_allowed_true: negativeFixtureRows.some((row) => row.fixture_key === "protected_action_allowed_true" && row.fixture_status === "passed"),
    schema_blocks_production_pass_enabled_true: negativeFixtureRows.some((row) => row.fixture_key === "production_pass_enabled_true" && row.fixture_status === "passed"),
    schema_blocks_enterprise_pass_enabled_true: negativeFixtureRows.some((row) => row.fixture_key === "enterprise_pass_enabled_true" && row.fixture_status === "passed"),
    schema_blocks_unexpected_authority_flag_true: negativeFixtureRows.some((row) => row.fixture_key === "unexpected_authority_flag_true" && row.fixture_status === "passed"),
    schema_blocks_fd_receipt_verify_apply_runtime_true: negativeFixtureRows.some((row) => row.fixture_key === "fd_receipt_verify_apply_runtime_true" && row.fixture_status === "passed"),
    schema_blocks_fd_receipt_verify_unexpected_runtime_flag_true: negativeFixtureRows.some((row) => row.fixture_key === "fd_receipt_verify_unexpected_runtime_flag_true" && row.fixture_status === "passed"),
    receipt_apply_engine_reachable_now: false,
    receipt_apply_engine_opened_now: false,
    runtime_state_mutated_now: false,
    ...AUTHORITY_CLOSED,
    validation_errors: validation.errors.length,
  };
}

function summarizeSeedReceipts(seedReceipts) {
  return {
    schema_version: "factory-seed-receipts-summary.v1",
    file_path: seedReceipts.file_path ?? null,
    entry_count: seedReceipts.entries?.length ?? 0,
    valid_entry_count: seedReceipts.valid_entries?.length ?? 0,
    validation_valid: seedReceipts.validation?.valid === true,
    validation_errors: seedReceipts.validation?.errors?.length ?? 0,
  };
}

function boundaryFlagsClosed(boundary) {
  return AUTHORITY_FALSE_FLAGS.every((flag) => boundary[flag] === false)
    && boundary.receipt_apply_engine_reachable_now === false
    && boundary.receipt_apply_engine_opened_now === false
    && boundary.runtime_state_mutated_now === false;
}

function validationItem(itemId, category, passed, message, evidenceRef) {
  return {
    schema_version: "factory-receipt-authority-schema-freeze-validation-item.v1",
    item_id: itemId,
    category,
    status: passed ? "pass" : "fail",
    message: passed ? "ok" : message,
    evidence_ref: evidenceRef,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "pass").map((item) => ({
    item_id: item.item_id,
    message: item.message,
    evidence_ref: item.evidence_ref,
  }));
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
  };
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_FACTORY_RECEIPT_AUTHORITY_SCHEMA_FREEZE_INPUTS;
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    receipt_envelope_schema_path: path.resolve(repoRoot, options.receiptEnvelopeSchemaPath ?? defaults.receiptEnvelopeSchemaPath),
    seed_receipt_ledger_dir: path.resolve(repoRoot, options.seedReceiptLedgerDir ?? defaults.seedReceiptLedgerDir),
    structured_summary_path: path.resolve(repoRoot, options.structuredSummaryPath ?? defaults.structuredSummaryPath),
  };
}

async function readJsonSource(filePath) {
  try {
    return {
      path: filePath,
      available: true,
      data: JSON.parse(await readFile(filePath, "utf8")),
      error: null,
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      data: null,
      error: error.message,
    };
  }
}

function renderMarkdown(result) {
  return [
    "# Factory Receipt Authority Schema Freeze",
    "",
    `Status: ${result.summary.factory_receipt_authority_schema_freeze_status}`,
    `Program: ${result.program_range}`,
    `Authority schema flags frozen: ${result.summary.authority_schema_frozen_count}/${result.summary.authority_schema_flag_count}`,
    `Runtime schema fields frozen: ${result.summary.runtime_schema_frozen_count}/${result.summary.runtime_schema_field_count}`,
    `Positive fixtures: ${result.summary.positive_fixture_passed_count}/${result.summary.positive_fixture_count}`,
    `Negative fixtures blocked: ${result.summary.negative_fixture_blocked_count}/${result.summary.negative_fixture_count}`,
    `Validation errors: ${result.validation.errors.length}`,
    "",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") args.check = true;
    else if (arg === "--require-pass") args.requirePass = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else if (arg === "--commit-ref") args.commitRef = argv[++index];
    else if (arg === "--receipt-envelope-schema-path") args.receiptEnvelopeSchemaPath = argv[++index];
    else if (arg === "--seed-receipt-ledger-dir") args.seedReceiptLedgerDir = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/factory-receipt-authority-schema-freeze.mjs [--check] [--require-pass] [--out-dir DIR] [--run-at ISO] [--commit-ref SHA]

Builds the FD.3 receipt authority schema freeze verifier without opening apply or write authority.`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
