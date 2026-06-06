import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildSecurityComplianceMaturity,
  runSecurityComplianceMaturity,
} from "../src/security-compliance-maturity.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P14200_READY = {
  schema_version: "product-ops-automation.v1",
  program_range: "P13801-P14200",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    product_ops_automation_status: "ready_for_product_ops_automation",
    ready_for_p14201_handoff: true,
    roadmap_signal_row_count: 6,
    issue_signal_row_count: 6,
    product_ops_projection_row_count: 6,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  product_ops_boundary: {
    ready_for_p14201_handoff: true,
    roadmap_write_allowed_now: false,
    issue_write_allowed_now: false,
    support_reply_allowed_now: false,
    customer_contact_allowed_now: false,
    external_project_write_allowed_now: false,
    enterprise_trust_claim_allowed_now: false,
    production_pass_enabled: false,
    deployment_allowed_now: false,
    write_action_allowed_now: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
  },
};

const P14200_BLOCKED = {
  schema_version: "product-ops-automation.v1",
  program_range: "P13801-P14200",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    product_ops_automation_status: "blocked_product_ops_automation",
    ready_for_p14201_handoff: false,
    roadmap_signal_row_count: 6,
    issue_signal_row_count: 6,
    product_ops_projection_row_count: 6,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  product_ops_boundary: {
    ready_for_p14201_handoff: false,
    roadmap_write_allowed_now: false,
    issue_write_allowed_now: false,
    support_reply_allowed_now: false,
    customer_contact_allowed_now: false,
    external_project_write_allowed_now: false,
    enterprise_trust_claim_allowed_now: false,
    production_pass_enabled: false,
    deployment_allowed_now: false,
    write_action_allowed_now: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
  },
};

const CLAUDE_SECURITY_REVIEW_READY = {
  schema_version: "security-compliance-claude-review-receipt.v1",
  review_engine: "claude_code_opus_max",
  receipt_status: "complete",
  scope_security_compliance_maturity: true,
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
    productOpsAutomation: P14200_READY,
    claudeSecurityComplianceReviewReceipt: CLAUDE_SECURITY_REVIEW_READY,
    ...overrides,
  };
}

test("Security And Compliance Maturity builds SOC2, access, secret, prompt, retention, incident, compliance, Claude review, authority, and freeze contracts through P14600", async () => {
  const result = await buildSecurityComplianceMaturity(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "security-compliance-maturity.v1");
  assert.equal(result.program_range, "P14201-P14600");
  assert.equal(result.source_program_range, "P13801-P14200");
  assert.equal(result.summary.security_compliance_maturity_status, "ready_for_security_compliance_maturity");
  assert.equal(result.summary.soc2_control_signal_row_count, 6);
  assert.equal(result.summary.access_review_signal_row_count, 6);
  assert.equal(result.summary.secret_scanning_signal_row_count, 6);
  assert.equal(result.summary.prompt_injection_guard_row_count, 6);
  assert.equal(result.summary.data_retention_policy_row_count, 6);
  assert.equal(result.summary.incident_workflow_signal_row_count, 6);
  assert.equal(result.summary.compliance_evidence_link_row_count, 6);
  assert.equal(result.summary.claude_security_compliance_review_receipt_present_now, true);
  assert.equal(result.summary.ready_for_p14601_handoff, true);
  assert.equal(result.summary.compliance_pass_enabled, false);
});

