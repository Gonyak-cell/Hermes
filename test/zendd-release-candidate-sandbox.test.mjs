import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddReleaseCandidateSandbox } from "../src/zendd-release-candidate-sandbox.mjs";

const execFileAsync = promisify(execFile);

test("zendd release candidate sandbox prepares blocked candidate packets without execution", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-release-candidate-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddReleaseCandidateSandbox({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_release_candidate_sandbox_status, "ready_for_zendd_release_candidate_sandbox");
    assert.equal(result.summary.source_diff_review_rollback_binding_status, "ready_for_zendd_diff_review_rollback_binding");
    assert.equal(result.summary.source_command_evidence_execution_bridge_status, "ready_for_zendd_command_evidence_execution_bridge");
    assert.equal(result.summary.release_candidate_sandbox_count, 10);
    assert.equal(result.summary.sandbox_evidence_packet_count, result.summary.release_candidate_sandbox_count);
    assert.equal(result.release_candidate_sandbox_rows.every((row) => row.current_verdict === "blocked" && row.sandbox_status === "view_prepared_not_executed"), true);
    assert.equal(result.release_candidate_sandbox_rows.every((row) => row.release_candidate_pass_allowed_now === false && row.command_execution_allowed_now === false && row.publish_allowed_now === false), true);
    assert.equal(result.sandbox_evidence_packet_rows.every((row) => row.packet_status === "draft_only_not_executed" && row.command_execution_evidence_present === false && row.artifact_hash_present === false), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd release candidate sandbox blocks artifacts, publish, and client delivery", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-release-candidate-blocks-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddReleaseCandidateSandbox({ zenddProjectRoot: zenddRoot, write: false, check: true });

    const artifactClasses = new Set(result.artifact_isolation_rows.map((row) => row.protected_action_class));
    assert.equal(artifactClasses.has("build_artifact"), true);
    assert.equal(artifactClasses.has("release_package"), true);
    assert.equal(result.artifact_isolation_rows.every((row) => row.current_verdict === "blocked" && row.artifact_materialized_now === false && row.publish_allowed_now === false), true);
    assert.equal(result.client_delivery_block_rows.length >= 2, true);
    assert.equal(result.client_delivery_block_rows.every((row) => row.client_export_allowed_now === false && row.client_delivery_allowed_now === false && row.human_receipt_required === true), true);
    assert.equal(result.release_candidate_fail_closed_rows.every((row) => row.fixture_status === "pass" && row.publish_allowed_now === false && row.client_delivery_allowed_now === false), true);
    assert.equal(result.summary.raw_artifact_copy_allowed_now, false);
    assert.equal(result.summary.raw_vdr_or_client_material_copy_allowed_now, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd release candidate sandbox --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-release-candidate-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-release-candidate-sandbox.json");
    const sentinel = "{ \"sentinel\": \"zendd-release-candidate-sandbox\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddReleaseCandidateSandbox({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
