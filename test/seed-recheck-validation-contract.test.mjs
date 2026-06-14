import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  SEED_RECHECK_VALIDATION_CONTRACT_FALSE_FLAGS,
  buildSeedRecheckValidationContract,
  runSeedRecheckValidationContract,
} from "../src/seed-recheck-validation-contract.mjs";
import { buildClarificationReplayCaptureContract } from "../src/clarification-replay-capture-contract.mjs";
import { buildUiProjectionReplayLedger } from "../src/ui-projection-replay-ledger.mjs";
import { buildDefaultsAssumptionsNoFakeClarity } from "../src/defaults-assumptions-no-fake-clarity.mjs";
import { buildSeedSynthesisExecutionReadiness } from "../src/seed-synthesis-execution-readiness.mjs";

const RUN_AT = "2026-06-08T02:03:22.417Z";

test("P34400 opens commercial spec readiness handoff when P34000 source is ready", async () => {
  const source = await buildP34000Source({ ready: true });
  const result = await buildSeedRecheckValidationContract({
    runAt: RUN_AT,
    clarificationReplayCaptureContract: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "seed-recheck-validation-contract.v1");
  assert.equal(result.program_range, "P34001-P34400");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.seed_recheck_validation_status, "ready_for_seed_recheck_validation_contract");
  assert.equal(result.summary.ready_for_commercial_spec_readiness_handoff, true);
  assert.equal(result.clarification_sufficiency_evidence_rows.length, 3);
  assert.equal(result.missing_answer_blocker_rule_rows.length, 12);
  assert.equal(result.seed_recheck_validator_candidate_rows.length, 3);
  assert.equal(result.operator_seed_recheck_projection_rows.length, 3);
  assert.ok(result.no_fake_execution_gate_rows.length >= 340);
  assert.equal(result.seed_recheck_validation_boundary.p34400_contract_ready, true);

  for (const flag of SEED_RECHECK_VALIDATION_CONTRACT_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.seed_recheck_validation_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P34400 remains a valid visible block when P34000 handoff is not ready", async () => {
  const source = await buildP34000Source({ ready: false });
  const result = await buildSeedRecheckValidationContract({
    runAt: RUN_AT,
    clarificationReplayCaptureContract: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.seed_recheck_validation_status, "valid_block_seed_recheck_validation_contract_pending");
  assert.equal(result.summary.source_p34000_ready_for_seed_recheck_validation, false);
  assert.equal(result.summary.ready_for_commercial_spec_readiness_handoff, false);
  assert.equal(result.seed_recheck_validation_boundary.p34400_contract_ready, true);
  assert.equal(result.p34400_clean_checkpoint_rows.find((row) => row.row_id === "p34400_checkpoint.sufficiency_auto_pass_blocked").current_verdict, "pass");
});

test("clarification sufficiency evidence never auto-passes missing answers or conflicts", async () => {
  const source = await buildP34000Source({ ready: true });
  const result = await buildSeedRecheckValidationContract({
    runAt: RUN_AT,
    clarificationReplayCaptureContract: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.sufficiency_auto_pass_allowed_count, 0);
  assert.ok(result.clarification_sufficiency_evidence_rows.every((row) => row.clarification_sufficiency_candidate_visible_now === true));
  assert.ok(result.clarification_sufficiency_evidence_rows.every((row) => row.clarification_sufficiency_pass_allowed_now === false));
  assert.ok(result.clarification_sufficiency_evidence_rows.every((row) => row.seed_recheck_sufficiency_auto_pass_allowed_now === false));
  assert.ok(result.missing_answer_blocker_rule_rows.every((row) => row.blocker_visible_now === true));
  assert.ok(result.missing_answer_blocker_rule_rows.every((row) => row.missing_answer_bypass_allowed_now === false));
  assert.ok(result.missing_answer_blocker_rule_rows.every((row) => row.stale_context_bypass_allowed_now === false));
  assert.ok(result.missing_answer_blocker_rule_rows.every((row) => row.conflict_bypass_allowed_now === false));
});

test("seed recheck validator and operator projection never execute or unblock seeds", async () => {
  const source = await buildP34000Source({ ready: true });
  const result = await buildSeedRecheckValidationContract({
    runAt: RUN_AT,
    clarificationReplayCaptureContract: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.seed_recheck_execution_allowed_count, 0);
  assert.equal(result.summary.seed_recheck_pass_allowed_count, 0);
  assert.ok(result.seed_recheck_validator_candidate_rows.every((row) => row.validator_candidate_visible_now === true));
  assert.ok(result.seed_recheck_validator_candidate_rows.every((row) => row.validator_run_allowed_now === false));
  assert.ok(result.seed_recheck_validator_candidate_rows.every((row) => row.seed_recheck_execution_allowed_now === false));
  assert.ok(result.seed_recheck_validator_candidate_rows.every((row) => row.seed_recheck_verification_pass_allowed_now === false));
  assert.ok(result.seed_recheck_validator_candidate_rows.every((row) => row.seed_unblock_allowed_now === false));
  assert.ok(result.operator_seed_recheck_projection_rows.every((row) => row.action_button_enabled_now === false));
  assert.ok(result.operator_seed_recheck_projection_rows.every((row) => row.approve_button_enabled_now === false));
  assert.ok(result.operator_seed_recheck_projection_rows.every((row) => row.execute_button_enabled_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.seed_recheck_validation_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing seed recheck validation artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p34400-"));
  try {
    const source = await buildP34000Source({ ready: true });
    const result = await runSeedRecheckValidationContract({
      check: true,
      outDir,
      runAt: RUN_AT,
      clarificationReplayCaptureContract: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "seed-recheck-validation-contract.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP34000Source({ ready }) {
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
  return p34000;
}
