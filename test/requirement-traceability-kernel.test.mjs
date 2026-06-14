import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildRequirementTraceabilityApiResponse,
  buildRequirementTraceabilityKernel,
  runRequirementTraceabilityKernel,
  startRequirementTraceabilityApiServer,
} from "../src/requirement-traceability-kernel.mjs";
import { buildMultiProjectSaasControlPlane } from "../src/multi-project-saas-control-plane.mjs";

const RUN_AT = "2026-06-06T05:50:00.000Z";

function completedClaudeReviewReceipt() {
  return {
    schema_version: "claude-review-receipt.v1",
    generated_at: RUN_AT,
    reviewer_model: "claude-code-opus-4.8-max-or-latest-opus",
    review_effort: "max",
    review_scope: "P9601-P9800 requirement traceability kernel",
    review_status: "completed",
    finding_count: 0,
    blocking_finding_count: 0,
    findings: [],
    reviewer_mutation_allowed: false,
    claude_final_approval_allowed: false,
    reviewed_artifact_ref: "artifacts/requirement-traceability-kernel/latest/requirement-traceability-kernel.json",
  };
}

async function readySource() {
  return buildMultiProjectSaasControlPlane({ runAt: RUN_AT, write: false });
}

async function buildOptions(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    multiProjectSaasControlPlane: await readySource(),
    claudeReviewReceipt: completedClaudeReviewReceipt(),
    ...overrides,
  };
}

test("Requirement traceability kernel consumes P9600 source and completed Claude review", async () => {
  const result = await buildRequirementTraceabilityKernel(await buildOptions());

  assert.equal(result.validation.valid, true);
  assert.equal(result.program_range, "P9601-P9800");
  assert.equal(result.source_program_range, "P9401-P9600");
  assert.equal(result.summary.requirement_traceability_kernel_status, "ready_for_requirement_traceability_kernel");
  assert.equal(result.summary.source_p9600_ready, true);
  assert.equal(result.summary.claude_review_completed_now, true);
  assert.equal(result.summary.ready_for_p9801_handoff, true);
});

