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
import { buildValidationRunbookReadiness } from "../src/validation-runbook-readiness.mjs";

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
    commitRef: "082f3c1",
  });
  const p20000 = await buildTrustEvidenceCleanCheckpoint({
    runAt: RUN_AT,
    write: false,
    postHandoffTrustIntake: p19600,
    commitRef: "082f3c1",
  });
  const p20400 = await buildPostP20000OperatorHandoff({
    runAt: RUN_AT,
    write: false,
    trustEvidenceCleanCheckpoint: p20000,
    commitRef: "082f3c1",
  });
  return buildPostP20400LaunchEnvelope({
    runAt: RUN_AT,
    write: false,
    postP20000OperatorHandoff: p20400,
    commitRef: "082f3c1",
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
    commitRef: "082f3c1",
  });
  const p20000 = await buildTrustEvidenceCleanCheckpoint({
    runAt: RUN_AT,
    write: false,
    postHandoffTrustIntake: p19600,
    commitRef: "082f3c1",
  });
  const p20400 = await buildPostP20000OperatorHandoff({
    runAt: RUN_AT,
    write: false,
    trustEvidenceCleanCheckpoint: p20000,
    commitRef: "082f3c1",
  });
  return buildPostP20400LaunchEnvelope({
    runAt: RUN_AT,
    write: false,
    postP20000OperatorHandoff: p20400,
    commitRef: "082f3c1",
  });
}

test("Validation Runbook Readiness opens P21201 when P20800 source is ready", async () => {
  const source = await readyP20800();
  const result = await buildValidationRunbookReadiness({
    runAt: RUN_AT,
    write: false,
    postP20400LaunchEnvelope: source,
    commitRef: "082f3c1",
  });

  assert.equal(result.schema_version, "validation-runbook-readiness.v1");
  assert.equal(result.program_range, "P20801-P21200");
  assert.equal(result.source_program_range, "P20401-P20800");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.validation_runbook_readiness_status, "ready_for_validation_runbook_readiness");
  assert.equal(result.summary.source_p20800_ready_for_p20801_handoff, true);
  assert.equal(result.summary.launch_evidence_queue_count, 11);
  assert.equal(result.summary.command_evidence_plan_count, 6);
  assert.equal(result.summary.no_action_boundary_count, 7);
  assert.equal(result.summary.ready_for_p21201_handoff, true);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Validation Runbook Readiness keeps blocked P20800 as valid BLOCK with visible blockers", async () => {
  const source = await blockedP20800();
  const result = await buildValidationRunbookReadiness({
    runAt: RUN_AT,
    write: false,
    postP20400LaunchEnvelope: source,
    commitRef: "082f3c1",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.validation_runbook_readiness_status, "valid_block_runbook_readiness_pending");
  assert.equal(result.summary.source_p20800_ready_for_p20801_handoff, false);
  assert.equal(result.summary.ready_for_p21201_handoff, false);
  assert.equal(result.launch_evidence_queue_rows.find((row) => row.row_id === "launch_evidence_queue.blocker_visibility").current_verdict, "pass");
  assert.equal(result.p21200_clean_checkpoint_rows.find((row) => row.row_id === "p21200_checkpoint.p21201_handoff_blocker_visible").current_verdict, "pass");
});

test("Validation Runbook Readiness plans command evidence without execution authority", async () => {
  const source = await readyP20800();
  const result = await buildValidationRunbookReadiness({
    runAt: RUN_AT,
    write: false,
    postP20400LaunchEnvelope: source,
    commitRef: "082f3c1",
  });

  assert.equal(result.command_evidence_plan_rows.length, 6);
  assert.equal(result.command_evidence_plan_rows.every((row) => row.command_execution_allowed_now === false), true);
  assert.equal(result.validation_runbook_readiness_boundary.runtime_execution_allowed_now, false);
  assert.equal(result.validation_runbook_readiness_boundary.write_action_allowed_now, false);
});

test("Validation Runbook Readiness keeps protected actions outside the runbook", async () => {
  const source = await readyP20800();
  const result = await buildValidationRunbookReadiness({
    runAt: RUN_AT,
    write: false,
    postP20400LaunchEnvelope: source,
    commitRef: "082f3c1",
  });

  assert.equal(result.no_action_boundary_runbook_rows.every((row) => row.allowed_now === false), true);
  assert.equal(result.no_action_boundary_runbook_rows.every((row) => row.boundary_state === "blocked_not_runbook_action"), true);
  assert.equal(result.validation_runbook_readiness_boundary.production_pass_enabled, false);
  assert.equal(result.validation_runbook_readiness_boundary.final_automated_approval_allowed, false);
});

test("Validation Runbook Readiness --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hermes-validation-runbook-readiness-"));
  try {
    const sentinelPath = path.join(root, "validation-runbook-readiness.json");
    const sentinel = '{ "sentinel": "validation-runbook-readiness" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/validation-runbook-readiness.mjs",
      "--check",
      "--out-dir",
      root,
      "--commit-ref",
      "082f3c1",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
