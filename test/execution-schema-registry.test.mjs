import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildExecutionSchemaRegistry,
  EXECUTION_SCHEMA_SPECS,
  parseExecutionSchemaRegistryArgs,
  runExecutionSchemaRegistry,
  validateExecutionSchemaRegistryResult,
} from "../src/execution-schema-registry.mjs";

const RUN_AT = "2026-06-16T08:00:00.000Z";

test("execution schema registry validates all handoff schemas", async () => {
  const result = await buildExecutionSchemaRegistry({ runAt: RUN_AT, write: false });

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "execution-schema-registry.v1");
  assert.equal(result.summary.execution_schema_registry_status, "ready_for_execution_schema_registry");
  assert.equal(result.summary.schema_count, EXECUTION_SCHEMA_SPECS.length);
  assert.equal(result.summary.valid_schema_count, EXECUTION_SCHEMA_SPECS.length);
  assert.equal(result.summary.valid_fixture_pass_count, EXECUTION_SCHEMA_SPECS.length);
  assert.equal(result.summary.blocked_fixture_pass_count, EXECUTION_SCHEMA_SPECS.length * 2);
  assert.equal(result.summary.negative_fixture_blocked_count, result.summary.negative_fixture_count);
  assert.equal(result.summary.execution_authority_opened_now, false);
});

test("execution schema registry keeps authority boundaries closed", async () => {
  const result = await buildExecutionSchemaRegistry({ runAt: RUN_AT, write: false });

  assert.equal(result.execution_schema_boundary.execution_authority_opened_now, false);
  assert.equal(result.execution_schema_boundary.command_execution_allowed_now, false);
  assert.equal(result.execution_schema_boundary.file_write_allowed_now, false);
  assert.equal(result.execution_schema_boundary.network_allowed_now, false);
  assert.equal(result.execution_schema_boundary.package_install_allowed_now, false);
  assert.equal(result.execution_schema_boundary.secret_access_allowed_now, false);
  assert.equal(result.execution_schema_boundary.connector_write_allowed, false);
  assert.equal(result.execution_schema_boundary.deployment_allowed, false);
  assert.equal(result.execution_schema_boundary.production_allowed, false);
  assert.equal(result.execution_schema_boundary.protected_output_allowed, false);
  assert.equal(result.execution_schema_boundary.desktop_shell_execution_allowed, false);
  assert.equal(result.execution_schema_boundary.owner_approval_counts_as_independent_review, false);
});

test("execution schema registry blocks semantic negative fixtures", async () => {
  const result = await buildExecutionSchemaRegistry({ runAt: RUN_AT, write: false });
  const fixtureIds = new Set(result.execution_schema_negative_fixture_rows.map((row) => row.fixture_id));

  for (const fixtureId of [
    "runtime_source_of_truth_true",
    "desktop_shell_execution_action",
    "owner_as_independent",
    "premature_production",
    "deploy_policy_open",
    "secret_and_network_open",
    "raw_shell_string",
    "authority_escalation",
  ]) {
    assert.equal(fixtureIds.has(fixtureId), true);
  }
  assert.equal(result.execution_schema_negative_fixture_rows.every((row) => row.blocked && !row.validation.valid), true);
});

test("execution schema registry validation fails if a forbidden fixture is treated as passing", async () => {
  const result = await buildExecutionSchemaRegistry({ runAt: RUN_AT, write: false });
  const tampered = JSON.parse(JSON.stringify(result));
  const forbiddenRow = tampered.execution_schema_fixture_rows.find((row) => row.fixture_kind === "forbidden_field");
  forbiddenRow.blocked = false;
  forbiddenRow.validation = { valid: true, errors: [] };

  const validation = validateExecutionSchemaRegistryResult(tampered);
  assert.equal(validation.validation.valid, false);
  assert.equal(validation.validation.errors.some((error) => error.path === "execution_schema_fixture_rows"), true);
});

test("execution schema registry --check validates without overwriting artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-execution-schema-registry-"));
  const sentinelPath = path.join(outDir, "execution-schema-registry.json");
  const sentinel = "{ \"sentinel\": \"execution-schema-registry\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");
  try {
    const result = await runExecutionSchemaRegistry({
      runAt: RUN_AT,
      check: true,
      write: false,
      outDir,
    });

    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("execution schema registry CLI parser accepts only known flags", () => {
  assert.deepEqual(parseExecutionSchemaRegistryArgs(["--check", "--schema-dir", "schemas"]), {
    outDir: "artifacts/execution-schema-registry/latest",
    check: true,
    write: false,
    schemaDir: "schemas",
  });
  assert.throws(() => parseExecutionSchemaRegistryArgs(["--execute"]), /Unknown argument: --execute/);
  assert.throws(() => parseExecutionSchemaRegistryArgs(["--out-dir"]), /Missing value for --out-dir/);
});
