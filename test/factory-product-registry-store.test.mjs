import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  appendFactoryLedgerEntry,
  buildFactoryProductRegistryStore,
  computeFactoryPayloadHash,
  readFactoryLedgerFile,
  readFactoryProductScope,
  recoverFactoryLedgerFile,
  runFactoryProductRegistryStore,
} from "../src/factory-product-registry-store.mjs";

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

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    ...overrides,
  };
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

function transitionDraft(productId, suffix = productId.replace(/^product\./, "")) {
  return {
    schema_version: "product-state-transition.v1",
    transition_id: `transition.${suffix.replaceAll("-", "_")}.ps0_ps1`,
    product_id: productId,
    from_state: "PS0_seed",
    to_state: "PS1_schema_valid",
    receipt_id: `rcpt-${suffix.replaceAll(".", "-")}`,
    created_at: RUN_AT,
    authority_flags: AUTHORITY_CLOSED,
  };
}

function receiptDraft(productId, suffix = productId.replace(/^product\./, "")) {
  return {
    schema_version: "factory-receipt-envelope.v1",
    receipt_id: `rcpt-${suffix.replaceAll(".", "-")}`,
    receipt_kind: "schema_contract_readiness",
    issued_at: RUN_AT,
    issuer: {
      issuer_role: "codex_implementer",
      issuer_id: "codex",
      engine_resolved_model_id: null,
    },
    subject: {
      product_id: productId,
      artifact_id: `artifact.${suffix.replaceAll("-", "_")}`,
      scope_id: "FCORE-FA.2",
      reviewed_commit_sha: null,
    },
    authority_flags: AUTHORITY_CLOSED,
  };
}

async function withTempLedger(fn) {
  const ledgerDir = await mkdtemp(path.join(os.tmpdir(), "factory-product-registry-ledger-"));
  try {
    return await fn(ledgerDir);
  } finally {
    await rm(ledgerDir, { recursive: true, force: true });
  }
}

test("Factory Product Registry Store validates FA.2 append ledger contracts", async () => {
  const result = await buildFactoryProductRegistryStore(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "factory-product-registry-store.v1");
  assert.equal(result.summary.program_range, "FCORE-FA.2");
  assert.equal(result.summary.factory_product_registry_store_status, "ready_factory_product_registry_store_append_ledger");
  assert.equal(result.summary.append_jsonl_store_ready, true);
  assert.equal(result.summary.tracked_seed_root, "data/factory/seed/");
  assert.equal(result.summary.local_operational_ledger_root, "data/factory/local/");
  assert.equal(result.summary.local_operational_ledger_gitignored, true);
  assert.match(result.product_record_sample.payload_sha256, /^[a-f0-9]{64}$/);
  assert.match(result.product_record_sample.entry_hash, /^[a-f0-9]{64}$/);
  assert.equal(result.product_record_sample.schema_version, "product-record.v1");
  assert.equal(result.state_transition_sample.schema_version, "product-state-transition.v1");
  assert.equal(result.receipt_envelope_sample.schema_version, "factory-receipt-envelope.v1");
  assert.equal(result.summary.project_creation_allowed_now, false);
  assert.equal(result.summary.repo_write_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
});

test("Factory Product Registry Store appends and verifies products, transitions, and receipts", async () => {
  await withTempLedger(async (ledgerDir) => {
    const opts = ledgerOptions(ledgerDir);
    const product = await appendFactoryLedgerEntry("products", productDraft("product.alpha"), opts);
    const transition = await appendFactoryLedgerEntry("state_transitions", transitionDraft("product.alpha"), opts);
    const receipt = await appendFactoryLedgerEntry("receipts_index", receiptDraft("product.alpha"), opts);

    assert.equal(product.prev_entry_hash, null);
    assert.match(product.entry_hash, /^[a-f0-9]{64}$/);
    assert.match(transition.entry_hash, /^[a-f0-9]{64}$/);
    assert.match(receipt.entry_hash, /^[a-f0-9]{64}$/);

    const result = await buildFactoryProductRegistryStore(options({ ledgerDir }));
    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.ledger_total_entry_count, 3);
  });
});

test("Factory Product Registry Store rejects schema-invalid appends", async () => {
  await withTempLedger(async (ledgerDir) => {
    await assert.rejects(
      () => appendFactoryLedgerEntry("products", {
        schema_version: "product-record.v1",
        tenant_id: "tenant.local",
        workspace_id: "workspace.factory",
        domain_pack_ids: ["pack.personal_dev"],
        product_state: "PS0_seed",
        receipt_id: "rcpt-invalid-product",
        created_at: RUN_AT,
        updated_at: RUN_AT,
        authority_flags: AUTHORITY_CLOSED,
      }, ledgerOptions(ledgerDir)),
      /schema validation/,
    );
  });
});

test("Factory Product Registry Store rejects payload hash mismatch appends", async () => {
  await withTempLedger(async (ledgerDir) => {
    const draft = {
      ...productDraft("product.hash_mismatch", "hash-mismatch"),
      payload_sha256: "0".repeat(64),
    };

    assert.notEqual(draft.payload_sha256, computeFactoryPayloadHash(draft));
    await assert.rejects(
      () => appendFactoryLedgerEntry("products", draft, ledgerOptions(ledgerDir)),
      /payload_sha256/,
    );
  });
});

