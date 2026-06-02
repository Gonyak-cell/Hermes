import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddWorkOrderIntake } from "../src/zendd-work-order-intake.mjs";

const execFileAsync = promisify(execFile);

test("zendd work order intake converts request classes into planning and protected rows", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-work-order-intake-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddWorkOrderIntake({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_work_order_intake_status, "ready_for_zendd_work_order_intake");
    assert.equal(result.summary.source_frontend_operation_status, "ready_for_zendd_frontend_operation_shell");
    assert.equal(result.summary.work_order_row_count, 10);
    assert.equal(result.summary.planning_pass_work_order_count, 3);
    assert.equal(result.summary.protected_work_order_block_count, 7);
    assert.equal(result.summary.zendd_mutation_allowed_now, false);
    assert.equal(result.summary.command_execution_allowed_now, false);
    assert.equal(result.work_order_rows.filter((row) => row.current_verdict === "pass").every((row) => row.work_order_status === "accepted_for_planning_only" && !row.zendd_mutation_allowed_now), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd work order intake keeps protected work orders documented as BLOCK", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-work-order-intake-blocks-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddWorkOrderIntake({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.protected_work_order_block_rows.length, 7);
    assert.equal(result.protected_work_order_block_rows.every((row) => row.current_verdict === "blocked"), true);
    assert.equal(result.protected_work_order_block_rows.every((row) => row.block_reason && row.responsible_owner && row.evidence_ref), true);
    assert.equal(result.protected_work_order_block_rows.every((row) => row.hard_gate_ref && row.human_receipt_required && row.human_receipt_ref), true);
    assert.equal(result.protected_work_order_block_rows.every((row) => row.rollback_target_ref && row.next_allowed_action), true);
    assert.equal(result.work_order_route_rows.every((row) => row.read_only && row.server_started === false && row.protected_action_execution_allowed === false), true);
    assert.equal(result.work_order_intake_closeout_rows.every((row) => row.protected_work_orders_blocked && !row.protected_action_execution_allowed), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd work order intake --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-work-order-intake-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-work-order-intake.json");
    const sentinel = "{ \"sentinel\": \"zendd-work-order-intake\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddWorkOrderIntake({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
