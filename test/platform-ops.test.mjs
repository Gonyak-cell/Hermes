import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
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
