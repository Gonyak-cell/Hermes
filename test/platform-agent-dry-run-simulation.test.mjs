import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformAgentDryRunSimulation,
  runPlatformAgentDryRunSimulation,
} from "../src/platform-agent-dry-run-simulation.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";
const resultPromise = buildPlatformAgentDryRunSimulation({ runAt: RUN_AT, write: false });

test("platform agent dry-run simulation consumes runtime pilot sources", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_agent_dry_run_simulation_status, "ready_for_agent_dry_run_simulation");
  assert.equal(result.summary.source_delegation_contract_status, "ready_for_agent_delegation_contract");
  assert.equal(result.summary.source_install_packet_status, "ready_for_agent_install_packet");
  assert.equal(result.summary.source_doctor_evidence_bridge_status, "ready_for_agent_doctor_evidence_bridge");
  assert.equal(result.summary.source_tool_policy_matrix_status, "ready_for_agent_tool_policy_matrix");
  assert.equal(result.summary.source_runtime_receipt_contract_status, "ready_for_agent_runtime_receipt_contract");
});

test("platform agent dry-run simulation emits would-run scenarios without execution", async () => {
  const result = await resultPromise;
  const scenarioIds = new Set(result.agent_dry_run_scenario_rows.map((row) => row.scenario_id));

  assert.equal(result.agent_dry_run_scenario_rows.length, 12);
  assert.equal(scenarioIds.has("install_packet_would_run"), true);
  assert.equal(scenarioIds.has("doctor_probe_would_run"), true);
  assert.equal(scenarioIds.has("terminal_tool_probe_would_run"), true);
  assert.equal(scenarioIds.has("zendd_command_evidence_delegation_would_run"), true);
  assert.equal(scenarioIds.has("final_readiness_freeze_would_run"), true);
  assert.equal(result.agent_dry_run_scenario_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.agent_dry_run_scenario_rows.every((row) => row.agent_runtime_started === false), true);
  assert.equal(result.agent_dry_run_scenario_rows.every((row) => row.command_execution_performed === false), true);
});

test("platform agent dry-run simulation creates redacted evidence packets only", async () => {
  const result = await resultPromise;

  assert.equal(result.agent_dry_run_evidence_packet_rows.length, 12);
  assert.equal(result.agent_dry_run_evidence_packet_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.agent_dry_run_evidence_packet_rows.every((row) => row.redacted_summary_ready === true), true);
  assert.equal(result.agent_dry_run_evidence_packet_rows.every((row) => row.raw_stdout_stored === false), true);
  assert.equal(result.agent_dry_run_evidence_packet_rows.every((row) => row.raw_secret_stored === false), true);
  assert.equal(result.agent_dry_run_evidence_packet_rows.every((row) => row.raw_client_or_vdr_material_stored === false), true);
  assert.equal(result.agent_dry_run_evidence_packet_rows.every((row) => row.command_executed_to_collect_evidence === false), true);
});

test("platform agent dry-run simulation documents disabled path probes", async () => {
  const result = await resultPromise;
  const disabledIds = new Set(result.agent_dry_run_disabled_path_probe_rows.map((row) => row.disabled_path_id));

  assert.equal(result.agent_dry_run_disabled_path_probe_rows.length, 14);
  assert.equal(disabledIds.has("agent_runtime_start"), true);
  assert.equal(disabledIds.has("terminal_execution"), true);
  assert.equal(disabledIds.has("mcp_connection"), true);
  assert.equal(disabledIds.has("api_server_start"), true);
  assert.equal(disabledIds.has("cron_gateway_start"), true);
  assert.equal(disabledIds.has("provider_secret_configuration"), true);
  assert.equal(disabledIds.has("raw_client_vdr_material_access"), true);
  assert.equal(disabledIds.has("direct_zendd_mutation"), true);
  assert.equal(disabledIds.has("agent_final_pass_or_approval"), true);
  assert.equal(result.agent_dry_run_disabled_path_probe_rows.every((row) => row.current_verdict === "blocked"), true);
  assert.equal(result.agent_dry_run_disabled_path_probe_rows.every((row) => row.block_reason), true);
  assert.equal(result.agent_dry_run_disabled_path_probe_rows.every((row) => row.next_allowed_action), true);
});

test("platform agent dry-run simulation exposes operator rows and supported claims", async () => {
  const result = await resultPromise;

  assert.equal(result.agent_dry_run_operator_surface_rows.length, 8);
  assert.equal(result.agent_dry_run_operator_surface_rows.every((row) => row.server_started === false), true);
  assert.equal(result.agent_dry_run_operator_surface_rows.every((row) => row.api_route_registered_now === false), true);
  assert.equal(result.agent_dry_run_claim_rows.length, 46);
  assert.equal(result.agent_dry_run_claim_rows.filter((row) => row.current_verdict === "pass").length, 32);
  assert.equal(result.agent_dry_run_claim_rows.filter((row) => row.current_verdict === "blocked").length, 14);
  assert.equal(result.agent_dry_run_claim_rows.every((row) => row.verdict_authority === "harness_only"), true);
});

test("platform agent dry-run simulation keeps runtime and protected boundaries false", async () => {
  const result = await resultPromise;
  const boundary = result.agent_dry_run_boundary;

  assert.equal(boundary.dry_run_evidence_generation_allowed, true);
  assert.equal(boundary.would_run_only, true);
  assert.equal(boundary.agent_runtime_started, false);
  assert.equal(boundary.command_execution_performed, false);
  assert.equal(boundary.terminal_execution_performed, false);
  assert.equal(boundary.mcp_connection_performed, false);
  assert.equal(boundary.api_server_started, false);
  assert.equal(boundary.cron_gateway_started, false);
  assert.equal(boundary.package_download_performed, false);
  assert.equal(boundary.package_install_performed, false);
  assert.equal(boundary.provider_secret_configured, false);
  assert.equal(boundary.raw_secret_read, false);
  assert.equal(boundary.raw_client_or_vdr_material_exposed, false);
  assert.equal(boundary.direct_zendd_mutation_performed, false);
  assert.equal(boundary.protected_action_executed, false);
  assert.equal(boundary.receipt_applied, false);
  assert.equal(boundary.final_pass_or_approval_allowed_now, false);
  assert.equal(boundary.legal_final_judgment_allowed_now, false);
  assert.equal(boundary.release_decision_allowed_now, false);
  assert.equal(result.summary.unsafe_flag_count, 0);
});

test("platform agent dry-run simulation --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-agent-dry-run-simulation-"));
  const sentinelPath = path.join(outDir, "platform-agent-dry-run-simulation.json");
  const sentinel = "{ \"sentinel\": \"platform-agent-dry-run-simulation\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformAgentDryRunSimulation({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
