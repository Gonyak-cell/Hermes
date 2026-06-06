import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildWorkOsUiV0GovernedLoop,
  runWorkOsUiV0GovernedLoop,
} from "../src/work-os-ui-v0-governed-loop.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const PLAN_PROGRESS_READY = {
  summary: {
    plan_registry_progress_engine_status: "ready_for_plan_registry_progress_engine",
    ready_for_work_os_ui_v0_handoff: true,
  },
  phase_progress_rows: [
    {
      phase_id: "P8081-P8160",
      phase_title: "Conversation Capture Contract",
      status: "pass",
      claim_ref: "claim.p8081_p8160",
      evidence_ref: "evidence.p8081_p8160",
      gate_ref: "gate.p8081_p8160",
      validator_ref: "validator.p8081_p8160",
      review_receipt_ref: "claude.review.p8081_p8160",
    },
    {
      phase_id: "P8161-P8240",
      phase_title: "Plan Registry And Progress Engine",
      status: "pass",
      claim_ref: "claim.p8161_p8240",
      evidence_ref: "evidence.p8161_p8240",
      gate_ref: "gate.p8161_p8240",
      validator_ref: "validator.p8161_p8240",
      review_receipt_ref: "claude.review.p8161_p8240",
    },
    {
      phase_id: "P8241-P8320",
      phase_title: "Work OS UI v0",
      status: "in_progress",
      claim_ref: "claim.p8241_p8320",
      evidence_ref: "evidence.p8241_p8320",
      gate_ref: "gate.p8241_p8320",
      validator_ref: "validator.p8241_p8320",
      review_receipt_ref: "claude.review.p8241_p8320",
    },
    {
      phase_id: "P8321-P8400",
      phase_title: "Harness-Governed Development Loop",
      status: "review_pending",
      claim_ref: "claim.p8321_p8400",
      evidence_ref: "evidence.p8321_p8400",
      gate_ref: "gate.p8321_p8400",
      validator_ref: "validator.p8321_p8400",
      review_receipt_ref: "claude.review.p8321_p8400",
    },
    {
      phase_id: "external.enterprise_trust",
      phase_title: "Enterprise Independent Trust",
      status: "blocked",
      claim_ref: "claim.enterprise_trust",
      evidence_ref: "evidence.enterprise_trust",
      gate_ref: "gate.enterprise_trust",
      validator_ref: "validator.enterprise_trust",
      review_receipt_ref: "claude.review.enterprise_trust",
    },
  ],
};

function buildOptions(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    planRegistryProgress: PLAN_PROGRESS_READY,
    ...overrides,
  };
}

test("Work OS UI v0 governed loop consumes plan registry progress engine", async () => {
  const result = await buildWorkOsUiV0GovernedLoop(buildOptions());

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_ui_v0_governed_loop_status, "ready_for_work_os_ui_v0_governed_loop");
  assert.equal(result.program_range, "P8241-P8400");
  assert.equal(result.summary.source_plan_registry_ready, true);
});

