import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildClaudeReviewIntegrationApiResponse,
  buildClaudeReviewIntegrationLane,
  runClaudeReviewIntegrationLane,
  startClaudeReviewIntegrationApiServer,
} from "../src/claude-review-integration-lane.mjs";
import { buildProductBuildVerificationLoop } from "../src/product-build-verification-loop.mjs";
import { buildRequirementTraceabilityKernel } from "../src/requirement-traceability-kernel.mjs";

const RUN_AT = "2026-06-06T11:20:00.000Z";

let readyP9800Promise;
let readyP10000Promise;

function completedP9800ClaudeReviewReceipt() {
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
    production_pass_allowed: false,
    enterprise_pass_allowed: false,
    reviewed_artifact_ref: "artifacts/requirement-traceability-kernel/latest/requirement-traceability-kernel.json",
  };
}

function completedP10000ClaudeReviewReceipt() {
  return {
    schema_version: "claude-review-receipt.v1",
    generated_at: RUN_AT,
    reviewer_model_requested: "opus",
    reviewer_model_observed: "claude-opus-4-7",
    review_effort_requested: "max",
    review_scope: "P9801-P10000 product build verification loop",
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
    reviewed_artifact_ref: "artifacts/product-build-verification-loop/latest/product-build-verification-loop.json",
  };
}

function completedP10200ClaudeReviewReceipt(findings = []) {
  const blockingSeverities = new Set(["blocking", "critical", "p0", "p1"]);
  const blockingFindingCount = findings.filter((finding) => blockingSeverities.has(String(finding.severity ?? "").toLowerCase()) || finding.blocking === true).length;
  return {
    schema_version: "claude-review-receipt.v1",
    generated_at: RUN_AT,
    reviewer_model_requested: "opus",
    reviewer_model_observed: "claude-opus-4-7",
    review_effort_requested: "max",
    review_scope: "P10001-P10200 Claude review integration lane",
    review_status: "completed",
    finding_count: findings.length,
    blocking_finding_count: blockingFindingCount,
    findings,
    reviewer_mutation_allowed: false,
    reviewer_mutated_source: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    production_pass_allowed: false,
    enterprise_pass_allowed: false,
    reviewed_artifact_ref: "artifacts/claude-review-integration-lane/latest/claude-review-integration-lane.json",
  };
}

async function readyP9800Source() {
  readyP9800Promise ??= buildRequirementTraceabilityKernel({
    runAt: RUN_AT,
    write: false,
    claudeReviewReceipt: completedP9800ClaudeReviewReceipt(),
  });
  return structuredClone(await readyP9800Promise);
}

async function readyP10000Source() {
  readyP10000Promise ??= buildProductBuildVerificationLoop({
    runAt: RUN_AT,
    write: false,
    requirementTraceabilityKernel: await readyP9800Source(),
    claudeReviewReceipt: completedP10000ClaudeReviewReceipt(),
  });
  return structuredClone(await readyP10000Promise);
}

async function buildOptions(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    productBuildVerificationLoop: await readyP10000Source(),
    sourceClaudeReviewReceipt: completedP10000ClaudeReviewReceipt(),
    claudeReviewReceipt: completedP10200ClaudeReviewReceipt(),
    ...overrides,
  };
}

test("Claude review integration lane consumes P10000 source and completed review receipts", async () => {
  const result = await buildClaudeReviewIntegrationLane(await buildOptions());

  assert.equal(result.validation.valid, true);
  assert.equal(result.program_range, "P10001-P10200");
  assert.equal(result.source_program_range, "P9801-P10000");
  assert.equal(result.summary.claude_review_integration_status, "ready_for_claude_review_integration_lane");
  assert.equal(result.summary.source_p10000_ready, true);
  assert.equal(result.summary.source_review_receipt_completed_now, true);
  assert.equal(result.summary.p10200_claude_review_completed_now, true);
  assert.equal(result.summary.p10200_freeze_ready, true);
  assert.equal(result.summary.ready_for_p10201_handoff, true);
});

