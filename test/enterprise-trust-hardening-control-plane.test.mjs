import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildEnterpriseTrustHardeningControlPlane,
  runEnterpriseTrustHardeningControlPlane,
} from "../src/enterprise-trust-hardening-control-plane.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P13000_READY = {
  schema_version: "release-readiness-control-plane.v1",
  program_range: "P12801-P13000",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    release_readiness_control_plane_status: "ready_for_release_readiness_control_plane",
    ready_for_p13001_handoff: true,
    release_candidate_row_count: 6,
    production_checklist_row_count: 6,
    signed_provenance_receipt_present_now: true,
    claude_release_review_receipt_present_now: true,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  release_readiness_boundary: {
    ready_for_p13001_handoff: true,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
};

const P13000_BLOCKED = {
  schema_version: "release-readiness-control-plane.v1",
  program_range: "P12801-P13000",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    release_readiness_control_plane_status: "blocked_release_readiness_control_plane",
    ready_for_p13001_handoff: false,
    release_candidate_row_count: 6,
    production_checklist_row_count: 6,
    signed_provenance_receipt_present_now: false,
    claude_release_review_receipt_present_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
  release_readiness_boundary: {
    ready_for_p13001_handoff: false,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  },
};

const CLAUDE_ENTERPRISE_TRUST_REVIEW_READY = {
  schema_version: "enterprise-trust-claude-review-receipt.v1",
  review_engine: "claude_code_opus_max",
  receipt_status: "complete",
  scope_enterprise_trust_hardening_control_plane: true,
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
    releaseReadinessControlPlane: P13000_READY,
    claudeEnterpriseTrustReviewReceipt: CLAUDE_ENTERPRISE_TRUST_REVIEW_READY,
    ...overrides,
  };
}

