import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformAgentRuntimeActivationBridge,
  runPlatformAgentRuntimeActivationBridge,
} from "../src/platform-agent-runtime-activation-bridge.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";
const resultPromise = buildPlatformAgentRuntimeActivationBridge({ runAt: RUN_AT, write: false });

test("platform agent runtime activation bridge consumes the P1200 source freeze", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_agent_runtime_activation_bridge_status, "ready_for_agent_runtime_activation_bridge");
  assert.equal(result.summary.source_runtime_pilot_freeze_status, "ready_for_human_approved_agent_runtime_pilot");
  assert.equal(result.agent_runtime_activation_phase_rows.length, 6);
  assert.equal(result.agent_runtime_activation_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("platform agent runtime activation bridge creates receipt templates without payloads", async () => {
  const result = await resultPromise;
  const receiptClasses = new Set(result.agent_runtime_activation_receipt_template_rows.map((row) => row.receipt_class_id));

  assert.equal(result.agent_runtime_activation_receipt_template_rows.length, 14);
  assert.equal(receiptClasses.has("install_execution"), true);
  assert.equal(receiptClasses.has("runtime_start"), true);
  assert.equal(receiptClasses.has("zendd_action"), true);
  assert.equal(receiptClasses.has("release_legal_final_authority"), true);
  assert.equal(result.agent_runtime_activation_receipt_template_rows.every((row) => row.human_receipt_required === true), true);
  assert.equal(result.agent_runtime_activation_receipt_template_rows.every((row) => row.receipt_payload_present === false), true);
  assert.equal(result.agent_runtime_activation_receipt_template_rows.every((row) => row.receipt_applied === false), true);
  assert.equal(result.agent_runtime_activation_receipt_quarantine_rows.every((row) => row.current_verdict === "blocked"), true);
});

test("platform agent runtime activation bridge defines install and doctor lanes without execution", async () => {
  const result = await resultPromise;
  const installModes = new Set(result.agent_runtime_activation_install_lane_rows.map((row) => row.install_mode_id));

  assert.equal(result.agent_runtime_activation_install_lane_rows.length, 6);
  assert.equal(installModes.has("repo_local_venv"), true);
  assert.equal(installModes.has("pipx"), true);
  assert.equal(installModes.has("docker"), true);
  assert.equal(result.summary.safe_install_candidate_count, 3);
  assert.equal(result.summary.blocked_install_mode_count, 3);
  assert.equal(result.agent_runtime_activation_install_lane_rows.every((row) => row.package_download_performed === false), true);
  assert.equal(result.agent_runtime_activation_install_lane_rows.every((row) => row.package_install_performed === false), true);
  assert.equal(result.agent_runtime_activation_doctor_evidence_rows.length, 5);
  assert.equal(result.agent_runtime_activation_doctor_evidence_rows.every((row) => row.command_execution_performed === false), true);
  assert.equal(result.agent_runtime_activation_doctor_evidence_rows.every((row) => row.raw_stdout_stored === false && row.raw_stderr_stored === false), true);
});

test("platform agent runtime activation bridge exposes L0 adapters and Zendd no-write packets", async () => {
  const result = await resultPromise;
  const domains = new Set(result.agent_runtime_activation_l0_adapter_rows.map((row) => row.domain_id));
  const zenddPackets = new Set(result.agent_runtime_activation_zendd_no_write_rows.map((row) => row.packet_type));

  assert.equal(result.agent_runtime_activation_l0_adapter_rows.length, 7);
  assert.equal(domains.has("platform"), true);
  assert.equal(domains.has("law-firm"), true);
  assert.equal(domains.has("project.zendd"), true);
  assert.equal(result.agent_runtime_activation_l0_adapter_rows.every((row) => row.rollout_level === "L0"), true);
  assert.equal(result.agent_runtime_activation_l0_adapter_rows.every((row) => row.file_write_allowed_now === false), true);
  assert.equal(result.agent_runtime_activation_zendd_no_write_rows.length, 6);
  assert.equal(zenddPackets.has("work_order_candidate"), true);
  assert.equal(zenddPackets.has("diff_review_candidate"), true);
  assert.equal(zenddPackets.has("rollback_plan_candidate"), true);
  assert.equal(result.agent_runtime_activation_zendd_no_write_rows.every((row) => row.file_write_performed === false), true);
  assert.equal(result.agent_runtime_activation_zendd_no_write_rows.every((row) => row.raw_vdr_or_client_material_accessed === false), true);
});

test("platform agent runtime activation bridge keeps protected runtime paths blocked", async () => {
  const result = await resultPromise;
  const blockIds = new Set(result.agent_runtime_activation_protected_block_rows.map((row) => row.protected_block_id));

  assert.equal(result.agent_runtime_activation_protected_block_rows.length, 15);
  assert.equal(blockIds.has("missing_receipt_runtime"), true);
  assert.equal(blockIds.has("missing_install_evidence"), true);
  assert.equal(blockIds.has("direct_zendd_mutation"), true);
  assert.equal(blockIds.has("agent_final_pass"), true);
  assert.equal(result.agent_runtime_activation_protected_block_rows.every((row) => row.current_verdict === "blocked"), true);
  assert.equal(result.agent_runtime_activation_protected_block_rows.every((row) => row.documented_human_gate_ref), true);
});

test("platform agent runtime activation bridge closes claims, gates, and safety boundary", async () => {
  const result = await resultPromise;
  const boundary = result.agent_runtime_activation_boundary;

  assert.equal(result.agent_runtime_activation_freeze_rows.length, 12);
  assert.equal(result.agent_runtime_activation_freeze_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.agent_runtime_activation_gate_rows.every((row) => row.gate_status === "ready"), true);
  assert.equal(result.agent_runtime_activation_claim_rows.every((row) => row.verdict_authority === "harness_only"), true);
  assert.equal(result.agent_runtime_activation_claim_rows.filter((row) => row.current_verdict === "blocked").length, 18);
  assert.equal(boundary.activation_bridge_ready_for_future_receipt, true);
  assert.equal(boundary.receipt_payload_present, false);
  assert.equal(boundary.package_install_performed, false);
  assert.equal(boundary.doctor_smoke_execution_performed, false);
  assert.equal(boundary.agent_runtime_execution_allowed_now, false);
  assert.equal(boundary.direct_zendd_mutation_allowed_now, false);
  assert.equal(boundary.protected_action_execution_allowed_now, false);
  assert.equal(boundary.agent_final_pass_allowed_now, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("platform agent runtime activation bridge --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-agent-runtime-activation-bridge-"));
  const sentinelPath = path.join(outDir, "platform-agent-runtime-activation-bridge.json");
  const sentinel = "{ \"sentinel\": \"platform-agent-runtime-activation-bridge\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformAgentRuntimeActivationBridge({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
