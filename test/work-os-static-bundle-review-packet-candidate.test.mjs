import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  WORK_OS_STATIC_BUNDLE_REVIEW_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewPacketCandidate,
  runWorkOsStaticBundleReviewPacketCandidate,
} from "../src/work-os-static-bundle-review-packet-candidate.mjs";
import { ALL_FALSE_FLAGS as P37200_FALSE_FLAGS } from "../src/work-os-plan-state-static-bundle-handoff.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P37600 opens static bundle review packet handoff when P37200 source is ready", async () => {
  const source = buildP37200Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewPacketCandidate({
    runAt: RUN_AT,
    workOsStaticBundleHandoff: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-packet-candidate.v1");
  assert.equal(result.program_range, "P37201-P37600");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_status, "ready_for_work_os_static_bundle_review_packet_candidate");
  assert.equal(result.summary.ready_for_work_os_review_request_handoff, true);
  assert.equal(result.static_bundle_review_packet_candidate_rows.length, 3);
  assert.equal(result.review_evidence_summary_rows.length, 3);
  assert.equal(result.finding_seed_rows.length, 9);
  assert.equal(result.reviewer_lane_request_candidate_rows.length, 3);
  assert.ok(result.no_review_completion_boundary_rows.length >= 760);
  assert.equal(result.work_os_static_bundle_review_boundary.p37600_contract_ready, true);

  for (const flag of WORK_OS_STATIC_BUNDLE_REVIEW_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P37600 remains a valid visible block when P37200 handoff is not ready", async () => {
  const source = buildP37200Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewPacketCandidate({
    runAt: RUN_AT,
    workOsStaticBundleHandoff: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_status, "valid_block_work_os_static_bundle_review_packet_candidate_pending");
  assert.equal(result.summary.source_p37200_ready_for_review_packet, false);
  assert.equal(result.summary.ready_for_work_os_review_request_handoff, false);
  assert.equal(result.work_os_static_bundle_review_boundary.p37600_contract_ready, true);
  assert.equal(result.p37600_clean_checkpoint_rows.find((row) => row.row_id === "p37600_checkpoint.review_completion_blocked").current_verdict, "pass");
});

test("review packet and evidence rows never become review completion or receipt acceptance", async () => {
  const source = buildP37200Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewPacketCandidate({
    runAt: RUN_AT,
    workOsStaticBundleHandoff: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.review_completion_allowed_count, 0);
  assert.equal(result.summary.review_receipt_create_allowed_count, 0);
  assert.ok(result.static_bundle_review_packet_candidate_rows.every((row) => row.packet_visible_now === true));
  assert.ok(result.static_bundle_review_packet_candidate_rows.every((row) => row.review_completion_allowed_now === false));
  assert.ok(result.static_bundle_review_packet_candidate_rows.every((row) => row.review_receipt_create_allowed_now === false));
  assert.ok(result.review_evidence_summary_rows.every((row) => row.evidence_summary_visible_now === true));
  assert.ok(result.review_evidence_summary_rows.every((row) => row.evidence_complete_now === false));
  assert.ok(result.review_evidence_summary_rows.every((row) => row.review_receipt_accept_allowed_now === false));
});

test("finding and reviewer lane rows never resolve, dispatch, execute, or adjudicate", async () => {
  const source = buildP37200Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewPacketCandidate({
    runAt: RUN_AT,
    workOsStaticBundleHandoff: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.finding_resolution_allowed_count, 0);
  assert.equal(result.summary.reviewer_dispatch_allowed_count, 0);
  assert.ok(result.finding_seed_rows.every((row) => row.finding_seed_visible_now === true));
  assert.ok(result.finding_seed_rows.every((row) => row.finding_resolution_allowed_now === false));
  assert.ok(result.finding_seed_rows.every((row) => row.review_completion_allowed_now === false));
  assert.ok(result.finding_seed_rows.every((row) => row.closeout_allowed_now === false));
  assert.ok(result.reviewer_lane_request_candidate_rows.every((row) => row.request_visible_now === true));
  assert.ok(result.reviewer_lane_request_candidate_rows.every((row) => row.reviewer_lane_dispatch_allowed_now === false));
  assert.ok(result.reviewer_lane_request_candidate_rows.every((row) => row.claude_review_execution_allowed_now === false));
  assert.ok(result.reviewer_lane_request_candidate_rows.every((row) => row.human_adjudication_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_static_bundle_review_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing review packet artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p37600-"));
  try {
    const source = buildP37200Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewPacketCandidate({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleHandoff: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-packet-candidate.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

function buildP37200Source({ ready }) {
  const requests = ["req.product_contract", "req.project_control_plane", "req.commercial_spec"];
  const previewRows = requests.map((requestId) => ({
    row_id: `operator_preview_bundle.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    preview_bundle_ref: `operator.preview_bundle.${requestId}.candidate`,
    handoff_package_ref: `work_os.static_bundle.${requestId}.handoff.candidate`,
    operator_status: "blocked_static_bundle_preview_candidate_only",
    preview_visible_now: true,
    apply_button_enabled_now: false,
    download_button_enabled_now: false,
    file_apply_allowed_now: false,
  }));
  const manifestRows = requests.map((requestId) => ({
    row_id: `static_bundle_manifest_candidate.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    bundle_manifest_ref: `work_os.static_bundle.${requestId}.manifest.candidate`,
    manifest_visible_now: true,
    manifest_publish_allowed_now: false,
    artifact_persist_allowed_now: false,
  }));
  const filePlanRows = requests.map((requestId) => ({
    row_id: `static_bundle_file_plan_candidate.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    bundle_manifest_ref: `work_os.static_bundle.${requestId}.manifest.candidate`,
    planned_files: [`static/${requestId}/index.html`, `static/${requestId}/manifest.json`],
    file_plan_visible_now: true,
    file_write_allowed_now: false,
    file_apply_allowed_now: false,
    asset_copy_allowed_now: false,
    shell_overwrite_allowed_now: false,
  }));
  const packageRows = requests.map((requestId) => ({
    row_id: `static_bundle_handoff_package.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    handoff_package_ref: `work_os.static_bundle.${requestId}.handoff.candidate`,
    bundle_manifest_ref: `work_os.static_bundle.${requestId}.manifest.candidate`,
    handoff_package_visible_now: true,
    generated_file_apply_allowed_now: false,
    preview_server_allowed_now: false,
    live_mount_allowed_now: false,
    runtime_fetch_allowed_now: false,
  }));

  return {
    schema_version: "work-os-plan-state-static-bundle-handoff.v1",
    generated_at: RUN_AT,
    capability_id: "platform.work_os_plan_state_static_bundle_handoff",
    program_range: "P36801-P37200",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      work_os_static_bundle_status: ready
        ? "ready_for_work_os_plan_state_static_bundle_handoff"
        : "valid_block_work_os_plan_state_static_bundle_handoff_pending",
      ready_for_work_os_preview_bundle_handoff: ready,
    },
    work_os_static_bundle_boundary: {
      p37200_contract_ready: true,
      ready_for_work_os_preview_bundle_handoff: ready,
      static_bundle_manifest_candidate_visible_now: true,
      static_bundle_file_plan_candidate_visible_now: true,
      static_bundle_handoff_package_visible_now: true,
      operator_preview_bundle_visible_now: true,
      no_generated_file_apply_boundary_closed_now: true,
      work_os_static_bundle_wiring_complete_now: true,
      ...Object.fromEntries(P37200_FALSE_FLAGS.map((flag) => [flag, false])),
    },
    static_bundle_manifest_candidate_rows: manifestRows,
    static_bundle_file_plan_candidate_rows: filePlanRows,
    static_bundle_handoff_package_rows: packageRows,
    operator_preview_bundle_rows: previewRows,
  };
}
