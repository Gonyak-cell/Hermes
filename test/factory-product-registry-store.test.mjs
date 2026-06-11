import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFactoryProductRegistryStore,
  runFactoryProductRegistryStore,
} from "../src/factory-product-registry-store.mjs";

const RUN_AT = "2026-06-11T00:00:00.000Z";

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    ...overrides,
  };
}

test("Factory Product Registry Store validates FA.1 schema contracts", async () => {
  const result = await buildFactoryProductRegistryStore(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "factory-product-registry-store.v1");
  assert.equal(result.summary.factory_product_registry_store_status, "ready_factory_product_registry_store_schema_contracts");
  assert.equal(result.summary.schema_contracts_ready, true);
  assert.equal(result.summary.tracked_seed_root, "data/factory/seed/");
  assert.equal(result.summary.local_operational_ledger_root, "data/factory/local/");
  assert.equal(result.summary.local_operational_ledger_gitignored, true);
  assert.equal(result.product_record_sample.schema_version, "product-record.v1");
  assert.equal(result.state_transition_sample.schema_version, "product-state-transition.v1");
  assert.equal(result.receipt_envelope_sample.schema_version, "factory-receipt-envelope.v1");
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.equal(result.summary.repo_write_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
});

test("Factory Product Registry Store blocks when local ledger root is not gitignored", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "factory-product-registry-store-"));
  const gitignorePath = path.join(tempDir, ".gitignore");
  await writeFile(gitignorePath, "artifacts/\n", "utf8");

  try {
    const result = await buildFactoryProductRegistryStore(options({ gitignorePath }));
    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.schema_contracts_ready, false);
    assert.equal(result.validation.errors.some((error) => error.item_id === "gitignore.local_ledger"), true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("Factory Product Registry Store --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-product-registry-store-"));
  const sentinelPath = path.join(outDir, "factory-product-registry-store.json");
  const sentinel = "{ \"sentinel\": \"factory-product-registry-store\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runFactoryProductRegistryStore(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Factory Product Registry Store --require-pass rejects missing documentation", async () => {
  await assert.rejects(
    () => runFactoryProductRegistryStore(options({
      requirePass: true,
      stateStoreDocPath: "docs/missing-factory-state-store.md",
    })),
    /schema contracts are not ready/,
  );
});
