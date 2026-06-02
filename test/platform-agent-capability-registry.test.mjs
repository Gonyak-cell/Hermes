import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformAgentCapabilityRegistry,
  runPlatformAgentCapabilityRegistry,
} from "../src/platform-agent-capability-registry.mjs";

const RUN_AT = "2026-06-02T00:00:00.000Z";

test("platform agent capability registry covers every seed domain with harness-only authority", async () => {
  const result = await buildPlatformAgentCapabilityRegistry({ runAt: RUN_AT, write: false });
  const domainIds = new Set(result.domain_agent_registry_rows.map((row) => row.domain_id));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_agent_capability_registry_status, "ready_for_agent_capability_registry");
  assert.equal(result.source_agent_isolated_install_gate_summary.platform_agent_isolated_install_gate_status, "ready_for_agent_isolated_install_gate");
  for (const domainId of ["platform", "personal-dev", "law-firm", "creative-document", "connectors-resource", "trading", "project.zendd"]) {
    assert.equal(domainIds.has(domainId), true, `${domainId} should be registered`);
  }
  assert.equal(result.domain_agent_registry_rows.every((row) => row.verdict_authority === "harness_only"), true);
  assert.equal(result.domain_agent_registry_rows.every((row) => row.final_pass_by_agent_allowed === false), true);
  assert.equal(result.domain_agent_registry_rows.every((row) => row.protected_action_execution_allowed_now === false), true);
});

test("platform agent capability registry defines L0-L5 rollout levels and domain capabilities", async () => {
  const result = await buildPlatformAgentCapabilityRegistry({ runAt: RUN_AT, write: false });
  const rolloutLevels = result.agent_rollout_level_rows.map((row) => row.rollout_level);
  const zenddCapabilities = result.domain_agent_capability_rows.filter((row) => row.domain_id === "project.zendd");

  assert.deepEqual(rolloutLevels, ["L0", "L1", "L2", "L3", "L4", "L5"]);
  assert.ok(result.domain_agent_capability_rows.length >= 28);
  assert.equal(result.domain_agent_registry_rows.every((domain) => result.domain_agent_capability_rows.some((row) => row.domain_id === domain.domain_id)), true);
  assert.ok(zenddCapabilities.some((row) => row.capability_name === "patch_plan_candidate"));
  assert.ok(zenddCapabilities.some((row) => row.capability_name === "vdr_ldd_bridge_candidate"));
  assert.equal(result.domain_agent_capability_rows.every((row) => row.agent_may_create_final_pass === false), true);
  assert.equal(result.domain_agent_capability_rows.every((row) => row.terminal_execution_allowed_now === false), true);
});

test("platform agent capability registry requires adapter SDK and tool policy bindings", async () => {
  const result = await buildPlatformAgentCapabilityRegistry({ runAt: RUN_AT, write: false });

  assert.equal(result.domain_agent_adapter_sdk_rows.length, result.domain_agent_registry_rows.length);
  assert.equal(result.domain_agent_adapter_sdk_rows.every((row) => row.claim_binding_required), true);
  assert.equal(result.domain_agent_adapter_sdk_rows.every((row) => row.evidence_binding_required), true);
  assert.equal(result.domain_agent_adapter_sdk_rows.every((row) => row.operator_surface_binding_required), true);
  assert.equal(result.domain_agent_tool_policy_rows.every((row) => row.blocked_tool_classes.includes("secret_read")), true);
  assert.equal(result.domain_agent_tool_policy_rows.every((row) => row.blocked_tool_classes.includes("domain_mutation")), true);
  assert.equal(result.domain_agent_tool_policy_rows.every((row) => row.mcp_policy === "blocked_until_registered_human_gate"), true);
});

test("platform agent capability registry documents unsafe capability blocks and supported claims", async () => {
  const result = await buildPlatformAgentCapabilityRegistry({ runAt: RUN_AT, write: false });
  const unsafeIds = new Set(result.unsafe_agent_capability_block_rows.map((row) => row.unsafe_capability_id));

  for (const unsafeId of ["agent_direct_pass", "agent_legal_final_judgment", "agent_live_order_submission", "agent_raw_client_vdr_read", "agent_direct_zendd_mutation"]) {
    assert.equal(unsafeIds.has(unsafeId), true, `${unsafeId} should be blocked`);
  }
  assert.equal(result.unsafe_agent_capability_block_rows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), true);
  assert.equal(result.agent_capability_registry_claim_rows.every((row) => row.verdict_authority === "harness_only"), true);
  assert.equal(result.agent_capability_registry_claim_rows.filter((row) => row.current_verdict === "pass").every((row) => row.evidence_ref && row.reviewer_ref && row.hard_gate_ref), true);
  assert.equal(result.agent_capability_registry_claim_rows.filter((row) => row.current_verdict === "blocked").every((row) => row.block_reason && row.responsible_owner && row.next_allowed_action), true);
  assert.equal(result.agent_capability_registry_gate_rows.every((row) => row.gate_status === "ready"), true);
});

test("platform agent capability registry --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-agent-capability-registry-"));
  const sentinelPath = path.join(outDir, "platform-agent-capability-registry.json");
  const sentinel = "{ \"sentinel\": \"platform-agent-capability-registry\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformAgentCapabilityRegistry({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
