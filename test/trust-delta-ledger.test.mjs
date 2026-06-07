import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildTrustDeltaLedger,
  runTrustDeltaLedger,
} from "../src/trust-delta-ledger.mjs";

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

const P17600_READY = {
  schema_version: "freeze-evidence-completion.v1",
  program_range: "P17201-P17600",
  source_program_range: "P16801-P17200",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    freeze_evidence_completion_status: "ready_for_freeze_evidence_completion",
    ready_for_p17601_handoff: true,
    source_block_visible_now: false,
    unresolved_finding_count: 0,
    blocking_finding_count: 0,
    revalidation_block_visible_now: false,
  },
  observed_revalidation_summary: {
    validation_status: "pass",
    full_npm_test_passed: true,
  },
  freeze_completion_boundary: {
    ...CLOSED_BOUNDARY,
    revalidation_receipt_present_now: true,
    revalidation_block_visible_now: false,
    unresolved_finding_count: 0,
    blocking_finding_count: 0,
  },
};

const P17600_BLOCKED = {
  ...P17600_READY,
  summary: {
    ...P17600_READY.summary,
    freeze_evidence_completion_status: "blocked_freeze_evidence_completion",
    ready_for_p17601_handoff: false,
    source_block_visible_now: true,
  },
};

const P17600_WITH_FINDINGS = {
  ...P17600_READY,
  summary: {
    ...P17600_READY.summary,
    freeze_evidence_completion_status: "blocked_freeze_evidence_completion",
    ready_for_p17601_handoff: false,
    unresolved_finding_count: 2,
    blocking_finding_count: 1,
  },
  freeze_completion_boundary: {
    ...P17600_READY.freeze_completion_boundary,
    unresolved_finding_count: 2,
    blocking_finding_count: 1,
  },
};

const P17600_VALIDATION_BLOCKED = {
  ...P17600_READY,
  summary: {
    ...P17600_READY.summary,
    freeze_evidence_completion_status: "blocked_freeze_evidence_completion",
    ready_for_p17601_handoff: false,
    revalidation_block_visible_now: true,
  },
  observed_revalidation_summary: {
    validation_status: "blocked",
    full_npm_test_passed: false,
  },
  freeze_completion_boundary: {
    ...P17600_READY.freeze_completion_boundary,
    revalidation_receipt_present_now: false,
    revalidation_block_visible_now: true,
  },
};

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    freezeEvidenceCompletion: P17600_READY,
    ...overrides,
  };
}

