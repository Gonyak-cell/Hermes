import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildSaasFactoryMode,
  runSaasFactoryMode,
} from "../src/saas-factory-mode.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const OWNER_ADJUDICATION_RECEIPT = {
  receipt_id: "rcpt-s0-owner-adjudication-20260611",
  receipt_kind: "human_owner_adjudication",
  adjudicated_decisions: [
    {
      decision_id: "S0-2",
      receipt_id: "rcpt-s0-2-corrective-baseline-waiver-20260611",
      decision: "corrective_baseline_waiver",
      expires_before: "FA.6 freeze",
    },
  ],
  authority_flags: {
    project_creation_allowed_now: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    command_execution_allowed_now: false,
    api_write_methods_allowed_now: false,
    store_mutation_allowed_now: false,
    codex_final_approval_allowed: false,
    claude_final_approval_allowed: false,
    fable_final_approval_allowed: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
  scope: {
    program: "Hermes Factory Promotion",
    stage: "S0",
  },
};

const P15000_READY = {
  schema_version: "multi-engine-orchestration.v1",
  program_range: "P14601-P15000",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    multi_engine_orchestration_status: "ready_for_multi_engine_orchestration",
    ready_for_p15001_handoff: true,
    engine_registry_row_count: 6,
    role_authority_matrix_row_count: 6,
    routing_decision_contract_row_count: 6,
    cross_engine_final_approval_allowed_now: false,
    engine_execution_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  multi_engine_boundary: {
    ready_for_p15001_handoff: true,
    cross_engine_final_approval_allowed_now: false,
    self_review_approval_allowed_now: false,
    engine_execution_allowed_now: false,
    protected_action_routing_allowed_now: false,
    raw_source_exposure_allowed: false,
    enterprise_trust_claim_allowed_now: false,
    production_pass_enabled: false,
    deployment_allowed_now: false,
    write_action_allowed_now: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
    connector_write_enabled: false,
  },
};

const P15000_BLOCKED = {
  schema_version: "multi-engine-orchestration.v1",
  program_range: "P14601-P15000",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    multi_engine_orchestration_status: "blocked_multi_engine_orchestration",
    ready_for_p15001_handoff: false,
    engine_registry_row_count: 6,
    role_authority_matrix_row_count: 6,
    routing_decision_contract_row_count: 6,
    cross_engine_final_approval_allowed_now: false,
    engine_execution_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  multi_engine_boundary: {
    ready_for_p15001_handoff: false,
    cross_engine_final_approval_allowed_now: false,
    self_review_approval_allowed_now: false,
    engine_execution_allowed_now: false,
    protected_action_routing_allowed_now: false,
    raw_source_exposure_allowed: false,
    enterprise_trust_claim_allowed_now: false,
    production_pass_enabled: false,
    deployment_allowed_now: false,
    write_action_allowed_now: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
    connector_write_enabled: false,
  },
};

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    multiEngineOrchestration: P15000_READY,
    ownerAdjudicationReceipt: OWNER_ADJUDICATION_RECEIPT,
    ...overrides,
  };
}

test("SaaS Factory Mode builds template, requirement, validation, review, domain, release, projection, authority, and freeze contracts through P15400", async () => {
  const result = await buildSaasFactoryMode(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "saas-factory-mode.v1");
  assert.equal(result.program_range, "P15001-P15400");
  assert.equal(result.source_program_range, "P14601-P15000");
  assert.equal(result.summary.saas_factory_mode_status, "ready_for_saas_factory_mode");
  assert.equal(result.summary.project_template_contract_row_count, 6);
  assert.equal(result.summary.requirement_matrix_contract_row_count, 6);
  assert.equal(result.summary.validation_plan_contract_row_count, 6);
  assert.equal(result.summary.review_lane_contract_row_count, 6);
  assert.equal(result.summary.domain_pack_composition_row_count, 6);
  assert.equal(result.summary.release_gate_blueprint_row_count, 6);
  assert.equal(result.summary.bootstrap_projection_row_count, 6);
  assert.equal(result.summary.ready_for_p15401_handoff, true);
  assert.equal(result.summary.repo_write_allowed_now, false);
});

