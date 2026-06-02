import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddOperatorSurface } from "../src/zendd-operator-surface.mjs";

const execFileAsync = promisify(execFile);

test("zendd operator surface exposes P521-P660 claims with block reasons and next actions", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-operator-surface-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddOperatorSurface({ zenddProjectRoot: zenddRoot, write: false, check: true });
    const blockedRows = result.zendd_operator_claim_rows.filter((row) => row.verdict_family === "blocked");

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_operator_surface_status, "ready_for_release_recovery_bridge");
    assert.equal(result.summary.phase_range, "P661-P680");
    assert.ok(result.zendd_operator_claim_rows.length >= 80);
    assert.ok(blockedRows.length > 0);
    assert.equal(blockedRows.every((row) => row.block_reason && row.responsible_owner && row.next_allowed_action), true);
    assert.equal(result.zendd_operator_claim_rows.every((row) => row.claim_id && row.current_verdict && Array.isArray(row.missing_evidence) && row.hard_gate_result !== undefined), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd operator surface projects missing inputs, dashboard rows, and API rows without mutation", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-operator-surface-projection-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddOperatorSurface({ zenddProjectRoot: zenddRoot, write: false, check: true });
    const filterKeys = new Set(result.zendd_operator_filter_rows.map((row) => row.row_key));
    const missingTypes = new Set(result.zendd_operator_missing_input_rows.map((row) => row.missing_input_type));
    const apiRoutes = new Set(result.zendd_operator_api_projection_rows.map((row) => row.route_path));

    assert.equal(result.validation.valid, true);
    assert.equal(filterKeys.has("missing_evidence"), true);
    assert.equal(filterKeys.has("missing_human_receipt"), true);
    assert.equal(missingTypes.has("evidence"), true);
    assert.equal(missingTypes.has("human_receipt"), true);
    assert.equal(apiRoutes.has("/api/project-zendd/operator-claims"), true);
    assert.equal(apiRoutes.has("/api/project-zendd/operator-next-actions"), true);
    assert.equal(result.zendd_operator_dashboard_projection_rows.every((row) => row.visible_fields.includes("block_reason") && row.visible_fields.includes("next_allowed_action")), true);
    assert.equal(result.zendd_operator_surface_boundary.server_started, false);
    assert.equal(result.zendd_operator_surface_boundary.zendd_command_executed, false);
    assert.equal(result.zendd_operator_surface_boundary.raw_material_copied, false);
    assert.equal(result.zendd_operator_surface_boundary.receipt_applied, false);
    assert.equal(result.zendd_operator_surface_boundary.pass_promotion_performed, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd operator surface --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-operator-surface-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-operator-surface.json");
    const sentinel = "{ \"sentinel\": \"zendd-operator-surface\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddOperatorSurface({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
