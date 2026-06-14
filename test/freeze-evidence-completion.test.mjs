import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildFreezeEvidenceCompletion,
  runFreezeEvidenceCompletion,
} from "../src/freeze-evidence-completion.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const CLOSED_BOUNDARY = {
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
};

const P17200_READY = {
  schema_version: "freeze-evidence-activation.v1",
  program_range: "P16801-P17200",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    freeze_evidence_activation_status: "ready_for_freeze_evidence_activation",
    ready_for_p17201_handoff: true,
    source_block_visible_now: false,
    claude_review_receipt_block_visible_now: false,
    unresolved_finding_count: 0,
    freeze_evidence_packet_row_count: 6,
    claude_review_receipt_intake_row_count: 6,
    finding_loop_row_count: 6,
    evidence_gap_projection_row_count: 6,
    post_p16800_handoff_recheck_row_count: 6,
    activation_operator_projection_row_count: 6,
    activation_authority_guard_row_count: 6,
    activation_closeout_packet_row_count: 6,
  },
  freeze_activation_boundary: CLOSED_BOUNDARY,
};

const P17200_BLOCKED = {
  ...P17200_READY,
  summary: {
    ...P17200_READY.summary,
    freeze_evidence_activation_status: "blocked_freeze_evidence_activation",
    ready_for_p17201_handoff: false,
    source_block_visible_now: true,
  },
};

const P17200_PRESENT_INVALID = {
  ...P17200_READY,
  validation: { valid: false, error_count: 1, errors: [{ item_id: "source.invalid", message: "invalid source" }] },
};

const CLAUDE_COMPLETION_REVIEW_READY = {
  schema_version: "freeze-evidence-completion-claude-review-receipt.v1",
  review_engine: "claude_code_opus_max",
  model_effort: "max",
  receipt_status: "complete",
  reviewed_program_range: "P17201-P17600",
  reviewed_source_program_range: "P16801-P17200",
  scope_freeze_evidence_completion: true,
  review_packet_ref: "artifacts/freeze-evidence-completion/review/review-packet.json",
  verdict: "PASS",
  unresolved_finding_count: 0,
  blocking_finding_count: 0,
  summary: {
    review_status: "complete",
    unresolved_finding_count: 0,
    blocking_finding_count: 0,
  },
};

const CLAUDE_COMPLETION_REVIEW_MALFORMED = {
  ...CLAUDE_COMPLETION_REVIEW_READY,
  review_engine: "unknown_review_engine",
};

const CLAUDE_COMPLETION_REVIEW_WITH_FINDINGS = {
  ...CLAUDE_COMPLETION_REVIEW_READY,
  verdict: "PASS_WITH_FINDINGS",
  unresolved_finding_count: 1,
  blocking_finding_count: 1,
  summary: {
    review_status: "complete",
    unresolved_finding_count: 1,
    blocking_finding_count: 1,
  },
};

const REVALIDATION_READY = {
  schema_version: "freeze-evidence-completion-revalidation-receipt.v1",
  receipt_status: "complete",
  validation_status: "pass",
  program_range: "P17201-P17600",
  source_program_range: "P16801-P17200",
  stale_validation: false,
  commands_run: [
    "npm run platform:p16800-platform-freeze -- --check",
    "npm run platform:freeze-evidence-activation -- --check",
    "npm run platform:freeze-evidence-completion -- --check",
    "node --test test/p16800-platform-freeze.test.mjs test/freeze-evidence-activation.test.mjs test/freeze-evidence-completion.test.mjs",
    "git diff --check",
  ],
  summary: {
    validation_status: "pass",
  },
};

const REVALIDATION_FAILED = {
  ...REVALIDATION_READY,
  validation_status: "fail",
  summary: {
    validation_status: "fail",
  },
};

const REVALIDATION_STALE = {
  ...REVALIDATION_READY,
  stale_validation: true,
};

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    freezeEvidenceActivation: P17200_READY,
    claudeCompletionReviewReceipt: CLAUDE_COMPLETION_REVIEW_READY,
    revalidationReceipt: REVALIDATION_READY,
    ...overrides,
  };
}