test("Security And Compliance Maturity covers every planned phase", async () => {
  const result = await buildSecurityComplianceMaturity(options());
  const phases = new Set(result.security_compliance_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P14201-P14240", "P14241-P14280", "P14281-P14320", "P14321-P14360", "P14361-P14400", "P14401-P14440", "P14441-P14480", "P14481-P14520", "P14521-P14560", "P14561-P14600"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.security_compliance_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Security And Compliance Maturity defines security posture rows without opening sensitive authority", async () => {
  const result = await buildSecurityComplianceMaturity(options());

  assert.equal(result.security_source_binding_rows.length, 8);
  assert.equal(result.soc2_control_signal_rows.length, 6);
  assert.equal(result.access_review_signal_rows.length, 6);
  assert.equal(result.secret_scanning_signal_rows.length, 6);
  assert.equal(result.prompt_injection_guard_rows.length, 6);
  assert.equal(result.data_retention_policy_rows.length, 6);
  assert.equal(result.incident_workflow_signal_rows.length, 6);
  assert.equal(result.compliance_evidence_link_rows.length, 6);
  assert.equal(result.claude_security_compliance_review_rows.length, 5);
  assert.equal(result.security_authority_guard_rows.length, 10);

  assert.equal(result.access_review_signal_rows.every((row) => row.access_mutation_allowed_now === false && row.privilege_escalation_allowed_now === false), true);
  assert.equal(result.secret_scanning_signal_rows.every((row) => row.secret_read_allowed_now === false && row.raw_secret_exposure_allowed === false), true);
  assert.equal(result.prompt_injection_guard_rows.every((row) => row.untrusted_instruction_priority_allowed === false), true);
  assert.equal(result.data_retention_policy_rows.every((row) => row.destructive_delete_allowed_now === false), true);
  assert.equal(result.incident_workflow_signal_rows.every((row) => row.incident_auto_close_allowed_now === false), true);
  assert.equal(result.security_authority_guard_rows.every((row) => row.compliance_pass_enabled === false && row.connector_write_enabled === false && row.production_pass_enabled === false), true);
});

test("Security And Compliance Maturity preserves blocked P14200 source and missing Claude security review without opening P14601 handoff", async () => {
  const result = await buildSecurityComplianceMaturity(options({
    productOpsAutomation: P14200_BLOCKED,
    claudeSecurityComplianceReviewReceipt: null,
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.security_compliance_maturity_status, "blocked_security_compliance_maturity");
  assert.equal(result.summary.source_ready_for_p14201_handoff, false);
  assert.equal(result.summary.source_block_visible_now, true);
  assert.equal(result.summary.claude_security_compliance_review_receipt_present_now, false);
  assert.equal(result.summary.claude_security_compliance_review_block_visible_now, true);
  assert.equal(result.summary.ready_for_p14601_handoff, false);
  assert.equal(result.security_source_binding_rows.find((row) => row.row_id === "source.handoff").current_verdict, "blocked");
  assert.equal(result.p14600_freeze_rows.find((row) => row.row_id === "freeze.source").current_verdict, "blocked");
  assert.equal(result.p14600_freeze_rows.find((row) => row.row_id === "freeze.claude_security_compliance_review").current_verdict, "blocked");
});

test("Security And Compliance Maturity keeps ready source blocked when Claude security review evidence is missing", async () => {
  const result = await buildSecurityComplianceMaturity(options({ claudeSecurityComplianceReviewReceipt: null }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.source_ready_for_p14201_handoff, true);
  assert.equal(result.summary.claude_security_compliance_review_receipt_present_now, false);
  assert.equal(result.summary.claude_security_compliance_review_block_visible_now, true);
  assert.equal(result.summary.ready_for_p14601_handoff, false);
});

test("Security And Compliance Maturity fails validation if P14200 source is missing", async () => {
  const result = await buildSecurityComplianceMaturity(options({ productOpsAutomation: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.security_compliance_maturity_status, "blocked_security_compliance_maturity");
  assert.equal(result.security_compliance_boundary.source_product_ops_available, false);
});

test("Security And Compliance Maturity boundary keeps security actions, raw exposure, release, connector write, and final approval closed", async () => {
  const result = await buildSecurityComplianceMaturity(options());
  const boundary = result.security_compliance_boundary;

  assert.equal(boundary.access_mutation_allowed_now, false);
  assert.equal(boundary.secret_read_allowed_now, false);
  assert.equal(boundary.raw_secret_exposure_allowed, false);
  assert.equal(boundary.destructive_delete_allowed_now, false);
  assert.equal(boundary.incident_auto_close_allowed_now, false);
  assert.equal(boundary.compliance_pass_enabled, false);
  assert.equal(boundary.raw_contact_exposure_allowed, false);
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

test("Security And Compliance Maturity HTML is read-only and avoids unsafe security operations copy", async () => {
  const result = await buildSecurityComplianceMaturity(options());

  assert.equal(/<form|<button|type="submit"|mutate access|read secret|raw secret|delete now|auto close|compliance pass enabled|approve now|deploy now|release now|enterprise approved|production ready|enterprise pass|final approve/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
});

test("Security And Compliance Maturity --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "security-compliance-maturity-"));
  const sentinelPath = path.join(outDir, "security-compliance-maturity.json");
  const sentinel = "{ \"sentinel\": \"security-compliance-maturity\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runSecurityComplianceMaturity(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
