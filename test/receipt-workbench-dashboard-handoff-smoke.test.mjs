import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildReceiptWorkbenchDashboardHandoffSmoke } from "../src/receipt-workbench-dashboard-handoff-smoke.mjs";

const RUN_AT = "2026-06-07T00:00:00.000Z";
const COMMIT_REF = "a2a0297";

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

const RECEIPT_TYPES = [
  "syntax_check",
  "targeted_tests",
  "adjacent_tests",
  "platform_cli_check",
  "diff_check",
  "full_npm_test",
  "claude_review",
];

const API_ROUTES = [
  ["/api/receipt-workbench/tasks", "operator_workbench_task_rows"],
  ["/api/receipt-workbench/remediation-drafts", "remediation_plan_draft_rows"],
  ["/api/receipt-workbench/evidence-requests", "evidence_request_packet_rows"],
  ["/api/receipt-workbench/review-router", "review_escalation_router_rows"],
  ["/api/receipt-workbench/summary", "ui_status_summary_rows"],
];

const FIELDS = [
  ["row_id", true],
  ["receipt_type", true],
  ["task_state", true],
  ["next_action", true],
  ["owner_lane", true],
  ["required_evidence", true],
  ["evidence_ref", true],
  ["route_ref", true],
  ["raw_stdout", false],
  ["raw_stderr", false],
  ["secret_material", false],
  ["full_transcript", false],
  ["protected_payload", false],
];

