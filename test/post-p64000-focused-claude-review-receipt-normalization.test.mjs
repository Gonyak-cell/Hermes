import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000FocusedClaudeReviewReceiptNormalization,
  runPostP64000FocusedClaudeReviewReceiptNormalization,
} from "../src/post-p64000-focused-claude-review-receipt-normalization.mjs";

const RUN_AT = "2026-06-09T08:55:00.000Z";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const REVIEW_PAYLOAD = {
  overall_verdict: "needs_changes",
  blocks_clean_checkpoint: true,
  open_blocking_finding_count: 3,
  is_claude_review_event: true,
  is_final_approval: false,
  is_production_pass: false,
  is_enterprise_pass: false,
  reviewer: "claude-code-opus-max",
  reviewer_lane: "independent_read_only",
  dispatch_program_range: "P69201-P69600",
  reviewed_program_range: "P68801-P69200",
  review_event_program_range: "P69601-P70000",
  reviewed_hrm_ids: REQUIRED_HRM_IDS,
  requires_later_normalization: true,
  findings: REQUIRED_HRM_IDS.map((findingId) => ({
    id: findingId,
    severity: "high",
    category: "focused_review_followup",
    location: "artifacts/post-p64000-focused-hrm-verification-normalization/latest/normalized-recommendation-packet.md",
    evidence: `${findingId} remains blocking_open with verification_pending recommendation.`,
    issue: `${findingId} still needs focused finding-loop treatment.`,
    proposed_change: "plan_remediation_closeout_candidate_or_re_review_before_clean_checkpoint",
    blocks_clean_checkpoint: true,
  })),
};

const RAW_REVIEW_READY = {
  type: "result",
  subtype: "success",
  is_error: false,
  terminal_reason: "completed",
  session_id: "70001-70400-session",
  result: `\`\`\`json\n${JSON.stringify(REVIEW_PAYLOAD, null, 2)}\n\`\`\``,
  modelUsage: {
    "claude-opus-4-8": {
      inputTokens: 10,
      outputTokens: 10,
    },
  },
};

const RAW_HASH = sha256(JSON.stringify(RAW_REVIEW_READY));

const CAPTURE_READY = {
  schema_version: "post-p64000-focused-claude-review-raw-capture.v1",
  program_range: "P69601-P70000",
  source_program_range: "P69201-P69600",
  reviewed_program_range: "P68801-P69200",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    ready_for_p70001_handoff: true,
    durable_raw_json_capture_valid_now: true,
    focused_review_event_candidate_now: true,
    raw_review_sha256: RAW_HASH,
    review_verdict: "needs_changes",
    open_blocking_finding_count: 3,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
  extracted_focused_review_payload: REVIEW_PAYLOAD,
};

const OUTPUT_SHAPE_ROWS = {
  schema_version: "focused-review-output-shape-rows.v1",
  collection: "focused_review_output_shape_rows",
  rows: [{ row_id: "output.required_hrm_ids", current_verdict: "pass" }],
};

const EVENT_BOUNDARY_ROWS = {
  schema_version: "focused-review-event-boundary-rows.v1",
  collection: "focused_review_event_boundary_rows",
  rows: [{ row_id: "event.payload_is_focused_review_event", current_verdict: "pass" }],
};

function options(extra = {}) {
  return {
    runAt: RUN_AT,
    capture: CAPTURE_READY,
    extractedPayload: REVIEW_PAYLOAD,
    rawReview: RAW_REVIEW_READY,
    outputShapeRows: OUTPUT_SHAPE_ROWS,
    eventBoundaryRows: EVENT_BOUNDARY_ROWS,
    ...extra,
  };
}

test("P70400 normalizes focused Claude receipt while preserving open HRM findings", async () => {
  const result = await buildPostP64000FocusedClaudeReviewReceiptNormalization(options());

  assert.equal(result.schema_version, "post-p64000-focused-claude-review-receipt-normalization.v1");
  assert.equal(result.program_range, "P70001-P70400");
  assert.equal(result.source_program_range, "P69601-P70000");
  assert.equal(result.dispatch_program_range, "P69201-P69600");
  assert.equal(result.reviewed_program_range, "P68801-P69200");
  assert.equal(result.next_program_range, "P70401-P70800");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_focused_claude_review_receipt_normalization_status, "focused_receipt_normalized_findings_ready_for_p70401");
  assert.equal(result.summary.p70000_capture_ready_now, true);
  assert.equal(result.summary.normalized_focused_receipt_ready_now, true);
  assert.equal(result.summary.blocking_finding_count, 3);
  assert.equal(result.summary.finding_count, 3);
  assert.equal(result.summary.clean_checkpoint_allowed_now, false);
  assert.equal(result.summary.ready_for_p70401_handoff, true);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
  assert.equal(result.normalized_focused_claude_review_receipt.raw_output_sha256, RAW_HASH);
  assert.ok(result.focused_finding_classification_rows.some((row) => row.finding_id === "HRM-04" && row.blocking === true));
});

