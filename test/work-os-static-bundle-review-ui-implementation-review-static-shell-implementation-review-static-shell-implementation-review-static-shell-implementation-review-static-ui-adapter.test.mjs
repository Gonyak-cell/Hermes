import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_UI_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticUiAdapter,
  runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticUiAdapter,
} from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-ui-adapter.mjs";
import { buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewApiReadModel } from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-api-read-model.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P55200 opens static review UI handoff when P54800 source is ready", async () => {
  const source = await buildP54800Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticUiAdapter({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-ui-adapter.v1");
  assert.equal(result.program_range, "P54801-P55200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_status, "ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_adapter");
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_handoff, true);
  assert.equal(result.static_bundle_review_ui_implementation_review_static_ui_adapter_candidate_rows.length, 8);
  assert.equal(result.implementation_review_screen_slot_contract_rows.length, 8);
  assert.equal(result.implementation_review_static_shell_fixture_rows.length, 8);
  assert.equal(result.implementation_review_interaction_smoke_rows.length, 24);
  assert.ok(result.no_live_ui_receipt_accept_boundary_rows.length >= 1200);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_boundary.p55200_contract_ready, true);

  for (const flag of WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_UI_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P55200 remains a valid visible block when P54800 handoff is not ready", async () => {
  const source = await buildP54800Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticUiAdapter({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_status, "valid_block_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_adapter_pending");
  assert.equal(result.summary.source_p54800_ready_for_static_review_ui, false);
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_handoff, false);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_boundary.p55200_contract_ready, true);
  assert.equal(result.p55200_clean_checkpoint_rows.find((row) => row.row_id === "p55200_checkpoint.receipt_accept_blocked").current_verdict, "pass");
});

test("static review UI adapter and screen slots never become live UI authority", async () => {
  const source = await buildP54800Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticUiAdapter({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.live_mount_allowed_count, 0);
  assert.equal(result.summary.route_navigation_allowed_count, 0);
  assert.ok(result.static_bundle_review_ui_implementation_review_static_ui_adapter_candidate_rows.every((row) => row.adapter_visible_now === true));
  assert.ok(result.static_bundle_review_ui_implementation_review_static_ui_adapter_candidate_rows.every((row) => row.live_mount_allowed_now === false));
  assert.ok(result.static_bundle_review_ui_implementation_review_static_ui_adapter_candidate_rows.every((row) => row.runtime_fetch_allowed_now === false));
  assert.ok(result.static_bundle_review_ui_implementation_review_static_ui_adapter_candidate_rows.every((row) => row.generated_file_write_allowed_now === false));
  assert.ok(result.implementation_review_screen_slot_contract_rows.every((row) => row.slot_binding_visible_now === true));
  assert.ok(result.implementation_review_screen_slot_contract_rows.every((row) => row.route_navigation_allowed_now === false));
  assert.ok(result.implementation_review_screen_slot_contract_rows.every((row) => row.live_browser_required_now === false));
});

test("static review UI never mutates state, accepts receipts, or dispatches reviewers", async () => {
  const source = await buildP54800Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticUiAdapter({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.state_persist_allowed_count, 0);
  assert.equal(result.summary.event_mutation_allowed_count, 0);
  assert.equal(result.summary.receipt_accept_allowed_count, 0);
  assert.equal(result.summary.reviewer_dispatch_allowed_count, 0);
  assert.ok(result.implementation_review_static_shell_fixture_rows.every((row) => row.fixture_visible_now === true));
  assert.ok(result.implementation_review_static_shell_fixture_rows.every((row) => row.state_persist_allowed_now === false));
  assert.ok(result.implementation_review_static_shell_fixture_rows.every((row) => row.form_submit_allowed_now === false));
  assert.ok(result.implementation_review_static_shell_fixture_rows.every((row) => row.write_api_allowed_now === false));
  assert.ok(result.implementation_review_static_shell_fixture_rows.every((row) => row.review_receipt_accept_allowed_now === false));
  assert.ok(result.implementation_review_interaction_smoke_rows.every((row) => row.smoke_visible_now === true));
  assert.ok(result.implementation_review_interaction_smoke_rows.every((row) => row.event_handler_mutation_allowed_now === false));
  assert.ok(result.implementation_review_interaction_smoke_rows.every((row) => row.action_button_allowed_now === false));
  assert.ok(result.implementation_review_interaction_smoke_rows.every((row) => row.status_edit_allowed_now === false));
  assert.ok(result.implementation_review_interaction_smoke_rows.every((row) => row.review_receipt_accept_allowed_now === false));
  assert.ok(result.implementation_review_interaction_smoke_rows.every((row) => row.reviewer_lane_dispatch_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing static review UI artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p55200-"));
  try {
    const source = await buildP54800Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticUiAdapter({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-ui-adapter.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP54800Source({ ready }) {
  const source = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewApiReadModel({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_api_handoff = ready;
  source.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_api_boundary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_api_handoff = ready;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
