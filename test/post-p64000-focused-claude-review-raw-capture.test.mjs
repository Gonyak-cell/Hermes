import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000FocusedClaudeReviewRawCapture,
  runPostP64000FocusedClaudeReviewRawCapture,
} from "../src/post-p64000-focused-claude-review-raw-capture.mjs";

const RUN_AT = "2026-06-09T08:40:00.000Z";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const P69600_DISPATCH_READY = {
  schema_version: "post-p64000-focused-claude-review-dispatch-metadata.v1",
  program_range: "P69201-P69600",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    ready_for_p69601_handoff: true,
    dispatch_metadata_ready_now: true,
    dispatch_performed_now: false,
    raw_review_captured_now: false,
    review_evidence_counted_now: false,
    clean_checkpoint_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
};

const DISPATCH_PACKET_TEXT = "# Post-P64000 Focused Claude Review Dispatch Metadata\n\n## Dispatch Rows\n\n## Prompt Guards\n\n## Evidence Guards\n";

const DISPATCH_ROWS = {
  schema_version: "dispatch-metadata-rows.v1",
  collection: "dispatch_metadata_rows",
  rows: REQUIRED_HRM_IDS.map((findingId) => ({
    row_id: `dispatch.${findingId.toLowerCase().replace(/-/g, "_")}`,
    current_verdict: "pass",
    finding_id: findingId,
    reviewer: "claude-code-opus-max",
    reviewer_lane: "independent_read_only",
    model_alias: "opus",
    effort: "max",
    dispatch_ready_candidate_now: true,
    dispatch_performed_now: false,
    raw_review_captured_now: false,
    review_evidence_counted_now: false,
    expected_raw_capture_program_range: "P69601-P70000",
  })),
};

const REVIEW_SCOPE_ROWS = {
  schema_version: "review-scope-rows.v1",
  collection: "review_scope_rows",
  rows: REQUIRED_HRM_IDS.map((findingId) => ({
    row_id: `scope.${findingId.toLowerCase().replace(/-/g, "_")}`,
    current_verdict: "pass",
    finding_id: findingId,
    reviewed_program_range: "P68801-P69200",
  })),
};

const PROMPT_GUARD_ROWS = {
  schema_version: "review-prompt-guard-rows.v1",
  collection: "review_prompt_guard_rows",
  rows: ["json_only", "no_source_mutation", "no_patch_apply", "no_resolution", "no_clean_checkpoint"].map((id) => ({
    row_id: `prompt.${id}`,
    current_verdict: "pass",
  })),
};

const EVIDENCE_GUARD_ROWS = {
  schema_version: "evidence-counting-guard-rows.v1",
  collection: "evidence_counting_guard_rows",
  rows: ["dispatch_not_evidence", "auth_not_evidence", "timeout_not_evidence", "malformed_not_evidence", "tool_call_not_evidence"].map((id) => ({
    row_id: `evidence.${id}`,
    current_verdict: "pass",
  })),
};

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
    severity: "medium",
    category: "focused_review_followup",
    location: "artifacts/post-p64000-focused-hrm-verification-normalization/latest/normalized-recommendation-packet.md",
    evidence: `${findingId} still needs normalized review receipt treatment.`,
    issue: "Raw focused review is not a clean checkpoint by itself.",
    proposed_change: "Normalize this raw JSON in P70001-P70400.",
    blocks_clean_checkpoint: true,
  })),
};

const RAW_REVIEW_READY = {
  type: "result",
  subtype: "success",
  is_error: false,
  terminal_reason: "completed",
  session_id: "69601-70000-session",
  result: `\`\`\`json\n${JSON.stringify(REVIEW_PAYLOAD, null, 2)}\n\`\`\``,
  modelUsage: {
    "claude-opus-4-8": {
      inputTokens: 10,
      outputTokens: 10,
    },
  },
  permission_denials: [],
};

function options(extra = {}) {
  return {
    runAt: RUN_AT,
    p69600Dispatch: P69600_DISPATCH_READY,
    dispatchPacketText: DISPATCH_PACKET_TEXT,
    dispatchRows: DISPATCH_ROWS,
    reviewScopeRows: REVIEW_SCOPE_ROWS,
    promptGuardRows: PROMPT_GUARD_ROWS,
    evidenceGuardRows: EVIDENCE_GUARD_ROWS,
    rawReview: RAW_REVIEW_READY,
    ...extra,
  };
}

test("P70000 captures durable focused Claude Opus max raw review without closeout authority", async () => {
  const result = await buildPostP64000FocusedClaudeReviewRawCapture(options());

  assert.equal(result.schema_version, "post-p64000-focused-claude-review-raw-capture.v1");
  assert.equal(result.program_range, "P69601-P70000");
  assert.equal(result.source_program_range, "P69201-P69600");
  assert.equal(result.reviewed_program_range, "P68801-P69200");
  assert.equal(result.next_program_range, "P70001-P70400");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_focused_claude_review_raw_capture_status, "focused_claude_review_raw_captured_blocked_findings_ready_for_p70001");
  assert.equal(result.summary.p69600_source_ready_now, true);
  assert.equal(result.summary.claude_opus_max_policy_ready_now, true);
  assert.equal(result.summary.durable_raw_json_capture_valid_now, true);
  assert.equal(result.summary.focused_review_event_candidate_now, true);
  assert.equal(result.summary.ready_for_p70001_handoff, true);
  assert.equal(result.summary.dispatch_metadata_counted_as_review_now, false);
  assert.equal(result.summary.clean_checkpoint_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
});

