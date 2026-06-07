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
import { buildValidationReceiptCompletionReconciliation } from "../src/validation-receipt-completion-reconciliation.mjs";
import { buildValidationRunbookReadiness } from "../src/validation-runbook-readiness.mjs";

const RUN_AT = "2026-06-07T00:00:00.000Z";
const COMMIT_REF = "56fec2f";

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

async function readyP22000() {
  const p21600 = await readyP21600();
  return buildValidationReceiptCandidateQueue({
    runAt: RUN_AT,
    write: false,
    validationEvidenceReceiptIntake: p21600,
    commitRef: COMMIT_REF,
  });
}

async function blockedP22000() {
  const p21600 = await blockedP21600();
  return buildValidationReceiptCandidateQueue({
    runAt: RUN_AT,
    write: false,
    validationEvidenceReceiptIntake: p21600,
    commitRef: COMMIT_REF,
  });
}

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

test("Validation Receipt Completion Reconciliation opens P22401 when P22000 source is ready", async () => {
  const source = await readyP22000();
  const result = await buildValidationReceiptCompletionReconciliation({
    runAt: RUN_AT,
    write: false,
    validationReceiptCandidateQueue: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.schema_version, "validation-receipt-completion-reconciliation.v1");
  assert.equal(result.program_range, "P22001-P22400");
  assert.equal(result.source_program_range, "P21601-P22000");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.validation_receipt_completion_reconciliation_status, "ready_for_validation_receipt_completion_reconciliation");
  assert.equal(result.summary.source_p22000_ready_for_p22001_handoff, true);
  assert.equal(result.summary.completion_item_count, 7);
  assert.equal(result.summary.completion_gap_count, 7);
  assert.equal(result.summary.completion_claimed_count, 0);
  assert.equal(result.summary.completion_accepted_count, 0);
  assert.equal(result.summary.ready_for_p22401_handoff, true);
  assert.equal(result.summary.receipt_completion_claim_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Validation Receipt Completion Reconciliation keeps blocked P22000 as valid BLOCK with visible blockers", async () => {
  const source = await blockedP22000();
  const result = await buildValidationReceiptCompletionReconciliation({
    runAt: RUN_AT,
    write: false,
    validationReceiptCandidateQueue: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.validation_receipt_completion_reconciliation_status, "valid_block_validation_receipt_completion_reconciliation_pending");
  assert.equal(result.summary.source_p22000_ready_for_p22001_handoff, false);
  assert.equal(result.summary.ready_for_p22401_handoff, false);
  assert.equal(result.operator_completion_index_rows.find((row) => row.row_id === "operator_completion.blocker_visibility").current_verdict, "pass");
  assert.equal(result.p22400_clean_checkpoint_rows.find((row) => row.row_id === "p22400_checkpoint.p22401_handoff_blocker_visible").current_verdict, "pass");
});

test("Validation Receipt Completion Reconciliation keeps gaps separate from completion", async () => {
  const source = await readyP22000();
  const result = await buildValidationReceiptCompletionReconciliation({
    runAt: RUN_AT,
    write: false,
    validationReceiptCandidateQueue: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.receipt_completion_gap_ledger_rows.every((row) => row.completion_gap_visible_now === true), true);
  assert.equal(result.receipt_completion_gap_ledger_rows.every((row) => row.completion_claimed_now === false), true);
  assert.equal(result.receipt_completion_gap_ledger_rows.every((row) => row.completion_accepted_now === false), true);
  assert.equal(result.acceptance_reconciliation_rows.every((row) => row.reconciliation_complete_now === false), true);
  assert.equal(result.acceptance_reconciliation_rows.every((row) => row.final_authority_granted_now === false), true);
  assert.equal(result.operator_completion_index_rows.filter((row) => row.completion_state === "completion_gap_visible").length, 7);
});

test("Validation Receipt Completion Reconciliation keeps raw capture and completion finality closed", async () => {
  const source = await readyP22000();
  const result = await buildValidationReceiptCompletionReconciliation({
    runAt: RUN_AT,
    write: false,
    validationReceiptCandidateQueue: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.digest_integrity_guard_rows.every((row) => row.raw_stdout_allowed_now === false), true);
  assert.equal(result.digest_integrity_guard_rows.every((row) => row.raw_stderr_allowed_now === false), true);
  assert.equal(result.digest_integrity_guard_rows.every((row) => row.full_transcript_allowed_now === false), true);
  assert.equal(result.validation_receipt_completion_reconciliation_boundary.receipt_completion_claim_allowed_now, false);
  assert.equal(result.validation_receipt_completion_reconciliation_boundary.receipt_completion_accepted_now, false);
  assert.equal(result.validation_receipt_completion_reconciliation_boundary.completion_reconciliation_final_now, false);
  assert.equal(result.validation_receipt_completion_reconciliation_boundary.operator_completion_apply_allowed_now, false);
  assert.equal(result.validation_receipt_completion_reconciliation_boundary.final_automated_approval_allowed, false);
});

test("Validation Receipt Completion Reconciliation --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hermes-validation-receipt-completion-reconciliation-"));
  try {
    const sentinelPath = path.join(root, "validation-receipt-completion-reconciliation.json");
    const sentinel = '{ "sentinel": "validation-receipt-completion-reconciliation" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/validation-receipt-completion-reconciliation.mjs",
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
