import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReviewApiResponse } from "../src/review-api.mjs";
import { buildFactoryCandidateManifestResolver } from "../src/factory-candidate-manifest-resolver.mjs";
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
  const ledgerDir = await mkdtemp(path.join(os.tmpdir(), "factory-candidate-ledger-"));
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

async function appendPs2Product(ledgerDir, productId = "product.candidate_alpha", overrides = {}) {
  const opts = ledgerOptions(ledgerDir);
  await appendFactoryLedgerEntry("products", { ...productDraft(productId, productId.replace(/^product\./, "")), ...overrides.product }, opts);
  await appendFactoryLedgerEntry("state_transitions", { ...transitionDraft(productId, "PS0_seed", "PS1_schema_valid", "ps0_ps1"), ...overrides.ps1 }, opts);
  await appendFactoryLedgerEntry("state_transitions", { ...transitionDraft(productId, "PS1_schema_valid", "PS2_receipt_bound", "ps1_ps2"), ...overrides.ps2 }, opts);
}

test("Factory Candidate Manifest Resolver projects tracked seed products as blocked JSON-only rows", async () => {
  await withTempLedger(async (ledgerDir) => {
    const result = await buildFactoryCandidateManifestResolver({
      ledgerDir,
      runAt: RUN_AT,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.factory_candidate_manifest_resolver_status, "ready_factory_candidate_manifest_resolver");
    assert.equal(result.summary.product_count, 9);
    assert.equal(result.summary.candidate_manifest_count, 0);
    assert.equal(result.summary.candidate_manifest_json_available_count, 0);
    assert.equal(result.summary.resolver_status_counts.blocked_until_ps2_receipt_bound, 9);
    assert.equal(result.summary.json_only_manifest_generation, true);
    assert.equal(result.summary.starter_artifact_corpus_materialized_now, true);
    assert.equal(result.summary.starter_artifact_missing_count, 0);
    assert.equal(result.summary.candidate_manifest_write_allowed_now, false);
    assert.equal(result.summary.apply_allowed_now, false);
    assert.equal(result.candidate_manifest_resolver_rows.every((row) => row.candidate_manifest_json_available === false), true);
    assert.equal(result.candidate_manifest_resolver_rows.every((row) => row.source_file_write_allowed_now === false), true);
    assert.equal(result.candidate_manifest_resolver_rows.every((row) => row.planned_artifact_refs.every((ref) => ref.exists_now === true && /^[a-f0-9]{64}$/.test(ref.content_sha256))), true);
  });
});

test("Factory Candidate Manifest Resolver creates one JSON-only manifest for a fresh PS2 product", async () => {
  await withTempLedger(async (ledgerDir) => {
    await appendPs2Product(ledgerDir);

    const result = await buildFactoryCandidateManifestResolver({
      ledgerDir,
      runAt: RUN_AT,
    });
    const row = result.candidate_manifest_resolver_rows[0];
    const manifest = result.candidate_manifests[0];

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.product_count, 1);
    assert.equal(result.summary.candidate_manifest_count, 1);
    assert.equal(row.resolver_status, "candidate_manifest_json_ready");
    assert.equal(row.candidate_manifest_json_available, true);
    assert.equal(row.candidate_manifest_write_allowed_now, false);
    assert.equal(row.apply_allowed_now, false);
    assert.equal(row.apply_blocker_ids.includes("fb4_starter_artifact_corpus_not_ready"), false);
    assert.equal(row.starter_artifact_corpus_status, "materialized_read_only");
    assert.equal(manifest.product_id, "product.candidate_alpha");
    assert.equal(manifest.candidate_manifest_kind, "json_only_preview");
    assert.match(manifest.candidate_manifest_sha256, /^[a-f0-9]{64}$/);
    assert.equal(manifest.resolver.fb4_starter_artifact_corpus_required, true);
    assert.equal(manifest.resolver.starter_artifact_corpus_materialized_now, true);
    assert.equal(manifest.planned_artifact_refs.length, 2);
    assert.equal(manifest.planned_artifact_refs.every((ref) => ref.exists_now === true && /^[a-f0-9]{64}$/.test(ref.content_sha256)), true);
    assert.equal(manifest.source_file_write_allowed_now, false);
    assert.equal(manifest.ledger_append_allowed_now, false);
    assert.equal(manifest.apply_allowed_now, false);
  });
});

