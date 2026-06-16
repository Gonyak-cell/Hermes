import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildAgentBridgeRequestPacketExport,
  parseAgentBridgeRequestPacketExportArgs,
  runAgentBridgeRequestPacketExport,
  validateAgentBridgeRequestPacketExportResult,
} from "../src/agent-bridge-request-packet-export.mjs";

const RUN_AT = "2026-06-16T08:00:00.000Z";

test("Agent Bridge request packet export builds copy-only markdown packets", async () => {
  const result = await buildAgentBridgeRequestPacketExport({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "agent-bridge-request-packet-export.v1");
  assert.equal(result.capability_id, "platform.agent_bridge_request_packet_export");
  assert.equal(result.summary.agent_bridge_request_packet_export_status, "ready_for_agent_bridge_request_packet_export");
  assert.equal(result.summary.source_agent_bridge_request_receipt_status, "ready_for_agent_bridge_request_receipt");
  assert.equal(result.agent_request_packet_export_rows.length, 4);
  assert.equal(result.agent_request_packet_markdown_rows.length, 4);
  assert.equal(result.agent_request_packet_export_boundary.ready_for_agent_request_packet_copy, true);
  assert.equal(result.summary.copy_markdown_allowed_now, true);
  assert.equal(result.summary.file_export_allowed_now, true);
  assert.equal(result.summary.request_transport_submission_allowed_now, false);
  assert.equal(result.summary.provider_automation_allowed_now, false);
  assert.equal(result.summary.execution_allowed_now, false);
  assert.equal(result.summary.receipt_application_allowed_now, false);
});

test("Agent Bridge request packet export rows exclude raw prompts, secrets, and authority", async () => {
  const result = await buildAgentBridgeRequestPacketExport({ runAt: RUN_AT, write: false });

  assert.equal(result.agent_request_packet_export_rows.every((row) => row.packet_markdown.includes("# Hermes Agent Bridge Request Packet")), true);
  assert.equal(result.agent_request_packet_export_rows.every((row) => row.packet_markdown_hash.startsWith("sha256:")), true);
  assert.equal(result.agent_request_packet_export_rows.every((row) => row.copy_allowed_now === true), true);
  assert.equal(result.agent_request_packet_export_rows.every((row) => row.file_export_allowed_now === true), true);
  assert.equal(result.agent_request_packet_export_rows.every((row) => row.request_transport_submission_allowed_now === false), true);
  assert.equal(result.agent_request_packet_export_rows.every((row) => row.provider_automation_allowed_now === false), true);
  assert.equal(result.agent_request_packet_export_rows.every((row) => row.raw_prompt_included === false), true);
  assert.equal(result.agent_request_packet_export_rows.every((row) => row.secret_reference_included === false), true);
  assert.equal(result.agent_request_packet_export_rows.every((row) => row.opens_authority === false), true);
  assert.equal(result.agent_request_packet_markdown_rows.every((row) => row.contains_forbidden_trust_claim === false), true);
});

test("Agent Bridge request packet export blocks unsafe export fixtures", async () => {
  const result = await buildAgentBridgeRequestPacketExport({ runAt: RUN_AT, write: false });

  assert.equal(result.blocked_export_fixture_rows.length >= 10, true);
  assert.equal(result.blocked_export_fixture_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.blocked_export_fixture_rows.every((row) => row.blocked === true), true);
  assert.equal(result.blocked_export_fixture_rows.every((row) => row.copy_allowed_now === false && row.file_export_allowed_now === false), true);
  assert.equal(result.blocked_export_fixture_rows.every((row) => row.opens_authority === false), true);
});

test("Agent Bridge request packet export validation fails if transport or raw prompt opens", async () => {
  const result = await buildAgentBridgeRequestPacketExport({ runAt: RUN_AT, write: false });
  const schema = JSON.parse(await readFile("schemas/agent-bridge-request-packet-export.schema.json", "utf8"));
  const tampered = JSON.parse(JSON.stringify(result));
  delete tampered.markdown;
  tampered.agent_request_packet_export_rows[0].request_transport_submission_allowed_now = true;
  tampered.agent_request_packet_export_rows[0].raw_prompt_included = true;
  tampered.agent_request_packet_export_boundary.request_transport_submission_allowed_now = true;
  tampered.summary.request_transport_submission_allowed_now = true;

  const validation = validateAgentBridgeRequestPacketExportResult(tampered, schema);
  assert.equal(validation.validation.valid, false);
  assert.equal(validation.validation.errors.some((error) => error.path === "packets.copy_only"), true);
  assert.equal(validation.validation.errors.some((error) => error.path === "packets.no_raw_prompt"), true);
});

test("Agent Bridge request packet export --check validates without overwriting artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-agent-bridge-request-packet-export-"));
  const sentinelPath = path.join(outDir, "agent-bridge-request-packet-export.json");
  const sentinel = "{ \"sentinel\": \"agent-bridge-request-packet-export\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");
  try {
    const result = await runAgentBridgeRequestPacketExport({
      runAt: RUN_AT,
      check: true,
      write: false,
      outDir,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Agent Bridge request packet export CLI parser accepts only known flags", () => {
  assert.deepEqual(parseAgentBridgeRequestPacketExportArgs(["--check", "--schema-path", "schemas/example.json"]), {
    check: true,
    write: false,
    schemaPath: "schemas/example.json",
  });
  assert.throws(() => parseAgentBridgeRequestPacketExportArgs(["--execute"]), /Unknown argument: --execute/);
  assert.throws(() => parseAgentBridgeRequestPacketExportArgs(["--source-agent-bridge-request-receipt-path"]), /Missing value for --source-agent-bridge-request-receipt-path/);
});
