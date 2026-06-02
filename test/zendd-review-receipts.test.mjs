import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddReviewReceipts } from "../src/zendd-review-receipts.mjs";

const execFileAsync = promisify(execFile);

test("zendd review receipts creates receipt templates without granting protected PASS", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-review-receipts-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddReviewReceipts({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_review_receipts_status, "ready_for_client_output_gate_fusion");
    assert.equal(result.summary.phase_range, "P621-P640");
    assert.equal(result.review_receipt_policy.protected_pass_allowed_without_receipt, false);
    assert.equal(result.review_receipt_policy.receipt_payload_present, false);
    assert.equal(result.receipt_template_rows.length, result.fact_issue_summary.fact_claim_row_count + result.fact_issue_summary.issue_bridge_row_count);
    assert.equal(result.receipt_template_rows.every((row) => row.receipt_template_ref && row.receipt_payload_present === false && row.pass_without_receipt_allowed === false), true);
    assert.equal(result.receipt_queue_rows.every((row) => row.queue_status === "queued_pending_human_input" && row.receipt_payload_present === false), true);
    assert.equal(result.review_receipt_gate_rows.every((row) => row.gate_status === "pass"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd review receipts keeps validation, workspaces, approval, and closeout future-only", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-review-receipts-future-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddReviewReceipts({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.receipt_validation_rule_rows.every((row) => row.validation_allowed_now === false && row.receipt_payload_present === false), true);
    assert.equal(result.receipt_workspace_rows.every((row) => row.workspace_materialized_now === false && row.receipt_input_materialized === false), true);
    assert.equal(result.receipt_approval_plan_rows.every((row) => row.approval_application_allowed_now === false && row.receipt_payload_present === false), true);
    assert.equal(result.receipt_closeout_rows.every((row) => row.receipt_validated === false && row.protected_pass_allowed === false), true);
    assert.equal(result.receipt_freeze_rows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd review receipts --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-review-receipts-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-review-receipts.json");
    const sentinel = "{ \"sentinel\": \"zendd-review-receipts\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddReviewReceipts({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
