import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildLocalSessionCaptureApiResponse,
  buildLocalSessionCaptureMemoryStore,
  runLocalSessionCaptureMemoryStore,
  startLocalSessionCaptureApiServer,
} from "../src/local-session-capture-memory-store.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P10400_READY_WITH_EXTERNAL_BLOCKERS = {
  schema_version: "ci-github-evidence-bridge.v1",
  program_range: "P10201-P10400",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    ci_github_evidence_bridge_status: "ready_for_ci_github_evidence_bridge",
    ready_for_p10401_handoff: true,
    p10400_bridge_ready: true,
    external_evidence_complete_now: false,
    external_closeout_blocker_count: 4,
    release_closeout_allowed_now: false,
    enterprise_trust_allowed_now: false,
  },
};

function buildOptions(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    ciGithubEvidenceBridge: P10400_READY_WITH_EXTERNAL_BLOCKERS,
    ...overrides,
  };
}

test("Local session capture memory store consumes P10400 bridge and preserves external blocker visibility", async () => {
  const result = await buildLocalSessionCaptureMemoryStore(buildOptions());

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.local_session_capture_memory_store_status, "ready_for_local_session_capture_memory_store");
  assert.equal(result.program_range, "P10401-P10600");
  assert.equal(result.summary.source_p10400_ready, true);
  assert.equal(result.summary.source_external_evidence_complete_now, false);
  assert.equal(result.summary.source_external_closeout_blocker_count, 4);
});

