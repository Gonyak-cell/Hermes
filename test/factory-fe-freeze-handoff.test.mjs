import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFactoryFeFreezeHandoff,
  runFactoryFeFreezeHandoff,
} from "../src/factory-fe-freeze-handoff.mjs";
import { buildFactoryValidationLoopInstantiation } from "../src/factory-validation-loop-instantiation.mjs";

const RUN_AT = "2026-06-12T17:00:00.000Z";

test("Factory FE Freeze Handoff freezes FE.1-FE.3 into a review packet without opening authority", async () => {
  const result = await buildFactoryFeFreezeHandoff({
    runAt: RUN_AT,
    write: false,
    commitRef: "2d28345",
  });

  assert.equal(result.schema_version, "factory-fe-freeze-handoff.v1");
  assert.equal(result.program_range, "FCORE-FE.4");
  assert.equal(result.source_program_range, "FCORE-FE.1-FE.3");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_fe_freeze_handoff_status, "ready_factory_fe_freeze_handoff");
  assert.equal(result.summary.source_chain_status, "ready_fe1_fe3_chain_for_fe4_freeze");
  assert.deepEqual(result.summary.product_ids, ["project.hermes_harness"]);
  assert.equal(result.summary.product_scope_count, 1);
  assert.equal(result.summary.fe1_ready, true);
  assert.equal(result.summary.fe2_ready, true);
  assert.equal(result.summary.fe3_ready, true);
  assert.equal(result.summary.review_evidence_ready, true);
  assert.equal(result.summary.source_hash_chain_ready, true);
  assert.equal(result.summary.count_vector_ready, true);
  assert.equal(result.summary.raw_text_guard_ready, true);
  assert.equal(result.summary.negative_fixtures_ready, true);
  assert.equal(result.summary.source_authority_closed, true);
  assert.equal(result.summary.fe_chain_evidence_row_count, 10);
  assert.equal(result.summary.fe_chain_evidence_pass_count, 10);
  assert.equal(result.summary.canonical_hash_row_count, 10);
  assert.equal(result.summary.review_packet_row_count, 1);
  assert.equal(result.summary.fe_review_packet_ready_now, true);
  assert.equal(result.summary.fe_tranche_freeze_candidate_ready_now, true);
  assert.equal(result.summary.negative_fixture_count, 7);
  assert.equal(result.summary.negative_fixture_blocked_count, 7);
  assert.equal(result.summary.validation_loop_execution_allowed_now, false);
  assert.equal(result.summary.worker_execution_allowed_now, false);
  assert.equal(result.summary.verifier_finality_allowed_now, false);
  assert.equal(result.summary.fe_runtime_loop_execution_enabled_now, false);
  assert.equal(result.summary.factory_promotion_goal_complete_allowed_now, false);
});

test("Factory FE Freeze Handoff builds a strict canonical hash chain", async () => {
  const result = await buildFactoryFeFreezeHandoff({
    runAt: RUN_AT,
    write: false,
    commitRef: "2d28345",
  });
  const rows = result.factory_fe_canonical_hash_rows;
  let previous = "0".repeat(64);

  assert.equal(rows.length, result.factory_fe_chain_evidence_rows.length);
  for (const row of rows) {
    assert.equal(row.previous_chain_sha256, previous);
    assert.match(row.evidence_row_sha256, /^[a-f0-9]{64}$/);
    assert.match(row.chain_sha256, /^[a-f0-9]{64}$/);
    assert.equal(row.ledger_append_allowed_now, false);
    previous = row.chain_sha256;
  }
  assert.equal(result.summary.canonical_chain_sha256, previous);
  assert.equal(result.factory_fe_review_packet_rows[0].canonical_chain_sha256, previous);
});

