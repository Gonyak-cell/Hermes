import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildMultiEngineOrchestration,
  runMultiEngineOrchestration,
} from "../src/multi-engine-orchestration.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P14600_READY = {
  schema_version: "security-compliance-maturity.v1",
  program_range: "P14201-P14600",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    security_compliance_maturity_status: "ready_for_security_compliance_maturity",
    ready_for_p14601_handoff: true,
    soc2_control_signal_row_count: 6,
    secret_scanning_signal_row_count: 6,
    compliance_evidence_link_row_count: 6,
    compliance_pass_enabled: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  security_compliance_boundary: {
    ready_for_p14601_handoff: true,
    secret_read_allowed_now: false,
    raw_secret_exposure_allowed: false,
    destructive_delete_allowed_now: false,
    compliance_pass_enabled: false,
    connector_write_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    production_pass_enabled: false,
    deployment_allowed_now: false,
    write_action_allowed_now: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
  },
};

const P14600_BLOCKED = {
  schema_version: "security-compliance-maturity.v1",
  program_range: "P14201-P14600",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    security_compliance_maturity_status: "blocked_security_compliance_maturity",
    ready_for_p14601_handoff: false,
    soc2_control_signal_row_count: 6,
    secret_scanning_signal_row_count: 6,
    compliance_evidence_link_row_count: 6,
    compliance_pass_enabled: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  security_compliance_boundary: {
    ready_for_p14601_handoff: false,
    secret_read_allowed_now: false,
    raw_secret_exposure_allowed: false,
    destructive_delete_allowed_now: false,
    compliance_pass_enabled: false,
    connector_write_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    production_pass_enabled: false,
    deployment_allowed_now: false,
    write_action_allowed_now: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
  },
};

const CLAUDE_ORCHESTRATION_REVIEW_READY = {
  schema_version: "multi-engine-claude-review-receipt.v1",
  review_engine: "claude_code_opus_max",
  receipt_status: "complete",
  scope_multi_engine_orchestration: true,
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
    securityComplianceMaturity: P14600_READY,
    claudeOrchestrationReviewReceipt: CLAUDE_ORCHESTRATION_REVIEW_READY,
    ...overrides,
  };
}

test("Multi-Engine Orchestration builds engine, role, routing, evidence, conflict, Claude review, projection, authority, and freeze contracts through P15000", async () => {
  const result = await buildMultiEngineOrchestration(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "multi-engine-orchestration.v1");
  assert.equal(result.program_range, "P14601-P15000");
  assert.equal(result.source_program_range, "P14201-P14600");
  assert.equal(result.summary.multi_engine_orchestration_status, "ready_for_multi_engine_orchestration");
  assert.equal(result.summary.engine_registry_row_count, 6);
  assert.equal(result.summary.role_authority_matrix_row_count, 6);
  assert.equal(result.summary.routing_decision_contract_row_count, 6);
  assert.equal(result.summary.evidence_class_mapping_row_count, 6);
  assert.equal(result.summary.cross_engine_conflict_guard_row_count, 6);
  assert.equal(result.summary.claude_orchestration_review_receipt_present_now, true);
  assert.equal(result.summary.ready_for_p15001_handoff, true);
  assert.equal(result.summary.cross_engine_final_approval_allowed_now, false);
});