test("Freeze Evidence Completion opens only P17601 handoff when P17200 source, Claude receipt, finding loop, and revalidation are ready", async () => {
  const result = await buildFreezeEvidenceCompletion(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "freeze-evidence-completion.v1");
  assert.equal(result.program_range, "P17201-P17600");
  assert.equal(result.source_program_range, "P16801-P17200");
  assert.equal(result.summary.freeze_evidence_completion_status, "ready_for_freeze_evidence_completion");
  assert.equal(result.summary.source_p17200_ready_for_p17201_handoff, true);
  assert.equal(result.summary.claude_completion_review_receipt_present_now, true);
  assert.equal(result.summary.revalidation_receipt_present_now, true);
  assert.equal(result.summary.unresolved_finding_count, 0);
  assert.equal(result.summary.blocking_finding_count, 0);
  assert.equal(result.summary.ready_for_p17601_handoff, true);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Freeze Evidence Completion covers every planned phase", async () => {
  const result = await buildFreezeEvidenceCompletion(options());
  const phases = new Set(result.freeze_completion_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P17201-P17240", "P17241-P17280", "P17281-P17320", "P17321-P17360", "P17361-P17400", "P17401-P17440", "P17441-P17480", "P17481-P17520", "P17521-P17560", "P17561-P17600"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.freeze_completion_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Freeze Evidence Completion defines all completion rows without opening protected authority", async () => {
  const result = await buildFreezeEvidenceCompletion(options());

  assert.equal(result.freeze_completion_inventory_rows.length, 6);
  assert.equal(result.claude_review_execution_rows.length, 6);
  assert.equal(result.completion_review_receipt_rows.length, 6);
  assert.equal(result.finding_remediation_rows.length, 6);
  assert.equal(result.revalidation_evidence_rows.length, 6);
  assert.equal(result.p17601_handoff_gate_rows.length, 6);
  assert.equal(result.blocker_burndown_rows.length, 6);
  assert.equal(result.completion_operator_projection_rows.length, 6);
  assert.equal(result.completion_authority_guard_rows.length, 6);
  assert.equal(result.p17600_closeout_rows.length, 6);

  assert.equal(result.claude_review_execution_rows.every((row) => row.claude_final_approval_allowed === false), true);
  assert.equal(result.completion_review_receipt_rows.every((row) => row.claude_final_approval_allowed === false), true);
  assert.equal(result.finding_remediation_rows.every((row) => row.finding_auto_close_allowed_now === false), true);
  assert.equal(result.completion_operator_projection_rows.every((row) => row.read_only_projection_required === true && row.api_write_allowed_now === false), true);
  assert.equal(result.completion_authority_guard_rows.every((row) => row.deployment_allowed_now === false && row.release_approval_allowed_now === false && row.production_pass_enabled === false && row.enterprise_pass_enabled === false && row.human_gate_bypass_allowed_now === false && row.independent_review_bypass_allowed_now === false), true);
});

test("Freeze Evidence Completion preserves valid BLOCK when P17200 source is not ready for handoff", async () => {
  const result = await buildFreezeEvidenceCompletion(options({ freezeEvidenceActivation: P17200_BLOCKED }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.freeze_evidence_completion_status, "blocked_freeze_evidence_completion");
  assert.equal(result.summary.source_p17200_ready_for_p17201_handoff, false);
  assert.equal(result.summary.source_block_visible_now, true);
  assert.equal(result.summary.ready_for_p17601_handoff, false);
  assert.equal(result.p17601_handoff_gate_rows.find((row) => row.row_id === "p17601_handoff_gate.source_ready").current_verdict, "blocked");
});

test("Freeze Evidence Completion remains valid BLOCK when Claude completion review receipt is missing", async () => {
  const result = await buildFreezeEvidenceCompletion(options({ claudeCompletionReviewReceipt: null }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.claude_completion_review_receipt_present_now, false);
  assert.equal(result.summary.claude_completion_review_block_visible_now, true);
  assert.equal(result.summary.ready_for_p17601_handoff, false);
  assert.equal(result.completion_review_receipt_rows.find((row) => row.row_id === "completion_review_receipt.receipt_status").current_verdict, "blocked");
});

test("Freeze Evidence Completion blocks handoff when Claude review has unresolved or blocking findings", async () => {
  const result = await buildFreezeEvidenceCompletion(options({ claudeCompletionReviewReceipt: CLAUDE_COMPLETION_REVIEW_WITH_FINDINGS }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.claude_completion_review_receipt_present_now, false);
  assert.equal(result.summary.unresolved_finding_count, 1);
  assert.equal(result.summary.blocking_finding_count, 1);
  assert.equal(result.summary.ready_for_p17601_handoff, false);
  assert.equal(result.finding_remediation_rows.find((row) => row.row_id === "finding_remediation.p0_p1_closure").current_verdict, "blocked");
});

test("Freeze Evidence Completion keeps malformed Claude receipt as valid BLOCK with visible blocker", async () => {
  const result = await buildFreezeEvidenceCompletion(options({ claudeCompletionReviewReceipt: CLAUDE_COMPLETION_REVIEW_MALFORMED }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.claude_completion_review_receipt_observed_now, false);
  assert.equal(result.summary.claude_completion_review_receipt_present_now, false);
  assert.equal(result.summary.claude_completion_review_block_visible_now, true);
  assert.equal(result.summary.ready_for_p17601_handoff, false);
  assert.equal(result.blocker_burndown_rows.find((row) => row.row_id === "blocker_burndown.receipt_blocker").current_verdict, "pass");
});

test("Freeze Evidence Completion keeps failed or stale revalidation receipt as valid BLOCK", async () => {
  const failed = await buildFreezeEvidenceCompletion(options({ revalidationReceipt: REVALIDATION_FAILED }));
  const stale = await buildFreezeEvidenceCompletion(options({ revalidationReceipt: REVALIDATION_STALE }));

  assert.equal(failed.validation.valid, true);
  assert.equal(failed.summary.revalidation_receipt_present_now, false);
  assert.equal(failed.summary.revalidation_block_visible_now, true);
  assert.equal(failed.summary.ready_for_p17601_handoff, false);
  assert.equal(failed.blocker_burndown_rows.find((row) => row.row_id === "blocker_burndown.validation_blocker").current_verdict, "pass");
  assert.equal(stale.validation.valid, true);
  assert.equal(stale.summary.revalidation_receipt_present_now, false);
  assert.equal(stale.summary.revalidation_block_visible_now, true);
  assert.equal(stale.summary.ready_for_p17601_handoff, false);
});

test("Freeze Evidence Completion blocks handoff when P17200 source is present but structurally invalid", async () => {
  const result = await buildFreezeEvidenceCompletion(options({ freezeEvidenceActivation: P17200_PRESENT_INVALID }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.source_p17200_ready_for_p17201_handoff, true);
  assert.equal(result.summary.ready_for_p17601_handoff, false);
  assert.equal(result.p17601_handoff_gate_rows.find((row) => row.row_id === "p17601_handoff_gate.source_ready").current_verdict, "blocked");
});

test("Freeze Evidence Completion remains valid BLOCK when revalidation receipt is missing", async () => {
  const result = await buildFreezeEvidenceCompletion(options({ revalidationReceipt: null }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.revalidation_receipt_present_now, false);
  assert.equal(result.summary.revalidation_block_visible_now, true);
  assert.equal(result.summary.ready_for_p17601_handoff, false);
  assert.equal(result.revalidation_evidence_rows.find((row) => row.row_id === "revalidation_evidence.targeted_validation_receipt").current_verdict, "blocked");
});

test("Freeze Evidence Completion fails validation if P17200 source is missing", async () => {
  const result = await buildFreezeEvidenceCompletion(options({ freezeEvidenceActivation: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.freeze_evidence_completion_status, "blocked_freeze_evidence_completion");
  assert.equal(result.freeze_completion_boundary.source_p17200_available, false);
});

test("Freeze Evidence Completion boundary keeps production, enterprise, bypass, execution, connector, raw exposure, and final approval closed", async () => {
  const result = await buildFreezeEvidenceCompletion(options());
  const boundary = result.freeze_completion_boundary;

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

test("Freeze Evidence Completion HTML is read-only and avoids unsafe operations copy", async () => {
  const result = await buildFreezeEvidenceCompletion(options());

  assert.equal(/<form|<button|type="submit"|deploy now|release now|production ready|enterprise pass|bypass review|bypass human|write config|run migration|run rollback|runtime execute|write file|protected action|final approve/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
});

test("Freeze Evidence Completion --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "freeze-evidence-completion-"));
  const sentinelPath = path.join(outDir, "freeze-evidence-completion.json");
  const sentinel = "{ \"sentinel\": \"freeze-evidence-completion\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runFreezeEvidenceCompletion(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
