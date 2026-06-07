import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPostHandoffTrustIntake } from "../src/post-handoff-trust-intake.mjs";
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

async function readyP19200(overrides = {}) {
  return buildTrustDebtRecalibration({
    runAt: overrides.runAt ?? RUN_AT,
    write: false,
    reviewReceipt: overrides.reviewReceipt ?? REVIEW_RECEIPT,
    validationReceipt: overrides.validationReceipt ?? VALIDATION_RECEIPT,
  });
}

test("Post-Handoff Trust Intake opens P19601 only when P19200 handoff, receipts, freshness, and commit ref pass", async () => {
  const source = await readyP19200();
  const result = await buildPostHandoffTrustIntake({
    runAt: RUN_AT,
    write: false,
    trustDebtRecalibration: source,
    commitRef: "cf9a76e",
  });

  assert.equal(result.schema_version, "post-handoff-trust-intake.v1");
  assert.equal(result.program_range, "P19201-P19600");
  assert.equal(result.source_program_range, "P18801-P19200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_handoff_trust_status, "ready_for_post_handoff_trust_intake");
  assert.equal(result.summary.source_p19200_ready_for_p19201_handoff, true);
  assert.equal(result.summary.handoff_receipts_passed_now, true);
  assert.equal(result.summary.evidence_freshness_passed_now, true);
  assert.equal(result.summary.source_commit_ref_present_now, true);
  assert.equal(result.summary.ready_for_p19601_handoff, true);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Post-Handoff Trust Intake keeps stale source as valid BLOCK with freshness blocker", async () => {
  const source = await readyP19200({ runAt: "2026-05-01T00:00:00.000Z" });
  const result = await buildPostHandoffTrustIntake({
    runAt: RUN_AT,
    write: false,
    trustDebtRecalibration: source,
    commitRef: "cf9a76e",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_handoff_trust_status, "valid_block_handoff_pending");
  assert.equal(result.summary.evidence_freshness_passed_now, false);
  assert.equal(result.summary.ready_for_p19601_handoff, false);
  assert.equal(result.evidence_freshness_window_rows.find((row) => row.row_id === "freshness_window.source_within_freshness_window").current_verdict, "blocked");
  assert.equal(result.evidence_freshness_window_rows.find((row) => row.row_id === "freshness_window.freshness_blocker_visible").current_verdict, "pass");
});

test("Post-Handoff Trust Intake preserves visible blockers when P19200 receipts are absent", async () => {
  const source = await buildTrustDebtRecalibration({
    runAt: RUN_AT,
    write: false,
    reviewReceipt: null,
    validationReceipt: null,
  });
  const result = await buildPostHandoffTrustIntake({
    runAt: RUN_AT,
    write: false,
    trustDebtRecalibration: source,
    commitRef: "cf9a76e",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_handoff_trust_status, "valid_block_handoff_pending");
  assert.equal(result.summary.source_p19200_ready_for_p19201_handoff, false);
  assert.equal(result.summary.handoff_receipts_passed_now, false);
  assert.equal(result.summary.ready_for_p19601_handoff, false);
  assert.equal(result.handoff_receipt_materialization_rows.find((row) => row.row_id === "receipt_materialization.receipt_blocker_visible").current_verdict, "pass");
});

test("Post-Handoff Trust Intake preserves protected authority boundaries and carried-forward debt", async () => {
  const source = await readyP19200();
  const result = await buildPostHandoffTrustIntake({
    runAt: RUN_AT,
    write: false,
    trustDebtRecalibration: source,
    commitRef: "cf9a76e",
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
    assert.equal(result.post_handoff_trust_boundary[flag], false, flag);
  }
  assert.equal(result.authority_boundary_continuation_rows.length, protectedFalseFlags.length);
  assert.equal(result.trust_carry_forward_rows.every((row) => row.debt_status === "carried_forward"), true);
});

test("Post-Handoff Trust Intake --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hermes-post-handoff-trust-intake-"));
  try {
    const sentinelPath = path.join(root, "post-handoff-trust-intake.json");
    const sentinel = '{ "sentinel": "post-handoff-trust-intake" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/post-handoff-trust-intake.mjs",
      "--check",
      "--out-dir",
      root,
      "--commit-ref",
      "cf9a76e",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
