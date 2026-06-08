import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  DEFAULTS_ASSUMPTIONS_NO_FAKE_CLARITY_FALSE_FLAGS,
  buildDefaultsAssumptionsNoFakeClarity,
  runDefaultsAssumptionsNoFakeClarity,
} from "../src/defaults-assumptions-no-fake-clarity.mjs";
import { buildSeedSynthesisExecutionReadiness } from "../src/seed-synthesis-execution-readiness.mjs";

const RUN_AT = "2026-06-08T01:16:24.027Z";

test("P33200 opens UI projection replay ledger handoff when P32800 source is ready", async () => {
  const source = await buildP32800Source({ ready: true });
  const result = await buildDefaultsAssumptionsNoFakeClarity({
    runAt: RUN_AT,
    seedSynthesisExecutionReadiness: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "defaults-assumptions-no-fake-clarity.v1");
  assert.equal(result.program_range, "P32801-P33200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.defaults_assumptions_no_fake_clarity_status, "ready_for_defaults_assumptions_no_fake_clarity");
  assert.equal(result.summary.ready_for_ui_projection_replay_ledger, true);
  assert.equal(result.defaults_assumptions_ledger_rows.length, 3);
  assert.equal(result.assumption_risk_classifier_rows.length, 3);
  assert.equal(result.no_fake_clarity_guard_rows.length, 3);
  assert.equal(result.clarification_replay_precondition_rows.length, 3);
  assert.equal(result.blocked_seed_handoff_rows.length, 3);
  assert.equal(result.no_fake_clarity_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_fake_clarity_boundary_rows.length >= 300);
  assert.equal(result.defaults_assumptions_no_fake_clarity_boundary.p33200_contract_ready, true);
  assert.equal(result.defaults_assumptions_no_fake_clarity_boundary.ready_for_ui_projection_replay_ledger, true);

  for (const flag of DEFAULTS_ASSUMPTIONS_NO_FAKE_CLARITY_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.defaults_assumptions_no_fake_clarity_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P33200 remains a valid visible block when P32800 source handoff is not ready", async () => {
  const source = await buildP32800Source({ ready: false });
  const result = await buildDefaultsAssumptionsNoFakeClarity({
    runAt: RUN_AT,
    seedSynthesisExecutionReadiness: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.defaults_assumptions_no_fake_clarity_status, "valid_block_defaults_assumptions_no_fake_clarity_pending");
  assert.equal(result.summary.source_p32800_ready_for_defaults_guard, false);
  assert.equal(result.summary.ready_for_ui_projection_replay_ledger, false);
  assert.equal(result.defaults_assumptions_no_fake_clarity_boundary.p33200_contract_ready, true);
  assert.equal(result.defaults_assumptions_no_fake_clarity_boundary.ready_for_ui_projection_replay_ledger, false);
  assert.equal(result.p33200_clean_checkpoint_rows.find((row) => row.row_id === "p33200_checkpoint.fake_clarity_blocker_visible").current_verdict, "pass");
});

test("defaults assumptions never replace missing answers or become facts", async () => {
  const source = await buildP32800Source({ ready: true });
  const result = await buildDefaultsAssumptionsNoFakeClarity({
    runAt: RUN_AT,
    seedSynthesisExecutionReadiness: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.default_applied_count, 0);
  assert.equal(result.summary.seed_unblocked_count, 0);
  assert.ok(result.defaults_assumptions_ledger_rows.every((row) => row.default_policy === "no_default_may_replace_missing_answer_receipt"));
  assert.ok(result.defaults_assumptions_ledger_rows.every((row) => row.default_applied_now === false));
  assert.ok(result.defaults_assumptions_ledger_rows.every((row) => row.missing_answer_default_allowed_now === false));
  assert.ok(result.defaults_assumptions_ledger_rows.every((row) => row.assumption_as_fact_allowed_now === false));
  assert.ok(result.assumption_risk_classifier_rows.every((row) => row.risk_tier === "high"));
  assert.ok(result.assumption_risk_classifier_rows.every((row) => row.requires_clarification_replay === true));
});

test("no-fake-clarity guard keeps blocked seed handoff visible without execution", async () => {
  const source = await buildP32800Source({ ready: true });
  const result = await buildDefaultsAssumptionsNoFakeClarity({
    runAt: RUN_AT,
    seedSynthesisExecutionReadiness: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.fake_clarity_blocked_count, 3);
  assert.ok(result.no_fake_clarity_guard_rows.every((row) => row.fake_clarity_blocked_now === true));
  assert.ok(result.no_fake_clarity_guard_rows.every((row) => row.spec_marked_clear_now === false));
  assert.ok(result.no_fake_clarity_guard_rows.every((row) => row.seed_unblock_allowed_now === false));
  assert.ok(result.clarification_replay_precondition_rows.every((row) => row.answer_receipt_required_before_unblock === true));
  assert.ok(result.clarification_replay_precondition_rows.every((row) => row.replay_receipt_present_now === false));
  assert.ok(result.blocked_seed_handoff_rows.every((row) => row.fake_clarity_blocked_now === true));
  assert.ok(result.blocked_seed_handoff_rows.every((row) => row.final_seed_allowed_now === false));
  assert.ok(result.blocked_seed_handoff_rows.every((row) => row.execution_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.defaults_assumptions_no_fake_clarity_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing defaults assumptions artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p33200-"));
  try {
    const source = await buildP32800Source({ ready: true });
    const result = await runDefaultsAssumptionsNoFakeClarity({
      check: true,
      outDir,
      runAt: RUN_AT,
      seedSynthesisExecutionReadiness: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "defaults-assumptions-no-fake-clarity.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP32800Source({ ready }) {
  const source = await buildSeedSynthesisExecutionReadiness({
    runAt: RUN_AT,
    write: false,
    commitRef: "abc1234",
  });
  source.summary.ready_for_defaults_no_fake_clarity_guard = ready;
  source.summary.source_p32400_ready_for_seed_synthesis_candidate = true;
  source.seed_synthesis_execution_readiness_boundary.ready_for_defaults_no_fake_clarity_guard = ready;
  source.seed_synthesis_execution_readiness_boundary.source_p32400_ready_for_seed_synthesis_candidate = true;
  source.validation = { valid: true, error_count: 0, errors: [] };
  return source;
}
