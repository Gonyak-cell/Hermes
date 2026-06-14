import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPostHandoffTrustIntake } from "../src/post-handoff-trust-intake.mjs";
import { buildPostP20000OperatorHandoff } from "../src/post-p20000-operator-handoff.mjs";
import { buildPostP20400LaunchEnvelope } from "../src/post-p20400-launch-envelope.mjs";
import { buildTrustDebtRecalibration } from "../src/trust-debt-recalibration.mjs";
import { buildTrustEvidenceCleanCheckpoint } from "../src/trust-evidence-clean-checkpoint.mjs";
import { buildValidationEvidenceReceiptIntake } from "../src/validation-evidence-receipt-intake.mjs";
import { buildValidationReceiptCandidateQueue } from "../src/validation-receipt-candidate-queue.mjs";
import { buildValidationRunbookReadiness } from "../src/validation-runbook-readiness.mjs";

const RUN_AT = "2026-06-07T00:00:00.000Z";
const COMMIT_REF = "3889206";

const REVIEW_RECEIPT = {
  schema_version: "claude-review-receipt.v1",
  reviewer: "claude-code-opus-max",
  overall_verdict: "PASS_WITH_FINDINGS",
  open_blocking_finding_count: 0,
  blocks_clean_checkpoint: false,
  findings: [],
};

const VALIDATION_RECEIPT = {
  schema_version: "full-suite-validation-receipt.v1",
  targeted_validation_passed: true,
  adjacent_validation_passed: true,
  full_npm_test_passed: true,
  git_diff_check_passed: true,
};

async function readyP21600() {
  const p21200 = await readyP21200();
  return buildValidationEvidenceReceiptIntake({
    runAt: RUN_AT,
    write: false,
    validationRunbookReadiness: p21200,
    commitRef: COMMIT_REF,
  });
}

async function blockedP21600() {
  const p21200 = await blockedP21200();
  return buildValidationEvidenceReceiptIntake({
    runAt: RUN_AT,
    write: false,
    validationRunbookReadiness: p21200,
    commitRef: COMMIT_REF,
  });
}

async function readyP21200() {
  const p20800 = await readyP20800();
  return buildValidationRunbookReadiness({
    runAt: RUN_AT,
    write: false,
    postP20400LaunchEnvelope: p20800,
    commitRef: COMMIT_REF,
  });
}

async function blockedP21200() {
  const p20800 = await blockedP20800();
  return buildValidationRunbookReadiness({
    runAt: RUN_AT,
    write: false,
    postP20400LaunchEnvelope: p20800,
    commitRef: COMMIT_REF,
  });
}

async function readyP20800() {
  const p19200 = await buildTrustDebtRecalibration({
    runAt: RUN_AT,
    write: false,
    reviewReceipt: REVIEW_RECEIPT,
    validationReceipt: VALIDATION_RECEIPT,
  });
  const p19600 = await buildPostHandoffTrustIntake({
    runAt: RUN_AT,
    write: false,
    trustDebtRecalibration: p19200,
    commitRef: COMMIT_REF,
  });
  const p20000 = await buildTrustEvidenceCleanCheckpoint({
    runAt: RUN_AT,
    write: false,
    postHandoffTrustIntake: p19600,
    commitRef: COMMIT_REF,
  });
  const p20400 = await buildPostP20000OperatorHandoff({
    runAt: RUN_AT,
    write: false,
    trustEvidenceCleanCheckpoint: p20000,
    commitRef: COMMIT_REF,
  });
  return buildPostP20400LaunchEnvelope({
    runAt: RUN_AT,
    write: false,
    postP20000OperatorHandoff: p20400,
    commitRef: COMMIT_REF,
  });
}

async function blockedP20800() {
  const p19200 = await buildTrustDebtRecalibration({
    runAt: RUN_AT,
    write: false,
    reviewReceipt: null,
    validationReceipt: null,
  });
  const p19600 = await buildPostHandoffTrustIntake({
    runAt: RUN_AT,
    write: false,
    trustDebtRecalibration: p19200,
    commitRef: COMMIT_REF,
  });
  const p20000 = await buildTrustEvidenceCleanCheckpoint({
    runAt: RUN_AT,
    write: false,
    postHandoffTrustIntake: p19600,
    commitRef: COMMIT_REF,
  });
  const p20400 = await buildPostP20000OperatorHandoff({
    runAt: RUN_AT,
    write: false,
    trustEvidenceCleanCheckpoint: p20000,
    commitRef: COMMIT_REF,
  });
  return buildPostP20400LaunchEnvelope({
    runAt: RUN_AT,
    write: false,
    postP20000OperatorHandoff: p20400,
    commitRef: COMMIT_REF,
  });
}

