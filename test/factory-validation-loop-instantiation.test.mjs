import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFactoryValidationLoopInstantiation,
  runFactoryValidationLoopInstantiation,
} from "../src/factory-validation-loop-instantiation.mjs";
import { buildFactoryWorkPacketDecomposition } from "../src/factory-work-packet-decomposition.mjs";

const RUN_AT = "2026-06-12T16:00:00.000Z";

test("Factory Validation Loop Instantiation creates P9801-P10000 loop candidates from FE.2 packets", async () => {
  const result = await buildFactoryValidationLoopInstantiation({
    runAt: RUN_AT,
    write: false,
    commitRef: "c218c1b",
  });

  assert.equal(result.schema_version, "factory-validation-loop-instantiation.v1");
  assert.equal(result.program_range, "FCORE-FE.3");
  assert.equal(result.source_program_range, "FCORE-FE.2");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_validation_loop_instantiation_status, "ready_factory_validation_loop_instantiation");
  assert.deepEqual(result.summary.product_ids, ["project.hermes_harness"]);
  assert.equal(result.summary.product_scope_count, 1);
  assert.equal(result.summary.source_work_packet_candidate_count, 15);
  assert.equal(result.summary.validation_loop_candidate_count, 15);
  assert.equal(result.summary.validation_loop_candidate_ready_count, 15);
  assert.equal(result.summary.validation_loop_step_candidate_count, 150);
  assert.equal(result.summary.validation_loop_step_candidate_ready_count, 150);
  assert.equal(result.summary.validation_loop_gate_count, 90);
  assert.equal(result.summary.validation_loop_gate_pass_count, 90);
  assert.equal(result.summary.raw_text_guard_status, "ready_no_raw_prd_text_leak_detected");
  assert.equal(result.factory_validation_loop_raw_text_guard.guard_status, "ready_no_raw_prd_text_leak_detected");
  assert.equal(result.factory_validation_loop_raw_text_guard.raw_text_leak_found, false);
  assert.ok(result.factory_validation_loop_raw_text_guard.scanned_snippet_count > 0);
  assert.ok(result.factory_validation_loop_raw_text_guard.normalized_probe_count > 0);
  assert.equal(result.summary.negative_fixture_count, 6);
  assert.equal(result.summary.negative_fixture_blocked_count, 6);
  assert.equal(result.summary.validation_loop_execution_allowed_now, false);
  assert.equal(result.summary.worker_execution_allowed_now, false);
  assert.equal(result.summary.verifier_finality_allowed_now, false);
  assert.equal(result.summary.codex_final_approval_allowed_now, false);
  assert.equal(result.summary.claude_final_approval_allowed_now, false);
});

test("Factory Validation Loop Instantiation binds every loop to one source packet and all P9801-P10000 phases", async () => {
  const result = await buildFactoryValidationLoopInstantiation({
    runAt: RUN_AT,
    write: false,
    commitRef: "c218c1b",
  });
  const loopIds = new Set(result.factory_validation_loop_candidate_rows.map((row) => row.validation_loop_candidate_id));
  const packetIds = new Set(result.factory_validation_loop_candidate_rows.map((row) => row.source_work_packet_candidate_id));
  const requiredPhases = new Set(["P9801-P9820", "P9821-P9840", "P9841-P9860", "P9861-P9880", "P9881-P9900", "P9901-P9920", "P9921-P9940", "P9941-P9960", "P9961-P9980", "P9981-P10000"]);

  assert.equal(loopIds.size, 15);
  assert.equal(packetIds.size, 15);
  assert.ok(/^[a-f0-9]{64}$/.test(result.summary.candidate_bundle_sha256));
  assert.ok(result.factory_validation_loop_candidate_rows.every((row) => row.scope_lock === "single_product_single_work_packet_source_span"));
  assert.ok(result.factory_validation_loop_candidate_rows.every((row) => row.product_id === row.source_product_id));
  assert.ok(result.factory_validation_loop_candidate_rows.every((row) => /^[a-f0-9]{64}$/.test(row.source_candidate_bundle_sha256)));
  assert.ok(result.factory_validation_loop_candidate_rows.every((row) => row.raw_prd_text_visible === false && row.raw_prd_text_persisted_in_artifact === false));

  for (const loopId of loopIds) {
    const steps = result.factory_validation_loop_step_candidate_rows.filter((row) => row.validation_loop_candidate_id === loopId);
    assert.equal(steps.length, 10);
    assert.deepEqual(new Set(steps.map((row) => row.phase_range)), requiredPhases);
    assert.ok(steps.every((row) => row.candidate_status === "ready_loop_step_candidate"));
    assert.ok(steps.every((row) => row.validation_loop_execution_allowed_now === false && row.worker_execution_allowed_now === false && row.verifier_finality_allowed_now === false));

    const gates = result.factory_validation_loop_gate_rows.filter((row) => row.validation_loop_candidate_id === loopId);
    assert.equal(gates.length, 6);
    assert.ok(gates.every((row) => row.current_verdict === "pass" && row.authority_opened_by_gate === false));
  }
});

