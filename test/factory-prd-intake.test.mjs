import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFactoryPrdIntake,
  runFactoryPrdIntake,
} from "../src/factory-prd-intake.mjs";

const RUN_AT = "2026-06-12T14:00:00.000Z";

test("Factory PRD Intake binds the enterprise SaaS specification without opening authority", async () => {
  const result = await buildFactoryPrdIntake({
    runAt: RUN_AT,
    write: false,
    commitRef: "d9ee7bb",
  });

  assert.equal(result.schema_version, "factory-prd-intake.v1");
  assert.equal(result.program_range, "FCORE-FE.1");
  assert.equal(result.source_program_range, "FCORE-FD.5");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_prd_intake_status, "ready_factory_prd_intake");
  assert.equal(result.summary.requirement_row_count, 15);
  assert.equal(result.summary.requirement_ready_count, 15);
  assert.equal(result.summary.tuw_seed_row_count, 15);
  assert.equal(result.summary.tuw_seed_ready_count, 15);
  assert.equal(result.summary.negative_fixture_count, 5);
  assert.equal(result.summary.negative_fixture_blocked_count, 5);
  assert.equal(result.summary.raw_prd_text_persisted_in_artifact, false);
  assert.equal(result.summary.command_execution_enabled, false);
  assert.equal(result.summary.gate_opening_allowed_now, false);
  assert.equal(result.summary.source_file_write_allowed_now, false);
  assert.equal(result.summary.repo_write_allowed_now, false);
  assert.equal(result.summary.deployment_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
});

test("Factory PRD Intake creates source-bound requirement and TUW seed rows", async () => {
  const result = await buildFactoryPrdIntake({
    runAt: RUN_AT,
    write: false,
    commitRef: "d9ee7bb",
  });

  assert.ok(result.summary.source_span_count >= 50);
  assert.ok(/^[a-f0-9]{64}$/.test(result.summary.prd_source_sha256));
  assert.ok(result.factory_prd_source_span_rows.every((row) => row.raw_text_included === false));
  assert.ok(result.factory_prd_requirement_rows.every((row) => row.source_span_id && /^[a-f0-9]{64}$/.test(row.source_span_sha256)));
  assert.ok(result.factory_prd_requirement_rows.every((row) => row.requirement_signal_count > 0));
  assert.ok(result.factory_prd_tuw_seed_rows.every((row) => row.decomposition_scope === "bounded_to_single_prd_source_span"));
  assert.ok(result.factory_prd_tuw_seed_rows.every((row) => row.work_packet_execution_allowed_now === false));

  const workPacketRow = result.factory_prd_requirement_rows.find((row) => row.heading_number === "4.3");
  assert.equal(workPacketRow.requirement_kind, "goal_plan_work_packet");
  assert.equal(workPacketRow.tuw_decomposition_seed_status, "queued_for_fe2_decomposition");
});

test("Factory PRD Intake blocks source hash mismatch and missing PRD inputs", async () => {
  const good = await buildFactoryPrdIntake({
    runAt: RUN_AT,
    write: false,
    commitRef: "d9ee7bb",
  });
  const wrongHash = createHash("sha256").update("wrong").digest("hex");

  const mismatch = await buildFactoryPrdIntake({
    runAt: RUN_AT,
    write: false,
    commitRef: "d9ee7bb",
    expectedSourceSha256: wrongHash,
  });
  assert.notEqual(wrongHash, good.summary.prd_source_sha256);
  assert.equal(mismatch.validation.valid, false);
  assert.equal(mismatch.summary.factory_prd_intake_status, "blocked_factory_prd_intake");
  assert.ok(mismatch.validation.errors.some((error) => error.item_id === "source.expected_sha_match"));

  const missing = await buildFactoryPrdIntake({
    runAt: RUN_AT,
    write: false,
    commitRef: "d9ee7bb",
    prdPath: "docs/missing-hermes-enterprise-saas-specification.md",
  });
  assert.equal(missing.validation.valid, false);
  assert.equal(missing.summary.factory_prd_intake_status, "blocked_factory_prd_intake");
  assert.ok(missing.validation.errors.some((error) => error.item_id === "source.available"));

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "factory-prd-intake-negative-"));
  try {
    const emptyPrdPath = path.join(tempDir, "empty.md");
    await writeFile(emptyPrdPath, "", "utf8");
    const empty = await buildFactoryPrdIntake({
      runAt: RUN_AT,
      write: false,
      commitRef: "d9ee7bb",
      prdPath: emptyPrdPath,
    });
    assert.equal(empty.validation.valid, false);
    assert.equal(empty.summary.factory_prd_intake_status, "blocked_factory_prd_intake");
    assert.ok(empty.validation.errors.some((error) => error.item_id === "source.non_empty"));

    const noFunctionalPrdPath = path.join(tempDir, "no-functional-requirements.md");
    await writeFile(noFunctionalPrdPath, [
      "# Hermes Enterprise SaaS 사양명세서",
      "",
      "## 1. 제품 정의",
      "",
      "### 1.1 제품명",
      "",
      "- Hermes",
      "",
      "## 2. 대상 사용자와 시장",
      "",
      "### 2.1 핵심 사용자",
      "",
      "- Founder",
      "",
    ].join("\n"), "utf8");
    const noFunctional = await buildFactoryPrdIntake({
      runAt: RUN_AT,
      write: false,
      commitRef: "d9ee7bb",
      prdPath: noFunctionalPrdPath,
    });
    assert.equal(noFunctional.validation.valid, false);
    assert.equal(noFunctional.summary.factory_prd_intake_status, "blocked_factory_prd_intake");
    assert.ok(noFunctional.validation.errors.some((error) => error.item_id === "requirements.required_functional_sections_present"));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("Factory PRD Intake writes closeout artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-prd-intake-out-"));
  try {
    const result = await runFactoryPrdIntake({
      outDir,
      runAt: RUN_AT,
      check: false,
      requirePass: true,
      commitRef: "d9ee7bb",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-prd-intake.json"), "utf8"));
    const spans = JSON.parse(await readFile(path.join(outDir, "source-span-rows.json"), "utf8"));
    const requirements = JSON.parse(await readFile(path.join(outDir, "requirement-rows.json"), "utf8"));
    const tuwSeeds = JSON.parse(await readFile(path.join(outDir, "tuw-seed-rows.json"), "utf8"));
    const boundary = JSON.parse(await readFile(path.join(outDir, "boundary.json"), "utf8"));

    assert.equal(result.summary.factory_prd_intake_status, "ready_factory_prd_intake");
    assert.equal(artifact.summary.requirement_row_count, 15);
    assert.ok(spans.count >= 50);
    assert.equal(requirements.count, 15);
    assert.equal(tuwSeeds.count, 15);
    assert.equal(boundary.command_execution_enabled, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Factory PRD Intake --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-prd-intake-check-"));
  try {
    const sentinelPath = path.join(outDir, "factory-prd-intake.json");
    const sentinel = '{ "sentinel": "factory-prd-intake" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-prd-intake.mjs",
      "--check",
      "--require-pass",
      "--out-dir",
      outDir,
      "--run-at",
      RUN_AT,
      "--commit-ref",
      "d9ee7bb",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
