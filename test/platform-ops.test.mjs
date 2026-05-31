import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { runPlatformRuntimeDriftCheck } from "../src/platform-runtime-drift.mjs";
import { runPlatformRuntimeBaseline } from "../src/platform-runtime-baseline.mjs";

test("platform runtime baseline pins reproducibility without enabling mutation", async () => {
  const result = await runPlatformRuntimeBaseline({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_runtime_baseline_status, "complete");
  assert.equal(result.summary.phase_slot, "P341");
  assert.equal(result.summary.previous_phase_slot, "P340");
  assert.equal(result.summary.next_phase_slot, "P342");
  assert.equal(result.summary.pinned_node_version, "26.0.0");
  assert.equal(result.summary.pinned_package_manager, "npm@11.12.1");
  assert.equal(result.summary.package_lock_present, true);
  assert.equal(result.summary.p340_bundle_hash_recorded, true);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
});

test("platform runtime baseline --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-runtime-baseline-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-runtime-baseline.json");
    const sentinel = "{ \"sentinel\": \"runtime-baseline\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformRuntimeBaseline({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform runtime drift check compares current state to the P341 baseline", async () => {
  const result = await runPlatformRuntimeDriftCheck({ write: false, check: true });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_runtime_drift_status, "stable");
  assert.equal(result.summary.phase_slot, "P342");
  assert.equal(result.summary.previous_phase_slot, "P341");
  assert.equal(result.summary.next_phase_slot, "P343");
  assert.equal(result.summary.baseline_phase_slot, "P341");
  assert.equal(result.summary.baseline_status, "complete");
  assert.equal(result.summary.drifted_row_count, 0);
  assert.equal(result.summary.runtime_drift_row_count, 7);
  assert.equal(result.summary.stable_runtime_drift_row_count, 7);
  assert.equal(result.summary.dependency_drift_row_count, 6);
  assert.equal(result.summary.stable_dependency_drift_row_count, 6);
  assert.equal(result.summary.read_only, true);
  assert.equal(result.summary.report_only, true);
  assert.equal(result.summary.package_mutation_performed, false);
  assert.equal(result.summary.lockfile_mutation_performed, false);
  assert.equal(result.summary.release_published, false);
  assert.equal(result.summary.desktop_source_of_truth, false);
  assert.equal(result.summary.desktop_mutation_allowed, false);
  assert.equal(result.summary.trading_live_enabled, false);
  assert.equal(result.summary.trading_full_auto_enabled, false);
  assert.equal(result.summary.trading_order_submission_allowed, false);
  assert.equal(result.summary.broker_write_allowed, false);
});

test("platform runtime drift check detects dependency drift", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-runtime-drift-detect-"));
  try {
    const packageJson = JSON.parse(await readFile("package.json", "utf8"));
    packageJson.dependencies = { "unexpected-runtime-dependency": "1.0.0" };
    const packagePath = path.join(root, "package.json");
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

    const result = await runPlatformRuntimeDriftCheck({ packagePath, write: false });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.platform_runtime_drift_status, "drift_detected");
    assert.ok(result.summary.drifted_row_ids.includes("dependency.dependency_free_core"));
    assert.ok(result.dependency_drift_rows.some((row) => row.source_row_id === "dependency.dependency_free_core" && row.drift_status === "drifted" && row.human_review_required));
    await assert.rejects(
      () => runPlatformRuntimeDriftCheck({ packagePath, write: false, check: true }),
      /Platform runtime drift check failed/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("platform runtime drift check --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-platform-runtime-drift-check-"));
  try {
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "platform-runtime-drift.json");
    const sentinel = "{ \"sentinel\": \"runtime-drift\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runPlatformRuntimeDriftCheck({ outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
