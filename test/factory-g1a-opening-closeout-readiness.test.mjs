import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReviewApiResponse } from "../src/review-api.mjs";
import {
  buildFactoryG1aOpeningCloseoutReadiness,
  runFactoryG1aOpeningCloseoutReadiness,
} from "../src/factory-g1a-opening-closeout-readiness.mjs";

const RUN_AT = "2026-06-12T22:30:00.000Z";
const HASH = "c".repeat(64);

test("Factory G1a Opening Closeout Readiness reports source-bound G1a evidence without opening authority", async () => {
  const result = await buildFactoryG1aOpeningCloseoutReadiness({
    runAt: RUN_AT,
    write: false,
    commitRef: "58b1f09",
  });

  assert.equal(result.schema_version, "factory-g1a-opening-closeout-readiness.v1");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_g1a_opening_closeout_readiness_status, "ready_g1a_opening_closeout_for_owner_adjudication");
  assert.equal(result.summary.ready_for_g1a_opening_closeout_owner_adjudication, true);
  assert.equal(result.summary.chain_row_count, 10);
  assert.equal(result.summary.chain_pass_count, 10);
  assert.equal(result.summary.chain_wait_count, 0);
  assert.equal(result.summary.chain_fail_count, 0);
  assert.equal(result.summary.blocker_count, 0);
  assert.equal(result.summary.g1a_source_evidence_complete_now, true);
  assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.deepEqual(result.summary.waiting_blocker_ids, []);
});

test("Factory G1a Opening Closeout Readiness remains ready with an explicit signed receipt and keeps G1a authority closed", async () => {
  const result = await buildFactoryG1aOpeningCloseoutReadiness({
    runAt: RUN_AT,
    write: false,
    commitRef: "58b1f09",
    ownerReceipt: buildSignedOwnerReceipt(),
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_g1a_opening_closeout_readiness_status, "ready_g1a_opening_closeout_for_owner_adjudication");
  assert.equal(result.summary.chain_pass_count, 10);
  assert.equal(result.summary.chain_wait_count, 0);
  assert.equal(result.summary.chain_fail_count, 0);
  assert.equal(result.summary.ready_for_g1a_opening_closeout_owner_adjudication, true);
  assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.deepEqual(result.summary.waiting_blocker_ids, []);
});

test("Factory G1a Opening Closeout Readiness blocks invalid owner receipt inputs", async () => {
  const result = await buildFactoryG1aOpeningCloseoutReadiness({
    runAt: RUN_AT,
    write: false,
    commitRef: "58b1f09",
    ownerReceipt: { ...buildSignedOwnerReceipt(), authority_flag: "deployment_allowed_now" },
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.factory_g1a_opening_closeout_readiness_status, "blocked_g1a_opening_closeout_readiness");
  assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.ok(result.validation.errors.some((error) => error.item_id === "source.owner_receipt_intake_valid"));
});

test("Factory G1a Opening Closeout Readiness writes artifacts and check mode does not overwrite", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-opening-closeout-readiness-out-"));
  try {
    const result = await runFactoryG1aOpeningCloseoutReadiness({
      outDir,
      runAt: RUN_AT,
      check: false,
      commitRef: "58b1f09",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-g1a-opening-closeout-readiness.json"), "utf8"));
    const rows = JSON.parse(await readFile(path.join(outDir, "closeout-chain-rows.json"), "utf8"));
    const blockers = JSON.parse(await readFile(path.join(outDir, "closeout-blocker-rows.json"), "utf8"));
    const boundary = JSON.parse(await readFile(path.join(outDir, "boundary.json"), "utf8"));

    assert.equal(result.summary.factory_g1a_opening_closeout_readiness_status, "ready_g1a_opening_closeout_for_owner_adjudication");
    assert.equal(artifact.summary.g1a_project_creation_gate_open_now, false);
    assert.equal(rows.count, 10);
    assert.equal(blockers.count, 0);
    assert.equal(boundary.project_creation_allowed_now, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }

  const checkDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-opening-closeout-readiness-check-"));
  try {
    const sentinelPath = path.join(checkDir, "factory-g1a-opening-closeout-readiness.json");
    const sentinel = '{ "sentinel": "factory-g1a-opening-closeout-readiness" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-g1a-opening-closeout-readiness.mjs",
      "--check",
      "--out-dir",
      checkDir,
      "--run-at",
      RUN_AT,
      "--commit-ref",
      "58b1f09",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(checkDir, { recursive: true, force: true });
  }
});

test("Review API exposes G1a opening closeout readiness as read-only waiting data", async () => {
  const response = await buildReviewApiResponse("/api/factory/g1a-opening-closeout-readiness?category=owner_receipt", {
    runAt: RUN_AT,
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.collection, "factory_g1a_opening_closeout_chain_rows");
  assert.equal(body.read_only, true);
  assert.equal(body.mutation_allowed, false);
  assert.equal(body.closeout_readiness_only, true);
  assert.equal(body.owner_adjudication_required, true);
  assert.equal(body.summary.factory_g1a_opening_closeout_readiness_status, "ready_g1a_opening_closeout_for_owner_adjudication");
  assert.equal(body.g1a_source_evidence_complete_now, true);
  assert.equal(body.g1a_project_creation_gate_open_now, false);
  assert.equal(body.project_creation_allowed_now, false);

  const invalid = await buildReviewApiResponse("/api/factory/g1a-opening-closeout-readiness", {
    runAt: RUN_AT,
    ownerReceipt: { ...buildSignedOwnerReceipt(), gate_id: "G3" },
  });
  const invalidBody = JSON.parse(invalid.body);
  assert.equal(invalid.status, 503);
  assert.equal(invalidBody.error, "factory_g1a_opening_closeout_readiness_unavailable");

  const head = await buildReviewApiResponse("/api/factory/g1a-opening-closeout-readiness?limit=1", {
    method: "HEAD",
    runAt: RUN_AT,
  });
  assert.equal(head.status, 200);
  assert.equal(head.body, "");

  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const denied = await buildReviewApiResponse("/api/factory/g1a-opening-closeout-readiness", {
      method,
      runAt: RUN_AT,
    });
    const deniedBody = JSON.parse(denied.body);
    assert.equal(denied.status, 405);
    assert.equal(deniedBody.error, "method_not_allowed");
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
