import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  SEED_SYNTHESIS_EXECUTION_READINESS_FALSE_FLAGS,
  buildSeedSynthesisExecutionReadiness,
  runSeedSynthesisExecutionReadiness,
} from "../src/seed-synthesis-execution-readiness.mjs";
import { buildAnswerCaptureSpecStateMachine } from "../src/answer-capture-spec-state-machine.mjs";

const RUN_AT = "2026-06-08T01:16:24.027Z";

test("P32800 opens defaults/no-fake-clarity guard handoff when P32400 source is ready", async () => {
  const source = await buildP32400Source({ ready: true });
  const result = await buildSeedSynthesisExecutionReadiness({
    runAt: RUN_AT,
    answerCaptureSpecStateMachine: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "seed-synthesis-execution-readiness.v1");
  assert.equal(result.program_range, "P32401-P32800");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.seed_synthesis_execution_readiness_status, "ready_for_seed_synthesis_execution_readiness");
  assert.equal(result.summary.ready_for_defaults_no_fake_clarity_guard, true);
  assert.equal(result.seed_synthesis_candidate_rows.length, 3);
  assert.equal(result.execution_readiness_gate_rows.length, 3);
  assert.equal(result.seed_review_packet_candidate_rows.length, 3);
  assert.equal(result.seed_blocker_ledger_rows.length, 3);
  assert.equal(result.no_execution_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_execution_boundary_rows.length >= 300);
  assert.equal(result.seed_synthesis_execution_readiness_boundary.p32800_contract_ready, true);
  assert.equal(result.seed_synthesis_execution_readiness_boundary.ready_for_defaults_no_fake_clarity_guard, true);

  for (const flag of SEED_SYNTHESIS_EXECUTION_READINESS_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.seed_synthesis_execution_readiness_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P32800 remains a valid visible block when P32400 source handoff is not ready", async () => {
  const source = await buildP32400Source({ ready: false });
  const result = await buildSeedSynthesisExecutionReadiness({
    runAt: RUN_AT,
    answerCaptureSpecStateMachine: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.seed_synthesis_execution_readiness_status, "valid_block_seed_synthesis_execution_readiness_pending");
  assert.equal(result.summary.source_p32400_ready_for_seed_synthesis_candidate, false);
  assert.equal(result.summary.ready_for_defaults_no_fake_clarity_guard, false);
  assert.equal(result.seed_synthesis_execution_readiness_boundary.p32800_contract_ready, true);
  assert.equal(result.seed_synthesis_execution_readiness_boundary.ready_for_defaults_no_fake_clarity_guard, false);
  assert.equal(result.p32800_clean_checkpoint_rows.find((row) => row.row_id === "p32800_checkpoint.execution_blocker_visible").current_verdict, "pass");
});

test("seed candidates stay incomplete and execution readiness stays blocked without answer receipts", async () => {
  const source = await buildP32400Source({ ready: true });
  const result = await buildSeedSynthesisExecutionReadiness({
    runAt: RUN_AT,
    answerCaptureSpecStateMachine: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.final_seed_complete_count, 0);
  assert.equal(result.summary.execution_ready_count, 0);
  assert.ok(result.seed_synthesis_candidate_rows.every((row) => row.seed_candidate_complete_now === false));
  assert.ok(result.seed_synthesis_candidate_rows.every((row) => row.final_seed_allowed_now === false));
  assert.ok(result.seed_synthesis_candidate_rows.every((row) => row.blocker_refs.includes("missing_answer_receipt")));
  assert.ok(result.execution_readiness_gate_rows.every((row) => row.execution_ready_now === false));
  assert.ok(result.execution_readiness_gate_rows.every((row) => row.execution_readiness_blocked_now === true));
  assert.ok(result.execution_readiness_gate_rows.every((row) => row.runtime_execution_allowed_now === false));
  assert.ok(result.execution_readiness_gate_rows.every((row) => row.write_action_allowed_now === false));
});

test("seed review packet candidates expose blockers without raw answers or approvals", async () => {
  const source = await buildP32400Source({ ready: true });
  const result = await buildSeedSynthesisExecutionReadiness({
    runAt: RUN_AT,
    answerCaptureSpecStateMachine: source,
    commitRef: "abc1234",
  });

  assert.ok(result.seed_review_packet_candidate_rows.every((row) => row.includes_answer_ref_only === true));
  assert.ok(result.seed_review_packet_candidate_rows.every((row) => row.includes_raw_answer === false));
  assert.ok(result.seed_review_packet_candidate_rows.every((row) => row.review_completion_allowed_now === false));
  assert.ok(result.seed_review_packet_candidate_rows.every((row) => row.final_approval_allowed_now === false));
  assert.ok(result.seed_blocker_ledger_rows.every((row) => row.blocker_visible_to_operator === true));
  assert.ok(result.seed_blocker_ledger_rows.every((row) => row.execution_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.seed_synthesis_execution_readiness_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing seed synthesis artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p32800-"));
  try {
    const source = await buildP32400Source({ ready: true });
    const result = await runSeedSynthesisExecutionReadiness({
      check: true,
      outDir,
      runAt: RUN_AT,
      answerCaptureSpecStateMachine: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "seed-synthesis-execution-readiness.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP32400Source({ ready }) {
  const source = await buildAnswerCaptureSpecStateMachine({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_seed_readiness_gate = ready;
  source.summary.source_p32000_ready_for_answer_capture = true;
  source.answer_capture_spec_state_machine_boundary.ready_for_seed_readiness_gate = ready;
  source.answer_capture_spec_state_machine_boundary.source_p32000_ready_for_answer_capture = true;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
