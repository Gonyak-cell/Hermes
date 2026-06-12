import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReviewApiResponse } from "../src/review-api.mjs";
import {
  buildFactoryGateOpeningReadiness,
  runFactoryGateOpeningReadiness,
} from "../src/factory-gate-opening-readiness.mjs";

const RUN_AT = "2026-06-12T18:00:00.000Z";

test("Factory Gate Opening Readiness exposes G-series rows without opening authority", async () => {
  const result = await buildFactoryGateOpeningReadiness({
    runAt: RUN_AT,
    write: false,
    commitRef: "af3fa0d",
  });

  assert.equal(result.schema_version, "factory-gate-opening-readiness.v1");
  assert.equal(result.program_range, "G-SERIES.0");
  assert.equal(result.source_program_range, "FCORE-FA-FE");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_gate_opening_readiness_status, "ready_factory_gate_opening_readiness");
  assert.equal(result.summary.prerequisite_ready_count, result.summary.prerequisite_count);
  assert.equal(result.summary.gate_count, 4);
  assert.equal(result.summary.gate_open_count, 0);
  assert.equal(result.summary.gate_evidence_complete_count, 1);
  assert.equal(result.summary.g1a_source_evidence_complete_now, true);
  assert.equal(result.summary.g1a_ready_for_owner_receipt_now, false);
  assert.equal(result.summary.source_literal_gate_open_commit_count, 1);
  assert.equal(result.summary.owner_gate_opening_receipt_count, 1);
  assert.equal(result.summary.first_use_audit_count, 1);
  assert.equal(result.summary.data_driven_gate_opening_allowed_now, false);
  assert.equal(result.summary.factory_promotion_goal_complete_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);

  const g1a = result.factory_gate_opening_readiness_rows.find((row) => row.gate_id === "G1a");
  const g1b = result.factory_gate_opening_readiness_rows.find((row) => row.gate_id === "G1b");
  const g2 = result.factory_gate_opening_readiness_rows.find((row) => row.gate_id === "G2");
  const g3 = result.factory_gate_opening_readiness_rows.find((row) => row.gate_id === "G3");

  assert.equal(g1a.gate_status, "source_evidence_complete_runtime_authority_closed");
  assert.equal(g1a.gate_open_now, false);
  assert.equal(g1a.gate_evidence_complete_now, true);
  assert.deepEqual(g1a.blocked_reason_ids, []);
  assert.equal(g1b.gate_status, "blocked_gate_order_or_usage_evidence_missing");
  assert.equal(g1b.previous_gate_status, "not_required_or_open");
  assert.equal(g2.gate_status, "blocked_prerequisites_missing");
  assert.equal(g3.gate_status, "blocked_prerequisites_missing");
  assert.equal(result.factory_gate_opening_readiness_rows.every((row) => row.source_literal_change_only === true), true);
  assert.equal(result.factory_deferred_gate_rows.every((row) => row.gate_open_now === false), true);
  assert.equal(result.factory_gate_opening_negative_fixture_rows.every((row) => row.fixture_status === "blocked_as_expected"), true);
});

test("Factory Gate Opening Readiness keeps upstream blockers visible without opening gates", async () => {
  const realSummary = JSON.parse(await readFile("docs/factory-promotion/99-structured-summary.json", "utf8"));
  const blockedSummary = {
    ...realSummary,
    fb3_status: "blocked_factory_candidate_manifest_resolver",
  };

  const result = await buildFactoryGateOpeningReadiness({
    runAt: RUN_AT,
    write: false,
    commitRef: "af3fa0d",
    structuredSummary: blockedSummary,
  });
  const g1a = result.factory_gate_opening_readiness_rows.find((row) => row.gate_id === "G1a");

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_gate_opening_readiness_status, "blocked_factory_gate_opening_readiness");
  assert.equal(result.summary.gate_open_count, 0);
  assert.equal(g1a.prerequisite_status, "blocked");
  assert.equal(g1a.blocked_reason_ids.includes("stage2_candidate_manifest_and_fb_review_missing"), true);
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.equal(result.summary.repo_write_allowed_now, false);
});

test("Factory Gate Opening Readiness writes artifacts and check mode does not overwrite", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-gate-opening-readiness-out-"));
  try {
    const result = await runFactoryGateOpeningReadiness({
      outDir,
      runAt: RUN_AT,
      check: false,
      requirePass: true,
      commitRef: "af3fa0d",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-gate-opening-readiness.json"), "utf8"));
    const gateRows = JSON.parse(await readFile(path.join(outDir, "gate-opening-readiness-rows.json"), "utf8"));
    const boundary = JSON.parse(await readFile(path.join(outDir, "boundary.json"), "utf8"));

    assert.equal(result.summary.factory_gate_opening_readiness_status, "ready_factory_gate_opening_readiness");
    assert.equal(artifact.summary.gate_open_count, 0);
    assert.equal(artifact.summary.gate_evidence_complete_count, 1);
    assert.equal(gateRows.count, 4);
    assert.equal(boundary.data_driven_gate_opening_allowed_now, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }

  const checkDir = await mkdtemp(path.join(os.tmpdir(), "factory-gate-opening-readiness-check-"));
  try {
    const sentinelPath = path.join(checkDir, "factory-gate-opening-readiness.json");
    const sentinel = '{ "sentinel": "factory-gate-opening-readiness" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-gate-opening-readiness.mjs",
      "--check",
      "--require-pass",
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

test("Review API exposes gate opening readiness as read-only data", async () => {
  const response = await buildReviewApiResponse("/api/factory/gate-opening-readiness?gate_id=G1a", {
    runAt: RUN_AT,
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.collection, "factory_gate_opening_readiness_rows");
  assert.equal(body.read_only, true);
  assert.equal(body.mutation_allowed, false);
  assert.equal(body.count, 1);
  assert.equal(body.items[0].gate_id, "G1a");
  assert.equal(body.items[0].gate_open_now, false);
  assert.equal(body.project_creation_allowed_now, false);
  assert.equal(body.production_pass_enabled, false);

  const head = await buildReviewApiResponse("/api/factory/gate-opening-readiness?limit=1", {
    method: "HEAD",
    runAt: RUN_AT,
  });
  assert.equal(head.status, 200);
  assert.equal(head.body, "");

  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const denied = await buildReviewApiResponse("/api/factory/gate-opening-readiness", {
      method,
      runAt: RUN_AT,
    });
    const deniedBody = JSON.parse(denied.body);
    assert.equal(denied.status, 405);
    assert.equal(deniedBody.error, "method_not_allowed");
  }
});
