import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformAgentZenddCandidateBridge,
  runPlatformAgentZenddCandidateBridge,
} from "../src/platform-agent-zendd-candidate-bridge.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";
const resultPromise = buildPlatformAgentZenddCandidateBridge({ runAt: RUN_AT, write: false });

test("platform agent Zendd candidate bridge consumes adapter SDK and Zendd sources", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_agent_zendd_candidate_bridge_status, "ready_for_agent_zendd_candidate_bridge");
  assert.equal(result.summary.source_agent_domain_adapter_sdk_status, "ready_for_agent_domain_adapter_sdk");
  assert.equal(result.summary.source_zendd_work_order_intake_status, "ready_for_zendd_work_order_intake");
  assert.equal(result.summary.source_zendd_safe_patch_lane_status, "ready_for_zendd_safe_patch_lane");
  assert.equal(result.summary.source_zendd_command_evidence_execution_bridge_status, "ready_for_zendd_command_evidence_execution_bridge");
  assert.equal(result.summary.source_zendd_vdr_ldd_workflow_adapter_status, "ready_for_zendd_vdr_ldd_workflow_adapter");
  assert.equal(result.summary.source_zendd_release_candidate_sandbox_status, "ready_for_zendd_release_candidate_sandbox");
  assert.equal(result.summary.source_zendd_actual_checkout_preflight_status, "ready_for_zendd_actual_checkout_preflight");
});

test("platform agent Zendd candidate bridge emits five candidate packet types", async () => {
  const result = await resultPromise;
  const packetTypes = new Set(result.agent_zendd_candidate_packet_rows.map((row) => row.candidate_packet_type));

  assert.equal(result.agent_zendd_candidate_packet_rows.length, 5);
  assert.equal(packetTypes.has("work_order_candidate"), true);
  assert.equal(packetTypes.has("patch_plan_candidate"), true);
  assert.equal(packetTypes.has("command_evidence_candidate"), true);
  assert.equal(packetTypes.has("vdr_ldd_candidate"), true);
  assert.equal(packetTypes.has("release_sandbox_candidate"), true);
  assert.equal(result.agent_zendd_candidate_packet_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.agent_zendd_candidate_packet_rows.every((row) => row.packet_status === "candidate_visible_not_executable"), true);
});

test("platform agent Zendd candidate bridge binds packets through the project.zendd adapter contract", async () => {
  const result = await resultPromise;

  assert.equal(result.agent_zendd_candidate_binding_rows.length, 5);
  assert.equal(result.agent_zendd_candidate_binding_rows.every((row) => row.source_refs_bound === true), true);
  assert.equal(result.agent_zendd_candidate_binding_rows.every((row) => row.forbidden_input_scan_required === true), true);
  assert.equal(result.agent_zendd_candidate_binding_rows.every((row) => row.output_sanitization_required === true), true);
  assert.equal(result.agent_zendd_candidate_binding_rows.every((row) => row.claim_evidence_reviewer_gate_binding_required === true), true);
  assert.equal(result.agent_zendd_candidate_binding_rows.every((row) => row.human_receipt_requirement_bound === true), true);
  assert.equal(result.agent_zendd_candidate_operator_rows.length, 5);
  assert.equal(result.agent_zendd_candidate_operator_rows.every((row) => row.missing_human_receipt_refs.length === 1), true);
});

test("platform agent Zendd candidate bridge documents protected blocks and supported claims", async () => {
  const result = await resultPromise;
  const blockIds = new Set(result.agent_zendd_candidate_protected_block_rows.map((row) => row.protected_block_id));

  assert.equal(result.agent_zendd_candidate_protected_block_rows.length, 10);
  assert.equal(blockIds.has("direct_zendd_write"), true);
  assert.equal(blockIds.has("zendd_source_tree_movement"), true);
  assert.equal(blockIds.has("command_execution_now"), true);
  assert.equal(blockIds.has("terminal_execution_now"), true);
  assert.equal(blockIds.has("raw_client_vdr_exposure"), true);
  assert.equal(blockIds.has("protected_output_finalization"), true);
  assert.equal(blockIds.has("agent_final_pass_now"), true);
  assert.equal(result.agent_zendd_candidate_claim_rows.length, 25);
  assert.equal(result.agent_zendd_candidate_claim_rows.filter((row) => row.current_verdict === "pass").length, 15);
  assert.equal(result.agent_zendd_candidate_claim_rows.filter((row) => row.current_verdict === "blocked").length, 10);
  assert.equal(result.agent_zendd_candidate_claim_rows.every((row) => row.verdict_authority === "harness_only"), true);
});

test("platform agent Zendd candidate bridge preserves external adapter and disables unsafe actions", async () => {
  const result = await resultPromise;
  const boundary = result.agent_zendd_candidate_boundary;

  assert.equal(boundary.selected_integration_mode, "external_project_adapter");
  assert.equal(boundary.agent_runtime_execution_allowed_now, false);
  assert.equal(boundary.command_execution_allowed_now, false);
  assert.equal(boundary.terminal_execution_allowed_now, false);
  assert.equal(boundary.mcp_connection_allowed_now, false);
  assert.equal(boundary.direct_zendd_mutation_allowed_now, false);
  assert.equal(boundary.zendd_source_tree_movement_allowed_now, false);
  assert.equal(boundary.zendd_file_write_allowed_now, false);
  assert.equal(boundary.raw_secret_exposed, false);
  assert.equal(boundary.raw_client_or_vdr_material_exposed, false);
  assert.equal(boundary.protected_output_finalization_allowed_now, false);
  assert.equal(boundary.release_publish_allowed_now, false);
  assert.equal(boundary.receipt_application_allowed_now, false);
  assert.equal(boundary.agent_final_pass_allowed_now, false);
  assert.equal(result.summary.unsafe_flag_count, 0);
});

test("platform agent Zendd candidate bridge --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-agent-zendd-candidate-bridge-"));
  const sentinelPath = path.join(outDir, "platform-agent-zendd-candidate-bridge.json");
  const sentinel = "{ \"sentinel\": \"platform-agent-zendd-candidate-bridge\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformAgentZenddCandidateBridge({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
