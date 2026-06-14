import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  STATIC_SHELL_HANDOFF_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellHandoff,
  runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellHandoff,
} from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-handoff.mjs";
import { buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewLocalUiBindingSmoke } from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-local-ui-binding-smoke.mjs";

const RUN_AT = "2026-06-07T21:36:15.872Z";

test("P46800 opens P46801 handoff when P46400 source is ready and static shell execution stays closed", async () => {
  const source = await buildP46400Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellHandoff({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewLocalUiBindingSmoke: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-handoff.v1");
  assert.equal(result.program_range, "P46401-P46800");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_status, "ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff");
  assert.equal(result.summary.ready_for_p46801_handoff, true);
  assert.equal(result.static_shell_handoff_contract_rows.length, 8);
  assert.equal(result.shell_section_binding_map_rows.length, 8);
  assert.equal(result.fixture_slot_projection_rows.length, 8);
  assert.equal(result.blocked_state_copy_surface_rows.length, 8);
  assert.equal(result.no_serve_no_render_authority_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_serve_no_render_authority_rows.length >= 1200);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_boundary.p46800_contract_ready, true);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_boundary.ready_for_p46801_handoff, true);

  for (const flag of STATIC_SHELL_HANDOFF_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P46800 remains a valid visible block when P46400 source handoff is not ready", async () => {
  const source = await buildP46400Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellHandoff({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewLocalUiBindingSmoke: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_status, "valid_block_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_pending");
  assert.equal(result.summary.source_p46400_ready_for_p46401_handoff, false);
  assert.equal(result.summary.ready_for_p46801_handoff, false);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_boundary.p46800_contract_ready, true);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_boundary.ready_for_p46801_handoff, false);
  assert.equal(result.p46800_clean_checkpoint_rows.find((row) => row.row_id === "p46800_checkpoint.p46801_handoff_blocker_visible").current_verdict, "pass");
});

test("static shell rows never start servers, register routes, render DOM, run browsers, click, write, or mutate", async () => {
  const source = await buildP46400Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellHandoff({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewLocalUiBindingSmoke: source,
    commitRef: "abc1234",
  });

  assert.ok(result.static_shell_handoff_contract_rows.every((row) => row.server_start_allowed_now === false));
  assert.ok(result.static_shell_handoff_contract_rows.every((row) => row.route_registration_allowed_now === false));
  assert.ok(result.static_shell_handoff_contract_rows.every((row) => row.route_mount_allowed_now === false));
  assert.ok(result.static_shell_handoff_contract_rows.every((row) => row.route_execution_allowed_now === false));
  assert.ok(result.static_shell_handoff_contract_rows.every((row) => row.dom_render_allowed_now === false));
  assert.ok(result.static_shell_handoff_contract_rows.every((row) => row.browser_run_allowed_now === false));
  assert.ok(result.static_shell_handoff_contract_rows.every((row) => row.click_action_allowed_now === false));
  assert.ok(result.static_shell_handoff_contract_rows.every((row) => row.write_allowed_now === false));
  assert.ok(result.static_shell_handoff_contract_rows.every((row) => row.state_mutation_allowed_now === false));
  assert.ok(result.shell_section_binding_map_rows.every((row) => row.allowed_methods.join(",") === "GET,HEAD"));
  assert.ok(result.shell_section_binding_map_rows.every((row) => row.html_file_write_allowed_now === false));
  assert.ok(result.shell_section_binding_map_rows.every((row) => row.dom_render_allowed_now === false));
  assert.ok(result.fixture_slot_projection_rows.every((row) => row.network_fetch_allowed_now === false));
  assert.ok(result.fixture_slot_projection_rows.every((row) => row.mutating_methods_allowed_now === false));
});

test("blocked copy surface is visible but advisory only", async () => {
  const source = await buildP46400Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellHandoff({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewLocalUiBindingSmoke: source,
    commitRef: "abc1234",
  });

  assert.ok(result.blocked_state_copy_surface_rows.every((row) => row.visible_now === true));
  assert.ok(result.blocked_state_copy_surface_rows.every((row) => row.visible_when_blocked === true));
  assert.ok(result.blocked_state_copy_surface_rows.every((row) => row.advisory_only === true));
  assert.ok(result.blocked_state_copy_surface_rows.every((row) => row.command_button_enabled_now === false));
  assert.ok(result.blocked_state_copy_surface_rows.every((row) => row.approve_button_enabled_now === false));
  assert.ok(result.blocked_state_copy_surface_rows.every((row) => row.closeout_button_enabled_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing static shell handoff artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p46800-"));
  try {
    const source = await buildP46400Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellHandoff({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewLocalUiBindingSmoke: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-handoff.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP46400Source({ ready }) {
  const source = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewLocalUiBindingSmoke({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_p46401_handoff = ready;
  source.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_local_ui_binding_smoke_boundary.ready_for_p46401_handoff = ready;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
