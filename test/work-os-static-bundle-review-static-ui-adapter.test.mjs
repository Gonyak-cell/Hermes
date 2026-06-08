import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  WORK_OS_STATIC_BUNDLE_REVIEW_STATIC_UI_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewStaticUiAdapter,
  runWorkOsStaticBundleReviewStaticUiAdapter,
} from "../src/work-os-static-bundle-review-static-ui-adapter.mjs";
import { ALL_FALSE_FLAGS as P38000_FALSE_FLAGS } from "../src/work-os-static-bundle-review-api-read-model.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P38400 opens static review UI handoff when P38000 source is ready", async () => {
  const source = buildP38000Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewStaticUiAdapter({
    runAt: RUN_AT,
    workOsStaticBundleReviewApiReadModel: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-static-ui-adapter.v1");
  assert.equal(result.program_range, "P38001-P38400");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_static_ui_status, "ready_for_work_os_static_bundle_review_static_ui_adapter");
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_static_ui_handoff, true);
  assert.equal(result.static_bundle_review_static_ui_adapter_candidate_rows.length, 3);
  assert.equal(result.review_screen_slot_contract_rows.length, 3);
  assert.equal(result.review_static_shell_fixture_rows.length, 3);
  assert.equal(result.review_interaction_smoke_rows.length, 9);
  assert.ok(result.no_live_ui_receipt_accept_boundary_rows.length >= 760);
  assert.equal(result.work_os_static_bundle_review_static_ui_boundary.p38400_contract_ready, true);

  for (const flag of WORK_OS_STATIC_BUNDLE_REVIEW_STATIC_UI_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_static_ui_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P38400 remains a valid visible block when P38000 handoff is not ready", async () => {
  const source = buildP38000Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewStaticUiAdapter({
    runAt: RUN_AT,
    workOsStaticBundleReviewApiReadModel: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_static_ui_status, "valid_block_work_os_static_bundle_review_static_ui_adapter_pending");
  assert.equal(result.summary.source_p38000_ready_for_static_review_ui, false);
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_static_ui_handoff, false);
  assert.equal(result.work_os_static_bundle_review_static_ui_boundary.p38400_contract_ready, true);
  assert.equal(result.p38400_clean_checkpoint_rows.find((row) => row.row_id === "p38400_checkpoint.receipt_accept_blocked").current_verdict, "pass");
});

