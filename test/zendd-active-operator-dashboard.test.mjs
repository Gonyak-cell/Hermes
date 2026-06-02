import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddActiveOperatorDashboard } from "../src/zendd-active-operator-dashboard.mjs";

const execFileAsync = promisify(execFile);

test("zendd active operator dashboard exposes read-only queues and API routes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-active-dashboard-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddActiveOperatorDashboard({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_active_operator_dashboard_status, "ready_for_zendd_active_operator_dashboard");
    assert.equal(result.summary.source_frontend_operation_shell_status, "ready_for_zendd_frontend_operation_shell");
    assert.equal(result.summary.source_work_order_intake_status, "ready_for_zendd_work_order_intake");
    assert.equal(result.summary.source_command_evidence_execution_bridge_status, "ready_for_zendd_command_evidence_execution_bridge");
    assert.equal(result.summary.source_protected_action_escalation_status, "ready_for_zendd_protected_action_escalation");
    assert.equal(result.summary.source_recovery_incident_drafts_status, "ready_for_zendd_recovery_incident_drafts");
    assert.equal(result.active_dashboard_widget_rows.length >= 7, true);
    assert.equal(result.active_dashboard_api_route_rows.every((row) => row.allowed_methods.length === 1 && row.allowed_methods[0] === "GET" && row.mutating_method_allowed === false && row.server_started === false), true);
    assert.equal(result.active_dashboard_missing_input_rows.length >= 10, true);
    assert.equal(result.active_dashboard_next_action_rows.length >= result.active_dashboard_missing_input_rows.length, true);
    assert.equal(result.html.includes("Active Operator Dashboard"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd active operator dashboard blocks execution, route mutation, receipts, and raw exposure", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-active-dashboard-blocks-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddActiveOperatorDashboard({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.summary.server_started, false);
    assert.equal(result.summary.route_mutation_performed, false);
    assert.equal(result.summary.command_execution_allowed_now, false);
    assert.equal(result.summary.protected_action_execution_allowed_now, false);
    assert.equal(result.summary.receipt_application_allowed_now, false);
    assert.equal(result.summary.pass_promotion_allowed_now, false);
    assert.equal(result.summary.raw_vdr_or_client_material_copy_allowed_now, false);
    assert.equal(result.summary.secret_read_allowed_now, false);
    assert.equal(result.active_dashboard_fail_closed_rows.every((row) => row.fixture_status === "pass" && row.server_started === false && row.secret_read_allowed_now === false), true);
    assert.equal(result.active_dashboard_ui_artifact_rows.every((row) => row.read_only === true && row.server_started === false && row.zendd_file_write_allowed_now === false), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd active operator dashboard --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-active-dashboard-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-active-operator-dashboard.json");
    const sentinel = "{ \"sentinel\": \"zendd-active-operator-dashboard\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddActiveOperatorDashboard({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function createZenddFixture(root) {
  const zenddRoot = path.join(root, "03_Zendd");
  await mkdir(path.join(zenddRoot, "frontend/src"), { recursive: true });
  await mkdir(path.join(zenddRoot, "backend/app/routers"), { recursive: true });
  await mkdir(path.join(zenddRoot, "backend/app/services/ldd_fact_engine"), { recursive: true });
  await mkdir(path.join(zenddRoot, "electron"), { recursive: true });
  await mkdir(path.join(zenddRoot, "vdr"), { recursive: true });
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
  await writeFile(path.join(zenddRoot, ".env.local"), "DO_NOT_READ=1\n", "utf8");
  await writeFile(path.join(zenddRoot, "vdr/client.xlsx"), "placeholder\n", "utf8");
  await writeFile(path.join(zenddRoot, "frontend/src/App.tsx"), "export function App() { return null; }\n", "utf8");
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
