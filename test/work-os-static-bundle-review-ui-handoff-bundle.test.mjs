import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  WORK_OS_STATIC_BUNDLE_REVIEW_UI_HANDOFF_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiHandoffBundle,
  runWorkOsStaticBundleReviewUiHandoffBundle,
} from "../src/work-os-static-bundle-review-ui-handoff-bundle.mjs";
import { ALL_FALSE_FLAGS as P38400_FALSE_FLAGS } from "../src/work-os-static-bundle-review-static-ui-adapter.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P38800 opens review UI handoff bundle when P38400 source is ready", async () => {
  const source = buildP38400Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiHandoffBundle({
    runAt: RUN_AT,
    workOsStaticBundleReviewStaticUiAdapter: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-ui-handoff-bundle.v1");
  assert.equal(result.program_range, "P38401-P38800");
  assert.equal(result.source_program_range, "P38001-P38400");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_handoff_status, "ready_for_work_os_static_bundle_review_ui_handoff_bundle");
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_handoff_bundle, true);
  assert.equal(result.static_review_ui_handoff_manifest_rows.length, 3);
  assert.equal(result.read_only_review_screen_package_rows.length, 3);
  assert.equal(result.operator_review_handoff_view_rows.length, 3);
  assert.equal(result.review_handoff_affordance_visibility_rows.length, 18);
  assert.ok(result.no_serve_no_receipt_accept_boundary_rows.length >= 800);
  assert.equal(result.work_os_static_bundle_review_ui_handoff_boundary.p38800_contract_ready, true);

  for (const flag of WORK_OS_STATIC_BUNDLE_REVIEW_UI_HANDOFF_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_ui_handoff_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P38800 remains a valid visible block when P38400 handoff is not ready", async () => {
  const source = buildP38400Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewUiHandoffBundle({
    runAt: RUN_AT,
    workOsStaticBundleReviewStaticUiAdapter: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_handoff_status, "valid_block_work_os_static_bundle_review_ui_handoff_bundle_pending");
  assert.equal(result.summary.source_p38400_ready_for_ui_handoff_bundle, false);
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_handoff_bundle, false);
  assert.equal(result.work_os_static_bundle_review_ui_handoff_boundary.p38800_contract_ready, true);
  assert.equal(result.p38800_clean_checkpoint_rows.find((row) => row.row_id === "p38800_checkpoint.receipt_accept_blocked").current_verdict, "pass");
});

