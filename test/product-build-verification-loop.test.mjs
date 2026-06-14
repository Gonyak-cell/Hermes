import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildProductBuildVerificationApiResponse,
  buildProductBuildVerificationLoop,
  runProductBuildVerificationLoop,
  startProductBuildVerificationApiServer,
} from "../src/product-build-verification-loop.mjs";
import { buildRequirementTraceabilityKernel } from "../src/requirement-traceability-kernel.mjs";

const RUN_AT = "2026-06-06T06:20:00.000Z";

let readySourcePromise;

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
    reviewed_artifact_ref: "artifacts/requirement-traceability-kernel/latest/requirement-traceability-kernel.json",
  };
}

function completedP10000ClaudeReviewReceipt(findings = []) {
  const blockingSeverities = new Set(["blocking", "critical", "p0", "p1"]);
  const blockingFindingCount = findings.filter((finding) => blockingSeverities.has(String(finding.severity ?? "").toLowerCase())).length;
  return {
    schema_version: "claude-review-receipt.v1",
    generated_at: RUN_AT,
    reviewer_model: "claude-code-opus-4.8-max-or-latest-opus",
    review_effort: "max",
    review_scope: "P9801-P10000 product build verification loop",
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
    reviewed_artifact_ref: "artifacts/product-build-verification-loop/latest/product-build-verification-loop.json",
  };
}

async function readyP9800Source() {
  readySourcePromise ??= buildRequirementTraceabilityKernel({
    runAt: RUN_AT,
    write: false,
    claudeReviewReceipt: completedP9800ClaudeReviewReceipt(),
  });
  return structuredClone(await readySourcePromise);
}

async function buildOptions(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    requirementTraceabilityKernel: await readyP9800Source(),
    claudeReviewReceipt: completedP10000ClaudeReviewReceipt(),
    ...overrides,
  };
}

test("Product build verification loop consumes P9800 source and completed Claude review", async () => {
  const result = await buildProductBuildVerificationLoop(await buildOptions());

  assert.equal(result.validation.valid, true);
  assert.equal(result.program_range, "P9801-P10000");
  assert.equal(result.source_program_range, "P9601-P9800");
  assert.equal(result.summary.product_build_verification_status, "ready_for_product_build_verification_loop");
  assert.equal(result.summary.source_p9800_ready, true);
  assert.equal(result.summary.claude_review_completed_now, true);
  assert.equal(result.summary.p10000_freeze_ready, true);
  assert.equal(result.summary.ready_for_p10001_handoff, true);
});

