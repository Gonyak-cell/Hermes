import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildWorkOsGoalExecutionView,
  runWorkOsGoalExecutionView,
} from "../src/work-os-goal-execution-view.mjs";
import { buildWorkOsReadOnlyApiUiSmoke } from "../src/work-os-read-only-api-ui-smoke.mjs";

const RUN_AT = "2026-06-06T03:20:00.000Z";

async function readySource() {
  return buildWorkOsReadOnlyApiUiSmoke({ runAt: RUN_AT, write: false });
}

async function buildOptions(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    workOsReadOnlyApiUiSmoke: await readySource(),
    ...overrides,
  };
}

test("Work OS goal execution view consumes P9000 source", async () => {
  const result = await buildWorkOsGoalExecutionView(await buildOptions());

  assert.equal(result.validation.valid, true);
  assert.equal(result.program_range, "P9001-P9200");
  assert.equal(result.source_program_range, "P8801-P9000");
  assert.equal(result.summary.work_os_goal_execution_view_status, "ready_for_work_os_goal_execution_view");
  assert.equal(result.summary.source_p9000_ready, true);
  assert.equal(result.summary.ready_for_p9201_handoff, true);
});

test("Work OS goal execution view covers all P9001-P9200 phase rows", async () => {
  const result = await buildWorkOsGoalExecutionView(await buildOptions());
  const phaseRanges = new Set(result.work_os_goal_execution_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P9001-P9020", "P9021-P9040", "P9041-P9060", "P9061-P9080", "P9081-P9100", "P9101-P9120", "P9121-P9140", "P9141-P9160", "P9161-P9180", "P9181-P9200"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.work_os_goal_execution_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Work OS project registry keeps domain packs scoped below Hermes", async () => {
  const result = await buildWorkOsGoalExecutionView(await buildOptions());

  assert.equal(result.project_runtime_handoff_rows.length >= 5, true);
  assert.equal(result.project_runtime_handoff_rows.every((row) => row.hermes_product_identity === "general_project_workflow_control_plane"), true);
  assert.equal(result.project_runtime_handoff_rows.every((row) => row.domain_pack_scope === "project_workflow_context"), true);
  assert.equal(result.project_runtime_handoff_rows.every((row) => row.domain_pack_is_whole_product === false), true);
  assert.equal(result.project_runtime_handoff_rows.every((row) => row.protected_action_enabled === false && row.write_action_enabled === false), true);
});

test("Work OS goal phase execution rows bind claim evidence gate check and review refs", async () => {
  const result = await buildWorkOsGoalExecutionView(await buildOptions());

  assert.equal(result.goal_phase_execution_rows.length, result.project_runtime_handoff_rows.length);
  assert.equal(result.goal_phase_execution_rows.every((row) => row.phase_range === "P9001-P9200"), true);
  assert.equal(result.goal_phase_execution_rows.every((row) => row.owner_engine_ref === "engine.codex.primary_developer"), true);
  assert.equal(result.goal_phase_execution_rows.every((row) => row.reviewer_engine_ref === "engine.claude_code_opus_max"), true);
  assert.equal(result.goal_phase_execution_rows.every((row) => row.claim_ref && row.evidence_ref && row.gate_ref && row.check_ref && row.review_receipt_ref), true);
  assert.equal(result.goal_phase_execution_rows.every((row) => row.codex_final_approval_allowed === false && row.claude_final_approval_allowed === false), true);
});

test("Work OS validation lens is read-only and marks full npm test as conditional", async () => {
  const result = await buildWorkOsGoalExecutionView(await buildOptions());
  const fullTest = result.validation_state_lens_rows.find((row) => row.lens_id === "validation.full_npm_test");

  assert.equal(result.validation_state_lens_rows.every((row) => row.read_only === true && row.mutates_state === false), true);
  assert.equal(result.validation_state_lens_rows.some((row) => row.command_ref === "npm run platform:work-os-goal-execution-view -- --check"), true);
  assert.equal(result.validation_state_lens_rows.some((row) => row.command_ref === "node --test test/work-os-read-only-api-ui-smoke.test.mjs"), true);
  assert.equal(fullTest.required_for_this_tranche, false);
  assert.equal(fullTest.current_verdict, "pass");
});

test("Work OS review lane view preserves review authority boundaries", async () => {
  const result = await buildWorkOsGoalExecutionView(await buildOptions());
  const laneIds = new Set(result.review_lane_view_rows.map((row) => row.lane_id));

  for (const laneId of ["lane.codex.primary", "lane.claude.review", "lane.harness.validation", "lane.single_owner"]) {
    assert.equal(laneIds.has(laneId), true);
  }
  assert.equal(result.review_lane_view_rows.every((row) => row.final_approval_allowed === false), true);
  assert.equal(result.review_lane_view_rows.every((row) => row.reviewer_mutation_allowed === false), true);
  assert.equal(result.review_lane_view_rows.every((row) => row.protected_closeout_allowed === false), true);
});

test("Work OS session handoff refs stay redacted cited and non-mutating", async () => {
  const result = await buildWorkOsGoalExecutionView(await buildOptions());

  assert.equal(result.session_handoff_ref_rows.length >= 4, true);
  assert.equal(result.session_handoff_ref_rows.every((row) => row.transcript_ref && row.redacted_summary_ref), true);
  assert.equal(result.session_handoff_ref_rows.every((row) => row.raw_body_visible === false && row.full_transcript_body_visible === false), true);
  assert.equal(result.session_handoff_ref_rows.every((row) => row.redacted_summary_visible === true && row.source_cited === true), true);
  assert.equal(result.session_handoff_ref_rows.every((row) => row.mutates_source_store === false && row.mutates_plan_state === false), true);
});

test("Work OS next action queue and commit checkpoint view cannot execute or write", async () => {
  const result = await buildWorkOsGoalExecutionView(await buildOptions());

  assert.equal(result.next_action_queue_rows.length >= 6, true);
  assert.equal(result.next_action_queue_rows.every((row) => row.action_type === "read_only_operator_guidance"), true);
  assert.equal(result.next_action_queue_rows.every((row) => row.protected_action === false && row.mutates_state === false), true);
  assert.equal(result.commit_checkpoint_view_rows.every((row) => row.read_only === true), true);
  assert.equal(result.commit_checkpoint_view_rows.every((row) => row.git_write_enabled === false && row.commit_created_by_ui === false), true);
  assert.equal(result.commit_checkpoint_view_rows.every((row) => row.push_enabled === false && row.merge_enabled === false), true);
});

test("Work OS goal execution view freezes P9200 without authority expansion", async () => {
  const result = await buildWorkOsGoalExecutionView(await buildOptions());
  const boundary = result.work_os_goal_execution_boundary;

  assert.equal(result.p9200_freeze_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(boundary.ready_for_p9201_handoff, true);
  assert.equal(boundary.domain_pack_as_product_allowed, false);
  assert.equal(boundary.p9000_endpoint_locked, false);
  assert.equal(boundary.raw_session_body_visible, false);
  assert.equal(boundary.codex_final_approval_allowed, false);
  assert.equal(boundary.claude_final_approval_allowed, false);
  assert.equal(boundary.reviewer_mutation_allowed, false);
  assert.equal(boundary.single_owner_enterprise_trust_allowed, false);
  assert.equal(boundary.protected_closeout_enabled, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.runtime_execution_enabled, false);
  assert.equal(boundary.write_action_enabled, false);
  assert.equal(boundary.external_connector_write_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Work OS goal execution view negative fixtures block unsafe claims", async () => {
  const result = await buildWorkOsGoalExecutionView(await buildOptions());
  const fixtureIds = new Set(result.work_os_goal_execution_negative_fixture_rows.map((row) => row.fixture_id));

  for (const fixture of ["negative.domain_pack_as_product", "negative.p9000_endpoint_lock", "negative.raw_session_body", "negative.review_final_authority", "negative.single_owner_enterprise", "negative.ui_write_action", "negative.production_pass"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.work_os_goal_execution_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.work_os_goal_execution_negative_fixture_rows.every((row) => row.unsafe_claim_allowed === false), true);
});

test("Work OS goal execution view blocks if P9000 source is not ready", async () => {
  const result = await buildWorkOsGoalExecutionView({
    runAt: RUN_AT,
    write: false,
    workOsReadOnlyApiUiSmoke: {
      summary: {
        work_os_read_only_api_ui_smoke_status: "blocked",
        ready_for_p9001_handoff: false,
      },
    },
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.source_p9000_ready, false);
  assert.equal(result.summary.work_os_goal_execution_view_status, "blocked");
});

test("Work OS goal execution view --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "work-os-goal-execution-view-"));
  const sentinelPath = path.join(outDir, "work-os-goal-execution-view.json");
  const sentinel = "{ \"sentinel\": \"work-os-goal-execution-view\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runWorkOsGoalExecutionView(await buildOptions({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