test("Requirement traceability kernel covers all P9601-P9800 phase rows", async () => {
  const result = await buildRequirementTraceabilityKernel(await buildOptions());
  const phaseRanges = new Set(result.requirement_traceability_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P9601-P9620", "P9621-P9640", "P9641-P9660", "P9661-P9680", "P9681-P9700", "P9701-P9720", "P9721-P9740", "P9741-P9760", "P9761-P9780", "P9781-P9800"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.requirement_traceability_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Requirement source registry creates stable ids per project trace", async () => {
  const result = await buildRequirementTraceabilityKernel(await buildOptions());

  assert.equal(result.requirement_source_registry_rows.length >= 10, true);
  assert.equal(result.requirement_source_registry_rows.every((row) => row.requirement_id.startsWith("REQ-")), true);
  assert.equal(result.requirement_source_registry_rows.every((row) => row.stable_id === true), true);
  assert.equal(result.requirement_source_registry_rows.every((row) => row.requirement_status === "covered"), true);
});

test("Requirement traceability links specs issues tests evidence claims gates checks and closeout", async () => {
  const result = await buildRequirementTraceabilityKernel(await buildOptions());
  const requirementIds = new Set(result.requirement_source_registry_rows.map((row) => row.requirement_id));

  for (const rows of [result.prd_spec_issue_link_rows, result.test_evidence_coverage_rows, result.claim_gate_check_trace_rows, result.release_closeout_link_rows, result.coverage_gap_blocker_rows]) {
    assert.equal(rows.length, requirementIds.size);
    assert.equal(rows.every((row) => requirementIds.has(row.requirement_id)), true);
    assert.equal(rows.every((row) => row.current_verdict === "pass"), true);
  }
  assert.equal(result.prd_spec_issue_link_rows.every((row) => row.prd_link_present && row.spec_link_present && row.issue_link_present), true);
  assert.equal(result.test_evidence_coverage_rows.every((row) => row.test_link_present && row.evidence_link_present && row.validator_link_present), true);
  assert.equal(result.claim_gate_check_trace_rows.every((row) => row.claim_link_present && row.gate_link_present && row.check_link_present), true);
  assert.equal(result.release_closeout_link_rows.every((row) => row.production_release_allowed === false && row.enterprise_release_allowed === false), true);
});

test("Requirement coverage gaps block closeout when any link is missing", async () => {
  const result = await buildRequirementTraceabilityKernel(await buildOptions());

  assert.equal(result.coverage_gap_blocker_rows.every((row) => row.missing_trace_link_count === 0), true);
  assert.equal(result.coverage_gap_blocker_rows.every((row) => row.blocks_p9800_closeout === false), true);
  assert.equal(result.summary.coverage_gap_count, 0);
});

test("Requirement traceability requires completed Claude review receipt", async () => {
  const result = await buildRequirementTraceabilityKernel(await buildOptions());
  const packet = result.claude_review_packet_rows[0];

  assert.equal(packet.review_packet_prepared, true);
  assert.equal(packet.review_required_now, true);
  assert.equal(packet.review_receipt_present, true);
  assert.equal(packet.review_completed_now, true);
  assert.equal(packet.blocking_finding_count, 0);
  assert.equal(packet.reviewer_mutation_allowed, false);
  assert.equal(packet.claude_final_approval_allowed, false);
});

test("Requirement traceability API routes are GET HEAD only and sanitized", async () => {
  const source = await readySource();
  const receipt = completedClaudeReviewReceipt();

  for (const apiPath of ["/api/trace/requirements", "/api/trace/spec-links", "/api/trace/test-evidence", "/api/trace/claim-gate-check", "/api/trace/release-closeout", "/api/trace/coverage-gaps", "/api/trace/review-packet", "/api/trace/boundary"]) {
    const response = await buildRequirementTraceabilityApiResponse(apiPath, {
      runAt: RUN_AT,
      method: "GET",
      multiProjectSaasControlPlane: source,
      claudeReviewReceipt: receipt,
    });
    assert.equal(response.status, 200);
    const parsed = JSON.parse(response.body);
    assert.equal(hasSensitiveKey(parsed), false, `${apiPath} should not contain sensitive response keys`);
  }

  const postResponse = await buildRequirementTraceabilityApiResponse("/api/trace/requirements", {
    runAt: RUN_AT,
    method: "POST",
    multiProjectSaasControlPlane: source,
    claudeReviewReceipt: receipt,
  });
  assert.equal(postResponse.status, 405);
});

test("Requirement traceability browser shell binds APIs without write controls", async () => {
  const source = await readySource();
  const response = await buildRequirementTraceabilityApiResponse("/traceability.html", {
    runAt: RUN_AT,
    method: "GET",
    multiProjectSaasControlPlane: source,
    claudeReviewReceipt: completedClaudeReviewReceipt(),
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.includes("traceability-root"), true);
  assert.equal(response.body.includes("window.REQUIREMENT_TRACEABILITY_API_PATHS"), true);
  for (const apiPath of ["/api/trace/requirements", "/api/trace/spec-links", "/api/trace/test-evidence", "/api/trace/claim-gate-check", "/api/trace/release-closeout", "/api/trace/coverage-gaps", "/api/trace/review-packet", "/api/trace/boundary"]) {
    assert.equal(response.body.includes(apiPath), true);
  }
  assert.equal(response.body.includes("data-protected-action"), false);
  assert.equal(response.body.includes("data-git-write"), false);
  assert.equal(response.body.includes("data-connector-write"), false);
  assert.equal(response.body.includes("method: 'POST'"), false);
});

test("Requirement traceability API server serves local artifact-backed routes", async () => {
  const source = await readySource();
  const started = await startRequirementTraceabilityApiServer({
    runAt: RUN_AT,
    port: 0,
    multiProjectSaasControlPlane: source,
    claudeReviewReceipt: completedClaudeReviewReceipt(),
  });

  try {
    const traceResponse = await fetch(`${started.url}/api/trace/requirements`);
    assert.equal(traceResponse.status, 200);
    const trace = await traceResponse.json();
    assert.equal(trace.collection, "requirements");
    assert.equal(trace.count > 0, true);
    assert.equal(hasSensitiveKey(trace), false);

    const htmlResponse = await fetch(`${started.url}/traceability.html`);
    assert.equal(htmlResponse.status, 200);
    const html = await htmlResponse.text();
    assert.equal(html.includes("Hermes Requirement Traceability"), true);
    assert.equal(html.includes("window.REQUIREMENT_TRACEABILITY_API_PATHS"), true);
  } finally {
    await new Promise((resolve, reject) => started.server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Requirement traceability freezes P9800 without authority expansion", async () => {
  const result = await buildRequirementTraceabilityKernel(await buildOptions());
  const boundary = result.requirement_traceability_boundary;

  assert.equal(result.p9800_freeze_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(boundary.ready_for_p9801_handoff, true);
  assert.equal(boundary.coverage_gaps_clear, true);
  assert.equal(boundary.claude_review_required_now, true);
  assert.equal(boundary.claude_review_completed_now, true);
  assert.equal(boundary.claude_review_blocking_finding_count, 0);
  assert.equal(boundary.api_write_methods_enabled, false);
  assert.equal(boundary.raw_transcript_body_visible, false);
  assert.equal(boundary.secret_keys_returned, false);
  assert.equal(boundary.codex_final_approval_allowed, false);
  assert.equal(boundary.claude_final_approval_allowed, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Requirement traceability negative fixtures block unsafe claims", async () => {
  const result = await buildRequirementTraceabilityKernel(await buildOptions());
  const fixtureIds = new Set(result.trace_negative_fixture_rows.map((row) => row.fixture_id));

  for (const fixture of ["negative.missing_p9600_source", "negative.missing_requirement_id", "negative.missing_test_evidence", "negative.claude_review_missing", "negative.claude_blocking_finding_ignored", "negative.production_enterprise_pass"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.trace_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.trace_negative_fixture_rows.every((row) => row.unsafe_claim_allowed === false), true);
});

test("Requirement traceability blocks if Claude review receipt is missing", async () => {
  const result = await buildRequirementTraceabilityKernel({
    runAt: RUN_AT,
    write: false,
    multiProjectSaasControlPlane: await readySource(),
    claudeReviewReceipt: null,
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.claude_review_required_now, true);
  assert.equal(result.summary.claude_review_completed_now, false);
  assert.equal(result.summary.requirement_traceability_kernel_status, "ready_for_required_claude_review");
});

test("Requirement traceability blocks if P9600 source is not ready", async () => {
  const result = await buildRequirementTraceabilityKernel({
    runAt: RUN_AT,
    write: false,
    multiProjectSaasControlPlane: {
      summary: {
        multi_project_saas_control_plane_status: "blocked",
        ready_for_p9601_handoff: false,
      },
    },
    claudeReviewReceipt: completedClaudeReviewReceipt(),
  });

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.source_p9600_ready, false);
});

test("Requirement traceability --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "requirement-traceability-kernel-"));
  const sentinelPath = path.join(outDir, "requirement-traceability-kernel.json");
  const sentinel = "{ \"sentinel\": \"requirement-traceability-kernel\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runRequirementTraceabilityKernel(await buildOptions({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

function hasSensitiveKey(value) {
  if (Array.isArray(value)) return value.some((item) => hasSensitiveKey(item));
  if (!value || typeof value !== "object") return false;
  return Object.keys(value).some((key) => /(^raw_|raw_|full_transcript|full_body|secret)/i.test(key))
    || Object.values(value).some((item) => hasSensitiveKey(item));
}
