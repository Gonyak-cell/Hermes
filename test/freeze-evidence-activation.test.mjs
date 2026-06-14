import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFreezeEvidenceActivation,
  runFreezeEvidenceActivation,
} from "../src/freeze-evidence-activation.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P16800_STRUCTURAL_READY_BLOCKED = {
  schema_version: "p16800-platform-freeze.v1",
  program_range: "P16601-P16800",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    platform_freeze_status: "blocked_p16800_platform_freeze",
    source_ready_for_p16601_handoff: true,
    source_block_visible_now: false,
    roadmap_ledger_freeze_row_count: 6,
    validation_matrix_freeze_row_count: 6,
    review_cadence_freeze_row_count: 6,
    authority_boundary_freeze_row_count: 6,
    saas_factory_handoff_freeze_row_count: 6,
    operator_evidence_projection_row_count: 6,
    closeout_packet_projection_row_count: 6,
    claude_platform_freeze_review_receipt_present_now: false,
    claude_platform_freeze_review_block_visible_now: true,
    p16800_platform_freeze_ready: false,
    ready_for_post_p16800_handoff: false,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: 0,
  },
  platform_freeze_boundary: {
    source_ready_for_p16601_handoff: true,
    source_block_visible_now: false,
    claude_platform_freeze_review_receipt_present_now: false,
    claude_platform_freeze_review_block_visible_now: true,
    ready_for_post_p16800_handoff: false,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    human_gate_bypass_allowed_now: false,
    independent_review_bypass_allowed_now: false,
    single_owner_enterprise_trust_allowed_now: false,
    environment_config_write_allowed_now: false,
    migration_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    external_service_mutation_allowed_now: false,
    secret_read_allowed_now: false,
    raw_source_exposure_allowed: false,
    reviewer_mutation_allowed_now: false,
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
  },
};

const P16800_SOURCE_BLOCKED = {
  ...P16800_STRUCTURAL_READY_BLOCKED,
  summary: {
    ...P16800_STRUCTURAL_READY_BLOCKED.summary,
    source_ready_for_p16601_handoff: false,
    source_block_visible_now: true,
  },
  platform_freeze_boundary: {
    ...P16800_STRUCTURAL_READY_BLOCKED.platform_freeze_boundary,
    source_ready_for_p16601_handoff: false,
    source_block_visible_now: true,
  },
};

const CLAUDE_REVIEW_READY = {
  schema_version: "p16800-platform-freeze-claude-review-receipt.v1",
  review_engine: "claude_code_opus_max",
  receipt_status: "complete",
  reviewed_program_range: "P16601-P16800",
  scope_p16800_platform_freeze: true,
  unresolved_finding_count: 0,
  review_packet_ref: "artifacts/p16800-platform-freeze/latest/p16800-platform-freeze.json",
  summary: {
    review_status: "complete",
    unresolved_finding_count: 0,
  },
};

const CLAUDE_REVIEW_WITH_FINDINGS = {
  ...CLAUDE_REVIEW_READY,
  unresolved_finding_count: 2,
  summary: {
    review_status: "complete",
    unresolved_finding_count: 2,
  },
};

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    p16800PlatformFreeze: P16800_STRUCTURAL_READY_BLOCKED,
    claudePlatformFreezeReviewReceipt: CLAUDE_REVIEW_READY,
    ...overrides,
  };
}

