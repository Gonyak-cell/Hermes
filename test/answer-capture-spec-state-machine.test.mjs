import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  ANSWER_CAPTURE_SPEC_STATE_MACHINE_FALSE_FLAGS,
  buildAnswerCaptureSpecStateMachine,
  runAnswerCaptureSpecStateMachine,
} from "../src/answer-capture-spec-state-machine.mjs";
import { buildQuestionPlannerConflictDetector } from "../src/question-planner-conflict-detector.mjs";

const RUN_AT = "2026-06-08T01:16:24.027Z";

test("P32400 opens seed readiness gate handoff when P32000 source is ready", async () => {
  const source = await buildP32000Source({ ready: true });
  const result = await buildAnswerCaptureSpecStateMachine({
    runAt: RUN_AT,
    questionPlannerConflictDetector: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "answer-capture-spec-state-machine.v1");
  assert.equal(result.program_range, "P32001-P32400");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.answer_capture_spec_state_machine_status, "ready_for_answer_capture_spec_state_machine");
  assert.equal(result.summary.ready_for_seed_readiness_gate, true);
  assert.equal(result.answer_capture_contract_rows.length, 3);
  assert.equal(result.spec_state_machine_rows.length, 12);
  assert.equal(result.answer_redaction_boundary_rows.length, 3);
  assert.equal(result.state_transition_validator_rows.length, 12);
  assert.equal(result.no_seed_synthesis_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_seed_synthesis_boundary_rows.length >= 300);
  assert.equal(result.answer_capture_spec_state_machine_boundary.p32400_contract_ready, true);
  assert.equal(result.answer_capture_spec_state_machine_boundary.ready_for_seed_readiness_gate, true);

  for (const flag of ANSWER_CAPTURE_SPEC_STATE_MACHINE_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.answer_capture_spec_state_machine_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P32400 remains a valid visible block when P32000 source handoff is not ready", async () => {
  const source = await buildP32000Source({ ready: false });
  const result = await buildAnswerCaptureSpecStateMachine({
    runAt: RUN_AT,
    questionPlannerConflictDetector: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.answer_capture_spec_state_machine_status, "valid_block_answer_capture_spec_state_machine_pending");
  assert.equal(result.summary.source_p32000_ready_for_answer_capture, false);
  assert.equal(result.summary.ready_for_seed_readiness_gate, false);
  assert.equal(result.answer_capture_spec_state_machine_boundary.p32400_contract_ready, true);
  assert.equal(result.answer_capture_spec_state_machine_boundary.ready_for_seed_readiness_gate, false);
  assert.equal(result.p32400_clean_checkpoint_rows.find((row) => row.row_id === "p32400_checkpoint.seed_readiness_blocker_visible").current_verdict, "pass");
});

test("answer capture contract never claims live answers or raw answer exposure", async () => {
  const source = await buildP32000Source({ ready: true });
  const result = await buildAnswerCaptureSpecStateMachine({
    runAt: RUN_AT,
    questionPlannerConflictDetector: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.answer_receipt_present_count, 0);
  assert.equal(result.summary.seed_synthesis_candidate_count, 0);
  assert.ok(result.answer_capture_contract_rows.every((row) => row.answer_receipt_present_now === false));
  assert.ok(result.answer_capture_contract_rows.every((row) => row.raw_answer_persisted_now === false));
  assert.ok(result.answer_capture_contract_rows.every((row) => row.raw_answer_exposed_now === false));
  assert.ok(result.answer_capture_contract_rows.every((row) => row.live_answer_capture_allowed_now === false));
  assert.ok(result.answer_redaction_boundary_rows.every((row) => row.secret_scan_required_before_answer_receipt === true));
  assert.ok(result.answer_redaction_boundary_rows.every((row) => row.redacted_summary_ui_only === true));
});

test("state transition validator blocks receipt-dependent transitions while seed synthesis stays closed", async () => {
  const source = await buildP32000Source({ ready: true });
  const result = await buildAnswerCaptureSpecStateMachine({
    runAt: RUN_AT,
    questionPlannerConflictDetector: source,
    commitRef: "abc1234",
  });

  assert.ok(result.state_transition_validator_rows.some((row) => row.to_state === "awaiting_user_answer" && row.transition_allowed_now === true));
  assert.ok(result.state_transition_validator_rows.some((row) => row.to_state === "answer_receipt_candidate" && row.blocked_until_answer_receipt === true));
  assert.ok(result.state_transition_validator_rows.every((row) => row.spec_mutation_allowed_now === false));
  assert.ok(result.state_transition_validator_rows.every((row) => row.seed_synthesis_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.answer_capture_spec_state_machine_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing answer capture artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p32400-"));
  try {
    const source = await buildP32000Source({ ready: true });
    const result = await runAnswerCaptureSpecStateMachine({
      check: true,
      outDir,
      runAt: RUN_AT,
      questionPlannerConflictDetector: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "answer-capture-spec-state-machine.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP32000Source({ ready }) {
  const source = await buildQuestionPlannerConflictDetector({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_answer_capture_state_machine = ready;
  source.summary.source_p31600_ready_for_question_planner = true;
  source.question_planner_conflict_detector_boundary.ready_for_answer_capture_state_machine = ready;
  source.question_planner_conflict_detector_boundary.source_p31600_ready_for_question_planner = true;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
