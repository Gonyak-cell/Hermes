import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildReceiptWorkbenchPreviewBundleHandoff,
  runReceiptWorkbenchPreviewBundleHandoff,
} from "../src/receipt-workbench-preview-bundle-handoff.mjs";

const RUN_AT = "2026-06-07T00:00:00.000Z";
const COMMIT_REF = "bace560";

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

function buildP24400Source({ ready = true } = {}) {
  return {
    schema_version: "receipt-workbench-dashboard-artifact-preview.v1",
    generated_at: RUN_AT,
    capability_id: "platform.receipt_workbench_dashboard_artifact_preview",
    program_range: "P24001-P24400",
    source_program_range: "P23601-P24000",
    validation: { valid: true, error_count: 0, errors: [] },
    summary: {
      receipt_workbench_dashboard_artifact_preview_status: ready
        ? "ready_for_receipt_workbench_dashboard_artifact_preview"
        : "valid_block_receipt_workbench_dashboard_artifact_preview_pending",
      source_p24000_ready_for_p24001_handoff: ready,
      preview_artifact_contract_count: 8,
      snapshot_fixture_matrix_count: 8,
      preview_data_projection_count: 8,
      preview_safety_guard_count: 8,
      ready_for_p24401_handoff: ready,
      preview_render_server_allowed_now: false,
      preview_browser_run_allowed_now: false,
      preview_click_action_allowed_now: false,
      production_pass_enabled: false,
    },
    receipt_workbench_dashboard_artifact_preview_boundary: {
      p24400_contract_ready: true,
      ready_for_p24401_handoff: ready,
      source_p24000_ready_for_p24001_handoff: ready,
      source_validation_valid_now: true,
      preview_artifact_contract_visible_now: true,
      snapshot_fixture_matrix_visible_now: true,
      preview_data_projection_visible_now: true,
      preview_safety_guard_visible_now: true,
      no_render_boundary_closed_now: true,
      preview_artifact_contract_count: 8,
      snapshot_fixture_matrix_count: 8,
      preview_data_projection_count: 8,
      preview_safety_guard_count: 8,
      ...Object.fromEntries(PREVIEW_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(SCREEN_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(HANDOFF_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(API_FALSE_FLAGS.map((flag) => [flag, false])),
      ...Object.fromEntries(PROTECTED_FALSE_FLAGS.map((flag) => [flag, false])),
    },
    preview_artifact_contract_rows: PREVIEW_SURFACES.map(([surface, slot], index) => verdictRow({
      row_id: `preview_artifact.${surface}`,
      category: "preview_artifact_contract",
      label: `Preview ${surface}`,
      preview_surface: surface,
      source_screen_slot: slot,
      screen_slot: slot,
      surface_order: index + 1,
      artifact_kind: "read_only_preview_panel",
      fixture_required: true,
      render_required_now: false,
      browser_required_now: false,
      bounded_payload_only: true,
      read_only: true,
      raw_body_returns: false,
      full_body_returns: false,
      mutation_enabled: false,
      visible_when_blocked: true,
    })),
    snapshot_fixture_matrix_rows: SNAPSHOT_STATES.map((state) => verdictRow({
      row_id: `snapshot_fixture.${state}`,
      category: "snapshot_fixture_matrix",
      label: `Snapshot ${state}`,
      snapshot_state: state,
      fixture_kind: "bounded_read_only_preview_snapshot",
      visible_now: true,
      render_required_now: false,
      browser_required_now: false,
      live_fetch_allowed_now: false,
      mutation_enabled: false,
      blocked_state_visible: ["blocked", "error", "stale", "review_pending"].includes(state),
    })),
    preview_data_projection_rows: PREVIEW_SURFACES.map(([surface, slot], index) => verdictRow({
      row_id: `preview_projection.${surface}`,
      category: "preview_data_projection",
      label: `Preview data projection ${surface}`,
      source_binding_row_ref: `data_binding.${slot}`,
      preview_surface: surface,
      screen_slot: slot,
      visible_fields: ["row_id", "receipt_type", "display_state", "next_action", "owner_lane", "required_evidence", "detail_ref"],
      forbidden_fields: ["raw_stdout", "raw_stderr", "secret_material", "full_transcript", "protected_payload"],
      bounded_payload_only: true,
      read_only: true,
      raw_body_returns: false,
      full_body_returns: false,
      mutation_enabled: false,
      render_required_now: false,
      browser_required_now: false,
    })),
    preview_safety_guard_rows: [
      "bounded_payload_guard",
      "redaction_guard",
      "no_raw_guard",
      "hidden_blocker_guard",
      "stale_fixture_guard",
      "no_render_guard",
      "no_export_guard",
      "no_action_guard",
    ].map((guardId) => verdictRow({
      row_id: `preview_safety.${guardId}`,
      category: "preview_safety_guard",
      label: `Preview safety ${guardId}`,
      guard_id: guardId,
    })),
    no_render_boundary_rows: [...PREVIEW_FALSE_FLAGS, ...SCREEN_FALSE_FLAGS, ...HANDOFF_FALSE_FLAGS, ...API_FALSE_FLAGS, ...PROTECTED_FALSE_FLAGS].map((flag) => verdictRow({
      row_id: `no_render.${flag}`,
      category: "no_render_boundary",
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

test("Receipt Workbench Preview Bundle Handoff opens P24801 when P24400 source is ready", async () => {
  const result = await buildReceiptWorkbenchPreviewBundleHandoff({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchDashboardArtifactPreview: buildP24400Source({ ready: true }),
    commitRef: COMMIT_REF,
  });

  assert.equal(result.schema_version, "receipt-workbench-preview-bundle-handoff.v1");
  assert.equal(result.program_range, "P24401-P24800");
  assert.equal(result.source_program_range, "P24001-P24400");
  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_preview_bundle_handoff_status, "ready_for_receipt_workbench_preview_bundle_handoff");
  assert.equal(result.summary.source_p24400_ready_for_p24401_handoff, true);
  assert.equal(result.summary.preview_bundle_manifest_count, 8);
  assert.equal(result.summary.fixture_gallery_matrix_count, 8);
  assert.ok(result.summary.handoff_payload_projection_count >= 7);
  assert.equal(result.summary.operator_review_affordance_count, 8);
  assert.equal(result.summary.ready_for_p24801_handoff, true);
  assert.equal(result.summary.bundle_server_allowed_now, false);
  assert.equal(result.summary.bundle_route_mount_allowed_now, false);
  assert.equal(result.summary.bundle_click_action_allowed_now, false);
  assert.equal(result.summary.production_pass_enabled, false);
});

test("Receipt Workbench Preview Bundle Handoff keeps blocked P24400 as valid BLOCK", async () => {
  const result = await buildReceiptWorkbenchPreviewBundleHandoff({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchDashboardArtifactPreview: buildP24400Source({ ready: false }),
    commitRef: COMMIT_REF,
  });

  assert.equal(result.validation.valid, true);
  assert.equal(result.summary.receipt_workbench_preview_bundle_handoff_status, "valid_block_receipt_workbench_preview_bundle_handoff_pending");
  assert.equal(result.summary.source_p24400_ready_for_p24401_handoff, false);
  assert.equal(result.summary.ready_for_p24801_handoff, false);
  assert.equal(result.p24800_clean_checkpoint_rows.find((row) => row.row_id === "p24800_checkpoint.p24801_handoff_blocker_visible").current_verdict, "pass");
});

test("Receipt Workbench Preview Bundle Handoff covers fixture gallery states without serving", async () => {
  const result = await buildReceiptWorkbenchPreviewBundleHandoff({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchDashboardArtifactPreview: buildP24400Source({ ready: true }),
    commitRef: COMMIT_REF,
  });
  const states = new Set(result.fixture_gallery_matrix_rows.map((row) => row.fixture_state));

  for (const expected of SNAPSHOT_STATES) assert.equal(states.has(expected), true, expected);
  assert.equal(result.fixture_gallery_matrix_rows.every((row) => row.render_required_now === false), true);
  assert.equal(result.fixture_gallery_matrix_rows.every((row) => row.live_fetch_allowed_now === false), true);
  assert.equal(result.fixture_gallery_matrix_rows.every((row) => row.mutation_enabled === false), true);
});

test("Receipt Workbench Preview Bundle Handoff keeps payloads and review affordances read-only", async () => {
  const result = await buildReceiptWorkbenchPreviewBundleHandoff({
    runAt: RUN_AT,
    write: false,
    receiptWorkbenchDashboardArtifactPreview: buildP24400Source({ ready: true }),
    commitRef: COMMIT_REF,
  });

  assert.equal(result.handoff_payload_projection_rows.every((row) => row.read_only === true), true);
  assert.equal(result.handoff_payload_projection_rows.every((row) => row.mutation_enabled === false), true);
  assert.equal(result.handoff_payload_projection_rows.every((row) => row.serve_required_now === false), true);
  assert.equal(result.handoff_payload_projection_rows.every((row) => row.forbidden_fields.includes("secret_material")), true);
  assert.equal(result.operator_review_affordance_rows.every((row) => row.action_enabled_now === false), true);
  assert.equal(result.operator_review_affordance_rows.every((row) => row.reviewer_mutation_allowed_now === false), true);
  for (const flag of BUNDLE_FALSE_FLAGS) assert.equal(result.receipt_workbench_preview_bundle_handoff_boundary[flag], false, flag);
});

test("Receipt Workbench Preview Bundle Handoff check mode does not overwrite artifacts", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "hermes-p24800-"));
  try {
    const sourcePath = path.join(tmpDir, "source.json");
    const schemaPath = path.resolve("schemas/receipt-workbench-preview-bundle-handoff.schema.json");
    const packagePath = path.join(tmpDir, "package.json");
    const roadmapPath = path.join(tmpDir, "roadmap.md");
    const architecturePath = path.join(tmpDir, "architecture.md");
    const outDir = path.join(tmpDir, "out");

    await writeFile(sourcePath, `${JSON.stringify(buildP24400Source({ ready: true }), null, 2)}\n`, "utf8");
    await writeFile(packagePath, JSON.stringify({
      scripts: {
        "platform:receipt-workbench-preview-bundle-handoff": "node scripts/receipt-workbench-preview-bundle-handoff.mjs",
        validate: "npm run platform:receipt-workbench-preview-bundle-handoff -- --check",
      },
    }), "utf8");
    await writeFile(roadmapPath, [
      "P24401-P24440 p24400_source_binding_rows",
      "P24441-P24520 preview_bundle_manifest_rows",
      "P24521-P24600 fixture_gallery_matrix_rows",
      "P24601-P24680 handoff_payload_projection_rows",
      "P24681-P24740 operator_review_affordance_rows",
      "P24741-P24780 no_serve_boundary_rows",
      "P24781-P24800 p24800_clean_checkpoint_rows",
    ].join("\n"), "utf8");
    await writeFile(architecturePath, "P24401-P24800 Receipt Workbench Preview Bundle Handoff\n", "utf8");

    const result = await runReceiptWorkbenchPreviewBundleHandoff({
      check: true,
      outDir,
      sourceReceiptWorkbenchDashboardArtifactPreviewPath: sourcePath,
      schemaPath,
      packagePath,
      roadmapDocPath: roadmapPath,
      architectureDocPath: architecturePath,
      commitRef: COMMIT_REF,
    });

    assert.equal(result.validation.valid, true);
    await assert.rejects(readFile(path.join(outDir, "receipt-workbench-preview-bundle-handoff.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
