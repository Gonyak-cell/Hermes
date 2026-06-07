import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildTrustDebtRecalibration } from "../src/trust-debt-recalibration.mjs";

const RUN_AT = "2026-06-07T00:00:00.000Z";

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

test("Trust Debt Recalibration creates a valid BLOCK when review and validation receipts are explicitly absent", async () => {
  const result = await buildTrustDebtRecalibration({
    runAt: RUN_AT,
    write: false,
    reviewReceipt: null,
    validationReceipt: null,
  });

  assert.equal(result.schema_version, "trust-debt-recalibration.v1");
  assert.equal(result.program_range, "P18801-P19200");
  assert.equal(result.source_program_range, "P18401-P18800");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.source_p18800_ready_for_p18801_handoff, true);
  assert.equal(result.summary.trust_recalibration_status, "valid_block_receipts_pending");
  assert.equal(result.summary.closed_debt_credit_count, 5);
  assert.equal(result.summary.remaining_trust_debt_count, 6);
  assert.equal(result.summary.review_receipt_present_now, false);
  assert.equal(result.summary.validation_receipt_present_now, false);
  assert.equal(result.summary.ready_for_p19201_handoff, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.review_evidence_recheck_rows.find((row) => row.row_id === "review_recheck.missing_review_blocker_visible").current_verdict, "pass");
  assert.equal(result.validation_freshness_recheck_rows.find((row) => row.row_id === "validation_recheck.missing_validation_blocker_visible").current_verdict, "pass");
});

test("Trust Debt Recalibration opens P19201 handoff only when review and validation evidence pass", async () => {
  const result = await buildTrustDebtRecalibration({
    runAt: RUN_AT,
    write: false,
    reviewReceipt: REVIEW_RECEIPT,
    validationReceipt: VALIDATION_RECEIPT,
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.review_receipt_present_now, true);
  assert.equal(result.summary.validation_receipt_present_now, true);
  assert.equal(result.trust_recalibration_boundary.review_evidence_passed_now, true);
  assert.equal(result.trust_recalibration_boundary.validation_evidence_passed_now, true);
  assert.equal(result.summary.trust_recalibration_status, "ready_for_trust_debt_recalibration");
  assert.equal(result.summary.ready_for_p19201_handoff, true);
});

test("Trust Debt Recalibration refuses empty or blocking Claude review receipts", async () => {
  const emptyReview = await buildTrustDebtRecalibration({
    runAt: RUN_AT,
    write: false,
    reviewReceipt: {},
    validationReceipt: VALIDATION_RECEIPT,
  });
  assert.equal(emptyReview.validation.valid, true);
  assert.equal(emptyReview.trust_recalibration_boundary.review_evidence_passed_now, false);
  assert.equal(emptyReview.summary.ready_for_p19201_handoff, false);
  assert.equal(emptyReview.review_evidence_recheck_rows.find((row) => row.row_id === "review_recheck.claude_review_shape").current_verdict, "blocked");

  const failedReview = await buildTrustDebtRecalibration({
    runAt: RUN_AT,
    write: false,
    reviewReceipt: { ...REVIEW_RECEIPT, overall_verdict: "BLOCK" },
    validationReceipt: VALIDATION_RECEIPT,
  });
  assert.equal(failedReview.validation.valid, true);
  assert.equal(failedReview.trust_recalibration_boundary.review_evidence_passed_now, false);
  assert.equal(failedReview.summary.ready_for_p19201_handoff, false);
  assert.equal(failedReview.review_evidence_recheck_rows.find((row) => row.row_id === "review_recheck.claude_review_verdict").current_verdict, "blocked");
});

test("Trust Debt Recalibration preserves protected authority boundaries", async () => {
  const result = await buildTrustDebtRecalibration({
    runAt: RUN_AT,
    write: false,
    reviewReceipt: REVIEW_RECEIPT,
    validationReceipt: VALIDATION_RECEIPT,
  });
  const protectedFalseFlags = [
    "deployment_allowed_now",
    "release_approval_allowed_now",
    "production_pass_enabled",
    "enterprise_pass_enabled",
    "enterprise_trust_claim_allowed_now",
    "protected_closeout_enabled",
    "human_gate_bypass_allowed_now",
    "independent_review_bypass_allowed_now",
    "single_owner_enterprise_trust_allowed_now",
    "runtime_execution_allowed_now",
    "write_action_allowed_now",
    "protected_action_allowed_now",
    "connector_write_enabled",
    "external_service_mutation_allowed_now",
    "raw_source_exposure_allowed",
    "secret_read_allowed_now",
    "reviewer_mutation_allowed_now",
    "final_automated_approval_allowed",
  ];

  for (const flag of protectedFalseFlags) {
    assert.equal(result.trust_recalibration_boundary[flag], false, flag);
  }
  assert.equal(result.authority_boundary_recheck_rows.length, protectedFalseFlags.length);
  assert.equal(result.remaining_trust_debt_rows.every((row) => row.debt_status === "carried_forward"), true);
});

test("Trust Debt Recalibration --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hermes-trust-debt-recalibration-"));
  try {
    const sentinelPath = path.join(root, "trust-debt-recalibration.json");
    const sentinel = '{ "sentinel": "trust-debt-recalibration" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/trust-debt-recalibration.mjs",
      "--check",
      "--out-dir",
      root,
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
