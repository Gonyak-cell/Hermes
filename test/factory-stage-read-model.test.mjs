import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReviewApiResponse } from "../src/review-api.mjs";
import { buildFactoryStageReadModel } from "../src/factory-stage-read-model.mjs";
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

async function withTempLedger(fn) {
  const ledgerDir = await mkdtemp(path.join(os.tmpdir(), "factory-stage-ledger-"));
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

function parseJsonResponse(response) {
  return JSON.parse(response.body);
}

test("Factory Stage Read Model projects tracked seed products as PS0 stage rows", async () => {
  await withTempLedger(async (ledgerDir) => {
    const result = await buildFactoryStageReadModel({
      ledgerDir,
      runAt: RUN_AT,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.factory_stage_read_model_status, "ready_factory_stage_read_model");
    assert.equal(result.summary.product_source_tier, "tracked_seed");
    assert.equal(result.summary.product_count, 9);
    assert.equal(result.summary.state_counts.PS0_seed, 9);
    assert.equal(result.summary.ps3_transition_append_allowed_now, false);
    assert.equal(result.summary.candidate_manifest_write_allowed_now, false);
    assert.equal(result.summary.apply_allowed_now, false);
    assert.equal(result.factory_stage_rows.every((row) => row.current_product_state === "PS0_seed"), true);
  });
});

test("Factory Stage Read Model computes current state from operational transitions", async () => {
  await withTempLedger(async (ledgerDir) => {
    const opts = ledgerOptions(ledgerDir);
    await appendFactoryLedgerEntry("products", productDraft("product.stage_alpha", "stage-alpha"), opts);
    await appendFactoryLedgerEntry("state_transitions", transitionDraft("product.stage_alpha", "PS0_seed", "PS1_schema_valid", "ps0_ps1"), opts);
    await appendFactoryLedgerEntry("state_transitions", transitionDraft("product.stage_alpha", "PS1_schema_valid", "PS2_receipt_bound", "ps1_ps2"), opts);

    const result = await buildFactoryStageReadModel({
      ledgerDir,
      runAt: RUN_AT,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.product_source_tier, "operational_ledger");
    assert.equal(result.summary.transition_count, 2);
    assert.equal(result.factory_stage_rows[0].product_id, "product.stage_alpha");
    assert.equal(result.factory_stage_rows[0].current_product_state, "PS2_receipt_bound");
    assert.equal(result.factory_stage_rows[0].latest_transition_id, "transition.stage_alpha.ps1_ps2");
  });
});

test("Factory Stage Read Model selects latest transition by timestamp", async () => {
  await withTempLedger(async (ledgerDir) => {
    const opts = ledgerOptions(ledgerDir);
    await appendFactoryLedgerEntry("products", productDraft("product.stage_order", "stage-order"), opts);
    await appendFactoryLedgerEntry("state_transitions", {
      ...transitionDraft("product.stage_order", "PS1_schema_valid", "PS2_receipt_bound", "later_ps2"),
      created_at: "2026-06-11T00:02:00.000Z",
    }, opts);
    await appendFactoryLedgerEntry("state_transitions", {
      ...transitionDraft("product.stage_order", "PS0_seed", "PS1_schema_valid", "earlier_ps1"),
      created_at: "2026-06-11T00:01:00.000Z",
    }, opts);

    const result = await buildFactoryStageReadModel({
      ledgerDir,
      runAt: RUN_AT,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.factory_stage_rows[0].current_product_state, "PS2_receipt_bound");
    assert.equal(result.factory_stage_rows[0].latest_transition_id, "transition.stage_order.later_ps2");
  });
});

test("Factory Stage Read Model blocks PS3 or later transition rows before FB promotion", async () => {
  await withTempLedger(async (ledgerDir) => {
    const opts = ledgerOptions(ledgerDir);
    await appendFactoryLedgerEntry("products", productDraft("product.stage_ps3", "stage-ps3"), opts);
    await appendFactoryLedgerEntry("state_transitions", transitionDraft("product.stage_ps3", "PS2_receipt_bound", "PS3_candidate_ready", "ps2_ps3"), opts);

    const result = await buildFactoryStageReadModel({
      ledgerDir,
      runAt: RUN_AT,
    });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.factory_stage_read_model_status, "blocked_factory_stage_read_model");
    assert.equal(result.factory_stage_rows[0].ps3_or_later_transition_present, true);
    assert.equal(result.validation.errors.some((item) => item.item_id === "stage.no_ps3_transition_present"), true);
  });
});

test("Review API exposes factory stage rows as a read-only collection", async () => {
  await withTempLedger(async (ledgerDir) => {
    const response = await buildReviewApiResponse("/api/factory/stage?product_id=product.fixture_hermes", {
      factoryLedgerDir: ledgerDir,
      runAt: RUN_AT,
    });
    const body = parseJsonResponse(response);

    assert.equal(response.status, 200);
    assert.equal(body.collection, "factory_stage_rows");
    assert.equal(body.read_only, true);
    assert.equal(body.mutation_allowed, false);
    assert.equal(body.raw_confidential_material_visible, false);
    assert.equal(body.count, 1);
    assert.equal(body.items[0].product_id, "product.fixture_hermes");
    assert.equal(body.items[0].current_product_state, "PS0_seed");
  });
});

test("Review API supports HEAD for factory stage without a response body", async () => {
  await withTempLedger(async (ledgerDir) => {
    const response = await buildReviewApiResponse("/api/factory/stage?limit=1", {
      factoryLedgerDir: ledgerDir,
      method: "HEAD",
      runAt: RUN_AT,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body, "");
  });
});

test("Review API filters factory stage rows by documented filter keys", async () => {
  await withTempLedger(async (ledgerDir) => {
    const response = await buildReviewApiResponse("/api/factory/stage?current_product_state=PS0_seed&base_product_state=PS0_seed&product_source_tier=tracked_seed&limit=3", {
      factoryLedgerDir: ledgerDir,
      runAt: RUN_AT,
    });
    const body = parseJsonResponse(response);

    assert.equal(response.status, 200);
    assert.equal(body.count, 3);
    assert.equal(body.total_count, 9);
    assert.equal(body.items.every((row) => row.current_product_state === "PS0_seed"), true);
    assert.equal(body.items.every((row) => row.base_product_state === "PS0_seed"), true);
    assert.equal(body.items.every((row) => row.product_source_tier === "tracked_seed"), true);
  });
});

test("Review API fails closed when factory stage read model is invalid", async () => {
  await withTempLedger(async (ledgerDir) => {
    const opts = ledgerOptions(ledgerDir);
    await appendFactoryLedgerEntry("products", productDraft("product.stage_ps3_api", "stage-ps3-api"), opts);
    await appendFactoryLedgerEntry("state_transitions", transitionDraft("product.stage_ps3_api", "PS2_receipt_bound", "PS3_candidate_ready", "ps2_ps3_api"), opts);

    const response = await buildReviewApiResponse("/api/factory/stage", {
      factoryLedgerDir: ledgerDir,
      runAt: RUN_AT,
    });
    const body = parseJsonResponse(response);

    assert.equal(response.status, 503);
    assert.equal(body.error, "factory_stage_unavailable");
  });
});

test("Review API rejects mutating factory stage requests", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await buildReviewApiResponse("/api/factory/stage", {
      method,
      runAt: RUN_AT,
    });
    const body = parseJsonResponse(response);

    assert.equal(response.status, 405);
    assert.equal(body.error, "method_not_allowed");
  }
});
