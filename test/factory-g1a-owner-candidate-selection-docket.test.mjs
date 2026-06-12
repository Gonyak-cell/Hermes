import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFactoryG1aOwnerCandidateSelectionDocket,
  runFactoryG1aOwnerCandidateSelectionDocket,
} from "../src/factory-g1a-owner-candidate-selection-docket.mjs";
import { buildReviewApiResponse } from "../src/review-api.mjs";

const RUN_AT = "2026-06-13T00:00:00.000Z";
const HASH_RE = /^[a-f0-9]{64}$/;

function parseJsonResponse(response) {
  return JSON.parse(response.body);
}

test("Factory G1a owner candidate selection docket lists eligible candidates without selecting or opening authority", async () => {
  const result = await buildFactoryG1aOwnerCandidateSelectionDocket({
    runAt: RUN_AT,
    write: false,
  });

  assert.equal(result.schema_version, "factory-g1a-owner-candidate-selection-docket.v1");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_g1a_owner_candidate_selection_docket_status, "ready_g1a_owner_candidate_selection_docket");
  assert.equal(result.summary.eligible_candidate_count, 3);
  assert.equal(result.summary.selection_row_count, 3);
  assert.equal(result.summary.prebind_command_count, 6);
  assert.equal(result.summary.selected_candidate_now, false);
  assert.equal(result.summary.candidate_hash_bound_now, false);
  assert.equal(result.summary.owner_selection_required_now, true);
  assert.equal(result.summary.signs_owner_receipt_now, false);
  assert.equal(result.summary.source_mutation_allowed_now, false);
  assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.g1a_owner_candidate_selection_rows.every((row) => row.eligible_for_owner_selection_now === true), true);
  assert.equal(result.g1a_owner_candidate_selection_rows.every((row) => row.selected_now === false), true);
  assert.equal(result.g1a_owner_candidate_selection_rows.every((row) => HASH_RE.test(row.candidate_packet_sha256) && HASH_RE.test(row.candidate_manifest_sha256)), true);
  assert.equal(result.owner_prebind_command_rows.every((row) => row.command_is_preview_only === true && row.command_signs_receipt_now === false && row.command_opens_gate_now === false), true);
  assert.equal(result.independent_review_packet.method, "law_firm_os_style_claude_opus_4_8_max_compact_packet");
});

