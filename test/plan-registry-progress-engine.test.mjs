import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPlanRegistryProgressEngine,
  runPlanRegistryProgressEngine,
} from "../src/plan-registry-progress-engine.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const CAPTURE_READY = {
  summary: {
    conversation_capture_contract_status: "ready_for_conversation_capture_contract",
  },
  transcript_reference_rows: [
    {
      conversation_source_id: "conversation.source.codex",
      transcript_ref: "transcript.codex.raw",
    },
    {
      conversation_source_id: "conversation.source.claude",
      transcript_ref: "transcript.claude.raw",
    },
  ],
};

function buildOptions(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    conversationCapture: CAPTURE_READY,
    ...overrides,
  };
}

test("Plan registry progress engine consumes conversation capture contract", async () => {
  const result = await buildPlanRegistryProgressEngine(buildOptions());

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.plan_registry_progress_engine_status, "ready_for_plan_registry_progress_engine");
  assert.equal(result.program_range, "P8161-P8240");
  assert.equal(result.summary.source_conversation_capture_ready, true);
});

test("Plan registry progress engine covers P8161-P8240 phase rows", async () => {
  const result = await buildPlanRegistryProgressEngine(buildOptions());
  const phaseRanges = new Set(result.plan_registry_progress_phase_rows.map((row) => row.phase_range));

  assert.equal(result.plan_registry_progress_phase_rows.length, 4);
  for (const phase of ["P8161-P8180", "P8181-P8200", "P8201-P8220", "P8221-P8240"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.plan_registry_progress_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Plan registry progress engine registers long-term plans with owner engine and status", async () => {
  const result = await buildPlanRegistryProgressEngine(buildOptions());

  assert.equal(result.long_term_plan_registry_rows.length >= 2, true);
  assert.equal(result.long_term_plan_registry_rows.every((row) => row.plan_id), true);
  assert.equal(result.long_term_plan_registry_rows.every((row) => row.phase_id), true);
  assert.equal(result.long_term_plan_registry_rows.every((row) => row.milestone_id), true);
  assert.equal(result.long_term_plan_registry_rows.every((row) => row.owner_engine), true);
  assert.equal(result.long_term_plan_registry_rows.every((row) => row.status), true);
});

test("Plan registry progress engine exposes every expected phase progress status", async () => {
  const result = await buildPlanRegistryProgressEngine(buildOptions());
  const statuses = new Set(result.phase_progress_rows.map((row) => row.status));

  for (const status of ["planned", "in_progress", "blocked", "pass", "review_pending"]) {
    assert.equal(statuses.has(status), true);
    assert.equal(result.progress_status_calculation_rows.some((row) => row.status === status && row.visible_in_ui === true), true);
  }
});

test("Plan registry progress engine binds validator evidence gate and Claude review refs", async () => {
  const result = await buildPlanRegistryProgressEngine(buildOptions());

  assert.equal(result.validation_gate_review_link_rows.length, result.phase_progress_rows.length);
  assert.equal(result.validation_gate_review_link_rows.every((row) => row.validator_bound), true);
  assert.equal(result.validation_gate_review_link_rows.every((row) => row.evidence_bound), true);
  assert.equal(result.validation_gate_review_link_rows.every((row) => row.gate_bound), true);
  assert.equal(result.validation_gate_review_link_rows.every((row) => row.review_receipt_bound), true);
});

test("Plan registry progress engine surfaces stale context drift states", async () => {
  const result = await buildPlanRegistryProgressEngine(buildOptions());
  const driftIds = new Set(result.stale_context_drift_rows.map((row) => row.drift_id));

  for (const drift of ["drift.stale_plan", "drift.missing_conversation", "drift.validation_not_run", "drift.review_receipt_missing", "drift.context_mismatch"]) {
    assert.equal(driftIds.has(drift), true);
  }
  assert.equal(result.stale_context_drift_rows.every((row) => row.ui_badge_required), true);
  assert.equal(result.stale_context_drift_rows.every((row) => row.blocks_automatic_pass), true);
});

test("Plan registry progress engine negative fixtures block unsafe progress claims", async () => {
  const result = await buildPlanRegistryProgressEngine(buildOptions());
  const fixtureIds = new Set(result.plan_progress_negative_fixture_rows.map((row) => row.fixture_id));

  for (const fixture of ["negative.duplicate_plan_id", "negative.phase_without_owner_engine", "negative.pass_without_validation", "negative.review_pending_hidden", "negative.stale_context_pass", "negative.uncited_memory_progress"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.plan_progress_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.plan_progress_negative_fixture_rows.every((row) => row.unsafe_claim_allowed === false), true);
});

test("Plan registry progress engine keeps no-human production enterprise boundaries closed", async () => {
  const result = await buildPlanRegistryProgressEngine(buildOptions());
  const boundary = result.plan_progress_boundary;

  assert.equal(boundary.plan_registry_progress_engine_ready, true);
  assert.equal(boundary.ready_for_work_os_ui_v0_handoff, true);
  assert.equal(boundary.human_gate_in_scope, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.protected_closeout_enabled, false);
  assert.equal(boundary.runtime_execution_enabled, false);
  assert.equal(boundary.write_action_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Plan registry progress engine blocks if conversation capture source is not ready", async () => {
  const result = await buildPlanRegistryProgressEngine(buildOptions({
    conversationCapture: {
      summary: {
        conversation_capture_contract_status: "blocked",
      },
      transcript_reference_rows: [],
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.source_conversation_capture_ready, false);
  assert.equal(result.summary.plan_registry_progress_engine_status, "blocked");
});

test("Plan registry progress engine --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "plan-registry-progress-engine-"));
  const sentinelPath = path.join(outDir, "plan-registry-progress-engine.json");
  const sentinel = "{ \"sentinel\": \"plan-registry-progress-engine\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runPlanRegistryProgressEngine(buildOptions({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
