import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReviewApiResponse } from "../src/review-api.mjs";
import { buildFactoryWorkbenchReadModel } from "../src/factory-workbench-read-model.mjs";
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
  const ledgerDir = await mkdtemp(path.join(os.tmpdir(), "factory-workbench-ledger-"));
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

async function appendPs2Product(ledgerDir, productId = "product.workbench_candidate") {
  const opts = ledgerOptions(ledgerDir);
  await appendFactoryLedgerEntry("products", productDraft(productId), opts);
  await appendFactoryLedgerEntry("state_transitions", transitionDraft(productId, "PS0_seed", "PS1_schema_valid", "ps0_ps1"), opts);
  await appendFactoryLedgerEntry("state_transitions", transitionDraft(productId, "PS1_schema_valid", "PS2_receipt_bound", "ps1_ps2"), opts);
}

test("Factory Workbench Read Model projects tracked seed products as read-only stage rows", async () => {
  const result = await buildFactoryWorkbenchReadModel({ runAt: RUN_AT });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_workbench_read_model_status, "ready_factory_workbench_read_model");
  assert.equal(result.summary.product_count, 9);
  assert.equal(result.summary.workbench_row_count, 9);
  assert.equal(result.summary.candidate_preview_available_count, 0);
  assert.equal(result.summary.apply_allowed_now, false);
  assert.equal(result.summary.raw_confidential_material_visible, false);
  assert.equal(result.factory_workbench_rows.every((row) => row.workbench_view_status === "stage_status_visible"), true);
  assert.equal(result.factory_workbench_rows.every((row) => row.allowed_affordances.every((item) => item.startsWith("view_"))), true);
  assert.equal(result.factory_workbench_rows.every((row) => row.forbidden_affordances.includes("apply_candidate")), true);
  assert.equal(result.factory_workbench_rows.every((row) => row.apply_allowed_now === false), true);
});

test("Factory Workbench Read Model exposes a PS2 candidate preview without opening write affordances", async () => {
  await withTempLedger(async (ledgerDir) => {
    await appendPs2Product(ledgerDir);

    const result = await buildFactoryWorkbenchReadModel({
      ledgerDir,
      runAt: RUN_AT,
    });
    const row = result.factory_workbench_rows[0];

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.product_count, 1);
    assert.equal(result.summary.candidate_preview_available_count, 1);
    assert.equal(row.workbench_view_status, "candidate_preview_ready");
    assert.equal(row.workbench_queue_status, "ready_for_human_review");
    assert.equal(row.candidate_manifest_json_available, true);
    assert.match(row.candidate_manifest_sha256, /^[a-f0-9]{64}$/);
    assert.equal(row.candidate_manifest_preview.product_id, "product.workbench_candidate");
    assert.equal(row.allowed_affordances.includes("view_candidate_manifest_json"), true);
    assert.equal(row.allowed_affordances.includes("apply_candidate"), false);
    assert.equal(row.forbidden_affordances.includes("apply_candidate"), true);
    assert.equal(row.source_file_write_allowed_now, false);
    assert.equal(row.ledger_append_allowed_now, false);
    assert.equal(row.candidate_manifest_write_allowed_now, false);
    assert.equal(row.apply_allowed_now, false);
  });
});

test("Factory Workbench Read Model fails closed when the candidate resolver is blocked", async () => {
  await withTempLedger(async (ledgerDir) => {
    const templateRoot = await mkdtemp(path.join(os.tmpdir(), "factory-workbench-empty-templates-"));
    try {
      await appendPs2Product(ledgerDir, "product.workbench_missing_templates");

      const result = await buildFactoryWorkbenchReadModel({
        ledgerDir,
        templateRoot,
        runAt: RUN_AT,
      });

      assert.equal(result.validation.valid, false);
      assert.equal(result.summary.factory_workbench_read_model_status, "blocked_factory_workbench_read_model");
      assert.equal(result.summary.candidate_preview_available_count, 0);
      assert.equal(result.validation.errors.some((item) => item.item_id === "candidate_resolver.valid"), true);
      assert.equal(result.summary.apply_allowed_now, false);
    } finally {
      await rm(templateRoot, { recursive: true, force: true });
    }
  });
});

test("Review API exposes factory workbench rows as read-only integrated data", async () => {
  await withTempLedger(async (ledgerDir) => {
    await appendPs2Product(ledgerDir, "product.workbench_api");

    const response = await buildReviewApiResponse("/api/factory/workbench?product_id=product.workbench_api&candidate_manifest_json_available=true", {
      factoryLedgerDir: ledgerDir,
      runAt: RUN_AT,
    });
    const body = parseJsonResponse(response);

    assert.equal(response.status, 200);
    assert.equal(body.collection, "factory_workbench_rows");
    assert.equal(body.read_only, true);
    assert.equal(body.mutation_allowed, false);
    assert.equal(body.raw_confidential_material_visible, false);
    assert.equal(body.count, 1);
    assert.equal(body.candidate_preview_available_count, 1);
    assert.equal(body.items[0].workbench_view_status, "candidate_preview_ready");
    assert.equal(body.items[0].apply_allowed_now, false);
    assert.equal(body.items[0].allowed_affordances.includes("view_candidate_manifest_json"), true);
    assert.equal(body.candidate_manifests.length, 1);
  });
});

test("Review API supports HEAD for factory workbench without a response body", async () => {
  const response = await buildReviewApiResponse("/api/factory/workbench?limit=1", {
    method: "HEAD",
    runAt: RUN_AT,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body, "");
});

test("Review API rejects mutating factory workbench requests", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await buildReviewApiResponse("/api/factory/workbench", {
      method,
      runAt: RUN_AT,
    });
    const body = parseJsonResponse(response);

    assert.equal(response.status, 405);
    assert.equal(body.error, "method_not_allowed");
  }
});
