import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_UI_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticUiAdapter,
  runWorkOsStaticBundleReviewUiImplementationReviewStaticUiAdapter,
} from "../src/work-os-static-bundle-review-ui-implementation-review-static-ui-adapter.mjs";
import { ALL_FALSE_FLAGS as P40400_FALSE_FLAGS } from "../src/work-os-static-bundle-review-ui-implementation-review-api-read-model.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P40800 opens static review UI handoff when P40400 source is ready", async () => {
  const source = buildP40400Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticUiAdapter({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewApiReadModel: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-ui-implementation-review-static-ui-adapter.v1");
  assert.equal(result.program_range, "P40401-P40800");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_ui_status, "ready_for_work_os_static_bundle_review_ui_implementation_review_static_ui_adapter");
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_ui_handoff, true);
  assert.equal(result.static_bundle_review_ui_implementation_review_static_ui_adapter_candidate_rows.length, 3);
  assert.equal(result.implementation_review_screen_slot_contract_rows.length, 3);
  assert.equal(result.implementation_review_static_shell_fixture_rows.length, 3);
  assert.equal(result.implementation_review_interaction_smoke_rows.length, 9);
  assert.ok(result.no_live_ui_receipt_accept_boundary_rows.length >= 980);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_ui_boundary.p40800_contract_ready, true);

  for (const flag of WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_UI_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_ui_implementation_review_static_ui_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P40800 remains a valid visible block when P40400 handoff is not ready", async () => {
  const source = buildP40400Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticUiAdapter({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewApiReadModel: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_ui_status, "valid_block_work_os_static_bundle_review_ui_implementation_review_static_ui_adapter_pending");
  assert.equal(result.summary.source_p40400_ready_for_static_review_ui, false);
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_ui_handoff, false);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_ui_boundary.p40800_contract_ready, true);
  assert.equal(result.p40800_clean_checkpoint_rows.find((row) => row.row_id === "p40800_checkpoint.receipt_accept_blocked").current_verdict, "pass");
});

test("static review UI adapter and screen slots never become live UI authority", async () => {
  const source = buildP40400Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticUiAdapter({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewApiReadModel: source,
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
  const source = buildP40400Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticUiAdapter({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewApiReadModel: source,
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
    assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_ui_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing static review UI artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p40800-"));
  try {
    const source = buildP40400Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewUiImplementationReviewStaticUiAdapter({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleReviewUiImplementationReviewApiReadModel: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-ui-adapter.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

function buildP40400Source({ ready }) {
  const requests = ["req.product_contract", "req.project_control_plane", "req.commercial_spec"];
  const fixtureRows = requests.map((requestId) => ({
    row_id: `implementation_review_ui_consumer_fixture.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    fixture_ref: `fixtures.work_os_static_bundle_review.implementation_review.${safePathSegment(requestId)}.read_only`,
    route_path: `/api/work-os/static-bundle-review/implementation-review/${safePathSegment(requestId)}`,
    expected_status: "blocked_implementation_review_packet_candidate_ready",
    expected_finding_seed_count: 4,
    smoke_fixture_visible_now: true,
    fixture_persist_allowed_now: false,
    ui_mutation_allowed_now: false,
    ui_status_edit_allowed_now: false,
    ui_action_button_allowed_now: false,
    review_receipt_accept_allowed_now: false,
    reviewer_lane_dispatch_allowed_now: false,
  }));
  const routeRows = requests.map((requestId) => ({
    row_id: `implementation_review_route_contract.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    route_path: `/api/work-os/static-bundle-review/implementation-review/${safePathSegment(requestId)}`,
    allowed_methods: ["GET"],
    disallowed_methods: ["POST", "PATCH", "PUT", "DELETE"],
    response_model_ref: `work_os.static_bundle_review.implementation_review.response.${safePathSegment(requestId)}.candidate`,
    route_contract_visible_now: true,
    api_post_allowed_now: false,
    api_patch_allowed_now: false,
    api_delete_allowed_now: false,
    api_write_allowed_now: false,
    review_receipt_accept_allowed_now: false,
    review_completion_allowed_now: false,
  }));

  return {
    schema_version: "work-os-static-bundle-review-ui-implementation-review-api-read-model.v1",
    generated_at: RUN_AT,
    capability_id: "platform.work_os_static_bundle_review_ui_implementation_review_api_read_model",
    program_range: "P40001-P40400",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      work_os_static_bundle_review_ui_implementation_review_api_status: ready
        ? "ready_for_work_os_static_bundle_review_ui_implementation_review_api_read_model"
        : "valid_block_work_os_static_bundle_review_ui_implementation_review_api_read_model_pending",
      ready_for_work_os_static_bundle_review_ui_implementation_review_api_handoff: ready,
    },
    work_os_static_bundle_review_ui_implementation_review_api_boundary: {
      p40400_contract_ready: true,
      ready_for_work_os_static_bundle_review_ui_implementation_review_api_handoff: ready,
      implementation_review_api_response_candidate_visible_now: true,
      implementation_review_ui_consumer_fixture_visible_now: true,
      implementation_review_route_contract_visible_now: true,
      implementation_review_read_only_payload_shape_visible_now: true,
      no_mutation_review_execution_boundary_closed_now: true,
      work_os_static_bundle_review_ui_implementation_review_api_wiring_complete_now: true,
      ...Object.fromEntries(P40400_FALSE_FLAGS.map((flag) => [flag, false])),
    },
    implementation_review_ui_consumer_fixture_rows: fixtureRows,
    implementation_review_route_contract_rows: routeRows,
    implementation_review_read_only_payload_shape_rows: requests.map((requestId) => ({
      row_id: `implementation_review_read_only_payload_shape.${requestId}`,
      request_id: requestId,
      current_verdict: "pass",
      read_only_payload_visible_now: true,
      raw_payload_exposure_allowed_now: false,
      secret_read_allowed_now: false,
      api_state_mutation_allowed_now: false,
      review_receipt_accept_allowed_now: false,
      review_completion_allowed_now: false,
    })),
  };
}

function safePathSegment(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "request";
}
