import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  WORK_OS_PLAN_STATE_STATIC_UI_FALSE_FLAGS,
  buildWorkOsPlanStateStaticUiAdapter,
  runWorkOsPlanStateStaticUiAdapter,
} from "../src/work-os-plan-state-static-ui-adapter.mjs";
import { ALL_FALSE_FLAGS as P36400_FALSE_FLAGS } from "../src/work-os-plan-state-api-read-model.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P36800 opens static UI handoff when P36400 source is ready", async () => {
  const source = buildP36400Source({ ready: true });
  const result = await buildWorkOsPlanStateStaticUiAdapter({
    runAt: RUN_AT,
    workOsPlanStateApiReadModel: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-plan-state-static-ui-adapter.v1");
  assert.equal(result.program_range, "P36401-P36800");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_plan_state_static_ui_status, "ready_for_work_os_plan_state_static_ui_adapter");
  assert.equal(result.summary.ready_for_work_os_static_ui_handoff, true);
  assert.equal(result.static_ui_adapter_candidate_rows.length, 3);
  assert.equal(result.screen_slot_binding_rows.length, 3);
  assert.equal(result.static_shell_fixture_rows.length, 3);
  assert.equal(result.interaction_smoke_rows.length, 9);
  assert.ok(result.no_live_ui_mutation_boundary_rows.length >= 720);
  assert.equal(result.work_os_plan_state_static_ui_boundary.p36800_contract_ready, true);

  for (const flag of WORK_OS_PLAN_STATE_STATIC_UI_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_plan_state_static_ui_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P36800 remains a valid visible block when P36400 handoff is not ready", async () => {
  const source = buildP36400Source({ ready: false });
  const result = await buildWorkOsPlanStateStaticUiAdapter({
    runAt: RUN_AT,
    workOsPlanStateApiReadModel: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_plan_state_static_ui_status, "valid_block_work_os_plan_state_static_ui_adapter_pending");
  assert.equal(result.summary.source_p36400_ready_for_static_ui, false);
  assert.equal(result.summary.ready_for_work_os_static_ui_handoff, false);
  assert.equal(result.work_os_plan_state_static_ui_boundary.p36800_contract_ready, true);
  assert.equal(result.p36800_clean_checkpoint_rows.find((row) => row.row_id === "p36800_checkpoint.live_mount_blocked").current_verdict, "pass");
});

test("static adapter and screen slots never become live UI authority", async () => {
  const source = buildP36400Source({ ready: true });
  const result = await buildWorkOsPlanStateStaticUiAdapter({
    runAt: RUN_AT,
    workOsPlanStateApiReadModel: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.live_mount_allowed_count, 0);
  assert.equal(result.summary.route_navigation_allowed_count, 0);
  assert.ok(result.static_ui_adapter_candidate_rows.every((row) => row.static_adapter_visible_now === true));
  assert.ok(result.static_ui_adapter_candidate_rows.every((row) => row.live_mount_allowed_now === false));
  assert.ok(result.static_ui_adapter_candidate_rows.every((row) => row.runtime_fetch_allowed_now === false));
  assert.ok(result.static_ui_adapter_candidate_rows.every((row) => row.generated_file_write_allowed_now === false));
  assert.ok(result.screen_slot_binding_rows.every((row) => row.slot_binding_visible_now === true));
  assert.ok(result.screen_slot_binding_rows.every((row) => row.route_navigation_allowed_now === false));
  assert.ok(result.screen_slot_binding_rows.every((row) => row.live_browser_required_now === false));
});

test("static shell and interactions never mutate UI state", async () => {
  const source = buildP36400Source({ ready: true });
  const result = await buildWorkOsPlanStateStaticUiAdapter({
    runAt: RUN_AT,
    workOsPlanStateApiReadModel: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.state_persist_allowed_count, 0);
  assert.equal(result.summary.event_mutation_allowed_count, 0);
  assert.ok(result.static_shell_fixture_rows.every((row) => row.fixture_visible_now === true));
  assert.ok(result.static_shell_fixture_rows.every((row) => row.state_persist_allowed_now === false));
  assert.ok(result.static_shell_fixture_rows.every((row) => row.form_submit_allowed_now === false));
  assert.ok(result.static_shell_fixture_rows.every((row) => row.write_api_allowed_now === false));
  assert.ok(result.interaction_smoke_rows.every((row) => row.smoke_visible_now === true));
  assert.ok(result.interaction_smoke_rows.every((row) => row.event_handler_mutation_allowed_now === false));
  assert.ok(result.interaction_smoke_rows.every((row) => row.action_button_allowed_now === false));
  assert.ok(result.interaction_smoke_rows.every((row) => row.status_edit_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_plan_state_static_ui_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing static UI adapter artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p36800-"));
  try {
    const source = buildP36400Source({ ready: true });
    const result = await runWorkOsPlanStateStaticUiAdapter({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsPlanStateApiReadModel: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-plan-state-static-ui-adapter.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

function buildP36400Source({ ready }) {
  const requests = ["req.product_contract", "req.project_control_plane", "req.commercial_spec"];
  const fixtureRows = requests.map((requestId) => ({
    row_id: `ui_consumer_smoke_fixture.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    fixture_ref: `fixtures.work_os_plan_state.${requestId}.smoke`,
    route_path: `/api/work-os/plan-state/${requestId}`,
    expected_status: "blocked_read_only_projection_ready",
    expected_blocker_count: 4,
    smoke_fixture_visible_now: true,
    fixture_persist_allowed_now: false,
    ui_mutation_allowed_now: false,
    ui_status_edit_allowed_now: false,
    ui_action_button_allowed_now: false,
  }));
  const routeRows = requests.map((requestId) => ({
    row_id: `api_route_response_contract.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    route_path: `/api/work-os/plan-state/${requestId}`,
    allowed_methods: ["GET"],
    disallowed_methods: ["POST", "PATCH", "PUT", "DELETE"],
    response_model_ref: `work_os.plan_state.response.${requestId}.candidate`,
    route_contract_visible_now: true,
    api_post_allowed_now: false,
    api_patch_allowed_now: false,
    api_delete_allowed_now: false,
    api_write_allowed_now: false,
  }));

  return {
    schema_version: "work-os-plan-state-api-read-model.v1",
    generated_at: RUN_AT,
    capability_id: "platform.work_os_plan_state_api_read_model",
    program_range: "P36001-P36400",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      work_os_plan_state_api_status: ready
        ? "ready_for_work_os_plan_state_api_read_model"
        : "valid_block_work_os_plan_state_api_read_model_pending",
      ready_for_work_os_ui_consumer_smoke_handoff: ready,
    },
    work_os_plan_state_api_boundary: {
      p36400_contract_ready: true,
      ready_for_work_os_ui_consumer_smoke_handoff: ready,
      plan_state_api_read_model_visible_now: true,
      ui_consumer_smoke_fixture_visible_now: true,
      api_route_response_contract_visible_now: true,
      no_api_write_boundary_closed_now: true,
      work_os_plan_state_api_wiring_complete_now: true,
      ...Object.fromEntries(P36400_FALSE_FLAGS.map((flag) => [flag, false])),
    },
    ui_consumer_smoke_fixture_rows: fixtureRows,
    api_route_response_contract_rows: routeRows,
  };
}
