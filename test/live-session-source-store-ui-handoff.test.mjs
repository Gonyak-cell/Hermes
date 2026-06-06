import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildLiveSessionSourceStoreUiHandoff,
  runLiveSessionSourceStoreUiHandoff,
} from "../src/live-session-source-store-ui-handoff.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const WORK_OS_UI_READY = {
  summary: {
    work_os_ui_v0_governed_loop_status: "ready_for_work_os_ui_v0_governed_loop",
    ready_for_p8401_handoff: true,
  },
  work_os_ui_surface_rows: [
    { surface_id: "ui.project_control_dashboard", read_only_projection: true },
    { surface_id: "ui.phase_detail_view", read_only_projection: true },
    { surface_id: "ui.conversation_timeline", read_only_projection: true },
    { surface_id: "ui.review_console", read_only_projection: true },
  ],
  phase_detail_view_rows: [
    {
      phase_id: "P8241-P8260",
      phase_title: "Project Control Dashboard",
      status: "pass",
      claim_ref: "claim.p8241_p8260",
      evidence_ref: "evidence.p8241_p8260",
      gate_ref: "gate.p8241_p8260",
      check_ref: "validator.p8241_p8260",
      review_receipt_ref: "claude.review.p8241_p8260",
    },
  ],
  conversation_timeline_rows: [
    { event_id: "timeline.codex_conversation", event_type: "codex_conversation", redacted_summary_ui_visible: true },
    { event_id: "timeline.claude_conversation", event_type: "claude_conversation", redacted_summary_ui_visible: true },
    { event_id: "timeline.validation_event", event_type: "validation_event", redacted_summary_ui_visible: true },
  ],
  review_console_rows: [
    { console_id: "review.claude_status", claude_review_receipt_required: true },
  ],
};

function buildOptions(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    workOsUiV0GovernedLoop: WORK_OS_UI_READY,
    ...overrides,
  };
}

test("Live session source store UI handoff consumes Work OS UI v0 source", async () => {
  const result = await buildLiveSessionSourceStoreUiHandoff(buildOptions());

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.live_session_source_store_ui_handoff_status, "ready_for_live_session_source_store_ui_handoff");
  assert.equal(result.program_range, "P8401-P8600");
  assert.equal(result.summary.source_work_os_ui_v0_ready, true);
});

