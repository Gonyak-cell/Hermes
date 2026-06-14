import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  buildFactoryG1aFirstUseAuditReadiness,
  runFactoryG1aFirstUseAuditReadiness,
} from "../src/factory-g1a-first-use-audit-readiness.mjs";
import { buildReviewApiResponse } from "../src/review-api.mjs";

const RUN_AT = "2026-06-12T23:00:00.000Z";

test("default G1a first-use audit readiness reports the source-bound first-use audit fixture", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-g1a-first-use-audit-"));
  try {
    const result = await runFactoryG1aFirstUseAuditReadiness({ check: true, outDir });

    assert.equal(result.summary.factory_g1a_first_use_audit_readiness_status, "g1a_first_use_audit_already_bound");
    assert.equal(result.summary.ready_for_first_use_audit_source_binding, false);
    assert.equal(result.summary.first_use_audit_candidate_present, true);
    assert.equal(result.summary.first_use_audit_already_bound, true);
    assert.equal(result.summary.source_literal_opening_commit_applied, true);
    assert.equal(result.summary.readiness_pass_count, 17);
    assert.equal(result.summary.blocker_count, 0);
    assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
    assert.equal(result.summary.project_creation_allowed_now, false);
    assert.equal(result.summary.production_pass_enabled, false);
    assert.equal(result.validation.valid, true);
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("valid audit candidate before G1a source opening remains waiting and read-only", async () => {
  const result = await buildFactoryG1aFirstUseAuditReadiness({
    auditCandidate: validAuditCandidate(),
    closeoutReadiness: preOpeningCloseoutReadiness(),
  });

  assert.equal(result.summary.first_use_audit_candidate_present, true);
  assert.equal(result.summary.factory_g1a_first_use_audit_readiness_status, "waiting_for_g1a_opening_source_literal_commit");
  assert.equal(result.summary.ready_for_first_use_audit_source_binding, false);
  assert.equal(result.summary.source_literal_opening_commit_applied, false);
  assert.equal(result.proposed_first_use_audit_source_binding.preview_only, true);
  assert.equal(result.proposed_first_use_audit_source_binding.source_mutation_allowed_now, false);
  assert.equal(result.validation.valid, true);
});

test("valid audit candidate becomes ready only after source commit and owner receipt are bound", async () => {
  const result = await buildFactoryG1aFirstUseAuditReadiness({
    auditCandidate: validAuditCandidate(),
    closeoutReadiness: openedCloseoutReadiness(),
  });

  assert.equal(result.summary.factory_g1a_first_use_audit_readiness_status, "ready_g1a_first_use_audit_for_source_literal_binding");
  assert.equal(result.summary.ready_for_first_use_audit_source_binding, true);
  assert.equal(result.summary.readiness_fail_count, 0);
  assert.equal(result.summary.readiness_wait_count, 0);
  assert.equal(result.summary.first_use_audit_bound_by_this_command, false);
  assert.equal(result.summary.source_mutation_allowed_now, false);
  assert.equal(result.summary.g1a_project_creation_gate_open_now, false);
  assert.match(result.proposed_first_use_audit_source_binding.required_replacement.after, /SOURCE_LITERAL_FIRST_USE_AUDITS/);
  assert.match(result.proposed_first_use_audit_source_binding.required_replacement.after, /G1A-FIRST-USE-AUDIT-001/);
  assert.equal(result.validation.valid, true);
});

test("invalid first-use audit candidate fails closed", async () => {
  const invalid = {
    ...validAuditCandidate(),
    gate_id: "G1b",
    cross_tenant_data_confirmed_absent: false,
    production_pass_enabled: true,
  };
  const result = await buildFactoryG1aFirstUseAuditReadiness({
    auditCandidate: invalid,
    closeoutReadiness: openedCloseoutReadiness(),
  });

  assert.equal(result.summary.factory_g1a_first_use_audit_readiness_status, "blocked_g1a_first_use_audit_readiness");
  assert.equal(result.summary.ready_for_first_use_audit_source_binding, false);
  assert.equal(result.summary.readiness_fail_count > 0, true);
  assert.equal(result.summary.hard_blocker_ids.length > 0, true);
  assert.equal(result.summary.production_pass_enabled, false);
  assert.equal(result.validation.valid, false);
});

test("check mode does not write first-use audit readiness artifacts", async () => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), "hermes-g1a-first-use-audit-check-"));
  try {
    await runFactoryG1aFirstUseAuditReadiness({ check: true, outDir });
    await assert.rejects(
      import("node:fs/promises").then(({ readFile }) => readFile(path.join(outDir, "factory-g1a-first-use-audit-readiness.json"), "utf8")),
      /ENOENT/u,
    );
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
});