test("Local session capture memory store covers P10401-P10600 phase rows", async () => {
  const result = await buildLocalSessionCaptureMemoryStore(buildOptions());
  const phaseRanges = new Set(result.session_capture_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P10401-P10420", "P10421-P10440", "P10441-P10460", "P10461-P10480", "P10481-P10500", "P10501-P10520", "P10521-P10540", "P10541-P10560", "P10561-P10580", "P10581-P10600"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.session_capture_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Local session capture registers Codex Claude Harness and UI session identities", async () => {
  const result = await buildLocalSessionCaptureMemoryStore(buildOptions());
  const engineIds = new Set(result.session_source_identity_rows.map((row) => row.engine_id));

  assert.equal(engineIds.has("engine.codex.primary_developer"), true);
  assert.equal(engineIds.has("engine.claude.independent_reviewer"), true);
  assert.equal(engineIds.has("engine.harness.validator"), true);
  assert.equal(engineIds.has("engine.harness.ui_projection"), true);
  assert.equal(result.session_source_identity_rows.every((row) => row.source_id && row.session_id && row.run_id && row.transcript_ref), true);
  assert.equal(result.session_source_identity_rows.every((row) => row.final_approval_allowed === false && row.source_mutation_allowed === false), true);
});

test("Local capture store is append-only and stores transcript bodies as refs only", async () => {
  const result = await buildLocalSessionCaptureMemoryStore(buildOptions());

  assert.equal(result.local_capture_store_rows.length, 4);
  assert.equal(result.local_capture_store_rows.every((row) => row.append_only === true), true);
  assert.equal(result.local_capture_store_rows.every((row) => row.overwrite_allowed === false && row.delete_allowed === false), true);
  assert.equal(result.local_capture_store_rows.every((row) => row.body_inlined === false), true);
  assert.equal(result.local_capture_store_rows.every((row) => row.raw_body_stored_as_ref_only === true), true);
});

test("Local session capture separates raw full and redacted transcript tiers", async () => {
  const result = await buildLocalSessionCaptureMemoryStore(buildOptions());
  const tierMap = new Map(result.transcript_tier_boundary_rows.map((row) => [row.tier_id, row]));

  assert.equal(tierMap.get("tier.raw").ui_visible, false);
  assert.equal(tierMap.get("tier.raw").api_visible, false);
  assert.equal(tierMap.get("tier.full").ui_visible, false);
  assert.equal(tierMap.get("tier.full").api_visible, false);
  assert.equal(tierMap.get("tier.redacted").ui_visible, true);
  assert.equal(tierMap.get("tier.redacted").api_visible, true);
});

test("Local session capture extracts cited redacted events without adopting them as truth", async () => {
  const result = await buildLocalSessionCaptureMemoryStore(buildOptions());
  const eventTypes = new Set(result.session_event_extraction_rows.map((row) => row.event_type));

  for (const eventType of ["goal", "decision", "blocker", "validation_event", "review_event", "phase_progress"]) {
    assert.equal(eventTypes.has(eventType), true);
  }
  assert.equal(result.session_event_extraction_rows.every((row) => row.source_citation_required === true && row.source_citation_present === true), true);
  assert.equal(result.session_event_extraction_rows.every((row) => row.raw_body_embedded === false && row.full_body_embedded === false), true);
  assert.equal(result.session_event_extraction_rows.every((row) => row.adopted_as_truth === false && row.mutates_plan_directly === false), true);
});

test("Local session capture binds memory object refs hashes and provenance without inline bodies", async () => {
  const result = await buildLocalSessionCaptureMemoryStore(buildOptions());

  assert.equal(result.memory_object_ref_rows.length, 5);
  assert.equal(result.memory_object_ref_rows.every((row) => row.object_ref && row.sha256_ref && row.provenance_ref), true);
  assert.equal(result.memory_object_ref_rows.every((row) => row.body_inlined === false), true);
  assert.equal(result.memory_object_ref_rows.every((row) => row.secret_material_inlined === false && row.client_material_inlined === false), true);
});

test("Local session capture exposes duplicate stale uncited and cross-domain drift detectors", async () => {
  const result = await buildLocalSessionCaptureMemoryStore(buildOptions());
  const detectorTypes = new Set(result.session_drift_detector_rows.map((row) => row.detector_type));

  for (const detectorType of ["duplicate_session_event", "stale_context", "uncited_memory", "cross_domain_contamination", "missing_redaction", "authority_pollution"]) {
    assert.equal(detectorTypes.has(detectorType), true);
  }
  assert.equal(result.session_drift_detector_rows.every((row) => row.detector_present === true && row.unsafe_claim_allowed === false), true);
});

test("Local session capture API projection is GET HEAD only and sanitized", async () => {
  const result = await buildLocalSessionCaptureMemoryStore(buildOptions());
  const apiPaths = new Set(result.session_capture_api_route_rows.map((row) => row.api_path));

  for (const apiPath of ["/health", "/api/session-capture/sources", "/api/session-capture/transcripts", "/api/session-capture/events", "/api/session-capture/objects", "/api/session-capture/drift", "/api/session-capture/boundary", "/api/session-capture/summary"]) {
    assert.equal(apiPaths.has(apiPath), true);
  }
  assert.equal(result.session_capture_api_route_rows.every((row) => row.methods_allowed.includes("GET") && row.methods_allowed.includes("HEAD")), true);
  assert.equal(result.session_capture_api_route_rows.every((row) => row.write_enabled === false && row.mutates_state === false), true);

  const response = await buildLocalSessionCaptureApiResponse("/api/session-capture/sources", buildOptions());
  assert.equal(response.status, 200);
  assert.equal(hasSensitiveKey(JSON.parse(response.body)), false);

  const blocked = await buildLocalSessionCaptureApiResponse("/api/session-capture/sources", { ...buildOptions(), method: "POST" });
  assert.equal(blocked.status, 405);
});

test("Local session capture API server serves boundary route", async () => {
  const { server, url } = await startLocalSessionCaptureApiServer({ ...buildOptions(), port: 0 });
  try {
    const response = await fetch(`${url}/api/session-capture/boundary`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ready_for_p10601_handoff, true);
    assert.equal(body.codex_final_approval_allowed, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Local session capture browser shell exposes no write controls or transcript bodies", async () => {
  const result = await buildLocalSessionCaptureMemoryStore(buildOptions());

  assert.equal(result.session_capture_browser_smoke_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(/<form|<button|type="submit"|apply now|write now|delete now/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
});

test("Local session capture freezes P10600 without authority expansion", async () => {
  const result = await buildLocalSessionCaptureMemoryStore(buildOptions());
  const boundary = result.session_capture_boundary;

  assert.equal(result.p10600_freeze_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(boundary.ready_for_p10601_handoff, true);
  assert.equal(boundary.raw_transcript_body_visible, false);
  assert.equal(boundary.full_transcript_body_visible, false);
  assert.equal(boundary.runtime_recall_enabled, false);
  assert.equal(boundary.codex_final_approval_allowed, false);
  assert.equal(boundary.claude_final_approval_allowed, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Local session capture negative fixtures block unsafe claims", async () => {
  const result = await buildLocalSessionCaptureMemoryStore(buildOptions());
  const fixtureIds = new Set(result.session_capture_negative_fixture_rows.map((row) => row.fixture_id));

  for (const fixture of ["negative.missing_p10400_source", "negative.missing_transcript_ref", "negative.raw_transcript_api_response", "negative.duplicate_session_event", "negative.uncited_memory_claim", "negative.cross_domain_leak", "negative.api_write_method", "negative.codex_final_approval", "negative.claude_final_approval", "negative.runtime_recall_enabled", "negative.production_enterprise_pass"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.session_capture_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.session_capture_negative_fixture_rows.every((row) => row.unsafe_claim_allowed === false), true);
});

test("Local session capture blocks if P10400 source is not ready", async () => {
  const result = await buildLocalSessionCaptureMemoryStore(buildOptions({
    ciGithubEvidenceBridge: {
      schema_version: "ci-github-evidence-bridge.v1",
      program_range: "P10201-P10400",
      validation: { valid: false, error_count: 1, errors: [] },
      summary: {
        ci_github_evidence_bridge_status: "blocked_ci_github_evidence_bridge",
        ready_for_p10401_handoff: false,
        p10400_bridge_ready: false,
      },
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.source_p10400_ready, false);
  assert.equal(result.summary.local_session_capture_memory_store_status, "blocked_local_session_capture_memory_store");
});

test("Local session capture --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "local-session-capture-memory-store-"));
  const sentinelPath = path.join(outDir, "local-session-capture-memory-store.json");
  const sentinel = "{ \"sentinel\": \"local-session-capture-memory-store\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runLocalSessionCaptureMemoryStore(buildOptions({ outDir, check: true, write: false }));
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