test("Freeze Evidence Activation rechecks a structurally ready blocked P16800 source with a fresh Claude receipt and opens only P17201 handoff", async () => {
  const result = await buildFreezeEvidenceActivation(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "freeze-evidence-activation.v1");
  assert.equal(result.program_range, "P16801-P17200");
  assert.equal(result.source_program_range, "P16601-P16800");
  assert.equal(result.summary.freeze_evidence_activation_status, "ready_for_freeze_evidence_activation");
  assert.equal(result.summary.source_p16800_structural_freeze_ready, true);
  assert.equal(result.summary.source_ready_for_post_p16800_handoff, false);
  assert.equal(result.summary.claude_review_receipt_present_now, true);
  assert.equal(result.summary.unresolved_finding_count, 0);
  assert.equal(result.summary.ready_for_p17201_handoff, true);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Freeze Evidence Activation covers every planned phase", async () => {
  const result = await buildFreezeEvidenceActivation(options());
  const phases = new Set(result.freeze_activation_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P16801-P16840", "P16841-P16880", "P16881-P16920", "P16921-P16960", "P16961-P17000", "P17001-P17040", "P17041-P17080", "P17081-P17120", "P17121-P17160", "P17161-P17200"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.freeze_activation_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Freeze Evidence Activation defines receipt, finding, gap, recheck, projection, authority, and closeout rows without opening protected authority", async () => {
  const result = await buildFreezeEvidenceActivation(options());

  assert.equal(result.freeze_activation_source_recheck_rows.length, 8);
  assert.equal(result.freeze_evidence_packet_rows.length, 6);
  assert.equal(result.claude_review_receipt_intake_rows.length, 6);
  assert.equal(result.finding_loop_rows.length, 6);
  assert.equal(result.evidence_gap_projection_rows.length, 6);
  assert.equal(result.post_p16800_handoff_recheck_rows.length, 6);
  assert.equal(result.activation_operator_projection_rows.length, 6);
  assert.equal(result.activation_authority_guard_rows.length, 6);
  assert.equal(result.activation_closeout_packet_rows.length, 6);

  assert.equal(result.claude_review_receipt_intake_rows.every((row) => row.claude_final_approval_allowed === false), true);
  assert.equal(result.finding_loop_rows.every((row) => row.finding_auto_close_allowed_now === false), true);
  assert.equal(result.activation_operator_projection_rows.every((row) => row.read_only_projection_required === true && row.api_write_allowed_now === false), true);
  assert.equal(result.activation_authority_guard_rows.every((row) => row.deployment_allowed_now === false && row.release_approval_allowed_now === false && row.production_pass_enabled === false && row.enterprise_pass_enabled === false && row.human_gate_bypass_allowed_now === false && row.independent_review_bypass_allowed_now === false), true);
  assert.equal(result.activation_closeout_packet_rows.every((row) => row.activation_closeout_required === true && row.protected_closeout_enabled === false && row.production_pass_enabled === false), true);
});

test("Freeze Evidence Activation preserves source BLOCK when P16800 is not structurally ready", async () => {
  const result = await buildFreezeEvidenceActivation(options({ p16800PlatformFreeze: P16800_SOURCE_BLOCKED }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.freeze_evidence_activation_status, "blocked_freeze_evidence_activation");
  assert.equal(result.summary.source_p16800_structural_freeze_ready, false);
  assert.equal(result.summary.source_block_visible_now, true);
  assert.equal(result.summary.ready_for_p17201_handoff, false);
  assert.equal(result.freeze_activation_source_recheck_rows.find((row) => row.row_id === "source.structural_freeze_ready").current_verdict, "blocked");
});

test("Freeze Evidence Activation remains valid BLOCK when Claude receipt is missing", async () => {
  const result = await buildFreezeEvidenceActivation(options({ claudePlatformFreezeReviewReceipt: null }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.claude_review_receipt_present_now, false);
  assert.equal(result.summary.claude_review_receipt_block_visible_now, true);
  assert.equal(result.summary.ready_for_p17201_handoff, false);
  assert.equal(result.claude_review_receipt_intake_rows.find((row) => row.row_id === "claude_review_receipt_intake.receipt_status").current_verdict, "blocked");
});

test("Freeze Evidence Activation blocks handoff when Claude receipt has unresolved findings", async () => {
  const result = await buildFreezeEvidenceActivation(options({ claudePlatformFreezeReviewReceipt: CLAUDE_REVIEW_WITH_FINDINGS }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.claude_review_receipt_present_now, false);
  assert.equal(result.summary.unresolved_finding_count, 2);
  assert.equal(result.summary.ready_for_p17201_handoff, false);
  assert.equal(result.finding_loop_rows.find((row) => row.row_id === "finding_loop.unresolved_finding_count").current_verdict, "blocked");
});

test("Freeze Evidence Activation fails validation if P16800 source is missing", async () => {
  const result = await buildFreezeEvidenceActivation(options({ p16800PlatformFreeze: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.freeze_evidence_activation_status, "blocked_freeze_evidence_activation");
  assert.equal(result.freeze_activation_boundary.source_p16800_available, false);
});

test("Freeze Evidence Activation boundary keeps production, enterprise, bypass, execution, connector, raw exposure, and final approval closed", async () => {
  const result = await buildFreezeEvidenceActivation(options());
  const boundary = result.freeze_activation_boundary;

  assert.equal(boundary.deployment_allowed_now, false);
  assert.equal(boundary.release_approval_allowed_now, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.enterprise_trust_claim_allowed_now, false);
  assert.equal(boundary.protected_closeout_enabled, false);
  assert.equal(boundary.human_gate_bypass_allowed_now, false);
  assert.equal(boundary.independent_review_bypass_allowed_now, false);
  assert.equal(boundary.single_owner_enterprise_trust_allowed_now, false);
  assert.equal(boundary.environment_config_write_allowed_now, false);
  assert.equal(boundary.migration_execution_allowed_now, false);
  assert.equal(boundary.rollback_execution_allowed_now, false);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.protected_action_allowed_now, false);
  assert.equal(boundary.connector_write_enabled, false);
  assert.equal(boundary.external_service_mutation_allowed_now, false);
  assert.equal(boundary.secret_read_allowed_now, false);
  assert.equal(boundary.raw_source_exposure_allowed, false);
  assert.equal(boundary.reviewer_mutation_allowed_now, false);
  assert.equal(boundary.codex_final_approval_ui_enabled, false);
  assert.equal(boundary.claude_final_approval_ui_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Freeze Evidence Activation HTML is read-only and avoids unsafe operations copy", async () => {
  const result = await buildFreezeEvidenceActivation(options());

  assert.equal(/<form|<button|type="submit"|deploy now|release now|production ready|enterprise pass|bypass review|bypass human|write config|run migration|run rollback|runtime execute|write file|protected action|final approve/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
});

test("Freeze Evidence Activation --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "freeze-evidence-activation-"));
  const sentinelPath = path.join(outDir, "freeze-evidence-activation.json");
  const sentinel = "{ \"sentinel\": \"freeze-evidence-activation\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runFreezeEvidenceActivation(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
