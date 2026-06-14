import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewPacketCandidate,
  runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewPacketCandidate,
} from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-packet-candidate.mjs";
import {
  ALL_FALSE_FLAGS as P49200_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationHandoffPackage,
} from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-handoff-package.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P49600 opens implementation review packet candidate when P49200 source is ready", async () => {
  const source = await buildP49200Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewPacketCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationHandoffPackage: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-packet-candidate.v1");
  assert.equal(result.program_range, "P49201-P49600");
  assert.equal(result.source_program_range, "P48801-P49200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_status, "ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_packet_candidate");
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_request_handoff, true);
  assert.equal(result.summary.source_p49200_ready_for_implementation_review_packet, true);
  assert.equal(result.implementation_review_packet_candidate_rows.length, 8);
  assert.equal(result.implementation_review_evidence_summary_rows.length, 8);
  assert.equal(result.implementation_finding_seed_rows.length, 32);
  assert.equal(result.implementation_reviewer_lane_request_candidate_rows.length, 8);
  assert.ok(result.no_review_completion_boundary_rows.length >= 1200);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_boundary.p49600_contract_ready, true);

  for (const flag of WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_ui_implementation_review_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P49600 remains a valid visible block when P49200 source is not ready", async () => {
  const source = await buildP49200Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewPacketCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationHandoffPackage: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_status, "valid_block_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_packet_candidate_pending");
  assert.equal(result.summary.source_p49200_ready_for_implementation_review_packet, false);
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_request_handoff, false);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_boundary.p49600_contract_ready, true);
  assert.equal(result.p49600_clean_checkpoint_rows.find((row) => row.row_id === "p49600_checkpoint.review_completion_blocked").current_verdict, "pass");
});

test("implementation review packet and evidence rows never become review receipt or file apply authority", async () => {
  const source = await buildP49200Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewPacketCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationHandoffPackage: source,
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
  const source = await buildP49200Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewPacketCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationHandoffPackage: source,
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
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p49600-"));
  try {
    const source = await buildP49200Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewPacketCandidate({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationHandoffPackage: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-packet-candidate.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP49200Source({ ready }) {
  const source = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationHandoffPackage({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_p49201_handoff = ready;
  source.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_handoff_package_boundary.ready_for_p49201_handoff = ready;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
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
