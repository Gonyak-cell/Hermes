import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReviewApiResponse } from "../src/review-api.mjs";
import { buildFactoryCandidateLane, runFactoryCandidateLane } from "../src/factory-candidate-lane.mjs";
import { appendFactoryLedgerEntry } from "../src/factory-product-registry-store.mjs";

const RUN_AT = "2026-06-11T00:00:00.000Z";
const AUTHORITY_CLOSED = {
  project_creation_allowed_now: false,
  repo_write_allowed_now: false,
  connector_write_allowed_now: false,
  deployment_allowed_now: false,
  protected_action_allowed_now: false,
  production_pass_enabled: false,
  enterprise_pass_enabled: false,
};

function parseJsonResponse(response) {
  return JSON.parse(response.body);
}

async function withTempLedger(fn) {
  const ledgerDir = await mkdtemp(path.join(os.tmpdir(), "factory-candidate-lane-ledger-"));
  try {
    return await fn(ledgerDir);
  } finally {
    await rm(ledgerDir, { recursive: true, force: true });
  }
}

function ledgerOptions(ledgerDir) {
  return {
    ledgerDir,
    allowTestLedgerRoot: true,
  };
}

function productDraft(productId, suffix = productId.replace(/^product\./, "")) {
  return {
    schema_version: "product-record.v1",
    product_id: productId,
    tenant_id: "tenant.local",
    workspace_id: "workspace.factory",
    domain_pack_ids: ["pack.personal_dev"],
    product_state: "PS0_seed",
    receipt_id: `rcpt-${suffix.replaceAll(".", "-")}`,
    created_at: RUN_AT,
    updated_at: RUN_AT,
    authority_flags: AUTHORITY_CLOSED,
  };
}

function transitionDraft(productId, fromState, toState, suffix = `${fromState}.${toState}`) {
  return {
    schema_version: "product-state-transition.v1",
    transition_id: `transition.${productId.replace(/^product\./, "").replaceAll(".", "_")}.${suffix.replaceAll(".", "_").toLowerCase()}`,
    product_id: productId,
    from_state: fromState,
    to_state: toState,
    receipt_id: `rcpt-${productId.replace(/^product\./, "").replaceAll(".", "-")}-${suffix.replaceAll(".", "-").toLowerCase()}`,
    created_at: RUN_AT,
    authority_flags: AUTHORITY_CLOSED,
  };
}

async function appendPs2Product(ledgerDir, productId) {
  const opts = ledgerOptions(ledgerDir);
  await appendFactoryLedgerEntry("products", productDraft(productId), opts);
  await appendFactoryLedgerEntry("state_transitions", transitionDraft(productId, "PS0_seed", "PS1_schema_valid", "ps0_ps1"), opts);
  await appendFactoryLedgerEntry("state_transitions", transitionDraft(productId, "PS1_schema_valid", "PS2_receipt_bound", "ps1_ps2"), opts);
}

test("Factory Candidate Lane keeps default tracked seed ready with zero candidate packets", async () => {
  const result = await buildFactoryCandidateLane({ runAt: RUN_AT });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_candidate_lane_status, "ready_factory_candidate_lane");
  assert.equal(result.summary.candidate_preview_available_count, 0);
  assert.equal(result.summary.candidate_packet_count, 0);
  assert.equal(result.summary.diff_packet_count, 0);
  assert.equal(result.summary.rollback_plan_count, 0);
  assert.equal(result.summary.preflight_count, 0);
  assert.equal(result.summary.hash_ledger_row_count, 0);
  assert.equal(result.summary.negative_fixture_count, 3);
  assert.equal(result.summary.patch_apply_enabled, false);
  assert.equal(result.summary.apply_allowed_now, false);
  assert.equal(result.factory_candidate_negative_fixture_rows.every((row) => row.observed_outcome === "blocked"), true);
  assert.equal(result.factory_candidate_negative_fixture_rows.every((row) => row.fixture_status === "passed"), true);
});

