import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  STATIC_SHELL_FILE_PLAN_CANDIDATE_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellFilePlanCandidate,
  runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellFilePlanCandidate,
} from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-file-plan-candidate.mjs";
import { buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff } from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-assembly-handoff.mjs";

const RUN_AT = "2026-06-07T22:56:16.215Z";

test("P53200 opens P53201 handoff when P52800 source is ready and file plan authority stays closed", async () => {
  const source = await buildP52800Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellFilePlanCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-file-plan-candidate.v1");
  assert.equal(result.program_range, "P52801-P53200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_file_plan_candidate_status, "ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_file_plan_candidate");
  assert.equal(result.summary.ready_for_p53201_handoff, true);
  assert.equal(result.static_shell_file_plan_candidate_rows.length, 8);
  assert.equal(result.template_file_target_candidate_rows.length, 8);
  assert.equal(result.state_copy_integration_candidate_rows.length, 8);
  assert.equal(result.asset_token_candidate_rows.length, 8);
  assert.equal(result.no_write_no_build_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_write_no_build_boundary_rows.length >= 1200);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_file_plan_candidate_boundary.p53200_contract_ready, true);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_file_plan_candidate_boundary.ready_for_p53201_handoff, true);

  for (const flag of STATIC_SHELL_FILE_PLAN_CANDIDATE_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_file_plan_candidate_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P53200 remains a valid visible block when P52800 source handoff is not ready", async () => {
  const source = await buildP52800Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellFilePlanCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_file_plan_candidate_status, "valid_block_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_file_plan_candidate_pending");
  assert.equal(result.summary.source_p52800_ready_for_p52801_handoff, false);
  assert.equal(result.summary.ready_for_p53201_handoff, false);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_file_plan_candidate_boundary.p53200_contract_ready, true);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_file_plan_candidate_boundary.ready_for_p53201_handoff, false);
  assert.equal(result.p53200_clean_checkpoint_rows.find((row) => row.row_id === "p53200_checkpoint.p53201_handoff_blocker_visible").current_verdict, "pass");
});

test("file plan candidates never create files, write templates, build, render, hydrate, click, write, or mutate", async () => {
  const source = await buildP52800Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellFilePlanCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff: source,
    commitRef: "abc1234",
  });

  assert.ok(result.static_shell_file_plan_candidate_rows.every((row) => row.file_create_allowed_now === false));
  assert.ok(result.static_shell_file_plan_candidate_rows.every((row) => row.file_write_allowed_now === false));
  assert.ok(result.static_shell_file_plan_candidate_rows.every((row) => row.template_apply_allowed_now === false));
  assert.ok(result.static_shell_file_plan_candidate_rows.every((row) => row.build_allowed_now === false));
  assert.ok(result.static_shell_file_plan_candidate_rows.every((row) => row.dom_render_allowed_now === false));
  assert.ok(result.static_shell_file_plan_candidate_rows.every((row) => row.client_hydration_allowed_now === false));
  assert.ok(result.static_shell_file_plan_candidate_rows.every((row) => row.click_action_allowed_now === false));
  assert.ok(result.static_shell_file_plan_candidate_rows.every((row) => row.write_allowed_now === false));
  assert.ok(result.static_shell_file_plan_candidate_rows.every((row) => row.state_mutation_allowed_now === false));
  assert.ok(result.template_file_target_candidate_rows.every((row) => row.file_write_allowed_now === false));
  assert.ok(result.template_file_target_candidate_rows.every((row) => row.template_write_allowed_now === false));
  assert.ok(result.asset_token_candidate_rows.every((row) => row.asset_import_allowed_now === false));
  assert.ok(result.asset_token_candidate_rows.every((row) => row.asset_build_allowed_now === false));
  assert.ok(result.asset_token_candidate_rows.every((row) => row.css_write_allowed_now === false));
});

test("state/copy integration candidates stay read-only and advisory", async () => {
  const source = await buildP52800Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellFilePlanCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff: source,
    commitRef: "abc1234",
  });

  assert.ok(result.state_copy_integration_candidate_rows.every((row) => row.read_only === true));
  assert.ok(result.state_copy_integration_candidate_rows.every((row) => row.advisory_only === true));
  assert.ok(result.state_copy_integration_candidate_rows.every((row) => row.allowed_methods.join(",") === "GET,HEAD"));
  assert.ok(result.state_copy_integration_candidate_rows.every((row) => row.raw_payload_included === false));
  assert.ok(result.state_copy_integration_candidate_rows.every((row) => row.client_hydration_allowed_now === false));
  assert.ok(result.state_copy_integration_candidate_rows.every((row) => row.network_fetch_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_file_plan_candidate_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing static shell file plan candidate artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p53200-"));
  try {
    const source = await buildP52800Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellFilePlanCandidate({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-file-plan-candidate.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP52800Source({ ready }) {
  const source = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_p52801_handoff = ready;
  source.summary.source_p52400_ready_for_p52401_handoff = true;
  source.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_boundary.ready_for_p52801_handoff = ready;
  source.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_boundary.source_p52400_ready_for_p52401_handoff = true;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
