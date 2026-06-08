import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  QUESTION_PLANNER_CONFLICT_DETECTOR_FALSE_FLAGS,
  buildQuestionPlannerConflictDetector,
  runQuestionPlannerConflictDetector,
} from "../src/question-planner-conflict-detector.mjs";
import { buildAmbiguousRequestIntake } from "../src/ambiguous-request-intake.mjs";

const RUN_AT = "2026-06-08T01:16:24.027Z";

test("P32000 opens answer capture state machine handoff when P31600 source is ready", async () => {
  const source = await buildP31600Source({ ready: true });
  const result = await buildQuestionPlannerConflictDetector({
    runAt: RUN_AT,
    ambiguousRequestIntake: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "question-planner-conflict-detector.v1");
  assert.equal(result.program_range, "P31601-P32000");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.question_planner_conflict_detector_status, "ready_for_question_planner_conflict_detector");
  assert.equal(result.summary.ready_for_answer_capture_state_machine, true);
  assert.ok(result.question_planner_rows.length >= 3);
  assert.equal(result.question_conflict_detector_rows.length, 3);
  assert.equal(result.clarification_bundle_rows.length, 3);
  assert.equal(result.question_priority_policy_rows.length, result.question_planner_rows.length);
  assert.equal(result.no_auto_question_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_auto_question_boundary_rows.length >= 300);
  assert.equal(result.question_planner_conflict_detector_boundary.p32000_contract_ready, true);
  assert.equal(result.question_planner_conflict_detector_boundary.ready_for_answer_capture_state_machine, true);

  for (const flag of QUESTION_PLANNER_CONFLICT_DETECTOR_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.question_planner_conflict_detector_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P32000 remains a valid visible block when P31600 source handoff is not ready", async () => {
  const source = await buildP31600Source({ ready: false });
  const result = await buildQuestionPlannerConflictDetector({
    runAt: RUN_AT,
    ambiguousRequestIntake: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.question_planner_conflict_detector_status, "valid_block_question_planner_conflict_detector_pending");
  assert.equal(result.summary.source_p31600_ready_for_question_planner, false);
  assert.equal(result.summary.ready_for_answer_capture_state_machine, false);
  assert.equal(result.question_planner_conflict_detector_boundary.p32000_contract_ready, true);
  assert.equal(result.question_planner_conflict_detector_boundary.ready_for_answer_capture_state_machine, false);
  assert.equal(result.p32000_clean_checkpoint_rows.find((row) => row.row_id === "p32000_checkpoint.answer_capture_state_machine_blocker_visible").current_verdict, "pass");
});

test("protected request receives authority conflict and high priority questions without execution authority", async () => {
  const source = await buildP31600Source({ ready: true });
  const result = await buildQuestionPlannerConflictDetector({
    runAt: RUN_AT,
    ambiguousRequestIntake: source,
    commitRef: "abc1234",
  });

  const protectedConflict = result.question_conflict_detector_rows.find((row) => row.request_id === "prompt.protected_release");
  assert.equal(protectedConflict.conflict_present, true);
  assert.ok(protectedConflict.conflict_refs.includes("protected_action_requires_authority_boundary_question"));
  assert.ok(protectedConflict.conflict_refs.includes("high_risk_requires_review_boundary_question"));
  assert.ok(result.question_priority_policy_rows.some((row) => row.request_id === "prompt.protected_release" && row.priority_band === "high"));
  assert.ok(result.question_planner_rows.every((row) => row.question_auto_send_allowed_now === false));
  assert.ok(result.question_planner_rows.every((row) => row.answer_capture_allowed_now === false));
  assert.ok(result.question_planner_rows.every((row) => row.direct_execution_allowed_now === false));
});

test("clarification bundles group question candidates without raw prompt exposure or answer capture", async () => {
  const source = await buildP31600Source({ ready: true });
  const result = await buildQuestionPlannerConflictDetector({
    runAt: RUN_AT,
    ambiguousRequestIntake: source,
    commitRef: "abc1234",
  });

  assert.ok(result.clarification_bundle_rows.every((row) => row.question_count > 0));
  assert.ok(result.clarification_bundle_rows.every((row) => row.bundle_auto_send_allowed_now === false));
  assert.ok(result.clarification_bundle_rows.every((row) => row.answer_capture_allowed_now === false));
  assert.ok(result.clarification_bundle_rows.every((row) => row.raw_prompt_exposed === false));
  assert.ok(result.question_planner_rows.every((row) => row.source_prompt_text_ref_only === true));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.question_planner_conflict_detector_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing question planner artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p32000-"));
  try {
    const source = await buildP31600Source({ ready: true });
    const result = await runQuestionPlannerConflictDetector({
      check: true,
      outDir,
      runAt: RUN_AT,
      ambiguousRequestIntake: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "question-planner-conflict-detector.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP31600Source({ ready }) {
  const source = await buildAmbiguousRequestIntake({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_clarifying_question_engine = ready;
  source.summary.source_p31200_ready_for_p31201_handoff = true;
  source.ambiguous_request_intake_boundary.ready_for_clarifying_question_engine = ready;
  source.ambiguous_request_intake_boundary.source_p31200_ready_for_p31201_handoff = true;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
