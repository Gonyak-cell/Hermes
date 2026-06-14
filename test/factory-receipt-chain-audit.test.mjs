import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFactoryReceiptChainAudit,
  runFactoryReceiptChainAudit,
} from "../src/factory-receipt-chain-audit.mjs";
import { buildFactoryCandidateReviewDocket } from "../src/factory-candidate-review-docket.mjs";
import { buildOwnerAttestationReceipts } from "../src/factory-receipt-verifier.mjs";

const RUN_AT = "2026-06-12T10:00:00.000Z";

test("Factory Receipt Chain Audit links seed, FD.1, FD.2, and FD.3 evidence without opening authority", async () => {
  const result = await buildFactoryReceiptChainAudit({
    runAt: RUN_AT,
    write: false,
    commitRef: "b4f0471",
  });

  assert.equal(result.schema_version, "factory-receipt-chain-audit.v1");
  assert.equal(result.program_range, "FCORE-FD.4");
  assert.equal(result.source_program_range, "FCORE-FD.1-FD.3");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_receipt_chain_audit_status, "ready_factory_receipt_chain_audit");
  assert.equal(result.summary.seed_receipt_chain_count, 1);
  assert.equal(result.summary.seed_receipt_chain_ready_count, 1);
  assert.equal(result.summary.fd1_owner_receipt_chain_count, 3);
  assert.equal(result.summary.fd1_owner_receipt_chain_ready_count, 3);
  assert.equal(result.summary.fd2_apply_rollback_chain_count, 3);
  assert.equal(result.summary.fd2_apply_rollback_chain_ready_count, 3);
  assert.equal(result.summary.fd3_schema_freeze_chain_count, 4);
  assert.equal(result.summary.fd3_schema_freeze_chain_ready_count, 4);
  assert.equal(result.summary.negative_fixture_count, 4);
  assert.equal(result.summary.negative_fixture_blocked_count, 4);
  assert.equal(result.summary.seed_receipt_ledger_invalid_rejected, true);
  assert.equal(result.summary.fd1_prev_entry_hash_break_rejected, true);
  assert.equal(result.summary.fd2_apply_receipt_hash_mismatch_rejected, true);
  assert.equal(result.summary.fd3_negative_fixture_count_drop_rejected, true);
  assert.equal(result.summary.receipt_apply_engine_reachable_now, false);
  assert.equal(result.summary.receipt_apply_engine_opened_now, false);
  assert.equal(result.summary.rollback_executor_runtime_enabled_now, false);
  assert.equal(result.summary.runtime_state_mutated_now, false);
  assert.equal(result.summary.apply_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
});

test("Factory Receipt Chain Audit exposes concrete linked rows", async () => {
  const result = await buildFactoryReceiptChainAudit({
    runAt: RUN_AT,
    write: false,
    commitRef: "b4f0471",
  });

  assert.equal(result.factory_fd1_owner_receipt_chain_rows.every((row) => row.prev_entry_hash_matches_chain), true);
  assert.equal(result.factory_fd1_owner_receipt_chain_rows.every((row) => row.entry_hash_matches_verification), true);
  assert.equal(result.factory_fd1_owner_receipt_chain_rows.every((row) => row.candidate_hash_matches_docket), true);
  assert.equal(result.factory_fd2_apply_rollback_chain_rows.every((row) => row.receipt_hash_matches_fd1), true);
  assert.equal(result.factory_fd2_apply_rollback_chain_rows.every((row) => row.apply_blocked_closed_engine), true);
  assert.equal(result.factory_fd2_apply_rollback_chain_rows.every((row) => row.rollback_blocked_closed_executor), true);
  assert.equal(result.factory_fd3_schema_freeze_chain_rows.map((row) => row.evidence_kind).sort().join(","), [
    "authority_flags_required_const_false",
    "fd_receipt_verify_runtime_fields_const_false",
    "open_authority_schema_blocked",
    "seed_and_fd1_receipts_schema_valid",
  ].sort().join(","));

  const fixtures = new Map(result.factory_receipt_chain_negative_fixture_rows.map((row) => [row.fixture_key, row]));
  assert.equal(fixtures.get("seed_receipt_ledger_invalid").actual_result, "chain_blocked");
  assert.equal(fixtures.get("fd1_prev_entry_hash_break").actual_result, "chain_blocked");
  assert.deepEqual(fixtures.get("fd1_prev_entry_hash_break").observed_blocked_checks, ["prev_entry_hash_matches_chain"]);
  assert.equal(fixtures.get("fd2_apply_receipt_hash_mismatch").actual_result, "chain_blocked");
  assert.deepEqual(fixtures.get("fd2_apply_receipt_hash_mismatch").observed_blocked_checks, ["receipt_hash_matches_fd1"]);
  assert.equal(fixtures.get("fd3_negative_fixture_count_drop").actual_result, "chain_blocked");
  assert.deepEqual(fixtures.get("fd3_negative_fixture_count_drop").observed_blocked_checks, ["observed_count_matches_expected"]);
});

