import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  AGENT_TASK_REQUEST_TYPES,
  buildAgentBridgeRequestReceipt,
  parseAgentBridgeRequestReceiptArgs,
  runAgentBridgeRequestReceipt,
  validateAgentBridgeRequestReceiptResult,
} from "../src/agent-bridge-request-receipt.mjs";

const RUN_AT = "2026-06-16T04:00:00.000Z";

test("Agent Bridge request/receipt builds request queue and receipt intake without execution", async () => {
  const result = await buildAgentBridgeRequestReceipt({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "agent-bridge-request-receipt.v1");
  assert.equal(result.capability_id, "platform.agent_bridge_request_receipt");
  assert.equal(result.summary.agent_bridge_request_receipt_status, "ready_for_agent_bridge_request_receipt");
  assert.equal(result.summary.source_agent_bridge_manifest_status, "ready_for_agent_bridge_manifest");
  assert.equal(result.agent_task_request_queue_rows.length, AGENT_TASK_REQUEST_TYPES.length);
  assert.equal(result.agent_receipt_intake_rows.length, AGENT_TASK_REQUEST_TYPES.length);
  assert.equal(result.agent_evidence_binding_rows.length, AGENT_TASK_REQUEST_TYPES.length);
  assert.equal(result.agent_request_receipt_boundary.ready_for_desktop_agents_projection, true);
  assert.equal(result.summary.request_queue_enabled_now, true);
  assert.equal(result.summary.receipt_intake_enabled_now, true);
  assert.equal(result.summary.request_transport_submission_allowed_now, false);
  assert.equal(result.summary.execution_allowed_now, false);
  assert.equal(result.summary.receipt_application_allowed_now, false);
});

test("Agent Bridge request rows cover required types and stay request-only", async () => {
  const result = await buildAgentBridgeRequestReceipt({ runAt: RUN_AT, write: false });
  const types = new Set(result.agent_task_request_queue_rows.map((row) => row.request_type));
  const ids = result.agent_task_request_queue_rows.map((row) => row.request_id);

  for (const type of AGENT_TASK_REQUEST_TYPES) assert.equal(types.has(type), true);
  assert.equal(ids.length, new Set(ids).size);
  assert.equal(result.agent_task_request_queue_rows.every((row) => row.request_status === "draft"), true);
  assert.equal(result.agent_task_request_queue_rows.every((row) => row.requestable === true), true);
  assert.equal(result.agent_task_request_queue_rows.every((row) => row.request_packet_generated === true), true);
  assert.equal(result.agent_task_request_queue_rows.every((row) => row.transport_submitted_now === false), true);
  assert.equal(result.agent_task_request_queue_rows.every((row) => row.command_executed_now === false), true);
  assert.equal(result.agent_task_request_queue_rows.every((row) => row.data_minimization_passed === true), true);
});

test("Agent Bridge receipt intake normalizes summaries and cannot apply receipts", async () => {
  const result = await buildAgentBridgeRequestReceipt({ runAt: RUN_AT, write: false });

  assert.equal(result.agent_receipt_intake_rows.every((row) => row.normalized_summary_only === true), true);
  assert.equal(result.agent_receipt_intake_rows.every((row) => row.raw_output_included === false), true);
  assert.equal(result.agent_receipt_intake_rows.every((row) => row.receipt_applied === false), true);
  assert.equal(result.agent_receipt_intake_rows.every((row) => row.approval_application_allowed_now === false), true);
  assert.equal(result.agent_receipt_intake_rows.every((row) => row.receipt_application_allowed_now === false), true);
  assert.equal(result.agent_receipt_intake_rows.some((row) => row.receipt_quarantined === true), true);
});

test("Agent Bridge request/receipt blocks malicious request and receipt fixtures", async () => {
  const result = await buildAgentBridgeRequestReceipt({ runAt: RUN_AT, write: false });

  assert.equal(result.malicious_request_fixture_rows.length >= 8, true);
  assert.equal(result.malicious_receipt_fixture_rows.length >= 9, true);
  assert.equal(result.malicious_request_fixture_rows.every((row) => row.current_verdict === "pass" && row.blocked === true), true);
  assert.equal(result.malicious_receipt_fixture_rows.every((row) => row.current_verdict === "pass" && row.receipt_quarantined === true), true);
  assert.equal(result.malicious_receipt_fixture_rows.every((row) => row.receipt_applied === false && row.opens_authority === false), true);
});

test("Agent Bridge request/receipt validation fails if receipt application opens", async () => {
  const result = await buildAgentBridgeRequestReceipt({ runAt: RUN_AT, write: false });
  const schema = JSON.parse(await readFile("schemas/agent-bridge-request-receipt.schema.json", "utf8"));
  const tampered = JSON.parse(JSON.stringify(result));
  delete tampered.markdown;
  tampered.agent_receipt_intake_rows[0].receipt_applied = true;
  tampered.agent_receipt_intake_rows[0].receipt_application_allowed_now = true;
  tampered.agent_request_receipt_boundary.receipt_application_allowed_now = true;
  tampered.summary.receipt_application_allowed_now = true;

  const validation = validateAgentBridgeRequestReceiptResult(tampered, schema);
  assert.equal(validation.validation.valid, false);
  assert.equal(validation.validation.errors.some((error) => error.path === "receipt.no_application"), true);
});

test("Agent Bridge request/receipt --check validates without overwriting artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-agent-bridge-request-receipt-"));
  const sentinelPath = path.join(outDir, "agent-bridge-request-receipt.json");
  const sentinel = "{ \"sentinel\": \"agent-bridge-request-receipt\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");
  try {
    const result = await runAgentBridgeRequestReceipt({
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

test("Agent Bridge request/receipt CLI parser accepts only known flags", () => {
  assert.deepEqual(parseAgentBridgeRequestReceiptArgs(["--check", "--schema-path", "schemas/example.json"]), {
    check: true,
    write: false,
    schemaPath: "schemas/example.json",
  });
  assert.throws(() => parseAgentBridgeRequestReceiptArgs(["--execute"]), /Unknown argument: --execute/);
  assert.throws(() => parseAgentBridgeRequestReceiptArgs(["--source-agent-bridge-manifest-path"]), /Missing value for --source-agent-bridge-manifest-path/);
});
