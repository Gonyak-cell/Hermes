import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReceiptWorkbenchOperatorDashboardScreenContract } from "../src/receipt-workbench-operator-dashboard-screen-contract.mjs";

const RUN_AT = "2026-06-07T00:00:00.000Z";
const COMMIT_REF = "7ff0c43";

const PROTECTED_FALSE_FLAGS = [
  "deployment_allowed_now",
  "release_approval_allowed_now",
  "production_pass_enabled",
  "enterprise_pass_enabled",
  "enterprise_trust_claim_allowed_now",
  "protected_closeout_enabled",
  "human_gate_bypass_allowed_now",
  "independent_review_bypass_allowed_now",
  "single_owner_enterprise_trust_allowed_now",
  "runtime_execution_allowed_now",
  "write_action_allowed_now",
  "protected_action_allowed_now",
  "connector_write_enabled",
  "external_service_mutation_allowed_now",
  "raw_source_exposure_allowed",
  "secret_read_allowed_now",
  "reviewer_mutation_allowed_now",
  "final_automated_approval_allowed",
];

const API_FALSE_FLAGS = [
  "api_write_allowed_now",
  "mutating_method_allowed_now",
  "server_start_required_now",
  "server_started_now",
  "route_handler_registered_now",
  "route_execution_allowed_now",
  "dashboard_mutation_allowed_now",
  "receipt_completion_claim_allowed_now",
  "remediation_apply_allowed_now",
  "final_api_approval_allowed_now",
  "raw_stdout_exposure_allowed_now",
  "raw_stderr_exposure_allowed_now",
  "raw_secret_material_allowed_now",
  "full_transcript_exposure_allowed_now",
];

const HANDOFF_FALSE_FLAGS = [
  "dashboard_handoff_write_allowed_now",
  "dashboard_data_mutation_allowed_now",
  "ui_event_submission_allowed_now",
  "live_fetch_allowed_now",
  "server_bind_allowed_now",
  "route_mount_allowed_now",
  "smoke_test_live_network_allowed_now",
  "completion_apply_allowed_now",
  "operator_override_allowed_now",
  "final_dashboard_approval_allowed_now",
];

const CONSUMER_SLOTS = [
  "receipt_workbench.receipt_status_card",
  "receipt_workbench.receipt_status_card",
  "receipt_workbench.receipt_status_card",
  "receipt_workbench.receipt_status_card",
  "receipt_workbench.receipt_status_card",
  "receipt_workbench.receipt_status_card",
  "receipt_workbench.receipt_status_card",
  "receipt_workbench.blocker_banner",
];

const SMOKE_ROUTES = [
  ["/api/receipt-workbench/tasks", "receipt_workbench.task_list"],
  ["/api/receipt-workbench/remediation-drafts", "receipt_workbench.remediation_panel"],
  ["/api/receipt-workbench/evidence-requests", "receipt_workbench.evidence_panel"],
  ["/api/receipt-workbench/review-router", "receipt_workbench.review_panel"],
  ["/api/receipt-workbench/summary", "receipt_workbench.summary_bar"],
];

