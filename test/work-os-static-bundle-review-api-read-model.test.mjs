import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  WORK_OS_STATIC_BUNDLE_REVIEW_API_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewApiReadModel,
  runWorkOsStaticBundleReviewApiReadModel,
} from "../src/work-os-static-bundle-review-api-read-model.mjs";
import { ALL_FALSE_FLAGS as P37600_FALSE_FLAGS } from "../src/work-os-static-bundle-review-packet-candidate.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P38000 opens read-only review API handoff when P37600 source is ready", async () => {
  const source = buildP37600Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewApiReadModel({
    runAt: RUN_AT,
    workOsStaticBundleReviewPacketCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-api-read-model.v1");
  assert.equal(result.program_range, "P37601-P38000");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_api_status, "ready_for_work_os_static_bundle_review_api_read_model");
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_handoff, true);
  assert.equal(result.static_bundle_review_api_response_rows.length, 3);
  assert.equal(result.review_packet_ui_consumer_fixture_rows.length, 3);
  assert.equal(result.review_packet_route_response_contract_rows.length, 3);
  assert.ok(result.no_receipt_accept_api_write_boundary_rows.length >= 760);
  assert.equal(result.work_os_static_bundle_review_api_boundary.p38000_contract_ready, true);

  for (const flag of WORK_OS_STATIC_BUNDLE_REVIEW_API_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_api_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P38000 remains a valid visible block when P37600 handoff is not ready", async () => {
  const source = buildP37600Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewApiReadModel({
    runAt: RUN_AT,
    workOsStaticBundleReviewPacketCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_api_status, "valid_block_work_os_static_bundle_review_api_read_model_pending");
  assert.equal(result.summary.source_p37600_ready_for_review_api, false);
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_handoff, false);
  assert.equal(result.work_os_static_bundle_review_api_boundary.p38000_contract_ready, true);
  assert.equal(result.p38000_clean_checkpoint_rows.find((row) => row.row_id === "p38000_checkpoint.receipt_accept_blocked").current_verdict, "pass");
});

