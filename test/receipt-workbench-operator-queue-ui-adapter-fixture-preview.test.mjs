import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  UI_ADAPTER_FALSE_FLAGS,
  buildReceiptWorkbenchOperatorQueueUiAdapterFixturePreview,
  runReceiptWorkbenchOperatorQueueUiAdapterFixturePreview,
} from "../src/receipt-workbench-operator-queue-ui-adapter-fixture-preview.mjs";
import { buildReceiptWorkbenchOperatorQueueScreenSlotContract } from "../src/receipt-workbench-operator-queue-screen-slot-contract.mjs";

const RUN_AT = "2026-06-07T20:35:45.728Z";

test("P27600 opens P27601 handoff when P27200 source is ready and UI adapter rendering stays closed", async () => {
  const source = await buildP27200Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueUiAdapterFixturePreview({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueScreenSlotContract: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "receipt-workbench-operator-queue-ui-adapter-fixture-preview.v1");
  assert.equal(result.program_range, "P27201-P27600");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_ui_adapter_fixture_preview_status, "ready_for_receipt_workbench_operator_queue_ui_adapter_fixture_preview");
  assert.equal(result.summary.ready_for_p27601_handoff, true);
  assert.equal(result.ui_adapter_fixture_preview_rows.length, 8);
  assert.equal(result.slot_snapshot_matrix_rows.length, 8);
  assert.equal(result.state_fixture_preview_contract_rows.length, 8);
  assert.equal(result.bounded_handoff_stub_rows.length, 8);
  assert.equal(result.no_render_no_action_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_render_no_action_boundary_rows.length >= 160);
  assert.equal(result.receipt_workbench_operator_queue_ui_adapter_fixture_preview_boundary.p27600_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_ui_adapter_fixture_preview_boundary.ready_for_p27601_handoff, true);

  for (const flag of UI_ADAPTER_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.receipt_workbench_operator_queue_ui_adapter_fixture_preview_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P27600 remains a valid visible block when P27200 source handoff is not ready", async () => {
  const source = await buildP27200Source({ ready: false });
  const result = await buildReceiptWorkbenchOperatorQueueUiAdapterFixturePreview({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueScreenSlotContract: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_ui_adapter_fixture_preview_status, "valid_block_receipt_workbench_operator_queue_ui_adapter_fixture_preview_pending");
  assert.equal(result.summary.source_p27200_ready_for_p27201_handoff, false);
  assert.equal(result.summary.ready_for_p27601_handoff, false);
  assert.equal(result.receipt_workbench_operator_queue_ui_adapter_fixture_preview_boundary.p27600_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_ui_adapter_fixture_preview_boundary.ready_for_p27601_handoff, false);
  assert.equal(result.p27600_clean_checkpoint_rows.find((row) => row.row_id === "p27600_checkpoint.p27601_handoff_blocker_visible").current_verdict, "pass");
});

test("fixture previews, snapshots, and stubs never render, refresh, click, write, mutate, or expose raw payloads", async () => {
  const source = await buildP27200Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueUiAdapterFixturePreview({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueScreenSlotContract: source,
    commitRef: "abc1234",
  });

  assert.ok(result.ui_adapter_fixture_preview_rows.every((row) => row.render_allowed_now === false));
  assert.ok(result.ui_adapter_fixture_preview_rows.every((row) => row.browser_run_allowed_now === false));
  assert.ok(result.ui_adapter_fixture_preview_rows.every((row) => row.live_refresh_allowed_now === false));
  assert.ok(result.ui_adapter_fixture_preview_rows.every((row) => row.click_action_allowed_now === false));
  assert.ok(result.ui_adapter_fixture_preview_rows.every((row) => row.write_allowed_now === false));
  assert.ok(result.ui_adapter_fixture_preview_rows.every((row) => row.mutation_enabled === false));
  assert.ok(result.ui_adapter_fixture_preview_rows.every((row) => row.raw_payload_included === false));
  assert.ok(result.slot_snapshot_matrix_rows.every((row) => row.snapshot_capture_allowed_now === false));
  assert.ok(result.slot_snapshot_matrix_rows.every((row) => row.render_allowed_now === false));
  assert.ok(result.bounded_handoff_stub_rows.every((row) => row.html_file_write_allowed_now === false));
  assert.ok(result.bounded_handoff_stub_rows.every((row) => row.raw_payload_exposure_allowed_now === false));
  assert.ok(result.bounded_handoff_stub_rows.every((row) => row.route_mount_allowed_now === false));
});

test("state fixture previews stay visible but advisory/read-only only", async () => {
  const source = await buildP27200Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueUiAdapterFixturePreview({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueScreenSlotContract: source,
    commitRef: "abc1234",
  });

  assert.deepEqual([...result.state_fixture_preview_contract_rows.map((row) => row.fixture_state)].sort(), [
    "blocked",
    "empty",
    "error",
    "loading",
    "ready",
    "review_pending",
    "redacted_payload",
    "stale",
  ].sort());
  assert.ok(result.state_fixture_preview_contract_rows.every((row) => row.render_allowed_now === false));
  assert.ok(result.state_fixture_preview_contract_rows.every((row) => row.live_refresh_allowed_now === false));
  assert.ok(result.state_fixture_preview_contract_rows.every((row) => row.action_enabled_now === false));
  assert.ok(result.state_fixture_preview_contract_rows.every((row) => row.mutation_enabled === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.receipt_workbench_operator_queue_ui_adapter_fixture_preview_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing UI adapter fixture preview artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p27600-"));
  try {
    const source = await buildP27200Source({ ready: true });
    const result = await runReceiptWorkbenchOperatorQueueUiAdapterFixturePreview({
      check: true,
      outDir,
      runAt: RUN_AT,
      receiptWorkbenchOperatorQueueScreenSlotContract: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "receipt-workbench-operator-queue-ui-adapter-fixture-preview.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP27200Source({ ready }) {
  const source = await buildReceiptWorkbenchOperatorQueueScreenSlotContract({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_p27201_handoff = ready;
  source.summary.source_p26800_ready_for_p26801_handoff = true;
  source.receipt_workbench_operator_queue_screen_slot_contract_boundary.ready_for_p27201_handoff = ready;
  source.receipt_workbench_operator_queue_screen_slot_contract_boundary.source_p26800_ready_for_p26801_handoff = true;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
