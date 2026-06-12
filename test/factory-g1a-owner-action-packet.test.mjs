import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFactoryG1aOwnerActionPacket,
  runFactoryG1aOwnerActionPacket,
} from "../src/factory-g1a-owner-action-packet.mjs";
import { buildReviewApiResponse } from "../src/review-api.mjs";

const RUN_AT = "2026-06-13T00:30:00.000Z";

function parseJsonResponse(response) {
  return JSON.parse(response.body);
}

test("Factory G1a owner action packet surfaces owner actions without selecting, signing, mutating, or opening", async () => {
  const result = await buildFactoryG1aOwnerActionPacket({
    runAt: RUN_AT,
    write: false,
  });

  assert.equal(result.schema_version, "factory-g1a-owner-action-packet.v1");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_g1a_owner_action_packet_status, "ready_g1a_owner_action_packet");
  assert.equal(result.summary.owner_candidate_card_count, 3);
  assert.equal(result.summary.eligible_candidate_count, 3);
  assert.equal(result.summary.selected_candidate_now, false);
  assert.equal(result.summary.candidate_hash_bound_now, false);
  assert.equal(result.summary.owner_selection_required_now, true);
  assert.equal(result.summary.owner_signature_required_now, true);
  assert.equal(result.summary.first_required_owner_action, "owner.choose_candidate_hash");
  assert.equal(result.summary.owner_action_row_count, 8);
  assert.equal(result.summary.owner_action_pass_count, 0);
  assert.equal(result.summary.owner_action_wait_count, 8);
  assert.equal(result.summary.owner_action_fail_count, 0);
  assert.equal(result.summary.signs_owner_receipt_now, false);
  assert.equal(result.summary.source_mutation_allowed_now, false);
  assert.equal(result.summary.source_literal_opening_commit_applied_now, false);
  assert.equal(result.summary.first_use_audit_present, false);
  assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.doesNotMatch(result.owner_action_rows[0].next_action, /[a-f0-9]{64}/);
  assert.match(result.owner_action_rows[0].next_action, /<owner-selected-candidate-packet-sha256>/);
  assert.equal(result.owner_candidate_action_cards.every((card) => !Object.hasOwn(card, "recommended_hash_kind")), true);
  assert.equal(result.owner_candidate_action_cards.every((card) => card.bind_hash_kind === "candidate_packet_sha256"), true);
  assert.equal(result.owner_candidate_action_cards.every((card) => card.card_selects_by_default === false), true);
  assert.equal(result.owner_candidate_action_cards.every((card) => card.card_signs_owner_receipt_now === false), true);
  assert.equal(result.owner_candidate_action_cards.every((card) => card.card_opens_gate_now === false), true);
  assert.equal(result.owner_candidate_action_cards.every((card) => card.card_mutates_source_now === false), true);
});

test("Factory G1a owner action packet marks explicit selected candidate prebind readiness only", async () => {
  const base = await buildFactoryG1aOwnerActionPacket({
    runAt: RUN_AT,
    write: false,
  });
  const selected = base.owner_candidate_action_cards[0];
  const result = await buildFactoryG1aOwnerActionPacket({
    runAt: RUN_AT,
    write: false,
    selectedCandidatePacketSha256: selected.candidate_packet_sha256,
  });
  const rows = new Map(result.owner_action_rows.map((row) => [row.row_id, row]));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.selected_candidate_now, true);
  assert.equal(result.summary.candidate_hash_bound_now, true);
  assert.equal(result.summary.owner_selection_required_now, false);
  assert.equal(rows.get("owner.choose_candidate_hash").current_verdict, "pass");
  assert.equal(rows.get("owner.run_prebind_check").current_verdict, "pass");
  assert.equal(rows.get("owner.sign_gate_opening_receipt").current_verdict, "wait");
  assert.equal(result.summary.owner_action_pass_count, 2);
  assert.equal(result.summary.owner_action_wait_count, 6);
  assert.equal(result.summary.signs_owner_receipt_now, false);
  assert.equal(result.summary.opens_gate_now, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
});

test("Factory G1a owner action packet does not infer source completion from empty closeout rows", async () => {
  const result = await buildFactoryG1aOwnerActionPacket({
    runAt: RUN_AT,
    write: false,
    promotionCloseoutReadiness: {
      validation: { valid: true, errors: [] },
      summary: {
        factory_promotion_closeout_readiness_status: "waiting_for_g1a_owner_gate_opening_chain",
        ready_for_human_owner_protected_closeout: false,
        g1a_owner_gate_opening_chain_ready: false,
        waiting_blocker_ids: [],
      },
      factory_promotion_closeout_readiness_rows: [],
    },
  });
  const rows = new Map(result.owner_action_rows.map((row) => [row.row_id, row]));

  assert.equal(result.validation.valid, true);
  assert.equal(rows.get("codex.apply_source_literal_commit").current_verdict, "wait");
  assert.equal(rows.get("codex.capture_first_use_audit").current_verdict, "wait");
  assert.equal(rows.get("owner.protected_closeout_adjudication").current_verdict, "wait");
  assert.equal(result.summary.source_literal_opening_commit_applied_now, false);
  assert.equal(result.summary.first_use_audit_present, false);
  assert.equal(result.summary.factory_promotion_goal_complete_allowed_now, false);
});

