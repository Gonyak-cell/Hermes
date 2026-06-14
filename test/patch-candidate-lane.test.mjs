import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPatchCandidateLane,
  runPatchCandidateLane,
} from "../src/patch-candidate-lane.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P12400_READY = {
  schema_version: "controlled-execution-sandbox.v1",
  program_range: "P12201-P12400",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    controlled_execution_sandbox_status: "ready_for_controlled_execution_sandbox",
    ready_for_p12401_handoff: true,
    allowlist_command_count: 8,
    sandbox_policy_count: 6,
    claude_execution_review_receipt_present_now: true,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
  controlled_execution_boundary: {
    ready_for_p12401_handoff: true,
    actual_command_executed_now: false,
    runtime_execution_allowed_now: false,
    write_control_enabled: false,
    protected_action_enabled: false,
    connector_write_enabled: false,
    final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
};

const P12400_BLOCKED = {
  schema_version: "controlled-execution-sandbox.v1",
  program_range: "P12201-P12400",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    controlled_execution_sandbox_status: "blocked_controlled_execution_sandbox",
    ready_for_p12401_handoff: false,
    allowlist_command_count: 8,
    sandbox_policy_count: 6,
    claude_execution_review_receipt_present_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
  controlled_execution_boundary: {
    ready_for_p12401_handoff: false,
    actual_command_executed_now: false,
    runtime_execution_allowed_now: false,
    write_control_enabled: false,
    protected_action_enabled: false,
    connector_write_enabled: false,
    final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
};

const CLAUDE_PATCH_REVIEW_READY = {
  schema_version: "patch-candidate-lane-claude-review-receipt.v1",
  review_engine: "claude_code_opus_max",
  receipt_status: "complete",
  scope_patch_candidate_lane: true,
  finding_count: 0,
  summary: {
    review_status: "complete",
    unresolved_finding_count: 0,
  },
};

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    controlledExecutionSandbox: P12400_READY,
    claudePatchReviewReceipt: CLAUDE_PATCH_REVIEW_READY,
    ...overrides,
  };
}

test("Patch Candidate Lane builds generated patch, diff, rollback, validation, review, and authority contracts through P12600", async () => {
  const result = await buildPatchCandidateLane(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "patch-candidate-lane.v1");
  assert.equal(result.program_range, "P12401-P12600");
  assert.equal(result.source_program_range, "P12201-P12400");
  assert.equal(result.summary.patch_candidate_lane_status, "ready_for_patch_candidate_lane");
  assert.equal(result.summary.patch_candidate_row_count, 6);
  assert.equal(result.summary.diff_packet_row_count, 6);
  assert.equal(result.summary.claude_patch_review_receipt_present_now, true);
  assert.equal(result.summary.ready_for_p12601_handoff, true);
  assert.equal(result.summary.patch_generated_now, false);
  assert.equal(result.summary.patch_applied_now, false);
});

