import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReviewApiResponse } from "../src/review-api.mjs";
import {
  buildFactoryGSeriesRuntimeGuards,
  runFactoryGSeriesRuntimeGuards,
} from "../src/factory-g-series-runtime-guards.mjs";

const RUN_AT = "2026-06-12T19:30:00.000Z";

test("Factory G-series Runtime Guards block G1b/G2/G3 and Stage6/Stage7 protected attempts", async () => {
  const result = await buildFactoryGSeriesRuntimeGuards({
    runAt: RUN_AT,
    write: false,
    commitRef: "af3fa0d",
  });

  assert.equal(result.schema_version, "factory-g-series-runtime-guards.v1");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_g_series_runtime_guards_status, "ready_runtime_guards_block_protected_actions");
  assert.equal(result.summary.runtime_guard_count, 5);
  assert.equal(result.summary.runtime_guard_blocked_count, 5);
  assert.equal(result.summary.g_series_code_development_allowed_now, true);
  assert.equal(result.summary.g_series_runtime_authority_open_now, false);
  assert.equal(result.summary.mutation_allowed_now, false);
  assert.equal(result.summary.command_spawn_allowed_now, false);
  assert.equal(result.summary.human_owner_approval_counted_as_closeout, false);

  const repoWrite = result.factory_g_series_runtime_guard_rows.find((row) => row.attempt_kind === "g1b_repo_write_patch_apply");
  const command = result.factory_g_series_runtime_guard_rows.find((row) => row.attempt_kind === "g2_command_execution");
  const deploy = result.factory_g_series_runtime_guard_rows.find((row) => row.attempt_kind === "g3_deployment_staging");
  const stage6 = result.factory_g_series_runtime_guard_rows.find((row) => row.attempt_kind === "stage6_limited_execution_runtime");
  const stage7 = result.factory_g_series_runtime_guard_rows.find((row) => row.attempt_kind === "stage7_pilot_release_candidate");

  assert.equal(repoWrite.guard_status, "blocked_as_expected");
  assert.equal(repoWrite.required_gate_source_evidence_complete_now, true);
  assert.deepEqual(repoWrite.blocked_reason_ids, ["repo_write_runtime_authority_closed"]);
  assert.equal(command.guard_verdict, "pass_blocked");
  assert.deepEqual(command.blocked_reason_ids, ["command_execution_runtime_authority_closed"]);
  assert.equal(deploy.deployment_allowed_now, false);
  assert.equal(stage6.command_spawn_allowed_now, false);
  assert.equal(stage7.protected_action_allowed_now, false);
  assert.equal(result.factory_g_series_runtime_guard_rows.every((row) => row.no_process_spawned === true), true);
  assert.equal(result.factory_g_series_runtime_guard_rows.every((row) => row.no_files_written_by_guard === true), true);
});

test("Factory G-series Runtime Guards can isolate one protected attempt kind", async () => {
  const result = await buildFactoryGSeriesRuntimeGuards({
    runAt: RUN_AT,
    write: false,
    commitRef: "af3fa0d",
    attemptKind: "g2_command_execution",
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.runtime_guard_count, 1);
  assert.equal(result.factory_g_series_runtime_guard_rows[0].attempt_kind, "g2_command_execution");
  assert.equal(result.factory_g_series_runtime_guard_rows[0].required_gate_id, "G2");
  assert.equal(result.factory_g_series_runtime_guard_rows[0].required_gate_source_evidence_complete_now, true);
  assert.equal(result.factory_g_series_runtime_guard_rows[0].guard_status, "blocked_as_expected");
});

test("Factory G-series Runtime Guards fail hard for an unknown attempt kind", async () => {
  const result = await buildFactoryGSeriesRuntimeGuards({
    runAt: RUN_AT,
    write: false,
    commitRef: "af3fa0d",
    attemptKind: "unknown_attempt",
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.validation.errors.some((error) => error.item_id === "guards.rows_present"), true);
  assert.equal(result.summary.factory_g_series_runtime_guards_status, "blocked_factory_g_series_runtime_guards");
  assert.equal(result.summary.g_series_runtime_authority_open_now, false);
});

test("Factory G-series Runtime Guards write artifacts and check mode does not overwrite", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-g-series-runtime-guards-out-"));
  try {
    const result = await runFactoryGSeriesRuntimeGuards({
      outDir,
      runAt: RUN_AT,
      check: false,
      requirePass: true,
      commitRef: "af3fa0d",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-g-series-runtime-guards.json"), "utf8"));
    const guardRows = JSON.parse(await readFile(path.join(outDir, "runtime-guard-rows.json"), "utf8"));
    const boundary = JSON.parse(await readFile(path.join(outDir, "boundary.json"), "utf8"));

    assert.equal(result.summary.factory_g_series_runtime_guards_status, "ready_runtime_guards_block_protected_actions");
    assert.equal(artifact.summary.runtime_guard_count, 5);
    assert.equal(guardRows.count, 5);
    assert.equal(boundary.command_spawn_allowed_now, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }

  const checkDir = await mkdtemp(path.join(os.tmpdir(), "factory-g-series-runtime-guards-check-"));
  try {
    const sentinelPath = path.join(checkDir, "factory-g-series-runtime-guards.json");
    const sentinel = '{ "sentinel": "factory-g-series-runtime-guards" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-g-series-runtime-guards.mjs",
      "--check",
      "--require-pass",
      "--attempt-kind",
      "stage7_pilot_release_candidate",
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

test("Review API exposes G-series runtime guards as read-only simulated rows", async () => {
  const response = await buildReviewApiResponse("/api/factory/g-series-runtime-guards?attempt_kind=g1b_repo_write_patch_apply", {
    runAt: RUN_AT,
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.collection, "factory_g_series_runtime_guard_rows");
  assert.equal(body.read_only, true);
  assert.equal(body.simulated_only, true);
  assert.equal(body.mutation_allowed, false);
  assert.equal(body.count, 1);
  assert.equal(body.items[0].attempt_kind, "g1b_repo_write_patch_apply");
  assert.equal(body.items[0].guard_status, "blocked_as_expected");
  assert.equal(body.command_spawn_allowed_now, false);
  assert.equal(body.human_owner_approval_counted_as_closeout, false);
});
