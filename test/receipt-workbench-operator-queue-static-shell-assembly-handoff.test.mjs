import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  STATIC_SHELL_ASSEMBLY_HANDOFF_FALSE_FLAGS,
  buildReceiptWorkbenchOperatorQueueStaticShellAssemblyHandoff,
  runReceiptWorkbenchOperatorQueueStaticShellAssemblyHandoff,
} from "../src/receipt-workbench-operator-queue-static-shell-assembly-handoff.mjs";
import { buildReceiptWorkbenchOperatorQueueStaticShellAssemblyPlan } from "../src/receipt-workbench-operator-queue-static-shell-assembly-plan.mjs";

const RUN_AT = "2026-06-07T22:36:16.150Z";

test("P30000 opens P30001 handoff when P29600 source is ready and assembly handoff execution stays closed", async () => {
  const source = await buildP29600Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueStaticShellAssemblyHandoff({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStaticShellAssemblyPlan: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "receipt-workbench-operator-queue-static-shell-assembly-handoff.v1");
  assert.equal(result.program_range, "P29601-P30000");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_static_shell_assembly_handoff_status, "ready_for_receipt_workbench_operator_queue_static_shell_assembly_handoff");
  assert.equal(result.summary.ready_for_p30001_handoff, true);
  assert.equal(result.assembly_handoff_packet_rows.length, 8);
  assert.equal(result.template_target_map_rows.length, 8);
  assert.equal(result.state_copy_slot_binding_matrix_rows.length, 8);
  assert.equal(result.static_asset_hook_guard_rows.length, 8);
  assert.equal(result.no_apply_no_build_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_apply_no_build_boundary_rows.length >= 270);
  assert.equal(result.receipt_workbench_operator_queue_static_shell_assembly_handoff_boundary.p30000_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_static_shell_assembly_handoff_boundary.ready_for_p30001_handoff, true);

  for (const flag of STATIC_SHELL_ASSEMBLY_HANDOFF_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.receipt_workbench_operator_queue_static_shell_assembly_handoff_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P30000 remains a valid visible block when P29600 source handoff is not ready", async () => {
  const source = await buildP29600Source({ ready: false });
  const result = await buildReceiptWorkbenchOperatorQueueStaticShellAssemblyHandoff({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStaticShellAssemblyPlan: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_static_shell_assembly_handoff_status, "valid_block_receipt_workbench_operator_queue_static_shell_assembly_handoff_pending");
  assert.equal(result.summary.source_p29600_ready_for_p29601_handoff, false);
  assert.equal(result.summary.ready_for_p30001_handoff, false);
  assert.equal(result.receipt_workbench_operator_queue_static_shell_assembly_handoff_boundary.p30000_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_static_shell_assembly_handoff_boundary.ready_for_p30001_handoff, false);
  assert.equal(result.p30000_clean_checkpoint_rows.find((row) => row.row_id === "p30000_checkpoint.p30001_handoff_blocker_visible").current_verdict, "pass");
});

test("assembly handoff rows never apply, write files, build, render, hydrate, run browsers, click, write, or mutate", async () => {
  const source = await buildP29600Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueStaticShellAssemblyHandoff({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStaticShellAssemblyPlan: source,
    commitRef: "abc1234",
  });

  assert.ok(result.assembly_handoff_packet_rows.every((row) => row.apply_allowed_now === false));
  assert.ok(result.assembly_handoff_packet_rows.every((row) => row.file_write_allowed_now === false));
  assert.ok(result.assembly_handoff_packet_rows.every((row) => row.build_allowed_now === false));
  assert.ok(result.assembly_handoff_packet_rows.every((row) => row.dom_render_allowed_now === false));
  assert.ok(result.assembly_handoff_packet_rows.every((row) => row.client_hydration_allowed_now === false));
  assert.ok(result.assembly_handoff_packet_rows.every((row) => row.click_action_allowed_now === false));
  assert.ok(result.assembly_handoff_packet_rows.every((row) => row.write_allowed_now === false));
  assert.ok(result.assembly_handoff_packet_rows.every((row) => row.state_mutation_allowed_now === false));
  assert.ok(result.template_target_map_rows.every((row) => row.file_write_allowed_now === false));
  assert.ok(result.template_target_map_rows.every((row) => row.template_write_allowed_now === false));
  assert.ok(result.static_asset_hook_guard_rows.every((row) => row.asset_import_allowed_now === false));
  assert.ok(result.static_asset_hook_guard_rows.every((row) => row.asset_build_allowed_now === false));
  assert.ok(result.static_asset_hook_guard_rows.every((row) => row.css_write_allowed_now === false));
});

test("state and copy binding matrix stays read-only and advisory", async () => {
  const source = await buildP29600Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueStaticShellAssemblyHandoff({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStaticShellAssemblyPlan: source,
    commitRef: "abc1234",
  });

  assert.ok(result.state_copy_slot_binding_matrix_rows.every((row) => row.read_only === true));
  assert.ok(result.state_copy_slot_binding_matrix_rows.every((row) => row.advisory_only === true));
  assert.ok(result.state_copy_slot_binding_matrix_rows.every((row) => row.allowed_methods.join(",") === "GET,HEAD"));
  assert.ok(result.state_copy_slot_binding_matrix_rows.every((row) => row.raw_payload_included === false));
  assert.ok(result.state_copy_slot_binding_matrix_rows.every((row) => row.client_hydration_allowed_now === false));
  assert.ok(result.state_copy_slot_binding_matrix_rows.every((row) => row.network_fetch_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.receipt_workbench_operator_queue_static_shell_assembly_handoff_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing static shell assembly handoff artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p30000-"));
  try {
    const source = await buildP29600Source({ ready: true });
    const result = await runReceiptWorkbenchOperatorQueueStaticShellAssemblyHandoff({
      check: true,
      outDir,
      runAt: RUN_AT,
      receiptWorkbenchOperatorQueueStaticShellAssemblyPlan: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "receipt-workbench-operator-queue-static-shell-assembly-handoff.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP29600Source({ ready }) {
  const source = await buildReceiptWorkbenchOperatorQueueStaticShellAssemblyPlan({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_p29601_handoff = ready;
  source.summary.source_p29200_ready_for_p29201_handoff = true;
  source.receipt_workbench_operator_queue_static_shell_assembly_plan_boundary.ready_for_p29601_handoff = ready;
  source.receipt_workbench_operator_queue_static_shell_assembly_plan_boundary.source_p29200_ready_for_p29201_handoff = true;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
