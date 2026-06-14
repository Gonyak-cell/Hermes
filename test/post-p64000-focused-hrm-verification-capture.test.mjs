import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPostP64000FocusedHrmVerificationCapture,
  runPostP64000FocusedHrmVerificationCapture,
} from "../src/post-p64000-focused-hrm-verification-capture.mjs";

const RUN_AT = "2026-06-09T08:55:00.000Z";
const REQUIRED_HRM_IDS = ["HRM-04", "HRM-03", "HRM-01"];

const CANDIDATES = {
  "HRM-04": candidate("post-p64000-hrm04-review-event-boundary.v1", "P65601-P66000"),
  "HRM-03": candidate("post-p64000-hrm03-review-window-cap.v1", "P66001-P66400"),
  "HRM-01": candidate("post-p64000-hrm01-review-depth-cap.v1", "P66401-P66800"),
};

const VERIFICATION_PACKET_ROWS = REQUIRED_HRM_IDS.map((findingId) => ({
  row_id: `verification_packet.${findingId.toLowerCase()}`,
  category: "verification_packet",
  label: `${findingId} verification packet row is ready`,
  observed: true,
  current_verdict: "pass",
  evidence_ref: `inline.${findingId}`,
  block_reason: null,
  next_allowed_action: "capture_focused_verification_evidence_without_patch_apply",
  generated_at: RUN_AT,
  finding_id: findingId,
  candidate_source_ref: `inline.${findingId}`,
  candidate_sha256: sha256(JSON.stringify(CANDIDATES[findingId])),
  expected_future_verdicts: ["fixed", "partially_fixed", "not_fixed", "false_positive", "needs_human_override"],
  source_mutation_allowed_now: false,
  finding_resolution_allowed_now: false,
}));

const FOCUSED_PLAN_ROWS = REQUIRED_HRM_IDS.map((findingId) => ({
  row_id: `plan.${findingId.toLowerCase()}`,
  category: "focused_hrm_plan",
  observed: true,
  current_verdict: "pass",
  finding_id: findingId,
  candidate_sha256: sha256(JSON.stringify(CANDIDATES[findingId])),
}));

const P68400_PLAN = {
  schema_version: "post-p64000-focused-hrm-remediation-plan.v1",
  program_range: "P68001-P68400",
  source_program_range: "P67601-P68000",
  next_program_range: "P68401-P68800",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    ready_for_p68401_handoff: true,
    focused_hrm_plans_ready_now: true,
    verification_packets_ready_now: true,
    blocking_findings_preserved_now: true,
    blocking_finding_count: 3,
    finding_count: 5,
    clean_checkpoint_allowed_now: false,
    finding_resolution_allowed_now: false,
    focused_plan_fixed_claim_allowed_now: false,
    focused_plan_verified_claim_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    final_approval_enabled: false,
  },
  verification_packet_rows: VERIFICATION_PACKET_ROWS,
  focused_hrm_plan_rows: FOCUSED_PLAN_ROWS,
};

const PACKET_TEXT = [
  "# Post-P64000 Focused HRM Verification Packet",
  "",
  "Verify HRM-04, HRM-03, and HRM-01 remediation candidates in focused read-only passes.",
].join("\n");

function options(extra = {}) {
  return {
    runAt: RUN_AT,
    p68400Plan: P68400_PLAN,
    packetText: PACKET_TEXT,
    verificationRows: { rows: VERIFICATION_PACKET_ROWS },
    focusedPlanRows: { rows: FOCUSED_PLAN_ROWS },
    candidateSources: CANDIDATES,
    ...extra,
  };
}

