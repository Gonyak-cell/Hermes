import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformAgentIsolatedInstallGate,
  runPlatformAgentIsolatedInstallGate,
} from "../src/platform-agent-isolated-install-gate.mjs";

const RUN_AT = "2026-06-02T00:00:00.000Z";

test("platform agent isolated install gate selects repo-local venv without executing install", async () => {
  const result = await buildPlatformAgentIsolatedInstallGate({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_agent_isolated_install_gate_status, "ready_for_agent_isolated_install_gate");
  assert.equal(result.source_agent_install_trust_gate_summary.platform_agent_install_trust_gate_status, "ready_for_agent_install_trust_gate");
  assert.equal(result.agent_isolated_install_policy.selected_install_mode, "repo_local_venv");
  assert.equal(result.agent_isolated_install_policy.install_execution_allowed_now, false);
  assert.equal(result.agent_isolated_install_policy.package_download_allowed_now, false);
  assert.equal(result.agent_isolated_install_policy.command_execution_allowed_now, false);
  assert.equal(result.agent_isolated_install_policy.human_receipt_required_before_install, true);
  assert.equal(result.agent_isolated_install_policy.human_receipt_present, false);
});

test("platform agent isolated install gate blocks all protected install execution until receipt", async () => {
  const result = await buildPlatformAgentIsolatedInstallGate({ runAt: RUN_AT, write: false });
  const selected = result.agent_isolated_install_selection_rows.find((row) => row.selected);

  assert.equal(selected.install_mode_id, "repo_local_venv");
  assert.equal(selected.current_verdict, "pass");
  assert.equal(result.agent_isolated_install_execution_rows.length, 3);
  assert.equal(result.agent_isolated_install_execution_rows.every((row) => row.current_verdict === "blocked"), true);
  assert.equal(result.agent_isolated_install_execution_rows.every((row) => row.block_reason === "missing_human_receipt"), true);
  assert.equal(result.agent_isolated_install_execution_rows.every((row) => row.command_execution_performed === false), true);
  assert.equal(result.agent_isolated_install_execution_rows.every((row) => row.package_install_performed === false), true);
  assert.equal(result.agent_isolated_install_execution_rows.every((row) => row.human_receipt_ref), true);
});

test("platform agent isolated install gate rewrites doctor smoke commands for repo-local venv and defers them", async () => {
  const result = await buildPlatformAgentIsolatedInstallGate({ runAt: RUN_AT, write: false });

  assert.equal(result.agent_doctor_smoke_plan_rows.length, 5);
  assert.equal(result.agent_doctor_smoke_plan_rows.every((row) => row.install_mode_id === "repo_local_venv"), true);
  assert.equal(result.agent_doctor_smoke_plan_rows.every((row) => row.current_verdict === "blocked"), true);
  assert.equal(result.agent_doctor_smoke_plan_rows.every((row) => row.block_reason === "install_not_yet_performed"), true);
  assert.equal(result.agent_doctor_smoke_plan_rows.every((row) => row.command_execution_allowed_now === false), true);
  assert.ok(result.agent_doctor_smoke_plan_rows.some((row) => row.command_candidate === ".hermes-agent-venv/bin/hermes doctor"));
});

test("platform agent isolated install gate emits receipt templates, rollback bindings, and supported claims", async () => {
  const result = await buildPlatformAgentIsolatedInstallGate({ runAt: RUN_AT, write: false });

  assert.equal(result.agent_isolated_install_receipt_template_rows.length, 3);
  assert.equal(result.agent_isolated_install_receipt_template_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.agent_isolated_install_receipt_template_rows.every((row) => row.receipt_payload_present === false), true);
  assert.equal(result.agent_install_rollback_binding_rows.length, 3);
  assert.equal(result.agent_install_rollback_binding_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.agent_install_rollback_binding_rows.every((row) => row.rollback_execution_allowed_now === false), true);
  assert.equal(result.agent_isolated_install_claim_rows.every((row) => row.verdict_authority === "harness_only"), true);
  assert.equal(result.agent_isolated_install_claim_rows.filter((row) => row.current_verdict === "pass").every((row) => row.evidence_ref && row.reviewer_ref && row.hard_gate_ref), true);
  assert.equal(result.agent_isolated_install_claim_rows.filter((row) => row.current_verdict === "blocked").every((row) => row.block_reason && row.responsible_owner && row.next_allowed_action), true);
  assert.equal(result.agent_isolated_install_gate_rows.every((row) => row.gate_status === "ready"), true);
});

test("platform agent isolated install gate --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-agent-isolated-install-gate-"));
  const sentinelPath = path.join(outDir, "platform-agent-isolated-install-gate.json");
  const sentinel = "{ \"sentinel\": \"platform-agent-isolated-install-gate\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformAgentIsolatedInstallGate({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
