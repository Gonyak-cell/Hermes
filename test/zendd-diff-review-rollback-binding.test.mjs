import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddDiffReviewRollbackBinding } from "../src/zendd-diff-review-rollback-binding.mjs";

const execFileAsync = promisify(execFile);

test("zendd diff review rollback binding creates blocked review packets without raw reads", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-diff-review-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddDiffReviewRollbackBinding({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_diff_review_rollback_binding_status, "ready_for_zendd_diff_review_rollback_binding");
    assert.equal(result.summary.source_protected_action_escalation_status, "ready_for_zendd_protected_action_escalation");
    assert.equal(result.summary.source_safe_patch_lane_status, "ready_for_zendd_safe_patch_lane");
    assert.equal(result.summary.diff_inventory_row_count >= 1, true);
    assert.equal(result.summary.diff_review_packet_count >= 1, true);
    assert.equal(result.summary.rollback_binding_count, result.summary.diff_review_packet_count);
    assert.equal(result.diff_inventory_rows.every((row) => row.raw_file_content_read === false && row.raw_diff_storage_allowed === false && row.diff_apply_allowed_now === false), true);
    assert.equal(result.diff_review_packet_rows.every((row) => row.current_verdict === "blocked" && row.raw_diff_payload_stored === false && row.diff_apply_allowed_now === false), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd diff review rollback binding blocks protected diffs and raw material exposure", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-diff-review-protected-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddDiffReviewRollbackBinding({ zenddProjectRoot: zenddRoot, write: false, check: true });

    const protectedClasses = new Set(result.protected_diff_block_rows.map((row) => row.path_classification));
    assert.equal(protectedClasses.has("secret_or_environment_candidate"), true);
    assert.equal(protectedClasses.has("domain_data_or_document_artifact"), true);
    assert.equal(result.protected_diff_block_rows.every((row) => row.block_reason && row.responsible_owner && row.hard_gate_ref && row.rollback_target_ref && row.next_allowed_action), true);
    assert.equal(result.protected_diff_block_rows.filter((row) => row.path_classification === "secret_or_environment_candidate" || row.path_classification === "domain_data_or_document_artifact").every((row) => row.human_receipt_required === true), true);
    assert.equal(result.diff_review_fail_closed_rows.every((row) => row.fixture_status === "pass" && row.raw_diff_storage_allowed === false && row.raw_file_content_read_allowed === false), true);
    assert.equal(result.summary.raw_material_copy_allowed_now, false);
    assert.equal(result.summary.secret_read_allowed_now, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd diff review rollback binding --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-diff-review-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-diff-review-rollback-binding.json");
    const sentinel = "{ \"sentinel\": \"zendd-diff-review-rollback-binding\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddDiffReviewRollbackBinding({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
