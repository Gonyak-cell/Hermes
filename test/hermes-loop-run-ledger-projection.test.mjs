import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildHermesLoopRunLedgerProjection,
  runHermesLoopRunLedgerProjection,
} from "../src/hermes-loop-run-ledger-projection.mjs";
import { buildHermesLoopAgentControlContract } from "../src/hermes-loop-agent-control-contract.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "../src/hermes-loop-source-binding.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P61600 projects source events, state transitions, gates, blockers, and refs", async () => {
  const result = await buildHermesLoopRunLedgerProjection({
    runAt: RUN_AT,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "hermes-loop-run-ledger-projection.v1");
  assert.equal(result.program_range, "P61201-P61600");
  assert.equal(result.source_program_range, "P60801-P61200");
  assert.equal(result.next_program_range, "P61601-P62000");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.hermes_loop_run_ledger_status, "ready_for_p61601_handoff");
  assert.equal(result.summary.p61200_source_ready_now, true);
  assert.equal(result.summary.p61600_contract_ready, true);
  assert.equal(result.source_event_to_loop_run_projection_rows.length, 12);
  assert.equal(result.workflow_state_transition_binding_rows.length, 13);
  assert.equal(result.gate_result_binding_rows.length, 13);
  assert.equal(result.blocker_next_action_projection_rows.length, 10);
  assert.equal(result.agent_ref_projection_rows.length, 8);

  for (const flag of HERMES_LOOP_AUTHORITY_FALSE_FLAGS) {
    assert.equal(result.hermes_loop_run_ledger_boundary[flag], false, `${flag} must stay false`);
    assert.equal(result.summary[flag], false, `${flag} summary must stay false`);
  }
});

test("invalid P61200 source blocks run ledger projection", async () => {
  const sourceAgentControl = await buildHermesLoopAgentControlContract({ runAt: RUN_AT, commitRef: "abc1234" });
  sourceAgentControl.validation = { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] };
  sourceAgentControl.summary.ready_for_p61201_handoff = false;

  const result = await buildHermesLoopRunLedgerProjection({
    runAt: RUN_AT,
    commitRef: "abc1234",
    sourceAgentControl,
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.hermes_loop_run_ledger_status, "blocked_hermes_loop_run_ledger_projection");
  assert.equal(result.hermes_loop_run_ledger_boundary.p61200_source_ready_now, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p61200"));
});

test("missing trigger mapping blocks P61600 closeout", async () => {
  const result = await buildHermesLoopRunLedgerProjection({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitTrigger: "manual operator request",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.triggers"));
  assert.equal(result.source_event_to_loop_run_projection_rows.some((row) => row.trigger_type === "manual operator request"), false);
});

test("missing blocker next action blocks P61600 closeout", async () => {
  const result = await buildHermesLoopRunLedgerProjection({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitBlockerAction: "missing_evidence",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.blockers"));
  assert.equal(result.blocker_next_action_projection_rows.some((row) => row.blocker_id === "missing_evidence"), false);
});

test("unsafe authority carryover blocks P61600 closeout", async () => {
  const result = await buildHermesLoopRunLedgerProjection({
    runAt: RUN_AT,
    commitRef: "abc1234",
    authorityOverrides: {
      write_action_allowed_now: true,
    },
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.hermes_loop_run_ledger_boundary.authority_boundary_carryover_closed_now, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.authority"));
  assert.equal(result.authority_boundary_carryover_rows.find((row) => row.authority_flag === "write_action_allowed_now").current_verdict, "block");
});

test("check mode validates without writing run ledger artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-loop-run-ledger-"));
  try {
    const result = await runHermesLoopRunLedgerProjection({
      check: true,
      outDir,
      runAt: RUN_AT,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "hermes-loop-run-ledger-projection.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