test("Factory Candidate Lane builds isolated diff packets, rollback plans, preflights, and hash ledger rows for PS2 products", async () => {
  await withTempLedger(async (ledgerDir) => {
    await appendPs2Product(ledgerDir, "product.candidate_lane_alpha");
    await appendPs2Product(ledgerDir, "product.candidate_lane_beta");
    await appendPs2Product(ledgerDir, "product.candidate_lane_gamma");

    const result = await buildFactoryCandidateLane({
      ledgerDir,
      runAt: RUN_AT,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.candidate_preview_available_count, 3);
    assert.equal(result.summary.candidate_packet_count, 3);
    assert.equal(result.summary.diff_packet_count, 3);
    assert.equal(result.summary.rollback_plan_count, 3);
    assert.equal(result.summary.preflight_count, 3);
    assert.equal(result.summary.hash_ledger_row_count, 3);
    assert.equal(result.factory_candidate_packet_rows.every((row) => row.candidate_packet_status === "candidate_packet_ready"), true);
    assert.equal(result.factory_candidate_packet_rows.every((row) => row.candidate_hash_bound_to_manifest === true), true);
    assert.equal(result.factory_candidate_packet_rows.every((row) => row.candidate_manifest_sha256_recomputed === row.candidate_manifest_sha256), true);
    assert.equal(result.factory_candidate_packet_rows.every((row) => row.isolated_workspace_plan.actual_isolation === "planned_git_worktree"), true);
    assert.equal(result.factory_candidate_packet_rows.every((row) => row.isolated_workspace_plan.worktree_created_now === false), true);
    assert.equal(result.factory_candidate_packet_rows.every((row) => row.patch_apply_enabled === false && row.apply_allowed_now === false), true);
    assert.equal(result.factory_candidate_diff_packet_rows.every((row) => row.diff_content.startsWith("diff --git ") && /^[a-f0-9]{64}$/.test(row.diff_sha256)), true);
    assert.equal(result.factory_candidate_diff_packet_rows.every((row) => /^index 0000000\.\.[a-f0-9]{7}$/m.test(row.diff_content)), true);
    assert.equal(result.factory_candidate_rollback_plan_rows.every((row) => row.rollback_plan_status === "draft_not_executable" && row.rollback_executed_now === false), true);
    assert.equal(result.factory_candidate_preflight_rows.every((row) => row.preflight_executed_now === true && row.preflight_status === "passed"), true);
    assert.equal(result.factory_candidate_hash_ledger_rows[0].prev_entry_hash, null);
    assert.equal(result.factory_candidate_hash_ledger_rows[1].prev_entry_hash, result.factory_candidate_hash_ledger_rows[0].entry_hash);
    assert.equal(result.factory_candidate_hash_ledger_rows[2].prev_entry_hash, result.factory_candidate_hash_ledger_rows[1].entry_hash);
  });
});

test("Factory Candidate Lane fails closed when the source workbench is blocked", async () => {
  await withTempLedger(async (ledgerDir) => {
    const templateRoot = await mkdtemp(path.join(os.tmpdir(), "factory-candidate-lane-empty-templates-"));
    try {
      await appendPs2Product(ledgerDir, "product.candidate_lane_missing_templates");

      const result = await buildFactoryCandidateLane({
        ledgerDir,
        templateRoot,
        runAt: RUN_AT,
      });

      assert.equal(result.validation.valid, false);
      assert.equal(result.summary.factory_candidate_lane_status, "blocked_factory_candidate_lane");
      assert.equal(result.summary.candidate_packet_count, 0);
      assert.equal(result.validation.errors.some((item) => item.item_id === "workbench.valid"), true);
      assert.equal(result.summary.patch_apply_enabled, false);
      assert.equal(result.summary.apply_allowed_now, false);
    } finally {
      await rm(templateRoot, { recursive: true, force: true });
    }
  });
});

test("Factory Candidate Lane rejects apply attempts with a blocked receipt payload", async () => {
  await assert.rejects(
    () => runFactoryCandidateLane({ apply: true, runAt: RUN_AT, write: false }),
    (error) => {
      assert.equal(error.message, "Factory Candidate Lane blocks apply attempts.");
      assert.equal(error.blocked_attempt.apply_attempted, true);
      assert.equal(error.blocked_attempt.patch_apply_enabled, false);
      assert.equal(error.blocked_attempt.apply_allowed_now, false);
      return true;
    },
  );
});

test("Review API exposes factory candidate lane rows as read-only packet data", async () => {
  await withTempLedger(async (ledgerDir) => {
    await appendPs2Product(ledgerDir, "product.candidate_lane_api_alpha");
    await appendPs2Product(ledgerDir, "product.candidate_lane_api_beta");
    await appendPs2Product(ledgerDir, "product.candidate_lane_api_gamma");

    const response = await buildReviewApiResponse("/api/factory/candidate-lane?limit=2", {
      factoryLedgerDir: ledgerDir,
      runAt: RUN_AT,
    });
    const body = parseJsonResponse(response);

    assert.equal(response.status, 200);
    assert.equal(body.collection, "factory_candidate_packet_rows");
    assert.equal(body.read_only, true);
    assert.equal(body.mutation_allowed, false);
    assert.equal(body.raw_confidential_material_visible, false);
    assert.equal(body.patch_apply_enabled, false);
    assert.equal(body.apply_allowed_now, false);
    assert.equal(body.count, 2);
    assert.equal(body.total_count, 3);
    assert.equal(body.candidate_packet_count, 3);
    assert.equal(body.factory_candidate_diff_packet_rows.length, 2);
    assert.equal(body.factory_candidate_rollback_plan_rows.length, 2);
    assert.equal(body.factory_candidate_preflight_rows.length, 2);
    assert.equal(body.factory_candidate_hash_ledger_rows.length, 2);
    assert.equal(body.factory_candidate_negative_fixture_rows.length, 3);
    assert.equal(body.factory_candidate_negative_fixture_rows.filter((row) => row.path_guard_executed_now === true).length, 2);
    assert.equal(body.factory_candidate_negative_fixture_rows.every((row) => row.fixture_status === "passed"), true);
    assert.equal(body.items.every((item) => item.apply_allowed_now === false), true);
  });
});

test("Review API supports HEAD and blocks mutating factory candidate lane requests", async () => {
  const headResponse = await buildReviewApiResponse("/api/factory/candidate-lane?limit=1", {
    method: "HEAD",
    runAt: RUN_AT,
  });
  assert.equal(headResponse.status, 200);
  assert.equal(headResponse.body, "");

  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await buildReviewApiResponse("/api/factory/candidate-lane", {
      method,
      runAt: RUN_AT,
    });
    const body = parseJsonResponse(response);

    assert.equal(response.status, 405);
    assert.equal(body.error, "method_not_allowed");
  }
});
