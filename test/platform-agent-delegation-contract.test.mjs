import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformAgentDelegationContract,
  runPlatformAgentDelegationContract,
} from "../src/platform-agent-delegation-contract.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";
const resultPromise = buildPlatformAgentDelegationContract({ runAt: RUN_AT, write: false });

test("platform agent delegation contract consumes candidate bridge and capability registry", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_agent_delegation_contract_status, "ready_for_agent_delegation_contract");
  assert.equal(result.summary.source_zendd_candidate_bridge_status, "ready_for_agent_zendd_candidate_bridge");
  assert.equal(result.summary.source_capability_registry_status, "ready_for_agent_capability_registry");
  assert.equal(result.agent_delegation_gate_rows.every((row) => row.gate_status === "ready"), true);
});

test("platform agent delegation contract defines four disabled subagent roles per domain", async () => {
  const result = await resultPromise;
  const roleIds = new Set(result.agent_delegation_role_rows.map((row) => row.role_id));

  assert.equal(result.agent_delegation_role_rows.length, 28);
  assert.equal(result.summary.domain_count, 7);
  assert.equal(roleIds.has("domain_observer"), true);
  assert.equal(roleIds.has("work_order_planner"), true);
  assert.equal(roleIds.has("evidence_packet_drafter"), true);
  assert.equal(roleIds.has("review_packet_drafter"), true);
  assert.equal(result.agent_delegation_role_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.agent_delegation_role_rows.every((row) => row.subagent_spawn_allowed_now === false), true);
  assert.equal(result.agent_delegation_role_rows.every((row) => row.tool_invocation_allowed_now === false), true);
  assert.equal(result.agent_delegation_role_rows.every((row) => row.final_pass_or_approval_allowed_now === false), true);
});

test("platform agent delegation contract emits safe handoff channels", async () => {
  const result = await resultPromise;

  assert.equal(result.agent_delegation_handoff_channel_rows.length, 7);
  assert.equal(result.agent_delegation_handoff_channel_rows.every((row) => row.cross_domain_handoff_allowed_now === false), true);
  assert.equal(result.agent_delegation_handoff_channel_rows.every((row) => row.raw_material_forwarding_allowed_now === false), true);
  assert.equal(result.agent_delegation_handoff_channel_rows.every((row) => row.secret_forwarding_allowed_now === false), true);
  assert.equal(result.agent_delegation_handoff_channel_rows.every((row) => row.forbidden_handoff_payload_fields.includes("raw_secret")), true);
  assert.equal(result.agent_delegation_handoff_channel_rows.every((row) => row.forbidden_handoff_payload_fields.includes("final_pass")), true);
});

test("platform agent delegation contract maps Zendd candidate packets without execution", async () => {
  const result = await resultPromise;
  const packetTypes = new Set(result.agent_zendd_delegation_packet_rows.map((row) => row.candidate_packet_type));

  assert.equal(result.agent_zendd_delegation_packet_rows.length, 5);
  assert.equal(packetTypes.has("work_order_candidate"), true);
  assert.equal(packetTypes.has("patch_plan_candidate"), true);
  assert.equal(packetTypes.has("command_evidence_candidate"), true);
  assert.equal(packetTypes.has("vdr_ldd_candidate"), true);
  assert.equal(packetTypes.has("release_sandbox_candidate"), true);
  assert.equal(result.agent_zendd_delegation_packet_rows.every((row) => row.human_receipt_required_before_delegation === true), true);
  assert.equal(result.agent_zendd_delegation_packet_rows.every((row) => row.subagent_spawn_allowed_now === false), true);
  assert.equal(result.agent_zendd_delegation_packet_rows.every((row) => row.direct_zendd_mutation_allowed_now === false), true);
  assert.equal(result.agent_zendd_delegation_packet_rows.every((row) => row.agent_final_pass_allowed_now === false), true);
});

test("platform agent delegation contract documents protected blocks and supported claims", async () => {
  const result = await resultPromise;
  const blockIds = new Set(result.agent_delegation_protected_block_rows.map((row) => row.protected_block_id));

  assert.equal(result.agent_delegation_protected_block_rows.length, 12);
  assert.equal(blockIds.has("autonomous_subagent_spawn"), true);
  assert.equal(blockIds.has("background_agent_loop"), true);
  assert.equal(blockIds.has("cross_domain_data_forwarding"), true);
  assert.equal(blockIds.has("raw_secret_forwarding"), true);
  assert.equal(blockIds.has("terminal_execution_delegate"), true);
  assert.equal(blockIds.has("direct_zendd_mutation_delegate"), true);
  assert.equal(blockIds.has("agent_final_approval_or_legal_judgment"), true);
  assert.equal(result.agent_delegation_claim_rows.length, 52);
  assert.equal(result.agent_delegation_claim_rows.filter((row) => row.current_verdict === "pass").length, 40);
  assert.equal(result.agent_delegation_claim_rows.filter((row) => row.current_verdict === "blocked").length, 12);
  assert.equal(result.agent_delegation_claim_rows.every((row) => row.verdict_authority === "harness_only"), true);
});

test("platform agent delegation contract disables runtime, raw forwarding, and final authority", async () => {
  const result = await resultPromise;
  const boundary = result.agent_delegation_boundary;

  assert.equal(boundary.delegation_packet_generation_allowed, true);
  assert.equal(boundary.subagent_spawn_allowed_now, false);
  assert.equal(boundary.autonomous_execution_allowed_now, false);
  assert.equal(boundary.background_loop_allowed_now, false);
  assert.equal(boundary.tool_invocation_allowed_now, false);
  assert.equal(boundary.terminal_execution_allowed_now, false);
  assert.equal(boundary.mcp_connection_allowed_now, false);
  assert.equal(boundary.api_server_start_allowed_now, false);
  assert.equal(boundary.cron_start_allowed_now, false);
  assert.equal(boundary.cross_domain_data_access_allowed_now, false);
  assert.equal(boundary.raw_secret_forwarding_allowed_now, false);
  assert.equal(boundary.raw_client_or_vdr_forwarding_allowed_now, false);
  assert.equal(boundary.provider_secret_configuration_allowed_now, false);
  assert.equal(boundary.direct_zendd_mutation_allowed_now, false);
  assert.equal(boundary.protected_action_execution_allowed_now, false);
  assert.equal(boundary.final_pass_or_approval_allowed_now, false);
  assert.equal(boundary.legal_final_judgment_allowed_now, false);
  assert.equal(boundary.release_decision_allowed_now, false);
  assert.equal(result.summary.unsafe_flag_count, 0);
});

test("platform agent delegation contract --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-agent-delegation-contract-"));
  const sentinelPath = path.join(outDir, "platform-agent-delegation-contract.json");
  const sentinel = "{ \"sentinel\": \"platform-agent-delegation-contract\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformAgentDelegationContract({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
