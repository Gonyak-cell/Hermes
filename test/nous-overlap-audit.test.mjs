import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildNousOverlapAudit,
  runNousOverlapAudit,
} from "../src/nous-overlap-audit.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";
const resultPromise = buildNousOverlapAudit({ runAt: RUN_AT, write: false });

test("Nous overlap audit consumes the P2040 freeze and source docs", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.nous_overlap_audit_status, "ready_for_nous_overlap_audit");
  assert.equal(result.summary.source_p2040_freeze_status, "ready_for_platform_kernel_harness_native_cutover_freeze");
  assert.equal(result.source_p2040_freeze_summary.p2041_suspended_pending_nous_overlap_audit, true);
  assert.equal(result.nous_overlap_audit_anchor.program_range, "P2041-P2120");
  assert.equal(result.nous_overlap_audit_anchor.phase_range, "P2041-P2120");
  assert.equal(result.nous_source_rows.length, 8);
  assert.equal(result.nous_source_rows.every((row) => row.source_url.startsWith("https://hermes-agent.nousresearch.com/")), true);
});

test("Nous overlap audit classifies P1201-P2040 surfaces", async () => {
  const result = await resultPromise;
  const byId = new Map(result.harness_surface_classification_rows.map((row) => [row.surface_id, row]));

  assert.equal(result.harness_surface_classification_rows.length, 12);
  assert.equal(result.summary.keep_harness_native_count, 5);
  assert.equal(result.summary.adapter_boundary_count, 2);
  assert.equal(result.summary.deprecate_into_governance_count, 4);
  assert.equal(result.summary.drop_suspended_count, 1);
  assert.equal(byId.get("p1201_agent_runtime_activation_bridge").classification, "adapter_boundary");
  assert.equal(byId.get("p1441_agent_operator_console_v0").classification, "deprecate_into_governance");
  assert.equal(byId.get("p1501_kernel_contract_baseline").classification, "keep_harness_native");
  assert.equal(byId.get("p2041_limited_execution_program").classification, "drop_suspended");
  assert.equal(result.harness_surface_classification_rows.every((row) => row.nous_runtime_reimplementation_allowed === false), true);
});

test("Nous overlap audit blocks future execution phases", async () => {
  const result = await resultPromise;
  const blockedIds = new Set(result.blocked_next_phase_rows.map((row) => row.blocked_phase_id));
  const boundary = result.nous_overlap_boundary;

  assert.equal(result.blocked_next_phase_rows.length, 4);
  assert.equal(blockedIds.has("p2041_limited_execution"), true);
  assert.equal(result.blocked_next_phase_rows.every((row) => row.current_verdict === "blocked"), true);
  assert.equal(result.blocked_next_phase_rows.every((row) => row.execution_allowed_now === false), true);
  assert.equal(boundary.p2041_suspended_pending_nous_overlap_audit, true);
  assert.equal(boundary.p2041_limited_execution_allowed_now, false);
  assert.equal(boundary.direct_nous_runtime_call_allowed_now, false);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.nous_runtime_reimplementation_allowed, false);
  assert.equal(result.summary.unsafe_flag_count, 0);
});

test("Nous overlap audit --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "nous-overlap-audit-"));
  const sentinelPath = path.join(outDir, "nous-overlap-audit.json");
  const sentinel = "{ \"sentinel\": \"nous-overlap-audit\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runNousOverlapAudit({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
