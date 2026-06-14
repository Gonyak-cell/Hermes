import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFactoryReceiptAuthoritySchemaFreeze,
  runFactoryReceiptAuthoritySchemaFreeze,
} from "../src/factory-receipt-authority-schema-freeze.mjs";

const RUN_AT = "2026-06-12T09:00:00.000Z";

test("Factory Receipt Authority Schema Freeze locks all receipt authority flags false", async () => {
  const result = await buildFactoryReceiptAuthoritySchemaFreeze({
    runAt: RUN_AT,
    write: false,
    commitRef: "fd6fec6",
  });

  assert.equal(result.schema_version, "factory-receipt-authority-schema-freeze.v1");
  assert.equal(result.program_range, "FCORE-FD.3");
  assert.equal(result.source_program_range, "FCORE-FD.1-FD.2");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_receipt_authority_schema_freeze_status, "ready_factory_receipt_authority_schema_freeze");
  assert.equal(result.summary.authority_schema_flag_count, 15);
  assert.equal(result.summary.authority_schema_frozen_count, 15);
  assert.equal(result.summary.runtime_schema_field_count, 4);
  assert.equal(result.summary.runtime_schema_frozen_count, 4);
  assert.equal(result.summary.positive_fixture_passed_count, result.summary.positive_fixture_count);
  assert.equal(result.summary.negative_fixture_count, 12);
  assert.equal(result.summary.negative_fixture_blocked_count, 12);
  assert.equal(result.summary.schema_blocks_missing_apply_allowed_flag, true);
  assert.equal(result.summary.schema_blocks_apply_allowed_true, true);
  assert.equal(result.summary.schema_blocks_source_file_write_true, true);
  assert.equal(result.summary.schema_blocks_ledger_append_true, true);
  assert.equal(result.summary.schema_blocks_rollback_runtime_true, true);
  assert.equal(result.summary.schema_blocks_deployment_allowed_true, true);
  assert.equal(result.summary.schema_blocks_protected_action_allowed_true, true);
  assert.equal(result.summary.schema_blocks_production_pass_enabled_true, true);
  assert.equal(result.summary.schema_blocks_enterprise_pass_enabled_true, true);
  assert.equal(result.summary.schema_blocks_unexpected_authority_flag_true, true);
  assert.equal(result.summary.schema_blocks_fd_receipt_verify_apply_runtime_true, true);
  assert.equal(result.summary.schema_blocks_fd_receipt_verify_unexpected_runtime_flag_true, true);
  assert.equal(result.summary.receipt_apply_engine_reachable_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
});

test("Factory Receipt Authority Schema Freeze exposes concrete schema error paths for negative fixtures", async () => {
  const result = await buildFactoryReceiptAuthoritySchemaFreeze({
    runAt: RUN_AT,
    write: false,
    commitRef: "fd6fec6",
  });
  const fixtures = new Map(result.factory_receipt_schema_negative_fixture_rows.map((row) => [row.fixture_key, row]));

  assert.equal(fixtures.get("missing_apply_allowed_flag").actual_result, "schema_blocked");
  assert.equal(fixtures.get("missing_apply_allowed_flag").schema_error_paths.some((item) => item.includes("authority_flags")), true);
  assert.equal(fixtures.get("apply_allowed_true").schema_error_paths.some((item) => item.endsWith(".authority_flags.apply_allowed_now")), true);
  assert.equal(fixtures.get("source_file_write_allowed_true").schema_error_paths.some((item) => item.endsWith(".authority_flags.source_file_write_allowed_now")), true);
  assert.equal(fixtures.get("ledger_append_allowed_true").schema_error_paths.some((item) => item.endsWith(".authority_flags.ledger_append_allowed_now")), true);
  assert.equal(fixtures.get("rollback_executor_runtime_enabled_true").schema_error_paths.some((item) => item.endsWith(".authority_flags.rollback_executor_runtime_enabled_now")), true);
  assert.equal(fixtures.get("deployment_allowed_true").schema_error_paths.some((item) => item.endsWith(".authority_flags.deployment_allowed_now")), true);
  assert.equal(fixtures.get("protected_action_allowed_true").schema_error_paths.some((item) => item.endsWith(".authority_flags.protected_action_allowed_now")), true);
  assert.equal(fixtures.get("production_pass_enabled_true").schema_error_paths.some((item) => item.endsWith(".authority_flags.production_pass_enabled")), true);
  assert.equal(fixtures.get("enterprise_pass_enabled_true").schema_error_paths.some((item) => item.endsWith(".authority_flags.enterprise_pass_enabled")), true);
  assert.equal(fixtures.get("unexpected_authority_flag_true").schema_error_paths.some((item) => item.endsWith(".authority_flags.unexpected_authority_allowed_now")), true);
  assert.equal(fixtures.get("fd_receipt_verify_apply_runtime_true").schema_error_paths.some((item) => item.endsWith(".fd_receipt_verify.apply_engine_runtime_enabled_now")), true);
  assert.equal(fixtures.get("fd_receipt_verify_unexpected_runtime_flag_true").schema_error_paths.some((item) => item.endsWith(".fd_receipt_verify.unexpected_runtime_allowed_now")), true);
});

test("Factory Receipt Authority Schema Freeze writes closeout artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-receipt-authority-schema-freeze-out-"));
  try {
    const result = await runFactoryReceiptAuthoritySchemaFreeze({
      outDir,
      runAt: RUN_AT,
      check: false,
      requirePass: true,
      commitRef: "fd6fec6",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-receipt-authority-schema-freeze.json"), "utf8"));
    const authorityRows = JSON.parse(await readFile(path.join(outDir, "authority-schema-rows.json"), "utf8"));
    const negativeRows = JSON.parse(await readFile(path.join(outDir, "negative-fixture-rows.json"), "utf8"));
    const boundary = JSON.parse(await readFile(path.join(outDir, "boundary.json"), "utf8"));

    assert.equal(result.summary.factory_receipt_authority_schema_freeze_status, "ready_factory_receipt_authority_schema_freeze");
    assert.equal(artifact.summary.authority_schema_frozen_count, 15);
    assert.equal(authorityRows.count, 15);
    assert.equal(negativeRows.count, 12);
    assert.equal(boundary.apply_allowed_now, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Factory Receipt Authority Schema Freeze --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-receipt-authority-schema-freeze-check-"));
  try {
    const sentinelPath = path.join(outDir, "factory-receipt-authority-schema-freeze.json");
    const sentinel = '{ "sentinel": "factory-receipt-authority-schema-freeze" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-receipt-authority-schema-freeze.mjs",
      "--check",
      "--require-pass",
      "--out-dir",
      outDir,
      "--run-at",
      RUN_AT,
      "--commit-ref",
      "fd6fec6",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