test("review API route contracts stay GET-only and never open write methods", async () => {
  const source = buildP37600Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewApiReadModel({
    runAt: RUN_AT,
    workOsStaticBundleReviewPacketCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.api_write_allowed_count, 0);
  assert.equal(result.summary.server_start_allowed_count, 0);
  assert.equal(result.summary.route_registration_allowed_count, 0);
  assert.ok(result.static_bundle_review_api_response_rows.every((row) => row.method === "GET"));
  assert.ok(result.static_bundle_review_api_response_rows.every((row) => row.api_server_start_allowed_now === false));
  assert.ok(result.static_bundle_review_api_response_rows.every((row) => row.route_registration_allowed_now === false));
  assert.ok(result.static_bundle_review_api_response_rows.every((row) => row.network_call_required_now === false));
  assert.ok(result.review_packet_route_response_contract_rows.every((row) => row.allowed_methods.length === 1 && row.allowed_methods[0] === "GET"));
  assert.ok(result.review_packet_route_response_contract_rows.every((row) => row.api_post_allowed_now === false));
  assert.ok(result.review_packet_route_response_contract_rows.every((row) => row.api_patch_allowed_now === false));
  assert.ok(result.review_packet_route_response_contract_rows.every((row) => row.api_delete_allowed_now === false));
  assert.ok(result.review_packet_route_response_contract_rows.every((row) => row.api_write_allowed_now === false));
});

test("review UI fixtures never accept receipts, mutate UI, dispatch reviewers, or complete review", async () => {
  const source = buildP37600Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewApiReadModel({
    runAt: RUN_AT,
    workOsStaticBundleReviewPacketCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.review_receipt_accept_allowed_count, 0);
  assert.equal(result.summary.reviewer_dispatch_allowed_count, 0);
  assert.equal(result.summary.review_completion_allowed_count, 0);
  assert.equal(result.summary.ui_mutation_allowed_count, 0);
  assert.ok(result.review_packet_ui_consumer_fixture_rows.every((row) => row.smoke_fixture_visible_now === true));
  assert.ok(result.review_packet_ui_consumer_fixture_rows.every((row) => row.fixture_persist_allowed_now === false));
  assert.ok(result.review_packet_ui_consumer_fixture_rows.every((row) => row.ui_mutation_allowed_now === false));
  assert.ok(result.review_packet_ui_consumer_fixture_rows.every((row) => row.ui_status_edit_allowed_now === false));
  assert.ok(result.review_packet_ui_consumer_fixture_rows.every((row) => row.ui_action_button_allowed_now === false));
  assert.ok(result.review_packet_ui_consumer_fixture_rows.every((row) => row.review_receipt_accept_allowed_now === false));
  assert.ok(result.review_packet_ui_consumer_fixture_rows.every((row) => row.reviewer_lane_dispatch_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_static_bundle_review_api_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing review API artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p38000-"));
  try {
    const source = buildP37600Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewApiReadModel({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleReviewPacketCandidate: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-api-read-model.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

function buildP37600Source({ ready }) {
  const requests = ["req.product_contract", "req.project_control_plane", "req.commercial_spec"];
  const packetRows = requests.map((requestId) => ({
    row_id: `static_bundle_review_packet_candidate.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    review_packet_ref: `work_os.static_bundle.${requestId}.review_packet.candidate`,
    preview_bundle_ref: `operator.preview_bundle.${requestId}.candidate`,
    handoff_package_ref: `work_os.static_bundle.${requestId}.handoff.candidate`,
    packet_visible_now: true,
    review_completion_allowed_now: false,
    review_receipt_create_allowed_now: false,
    approval_allowed_now: false,
  }));
  const evidenceRows = requests.map((requestId) => ({
    row_id: `review_evidence_summary.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    review_packet_ref: `work_os.static_bundle.${requestId}.review_packet.candidate`,
    source_evidence_refs: [
      `static_bundle_handoff_package.${requestId}`,
      `static_bundle_file_plan_candidate.${requestId}`,
      `operator.preview_bundle.${requestId}.candidate`,
    ],
    evidence_summary_visible_now: true,
    evidence_complete_now: false,
    review_receipt_accept_allowed_now: false,
    enterprise_review_claim_allowed_now: false,
  }));
  const findingRows = requests.flatMap((requestId) => [
    "file_apply_boundary",
    "review_authority_boundary",
    "operator_control_boundary",
  ].map((findingType) => ({
    row_id: `finding_seed.${requestId}.${findingType}`,
    request_id: requestId,
    current_verdict: "pass",
    finding_type: findingType,
    finding_seed_visible_now: true,
    finding_resolution_allowed_now: false,
    review_completion_allowed_now: false,
    closeout_allowed_now: false,
  })));
  const reviewerRows = requests.map((requestId) => ({
    row_id: `reviewer_lane_request_candidate.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    reviewer_lane: "claude_code_opus_max_candidate",
    review_packet_ref: `work_os.static_bundle.${requestId}.review_packet.candidate`,
    finding_seed_refs: [
      `finding_seed.${requestId}.file_apply_boundary`,
      `finding_seed.${requestId}.review_authority_boundary`,
      `finding_seed.${requestId}.operator_control_boundary`,
    ],
    request_visible_now: true,
    reviewer_lane_dispatch_allowed_now: false,
    claude_review_execution_allowed_now: false,
    human_adjudication_allowed_now: false,
    review_completion_allowed_now: false,
  }));

  return {
    schema_version: "work-os-static-bundle-review-packet-candidate.v1",
    generated_at: RUN_AT,
    capability_id: "platform.work_os_static_bundle_review_packet_candidate",
    program_range: "P37201-P37600",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      work_os_static_bundle_review_status: ready
        ? "ready_for_work_os_static_bundle_review_packet_candidate"
        : "valid_block_work_os_static_bundle_review_packet_candidate_pending",
      ready_for_work_os_review_request_handoff: ready,
    },
    work_os_static_bundle_review_boundary: {
      p37600_contract_ready: true,
      ready_for_work_os_review_request_handoff: ready,
      static_bundle_review_packet_candidate_visible_now: true,
      review_evidence_summary_visible_now: true,
      finding_seed_visible_now: true,
      reviewer_lane_request_candidate_visible_now: true,
      no_review_completion_boundary_closed_now: true,
      work_os_static_bundle_review_wiring_complete_now: true,
      ...Object.fromEntries(P37600_FALSE_FLAGS.map((flag) => [flag, false])),
    },
    static_bundle_review_packet_candidate_rows: packetRows,
    review_evidence_summary_rows: evidenceRows,
    finding_seed_rows: findingRows,
    reviewer_lane_request_candidate_rows: reviewerRows,
  };
}
