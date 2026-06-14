import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReviewApiResponse } from "../src/review-api.mjs";
import {
  buildFactoryGSeriesAdvancementReadiness,
  runFactoryGSeriesAdvancementReadiness,
} from "../src/factory-g-series-advancement-readiness.mjs";

const RUN_AT = "2026-06-12T19:00:00.000Z";

test("Factory G-series Advancement Readiness exposes G1b/G2/G3 plus Stage6/Stage7 without runtime authority", async () => {
  const result = await buildFactoryGSeriesAdvancementReadiness({
    runAt: RUN_AT,
    write: false,
    commitRef: "af3fa0d",
  });

  assert.equal(result.schema_version, "factory-g-series-advancement-readiness.v1");
  assert.equal(result.program_range, "G-SERIES.1-7");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_g_series_advancement_readiness_status, "ready_for_g_series_continued_code_development");
  assert.equal(result.summary.gate_advancement_count, 3);
  assert.equal(result.summary.stage_advancement_count, 2);
  assert.equal(result.summary.g_series_code_development_allowed_now, true);
  assert.equal(result.summary.g_series_runtime_authority_open_now, false);
  assert.equal(result.summary.g1a_source_evidence_complete_now, true);
  assert.equal(result.summary.human_owner_approval_skipped_for_development_now, true);
  assert.equal(result.summary.human_owner_approval_counted_as_closeout, false);
  assert.equal(result.summary.factory_promotion_goal_complete_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);

  const g1b = result.factory_g_series_gate_advancement_rows.find((row) => row.gate_id === "G1b");
  const g2 = result.factory_g_series_gate_advancement_rows.find((row) => row.gate_id === "G2");
  const g3 = result.factory_g_series_gate_advancement_rows.find((row) => row.gate_id === "G3");
  const stage6 = result.factory_g_series_stage_advancement_rows.find((row) => row.stage_id === "Stage6");
  const stage7 = result.factory_g_series_stage_advancement_rows.find((row) => row.stage_id === "Stage7");

  assert.equal(result.summary.gate_advancement_evidence_complete_count, 3);
  assert.equal(result.summary.g1b_source_evidence_complete_now, true);
  assert.equal(result.summary.g2_source_evidence_complete_now, true);
  assert.equal(result.summary.g3_source_evidence_complete_now, true);
  assert.equal(g1b.advancement_status, "source_evidence_complete_runtime_authority_closed");
  assert.equal(g1b.previous_gate_status, "not_required_or_open");
  assert.equal(g1b.source_gate_evidence_complete_now, true);
  assert.equal(g2.advancement_status, "source_evidence_complete_runtime_authority_closed");
  assert.equal(g3.advancement_status, "source_evidence_complete_runtime_authority_closed");
  assert.equal(stage6.advancement_status, "source_evidence_complete_runtime_authority_closed");
  assert.equal(stage7.advancement_status, "source_evidence_complete_runtime_authority_closed");
  assert.equal(g1b.code_development_allowed_now, true);
  assert.equal(stage7.code_development_allowed_now, true);
  assert.equal(g1b.runtime_authority_allowed_now, false);
  assert.equal(stage6.stage_runtime_open_now, false);
  assert.equal(result.factory_g_series_advancement_negative_fixture_rows.every((row) => row.fixture_status === "blocked_as_expected"), true);
});

test("Factory G-series Advancement Readiness fails hard when source gate readiness is invalid", async () => {
  const result = await buildFactoryGSeriesAdvancementReadiness({
    runAt: RUN_AT,
    write: false,
    commitRef: "af3fa0d",
    gateOpeningReadiness: {
      validation: { valid: false, errors: [{ item_id: "x", message: "broken" }] },
      summary: { factory_gate_opening_readiness_status: "blocked" },
      source_summaries: { fe_ready: true },
      factory_gate_opening_readiness_rows: [],
    },
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.validation.errors.some((error) => error.item_id === "source.gate_opening_readiness_valid"), true);
  assert.equal(result.summary.factory_g_series_advancement_readiness_status, "blocked_factory_g_series_advancement_readiness");
  assert.equal(result.summary.g_series_runtime_authority_open_now, false);
});

test("Factory G-series Advancement Readiness writes artifacts and check mode does not overwrite", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-g-series-advancement-out-"));
  try {
    const result = await runFactoryGSeriesAdvancementReadiness({
      outDir,
      runAt: RUN_AT,
      check: false,
      requirePass: true,
      commitRef: "af3fa0d",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-g-series-advancement-readiness.json"), "utf8"));
    const gateRows = JSON.parse(await readFile(path.join(outDir, "g-series-gate-advancement-rows.json"), "utf8"));
    const stageRows = JSON.parse(await readFile(path.join(outDir, "stage-advancement-rows.json"), "utf8"));
    const boundary = JSON.parse(await readFile(path.join(outDir, "boundary.json"), "utf8"));

    assert.equal(result.summary.factory_g_series_advancement_readiness_status, "ready_for_g_series_continued_code_development");
    assert.equal(artifact.summary.gate_advancement_count, 3);
    assert.equal(artifact.summary.gate_advancement_evidence_complete_count, 3);
    assert.equal(gateRows.count, 3);
    assert.equal(stageRows.count, 2);
    assert.equal(boundary.g_series_runtime_authority_open_now, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }

  const checkDir = await mkdtemp(path.join(os.tmpdir(), "factory-g-series-advancement-check-"));
  try {
    const sentinelPath = path.join(checkDir, "factory-g-series-advancement-readiness.json");
    const sentinel = '{ "sentinel": "factory-g-series-advancement-readiness" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-g-series-advancement-readiness.mjs",
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

test("Review API exposes G-series advancement readiness as read-only data", async () => {
  const response = await buildReviewApiResponse("/api/factory/g-series-advancement-readiness?row_kind=stage_advancement", {
    runAt: RUN_AT,
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.collection, "factory_g_series_advancement_readiness_items");
  assert.equal(body.read_only, true);
  assert.equal(body.mutation_allowed, false);
  assert.equal(body.count, 2);
  assert.equal(body.items.every((item) => item.row_kind === "stage_advancement"), true);
  assert.equal(body.g_series_code_development_allowed_now, true);
  assert.equal(body.g_series_runtime_authority_open_now, false);
  assert.equal(body.human_owner_approval_counted_as_closeout, false);
});
