import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_API_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel,
  runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel,
} from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-api-read-model.mjs";
import { buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewPacketCandidate } from "../src/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-packet-candidate.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P45200 opens implementation review API read model when P44800 source is ready", async () => {
  const source = await buildP44800Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewPacketCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-api-read-model.v1");
  assert.equal(result.program_range, "P44801-P45200");
  assert.equal(result.source_program_range, "P44401-P44800");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_status, "ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_read_model");
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_handoff, true);
  assert.equal(result.summary.source_p44800_ready_for_implementation_review_api, true);
  assert.equal(result.implementation_review_api_response_candidate_rows.length, 8);
  assert.equal(result.implementation_review_route_contract_rows.length, 8);
  assert.equal(result.implementation_review_ui_consumer_fixture_rows.length, 8);
  assert.equal(result.implementation_review_read_only_payload_shape_rows.length, 8);
  assert.ok(result.no_mutation_review_execution_boundary_rows.length >= 1130);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_boundary.p45200_contract_ready, true);

  for (const flag of WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_API_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P45200 remains a valid visible block when P44800 handoff is not ready", async () => {
  const source = await buildP44800Source({ ready: false });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewPacketCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_status, "valid_block_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_read_model_pending");
  assert.equal(result.summary.source_p44800_ready_for_implementation_review_api, false);
  assert.equal(result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_handoff, false);
  assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_boundary.p45200_contract_ready, true);
  assert.equal(result.p45200_clean_checkpoint_rows.find((row) => row.row_id === "p45200_checkpoint.review_execution_blocked").current_verdict, "pass");
});

test("implementation review API route contracts stay GET-only and never open runtime routes or writes", async () => {
  const source = await buildP44800Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewPacketCandidate: source,
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
  const source = await buildP44800Source({ ready: true });
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel({
    runAt: RUN_AT,
    workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewPacketCandidate: source,
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
    assert.equal(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing implementation review API artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p45200-"));
  try {
    const source = await buildP44800Source({ ready: true });
    const result = await runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewPacketCandidate: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-api-read-model.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP44800Source({ ready }) {
  const source = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewPacketCandidate({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_request_handoff = ready;
  source.work_os_static_bundle_review_ui_implementation_review_boundary.ready_for_work_os_static_bundle_review_ui_implementation_review_request_handoff = ready;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
