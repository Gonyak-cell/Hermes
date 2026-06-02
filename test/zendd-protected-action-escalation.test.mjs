import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddProtectedActionEscalation } from "../src/zendd-protected-action-escalation.mjs";

const execFileAsync = promisify(execFile);

test("zendd protected action escalation drafts packets without enabling execution", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-protected-action-escalation-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddProtectedActionEscalation({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_protected_action_escalation_status, "ready_for_zendd_protected_action_escalation");
    assert.equal(result.summary.source_command_evidence_execution_bridge_status, "ready_for_zendd_command_evidence_execution_bridge");
    assert.equal(result.summary.source_protected_action_rollback_status, "ready_for_physical_integration_decision");
    assert.equal(result.summary.command_protected_action_request_count >= 1, true);
    assert.equal(result.summary.domain_protected_action_request_count, 10);
    assert.equal(result.summary.protected_action_escalation_packet_count, result.summary.command_protected_action_request_count + result.summary.domain_protected_action_request_count);
    assert.equal(result.summary.protected_action_execution_allowed_now, false);
    assert.equal(result.protected_action_escalation_packet_rows.every((row) => row.packet_status === "draft_only_not_submitted" && row.protected_action_execution_allowed_now === false), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd protected action escalation requires human gates and blocks protected classes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-protected-action-escalation-gates-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddProtectedActionEscalation({ zenddProjectRoot: zenddRoot, write: false, check: true });

    const classes = new Set([
      ...result.command_protected_action_request_rows.map((row) => row.protected_action_class),
      ...result.domain_protected_action_request_rows.map((row) => row.protected_action_class)
    ]);
    assert.equal(classes.has("database_migration"), true);
    assert.equal(classes.has("release_package"), true);
    assert.equal(classes.has("client_output_export"), true);
    assert.equal(classes.has("receipt_application"), true);
    assert.equal(classes.has("rollback_execution"), true);
    assert.equal(classes.has("build_artifact"), true);
    assert.equal(result.protected_action_human_gate_rows.length, result.protected_action_escalation_packet_rows.length);
    assert.equal(result.protected_action_human_gate_rows.every((row) => row.human_receipt_required && row.synthetic_receipt_allowed === false), true);
    assert.equal(result.protected_action_human_gate_rows.every((row) => row.human_receipt_payload_present === false && row.pass_without_human_receipt_allowed === false), true);
    assert.equal(result.protected_action_fail_closed_rows.every((row) => row.fixture_status === "pass" && row.synthetic_receipt_allowed === false), true);
    assert.equal(result.protected_action_escalation_closeout_rows.every((row) => row.protected_action_escalation_ready && row.rollback_execution_allowed_now === false), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd protected action escalation --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-protected-action-escalation-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-protected-action-escalation.json");
    const sentinel = "{ \"sentinel\": \"zendd-protected-action-escalation\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddProtectedActionEscalation({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
