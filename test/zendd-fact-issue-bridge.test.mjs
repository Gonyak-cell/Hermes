import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddFactIssueBridge } from "../src/zendd-fact-issue-bridge.mjs";

const execFileAsync = promisify(execFile);

test("zendd fact issue bridge binds fact claims to source contract evidence", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-fact-issue-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddFactIssueBridge({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_fact_issue_bridge_status, "ready_for_review_receipt_bridge");
    assert.equal(result.summary.phase_range, "P601-P620");
    assert.equal(result.fact_issue_bridge_policy.auto_pass_allowed, false);
    assert.equal(result.fact_issue_bridge_policy.raw_fact_text_storage_allowed_in_hermes, false);
    assert.equal(result.fact_claim_rows.length, 8);
    assert.equal(result.fact_claim_rows.every((row) => row.fact_ref && row.source_contract_id && row.evidence_ref && row.raw_fact_text_storage_allowed_in_hermes === false), true);
    assert.equal(result.issue_bridge_rows.length, result.fact_claim_rows.length);
    assert.equal(result.issue_bridge_rows.every((row) => row.linked_fact_claim_id && row.missing_evidence_surface), true);
    assert.equal(result.fact_issue_gate_rows.every((row) => row.gate_status === "pass"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd fact issue bridge fail-closes confidence and conflict claims", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-fact-conflict-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddFactIssueBridge({ zenddProjectRoot: zenddRoot, write: false, check: true });
    const conflictReasons = new Set(result.conflict_fixture_rows.map((row) => row.block_reason));

    assert.equal(result.validation.valid, true);
    assert.equal(result.fact_confidence_policy.auto_pass_allowed, false);
    assert.equal(result.fact_confidence_policy.low_confidence_can_pass, false);
    assert.equal(result.fact_confidence_policy.conflicting_source_can_pass, false);
    assert.equal(conflictReasons.has("missing_source_span"), true);
    assert.equal(conflictReasons.has("contradictory_source"), true);
    assert.equal(conflictReasons.has("unsupported_client_sentence"), true);
    assert.equal(result.conflict_fixture_rows.every((row) => row.current_verdict === "blocked" && row.next_allowed_action), true);
    assert.equal(result.fact_issue_review_binding_rows.every((row) => !row.pass_without_review_allowed && !row.pass_without_receipt_allowed), true);
    assert.equal(result.fact_issue_freeze_rows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd fact issue bridge --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-fact-issue-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-fact-issue-bridge.json");
    const sentinel = "{ \"sentinel\": \"zendd-fact-issue-bridge\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddFactIssueBridge({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
