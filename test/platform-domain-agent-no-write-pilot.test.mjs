import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPlatformAgentRuntimeActivationBridge } from "../src/platform-agent-runtime-activation-bridge.mjs";
import {
  buildPlatformDomainAgentNoWritePilot,
  runPlatformDomainAgentNoWritePilot,
} from "../src/platform-domain-agent-no-write-pilot.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";
const activationBridgePromise = buildPlatformAgentRuntimeActivationBridge({ runAt: RUN_AT, write: false });
const resultPromise = activationBridgePromise.then((sourceActivationBridge) => buildPlatformDomainAgentNoWritePilot({
  runAt: RUN_AT,
  write: false,
  sourceActivationBridge,
}));

test("domain Agent no-write pilot consumes the activation bridge", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_domain_agent_no_write_pilot_status, "ready_for_agent_domain_no_write_pilot_freeze");
  assert.equal(result.summary.source_activation_bridge_status, "ready_for_agent_runtime_activation_bridge");
  assert.equal(result.domain_agent_no_write_phase_rows.length, 6);
  assert.equal(result.domain_agent_no_write_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("domain Agent no-write pilot covers every current no-write domain", async () => {
  const result = await resultPromise;
  const domains = new Set(result.domain_agent_no_write_domain_rows.map((row) => row.domain_id));

  assert.equal(result.domain_agent_no_write_domain_rows.length, 6);
  assert.equal(domains.has("personal-dev"), true);
  assert.equal(domains.has("law-firm"), true);
  assert.equal(domains.has("creative-document"), true);
  assert.equal(domains.has("connectors-resource"), true);
  assert.equal(domains.has("trading"), true);
  assert.equal(domains.has("project.zendd"), true);
  assert.equal(result.domain_agent_no_write_domain_rows.every((row) => row.runtime_execution_allowed_now === false), true);
  assert.equal(result.domain_agent_no_write_domain_rows.every((row) => row.write_action_allowed_now === false), true);
});

test("domain Agent no-write pilot creates domain capability candidates", async () => {
  const result = await resultPromise;
  const capabilityIds = new Set(result.domain_agent_no_write_capability_rows.map((row) => `${row.domain_id}.${row.capability_id}`));

  assert.equal(result.domain_agent_no_write_capability_rows.length, 32);
  assert.equal(capabilityIds.has("personal-dev.diff_review_candidate"), true);
  assert.equal(capabilityIds.has("law-firm.vdr_ldd_candidate"), true);
  assert.equal(capabilityIds.has("creative-document.export_review_candidate"), true);
  assert.equal(capabilityIds.has("connectors-resource.quarantine_packet_candidate"), true);
  assert.equal(capabilityIds.has("trading.backtest_review_candidate"), true);
  assert.equal(capabilityIds.has("project.zendd.command_evidence_candidate"), true);
  assert.equal(result.domain_agent_no_write_capability_rows.every((row) => row.file_write_allowed_now === false), true);
  assert.equal(result.domain_agent_no_write_capability_rows.every((row) => row.final_pass_by_agent_allowed_now === false), true);
});

test("domain Agent no-write pilot binds human gates and no-write boundaries", async () => {
  const result = await resultPromise;

  assert.equal(result.domain_agent_no_write_human_gate_rows.length, 6);
  assert.equal(result.domain_agent_no_write_human_gate_rows.every((row) => row.human_review_required === true), true);
  assert.equal(result.domain_agent_no_write_human_gate_rows.every((row) => row.receipt_payload_present === false), true);
  assert.equal(result.domain_agent_no_write_boundary_rows.length, 6);
  assert.equal(result.domain_agent_no_write_boundary_rows.every((row) => row.file_write_allowed_now === false), true);
  assert.equal(result.domain_agent_no_write_boundary_rows.every((row) => row.raw_secret_read_allowed_now === false), true);
  assert.equal(result.domain_agent_no_write_boundary_rows.every((row) => row.direct_zendd_mutation_allowed_now === false), true);
});

test("domain Agent no-write pilot blocks protected domain actions", async () => {
  const result = await resultPromise;
  const blockIds = new Set(result.domain_agent_no_write_protected_block_rows.map((row) => row.protected_block_id));

  assert.equal(result.domain_agent_no_write_protected_block_rows.length, 20);
  assert.equal(blockIds.has("personal-dev.pr_create"), true);
  assert.equal(blockIds.has("law-firm.legal_final_pass"), true);
  assert.equal(blockIds.has("connectors-resource.secret_read"), true);
  assert.equal(blockIds.has("trading.live_order"), true);
  assert.equal(blockIds.has("project.zendd.direct_write"), true);
  assert.equal(blockIds.has("platform.agent_final_pass"), true);
  assert.equal(result.domain_agent_no_write_protected_block_rows.every((row) => row.current_verdict === "blocked"), true);
  assert.equal(result.domain_agent_no_write_protected_block_rows.every((row) => row.action_allowed_now === false), true);
});

test("domain Agent no-write pilot closes claims, gates, and safety boundary", async () => {
  const result = await resultPromise;
  const boundary = result.domain_agent_no_write_boundary;

  assert.equal(result.domain_agent_no_write_freeze_rows.length, 12);
  assert.equal(result.domain_agent_no_write_gate_rows.length, 13);
  assert.equal(result.domain_agent_no_write_claim_rows.length, 88);
  assert.equal(result.summary.pass_claim_count, 68);
  assert.equal(result.summary.blocked_claim_count, 20);
  assert.equal(result.domain_agent_no_write_gate_rows.every((row) => row.gate_status === "ready"), true);
  assert.equal(boundary.domain_no_write_pilot_ready_for_operator_visibility, true);
  assert.equal(boundary.receipt_payload_present, false);
  assert.equal(boundary.agent_runtime_execution_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.direct_zendd_mutation_allowed_now, false);
  assert.equal(boundary.legal_final_judgment_allowed_now, false);
  assert.equal(boundary.live_trading_action_allowed_now, false);
  assert.equal(boundary.agent_final_pass_allowed_now, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("domain Agent no-write pilot --check does not overwrite existing artifacts", async () => {
  const sourceActivationBridge = await activationBridgePromise;
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-domain-agent-no-write-pilot-"));
  const sentinelPath = path.join(outDir, "platform-domain-agent-no-write-pilot.json");
  const sentinel = "{ \"sentinel\": \"platform-domain-agent-no-write-pilot\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformDomainAgentNoWritePilot({
      runAt: RUN_AT,
      outDir,
      check: true,
      write: false,
      sourceActivationBridge,
    });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
