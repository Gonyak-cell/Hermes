import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlatformControlledWriteOperatorConsoleV2,
  runPlatformControlledWriteOperatorConsoleV2,
} from "../src/platform-controlled-write-operator-console-v2.mjs";

const RUN_AT = "2026-06-04T00:00:00.000Z";
const resultPromise = buildPlatformControlledWriteOperatorConsoleV2({ runAt: RUN_AT, write: false });

test("Controlled write and operator console v2 consumes human-approved limited execution", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_controlled_write_operator_console_v2_status, "ready_for_platform_controlled_write_operator_console_v2");
  assert.equal(result.summary.source_limited_execution_status, "ready_for_platform_human_approved_limited_execution");
  assert.equal(result.controlled_write_operator_console_anchor.program_range, "P2401-P2560");
  assert.equal(result.controlled_write_operator_console_anchor.previous_phase_slot, "P2400");
  assert.equal(result.controlled_write_operator_console_anchor.next_phase_slot, "P2561");
});

test("Controlled write and operator console v2 emits patch, review, receipt, validation, rollback, console, and owner rows", async () => {
  const result = await resultPromise;

  assert.equal(result.controlled_write_component_rows.length, 8);
  assert.equal(result.patch_candidate_rows.length, 7);
  assert.equal(result.diff_review_packet_rows.length, 6);
  assert.equal(result.patch_apply_receipt_rows.length, 6);
  assert.equal(result.post_apply_validation_rows.length, 6);
  assert.equal(result.rollback_target_rows.length, 5);
  assert.equal(result.operator_console_action_rows.length, 7);
  assert.equal(result.pass_owner_rows.length, 5);
  assert.equal(result.controlled_write_handoff_rows.length, 3);
  assert.equal(result.controlled_write_guard_rows.length, 12);
});

test("Controlled write and operator console v2 keeps patch and apply lanes closed", async () => {
  const result = await resultPromise;

  assert.equal(result.patch_candidate_rows.every((row) => row.generated_patch_required === true && row.patch_generated_now === false), true);
  assert.equal(result.patch_candidate_rows.every((row) => row.direct_apply_allowed_now === false && row.write_action_allowed_now === false), true);
  assert.equal(result.diff_review_packet_rows.every((row) => row.review_required === true && row.apply_allowed_without_review === false), true);
  assert.equal(result.patch_apply_receipt_rows.every((row) => row.human_receipt_required === true && row.receipt_applied_now === false), true);
  assert.equal(result.post_apply_validation_rows.every((row) => row.post_apply_required === true && row.validation_run_now === false), true);
  assert.equal(result.rollback_target_rows.every((row) => row.rollback_target_required === true && row.rollback_executed_now === false), true);
});

test("Controlled write and operator console v2 projects a read-only operator surface with human PASS owners", async () => {
  const result = await resultPromise;

  assert.equal(result.operator_console_action_rows.every((row) => row.method === "GET" && row.mutation_route === false), true);
  assert.equal(result.operator_console_action_rows.every((row) => row.patch_apply_route === false && row.receipt_application_route === false), true);
  assert.equal(result.pass_owner_rows.every((row) => row.owner_required === true && row.agent_final_pass_allowed === false), true);
  assert.equal(result.pass_owner_rows.every((row) => row.human_final_authority_required === true && row.pass_visible_in_console === true), true);
});

test("Controlled write and operator console v2 prepares P2561 handoff without unsafe authority", async () => {
  const result = await resultPromise;
  const boundary = result.controlled_write_boundary;

  assert.equal(boundary.controlled_write_contract_ready, true);
  assert.equal(boundary.operator_console_v2_projection_ready, true);
  assert.equal(boundary.patch_candidate_generation_allowed_with_receipt, true);
  assert.equal(boundary.p2561_ready_as_next_goal, true);
  assert.equal(boundary.patch_generated_now, false);
  assert.equal(boundary.patch_applied_now, false);
  assert.equal(boundary.mutation_performed, false);
  assert.equal(boundary.receipt_applied_now, false);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.direct_write_allowed_now, false);
  assert.equal(boundary.protected_action_execution_allowed_now, false);
  assert.equal(boundary.agent_final_pass_allowed_now, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Controlled write and operator console v2 --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "platform-controlled-write-operator-console-v2-"));
  const sentinelPath = path.join(outDir, "platform-controlled-write-operator-console-v2.json");
  const sentinel = "{ \"sentinel\": \"platform-controlled-write-operator-console-v2\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlatformControlledWriteOperatorConsoleV2({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
