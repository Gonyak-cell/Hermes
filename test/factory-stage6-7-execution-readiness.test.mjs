import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReviewApiResponse } from "../src/review-api.mjs";
import {
  buildFactoryStage67ExecutionReadiness,
  runFactoryStage67ExecutionReadiness,
} from "../src/factory-stage6-7-execution-readiness.mjs";

const RUN_AT = "2026-06-12T20:00:00.000Z";

test("Factory Stage6/7 Execution Readiness binds FE candidates to closed runtime contracts", async () => {
  const result = await buildFactoryStage67ExecutionReadiness({
    runAt: RUN_AT,
    write: false,
    commitRef: "af3fa0d",
  });

  assert.equal(result.schema_version, "factory-stage6-7-execution-readiness.v1");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_stage6_7_execution_readiness_status, "ready_stage6_stage7_contract_development");
  assert.equal(result.summary.stage6_contract_count, 4);
  assert.equal(result.summary.stage7_contract_count, 4);
  assert.equal(result.summary.closeout_blocked_count, 3);
  assert.equal(result.summary.stage6_7_contract_development_allowed_now, true);
  assert.equal(result.summary.stage6_7_runtime_authority_open_now, false);
  assert.equal(result.summary.stage6_limited_execution_allowed_now, false);
  assert.equal(result.summary.stage7_release_candidate_allowed_now, false);
  assert.equal(result.summary.human_owner_approval_counted_as_closeout, false);

  assert.equal(result.source_summaries.fe_counts.work_packet_candidate_count, 15);
  assert.equal(result.source_summaries.fe_counts.work_item_candidate_count, 60);
  assert.equal(result.source_summaries.fe_counts.validation_loop_candidate_count, 15);
  assert.equal(result.source_summaries.fe_counts.validation_loop_step_candidate_count, 150);
  assert.equal(result.source_summaries.fe_counts.validation_loop_gate_count, 90);

  const stage6 = result.factory_stage6_execution_contract_rows.find((row) => row.contract_id === "stage6.validation_loop_runtime_contract");
  const stage7 = result.factory_stage7_release_candidate_contract_rows.find((row) => row.contract_id === "stage7.hermes_harness_pilot_rc");

  assert.equal(stage6.contract_status, "contract_development_ready_runtime_blocked");
  assert.equal(stage6.runtime_execution_allowed_now, false);
  assert.equal(stage6.command_spawn_allowed_now, false);
  assert.equal(stage7.pilot_product_id, "project.hermes_harness");
  assert.equal(stage7.release_candidate_allowed_now, false);
  assert.equal(stage7.staging_deployment_allowed_now, false);
});

test("Factory Stage6/7 Execution Readiness fails hard when FE freeze source is invalid", async () => {
  const result = await buildFactoryStage67ExecutionReadiness({
    runAt: RUN_AT,
    write: false,
    commitRef: "af3fa0d",
    feFreezeHandoff: {
      validation: { valid: false, errors: [{ item_id: "x", message: "broken" }] },
      summary: { factory_fe_freeze_handoff_status: "blocked" },
      source_summaries: { fe2_summary: {}, fe3_summary: {} },
    },
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.validation.errors.some((error) => error.item_id === "source.fe_freeze_valid"), true);
  assert.equal(result.summary.factory_stage6_7_execution_readiness_status, "blocked_factory_stage6_7_execution_readiness");
  assert.equal(result.summary.stage6_7_runtime_authority_open_now, false);
});

test("Factory Stage6/7 Execution Readiness writes artifacts and check mode does not overwrite", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-stage6-7-execution-out-"));
  try {
    const result = await runFactoryStage67ExecutionReadiness({
      outDir,
      runAt: RUN_AT,
      check: false,
      requirePass: true,
      commitRef: "af3fa0d",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-stage6-7-execution-readiness.json"), "utf8"));
    const stage6Rows = JSON.parse(await readFile(path.join(outDir, "stage6-execution-contract-rows.json"), "utf8"));
    const stage7Rows = JSON.parse(await readFile(path.join(outDir, "stage7-release-candidate-contract-rows.json"), "utf8"));
    const boundary = JSON.parse(await readFile(path.join(outDir, "boundary.json"), "utf8"));

    assert.equal(result.summary.factory_stage6_7_execution_readiness_status, "ready_stage6_stage7_contract_development");
    assert.equal(artifact.summary.stage6_contract_count, 4);
    assert.equal(stage6Rows.count, 4);
    assert.equal(stage7Rows.count, 4);
    assert.equal(boundary.stage6_7_runtime_authority_open_now, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }

  const checkDir = await mkdtemp(path.join(os.tmpdir(), "factory-stage6-7-execution-check-"));
  try {
    const sentinelPath = path.join(checkDir, "factory-stage6-7-execution-readiness.json");
    const sentinel = '{ "sentinel": "factory-stage6-7-execution-readiness" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-stage6-7-execution-readiness.mjs",
      "--check",
      "--require-pass",
      "--out-dir",
      checkDir,
      "--run-at",
      RUN_AT,
      "--commit-ref",
      "af3fa0d",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(checkDir, { recursive: true, force: true });
  }
});

test("Review API exposes Stage6/7 execution readiness as read-only rows", async () => {
  const response = await buildReviewApiResponse("/api/factory/stage6-7-execution-readiness?stage_id=Stage7", {
    runAt: RUN_AT,
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.collection, "factory_stage6_7_execution_readiness_items");
  assert.equal(body.read_only, true);
  assert.equal(body.mutation_allowed, false);
  assert.equal(body.count, 6);
  assert.equal(body.items.every((item) => item.stage_id === "Stage7"), true);
  assert.equal(body.stage6_7_contract_development_allowed_now, true);
  assert.equal(body.stage6_7_runtime_authority_open_now, false);
  assert.equal(body.human_owner_approval_counted_as_closeout, false);
});
