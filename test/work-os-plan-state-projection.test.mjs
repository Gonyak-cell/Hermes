import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  WORK_OS_PLAN_STATE_FALSE_FLAGS,
  buildWorkOsPlanStateProjection,
  runWorkOsPlanStateProjection,
} from "../src/work-os-plan-state-projection.mjs";
import { ALL_FALSE_FLAGS as P35600_FALSE_FLAGS } from "../src/plan-registry-control-plane-candidate.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P36000 opens read-only Work OS operator plan state handoff when P35600 source is ready", async () => {
  const source = buildP35600Source({ ready: true });
  const result = await buildWorkOsPlanStateProjection({
    runAt: RUN_AT,
    planRegistryControlPlaneCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "work-os-plan-state-projection.v1");
  assert.equal(result.program_range, "P35601-P36000");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_plan_state_status, "ready_for_work_os_plan_state_projection");
  assert.equal(result.summary.ready_for_work_os_operator_plan_state_handoff, true);
  assert.equal(result.work_os_plan_state_projection_rows.length, 3);
  assert.equal(result.goal_phase_workflow_read_model_rows.length, 3);
  assert.equal(result.plan_state_stale_blocker_ledger_rows.length, 12);
  assert.equal(result.operator_plan_state_handoff_rows.length, 3);
  assert.ok(result.no_state_mutation_boundary_rows.length >= 650);
  assert.equal(result.work_os_plan_state_boundary.p36000_contract_ready, true);

  for (const flag of WORK_OS_PLAN_STATE_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.work_os_plan_state_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P36000 remains a valid visible block when P35600 handoff is not ready", async () => {
  const source = buildP35600Source({ ready: false });
  const result = await buildWorkOsPlanStateProjection({
    runAt: RUN_AT,
    planRegistryControlPlaneCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_plan_state_status, "valid_block_work_os_plan_state_projection_pending");
  assert.equal(result.summary.source_p35600_ready_for_work_os_state, false);
  assert.equal(result.summary.ready_for_work_os_operator_plan_state_handoff, false);
  assert.equal(result.work_os_plan_state_boundary.p36000_contract_ready, true);
  assert.equal(result.p36000_clean_checkpoint_rows.find((row) => row.row_id === "p36000_checkpoint.api_write_blocked").current_verdict, "pass");
});

test("plan state projection and read model never mutate state", async () => {
  const source = buildP35600Source({ ready: true });
  const result = await buildWorkOsPlanStateProjection({
    runAt: RUN_AT,
    planRegistryControlPlaneCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.plan_state_mutation_allowed_count, 0);
  assert.equal(result.summary.status_update_allowed_count, 0);
  assert.equal(result.summary.blocker_clear_allowed_count, 0);
  assert.ok(result.work_os_plan_state_projection_rows.every((row) => row.read_model_visible_now === true));
  assert.ok(result.work_os_plan_state_projection_rows.every((row) => row.plan_state_record_write_allowed_now === false));
  assert.ok(result.work_os_plan_state_projection_rows.every((row) => row.plan_state_mutation_allowed_now === false));
  assert.ok(result.goal_phase_workflow_read_model_rows.every((row) => row.goal_status_update_allowed_now === false));
  assert.ok(result.goal_phase_workflow_read_model_rows.every((row) => row.phase_status_update_allowed_now === false));
  assert.ok(result.goal_phase_workflow_read_model_rows.every((row) => row.workflow_registration_allowed_now === false));
  assert.ok(result.goal_phase_workflow_read_model_rows.every((row) => row.task_create_allowed_now === false));
});

test("operator plan state handoff exposes only read API candidates", async () => {
  const source = buildP35600Source({ ready: true });
  const result = await buildWorkOsPlanStateProjection({
    runAt: RUN_AT,
    planRegistryControlPlaneCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.api_write_allowed_count, 0);
  assert.ok(result.plan_state_stale_blocker_ledger_rows.every((row) => row.blocker_visible_now === true));
  assert.ok(result.plan_state_stale_blocker_ledger_rows.every((row) => row.blocker_clear_allowed_now === false));
  assert.ok(result.plan_state_stale_blocker_ledger_rows.every((row) => row.stale_context_pass_allowed_now === false));
  assert.ok(result.operator_plan_state_handoff_rows.every((row) => row.api_read_visible_now === true));
  assert.ok(result.operator_plan_state_handoff_rows.every((row) => row.api_write_allowed_now === false));
  assert.ok(result.operator_plan_state_handoff_rows.every((row) => row.register_button_enabled_now === false));
  assert.ok(result.operator_plan_state_handoff_rows.every((row) => row.status_edit_enabled_now === false));
  assert.ok(result.operator_plan_state_handoff_rows.every((row) => row.execute_button_enabled_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.work_os_plan_state_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing Work OS plan state artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p36000-"));
  try {
    const source = buildP35600Source({ ready: true });
    const result = await runWorkOsPlanStateProjection({
      check: true,
      outDir,
      runAt: RUN_AT,
      planRegistryControlPlaneCandidate: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "work-os-plan-state-projection.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

function buildP35600Source({ ready }) {
  const requests = ["req.product_contract", "req.project_control_plane", "req.commercial_spec"];
  const registryRows = requests.map((requestId) => ({
    row_id: `plan_registry_control_plane_candidate.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    registry_candidate_ref: `plan_registry_control_plane.${requestId}.candidate`,
    plan_registration_candidate_ref: `plan_registration.${requestId}.candidate`,
    spec_candidate_ref: `spec.${requestId}.candidate`,
    registry_candidate_visible_now: true,
    actual_record_create_allowed_now: false,
    registry_mutation_allowed_now: false,
    status_pass_allowed_now: false,
  }));
  const manifestRows = requests.map((requestId) => ({
    row_id: `goal_phase_manifest_binding_candidate.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    goal_manifest_ref: `goal_manifest.${requestId}.candidate`,
    phase_manifest_ref: `phase_manifest.${requestId}.candidate`,
    manifest_binding_visible_now: true,
    goal_create_allowed_now: false,
    phase_create_allowed_now: false,
    registry_mutation_allowed_now: false,
  }));
  const workflowRows = requests.map((requestId) => {
    const manifest = manifestRows.find((item) => item.request_id === requestId);
    const registry = registryRows.find((item) => item.request_id === requestId);
    return {
      row_id: `project_workflow_registration_candidate.${requestId}`,
      request_id: requestId,
      current_verdict: "pass",
      workflow_registration_candidate_ref: `project_workflow.${requestId}.candidate`,
      registry_candidate_ref: registry.registry_candidate_ref,
      goal_manifest_ref: manifest.goal_manifest_ref,
      phase_manifest_ref: manifest.phase_manifest_ref,
      workflow_candidate_visible_now: true,
      workflow_registration_allowed_now: false,
      registry_mutation_allowed_now: false,
      write_action_allowed_now: false,
    };
  });
  const blockerRows = requests.flatMap((requestId) => [
    "owner_assignment_missing",
    "review_receipt_missing",
    "freshness_receipt_missing",
    "traceability_evidence_missing",
  ].map((blockerType) => ({
    row_id: `registry_blocker_ledger.${requestId}.${blockerType}`,
    request_id: requestId,
    current_verdict: "pass",
    blocker_type: blockerType,
    blocker_visible_now: true,
    owner_assignment_bypass_allowed_now: false,
    review_bypass_allowed_now: false,
    freshness_bypass_allowed_now: false,
    registry_status_pass_allowed_now: false,
  })));
  const operatorRows = requests.map((requestId) => ({
    row_id: `operator_plan_registry_projection.${requestId}`,
    request_id: requestId,
    current_verdict: "pass",
    operator_status: "blocked_waiting_for_plan_registry_evidence",
    blocker_count: 4,
    register_button_enabled_now: false,
    approve_button_enabled_now: false,
    execute_button_enabled_now: false,
    production_pass_enabled_now: false,
  }));

  return {
    schema_version: "plan-registry-control-plane-candidate.v1",
    generated_at: RUN_AT,
    capability_id: "platform.plan_registry_control_plane_candidate",
    program_range: "P35201-P35600",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      plan_registry_control_plane_status: ready
        ? "ready_for_plan_registry_control_plane_candidate"
        : "valid_block_plan_registry_control_plane_candidate_pending",
      ready_for_work_os_plan_state_handoff: ready,
    },
    plan_registry_control_plane_boundary: {
      p35600_contract_ready: true,
      ready_for_work_os_plan_state_handoff: ready,
      plan_registry_control_plane_candidate_visible_now: true,
      goal_phase_manifest_binding_candidate_visible_now: true,
      project_workflow_registration_candidate_visible_now: true,
      registry_blocker_ledger_visible_now: true,
      operator_plan_registry_projection_visible_now: true,
      no_registry_mutation_boundary_closed_now: true,
      ...Object.fromEntries(P35600_FALSE_FLAGS.map((flag) => [flag, false])),
    },
    plan_registry_control_plane_candidate_rows: registryRows,
    goal_phase_manifest_binding_candidate_rows: manifestRows,
    project_workflow_registration_candidate_rows: workflowRows,
    registry_blocker_ledger_rows: blockerRows,
    operator_plan_registry_projection_rows: operatorRows,
  };
}
