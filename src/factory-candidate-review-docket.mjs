import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactoryCandidateLane } from "./factory-candidate-lane.mjs";
import { buildFactoryCandidateLaneProof } from "./factory-candidate-lane-proof.mjs";

export const DEFAULT_FACTORY_CANDIDATE_REVIEW_DOCKET_OUT_DIR = "artifacts/factory-candidate-review-docket/latest";

const COMMAND_NAME = "factory:candidate-review-docket";
const SCHEMA_VERSION = "factory-candidate-review-docket.v1";
const CAPABILITY_ID = "factory.candidate_review_docket";
const PROGRAM_RANGE = "FCORE-FC.3";
const READY_STATUS = "ready_factory_candidate_review_docket";
const BLOCKED_STATUS = "blocked_factory_candidate_review_docket";
const DEFAULT_MINIMUM_CANDIDATE_COUNT = 3;
const HASH_RE = /^[a-f0-9]{64}$/;

const AUTHORITY_CLOSED = {
  project_creation_allowed_now: false,
  repo_write_allowed_now: false,
  connector_write_allowed_now: false,
  deployment_allowed_now: false,
  protected_action_allowed_now: false,
  production_pass_enabled: false,
  enterprise_pass_enabled: false,
};

export async function runFactoryCandidateReviewDocket(options = {}) {
  const result = await buildFactoryCandidateReviewDocket(options);
  if (options.write !== false) await writeFactoryCandidateReviewDocket(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Factory Candidate Review Docket failed with ${result.validation.errors.length} validation error(s).`);
    error.validation = result.validation;
    error.summary = result.summary;
    throw error;
  }
  if (options.requirePass && result.summary.factory_candidate_review_docket_status !== READY_STATUS) {
    const error = new Error("Factory Candidate Review Docket is not ready.");
    error.summary = result.summary;
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildFactoryCandidateReviewDocket(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_FACTORY_CANDIDATE_REVIEW_DOCKET_OUT_DIR);
  const minimumCandidateCount = Number(options.minimumCandidateCount ?? DEFAULT_MINIMUM_CANDIDATE_COUNT);
  const source = await resolveCandidateLaneSource({
    ...options,
    outputDir,
    generatedAt,
  });
  const candidateLane = source.candidateLane;
  const reviewDocketRows = buildReviewDocketRows(candidateLane, generatedAt);
  const reviewPacketRows = buildReviewPacketRows(candidateLane, reviewDocketRows, generatedAt);
  const reviewHashRegisterRows = buildReviewHashRegisterRows(reviewDocketRows, reviewPacketRows, generatedAt);
  const negativeFixtureRows = buildNegativeFixtureRows({ generatedAt, reviewDocketRows });
  const boundary = buildBoundary({ source, candidateLane, reviewDocketRows });
  const validationItems = buildValidationItems({
    source,
    candidateLane,
    reviewDocketRows,
    reviewPacketRows,
    reviewHashRegisterRows,
    negativeFixtureRows,
    boundary,
    minimumCandidateCount,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    source_candidate_lane: source.sourceSummary,
    factory_candidate_review_docket_rows: reviewDocketRows,
    factory_candidate_review_packet_rows: reviewPacketRows,
    factory_candidate_review_hash_register_rows: reviewHashRegisterRows,
    factory_candidate_review_negative_fixture_rows: negativeFixtureRows,
    factory_candidate_review_docket_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary: buildSummary({ source, candidateLane, reviewDocketRows, reviewPacketRows, reviewHashRegisterRows, negativeFixtureRows, boundary, validation }),
  };
  return {
    ...result,
    _source_candidate_lane_result: candidateLane,
    _source_proof_result: source.proofResult,
    markdown: renderMarkdown(result),
  };
}

export async function writeFactoryCandidateReviewDocket(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "factory-candidate-review-docket.json"), serializableResult(result));
  await writeJson(path.join(outDir, "review-docket-rows.json"), collectionEnvelope("factory-candidate-review-docket-rows.v1", "factory_candidate_review_docket_rows", result.factory_candidate_review_docket_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-packet-rows.json"), collectionEnvelope("factory-candidate-review-packet-rows.v1", "factory_candidate_review_packet_rows", result.factory_candidate_review_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-hash-register-rows.json"), collectionEnvelope("factory-candidate-review-hash-register-rows.v1", "factory_candidate_review_hash_register_rows", result.factory_candidate_review_hash_register_rows, result.generated_at));
  await writeJson(path.join(outDir, "negative-fixture-rows.json"), collectionEnvelope("factory-candidate-review-negative-fixture-rows.v1", "factory_candidate_review_negative_fixture_rows", result.factory_candidate_review_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "boundary.json"), result.factory_candidate_review_docket_boundary);
  await writeJson(path.join(outDir, "validation-items.json"), collectionEnvelope("factory-candidate-review-docket-validation-items.v1", "validation_items", result.validation_items, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  if (result._source_candidate_lane_result) {
    await writeJson(path.join(outDir, "source-candidate-lane-summary.json"), summarizeSourceCandidateLane(result._source_candidate_lane_result, "embedded"));
  }
  if (result._source_proof_result) {
    await writeJson(path.join(outDir, "source-proof-summary.json"), summarizeSourceProof(result._source_proof_result));
  }
}

export async function runFactoryCandidateReviewDocketCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  try {
    const result = await runFactoryCandidateReviewDocket(args);
    console.log(`Factory Candidate Review Docket validated at ${result.output_dir}`);
    console.log(`Status: ${result.summary.factory_candidate_review_docket_status}`);
    console.log(`Candidate packets: ${result.summary.candidate_packet_count}`);
    console.log(`Review docket rows: ${result.summary.review_docket_row_count}`);
    console.log(`Review hash register rows: ${result.summary.review_hash_register_row_count}`);
    console.log(`Apply enabled: ${result.summary.apply_allowed_now}`);
    console.log(`Validation errors: ${result.validation.errors.length}`);
    return result;
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.item_id}: ${item.message}`);
    process.exitCode = 1;
    return null;
  }
}

