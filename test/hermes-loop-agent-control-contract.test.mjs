import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildHermesLoopAgentControlContract,
  runHermesLoopAgentControlContract,
} from "../src/hermes-loop-agent-control-contract.mjs";
import { buildHermesLoopOverlayContract } from "../src/hermes-loop-overlay-contract.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "../src/hermes-loop-source-binding.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P61200 projects worker, verifier, model route, budget, gate, and authority rows", async () => {
  const result = await buildHermesLoopAgentControlContract({
    runAt: RUN_AT,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "hermes-loop-agent-control-contract.v1");
  assert.equal(result.program_range, "P60801-P61200");
  assert.equal(result.source_program_range, "P60401-P60800");
  assert.equal(result.next_program_range, "P61201-P61600");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.hermes_loop_agent_control_status, "ready_for_p61201_handoff");
  assert.equal(result.summary.p60800_source_ready_now, true);
  assert.equal(result.summary.p61200_contract_ready, true);
  assert.equal(result.summary.ready_for_p61201_handoff, true);
  assert.equal(result.worker_run_schema_rows.length, 15);
  assert.equal(result.verifier_run_schema_rows.length, 16);
  assert.equal(result.model_route_decision_schema_rows.length, 17);
  assert.equal(result.budget_decision_schema_rows.length, 21);
  assert.equal(result.gate_result_schema_rows.length, 12);
  assert.equal(result.authority_boundary_schema_rows.length, 13);
  assert.equal(result.worker_verifier_separation_rows.length, 6);
  assert.equal(result.model_budget_control_rows.length, 5);

  for (const flag of HERMES_LOOP_AUTHORITY_FALSE_FLAGS) {
    assert.equal(result.hermes_loop_agent_control_boundary[flag], false, `${flag} must stay false`);
    assert.equal(result.summary[flag], false, `${flag} summary must stay false`);
  }
});

test("invalid P60800 source blocks P61200 closeout", async () => {
  const sourceOverlay = await buildHermesLoopOverlayContract({ runAt: RUN_AT, commitRef: "abc1234" });
  sourceOverlay.validation = { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] };
  sourceOverlay.summary.ready_for_p60801_handoff = false;

  const result = await buildHermesLoopAgentControlContract({
    runAt: RUN_AT,
    commitRef: "abc1234",
    sourceOverlay,
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.hermes_loop_agent_control_status, "blocked_hermes_loop_agent_control_contract");
  assert.equal(result.hermes_loop_agent_control_boundary.p60800_source_ready_now, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p60800"));
});

test("missing worker field blocks P61200 closeout", async () => {
  const result = await buildHermesLoopAgentControlContract({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitWorkerField: "verifier_required",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.worker"));
  assert.equal(result.worker_run_schema_rows.some((row) => row.field_name === "verifier_required"), false);
});

test("missing model budget marker blocks P61200 closeout", async () => {
  const result = await buildHermesLoopAgentControlContract({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitModelBudgetMarker: "budget_block_next_action",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.model_budget"));
  assert.equal(result.model_budget_control_rows.some((row) => row.marker_id === "budget_block_next_action"), false);
});

test("unsafe authority carryover blocks P61200 closeout", async () => {
  const result = await buildHermesLoopAgentControlContract({
    runAt: RUN_AT,
    commitRef: "abc1234",
    authorityOverrides: {
      runtime_execution_allowed_now: true,
    },
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.hermes_loop_agent_control_boundary.authority_boundary_carryover_closed_now, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.authority"));
  assert.equal(result.authority_boundary_carryover_rows.find((row) => row.authority_flag === "runtime_execution_allowed_now").current_verdict, "block");
});

test("check mode validates without writing agent control artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-loop-agent-control-"));
  try {
    const result = await runHermesLoopAgentControlContract({
      check: true,
      outDir,
      runAt: RUN_AT,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "hermes-loop-agent-control-contract.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
