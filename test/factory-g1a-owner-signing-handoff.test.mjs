import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildFactoryG1aOwnerReceiptIntake } from "../src/factory-g1a-owner-receipt-intake.mjs";
import {
  buildFactoryG1aOwnerSigningHandoff,
  runFactoryG1aOwnerSigningHandoff,
} from "../src/factory-g1a-owner-signing-handoff.mjs";
import { buildReviewApiResponse } from "../src/review-api.mjs";

const RUN_AT = "2026-06-13T00:00:00.000Z";

test("Factory G1a owner signing handoff is ready but does not sign or open authority", async () => {
  const result = await buildFactoryG1aOwnerSigningHandoff({
    runAt: RUN_AT,
    write: false,
    commitRef: "ad68838",
  });

  assert.equal(result.schema_version, "factory-g1a-owner-signing-handoff.v1");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_g1a_owner_signing_handoff_status, "ready_g1a_owner_signature_handoff");
  assert.equal(result.summary.ready_for_owner_signature_now, true);
  assert.equal(result.summary.owner_gate_opening_receipt_signed_now, false);
  assert.equal(result.summary.signs_owner_receipt_now, false);
  assert.equal(result.summary.source_mutation_allowed_now, false);
  assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.handoff_fail_count, 0);
  assert.ok(result.summary.handoff_wait_count >= 1);
  assert.ok(result.summary.waiting_row_ids.includes("receipt.owner_signature_required"));
  assert.equal(result.signable_owner_receipt_draft.receipt_status, "draft_unsigned");
  assert.equal(result.signable_owner_receipt_draft.human_owner_signed, false);
  assert.equal(result.owner_completion_checklist.required_item_count, 7);
  assert.equal(result.independent_review_packet.method, "law_firm_os_style_claude_opus_4_8_max_compact_packet");
});

test("signable draft keeps owner receipt intake waiting, not ready", async () => {
  const handoff = await buildFactoryG1aOwnerSigningHandoff({
    runAt: RUN_AT,
    write: false,
    commitRef: "ad68838",
  });
  const intake = await buildFactoryG1aOwnerReceiptIntake({
    runAt: RUN_AT,
    write: false,
    commitRef: "ad68838",
    ownerReceipt: handoff.signable_owner_receipt_draft,
  });

  assert.equal(intake.validation.valid, true);
  assert.equal(intake.summary.factory_g1a_owner_receipt_intake_status, "waiting_for_signed_g1a_owner_receipt");
  assert.equal(intake.summary.owner_gate_opening_receipt_signed_now, false);
  assert.equal(intake.summary.g1a_owner_receipt_ready_for_source_literal_commit, false);
});

test("owner signing handoff can pre-bind a candidate hash without opening G1a", async () => {
  const result = await buildFactoryG1aOwnerSigningHandoff({
    runAt: RUN_AT,
    write: false,
    commitRef: "ad68838",
    boundCandidateManifestSha256: "a".repeat(64),
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_g1a_owner_signing_handoff_status, "ready_g1a_owner_signature_handoff");
  assert.equal(result.summary.candidate_hash_bound_now, true);
  assert.equal(result.summary.owner_gate_opening_receipt_signed_now, false);
  assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
  assert.equal(result.g1a_owner_signing_handoff_rows.find((row) => row.row_id === "receipt.candidate_hash_required")?.current_verdict, "pass");
});

test("owner signing handoff writes artifacts and check mode does not overwrite", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-owner-signing-handoff-out-"));
  try {
    const result = await runFactoryG1aOwnerSigningHandoff({
      outDir,
      runAt: RUN_AT,
      check: false,
      requirePass: true,
      commitRef: "ad68838",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-g1a-owner-signing-handoff.json"), "utf8"));
    const workOrder = JSON.parse(await readFile(path.join(outDir, "owner-signing-work-order.json"), "utf8"));
    const reviewPrompt = await readFile(path.join(outDir, "review-prompt.md"), "utf8");

    assert.equal(result.summary.factory_g1a_owner_signing_handoff_status, "ready_g1a_owner_signature_handoff");
    assert.equal(artifact.summary.g1a_project_creation_gate_open_now, false);
    assert.equal(workOrder.work_order_status, "ready_for_owner_to_complete");
    assert.match(reviewPrompt, /Claude Code Opus Max reviewer/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }

  const checkDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-owner-signing-handoff-check-"));
  try {
    const sentinelPath = path.join(checkDir, "factory-g1a-owner-signing-handoff.json");
    const sentinel = '{ "sentinel": "factory-g1a-owner-signing-handoff" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-g1a-owner-signing-handoff.mjs",
      "--check",
      "--require-pass",
      "--out-dir",
      checkDir,
      "--run-at",
      RUN_AT,
      "--commit-ref",
      "ad68838",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(checkDir, { recursive: true, force: true });
  }
});

test("Review API exposes owner signing handoff as read-only data", async () => {
  const response = await buildReviewApiResponse("/api/factory/g1a-owner-signing-handoff?category=owner_signature", {
    runAt: RUN_AT,
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.collection, "factory_g1a_owner_signing_handoff_rows");
  assert.equal(body.read_only, true);
  assert.equal(body.mutation_allowed, false);
  assert.equal(body.handoff_only, true);
  assert.equal(body.owner_completion_required, true);
  assert.equal(body.signs_owner_receipt_now, false);
  assert.equal(body.source_mutation_allowed_now, false);
  assert.equal(body.opens_gate_now, false);
  assert.equal(body.summary.factory_g1a_owner_signing_handoff_status, "ready_g1a_owner_signature_handoff");
  assert.equal(body.summary.owner_gate_opening_receipt_signed_now, false);
  assert.equal(body.g1a_project_creation_gate_open_now, false);
  assert.equal(body.project_creation_allowed_now, false);
  assert.equal(body.production_pass_enabled, false);
  assert.equal(body.signable_owner_receipt_draft.receipt_status, "draft_unsigned");

  const head = await buildReviewApiResponse("/api/factory/g1a-owner-signing-handoff?limit=1", {
    method: "HEAD",
    runAt: RUN_AT,
  });
  assert.equal(head.status, 200);
  assert.equal(head.body, "");

  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const denied = await buildReviewApiResponse("/api/factory/g1a-owner-signing-handoff", {
      method,
      runAt: RUN_AT,
    });
    const deniedBody = JSON.parse(denied.body);
    assert.equal(denied.status, 405);
    assert.equal(deniedBody.error, "method_not_allowed");
  }
});
