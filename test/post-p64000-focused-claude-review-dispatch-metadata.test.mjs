import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000FocusedClaudeReviewDispatchMetadata,
  runPostP64000FocusedClaudeReviewDispatchMetadata,
} from "../src/post-p64000-focused-claude-review-dispatch-metadata.mjs";

const RUN_AT = "2026-06-09T09:45:00.000Z";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const RECOMMENDATION_ROWS = REQUIRED_HRM_IDS.map((findingId) => ({
  row_id: `recommendation.${findingId.toLowerCase()}`,
  category: "finding_status_recommendation",
  observed: true,
  current_verdict: "pass",
  evidence_ref: `inline.${findingId}`,
  block_reason: null,
  next_allowed_action: "run_or_capture_focused_review_event_before_any_status_change",
  generated_at: RUN_AT,
  finding_id: findingId,
  current_finding_state: "blocking_open",
  recommendation_status: "verification_pending",
  focused_review_required_now: true,
  fixed_claimed_now: false,
  verified_claimed_now: false,
  resolved_claimed_now: false,
}));

const FUTURE_REVIEW_ROWS = REQUIRED_HRM_IDS.map((findingId) => ({
  row_id: `future_review.${findingId.toLowerCase()}`,
  category: "future_review_packet",
  observed: true,
  current_verdict: "pass",
  evidence_ref: "inline.packet",
  block_reason: null,
  next_allowed_action: "prepare_dispatch_metadata_without_counting_it_as_review_evidence",
  generated_at: RUN_AT,
  finding_id: findingId,
  reviewer_lane: "claude-code-opus-max-readonly",
  dispatch_ready_candidate_now: true,
  dispatch_performed_now: false,
  review_evidence_counted_now: false,
}));

const P69200_NORMALIZATION = {
  schema_version: "post-p64000-focused-hrm-verification-normalization.v1",
  program_range: "P68801-P69200",
  source_program_range: "P68401-P68800",
  next_program_range: "P69201-P69600",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    ready_for_p69201_handoff: true,
    recommendations_pending_only_now: true,
    focused_review_completed_now: false,
    clean_checkpoint_allowed_now: false,
    finding_resolution_allowed_now: false,
    blocking_finding_count: 3,
    finding_count: 5,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
  finding_status_recommendation_rows: RECOMMENDATION_ROWS,
  future_review_packet_rows: FUTURE_REVIEW_ROWS,
};

const RECOMMENDATION_PACKET = "# Post-P64000 Focused HRM Verification Normalization Packet\n\nrecommendation_status: verification_pending\n";
const PENDING_GUARD_ROWS = { rows: [{ row_id: "guard.all_recommendations_pending", current_verdict: "pass" }] };

function options(extra = {}) {
  return {
    runAt: RUN_AT,
    p69200Normalization: P69200_NORMALIZATION,
    recommendationPacketText: RECOMMENDATION_PACKET,
    recommendationRows: { rows: RECOMMENDATION_ROWS },
    futureReviewRows: { rows: FUTURE_REVIEW_ROWS },
    pendingGuardRows: PENDING_GUARD_ROWS,
    ...extra,
  };
}

test("P69600 prepares focused Claude review dispatch metadata without executing or counting evidence", async () => {
  const result = await buildPostP64000FocusedClaudeReviewDispatchMetadata(options());

  assert.equal(result.schema_version, "post-p64000-focused-claude-review-dispatch-metadata.v1");
  assert.equal(result.program_range, "P69201-P69600");
  assert.equal(result.source_program_range, "P68801-P69200");
  assert.equal(result.next_program_range, "P69601-P70000");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_focused_claude_review_dispatch_metadata_status, "focused_claude_review_dispatch_metadata_ready_for_p69601");
  assert.equal(result.summary.p69200_source_ready_now, true);
  assert.equal(result.summary.dispatch_metadata_ready_now, true);
  assert.equal(result.summary.dispatch_performed_now, false);
  assert.equal(result.summary.raw_review_captured_now, false);
  assert.equal(result.summary.review_evidence_counted_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
  assert.ok(result.dispatch_metadata_rows.every((row) => row.reviewer === "claude-code-opus-max" && row.effort === "max"));
});