test("Multi-Engine Orchestration covers every planned phase", async () => {
  const result = await buildMultiEngineOrchestration(options());
  const phases = new Set(result.multi_engine_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P14601-P14640", "P14641-P14680", "P14681-P14720", "P14721-P14760", "P14761-P14800", "P14801-P14840", "P14841-P14880", "P14881-P14920", "P14921-P14960", "P14961-P15000"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.multi_engine_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Multi-Engine Orchestration defines engine rows without opening final approval or engine execution", async () => {
  const result = await buildMultiEngineOrchestration(options());

  assert.equal(result.multi_engine_source_binding_rows.length, 8);
  assert.equal(result.engine_registry_rows.length, 6);
  assert.equal(result.role_authority_matrix_rows.length, 6);
  assert.equal(result.routing_decision_contract_rows.length, 6);
  assert.equal(result.evidence_class_mapping_rows.length, 6);
  assert.equal(result.cross_engine_conflict_guard_rows.length, 6);
  assert.equal(result.claude_orchestration_review_rows.length, 5);
  assert.equal(result.multi_engine_projection_rows.length, 6);
  assert.equal(result.orchestration_authority_guard_rows.length, 10);

  assert.equal(result.engine_registry_rows.every((row) => row.engine_execution_allowed_now === false), true);
  assert.equal(result.role_authority_matrix_rows.every((row) => row.cross_engine_final_approval_allowed_now === false), true);
  assert.equal(result.routing_decision_contract_rows.every((row) => row.protected_action_routing_allowed_now === false), true);
  assert.equal(result.evidence_class_mapping_rows.every((row) => row.raw_transcript_exposure_allowed === false && row.raw_source_exposure_allowed === false), true);
  assert.equal(result.cross_engine_conflict_guard_rows.every((row) => row.self_review_approval_allowed_now === false && row.reviewer_independence_required === true), true);
  assert.equal(result.multi_engine_projection_rows.every((row) => row.engine_execution_allowed_now === false && row.route_mutation_allowed_now === false), true);
  assert.equal(result.orchestration_authority_guard_rows.every((row) => row.cross_engine_final_approval_allowed_now === false && row.production_pass_enabled === false && row.enterprise_trust_claim_allowed_now === false), true);
});

test("Multi-Engine Orchestration preserves blocked P14600 source and missing Claude orchestration review without opening P15001 handoff", async () => {
  const result = await buildMultiEngineOrchestration(options({
    securityComplianceMaturity: P14600_BLOCKED,
    claudeOrchestrationReviewReceipt: null,
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.multi_engine_orchestration_status, "blocked_multi_engine_orchestration");
  assert.equal(result.summary.source_ready_for_p14601_handoff, false);
  assert.equal(result.summary.source_block_visible_now, true);
  assert.equal(result.summary.claude_orchestration_review_receipt_present_now, false);
  assert.equal(result.summary.claude_orchestration_review_block_visible_now, true);
  assert.equal(result.summary.ready_for_p15001_handoff, false);
  assert.equal(result.multi_engine_source_binding_rows.find((row) => row.row_id === "source.handoff").current_verdict, "blocked");
  assert.equal(result.p15000_freeze_rows.find((row) => row.row_id === "freeze.source").current_verdict, "blocked");
  assert.equal(result.p15000_freeze_rows.find((row) => row.row_id === "freeze.claude_orchestration_review").current_verdict, "blocked");
});

test("Multi-Engine Orchestration keeps ready source blocked when Claude orchestration review evidence is missing", async () => {
  const result = await buildMultiEngineOrchestration(options({ claudeOrchestrationReviewReceipt: null }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.source_ready_for_p14601_handoff, true);
  assert.equal(result.summary.claude_orchestration_review_receipt_present_now, false);
  assert.equal(result.summary.ready_for_p15001_handoff, false);
});

test("Multi-Engine Orchestration fails validation if P14600 source is missing", async () => {
  const result = await buildMultiEngineOrchestration(options({ securityComplianceMaturity: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.multi_engine_orchestration_status, "blocked_multi_engine_orchestration");
  assert.equal(result.multi_engine_boundary.source_security_compliance_available, false);
});

test("Multi-Engine Orchestration boundary keeps engine authority, raw exposure, release, connector write, and final approval closed", async () => {
  const result = await buildMultiEngineOrchestration(options());
  const boundary = result.multi_engine_boundary;

  assert.equal(boundary.cross_engine_final_approval_allowed_now, false);
  assert.equal(boundary.self_review_approval_allowed_now, false);
  assert.equal(boundary.reviewer_mutation_allowed_now, false);
  assert.equal(boundary.ci_authority_escalation_allowed_now, false);
  assert.equal(boundary.local_advisory_final_approval_allowed_now, false);
  assert.equal(boundary.protected_action_routing_allowed_now, false);
  assert.equal(boundary.engine_execution_allowed_now, false);
  assert.equal(boundary.raw_transcript_exposure_allowed, false);
  assert.equal(boundary.raw_source_exposure_allowed, false);
  assert.equal(boundary.enterprise_trust_claim_allowed_now, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.protected_closeout_enabled, false);
  assert.equal(boundary.deployment_allowed_now, false);
  assert.equal(boundary.release_approval_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.protected_action_allowed_now, false);
  assert.equal(boundary.connector_write_enabled, false);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.codex_final_approval_ui_enabled, false);
  assert.equal(boundary.claude_final_approval_ui_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Multi-Engine Orchestration HTML is read-only and avoids unsafe operations copy", async () => {
  const result = await buildMultiEngineOrchestration(options());

  assert.equal(/<form|<button|type="submit"|final approve|self-review approve|mutate reviewer|escalate ci|execute engine|route protected action|approve now|deploy now|release now|enterprise approved|production ready|enterprise pass/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
});

test("Multi-Engine Orchestration --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "multi-engine-orchestration-"));
  const sentinelPath = path.join(outDir, "multi-engine-orchestration.json");
  const sentinel = "{ \"sentinel\": \"multi-engine-orchestration\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runMultiEngineOrchestration(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
