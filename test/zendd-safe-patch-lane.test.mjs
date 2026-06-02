import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddSafePatchLane } from "../src/zendd-safe-patch-lane.mjs";

const execFileAsync = promisify(execFile);

test("zendd safe patch lane promotes non-protected work orders into review candidates without writes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-safe-patch-lane-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddSafePatchLane({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_safe_patch_lane_status, "ready_for_zendd_safe_patch_lane");
    assert.equal(result.summary.source_work_order_intake_status, "ready_for_zendd_work_order_intake");
    assert.equal(result.summary.patch_candidate_count, 3);
    assert.equal(result.summary.file_write_executed_now, false);
    assert.equal(result.summary.command_execution_allowed_now, false);
    assert.equal(result.patch_candidate_rows.every((row) => row.current_verdict === "pass" && row.non_protected_scope), true);
    assert.equal(result.patch_candidate_rows.every((row) => row.file_write_executed_now === false && row.automatic_patch_allowed_now === false), true);
    assert.equal(result.patch_preflight_rows.every((row) => row.patch_execution_allowed_now === false && row.rollback_target_ref), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd safe patch lane blocks protected scopes and unscoped dirty-tree writes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-safe-patch-lane-blocks-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddSafePatchLane({ zenddProjectRoot: zenddRoot, write: false, check: true });

    const blockedScopes = result.patch_scope_rows.filter((row) => row.current_verdict === "blocked");
    assert.equal(blockedScopes.length >= 5, true);
    assert.equal(blockedScopes.every((row) => row.block_reason && row.rollback_target_ref && row.file_write_executed_now === false), true);
    assert.equal(result.protected_patch_block_rows.length >= 10, true);
    assert.equal(result.protected_patch_block_rows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), true);
    assert.equal(result.protected_patch_block_rows.every((row) => row.human_receipt_required && row.file_write_executed_now === false), true);
    assert.equal(result.dirty_tree_guard_rows.some((row) => row.guard_id === "unscoped_write_blocked_when_dirty_tree_present" && row.current_verdict === "blocked"), true);
    assert.equal(result.safe_patch_lane_closeout_rows.every((row) => row.safe_patch_lane_ready && !row.protected_action_execution_allowed), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd safe patch lane --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-safe-patch-lane-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-safe-patch-lane.json");
    const sentinel = "{ \"sentinel\": \"zendd-safe-patch-lane\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddSafePatchLane({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