test("Factory G1a owner action packet accepts future protected closeout-ready status without opening authority", async () => {
  const result = await buildFactoryG1aOwnerActionPacket({
    runAt: RUN_AT,
    write: false,
    promotionCloseoutReadiness: {
      validation: { valid: true, errors: [] },
      summary: {
        factory_promotion_closeout_readiness_status: "ready_for_human_owner_protected_closeout",
        ready_for_human_owner_protected_closeout: true,
        g1a_owner_gate_opening_chain_ready: true,
        waiting_blocker_ids: [],
      },
      factory_promotion_closeout_readiness_rows: [
        { row_id: "g1a.source_literal_commit_applied", current_verdict: "pass" },
        { row_id: "g1a.first_use_audit_present", current_verdict: "pass" },
        { row_id: "g1a.opening_closeout_ready", current_verdict: "pass" },
      ],
    },
  });
  const rows = new Map(result.owner_action_rows.map((row) => [row.row_id, row]));

  assert.equal(result.validation.valid, true);
  assert.equal(rows.get("codex.apply_source_literal_commit").current_verdict, "pass");
  assert.equal(rows.get("codex.capture_first_use_audit").current_verdict, "pass");
  assert.equal(rows.get("owner.protected_closeout_adjudication").current_verdict, "pass");
  assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
});

test("Factory G1a owner action packet writes artifacts and check mode does not overwrite", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-owner-action-packet-out-"));
  try {
    const result = await runFactoryG1aOwnerActionPacket({
      outDir,
      runAt: RUN_AT,
      check: false,
      requirePass: true,
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-g1a-owner-action-packet.json"), "utf8"));
    const cards = JSON.parse(await readFile(path.join(outDir, "owner-candidate-action-cards.json"), "utf8"));
    const rows = JSON.parse(await readFile(path.join(outDir, "owner-action-rows.json"), "utf8"));
    const workOrder = JSON.parse(await readFile(path.join(outDir, "owner-work-order.json"), "utf8"));

    assert.equal(result.summary.factory_g1a_owner_action_packet_status, "ready_g1a_owner_action_packet");
    assert.equal(artifact.summary.owner_action_wait_count, 8);
    assert.equal(cards.count, 3);
    assert.equal(rows.count, 8);
    assert.equal(workOrder.signs_owner_receipt_now, false);
    assert.equal(workOrder.signable_owner_receipt_draft_ref_kind, "logical_source_ref_not_materialized_by_this_command");
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }

  const checkDir = await mkdtemp(path.join(os.tmpdir(), "factory-g1a-owner-action-packet-check-"));
  try {
    const sentinelPath = path.join(checkDir, "factory-g1a-owner-action-packet.json");
    const sentinel = '{ "sentinel": "factory-g1a-owner-action-packet" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-g1a-owner-action-packet.mjs",
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

test("Review API exposes G1a owner action packet as read-only owner action data", async () => {
  const response = await buildReviewApiResponse("/api/factory/g1a-owner-action-packet?limit=2", {
    runAt: RUN_AT,
  });
  const body = parseJsonResponse(response);

  assert.equal(response.status, 200);
  assert.equal(body.collection, "factory_g1a_owner_action_rows");
  assert.equal(body.read_only, true);
  assert.deepEqual(body.method_allowlist, ["GET", "HEAD"]);
  assert.equal(body.mutation_allowed, false);
  assert.equal(body.action_packet_only, true);
  assert.equal(body.owner_completion_required, true);
  assert.equal(body.signs_owner_receipt_now, false);
  assert.equal(body.source_mutation_allowed_now, false);
  assert.equal(body.opens_gate_now, false);
  assert.equal(body.g1a_project_creation_gate_open_now, false);
  assert.equal(body.project_creation_allowed_now, false);
  assert.equal(body.production_pass_enabled, false);
  assert.equal(body.enterprise_pass_enabled, false);
  assert.equal(body.count, 2);
  assert.equal(body.total_count, 8);
  assert.equal(body.owner_candidate_action_cards.length, 3);
  assert.equal(body.owner_work_order.first_required_owner_action, "owner.choose_candidate_hash");
  assert.equal(body.summary.factory_g1a_owner_action_packet_status, "ready_g1a_owner_action_packet");
  assert.equal(body.validation_error_count, 0);

  const head = await buildReviewApiResponse("/api/factory/g1a-owner-action-packet?limit=1", {
    method: "HEAD",
    runAt: RUN_AT,
  });
  assert.equal(head.status, 200);
  assert.equal(head.body, "");

  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const denied = await buildReviewApiResponse("/api/factory/g1a-owner-action-packet", {
      method,
      runAt: RUN_AT,
    });
    const deniedBody = parseJsonResponse(denied);
    assert.equal(denied.status, 405);
    assert.equal(deniedBody.error, "method_not_allowed");
  }
});
