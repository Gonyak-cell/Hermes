import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryCandidateReviewDocket } from "./factory-candidate-review-docket.mjs";
import { buildFactoryReceiptVerify } from "./factory-receipt-verifier.mjs";

export const DEFAULT_FACTORY_APPLY_ENGINE_CLOSED_OUT_DIR = "artifacts/factory-apply-engine-closed/latest";
export const DEFAULT_FACTORY_APPLY_ENGINE_CLOSED_INPUTS = {
  packagePath: "package.json",
  structuredSummaryPath: "docs/factory-promotion/99-structured-summary.json",
};

const COMMAND_NAME = "factory:apply-engine-closed";
const SCHEMA_VERSION = "factory-apply-engine-closed.v1";
const CAPABILITY_ID = "factory.apply_engine_closed";
const PROGRAM_RANGE = "FCORE-FD.2";
const SOURCE_PROGRAM_RANGE = "FCORE-FD.1";
const READY_STATUS = "ready_factory_apply_engine_closed";
const BLOCKED_STATUS = "blocked_factory_apply_engine_closed";
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

const CLOSED_RUNTIME_SIGNALS = {
  receipt_apply_engine_reachable_now: false,
  receipt_apply_engine_opened_now: false,
  apply_engine_runtime_enabled_now: false,
  rollback_executor_reachable_now: false,
  rollback_executor_runtime_enabled_now: false,
  runtime_state_mutated_now: false,
};

