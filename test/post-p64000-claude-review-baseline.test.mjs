import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000ClaudeReviewBaseline,
  runPostP64000ClaudeReviewBaseline,
} from "../src/post-p64000-claude-review-baseline.mjs";

const RUN_AT = "2026-06-09T04:00:00.000Z";
const RECEIPT_MTIME = Date.parse("2026-06-07T12:53:36.000Z");

const FINAL_FREEZE_READY = {
  schema_version: "hermes-loop-final-freeze.v1",
  program_range: "P63601-P64000",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    p64000_final_freeze_ready: true,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
  hermes_loop_final_freeze_boundary: {
    final_approval_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
};

const CLAUDE_RECEIPT_READY = {
  schema_version: "claude-review-receipt.v1",
  receipt_status: "observed",
  reviewer: "claude-code-opus-max",
  model: "opus",
  overall_verdict: "PASS_WITH_FINDINGS",
  open_blocking_finding_count: 0,
  blocks_clean_checkpoint: false,
  findings: [],
  raw_output_ref: "artifacts/trust-debt-recalibration/review/claude-rereview-raw.json",
  output_hash: "5e0577e975d10a6b5821b19ca46b8aa191ce9b1647eb3025e8a8c6befa665fd9",
  source_mutation_performed: false,
  reviewer_final_approval_allowed: false,
};

const COMMIT_ROWS = [
  { hash: "21f44bc", timestamp: 1780973615, subject: "hermes: add loop final freeze through p64000" },
  { hash: "3d69b88", timestamp: 1780970960, subject: "hermes: add loop source binding baseline through p60400" },
];

const CHANGED_FILES = [
  "docs/hermes-loop-system-specification.md",
  "src/hermes-loop-final-freeze.mjs",
  "test/hermes-loop-final-freeze.test.mjs",
];

function options(extra = {}) {
  return {
    runAt: RUN_AT,
    headRef: "21f44bc",
    finalFreeze: FINAL_FREEZE_READY,
    lastClaudeReceipt: CLAUDE_RECEIPT_READY,
    rawClaudeReview: { type: "result", result: "{}" },
    receiptMtime: RECEIPT_MTIME,
    commitRows: COMMIT_ROWS,
    changedFiles: CHANGED_FILES,
    ...extra,
  };
}

test("P64400 creates a read-only post-P64000 Claude review packet baseline", async () => {
  const result = await buildPostP64000ClaudeReviewBaseline(options());

  assert.equal(result.schema_version, "post-p64000-claude-review-baseline.v1");
  assert.equal(result.program_range, "P64001-P64400");
  assert.equal(result.source_program_range, "P63601-P64000");
  assert.equal(result.next_program_range, "P64401-P64800");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_claude_review_baseline_status, "ready_for_p64401_claude_readonly_review");
  assert.equal(result.summary.p64000_final_freeze_ready_now, true);
  assert.equal(result.summary.last_claude_receipt_valid_now, true);
  assert.equal(result.summary.post_review_commit_count, 2);
  assert.equal(result.summary.changed_file_count, 3);
  assert.equal(result.claude_review_packet_rows.length, 10);
  assert.equal(result.summary.claude_review_execution_allowed_now, false);
  assert.equal(result.summary.claude_source_mutation_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
  assert.ok(result.claude_review_packet_markdown.includes("Expected Output Contract"));
});

test("invalid P64000 final freeze source blocks P64400 baseline", async () => {
  const finalFreeze = {
    ...FINAL_FREEZE_READY,
    validation: { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] },
  };

  const result = await buildPostP64000ClaudeReviewBaseline(options({ finalFreeze }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.post_p64000_claude_review_baseline_status, "blocked_post_p64000_claude_review_baseline");
  assert.ok(result.validation.errors.some((error) => error.path === "source.p64000"));
});

test("empty Claude receipt blocks P64400 baseline", async () => {
  const result = await buildPostP64000ClaudeReviewBaseline(options({ lastClaudeReceipt: {} }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.last_claude_receipt_valid_now, false);
  assert.ok(result.validation.errors.some((error) => error.path === "receipt.last_claude"));
});

test("missing raw durable capture blocks P64400 baseline", async () => {
  const result = await buildPostP64000ClaudeReviewBaseline(options({ rawClaudeReview: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.last_claude_receipt_valid_now, false);
  assert.ok(result.last_claude_review_receipt_rows.some((row) => row.row_id === "receipt.raw_durable" && row.current_verdict === "block"));
});

test("reference folder included in changed file scope blocks P64400 baseline", async () => {
  const result = await buildPostP64000ClaudeReviewBaseline(options({
    changedFiles: [...CHANGED_FILES, "hermes-operator-console-2026-06-06/reference.html"],
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "scope.post_review_commits" || error.path === "scope.changed_files"));
});

test("unsafe Claude review execution authority blocks P64400 baseline", async () => {
  const result = await buildPostP64000ClaudeReviewBaseline(options({
    authorityOverrides: {
      claude_review_execution_allowed_now: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_claude_review_boundary.claude_review_execution_allowed_now, true);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.authority"));
});

test("check mode validates without writing post-P64000 review artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-claude-review-"));
  try {
    const result = await runPostP64000ClaudeReviewBaseline(options({
      check: true,
      outDir,
    }));

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "post-p64000-claude-review-baseline.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
