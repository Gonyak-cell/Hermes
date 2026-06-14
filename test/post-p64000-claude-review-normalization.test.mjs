import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000ClaudeReviewNormalization,
  runPostP64000ClaudeReviewNormalization,
} from "../src/post-p64000-claude-review-normalization.mjs";

const RUN_AT = "2026-06-09T12:40:00.000Z";

const REVIEW_PAYLOAD = {
  overall_verdict: "needs_changes",
  blocks_clean_checkpoint: true,
  open_blocking_finding_count: 3,
  is_final_approval: false,
  is_production_pass: false,
  is_enterprise_pass: false,
  reviewer: "claude-code-opus-max",
  reviewer_lane: "independent_read_only",
  findings: [
    {
      id: "HRM-01",
      severity: "high",
      category: "source_of_truth_drift",
      location: "post-P64000 review packet",
      evidence: "review chain recurses beyond one level",
      issue: "unbounded review-stage recursion",
      proposed_change: "add review depth cap before clean checkpoint",
      blocks_clean_checkpoint: true,
    },
    {
      id: "HRM-03",
      severity: "high",
      category: "process_structure",
      location: "review baseline scope",
      evidence: "113 commits in the inter-review window",
      issue: "review window is too large for a clean checkpoint",
      proposed_change: "cap review window or split the review",
      blocks_clean_checkpoint: true,
    },
    {
      id: "HRM-04",
      severity: "high",
      category: "authority_leakage",
      location: "review packet event boundary",
      evidence: "packet could be cited as a performed review",
      issue: "review packet is not the review event",
      proposed_change: "add machine-readable review-event boundary",
      blocks_clean_checkpoint: true,
    },
    {
      id: "HRM-08",
      severity: "medium",
      category: "receipt_shape_validation",
      location: "validation evidence",
      evidence: "baseline check lacks exit code hash",
      issue: "validation evidence should be more durable",
      proposed_change: "add receipt path and stdout hash in a later fix",
      blocks_clean_checkpoint: false,
    },
  ],
};

const EXECUTION_READY = {
  schema_version: "post-p64000-claude-review-execution.v1",
  program_range: "P64401-P64800",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    ready_for_p64801_handoff: true,
    raw_review_capture_valid_now: true,
    review_verdict: "needs_changes",
    open_blocking_finding_count: 3,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
  extracted_review_payload: REVIEW_PAYLOAD,
};

const RAW_REVIEW_READY = {
  type: "result",
  subtype: "success",
  is_error: false,
  result: JSON.stringify(REVIEW_PAYLOAD),
  total_cost_usd: 0.88,
  modelUsage: {
    "claude-opus-4-7": {
      inputTokens: 1,
      outputTokens: 1,
    },
  },
};

function options(extra = {}) {
  return {
    runAt: RUN_AT,
    execution: EXECUTION_READY,
    extractedPayload: REVIEW_PAYLOAD,
    rawReview: RAW_REVIEW_READY,
    ...extra,
  };
}

test("P65200 normalizes Claude review receipt while preserving blocking findings", async () => {
  const result = await buildPostP64000ClaudeReviewNormalization(options());

  assert.equal(result.schema_version, "post-p64000-claude-review-normalization.v1");
  assert.equal(result.program_range, "P64801-P65200");
  assert.equal(result.source_program_range, "P64401-P64800");
  assert.equal(result.next_program_range, "P65201-P65600");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_claude_review_normalization_status, "receipt_normalized_blocking_findings_ready_for_p65201");
  assert.equal(result.summary.review_verdict, "needs_changes");
  assert.equal(result.summary.blocking_finding_count, 3);
  assert.equal(result.summary.finding_count, 4);
  assert.equal(result.summary.clean_checkpoint_allowed_now, false);
  assert.equal(result.summary.ready_for_p65201_handoff, true);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
  assert.equal(result.normalized_claude_review_receipt.receipt_status, "observed_blocking_findings");
  assert.ok(result.finding_classification_rows.some((row) => row.finding_id === "HRM-01" && row.blocking === true));
  assert.ok(result.finding_classification_rows.some((row) => row.finding_id === "HRM-08" && row.blocking === false));
});

test("invalid P64800 source blocks P65200 normalization", async () => {
  const execution = {
    ...EXECUTION_READY,
    validation: { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] },
  };

  const result = await buildPostP64000ClaudeReviewNormalization(options({ execution }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p64800"));
});

test("missing extracted review payload blocks P65200 normalization", async () => {
  const execution = {
    ...EXECUTION_READY,
    extracted_review_payload: null,
  };

  const result = await buildPostP64000ClaudeReviewNormalization(options({
    execution,
    extractedPayload: null,
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p64800" || error.path === "receipt.normalized"));
});

test("finding missing required fields blocks finding classification", async () => {
  const reviewPayload = {
    ...REVIEW_PAYLOAD,
    findings: [{ ...REVIEW_PAYLOAD.findings[0], proposed_change: "" }],
  };
  const execution = {
    ...EXECUTION_READY,
    extracted_review_payload: reviewPayload,
  };

  const result = await buildPostP64000ClaudeReviewNormalization(options({
    execution,
    extractedPayload: reviewPayload,
    reviewPayload,
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.finding_classification_rows.some((row) => row.row_id === "finding.hrm_01" && row.current_verdict === "block"));
});

test("Claude final approval claim blocks normalization authority boundary", async () => {
  const reviewPayload = {
    ...REVIEW_PAYLOAD,
    is_final_approval: true,
  };

  const result = await buildPostP64000ClaudeReviewNormalization(options({ reviewPayload }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_claude_review_normalization_boundary.claude_final_approval_allowed, true);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.authority"));
});

test("production or enterprise PASS claim blocks normalization closeout", async () => {
  const result = await buildPostP64000ClaudeReviewNormalization(options({
    reviewPayload: {
      ...REVIEW_PAYLOAD,
      is_production_pass: true,
      is_enterprise_pass: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_claude_review_normalization_boundary.production_pass_enabled, true);
  assert.equal(result.post_p64000_claude_review_normalization_boundary.enterprise_pass_enabled, true);
});

test("source mutation or finding resolution authority override blocks P65200 closeout", async () => {
  const result = await buildPostP64000ClaudeReviewNormalization(options({
    authorityOverrides: {
      source_mutation_from_review_allowed_now: true,
      finding_resolution_allowed_now: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_claude_review_normalization_boundary.source_mutation_from_review_allowed_now, true);
  assert.equal(result.post_p64000_claude_review_normalization_boundary.finding_resolution_allowed_now, true);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.authority"));
});

test("check mode validates without writing P65200 normalization artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-claude-review-normalization-"));
  try {
    const result = await runPostP64000ClaudeReviewNormalization(options({
      check: true,
      outDir,
    }));

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "post-p64000-claude-review-normalization.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
