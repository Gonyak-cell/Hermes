import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  HERMES_LOOP_AUTHORITY_FALSE_FLAGS,
  buildHermesLoopSourceBinding,
  runHermesLoopSourceBinding,
} from "../src/hermes-loop-source-binding.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P60400 binds Hermes Loop v1.1 source of truth and keeps authority closed", async () => {
  const result = await buildHermesLoopSourceBinding({
    runAt: RUN_AT,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "hermes-loop-source-binding.v1");
  assert.equal(result.program_range, "P60001-P60400");
  assert.equal(result.next_program_range, "P60401-P60800");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.hermes_loop_source_binding_status, "ready_for_p60401_handoff");
  assert.equal(result.summary.source_of_truth_bound_now, true);
  assert.equal(result.summary.p60400_contract_ready, true);
  assert.equal(result.summary.ready_for_p60401_handoff, true);
  assert.equal(result.source_refs.source_of_truth, "docs/hermes-loop-system-specification.md");
  assert.match(result.source_refs.source_hash_sha256, /^[a-f0-9]{64}$/);
  assert.ok(result.p60001_source_binding_rows.length >= 19);
  assert.equal(result.loop_overlay_contract_inventory_rows.length, 12);
  assert.equal(result.authority_boundary_baseline_rows.length, HERMES_LOOP_AUTHORITY_FALSE_FLAGS.length);
  assert.equal(result.negative_fixture_contract_rows.length, 19);
  assert.equal(result.validation_command_rows.length, 6);
  assert.equal(result.p60400_closeout_rows.every((row) => row.current_verdict === "pass"), true);

  for (const flag of HERMES_LOOP_AUTHORITY_FALSE_FLAGS) {
    assert.equal(result.hermes_loop_source_binding_boundary[flag], false, `${flag} must stay false`);
    assert.equal(result.summary[flag], false, `${flag} summary must stay false`);
  }
});

test("missing required source sections block source binding", async () => {
  const result = await buildHermesLoopSourceBinding({
    runAt: RUN_AT,
    sourceSpecText: "# Hermes Loop System 사양명세서\n\n문서 버전: v1.1\n",
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.hermes_loop_source_binding_status, "blocked_hermes_loop_source_binding");
  assert.equal(result.hermes_loop_source_binding_boundary.source_of_truth_bound_now, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.sections"));
  assert.ok(result.p60001_source_binding_rows.some((row) => row.current_verdict === "block"));
});

test("unsafe authority expansion blocks P60400 closeout", async () => {
  const result = await buildHermesLoopSourceBinding({
    runAt: RUN_AT,
    commitRef: "abc1234",
    authorityOverrides: {
      production_pass_allowed_now: true,
    },
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.production_pass_enabled, true);
  assert.equal(result.hermes_loop_source_binding_boundary.authority_boundary_closed_now, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.authority"));
  assert.equal(result.authority_boundary_baseline_rows.find((row) => row.authority_flag === "production_pass_allowed_now").current_verdict, "block");
});

test("missing negative fixture row blocks P60400 closeout", async () => {
  const result = await buildHermesLoopSourceBinding({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitNegativeFixtureId: "worker_self_approval",
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.hermes_loop_source_binding_boundary.negative_fixture_contract_visible_now, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.negative_fixtures"));
  assert.equal(result.negative_fixture_contract_rows.some((row) => row.fixture_id === "worker_self_approval"), false);
});

test("check mode validates without writing source binding artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-loop-source-binding-"));
  try {
    const result = await runHermesLoopSourceBinding({
      check: true,
      outDir,
      runAt: RUN_AT,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "hermes-loop-source-binding.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