test("Trust Delta Ledger opens only P18001 handoff when P17600 source has no trust debt", async () => {
  const result = await buildTrustDeltaLedger(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "trust-delta-ledger.v1");
  assert.equal(result.program_range, "P17601-P18000");
  assert.equal(result.source_program_range, "P17201-P17600");
  assert.equal(result.summary.trust_delta_ledger_status, "ready_for_trust_delta_ledger");
  assert.equal(result.summary.source_p17600_ready_for_p17601_handoff, true);
  assert.equal(result.summary.trust_debt_count, 0);
  assert.equal(result.summary.ready_for_p18001_handoff, true);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Trust Delta Ledger covers every planned phase", async () => {
  const result = await buildTrustDeltaLedger(options());
  const phases = new Set(result.trust_delta_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P17601-P17640", "P17641-P17680", "P17681-P17720", "P17721-P17760", "P17761-P17800", "P17801-P17840", "P17841-P17880", "P17881-P17920", "P17921-P17960", "P17961-P18000"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.trust_delta_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Trust Delta Ledger defines all delta rows without opening protected authority", async () => {
  const result = await buildTrustDeltaLedger(options());

  assert.equal(result.trust_source_binding_rows.length, 6);
  assert.equal(result.trust_baseline_snapshot_rows.length, 6);
  assert.equal(result.evidence_quality_delta_rows.length, 6);
  assert.equal(result.review_finding_delta_rows.length, 6);
  assert.equal(result.validation_freshness_delta_rows.length, 6);
  assert.equal(result.authority_boundary_delta_rows.length, 6);
  assert.equal(result.operator_trust_projection_rows.length, 6);
  assert.equal(result.trust_debt_ledger_rows.length, 6);
  assert.equal(result.p18001_handoff_gate_rows.length, 6);
  assert.equal(result.p18000_freeze_rows.length, 6);
  assert.equal(result.authority_boundary_delta_rows.every((row) => row.deployment_allowed_now === false && row.release_approval_allowed_now === false && row.production_pass_enabled === false && row.enterprise_pass_enabled === false), true);
  assert.equal(result.operator_trust_projection_rows.every((row) => row.read_only_projection_required === true && row.api_write_allowed_now === false), true);
});

test("Trust Delta Ledger preserves valid BLOCK when P17600 source is not ready", async () => {
  const result = await buildTrustDeltaLedger(options({ freezeEvidenceCompletion: P17600_BLOCKED }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trust_delta_ledger_status, "blocked_trust_delta_ledger");
  assert.equal(result.summary.source_p17600_ready_for_p17601_handoff, false);
  assert.equal(result.summary.trust_debt_count > 0, true);
  assert.equal(result.summary.ready_for_p18001_handoff, false);
  assert.equal(result.p18001_handoff_gate_rows.find((row) => row.row_id === "p18001_handoff_gate.source_ready").current_verdict, "blocked");
});

test("Trust Delta Ledger preserves review and finding debt", async () => {
  const result = await buildTrustDeltaLedger(options({ freezeEvidenceCompletion: P17600_WITH_FINDINGS }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.unresolved_finding_count, 2);
  assert.equal(result.summary.blocking_finding_count, 1);
  assert.equal(result.summary.trust_debt_count >= 2, true);
  assert.equal(result.summary.ready_for_p18001_handoff, false);
  assert.equal(result.p18001_handoff_gate_rows.find((row) => row.row_id === "p18001_handoff_gate.review_clear").current_verdict, "blocked");
  assert.equal(result.review_finding_delta_rows.find((row) => row.row_id === "review_finding_delta.p0_p1_state").current_verdict, "blocked");
  assert.equal(result.review_finding_delta_rows.find((row) => row.row_id === "review_finding_delta.p2_p3_state").current_verdict, "blocked");
  assert.equal(result.review_finding_delta_rows.find((row) => row.row_id === "review_finding_delta.remediation_state").current_verdict, "blocked");
});

test("Trust Delta Ledger preserves validation and full-suite debt", async () => {
  const result = await buildTrustDeltaLedger(options({ freezeEvidenceCompletion: P17600_VALIDATION_BLOCKED }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.validation_blocked_now, true);
  assert.equal(result.summary.full_suite_debt_present_now, true);
  assert.equal(result.summary.trust_debt_count >= 2, true);
  assert.equal(result.summary.ready_for_p18001_handoff, false);
  assert.equal(result.p18001_handoff_gate_rows.find((row) => row.row_id === "p18001_handoff_gate.validation_clear").current_verdict, "blocked");
});

test("Trust Delta Ledger fails validation if P17600 source is missing", async () => {
  const result = await buildTrustDeltaLedger(options({ freezeEvidenceCompletion: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.trust_delta_ledger_status, "blocked_trust_delta_ledger");
  assert.equal(result.trust_delta_boundary.source_p17600_available, false);
});

test("Trust Delta Ledger rebuilds absent disk source as conservative valid BLOCK", async () => {
  const result = await buildTrustDeltaLedger({
    runAt: RUN_AT,
    write: false,
    sourceFreezeEvidenceCompletionPath: path.join(os.tmpdir(), "missing-freeze-evidence-completion.json"),
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.trust_delta_ledger_status, "blocked_trust_delta_ledger");
  assert.equal(result.summary.ready_for_p18001_handoff, false);
  assert.equal(result.source_refs.freeze_evidence_completion_path, "built.freeze_evidence_completion");
});

test("Trust Delta Ledger boundary keeps production, enterprise, bypass, execution, connector, raw exposure, and final approval closed", async () => {
  const result = await buildTrustDeltaLedger(options());
  const boundary = result.trust_delta_boundary;

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

test("Trust Delta Ledger HTML is read-only and avoids unsafe operations copy", async () => {
  const result = await buildTrustDeltaLedger(options());

  assert.equal(/<form|<button|type="submit"|deploy now|release now|production ready|enterprise pass|bypass review|bypass human|write config|run migration|run rollback|runtime execute|write file|protected action|final approve/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
});

test("Trust Delta Ledger --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "trust-delta-ledger-"));
  const sentinelPath = path.join(outDir, "trust-delta-ledger.json");
  const sentinel = "{ \"sentinel\": \"trust-delta-ledger\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runTrustDeltaLedger(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
