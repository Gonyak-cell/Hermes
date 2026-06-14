import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewPacketCandidate,
  runWorkOsStaticBundleReviewUiImplementationReviewPacketCandidate,
} from "../src/work-os-static-bundle-review-ui-implementation-review-packet-candidate.mjs";
import { ALL_FALSE_FLAGS as P39600_FALSE_FLAGS } from "../src/work-os-static-bundle-review-ui-implementation-handoff-package.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P40000 opens implementation review packet candidate when P39600 source is ready", async () => {
  const source = buildP39600Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewPacketCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationHandoffPackage: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-ui-implementation-review-packet-candidate.v1");
  assert.equal(result.program_range, "P39601-P40000");
  assert.equal(result.source_program_range, "P39201-P39600");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_status, "ready_for_work_os_static_bundle_review_ui_implementation_review_packet_candidate");
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_request_handoff, true);
  assert.equal(result.summary.source_p39600_ready_for_implementation_review_packet, true);
  assert.equal(result.implementation_review_packet_candidate_rows.length, 3);
  assert.equal(result.implementation_review_evidence_summary_rows.length, 3);
  assert.equal(result.implementation_finding_seed_rows.length, 12);
  assert.equal(result.implementation_reviewer_lane_request_candidate_rows.length, 3);
  assert.ok(result.no_review_completion_boundary_rows.length >= 950);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_boundary.p40000_contract_ready, true);

  for (const flag of WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_ui_implementation_review_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P40000 remains a valid visible block when P39600 source is not ready", async () => {
  const source = buildP39600Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewPacketCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationHandoffPackage: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_status, "valid_block_work_os_static_bundle_review_ui_implementation_review_packet_candidate_pending");
  assert.equal(result.summary.source_p39600_ready_for_implementation_review_packet, false);
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_request_handoff, false);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_boundary.p40000_contract_ready, true);
  assert.equal(result.p40000_clean_checkpoint_rows.find((row) => row.row_id === "p40000_checkpoint.review_completion_blocked").current_verdict, "pass");
});

test("implementation review packet and evidence rows never become review receipt or file apply authority", async () => {
  const source = buildP39600Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewPacketCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationHandoffPackage: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.review_completion_allowed_count, 0);
  assert.equal(result.summary.review_receipt_create_allowed_count, 0);
  assert.equal(result.summary.file_apply_allowed_count, 0);
  assert.equal(result.summary.build_allowed_count, 0);
  assert.ok(result.implementation_review_packet_candidate_rows.every((row) => row.packet_visible_now === true));
  assert.ok(result.implementation_review_packet_candidate_rows.every((row) => row.review_completion_allowed_now === false));
  assert.ok(result.implementation_review_packet_candidate_rows.every((row) => row.review_receipt_create_allowed_now === false));
  assert.ok(result.implementation_review_packet_candidate_rows.every((row) => row.review_receipt_accept_allowed_now === false));
  assert.ok(result.implementation_review_packet_candidate_rows.every((row) => row.file_apply_allowed_now === false));
  assert.ok(result.implementation_review_packet_candidate_rows.every((row) => row.file_write_allowed_now === false));
  assert.ok(result.implementation_review_packet_candidate_rows.every((row) => row.build_allowed_now === false));
  assert.ok(result.implementation_review_packet_candidate_rows.every((row) => row.browser_run_allowed_now === false));
  assert.ok(result.implementation_review_evidence_summary_rows.every((row) => row.evidence_summary_visible_now === true));
  assert.ok(result.implementation_review_evidence_summary_rows.every((row) => row.evidence_complete_now === false));
  assert.ok(result.implementation_review_evidence_summary_rows.every((row) => row.review_receipt_accept_allowed_now === false));
  assert.ok(result.implementation_review_evidence_summary_rows.every((row) => row.claude_review_execution_allowed_now === false));
});