test("Factory Candidate Manifest Resolver refuses instantiation when starter artifacts are missing", async () => {
  await withTempLedger(async (ledgerDir) => {
    const templateRoot = await mkdtemp(path.join(os.tmpdir(), "factory-missing-templates-"));
    try {
      await appendPs2Product(ledgerDir, "product.candidate_missing_templates");

      const result = await buildFactoryCandidateManifestResolver({
        ledgerDir,
        templateRoot,
        runAt: RUN_AT,
      });
      const row = result.candidate_manifest_resolver_rows[0];

      assert.equal(result.validation.valid, false);
      assert.equal(result.summary.factory_candidate_manifest_resolver_status, "blocked_factory_candidate_manifest_resolver");
      assert.equal(result.summary.candidate_manifest_count, 0);
      assert.equal(result.summary.starter_artifact_corpus_materialized_now, false);
      assert.equal(row.resolver_status, "blocked_missing_starter_artifact_corpus");
      assert.deepEqual(row.blocked_reason_ids, ["starter_artifact_corpus_missing"]);
      assert.equal(row.candidate_manifest_id, null);
    } finally {
      await rm(templateRoot, { recursive: true, force: true });
    }
  });
});

test("Factory Candidate Manifest Resolver blocks stale PS2 products from JSON manifest availability", async () => {
  await withTempLedger(async (ledgerDir) => {
    const old = "2026-05-01T00:00:00.000Z";
    await appendPs2Product(ledgerDir, "product.candidate_stale", {
      product: { created_at: old, updated_at: old },
      ps1: { created_at: old },
      ps2: { created_at: old },
    });

    const result = await buildFactoryCandidateManifestResolver({
      ledgerDir,
      runAt: RUN_AT,
    });
    const row = result.candidate_manifest_resolver_rows[0];

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.candidate_manifest_count, 0);
    assert.equal(row.current_product_state, "PS2_receipt_bound");
    assert.equal(row.freshness_status, "stale");
    assert.equal(row.resolver_status, "blocked_stale_source");
    assert.deepEqual(row.blocked_reason_ids, ["source_freshness_window_exceeded"]);
    assert.equal(row.candidate_manifest_id, null);
  });
});

test("Factory Candidate Manifest Resolver fails closed when the stage read model is invalid", async () => {
  await withTempLedger(async (ledgerDir) => {
    const opts = ledgerOptions(ledgerDir);
    await appendFactoryLedgerEntry("products", productDraft("product.candidate_ps3", "candidate-ps3"), opts);
    await appendFactoryLedgerEntry("state_transitions", transitionDraft("product.candidate_ps3", "PS2_receipt_bound", "PS3_candidate_ready", "ps2_ps3"), opts);

    const result = await buildFactoryCandidateManifestResolver({
      ledgerDir,
      runAt: RUN_AT,
    });

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.factory_candidate_manifest_resolver_status, "blocked_factory_candidate_manifest_resolver");
    assert.equal(result.validation.errors.some((item) => item.item_id === "stage.valid"), true);
  });
});

