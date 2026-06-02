import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformAgentRuntimeReceiptContract,
  runPlatformAgentRuntimeReceiptContract,
} from "../src/platform-agent-runtime-receipt-contract.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";

test("platform agent runtime receipt contract consumes the operator surface", async () => {
  const result = await buildPlatformAgentRuntimeReceiptContract({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_agent_runtime_receipt_contract_status, "ready_for_agent_runtime_receipt_contract");
  assert.equal(result.summary.source_operator_surface_status, "ready_for_agent_operator_surface");
  assert.equal(result.source_agent_operator_surface_summary.protected_queue_count, 16);
  assert.equal(result.source_agent_operator_surface_summary.mutation_block_count, 8);
});

test("platform agent runtime receipt contract creates templates without receipt payloads", async () => {
  const result = await buildPlatformAgentRuntimeReceiptContract({ runAt: RUN_AT, write: false });
  const protectedIds = new Set(result.agent_runtime_receipt_template_rows.map((row) => row.protected_action_id));

  assert.equal(result.agent_runtime_receipt_template_rows.length, 16);
  assert.equal(protectedIds.has("direct_zendd_mutation"), true);
  assert.equal(protectedIds.has("agent_final_pass"), true);
  assert.equal(result.agent_runtime_receipt_template_rows.every((row) => row.current_verdict === "pass" && row.receipt_payload_present === false), true);
  assert.equal(result.agent_runtime_receipt_template_rows.every((row) => row.required_receipt_fields.includes("human_receipt_ref")), true);
});

test("platform agent runtime receipt contract blocks protected actions and mutation routes", async () => {
  const result = await buildPlatformAgentRuntimeReceiptContract({ runAt: RUN_AT, write: false });
  const routeIds = new Set(result.agent_runtime_receipt_route_gate_rows.map((row) => row.blocked_route_id));

  assert.equal(result.agent_runtime_receipt_protected_action_gate_rows.length, 16);
  assert.equal(result.agent_runtime_receipt_protected_action_gate_rows.every((row) => row.current_verdict === "blocked" && row.block_reason === "missing_validated_human_receipt"), true);
  assert.equal(result.agent_runtime_receipt_protected_action_gate_rows.every((row) => row.protected_action_execution_allowed_now === false && row.agent_final_pass_allowed_now === false), true);
  assert.equal(result.agent_runtime_receipt_route_gate_rows.length, 8);
  assert.equal(routeIds.has("post_runtime_start"), true);
  assert.equal(routeIds.has("post_zendd_write"), true);
  assert.equal(result.agent_runtime_receipt_route_gate_rows.every((row) => row.route_registered === false && row.route_execution_allowed_now === false), true);
});

test("platform agent runtime receipt contract keeps validation future-only and claims supported", async () => {
  const result = await buildPlatformAgentRuntimeReceiptContract({ runAt: RUN_AT, write: false });

  assert.equal(result.agent_runtime_receipt_validation_rule_rows.length, 8);
  assert.equal(result.agent_runtime_receipt_quarantine_rows.length, 8);
  assert.equal(result.agent_runtime_receipt_quarantine_rows.every((row) => row.unsafe_payload_accepted === false), true);
  assert.equal(result.agent_runtime_receipt_claim_rows.length, 56);
  assert.equal(result.agent_runtime_receipt_claim_rows.filter((row) => row.current_verdict === "pass").length, 32);
  assert.equal(result.agent_runtime_receipt_claim_rows.filter((row) => row.current_verdict === "blocked").length, 24);
  assert.equal(result.agent_runtime_receipt_claim_rows.every((row) => row.verdict_authority === "harness_only"), true);
  assert.equal(result.agent_runtime_receipt_gate_rows.every((row) => row.gate_status === "ready"), true);
});

test("platform agent runtime receipt contract --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-agent-runtime-receipt-contract-"));
  const sentinelPath = path.join(outDir, "platform-agent-runtime-receipt-contract.json");
  const sentinel = "{ \"sentinel\": \"platform-agent-runtime-receipt-contract\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformAgentRuntimeReceiptContract({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
