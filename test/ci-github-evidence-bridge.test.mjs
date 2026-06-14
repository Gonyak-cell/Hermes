import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildCiGithubEvidenceApiResponse,
  buildCiGithubEvidenceBridge,
  runCiGithubEvidenceBridge,
  startCiGithubEvidenceApiServer,
} from "../src/ci-github-evidence-bridge.mjs";
import { buildClaudeReviewIntegrationLane } from "../src/claude-review-integration-lane.mjs";
import { buildProductBuildVerificationLoop } from "../src/product-build-verification-loop.mjs";
import { buildRequirementTraceabilityKernel } from "../src/requirement-traceability-kernel.mjs";

const RUN_AT = "2026-06-06T12:20:00.000Z";
const COMMIT_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PREVIOUS_SHA = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const LOCAL_GIT_STATE = {
  cwd: "/tmp/hermes",
  branch_name: "codex/p10400-ci-github-evidence",
  head_sha: COMMIT_SHA,
  git_available_now: true,
  error: null,
};

let readyP9800Promise;
let readyP10000Promise;
let readyP10200Promise;

function completedP9800ClaudeReviewReceipt() {
  return {
    schema_version: "claude-review-receipt.v1",
    generated_at: RUN_AT,
    reviewer_model: "claude-code-opus-4.8-max-or-latest-opus",
    review_effort: "max",
    review_status: "completed",
    finding_count: 0,
    blocking_finding_count: 0,
    findings: [],
    reviewer_mutation_allowed: false,
    claude_final_approval_allowed: false,
    production_pass_allowed: false,
    enterprise_pass_allowed: false,
  };
}

