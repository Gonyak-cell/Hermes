import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildFactoryCandidateLaneProof } from "../src/factory-candidate-lane-proof.mjs";
import { buildReviewApiResponse } from "../src/review-api.mjs";
import {
  buildFactoryCandidateReviewDocket,
  runFactoryCandidateReviewDocket,
} from "../src/factory-candidate-review-docket.mjs";

const RUN_AT = "2026-06-11T00:00:00.000Z";
const HASH_RE = /^[a-f0-9]{64}$/;

function parseJsonResponse(response) {
  return JSON.parse(response.body);
}

test("Factory Candidate Review Docket binds three proof candidate packets without opening approval or apply", async () => {
  const result = await buildFactoryCandidateReviewDocket({ runAt: RUN_AT });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_candidate_review_docket_status, "ready_factory_candidate_review_docket");
  assert.equal(result.summary.source_kind, "fc2_proof_scenario");
  assert.equal(result.summary.candidate_packet_count, 3);
  assert.equal(result.summary.review_docket_row_count, 3);
  assert.equal(result.summary.review_packet_row_count, 3);
  assert.equal(result.summary.review_hash_register_row_count, 3);
  assert.equal(result.summary.negative_fixture_count, 3);
  assert.equal(result.summary.review_decision_allowed_now, false);
  assert.equal(result.summary.approval_allowed_now, false);
  assert.equal(result.summary.apply_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.source_candidate_lane.source_proof_status, "ready_factory_candidate_lane_proof");
  assert.equal(result.factory_candidate_review_docket_rows.every((row) => row.review_status === "review_required_not_approved"), true);
  assert.equal(result.factory_candidate_review_docket_rows.every((row) => row.independent_review_required_before_apply === true && row.owner_adjudication_required_before_apply === true), true);
  assert.equal(result.factory_candidate_review_docket_rows.every((row) => row.approval_allowed_now === false && row.apply_allowed_now === false), true);
  assert.equal(result.factory_candidate_review_docket_rows.every((row) => HASH_RE.test(row.review_docket_row_sha256) && HASH_RE.test(row.candidate_packet_sha256)), true);
  assert.equal(result.factory_candidate_review_packet_rows.every((row) => row.review_packet_status === "ready_for_review_not_approved" && row.approval_allowed_now === false && row.apply_allowed_now === false), true);
  assert.equal(result.factory_candidate_review_hash_register_rows[0].prev_entry_hash, null);
  assert.equal(result.factory_candidate_review_hash_register_rows[1].prev_entry_hash, result.factory_candidate_review_hash_register_rows[0].entry_hash);
  assert.equal(result.factory_candidate_review_hash_register_rows[2].prev_entry_hash, result.factory_candidate_review_hash_register_rows[1].entry_hash);
  assert.equal(result.factory_candidate_review_negative_fixture_rows.every((row) => row.fixture_status === "passed" && row.observed_outcome === "blocked"), true);
  assert.equal(result.factory_candidate_review_negative_fixture_rows.every((row) => row.guard_executed_now === true && row.observed_count > 0), true);
  assert.equal(result.factory_candidate_review_negative_fixture_rows.some((row) => row.fixture_id === "negative.mismatched_candidate_hash" && row.expected_candidate_packet_sha256 !== row.attempted_candidate_packet_sha256), true);
});

test("Factory Candidate Review Docket writes docket artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-candidate-review-docket-out-"));
  try {
    const result = await runFactoryCandidateReviewDocket({
      outDir,
      runAt: RUN_AT,
      check: true,
      requirePass: true,
    });
    const docket = JSON.parse(await readFile(path.join(outDir, "factory-candidate-review-docket.json"), "utf8"));
    const rows = JSON.parse(await readFile(path.join(outDir, "review-docket-rows.json"), "utf8"));
    const sourceProof = JSON.parse(await readFile(path.join(outDir, "source-proof-summary.json"), "utf8"));

    assert.equal(result.summary.factory_candidate_review_docket_status, "ready_factory_candidate_review_docket");
    assert.equal(docket.summary.review_docket_row_count, 3);
    assert.equal(rows.count, 3);
    assert.equal(sourceProof.temp_ledger_cleaned_up, true);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Factory Candidate Review Docket fails closed when the default seed has no candidate packets", async () => {
  const result = await buildFactoryCandidateReviewDocket({
    proofScenario: false,
    runAt: RUN_AT,
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.factory_candidate_review_docket_status, "blocked_factory_candidate_review_docket");
  assert.equal(result.summary.source_kind, "default_candidate_lane");
  assert.equal(result.summary.candidate_packet_count, 0);
  assert.equal(result.summary.review_docket_row_count, 0);
  assert.equal(result.summary.approval_allowed_now, false);
  assert.equal(result.summary.apply_allowed_now, false);
  assert.equal(result.validation.errors.some((item) => item.item_id === "source.candidate_count"), true);
});

