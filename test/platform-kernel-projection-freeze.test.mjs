import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformKernelProjectionFreeze,
  runPlatformKernelProjectionFreeze,
} from "../src/platform-kernel-projection-freeze.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";
const resultPromise = buildPlatformKernelProjectionFreeze({ runAt: RUN_AT, write: false });

test("Kernel projection freeze consumes artifact/check/receipt engine", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_kernel_projection_freeze_status, "ready_for_platform_kernel_projection_freeze");
  assert.equal(result.summary.source_artifact_check_receipt_status, "ready_for_platform_kernel_artifact_check_receipt_engine");
  assert.equal(result.source_kernel_artifact_check_receipt_engine_summary.claim_count, 160);
  assert.equal(result.kernel_projection_freeze_anchor.program_range, "P1501-P2040");
  assert.equal(result.kernel_projection_freeze_anchor.phase_range, "P1801-P1880");
});

test("Kernel projection freeze declares manifest, source collections, and routes", async () => {
  const result = await resultPromise;
  const sourceCollections = new Set(result.kernel_projection_source_rows.map((row) => row.source_collection_id));
  const routePaths = new Set(result.kernel_projection_api_route_rows.map((row) => row.route_path));

  assert.equal(result.kernel_projection_manifest.projection_only, true);
  assert.equal(result.kernel_projection_component_rows.length, 6);
  assert.equal(result.kernel_projection_source_rows.length, 10);
  assert.equal(sourceCollections.has("artifacts"), true);
  assert.equal(sourceCollections.has("checks"), true);
  assert.equal(sourceCollections.has("receipts"), true);
  assert.equal(sourceCollections.has("claims"), true);
  assert.equal(result.kernel_projection_api_route_rows.length, 6);
  assert.equal(routePaths.has("/api/kernel-projection/manifest"), true);
  assert.equal(routePaths.has("/api/kernel-projection/freeze"), true);
  assert.equal(result.kernel_projection_api_route_rows.every((row) => row.method === "GET"), true);
  assert.equal(result.kernel_projection_api_route_rows.every((row) => row.server_started === false), true);
});

test("Kernel projection freeze exposes operator and compatibility rows", async () => {
  const result = await resultPromise;
  const operatorIds = new Set(result.kernel_projection_operator_rows.map((row) => row.operator_projection_id));
  const compatibilityIds = new Set(result.kernel_projection_compatibility_rows.map((row) => row.program_id));

  assert.equal(result.kernel_projection_operator_rows.length, 8);
  assert.equal(operatorIds.has("protected_block_matrix"), true);
  assert.equal(operatorIds.has("receipt_state_matrix"), true);
  assert.equal(result.kernel_projection_operator_rows.every((row) => row.action_button_enabled === false), true);
  assert.equal(result.kernel_projection_operator_rows.every((row) => row.receipt_payload_visible === false), true);
  assert.equal(result.kernel_projection_compatibility_rows.length, 5);
  assert.equal(compatibilityIds.has("agent_operator_console_v0"), true);
  assert.equal(compatibilityIds.has("kernel_artifact_check_receipt_engine"), true);
  assert.equal(result.kernel_projection_compatibility_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Kernel projection freeze preserves claims, gates, and protected blocks", async () => {
  const result = await resultPromise;

  assert.equal(result.kernel_projection_freeze_rows.length, 8);
  assert.equal(result.kernel_projection_gate_rows.length, 12);
  assert.equal(result.kernel_projection_claim_rows.length, 63);
  assert.equal(result.summary.pass_claim_count, 43);
  assert.equal(result.summary.blocked_claim_count, 20);
  assert.equal(result.kernel_projection_claim_rows.every((row) => row.evidence_ref), true);
  assert.equal(result.kernel_projection_claim_rows.every((row) => row.reviewer_ref), true);
  assert.equal(result.kernel_projection_claim_rows.every((row) => row.hard_gate_ref), true);
  assert.equal(result.kernel_projection_claim_rows.every((row) => row.verdict_authority === "harness_only"), true);
});

test("Kernel projection freeze keeps unsafe boundaries false", async () => {
  const result = await resultPromise;
  const boundary = result.kernel_projection_boundary;

  assert.equal(boundary.kernel_projection_freeze_ready_for_harness_native_cutover, true);
  assert.equal(boundary.read_only_projection, true);
  assert.equal(boundary.server_started, false);
  assert.equal(boundary.mutation_performed, false);
  assert.equal(boundary.raw_material_exposed, false);
  assert.equal(boundary.receipt_payload_present, false);
  assert.equal(boundary.receipt_applied, false);
  assert.equal(boundary.agent_runtime_execution_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.protected_action_execution_allowed_now, false);
  assert.equal(boundary.agent_final_pass_allowed_now, false);
  assert.equal(result.summary.unsafe_flag_count, 0);
});

test("Kernel projection freeze --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-kernel-projection-freeze-"));
  const sentinelPath = path.join(outDir, "platform-kernel-projection-freeze.json");
  const sentinel = "{ \"sentinel\": \"platform-kernel-projection-freeze\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformKernelProjectionFreeze({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