test("review UI handoff bundle never serves, renders, persists, or enables controls", async () => {
  const source = buildP38400Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiHandoffBundle({
    runAt: RUN_AT,
    workOsStaticBundleReviewStaticUiAdapter: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.server_allowed_count, 0);
  assert.equal(result.summary.render_allowed_count, 0);
  assert.equal(result.summary.state_persist_allowed_count, 0);
  assert.equal(result.summary.interactive_control_enabled_count, 0);
  assert.ok(result.static_review_ui_handoff_manifest_rows.every((row) => row.manifest_visible_now === true));
  assert.ok(result.static_review_ui_handoff_manifest_rows.every((row) => row.server_allowed_now === false));
  assert.ok(result.static_review_ui_handoff_manifest_rows.every((row) => row.route_mount_allowed_now === false));
  assert.ok(result.read_only_review_screen_package_rows.every((row) => row.package_visible_now === true));
  assert.ok(result.read_only_review_screen_package_rows.every((row) => row.live_render_allowed_now === false));
  assert.ok(result.read_only_review_screen_package_rows.every((row) => row.html_file_write_allowed_now === false));
  assert.ok(result.operator_review_handoff_view_rows.every((row) => row.interactive_control_enabled_now === false));
  assert.ok(result.operator_review_handoff_view_rows.every((row) => row.command_button_enabled_now === false));
  assert.ok(result.operator_review_handoff_view_rows.every((row) => row.approve_button_enabled_now === false));
  assert.ok(result.operator_review_handoff_view_rows.every((row) => row.closeout_button_enabled_now === false));
});

test("review UI handoff bundle never accepts receipts or dispatches reviewers", async () => {
  const source = buildP38400Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiHandoffBundle({
    runAt: RUN_AT,
    workOsStaticBundleReviewStaticUiAdapter: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.receipt_accept_allowed_count, 0);
  assert.equal(result.summary.reviewer_dispatch_allowed_count, 0);
  assert.ok(result.review_handoff_affordance_visibility_rows.every((row) => row.affordance_visible_now === true));
  assert.ok(result.review_handoff_affordance_visibility_rows.every((row) => row.click_action_allowed_now === false));
  assert.ok(result.review_handoff_affordance_visibility_rows.every((row) => row.review_receipt_accept_allowed_now === false));
  assert.ok(result.review_handoff_affordance_visibility_rows.every((row) => row.reviewer_lane_dispatch_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_static_bundle_review_ui_handoff_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing review UI handoff artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p38800-"));
  try {
    const source = buildP38400Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewUiHandoffBundle({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleReviewStaticUiAdapter: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-ui-handoff-bundle.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

function buildP38400Source({ ready }) {
  const requests = ["req.product_contract", "req.project_control_plane", "req.commercial_spec"];
  const adapterRows = requests.map((requestId) => ({
    row_id: `static_bundle_review_static_ui_adapter_candidate.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    static_adapter_ref: `work_os.static_bundle_review.static_ui_adapter.${requestId}.candidate`,
    fixture_ref: `fixtures.work_os_static_bundle_review.${requestId}.smoke`,
    route_path: `/api/work-os/static-bundle-review/${requestId}`,
    expected_status: "blocked_review_packet_candidate_ready",
    adapter_visible_now: true,
    live_mount_allowed_now: false,
    runtime_fetch_allowed_now: false,
    generated_file_write_allowed_now: false,
    review_receipt_accept_allowed_now: false,
    reviewer_lane_dispatch_allowed_now: false,
  }));
  const slotRows = requests.map((requestId) => ({
    row_id: `review_screen_slot_contract.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    screen_id: "work_os.static_bundle_review.static_shell",
    slot_id: `static_bundle_review_card.${requestId}`,
    static_adapter_ref: `work_os.static_bundle_review.static_ui_adapter.${requestId}.candidate`,
    slot_binding_visible_now: true,
    route_navigation_allowed_now: false,
    live_browser_required_now: false,
    asset_pipeline_allowed_now: false,
    review_receipt_accept_allowed_now: false,
  }));
  const shellRows = requests.map((requestId) => ({
    row_id: `review_static_shell_fixture.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    static_shell_ref: `work_os.static_bundle_review.static_shell.${requestId}.fixture`,
    slot_id: `static_bundle_review_card.${requestId}`,
    route_path: `/api/work-os/static-bundle-review/${requestId}`,
    allowed_methods: ["GET"],
    expected_status: "blocked_review_packet_candidate_ready",
    fixture_visible_now: true,
    state_persist_allowed_now: false,
    form_submit_allowed_now: false,
    write_api_allowed_now: false,
    review_receipt_accept_allowed_now: false,
  }));
  const interactionRows = requests.flatMap((requestId) => ["render_review_packet_card", "display_finding_seed_count", "disabled_receipt_review_controls"].map((interactionType) => ({
    row_id: `review_interaction_smoke.${requestId}.${interactionType}`,
    request_id: requestId,
    current_verdict: "pass",
    interaction_type: interactionType,
    smoke_visible_now: true,
    event_handler_mutation_allowed_now: false,
    action_button_allowed_now: false,
    status_edit_allowed_now: false,
    review_receipt_accept_allowed_now: false,
    reviewer_lane_dispatch_allowed_now: false,
  })));

  return {
    schema_version: "work-os-static-bundle-review-static-ui-adapter.v1",
    generated_at: RUN_AT,
    capability_id: "platform.work_os_static_bundle_review_static_ui_adapter",
    program_range: "P38001-P38400",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      work_os_static_bundle_review_static_ui_status: ready
        ? "ready_for_work_os_static_bundle_review_static_ui_adapter"
        : "valid_block_work_os_static_bundle_review_static_ui_adapter_pending",
      ready_for_work_os_static_bundle_review_static_ui_handoff: ready,
    },
    work_os_static_bundle_review_static_ui_boundary: {
      p38400_contract_ready: true,
      ready_for_work_os_static_bundle_review_static_ui_handoff: ready,
      static_bundle_review_static_ui_adapter_candidate_visible_now: true,
      review_screen_slot_contract_visible_now: true,
      review_static_shell_fixture_visible_now: true,
      review_interaction_smoke_visible_now: true,
      no_live_ui_receipt_accept_boundary_closed_now: true,
      work_os_static_bundle_review_static_ui_wiring_complete_now: true,
      ...Object.fromEntries(P38400_FALSE_FLAGS.map((flag) => [flag, false])),
    },
    static_bundle_review_static_ui_adapter_candidate_rows: adapterRows,
    review_screen_slot_contract_rows: slotRows,
    review_static_shell_fixture_rows: shellRows,
    review_interaction_smoke_rows: interactionRows,
  };
}
