import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReviewApiResponse } from "../src/review-api.mjs";
import {
  buildFactoryPromotionCloseoutReadiness,
  runFactoryPromotionCloseoutReadiness,
} from "../src/factory-promotion-closeout-readiness.mjs";

const RUN_AT = "2026-06-12T23:30:00.000Z";

test("Factory Promotion Closeout Readiness keeps the full goal waiting on G1a owner chain", async () => {
  const result = await buildFactoryPromotionCloseoutReadiness({
    runAt: RUN_AT,
    write: false,
    commitRef: "2c144d2",
  });

  assert.equal(result.schema_version, "factory-promotion-closeout-readiness.v1");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_promotion_closeout_readiness_status, "waiting_for_g1a_owner_gate_opening_chain");
  assert.equal(result.summary.f0_ready, true);
  assert.equal(result.summary.fcore_closeout_chain_ready, true);
  assert.equal(result.summary.fcore_phase_count, 25);
  assert.equal(result.summary.fcore_phase_ready_count, 25);
  assert.equal(result.summary.review_phase_count, 20);
  assert.equal(result.summary.review_phase_ready_count, 20);
  assert.equal(result.summary.g1a_owner_gate_opening_chain_ready, false);
  assert.equal(result.summary.readiness_row_count, 12);
  assert.equal(result.summary.readiness_fail_count, 0);
  assert.equal(result.summary.readiness_wait_count, 5);
  assert.equal(result.summary.factory_promotion_goal_complete_allowed_now, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.ok(result.summary.waiting_blocker_ids.some((id) => id.includes("g1a.owner_candidate_selected")));
  assert.ok(result.summary.waiting_blocker_ids.some((id) => id.includes("g1a.signed_owner_receipt_present")));
});

test("Factory Promotion Closeout Readiness blocks degraded FCORE evidence", async () => {
  const baseline = await buildFactoryPromotionCloseoutReadiness({
    runAt: RUN_AT,
    write: false,
    commitRef: "2c144d2",
  });
  const badSummary = structuredClone(baseline.factory_promotion_closeout_source_state);
  const structuredSummary = {
    owner_adjudication_completed: true,
    f0_completed: true,
    f0_phase_pass_count: 5,
    f0_phase_count: 5,
    f0_aggregate_gate_status: "ready_for_fa_implementation",
    f0_1_receipt_preflight_passed: true,
    f0_1_independent_review_deferred_now: false,
    f0_1_connector_review_blocking_findings: 0,
    f0_1_execution_review_blocking_findings: 0,
  };
  for (const key of [
    "fa1", "fa2", "fa3", "fa4", "fa5", "fa6",
    "fb1", "fb2", "fb3", "fb4", "fb5",
    "fc1", "fc2", "fc3", "fc4", "fc5",
    "fd1", "fd2", "fd3", "fd4", "fd5",
    "fe1", "fe2", "fe3", "fe4",
  ]) structuredSummary[`${key}_status`] = key === "fd5" ? "blocked_test_status" : "ready_test_status";
  for (const key of [
    "fa6",
    "fb1", "fb2", "fb3", "fb4", "fb5",
    "fc1", "fc2", "fc3", "fc4", "fc5",
    "fd1", "fd2", "fd3", "fd4", "fd5",
    "fe1", "fe2", "fe3", "fe4",
  ]) {
    structuredSummary[`${key}_claude_code_review_status`] = "valid_approve";
    structuredSummary[`${key}_claude_code_review_blocking_findings`] = 0;
    structuredSummary[`${key}_claude_code_review_resolved_model`] = "claude-opus-4-8";
    structuredSummary[`${key}_claude_final_approval_allowed_now`] = false;
  }

  const result = await buildFactoryPromotionCloseoutReadiness({
    runAt: RUN_AT,
    write: false,
    commitRef: "2c144d2",
    structuredSummary,
    feFreezeHandoff: {
      validation: { valid: true, errors: [] },
      summary: {
        factory_fe_freeze_handoff_status: "ready_factory_fe_freeze_handoff",
        fe_tranche_freeze_candidate_ready_now: true,
        factory_promotion_goal_complete_allowed_now: false,
      },
    },
    g1aCandidateSelectionDocket: { validation: { valid: true, errors: [] }, summary: { selected_candidate_now: false, candidate_hash_bound_now: false } },
    g1aOwnerSigningHandoff: { validation: { valid: true, errors: [] }, summary: { factory_g1a_owner_signing_handoff_status: "ready_g1a_owner_signature_handoff", ready_for_owner_signature_now: true } },
    g1aSourceLiteralCommitDraft: { validation: { valid: true, errors: [] }, summary: { factory_g1a_source_literal_commit_draft_status: "waiting_for_signed_g1a_owner_receipt" } },
    g1aOpeningCloseoutReadiness: { validation: { valid: true, errors: [] }, summary: { waiting_blocker_ids: ["g1a.closeout.blocker.owner_receipt.signed"], ready_for_g1a_opening_closeout_owner_adjudication: false } },
  });

  assert.equal(badSummary.fcore_phase_count, 25);
  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.factory_promotion_closeout_readiness_status, "blocked_factory_promotion_closeout_readiness");
  assert.ok(result.validation.errors.some((error) => error.item_id === "rows.no_hard_failures"));
  assert.equal(result.summary.fcore_closeout_chain_ready, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
});

