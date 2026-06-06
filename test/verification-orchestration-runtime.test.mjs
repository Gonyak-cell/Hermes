import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildVerificationOrchestrationRuntime,
  runVerificationOrchestrationRuntime,
} from "../src/verification-orchestration-runtime.mjs";

const RUN_AT = "2026-06-05T00:00:00.000Z";
const resultPromise = buildVerificationOrchestrationRuntime({ runAt: RUN_AT, write: false });

test("verification orchestration runtime consumes the P5000 development console", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.verification_orchestration_runtime_status, "ready_for_verification_orchestration_runtime_v0");
  assert.equal(result.program_range, "P5001-P5400");
  assert.equal(result.summary.development_control_console_status, "ready_for_development_control_console_v0");
});

test("verification orchestration runtime covers all P5001-P5400 phase rows", async () => {
  const result = await resultPromise;
  const phaseRanges = new Set(result.verification_phase_rows.map((row) => row.phase_range));

  assert.equal(result.verification_phase_rows.length, 10);
  for (const phase of ["P5001-P5040", "P5041-P5080", "P5081-P5120", "P5121-P5160", "P5161-P5200", "P5201-P5240", "P5241-P5280", "P5281-P5320", "P5321-P5360", "P5361-P5400"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.verification_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("verification orchestration runtime registers standard validators", async () => {
  const result = await resultPromise;
  const commandNames = new Set(result.standard_validator_rows.map((row) => row.command_name));

  assert.equal(result.standard_validator_rows.length, 7);
  assert.equal(commandNames.has("platform:conversation-source-plane"), true);
  assert.equal(commandNames.has("platform:conversation-improvement-signal"), true);
  assert.equal(commandNames.has("platform:development-control-console"), true);
  assert.equal(result.standard_validator_rows.every((row) => row.adapter_status === "REGISTERED"), true);
  assert.equal(result.standard_validator_rows.every((row) => row.required_for_milestone === true), true);
});

test("verification orchestration runtime normalizes dual-run results without mismatch", async () => {
  const result = await resultPromise;

  assert.equal(result.dual_run_result_rows.length, 4);
  assert.equal(result.dual_run_result_rows.every((row) => row.normalized_equivalent === true), true);
  assert.equal(result.dual_run_result_rows.every((row) => row.mismatch_count === 0), true);
  assert.equal(result.dual_run_result_rows.every((row) => row.rerun_required === false), true);
});

test("verification orchestration runtime blocks unsafe negative fixtures", async () => {
  const result = await resultPromise;
  const expectedBlocks = new Set(result.negative_fixture_rows.map((row) => row.expected_block));

  assert.equal(result.negative_fixture_rows.length, 5);
  assert.equal(expectedBlocks.has("BLOCK_ENTERPRISE_TRUST"), true);
  assert.equal(expectedBlocks.has("BLOCK_REVIEW_COMPLETION"), true);
  assert.equal(expectedBlocks.has("BLOCK_INDEPENDENT_REVIEW"), true);
  assert.equal(expectedBlocks.has("BLOCK_ATTESTATION_PASS"), true);
  assert.equal(expectedBlocks.has("BLOCK_PROTECTED_CLOSEOUT"), true);
  assert.equal(result.negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.negative_fixture_rows.every((row) => row.unsafe_claim_allowed === false), true);
});

test("verification orchestration runtime keeps external evidence visibly pending", async () => {
  const result = await resultPromise;

  assert.equal(result.github_actions_evidence_rows.every((row) => row.workflow_run_observed_now === false), true);
  assert.equal(result.github_actions_evidence_rows.every((row) => row.workflow_conclusion_passed_now === false), true);
  assert.equal(result.attestation_verify_rows.every((row) => row.attestation_verification_passed_now === false), true);
  assert.equal(result.claude_review_receipt_rows.every((row) => row.durable_raw_json_required === true), true);
  assert.equal(result.claude_review_receipt_rows.every((row) => row.durable_raw_json_present_now === false), true);
  assert.equal(result.claude_review_receipt_rows.every((row) => row.review_completed_now === false), true);
});

test("verification orchestration runtime separates contract readiness from P5400 closeout", async () => {
  const result = await resultPromise;
  const decision = result.milestone_trust_decision_rows[0];

  assert.equal(decision.local_contract_readiness, true);
  assert.equal(decision.external_evidence_ready, false);
  assert.equal(decision.p5400_milestone_closeout_ready, false);
  assert.equal(decision.lower_trust_readiness_allowed, true);
  assert.equal(decision.enterprise_trust_claim_allowed, false);
  assert.equal(decision.human_adjudication_required, false);
  assert.equal(decision.protected_closeout_enabled, false);
});

test("verification orchestration runtime remains no-human, no-enterprise, no-runtime, no-write", async () => {
  const result = await resultPromise;
  const boundary = result.verification_orchestration_boundary;

  assert.equal(boundary.verification_orchestration_runtime_ready, true);
  assert.equal(boundary.p5400_milestone_closeout_ready, false);
  assert.equal(boundary.local_only_pass_can_claim_enterprise_trust, false);
  assert.equal(boundary.human_adjudication_in_milestone_gate, false);
  assert.equal(boundary.protected_closeout_enabled, false);
  assert.equal(boundary.protected_final_decision_enabled, false);
  assert.equal(boundary.enterprise_trust_claim_enabled, false);
  assert.equal(boundary.deterministic_validation_orchestration_enabled, true);
  assert.equal(boundary.agent_runtime_execution_enabled, false);
  assert.equal(boundary.write_action_enabled, false);
  assert.equal(boundary.protected_action_enabled, false);
  assert.equal(boundary.work_os_claim_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("verification orchestration runtime --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "verification-orchestration-runtime-"));
  const sentinelPath = path.join(outDir, "verification-orchestration-runtime.json");
  const sentinel = "{ \"sentinel\": \"verification-orchestration-runtime\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runVerificationOrchestrationRuntime({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
