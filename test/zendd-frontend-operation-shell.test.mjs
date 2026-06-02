import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddFrontendOperationShell } from "../src/zendd-frontend-operation-shell.mjs";

const execFileAsync = promisify(execFile);

test("zendd frontend operation shell normalizes design tokens and keeps external adapter selected", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-frontend-shell-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddFrontendOperationShell({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_frontend_operation_shell_status, "ready_for_zendd_frontend_operation_shell");
    assert.equal(result.summary.selected_integration_mode, "external_project_adapter");
    assert.equal(result.summary.static_shell_ready, true);
    assert.equal(result.summary.physical_code_move_allowed_now, false);
    assert.equal(result.summary.zendd_mutation_allowed_now, false);
    assert.equal(result.phase_plan_rows.length, 12);
    assert.equal(result.design_token_rows.filter((row) => row.token_name.includes("letter_spacing")).every((row) => row.token_value !== "undefined" && !row.token_value.startsWith("-")), true);
    assert.equal(result.html.includes("Hermes Zendd Operator"), true);
    assert.equal(result.css.includes("--hermes-accent"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd frontend operation shell exposes read-only routes and documented mutation blocks", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-frontend-shell-blocks-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddFrontendOperationShell({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.route_surface_rows.every((row) => row.read_only && row.server_started === false && row.protected_action_execution_allowed === false), true);
    assert.equal(result.frontend_shell_rows.every((row) => row.read_only && row.mutation_allowed === false), true);
    assert.equal(result.protected_mutation_block_rows.length, 7);
    assert.equal(result.protected_mutation_block_rows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.rollback_target_ref && row.next_allowed_action), true);
    assert.equal(result.frontend_operation_closeout_rows.every((row) => row.external_adapter_active && !row.protected_action_execution_allowed), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd frontend operation shell --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-frontend-shell-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-frontend-operation-shell.json");
    const sentinel = "{ \"sentinel\": \"zendd-frontend-operation-shell\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddFrontendOperationShell({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
