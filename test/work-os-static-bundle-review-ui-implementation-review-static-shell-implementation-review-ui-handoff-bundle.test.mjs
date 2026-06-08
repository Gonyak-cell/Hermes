import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_UI_HANDOFF_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewUiHandoffBundle,
  runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewUiHandoffBundle,
} from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-ui-handoff-bundle.mjs";
import { buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticUiAdapter } from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-ui-adapter.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P46000 opens review UI handoff bundle when P45600 source is ready", async () => {
  const source = await buildP45600Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewUiHandoffBundle({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticUiAdapter: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-ui-handoff-bundle.v1");
  assert.equal(result.program_range, "P45601-P46000");
  assert.equal(result.source_program_range, "P45201-P45600");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_ui_handoff_status, "ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_ui_handoff_bundle");
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_ui_handoff_bundle, true);
  assert.equal(result.implementation_review_ui_handoff_manifest_rows.length, 8);
  assert.equal(result.implementation_review_read_only_screen_package_rows.length, 8);
  assert.equal(result.implementation_review_operator_handoff_view_rows.length, 8);
  assert.equal(result.implementation_review_handoff_affordance_visibility_rows.length, 48);
  assert.ok(result.no_serve_no_receipt_accept_boundary_rows.length >= 1200);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_ui_handoff_boundary.p46000_contract_ready, true);

  for (const flag of WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_UI_HANDOFF_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_ui_handoff_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P46000 remains a valid visible block when P45600 handoff is not ready", async () => {
  const source = await buildP45600Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewUiHandoffBundle({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticUiAdapter: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_ui_handoff_status, "valid_block_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_ui_handoff_bundle_pending");
  assert.equal(result.summary.source_p45600_ready_for_ui_handoff_bundle, false);
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_ui_handoff_bundle, false);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_ui_handoff_boundary.p46000_contract_ready, true);
  assert.equal(result.p46000_clean_checkpoint_rows.find((row) => row.row_id === "p46000_checkpoint.receipt_accept_blocked").current_verdict, "pass");
});

test("review UI handoff bundle never serves, renders, persists, or enables controls", async () => {
  const source = await buildP45600Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewUiHandoffBundle({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticUiAdapter: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.server_allowed_count, 0);
  assert.equal(result.summary.render_allowed_count, 0);
  assert.equal(result.summary.state_persist_allowed_count, 0);
  assert.equal(result.summary.interactive_control_enabled_count, 0);
  assert.ok(result.implementation_review_ui_handoff_manifest_rows.every((row) => row.manifest_visible_now === true));
  assert.ok(result.implementation_review_ui_handoff_manifest_rows.every((row) => row.server_allowed_now === false));
  assert.ok(result.implementation_review_ui_handoff_manifest_rows.every((row) => row.route_mount_allowed_now === false));
  assert.ok(result.implementation_review_read_only_screen_package_rows.every((row) => row.package_visible_now === true));
  assert.ok(result.implementation_review_read_only_screen_package_rows.every((row) => row.live_render_allowed_now === false));
  assert.ok(result.implementation_review_read_only_screen_package_rows.every((row) => row.html_file_write_allowed_now === false));
  assert.ok(result.implementation_review_operator_handoff_view_rows.every((row) => row.interactive_control_enabled_now === false));
  assert.ok(result.implementation_review_operator_handoff_view_rows.every((row) => row.command_button_enabled_now === false));
  assert.ok(result.implementation_review_operator_handoff_view_rows.every((row) => row.approve_button_enabled_now === false));
  assert.ok(result.implementation_review_operator_handoff_view_rows.every((row) => row.closeout_button_enabled_now === false));
});

test("review UI handoff bundle never accepts receipts or dispatches reviewers", async () => {
  const source = await buildP45600Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewUiHandoffBundle({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticUiAdapter: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.receipt_accept_allowed_count, 0);
  assert.equal(result.summary.reviewer_dispatch_allowed_count, 0);
  assert.ok(result.implementation_review_handoff_affordance_visibility_rows.every((row) => row.affordance_visible_now === true));
  assert.ok(result.implementation_review_handoff_affordance_visibility_rows.every((row) => row.click_action_allowed_now === false));
  assert.ok(result.implementation_review_handoff_affordance_visibility_rows.every((row) => row.review_receipt_accept_allowed_now === false));
  assert.ok(result.implementation_review_handoff_affordance_visibility_rows.every((row) => row.reviewer_lane_dispatch_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_ui_handoff_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing review UI handoff artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p46000-"));
  try {
    const source = await buildP45600Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewUiHandoffBundle({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticUiAdapter: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-ui-handoff-bundle.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP45600Source({ ready }) {
  const source = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticUiAdapter({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_ui_status = ready
    ? "ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_ui_adapter"
    : "valid_block_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_ui_adapter_pending";
  source.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_ui_handoff = ready;
  source.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_ui_boundary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_ui_handoff = ready;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
