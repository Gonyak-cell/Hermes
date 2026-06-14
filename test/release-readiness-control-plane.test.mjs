import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildReleaseReadinessControlPlane,
  runReleaseReadinessControlPlane,
} from "../src/release-readiness-control-plane.mjs";

const RUN_AT = "2026-06-06T00:00:00.000Z";

const P12800_READY = {
  schema_version: "human-owner-adjudication-option.v1",
  program_range: "P12601-P12800",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    human_owner_adjudication_option_status: "ready_for_human_owner_adjudication_option",
    ready_for_p12801_handoff: true,
    owner_adjudication_receipt_row_count: 7,
    independent_review_separation_row_count: 6,
    owner_adjudication_receipt_present_now: true,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
  human_owner_adjudication_boundary: {
    ready_for_p12801_handoff: true,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
};

const P12800_BLOCKED = {
  schema_version: "human-owner-adjudication-option.v1",
  program_range: "P12601-P12800",
  validation: { valid: true, error_count: 0, errors: [] },
  summary: {
    human_owner_adjudication_option_status: "blocked_human_owner_adjudication_option",
    ready_for_p12801_handoff: false,
    owner_adjudication_receipt_row_count: 7,
    independent_review_separation_row_count: 6,
    owner_adjudication_receipt_present_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
  human_owner_adjudication_boundary: {
    ready_for_p12801_handoff: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    connector_write_enabled: false,
    runtime_execution_allowed_now: false,
    final_approval_ui_enabled: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
  },
};

const SIGNED_PROVENANCE_READY = {
  schema_version: "release-signed-provenance-receipt.v1",
  receipt_status: "observed",
  signed_provenance_bundle_present_now: true,
  artifact_digest_bound_now: true,
  commit_sha_bound_now: true,
  attestation_verification_passed_now: true,
  raw_payload_inlined: false,
  summary: {
    receipt_status: "observed",
    artifact_count: 1,
  },
};

const CLAUDE_RELEASE_REVIEW_READY = {
  schema_version: "release-readiness-claude-review-receipt.v1",
  review_engine: "claude_code_opus_max",
  receipt_status: "complete",
  scope_release_readiness_control_plane: true,
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
    humanOwnerAdjudicationOption: P12800_READY,
    signedProvenanceReceipt: SIGNED_PROVENANCE_READY,
    claudeReleaseReviewReceipt: CLAUDE_RELEASE_REVIEW_READY,
    ...overrides,
  };
}

test("Release Readiness Control Plane builds release candidate, migration, rollback, incident, checklist, provenance, review, and freeze contracts through P13000", async () => {
  const result = await buildReleaseReadinessControlPlane(options());

  assert.equal(result.validation.valid, true);
  assert.equal(result.schema_version, "release-readiness-control-plane.v1");
  assert.equal(result.program_range, "P12801-P13000");
  assert.equal(result.source_program_range, "P12601-P12800");
  assert.equal(result.summary.release_readiness_control_plane_status, "ready_for_release_readiness_control_plane");
  assert.equal(result.summary.release_candidate_row_count, 6);
  assert.equal(result.summary.production_checklist_row_count, 6);
  assert.equal(result.summary.signed_provenance_receipt_present_now, true);
  assert.equal(result.summary.claude_release_review_receipt_present_now, true);
  assert.equal(result.summary.ready_for_p13001_handoff, true);
  assert.equal(result.summary.deployment_allowed_now, false);
  assert.equal(result.summary.release_approval_allowed_now, false);
});

test("Release Readiness Control Plane covers every planned phase", async () => {
  const result = await buildReleaseReadinessControlPlane(options());
  const phases = new Set(result.release_phase_rows.map((row) => row.phase_range));

  for (const phase of ["P12801-P12820", "P12821-P12840", "P12841-P12860", "P12861-P12880", "P12881-P12900", "P12901-P12920", "P12921-P12940", "P12941-P12960", "P12961-P12980", "P12981-P13000"]) {
    assert.equal(phases.has(phase), true);
  }
  assert.equal(result.release_phase_rows.every((row) => row.current_verdict === "pass"), true);
});

test("Release Readiness Control Plane defines release, migration, rollback, incident, checklist, provenance, review, projection, and authority rows", async () => {
  const result = await buildReleaseReadinessControlPlane(options());

  assert.equal(result.release_source_binding_rows.length, 8);
  assert.equal(result.release_candidate_contract_rows.length, 6);
  assert.equal(result.migration_readiness_rows.length, 6);
  assert.equal(result.release_rollback_restore_rows.length, 6);
  assert.equal(result.incident_response_plan_rows.length, 6);
  assert.equal(result.production_checklist_rows.length, 6);
  assert.equal(result.signed_provenance_gate_rows.length, 6);
  assert.equal(result.claude_release_review_rows.length, 5);
  assert.equal(result.release_operator_projection_rows.length, 6);
  assert.equal(result.release_authority_guard_rows.length, 6);

  assert.equal(result.release_candidate_contract_rows.every((row) => row.deploy_allowed_now === false && row.release_approval_allowed_now === false), true);
  assert.equal(result.migration_readiness_rows.every((row) => row.migration_execution_allowed_now === false && row.data_write_allowed_now === false), true);
  assert.equal(result.release_rollback_restore_rows.every((row) => row.rollback_execution_allowed_now === false && row.restore_execution_allowed_now === false), true);
  assert.equal(result.release_operator_projection_rows.every((row) => row.mutation_method_allowed_now === false && row.final_approval_ui_enabled === false), true);
});

test("Release Readiness Control Plane preserves blocked P12800 source and missing receipts without opening P13001 handoff", async () => {
  const result = await buildReleaseReadinessControlPlane(options({
    humanOwnerAdjudicationOption: P12800_BLOCKED,
    signedProvenanceReceipt: null,
    claudeReleaseReviewReceipt: null,
  }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.release_readiness_control_plane_status, "blocked_release_readiness_control_plane");
  assert.equal(result.summary.source_ready_for_p12801_handoff, false);
  assert.equal(result.summary.source_block_visible_now, true);
  assert.equal(result.summary.signed_provenance_receipt_present_now, false);
  assert.equal(result.summary.signed_provenance_block_visible_now, true);
  assert.equal(result.summary.claude_release_review_receipt_present_now, false);
  assert.equal(result.summary.claude_release_review_block_visible_now, true);
  assert.equal(result.summary.ready_for_p13001_handoff, false);
  assert.equal(result.release_source_binding_rows.find((row) => row.row_id === "source.handoff").current_verdict, "blocked");
  assert.equal(result.p13000_freeze_rows.find((row) => row.row_id === "freeze.source").current_verdict, "blocked");
  assert.equal(result.p13000_freeze_rows.find((row) => row.row_id === "freeze.signed_provenance").current_verdict, "blocked");
  assert.equal(result.p13000_freeze_rows.find((row) => row.row_id === "freeze.claude_release_review").current_verdict, "blocked");
});

test("Release Readiness Control Plane keeps ready source blocked when provenance or Claude release review evidence is missing", async () => {
  const result = await buildReleaseReadinessControlPlane(options({ signedProvenanceReceipt: null }));
  const withoutClaude = await buildReleaseReadinessControlPlane(options({ claudeReleaseReviewReceipt: null }));

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.source_ready_for_p12801_handoff, true);
  assert.equal(result.summary.signed_provenance_receipt_present_now, false);
  assert.equal(result.summary.ready_for_p13001_handoff, false);
  assert.equal(withoutClaude.validation.valid, true);
  assert.equal(withoutClaude.summary.claude_release_review_receipt_present_now, false);
  assert.equal(withoutClaude.summary.ready_for_p13001_handoff, false);
});

test("Release Readiness Control Plane fails validation if P12800 source is missing", async () => {
  const result = await buildReleaseReadinessControlPlane(options({ humanOwnerAdjudicationOption: null }));

  assert.equal(result.validation.valid, false);
  assert.equal(result.summary.release_readiness_control_plane_status, "blocked_release_readiness_control_plane");
  assert.equal(result.release_readiness_boundary.source_human_owner_adjudication_available, false);
});

test("Release Readiness Control Plane boundary keeps deployment, write, final approval, production, and enterprise trust closed", async () => {
  const result = await buildReleaseReadinessControlPlane(options());
  const boundary = result.release_readiness_boundary;

  assert.equal(boundary.signed_provenance_receipt_present_now, true);
  assert.equal(boundary.attestation_verification_passed_now, true);
  assert.equal(boundary.claude_release_review_receipt_present_now, true);
  assert.equal(boundary.deployment_allowed_now, false);
  assert.equal(boundary.migration_execution_allowed_now, false);
  assert.equal(boundary.rollback_execution_allowed_now, false);
  assert.equal(boundary.release_approval_allowed_now, false);
  assert.equal(boundary.protected_action_allowed_now, false);
  assert.equal(boundary.write_action_allowed_now, false);
  assert.equal(boundary.connector_write_enabled, false);
  assert.equal(boundary.runtime_execution_allowed_now, false);
  assert.equal(boundary.secret_read_allowed_now, false);
  assert.equal(boundary.raw_body_exposure_allowed, false);
  assert.equal(boundary.codex_final_approval_ui_enabled, false);
  assert.equal(boundary.claude_final_approval_ui_enabled, false);
  assert.equal(boundary.production_pass_enabled, false);
  assert.equal(boundary.enterprise_pass_enabled, false);
  assert.equal(boundary.enterprise_trust_claim_allowed_now, false);
  assert.equal(boundary.unsafe_flag_count, 0);
});

test("Release Readiness Control Plane HTML is read-only and avoids unsafe release copy", async () => {
  const result = await buildReleaseReadinessControlPlane(options());

  assert.equal(/<form|<button|type="submit"|deploy now|release now|approve now|final approve|apply migration/i.test(result.html), false);
  assert.equal(/raw transcript body:[\s\S]*[A-Za-z0-9]/i.test(result.html), false);
  assert.equal(/production ready|enterprise pass|release approved|ai approved|claude approved|codex approved/i.test(result.html), false);
});

test("Release Readiness Control Plane --check does not overwrite artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "release-readiness-control-plane-"));
  const sentinelPath = path.join(outDir, "release-readiness-control-plane.json");
  const sentinel = "{ \"sentinel\": \"release-readiness-control-plane\" }\n";
  await writeFile(sentinelPath, sentinel, "utf8");

  try {
    const result = await runReleaseReadinessControlPlane(options({ outDir, check: true, write: false }));
    assert.equal(result.validation.valid, true);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});
