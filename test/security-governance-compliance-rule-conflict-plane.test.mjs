import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildSecurityGovernanceComplianceRuleConflictPlane,
  runSecurityGovernanceComplianceRuleConflictPlane,
} from "../src/security-governance-compliance-rule-conflict-plane.mjs";

const RUN_AT = "2026-06-05T00:00:00.000Z";
const resultPromise = buildSecurityGovernanceComplianceRuleConflictPlane({ runAt: RUN_AT, write: false });

test("security governance consumes the retrieval recall layer", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.security_governance_compliance_rule_conflict_plane_status, "ready_for_security_governance_compliance_rule_conflict_plane_v0");
  assert.equal(result.program_range, "P7601-P7800");
  assert.equal(result.summary.retrieval_ontology_context_recall_layer_status, "ready_for_retrieval_ontology_context_recall_layer_v0");
});

test("security governance covers all P7601-P7800 phase rows", async () => {
  const result = await resultPromise;
  const phaseRanges = new Set(result.security_governance_compliance_rule_conflict_phase_rows.map((row) => row.phase_range));

  assert.equal(result.security_governance_compliance_rule_conflict_phase_rows.length, 10);
  for (const phase of ["P7601-P7620", "P7621-P7640", "P7641-P7660", "P7661-P7680", "P7681-P7700", "P7701-P7720", "P7721-P7740", "P7741-P7760", "P7761-P7780", "P7781-P7800"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.security_governance_compliance_rule_conflict_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("security governance requires the Codex-Harness-Claude review process", async () => {
  const result = await resultPromise;
  const contract = result.security_governance_compliance_rule_conflict_contract;
  const reviewPacket = result.claude_governance_review_packet_rows[0];

  assert.equal(contract.codex_implementation_packet_required, true);
  assert.equal(contract.harness_deterministic_validation_required, true);
  assert.equal(contract.claude_code_opus_max_review_receipt_required, true);
  assert.equal(contract.finding_loop_and_revalidation_required, true);
  assert.equal(contract.review_receipt_registration_required, true);
  assert.equal(contract.single_owner_trust_classification_required, true);
  assert.equal(reviewPacket.claude_code_opus_max_review_receipt_required, true);
  assert.equal(reviewPacket.reviewer_mutation_allowed, false);
  assert.equal(reviewPacket.reviewer_final_approval_allowed, false);
});

test("security governance blocks raw material leaks and prompt injection bypass", async () => {
  const result = await resultPromise;

  assert.equal(result.secret_raw_material_governance_rows.length, 6);
  assert.equal(result.secret_raw_material_governance_rows.every((row) => row.raw_default_access_enabled === false), true);
  assert.equal(result.secret_raw_material_governance_rows.every((row) => row.secret_leak_allowed === false), true);
  assert.equal(result.prompt_injection_tool_boundary_rows.length, 5);
  assert.equal(result.prompt_injection_tool_boundary_rows.every((row) => row.prompt_can_override_harness_policy === false), true);
  assert.equal(result.prompt_injection_tool_boundary_rows.every((row) => row.bypass_allowed === false), true);
});

test("security governance exposes rule conflicts and stale gates without auto trust", async () => {
  const result = await resultPromise;

  assert.equal(result.rule_conflict_graph_rows.length, 5);
  assert.equal(result.rule_conflict_graph_rows.every((row) => row.conflict_note_required), true);
  assert.equal(result.rule_conflict_graph_rows.every((row) => row.auto_resolve_allowed === false), true);
  assert.equal(result.stale_gate_policy_drift_rows.length, 5);
  assert.equal(result.stale_gate_policy_drift_rows.every((row) => row.revalidation_required), true);
  assert.equal(result.stale_gate_policy_drift_rows.every((row) => row.stale_pass_allowed === false), true);
});

test("security governance registers compliance packs and UI queues as blockers, not certifications", async () => {
  const result = await resultPromise;

  assert.equal(result.compliance_pack_registry_rows.length, 6);
  assert.equal(result.compliance_pack_registry_rows.every((row) => row.evidence_required), true);
  assert.equal(result.compliance_pack_registry_rows.every((row) => row.certification_claim_allowed === false), true);
  assert.equal(result.compliance_pack_registry_rows.every((row) => row.compliance_theater_allowed === false), true);
  assert.equal(result.governance_ui_rows.length, 6);
  assert.equal(result.governance_ui_rows.every((row) => row.hard_blocker_visible), true);
  assert.equal(result.governance_ui_rows.every((row) => row.kpi_only_surface_allowed === false), true);
});

test("security governance negative fixtures block unsafe governance claims", async () => {
  const result = await resultPromise;
  const fixtureIds = new Set(result.governance_negative_fixture_rows.map((row) => row.fixture_id));

  assert.equal(result.governance_negative_fixture_rows.length, 8);
  for (const fixture of ["negative.policy_override", "negative.stale_pass", "negative.secret_leak", "negative.rule_conflict_auto_resolve", "negative.prompt_injection", "negative.compliance_theater", "negative.claude_mutates_policy", "negative.no_human_as_governance_closeout"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.governance_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.governance_negative_fixture_rows.every((row) => row.unsafe_governance_claim_allowed === false), true);
});

test("security governance remains no-human, no-reviewer-mutation, no-enterprise, and no-Work-OS", async () => {
  const result = await resultPromise;
  const boundary = result.security_governance_boundary;

  assert.equal(boundary.security_governance_compliance_rule_conflict_plane_ready, true);
  assert.equal(boundary.policy_override_allowed, false);
  assert.equal(boundary.secret_leak_allowed, false);
  assert.equal(boundary.prompt_injection_bypass_allowed, false);
  assert.equal(boundary.stale_pass_allowed, false);
  assert.equal(boundary.rule_conflict_auto_resolve_allowed, false);
  assert.equal(boundary.compliance_theater_allowed, false);
  assert.equal(boundary.reviewer_mutation_allowed, false);
  assert.equal(boundary.human_adjudication_in_milestone_gate, false);
  assert.equal(boundary.protected_closeout_enabled, false);
  assert.equal(boundary.enterprise_trust_claim_enabled, false);
  assert.equal(boundary.agent_runtime_execution_enabled, false);
  assert.equal(boundary.write_action_enabled, false);
  assert.equal(boundary.protected_action_enabled, false);
  assert.equal(boundary.work_os_claim_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("security governance --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "security-governance-compliance-rule-conflict-plane-"));
  const sentinelPath = path.join(outDir, "security-governance-compliance-rule-conflict-plane.json");
  const sentinel = "{ \"sentinel\": \"security-governance-compliance-rule-conflict-plane\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runSecurityGovernanceComplianceRuleConflictPlane({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
