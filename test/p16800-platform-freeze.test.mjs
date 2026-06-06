import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildP16800PlatformFreeze,
  runP16800PlatformFreeze,
} from "../src/p16800-platform-freeze.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P16600_READY = {
  schema_version: "production-governance-hardening.v1",
  program_range: "P16201-P16600",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    production_governance_hardening_status: "ready_for_production_governance_hardening",
    ready_for_p16601_handoff: true,
    release_candidate_governance_row_count: 6,
    production_evidence_bundle_row_count: 6,
    environment_config_boundary_row_count: 6,
    incident_runbook_readiness_row_count: 6,
    backup_restore_readiness_row_count: 6,
    slo_observability_readiness_row_count: 6,
    production_read_only_projection_row_count: 6,
    production_authority_guard_row_count: 8,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  production_governance_boundary: {
    ready_for_p16601_handoff: true,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
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
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
  },
};

const P16600_BLOCKED = {
  schema_version: "production-governance-hardening.v1",
  program_range: "P16201-P16600",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    production_governance_hardening_status: "blocked_production_governance_hardening",
    ready_for_p16601_handoff: false,
    release_candidate_governance_row_count: 6,
    production_evidence_bundle_row_count: 6,
    environment_config_boundary_row_count: 6,
    incident_runbook_readiness_row_count: 6,
    backup_restore_readiness_row_count: 6,
    slo_observability_readiness_row_count: 6,
    production_read_only_projection_row_count: 6,
    production_authority_guard_row_count: 8,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  production_governance_boundary: {
    ready_for_p16601_handoff: false,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
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
    final_approval_ui_enabled: false,
    codex_final_approval_ui_enabled: false,
    claude_final_approval_ui_enabled: false,
  },
};

const CLAUDE_PLATFORM_FREEZE_REVIEW_READY = {
  schema_version: "p16800-platform-freeze-claude-review-receipt.v1",
  review_engine: "claude_code_opus_max",
  receipt_status: "complete",
  scope_p16800_platform_freeze: true,
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
    productionGovernanceHardening: P16600_READY,
    claudePlatformFreezeReviewReceipt: CLAUDE_PLATFORM_FREEZE_REVIEW_READY,
    ...overrides,
  };
}

test("P16800 Platform Freeze builds roadmap, validation, review cadence, authority, SaaS handoff, projection, Claude review, closeout, and freeze contracts", async () => {
  const result = await buildP16800PlatformFreeze(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "p16800-platform-freeze.v1");
  assert.equal(result.program_range, "P16601-P16800");
  assert.equal(result.source_program_range, "P16201-P16600");
  assert.equal(result.summary.platform_freeze_status, "ready_for_p16800_platform_freeze");
  assert.equal(result.summary.roadmap_ledger_freeze_row_count, 6);
  assert.equal(result.summary.validation_matrix_freeze_row_count, 6);
  assert.equal(result.summary.review_cadence_freeze_row_count, 6);
  assert.equal(result.summary.authority_boundary_freeze_row_count, 6);
  assert.equal(result.summary.saas_factory_handoff_freeze_row_count, 6);
  assert.equal(result.summary.operator_evidence_projection_row_count, 6);
  assert.equal(result.summary.claude_platform_freeze_review_receipt_present_now, true);
  assert.equal(result.summary.closeout_packet_projection_row_count, 6);
  assert.equal(result.summary.ready_for_post_p16800_handoff, true);
  assert.equal(result.summary.deployment_allowed_now, false);
});

