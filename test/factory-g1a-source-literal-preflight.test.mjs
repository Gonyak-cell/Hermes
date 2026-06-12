import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReviewApiResponse } from "../src/review-api.mjs";
import {
  buildFactoryG1aSourceLiteralPreflight,
  runFactoryG1aSourceLiteralPreflight,
} from "../src/factory-g1a-source-literal-preflight.mjs";

const RUN_AT = "2026-06-12T21:30:00.000Z";
const HASH = "b".repeat(64);

test("Factory G1a Source Literal Preflight waits on unsigned owner receipt without mutating source", async () => {
  const result = await buildFactoryG1aSourceLiteralPreflight({
    runAt: RUN_AT,
    write: false,
    commitRef: "bdc9fe5",
  });

  assert.equal(result.schema_version, "factory-g1a-source-literal-preflight.v1");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_g1a_source_literal_preflight_status, "waiting_for_signed_g1a_owner_receipt");
  assert.equal(result.summary.owner_gate_opening_receipt_signed_now, false);
  assert.equal(result.summary.ready_for_isolated_source_literal_commit, false);
  assert.equal(result.summary.source_literal_opening_commit_applied_now, false);
  assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.equal(result.summary.preflight_wait_count >= 1, true);
  assert.equal(result.proposed_source_literal_change.preview_only, true);
  assert.equal(result.proposed_source_literal_change.apply_allowed_now, false);
});

