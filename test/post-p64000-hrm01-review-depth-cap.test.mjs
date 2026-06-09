import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000Hrm01ReviewDepthCap,
  runPostP64000Hrm01ReviewDepthCap,
} from "../src/post-p64000-hrm01-review-depth-cap.mjs";

const RUN_AT = "2026-06-09T15:45:00.000Z";

const HRM03_WINDOW_CAP_READY = {
  schema_version: "post-p64000-hrm03-review-window-cap.v1",
  program_range: "P66001-P66400",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    ready_for_p66401_handoff: true,
    hrm03_remediated_candidate_now: true,
    clean_checkpoint_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
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
      id: "HRM-01",
      severity: "high",
      category: "source_of_truth_drift",
      location: "schemas/, scripts/, src/, test/ cascading review-of-review chain",
      evidence: "Many file basenames contain the token review five or more times.",
      issue: "Unbounded review-stage recursion and cascading review chain.",
      proposed_change: "Define and enforce a maximum review-depth invariant, collapse the cascading chain, and fail new files matching review-review-review without explicit waiver.",
      confidence: "high",
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

const CASCADING_FILE_INVENTORY = [
  "schemas/work-os-review-review-review-review-packet.schema.json",
  "scripts/work-os-review-review-review-review-packet.mjs",
  "src/work-os-review-review-review-review-packet.mjs",
  "test/work-os-review-review-review-review-packet.test.mjs",
  "docs/hermes-roadmap-p66401-p66800.md",
];

function options(extra = {}) {
  return {
    runAt: RUN_AT,
    hrm03WindowCap: HRM03_WINDOW_CAP_READY,
    normalizedReceipt: NORMALIZED_RECEIPT_READY,
    handoffFreeze: HANDOFF_FREEZE_READY,
    fileInventory: CASCADING_FILE_INVENTORY,
    ...extra,
  };
}

test("P66800 detects cascading review depth and requires collapse or waiver", async () => {
  const result = await buildPostP64000Hrm01ReviewDepthCap(options());

  assert.equal(result.schema_version, "post-p64000-hrm01-review-depth-cap.v1");
  assert.equal(result.program_range, "P66401-P66800");
  assert.equal(result.source_program_range, "P66001-P66400");
  assert.equal(result.next_program_range, "P66801-P67200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_hrm01_review_depth_cap_status, "hrm01_review_depth_cap_remediated_candidate_ready_for_p66801");
  assert.equal(result.summary.cascading_review_file_count, 4);
  assert.equal(result.summary.cascading_review_quartet_count, 1);
  assert.equal(result.summary.max_review_token_count, 4);
  assert.equal(result.summary.review_depth_over_cap_now, true);
  assert.equal(result.summary.collapse_or_waiver_required_now, true);
  assert.equal(result.summary.source_collapse_performed_now, false);
  assert.equal(result.summary.clean_checkpoint_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
});

test("missing P66400 source blocks HRM-01 remediation", async () => {
  const result = await buildPostP64000Hrm01ReviewDepthCap(options({
    hrm03WindowCap: null,
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.ready" || error.path.startsWith("schema.")));
});

test("missing HRM-01 finding blocks review-depth remediation", async () => {
  const normalizedReceipt = {
    ...NORMALIZED_RECEIPT_READY,
    findings: [],
  };

  const result = await buildPostP64000Hrm01ReviewDepthCap(options({ normalizedReceipt }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_hrm01_review_depth_cap_boundary.hrm01_auto_resolved_allowed_now, true);
  assert.ok(result.validation.errors.some((error) => error.path === "source.ready" || error.path === "hrm01.remediated_candidate"));
});

test("over-depth review chain treated as clean blocks policy and authority", async () => {
  const result = await buildPostP64000Hrm01ReviewDepthCap(options({
    policyOverrides: {
      clean_candidate_allowed_when_over_depth: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_hrm01_review_depth_cap_boundary.clean_candidate_allowed_when_over_depth_now, true);
  assert.equal(result.post_p64000_hrm01_review_depth_cap_boundary.review_depth_over_cap_clean_allowed_now, true);
  assert.ok(result.validation.errors.some((error) => error.path === "policy.ready" || error.path === "rows.authority"));
});

test("waiver without explicit receipt blocks review-depth closeout", async () => {
  const result = await buildPostP64000Hrm01ReviewDepthCap(options({
    policyOverrides: {
      explicit_waiver_receipt_required: false,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_hrm01_review_depth_cap_boundary.review_depth_waiver_without_receipt_allowed_now, true);
  assert.ok(result.validation.errors.some((error) => error.path === "policy.ready" || error.path === "rows.authority"));
});

test("new cascading review files cannot be allowed without waiver", async () => {
  const result = await buildPostP64000Hrm01ReviewDepthCap(options({
    policyOverrides: {
      new_cascading_review_file_allowed_without_waiver: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_hrm01_review_depth_cap_boundary.new_cascading_review_file_allowed_now, true);
  assert.ok(result.validation.errors.some((error) => error.path === "policy.ready" || error.path === "rows.authority"));
});

test("source mutation or collapse claim blocks HRM-01 candidate", async () => {
  const normalizedReceipt = {
    ...NORMALIZED_RECEIPT_READY,
    source_mutation_performed: true,
  };

  const result = await buildPostP64000Hrm01ReviewDepthCap(options({
    normalizedReceipt,
    policyOverrides: {
      source_collapse_performed_now: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_hrm01_review_depth_cap_boundary.source_collapse_performed_now, true);
  assert.equal(result.post_p64000_hrm01_review_depth_cap_boundary.review_depth_source_collapse_claim_allowed_now, true);
  assert.equal(result.post_p64000_hrm01_review_depth_cap_boundary.source_mutation_from_review_allowed_now, true);
});

test("final approval or production claim blocks authority boundary", async () => {
  const normalizedReceipt = {
    ...NORMALIZED_RECEIPT_READY,
    reviewer_final_approval_allowed: true,
    production_pass_allowed: true,
    enterprise_pass_allowed: true,
  };

  const result = await buildPostP64000Hrm01ReviewDepthCap(options({ normalizedReceipt }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_hrm01_review_depth_cap_boundary.claude_final_approval_allowed, true);
  assert.equal(result.post_p64000_hrm01_review_depth_cap_boundary.production_pass_enabled, true);
  assert.equal(result.post_p64000_hrm01_review_depth_cap_boundary.enterprise_pass_enabled, true);
});

test("missing negative fixture contract blocks closeout", async () => {
  const result = await buildPostP64000Hrm01ReviewDepthCap(options({
    omitNegativeFixtureId: "missing_cascade_detector",
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.negative_fixtures"));
});

test("check mode validates without writing HRM-01 depth cap artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-hrm01-review-depth-cap-"));
  try {
    const result = await runPostP64000Hrm01ReviewDepthCap(options({
      check: true,
      outDir,
    }));

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "post-p64000-hrm01-review-depth-cap.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
