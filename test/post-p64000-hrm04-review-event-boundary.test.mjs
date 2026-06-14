import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000Hrm04ReviewEventBoundary,
  runPostP64000Hrm04ReviewEventBoundary,
} from "../src/post-p64000-hrm04-review-event-boundary.mjs";

const RUN_AT = "2026-06-09T13:30:00.000Z";

const NORMALIZED_RECEIPT = {
  schema_version: "post-p64000-claude-review-receipt.v1",
  receipt_status: "observed_blocking_findings",
  reviewer: "claude-code-opus-max",
  reviewer_lane: "independent_read_only",
  raw_output_ref: "inline.claude_review_raw",
  overall_verdict: "needs_changes",
  blocks_clean_checkpoint: true,
  clean_checkpoint_allowed: false,
  open_blocking_finding_count: 3,
  normalized_blocking_finding_count: 3,
  finding_count: 3,
  findings: [
    {
      id: "HRM-04",
      severity: "high",
      category: "authority_leakage",
      location: "review packet event boundary",
      evidence: "packet could be cited as performed review evidence",
      issue: "review packet is not the review event",
      proposed_change: "add machine-readable review-event boundary",
      blocks_clean_checkpoint: true,
      normalized_status: "blocking_open",
      next_allowed_action: "plan_fix_or_scope_split_before_clean_checkpoint",
    },
  ],
  source_mutation_performed: false,
  reviewer_final_approval_allowed: false,
  protected_closeout_allowed: false,
  production_pass_allowed: false,
  enterprise_pass_allowed: false,
};

const HANDOFF_READY = {
  schema_version: "post-p64000-claude-review-handoff-freeze.v1",
  program_range: "P65201-P65600",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    review_refresh_complete_now: true,
    blocking_findings_preserved_now: true,
    clean_checkpoint_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
  blocking_finding_revalidation_rows: [
    {
      row_id: "blocker.hrm_04_open",
      current_verdict: "pass",
      finding_id: "HRM-04",
      normalized_status: "blocking_open",
    },
  ],
};

const BASELINE_READY = {
  schema_version: "post-p64000-claude-review-baseline.v1",
  program_range: "P64001-P64400",
  validation: { valid: true, error_count: 0, errors: [] },
};

const EXECUTION_READY = {
  schema_version: "post-p64000-claude-review-execution.v1",
  program_range: "P64401-P64800",
  validation: { valid: true, error_count: 0, errors: [] },
};

const RAW_REVIEW_READY = {
  type: "result",
  subtype: "success",
  is_error: false,
  result: "{\"overall_verdict\":\"needs_changes\"}",
  modelUsage: {
    "claude-opus-4-7": {
      inputTokens: 1,
      outputTokens: 1,
    },
  },
};

const PACKET_TEXT = "# Claude Code Opus Max Review Packet\n\nReview scope only. Do not provide final approval.";

function options(extra = {}) {
  return {
    runAt: RUN_AT,
    handoff: HANDOFF_READY,
    baseline: BASELINE_READY,
    packetText: PACKET_TEXT,
    execution: EXECUTION_READY,
    rawReview: RAW_REVIEW_READY,
    normalizedReceipt: NORMALIZED_RECEIPT,
    ...extra,
  };
}

test("P66000 separates review packet from performed Claude review event", async () => {
  const result = await buildPostP64000Hrm04ReviewEventBoundary(options());

  assert.equal(result.schema_version, "post-p64000-hrm04-review-event-boundary.v1");
  assert.equal(result.program_range, "P65601-P66000");
  assert.equal(result.source_program_range, "P65201-P65600");
  assert.equal(result.next_program_range, "P66001-P66400");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_hrm04_review_event_boundary_status, "hrm04_review_event_boundary_remediated_candidate_ready_for_p66001");
  assert.equal(result.summary.packet_is_review_event_now, false);
  assert.equal(result.summary.raw_json_is_review_event_now, true);
  assert.equal(result.summary.packet_citable_as_performed_review_now, false);
  assert.equal(result.summary.hrm04_remediated_candidate_now, true);
  assert.equal(result.summary.clean_checkpoint_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
  assert.equal(result.review_event_boundary_manifest.packet_boundary.is_claude_review_event, false);
  assert.equal(result.review_event_boundary_manifest.performed_review_event_boundary.is_claude_review_event, true);
});

test("invalid P65600 handoff source blocks HRM-04 remediation", async () => {
  const handoff = {
    ...HANDOFF_READY,
    validation: { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] },
  };

  const result = await buildPostP64000Hrm04ReviewEventBoundary(options({ handoff }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.ready"));
});

test("packet treated as review event blocks boundary closeout", async () => {
  const result = await buildPostP64000Hrm04ReviewEventBoundary(options({
    manifestOverrides: {
      packet_boundary: {
        is_claude_review_event: true,
        performed_review_evidence_allowed: true,
        citable_as_performed_review: true,
      },
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_hrm04_review_event_boundary.packet_is_review_event_now, true);
  assert.ok(result.validation.errors.some((error) => error.path === "boundary.packet_false" || error.path === "rows.authority"));
});

test("raw review event missing true marker blocks boundary closeout", async () => {
  const result = await buildPostP64000Hrm04ReviewEventBoundary(options({
    manifestOverrides: {
      performed_review_event_boundary: {
        is_claude_review_event: false,
      },
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_hrm04_review_event_boundary.raw_json_is_review_event_now, false);
  assert.ok(result.validation.errors.some((error) => error.path === "boundary.raw_true"));
});

test("auth failure raw output cannot become performed review event", async () => {
  const rawReview = {
    type: "result",
    subtype: "error",
    is_error: true,
    result: "Not logged in. Please run /login",
    modelUsage: { "claude-opus-4-7": {} },
  };

  const result = await buildPostP64000Hrm04ReviewEventBoundary(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.review_event_boundary_rows.some((row) => row.row_id === "boundary.raw_evidence_allowed" && row.current_verdict === "block"));
});

test("tool-call shaped raw output cannot become performed review event", async () => {
  const rawReview = {
    type: "tool_use",
    subtype: "success",
    is_error: false,
    result: "",
    modelUsage: { "claude-opus-4-7": {} },
  };

  const result = await buildPostP64000Hrm04ReviewEventBoundary(options({ rawReview }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "boundary.ready" || error.path === "citation.guard"));
});

test("final approval or production claim blocks authority boundary", async () => {
  const normalizedReceipt = {
    ...NORMALIZED_RECEIPT,
    reviewer_final_approval_allowed: true,
    production_pass_allowed: true,
  };

  const result = await buildPostP64000Hrm04ReviewEventBoundary(options({ normalizedReceipt }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_hrm04_review_event_boundary.claude_final_approval_allowed, true);
  assert.equal(result.post_p64000_hrm04_review_event_boundary.production_pass_enabled, true);
});

test("reviewer mutation authority override blocks HRM-04 boundary closeout", async () => {
  const result = await buildPostP64000Hrm04ReviewEventBoundary(options({
    authorityOverrides: {
      reviewer_mutation_allowed_now: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_hrm04_review_event_boundary.reviewer_mutation_allowed_now, true);
});

test("check mode validates without writing HRM-04 boundary artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-hrm04-review-event-boundary-"));
  try {
    const result = await runPostP64000Hrm04ReviewEventBoundary(options({
      check: true,
      outDir,
    }));

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "post-p64000-hrm04-review-event-boundary.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
