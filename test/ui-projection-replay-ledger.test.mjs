import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ALL_FALSE_FLAGS,
  UI_PROJECTION_REPLAY_LEDGER_FALSE_FLAGS,
  buildUiProjectionReplayLedger,
  runUiProjectionReplayLedger,
} from "../src/ui-projection-replay-ledger.mjs";
import { buildDefaultsAssumptionsNoFakeClarity } from "../src/defaults-assumptions-no-fake-clarity.mjs";
import { buildSeedSynthesisExecutionReadiness } from "../src/seed-synthesis-execution-readiness.mjs";

const RUN_AT = "2026-06-08T01:16:24.027Z";

test("P33600 opens clarification replay capture handoff when P33200 source is ready", async () => {
  const source = await buildP33200Source({ ready: true });
  const result = await buildUiProjectionReplayLedger({
    runAt: RUN_AT,
    defaultsAssumptionsNoFakeClarity: source,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "ui-projection-replay-ledger.v1");
  assert.equal(result.program_range, "P33201-P33600");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.ui_projection_replay_ledger_status, "ready_for_ui_projection_replay_ledger");
  assert.equal(result.summary.ready_for_clarification_replay_capture_handoff, true);
  assert.equal(result.ui_projection_slot_map_rows.length, 3);
  assert.equal(result.replay_ledger_candidate_rows.length, 3);
  assert.equal(result.operator_handoff_surface_rows.length, 3);
  assert.equal(result.replay_evidence_guard_rows.length, 3);
  assert.equal(result.no_action_ui_boundary_rows.length, ALL_FALSE_FLAGS.length);
  assert.ok(result.no_action_ui_boundary_rows.length >= 320);
  assert.equal(result.ui_projection_replay_ledger_boundary.p33600_contract_ready, true);
  assert.equal(result.ui_projection_replay_ledger_boundary.ready_for_clarification_replay_capture_handoff, true);

  for (const flag of UI_PROJECTION_REPLAY_LEDGER_FALSE_FLAGS) {
    assert.equal(result.summary[flag] ?? result.ui_projection_replay_ledger_boundary[flag], false, `${flag} must stay false`);
  }
});

test("P33600 remains a valid visible block when P33200 source handoff is not ready", async () => {
  const source = await buildP33200Source({ ready: false });
  const result = await buildUiProjectionReplayLedger({
    runAt: RUN_AT,
    defaultsAssumptionsNoFakeClarity: source,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.ui_projection_replay_ledger_status, "valid_block_ui_projection_replay_ledger_pending");
  assert.equal(result.summary.source_p33200_ready_for_ui_projection_replay_ledger, false);
  assert.equal(result.summary.ready_for_clarification_replay_capture_handoff, false);
  assert.equal(result.ui_projection_replay_ledger_boundary.p33600_contract_ready, true);
  assert.equal(result.ui_projection_replay_ledger_boundary.ready_for_clarification_replay_capture_handoff, false);
  assert.equal(result.p33600_clean_checkpoint_rows.find((row) => row.row_id === "p33600_checkpoint.replay_blocker_visible").current_verdict, "pass");
});

test("UI projection slots and operator handoff never enable actions or raw answer exposure", async () => {
  const source = await buildP33200Source({ ready: true });
  const result = await buildUiProjectionReplayLedger({
    runAt: RUN_AT,
    defaultsAssumptionsNoFakeClarity: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.action_button_enabled_count, 0);
  assert.ok(result.ui_projection_slot_map_rows.every((row) => row.display_state === "blocked_needs_clarification_replay"));
  assert.ok(result.ui_projection_slot_map_rows.every((row) => row.show_blocker_badge_now === true));
  assert.ok(result.ui_projection_slot_map_rows.every((row) => row.show_replay_required_badge_now === true));
  assert.ok(result.ui_projection_slot_map_rows.every((row) => row.action_button_enabled_now === false));
  assert.ok(result.ui_projection_slot_map_rows.every((row) => row.command_dispatch_allowed_now === false));
  assert.ok(result.ui_projection_slot_map_rows.every((row) => row.raw_answer_exposure_allowed_now === false));
  assert.ok(result.operator_handoff_surface_rows.every((row) => row.visible_to_operator_now === true));
  assert.ok(result.operator_handoff_surface_rows.every((row) => row.action_button_enabled_now === false));
  assert.ok(result.operator_handoff_surface_rows.every((row) => row.state_mutation_allowed_now === false));
  assert.ok(result.operator_handoff_surface_rows.every((row) => row.user_answer_capture_allowed_now === false));
});

test("replay ledger and evidence guard require receipts before replay or seed unblock", async () => {
  const source = await buildP33200Source({ ready: true });
  const result = await buildUiProjectionReplayLedger({
    runAt: RUN_AT,
    defaultsAssumptionsNoFakeClarity: source,
    commitRef: "abc1234",
  });

  assert.equal(result.summary.replay_execution_allowed_count, 0);
  assert.equal(result.summary.replay_evidence_blocker_count, 3);
  assert.ok(result.replay_ledger_candidate_rows.every((row) => row.answer_receipt_required_before_unblock === true));
  assert.ok(result.replay_ledger_candidate_rows.every((row) => row.replay_receipt_present_now === false));
  assert.ok(result.replay_ledger_candidate_rows.every((row) => row.replay_receipt_auto_accept_allowed_now === false));
  assert.ok(result.replay_ledger_candidate_rows.every((row) => row.replay_verification_pass_allowed_now === false));
  assert.ok(result.replay_ledger_candidate_rows.every((row) => row.seed_recheck_allowed_now === false));
  assert.ok(result.replay_evidence_guard_rows.every((row) => row.redacted_answer_receipt_present_now === false));
  assert.ok(result.replay_evidence_guard_rows.every((row) => row.missing_evidence_blocker_visible_now === true));
  assert.ok(result.replay_evidence_guard_rows.every((row) => row.seed_unblock_allowed_now === false));
  assert.ok(result.replay_evidence_guard_rows.every((row) => row.execution_allowed_now === false));

  for (const flag of ALL_FALSE_FLAGS) {
    assert.equal(result.ui_projection_replay_ledger_boundary[flag], false, `${flag} must stay false`);
  }
});

test("check mode validates without writing UI projection replay artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p33600-"));
  try {
    const source = await buildP33200Source({ ready: true });
    const result = await runUiProjectionReplayLedger({
      check: true,
      outDir,
      runAt: RUN_AT,
      defaultsAssumptionsNoFakeClarity: source,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "ui-projection-replay-ledger.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(outDir, { force: true, recursive: true });
  }
});

async function buildP33200Source({ ready }) {
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

  return buildDefaultsAssumptionsNoFakeClarity({
    runAt: RUN_AT,
    seedSynthesisExecutionReadiness: p32800,
    commitRef: "abc1234",
  });
}