test("P68800 captures focused HRM verification evidence without completing review or resolving findings", async () => {
  const result = await buildPostP64000FocusedHrmVerificationCapture(options());

  assert.equal(result.schema_version, "post-p64000-focused-hrm-verification-capture.v1");
  assert.equal(result.program_range, "P68401-P68800");
  assert.equal(result.source_program_range, "P68001-P68400");
  assert.equal(result.next_program_range, "P68801-P69200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.post_p64000_focused_hrm_verification_capture_status, "focused_hrm_verification_capture_ready_for_p68801");
  assert.equal(result.summary.p68400_source_ready_now, true);
  assert.equal(result.summary.focused_verification_evidence_ready_now, true);
  assert.equal(result.summary.candidate_digests_match_now, true);
  assert.equal(result.summary.focused_verification_review_event_completed_now, false);
  assert.equal(result.summary.findings_remain_open_now, true);
  assert.equal(result.summary.clean_checkpoint_allowed_now, false);
  assert.equal(result.summary.finding_resolution_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.summary.enterprise_pass_enabled, false);
  assert.equal(result.summary.final_approval_enabled, false);
  assert.equal(result.focused_verification_evidence_rows.length, 3);
  assert.ok(result.focused_verification_evidence_rows.every((row) => row.review_performed_now === false));
});

test("P68400 source that is not ready blocks focused verification capture", async () => {
  const p68400Plan = {
    ...P68400_PLAN,
    summary: { ...P68400_PLAN.summary, ready_for_p68401_handoff: false },
  };

  const result = await buildPostP64000FocusedHrmVerificationCapture(options({ p68400Plan }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "source.p68400"));
});

test("missing focused verification packet blocks source binding", async () => {
  const result = await buildPostP64000FocusedHrmVerificationCapture(options({ packetText: "" }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.p68400_source_binding_rows.some((row) => row.row_id === "source.packet_available" && row.current_verdict === "block"));
});

test("candidate digest mismatch blocks P68800 closeout", async () => {
  const candidateSources = {
    ...CANDIDATES,
    "HRM-03": { ...CANDIDATES["HRM-03"], extra: "changed" },
  };

  const result = await buildPostP64000FocusedHrmVerificationCapture(options({ candidateSources }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.candidate_digest_match_rows.some((row) => row.finding_id === "HRM-03" && row.current_verdict === "block"));
});

test("missing candidate artifact blocks focused evidence readiness", async () => {
  const candidateSources = { ...CANDIDATES, "HRM-04": null };

  const result = await buildPostP64000FocusedHrmVerificationCapture(options({ candidateSources }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.focused_verification_evidence_rows.some((row) => row.finding_id === "HRM-04" && row.current_verdict === "block"));
});

test("candidate validation invalid blocks focused evidence readiness", async () => {
  const candidateSources = {
    ...CANDIDATES,
    "HRM-01": {
      ...CANDIDATES["HRM-01"],
      validation: { valid: false, error_count: 1, errors: [{ path: "fixture", message: "invalid" }] },
    },
  };

  const result = await buildPostP64000FocusedHrmVerificationCapture(options({ candidateSources }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.focused_verification_evidence_rows.some((row) => row.finding_id === "HRM-01" && row.current_verdict === "block"));
});

test("fixed, verified, or review-completed claim blocks authority boundary", async () => {
  const result = await buildPostP64000FocusedHrmVerificationCapture(options({
    authorityOverrides: {
      focused_verification_review_event_completed_now: true,
      focused_verification_fixed_claim_allowed_now: true,
      focused_verification_verified_claim_allowed_now: true,
    },
  }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_focused_hrm_verification_capture_boundary.focused_verification_review_event_completed_now, true);
  assert.equal(result.post_p64000_focused_hrm_verification_capture_boundary.focused_verification_fixed_claim_allowed_now, true);
  assert.equal(result.post_p64000_focused_hrm_verification_capture_boundary.focused_verification_verified_claim_allowed_now, true);
});

test("source mutation or finding resolution claim blocks P68800", async () => {
  const p68400Plan = {
    ...P68400_PLAN,
    summary: {
      ...P68400_PLAN.summary,
      source_mutation_from_review_allowed_now: true,
      finding_resolution_allowed_now: true,
    },
  };

  const result = await buildPostP64000FocusedHrmVerificationCapture(options({ p68400Plan }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.post_p64000_focused_hrm_verification_capture_boundary.source_mutation_from_review_allowed_now, true);
  assert.equal(result.post_p64000_focused_hrm_verification_capture_boundary.finding_resolution_allowed_now, true);
});

test("missing negative fixture row blocks P68800 closeout", async () => {
  const result = await buildPostP64000FocusedHrmVerificationCapture(options({
    omitNegativeFixtureId: "candidate_digest_mismatch",
  }));

  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((error) => error.path === "rows.negative_fixtures"));
});

test("check mode validates without writing focused verification capture artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "post-p64000-focused-hrm-verification-capture-"));
  try {
    const result = await runPostP64000FocusedHrmVerificationCapture(options({
      check: true,
      outDir,
    }));

    assert.equal(result.validation.valid, true);
    await assert.rejects(
      readFile(path.join(outDir, "post-p64000-focused-hrm-verification-capture.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

function candidate(schemaVersion, programRange) {
  return {
    schema_version: schemaVersion,
    program_range: programRange,
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
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