test("Live session source store UI handoff covers P8401-P8600 phase rows", async () => {
  const result = await buildLiveSessionSourceStoreUiHandoff(buildOptions());
  const phaseRanges = new Set(result.live_session_source_store_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P8401-P8440", "P8441-P8480", "P8481-P8520", "P8521-P8560", "P8561-P8600"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.live_session_source_store_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Live session source store rows use stable ids append-only storage and hidden raw bodies", async () => {
  const result = await buildLiveSessionSourceStoreUiHandoff(buildOptions());

  assert.equal(result.session_source_store_rows.length, 4);
  assert.equal(result.session_source_store_rows.every((row) => row.source_id), true);
  assert.equal(result.session_source_store_rows.every((row) => row.engine_id), true);
  assert.equal(result.session_source_store_rows.every((row) => row.session_id), true);
  assert.equal(result.session_source_store_rows.every((row) => row.run_id), true);
  assert.equal(result.session_source_store_rows.every((row) => row.phase_id), true);
  assert.equal(result.session_source_store_rows.every((row) => row.transcript_ref), true);
  assert.equal(result.session_source_store_rows.every((row) => row.append_only === true), true);
  assert.equal(result.session_source_store_rows.every((row) => row.overwrite_allowed === false), true);
  assert.equal(result.session_source_store_rows.every((row) => row.raw_body_ui_visible === false), true);
  assert.equal(result.session_source_store_rows.every((row) => row.raw_body_api_visible === false), true);
});

test("Live session materializer exposes cited redacted event types only", async () => {
  const result = await buildLiveSessionSourceStoreUiHandoff(buildOptions());
  const eventTypes = new Set(result.redacted_conversation_materializer_rows.map((row) => row.event_type));

  for (const eventType of ["decision", "blocker", "review_event", "validation_event", "phase_progress"]) {
    assert.equal(eventTypes.has(eventType), true);
  }
  assert.equal(result.redacted_conversation_materializer_rows.every((row) => row.redacted_summary_output_visible === true), true);
  assert.equal(result.redacted_conversation_materializer_rows.every((row) => row.raw_transcript_output_visible === false), true);
  assert.equal(result.redacted_conversation_materializer_rows.every((row) => row.full_transcript_output_visible === false), true);
  assert.equal(result.redacted_conversation_materializer_rows.every((row) => row.source_citation_required === true), true);
  assert.equal(result.redacted_conversation_materializer_rows.every((row) => row.may_update_plan_directly === false), true);
});

test("Live session read-only API projection is GET-only non-mutating and raw-hidden", async () => {
  const result = await buildLiveSessionSourceStoreUiHandoff(buildOptions());
  const apiPaths = new Set(result.read_only_api_projection_rows.map((row) => row.api_path));

  for (const apiPath of ["/api/work-os/projects", "/api/work-os/phases", "/api/work-os/timeline", "/api/work-os/reviews", "/api/work-os/gates", "/api/work-os/session-sources"]) {
    assert.equal(apiPaths.has(apiPath), true);
  }
  assert.equal(result.read_only_api_projection_rows.every((row) => row.method === "GET"), true);
  assert.equal(result.read_only_api_projection_rows.every((row) => row.read_only === true), true);
  assert.equal(result.read_only_api_projection_rows.every((row) => row.write_enabled === false), true);
  assert.equal(result.read_only_api_projection_rows.every((row) => row.mutates_state === false), true);
  assert.equal(result.read_only_api_projection_rows.every((row) => row.raw_body_returns === false), true);
  assert.equal(result.read_only_api_projection_rows.every((row) => row.full_body_returns === false), true);
});

test("Live session UI handoff adapter provides bounded read-only snapshots", async () => {
  const result = await buildLiveSessionSourceStoreUiHandoff(buildOptions());

  assert.equal(result.ui_handoff_adapter_rows.length, 5);
  assert.equal(result.ui_handoff_adapter_rows.every((row) => row.manifest_ref), true);
  assert.equal(result.ui_handoff_adapter_rows.every((row) => row.snapshot_ref), true);
  assert.equal(result.ui_handoff_adapter_rows.every((row) => row.bounded_snapshot === true), true);
  assert.equal(result.ui_handoff_adapter_rows.every((row) => row.read_only === true), true);
  assert.equal(result.ui_handoff_adapter_rows.every((row) => row.raw_material_embedded === false), true);
  assert.equal(result.ui_handoff_adapter_rows.every((row) => row.full_transcript_embedded === false), true);
  assert.equal(result.ui_handoff_adapter_rows.every((row) => row.raw_secret_embedded === false), true);
});

test("Live session restore bundle is cited redacted and non-mutating", async () => {
  const result = await buildLiveSessionSourceStoreUiHandoff(buildOptions());

  assert.equal(result.session_restore_bundle_rows.length, 5);
  assert.equal(result.session_restore_bundle_rows.every((row) => row.source_ref), true);
  assert.equal(result.session_restore_bundle_rows.every((row) => row.source_cited === true), true);
  assert.equal(result.session_restore_bundle_rows.every((row) => row.raw_transcript_embedded === false), true);
  assert.equal(result.session_restore_bundle_rows.every((row) => row.full_transcript_embedded === false), true);
  assert.equal(result.session_restore_bundle_rows.every((row) => row.auto_context_mutation === false), true);
});

test("Live session P8600 boundary keeps authority expansion closed", async () => {
  const result = await buildLiveSessionSourceStoreUiHandoff(buildOptions());
  const boundary = result.live_session_boundary;

  assert.equal(result.p8600_freeze_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(boundary.ready_for_p8601_handoff, true);
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

test("Live session negative fixtures block unsafe store API UI and authority claims", async () => {
  const result = await buildLiveSessionSourceStoreUiHandoff(buildOptions());
  const fixtureIds = new Set(result.live_session_negative_fixture_rows.map((row) => row.fixture_id));

  for (const fixture of ["negative.mutable_session_store", "negative.duplicate_session_event", "negative.raw_transcript_api_response", "negative.write_api_method", "negative.ui_embeds_raw_material", "negative.uncited_restore_bundle", "negative.stale_context_pass", "negative.codex_final_approval", "negative.claude_source_mutation", "negative.production_enterprise_pass"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.live_session_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.live_session_negative_fixture_rows.every((row) => row.unsafe_claim_allowed === false), true);
});

test("Live session source store UI handoff blocks if Work OS UI v0 source is not ready", async () => {
  const result = await buildLiveSessionSourceStoreUiHandoff(buildOptions({
    workOsUiV0GovernedLoop: {
      summary: {
        work_os_ui_v0_governed_loop_status: "blocked",
        ready_for_p8401_handoff: false,
      },
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.source_work_os_ui_v0_ready, false);
  assert.equal(result.summary.live_session_source_store_ui_handoff_status, "blocked");
});

test("Live session source store UI handoff --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "live-session-source-store-ui-handoff-"));
  const sentinelPath = path.join(outDir, "live-session-source-store-ui-handoff.json");
  const sentinel = "{ \"sentinel\": \"live-session-source-store-ui-handoff\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runLiveSessionSourceStoreUiHandoff(buildOptions({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
