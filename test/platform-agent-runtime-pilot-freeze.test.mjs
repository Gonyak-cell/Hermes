import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformAgentRuntimePilotFreeze,
  runPlatformAgentRuntimePilotFreeze,
} from "../src/platform-agent-runtime-pilot-freeze.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";
const resultPromise = buildPlatformAgentRuntimePilotFreeze({ runAt: RUN_AT, write: false });

test("platform agent runtime pilot freeze consumes all P1122-P1198 sources", async () => {
  const result = await resultPromise;
  const sourceIds = new Set(result.agent_runtime_pilot_freeze_source_rows.map((row) => row.source_id));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_agent_runtime_pilot_freeze_status, "ready_for_human_approved_agent_runtime_pilot");
  assert.equal(result.agent_runtime_pilot_freeze_source_rows.length, 10);
  assert.equal(sourceIds.has("authority_freeze"), true);
  assert.equal(sourceIds.has("install_trust_gate"), true);
  assert.equal(sourceIds.has("runtime_receipt_contract"), true);
  assert.equal(sourceIds.has("install_packet"), true);
  assert.equal(sourceIds.has("doctor_evidence_bridge"), true);
  assert.equal(sourceIds.has("tool_policy_matrix"), true);
  assert.equal(sourceIds.has("domain_adapter_sdk"), true);
  assert.equal(sourceIds.has("zendd_candidate_bridge"), true);
  assert.equal(sourceIds.has("delegation_contract"), true);
  assert.equal(sourceIds.has("dry_run_simulation"), true);
  assert.equal(result.agent_runtime_pilot_freeze_source_rows.every((row) => row.current_verdict === "pass"), true);
});

test("platform agent runtime pilot freeze audits source claims", async () => {
  const result = await resultPromise;

  assert.equal(result.agent_runtime_pilot_freeze_claim_audit_rows.length, 10);
  assert.equal(result.summary.source_claim_count > 0, true);
  assert.equal(result.summary.unsupported_claim_count, 0);
  assert.equal(result.agent_runtime_pilot_freeze_claim_audit_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.agent_runtime_pilot_freeze_claim_audit_rows.every((row) => row.unsupported_claim_count === 0), true);
  assert.equal(result.agent_runtime_pilot_freeze_claim_audit_rows.every((row) => row.source_pass_claim_count + row.source_blocked_claim_count === row.source_claim_count), true);
});

test("platform agent runtime pilot freeze documents protected runtime blocks", async () => {
  const result = await resultPromise;
  const blockIds = new Set(result.agent_runtime_pilot_freeze_protected_block_rows.map((row) => row.protected_block_id));

  assert.equal(result.agent_runtime_pilot_freeze_protected_block_rows.length, 16);
  assert.equal(blockIds.has("runtime_execution_without_receipt"), true);
  assert.equal(blockIds.has("package_download_or_install"), true);
  assert.equal(blockIds.has("terminal_command_execution"), true);
  assert.equal(blockIds.has("mcp_connection_start"), true);
  assert.equal(blockIds.has("api_server_start"), true);
  assert.equal(blockIds.has("cron_gateway_start"), true);
  assert.equal(blockIds.has("provider_secret_configuration"), true);
  assert.equal(blockIds.has("raw_client_vdr_exposure"), true);
  assert.equal(blockIds.has("direct_zendd_mutation"), true);
  assert.equal(blockIds.has("protected_action_execution"), true);
  assert.equal(blockIds.has("agent_final_pass_or_approval"), true);
  assert.equal(result.agent_runtime_pilot_freeze_protected_block_rows.every((row) => row.current_verdict === "blocked"), true);
  assert.equal(result.agent_runtime_pilot_freeze_protected_block_rows.every((row) => row.documented_human_gate_ref), true);
});

test("platform agent runtime pilot freeze emits final PASS/BLOCK claims", async () => {
  const result = await resultPromise;

  assert.equal(result.agent_runtime_pilot_freeze_claim_rows.length, 36);
  assert.equal(result.agent_runtime_pilot_freeze_claim_rows.filter((row) => row.current_verdict === "pass").length, 20);
  assert.equal(result.agent_runtime_pilot_freeze_claim_rows.filter((row) => row.current_verdict === "blocked").length, 16);
  assert.equal(result.agent_runtime_pilot_freeze_claim_rows.every((row) => row.evidence_ref), true);
  assert.equal(result.agent_runtime_pilot_freeze_claim_rows.every((row) => row.reviewer_ref), true);
  assert.equal(result.agent_runtime_pilot_freeze_claim_rows.every((row) => row.hard_gate_ref), true);
  assert.equal(result.agent_runtime_pilot_freeze_claim_rows.every((row) => row.verdict_authority === "harness_only"), true);
});

test("platform agent runtime pilot freeze keeps runtime and authority disabled", async () => {
  const result = await resultPromise;
  const boundary = result.agent_runtime_pilot_freeze_boundary;

  assert.equal(boundary.human_approved_pilot_ready_for_future_receipt, true);
  assert.equal(boundary.agent_runtime_execution_allowed_now, false);
  assert.equal(boundary.terminal_execution_allowed_now, false);
  assert.equal(boundary.mcp_connection_allowed_now, false);
  assert.equal(boundary.api_server_start_allowed_now, false);
  assert.equal(boundary.cron_gateway_start_allowed_now, false);
  assert.equal(boundary.package_install_allowed_now, false);
  assert.equal(boundary.provider_secret_configuration_allowed_now, false);
  assert.equal(boundary.raw_secret_read_allowed_now, false);
  assert.equal(boundary.raw_client_or_vdr_access_allowed_now, false);
  assert.equal(boundary.direct_zendd_mutation_allowed_now, false);
  assert.equal(boundary.protected_action_execution_allowed_now, false);
  assert.equal(boundary.receipt_application_allowed_now, false);
  assert.equal(boundary.final_pass_or_approval_allowed_now, false);
  assert.equal(boundary.legal_final_judgment_allowed_now, false);
  assert.equal(boundary.release_decision_allowed_now, false);
  assert.equal(result.summary.unsafe_flag_count, 0);
});

test("platform agent runtime pilot freeze closes all gates", async () => {
  const result = await resultPromise;

  assert.equal(result.agent_runtime_pilot_freeze_gate_rows.length, 19);
  assert.equal(result.agent_runtime_pilot_freeze_closeout_rows.length, 12);
  assert.equal(result.agent_runtime_pilot_freeze_gate_rows.every((row) => row.gate_status === "ready"), true);
  assert.equal(result.agent_runtime_pilot_freeze_closeout_rows.every((row) => row.current_verdict === "pass"), true);
});

test("platform agent runtime pilot freeze --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-agent-runtime-pilot-freeze-"));
  const sentinelPath = path.join(outDir, "platform-agent-runtime-pilot-freeze.json");
  const sentinel = "{ \"sentinel\": \"platform-agent-runtime-pilot-freeze\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformAgentRuntimePilotFreeze({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
