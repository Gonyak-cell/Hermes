import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_HANDOFF_PACKAGE_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationHandoffPackage,
  runWorkOsStaticBundleReviewUiImplementationHandoffPackage,
} from "../src/work-os-static-bundle-review-ui-implementation-handoff-package.mjs";
import { ALL_FALSE_FLAGS as P39200_FALSE_FLAGS } from "../src/work-os-static-bundle-review-ui-implementation-binding-candidate.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P39600 opens implementation handoff package when P39200 source is ready", async () => {
  const source = buildP39200Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationHandoffPackage({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationBindingCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-ui-implementation-handoff-package.v1");
  assert.equal(result.program_range, "P39201-P39600");
  assert.equal(result.source_program_range, "P38801-P39200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_handoff_package_status, "ready_for_work_os_static_bundle_review_ui_implementation_handoff_package");
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_implementation_handoff_package, true);
  assert.equal(result.summary.source_p39200_ready_for_implementation_handoff_package, true);
  assert.equal(result.implementation_handoff_package_candidate_rows.length, 3);
  assert.equal(result.implementation_file_manifest_candidate_rows.length, 3);
  assert.equal(result.fixture_smoke_plan_candidate_rows.length, 3);
  assert.equal(result.reviewer_handoff_note_candidate_rows.length, 3);
  assert.ok(result.no_implementation_boundary_rows.length >= 900);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_handoff_package_boundary.p39600_contract_ready, true);

  for (const flag of WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_HANDOFF_PACKAGE_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_ui_implementation_handoff_package_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P39600 remains a valid visible block when P39200 source is not ready", async () => {
  const source = buildP39200Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewUiImplementationHandoffPackage({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationBindingCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_handoff_package_status, "valid_block_work_os_static_bundle_review_ui_implementation_handoff_package_pending");
  assert.equal(result.summary.source_p39200_ready_for_implementation_handoff_package, false);
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_implementation_handoff_package, false);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_handoff_package_boundary.p39600_contract_ready, true);
  assert.equal(result.p39600_clean_checkpoint_rows.find((row) => row.row_id === "p39600_checkpoint.next_handoff_blocker_visible").current_verdict, "pass");
});

