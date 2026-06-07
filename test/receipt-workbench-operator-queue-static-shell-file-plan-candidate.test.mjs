import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  STATIC_SHELL_FILE_PLAN_CANDIDATE_FALSE_FLAGS,
  buildReceiptWorkbenchOperatorQueueStaticShellFilePlanCandidate,
  runReceiptWorkbenchOperatorQueueStaticShellFilePlanCandidate,
} from "../src/receipt-workbench-operator-queue-static-shell-file-plan-candidate.mjs";
import { buildReceiptWorkbenchOperatorQueueStaticShellAssemblyHandoff } from "../src/receipt-workbench-operator-queue-static-shell-assembly-handoff.mjs";

const RUN_AT = "2026-06-07T22:56:16.215Z";

test("P30400 opens P30401 handoff when P30000 source is ready and file plan authority stays closed", async () => {
  const source = await buildP30000Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueStaticShellFilePlanCandidate({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStaticShellAssemblyHandoff: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "receipt-workbench-operator-queue-static-shell-file-plan-candidate.v1");
  assert.equal(result.program_range, "P30001-P30400");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_static_shell_file_plan_candidate_status, "ready_for_receipt_workbench_operator_queue_static_shell_file_plan_candidate");
  assert.equal(result.summary.ready_for_p30401_handoff, true);
  assert.equal(result.static_shell_file_plan_candidate_rows.length, 8);
  assert.equal(result.template_file_target_candidate_rows.length, 8);
  assert.equal(result.state_copy_integration_candidate_rows.length, 8);
  assert.equal(result.asset_token_candidate_rows.length, 8);
  assert.equal(result.no_write_no_build_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_write_no_build_boundary_rows.length >= 300);
  assert.equal(result.receipt_workbench_operator_queue_static_shell_file_plan_candidate_boundary.p30400_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_static_shell_file_plan_candidate_boundary.ready_for_p30401_handoff, true);

  for (const flag of STATIC_SHELL_FILE_PLAN_CANDIDATE_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.receipt_workbench_operator_queue_static_shell_file_plan_candidate_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P30400 remains a valid visible block when P30000 source handoff is not ready", async () => {
  const source = await buildP30000Source({ ready: false });
  const result = await buildReceiptWorkbenchOperatorQueueStaticShellFilePlanCandidate({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStaticShellAssemblyHandoff: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_queue_static_shell_file_plan_candidate_status, "valid_block_receipt_workbench_operator_queue_static_shell_file_plan_candidate_pending");
  assert.equal(result.summary.source_p30000_ready_for_p30001_handoff, false);
  assert.equal(result.summary.ready_for_p30401_handoff, false);
  assert.equal(result.receipt_workbench_operator_queue_static_shell_file_plan_candidate_boundary.p30400_contract_ready, true);
  assert.equal(result.receipt_workbench_operator_queue_static_shell_file_plan_candidate_boundary.ready_for_p30401_handoff, false);
  assert.equal(result.p30400_clean_checkpoint_rows.find((row) => row.row_id === "p30400_checkpoint.p30401_handoff_blocker_visible").current_verdict, "pass");
});

test("file plan candidates never create files, write templates, build, render, hydrate, click, write, or mutate", async () => {
  const source = await buildP30000Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueStaticShellFilePlanCandidate({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStaticShellAssemblyHandoff: source,
    commitRef: "abc1234",
  });

  assert.ok(result.static_shell_file_plan_candidate_rows.every((row) => row.file_create_allowed_now === false));
  assert.ok(result.static_shell_file_plan_candidate_rows.every((row) => row.file_write_allowed_now === false));
  assert.ok(result.static_shell_file_plan_candidate_rows.every((row) => row.template_apply_allowed_now === false));
  assert.ok(result.static_shell_file_plan_candidate_rows.every((row) => row.build_allowed_now === false));
  assert.ok(result.static_shell_file_plan_candidate_rows.every((row) => row.dom_render_allowed_now === false));
  assert.ok(result.static_shell_file_plan_candidate_rows.every((row) => row.client_hydration_allowed_now === false));
  assert.ok(result.static_shell_file_plan_candidate_rows.every((row) => row.click_action_allowed_now === false));
  assert.ok(result.static_shell_file_plan_candidate_rows.every((row) => row.write_allowed_now === false));
  assert.ok(result.static_shell_file_plan_candidate_rows.every((row) => row.state_mutation_allowed_now === false));
  assert.ok(result.template_file_target_candidate_rows.every((row) => row.file_write_allowed_now === false));
  assert.ok(result.template_file_target_candidate_rows.every((row) => row.template_write_allowed_now === false));
  assert.ok(result.asset_token_candidate_rows.every((row) => row.asset_import_allowed_now === false));
  assert.ok(result.asset_token_candidate_rows.every((row) => row.asset_build_allowed_now === false));
  assert.ok(result.asset_token_candidate_rows.every((row) => row.css_write_allowed_now === false));
});

test("state/copy integration candidates stay read-only and advisory", async () => {
  const source = await buildP30000Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorQueueStaticShellFilePlanCandidate({
    runAt: RUN_AT,
    receiptWorkbenchOperatorQueueStaticShellAssemblyHandoff: source,
    commitRef: "abc1234",
  });

  assert.ok(result.state_copy_integration_candidate_rows.every((row) => row.read_only === true));
  assert.ok(result.state_copy_integration_candidate_rows.every((row) => row.advisory_only === true));
  assert.ok(result.state_copy_integration_candidate_rows.every((row) => row.allowed_methods.join(",") === "GET,HEAD"));
  assert.ok(result.state_copy_integration_candidate_rows.every((row) => row.raw_payload_included === false));
  assert.ok(result.state_copy_integration_candidate_rows.every((row) => row.client_hydration_allowed_now === false));
  assert.ok(result.state_copy_integration_candidate_rows.every((row) => row.network_fetch_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.receipt_workbench_operator_queue_static_shell_file_plan_candidate_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing static shell file plan candidate artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p30400-"));
  try {
    const source = await buildP30000Source({ ready: true });
    const result = await runReceiptWorkbenchOperatorQueueStaticShellFilePlanCandidate({
      check: true,
      outDir,
      runAt: RUN_AT,
      receiptWorkbenchOperatorQueueStaticShellAssemblyHandoff: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "receipt-workbench-operator-queue-static-shell-file-plan-candidate.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP30000Source({ ready }) {
  const source = await buildReceiptWorkbenchOperatorQueueStaticShellAssemblyHandoff({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_p30001_handoff = ready;
  source.summary.source_p29600_ready_for_p29601_handoff = true;
  source.receipt_workbench_operator_queue_static_shell_assembly_handoff_boundary.ready_for_p30001_handoff = ready;
  source.receipt_workbench_operator_queue_static_shell_assembly_handoff_boundary.source_p29600_ready_for_p29601_handoff = true;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
