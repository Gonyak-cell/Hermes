import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPlatformKernelContractBaseline } from "../src/platform-kernel-contract-baseline.mjs";
import {
  buildPlatformKernelSpecStatusReconciliation,
  runPlatformKernelSpecStatusReconciliation,
} from "../src/platform-kernel-spec-status-reconciliation.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";
const sourceBaselinePromise = buildPlatformKernelContractBaseline({ runAt: RUN_AT, write: false });
const resultPromise = sourceBaselinePromise.then((sourceKernelContractBaseline) => buildPlatformKernelSpecStatusReconciliation({
  runAt: RUN_AT,
  write: false,
  sourceKernelContractBaseline,
}));

test("Kernel spec/status reconciliation consumes the Kernel contract baseline", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_kernel_spec_status_reconciliation_status, "ready_for_platform_kernel_spec_status_reconciliation");
  assert.equal(result.summary.source_kernel_baseline_status, "ready_for_platform_kernel_contract_baseline");
  assert.equal(result.kernel_spec_status_reconciliation_anchor.program_range, "P1501-P2040");
  assert.equal(result.kernel_spec_status_reconciliation_anchor.phase_range, "P1561-P1640");
});

test("Kernel spec/status reconciliation creates one status for every spec", async () => {
  const result = await resultPromise;
  const specIds = new Set(result.kernel_spec_rows.map((row) => `${row.spec_type}.${row.spec_id}`));
  const statusIds = new Set(result.kernel_status_rows.map((row) => `${row.spec_type}.${row.spec_id}`));

  assert.equal(result.kernel_spec_rows.length, 17);
  assert.equal(result.kernel_status_rows.length, 17);
  assert.deepEqual(statusIds, specIds);
  assert.equal(specIds.has("primitive.claim"), true);
  assert.equal(specIds.has("primitive.receipt"), true);
  assert.equal(specIds.has("contract.capability_registry_contract"), true);
  assert.equal(specIds.has("source.agent_operator_console_v0"), true);
  assert.equal(result.kernel_status_rows.every((row) => row.current_status === "observed"), true);
  assert.equal(result.kernel_status_rows.every((row) => row.drift_status === "none"), true);
});

test("Kernel spec/status reconciliation reconciles every observed row without execution", async () => {
  const result = await resultPromise;

  assert.equal(result.kernel_reconciliation_rows.length, 17);
  assert.equal(result.kernel_reconciliation_rows.every((row) => row.reconciliation_status === "reconciled"), true);
  assert.equal(result.kernel_reconciliation_rows.every((row) => row.mutation_required === false), true);
  assert.equal(result.kernel_reconciliation_rows.every((row) => row.execution_allowed_now === false), true);
});

test("Kernel spec/status reconciliation preserves drift, invariants, and protected blocks", async () => {
  const result = await resultPromise;
  const protectedIds = new Set(result.kernel_reconciliation_protected_block_rows.map((row) => row.protected_block_id));

  assert.equal(result.kernel_drift_rows.length, 10);
  assert.equal(result.kernel_drift_rows.every((row) => row.drift_detected === false && row.mutation_required === false), true);
  assert.equal(result.kernel_invariant_rows.length, 8);
  assert.equal(result.kernel_invariant_rows.every((row) => row.invariant_status === "safe" && row.unsafe_value_observed === false), true);
  assert.equal(result.kernel_reconciliation_protected_block_rows.length, 20);
  assert.equal(protectedIds.has("project.zendd.direct_write"), true);
  assert.equal(protectedIds.has("platform.agent_final_pass"), true);
  assert.equal(result.kernel_reconciliation_protected_block_rows.every((row) => row.current_verdict === "blocked" && row.action_allowed_now === false), true);
});

test("Kernel spec/status reconciliation declares read-only API projection and closes claims", async () => {
  const result = await resultPromise;
  const routes = new Set(result.kernel_api_projection_rows.map((row) => row.route_path));
  const boundary = result.kernel_reconciliation_boundary;

  assert.equal(result.kernel_api_projection_rows.length, 4);
  assert.equal(routes.has("/api/kernel-specs"), true);
  assert.equal(routes.has("/api/kernel-statuses"), true);
  assert.equal(routes.has("/api/kernel-reconciliations"), true);
  assert.equal(routes.has("/api/kernel-invariants"), true);
  assert.equal(result.kernel_api_projection_rows.every((row) => row.method === "GET" && row.server_started === false), true);
  assert.equal(result.kernel_reconciliation_freeze_rows.length, 8);
  assert.equal(result.kernel_reconciliation_gate_rows.length, 13);
  assert.equal(result.kernel_reconciliation_gate_rows.every((row) => row.gate_status === "ready"), true);
  assert.equal(result.kernel_reconciliation_claim_rows.length, 101);
  assert.equal(result.summary.pass_claim_count, 81);
  assert.equal(result.summary.blocked_claim_count, 20);
  assert.equal(boundary.kernel_spec_status_reconciliation_ready_for_engine_extraction, true);
  assert.equal(boundary.read_only_reconciliation, true);
  assert.equal(boundary.agent_runtime_execution_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.protected_action_execution_allowed_now, false);
  assert.equal(boundary.receipt_application_allowed_now, false);
  assert.equal(boundary.agent_final_pass_allowed_now, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Kernel spec/status reconciliation --check does not overwrite existing artifacts", async () => {
  const sourceKernelContractBaseline = await sourceBaselinePromise;
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-kernel-spec-status-reconciliation-"));
  const sentinelPath = path.join(outDir, "platform-kernel-spec-status-reconciliation.json");
  const sentinel = "{ \"sentinel\": \"platform-kernel-spec-status-reconciliation\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformKernelSpecStatusReconciliation({
      runAt: RUN_AT,
      outDir,
      check: true,
      write: false,
      sourceKernelContractBaseline,
    });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
