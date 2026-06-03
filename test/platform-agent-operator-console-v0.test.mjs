import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPlatformDomainAgentNoWritePilot } from "../src/platform-domain-agent-no-write-pilot.mjs";
import {
  buildPlatformAgentOperatorConsoleV0,
  runPlatformAgentOperatorConsoleV0,
} from "../src/platform-agent-operator-console-v0.mjs";

const RUN_AT = "2026-06-03T00:00:00.000Z";
const sourceDomainPilotPromise = buildPlatformDomainAgentNoWritePilot({ runAt: RUN_AT, write: false });
const resultPromise = sourceDomainPilotPromise.then((sourceDomainNoWritePilot) => buildPlatformAgentOperatorConsoleV0({
  runAt: RUN_AT,
  write: false,
  sourceDomainNoWritePilot,
}));

test("Agent operator console v0 consumes the domain no-write pilot", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_agent_operator_console_v0_status, "ready_for_agent_operator_console_v0_freeze");
  assert.equal(result.summary.source_domain_pilot_status, "ready_for_agent_domain_no_write_pilot_freeze");
  assert.equal(result.summary.capability_row_count, 32);
  assert.equal(result.summary.block_row_count, 20);
});

test("Agent operator console v0 exposes capability and block rows", async () => {
  const result = await resultPromise;
  const capabilityIds = new Set(result.agent_console_capability_rows.map((row) => `${row.domain_id}.${row.capability_id}`));
  const blockIds = new Set(result.agent_console_block_rows.map((row) => row.protected_block_id));

  assert.equal(result.agent_console_capability_rows.length, 32);
  assert.equal(capabilityIds.has("personal-dev.diff_review_candidate"), true);
  assert.equal(capabilityIds.has("law-firm.vdr_ldd_candidate"), true);
  assert.equal(capabilityIds.has("project.zendd.work_order_candidate"), true);
  assert.equal(result.agent_console_capability_rows.every((row) => row.rollout_level === "L0_no_write"), true);
  assert.equal(result.agent_console_capability_rows.every((row) => row.runtime_execution_allowed_now === false), true);
  assert.equal(result.agent_console_capability_rows.every((row) => row.write_action_allowed_now === false), true);
  assert.equal(result.agent_console_block_rows.length, 20);
  assert.equal(blockIds.has("project.zendd.direct_write"), true);
  assert.equal(blockIds.has("platform.agent_final_pass"), true);
  assert.equal(result.agent_console_block_rows.every((row) => row.current_verdict === "blocked" && row.action_allowed_now === false), true);
});

test("Agent operator console v0 shows missing receipts and next actions", async () => {
  const result = await resultPromise;

  assert.equal(result.agent_console_receipt_rows.length, 26);
  assert.equal(result.summary.missing_receipt_count, 26);
  assert.equal(result.agent_console_receipt_rows.every((row) => row.receipt_status === "missing"), true);
  assert.equal(result.agent_console_receipt_rows.every((row) => row.receipt_payload_present === false && row.receipt_applied === false), true);
  assert.equal(result.agent_console_next_action_rows.length, 26);
  assert.equal(result.agent_console_next_action_rows.every((row) => row.execution_allowed_now === false && row.next_allowed_action), true);
});

test("Agent operator console v0 declares read-only API projection rows", async () => {
  const result = await resultPromise;
  const routePaths = new Set(result.agent_console_api_route_rows.map((row) => row.route_path));

  assert.equal(result.agent_console_api_route_rows.length, 4);
  assert.equal(routePaths.has("/api/agent-capabilities"), true);
  assert.equal(routePaths.has("/api/agent-blocks"), true);
  assert.equal(routePaths.has("/api/agent-next-actions"), true);
  assert.equal(routePaths.has("/api/agent-receipts"), true);
  assert.equal(result.agent_console_api_route_rows.every((row) => row.method === "GET"), true);
  assert.equal(result.agent_console_api_route_rows.every((row) => row.server_started === false && row.mutation_route === false), true);
});

test("Agent operator console v0 closes claims, gates, and boundary", async () => {
  const result = await resultPromise;
  const boundary = result.agent_console_boundary;

  assert.equal(result.agent_console_closeout_rows.length, 8);
  assert.equal(result.agent_console_gate_rows.length, 13);
  assert.equal(result.agent_console_gate_rows.every((row) => row.gate_status === "ready"), true);
  assert.equal(result.agent_console_claim_rows.length, 116);
  assert.equal(result.summary.pass_claim_count, 96);
  assert.equal(result.summary.blocked_claim_count, 20);
  assert.equal(boundary.operator_console_v0_ready_for_kernel_cutover, true);
  assert.equal(boundary.read_only_console, true);
  assert.equal(boundary.server_started, false);
  assert.equal(boundary.receipt_applied, false);
  assert.equal(boundary.agent_runtime_execution_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.protected_action_execution_allowed_now, false);
  assert.equal(boundary.agent_final_pass_allowed_now, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Agent operator console v0 --check does not overwrite existing artifacts", async () => {
  const sourceDomainNoWritePilot = await sourceDomainPilotPromise;
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-agent-operator-console-v0-"));
  const sentinelPath = path.join(outDir, "platform-agent-operator-console-v0.json");
  const sentinel = "{ \"sentinel\": \"platform-agent-operator-console-v0\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformAgentOperatorConsoleV0({
      runAt: RUN_AT,
      outDir,
      check: true,
      write: false,
      sourceDomainNoWritePilot,
    });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
