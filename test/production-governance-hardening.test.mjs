import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildProductionGovernanceHardening,
  runProductionGovernanceHardening,
} from "../src/production-governance-hardening.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P16200_READY = {
  schema_version: "execution-write-authority-maturity.v1",
  program_range: "P15801-P16200",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    execution_write_authority_maturity_status: "ready_for_execution_write_authority_maturity",
    ready_for_p16201_handoff: true,
    action_class_registry_row_count: 6,
    receipt_gated_candidate_lane_row_count: 6,
    command_allowlist_policy_row_count: 6,
    write_scope_policy_row_count: 6,
    rollback_recovery_binding_row_count: 6,
    post_action_validation_row_count: 6,
    authority_read_only_projection_row_count: 6,
    command_execution_allowed_now: false,
    patch_apply_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  execution_write_authority_boundary: {
    ready_for_p16201_handoff: true,
    receipt_application_allowed_now: false,
    candidate_execution_allowed_now: false,
    command_execution_allowed_now: false,
    runtime_execution_allowed_now: false,
    direct_file_write_allowed_now: false,
    patch_apply_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    external_service_mutation_allowed_now: false,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    write_action_allowed_now: false,
    final_approval_ui_enabled: false,
    secret_read_allowed_now: false,
    raw_source_exposure_allowed: false,
  },
};

const P16200_BLOCKED = {
  schema_version: "execution-write-authority-maturity.v1",
  program_range: "P15801-P16200",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    execution_write_authority_maturity_status: "blocked_execution_write_authority_maturity",
    ready_for_p16201_handoff: false,
    action_class_registry_row_count: 6,
    receipt_gated_candidate_lane_row_count: 6,
    command_allowlist_policy_row_count: 6,
    write_scope_policy_row_count: 6,
    rollback_recovery_binding_row_count: 6,
    post_action_validation_row_count: 6,
    authority_read_only_projection_row_count: 6,
    command_execution_allowed_now: false,
    patch_apply_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  execution_write_authority_boundary: {
    ready_for_p16201_handoff: false,
    receipt_application_allowed_now: false,
    candidate_execution_allowed_now: false,
    command_execution_allowed_now: false,
    runtime_execution_allowed_now: false,
    direct_file_write_allowed_now: false,
    patch_apply_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    external_service_mutation_allowed_now: false,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    write_action_allowed_now: false,
    final_approval_ui_enabled: false,
    secret_read_allowed_now: false,
    raw_source_exposure_allowed: false,
  },
};

const CLAUDE_PRODUCTION_REVIEW_READY = {
  schema_version: "production-governance-claude-review-receipt.v1",
  review_engine: "claude_code_opus_max",
  receipt_status: "complete",
  scope_production_governance_hardening: true,
  unresolved_finding_count: 0,
  summary: {
    review_status: "complete",
    unresolved_finding_count: 0,
  },
};

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    executionWriteAuthorityMaturity: P16200_READY,
    claudeProductionGovernanceReviewReceipt: CLAUDE_PRODUCTION_REVIEW_READY,
    ...overrides,
  };
}

test("Production Governance Hardening builds release, evidence, environment, incident, backup, SLO, Claude review, projection, authority, and freeze contracts through P16600", async () => {
  const result = await buildProductionGovernanceHardening(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "production-governance-hardening.v1");
  assert.equal(result.program_range, "P16201-P16600");
  assert.equal(result.source_program_range, "P15801-P16200");
  assert.equal(result.summary.production_governance_hardening_status, "ready_for_production_governance_hardening");
  assert.equal(result.summary.release_candidate_governance_row_count, 6);
  assert.equal(result.summary.production_evidence_bundle_row_count, 6);
  assert.equal(result.summary.environment_config_boundary_row_count, 6);
  assert.equal(result.summary.incident_runbook_readiness_row_count, 6);
  assert.equal(result.summary.backup_restore_readiness_row_count, 6);
  assert.equal(result.summary.slo_observability_readiness_row_count, 6);
  assert.equal(result.summary.claude_production_governance_review_receipt_present_now, true);
  assert.equal(result.summary.production_read_only_projection_row_count, 6);
  assert.equal(result.summary.ready_for_p16601_handoff, true);
  assert.equal(result.summary.deployment_allowed_now, false);
});

