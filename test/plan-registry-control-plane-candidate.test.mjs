import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  PLAN_REGISTRY_CONTROL_PLANE_FALSE_FLAGS,
  buildPlanRegistryControlPlaneCandidate,
  runPlanRegistryControlPlaneCandidate,
} from "../src/plan-registry-control-plane-candidate.mjs";
import { buildCommercialSpecRegistrationCandidate } from "../src/commercial-spec-registration-candidate.mjs";
import { buildClarificationAnswerReceiptCandidateQueue } from "../src/clarification-answer-receipt-candidate-queue.mjs";
import { buildSeedRecheckValidationContract } from "../src/seed-recheck-validation-contract.mjs";
import { buildClarificationReplayCaptureContract } from "../src/clarification-replay-capture-contract.mjs";
import { buildUiProjectionReplayLedger } from "../src/ui-projection-replay-ledger.mjs";
import { buildDefaultsAssumptionsNoFakeClarity } from "../src/defaults-assumptions-no-fake-clarity.mjs";
import { buildSeedSynthesisExecutionReadiness } from "../src/seed-synthesis-execution-readiness.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P35600 opens Work OS plan state handoff when P35200 source is ready", async () => {
  const source = await buildP35200Source({ ready: true });
  const result = await buildPlanRegistryControlPlaneCandidate({
    runAt: RUN_AT,
    commercialSpecRegistrationCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "plan-registry-control-plane-candidate.v1");
  assert.equal(result.program_range, "P35201-P35600");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.plan_registry_control_plane_status, "ready_for_plan_registry_control_plane_candidate");
  assert.equal(result.summary.ready_for_work_os_plan_state_handoff, true);
  assert.equal(result.plan_registry_control_plane_candidate_rows.length, 3);
  assert.equal(result.goal_phase_manifest_binding_candidate_rows.length, 3);
  assert.equal(result.project_workflow_registration_candidate_rows.length, 3);
  assert.equal(result.registry_blocker_ledger_rows.length, 12);
  assert.equal(result.operator_plan_registry_projection_rows.length, 3);
  assert.ok(result.no_registry_mutation_boundary_rows.length >= 340);
  assert.equal(result.plan_registry_control_plane_boundary.p35600_contract_ready, true);

  for (const flag of PLAN_REGISTRY_CONTROL_PLANE_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.plan_registry_control_plane_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P35600 remains a valid visible block when P35200 handoff is not ready", async () => {
  const source = await buildP35200Source({ ready: false });
  const result = await buildPlanRegistryControlPlaneCandidate({
    runAt: RUN_AT,
    commercialSpecRegistrationCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.plan_registry_control_plane_status, "valid_block_plan_registry_control_plane_candidate_pending");
  assert.equal(result.summary.source_p35200_ready_for_plan_registry, false);
  assert.equal(result.summary.ready_for_work_os_plan_state_handoff, false);
  assert.equal(result.plan_registry_control_plane_boundary.p35600_contract_ready, true);
  assert.equal(result.p35600_clean_checkpoint_rows.find((row) => row.row_id === "p35600_checkpoint.actual_registry_mutation_blocked").current_verdict, "pass");
});

test("registry and manifest candidates never create records or manifests", async () => {
  const source = await buildP35200Source({ ready: true });
  const result = await buildPlanRegistryControlPlaneCandidate({
    runAt: RUN_AT,
    commercialSpecRegistrationCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.registry_mutation_allowed_count, 0);
  assert.equal(result.summary.goal_phase_create_allowed_count, 0);
  assert.ok(result.plan_registry_control_plane_candidate_rows.every((row) => row.registry_candidate_visible_now === true));
  assert.ok(result.plan_registry_control_plane_candidate_rows.every((row) => row.actual_record_create_allowed_now === false));
  assert.ok(result.plan_registry_control_plane_candidate_rows.every((row) => row.registry_mutation_allowed_now === false));
  assert.ok(result.goal_phase_manifest_binding_candidate_rows.every((row) => row.manifest_binding_visible_now === true));
  assert.ok(result.goal_phase_manifest_binding_candidate_rows.every((row) => row.goal_create_allowed_now === false));
  assert.ok(result.goal_phase_manifest_binding_candidate_rows.every((row) => row.phase_create_allowed_now === false));
  assert.ok(result.goal_phase_manifest_binding_candidate_rows.every((row) => row.registry_mutation_allowed_now === false));
});

test("workflow registration and operator projections never mutate or execute", async () => {
  const source = await buildP35200Source({ ready: true });
  const result = await buildPlanRegistryControlPlaneCandidate({
    runAt: RUN_AT,
    commercialSpecRegistrationCandidate: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.workflow_registration_allowed_count, 0);
  assert.ok(result.project_workflow_registration_candidate_rows.every((row) => row.workflow_candidate_visible_now === true));
  assert.ok(result.project_workflow_registration_candidate_rows.every((row) => row.workflow_registration_allowed_now === false));
  assert.ok(result.project_workflow_registration_candidate_rows.every((row) => row.registry_mutation_allowed_now === false));
  assert.ok(result.project_workflow_registration_candidate_rows.every((row) => row.write_action_allowed_now === false));
  assert.ok(result.registry_blocker_ledger_rows.every((row) => row.blocker_visible_now === true));
  assert.ok(result.registry_blocker_ledger_rows.every((row) => row.owner_assignment_bypass_allowed_now === false));
  assert.ok(result.registry_blocker_ledger_rows.every((row) => row.review_bypass_allowed_now === false));
  assert.ok(result.registry_blocker_ledger_rows.every((row) => row.freshness_bypass_allowed_now === false));
  assert.ok(result.operator_plan_registry_projection_rows.every((row) => row.register_button_enabled_now === false));
  assert.ok(result.operator_plan_registry_projection_rows.every((row) => row.approve_button_enabled_now === false));
  assert.ok(result.operator_plan_registry_projection_rows.every((row) => row.execute_button_enabled_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.plan_registry_control_plane_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing plan registry artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p35600-"));
  try {
    const source = await buildP35200Source({ ready: true });
    const result = await runPlanRegistryControlPlaneCandidate({
      check: true,
      outDir,
      runAt: RUN_AT,
      commercialSpecRegistrationCandidate: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "plan-registry-control-plane-candidate.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP35200Source({ ready }) {
  const p32800 = await buildSeedSynthesisExecutionReadiness({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  p32800.summary.ready_for_defaults_no_fake_clarity_guard = ready;
  p32800.summary.source_p32400_ready_for_seed_synthesis_candidate = true;
  p32800.seed_synthesis_execution_readiness_boundary.ready_for_defaults_no_fake_clarity_guard = ready;
  p32800.seed_synthesis_execution_readiness_boundary.source_p32400_ready_for_seed_synthesis_candidate = true;
  p32800.validation = { valid: true, error_count: 0, errors: [] };

  const p33200 = await buildDefaultsAssumptionsNoFakeClarity({
    runAt: RUN_AT,
    seedSynthesisExecutionReadiness: p32800,
    commitRef: "abc1234",
  });
  p33200.summary.ready_for_ui_projection_replay_ledger = ready;
  p33200.defaults_assumptions_no_fake_clarity_boundary.ready_for_ui_projection_replay_ledger = ready;

  const p33600 = await buildUiProjectionReplayLedger({
    runAt: RUN_AT,
    defaultsAssumptionsNoFakeClarity: p33200,
    commitRef: "abc1234",
  });
  p33600.summary.ready_for_clarification_replay_capture_handoff = ready;
  p33600.ui_projection_replay_ledger_boundary.ready_for_clarification_replay_capture_handoff = ready;

  const p34000 = await buildClarificationReplayCaptureContract({
    runAt: RUN_AT,
    uiProjectionReplayLedger: p33600,
    commitRef: "abc1234",
  });
  p34000.summary.ready_for_seed_recheck_validation_handoff = ready;
  p34000.clarification_replay_capture_boundary.ready_for_seed_recheck_validation_handoff = ready;

  const p34400 = await buildSeedRecheckValidationContract({
    runAt: RUN_AT,
    clarificationReplayCaptureContract: p34000,
    commitRef: "abc1234",
  });
  p34400.summary.ready_for_commercial_spec_readiness_handoff = ready;
  p34400.seed_recheck_validation_boundary.ready_for_commercial_spec_readiness_handoff = ready;

  const p34800 = await buildClarificationAnswerReceiptCandidateQueue({
    runAt: RUN_AT,
    seedRecheckValidationContract: p34400,
    commitRef: "abc1234",
  });
  p34800.summary.ready_for_commercial_spec_registration_handoff = ready;
  p34800.clarification_answer_receipt_queue_boundary.ready_for_commercial_spec_registration_handoff = ready;

  const p35200 = await buildCommercialSpecRegistrationCandidate({
    runAt: RUN_AT,
    clarificationAnswerReceiptQueue: p34800,
    commitRef: "abc1234",
  });
  p35200.summary.ready_for_plan_registry_control_plane_handoff = ready;
  p35200.commercial_spec_registration_boundary.ready_for_plan_registry_control_plane_handoff = ready;
  return p35200;
}
