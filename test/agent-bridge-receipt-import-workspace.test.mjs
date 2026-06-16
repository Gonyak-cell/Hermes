import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildAgentBridgeReceiptImportWorkspace,
  parseAgentBridgeReceiptImportWorkspaceArgs,
  runAgentBridgeReceiptImportWorkspace,
  validateAgentBridgeReceiptImportWorkspaceResult,
} from "../src/agent-bridge-receipt-import-workspace.mjs";

const RUN_AT = "2026-06-16T09:00:00.000Z";

test("Agent Bridge receipt import workspace builds normalized-only import candidates", async () => {
  const result = await buildAgentBridgeReceiptImportWorkspace({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "agent-bridge-receipt-import-workspace.v1");
  assert.equal(result.capability_id, "platform.agent_bridge_receipt_import_workspace");
  assert.equal(result.summary.agent_bridge_receipt_import_workspace_status, "ready_for_agent_bridge_receipt_import_workspace");
  assert.equal(result.summary.source_agent_bridge_request_receipt_status, "ready_for_agent_bridge_request_receipt");
  assert.equal(result.summary.source_agent_bridge_request_packet_export_status, "ready_for_agent_bridge_request_packet_export");
  assert.equal(result.agent_receipt_import_candidate_rows.length, 4);
  assert.equal(result.agent_receipt_normalized_summary_rows.length, 4);
  assert.equal(result.agent_receipt_import_boundary.ready_for_agent_receipt_import_workspace, true);
  assert.equal(result.summary.receipt_import_workspace_enabled_now, true);
  assert.equal(result.summary.normalized_summary_import_allowed_now, true);
  assert.equal(result.summary.raw_receipt_storage_allowed, false);
  assert.equal(result.summary.receipt_application_allowed_now, false);
  assert.equal(result.summary.approval_application_allowed_now, false);
});

test("Agent Bridge receipt import candidates never apply receipts or store raw output", async () => {
  const result = await buildAgentBridgeReceiptImportWorkspace({ runAt: RUN_AT, write: false });

  assert.equal(result.agent_receipt_import_candidate_rows.every((row) => row.normalized_summary_only === true), true);
  assert.equal(result.agent_receipt_import_candidate_rows.every((row) => row.raw_output_included === false), true);
  assert.equal(result.agent_receipt_import_candidate_rows.every((row) => row.raw_receipt_stored === false), true);
  assert.equal(result.agent_receipt_import_candidate_rows.every((row) => row.receipt_applied === false), true);
  assert.equal(result.agent_receipt_import_candidate_rows.every((row) => row.receipt_application_allowed_now === false), true);
  assert.equal(result.agent_receipt_import_candidate_rows.every((row) => row.approval_application_allowed_now === false), true);
  assert.equal(result.agent_receipt_import_candidate_rows.every((row) => row.opens_authority === false), true);
  assert.equal(result.agent_receipt_import_candidate_rows.some((row) => row.receipt_quarantined === true), true);
});

test("Agent Bridge receipt import workspace blocks unsafe import fixtures", async () => {
  const result = await buildAgentBridgeReceiptImportWorkspace({ runAt: RUN_AT, write: false });

  assert.equal(result.blocked_import_fixture_rows.length >= 10, true);
  assert.equal(result.blocked_import_fixture_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.blocked_import_fixture_rows.every((row) => row.blocked === true), true);
  assert.equal(result.blocked_import_fixture_rows.every((row) => row.receipt_quarantined === true), true);
  assert.equal(result.blocked_import_fixture_rows.every((row) => row.receipt_applied === false), true);
  assert.equal(result.blocked_import_fixture_rows.every((row) => row.opens_authority === false), true);
});

test("Agent Bridge receipt import workspace validation fails if receipt application opens", async () => {
  const result = await buildAgentBridgeReceiptImportWorkspace({ runAt: RUN_AT, write: false });
  const schema = JSON.parse(await readFile("schemas/agent-bridge-receipt-import-workspace.schema.json", "utf8"));
  const tampered = JSON.parse(JSON.stringify(result));
  delete tampered.markdown;
  tampered.agent_receipt_import_candidate_rows[0].receipt_applied = true;
  tampered.agent_receipt_import_candidate_rows[0].receipt_application_allowed_now = true;
  tampered.agent_receipt_import_boundary.receipt_application_allowed_now = true;
  tampered.summary.receipt_application_allowed_now = true;

  const validation = validateAgentBridgeReceiptImportWorkspaceResult(tampered, schema);
  assert.equal(validation.validation.valid, false);
  assert.equal(validation.validation.errors.some((error) => error.path === "imports.no_application"), true);
  assert.equal(validation.validation.errors.some((error) => error.path === "boundary.no_authority"), true);
});

test("Agent Bridge receipt import workspace --check validates without overwriting artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-agent-bridge-receipt-import-workspace-"));
  const sentinelPath = path.join(outDir, "agent-bridge-receipt-import-workspace.json");
  const sentinel = "{ \"sentinel\": \"agent-bridge-receipt-import-workspace\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");
  try {
    const result = await runAgentBridgeReceiptImportWorkspace({
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

test("Agent Bridge receipt import workspace CLI parser accepts only known flags", () => {
  assert.deepEqual(parseAgentBridgeReceiptImportWorkspaceArgs(["--check", "--schema-path", "schemas/example.json"]), {
    check: true,
    write: false,
    schemaPath: "schemas/example.json",
  });
  assert.throws(() => parseAgentBridgeReceiptImportWorkspaceArgs(["--apply"]), /Unknown argument: --apply/);
  assert.throws(() => parseAgentBridgeReceiptImportWorkspaceArgs(["--source-agent-bridge-request-packet-export-path"]), /Missing value for --source-agent-bridge-request-packet-export-path/);
});
