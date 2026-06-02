import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddPhysicalIntegrationDecision } from "../src/zendd-physical-integration-decision.mjs";

const execFileAsync = promisify(execFile);

test("zendd physical integration decision selects the external adapter", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-physical-integration-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddPhysicalIntegrationDecision({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_physical_integration_decision_status, "external_adapter_selected_for_safe_operation");
    assert.equal(result.summary.selected_integration_mode, "external_project_adapter");
    assert.equal(result.integration_option_rows.filter((row) => row.selected).length, 1);
    assert.equal(result.integration_option_rows.find((row) => row.selected).decision_verdict, "pass");
    assert.equal(result.integration_option_rows.filter((row) => !row.selected).every((row) => row.current_verdict === "blocked" && row.block_reason && row.responsible_owner && row.next_allowed_action), true);
    assert.equal(result.operating_mode_rows[0].external_adapter_active, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd physical integration decision blocks subtree, submodule, workspace, copy, and directory movement", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-physical-integration-blocks-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddPhysicalIntegrationDecision({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.physical_integration_policy.subtree_allowed_now, false);
    assert.equal(result.physical_integration_policy.submodule_allowed_now, false);
    assert.equal(result.physical_integration_policy.workspace_move_allowed_now, false);
    assert.equal(result.physical_integration_policy.monorepo_directory_move_allowed_now, false);
    assert.equal(result.summary.physical_code_move_allowed_now, false);
    assert.equal(result.summary.raw_project_copy_allowed_now, false);
    assert.equal(result.physical_movement_block_rows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), true);
    assert.equal(result.physical_movement_block_rows.every((row) => row.physical_code_move_allowed_now === false && row.raw_project_copy_allowed_now === false), true);
    assert.equal(result.physical_integration_closeout_rows.every((row) => row.external_adapter_selected === true && row.pass_promoted_for_physical_move === false), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd physical integration decision --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-physical-integration-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-physical-integration-decision.json");
    const sentinel = "{ \"sentinel\": \"zendd-physical-integration-decision\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddPhysicalIntegrationDecision({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
      "dev:backend": "node ./scripts/dev-backend.cjs",
      test: "node --test",
      validate: "npm run test",
      migrate: "alembic upgrade head",
      package: "electron-builder"
    }
  });
  await writeJson(path.join(zenddRoot, "frontend/package.json"), {
    name: "amic-x-petra-platform",
    scripts: {
      build: "vite build",
      lint: "eslint .",
      test: "vitest run"
    }
  });
  await writeFile(path.join(zenddRoot, "backend/pyproject.toml"), [
    "[project]",
    "name = \"deal-mgmt\"",
    "version = \"0.15.7\"",
    "requires-python = \">=3.11\"",
    ""
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
