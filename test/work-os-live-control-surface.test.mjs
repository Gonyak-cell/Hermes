import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildWorkOsLiveControlSurface,
  runWorkOsLiveControlSurface,
} from "../src/work-os-live-control-surface.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const LIVE_SESSION_HANDOFF_READY = {
  summary: {
    live_session_source_store_ui_handoff_status: "ready_for_live_session_source_store_ui_handoff",
    ready_for_p8601_handoff: true,
  },
  session_source_store_rows: [
    {
      source_id: "session.codex.primary",
      engine_id: "engine.codex.primary_developer",
      session_id: "codex-live-session.20260606",
      run_id: "run.session.codex.primary.20260606",
      phase_id: "P8401-P8440",
      transcript_ref: "session.codex.primary.transcript.ref",
      redacted_summary_ref: "summary.codex.redacted.ref",
    },
    {
      source_id: "session.claude.review",
      engine_id: "engine.claude.independent_reviewer",
      session_id: "claude-review-session.20260606",
      run_id: "run.session.claude.review.20260606",
      phase_id: "P8441-P8480",
      transcript_ref: "session.claude.review.transcript.ref",
      redacted_summary_ref: "summary.claude.redacted.ref",
    },
    {
      source_id: "session.harness.validator",
      engine_id: "engine.harness.validator",
      session_id: "harness-validation-run.20260606",
      run_id: "run.session.harness.validator.20260606",
      phase_id: "P8481-P8520",
      transcript_ref: "session.harness.validator.transcript.ref",
      redacted_summary_ref: "summary.harness.redacted.ref",
    },
    {
      source_id: "session.ui.handoff",
      engine_id: "engine.harness.ui_projection",
      session_id: "ui-handoff-run.20260606",
      run_id: "run.session.ui.handoff.20260606",
      phase_id: "P8521-P8560",
      transcript_ref: "session.ui.handoff.transcript.ref",
      redacted_summary_ref: "summary.ui.redacted.ref",
    },
  ],
  redacted_conversation_materializer_rows: [
    { materializer_id: "materializer.codex_decision", event_type: "decision", source_id: "session.codex.primary", timeline_ref: "work_os.timeline.decision" },
    { materializer_id: "materializer.codex_blocker", event_type: "blocker", source_id: "session.codex.primary", timeline_ref: "work_os.timeline.blocker" },
    { materializer_id: "materializer.claude_review_event", event_type: "review_event", source_id: "session.claude.review", timeline_ref: "work_os.timeline.review_event" },
    { materializer_id: "materializer.harness_validation_event", event_type: "validation_event", source_id: "session.harness.validator", timeline_ref: "work_os.timeline.validation_event" },
    { materializer_id: "materializer.phase_progress_event", event_type: "phase_progress", source_id: "session.ui.handoff", timeline_ref: "work_os.timeline.phase_progress" },
  ],
};

function buildOptions(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    liveSessionSourceStoreUiHandoff: LIVE_SESSION_HANDOFF_READY,
    ...overrides,
  };
}

test("Work OS live control surface consumes P8600 live session handoff", async () => {
  const result = await buildWorkOsLiveControlSurface(buildOptions());

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.work_os_live_control_surface_status, "ready_for_work_os_live_control_surface");
  assert.equal(result.program_range, "P8601-P8800");
  assert.equal(result.summary.source_live_session_handoff_ready, true);
});

