import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  STATIC_SHELL_IMPLEMENTATION_HANDOFF_PACKAGE_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationHandoffPackage,
  runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationHandoffPackage,
} from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-handoff-package.mjs";
import { buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationBindingCandidate } from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-binding-candidate.mjs";

const RUN_AT = "2026-06-09T00:33:49.585Z";

test("P54000 opens P54001 handoff when P53600 source is ready and implementation remains closed", async () => {
  const source = await buildP53600Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationHandoffPackage({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationBindingCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-handoff-package.v1");
  assert.equal(result.program_range, "P53601-P54000");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_handoff_package_status, "ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_handoff_package");
  assert.equal(result.summary.ready_for_p54001_handoff, true);
  assert.equal(result.handoff_package_candidate_rows.length, 8);
  assert.equal(result.implementation_file_manifest_candidate_rows.length, 8);
  assert.equal(result.fixture_smoke_plan_candidate_rows.length, 8);
  assert.equal(result.reviewer_handoff_note_candidate_rows.length, 8);
  assert.equal(result.no_implementation_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_implementation_boundary_rows.length >= 1200);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_handoff_package_boundary.p54000_contract_ready, true);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_handoff_package_boundary.ready_for_p54001_handoff, true);

  for (const flag of STATIC_SHELL_IMPLEMENTATION_HANDOFF_PACKAGE_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_handoff_package_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P54000 remains a valid visible block when P53600 source handoff is not ready", async () => {
  const source = await buildP53600Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationHandoffPackage({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationBindingCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_handoff_package_status, "valid_block_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_handoff_package_pending");
  assert.equal(result.summary.source_p53600_ready_for_p53601_handoff, false);
  assert.equal(result.summary.ready_for_p54001_handoff, false);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_handoff_package_boundary.p54000_contract_ready, true);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_handoff_package_boundary.ready_for_p54001_handoff, false);
  assert.equal(result.p54000_clean_checkpoint_rows.find((row) => row.row_id === "p54000_checkpoint.p54001_handoff_blocker_visible").current_verdict, "pass");
});

test("handoff package candidates never write files, run fixtures, build, render, run browsers, complete review, approve, or mutate", async () => {
  const source = await buildP53600Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationHandoffPackage({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationBindingCandidate: source,
    commitRef: "abc1234",
  });

  assert.ok(result.handoff_package_candidate_rows.every((row) => row.file_create_allowed_now === false));
  assert.ok(result.handoff_package_candidate_rows.every((row) => row.file_write_allowed_now === false));
  assert.ok(result.handoff_package_candidate_rows.every((row) => row.build_allowed_now === false));
  assert.ok(result.handoff_package_candidate_rows.every((row) => row.dom_render_allowed_now === false));
  assert.ok(result.handoff_package_candidate_rows.every((row) => row.browser_run_allowed_now === false));
  assert.ok(result.handoff_package_candidate_rows.every((row) => row.review_completion_allowed_now === false));
  assert.ok(result.implementation_file_manifest_candidate_rows.every((row) => row.file_create_allowed_now === false));
  assert.ok(result.implementation_file_manifest_candidate_rows.every((row) => row.file_write_allowed_now === false));
  assert.ok(result.implementation_file_manifest_candidate_rows.every((row) => row.component_write_allowed_now === false));
  assert.ok(result.fixture_smoke_plan_candidate_rows.every((row) => row.fixture_execution_allowed_now === false));
  assert.ok(result.fixture_smoke_plan_candidate_rows.every((row) => row.browser_run_allowed_now === false));
  assert.ok(result.fixture_smoke_plan_candidate_rows.every((row) => row.visual_smoke_execution_allowed_now === false));
  assert.ok(result.fixture_smoke_plan_candidate_rows.every((row) => row.screenshot_capture_allowed_now === false));
  assert.ok(result.reviewer_handoff_note_candidate_rows.every((row) => row.review_completion_allowed_now === false));
  assert.ok(result.reviewer_handoff_note_candidate_rows.every((row) => row.final_approval_allowed_now === false));
  assert.ok(result.reviewer_handoff_note_candidate_rows.every((row) => row.production_pass_allowed_now === false));
});

test("fixture and reviewer handoff rows preserve metadata without execution or authority", async () => {
  const source = await buildP53600Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationHandoffPackage({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationBindingCandidate: source,
    commitRef: "abc1234",
  });

  assert.ok(result.fixture_smoke_plan_candidate_rows.every((row) => row.expected_state_refs.length === 3));
  assert.ok(result.fixture_smoke_plan_candidate_rows.every((row) => row.smoke_command_hint.includes("implementation-handoff-package")));
  assert.ok(result.reviewer_handoff_note_candidate_rows.every((row) => row.reviewer_context_refs.length >= 2));
  assert.ok(result.reviewer_handoff_note_candidate_rows.every((row) => row.blocked_authority_note.includes("Metadata handoff only")));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_handoff_package_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing static shell implementation handoff package artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p54000-"));
  try {
    const source = await buildP53600Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationHandoffPackage({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationBindingCandidate: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-handoff-package.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP53600Source({ ready }) {
  const source = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationBindingCandidate({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_p53601_handoff = ready;
  source.summary.source_p53200_ready_for_p53201_handoff = true;
  source.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_binding_candidate_boundary.ready_for_p53601_handoff = ready;
  source.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_binding_candidate_boundary.source_p53200_ready_for_p53201_handoff = true;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
