import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_API_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewApiReadModel,
  runWorkOsStaticBundleReviewUiImplementationReviewApiReadModel,
} from "../src/work-os-static-bundle-review-ui-implementation-review-api-read-model.mjs";
import { ALL_FALSE_FLAGS as P40000_FALSE_FLAGS } from "../src/work-os-static-bundle-review-ui-implementation-review-packet-candidate.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P40400 opens implementation review API read model when P40000 source is ready", async () => {
  const source = buildP40000Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewApiReadModel({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewPacketCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-ui-implementation-review-api-read-model.v1");
  assert.equal(result.program_range, "P40001-P40400");
  assert.equal(result.source_program_range, "P39601-P40000");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_api_status, "ready_for_work_os_static_bundle_review_ui_implementation_review_api_read_model");
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_api_handoff, true);
  assert.equal(result.summary.source_p40000_ready_for_implementation_review_api, true);
  assert.equal(result.implementation_review_api_response_candidate_rows.length, 3);
  assert.equal(result.implementation_review_route_contract_rows.length, 3);
  assert.equal(result.implementation_review_ui_consumer_fixture_rows.length, 3);
  assert.equal(result.implementation_review_read_only_payload_shape_rows.length, 3);
  assert.ok(result.no_mutation_review_execution_boundary_rows.length >= 980);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_api_boundary.p40400_contract_ready, true);

  for (const flag of WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_API_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_ui_implementation_review_api_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P40400 remains a valid visible block when P40000 handoff is not ready", async () => {
  const source = buildP40000Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewApiReadModel({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewPacketCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_api_status, "valid_block_work_os_static_bundle_review_ui_implementation_review_api_read_model_pending");
  assert.equal(result.summary.source_p40000_ready_for_implementation_review_api, false);
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_api_handoff, false);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_api_boundary.p40400_contract_ready, true);
  assert.equal(result.p40400_clean_checkpoint_rows.find((row) => row.row_id === "p40400_checkpoint.review_execution_blocked").current_verdict, "pass");
});

