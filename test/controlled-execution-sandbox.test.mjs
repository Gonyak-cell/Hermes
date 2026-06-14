import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildControlledExecutionSandbox,
  runControlledExecutionSandbox,
} from "../src/controlled-execution-sandbox.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P12200_READY = {
  schema_version: "domain-pack-sdk-v2.v1",
  program_range: "P12001-P12200",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    domain_pack_sdk_v2_status: "ready_for_domain_pack_sdk_v2",
    ready_for_p12201_handoff: true,
    source_block_visible_now: false,
    sdk_contract_row_count: 42,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
  domain_pack_sdk_boundary: {
    ready_for_p12201_handoff: true,
    write_control_enabled: false,
    protected_action_enabled: false,
    connector_write_enabled: false,
    final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
};

const P12200_BLOCKED = {
  schema_version: "domain-pack-sdk-v2.v1",
  program_range: "P12001-P12200",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    domain_pack_sdk_v2_status: "blocked_domain_pack_sdk_v2",
    ready_for_p12201_handoff: false,
    source_block_visible_now: true,
    sdk_contract_row_count: 42,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
  domain_pack_sdk_boundary: {
    ready_for_p12201_handoff: false,
    write_control_enabled: false,
    protected_action_enabled: false,
    connector_write_enabled: false,
    final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
};

const CLAUDE_REVIEW_READY = {
  schema_version: "controlled-execution-sandbox-claude-review-receipt.v1",
  review_engine: "claude_code_opus_max",
  receipt_status: "complete",
  scope_controlled_execution_sandbox: true,
  finding_count: 0,
  summary: {
    review_status: "complete",
    unresolved_finding_count: 0,
  },
};

const SANDBOX_POLICY_MODEL = {
  schema_version: "sandbox-policy-model.v1",
  summary: {
    sandbox_policy_model_status: "complete",
    backend_policy_count: 4,
    runtime_sandbox_binding_count: 3,
  },
  validation: { valid: true, errors: [] },
};

function options(overrides = {}) {
  return {
    runAt: RUN_AT,
    write: false,
    domainPackSdkV2: P12200_READY,
    sandboxPolicyModel: SANDBOX_POLICY_MODEL,
    claudeExecutionReviewReceipt: CLAUDE_REVIEW_READY,
    ...overrides,
  };
}

test("Controlled Execution Sandbox builds receipt-gated sandbox contract through P12400", async () => {
  const result = await buildControlledExecutionSandbox(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "controlled-execution-sandbox.v1");
  assert.equal(result.program_range, "P12201-P12400");
  assert.equal(result.source_program_range, "P12001-P12200");
  assert.equal(result.summary.controlled_execution_sandbox_status, "ready_for_controlled_execution_sandbox");
  assert.equal(result.summary.allowlist_command_count, 8);
  assert.equal(result.summary.sandbox_policy_count, 6);
  assert.equal(result.summary.claude_execution_review_receipt_present_now, true);
  assert.equal(result.summary.ready_for_p12401_handoff, true);
  assert.equal(result.summary.actual_command_executed_now, false);
});

test("Controlled Execution Sandbox covers every planned phase", async () => {
  const result = await buildControlledExecutionSandbox(options());
  const phases = new Set(result.controlled_execution_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P12201-P12220", "P12221-P12240", "P12241-P12260", "P12261-P12280", "P12281-P12300", "P12301-P12320", "P12321-P12340", "P12341-P12360", "P12361-P12380", "P12381-P12400"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.controlled_execution_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Controlled Execution Sandbox defines receipt, allowlist, sandbox, redaction, timeout, rollback, dry-run, review, and projection rows", async () => {
  const result = await buildControlledExecutionSandbox(options());

  assert.equal(result.controlled_execution_receipt_rows.length, 7);
  assert.equal(result.controlled_execution_allowlist_rows.length, 8);
  assert.equal(result.controlled_execution_sandbox_rows.length, 6);
  assert.equal(result.controlled_execution_redaction_rows.length, 5);
  assert.equal(result.controlled_execution_timeout_rows.length, 5);
  assert.equal(result.controlled_execution_rollback_rows.length, 5);
  assert.equal(result.controlled_execution_dry_run_rows.length, 5);
  assert.equal(result.controlled_execution_claude_review_rows.length, 5);
  assert.equal(result.controlled_execution_operator_projection_rows.length, 6);

  assert.equal(result.controlled_execution_allowlist_rows.every((row) => row.requires_receipt === true && row.command_execution_allowed_now === false), true);
  assert.equal(result.controlled_execution_sandbox_rows.every((row) => row.repo_local_only === true && row.global_install_allowed === false), true);
  assert.equal(result.controlled_execution_redaction_rows.every((row) => row.raw_output_persistence_allowed === false && row.raw_secret_persistence_allowed === false), true);
  assert.equal(result.controlled_execution_dry_run_rows.every((row) => row.dry_run_only === true && row.actual_command_execution_evidence_present === false), true);
});

test("Controlled Execution Sandbox preserves blocked P12200 source without opening P12401 handoff", async () => {
  const result = await buildControlledExecutionSandbox(options({ domainPackSdkV2: P12200_BLOCKED, claudeExecutionReviewReceipt: null }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.controlled_execution_sandbox_status, "blocked_controlled_execution_sandbox");
  assert.equal(result.summary.source_ready_for_p12201_handoff, false);
  assert.equal(result.summary.source_block_visible_now, true);
  assert.equal(result.summary.claude_execution_review_receipt_present_now, false);
  assert.equal(result.summary.claude_execution_review_block_visible_now, true);
  assert.equal(result.summary.ready_for_p12401_handoff, false);
  assert.equal(result.controlled_execution_source_binding_rows.find((row) => row.row_id === "source.handoff").current_verdict, "blocked");
  assert.equal(result.p12400_freeze_rows.find((row) => row.row_id === "freeze.source").current_verdict, "blocked");
  assert.equal(result.p12400_freeze_rows.find((row) => row.row_id === "freeze.claude_review").current_verdict, "blocked");
});

test("Controlled Execution Sandbox keeps ready source blocked when Claude execution review evidence is missing", async () => {
  const result = await buildControlledExecutionSandbox(options({ claudeExecutionReviewReceipt: null }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.controlled_execution_sandbox_status, "blocked_controlled_execution_sandbox");
  assert.equal(result.summary.source_ready_for_p12201_handoff, true);
  assert.equal(result.summary.claude_execution_review_receipt_present_now, false);
  assert.equal(result.summary.claude_execution_review_block_visible_now, true);
  assert.equal(result.summary.ready_for_p12401_handoff, false);
});

test("Controlled Execution Sandbox fails validation if P12200 source is missing", async () => {
  const result = await buildControlledExecutionSandbox(options({ domainPackSdkV2: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.controlled_execution_sandbox_status, "blocked_controlled_execution_sandbox");
  assert.equal(result.controlled_execution_boundary.source_domain_pack_sdk_v2_available, false);
});

test("Controlled Execution Sandbox boundary keeps execution and protected capabilities closed", async () => {
  const result = await buildControlledExecutionSandbox(options());
  const boundary = result.controlled_execution_boundary;

  assert.equal(boundary.actual_command_executed_now, false);
  assert.equal(boundary.receipt_applied_now, false);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.write_control_enabled, false);
  assert.equal(boundary.protected_action_enabled, false);
  assert.equal(boundary.connector_write_enabled, false);
  assert.equal(boundary.network_allowed_by_default, false);
  assert.equal(boundary.secret_read_allowed_now, false);
  assert.equal(boundary.raw_body_exposure_allowed, false);
  assert.equal(boundary.codex_final_approval_ui_enabled, false);
  assert.equal(boundary.claude_final_approval_ui_enabled, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Controlled Execution Sandbox HTML is read-only and avoids unsafe execution copy", async () => {
  const result = await buildControlledExecutionSandbox(options());

  assert.equal(/<form|<button|type="submit"|run now|execute now|approve now|merge now|deploy now/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
  assert.equal(/production ready|enterprise pass|release approved|ai approved|claude approved|codex approved/i.test(result.html), false);
});

test("Controlled Execution Sandbox --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "controlled-execution-sandbox-"));
  const sentinelPath = path.join(outDir, "controlled-execution-sandbox.json");
  const sentinel = "{ \"sentinel\": \"controlled-execution-sandbox\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runControlledExecutionSandbox(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
