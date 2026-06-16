import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildAgentBridgeCloseoutReadiness,
  parseAgentBridgeCloseoutReadinessArgs,
  runAgentBridgeCloseoutReadiness,
  validateAgentBridgeCloseoutReadinessResult,
} from "../src/agent-bridge-closeout-readiness.mjs";

const RUN_AT = "2026-06-16T06:00:00.000Z";

test("Agent Bridge closeout readiness binds sources and keeps protected closeout false", async () => {
  const result = await buildAgentBridgeCloseoutReadiness({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "agent-bridge-closeout-readiness.v1");
  assert.equal(result.summary.agent_bridge_closeout_readiness_status, "ready_for_agent_bridge_local_operator_handoff");
  assert.equal(result.summary.source_ready_count, 8);
  assert.equal(result.summary.source_count, 8);
  assert.deepEqual(result.agent_bridge_closeout_source_rows.map((row) => row.source_id), [
    "agent_bridge_manifest",
    "agent_bridge_request_receipt",
    "agent_bridge_request_packet_export",
    "agent_bridge_receipt_import_workspace",
    "agent_bridge_review_finding_workbench",
    "agent_bridge_execution_candidate",
    "agent_bridge_limited_runtime_plan",
    "desktop_read_model",
  ]);
  assert.equal(result.summary.runbook_pass_count, result.summary.runbook_count);
  assert.equal(result.summary.local_operator_handoff_ready, true);
  assert.equal(result.summary.execution_allowed_now, false);
  assert.equal(result.summary.command_executed_now, false);
  assert.equal(result.summary.command_output_captured_now, false);
  assert.equal(result.summary.request_packet_export_enabled_now, true);
  assert.equal(result.summary.receipt_import_workspace_enabled_now, true);
  assert.equal(result.summary.review_finding_workbench_enabled_now, true);
  assert.equal(result.summary.limited_runtime_plan_enabled_now, true);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.protected_closeout_enabled, false);
  assert.equal(result.agent_bridge_closeout_boundary.ready_for_agent_bridge_local_operator_handoff, true);
});

test("Agent Bridge closeout readiness exposes local handoff rows without authority", async () => {
  const result = await buildAgentBridgeCloseoutReadiness({ runAt: RUN_AT, write: false });

  assert.equal(result.agent_bridge_operator_handoff_rows.length >= 8, true);
  assert.equal(result.agent_bridge_operator_handoff_rows.some((row) => row.handoff_id === "request_packet_export_visible"), true);
  assert.equal(result.agent_bridge_operator_handoff_rows.some((row) => row.handoff_id === "receipt_import_workspace_visible"), true);
  assert.equal(result.agent_bridge_operator_handoff_rows.some((row) => row.handoff_id === "review_findings_visible"), true);
  assert.equal(result.agent_bridge_operator_handoff_rows.some((row) => row.handoff_id === "limited_runtime_plan_visible"), true);
  assert.equal(result.agent_bridge_operator_handoff_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.agent_bridge_operator_handoff_rows.every((row) => row.opens_authority === false), true);
  assert.equal(result.agent_bridge_closeout_gate_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Agent Bridge closeout readiness validation fails if production or protected closeout opens", async () => {
  const result = await buildAgentBridgeCloseoutReadiness({ runAt: RUN_AT, write: false });
  const schema = JSON.parse(await readFile("schemas/agent-bridge-closeout-readiness.schema.json", "utf8"));
  const tampered = JSON.parse(JSON.stringify(result));
  delete tampered.markdown;
  tampered.agent_bridge_closeout_contract.production_pass_enabled = true;
  tampered.agent_bridge_closeout_contract.protected_closeout_enabled = true;
  tampered.agent_bridge_closeout_boundary.production_pass_enabled = true;
  tampered.summary.production_pass_enabled = true;

  const validation = validateAgentBridgeCloseoutReadinessResult(tampered, schema);
  assert.equal(validation.validation.valid, false);
  assert.equal(validation.validation.errors.some((error) => error.path === "authority.closed"), true);
});

test("Agent Bridge closeout readiness --check validates without overwriting artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-agent-bridge-closeout-readiness-"));
  const sentinelPath = path.join(outDir, "agent-bridge-closeout-readiness.json");
  const sentinel = "{ \"sentinel\": \"agent-bridge-closeout-readiness\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");
  try {
    const result = await runAgentBridgeCloseoutReadiness({
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

test("Agent Bridge closeout readiness CLI parser accepts only known flags", () => {
  assert.deepEqual(parseAgentBridgeCloseoutReadinessArgs(["--check", "--runbook-path", "docs/runbook.md"]), {
    check: true,
    write: false,
    runbookPath: "docs/runbook.md",
  });
  assert.throws(() => parseAgentBridgeCloseoutReadinessArgs(["--execute"]), /Unknown argument: --execute/);
  assert.throws(() => parseAgentBridgeCloseoutReadinessArgs(["--source-desktop-read-model-path"]), /Missing value for --source-desktop-read-model-path/);
  assert.throws(() => parseAgentBridgeCloseoutReadinessArgs(["--source-agent-bridge-review-finding-workbench-path"]), /Missing value for --source-agent-bridge-review-finding-workbench-path/);
  assert.throws(() => parseAgentBridgeCloseoutReadinessArgs(["--source-agent-bridge-limited-runtime-plan-path"]), /Missing value for --source-agent-bridge-limited-runtime-plan-path/);
});