function buildP23200Source({ ready = true } = {}) {
  return {
    schema_version: "receipt-workbench-api-read-model.v1",
    generated_at: RUN_AT,
    capability_id: "platform.receipt_workbench_api_read_model",
    program_range: "P22801-P23200",
    source_program_range: "P22401-P22800",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      receipt_workbench_api_read_model_status: ready
        ? "ready_for_receipt_workbench_api_read_model"
        : "valid_block_receipt_workbench_api_read_model_pending",
      ready_for_p23201_handoff: ready,
      source_p22800_ready_for_p22801_handoff: ready,
      dashboard_read_model_count: 8,
      read_only_api_projection_count: 5,
      sanitized_field_count: 13,
      ui_status_summary_count: 7,
      server_started_now: false,
      api_write_allowed_now: false,
      production_pass_enabled: false,
    },
    receipt_workbench_api_read_model_boundary: {
      p23200_contract_ready: true,
      ready_for_p23201_handoff: ready,
      source_p22800_ready_for_p22801_handoff: ready,
      source_validation_valid_now: true,
      dashboard_read_model_visible_now: true,
      read_only_api_projection_visible_now: true,
      sanitized_field_map_visible_now: true,
      ui_status_summary_visible_now: true,
      no_route_boundary_closed_now: true,
      dashboard_read_model_count: 8,
      read_only_api_projection_count: 5,
      sanitized_field_count: 13,
      ui_status_summary_count: 7,
      safe_exposed_field_count: 8,
      blocked_sensitive_field_count: 5,
      ...Object.fromEntries(API_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(PROTECTED_FALSE_FLAGS.map((flag) => [flag, false])),
    },
    dashboard_read_model_rows: [
      ...RECEIPT_TYPES.map((receiptType, index) => verdictRow({
        row_id: `dashboard_read_model.${receiptType}`,
        category: "dashboard_read_model",
        label: `Dashboard read model for ${receiptType}`,
        receipt_type: receiptType,
        model_order: index + 1,
        display_state: "task_open_read_only",
        next_action: "collect_redacted_receipt_candidate",
        owner_lane: "operator",
        required_evidence: "redacted_receipt_candidate",
        detail_ref: `evidence_request.${receiptType}`,
        raw_body_returns: false,
        full_body_returns: false,
        write_enabled: false,
      })),
      verdictRow({
        row_id: "dashboard_read_model.blocker_visibility",
        category: "dashboard_read_model",
        label: "Dashboard blocker visibility row",
        display_state: "blocker_visible",
        next_action: "resolve_missing_or_unaccepted_receipt_evidence",
        raw_body_returns: false,
        full_body_returns: false,
        write_enabled: false,
      }),
    ],
    read_only_api_projection_rows: API_ROUTES.map(([route, collectionRef], index) => verdictRow({
      row_id: `api_projection.${index + 1}`,
      category: "read_only_api_projection",
      label: `Read-only API projection ${route}`,
      route,
      method: "GET",
      head_allowed: true,
      read_only: true,
      collection_ref: collectionRef,
      write_enabled: false,
      mutates_state: false,
      server_start_required_now: false,
      route_handler_registered_now: false,
      route_execution_allowed_now: false,
      raw_body_returns: false,
      full_body_returns: false,
    })),
    sanitized_field_map_rows: FIELDS.map(([fieldName, exposed]) => verdictRow({
      row_id: `sanitized_field.${fieldName}`,
      category: "sanitized_field_map",
      label: `Sanitized field ${fieldName}`,
      field_name: fieldName,
      exposed_now: exposed,
      raw_or_secret_material: !exposed,
    })),
    ui_status_summary_rows: [
      ["open_tasks", 7],
      ["remediation_drafts", 7],
      ["evidence_requests", 7],
      ["conditional_reviews", 2],
      ["blockers_visible", 1],
      ["read_only_api_projection", 5],
      ["no_route_boundary", 1],
    ].map(([statusKey, statusValue]) => verdictRow({
      row_id: `ui_status.${statusKey}`,
      category: "ui_status_summary",
      label: `UI status ${statusKey}`,
      status_key: statusKey,
      status_value: statusValue,
      read_only: true,
    })),
    no_route_boundary_rows: [...API_FALSE_FLAGS, ...PROTECTED_FALSE_FLAGS].map((flag) => verdictRow({
      row_id: `no_route.${flag}`,
      category: "no_route_boundary",
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

test("Receipt Workbench Dashboard Handoff Smoke opens P23601 when P23200 source is ready", async () => {
  const source = buildP23200Source({ ready: true });
  const result = await buildReceiptWorkbenchDashboardHandoffSmoke({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchApiReadModel: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.schema_version, "receipt-workbench-dashboard-handoff-smoke.v1");
  assert.equal(result.program_range, "P23201-P23600");
  assert.equal(result.source_program_range, "P22801-P23200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_dashboard_handoff_smoke_status, "ready_for_receipt_workbench_dashboard_handoff_smoke");
  assert.equal(result.summary.source_p23200_ready_for_p23201_handoff, true);
  assert.ok(result.summary.dashboard_consumer_contract_count >= 7);
  assert.equal(result.summary.handoff_adapter_smoke_count, 5);
  assert.equal(result.summary.operator_visibility_rule_count, 8);
  assert.equal(result.summary.ready_for_p23601_handoff, true);
  assert.equal(result.summary.live_fetch_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Receipt Workbench Dashboard Handoff Smoke keeps blocked P23200 as valid BLOCK", async () => {
  const source = buildP23200Source({ ready: false });
  const result = await buildReceiptWorkbenchDashboardHandoffSmoke({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchApiReadModel: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_dashboard_handoff_smoke_status, "valid_block_receipt_workbench_dashboard_handoff_smoke_pending");
  assert.equal(result.summary.source_p23200_ready_for_p23201_handoff, false);
  assert.equal(result.summary.ready_for_p23601_handoff, false);
  assert.equal(result.p23600_clean_checkpoint_rows.find((row) => row.row_id === "p23600_checkpoint.p23601_handoff_blocker_visible").current_verdict, "pass");
});

test("Receipt Workbench Dashboard Handoff Smoke maps all adapter smoke cases without live fetch", async () => {
  const source = buildP23200Source({ ready: true });
  const result = await buildReceiptWorkbenchDashboardHandoffSmoke({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchApiReadModel: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.handoff_adapter_smoke_rows.every((row) => row.smoke_cases.includes("ready")), true);
  assert.equal(result.handoff_adapter_smoke_rows.every((row) => row.smoke_cases.includes("empty")), true);
  assert.equal(result.handoff_adapter_smoke_rows.every((row) => row.smoke_cases.includes("blocked")), true);
  assert.equal(result.handoff_adapter_smoke_rows.every((row) => row.smoke_cases.includes("error")), true);
  assert.equal(result.handoff_adapter_smoke_rows.every((row) => row.live_fetch_allowed_now === false), true);
  assert.equal(result.handoff_adapter_smoke_rows.every((row) => row.route_handler_registered_now === false), true);
  assert.equal(result.handoff_adapter_smoke_rows.every((row) => row.route_execution_allowed_now === false), true);
});

test("Receipt Workbench Dashboard Handoff Smoke preserves visibility and no-mutation boundaries", async () => {
  const source = buildP23200Source({ ready: true });
  const result = await buildReceiptWorkbenchDashboardHandoffSmoke({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchApiReadModel: source,
    commitRef: COMMIT_REF,
  });

  assert.equal(result.operator_visibility_rule_rows.every((row) => row.current_verdict === "pass"), true);
  assert.equal(result.dashboard_consumer_contract_rows.every((row) => row.raw_body_returns === false), true);
  assert.equal(result.dashboard_consumer_contract_rows.every((row) => row.full_body_returns === false), true);
  assert.equal(result.dashboard_consumer_contract_rows.every((row) => row.mutation_enabled === false), true);
  assert.equal(result.receipt_workbench_dashboard_handoff_smoke_boundary.server_started_now, false);
  assert.equal(result.receipt_workbench_dashboard_handoff_smoke_boundary.live_fetch_allowed_now, false);
  assert.equal(result.receipt_workbench_dashboard_handoff_smoke_boundary.dashboard_mutation_allowed_now, false);
  assert.equal(result.receipt_workbench_dashboard_handoff_smoke_boundary.final_automated_approval_allowed, false);
});

test("Receipt Workbench Dashboard Handoff Smoke --check does not overwrite existing artifacts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hermes-receipt-workbench-dashboard-handoff-smoke-"));
  try {
    const sentinelPath = path.join(root, "receipt-workbench-dashboard-handoff-smoke.json");
    const sentinel = '{ "sentinel": "receipt-workbench-dashboard-handoff-smoke" }\n';
    await writeFile(sentinelPath, sentinel, "utf8");

    const result = spawnSync("node", [
      "scripts/receipt-workbench-dashboard-handoff-smoke.mjs",
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
