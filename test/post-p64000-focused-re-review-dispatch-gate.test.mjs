import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000FocusedReReviewDispatchGate,
  runPostP64000FocusedReReviewDispatchGate,
} from "../src/post-p64000-focused-re-review-dispatch-gate.mjs";

const RUN_AT = "2026-06-09T09:30:00.000Z";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const STRICT_PLAN_READY = {
  schema_version: "post-p64000-focused-strict-remediation-plan.v1",
  program_range: "P70801-P71200",
  source_program_range: "P70401-P70800",
  next_program_range: "P71201-P71600",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    post_p64000_focused_strict_remediation_plan_status: "focused_strict_remediation_plan_ready_for_p71201",
    ready_for_p71201_handoff: true,
    re_review_evidence_observed_now: false,
    clean_checkpoint_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
};

const STRICT_PLAN_ROWS = collection("strict-remediation-plan-rows.v1", "strict_remediation_plan_rows", {
  plan_status: "planned_pending_execution_and_review",
});

const DISPATCH_READINESS_ROWS = collection("re-review-dispatch-readiness-rows.v1", "re_review_dispatch_readiness_rows", {
  dispatch_status: "ready_to_dispatch_not_reviewed",
  re_review_required_now: true,
});

const EVIDENCE_REQUIREMENT_ROWS = collection("evidence-requirement-rows.v1", "evidence_requirement_rows", {
  evidence_present_now: false,
});

const STRICT_PLAN_PACKET = "# Focused Strict Remediation Plan Packet\n\nBoundary only.\n";

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
    strictPlan: STRICT_PLAN_READY,
    strictPlanRows: STRICT_PLAN_ROWS,
    dispatchReadinessRows: DISPATCH_READINESS_ROWS,
    evidenceRequirementRows: EVIDENCE_REQUIREMENT_ROWS,
    strictPlanPacket: STRICT_PLAN_PACKET,
    ...extra,
  };
}

test("P71600 prepares focused re-review dispatch gate without raw evidence claim", async () => {
  const result = await buildPostP64000FocusedReReviewDispatchGate(options());

  assert.equal(result.schema_version, "post-p64000-focused-re-review-dispatch-gate.v1");
  assert.equal(result.program_range, "P71201-P71600");
  assert.equal(result.source_program_range, "P70801-P71200");
  assert.equal(result.review_source_program_range, "P70401-P70800");
  assert.equal(result.next_program_range, "P71601-P72000");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_focused_re_review_dispatch_gate_status, "focused_re_review_dispatch_gate_ready_for_p71601");
  assert.equal(result.summary.p71200_strict_plan_ready_now, true);
  assert.equal(result.summary.focused_re_review_dispatch_packet_ready_now, true);
  assert.equal(result.summary.durable_raw_capture_gate_ready_now, true);
  assert.equal(result.summary.ready_for_p71601_handoff, true);
  assert.equal(result.summary.durable_raw_json_captured_now, false);
  assert.equal(result.summary.review_evidence_counted_now, false);
  assert.equal(result.summary.clean_checkpoint_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
  assert.ok(result.focused_re_review_dispatch_packet_rows.every((row) => row.dispatch_packet_is_review_evidence === false));
  assert.ok(result.durable_raw_capture_gate_rows.every((row) => row.durable_raw_json_captured_now === false));
});

test("invalid P71200 strict plan blocks dispatch gate", async () => {
  const strictPlan = {
    ...STRICT_PLAN_READY,
    validation: { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] },
  };

  const result = await buildPostP64000FocusedReReviewDispatchGate(options({ strictPlan }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path.includes("source.p71200_valid")));
});

test("missing required HRM dispatch row blocks dispatch packet", async () => {
  const dispatchReadinessRows = {
    ...DISPATCH_READINESS_ROWS,
    rows: DISPATCH_READINESS_ROWS.rows.filter((row) => row.finding_id !== "HRM-01"),
  };

  const result = await buildPostP64000FocusedReReviewDispatchGate(options({ dispatchReadinessRows }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path.includes("dispatch_packet.hrm_01")));
});

test("missing strict remediation packet blocks source and dispatch rows", async () => {
  const result = await buildPostP64000FocusedReReviewDispatchGate(options({ strictPlanPacket: "" }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path.includes("source.strict_plan_packet") || error.path.includes("dispatch_packet")));
});

test("dispatch packet or raw capture evidence claims block P71600", async () => {
  const result = await buildPostP64000FocusedReReviewDispatchGate(options({
    authorityOverrides: {
      dispatch_packet_counted_as_review_now: true,
      raw_capture_claimed_before_capture_now: true,
      durable_raw_json_captured_now: true,
      review_evidence_counted_now: true,
      focused_re_review_completed_now: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path.includes("dispatch_packet_counted_as_review_now")));
  assert.ok(result.validation.errors.some((error) => error.path.includes("durable_raw_json_captured_now")));
});

test("invalid Claude output modes cannot count as review evidence", async () => {
  const result = await buildPostP64000FocusedReReviewDispatchGate(options({
    authorityOverrides: {
      auth_failure_counted_as_evidence_now: true,
      timeout_or_hang_counted_as_evidence_now: true,
      malformed_output_counted_as_evidence_now: true,
      tool_call_output_counted_as_review_now: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path.includes("auth_failure_counted_as_evidence_now")));
  assert.ok(result.validation.errors.some((error) => error.path.includes("tool_call_output_counted_as_review_now")));
});

test("fixed, verified, resolved, write, clean, protected, production, enterprise, or final claims block P71600", async () => {
  const result = await buildPostP64000FocusedReReviewDispatchGate(options({
    authorityOverrides: {
      finding_status_fixed_allowed_now: true,
      finding_status_verified_allowed_now: true,
      finding_status_resolved_allowed_now: true,
      source_mutation_from_review_allowed_now: true,
      patch_apply_allowed_now: true,
      write_action_from_dispatch_allowed_now: true,
      clean_checkpoint_claim_allowed_now: true,
      protected_closeout_from_dispatch_allowed_now: true,
      post_p71600_production_pass_claim_allowed_now: true,
      post_p71600_enterprise_pass_claim_allowed_now: true,
      post_p71600_final_approval_claim_allowed_now: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path.includes("finding_status_fixed_allowed_now")));
  assert.ok(result.validation.errors.some((error) => error.path.includes("post_p71600_final_approval_claim_allowed_now")));
});

test("missing durable raw capture gate fixture blocks closeout", async () => {
  const result = await buildPostP64000FocusedReReviewDispatchGate(options({
    omitNegativeFixtureId: "missing_durable_raw_capture_gate",
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "negative.coverage"));
});

test("check mode validates without writing focused re-review dispatch artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-focused-re-review-dispatch-gate-"));
  await rm(outDir, { recursive: true, force: true });

  const result = await runPostP64000FocusedReReviewDispatchGate(options({
    outDir,
    check: true,
  }));

  assert.equal(result.validation.valid, true);
  await assert.rejects(
    readFile(path.join(outDir, "post-p64000-focused-re-review-dispatch-gate.json"), "utf8"),
    /ENOENT/,
  );
});
