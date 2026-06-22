import assert from "node:assert/strict";
import test from "node:test";
import { runHermesMcpTranche } from "../src/hermes-mcp-program-tranches.mjs";

const RUN_AT = "2026-06-22T00:00:00.000Z";

test("H-MCP-04 authority guard passes all negative fixtures", async () => {
  const result = await runHermesMcpTranche("H-MCP-04", { runAt: RUN_AT });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.status, "ready_for_hermes_mcp_authority_guard");
  assert.equal(result.summary.negative_fixture_count, 12);
  assert.equal(result.summary.negative_fixture_pass_count, 12);
  assert.equal(result.negative_fixture_rows.every((row) => row.passed), true);
  assert.equal(result.summary.repo_write_allowed_now, false);
  assert.equal(result.summary.receipt_application_allowed_now, false);
  assert.equal(result.summary.production_pass_allowed_now, false);
  assert.equal(result.summary.raw_restricted_payload_allowed, false);
});

test("H-MCP-05 Desktop consumes MCP/read-model resources without authority", async () => {
  await runHermesMcpTranche("H-MCP-04", { runAt: RUN_AT });
  const result = await runHermesMcpTranche("H-MCP-05", { runAt: RUN_AT });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.status, "ready_for_hermes_mcp_desktop_consumption_boundary");
  assert.equal(result.summary.desktop_consumption_count, 8);
  assert.equal(result.desktop_consumption_rows.every((row) => row.resource_registered), true);
  assert.equal(result.desktop_consumption_rows.every((row) => row.desktop_source_of_truth === false), true);
  assert.equal(result.desktop_consumption_rows.every((row) => row.desktop_mutation_allowed_now === false), true);
});

test("H-MCP-06 client setup documents silent stdio and smoke flow", async () => {
  await runHermesMcpTranche("H-MCP-04", { runAt: RUN_AT });
  await runHermesMcpTranche("H-MCP-05", { runAt: RUN_AT });
  const result = await runHermesMcpTranche("H-MCP-06", { runAt: RUN_AT });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.status, "ready_for_hermes_mcp_client_setup");
  assert.equal(result.summary.client_setup_count, 4);
  assert.equal(result.summary.smoke_runbook_count, 5);
  assert.equal(result.client_setup_rows.every((row) => row.uses_silent_stdio), true);
  assert.match(result.runbook, /npm --silent run mcp:serve/);
  assert.match(result.runbook, /tools\/call/);
});

test("H-MCP-07 defines gated write tools but keeps execution closed", async () => {
  await runHermesMcpTranche("H-MCP-04", { runAt: RUN_AT });
  await runHermesMcpTranche("H-MCP-05", { runAt: RUN_AT });
  await runHermesMcpTranche("H-MCP-06", { runAt: RUN_AT });
  const result = await runHermesMcpTranche("H-MCP-07", { runAt: RUN_AT });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.status, "ready_for_hermes_mcp_gated_write_tool_definitions");
  assert.equal(result.summary.gated_write_tool_count, 9);
  assert.equal(result.gated_write_tool_rows.every((row) => row.defined_for_future_tranche), true);
  assert.equal(result.gated_write_tool_rows.every((row) => row.execution_allowed_now === false), true);
  assert.equal(result.gated_write_tool_rows.every((row) => row.available_in_mcp_tools_list_now === false), true);
  assert.equal(result.gated_write_tool_rows.every((row) => row.human_receipt_required && row.independent_review_required), true);
});

test("H-MCP-08 closeout verifies H-MCP-00 through H-MCP-08 readiness", async () => {
  await runHermesMcpTranche("H-MCP-04", { runAt: RUN_AT });
  await runHermesMcpTranche("H-MCP-05", { runAt: RUN_AT });
  await runHermesMcpTranche("H-MCP-06", { runAt: RUN_AT });
  await runHermesMcpTranche("H-MCP-07", { runAt: RUN_AT });
  const result = await runHermesMcpTranche("H-MCP-08", { runAt: RUN_AT });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.status, "ready_for_hermes_mcp_closeout_readiness");
  assert.equal(result.summary.readiness_count, 9);
  assert.equal(result.summary.readiness_ready_count, 9);
  assert.deepEqual(result.readiness_rows.map((row) => row.tranche_id), [
    "H-MCP-00",
    "H-MCP-01",
    "H-MCP-02",
    "H-MCP-03",
    "H-MCP-04",
    "H-MCP-05",
    "H-MCP-06",
    "H-MCP-07",
    "H-MCP-08",
  ]);
  assert.equal(result.summary.repo_write_allowed_now, false);
  assert.equal(result.summary.deployment_allowed_now, false);
  assert.equal(result.summary.receipt_application_allowed_now, false);
  assert.equal(result.summary.enterprise_trust_claim_allowed_now, false);
});
