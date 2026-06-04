import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformHueKeynoteRoadmapAlignment,
  runPlatformHueKeynoteRoadmapAlignment,
} from "../src/platform-hue-keynote-roadmap-alignment.mjs";

const RUN_AT = "2026-06-04T00:00:00.000Z";
const resultPromise = buildPlatformHueKeynoteRoadmapAlignment({ runAt: RUN_AT, write: false });

test("Hue keynote roadmap alignment reflects the reviewed source deck", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_hue_keynote_roadmap_alignment_status, "ready_for_platform_hue_keynote_roadmap_alignment");
  assert.equal(result.source_reference.file_name, "Hue_Keynote.pdf");
  assert.equal(result.source_reference.reviewed_page_count, 50);
  assert.equal(result.summary.program_range, "P1200-P3200");
});

test("Hue keynote roadmap alignment preserves all principle rows", async () => {
  const result = await resultPromise;
  const principleIds = new Set(result.keynote_principle_rows.map((row) => row.principle_id));

  assert.equal(result.keynote_principle_rows.length, 10);
  assert.equal(result.keynote_principle_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(principleIds.has("claim_not_evidence"), true);
  assert.equal(principleIds.has("soft_to_hard_gate"), true);
  assert.equal(principleIds.has("memory_next_execution_condition"), true);
  assert.equal(principleIds.has("pass_ownership"), true);
});

test("Hue keynote roadmap alignment covers P1200-P3200 phases", async () => {
  const result = await resultPromise;
  const phaseRanges = new Set(result.roadmap_phase_alignment_rows.map((row) => row.phase_range));

  assert.equal(result.roadmap_phase_alignment_rows.length, 16);
  assert.equal(phaseRanges.has("P1200"), true);
  assert.equal(phaseRanges.has("P1501-P1640"), true);
  assert.equal(phaseRanges.has("P2041-P2120"), true);
  assert.equal(phaseRanges.has("P3041-P3200"), true);
  assert.equal(result.roadmap_phase_alignment_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Hue keynote roadmap alignment remains no-execution and no-write", async () => {
  const result = await resultPromise;
  const boundary = result.roadmap_boundary;

  assert.equal(boundary.keynote_alignment_ready, true);
  assert.equal(boundary.runtime_execution_enabled, false);
  assert.equal(boundary.write_action_enabled, false);
  assert.equal(boundary.protected_action_enabled, false);
  assert.equal(boundary.receipt_application_enabled, false);
  assert.equal(boundary.raw_material_access_enabled, false);
  assert.equal(boundary.agent_final_pass_enabled, false);
  assert.equal(boundary.work_os_claim_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Hue keynote roadmap alignment --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-hue-keynote-roadmap-alignment-"));
  const sentinelPath = path.join(outDir, "platform-hue-keynote-roadmap-alignment.json");
  const sentinel = "{ \"sentinel\": \"platform-hue-keynote-roadmap-alignment\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformHueKeynoteRoadmapAlignment({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
