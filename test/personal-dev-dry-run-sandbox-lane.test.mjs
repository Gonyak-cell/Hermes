import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildExecutionApiRouteResponse } from "../src/execution-api-router.mjs";
import { buildReviewApiResponse } from "../src/review-api.mjs";
import {
  buildPersonalDevDryRunSandboxLane,
  parsePersonalDevDryRunSandboxLaneArgs,
  runPersonalDevDryRunSandboxLane,
} from "../src/personal-dev-dry-run-sandbox-lane.mjs";

const RUN_AT = "2026-06-16T10:00:00.000Z";

test("personal-dev dry-run sandbox lane opens L2 projection without execution", async () => {
  const result = await buildPersonalDevDryRunSandboxLane({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "personal-dev-dry-run-sandbox-lane.v1");
  assert.equal(result.capability_id, "personal_dev.dry_run_sandbox_lane");
  assert.equal(result.summary.personal_dev_dry_run_sandbox_lane_status, "ready_for_personal_dev_dry_run_sandbox_lane");
  assert.equal(result.summary.dry_run_row_count, 6);
  assert.equal(result.summary.ready_dry_run_row_count, 6);
  assert.equal(result.summary.invocation_row_count, 6);
  assert.equal(result.summary.planned_invocation_row_count, 6);
  assert.equal(result.summary.ready_for_l2_handoff, true);
  assert.equal(result.summary.l2_blocker_resolved_now, true);
  assert.equal(result.summary.worktree_created_now, false);
  assert.equal(result.summary.actual_runtime_called_now, false);
  assert.equal(result.summary.actual_command_executed_now, false);
});

test("personal-dev dry-run rows print intended commands only", async () => {
  const result = await buildPersonalDevDryRunSandboxLane({ runAt: RUN_AT, write: false });

  assert.equal(result.personal_dev_dry_run_sandbox_rows.every((row) => row.printed_intended_command.startsWith("DRY RUN ONLY: ")), true);
  assert.equal(result.personal_dev_dry_run_sandbox_rows.every((row) => row.requested_isolation === "git_worktree"), true);
  assert.equal(result.personal_dev_dry_run_sandbox_rows.every((row) => row.actual_isolation === "not_created"), true);
  assert.equal(result.personal_dev_dry_run_sandbox_rows.every((row) => row.worktree_created_now === false), true);
  assert.equal(result.personal_dev_dry_run_sandbox_rows.every((row) => row.command_invocation_created_now === false), true);
  assert.equal(result.personal_dev_dry_run_sandbox_rows.every((row) => row.actual_command_executed_now === false), true);
  assert.equal(result.personal_dev_dry_run_sandbox_rows.every((row) => row.command_output_captured_now === false), true);
});

test("personal-dev dry-run invocation rows use runtime-invoker dry-run ledger semantics", async () => {
  const result = await buildPersonalDevDryRunSandboxLane({ runAt: RUN_AT, write: false });

  assert.equal(result.personal_dev_dry_run_invocation_rows.every((row) => row.runtime_id === "codex"), true);
  assert.equal(result.personal_dev_dry_run_invocation_rows.every((row) => row.mode === "dry-run"), true);
  assert.equal(result.personal_dev_dry_run_invocation_rows.every((row) => row.invocation_status === "planned"), true);
  assert.equal(result.personal_dev_dry_run_invocation_rows.every((row) => row.binding_status === "not_requested"), true);
  assert.equal(result.personal_dev_dry_run_invocation_rows.every((row) => row.command_bound === false), true);
  assert.equal(result.personal_dev_dry_run_invocation_rows.every((row) => row.actual_runtime_called_now === false), true);
  assert.equal(result.personal_dev_dry_run_invocation_rows.every((row) => row.actual_command_executed_now === false), true);
});

test("personal-dev dry-run boundary keeps mutation, PR, deploy, raw output, and trust closed", async () => {
  const result = await buildPersonalDevDryRunSandboxLane({ runAt: RUN_AT, write: false });
  const boundary = result.personal_dev_dry_run_boundary;

  assert.equal(boundary.execution_allowed_now, false);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.command_execution_allowed_now, false);
  assert.equal(boundary.file_write_allowed_now, false);
  assert.equal(boundary.git_command_allowed_now, false);
  assert.equal(boundary.github_api_allowed_now, false);
  assert.equal(boundary.pull_request_creation_allowed_now, false);
  assert.equal(boundary.merge_allowed_now, false);
  assert.equal(boundary.release_allowed_now, false);
  assert.equal(boundary.deployment_allowed_now, false);
  assert.equal(boundary.raw_secret_access_allowed_now, false);
  assert.equal(boundary.raw_stdout_stored, false);
  assert.equal(boundary.raw_stderr_stored, false);
  assert.equal(boundary.owner_approval_counts_as_independent_review, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("personal-dev dry-run lane blocks if candidate lane source is not ready", async () => {
  const ready = await buildPersonalDevDryRunSandboxLane({ runAt: RUN_AT, write: false });
  const blockedSource = {
    ...ready.source_personal_dev_execution_candidate_lane_summary,
  };
  const result = await buildPersonalDevDryRunSandboxLane({
    runAt: RUN_AT,
    write: false,
    personalDevExecutionCandidateLane: {
      schema_version: "personal-dev-execution-candidate-lane.v1",
      validation: { valid: true, errors: [] },
      summary: {
        ...blockedSource,
        personal_dev_execution_candidate_lane_status: "blocked_personal_dev_execution_candidate_lane",
      },
      personal_dev_execution_candidate_rows: ready.personal_dev_dry_run_sandbox_rows.map((row) => ({
        candidate_id: row.candidate_id,
        candidate_kind: row.candidate_kind,
        source_panel_section: row.source_panel_section,
        candidate_status: "ready",
        read_only: true,
        command_execution_allowed_now: false,
        file_write_allowed_now: false,
      })),
    },
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.personal_dev_dry_run_sandbox_lane_status, "blocked_personal_dev_dry_run_sandbox_lane");
  assert.equal(result.personal_dev_dry_run_boundary.source_personal_dev_execution_candidate_lane_ready, false);
  assert.equal(result.summary.ready_for_l2_handoff, false);
});

test("personal-dev dry-run lane blocks if limited runtime source opens execution", async () => {
  const result = await buildPersonalDevDryRunSandboxLane({
    runAt: RUN_AT,
    write: false,
    agentBridgeLimitedRuntimePlan: {
      schema_version: "agent-bridge-limited-runtime-plan.v1",
      validation: { valid: true, errors: [] },
      summary: {
        agent_bridge_limited_runtime_plan_status: "ready_for_agent_bridge_limited_runtime_plan",
        execution_allowed_now: true,
        command_executed_now: false,
      },
    },
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.personal_dev_dry_run_boundary.source_agent_bridge_limited_runtime_plan_ready, false);
  assert.equal(result.summary.ready_for_l2_handoff, false);
});

test("execution and review APIs expose personal-dev dry-runs as read-only", async () => {
  const url = new URL("http://127.0.0.1/api/execution/personal-dev-dry-runs?dry_run_status=ready&limit=2");
  const api = await buildExecutionApiRouteResponse({
    pathname: "/api/execution/personal-dev-dry-runs",
    url,
    method: "GET",
    options: { runAt: RUN_AT },
    generatedAt: RUN_AT,
  });
  assert.equal(api.status, 200);
  assert.equal(api.body.collection, "personal_dev_dry_run_sandbox_rows");
  assert.equal(api.body.count, 2);
  assert.equal(api.body.boundary.actual_command_executed_now, false);

  const review = await buildReviewApiResponse("/api/execution/personal-dev-dry-runs?limit=1", {
    method: "GET",
    runAt: RUN_AT,
  });
  assert.equal(review.status, 200);
  const body = JSON.parse(review.body);
  assert.equal(body.collection, "personal_dev_dry_run_sandbox_rows");
  assert.equal(body.count, 1);
  assert.equal(body.boundary.get_head_only, true);
  assert.equal(body.boundary.actual_runtime_called_now, false);

  const denied = await buildReviewApiResponse("/api/execution/personal-dev-dry-runs", {
    method: "PATCH",
    runAt: RUN_AT,
  });
  assert.equal(denied.status, 405);

  const index = await buildReviewApiResponse("/api", { method: "GET", runAt: RUN_AT });
  assert.equal(JSON.parse(index.body).routes.some((route) => route.path === "/api/execution/personal-dev-dry-runs"), true);
});

test("personal-dev dry-run --check validates without overwriting artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "personal-dev-dry-run-sandbox-"));
  const sentinelPath = path.join(outDir, "personal-dev-dry-run-sandbox-lane.json");
  const sentinel = "{ \"sentinel\": \"personal-dev-dry-run-sandbox\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");
  try {
    const result = await runPersonalDevDryRunSandboxLane({
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

test("personal-dev dry-run CLI parser accepts only known flags", () => {
  assert.deepEqual(parsePersonalDevDryRunSandboxLaneArgs(["--check", "--schema-path", "schemas/personal-dev-dry-run-sandbox-lane.schema.json"]), {
    outDir: "artifacts/personal-dev-dry-run-sandbox-lane/latest",
    check: true,
    write: false,
    schemaPath: "schemas/personal-dev-dry-run-sandbox-lane.schema.json",
  });
  assert.throws(() => parsePersonalDevDryRunSandboxLaneArgs(["--execute"]), /Unknown argument: --execute/);
  assert.throws(() => parsePersonalDevDryRunSandboxLaneArgs(["--out-dir"]), /Missing value for --out-dir/);
});
