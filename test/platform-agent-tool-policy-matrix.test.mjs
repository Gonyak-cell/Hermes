import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformAgentToolPolicyMatrix,
  runPlatformAgentToolPolicyMatrix,
} from "../src/platform-agent-tool-policy-matrix.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";

test("platform agent tool policy matrix consumes doctor bridge and capability registry", async () => {
  const result = await buildPlatformAgentToolPolicyMatrix({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_agent_tool_policy_matrix_status, "ready_for_agent_tool_policy_matrix");
  assert.equal(result.summary.source_doctor_bridge_status, "ready_for_agent_doctor_evidence_bridge");
  assert.equal(result.summary.source_capability_registry_status, "ready_for_agent_capability_registry");
  assert.equal(result.agent_tool_policy_gate_rows.every((row) => row.gate_status === "ready"), true);
});

test("platform agent tool policy matrix maps eight tool classes across seven domains", async () => {
  const result = await buildPlatformAgentToolPolicyMatrix({ runAt: RUN_AT, write: false });
  const domains = new Set(result.agent_tool_policy_matrix_rows.map((row) => row.domain_id));
  const toolClasses = new Set(result.agent_tool_policy_matrix_rows.map((row) => row.tool_class_id));

  assert.equal(domains.size, 7);
  assert.equal(toolClasses.size, 8);
  assert.equal(result.agent_tool_policy_matrix_rows.length, 56);
  assert.equal(result.agent_tool_policy_matrix_rows.filter((row) => row.current_verdict === "pass").length, 14);
  assert.equal(result.agent_tool_policy_matrix_rows.filter((row) => row.current_verdict === "blocked").length, 42);
  assert.equal(result.agent_tool_policy_matrix_rows.every((row) => row.execution_allowed_now === false), true);
});

test("platform agent tool policy matrix blocks unsafe execution classes", async () => {
  const result = await buildPlatformAgentToolPolicyMatrix({ runAt: RUN_AT, write: false });
  const blockedClasses = new Set(result.agent_tool_policy_matrix_rows.filter((row) => row.current_verdict === "blocked").map((row) => row.tool_class_id));

  assert.equal(blockedClasses.has("terminal_execution"), true);
  assert.equal(blockedClasses.has("mcp_connection"), true);
  assert.equal(blockedClasses.has("file_write"), true);
  assert.equal(blockedClasses.has("package_install"), true);
  assert.equal(blockedClasses.has("raw_material_access"), true);
  assert.equal(blockedClasses.has("domain_mutation"), true);
  assert.equal(result.agent_tool_policy_unsafe_block_rows.length, 8);
  assert.equal(result.agent_tool_policy_unsafe_block_rows.every((row) => row.current_verdict === "blocked" && row.block_reason), true);
});

test("platform agent tool policy matrix emits sandbox profiles and supported claims", async () => {
  const result = await buildPlatformAgentToolPolicyMatrix({ runAt: RUN_AT, write: false });

  assert.equal(result.agent_tool_policy_sandbox_rows.length, 7);
  assert.equal(result.agent_tool_policy_sandbox_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.agent_tool_policy_sandbox_rows.every((row) => row.terminal_execution_allowed_now === false && row.raw_material_access_allowed_now === false), true);
  assert.equal(result.agent_tool_policy_claim_rows.length, 71);
  assert.equal(result.agent_tool_policy_claim_rows.filter((row) => row.current_verdict === "pass").length, 21);
  assert.equal(result.agent_tool_policy_claim_rows.filter((row) => row.current_verdict === "blocked").length, 50);
  assert.equal(result.agent_tool_policy_claim_rows.every((row) => row.verdict_authority === "harness_only"), true);
  assert.equal(result.agent_tool_policy_boundary.agent_final_pass_allowed_now, false);
});

test("platform agent tool policy matrix --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-agent-tool-policy-matrix-"));
  const sentinelPath = path.join(outDir, "platform-agent-tool-policy-matrix.json");
  const sentinel = "{ \"sentinel\": \"platform-agent-tool-policy-matrix\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformAgentToolPolicyMatrix({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