test("Validation Receipt Candidate Queue opens P22001 when P21600 source is ready", async () => {
  const source = await readyP21600();
  const result = await buildValidationReceiptCandidateQueue({
    runAt: RUN_AT,
    write: false,
    validationEvidenceReceiptIntake: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.schema_version, "validation-receipt-candidate-queue.v1");
  assert.equal(result.program_range, "P21601-P22000");
  assert.equal(result.source_program_range, "P21201-P21600");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.validation_receipt_candidate_queue_status, "ready_for_validation_receipt_candidate_queue");
  assert.equal(result.summary.source_p21600_ready_for_p21601_handoff, true);
  assert.equal(result.summary.candidate_slot_count, 7);
  assert.equal(result.summary.candidate_present_count, 0);
  assert.equal(result.summary.accepted_candidate_count, 0);
  assert.equal(result.summary.missing_candidate_count, 7);
  assert.equal(result.summary.ready_for_p22001_handoff, true);
  assert.equal(result.summary.final_automated_approval_allowed, false);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Validation Receipt Candidate Queue keeps blocked P21600 as valid BLOCK with visible blockers", async () => {
  const source = await blockedP21600();
  const result = await buildValidationReceiptCandidateQueue({
    runAt: RUN_AT,
    write: false,
    validationEvidenceReceiptIntake: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.validation_receipt_candidate_queue_status, "valid_block_validation_receipt_candidate_queue_pending");
  assert.equal(result.summary.source_p21600_ready_for_p21601_handoff, false);
  assert.equal(result.summary.ready_for_p22001_handoff, false);
  assert.equal(result.operator_verification_index_rows.find((row) => row.row_id === "operator_verification.blocker_visibility").current_verdict, "pass");
  assert.equal(result.p22000_clean_checkpoint_rows.find((row) => row.row_id === "p22000_checkpoint.p22001_handoff_blocker_visible").current_verdict, "pass");
});

test("Validation Receipt Candidate Queue separates missing candidates from acceptance", async () => {
  const source = await readyP21600();
  const result = await buildValidationReceiptCandidateQueue({
    runAt: RUN_AT,
    write: false,
    validationEvidenceReceiptIntake: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.receipt_candidate_metadata_rows.every((row) => row.candidate_slot_visible_now === true), true);
  assert.equal(result.receipt_candidate_metadata_rows.every((row) => row.candidate_present_now === false), true);
  assert.equal(result.receipt_candidate_metadata_rows.every((row) => row.candidate_state === "candidate_missing_visible"), true);
  assert.equal(result.acceptance_decision_matrix_rows.every((row) => row.accepted_now === false), true);
  assert.equal(result.acceptance_decision_matrix_rows.every((row) => row.final_authority_granted_now === false), true);
  assert.equal(result.operator_verification_index_rows.filter((row) => row.verification_state === "candidate_missing_visible").length, 7);
});

test("Validation Receipt Candidate Queue keeps digest raw capture and finality closed", async () => {
  const source = await readyP21600();
  const result = await buildValidationReceiptCandidateQueue({
    runAt: RUN_AT,
    write: false,
    validationEvidenceReceiptIntake: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.result_digest_redaction_index_rows.every((row) => row.raw_stdout_allowed_now === false), true);
  assert.equal(result.result_digest_redaction_index_rows.every((row) => row.raw_stderr_allowed_now === false), true);
  assert.equal(result.result_digest_redaction_index_rows.every((row) => row.full_transcript_allowed_now === false), true);
  assert.equal(result.validation_receipt_candidate_queue_boundary.receipt_completion_claim_allowed_now, false);
  assert.equal(result.validation_receipt_candidate_queue_boundary.receipt_candidate_auto_accept_allowed_now, false);
  assert.equal(result.validation_receipt_candidate_queue_boundary.verifier_finality_allowed_now, false);
  assert.equal(result.validation_receipt_candidate_queue_boundary.operator_merge_allowed_now, false);
  assert.equal(result.validation_receipt_candidate_queue_boundary.final_automated_approval_allowed, false);
});

test("Validation Receipt Candidate Queue --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hermes-validation-receipt-candidate-queue-"));
  try {
    const sentinelPath = path.join(root, "validation-receipt-candidate-queue.json");
    const sentinel = '{ "sentinel": "validation-receipt-candidate-queue" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/validation-receipt-candidate-queue.mjs",
      "--check",
      "--out-dir",
      root,
      "--commit-ref",
      COMMIT_REF,
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