test("Product build verification loop covers all P9801-P10000 phase rows", async () => {
  const result = await buildProductBuildVerificationLoop(await buildOptions());
  const phaseRanges = new Set(result.product_build_verification_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P9801-P9820", "P9821-P9840", "P9841-P9860", "P9861-P9880", "P9881-P9900", "P9901-P9920", "P9921-P9940", "P9941-P9960", "P9961-P9980", "P9981-P10000"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.product_build_verification_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Product build verification creates feature packets for every traced requirement", async () => {
  const source = await readyP9800Source();
  const result = await buildProductBuildVerificationLoop(await buildOptions({ requirementTraceabilityKernel: source }));
  const requirementIds = new Set(source.requirement_source_registry_rows.map((row) => row.requirement_id));
  const featureRequirementIds = new Set(result.feature_implementation_packet_rows.map((row) => row.requirement_id));

  assert.equal(result.feature_implementation_packet_rows.length, requirementIds.size);
  for (const requirementId of requirementIds) assert.equal(featureRequirementIds.has(requirementId), true);
  assert.equal(result.feature_implementation_packet_rows.every((row) => row.feature_id.startsWith("FEAT-")), true);
  assert.equal(result.feature_implementation_packet_rows.every((row) => row.protected_write_enabled === false), true);
  assert.equal(result.feature_implementation_packet_rows.every((row) => row.direct_deploy_enabled === false), true);
});

test("Product build verification binds tests evidence review packets and closeout rows", async () => {
  const result = await buildProductBuildVerificationLoop(await buildOptions());
  const featureCount = result.feature_implementation_packet_rows.length;

  assert.equal(result.build_test_evidence_binding_rows.length, featureCount);
  assert.equal(result.build_review_packet_rows.length, featureCount);
  assert.equal(result.build_test_evidence_binding_rows.every((row) => row.test_present && row.evidence_present && row.gate_present), true);
  assert.equal(result.build_review_packet_rows.every((row) => row.claude_review_required_now && row.reviewer_mutation_allowed === false), true);
  assert.equal(result.closeout_readiness_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Product build verification requires completed read-only Claude review receipt", async () => {
  const result = await buildProductBuildVerificationLoop(await buildOptions());
  const receipt = result.claude_review_receipt_rows[0];

  assert.equal(receipt.current_verdict, "pass");
  assert.equal(receipt.review_status, "completed");
  assert.equal(receipt.blocking_finding_count, 0);
  assert.equal(receipt.reviewer_mutation_allowed, false);
  assert.equal(receipt.claude_final_approval_allowed, false);
});

test("Product build verification normalizes nonblocking findings and requires revalidation", async () => {
  const result = await buildProductBuildVerificationLoop(await buildOptions({
    claudeReviewReceipt: completedP10000ClaudeReviewReceipt([
      {
        finding_id: "FINDING-DOC-001",
        severity: "p2",
        category: "documentation",
        title: "Clarify closeout packet wording",
        description: "The finding is nonblocking and should be revalidated by the existing evidence set.",
        file: "docs/hermes-roadmap-p9801-p10000.md",
      },
    ]),
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.finding_count, 1);
  assert.equal(result.summary.blocking_finding_count, 0);
  assert.equal(result.finding_normalization_rows[0].blocking, false);
  assert.equal(result.finding_normalization_rows[0].revalidation_required, true);
  assert.equal(result.revalidation_evidence_rows[0].current_verdict, "pass");
});

test("Product build verification blocks when Claude review has a blocking finding", async () => {
  const result = await buildProductBuildVerificationLoop(await buildOptions({
    claudeReviewReceipt: completedP10000ClaudeReviewReceipt([
      {
        finding_id: "FINDING-BLOCK-001",
        severity: "p1",
        category: "authority",
        title: "Authority boundary can be bypassed",
        description: "Blocking finding must prevent P10000 closeout.",
        file: "src/product-build-verification-loop.mjs",
      },
    ]),
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.product_build_verification_status, "ready_for_required_claude_review");
  assert.equal(result.summary.blocking_finding_count, 1);
  assert.equal(result.finding_normalization_rows[0].current_verdict, "block");
  assert.equal(result.revalidation_evidence_rows[0].current_verdict, "block");
  assert.equal(result.product_build_verification_boundary.p10000_freeze_ready, false);
});

test("Product build verification blocks if Claude review receipt is missing", async () => {
  const result = await buildProductBuildVerificationLoop(await buildOptions({
    claudeReviewReceipt: null,
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.claude_review_required_now, true);
  assert.equal(result.summary.claude_review_completed_now, false);
  assert.equal(result.summary.product_build_verification_status, "ready_for_required_claude_review");
});

test("Product build verification blocks if P9800 source is not ready", async () => {
  const source = await readyP9800Source();
  source.summary.requirement_traceability_kernel_status = "blocked";
  source.summary.p9800_freeze_ready = false;
  source.validation.valid = false;
  source.validation.errors = [{ validation_id: "source.not_ready", category: "source", message: "forced source block" }];

  const result = await buildProductBuildVerificationLoop(await buildOptions({
    requirementTraceabilityKernel: source,
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.source_p9800_ready, false);
  assert.equal(result.p9800_source_binding_rows[0].current_verdict, "block");
});

test("Product build verification API routes are GET HEAD only and sanitized", async () => {
  const source = await readyP9800Source();
  const receipt = completedP10000ClaudeReviewReceipt();

  for (const apiPath of ["/health", "/api/build/features", "/api/build/test-evidence", "/api/build/review-packets", "/api/build/findings", "/api/build/revalidation", "/api/build/closeout", "/api/build/boundary"]) {
    const response = await buildProductBuildVerificationApiResponse(apiPath, {
      runAt: RUN_AT,
      method: "GET",
      requirementTraceabilityKernel: source,
      claudeReviewReceipt: receipt,
    });
    assert.equal(response.status, 200);
    const parsed = JSON.parse(response.body);
    assert.equal(hasSensitiveKey(parsed), false, `${apiPath} should not contain sensitive response keys`);
  }

  const postResponse = await buildProductBuildVerificationApiResponse("/api/build/features", {
    runAt: RUN_AT,
    method: "POST",
    requirementTraceabilityKernel: source,
    claudeReviewReceipt: receipt,
  });
  assert.equal(postResponse.status, 405);
});

test("Product build verification browser shell binds APIs without write controls", async () => {
  const response = await buildProductBuildVerificationApiResponse("/build-verification.html", {
    runAt: RUN_AT,
    method: "GET",
    requirementTraceabilityKernel: await readyP9800Source(),
    claudeReviewReceipt: completedP10000ClaudeReviewReceipt(),
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.includes("Product Build Verification Loop"), true);
  for (const apiPath of ["/api/build/features", "/api/build/test-evidence", "/api/build/review-packets", "/api/build/findings", "/api/build/revalidation", "/api/build/closeout", "/api/build/boundary"]) {
    assert.equal(response.body.includes(apiPath), true);
  }
  assert.equal(/button[^>]*(apply|merge|deploy|write)/i.test(response.body), false);
  assert.equal(response.body.includes("method: 'POST'"), false);
});

test("Product build verification API server serves local artifact-backed routes", async () => {
  const started = await startProductBuildVerificationApiServer({
    runAt: RUN_AT,
    port: 0,
    requirementTraceabilityKernel: await readyP9800Source(),
    claudeReviewReceipt: completedP10000ClaudeReviewReceipt(),
  });

  try {
    const featureResponse = await fetch(`${started.url}/api/build/features`);
    assert.equal(featureResponse.status, 200);
    const features = await featureResponse.json();
    assert.equal(features.route_id, "features");
    assert.equal(features.data.length > 0, true);
    assert.equal(hasSensitiveKey(features), false);

    const htmlResponse = await fetch(`${started.url}/build-verification.html`);
    assert.equal(htmlResponse.status, 200);
    const html = await htmlResponse.text();
    assert.equal(html.includes("Product Build Verification Loop"), true);
  } finally {
    await new Promise((resolve, reject) => started.server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Product build verification freezes P10000 without authority expansion", async () => {
  const result = await buildProductBuildVerificationLoop(await buildOptions());
  const boundary = result.product_build_verification_boundary;

  assert.equal(result.p10000_freeze_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(boundary.p10000_freeze_ready, true);
  assert.equal(boundary.claude_review_required_now, true);
  assert.equal(boundary.claude_review_completed_now, true);
  assert.equal(boundary.codex_final_approval_allowed, false);
  assert.equal(boundary.claude_final_approval_allowed, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.runtime_execution_enabled, false);
  assert.equal(boundary.write_action_enabled, false);
  assert.equal(boundary.api_write_methods_enabled, false);
  assert.equal(boundary.raw_material_visible, false);
});

test("Product build verification negative fixtures block unsafe claims", async () => {
  const result = await buildProductBuildVerificationLoop(await buildOptions());
  const fixtureIds = new Set(result.build_negative_fixture_rows.map((row) => row.row_id));

  for (const fixture of ["negative.missing_p9800_source", "negative.missing_feature_packet", "negative.missing_test_evidence", "negative.missing_review_packet", "negative.claude_review_missing", "negative.blocking_finding_ignored", "negative.revalidation_missing", "negative.closeout_without_all_gates", "negative.final_authority_expanded", "negative.production_enterprise_pass", "negative.api_mutation_or_raw"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.build_negative_fixture_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Product build verification --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "product-build-verification-loop-"));
  const sentinelPath = path.join(outDir, "product-build-verification-loop.json");
  const sentinel = "{ \"sentinel\": \"product-build-verification-loop\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runProductBuildVerificationLoop(await buildOptions({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

function hasSensitiveKey(value) {
  if (Array.isArray(value)) return value.some(hasSensitiveKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) => /(raw_|full_transcript|full_body|secret)/i.test(key) || hasSensitiveKey(nested));
}
