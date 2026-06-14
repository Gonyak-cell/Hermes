import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000Hrm03ReviewWindowCap,
  runPostP64000Hrm03ReviewWindowCap,
} from "../src/post-p64000-hrm03-review-window-cap.mjs";

const RUN_AT = "2026-06-09T15:05:00.000Z";

const HRM04_BOUNDARY_READY = {
  schema_version: "post-p64000-hrm04-review-event-boundary.v1",
  program_range: "P65601-P66000",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    ready_for_p66001_handoff: true,
    hrm04_remediated_candidate_now: true,
    clean_checkpoint_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
};

const BASELINE_READY = {
  schema_version: "post-p64000-claude-review-baseline.v1",
  program_range: "P64001-P64400",
  validation: { valid: true, error_count: 0, errors: [] },
  post_review_changed_file_rows: [
    { file_path: "docs/hermes-roadmap-p60001-p60400.md" },
    { file_path: "docs/hermes-roadmap-p60401-p60800.md" },
    { file_path: "src/example.mjs" },
  ],
  summary: {
    post_review_commit_count: 113,
    changed_file_count: 568,
  },
};

const EXECUTION_READY = {
  schema_version: "post-p64000-claude-review-execution.v1",
  program_range: "P64401-P64800",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    raw_review_capture_valid_now: true,
    review_verdict: "needs_changes",
  },
};

const NORMALIZED_RECEIPT_READY = {
  schema_version: "post-p64000-claude-review-receipt.v1",
  receipt_status: "observed_blocking_findings",
  reviewer: "claude-code-opus-max",
  reviewer_lane: "independent_read_only",
  overall_verdict: "needs_changes",
  blocks_clean_checkpoint: true,
  open_blocking_finding_count: 3,
  normalized_blocking_finding_count: 3,
  finding_count: 8,
  findings: [
    {
      id: "HRM-03",
      severity: "high",
      category: "process_structure",
      location: "Review packet Commit Range section",
      evidence: "post_review_commit_count: 113",
      issue: "A 113-commit inter-review window exceeds a safe independent-checkpoint interval.",
      proposed_change: "Cap inter-Claude-review window at <= 25 commits or <= 1 roadmap range and split this packet.",
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

const HANDOFF_FREEZE_READY = {
  schema_version: "post-p64000-claude-review-handoff-freeze.v1",
  program_range: "P65201-P65600",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    ready_for_post_p65600_handoff: true,
    blocking_findings_preserved_now: true,
    clean_checkpoint_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
};

function options(extra = {}) {
  return {
    runAt: RUN_AT,
    hrm04Boundary: HRM04_BOUNDARY_READY,
    baseline: BASELINE_READY,
    execution: EXECUTION_READY,
    normalizedReceipt: NORMALIZED_RECEIPT_READY,
    handoffFreeze: HANDOFF_FREEZE_READY,
    ...extra,
  };
}

test("P66400 catches oversized HRM-03 review window and requires scope split", async () => {
  const result = await buildPostP64000Hrm03ReviewWindowCap(options());

  assert.equal(result.schema_version, "post-p64000-hrm03-review-window-cap.v1");
  assert.equal(result.program_range, "P66001-P66400");
  assert.equal(result.source_program_range, "P65601-P66000");
  assert.equal(result.next_program_range, "P66401-P66800");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_hrm03_review_window_cap_status, "hrm03_review_window_cap_remediated_candidate_ready_for_p66401");
  assert.equal(result.summary.post_review_commit_count, 113);
  assert.equal(result.summary.changed_file_count, 568);
  assert.equal(result.summary.commit_window_over_cap_now, true);
  assert.equal(result.summary.phase_window_over_cap_now, true);
  assert.equal(result.summary.scope_split_required_now, true);
  assert.equal(result.summary.clean_candidate_allowed_when_over_cap_now, false);
  assert.equal(result.summary.clean_checkpoint_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
  assert.equal(result.review_window_cap_policy.observed_window.post_review_commit_count, 113);
  assert.equal(result.review_window_cap_policy.observed_window.scope_split_required, true);
});

test("missing P64400 baseline blocks HRM-03 window cap remediation", async () => {
  const result = await buildPostP64000Hrm03ReviewWindowCap(options({
    baseline: null,
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.ready" || error.path.startsWith("schema.")));
});

test("missing post review commit count blocks HRM-03 window observation", async () => {
  const baseline = {
    ...BASELINE_READY,
    summary: { changed_file_count: 568 },
  };

  const result = await buildPostP64000Hrm03ReviewWindowCap(options({ baseline }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.review_window_observation_rows.some((row) => row.row_id === "window.commit_count_present" && row.current_verdict === "block"));
});

test("over-cap window treated as clean blocks policy and authority boundary", async () => {
  const result = await buildPostP64000Hrm03ReviewWindowCap(options({
    policyOverrides: {
      clean_candidate_allowed_when_over_cap: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_hrm03_review_window_cap_boundary.clean_candidate_allowed_when_over_cap_now, true);
  assert.equal(result.post_p64000_hrm03_review_window_cap_boundary.review_window_over_cap_clean_allowed_now, true);
  assert.ok(result.validation.errors.some((error) => error.path === "policy.ready" || error.path === "rows.authority"));
});

test("scope split bypass blocks HRM-03 closeout", async () => {
  const result = await buildPostP64000Hrm03ReviewWindowCap(options({
    policyOverrides: {
      over_cap_requires_scope_split: false,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_hrm03_review_window_cap_boundary.scope_split_required_now, false);
  assert.equal(result.post_p64000_hrm03_review_window_cap_boundary.scope_split_bypass_allowed_now, true);
  assert.ok(result.validation.errors.some((error) => error.path === "scope_split.guard" || error.path === "rows.authority"));
});

test("HRM-03 auto-resolution claim blocks remediation candidate", async () => {
  const normalizedReceipt = {
    ...NORMALIZED_RECEIPT_READY,
    findings: [
      {
        ...NORMALIZED_RECEIPT_READY.findings[0],
        normalized_status: "resolved",
      },
    ],
  };

  const result = await buildPostP64000Hrm03ReviewWindowCap(options({ normalizedReceipt }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_hrm03_review_window_cap_boundary.hrm03_auto_resolved_allowed_now, true);
  assert.ok(result.validation.errors.some((error) => error.path === "source.ready" || error.path === "hrm03.remediated_candidate"));
});

test("final approval or production claim blocks authority boundary", async () => {
  const normalizedReceipt = {
    ...NORMALIZED_RECEIPT_READY,
    reviewer_final_approval_allowed: true,
    production_pass_allowed: true,
    enterprise_pass_allowed: true,
  };

  const result = await buildPostP64000Hrm03ReviewWindowCap(options({ normalizedReceipt }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_hrm03_review_window_cap_boundary.claude_final_approval_allowed, true);
  assert.equal(result.post_p64000_hrm03_review_window_cap_boundary.production_pass_enabled, true);
  assert.equal(result.post_p64000_hrm03_review_window_cap_boundary.enterprise_pass_enabled, true);
});

test("missing negative fixture contract blocks closeout", async () => {
  const result = await buildPostP64000Hrm03ReviewWindowCap(options({
    omitNegativeFixtureId: "missing_scope_split_action",
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.negative_fixtures"));
});

test("check mode validates without writing HRM-03 window cap artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-hrm03-review-window-cap-"));
  try {
    const result = await runPostP64000Hrm03ReviewWindowCap(options({
      check: true,
      outDir,
    }));

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "post-p64000-hrm03-review-window-cap.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
