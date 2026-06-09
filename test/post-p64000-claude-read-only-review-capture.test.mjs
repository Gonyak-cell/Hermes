import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000ClaudeReadOnlyReviewCapture,
  runPostP64000ClaudeReadOnlyReviewCapture,
} from "../src/post-p64000-claude-read-only-review-capture.mjs";

const RUN_AT = "2026-06-09T07:20:00.000Z";

const SOURCE_RESULT_READY = {
  schema_version: "post-p64000-hrm-revalidation-clean-candidate-review.v1",
  program_range: "P66801-P67200",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    ready_for_p67201_handoff: true,
    packet_is_claude_review_event_now: false,
    review_execution_performed_now: false,
    future_claude_review_required_now: true,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
};

const PACKET_TEXT = "# Post-P64000 HRM Clean-Candidate Review Packet\n\n## Review Scope\n\n## Expected Output Contract\n";

const PACKET_BOUNDARY = {
  schema_version: "clean-candidate-review-packet-boundary.v1",
  artifact_kind: "claude_clean_candidate_review_request_packet",
  is_claude_review_event: false,
  performed_review_evidence_allowed: false,
  review_execution_performed_now: false,
  future_claude_review_required: true,
  requires_durable_raw_json_for_future_review: true,
};

const DISPATCH_METADATA = {
  schema_version: "claude-review-dispatch-metadata.v1",
  reviewer: "claude-code-opus-max",
  reviewer_lane: "independent_read_only",
  model_alias: "opus",
  effort: "max",
  source_mutation_allowed: false,
  command: "claude -p --model opus --effort max --output-format json",
};

const REVIEW_PAYLOAD = {
  overall_verdict: "needs_changes",
  blocks_clean_checkpoint: true,
  open_blocking_finding_count: 1,
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
  findings: [
    {
      id: "HRM-CLEAN-01",
      severity: "medium",
      category: "review_followup",
      location: "artifacts/post-p64000-hrm-revalidation-clean-candidate-review/latest/clean-candidate-review-packet.md",
      evidence: "The candidate packet still needs normalized finding-loop closeout.",
      issue: "Durable raw review is not a clean checkpoint by itself.",
      proposed_change: "Normalize this raw JSON in P67601-P68000.",
      blocks_clean_checkpoint: true,
    },
  ],
};

const RAW_REVIEW_READY = {
  type: "result",
  subtype: "success",
  is_error: false,
  terminal_reason: "completed",
  session_id: "67201-67600-session",
  result: `\`\`\`json\n${JSON.stringify(REVIEW_PAYLOAD, null, 2)}\n\`\`\``,
  modelUsage: {
    "claude-opus-4-7": {
      inputTokens: 10,
      outputTokens: 10,
    },
  },
  permission_denials: [],
};

function options(extra = {}) {
  return {
    runAt: RUN_AT,
    sourceResult: SOURCE_RESULT_READY,
    packetText: PACKET_TEXT,
    packetBoundary: PACKET_BOUNDARY,
    dispatchMetadata: DISPATCH_METADATA,
    rawReview: RAW_REVIEW_READY,
    ...extra,
  };
}

test("P67600 captures durable Claude Opus max read-only review without clean checkpoint authority", async () => {
  const result = await buildPostP64000ClaudeReadOnlyReviewCapture(options());

  assert.equal(result.schema_version, "post-p64000-claude-read-only-review-capture.v1");
  assert.equal(result.program_range, "P67201-P67600");
  assert.equal(result.source_program_range, "P66801-P67200");
  assert.equal(result.next_program_range, "P67601-P68000");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_claude_read_only_review_capture_status, "claude_read_only_review_captured_blocked_findings_ready_for_p67601");
  assert.equal(result.summary.p67200_source_ready_now, true);
  assert.equal(result.summary.claude_opus_max_policy_ready_now, true);
  assert.equal(result.summary.durable_raw_json_capture_valid_now, true);
  assert.equal(result.summary.review_event_candidate_now, true);
  assert.equal(result.summary.ready_for_p67601_handoff, true);
  assert.equal(result.summary.clean_checkpoint_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
});

