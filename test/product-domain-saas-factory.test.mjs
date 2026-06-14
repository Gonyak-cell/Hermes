import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildProductDomainSaasFactory,
  runProductDomainSaasFactory,
} from "../src/product-domain-saas-factory.mjs";

const RUN_AT = "2026-06-05T00:00:00.000Z";
const resultPromise = buildProductDomainSaasFactory({ runAt: RUN_AT, write: false });

test("product domain SaaS factory consumes P6200 review trust hardening", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.product_domain_saas_factory_status, "ready_for_product_domain_saas_factory_v0");
  assert.equal(result.program_range, "P6201-P6600");
  assert.equal(result.summary.review_enterprise_trust_hardening_status, "ready_for_review_enterprise_trust_hardening_v0");
});

test("product domain SaaS factory covers all P6201-P6600 phase rows", async () => {
  const result = await resultPromise;
  const phaseRanges = new Set(result.product_domain_saas_factory_phase_rows.map((row) => row.phase_range));

  assert.equal(result.product_domain_saas_factory_phase_rows.length, 10);
  for (const phase of ["P6201-P6240", "P6241-P6280", "P6281-P6320", "P6321-P6360", "P6361-P6400", "P6401-P6440", "P6441-P6480", "P6481-P6520", "P6521-P6560", "P6561-P6600"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.product_domain_saas_factory_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("product domain SaaS factory registers HR, Law Firm OS, Hermes, and Zendd control plans", async () => {
  const result = await resultPromise;
  const projectIds = new Set(result.saas_project_intake_rows.map((row) => row.project_id));

  assert.equal(result.saas_project_intake_rows.length, 4);
  for (const projectId of ["project.hr_solution_internalization", "project.law_firm_os", "project.hermes_harness", "project.zendd_bridge"]) {
    assert.equal(projectIds.has(projectId), true);
  }
  assert.equal(result.saas_project_intake_rows.every((row) => row.intake_status === "READY_FOR_CONTROL_PLAN"), true);
  assert.equal(result.saas_project_intake_rows.every((row) => row.raw_sensitive_data_allowed === false), true);
  assert.equal(result.saas_project_intake_rows.every((row) => row.external_project_write_allowed === false), true);
  assert.equal(result.saas_project_intake_rows.every((row) => row.product_launch_allowed === false), true);
});

test("product domain SaaS factory requires requirement traceability before release claims", async () => {
  const result = await resultPromise;

  assert.equal(result.requirement_traceability_rows.length, 4);
  assert.equal(result.requirement_traceability_rows.every((row) => row.requirement_inventory_required), true);
  assert.equal(result.requirement_traceability_rows.every((row) => row.acceptance_criteria_required), true);
  assert.equal(result.requirement_traceability_rows.every((row) => row.phase_mapping_required), true);
  assert.equal(result.requirement_traceability_rows.every((row) => row.evidence_mapping_required), true);
  assert.equal(result.requirement_traceability_rows.every((row) => row.claude_review_receipt_required), true);
  assert.equal(result.requirement_traceability_rows.every((row) => row.launch_without_trace_allowed === false), true);
});

test("product domain SaaS factory registers domain packs as control-plan only", async () => {
  const result = await resultPromise;
  const packIds = new Set(result.domain_pack_factory_rows.map((row) => row.domain_pack_id));

  assert.equal(result.domain_pack_factory_rows.length, 5);
  for (const packId of ["domain.personal_dev", "domain.law_firm", "domain.creative_document", "domain.connectors_resource", "domain.trading_read_only"]) {
    assert.equal(packIds.has(packId), true);
  }
  assert.equal(result.domain_pack_factory_rows.every((row) => row.rollout_level === "CONTROL_PLAN_ONLY"), true);
  assert.equal(result.domain_pack_factory_rows.every((row) => row.runtime_execution_allowed === false), true);
  assert.equal(result.domain_pack_factory_rows.every((row) => row.write_action_allowed === false), true);
  assert.equal(result.domain_pack_factory_rows.every((row) => row.protected_action_allowed === false), true);
});

test("product domain SaaS factory binds the Codex-Harness-Claude review process", async () => {
  const result = await resultPromise;
  const stepIds = result.review_process_binding_rows.map((row) => row.step_id);

  assert.deepEqual(stepIds, [
    "step.codex_implementation_packet",
    "step.harness_deterministic_validation",
    "step.claude_review_receipt",
    "step.finding_loop_revalidation",
    "step.receipt_registration",
    "step.single_owner_trust_classification",
  ]);
  assert.equal(result.review_process_binding_rows.every((row) => row.applies_to_all_factory_projects), true);
  assert.equal(result.review_process_binding_rows.every((row) => row.codex_self_approval_allowed === false), true);
  assert.equal(result.review_process_binding_rows.every((row) => row.claude_final_approval_allowed === false), true);
  assert.equal(result.review_process_binding_rows.every((row) => row.reviewer_mutation_allowed === false), true);
  assert.equal(result.review_process_binding_rows.every((row) => row.human_adjudication_in_milestone_gate === false), true);
});

test("product domain SaaS factory exposes read-only UI surfaces for multi-SaaS control", async () => {
  const result = await resultPromise;

  assert.equal(result.factory_ui_surface_rows.length, 8);
  assert.equal(result.factory_ui_surface_rows.some((row) => row.surface_id === "surface.project_portfolio" && row.queue_first), true);
  assert.equal(result.factory_ui_surface_rows.some((row) => row.surface_id === "surface.requirement_traceability" && row.shows_requirement_trace), true);
  assert.equal(result.factory_ui_surface_rows.every((row) => row.shows_review_process), true);
  assert.equal(result.factory_ui_surface_rows.every((row) => row.shows_block_reason), true);
  assert.equal(result.factory_ui_surface_rows.every((row) => row.shows_next_allowed_action), true);
  assert.equal(result.factory_ui_surface_rows.every((row) => row.writes_product_state === false), true);
  assert.equal(result.factory_ui_surface_rows.every((row) => row.launches_product === false), true);
});

test("product domain SaaS factory blocks vertical-SaaS, launch, self-approval, and raw sensitive data claims", async () => {
  const result = await resultPromise;
  const fixtureIds = new Set(result.factory_negative_fixture_rows.map((row) => row.fixture_id));

  assert.equal(result.factory_negative_fixture_rows.length, 7);
  for (const fixture of ["negative.hermes_as_single_vertical_saas", "negative.launch_without_requirement_trace", "negative.codex_self_approval", "negative.claude_as_product_approver", "negative.no_human_as_launch_authority", "negative.raw_sensitive_hr_data", "negative.external_project_write"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.factory_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.factory_negative_fixture_rows.every((row) => row.unsafe_factory_claim_allowed === false), true);
});

test("product domain SaaS factory remains lower-trust, no-human, no-launch, no-write, and no-Work-OS", async () => {
  const result = await resultPromise;
  const boundary = result.product_domain_saas_factory_boundary;

  assert.equal(boundary.product_domain_saas_factory_ready, true);
  assert.equal(boundary.multi_project_saas_governance_ready, true);
  assert.equal(boundary.hr_saas_control_plan_ready, true);
  assert.equal(boundary.law_firm_saas_control_plan_ready, true);
  assert.equal(boundary.requirement_traceability_contract_ready, true);
  assert.equal(boundary.codex_harness_claude_review_process_bound, true);
  assert.equal(boundary.single_owner_lower_trust_mode, true);
  assert.equal(boundary.hermes_vertical_saas_claim_enabled, false);
  assert.equal(boundary.saas_product_launch_enabled, false);
  assert.equal(boundary.external_project_write_enabled, false);
  assert.equal(boundary.raw_sensitive_data_ingestion_enabled, false);
  assert.equal(boundary.human_adjudication_in_milestone_gate, false);
  assert.equal(boundary.protected_closeout_enabled, false);
  assert.equal(boundary.protected_final_decision_enabled, false);
  assert.equal(boundary.enterprise_trust_claim_enabled, false);
  assert.equal(boundary.agent_runtime_execution_enabled, false);
  assert.equal(boundary.write_action_enabled, false);
  assert.equal(boundary.protected_action_enabled, false);
  assert.equal(boundary.work_os_claim_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("product domain SaaS factory --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "product-domain-saas-factory-"));
  const sentinelPath = path.join(outDir, "product-domain-saas-factory.json");
  const sentinel = "{ \"sentinel\": \"product-domain-saas-factory\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runProductDomainSaasFactory({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
