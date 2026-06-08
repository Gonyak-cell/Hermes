import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  WORK_OS_STATIC_BUNDLE_FALSE_FLAGS,
  buildWorkOsPlanStateStaticBundleHandoff,
  runWorkOsPlanStateStaticBundleHandoff,
} from "../src/work-os-plan-state-static-bundle-handoff.mjs";
import { ALL_FALSE_FLAGS as P36800_FALSE_FLAGS } from "../src/work-os-plan-state-static-ui-adapter.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P37200 opens preview bundle handoff when P36800 source is ready", async () => {
  const source = buildP36800Source({ ready: true });
  const result = await buildWorkOsPlanStateStaticBundleHandoff({
    runAt: RUN_AT,
    workOsPlanStateStaticUiAdapter: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-plan-state-static-bundle-handoff.v1");
  assert.equal(result.program_range, "P36801-P37200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_status, "ready_for_work_os_plan_state_static_bundle_handoff");
  assert.equal(result.summary.ready_for_work_os_preview_bundle_handoff, true);
  assert.equal(result.static_bundle_manifest_candidate_rows.length, 3);
  assert.equal(result.static_bundle_file_plan_candidate_rows.length, 3);
  assert.equal(result.static_bundle_handoff_package_rows.length, 3);
  assert.equal(result.operator_preview_bundle_rows.length, 3);
  assert.ok(result.no_generated_file_apply_boundary_rows.length >= 730);
  assert.equal(result.work_os_static_bundle_boundary.p37200_contract_ready, true);

  for (const flag of WORK_OS_STATIC_BUNDLE_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_static_bundle_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P37200 remains a valid visible block when P36800 handoff is not ready", async () => {
  const source = buildP36800Source({ ready: false });
  const result = await buildWorkOsPlanStateStaticBundleHandoff({
    runAt: RUN_AT,
    workOsPlanStateStaticUiAdapter: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_static_bundle_status, "valid_block_work_os_plan_state_static_bundle_handoff_pending");
  assert.equal(result.summary.source_p36800_ready_for_static_bundle, false);
  assert.equal(result.summary.ready_for_work_os_preview_bundle_handoff, false);
  assert.equal(result.work_os_static_bundle_boundary.p37200_contract_ready, true);
  assert.equal(result.p37200_clean_checkpoint_rows.find((row) => row.row_id === "p37200_checkpoint.file_apply_blocked").current_verdict, "pass");
});

test("bundle manifest and file plan never write or apply generated files", async () => {
  const source = buildP36800Source({ ready: true });
  const result = await buildWorkOsPlanStateStaticBundleHandoff({
    runAt: RUN_AT,
    workOsPlanStateStaticUiAdapter: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.file_write_allowed_count, 0);
  assert.equal(result.summary.file_apply_allowed_count, 0);
  assert.equal(result.summary.generated_file_apply_allowed_count, 0);
  assert.ok(result.static_bundle_manifest_candidate_rows.every((row) => row.manifest_visible_now === true));
  assert.ok(result.static_bundle_manifest_candidate_rows.every((row) => row.manifest_publish_allowed_now === false));
  assert.ok(result.static_bundle_manifest_candidate_rows.every((row) => row.artifact_persist_allowed_now === false));
  assert.ok(result.static_bundle_file_plan_candidate_rows.every((row) => row.file_plan_visible_now === true));
  assert.ok(result.static_bundle_file_plan_candidate_rows.every((row) => row.file_write_allowed_now === false));
  assert.ok(result.static_bundle_file_plan_candidate_rows.every((row) => row.file_apply_allowed_now === false));
  assert.ok(result.static_bundle_file_plan_candidate_rows.every((row) => row.asset_copy_allowed_now === false));
  assert.ok(result.static_bundle_file_plan_candidate_rows.every((row) => row.shell_overwrite_allowed_now === false));
});

test("handoff package and operator preview never become apply authority", async () => {
  const source = buildP36800Source({ ready: true });
  const result = await buildWorkOsPlanStateStaticBundleHandoff({
    runAt: RUN_AT,
    workOsPlanStateStaticUiAdapter: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.preview_server_allowed_count, 0);
  assert.ok(result.static_bundle_handoff_package_rows.every((row) => row.handoff_package_visible_now === true));
  assert.ok(result.static_bundle_handoff_package_rows.every((row) => row.generated_file_apply_allowed_now === false));
  assert.ok(result.static_bundle_handoff_package_rows.every((row) => row.preview_server_allowed_now === false));
  assert.ok(result.static_bundle_handoff_package_rows.every((row) => row.live_mount_allowed_now === false));
  assert.ok(result.operator_preview_bundle_rows.every((row) => row.preview_visible_now === true));
  assert.ok(result.operator_preview_bundle_rows.every((row) => row.apply_button_enabled_now === false));
  assert.ok(result.operator_preview_bundle_rows.every((row) => row.download_button_enabled_now === false));
  assert.ok(result.operator_preview_bundle_rows.every((row) => row.file_apply_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_static_bundle_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing static bundle artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p37200-"));
  try {
    const source = buildP36800Source({ ready: true });
    const result = await runWorkOsPlanStateStaticBundleHandoff({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsPlanStateStaticUiAdapter: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-plan-state-static-bundle-handoff.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

function buildP36800Source({ ready }) {
  const requests = ["req.product_contract", "req.project_control_plane", "req.commercial_spec"];
  const shellRows = requests.map((requestId) => ({
    row_id: `static_shell_fixture.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    static_shell_ref: `work_os.static_shell.${requestId}.fixture`,
    slot_id: `plan_state_card.${requestId}`,
    route_path: `/api/work-os/plan-state/${requestId}`,
    allowed_methods: ["GET"],
    expected_status: "blocked_read_only_projection_ready",
    fixture_visible_now: true,
    state_persist_allowed_now: false,
    form_submit_allowed_now: false,
    write_api_allowed_now: false,
  }));
  const interactionRows = requests.flatMap((requestId) => [
    "render_static_card",
    "display_blocker_count",
    "disabled_action_controls",
  ].map((interactionType) => ({
    row_id: `interaction_smoke.${requestId}.${interactionType}`,
    request_id: requestId,
    current_verdict: "pass",
    interaction_type: interactionType,
    smoke_visible_now: true,
    event_handler_mutation_allowed_now: false,
    action_button_allowed_now: false,
    status_edit_allowed_now: false,
  })));

  return {
    schema_version: "work-os-plan-state-static-ui-adapter.v1",
    generated_at: RUN_AT,
    capability_id: "platform.work_os_plan_state_static_ui_adapter",
    program_range: "P36401-P36800",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      work_os_plan_state_static_ui_status: ready
        ? "ready_for_work_os_plan_state_static_ui_adapter"
        : "valid_block_work_os_plan_state_static_ui_adapter_pending",
      ready_for_work_os_static_ui_handoff: ready,
    },
    work_os_plan_state_static_ui_boundary: {
      p36800_contract_ready: true,
      ready_for_work_os_static_ui_handoff: ready,
      static_ui_adapter_candidate_visible_now: true,
      screen_slot_binding_visible_now: true,
      static_shell_fixture_visible_now: true,
      interaction_smoke_visible_now: true,
      no_live_ui_mutation_boundary_closed_now: true,
      work_os_plan_state_static_ui_wiring_complete_now: true,
      ...Object.fromEntries(P36800_FALSE_FLAGS.map((flag) => [flag, false])),
    },
    static_shell_fixture_rows: shellRows,
    interaction_smoke_rows: interactionRows,
  };
}
