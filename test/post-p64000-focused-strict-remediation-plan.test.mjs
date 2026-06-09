import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000FocusedStrictRemediationPlan,
  runPostP64000FocusedStrictRemediationPlan,
} from "../src/post-p64000-focused-strict-remediation-plan.mjs";

const RUN_AT = "2026-06-09T09:20:00.000Z";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const CANDIDATE_READY = {
  schema_version: "post-p64000-focused-remediation-closeout-candidate.v1",
  program_range: "P70401-P70800",
  source_program_range: "P70001-P70400",
  next_program_range: "P70801-P71200",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    post_p64000_focused_remediation_closeout_candidate_status: "focused_remediation_closeout_candidate_ready_for_p70801",
    ready_for_p70801_handoff: true,
    clean_checkpoint_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
};

const REMEDIATION_CANDIDATE_ROWS = {
  schema_version: "focused-remediation-candidate-rows.v1",
  collection: "focused_remediation_candidate_rows",
  rows: REQUIRED_HRM_IDS.map((findingId) => ({
    row_id: `candidate.${findingId}`,
    category: "focused_remediation_candidate",
    current_verdict: "pass",
    finding_id: findingId,
    candidate_status: "candidate_pending_review",
  })),
};

const RE_REVIEW_PLAN_ROWS = {
  schema_version: "focused-re-review-plan-rows.v1",
  collection: "focused_re_review_plan_rows",
  rows: REQUIRED_HRM_IDS.map((findingId) => ({
    row_id: `review.${findingId}`,
    category: "focused_re_review_plan",
    current_verdict: "pass",
    finding_id: findingId,
    re_review_required_now: true,
  })),
};

const CONTINUITY_ROWS = {
  schema_version: "finding-state-continuity-rows.v1",
  collection: "finding_state_continuity_rows",
  rows: REQUIRED_HRM_IDS.map((findingId) => ({
    row_id: `continuity.${findingId}`,
    category: "finding_state_continuity",
    current_verdict: "pass",
    finding_id: findingId,
    output_state: "blocking_open",
  })),
};

const RE_REVIEW_PACKET = "# Focused Re-Review Packet\n\nBoundary only.\n";

function options(extra = {}) {
  return {
    runAt: RUN_AT,
    candidate: CANDIDATE_READY,
    remediationCandidateRows: REMEDIATION_CANDIDATE_ROWS,
    reReviewPlanRows: RE_REVIEW_PLAN_ROWS,
    continuityRows: CONTINUITY_ROWS,
    reReviewPacket: RE_REVIEW_PACKET,
    ...extra,
  };
}

test("P71200 prepares strict remediation plan and dispatch readiness without evidence claim", async () => {
  const result = await buildPostP64000FocusedStrictRemediationPlan(options());

  assert.equal(result.schema_version, "post-p64000-focused-strict-remediation-plan.v1");
  assert.equal(result.program_range, "P70801-P71200");
  assert.equal(result.source_program_range, "P70401-P70800");
  assert.equal(result.review_source_program_range, "P70001-P70400");
  assert.equal(result.next_program_range, "P71201-P71600");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_focused_strict_remediation_plan_status, "focused_strict_remediation_plan_ready_for_p71201");
  assert.equal(result.summary.p70800_candidate_ready_now, true);
  assert.equal(result.summary.strict_remediation_plans_ready_now, true);
  assert.equal(result.summary.re_review_dispatch_ready_now, true);
  assert.equal(result.summary.evidence_requirements_ready_now, true);
  assert.equal(result.summary.blocking_findings_preserved_now, true);
  assert.equal(result.summary.ready_for_p71201_handoff, true);
  assert.equal(result.summary.re_review_evidence_observed_now, false);
  assert.equal(result.summary.clean_checkpoint_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
  assert.ok(result.strict_remediation_plan_rows.every((row) => row.patch_apply_now === false && row.write_action_now === false));
});

test("invalid P70800 candidate source blocks strict plan", async () => {
  const candidate = {
    ...CANDIDATE_READY,
    validation: { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] },
  };

  const result = await buildPostP64000FocusedStrictRemediationPlan(options({ candidate }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path.includes("source.p70800_valid")));
});

test("missing HRM candidate row blocks strict remediation plan", async () => {
  const remediationCandidateRows = {
    ...REMEDIATION_CANDIDATE_ROWS,
    rows: REMEDIATION_CANDIDATE_ROWS.rows.filter((row) => row.finding_id !== "HRM-01"),
  };

  const result = await buildPostP64000FocusedStrictRemediationPlan(options({ remediationCandidateRows }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path.includes("strict_plan.hrm_01")));
});

test("missing re-review packet blocks dispatch readiness", async () => {
  const result = await buildPostP64000FocusedStrictRemediationPlan(options({ reReviewPacket: "" }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path.includes("source.re_review_packet") || error.path.includes("dispatch_readiness")));
});

test("patch, write, source mutation, or re-review evidence claims block P71200", async () => {
  const result = await buildPostP64000FocusedStrictRemediationPlan(options({
    authorityOverrides: {
      strict_plan_patch_apply_allowed_now: true,
      strict_plan_write_action_allowed_now: true,
      strict_plan_source_mutation_allowed_now: true,
      strict_plan_re_review_evidence_observed_now: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path.includes("strict_plan_patch_apply_allowed_now")));
  assert.ok(result.validation.errors.some((error) => error.path.includes("strict_plan_re_review_evidence_observed_now")));
});

test("fixed, verified, resolved, clean, final, production, or enterprise claims block P71200", async () => {
  const result = await buildPostP64000FocusedStrictRemediationPlan(options({
    authorityOverrides: {
      strict_plan_fixed_claim_allowed_now: true,
      strict_plan_verified_claim_allowed_now: true,
      strict_plan_resolved_claim_allowed_now: true,
      clean_checkpoint_claim_allowed_now: true,
      post_p71200_final_approval_claim_allowed_now: true,
      post_p71200_production_pass_claim_allowed_now: true,
      post_p71200_enterprise_pass_claim_allowed_now: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path.includes("strict_plan_fixed_claim_allowed_now")));
  assert.ok(result.validation.errors.some((error) => error.path.includes("post_p71200_final_approval_claim_allowed_now")));
});

test("missing evidence requirement fixture blocks closeout", async () => {
  const result = await buildPostP64000FocusedStrictRemediationPlan(options({
    omitNegativeFixtureId: "missing_evidence_requirement",
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "negative.coverage"));
});

test("check mode validates without writing strict remediation artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-focused-strict-remediation-plan-"));
  await rm(outDir, { recursive: true, force: true });

  const result = await runPostP64000FocusedStrictRemediationPlan(options({
    outDir,
    check: true,
  }));

  assert.equal(result.validation.valid, true);
  await assert.rejects(
    readFile(path.join(outDir, "post-p64000-focused-strict-remediation-plan.json"), "utf8"),
    /ENOENT/,
  );
});