test("Factory Receipt Chain Audit blocks inconsistent FD.1 source input end-to-end", async () => {
  const candidateReviewDocket = await buildFactoryCandidateReviewDocket({
    runAt: RUN_AT,
    write: false,
    commitRef: "b4f0471",
  });
  const candidateRows = candidateReviewDocket.factory_candidate_review_docket_rows.map((row) => ({
    product_id: row.product_id,
    candidate_packet_id: row.candidate_packet_id,
    candidate_packet_sha256: row.candidate_packet_sha256,
    review_docket_row_sha256: row.review_docket_row_sha256,
  }));
  const fd1ReceiptRows = buildOwnerAttestationReceipts({
    candidateRows,
    generatedAt: RUN_AT,
    commitRef: "b4f0471",
  });
  fd1ReceiptRows[1] = {
    ...fd1ReceiptRows[1],
    prev_entry_hash: "0".repeat(64),
  };

  const result = await buildFactoryReceiptChainAudit({
    runAt: RUN_AT,
    write: false,
    commitRef: "b4f0471",
    candidateReviewDocket,
    fd1ReceiptRows,
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.factory_receipt_chain_audit_status, "blocked_factory_receipt_chain_audit");
  assert.equal(result.summary.fd1_owner_receipt_chain_ready_count < result.summary.fd1_owner_receipt_chain_count, true);
  assert.equal(result.validation.errors.some((error) => error.item_id === "source.fd1.ready"), true);
  assert.equal(result.validation.errors.some((error) => error.item_id === "fd1.chain.ready"), true);
});

test("Factory Receipt Chain Audit writes closeout artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-receipt-chain-audit-out-"));
  try {
    const result = await runFactoryReceiptChainAudit({
      outDir,
      runAt: RUN_AT,
      check: false,
      requirePass: true,
      commitRef: "b4f0471",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-receipt-chain-audit.json"), "utf8"));
    const fd1Rows = JSON.parse(await readFile(path.join(outDir, "fd1-owner-receipt-chain-rows.json"), "utf8"));
    const fd2Rows = JSON.parse(await readFile(path.join(outDir, "fd2-apply-rollback-chain-rows.json"), "utf8"));
    const negativeRows = JSON.parse(await readFile(path.join(outDir, "negative-fixture-rows.json"), "utf8"));
    const boundary = JSON.parse(await readFile(path.join(outDir, "boundary.json"), "utf8"));

    assert.equal(result.summary.factory_receipt_chain_audit_status, "ready_factory_receipt_chain_audit");
    assert.equal(artifact.summary.fd1_owner_receipt_chain_ready_count, 3);
    assert.equal(fd1Rows.count, 3);
    assert.equal(fd2Rows.count, 3);
    assert.equal(negativeRows.count, 4);
    assert.equal(boundary.apply_allowed_now, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Factory Receipt Chain Audit --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-receipt-chain-audit-check-"));
  try {
    const sentinelPath = path.join(outDir, "factory-receipt-chain-audit.json");
    const sentinel = '{ "sentinel": "factory-receipt-chain-audit" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-receipt-chain-audit.mjs",
      "--check",
      "--require-pass",
      "--out-dir",
      outDir,
      "--run-at",
      RUN_AT,
      "--commit-ref",
      "b4f0471",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
