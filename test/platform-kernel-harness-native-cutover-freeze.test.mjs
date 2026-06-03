import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformKernelHarnessNativeCutoverFreeze,
  runPlatformKernelHarnessNativeCutoverFreeze,
} from "../src/platform-kernel-harness-native-cutover-freeze.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";
const resultPromise = buildPlatformKernelHarnessNativeCutoverFreeze({ runAt: RUN_AT, write: false });

test("Kernel Harness-native cutover freeze consumes Harness-native cutover adapter", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_kernel_harness_native_cutover_freeze_status, "ready_for_platform_kernel_harness_native_cutover_freeze");
  assert.equal(result.summary.source_harness_native_cutover_status, "ready_for_platform_harness_native_cutover_adapter");
  assert.equal(result.source_harness_native_cutover_adapter_summary.claim_count, 73);
  assert.equal(result.kernel_harness_native_cutover_freeze_anchor.program_range, "P1501-P2040");
  assert.equal(result.kernel_harness_native_cutover_freeze_anchor.phase_range, "P1961-P2040");
});

test("Kernel Harness-native cutover freeze emits manifest and assertions", async () => {
  const result = await resultPromise;
  const assertionIds = new Set(result.kernel_cutover_assertion_rows.map((row) => row.assertion_id));

  assert.equal(result.kernel_cutover_manifest.platform_kernel_program_complete, true);
  assert.equal(result.kernel_cutover_component_rows.length, 6);
  assert.equal(result.kernel_cutover_assertion_rows.length, 10);
  assert.equal(assertionIds.has("kernel_primitives_commonized"), true);
  assert.equal(assertionIds.has("p2041_suspended_pending_nous_overlap_audit"), true);
  assert.equal(result.kernel_cutover_assertion_rows.every((row) => row.assertion_status === "frozen"), true);
});

test("Kernel Harness-native cutover freeze fixes domain rollout levels", async () => {
  const result = await resultPromise;
  const rollouts = new Map(result.kernel_cutover_domain_rollout_rows.map((row) => [row.domain_id, row.rollout_level]));

  assert.equal(result.kernel_cutover_domain_rollout_rows.length, 7);
  assert.equal(rollouts.get("platform"), "kernel_native_no_execution");
  assert.equal(rollouts.get("law-firm"), "kernel_native_no_execution");
  assert.equal(rollouts.get("project.zendd"), "kernel_native_no_write_external_adapter");
  assert.equal(result.kernel_cutover_domain_rollout_rows.every((row) => row.protected_action_allowed_now === false), true);
  assert.equal(result.kernel_cutover_domain_rollout_rows.every((row) => row.write_action_allowed_now === false), true);
  assert.equal(result.kernel_cutover_domain_rollout_rows.every((row) => row.final_authority_allowed_now === false), true);
});

test("Kernel Harness-native cutover freeze preserves guards, handoff rows, and claims", async () => {
  const result = await resultPromise;
  const handoffIds = new Set(result.kernel_cutover_handoff_rows.map((row) => row.handoff_id));

  assert.equal(result.kernel_cutover_api_route_rows.length, 5);
  assert.equal(result.kernel_cutover_api_route_rows.every((row) => row.method === "GET"), true);
  assert.equal(result.kernel_cutover_guard_rows.length, 10);
  assert.equal(result.kernel_cutover_guard_rows.every((row) => row.action_allowed_now === false), true);
  assert.equal(result.kernel_cutover_handoff_rows.length, 4);
  assert.equal(handoffIds.has("p2041_suspended_pending_nous_overlap_audit"), true);
  assert.equal(result.kernel_cutover_handoff_rows.every((row) => row.execution_enabled_by_handoff === false), true);
  assert.equal(result.kernel_cutover_freeze_rows.length, 8);
  assert.equal(result.kernel_cutover_gate_rows.length, 12);
  assert.equal(result.kernel_cutover_claim_rows.length, 70);
  assert.equal(result.summary.pass_claim_count, 50);
  assert.equal(result.summary.blocked_claim_count, 20);
});

test("Kernel Harness-native cutover freeze keeps unsafe boundaries false", async () => {
  const result = await resultPromise;
  const boundary = result.kernel_cutover_boundary;

  assert.equal(boundary.kernel_harness_native_cutover_freeze_ready_for_limited_execution_program, true);
  assert.equal(boundary.platform_kernel_program_complete, true);
  assert.equal(boundary.p2041_handoff_only, true);
  assert.equal(boundary.p2041_suspended_pending_nous_overlap_audit, true);
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

test("Kernel Harness-native cutover freeze --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-kernel-harness-native-cutover-freeze-"));
  const sentinelPath = path.join(outDir, "platform-kernel-harness-native-cutover-freeze.json");
  const sentinel = "{ \"sentinel\": \"platform-kernel-harness-native-cutover-freeze\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformKernelHarnessNativeCutoverFreeze({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
