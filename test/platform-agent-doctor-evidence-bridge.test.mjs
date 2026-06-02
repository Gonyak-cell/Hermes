import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformAgentDoctorEvidenceBridge,
  runPlatformAgentDoctorEvidenceBridge,
} from "../src/platform-agent-doctor-evidence-bridge.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";

test("platform agent doctor evidence bridge consumes install packet source", async () => {
  const result = await buildPlatformAgentDoctorEvidenceBridge({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_agent_doctor_evidence_bridge_status, "ready_for_agent_doctor_evidence_bridge");
  assert.equal(result.summary.source_install_packet_status, "ready_for_agent_install_packet");
  assert.equal(result.source_agent_install_packet_summary.install_performed, false);
  assert.equal(result.source_agent_install_packet_summary.command_execution_performed, false);
});

test("platform agent doctor evidence bridge creates future output templates only", async () => {
  const result = await buildPlatformAgentDoctorEvidenceBridge({ runAt: RUN_AT, write: false });
  const smokeIds = new Set(result.agent_doctor_evidence_template_rows.map((row) => row.smoke_id));

  assert.equal(result.agent_doctor_evidence_template_rows.length, 5);
  assert.equal(smokeIds.has("version_probe"), true);
  assert.equal(smokeIds.has("doctor_probe"), true);
  assert.equal(smokeIds.has("tool_policy_probe"), true);
  assert.equal(result.agent_doctor_evidence_template_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.agent_doctor_evidence_template_rows.every((row) => row.raw_stdout_storage_allowed === false && row.output_hash_required === true), true);
});

test("platform agent doctor evidence bridge blocks probes and output bindings", async () => {
  const result = await buildPlatformAgentDoctorEvidenceBridge({ runAt: RUN_AT, write: false });

  assert.equal(result.agent_doctor_probe_gate_rows.length, 5);
  assert.equal(result.agent_doctor_probe_gate_rows.every((row) => row.current_verdict === "blocked" && row.block_reason === "install_not_yet_performed"), true);
  assert.equal(result.agent_doctor_probe_gate_rows.every((row) => row.command_execution_allowed_now === false && row.runtime_started === false), true);
  assert.equal(result.agent_doctor_output_binding_rows.length, 5);
  assert.equal(result.agent_doctor_output_binding_rows.every((row) => row.current_verdict === "blocked" && row.block_reason === "missing_doctor_output"), true);
  assert.equal(result.agent_doctor_output_binding_rows.every((row) => row.output_payload_present === false && row.raw_stdout_stored === false), true);
});

test("platform agent doctor evidence bridge keeps safety rules and claims supported", async () => {
  const result = await buildPlatformAgentDoctorEvidenceBridge({ runAt: RUN_AT, write: false });

  assert.equal(result.agent_doctor_evidence_safety_rows.length, 8);
  assert.equal(result.agent_doctor_evidence_safety_rows.every((row) => row.current_verdict === "pass" && row.agent_final_pass_allowed_now === false), true);
  assert.equal(result.agent_doctor_evidence_claim_rows.length, 23);
  assert.equal(result.agent_doctor_evidence_claim_rows.filter((row) => row.current_verdict === "pass").length, 13);
  assert.equal(result.agent_doctor_evidence_claim_rows.filter((row) => row.current_verdict === "blocked").length, 10);
  assert.equal(result.agent_doctor_evidence_claim_rows.every((row) => row.verdict_authority === "harness_only"), true);
  assert.equal(result.agent_doctor_evidence_gate_rows.every((row) => row.gate_status === "ready"), true);
  assert.equal(result.agent_doctor_evidence_boundary.command_execution_performed, false);
  assert.equal(result.agent_doctor_evidence_boundary.raw_secret_exposed, false);
});

test("platform agent doctor evidence bridge --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-agent-doctor-evidence-bridge-"));
  const sentinelPath = path.join(outDir, "platform-agent-doctor-evidence-bridge.json");
  const sentinel = "{ \"sentinel\": \"platform-agent-doctor-evidence-bridge\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformAgentDoctorEvidenceBridge({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