test("Patch Candidate Lane covers every planned phase", async () => {
  const result = await buildPatchCandidateLane(options());
  const phases = new Set(result.patch_candidate_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P12401-P12420", "P12421-P12440", "P12441-P12460", "P12461-P12480", "P12481-P12500", "P12501-P12520", "P12521-P12540", "P12541-P12560", "P12561-P12580", "P12581-P12600"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.patch_candidate_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Patch Candidate Lane defines candidate, diff, rollback, validation, review, negative, projection, and authority rows", async () => {
  const result = await buildPatchCandidateLane(options());

  assert.equal(result.patch_candidate_source_binding_rows.length, 8);
  assert.equal(result.generated_patch_candidate_rows.length, 6);
  assert.equal(result.patch_diff_packet_rows.length, 6);
  assert.equal(result.patch_rollback_binding_rows.length, 5);
  assert.equal(result.patch_validation_ref_rows.length, 6);
  assert.equal(result.patch_claude_review_rows.length, 5);
  assert.equal(result.patch_protected_scope_negative_rows.length, 6);
  assert.equal(result.patch_operator_projection_rows.length, 6);
  assert.equal(result.patch_authority_guard_rows.length, 6);

  assert.equal(result.generated_patch_candidate_rows.every((row) => row.generated_patch_only === true && row.patch_generated_now === false && row.direct_apply_allowed_now === false), true);
  assert.equal(result.patch_diff_packet_rows.every((row) => row.diff_packet_required === true && row.direct_apply_allowed_now === false), true);
  assert.equal(result.patch_rollback_binding_rows.every((row) => row.rollback_execution_allowed_now === false && row.write_without_rollback_allowed === false), true);
  assert.equal(result.patch_operator_projection_rows.every((row) => row.mutation_method_allowed_now === false && row.final_approval_ui_enabled === false), true);
});

test("Patch Candidate Lane preserves blocked P12400 source without opening P12601 handoff", async () => {
  const result = await buildPatchCandidateLane(options({ controlledExecutionSandbox: P12400_BLOCKED, claudePatchReviewReceipt: null }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.patch_candidate_lane_status, "blocked_patch_candidate_lane");
  assert.equal(result.summary.source_ready_for_p12401_handoff, false);
  assert.equal(result.summary.source_block_visible_now, true);
  assert.equal(result.summary.claude_patch_review_receipt_present_now, false);
  assert.equal(result.summary.claude_patch_review_block_visible_now, true);
  assert.equal(result.summary.ready_for_p12601_handoff, false);
  assert.equal(result.patch_candidate_source_binding_rows.find((row) => row.row_id === "source.handoff").current_verdict, "blocked");
  assert.equal(result.p12600_freeze_rows.find((row) => row.row_id === "freeze.source").current_verdict, "blocked");
  assert.equal(result.p12600_freeze_rows.find((row) => row.row_id === "freeze.claude_review").current_verdict, "blocked");
});

test("Patch Candidate Lane keeps ready source blocked when Claude patch review evidence is missing", async () => {
  const result = await buildPatchCandidateLane(options({ claudePatchReviewReceipt: null }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.patch_candidate_lane_status, "blocked_patch_candidate_lane");
  assert.equal(result.summary.source_ready_for_p12401_handoff, true);
  assert.equal(result.summary.claude_patch_review_receipt_present_now, false);
  assert.equal(result.summary.claude_patch_review_block_visible_now, true);
  assert.equal(result.summary.ready_for_p12601_handoff, false);
});

test("Patch Candidate Lane fails validation if P12400 source is missing", async () => {
  const result = await buildPatchCandidateLane(options({ controlledExecutionSandbox: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.patch_candidate_lane_status, "blocked_patch_candidate_lane");
  assert.equal(result.patch_candidate_boundary.source_controlled_execution_sandbox_available, false);
});

test("Patch Candidate Lane boundary keeps patch, write, protected action, and trust capabilities closed", async () => {
  const result = await buildPatchCandidateLane(options());
  const boundary = result.patch_candidate_boundary;

  assert.equal(boundary.patch_candidate_generation_allowed_with_review, true);
  assert.equal(boundary.patch_generated_now, false);
  assert.equal(boundary.patch_applied_now, false);
  assert.equal(boundary.direct_apply_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.protected_action_allowed_now, false);
  assert.equal(boundary.connector_write_enabled, false);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.secret_read_allowed_now, false);
  assert.equal(boundary.raw_body_exposure_allowed, false);
  assert.equal(boundary.codex_final_approval_ui_enabled, false);
  assert.equal(boundary.claude_final_approval_ui_enabled, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Patch Candidate Lane HTML is read-only and avoids unsafe patch copy", async () => {
  const result = await buildPatchCandidateLane(options());

  assert.equal(/<form|<button|type="submit"|apply now|generate patch now|patch applied|approve now|merge now|deploy now/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
  assert.equal(/production ready|enterprise pass|release approved|ai approved|claude approved|codex approved/i.test(result.html), false);
});

test("Patch Candidate Lane --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "patch-candidate-lane-"));
  const sentinelPath = path.join(outDir, "patch-candidate-lane.json");
  const sentinel = "{ \"sentinel\": \"patch-candidate-lane\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPatchCandidateLane(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