test("Claude review integration lane covers all P10001-P10200 phase rows", async () => {
  const result = await buildClaudeReviewIntegrationLane(await buildOptions());
  const phaseRanges = new Set(result.claude_review_integration_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P10001-P10020", "P10021-P10040", "P10041-P10060", "P10061-P10080", "P10081-P10100", "P10101-P10120", "P10121-P10140", "P10141-P10160", "P10161-P10180", "P10181-P10200"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.claude_review_integration_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Claude review request packets cover the closeout lane and P10000 source review packets", async () => {
  const source = await readyP10000Source();
  const result = await buildClaudeReviewIntegrationLane(await buildOptions({ productBuildVerificationLoop: source }));

  assert.equal(result.review_request_packet_rows.length, source.build_review_packet_rows.length + 1);
  assert.equal(result.review_request_packet_rows[0].review_request_id, "CLAUDE-REQ-P10200-CLOSEOUT");
  assert.equal(result.review_request_packet_rows.every((row) => row.requested_effort === "max"), true);
  assert.equal(result.review_request_packet_rows.every((row) => row.reviewer_write_tools_allowed === false), true);
  assert.equal(result.review_request_packet_rows.every((row) => row.reviewer_mutation_allowed === false), true);
});

test("Claude review integration captures model effort and receipt intake evidence", async () => {
  const result = await buildClaudeReviewIntegrationLane(await buildOptions());

  assert.equal(result.model_effort_evidence_rows.length, 2);
  assert.equal(result.model_effort_evidence_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.model_effort_evidence_rows.every((row) => String(row.review_effort_requested).toLowerCase() === "max"), true);
  assert.equal(result.review_receipt_intake_rows.every((row) => row.review_status === "completed"), true);
  assert.equal(result.review_receipt_intake_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Claude review packet documents expected pre-receipt bootstrap blockers", async () => {
  const result = await buildClaudeReviewIntegrationLane(await buildOptions({
    claudeReviewReceipt: null,
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.review_packet_markdown.includes("bootstrap_review_instruction"), true);
  assert.equal(result.review_packet_markdown.includes("expected_pre_receipt_blocks"), true);
  assert.equal(result.review_packet_markdown.includes("validation_errors"), true);
});

test("Claude review integration normalizes resolved nonblocking findings with revalidation", async () => {
  const result = await buildClaudeReviewIntegrationLane(await buildOptions({
    claudeReviewReceipt: completedP10200ClaudeReviewReceipt([
      {
        finding_id: "CRIL-DOC-001",
        severity: "p2",
        category: "documentation",
        title: "Clarify review packet wording",
        status: "resolved",
        resolved: true,
        revalidation_ref: "npm run platform:claude-review-integration-lane -- --check",
      },
    ]),
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.finding_count, 1);
  assert.equal(result.summary.unresolved_finding_count, 0);
  assert.equal(result.finding_normalization_rows[0].blocking, false);
  assert.equal(result.finding_normalization_rows[0].unresolved, false);
  assert.equal(result.review_revalidation_binding_rows[0].current_verdict, "pass");
});

test("Claude review integration blocks unresolved findings", async () => {
  const result = await buildClaudeReviewIntegrationLane(await buildOptions({
    claudeReviewReceipt: completedP10200ClaudeReviewReceipt([
      {
        finding_id: "CRIL-OPEN-001",
        severity: "p2",
        category: "test",
        title: "Missing regression evidence",
        status: "open",
        resolved: false,
      },
    ]),
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.claude_review_integration_status, "ready_for_required_claude_review");
  assert.equal(result.summary.unresolved_finding_count, 1);
  assert.equal(result.finding_normalization_rows[0].current_verdict, "block");
  assert.equal(result.unresolved_finding_blocker_rows[0].current_verdict, "block");
  assert.equal(result.review_authority_boundary.p10200_freeze_ready, false);
});

test("Claude review integration blocks blocking findings", async () => {
  const result = await buildClaudeReviewIntegrationLane(await buildOptions({
    claudeReviewReceipt: completedP10200ClaudeReviewReceipt([
      {
        finding_id: "CRIL-P1-001",
        severity: "p1",
        category: "authority",
        title: "Claude can approve final closeout",
        status: "resolved",
        resolved: true,
        revalidation_ref: "npm run platform:claude-review-integration-lane -- --check",
      },
    ]),
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.blocking_finding_count, 1);
  assert.equal(result.finding_normalization_rows[0].blocking, true);
  assert.equal(result.unresolved_finding_blocker_rows[0].current_verdict, "block");
});

test("Claude review integration blocks if P10200 receipt is missing", async () => {
  const result = await buildClaudeReviewIntegrationLane(await buildOptions({
    claudeReviewReceipt: null,
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.p10200_claude_review_required_now, true);
  assert.equal(result.summary.p10200_claude_review_completed_now, false);
  assert.equal(result.summary.claude_review_integration_status, "ready_for_required_claude_review");
});

test("Claude review integration blocks if P10000 source is not ready", async () => {
  const source = await readyP10000Source();
  source.summary.product_build_verification_status = "blocked";
  source.summary.ready_for_p10001_handoff = false;
  source.summary.p10000_freeze_ready = false;
  source.validation.valid = false;
  source.validation.errors = [{ validation_id: "source.not_ready", category: "source", message: "forced source block" }];

  const result = await buildClaudeReviewIntegrationLane(await buildOptions({
    productBuildVerificationLoop: source,
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.source_p10000_ready, false);
  assert.equal(result.p10000_source_binding_rows[0].current_verdict, "block");
});

test("Claude review integration API routes are GET HEAD only and sanitized", async () => {
  const source = await readyP10000Source();
  const sourceReceipt = completedP10000ClaudeReviewReceipt();
  const laneReceipt = completedP10200ClaudeReviewReceipt();

  for (const apiPath of ["/health", "/api/review/requests", "/api/review/model-effort", "/api/review/receipts", "/api/review/findings", "/api/review/unresolved", "/api/review/revalidation", "/api/review/boundary"]) {
    const response = await buildClaudeReviewIntegrationApiResponse(apiPath, {
      runAt: RUN_AT,
      method: "GET",
      productBuildVerificationLoop: source,
      sourceClaudeReviewReceipt: sourceReceipt,
      claudeReviewReceipt: laneReceipt,
    });
    assert.equal(response.status, 200);
    const parsed = JSON.parse(response.body);
    assert.equal(hasSensitiveKey(parsed), false, `${apiPath} should not contain sensitive response keys`);
  }

  const postResponse = await buildClaudeReviewIntegrationApiResponse("/api/review/requests", {
    runAt: RUN_AT,
    method: "POST",
    productBuildVerificationLoop: source,
    sourceClaudeReviewReceipt: sourceReceipt,
    claudeReviewReceipt: laneReceipt,
  });
  assert.equal(postResponse.status, 405);
});

test("Claude review integration browser shell binds APIs without write controls", async () => {
  const response = await buildClaudeReviewIntegrationApiResponse("/claude-review-integration.html", {
    runAt: RUN_AT,
    method: "GET",
    productBuildVerificationLoop: await readyP10000Source(),
    sourceClaudeReviewReceipt: completedP10000ClaudeReviewReceipt(),
    claudeReviewReceipt: completedP10200ClaudeReviewReceipt(),
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.includes("Claude Review Integration Lane"), true);
  assert.equal(/<button|type="submit"|merge|deploy|apply patch/i.test(response.body), false);
});

test("Claude review integration API server serves local artifact-backed routes", async () => {
  const started = await startClaudeReviewIntegrationApiServer({
    runAt: RUN_AT,
    port: 0,
    productBuildVerificationLoop: await readyP10000Source(),
    sourceClaudeReviewReceipt: completedP10000ClaudeReviewReceipt(),
    claudeReviewReceipt: completedP10200ClaudeReviewReceipt(),
  });

  try {
    const response = await fetch(`${started.url}/api/review/boundary`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.claude_final_approval_allowed, false);
  } finally {
    await new Promise((resolve) => started.server.close(resolve));
  }
});

test("Claude review integration freezes P10200 without authority expansion", async () => {
  const result = await buildClaudeReviewIntegrationLane(await buildOptions());

  assert.equal(result.review_authority_boundary.p10200_freeze_ready, true);
  assert.equal(result.review_authority_boundary.reviewer_mutation_allowed, false);
  assert.equal(result.review_authority_boundary.codex_final_approval_allowed, false);
  assert.equal(result.review_authority_boundary.claude_final_approval_allowed, false);
  assert.equal(result.review_authority_boundary.claude_replaces_independent_github_approval, false);
  assert.equal(result.review_authority_boundary.claude_replaces_human_owner_adjudication, false);
  assert.equal(result.review_authority_boundary.production_pass_enabled, false);
  assert.equal(result.review_authority_boundary.enterprise_pass_enabled, false);
});

test("Claude review integration negative fixtures block unsafe claims", async () => {
  const result = await buildClaudeReviewIntegrationLane(await buildOptions());
  const expectedBlocks = new Set(result.review_negative_fixture_rows.map((row) => row.expected_block_code));

  for (const expected of [
    "BLOCK_MISSING_P10000_SOURCE",
    "BLOCK_MISSING_REVIEW_REQUEST",
    "BLOCK_MISSING_MODEL_EFFORT",
    "BLOCK_MISSING_REVIEW_RECEIPT",
    "BLOCK_UNRESOLVED_FINDING_IGNORED",
    "BLOCK_BLOCKING_FINDING_IGNORED",
    "BLOCK_REVALIDATION_MISSING",
    "BLOCK_REVIEWER_MUTATION",
    "BLOCK_CLAUDE_FINAL_APPROVAL",
    "BLOCK_PRODUCTION_ENTERPRISE_PASS",
    "BLOCK_API_MUTATION_OR_RAW",
  ]) {
    assert.equal(expectedBlocks.has(expected), true);
  }
  assert.equal(result.review_negative_fixture_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Claude review integration --check does not overwrite artifacts", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p10200-"));
  const sentinelPath = path.join(tmpDir, "claude-review-integration-lane.json");
  await writeFile(sentinelPath, "sentinel", "utf8");

  const result = await runClaudeReviewIntegrationLane(await buildOptions({
    check: true,
    write: false,
    outDir: tmpDir,
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(await readFile(sentinelPath, "utf8"), "sentinel");
  await rm(tmpDir, { recursive: true, force: true });
});

function hasSensitiveKey(value) {
  if (Array.isArray(value)) return value.some(hasSensitiveKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, entry]) => /(raw_|full_transcript|full_body|secret|api_key|token)/i.test(key) || hasSensitiveKey(entry));
}