function completedP10000ClaudeReviewReceipt() {
  return {
    schema_version: "claude-review-receipt.v1",
    generated_at: RUN_AT,
    reviewer_model_requested: "opus",
    reviewer_model_observed: "claude-opus-4-7",
    review_effort_requested: "max",
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
}

function completedP10200ClaudeReviewReceipt() {
  return {
    schema_version: "claude-review-receipt.v1",
    generated_at: RUN_AT,
    reviewer_model_requested: "opus",
    reviewer_model_observed: "claude-opus-4-7",
    review_effort_requested: "max",
    review_scope: "P10001-P10200 Claude review integration lane",
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
}

function completedP10400ClaudeReviewReceipt() {
  return {
    schema_version: "claude-review-receipt.v1",
    generated_at: RUN_AT,
    reviewer_model_requested: "opus",
    reviewer_model_observed: "claude-opus-4-7",
    review_effort_requested: "max",
    review_scope: "P10201-P10400 CI/GitHub evidence bridge",
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

async function readyP10200Source() {
  readyP10200Promise ??= buildClaudeReviewIntegrationLane({
    runAt: RUN_AT,
    write: false,
    productBuildVerificationLoop: await readyP10000Source(),
    sourceClaudeReviewReceipt: completedP10000ClaudeReviewReceipt(),
    claudeReviewReceipt: completedP10200ClaudeReviewReceipt(),
  });
  return structuredClone(await readyP10200Promise);
}

function githubReceipts({ commitSha = COMMIT_SHA, prApproved = true, attestationCommitBound = true } = {}) {
  return {
    remoteBindingReceipt: {
      schema_version: "github-remote-binding-receipt.v1",
      generated_at: RUN_AT,
      receipt_status: "observed",
      repository_full_name: "Gonyak-cell/Hermes",
      repository_visibility: "public",
      remote_url: "https://github.com/Gonyak-cell/Hermes.git",
      branch_name: LOCAL_GIT_STATE.branch_name,
      commit_sha: commitSha,
      github_remote_configured_now: true,
      gh_cli_available_now: true,
      gh_auth_available_now: true,
      raw_payload_inlined: false,
    },
    branchProtectionReceipt: {
      schema_version: "github-branch-protection-receipt.v1",
      generated_at: RUN_AT,
      receipt_status: "observed",
      repository_full_name: "Gonyak-cell/Hermes",
      branch_name: "main",
      branch_protection_configured_now: true,
      required_pr_review_enforced_now: true,
      stale_review_dismissal_enforced_now: true,
      force_push_disabled_now: true,
      raw_payload_inlined: false,
    },
    requiredCheckReceipt: {
      schema_version: "github-required-check-receipt.v1",
      generated_at: RUN_AT,
      receipt_status: "observed",
      repository_full_name: "Gonyak-cell/Hermes",
      branch_name: "main",
      required_check_name: "Hermes verification trust",
      required_status_check_enforced_now: true,
      required_status_check_contexts: ["Hermes verification trust"],
      latest_actions_run_id: 10400,
      latest_actions_run_status: "completed",
      latest_actions_run_conclusion: "success",
      raw_payload_inlined: false,
    },
    actionsRunReceipt: {
      schema_version: "github-actions-run-receipt.v1",
      generated_at: RUN_AT,
      receipt_status: "observed",
      repository_full_name: "Gonyak-cell/Hermes",
      branch_name: LOCAL_GIT_STATE.branch_name,
      workflow_name: "Hermes Verification Trust",
      commit_sha: commitSha,
      actions_run_id: 10400,
      actions_run_url: "https://github.com/Gonyak-cell/Hermes/actions/runs/10400",
      actions_run_status: "completed",
      actions_run_conclusion: "success",
      actions_run_success_now: true,
      raw_payload_inlined: false,
    },
    pullRequestReviewReceipt: {
      schema_version: "github-pull-request-review-receipt.v1",
      generated_at: RUN_AT,
      receipt_status: prApproved ? "observed" : "blocked_missing_external_evidence",
      repository_full_name: "Gonyak-cell/Hermes",
      pull_request_number: 104,
      pull_request_url: "https://github.com/Gonyak-cell/Hermes/pull/104",
      pull_request_state: "OPEN",
      review_decision: prApproved ? "APPROVED" : "REVIEW_REQUIRED",
      head_ref_name: LOCAL_GIT_STATE.branch_name,
      base_ref_name: "main",
      head_ref_oid: commitSha,
      pull_request_review_query_available_now: true,
      pull_request_review_completed_now: prApproved,
      latest_review_count: prApproved ? 1 : 0,
      latest_approval_count: prApproved ? 1 : 0,
      raw_payload_inlined: false,
    },
    attestationVerifyReceipt: {
      schema_version: "attestation-verify-receipt.v1",
      generated_at: RUN_AT,
      receipt_status: "observed",
      repository_full_name: "Gonyak-cell/Hermes",
      repository_visibility: "public",
      attestation_subject: "/tmp/hermes-p10400-attestation.tgz",
      signed_attestation_generated_now: true,
      attestation_verification_passed_now: true,
      attestation_support_status: "verified",
      attestation_block_reason: null,
      commit_sha: attestationCommitBound ? commitSha : null,
      verification_output_hash: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      raw_payload_inlined: false,
    },
  };
}

async function buildOptions(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    claudeReviewIntegrationLane: await readyP10200Source(),
    sourceClaudeReviewReceipt: completedP10200ClaudeReviewReceipt(),
    claudeReviewReceipt: completedP10400ClaudeReviewReceipt(),
    localGitState: LOCAL_GIT_STATE,
    ...githubReceipts(),
    ...overrides,
  };
}

test("CI/GitHub evidence bridge consumes P10200 source and complete external evidence", async () => {
  const result = await buildCiGithubEvidenceBridge(await buildOptions());

  assert.equal(result.validation.valid, true);
  assert.equal(result.program_range, "P10201-P10400");
  assert.equal(result.source_program_range, "P10001-P10200");
  assert.equal(result.summary.ci_github_evidence_bridge_status, "ready_for_ci_github_evidence_bridge");
  assert.equal(result.summary.source_p10200_ready, true);
  assert.equal(result.summary.external_evidence_complete_now, true);
  assert.equal(result.summary.p10400_bridge_ready, true);
});

test("CI/GitHub evidence bridge covers all P10201-P10400 phase rows", async () => {
  const result = await buildCiGithubEvidenceBridge(await buildOptions());
  const phaseRanges = new Set(result.ci_github_evidence_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P10201-P10220", "P10221-P10240", "P10241-P10260", "P10261-P10280", "P10281-P10300", "P10301-P10320", "P10321-P10340", "P10341-P10360", "P10361-P10380", "P10381-P10400"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.ci_github_evidence_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("CI/GitHub evidence bridge normalizes remote branch required check actions PR and attestation rows", async () => {
  const result = await buildCiGithubEvidenceBridge(await buildOptions());

  assert.equal(result.github_remote_binding_rows.length, 1);
  assert.equal(result.branch_protection_evidence_rows.length, 4);
  assert.equal(result.required_check_evidence_rows.length, 2);
  assert.equal(result.actions_run_evidence_rows.length, 2);
  assert.equal(result.pr_commit_evidence_rows.length, 2);
  assert.equal(result.attestation_evidence_rows.length, 2);
  assert.equal(result.evidence_freshness_rows.length, 6);
  assert.equal(result.external_evidence_closeout_rows.every((row) => row.current_verdict === "pass"), true);
});

test("CI/GitHub evidence bridge keeps stale commit evidence as external blocker without failing bridge contract", async () => {
  const staleReceipts = githubReceipts({ commitSha: PREVIOUS_SHA });
  const result = await buildCiGithubEvidenceBridge(await buildOptions(staleReceipts));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.ci_github_evidence_bridge_status, "ready_for_ci_github_evidence_bridge");
  assert.equal(result.summary.external_evidence_complete_now, false);
  assert.equal(result.summary.external_closeout_blocker_count > 0, true);
  assert.equal(result.actions_run_evidence_rows.find((row) => row.row_id === "actions.run.commit_current").current_verdict, "block");
  assert.equal(result.ci_github_evidence_boundary.release_closeout_allowed_now, false);
  assert.equal(result.ci_github_evidence_boundary.enterprise_trust_allowed_now, false);
});

test("CI/GitHub evidence bridge blocks external closeout when PR review is missing", async () => {
  const result = await buildCiGithubEvidenceBridge(await buildOptions(githubReceipts({ prApproved: false })));
  const prReview = result.pr_commit_evidence_rows.find((row) => row.row_id === "pr.review.completed");

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.external_evidence_complete_now, false);
  assert.equal(prReview.current_verdict, "block");
  assert.equal(prReview.block_reason, "independent_github_pr_review_missing");
  assert.equal(result.ci_github_evidence_boundary.github_merge_allowed, false);
});

test("CI/GitHub evidence bridge requires attestation commit binding for external completion", async () => {
  const result = await buildCiGithubEvidenceBridge(await buildOptions(githubReceipts({ attestationCommitBound: false })));
  const attestation = result.attestation_evidence_rows.find((row) => row.row_id === "attestation.commit_bound");

  assert.equal(result.validation.valid, true);
  assert.equal(attestation.current_verdict, "block");
  assert.equal(result.summary.external_evidence_complete_now, false);
});

test("CI/GitHub evidence bridge blocks if P10400 Claude review receipt is missing", async () => {
  const result = await buildCiGithubEvidenceBridge(await buildOptions({
    claudeReviewReceipt: null,
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.ci_github_evidence_bridge_status, "ready_for_required_claude_review");
  assert.equal(result.summary.p10400_claude_review_completed_now, false);
  assert.equal(result.summary.p10400_bridge_ready, false);
});

test("CI/GitHub evidence bridge blocks if P10200 source is not ready", async () => {
  const source = await readyP10200Source();
  source.summary.claude_review_integration_status = "blocked";
  source.summary.ready_for_p10201_handoff = false;
  source.summary.p10200_freeze_ready = false;
  source.validation.valid = false;
  source.validation.errors = [{ validation_id: "source.not_ready", category: "source", message: "forced source block" }];

  const result = await buildCiGithubEvidenceBridge(await buildOptions({
    claudeReviewIntegrationLane: source,
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.source_p10200_ready, false);
  assert.equal(result.p10200_source_binding_rows[0].current_verdict, "block");
});

test("CI/GitHub evidence bridge API routes are GET HEAD only and sanitized", async () => {
  const options = await buildOptions();

  for (const apiPath of ["/health", "/api/ci-github/remote", "/api/ci-github/branch-protection", "/api/ci-github/required-checks", "/api/ci-github/actions", "/api/ci-github/pr-commit", "/api/ci-github/attestation", "/api/ci-github/freshness", "/api/ci-github/boundary"]) {
    const response = await buildCiGithubEvidenceApiResponse(apiPath, {
      ...options,
      method: "GET",
    });
    assert.equal(response.status, 200);
    const parsed = JSON.parse(response.body);
    assert.equal(hasSensitiveKey(parsed), false, `${apiPath} should not contain sensitive response keys`);
  }

  const postResponse = await buildCiGithubEvidenceApiResponse("/api/ci-github/remote", {
    ...options,
    method: "POST",
  });
  assert.equal(postResponse.status, 405);
});

test("CI/GitHub evidence bridge browser shell exposes no write controls", async () => {
  const response = await buildCiGithubEvidenceApiResponse("/ci-github-evidence.html", {
    ...(await buildOptions()),
    method: "GET",
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.includes("CI/GitHub Evidence Bridge"), true);
  assert.equal(/<button|type="submit"|gh pr merge|git push|deploy now|merge now|apply now/i.test(response.body), false);
});

test("CI/GitHub evidence bridge API server serves boundary route", async () => {
  const started = await startCiGithubEvidenceApiServer({
    ...(await buildOptions()),
    port: 0,
  });

  try {
    const response = await fetch(`${started.url}/api/ci-github/boundary`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.github_write_allowed, false);
    assert.equal(body.data.enterprise_trust_allowed_now, false);
  } finally {
    await new Promise((resolve) => started.server.close(resolve));
  }
});

test("CI/GitHub evidence bridge freezes P10400 without authority expansion", async () => {
  const result = await buildCiGithubEvidenceBridge(await buildOptions());

  assert.equal(result.ci_github_evidence_boundary.p10400_bridge_ready, true);
  assert.equal(result.ci_github_evidence_boundary.github_write_allowed, false);
  assert.equal(result.ci_github_evidence_boundary.github_merge_allowed, false);
  assert.equal(result.ci_github_evidence_boundary.release_closeout_allowed_now, false);
  assert.equal(result.ci_github_evidence_boundary.enterprise_trust_allowed_now, false);
  assert.equal(result.ci_github_evidence_boundary.codex_final_approval_allowed, false);
  assert.equal(result.ci_github_evidence_boundary.claude_final_approval_allowed, false);
});

test("CI/GitHub evidence bridge negative fixtures block unsafe claims", async () => {
  const result = await buildCiGithubEvidenceBridge(await buildOptions());
  const expectedBlocks = new Set(result.ci_github_negative_fixture_rows.map((row) => row.expected_block_code));

  for (const expected of [
    "BLOCK_MISSING_P10200_SOURCE",
    "BLOCK_MISSING_REMOTE_BINDING",
    "BLOCK_BRANCH_PROTECTION_OVERCLAIM",
    "BLOCK_REQUIRED_CHECK_OVERCLAIM",
    "BLOCK_ACTIONS_RUN_STALE",
    "BLOCK_PR_REVIEW_MISSING",
    "BLOCK_ATTESTATION_MISSING_OR_STALE",
    "BLOCK_RAW_PAYLOAD_EXPOSED",
    "BLOCK_GITHUB_WRITE_ENABLED",
    "BLOCK_RELEASE_ENTERPRISE_PASS",
    "BLOCK_FINAL_APPROVAL_EXPANSION",
  ]) {
    assert.equal(expectedBlocks.has(expected), true);
  }
  assert.equal(result.ci_github_negative_fixture_rows.every((row) => row.current_verdict === "pass"), true);
});

test("CI/GitHub evidence bridge --check does not overwrite artifacts", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p10400-"));
  const sentinelPath = path.join(tmpDir, "ci-github-evidence-bridge.json");
  await writeFile(sentinelPath, "sentinel", "utf8");

  const result = await runCiGithubEvidenceBridge(await buildOptions({
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
  return Object.entries(value).some(([key, entry]) => /(raw_|rawPayload|raw_payload|stdout|stderr|command_observations|token|secret|api_key|authorization)/i.test(key) || hasSensitiveKey(entry));
}
