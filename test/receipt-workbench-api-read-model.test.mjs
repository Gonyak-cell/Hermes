import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPostHandoffTrustIntake } from "../src/post-handoff-trust-intake.mjs";
import { buildPostP20000OperatorHandoff } from "../src/post-p20000-operator-handoff.mjs";
import { buildPostP20400LaunchEnvelope } from "../src/post-p20400-launch-envelope.mjs";
import { buildReceiptCompletionOperatorWorkbench } from "../src/receipt-completion-operator-workbench.mjs";
import { buildReceiptWorkbenchApiReadModel } from "../src/receipt-workbench-api-read-model.mjs";
import { buildTrustDebtRecalibration } from "../src/trust-debt-recalibration.mjs";
import { buildTrustEvidenceCleanCheckpoint } from "../src/trust-evidence-clean-checkpoint.mjs";
import { buildValidationEvidenceReceiptIntake } from "../src/validation-evidence-receipt-intake.mjs";
import { buildValidationReceiptCandidateQueue } from "../src/validation-receipt-candidate-queue.mjs";
import { buildValidationReceiptCompletionReconciliation } from "../src/validation-receipt-completion-reconciliation.mjs";
import { buildValidationRunbookReadiness } from "../src/validation-runbook-readiness.mjs";

const RUN_AT = "2026-06-07T00:00:00.000Z";
const COMMIT_REF = "a4c0812";

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

async function readyP22800() {
  const p22400 = await readyP22400();
  return buildReceiptCompletionOperatorWorkbench({
    runAt: RUN_AT,
    write: false,
    validationReceiptCompletionReconciliation: p22400,
    commitRef: COMMIT_REF,
  });
}

async function blockedP22800() {
  const p22400 = await blockedP22400();
  return buildReceiptCompletionOperatorWorkbench({
    runAt: RUN_AT,
    write: false,
    validationReceiptCompletionReconciliation: p22400,
    commitRef: COMMIT_REF,
  });
}

async function readyP22400() {
  const p22000 = await readyP22000();
  return buildValidationReceiptCompletionReconciliation({
    runAt: RUN_AT,
    write: false,
    validationReceiptCandidateQueue: p22000,
    commitRef: COMMIT_REF,
  });
}

async function blockedP22400() {
  const p22000 = await blockedP22000();
  return buildValidationReceiptCompletionReconciliation({
    runAt: RUN_AT,
    write: false,
    validationReceiptCandidateQueue: p22000,
    commitRef: COMMIT_REF,
  });
}

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

test("Receipt Workbench API Read Model opens P23201 when P22800 source is ready", async () => {
  const source = await readyP22800();
  const result = await buildReceiptWorkbenchApiReadModel({
    runAt: RUN_AT,
    write: false,
    receiptCompletionOperatorWorkbench: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.schema_version, "receipt-workbench-api-read-model.v1");
  assert.equal(result.program_range, "P22801-P23200");
  assert.equal(result.source_program_range, "P22401-P22800");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_api_read_model_status, "ready_for_receipt_workbench_api_read_model");
  assert.equal(result.summary.source_p22800_ready_for_p22801_handoff, true);
  assert.ok(result.summary.dashboard_read_model_count >= 7);
  assert.equal(result.summary.read_only_api_projection_count, 5);
  assert.equal(result.summary.sanitized_field_count, 13);
  assert.equal(result.summary.ready_for_p23201_handoff, true);
  assert.equal(result.summary.server_start_required_now, false);
  assert.equal(result.summary.server_started_now, false);
  assert.equal(result.summary.api_write_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Receipt Workbench API Read Model keeps blocked P22800 as valid BLOCK with visible blockers", async () => {
  const source = await blockedP22800();
  const result = await buildReceiptWorkbenchApiReadModel({
    runAt: RUN_AT,
    write: false,
    receiptCompletionOperatorWorkbench: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_api_read_model_status, "valid_block_receipt_workbench_api_read_model_pending");
  assert.equal(result.summary.source_p22800_ready_for_p22801_handoff, false);
  assert.equal(result.summary.ready_for_p23201_handoff, false);
  assert.equal(result.p23200_clean_checkpoint_rows.find((row) => row.row_id === "p23200_checkpoint.p23201_handoff_blocker_visible").current_verdict, "pass");
});

test("Receipt Workbench API Read Model stays GET/HEAD-only and non-mutating", async () => {
  const source = await readyP22800();
  const result = await buildReceiptWorkbenchApiReadModel({
    runAt: RUN_AT,
    write: false,
    receiptCompletionOperatorWorkbench: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.read_only_api_projection_rows.every((row) => row.method === "GET"), true);
  assert.equal(result.read_only_api_projection_rows.every((row) => row.head_allowed === true), true);
  assert.equal(result.read_only_api_projection_rows.every((row) => row.read_only === true), true);
  assert.equal(result.read_only_api_projection_rows.every((row) => row.write_enabled === false), true);
  assert.equal(result.read_only_api_projection_rows.every((row) => row.mutates_state === false), true);
  assert.equal(result.read_only_api_projection_rows.every((row) => row.server_start_required_now === false), true);
  assert.equal(result.read_only_api_projection_rows.every((row) => row.route_handler_registered_now === false), true);
  assert.equal(result.read_only_api_projection_rows.every((row) => row.route_execution_allowed_now === false), true);
});

test("Receipt Workbench API Read Model blocks raw and protected field projection", async () => {
  const source = await readyP22800();
  const result = await buildReceiptWorkbenchApiReadModel({
    runAt: RUN_AT,
    write: false,
    receiptCompletionOperatorWorkbench: source,
    commitRef: COMMIT_REF,
  });
  const forbiddenFields = new Set(["raw_stdout", "raw_stderr", "secret_material", "full_transcript", "protected_payload"]);
  const forbiddenRows = result.sanitized_field_map_rows.filter((row) => forbiddenFields.has(row.field_name));

  assert.equal(forbiddenRows.length, 5);
  assert.equal(forbiddenRows.every((row) => row.exposed_now === false), true);
  assert.equal(forbiddenRows.every((row) => row.raw_or_secret_material === true), true);
  assert.equal(result.dashboard_read_model_rows.every((row) => row.raw_body_returns === false), true);
  assert.equal(result.dashboard_read_model_rows.every((row) => row.full_body_returns === false), true);
  assert.equal(result.receipt_workbench_api_read_model_boundary.raw_stdout_exposure_allowed_now, false);
  assert.equal(result.receipt_workbench_api_read_model_boundary.full_transcript_exposure_allowed_now, false);
});

test("Receipt Workbench API Read Model --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hermes-receipt-workbench-api-read-model-"));
  try {
    const sentinelPath = path.join(root, "receipt-workbench-api-read-model.json");
    const sentinel = '{ "sentinel": "receipt-workbench-api-read-model" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/receipt-workbench-api-read-model.mjs",
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
