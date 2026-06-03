import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformHarnessNativeCutoverAdapter,
  runPlatformHarnessNativeCutoverAdapter,
} from "../src/platform-harness-native-cutover-adapter.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";
const resultPromise = buildPlatformHarnessNativeCutoverAdapter({ runAt: RUN_AT, write: false });

test("Harness-native cutover adapter consumes Kernel projection freeze", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_harness_native_cutover_adapter_status, "ready_for_platform_harness_native_cutover_adapter");
  assert.equal(result.summary.source_projection_freeze_status, "ready_for_platform_kernel_projection_freeze");
  assert.equal(result.source_kernel_projection_freeze_summary.claim_count, 63);
  assert.equal(result.harness_native_cutover_anchor.program_range, "P1501-P2040");
  assert.equal(result.harness_native_cutover_anchor.phase_range, "P1881-P1960");
});

test("Harness-native cutover adapter declares lanes and adapters", async () => {
  const result = await resultPromise;
  const laneIds = new Set(result.harness_native_lane_rows.map((row) => row.lane_id));

  assert.equal(result.harness_native_component_rows.length, 6);
  assert.equal(result.harness_native_lane_rows.length, 8);
  assert.equal(laneIds.has("phase_definition_lane"), true);
  assert.equal(laneIds.has("receipt_visibility_lane"), true);
  assert.equal(laneIds.has("operator_console_lane"), true);
  assert.equal(result.harness_native_lane_rows.every((row) => row.execution_allowed_now === false), true);
  assert.equal(result.harness_native_lane_rows.every((row) => row.write_allowed_now === false), true);
  assert.equal(result.harness_native_adapter_rows.length, 8);
  assert.equal(result.harness_native_adapter_rows.every((row) => row.direct_tool_execution_allowed_now === false), true);
  assert.equal(result.harness_native_adapter_rows.every((row) => row.mutation_allowed_now === false), true);
});

test("Harness-native cutover adapter maps all domain packs", async () => {
  const result = await resultPromise;
  const domainIds = new Set(result.harness_native_domain_cutover_rows.map((row) => row.domain_id));

  assert.equal(result.harness_native_domain_cutover_rows.length, 7);
  assert.equal(domainIds.has("platform"), true);
  assert.equal(domainIds.has("personal-dev"), true);
  assert.equal(domainIds.has("law-firm"), true);
  assert.equal(domainIds.has("creative-document"), true);
  assert.equal(domainIds.has("connectors-resource"), true);
  assert.equal(domainIds.has("trading"), true);
  assert.equal(domainIds.has("project.zendd"), true);
  assert.equal(result.harness_native_domain_cutover_rows.every((row) => row.protected_action_allowed_now === false), true);
  assert.equal(result.harness_native_domain_cutover_rows.every((row) => row.raw_material_access_allowed_now === false), true);
});

test("Harness-native cutover adapter freezes API routes, guards, and claims", async () => {
  const result = await resultPromise;
  const guardIds = new Set(result.harness_native_guard_rows.map((row) => row.guard_id));

  assert.equal(result.harness_native_api_route_rows.length, 6);
  assert.equal(result.harness_native_api_route_rows.every((row) => row.method === "GET"), true);
  assert.equal(result.harness_native_api_route_rows.every((row) => row.server_started === false), true);
  assert.equal(result.harness_native_guard_rows.length, 10);
  assert.equal(guardIds.has("runtime_execution"), true);
  assert.equal(guardIds.has("write_action"), true);
  assert.equal(guardIds.has("agent_final_pass"), true);
  assert.equal(result.harness_native_guard_rows.every((row) => row.action_allowed_now === false), true);
  assert.equal(result.harness_native_freeze_rows.length, 8);
  assert.equal(result.harness_native_gate_rows.length, 12);
  assert.equal(result.harness_native_claim_rows.length, 73);
  assert.equal(result.summary.pass_claim_count, 53);
  assert.equal(result.summary.blocked_claim_count, 20);
});

test("Harness-native cutover adapter keeps unsafe boundaries false", async () => {
  const result = await resultPromise;
  const boundary = result.harness_native_boundary;

  assert.equal(boundary.harness_native_cutover_adapter_ready_for_kernel_freeze, true);
  assert.equal(boundary.harness_native_cutover_only, true);
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

test("Harness-native cutover adapter --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-harness-native-cutover-adapter-"));
  const sentinelPath = path.join(outDir, "platform-harness-native-cutover-adapter.json");
  const sentinel = "{ \"sentinel\": \"platform-harness-native-cutover-adapter\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformHarnessNativeCutoverAdapter({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
