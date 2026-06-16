import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildExecutionReadinessModel,
  parseExecutionReadinessModelArgs,
  runExecutionReadinessModel,
  validateExecutionReadinessModelResult,
} from "../src/execution-readiness-model.mjs";
import { buildExecutionApiRouteResponse } from "../src/execution-api-router.mjs";
import { buildReviewApiResponse } from "../src/review-api.mjs";

const RUN_AT = "2026-06-16T09:00:00.000Z";

test("execution readiness model projects L0 and L1 ready while keeping execution levels blocked", async () => {
  const result = await buildExecutionReadinessModel({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.execution_readiness_status, "ready_for_execution_readiness_api");
  assert.equal(result.summary.ready_source_count, result.summary.source_count);
  assert.equal(result.execution_readiness_rows.find((row) => row.level === "L0").readiness_status, "ready");
  assert.equal(result.execution_readiness_rows.find((row) => row.level === "L1").readiness_status, "ready");
  assert.equal(result.execution_readiness_rows.find((row) => row.level === "L2").readiness_status, "blocked");
  assert.equal(result.execution_readiness_boundary.execution_allowed_now, false);
  assert.equal(result.execution_readiness_boundary.route_handler_invokes_runtime, false);
  assert.equal(result.execution_readiness_boundary.route_handler_writes_ledger, false);
});

test("execution readiness model turns missing sources into blocker rows", async () => {
  const result = await buildExecutionReadinessModel({
    runAt: RUN_AT,
    write: false,
    sourceOverrides: {
      execution_schema_registry: { available: false, validation_valid: false, error: "fixture_missing_schema_registry", data: null },
      desktop_read_model: { available: false, validation_valid: false, error: "fixture_missing_desktop", data: null },
      agent_bridge_limited_runtime_plan: { available: false, validation_valid: false, error: "fixture_missing_agent_bridge", data: null },
      factory_stage_read_model: { available: false, validation_valid: false, error: "fixture_missing_factory_stage", data: null },
      factory_g_series_runtime_guards: { available: false, validation_valid: false, error: "fixture_missing_runtime_guards", data: null },
      personal_dev_execution_candidate_lane: { available: false, validation_valid: false, error: "fixture_missing_personal_dev_candidates", data: null },
    },
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.source_blocker_count, result.summary.source_count);
  assert.equal(result.execution_readiness_source_rows.every((row) => row.source_status === "blocked" && row.blocker_reason), true);
  assert.equal(result.execution_readiness_rows.find((row) => row.level === "L0").readiness_status, "blocked");
});

test("execution readiness validation fails if route opens mutation or runtime invocation", async () => {
  const result = await buildExecutionReadinessModel({ runAt: RUN_AT, write: false });
  const schema = JSON.parse(await readFile("schemas/execution-readiness-model.schema.json", "utf8"));
  const tampered = JSON.parse(JSON.stringify(result));
  delete tampered.markdown;
  tampered.execution_readiness_route_rows[0].route_invokes_runtime = true;
  tampered.execution_readiness_boundary.execution_allowed_now = true;

  const validation = validateExecutionReadinessModelResult(tampered, schema);
  assert.equal(validation.validation.valid, false);
  assert.equal(validation.validation.errors.some((error) => error.path === "execution_readiness_route_rows"), true);
});

test("execution readiness API route is GET and HEAD only", async () => {
  const url = new URL("http://127.0.0.1/api/execution/readiness?level=L0");
  const get = await buildExecutionApiRouteResponse({
    pathname: "/api/execution/readiness",
    url,
    method: "GET",
    options: { runAt: RUN_AT },
    generatedAt: RUN_AT,
  });
  assert.equal(get.handled, true);
  assert.equal(get.status, 200);
  assert.equal(get.body.collection, "execution_readiness_rows");
  assert.equal(get.body.count, 1);
  assert.equal(get.body.items[0].level, "L0");
  assert.equal(get.body.boundary.route_handler_invokes_runtime, false);

  const head = await buildExecutionApiRouteResponse({
    pathname: "/api/execution/readiness",
    url,
    method: "HEAD",
    options: { runAt: RUN_AT },
    generatedAt: RUN_AT,
  });
  assert.equal(head.status, 200);

  const denied = await buildExecutionApiRouteResponse({
    pathname: "/api/execution/readiness",
    url,
    method: "POST",
    options: { runAt: RUN_AT },
    generatedAt: RUN_AT,
  });
  assert.equal(denied.status, 405);
});

test("review API exposes execution readiness as a read-only route", async () => {
  const response = await buildReviewApiResponse("/api/execution/readiness?limit=1", {
    method: "GET",
    runAt: RUN_AT,
  });
  assert.equal(response.status, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.collection, "execution_readiness_rows");
  assert.equal(body.count, 1);
  assert.equal(body.boundary.get_head_only, true);
  assert.equal(body.boundary.execution_allowed_now, false);

  const head = await buildReviewApiResponse("/api/execution/readiness?limit=1", {
    method: "HEAD",
    runAt: RUN_AT,
  });
  assert.equal(head.status, 200);
  assert.equal(head.body, "");

  const denied = await buildReviewApiResponse("/api/execution/readiness", {
    method: "PATCH",
    runAt: RUN_AT,
  });
  assert.equal(denied.status, 405);

  const index = await buildReviewApiResponse("/api", { method: "GET", runAt: RUN_AT });
  assert.equal(JSON.parse(index.body).routes.some((route) => route.path === "/api/execution/readiness"), true);
});

test("execution readiness --check validates without overwriting artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-execution-readiness-"));
  const sentinelPath = path.join(outDir, "execution-readiness-model.json");
  const sentinel = "{ \"sentinel\": \"execution-readiness\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");
  try {
    const result = await runExecutionReadinessModel({
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

test("execution readiness CLI parser accepts only known flags", () => {
  assert.deepEqual(parseExecutionReadinessModelArgs(["--check", "--schema-path", "schemas/execution-readiness-model.schema.json"]), {
    outDir: "artifacts/execution-readiness-model/latest",
    check: true,
    write: false,
    schemaPath: "schemas/execution-readiness-model.schema.json",
  });
  assert.throws(() => parseExecutionReadinessModelArgs(["--execute"]), /Unknown argument: --execute/);
  assert.throws(() => parseExecutionReadinessModelArgs(["--out-dir"]), /Missing value for --out-dir/);
});