test("invalid P70000 capture blocks focused normalization", async () => {
  const capture = {
    ...CAPTURE_READY,
    validation: { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] },
  };

  const result = await buildPostP64000FocusedClaudeReviewReceiptNormalization(options({ capture }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p70000"));
});

test("raw review hash mismatch blocks focused normalization", async () => {
  const capture = {
    ...CAPTURE_READY,
    summary: { ...CAPTURE_READY.summary, raw_review_sha256: "0".repeat(64) },
  };

  const result = await buildPostP64000FocusedClaudeReviewReceiptNormalization(options({ capture }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.p70000_capture_source_rows.some((row) => row.row_id === "source.raw_hash_matches" && row.current_verdict === "block"));
});

test("missing required HRM id blocks focused receipt normalization", async () => {
  const reviewPayload = {
    ...REVIEW_PAYLOAD,
    reviewed_hrm_ids: ["HRM-04", "HRM-03"],
  };
  const capture = {
    ...CAPTURE_READY,
    extracted_focused_review_payload: reviewPayload,
  };

  const result = await buildPostP64000FocusedClaudeReviewReceiptNormalization(options({
    capture,
    extractedPayload: reviewPayload,
    reviewPayload,
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.normalized_focused_review_receipt_rows.some((row) => row.row_id === "receipt.hrm_ids" && row.current_verdict === "block"));
});

test("finding missing required field blocks focused classification", async () => {
  const reviewPayload = {
    ...REVIEW_PAYLOAD,
    findings: [{ ...REVIEW_PAYLOAD.findings[0], proposed_change: "" }],
  };
  const capture = {
    ...CAPTURE_READY,
    extracted_focused_review_payload: reviewPayload,
  };

  const result = await buildPostP64000FocusedClaudeReviewReceiptNormalization(options({
    capture,
    extractedPayload: reviewPayload,
    reviewPayload,
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.focused_finding_classification_rows.some((row) => row.row_id === "focused_finding.hrm_04" && row.current_verdict === "block"));
});

test("blocking findings hidden blocks focused finding loop", async () => {
  const reviewPayload = {
    ...REVIEW_PAYLOAD,
    findings: REVIEW_PAYLOAD.findings.map((finding) => ({ ...finding, blocks_clean_checkpoint: false, severity: "medium" })),
  };
  const capture = {
    ...CAPTURE_READY,
    extracted_focused_review_payload: reviewPayload,
  };

  const result = await buildPostP64000FocusedClaudeReviewReceiptNormalization(options({
    capture,
    extractedPayload: reviewPayload,
    reviewPayload,
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "findings.visible"));
});

test("fixed, verified, resolved, clean, or final approval claims block P70400", async () => {
  const reviewPayload = {
    ...REVIEW_PAYLOAD,
    is_final_approval: true,
    clean_checkpoint_allowed: true,
    finding_status_fixed: true,
    finding_status_verified: true,
    finding_status_resolved: true,
  };

  const result = await buildPostP64000FocusedClaudeReviewReceiptNormalization(options({ reviewPayload }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_focused_claude_review_receipt_normalization_boundary.claude_final_approval_allowed, true);
  assert.equal(result.post_p64000_focused_claude_review_receipt_normalization_boundary.clean_checkpoint_claim_allowed_now, true);
  assert.equal(result.post_p64000_focused_claude_review_receipt_normalization_boundary.focused_finding_fixed_claim_allowed_now, true);
  assert.equal(result.post_p64000_focused_claude_review_receipt_normalization_boundary.focused_finding_verified_claim_allowed_now, true);
  assert.equal(result.post_p64000_focused_claude_review_receipt_normalization_boundary.focused_finding_resolved_claim_allowed_now, true);
});

test("source mutation or finding resolution claim blocks focused normalization", async () => {
  const reviewPayload = {
    ...REVIEW_PAYLOAD,
    source_mutation_performed: true,
    finding_resolution_performed: true,
  };

  const result = await buildPostP64000FocusedClaudeReviewReceiptNormalization(options({ reviewPayload }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_focused_claude_review_receipt_normalization_boundary.source_mutation_from_review_allowed_now, true);
  assert.equal(result.post_p64000_focused_claude_review_receipt_normalization_boundary.finding_resolution_allowed_now, true);
});

test("missing negative fixture row blocks focused closeout", async () => {
  const result = await buildPostP64000FocusedClaudeReviewReceiptNormalization(options({ omitNegativeFixtureId: "raw_review_hash_mismatch" }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.negative_fixtures"));
});

test("check mode validates without writing focused normalization artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-focused-claude-review-receipt-normalization-"));
  try {
    const result = await runPostP64000FocusedClaudeReviewReceiptNormalization({ ...options(), check: true, outDir });

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "post-p64000-focused-claude-review-receipt-normalization.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