test("Work OS live control surface covers all P8601-P8800 phase rows", async () => {
  const result = await buildWorkOsLiveControlSurface(buildOptions());
  const phaseRanges = new Set(result.work_os_live_control_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P8601-P8620", "P8621-P8640", "P8641-P8660", "P8661-P8680", "P8681-P8700", "P8701-P8720", "P8721-P8740", "P8741-P8760", "P8761-P8780", "P8781-P8800"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.work_os_live_control_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Work OS live control surface binds artifact sources as cited read-only inputs", async () => {
  const result = await buildWorkOsLiveControlSurface(buildOptions());

  assert.equal(result.artifact_source_binding_rows.length, 6);
  assert.equal(result.artifact_source_binding_rows.every((row) => row.artifact_path), true);
  assert.equal(result.artifact_source_binding_rows.every((row) => row.artifact_backed === true), true);
  assert.equal(result.artifact_source_binding_rows.every((row) => row.read_only === true), true);
  assert.equal(result.artifact_source_binding_rows.every((row) => row.source_cited === true), true);
  assert.equal(result.artifact_source_binding_rows.every((row) => row.mutation_allowed === false), true);
});

test("Work OS live control surface declares GET-only raw-hidden API routes", async () => {
  const result = await buildWorkOsLiveControlSurface(buildOptions());
  const apiPaths = new Set(result.read_only_api_server_rows.map((row) => row.api_path));

  for (const apiPath of ["/api/work-os/projects", "/api/work-os/phases", "/api/work-os/timeline", "/api/work-os/reviews", "/api/work-os/gates", "/api/work-os/session-sources", "/api/work-os/refresh"]) {
    assert.equal(apiPaths.has(apiPath), true);
  }
  assert.equal(result.read_only_api_server_rows.every((row) => row.method === "GET"), true);
  assert.equal(result.read_only_api_server_rows.every((row) => row.read_only === true), true);
  assert.equal(result.read_only_api_server_rows.every((row) => row.write_enabled === false), true);
  assert.equal(result.read_only_api_server_rows.every((row) => row.mutates_state === false), true);
  assert.equal(result.read_only_api_server_rows.every((row) => row.raw_body_returns === false), true);
  assert.equal(result.read_only_api_server_rows.every((row) => row.full_body_returns === false), true);
});

test("Work OS live control surface ingests sessions as metadata and redacted summaries only", async () => {
  const result = await buildWorkOsLiveControlSurface(buildOptions());

  assert.equal(result.session_ingestion_adapter_rows.length, 4);
  assert.equal(result.session_ingestion_adapter_rows.every((row) => row.engine_id), true);
  assert.equal(result.session_ingestion_adapter_rows.every((row) => row.session_id), true);
  assert.equal(result.session_ingestion_adapter_rows.every((row) => row.run_id), true);
  assert.equal(result.session_ingestion_adapter_rows.every((row) => row.ingestion_mode === "metadata_and_redacted_summary_only"), true);
  assert.equal(result.session_ingestion_adapter_rows.every((row) => row.raw_body_ingested_visible === false), true);
  assert.equal(result.session_ingestion_adapter_rows.every((row) => row.mutates_source_store === false), true);
  assert.equal(result.session_ingestion_adapter_rows.every((row) => row.mutates_plan_state === false), true);
});

test("Work OS live control surface projects cited redacted timeline events", async () => {
  const result = await buildWorkOsLiveControlSurface(buildOptions());
  const eventTypes = new Set(result.redacted_timeline_projection_rows.map((row) => row.event_type));

  for (const eventType of ["decision", "blocker", "review_event", "validation_event", "phase_progress"]) {
    assert.equal(eventTypes.has(eventType), true);
  }
  assert.equal(result.redacted_timeline_projection_rows.every((row) => row.citation_ref), true);
  assert.equal(result.redacted_timeline_projection_rows.every((row) => row.redacted_summary_visible === true), true);
  assert.equal(result.redacted_timeline_projection_rows.every((row) => row.raw_transcript_body_visible === false), true);
  assert.equal(result.redacted_timeline_projection_rows.every((row) => row.source_cited === true), true);
  assert.equal(result.redacted_timeline_projection_rows.every((row) => row.may_update_plan_directly === false), true);
});

test("Work OS live control surface exposes project phase review and refresh surfaces", async () => {
  const result = await buildWorkOsLiveControlSurface(buildOptions());

  assert.equal(result.project_control_surface_rows.length, 5);
  assert.equal(result.phase_detail_surface_rows.length, 10);
  assert.equal(result.review_finding_surface_rows.length, 5);
  assert.equal(result.live_progress_refresh_rows.length, 6);
  assert.equal(result.project_control_surface_rows.every((row) => row.active_goal_ref && row.current_phase_ref), true);
  assert.equal(result.phase_detail_surface_rows.every((row) => row.claim_ref && row.evidence_ref && row.gate_ref && row.check_ref && row.review_receipt_ref), true);
  assert.equal(result.review_finding_surface_rows.every((row) => row.unresolved_findings_visible === true && row.final_approval_allowed === false), true);
  assert.equal(result.live_progress_refresh_rows.every((row) => row.stale_context_visible === true && row.missing_validation_visible === true), true);
  assert.equal(result.live_progress_refresh_rows.every((row) => row.refresh_mutates_state === false), true);
});

test("Work OS live control surface binds UI runtime contract to read-only API paths", async () => {
  const result = await buildWorkOsLiveControlSurface(buildOptions());

  assert.equal(result.ui_handoff_runtime_contract_rows.length, 5);
  assert.equal(result.ui_handoff_runtime_contract_rows.every((row) => row.consumes_api_path.startsWith("/api/work-os/")), true);
  assert.equal(result.ui_handoff_runtime_contract_rows.every((row) => row.bounded_snapshot === true), true);
  assert.equal(result.ui_handoff_runtime_contract_rows.every((row) => row.read_only === true), true);
  assert.equal(result.ui_handoff_runtime_contract_rows.every((row) => row.raw_material_embedded === false), true);
  assert.equal(result.ui_handoff_runtime_contract_rows.every((row) => row.protected_action_controls_enabled === false), true);
});

test("Work OS live control surface freezes P8800 without authority expansion", async () => {
  const result = await buildWorkOsLiveControlSurface(buildOptions());
  const boundary = result.work_os_live_boundary;

  assert.equal(result.p8800_freeze_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(boundary.ready_for_p8801_handoff, true);
  assert.equal(boundary.human_gate_in_scope, false);
  assert.equal(boundary.codex_final_approval_allowed, false);
  assert.equal(boundary.claude_final_approval_allowed, false);
  assert.equal(boundary.reviewer_mutation_allowed, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.protected_closeout_enabled, false);
  assert.equal(boundary.runtime_execution_enabled, false);
  assert.equal(boundary.write_action_enabled, false);
  assert.equal(boundary.external_connector_write_enabled, false);
  assert.equal(boundary.raw_transcript_api_visible, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Work OS live control surface negative fixtures block unsafe API UI refresh and authority claims", async () => {
  const result = await buildWorkOsLiveControlSurface(buildOptions());
  const fixtureIds = new Set(result.work_os_live_negative_fixture_rows.map((row) => row.fixture_id));

  for (const fixture of ["negative.stale_source_pass", "negative.missing_artifact_pass", "negative.non_get_api_method", "negative.api_returns_raw_transcript", "negative.session_ingestion_raw_body", "negative.ingestion_mutates_source", "negative.timeline_uncited_event", "negative.ui_action_enabled", "negative.refresh_mutates_state", "negative.codex_final_approval", "negative.claude_final_approval", "negative.production_enterprise_pass"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.work_os_live_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.work_os_live_negative_fixture_rows.every((row) => row.unsafe_claim_allowed === false), true);
});

test("Work OS live control surface blocks if P8600 source is not ready", async () => {
  const result = await buildWorkOsLiveControlSurface(buildOptions({
    liveSessionSourceStoreUiHandoff: {
      summary: {
        live_session_source_store_ui_handoff_status: "blocked",
        ready_for_p8601_handoff: false,
      },
      session_source_store_rows: [],
      redacted_conversation_materializer_rows: [],
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.source_live_session_handoff_ready, false);
  assert.equal(result.summary.work_os_live_control_surface_status, "blocked");
});

test("Work OS live control surface --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "work-os-live-control-surface-"));
  const sentinelPath = path.join(outDir, "work-os-live-control-surface.json");
  const sentinel = "{ \"sentinel\": \"work-os-live-control-surface\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runWorkOsLiveControlSurface(buildOptions({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
