import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReviewApiResponse } from "../src/review-api.mjs";
import { writeFactorySeedMigration } from "../src/factory-product-registry-store.mjs";

const RUN_AT = "2026-06-11T00:00:00.000Z";
const AUTHORITY_FLAG_KEYS = [
  "project_creation_allowed_now",
  "repo_write_allowed_now",
  "connector_write_allowed_now",
  "deployment_allowed_now",
  "protected_action_allowed_now",
  "production_pass_enabled",
  "enterprise_pass_enabled",
];

async function withTempDir(prefix, fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function withTempDirs(prefixes, fn) {
  const dirs = [];
  try {
    for (const prefix of prefixes) dirs.push(await mkdtemp(path.join(os.tmpdir(), prefix)));
    return await fn(...dirs);
  } finally {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  }
}

function parseJsonResponse(response) {
  return JSON.parse(response.body);
}

test("Review API exposes tracked seed factory products as a read-only collection", async () => {
  await withTempDir("review-api-factory-products-empty-ledger-", async (ledgerDir) => {
    const response = await buildReviewApiResponse("/api/factory/products?limit=20", {
      factoryLedgerDir: ledgerDir,
      runAt: RUN_AT,
    });
    const body = parseJsonResponse(response);

    assert.equal(response.status, 200);
    assert.equal(body.schema_version, "review-api-collection.v1");
    assert.equal(body.collection, "factory_products");
    assert.equal(body.source_tier, "tracked_seed");
    assert.equal(body.count, 9);
    assert.equal(body.total_count, 9);
    assert.equal(body.read_only, true);
    assert.equal(body.mutation_allowed, false);
    assert.equal(body.raw_confidential_material_visible, false);
    assert.equal(body.method_allowlist.includes("GET"), true);
    assert.equal(body.method_allowlist.includes("HEAD"), true);
    assert.equal(body.items.every((item) => item.source_tier === "tracked_seed"), true);
    assert.equal(body.items.some((item) => Object.hasOwn(item, "raw_confidential_material_included")), false);
    assert.deepEqual(Object.keys(body.items[0].authority_flags).sort(), AUTHORITY_FLAG_KEYS.toSorted());
  });
});

test("Review API filters factory product rows by product_id", async () => {
  await withTempDir("review-api-factory-products-empty-ledger-", async (ledgerDir) => {
    const response = await buildReviewApiResponse("/api/factory/products?product_id=product.fixture_hermes", {
      factoryLedgerDir: ledgerDir,
      runAt: RUN_AT,
    });
    const body = parseJsonResponse(response);

    assert.equal(response.status, 200);
    assert.equal(body.count, 1);
    assert.equal(body.items[0].product_id, "product.fixture_hermes");
    assert.equal(body.items[0].source_tier, "tracked_seed");
  });
});

test("Review API blocks mutating methods for factory products", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await buildReviewApiResponse("/api/factory/products", {
      method,
      runAt: RUN_AT,
    });
    const body = parseJsonResponse(response);

    assert.equal(response.status, 405);
    assert.equal(body.error, "method_not_allowed");
  }
});

test("Review API allows HEAD for factory products without a response body", async () => {
  await withTempDir("review-api-factory-products-empty-ledger-", async (ledgerDir) => {
    const response = await buildReviewApiResponse("/api/factory/products", {
      factoryLedgerDir: ledgerDir,
      method: "HEAD",
      runAt: RUN_AT,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body, "");
  });
});

test("Review API prefers operational factory products over tracked seed", async () => {
  await withTempDir("review-api-factory-products-ledger-", async (ledgerDir) => {
    await writeFactorySeedMigration({
      seedDir: ledgerDir,
      allowTestSeedRoot: true,
      runAt: RUN_AT,
    });

    const response = await buildReviewApiResponse("/api/factory/products?limit=20", {
      factoryLedgerDir: ledgerDir,
      runAt: RUN_AT,
    });
    const body = parseJsonResponse(response);

    assert.equal(response.status, 200);
    assert.equal(body.source_tier, "operational_ledger");
    assert.equal(body.count, 9);
    assert.equal(body.items.every((item) => item.source_tier === "operational_ledger"), true);
  });
});

test("Review API fails closed when no factory product store is available", async () => {
  await withTempDirs([
    "review-api-factory-products-empty-ledger-",
    "review-api-factory-products-empty-seed-",
  ], async (ledgerDir, seedDir) => {
    const response = await buildReviewApiResponse("/api/factory/products", {
      factoryLedgerDir: ledgerDir,
      factorySeedDir: seedDir,
      runAt: RUN_AT,
    });
    const body = parseJsonResponse(response);

    assert.equal(response.status, 503);
    assert.equal(body.error, "factory_products_unavailable");
    assert.match(body.message, /Factory product store is empty/);
  });
});

test("Review API fails closed when the operational product ledger is invalid", async () => {
  await withTempDir("review-api-factory-products-invalid-ledger-", async (ledgerDir) => {
    await writeFile(path.join(ledgerDir, "products.jsonl"), "{not-json}\n", "utf8");

    const response = await buildReviewApiResponse("/api/factory/products", {
      factoryLedgerDir: ledgerDir,
      runAt: RUN_AT,
    });
    const body = parseJsonResponse(response);

    assert.equal(response.status, 503);
    assert.equal(body.error, "factory_products_unavailable");
    assert.match(body.message, /Operational factory product ledger is invalid/);
  });
});