test("static review UI adapter and screen slots never become live UI authority", async () => {
  const source = buildP38000Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewStaticUiAdapter({
    runAt: RUN_AT,
    workOsStaticBundleReviewApiReadModel: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.live_mount_allowed_count, 0);
  assert.equal(result.summary.route_navigation_allowed_count, 0);
  assert.ok(result.static_bundle_review_static_ui_adapter_candidate_rows.every((row) => row.adapter_visible_now === true));
  assert.ok(result.static_bundle_review_static_ui_adapter_candidate_rows.every((row) => row.live_mount_allowed_now === false));
  assert.ok(result.static_bundle_review_static_ui_adapter_candidate_rows.every((row) => row.runtime_fetch_allowed_now === false));
  assert.ok(result.static_bundle_review_static_ui_adapter_candidate_rows.every((row) => row.generated_file_write_allowed_now === false));
  assert.ok(result.review_screen_slot_contract_rows.every((row) => row.slot_binding_visible_now === true));
  assert.ok(result.review_screen_slot_contract_rows.every((row) => row.route_navigation_allowed_now === false));
  assert.ok(result.review_screen_slot_contract_rows.every((row) => row.live_browser_required_now === false));
});

test("static review UI never mutates state, accepts receipts, or dispatches reviewers", async () => {
  const source = buildP38000Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewStaticUiAdapter({
    runAt: RUN_AT,
    workOsStaticBundleReviewApiReadModel: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.state_persist_allowed_count, 0);
  assert.equal(result.summary.event_mutation_allowed_count, 0);
  assert.equal(result.summary.receipt_accept_allowed_count, 0);
  assert.equal(result.summary.reviewer_dispatch_allowed_count, 0);
  assert.ok(result.review_static_shell_fixture_rows.every((row) => row.fixture_visible_now === true));
  assert.ok(result.review_static_shell_fixture_rows.every((row) => row.state_persist_allowed_now === false));
  assert.ok(result.review_static_shell_fixture_rows.every((row) => row.form_submit_allowed_now === false));
  assert.ok(result.review_static_shell_fixture_rows.every((row) => row.write_api_allowed_now === false));
  assert.ok(result.review_static_shell_fixture_rows.every((row) => row.review_receipt_accept_allowed_now === false));
  assert.ok(result.review_interaction_smoke_rows.every((row) => row.smoke_visible_now === true));
  assert.ok(result.review_interaction_smoke_rows.every((row) => row.event_handler_mutation_allowed_now === false));
  assert.ok(result.review_interaction_smoke_rows.every((row) => row.action_button_allowed_now === false));
  assert.ok(result.review_interaction_smoke_rows.every((row) => row.status_edit_allowed_now === false));
  assert.ok(result.review_interaction_smoke_rows.every((row) => row.review_receipt_accept_allowed_now === false));
  assert.ok(result.review_interaction_smoke_rows.every((row) => row.reviewer_lane_dispatch_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_static_bundle_review_static_ui_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing static review UI artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p38400-"));
  try {
    const source = buildP38000Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewStaticUiAdapter({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleReviewApiReadModel: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-static-ui-adapter.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

function buildP38000Source({ ready }) {
  const requests = ["req.product_contract", "req.project_control_plane", "req.commercial_spec"];
  const fixtureRows = requests.map((requestId) => ({
    row_id: `review_packet_ui_consumer_fixture.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    fixture_ref: `fixtures.work_os_static_bundle_review.${requestId}.smoke`,
    route_path: `/api/work-os/static-bundle-review/${requestId}`,
    expected_status: "blocked_review_packet_candidate_ready",
    expected_finding_seed_count: 3,
    smoke_fixture_visible_now: true,
    fixture_persist_allowed_now: false,
    ui_mutation_allowed_now: false,
    ui_status_edit_allowed_now: false,
    ui_action_button_allowed_now: false,
    review_receipt_accept_allowed_now: false,
    reviewer_lane_dispatch_allowed_now: false,
  }));
  const routeRows = requests.map((requestId) => ({
    row_id: `review_packet_route_response_contract.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    route_path: `/api/work-os/static-bundle-review/${requestId}`,
    allowed_methods: ["GET"],
    disallowed_methods: ["POST", "PATCH", "PUT", "DELETE"],
    response_model_ref: `work_os.static_bundle_review.response.${requestId}.candidate`,
    route_contract_visible_now: true,
    api_post_allowed_now: false,
    api_patch_allowed_now: false,
    api_delete_allowed_now: false,
    api_write_allowed_now: false,
    review_receipt_accept_allowed_now: false,
    review_completion_allowed_now: false,
  }));

  return {
    schema_version: "work-os-static-bundle-review-api-read-model.v1",
    generated_at: RUN_AT,
    capability_id: "platform.work_os_static_bundle_review_api_read_model",
    program_range: "P37601-P38000",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      work_os_static_bundle_review_api_status: ready
        ? "ready_for_work_os_static_bundle_review_api_read_model"
        : "valid_block_work_os_static_bundle_review_api_read_model_pending",
      ready_for_work_os_static_bundle_review_ui_handoff: ready,
    },
    work_os_static_bundle_review_api_boundary: {
      p38000_contract_ready: true,
      ready_for_work_os_static_bundle_review_ui_handoff: ready,
      static_bundle_review_api_response_visible_now: true,
      review_packet_ui_consumer_fixture_visible_now: true,
      review_packet_route_response_contract_visible_now: true,
      no_receipt_accept_api_write_boundary_closed_now: true,
      work_os_static_bundle_review_api_wiring_complete_now: true,
      ...Object.fromEntries(P38000_FALSE_FLAGS.map((flag) => [flag, false])),
    },
    review_packet_ui_consumer_fixture_rows: fixtureRows,
    review_packet_route_response_contract_rows: routeRows,
  };
}
