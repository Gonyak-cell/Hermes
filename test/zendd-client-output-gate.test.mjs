import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddClientOutputGate } from "../src/zendd-client-output-gate.mjs";

const execFileAsync = promisify(execFile);

test("zendd client output gate binds protected output claims to source, citation, quality, and receipt refs", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-client-output-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddClientOutputGate({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_client_output_gate_status, "ready_for_operator_surface_bridge");
    assert.equal(result.summary.phase_range, "P641-P660");
    assert.equal(result.client_output_gate_policy.protected_client_output_pass_allowed, false);
    assert.equal(result.client_output_gate_policy.weak_korean_language_can_pass, false);
    assert.equal(result.client_output_claim_rows.length, 6);
    assert.equal(result.client_output_claim_rows.every((row) => row.source_trace_ref && row.fact_claim_ref && row.citation_ref && row.human_receipt_ref && row.current_verdict === "blocked"), true);
    assert.equal(result.client_output_gate_rows.every((row) => row.gate_status === "pass"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd client output gate fail-closes Korean quality, citation, exposure, and receipts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-client-output-fail-closed-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddClientOutputGate({ zenddProjectRoot: zenddRoot, write: false, check: true });
    const qualityChecks = new Set(result.korean_language_quality_rows.map((row) => row.quality_check_id));
    const exposureChecks = new Set(result.client_exposure_control_rows.map((row) => row.exposure_check_id));

    assert.equal(result.validation.valid, true);
    assert.equal(qualityChecks.has("korean_particle_quality"), true);
    assert.equal(qualityChecks.has("no_internal_review_placeholder"), true);
    assert.equal(result.korean_language_quality_rows.every((row) => row.pass_without_quality_evidence_allowed === false && row.current_verdict === "blocked"), true);
    assert.equal(result.citation_gate_rows.every((row) => row.citation_required && row.citationless_legal_conclusion_can_pass === false), true);
    assert.equal(exposureChecks.has("raw_client_doc_exposure"), true);
    assert.equal(exposureChecks.has("privileged_detail_exposure"), true);
    assert.equal(result.client_exposure_control_rows.every((row) => row.unsafe_exposure_allowed === false && row.current_verdict === "blocked"), true);
    assert.equal(result.client_receipt_binding_rows.every((row) => row.receipt_payload_present === false && row.protected_pass_allowed_without_receipt === false), true);
    assert.equal(result.client_output_freeze_rows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd client output gate --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-client-output-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-client-output-gate.json");
    const sentinel = "{ \"sentinel\": \"zendd-client-output-gate\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddClientOutputGate({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