test("P69200 source not ready blocks dispatch metadata", async () => {
  const p69200Normalization = {
    ...P69200_NORMALIZATION,
    summary: { ...P69200_NORMALIZATION.summary, ready_for_p69201_handoff: false },
  };

  const result = await buildPostP64000FocusedClaudeReviewDispatchMetadata(options({ p69200Normalization }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p69200"));
});

test("missing recommendation packet blocks source binding", async () => {
  const result = await buildPostP64000FocusedClaudeReviewDispatchMetadata(options({ recommendationPacketText: "" }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.p69200_source_binding_rows.some((row) => row.row_id === "source.recommendation_packet" && row.current_verdict === "block"));
});

test("non-pending recommendation blocks dispatch metadata", async () => {
  const recommendationRows = {
    rows: RECOMMENDATION_ROWS.map((row) => row.finding_id === "HRM-03" ? { ...row, recommendation_status: "fixed" } : row),
  };

  const result = await buildPostP64000FocusedClaudeReviewDispatchMetadata(options({ recommendationRows }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.dispatch_metadata_rows.some((row) => row.finding_id === "HRM-03" && row.current_verdict === "block"));
});

test("missing future review row blocks dispatch metadata", async () => {
  const futureReviewRows = { rows: FUTURE_REVIEW_ROWS.filter((row) => row.finding_id !== "HRM-01") };

  const result = await buildPostP64000FocusedClaudeReviewDispatchMetadata(options({ futureReviewRows }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.dispatch_metadata_rows.some((row) => row.finding_id === "HRM-01" && row.current_verdict === "block"));
});

test("dispatch performed, raw captured, or evidence counted claim blocks P69600", async () => {
  const result = await buildPostP64000FocusedClaudeReviewDispatchMetadata(options({
    dispatchOverrides: {
      "HRM-04": {
        dispatch_performed_now: true,
        raw_review_captured_now: true,
        review_evidence_counted_now: true,
      },
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.dispatch_metadata_rows.some((row) => row.finding_id === "HRM-04" && row.current_verdict === "block"));
});

test("review completion or authority escalation claim blocks P69600", async () => {
  const result = await buildPostP64000FocusedClaudeReviewDispatchMetadata(options({
    authorityOverrides: {
      focused_review_completed_now: true,
      review_evidence_counted_now: true,
      dispatch_performed_now: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_focused_claude_review_dispatch_metadata_boundary.focused_review_completed_now, true);
  assert.equal(result.post_p64000_focused_claude_review_dispatch_metadata_boundary.review_evidence_counted_now, true);
  assert.equal(result.post_p64000_focused_claude_review_dispatch_metadata_boundary.dispatch_performed_now, true);
});

test("finding resolution or clean checkpoint claim blocks P69600", async () => {
  const p69200Normalization = {
    ...P69200_NORMALIZATION,
    summary: {
      ...P69200_NORMALIZATION.summary,
      finding_resolution_allowed_now: true,
      clean_checkpoint_allowed_now: true,
    },
  };

  const result = await buildPostP64000FocusedClaudeReviewDispatchMetadata(options({ p69200Normalization }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_focused_claude_review_dispatch_metadata_boundary.finding_resolution_allowed_now, true);
  assert.equal(result.post_p64000_focused_claude_review_dispatch_metadata_boundary.clean_checkpoint_claim_allowed_now, true);
});

test("missing negative fixture row blocks P69600 closeout", async () => {
  const result = await buildPostP64000FocusedClaudeReviewDispatchMetadata(options({
    omitNegativeFixtureId: "dispatch_performed_claim",
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.negative_fixtures"));
});

test("check mode validates without writing dispatch metadata artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-focused-claude-review-dispatch-metadata-"));
  try {
    const result = await runPostP64000FocusedClaudeReviewDispatchMetadata(options({
      check: true,
      outDir,
    }));

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "post-p64000-focused-claude-review-dispatch-metadata.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
