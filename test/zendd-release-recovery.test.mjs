import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddReleaseRecovery } from "../src/zendd-release-recovery.mjs";

const execFileAsync = promisify(execFile);

test("zendd release recovery blocks release claims with rollback targets and receipts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-release-recovery-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddReleaseRecovery({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_release_recovery_status, "ready_for_cross_system_claim_freeze");
    assert.equal(result.summary.phase_range, "P681-P700");
    assert.equal(result.release_recovery_policy.release_execution_allowed_now, false);
    assert.equal(result.release_claim_rows.length, 10);
    assert.equal(result.release_claim_rows.every((row) => row.current_verdict === "blocked" && row.rollback_target && row.recovery_receipt_ref && row.next_allowed_action), true);
    assert.equal(result.release_claim_rows.every((row) => row.release_execution_allowed_now === false), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd release recovery keeps protected actions, rollback, and recovery future-only", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-release-recovery-future-only-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddReleaseRecovery({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.protected_release_action_rows.every((row) => row.action_allowed_now === false && row.current_verdict === "blocked"), true);
    assert.equal(result.rollback_target_rows.every((row) => row.rollback_execution_allowed_now === false && row.rollback_receipt_required), true);
    assert.equal(result.recovery_scenario_rows.every((row) => row.release_or_recovery_execution_allowed_now === false && row.recovery_draft_receipt_status === "draft_only_not_applied"), true);
    assert.equal(result.recovery_receipt_rows.every((row) => row.receipt_payload_present === false && row.receipt_validated === false && row.approval_applied === false), true);
    assert.equal(result.release_recovery_closeout_rows.every((row) => row.release_execution_allowed_now === false && row.database_migration_allowed_now === false && row.client_export_allowed_now === false && row.pass_promoted === false), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd release recovery --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-release-recovery-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-release-recovery.json");
    const sentinel = "{ \"sentinel\": \"zendd-release-recovery\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddReleaseRecovery({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
