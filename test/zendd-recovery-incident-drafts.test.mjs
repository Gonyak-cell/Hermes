import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddRecoveryIncidentDrafts } from "../src/zendd-recovery-incident-drafts.mjs";

const execFileAsync = promisify(execFile);

test("zendd recovery incident drafts bind incidents to rollback targets and receipt drafts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-recovery-incidents-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddRecoveryIncidentDrafts({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_recovery_incident_drafts_status, "ready_for_zendd_recovery_incident_drafts");
    assert.equal(result.summary.source_human_receipt_intake_status, "ready_for_zendd_human_receipt_intake");
    assert.equal(result.summary.source_release_candidate_sandbox_status, "ready_for_zendd_release_candidate_sandbox");
    assert.equal(result.summary.source_diff_review_rollback_binding_status, "ready_for_zendd_diff_review_rollback_binding");
    assert.equal(result.summary.recovery_incident_draft_count >= 10, true);
    assert.equal(result.recovery_receipt_draft_rows.length, result.recovery_incident_draft_rows.length);
    assert.equal(result.operator_incident_surface_rows.length, result.recovery_incident_draft_rows.length);
    assert.equal(result.recovery_incident_draft_rows.every((row) => row.current_verdict === "blocked" && row.incident_status === "draft_only_not_executed" && row.rollback_target_ref && row.recovery_receipt_draft_ref), true);
    assert.equal(result.recovery_rollback_target_rows.every((row) => row.current_verdict === "blocked" && row.rollback_execution_allowed_now === false && row.rollback_target_materialized_now === false), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd recovery incident drafts fail-close recovery execution and raw exposure", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-recovery-incidents-blocks-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddRecoveryIncidentDrafts({ zenddProjectRoot: zenddRoot, write: false, check: true });

    const incidentTypes = new Set(result.recovery_incident_draft_rows.map((row) => row.incident_type));
    assert.equal(incidentTypes.has("build_failure"), true);
    assert.equal(incidentTypes.has("stale_domain_data"), true);
    assert.equal(incidentTypes.has("database_migration_failure"), true);
    assert.equal(incidentTypes.has("client_output_recovery"), true);
    assert.equal(result.recovery_incident_draft_rows.every((row) => row.recovery_execution_allowed_now === false && row.rollback_execution_allowed_now === false && row.command_execution_allowed_now === false), true);
    assert.equal(result.recovery_receipt_draft_rows.every((row) => row.receipt_payload_present === false && row.receipt_application_allowed_now === false && row.synthetic_receipt_allowed === false), true);
    assert.equal(result.operator_incident_surface_rows.every((row) => row.missing_evidence.length >= 3 && row.missing_receipt && row.next_allowed_action), true);
    assert.equal(result.recovery_incident_fail_closed_rows.every((row) => row.fixture_status === "pass" && row.raw_log_storage_allowed === false && row.secret_read_allowed_now === false), true);
    assert.equal(result.summary.recovery_execution_allowed_now, false);
    assert.equal(result.summary.rollback_execution_allowed_now, false);
    assert.equal(result.summary.raw_log_storage_allowed, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd recovery incident drafts --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-recovery-incidents-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-recovery-incident-drafts.json");
    const sentinel = "{ \"sentinel\": \"zendd-recovery-incident-drafts\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddRecoveryIncidentDrafts({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