test("Factory G1a owner candidate selection docket can pre-bind exactly one selected packet hash", async () => {
  const source = await buildFactoryG1aOwnerCandidateSelectionDocket({
    runAt: RUN_AT,
    write: false,
  });
  const selected = source.g1a_owner_candidate_selection_rows[1];
  const result = await buildFactoryG1aOwnerCandidateSelectionDocket({
    runAt: RUN_AT,
    write: false,
    selectedCandidatePacketSha256: selected.candidate_packet_sha256,
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.selected_candidate_now, true);
  assert.equal(result.summary.candidate_hash_bound_now, true);
  assert.equal(result.summary.owner_selection_required_now, false);
  assert.equal(result.summary.selected_product_id, selected.product_id);
  assert.equal(result.selection_policy.selected_row_count, 1);
  assert.equal(result.selection_policy.exactly_one_hash_selected_now, true);
  assert.equal(result.g1a_owner_candidate_selection_rows.filter((row) => row.selected_now).length, 1);
  assert.equal(result.owner_signing_handoff_preview.candidate_hash_bound_now, true);
  assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
  assert.equal(result.summary.signs_owner_receipt_now, false);
});

test("Factory G1a owner candidate selection docket rejects unmatched selected hashes", async () => {
  const result = await buildFactoryG1aOwnerCandidateSelectionDocket({
    runAt: RUN_AT,
    write: false,
    selectedCandidatePacketSha256: "f".repeat(64),
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.factory_g1a_owner_candidate_selection_docket_status, "blocked_g1a_owner_candidate_selection_docket");
  assert.equal(result.selection_policy.selected_row_count, 0);
  assert.equal(result.validation.errors.some((item) => item.item_id === "selection.explicit_match"), true);
  assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
});

test("Factory G1a owner candidate selection docket writes artifacts and check mode does not overwrite", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-owner-candidate-selection-docket-out-"));
  try {
    const result = await runFactoryG1aOwnerCandidateSelectionDocket({
      outDir,
      runAt: RUN_AT,
      check: false,
      requirePass: true,
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-g1a-owner-candidate-selection-docket.json"), "utf8"));
    const rows = JSON.parse(await readFile(path.join(outDir, "candidate-selection-rows.json"), "utf8"));
    const prompt = await readFile(path.join(outDir, "review-prompt.md"), "utf8");

    assert.equal(result.summary.factory_g1a_owner_candidate_selection_docket_status, "ready_g1a_owner_candidate_selection_docket");
    assert.equal(artifact.summary.eligible_candidate_count, 3);
    assert.equal(rows.count, 3);
    assert.match(prompt, /Claude Code Opus Max reviewer/);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }

  const checkDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-owner-candidate-selection-docket-check-"));
  try {
    const sentinelPath = path.join(checkDir, "factory-g1a-owner-candidate-selection-docket.json");
    const sentinel = '{ "sentinel": "factory-g1a-owner-candidate-selection-docket" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-g1a-owner-candidate-selection-docket.mjs",
      "--check",
      "--require-pass",
      "--out-dir",
      checkDir,
      "--run-at",
      RUN_AT,
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(checkDir, { recursive: true, force: true });
  }
});

test("Review API exposes owner candidate selection docket as read-only data", async () => {
  const response = await buildReviewApiResponse("/api/factory/g1a-owner-candidate-selection-docket?limit=2", {
    runAt: RUN_AT,
  });
  const body = parseJsonResponse(response);

  assert.equal(response.status, 200);
  assert.equal(body.collection, "factory_g1a_owner_candidate_selection_rows");
  assert.equal(body.read_only, true);
  assert.deepEqual(body.method_allowlist, ["GET", "HEAD"]);
  assert.equal(body.mutation_allowed, false);
  assert.equal(body.owner_selection_required, true);
  assert.equal(body.selected_candidate_now, false);
  assert.equal(body.candidate_hash_bound_now, false);
  assert.equal(body.signs_owner_receipt_now, false);
  assert.equal(body.source_mutation_allowed_now, false);
  assert.equal(body.opens_gate_now, false);
  assert.equal(body.g1a_project_creation_gate_open_now, false);
  assert.equal(body.project_creation_allowed_now, false);
  assert.equal(body.production_pass_enabled, false);
  assert.equal(body.enterprise_pass_enabled, false);
  assert.equal(body.count, 2);
  assert.equal(body.total_count, 3);
  assert.equal(body.eligible_candidate_count, 3);
  assert.equal(body.owner_prebind_command_rows.length, 4);
  assert.equal(body.items.every((item) => item.eligible_for_owner_selection_now === true), true);
  assert.equal(body.summary.factory_g1a_owner_candidate_selection_docket_status, "ready_g1a_owner_candidate_selection_docket");
  assert.equal(body.validation_error_count, 0);
});

test("Review API supports HEAD and blocks mutating owner candidate selection docket requests", async () => {
  const head = await buildReviewApiResponse("/api/factory/g1a-owner-candidate-selection-docket?limit=1", {
    method: "HEAD",
    runAt: RUN_AT,
  });
  assert.equal(head.status, 200);
  assert.equal(head.body, "");

  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await buildReviewApiResponse("/api/factory/g1a-owner-candidate-selection-docket", {
      method,
      runAt: RUN_AT,
    });
    const body = parseJsonResponse(response);

    assert.equal(response.status, 405);
    assert.equal(body.error, "method_not_allowed");
  }
});
