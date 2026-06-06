import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildContextRecallApiResponse,
  buildContextRecallDriftGuard,
  runContextRecallDriftGuard,
  startContextRecallApiServer,
} from "../src/context-recall-drift-guard.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P10600_READY = {
  schema_version: "local-session-capture-memory-store.v1",
  program_range: "P10401-P10600",
  validation: { valid: true, error_count: 0, errors: [] },
  session_event_extraction_rows: [
    { event_type: "goal" },
    { event_type: "decision" },
    { event_type: "blocker" },
    { event_type: "validation_event" },
    { event_type: "review_event" },
    { event_type: "phase_progress" },
  ],
  summary: {
    local_session_capture_memory_store_status: "ready_for_local_session_capture_memory_store",
    ready_for_p10601_handoff: true,
    raw_transcript_body_visible: false,
    full_transcript_body_visible: false,
    raw_transcript_api_visible: false,
    runtime_recall_enabled: false,
    retrieval_truth_enabled: false,
  },
};

const CLAUDE_REVIEW_READY = {
  schema_version: "claude-review-receipt.v1",
  review_status: "completed",
  finding_count: 0,
  blocking_finding_count: 0,
  findings: [],
  reviewer_mutation_allowed: false,
  reviewer_mutated_source: false,
  codex_final_approval_allowed: false,
  claude_final_approval_allowed: false,
  production_pass_allowed: false,
  enterprise_pass_allowed: false,
};

function buildOptions(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    localSessionCapture: P10600_READY,
    claudeReviewReceipt: CLAUDE_REVIEW_READY,
    ...overrides,
  };
}

test("Context recall drift guard consumes P10600 source and required Claude review", async () => {
  const result = await buildContextRecallDriftGuard(buildOptions());

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.context_recall_drift_guard_status, "ready_for_context_recall_drift_guard");
  assert.equal(result.program_range, "P10601-P10800");
  assert.equal(result.summary.source_p10600_ready, true);
  assert.equal(result.summary.p10800_claude_review_required_now, true);
  assert.equal(result.summary.p10800_claude_review_completed_now, true);
});

