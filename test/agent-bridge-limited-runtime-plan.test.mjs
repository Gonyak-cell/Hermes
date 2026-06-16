import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildAgentBridgeLimitedRuntimePlan,
  parseAgentBridgeLimitedRuntimePlanArgs,
  runAgentBridgeLimitedRuntimePlan,
  validateAgentBridgeLimitedRuntimePlanResult,
} from "../src/agent-bridge-limited-runtime-plan.mjs";

const RUN_AT = "2026-06-16T07:00:00.000Z";

test("Agent Bridge limited runtime plan creates dry-run traces without execution", async () => {
  const result = await buildAgentBridgeLimitedRuntimePlan({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "agent-bridge-limited-runtime-plan.v1");
  assert.equal(result.capability_id, "platform.agent_bridge_limited_runtime_plan");
  assert.equal(result.summary.agent_bridge_limited_runtime_plan_status, "ready_for_agent_bridge_limited_runtime_plan");
  assert.equal(result.summary.source_agent_bridge_execution_candidate_status, "ready_for_agent_bridge_execution_candidate");
  assert.equal(result.summary.dry_run_executor_count >= 13, true);
  assert.equal(result.summary.owner_gate_count, result.summary.dry_run_executor_count);
  assert.equal(result.summary.execution_allowed_now, false);
  assert.equal(result.summary.command_executed_now, false);
  assert.equal(result.summary.command_output_captured_now, false);
  assert.equal(result.summary.mutation_performed, false);
  assert.equal(result.limited_runtime_boundary.ready_for_l9_dry_run_operator_handoff, true);
  assert.equal(result.limited_runtime_boundary.ready_for_l10_preflight_candidate_handoff, true);
});

test("Agent Bridge dry-run executor rows print intended commands only", async () => {
  const result = await buildAgentBridgeLimitedRuntimePlan({ runAt: RUN_AT, write: false });

  assert.equal(result.dry_run_executor_rows.every((row) => row.executor_adapter_status === "printed_intended_command_only"), true);
  assert.equal(result.dry_run_executor_rows.every((row) => row.printed_intended_command.startsWith("DRY RUN ONLY: ")), true);
  assert.equal(result.dry_run_executor_rows.every((row) => row.command_executed_now === false), true);
  assert.equal(result.dry_run_executor_rows.every((row) => row.command_output_captured_now === false), true);
  assert.equal(result.dry_run_executor_rows.every((row) => row.mutation_performed === false), true);
  assert.equal(result.owner_limited_execution_gate_rows.every((row) => row.owner_approval_observed === false), true);
});

test("Agent Bridge provider adapter requests stay packet-only with transport closed", async () => {
  const result = await buildAgentBridgeLimitedRuntimePlan({ runAt: RUN_AT, write: false });

  assert.deepEqual(result.provider_adapter_request_rows.map((row) => row.adapter_id), [
    "adapter.agbrowse.chatgpt_review_request",
    "adapter.claude_code.read_only_review_request",
    "adapter.codex.task_request_packet",
  ]);
  assert.equal(result.provider_adapter_request_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.provider_adapter_request_rows.every((row) => row.request_transport_submission_allowed_now === false), true);
  assert.equal(result.provider_adapter_request_rows.every((row) => row.provider_automation_allowed_now === false), true);
  assert.equal(result.provider_adapter_request_rows.every((row) => row.execution_allowed_now === false), true);
});

test("Agent Bridge limited runtime plan blocks protected runtime command fixtures", async () => {
  const result = await buildAgentBridgeLimitedRuntimePlan({ runAt: RUN_AT, write: false });
  const observedTypes = new Set(result.blocked_runtime_command_fixture_rows.map((row) => row.observed_protected_action_type));

  assert.equal(result.blocked_runtime_command_fixture_rows.length >= 14, true);
  assert.equal(result.blocked_runtime_command_fixture_rows.every((row) => row.current_verdict === "pass" && row.blocked === true), true);
  for (const type of ["git_merge", "deploy", "approve", "apply_patch_or_receipt", "secret_read", "raw_source_exposure", "shell_indirection", "destructive_delete"]) {
    assert.equal(observedTypes.has(type), true);
  }
});

test("Agent Bridge limited runtime plan validation fails if execution opens", async () => {
  const result = await buildAgentBridgeLimitedRuntimePlan({ runAt: RUN_AT, write: false });
  const schema = JSON.parse(await readFile("schemas/agent-bridge-limited-runtime-plan.schema.json", "utf8"));
  const tampered = JSON.parse(JSON.stringify(result));
  delete tampered.markdown;
  tampered.dry_run_executor_rows[0].command_executed_now = true;
  tampered.limited_runtime_boundary.execution_allowed_now = true;
  tampered.summary.execution_allowed_now = true;

  const validation = validateAgentBridgeLimitedRuntimePlanResult(tampered, schema);
  assert.equal(validation.validation.valid, false);
  assert.equal(validation.validation.errors.some((error) => error.path === "dry_run.rows"), true);
});

test("Agent Bridge limited runtime plan --check validates without overwriting artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-agent-bridge-limited-runtime-plan-"));
  const sentinelPath = path.join(outDir, "agent-bridge-limited-runtime-plan.json");
  const sentinel = "{ \"sentinel\": \"agent-bridge-limited-runtime-plan\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");
  try {
    const result = await runAgentBridgeLimitedRuntimePlan({
      runAt: RUN_AT,
      check: true,
      write: false,
      outDir,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Agent Bridge limited runtime plan CLI parser accepts only known flags", () => {
  assert.deepEqual(parseAgentBridgeLimitedRuntimePlanArgs(["--check", "--runbook-path", "docs/runbook.md"]), {
    check: true,
    write: false,
    runbookPath: "docs/runbook.md",
  });
  assert.throws(() => parseAgentBridgeLimitedRuntimePlanArgs(["--execute"]), /Unknown argument: --execute/);
  assert.throws(() => parseAgentBridgeLimitedRuntimePlanArgs(["--source-agent-bridge-execution-candidate-path"]), /Missing value for --source-agent-bridge-execution-candidate-path/);
});
