import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_BINDING_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationBindingCandidate,
  runWorkOsStaticBundleReviewUiImplementationBindingCandidate,
} from "../src/work-os-static-bundle-review-ui-implementation-binding-candidate.mjs";
import { ALL_FALSE_FLAGS as P38800_FALSE_FLAGS } from "../src/work-os-static-bundle-review-ui-handoff-bundle.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P39200 opens implementation binding candidate when P38800 source is ready", async () => {
  const source = buildP38800Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationBindingCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiHandoffBundle: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-ui-implementation-binding-candidate.v1");
  assert.equal(result.program_range, "P38801-P39200");
  assert.equal(result.source_program_range, "P38401-P38800");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_binding_status, "ready_for_work_os_static_bundle_review_ui_implementation_binding_candidate");
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_implementation_binding_handoff, true);
  assert.equal(result.summary.source_p38800_ready_for_implementation_binding, true);
  assert.equal(result.implementation_file_plan_candidate_rows.length, 3);
  assert.equal(result.component_binding_candidate_rows.length, 3);
  assert.equal(result.read_only_data_binding_candidate_rows.length, 3);
  assert.equal(result.visual_token_binding_candidate_rows.length, 3);
  assert.ok(result.no_file_apply_no_build_boundary_rows.length >= 850);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_binding_boundary.p39200_contract_ready, true);

  for (const flag of WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_BINDING_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_ui_implementation_binding_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P39200 remains a valid visible block when P38800 handoff is not ready", async () => {
  const source = buildP38800Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewUiImplementationBindingCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiHandoffBundle: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_binding_status, "valid_block_work_os_static_bundle_review_ui_implementation_binding_candidate_pending");
  assert.equal(result.summary.source_p38800_ready_for_implementation_binding, false);
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_implementation_binding_handoff, false);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_binding_boundary.p39200_contract_ready, true);
  assert.equal(result.p39200_clean_checkpoint_rows.find((row) => row.row_id === "p39200_checkpoint.file_write_blocked").current_verdict, "pass");
});

test("implementation binding candidate never creates, writes, applies, or templates files", async () => {
  const source = buildP38800Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationBindingCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiHandoffBundle: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.file_write_allowed_count, 0);
  assert.equal(result.summary.template_apply_allowed_count, 0);
  assert.ok(result.implementation_file_plan_candidate_rows.every((row) => row.file_create_allowed_now === false));
  assert.ok(result.implementation_file_plan_candidate_rows.every((row) => row.file_write_allowed_now === false));
  assert.ok(result.implementation_file_plan_candidate_rows.every((row) => row.file_apply_allowed_now === false));
  assert.ok(result.implementation_file_plan_candidate_rows.every((row) => row.generated_file_apply_allowed_now === false));
  assert.ok(result.component_binding_candidate_rows.every((row) => row.template_apply_allowed_now === false));
  assert.ok(result.component_binding_candidate_rows.every((row) => row.template_write_allowed_now === false));
  assert.ok(result.component_binding_candidate_rows.every((row) => row.component_write_allowed_now === false));
  assert.ok(result.component_binding_candidate_rows.every((row) => row.css_write_allowed_now === false));
});