test("Context recall drift guard covers P10601-P10800 phase rows", async () => {
  const result = await buildContextRecallDriftGuard(buildOptions());
  const phaseRanges = new Set(result.context_recall_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P10601-P10620", "P10621-P10640", "P10641-P10660", "P10661-P10680", "P10681-P10700", "P10701-P10720", "P10721-P10740", "P10741-P10760", "P10761-P10780", "P10781-P10800"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.context_recall_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Context recall drift guard creates cited redacted recall candidates", async () => {
  const result = await buildContextRecallDriftGuard(buildOptions());
  const types = new Set(result.next_session_recall_candidate_rows.map((row) => row.recall_type));

  for (const type of ["goal", "decision", "blocker", "validation_event", "review_event", "phase_progress"]) {
    assert.equal(types.has(type), true);
  }
  assert.equal(result.next_session_recall_candidate_rows.every((row) => row.source_citation_present === true && row.citation_ref), true);
  assert.equal(result.next_session_recall_candidate_rows.every((row) => row.raw_body_embedded === false && row.full_body_embedded === false), true);
  assert.equal(result.next_session_recall_candidate_rows.every((row) => row.adopted_as_truth === false && row.mutates_context_directly === false), true);
});

test("Context recall drift guard enforces citation freshness conflict uncited and domain boundary rows", async () => {
  const result = await buildContextRecallDriftGuard(buildOptions());

  assert.equal(result.recall_citation_enforcement_rows.every((row) => row.uncited_recall_allowed === false && row.citation_ref), true);
  assert.equal(result.recall_freshness_policy_rows.every((row) => row.stale_fact_as_current_allowed === false), true);
  assert.equal(result.recall_conflict_detection_rows.every((row) => row.hidden_conflict_allowed === false && row.auto_resolve_allowed === false), true);
  assert.equal(result.uncited_memory_blocker_rows.every((row) => row.detector_present === true && row.uncited_memory_allowed === false), true);
  assert.equal(result.cross_domain_boundary_rows.every((row) => row.scope_match_required === true && row.cross_domain_recall_allowed === false), true);
});

test("Context recall API projection is GET HEAD only and sanitized", async () => {
  const result = await buildContextRecallDriftGuard(buildOptions());
  const apiPaths = new Set(result.context_recall_api_route_rows.map((row) => row.api_path));

  for (const apiPath of ["/health", "/api/context-recall/candidates", "/api/context-recall/citations", "/api/context-recall/freshness", "/api/context-recall/conflicts", "/api/context-recall/uncited", "/api/context-recall/boundaries", "/api/context-recall/boundary", "/api/context-recall/summary"]) {
    assert.equal(apiPaths.has(apiPath), true);
  }
  assert.equal(result.context_recall_api_route_rows.every((row) => row.methods_allowed.includes("GET") && row.methods_allowed.includes("HEAD")), true);
  assert.equal(result.context_recall_api_route_rows.every((row) => row.write_enabled === false && row.mutates_state === false), true);

  const response = await buildContextRecallApiResponse("/api/context-recall/candidates", buildOptions());
  assert.equal(response.status, 200);
  assert.equal(hasSensitiveKey(JSON.parse(response.body)), false);

  const blocked = await buildContextRecallApiResponse("/api/context-recall/candidates", { ...buildOptions(), method: "POST" });
  assert.equal(blocked.status, 405);
});

test("Context recall API server serves boundary route", async () => {
  const { server, url } = await startContextRecallApiServer({ ...buildOptions(), port: 0 });
  try {
    const response = await fetch(`${url}/api/context-recall/boundary`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ready_for_p10801_handoff, true);
    assert.equal(body.uncited_recall_allowed, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Context recall browser shell exposes no write controls or raw transcript bodies", async () => {
  const result = await buildContextRecallDriftGuard(buildOptions());

  assert.equal(result.context_recall_browser_smoke_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(/<form|<button|type="submit"|apply now|write now|delete now/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
});

test("Context recall negative fixtures block unsafe recall and authority claims", async () => {
  const result = await buildContextRecallDriftGuard(buildOptions());
  const fixtureIds = new Set(result.context_recall_negative_fixture_rows.map((row) => row.fixture_id));

  for (const fixture of ["negative.missing_p10600_source", "negative.missing_claude_review_receipt", "negative.uncited_recall", "negative.raw_transcript_recall", "negative.stale_fact_as_current", "negative.conflict_hidden", "negative.cross_domain_recall", "negative.api_write_method", "negative.auto_context_mutation", "negative.codex_final_approval", "negative.claude_final_approval", "negative.production_enterprise_pass"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.context_recall_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.context_recall_negative_fixture_rows.every((row) => row.unsafe_claim_allowed === false), true);
});

test("Context recall freezes P10800 without recall truth or authority expansion", async () => {
  const result = await buildContextRecallDriftGuard(buildOptions());
  const boundary = result.context_recall_boundary;

  assert.equal(result.p10800_freeze_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(boundary.ready_for_p10801_handoff, true);
  assert.equal(boundary.next_session_recall_bundle_ready, true);
  assert.equal(boundary.uncited_recall_allowed, false);
  assert.equal(boundary.stale_fact_as_current_allowed, false);
  assert.equal(boundary.cross_domain_recall_allowed, false);
  assert.equal(boundary.auto_context_mutation_enabled, false);
  assert.equal(boundary.runtime_recall_enabled, false);
  assert.equal(boundary.retrieval_truth_enabled, false);
  assert.equal(boundary.codex_final_approval_allowed, false);
  assert.equal(boundary.claude_final_approval_allowed, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Context recall stays pending when required Claude review receipt is missing", async () => {
  const result = await buildContextRecallDriftGuard(buildOptions({ claudeReviewReceipt: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.context_recall_drift_guard_status, "ready_for_required_claude_review");
  assert.equal(result.summary.p10800_claude_review_completed_now, false);
  assert.equal(result.context_recall_boundary.ready_for_p10801_handoff, false);
});

test("Context recall blocks if P10600 source is not ready", async () => {
  const result = await buildContextRecallDriftGuard(buildOptions({
    localSessionCapture: {
      schema_version: "local-session-capture-memory-store.v1",
      program_range: "P10401-P10600",
      validation: { valid: false, error_count: 1, errors: [] },
      summary: {
        local_session_capture_memory_store_status: "blocked_local_session_capture_memory_store",
        ready_for_p10601_handoff: false,
      },
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.source_p10600_ready, false);
  assert.equal(result.summary.context_recall_drift_guard_status, "blocked_context_recall_drift_guard");
});

test("Context recall --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "context-recall-drift-guard-"));
  const sentinelPath = path.join(outDir, "context-recall-drift-guard.json");
  const sentinel = "{ \"sentinel\": \"context-recall-drift-guard\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runContextRecallDriftGuard(buildOptions({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

function hasSensitiveKey(value) {
  if (Array.isArray(value)) return value.some(hasSensitiveKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, entry]) => /(^raw_|raw_|full_transcript|full_body|secret|api_key|token|authorization|body_inlined)/i.test(key) || hasSensitiveKey(entry));
}
