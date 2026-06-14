import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  QUEUE_DASHBOARD_CONSUMER_FALSE_FLAGS,
  buildReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke,
  runReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke,
} from "../src/receipt-workbench-operator-queue-dashboard-consumer-handoff-smoke.mjs";
import { buildReceiptWorkbenchOperatorQueueApiReadModelHandoff } from "../src/receipt-workbench-operator-queue-api-read-model-handoff.mjs";

const RUN_AT = "2026-06-07T19:55:45.479Z";

test("P26800 opens P26801 handoff when P26400 source is ready and dashboard rendering stays closed", async () => {
  const source = await buildP26400Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueApiReadModelHandoff: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "receipt-workbench-operator-queue-dashboard-consumer-handoff-smoke.v1");
  assert.equal(result.program_range, "P26401-P26800");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_status, "ready_for_receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke");
  assert.equal(result.summary.ready_for_p26801_handoff, true);
  assert.equal(result.queue_dashboard_consumer_contract_rows.length, 6);
  assert.equal(result.queue_api_adapter_smoke_rows.length, 6);
  assert.equal(result.queue_fixture_state_coverage_rows.length, 8);
  assert.equal(result.consumer_visibility_guard_rows.length, 8);
  assert.equal(result.no_render_queue_dashboard_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_render_queue_dashboard_boundary_rows.length >= 135);
  assert.equal(result.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_boundary.p26800_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_boundary.ready_for_p26801_handoff, true);

  for (const flag of QUEUE_DASHBOARD_CONSUMER_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P26800 remains a valid visible block when P26400 source handoff is not ready", async () => {
  const source = await buildP26400Source({ ready: false });
  const result = await buildReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueApiReadModelHandoff: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_status, "valid_block_receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_pending");
  assert.equal(result.summary.source_p26400_ready_for_p26401_handoff, false);
  assert.equal(result.summary.ready_for_p26801_handoff, false);
  assert.equal(result.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_boundary.p26800_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_boundary.ready_for_p26801_handoff, false);
  assert.equal(result.p26800_clean_checkpoint_rows.find((row) => row.row_id === "p26800_checkpoint.p26801_handoff_blocker_visible").current_verdict, "pass");
});

test("dashboard consumer and adapter smoke rows never render, fetch live data, click, or mutate", async () => {
  const source = await buildP26400Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueApiReadModelHandoff: source,
    commitRef: "abc1234",
  });

  assert.ok(result.queue_dashboard_consumer_contract_rows.every((row) => row.render_allowed_now === false));
  assert.ok(result.queue_dashboard_consumer_contract_rows.every((row) => row.live_fetch_allowed_now === false));
  assert.ok(result.queue_dashboard_consumer_contract_rows.every((row) => row.click_action_allowed_now === false));
  assert.ok(result.queue_dashboard_consumer_contract_rows.every((row) => row.mutation_enabled === false));
  assert.ok(result.queue_api_adapter_smoke_rows.every((row) => row.server_started_now === false));
  assert.ok(result.queue_api_adapter_smoke_rows.every((row) => row.route_execution_allowed_now === false));
  assert.ok(result.queue_api_adapter_smoke_rows.every((row) => row.render_allowed_now === false));
  assert.ok(result.queue_api_adapter_smoke_rows.every((row) => row.mutation_enabled === false));
});

test("fixture coverage keeps all queue states visible without action authority", async () => {
  const source = await buildP26400Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueApiReadModelHandoff: source,
    commitRef: "abc1234",
  });

  assert.deepEqual([...result.queue_fixture_state_coverage_rows.map((row) => row.fixture_state)].sort(), [
    "blocked",
    "empty",
    "error",
    "loading",
    "ready",
    "review_pending",
    "redacted_payload",
    "stale",
  ].sort());
  assert.ok(result.queue_fixture_state_coverage_rows.every((row) => row.visible_when_blocked === true));
  assert.ok(result.queue_fixture_state_coverage_rows.every((row) => row.action_enabled_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing dashboard consumer smoke artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p26800-"));
  try {
    const source = await buildP26400Source({ ready: true });
    const result = await runReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke({
      check: true,
      outDir,
      runAt: RUN_AT,
      receiptWorkbenchOperatorQueueApiReadModelHandoff: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "receipt-workbench-operator-queue-dashboard-consumer-handoff-smoke.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP26400Source({ ready }) {
  const source = await buildReceiptWorkbenchOperatorQueueApiReadModelHandoff({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_p26401_handoff = ready;
  source.summary.source_p26000_ready_for_p26001_handoff = true;
  source.receipt_workbench_operator_queue_api_read_model_handoff_boundary.ready_for_p26401_handoff = ready;
  source.receipt_workbench_operator_queue_api_read_model_handoff_boundary.source_p26000_ready_for_p26001_handoff = true;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
