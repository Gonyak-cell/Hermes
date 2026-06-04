import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformHumanApprovedLimitedExecution,
  runPlatformHumanApprovedLimitedExecution,
} from "../src/platform-human-approved-limited-execution.mjs";

const RUN_AT = "2026-06-04T00:00:00.000Z";
const resultPromise = buildPlatformHumanApprovedLimitedExecution({ runAt: RUN_AT, write: false });

test("Human-approved limited execution consumes runtime governance restore", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_human_approved_limited_execution_status, "ready_for_platform_human_approved_limited_execution");
  assert.equal(result.summary.source_runtime_governance_status, "ready_for_platform_runtime_governance_restore");
  assert.equal(result.limited_execution_anchor.program_range, "P2241-P2400");
  assert.equal(result.limited_execution_anchor.previous_phase_slot, "P2240");
  assert.equal(result.limited_execution_anchor.next_phase_slot, "P2401");
});

test("Human-approved limited execution emits receipt, allowlist, sandbox, redaction, timeout, rollback, and closeout contracts", async () => {
  const result = await resultPromise;

  assert.equal(result.limited_execution_component_rows.length, 7);
  assert.equal(result.execution_receipt_rows.length, 7);
  assert.equal(result.allowlist_command_rows.length, 8);
  assert.equal(result.sandbox_policy_rows.length, 5);
  assert.equal(result.redaction_policy_rows.length, 5);
  assert.equal(result.timeout_policy_rows.length, 4);
  assert.equal(result.rollback_binding_rows.length, 5);
  assert.equal(result.execution_closeout_rows.length, 6);
  assert.equal(result.limited_execution_handoff_rows.length, 3);
  assert.equal(result.limited_execution_guard_rows.length, 12);
});

test("Human-approved limited execution keeps all command candidates non-executing", async () => {
  const result = await resultPromise;

  assert.equal(result.execution_receipt_rows.every((row) => row.requires_human_owner === true && row.receipt_applied_now === false), true);
  assert.equal(result.allowlist_command_rows.every((row) => row.command_execution_allowed_now === false && row.mutation_allowed_now === false), true);
  assert.equal(result.sandbox_policy_rows.every((row) => row.global_install_allowed === false && row.home_secret_read_allowed === false), true);
  assert.equal(result.redaction_policy_rows.every((row) => row.raw_secret_allowed === false && row.raw_material_allowed === false), true);
  assert.equal(result.timeout_policy_rows.every((row) => row.timeout_required === true && row.command_execution_allowed_now === false), true);
  assert.equal(result.rollback_binding_rows.every((row) => row.rollback_target_required === true && row.rollback_mutation_allowed_without_receipt === false), true);
  assert.equal(result.execution_closeout_rows.every((row) => row.evidence_ref_required === true && row.closeout_completed_now === false), true);
});

test("Human-approved limited execution prepares P2401 handoff without unsafe authority", async () => {
  const result = await resultPromise;
  const boundary = result.limited_execution_boundary;

  assert.equal(boundary.limited_execution_lane_ready, true);
  assert.equal(boundary.execution_candidate_allowed_with_receipt, true);
  assert.equal(boundary.p2401_ready_as_next_goal, true);
  assert.equal(boundary.command_executed_now, false);
  assert.equal(boundary.mutation_performed, false);
  assert.equal(boundary.receipt_applied_now, false);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.protected_action_execution_allowed_now, false);
  assert.equal(boundary.receipt_application_allowed_now, false);
  assert.equal(boundary.raw_material_access_allowed_now, false);
  assert.equal(boundary.agent_final_pass_allowed_now, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Human-approved limited execution --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-human-approved-limited-execution-"));
  const sentinelPath = path.join(outDir, "platform-human-approved-limited-execution.json");
  const sentinel = "{ \"sentinel\": \"platform-human-approved-limited-execution\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformHumanApprovedLimitedExecution({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
