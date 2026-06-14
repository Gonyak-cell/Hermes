import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildMultiEngineOrchestrationQa,
  runMultiEngineOrchestrationQa,
} from "../src/multi-engine-orchestration-qa.mjs";

const RUN_AT = "2026-06-05T00:00:00.000Z";
const resultPromise = buildMultiEngineOrchestrationQa({ runAt: RUN_AT, write: false });

test("multi-engine orchestration QA consumes P5400 verification runtime", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.multi_engine_orchestration_qa_status, "ready_for_multi_engine_orchestration_qa_v0");
  assert.equal(result.program_range, "P5401-P5800");
  assert.equal(result.summary.verification_orchestration_runtime_status, "ready_for_verification_orchestration_runtime_v0");
});

test("multi-engine orchestration QA covers all P5401-P5800 phase rows", async () => {
  const result = await resultPromise;
  const phaseRanges = new Set(result.multi_engine_phase_rows.map((row) => row.phase_range));

  assert.equal(result.multi_engine_phase_rows.length, 10);
  for (const phase of ["P5401-P5440", "P5441-P5480", "P5481-P5520", "P5521-P5560", "P5561-P5600", "P5601-P5640", "P5641-P5680", "P5681-P5720", "P5721-P5760", "P5761-P5800"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.multi_engine_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("multi-engine orchestration QA registers primary, reviewer, validator, observer, and candidate engines", async () => {
  const result = await resultPromise;
  const roles = new Set(result.engine_registry_rows.map((row) => row.engine_role));

  assert.equal(result.engine_registry_rows.length, 5);
  assert.equal(roles.has("PRIMARY_DEVELOPER"), true);
  assert.equal(roles.has("DETERMINISTIC_VALIDATOR"), true);
  assert.equal(roles.has("INDEPENDENT_REVIEWER"), true);
  assert.equal(roles.has("EXTERNAL_EVIDENCE_OBSERVER"), true);
  assert.equal(roles.has("MODEL_UPGRADE_CANDIDATE"), true);
  assert.equal(result.engine_registry_rows.every((row) => row.can_review_own_work === false), true);
  assert.equal(result.engine_registry_rows.every((row) => row.can_finally_approve === false), true);
});

test("multi-engine orchestration QA splits planner, implementer, validator, reviewer, evidence, and conflict roles", async () => {
  const result = await resultPromise;
  const roleIds = new Set(result.role_assignment_rows.map((row) => row.role_id));

  assert.equal(result.role_assignment_rows.length, 6);
  for (const role of ["role.planner", "role.implementer", "role.validator", "role.independent_reviewer", "role.evidence_summarizer", "role.conflict_resolver"]) {
    assert.equal(roleIds.has(role), true);
  }
  assert.equal(result.role_assignment_rows.every((row) => row.self_approval_allowed === false), true);
  assert.equal(result.role_assignment_rows.every((row) => row.final_approval_allowed === false), true);
});

test("multi-engine orchestration QA prepares cross-model QA packet without completing closeout", async () => {
  const result = await resultPromise;
  const packet = result.cross_model_qa_packet_rows[0];

  assert.equal(packet.qa_packet_status, "READY_FOR_CLAUDE_REVIEW");
  assert.equal(packet.qa_packet_completed_now, false);
  assert.equal(packet.claude_review_receipt_required, true);
  assert.equal(packet.durable_raw_json_required, true);
  assert.equal(packet.self_approval_allowed, false);
  assert.equal(packet.reviewer_mutation_allowed, false);
  assert.equal(packet.human_adjudication_required, false);
});

test("multi-engine orchestration QA requires model upgrade receipts", async () => {
  const result = await resultPromise;
  const row = result.model_upgrade_receipt_rows[0];

  assert.equal(row.current_reviewer_model_alias, "claude-code-opus-max");
  assert.equal(row.latest_model_monitor_required, true);
  assert.equal(row.upgrade_applied_now, false);
  assert.equal(row.upgrade_allowed_without_receipt, false);
  assert.equal(row.compatibility_review_required, true);
});

test("multi-engine orchestration QA blocks engine conflicts and reviewer mutation", async () => {
  const result = await resultPromise;

  assert.equal(result.engine_conflict_resolution_rows.length, 5);
  assert.equal(result.engine_conflict_resolution_rows.every((row) => row.auto_pass_allowed === false), true);
  assert.equal(result.engine_conflict_resolution_rows.every((row) => row.self_approval_allowed === false), true);
  assert.equal(result.reviewer_boundary_rows.length, 5);
  assert.equal(result.reviewer_boundary_rows.every((row) => row.allowed === false), true);
  assert.equal(result.reviewer_boundary_rows.every((row) => row.boundary_status === "ENFORCED_BY_CONTRACT"), true);
});

test("multi-engine orchestration QA separates contract readiness from P5800 closeout", async () => {
  const result = await resultPromise;
  const decision = result.multi_engine_trust_decision_rows[0];

  assert.equal(decision.local_contract_readiness, true);
  assert.equal(decision.completed_cross_model_review_ready, false);
  assert.equal(decision.p5800_milestone_closeout_ready, false);
  assert.equal(decision.lower_trust_readiness_allowed, true);
  assert.equal(decision.self_approval_allowed, false);
  assert.equal(decision.enterprise_trust_claim_allowed, false);
  assert.equal(decision.human_adjudication_required, false);
  assert.equal(decision.protected_closeout_enabled, false);
});

test("multi-engine orchestration QA remains no-human, no-self-approval, no-enterprise, no-runtime, no-write", async () => {
  const result = await resultPromise;
  const boundary = result.multi_engine_qa_boundary;

  assert.equal(boundary.multi_engine_orchestration_qa_ready, true);
  assert.equal(boundary.p5800_milestone_closeout_ready, false);
  assert.equal(boundary.self_approval_allowed, false);
  assert.equal(boundary.codex_final_approval_allowed, false);
  assert.equal(boundary.claude_final_approval_allowed, false);
  assert.equal(boundary.reviewer_mutation_allowed, false);
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

test("multi-engine orchestration QA --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "multi-engine-orchestration-qa-"));
  const sentinelPath = path.join(outDir, "multi-engine-orchestration-qa.json");
  const sentinel = "{ \"sentinel\": \"multi-engine-orchestration-qa\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runMultiEngineOrchestrationQa({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
