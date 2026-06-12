import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReviewApiResponse } from "../src/review-api.mjs";
import {
  buildFactoryG1aSourceLiteralCommitDraft,
  runFactoryG1aSourceLiteralCommitDraft,
} from "../src/factory-g1a-source-literal-commit-draft.mjs";

const RUN_AT = "2026-06-12T23:40:00.000Z";
const HASH = "d".repeat(64);

test("Factory G1a Source Literal Commit Draft recognizes the already-applied source literal", async () => {
  const result = await buildFactoryG1aSourceLiteralCommitDraft({
    runAt: RUN_AT,
    write: false,
    commitRef: "a271e22",
  });

  assert.equal(result.schema_version, "factory-g1a-source-literal-commit-draft.v1");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_g1a_source_literal_commit_draft_status, "source_literal_commit_already_applied");
  assert.equal(result.summary.owner_gate_opening_receipt_signed_now, false);
  assert.equal(result.summary.patch_available_now, false);
  assert.equal(result.summary.patch_applied_now, true);
  assert.equal(result.summary.source_mutation_allowed_now, false);
  assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.equal(result.source_literal_commit_patch.patch_status, "source_literal_commit_already_applied");
  assert.equal(result.source_literal_commit_patch.unified_diff, "");
  assert.ok(result.source_literal_commit_patch.replacement_results.every((row) => row.preview_state === "template_only_waiting_for_signed_owner_receipt"));
  assert.ok(result.source_literal_commit_patch.replacement_results.every((row) => row.replacement_ready === false));
  assert.ok(result.source_literal_commit_patch.forbidden_symbol_rows.every((row) => row.current_verdict === "pass"));
  assert.ok(result.source_literal_commit_patch.forbidden_symbol_rows.every((row) => row.comparison_materialized_now === true));
});

