import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  CLARIFICATION_ANSWER_RECEIPT_QUEUE_FALSE_FLAGS,
  buildClarificationAnswerReceiptCandidateQueue,
  runClarificationAnswerReceiptCandidateQueue,
} from "../src/clarification-answer-receipt-candidate-queue.mjs";
import { buildSeedRecheckValidationContract } from "../src/seed-recheck-validation-contract.mjs";
import { buildClarificationReplayCaptureContract } from "../src/clarification-replay-capture-contract.mjs";
import { buildUiProjectionReplayLedger } from "../src/ui-projection-replay-ledger.mjs";
import { buildDefaultsAssumptionsNoFakeClarity } from "../src/defaults-assumptions-no-fake-clarity.mjs";
import { buildSeedSynthesisExecutionReadiness } from "../src/seed-synthesis-execution-readiness.mjs";

const RUN_AT = "2026-06-08T14:45:08.120Z";

test("P34800 opens commercial spec registration handoff when P34400 source is ready", async () => {
  const source = await buildP34400Source({ ready: true });
  const result = await buildClarificationAnswerReceiptCandidateQueue({
    runAt: RUN_AT,
    seedRecheckValidationContract: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "clarification-answer-receipt-candidate-queue.v1");
  assert.equal(result.program_range, "P34401-P34800");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.clarification_answer_receipt_queue_status, "ready_for_clarification_answer_receipt_candidate_queue");
  assert.equal(result.summary.ready_for_commercial_spec_registration_handoff, true);
  assert.equal(result.redacted_answer_receipt_candidate_queue_rows.length, 3);
  assert.equal(result.conflict_resolution_ledger_candidate_rows.length, 3);
  assert.equal(result.stale_context_recheck_candidate_rows.length, 3);
  assert.equal(result.answer_receipt_evidence_packet_candidate_rows.length, 3);
  assert.equal(result.operator_answer_receipt_queue_projection_rows.length, 3);
  assert.ok(result.no_raw_capture_boundary_rows.length >= 340);
  assert.equal(result.clarification_answer_receipt_queue_boundary.p34800_contract_ready, true);

  for (const flag of CLARIFICATION_ANSWER_RECEIPT_QUEUE_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.clarification_answer_receipt_queue_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P34800 remains a valid visible block when P34400 handoff is not ready", async () => {
  const source = await buildP34400Source({ ready: false });
  const result = await buildClarificationAnswerReceiptCandidateQueue({
    runAt: RUN_AT,
    seedRecheckValidationContract: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.clarification_answer_receipt_queue_status, "valid_block_clarification_answer_receipt_candidate_queue_pending");
  assert.equal(result.summary.source_p34400_ready_for_answer_receipt_queue, false);
  assert.equal(result.summary.ready_for_commercial_spec_registration_handoff, false);
  assert.equal(result.clarification_answer_receipt_queue_boundary.p34800_contract_ready, true);
  assert.equal(result.p34800_clean_checkpoint_rows.find((row) => row.row_id === "p34800_checkpoint.actual_answer_capture_blocked").current_verdict, "pass");
});

test("answer receipt candidate queue never captures or exposes raw answers", async () => {
  const source = await buildP34400Source({ ready: true });
  const result = await buildClarificationAnswerReceiptCandidateQueue({
    runAt: RUN_AT,
    seedRecheckValidationContract: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.actual_answer_capture_allowed_count, 0);
  assert.equal(result.summary.raw_answer_exposure_allowed_count, 0);
  assert.equal(result.summary.queue_completion_allowed_count, 0);
  assert.ok(result.redacted_answer_receipt_candidate_queue_rows.every((row) => row.redacted_answer_receipt_required_now === true));
  assert.ok(result.redacted_answer_receipt_candidate_queue_rows.every((row) => row.redacted_answer_receipt_present_now === false));
  assert.ok(result.redacted_answer_receipt_candidate_queue_rows.every((row) => row.actual_answer_capture_allowed_now === false));
  assert.ok(result.redacted_answer_receipt_candidate_queue_rows.every((row) => row.raw_answer_persist_allowed_now === false));
  assert.ok(result.redacted_answer_receipt_candidate_queue_rows.every((row) => row.raw_answer_exposure_allowed_now === false));
  assert.ok(result.redacted_answer_receipt_candidate_queue_rows.every((row) => row.receipt_accept_allowed_now === false));
});

test("conflict, stale context, packet, and operator rows stay candidate-only", async () => {
  const source = await buildP34400Source({ ready: true });
  const result = await buildClarificationAnswerReceiptCandidateQueue({
    runAt: RUN_AT,
    seedRecheckValidationContract: source,
    commitRef: "abc1234",
  });

  assert.ok(result.conflict_resolution_ledger_candidate_rows.every((row) => row.conflict_resolution_receipt_required_now === true));
  assert.ok(result.conflict_resolution_ledger_candidate_rows.every((row) => row.conflict_resolution_receipt_present_now === false));
  assert.ok(result.conflict_resolution_ledger_candidate_rows.every((row) => row.conflict_resolution_auto_pass_allowed_now === false));
  assert.ok(result.conflict_resolution_ledger_candidate_rows.every((row) => row.conflict_bypass_allowed_now === false));
  assert.ok(result.stale_context_recheck_candidate_rows.every((row) => row.stale_context_recheck_required_now === true));
  assert.ok(result.stale_context_recheck_candidate_rows.every((row) => row.stale_context_recheck_present_now === false));
  assert.ok(result.stale_context_recheck_candidate_rows.every((row) => row.stale_context_auto_pass_allowed_now === false));
  assert.ok(result.answer_receipt_evidence_packet_candidate_rows.every((row) => row.evidence_packet_completion_allowed_now === false));
  assert.ok(result.answer_receipt_evidence_packet_candidate_rows.every((row) => row.commercial_spec_readiness_pass_allowed_now === false));
  assert.ok(result.operator_answer_receipt_queue_projection_rows.every((row) => row.capture_button_enabled_now === false));
  assert.ok(result.operator_answer_receipt_queue_projection_rows.every((row) => row.accept_button_enabled_now === false));
  assert.ok(result.operator_answer_receipt_queue_projection_rows.every((row) => row.execute_button_enabled_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.clarification_answer_receipt_queue_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing answer receipt queue artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p34800-"));
  try {
    const source = await buildP34400Source({ ready: true });
    const result = await runClarificationAnswerReceiptCandidateQueue({
      check: true,
      outDir,
      runAt: RUN_AT,
      seedRecheckValidationContract: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "clarification-answer-receipt-candidate-queue.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP34400Source({ ready }) {
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
  return p34400;
}
