import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddVdrLddWorkflowAdapter } from "../src/zendd-vdr-ldd-workflow-adapter.mjs";

const execFileAsync = promisify(execFile);

test("zendd VDR/LDD workflow adapter binds workflow claims through refs only", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-vdr-ldd-workflow-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddVdrLddWorkflowAdapter({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_vdr_ldd_workflow_adapter_status, "ready_for_zendd_vdr_ldd_workflow_adapter");
    assert.equal(result.summary.source_client_output_gate_status, "ready_for_operator_surface_bridge");
    assert.equal(result.summary.source_release_candidate_sandbox_status, "ready_for_zendd_release_candidate_sandbox");
    assert.equal(result.summary.vdr_ldd_workflow_adapter_count, 6);
    assert.equal(result.summary.vdr_ldd_source_span_mapping_count, result.summary.vdr_ldd_workflow_adapter_count);
    assert.equal(result.vdr_ldd_workflow_adapter_rows.every((row) => row.current_verdict === "blocked" && row.source_span_preserved === true && row.citation_gate_preserved === true), true);
    assert.equal(result.vdr_ldd_workflow_adapter_rows.every((row) => row.workflow_adapter_ref && row.source_trace_ref && row.fact_claim_ref && row.human_receipt_ref), true);
    assert.equal(result.vdr_ldd_source_span_mapping_rows.every((row) => row.raw_source_text_present === false && row.redacted_summary_ref && row.evidence_ref), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd VDR/LDD workflow adapter blocks raw material, legal PASS, and delivery", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-vdr-ldd-workflow-blocks-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddVdrLddWorkflowAdapter({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.summary.automatic_legal_pass_allowed, false);
    assert.equal(result.summary.raw_vdr_material_copy_allowed_in_hermes, false);
    assert.equal(result.summary.raw_client_document_copy_allowed_in_hermes, false);
    assert.equal(result.summary.client_output_generation_allowed_now, false);
    assert.equal(result.summary.client_delivery_allowed_now, false);
    assert.equal(result.vdr_ldd_quality_privilege_gate_rows.every((row) => row.quality_gate_passed === false && row.privilege_gate_passed === false && row.human_receipt_payload_present === false), true);
    assert.equal(result.vdr_ldd_operator_claim_surface_rows.every((row) => row.missing_evidence.length >= 4 && row.missing_reviewer_or_receipt.includes("validated_human_receipt") && row.next_allowed_action), true);
    assert.equal(result.vdr_ldd_workflow_fail_closed_rows.every((row) => row.fixture_status === "pass" && row.automatic_legal_pass_allowed === false), true);
    assert.equal(result.vdr_ldd_workflow_closeout_rows[0].workflow_adapter_ready, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd VDR/LDD workflow adapter --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-vdr-ldd-workflow-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-vdr-ldd-workflow-adapter.json");
    const sentinel = "{ \"sentinel\": \"zendd-vdr-ldd-workflow-adapter\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddVdrLddWorkflowAdapter({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
