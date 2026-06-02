import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddBoundary } from "../src/zendd-boundary.mjs";

const execFileAsync = promisify(execFile);

test("zendd boundary registers project.zendd as a read-only law-firm subproject", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-boundary-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddBoundary({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_boundary_status, "ready_for_zendd_dev_harness_adapter");
    assert.equal(result.summary.phase_range, "P526-P540");
    assert.equal(result.project_zendd_registration.project_id, "project.zendd");
    assert.equal(result.project_zendd_registration.domain_pack_id, "law-firm");
    assert.equal(result.project_zendd_registration.registration_mode, "external_project_adapter");
    assert.equal(result.project_zendd_registration.code_directory_move_allowed, false);
    assert.equal(result.project_zendd_registration.mutation_allowed, false);
    assert.equal(result.project_zendd_registration.command_execution_allowed, false);
    assert.equal(result.project_zendd_registration.raw_vdr_copy_allowed, false);
    assert.equal(result.observation_policy_rows.every((row) => row.read_only && !row.raw_content_allowed && !row.secret_value_allowed), true);
    assert.equal(result.zendd_command_catalog_rows.every((row) => row.execution_allowed_in_boundary_phase === false && row.observed_only === true), true);
    assert.ok(result.zendd_command_catalog_rows.some((row) => row.script_name === "test" && row.verdict === "candidate_not_executed"));
    assert.ok(result.prohibited_operation_rows.some((row) => row.operation_id === "copy_raw_vdr_material" && row.allowed === false));
    assert.ok(result.blocked_capability_ledger_rows.every((row) => row.block_reason && row.responsible_owner && row.next_allowed_action));
    assert.ok(result.boundary_gate_rows.every((row) => row.gate_status === "pass"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd boundary keeps domain document artifacts reference-only and mutation blocked", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-boundary-doc-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    await mkdir(path.join(zenddRoot, "samples"), { recursive: true });
    await writeFile(path.join(zenddRoot, "samples/client-report.pdf"), "not a real pdf\n", "utf8");

    const result = await runZenddBoundary({ zenddProjectRoot: zenddRoot, write: false, check: true });
    const dirtyDocRow = result.dirty_tree_mutation_policy;

    assert.equal(result.validation.valid, true);
    assert.equal(dirtyDocRow.dirty_tree_row_count > 0, true);
    assert.equal(dirtyDocRow.mutation_allowed, false);
    assert.equal(dirtyDocRow.all_dirty_rows_have_next_action, true);
    assert.equal(result.raw_material_reference_policy.raw_vdr_copy_allowed, false);
    assert.equal(result.raw_material_reference_policy.raw_client_document_copy_allowed, false);
    assert.deepEqual(result.raw_material_reference_policy.prohibited_input_types, ["raw_vdr_file", "raw_client_document", "secret_file", "credential_value"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd boundary --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-boundary-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-boundary.json");
    const sentinel = "{ \"sentinel\": \"zendd-boundary\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddBoundary({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function createZenddFixture(root) {
  const zenddRoot = path.join(root, "03_Zendd");
  await mkdir(path.join(zenddRoot, "frontend"), { recursive: true });
  await mkdir(path.join(zenddRoot, "backend/app/routers"), { recursive: true });
  await mkdir(path.join(zenddRoot, "backend/app/services/ldd_fact_engine"), { recursive: true });
  await mkdir(path.join(zenddRoot, "electron"), { recursive: true });
  await writeJson(path.join(zenddRoot, "package.json"), {
    name: "zendd-desktop",
    scripts: {
      dev: "node ./scripts/dev-stack.cjs",
      build: "npm run build:frontend",
      "build:frontend": "npm --prefix frontend run build",
      "dev:backend": "node ./scripts/dev-backend.cjs",
      test: "node --test",
      migrate: "alembic upgrade head",
    },
  });
  await writeJson(path.join(zenddRoot, "frontend/package.json"), {
    name: "amic-x-petra-platform",
    scripts: {
      build: "vite build",
      lint: "eslint .",
      test: "vitest run",
    },
  });
  await writeFile(path.join(zenddRoot, "backend/pyproject.toml"), [
    "[project]",
    "name = \"deal-mgmt\"",
    "version = \"0.15.7\"",
    "requires-python = \">=3.11\"",
    "",
  ].join("\n"), "utf8");
  await writeFile(path.join(zenddRoot, "electron/main.cjs"), "module.exports = {};\n", "utf8");
  await writeFile(path.join(zenddRoot, "backend/app/routers/vdr.py"), "router = object()\n", "utf8");
  await writeFile(path.join(zenddRoot, "backend/app/routers/ldd_fact_engine.py"), "router = object()\n", "utf8");
  await writeFile(path.join(zenddRoot, "backend/app/services/vdr_classification_service.py"), "def classify_document_by_content(): pass\n", "utf8");
  await writeFile(path.join(zenddRoot, "backend/app/services/ldd_source_controls.py"), "SOURCE_CONTROL_HARD_BLOCK_CODES = set()\n", "utf8");
  await writeFile(path.join(zenddRoot, "backend/app/services/ldd_fact_engine/client_output_gate.py"), "def evaluate_client_facing_ldd_sentence(): pass\n", "utf8");
  await execFileAsync("git", ["init"], { cwd: zenddRoot });
  return zenddRoot;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
