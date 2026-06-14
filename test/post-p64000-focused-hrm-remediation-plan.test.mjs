import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000FocusedHrmRemediationPlan,
  runPostP64000FocusedHrmRemediationPlan,
} from "../src/post-p64000-focused-hrm-remediation-plan.mjs";

const RUN_AT = "2026-06-09T08:25:00.000Z";
const RAW_HASH = "a".repeat(64);

const HRM_FINDINGS = [
  {
    id: "HRM-04",
    severity: "high",
    category: "review_event_boundary",
    location: "artifacts/post-p64000-hrm04-review-event-boundary/latest/post-p64000-hrm04-review-event-boundary.json",
    evidence: "candidate exists",
    issue: "verify review event boundary",
    proposed_change: "verify raw JSON boundary",
    normalized_status: "blocking_open",
    blocks_clean_checkpoint: true,
  },
  {
    id: "HRM-03",
    severity: "high",
    category: "review_window_cap",
    location: "artifacts/post-p64000-hrm03-review-window-cap/latest/post-p64000-hrm03-review-window-cap.json",
    evidence: "candidate exists",
    issue: "verify review window cap",
    proposed_change: "verify window split guard",
    normalized_status: "blocking_open",
    blocks_clean_checkpoint: true,
  },
  {
    id: "HRM-01",
    severity: "high",
    category: "review_depth_cap",
    location: "artifacts/post-p64000-hrm01-review-depth-cap/latest/post-p64000-hrm01-review-depth-cap.json",
    evidence: "candidate exists",
    issue: "verify depth cap",
    proposed_change: "verify collapse or waiver guard",
    normalized_status: "blocking_open",
    blocks_clean_checkpoint: true,
  },
];

const NORMALIZED_RECEIPT = {
  schema_version: "post-p64000-hrm-claude-review-receipt.v1",
  receipt_status: "observed_blocking_findings",
  reviewer: "claude-code-opus-max",
  reviewer_lane: "independent_read_only",
  model_alias: "opus",
  effort: "max",
  reviewed_program_range: "P66801-P67200",
  review_event_program_range: "P67201-P67600",
  raw_output_sha256: RAW_HASH,
  is_claude_review_event: true,
  overall_verdict: "clean_candidate_with_open_followups",
  blocks_clean_checkpoint: true,
  clean_checkpoint_allowed: false,
  open_blocking_finding_count: 3,
  normalized_blocking_finding_count: 3,
  finding_count: 3,
  reviewed_hrm_ids: ["HRM-04", "HRM-03", "HRM-01"],
  findings: HRM_FINDINGS,
  source_mutation_performed: false,
  finding_resolution_performed: false,
  reviewer_final_approval_allowed: false,
  protected_closeout_allowed: false,
  production_pass_allowed: false,
  enterprise_pass_allowed: false,
};

const NORMALIZATION = {
  schema_version: "post-p64000-claude-review-receipt-normalization.v1",
  program_range: "P67601-P68000",
  source_program_range: "P67201-P67600",
  next_program_range: "P68001-P68400",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    ready_for_p68001_handoff: true,
    raw_output_sha256: RAW_HASH,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
};

const FINDING_LOOP_ROWS = { schema_version: "finding-loop-rows.v1", rows: HRM_FINDINGS.map((finding) => ({ finding_id: finding.id })) };
const FINDING_ACTION_ROWS = { schema_version: "finding-action-rows.v1", rows: HRM_FINDINGS.map((finding) => ({ finding_id: finding.id })) };

const CANDIDATES = {
  "HRM-04": candidate("post-p64000-hrm04-review-event-boundary.v1", "P65601-P66000", "hrm04_remediated_candidate_now"),
  "HRM-03": candidate("post-p64000-hrm03-review-window-cap.v1", "P66001-P66400", "hrm03_remediated_candidate_now"),
  "HRM-01": candidate("post-p64000-hrm01-review-depth-cap.v1", "P66401-P66800", "hrm01_remediated_candidate_now"),
};

function options(extra = {}) {
  return {
    runAt: RUN_AT,
    normalization: NORMALIZATION,
    normalizedReceipt: NORMALIZED_RECEIPT,
    findingLoopRows: FINDING_LOOP_ROWS,
    findingActionRows: FINDING_ACTION_ROWS,
    candidateSources: CANDIDATES,
    ...extra,
  };
}

