import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000ClaudeReviewReceiptNormalization,
  runPostP64000ClaudeReviewReceiptNormalization,
} from "../src/post-p64000-claude-review-receipt-normalization.mjs";

const RUN_AT = "2026-06-09T07:35:00.000Z";

const REVIEW_PAYLOAD = {
  overall_verdict: "clean_candidate_with_open_followups",
  blocks_clean_checkpoint: true,
  open_blocking_finding_count: 3,
  is_claude_review_event: true,
  is_final_approval: false,
  is_production_pass: false,
  is_enterprise_pass: false,
  reviewer: "claude-code-opus-max",
  reviewer_lane: "independent_read_only",
  reviewed_program_range: "P66801-P67200",
  review_event_program_range: "P67201-P67600",
  reviewed_hrm_ids: ["HRM-04", "HRM-03", "HRM-01"],
  requires_later_normalization: true,
  source_mutation_performed: false,
  finding_resolution_performed: false,
  clean_checkpoint_allowed: false,
  findings: [
    {
      id: "HRM-04",
      severity: "high",
      category: "review_event_boundary",
      location: "hrm04 boundary artifact",
      evidence: "HRM-04 remains blocking_open",
      issue: "candidate needs focused verification",
      proposed_change: "read candidate JSON and verify boundary guards",
      blocks_clean_checkpoint: true,
    },
    {
      id: "HRM-03",
      severity: "high",
      category: "review_window_cap",
      location: "hrm03 window cap artifact",
      evidence: "HRM-03 remains blocking_open",
      issue: "window cap enforcement needs focused verification",
      proposed_change: "verify cap enforcement and overflow routing",
      blocks_clean_checkpoint: true,
    },
    {
      id: "HRM-01",
      severity: "high",
      category: "review_depth_cap",
      location: "hrm01 depth cap artifact",
      evidence: "HRM-01 remains blocking_open",
      issue: "depth cap termination semantics need focused verification",
      proposed_change: "verify review depth hard block",
      blocks_clean_checkpoint: true,
    },
    {
      id: "PACKET-OBS-01",
      severity: "low",
      category: "artifact_path_consistency",
      location: "evidence refs",
      evidence: "mixed absolute and repo-relative paths",
      issue: "portability should improve",
      proposed_change: "normalize evidence refs later",
      blocks_clean_checkpoint: false,
    },
  ],
  non_findings: ["authority flags remained false"],
  next_handoff_recommendations: ["normalize this output without resolving HRM findings"],
};

const RAW_REVIEW_READY = {
  type: "result",
  subtype: "success",
  is_error: false,
  terminal_reason: "completed",
  session_id: "67601-68000-session",
  result: `\`\`\`json\n${JSON.stringify(REVIEW_PAYLOAD, null, 2)}\n\`\`\``,
  modelUsage: {
    "claude-opus-4-7": {
      inputTokens: 10,
      outputTokens: 10,
    },
  },
};

const RAW_HASH = sha256(JSON.stringify(RAW_REVIEW_READY));

const CAPTURE_READY = {
  schema_version: "post-p64000-claude-read-only-review-capture.v1",
  program_range: "P67201-P67600",
  source_program_range: "P66801-P67200",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    ready_for_p67601_handoff: true,
    durable_raw_json_capture_valid_now: true,
    review_event_candidate_now: true,
    raw_review_sha256: RAW_HASH,
    review_verdict: "clean_candidate_with_open_followups",
    open_blocking_finding_count: 3,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
  extracted_review_payload: REVIEW_PAYLOAD,
};

const DISPATCH_METADATA = {
  schema_version: "claude-review-dispatch-metadata.v1",
  reviewer: "claude-code-opus-max",
  reviewer_lane: "independent_read_only",
  model_alias: "opus",
  effort: "max",
  source_mutation_allowed: false,
};

function options(extra = {}) {
  return {
    runAt: RUN_AT,
    capture: CAPTURE_READY,
    extractedPayload: REVIEW_PAYLOAD,
    rawReview: RAW_REVIEW_READY,
    dispatchMetadata: DISPATCH_METADATA,
    ...extra,
  };
}

test("P68000 normalizes Claude HRM review receipt while preserving open findings", async () => {
  const result = await buildPostP64000ClaudeReviewReceiptNormalization(options());

  assert.equal(result.schema_version, "post-p64000-claude-review-receipt-normalization.v1");
  assert.equal(result.program_range, "P67601-P68000");
  assert.equal(result.source_program_range, "P67201-P67600");
  assert.equal(result.next_program_range, "P68001-P68400");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_claude_review_receipt_normalization_status, "receipt_normalized_findings_ready_for_p68001");
  assert.equal(result.summary.p67600_capture_ready_now, true);
  assert.equal(result.summary.normalized_receipt_ready_now, true);
  assert.equal(result.summary.blocking_finding_count, 3);
  assert.equal(result.summary.finding_count, 4);
  assert.equal(result.summary.clean_checkpoint_allowed_now, false);
  assert.equal(result.summary.ready_for_p68001_handoff, true);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
  assert.equal(result.normalized_claude_review_receipt.raw_output_sha256, RAW_HASH);
  assert.ok(result.finding_classification_rows.some((row) => row.finding_id === "HRM-04" && row.blocking === true));
  assert.ok(result.finding_classification_rows.some((row) => row.finding_id === "PACKET-OBS-01" && row.blocking === false));
});

