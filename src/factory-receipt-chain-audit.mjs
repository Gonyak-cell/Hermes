import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryApplyEngineClosed } from "./factory-apply-engine-closed.mjs";
import { buildFactoryCandidateReviewDocket } from "./factory-candidate-review-docket.mjs";
import { buildFactoryReceiptAuthoritySchemaFreeze } from "./factory-receipt-authority-schema-freeze.mjs";
import { buildFactoryReceiptVerify, buildOwnerAttestationReceipts } from "./factory-receipt-verifier.mjs";
import { readFactoryLedgerFile } from "./factory-product-registry-store.mjs";

export const DEFAULT_FACTORY_RECEIPT_CHAIN_AUDIT_OUT_DIR = "artifacts/factory-receipt-chain-audit/latest";
export const DEFAULT_FACTORY_RECEIPT_CHAIN_AUDIT_INPUTS = {
  packagePath: "package.json",
  seedReceiptLedgerDir: "data/factory/seed",
  structuredSummaryPath: "docs/factory-promotion/99-structured-summary.json",
};

const COMMAND_NAME = "factory:receipt-chain-audit";
const SCHEMA_VERSION = "factory-receipt-chain-audit.v1";
const CAPABILITY_ID = "factory.receipt_chain_audit";
const PROGRAM_RANGE = "FCORE-FD.4";
const SOURCE_PROGRAM_RANGE = "FCORE-FD.1-FD.3";
const READY_STATUS = "ready_factory_receipt_chain_audit";
const BLOCKED_STATUS = "blocked_factory_receipt_chain_audit";
const RECEIPTS_LEDGER = "receipts_index";
const HASH_RE = /^[a-f0-9]{64}$/;

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

const AUTHORITY_CLOSED = Object.fromEntries(AUTHORITY_FALSE_FLAGS.map((flag) => [flag, false]));

