import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildHermesLoopModelBudgetControl,
  runHermesLoopModelBudgetControl,
} from "../src/hermes-loop-model-budget-control.mjs";
import { buildHermesLoopDagTopology } from "../src/hermes-loop-dag-topology.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P62800 projects model route and budget gates while keeping model calls closed", async () => {
  const result = await buildHermesLoopModelBudgetControl({
    runAt: RUN_AT,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "hermes-loop-model-budget-control.v1");
  assert.equal(result.program_range, "P62401-P62800");
  assert.equal(result.source_program_range, "P62001-P62400");
  assert.equal(result.next_program_range, "P62801-P63200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.hermes_loop_model_budget_status, "ready_for_p62801_handoff");
  assert.equal(result.summary.p62400_source_ready_now, true);
  assert.equal(result.summary.p62800_contract_ready, true);
  assert.equal(result.model_route_decision_contract_rows.length, 17);
  assert.equal(result.budget_decision_contract_rows.length, 21);
  assert.equal(result.route_gate_policy_rows.length, 8);
  assert.equal(result.budget_guardrail_rows.length, 12);
  assert.equal(result.downgrade_stop_policy_rows.length, 9);
  assert.equal(result.summary.model_call_allowed_now, false);
  assert.equal(result.summary.runtime_model_selection_allowed_now, false);
  assert.equal(result.summary.high_cost_escalation_allowed_now, false);
  assert.equal(result.summary.budget_spend_allowed_now, false);
  assert.equal(result.summary.external_model_transfer_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
});

test("invalid P62400 source blocks P62800 model budget control", async () => {
  const sourceDagTopology = await buildHermesLoopDagTopology({ runAt: RUN_AT, commitRef: "abc1234" });
  sourceDagTopology.validation = { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] };
  sourceDagTopology.summary.ready_for_p62401_handoff = false;

  const result = await buildHermesLoopModelBudgetControl({
    runAt: RUN_AT,
    commitRef: "abc1234",
    sourceDagTopology,
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.hermes_loop_model_budget_status, "blocked_hermes_loop_model_budget_control");
  assert.equal(result.hermes_loop_model_budget_boundary.p62400_source_ready_now, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p62400"));
});

test("missing model route decision field blocks P62800 closeout", async () => {
  const result = await buildHermesLoopModelBudgetControl({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitModelRouteField: "`task_class`",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.model_route"));
  assert.equal(result.model_route_decision_contract_rows.some((row) => row.marker === "`task_class`"), false);
});

test("missing budget decision field blocks P62800 closeout", async () => {
  const result = await buildHermesLoopModelBudgetControl({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitBudgetDecisionField: "`budget_margin_usd`",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.budget_decision"));
});

test("missing downgrade stop policy blocks P62800 closeout", async () => {
  const result = await buildHermesLoopModelBudgetControl({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitDowngradeStopPolicy: "budget_exceeded_stops_or_downgrades",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.downgrade_stop"));
});

test("unsafe model call authority blocks P62800 closeout", async () => {
  const result = await buildHermesLoopModelBudgetControl({
    runAt: RUN_AT,
    commitRef: "abc1234",
    authorityOverrides: {
      model_call_allowed_now: true,
    },
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.hermes_loop_model_budget_boundary.model_call_allowed_now, true);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.authority"));
});

test("check mode validates without writing model budget artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-loop-model-budget-"));
  try {
    const result = await runHermesLoopModelBudgetControl({
      check: true,
      outDir,
      runAt: RUN_AT,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "hermes-loop-model-budget-control.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
