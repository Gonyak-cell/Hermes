import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildAgentBridgeExecutionCandidate,
  parseAgentBridgeExecutionCandidateArgs,
  runAgentBridgeExecutionCandidate,
  validateAgentBridgeExecutionCandidateResult,
} from "../src/agent-bridge-execution-candidate.mjs";

const RUN_AT = "2026-06-16T05:00:00.000Z";

test("Agent Bridge execution candidate builds a receipt-gated command candidate queue without execution", async () => {
  const result = await buildAgentBridgeExecutionCandidate({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "agent-bridge-execution-candidate.v1");
  assert.equal(result.capability_id, "platform.agent_bridge_execution_candidate");
  assert.equal(result.summary.agent_bridge_execution_candidate_status, "ready_for_agent_bridge_execution_candidate");
  assert.equal(result.summary.source_agent_bridge_manifest_status, "ready_for_agent_bridge_manifest");
  assert.equal(result.summary.source_agent_bridge_request_receipt_status, "ready_for_agent_bridge_request_receipt");
  assert.equal(result.summary.controlled_execution_candidate_enabled_now, true);
  assert.equal(result.summary.candidate_queue_enabled_now, true);
  assert.equal(result.summary.execution_allowed_now, false);
  assert.equal(result.summary.command_executed_now, false);
  assert.equal(result.summary.command_output_captured_now, false);
  assert.equal(result.summary.mutation_performed, false);
  assert.equal(result.summary.receipt_application_allowed_now, false);
  assert.equal(result.agent_bridge_execution_boundary.ready_for_limited_execution_gate_projection, true);
});

test("Agent Bridge execution candidates are allowlisted, receipt gated, and non-executable", async () => {
  const result = await buildAgentBridgeExecutionCandidate({ runAt: RUN_AT, write: false });

  assert.equal(result.agent_bridge_execution_candidate_rows.length >= 5, true);
  assert.equal(result.agent_bridge_execution_candidate_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.agent_bridge_execution_candidate_rows.every((row) => row.allowlist_match === true), true);
  assert.equal(result.agent_bridge_execution_candidate_rows.every((row) => row.package_script_registered === true), true);
  assert.equal(result.agent_bridge_execution_candidate_rows.every((row) => row.human_receipt_required_before_execution === true), true);
  assert.equal(result.agent_bridge_execution_candidate_rows.every((row) => row.limited_execution_receipt_required === true), true);
  assert.equal(result.agent_bridge_execution_candidate_rows.every((row) => row.execution_allowed_now === false), true);
  assert.equal(result.agent_bridge_execution_candidate_rows.every((row) => row.command_executed_now === false), true);
  assert.equal(result.agent_bridge_execution_candidate_rows.every((row) => row.command_output_captured_now === false), true);
  assert.equal(result.agent_bridge_execution_candidate_rows.every((row) => row.mutation_performed === false), true);
});

test("Agent Bridge execution candidate blocks protected and destructive command fixtures", async () => {
  const result = await buildAgentBridgeExecutionCandidate({ runAt: RUN_AT, write: false });
  const observedTypes = new Set(result.blocked_command_fixture_rows.map((row) => row.observed_protected_action_type));

  assert.equal(result.blocked_command_fixture_rows.length >= 9, true);
  assert.equal(result.blocked_command_fixture_rows.every((row) => row.current_verdict === "pass" && row.blocked === true), true);
  assert.equal(result.blocked_command_fixture_rows.every((row) => row.allowlist_match === false), true);
  assert.equal(result.blocked_command_fixture_rows.every((row) => row.execution_allowed_now === false && row.command_executed_now === false), true);
  for (const type of ["git_push", "git_commit", "deploy", "approve", "apply_patch_or_receipt", "secret_read", "shell_indirection", "raw_source_exposure", "destructive_delete"]) {
    assert.equal(observedTypes.has(type), true);
  }
});

test("Agent Bridge execution candidate validation fails if a candidate executes", async () => {
  const result = await buildAgentBridgeExecutionCandidate({ runAt: RUN_AT, write: false });
  const schema = JSON.parse(await readFile("schemas/agent-bridge-execution-candidate.schema.json", "utf8"));
  const tampered = JSON.parse(JSON.stringify(result));
  delete tampered.markdown;
  tampered.agent_bridge_execution_candidate_rows[0].execution_allowed_now = true;
  tampered.agent_bridge_execution_candidate_rows[0].command_executed_now = true;
  tampered.agent_bridge_execution_boundary.execution_allowed_now = true;
  tampered.summary.execution_allowed_now = true;

  const validation = validateAgentBridgeExecutionCandidateResult(tampered, schema);
  assert.equal(validation.validation.valid, false);
  assert.equal(validation.validation.errors.some((error) => error.path === "candidate.no_execution"), true);
});

test("Agent Bridge execution candidate --check validates without overwriting artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-agent-bridge-execution-candidate-"));
  const sentinelPath = path.join(outDir, "agent-bridge-execution-candidate.json");
  const sentinel = "{ \"sentinel\": \"agent-bridge-execution-candidate\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");
  try {
    const result = await runAgentBridgeExecutionCandidate({
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

test("Agent Bridge execution candidate CLI parser accepts only known flags", () => {
  assert.deepEqual(parseAgentBridgeExecutionCandidateArgs(["--check", "--schema-path", "schemas/example.json"]), {
    check: true,
    write: false,
    schemaPath: "schemas/example.json",
  });
  assert.throws(() => parseAgentBridgeExecutionCandidateArgs(["--execute"]), /Unknown argument: --execute/);
  assert.throws(() => parseAgentBridgeExecutionCandidateArgs(["--source-agent-bridge-request-receipt-path"]), /Missing value for --source-agent-bridge-request-receipt-path/);
});