test("P67200 source that is not ready blocks P67600 capture closeout", async () => {
  const sourceResult = {
    ...SOURCE_RESULT_READY,
    summary: { ...SOURCE_RESULT_READY.summary, ready_for_p67201_handoff: false },
  };

  const result = await buildPostP64000ClaudeReadOnlyReviewCapture(options({ sourceResult }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p67200"));
});

test("source packet boundary claiming review event blocks P67600", async () => {
  const packetBoundary = {
    ...PACKET_BOUNDARY,
    is_claude_review_event: true,
  };

  const result = await buildPostP64000ClaudeReadOnlyReviewCapture(options({ packetBoundary }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.p67200_source_binding_rows.some((row) => row.row_id === "source.packet_not_review_event" && row.current_verdict === "block"));
});

test("missing dispatch metadata blocks model policy", async () => {
  const result = await buildPostP64000ClaudeReadOnlyReviewCapture(options({ dispatchMetadata: null }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "model.policy"));
});

test("wrong reviewer model or effort blocks P67600", async () => {
  const dispatchMetadata = {
    ...DISPATCH_METADATA,
    model_alias: "sonnet",
    effort: "medium",
  };

  const result = await buildPostP64000ClaudeReadOnlyReviewCapture(options({ dispatchMetadata }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.model_policy_rows.some((row) => row.row_id === "model.alias_opus" && row.current_verdict === "block"));
  assert.ok(result.model_policy_rows.some((row) => row.row_id === "model.effort_max" && row.current_verdict === "block"));
});

test("auth failure raw output cannot be counted as review evidence", async () => {
  const rawReview = {
    type: "result",
    subtype: "error",
    is_error: true,
    result: "Not logged in. Please run /login",
  };

  const result = await buildPostP64000ClaudeReadOnlyReviewCapture(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.durable_raw_json_capture_rows.some((row) => row.row_id === "capture.not_auth_failure" && row.current_verdict === "block"));
});

test("malformed raw review without JSON payload blocks P67600", async () => {
  const rawReview = {
    ...RAW_REVIEW_READY,
    result: "I reviewed this but did not emit JSON.",
  };

  const result = await buildPostP64000ClaudeReadOnlyReviewCapture(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "capture.raw_json" || error.path === "output.shape"));
});

test("tool-call-shaped output is rejected as review evidence", async () => {
  const rawReview = {
    ...RAW_REVIEW_READY,
    result: '{"tool_calls":[{"recipient_name":"functions.exec_command","input":{"cmd":"npm test"}}]}',
  };

  const result = await buildPostP64000ClaudeReadOnlyReviewCapture(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.durable_raw_json_capture_rows.some((row) => row.row_id === "capture.not_tool_call_shape" && row.current_verdict === "block"));
});

test("payload missing required HRM ids blocks P67600 output shape", async () => {
  const payload = {
    ...REVIEW_PAYLOAD,
    reviewed_hrm_ids: ["HRM-04"],
  };
  const rawReview = {
    ...RAW_REVIEW_READY,
    result: `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``,
  };

  const result = await buildPostP64000ClaudeReadOnlyReviewCapture(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.review_output_shape_rows.some((row) => row.row_id === "output.required_hrm_ids" && row.current_verdict === "block"));
});

test("clean checkpoint or final approval claim blocks authority boundary", async () => {
  const payload = {
    ...REVIEW_PAYLOAD,
    is_final_approval: true,
    clean_checkpoint_allowed: true,
  };
  const rawReview = {
    ...RAW_REVIEW_READY,
    result: `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``,
  };

  const result = await buildPostP64000ClaudeReadOnlyReviewCapture(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.review_output_shape_rows.some((row) => row.row_id === "output.no_final_approval" && row.current_verdict === "block"));
  assert.ok(result.review_output_shape_rows.some((row) => row.row_id === "output.no_clean_checkpoint" && row.current_verdict === "block"));
});

test("missing negative fixture row blocks P67600 closeout", async () => {
  const result = await buildPostP64000ClaudeReadOnlyReviewCapture(options({
    omitNegativeFixtureId: "auth_failure_or_login_prompt",
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.negative_fixtures"));
});

test("check mode validates without writing P67600 capture artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-claude-read-only-review-capture-"));
  try {
    const result = await runPostP64000ClaudeReadOnlyReviewCapture(options({
      check: true,
      outDir,
    }));

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "post-p64000-claude-read-only-review-capture.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
