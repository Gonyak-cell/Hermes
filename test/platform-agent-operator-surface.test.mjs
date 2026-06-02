import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformAgentOperatorSurface,
  runPlatformAgentOperatorSurface,
} from "../src/platform-agent-operator-surface.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";

test("platform agent operator surface consumes the committed adoption freeze baseline", async () => {
  const result = await buildPlatformAgentOperatorSurface({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_agent_operator_surface_status, "ready_for_agent_operator_surface");
  assert.equal(result.summary.baseline_commit_ref, "4cfda48");
  assert.equal(result.summary.source_adoption_freeze_status, "ready_for_agent_adoption_freeze");
  assert.equal(result.summary.source_claim_count, 211);
  assert.equal(result.summary.source_blocked_claim_count, 47);
  assert.equal(result.agent_operator_baseline_rows.length, 3);
});

test("platform agent operator surface exposes read-only dashboard and API route rows", async () => {
  const result = await buildPlatformAgentOperatorSurface({ runAt: RUN_AT, write: false });
  const routePaths = new Set(result.agent_operator_api_route_rows.map((row) => row.route_path));

  assert.equal(result.agent_operator_dashboard_rows.length, 6);
  assert.equal(result.agent_operator_dashboard_rows.every((row) => row.read_only === true && row.server_started === false), true);
  assert.equal(result.agent_operator_api_route_rows.length, 5);
  assert.equal(routePaths.has("/api/agent/adoption-freeze/sources"), true);
  assert.equal(routePaths.has("/api/agent/adoption-freeze/next-actions"), true);
  assert.equal(result.agent_operator_api_route_rows.every((row) => row.method === "GET" && row.mutation_route === false && row.raw_material_route === false), true);
});

test("platform agent operator surface shows protected blocks and next actions without execution", async () => {
  const result = await buildPlatformAgentOperatorSurface({ runAt: RUN_AT, write: false });
  const protectedIds = new Set(result.agent_operator_protected_queue_rows.map((row) => row.protected_action_id));

  for (const protectedId of ["direct_zendd_mutation", "raw_client_vdr_context", "legal_final_judgment", "live_order_submission", "agent_final_pass", "secret_forwarding"]) {
    assert.equal(protectedIds.has(protectedId), true, `${protectedId} should be surfaced`);
  }
  assert.equal(result.agent_operator_protected_queue_rows.length, 16);
  assert.equal(result.agent_operator_protected_queue_rows.every((row) => row.protected_action_verdict === "blocked" && row.next_allowed_action), true);
  assert.equal(result.agent_operator_next_action_rows.length, 16);
  assert.equal(result.agent_operator_next_action_rows.every((row) => row.execution_allowed_now === false && row.next_allowed_action), true);
});

test("platform agent operator surface blocks mutation routes and emits supported claims", async () => {
  const result = await buildPlatformAgentOperatorSurface({ runAt: RUN_AT, write: false });

  assert.equal(result.agent_operator_mutation_block_rows.length, 8);
  assert.equal(result.agent_operator_mutation_block_rows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.route_registered === false), true);
  assert.equal(result.agent_operator_claim_rows.length, 54);
  assert.equal(result.agent_operator_claim_rows.filter((row) => row.current_verdict === "pass").length, 46);
  assert.equal(result.agent_operator_claim_rows.filter((row) => row.current_verdict === "blocked").length, 8);
  assert.equal(result.agent_operator_claim_rows.every((row) => row.verdict_authority === "harness_only"), true);
  assert.equal(result.agent_operator_gate_rows.every((row) => row.gate_status === "ready"), true);
});

test("platform agent operator surface --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-agent-operator-surface-"));
  const sentinelPath = path.join(outDir, "platform-agent-operator-surface.json");
  const sentinel = "{ \"sentinel\": \"platform-agent-operator-surface\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformAgentOperatorSurface({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
