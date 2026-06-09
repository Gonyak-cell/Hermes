import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000FocusedReReviewRawCaptureIntake,
  runPostP64000FocusedReReviewRawCaptureIntake,
} from "../src/post-p64000-focused-re-review-raw-capture-intake.mjs";

const RUN_AT = "2026-06-09T18:40:00.000Z";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const P71600_DISPATCH_GATE_READY = {
  schema_version: "post-p64000-focused-re-review-dispatch-gate.v1",
  program_range: "P71201-P71600",
  source_program_range: "P70801-P71200",
  review_source_program_range: "P70401-P70800",
  next_program_range: "P71601-P72000",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    post_p64000_focused_re_review_dispatch_gate_status: "focused_re_review_dispatch_gate_ready_for_p71601",
    ready_for_p71601_handoff: true,
    durable_raw_json_captured_now: false,
    review_evidence_counted_now: false,
    clean_checkpoint_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
};

const DISPATCH_PACKET_TEXT = "# Focused Re-Review Dispatch Packet\n\n## Required Reviewer\n\n- reviewer: claude-code-opus-max\n";

const DISPATCH_ROWS = collection("focused-re-review-dispatch-packet-rows.v1", "focused_re_review_dispatch_packet_rows", {
  reviewer: "claude-code-opus-max",
  reviewer_lane: "independent_read_only",
  required_receipt_type: "durable_raw_json",
  dispatch_packet_is_review_evidence: false,
});

const RAW_CAPTURE_GATE_ROWS = collection("durable-raw-capture-gate-rows.v1", "durable_raw_capture_gate_rows", {
  capture_required_now: true,
  durable_raw_json_captured_now: false,
  review_evidence_counted_now: false,
});

const EVIDENCE_COUNTING_GUARD_ROWS = {
  schema_version: "evidence-counting-guard-rows.v1",
  collection: "evidence_counting_guard_rows",
  rows: ["dispatch_not_evidence", "missing_not_evidence", "auth_not_evidence", "timeout_not_evidence", "tool_call_not_evidence"].map((id) => ({
    row_id: `guard.${id}`,
    current_verdict: "pass",
  })),
};

const REVIEW_PAYLOAD = {
  overall_verdict: "needs_changes",
  open_blocking_finding_count: 3,
  is_claude_re_review_event: true,
  is_final_approval: false,
  is_production_pass: false,
  is_enterprise_pass: false,
  reviewer: "claude-code-opus-max",
  reviewer_lane: "independent_read_only",
  dispatch_program_range: "P71201-P71600",
  reviewed_program_range: "P70801-P71200",
  review_event_program_range: "P71601-P72000",
  reviewed_hrm_ids: REQUIRED_HRM_IDS,
  requires_later_normalization: true,
  findings: REQUIRED_HRM_IDS.map((findingId) => ({
    id: findingId,
    status: "blocking_open",
    issue: `${findingId} requires focused re-review normalization.`,
  })),
};

const RAW_REVIEW_READY = {
  type: "result",
  subtype: "success",
  is_error: false,
  terminal_reason: "completed",
  session_id: "p71601-p72000-session",
  result: `\`\`\`json\n${JSON.stringify(REVIEW_PAYLOAD, null, 2)}\n\`\`\``,
  modelUsage: {
    "claude-opus-4-8": {
      inputTokens: 10,
      outputTokens: 10,
    },
  },
  permission_denials: [],
};

function collection(schemaVersion, name, extra) {
  return {
    schema_version: schemaVersion,
    collection: name,
    rows: REQUIRED_HRM_IDS.map((findingId) => ({
      row_id: `${name}.${findingId}`,
      category: name,
      current_verdict: "pass",
      finding_id: findingId,
      ...extra,
    })),
  };
}

function options(extra = {}) {
  return {
    runAt: RUN_AT,
    dispatchGate: P71600_DISPATCH_GATE_READY,
    dispatchPacketText: DISPATCH_PACKET_TEXT,
    dispatchRows: DISPATCH_ROWS,
    rawCaptureGateRows: RAW_CAPTURE_GATE_ROWS,
    evidenceCountingGuardRows: EVIDENCE_COUNTING_GUARD_ROWS,
    rawReview: RAW_REVIEW_READY,
    ...extra,
  };
}

test("P72000 records missing raw capture as a valid non-evidence BLOCK handoff", async () => {
  const result = await buildPostP64000FocusedReReviewRawCaptureIntake(options({ rawReview: undefined }));

  assert.equal(result.schema_version, "post-p64000-focused-re-review-raw-capture-intake.v1");
  assert.equal(result.program_range, "P71601-P72000");
  assert.equal(result.source_program_range, "P71201-P71600");
  assert.equal(result.reviewed_program_range, "P70801-P71200");
  assert.equal(result.next_program_range, "P72001-P72400");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_focused_re_review_raw_capture_intake_status, "focused_re_review_raw_capture_missing_evidence_block_ready_for_p72001");
  assert.equal(result.summary.p71600_dispatch_gate_source_ready_now, true);
  assert.equal(result.summary.raw_review_available_now, false);
  assert.equal(result.summary.durable_raw_json_captured_now, false);
  assert.equal(result.summary.missing_evidence_block_now, true);
  assert.equal(result.summary.invalid_evidence_block_now, false);
  assert.equal(result.summary.focused_re_review_event_candidate_now, false);
  assert.equal(result.summary.review_evidence_counted_now, false);
  assert.equal(result.summary.ready_for_p72001_handoff, true);
  assert.equal(result.summary.clean_checkpoint_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
});

