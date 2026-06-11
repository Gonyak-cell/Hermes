import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFactoryF0ReviewReceiptIntake,
  runFactoryF0ReviewReceiptIntake,
} from "../src/factory-f0-review-receipt-intake.mjs";

const RUN_AT = "2026-06-11T00:00:00.000Z";
const COMMIT_SHA = "f3b2ca7f3b2ca7f3b2ca7f3b2ca7f3b2ca7f3b2ca7";
const RAW_OUTPUT = "Independent Opus review completed. No findings.\n";
const FAILED_CLAUDE_JSON_OUTPUT = JSON.stringify({
  type: "result",
  subtype: "success",
  is_error: true,
  api_error_status: 429,
  result: "You're out of extra usage · resets 7:40pm (Asia/Seoul)",
  modelUsage: {
    "claude-opus-4-7": {
      inputTokens: 43,
      outputTokens: 2280,
    },
  },
});

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    scopeId: "connector_external_app_governance",
    rawOutputText: RAW_OUTPUT,
    reviewedCommitSha: COMMIT_SHA,
    engineResolvedModelId: "claude-opus-4-1-20260501",
    unresolvedFindingCount: 0,
    ...overrides,
  };
}

test("Factory F0 Review Receipt Intake normalizes raw review output into a preflight-ready connector receipt", async () => {
  const result = await buildFactoryF0ReviewReceiptIntake(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "factory-f0-review-receipt-intake.v1");
  assert.equal(result.summary.factory_f0_review_receipt_intake_status, "ready_f0_review_receipt_intake");
  assert.equal(result.summary.scope_id, "connector_external_app_governance");
  assert.equal(result.summary.prompt_sha256_matches_index, true);
  assert.equal(result.summary.target_preflight_passed, true);
  assert.equal(result.summary.intake_rows_passed, true);
  assert.equal(result.generated_receipt.schema_version, "connector-governance-claude-review-receipt.v1");
  assert.equal(result.generated_receipt.review_engine, "claude_code_opus_max");
  assert.equal(result.generated_receipt.scope_connector_external_app_governance, true);
  assert.equal(result.generated_receipt.scope_execution_write_authority_maturity, false);
  assert.equal(result.generated_receipt.reviewed_commit_sha, COMMIT_SHA);
  assert.equal(result.generated_receipt.engine_resolved_model_id, "claude-opus-4-1-20260501");
  assert.equal(result.generated_receipt.unresolved_finding_count, 0);
  assert.equal(result.generated_receipt.claude_final_approval_allowed, false);
  assert.equal(result.generated_receipt.production_pass_enabled, false);
  assert.equal(result.generated_receipt.enterprise_pass_enabled, false);
});

test("Factory F0 Review Receipt Intake supports the execution/write authority receipt scope", async () => {
  const result = await buildFactoryF0ReviewReceiptIntake(options({
    scopeId: "execution_write_authority_maturity",
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.target_preflight_passed, true);
  assert.equal(result.generated_receipt.schema_version, "execution-write-authority-claude-review-receipt.v1");
  assert.equal(result.generated_receipt.scope_connector_external_app_governance, false);
  assert.equal(result.generated_receipt.scope_execution_write_authority_maturity, true);
});

test("Factory F0 Review Receipt Intake blocks label-only or Fable model ids through target preflight", async () => {
  const result = await buildFactoryF0ReviewReceiptIntake(options({
    engineResolvedModelId: "claude_code_opus_max",
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_f0_review_receipt_intake_status, "blocked_f0_review_receipt_intake");
  assert.equal(result.summary.target_preflight_passed, false);
  assert.equal(result.receipt_intake_rows.find((row) => row.row_id === "engine_resolved_model_id").current_verdict, "blocked");
  assert.equal(result.receipt_intake_rows.find((row) => row.row_id === "target.preflight").current_verdict, "blocked");
});

test("Factory F0 Review Receipt Intake preserves unresolved findings as a blocked preflight result", async () => {
  const result = await buildFactoryF0ReviewReceiptIntake(options({
    unresolvedFindingCount: 1,
    findings: [{ finding_id: "F0-REVIEW-1", severity: "blocking", summary: "Needs fix" }],
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.generated_receipt.unresolved_finding_count, 1);
  assert.equal(result.summary.target_preflight_passed, false);
  assert.equal(result.receipt_intake_rows.find((row) => row.row_id === "findings.count_consistent").current_verdict, "pass");
  assert.equal(result.receipt_intake_rows.find((row) => row.row_id === "target.preflight").current_verdict, "blocked");
});

test("Factory F0 Review Receipt Intake rejects output paths outside the two F0.1 receipt targets", async () => {
  const result = await buildFactoryF0ReviewReceiptIntake(options({
    receiptPath: "artifacts/not-f0/review.json",
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.target_preflight_passed, true);
  assert.equal(result.validation.errors.some((error) => error.item_id === "receipt.path.allowed"), true);
});

test("Factory F0 Review Receipt Intake does not accept request packets as raw review output", async () => {
  const result = await buildFactoryF0ReviewReceiptIntake({
    runAt: RUN_AT,
    write: false,
    scopeId: "connector_external_app_governance",
    rawOutputPath: "docs/factory-promotion/f0-review-requests/connector-external-app-governance-opus-review-request.md",
    reviewedCommitSha: COMMIT_SHA,
    engineResolvedModelId: "claude-opus-4-1-20260501",
    unresolvedFindingCount: 0,
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.target_preflight_passed, true);
  assert.equal(result.summary.intake_rows_passed, false);
  assert.equal(result.summary.factory_f0_review_receipt_intake_status, "blocked_f0_review_receipt_intake");
  assert.equal(result.receipt_intake_rows.find((row) => row.row_id === "raw_output.not_request_packet").current_verdict, "blocked");
});

test("Factory F0 Review Receipt Intake blocks failed Claude CLI raw outputs", async () => {
  const result = await buildFactoryF0ReviewReceiptIntake(options({
    rawOutputText: FAILED_CLAUDE_JSON_OUTPUT,
    engineResolvedModelId: "claude-opus-4-7",
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.target_preflight_passed, true);
  assert.equal(result.summary.intake_rows_passed, false);
  assert.equal(result.summary.factory_f0_review_receipt_intake_status, "blocked_f0_review_receipt_intake");
  assert.equal(result.receipt_intake_rows.find((row) => row.row_id === "raw_output.completed_review").current_verdict, "blocked");
});

test("Factory F0 Review Receipt Intake --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-f0-review-receipt-intake-"));
  const sentinelPath = path.join(outDir, "factory-f0-review-receipt-intake.json");
  const sentinel = "{ \"sentinel\": \"factory-f0-review-receipt-intake\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runFactoryF0ReviewReceiptIntake(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Factory F0 Review Receipt Intake --require-pass rejects blocked target preflight", async () => {
  await assert.rejects(
    () => runFactoryF0ReviewReceiptIntake(options({
      requirePass: true,
      engineResolvedModelId: "claude-fable-5[1m]",
    })),
    /does not pass F0.1 preflight/,
  );
});

test("Factory F0 Review Receipt Intake --require-pass rejects blocked intake rows even when target preflight passes", async () => {
  await assert.rejects(
    () => runFactoryF0ReviewReceiptIntake(options({
      requirePass: true,
      rawOutputText: FAILED_CLAUDE_JSON_OUTPUT,
      engineResolvedModelId: "claude-opus-4-7",
    })),
    /does not pass F0.1 preflight or intake rows/,
  );
});