test("Work OS UI v0 governed loop covers P8241-P8400 phase rows", async () => {
  const result = await buildWorkOsUiV0GovernedLoop(buildOptions());
  const phaseRanges = new Set(result.work_os_ui_v0_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P8241-P8260", "P8261-P8280", "P8281-P8300", "P8301-P8320", "P8321-P8340", "P8341-P8360", "P8361-P8380", "P8381-P8400"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.work_os_ui_v0_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Work OS UI v0 governed loop registers all UI surfaces as read-only", async () => {
  const result = await buildWorkOsUiV0GovernedLoop(buildOptions());
  const surfaceIds = new Set(result.work_os_ui_surface_rows.map((row) => row.surface_id));

  for (const surface of ["ui.project_control_dashboard", "ui.phase_detail_view", "ui.conversation_timeline", "ui.review_console"]) {
    assert.equal(surfaceIds.has(surface), true);
  }
  assert.equal(result.work_os_ui_surface_rows.every((row) => row.read_only_projection === true), true);
  assert.equal(result.work_os_ui_surface_rows.every((row) => row.protected_action_enabled === false), true);
});

test("Work OS UI v0 governed loop exposes phase detail claim evidence gate check and review receipt", async () => {
  const result = await buildWorkOsUiV0GovernedLoop(buildOptions());
  const enterpriseRow = result.phase_detail_view_rows.find((row) => row.phase_id === "external.enterprise_trust");

  assert.equal(result.phase_detail_view_rows.length >= 5, true);
  assert.equal(result.phase_detail_view_rows.every((row) => row.claim_ref), true);
  assert.equal(result.phase_detail_view_rows.every((row) => row.evidence_ref), true);
  assert.equal(result.phase_detail_view_rows.every((row) => row.gate_ref), true);
  assert.equal(result.phase_detail_view_rows.every((row) => row.check_ref), true);
  assert.equal(result.phase_detail_view_rows.every((row) => row.review_receipt_ref), true);
  assert.equal(result.phase_detail_view_rows.every((row) => row.raw_material_visible === false), true);
  assert.equal(enterpriseRow.status, "blocked");
  assert.equal(enterpriseRow.current_verdict, "pass");
});

test("Work OS UI v0 governed loop renders conversation timeline through redacted cited refs only", async () => {
  const result = await buildWorkOsUiV0GovernedLoop(buildOptions());
  const eventTypes = new Set(result.conversation_timeline_rows.map((row) => row.event_type));

  for (const eventType of ["codex_conversation", "claude_conversation", "extracted_decision", "blocker", "validation_event"]) {
    assert.equal(eventTypes.has(eventType), true);
  }
  assert.equal(result.conversation_timeline_rows.every((row) => row.redacted_summary_ui_visible === true), true);
  assert.equal(result.conversation_timeline_rows.every((row) => row.raw_transcript_body_visible === false), true);
  assert.equal(result.conversation_timeline_rows.every((row) => row.source_citation_required === true), true);
});

test("Work OS UI v0 governed loop exposes Claude review console without reviewer mutation", async () => {
  const result = await buildWorkOsUiV0GovernedLoop(buildOptions());

  assert.equal(result.review_console_rows.length, 4);
  assert.equal(result.review_console_rows.every((row) => row.claude_review_receipt_required === true), true);
  assert.equal(result.review_console_rows.every((row) => row.finding_loop_visible === true), true);
  assert.equal(result.review_console_rows.every((row) => row.unresolved_findings_visible === true), true);
  assert.equal(result.review_console_rows.every((row) => row.reviewer_mutation_allowed === false), true);
  assert.equal(result.review_console_rows.every((row) => row.final_approval_allowed === false), true);
});

test("Work OS UI v0 governed loop registers Codex Claude and Harness lanes", async () => {
  const result = await buildWorkOsUiV0GovernedLoop(buildOptions());

  assert.equal(result.harness_governed_development_loop_rows.some((row) => row.codex_primary_engine_lane && row.plan_phase_auto_attribution_required), true);
  assert.equal(result.harness_governed_development_loop_rows.some((row) => row.claude_review_lane && row.claude_review_receipt_required), true);
  assert.equal(result.harness_governed_development_loop_rows.some((row) => row.harness_validation_lane && row.validator_status_reflected_to_ui), true);
  assert.equal(result.harness_governed_development_loop_rows.every((row) => row.runtime_execution_enabled === false), true);
  assert.equal(result.harness_governed_development_loop_rows.every((row) => row.write_action_enabled === false), true);
});

test("Work OS UI v0 governed loop freezes P8400 without production or enterprise PASS", async () => {
  const result = await buildWorkOsUiV0GovernedLoop(buildOptions());
  const boundary = result.work_os_ui_v0_boundary;

  assert.equal(result.p8400_freeze_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(boundary.ready_for_p8401_handoff, true);
  assert.equal(boundary.human_gate_in_scope, false);
  assert.equal(boundary.codex_final_approval_allowed, false);
  assert.equal(boundary.claude_final_approval_allowed, false);
  assert.equal(boundary.reviewer_mutation_allowed, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.protected_closeout_enabled, false);
  assert.equal(boundary.runtime_execution_enabled, false);
  assert.equal(boundary.write_action_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Work OS UI v0 governed loop negative fixtures block unsafe UI and loop claims", async () => {
  const result = await buildWorkOsUiV0GovernedLoop(buildOptions());
  const fixtureIds = new Set(result.work_os_ui_v0_negative_fixture_rows.map((row) => row.fixture_id));

  for (const fixture of ["negative.raw_transcript_timeline", "negative.dashboard_executes_action", "negative.phase_pass_without_validator", "negative.review_console_hides_unresolved", "negative.claude_reviewer_mutates_source", "negative.codex_self_approval", "negative.production_enterprise_pass"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.work_os_ui_v0_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.work_os_ui_v0_negative_fixture_rows.every((row) => row.unsafe_claim_allowed === false), true);
});

test("Work OS UI v0 governed loop blocks if source plan registry progress is not ready", async () => {
  const result = await buildWorkOsUiV0GovernedLoop(buildOptions({
    planRegistryProgress: {
      summary: {
        plan_registry_progress_engine_status: "blocked",
        ready_for_work_os_ui_v0_handoff: false,
      },
      phase_progress_rows: [],
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.source_plan_registry_ready, false);
  assert.equal(result.summary.work_os_ui_v0_governed_loop_status, "blocked");
});

test("Work OS UI v0 governed loop --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "work-os-ui-v0-governed-loop-"));
  const sentinelPath = path.join(outDir, "work-os-ui-v0-governed-loop.json");
  const sentinel = "{ \"sentinel\": \"work-os-ui-v0-governed-loop\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runWorkOsUiV0GovernedLoop(buildOptions({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
