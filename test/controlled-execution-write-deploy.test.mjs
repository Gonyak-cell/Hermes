import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildControlledExecutionWriteDeploy,
  runControlledExecutionWriteDeploy,
} from "../src/controlled-execution-write-deploy.mjs";

const RUN_AT = "2026-06-05T00:00:00.000Z";
const resultPromise = buildControlledExecutionWriteDeploy({ runAt: RUN_AT, write: false });

test("controlled execution write deploy consumes P6600 product domain SaaS factory", async () => {
  const result = await resultPromise;

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.controlled_execution_write_deploy_status, "ready_for_controlled_execution_write_deploy_v0");
  assert.equal(result.program_range, "P6601-P7000");
  assert.equal(result.summary.product_domain_saas_factory_status, "ready_for_product_domain_saas_factory_v0");
});

test("controlled execution write deploy covers all P6601-P7000 phase rows", async () => {
  const result = await resultPromise;
  const phaseRanges = new Set(result.controlled_execution_write_deploy_phase_rows.map((row) => row.phase_range));

  assert.equal(result.controlled_execution_write_deploy_phase_rows.length, 10);
  for (const phase of ["P6601-P6640", "P6641-P6680", "P6681-P6720", "P6721-P6760", "P6761-P6800", "P6801-P6840", "P6841-P6880", "P6881-P6920", "P6921-P6960", "P6961-P7000"]) {
    assert.equal(phaseRanges.has(phase), true);
  }
  assert.equal(result.controlled_execution_write_deploy_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("controlled execution write deploy registers allowlist rows but keeps command execution disabled", async () => {
  const result = await resultPromise;

  assert.equal(result.execution_allowlist_rows.length, 5);
  assert.equal(result.execution_allowlist_rows.every((row) => row.allowlist_contract_ready), true);
  assert.equal(result.execution_allowlist_rows.every((row) => row.command_execution_enabled_now === false), true);
  assert.equal(result.execution_allowlist_rows.every((row) => row.requires_receipt_before_execution), true);
  assert.equal(result.execution_allowlist_rows.every((row) => row.redaction_required), true);
  assert.equal(result.execution_allowlist_rows.every((row) => row.timeout_required), true);
  assert.equal(result.execution_allowlist_rows.every((row) => row.rollback_binding_required), true);
});

test("controlled execution write deploy binds sandbox, timeout, and redaction policy", async () => {
  const result = await resultPromise;

  assert.equal(result.sandbox_timeout_policy_rows.length, 4);
  assert.equal(result.sandbox_timeout_policy_rows.every((row) => row.policy_contract_ready), true);
  assert.equal(result.sandbox_timeout_policy_rows.every((row) => row.timeout_required), true);
  assert.equal(result.sandbox_timeout_policy_rows.every((row) => row.network_disabled_by_default), true);
  assert.equal(result.sandbox_timeout_policy_rows.every((row) => row.raw_secret_env_disabled), true);
  assert.equal(result.sandbox_timeout_policy_rows.every((row) => row.execution_enabled_now === false), true);
  assert.equal(result.redaction_secret_scanner_rows.length, 3);
  assert.equal(result.redaction_secret_scanner_rows.every((row) => row.raw_secret_allowed === false), true);
  assert.equal(result.redaction_secret_scanner_rows.every((row) => row.raw_sensitive_data_allowed === false), true);
  assert.equal(result.redaction_secret_scanner_rows.every((row) => row.leak_blocks_execution_or_apply), true);
});

test("controlled execution write deploy prepares patch candidates while blocking apply", async () => {
  const result = await resultPromise;
  const patch = result.patch_candidate_lane_rows[0];
  const apply = result.receipt_gated_apply_boundary_rows[0];

  assert.equal(patch.patch_candidate_generation_ready, true);
  assert.equal(patch.generated_patch_only, true);
  assert.equal(patch.direct_apply_allowed, false);
  assert.equal(patch.diff_review_packet_required, true);
  assert.equal(patch.claude_review_receipt_required, true);
  assert.equal(apply.receipt_gated_apply_boundary_ready, true);
  assert.equal(apply.no_human_mode_blocks_apply, true);
  assert.equal(apply.patch_apply_enabled, false);
  assert.equal(apply.protected_apply_enabled, false);
  assert.equal(apply.external_project_write_enabled, false);
});

test("controlled execution write deploy prepares deploy receipts and rollback binding while blocking deploy", async () => {
  const result = await resultPromise;

  assert.equal(result.deploy_receipt_contract_rows.length, 2);
  assert.equal(result.deploy_receipt_contract_rows.every((row) => row.deploy_receipt_contract_ready), true);
  assert.equal(result.deploy_receipt_contract_rows.every((row) => row.deploy_enabled_now === false), true);
  assert.equal(result.deploy_receipt_contract_rows.every((row) => row.commit_sha_binding_required), true);
  assert.equal(result.deploy_receipt_contract_rows.every((row) => row.rollback_binding_required), true);
  assert.equal(result.rollback_binding_rows[0].rollback_binding_ready, true);
  assert.equal(result.rollback_binding_rows[0].write_or_deploy_without_rollback_allowed, false);
});

test("controlled execution write deploy requires post-apply validation", async () => {
  const result = await resultPromise;

  assert.equal(result.post_apply_validation_rows.length, 5);
  assert.equal(result.post_apply_validation_rows.every((row) => row.validation_contract_ready), true);
  assert.equal(result.post_apply_validation_rows.every((row) => row.required_after_apply), true);
  assert.equal(result.post_apply_validation_rows.every((row) => row.can_be_skipped === false), true);
});

test("controlled execution write deploy negative fixtures block unsafe execution claims", async () => {
  const result = await resultPromise;
  const fixtureIds = new Set(result.execution_negative_fixture_rows.map((row) => row.fixture_id));

  assert.equal(result.execution_negative_fixture_rows.length, 8);
  for (const fixture of ["negative.freeform_command", "negative.direct_patch_apply", "negative.no_human_as_apply_authority", "negative.deploy_without_receipt", "negative.secret_in_logs", "negative.raw_sensitive_data", "negative.external_service_write", "negative.rollback_missing"]) {
    assert.equal(fixtureIds.has(fixture), true);
  }
  assert.equal(result.execution_negative_fixture_rows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), true);
  assert.equal(result.execution_negative_fixture_rows.every((row) => row.unsafe_execution_claim_allowed === false), true);
});

test("controlled execution write deploy remains no-command, no-apply, no-deploy, no-write, and no-Work-OS", async () => {
  const result = await resultPromise;
  const boundary = result.controlled_execution_write_deploy_boundary;

  assert.equal(boundary.controlled_execution_write_deploy_ready, true);
  assert.equal(boundary.allowlisted_execution_contract_ready, true);
  assert.equal(boundary.patch_candidate_lane_ready, true);
  assert.equal(boundary.deploy_receipt_contract_ready, true);
  assert.equal(boundary.command_execution_enabled, false);
  assert.equal(boundary.patch_apply_enabled, false);
  assert.equal(boundary.protected_apply_enabled, false);
  assert.equal(boundary.deploy_enabled, false);
  assert.equal(boundary.external_project_write_enabled, false);
  assert.equal(boundary.raw_sensitive_data_access_enabled, false);
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

test("controlled execution write deploy --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "controlled-execution-write-deploy-"));
  const sentinelPath = path.join(outDir, "controlled-execution-write-deploy.json");
  const sentinel = "{ \"sentinel\": \"controlled-execution-write-deploy\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runControlledExecutionWriteDeploy({ runAt: RUN_AT, outDir, check: true, write: false });
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
