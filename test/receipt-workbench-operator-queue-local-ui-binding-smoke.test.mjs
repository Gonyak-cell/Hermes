import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  LOCAL_UI_BINDING_FALSE_FLAGS,
  buildReceiptWorkbenchOperatorQueueLocalUiBindingSmoke,
  runReceiptWorkbenchOperatorQueueLocalUiBindingSmoke,
} from "../src/receipt-workbench-operator-queue-local-ui-binding-smoke.mjs";
import { buildReceiptWorkbenchOperatorQueueUiHandoffBundle } from "../src/receipt-workbench-operator-queue-ui-handoff-bundle.mjs";

const RUN_AT = "2026-06-07T21:16:15.752Z";

test("P28400 opens P28401 handoff when P28000 source is ready and local UI execution stays closed", async () => {
  const source = await buildP28000Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueLocalUiBindingSmoke({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueUiHandoffBundle: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "receipt-workbench-operator-queue-local-ui-binding-smoke.v1");
  assert.equal(result.program_range, "P28001-P28400");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_local_ui_binding_smoke_status, "ready_for_receipt_workbench_operator_queue_local_ui_binding_smoke");
  assert.equal(result.summary.ready_for_p28401_handoff, true);
  assert.equal(result.local_ui_binding_smoke_rows.length, 8);
  assert.equal(result.static_shell_binding_map_rows.length, 8);
  assert.equal(result.get_only_fixture_fetch_contract_rows.length, 8);
  assert.equal(result.visible_blocker_no_action_rows.length, 8);
  assert.equal(result.no_server_no_browser_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_server_no_browser_boundary_rows.length >= 180);
  assert.equal(result.receipt_workbench_operator_queue_local_ui_binding_smoke_boundary.p28400_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_local_ui_binding_smoke_boundary.ready_for_p28401_handoff, true);

  for (const flag of LOCAL_UI_BINDING_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.receipt_workbench_operator_queue_local_ui_binding_smoke_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P28400 remains a valid visible block when P28000 source handoff is not ready", async () => {
  const source = await buildP28000Source({ ready: false });
  const result = await buildReceiptWorkbenchOperatorQueueLocalUiBindingSmoke({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueUiHandoffBundle: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_local_ui_binding_smoke_status, "valid_block_receipt_workbench_operator_queue_local_ui_binding_smoke_pending");
  assert.equal(result.summary.source_p28000_ready_for_p28001_handoff, false);
  assert.equal(result.summary.ready_for_p28401_handoff, false);
  assert.equal(result.receipt_workbench_operator_queue_local_ui_binding_smoke_boundary.p28400_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_local_ui_binding_smoke_boundary.ready_for_p28401_handoff, false);
  assert.equal(result.p28400_clean_checkpoint_rows.find((row) => row.row_id === "p28400_checkpoint.p28401_handoff_blocker_visible").current_verdict, "pass");
});

test("local UI binding rows never start servers, register routes, render DOM, run browsers, click, write, or mutate", async () => {
  const source = await buildP28000Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueLocalUiBindingSmoke({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueUiHandoffBundle: source,
    commitRef: "abc1234",
  });

  assert.ok(result.local_ui_binding_smoke_rows.every((row) => row.server_start_allowed_now === false));
  assert.ok(result.local_ui_binding_smoke_rows.every((row) => row.route_registration_allowed_now === false));
  assert.ok(result.local_ui_binding_smoke_rows.every((row) => row.route_mount_allowed_now === false));
  assert.ok(result.local_ui_binding_smoke_rows.every((row) => row.route_execution_allowed_now === false));
  assert.ok(result.local_ui_binding_smoke_rows.every((row) => row.dom_render_allowed_now === false));
  assert.ok(result.local_ui_binding_smoke_rows.every((row) => row.browser_run_allowed_now === false));
  assert.ok(result.local_ui_binding_smoke_rows.every((row) => row.click_action_allowed_now === false));
  assert.ok(result.local_ui_binding_smoke_rows.every((row) => row.write_allowed_now === false));
  assert.ok(result.local_ui_binding_smoke_rows.every((row) => row.state_mutation_allowed_now === false));
  assert.ok(result.static_shell_binding_map_rows.every((row) => row.allowed_methods.join(",") === "GET,HEAD"));
  assert.ok(result.static_shell_binding_map_rows.every((row) => row.html_file_write_allowed_now === false));
  assert.ok(result.static_shell_binding_map_rows.every((row) => row.dom_render_allowed_now === false));
  assert.ok(result.static_shell_binding_map_rows.every((row) => row.route_execution_allowed_now === false));
  assert.ok(result.get_only_fixture_fetch_contract_rows.every((row) => row.network_fetch_allowed_now === false));
  assert.ok(result.get_only_fixture_fetch_contract_rows.every((row) => row.mutating_methods_allowed_now === false));
});

test("visible blocker and no-action rows are advisory only", async () => {
  const source = await buildP28000Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueLocalUiBindingSmoke({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueUiHandoffBundle: source,
    commitRef: "abc1234",
  });

  assert.ok(result.visible_blocker_no_action_rows.every((row) => row.visible_now === true));
  assert.ok(result.visible_blocker_no_action_rows.every((row) => row.blocker_visible_now === true));
  assert.ok(result.visible_blocker_no_action_rows.every((row) => row.no_action_notice_visible_now === true));
  assert.ok(result.visible_blocker_no_action_rows.every((row) => row.advisory_only === true));
  assert.ok(result.visible_blocker_no_action_rows.every((row) => row.command_button_enabled_now === false));
  assert.ok(result.visible_blocker_no_action_rows.every((row) => row.approve_button_enabled_now === false));
  assert.ok(result.visible_blocker_no_action_rows.every((row) => row.closeout_button_enabled_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.receipt_workbench_operator_queue_local_ui_binding_smoke_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing local UI binding smoke artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p28400-"));
  try {
    const source = await buildP28000Source({ ready: true });
    const result = await runReceiptWorkbenchOperatorQueueLocalUiBindingSmoke({
      check: true,
      outDir,
      runAt: RUN_AT,
      receiptWorkbenchOperatorQueueUiHandoffBundle: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "receipt-workbench-operator-queue-local-ui-binding-smoke.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP28000Source({ ready }) {
  const source = await buildReceiptWorkbenchOperatorQueueUiHandoffBundle({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_p28001_handoff = ready;
  source.summary.source_p27600_ready_for_p27601_handoff = true;
  source.receipt_workbench_operator_queue_ui_handoff_bundle_boundary.ready_for_p28001_handoff = ready;
  source.receipt_workbench_operator_queue_ui_handoff_bundle_boundary.source_p27600_ready_for_p27601_handoff = true;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