async function resolveCandidateLaneSource(options) {
  if (options.sourceCandidateLane) {
    return sourceEnvelope("inline_candidate_lane", options.sourceCandidateLane, null);
  }
  if (options.sourceCandidateLanePath) {
    const candidateLane = JSON.parse(await readFile(path.resolve(options.sourceCandidateLanePath), "utf8"));
    return sourceEnvelope("candidate_lane_json_path", candidateLane, null, path.resolve(options.sourceCandidateLanePath));
  }
  if (options.proofScenario === false) {
    const candidateLane = await buildFactoryCandidateLane({
      ...options,
      outDir: options.candidateLaneOutDir,
      runAt: options.generatedAt,
      write: false,
    });
    return sourceEnvelope("default_candidate_lane", candidateLane, null);
  }
  const proofResult = await buildFactoryCandidateLaneProof({
    ...options,
    outDir: path.join(options.outputDir, "source-proof"),
    runAt: options.generatedAt,
    write: false,
  });
  return sourceEnvelope("fc2_proof_scenario", proofResult._candidate_lane_result, proofResult);
}

function sourceEnvelope(sourceKind, candidateLane, proofResult, sourcePath = null) {
  return {
    sourceKind,
    sourcePath,
    candidateLane,
    proofResult,
    sourceSummary: {
      schema_version: "factory-candidate-review-docket-source.v1",
      source_kind: sourceKind,
      source_path: sourcePath,
      source_proof_status: proofResult?.summary?.factory_candidate_lane_proof_status ?? null,
      source_candidate_lane_status: candidateLane.summary?.factory_candidate_lane_status ?? null,
      source_validation_valid: candidateLane.validation?.valid === true,
      source_validation_error_count: candidateLane.validation?.errors?.length ?? 0,
      candidate_packet_count: candidateLane.summary?.candidate_packet_count ?? 0,
      diff_packet_count: candidateLane.summary?.diff_packet_count ?? 0,
      rollback_plan_count: candidateLane.summary?.rollback_plan_count ?? 0,
      preflight_count: candidateLane.summary?.preflight_count ?? 0,
      hash_ledger_row_count: candidateLane.summary?.hash_ledger_row_count ?? 0,
      patch_apply_enabled: candidateLane.summary?.patch_apply_enabled ?? false,
      apply_allowed_now: candidateLane.summary?.apply_allowed_now ?? false,
    },
  };
}

