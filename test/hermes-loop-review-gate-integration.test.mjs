import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildHermesLoopReviewGateIntegration,
  runHermesLoopReviewGateIntegration,
} from "../src/hermes-loop-review-gate-integration.mjs";
import { buildHermesLoopRuntimeToolGovernance } from "../src/hermes-loop-runtime-tool-governance.mjs";

const RUN_AT = "2026-06-09T00:00:00.000Z";

test("P63600 projects review and human gate integration while keeping final approval closed", async () => {
  const result = await buildHermesLoopReviewGateIntegration({
    runAt: RUN_AT,
    commitRef: "abc1234",
  });

  assert.equal(result.schema_version, "hermes-loop-review-gate-integration.v1");
  assert.equal(result.program_range, "P63201-P63600");
  assert.equal(result.source_program_range, "P62801-P63200");
  assert.equal(result.next_program_range, "P63601-P64000");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.hermes_loop_review_gate_status, "ready_for_p63601_handoff");
  assert.equal(result.summary.p63200_source_ready_now, true);
  assert.equal(result.summary.p63600_contract_ready, true);
  assert.equal(result.review_packet_contract_rows.length, 14);
  assert.equal(result.review_receipt_contract_rows.length, 12);
  assert.equal(result.normalized_finding_loop_rows.length, 9);
  assert.equal(result.human_gate_candidate_rows.length, 12);
  assert.equal(result.protected_output_guard_rows.length, 10);
  assert.equal(result.summary.review_final_approval_allowed_now, false);
  assert.equal(result.summary.human_receipt_enterprise_trust_allowed_now, false);
  assert.equal(result.summary.protected_closeout_allowed_now, false);
  assert.equal(result.summary.protected_action_execution_allowed_now, false);
  assert.equal(result.summary.reviewer_source_mutation_allowed_now, false);
  assert.equal(result.summary.codex_self_approval_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
});

test("invalid P63200 source blocks P63600 review gate integration", async () => {
  const sourceRuntimeTool = await buildHermesLoopRuntimeToolGovernance({ runAt: RUN_AT, commitRef: "abc1234" });
  sourceRuntimeTool.validation = { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] };
  sourceRuntimeTool.summary.ready_for_p63201_handoff = false;

  const result = await buildHermesLoopReviewGateIntegration({
    runAt: RUN_AT,
    commitRef: "abc1234",
    sourceRuntimeTool,
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.hermes_loop_review_gate_status, "blocked_hermes_loop_review_gate_integration");
  assert.equal(result.hermes_loop_review_gate_boundary.p63200_source_ready_now, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p63200"));
});

test("missing review packet field blocks P63600 closeout", async () => {
  const result = await buildHermesLoopReviewGateIntegration({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitReviewPacketField: "no-mutation instruction",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.review_packet"));
});

test("missing review receipt field blocks P63600 closeout", async () => {
  const result = await buildHermesLoopReviewGateIntegration({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitReviewReceiptField: "blocking status",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.review_receipt"));
});

test("missing protected output guard blocks P63600 closeout", async () => {
  const result = await buildHermesLoopReviewGateIntegration({
    runAt: RUN_AT,
    commitRef: "abc1234",
    omitProtectedGuard: "claude_cannot_final_approve",
  });

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.protected_guard"));
});

test("unsafe human receipt enterprise trust authority blocks P63600 closeout", async () => {
  const result = await buildHermesLoopReviewGateIntegration({
    runAt: RUN_AT,
    commitRef: "abc1234",
    authorityOverrides: {
      human_receipt_enterprise_trust_allowed_now: true,
    },
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.hermes_loop_review_gate_boundary.human_receipt_enterprise_trust_allowed_now, true);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.authority"));
});

test("check mode validates without writing review gate artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-loop-review-gate-"));
  try {
    const result = await runHermesLoopReviewGateIntegration({
      check: true,
      outDir,
      runAt: RUN_AT,
      commitRef: "abc1234",
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "hermes-loop-review-gate-integration.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
