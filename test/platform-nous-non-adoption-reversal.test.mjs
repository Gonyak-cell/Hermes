import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformNousNonAdoptionReversal,
  runPlatformNousNonAdoptionReversal,
} from "../src/platform-nous-non-adoption-reversal.mjs";

const RUN_AT = "2026-06-04T00:00:00.000Z";
const resultPromise = buildPlatformNousNonAdoptionReversal({ runAt: RUN_AT, write: false });

test("Nous non-adoption reversal consumes and supersedes the overlap audit", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_nous_non_adoption_reversal_status, "ready_for_platform_nous_non_adoption_reversal");
  assert.equal(result.summary.source_nous_overlap_audit_status, "ready_for_nous_overlap_audit");
  assert.equal(result.nous_non_adoption_decision.nous_adopted, false);
  assert.equal(result.nous_non_adoption_decision.source_audit_future_policy_status, "superseded_by_nous_non_adoption");
  assert.equal(result.summary.source_p2041_suspension_superseded, true);
  assert.equal(result.summary.p2041_reopened_as_hermes_native_planning, true);
});

test("Nous non-adoption reversal restores all prior surfaces as Hermes-native planning inputs", async () => {
  const result = await resultPromise;
  const byId = new Map(result.surface_restoration_rows.map((row) => [row.surface_id, row]));

  assert.equal(result.surface_restoration_rows.length, 12);
  assert.equal(result.summary.restored_surface_count, 6);
  assert.equal(result.summary.preserved_surface_count, 5);
  assert.equal(result.summary.reopened_surface_count, 1);
  assert.equal(byId.get("p1201_agent_runtime_activation_bridge").restore_decision, "restore_hermes_native");
  assert.equal(byId.get("p1441_agent_operator_console_v0").restore_decision, "restore_hermes_native");
  assert.equal(byId.get("p1501_kernel_contract_baseline").restore_decision, "preserve_harness_native");
  assert.equal(byId.get("p2041_limited_execution_program").restore_decision, "reopen_as_planning_input");
  assert.equal(result.surface_restoration_rows.every((row) => row.nous_adopted === false), true);
  assert.equal(result.surface_restoration_rows.every((row) => row.execution_allowed_now === false), true);
});

test("Nous non-adoption reversal plans restored capabilities and next phase handoffs", async () => {
  const result = await resultPromise;
  const capabilityIds = new Set(result.restored_capability_rows.map((row) => row.capability_id));
  const handoffIds = new Set(result.next_phase_handoff_rows.map((row) => row.handoff_id));

  assert.equal(result.restored_capability_rows.length, 10);
  assert.equal(capabilityIds.has("hermes.runtime_api_control_plane"), true);
  assert.equal(capabilityIds.has("hermes.memory_bank"), true);
  assert.equal(capabilityIds.has("hermes.controlled_write_lane"), true);
  assert.equal(result.restored_capability_rows.every((row) => row.restore_status === "planned_not_enabled"), true);
  assert.equal(result.next_phase_handoff_rows.length, 7);
  assert.equal(handoffIds.has("p2121_runtime_governance_restore"), true);
  assert.equal(handoffIds.has("p3041_production_governance_freeze"), true);
});

test("Nous non-adoption reversal keeps unsafe runtime boundaries closed", async () => {
  const result = await resultPromise;
  const boundary = result.reversal_boundary;

  assert.equal(boundary.p2121_ready_as_next_goal, true);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.protected_action_execution_allowed_now, false);
  assert.equal(boundary.receipt_application_allowed_now, false);
  assert.equal(boundary.raw_material_access_allowed_now, false);
  assert.equal(boundary.agent_final_pass_allowed_now, false);
  assert.equal(boundary.unsafe_flag_count, 0);
  assert.equal(result.reversal_guard_rows.every((row) => row.guard_status === "ready"), true);
});

test("Nous non-adoption reversal --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-nous-non-adoption-reversal-"));
  const sentinelPath = path.join(outDir, "platform-nous-non-adoption-reversal.json");
  const sentinel = "{ \"sentinel\": \"platform-nous-non-adoption-reversal\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformNousNonAdoptionReversal({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
