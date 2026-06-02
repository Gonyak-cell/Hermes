import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddCrossSystemFreeze } from "../src/zendd-cross-system-freeze.mjs";

const execFileAsync = promisify(execFile);

test("zendd cross-system freeze demotes unsupported pass-like claims to documented block", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-cross-system-freeze-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddCrossSystemFreeze({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_cross_system_freeze_status, "ready_for_protected_action_rollback_hardening");
    assert.equal(result.summary.phase_range, "P701-P720");
    assert.equal(result.cross_system_freeze_claim_rows.every((row) => row.supported_final_state), true);
    assert.equal(result.cross_system_freeze_claim_rows.filter((row) => row.source_pass_like && !row.pass_eligible).every((row) => row.freeze_verdict === "blocked" && row.freeze_block_reason), true);
    assert.ok(result.summary.unsupported_pass_like_demoted_count > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd cross-system freeze preserves protected release and rollback hard blocks", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-cross-system-freeze-protected-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddCrossSystemFreeze({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.cross_system_freeze_policy.release_execution_allowed_now, false);
    assert.equal(result.cross_system_freeze_policy.rollback_execution_allowed_now, false);
    assert.equal(result.cross_system_freeze_policy.physical_code_move_allowed_now, false);
    assert.equal(result.summary.unsafe_true_flag_count, 0);
    assert.equal(result.cross_system_freeze_claim_rows.filter((row) => row.protected_claim).every((row) => row.documented_human_gate_ref), true);
    assert.equal(result.cross_system_freeze_closeout_rows.every((row) => row.pass_promoted === false && row.read_only === true), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd cross-system freeze --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-cross-system-freeze-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-cross-system-freeze.json");
    const sentinel = "{ \"sentinel\": \"zendd-cross-system-freeze\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddCrossSystemFreeze({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