test("Production Governance Hardening covers every planned phase", async () => {
  const result = await buildProductionGovernanceHardening(options());
  const phases = new Set(result.production_governance_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P16201-P16240", "P16241-P16280", "P16281-P16320", "P16321-P16360", "P16361-P16400", "P16401-P16440", "P16441-P16480", "P16481-P16520", "P16521-P16560", "P16561-P16600"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.production_governance_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Production Governance Hardening defines production readiness rows without opening deployment, release approval, config write, migration, rollback, production PASS, trust, or final approval", async () => {
  const result = await buildProductionGovernanceHardening(options());

  assert.equal(result.production_governance_source_binding_rows.length, 9);
  assert.equal(result.release_candidate_governance_rows.length, 6);
  assert.equal(result.production_evidence_bundle_rows.length, 6);
  assert.equal(result.environment_config_boundary_rows.length, 6);
  assert.equal(result.incident_runbook_readiness_rows.length, 6);
  assert.equal(result.backup_restore_readiness_rows.length, 6);
  assert.equal(result.slo_observability_readiness_rows.length, 6);
  assert.equal(result.claude_production_governance_review_rows.length, 5);
  assert.equal(result.production_read_only_projection_rows.length, 6);
  assert.equal(result.production_authority_guard_rows.length, 8);

  assert.equal(result.release_candidate_governance_rows.every((row) => row.release_approval_allowed_now === false && row.promotion_allowed_now === false), true);
  assert.equal(result.production_evidence_bundle_rows.every((row) => row.production_pass_enabled === false), true);
  assert.equal(result.environment_config_boundary_rows.every((row) => row.environment_config_write_allowed_now === false && row.migration_execution_allowed_now === false && row.secret_read_allowed_now === false), true);
  assert.equal(result.incident_runbook_readiness_rows.every((row) => row.incident_auto_close_allowed_now === false && row.external_service_mutation_allowed_now === false), true);
  assert.equal(result.backup_restore_readiness_rows.every((row) => row.rollback_execution_allowed_now === false && row.raw_source_exposure_allowed === false), true);
  assert.equal(result.slo_observability_readiness_rows.every((row) => row.metric_write_allowed_now === false && row.alert_mutation_allowed_now === false), true);
  assert.equal(result.production_read_only_projection_rows.every((row) => row.deployment_allowed_now === false && row.api_write_allowed_now === false), true);
  assert.equal(result.production_authority_guard_rows.every((row) => row.deployment_allowed_now === false && row.release_approval_allowed_now === false && row.production_pass_enabled === false && row.enterprise_pass_enabled === false && row.enterprise_trust_claim_allowed_now === false && row.protected_closeout_enabled === false && row.environment_config_write_allowed_now === false), true);
});

test("Production Governance Hardening preserves blocked P16200 source and missing Claude review without opening P16601 handoff", async () => {
  const result = await buildProductionGovernanceHardening(options({
    executionWriteAuthorityMaturity: P16200_BLOCKED,
    claudeProductionGovernanceReviewReceipt: null,
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.production_governance_hardening_status, "blocked_production_governance_hardening");
  assert.equal(result.summary.source_ready_for_p16201_handoff, false);
  assert.equal(result.summary.source_block_visible_now, true);
  assert.equal(result.summary.claude_production_governance_review_receipt_present_now, false);
  assert.equal(result.summary.claude_production_governance_review_block_visible_now, true);
  assert.equal(result.summary.ready_for_p16601_handoff, false);
  assert.equal(result.production_governance_source_binding_rows.find((row) => row.row_id === "source.handoff").current_verdict, "blocked");
  assert.equal(result.p16600_freeze_rows.find((row) => row.row_id === "freeze.source").current_verdict, "blocked");
  assert.equal(result.p16600_freeze_rows.find((row) => row.row_id === "freeze.claude_production_governance_review").current_verdict, "blocked");
});

test("Production Governance Hardening keeps ready source blocked when Claude production governance review evidence is missing", async () => {
  const result = await buildProductionGovernanceHardening(options({ claudeProductionGovernanceReviewReceipt: null }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.source_ready_for_p16201_handoff, true);
  assert.equal(result.summary.claude_production_governance_review_receipt_present_now, false);
  assert.equal(result.summary.ready_for_p16601_handoff, false);
});

test("Production Governance Hardening fails validation if P16200 source is missing", async () => {
  const result = await buildProductionGovernanceHardening(options({ executionWriteAuthorityMaturity: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.production_governance_hardening_status, "blocked_production_governance_hardening");
  assert.equal(result.production_governance_boundary.source_execution_write_authority_available, false);
});

test("Production Governance Hardening boundary keeps deployment, release, production, enterprise, config write, execution, connector, raw exposure, and final approval closed", async () => {
  const result = await buildProductionGovernanceHardening(options());
  const boundary = result.production_governance_boundary;

  assert.equal(boundary.deployment_allowed_now, false);
  assert.equal(boundary.release_approval_allowed_now, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.enterprise_trust_claim_allowed_now, false);
  assert.equal(boundary.protected_closeout_enabled, false);
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
  assert.equal(boundary.codex_final_approval_ui_enabled, false);
  assert.equal(boundary.claude_final_approval_ui_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Production Governance Hardening HTML is read-only and avoids unsafe operations copy", async () => {
  const result = await buildProductionGovernanceHardening(options());

  assert.equal(/<form|<button|type="submit"|deploy now|release now|production ready|enterprise pass|write config|run migration|run rollback|runtime execute|write file|protected action|final approve/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
});

test("Production Governance Hardening --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "production-governance-hardening-"));
  const sentinelPath = path.join(outDir, "production-governance-hardening.json");
  const sentinel = "{ \"sentinel\": \"production-governance-hardening\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runProductionGovernanceHardening(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
