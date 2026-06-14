import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildHermesLoopRuntimeToolGovernance,
  runHermesLoopRuntimeToolGovernance,
} from "../src/hermes-loop-runtime-tool-governance.mjs";
import { buildHermesLoopModelBudgetControl } from "../src/hermes-loop-model-budget-control.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P63200 projects runtime tool governance while keeping execution closed", async () => {
  const result = await buildHermesLoopRuntimeToolGovernance({
    runAt: RUN_AT,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "hermes-loop-runtime-tool-governance.v1");
  assert.equal(result.program_range, "P62801-P63200");
  assert.equal(result.source_program_range, "P62401-P62800");
  assert.equal(result.next_program_range, "P63201-P63600");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.hermes_loop_runtime_tool_status, "ready_for_p63201_handoff");
  assert.equal(result.summary.p62800_source_ready_now, true);
  assert.equal(result.summary.p63200_contract_ready, true);
  assert.equal(result.runtime_adapter_contract_rows.length, 15);
  assert.equal(result.tool_policy_contract_rows.length, 15);
  assert.equal(result.command_allowlist_candidate_rows.length, 10);
  assert.equal(result.sandbox_timeout_log_artifact_rows.length, 9);
  assert.equal(result.runtime_verification_guard_rows.length, 9);
  assert.equal(result.summary.command_execution_allowed_now, false);
  assert.equal(result.summary.tool_invocation_allowed_now, false);
  assert.equal(result.summary.secret_read_allowed_now, false);
  assert.equal(result.summary.rollback_execution_allowed_now, false);
  assert.equal(result.summary.api_mutation_allowed_now, false);
  assert.equal(result.summary.direct_file_write_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
});

test("invalid P62800 source blocks P63200 runtime tool governance", async () => {
  const sourceModelBudget = await buildHermesLoopModelBudgetControl({ runAt: RUN_AT, commitRef: "abc1234" });
  sourceModelBudget.validation = { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] };
  sourceModelBudget.summary.ready_for_p62801_handoff = false;

  const result = await buildHermesLoopRuntimeToolGovernance({
    runAt: RUN_AT,
    commitRef: "abc1234",
    sourceModelBudget,
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.hermes_loop_runtime_tool_status, "blocked_hermes_loop_runtime_tool_governance");
  assert.equal(result.hermes_loop_runtime_tool_boundary.p62800_source_ready_now, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p62800"));
});

test("missing runtime adapter binding blocks P63200 closeout", async () => {
  const result = await buildHermesLoopRuntimeToolGovernance({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitRuntimeAdapterItem: "runtime adapter binding",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.runtime_adapter"));
});

test("missing command allowlist candidate blocks P63200 closeout", async () => {
  const result = await buildHermesLoopRuntimeToolGovernance({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitCommandAllowlistCandidate: "command allowlist candidate",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.command_allowlist"));
});

test("missing runtime verification guard blocks P63200 closeout", async () => {
  const result = await buildHermesLoopRuntimeToolGovernance({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitRuntimeGuard: "secret_read_blocked",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.runtime_guard"));
});

test("unsafe command execution authority blocks P63200 closeout", async () => {
  const result = await buildHermesLoopRuntimeToolGovernance({
    runAt: RUN_AT,
    commitRef: "abc1234",
    authorityOverrides: {
      command_execution_allowed_now: true,
    },
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.hermes_loop_runtime_tool_boundary.command_execution_allowed_now, true);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.authority"));
});

test("check mode validates without writing runtime tool artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-loop-runtime-tool-"));
  try {
    const result = await runHermesLoopRuntimeToolGovernance({
      check: true,
      outDir,
      runAt: RUN_AT,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "hermes-loop-runtime-tool-governance.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
