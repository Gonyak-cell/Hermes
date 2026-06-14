import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  COMMERCIAL_SPEC_REGISTRATION_FALSE_FLAGS,
  buildCommercialSpecRegistrationCandidate,
  runCommercialSpecRegistrationCandidate,
} from "../src/commercial-spec-registration-candidate.mjs";
import { buildClarificationAnswerReceiptCandidateQueue } from "../src/clarification-answer-receipt-candidate-queue.mjs";
import { buildSeedRecheckValidationContract } from "../src/seed-recheck-validation-contract.mjs";
import { buildClarificationReplayCaptureContract } from "../src/clarification-replay-capture-contract.mjs";
import { buildUiProjectionReplayLedger } from "../src/ui-projection-replay-ledger.mjs";
import { buildDefaultsAssumptionsNoFakeClarity } from "../src/defaults-assumptions-no-fake-clarity.mjs";
import { buildSeedSynthesisExecutionReadiness } from "../src/seed-synthesis-execution-readiness.mjs";

const RUN_AT = "2026-06-08T15:07:08.228Z";

test("P35200 opens plan registry control-plane handoff when P34800 source is ready", async () => {
  const source = await buildP34800Source({ ready: true });
  const result = await buildCommercialSpecRegistrationCandidate({
    runAt: RUN_AT,
    clarificationAnswerReceiptQueue: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "commercial-spec-registration-candidate.v1");
  assert.equal(result.program_range, "P34801-P35200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.commercial_spec_registration_status, "ready_for_commercial_spec_registration_candidate");
  assert.equal(result.summary.ready_for_plan_registry_control_plane_handoff, true);
  assert.equal(result.commercial_spec_readiness_projection_rows.length, 3);
  assert.equal(result.requirement_traceability_binding_candidate_rows.length, 3);
  assert.equal(result.project_plan_registration_candidate_rows.length, 3);
  assert.equal(result.spec_conflict_freshness_blocker_rows.length, 9);
  assert.equal(result.operator_commercial_spec_projection_rows.length, 3);
  assert.ok(result.no_registration_authority_boundary_rows.length >= 340);
  assert.equal(result.commercial_spec_registration_boundary.p35200_contract_ready, true);

  for (const flag of COMMERCIAL_SPEC_REGISTRATION_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.commercial_spec_registration_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P35200 remains a valid visible block when P34800 handoff is not ready", async () => {
  const source = await buildP34800Source({ ready: false });
  const result = await buildCommercialSpecRegistrationCandidate({
    runAt: RUN_AT,
    clarificationAnswerReceiptQueue: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.commercial_spec_registration_status, "valid_block_commercial_spec_registration_candidate_pending");
  assert.equal(result.summary.source_p34800_ready_for_commercial_spec_registration, false);
  assert.equal(result.summary.ready_for_plan_registry_control_plane_handoff, false);
  assert.equal(result.commercial_spec_registration_boundary.p35200_contract_ready, true);
  assert.equal(result.p35200_clean_checkpoint_rows.find((row) => row.row_id === "p35200_checkpoint.actual_registration_blocked").current_verdict, "pass");
});

test("spec readiness and traceability candidates never become PASS", async () => {
  const source = await buildP34800Source({ ready: true });
  const result = await buildCommercialSpecRegistrationCandidate({
    runAt: RUN_AT,
    clarificationAnswerReceiptQueue: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.spec_readiness_pass_allowed_count, 0);
  assert.ok(result.commercial_spec_readiness_projection_rows.every((row) => row.spec_readiness_projection_visible_now === true));
  assert.ok(result.commercial_spec_readiness_projection_rows.every((row) => row.spec_readiness_pass_allowed_now === false));
  assert.ok(result.commercial_spec_readiness_projection_rows.every((row) => row.actual_registration_allowed_now === false));
  assert.ok(result.requirement_traceability_binding_candidate_rows.every((row) => row.traceability_binding_visible_now === true));
  assert.ok(result.requirement_traceability_binding_candidate_rows.every((row) => row.traceability_pass_allowed_now === false));
  assert.ok(result.requirement_traceability_binding_candidate_rows.every((row) => row.missing_evidence_blocker_visible_now === true));
});

test("plan registration and operator projections never mutate registry or execute", async () => {
  const source = await buildP34800Source({ ready: true });
  const result = await buildCommercialSpecRegistrationCandidate({
    runAt: RUN_AT,
    clarificationAnswerReceiptQueue: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.actual_registration_allowed_count, 0);
  assert.equal(result.summary.plan_registration_allowed_count, 0);
  assert.ok(result.project_plan_registration_candidate_rows.every((row) => row.plan_registration_candidate_visible_now === true));
  assert.ok(result.project_plan_registration_candidate_rows.every((row) => row.plan_registration_allowed_now === false));
  assert.ok(result.project_plan_registration_candidate_rows.every((row) => row.actual_registration_allowed_now === false));
  assert.ok(result.project_plan_registration_candidate_rows.every((row) => row.write_action_allowed_now === false));
  assert.ok(result.spec_conflict_freshness_blocker_rows.every((row) => row.blocker_visible_now === true));
  assert.ok(result.spec_conflict_freshness_blocker_rows.every((row) => row.conflict_bypass_allowed_now === false));
  assert.ok(result.spec_conflict_freshness_blocker_rows.every((row) => row.freshness_bypass_allowed_now === false));
  assert.ok(result.operator_commercial_spec_projection_rows.every((row) => row.register_button_enabled_now === false));
  assert.ok(result.operator_commercial_spec_projection_rows.every((row) => row.approve_button_enabled_now === false));
  assert.ok(result.operator_commercial_spec_projection_rows.every((row) => row.execute_button_enabled_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.commercial_spec_registration_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing commercial spec registration artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p35200-"));
  try {
    const source = await buildP34800Source({ ready: true });
    const result = await runCommercialSpecRegistrationCandidate({
      check: true,
      outDir,
      runAt: RUN_AT,
      clarificationAnswerReceiptQueue: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "commercial-spec-registration-candidate.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP34800Source({ ready }) {
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
  return p34800;
}
