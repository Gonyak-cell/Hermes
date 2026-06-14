import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000ClaudeReviewHandoffFreeze,
  runPostP64000ClaudeReviewHandoffFreeze,
} from "../src/post-p64000-claude-review-handoff-freeze.mjs";

const RUN_AT = "2026-06-09T12:55:00.000Z";

const NORMALIZED_RECEIPT = {
  schema_version: "post-p64000-claude-review-receipt.v1",
  receipt_status: "observed_blocking_findings",
  reviewer: "claude-code-opus-max",
  reviewer_lane: "independent_read_only",
  model_alias_requested: "opus",
  effort_requested: "max",
  actual_model_ids: ["claude-opus-4-7"],
  reviewed_program_range: "P64001-P64800",
  source_program_range: "P64401-P64800",
  source_execution_ref: "artifacts/post-p64000-claude-review-execution/latest/post-p64000-claude-review-execution.json",
  raw_output_ref: "artifacts/post-p64000-claude-review/review/claude-review-raw.json",
  overall_verdict: "needs_changes",
  blocks_clean_checkpoint: true,
  clean_checkpoint_allowed: false,
  open_blocking_finding_count: 3,
  normalized_blocking_finding_count: 3,
  finding_count: 4,
  findings: [
    {
      id: "HRM-01",
      severity: "high",
      category: "source_of_truth_drift",
      location: "review chain",
      evidence: "recursive review stage",
      issue: "unbounded review-stage recursion",
      proposed_change: "add review-depth cap",
      blocks_clean_checkpoint: true,
      normalized_status: "blocking_open",
      next_allowed_action: "plan_fix_or_scope_split_before_clean_checkpoint",
    },
    {
      id: "HRM-03",
      severity: "high",
      category: "process_structure",
      location: "review baseline scope",
      evidence: "large inter-review window",
      issue: "window exceeds reviewer confidence",
      proposed_change: "cap review window",
      blocks_clean_checkpoint: true,
      normalized_status: "blocking_open",
      next_allowed_action: "plan_fix_or_scope_split_before_clean_checkpoint",
    },
    {
      id: "HRM-04",
      severity: "high",
      category: "authority_leakage",
      location: "review packet boundary",
      evidence: "packet could be cited as performed review",
      issue: "review event boundary unclear",
      proposed_change: "add machine-readable event boundary",
      blocks_clean_checkpoint: true,
      normalized_status: "blocking_open",
      next_allowed_action: "plan_fix_or_scope_split_before_clean_checkpoint",
    },
    {
      id: "HRM-08",
      severity: "medium",
      category: "receipt_shape_validation",
      location: "validation evidence",
      evidence: "missing stdout hash",
      issue: "evidence shape should improve later",
      proposed_change: "add stdout hash",
      blocks_clean_checkpoint: false,
      normalized_status: "nonblocking_open",
      next_allowed_action: "track_nonblocking_debt",
    },
  ],
  source_mutation_performed: false,
  reviewer_final_approval_allowed: false,
  protected_closeout_allowed: false,
  production_pass_allowed: false,
  enterprise_pass_allowed: false,
};

const NORMALIZATION_READY = {
  schema_version: "post-p64000-claude-review-normalization.v1",
  program_range: "P64801-P65200",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    ready_for_p65201_handoff: true,
    review_verdict: "needs_changes",
    blocking_finding_count: 3,
    finding_count: 4,
    clean_checkpoint_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
  normalized_claude_review_receipt: NORMALIZED_RECEIPT,
};

const BLOCKING_LOOP_ROWS = [
  "blocking_visible",
  "clean_checkpoint_blocked",
  "no_auto_resolution",
  "next_revalidation_required",
].map((id) => ({
  row_id: `finding_loop.${id}`,
  current_verdict: "pass",
  observed: true,
}));

const FINDING_ACTION_ROWS = NORMALIZED_RECEIPT.findings.map((finding) => ({
  row_id: `finding_action.${finding.id.toLowerCase()}`,
  current_verdict: "pass",
  observed: true,
  finding_id: finding.id,
}));