test("implementation review API route contracts stay GET-only and never open runtime routes or writes", async () => {
  const source = buildP40000Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewApiReadModel({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewPacketCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.api_write_allowed_count, 0);
  assert.equal(result.summary.api_server_start_allowed_count, 0);
  assert.equal(result.summary.api_state_mutation_allowed_count, 0);
  assert.ok(result.implementation_review_api_response_candidate_rows.every((row) => row.method === "GET"));
  assert.ok(result.implementation_review_api_response_candidate_rows.every((row) => row.api_server_start_allowed_now === false));
  assert.ok(result.implementation_review_api_response_candidate_rows.every((row) => row.route_registration_allowed_now === false));
  assert.ok(result.implementation_review_api_response_candidate_rows.every((row) => row.runtime_route_execution_allowed_now === false));
  assert.ok(result.implementation_review_api_response_candidate_rows.every((row) => row.network_call_required_now === false));
  assert.ok(result.implementation_review_route_contract_rows.every((row) => row.allowed_methods.length === 1 && row.allowed_methods[0] === "GET"));
  assert.ok(result.implementation_review_route_contract_rows.every((row) => row.disallowed_methods.includes("POST")));
  assert.ok(result.implementation_review_route_contract_rows.every((row) => row.api_post_allowed_now === false));
  assert.ok(result.implementation_review_route_contract_rows.every((row) => row.api_patch_allowed_now === false));
  assert.ok(result.implementation_review_route_contract_rows.every((row) => row.api_put_allowed_now === false));
  assert.ok(result.implementation_review_route_contract_rows.every((row) => row.api_delete_allowed_now === false));
  assert.ok(result.implementation_review_route_contract_rows.every((row) => row.api_write_allowed_now === false));
});

test("implementation review fixtures and payload shapes never accept receipts, expose raw payloads, dispatch reviewers, or apply files", async () => {
  const source = buildP40000Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewApiReadModel({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewPacketCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.review_receipt_accept_allowed_count, 0);
  assert.equal(result.summary.reviewer_dispatch_allowed_count, 0);
  assert.equal(result.summary.review_completion_allowed_count, 0);
  assert.equal(result.summary.raw_payload_exposure_allowed_count, 0);
  assert.equal(result.summary.file_apply_allowed_count, 0);
  assert.ok(result.implementation_review_ui_consumer_fixture_rows.every((row) => row.smoke_fixture_visible_now === true));
  assert.ok(result.implementation_review_ui_consumer_fixture_rows.every((row) => row.fixture_persist_allowed_now === false));
  assert.ok(result.implementation_review_ui_consumer_fixture_rows.every((row) => row.ui_mutation_allowed_now === false));
  assert.ok(result.implementation_review_ui_consumer_fixture_rows.every((row) => row.review_receipt_accept_allowed_now === false));
  assert.ok(result.implementation_review_ui_consumer_fixture_rows.every((row) => row.reviewer_lane_dispatch_allowed_now === false));
  assert.ok(result.implementation_review_ui_consumer_fixture_rows.every((row) => row.claude_review_execution_allowed_now === false));
  assert.ok(result.implementation_review_ui_consumer_fixture_rows.every((row) => row.file_apply_allowed_now === false));
  assert.ok(result.implementation_review_read_only_payload_shape_rows.every((row) => row.read_only_payload_visible_now === true));
  assert.ok(result.implementation_review_read_only_payload_shape_rows.every((row) => row.raw_payload_exposure_allowed_now === false));
  assert.ok(result.implementation_review_read_only_payload_shape_rows.every((row) => row.secret_read_allowed_now === false));
  assert.ok(result.implementation_review_read_only_payload_shape_rows.every((row) => row.api_state_mutation_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_static_bundle_review_ui_implementation_review_api_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing implementation review API artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p40400-"));
  try {
    const source = buildP40000Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewUiImplementationReviewApiReadModel({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleReviewUiImplementationReviewPacketCandidate: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-api-read-model.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

function buildP40000Source({ ready }) {
  const requests = ["req.product_contract", "req.project_control_plane", "req.commercial_spec"];
  const packetRows = requests.map((requestId) => ({
    row_id: `implementation_review_packet_candidate.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    implementation_review_packet_ref: `work_os.static_bundle_review.implementation.${requestId}.review_packet.candidate`,
    implementation_handoff_package_ref: `work_os.static_bundle_review.implementation.${requestId}.handoff_package`,
    component_path_ref: `src/ui/work-os/static-bundle-review/${safePathSegment(requestId)}.tsx`,
    test_path_ref: `test/ui/work-os/static-bundle-review/${safePathSegment(requestId)}.test.mjs`,
    style_path_ref: `src/ui/work-os/static-bundle-review/${safePathSegment(requestId)}.css`,
    component_name: `StaticBundleReview${toPascalCase(requestId)}Card`,
    route_path: `/api/work-os/static-bundle-review/${requestId}`,
    packet_visible_now: true,
    review_completion_allowed_now: false,
    review_receipt_create_allowed_now: false,
    review_receipt_accept_allowed_now: false,
    reviewer_lane_dispatch_allowed_now: false,
    approval_allowed_now: false,
    file_apply_allowed_now: false,
    file_write_allowed_now: false,
    build_allowed_now: false,
    browser_run_allowed_now: false,
  }));
  const evidenceRows = requests.map((requestId) => ({
    row_id: `implementation_review_evidence_summary.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    implementation_review_packet_ref: `work_os.static_bundle_review.implementation.${requestId}.review_packet.candidate`,
    source_evidence_refs: [
      `implementation_handoff_package_candidate.${requestId}`,
      `implementation_file_manifest_candidate.${requestId}`,
      `fixture_smoke_plan_candidate.${requestId}`,
      `reviewer_handoff_note_candidate.${requestId}`,
    ],
    evidence_summary_visible_now: true,
    evidence_complete_now: false,
    review_receipt_accept_allowed_now: false,
    claude_review_execution_allowed_now: false,
    enterprise_review_claim_allowed_now: false,
  }));
  const findingRows = requests.flatMap((requestId) => [
    "file_write_boundary",
    "fixture_execution_boundary",
    "review_authority_boundary",
    "production_trust_boundary",
  ].map((findingType) => ({
    row_id: `implementation_finding_seed.${requestId}.${findingType}`,
    request_id: requestId,
    current_verdict: "pass",
    finding_type: findingType,
    finding_seed_visible_now: true,
    finding_resolution_allowed_now: false,
    review_completion_allowed_now: false,
    closeout_allowed_now: false,
    file_apply_allowed_now: false,
  })));
  const reviewerRows = requests.map((requestId) => ({
    row_id: `implementation_reviewer_lane_request_candidate.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    reviewer_lane: "claude_code_opus_max_candidate",
    implementation_review_packet_ref: `work_os.static_bundle_review.implementation.${requestId}.review_packet.candidate`,
    finding_seed_refs: [
      `implementation_finding_seed.${requestId}.file_write_boundary`,
      `implementation_finding_seed.${requestId}.fixture_execution_boundary`,
      `implementation_finding_seed.${requestId}.review_authority_boundary`,
      `implementation_finding_seed.${requestId}.production_trust_boundary`,
    ],
    request_visible_now: true,
    reviewer_lane_dispatch_allowed_now: false,
    claude_review_execution_allowed_now: false,
    human_adjudication_allowed_now: false,
    review_completion_allowed_now: false,
    final_approval_allowed_now: false,
    production_pass_allowed_now: false,
  }));

  return {
    schema_version: "work-os-static-bundle-review-ui-implementation-review-packet-candidate.v1",
    generated_at: RUN_AT,
    capability_id: "platform.work_os_static_bundle_review_ui_implementation_review_packet_candidate",
    program_range: "P39601-P40000",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      work_os_static_bundle_review_ui_implementation_review_status: ready
        ? "ready_for_work_os_static_bundle_review_ui_implementation_review_packet_candidate"
        : "valid_block_work_os_static_bundle_review_ui_implementation_review_packet_candidate_pending",
      ready_for_work_os_static_bundle_review_ui_implementation_review_request_handoff: ready,
    },
    work_os_static_bundle_review_ui_implementation_review_boundary: {
      p40000_contract_ready: true,
      ready_for_work_os_static_bundle_review_ui_implementation_review_request_handoff: ready,
      implementation_review_packet_candidate_visible_now: true,
      implementation_review_evidence_summary_visible_now: true,
      implementation_finding_seed_visible_now: true,
      implementation_reviewer_lane_request_candidate_visible_now: true,
      no_review_completion_boundary_closed_now: true,
      work_os_static_bundle_review_ui_implementation_review_wiring_complete_now: true,
      ...Object.fromEntries(P40000_FALSE_FLAGS.map((flag) => [flag, false])),
    },
    implementation_review_packet_candidate_rows: packetRows,
    implementation_review_evidence_summary_rows: evidenceRows,
    implementation_finding_seed_rows: findingRows,
    implementation_reviewer_lane_request_candidate_rows: reviewerRows,
  };
}

function safePathSegment(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "request";
}

function toPascalCase(value) {
  return String(value)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
}
