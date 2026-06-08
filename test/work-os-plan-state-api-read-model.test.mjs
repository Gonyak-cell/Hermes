import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  WORK_OS_PLAN_STATE_API_FALSE_FLAGS,
  buildWorkOsPlanStateApiReadModel,
  runWorkOsPlanStateApiReadModel,
} from "../src/work-os-plan-state-api-read-model.mjs";
import { ALL_FALSE_FLAGS as P36000_FALSE_FLAGS } from "../src/work-os-plan-state-projection.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P36400 opens read-only API and UI smoke handoff when P36000 source is ready", async () => {
  const source = buildP36000Source({ ready: true });
  const result = await buildWorkOsPlanStateApiReadModel({
    runAt: RUN_AT,
    workOsPlanStateProjection: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-plan-state-api-read-model.v1");
  assert.equal(result.program_range, "P36001-P36400");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_plan_state_api_status, "ready_for_work_os_plan_state_api_read_model");
  assert.equal(result.summary.ready_for_work_os_ui_consumer_smoke_handoff, true);
  assert.equal(result.plan_state_api_read_model_rows.length, 3);
  assert.equal(result.ui_consumer_smoke_fixture_rows.length, 3);
  assert.equal(result.api_route_response_contract_rows.length, 3);
  assert.ok(result.no_api_write_boundary_rows.length >= 690);
  assert.equal(result.work_os_plan_state_api_boundary.p36400_contract_ready, true);

  for (const flag of WORK_OS_PLAN_STATE_API_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_plan_state_api_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P36400 remains a valid visible block when P36000 handoff is not ready", async () => {
  const source = buildP36000Source({ ready: false });
  const result = await buildWorkOsPlanStateApiReadModel({
    runAt: RUN_AT,
    workOsPlanStateProjection: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_plan_state_api_status, "valid_block_work_os_plan_state_api_read_model_pending");
  assert.equal(result.summary.source_p36000_ready_for_api_read_model, false);
  assert.equal(result.summary.ready_for_work_os_ui_consumer_smoke_handoff, false);
  assert.equal(result.work_os_plan_state_api_boundary.p36400_contract_ready, true);
  assert.equal(result.p36400_clean_checkpoint_rows.find((row) => row.row_id === "p36400_checkpoint.write_methods_blocked").current_verdict, "pass");
});

test("API route contracts stay GET-only and never open write methods", async () => {
  const source = buildP36000Source({ ready: true });
  const result = await buildWorkOsPlanStateApiReadModel({
    runAt: RUN_AT,
    workOsPlanStateProjection: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.api_write_allowed_count, 0);
  assert.equal(result.summary.server_start_allowed_count, 0);
  assert.equal(result.summary.route_registration_allowed_count, 0);
  assert.ok(result.plan_state_api_read_model_rows.every((row) => row.method === "GET"));
  assert.ok(result.plan_state_api_read_model_rows.every((row) => row.api_server_start_allowed_now === false));
  assert.ok(result.plan_state_api_read_model_rows.every((row) => row.route_registration_allowed_now === false));
  assert.ok(result.plan_state_api_read_model_rows.every((row) => row.network_call_required_now === false));
  assert.ok(result.api_route_response_contract_rows.every((row) => row.allowed_methods.length === 1 && row.allowed_methods[0] === "GET"));
  assert.ok(result.api_route_response_contract_rows.every((row) => row.api_post_allowed_now === false));
  assert.ok(result.api_route_response_contract_rows.every((row) => row.api_patch_allowed_now === false));
  assert.ok(result.api_route_response_contract_rows.every((row) => row.api_delete_allowed_now === false));
  assert.ok(result.api_route_response_contract_rows.every((row) => row.api_write_allowed_now === false));
});

test("UI smoke fixtures never become UI mutation or action authority", async () => {
  const source = buildP36000Source({ ready: true });
  const result = await buildWorkOsPlanStateApiReadModel({
    runAt: RUN_AT,
    workOsPlanStateProjection: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.ui_mutation_allowed_count, 0);
  assert.ok(result.ui_consumer_smoke_fixture_rows.every((row) => row.smoke_fixture_visible_now === true));
  assert.ok(result.ui_consumer_smoke_fixture_rows.every((row) => row.fixture_persist_allowed_now === false));
  assert.ok(result.ui_consumer_smoke_fixture_rows.every((row) => row.ui_mutation_allowed_now === false));
  assert.ok(result.ui_consumer_smoke_fixture_rows.every((row) => row.ui_status_edit_allowed_now === false));
  assert.ok(result.ui_consumer_smoke_fixture_rows.every((row) => row.ui_action_button_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_plan_state_api_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing API read model artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p36400-"));
  try {
    const source = buildP36000Source({ ready: true });
    const result = await runWorkOsPlanStateApiReadModel({
      check: true,
      outDir,
      runAt: RUN_AT,
      workOsPlanStateProjection: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-plan-state-api-read-model.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

function buildP36000Source({ ready }) {
  const requests = ["req.product_contract", "req.project_control_plane", "req.commercial_spec"];
  const handoffRows = requests.map((requestId) => ({
    row_id: `operator_plan_state_handoff.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    read_api_candidate_ref: `/api/work-os/plan-state/${requestId}`,
    ui_slot_candidate_ref: `work-os.plan-state.${requestId}`,
    operator_status: "blocked_read_only_projection_ready",
    next_action: "collect_owner_review_freshness_and_traceability_receipts_before_registry_write",
    blocker_count: 4,
    api_read_visible_now: true,
    api_write_allowed_now: false,
    register_button_enabled_now: false,
    status_edit_enabled_now: false,
    execute_button_enabled_now: false,
    production_pass_enabled_now: false,
  }));
  const blockerRows = requests.flatMap((requestId) => [
    "source_candidate_only",
    "owner_assignment_missing",
    "review_receipt_missing",
    "freshness_receipt_missing",
  ].map((blockerType) => ({
    row_id: `plan_state_stale_blocker_ledger.${requestId}.${blockerType}`,
    request_id: requestId,
    current_verdict: "pass",
    blocker_type: blockerType,
    blocker_visible_now: true,
    blocker_clear_allowed_now: false,
    stale_context_pass_allowed_now: false,
    status_pass_allowed_now: false,
  })));

  return {
    schema_version: "work-os-plan-state-projection.v1",
    generated_at: RUN_AT,
    capability_id: "platform.work_os_plan_state_projection",
    program_range: "P35601-P36000",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      work_os_plan_state_status: ready
        ? "ready_for_work_os_plan_state_projection"
        : "valid_block_work_os_plan_state_projection_pending",
      ready_for_work_os_operator_plan_state_handoff: ready,
    },
    work_os_plan_state_boundary: {
      p36000_contract_ready: true,
      ready_for_work_os_operator_plan_state_handoff: ready,
      work_os_plan_state_projection_visible_now: true,
      goal_phase_workflow_read_model_visible_now: true,
      plan_state_stale_blocker_ledger_visible_now: true,
      operator_plan_state_handoff_visible_now: true,
      no_state_mutation_boundary_closed_now: true,
      ...Object.fromEntries(P36000_FALSE_FLAGS.map((flag) => [flag, false])),
    },
    operator_plan_state_handoff_rows: handoffRows,
    plan_state_stale_blocker_ledger_rows: blockerRows,
  };
}