test("P69600 source not ready blocks P70000 raw capture closeout", async () => {
  const p69600Dispatch = {
    ...P69600_DISPATCH_READY,
    summary: { ...P69600_DISPATCH_READY.summary, ready_for_p69601_handoff: false },
  };

  const result = await buildPostP64000FocusedClaudeReviewRawCapture(options({ p69600Dispatch }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p69600"));
});

test("dispatch metadata counted as review blocks P70000", async () => {
  const p69600Dispatch = {
    ...P69600_DISPATCH_READY,
    summary: { ...P69600_DISPATCH_READY.summary, dispatch_performed_now: true },
  };

  const result = await buildPostP64000FocusedClaudeReviewRawCapture(options({ p69600Dispatch }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.p69600_source_binding_rows.some((row) => row.row_id === "source.p69600_not_review_event" && row.current_verdict === "block"));
});

test("wrong reviewer model or effort blocks focused model policy", async () => {
  const dispatchRows = {
    ...DISPATCH_ROWS,
    rows: DISPATCH_ROWS.rows.map((row) => ({ ...row, model_alias: "sonnet", effort: "medium" })),
  };

  const result = await buildPostP64000FocusedClaudeReviewRawCapture(options({ dispatchRows }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.focused_model_policy_rows.some((row) => row.row_id === "model.dispatch_alias_opus" && row.current_verdict === "block"));
  assert.ok(result.focused_model_policy_rows.some((row) => row.row_id === "model.dispatch_effort_max" && row.current_verdict === "block"));
});

test("auth failure raw output cannot be counted as focused review evidence", async () => {
  const rawReview = {
    type: "result",
    subtype: "error",
    is_error: true,
    result: "Not logged in. Please run /login",
  };

  const result = await buildPostP64000FocusedClaudeReviewRawCapture(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.durable_raw_json_capture_rows.some((row) => row.row_id === "capture.not_auth_failure" && row.current_verdict === "block"));
});

test("malformed raw focused review without JSON payload blocks P70000", async () => {
  const rawReview = {
    ...RAW_REVIEW_READY,
    result: "I reviewed this but did not emit JSON.",
  };

  const result = await buildPostP64000FocusedClaudeReviewRawCapture(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "capture.raw_json" || error.path === "output.shape"));
});

test("tool-call-shaped output is rejected as focused review evidence", async () => {
  const rawReview = {
    ...RAW_REVIEW_READY,
    result: '{"tool_calls":[{"recipient_name":"functions.exec_command","input":{"cmd":"npm test"}}]}',
  };

  const result = await buildPostP64000FocusedClaudeReviewRawCapture(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.durable_raw_json_capture_rows.some((row) => row.row_id === "capture.not_tool_call_shape" && row.current_verdict === "block"));
});

test("payload with wrong scope or missing required HRM ids blocks output shape", async () => {
  const payload = {
    ...REVIEW_PAYLOAD,
    reviewed_program_range: "P69201-P69600",
    reviewed_hrm_ids: ["HRM-04"],
  };
  const rawReview = {
    ...RAW_REVIEW_READY,
    result: `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``,
  };

  const result = await buildPostP64000FocusedClaudeReviewRawCapture(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.focused_review_output_shape_rows.some((row) => row.row_id === "output.reviewed_program_range" && row.current_verdict === "block"));
  assert.ok(result.focused_review_output_shape_rows.some((row) => row.row_id === "output.required_hrm_ids" && row.current_verdict === "block"));
});

test("fixed, verified, resolved, clean, or final approval claims block authority boundary", async () => {
  const payload = {
    ...REVIEW_PAYLOAD,
    is_final_approval: true,
    clean_checkpoint_allowed: true,
    finding_status_fixed: true,
    finding_status_verified: true,
    finding_status_resolved: true,
  };
  const rawReview = {
    ...RAW_REVIEW_READY,
    result: `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``,
  };

  const result = await buildPostP64000FocusedClaudeReviewRawCapture(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.focused_review_output_shape_rows.some((row) => row.row_id === "output.no_final_approval" && row.current_verdict === "block"));
  assert.ok(result.focused_review_output_shape_rows.some((row) => row.row_id === "output.no_fixed_verified_claim" && row.current_verdict === "block"));
  assert.ok(result.authority_boundary_rows.some((row) => row.row_id === "authority.focused_finding_resolved_claim_allowed_now" && row.current_verdict === "block"));
});

test("check mode validates without writing focused raw capture artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-focused-claude-review-raw-capture-"));
  try {
    const result = await runPostP64000FocusedClaudeReviewRawCapture({ ...options(), check: true, outDir });

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "post-p64000-focused-claude-review-raw-capture.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
