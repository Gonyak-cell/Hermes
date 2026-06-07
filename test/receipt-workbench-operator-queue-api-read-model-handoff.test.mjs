import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  QUEUE_API_FALSE_FLAGS,
  buildReceiptWorkbenchOperatorQueueApiReadModelHandoff,
  runReceiptWorkbenchOperatorQueueApiReadModelHandoff,
} from "../src/receipt-workbench-operator-queue-api-read-model-handoff.mjs";
import { buildReceiptWorkbenchOperatorQueueStatusProjection } from "../src/receipt-workbench-operator-queue-status-projection.mjs";

const RUN_AT = "2026-06-07T19:35:45.362Z";

test("P26400 opens P26401 handoff when P26000 source is ready and no serving boundary opens", async () => {
  const source = await buildP26000Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueApiReadModelHandoff({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStatusProjection: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "receipt-workbench-operator-queue-api-read-model-handoff.v1");
  assert.equal(result.program_range, "P26001-P26400");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_api_read_model_handoff_status, "ready_for_receipt_workbench_operator_queue_api_read_model_handoff");
  assert.equal(result.summary.ready_for_p26401_handoff, true);
  assert.equal(result.queue_api_route_contract_rows.length, 6);
  assert.equal(result.sanitized_queue_field_projection_rows.length, 18);
  assert.equal(result.queue_api_status_matrix_rows.length, 8);
  assert.equal(result.operator_queue_api_attention_guard_rows.length, 8);
  assert.equal(result.no_serve_queue_api_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_serve_queue_api_boundary_rows.length >= 120);
  assert.equal(result.receipt_workbench_operator_queue_api_read_model_handoff_boundary.p26400_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_api_read_model_handoff_boundary.ready_for_p26401_handoff, true);

  for (const flag of QUEUE_API_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.receipt_workbench_operator_queue_api_read_model_handoff_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P26400 remains a valid visible block when P26000 source handoff is not ready", async () => {
  const source = await buildP26000Source({ ready: false });
  const result = await buildReceiptWorkbenchOperatorQueueApiReadModelHandoff({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStatusProjection: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_api_read_model_handoff_status, "valid_block_receipt_workbench_operator_queue_api_read_model_handoff_pending");
  assert.equal(result.summary.source_p26000_ready_for_p26001_handoff, false);
  assert.equal(result.summary.ready_for_p26401_handoff, false);
  assert.equal(result.receipt_workbench_operator_queue_api_read_model_handoff_boundary.p26400_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_api_read_model_handoff_boundary.ready_for_p26401_handoff, false);
  assert.equal(result.p26400_clean_checkpoint_rows.find((row) => row.row_id === "p26400_checkpoint.p26401_handoff_blocker_visible").current_verdict, "pass");
});

test("queue API route contract is GET and HEAD only without server or execution", async () => {
  const source = await buildP26000Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueApiReadModelHandoff({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStatusProjection: source,
    commitRef: "abc1234",
  });

  assert.ok(result.queue_api_route_contract_rows.every((row) => row.method_allowlist.join(",") === "GET,HEAD"));
  assert.ok(result.queue_api_route_contract_rows.every((row) => row.forbidden_methods.includes("POST")));
  assert.ok(result.queue_api_route_contract_rows.every((row) => row.server_started_now === false));
  assert.ok(result.queue_api_route_contract_rows.every((row) => row.route_handler_registered_now === false));
  assert.ok(result.queue_api_route_contract_rows.every((row) => row.route_execution_allowed_now === false));
  assert.ok(result.queue_api_route_contract_rows.every((row) => row.action_enabled_now === false));
});

test("sanitized field projection omits raw and protected material", async () => {
  const source = await buildP26000Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueApiReadModelHandoff({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStatusProjection: source,
    commitRef: "abc1234",
  });

  const forbiddenFields = result.sanitized_queue_field_projection_rows.filter((row) => row.forbidden_in_api === true);
  assert.deepEqual(forbiddenFields.map((row) => row.field_name), [
    "raw_stdout",
    "raw_stderr",
    "raw_secret_material",
    "full_transcript",
    "raw_queue_payload",
    "protected_payload",
  ]);
  assert.ok(forbiddenFields.every((row) => row.exposed_in_api === false));
  assert.ok(forbiddenFields.every((row) => row.redacted_or_omitted === true));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.receipt_workbench_operator_queue_api_read_model_handoff_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing queue API handoff artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p26400-"));
  try {
    const source = await buildP26000Source({ ready: true });
    const result = await runReceiptWorkbenchOperatorQueueApiReadModelHandoff({
      check: true,
      outDir,
      runAt: RUN_AT,
      receiptWorkbenchOperatorQueueStatusProjection: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "receipt-workbench-operator-queue-api-read-model-handoff.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP26000Source({ ready }) {
  const source = await buildReceiptWorkbenchOperatorQueueStatusProjection({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_p26001_handoff = ready;
  source.summary.source_p25600_ready_for_p25601_handoff = true;
  source.receipt_workbench_operator_queue_status_projection_boundary.ready_for_p26001_handoff = ready;
  source.receipt_workbench_operator_queue_status_projection_boundary.source_p25600_ready_for_p25601_handoff = true;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