test("Factory Promotion Closeout Readiness does not infer G1a completion from empty blocker arrays", async () => {
  const result = await buildFactoryPromotionCloseoutReadiness({
    runAt: RUN_AT,
    write: false,
    commitRef: "2c144d2",
    g1aOpeningCloseoutReadiness: {
      validation: { valid: true, errors: [] },
      summary: {
        waiting_blocker_ids: [],
        ready_for_g1a_opening_closeout_owner_adjudication: false,
      },
      g1a_opening_closeout_chain_rows: [],
    },
  });

  const rows = new Map(result.factory_promotion_closeout_readiness_rows.map((row) => [row.row_id, row]));
  assert.equal(rows.get("g1a.signed_owner_receipt_present").current_verdict, "wait");
  assert.equal(rows.get("g1a.source_literal_commit_applied").current_verdict, "wait");
  assert.equal(rows.get("g1a.first_use_audit_present").current_verdict, "wait");
  assert.equal(result.summary.g1a_owner_gate_opening_chain_ready, false);
  assert.equal(result.summary.factory_promotion_goal_complete_allowed_now, false);
});

test("Factory Promotion Closeout Readiness writes artifacts and check mode does not overwrite", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-promotion-closeout-readiness-out-"));
  try {
    const result = await runFactoryPromotionCloseoutReadiness({
      outDir,
      runAt: RUN_AT,
      check: false,
      commitRef: "2c144d2",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-promotion-closeout-readiness.json"), "utf8"));
    const rows = JSON.parse(await readFile(path.join(outDir, "closeout-readiness-rows.json"), "utf8"));
    const blockers = JSON.parse(await readFile(path.join(outDir, "closeout-blocker-rows.json"), "utf8"));
    const boundary = JSON.parse(await readFile(path.join(outDir, "boundary.json"), "utf8"));

    assert.equal(result.summary.factory_promotion_closeout_readiness_status, "waiting_for_g1a_owner_gate_opening_chain");
    assert.equal(artifact.summary.fcore_closeout_chain_ready, true);
    assert.equal(rows.count, 12);
    assert.equal(blockers.count, 5);
    assert.equal(boundary.factory_promotion_goal_complete_allowed_now, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }

  const checkDir = await mkdtemp(path.join(os.tmpdir(), "factory-promotion-closeout-readiness-check-"));
  try {
    const sentinelPath = path.join(checkDir, "factory-promotion-closeout-readiness.json");
    const sentinel = '{ "sentinel": "factory-promotion-closeout-readiness" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-promotion-closeout-readiness.mjs",
      "--check",
      "--out-dir",
      checkDir,
      "--run-at",
      RUN_AT,
      "--commit-ref",
      "2c144d2",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(checkDir, { recursive: true, force: true });
  }
});

test("Review API exposes Factory Promotion closeout readiness as read-only waiting data", async () => {
  const response = await buildReviewApiResponse("/api/factory/promotion-closeout-readiness?category=g1a_owner", {
    runAt: RUN_AT,
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.collection, "factory_promotion_closeout_readiness_rows");
  assert.equal(body.read_only, true);
  assert.equal(body.mutation_allowed, false);
  assert.equal(body.summary.factory_promotion_closeout_readiness_status, "waiting_for_g1a_owner_gate_opening_chain");
  assert.equal(body.fcore_closeout_chain_ready, true);
  assert.equal(body.g1a_owner_gate_opening_chain_ready, false);
  assert.equal(body.factory_promotion_goal_complete_allowed_now, false);
  assert.ok(body.items.every((item) => item.category === "g1a_owner"));

  const head = await buildReviewApiResponse("/api/factory/promotion-closeout-readiness?limit=1", {
    method: "HEAD",
    runAt: RUN_AT,
  });
  assert.equal(head.status, 200);
  assert.equal(head.body, "");

  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const denied = await buildReviewApiResponse("/api/factory/promotion-closeout-readiness", {
      method,
      runAt: RUN_AT,
    });
    const deniedBody = JSON.parse(denied.body);
    assert.equal(denied.status, 405);
    assert.equal(deniedBody.error, "method_not_allowed");
  }
});
