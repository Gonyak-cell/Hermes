import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildFactoryCandidateReviewDocket } from "../src/factory-candidate-review-docket.mjs";
import {
  buildFactoryCandidateFreezeHandoff,
  runFactoryCandidateFreezeHandoff,
} from "../src/factory-candidate-freeze-handoff.mjs";

const RUN_AT = "2026-06-12T00:00:00.000Z";

test("Factory Candidate Freeze Handoff readies FD handoff from FC.1-FC.4 evidence", async () => {
  const result = await buildFactoryCandidateFreezeHandoff({
    runAt: RUN_AT,
    write: false,
    commitRef: "dbb6709",
  });

  assert.equal(result.schema_version, "factory-candidate-freeze-handoff.v1");
  assert.equal(result.program_range, "FCORE-FC.5");
  assert.equal(result.source_program_range, "FCORE-FC.1-FC.4");
  assert.equal(result.next_program_range, "FCORE-FD.1");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_candidate_freeze_handoff_status, "ready_factory_candidate_freeze_handoff");
  assert.equal(result.summary.candidate_packet_count, 3);
  assert.equal(result.summary.review_docket_row_count, 3);
  assert.equal(result.summary.api_total_review_docket_row_count, 3);
  assert.equal(result.summary.fc_exit_evidence_ready_count, result.summary.fc_exit_evidence_count);
  assert.equal(result.summary.canonical_run_hash_row_count, 6);
  assert.equal(result.summary.fd_handoff_gate_ready_count, result.summary.fd_handoff_gate_count);
  assert.equal(result.summary.fd_implementation_handoff_allowed_now, true);
  assert.equal(result.summary.apply_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
});

test("Factory Candidate Freeze Handoff keeps blocked docket as valid visible handoff blocker", async () => {
  const blockedDocket = await buildFactoryCandidateReviewDocket({
    proofScenario: false,
    runAt: RUN_AT,
    write: false,
  });
  const result = await buildFactoryCandidateFreezeHandoff({
    runAt: RUN_AT,
    write: false,
    commitRef: "dbb6709",
    candidateReviewDocket: blockedDocket,
    candidateReviewDocketApiResponse: {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "factory_candidate_review_docket_unavailable" }),
    },
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_candidate_freeze_handoff_status, "valid_block_factory_candidate_freeze_handoff_pending");
  assert.equal(result.summary.fd_implementation_handoff_allowed_now, false);
  assert.equal(result.factory_candidate_freeze_exit_evidence_rows.some((row) => row.evidence_status === "blocked"), true);
  assert.equal(result.factory_candidate_fd_handoff_gate_rows.some((row) => row.gate_status === "blocked"), true);
  assert.equal(result.summary.apply_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
});

test("Factory Candidate Freeze Handoff writes closeout artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-candidate-freeze-handoff-out-"));
  try {
    const result = await runFactoryCandidateFreezeHandoff({
      outDir,
      runAt: RUN_AT,
      check: false,
      requirePass: true,
      commitRef: "dbb6709",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-candidate-freeze-handoff.json"), "utf8"));
    const hashRows = JSON.parse(await readFile(path.join(outDir, "canonical-run-hash-rows.json"), "utf8"));
    const handoffRows = JSON.parse(await readFile(path.join(outDir, "fd-handoff-gate-rows.json"), "utf8"));

    assert.equal(result.summary.factory_candidate_freeze_handoff_status, "ready_factory_candidate_freeze_handoff");
    assert.equal(artifact.summary.fd_implementation_handoff_allowed_now, true);
    assert.equal(hashRows.count, 6);
    assert.equal(handoffRows.count, 8);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Factory Candidate Freeze Handoff --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-candidate-freeze-handoff-check-"));
  try {
    const sentinelPath = path.join(outDir, "factory-candidate-freeze-handoff.json");
    const sentinel = '{ "sentinel": "factory-candidate-freeze-handoff" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-candidate-freeze-handoff.mjs",
      "--check",
      "--require-pass",
      "--out-dir",
      outDir,
      "--run-at",
      RUN_AT,
      "--commit-ref",
      "dbb6709",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
