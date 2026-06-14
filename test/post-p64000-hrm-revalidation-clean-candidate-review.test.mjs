import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000HrmRevalidationCleanCandidateReview,
  runPostP64000HrmRevalidationCleanCandidateReview,
} from "../src/post-p64000-hrm-revalidation-clean-candidate-review.mjs";

const RUN_AT = "2026-06-09T16:05:00.000Z";

const HRM04_READY = {
  schema_version: "post-p64000-hrm04-review-event-boundary.v1",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    hrm04_remediated_candidate_now: true,
    clean_checkpoint_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
};

const HRM03_READY = {
  schema_version: "post-p64000-hrm03-review-window-cap.v1",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    hrm03_remediated_candidate_now: true,
    ready_for_p66401_handoff: true,
    clean_checkpoint_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
};

const HRM01_READY = {
  schema_version: "post-p64000-hrm01-review-depth-cap.v1",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    hrm01_remediated_candidate_now: true,
    ready_for_p66801_handoff: true,
    clean_checkpoint_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
};

const NORMALIZED_RECEIPT_READY = {
  schema_version: "post-p64000-claude-review-receipt.v1",
  receipt_status: "observed_blocking_findings",
  reviewer: "claude-code-opus-max",
  reviewer_lane: "independent_read_only",
  overall_verdict: "needs_changes",
  blocks_clean_checkpoint: true,
  normalized_blocking_finding_count: 3,
  finding_count: 8,
  findings: ["HRM-04", "HRM-03", "HRM-01"].map((id) => ({
    id,
    severity: "high",
    category: id === "HRM-03" ? "process_structure" : "source_of_truth_drift",
    location: `${id} fixture`,
    evidence: `${id} evidence`,
    issue: `${id} issue`,
    proposed_change: `${id} proposed change`,
    confidence: "high",
    blocks_clean_checkpoint: true,
    normalized_status: "blocking_open",
    next_allowed_action: "plan_fix_or_scope_split_before_clean_checkpoint",
  })),
  source_mutation_performed: false,
  reviewer_final_approval_allowed: false,
  protected_closeout_allowed: false,
  production_pass_allowed: false,
  enterprise_pass_allowed: false,
};

function options(extra = {}) {
  return {
    runAt: RUN_AT,
    hrm04Boundary: HRM04_READY,
    hrm03WindowCap: HRM03_READY,
    hrm01DepthCap: HRM01_READY,
    normalizedReceipt: NORMALIZED_RECEIPT_READY,
    ...extra,
  };
}

test("P67200 creates HRM clean-candidate review packet without claiming performed review", async () => {
  const result = await buildPostP64000HrmRevalidationCleanCandidateReview(options());

  assert.equal(result.schema_version, "post-p64000-hrm-revalidation-clean-candidate-review.v1");
  assert.equal(result.program_range, "P66801-P67200");
  assert.equal(result.source_program_range, "P66401-P66800");
  assert.equal(result.next_program_range, "P67201-P67600");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_hrm_revalidation_clean_candidate_review_status, "hrm_revalidation_clean_candidate_review_packet_ready_for_p67201");
  assert.equal(result.summary.hrm_remediation_candidates_ready_now, true);
  assert.equal(result.summary.hrm_blockers_preserved_now, true);
  assert.equal(result.summary.clean_candidate_review_packet_ready_now, true);
  assert.equal(result.summary.packet_is_claude_review_event_now, false);
  assert.equal(result.summary.review_execution_performed_now, false);
  assert.equal(result.summary.future_claude_review_required_now, true);
  assert.equal(result.summary.clean_checkpoint_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
  assert.match(result.clean_candidate_review_packet_markdown, /is_claude_review_event: false/);
});

