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

test("Factory Promotion Closeout Readiness reports G1a source evidence ready for protected closeout while authority stays closed", async () => {
  const result = await buildFactoryPromotionCloseoutReadiness({
    runAt: RUN_AT,
    write: false,
    commitRef: "2c144d2",
  });

  assert.equal(result.schema_version, "factory-promotion-closeout-readiness.v1");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_promotion_closeout_readiness_status, "ready_for_human_owner_protected_closeout");
  assert.equal(result.summary.ready_for_human_owner_protected_closeout, true);
  assert.equal(result.summary.f0_ready, true);
  assert.equal(result.summary.fcore_closeout_chain_ready, true);
  assert.equal(result.summary.g1a_source_evidence_complete_now, true);
  assert.equal(result.summary.fcore_phase_count, 25);
  assert.equal(result.summary.fcore_phase_ready_count, 25);
  assert.equal(result.summary.review_phase_count, 20);
  assert.equal(result.summary.review_phase_ready_count, 20);
  assert.equal(result.summary.g1a_owner_gate_opening_chain_ready, true);
  assert.equal(result.summary.readiness_row_count, 12);
  assert.equal(result.summary.readiness_fail_count, 0);
  assert.equal(result.summary.readiness_wait_count, 0);
  assert.equal(result.summary.readiness_pass_count, 12);
  assert.equal(result.summary.factory_promotion_goal_complete_allowed_now, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.deepEqual(result.summary.waiting_blocker_ids, []);
});

test("Factory Promotion Closeout Readiness accepts a signed owner receipt path and remains ready for protected closeout", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-promotion-closeout-owner-receipt-"));
  const receiptPath = path.join(outDir, "signed-owner-receipt.json");
  try {
    await writeFile(receiptPath, `${JSON.stringify(buildSignedOwnerReceipt(), null, 2)}\n`, "utf8");
    const result = await buildFactoryPromotionCloseoutReadiness({
      runAt: RUN_AT,
      write: false,
      commitRef: "2c144d2",
      ownerReceiptPath: receiptPath,
    });
    const rows = new Map(result.factory_promotion_closeout_readiness_rows.map((row) => [row.row_id, row]));

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.factory_promotion_closeout_readiness_status, "ready_for_human_owner_protected_closeout");
    assert.equal(result.summary.readiness_pass_count, 12);
    assert.equal(result.summary.readiness_wait_count, 0);
    assert.equal(result.summary.readiness_fail_count, 0);
    assert.equal(rows.get("g1a.owner_candidate_selected").current_verdict, "pass");
    assert.equal(rows.get("g1a.signed_owner_receipt_present").current_verdict, "pass");
    assert.equal(rows.get("g1a.source_literal_commit_applied").current_verdict, "pass");
    assert.equal(rows.get("g1a.first_use_audit_present").current_verdict, "pass");
    assert.equal(rows.get("g1a.opening_closeout_ready").current_verdict, "pass");
    assert.deepEqual(result.summary.hard_blocker_ids, []);

    const check = spawnSync("node", [
      "scripts/factory-promotion-closeout-readiness.mjs",
      "--check",
      "--owner-receipt-path",
      receiptPath,
      "--run-at",
      RUN_AT,
      "--commit-ref",
      "2c144d2",
    ], { cwd: path.resolve("."), encoding: "utf8" });
    assert.equal(check.status, 0, check.stdout + check.stderr);
    assert.match(check.stdout, /Rows pass\/wait\/fail: 12\/0\/0/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
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

    assert.equal(result.summary.factory_promotion_closeout_readiness_status, "ready_for_human_owner_protected_closeout");
    assert.equal(artifact.summary.fcore_closeout_chain_ready, true);
    assert.equal(rows.count, 12);
    assert.equal(blockers.count, 0);
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

function buildSignedOwnerReceipt() {
  return {
    schema_version: "factory-gate-opening-owner-receipt.v1",
    receipt_id: "OWNER-G1A-GATE-OPENING-GONYAK-CELL-20260612-ALPHA",
    receipt_kind: "gate_opening",
    receipt_status: "signed",
    generated_at: "2026-06-12T07:06:12.477Z",
    gate_id: "G1a",
    gate_name: "project_creation",
    authority_flag: "project_creation_allowed_now",
    target_action: "project_workspace_creation",
    target_action_status: "not_performed",
    reviewed_commit_sha: "e681f2a7fc9a6f9915f94dd1428877a5b02393c1",
    scope_limit: "new product workspace creation only; one owner gate_opening receipt permits one scoped creation action",
    one_receipt_one_action: true,
    human_owner_signature_required: true,
    human_owner_signed: true,
    owner_name: "Gonyak-cell",
    owner_signed_at: "2026-06-12T07:06:37Z",
    owner_decision: "approve_g1a_opening",
    source_literal_opening_commit_required: true,
    source_literal_opening_commit_sha: null,
    independent_review_required: true,
    independent_review_receipt_ref: "docs/factory-promotion/g1a-claude-opus-4-8-review-receipt.md",
    first_use_audit_required: true,
    first_use_audit_ref: null,
    candidate_binding_required: true,
    bound_candidate_manifest_sha256: null,
    bound_candidate_packet_sha256: "2bcd78b696c3c4179eb406184e48277e7fb0833f765bea1c4ed5d218eb5c09ab",
    notes: "Owner explicitly instructed Codex in-chat to proceed with Codex recommended alpha candidate and then stated: \"서명할게 서.명.\" This file records that owner action while keeping all authority flags closed. Source-literal opening commit and first-use audit remain required.",
    project_creation_allowed_now: false,
    review_decision_allowed_now: false,
    approval_allowed_now: false,
    apply_allowed_now: false,
    command_execution_enabled: false,
    command_execution_allowed_now: false,
    work_packet_execution_allowed_now: false,
    work_item_execution_allowed_now: false,
    validation_loop_execution_allowed_now: false,
    worker_execution_allowed_now: false,
    source_file_write_allowed_now: false,
    ledger_append_allowed_now: false,
    persistent_ledger_append_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    signed_receipt_sha256: "db24cc4304a16857bcf8ddc654a264413a49345216e873903cc151b41e79c272",
  };
}

test("Review API exposes Factory Promotion closeout readiness as read-only protected-closeout-ready data", async () => {
  const response = await buildReviewApiResponse("/api/factory/promotion-closeout-readiness?category=g1a_owner", {
    runAt: RUN_AT,
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.collection, "factory_promotion_closeout_readiness_rows");
  assert.equal(body.read_only, true);
  assert.equal(body.mutation_allowed, false);
  assert.equal(body.summary.factory_promotion_closeout_readiness_status, "ready_for_human_owner_protected_closeout");
  assert.equal(body.fcore_closeout_chain_ready, true);
  assert.equal(body.g1a_owner_gate_opening_chain_ready, true);
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
