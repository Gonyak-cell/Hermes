import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildHumanOwnerAdjudicationOption,
  runHumanOwnerAdjudicationOption,
} from "../src/human-owner-adjudication-option.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P12600_READY = {
  schema_version: "patch-candidate-lane.v1",
  program_range: "P12401-P12600",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    patch_candidate_lane_status: "ready_for_patch_candidate_lane",
    ready_for_p12601_handoff: true,
    patch_candidate_row_count: 6,
    diff_packet_row_count: 6,
    claude_patch_review_receipt_present_now: true,
    patch_generated_now: false,
    patch_applied_now: false,
    direct_apply_allowed_now: false,
    write_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
  patch_candidate_boundary: {
    ready_for_p12601_handoff: true,
    patch_generated_now: false,
    patch_applied_now: false,
    direct_apply_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
};

const P12600_BLOCKED = {
  schema_version: "patch-candidate-lane.v1",
  program_range: "P12401-P12600",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    patch_candidate_lane_status: "blocked_patch_candidate_lane",
    ready_for_p12601_handoff: false,
    patch_candidate_row_count: 6,
    diff_packet_row_count: 6,
    claude_patch_review_receipt_present_now: false,
    patch_generated_now: false,
    patch_applied_now: false,
    direct_apply_allowed_now: false,
    write_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
  patch_candidate_boundary: {
    ready_for_p12601_handoff: false,
    patch_generated_now: false,
    patch_applied_now: false,
    direct_apply_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
};

const OWNER_ADJUDICATION_READY = {
  schema_version: "owner-adjudication-receipt.v1",
  receipt_status: "observed",
  owner_adjudication_receipt_present_now: true,
  scope_human_owner_adjudication_option: true,
  adjudicator_id: "owner.primary",
  adjudicator_role: "human_owner",
  raw_payload_inlined: false,
  final_authority_allowed_now: false,
  enterprise_trust_claim_allowed_now: false,
  decisions: [
    { finding_id: "F-001", decision: "ACCEPT_WITH_MODIFICATION", evidence_refs: ["evidence.patch.diff_packet"] },
  ],
  summary: {
    receipt_status: "observed",
    reviewed_finding_count: 1,
  },
};

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    patchCandidateLane: P12600_READY,
    ownerAdjudicationReceipt: OWNER_ADJUDICATION_READY,
    ...overrides,
  };
}

test("Human/Owner Adjudication Option builds owner receipt, closeout, review separation, queue, finding, and authority contracts through P12800", async () => {
  const result = await buildHumanOwnerAdjudicationOption(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "human-owner-adjudication-option.v1");
  assert.equal(result.program_range, "P12601-P12800");
  assert.equal(result.source_program_range, "P12401-P12600");
  assert.equal(result.summary.human_owner_adjudication_option_status, "ready_for_human_owner_adjudication_option");
  assert.equal(result.summary.owner_adjudication_receipt_row_count, 7);
  assert.equal(result.summary.independent_review_separation_row_count, 6);
  assert.equal(result.summary.owner_adjudication_receipt_present_now, true);
  assert.equal(result.summary.ready_for_p12801_handoff, true);
  assert.equal(result.summary.enterprise_trust_claim_allowed_now, false);
  assert.equal(result.summary.owner_receipt_auto_final_approval_enabled, false);
});

