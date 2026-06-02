import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformAgentAuthorityFreeze,
  runPlatformAgentAuthorityFreeze,
} from "../src/platform-agent-authority-freeze.mjs";

const RUN_AT = "2026-06-02T00:00:00.000Z";

test("platform agent authority freeze inventories the general Hermes Agent feature set", async () => {
  const result = await buildPlatformAgentAuthorityFreeze({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_agent_authority_freeze_status, "ready_for_agent_authority_freeze");
  assert.equal(result.agent_authority_policy.verdict_authority, "harness_only");
  assert.equal(result.agent_authority_policy.install_execution_allowed_now, false);
  assert.equal(result.agent_authority_policy.runtime_execution_allowed_now, false);

  const featureIds = new Set(result.agent_feature_inventory_rows.map((row) => row.feature_id));
  for (const featureId of [
    "installation",
    "cli_tui",
    "toolsets",
    "terminal_backends",
    "profiles",
    "skills",
    "memory",
    "context_files",
    "mcp",
    "delegation_subagents",
    "cron_gateway",
    "api_server",
    "checkpoints_rollback",
    "browser_web",
    "supply_chain_advisory",
  ]) {
    assert.equal(featureIds.has(featureId), true, `${featureId} should be inventoried`);
  }

  assert.ok(result.agent_official_source_rows.some((row) => row.source_id === "nousresearch_hermes_agent_github"));
  assert.ok(result.agent_official_source_rows.some((row) => row.source_id === "hermes_agent_security_docs"));
  assert.ok(result.agent_feature_inventory_rows.every((row) => row.current_verdict === "pass" && row.evidence_ref && row.hard_gate_ref));
});

test("platform agent authority freeze blocks unsafe Agent authority and protected outputs", async () => {
  const result = await buildPlatformAgentAuthorityFreeze({ runAt: RUN_AT, write: false });
  const blockedRules = result.agent_authority_rule_rows.filter((row) => row.current_verdict === "blocked");
  const blockedRuleIds = new Set(blockedRules.map((row) => row.authority_rule_id));

  for (const ruleId of [
    "direct_pass_authority",
    "direct_approval_authority",
    "release_or_deploy_authority",
    "legal_final_judgment",
    "protected_output_without_receipt",
    "raw_secret_access",
    "raw_client_or_vdr_exposure",
    "yolo_or_approval_off",
    "secret_forwarding",
    "direct_zendd_mutation",
  ]) {
    assert.equal(blockedRuleIds.has(ruleId), true, `${ruleId} should be blocked`);
  }

  assert.equal(blockedRules.every((row) => row.block_reason && row.responsible_owner && row.next_allowed_action), true);
  assert.equal(result.agent_authority_rule_rows.every((row) => row.agent_may_create_final_pass === false), true);
  assert.equal(result.agent_authority_rule_rows.every((row) => row.agent_may_apply_human_receipt === false), true);
  assert.equal(result.agent_authority_rule_rows.every((row) => row.agent_may_execute_protected_action === false), true);
  assert.equal(result.agent_authority_policy.yolo_mode_allowed, false);
  assert.equal(result.agent_authority_policy.approval_off_allowed, false);
  assert.equal(result.agent_authority_policy.secret_forwarding_allowed, false);
});

test("platform agent authority freeze seeds expandable domain scopes", async () => {
  const result = await buildPlatformAgentAuthorityFreeze({ runAt: RUN_AT, write: false });
  const domainIds = new Set(result.domain_agent_scope_seed_rows.map((row) => row.domain_id));

  for (const domainId of [
    "platform",
    "personal-dev",
    "law-firm",
    "creative-document",
    "connectors-resource",
    "trading",
    "project.zendd",
  ]) {
    assert.equal(domainIds.has(domainId), true, `${domainId} should have a domain scope seed`);
  }

  assert.equal(result.domain_agent_scope_seed_rows.every((row) => row.initial_rollout_level === "L0"), true);
  assert.equal(result.domain_agent_scope_seed_rows.every((row) => row.max_planned_rollout_level === "L5"), true);
  assert.equal(result.domain_agent_scope_seed_rows.every((row) => row.capability_registry_required), true);
  assert.equal(result.domain_agent_scope_seed_rows.every((row) => row.verdict_authority === "harness_only"), true);
  assert.ok(result.domain_agent_scope_seed_rows.find((row) => row.domain_id === "project.zendd").planned_capabilities.includes("patch_plan"));
});

test("platform agent authority freeze supports only PASS or documented BLOCK claims", async () => {
  const result = await buildPlatformAgentAuthorityFreeze({ runAt: RUN_AT, write: false });

  assert.ok(result.agent_authority_claim_rows.length >= 30);
  assert.equal(result.agent_authority_claim_rows.every((row) => row.verdict_authority === "harness_only"), true);
  assert.equal(result.agent_authority_claim_rows.filter((row) => row.current_verdict === "pass").every((row) => row.evidence_ref && row.reviewer_ref && row.hard_gate_ref), true);
  assert.equal(result.agent_authority_claim_rows.filter((row) => row.current_verdict === "blocked").every((row) => row.block_reason && row.responsible_owner && row.next_allowed_action), true);
  assert.equal(result.agent_authority_closeout_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.agent_authority_gate_rows.every((row) => row.gate_status === "ready"), true);
});

test("platform agent authority freeze --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-agent-authority-freeze-"));
  const sentinelPath = path.join(outDir, "platform-agent-authority-freeze.json");
  const sentinel = "{ \"sentinel\": \"platform-agent-authority-freeze\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformAgentAuthorityFreeze({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
