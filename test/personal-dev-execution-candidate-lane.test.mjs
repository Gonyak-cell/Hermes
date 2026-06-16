import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildPersonalDevExecutionCandidateLane,
  parsePersonalDevExecutionCandidateLaneArgs,
  runPersonalDevExecutionCandidateLane,
} from "../src/personal-dev-execution-candidate-lane.mjs";
import { EXECUTION_SCHEMA_SPECS } from "../src/execution-schema-registry.mjs";
import { buildExecutionApiRouteResponse } from "../src/execution-api-router.mjs";
import { buildReviewApiResponse } from "../src/review-api.mjs";

const RUN_AT = "2026-06-16T10:00:00.000Z";
const PANEL_SECTIONS = ["repo", "worktree", "plan", "diff", "test", "pr"];

function executionSchemaRegistryFixture(overrides = {}) {
  return {
    schema_version: "execution-schema-registry.v1",
    validation: { valid: true, errors: [] },
    summary: {
      execution_schema_registry_status: "ready_for_execution_schema_registry",
      schema_count: EXECUTION_SCHEMA_SPECS.length,
      valid_schema_count: EXECUTION_SCHEMA_SPECS.length,
      execution_authority_opened_now: false,
    },
    execution_schema_rows: EXECUTION_SCHEMA_SPECS.map((spec) => ({
      schema_id: spec.schema_id,
      file_name: spec.file_name,
      schema_sha256: "a".repeat(64),
      validation: { valid: true, errors: [] },
    })),
    ...overrides,
  };
}

function personalDevDashboardApiFixture(overrides = {}) {
  return {
    schema_version: "personal-dev-dashboard-api.v1",
    validation: { valid: true, errors: [] },
    summary: {
      personal_dev_dashboard_api_status: "complete",
      panel_row_count: PANEL_SECTIONS.length,
      ready_panel_row_count: PANEL_SECTIONS.length,
      command_execution_performed: false,
      mutation_performed: false,
      pull_request_creation_performed: false,
    },
    personal_dev_panel_rows: PANEL_SECTIONS.map((section) => ({
      schema_version: "personal-dev-panel-row.v1",
      panel_row_id: `personal-dev-panel-row.${section}`,
      panel_section: section,
      label: section,
      panel_status: "ready",
      source_status: "complete",
      summary_line: `${section} panel ready`,
      metrics: {},
      source_artifact_ids: [`artifact.${section}`],
      api_route_group_id: `personal-dev-api-route-group.${section}`,
      read_only: true,
      mutation_allowed: false,
      command_execution_allowed: false,
      human_review_required: true,
    })),
    ...overrides,
  };
}

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    executionSchemaRegistry: executionSchemaRegistryFixture(),
    personalDevDashboardApi: personalDevDashboardApiFixture(),
    ...overrides,
  };
}

test("personal-dev execution candidate lane binds dashboard rows to execution schemas without opening execution", async () => {
  const result = await buildPersonalDevExecutionCandidateLane(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "personal-dev-execution-candidate-lane.v1");
  assert.equal(result.summary.personal_dev_execution_candidate_lane_status, "ready_for_personal_dev_execution_candidate_lane");
  assert.equal(result.summary.candidate_row_count, 6);
  assert.equal(result.summary.ready_candidate_row_count, 6);
  assert.equal(result.summary.artifact_binding_row_count, EXECUTION_SCHEMA_SPECS.length);
  assert.equal(result.summary.ready_artifact_binding_row_count, EXECUTION_SCHEMA_SPECS.length);
  assert.equal(result.summary.ready_for_l1_handoff, true);
  assert.equal(result.summary.l1_blocker_resolved_now, true);
  assert.equal(result.summary.execution_allowed_now, false);
  assert.equal(result.summary.execution_request_created_now, false);
  assert.equal(result.summary.command_execution_allowed_now, false);
  assert.equal(result.summary.file_write_allowed_now, false);
  assert.equal(result.summary.pull_request_creation_allowed_now, false);
  assert.equal(result.summary.deployment_allowed_now, false);
});

test("personal-dev execution candidate lane exposes one ready candidate for each personal-dev panel section", async () => {
  const result = await buildPersonalDevExecutionCandidateLane(options());
  const sections = new Set(result.personal_dev_execution_candidate_rows.map((row) => row.source_panel_section));

  for (const section of PANEL_SECTIONS) assert.equal(sections.has(section), true);
  assert.equal(result.personal_dev_execution_candidate_rows.every((row) => row.candidate_status === "ready" && row.read_only === true), true);
  assert.equal(result.personal_dev_execution_candidate_rows.every((row) => row.execution_request_created_now === false && row.command_invocation_created_now === false), true);
});

