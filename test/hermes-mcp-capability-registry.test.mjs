import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildHermesMcpCapabilityRegistry,
  runHermesMcpCapabilityRegistry,
} from "../src/hermes-mcp-capability-registry.mjs";

const RUN_AT = "2026-06-22T00:00:00.000Z";

test("Hermes MCP capability registry preserves read-only/check-only policy", async () => {
  const result = await buildHermesMcpCapabilityRegistry({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.hermes_mcp_capability_registry_status, "ready_for_hermes_mcp_capability_registry");
  assert.equal(result.mcp_policy.source_of_truth, "repo_artifacts_schemas");
  assert.equal(result.mcp_policy.mcp_server_started_now, false);
  assert.equal(result.mcp_policy.live_mcp_connection_opened_now, false);
  assert.equal(result.mcp_policy.repo_write_allowed_now, false);
  assert.equal(result.mcp_policy.connector_write_allowed_now, false);
  assert.equal(result.mcp_policy.deployment_allowed_now, false);
  assert.equal(result.mcp_policy.final_approval_allowed_now, false);
});
test("Hermes MCP capability registry exposes deterministic resources and check-only tools", async () => {
  const result = await buildHermesMcpCapabilityRegistry({ runAt: RUN_AT, write: false });
  const resourceUris = new Set(result.mcp_resource_rows.map((row) => row.uri));
  const toolNames = new Set(result.mcp_tool_rows.map((row) => row.tool_name));

  for (const uri of ["hermes://projects", "hermes://gates", "hermes://receipts", "hermes://factory/products", "hermes://desktop/read-model"]) {
    assert.equal(resourceUris.has(uri), true, `${uri} should be registered`);
  }
  for (const tool of ["hermes.validate.core", "hermes.desktop.read_model", "hermes.factory.product_registry", "hermes.factory.receipt_preflight"]) {
    assert.equal(toolNames.has(tool), true, `${tool} should be registered`);
  }
  assert.equal(result.mcp_resource_rows.every((row) => row.exposure_mode === "read_only_planned" && row.mutation_allowed_now === false), true);
  assert.equal(result.mcp_tool_rows.every((row) => row.package_script_registered && row.invocation_mode === "read_only_or_check_only"), true);
  assert.equal(result.mcp_tool_rows.every((row) => row.mutation_allowed_now === false && row.connector_write_allowed_now === false), true);
});

test("Hermes MCP capability registry blocks authority classes and keeps Desktop non-authoritative", async () => {
  const result = await buildHermesMcpCapabilityRegistry({ runAt: RUN_AT, write: false });
  const blockedIds = new Set(result.blocked_authority_rows.map((row) => row.authority_id));

  for (const authorityId of ["repo_write", "connector_write", "deploy", "protected_action", "final_approval", "enterprise_trust", "mcp_server_live_start"]) {
    assert.equal(blockedIds.has(authorityId), true, `${authorityId} should be blocked`);
  }
  assert.equal(result.blocked_authority_rows.every((row) => row.current_verdict === "blocked" && row.allowed_now === false), true);
  assert.equal(result.blocked_authority_rows.every((row) => row.human_gate_required_to_open && row.independent_review_required_to_open), true);
  assert.equal(result.desktop_console_boundary.desktop_source_of_truth, false);
  assert.equal(result.desktop_console_boundary.desktop_mutation_allowed_now, false);
  assert.equal(result.desktop_console_boundary.desktop_final_approval_allowed_now, false);
});

test("Hermes MCP capability registry binds boundary plan, factory decision, and package script", async () => {
  const result = await buildHermesMcpCapabilityRegistry({ runAt: RUN_AT, write: false });

  assert.deepEqual(result.source_binding_rows.map((row) => row.source_binding_status), ["bound", "bound", "bound"]);
  assert.equal(result.source_binding_rows.every((row) => row.mutation_allowed_now === false), true);
  assert.equal(result.summary.bound_source_count, 3);
  assert.equal(result.summary.validation_error_count, 0);
});

test("Hermes MCP capability registry --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-mcp-capability-registry-"));
  const sentinelPath = path.join(outDir, "hermes-mcp-capability-registry.json");
  const sentinel = "{ \"sentinel\": \"hermes-mcp-capability-registry\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runHermesMcpCapabilityRegistry({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
