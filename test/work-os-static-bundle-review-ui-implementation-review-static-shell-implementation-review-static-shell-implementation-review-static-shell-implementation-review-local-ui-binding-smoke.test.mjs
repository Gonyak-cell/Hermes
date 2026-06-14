import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  LOCAL_UI_BINDING_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewLocalUiBindingSmoke,
  runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewLocalUiBindingSmoke,
} from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-local-ui-binding-smoke.mjs";
import { buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewUiHandoffBundle } from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-ui-handoff-bundle.mjs";

const RUN_AT = "2026-06-07T21:16:15.752Z";

test("P56000 opens P56001 handoff when P55600 source is ready and local UI execution stays closed", async () => {
  const source = await buildP55600Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewLocalUiBindingSmoke({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewUiHandoffBundle: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-local-ui-binding-smoke.v1");
  assert.equal(result.program_range, "P55601-P56000");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_local_ui_binding_smoke_status, "ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_local_ui_binding_smoke");
  assert.equal(result.summary.ready_for_p56001_handoff, true);
  assert.equal(result.local_ui_binding_smoke_rows.length, 8);
  assert.equal(result.static_shell_binding_map_rows.length, 8);
  assert.equal(result.get_only_fixture_fetch_contract_rows.length, 8);
  assert.equal(result.visible_blocker_no_action_rows.length, 8);
  assert.equal(result.no_server_no_browser_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_server_no_browser_boundary_rows.length >= 1200);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_local_ui_binding_smoke_boundary.p56000_contract_ready, true);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_local_ui_binding_smoke_boundary.ready_for_p56001_handoff, true);

  for (const flag of LOCAL_UI_BINDING_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_local_ui_binding_smoke_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P56000 remains a valid visible block when P55600 source handoff is not ready", async () => {
  const source = await buildP55600Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewLocalUiBindingSmoke({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewUiHandoffBundle: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_local_ui_binding_smoke_status, "valid_block_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_local_ui_binding_smoke_pending");
  assert.equal(result.summary.source_p55600_ready_for_p55601_handoff, false);
  assert.equal(result.summary.ready_for_p56001_handoff, false);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_local_ui_binding_smoke_boundary.p56000_contract_ready, true);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_local_ui_binding_smoke_boundary.ready_for_p56001_handoff, false);
  assert.equal(result.p56000_clean_checkpoint_rows.find((row) => row.row_id === "p56000_checkpoint.p56001_handoff_blocker_visible").current_verdict, "pass");
});

test("local UI binding rows never start servers, register routes, render DOM, run browsers, click, write, or mutate", async () => {
  const source = await buildP55600Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewLocalUiBindingSmoke({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewUiHandoffBundle: source,
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
  const source = await buildP55600Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewLocalUiBindingSmoke({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewUiHandoffBundle: source,
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
    assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_local_ui_binding_smoke_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing local UI binding smoke artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p56000-"));
  try {
    const source = await buildP55600Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewLocalUiBindingSmoke({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewUiHandoffBundle: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-local-ui-binding-smoke.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP55600Source({ ready }) {
  const source = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewUiHandoffBundle({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_ui_handoff_bundle = ready;
  source.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_ui_handoff_boundary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_ui_handoff_bundle = ready;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
