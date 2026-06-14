import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFactoryWorkPacketDecomposition,
  runFactoryWorkPacketDecomposition,
} from "../src/factory-work-packet-decomposition.mjs";
import { buildFactoryPrdIntake } from "../src/factory-prd-intake.mjs";

const RUN_AT = "2026-06-12T15:00:00.000Z";

test("Factory Work Packet Decomposition turns FE.1 TUW seeds into bounded packet candidates", async () => {
  const result = await buildFactoryWorkPacketDecomposition({
    runAt: RUN_AT,
    write: false,
    commitRef: "3b7c52c",
  });

  assert.equal(result.schema_version, "factory-work-packet-decomposition.v1");
  assert.equal(result.program_range, "FCORE-FE.2");
  assert.equal(result.source_program_range, "FCORE-FE.1");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_work_packet_decomposition_status, "ready_factory_work_packet_decomposition");
  assert.equal(result.summary.source_tuw_seed_row_count, 15);
  assert.equal(result.summary.work_packet_candidate_count, 15);
  assert.equal(result.summary.work_packet_candidate_ready_count, 15);
  assert.equal(result.summary.work_item_candidate_count, 60);
  assert.equal(result.summary.work_item_candidate_ready_count, 60);
  assert.equal(result.summary.dependency_row_count, 14);
  assert.equal(result.summary.raw_text_leak_scan_status, "ready_no_raw_prd_text_leak_detected");
  assert.equal(result.summary.negative_fixture_count, 6);
  assert.equal(result.summary.negative_fixture_blocked_count, 6);
  assert.equal(result.summary.raw_prd_text_persisted_in_artifact, false);
  assert.equal(result.summary.command_execution_enabled, false);
  assert.equal(result.summary.work_packet_execution_allowed_now, false);
  assert.equal(result.summary.gate_opening_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
});

test("Factory Work Packet Decomposition keeps packets, items, and dependencies source-bound", async () => {
  const result = await buildFactoryWorkPacketDecomposition({
    runAt: RUN_AT,
    write: false,
    commitRef: "3b7c52c",
  });

  assert.ok(/^[a-f0-9]{64}$/.test(result.summary.candidate_bundle_sha256));
  assert.equal(new Set(result.factory_work_packet_candidate_rows.map((row) => row.work_packet_candidate_id)).size, 15);
  assert.equal(new Set(result.factory_work_packet_candidate_rows.map((row) => row.source_tuw_seed_id)).size, 15);
  assert.ok(result.factory_work_packet_candidate_rows.every((row) => row.scope_lock === "single_prd_source_span"));
  assert.ok(result.factory_work_packet_candidate_rows.every((row) => row.source_binding_status === "ready_single_source_span_bound"));
  assert.ok(result.factory_work_packet_candidate_rows.every((row) => /^[a-f0-9]{64}$/.test(row.source_span_sha256)));
  assert.ok(result.factory_work_packet_candidate_rows.every((row) => row.raw_prd_text_visible === false && row.raw_prd_text_persisted_in_artifact === false));
  assert.equal(result.factory_work_packet_raw_text_leak_scan.scan_status, "ready_no_raw_prd_text_leak_detected");
  assert.equal(result.factory_work_packet_raw_text_leak_scan.raw_text_leak_found, false);
  assert.equal(result.factory_work_packet_raw_text_leak_scan.raw_snippets_persisted, false);
  assert.ok(result.factory_work_packet_raw_text_leak_scan.scanned_snippet_count > 0);
  assert.ok(result.factory_work_packet_candidate_rows.every((row) => row.work_packet_execution_allowed_now === false && row.command_execution_allowed_now === false));
  assert.ok(result.factory_work_item_candidate_rows.every((row) => row.scope_lock === "inherits_single_prd_source_span"));
  assert.ok(result.factory_work_item_candidate_rows.every((row) => row.work_item_execution_allowed_now === false && row.command_execution_allowed_now === false));

  const packetIds = new Set(result.factory_work_packet_candidate_rows.map((row) => row.work_packet_candidate_id));
  const orderById = new Map(result.factory_work_packet_candidate_rows.map((row) => [row.work_packet_candidate_id, row.phase_order]));
  assert.ok(result.factory_work_packet_dependency_rows.every((row) => packetIds.has(row.work_packet_candidate_id)));
  assert.ok(result.factory_work_packet_dependency_rows.every((row) => packetIds.has(row.depends_on_work_packet_candidate_id)));
  assert.ok(result.factory_work_packet_dependency_rows.every((row) => orderById.get(row.depends_on_work_packet_candidate_id) < orderById.get(row.work_packet_candidate_id)));
});

