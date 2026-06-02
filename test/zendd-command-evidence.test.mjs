import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddCommandEvidence } from "../src/zendd-command-evidence.mjs";

const execFileAsync = promisify(execFile);

test("zendd command evidence maps commands to evidence refs without execution", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-command-evidence-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddCommandEvidence({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_command_evidence_status, "ready_for_vdr_ldd_source_contract_bridge");
    assert.equal(result.summary.phase_range, "P561-P580");
    assert.equal(result.command_evidence_policy.command_execution_allowed_now, false);
    assert.equal(result.command_evidence_rows.every((row) => row.command_evidence_ref && row.claim_id && row.execution_allowed_now === false), true);
    assert.ok(result.command_evidence_rows.some((row) => row.script_name === "test" && row.verdict === "blocked_pending_evidence_capture"));
    assert.equal(result.command_review_binding_rows.length, result.command_evidence_rows.length);
    assert.equal(result.command_review_binding_rows.every((row) => row.reviewer_required_for_pass && !row.pass_without_review_allowed), true);
    assert.equal(result.command_pass_block_policy.pass_allowed_without_evidence, false);
    assert.equal(result.command_pass_block_policy.pass_allowed_without_review, false);
    assert.equal(result.command_pass_block_policy.protected_pass_allowed_without_receipt, false);
    assert.equal(result.command_capture_plan.capture_execution_allowed_now, false);
    assert.equal(result.command_evidence_freeze_rows.length, result.command_evidence_rows.length);
    assert.equal(result.command_evidence_gate_rows.every((row) => row.gate_status === "pass"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd command evidence keeps database and package commands protected", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-protected-command-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddCommandEvidence({ zenddProjectRoot: zenddRoot, write: false, check: true });
    const protectedScripts = result.protected_command_rows.map((row) => row.script_name);

    assert.equal(result.validation.valid, true);
    assert.ok(protectedScripts.includes("migrate"));
    assert.ok(protectedScripts.includes("package"));
    assert.equal(result.protected_command_rows.every((row) => row.human_receipt_ref_required && !row.execution_allowed_now), true);
    assert.equal(result.log_redaction_policy.raw_log_storage_allowed, false);
    assert.equal(result.log_redaction_policy.secret_value_storage_allowed, false);
    assert.ok(result.log_redaction_policy.required_outputs.includes("redaction_report_ref"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd command evidence --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-command-evidence-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-command-evidence.json");
    const sentinel = "{ \"sentinel\": \"zendd-command-evidence\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddCommandEvidence({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
      package: "electron-builder",
    },
  });
  await writeJson(path.join(zenddRoot, "frontend/package.json"), {
    name: "amic-x-petra-platform",
    scripts: {
      build: "vite build",
      lint: "eslint .",
      test: "vitest run",
    },
  });
  await writeFile(path.join(zenddRoot, "backend/pyproject.toml"), [
    "[project]",
    "name = \"deal-mgmt\"",
    "version = \"0.15.7\"",
    "requires-python = \">=3.11\"",
    "",
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