export async function runFactoryReceiptChainAudit(options = {}) {
  const result = await buildFactoryReceiptChainAudit(options);
  if (!options.check && options.write !== false) await writeFactoryReceiptChainAudit(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Receipt Chain Audit failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_receipt_chain_audit_status !== READY_STATUS) {
    const error = new Error("Factory Receipt Chain Audit is not ready.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryReceiptChainAudit(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_RECEIPT_CHAIN_AUDIT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
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
  const fd1ReceiptRows = Object.prototype.hasOwnProperty.call(options, "fd1ReceiptRows")
    ? options.fd1ReceiptRows
    : buildOwnerAttestationReceipts({
      candidateRows: extractCandidateRows(candidateReviewDocket),
      generatedAt,
      commitRef,
    });
  const receiptVerify = Object.prototype.hasOwnProperty.call(options, "receiptVerify")
    ? options.receiptVerify
    : await buildFactoryReceiptVerify({
      ...options,
      candidateReviewDocket,
      receiptRows: fd1ReceiptRows,
      outDir: path.join(outputDir, "source-receipt-verify"),
      runAt: generatedAt,
      write: false,
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
  const authoritySchemaFreeze = Object.prototype.hasOwnProperty.call(options, "authoritySchemaFreeze")
    ? options.authoritySchemaFreeze
    : await buildFactoryReceiptAuthoritySchemaFreeze({
      ...options,
      candidateReviewDocket,
      receiptVerify,
      fd1ReceiptRows,
      applyEngineClosed,
      seedReceipts,
      outDir: path.join(outputDir, "source-authority-schema-freeze"),
      runAt: generatedAt,
      write: false,
      commitRef,
    });

  const seedReceiptChainRows = buildSeedReceiptChainRows(seedReceipts, generatedAt);
  const fd1OwnerReceiptChainRows = buildFd1OwnerReceiptChainRows({
    receiptRows: fd1ReceiptRows,
    verificationRows: receiptVerify.factory_receipt_verification_rows ?? [],
    docketRows: candidateReviewDocket.factory_candidate_review_docket_rows ?? [],
    generatedAt,
  });
  const fd2ApplyRollbackChainRows = buildFd2ApplyRollbackChainRows({
    verificationRows: receiptVerify.factory_receipt_verification_rows ?? [],
    applyIntentRows: applyEngineClosed.factory_apply_intent_rows ?? [],
    rollbackRows: applyEngineClosed.factory_rollback_verification_rows ?? [],
    generatedAt,
  });
  const fd3SchemaFreezeChainRows = buildFd3SchemaFreezeChainRows({ authoritySchemaFreeze, generatedAt });
  const negativeFixtureRows = buildNegativeFixtureRows({
    seedReceipts,
    candidateReviewDocket,
    fd1ReceiptRows,
    receiptVerify,
    applyEngineClosed,
    authoritySchemaFreeze,
    generatedAt,
  });
  const boundary = buildBoundary({
    seedReceiptChainRows,
    fd1OwnerReceiptChainRows,
    fd2ApplyRollbackChainRows,
    fd3SchemaFreezeChainRows,
    negativeFixtureRows,
    generatedAt,
  });
  const validationItems = buildValidationItems({
    packageJson,
    structuredSummary,
    seedReceipts,
    receiptVerify,
    applyEngineClosed,
    authoritySchemaFreeze,
    seedReceiptChainRows,
    fd1OwnerReceiptChainRows,
    fd2ApplyRollbackChainRows,
    fd3SchemaFreezeChainRows,
    negativeFixtureRows,
    boundary,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({
    seedReceiptChainRows,
    fd1OwnerReceiptChainRows,
    fd2ApplyRollbackChainRows,
    fd3SchemaFreezeChainRows,
    negativeFixtureRows,
    boundary,
    validation,
  });
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
      structured_summary_path: structuredSummary.path,
      seed_receipt_ledger_dir: seedReceipts.ledger_dir ?? inputs.seed_receipt_ledger_dir,
    },
    source_summaries: {
      fd1_receipt_verify: receiptVerify.summary ?? null,
      fd2_apply_engine_closed: applyEngineClosed.summary ?? null,
      fd3_receipt_authority_schema_freeze: authoritySchemaFreeze.summary ?? null,
      seed_receipts: summarizeSeedReceipts(seedReceipts),
      structured_summary_fd4_command: structuredSummary.data?.fd4_command ?? null,
    },
    factory_seed_receipt_chain_rows: seedReceiptChainRows,
    factory_fd1_owner_receipt_chain_rows: fd1OwnerReceiptChainRows,
    factory_fd2_apply_rollback_chain_rows: fd2ApplyRollbackChainRows,
    factory_fd3_schema_freeze_chain_rows: fd3SchemaFreezeChainRows,
    factory_receipt_chain_negative_fixture_rows: negativeFixtureRows,
    factory_receipt_chain_audit_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryReceiptChainAudit(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-receipt-chain-audit.json"), serializableResult(result));
  await writeJson(path.join(outDir, "seed-receipt-chain-rows.json"), collectionEnvelope("factory-seed-receipt-chain-rows.v1", "factory_seed_receipt_chain_rows", result.factory_seed_receipt_chain_rows, result.generated_at));
  await writeJson(path.join(outDir, "fd1-owner-receipt-chain-rows.json"), collectionEnvelope("factory-fd1-owner-receipt-chain-rows.v1", "factory_fd1_owner_receipt_chain_rows", result.factory_fd1_owner_receipt_chain_rows, result.generated_at));
  await writeJson(path.join(outDir, "fd2-apply-rollback-chain-rows.json"), collectionEnvelope("factory-fd2-apply-rollback-chain-rows.v1", "factory_fd2_apply_rollback_chain_rows", result.factory_fd2_apply_rollback_chain_rows, result.generated_at));
  await writeJson(path.join(outDir, "fd3-schema-freeze-chain-rows.json"), collectionEnvelope("factory-fd3-schema-freeze-chain-rows.v1", "factory_fd3_schema_freeze_chain_rows", result.factory_fd3_schema_freeze_chain_rows, result.generated_at));
  await writeJson(path.join(outDir, "negative-fixture-rows.json"), collectionEnvelope("factory-receipt-chain-negative-fixture-rows.v1", "factory_receipt_chain_negative_fixture_rows", result.factory_receipt_chain_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_receipt_chain_audit_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-receipt-chain-audit-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryReceiptChainAuditCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryReceiptChainAudit(args);
    console.log(`Factory Receipt Chain Audit ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_receipt_chain_audit_status}`);
    console.log(`Seed receipt chain rows ready: ${result.summary.seed_receipt_chain_ready_count}/${result.summary.seed_receipt_chain_count}`);
    console.log(`FD.1 owner receipt chain rows ready: ${result.summary.fd1_owner_receipt_chain_ready_count}/${result.summary.fd1_owner_receipt_chain_count}`);
    console.log(`FD.2 apply/rollback chain rows ready: ${result.summary.fd2_apply_rollback_chain_ready_count}/${result.summary.fd2_apply_rollback_chain_count}`);
    console.log(`FD.3 schema freeze chain rows ready: ${result.summary.fd3_schema_freeze_chain_ready_count}/${result.summary.fd3_schema_freeze_chain_count}`);
    console.log(`Negative fixtures blocked: ${result.summary.negative_fixture_blocked_count}/${result.summary.negative_fixture_count}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

function buildSeedReceiptChainRows(seedReceipts, generatedAt) {
  return (seedReceipts.entries ?? []).map((receipt, index) => {
    const row = {
      schema_version: "factory-seed-receipt-chain-row.v1",
      chain_row_id: `factory-seed-receipt-chain.${String(index + 1).padStart(4, "0")}`,
      source_ledger_name: RECEIPTS_LEDGER,
      source_line_number: index + 1,
      receipt_id: receipt.receipt_id ?? null,
      receipt_kind: receipt.receipt_kind ?? null,
      product_id: receipt.subject?.product_id ?? null,
      payload_sha256: receipt.payload_sha256 ?? null,
      prev_entry_hash: receipt.prev_entry_hash ?? null,
      entry_hash: receipt.entry_hash ?? null,
      ledger_validation_valid: seedReceipts.validation?.valid === true,
      valid_prefix_includes_row: (seedReceipts.valid_prefix_line_count ?? 0) >= index + 1,
      payload_hash_present: HASH_RE.test(receipt.payload_sha256 ?? ""),
      entry_hash_present: HASH_RE.test(receipt.entry_hash ?? ""),
      prev_hash_position_valid: index === 0 ? receipt.prev_entry_hash === null : HASH_RE.test(receipt.prev_entry_hash ?? ""),
      authority_closed: allAuthorityClosed(receipt.authority_flags ?? {}),
      chain_row_status: "pending",
      generated_at: generatedAt,
    };
    row.chain_row_status = Object.values(pick(row, [
      "ledger_validation_valid",
      "valid_prefix_includes_row",
      "payload_hash_present",
      "entry_hash_present",
      "prev_hash_position_valid",
      "authority_closed",
    ])).every(Boolean) ? "ready" : "blocked";
    return { ...row, chain_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildFd1OwnerReceiptChainRows({ receiptRows, verificationRows, docketRows, generatedAt }) {
  const seenNonces = new Set();
  return receiptRows.map((receipt, index) => {
    const verification = verificationRows.find((row) => row.receipt_id === receipt.receipt_id);
    const docket = docketRows.find((row) => row.candidate_packet_sha256 === receipt.subject?.bound_candidate_sha256)
      ?? docketRows.find((row) => row.product_id === receipt.subject?.product_id);
    const expectedPrevHash = index === 0 ? null : receiptRows[index - 1]?.entry_hash ?? null;
    const nonce = receipt.attestation?.nonce ?? null;
    const row = {
      schema_version: "factory-fd1-owner-receipt-chain-row.v1",
      chain_row_id: `factory-fd1-owner-receipt-chain.${String(index + 1).padStart(4, "0")}`,
      receipt_id: receipt.receipt_id ?? null,
      product_id: receipt.subject?.product_id ?? null,
      candidate_packet_id: docket?.candidate_packet_id ?? null,
      candidate_packet_sha256: receipt.subject?.bound_candidate_sha256 ?? null,
      review_docket_row_sha256: receipt.subject?.bound_review_docket_row_sha256 ?? null,
      receipt_payload_sha256: receipt.payload_sha256 ?? null,
      receipt_prev_entry_hash: receipt.prev_entry_hash ?? null,
      receipt_entry_hash: receipt.entry_hash ?? null,
      expected_prev_entry_hash: expectedPrevHash,
      verification_row_id: verification?.verification_row_id ?? null,
      verification_status: verification?.verification_status ?? null,
      nonce,
      nonce_unique_in_chain: nonce ? !seenNonces.has(nonce) : false,
      prev_entry_hash_matches_chain: receipt.prev_entry_hash === expectedPrevHash,
      entry_hash_matches_verification: Boolean(verification) && receipt.entry_hash === verification.receipt_entry_hash,
      candidate_hash_matches_docket: Boolean(docket) && receipt.subject?.bound_candidate_sha256 === docket.candidate_packet_sha256,
      review_docket_hash_matches: Boolean(docket) && receipt.subject?.bound_review_docket_row_sha256 === docket.review_docket_row_sha256,
      verification_ready: verification?.verification_status === "ready",
      authority_closed: allAuthorityClosed(receipt.authority_flags ?? {}),
      apply_attempted_now: receipt.fd_receipt_verify?.apply_attempted_now === true,
      chain_row_status: "pending",
      generated_at: generatedAt,
    };
    if (nonce) seenNonces.add(nonce);
    row.chain_row_status = row.nonce_unique_in_chain
      && row.prev_entry_hash_matches_chain
      && row.entry_hash_matches_verification
      && row.candidate_hash_matches_docket
      && row.review_docket_hash_matches
      && row.verification_ready
      && row.authority_closed
      && row.apply_attempted_now === false
      ? "ready"
      : "blocked";
    return { ...row, chain_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildFd2ApplyRollbackChainRows({ verificationRows, applyIntentRows, rollbackRows, generatedAt }) {
  return applyIntentRows.map((intent, index) => {
    const verification = verificationRows.find((row) => row.receipt_id === intent.receipt_id);
    const rollback = rollbackRows.find((row) => row.apply_intent_id === intent.apply_intent_id);
    const row = {
      schema_version: "factory-fd2-apply-rollback-chain-row.v1",
      chain_row_id: `factory-fd2-apply-rollback-chain.${String(index + 1).padStart(4, "0")}`,
      apply_intent_id: intent.apply_intent_id ?? null,
      rollback_verification_id: rollback?.rollback_verification_id ?? null,
      receipt_id: intent.receipt_id ?? null,
      product_id: intent.product_id ?? null,
      candidate_packet_id: intent.candidate_packet_id ?? null,
      candidate_packet_sha256: intent.candidate_packet_sha256 ?? null,
      receipt_entry_hash: intent.receipt_entry_hash ?? null,
      verification_row_id: verification?.verification_row_id ?? null,
      rollback_plan_id: intent.rollback_plan_id ?? null,
      rollback_plan_sha256: intent.rollback_plan_sha256 ?? null,
      receipt_hash_matches_fd1: Boolean(verification) && intent.receipt_entry_hash === verification.receipt_entry_hash,
      candidate_hash_matches_fd1: Boolean(verification) && intent.candidate_packet_sha256 === verification.candidate_packet_sha256,
      apply_blocked_closed_engine: intent.apply_intent_status === "blocked_apply_engine_unreachable" && intent.apply_engine_invoked_now === false,
      rollback_bound_to_apply_intent: Boolean(rollback) && rollback.apply_intent_id === intent.apply_intent_id && rollback.rollback_plan_sha256 === intent.rollback_plan_sha256,
      rollback_blocked_closed_executor: rollback?.rollback_verification_status === "blocked_rollback_executor_unreachable_no_state_mutation" && rollback?.rollback_executor_invoked_now === false && rollback?.rollback_executed_now === false,
      authority_closed: allAuthorityClosed(intent) && allAuthorityClosed(rollback ?? {}),
      chain_row_status: "pending",
      generated_at: generatedAt,
    };
    row.chain_row_status = row.receipt_hash_matches_fd1
      && row.candidate_hash_matches_fd1
      && row.apply_blocked_closed_engine
      && row.rollback_bound_to_apply_intent
      && row.rollback_blocked_closed_executor
      && row.authority_closed
      ? "ready"
      : "blocked";
    return { ...row, chain_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildFd3SchemaFreezeChainRows({ authoritySchemaFreeze, generatedAt }) {
  const summary = authoritySchemaFreeze.summary ?? {};
  const rows = [
    {
      schema_version: "factory-fd3-schema-freeze-chain-row.v1",
      chain_row_id: "factory-fd3-schema-freeze-chain.authority-flags",
      evidence_kind: "authority_flags_required_const_false",
      expected_count: 15,
      observed_count: summary.authority_schema_frozen_count ?? 0,
      observed_count_matches_expected: summary.authority_schema_frozen_count === 15,
      source_status: summary.factory_receipt_authority_schema_freeze_status ?? null,
      source_ready: summary.factory_receipt_authority_schema_freeze_status === "ready_factory_receipt_authority_schema_freeze",
      row_status: summary.authority_schema_frozen_count === 15 ? "ready" : "blocked",
      generated_at: generatedAt,
    },
    {
      schema_version: "factory-fd3-schema-freeze-chain-row.v1",
      chain_row_id: "factory-fd3-schema-freeze-chain.runtime-fields",
      evidence_kind: "fd_receipt_verify_runtime_fields_const_false",
      expected_count: 4,
      observed_count: summary.runtime_schema_frozen_count ?? 0,
      observed_count_matches_expected: summary.runtime_schema_frozen_count === 4,
      source_status: summary.factory_receipt_authority_schema_freeze_status ?? null,
      source_ready: summary.factory_receipt_authority_schema_freeze_status === "ready_factory_receipt_authority_schema_freeze",
      row_status: summary.runtime_schema_frozen_count === 4 ? "ready" : "blocked",
      generated_at: generatedAt,
    },
    {
      schema_version: "factory-fd3-schema-freeze-chain-row.v1",
      chain_row_id: "factory-fd3-schema-freeze-chain.positive-fixtures",
      evidence_kind: "seed_and_fd1_receipts_schema_valid",
      expected_count: 4,
      observed_count: summary.positive_fixture_passed_count ?? 0,
      observed_count_matches_expected: summary.positive_fixture_passed_count === summary.positive_fixture_count && summary.positive_fixture_count >= 4,
      source_status: summary.factory_receipt_authority_schema_freeze_status ?? null,
      source_ready: summary.factory_receipt_authority_schema_freeze_status === "ready_factory_receipt_authority_schema_freeze",
      row_status: summary.positive_fixture_passed_count === summary.positive_fixture_count && summary.positive_fixture_count >= 4 ? "ready" : "blocked",
      generated_at: generatedAt,
    },
    {
      schema_version: "factory-fd3-schema-freeze-chain-row.v1",
      chain_row_id: "factory-fd3-schema-freeze-chain.negative-fixtures",
      evidence_kind: "open_authority_schema_blocked",
      expected_count: 12,
      observed_count: summary.negative_fixture_blocked_count ?? 0,
      observed_count_matches_expected: summary.negative_fixture_blocked_count === 12 && summary.negative_fixture_count === 12,
      source_status: summary.factory_receipt_authority_schema_freeze_status ?? null,
      source_ready: summary.factory_receipt_authority_schema_freeze_status === "ready_factory_receipt_authority_schema_freeze",
      row_status: summary.negative_fixture_blocked_count === 12 && summary.negative_fixture_count === 12 ? "ready" : "blocked",
      generated_at: generatedAt,
    },
  ];
  return rows.map((row) => ({ ...row, chain_row_sha256: sha256(canonicalize(row)) }));
}

function buildNegativeFixtureRows({ seedReceipts, candidateReviewDocket, fd1ReceiptRows, receiptVerify, applyEngineClosed, authoritySchemaFreeze, generatedAt }) {
  const fd1Rows = buildFd1OwnerReceiptChainRows({
    receiptRows: mutateFd1PrevHash(fd1ReceiptRows),
    verificationRows: receiptVerify.factory_receipt_verification_rows ?? [],
    docketRows: candidateReviewDocket.factory_candidate_review_docket_rows ?? [],
    generatedAt,
  });
  const fd2Rows = buildFd2ApplyRollbackChainRows({
    verificationRows: receiptVerify.factory_receipt_verification_rows ?? [],
    applyIntentRows: mutateApplyReceiptHash(applyEngineClosed.factory_apply_intent_rows ?? []),
    rollbackRows: applyEngineClosed.factory_rollback_verification_rows ?? [],
    generatedAt,
  });
  const fd3Rows = buildFd3SchemaFreezeChainRows({
    authoritySchemaFreeze: mutateFd3NegativeCount(authoritySchemaFreeze),
    generatedAt,
  });
  const seedRows = buildSeedReceiptChainRows(mutateSeedReceiptValidation(seedReceipts), generatedAt);
  return [
    negativeFixture("fd1_prev_entry_hash_break", fd1Rows, "chain_row_status", generatedAt, [
      "prev_entry_hash_matches_chain",
      "entry_hash_matches_verification",
      "candidate_hash_matches_docket",
      "review_docket_hash_matches",
      "verification_ready",
    ]),
    negativeFixture("fd2_apply_receipt_hash_mismatch", fd2Rows, "chain_row_status", generatedAt, [
      "receipt_hash_matches_fd1",
      "candidate_hash_matches_fd1",
      "apply_blocked_closed_engine",
      "rollback_bound_to_apply_intent",
      "rollback_blocked_closed_executor",
    ]),
    negativeFixture("fd3_negative_fixture_count_drop", fd3Rows, "row_status", generatedAt, [
      "source_ready",
      "observed_count_matches_expected",
    ]),
    negativeFixture("seed_receipt_ledger_invalid", seedRows, "chain_row_status", generatedAt, [
      "ledger_validation_valid",
      "valid_prefix_includes_row",
      "payload_hash_present",
      "entry_hash_present",
      "prev_hash_position_valid",
      "authority_closed",
    ]),
  ];
}

function negativeFixture(fixtureKey, rows, statusField, generatedAt, checkFields) {
  const blockedRows = rows.filter((row) => row[statusField] === "blocked");
  const observedBlockedChecks = [...new Set(blockedRows.flatMap((row) => checkFields.filter((field) => row[field] === false)))];
  const blocked = blockedRows.length > 0;
  const row = {
    schema_version: "factory-receipt-chain-negative-fixture-row.v1",
    fixture_id: `factory-receipt-chain-negative-fixture.${fixtureKey}`,
    fixture_key: fixtureKey,
    expected_result: "chain_blocked",
    actual_result: blocked ? "chain_blocked" : "unexpected_ready",
    fixture_status: blocked ? "passed" : "failed",
    observed_blocked_row_count: blockedRows.length,
    observed_blocked_checks: observedBlockedChecks,
    generated_at: generatedAt,
    ...AUTHORITY_CLOSED,
  };
  return { ...row, negative_fixture_row_sha256: sha256(canonicalize(row)) };
}

function buildBoundary({ seedReceiptChainRows, fd1OwnerReceiptChainRows, fd2ApplyRollbackChainRows, fd3SchemaFreezeChainRows, negativeFixtureRows, generatedAt }) {
  return {
    schema_version: "factory-receipt-chain-audit-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    report_only: true,
    seed_receipt_chain_ready: seedReceiptChainRows.every((row) => row.chain_row_status === "ready"),
    fd1_owner_receipt_chain_ready: fd1OwnerReceiptChainRows.every((row) => row.chain_row_status === "ready"),
    fd2_apply_rollback_chain_ready: fd2ApplyRollbackChainRows.every((row) => row.chain_row_status === "ready"),
    fd3_schema_freeze_chain_ready: fd3SchemaFreezeChainRows.every((row) => row.row_status === "ready"),
    negative_fixtures_blocked: negativeFixtureRows.every((row) => row.fixture_status === "passed" && row.actual_result === "chain_blocked"),
    receipt_apply_engine_reachable_now: false,
    receipt_apply_engine_opened_now: false,
    rollback_executor_runtime_enabled_now: false,
    runtime_state_mutated_now: false,
    ...AUTHORITY_CLOSED,
  };
}

function buildValidationItems({ packageJson, structuredSummary, seedReceipts, receiptVerify, applyEngineClosed, authoritySchemaFreeze, seedReceiptChainRows, fd1OwnerReceiptChainRows, fd2ApplyRollbackChainRows, fd3SchemaFreezeChainRows, negativeFixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    validationItem("package.script", "package", scripts[COMMAND_NAME] === "node scripts/factory-receipt-chain-audit.mjs", `${COMMAND_NAME} package script missing`, packageJson.path),
    validationItem("summary.fd4_command", "structured_summary", structuredSummary.data?.fd4_command === "npm run factory:receipt-chain-audit -- --check --require-pass", "Structured summary does not expose FD.4 command", structuredSummary.path),
    validationItem("source.seed_receipts.valid", "source", seedReceipts.validation?.valid === true, "Seed receipt ledger is invalid", seedReceipts.file_path ?? seedReceipts.ledger_dir),
    validationItem("source.fd1.ready", "source", receiptVerify.summary?.factory_receipt_verify_status === "ready_factory_receipt_verify" && receiptVerify.validation?.valid === true, "FD.1 receipt verifier is not ready", "factory_receipt_verify"),
    validationItem("source.fd2.ready", "source", applyEngineClosed.summary?.factory_apply_engine_closed_status === "ready_factory_apply_engine_closed" && applyEngineClosed.validation?.valid === true, "FD.2 apply engine closed verifier is not ready", "factory_apply_engine_closed"),
    validationItem("source.fd3.ready", "source", authoritySchemaFreeze.summary?.factory_receipt_authority_schema_freeze_status === "ready_factory_receipt_authority_schema_freeze" && authoritySchemaFreeze.validation?.valid === true, "FD.3 receipt authority schema freeze is not ready", "factory_receipt_authority_schema_freeze"),
    validationItem("seed.chain.ready", "chain", seedReceiptChainRows.length >= 1 && seedReceiptChainRows.every((row) => row.chain_row_status === "ready"), "Seed receipt chain rows are not ready", "factory_seed_receipt_chain_rows"),
    validationItem("fd1.chain.ready", "chain", fd1OwnerReceiptChainRows.length === 3 && fd1OwnerReceiptChainRows.every((row) => row.chain_row_status === "ready"), "FD.1 owner receipt chain rows are not ready", "factory_fd1_owner_receipt_chain_rows"),
    validationItem("fd2.chain.ready", "chain", fd2ApplyRollbackChainRows.length === 3 && fd2ApplyRollbackChainRows.every((row) => row.chain_row_status === "ready"), "FD.2 apply/rollback chain rows are not ready", "factory_fd2_apply_rollback_chain_rows"),
    validationItem("fd3.chain.ready", "chain", fd3SchemaFreezeChainRows.length === 4 && fd3SchemaFreezeChainRows.every((row) => row.row_status === "ready"), "FD.3 schema freeze chain rows are not ready", "factory_fd3_schema_freeze_chain_rows"),
    validationItem("negative.fixtures.blocked", "negative_fixture", negativeFixtureRows.length === 4 && negativeFixtureRows.every((row) => row.fixture_status === "passed" && row.actual_result === "chain_blocked"), "Receipt chain negative fixtures did not block", "factory_receipt_chain_negative_fixture_rows"),
    validationItem("boundary.closed", "authority", boundaryFlagsClosed(boundary), "FD.4 boundary opened apply/write/deploy/protected/production authority", "factory_receipt_chain_audit_boundary"),
  ];
}

function buildSummary({ seedReceiptChainRows, fd1OwnerReceiptChainRows, fd2ApplyRollbackChainRows, fd3SchemaFreezeChainRows, negativeFixtureRows, boundary, validation }) {
  const seedReady = seedReceiptChainRows.filter((row) => row.chain_row_status === "ready").length;
  const fd1Ready = fd1OwnerReceiptChainRows.filter((row) => row.chain_row_status === "ready").length;
  const fd2Ready = fd2ApplyRollbackChainRows.filter((row) => row.chain_row_status === "ready").length;
  const fd3Ready = fd3SchemaFreezeChainRows.filter((row) => row.row_status === "ready").length;
  const negativeBlocked = negativeFixtureRows.filter((row) => row.fixture_status === "passed" && row.actual_result === "chain_blocked").length;
  const ready = validation.valid
    && seedReady === seedReceiptChainRows.length
    && fd1Ready === 3
    && fd2Ready === 3
    && fd3Ready === 4
    && negativeBlocked === 4
    && boundaryFlagsClosed(boundary);
  return {
    factory_receipt_chain_audit_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    seed_receipt_chain_count: seedReceiptChainRows.length,
    seed_receipt_chain_ready_count: seedReady,
    fd1_owner_receipt_chain_count: fd1OwnerReceiptChainRows.length,
    fd1_owner_receipt_chain_ready_count: fd1Ready,
    fd2_apply_rollback_chain_count: fd2ApplyRollbackChainRows.length,
    fd2_apply_rollback_chain_ready_count: fd2Ready,
    fd3_schema_freeze_chain_count: fd3SchemaFreezeChainRows.length,
    fd3_schema_freeze_chain_ready_count: fd3Ready,
    negative_fixture_count: negativeFixtureRows.length,
    negative_fixture_blocked_count: negativeBlocked,
    seed_receipt_ledger_invalid_rejected: negativeFixtureRows.some((row) => row.fixture_key === "seed_receipt_ledger_invalid" && row.fixture_status === "passed"),
    fd1_prev_entry_hash_break_rejected: negativeFixtureRows.some((row) => row.fixture_key === "fd1_prev_entry_hash_break" && row.fixture_status === "passed"),
    fd2_apply_receipt_hash_mismatch_rejected: negativeFixtureRows.some((row) => row.fixture_key === "fd2_apply_receipt_hash_mismatch" && row.fixture_status === "passed"),
    fd3_negative_fixture_count_drop_rejected: negativeFixtureRows.some((row) => row.fixture_key === "fd3_negative_fixture_count_drop" && row.fixture_status === "passed"),
    receipt_apply_engine_reachable_now: false,
    receipt_apply_engine_opened_now: false,
    rollback_executor_runtime_enabled_now: false,
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
    && boundary.rollback_executor_runtime_enabled_now === false
    && boundary.runtime_state_mutated_now === false;
}

function allAuthorityClosed(value) {
  return AUTHORITY_FALSE_FLAGS.every((flag) => value?.[flag] === false);
}

function validationItem(itemId, category, passed, message, evidenceRef) {
  return {
    schema_version: "factory-receipt-chain-audit-validation-item.v1",
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

function extractCandidateRows(candidateReviewDocket) {
  return (candidateReviewDocket.factory_candidate_review_docket_rows ?? []).map((row) => ({
    product_id: row.product_id,
    candidate_packet_id: row.candidate_packet_id,
    candidate_packet_sha256: row.candidate_packet_sha256,
    review_docket_row_sha256: row.review_docket_row_sha256,
  }));
}

function mutateFd1PrevHash(receiptRows) {
  const clone = deepClone(receiptRows);
  if (clone[1]) clone[1].prev_entry_hash = "0".repeat(64);
  return clone;
}

function mutateApplyReceiptHash(applyIntentRows) {
  const clone = deepClone(applyIntentRows);
  if (clone[0]) clone[0].receipt_entry_hash = "0".repeat(64);
  return clone;
}

function mutateFd3NegativeCount(authoritySchemaFreeze) {
  const clone = deepClone(authoritySchemaFreeze);
  if (clone.summary) {
    clone.summary.negative_fixture_blocked_count = Math.max(0, (clone.summary.negative_fixture_blocked_count ?? 0) - 1);
  }
  return clone;
}

function mutateSeedReceiptValidation(seedReceipts) {
  const clone = deepClone(seedReceipts);
  clone.validation = { valid: false, error_count: 1, errors: [{ item_id: "synthetic.seed.invalid", message: "synthetic invalid seed receipt ledger" }] };
  return clone;
}

function pick(value, keys) {
  return Object.fromEntries(keys.map((key) => [key, value[key]]));
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_FACTORY_RECEIPT_CHAIN_AUDIT_INPUTS;
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
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
    "# Factory Receipt Chain Audit",
    "",
    `Status: ${result.summary.factory_receipt_chain_audit_status}`,
    `Program: ${result.program_range}`,
    `Seed receipt chain: ${result.summary.seed_receipt_chain_ready_count}/${result.summary.seed_receipt_chain_count}`,
    `FD.1 owner receipt chain: ${result.summary.fd1_owner_receipt_chain_ready_count}/${result.summary.fd1_owner_receipt_chain_count}`,
    `FD.2 apply/rollback chain: ${result.summary.fd2_apply_rollback_chain_ready_count}/${result.summary.fd2_apply_rollback_chain_count}`,
    `FD.3 schema freeze chain: ${result.summary.fd3_schema_freeze_chain_ready_count}/${result.summary.fd3_schema_freeze_chain_count}`,
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
    else if (arg === "--check") {
      args.check = true;
      args.write = false;
    }
    else if (arg === "--require-pass") args.requirePass = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else if (arg === "--commit-ref") args.commitRef = argv[++index];
    else if (arg === "--seed-receipt-ledger-dir") args.seedReceiptLedgerDir = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/factory-receipt-chain-audit.mjs [--check] [--require-pass] [--out-dir DIR] [--run-at ISO] [--commit-ref SHA]

Builds the FD.4 receipt chain audit verifier without opening apply, rollback, or write authority.`);
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