test("finding and reviewer lane rows never resolve, dispatch, execute, or adjudicate", async () => {
  const source = buildP39600Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewPacketCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationHandoffPackage: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.finding_resolution_allowed_count, 0);
  assert.equal(result.summary.reviewer_dispatch_allowed_count, 0);
  assert.ok(result.implementation_finding_seed_rows.every((row) => row.finding_seed_visible_now === true));
  assert.ok(result.implementation_finding_seed_rows.every((row) => row.finding_resolution_allowed_now === false));
  assert.ok(result.implementation_finding_seed_rows.every((row) => row.review_completion_allowed_now === false));
  assert.ok(result.implementation_finding_seed_rows.every((row) => row.closeout_allowed_now === false));
  assert.ok(result.implementation_finding_seed_rows.every((row) => row.file_apply_allowed_now === false));
  assert.ok(result.implementation_reviewer_lane_request_candidate_rows.every((row) => row.request_visible_now === true));
  assert.ok(result.implementation_reviewer_lane_request_candidate_rows.every((row) => row.reviewer_lane_dispatch_allowed_now === false));
  assert.ok(result.implementation_reviewer_lane_request_candidate_rows.every((row) => row.claude_review_execution_allowed_now === false));
  assert.ok(result.implementation_reviewer_lane_request_candidate_rows.every((row) => row.human_adjudication_allowed_now === false));
  assert.ok(result.implementation_reviewer_lane_request_candidate_rows.every((row) => row.final_approval_allowed_now === false));
  assert.ok(result.implementation_reviewer_lane_request_candidate_rows.every((row) => row.production_pass_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_static_bundle_review_ui_implementation_review_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing implementation review packet artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p40000-"));
  try {
    const source = buildP39600Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewUiImplementationReviewPacketCandidate({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleReviewUiImplementationHandoffPackage: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-packet-candidate.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

function buildP39600Source({ ready }) {
  const requests = ["req.product_contract", "req.project_control_plane", "req.commercial_spec"];
  const handoffRows = requests.map((requestId) => ({
    row_id: `implementation_handoff_package_candidate.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    implementation_handoff_package_ref: `work_os.static_bundle_review.implementation.${requestId}.handoff_package`,
    file_plan_ref: `work_os.static_bundle_review.implementation.${requestId}.file_plan`,
    component_binding_ref: `work_os.static_bundle_review.implementation.${requestId}.component_binding`,
    data_binding_ref: `work_os.static_bundle_review.implementation.${requestId}.data_binding`,
    visual_token_binding_ref: `work_os.static_bundle_review.implementation.${requestId}.visual_tokens`,
    proposed_component_path: `src/ui/work-os/static-bundle-review/${safePathSegment(requestId)}.tsx`,
    proposed_test_path: `test/ui/work-os/static-bundle-review/${safePathSegment(requestId)}.test.mjs`,
    proposed_style_path: `src/ui/work-os/static-bundle-review/${safePathSegment(requestId)}.css`,
    component_name: `StaticBundleReview${toPascalCase(requestId)}Card`,
    route_path: `/api/work-os/static-bundle-review/${requestId}`,
    static_data_source_ref: `work_os.static_bundle_review.ui_handoff.${requestId}.screen_package`,
    token_refs: [
      "work_os.surface.panel",
      "work_os.status.blocked",
      "work_os.control.disabled",
      "work_os.review.badge",
    ],
    handoff_metadata_only: true,
    file_create_allowed_now: false,
    file_write_allowed_now: false,
    file_apply_allowed_now: false,
    generated_file_apply_allowed_now: false,
    build_allowed_now: false,
    browser_run_allowed_now: false,
    review_completion_allowed_now: false,
  }));
  const manifestRows = requests.map((requestId) => ({
    row_id: `implementation_file_manifest_candidate.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    implementation_handoff_package_ref: `work_os.static_bundle_review.implementation.${requestId}.handoff_package`,
    target_component_path_hint: `src/ui/work-os/static-bundle-review/${safePathSegment(requestId)}.tsx`,
    target_test_path_hint: `test/ui/work-os/static-bundle-review/${safePathSegment(requestId)}.test.mjs`,
    target_style_path_hint: `src/ui/work-os/static-bundle-review/${safePathSegment(requestId)}.css`,
    export_name_hint: `StaticBundleReview${toPascalCase(requestId)}Card`,
    route_path_hint: `/api/work-os/static-bundle-review/${requestId}`,
    fixture_ref_hint: `fixture.work_os.static_bundle_review.${safePathSegment(requestId)}.read_only`,
    token_refs: ["work_os.surface.panel", "work_os.status.blocked"],
    manifest_metadata_only: true,
    file_create_allowed_now: false,
    file_write_allowed_now: false,
    generated_file_apply_allowed_now: false,
    template_apply_allowed_now: false,
    component_write_allowed_now: false,
    css_write_allowed_now: false,
    build_allowed_now: false,
    export_allowed_now: false,
  }));
  const smokeRows = requests.map((requestId) => ({
    row_id: `fixture_smoke_plan_candidate.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    implementation_handoff_package_ref: `work_os.static_bundle_review.implementation.${requestId}.handoff_package`,
    implementation_file_manifest_candidate_ref: `implementation_file_manifest_candidate.${requestId}`,
    fixture_ref_hint: `fixture.work_os.static_bundle_review.${safePathSegment(requestId)}.read_only`,
    expected_state_refs: [
      `state.work_os.static_bundle_review.${safePathSegment(requestId)}.blocked`,
      `state.work_os.static_bundle_review.${safePathSegment(requestId)}.review_pending`,
      `state.work_os.static_bundle_review.${safePathSegment(requestId)}.ready_metadata`,
    ],
    smoke_command_hint: "npm run platform:work-os-static-bundle-review-ui-implementation-handoff-package -- --check",
    fixture_smoke_metadata_only: true,
    fixture_execution_allowed_now: false,
    browser_run_allowed_now: false,
    browser_smoke_allowed_now: false,
    visual_smoke_execution_allowed_now: false,
    screenshot_capture_allowed_now: false,
    network_fetch_allowed_now: false,
    runtime_fetch_allowed_now: false,
    client_hydration_allowed_now: false,
    build_allowed_now: false,
  }));
  const reviewerRows = requests.map((requestId) => ({
    row_id: `reviewer_handoff_note_candidate.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    implementation_handoff_package_ref: `work_os.static_bundle_review.implementation.${requestId}.handoff_package`,
    implementation_file_manifest_candidate_ref: `implementation_file_manifest_candidate.${requestId}`,
    fixture_smoke_plan_candidate_ref: `fixture_smoke_plan_candidate.${requestId}`,
    reviewer_context_refs: [
      `work_os.static_bundle_review.implementation.${requestId}.file_plan`,
      `work_os.static_bundle_review.implementation.${requestId}.component_binding`,
      `work_os.static_bundle_review.implementation.${requestId}.data_binding`,
      `work_os.static_bundle_review.implementation.${requestId}.visual_tokens`,
    ],
    blocked_authority_note: "Metadata handoff only; reviewer may inspect package context but cannot apply files, run builds, accept receipts, complete review, approve, close out, deploy, or claim production readiness.",
    reviewer_handoff_metadata_only: true,
    receipt_accept_allowed_now: false,
    reviewer_dispatch_allowed_now: false,
    review_completion_allowed_now: false,
    finding_resolution_allowed_now: false,
    human_adjudication_allowed_now: false,
    final_approval_allowed_now: false,
    production_pass_allowed_now: false,
    enterprise_trust_claim_allowed_now: false,
  }));

  return {
    schema_version: "work-os-static-bundle-review-ui-implementation-handoff-package.v1",
    generated_at: RUN_AT,
    capability_id: "platform.work_os_static_bundle_review_ui_implementation_handoff_package",
    program_range: "P39201-P39600",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      work_os_static_bundle_review_ui_implementation_handoff_package_status: ready
        ? "ready_for_work_os_static_bundle_review_ui_implementation_handoff_package"
        : "valid_block_work_os_static_bundle_review_ui_implementation_handoff_package_pending",
      ready_for_work_os_static_bundle_review_ui_implementation_handoff_package: ready,
    },
    work_os_static_bundle_review_ui_implementation_handoff_package_boundary: {
      p39600_contract_ready: true,
      ready_for_work_os_static_bundle_review_ui_implementation_handoff_package: ready,
      source_p39200_ready_for_implementation_handoff_package: true,
      source_validation_valid_now: true,
      implementation_handoff_package_candidate_visible_now: true,
      implementation_file_manifest_candidate_visible_now: true,
      fixture_smoke_plan_candidate_visible_now: true,
      reviewer_handoff_note_candidate_visible_now: true,
      no_implementation_boundary_closed_now: true,
      ...Object.fromEntries(P39600_FALSE_FLAGS.map((flag) => [flag, false])),
    },
    implementation_handoff_package_candidate_rows: handoffRows,
    implementation_file_manifest_candidate_rows: manifestRows,
    fixture_smoke_plan_candidate_rows: smokeRows,
    reviewer_handoff_note_candidate_rows: reviewerRows,
  };
}

function safePathSegment(value) {
  return String(value).replace(/^req\./, "").replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
}

function toPascalCase(value) {
  return String(value)
    .replace(/^req\./, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