test("invalid P67600 capture blocks P68000 normalization", async () => {
  const capture = {
    ...CAPTURE_READY,
    validation: { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] },
  };

  const result = await buildPostP64000ClaudeReviewReceiptNormalization(options({ capture }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p67600"));
});

test("raw review hash mismatch blocks normalization", async () => {
  const capture = {
    ...CAPTURE_READY,
    summary: { ...CAPTURE_READY.summary, raw_review_sha256: "0".repeat(64) },
  };

  const result = await buildPostP64000ClaudeReviewReceiptNormalization(options({ capture }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.p67600_capture_source_rows.some((row) => row.row_id === "source.raw_hash_matches" && row.current_verdict === "block"));
});

test("missing required HRM id blocks receipt normalization", async () => {
  const reviewPayload = {
    ...REVIEW_PAYLOAD,
    reviewed_hrm_ids: ["HRM-04", "HRM-03"],
  };
  const capture = {
    ...CAPTURE_READY,
    extracted_review_payload: reviewPayload,
  };

  const result = await buildPostP64000ClaudeReviewReceiptNormalization(options({
    capture,
    extractedPayload: reviewPayload,
    reviewPayload,
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.normalized_review_receipt_rows.some((row) => row.row_id === "receipt.hrm_ids" && row.current_verdict === "block"));
});

test("finding missing required field blocks finding classification", async () => {
  const reviewPayload = {
    ...REVIEW_PAYLOAD,
    findings: [{ ...REVIEW_PAYLOAD.findings[0], proposed_change: "" }],
  };
  const capture = {
    ...CAPTURE_READY,
    extracted_review_payload: reviewPayload,
  };

  const result = await buildPostP64000ClaudeReviewReceiptNormalization(options({
    capture,
    extractedPayload: reviewPayload,
    reviewPayload,
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.finding_classification_rows.some((row) => row.row_id === "finding.hrm_04" && row.current_verdict === "block"));
});

test("blocking findings hidden or auto-resolved blocks finding loop", async () => {
  const reviewPayload = {
    ...REVIEW_PAYLOAD,
    findings: REVIEW_PAYLOAD.findings.map((finding) => ({ ...finding, blocks_clean_checkpoint: false })),
  };
  const capture = {
    ...CAPTURE_READY,
    extracted_review_payload: reviewPayload,
  };

  const result = await buildPostP64000ClaudeReviewReceiptNormalization(options({
    capture,
    extractedPayload: reviewPayload,
    reviewPayload,
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "findings.visible"));
});

test("clean checkpoint or final approval claim blocks P68000 authority boundary", async () => {
  const reviewPayload = {
    ...REVIEW_PAYLOAD,
    is_final_approval: true,
    clean_checkpoint_allowed: true,
  };

  const result = await buildPostP64000ClaudeReviewReceiptNormalization(options({ reviewPayload }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_claude_review_receipt_normalization_boundary.claude_final_approval_allowed, true);
  assert.equal(result.post_p64000_claude_review_receipt_normalization_boundary.clean_checkpoint_claim_allowed_now, true);
});

test("source mutation or finding resolution claim blocks P68000", async () => {
  const reviewPayload = {
    ...REVIEW_PAYLOAD,
    source_mutation_performed: true,
    finding_resolution_performed: true,
  };

  const result = await buildPostP64000ClaudeReviewReceiptNormalization(options({ reviewPayload }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_claude_review_receipt_normalization_boundary.source_mutation_from_review_allowed_now, true);
  assert.equal(result.post_p64000_claude_review_receipt_normalization_boundary.finding_resolution_allowed_now, true);
});

test("missing negative fixture row blocks P68000 closeout", async () => {
  const result = await buildPostP64000ClaudeReviewReceiptNormalization(options({
    omitNegativeFixtureId: "raw_review_hash_mismatch",
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.negative_fixtures"));
});

test("check mode validates without writing P68000 normalization artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-claude-review-receipt-normalization-"));
  try {
    const result = await runPostP64000ClaudeReviewReceiptNormalization(options({
      check: true,
      outDir,
    }));

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "post-p64000-claude-review-receipt-normalization.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}
