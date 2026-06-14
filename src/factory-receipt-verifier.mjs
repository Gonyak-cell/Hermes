import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryCandidateFreezeHandoff } from "./factory-candidate-freeze-handoff.mjs";
import { buildFactoryCandidateReviewDocket } from "./factory-candidate-review-docket.mjs";
import {
  computeFactoryEntryHash,
  computeFactoryPayloadHash,
  readFactoryLedgerFile,
} from "./factory-product-registry-store.mjs";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_FACTORY_RECEIPT_VERIFY_OUT_DIR = "artifacts/factory-receipt-verify/latest";
export const DEFAULT_FACTORY_RECEIPT_VERIFY_INPUTS = {
  receiptEnvelopeSchemaPath: "schemas/factory-receipt-envelope.schema.json",
  seedReceiptLedgerDir: "data/factory/seed",
  structuredSummaryPath: "docs/factory-promotion/99-structured-summary.json",
};

const COMMAND_NAME = "factory:receipt-verify";
const SCHEMA_VERSION = "factory-receipt-verify.v1";
const CAPABILITY_ID = "factory.receipt_verify";
const PROGRAM_RANGE = "FCORE-FD.1";
const SOURCE_PROGRAM_RANGE = "FCORE-FC.5";
const READY_STATUS = "ready_factory_receipt_verify";
const BLOCKED_STATUS = "valid_block_factory_receipt_verify_pending";
const HASH_RE = /^[a-f0-9]{64}$/;
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

const AUTHORITY_CLOSED = Object.fromEntries(AUTHORITY_FALSE_FLAGS.map((flag) => [flag, false]));