test("Factory Candidate Manifest Resolver exposes PS3 transition block reasons before FB promotion", async () => {
  await withTempLedger(async (ledgerDir) => {
    const opts = ledgerOptions(ledgerDir);
    await appendFactoryLedgerEntry("products", productDraft("product.candidate_ps3", "candidate-ps3"), opts);
    await appendFactoryLedgerEntry("state_transitions", transitionDraft("product.candidate_ps3", "PS0_seed", "PS1_schema_valid", "ps0_ps1"), opts);
    await appendFactoryLedgerEntry("state_transitions", transitionDraft("product.candidate_ps3", "PS1_schema_valid", "PS2_receipt_bound", "ps1_ps2"), opts);
    await appendFactoryLedgerEntry("state_transitions", transitionDraft("product.candidate_ps3", "PS2_receipt_bound", "PS3_candidate_ready", "ps2_ps3"), opts);

    const result = await buildFactoryCandidateManifestResolver({
      ledgerDir,
      runAt: RUN_AT,
    });
    const row = result.candidate_manifest_resolver_rows[0];

    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.factory_candidate_manifest_resolver_status, "blocked_factory_candidate_manifest_resolver");
    assert.equal(row.current_product_state, "PS3_candidate_ready");
    assert.equal(row.resolver_status, "blocked_ps3_before_fb_promotion");
    assert.deepEqual(row.blocked_reason_ids, ["ps3_transition_before_fb_promotion"]);
    assert.equal(row.candidate_manifest_id, null);
    assert.equal(row.candidate_manifest_json_available, false);
  });
});

test("Factory Candidate Manifest Resolver distinguishes unmapped starter artifact refs", async () => {
  await withTempLedger(async (ledgerDir) => {
    await appendPs2Product(ledgerDir, "product.candidate_unmapped_refs", {
      product: { domain_pack_ids: ["pack.unmapped"] },
    });

    const result = await buildFactoryCandidateManifestResolver({
      ledgerDir,
      runAt: RUN_AT,
    });
    const row = result.candidate_manifest_resolver_rows[0];

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.candidate_manifest_count, 0);
    assert.equal(row.resolver_status, "blocked_missing_starter_artifact_corpus");
    assert.deepEqual(row.blocked_reason_ids, ["starter_artifact_refs_unmapped"]);
    assert.equal(row.starter_artifact_corpus_status, "missing_required_ref_mapping");
    assert.deepEqual(row.planned_artifact_refs, []);
    assert.equal(row.candidate_manifest_id, null);
  });
});

test("Review API exposes candidate manifest resolver rows as read-only JSON-only data", async () => {
  await withTempLedger(async (ledgerDir) => {
    await appendPs2Product(ledgerDir, "product.candidate_api");

    const response = await buildReviewApiResponse("/api/factory/candidate-manifests?product_id=product.candidate_api&candidate_manifest_json_available=true", {
      factoryLedgerDir: ledgerDir,
      runAt: RUN_AT,
    });
    const body = parseJsonResponse(response);

    assert.equal(response.status, 200);
    assert.equal(body.collection, "factory_candidate_manifest_rows");
    assert.equal(body.read_only, true);
    assert.equal(body.mutation_allowed, false);
    assert.equal(body.raw_confidential_material_visible, false);
    assert.equal(body.json_only_manifest_generation, true);
    assert.equal(body.starter_artifact_corpus_materialized_now, true);
    assert.equal(body.count, 1);
    assert.equal(body.visible_candidate_manifest_count, 1);
    assert.equal(body.candidate_manifest_count, 1);
    assert.equal(body.candidate_manifests.length, 1);
    assert.equal(body.items[0].candidate_manifest_json_available, true);
    assert.equal(body.items[0].starter_artifact_corpus_status, "materialized_read_only");
    assert.equal(body.items[0].candidate_manifest_write_allowed_now, false);
    assert.equal(body.items[0].apply_allowed_now, false);
  });
});

test("Review API supports HEAD for candidate manifests without a response body", async () => {
  await withTempLedger(async (ledgerDir) => {
    const response = await buildReviewApiResponse("/api/factory/candidate-manifests?limit=1", {
      factoryLedgerDir: ledgerDir,
      method: "HEAD",
      runAt: RUN_AT,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body, "");
  });
});

test("Review API rejects mutating candidate manifest requests", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await buildReviewApiResponse("/api/factory/candidate-manifests", {
      method,
      runAt: RUN_AT,
    });
    const body = parseJsonResponse(response);

    assert.equal(response.status, 405);
    assert.equal(body.error, "method_not_allowed");
  }
});
