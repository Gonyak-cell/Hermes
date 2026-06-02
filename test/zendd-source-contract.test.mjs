import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddSourceContract } from "../src/zendd-source-contract.mjs";

const execFileAsync = promisify(execFile);

test("zendd source contract bridges VDR/LDD sources as reference-only claims", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-source-contract-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddSourceContract({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_source_contract_status, "ready_for_fact_issue_bridge");
    assert.equal(result.summary.phase_range, "P581-P600");
    assert.equal(result.source_contract_policy.raw_material_copy_allowed_in_hermes, false);
    assert.equal(result.source_contract_policy.source_pass_requires.includes("stable_source_ref"), true);
    assert.equal(result.vdr_ldd_source_contract_rows.length, 8);
    assert.equal(result.vdr_ldd_source_contract_rows.every((row) => row.stable_source_ref && row.evidence_ref && row.redacted_summary_ref), true);
    assert.equal(result.vdr_ldd_source_contract_rows.every((row) => row.raw_material_copy_allowed_in_hermes === false), true);
    assert.equal(result.source_reference_policy.blocked_hermes_fields.includes("raw_vdr_payload"), true);
    assert.equal(result.source_reference_policy.blocked_hermes_fields.includes("raw_client_document"), true);
    assert.equal(result.source_pass_block_policy.protected_pass_allowed_without_receipt, false);
    assert.equal(result.source_freeze_rows.every((row) => row.current_verdict === "blocked" && row.next_allowed_action), true);
    assert.equal(result.source_contract_gate_rows.every((row) => row.gate_status === "pass"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd source contract records resource gate and VDR/LDD gate differences", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-source-comparison-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddSourceContract({ zenddProjectRoot: zenddRoot, write: false, check: true });
    const directions = new Set(result.cross_gate_improvement_rows.map((row) => row.direction));

    assert.equal(result.validation.valid, true);
    assert.ok(result.gate_comparison_rows.some((row) => row.hermes_gate.includes("resource") && row.zendd_gate.includes("vdr")));
    assert.ok(result.gate_comparison_rows.some((row) => row.zendd_gate.includes("ldd") && row.hermes_improvement_action.includes("source-control")));
    assert.equal(directions.has("hermes_from_zendd"), true);
    assert.equal(directions.has("zendd_from_hermes"), true);
    assert.equal(directions.has("mutual_hardening"), true);
    assert.equal(result.cross_gate_improvement_rows.every((row) => row.current_verdict === "documented_improvement" && row.next_allowed_action), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd source contract --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-source-contract-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-source-contract.json");
    const sentinel = "{ \"sentinel\": \"zendd-source-contract\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddSourceContract({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
