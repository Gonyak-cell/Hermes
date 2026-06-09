import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildHermesLoopFinalFreeze,
  runHermesLoopFinalFreeze,
} from "../src/hermes-loop-final-freeze.mjs";
import { buildHermesLoopReviewGateIntegration } from "../src/hermes-loop-review-gate-integration.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P64000 projects read-only final freeze while keeping production and enterprise claims closed", async () => {
  const result = await buildHermesLoopFinalFreeze({
    runAt: RUN_AT,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "hermes-loop-final-freeze.v1");
  assert.equal(result.program_range, "P63601-P64000");
  assert.equal(result.source_program_range, "P63201-P63600");
  assert.equal(result.next_program_range, "POST-P64000");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.hermes_loop_final_freeze_status, "p64000_final_freeze_ready");
  assert.equal(result.summary.p63600_source_ready_now, true);
  assert.equal(result.summary.p64000_final_freeze_ready, true);
  assert.equal(result.read_only_projection_contract_rows.length, 16);
  assert.equal(result.dashboard_status_projection_rows.length, 20);
  assert.equal(result.controlled_execution_candidate_boundary_rows.length, 9);
  assert.equal(result.p64000_freeze_matrix_rows.length, 15);
  assert.equal(result.summary.ui_protected_action_allowed_now, false);
  assert.equal(result.summary.api_mutation_allowed_now, false);
  assert.equal(result.summary.automatic_apply_allowed_now, false);
  assert.equal(result.summary.candidate_execution_allowed_now, false);
  assert.equal(result.summary.p64000_production_pass_claim_allowed_now, false);
  assert.equal(result.summary.p64000_enterprise_pass_claim_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
});

test("invalid P63600 source blocks P64000 final freeze", async () => {
  const sourceReviewGate = await buildHermesLoopReviewGateIntegration({ runAt: RUN_AT, commitRef: "abc1234" });
  sourceReviewGate.validation = { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] };
  sourceReviewGate.summary.ready_for_p63601_handoff = false;

  const result = await buildHermesLoopFinalFreeze({
    runAt: RUN_AT,
    commitRef: "abc1234",
    sourceReviewGate,
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.hermes_loop_final_freeze_status, "blocked_hermes_loop_final_freeze");
  assert.equal(result.hermes_loop_final_freeze_boundary.p63600_source_ready_now, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p63600"));
});

test("missing read-only projection row blocks P64000 closeout", async () => {
  const result = await buildHermesLoopFinalFreeze({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitProjectionRow: "GET/HEAD-only",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.projection"));
});

test("missing dashboard blocker row blocks P64000 closeout", async () => {
  const result = await buildHermesLoopFinalFreeze({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitDashboardRow: "blocker",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.dashboard"));
});

test("missing freeze matrix row blocks P64000 closeout", async () => {
  const result = await buildHermesLoopFinalFreeze({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitFreezeMatrixRow: "API projection remains read-only by default.",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.freeze_matrix"));
});

test("unsafe production claim authority blocks P64000 closeout", async () => {
  const result = await buildHermesLoopFinalFreeze({
    runAt: RUN_AT,
    commitRef: "abc1234",
    authorityOverrides: {
      p64000_production_pass_claim_allowed_now: true,
    },
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.hermes_loop_final_freeze_boundary.p64000_production_pass_claim_allowed_now, true);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.authority"));
});

test("check mode validates without writing final freeze artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-loop-final-freeze-"));
  try {
    const result = await runHermesLoopFinalFreeze({
      check: true,
      outDir,
      runAt: RUN_AT,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "hermes-loop-final-freeze.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
