import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000FocusedRemediationCloseoutCandidate,
  runPostP64000FocusedRemediationCloseoutCandidate,
} from "../src/post-p64000-focused-remediation-closeout-candidate.mjs";

const RUN_AT = "2026-06-09T09:10:00.000Z";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const FINDINGS = REQUIRED_HRM_IDS.map((findingId) => ({
  id: findingId,
  severity: "high",
  category: "focused_review_followup",
  location: "artifacts/post-p64000-focused-hrm-verification-normalization/latest/normalized-recommendation-packet.md",
  evidence: `${findingId} remains blocking_open with focused review follow-up required.`,
  issue: `${findingId} requires remediation closeout candidate or re-review planning.`,
  proposed_change: "plan_remediation_closeout_candidate_or_re_review_before_clean_checkpoint",
  blocks_clean_checkpoint: true,
  normalized_status: "blocking_open",
  next_allowed_action: "plan_remediation_closeout_candidate_or_re_review_before_clean_checkpoint",
}));

const NORMALIZATION_READY = {
  schema_version: "post-p64000-focused-claude-review-receipt-normalization.v1",
  program_range: "P70001-P70400",
  source_program_range: "P69601-P70000",
  review_event_program_range: "P69601-P70000",
  reviewed_program_range: "P68801-P69200",
  next_program_range: "P70401-P70800",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    post_p64000_focused_claude_review_receipt_normalization_status: "focused_receipt_normalized_findings_ready_for_p70401",
    ready_for_p70401_handoff: true,
    blocks_clean_checkpoint: true,
    blocking_finding_count: 3,
    finding_count: 3,
    clean_checkpoint_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
};

const NORMALIZED_RECEIPT = {
  schema_version: "post-p64000-focused-claude-review-receipt.v1",
  receipt_status: "observed_blocking_findings",
  reviewer: "claude-code-opus-max",
  reviewer_lane: "independent_read_only",
  source_program_range: "P69601-P70000",
  reviewed_program_range: "P68801-P69200",
  review_event_program_range: "P69601-P70000",
  overall_verdict: "needs_changes",
  blocks_clean_checkpoint: true,
  clean_checkpoint_allowed: false,
  open_blocking_finding_count: 3,
  normalized_blocking_finding_count: 3,
  finding_count: 3,
  reviewed_hrm_ids: REQUIRED_HRM_IDS,
  findings: FINDINGS,
};

const ACTION_ROWS = collection("focused-finding-action-rows.v1", "focused_finding_action_rows");
const LOOP_ROWS = collection("focused-finding-loop-rows.v1", "focused_finding_loop_rows");
const CLASSIFICATION_ROWS = collection("focused-finding-classification-rows.v1", "focused_finding_classification_rows");

function collection(schemaVersion, name) {
  return {
    schema_version: schemaVersion,
    collection: name,
    rows: REQUIRED_HRM_IDS.map((findingId) => ({
      row_id: `${name}.${findingId}`,
      current_verdict: "pass",
      finding_id: findingId,
    })),
  };
}

function options(extra = {}) {
  return {
    runAt: RUN_AT,
    normalization: NORMALIZATION_READY,
    normalizedReceipt: NORMALIZED_RECEIPT,
    findingActionRows: ACTION_ROWS,
    findingLoopRows: LOOP_ROWS,
    findingClassificationRows: CLASSIFICATION_ROWS,
    ...extra,
  };
}