test("Factory Validation Loop Instantiation blocks bad FE.2 source inputs", async () => {
  const source = await buildFactoryWorkPacketDecomposition({
    runAt: RUN_AT,
    write: false,
    commitRef: "c218c1b",
  });

  const blockedStatus = structuredClone(source);
  blockedStatus.summary = {
    ...blockedStatus.summary,
    factory_work_packet_decomposition_status: "blocked_factory_work_packet_decomposition",
  };
  const blockedResult = await buildFactoryValidationLoopInstantiation({
    runAt: RUN_AT,
    write: false,
    commitRef: "c218c1b",
    workPacketDecomposition: blockedStatus,
  });
  assert.equal(blockedResult.validation.valid, false);
  assert.equal(blockedResult.summary.factory_validation_loop_instantiation_status, "blocked_factory_validation_loop_instantiation");
  assert.ok(blockedResult.validation.errors.some((error) => error.item_id === "source.fe2_work_packets_ready"));

  const missingScope = structuredClone(source);
  missingScope.factory_work_packet_candidate_rows[0] = {
    ...missingScope.factory_work_packet_candidate_rows[0],
    product_id: null,
  };
  const missingScopeResult = await buildFactoryValidationLoopInstantiation({
    runAt: RUN_AT,
    write: false,
    commitRef: "c218c1b",
    workPacketDecomposition: missingScope,
  });
  assert.equal(missingScopeResult.validation.valid, false);
  assert.ok(missingScopeResult.validation.errors.some((error) => error.item_id === "source.product_scope"));
  assert.ok(missingScopeResult.validation.errors.some((error) => error.item_id === "loops.source_bound"));
});

test("Factory Validation Loop Instantiation negative fixtures exercise blocked FE.3 paths", async () => {
  const result = await buildFactoryValidationLoopInstantiation({
    runAt: RUN_AT,
    write: false,
    commitRef: "c218c1b",
  });
  const fixtureKeys = new Set(result.factory_validation_loop_negative_fixture_rows.map((row) => row.fixture_key));

  for (const key of [
    "fe2_work_packet_decomposition_not_ready",
    "scope_missing_product_id",
    "cross_product_requirement_reference",
    "missing_loop_step_coverage",
    "loop_execution_flag_opened",
    "verifier_finality_opened",
  ]) {
    assert.equal(fixtureKeys.has(key), true);
  }
  assert.equal(result.factory_validation_loop_negative_fixture_rows.every((row) => row.fixture_status === "blocked_as_expected"), true);
  assert.equal(result.validation.errors.some((error) => error.item_id === "negative_fixtures.blocked"), false);
});

test("Factory Validation Loop Instantiation blocks raw PRD body text leaked into loop candidates", async () => {
  const source = await buildFactoryWorkPacketDecomposition({
    runAt: RUN_AT,
    write: false,
    commitRef: "c218c1b",
  });
  const prdLines = (await readFile("docs/hermes-enterprise-saas-specification.md", "utf8")).split(/\r?\n/);
  const rawSourceLine = prdLines.find((line) => line.trim().startsWith("- tenant 생성, workspace 생성"))?.trim();
  assert.ok(rawSourceLine);

  const leakingSource = structuredClone(source);
  leakingSource.factory_work_packet_candidate_rows[0] = {
    ...leakingSource.factory_work_packet_candidate_rows[0],
    title: `${leakingSource.factory_work_packet_candidate_rows[0].title} ${rawSourceLine}`,
  };

  const result = await buildFactoryValidationLoopInstantiation({
    runAt: RUN_AT,
    write: false,
    commitRef: "c218c1b",
    workPacketDecomposition: leakingSource,
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.factory_validation_loop_instantiation_status, "blocked_factory_validation_loop_instantiation");
  assert.equal(result.factory_validation_loop_raw_text_guard.raw_text_leak_found, true);
  assert.ok(result.factory_validation_loop_raw_text_guard.leak_refs.some((ref) => ref.detection_mode === "raw_substring" || ref.detection_mode === "json_escaped_raw_substring"));
  assert.ok(result.validation.errors.some((error) => error.item_id === "loops.raw_text_guard"));
});

test("Factory Validation Loop Instantiation writes closeout artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-validation-loop-instantiation-out-"));
  try {
    const result = await runFactoryValidationLoopInstantiation({
      outDir,
      runAt: RUN_AT,
      check: false,
      requirePass: true,
      commitRef: "c218c1b",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-validation-loop-instantiation.json"), "utf8"));
    const loops = JSON.parse(await readFile(path.join(outDir, "validation-loop-candidate-rows.json"), "utf8"));
    const steps = JSON.parse(await readFile(path.join(outDir, "validation-loop-step-candidate-rows.json"), "utf8"));
    const gates = JSON.parse(await readFile(path.join(outDir, "validation-loop-gate-rows.json"), "utf8"));
    const bundle = JSON.parse(await readFile(path.join(outDir, "candidate-bundle.json"), "utf8"));
    const rawTextGuard = JSON.parse(await readFile(path.join(outDir, "raw-text-guard.json"), "utf8"));
    const boundary = JSON.parse(await readFile(path.join(outDir, "boundary.json"), "utf8"));

    assert.equal(result.summary.factory_validation_loop_instantiation_status, "ready_factory_validation_loop_instantiation");
    assert.equal(artifact.summary.validation_loop_candidate_count, 15);
    assert.equal(loops.count, 15);
    assert.equal(steps.count, 150);
    assert.equal(gates.count, 90);
    assert.equal(bundle.bundle_status, "ready_validation_loop_candidate_bundle");
    assert.equal(rawTextGuard.guard_status, "ready_no_raw_prd_text_leak_detected");
    assert.equal(boundary.validation_loop_execution_allowed_now, false);
    assert.equal(boundary.verifier_finality_allowed_now, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Factory Validation Loop Instantiation --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-validation-loop-instantiation-check-"));
  try {
    const sentinelPath = path.join(outDir, "factory-validation-loop-instantiation.json");
    const sentinel = '{ "sentinel": "factory-validation-loop-instantiation" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-validation-loop-instantiation.mjs",
      "--check",
      "--require-pass",
      "--out-dir",
      outDir,
      "--run-at",
      RUN_AT,
      "--commit-ref",
      "c218c1b",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
