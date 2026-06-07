import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  QUEUE_SCREEN_FALSE_FLAGS,
  buildReceiptWorkbenchOperatorQueueScreenSlotContract,
  runReceiptWorkbenchOperatorQueueScreenSlotContract,
} from "../src/receipt-workbench-operator-queue-screen-slot-contract.mjs";
import { buildReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke } from "../src/receipt-workbench-operator-queue-dashboard-consumer-handoff-smoke.mjs";

const RUN_AT = "2026-06-07T20:15:45.556Z";

test("P27200 opens P27201 handoff when P26800 source is ready and screen UI stays closed", async () => {
  const source = await buildP26800Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueScreenSlotContract({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "receipt-workbench-operator-queue-screen-slot-contract.v1");
  assert.equal(result.program_range, "P26801-P27200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_screen_slot_contract_status, "ready_for_receipt_workbench_operator_queue_screen_slot_contract");
  assert.equal(result.summary.ready_for_p27201_handoff, true);
  assert.equal(result.operator_queue_screen_slot_contract_rows.length, 8);
  assert.equal(result.queue_slot_binding_matrix_rows.length, 8);
  assert.equal(result.queue_state_view_contract_rows.length, 8);
  assert.equal(result.detail_next_action_visibility_rows.length, 8);
  assert.equal(result.no_ui_render_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_ui_render_boundary_rows.length >= 150);
  assert.equal(result.receipt_workbench_operator_queue_screen_slot_contract_boundary.p27200_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_screen_slot_contract_boundary.ready_for_p27201_handoff, true);

  for (const flag of QUEUE_SCREEN_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.receipt_workbench_operator_queue_screen_slot_contract_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P27200 remains a valid visible block when P26800 source handoff is not ready", async () => {
  const source = await buildP26800Source({ ready: false });
  const result = await buildReceiptWorkbenchOperatorQueueScreenSlotContract({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_screen_slot_contract_status, "valid_block_receipt_workbench_operator_queue_screen_slot_contract_pending");
  assert.equal(result.summary.source_p26800_ready_for_p26801_handoff, false);
  assert.equal(result.summary.ready_for_p27201_handoff, false);
  assert.equal(result.receipt_workbench_operator_queue_screen_slot_contract_boundary.p27200_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_screen_slot_contract_boundary.ready_for_p27201_handoff, false);
  assert.equal(result.p27200_clean_checkpoint_rows.find((row) => row.row_id === "p27200_checkpoint.p27201_handoff_blocker_visible").current_verdict, "pass");
});

test("screen slots and bindings never render, refresh, click, write, or mutate", async () => {
  const source = await buildP26800Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueScreenSlotContract({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke: source,
    commitRef: "abc1234",
  });

  assert.ok(result.operator_queue_screen_slot_contract_rows.every((row) => row.render_allowed_now === false));
  assert.ok(result.operator_queue_screen_slot_contract_rows.every((row) => row.browser_run_allowed_now === false));
  assert.ok(result.operator_queue_screen_slot_contract_rows.every((row) => row.click_action_allowed_now === false));
  assert.ok(result.operator_queue_screen_slot_contract_rows.every((row) => row.mutation_enabled === false));
  assert.ok(result.queue_slot_binding_matrix_rows.every((row) => row.live_refresh_allowed_now === false));
  assert.ok(result.queue_slot_binding_matrix_rows.every((row) => row.click_action_allowed_now === false));
  assert.ok(result.queue_slot_binding_matrix_rows.every((row) => row.mutation_enabled === false));
});

test("state views and detail next-action rows stay visible but advisory only", async () => {
  const source = await buildP26800Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueScreenSlotContract({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke: source,
    commitRef: "abc1234",
  });

  assert.deepEqual([...result.queue_state_view_contract_rows.map((row) => row.fixture_state)].sort(), [
    "blocked",
    "empty",
    "error",
    "loading",
    "ready",
    "review_pending",
    "redacted_payload",
    "stale",
  ].sort());
  assert.ok(result.queue_state_view_contract_rows.every((row) => row.action_enabled_now === false));
  assert.ok(result.detail_next_action_visibility_rows.every((row) => row.advisory_only === true));
  assert.ok(result.detail_next_action_visibility_rows.every((row) => row.command_button_enabled_now === false));
  assert.ok(result.detail_next_action_visibility_rows.every((row) => row.approve_button_enabled_now === false));
  assert.ok(result.detail_next_action_visibility_rows.every((row) => row.closeout_button_enabled_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.receipt_workbench_operator_queue_screen_slot_contract_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing screen slot artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p27200-"));
  try {
    const source = await buildP26800Source({ ready: true });
    const result = await runReceiptWorkbenchOperatorQueueScreenSlotContract({
      check: true,
      outDir,
      runAt: RUN_AT,
      receiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "receipt-workbench-operator-queue-screen-slot-contract.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP26800Source({ ready }) {
  const source = await buildReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_p26801_handoff = ready;
  source.summary.source_p26400_ready_for_p26401_handoff = true;
  source.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_boundary.ready_for_p26801_handoff = ready;
  source.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_boundary.source_p26400_ready_for_p26401_handoff = true;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