export async function runFactoryReceiptVerify(options = {}) {
  const result = await buildFactoryReceiptVerify(options);
  if (!options.check && options.write !== false) await writeFactoryReceiptVerify(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Receipt Verify failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_receipt_verify_status !== READY_STATUS) {
    const error = new Error("Factory Receipt Verify is not ready.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryReceiptVerify(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_RECEIPT_VERIFY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const receiptSchema = await readJsonSource(inputs.receipt_envelope_schema_path);
  const structuredSummary = await readJsonSource(inputs.structured_summary_path);
  const seedReceipts = Object.prototype.hasOwnProperty.call(options, "seedReceipts")
    ? options.seedReceipts
    : await readFactoryLedgerFile(RECEIPTS_LEDGER, { ledgerDir: inputs.seed_receipt_ledger_dir });
  const candidateReviewDocket = Object.prototype.hasOwnProperty.call(options, "candidateReviewDocket")
    ? options.candidateReviewDocket
    : await buildFactoryCandidateReviewDocket({
      ...options,
      outDir: path.join(outputDir, "source-docket"),
      runAt: generatedAt,
      write: false,
    });
  const candidateFreezeHandoff = Object.prototype.hasOwnProperty.call(options, "candidateFreezeHandoff")
    ? options.candidateFreezeHandoff
    : await buildFactoryCandidateFreezeHandoff({
      ...options,
      outDir: path.join(outputDir, "source-freeze"),
      runAt: generatedAt,
      write: false,
    });
  const candidateRows = extractCandidateRows(candidateReviewDocket);
  const receiptRows = Object.prototype.hasOwnProperty.call(options, "receiptRows")
    ? options.receiptRows
    : buildOwnerAttestationReceipts({ candidateRows, generatedAt, commitRef: options.commitRef ?? readGitCommitRef(inputs.repo_root) });
  const verificationRows = verifyFactoryReceiptRows({ receiptRows, candidateRows, receiptSchema, generatedAt });
  const negativeFixtureRows = buildNegativeFixtureRows({ receiptRows, candidateRows, receiptSchema, generatedAt });
  const boundary = buildBoundary({ candidateFreezeHandoff, verificationRows, negativeFixtureRows, seedReceipts, generatedAt });
  const validationItems = buildValidationItems({
    candidateFreezeHandoff,
    candidateReviewDocket,
    receiptSchema,
    seedReceipts,
    receiptRows,
    verificationRows,
    negativeFixtureRows,
    boundary,
    structuredSummary,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ candidateRows, verificationRows, negativeFixtureRows, boundary, validation });
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
      receipt_envelope_schema_path: receiptSchema.path,
      seed_receipt_ledger_dir: seedReceipts.ledger_dir ?? inputs.seed_receipt_ledger_dir,
      structured_summary_path: structuredSummary.path,
    },
    source_summaries: {
      fc5_freeze_handoff: candidateFreezeHandoff.summary ?? null,
      fc3_candidate_review_docket: candidateReviewDocket.summary ?? null,
      seed_receipts: summarizeSeedReceipts(seedReceipts),
      structured_summary_fd_command: structuredSummary.data?.new_validation_commands_by_tranche?.FD ?? null,
    },
    factory_receipt_verification_rows: verificationRows,
    factory_receipt_negative_fixture_rows: negativeFixtureRows,
    factory_receipt_apply_engine_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryReceiptVerify(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-receipt-verify.json"), serializableResult(result));
  await writeJson(path.join(outDir, "receipt-verification-rows.json"), collectionEnvelope("factory-receipt-verification-rows.v1", "factory_receipt_verification_rows", result.factory_receipt_verification_rows, result.generated_at));
  await writeJson(path.join(outDir, "negative-fixture-rows.json"), collectionEnvelope("factory-receipt-negative-fixture-rows.v1", "factory_receipt_negative_fixture_rows", result.factory_receipt_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "apply-engine-boundary.json"), result.factory_receipt_apply_engine_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-receipt-verify-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryReceiptVerifyCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryReceiptVerify(args);
    console.log(`Factory Receipt Verify ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_receipt_verify_status}`);
    console.log(`Candidate receipts: ${result.summary.receipt_verification_ready_count}/${result.summary.receipt_verification_count}`);
    console.log(`Negative fixtures: ${result.summary.negative_fixture_blocked_count}/${result.summary.negative_fixture_count}`);
    console.log(`Apply engine reachable: ${result.summary.apply_engine_runtime_enabled_now}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

export function buildOwnerAttestationReceipts({ candidateRows, generatedAt, commitRef = "" }) {
  let prevEntryHash = null;
  return candidateRows.map((candidate, index) => {
    const productSlug = slug(candidate.product_id);
    const receipt = {
      schema_version: "factory-receipt-envelope.v1",
      receipt_id: `rcpt-fd1-owner-attestation-${productSlug}`,
      receipt_kind: "owner_attestation",
      issued_at: generatedAt,
      issuer: {
        issuer_role: "human_owner",
        issuer_id: "owner.local",
        engine_resolved_model_id: "human",
      },
      subject: {
        product_id: candidate.product_id,
        artifact_id: `artifact.${slug(candidate.candidate_packet_id)}`,
        scope_id: PROGRAM_RANGE,
        bound_candidate_sha256: candidate.candidate_packet_sha256,
        bound_review_docket_row_sha256: candidate.review_docket_row_sha256,
        reviewed_commit_sha: commitRef || null,
      },
      attestation: {
        attestation_id: `attestation.fd1.${String(index + 1).padStart(4, "0")}`,
        nonce: `fd1-nonce-${productSlug}`,
        nonce_scope: PROGRAM_RANGE,
        owner_attestation_present: true,
        human_note: "Owner attests that this receipt is bound to the candidate packet hash only; apply remains disabled.",
      },
      fd_receipt_verify: {
        bound_candidate_sha256_required: true,
        owner_attestation_required: true,
        replay_nonce_required: true,
        apply_engine_runtime_enabled_now: false,
        apply_attempted_now: false,
      },
      authority_flags: AUTHORITY_CLOSED,
    };
    const withHashes = withReceiptLedgerHashes(receipt, prevEntryHash);
    prevEntryHash = withHashes.entry_hash;
    return withHashes;
  });
}

export function verifyFactoryReceiptRows({ receiptRows, candidateRows, receiptSchema, generatedAt }) {
  const nonceCounts = countBy(receiptRows.map((row) => row.attestation?.nonce).filter(Boolean));
  let expectedPrevEntryHash = null;
  return receiptRows.map((receipt, index) => {
    const candidate = candidateRows.find((row) => row.candidate_packet_sha256 === receipt.subject?.bound_candidate_sha256)
      ?? candidateRows.find((row) => row.product_id === receipt.subject?.product_id && row.review_docket_row_sha256 === receipt.subject?.bound_review_docket_row_sha256);
    const expectedPayloadHash = computeFactoryPayloadHash(receipt);
    const expectedEntryHash = computeFactoryEntryHash(RECEIPTS_LEDGER, receipt);
    const schemaErrors = receiptSchema.available
      ? validateAgainstSchema(receipt, receiptSchema.data, {}, `receipt.${index}`)
      : [{ path: "schema", message: receiptSchema.error ?? "Receipt schema unavailable" }];
    const checks = {
      schema_valid: schemaErrors.length === 0,
      payload_hash_valid: receipt.payload_sha256 === expectedPayloadHash,
      prev_entry_hash_valid: receipt.prev_entry_hash === expectedPrevEntryHash,
      entry_hash_valid: HASH_RE.test(receipt.entry_hash ?? "") && receipt.entry_hash === expectedEntryHash,
      candidate_bound: Boolean(candidate) && receipt.subject?.bound_candidate_sha256 === candidate.candidate_packet_sha256,
      review_docket_bound: Boolean(candidate) && receipt.subject?.bound_review_docket_row_sha256 === candidate.review_docket_row_sha256,
      owner_attestation_present: receipt.issuer?.issuer_role === "human_owner"
        && receipt.issuer?.engine_resolved_model_id === "human"
        && receipt.attestation?.owner_attestation_present === true
        && typeof receipt.attestation?.human_note === "string"
        && receipt.attestation.human_note.trim().length > 0,
      nonce_unique: Boolean(receipt.attestation?.nonce) && nonceCounts.get(receipt.attestation.nonce) === 1,
      authority_closed: allAuthorityClosed({ ...receipt.authority_flags, ...receipt.fd_receipt_verify }),
    };
    const status = Object.values(checks).every(Boolean) ? "ready" : "blocked";
    const row = {
      schema_version: "factory-receipt-verification-row.v1",
      verification_row_id: `factory-receipt-verification.${String(index + 1).padStart(4, "0")}`,
      receipt_id: receipt.receipt_id,
      product_id: receipt.subject?.product_id ?? null,
      candidate_packet_id: candidate?.candidate_packet_id ?? null,
      candidate_packet_sha256: candidate?.candidate_packet_sha256 ?? null,
      receipt_bound_candidate_sha256: receipt.subject?.bound_candidate_sha256 ?? null,
      receipt_entry_hash: receipt.entry_hash ?? null,
      verification_status: status,
      checks,
      schema_error_count: schemaErrors.length,
      schema_errors: schemaErrors,
      apply_engine_runtime_enabled_now: false,
      generated_at: generatedAt,
    };
    expectedPrevEntryHash = receipt.entry_hash;
    return { ...row, verification_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildNegativeFixtureRows({ receiptRows, candidateRows, receiptSchema, generatedAt }) {
  const [firstReceipt, secondReceipt] = receiptRows;
  const forgedCandidateReceipt = withReceiptLedgerHashes({
    ...firstReceipt,
    subject: {
      ...firstReceipt.subject,
      bound_candidate_sha256: "0".repeat(64),
    },
  });
  const nonceReplayReceipt = withReceiptLedgerHashes({
    ...secondReceipt,
    receipt_id: `${secondReceipt.receipt_id}-nonce-replay`,
    attestation: {
      ...secondReceipt.attestation,
      nonce: firstReceipt.attestation?.nonce,
    },
  }, firstReceipt.entry_hash);
  const applyEnabledReceipt = withReceiptLedgerHashes({
    ...firstReceipt,
    receipt_id: `${firstReceipt.receipt_id}-apply-open`,
    fd_receipt_verify: {
      ...firstReceipt.fd_receipt_verify,
      apply_engine_runtime_enabled_now: true,
      apply_attempted_now: true,
    },
    authority_flags: {
      ...firstReceipt.authority_flags,
      apply_allowed_now: true,
    },
  });
  return [
    negativeFixture("bound_candidate_hash_mismatch", [forgedCandidateReceipt], candidateRows, receiptSchema, generatedAt),
    negativeFixture("owner_attestation_missing", [missingOwnerAttestationReceipt(firstReceipt)], candidateRows, receiptSchema, generatedAt),
    negativeFixture("nonce_replay", [firstReceipt, nonceReplayReceipt], candidateRows, receiptSchema, generatedAt),
    negativeFixture("apply_engine_open_attempt", [applyEnabledReceipt], candidateRows, receiptSchema, generatedAt),
  ];
}

function missingOwnerAttestationReceipt(receipt) {
  return withReceiptLedgerHashes({
    ...receipt,
    receipt_id: `${receipt.receipt_id}-owner-missing`,
    issuer: {
      ...receipt.issuer,
      issuer_role: "codex_implementer",
      issuer_id: "codex",
      engine_resolved_model_id: "codex",
    },
    attestation: {
      ...receipt.attestation,
      owner_attestation_present: false,
      human_note: "",
    },
  });
}

function negativeFixture(fixtureKey, receipts, candidateRows, receiptSchema, generatedAt) {
  const rows = verifyFactoryReceiptRows({ receiptRows: receipts, candidateRows, receiptSchema, generatedAt });
  const blocked = rows.some((row) => row.verification_status === "blocked");
  const row = {
    schema_version: "factory-receipt-negative-fixture-row.v1",
    fixture_id: `factory-receipt-negative-fixture.${fixtureKey}`,
    fixture_key: fixtureKey,
    attempted_receipt_ids: receipts.map((receipt) => receipt.receipt_id),
    expected_result: "blocked",
    actual_result: blocked ? "blocked" : "unexpected_ready",
    blocked,
    observed_blocked_checks: [...new Set(rows.flatMap((verificationRow) => (
      Object.entries(verificationRow.checks)
        .filter(([, passed]) => passed === false)
        .map(([check]) => check)
    )))],
    apply_engine_runtime_enabled_now: false,
    generated_at: generatedAt,
  };
  return { ...row, negative_fixture_row_sha256: sha256(canonicalize(row)) };
}

function buildBoundary({ candidateFreezeHandoff, verificationRows, negativeFixtureRows, seedReceipts, generatedAt }) {
  const readyRows = verificationRows.every((row) => row.verification_status === "ready");
  const negativeBlocked = negativeFixtureRows.every((row) => row.blocked === true);
  const fc5Ready = candidateFreezeHandoff.summary?.factory_candidate_freeze_handoff_status === "ready_factory_candidate_freeze_handoff"
    && candidateFreezeHandoff.summary?.fd_implementation_handoff_allowed_now === true
    && candidateFreezeHandoff.summary?.apply_allowed_now === false;
  const seedReceiptsValid = seedReceipts.validation?.valid === true && seedReceipts.entries?.length >= 1;
  return {
    schema_version: "factory-receipt-apply-engine-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    report_only: true,
    fd_receipt_verification_ready_now: readyRows && negativeBlocked && fc5Ready && seedReceiptsValid,
    fd_implementation_handoff_consumed_now: fc5Ready,
    receipt_apply_engine_reachable_now: false,
    apply_engine_runtime_enabled_now: false,
    rollback_executor_runtime_enabled_now: false,
    candidate_receipt_count: verificationRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    seed_receipt_count: seedReceipts.entries?.length ?? 0,
    ...AUTHORITY_CLOSED,
  };
}

function buildValidationItems({ candidateFreezeHandoff, candidateReviewDocket, receiptSchema, seedReceipts, receiptRows, verificationRows, negativeFixtureRows, boundary, structuredSummary }) {
  return [
    validationItem("schema.receipt.available", "schema", receiptSchema.available, "Receipt envelope schema is unavailable", receiptSchema.path),
    validationItem("fc5.handoff.ready", "source", candidateFreezeHandoff.summary?.factory_candidate_freeze_handoff_status === "ready_factory_candidate_freeze_handoff", "FC.5 freeze handoff is not ready", "factory_candidate_freeze_handoff"),
    validationItem("fc5.apply.closed", "authority", candidateFreezeHandoff.summary?.apply_allowed_now === false, "FC.5 source apply authority is open", "factory_candidate_freeze_handoff"),
    validationItem("fc3.docket.ready", "source", candidateReviewDocket.summary?.factory_candidate_review_docket_status === "ready_factory_candidate_review_docket", "FC.3 review docket is not ready", "factory_candidate_review_docket"),
    validationItem("seed.receipts.valid", "seed", seedReceipts.validation?.valid === true, "Seed receipts ledger is invalid", seedReceipts.file_path ?? seedReceipts.ledger_dir),
    validationItem("seed.receipts.present", "seed", (seedReceipts.entries?.length ?? 0) >= 1, "Seed receipts ledger is empty", seedReceipts.file_path ?? seedReceipts.ledger_dir),
    validationItem("receipt.rows.count", "receipt", receiptRows.length === 3 && verificationRows.length === 3, "FD.1 must verify 3 candidate receipts", "factory_receipt_verification_rows"),
    validationItem("receipt.rows.ready", "receipt", verificationRows.every((row) => row.verification_status === "ready"), "One or more receipt rows failed verification", "factory_receipt_verification_rows"),
    validationItem("negative.bound_hash.blocked", "negative_fixture", negativeFixtureRows.some((row) => row.fixture_key === "bound_candidate_hash_mismatch" && row.blocked), "Bound candidate hash mismatch was not blocked", "factory_receipt_negative_fixture_rows"),
    validationItem("negative.owner_attestation.blocked", "negative_fixture", negativeFixtureRows.some((row) => row.fixture_key === "owner_attestation_missing" && row.blocked), "Missing or forged owner attestation was not blocked", "factory_receipt_negative_fixture_rows"),
    validationItem("negative.nonce_replay.blocked", "negative_fixture", negativeFixtureRows.some((row) => row.fixture_key === "nonce_replay" && row.blocked), "Nonce replay was not blocked", "factory_receipt_negative_fixture_rows"),
    validationItem("negative.apply_open.blocked", "negative_fixture", negativeFixtureRows.some((row) => row.fixture_key === "apply_engine_open_attempt" && row.blocked), "Apply engine open attempt was not blocked", "factory_receipt_negative_fixture_rows"),
    validationItem("summary.fd_command.reserved", "structured_summary", structuredSummary.data?.new_validation_commands_by_tranche?.FD === "npm run factory:receipt-verify -- --check", "Structured summary does not reserve FD receipt verification command", structuredSummary.path),
    validationItem("boundary.apply.closed", "authority", boundaryFlagsClosed(boundary), "FD.1 boundary opened apply/write/deploy/protected/production authority", "factory_receipt_apply_engine_boundary"),
  ];
}

function buildSummary({ candidateRows, verificationRows, negativeFixtureRows, boundary, validation }) {
  const readyCount = verificationRows.filter((row) => row.verification_status === "ready").length;
  const blockedFixtureCount = negativeFixtureRows.filter((row) => row.blocked === true).length;
  const ready = validation.valid
    && readyCount === verificationRows.length
    && verificationRows.length === 3
    && blockedFixtureCount === negativeFixtureRows.length
    && boundary.fd_receipt_verification_ready_now === true
    && boundaryFlagsClosed(boundary);
  return {
    factory_receipt_verify_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    candidate_packet_count: candidateRows.length,
    receipt_verification_count: verificationRows.length,
    receipt_verification_ready_count: readyCount,
    negative_fixture_count: negativeFixtureRows.length,
    negative_fixture_blocked_count: blockedFixtureCount,
    bound_candidate_hash_mismatch_rejected: negativeFixtureRows.some((row) => row.fixture_key === "bound_candidate_hash_mismatch" && row.blocked),
    nonce_replay_rejected: negativeFixtureRows.some((row) => row.fixture_key === "nonce_replay" && row.blocked),
    owner_attestation_missing_rejected: negativeFixtureRows.some((row) => row.fixture_key === "owner_attestation_missing" && row.blocked),
    apply_engine_open_attempt_rejected: negativeFixtureRows.some((row) => row.fixture_key === "apply_engine_open_attempt" && row.blocked),
    owner_attestation_status: "synthetic_fixture_only_pending_real_owner_adjudication",
    receipt_apply_engine_reachable_now: false,
    apply_engine_runtime_enabled_now: false,
    rollback_executor_runtime_enabled_now: false,
    ...AUTHORITY_CLOSED,
    validation_errors: validation.errors.length,
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

function withReceiptLedgerHashes(receipt, prevEntryHash = null) {
  const draft = omitKeys(receipt, ["payload_sha256", "prev_entry_hash", "entry_hash"]);
  const row = { ...draft, payload_sha256: computeFactoryPayloadHash(draft), prev_entry_hash: prevEntryHash };
  return { ...row, entry_hash: computeFactoryEntryHash(RECEIPTS_LEDGER, row) };
}

function boundaryFlagsClosed(boundary) {
  return AUTHORITY_FALSE_FLAGS.every((flag) => boundary[flag] === false)
    && boundary.receipt_apply_engine_reachable_now === false
    && boundary.apply_engine_runtime_enabled_now === false
    && boundary.rollback_executor_runtime_enabled_now === false;
}

function allAuthorityClosed(value) {
  return AUTHORITY_FALSE_FLAGS.every((flag) => value?.[flag] === false);
}

function countBy(values) {
  const map = new Map();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return map;
}

function validationItem(itemId, category, passed, message, evidenceRef) {
  return {
    schema_version: "factory-receipt-verify-validation-item.v1",
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
  const defaults = DEFAULT_FACTORY_RECEIPT_VERIFY_INPUTS;
  return {
    repo_root: repoRoot,
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
    "# Factory Receipt Verify",
    "",
    `Status: ${result.summary.factory_receipt_verify_status}`,
    `Program: ${result.program_range}`,
    `Candidate receipts: ${result.summary.receipt_verification_ready_count}/${result.summary.receipt_verification_count}`,
    `Negative fixtures blocked: ${result.summary.negative_fixture_blocked_count}/${result.summary.negative_fixture_count}`,
    `Apply engine reachable: ${result.summary.receipt_apply_engine_reachable_now}`,
    `Apply engine runtime enabled: ${result.summary.apply_engine_runtime_enabled_now}`,
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
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/factory-receipt-verifier.mjs [--check] [--require-pass] [--out-dir DIR] [--run-at ISO] [--commit-ref SHA]

Builds the FD.1 receipt integrity verifier while keeping apply and rollback runtime closed.`);
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

function omitKeys(value, keys) {
  const omitted = new Set(keys);
  return Object.fromEntries(Object.entries(value ?? {}).filter(([key]) => !omitted.has(key)));
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

function slug(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}