function buildReviewDocketRows(candidateLane, generatedAt) {
  return candidateLane.factory_candidate_packet_rows.map((packet, index) => {
    const diff = candidateLane.factory_candidate_diff_packet_rows[index];
    const rollback = candidateLane.factory_candidate_rollback_plan_rows[index];
    const preflight = candidateLane.factory_candidate_preflight_rows[index];
    const hashLedger = candidateLane.factory_candidate_hash_ledger_rows[index];
    const draft = {
      schema_version: "factory-candidate-review-docket-row.v1",
      review_docket_id: `factory-candidate-review-docket.${normalizeKey(packet.product_id)}.fc3`,
      candidate_packet_id: packet.candidate_packet_id,
      product_id: packet.product_id,
      review_status: "review_required_not_approved",
      review_decision_allowed_now: false,
      approval_allowed_now: false,
      apply_allowed_now: false,
      independent_review_required_before_apply: true,
      owner_adjudication_required_before_apply: true,
      apply_receipt_required_before_apply: true,
      candidate_packet_sha256: packet.candidate_packet_sha256,
      candidate_manifest_id: packet.candidate_manifest_id,
      candidate_manifest_sha256: packet.candidate_manifest_sha256,
      candidate_hash_bound_to_manifest: packet.candidate_hash_bound_to_manifest,
      diff_packet_id: diff?.diff_packet_id ?? null,
      diff_sha256: diff?.diff_sha256 ?? null,
      diff_applied_now: diff?.diff_applied_now ?? null,
      rollback_plan_id: rollback?.rollback_plan_id ?? null,
      rollback_plan_sha256: rollback?.rollback_plan_sha256 ?? null,
      rollback_executed_now: rollback?.rollback_executed_now ?? null,
      preflight_id: preflight?.preflight_id ?? null,
      preflight_sha256: preflight?.preflight_sha256 ?? null,
      preflight_status: preflight?.preflight_status ?? null,
      preflight_executed_now: preflight?.preflight_executed_now ?? null,
      candidate_hash_ledger_row_id: hashLedger?.ledger_row_id ?? null,
      candidate_hash_ledger_entry_hash: hashLedger?.entry_hash ?? null,
      reviewer_lanes_required: ["human_owner", "independent_reviewer"],
      next_allowed_action: "review_candidate_packet_and_capture_receipt_without_applying",
      source_file_write_allowed_now: false,
      ledger_append_allowed_now: false,
      repo_write_allowed_now: false,
      connector_write_allowed_now: false,
      deployment_allowed_now: false,
      protected_action_allowed_now: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
      generated_at: generatedAt,
    };
    return { ...draft, review_docket_row_sha256: sha256(canonicalize(draft)) };
  });
}

