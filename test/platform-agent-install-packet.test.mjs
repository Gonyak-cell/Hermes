import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformAgentInstallPacket,
  runPlatformAgentInstallPacket,
} from "../src/platform-agent-install-packet.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";

test("platform agent install packet consumes runtime receipt and isolated install sources", async () => {
  const result = await buildPlatformAgentInstallPacket({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_agent_install_packet_status, "ready_for_agent_install_packet");
  assert.equal(result.summary.source_runtime_receipt_contract_status, "ready_for_agent_runtime_receipt_contract");
  assert.equal(result.summary.source_isolated_install_gate_status, "ready_for_agent_isolated_install_gate");
  assert.equal(result.agent_install_packet_gate_rows.every((row) => row.gate_status === "ready"), true);
});

test("platform agent install packet prepares three install plans without materialization", async () => {
  const result = await buildPlatformAgentInstallPacket({ runAt: RUN_AT, write: false });
  const modes = new Set(result.agent_install_packet_rows.map((row) => row.install_mode_id));

  assert.equal(result.agent_install_packet_rows.length, 3);
  assert.equal(modes.has("repo_local_venv"), true);
  assert.equal(modes.has("pipx"), true);
  assert.equal(modes.has("docker_container"), true);
  assert.equal(result.agent_install_packet_rows.filter((row) => row.selected).length, 1);
  assert.equal(result.agent_install_packet_rows.every((row) => row.current_verdict === "pass" && row.packet_materialized === false), true);
  assert.equal(result.agent_install_packet_evidence_rows.every((row) => row.current_verdict === "pass" && row.evidence_status === "ready_as_metadata_only"), true);
});

test("platform agent install packet blocks packet files, downloads, and install execution", async () => {
  const result = await buildPlatformAgentInstallPacket({ runAt: RUN_AT, write: false });

  assert.equal(result.agent_install_packet_materialization_rows.length, 3);
  assert.equal(result.agent_install_packet_materialization_rows.every((row) => row.current_verdict === "blocked" && row.block_reason === "install_packet_not_approved"), true);
  assert.equal(result.agent_install_packet_materialization_rows.every((row) => row.file_write_performed === false && row.package_download_performed === false), true);
  assert.equal(result.agent_install_packet_execution_rows.length, 3);
  assert.equal(result.agent_install_packet_execution_rows.every((row) => row.current_verdict === "blocked" && row.block_reason === "missing_validated_human_receipt"), true);
  assert.equal(result.agent_install_packet_execution_rows.every((row) => row.install_execution_allowed_now === false && row.package_install_performed === false), true);
});

test("platform agent install packet defers doctor probes and supports all claims", async () => {
  const result = await buildPlatformAgentInstallPacket({ runAt: RUN_AT, write: false });

  assert.equal(result.agent_install_packet_doctor_preflight_rows.length, 5);
  assert.equal(result.agent_install_packet_doctor_preflight_rows.every((row) => row.current_verdict === "blocked" && row.block_reason === "install_not_yet_performed"), true);
  assert.equal(result.agent_install_packet_doctor_preflight_rows.every((row) => row.command_execution_allowed_now === false && row.raw_stdout_storage_allowed === false), true);
  assert.equal(result.agent_install_packet_rollback_rows.length, 3);
  assert.equal(result.agent_install_packet_rollback_rows.every((row) => row.current_verdict === "pass" && row.rollback_execution_allowed_now === false), true);
  assert.equal(result.agent_install_packet_claim_rows.length, 20);
  assert.equal(result.agent_install_packet_claim_rows.filter((row) => row.current_verdict === "pass").length, 9);
  assert.equal(result.agent_install_packet_claim_rows.filter((row) => row.current_verdict === "blocked").length, 11);
  assert.equal(result.agent_install_packet_claim_rows.every((row) => row.verdict_authority === "harness_only"), true);
  assert.equal(result.agent_install_packet_boundary.install_execution_performed, false);
  assert.equal(result.agent_install_packet_boundary.raw_secret_exposed, false);
});

test("platform agent install packet --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-agent-install-packet-"));
  const sentinelPath = path.join(outDir, "platform-agent-install-packet.json");
  const sentinel = "{ \"sentinel\": \"platform-agent-install-packet\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformAgentInstallPacket({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
