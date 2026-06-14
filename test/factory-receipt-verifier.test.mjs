import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFactoryReceiptVerify,
  runFactoryReceiptVerify,
} from "../src/factory-receipt-verifier.mjs";

const RUN_AT = "2026-06-12T03:00:00.000Z";

test("Factory Receipt Verify validates candidate-bound owner attestation receipts", async () => {
  const result = await buildFactoryReceiptVerify({
    runAt: RUN_AT,
    write: false,
    commitRef: "1ec506e",
  });

  assert.equal(result.schema_version, "factory-receipt-verify.v1");
  assert.equal(result.program_range, "FCORE-FD.1");
  assert.equal(result.source_program_range, "FCORE-FC.5");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_receipt_verify_status, "ready_factory_receipt_verify");
  assert.equal(result.summary.candidate_packet_count, 3);
  assert.equal(result.summary.receipt_verification_count, 3);
  assert.equal(result.summary.receipt_verification_ready_count, 3);
  assert.equal(result.summary.negative_fixture_count, 4);
  assert.equal(result.summary.negative_fixture_blocked_count, 4);
  assert.equal(result.summary.bound_candidate_hash_mismatch_rejected, true);
  assert.equal(result.summary.owner_attestation_missing_rejected, true);
  assert.equal(result.summary.nonce_replay_rejected, true);
  assert.equal(result.summary.apply_engine_open_attempt_rejected, true);
  assert.equal(result.summary.receipt_apply_engine_reachable_now, false);
  assert.equal(result.summary.apply_engine_runtime_enabled_now, false);
  assert.equal(result.summary.rollback_executor_runtime_enabled_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
});

test("Factory Receipt Verify detects forged candidate hash receipts", async () => {
  const result = await buildFactoryReceiptVerify({
    runAt: RUN_AT,
    write: false,
    commitRef: "1ec506e",
  });
  const badReceipt = JSON.parse(JSON.stringify(result.factory_receipt_negative_fixture_rows.find((row) => row.fixture_key === "bound_candidate_hash_mismatch")));

  assert.equal(badReceipt.blocked, true);
  assert.ok(badReceipt.observed_blocked_checks.includes("candidate_bound"));
});

test("Factory Receipt Verify keeps owner-attestation, nonce-replay, and apply-open attempts blocked", async () => {
  const result = await buildFactoryReceiptVerify({
    runAt: RUN_AT,
    write: false,
    commitRef: "1ec506e",
  });

  const ownerMissing = result.factory_receipt_negative_fixture_rows.find((row) => row.fixture_key === "owner_attestation_missing");
  const replay = result.factory_receipt_negative_fixture_rows.find((row) => row.fixture_key === "nonce_replay");
  const applyOpen = result.factory_receipt_negative_fixture_rows.find((row) => row.fixture_key === "apply_engine_open_attempt");

  assert.equal(ownerMissing.blocked, true);
  assert.ok(ownerMissing.observed_blocked_checks.includes("owner_attestation_present"));
  assert.equal(replay.blocked, true);
  assert.ok(replay.observed_blocked_checks.includes("nonce_unique"));
  assert.equal(applyOpen.blocked, true);
  assert.ok(applyOpen.observed_blocked_checks.includes("authority_closed"));
});

test("Factory Receipt Verify writes closeout artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-receipt-verify-out-"));
  try {
    const result = await runFactoryReceiptVerify({
      outDir,
      runAt: RUN_AT,
      check: false,
      requirePass: true,
      commitRef: "1ec506e",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-receipt-verify.json"), "utf8"));
    const boundary = JSON.parse(await readFile(path.join(outDir, "apply-engine-boundary.json"), "utf8"));

    assert.equal(result.summary.factory_receipt_verify_status, "ready_factory_receipt_verify");
    assert.equal(artifact.summary.receipt_verification_ready_count, 3);
    assert.equal(artifact.summary.negative_fixture_blocked_count, 4);
    assert.equal(boundary.apply_engine_runtime_enabled_now, false);
    assert.equal(boundary.rollback_executor_runtime_enabled_now, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Factory Receipt Verify --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-receipt-verify-check-"));
  try {
    const sentinelPath = path.join(outDir, "factory-receipt-verify.json");
    const sentinel = '{ "sentinel": "factory-receipt-verify" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-receipt-verifier.mjs",
      "--check",
      "--require-pass",
      "--out-dir",
      outDir,
      "--run-at",
      RUN_AT,
      "--commit-ref",
      "1ec506e",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
