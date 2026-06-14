import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  STATIC_SHELL_CANDIDATE_FALSE_FLAGS,
  buildReceiptWorkbenchOperatorQueueStaticShellCandidate,
  runReceiptWorkbenchOperatorQueueStaticShellCandidate,
} from "../src/receipt-workbench-operator-queue-static-shell-candidate.mjs";
import { buildReceiptWorkbenchOperatorQueueStaticShellHandoff } from "../src/receipt-workbench-operator-queue-static-shell-handoff.mjs";

const RUN_AT = "2026-06-07T21:56:15.940Z";

test("P29200 opens P29201 handoff when P28800 source is ready and candidate execution stays closed", async () => {
  const source = await buildP28800Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueStaticShellCandidate({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStaticShellHandoff: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "receipt-workbench-operator-queue-static-shell-candidate.v1");
  assert.equal(result.program_range, "P28801-P29200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_static_shell_candidate_status, "ready_for_receipt_workbench_operator_queue_static_shell_candidate");
  assert.equal(result.summary.ready_for_p29201_handoff, true);
  assert.equal(result.static_shell_candidate_contract_rows.length, 8);
  assert.equal(result.section_template_manifest_rows.length, 8);
  assert.equal(result.fixture_hydration_stub_map_rows.length, 8);
  assert.equal(result.blocked_control_copy_binding_rows.length, 8);
  assert.equal(result.no_serve_no_dom_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_serve_no_dom_boundary_rows.length >= 220);
  assert.equal(result.receipt_workbench_operator_queue_static_shell_candidate_boundary.p29200_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_static_shell_candidate_boundary.ready_for_p29201_handoff, true);

  for (const flag of STATIC_SHELL_CANDIDATE_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.receipt_workbench_operator_queue_static_shell_candidate_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P29200 remains a valid visible block when P28800 source handoff is not ready", async () => {
  const source = await buildP28800Source({ ready: false });
  const result = await buildReceiptWorkbenchOperatorQueueStaticShellCandidate({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStaticShellHandoff: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_static_shell_candidate_status, "valid_block_receipt_workbench_operator_queue_static_shell_candidate_pending");
  assert.equal(result.summary.source_p28800_ready_for_p28801_handoff, false);
  assert.equal(result.summary.ready_for_p29201_handoff, false);
  assert.equal(result.receipt_workbench_operator_queue_static_shell_candidate_boundary.p29200_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_static_shell_candidate_boundary.ready_for_p29201_handoff, false);
  assert.equal(result.p29200_clean_checkpoint_rows.find((row) => row.row_id === "p29200_checkpoint.p29201_handoff_blocker_visible").current_verdict, "pass");
});

test("static shell candidate rows never render, write HTML, hydrate, run browsers, click, write, or mutate", async () => {
  const source = await buildP28800Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueStaticShellCandidate({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStaticShellHandoff: source,
    commitRef: "abc1234",
  });

  assert.ok(result.static_shell_candidate_contract_rows.every((row) => row.dom_render_allowed_now === false));
  assert.ok(result.static_shell_candidate_contract_rows.every((row) => row.html_file_write_allowed_now === false));
  assert.ok(result.static_shell_candidate_contract_rows.every((row) => row.server_start_allowed_now === false));
  assert.ok(result.static_shell_candidate_contract_rows.every((row) => row.route_registration_allowed_now === false));
  assert.ok(result.static_shell_candidate_contract_rows.every((row) => row.route_execution_allowed_now === false));
  assert.ok(result.static_shell_candidate_contract_rows.every((row) => row.browser_run_allowed_now === false));
  assert.ok(result.static_shell_candidate_contract_rows.every((row) => row.click_action_allowed_now === false));
  assert.ok(result.static_shell_candidate_contract_rows.every((row) => row.write_allowed_now === false));
  assert.ok(result.static_shell_candidate_contract_rows.every((row) => row.state_mutation_allowed_now === false));
  assert.ok(result.section_template_manifest_rows.every((row) => row.allowed_methods.join(",") === "GET,HEAD"));
  assert.ok(result.section_template_manifest_rows.every((row) => row.html_file_write_allowed_now === false));
  assert.ok(result.section_template_manifest_rows.every((row) => row.dom_render_allowed_now === false));
  assert.ok(result.fixture_hydration_stub_map_rows.every((row) => row.client_hydration_allowed_now === false));
  assert.ok(result.fixture_hydration_stub_map_rows.every((row) => row.network_fetch_allowed_now === false));
  assert.ok(result.fixture_hydration_stub_map_rows.every((row) => row.mutating_methods_allowed_now === false));
});

test("blocked control copy bindings are visible but advisory only", async () => {
  const source = await buildP28800Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueStaticShellCandidate({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStaticShellHandoff: source,
    commitRef: "abc1234",
  });

  assert.ok(result.blocked_control_copy_binding_rows.every((row) => row.visible_now === true));
  assert.ok(result.blocked_control_copy_binding_rows.every((row) => row.visible_when_blocked === true));
  assert.ok(result.blocked_control_copy_binding_rows.every((row) => row.advisory_only === true));
  assert.ok(result.blocked_control_copy_binding_rows.every((row) => row.command_button_enabled_now === false));
  assert.ok(result.blocked_control_copy_binding_rows.every((row) => row.approve_button_enabled_now === false));
  assert.ok(result.blocked_control_copy_binding_rows.every((row) => row.closeout_button_enabled_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.receipt_workbench_operator_queue_static_shell_candidate_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing static shell candidate artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p29200-"));
  try {
    const source = await buildP28800Source({ ready: true });
    const result = await runReceiptWorkbenchOperatorQueueStaticShellCandidate({
      check: true,
      outDir,
      runAt: RUN_AT,
      receiptWorkbenchOperatorQueueStaticShellHandoff: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "receipt-workbench-operator-queue-static-shell-candidate.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP28800Source({ ready }) {
  const source = await buildReceiptWorkbenchOperatorQueueStaticShellHandoff({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_p28801_handoff = ready;
  source.summary.source_p28400_ready_for_p28401_handoff = true;
  source.receipt_workbench_operator_queue_static_shell_handoff_boundary.ready_for_p28801_handoff = ready;
  source.receipt_workbench_operator_queue_static_shell_handoff_boundary.source_p28400_ready_for_p28401_handoff = true;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