test("P16800 Platform Freeze covers every planned phase", async () => {
  const result = await buildP16800PlatformFreeze(options());
  const phases = new Set(result.platform_freeze_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P16601-P16620", "P16621-P16640", "P16641-P16660", "P16661-P16680", "P16681-P16700", "P16701-P16720", "P16721-P16740", "P16741-P16760", "P16761-P16780", "P16781-P16800"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.platform_freeze_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("P16800 Platform Freeze defines freeze rows without opening production, enterprise trust, human bypass, review bypass, execution, write, connector, raw exposure, or final approval", async () => {
  const result = await buildP16800PlatformFreeze(options());

  assert.equal(result.platform_freeze_source_binding_rows.length, 9);
  assert.equal(result.roadmap_ledger_freeze_rows.length, 6);
  assert.equal(result.validation_matrix_freeze_rows.length, 6);
  assert.equal(result.review_cadence_freeze_rows.length, 6);
  assert.equal(result.authority_boundary_freeze_rows.length, 6);
  assert.equal(result.saas_factory_handoff_freeze_rows.length, 6);
  assert.equal(result.operator_evidence_projection_rows.length, 6);
  assert.equal(result.claude_platform_freeze_review_rows.length, 5);
  assert.equal(result.closeout_packet_projection_rows.length, 6);

  assert.equal(result.roadmap_ledger_freeze_rows.every((row) => row.phase_range_based === true && row.p9000_locked_copy_allowed === false), true);
  assert.equal(result.validation_matrix_freeze_rows.every((row) => row.diff_first_validation_required === true && row.full_npm_default_allowed === false), true);
  assert.equal(result.review_cadence_freeze_rows.every((row) => row.claude_review_required_for_high_risk === true && row.final_approval_allowed_now === false), true);
  assert.equal(result.authority_boundary_freeze_rows.every((row) => row.protected_closeout_enabled === false && row.human_gate_bypass_allowed_now === false && row.independent_review_bypass_allowed_now === false && row.single_owner_enterprise_trust_allowed_now === false), true);
  assert.equal(result.saas_factory_handoff_freeze_rows.every((row) => row.project_creation_allowed_now === false && row.repo_write_allowed_now === false && row.connector_provisioning_allowed_now === false), true);
  assert.equal(result.operator_evidence_projection_rows.every((row) => row.read_only_projection_required === true && row.api_write_allowed_now === false && row.dashboard_mutation_allowed_now === false), true);
  assert.equal(result.closeout_packet_projection_rows.every((row) => row.closeout_packet_required === true && row.protected_closeout_enabled === false && row.production_pass_enabled === false), true);
});

test("P16800 Platform Freeze preserves blocked P16600 source and missing Claude review without opening post-P16800 handoff", async () => {
  const result = await buildP16800PlatformFreeze(options({
    productionGovernanceHardening: P16600_BLOCKED,
    claudePlatformFreezeReviewReceipt: null,
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.platform_freeze_status, "blocked_p16800_platform_freeze");
  assert.equal(result.summary.source_ready_for_p16601_handoff, false);
  assert.equal(result.summary.source_block_visible_now, true);
  assert.equal(result.summary.claude_platform_freeze_review_receipt_present_now, false);
  assert.equal(result.summary.claude_platform_freeze_review_block_visible_now, true);
  assert.equal(result.summary.ready_for_post_p16800_handoff, false);
  assert.equal(result.platform_freeze_source_binding_rows.find((row) => row.row_id === "source.handoff").current_verdict, "blocked");
  assert.equal(result.p16800_freeze_rows.find((row) => row.row_id === "freeze.source").current_verdict, "blocked");
  assert.equal(result.p16800_freeze_rows.find((row) => row.row_id === "freeze.claude_platform_freeze_review").current_verdict, "blocked");
});

test("P16800 Platform Freeze keeps ready source blocked when Claude platform freeze review evidence is missing", async () => {
  const result = await buildP16800PlatformFreeze(options({ claudePlatformFreezeReviewReceipt: null }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.source_ready_for_p16601_handoff, true);
  assert.equal(result.summary.claude_platform_freeze_review_receipt_present_now, false);
  assert.equal(result.summary.ready_for_post_p16800_handoff, false);
});

test("P16800 Platform Freeze fails validation if P16600 source is missing", async () => {
  const result = await buildP16800PlatformFreeze(options({ productionGovernanceHardening: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.platform_freeze_status, "blocked_p16800_platform_freeze");
  assert.equal(result.platform_freeze_boundary.source_production_governance_available, false);
});

test("P16800 Platform Freeze boundary keeps production, enterprise, bypass, execution, connector, raw exposure, and final approval closed", async () => {
  const result = await buildP16800PlatformFreeze(options());
  const boundary = result.platform_freeze_boundary;

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

test("P16800 Platform Freeze HTML is read-only and avoids unsafe operations copy", async () => {
  const result = await buildP16800PlatformFreeze(options());

  assert.equal(/<form|<button|type="submit"|deploy now|release now|production ready|enterprise pass|bypass review|bypass human|write config|run migration|run rollback|runtime execute|write file|protected action|final approve/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
});

test("P16800 Platform Freeze --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "p16800-platform-freeze-"));
  const sentinelPath = path.join(outDir, "p16800-platform-freeze.json");
  const sentinel = "{ \"sentinel\": \"p16800-platform-freeze\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runP16800PlatformFreeze(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