function buildP23600Source({ ready = true } = {}) {
  return {
    schema_version: "receipt-workbench-dashboard-handoff-smoke.v1",
    generated_at: RUN_AT,
    capability_id: "platform.receipt_workbench_dashboard_handoff_smoke",
    program_range: "P23201-P23600",
    source_program_range: "P22801-P23200",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      receipt_workbench_dashboard_handoff_smoke_status: ready
        ? "ready_for_receipt_workbench_dashboard_handoff_smoke"
        : "valid_block_receipt_workbench_dashboard_handoff_smoke_pending",
      source_p23200_ready_for_p23201_handoff: ready,
      dashboard_consumer_contract_count: 8,
      handoff_adapter_smoke_count: 5,
      operator_visibility_rule_count: 8,
      ready_for_p23601_handoff: ready,
      live_fetch_allowed_now: false,
      production_pass_enabled: false,
    },
    receipt_workbench_dashboard_handoff_smoke_boundary: {
      p23600_contract_ready: true,
      ready_for_p23601_handoff: ready,
      source_p23200_ready_for_p23201_handoff: ready,
      source_validation_valid_now: true,
      dashboard_consumer_contract_visible_now: true,
      handoff_adapter_smoke_visible_now: true,
      operator_visibility_rules_visible_now: true,
      no_serve_boundary_closed_now: true,
      dashboard_consumer_contract_count: 8,
      handoff_adapter_smoke_count: 5,
      operator_visibility_rule_count: 8,
      ...Object.fromEntries(HANDOFF_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(API_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(PROTECTED_FALSE_FLAGS.map((flag) => [flag, false])),
    },
    dashboard_consumer_contract_rows: CONSUMER_SLOTS.map((slot, index) => verdictRow({
      row_id: `dashboard_consumer.${index + 1}`,
      category: "dashboard_consumer_contract",
      label: `Dashboard consumer ${index + 1}`,
      source_row_ref: `dashboard_read_model.${index + 1}`,
      surface_slot: slot,
      receipt_type: index < 7 ? `receipt_${index + 1}` : null,
      display_state: index < 7 ? "task_open_read_only" : "blocker_visible",
      next_action: index < 7 ? "collect_redacted_receipt_candidate" : "resolve_visible_blocker",
      owner_lane: "operator",
      required_evidence: "redacted_receipt_candidate",
      detail_ref: `detail.${index + 1}`,
      bounded_payload_only: true,
      read_only: true,
      mutation_enabled: false,
      raw_body_returns: false,
      full_body_returns: false,
    })),
    handoff_adapter_smoke_rows: SMOKE_ROUTES.map(([route, slot], index) => verdictRow({
      row_id: `handoff_smoke.${index + 1}`,
      category: "handoff_adapter_smoke",
      label: `Handoff smoke ${route}`,
      route,
      method: "GET",
      head_allowed: true,
      collection_ref: `collection.${index + 1}`,
      dashboard_surface_slot: slot,
      smoke_cases: ["ready", "empty", "blocked", "error"],
      ready_case_visible: true,
      empty_case_visible: true,
      blocked_case_visible: true,
      error_case_visible: true,
      live_fetch_allowed_now: false,
      route_handler_registered_now: false,
      route_execution_allowed_now: false,
      write_enabled: false,
    })),
    operator_visibility_rule_rows: [
      "blocker_visible",
      "required_evidence_visible",
      "next_action_visible",
      "owner_lane_visible",
      "sanitized_field_boundary_visible",
      "conditional_review_visible",
      "adapter_blocked_error_cases_visible",
      "no_serve_boundary_visible",
    ].map((ruleId) => verdictRow({
      row_id: `visibility_rule.${ruleId}`,
      category: "operator_visibility_rule",
      label: `Visibility ${ruleId}`,
      rule_id: ruleId,
    })),
    no_serve_boundary_rows: [...HANDOFF_FALSE_FLAGS, ...API_FALSE_FLAGS, ...PROTECTED_FALSE_FLAGS].map((flag) => verdictRow({
      row_id: `no_serve.${flag}`,
      category: "no_serve_boundary",
      label: `${flag} remains false`,
      boundary_flag: flag,
      allowed_now: false,
    })),
  };
}

function verdictRow(fields) {
  return {
    observed: true,
    current_verdict: "pass",
    block_reason: null,
    evidence_ref: fields.row_id,
    generated_at: RUN_AT,
    ...fields,
  };
}

test("Receipt Workbench Operator Dashboard Screen Contract opens P24001 when P23600 source is ready", async () => {
  const source = buildP23600Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorDashboardScreenContract({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchDashboardHandoffSmoke: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.schema_version, "receipt-workbench-operator-dashboard-screen-contract.v1");
  assert.equal(result.program_range, "P23601-P24000");
  assert.equal(result.source_program_range, "P23201-P23600");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_dashboard_screen_contract_status, "ready_for_receipt_workbench_operator_dashboard_screen_contract");
  assert.equal(result.summary.source_p23600_ready_for_p23601_handoff, true);
  assert.equal(result.summary.operator_dashboard_screen_contract_count, 8);
  assert.equal(result.summary.interaction_state_checklist_count, 8);
  assert.ok(result.summary.read_only_data_binding_count >= 7);
  assert.equal(result.summary.ready_for_p24001_handoff, true);
  assert.equal(result.summary.screen_action_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Receipt Workbench Operator Dashboard Screen Contract keeps blocked P23600 as valid BLOCK", async () => {
  const source = buildP23600Source({ ready: false });
  const result = await buildReceiptWorkbenchOperatorDashboardScreenContract({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchDashboardHandoffSmoke: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_operator_dashboard_screen_contract_status, "valid_block_receipt_workbench_operator_dashboard_screen_contract_pending");
  assert.equal(result.summary.source_p23600_ready_for_p23601_handoff, false);
  assert.equal(result.summary.ready_for_p24001_handoff, false);
  assert.equal(result.p24000_clean_checkpoint_rows.find((row) => row.row_id === "p24000_checkpoint.p24001_handoff_blocker_visible").current_verdict, "pass");
});

test("Receipt Workbench Operator Dashboard Screen Contract exposes required interaction states without actions", async () => {
  const source = buildP23600Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorDashboardScreenContract({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchDashboardHandoffSmoke: source,
    commitRef: COMMIT_REF,
  });
  const states = new Set(result.interaction_state_checklist_rows.map((row) => row.interaction_state));

  for (const expected of ["ready", "empty", "loading", "error", "blocked", "stale", "review_pending", "redacted_payload"]) {
    assert.equal(states.has(expected), true, expected);
  }
  assert.equal(result.interaction_state_checklist_rows.every((row) => row.action_enabled_now === false), true);
  assert.equal(result.interaction_state_checklist_rows.every((row) => row.live_fetch_allowed_now === false), true);
});

test("Receipt Workbench Operator Dashboard Screen Contract keeps bindings read-only and redacted", async () => {
  const source = buildP23600Source({ ready: true });
  const result = await buildReceiptWorkbenchOperatorDashboardScreenContract({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchDashboardHandoffSmoke: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.read_only_data_binding_rows.every((row) => row.read_only === true), true);
  assert.equal(result.read_only_data_binding_rows.every((row) => row.mutation_enabled === false), true);
  assert.equal(result.read_only_data_binding_rows.every((row) => row.raw_body_returns === false), true);
  assert.equal(result.read_only_data_binding_rows.every((row) => row.forbidden_fields.includes("secret_material")), true);
  assert.equal(result.screen_resilience_guard_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.receipt_workbench_operator_dashboard_screen_contract_boundary.approve_button_enabled_now, false);
  assert.equal(result.receipt_workbench_operator_dashboard_screen_contract_boundary.final_automated_approval_allowed, false);
});

test("Receipt Workbench Operator Dashboard Screen Contract --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hermes-receipt-workbench-operator-dashboard-screen-contract-"));
  try {
    const sentinelPath = path.join(root, "receipt-workbench-operator-dashboard-screen-contract.json");
    const sentinel = '{ "sentinel": "receipt-workbench-operator-dashboard-screen-contract" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/receipt-workbench-operator-dashboard-screen-contract.mjs",
      "--check",
      "--out-dir",
      root,
      "--commit-ref",
      COMMIT_REF,
    ], { cwd: path.resolve("."), encoding: "utf8" });

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(await readFile(sentinelPath, "utf8"), sentinel);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