function buildReviewPacketRows(candidateLane, reviewDocketRows, generatedAt) {
  return reviewDocketRows.map((row, index) => {
    const diff = candidateLane.factory_candidate_diff_packet_rows[index];
    const rollback = candidateLane.factory_candidate_rollback_plan_rows[index];
    const preflight = candidateLane.factory_candidate_preflight_rows[index];
    const draft = {
      schema_version: "factory-candidate-review-packet-row.v1",
      review_packet_id: `factory-candidate-review-packet.${normalizeKey(row.product_id)}.fc3`,
      review_docket_id: row.review_docket_id,
      candidate_packet_id: row.candidate_packet_id,
      product_id: row.product_id,
      review_packet_status: "ready_for_review_not_approved",
      diff_ref: {
        diff_packet_id: diff?.diff_packet_id ?? null,
        diff_sha256: diff?.diff_sha256 ?? null,
        diff_kind: diff?.diff_kind ?? null,
        diff_applied_now: diff?.diff_applied_now ?? null,
      },
      rollback_ref: {
        rollback_plan_id: rollback?.rollback_plan_id ?? null,
        rollback_plan_sha256: rollback?.rollback_plan_sha256 ?? null,
        rollback_executed_now: rollback?.rollback_executed_now ?? null,
      },
      preflight_ref: {
        preflight_id: preflight?.preflight_id ?? null,
        preflight_sha256: preflight?.preflight_sha256 ?? null,
        preflight_status: preflight?.preflight_status ?? null,
        preflight_executed_now: preflight?.preflight_executed_now ?? null,
      },
      review_instructions: [
        "inspect diff packet content",
        "verify rollback plan remains draft-only",
        "verify preflight passed",
        "record finding receipt before any apply phase",
      ],
      approval_allowed_now: false,
      apply_allowed_now: false,
      protected_action_allowed_now: false,
      generated_at: generatedAt,
    };
    return { ...draft, review_packet_sha256: sha256(canonicalize(draft)) };
  });
}

function buildReviewHashRegisterRows(reviewDocketRows, reviewPacketRows, generatedAt) {
  let prevEntryHash = null;
  return reviewDocketRows.map((row, index) => {
    const packet = reviewPacketRows[index];
    const draft = {
      schema_version: "factory-candidate-review-hash-register-row.v1",
      register_row_id: `factory-candidate-review-hash-register.${String(index + 1).padStart(4, "0")}`,
      review_docket_id: row.review_docket_id,
      review_packet_id: packet.review_packet_id,
      candidate_packet_id: row.candidate_packet_id,
      product_id: row.product_id,
      candidate_packet_sha256: row.candidate_packet_sha256,
      review_docket_row_sha256: row.review_docket_row_sha256,
      review_packet_sha256: packet.review_packet_sha256,
      prev_entry_hash: prevEntryHash,
      ledger_append_allowed_now: false,
      generated_at: generatedAt,
    };
    const entryHash = sha256(canonicalize(draft));
    prevEntryHash = entryHash;
    return { ...draft, entry_hash: entryHash };
  });
}

function buildNegativeFixtureRows({ generatedAt, reviewDocketRows }) {
  const autoApproval = evaluateAutoApprovalAttempt(reviewDocketRows);
  const applyWithoutReceipt = evaluateApplyWithoutReviewReceiptAttempt(reviewDocketRows);
  const mismatchedHash = evaluateMismatchedCandidateHashAttempt(reviewDocketRows[0]);
  return [
    negativeFixture("negative.auto_approval_attempt", "auto_approve_candidate_packet", autoApproval, generatedAt),
    negativeFixture("negative.apply_without_review_receipt", "apply_candidate_without_review_receipt", applyWithoutReceipt, generatedAt),
    negativeFixture("negative.mismatched_candidate_hash", "bind_review_to_mismatched_candidate_hash", mismatchedHash, generatedAt),
  ];
}

function evaluateAutoApprovalAttempt(reviewDocketRows) {
  const blocked = reviewDocketRows.length > 0 && reviewDocketRows.every((row) => row.approval_allowed_now === false && row.review_status === "review_required_not_approved");
  return {
    guard_executed_now: true,
    observed_outcome: blocked ? "blocked" : "not_blocked",
    blocked_reason_id: blocked ? "candidate_review_docket_never_final_approval" : "candidate_review_docket_approval_opened",
    observed_count: reviewDocketRows.length,
  };
}

function evaluateApplyWithoutReviewReceiptAttempt(reviewDocketRows) {
  const blocked = reviewDocketRows.length > 0 && reviewDocketRows.every((row) => row.apply_allowed_now === false && row.apply_receipt_required_before_apply === true);
  return {
    guard_executed_now: true,
    observed_outcome: blocked ? "blocked" : "not_blocked",
    blocked_reason_id: blocked ? "apply_requires_future_receipt_gate" : "apply_open_without_review_receipt",
    observed_count: reviewDocketRows.length,
  };
}

