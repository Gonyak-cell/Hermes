import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildConnectorExternalAppGovernance,
  runConnectorExternalAppGovernance,
} from "../src/connector-external-app-governance.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P15400_READY = {
  schema_version: "saas-factory-mode.v1",
  program_range: "P15001-P15400",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    saas_factory_mode_status: "ready_for_saas_factory_mode",
    ready_for_p15401_handoff: true,
    project_template_contract_row_count: 6,
    requirement_matrix_contract_row_count: 6,
    validation_plan_contract_row_count: 6,
    review_lane_contract_row_count: 6,
    domain_pack_composition_row_count: 6,
    release_gate_blueprint_row_count: 6,
    bootstrap_projection_row_count: 6,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    secret_generation_allowed_now: false,
    connector_provisioning_allowed_now: false,
    deployment_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  saas_factory_boundary: {
    ready_for_p15401_handoff: true,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    secret_generation_allowed_now: false,
    connector_provisioning_allowed_now: false,
    deployment_allowed_now: false,
    enterprise_trust_claim_allowed_now: false,
    production_pass_enabled: false,
    protected_closeout_enabled: false,
    release_approval_allowed_now: false,
    write_action_allowed_now: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
    connector_write_enabled: false,
    raw_source_exposure_allowed: false,
    unsafe_flag_count: 0,
  },
};

const P15400_BLOCKED = {
  schema_version: "saas-factory-mode.v1",
  program_range: "P15001-P15400",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    saas_factory_mode_status: "blocked_saas_factory_mode",
    ready_for_p15401_handoff: false,
    project_template_contract_row_count: 6,
    requirement_matrix_contract_row_count: 6,
    validation_plan_contract_row_count: 6,
    review_lane_contract_row_count: 6,
    domain_pack_composition_row_count: 6,
    release_gate_blueprint_row_count: 6,
    bootstrap_projection_row_count: 6,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    secret_generation_allowed_now: false,
    connector_provisioning_allowed_now: false,
    deployment_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  saas_factory_boundary: {
    ready_for_p15401_handoff: false,
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    secret_generation_allowed_now: false,
    connector_provisioning_allowed_now: false,
    deployment_allowed_now: false,
    enterprise_trust_claim_allowed_now: false,
    production_pass_enabled: false,
    protected_closeout_enabled: false,
    release_approval_allowed_now: false,
    write_action_allowed_now: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
    connector_write_enabled: false,
    raw_source_exposure_allowed: false,
    unsafe_flag_count: 0,
  },
};

const CLAUDE_CONNECTOR_REVIEW_READY = {
  schema_version: "connector-governance-claude-review-receipt.v1",
  review_engine: "claude_code_opus_max",
  receipt_status: "complete",
  scope_connector_external_app_governance: true,
  scope_id: "connector_external_app_governance",
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
    saasFactoryMode: P15400_READY,
    claudeConnectorGovernanceReviewReceipt: CLAUDE_CONNECTOR_REVIEW_READY,
    ...overrides,
  };
}

test("Connector And External App Governance builds registry, capability, consent, quarantine, evidence, boundary, Claude review, projection, authority, and freeze contracts through P15800", async () => {
  const result = await buildConnectorExternalAppGovernance(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "connector-external-app-governance.v1");
  assert.equal(result.program_range, "P15401-P15800");
  assert.equal(result.source_program_range, "P15001-P15400");
  assert.equal(result.summary.connector_external_app_governance_status, "ready_for_connector_external_app_governance");
  assert.equal(result.summary.external_app_registry_row_count, 6);
  assert.equal(result.summary.connector_capability_matrix_row_count, 6);
  assert.equal(result.summary.consent_auth_receipt_row_count, 6);
  assert.equal(result.summary.ingestion_quarantine_row_count, 6);
  assert.equal(result.summary.external_app_evidence_mapping_row_count, 6);
  assert.equal(result.summary.cross_app_boundary_guard_row_count, 6);
  assert.equal(result.summary.claude_connector_governance_review_receipt_present_now, true);
  assert.equal(result.summary.connector_read_only_projection_row_count, 6);
  assert.equal(result.summary.ready_for_p15801_handoff, true);
  assert.equal(result.summary.connector_write_enabled, false);
});

