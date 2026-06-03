import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPlatformKernelClaimEvidenceGateEngine } from "../src/platform-kernel-claim-evidence-gate-engine.mjs";
import {
  buildPlatformKernelArtifactCheckReceiptEngine,
  runPlatformKernelArtifactCheckReceiptEngine,
} from "../src/platform-kernel-artifact-check-receipt-engine.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";
const sourceClaimEnginePromise = buildPlatformKernelClaimEvidenceGateEngine({ runAt: RUN_AT, write: false });
const resultPromise = sourceClaimEnginePromise.then((sourceKernelClaimEvidenceGateEngine) => buildPlatformKernelArtifactCheckReceiptEngine({
  runAt: RUN_AT,
  write: false,
  sourceKernelClaimEvidenceGateEngine,
}));

test("Kernel artifact/check/receipt engine consumes the claim/evidence/gate engine", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_kernel_artifact_check_receipt_engine_status, "ready_for_platform_kernel_artifact_check_receipt_engine");
  assert.equal(result.summary.source_claim_engine_status, "ready_for_platform_kernel_claim_evidence_gate_engine");
  assert.equal(result.kernel_artifact_check_receipt_engine_anchor.program_range, "P1501-P2040");
  assert.equal(result.kernel_artifact_check_receipt_engine_anchor.phase_range, "P1721-P1800");
});

test("Kernel artifact/check/receipt engine declares components and artifact rows", async () => {
  const result = await resultPromise;
  const componentIds = new Set(result.kernel_artifact_check_receipt_component_rows.map((row) => row.component_id));

  assert.equal(result.kernel_artifact_check_receipt_component_rows.length, 6);
  assert.equal(componentIds.has("artifact_registry_engine"), true);
  assert.equal(componentIds.has("check_registry_engine"), true);
  assert.equal(componentIds.has("receipt_state_engine"), true);
  assert.equal(result.kernel_artifact_rows.length, 18);
  assert.equal(result.kernel_artifact_rows.every((row) => row.artifact_status === "projected"), true);
  assert.equal(result.kernel_artifact_rows.every((row) => row.write_performed === false), true);
  assert.equal(result.kernel_artifact_rows.every((row) => row.raw_material_exposed === false), true);
});

test("Kernel artifact/check/receipt engine declares check and receipt state rows", async () => {
  const result = await resultPromise;

  assert.equal(result.kernel_check_rows.length, 23);
  assert.equal(result.kernel_check_rows.every((row) => row.check_status === "pass"), true);
  assert.equal(result.kernel_check_rows.every((row) => row.execution_allowed_now === false && row.mutation_required === false), true);
  assert.equal(result.kernel_receipt_rows.length, 20);
  assert.equal(result.kernel_receipt_rows.every((row) => row.receipt_status === "missing"), true);
  assert.equal(result.kernel_receipt_rows.every((row) => row.receipt_payload_present === false && row.receipt_applied === false), true);
  assert.equal(result.kernel_receipt_rows.every((row) => row.action_allowed_now === false), true);
});

test("Kernel artifact/check/receipt engine evaluates rows and preserves protected blocks", async () => {
  const result = await resultPromise;
  const protectedIds = new Set(result.kernel_artifact_check_receipt_protected_block_rows.map((row) => row.protected_block_id));

  assert.equal(result.kernel_artifact_check_receipt_evaluation_rows.length, 61);
  assert.equal(result.kernel_artifact_check_receipt_evaluation_rows.every((row) => row.evaluation_passed === true), true);
  assert.equal(result.kernel_artifact_check_receipt_evaluation_rows.every((row) => row.execution_allowed_now === false && row.mutation_required === false), true);
  assert.equal(result.kernel_artifact_check_receipt_protected_block_rows.length, 20);
  assert.equal(protectedIds.has("project.zendd.direct_write"), true);
  assert.equal(protectedIds.has("platform.agent_final_pass"), true);
  assert.equal(result.kernel_artifact_check_receipt_protected_block_rows.every((row) => row.current_verdict === "blocked" && row.action_allowed_now === false), true);
});

test("Kernel artifact/check/receipt engine closes API projection, claims, and boundary", async () => {
  const result = await resultPromise;
  const routes = new Set(result.kernel_artifact_check_receipt_api_projection_rows.map((row) => row.route_path));
  const boundary = result.kernel_artifact_check_receipt_boundary;

  assert.equal(result.kernel_artifact_check_receipt_api_projection_rows.length, 4);
  assert.equal(routes.has("/api/kernel-artifact-engine/artifacts"), true);
  assert.equal(routes.has("/api/kernel-artifact-engine/checks"), true);
  assert.equal(routes.has("/api/kernel-artifact-engine/receipts"), true);
  assert.equal(routes.has("/api/kernel-artifact-engine/evaluations"), true);
  assert.equal(result.kernel_artifact_check_receipt_api_projection_rows.every((row) => row.method === "GET" && row.server_started === false), true);
  assert.equal(result.kernel_artifact_check_receipt_freeze_rows.length, 8);
  assert.equal(result.kernel_artifact_check_receipt_gate_rows.length, 13);
  assert.equal(result.kernel_artifact_check_receipt_gate_rows.every((row) => row.gate_status === "ready"), true);
  assert.equal(result.kernel_artifact_check_receipt_claim_rows.length, 160);
  assert.equal(result.summary.pass_claim_count, 140);
  assert.equal(result.summary.blocked_claim_count, 20);
  assert.equal(boundary.kernel_artifact_check_receipt_engine_ready_for_projection_freeze, true);
  assert.equal(boundary.read_only_engine, true);
  assert.equal(boundary.raw_material_exposed, false);
  assert.equal(boundary.receipt_payload_present, false);
  assert.equal(boundary.receipt_applied, false);
  assert.equal(boundary.agent_runtime_execution_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.protected_action_execution_allowed_now, false);
  assert.equal(boundary.receipt_application_allowed_now, false);
  assert.equal(boundary.agent_final_pass_allowed_now, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Kernel artifact/check/receipt engine --check does not overwrite existing artifacts", async () => {
  const sourceKernelClaimEvidenceGateEngine = await sourceClaimEnginePromise;
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-kernel-artifact-check-receipt-engine-"));
  const sentinelPath = path.join(outDir, "platform-kernel-artifact-check-receipt-engine.json");
  const sentinel = "{ \"sentinel\": \"platform-kernel-artifact-check-receipt-engine\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformKernelArtifactCheckReceiptEngine({
      runAt: RUN_AT,
      outDir,
      check: true,
      write: false,
      sourceKernelClaimEvidenceGateEngine,
    });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
