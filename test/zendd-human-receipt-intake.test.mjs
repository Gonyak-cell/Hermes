import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddHumanReceiptIntake } from "../src/zendd-human-receipt-intake.mjs";

const execFileAsync = promisify(execFile);

test("zendd human receipt intake creates templates and queues without payloads", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-human-receipt-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddHumanReceiptIntake({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_human_receipt_intake_status, "ready_for_zendd_human_receipt_intake");
    assert.equal(result.summary.source_vdr_ldd_workflow_adapter_status, "ready_for_zendd_vdr_ldd_workflow_adapter");
    assert.equal(result.summary.source_protected_action_escalation_status, "ready_for_zendd_protected_action_escalation");
    assert.equal(result.summary.receipt_template_count >= 20, true);
    assert.equal(result.summary.receipt_queue_count, result.summary.receipt_template_count);
    assert.equal(result.summary.receipt_validation_packet_count, result.summary.receipt_template_count);
    assert.equal(result.zendd_receipt_template_rows.every((row) => row.current_verdict === "blocked" && row.receipt_payload_present === false && row.synthetic_receipt_allowed === false), true);
    assert.equal(result.zendd_receipt_queue_rows.every((row) => row.queue_status === "queued_pending_human_input" && row.receipt_payload_present === false), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd human receipt intake quarantines unsafe receipts and blocks approval closeout", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-human-receipt-blocks-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddHumanReceiptIntake({ zenddProjectRoot: zenddRoot, write: false, check: true });

    const quarantineReasons = new Set(result.zendd_receipt_quarantine_rows.map((row) => row.quarantine_reason));
    assert.equal(quarantineReasons.has("synthetic_receipt"), true);
    assert.equal(quarantineReasons.has("raw_vdr_attachment"), true);
    assert.equal(quarantineReasons.has("secret_value_payload"), true);
    assert.equal(result.zendd_receipt_quarantine_rows.every((row) => row.quarantine_required === true && row.receipt_application_allowed_now === false && row.current_verdict === "blocked"), true);
    assert.equal(result.zendd_receipt_approval_closeout_rows.every((row) => row.human_receipt_ref_status === "missing" && row.receipt_validated === false && row.protected_pass_allowed_now === false), true);
    assert.equal(result.zendd_receipt_fail_closed_rows.every((row) => row.fixture_status === "pass" && row.receipt_application_allowed_now === false && row.synthetic_receipt_allowed === false), true);
    assert.equal(result.summary.receipt_payload_present, false);
    assert.equal(result.summary.receipt_application_allowed_now, false);
    assert.equal(result.summary.protected_pass_allowed_now, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd human receipt intake --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-human-receipt-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-human-receipt-intake.json");
    const sentinel = "{ \"sentinel\": \"zendd-human-receipt-intake\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddHumanReceiptIntake({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
