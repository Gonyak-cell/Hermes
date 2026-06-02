import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformAgentDomainRollout,
  runPlatformAgentDomainRollout,
} from "../src/platform-agent-domain-rollout.mjs";

const RUN_AT = "2026-06-02T00:00:00.000Z";

test("platform agent domain rollout emits candidate packets for every registered domain", async () => {
  const result = await buildPlatformAgentDomainRollout({ runAt: RUN_AT, write: false });
  const domainIds = new Set(result.domain_agent_rollout_rows.map((row) => row.domain_id));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_agent_domain_rollout_status, "ready_for_agent_domain_rollout");
  assert.equal(result.source_agent_capability_registry_summary.platform_agent_capability_registry_status, "ready_for_agent_capability_registry");
  for (const domainId of ["platform", "personal-dev", "law-firm", "creative-document", "connectors-resource", "trading", "project.zendd"]) {
    assert.equal(domainIds.has(domainId), true, `${domainId} should have a rollout row`);
  }
  assert.equal(result.domain_agent_rollout_rows.every((row) => row.final_pass_by_agent_allowed === false), true);
  assert.equal(result.domain_agent_rollout_rows.every((row) => row.runtime_execution_allowed_now === false), true);
});

test("platform agent domain rollout keeps Zendd as an external adapter bridge", async () => {
  const result = await buildPlatformAgentDomainRollout({ runAt: RUN_AT, write: false });
  const zenddCapabilities = new Set(result.project_zendd_agent_bridge_rows.map((row) => row.capability_name));

  assert.equal(result.project_zendd_agent_bridge_rows.length, 5);
  assert.ok(zenddCapabilities.has("work_order_candidate"));
  assert.ok(zenddCapabilities.has("patch_plan_candidate"));
  assert.ok(zenddCapabilities.has("command_evidence_candidate"));
  assert.ok(zenddCapabilities.has("vdr_ldd_bridge_candidate"));
  assert.ok(zenddCapabilities.has("release_sandbox_candidate"));
  assert.equal(result.project_zendd_agent_bridge_rows.every((row) => row.integration_mode === "external_project_adapter"), true);
  assert.equal(result.project_zendd_agent_bridge_rows.every((row) => row.external_checkout_write_allowed === false), true);
  assert.equal(result.project_zendd_agent_bridge_rows.every((row) => row.raw_vdr_read_allowed === false), true);
});

test("platform agent domain rollout surfaces routes and human gates without starting services", async () => {
  const result = await buildPlatformAgentDomainRollout({ runAt: RUN_AT, write: false });

  assert.equal(result.domain_agent_operator_surface_rows.length, 7);
  assert.equal(result.domain_agent_operator_surface_rows.every((row) => row.server_started === false), true);
  assert.equal(result.domain_agent_operator_surface_rows.every((row) => row.mutation_route_count === 0), true);
  assert.equal(result.domain_agent_human_gate_rows.every((row) => row.receipt_payload_present === false), true);
  assert.equal(result.domain_agent_human_gate_rows.every((row) => row.protected_output_finalization_allowed_now === false), true);
});

test("platform agent domain rollout blocks protected actions and emits supported claims", async () => {
  const result = await buildPlatformAgentDomainRollout({ runAt: RUN_AT, write: false });
  const protectedIds = new Set(result.protected_agent_rollout_block_rows.map((row) => row.protected_action_id));

  for (const protectedId of ["law-firm.legal_final_advice", "trading.live_order_submission", "project.zendd.external_checkout_write", "project.zendd.raw_vdr_read"]) {
    assert.equal(protectedIds.has(protectedId), true, `${protectedId} should be blocked`);
  }
  assert.equal(result.protected_agent_rollout_block_rows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), true);
  assert.equal(result.agent_domain_rollout_claim_rows.every((row) => row.verdict_authority === "harness_only"), true);
  assert.equal(result.agent_domain_rollout_claim_rows.filter((row) => row.current_verdict === "pass").every((row) => row.evidence_ref && row.reviewer_ref && row.hard_gate_ref), true);
  assert.equal(result.agent_domain_rollout_claim_rows.filter((row) => row.current_verdict === "blocked").every((row) => row.block_reason && row.responsible_owner && row.next_allowed_action), true);
  assert.equal(result.agent_domain_rollout_gate_rows.every((row) => row.gate_status === "ready"), true);
});

test("platform agent domain rollout --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-agent-domain-rollout-"));
  const sentinelPath = path.join(outDir, "platform-agent-domain-rollout.json");
  const sentinel = "{ \"sentinel\": \"platform-agent-domain-rollout\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformAgentDomainRollout({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