test("implementation binding candidate never builds, fetches, accepts receipts, or approves", async () => {
  const source = buildP38800Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationBindingCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiHandoffBundle: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.build_allowed_count, 0);
  assert.equal(result.summary.runtime_fetch_allowed_count, 0);
  assert.equal(result.summary.receipt_accept_allowed_count, 0);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.ok(result.read_only_data_binding_candidate_rows.every((row) => row.network_fetch_allowed_now === false));
  assert.ok(result.read_only_data_binding_candidate_rows.every((row) => row.runtime_fetch_allowed_now === false));
  assert.ok(result.read_only_data_binding_candidate_rows.every((row) => row.raw_payload_exposure_allowed_now === false));
  assert.ok(result.visual_token_binding_candidate_rows.every((row) => row.asset_build_allowed_now === false));
  assert.ok(result.visual_token_binding_candidate_rows.every((row) => row.live_render_allowed_now === false));
  assert.ok(result.visual_token_binding_candidate_rows.every((row) => row.browser_smoke_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_static_bundle_review_ui_implementation_binding_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing implementation binding artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p39200-"));
  try {
    const source = buildP38800Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewUiImplementationBindingCandidate({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleReviewUiHandoffBundle: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-ui-implementation-binding-candidate.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

function buildP38800Source({ ready }) {
  const requests = ["req.product_contract", "req.project_control_plane", "req.commercial_spec"];
  const manifestRows = requests.map((requestId) => ({
    row_id: `static_review_ui_handoff_manifest.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    handoff_manifest_ref: `work_os.static_bundle_review.ui_handoff.${requestId}.manifest`,
    route_path: `/api/work-os/static-bundle-review/${requestId}`,
    expected_status: "blocked_review_packet_candidate_ready",
    manifest_visible_now: true,
    server_allowed_now: false,
    route_mount_allowed_now: false,
    live_render_allowed_now: false,
    receipt_accept_allowed_now: false,
  }));
  const screenPackageRows = requests.map((requestId) => ({
    row_id: `read_only_review_screen_package.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    screen_package_ref: `work_os.static_bundle_review.ui_handoff.${requestId}.screen_package`,
    screen_id: "work_os.static_bundle_review.static_shell",
    slot_id: `static_bundle_review_card.${requestId}`,
    route_path: `/api/work-os/static-bundle-review/${requestId}`,
    allowed_methods: ["GET"],
    expected_status: "blocked_review_packet_candidate_ready",
    package_visible_now: true,
    live_render_allowed_now: false,
    browser_run_allowed_now: false,
    html_file_write_allowed_now: false,
    state_persist_allowed_now: false,
    form_submit_allowed_now: false,
    review_receipt_accept_allowed_now: false,
  }));
  const operatorRows = requests.map((requestId) => ({
    row_id: `operator_review_handoff_view.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    operator_view_ref: `work_os.static_bundle_review.ui_handoff.${requestId}.operator_view`,
    screen_package_ref: `work_os.static_bundle_review.ui_handoff.${requestId}.screen_package`,
    interaction_smoke_count: 3,
    handoff_view_visible_now: true,
    interactive_control_enabled_now: false,
    command_button_enabled_now: false,
    approve_button_enabled_now: false,
    closeout_button_enabled_now: false,
    reviewer_lane_dispatch_allowed_now: false,
    receipt_accept_allowed_now: false,
  }));
  const affordanceRows = requests.flatMap((requestId) => [
    "view_review_packet",
    "view_findings",
    "view_evidence_refs",
    "view_missing_receipts",
    "view_disabled_review_controls",
    "view_handoff_boundary",
  ].map((affordanceType) => ({
    row_id: `review_handoff_affordance_visibility.${requestId}.${affordanceType}`,
    request_id: requestId,
    current_verdict: "pass",
    affordance_type: affordanceType,
    affordance_visible_now: true,
    click_action_allowed_now: false,
    review_receipt_accept_allowed_now: false,
    reviewer_lane_dispatch_allowed_now: false,
  })));

  return {
    schema_version: "work-os-static-bundle-review-ui-handoff-bundle.v1",
    generated_at: RUN_AT,
    capability_id: "platform.work_os_static_bundle_review_ui_handoff_bundle",
    program_range: "P38401-P38800",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      work_os_static_bundle_review_ui_handoff_status: ready
        ? "ready_for_work_os_static_bundle_review_ui_handoff_bundle"
        : "valid_block_work_os_static_bundle_review_ui_handoff_bundle_pending",
      ready_for_work_os_static_bundle_review_ui_handoff_bundle: ready,
    },
    work_os_static_bundle_review_ui_handoff_boundary: {
      p38800_contract_ready: true,
      ready_for_work_os_static_bundle_review_ui_handoff_bundle: ready,
      static_review_ui_handoff_manifest_visible_now: true,
      read_only_review_screen_package_visible_now: true,
      operator_review_handoff_view_visible_now: true,
      review_handoff_affordance_visibility_now: true,
      no_serve_no_receipt_accept_boundary_closed_now: true,
      work_os_static_bundle_review_ui_handoff_wiring_complete_now: true,
      ...Object.fromEntries(P38800_FALSE_FLAGS.map((flag) => [flag, false])),
    },
    static_review_ui_handoff_manifest_rows: manifestRows,
    read_only_review_screen_package_rows: screenPackageRows,
    operator_review_handoff_view_rows: operatorRows,
    review_handoff_affordance_visibility_rows: affordanceRows,
  };
}
