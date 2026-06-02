import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddProtectedActionRollback } from "../src/zendd-protected-action-rollback.mjs";

const execFileAsync = promisify(execFile);

test("zendd protected action rollback blocks every protected action behind work order and receipt", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-protected-action-rollback-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddProtectedActionRollback({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_protected_action_rollback_status, "ready_for_physical_integration_decision");
    assert.equal(result.summary.phase_range, "P721-P740");
    assert.equal(result.protected_action_rows.length, 10);
    assert.equal(result.protected_action_rows.every((row) => row.current_verdict === "blocked" && row.protected_work_order_ref && row.rollback_target_ref && row.human_receipt_ref && row.action_allowed_now === false), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd protected action rollback keeps rollback, receipt application, and physical movement future-only", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-protected-action-rollback-future-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddProtectedActionRollback({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.protected_action_rollback_policy.rollback_execution_allowed_now, false);
    assert.equal(result.protected_action_rollback_policy.receipt_application_allowed_now, false);
    assert.equal(result.protected_action_rollback_policy.physical_code_move_allowed_now, false);
    assert.equal(result.rollback_target_rows.every((row) => row.rollback_rehearsal_allowed_now === false && row.rollback_execution_allowed_now === false), true);
    assert.equal(result.protected_work_order_rows.every((row) => row.work_order_payload_present === false && row.action_execution_allowed_now === false), true);
    assert.equal(result.fail_closed_fixture_rows.every((row) => row.fixture_status === "pass" && row.physical_code_move_allowed_now === false), true);
    assert.equal(result.protected_action_rollback_closeout_rows.every((row) => row.pass_promoted === false && row.read_only === true), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd protected action rollback --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-protected-action-rollback-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-protected-action-rollback.json");
    const sentinel = "{ \"sentinel\": \"zendd-protected-action-rollback\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddProtectedActionRollback({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