test("SaaS Factory Mode covers every planned phase", async () => {
  const result = await buildSaasFactoryMode(options());
  const phases = new Set(result.saas_factory_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P15001-P15040", "P15041-P15080", "P15081-P15120", "P15121-P15160", "P15161-P15200", "P15201-P15240", "P15241-P15280", "P15281-P15320", "P15321-P15360", "P15361-P15400"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.saas_factory_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("SaaS Factory Mode defines factory rows without opening project, repo, secret, connector, deployment, trust, or final approval", async () => {
  const result = await buildSaasFactoryMode(options());

  assert.equal(result.saas_factory_source_binding_rows.length, 9);
  assert.equal(result.project_template_contract_rows.length, 6);
  assert.equal(result.requirement_matrix_contract_rows.length, 6);
  assert.equal(result.validation_plan_contract_rows.length, 6);
  assert.equal(result.review_lane_contract_rows.length, 6);
  assert.equal(result.domain_pack_composition_rows.length, 6);
  assert.equal(result.release_gate_blueprint_rows.length, 6);
  assert.equal(result.bootstrap_projection_rows.length, 6);
  assert.equal(result.factory_authority_guard_rows.length, 8);

  assert.equal(result.project_template_contract_rows.every((row) => row.project_creation_allowed_now === false && row.repo_write_allowed_now === false), true);
  assert.equal(result.review_lane_contract_rows.every((row) => row.final_approval_allowed_now === false), true);
  assert.equal(result.release_gate_blueprint_rows.every((row) => row.production_pass_enabled === false && row.deployment_allowed_now === false && row.auto_deploy_allowed_now === false), true);
  assert.equal(result.bootstrap_projection_rows.every((row) => row.project_creation_allowed_now === false && row.api_write_allowed_now === false), true);
  assert.equal(result.factory_authority_guard_rows.every((row) => row.project_creation_allowed_now === false && row.repo_write_allowed_now === false && row.secret_generation_allowed_now === false && row.connector_provisioning_allowed_now === false && row.deployment_allowed_now === false && row.production_pass_enabled === false && row.enterprise_trust_claim_allowed_now === false), true);
});

test("SaaS Factory Mode preserves blocked P15000 source without opening P15401 handoff", async () => {
  const result = await buildSaasFactoryMode(options({ multiEngineOrchestration: P15000_BLOCKED }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.saas_factory_mode_status, "blocked_saas_factory_mode");
  assert.equal(result.summary.source_ready_for_p15001_handoff, false);
  assert.equal(result.summary.source_block_visible_now, true);
  assert.equal(result.summary.fcore_corrective_baseline_waiver_visible_now, true);
  assert.equal(result.summary.source_blocker_waived_for_fcore_corrective_baseline_now, true);
  assert.equal(result.summary.f0_2_source_handoff_or_visible_waiver_now, true);
  assert.equal(result.summary.ready_for_p15401_handoff, false);
  assert.equal(result.saas_factory_source_binding_rows.find((row) => row.row_id === "source.handoff").current_verdict, "blocked");
  assert.equal(result.fcore_corrective_baseline_waiver_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.p15400_freeze_rows.find((row) => row.row_id === "freeze.source").current_verdict, "blocked");
  assert.equal(result.p15400_freeze_rows.find((row) => row.row_id === "freeze.source_block_visible").current_verdict, "pass");
  assert.equal(result.p15400_freeze_rows.find((row) => row.row_id === "freeze.fcore_corrective_baseline_waiver_visible").current_verdict, "pass");
});

test("SaaS Factory Mode fails validation if P15000 source is missing", async () => {
  const result = await buildSaasFactoryMode(options({ multiEngineOrchestration: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.saas_factory_mode_status, "blocked_saas_factory_mode");
  assert.equal(result.saas_factory_boundary.source_multi_engine_available, false);
});

test("SaaS Factory Mode boundary keeps project creation, repo write, secret generation, connector provisioning, release, runtime, raw exposure, and final approval closed", async () => {
  const result = await buildSaasFactoryMode(options());
  const boundary = result.saas_factory_boundary;

  assert.equal(boundary.project_creation_allowed_now, false);
  assert.equal(boundary.repo_write_allowed_now, false);
  assert.equal(boundary.secret_generation_allowed_now, false);
  assert.equal(boundary.connector_provisioning_allowed_now, false);
  assert.equal(boundary.deployment_allowed_now, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.enterprise_trust_claim_allowed_now, false);
  assert.equal(boundary.protected_closeout_enabled, false);
  assert.equal(boundary.release_approval_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.protected_action_allowed_now, false);
  assert.equal(boundary.connector_write_enabled, false);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.raw_source_exposure_allowed, false);
  assert.equal(boundary.codex_final_approval_ui_enabled, false);
  assert.equal(boundary.claude_final_approval_ui_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("SaaS Factory Mode HTML is read-only and avoids unsafe operations copy", async () => {
  const result = await buildSaasFactoryMode(options());

  assert.equal(/<form|<button|type="submit"|create project|write repo|generate secret|provision connector|deploy now|production ready|enterprise pass|final approve/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
});

test("SaaS Factory Mode --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "saas-factory-mode-"));
  const sentinelPath = path.join(outDir, "saas-factory-mode.json");
  const sentinel = "{ \"sentinel\": \"saas-factory-mode\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runSaasFactoryMode(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