test("Factory Candidate Review Docket can read a candidate lane JSON source path", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "factory-candidate-review-docket-source-"));
  try {
    const proof = await buildFactoryCandidateLaneProof({
      outDir: path.join(tempDir, "proof"),
      runAt: RUN_AT,
      write: false,
    });
    const sourcePath = path.join(tempDir, "candidate-lane.json");
    await writeFile(sourcePath, `${JSON.stringify(proof._candidate_lane_result, null, 2)}\n`, "utf8");

    const result = await buildFactoryCandidateReviewDocket({
      sourceCandidateLanePath: sourcePath,
      runAt: RUN_AT,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.source_kind, "candidate_lane_json_path");
    assert.equal(result.summary.review_docket_row_count, 3);
    assert.equal(result.source_candidate_lane.source_path, sourcePath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("Factory Candidate Review Docket rejects source rows with unbound candidate manifest hashes", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "factory-candidate-review-docket-tampered-source-"));
  try {
    const proof = await buildFactoryCandidateLaneProof({
      outDir: path.join(tempDir, "proof"),
      runAt: RUN_AT,
      write: false,
    });
    const tampered = {
      ...proof._candidate_lane_result,
      factory_candidate_packet_rows: proof._candidate_lane_result.factory_candidate_packet_rows.map((row, index) => index === 0
        ? { ...row, candidate_hash_bound_to_manifest: false }
        : row),
    };
    const sourcePath = path.join(tempDir, "candidate-lane-tampered.json");
    await writeFile(sourcePath, `${JSON.stringify(tampered, null, 2)}\n`, "utf8");

    const result = await buildFactoryCandidateReviewDocket({
      sourceCandidateLanePath: sourcePath,
      runAt: RUN_AT,
    });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.factory_candidate_review_docket_status, "blocked_factory_candidate_review_docket");
    assert.equal(result.validation.errors.some((item) => item.item_id === "docket.hash_bound"), true);
    assert.equal(result.summary.approval_allowed_now, false);
    assert.equal(result.summary.apply_allowed_now, false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("Factory Candidate Review Docket check mode rejects blocked source candidates", async () => {
  await assert.rejects(
    () => runFactoryCandidateReviewDocket({
      proofScenario: false,
      write: false,
      check: true,
      requirePass: true,
      runAt: RUN_AT,
    }),
    (error) => {
      assert.match(error.message, /^Factory Candidate Review Docket failed with \d+ validation error\(s\)\.$/);
      assert.equal(error.summary.factory_candidate_review_docket_status, "blocked_factory_candidate_review_docket");
      return true;
    },
  );
});

test("Review API exposes factory candidate review docket rows as read-only review data", async () => {
  const response = await buildReviewApiResponse("/api/factory/candidate-review-docket?limit=2", {
    runAt: RUN_AT,
  });
  const body = parseJsonResponse(response);

  assert.equal(response.status, 200);
  assert.equal(body.collection, "factory_candidate_review_docket_rows");
  assert.equal(body.read_only, true);
  assert.deepEqual(body.method_allowlist, ["GET", "HEAD"]);
  assert.equal(body.mutation_allowed, false);
  assert.equal(body.raw_confidential_material_visible, false);
  assert.equal(body.review_decision_allowed_now, false);
  assert.equal(body.approval_allowed_now, false);
  assert.equal(body.apply_allowed_now, false);
  assert.equal(body.source_file_write_allowed_now, false);
  assert.equal(body.ledger_append_allowed_now, false);
  assert.equal(body.persistent_ledger_append_allowed_now, false);
  assert.equal(body.repo_write_allowed_now, false);
  assert.equal(body.connector_write_allowed_now, false);
  assert.equal(body.deployment_allowed_now, false);
  assert.equal(body.protected_action_allowed_now, false);
  assert.equal(body.production_pass_enabled, false);
  assert.equal(body.enterprise_pass_enabled, false);
  assert.equal(body.count, 2);
  assert.equal(body.total_count, 3);
  assert.equal(body.visible_review_docket_row_count, 2);
  assert.equal(body.candidate_packet_count, 3);
  assert.equal(body.review_docket_row_count, 3);
  assert.equal(body.review_packet_row_count, 3);
  assert.equal(body.review_hash_register_row_count, 3);
  assert.equal(body.factory_candidate_review_packet_rows.length, 2);
  assert.equal(body.factory_candidate_review_hash_register_rows.length, 2);
  assert.equal(body.factory_candidate_review_negative_fixture_rows.length, 3);
  assert.equal(body.items.every((item) => item.review_status === "review_required_not_approved"), true);
  assert.equal(body.items.every((item) => item.approval_allowed_now === false && item.apply_allowed_now === false), true);
  assert.equal(body.source_candidate_lane.source_kind, "fc2_proof_scenario");
  assert.equal(body.summary.factory_candidate_review_docket_status, "ready_factory_candidate_review_docket");
  assert.equal(body.validation_error_count, 0);
});

test("Review API supports HEAD and blocks mutating factory candidate review docket requests", async () => {
  const headResponse = await buildReviewApiResponse("/api/factory/candidate-review-docket?limit=1", {
    method: "HEAD",
    runAt: RUN_AT,
  });
  assert.equal(headResponse.status, 200);
  assert.equal(headResponse.body, "");

  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await buildReviewApiResponse("/api/factory/candidate-review-docket", {
      method,
      runAt: RUN_AT,
    });
    const body = parseJsonResponse(response);

    assert.equal(response.status, 405);
    assert.equal(body.error, "method_not_allowed");
  }
});

test("Review API fails closed when factory candidate review docket source is blocked", async () => {
  const response = await buildReviewApiResponse("/api/factory/candidate-review-docket", {
    proofScenario: false,
    runAt: RUN_AT,
  });
  const body = parseJsonResponse(response);

  assert.equal(response.status, 503);
  assert.equal(body.error, "factory_candidate_review_docket_unavailable");
});
