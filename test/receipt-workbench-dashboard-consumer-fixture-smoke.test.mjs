import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildReceiptWorkbenchDashboardConsumerFixtureSmoke,
  runReceiptWorkbenchDashboardConsumerFixtureSmoke,
} from "../src/receipt-workbench-dashboard-consumer-fixture-smoke.mjs";

const RUN_AT = "2026-06-07T00:00:00.000Z";
const COMMIT_REF = "be59d1e";

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

function buildP24800Source({ ready = true } = {}) {
  return {
    schema_version: "receipt-workbench-preview-bundle-handoff.v1",
    generated_at: RUN_AT,
    capability_id: "platform.receipt_workbench_preview_bundle_handoff",
    program_range: "P24401-P24800",
    source_program_range: "P24001-P24400",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      receipt_workbench_preview_bundle_handoff_status: ready
        ? "ready_for_receipt_workbench_preview_bundle_handoff"
        : "valid_block_receipt_workbench_preview_bundle_handoff_pending",
      source_p24400_ready_for_p24401_handoff: ready,
      preview_bundle_manifest_count: 8,
      fixture_gallery_matrix_count: 8,
      handoff_payload_projection_count: 8,
      operator_review_affordance_count: 8,
      ready_for_p24801_handoff: ready,
      bundle_server_allowed_now: false,
      bundle_route_mount_allowed_now: false,
      bundle_click_action_allowed_now: false,
      production_pass_enabled: false,
    },
    receipt_workbench_preview_bundle_handoff_boundary: {
      p24800_contract_ready: true,
      ready_for_p24801_handoff: ready,
      source_p24400_ready_for_p24401_handoff: ready,
      source_validation_valid_now: true,
      preview_bundle_manifest_visible_now: true,
      fixture_gallery_matrix_visible_now: true,
      handoff_payload_projection_visible_now: true,
      operator_review_affordance_visible_now: true,
      no_serve_boundary_closed_now: true,
      preview_bundle_manifest_count: 8,
      fixture_gallery_matrix_count: 8,
      handoff_payload_projection_count: 8,
      operator_review_affordance_count: 8,
      ...Object.fromEntries(BUNDLE_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(PREVIEW_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(SCREEN_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(HANDOFF_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(API_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(PROTECTED_FALSE_FLAGS.map((flag) => [flag, false])),
    },
    preview_bundle_manifest_rows: PREVIEW_SURFACES.map(([surface, slot], index) => verdictRow({
      row_id: `preview_bundle.${surface}`,
      category: "preview_bundle_manifest",
      label: `Preview bundle ${surface}`,
      bundle_id: `receipt_workbench.preview_bundle.${index + 1}`,
      preview_surface: surface,
      source_screen_slot: slot,
      fixture_collection_ref: "fixture_gallery_matrix_rows",
      handoff_slot: `dashboard.preview_bundle.${surface}`,
      artifact_kind: "read_only_preview_bundle_entry",
      bundle_version: "v1",
      include_summary_only: true,
      visible_when_blocked: true,
      bounded_payload_only: true,
      read_only: true,
      raw_body_returns: false,
      full_body_returns: false,
      serve_required_now: false,
      render_required_now: false,
      browser_required_now: false,
      mutation_enabled: false,
    })),
    fixture_gallery_matrix_rows: SNAPSHOT_STATES.map((state, index) => verdictRow({
      row_id: `fixture_gallery.${state}`,
      category: "fixture_gallery_matrix",
      label: `Fixture gallery ${state}`,
      fixture_state: state,
      fixture_gallery_slot: `dashboard.fixture_gallery.${state}`,
      source_snapshot_row_ref: `snapshot_fixture.${state}`,
      state_order: index + 1,
      preview_surface_count: 8,
      visible_now: true,
      visible_when_blocked: true,
      render_required_now: false,
      browser_required_now: false,
      live_fetch_allowed_now: false,
      mutation_enabled: false,
      blocked_state_visible: ["blocked", "error", "stale", "review_pending"].includes(state),
    })),
    handoff_payload_projection_rows: PREVIEW_SURFACES.map(([surface, slot], index) => verdictRow({
      row_id: `handoff_payload.${surface}`,
      category: "handoff_payload_projection",
      label: `Handoff payload ${surface}`,
      source_projection_row_ref: `preview_projection.${surface}`,
      bundle_row_ref: `preview_bundle.${surface}`,
      payload_key: `receipt_workbench.preview_bundle.payload.${index + 1}`,
      preview_surface: surface,
      screen_slot: slot,
      visible_fields: ["row_id", "receipt_type", "display_state", "next_action", "owner_lane", "required_evidence", "detail_ref"],
      forbidden_fields: ["raw_stdout", "raw_stderr", "secret_material", "full_transcript", "protected_payload"],
      bounded_payload_only: true,
      include_summary_only: true,
      read_only: true,
      raw_body_returns: false,
      full_body_returns: false,
      serve_required_now: false,
      route_mount_allowed_now: false,
      mutation_enabled: false,
    })),
    operator_review_affordance_rows: [
      "status_visible",
      "source_ref_visible",
      "blocker_visible",
      "required_evidence_visible",
      "validation_error_visible",
      "redaction_marker_visible",
      "stale_marker_visible",
      "no_action_notice_visible",
    ].map((affordanceId) => verdictRow({
      row_id: `review_affordance.${affordanceId}`,
      category: "operator_review_affordance",
      label: `Review affordance ${affordanceId}`,
      affordance_id: affordanceId,
      visible_now: true,
      visible_when_blocked: true,
      read_only: true,
      action_enabled_now: false,
      adjudication_enabled_now: false,
      reviewer_mutation_allowed_now: false,
    })),
    no_serve_boundary_rows: [...BUNDLE_FALSE_FLAGS, ...PREVIEW_FALSE_FLAGS, ...SCREEN_FALSE_FLAGS, ...HANDOFF_FALSE_FLAGS, ...API_FALSE_FLAGS, ...PROTECTED_FALSE_FLAGS].map((flag) => verdictRow({
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

test("Receipt Workbench Dashboard Consumer Fixture Smoke opens P25201 when P24800 source is ready", async () => {
  const result = await buildReceiptWorkbenchDashboardConsumerFixtureSmoke({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchPreviewBundleHandoff: buildP24800Source({ ready: true }),
    commitRef: COMMIT_REF,
  });

  assert.equal(result.schema_version, "receipt-workbench-dashboard-consumer-fixture-smoke.v1");
  assert.equal(result.program_range, "P24801-P25200");
  assert.equal(result.source_program_range, "P24401-P24800");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_dashboard_consumer_fixture_smoke_status, "ready_for_receipt_workbench_dashboard_consumer_fixture_smoke");
  assert.equal(result.summary.source_p24800_ready_for_p24801_handoff, true);
  assert.equal(result.summary.dashboard_consumer_fixture_contract_count, 8);
  assert.equal(result.summary.fixture_smoke_case_count, 8);
  assert.ok(result.summary.read_only_adapter_map_count >= 7);
  assert.equal(result.summary.consumer_visibility_guard_count, 8);
  assert.equal(result.summary.ready_for_p25201_handoff, true);
  assert.equal(result.summary.dashboard_consumer_server_allowed_now, false);
  assert.equal(result.summary.dashboard_consumer_route_mount_allowed_now, false);
  assert.equal(result.summary.dashboard_consumer_click_action_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Receipt Workbench Dashboard Consumer Fixture Smoke keeps blocked P24800 as valid BLOCK", async () => {
  const result = await buildReceiptWorkbenchDashboardConsumerFixtureSmoke({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchPreviewBundleHandoff: buildP24800Source({ ready: false }),
    commitRef: COMMIT_REF,
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_dashboard_consumer_fixture_smoke_status, "valid_block_receipt_workbench_dashboard_consumer_fixture_smoke_pending");
  assert.equal(result.summary.source_p24800_ready_for_p24801_handoff, false);
  assert.equal(result.summary.ready_for_p25201_handoff, false);
  assert.equal(result.p25200_clean_checkpoint_rows.find((row) => row.row_id === "p25200_checkpoint.p25201_handoff_blocker_visible").current_verdict, "pass");
});

test("Receipt Workbench Dashboard Consumer Fixture Smoke covers fixture smoke states without serving", async () => {
  const result = await buildReceiptWorkbenchDashboardConsumerFixtureSmoke({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchPreviewBundleHandoff: buildP24800Source({ ready: true }),
    commitRef: COMMIT_REF,
  });
  const states = new Set(result.fixture_smoke_case_rows.map((row) => row.fixture_state));

  for (const expected of SNAPSHOT_STATES) assert.equal(states.has(expected), true, expected);
  assert.equal(result.fixture_smoke_case_rows.every((row) => row.server_required_now === false), true);
  assert.equal(result.fixture_smoke_case_rows.every((row) => row.route_mount_allowed_now === false), true);
  assert.equal(result.fixture_smoke_case_rows.every((row) => row.live_fetch_allowed_now === false), true);
  assert.equal(result.fixture_smoke_case_rows.every((row) => row.mutation_enabled === false), true);
});

test("Receipt Workbench Dashboard Consumer Fixture Smoke keeps adapters and guards read-only", async () => {
  const result = await buildReceiptWorkbenchDashboardConsumerFixtureSmoke({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchPreviewBundleHandoff: buildP24800Source({ ready: true }),
    commitRef: COMMIT_REF,
  });

  assert.equal(result.read_only_adapter_map_rows.every((row) => row.read_only === true), true);
  assert.equal(result.read_only_adapter_map_rows.every((row) => row.mutation_enabled === false), true);
  assert.equal(result.read_only_adapter_map_rows.every((row) => row.server_required_now === false), true);
  assert.equal(result.read_only_adapter_map_rows.every((row) => row.forbidden_fields.includes("secret_material")), true);
  assert.equal(result.consumer_visibility_guard_rows.every((row) => row.action_enabled_now === false), true);
  assert.equal(result.consumer_visibility_guard_rows.every((row) => row.raw_body_returns === false), true);
  for (const flag of CONSUMER_FALSE_FLAGS) assert.equal(result.receipt_workbench_dashboard_consumer_fixture_smoke_boundary[flag], false, flag);
});

test("Receipt Workbench Dashboard Consumer Fixture Smoke check mode does not overwrite artifacts", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p25200-"));
  try {
    const sourcePath = path.join(tmpDir, "source.json");
    const schemaPath = path.resolve("schemas/receipt-workbench-dashboard-consumer-fixture-smoke.schema.json");
    const packagePath = path.join(tmpDir, "package.json");
    const roadmapPath = path.join(tmpDir, "roadmap.md");
    const architecturePath = path.join(tmpDir, "architecture.md");
    const outDir = path.join(tmpDir, "out");

    await writeFile(sourcePath, `${JSON.stringify(buildP24800Source({ ready: true }), null, 2)}\n`, "utf8");
    await writeFile(packagePath, JSON.stringify({
      scripts: {
        "platform:receipt-workbench-dashboard-consumer-fixture-smoke": "node scripts/receipt-workbench-dashboard-consumer-fixture-smoke.mjs",
        validate: "npm run platform:receipt-workbench-dashboard-consumer-fixture-smoke -- --check",
      },
    }), "utf8");
    await writeFile(roadmapPath, [
      "P24801-P24840 p24800_source_binding_rows",
      "P24841-P24920 dashboard_consumer_fixture_contract_rows",
      "P24921-P25000 fixture_smoke_case_rows",
      "P25001-P25080 read_only_adapter_map_rows",
      "P25081-P25140 consumer_visibility_guard_rows",
      "P25141-P25180 no_serve_boundary_rows",
      "P25181-P25200 p25200_clean_checkpoint_rows",
    ].join("\n"), "utf8");
    await writeFile(architecturePath, "P24801-P25200 Receipt Workbench Dashboard Consumer Fixture Smoke\n", "utf8");

    const result = await runReceiptWorkbenchDashboardConsumerFixtureSmoke({
      check: true,
      outDir,
      sourceReceiptWorkbenchPreviewBundleHandoffPath: sourcePath,
      schemaPath,
      packagePath,
      roadmapDocPath: roadmapPath,
      architectureDocPath: architecturePath,
      commitRef: COMMIT_REF,
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "receipt-workbench-dashboard-consumer-fixture-smoke.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