function evaluateMismatchedCandidateHashAttempt(reviewDocketRow) {
  const attemptedCandidatePacketSha256 = reviewDocketRow ? sha256(`tampered:${reviewDocketRow.candidate_packet_sha256}`) : null;
  const blocked = Boolean(reviewDocketRow) && attemptedCandidatePacketSha256 !== reviewDocketRow.candidate_packet_sha256;
  return {
    guard_executed_now: true,
    observed_outcome: blocked ? "blocked" : "not_blocked",
    blocked_reason_id: blocked ? "candidate_hash_mismatch" : "candidate_hash_mismatch_not_detected",
    expected_candidate_packet_sha256: reviewDocketRow?.candidate_packet_sha256 ?? null,
    attempted_candidate_packet_sha256: attemptedCandidatePacketSha256,
    observed_count: reviewDocketRow ? 1 : 0,
  };
}

function negativeFixture(fixtureId, attemptedAction, evaluation, generatedAt) {
  return {
    schema_version: "factory-candidate-review-negative-fixture-row.v1",
    fixture_id: fixtureId,
    fixture_status: evaluation.guard_executed_now === true && evaluation.observed_outcome === "blocked" ? "passed" : "failed",
    attempted_action: attemptedAction,
    observed_outcome: evaluation.observed_outcome,
    blocked_reason_id: evaluation.blocked_reason_id,
    guard_executed_now: evaluation.guard_executed_now,
    observed_count: evaluation.observed_count,
    expected_candidate_packet_sha256: evaluation.expected_candidate_packet_sha256,
    attempted_candidate_packet_sha256: evaluation.attempted_candidate_packet_sha256,
    approval_allowed_now: false,
    apply_allowed_now: false,
    generated_at: generatedAt,
  };
}

function buildBoundary({ source, candidateLane, reviewDocketRows }) {
  return {
    schema_version: "factory-candidate-review-docket-boundary.v1",
    read_only_factory_boundary: true,
    command_name: COMMAND_NAME,
    program_range: PROGRAM_RANGE,
    source_kind: source.sourceKind,
    source_candidate_lane_valid: candidateLane.validation?.valid === true,
    candidate_packet_count: candidateLane.summary?.candidate_packet_count ?? 0,
    review_docket_row_count: reviewDocketRows.length,
    review_decision_allowed_now: false,
    approval_allowed_now: false,
    apply_allowed_now: false,
    actual_git_worktree_created_now: false,
    source_file_write_allowed_now: false,
    ledger_append_allowed_now: false,
    persistent_ledger_append_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    project_creation_allowed_now: false,
  };
}

