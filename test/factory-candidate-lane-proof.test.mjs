import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFactoryCandidateLaneProof,
  runFactoryCandidateLaneProof,
} from "../src/factory-candidate-lane-proof.mjs";

const RUN_AT = "2026-06-11T00:00:00.000Z";
const HASH_RE = /^[a-f0-9]{64}$/;

test("Factory Candidate Lane Proof builds three PS2 candidate packets without persistent writes", async () => {
  const result = await buildFactoryCandidateLaneProof({ runAt: RUN_AT });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_candidate_lane_proof_status, "ready_factory_candidate_lane_proof");
  assert.equal(result.summary.proof_product_count, 3);
  assert.equal(result.summary.candidate_packet_count, 3);
  assert.equal(result.summary.diff_packet_count, 3);
  assert.equal(result.summary.rollback_plan_count, 3);
  assert.equal(result.summary.preflight_count, 3);
  assert.equal(result.summary.hash_ledger_row_count, 3);
  assert.equal(result.summary.negative_fixture_count, 3);
  assert.equal(result.summary.temp_ledger_cleaned_up, true);
  assert.equal(result.summary.default_or_seed_ledger_written_now, false);
  assert.equal(result.summary.actual_git_worktree_created_now, false);
  assert.equal(result.summary.patch_apply_enabled, false);
  assert.equal(result.summary.apply_allowed_now, false);
  assert.equal(result.temp_workspace.temp_ledger_dir_in_os_tmp, true);
  assert.equal(result.proof_product_rows.every((row) => row.current_product_state === "PS2_receipt_bound"), true);
  assert.equal(result.factory_candidate_packet_proof_rows.every((row) => row.candidate_packet_status === "candidate_packet_ready"), true);
  assert.equal(result.factory_candidate_packet_proof_rows.every((row) => row.candidate_hash_bound_to_manifest === true), true);
  assert.equal(result.factory_candidate_packet_proof_rows.every((row) => row.candidate_manifest_sha256_recomputed === row.candidate_manifest_sha256), true);
  assert.equal(result.factory_candidate_packet_proof_rows.every((row) => HASH_RE.test(row.candidate_packet_sha256) && HASH_RE.test(row.proof_row_sha256)), true);
  assert.equal(result.factory_candidate_packet_proof_rows.every((row) => row.diff_kind === "unified_diff" && row.diff_applied_now === false), true);
  assert.equal(result.factory_candidate_packet_proof_rows.every((row) => row.rollback_executed_now === false), true);
  assert.equal(result.factory_candidate_packet_proof_rows.every((row) => row.preflight_executed_now === true && row.preflight_status === "passed"), true);
  assert.equal(result.factory_candidate_packet_proof_rows[0].hash_ledger_prev_entry_hash, null);
  assert.equal(result.factory_candidate_packet_proof_rows[1].hash_ledger_prev_entry_hash, result.factory_candidate_packet_proof_rows[0].hash_ledger_entry_hash);
  assert.equal(result.factory_candidate_packet_proof_rows[2].hash_ledger_prev_entry_hash, result.factory_candidate_packet_proof_rows[1].hash_ledger_entry_hash);
  assert.equal(result._candidate_lane_result.factory_candidate_negative_fixture_rows.filter((row) => row.path_guard_executed_now === true).length, 2);
  assert.equal(result._candidate_lane_result.factory_candidate_negative_fixture_rows.every((row) => row.fixture_status === "passed"), true);
});

test("Factory Candidate Lane Proof writes proof and nested candidate lane artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-candidate-lane-proof-out-"));
  try {
    const result = await runFactoryCandidateLaneProof({
      outDir,
      runAt: RUN_AT,
      check: true,
      requirePass: true,
    });
    const proofJson = JSON.parse(await readFile(path.join(outDir, "factory-candidate-lane-proof.json"), "utf8"));
    const laneJson = JSON.parse(await readFile(path.join(outDir, "candidate-lane", "factory-candidate-lane.json"), "utf8"));

    assert.equal(result.summary.factory_candidate_lane_proof_status, "ready_factory_candidate_lane_proof");
    assert.equal(proofJson.summary.candidate_packet_count, 3);
    assert.equal(proofJson.summary.temp_ledger_cleaned_up, true);
    assert.equal(laneJson.summary.candidate_packet_count, 3);
    assert.equal(laneJson.summary.patch_apply_enabled, false);
    assert.equal(laneJson.summary.apply_allowed_now, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Factory Candidate Lane Proof fails closed when candidate artifacts cannot be materialized", async () => {
  const templateRoot = await mkdtemp(path.join(os.tmpdir(), "factory-candidate-lane-proof-empty-templates-"));
  try {
    const result = await buildFactoryCandidateLaneProof({
      templateRoot,
      runAt: RUN_AT,
    });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.factory_candidate_lane_proof_status, "blocked_factory_candidate_lane_proof");
    assert.equal(result.summary.proof_product_count, 3);
    assert.equal(result.summary.candidate_packet_count, 0);
    assert.equal(result.summary.patch_apply_enabled, false);
    assert.equal(result.summary.apply_allowed_now, false);
    assert.equal(result.summary.temp_ledger_cleaned_up, true);
    assert.equal(result.validation.errors.some((item) => item.item_id === "source.candidate_lane_valid"), true);
  } finally {
    await rm(templateRoot, { recursive: true, force: true });
  }
});

test("Factory Candidate Lane Proof check mode rejects blocked proof output", async () => {
  const templateRoot = await mkdtemp(path.join(os.tmpdir(), "factory-candidate-lane-proof-empty-templates-"));
  try {
    await assert.rejects(
      () => runFactoryCandidateLaneProof({
        templateRoot,
        runAt: RUN_AT,
        write: false,
        check: true,
        requirePass: true,
      }),
      (error) => {
        assert.match(error.message, /^Factory Candidate Lane Proof failed with \d+ validation error\(s\)\.$/);
        assert.ok(error.validation.errors.length > 0);
        assert.equal(error.summary.factory_candidate_lane_proof_status, "blocked_factory_candidate_lane_proof");
        return true;
      },
    );
  } finally {
    await rm(templateRoot, { recursive: true, force: true });
  }
});