test("Human/Owner Adjudication Option covers every planned phase", async () => {
  const result = await buildHumanOwnerAdjudicationOption(options());
  const phases = new Set(result.human_owner_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P12601-P12620", "P12621-P12640", "P12641-P12660", "P12661-P12680", "P12681-P12700", "P12701-P12720", "P12721-P12740", "P12741-P12760", "P12761-P12780", "P12781-P12800"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.human_owner_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Human/Owner Adjudication Option defines source, receipt, closeout, review, trust, queue, finding, projection, and authority rows", async () => {
  const result = await buildHumanOwnerAdjudicationOption(options());

  assert.equal(result.adjudication_source_binding_rows.length, 8);
  assert.equal(result.owner_adjudication_receipt_rows.length, 7);
  assert.equal(result.protected_closeout_mapping_rows.length, 6);
  assert.equal(result.independent_review_separation_rows.length, 6);
  assert.equal(result.single_owner_trust_downgrade_rows.length, 5);
  assert.equal(result.adjudication_queue_rows.length, 6);
  assert.equal(result.finding_disposition_rows.length, 6);
  assert.equal(result.adjudication_operator_projection_rows.length, 6);
  assert.equal(result.adjudication_authority_guard_rows.length, 6);

  assert.equal(result.independent_review_separation_rows.every((row) => row.owner_adjudication_as_enterprise_review_allowed === false && row.owner_receipt_creates_github_approval === false), true);
  assert.equal(result.single_owner_trust_downgrade_rows.every((row) => row.single_owner_lower_trust_mode === true && row.single_owner_enterprise_trust_allowed === false), true);
  assert.equal(result.adjudication_operator_projection_rows.every((row) => row.mutation_method_allowed_now === false && row.final_approval_ui_enabled === false), true);
  assert.equal(result.adjudication_authority_guard_rows.every((row) => row.production_pass_enabled === false && row.enterprise_pass_enabled === false), true);
});

test("Human/Owner Adjudication Option preserves blocked P12600 source without opening P12801 handoff", async () => {
  const result = await buildHumanOwnerAdjudicationOption(options({ patchCandidateLane: P12600_BLOCKED, ownerAdjudicationReceipt: null }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.human_owner_adjudication_option_status, "blocked_human_owner_adjudication_option");
  assert.equal(result.summary.source_ready_for_p12601_handoff, false);
  assert.equal(result.summary.source_block_visible_now, true);
  assert.equal(result.summary.owner_adjudication_receipt_present_now, false);
  assert.equal(result.summary.owner_adjudication_block_visible_now, true);
  assert.equal(result.summary.ready_for_p12801_handoff, false);
  assert.equal(result.adjudication_source_binding_rows.find((row) => row.row_id === "source.handoff").current_verdict, "blocked");
  assert.equal(result.p12800_freeze_rows.find((row) => row.row_id === "freeze.source").current_verdict, "blocked");
  assert.equal(result.p12800_freeze_rows.find((row) => row.row_id === "freeze.owner_receipt").current_verdict, "blocked");
});

test("Human/Owner Adjudication Option keeps ready source blocked when owner receipt is missing", async () => {
  const result = await buildHumanOwnerAdjudicationOption(options({ ownerAdjudicationReceipt: null }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.human_owner_adjudication_option_status, "blocked_human_owner_adjudication_option");
  assert.equal(result.summary.source_ready_for_p12601_handoff, true);
  assert.equal(result.summary.owner_adjudication_receipt_present_now, false);
  assert.equal(result.summary.owner_adjudication_block_visible_now, true);
  assert.equal(result.summary.ready_for_p12801_handoff, false);
});

test("Human/Owner Adjudication Option fails validation if P12600 source is missing", async () => {
  const result = await buildHumanOwnerAdjudicationOption(options({ patchCandidateLane: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.human_owner_adjudication_option_status, "blocked_human_owner_adjudication_option");
  assert.equal(result.human_owner_adjudication_boundary.source_patch_candidate_lane_available, false);
});

test("Human/Owner Adjudication Option boundary keeps owner, single-owner, write, and trust boundaries honest", async () => {
  const result = await buildHumanOwnerAdjudicationOption(options());
  const boundary = result.human_owner_adjudication_boundary;

  assert.equal(boundary.owner_adjudication_receipt_present_now, true);
  assert.equal(boundary.owner_adjudication_as_enterprise_review_allowed, false);
  assert.equal(boundary.owner_receipt_creates_github_approval, false);
  assert.equal(boundary.owner_receipt_auto_final_approval_enabled, false);
  assert.equal(boundary.single_owner_lower_trust_mode, true);
  assert.equal(boundary.single_owner_enterprise_trust_allowed, false);
  assert.equal(boundary.independent_github_review_completed_now, false);
  assert.equal(boundary.enterprise_trust_claim_allowed_now, false);
  assert.equal(boundary.patch_generated_now, false);
  assert.equal(boundary.patch_applied_now, false);
  assert.equal(boundary.direct_apply_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.protected_action_allowed_now, false);
  assert.equal(boundary.connector_write_enabled, false);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.secret_read_allowed_now, false);
  assert.equal(boundary.raw_body_exposure_allowed, false);
  assert.equal(boundary.codex_final_approval_ui_enabled, false);
  assert.equal(boundary.claude_final_approval_ui_enabled, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Human/Owner Adjudication Option HTML is read-only and avoids unsafe approval copy", async () => {
  const result = await buildHumanOwnerAdjudicationOption(options());

  assert.equal(/<form|<button|type="submit"|approve now|final approve|apply now|merge now|deploy now/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
  assert.equal(/production ready|enterprise pass|release approved|ai approved|claude approved|codex approved/i.test(result.html), false);
});

test("Human/Owner Adjudication Option --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "human-owner-adjudication-option-"));
  const sentinelPath = path.join(outDir, "human-owner-adjudication-option.json");
  const sentinel = "{ \"sentinel\": \"human-owner-adjudication-option\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runHumanOwnerAdjudicationOption(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
