import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformAgentDomainAdapterSdk,
  runPlatformAgentDomainAdapterSdk,
} from "../src/platform-agent-domain-adapter-sdk.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";

test("platform agent domain adapter SDK consumes tool policy and registry", async () => {
  const result = await buildPlatformAgentDomainAdapterSdk({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_agent_domain_adapter_sdk_status, "ready_for_agent_domain_adapter_sdk");
  assert.equal(result.summary.source_tool_policy_matrix_status, "ready_for_agent_tool_policy_matrix");
  assert.equal(result.summary.source_capability_registry_status, "ready_for_agent_capability_registry");
  assert.equal(result.agent_domain_adapter_gate_rows.every((row) => row.gate_status === "ready"), true);
});

test("platform agent domain adapter SDK maps seven domains and eight methods per domain", async () => {
  const result = await buildPlatformAgentDomainAdapterSdk({ runAt: RUN_AT, write: false });
  const domains = new Set(result.agent_domain_adapter_contract_rows.map((row) => row.domain_id));
  const methods = new Set(result.agent_domain_adapter_method_rows.map((row) => row.method_id));

  assert.equal(domains.size, 7);
  assert.equal(methods.size, 8);
  assert.equal(result.agent_domain_adapter_contract_rows.length, 7);
  assert.equal(result.agent_domain_adapter_method_rows.length, 56);
  assert.equal(result.agent_domain_adapter_output_contract_rows.length, 7);
  assert.equal(result.agent_domain_adapter_contract_rows.every((row) => row.adapter_execution_allowed_now === false), true);
});

test("platform agent domain adapter SDK requires sanitized claim packets", async () => {
  const result = await buildPlatformAgentDomainAdapterSdk({ runAt: RUN_AT, write: false });

  assert.equal(result.agent_domain_adapter_output_contract_rows.every((row) => row.required_claim_fields.includes("evidence_ref")), true);
  assert.equal(result.agent_domain_adapter_output_contract_rows.every((row) => row.required_claim_fields.includes("reviewer_ref")), true);
  assert.equal(result.agent_domain_adapter_output_contract_rows.every((row) => row.required_claim_fields.includes("hard_gate_ref")), true);
  assert.equal(result.agent_domain_adapter_output_contract_rows.every((row) => row.required_claim_fields.includes("next_allowed_action")), true);
  assert.equal(result.agent_domain_adapter_output_contract_rows.every((row) => row.blocked_claim_outputs.includes("final_pass_by_agent")), true);
  assert.equal(result.agent_domain_adapter_output_contract_rows.every((row) => row.raw_secret_output_allowed === false), true);
  assert.equal(result.agent_domain_adapter_output_contract_rows.every((row) => row.raw_client_or_vdr_output_allowed === false), true);
});

test("platform agent domain adapter SDK documents protected blocks and supported claims", async () => {
  const result = await buildPlatformAgentDomainAdapterSdk({ runAt: RUN_AT, write: false });
  const protectedBlocks = new Set(result.agent_domain_adapter_protected_block_rows.map((row) => row.protected_block_id));

  assert.equal(protectedBlocks.has("raw_secret_input"), true);
  assert.equal(protectedBlocks.has("raw_client_or_vdr_input"), true);
  assert.equal(protectedBlocks.has("adapter_direct_mutation"), true);
  assert.equal(protectedBlocks.has("adapter_direct_zendd_write"), true);
  assert.equal(protectedBlocks.has("adapter_final_pass"), true);
  assert.equal(result.agent_domain_adapter_claim_rows.length, 78);
  assert.equal(result.agent_domain_adapter_claim_rows.filter((row) => row.current_verdict === "pass").length, 70);
  assert.equal(result.agent_domain_adapter_claim_rows.filter((row) => row.current_verdict === "blocked").length, 8);
  assert.equal(result.agent_domain_adapter_claim_rows.every((row) => row.verdict_authority === "harness_only"), true);
});

test("platform agent domain adapter SDK keeps execution, mutation, raw material, and final pass disabled", async () => {
  const result = await buildPlatformAgentDomainAdapterSdk({ runAt: RUN_AT, write: false });
  const boundary = result.agent_domain_adapter_boundary;

  assert.equal(boundary.adapter_execution_allowed_now, false);
  assert.equal(boundary.direct_domain_mutation_allowed_now, false);
  assert.equal(boundary.direct_zendd_mutation_allowed_now, false);
  assert.equal(boundary.raw_secret_exposed, false);
  assert.equal(boundary.raw_client_or_vdr_exposed, false);
  assert.equal(boundary.protected_action_execution_allowed_now, false);
  assert.equal(boundary.final_pass_created_by_agent, false);
  assert.equal(boundary.human_receipt_applied_by_agent, false);
});

test("platform agent domain adapter SDK --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-agent-domain-adapter-sdk-"));
  const sentinelPath = path.join(outDir, "platform-agent-domain-adapter-sdk.json");
  const sentinel = "{ \"sentinel\": \"platform-agent-domain-adapter-sdk\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformAgentDomainAdapterSdk({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
