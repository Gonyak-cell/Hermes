import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformAgentAdoptionFreeze,
  runPlatformAgentAdoptionFreeze,
} from "../src/platform-agent-adoption-freeze.mjs";

const RUN_AT = "2026-06-02T00:00:00.000Z";

test("platform agent adoption freeze audits every prior Agent phase source", async () => {
  const result = await buildPlatformAgentAdoptionFreeze({ runAt: RUN_AT, write: false });
  const sourceIds = new Set(result.agent_adoption_source_rows.map((row) => row.source_id));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_agent_adoption_freeze_status, "ready_for_agent_adoption_freeze");
  for (const sourceId of ["agent_authority_freeze", "agent_install_trust_gate", "agent_isolated_install_gate", "agent_capability_registry", "agent_domain_rollout"]) {
    assert.equal(sourceIds.has(sourceId), true, `${sourceId} should be audited`);
  }
  assert.equal(result.summary.source_count, 5);
  assert.equal(result.summary.source_claim_count, 211);
  assert.equal(result.summary.source_pass_claim_count, 164);
  assert.equal(result.summary.source_blocked_claim_count, 47);
  assert.equal(result.agent_adoption_source_rows.every((row) => row.current_verdict === "pass"), true);
});

test("platform agent adoption freeze keeps all unsafe Agent runtime boundaries false", async () => {
  const result = await buildPlatformAgentAdoptionFreeze({ runAt: RUN_AT, write: false });
  const policy = result.agent_adoption_freeze_policy;

  for (const field of [
    "install_execution_allowed_now",
    "runtime_execution_allowed_now",
    "terminal_execution_allowed_now",
    "mcp_connection_allowed_now",
    "api_server_start_allowed_now",
    "cron_or_gateway_start_allowed_now",
    "provider_secret_configuration_allowed_now",
    "raw_secret_context_allowed",
    "raw_client_or_vdr_context_allowed",
    "direct_zendd_mutation_allowed",
    "source_tree_movement_allowed",
    "legal_final_judgment_allowed",
    "live_order_submission_allowed",
    "protected_output_finalization_allowed",
    "agent_may_create_final_pass",
    "agent_may_apply_human_receipt",
    "agent_may_execute_protected_action",
    "yolo_mode_allowed",
    "approval_off_allowed",
    "yolo_or_approval_off_allowed",
    "secret_forwarding_allowed",
  ]) {
    assert.equal(policy[field], false, `${field} should stay false`);
  }
  assert.equal(result.agent_adoption_invariant_rows.length, 16);
  assert.equal(result.agent_adoption_invariant_rows.every((row) => row.current_verdict === "pass"), true);
});

test("platform agent adoption freeze documents protected actions as BLOCK", async () => {
  const result = await buildPlatformAgentAdoptionFreeze({ runAt: RUN_AT, write: false });
  const protectedIds = new Set(result.agent_adoption_protected_block_rows.map((row) => row.protected_action_id));

  for (const protectedId of ["direct_zendd_mutation", "raw_client_vdr_context", "legal_final_judgment", "live_order_submission", "agent_final_pass", "secret_forwarding"]) {
    assert.equal(protectedIds.has(protectedId), true, `${protectedId} should be blocked`);
  }
  assert.equal(result.agent_adoption_protected_block_rows.length, 16);
  assert.equal(result.agent_adoption_protected_block_rows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), true);
  assert.equal(result.agent_adoption_claim_rows.filter((row) => row.current_verdict === "blocked").length, 16);
  assert.equal(result.agent_adoption_claim_rows.every((row) => row.verdict_authority === "harness_only"), true);
});

test("platform agent adoption freeze exposes only read-only planned operator routes", async () => {
  const result = await buildPlatformAgentAdoptionFreeze({ runAt: RUN_AT, write: false });
  const routePaths = new Set(result.agent_adoption_operator_surface_rows.map((row) => row.route_path));

  assert.equal(routePaths.has("/api/agent/adoption-freeze/sources"), true);
  assert.equal(routePaths.has("/api/agent/adoption-freeze/protected-blocks"), true);
  assert.equal(result.agent_adoption_operator_surface_rows.every((row) => row.route_mode === "read_only_planned_surface"), true);
  assert.equal(result.agent_adoption_operator_surface_rows.every((row) => row.server_started === false), true);
  assert.equal(result.agent_adoption_operator_surface_rows.every((row) => row.mutation_route_count === 0 && row.raw_material_route_count === 0), true);
});

test("platform agent adoption freeze --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-agent-adoption-freeze-"));
  const sentinelPath = path.join(outDir, "platform-agent-adoption-freeze.json");
  const sentinel = "{ \"sentinel\": \"platform-agent-adoption-freeze\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformAgentAdoptionFreeze({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