test("P68400 creates focused HRM verification planning without resolving findings", async () => {
  const result = await buildPostP64000FocusedHrmRemediationPlan(options());

  assert.equal(result.schema_version, "post-p64000-focused-hrm-remediation-plan.v1");
  assert.equal(result.program_range, "P68001-P68400");
  assert.equal(result.source_program_range, "P67601-P68000");
  assert.equal(result.next_program_range, "P68401-P68800");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_focused_hrm_remediation_plan_status, "focused_hrm_remediation_plan_ready_for_p68401");
  assert.equal(result.summary.p68000_receipt_ready_now, true);
  assert.equal(result.summary.focused_hrm_plans_ready_now, true);
  assert.equal(result.summary.verification_packets_ready_now, true);
  assert.equal(result.summary.blocking_findings_preserved_now, true);
  assert.equal(result.summary.clean_checkpoint_allowed_now, false);
  assert.equal(result.summary.finding_resolution_allowed_now, false);
  assert.equal(result.summary.focused_plan_fixed_claim_allowed_now, false);
  assert.equal(result.summary.focused_plan_verified_claim_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
  assert.equal(result.focused_hrm_plan_rows.length, 3);
  assert.ok(result.focused_hrm_plan_rows.every((row) => row.candidate_sha256 === sha256(JSON.stringify(CANDIDATES[row.finding_id]))));
});

test("invalid P68000 normalization blocks focused HRM planning", async () => {
  const normalization = {
    ...NORMALIZATION,
    validation: { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] },
  };

  const result = await buildPostP64000FocusedHrmRemediationPlan(options({ normalization }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p68000"));
});

test("missing required HRM finding blocks P68400 closeout", async () => {
  const normalizedReceipt = {
    ...NORMALIZED_RECEIPT,
    findings: HRM_FINDINGS.filter((finding) => finding.id !== "HRM-01"),
  };

  const result = await buildPostP64000FocusedHrmRemediationPlan(options({ normalizedReceipt }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.focused_hrm_plan_rows.some((row) => row.finding_id === "HRM-01" && row.current_verdict === "block"));
});

test("auto-resolved HRM finding blocks finding state preservation", async () => {
  const normalizedReceipt = {
    ...NORMALIZED_RECEIPT,
    findings: HRM_FINDINGS.map((finding) => finding.id === "HRM-04" ? { ...finding, normalized_status: "resolved" } : finding),
  };

  const result = await buildPostP64000FocusedHrmRemediationPlan(options({ normalizedReceipt }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.finding_state_preservation_rows.some((row) => row.row_id === "state.required_hrm_blocking_open" && row.current_verdict === "block"));
});

test("missing candidate artifact blocks verification packet readiness", async () => {
  const candidateSources = { ...CANDIDATES, "HRM-03": null };

  const result = await buildPostP64000FocusedHrmRemediationPlan(options({ candidateSources }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.verification_packet_rows.some((row) => row.finding_id === "HRM-03" && row.current_verdict === "block"));
});

test("fixed or verified claim blocks P68400 authority boundary", async () => {
  const result = await buildPostP64000FocusedHrmRemediationPlan(options({
    authorityOverrides: {
      focused_plan_fixed_claim_allowed_now: true,
      focused_plan_verified_claim_allowed_now: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_focused_hrm_remediation_plan_boundary.focused_plan_fixed_claim_allowed_now, true);
  assert.equal(result.post_p64000_focused_hrm_remediation_plan_boundary.focused_plan_verified_claim_allowed_now, true);
});

test("source mutation or finding resolution claim blocks P68400", async () => {
  const normalizedReceipt = {
    ...NORMALIZED_RECEIPT,
    source_mutation_performed: true,
    finding_resolution_performed: true,
  };

  const result = await buildPostP64000FocusedHrmRemediationPlan(options({ normalizedReceipt }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_focused_hrm_remediation_plan_boundary.source_mutation_from_review_allowed_now, true);
  assert.equal(result.post_p64000_focused_hrm_remediation_plan_boundary.finding_resolution_allowed_now, true);
});

test("missing negative fixture row blocks P68400 closeout", async () => {
  const result = await buildPostP64000FocusedHrmRemediationPlan(options({
    omitNegativeFixtureId: "clean_checkpoint_claim",
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.negative_fixtures"));
});

test("check mode validates without writing focused HRM planning artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-focused-hrm-remediation-plan-"));
  try {
    const result = await runPostP64000FocusedHrmRemediationPlan(options({
      check: true,
      outDir,
    }));

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "post-p64000-focused-hrm-remediation-plan.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

function candidate(schemaVersion, programRange, readyKey) {
  return {
    schema_version: schemaVersion,
    program_range: programRange,
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      [readyKey]: true,
      ready_for_handoff: true,
      clean_checkpoint_allowed_now: false,
      production_pass_enabled: false,
      enterprise_pass_enabled: false,
      final_approval_enabled: false,
    },
  };
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}
