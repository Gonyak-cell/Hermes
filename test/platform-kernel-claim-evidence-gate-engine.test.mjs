import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPlatformKernelSpecStatusReconciliation } from "../src/platform-kernel-spec-status-reconciliation.mjs";
import {
  buildPlatformKernelClaimEvidenceGateEngine,
  runPlatformKernelClaimEvidenceGateEngine,
} from "../src/platform-kernel-claim-evidence-gate-engine.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";
const sourceReconciliationPromise = buildPlatformKernelSpecStatusReconciliation({ runAt: RUN_AT, write: false });
const resultPromise = sourceReconciliationPromise.then((sourceKernelSpecStatusReconciliation) => buildPlatformKernelClaimEvidenceGateEngine({
  runAt: RUN_AT,
  write: false,
  sourceKernelSpecStatusReconciliation,
}));

test("Kernel claim/evidence/gate engine consumes spec/status reconciliation", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_kernel_claim_evidence_gate_engine_status, "ready_for_platform_kernel_claim_evidence_gate_engine");
  assert.equal(result.summary.source_reconciliation_status, "ready_for_platform_kernel_spec_status_reconciliation");
  assert.equal(result.kernel_claim_evidence_gate_engine_anchor.program_range, "P1501-P2040");
  assert.equal(result.kernel_claim_evidence_gate_engine_anchor.phase_range, "P1641-P1720");
});

test("Kernel claim/evidence/gate engine declares components and fail-closed rules", async () => {
  const result = await resultPromise;
  const componentIds = new Set(result.kernel_engine_component_rows.map((row) => row.component_id));
  const ruleIds = new Set(result.kernel_engine_verdict_rule_rows.map((row) => row.rule_id));

  assert.equal(result.kernel_engine_component_rows.length, 6);
  assert.equal(componentIds.has("claim_engine"), true);
  assert.equal(componentIds.has("evidence_engine"), true);
  assert.equal(componentIds.has("gate_engine"), true);
  assert.equal(result.kernel_engine_verdict_rule_rows.length, 9);
  assert.equal(ruleIds.has("pass_requires_evidence"), true);
  assert.equal(ruleIds.has("blocked_requires_reason"), true);
  assert.equal(ruleIds.has("protected_blocks_preserved"), true);
  assert.equal(result.kernel_engine_verdict_rule_rows.every((row) => row.fail_closed === true), true);
});

test("Kernel claim/evidence/gate engine binds every claim to evidence and gate refs", async () => {
  const result = await resultPromise;

  assert.equal(result.kernel_engine_claim_input_rows.length, 101);
  assert.equal(result.kernel_engine_claim_input_rows.every((row) => row.claim_support_status === "supported"), true);
  assert.equal(result.kernel_engine_evidence_binding_rows.length, 101);
  assert.equal(result.kernel_engine_evidence_binding_rows.every((row) => row.evidence_binding_status === "bound"), true);
  assert.equal(result.kernel_engine_evidence_binding_rows.every((row) => row.raw_material_exposed === false), true);
  assert.equal(result.kernel_engine_gate_binding_rows.length, 101);
  assert.equal(result.kernel_engine_gate_binding_rows.every((row) => row.gate_binding_status === "bound"), true);
});

test("Kernel claim/evidence/gate engine evaluates claims and preserves protected blocks", async () => {
  const result = await resultPromise;
  const protectedIds = new Set(result.kernel_engine_protected_block_rows.map((row) => row.protected_block_id));

  assert.equal(result.kernel_engine_evaluation_rows.length, 101);
  assert.equal(result.kernel_engine_evaluation_rows.every((row) => row.evaluation_passed === true), true);
  assert.equal(result.kernel_engine_evaluation_rows.every((row) => row.execution_allowed_now === false && row.mutation_required === false), true);
  assert.equal(result.kernel_engine_protected_block_rows.length, 20);
  assert.equal(protectedIds.has("project.zendd.direct_write"), true);
  assert.equal(protectedIds.has("platform.agent_final_pass"), true);
  assert.equal(result.kernel_engine_protected_block_rows.every((row) => row.current_verdict === "blocked" && row.action_allowed_now === false), true);
});

test("Kernel claim/evidence/gate engine closes API projection, claims, and boundary", async () => {
  const result = await resultPromise;
  const routes = new Set(result.kernel_engine_api_projection_rows.map((row) => row.route_path));
  const boundary = result.kernel_engine_boundary;

  assert.equal(result.kernel_engine_api_projection_rows.length, 4);
  assert.equal(routes.has("/api/kernel-claim-engine/claims"), true);
  assert.equal(routes.has("/api/kernel-claim-engine/evidence"), true);
  assert.equal(routes.has("/api/kernel-claim-engine/gates"), true);
  assert.equal(routes.has("/api/kernel-claim-engine/evaluations"), true);
  assert.equal(result.kernel_engine_api_projection_rows.every((row) => row.method === "GET" && row.server_started === false), true);
  assert.equal(result.kernel_engine_freeze_rows.length, 8);
  assert.equal(result.kernel_engine_gate_rows.length, 14);
  assert.equal(result.kernel_engine_gate_rows.every((row) => row.gate_status === "ready"), true);
  assert.equal(result.kernel_engine_claim_rows.length, 350);
  assert.equal(result.summary.pass_claim_count, 330);
  assert.equal(result.summary.blocked_claim_count, 20);
  assert.equal(boundary.kernel_claim_evidence_gate_engine_ready_for_artifact_check_receipt, true);
  assert.equal(boundary.read_only_engine, true);
  assert.equal(boundary.raw_material_exposed, false);
  assert.equal(boundary.agent_runtime_execution_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.protected_action_execution_allowed_now, false);
  assert.equal(boundary.receipt_application_allowed_now, false);
  assert.equal(boundary.agent_final_pass_allowed_now, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Kernel claim/evidence/gate engine --check does not overwrite existing artifacts", async () => {
  const sourceKernelSpecStatusReconciliation = await sourceReconciliationPromise;
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-kernel-claim-evidence-gate-engine-"));
  const sentinelPath = path.join(outDir, "platform-kernel-claim-evidence-gate-engine.json");
  const sentinel = "{ \"sentinel\": \"platform-kernel-claim-evidence-gate-engine\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformKernelClaimEvidenceGateEngine({
      runAt: RUN_AT,
      outDir,
      check: true,
      write: false,
      sourceKernelSpecStatusReconciliation,
    });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