test("missing HRM-04 candidate blocks P67200 packet", async () => {
  const hrm04Boundary = {
    ...HRM04_READY,
    summary: { ...HRM04_READY.summary, hrm04_remediated_candidate_now: false },
  };

  const result = await buildPostP64000HrmRevalidationCleanCandidateReview(options({ hrm04Boundary }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.ready"));
});

test("missing HRM-03 candidate blocks P67200 packet", async () => {
  const hrm03WindowCap = {
    ...HRM03_READY,
    summary: { ...HRM03_READY.summary, hrm03_remediated_candidate_now: false },
  };

  const result = await buildPostP64000HrmRevalidationCleanCandidateReview(options({ hrm03WindowCap }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.ready"));
});

test("missing HRM-01 candidate blocks P67200 packet", async () => {
  const hrm01DepthCap = {
    ...HRM01_READY,
    summary: { ...HRM01_READY.summary, hrm01_remediated_candidate_now: false },
  };

  const result = await buildPostP64000HrmRevalidationCleanCandidateReview(options({ hrm01DepthCap }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.ready"));
});

test("auto-resolved HRM blocker claim blocks packet closeout", async () => {
  const normalizedReceipt = {
    ...NORMALIZED_RECEIPT_READY,
    findings: NORMALIZED_RECEIPT_READY.findings.map((finding) => finding.id === "HRM-03"
      ? { ...finding, normalized_status: "resolved" }
      : finding),
  };

  const result = await buildPostP64000HrmRevalidationCleanCandidateReview(options({ normalizedReceipt }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_hrm_revalidation_clean_candidate_review_boundary.hrm_findings_auto_resolved_allowed_now, true);
  assert.ok(result.validation.errors.some((error) => error.path === "hrm.blockers_preserved" || error.path === "rows.authority"));
});

test("packet treated as performed Claude review event blocks P67200", async () => {
  const result = await buildPostP64000HrmRevalidationCleanCandidateReview(options({
    packetBoundaryOverrides: {
      is_claude_review_event: true,
      performed_review_evidence_allowed: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_hrm_revalidation_clean_candidate_review_boundary.packet_is_claude_review_event_now, true);
  assert.equal(result.post_p64000_hrm_revalidation_clean_candidate_review_boundary.review_packet_as_performed_review_allowed_now, true);
});

test("clean-candidate packet cannot claim clean checkpoint or performed review execution", async () => {
  const result = await buildPostP64000HrmRevalidationCleanCandidateReview(options({
    packetBoundaryOverrides: {
      clean_checkpoint_claim_allowed: true,
      review_execution_performed_now: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_hrm_revalidation_clean_candidate_review_boundary.review_execution_performed_now, true);
  assert.equal(result.post_p64000_hrm_revalidation_clean_candidate_review_boundary.clean_candidate_packet_clean_checkpoint_allowed_now, true);
  assert.equal(result.post_p64000_hrm_revalidation_clean_candidate_review_boundary.future_claude_dispatch_performed_now, true);
});

test("final approval or production claim blocks authority boundary", async () => {
  const normalizedReceipt = {
    ...NORMALIZED_RECEIPT_READY,
    reviewer_final_approval_allowed: true,
    production_pass_allowed: true,
    enterprise_pass_allowed: true,
  };

  const result = await buildPostP64000HrmRevalidationCleanCandidateReview(options({ normalizedReceipt }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_hrm_revalidation_clean_candidate_review_boundary.claude_final_approval_allowed, true);
  assert.equal(result.post_p64000_hrm_revalidation_clean_candidate_review_boundary.production_pass_enabled, true);
  assert.equal(result.post_p64000_hrm_revalidation_clean_candidate_review_boundary.enterprise_pass_enabled, true);
});

test("missing negative fixture contract blocks P67200 closeout", async () => {
  const result = await buildPostP64000HrmRevalidationCleanCandidateReview(options({
    omitNegativeFixtureId: "missing_packet_boundary",
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.negative_fixtures"));
});

test("check mode validates without writing clean-candidate packet artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-hrm-revalidation-clean-candidate-review-"));
  try {
    const result = await runPostP64000HrmRevalidationCleanCandidateReview(options({
      check: true,
      outDir,
    }));

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "post-p64000-hrm-revalidation-clean-candidate-review.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
