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
import { buildValidationRunbookReadiness } from "../src/validation-runbook-readiness.mjs";

const RUN_AT = "2026-06-07T00:00:00.000Z";
const COMMIT_REF = "4cf0d0e";

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

test("Validation Evidence Receipt Intake opens P21601 when P21200 source is ready", async () => {
  const source = await readyP21200();
  const result = await buildValidationEvidenceReceiptIntake({
    runAt: RUN_AT,
    write: false,
    validationRunbookReadiness: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.schema_version, "validation-evidence-receipt-intake.v1");
  assert.equal(result.program_range, "P21201-P21600");
  assert.equal(result.source_program_range, "P20801-P21200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.validation_evidence_receipt_intake_status, "ready_for_validation_evidence_receipt_intake");
  assert.equal(result.summary.source_p21200_ready_for_p21201_handoff, true);
  assert.equal(result.summary.expected_receipt_count, 7);
  assert.equal(result.summary.received_receipt_count, 0);
  assert.equal(result.summary.missing_receipt_count, 7);
  assert.equal(result.summary.ready_for_p21601_handoff, true);
  assert.equal(result.summary.raw_stdout_capture_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Validation Evidence Receipt Intake keeps blocked P21200 as valid BLOCK with visible blockers", async () => {
  const source = await blockedP21200();
  const result = await buildValidationEvidenceReceiptIntake({
    runAt: RUN_AT,
    write: false,
    validationRunbookReadiness: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.validation_evidence_receipt_intake_status, "valid_block_receipt_intake_pending");
  assert.equal(result.summary.source_p21200_ready_for_p21201_handoff, false);
  assert.equal(result.summary.ready_for_p21601_handoff, false);
  assert.equal(result.operator_evidence_inbox_rows.find((row) => row.row_id === "operator_inbox.blocker_visibility").current_verdict, "pass");
  assert.equal(result.p21600_clean_checkpoint_rows.find((row) => row.row_id === "p21600_checkpoint.p21601_handoff_blocker_visible").current_verdict, "pass");
});

test("Validation Evidence Receipt Intake surfaces missing receipts instead of accepting them", async () => {
  const source = await readyP21200();
  const result = await buildValidationEvidenceReceiptIntake({
    runAt: RUN_AT,
    write: false,
    validationRunbookReadiness: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.validation_evidence_receipt_schema_rows.every((row) => row.actual_receipt_present_now === false), true);
  assert.equal(result.validation_evidence_receipt_schema_rows.every((row) => row.receipt_payload_accepted_now === false), true);
  assert.equal(result.operator_evidence_inbox_rows.filter((row) => row.inbox_state === "missing_receipt_visible").length, 7);
  assert.equal(result.validation_evidence_receipt_intake_boundary.received_receipt_count, 0);
  assert.equal(result.validation_evidence_receipt_intake_boundary.missing_receipt_count, 7);
});

test("Validation Evidence Receipt Intake keeps raw capture and execution authority closed", async () => {
  const source = await readyP21200();
  const result = await buildValidationEvidenceReceiptIntake({
    runAt: RUN_AT,
    write: false,
    validationRunbookReadiness: source,
    commitRef: COMMIT_REF,
  });
  const rawRows = result.redacted_result_capture_rows.filter((row) => row.capture_contract_state === "forbidden_raw_material");

  assert.equal(rawRows.every((row) => row.allowed_now === false), true);
  assert.equal(result.validation_evidence_receipt_intake_boundary.command_execution_allowed_now, false);
  assert.equal(result.validation_evidence_receipt_intake_boundary.raw_stdout_capture_allowed_now, false);
  assert.equal(result.validation_evidence_receipt_intake_boundary.raw_stderr_capture_allowed_now, false);
  assert.equal(result.validation_evidence_receipt_intake_boundary.raw_secret_material_allowed_now, false);
  assert.equal(result.validation_evidence_receipt_intake_boundary.runtime_execution_allowed_now, false);
  assert.equal(result.validation_evidence_receipt_intake_boundary.write_action_allowed_now, false);
  assert.equal(result.validation_evidence_receipt_intake_boundary.final_automated_approval_allowed, false);
});

test("Validation Evidence Receipt Intake --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hermes-validation-evidence-receipt-intake-"));
  try {
    const sentinelPath = path.join(root, "validation-evidence-receipt-intake.json");
    const sentinel = '{ "sentinel": "validation-evidence-receipt-intake" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/validation-evidence-receipt-intake.mjs",
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
