import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPostHandoffTrustIntake } from "../src/post-handoff-trust-intake.mjs";
import { buildTrustDebtRecalibration } from "../src/trust-debt-recalibration.mjs";
import { buildTrustEvidenceCleanCheckpoint } from "../src/trust-evidence-clean-checkpoint.mjs";

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

async function readyP19600() {
  const p19200 = await buildTrustDebtRecalibration({
    runAt: RUN_AT,
    write: false,
    reviewReceipt: REVIEW_RECEIPT,
    validationReceipt: VALIDATION_RECEIPT,
  });
  return buildPostHandoffTrustIntake({
    runAt: RUN_AT,
    write: false,
    trustDebtRecalibration: p19200,
    commitRef: "9b1d6b8",
  });
}

async function blockedP19600() {
  const p19200 = await buildTrustDebtRecalibration({
    runAt: RUN_AT,
    write: false,
    reviewReceipt: null,
    validationReceipt: null,
  });
  return buildPostHandoffTrustIntake({
    runAt: RUN_AT,
    write: false,
    trustDebtRecalibration: p19200,
    commitRef: "9b1d6b8",
  });
}

test("Trust Evidence Clean Checkpoint opens P20001 when P19600 source and verification matrix pass", async () => {
  const source = await readyP19600();
  const result = await buildTrustEvidenceCleanCheckpoint({
    runAt: RUN_AT,
    write: false,
    postHandoffTrustIntake: source,
    commitRef: "9b1d6b8",
  });

  assert.equal(result.schema_version, "trust-evidence-clean-checkpoint.v1");
  assert.equal(result.program_range, "P19601-P20000");
  assert.equal(result.source_program_range, "P19201-P19600");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trust_evidence_checkpoint_status, "ready_for_trust_evidence_clean_checkpoint");
  assert.equal(result.summary.source_p19600_ready_for_p19601_handoff, true);
  assert.equal(result.summary.trust_evidence_chain_count, 8);
  assert.equal(result.summary.verification_matrix_count, 7);
  assert.equal(result.summary.regression_packet_visible_now, true);
  assert.equal(result.summary.ready_for_p20001_handoff, true);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Trust Evidence Clean Checkpoint keeps blocked P19600 as valid BLOCK with visible blockers", async () => {
  const source = await blockedP19600();
  const result = await buildTrustEvidenceCleanCheckpoint({
    runAt: RUN_AT,
    write: false,
    postHandoffTrustIntake: source,
    commitRef: "9b1d6b8",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trust_evidence_checkpoint_status, "valid_block_checkpoint_pending");
  assert.equal(result.summary.source_p19600_ready_for_p19601_handoff, false);
  assert.equal(result.summary.ready_for_p20001_handoff, false);
  assert.equal(result.verification_of_verification_rows.find((row) => row.row_id === "verification_matrix.blocker_visibility_validation").current_verdict, "pass");
  assert.equal(result.p20000_clean_checkpoint_rows.find((row) => row.row_id === "p20000_checkpoint.p20001_handoff_blocker_visible").current_verdict, "pass");
});

test("Trust Evidence Clean Checkpoint separates what validators do not verify", async () => {
  const source = await readyP19600();
  const result = await buildTrustEvidenceCleanCheckpoint({
    runAt: RUN_AT,
    write: false,
    postHandoffTrustIntake: source,
    commitRef: "9b1d6b8",
  });

  const nonFinality = result.verification_of_verification_rows.find((row) => row.row_id === "verification_matrix.non_finality_validation");
  assert.equal(nonFinality.current_verdict, "pass");
  assert.equal(nonFinality.does_not_verify, "human or independent approval");
  assert.equal(result.verification_of_verification_rows.some((row) => row.does_not_verify === "enterprise trust"), true);
});

test("Trust Evidence Clean Checkpoint preserves protected authority boundaries and command packet", async () => {
  const source = await readyP19600();
  const result = await buildTrustEvidenceCleanCheckpoint({
    runAt: RUN_AT,
    write: false,
    postHandoffTrustIntake: source,
    commitRef: "9b1d6b8",
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
    assert.equal(result.trust_evidence_clean_checkpoint_boundary[flag], false, flag);
  }
  assert.equal(result.authority_boundary_checkpoint_rows.length, protectedFalseFlags.length);
  assert.equal(result.remaining_authority_debt_rows.every((row) => row.debt_status === "carried_forward"), true);
  assert.equal(result.regression_command_packet_rows.find((row) => row.row_id === "regression_command.full_npm_test_condition").command_kind, "conditional_full_suite");
});

test("Trust Evidence Clean Checkpoint --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hermes-trust-evidence-clean-checkpoint-"));
  try {
    const sentinelPath = path.join(root, "trust-evidence-clean-checkpoint.json");
    const sentinel = '{ "sentinel": "trust-evidence-clean-checkpoint" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/trust-evidence-clean-checkpoint.mjs",
      "--check",
      "--out-dir",
      root,
      "--commit-ref",
      "9b1d6b8",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
