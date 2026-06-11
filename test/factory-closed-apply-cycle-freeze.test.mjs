import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFactoryClosedApplyCycleFreeze,
  runFactoryClosedApplyCycleFreeze,
} from "../src/factory-closed-apply-cycle-freeze.mjs";
import { buildFactoryApplyEngineClosed } from "../src/factory-apply-engine-closed.mjs";

const RUN_AT = "2026-06-12T13:00:00.000Z";

test("Factory Closed Apply Cycle Freeze binds FD.2 and FD.4 without opening runtime", async () => {
  const result = await buildFactoryClosedApplyCycleFreeze({
    runAt: RUN_AT,
    write: false,
    commitRef: "4fb850f",
  });

  assert.equal(result.schema_version, "factory-closed-apply-cycle-freeze.v1");
  assert.equal(result.program_range, "FCORE-FD.5");
  assert.equal(result.source_program_range, "FCORE-FD.2-FD.4");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.factory_closed_apply_cycle_freeze_status, "ready_factory_closed_apply_cycle_freeze");
  assert.equal(result.summary.closed_apply_cycle_count, 3);
  assert.equal(result.summary.closed_apply_cycle_ready_count, 3);
  assert.equal(result.summary.negative_fixture_count, 5);
  assert.equal(result.summary.negative_fixture_blocked_count, 5);
  assert.equal(result.summary.receipt_chain_audit_not_ready_rejected, true);
  assert.equal(result.summary.apply_engine_opened_attempt_rejected, true);
  assert.equal(result.summary.rollback_executor_opened_attempt_rejected, true);
  assert.equal(result.summary.post_apply_state_mutation_observed_rejected, true);
  assert.equal(result.summary.receipt_chain_negative_fixture_drop_rejected, true);
  assert.equal(result.summary.receipt_apply_engine_reachable_now, false);
  assert.equal(result.summary.apply_cycle_runtime_enabled_now, false);
  assert.equal(result.summary.apply_engine_runtime_enabled_now, false);
  assert.equal(result.summary.rollback_executor_runtime_enabled_now, false);
  assert.equal(result.summary.runtime_state_mutated_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
});

test("Factory Closed Apply Cycle Freeze exposes concrete cycle checks and blocked fixtures", async () => {
  const result = await buildFactoryClosedApplyCycleFreeze({
    runAt: RUN_AT,
    write: false,
    commitRef: "4fb850f",
  });

  assert.equal(result.factory_closed_apply_cycle_rows.every((row) => row.checks.receipt_chain_audit_ready), true);
  assert.equal(result.factory_closed_apply_cycle_rows.every((row) => row.checks.fd2_chain_row_ready), true);
  assert.equal(result.factory_closed_apply_cycle_rows.every((row) => row.checks.apply_intent_blocked_closed_engine), true);
  assert.equal(result.factory_closed_apply_cycle_rows.every((row) => row.checks.rollback_blocked_closed_executor), true);
  assert.equal(result.factory_closed_apply_cycle_rows.every((row) => row.post_apply_verification_result === "blocked_no_state_mutation_to_verify"), true);

  const fixtures = new Map(result.factory_closed_apply_cycle_negative_fixture_rows.map((row) => [row.fixture_key, row]));
  assert.equal(fixtures.get("receipt_chain_audit_not_ready").actual_result, "cycle_blocked");
  assert.ok(fixtures.get("receipt_chain_audit_not_ready").observed_blocked_checks.includes("receipt_chain_audit_ready"));
  assert.equal(fixtures.get("apply_engine_opened_attempt").actual_result, "cycle_blocked");
  assert.ok(fixtures.get("apply_engine_opened_attempt").observed_blocked_checks.includes("apply_intent_blocked_closed_engine"));
  assert.equal(fixtures.get("rollback_executor_opened_attempt").actual_result, "cycle_blocked");
  assert.ok(fixtures.get("rollback_executor_opened_attempt").observed_blocked_checks.includes("rollback_blocked_closed_executor"));
  assert.equal(fixtures.get("post_apply_state_mutation_observed").actual_result, "cycle_blocked");
  assert.ok(fixtures.get("post_apply_state_mutation_observed").observed_blocked_checks.includes("post_apply_verification_blocked_no_mutation"));
});

test("Factory Closed Apply Cycle Freeze blocks inconsistent FD.2 source input end-to-end", async () => {
  const applyEngineClosed = await buildFactoryApplyEngineClosed({
    runAt: RUN_AT,
    write: false,
    commitRef: "4fb850f",
  });
  applyEngineClosed.factory_apply_intent_rows[0] = {
    ...applyEngineClosed.factory_apply_intent_rows[0],
    apply_intent_status: "ready_apply_engine_opened",
    apply_engine_invoked_now: true,
    apply_allowed_now: true,
    apply_engine_runtime_enabled_now: true,
  };

  const result = await buildFactoryClosedApplyCycleFreeze({
    runAt: RUN_AT,
    write: false,
    commitRef: "4fb850f",
    applyEngineClosed,
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.factory_closed_apply_cycle_freeze_status, "blocked_factory_closed_apply_cycle_freeze");
  assert.equal(result.summary.closed_apply_cycle_ready_count < result.summary.closed_apply_cycle_count, true);
  assert.equal(result.validation.errors.some((error) => error.item_id === "cycle.rows.ready"), true);
  assert.equal(result.validation.errors.some((error) => error.item_id === "cycle.rows.authority_closed"), true);
});

test("Factory Closed Apply Cycle Freeze writes closeout artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-closed-apply-cycle-freeze-out-"));
  try {
    const result = await runFactoryClosedApplyCycleFreeze({
      outDir,
      runAt: RUN_AT,
      check: false,
      requirePass: true,
      commitRef: "4fb850f",
    });
    const artifact = JSON.parse(await readFile(path.join(outDir, "factory-closed-apply-cycle-freeze.json"), "utf8"));
    const cycleRows = JSON.parse(await readFile(path.join(outDir, "closed-apply-cycle-rows.json"), "utf8"));
    const negativeRows = JSON.parse(await readFile(path.join(outDir, "negative-fixture-rows.json"), "utf8"));
    const boundary = JSON.parse(await readFile(path.join(outDir, "boundary.json"), "utf8"));

    assert.equal(result.summary.factory_closed_apply_cycle_freeze_status, "ready_factory_closed_apply_cycle_freeze");
    assert.equal(artifact.summary.closed_apply_cycle_ready_count, 3);
    assert.equal(cycleRows.count, 3);
    assert.equal(negativeRows.count, 5);
    assert.equal(boundary.apply_cycle_runtime_enabled_now, false);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Factory Closed Apply Cycle Freeze --check does not overwrite existing artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "factory-closed-apply-cycle-freeze-check-"));
  try {
    const sentinelPath = path.join(outDir, "factory-closed-apply-cycle-freeze.json");
    const sentinel = '{ "sentinel": "factory-closed-apply-cycle-freeze" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/factory-closed-apply-cycle-freeze.mjs",
      "--check",
      "--require-pass",
      "--out-dir",
      outDir,
      "--run-at",
      RUN_AT,
      "--commit-ref",
      "4fb850f",
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
