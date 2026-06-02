import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformAgentInstallTrustGate,
  runPlatformAgentInstallTrustGate,
} from "../src/platform-agent-install-trust-gate.mjs";

const RUN_AT = "2026-06-02T00:00:00.000Z";

test("platform agent install trust gate records package provenance without install", async () => {
  const result = await buildPlatformAgentInstallTrustGate({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_agent_install_trust_gate_status, "ready_for_agent_install_trust_gate");
  assert.equal(result.source_agent_authority_freeze_summary.platform_agent_authority_freeze_status, "ready_for_agent_authority_freeze");
  assert.equal(result.agent_package_observation.package_name, "hermes-agent");
  assert.equal(result.agent_package_observation.observed_version, "0.15.2");
  assert.equal(result.agent_package_observation.python_requirement, ">=3.11");
  assert.equal(result.agent_package_observation.license, "MIT");
  assert.equal(result.agent_package_observation.pypi_trusted_publishing, true);
  assert.match(result.agent_package_observation.sdist_sha256, /^[a-f0-9]{64}$/);
  assert.match(result.agent_package_observation.wheel_sha256, /^[a-f0-9]{64}$/);
  assert.equal(result.agent_install_trust_policy.install_execution_allowed_now, false);
  assert.equal(result.agent_install_trust_policy.package_download_allowed_now, false);
});

test("platform agent install trust gate partitions safe candidates and unsafe install modes", async () => {
  const result = await buildPlatformAgentInstallTrustGate({ runAt: RUN_AT, write: false });
  const installModes = new Map(result.agent_install_mode_rows.map((row) => [row.install_mode_id, row]));

  for (const modeId of ["pipx", "repo_local_venv", "docker_container"]) {
    const row = installModes.get(modeId);
    assert.equal(row.current_verdict, "pass");
    assert.equal(row.install_execution_allowed_now, false);
    assert.equal(row.package_download_allowed_now, false);
    assert.ok(row.rollback_command_candidate);
    assert.ok(row.human_receipt_ref);
  }

  for (const modeId of ["one_line_git_main_installer", "global_pip_install", "root_or_sudo_install"]) {
    const row = installModes.get(modeId);
    assert.equal(row.current_verdict, "blocked");
    assert.ok(row.block_reason);
    assert.ok(row.next_allowed_action);
  }

  assert.equal(result.agent_install_trust_policy.curl_pipe_bash_allowed_now, false);
  assert.equal(result.agent_install_trust_policy.global_python_mutation_allowed, false);
  assert.equal(result.agent_install_trust_policy.root_or_sudo_install_allowed, false);
});

test("platform agent install trust gate defers doctor smoke until isolated install", async () => {
  const result = await buildPlatformAgentInstallTrustGate({ runAt: RUN_AT, write: false });

  assert.equal(result.agent_smoke_command_rows.length, 5);
  assert.equal(result.agent_smoke_command_rows.every((row) => row.current_verdict === "blocked"), true);
  assert.equal(result.agent_smoke_command_rows.every((row) => row.block_reason === "install_not_yet_performed"), true);
  assert.equal(result.agent_smoke_command_rows.every((row) => row.command_execution_allowed_now === false), true);
  assert.equal(result.agent_smoke_command_rows.every((row) => row.provider_secret_required === false), true);
  assert.ok(result.agent_smoke_command_rows.some((row) => row.command_candidate === "hermes doctor"));
});

test("platform agent install trust gate emits supported claims and rollback candidates", async () => {
  const result = await buildPlatformAgentInstallTrustGate({ runAt: RUN_AT, write: false });

  assert.equal(result.agent_install_rollback_rows.length, result.agent_install_mode_rows.length);
  assert.equal(result.agent_install_rollback_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.agent_install_rollback_rows.every((row) => row.rollback_execution_allowed_now === false), true);
  assert.equal(result.agent_install_trust_claim_rows.every((row) => row.verdict_authority === "harness_only"), true);
  assert.equal(result.agent_install_trust_claim_rows.filter((row) => row.current_verdict === "pass").every((row) => row.evidence_ref && row.reviewer_ref && row.hard_gate_ref), true);
  assert.equal(result.agent_install_trust_claim_rows.filter((row) => row.current_verdict === "blocked").every((row) => row.block_reason && row.responsible_owner && row.next_allowed_action), true);
  assert.equal(result.agent_install_trust_closeout_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.agent_install_trust_gate_rows.every((row) => row.gate_status === "ready"), true);
});

test("platform agent install trust gate --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-agent-install-trust-gate-"));
  const sentinelPath = path.join(outDir, "platform-agent-install-trust-gate.json");
  const sentinel = "{ \"sentinel\": \"platform-agent-install-trust-gate\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformAgentInstallTrustGate({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
