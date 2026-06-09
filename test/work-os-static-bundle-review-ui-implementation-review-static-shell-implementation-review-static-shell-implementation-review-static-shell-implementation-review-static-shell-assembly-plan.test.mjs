import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  STATIC_SHELL_ASSEMBLY_PLAN_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlan,
  runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlan,
} from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-assembly-plan.mjs";
import { buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellCandidate } from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-candidate.mjs";

const RUN_AT = "2026-06-07T22:16:16.001Z";

test("P57200 opens P57201 handoff when P56800 source is ready and assembly plan execution stays closed", async () => {
  const source = await buildP56800Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlan({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-assembly-plan.v1");
  assert.equal(result.program_range, "P56801-P57200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_plan_status, "ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_plan");
  assert.equal(result.summary.ready_for_p57201_handoff, true);
  assert.equal(result.static_shell_assembly_plan_contract_rows.length, 8);
  assert.equal(result.template_composition_manifest_rows.length, 8);
  assert.equal(result.read_only_state_slot_map_rows.length, 8);
  assert.equal(result.accessibility_blocked_copy_guard_rows.length, 8);
  assert.equal(result.no_build_no_render_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_build_no_render_boundary_rows.length >= 1200);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_plan_boundary.p57200_contract_ready, true);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_plan_boundary.ready_for_p57201_handoff, true);

  for (const flag of STATIC_SHELL_ASSEMBLY_PLAN_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_plan_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P57200 remains a valid visible block when P56800 source handoff is not ready", async () => {
  const source = await buildP56800Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlan({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_plan_status, "valid_block_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_plan_pending");
  assert.equal(result.summary.source_p56800_ready_for_p56801_handoff, false);
  assert.equal(result.summary.ready_for_p57201_handoff, false);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_plan_boundary.p57200_contract_ready, true);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_plan_boundary.ready_for_p57201_handoff, false);
  assert.equal(result.p57200_clean_checkpoint_rows.find((row) => row.row_id === "p57200_checkpoint.p57201_handoff_blocker_visible").current_verdict, "pass");
});

test("assembly plan rows never build, write HTML, render DOM, hydrate, run browsers, click, write, or mutate", async () => {
  const source = await buildP56800Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlan({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellCandidate: source,
    commitRef: "abc1234",
  });

  assert.ok(result.static_shell_assembly_plan_contract_rows.every((row) => row.build_allowed_now === false));
  assert.ok(result.static_shell_assembly_plan_contract_rows.every((row) => row.dom_render_allowed_now === false));
  assert.ok(result.static_shell_assembly_plan_contract_rows.every((row) => row.html_file_write_allowed_now === false));
  assert.ok(result.static_shell_assembly_plan_contract_rows.every((row) => row.server_start_allowed_now === false));
  assert.ok(result.static_shell_assembly_plan_contract_rows.every((row) => row.route_registration_allowed_now === false));
  assert.ok(result.static_shell_assembly_plan_contract_rows.every((row) => row.route_execution_allowed_now === false));
  assert.ok(result.static_shell_assembly_plan_contract_rows.every((row) => row.browser_run_allowed_now === false));
  assert.ok(result.static_shell_assembly_plan_contract_rows.every((row) => row.click_action_allowed_now === false));
  assert.ok(result.static_shell_assembly_plan_contract_rows.every((row) => row.write_allowed_now === false));
  assert.ok(result.static_shell_assembly_plan_contract_rows.every((row) => row.state_mutation_allowed_now === false));
  assert.ok(result.template_composition_manifest_rows.every((row) => row.html_file_write_allowed_now === false));
  assert.ok(result.template_composition_manifest_rows.every((row) => row.dom_render_allowed_now === false));
  assert.ok(result.read_only_state_slot_map_rows.every((row) => row.client_hydration_allowed_now === false));
  assert.ok(result.read_only_state_slot_map_rows.every((row) => row.network_fetch_allowed_now === false));
  assert.ok(result.read_only_state_slot_map_rows.every((row) => row.mutating_methods_allowed_now === false));
});

test("accessibility and blocked copy guards are visible but advisory only", async () => {
  const source = await buildP56800Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlan({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellCandidate: source,
    commitRef: "abc1234",
  });

  assert.ok(result.accessibility_blocked_copy_guard_rows.every((row) => row.visible_now === true));
  assert.ok(result.accessibility_blocked_copy_guard_rows.every((row) => row.visible_when_blocked === true));
  assert.ok(result.accessibility_blocked_copy_guard_rows.every((row) => row.advisory_only === true));
  assert.ok(result.accessibility_blocked_copy_guard_rows.every((row) => row.command_button_enabled_now === false));
  assert.ok(result.accessibility_blocked_copy_guard_rows.every((row) => row.approve_button_enabled_now === false));
  assert.ok(result.accessibility_blocked_copy_guard_rows.every((row) => row.closeout_button_enabled_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_plan_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing static shell assembly plan artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p57200-"));
  try {
    const source = await buildP56800Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlan({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellCandidate: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-assembly-plan.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP56800Source({ ready }) {
  const source = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellCandidate({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_p56801_handoff = ready;
  source.summary.source_p56400_ready_for_p56401_handoff = true;
  source.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_candidate_boundary.ready_for_p56801_handoff = ready;
  source.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_candidate_boundary.source_p56400_ready_for_p56401_handoff = true;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
