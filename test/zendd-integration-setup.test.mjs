import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddIntegrationSetup } from "../src/zendd-integration-setup.mjs";

const execFileAsync = promisify(execFile);

test("zendd integration setup records a read-only boundary for an external Zendd checkout", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-setup-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddIntegrationSetup({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_integration_setup_status, "ready_for_project_zendd_boundary");
    assert.equal(result.summary.phase_range, "P521-P525");
    assert.equal(result.integration_adr.selected_option, "external_project_adapter");
    assert.equal(result.zendd_baseline.project_id, "project.zendd");
    assert.equal(result.zendd_baseline.source_control.git_present, true);
    assert.equal(result.zendd_baseline.mutation_allowed, false);
    assert.equal(result.project_zendd_boundary_contract.read_only, true);
    assert.equal(result.project_zendd_boundary_contract.mutation_allowed, false);
    assert.equal(result.project_zendd_boundary_contract.raw_vdr_copy_allowed, false);
    assert.equal(result.feature_parity_matrix_rows.length, 9);
    assert.ok(result.feature_parity_matrix_rows.some((row) => row.feature_id === "ldd_fact_issue_engine" && row.integration_decision === "bridge_zendd_to_hermes"));
    assert.ok(result.dirty_tree_safety_inventory_rows.every((row) => row.mutation_allowed === false && row.next_allowed_action));
    assert.ok(result.zendd_integration_gate_rows.every((row) => row.gate_status === "pass"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd integration setup classifies env candidates without permitting mutation", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-secret-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    await writeFile(path.join(zenddRoot, ".env"), "SHOULD_NOT_BE_READ=1\n", "utf8");

    const result = await runZenddIntegrationSetup({ zenddProjectRoot: zenddRoot, write: false, check: true });
    const envRow = result.dirty_tree_safety_inventory_rows.find((row) => row.path === ".env");

    assert.equal(result.validation.valid, true);
    assert.equal(envRow.path_classification, "secret_or_environment_candidate");
    assert.equal(envRow.risk_level, "critical");
    assert.equal(envRow.handling_policy, "do_not_read_contents_require_user_triage");
    assert.equal(envRow.mutation_allowed, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd integration setup --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-integration-setup.json");
    const sentinel = "{ \"sentinel\": \"zendd-integration-setup\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddIntegrationSetup({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
