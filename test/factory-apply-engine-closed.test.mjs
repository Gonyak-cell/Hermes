import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFactoryApplyEngineClosed,
  runFactoryApplyEngineClosed,
} from "../src/factory-apply-engine-closed.mjs";

const RUN_AT = "2026-06-12T06:00:00.000Z";

test("Factory Apply Engine Closed validates receipt-consuming apply intents without opening runtime", async () => {
  const result = await buildFactoryApplyEngineClosed({
    runAt: RUN_AT,
    write: false,
    commitRef: "5c8f87a",
  });

  assert.equal(result.schema_version, "factory-apply-engine-closed.v1");
  assert.equal(result.program_range, "FCORE-FD.2");
  assert.equal(result.source_program_range, "FCORE-FD.1");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_apply_engine_closed_status, "ready_factory_apply_engine_closed");
  assert.equal(result.summary.apply_intent_count, 3);
  assert.equal(result.summary.apply_intent_blocked_count, 3);
  assert.equal(result.summary.rollback_verification_count, 3);
  assert.equal(result.summary.rollback_verification_blocked_count, 3);
  assert.equal(result.summary.negative_fixture_count, 5);
  assert.equal(result.summary.negative_fixture_passed_count, 5);
  assert.equal(result.summary.receipt_apply_engine_reachable_now, false);
  assert.equal(result.summary.apply_engine_runtime_enabled_now, false);
  assert.equal(result.summary.rollback_executor_runtime_enabled_now, false);
  assert.equal(result.summary.runtime_state_mutated_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
});

test("Factory Apply Engine Closed keeps apply and rollback negative fixtures blocked", async () => {
  const result = await buildFactoryApplyEngineClosed({
    runAt: RUN_AT,
    write: false,
    commitRef: "5c8f87a",
  });

  const fixtures = new Map(result.factory_apply_engine_negative_fixture_rows.map((row) => [row.fixture_key, row]));

  assert.equal(fixtures.get("forged_receipt_apply_attempt").actual_result, "blocked");
  assert.ok(fixtures.get("forged_receipt_apply_attempt").observed_blocked_checks.includes("receipt_entry_hash_known"));
  assert.equal(fixtures.get("forged_receipt_apply_attempt").checks.receipt_entry_hash_known, false);
  assert.equal(fixtures.get("bound_hash_mismatch_apply_attempt").actual_result, "blocked");
  assert.ok(fixtures.get("bound_hash_mismatch_apply_attempt").observed_blocked_checks.includes("candidate_hash_bound"));
  assert.equal(fixtures.get("bound_hash_mismatch_apply_attempt").checks.docket_candidate_hash_matches, false);
  assert.equal(fixtures.get("nonce_reuse_apply_attempt").duplicate_nonce_seen_now, true);
  assert.equal(fixtures.get("nonce_reuse_apply_attempt").actual_result, "blocked");
  assert.equal(fixtures.get("nonce_reuse_apply_attempt").checks.nonce_unique, false);
  assert.equal(fixtures.get("rollback_after_state_mismatch").actual_result, "failure_report");
  assert.equal(fixtures.get("rollback_after_state_mismatch").failure_report_emitted_now, true);
  assert.equal(fixtures.get("rollback_after_state_mismatch").checks.rollback_executor_closed, true);
  assert.equal(fixtures.get("direct_apply_without_fd_receipt").actual_result, "blocked");
  assert.equal(fixtures.get("direct_apply_without_fd_receipt").checks.fd_receipt_present, false);
});

test("Factory Apply Engine Closed writes closeout artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-apply-engine-closed-out-"));
  try {
    const result = await runFactoryApplyEngineClosed({
      outDir,
      runAt: RUN_AT,
      check: false,
      requirePass: true,
      commitRef: "5c8f87a",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-apply-engine-closed.json"), "utf8"));
    const applyRows = JSON.parse(await readFile(path.join(outDir, "apply-intent-rows.json"), "utf8"));
    const rollbackRows = JSON.parse(await readFile(path.join(outDir, "rollback-verification-rows.json"), "utf8"));
    const boundary = JSON.parse(await readFile(path.join(outDir, "boundary.json"), "utf8"));

    assert.equal(result.summary.factory_apply_engine_closed_status, "ready_factory_apply_engine_closed");
    assert.equal(artifact.summary.apply_intent_blocked_count, 3);
    assert.equal(applyRows.count, 3);
    assert.equal(rollbackRows.count, 3);
    assert.equal(boundary.receipt_apply_engine_reachable_now, false);
    assert.equal(boundary.rollback_executor_runtime_enabled_now, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Factory Apply Engine Closed --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-apply-engine-closed-check-"));
  try {
    const sentinelPath = path.join(outDir, "factory-apply-engine-closed.json");
    const sentinel = '{ "sentinel": "factory-apply-engine-closed" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-apply-engine-closed.mjs",
      "--check",
      "--require-pass",
      "--out-dir",
      outDir,
      "--run-at",
      RUN_AT,
      "--commit-ref",
      "5c8f87a",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
