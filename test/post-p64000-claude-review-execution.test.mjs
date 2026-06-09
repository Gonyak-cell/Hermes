import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000ClaudeReviewExecution,
  runPostP64000ClaudeReviewExecution,
} from "../src/post-p64000-claude-review-execution.mjs";

const RUN_AT = "2026-06-09T04:20:00.000Z";

const BASELINE_READY = {
  schema_version: "post-p64000-claude-review-baseline.v1",
  program_range: "P64001-P64400",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    ready_for_p64401_handoff: true,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
};

const PACKET_TEXT = "# Claude Code Opus Max Review Packet P64001-P64400\n\n## Expected Output Contract\n";

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
      location: "artifacts/post-p64000-claude-review/latest/claude-review-packet.md",
      evidence: "packet head_ref is older than observed head",
      issue: "review scope drift",
      proposed_change: "normalize in the finding loop",
    },
  ],
};

const RAW_REVIEW_READY = {
  type: "result",
  subtype: "success",
  is_error: false,
  stop_reason: "end_turn",
  result: `Review follows.\n\n\`\`\`json\n${JSON.stringify(REVIEW_PAYLOAD, null, 2)}\n\`\`\``,
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
    baseline: BASELINE_READY,
    packetText: PACKET_TEXT,
    rawReview: RAW_REVIEW_READY,
    ...extra,
  };
}

test("P64800 captures durable Claude raw review with blocking findings for P64801 normalization", async () => {
  const result = await buildPostP64000ClaudeReviewExecution(options());

  assert.equal(result.schema_version, "post-p64000-claude-review-execution.v1");
  assert.equal(result.program_range, "P64401-P64800");
  assert.equal(result.source_program_range, "P64001-P64400");
  assert.equal(result.next_program_range, "P64801-P65200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_claude_review_execution_status, "review_captured_blocked_findings_ready_for_p64801");
  assert.equal(result.summary.p64400_baseline_ready_now, true);
  assert.equal(result.summary.raw_review_capture_valid_now, true);
  assert.equal(result.summary.review_verdict, "needs_changes");
  assert.equal(result.summary.open_blocking_finding_count, 3);
  assert.equal(result.summary.ready_for_p64801_handoff, true);
  assert.equal(result.summary.claude_source_mutation_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
});

test("invalid P64400 baseline blocks P64800 review execution closeout", async () => {
  const baseline = {
    ...BASELINE_READY,
    validation: { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] },
  };

  const result = await buildPostP64000ClaudeReviewExecution(options({ baseline }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p64400"));
});

test("auth failure raw output cannot be counted as Claude review evidence", async () => {
  const rawReview = {
    type: "result",
    subtype: "error",
    is_error: true,
    result: "Not logged in. Please run /login",
  };

  const result = await buildPostP64000ClaudeReviewExecution(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.claude_review_execution_rows.some((row) => row.row_id === "execution.not_auth_failure" && row.current_verdict === "block"));
});

test("malformed raw review without JSON payload blocks P64800 closeout", async () => {
  const rawReview = {
    type: "result",
    subtype: "success",
    is_error: false,
    result: "I reviewed it but did not return JSON.",
    modelUsage: { "claude-opus-4-7": {} },
  };

  const result = await buildPostP64000ClaudeReviewExecution(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "execution.raw_capture" || error.path === "output.shape"));
});

test("Claude final approval claim blocks P64800 output shape", async () => {
  const payload = {
    ...REVIEW_PAYLOAD,
    is_final_approval: true,
  };
  const rawReview = {
    ...RAW_REVIEW_READY,
    result: `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``,
  };

  const result = await buildPostP64000ClaudeReviewExecution(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.raw_review_output_shape_rows.some((row) => row.row_id === "output.no_final_approval" && row.current_verdict === "block"));
});

test("unsafe authority override blocks P64800 closeout", async () => {
  const result = await buildPostP64000ClaudeReviewExecution(options({
    authorityOverrides: {
      claude_source_mutation_allowed_now: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_claude_review_execution_boundary.claude_source_mutation_allowed_now, true);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.authority"));
});

test("check mode validates without writing P64800 execution artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-claude-review-execution-"));
  try {
    const result = await runPostP64000ClaudeReviewExecution(options({
      check: true,
      outDir,
    }));

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "post-p64000-claude-review-execution.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