test("P72000 accepts valid durable raw JSON only as normalization candidate, not final approval", async () => {
  const result = await buildPostP64000FocusedReReviewRawCaptureIntake(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_focused_re_review_raw_capture_intake_status, "focused_re_review_raw_capture_ready_for_p72001");
  assert.equal(result.summary.raw_review_available_now, true);
  assert.equal(result.summary.durable_raw_json_captured_now, true);
  assert.equal(result.summary.missing_evidence_block_now, false);
  assert.equal(result.summary.invalid_evidence_block_now, false);
  assert.equal(result.summary.focused_re_review_event_candidate_now, true);
  assert.equal(result.summary.review_evidence_counted_now, false);
  assert.equal(result.summary.ready_for_p72001_handoff, true);
  assert.equal(result.summary.clean_checkpoint_allowed_now, false);
  assert.equal(result.summary.final_approval_enabled, false);
});

test("invalid P71600 dispatch gate source blocks P72000 intake", async () => {
  const dispatchGate = {
    ...P71600_DISPATCH_GATE_READY,
    validation: { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] },
  };

  const result = await buildPostP64000FocusedReReviewRawCaptureIntake(options({ dispatchGate }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p71600"));
});

test("auth failure raw output becomes invalid evidence block, not review evidence", async () => {
  const rawReview = {
    type: "result",
    subtype: "error",
    is_error: true,
    result: "Not logged in. Please run /login",
  };

  const result = await buildPostP64000FocusedReReviewRawCaptureIntake(options({ rawReview }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_focused_re_review_raw_capture_intake_status, "focused_re_review_raw_capture_invalid_evidence_block_ready_for_p72001");
  assert.equal(result.summary.durable_raw_json_captured_now, false);
  assert.equal(result.summary.invalid_evidence_block_now, true);
  assert.equal(result.summary.review_evidence_counted_now, false);
  assert.equal(result.raw_capture_state.reason, "raw_wrapper_not_success");
});

test("malformed or tool-call-shaped raw output remains invalid non-evidence block", async () => {
  const malformed = await buildPostP64000FocusedReReviewRawCaptureIntake(options({
    rawReview: { ...RAW_REVIEW_READY, result: "I reviewed this but did not emit JSON." },
  }));
  const toolCall = await buildPostP64000FocusedReReviewRawCaptureIntake(options({
    rawReview: { ...RAW_REVIEW_READY, result: '{"tool_calls":[{"recipient_name":"functions.exec_command","input":{"cmd":"npm test"}}]}' },
  }));

  assert.equal(malformed.validation.valid, true);
  assert.equal(malformed.summary.invalid_evidence_block_now, true);
  assert.equal(malformed.summary.review_evidence_counted_now, false);
  assert.equal(toolCall.validation.valid, true);
  assert.equal(toolCall.summary.invalid_evidence_block_now, true);
  assert.equal(toolCall.summary.review_evidence_counted_now, false);
});

test("payload missing required HRM ids remains invalid non-evidence block", async () => {
  const payload = {
    ...REVIEW_PAYLOAD,
    reviewed_hrm_ids: ["HRM-04"],
    findings: REVIEW_PAYLOAD.findings.filter((finding) => finding.id === "HRM-04"),
  };
  const rawReview = {
    ...RAW_REVIEW_READY,
    result: `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``,
  };

  const result = await buildPostP64000FocusedReReviewRawCaptureIntake(options({ rawReview }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.invalid_evidence_block_now, true);
  assert.equal(result.summary.durable_raw_json_captured_now, false);
  assert.equal(result.raw_capture_state.reason, "focused_re_review_payload_shape_invalid");
});

test("final, production, enterprise, clean, mutation, or resolution claims block authority boundary", async () => {
  const payload = {
    ...REVIEW_PAYLOAD,
    is_final_approval: true,
    is_production_pass: true,
    is_enterprise_pass: true,
    clean_checkpoint_allowed: true,
    source_mutation_performed: true,
    finding_status_fixed: true,
    finding_status_verified: true,
    finding_status_resolved: true,
  };
  const rawReview = {
    ...RAW_REVIEW_READY,
    result: `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``,
  };

  const result = await buildPostP64000FocusedReReviewRawCaptureIntake(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.authority"));
  assert.ok(result.authority_boundary_rows.some((row) => row.authority_flag === "claude_final_approval_allowed" && row.current_verdict === "block"));
  assert.ok(result.authority_boundary_rows.some((row) => row.authority_flag === "post_p72000_enterprise_pass_claim_allowed_now" && row.current_verdict === "block"));
});

test("missing negative fixture row blocks P72000 closeout", async () => {
  const result = await buildPostP64000FocusedReReviewRawCaptureIntake(options({
    rawReview: undefined,
    omitNegativeFixtureId: "missing_p72001_handoff",
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.negative_fixtures"));
});

test("check mode validates without writing P72000 intake artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-focused-re-review-raw-capture-intake-"));
  await rm(outDir, { recursive: true, force: true });

  const result = await runPostP64000FocusedReReviewRawCaptureIntake(options({
    rawReview: undefined,
    outDir,
    check: true,
  }));

  assert.equal(result.validation.valid, true);
  await assert.rejects(
    readFile(path.join(outDir, "post-p64000-focused-re-review-raw-capture-intake.json"), "utf8"),
    /ENOENT/,
  );
});