test("Factory Work Packet Decomposition blocks bad FE.1 source inputs", async () => {
  const prdIntake = await buildFactoryPrdIntake({
    runAt: RUN_AT,
    write: false,
    commitRef: "3b7c52c",
  });

  const blockedStatus = structuredClone(prdIntake);
  blockedStatus.summary = {
    ...blockedStatus.summary,
    factory_prd_intake_status: "blocked_factory_prd_intake",
  };
  const blockedResult = await buildFactoryWorkPacketDecomposition({
    runAt: RUN_AT,
    write: false,
    commitRef: "3b7c52c",
    prdIntake: blockedStatus,
  });
  assert.equal(blockedResult.validation.valid, false);
  assert.equal(blockedResult.summary.factory_work_packet_decomposition_status, "blocked_factory_work_packet_decomposition");
  assert.ok(blockedResult.validation.errors.some((error) => error.item_id === "source.prd_intake_ready"));

  const unboundSeed = structuredClone(prdIntake);
  unboundSeed.factory_prd_tuw_seed_rows[0] = {
    ...unboundSeed.factory_prd_tuw_seed_rows[0],
    source_span_sha256: null,
  };
  const unboundResult = await buildFactoryWorkPacketDecomposition({
    runAt: RUN_AT,
    write: false,
    commitRef: "3b7c52c",
    prdIntake: unboundSeed,
  });
  assert.equal(unboundResult.validation.valid, false);
  assert.equal(unboundResult.summary.factory_work_packet_decomposition_status, "blocked_factory_work_packet_decomposition");
  assert.ok(unboundResult.validation.errors.some((error) => error.item_id === "source.seed_rows_ready"));
  assert.ok(unboundResult.validation.errors.some((error) => error.item_id === "work_packets.source_bound"));
});

test("Factory Work Packet Decomposition blocks raw PRD text leaked through FE.1 seed rows", async () => {
  const prdIntake = await buildFactoryPrdIntake({
    runAt: RUN_AT,
    write: false,
    commitRef: "3b7c52c",
  });
  const sourceLines = (await readFile(prdIntake.inputs.prd_path, "utf8")).split(/\r?\n/);
  const rawSourceLine = sourceLines.find((line) => line.trim().startsWith("- `work_packet_id`"))?.trim();
  assert.ok(rawSourceLine);

  const leakingIntake = structuredClone(prdIntake);
  leakingIntake.factory_prd_tuw_seed_rows[0] = {
    ...leakingIntake.factory_prd_tuw_seed_rows[0],
    acceptance_basis: [
      ...(leakingIntake.factory_prd_tuw_seed_rows[0].acceptance_basis ?? []),
      rawSourceLine,
    ],
  };

  const result = await buildFactoryWorkPacketDecomposition({
    runAt: RUN_AT,
    write: false,
    commitRef: "3b7c52c",
    prdIntake: leakingIntake,
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.factory_work_packet_raw_text_leak_scan.raw_text_leak_found, true);
  assert.ok(result.factory_work_packet_raw_text_leak_scan.leak_refs.some((ref) => ref.detection_mode === "raw_substring" || ref.detection_mode === "json_escaped_raw_substring"));
  assert.ok(result.validation.errors.some((error) => error.item_id === "work_packets.raw_text_scan"));
});

test("Factory Work Packet Decomposition writes closeout artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-work-packet-decomposition-out-"));
  try {
    const result = await runFactoryWorkPacketDecomposition({
      outDir,
      runAt: RUN_AT,
      check: false,
      requirePass: true,
      commitRef: "3b7c52c",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-work-packet-decomposition.json"), "utf8"));
    const packets = JSON.parse(await readFile(path.join(outDir, "work-packet-candidate-rows.json"), "utf8"));
    const items = JSON.parse(await readFile(path.join(outDir, "work-item-candidate-rows.json"), "utf8"));
    const dependencies = JSON.parse(await readFile(path.join(outDir, "dependency-rows.json"), "utf8"));
    const bundle = JSON.parse(await readFile(path.join(outDir, "candidate-bundle.json"), "utf8"));
    const rawTextScan = JSON.parse(await readFile(path.join(outDir, "raw-text-leak-scan.json"), "utf8"));
    const boundary = JSON.parse(await readFile(path.join(outDir, "boundary.json"), "utf8"));

    assert.equal(result.summary.factory_work_packet_decomposition_status, "ready_factory_work_packet_decomposition");
    assert.equal(artifact.summary.work_packet_candidate_count, 15);
    assert.equal(packets.count, 15);
    assert.equal(items.count, 60);
    assert.equal(dependencies.count, 14);
    assert.equal(bundle.bundle_status, "ready_candidate_bundle");
    assert.equal(rawTextScan.scan_status, "ready_no_raw_prd_text_leak_detected");
    assert.equal(boundary.work_packet_execution_allowed_now, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Factory Work Packet Decomposition --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-work-packet-decomposition-check-"));
  try {
    const sentinelPath = path.join(outDir, "factory-work-packet-decomposition.json");
    const sentinel = '{ "sentinel": "factory-work-packet-decomposition" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-work-packet-decomposition.mjs",
      "--check",
      "--require-pass",
      "--out-dir",
      outDir,
      "--run-at",
      RUN_AT,
      "--commit-ref",
      "3b7c52c",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