test("Review API exposes G1a first-use audit readiness as read-only source-bound data", async () => {
  const response = await buildReviewApiResponse("/api/factory/g1a-first-use-audit-readiness?category=source", {
    runAt: RUN_AT,
  });
  const body = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(body.collection, "factory_g1a_first_use_audit_readiness_rows");
  assert.equal(body.read_only, true);
  assert.equal(body.mutation_allowed, false);
  assert.equal(body.first_use_audit_readiness_only, true);
  assert.equal(body.source_mutation_allowed_now, false);
  assert.equal(body.first_use_audit_bound_by_this_command, false);
  assert.equal(body.opens_gate_now, false);
  assert.equal(body.summary.factory_g1a_first_use_audit_readiness_status, "g1a_first_use_audit_already_bound");
  assert.equal(body.first_use_audit_source_binding_closed_now, true);
  assert.equal(body.g1a_project_creation_gate_open_now, false);
  assert.equal(body.project_creation_allowed_now, false);
  assert.equal(body.production_pass_enabled, false);

  const head = await buildReviewApiResponse("/api/factory/g1a-first-use-audit-readiness?limit=1", {
    method: "HEAD",
    runAt: RUN_AT,
  });
  assert.equal(head.status, 200);
  assert.equal(head.body, "");

  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const denied = await buildReviewApiResponse("/api/factory/g1a-first-use-audit-readiness", {
      method,
      runAt: RUN_AT,
    });
    const deniedBody = JSON.parse(denied.body);
    assert.equal(denied.status, 405);
    assert.equal(deniedBody.error, "method_not_allowed");
  }
});

function validAuditCandidate() {
  return {
    schema_version: "factory-g1a-first-use-audit.v1",
    audit_id: "G1A-FIRST-USE-AUDIT-001",
    audit_status: "captured",
    gate_id: "G1a",
    gate_name: "project_creation",
    authority_flag: "project_creation_allowed_now",
    target_action: "project_workspace_creation",
    owner_gate_opening_receipt_id: "OWNER-G1A-GATE-OPENING-001",
    owner_gate_opening_receipt_sha256: "a".repeat(64),
    source_literal_opening_commit_sha: "123456789abc",
    bound_candidate_manifest_sha256: "b".repeat(64),
    bound_candidate_packet_sha256: null,
    product_id: "factory-product-law-firm-os",
    workspace_id: "workspace-law-firm-os-001",
    workspace_count_created: 1,
    receipt_count_consumed: 1,
    actor_id: "human-owner",
    action_started_at: "2026-06-12T00:00:00.000Z",
    action_completed_at: "2026-06-12T00:01:00.000Z",
    completed_item_ids: [
      "bind_signed_owner_receipt",
      "bind_candidate_hash",
      "create_one_workspace_only",
      "record_audit_trace",
      "confirm_no_cross_tenant_data",
      "record_post_action_status",
    ],
    cross_tenant_data_confirmed_absent: true,
    raw_confidential_material_visible: false,
    scope_violation_detected: false,
    action_result: "success",
    post_action_status: "success_recorded",
    rollback_required: false,
    demotion_required: false,
    repo_write_allowed_now: false,
    connector_write_allowed_now: false,
    deployment_allowed_now: false,
    protected_action_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    claude_final_approval_allowed_now: false,
    codex_final_approval_allowed_now: false,
    fable_final_approval_allowed_now: false,
  };
}

function openedCloseoutReadiness() {
  const row = (rowId, currentVerdict, observedValue = true) => ({
    schema_version: "factory-g1a-opening-closeout-chain-row.v1",
    row_id: rowId,
    category: "test",
    current_verdict: currentVerdict,
    description: rowId,
    observed_value: observedValue,
    generated_at: "2026-06-12T00:00:00.000Z",
  });
  return {
    schema_version: "factory-g1a-opening-closeout-readiness.v1",
    summary: {
      factory_g1a_opening_closeout_readiness_status: "waiting_for_first_use_audit",
    },
    validation: {
      valid: true,
      errors: [],
    },
    g1a_opening_closeout_chain_rows: [
      row("g0.readiness_ready", "pass"),
      row("g1a.packet_ready", "pass"),
      row("g1a.packet_review_valid", "pass"),
      row("owner_receipt.signed", "pass"),
      row("owner_receipt.intake_ready", "pass"),
      row("source_literal.preflight_ready", "pass"),
      row("source_literal.commit_applied", "pass"),
      row("source_literal.owner_receipt_bound", "pass"),
      row("first_use.audit_present", "wait", false),
      row("authority.closed_until_complete", "pass"),
    ],
  };
}

function preOpeningCloseoutReadiness() {
  const row = (rowId, currentVerdict, observedValue = true) => ({
    schema_version: "factory-g1a-opening-closeout-chain-row.v1",
    row_id: rowId,
    category: "test",
    current_verdict: currentVerdict,
    description: rowId,
    observed_value: observedValue,
    generated_at: "2026-06-12T00:00:00.000Z",
  });
  return {
    schema_version: "factory-g1a-opening-closeout-readiness.v1",
    summary: {
      factory_g1a_opening_closeout_readiness_status: "waiting_for_signed_g1a_owner_receipt",
    },
    validation: {
      valid: true,
      errors: [],
    },
    g1a_opening_closeout_chain_rows: [
      row("g0.readiness_ready", "pass"),
      row("g1a.packet_ready", "pass"),
      row("g1a.packet_review_valid", "pass"),
      row("owner_receipt.signed", "wait", false),
      row("owner_receipt.intake_ready", "wait", "waiting_for_signed_g1a_owner_receipt"),
      row("source_literal.preflight_ready", "wait", "waiting_for_signed_g1a_owner_receipt"),
      row("source_literal.commit_applied", "wait", false),
      row("source_literal.owner_receipt_bound", "wait", false),
      row("first_use.audit_present", "wait", false),
      row("authority.closed_until_complete", "pass"),
    ],
  };
}
