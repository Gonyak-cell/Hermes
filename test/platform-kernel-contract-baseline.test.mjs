import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPlatformAgentOperatorConsoleV0 } from "../src/platform-agent-operator-console-v0.mjs";
import {
  buildPlatformKernelContractBaseline,
  runPlatformKernelContractBaseline,
} from "../src/platform-kernel-contract-baseline.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";
const sourceConsolePromise = buildPlatformAgentOperatorConsoleV0({ runAt: RUN_AT, write: false });
const resultPromise = sourceConsolePromise.then((sourceAgentOperatorConsoleV0) => buildPlatformKernelContractBaseline({
  runAt: RUN_AT,
  write: false,
  sourceAgentOperatorConsoleV0,
}));

test("Platform Kernel contract baseline consumes Agent operator console v0", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_kernel_contract_baseline_status, "ready_for_platform_kernel_contract_baseline");
  assert.equal(result.summary.source_console_status, "ready_for_agent_operator_console_v0_freeze");
  assert.equal(result.kernel_contract_baseline_anchor.program_range, "P1501-P2040");
  assert.equal(result.kernel_contract_baseline_anchor.phase_range, "P1501-P1560");
});

test("Platform Kernel contract baseline declares common primitives and source bindings", async () => {
  const result = await resultPromise;
  const primitives = new Set(result.kernel_primitive_rows.map((row) => row.primitive_id));
  const sources = new Set(result.kernel_source_binding_rows.map((row) => row.source_id));

  for (const primitive of ["claim", "evidence", "gate", "artifact", "check", "receipt"]) {
    assert.equal(primitives.has(primitive), true, `${primitive} primitive should exist`);
  }
  assert.equal(result.kernel_primitive_rows.length, 6);
  assert.equal(result.kernel_source_binding_rows.length, 3);
  assert.equal(sources.has("agent_runtime_activation_bridge"), true);
  assert.equal(sources.has("domain_agent_no_write_pilot"), true);
  assert.equal(sources.has("agent_operator_console_v0"), true);
});

test("Platform Kernel contract baseline maps console collections to contracts", async () => {
  const result = await resultPromise;
  const contracts = new Set(result.kernel_contract_rows.map((row) => row.contract_id));

  assert.equal(result.kernel_contract_rows.length, 8);
  assert.equal(contracts.has("capability_registry_contract"), true);
  assert.equal(contracts.has("protected_block_contract"), true);
  assert.equal(contracts.has("receipt_visibility_contract"), true);
  assert.equal(contracts.has("boundary_invariant_contract"), true);
  assert.equal(result.kernel_contract_rows.every((row) => row.deterministic_projection === true), true);
  assert.equal(result.kernel_contract_rows.every((row) => row.primitive_refs.length > 0), true);
});

test("Platform Kernel contract baseline preserves protected block projections", async () => {
  const result = await resultPromise;
  const blockIds = new Set(result.kernel_block_projection_rows.map((row) => row.protected_block_id));

  assert.equal(result.kernel_block_projection_rows.length, 20);
  assert.equal(blockIds.has("project.zendd.direct_write"), true);
  assert.equal(blockIds.has("platform.agent_final_pass"), true);
  assert.equal(result.kernel_block_projection_rows.every((row) => row.current_verdict === "blocked"), true);
  assert.equal(result.kernel_block_projection_rows.every((row) => row.action_allowed_now === false), true);
});

test("Platform Kernel contract baseline closes checks, gates, claims, and boundary", async () => {
  const result = await resultPromise;
  const boundary = result.kernel_boundary;

  assert.equal(result.kernel_check_rows.length, 10);
  assert.equal(result.kernel_cutover_rows.length, 7);
  assert.equal(result.kernel_gate_rows.length, 13);
  assert.equal(result.kernel_gate_rows.every((row) => row.gate_status === "ready"), true);
  assert.equal(result.kernel_claim_rows.length, 54);
  assert.equal(result.summary.pass_claim_count, 34);
  assert.equal(result.summary.blocked_claim_count, 20);
  assert.equal(boundary.kernel_contract_baseline_ready_for_reconciliation, true);
  assert.equal(boundary.read_only_kernel_baseline, true);
  assert.equal(boundary.agent_runtime_execution_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.protected_action_execution_allowed_now, false);
  assert.equal(boundary.receipt_application_allowed_now, false);
  assert.equal(boundary.agent_final_pass_allowed_now, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Platform Kernel contract baseline --check does not overwrite existing artifacts", async () => {
  const sourceAgentOperatorConsoleV0 = await sourceConsolePromise;
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-kernel-contract-baseline-"));
  const sentinelPath = path.join(outDir, "platform-kernel-contract-baseline.json");
  const sentinel = "{ \"sentinel\": \"platform-kernel-contract-baseline\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformKernelContractBaseline({
      runAt: RUN_AT,
      outDir,
      check: true,
      write: false,
      sourceAgentOperatorConsoleV0,
    });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