function buildValidationItems({ source, candidateLane, reviewDocketRows, reviewPacketRows, reviewHashRegisterRows, negativeFixtureRows, boundary, minimumCandidateCount }) {
  return [
    validationItem("source.valid", "source", source.sourceSummary.source_validation_valid === true, "Source candidate lane must be valid"),
    validationItem("source.candidate_count", "source", candidateLane.factory_candidate_packet_rows.length >= minimumCandidateCount, `Source candidate lane must expose at least ${minimumCandidateCount} candidate packet(s)`),
    validationItem("docket.rows_match_candidates", "review", reviewDocketRows.length === candidateLane.factory_candidate_packet_rows.length, "Review docket row count must match candidate packet count"),
    validationItem("docket.review_required", "review", reviewDocketRows.every((row) => row.review_status === "review_required_not_approved" && row.independent_review_required_before_apply === true && row.owner_adjudication_required_before_apply === true), "Every candidate packet must require review and owner adjudication before apply"),
    validationItem("docket.hash_bound", "review", reviewDocketRows.every((row) => HASH_RE.test(row.review_docket_row_sha256) && HASH_RE.test(row.candidate_packet_sha256) && HASH_RE.test(row.candidate_manifest_sha256) && row.candidate_hash_bound_to_manifest === true && HASH_RE.test(row.diff_sha256) && HASH_RE.test(row.rollback_plan_sha256) && HASH_RE.test(row.preflight_sha256) && HASH_RE.test(row.candidate_hash_ledger_entry_hash)), "Every review docket row must bind packet, manifest, diff, rollback, preflight, and candidate hash-ledger evidence"),
    validationItem("packets.ready_not_approved", "review_packet", reviewPacketRows.length === reviewDocketRows.length && reviewPacketRows.every((row) => row.review_packet_status === "ready_for_review_not_approved" && row.approval_allowed_now === false && row.apply_allowed_now === false && HASH_RE.test(row.review_packet_sha256)), "Review packets must be ready for review but not approved or applicable"),
    validationItem("hash_register.chain", "hash_register", reviewHashRegisterRows.length === reviewDocketRows.length && reviewHashRegisterRows.every((row, index) => HASH_RE.test(row.entry_hash) && (index === 0 ? row.prev_entry_hash === null : row.prev_entry_hash === reviewHashRegisterRows[index - 1].entry_hash)), "Review hash register rows must form a deterministic chain"),
    validationItem("negative.fixtures", "negative", negativeFixtureRows.length === 3 && negativeFixtureRows.every((row) => row.fixture_status === "passed" && row.guard_executed_now === true && row.observed_outcome === "blocked" && row.approval_allowed_now === false && row.apply_allowed_now === false), "Review negative fixtures must execute guards that block approval, apply, and mismatched hash attempts"),
    validationItem("boundary.no_approval_apply", "authority", boundary.review_decision_allowed_now === false && boundary.approval_allowed_now === false && boundary.apply_allowed_now === false, "Candidate review docket must not open review decisions, approval, or apply"),
    validationItem("boundary.no_write_deploy_trust", "authority", boundary.actual_git_worktree_created_now === false && boundary.source_file_write_allowed_now === false && boundary.ledger_append_allowed_now === false && boundary.repo_write_allowed_now === false && boundary.connector_write_allowed_now === false && boundary.deployment_allowed_now === false && boundary.protected_action_allowed_now === false && boundary.production_pass_enabled === false && boundary.enterprise_pass_enabled === false, "Candidate review docket must keep write, deploy, protected action, production, and enterprise trust closed"),
    validationItem("boundary.authority_closed", "authority", allAuthorityClosed(boundary), "All authority flags must remain closed"),
  ];
}

function buildSummary({ source, candidateLane, reviewDocketRows, reviewPacketRows, reviewHashRegisterRows, negativeFixtureRows, boundary, validation }) {
  const ready = validation.valid && allAuthorityClosed(boundary);
  return {
    factory_candidate_review_docket_status: ready ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_kind: source.sourceKind,
    source_candidate_lane_status: candidateLane.summary?.factory_candidate_lane_status ?? null,
    candidate_packet_count: candidateLane.summary?.candidate_packet_count ?? 0,
    review_docket_row_count: reviewDocketRows.length,
    review_packet_row_count: reviewPacketRows.length,
    review_hash_register_row_count: reviewHashRegisterRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    review_decision_allowed_now: false,
    approval_allowed_now: false,
    apply_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    validation_errors: validation.errors.length,
  };
}

function renderMarkdown(result) {
  return [
    "# Factory Candidate Review Docket",
    "",
    `Status: ${result.summary.factory_candidate_review_docket_status}`,
    `Program: ${result.summary.program_range}`,
    `Source: ${result.summary.source_kind}`,
    `Candidate packets: ${result.summary.candidate_packet_count}`,
    `Review docket rows: ${result.summary.review_docket_row_count}`,
    `Review packets: ${result.summary.review_packet_row_count}`,
    `Review hash register rows: ${result.summary.review_hash_register_row_count}`,
    `Approval allowed: ${result.summary.approval_allowed_now}`,
    `Apply allowed: ${result.summary.apply_allowed_now}`,
    `Validation errors: ${result.summary.validation_errors}`,
    "",
  ].join("\n");
}

