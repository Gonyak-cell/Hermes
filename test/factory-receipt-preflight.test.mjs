import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFactoryReceiptPreflight,
  runFactoryReceiptPreflight,
} from "../src/factory-receipt-preflight.mjs";

const RUN_AT = "2026-06-11T00:00:00.000Z";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const COMMIT_SHA = "f3b2ca7f3b2ca7f3b2ca7f3b2ca7f3b2ca7f3b2ca7";

const OWNER_RECEIPT = {
  receipt_id: "rcpt-s0-owner-adjudication-20260611",
  receipt_kind: "human_owner_adjudication",
  scope: {
    program: "Hermes Factory Promotion",
    stage: "S0",
  },
};

const CONNECTOR_RECEIPT = {
  schema_version: "connector-governance-claude-review-receipt.v1",
  review_engine: "claude_code_opus_max",
  receipt_status: "complete",
  scope_connector_external_app_governance: true,
  scope_id: "connector_external_app_governance",
  unresolved_finding_count: 0,
  reviewed_commit_sha: COMMIT_SHA,
  prompt_sha256: HASH_A,
  raw_output_sha256: HASH_B,
  engine_resolved_model_id: "claude-opus-4-1-20260501",
  summary: {
    review_status: "complete",
    unresolved_finding_count: 0,
  },
};

const EXECUTION_RECEIPT = {
  schema_version: "execution-write-authority-claude-review-receipt.v1",
  review_engine: "claude_code_opus_max",
  receipt_status: "complete",
  scope_execution_write_authority_maturity: true,
  scope_id: "execution_write_authority_maturity",
  unresolved_finding_count: 0,
  reviewed_commit_sha: COMMIT_SHA,
  prompt_sha256: HASH_B,
  raw_output_sha256: HASH_A,
  engine_resolved_model_id: "claude-opus-4-1-20260501",
  summary: {
    review_status: "complete",
    unresolved_finding_count: 0,
  },
};

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    ownerAdjudicationReceipt: OWNER_RECEIPT,
    inlineReceipts: {
      "f0_1.connector_external_app_governance": CONNECTOR_RECEIPT,
      "f0_1.execution_write_authority_maturity": EXECUTION_RECEIPT,
    },
    ...overrides,
  };
}

test("Factory Receipt Preflight passes complete F0.1 review receipts while keeping authority closed", async () => {
  const result = await buildFactoryReceiptPreflight(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "factory-receipt-preflight.v1");
  assert.equal(result.program_range, "FCORE-F0.1");
  assert.equal(result.summary.factory_receipt_preflight_status, "ready_for_f0_1_receipt_preflight");
  assert.equal(result.summary.f0_1_receipt_preflight_passed, true);
  assert.equal(result.summary.receipt_target_pass_count, 2);
  assert.equal(result.factory_receipt_preflight_boundary.project_creation_allowed_now, false);
  assert.equal(result.factory_receipt_preflight_boundary.repo_write_allowed_now, false);
  assert.equal(result.factory_receipt_preflight_boundary.connector_write_allowed_now, false);
  assert.equal(result.factory_receipt_preflight_boundary.deployment_allowed_now, false);
  assert.equal(result.factory_receipt_preflight_boundary.production_pass_enabled, false);
  assert.equal(result.factory_receipt_preflight_boundary.enterprise_pass_enabled, false);
  assert.equal(result.summary.ready_for_fa_implementation_now, false);
});

test("Factory Receipt Preflight preserves missing F0.1 receipts as visible blockers without schema failure", async () => {
  const result = await buildFactoryReceiptPreflight(options({
    inlineReceipts: {
      "f0_1.connector_external_app_governance": null,
      "f0_1.execution_write_authority_maturity": null,
    },
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_receipt_preflight_status, "blocked_f0_1_receipt_preflight");
  assert.equal(result.summary.missing_receipt_count, 2);
  assert.equal(result.summary.f0_1_receipt_preflight_passed, false);
  assert.deepEqual(result.summary.blocked_target_ids, [
    "f0_1.connector_external_app_governance",
    "f0_1.execution_write_authority_maturity",
  ]);
});

test("Factory Receipt Preflight rejects label-only model ids and Fable planning receipts", async () => {
  const labelOnly = {
    ...CONNECTOR_RECEIPT,
    engine_resolved_model_id: "claude_code_opus_max",
  };
  const fableReceipt = {
    ...EXECUTION_RECEIPT,
    engine_resolved_model_id: "claude-fable-5[1m]",
  };
  const result = await buildFactoryReceiptPreflight(options({
    inlineReceipts: {
      "f0_1.connector_external_app_governance": labelOnly,
      "f0_1.execution_write_authority_maturity": fableReceipt,
    },
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.f0_1_receipt_preflight_passed, false);
  assert.equal(result.receipt_preflight_rows.find((row) => row.row_id.endsWith("integrity.engine_resolved_model_id") && row.target_id === "f0_1.connector_external_app_governance").current_verdict, "blocked");
  assert.equal(result.receipt_preflight_rows.find((row) => row.row_id.endsWith("independence.not_fable_planning") && row.target_id === "f0_1.execution_write_authority_maturity").current_verdict, "blocked");
});

test("Factory Receipt Preflight rejects receipts that satisfy old shape but miss integrity fields", async () => {
  const weakConnector = {
    schema_version: "connector-governance-claude-review-receipt.v1",
    review_engine: "claude_code_opus_max",
    receipt_status: "complete",
    scope_connector_external_app_governance: true,
    scope_id: "connector_external_app_governance",
    unresolved_finding_count: 0,
    summary: {
      review_status: "complete",
      unresolved_finding_count: 0,
    },
  };
  const result = await buildFactoryReceiptPreflight(options({
    inlineReceipts: {
      "f0_1.connector_external_app_governance": weakConnector,
      "f0_1.execution_write_authority_maturity": EXECUTION_RECEIPT,
    },
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.f0_1_receipt_preflight_passed, false);
  assert.equal(result.receipt_targets.find((target) => target.target_id === "f0_1.connector_external_app_governance").target_preflight_passed, false);
  assert.equal(result.receipt_preflight_rows.find((row) => row.row_id.endsWith("integrity.reviewed_commit_sha") && row.target_id === "f0_1.connector_external_app_governance").current_verdict, "blocked");
  assert.equal(result.receipt_preflight_rows.find((row) => row.row_id.endsWith("integrity.prompt_sha256") && row.target_id === "f0_1.connector_external_app_governance").current_verdict, "blocked");
});

test("Factory Receipt Preflight --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-receipt-preflight-"));
  const sentinelPath = path.join(outDir, "factory-receipt-preflight.json");
  const sentinel = "{ \"sentinel\": \"factory-receipt-preflight\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runFactoryReceiptPreflight(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