test("personal-dev execution candidate lane blocks L1 handoff when the dashboard source is not ready", async () => {
  const dashboard = personalDevDashboardApiFixture({
    validation: { valid: false, errors: [{ path: "fixture", message: "blocked" }] },
    summary: { personal_dev_dashboard_api_status: "blocked" },
    personal_dev_panel_rows: [],
  });
  const result = await buildPersonalDevExecutionCandidateLane(options({ personalDevDashboardApi: dashboard }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.personal_dev_execution_candidate_lane_status, "blocked_personal_dev_execution_candidate_lane");
  assert.equal(result.summary.ready_for_l1_handoff, false);
  assert.equal(result.personal_dev_execution_candidate_rows.every((row) => row.candidate_status === "blocked"), true);
});

test("personal-dev execution candidate lane blocks when an execution schema binding is missing", async () => {
  const registry = executionSchemaRegistryFixture({
    execution_schema_rows: EXECUTION_SCHEMA_SPECS.map((spec) => ({
      schema_id: spec.schema_id,
      file_name: spec.file_name,
      schema_sha256: "a".repeat(64),
      validation: { valid: spec.schema_id !== "command_invocation", errors: spec.schema_id === "command_invocation" ? [{ path: "command_invocation", message: "fixture missing" }] : [] },
    })),
  });
  const result = await buildPersonalDevExecutionCandidateLane(options({ executionSchemaRegistry: registry }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.ready_for_l1_handoff, false);
  assert.equal(result.personal_dev_execution_candidate_rows.find((row) => row.source_panel_section === "worktree").candidate_status, "blocked");
});

test("personal-dev execution candidate lane boundary keeps execution, write, PR, deploy, protected, and trust authority closed", async () => {
  const result = await buildPersonalDevExecutionCandidateLane(options());
  const boundary = result.personal_dev_execution_candidate_boundary;

  assert.equal(boundary.candidate_projection_generated_now, true);
  assert.equal(boundary.execution_request_created_now, false);
  assert.equal(boundary.command_invocation_created_now, false);
  assert.equal(boundary.execution_receipt_created_now, false);
  assert.equal(boundary.patch_generated_now, false);
  assert.equal(boundary.patch_applied_now, false);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.command_execution_allowed_now, false);
  assert.equal(boundary.file_write_allowed_now, false);
  assert.equal(boundary.github_api_allowed_now, false);
  assert.equal(boundary.pull_request_creation_allowed_now, false);
  assert.equal(boundary.merge_allowed_now, false);
  assert.equal(boundary.release_allowed_now, false);
  assert.equal(boundary.deployment_allowed_now, false);
  assert.equal(boundary.production_allowed_now, false);
  assert.equal(boundary.protected_output_allowed_now, false);
  assert.equal(boundary.owner_approval_counts_as_independent_review, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
});

test("execution API exposes personal-dev execution candidates as GET and HEAD only", async () => {
  const url = new URL("http://127.0.0.1/api/execution/personal-dev-candidates?source_panel_section=repo");
  const get = await buildExecutionApiRouteResponse({
    pathname: "/api/execution/personal-dev-candidates",
    url,
    method: "GET",
    options: options(),
    generatedAt: RUN_AT,
  });
  assert.equal(get.handled, true);
  assert.equal(get.status, 200);
  assert.equal(get.body.collection, "personal_dev_execution_candidate_rows");
  assert.equal(get.body.count, 1);
  assert.equal(get.body.items[0].source_panel_section, "repo");
  assert.equal(get.body.boundary.command_execution_allowed_now, false);

  const head = await buildExecutionApiRouteResponse({
    pathname: "/api/execution/personal-dev-candidates",
    url,
    method: "HEAD",
    options: options(),
    generatedAt: RUN_AT,
  });
  assert.equal(head.status, 200);

  const denied = await buildExecutionApiRouteResponse({
    pathname: "/api/execution/personal-dev-candidates",
    url,
    method: "POST",
    options: options(),
    generatedAt: RUN_AT,
  });
  assert.equal(denied.status, 405);
});

test("review API route index includes personal-dev execution candidates", async () => {
  const response = await buildReviewApiResponse("/api/execution/personal-dev-candidates?limit=2", {
    method: "GET",
    runAt: RUN_AT,
    executionSchemaRegistry: executionSchemaRegistryFixture(),
    personalDevDashboardApi: personalDevDashboardApiFixture(),
  });
  assert.equal(response.status, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.collection, "personal_dev_execution_candidate_rows");
  assert.equal(body.count, 2);
  assert.equal(body.boundary.pull_request_creation_allowed_now, false);

  const index = await buildReviewApiResponse("/api", { method: "GET", runAt: RUN_AT });
  assert.equal(JSON.parse(index.body).routes.some((route) => route.path === "/api/execution/personal-dev-candidates"), true);
});

test("personal-dev execution candidate lane --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-personal-dev-execution-candidates-"));
  const sentinelPath = path.join(outDir, "personal-dev-execution-candidate-lane.json");
  const sentinel = "{ \"sentinel\": \"personal-dev-execution-candidates\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");
  try {
    const result = await runPersonalDevExecutionCandidateLane(options({
      check: true,
      write: false,
      outDir,
    }));

    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("personal-dev execution candidate lane CLI parser accepts only known flags", () => {
  assert.deepEqual(parsePersonalDevExecutionCandidateLaneArgs(["--check", "--schema-path", "schemas/personal-dev-execution-candidate-lane.schema.json"]), {
    outDir: "artifacts/personal-dev-execution-candidate-lane/latest",
    check: true,
    write: false,
    schemaPath: "schemas/personal-dev-execution-candidate-lane.schema.json",
  });
  assert.throws(() => parsePersonalDevExecutionCandidateLaneArgs(["--execute"]), /Unknown argument: --execute/);
  assert.throws(() => parsePersonalDevExecutionCandidateLaneArgs(["--out-dir"]), /Missing value for --out-dir/);
});
