import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000FocusedHrmVerificationNormalization,
  runPostP64000FocusedHrmVerificationNormalization,
} from "../src/post-p64000-focused-hrm-verification-normalization.mjs";

const RUN_AT = "2026-06-09T09:20:00.000Z";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const FOCUSED_EVIDENCE_ROWS = REQUIRED_HRM_IDS.map((findingId) => ({
  row_id: `focused_evidence.${findingId.toLowerCase()}`,
  category: "focused_verification_evidence",
  observed: true,
  current_verdict: "pass",
  evidence_ref: `inline.${findingId}`,
  block_reason: null,
  next_allowed_action: "normalize_focused_verification_capture_without_auto_resolution",
  generated_at: RUN_AT,
  finding_id: findingId,
  candidate_source_ref: `inline.${findingId}`,
  current_candidate_sha256: `${findingId}-sha`,
  review_performed_now: false,
  fixed_claimed_now: false,
  verified_claimed_now: false,
  finding_resolution_claimed_now: false,
}));

const DIGEST_ROWS = REQUIRED_HRM_IDS.map((findingId) => ({
  row_id: `digest.${findingId.toLowerCase()}`,
  category: "candidate_digest_match",
  observed: true,
  current_verdict: "pass",
  evidence_ref: `inline.${findingId}`,
  block_reason: null,
  next_allowed_action: "continue_focused_hrm_verification_capture",
  generated_at: RUN_AT,
  finding_id: findingId,
  current_candidate_sha256: `${findingId}-sha`,
}));

const P68800_CAPTURE = {
  schema_version: "post-p64000-focused-hrm-verification-capture.v1",
  program_range: "P68401-P68800",
  source_program_range: "P68001-P68400",
  next_program_range: "P68801-P69200",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    ready_for_p68801_handoff: true,
    focused_verification_evidence_ready_now: true,
    candidate_digests_match_now: true,
    focused_verification_review_event_completed_now: false,
    clean_checkpoint_allowed_now: false,
    finding_resolution_allowed_now: false,
    blocking_finding_count: 3,
    finding_count: 5,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
  focused_verification_evidence_rows: FOCUSED_EVIDENCE_ROWS,
  candidate_digest_match_rows: DIGEST_ROWS,
};

const CAPTURE_ENVELOPE = "# Post-P64000 Focused HRM Verification Capture Envelope\n\nreview_performed_now: false\n";
const EVENT_BOUNDARY_ROWS = { rows: [{ row_id: "event_boundary.capture_not_review_event", current_verdict: "pass" }] };
const FINDING_STATE_ROWS = { rows: [{ row_id: "state.future_normalization_required", current_verdict: "pass" }] };

function options(extra = {}) {
  return {
    runAt: RUN_AT,
    p68800Capture: P68800_CAPTURE,
    captureEnvelopeText: CAPTURE_ENVELOPE,
    focusedEvidenceRows: { rows: FOCUSED_EVIDENCE_ROWS },
    digestRows: { rows: DIGEST_ROWS },
    eventBoundaryRows: EVENT_BOUNDARY_ROWS,
    findingStateRows: FINDING_STATE_ROWS,
    ...extra,
  };
}

test("P69200 normalizes focused capture into pending recommendations only", async () => {
  const result = await buildPostP64000FocusedHrmVerificationNormalization(options());

  assert.equal(result.schema_version, "post-p64000-focused-hrm-verification-normalization.v1");
  assert.equal(result.program_range, "P68801-P69200");
  assert.equal(result.source_program_range, "P68401-P68800");
  assert.equal(result.next_program_range, "P69201-P69600");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_focused_hrm_verification_normalization_status, "focused_hrm_verification_normalization_ready_for_p69201");
  assert.equal(result.summary.p68800_source_ready_now, true);
  assert.equal(result.summary.normalized_capture_ready_now, true);
  assert.equal(result.summary.recommendations_pending_only_now, true);
  assert.equal(result.summary.focused_review_completed_now, false);
  assert.equal(result.summary.finding_status_fixed_allowed_now, false);
  assert.equal(result.summary.finding_status_verified_allowed_now, false);
  assert.equal(result.summary.finding_status_resolved_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
  assert.ok(result.finding_status_recommendation_rows.every((row) => row.recommendation_status === "verification_pending"));
});

