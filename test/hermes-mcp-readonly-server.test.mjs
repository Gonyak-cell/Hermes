import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildHermesMcpReadonlyServer,
  handleHermesMcpJsonRpcMessage,
  runHermesMcpReadonlyServer,
} from "../src/hermes-mcp-readonly-server.mjs";

const RUN_AT = "2026-06-22T00:00:00.000Z";

test("Hermes MCP read-only server exposes 2025-06-18 resources and tools capabilities", async () => {
  const model = await buildHermesMcpReadonlyServer({ runAt: RUN_AT, write: false });

  assert.equal(model.validation.valid, true);
  assert.equal(model.summary.hermes_mcp_readonly_server_status, "ready_for_hermes_mcp_check_tool_adapter");
  assert.equal(model.protocol_version, "2025-06-18");
  assert.equal(model.summary.mcp_tranche, "H-MCP-03");
  assert.equal(model.summary.mcp_resource_count, 8);
  assert.equal(model.summary.mcp_tool_count, 8);
  assert.deepEqual(Object.keys(model.server_capabilities).sort(), ["resources", "tools"]);
  assert.equal(model.mcp_tools.every((tool) => tool.adapter_allowlisted && tool.check_mode_required), true);
  assert.equal(model.mcp_tools.every((tool) => tool.check_command.executable === "npm" && tool.check_command.args.at(-1) === "--check"), true);
});

test("Hermes MCP read-only server preserves source-of-truth and authority boundary", async () => {
  const model = await buildHermesMcpReadonlyServer({ runAt: RUN_AT, write: false });

  assert.equal(model.source_registry.status, "ready_for_hermes_mcp_capability_registry");
  assert.equal(model.authority_boundary.source_of_truth, "repo_artifacts_schemas");
  assert.equal(model.authority_boundary.server_started_during_check, false);
  assert.equal(model.authority_boundary.check_tool_adapter_enabled_now, true);
  assert.equal(model.authority_boundary.check_tool_subprocess_execution_allowed_now, true);
  assert.equal(model.authority_boundary.non_check_tool_subprocess_execution_allowed_now, false);
  assert.equal(model.authority_boundary.tool_subprocess_execution_allowed_now, false);
  assert.equal(model.authority_boundary.repo_write_allowed_now, false);
  assert.equal(model.authority_boundary.filesystem_write_allowed_now, false);
  assert.equal(model.authority_boundary.connector_write_allowed_now, false);
  assert.equal(model.authority_boundary.receipt_application_allowed_now, false);
  assert.equal(model.authority_boundary.final_approval_allowed_now, false);
  assert.equal(model.authority_boundary.production_pass_allowed_now, false);
  assert.equal(model.authority_boundary.enterprise_trust_claim_allowed_now, false);
  assert.equal(model.authority_boundary.raw_restricted_payload_allowed, false);
  assert.equal(model.authority_boundary.desktop_source_of_truth, false);
});

test("Hermes MCP JSON-RPC handler initializes and lists deterministic resources", async () => {
  const model = await buildHermesMcpReadonlyServer({ runAt: RUN_AT, write: false });
  const context = { model };
  const initialized = await handleHermesMcpJsonRpcMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } },
  }, context);
  const listed = await handleHermesMcpJsonRpcMessage({ jsonrpc: "2.0", id: 2, method: "resources/list" }, context);

  assert.equal(initialized.result.protocolVersion, "2025-06-18");
  assert.deepEqual(Object.keys(initialized.result.capabilities).sort(), ["resources", "tools"]);
  assert.equal(listed.result.resources.length, 8);
  assert.equal(listed.result.resources.some((resource) => resource.uri === "hermes://status"), true);
  assert.equal(listed.result.resources.every((resource) => resource.mimeType === "application/json"), true);
});

test("Hermes MCP JSON-RPC handler reads status resource without exposing mutation authority", async () => {
  const model = await buildHermesMcpReadonlyServer({ runAt: RUN_AT, write: false });
  const response = await handleHermesMcpJsonRpcMessage({
    jsonrpc: "2.0",
    id: 3,
    method: "resources/read",
    params: { uri: "hermes://status" },
  }, { model });

  assert.equal(response.result.contents.length, 1);
  const payload = JSON.parse(response.result.contents[0].text);
  assert.equal(payload.server.hermes_mcp_readonly_server_status, "ready_for_hermes_mcp_check_tool_adapter");
  assert.equal(payload.authority_boundary.repo_write_allowed_now, false);
  assert.equal(payload.authority_boundary.check_tool_subprocess_execution_allowed_now, true);
  assert.equal(payload.authority_boundary.non_check_tool_subprocess_execution_allowed_now, false);
  assert.equal(payload.authority_boundary.desktop_source_of_truth, false);
});