test("Connector And External App Governance covers every planned phase", async () => {
  const result = await buildConnectorExternalAppGovernance(options());
  const phases = new Set(result.connector_governance_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P15401-P15440", "P15441-P15480", "P15481-P15520", "P15521-P15560", "P15561-P15600", "P15601-P15640", "P15641-P15680", "P15681-P15720", "P15721-P15760", "P15761-P15800"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.connector_governance_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Connector And External App Governance defines connector rows without opening connection, credential, secret, raw export, ingestion, write, mutation, or final approval", async () => {
  const result = await buildConnectorExternalAppGovernance(options());

  assert.equal(result.connector_governance_source_binding_rows.length, 9);
  assert.equal(result.external_app_registry_rows.length, 6);
  assert.equal(result.connector_capability_matrix_rows.length, 6);
  assert.equal(result.consent_auth_receipt_rows.length, 6);
  assert.equal(result.ingestion_quarantine_rows.length, 6);
  assert.equal(result.external_app_evidence_mapping_rows.length, 6);
  assert.equal(result.cross_app_boundary_guard_rows.length, 6);
  assert.equal(result.claude_connector_governance_review_rows.length, 5);
  assert.equal(result.connector_read_only_projection_rows.length, 6);
  assert.equal(result.connector_authority_guard_rows.length, 8);

  assert.equal(result.external_app_registry_rows.every((row) => row.external_app_connection_allowed_now === false), true);
  assert.equal(result.connector_capability_matrix_rows.every((row) => row.connector_write_enabled === false && row.raw_export_allowed_now === false), true);
  assert.equal(result.consent_auth_receipt_rows.every((row) => row.credential_lookup_allowed_now === false && row.secret_read_allowed_now === false), true);
  assert.equal(result.ingestion_quarantine_rows.every((row) => row.ingestion_start_allowed_now === false && row.raw_source_exposure_allowed === false), true);
  assert.equal(result.external_app_evidence_mapping_rows.every((row) => row.raw_export_allowed_now === false), true);
  assert.equal(result.cross_app_boundary_guard_rows.every((row) => row.cross_app_data_join_allowed_now === false && row.raw_source_exposure_allowed === false), true);
  assert.equal(result.connector_read_only_projection_rows.every((row) => row.connector_execution_allowed_now === false && row.api_write_allowed_now === false), true);
  assert.equal(result.connector_authority_guard_rows.every((row) => row.external_app_connection_allowed_now === false && row.credential_lookup_allowed_now === false && row.secret_read_allowed_now === false && row.raw_export_allowed_now === false && row.ingestion_start_allowed_now === false && row.connector_write_enabled === false && row.external_service_mutation_allowed_now === false), true);
});

test("Connector And External App Governance preserves blocked P15400 source and missing Claude review without opening P15801 handoff", async () => {
  const result = await buildConnectorExternalAppGovernance(options({
    saasFactoryMode: P15400_BLOCKED,
    claudeConnectorGovernanceReviewReceipt: null,
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.connector_external_app_governance_status, "blocked_connector_external_app_governance");
  assert.equal(result.summary.source_ready_for_p15401_handoff, false);
  assert.equal(result.summary.source_block_visible_now, true);
  assert.equal(result.summary.claude_connector_governance_review_receipt_present_now, false);
  assert.equal(result.summary.claude_connector_governance_review_block_visible_now, true);
  assert.equal(result.summary.ready_for_p15801_handoff, false);
  assert.equal(result.connector_governance_source_binding_rows.find((row) => row.row_id === "source.handoff").current_verdict, "blocked");
  assert.equal(result.p15800_freeze_rows.find((row) => row.row_id === "freeze.source").current_verdict, "blocked");
  assert.equal(result.p15800_freeze_rows.find((row) => row.row_id === "freeze.claude_connector_governance_review").current_verdict, "blocked");
});

test("Connector And External App Governance keeps ready source blocked when Claude connector governance review evidence is missing", async () => {
  const result = await buildConnectorExternalAppGovernance(options({ claudeConnectorGovernanceReviewReceipt: null }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.source_ready_for_p15401_handoff, true);
  assert.equal(result.summary.claude_connector_governance_review_receipt_present_now, false);
  assert.equal(result.summary.ready_for_p15801_handoff, false);
});

test("Connector And External App Governance rejects weak or unsafe Claude review receipts at the module gate", async () => {
  const missingIntegrity = await buildConnectorExternalAppGovernance(options({
    claudeConnectorGovernanceReviewReceipt: {
      ...CLAUDE_CONNECTOR_REVIEW_READY,
      unresolved_finding_count: undefined,
    },
  }));
  assert.equal(missingIntegrity.summary.claude_connector_governance_review_receipt_present_now, false);
  assert.equal(missingIntegrity.summary.ready_for_p15801_handoff, false);

  const unsafeAuthority = await buildConnectorExternalAppGovernance(options({
    claudeConnectorGovernanceReviewReceipt: {
      ...CLAUDE_CONNECTOR_REVIEW_READY,
      production_pass_enabled: true,
    },
  }));
  assert.equal(unsafeAuthority.summary.claude_connector_governance_review_receipt_present_now, false);
  assert.equal(unsafeAuthority.summary.ready_for_p15801_handoff, false);

  const nestedAuthority = await buildConnectorExternalAppGovernance(options({
    claudeConnectorGovernanceReviewReceipt: {
      ...CLAUDE_CONNECTOR_REVIEW_READY,
      summary: {
        review_status: "complete",
        unresolved_finding_count: 0,
        production_pass_enabled: true,
      },
    },
  }));
  assert.equal(nestedAuthority.summary.claude_connector_governance_review_receipt_present_now, false);
  assert.equal(nestedAuthority.summary.ready_for_p15801_handoff, false);

  const labelOnlyModel = await buildConnectorExternalAppGovernance(options({
    claudeConnectorGovernanceReviewReceipt: {
      ...CLAUDE_CONNECTOR_REVIEW_READY,
      engine_resolved_model_id: "claude_code_opus_max",
    },
  }));
  assert.equal(labelOnlyModel.summary.claude_connector_governance_review_receipt_present_now, false);
  assert.equal(labelOnlyModel.summary.ready_for_p15801_handoff, false);

  for (const receiptPatch of [
    { schema_version: "wrong-schema" },
    { review_engine: "fable_5" },
    { scope_id: "execution_write_authority_maturity" },
    { reviewed_commit_sha: "not-a-sha" },
    { prompt_sha256: "not-a-hash" },
    { raw_output_sha256: "not-a-hash" },
    { unresolved_finding_count: null },
  ]) {
    const result = await buildConnectorExternalAppGovernance(options({
      claudeConnectorGovernanceReviewReceipt: {
        ...CLAUDE_CONNECTOR_REVIEW_READY,
        ...receiptPatch,
      },
    }));
    assert.equal(result.summary.claude_connector_governance_review_receipt_present_now, false);
    assert.equal(result.summary.ready_for_p15801_handoff, false);
  }

  const planningLane = await buildConnectorExternalAppGovernance(options({
    claudeConnectorGovernanceReviewReceipt: {
      ...CLAUDE_CONNECTOR_REVIEW_READY,
      review_lane: "fable_planning",
    },
  }));
  assert.equal(planningLane.summary.claude_connector_governance_review_receipt_present_now, false);
  assert.equal(planningLane.summary.ready_for_p15801_handoff, false);
});

test("Connector And External App Governance fails validation if P15400 source is missing", async () => {
  const result = await buildConnectorExternalAppGovernance(options({ saasFactoryMode: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.connector_external_app_governance_status, "blocked_connector_external_app_governance");
  assert.equal(result.connector_governance_boundary.source_saas_factory_available, false);
});

test("Connector And External App Governance boundary keeps external app, connector, raw exposure, release, write, and final approval closed", async () => {
  const result = await buildConnectorExternalAppGovernance(options());
  const boundary = result.connector_governance_boundary;

  assert.equal(boundary.external_app_connection_allowed_now, false);
  assert.equal(boundary.credential_lookup_allowed_now, false);
  assert.equal(boundary.secret_read_allowed_now, false);
  assert.equal(boundary.raw_export_allowed_now, false);
  assert.equal(boundary.raw_source_exposure_allowed, false);
  assert.equal(boundary.ingestion_start_allowed_now, false);
  assert.equal(boundary.connector_provisioning_allowed_now, false);
  assert.equal(boundary.connector_write_enabled, false);
  assert.equal(boundary.external_service_mutation_allowed_now, false);
  assert.equal(boundary.cross_app_data_join_allowed_now, false);
  assert.equal(boundary.deployment_allowed_now, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.enterprise_trust_claim_allowed_now, false);
  assert.equal(boundary.protected_closeout_enabled, false);
  assert.equal(boundary.release_approval_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.protected_action_allowed_now, false);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.codex_final_approval_ui_enabled, false);
  assert.equal(boundary.claude_final_approval_ui_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Connector And External App Governance HTML is read-only and avoids unsafe operations copy", async () => {
  const result = await buildConnectorExternalAppGovernance(options());

  assert.equal(/<form|<button|type="submit"|connect now|lookup credential|read secret|raw export now|start ingestion|write connector|mutate service|approve now|deploy now|production ready|enterprise pass|final approve/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
});

test("Connector And External App Governance --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "connector-external-app-governance-"));
  const sentinelPath = path.join(outDir, "connector-external-app-governance.json");
  const sentinel = "{ \"sentinel\": \"connector-external-app-governance\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runConnectorExternalAppGovernance(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