test("Factory Product Registry Store rejects append after existing row rewrite", async () => {
  await withTempLedger(async (ledgerDir) => {
    const opts = ledgerOptions(ledgerDir);
    await appendFactoryLedgerEntry("products", productDraft("product.rewrite_a", "rewrite-a"), opts);
    await appendFactoryLedgerEntry("products", productDraft("product.rewrite_b", "rewrite-b"), opts);

    const filePath = path.join(ledgerDir, "products.jsonl");
    const rows = (await readFile(filePath, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
    rows[0].product_state = "PS1_schema_valid";
    await writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");

    const ledger = await readFactoryLedgerFile("products", opts);
    assert.equal(ledger.validation.valid, false);
    await assert.rejects(
      () => appendFactoryLedgerEntry("products", productDraft("product.rewrite_c", "rewrite-c"), opts),
      /invalid products ledger/,
    );
  });
});

test("Factory Product Registry Store recovers a damaged ledger to the last valid prefix", async () => {
  await withTempLedger(async (ledgerDir) => {
    const opts = ledgerOptions(ledgerDir);
    await appendFactoryLedgerEntry("products", productDraft("product.recover_a", "recover-a"), opts);
    await appendFactoryLedgerEntry("products", productDraft("product.recover_b", "recover-b"), opts);

    const filePath = path.join(ledgerDir, "products.jsonl");
    const rows = (await readFile(filePath, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
    rows[1].updated_at = "2026-06-11T00:01:00.000Z";
    await writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");

    const damaged = await readFactoryLedgerFile("products", opts);
    assert.equal(damaged.validation.valid, false);
    assert.equal(damaged.valid_prefix_line_count, 1);

    const recovery = await recoverFactoryLedgerFile("products", opts);
    assert.equal(recovery.recovered, true);
    assert.equal(recovery.removed_line_count, 1);

    const recovered = await readFactoryLedgerFile("products", opts);
    assert.equal(recovered.validation.valid, true);
    assert.equal(recovered.entries.length, 1);

    const appended = await appendFactoryLedgerEntry("products", productDraft("product.recover_c", "recover-c"), opts);
    assert.equal(appended.prev_entry_hash, recovered.entries[0].entry_hash);
  });
});

test("Factory Product Registry Store serializes concurrent appends", async () => {
  await withTempLedger(async (ledgerDir) => {
    const opts = ledgerOptions(ledgerDir);
    await Promise.all(Array.from({ length: 5 }, (_, index) => (
      appendFactoryLedgerEntry("products", productDraft(`product.concurrent_${index}`, `concurrent-${index}`), opts)
    )));

    const ledger = await readFactoryLedgerFile("products", opts);
    assert.equal(ledger.validation.valid, true);
    assert.equal(ledger.entries.length, 5);
    for (let index = 1; index < ledger.entries.length; index += 1) {
      assert.equal(ledger.entries[index].prev_entry_hash, ledger.entries[index - 1].entry_hash);
    }
  });
});

test("Factory Product Registry Store requires product-scoped reads and rejects cross-scope reads", async () => {
  await withTempLedger(async (ledgerDir) => {
    const opts = ledgerOptions(ledgerDir);
    await appendFactoryLedgerEntry("products", productDraft("product.scope_a", "scope-a"), opts);
    await appendFactoryLedgerEntry("products", productDraft("product.scope_b", "scope-b"), opts);
    await appendFactoryLedgerEntry("state_transitions", transitionDraft("product.scope_a", "scope-a"), opts);
    await appendFactoryLedgerEntry("receipts_index", receiptDraft("product.scope_a", "scope-a"), opts);

    const scoped = await readFactoryProductScope({ ...opts, productId: "product.scope_a" });
    assert.deepEqual(scoped.products.map((row) => row.product_id), ["product.scope_a"]);
    assert.deepEqual(scoped.state_transitions.map((row) => row.product_id), ["product.scope_a"]);
    assert.deepEqual(scoped.receipts.map((row) => row.subject.product_id), ["product.scope_a"]);

    await assert.rejects(
      () => readFactoryProductScope({ ...opts, productId: "product.scope_b", scopeProductId: "product.scope_a" }),
      /outside/,
    );
    await assert.rejects(
      () => readFactoryProductScope({ ...opts }),
      /requires product_id/,
    );
  });
});

test("Factory Product Registry Store blocks ledger writes in --check mode", async () => {
  await withTempLedger(async (ledgerDir) => {
    await assert.rejects(
      () => appendFactoryLedgerEntry("products", productDraft("product.check_mode", "check-mode"), {
        ...ledgerOptions(ledgerDir),
        check: true,
        write: false,
      }),
      /no-write mode/,
    );
    const ledger = await readFactoryLedgerFile("products", ledgerOptions(ledgerDir));
    assert.equal(ledger.entries.length, 0);
  });
});

test("Factory Product Registry Store blocks when local ledger root is not gitignored", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "factory-product-registry-store-"));
  const gitignorePath = path.join(tempDir, ".gitignore");
  await writeFile(gitignorePath, "artifacts/\n", "utf8");

  try {
    const result = await buildFactoryProductRegistryStore(options({ gitignorePath }));
    assert.equal(result.validation.valid, false);
    assert.equal(result.summary.append_jsonl_store_ready, false);
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
    /append ledger is not ready/,
  );
});