test("Enterprise Trust Hardening Control Plane builds review, attestation, SBOM, supply-chain, audit, backup, recovery, Claude review, and freeze contracts through P13400", async () => {
  const result = await buildEnterpriseTrustHardeningControlPlane(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "enterprise-trust-hardening-control-plane.v1");
  assert.equal(result.program_range, "P13001-P13400");
  assert.equal(result.source_program_range, "P12801-P13000");
  assert.equal(result.summary.enterprise_trust_hardening_control_plane_status, "ready_for_enterprise_trust_hardening_control_plane");
  assert.equal(result.summary.independent_review_hardening_row_count, 6);
  assert.equal(result.summary.attestation_hardening_row_count, 6);
  assert.equal(result.summary.sbom_dependency_evidence_row_count, 6);
  assert.equal(result.summary.claude_enterprise_trust_review_receipt_present_now, true);
  assert.equal(result.summary.ready_for_p13401_handoff, true);
  assert.equal(result.summary.enterprise_trust_claim_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Enterprise Trust Hardening Control Plane covers every planned phase", async () => {
  const result = await buildEnterpriseTrustHardeningControlPlane(options());
  const phases = new Set(result.enterprise_trust_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P13001-P13040", "P13041-P13080", "P13081-P13120", "P13121-P13160", "P13161-P13200", "P13201-P13240", "P13241-P13280", "P13281-P13320", "P13321-P13360", "P13361-P13400"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.enterprise_trust_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Enterprise Trust Hardening Control Plane defines enterprise trust posture rows without opening trust authority", async () => {
  const result = await buildEnterpriseTrustHardeningControlPlane(options());

  assert.equal(result.enterprise_source_binding_rows.length, 8);
  assert.equal(result.independent_review_hardening_rows.length, 6);
  assert.equal(result.attestation_hardening_rows.length, 6);
  assert.equal(result.sbom_dependency_evidence_rows.length, 6);
  assert.equal(result.supply_chain_policy_rows.length, 6);
  assert.equal(result.audit_trail_hardening_rows.length, 6);
  assert.equal(result.backup_restore_posture_rows.length, 6);
  assert.equal(result.recovery_posture_rows.length, 6);
  assert.equal(result.claude_enterprise_trust_review_rows.length, 5);
  assert.equal(result.enterprise_trust_authority_guard_rows.length, 6);

  assert.equal(result.independent_review_hardening_rows.every((row) => row.self_approval_allowed === false && row.single_owner_enterprise_trust_allowed === false), true);
  assert.equal(result.attestation_hardening_rows.every((row) => row.attestation_required === true && row.attestation_overclaimed_now === false), true);
  assert.equal(result.sbom_dependency_evidence_rows.every((row) => row.sbom_required === true && row.raw_secret_exposure_allowed === false), true);
  assert.equal(result.enterprise_trust_authority_guard_rows.every((row) => row.enterprise_trust_claim_allowed_now === false && row.production_pass_enabled === false), true);
});

test("Enterprise Trust Hardening Control Plane preserves blocked P13000 source and missing Claude trust review without opening P13401 handoff", async () => {
  const result = await buildEnterpriseTrustHardeningControlPlane(options({
    releaseReadinessControlPlane: P13000_BLOCKED,
    claudeEnterpriseTrustReviewReceipt: null,
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.enterprise_trust_hardening_control_plane_status, "blocked_enterprise_trust_hardening_control_plane");
  assert.equal(result.summary.source_ready_for_p13001_handoff, false);
  assert.equal(result.summary.source_block_visible_now, true);
  assert.equal(result.summary.claude_enterprise_trust_review_receipt_present_now, false);
  assert.equal(result.summary.claude_enterprise_trust_review_block_visible_now, true);
  assert.equal(result.summary.ready_for_p13401_handoff, false);
  assert.equal(result.enterprise_source_binding_rows.find((row) => row.row_id === "source.handoff").current_verdict, "blocked");
  assert.equal(result.p13400_freeze_rows.find((row) => row.row_id === "freeze.source").current_verdict, "blocked");
  assert.equal(result.p13400_freeze_rows.find((row) => row.row_id === "freeze.claude_enterprise_trust_review").current_verdict, "blocked");
});

test("Enterprise Trust Hardening Control Plane keeps ready source blocked when Claude enterprise trust review evidence is missing", async () => {
  const result = await buildEnterpriseTrustHardeningControlPlane(options({ claudeEnterpriseTrustReviewReceipt: null }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.source_ready_for_p13001_handoff, true);
  assert.equal(result.summary.claude_enterprise_trust_review_receipt_present_now, false);
  assert.equal(result.summary.claude_enterprise_trust_review_block_visible_now, true);
  assert.equal(result.summary.ready_for_p13401_handoff, false);
});

test("Enterprise Trust Hardening Control Plane fails validation if P13000 source is missing", async () => {
  const result = await buildEnterpriseTrustHardeningControlPlane(options({ releaseReadinessControlPlane: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.enterprise_trust_hardening_control_plane_status, "blocked_enterprise_trust_hardening_control_plane");
  assert.equal(result.enterprise_trust_boundary.source_release_readiness_available, false);
});

test("Enterprise Trust Hardening Control Plane boundary keeps enterprise trust, release, write, protected closeout, and final approval closed", async () => {
  const result = await buildEnterpriseTrustHardeningControlPlane(options());
  const boundary = result.enterprise_trust_boundary;

  assert.equal(boundary.claude_enterprise_trust_review_receipt_present_now, true);
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
  assert.equal(boundary.secret_read_allowed_now, false);
  assert.equal(boundary.raw_body_exposure_allowed, false);
  assert.equal(boundary.codex_final_approval_ui_enabled, false);
  assert.equal(boundary.claude_final_approval_ui_enabled, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Enterprise Trust Hardening Control Plane HTML is read-only and avoids unsafe enterprise trust copy", async () => {
  const result = await buildEnterpriseTrustHardeningControlPlane(options());

  assert.equal(/<form|<button|type="submit"|approve now|deploy now|release now|enterprise approved|claim trust/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
  assert.equal(/production ready|enterprise pass|release approved|ai approved|claude approved|codex approved/i.test(result.html), false);
});

test("Enterprise Trust Hardening Control Plane --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "enterprise-trust-hardening-control-plane-"));
  const sentinelPath = path.join(outDir, "enterprise-trust-hardening-control-plane.json");
  const sentinel = "{ \"sentinel\": \"enterprise-trust-hardening-control-plane\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runEnterpriseTrustHardeningControlPlane(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
