import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { runZenddDevHarness } from "../src/zendd-dev-harness.mjs";

const execFileAsync = promisify(execFile);

test("zendd dev harness maps Hermes dev functions without allowing Zendd mutation", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-dev-harness-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const result = await runZenddDevHarness({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.summary.zendd_dev_harness_status, "ready_for_command_evidence_bridge");
    assert.equal(result.summary.phase_range, "P541-P560");
    assert.equal(result.project_dev_profile.project_id, "project.zendd");
    assert.equal(result.project_dev_profile.domain_pack_id, "law-firm");
    assert.equal(result.project_dev_profile.zendd_mutation_allowed, false);
    assert.equal(result.project_dev_profile.worktree_creation_allowed, false);
    assert.equal(result.project_dev_profile.command_execution_allowed, false);
    assert.equal(result.work_order_policy.direct_edit_allowed, false);
    assert.ok(result.work_order_policy.required_fields.includes("evidence_ref"));
    assert.ok(result.work_order_policy.protected_work_order_required_fields.includes("human_receipt_ref"));
    assert.equal(result.lane_policy_rows.every((row) => !row.lane_creation_allowed_now && !row.worktree_creation_allowed_now), true);
    assert.equal(result.test_command_candidate_rows.every((row) => !row.execution_allowed_now && row.evidence_ref === null), true);
    assert.ok(result.test_command_candidate_rows.some((row) => row.script_name === "test" && row.verdict === "candidate_not_executed"));
    assert.equal(result.protected_route_rows.every((row) => row.protected && !row.pass_without_receipt_allowed), true);
    assert.equal(result.mutation_preflight.current_verdict, "blocked");
    assert.equal(result.hermes_function_coverage_rows.length, 10);
    assert.ok(result.hermes_function_coverage_rows.some((row) => row.function_id === "operator_status" && row.current_verdict === "ready_read_only"));
    assert.ok(result.dev_harness_gate_rows.every((row) => row.gate_status === "pass"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd dev harness keeps dirty external changes behind work order and receipt policy", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-dev-dirty-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    await writeFile(path.join(zenddRoot, "backend/app/services/new_service.py"), "def pending(): pass\n", "utf8");

    const result = await runZenddDevHarness({ zenddProjectRoot: zenddRoot, write: false, check: true });

    assert.equal(result.validation.valid, true);
    assert.equal(result.work_order_policy.dirty_tree_review_required, true);
    assert.equal(result.mutation_preflight.mutation_allowed_now, false);
    assert.ok(result.mutation_preflight.required_to_unblock.includes("dirty_tree_review_receipt"));
    assert.equal(result.operator_status_rows.some((row) => row.status_id === "zendd.status.dirty_tree" && row.next_allowed_action.includes("dirty-tree")), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("zendd dev harness --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "hermes-zendd-dev-check-"));
  try {
    const zenddRoot = await createZenddFixture(root);
    const outDir = path.join(root, "out");
    await mkdir(outDir, { recursive: true });
    const sentinelPath = path.join(outDir, "zendd-dev-harness.json");
    const sentinel = "{ \"sentinel\": \"zendd-dev-harness\" }\n";
    await writeFile(sentinelPath, sentinel, "utf8");

    await runZenddDevHarness({ zenddProjectRoot: zenddRoot, outDir, write: false, check: true });

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
