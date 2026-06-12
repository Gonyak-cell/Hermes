import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildExecutionWriteAuthorityMaturity,
  runExecutionWriteAuthorityMaturity,
} from "../src/execution-write-authority-maturity.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P15800_READY = {
  schema_version: "connector-external-app-governance.v1",
  program_range: "P15401-P15800",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    connector_external_app_governance_status: "ready_for_connector_external_app_governance",
    ready_for_p15801_handoff: true,
    external_app_registry_row_count: 6,
    connector_capability_matrix_row_count: 6,
    consent_auth_receipt_row_count: 6,
    ingestion_quarantine_row_count: 6,
    external_app_evidence_mapping_row_count: 6,
    cross_app_boundary_guard_row_count: 6,
    connector_read_only_projection_row_count: 6,
    external_app_connection_allowed_now: false,
    credential_lookup_allowed_now: false,
    secret_read_allowed_now: false,
    raw_export_allowed_now: false,
    ingestion_start_allowed_now: false,
    connector_write_enabled: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  connector_governance_boundary: {
    ready_for_p15801_handoff: true,
    external_app_connection_allowed_now: false,
    credential_lookup_allowed_now: false,
    secret_read_allowed_now: false,
    raw_export_allowed_now: false,
    raw_source_exposure_allowed: false,
    ingestion_start_allowed_now: false,
    connector_write_enabled: false,
    external_service_mutation_allowed_now: false,
    cross_app_data_join_allowed_now: false,
    enterprise_trust_claim_allowed_now: false,
    production_pass_enabled: false,
    protected_closeout_enabled: false,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    write_action_allowed_now: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
  },
};

const P15800_BLOCKED = {
  schema_version: "connector-external-app-governance.v1",
  program_range: "P15401-P15800",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    connector_external_app_governance_status: "blocked_connector_external_app_governance",
    ready_for_p15801_handoff: false,
    external_app_registry_row_count: 6,
    connector_capability_matrix_row_count: 6,
    consent_auth_receipt_row_count: 6,
    ingestion_quarantine_row_count: 6,
    external_app_evidence_mapping_row_count: 6,
    cross_app_boundary_guard_row_count: 6,
    connector_read_only_projection_row_count: 6,
    external_app_connection_allowed_now: false,
    credential_lookup_allowed_now: false,
    secret_read_allowed_now: false,
    raw_export_allowed_now: false,
    ingestion_start_allowed_now: false,
    connector_write_enabled: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  connector_governance_boundary: {
    ready_for_p15801_handoff: false,
    external_app_connection_allowed_now: false,
    credential_lookup_allowed_now: false,
    secret_read_allowed_now: false,
    raw_export_allowed_now: false,
    raw_source_exposure_allowed: false,
    ingestion_start_allowed_now: false,
    connector_write_enabled: false,
    external_service_mutation_allowed_now: false,
    cross_app_data_join_allowed_now: false,
    enterprise_trust_claim_allowed_now: false,
    production_pass_enabled: false,
    protected_closeout_enabled: false,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    write_action_allowed_now: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
  },
};

const CLAUDE_EXECUTION_WRITE_REVIEW_READY = {
  schema_version: "execution-write-authority-claude-review-receipt.v1",
  review_engine: "claude_code_opus_max",
  receipt_status: "complete",
  scope_execution_write_authority_maturity: true,
  scope_id: "execution_write_authority_maturity",
  reviewed_commit_sha: "20268570e7fa1f796c66db96b86aa48219cfba7d",
  prompt_sha256: "a".repeat(64),
  raw_output_sha256: "b".repeat(64),
  engine_resolved_model_id: "claude-opus-4-8",
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
    connectorExternalAppGovernance: P15800_READY,
    claudeExecutionWriteAuthorityReviewReceipt: CLAUDE_EXECUTION_WRITE_REVIEW_READY,
    ...overrides,
  };
}

