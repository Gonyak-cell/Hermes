import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  UI_HANDOFF_BUNDLE_FALSE_FLAGS,
  buildReceiptWorkbenchOperatorQueueUiHandoffBundle,
  runReceiptWorkbenchOperatorQueueUiHandoffBundle,
} from "../src/receipt-workbench-operator-queue-ui-handoff-bundle.mjs";
import { buildReceiptWorkbenchOperatorQueueUiAdapterFixturePreview } from "../src/receipt-workbench-operator-queue-ui-adapter-fixture-preview.mjs";

const RUN_AT = "2026-06-07T20:56:15.738Z";

test("P28000 opens P28001 handoff when P27600 source is ready and serving/rendering stays closed", async () => {
  const source = await buildP27600Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueUiHandoffBundle({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueUiAdapterFixturePreview: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "receipt-workbench-operator-queue-ui-handoff-bundle.v1");
  assert.equal(result.program_range, "P27601-P28000");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_ui_handoff_bundle_status, "ready_for_receipt_workbench_operator_queue_ui_handoff_bundle");
  assert.equal(result.summary.ready_for_p28001_handoff, true);
  assert.equal(result.ui_handoff_bundle_manifest_rows.length, 8);
  assert.equal(result.read_only_adapter_manifest_rows.length, 8);
  assert.equal(result.operator_queue_handoff_view_rows.length, 8);
  assert.equal(result.review_affordance_visibility_rows.length, 8);
  assert.equal(result.no_serve_no_render_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_serve_no_render_boundary_rows.length >= 170);
  assert.equal(result.receipt_workbench_operator_queue_ui_handoff_bundle_boundary.p28000_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_ui_handoff_bundle_boundary.ready_for_p28001_handoff, true);

  for (const flag of UI_HANDOFF_BUNDLE_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.receipt_workbench_operator_queue_ui_handoff_bundle_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P28000 remains a valid visible block when P27600 source handoff is not ready", async () => {
  const source = await buildP27600Source({ ready: false });
  const result = await buildReceiptWorkbenchOperatorQueueUiHandoffBundle({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueUiAdapterFixturePreview: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_ui_handoff_bundle_status, "valid_block_receipt_workbench_operator_queue_ui_handoff_bundle_pending");
  assert.equal(result.summary.source_p27600_ready_for_p27601_handoff, false);
  assert.equal(result.summary.ready_for_p28001_handoff, false);
  assert.equal(result.receipt_workbench_operator_queue_ui_handoff_bundle_boundary.p28000_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_ui_handoff_bundle_boundary.ready_for_p28001_handoff, false);
  assert.equal(result.p28000_clean_checkpoint_rows.find((row) => row.row_id === "p28000_checkpoint.p28001_handoff_blocker_visible").current_verdict, "pass");
});

test("bundle and adapter rows never serve, mount routes, execute routes, render, click, write, or mutate", async () => {
  const source = await buildP27600Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueUiHandoffBundle({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueUiAdapterFixturePreview: source,
    commitRef: "abc1234",
  });

  assert.ok(result.ui_handoff_bundle_manifest_rows.every((row) => row.server_allowed_now === false));
  assert.ok(result.ui_handoff_bundle_manifest_rows.every((row) => row.route_mount_allowed_now === false));
  assert.ok(result.ui_handoff_bundle_manifest_rows.every((row) => row.render_allowed_now === false));
  assert.ok(result.ui_handoff_bundle_manifest_rows.every((row) => row.browser_run_allowed_now === false));
  assert.ok(result.ui_handoff_bundle_manifest_rows.every((row) => row.click_action_allowed_now === false));
  assert.ok(result.ui_handoff_bundle_manifest_rows.every((row) => row.write_allowed_now === false));
  assert.ok(result.ui_handoff_bundle_manifest_rows.every((row) => row.mutation_enabled === false));
  assert.ok(result.read_only_adapter_manifest_rows.every((row) => row.allowed_methods.join(",") === "GET,HEAD"));
  assert.ok(result.read_only_adapter_manifest_rows.every((row) => row.route_registered_now === false));
  assert.ok(result.read_only_adapter_manifest_rows.every((row) => row.route_execution_allowed_now === false));
  assert.ok(result.read_only_adapter_manifest_rows.every((row) => row.network_fetch_allowed_now === false));
  assert.ok(result.operator_queue_handoff_view_rows.every((row) => row.render_allowed_now === false));
  assert.ok(result.operator_queue_handoff_view_rows.every((row) => row.live_refresh_allowed_now === false));
});

test("review affordances are visible but advisory only", async () => {
  const source = await buildP27600Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueUiHandoffBundle({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueUiAdapterFixturePreview: source,
    commitRef: "abc1234",
  });

  assert.deepEqual([...result.review_affordance_visibility_rows.map((row) => row.affordance_id)].sort(), [
    "blocker_visible",
    "fixture_preview_visible",
    "handoff_status_visible",
    "no_action_notice_visible",
    "redaction_notice_visible",
    "snapshot_ref_visible",
    "source_ref_visible",
    "state_ref_visible",
  ].sort());
  assert.ok(result.review_affordance_visibility_rows.every((row) => row.visible_now === true));
  assert.ok(result.review_affordance_visibility_rows.every((row) => row.advisory_only === true));
  assert.ok(result.review_affordance_visibility_rows.every((row) => row.command_button_enabled_now === false));
  assert.ok(result.review_affordance_visibility_rows.every((row) => row.approve_button_enabled_now === false));
  assert.ok(result.review_affordance_visibility_rows.every((row) => row.closeout_button_enabled_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.receipt_workbench_operator_queue_ui_handoff_bundle_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing UI handoff bundle artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p28000-"));
  try {
    const source = await buildP27600Source({ ready: true });
    const result = await runReceiptWorkbenchOperatorQueueUiHandoffBundle({
      check: true,
      outDir,
      runAt: RUN_AT,
      receiptWorkbenchOperatorQueueUiAdapterFixturePreview: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "receipt-workbench-operator-queue-ui-handoff-bundle.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP27600Source({ ready }) {
  const source = await buildReceiptWorkbenchOperatorQueueUiAdapterFixturePreview({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_p27601_handoff = ready;
  source.summary.source_p27200_ready_for_p27201_handoff = true;
  source.receipt_workbench_operator_queue_ui_adapter_fixture_preview_boundary.ready_for_p27601_handoff = ready;
  source.receipt_workbench_operator_queue_ui_adapter_fixture_preview_boundary.source_p27200_ready_for_p27201_handoff = true;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