test("Factory G1a Source Literal Commit Draft emits a single-file patch preview for a signed receipt", async () => {
  await withPreApplySource(async (gateOpeningSourcePath) => {
    const result = await buildFactoryG1aSourceLiteralCommitDraft({
      runAt: RUN_AT,
      write: false,
      commitRef: "a271e22",
      ownerReceipt: buildSignedOwnerReceipt(),
      gateOpeningSourcePath,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.factory_g1a_source_literal_commit_draft_status, "ready_g1a_source_literal_commit_draft");
    assert.equal(result.summary.owner_gate_opening_receipt_signed_now, true);
    assert.equal(result.summary.patch_available_now, true);
    assert.equal(result.summary.patch_applied_now, false);
    assert.equal(result.summary.source_mutation_allowed_now, false);
    assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
    assert.equal(result.summary.project_creation_allowed_now, false);
    assert.equal(result.source_literal_commit_patch.target_file, "src/factory-gate-opening-readiness.mjs");
    assert.equal(result.source_literal_commit_patch.all_required_replacements_exactly_once, true);
    assert.equal(result.source_literal_commit_patch.forbidden_symbols_unchanged, true);
    assert.match(result.source_literal_commit_patch.unified_diff, /G1a: true,/);
    assert.match(result.source_literal_commit_patch.unified_diff, /OWNER-G1A-GATE-OPENING-SIGNED-DRAFT-TEST/);
    assert.ok(result.source_literal_commit_patch.forbidden_symbol_rows.every((row) => row.current_verdict === "pass"));
    assert.ok(result.source_literal_commit_patch.forbidden_symbol_rows.every((row) => row.comparison_materialized_now === true));
    assert.ok(result.source_literal_commit_patch.replacement_results.every((row) => row.preview_state === "materialized_from_signed_owner_receipt"));
    assert.ok(result.source_literal_commit_patch.replacement_results.every((row) => row.replacement_ready === true));
  });
});

test("Factory G1a Source Literal Commit Draft blocks an already-open source literal", async () => {
  const sourceAlreadyOpen = [
    "const SOURCE_LITERAL_GATE_OPEN_COMMITS = {",
    "  G1a: true,",
    "  G1b: false,",
    "  G2: false,",
    "  G3: false,",
    "};",
    "const SOURCE_LITERAL_GATE_OPENING_RECEIPTS = [];",
    "const SOURCE_LITERAL_FIRST_USE_AUDITS = [];",
  ].join("\n");
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-source-literal-draft-open-"));
  try {
    const sourcePath = path.join(tempDir, "source.mjs");
    await writeFile(sourcePath, sourceAlreadyOpen, "utf8");
    const result = await buildFactoryG1aSourceLiteralCommitDraft({
      runAt: RUN_AT,
      write: false,
      commitRef: "a271e22",
      ownerReceipt: buildSignedOwnerReceipt(),
      gateOpeningSourcePath: sourcePath,
    });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.factory_g1a_source_literal_commit_draft_status, "blocked_g1a_source_literal_commit_draft");
    assert.equal(result.summary.patch_available_now, false);
    assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
    assert.ok(result.validation.errors.some((error) => error.item_id === "source.preflight_valid"));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("Factory G1a Source Literal Commit Draft writes artifacts and check mode does not overwrite", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-source-literal-draft-out-"));
  try {
    const result = await withPreApplySource((gateOpeningSourcePath) => runFactoryG1aSourceLiteralCommitDraft({
      outDir,
      runAt: RUN_AT,
      check: false,
      ownerReceipt: buildSignedOwnerReceipt(),
      requirePass: true,
      commitRef: "a271e22",
      gateOpeningSourcePath,
    }));
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-g1a-source-literal-commit-draft.json"), "utf8"));
    const rows = JSON.parse(await readFile(path.join(outDir, "source-literal-commit-draft-rows.json"), "utf8"));
    const boundary = JSON.parse(await readFile(path.join(outDir, "boundary.json"), "utf8"));
    const patch = await readFile(path.join(outDir, "source-literal-opening.patch"), "utf8");

    assert.equal(result.summary.factory_g1a_source_literal_commit_draft_status, "ready_g1a_source_literal_commit_draft");
    assert.equal(artifact.summary.patch_applied_now, false);
    assert.equal(rows.count, 8);
    assert.equal(boundary.g1a_source_literal_commit_draft_can_open_gate_now, false);
    assert.match(patch, /^diff --git/m);

    assert.match(patch, /^diff --git/m);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }

  const checkDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-source-literal-draft-check-"));
  try {
    const sentinelPath = path.join(checkDir, "factory-g1a-source-literal-commit-draft.json");
    const sentinel = '{ "sentinel": "factory-g1a-source-literal-commit-draft" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-g1a-source-literal-commit-draft.mjs",
      "--check",
      "--out-dir",
      checkDir,
      "--run-at",
      RUN_AT,
      "--commit-ref",
      "a271e22",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(checkDir, { recursive: true, force: true });
  }
});

test("Review API exposes G1a source literal commit draft as read-only applied data", async () => {
  const response = await buildReviewApiResponse("/api/factory/g1a-source-literal-commit-draft?category=patch", {
    runAt: RUN_AT,
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.collection, "factory_g1a_source_literal_commit_draft_rows");
  assert.equal(body.read_only, true);
  assert.equal(body.mutation_allowed, false);
  assert.equal(body.commit_draft_only, true);
  assert.equal(body.patch_available_now, false);
  assert.equal(body.patch_applied_now, true);
  assert.equal(body.source_mutation_allowed_now, false);
  assert.equal(body.summary.factory_g1a_source_literal_commit_draft_status, "source_literal_commit_already_applied");
  assert.equal(body.summary.owner_gate_opening_receipt_signed_now, false);
  assert.equal(body.g1a_project_creation_gate_open_now, false);
  assert.equal(body.project_creation_allowed_now, false);

  const invalid = await buildReviewApiResponse("/api/factory/g1a-source-literal-commit-draft", {
    runAt: RUN_AT,
    ownerReceipt: { ...buildSignedOwnerReceipt(), gate_id: "G3" },
  });
  const invalidBody = JSON.parse(invalid.body);
  assert.equal(invalid.status, 503);
  assert.equal(invalidBody.error, "factory_g1a_source_literal_commit_draft_unavailable");

  const head = await buildReviewApiResponse("/api/factory/g1a-source-literal-commit-draft?limit=1", {
    method: "HEAD",
    runAt: RUN_AT,
  });
  assert.equal(head.status, 200);
  assert.equal(head.body, "");

  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const denied = await buildReviewApiResponse("/api/factory/g1a-source-literal-commit-draft", {
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
    receipt_id: "OWNER-G1A-GATE-OPENING-SIGNED-DRAFT-TEST",
    receipt_kind: "gate_opening",
    receipt_status: "signed",
    gate_id: "G1a",
    gate_name: "project_creation",
    authority_flag: "project_creation_allowed_now",
    target_action: "project_workspace_creation",
    target_action_status: "not_performed",
    reviewed_commit_sha: "a271e22",
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
    independent_review_receipt_ref: "docs/factory-promotion/g1a-source-literal-preflight-claude-opus-4-8-review-receipt.md",
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

async function withPreApplySource(callback) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-pre-apply-source-"));
  try {
    const sourcePath = path.join(tempDir, "factory-gate-opening-readiness.mjs");
    await writeFile(sourcePath, [
      "const SOURCE_LITERAL_GATE_OPEN_COMMITS = {",
      "  G1a: false,",
      "  G1b: false,",
      "  G2: false,",
      "  G3: false,",
      "};",
      "const SOURCE_LITERAL_GATE_OPENING_RECEIPTS = [];",
      "const SOURCE_LITERAL_FIRST_USE_AUDITS = [];",
      "",
    ].join("\n"), "utf8");
    return await callback(sourcePath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
