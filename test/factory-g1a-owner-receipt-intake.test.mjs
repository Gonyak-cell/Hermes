import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReviewApiResponse } from "../src/review-api.mjs";
import {
  buildFactoryG1aOwnerReceiptIntake,
  runFactoryG1aOwnerReceiptIntake,
} from "../src/factory-g1a-owner-receipt-intake.mjs";

const RUN_AT = "2026-06-12T20:00:00.000Z";
const HASH = "a".repeat(64);

test("Factory G1a Owner Receipt Intake waits on the unsigned template without opening authority", async () => {
  const result = await buildFactoryG1aOwnerReceiptIntake({
    runAt: RUN_AT,
    write: false,
    commitRef: "4102a3d",
  });

  assert.equal(result.schema_version, "factory-g1a-owner-receipt-intake.v1");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_g1a_owner_receipt_intake_status, "waiting_for_signed_g1a_owner_receipt");
  assert.equal(result.summary.owner_gate_opening_receipt_signed_now, false);
  assert.equal(result.summary.g1a_owner_receipt_ready_for_source_literal_commit, false);
  assert.ok(result.summary.owner_receipt_wait_count >= 1);
  assert.equal(result.summary.g1a_owner_receipt_intake_can_open_gate_now, false);
  assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.equal(result.owner_receipt_intake_rows.some((row) => row.current_verdict === "wait"), true);
});

test("Factory G1a Owner Receipt Intake accepts a signed scoped receipt candidate", async () => {
  const ownerReceipt = buildSignedOwnerReceipt();
  const result = await buildFactoryG1aOwnerReceiptIntake({
    runAt: RUN_AT,
    write: false,
    commitRef: "4102a3d",
    ownerReceipt,
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_g1a_owner_receipt_intake_status, "ready_g1a_owner_receipt_for_source_literal_commit");
  assert.equal(result.summary.owner_gate_opening_receipt_signed_now, true);
  assert.equal(result.summary.g1a_owner_receipt_ready_for_source_literal_commit, true);
  assert.equal(result.summary.owner_receipt_wait_count, 0);
  assert.equal(result.summary.owner_receipt_fail_count, 0);
  assert.equal(result.summary.g1a_owner_receipt_intake_can_open_gate_now, false);
  assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
});

test("Factory G1a Owner Receipt Intake rejects wrong gate or authority claims", async () => {
  const wrongGate = { ...buildSignedOwnerReceipt(), gate_id: "G1b" };
  const result = await buildFactoryG1aOwnerReceiptIntake({
    runAt: RUN_AT,
    write: false,
    commitRef: "4102a3d",
    ownerReceipt: wrongGate,
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.factory_g1a_owner_receipt_intake_status, "blocked_g1a_owner_receipt_intake");
  assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.equal(result.validation.errors.some((error) => error.item_id === "receipt.no_fail_rows"), true);

  const badAuthority = {
    ...buildSignedOwnerReceipt(),
    production_pass_enabled: true,
  };
  const authorityResult = await buildFactoryG1aOwnerReceiptIntake({
    runAt: RUN_AT,
    write: false,
    commitRef: "4102a3d",
    ownerReceipt: badAuthority,
  });

  assert.equal(authorityResult.validation.valid, false);
  assert.equal(authorityResult.summary.production_pass_enabled, false);
  assert.equal(authorityResult.summary.enterprise_pass_enabled, false);
});

test("Factory G1a Owner Receipt Intake writes artifacts and check mode does not overwrite", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-owner-receipt-intake-out-"));
  try {
    const result = await runFactoryG1aOwnerReceiptIntake({
      outDir,
      runAt: RUN_AT,
      check: false,
      ownerReceipt: buildSignedOwnerReceipt(),
      requirePass: true,
      commitRef: "4102a3d",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-g1a-owner-receipt-intake.json"), "utf8"));
    const rows = JSON.parse(await readFile(path.join(outDir, "owner-receipt-intake-rows.json"), "utf8"));
    const boundary = JSON.parse(await readFile(path.join(outDir, "boundary.json"), "utf8"));

    assert.equal(result.summary.factory_g1a_owner_receipt_intake_status, "ready_g1a_owner_receipt_for_source_literal_commit");
    assert.equal(artifact.summary.g1a_project_creation_gate_open_now, false);
    assert.equal(rows.count, 18);
    assert.equal(boundary.g1a_owner_receipt_intake_can_open_gate_now, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }

  const checkDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-owner-receipt-intake-check-"));
  try {
    const sentinelPath = path.join(checkDir, "factory-g1a-owner-receipt-intake.json");
    const sentinel = '{ "sentinel": "factory-g1a-owner-receipt-intake" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-g1a-owner-receipt-intake.mjs",
      "--check",
      "--out-dir",
      checkDir,
      "--run-at",
      RUN_AT,
      "--commit-ref",
      "4102a3d",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(checkDir, { recursive: true, force: true });
  }
});

test("Review API exposes G1a owner receipt intake as read-only waiting data", async () => {
  const response = await buildReviewApiResponse("/api/factory/g1a-owner-receipt-intake?category=owner_signature", {
    runAt: RUN_AT,
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.collection, "factory_g1a_owner_receipt_intake_rows");
  assert.equal(body.read_only, true);
  assert.equal(body.mutation_allowed, false);
  assert.equal(body.intake_only, true);
  assert.equal(body.opens_gate_now, false);
  assert.equal(body.summary.factory_g1a_owner_receipt_intake_status, "waiting_for_signed_g1a_owner_receipt");
  assert.equal(body.summary.owner_gate_opening_receipt_signed_now, false);
  assert.equal(body.g1a_project_creation_gate_open_now, false);
  assert.equal(body.project_creation_allowed_now, false);

  const invalid = await buildReviewApiResponse("/api/factory/g1a-owner-receipt-intake", {
    runAt: RUN_AT,
    ownerReceipt: { ...buildSignedOwnerReceipt(), gate_id: "G2" },
  });
  const invalidBody = JSON.parse(invalid.body);
  assert.equal(invalid.status, 503);
  assert.equal(invalidBody.error, "factory_g1a_owner_receipt_intake_unavailable");

  const head = await buildReviewApiResponse("/api/factory/g1a-owner-receipt-intake?limit=1", {
    method: "HEAD",
    runAt: RUN_AT,
  });
  assert.equal(head.status, 200);
  assert.equal(head.body, "");

  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const denied = await buildReviewApiResponse("/api/factory/g1a-owner-receipt-intake", {
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
    receipt_id: "OWNER-G1A-GATE-OPENING-SIGNED-TEST",
    receipt_kind: "gate_opening",
    receipt_status: "signed",
    gate_id: "G1a",
    gate_name: "project_creation",
    authority_flag: "project_creation_allowed_now",
    target_action: "project_workspace_creation",
    target_action_status: "not_performed",
    reviewed_commit_sha: "4102a3d",
    scope_limit: "new product workspace creation only; one owner gate_opening receipt permits one scoped creation action",
    one_receipt_one_action: true,
    human_owner_signature_required: true,
    human_owner_signed: true,
    owner_name: "Hermes Owner",
    owner_signed_at: RUN_AT,
    owner_decision: "approve_g1a_opening",
    source_literal_opening_commit_required: true,
    source_literal_opening_commit_sha: null,
    independent_review_required: true,
    independent_review_receipt_ref: "docs/factory-promotion/g1a-claude-opus-4-8-review-receipt.md",
    first_use_audit_required: true,
    first_use_audit_ref: null,
    candidate_binding_required: true,
    bound_candidate_manifest_sha256: HASH,
    bound_candidate_packet_sha256: null,
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
  };
}