test("implementation handoff package never creates, writes, applies, builds, or runs browser work", async () => {
  const source = buildP39200Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationHandoffPackage({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationBindingCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.file_write_allowed_count, 0);
  assert.equal(result.summary.template_apply_allowed_count, 0);
  assert.equal(result.summary.fixture_execution_allowed_count, 0);
  assert.equal(result.summary.build_allowed_count, 0);
  assert.ok(result.implementation_handoff_package_candidate_rows.every((row) => row.file_create_allowed_now === false));
  assert.ok(result.implementation_handoff_package_candidate_rows.every((row) => row.file_write_allowed_now === false));
  assert.ok(result.implementation_handoff_package_candidate_rows.every((row) => row.file_apply_allowed_now === false));
  assert.ok(result.implementation_file_manifest_candidate_rows.every((row) => row.generated_file_apply_allowed_now === false));
  assert.ok(result.implementation_file_manifest_candidate_rows.every((row) => row.template_apply_allowed_now === false));
  assert.ok(result.implementation_file_manifest_candidate_rows.every((row) => row.component_write_allowed_now === false));
  assert.ok(result.implementation_file_manifest_candidate_rows.every((row) => row.css_write_allowed_now === false));
  assert.ok(result.fixture_smoke_plan_candidate_rows.every((row) => row.fixture_execution_allowed_now === false));
  assert.ok(result.fixture_smoke_plan_candidate_rows.every((row) => row.browser_run_allowed_now === false));
  assert.ok(result.fixture_smoke_plan_candidate_rows.every((row) => row.visual_smoke_execution_allowed_now === false));
  assert.ok(result.fixture_smoke_plan_candidate_rows.every((row) => row.screenshot_capture_allowed_now === false));
});

test("fixture and reviewer handoff rows preserve metadata without review authority", async () => {
  const source = buildP39200Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationHandoffPackage({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationBindingCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.receipt_accept_allowed_count, 0);
  assert.equal(result.summary.review_completion_allowed_count, 0);
  assert.ok(result.fixture_smoke_plan_candidate_rows.every((row) => row.expected_state_refs.length === 3));
  assert.ok(result.fixture_smoke_plan_candidate_rows.every((row) => row.smoke_command_hint.includes("implementation-handoff-package")));
  assert.ok(result.reviewer_handoff_note_candidate_rows.every((row) => row.reviewer_context_refs.length >= 4));
  assert.ok(result.reviewer_handoff_note_candidate_rows.every((row) => row.blocked_authority_note.includes("Metadata handoff only")));
  assert.ok(result.reviewer_handoff_note_candidate_rows.every((row) => row.receipt_accept_allowed_now === false));
  assert.ok(result.reviewer_handoff_note_candidate_rows.every((row) => row.reviewer_dispatch_allowed_now === false));
  assert.ok(result.reviewer_handoff_note_candidate_rows.every((row) => row.review_completion_allowed_now === false));
  assert.ok(result.reviewer_handoff_note_candidate_rows.every((row) => row.final_approval_allowed_now === false));
  assert.ok(result.reviewer_handoff_note_candidate_rows.every((row) => row.production_pass_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_static_bundle_review_ui_implementation_handoff_package_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing implementation handoff package artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p39600-"));
  try {
    const source = buildP39200Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewUiImplementationHandoffPackage({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleReviewUiImplementationBindingCandidate: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-ui-implementation-handoff-package.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

function buildP39200Source({ ready }) {
  const requests = ["req.product_contract", "req.project_control_plane", "req.commercial_spec"];
  const filePlanRows = requests.map((requestId) => ({
    row_id: `implementation_file_plan_candidate.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    file_plan_ref: `work_os.static_bundle_review.implementation.${requestId}.file_plan`,
    proposed_component_path: `src/ui/work-os/static-bundle-review/${safePathSegment(requestId)}.tsx`,
    proposed_test_path: `test/ui/work-os/static-bundle-review/${safePathSegment(requestId)}.test.mjs`,
    proposed_style_path: `src/ui/work-os/static-bundle-review/${safePathSegment(requestId)}.css`,
    route_path: `/api/work-os/static-bundle-review/${requestId}`,
    file_plan_visible_now: true,
    file_create_allowed_now: false,
    file_write_allowed_now: false,
    file_apply_allowed_now: false,
    generated_file_apply_allowed_now: false,
  }));
  const componentRows = requests.map((requestId) => ({
    row_id: `component_binding_candidate.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    component_binding_ref: `work_os.static_bundle_review.implementation.${requestId}.component_binding`,
    file_plan_ref: `work_os.static_bundle_review.implementation.${requestId}.file_plan`,
    screen_package_ref: `work_os.static_bundle_review.ui_handoff.${requestId}.screen_package`,
    screen_id: "work_os.static_bundle_review.static_shell",
    slot_id: `static_bundle_review_card.${requestId}`,
    component_name: `StaticBundleReview${toPascalCase(requestId)}Card`,
    component_binding_visible_now: true,
    template_apply_allowed_now: false,
    template_write_allowed_now: false,
    component_write_allowed_now: false,
    css_write_allowed_now: false,
    asset_copy_allowed_now: false,
  }));
  const dataRows = requests.map((requestId) => ({
    row_id: `read_only_data_binding_candidate.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    data_binding_ref: `work_os.static_bundle_review.implementation.${requestId}.data_binding`,
    component_binding_ref: `work_os.static_bundle_review.implementation.${requestId}.component_binding`,
    route_path: `/api/work-os/static-bundle-review/${requestId}`,
    allowed_methods: ["GET"],
    static_data_source_ref: `work_os.static_bundle_review.ui_handoff.${requestId}.screen_package`,
    data_binding_visible_now: true,
    network_fetch_allowed_now: false,
    runtime_fetch_allowed_now: false,
    state_mutation_allowed_now: false,
    raw_payload_exposure_allowed_now: false,
    review_receipt_accept_allowed_now: false,
  }));
  const tokenRows = requests.map((requestId) => ({
    row_id: `visual_token_binding_candidate.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    visual_token_binding_ref: `work_os.static_bundle_review.implementation.${requestId}.visual_tokens`,
    component_binding_ref: `work_os.static_bundle_review.implementation.${requestId}.component_binding`,
    data_binding_ref: `work_os.static_bundle_review.implementation.${requestId}.data_binding`,
    operator_view_ref: `work_os.static_bundle_review.ui_handoff.${requestId}.operator_view`,
    token_refs: [
      "work_os.surface.panel",
      "work_os.status.blocked",
      "work_os.control.disabled",
      "work_os.review.badge",
    ],
    visual_token_binding_visible_now: true,
    asset_build_allowed_now: false,
    live_render_allowed_now: false,
    browser_smoke_allowed_now: false,
    screenshot_capture_allowed_now: false,
    click_action_allowed_now: false,
  }));

  return {
    schema_version: "work-os-static-bundle-review-ui-implementation-binding-candidate.v1",
    generated_at: RUN_AT,
    capability_id: "platform.work_os_static_bundle_review_ui_implementation_binding_candidate",
    program_range: "P38801-P39200",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      work_os_static_bundle_review_ui_implementation_binding_status: ready
        ? "ready_for_work_os_static_bundle_review_ui_implementation_binding_candidate"
        : "valid_block_work_os_static_bundle_review_ui_implementation_binding_candidate_pending",
      ready_for_work_os_static_bundle_review_ui_implementation_binding_handoff: ready,
    },
    work_os_static_bundle_review_ui_implementation_binding_boundary: {
      p39200_contract_ready: true,
      ready_for_work_os_static_bundle_review_ui_implementation_binding_handoff: ready,
      source_p38800_ready_for_implementation_binding: true,
      source_validation_valid_now: true,
      implementation_file_plan_candidate_visible_now: true,
      component_binding_candidate_visible_now: true,
      read_only_data_binding_candidate_visible_now: true,
      visual_token_binding_candidate_visible_now: true,
      no_file_apply_no_build_boundary_closed_now: true,
      work_os_static_bundle_review_ui_implementation_binding_wiring_complete_now: true,
      ...Object.fromEntries(P39200_FALSE_FLAGS.map((flag) => [flag, false])),
    },
    implementation_file_plan_candidate_rows: filePlanRows,
    component_binding_candidate_rows: componentRows,
    read_only_data_binding_candidate_rows: dataRows,
    visual_token_binding_candidate_rows: tokenRows,
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
