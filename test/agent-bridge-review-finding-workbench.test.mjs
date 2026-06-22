import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildAgentBridgeReviewFindingWorkbench,
  parseAgentBridgeReviewFindingWorkbenchArgs,
  runAgentBridgeReviewFindingWorkbench,
  validateAgentBridgeReviewFindingWorkbenchResult,
} from "../src/agent-bridge-review-finding-workbench.mjs";

const RUN_AT = "2026-06-16T10:00:00.000Z";

test("Agent Bridge review finding workbench builds visible unresolved finding seeds", async () => {
  const result = await buildAgentBridgeReviewFindingWorkbench({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "agent-bridge-review-finding-workbench.v1");
  assert.equal(result.summary.agent_bridge_review_finding_workbench_status, "ready_for_agent_bridge_review_finding_workbench");
  assert.equal(result.summary.source_agent_bridge_receipt_import_workspace_status, "ready_for_agent_bridge_receipt_import_workspace");
  assert.equal(result.agent_review_finding_seed_rows.length, 4);
  assert.equal(result.agent_review_finding_action_rows.length, 4);
  assert.equal(result.summary.blocking_finding_count >= 1, true);
  assert.equal(result.summary.finding_resolution_allowed_now, false);
  assert.equal(result.summary.clean_checkpoint_allowed_now, false);
  assert.equal(result.summary.patch_apply_allowed_now, false);
});

test("Agent Bridge review finding rows never resolve, verify, fix, apply, approve, or execute", async () => {
  const result = await buildAgentBridgeReviewFindingWorkbench({ runAt: RUN_AT, write: false });

  assert.equal(result.agent_review_finding_seed_rows.every((row) => row.finding_seed_visible_now === true), true);
  assert.equal(result.agent_review_finding_seed_rows.every((row) => row.finding_resolution_allowed_now === false), true);
  assert.equal(result.agent_review_finding_seed_rows.every((row) => row.finding_status_fixed_allowed_now === false), true);
  assert.equal(result.agent_review_finding_seed_rows.every((row) => row.finding_status_verified_allowed_now === false), true);
  assert.equal(result.agent_review_finding_seed_rows.every((row) => row.finding_status_resolved_allowed_now === false), true);
  assert.equal(result.agent_review_finding_seed_rows.every((row) => row.clean_checkpoint_allowed_now === false), true);
  assert.equal(result.agent_review_finding_seed_rows.every((row) => row.patch_apply_allowed_now === false), true);
  assert.equal(result.agent_review_finding_seed_rows.every((row) => row.approval_application_allowed_now === false), true);
  assert.equal(result.agent_review_finding_seed_rows.every((row) => row.execution_allowed_now === false), true);
  assert.equal(result.agent_review_finding_action_rows.every((row) => row.action_mutates_state === false && row.action_executes_command === false && row.action_applies_patch === false), true);
});

test("Agent Bridge review finding workbench blocks unsafe resolution fixtures", async () => {
  const result = await buildAgentBridgeReviewFindingWorkbench({ runAt: RUN_AT, write: false });

  assert.equal(result.blocked_finding_resolution_fixture_rows.length >= 10, true);
  assert.equal(result.blocked_finding_resolution_fixture_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.blocked_finding_resolution_fixture_rows.every((row) => row.blocked === true), true);
  assert.equal(result.blocked_finding_resolution_fixture_rows.every((row) => row.finding_resolution_allowed_now === false), true);
  assert.equal(result.blocked_finding_resolution_fixture_rows.every((row) => row.opens_authority === false), true);
});

test("Agent Bridge review finding workbench validation fails if finding resolution opens", async () => {
  const result = await buildAgentBridgeReviewFindingWorkbench({ runAt: RUN_AT, write: false });
  const schema = JSON.parse(await readFile("schemas/agent-bridge-review-finding-workbench.schema.json", "utf8"));
  const tampered = JSON.parse(JSON.stringify(result));
  delete tampered.markdown;
  tampered.agent_review_finding_seed_rows[0].finding_resolution_allowed_now = true;
  tampered.agent_review_finding_seed_rows[0].clean_checkpoint_allowed_now = true;
  tampered.agent_review_finding_workbench_boundary.finding_resolution_allowed_now = true;
  tampered.summary.finding_resolution_allowed_now = true;

  const validation = validateAgentBridgeReviewFindingWorkbenchResult(tampered, schema);
  assert.equal(validation.validation.valid, false);
  assert.equal(validation.validation.errors.some((error) => error.path === "findings.no_resolution"), true);
  assert.equal(validation.validation.errors.some((error) => error.path === "boundary.no_authority"), true);
});

test("Agent Bridge review finding workbench --check validates without overwriting artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-agent-bridge-review-finding-workbench-"));
  const sentinelPath = path.join(outDir, "agent-bridge-review-finding-workbench.json");
  const sentinel = "{ \"sentinel\": \"agent-bridge-review-finding-workbench\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");
  try {
    const result = await runAgentBridgeReviewFindingWorkbench({
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

test("Agent Bridge review finding workbench CLI parser accepts only known flags", () => {
  assert.deepEqual(parseAgentBridgeReviewFindingWorkbenchArgs(["--check", "--schema-path", "schemas/example.json"]), {
    check: true,
    write: false,
    schemaPath: "schemas/example.json",
  });
  assert.throws(() => parseAgentBridgeReviewFindingWorkbenchArgs(["--resolve"]), /Unknown argument: --resolve/);
  assert.throws(() => parseAgentBridgeReviewFindingWorkbenchArgs(["--source-agent-bridge-receipt-import-workspace-path"]), /Missing value for --source-agent-bridge-receipt-import-workspace-path/);
});
