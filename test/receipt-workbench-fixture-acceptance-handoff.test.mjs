import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildReceiptWorkbenchFixtureAcceptanceHandoff,
  runReceiptWorkbenchFixtureAcceptanceHandoff,
} from "../src/receipt-workbench-fixture-acceptance-handoff.mjs";

const RUN_AT = "2026-06-07T00:00:00.000Z";
const COMMIT_REF = "84030b6";

const ACCEPTANCE_FALSE_FLAGS = [
  "fixture_acceptance_approval_allowed_now",
  "fixture_acceptance_closeout_allowed_now",
  "fixture_acceptance_apply_allowed_now",
  "fixture_acceptance_write_allowed_now",
  "fixture_acceptance_route_mount_allowed_now",
  "fixture_acceptance_live_fetch_allowed_now",
  "fixture_acceptance_mutation_allowed_now",
  "fixture_acceptance_export_allowed_now",
  "fixture_acceptance_publish_allowed_now",
  "fixture_acceptance_final_approval_allowed_now",
  "fixture_acceptance_production_pass_allowed_now",
  "fixture_acceptance_human_gate_bypass_allowed_now",
];

const CONSUMER_FALSE_FLAGS = [
  "dashboard_consumer_server_allowed_now",
  "dashboard_consumer_route_mount_allowed_now",
  "dashboard_consumer_live_fetch_allowed_now",
  "dashboard_consumer_render_allowed_now",
  "dashboard_consumer_browser_run_allowed_now",
  "dashboard_consumer_click_action_allowed_now",
  "dashboard_consumer_write_allowed_now",
  "dashboard_consumer_state_mutation_allowed_now",
  "dashboard_consumer_export_allowed_now",
  "dashboard_consumer_publish_allowed_now",
  "dashboard_consumer_final_approval_allowed_now",
];

const BUNDLE_FALSE_FLAGS = [
  "bundle_server_allowed_now",
  "bundle_write_allowed_now",
  "bundle_route_mount_allowed_now",
  "bundle_live_render_allowed_now",
  "bundle_browser_preview_allowed_now",
  "bundle_screenshot_allowed_now",
  "bundle_live_fetch_allowed_now",
  "bundle_click_action_allowed_now",
  "bundle_state_mutation_allowed_now",
  "bundle_export_allowed_now",
  "bundle_publish_allowed_now",
  "bundle_final_approval_allowed_now",
];

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

