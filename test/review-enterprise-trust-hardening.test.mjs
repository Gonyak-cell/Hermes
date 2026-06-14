import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildReviewEnterpriseTrustHardening,
  runReviewEnterpriseTrustHardening,
} from "../src/review-enterprise-trust-hardening.mjs";

const RUN_AT = "2026-06-05T00:00:00.000Z";
const resultPromise = buildReviewEnterpriseTrustHardening({ runAt: RUN_AT, write: false });

test("review enterprise trust hardening consumes P5800 multi-engine QA", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.review_enterprise_trust_hardening_status, "ready_for_review_enterprise_trust_hardening_v0");
  assert.equal(result.program_range, "P5801-P6200");
  assert.equal(result.summary.multi_engine_orchestration_qa_status, "ready_for_multi_engine_orchestration_qa_v0");
});

test("review enterprise trust hardening covers all P5801-P6200 phase rows", async () => {
  const result = await resultPromise;
  const phaseRanges = new Set(result.review_enterprise_trust_phase_rows.map((row) => row.phase_range));

  assert.equal(result.review_enterprise_trust_phase_rows.length, 10);
  for (const phase of ["P5801-P5840", "P5841-P5880", "P5881-P5920", "P5921-P5960", "P5961-P6000", "P6001-P6040", "P6041-P6080", "P6081-P6120", "P6121-P6160", "P6161-P6200"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.review_enterprise_trust_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("review enterprise trust hardening blocks self GitHub approval and keeps independent review pending", async () => {
  const result = await resultPromise;
  const row = result.github_review_lane_rows[0];

  assert.equal(row.independent_github_review_required, true);
  assert.equal(row.independent_github_review_completed_now, false);
  assert.equal(row.self_review_attempt_blocked, true);
  assert.equal(row.same_account_approval_allowed, false);
  assert.equal(row.review_state, "BLOCKED_PENDING_INDEPENDENT_GITHUB_REVIEW");
});

test("review enterprise trust hardening keeps branch ruleset and required status check evidence pending", async () => {
  const result = await resultPromise;
  const branch = result.branch_ruleset_evidence_rows[0];
  const check = result.required_status_check_rows[0];

  assert.equal(branch.branch_ruleset_evidence_required, true);
  assert.equal(branch.branch_ruleset_observed_now, false);
  assert.equal(branch.branch_protection_enforced_now, false);
  assert.equal(branch.evidence_status, "BLOCKED_PENDING_BRANCH_RULESET_EVIDENCE");
  assert.equal(check.required_status_check_evidence_required, true);
  assert.equal(check.required_status_checks_configured_now, false);
  assert.equal(check.required_status_checks_passed_now, false);
  assert.equal(check.evidence_status, "BLOCKED_PENDING_REQUIRED_STATUS_CHECK_EVIDENCE");
});

test("review enterprise trust hardening keeps attestation and Claude review receipts pending", async () => {
  const result = await resultPromise;
  const attestation = result.signed_attestation_hardening_rows[0];
  const claude = result.claude_review_receipt_hardening_rows[0];

  assert.equal(attestation.signed_attestation_required, true);
  assert.equal(attestation.signed_attestation_present_now, false);
  assert.equal(attestation.attestation_verification_passed_now, false);
  assert.equal(attestation.subject_digest_bound_now, false);
  assert.equal(claude.reviewer_ref, "reviewer.claude_code_opus_max");
  assert.equal(claude.claude_review_receipt_required, true);
  assert.equal(claude.completed_claude_review_receipt_present_now, false);
  assert.equal(claude.durable_raw_json_present_now, false);
  assert.equal(claude.reviewer_mutation_allowed, false);
});

test("review enterprise trust hardening classifies single-owner mode as lower trust only", async () => {
  const result = await resultPromise;
  const row = result.single_owner_exception_rows[0];

  assert.equal(row.single_owner_exception_observed_now, true);
  assert.equal(row.single_owner_lower_trust_mode, true);
  assert.equal(row.independent_github_review_completed_now, false);
  assert.equal(row.single_owner_can_claim_enterprise_trust, false);
  assert.equal(row.merge_readiness_tier, "LOWER_TRUST_INTERNAL_ONLY");
});

test("review enterprise trust hardening encodes no-human protected closeout boundary", async () => {
  const result = await resultPromise;
  const row = result.no_human_protected_closeout_boundary_rows[0];

  assert.equal(row.human_adjudication_in_milestone_gate, false);
  assert.equal(row.protected_closeout_enabled, false);
  assert.equal(row.protected_final_decision_enabled, false);
  assert.equal(row.no_human_can_claim_protected_final_decision, false);
  assert.equal(row.no_human_can_claim_enterprise_trust, false);
});

test("review enterprise trust hardening separates contract readiness from enterprise trust and P6200 closeout", async () => {
  const result = await resultPromise;
  const decision = result.enterprise_trust_decision_rows[0];

  assert.equal(decision.external_trust_evidence_ready, false);
  assert.equal(decision.no_human_blocks_protected_closeout, true);
  assert.equal(decision.p6200_milestone_closeout_ready, false);
  assert.equal(decision.lower_trust_readiness_allowed, true);
  assert.equal(decision.single_owner_lower_trust_mode, true);
  assert.equal(decision.enterprise_trust_ready, false);
  assert.equal(decision.enterprise_trust_claim_allowed, false);
  assert.equal(decision.human_adjudication_required, false);
});

test("review enterprise trust hardening negative fixtures block unsafe trust claims", async () => {
  const result = await resultPromise;
  const fixtureIds = new Set(result.trust_negative_fixture_rows.map((row) => row.fixture_id));

  assert.equal(result.trust_negative_fixture_rows.length, 6);
  for (const fixture of ["negative.self_github_review", "negative.no_human_as_final", "negative.claude_review_as_enterprise", "negative.attestation_unverified", "negative.ci_without_ruleset", "negative.local_only_release"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.trust_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.trust_negative_fixture_rows.every((row) => row.unsafe_trust_claim_allowed === false), true);
});

test("review enterprise trust hardening remains no-human, no-enterprise, no-runtime, no-write", async () => {
  const result = await resultPromise;
  const boundary = result.review_enterprise_trust_boundary;

  assert.equal(boundary.review_enterprise_trust_hardening_ready, true);
  assert.equal(boundary.independent_github_review_completed_now, false);
  assert.equal(boundary.branch_ruleset_enforced_now, false);
  assert.equal(boundary.required_status_checks_passed_now, false);
  assert.equal(boundary.attestation_verification_passed_now, false);
  assert.equal(boundary.claude_review_completed_now, false);
  assert.equal(boundary.durable_claude_raw_json_present_now, false);
  assert.equal(boundary.single_owner_lower_trust_mode, true);
  assert.equal(boundary.human_adjudication_in_milestone_gate, false);
  assert.equal(boundary.enterprise_trust_ready, false);
  assert.equal(boundary.enterprise_trust_claim_enabled, false);
  assert.equal(boundary.p6200_milestone_closeout_ready, false);
  assert.equal(boundary.protected_closeout_enabled, false);
  assert.equal(boundary.protected_final_decision_enabled, false);
  assert.equal(boundary.agent_runtime_execution_enabled, false);
  assert.equal(boundary.write_action_enabled, false);
  assert.equal(boundary.protected_action_enabled, false);
  assert.equal(boundary.work_os_claim_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("review enterprise trust hardening --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "review-enterprise-trust-hardening-"));
  const sentinelPath = path.join(outDir, "review-enterprise-trust-hardening.json");
  const sentinel = "{ \"sentinel\": \"review-enterprise-trust-hardening\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runReviewEnterpriseTrustHardening({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