test("Factory FE Freeze Handoff blocks missing review evidence and bad FE.3 inputs", async () => {
  const missingReceiptDir = await mkdtemp(path.join(os.tmpdir(), "factory-fe-freeze-no-receipts-"));
  try {
    const missingReceiptResult = await buildFactoryFeFreezeHandoff({
      runAt: RUN_AT,
      write: false,
      commitRef: "2d28345",
      factoryPromotionDocsDir: missingReceiptDir,
    });
    assert.equal(missingReceiptResult.validation.valid, false);
    assert.equal(missingReceiptResult.summary.factory_fe_freeze_handoff_status, "blocked_factory_fe_freeze_handoff");
    assert.ok(missingReceiptResult.validation.errors.some((error) => error.item_id === "source.review_evidence"));
  } finally {
    await rm(missingReceiptDir, { recursive: true, force: true });
  }

  const sourceLoop = await buildFactoryValidationLoopInstantiation({
    runAt: RUN_AT,
    write: false,
    commitRef: "2d28345",
  });
  const badLoop = structuredClone(sourceLoop);
  badLoop.summary = {
    ...badLoop.summary,
    source_candidate_bundle_sha256: "f".repeat(64),
  };
  const badLoopResult = await buildFactoryFeFreezeHandoff({
    runAt: RUN_AT,
    write: false,
    commitRef: "2d28345",
    validationLoopInstantiation: badLoop,
  });

  assert.equal(badLoopResult.validation.valid, false);
  assert.equal(badLoopResult.summary.source_hash_chain_ready, false);
  assert.ok(badLoopResult.validation.errors.some((error) => error.item_id === "source.hash_chain"));
});

test("Factory FE Freeze Handoff negative fixtures exercise FE.4 blocked paths", async () => {
  const result = await buildFactoryFeFreezeHandoff({
    runAt: RUN_AT,
    write: false,
    commitRef: "2d28345",
  });
  const fixtureKeys = new Set(result.factory_fe_freeze_negative_fixture_rows.map((row) => row.fixture_key));

  for (const key of [
    "fe3_validation_loop_not_ready",
    "missing_fe3_review_evidence",
    "source_chain_hash_mismatch",
    "validation_loop_execution_flag_opened",
    "final_approval_flag_opened",
    "raw_prd_text_guard_blocked",
    "dropped_negative_fixture_coverage",
  ]) {
    assert.equal(fixtureKeys.has(key), true);
  }
  assert.equal(result.factory_fe_freeze_negative_fixture_rows.every((row) => row.fixture_status === "blocked_as_expected"), true);
  assert.ok(result.factory_fe_freeze_negative_fixture_rows
    .find((row) => row.fixture_key === "validation_loop_execution_flag_opened")
    .observed_blocked_checks.includes("source_authority_closed"));
  assert.equal(result.factory_fe_freeze_negative_fixture_rows
    .find((row) => row.fixture_key === "final_approval_flag_opened")
    .source_authority_closed_after_mutation, false);
  assert.equal(result.validation.errors.some((error) => error.item_id === "negative_fixtures.blocked"), false);
});

test("Factory FE Freeze Handoff writes closeout artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-fe-freeze-handoff-out-"));
  try {
    const result = await runFactoryFeFreezeHandoff({
      outDir,
      runAt: RUN_AT,
      check: false,
      requirePass: true,
      commitRef: "2d28345",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-fe-freeze-handoff.json"), "utf8"));
    const evidence = JSON.parse(await readFile(path.join(outDir, "fe-chain-evidence-rows.json"), "utf8"));
    const hashes = JSON.parse(await readFile(path.join(outDir, "fe-canonical-hash-rows.json"), "utf8"));
    const reviewPackets = JSON.parse(await readFile(path.join(outDir, "fe-review-packet-rows.json"), "utf8"));
    const boundary = JSON.parse(await readFile(path.join(outDir, "boundary.json"), "utf8"));

    assert.equal(result.summary.factory_fe_freeze_handoff_status, "ready_factory_fe_freeze_handoff");
    assert.equal(artifact.summary.fe_review_packet_ready_now, true);
    assert.equal(evidence.count, 10);
    assert.equal(hashes.count, 10);
    assert.equal(reviewPackets.count, 1);
    assert.equal(reviewPackets.items[0].review_packet_status, "ready_for_independent_fe4_review");
    assert.equal(boundary.validation_loop_execution_allowed_now, false);
    assert.equal(boundary.factory_promotion_goal_complete_allowed_now, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Factory FE Freeze Handoff --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-fe-freeze-handoff-check-"));
  try {
    const sentinelPath = path.join(outDir, "factory-fe-freeze-handoff.json");
    const sentinel = '{ "sentinel": "factory-fe-freeze-handoff" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-fe-freeze-handoff.mjs",
      "--check",
      "--require-pass",
      "--out-dir",
      outDir,
      "--run-at",
      RUN_AT,
      "--commit-ref",
      "2d28345",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