function summarizeSourceCandidateLane(candidateLane, sourceKind) {
  return {
    schema_version: "factory-candidate-review-docket-source-candidate-lane-summary.v1",
    source_kind: sourceKind,
    command_name: candidateLane.command_name,
    program_range: candidateLane.program_range,
    validation_valid: candidateLane.validation.valid,
    validation_error_count: candidateLane.validation.errors.length,
    candidate_packet_count: candidateLane.summary.candidate_packet_count,
    diff_packet_count: candidateLane.summary.diff_packet_count,
    rollback_plan_count: candidateLane.summary.rollback_plan_count,
    preflight_count: candidateLane.summary.preflight_count,
    hash_ledger_row_count: candidateLane.summary.hash_ledger_row_count,
    patch_apply_enabled: candidateLane.summary.patch_apply_enabled,
    apply_allowed_now: candidateLane.summary.apply_allowed_now,
  };
}

function summarizeSourceProof(proofResult) {
  return {
    schema_version: "factory-candidate-review-docket-source-proof-summary.v1",
    command_name: proofResult.command_name,
    program_range: proofResult.program_range,
    validation_valid: proofResult.validation.valid,
    validation_error_count: proofResult.validation.errors.length,
    proof_product_count: proofResult.summary.proof_product_count,
    candidate_packet_count: proofResult.summary.candidate_packet_count,
    temp_ledger_cleaned_up: proofResult.summary.temp_ledger_cleaned_up,
  };
}

function validationItem(itemId, category, pass, message) {
  return {
    schema_version: "factory-candidate-review-docket-validation-item.v1",
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

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection, count: items.length, items };
}

function serializableResult(result) {
  const {
    markdown: _markdown,
    _source_candidate_lane_result: _sourceCandidateLaneResult,
    _source_proof_result: _sourceProofResult,
    ...rest
  } = result;
  return rest;
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function canonicalize(value) {
  return JSON.stringify(sortObject(value));
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortObject(item)]));
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : canonicalize(value)).digest("hex");
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") parsed.check = true;
    else if (arg === "--require-pass") parsed.requirePass = true;
    else if (arg === "--write") parsed.write = true;
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--no-proof-scenario") parsed.proofScenario = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--source-candidate-lane") parsed.sourceCandidateLanePath = argv[++index];
    else if (arg === "--minimum-candidate-count") parsed.minimumCandidateCount = Number(argv[++index]);
    else if (arg === "--repo-path") parsed.repoPath = argv[++index];
    else if (arg === "--worktree-root") parsed.worktreeRoot = argv[++index];
    else if (arg === "--factory-seed-dir" || arg === "--seed-dir") parsed.factorySeedDir = argv[++index];
    else if (arg === "--template-root") parsed.templateRoot = argv[++index];
    else if (arg === "--pack-root") parsed.packRoot = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: npm run factory:candidate-review-docket -- [--check] [--require-pass] [--out-dir DIR]

Builds the FC.3 candidate review docket from the FC.2 proof scenario by default.
It binds candidate packet, diff, rollback, preflight, and review hashes for
human/independent review while keeping approval and apply closed.

Options:
  --check                    Fail when validation has errors.
  --require-pass             Require ready_factory_candidate_review_docket status.
  --no-write                 Build in memory only.
  --no-proof-scenario        Use the default candidate lane source instead of FC.2 proof.
  --source-candidate-lane P  Read candidate lane JSON from a path.
  --minimum-candidate-count N
  --out-dir DIR              Output directory.
  --repo-path DIR            Repository root used for source candidate metadata.
  --worktree-root DIR        Isolated worktree root used by the source proof.
  --factory-seed-dir DIR
  --template-root DIR
  --pack-root DIR
  --run-at ISO_DATE          Deterministic timestamp for tests.
`);
}
