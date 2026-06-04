import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformRuntimeGovernanceRestore,
  runPlatformRuntimeGovernanceRestore,
} from "../src/platform-runtime-governance-restore.mjs";

const RUN_AT = "2026-06-04T00:00:00.000Z";
const resultPromise = buildPlatformRuntimeGovernanceRestore({ runAt: RUN_AT, write: false });

test("Runtime governance restore consumes the Nous non-adoption reversal", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_runtime_governance_restore_status, "ready_for_platform_runtime_governance_restore");
  assert.equal(result.summary.source_reversal_status, "ready_for_platform_nous_non_adoption_reversal");
  assert.equal(result.summary.nous_adopted, false);
  assert.equal(result.runtime_governance_restore_anchor.program_range, "P2121-P2240");
  assert.equal(result.runtime_governance_restore_anchor.previous_phase_slot, "P2120");
  assert.equal(result.runtime_governance_restore_anchor.next_phase_slot, "P2241");
});

test("Runtime governance restore emits restored API, MCP, tool, job, doctor, and hook contracts", async () => {
  const result = await resultPromise;

  assert.equal(result.runtime_governance_component_rows.length, 7);
  assert.equal(result.runtime_api_contract_rows.length, 7);
  assert.equal(result.mcp_registry_rows.length, 4);
  assert.equal(result.tool_gateway_policy_rows.length, 7);
  assert.equal(result.job_scheduler_ledger_rows.length, 5);
  assert.equal(result.doctor_health_evidence_rows.length, 6);
  assert.equal(result.hard_hook_scaffold_rows.length, 8);
  assert.equal(result.runtime_governance_handoff_rows.length, 3);
});

test("Runtime governance restore keeps all restored runtime surfaces non-executing", async () => {
  const result = await resultPromise;

  assert.equal(result.runtime_api_contract_rows.every((row) => row.method === "GET" && row.server_started === false), true);
  assert.equal(result.mcp_registry_rows.every((row) => row.connection_opened_now === false && row.tool_call_allowed_now === false), true);
  assert.equal(result.tool_gateway_policy_rows.every((row) => row.tool_execution_allowed_now === false && row.write_action_allowed_now === false), true);
  assert.equal(result.job_scheduler_ledger_rows.every((row) => row.scheduled_now === false && row.job_run_allowed_now === false), true);
  assert.equal(result.hard_hook_scaffold_rows.every((row) => row.enforcement_enabled_now === false), true);
});

test("Runtime governance restore prepares P2241 handoff without unsafe authority", async () => {
  const result = await resultPromise;
  const boundary = result.runtime_governance_boundary;

  assert.equal(boundary.p2241_ready_as_next_goal, true);
  assert.equal(boundary.server_started, false);
  assert.equal(boundary.mcp_connection_opened, false);
  assert.equal(boundary.tool_execution_performed, false);
  assert.equal(boundary.job_scheduled_or_run, false);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.protected_action_execution_allowed_now, false);
  assert.equal(boundary.receipt_application_allowed_now, false);
  assert.equal(boundary.agent_final_pass_allowed_now, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Runtime governance restore --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-runtime-governance-restore-"));
  const sentinelPath = path.join(outDir, "platform-runtime-governance-restore.json");
  const sentinel = "{ \"sentinel\": \"platform-runtime-governance-restore\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformRuntimeGovernanceRestore({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
