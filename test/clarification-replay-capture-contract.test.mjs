import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  CLARIFICATION_REPLAY_CAPTURE_CONTRACT_FALSE_FLAGS,
  buildClarificationReplayCaptureContract,
  runClarificationReplayCaptureContract,
} from "../src/clarification-replay-capture-contract.mjs";
import { buildUiProjectionReplayLedger } from "../src/ui-projection-replay-ledger.mjs";
import { buildDefaultsAssumptionsNoFakeClarity } from "../src/defaults-assumptions-no-fake-clarity.mjs";
import { buildSeedSynthesisExecutionReadiness } from "../src/seed-synthesis-execution-readiness.mjs";

const RUN_AT = "2026-06-08T02:03:22.417Z";

test("P34000 opens seed recheck validation handoff when P33600 source is ready", async () => {
  const source = await buildP33600Source({ ready: true });
  const result = await buildClarificationReplayCaptureContract({
    runAt: RUN_AT,
    uiProjectionReplayLedger: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "clarification-replay-capture-contract.v1");
  assert.equal(result.program_range, "P33601-P34000");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.clarification_replay_capture_status, "ready_for_clarification_replay_capture_contract");
  assert.equal(result.summary.ready_for_seed_recheck_validation_handoff, true);
  assert.equal(result.redacted_answer_receipt_intake_rows.length, 3);
  assert.equal(result.question_replay_trace_binding_rows.length, 3);
  assert.equal(result.replay_ledger_completion_candidate_rows.length, 3);
  assert.equal(result.seed_recheck_candidate_rows.length, 3);
  assert.equal(result.no_execution_no_raw_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_execution_no_raw_boundary_rows.length >= 340);
  assert.equal(result.clarification_replay_capture_boundary.p34000_contract_ready, true);
  assert.equal(result.clarification_replay_capture_boundary.ready_for_seed_recheck_validation_handoff, true);

  for (const flag of CLARIFICATION_REPLAY_CAPTURE_CONTRACT_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.clarification_replay_capture_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P34000 remains a valid visible block when P33600 source handoff is not ready", async () => {
  const source = await buildP33600Source({ ready: false });
  const result = await buildClarificationReplayCaptureContract({
    runAt: RUN_AT,
    uiProjectionReplayLedger: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.clarification_replay_capture_status, "valid_block_clarification_replay_capture_contract_pending");
  assert.equal(result.summary.source_p33600_ready_for_clarification_replay_capture, false);
  assert.equal(result.summary.ready_for_seed_recheck_validation_handoff, false);
  assert.equal(result.clarification_replay_capture_boundary.p34000_contract_ready, true);
  assert.equal(result.clarification_replay_capture_boundary.ready_for_seed_recheck_validation_handoff, false);
  assert.equal(result.p34000_clean_checkpoint_rows.find((row) => row.row_id === "p34000_checkpoint.missing_evidence_blocker_visible").current_verdict, "pass");
});

test("redacted answer receipt intake never captures or exposes raw answers", async () => {
  const source = await buildP33600Source({ ready: true });
  const result = await buildClarificationReplayCaptureContract({
    runAt: RUN_AT,
    uiProjectionReplayLedger: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.answer_capture_allowed_count, 0);
  assert.ok(result.redacted_answer_receipt_intake_rows.every((row) => row.redacted_answer_receipt_required_now === true));
  assert.ok(result.redacted_answer_receipt_intake_rows.every((row) => row.redacted_answer_receipt_present_now === false));
  assert.ok(result.redacted_answer_receipt_intake_rows.every((row) => row.answer_capture_allowed_now === false));
  assert.ok(result.redacted_answer_receipt_intake_rows.every((row) => row.raw_answer_persist_allowed_now === false));
  assert.ok(result.redacted_answer_receipt_intake_rows.every((row) => row.raw_answer_exposure_allowed_now === false));
  assert.ok(result.redacted_answer_receipt_intake_rows.every((row) => row.receipt_auto_accept_allowed_now === false));
});

test("replay completion and seed recheck remain candidates without execution", async () => {
  const source = await buildP33600Source({ ready: true });
  const result = await buildClarificationReplayCaptureContract({
    runAt: RUN_AT,
    uiProjectionReplayLedger: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.replay_completion_allowed_count, 0);
  assert.equal(result.summary.seed_recheck_execution_allowed_count, 0);
  assert.equal(result.summary.missing_evidence_blocker_count, 3);
  assert.ok(result.question_replay_trace_binding_rows.every((row) => row.question_replay_trace_required_now === true));
  assert.ok(result.question_replay_trace_binding_rows.every((row) => row.question_replay_trace_present_now === false));
  assert.ok(result.question_replay_trace_binding_rows.every((row) => row.trace_auto_accept_allowed_now === false));
  assert.ok(result.replay_ledger_completion_candidate_rows.every((row) => row.replay_completion_candidate_visible_now === true));
  assert.ok(result.replay_ledger_completion_candidate_rows.every((row) => row.replay_completion_allowed_now === false));
  assert.ok(result.replay_ledger_completion_candidate_rows.every((row) => row.replay_verification_pass_allowed_now === false));
  assert.ok(result.seed_recheck_candidate_rows.every((row) => row.seed_recheck_candidate_visible_now === true));
  assert.ok(result.seed_recheck_candidate_rows.every((row) => row.seed_recheck_execution_allowed_now === false));
  assert.ok(result.seed_recheck_candidate_rows.every((row) => row.seed_unblock_allowed_now === false));
  assert.ok(result.seed_recheck_candidate_rows.every((row) => row.final_seed_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.clarification_replay_capture_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing clarification replay capture artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p34000-"));
  try {
    const source = await buildP33600Source({ ready: true });
    const result = await runClarificationReplayCaptureContract({
      check: true,
      outDir,
      runAt: RUN_AT,
      uiProjectionReplayLedger: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "clarification-replay-capture-contract.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP33600Source({ ready }) {
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
  return p33600;
}
