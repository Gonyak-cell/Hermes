import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildReceiptWorkbenchDashboardArtifactPreview,
  runReceiptWorkbenchDashboardArtifactPreview,
} from "../src/receipt-workbench-dashboard-artifact-preview.mjs";

const RUN_AT = "2026-06-07T00:00:00.000Z";
const COMMIT_REF = "7e8d73b";

const PREVIEW_FALSE_FLAGS = [
  "preview_render_server_allowed_now",
  "preview_browser_run_allowed_now",
  "preview_screenshot_capture_allowed_now",
  "preview_live_data_fetch_allowed_now",
  "preview_click_action_allowed_now",
  "preview_state_mutation_allowed_now",
  "preview_export_allowed_now",
  "preview_publish_allowed_now",
  "preview_route_mount_allowed_now",
  "preview_final_approval_allowed_now",
];

const SCREEN_FALSE_FLAGS = [
  "screen_action_allowed_now",
  "screen_mutation_allowed_now",
  "interactive_control_enabled_now",
  "command_button_enabled_now",
  "approve_button_enabled_now",
  "merge_button_enabled_now",
  "deploy_button_enabled_now",
  "live_refresh_allowed_now",
  "detail_panel_write_allowed_now",
  "state_persistence_write_allowed_now",
  "final_screen_approval_allowed_now",
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

const SCREEN_SLOTS = [
  "header_status",
  "summary_bar",
  "task_list",
  "evidence_panel",
  "review_panel",
  "blocker_banner",
  "detail_panel",
  "next_action_panel",
];

const SNAPSHOT_STATES = [
  "ready",
  "empty",
  "loading",
  "error",
  "blocked",
  "stale",
  "review_pending",
  "redacted_payload",
];

function buildP24000Source({ ready = true } = {}) {
  return {
    schema_version: "receipt-workbench-operator-dashboard-screen-contract.v1",
    generated_at: RUN_AT,
    capability_id: "platform.receipt_workbench_operator_dashboard_screen_contract",
    program_range: "P23601-P24000",
    source_program_range: "P23201-P23600",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      receipt_workbench_operator_dashboard_screen_contract_status: ready
        ? "ready_for_receipt_workbench_operator_dashboard_screen_contract"
        : "valid_block_receipt_workbench_operator_dashboard_screen_contract_pending",
      source_p23600_ready_for_p23601_handoff: ready,
      operator_dashboard_screen_contract_count: 8,
      interaction_state_checklist_count: 8,
      read_only_data_binding_count: 8,
      screen_resilience_guard_count: 8,
      ready_for_p24001_handoff: ready,
      screen_action_allowed_now: false,
      production_pass_enabled: false,
    },
    receipt_workbench_operator_dashboard_screen_contract_boundary: {
      p24000_contract_ready: true,
      ready_for_p24001_handoff: ready,
      source_p23600_ready_for_p23601_handoff: ready,
      source_validation_valid_now: true,
      operator_dashboard_screen_contract_visible_now: true,
      interaction_state_checklist_visible_now: true,
      read_only_data_binding_visible_now: true,
      screen_resilience_guard_visible_now: true,
      no_action_boundary_closed_now: true,
      operator_dashboard_screen_contract_count: 8,
      interaction_state_checklist_count: 8,
      read_only_data_binding_count: 8,
      screen_resilience_guard_count: 8,
      ...Object.fromEntries(SCREEN_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(HANDOFF_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(API_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(PROTECTED_FALSE_FLAGS.map((flag) => [flag, false])),
    },
    operator_dashboard_screen_contract_rows: SCREEN_SLOTS.map((slot, index) => verdictRow({
      row_id: `screen_slot.${slot}`,
      category: "operator_dashboard_screen_contract",
      label: `Screen slot ${slot}`,
      screen_slot: slot,
      slot_order: index + 1,
      source_collection_ref: "dashboard_consumer_contract_rows",
      visible_now: true,
      visible_when_blocked: true,
      bounded_payload_only: true,
      read_only: true,
      raw_body_returns: false,
      full_body_returns: false,
      mutation_enabled: false,
      overflow_policy: "truncate_with_detail_ref",
    })),
    interaction_state_checklist_rows: SNAPSHOT_STATES.map((state) => verdictRow({
      row_id: `interaction_state.${state}`,
      category: "interaction_state_checklist",
      label: `Interaction ${state}`,
      interaction_state: state,
      visible_now: true,
      action_enabled_now: false,
      live_fetch_allowed_now: false,
      mutation_enabled: false,
    })),
    read_only_data_binding_rows: SCREEN_SLOTS.map((slot, index) => verdictRow({
      row_id: `data_binding.${slot}`,
      category: "read_only_data_binding",
      label: `Read-only data binding ${slot}`,
      source_row_ref: `dashboard_consumer.${index + 1}`,
      screen_slot: slot,
      source_surface_slot: `receipt_workbench.${slot}`,
      route_ref: `/api/receipt-workbench/${slot}`,
      visible_fields: ["row_id", "receipt_type", "display_state", "next_action", "owner_lane", "required_evidence", "detail_ref"],
      forbidden_fields: ["raw_stdout", "raw_stderr", "secret_material", "full_transcript", "protected_payload"],
      bounded_payload_only: true,
      read_only: true,
      raw_body_returns: false,
      full_body_returns: false,
      mutation_enabled: false,
    })),
    screen_resilience_guard_rows: [
      "bounded_payload_guard",
      "redaction_guard",
      "overflow_guard",
      "stale_state_guard",
      "hidden_blocker_guard",
      "review_pending_guard",
      "missing_source_guard",
      "no_action_guard",
    ].map((guardId) => verdictRow({
      row_id: `screen_resilience.${guardId}`,
      category: "screen_resilience_guard",
      label: `Screen resilience ${guardId}`,
      guard_id: guardId,
    })),
    no_action_boundary_rows: [...SCREEN_FALSE_FLAGS, ...HANDOFF_FALSE_FLAGS, ...API_FALSE_FLAGS, ...PROTECTED_FALSE_FLAGS].map((flag) => verdictRow({
      row_id: `no_action.${flag}`,
      category: "no_action_boundary",
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

test("Receipt Workbench Dashboard Artifact Preview opens P24401 when P24000 source is ready", async () => {
  const result = await buildReceiptWorkbenchDashboardArtifactPreview({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchOperatorDashboardScreenContract: buildP24000Source({ ready: true }),
    commitRef: COMMIT_REF,
  });

  assert.equal(result.schema_version, "receipt-workbench-dashboard-artifact-preview.v1");
  assert.equal(result.program_range, "P24001-P24400");
  assert.equal(result.source_program_range, "P23601-P24000");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_dashboard_artifact_preview_status, "ready_for_receipt_workbench_dashboard_artifact_preview");
  assert.equal(result.summary.source_p24000_ready_for_p24001_handoff, true);
  assert.equal(result.summary.preview_artifact_contract_count, 8);
  assert.equal(result.summary.snapshot_fixture_matrix_count, 8);
  assert.ok(result.summary.preview_data_projection_count >= 7);
  assert.equal(result.summary.ready_for_p24401_handoff, true);
  assert.equal(result.summary.preview_render_server_allowed_now, false);
  assert.equal(result.summary.preview_browser_run_allowed_now, false);
  assert.equal(result.summary.preview_click_action_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Receipt Workbench Dashboard Artifact Preview keeps blocked P24000 as valid BLOCK", async () => {
  const result = await buildReceiptWorkbenchDashboardArtifactPreview({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchOperatorDashboardScreenContract: buildP24000Source({ ready: false }),
    commitRef: COMMIT_REF,
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_dashboard_artifact_preview_status, "valid_block_receipt_workbench_dashboard_artifact_preview_pending");
  assert.equal(result.summary.source_p24000_ready_for_p24001_handoff, false);
  assert.equal(result.summary.ready_for_p24401_handoff, false);
  assert.equal(result.p24400_clean_checkpoint_rows.find((row) => row.row_id === "p24400_checkpoint.p24401_handoff_blocker_visible").current_verdict, "pass");
});

test("Receipt Workbench Dashboard Artifact Preview covers all snapshot states without render or live fetch", async () => {
  const result = await buildReceiptWorkbenchDashboardArtifactPreview({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchOperatorDashboardScreenContract: buildP24000Source({ ready: true }),
    commitRef: COMMIT_REF,
  });
  const states = new Set(result.snapshot_fixture_matrix_rows.map((row) => row.snapshot_state));

  for (const expected of SNAPSHOT_STATES) assert.equal(states.has(expected), true, expected);
  assert.equal(result.snapshot_fixture_matrix_rows.every((row) => row.render_required_now === false), true);
  assert.equal(result.snapshot_fixture_matrix_rows.every((row) => row.live_fetch_allowed_now === false), true);
  assert.equal(result.snapshot_fixture_matrix_rows.every((row) => row.mutation_enabled === false), true);
});

test("Receipt Workbench Dashboard Artifact Preview keeps projection read-only and no-render", async () => {
  const result = await buildReceiptWorkbenchDashboardArtifactPreview({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchOperatorDashboardScreenContract: buildP24000Source({ ready: true }),
    commitRef: COMMIT_REF,
  });

  assert.equal(result.preview_data_projection_rows.every((row) => row.read_only === true), true);
  assert.equal(result.preview_data_projection_rows.every((row) => row.mutation_enabled === false), true);
  assert.equal(result.preview_data_projection_rows.every((row) => row.render_required_now === false), true);
  assert.equal(result.preview_data_projection_rows.every((row) => row.forbidden_fields.includes("secret_material")), true);
  assert.equal(result.preview_safety_guard_rows.every((row) => row.current_verdict === "pass"), true);
  for (const flag of PREVIEW_FALSE_FLAGS) assert.equal(result.receipt_workbench_dashboard_artifact_preview_boundary[flag], false, flag);
});

test("Receipt Workbench Dashboard Artifact Preview check mode does not overwrite artifacts", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p24400-"));
  try {
    const sourcePath = path.join(tmpDir, "source.json");
    const schemaPath = path.resolve("schemas/receipt-workbench-dashboard-artifact-preview.schema.json");
    const packagePath = path.join(tmpDir, "package.json");
    const roadmapPath = path.join(tmpDir, "roadmap.md");
    const architecturePath = path.join(tmpDir, "architecture.md");
    const outDir = path.join(tmpDir, "out");

    await writeFile(sourcePath, `${JSON.stringify(buildP24000Source({ ready: true }), null, 2)}\n`, "utf8");
    await writeFile(packagePath, JSON.stringify({
      scripts: {
        "platform:receipt-workbench-dashboard-artifact-preview": "node scripts/receipt-workbench-dashboard-artifact-preview.mjs",
        validate: "npm run platform:receipt-workbench-dashboard-artifact-preview -- --check",
      },
    }), "utf8");
    await writeFile(roadmapPath, [
      "P24001-P24040 p24000_source_binding_rows",
      "P24041-P24120 preview_artifact_contract_rows",
      "P24121-P24200 snapshot_fixture_matrix_rows",
      "P24201-P24280 preview_data_projection_rows",
      "P24281-P24340 preview_safety_guard_rows",
      "P24341-P24380 no_render_boundary_rows",
      "P24381-P24400 p24400_clean_checkpoint_rows",
    ].join("\n"), "utf8");
    await writeFile(architecturePath, "P24001-P24400 Receipt Workbench Dashboard Artifact Preview\n", "utf8");

    const result = await runReceiptWorkbenchDashboardArtifactPreview({
      check: true,
      outDir,
      sourceReceiptWorkbenchOperatorDashboardScreenContractPath: sourcePath,
      schemaPath,
      packagePath,
      roadmapDocPath: roadmapPath,
      architectureDocPath: architecturePath,
      commitRef: COMMIT_REF,
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "receipt-workbench-dashboard-artifact-preview.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
