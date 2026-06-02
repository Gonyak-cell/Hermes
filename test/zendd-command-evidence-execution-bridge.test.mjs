import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddCommandEvidenceExecutionBridge } from "../src/zendd-command-evidence-execution-bridge.mjs";

const execFileAsync = promisify(execFile);

test("zendd command evidence execution bridge prepares packets without running commands", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-command-execution-bridge-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddCommandEvidenceExecutionBridge({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_command_evidence_execution_bridge_status, "ready_for_zendd_command_evidence_execution_bridge");
    assert.equal(result.summary.source_safe_patch_lane_status, "ready_for_zendd_safe_patch_lane");
    assert.equal(result.summary.source_command_evidence_status, "ready_for_vdr_ldd_source_contract_bridge");
    assert.equal(result.summary.verification_command_candidate_count >= 3, true);
    assert.equal(result.summary.command_execution_packet_count, result.summary.verification_command_candidate_count);
    assert.equal(result.summary.command_output_binding_count, result.summary.verification_command_candidate_count);
    assert.equal(result.summary.command_execution_performed_now, false);
    assert.equal(result.summary.file_write_executed_now, false);
    assert.equal(result.verification_command_candidate_rows.every((row) => row.current_verdict === "pass" && row.execution_allowed_in_check === false), true);
    assert.equal(result.command_execution_packet_rows.every((row) => row.packet_status === "prepared_not_executed" && row.command_execution_performed_now === false), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd command evidence execution bridge blocks build and protected commands", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-command-execution-blocks-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddCommandEvidenceExecutionBridge({ zenddProjectRoot: zenddRoot, write: false, check: true });

    const blockClasses = new Set(result.protected_command_execution_block_rows.map((row) => row.protected_action_class));
    assert.equal(blockClasses.has("build_artifact"), true);
    assert.equal(blockClasses.has("database_migration"), true);
    assert.equal(blockClasses.has("release_package"), true);
    assert.equal(blockClasses.has("runtime_server"), true);
    assert.equal(result.protected_command_execution_block_rows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.responsible_owner), true);
    assert.equal(result.protected_command_execution_block_rows.every((row) => row.hard_gate_ref && row.rollback_target_ref && row.next_allowed_action), true);
    assert.equal(result.protected_command_execution_block_rows.filter((row) => row.human_receipt_required).every((row) => row.documented_human_gate_ref), true);
    assert.equal(result.protected_command_execution_block_rows.every((row) => row.command_execution_performed_now === false && row.file_write_executed_now === false), true);
    assert.equal(result.command_output_binding_rows.every((row) => row.raw_stdout_stored === false && row.raw_stderr_stored === false && row.raw_log_storage_allowed === false), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd command evidence execution bridge --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-command-execution-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-command-evidence-execution-bridge.json");
    const sentinel = "{ \"sentinel\": \"zendd-command-evidence-execution-bridge\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddCommandEvidenceExecutionBridge({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
