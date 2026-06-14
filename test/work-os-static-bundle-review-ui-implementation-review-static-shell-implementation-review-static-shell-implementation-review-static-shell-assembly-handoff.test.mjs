import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  STATIC_SHELL_ASSEMBLY_HANDOFF_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff,
  runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff,
} from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-assembly-handoff.mjs";
import { buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlan } from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-assembly-plan.mjs";

const RUN_AT = "2026-06-07T22:36:16.150Z";

test("P52800 opens P52801 handoff when P52400 source is ready and assembly handoff execution stays closed", async () => {
  const source = await buildP52400Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlan: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-assembly-handoff.v1");
  assert.equal(result.program_range, "P52401-P52800");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_status, "ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff");
  assert.equal(result.summary.ready_for_p52801_handoff, true);
  assert.equal(result.assembly_handoff_packet_rows.length, 8);
  assert.equal(result.template_target_map_rows.length, 8);
  assert.equal(result.state_copy_slot_binding_matrix_rows.length, 8);
  assert.equal(result.static_asset_hook_guard_rows.length, 8);
  assert.equal(result.no_apply_no_build_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_apply_no_build_boundary_rows.length >= 1200);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_boundary.p52800_contract_ready, true);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_boundary.ready_for_p52801_handoff, true);

  for (const flag of STATIC_SHELL_ASSEMBLY_HANDOFF_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P52800 remains a valid visible block when P52400 source handoff is not ready", async () => {
  const source = await buildP52400Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlan: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_status, "valid_block_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_pending");
  assert.equal(result.summary.source_p52400_ready_for_p52401_handoff, false);
  assert.equal(result.summary.ready_for_p52801_handoff, false);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_boundary.p52800_contract_ready, true);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_boundary.ready_for_p52801_handoff, false);
  assert.equal(result.p52800_clean_checkpoint_rows.find((row) => row.row_id === "p52800_checkpoint.p52801_handoff_blocker_visible").current_verdict, "pass");
});

test("assembly handoff rows never apply, write files, build, render, hydrate, run browsers, click, write, or mutate", async () => {
  const source = await buildP52400Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlan: source,
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
  const source = await buildP52400Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlan: source,
    commitRef: "abc1234",
  });

  assert.ok(result.state_copy_slot_binding_matrix_rows.every((row) => row.read_only === true));
  assert.ok(result.state_copy_slot_binding_matrix_rows.every((row) => row.advisory_only === true));
  assert.ok(result.state_copy_slot_binding_matrix_rows.every((row) => row.allowed_methods.join(",") === "GET,HEAD"));
  assert.ok(result.state_copy_slot_binding_matrix_rows.every((row) => row.raw_payload_included === false));
  assert.ok(result.state_copy_slot_binding_matrix_rows.every((row) => row.client_hydration_allowed_now === false));
  assert.ok(result.state_copy_slot_binding_matrix_rows.every((row) => row.network_fetch_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing static shell assembly handoff artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p52800-"));
  try {
    const source = await buildP52400Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlan: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-assembly-handoff.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP52400Source({ ready }) {
  const source = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlan({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_p52401_handoff = ready;
  source.summary.source_p52000_ready_for_p52001_handoff = true;
  source.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_plan_boundary.ready_for_p52401_handoff = ready;
  source.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_plan_boundary.source_p52000_ready_for_p52001_handoff = true;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
