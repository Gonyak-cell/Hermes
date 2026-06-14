import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  STATIC_SHELL_IMPLEMENTATION_BINDING_CANDIDATE_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationBindingCandidate,
  runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationBindingCandidate,
} from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-binding-candidate.mjs";
import { buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellFilePlanCandidate } from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-file-plan-candidate.mjs";

const RUN_AT = "2026-06-07T23:16:16.303Z";

test("P58400 opens P58401 handoff when P58000 source is ready and implementation authority stays closed", async () => {
  const source = await buildP58000Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationBindingCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellFilePlanCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-binding-candidate.v1");
  assert.equal(result.program_range, "P58001-P58400");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_binding_candidate_status, "ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_binding_candidate");
  assert.equal(result.summary.ready_for_p58401_handoff, true);
  assert.equal(result.implementation_placement_candidate_rows.length, 8);
  assert.equal(result.component_template_binding_candidate_rows.length, 8);
  assert.equal(result.read_only_data_binding_candidate_rows.length, 8);
  assert.equal(result.visual_token_binding_candidate_rows.length, 8);
  assert.equal(result.no_authority_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_authority_boundary_rows.length >= 1200);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_binding_candidate_boundary.p58400_contract_ready, true);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_binding_candidate_boundary.ready_for_p58401_handoff, true);

  for (const flag of STATIC_SHELL_IMPLEMENTATION_BINDING_CANDIDATE_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_binding_candidate_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P58400 remains a valid visible block when P58000 source handoff is not ready", async () => {
  const source = await buildP58000Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationBindingCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellFilePlanCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_binding_candidate_status, "valid_block_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_binding_candidate_pending");
  assert.equal(result.summary.source_p58000_ready_for_p58001_handoff, false);
  assert.equal(result.summary.ready_for_p58401_handoff, false);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_binding_candidate_boundary.p58400_contract_ready, true);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_binding_candidate_boundary.ready_for_p58401_handoff, false);
  assert.equal(result.p58400_clean_checkpoint_rows.find((row) => row.row_id === "p58400_checkpoint.p58401_handoff_blocker_visible").current_verdict, "pass");
});

test("implementation binding candidates never create files, write components, register routes, render, hydrate, click, write, or mutate", async () => {
  const source = await buildP58000Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationBindingCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellFilePlanCandidate: source,
    commitRef: "abc1234",
  });

  assert.ok(result.implementation_placement_candidate_rows.every((row) => row.file_create_allowed_now === false));
  assert.ok(result.implementation_placement_candidate_rows.every((row) => row.file_write_allowed_now === false));
  assert.ok(result.implementation_placement_candidate_rows.every((row) => row.component_write_allowed_now === false));
  assert.ok(result.implementation_placement_candidate_rows.every((row) => row.route_registration_allowed_now === false));
  assert.ok(result.implementation_placement_candidate_rows.every((row) => row.dom_render_allowed_now === false));
  assert.ok(result.component_template_binding_candidate_rows.every((row) => row.template_apply_allowed_now === false));
  assert.ok(result.component_template_binding_candidate_rows.every((row) => row.component_write_allowed_now === false));
  assert.ok(result.read_only_data_binding_candidate_rows.every((row) => row.client_hydration_allowed_now === false));
  assert.ok(result.read_only_data_binding_candidate_rows.every((row) => row.network_fetch_allowed_now === false));
  assert.ok(result.read_only_data_binding_candidate_rows.every((row) => row.click_action_allowed_now === false));
  assert.ok(result.read_only_data_binding_candidate_rows.every((row) => row.state_mutation_allowed_now === false));
  assert.ok(result.visual_token_binding_candidate_rows.every((row) => row.css_write_allowed_now === false));
  assert.ok(result.visual_token_binding_candidate_rows.every((row) => row.asset_import_allowed_now === false));
  assert.ok(result.visual_token_binding_candidate_rows.every((row) => row.asset_build_allowed_now === false));
});

test("read-only data binding candidates preserve metadata without raw payload exposure", async () => {
  const source = await buildP58000Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationBindingCandidate({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellFilePlanCandidate: source,
    commitRef: "abc1234",
  });

  assert.ok(result.read_only_data_binding_candidate_rows.every((row) => row.read_only === true));
  assert.ok(result.read_only_data_binding_candidate_rows.every((row) => row.advisory_only === true));
  assert.ok(result.read_only_data_binding_candidate_rows.every((row) => row.allowed_methods.join(",") === "GET,HEAD"));
  assert.ok(result.read_only_data_binding_candidate_rows.every((row) => row.raw_payload_included === false));
  assert.ok(result.read_only_data_binding_candidate_rows.every((row) => row.summary_field_refs.length === 3));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_binding_candidate_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing static shell implementation binding artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p58400-"));
  try {
    const source = await buildP58000Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationBindingCandidate({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellFilePlanCandidate: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-binding-candidate.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP58000Source({ ready }) {
  const source = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellFilePlanCandidate({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_p58001_handoff = ready;
  source.summary.source_p57600_ready_for_p57601_handoff = true;
  source.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_file_plan_candidate_boundary.ready_for_p58001_handoff = ready;
  source.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_file_plan_candidate_boundary.source_p57600_ready_for_p57601_handoff = true;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