test("Factory G1a Source Literal Preflight becomes ready with a signed scoped receipt candidate", async () => {
  const result = await buildFactoryG1aSourceLiteralPreflight({
    runAt: RUN_AT,
    write: false,
    commitRef: "bdc9fe5",
    ownerReceipt: buildSignedOwnerReceipt(),
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_g1a_source_literal_preflight_status, "ready_g1a_source_literal_commit_preflight");
  assert.equal(result.summary.owner_gate_opening_receipt_signed_now, true);
  assert.equal(result.summary.ready_for_isolated_source_literal_commit, true);
  assert.equal(result.summary.source_literal_opening_commit_applied_now, false);
  assert.equal(result.summary.g1a_source_literal_preflight_can_open_gate_now, false);
  assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.equal(result.summary.preflight_fail_count, 0);
  assert.equal(result.summary.preflight_wait_count, 0);
  assert.ok(result.proposed_source_literal_change.required_replacements.some((item) => item.replacement_id === "g1a.literal.false_to_true"));
  assert.ok(result.proposed_source_literal_change.required_replacements.some((item) => String(item.after).includes("receipt_sha256")));
});

test("Factory G1a Source Literal Preflight blocks wrong gate and existing source literal", async () => {
  const wrongGate = { ...buildSignedOwnerReceipt(), gate_id: "G2" };
  const wrongGateResult = await buildFactoryG1aSourceLiteralPreflight({
    runAt: RUN_AT,
    write: false,
    commitRef: "bdc9fe5",
    ownerReceipt: wrongGate,
  });

  assert.equal(wrongGateResult.validation.valid, false);
  assert.equal(wrongGateResult.summary.factory_g1a_source_literal_preflight_status, "blocked_g1a_source_literal_preflight");
  assert.equal(wrongGateResult.summary.g1a_project_creation_gate_open_now, false);
  assert.equal(wrongGateResult.summary.project_creation_allowed_now, false);

  const sourceAlreadyOpen = [
    "const SOURCE_LITERAL_GATE_OPEN_COMMITS = {",
    "  G1a: true,",
    "};",
    "const SOURCE_LITERAL_GATE_OPENING_RECEIPTS = [];",
    "const SOURCE_LITERAL_FIRST_USE_AUDITS = [];",
  ].join("\n");
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-source-literal-open-"));
  try {
    const sourcePath = path.join(tempDir, "source.mjs");
    await writeFile(sourcePath, sourceAlreadyOpen, "utf8");
    const sourceResult = await buildFactoryG1aSourceLiteralPreflight({
      runAt: RUN_AT,
      write: false,
      commitRef: "bdc9fe5",
      ownerReceipt: buildSignedOwnerReceipt(),
      gateOpeningSourcePath: sourcePath,
    });
    assert.equal(sourceResult.validation.valid, false);
    assert.equal(sourceResult.summary.factory_g1a_source_literal_preflight_status, "blocked_g1a_source_literal_preflight");
    assert.ok(sourceResult.validation.errors.some((error) => error.item_id === "source.g1a_literal_false"));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("Factory G1a Source Literal Preflight writes artifacts and check mode does not overwrite", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-source-literal-preflight-out-"));
  try {
    const result = await runFactoryG1aSourceLiteralPreflight({
      outDir,
      runAt: RUN_AT,
      check: false,
      ownerReceipt: buildSignedOwnerReceipt(),
      requirePass: true,
      commitRef: "bdc9fe5",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-g1a-source-literal-preflight.json"), "utf8"));
    const rows = JSON.parse(await readFile(path.join(outDir, "source-literal-preflight-rows.json"), "utf8"));
    const boundary = JSON.parse(await readFile(path.join(outDir, "boundary.json"), "utf8"));

    assert.equal(result.summary.factory_g1a_source_literal_preflight_status, "ready_g1a_source_literal_commit_preflight");
    assert.equal(artifact.summary.source_literal_opening_commit_applied_now, false);
    assert.equal(rows.count, 12);
    assert.equal(boundary.g1a_source_literal_preflight_can_open_gate_now, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }

  const checkDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-source-literal-preflight-check-"));
  try {
    const sentinelPath = path.join(checkDir, "factory-g1a-source-literal-preflight.json");
    const sentinel = '{ "sentinel": "factory-g1a-source-literal-preflight" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-g1a-source-literal-preflight.mjs",
      "--check",
      "--out-dir",
      checkDir,
      "--run-at",
      RUN_AT,
      "--commit-ref",
      "bdc9fe5",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(checkDir, { recursive: true, force: true });
  }
});

test("Review API exposes G1a source literal preflight as read-only waiting data", async () => {
  const response = await buildReviewApiResponse("/api/factory/g1a-source-literal-preflight?category=owner_receipt", {
    runAt: RUN_AT,
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.collection, "factory_g1a_source_literal_preflight_rows");
  assert.equal(body.read_only, true);
  assert.equal(body.mutation_allowed, false);
  assert.equal(body.preflight_only, true);
  assert.equal(body.source_mutation_allowed_now, false);
  assert.equal(body.summary.factory_g1a_source_literal_preflight_status, "waiting_for_signed_g1a_owner_receipt");
  assert.equal(body.summary.owner_gate_opening_receipt_signed_now, false);
  assert.equal(body.g1a_project_creation_gate_open_now, false);
  assert.equal(body.project_creation_allowed_now, false);

  const invalid = await buildReviewApiResponse("/api/factory/g1a-source-literal-preflight", {
    runAt: RUN_AT,
    ownerReceipt: { ...buildSignedOwnerReceipt(), authority_flag: "deployment_allowed_now" },
  });
  const invalidBody = JSON.parse(invalid.body);
  assert.equal(invalid.status, 503);
  assert.equal(invalidBody.error, "factory_g1a_source_literal_preflight_unavailable");

  const head = await buildReviewApiResponse("/api/factory/g1a-source-literal-preflight?limit=1", {
    method: "HEAD",
    runAt: RUN_AT,
  });
  assert.equal(head.status, 200);
  assert.equal(head.body, "");

  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const denied = await buildReviewApiResponse("/api/factory/g1a-source-literal-preflight", {
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
    receipt_id: "OWNER-G1A-GATE-OPENING-SIGNED-PREFLIGHT-TEST",
    receipt_kind: "gate_opening",
    receipt_status: "signed",
    gate_id: "G1a",
    gate_name: "project_creation",
    authority_flag: "project_creation_allowed_now",
    target_action: "project_workspace_creation",
    target_action_status: "not_performed",
    reviewed_commit_sha: "bdc9fe5",
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
    independent_review_receipt_ref: "docs/factory-promotion/g1a-owner-receipt-intake-claude-opus-4-8-review-receipt.md",
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