const PREVIEW_SURFACES = [
  ["status_preview", "header_status"],
  ["summary_preview", "summary_bar"],
  ["task_preview", "task_list"],
  ["evidence_preview", "evidence_panel"],
  ["review_preview", "review_panel"],
  ["blocker_preview", "blocker_banner"],
  ["detail_preview", "detail_panel"],
  ["next_action_preview", "next_action_panel"],
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

function buildP25200Source({ ready = true } = {}) {
  return {
    schema_version: "receipt-workbench-dashboard-consumer-fixture-smoke.v1",
    generated_at: RUN_AT,
    capability_id: "platform.receipt_workbench_dashboard_consumer_fixture_smoke",
    program_range: "P24801-P25200",
    source_program_range: "P24401-P24800",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      receipt_workbench_dashboard_consumer_fixture_smoke_status: ready
        ? "ready_for_receipt_workbench_dashboard_consumer_fixture_smoke"
        : "valid_block_receipt_workbench_dashboard_consumer_fixture_smoke_pending",
      source_p24800_ready_for_p24801_handoff: ready,
      dashboard_consumer_fixture_contract_count: 8,
      fixture_smoke_case_count: 8,
      read_only_adapter_map_count: 8,
      consumer_visibility_guard_count: 8,
      ready_for_p25201_handoff: ready,
      dashboard_consumer_server_allowed_now: false,
      dashboard_consumer_route_mount_allowed_now: false,
      dashboard_consumer_click_action_allowed_now: false,
      production_pass_enabled: false,
    },
    receipt_workbench_dashboard_consumer_fixture_smoke_boundary: {
      p25200_contract_ready: true,
      ready_for_p25201_handoff: ready,
      source_p24800_ready_for_p24801_handoff: ready,
      source_validation_valid_now: true,
      dashboard_consumer_fixture_contract_visible_now: true,
      fixture_smoke_case_visible_now: true,
      read_only_adapter_map_visible_now: true,
      consumer_visibility_guard_visible_now: true,
      no_serve_boundary_closed_now: true,
      dashboard_consumer_fixture_contract_count: 8,
      fixture_smoke_case_count: 8,
      read_only_adapter_map_count: 8,
      consumer_visibility_guard_count: 8,
      ...Object.fromEntries(CONSUMER_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(BUNDLE_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(PREVIEW_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(SCREEN_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(HANDOFF_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(API_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(PROTECTED_FALSE_FLAGS.map((flag) => [flag, false])),
    },
    dashboard_consumer_fixture_contract_rows: PREVIEW_SURFACES.map(([surface, slot], index) => verdictRow({
      row_id: `dashboard_consumer_fixture.${surface}`,
      category: "dashboard_consumer_fixture_contract",
      label: `Dashboard consumer fixture ${surface}`,
      source_consumer_fixture_row_ref: `consumer_fixture.${surface}`,
      bundle_id: `receipt_workbench.preview_bundle.${index + 1}`,
      preview_surface: surface,
      source_screen_slot: slot,
      consumer_surface_slot: `receipt_workbench.consumer_fixture.${surface}`,
      fixture_gallery_ref: "fixture_gallery_matrix_rows",
      smoke_case_ref: "fixture_smoke_case_rows",
      visible_when_blocked: true,
      bounded_payload_only: true,
      read_only: true,
      raw_body_returns: false,
      full_body_returns: false,
      server_required_now: false,
      route_mount_allowed_now: false,
      render_required_now: false,
      live_fetch_allowed_now: false,
      click_action_allowed_now: false,
      mutation_enabled: false,
    })),
    fixture_smoke_case_rows: SNAPSHOT_STATES.map((state) => verdictRow({
      row_id: `fixture_smoke.${state}`,
      category: "fixture_smoke_case",
      label: `Fixture smoke ${state}`,
      smoke_case_id: `fixture_smoke.${state}`,
      fixture_state: state,
      fixture_gallery_slot: `dashboard.fixture_gallery.${state}`,
      consumer_surface_count: 8,
      ready_case_visible: state === "ready",
      empty_case_visible: state === "empty",
      blocked_case_visible: ["blocked", "error", "stale", "review_pending"].includes(state),
      error_case_visible: state === "error",
      visible_now: true,
      visible_when_blocked: true,
      server_required_now: false,
      route_mount_allowed_now: false,
      live_fetch_allowed_now: false,
      render_required_now: false,
      mutation_enabled: false,
    })),
    read_only_adapter_map_rows: PREVIEW_SURFACES.map(([surface], index) => verdictRow({
      row_id: `adapter_map.${surface}`,
      category: "read_only_adapter_map",
      label: `Read-only adapter ${surface}`,
      source_payload_row_ref: `handoff_payload.${surface}`,
      consumer_fixture_row_ref: `dashboard_consumer_fixture.${surface}`,
      adapter_key: `receipt_workbench.consumer_fixture.adapter.${index + 1}`,
      payload_key: `receipt_workbench.preview_bundle.payload.${index + 1}`,
      preview_surface: surface,
      consumer_surface_slot: `receipt_workbench.consumer_fixture.${surface}`,
      visible_fields: ["row_id", "receipt_type", "display_state", "next_action", "owner_lane", "required_evidence", "detail_ref"],
      forbidden_fields: ["raw_stdout", "raw_stderr", "secret_material", "full_transcript", "protected_payload"],
      adapter_kind: "in_memory_fixture_projection",
      bounded_payload_only: true,
      include_summary_only: true,
      read_only: true,
      raw_body_returns: false,
      full_body_returns: false,
      server_required_now: false,
      route_handler_registered_now: false,
      route_execution_allowed_now: false,
      mutation_enabled: false,
    })),
    consumer_visibility_guard_rows: [
      "status_visible",
      "source_ref_visible",
      "blocker_visible",
      "required_evidence_visible",
      "validation_error_visible",
      "redaction_marker_visible",
      "stale_marker_visible",
      "no_action_notice_visible",
    ].map((guardId) => verdictRow({
      row_id: `consumer_visibility.${guardId}`,
      category: "consumer_visibility_guard",
      label: `Consumer visibility ${guardId}`,
      guard_id: guardId,
      visible_now: true,
      visible_when_blocked: true,
      read_only: true,
      action_enabled_now: false,
      adjudication_enabled_now: false,
      raw_body_returns: false,
    })),
    no_serve_boundary_rows: [...CONSUMER_FALSE_FLAGS, ...BUNDLE_FALSE_FLAGS, ...PREVIEW_FALSE_FLAGS, ...SCREEN_FALSE_FLAGS, ...HANDOFF_FALSE_FLAGS, ...API_FALSE_FLAGS, ...PROTECTED_FALSE_FLAGS].map((flag) => verdictRow({
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

test("Receipt Workbench Fixture Acceptance Handoff opens P25601 when P25200 source is ready", async () => {
  const result = await buildReceiptWorkbenchFixtureAcceptanceHandoff({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchDashboardConsumerFixtureSmoke: buildP25200Source({ ready: true }),
    commitRef: COMMIT_REF,
  });

  assert.equal(result.schema_version, "receipt-workbench-fixture-acceptance-handoff.v1");
  assert.equal(result.program_range, "P25201-P25600");
  assert.equal(result.source_program_range, "P24801-P25200");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_fixture_acceptance_handoff_status, "ready_for_receipt_workbench_fixture_acceptance_handoff");
  assert.equal(result.summary.source_p25200_ready_for_p25201_handoff, true);
  assert.equal(result.summary.acceptance_readiness_checklist_count, 8);
  assert.equal(result.summary.smoke_evidence_index_count, 8);
  assert.ok(result.summary.operator_handoff_contract_count >= 7);
  assert.equal(result.summary.acceptance_visibility_guard_count, 8);
  assert.equal(result.summary.ready_for_p25601_handoff, true);
  assert.equal(result.summary.fixture_acceptance_approval_allowed_now, false);
  assert.equal(result.summary.fixture_acceptance_closeout_allowed_now, false);
  assert.equal(result.summary.fixture_acceptance_apply_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Receipt Workbench Fixture Acceptance Handoff keeps blocked P25200 as valid BLOCK", async () => {
  const result = await buildReceiptWorkbenchFixtureAcceptanceHandoff({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchDashboardConsumerFixtureSmoke: buildP25200Source({ ready: false }),
    commitRef: COMMIT_REF,
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_fixture_acceptance_handoff_status, "valid_block_receipt_workbench_fixture_acceptance_handoff_pending");
  assert.equal(result.summary.source_p25200_ready_for_p25201_handoff, false);
  assert.equal(result.summary.ready_for_p25601_handoff, false);
  assert.equal(result.p25600_clean_checkpoint_rows.find((row) => row.row_id === "p25600_checkpoint.p25601_handoff_blocker_visible").current_verdict, "pass");
});

test("Receipt Workbench Fixture Acceptance Handoff indexes smoke evidence without serving or mutation", async () => {
  const result = await buildReceiptWorkbenchFixtureAcceptanceHandoff({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchDashboardConsumerFixtureSmoke: buildP25200Source({ ready: true }),
    commitRef: COMMIT_REF,
  });
  const states = new Set(result.smoke_evidence_index_rows.map((row) => row.fixture_state));

  for (const expected of SNAPSHOT_STATES) assert.equal(states.has(expected), true, expected);
  assert.equal(result.smoke_evidence_index_rows.every((row) => row.server_required_now === false), true);
  assert.equal(result.smoke_evidence_index_rows.every((row) => row.live_fetch_allowed_now === false), true);
  assert.equal(result.smoke_evidence_index_rows.every((row) => row.mutation_enabled === false), true);
});

test("Receipt Workbench Fixture Acceptance Handoff keeps handoff and visibility read-only", async () => {
  const result = await buildReceiptWorkbenchFixtureAcceptanceHandoff({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchDashboardConsumerFixtureSmoke: buildP25200Source({ ready: true }),
    commitRef: COMMIT_REF,
  });

  assert.equal(result.operator_handoff_contract_rows.every((row) => row.read_only === true), true);
  assert.equal(result.operator_handoff_contract_rows.every((row) => row.approval_allowed_now === false), true);
  assert.equal(result.operator_handoff_contract_rows.every((row) => row.closeout_allowed_now === false), true);
  assert.equal(result.acceptance_visibility_guard_rows.every((row) => row.action_enabled_now === false), true);
  assert.equal(result.acceptance_readiness_checklist_rows.every((row) => row.acceptance_verdict_emitted_now === false), true);
  for (const flag of ACCEPTANCE_FALSE_FLAGS) assert.equal(result.receipt_workbench_fixture_acceptance_handoff_boundary[flag], false, flag);
});

test("Receipt Workbench Fixture Acceptance Handoff check mode does not overwrite artifacts", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p25600-"));
  try {
    const sourcePath = path.join(tmpDir, "source.json");
    const schemaPath = path.resolve("schemas/receipt-workbench-fixture-acceptance-handoff.schema.json");
    const packagePath = path.join(tmpDir, "package.json");
    const roadmapPath = path.join(tmpDir, "roadmap.md");
    const architecturePath = path.join(tmpDir, "architecture.md");
    const outDir = path.join(tmpDir, "out");

    await writeFile(sourcePath, `${JSON.stringify(buildP25200Source({ ready: true }), null, 2)}\n`, "utf8");
    await writeFile(packagePath, JSON.stringify({
      scripts: {
        "platform:receipt-workbench-fixture-acceptance-handoff": "node scripts/receipt-workbench-fixture-acceptance-handoff.mjs",
        validate: "npm run platform:receipt-workbench-fixture-acceptance-handoff -- --check",
      },
    }), "utf8");
    await writeFile(roadmapPath, [
      "P25201-P25240 p25200_source_binding_rows",
      "P25241-P25320 acceptance_readiness_checklist_rows",
      "P25321-P25400 smoke_evidence_index_rows",
      "P25401-P25480 operator_handoff_contract_rows",
      "P25481-P25540 acceptance_visibility_guard_rows",
      "P25541-P25580 no_acceptance_boundary_rows",
      "P25581-P25600 p25600_clean_checkpoint_rows",
    ].join("\n"), "utf8");
    await writeFile(architecturePath, "P25201-P25600 Receipt Workbench Fixture Acceptance Handoff\n", "utf8");

    const result = await runReceiptWorkbenchFixtureAcceptanceHandoff({
      check: true,
      outDir,
      sourceReceiptWorkbenchDashboardConsumerFixtureSmokePath: sourcePath,
      schemaPath,
      packagePath,
      roadmapDocPath: roadmapPath,
      architectureDocPath: architecturePath,
      commitRef: COMMIT_REF,
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "receipt-workbench-fixture-acceptance-handoff.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