test("Execution/Write Authority Maturity builds action, candidate, allowlist, write scope, rollback, validation, Claude review, projection, authority, and freeze contracts through P16200", async () => {
  const result = await buildExecutionWriteAuthorityMaturity(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "execution-write-authority-maturity.v1");
  assert.equal(result.program_range, "P15801-P16200");
  assert.equal(result.source_program_range, "P15401-P15800");
  assert.equal(result.summary.execution_write_authority_maturity_status, "ready_for_execution_write_authority_maturity");
  assert.equal(result.summary.action_class_registry_row_count, 6);
  assert.equal(result.summary.receipt_gated_candidate_lane_row_count, 6);
  assert.equal(result.summary.command_allowlist_policy_row_count, 6);
  assert.equal(result.summary.write_scope_policy_row_count, 6);
  assert.equal(result.summary.rollback_recovery_binding_row_count, 6);
  assert.equal(result.summary.post_action_validation_row_count, 6);
  assert.equal(result.summary.claude_execution_write_authority_review_receipt_present_now, true);
  assert.equal(result.summary.authority_read_only_projection_row_count, 6);
  assert.equal(result.summary.ready_for_p16201_handoff, true);
  assert.equal(result.summary.command_execution_allowed_now, false);
});

test("Execution/Write Authority Maturity covers every planned phase", async () => {
  const result = await buildExecutionWriteAuthorityMaturity(options());
  const phases = new Set(result.execution_write_authority_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P15801-P15840", "P15841-P15880", "P15881-P15920", "P15921-P15960", "P15961-P16000", "P16001-P16040", "P16041-P16080", "P16081-P16120", "P16121-P16160", "P16161-P16200"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.execution_write_authority_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Execution/Write Authority Maturity defines candidate rows without opening receipt application, execution, direct write, patch apply, protected action, or final approval", async () => {
  const result = await buildExecutionWriteAuthorityMaturity(options());

  assert.equal(result.execution_authority_source_binding_rows.length, 9);
  assert.equal(result.action_class_registry_rows.length, 6);
  assert.equal(result.receipt_gated_candidate_lane_rows.length, 6);
  assert.equal(result.command_allowlist_policy_rows.length, 6);
  assert.equal(result.write_scope_policy_rows.length, 6);
  assert.equal(result.rollback_recovery_binding_rows.length, 6);
  assert.equal(result.post_action_validation_rows.length, 6);
  assert.equal(result.claude_execution_write_authority_review_rows.length, 5);
  assert.equal(result.authority_read_only_projection_rows.length, 6);
  assert.equal(result.execution_write_authority_guard_rows.length, 8);

  assert.equal(result.action_class_registry_rows.every((row) => row.protected_action_allowed_now === false && row.final_approval_allowed_now === false), true);
  assert.equal(result.receipt_gated_candidate_lane_rows.every((row) => row.receipt_application_allowed_now === false && row.candidate_execution_allowed_now === false && row.automatic_apply_allowed_now === false), true);
  assert.equal(result.command_allowlist_policy_rows.every((row) => row.command_execution_allowed_now === false), true);
  assert.equal(result.write_scope_policy_rows.every((row) => row.direct_file_write_allowed_now === false && row.patch_apply_allowed_now === false), true);
  assert.equal(result.rollback_recovery_binding_rows.every((row) => row.restore_execution_allowed_now === false && row.incident_auto_close_allowed_now === false), true);
  assert.equal(result.post_action_validation_rows.every((row) => row.status_closeout_allowed_now === false), true);
  assert.equal(result.authority_read_only_projection_rows.every((row) => row.command_execution_allowed_now === false && row.api_write_allowed_now === false), true);
  assert.equal(result.execution_write_authority_guard_rows.every((row) => row.receipt_application_allowed_now === false && row.candidate_execution_allowed_now === false && row.command_execution_allowed_now === false && row.runtime_execution_allowed_now === false && row.direct_file_write_allowed_now === false && row.patch_apply_allowed_now === false && row.protected_action_allowed_now === false), true);
});

test("Execution/Write Authority Maturity preserves blocked P15800 source and missing Claude review without opening P16201 handoff", async () => {
  const result = await buildExecutionWriteAuthorityMaturity(options({
    connectorExternalAppGovernance: P15800_BLOCKED,
    claudeExecutionWriteAuthorityReviewReceipt: null,
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.execution_write_authority_maturity_status, "blocked_execution_write_authority_maturity");
  assert.equal(result.summary.source_ready_for_p15801_handoff, false);
  assert.equal(result.summary.source_block_visible_now, true);
  assert.equal(result.summary.claude_execution_write_authority_review_receipt_present_now, false);
  assert.equal(result.summary.claude_execution_write_authority_review_block_visible_now, true);
  assert.equal(result.summary.ready_for_p16201_handoff, false);
  assert.equal(result.execution_authority_source_binding_rows.find((row) => row.row_id === "source.handoff").current_verdict, "blocked");
  assert.equal(result.p16200_freeze_rows.find((row) => row.row_id === "freeze.source").current_verdict, "blocked");
  assert.equal(result.p16200_freeze_rows.find((row) => row.row_id === "freeze.claude_execution_write_authority_review").current_verdict, "blocked");
});

test("Execution/Write Authority Maturity keeps ready source blocked when Claude execution/write authority review evidence is missing", async () => {
  const result = await buildExecutionWriteAuthorityMaturity(options({ claudeExecutionWriteAuthorityReviewReceipt: null }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.source_ready_for_p15801_handoff, true);
  assert.equal(result.summary.claude_execution_write_authority_review_receipt_present_now, false);
  assert.equal(result.summary.ready_for_p16201_handoff, false);
});

test("Execution/Write Authority Maturity rejects weak or unsafe Claude review receipts at the module gate", async () => {
  const missingIntegrity = await buildExecutionWriteAuthorityMaturity(options({
    claudeExecutionWriteAuthorityReviewReceipt: {
      ...CLAUDE_EXECUTION_WRITE_REVIEW_READY,
      unresolved_finding_count: undefined,
    },
  }));
  assert.equal(missingIntegrity.summary.claude_execution_write_authority_review_receipt_present_now, false);
  assert.equal(missingIntegrity.summary.ready_for_p16201_handoff, false);

  const unsafeAuthority = await buildExecutionWriteAuthorityMaturity(options({
    claudeExecutionWriteAuthorityReviewReceipt: {
      ...CLAUDE_EXECUTION_WRITE_REVIEW_READY,
      production_pass_enabled: true,
    },
  }));
  assert.equal(unsafeAuthority.summary.claude_execution_write_authority_review_receipt_present_now, false);
  assert.equal(unsafeAuthority.summary.ready_for_p16201_handoff, false);
});

test("Execution/Write Authority Maturity fails validation if P15800 source is missing", async () => {
  const result = await buildExecutionWriteAuthorityMaturity(options({ connectorExternalAppGovernance: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.execution_write_authority_maturity_status, "blocked_execution_write_authority_maturity");
  assert.equal(result.execution_write_authority_boundary.source_connector_governance_available, false);
});

test("Execution/Write Authority Maturity boundary keeps execution, write, patch apply, connector, raw exposure, release, and final approval closed", async () => {
  const result = await buildExecutionWriteAuthorityMaturity(options());
  const boundary = result.execution_write_authority_boundary;

  assert.equal(boundary.receipt_application_allowed_now, false);
  assert.equal(boundary.candidate_execution_allowed_now, false);
  assert.equal(boundary.command_execution_allowed_now, false);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.direct_file_write_allowed_now, false);
  assert.equal(boundary.patch_apply_allowed_now, false);
  assert.equal(boundary.protected_action_allowed_now, false);
  assert.equal(boundary.connector_write_enabled, false);
  assert.equal(boundary.external_service_mutation_allowed_now, false);
  assert.equal(boundary.deployment_allowed_now, false);
  assert.equal(boundary.secret_read_allowed_now, false);
  assert.equal(boundary.raw_source_exposure_allowed, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.enterprise_trust_claim_allowed_now, false);
  assert.equal(boundary.protected_closeout_enabled, false);
  assert.equal(boundary.release_approval_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.codex_final_approval_ui_enabled, false);
  assert.equal(boundary.claude_final_approval_ui_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Execution/Write Authority Maturity HTML is read-only and avoids unsafe operations copy", async () => {
  const result = await buildExecutionWriteAuthorityMaturity(options());

  assert.equal(/<form|<button|type="submit"|apply receipt|execute candidate|run command|runtime execute|write file|apply patch|protected action|deploy now|production ready|enterprise pass|final approve/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
});

test("Execution/Write Authority Maturity --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "execution-write-authority-maturity-"));
  const sentinelPath = path.join(outDir, "execution-write-authority-maturity.json");
  const sentinel = "{ \"sentinel\": \"execution-write-authority-maturity\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runExecutionWriteAuthorityMaturity(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