test("P68800 source not ready blocks normalization", async () => {
  const p68800Capture = {
    ...P68800_CAPTURE,
    summary: { ...P68800_CAPTURE.summary, ready_for_p68801_handoff: false },
  };

  const result = await buildPostP64000FocusedHrmVerificationNormalization(options({ p68800Capture }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p68800"));
});

test("missing capture envelope blocks source binding", async () => {
  const result = await buildPostP64000FocusedHrmVerificationNormalization(options({ captureEnvelopeText: "" }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.p68800_source_binding_rows.some((row) => row.row_id === "source.capture_envelope" && row.current_verdict === "block"));
});

test("missing focused evidence row blocks normalized capture", async () => {
  const focusedEvidenceRows = { rows: FOCUSED_EVIDENCE_ROWS.filter((row) => row.finding_id !== "HRM-04") };

  const result = await buildPostP64000FocusedHrmVerificationNormalization(options({ focusedEvidenceRows }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.normalized_capture_rows.some((row) => row.finding_id === "HRM-04" && row.current_verdict === "block"));
});

test("digest mismatch blocks normalized capture", async () => {
  const digestRows = {
    rows: DIGEST_ROWS.map((row) => row.finding_id === "HRM-03" ? { ...row, current_verdict: "block" } : row),
  };

  const result = await buildPostP64000FocusedHrmVerificationNormalization(options({ digestRows }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.normalized_capture_rows.some((row) => row.finding_id === "HRM-03" && row.current_verdict === "block"));
});

test("recommendation fixed, verified, or resolved claim blocks P69200", async () => {
  const result = await buildPostP64000FocusedHrmVerificationNormalization(options({
    recommendationOverrides: {
      "HRM-01": {
        recommendation_status: "resolved",
        fixed_claimed_now: true,
        verified_claimed_now: true,
        resolved_claimed_now: true,
      },
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.finding_status_recommendation_rows.some((row) => row.finding_id === "HRM-01" && row.current_verdict === "block"));
});

test("review completed or authority escalation claim blocks P69200", async () => {
  const result = await buildPostP64000FocusedHrmVerificationNormalization(options({
    authorityOverrides: {
      focused_review_completed_now: true,
      finding_status_fixed_allowed_now: true,
      finding_status_verified_allowed_now: true,
      finding_status_resolved_allowed_now: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_focused_hrm_verification_normalization_boundary.focused_review_completed_now, true);
  assert.equal(result.post_p64000_focused_hrm_verification_normalization_boundary.finding_status_fixed_allowed_now, true);
  assert.equal(result.post_p64000_focused_hrm_verification_normalization_boundary.finding_status_verified_allowed_now, true);
  assert.equal(result.post_p64000_focused_hrm_verification_normalization_boundary.finding_status_resolved_allowed_now, true);
});

test("source mutation or finding resolution claim blocks P69200", async () => {
  const p68800Capture = {
    ...P68800_CAPTURE,
    summary: {
      ...P68800_CAPTURE.summary,
      source_mutation_from_review_allowed_now: true,
      finding_resolution_allowed_now: true,
    },
  };

  const result = await buildPostP64000FocusedHrmVerificationNormalization(options({ p68800Capture }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_focused_hrm_verification_normalization_boundary.source_mutation_from_review_allowed_now, true);
  assert.equal(result.post_p64000_focused_hrm_verification_normalization_boundary.finding_resolution_allowed_now, true);
});

test("missing negative fixture row blocks P69200 closeout", async () => {
  const result = await buildPostP64000FocusedHrmVerificationNormalization(options({
    omitNegativeFixtureId: "recommendation_claims_fixed",
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.negative_fixtures"));
});

test("check mode validates without writing focused normalization artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-focused-hrm-verification-normalization-"));
  try {
    const result = await runPostP64000FocusedHrmVerificationNormalization(options({
      check: true,
      outDir,
    }));

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "post-p64000-focused-hrm-verification-normalization.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
