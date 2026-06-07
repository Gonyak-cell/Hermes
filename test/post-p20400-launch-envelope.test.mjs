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

async function readyP20400() {
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
    commitRef: "3aa25a6",
  });
  const p20000 = await buildTrustEvidenceCleanCheckpoint({
    runAt: RUN_AT,
    write: false,
    postHandoffTrustIntake: p19600,
    commitRef: "3aa25a6",
  });
  return buildPostP20000OperatorHandoff({
    runAt: RUN_AT,
    write: false,
    trustEvidenceCleanCheckpoint: p20000,
    commitRef: "3aa25a6",
  });
}

async function blockedP20400() {
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
    commitRef: "3aa25a6",
  });
  const p20000 = await buildTrustEvidenceCleanCheckpoint({
    runAt: RUN_AT,
    write: false,
    postHandoffTrustIntake: p19600,
    commitRef: "3aa25a6",
  });
  return buildPostP20000OperatorHandoff({
    runAt: RUN_AT,
    write: false,
    trustEvidenceCleanCheckpoint: p20000,
    commitRef: "3aa25a6",
  });
}

test("Post-P20400 Launch Envelope opens P20801 when P20400 source is ready", async () => {
  const source = await readyP20400();
  const result = await buildPostP20400LaunchEnvelope({
    runAt: RUN_AT,
    write: false,
    postP20000OperatorHandoff: source,
    commitRef: "3aa25a6",
  });

  assert.equal(result.schema_version, "post-p20400-launch-envelope.v1");
  assert.equal(result.program_range, "P20401-P20800");
  assert.equal(result.source_program_range, "P20001-P20400");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p20400_launch_envelope_status, "ready_for_post_p20400_launch_envelope");
  assert.equal(result.summary.source_p20400_ready_for_p20401_handoff, true);
  assert.equal(result.summary.handoff_consumption_queue_count, 8);
  assert.equal(result.summary.allowed_action_count, 4);
  assert.equal(result.summary.blocked_protected_action_count, 4);
  assert.equal(result.summary.ready_for_p20801_handoff, true);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Post-P20400 Launch Envelope keeps blocked P20400 as valid BLOCK with visible blockers", async () => {
  const source = await blockedP20400();
  const result = await buildPostP20400LaunchEnvelope({
    runAt: RUN_AT,
    write: false,
    postP20000OperatorHandoff: source,
    commitRef: "3aa25a6",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p20400_launch_envelope_status, "valid_block_launch_envelope_pending");
  assert.equal(result.summary.source_p20400_ready_for_p20401_handoff, false);
  assert.equal(result.summary.ready_for_p20801_handoff, false);
  assert.equal(result.handoff_consumption_queue_rows.find((row) => row.row_id === "handoff_queue.blocker_visibility").current_verdict, "pass");
  assert.equal(result.p20800_launch_checkpoint_rows.find((row) => row.row_id === "p20800_checkpoint.p20801_handoff_blocker_visible").current_verdict, "pass");
});

test("Post-P20400 Launch Envelope separates allowed validation from protected actions", async () => {
  const source = await readyP20400();
  const result = await buildPostP20400LaunchEnvelope({
    runAt: RUN_AT,
    write: false,
    postP20000OperatorHandoff: source,
    commitRef: "3aa25a6",
  });

  assert.equal(result.action_eligibility_matrix_rows.filter((row) => row.allowed_now === true).length, 4);
  assert.equal(result.action_eligibility_matrix_rows.filter((row) => row.eligibility === "blocked_protected").every((row) => row.allowed_now === false), true);
  assert.equal(result.post_p20400_launch_envelope_boundary.write_action_allowed_now, false);
  assert.equal(result.post_p20400_launch_envelope_boundary.runtime_execution_allowed_now, false);
});

test("Post-P20400 Launch Envelope preserves review cadence boundaries", async () => {
  const source = await readyP20400();
  const result = await buildPostP20400LaunchEnvelope({
    runAt: RUN_AT,
    write: false,
    postP20000OperatorHandoff: source,
    commitRef: "3aa25a6",
  });

  assert.equal(result.review_cadence_router_rows.find((row) => row.row_id === "review_cadence.routine_read_only_projection").review_required_now, false);
  assert.equal(result.review_cadence_router_rows.find((row) => row.row_id === "review_cadence.authority_transition").review_required_when_triggered, true);
  assert.equal(result.review_cadence_router_rows.find((row) => row.row_id === "review_cadence.review_not_final_approval").requirement_mode, "never_final_approval");
});

test("Post-P20400 Launch Envelope --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hermes-post-p20400-launch-envelope-"));
  try {
    const sentinelPath = path.join(root, "post-p20400-launch-envelope.json");
    const sentinel = '{ "sentinel": "post-p20400-launch-envelope" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/post-p20400-launch-envelope.mjs",
      "--check",
      "--out-dir",
      root,
      "--commit-ref",
      "3aa25a6",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
