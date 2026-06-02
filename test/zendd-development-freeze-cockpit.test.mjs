import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddDevelopmentFreezeCockpit } from "../src/zendd-development-freeze-cockpit.mjs";

const execFileAsync = promisify(execFile);

test("zendd development freeze cockpit adjudicates claims as PASS or documented BLOCK", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-freeze-cockpit-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddDevelopmentFreezeCockpit({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_development_freeze_cockpit_status, "ready_for_zendd_development_freeze_cockpit");
    assert.equal(result.summary.source_active_operator_dashboard_status, "ready_for_zendd_active_operator_dashboard");
    assert.equal(result.summary.source_human_receipt_intake_status, "ready_for_zendd_human_receipt_intake");
    assert.equal(result.summary.pass_claim_count >= 10, true);
    assert.equal(result.summary.blocked_claim_count >= 10, true);
    assert.equal(result.summary.freeze_claim_count, result.summary.pass_claim_count + result.summary.blocked_claim_count);
    assert.equal(result.development_freeze_claim_rows.every((row) => row.current_verdict === "pass" || row.current_verdict === "blocked"), true);
    assert.equal(result.development_freeze_claim_rows.filter((row) => row.current_verdict === "pass").every((row) => row.evidence_ref && row.reviewer_ref && row.hard_gate_ref && row.rollback_target_ref && row.unsafe_flags_false === true), true);
    assert.equal(result.development_freeze_claim_rows.filter((row) => row.current_verdict === "blocked").every((row) => row.block_reason && row.responsible_owner && row.next_allowed_action), true);
    assert.equal(result.development_freeze_adjudication_rows.every((row) => row.final_adjudication_status === "adjudicated"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd development freeze cockpit fail-closes unsafe PASS and mutation surfaces", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-freeze-cockpit-blocks-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddDevelopmentFreezeCockpit({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.summary.unsafe_flag_count, 0);
    assert.equal(result.summary.server_started, false);
    assert.equal(result.summary.command_execution_allowed_now, false);
    assert.equal(result.summary.protected_action_execution_allowed_now, false);
    assert.equal(result.summary.receipt_application_allowed_now, false);
    assert.equal(result.summary.pass_promotion_allowed_now, false);
    assert.equal(result.summary.raw_vdr_or_client_material_copy_allowed_now, false);
    assert.equal(result.summary.secret_read_allowed_now, false);
    assert.equal(result.development_freeze_fail_closed_rows.every((row) => row.fixture_status === "pass" && row.pass_promotion_allowed_now === false && row.secret_read_allowed_now === false), true);
    assert.equal(result.development_freeze_closeout_rows.every((row) => row.closeout_status === "ready_for_zendd_development_freeze_cockpit" && row.unsafe_flag_count === 0), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd development freeze cockpit --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-freeze-cockpit-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-development-freeze-cockpit.json");
    const sentinel = "{ \"sentinel\": \"zendd-development-freeze-cockpit\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddDevelopmentFreezeCockpit({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