function options(extra = {}) {
  return {
    runAt: RUN_AT,
    normalization: NORMALIZATION_READY,
    normalizedReceipt: NORMALIZED_RECEIPT,
    blockingLoopRows: BLOCKING_LOOP_ROWS,
    findingActionRows: FINDING_ACTION_ROWS,
    ...extra,
  };
}

test("P65600 freezes review refresh handoff with blockers open and automation stop recommended", async () => {
  const result = await buildPostP64000ClaudeReviewHandoffFreeze(options());

  assert.equal(result.schema_version, "post-p64000-claude-review-handoff-freeze.v1");
  assert.equal(result.program_range, "P65201-P65600");
  assert.equal(result.source_program_range, "P64801-P65200");
  assert.equal(result.next_program_range, "POST-P65600-HRM-REMEDIATION");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_claude_review_handoff_freeze_status, "post_p64000_review_refresh_complete_blockers_open_automation_stop_recommended");
  assert.equal(result.summary.blocking_finding_count, 3);
  assert.equal(result.summary.clean_checkpoint_allowed_now, false);
  assert.equal(result.summary.automation_stop_recommended_now, true);
  assert.equal(result.summary.review_refresh_complete_now, true);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
  assert.ok(result.blocking_finding_revalidation_rows.some((row) => row.finding_id === "HRM-01" && row.current_verdict === "pass"));
});

test("invalid P65200 normalization source blocks P65600 handoff freeze", async () => {
  const normalization = {
    ...NORMALIZATION_READY,
    validation: { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] },
  };

  const result = await buildPostP64000ClaudeReviewHandoffFreeze(options({ normalization }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p65200"));
});

test("blocking finding count mismatch blocks P65600 handoff freeze", async () => {
  const normalizedReceipt = {
    ...NORMALIZED_RECEIPT,
    normalized_blocking_finding_count: 2,
  };

  const result = await buildPostP64000ClaudeReviewHandoffFreeze(options({ normalizedReceipt }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "blockers.revalidated"));
});

test("auto-resolved blocking finding blocks P65600 handoff freeze", async () => {
  const normalizedReceipt = {
    ...NORMALIZED_RECEIPT,
    findings: NORMALIZED_RECEIPT.findings.map((finding) => finding.id === "HRM-01"
      ? { ...finding, normalized_status: "resolved", next_allowed_action: "resolved" }
      : finding),
  };

  const result = await buildPostP64000ClaudeReviewHandoffFreeze(options({ normalizedReceipt }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "blockers.revalidated"));
});

test("clean checkpoint or production claim blocks P65600 freeze matrix", async () => {
  const result = await buildPostP64000ClaudeReviewHandoffFreeze(options({
    freezeOverrides: {
      clean_checkpoint_allowed_now: true,
      production_pass_enabled: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "freeze.matrix"));
});

test("automation continuing after P65600 blocks automation stop recommendation", async () => {
  const result = await buildPostP64000ClaudeReviewHandoffFreeze(options({
    automationOverrides: {
      automation_stop_recommended_now: false,
      next_review_refresh_run_required_now: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "automation.stop"));
});

test("reviewer mutation or final closeout authority override blocks P65600", async () => {
  const result = await buildPostP64000ClaudeReviewHandoffFreeze(options({
    authorityOverrides: {
      reviewer_mutation_allowed_now: true,
      reviewer_final_closeout_allowed_now: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_claude_review_handoff_freeze_boundary.reviewer_mutation_allowed_now, true);
  assert.equal(result.post_p64000_claude_review_handoff_freeze_boundary.reviewer_final_closeout_allowed_now, true);
});

test("check mode validates without writing P65600 handoff freeze artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-claude-review-handoff-freeze-"));
  try {
    const result = await runPostP64000ClaudeReviewHandoffFreeze(options({
      check: true,
      outDir,
    }));

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "post-p64000-claude-review-handoff-freeze.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