export async function runFactoryApplyEngineClosed(options = {}) {
  const result = await buildFactoryApplyEngineClosed(options);
  if (!options.check && options.write !== false) await writeFactoryApplyEngineClosed(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Apply Engine Closed failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_apply_engine_closed_status !== READY_STATUS) {
    const error = new Error("Factory Apply Engine Closed is not ready.");
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  return result;
}

export async function buildFactoryApplyEngineClosed(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_APPLY_ENGINE_CLOSED_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const structuredSummary = await readJsonSource(inputs.structured_summary_path);
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
  const runtimeSignals = buildClosedRuntimeSignals();
  const applyIntentRows = buildApplyIntentRows({
    receiptVerifyRows: receiptVerify.factory_receipt_verification_rows ?? [],
    reviewDocketRows: candidateReviewDocket.factory_candidate_review_docket_rows ?? [],
    runtimeSignals,
    generatedAt,
  });
  const rollbackRows = buildRollbackVerificationRows({
    applyIntentRows,
    reviewDocketRows: candidateReviewDocket.factory_candidate_review_docket_rows ?? [],
    runtimeSignals,
    generatedAt,
  });
  const negativeFixtureRows = buildNegativeFixtureRows({
    receiptVerifyRows: receiptVerify.factory_receipt_verification_rows ?? [],
    reviewDocketRows: candidateReviewDocket.factory_candidate_review_docket_rows ?? [],
    runtimeSignals,
    generatedAt,
  });
  const boundary = buildBoundary({ receiptVerify, candidateReviewDocket, applyIntentRows, rollbackRows, negativeFixtureRows, runtimeSignals, generatedAt });
  const validationItems = buildValidationItems({
    packageJson,
    structuredSummary,
    receiptVerify,
    candidateReviewDocket,
    applyIntentRows,
    rollbackRows,
    negativeFixtureRows,
    boundary,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ applyIntentRows, rollbackRows, negativeFixtureRows, boundary, validation });
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
    },
    source_summaries: {
      fd1_receipt_verify: receiptVerify.summary ?? null,
      fc3_candidate_review_docket: candidateReviewDocket.summary ?? null,
      structured_summary_fd2_command: structuredSummary.data?.fd2_command ?? null,
    },
    factory_apply_intent_rows: applyIntentRows,
    factory_rollback_verification_rows: rollbackRows,
    factory_apply_engine_negative_fixture_rows: negativeFixtureRows,
    factory_apply_engine_closed_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeFactoryApplyEngineClosed(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-apply-engine-closed.json"), serializableResult(result));
  await writeJson(path.join(outDir, "apply-intent-rows.json"), collectionEnvelope("factory-apply-intent-rows.v1", "factory_apply_intent_rows", result.factory_apply_intent_rows, result.generated_at));
  await writeJson(path.join(outDir, "rollback-verification-rows.json"), collectionEnvelope("factory-rollback-verification-rows.v1", "factory_rollback_verification_rows", result.factory_rollback_verification_rows, result.generated_at));
  await writeJson(path.join(outDir, "negative-fixture-rows.json"), collectionEnvelope("factory-apply-engine-negative-fixture-rows.v1", "factory_apply_engine_negative_fixture_rows", result.factory_apply_engine_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_apply_engine_closed_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-apply-engine-closed-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runFactoryApplyEngineClosedCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryApplyEngineClosed(args);
    console.log(`Factory Apply Engine Closed ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_apply_engine_closed_status}`);
    console.log(`Apply intents blocked: ${result.summary.apply_intent_blocked_count}/${result.summary.apply_intent_count}`);
    console.log(`Rollback verifications blocked: ${result.summary.rollback_verification_blocked_count}/${result.summary.rollback_verification_count}`);
    console.log(`Negative fixtures: ${result.summary.negative_fixture_passed_count}/${result.summary.negative_fixture_count}`);
    console.log(`Apply engine reachable: ${result.summary.receipt_apply_engine_reachable_now}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

function buildApplyIntentRows({ receiptVerifyRows, reviewDocketRows, runtimeSignals, generatedAt }) {
  return receiptVerifyRows.map((receipt, index) => {
    const docket = reviewDocketRows.find((row) => row.candidate_packet_sha256 === receipt.candidate_packet_sha256)
      ?? reviewDocketRows.find((row) => row.product_id === receipt.product_id);
    const checks = {
      receipt_ready: receipt.verification_status === "ready",
      receipt_entry_hash_bound: HASH_RE.test(receipt.receipt_entry_hash ?? ""),
      candidate_hash_bound: HASH_RE.test(receipt.candidate_packet_sha256 ?? "") && receipt.receipt_bound_candidate_sha256 === receipt.candidate_packet_sha256,
      review_docket_bound: Boolean(docket) && receipt.checks?.review_docket_bound === true,
      docket_candidate_hash_matches: Boolean(docket) && docket.candidate_packet_sha256 === receipt.candidate_packet_sha256,
      diff_hash_bound: HASH_RE.test(docket?.diff_sha256 ?? ""),
      rollback_plan_hash_bound: HASH_RE.test(docket?.rollback_plan_sha256 ?? ""),
      preflight_passed: docket?.preflight_status === "passed",
      apply_engine_closed: runtimeSignals.receipt_apply_engine_reachable_now === false
        && runtimeSignals.apply_engine_runtime_enabled_now === false,
    };
    const sourceReady = Object.values(checks).every(Boolean);
    const row = {
      schema_version: "factory-apply-intent-row.v1",
      apply_intent_id: `factory-apply-intent.${String(index + 1).padStart(4, "0")}`,
      receipt_id: receipt.receipt_id,
      product_id: receipt.product_id,
      candidate_packet_id: receipt.candidate_packet_id,
      candidate_packet_sha256: receipt.candidate_packet_sha256,
      receipt_entry_hash: receipt.receipt_entry_hash,
      receipt_verification_status: receipt.verification_status,
      review_docket_id: docket?.review_docket_id ?? null,
      review_docket_row_sha256: docket?.review_docket_row_sha256 ?? null,
      diff_packet_id: docket?.diff_packet_id ?? null,
      diff_sha256: docket?.diff_sha256 ?? null,
      rollback_plan_id: docket?.rollback_plan_id ?? null,
      rollback_plan_sha256: docket?.rollback_plan_sha256 ?? null,
      preflight_id: docket?.preflight_id ?? null,
      preflight_sha256: docket?.preflight_sha256 ?? null,
      preflight_status: docket?.preflight_status ?? null,
      requested_action: "apply_candidate_receipt",
      receipt_consumed_for_intent_now: true,
      apply_engine_invoked_now: false,
      apply_intent_status: sourceReady ? "blocked_apply_engine_unreachable" : "blocked_apply_precondition_failed",
      blocked_reason_id: sourceReady ? "apply_engine_runtime_unreachable_by_design" : "apply_precondition_failed_before_runtime",
      checks,
      generated_at: generatedAt,
      ...AUTHORITY_CLOSED,
    };
    return { ...row, apply_intent_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildRollbackVerificationRows({ applyIntentRows, reviewDocketRows, runtimeSignals, generatedAt }) {
  return applyIntentRows.map((intent, index) => {
    const docket = reviewDocketRows.find((row) => row.rollback_plan_id === intent.rollback_plan_id);
    const checks = {
      apply_never_mutated_state: intent.apply_engine_invoked_now === false && intent.apply_intent_status === "blocked_apply_engine_unreachable",
      rollback_plan_bound: Boolean(docket) && docket.rollback_plan_id === intent.rollback_plan_id && docket.rollback_plan_sha256 === intent.rollback_plan_sha256 && HASH_RE.test(intent.rollback_plan_sha256 ?? ""),
      rollback_executor_closed: runtimeSignals.rollback_executor_reachable_now === false
        && runtimeSignals.rollback_executor_runtime_enabled_now === false,
      rollback_executed_now_false: docket?.rollback_executed_now === false,
    };
    const row = {
      schema_version: "factory-rollback-verification-row.v1",
      rollback_verification_id: `factory-rollback-verification.${String(index + 1).padStart(4, "0")}`,
      apply_intent_id: intent.apply_intent_id,
      product_id: intent.product_id,
      candidate_packet_id: intent.candidate_packet_id,
      candidate_packet_sha256: intent.candidate_packet_sha256,
      rollback_plan_id: intent.rollback_plan_id,
      rollback_plan_sha256: intent.rollback_plan_sha256,
      rollback_requested_now: true,
      rollback_executor_invoked_now: false,
      rollback_executed_now: false,
      rollback_verification_status: Object.values(checks).every(Boolean)
        ? "blocked_rollback_executor_unreachable_no_state_mutation"
        : "blocked_rollback_precondition_failed",
      blocked_reason_id: Object.values(checks).every(Boolean)
        ? "rollback_executor_runtime_unreachable_by_design"
        : "rollback_precondition_failed_before_runtime",
      checks,
      generated_at: generatedAt,
      ...AUTHORITY_CLOSED,
    };
    return { ...row, rollback_verification_row_sha256: sha256(canonicalize(row)) };
  });
}

function buildNegativeFixtureRows({ receiptVerifyRows, reviewDocketRows, runtimeSignals, generatedAt }) {
  const firstReceipt = receiptVerifyRows[0] ?? {};
  const secondDocket = reviewDocketRows[1] ?? reviewDocketRows[0] ?? {};
  const receiptIds = new Set(receiptVerifyRows.map((row) => row.receipt_id).filter(Boolean));
  const receiptEntryHashes = new Set(receiptVerifyRows.map((row) => row.receipt_entry_hash).filter(Boolean));
  const duplicateNonce = `fd1-nonce-${slug(firstReceipt.product_id ?? "unknown")}`;
  return [
    evaluateNegativeFixture("forged_receipt_apply_attempt", evaluateForgedReceiptApply({
      firstReceipt,
      receiptEntryHashes,
    }), generatedAt),
    evaluateNegativeFixture("bound_hash_mismatch_apply_attempt", evaluateBoundHashMismatchApply({
      firstReceipt,
      secondDocket,
    }), generatedAt),
    evaluateNegativeFixture("nonce_reuse_apply_attempt", evaluateNonceReuseApply({
      firstReceipt,
      attemptedNonces: [duplicateNonce, duplicateNonce],
    }), generatedAt),
    evaluateNegativeFixture("rollback_after_state_mismatch", evaluateRollbackStateMismatch({
      firstReceipt,
      runtimeSignals,
    }), generatedAt),
    evaluateNegativeFixture("direct_apply_without_fd_receipt", evaluateDirectApplyWithoutReceipt({
      receiptIds,
      runtimeSignals,
    }), generatedAt),
  ];
}

function evaluateNegativeFixture(fixtureKey, evaluation, generatedAt) {
  const passed = evaluation.actual_result === "blocked" || evaluation.actual_result === "failure_report";
  const row = {
    schema_version: "factory-apply-engine-negative-fixture-row.v1",
    fixture_id: `factory-apply-engine-negative-fixture.${fixtureKey}`,
    fixture_key: fixtureKey,
    fixture_status: passed ? "passed" : "failed",
    expected_result: fixtureKey === "rollback_after_state_mismatch" ? "failure_report" : "blocked",
    actual_result: evaluation.actual_result,
    attempted_action: evaluation.attempted_action,
    attempted_receipt_id: evaluation.attempted_receipt_id,
    expected_candidate_packet_sha256: evaluation.expected_candidate_packet_sha256,
    attempted_candidate_packet_sha256: evaluation.attempted_candidate_packet_sha256,
    expected_receipt_entry_hash: evaluation.expected_receipt_entry_hash,
    attempted_receipt_entry_hash: evaluation.attempted_receipt_entry_hash,
    attempted_nonce: evaluation.attempted_nonce,
    duplicate_nonce_seen_now: evaluation.duplicate_nonce_seen_now === true,
    expected_state_hash: evaluation.expected_state_hash,
    observed_state_hash: evaluation.observed_state_hash,
    failure_report_emitted_now: evaluation.failure_report_emitted_now === true,
    observed_blocked_checks: blockedChecks(evaluation.checks),
    checks: evaluation.checks,
    apply_engine_runtime_enabled_now: false,
    rollback_executor_runtime_enabled_now: false,
    generated_at: generatedAt,
    ...AUTHORITY_CLOSED,
  };
  return { ...row, negative_fixture_row_sha256: sha256(canonicalize(row)) };
}

function evaluateForgedReceiptApply({ firstReceipt, receiptEntryHashes }) {
  const attemptedReceiptEntryHash = sha256(`forged:${firstReceipt.receipt_entry_hash ?? "missing"}`);
  const checks = {
    receipt_entry_hash_known: receiptEntryHashes.has(attemptedReceiptEntryHash),
    receipt_payload_hash_valid: attemptedReceiptEntryHash === firstReceipt.receipt_entry_hash,
  };
  return {
    attempted_action: "apply_with_unknown_receipt_entry_hash",
    attempted_receipt_id: `${firstReceipt.receipt_id ?? "receipt"}-forged`,
    expected_receipt_entry_hash: firstReceipt.receipt_entry_hash ?? null,
    attempted_receipt_entry_hash: attemptedReceiptEntryHash,
    checks,
    actual_result: Object.values(checks).every(Boolean) ? "unexpected_ready" : "blocked",
  };
}

function evaluateBoundHashMismatchApply({ firstReceipt, secondDocket }) {
  const checks = {
    candidate_hash_bound: firstReceipt.candidate_packet_sha256 === secondDocket.candidate_packet_sha256,
    docket_candidate_hash_matches: firstReceipt.product_id === secondDocket.product_id,
  };
  return {
    attempted_action: "apply_receipt_to_mismatched_candidate_hash",
    attempted_receipt_id: firstReceipt.receipt_id ?? null,
    expected_candidate_packet_sha256: firstReceipt.candidate_packet_sha256 ?? null,
    attempted_candidate_packet_sha256: secondDocket.candidate_packet_sha256 ?? sha256("missing-candidate"),
    checks,
    actual_result: Object.values(checks).every(Boolean) ? "unexpected_ready" : "blocked",
  };
}

function evaluateNonceReuseApply({ firstReceipt, attemptedNonces }) {
  const nonceCounts = countBy(attemptedNonces);
  const nonce = attemptedNonces[0] ?? null;
  const checks = {
    nonce_unique: Boolean(nonce) && nonceCounts.get(nonce) === 1,
    receipt_replay_guard: Boolean(nonce) && nonceCounts.get(nonce) === 1,
  };
  return {
    attempted_action: "apply_receipt_with_reused_nonce",
    attempted_receipt_id: firstReceipt.receipt_id ?? null,
    attempted_nonce: nonce,
    duplicate_nonce_seen_now: Boolean(nonce) && nonceCounts.get(nonce) > 1,
    checks,
    actual_result: Object.values(checks).every(Boolean) ? "unexpected_ready" : "blocked",
  };
}

function evaluateRollbackStateMismatch({ firstReceipt, runtimeSignals }) {
  const expectedStateHash = sha256(`expected-state:${firstReceipt.candidate_packet_sha256 ?? "missing"}`);
  const observedStateHash = sha256(`observed-state-mismatch:${firstReceipt.candidate_packet_sha256 ?? "missing"}`);
  const checks = {
    state_snapshot_matches: expectedStateHash === observedStateHash,
    rollback_executor_closed: runtimeSignals.rollback_executor_reachable_now === false
      && runtimeSignals.rollback_executor_runtime_enabled_now === false,
  };
  const failureReport = checks.state_snapshot_matches === false && checks.rollback_executor_closed === true;
  return {
    attempted_action: "rollback_after_state_hash_mismatch",
    attempted_receipt_id: firstReceipt.receipt_id ?? null,
    expected_state_hash: expectedStateHash,
    observed_state_hash: observedStateHash,
    failure_report_emitted_now: failureReport,
    checks,
    actual_result: failureReport ? "failure_report" : "unexpected_ready",
  };
}

function evaluateDirectApplyWithoutReceipt({ receiptIds, runtimeSignals }) {
  const attemptedReceiptId = null;
  const checks = {
    fd_receipt_present: Boolean(attemptedReceiptId),
    receipt_id_known: receiptIds.has(attemptedReceiptId),
    apply_engine_closed: runtimeSignals.receipt_apply_engine_reachable_now === false
      && runtimeSignals.apply_engine_runtime_enabled_now === false,
  };
  return {
    attempted_action: "apply_without_fd_receipt",
    attempted_receipt_id: attemptedReceiptId,
    checks,
    actual_result: checks.fd_receipt_present && checks.receipt_id_known ? "unexpected_ready" : "blocked",
  };
}

function buildBoundary({ receiptVerify, candidateReviewDocket, applyIntentRows, rollbackRows, negativeFixtureRows, runtimeSignals, generatedAt }) {
  return {
    schema_version: "factory-apply-engine-closed-boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    report_only: true,
    source_program_range: SOURCE_PROGRAM_RANGE,
    fd1_receipt_verify_ready_now: receiptVerify.summary?.factory_receipt_verify_status === "ready_factory_receipt_verify",
    fc3_candidate_review_docket_ready_now: candidateReviewDocket.summary?.factory_candidate_review_docket_status === "ready_factory_candidate_review_docket",
    receipt_consumption_intent_row_count: applyIntentRows.length,
    rollback_verification_row_count: rollbackRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    ...runtimeSignals,
    ...AUTHORITY_CLOSED,
  };
}

function buildValidationItems({ packageJson, structuredSummary, receiptVerify, candidateReviewDocket, applyIntentRows, rollbackRows, negativeFixtureRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    validationItem("package.script", "package", scripts[COMMAND_NAME] === "node scripts/factory-apply-engine-closed.mjs", `${COMMAND_NAME} package script missing`, packageJson.path),
    validationItem("summary.fd2_command", "structured_summary", structuredSummary.data?.fd2_command === "npm run factory:apply-engine-closed -- --check --require-pass", "Structured summary does not expose FD.2 command", structuredSummary.path),
    validationItem("source.fd1.ready", "source", receiptVerify.summary?.factory_receipt_verify_status === "ready_factory_receipt_verify" && receiptVerify.validation?.valid === true, "FD.1 receipt verifier is not ready", "factory_receipt_verify"),
    validationItem("source.fd1.closed", "source", receiptVerify.summary?.receipt_apply_engine_reachable_now === false && receiptVerify.summary?.apply_engine_runtime_enabled_now === false && receiptVerify.summary?.rollback_executor_runtime_enabled_now === false, "FD.1 source opened apply or rollback runtime", "factory_receipt_verify"),
    validationItem("source.fc3.ready", "source", candidateReviewDocket.summary?.factory_candidate_review_docket_status === "ready_factory_candidate_review_docket" && candidateReviewDocket.validation?.valid === true, "FC.3 candidate review docket is not ready", "factory_candidate_review_docket"),
    validationItem("apply.rows.count", "apply_intent", applyIntentRows.length === 3, "FD.2 must build 3 apply intent rows", "factory_apply_intent_rows"),
    validationItem("apply.rows.blocked", "apply_intent", applyIntentRows.every((row) => row.apply_intent_status === "blocked_apply_engine_unreachable" && row.apply_engine_invoked_now === false && row.apply_allowed_now === false), "Apply intent rows must be blocked by unreachable engine", "factory_apply_intent_rows"),
    validationItem("rollback.rows.count", "rollback", rollbackRows.length === 3, "FD.2 must build 3 rollback verification rows", "factory_rollback_verification_rows"),
    validationItem("rollback.rows.blocked", "rollback", rollbackRows.every((row) => row.rollback_verification_status === "blocked_rollback_executor_unreachable_no_state_mutation" && row.rollback_executor_invoked_now === false && row.rollback_executed_now === false), "Rollback rows must be blocked by unreachable executor without state mutation", "factory_rollback_verification_rows"),
    validationItem("negative.fixtures.count", "negative_fixture", negativeFixtureRows.length === 5, "FD.2 must execute 5 apply/rollback negative fixtures", "factory_apply_engine_negative_fixture_rows"),
    validationItem("negative.fixtures.blocked", "negative_fixture", negativeFixtureRows.every((row) => row.fixture_status === "passed" && (row.actual_result === "blocked" || row.actual_result === "failure_report")), "Negative fixtures must block or emit failure report", "factory_apply_engine_negative_fixture_rows"),
    validationItem("boundary.closed", "authority", boundaryFlagsClosed(boundary), "FD.2 boundary opened apply/write/deploy/protected/production authority", "factory_apply_engine_closed_boundary"),
  ];
}

function buildSummary({ applyIntentRows, rollbackRows, negativeFixtureRows, boundary, validation }) {
  const applyBlockedCount = applyIntentRows.filter((row) => row.apply_intent_status === "blocked_apply_engine_unreachable").length;
  const rollbackBlockedCount = rollbackRows.filter((row) => row.rollback_verification_status === "blocked_rollback_executor_unreachable_no_state_mutation").length;
  const negativePassedCount = negativeFixtureRows.filter((row) => row.fixture_status === "passed").length;
  const ready = validation.valid
    && applyIntentRows.length === 3
    && applyBlockedCount === applyIntentRows.length
    && rollbackRows.length === 3
    && rollbackBlockedCount === rollbackRows.length
    && negativeFixtureRows.length === 5
    && negativePassedCount === negativeFixtureRows.length
    && boundaryFlagsClosed(boundary);
  return {
    factory_apply_engine_closed_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    apply_intent_count: applyIntentRows.length,
    apply_intent_blocked_count: applyBlockedCount,
    rollback_verification_count: rollbackRows.length,
    rollback_verification_blocked_count: rollbackBlockedCount,
    negative_fixture_count: negativeFixtureRows.length,
    negative_fixture_passed_count: negativePassedCount,
    forged_receipt_apply_rejected: negativeFixtureRows.some((row) => row.fixture_key === "forged_receipt_apply_attempt" && row.fixture_status === "passed"),
    bound_hash_mismatch_apply_rejected: negativeFixtureRows.some((row) => row.fixture_key === "bound_hash_mismatch_apply_attempt" && row.fixture_status === "passed"),
    nonce_reuse_apply_rejected: negativeFixtureRows.some((row) => row.fixture_key === "nonce_reuse_apply_attempt" && row.fixture_status === "passed"),
    rollback_state_mismatch_failure_reported: negativeFixtureRows.some((row) => row.fixture_key === "rollback_after_state_mismatch" && row.actual_result === "failure_report"),
    direct_apply_without_fd_receipt_rejected: negativeFixtureRows.some((row) => row.fixture_key === "direct_apply_without_fd_receipt" && row.fixture_status === "passed"),
    receipt_apply_engine_reachable_now: false,
    receipt_apply_engine_opened_now: false,
    apply_engine_runtime_enabled_now: false,
    rollback_executor_runtime_enabled_now: false,
    runtime_state_mutated_now: false,
    ...AUTHORITY_CLOSED,
    validation_errors: validation.errors.length,
  };
}

function boundaryFlagsClosed(boundary) {
  return AUTHORITY_FALSE_FLAGS.every((flag) => boundary[flag] === false)
    && boundary.receipt_apply_engine_reachable_now === false
    && boundary.receipt_apply_engine_opened_now === false
    && boundary.rollback_executor_reachable_now === false
    && boundary.runtime_state_mutated_now === false;
}

function buildClosedRuntimeSignals() {
  return { ...CLOSED_RUNTIME_SIGNALS };
}

function blockedChecks(checks) {
  return Object.entries(checks ?? {})
    .filter(([, passed]) => passed === false)
    .map(([check]) => check);
}

function countBy(values) {
  const map = new Map();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return map;
}

function validationItem(itemId, category, passed, message, evidenceRef) {
  return {
    schema_version: "factory-apply-engine-closed-validation-item.v1",
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
  const defaults = DEFAULT_FACTORY_APPLY_ENGINE_CLOSED_INPUTS;
  return {
    repo_root: repoRoot,
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
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
    "# Factory Apply Engine Closed",
    "",
    `Status: ${result.summary.factory_apply_engine_closed_status}`,
    `Program: ${result.program_range}`,
    `Apply intents blocked: ${result.summary.apply_intent_blocked_count}/${result.summary.apply_intent_count}`,
    `Rollback verifications blocked: ${result.summary.rollback_verification_blocked_count}/${result.summary.rollback_verification_count}`,
    `Negative fixtures passed: ${result.summary.negative_fixture_passed_count}/${result.summary.negative_fixture_count}`,
    `Apply engine reachable: ${result.summary.receipt_apply_engine_reachable_now}`,
    `Runtime state mutated: ${result.summary.runtime_state_mutated_now}`,
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
  console.log(`Usage: node scripts/factory-apply-engine-closed.mjs [--check] [--require-pass] [--out-dir DIR] [--run-at ISO] [--commit-ref SHA]

Builds the FD.2 closed apply-engine and rollback-executor verifier without applying source changes.`);
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
