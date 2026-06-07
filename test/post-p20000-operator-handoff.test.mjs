import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPostHandoffTrustIntake } from "../src/post-handoff-trust-intake.mjs";
import { buildPostP20000OperatorHandoff } from "../src/post-p20000-operator-handoff.mjs";
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

async function readyP20000() {
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
    commitRef: "9944216",
  });
  return buildTrustEvidenceCleanCheckpoint({
    runAt: RUN_AT,
    write: false,
    postHandoffTrustIntake: p19600,
    commitRef: "9944216",
  });
}

async function blockedP20000() {
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
    commitRef: "9944216",
  });
  return buildTrustEvidenceCleanCheckpoint({
    runAt: RUN_AT,
    write: false,
    postHandoffTrustIntake: p19600,
    commitRef: "9944216",
  });
}

test("Post-P20000 Operator Handoff opens P20401 when P20000 source is ready", async () => {
  const source = await readyP20000();
  const result = await buildPostP20000OperatorHandoff({
    runAt: RUN_AT,
    write: false,
    trustEvidenceCleanCheckpoint: source,
    commitRef: "9944216",
  });

  assert.equal(result.schema_version, "post-p20000-operator-handoff.v1");
  assert.equal(result.program_range, "P20001-P20400");
  assert.equal(result.source_program_range, "P19601-P20000");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p20000_operator_handoff_status, "ready_for_post_p20000_operator_handoff");
  assert.equal(result.summary.source_p20000_ready_for_p20001_handoff, true);
  assert.equal(result.summary.trust_consumption_map_count, 10);
  assert.equal(result.summary.operator_handoff_packet_count, 7);
  assert.equal(result.summary.verification_consumption_guard_count, 8);
  assert.equal(result.summary.ready_for_p20401_handoff, true);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Post-P20000 Operator Handoff keeps blocked P20000 as valid BLOCK with visible blockers", async () => {
  const source = await blockedP20000();
  const result = await buildPostP20000OperatorHandoff({
    runAt: RUN_AT,
    write: false,
    trustEvidenceCleanCheckpoint: source,
    commitRef: "9944216",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p20000_operator_handoff_status, "valid_block_operator_handoff_pending");
  assert.equal(result.summary.source_p20000_ready_for_p20001_handoff, false);
  assert.equal(result.summary.ready_for_p20401_handoff, false);
  assert.equal(result.trust_consumption_map_rows.find((row) => row.row_id === "trust_consumption.blocker_visibility").current_verdict, "pass");
  assert.equal(result.p20400_clean_checkpoint_rows.find((row) => row.row_id === "p20400_checkpoint.p20401_handoff_blocker_visible").current_verdict, "pass");
});

test("Post-P20000 Operator Handoff preserves verification limits during consumption", async () => {
  const source = await readyP20000();
  const result = await buildPostP20000OperatorHandoff({
    runAt: RUN_AT,
    write: false,
    trustEvidenceCleanCheckpoint: source,
    commitRef: "9944216",
  });

  assert.equal(result.verification_consumption_guard_rows.some((row) => row.consumed_does_not_verify === "enterprise trust"), true);
  assert.equal(result.verification_consumption_guard_rows.some((row) => row.consumed_does_not_verify === "human or independent approval"), true);
  assert.equal(result.verification_consumption_guard_rows.find((row) => row.row_id === "verification_guard.non_finality_preserved").current_verdict, "pass");
});

test("Post-P20000 Operator Handoff preserves protected authority boundaries and review cadence", async () => {
  const source = await readyP20000();
  const result = await buildPostP20000OperatorHandoff({
    runAt: RUN_AT,
    write: false,
    trustEvidenceCleanCheckpoint: source,
    commitRef: "9944216",
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
    assert.equal(result.post_p20000_operator_handoff_boundary[flag], false, flag);
  }
  assert.equal(result.authority_boundary_handoff_rows.length, protectedFalseFlags.length);
  assert.equal(result.boundary_debt_projection_rows.every((row) => row.debt_status === "carried_forward"), true);
  assert.equal(result.regression_adjacent_command_packet_rows.find((row) => row.row_id === "regression_command.claude_review_condition").command_kind, "conditional_review");
});

test("Post-P20000 Operator Handoff --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hermes-post-p20000-operator-handoff-"));
  try {
    const sentinelPath = path.join(root, "post-p20000-operator-handoff.json");
    const sentinel = '{ "sentinel": "post-p20000-operator-handoff" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/post-p20000-operator-handoff.mjs",
      "--check",
      "--out-dir",
      root,
      "--commit-ref",
      "9944216",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