test("Hermes MCP JSON-RPC handler lists tools and runs allowlisted check-only tool calls", async () => {
  const model = await buildHermesMcpReadonlyServer({ runAt: RUN_AT, write: false });
  const context = { model };
  const listed = await handleHermesMcpJsonRpcMessage({ jsonrpc: "2.0", id: 4, method: "tools/list" }, context);
  const called = await handleHermesMcpJsonRpcMessage({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "hermes.desktop.authority_boundary", arguments: { dry_run: true } },
  }, context);

  assert.equal(listed.result.tools.length, 8);
  assert.equal(listed.result.tools.some((tool) => tool.name === "hermes.desktop.authority_boundary"), true);
  assert.equal(called.result.isError, false);
  assert.equal(called.result.structuredContent.check_mode, true);
  assert.equal(called.result.structuredContent.executed, true);
  assert.equal(called.result.structuredContent.subprocess_started, true);
  assert.equal(called.result.structuredContent.exit_code, 0);
  assert.equal(called.result.structuredContent.mutation_allowed_now, false);
  assert.equal(called.result.structuredContent.repo_write_allowed_now, false);
  assert.equal(called.result.structuredContent.filesystem_write_allowed_now, false);
  assert.equal(called.result.structuredContent.receipt_application_allowed_now, false);
  assert.equal(called.result.structuredContent.protected_action_allowed_now, false);
  assert.equal(called.result.structuredContent.production_pass_allowed_now, false);
  assert.equal(called.result.structuredContent.enterprise_trust_claim_allowed_now, false);
  assert.equal(called.result.structuredContent.raw_restricted_payload_allowed, false);
});

test("Hermes MCP JSON-RPC handler fails closed for mutation and non-dry-run calls", async () => {
  const model = await buildHermesMcpReadonlyServer({ runAt: RUN_AT, write: false });
  const context = { model };
  const mutation = await handleHermesMcpJsonRpcMessage({ jsonrpc: "2.0", id: 6, method: "resources/write", params: {} }, context);
  const nonDryRun = await handleHermesMcpJsonRpcMessage({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "hermes.validate.core", arguments: { dry_run: false } },
  }, context);
  const nonCheck = await handleHermesMcpJsonRpcMessage({
    jsonrpc: "2.0",
    id: 8,
    method: "tools/call",
    params: { name: "hermes.validate.core", arguments: { check_only: false } },
  }, context);

  assert.equal(mutation.error.code, -32601);
  assert.equal(nonDryRun.error.code, -32602);
  assert.equal(nonCheck.error.code, -32602);
});

test("Hermes MCP read-only server --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-mcp-readonly-server-"));
  const sentinelPath = path.join(outDir, "hermes-mcp-readonly-server.json");
  const sentinel = "{ \"sentinel\": \"hermes-mcp-readonly-server\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runHermesMcpReadonlyServer({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Hermes MCP stdio surface responds with newline-delimited JSON-RPC", async () => {
  const child = spawn("npm", ["--silent", "run", "mcp:serve", "--", "--run-at", RUN_AT], {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
  });
  const stdout = [];
  const stderr = [];
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));

  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } } })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "resources/list" })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "hermes.validate.core", arguments: { dry_run: true } } })}\n`);
  child.stdin.end();

  const exitCode = await new Promise((resolve) => child.on("close", resolve));
  const lines = stdout.join("").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));

  assert.equal(exitCode, 0);
  assert.equal(stderr.join(""), "");
  const responses = new Map(lines.map((line) => [line.id, line]));

  assert.equal(lines.length, 3);
  assert.equal(responses.get(1).result.protocolVersion, "2025-06-18");
  assert.equal(responses.get(2).result.resources.length, 8);
  assert.equal(responses.get(3).result.structuredContent.check_mode, true);
  assert.equal(responses.get(3).result.structuredContent.executed, true);
  assert.equal(responses.get(3).result.structuredContent.exit_code, 0);
});