test("P70800 creates remediation candidates and re-review plan without closing findings", async () => {
  const result = await buildPostP64000FocusedRemediationCloseoutCandidate(options());

  assert.equal(result.schema_version, "post-p64000-focused-remediation-closeout-candidate.v1");
  assert.equal(result.program_range, "P70401-P70800");
  assert.equal(result.source_program_range, "P70001-P70400");
  assert.equal(result.review_event_program_range, "P69601-P70000");
  assert.equal(result.reviewed_program_range, "P68801-P69200");
  assert.equal(result.next_program_range, "P70801-P71200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_focused_remediation_closeout_candidate_status, "focused_remediation_closeout_candidate_ready_for_p70801");
  assert.equal(result.summary.p70400_normalization_ready_now, true);
  assert.equal(result.summary.remediation_candidates_ready_now, true);
  assert.equal(result.summary.re_review_plan_ready_now, true);
  assert.equal(result.summary.blocking_findings_preserved_now, true);
  assert.equal(result.summary.ready_for_p70801_handoff, true);
  assert.equal(result.summary.blocking_finding_count, 3);
  assert.equal(result.summary.clean_checkpoint_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
  assert.ok(result.focused_remediation_candidate_rows.every((row) => row.candidate_status === "candidate_pending_review"));
  assert.ok(result.focused_re_review_plan_rows.every((row) => row.reviewer_completion_observed_now === false));
});

test("invalid P70400 normalization source blocks P70800 candidate", async () => {
  const normalization = {
    ...NORMALIZATION_READY,
    validation: { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] },
  };

  const result = await buildPostP64000FocusedRemediationCloseoutCandidate(options({ normalization }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path.includes("source.source.p70400_valid")));
});

test("missing required HRM blocking finding blocks candidate closeout", async () => {
  const normalizedReceipt = {
    ...NORMALIZED_RECEIPT,
    findings: FINDINGS.filter((finding) => finding.id !== "HRM-01"),
  };

  const result = await buildPostP64000FocusedRemediationCloseoutCandidate(options({ normalizedReceipt }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path.includes("required_hrm_findings") || error.path.includes("remediation_candidate.hrm_01")));
});

test("hidden blocking finding blocks state continuity", async () => {
  const normalizedReceipt = {
    ...NORMALIZED_RECEIPT,
    findings: FINDINGS.map((finding) => finding.id === "HRM-03" ? { ...finding, blocks_clean_checkpoint: false } : finding),
  };

  const result = await buildPostP64000FocusedRemediationCloseoutCandidate(options({ normalizedReceipt }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path.includes("hrm_03")));
});

test("fixed, verified, resolved, reviewer completion, or write claims block authority", async () => {
  const result = await buildPostP64000FocusedRemediationCloseoutCandidate(options({
    authorityOverrides: {
      remediation_candidate_fixed_claim_allowed_now: true,
      remediation_candidate_verified_claim_allowed_now: true,
      remediation_candidate_resolved_claim_allowed_now: true,
      re_review_completion_claim_allowed_now: true,
      write_action_from_candidate_allowed_now: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path.includes("remediation_candidate_fixed_claim_allowed_now")));
  assert.ok(result.validation.errors.some((error) => error.path.includes("re_review_completion_claim_allowed_now")));
  assert.ok(result.validation.errors.some((error) => error.path.includes("write_action_from_candidate_allowed_now")));
});

test("clean, production, enterprise, final, reviewer mutation, or source mutation claims block P70800", async () => {
  const result = await buildPostP64000FocusedRemediationCloseoutCandidate(options({
    authorityOverrides: {
      clean_checkpoint_claim_allowed_now: true,
      post_p70800_production_pass_claim_allowed_now: true,
      post_p70800_enterprise_pass_claim_allowed_now: true,
      post_p70800_final_approval_claim_allowed_now: true,
      reviewer_mutation_allowed_now: true,
      source_mutation_from_candidate_allowed_now: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path.includes("clean_checkpoint_claim_allowed_now")));
  assert.ok(result.validation.errors.some((error) => error.path.includes("post_p70800_final_approval_claim_allowed_now")));
});

test("missing per-finding next action blocks remediation candidate", async () => {
  const normalizedReceipt = {
    ...NORMALIZED_RECEIPT,
    findings: FINDINGS.map((finding) => finding.id === "HRM-04" ? { ...finding, next_allowed_action: "" } : finding),
  };

  const result = await buildPostP64000FocusedRemediationCloseoutCandidate(options({ normalizedReceipt }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path.includes("remediation_candidate.hrm_04")));
});

test("missing negative fixture row blocks P70800 closeout", async () => {
  const result = await buildPostP64000FocusedRemediationCloseoutCandidate(options({
    omitNegativeFixtureId: "candidate_claims_write_action",
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "negative.coverage"));
});

test("check mode validates without writing focused remediation artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-focused-remediation-closeout-candidate-"));
  await rm(outDir, { recursive: true, force: true });

  const result = await runPostP64000FocusedRemediationCloseoutCandidate(options({
    outDir,
    check: true,
  }));

  assert.equal(result.validation.valid, true);
  await assert.rejects(
    readFile(path.join(outDir, "post-p64000-focused-remediation-closeout-candidate.json"), "utf8"),
    /ENOENT/,
  );
});
