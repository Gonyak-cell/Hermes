import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildHermesLoopOverlayContract,
  runHermesLoopOverlayContract,
} from "../src/hermes-loop-overlay-contract.mjs";
import { buildHermesLoopSourceBinding, HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "../src/hermes-loop-source-binding.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P60800 projects LoopDefinition, LoopRun, and LoopDAG overlay rows", async () => {
  const result = await buildHermesLoopOverlayContract({
    runAt: RUN_AT,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "hermes-loop-overlay-contract.v1");
  assert.equal(result.program_range, "P60401-P60800");
  assert.equal(result.source_program_range, "P60001-P60400");
  assert.equal(result.next_program_range, "P60801-P61200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.hermes_loop_overlay_status, "ready_for_p60801_handoff");
  assert.equal(result.summary.p60400_source_ready_now, true);
  assert.equal(result.summary.p60800_contract_ready, true);
  assert.equal(result.summary.ready_for_p60801_handoff, true);
  assert.equal(result.loop_definition_schema_rows.length, 25);
  assert.equal(result.loop_run_schema_rows.length, 23);
  assert.equal(result.loop_dag_schema_rows.length, 17);
  assert.equal(result.existing_mapping_projection_rows.length, 17);
  assert.equal(result.state_mapping_projection_rows.length, 13);
  assert.equal(result.authority_boundary_carryover_rows.length, HERMES_LOOP_AUTHORITY_FALSE_FLAGS.length);
  assert.equal(result.p60800_closeout_rows.every((row) => row.current_verdict === "pass"), true);

  for (const flag of HERMES_LOOP_AUTHORITY_FALSE_FLAGS) {
    assert.equal(result.hermes_loop_overlay_boundary[flag], false, `${flag} must stay false`);
    assert.equal(result.summary[flag], false, `${flag} summary must stay false`);
  }
});

test("invalid P60400 source blocks overlay contract closeout", async () => {
  const sourceBinding = await buildHermesLoopSourceBinding({ runAt: RUN_AT, commitRef: "abc1234" });
  sourceBinding.validation = { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] };
  sourceBinding.summary.ready_for_p60401_handoff = false;

  const result = await buildHermesLoopOverlayContract({
    runAt: RUN_AT,
    sourceBinding,
    commitRef: "abc1234",
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.hermes_loop_overlay_status, "blocked_hermes_loop_overlay_contract");
  assert.equal(result.hermes_loop_overlay_boundary.p60400_source_ready_now, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p60400"));
});

test("missing LoopDefinition field blocks P60800 closeout", async () => {
  const result = await buildHermesLoopOverlayContract({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitDefinitionField: "validation_chain",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.loop_definition"));
  assert.equal(result.loop_definition_schema_rows.some((row) => row.field_name === "validation_chain"), false);
});

test("missing state mapping blocks P60800 closeout", async () => {
  const result = await buildHermesLoopOverlayContract({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitStateMapping: "blocked",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.state_mapping"));
  assert.equal(result.state_mapping_projection_rows.some((row) => row.mapping_key === "blocked"), false);
});

test("unsafe authority carryover blocks overlay contract", async () => {
  const result = await buildHermesLoopOverlayContract({
    runAt: RUN_AT,
    commitRef: "abc1234",
    authorityOverrides: {
      connector_write_allowed_now: true,
    },
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.hermes_loop_overlay_boundary.authority_boundary_carryover_closed_now, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.authority"));
  assert.equal(result.authority_boundary_carryover_rows.find((row) => row.authority_flag === "connector_write_allowed_now").current_verdict, "block");
});

test("check mode validates without writing overlay artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-loop-overlay-"));
  try {
    const result = await runHermesLoopOverlayContract({
      check: true,
      outDir,
      runAt: RUN_AT,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "hermes-loop-overlay-contract.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
