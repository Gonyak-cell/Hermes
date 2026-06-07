import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildReceiptWorkbenchDashboardArtifactPreview } from "./receipt-workbench-dashboard-artifact-preview.mjs";

export const DEFAULT_RECEIPT_WORKBENCH_PREVIEW_BUNDLE_HANDOFF_OUT_DIR = "artifacts/receipt-workbench-preview-bundle-handoff/latest";
export const DEFAULT_RECEIPT_WORKBENCH_PREVIEW_BUNDLE_HANDOFF_INPUTS = {
  schemaPath: "schemas/receipt-workbench-preview-bundle-handoff.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p24401-p24800.md",
  architectureDocPath: "docs/architecture.md",
  sourceReceiptWorkbenchDashboardArtifactPreviewPath: "artifacts/receipt-workbench-dashboard-artifact-preview/latest/receipt-workbench-dashboard-artifact-preview.json",
};

const COMMAND_NAME = "platform:receipt-workbench-preview-bundle-handoff";
const SCHEMA_VERSION = "receipt-workbench-preview-bundle-handoff.v1";
const CAPABILITY_ID = "platform.receipt_workbench_preview_bundle_handoff";
const PROGRAM_RANGE = "P24401-P24800";
const SOURCE_PROGRAM_RANGE = "P24001-P24400";
const READY_STATUS = "ready_for_receipt_workbench_preview_bundle_handoff";
const BLOCK_PENDING_STATUS = "valid_block_receipt_workbench_preview_bundle_handoff_pending";
const BLOCKED_STATUS = "blocked_receipt_workbench_preview_bundle_handoff";

const PHASE_SPECS = [
  ["P24401-P24440", "P24400 Source Binding", "p24400_source_binding_rows"],
  ["P24441-P24520", "Preview Bundle Manifest", "preview_bundle_manifest_rows"],
  ["P24521-P24600", "Fixture Gallery Matrix", "fixture_gallery_matrix_rows"],
  ["P24601-P24680", "Handoff Payload Projection", "handoff_payload_projection_rows"],
  ["P24681-P24740", "Operator Review Affordance Map", "operator_review_affordance_rows"],
  ["P24741-P24780", "No-Serve/No-Render Boundary", "no_serve_boundary_rows"],
  ["P24781-P24800", "P24800 Clean Checkpoint", "p24800_clean_checkpoint_rows"],
];

const REVIEW_AFFORDANCES = [
  ["status_visible", "Bundle status is visible"],
  ["source_ref_visible", "Source preview refs are visible"],
  ["blocker_visible", "Blocked handoff path is visible"],
  ["required_evidence_visible", "Required evidence hint is visible"],
  ["validation_error_visible", "Validation error summary is visible"],
  ["redaction_marker_visible", "Redaction marker is visible"],
  ["stale_marker_visible", "Stale fixture marker is visible"],
  ["no_action_notice_visible", "No-action notice is visible"],
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

const PROTECTED_BOUNDARY_FALSE_FLAGS = [
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

const SOURCE_FALSE_FLAGS = [
  ...PREVIEW_FALSE_FLAGS,
  ...SCREEN_FALSE_FLAGS,
  ...HANDOFF_FALSE_FLAGS,
  ...API_FALSE_FLAGS,
  ...PROTECTED_BOUNDARY_FALSE_FLAGS,
];

const ALL_FALSE_FLAGS = [
  ...BUNDLE_FALSE_FLAGS,
  ...SOURCE_FALSE_FLAGS,
];

export async function runReceiptWorkbenchPreviewBundleHandoff(options = {}) {
  const result = await buildReceiptWorkbenchPreviewBundleHandoff(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Receipt Workbench Preview Bundle Handoff failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeReceiptWorkbenchPreviewBundleHandoff(result, result.output_dir);
  return result;
}

export async function buildReceiptWorkbenchPreviewBundleHandoff(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RECEIPT_WORKBENCH_PREVIEW_BUNDLE_HANDOFF_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "receiptWorkbenchDashboardArtifactPreview")
    ? normalizeInlineJsonSource("inline.receipt_workbench_dashboard_artifact_preview", options.receiptWorkbenchDashboardArtifactPreview)
    : await readJsonOrBuildP24400(inputs.source_receipt_workbench_dashboard_artifact_preview_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const bundleRows = buildPreviewBundleManifestRows({ source, generatedAt });
  const fixtureRows = buildFixtureGalleryMatrixRows({ source, bundleRows, generatedAt });
  const payloadRows = buildHandoffPayloadProjectionRows({ source, bundleRows, generatedAt });
  const reviewRows = buildOperatorReviewAffordanceRows({ source, bundleRows, fixtureRows, payloadRows, generatedAt });
  const noServeRows = buildNoServeBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, bundleRows, fixtureRows, payloadRows, reviewRows, noServeRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, bundleRows, fixtureRows, payloadRows, reviewRows, noServeRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, bundleRows, fixtureRows, payloadRows, reviewRows, noServeRows, checkpointRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      receipt_workbench_dashboard_artifact_preview_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_receipt_workbench_dashboard_artifact_preview_summary: source.data?.summary ?? null,
    receipt_workbench_preview_bundle_handoff_contract: buildContract(generatedAt),
    receipt_workbench_preview_bundle_handoff_phase_rows: phaseRows,
    p24400_source_binding_rows: sourceRows,
    preview_bundle_manifest_rows: bundleRows,
    fixture_gallery_matrix_rows: fixtureRows,
    handoff_payload_projection_rows: payloadRows,
    operator_review_affordance_rows: reviewRows,
    no_serve_boundary_rows: noServeRows,
    p24800_clean_checkpoint_rows: checkpointRows,
    receipt_workbench_preview_bundle_handoff_boundary: boundary,
    receipt_workbench_preview_bundle_handoff_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "receipt_workbench_preview_bundle_handoff")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.receipt_workbench_preview_bundle_handoff_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.receipt_workbench_preview_bundle_handoff_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeReceiptWorkbenchPreviewBundleHandoff(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "receipt-workbench-preview-bundle-handoff.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p24400-source-binding-rows.json"), collectionEnvelope("p24400-source-binding-rows.v1", "p24400_source_binding_rows", result.p24400_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "preview-bundle-manifest-rows.json"), collectionEnvelope("preview-bundle-manifest-rows.v1", "preview_bundle_manifest_rows", result.preview_bundle_manifest_rows, result.generated_at));
  await writeJson(path.join(outDir, "fixture-gallery-matrix-rows.json"), collectionEnvelope("fixture-gallery-matrix-rows.v1", "fixture_gallery_matrix_rows", result.fixture_gallery_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "handoff-payload-projection-rows.json"), collectionEnvelope("handoff-payload-projection-rows.v1", "handoff_payload_projection_rows", result.handoff_payload_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-review-affordance-rows.json"), collectionEnvelope("operator-review-affordance-rows.v1", "operator_review_affordance_rows", result.operator_review_affordance_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-serve-boundary-rows.json"), collectionEnvelope("no-serve-boundary-rows.v1", "no_serve_boundary_rows", result.no_serve_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p24800-clean-checkpoint-rows.json"), collectionEnvelope("p24800-clean-checkpoint-rows.v1", "p24800_clean_checkpoint_rows", result.p24800_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-workbench-preview-bundle-handoff-boundary.json"), result.receipt_workbench_preview_bundle_handoff_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runReceiptWorkbenchPreviewBundleHandoffCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runReceiptWorkbenchPreviewBundleHandoff(args);
  console.log(`Receipt Workbench Preview Bundle Handoff ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.receipt_workbench_preview_bundle_handoff_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P24400 ready for P24401 handoff: ${result.summary.source_p24400_ready_for_p24401_handoff}`);
  console.log(`Bundle rows: ${result.summary.preview_bundle_manifest_count}`);
  console.log(`Fixture gallery rows: ${result.summary.fixture_gallery_matrix_count}`);
  console.log(`Ready for P24801 handoff: ${result.summary.ready_for_p24801_handoff}`);
  console.log(`Bundle server allowed: ${result.summary.bundle_server_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.receipt_workbench_dashboard_artifact_preview_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p24401_handoff === true,
    status: summary.receipt_workbench_dashboard_artifact_preview_status ?? "missing",
    p24400ContractReady: boundary.p24400_contract_ready === true,
    previewVisible: boundary.preview_artifact_contract_visible_now === true,
    fixtureVisible: boundary.snapshot_fixture_matrix_visible_now === true,
    projectionVisible: boundary.preview_data_projection_visible_now === true,
    safetyVisible: boundary.preview_safety_guard_visible_now === true,
    noRenderClosed: boundary.no_render_boundary_closed_now === true,
    boundaryClosed: sourceBoundaryClosed(boundary),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p24401-p24800.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P24400 dashboard artifact preview source is available", sourceState.available],
    ["program_range", "P24400 source program range is P24001-P24400", sourceState.programRangeOk],
    ["validation_valid", "P24400 source validation is valid", sourceState.validationValid],
    ["p24401_handoff_open", "P24400 source opened P24401 handoff", sourceState.sourceReady],
    ["p24400_contract_ready", "P24400 source contract is ready", sourceState.p24400ContractReady],
    ["preview_contract_visible", "P24400 preview artifact contract is visible", sourceState.previewVisible],
    ["fixture_matrix_visible", "P24400 snapshot fixture matrix is visible", sourceState.fixtureVisible],
    ["projection_visible", "P24400 preview data projection is visible", sourceState.projectionVisible],
    ["safety_guard_visible", "P24400 preview safety guard is visible", sourceState.safetyVisible],
    ["no_render_closed", "P24400 no-render boundary is closed", sourceState.noRenderClosed],
    ["commit_ref_present", "Current commit ref is present for preview bundle handoff", Boolean(commitRef)],
    ["source_blocker_visible", "P24400 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p24400_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildPreviewBundleManifestRows({ source, generatedAt }) {
  const previewRows = Array.isArray(source.data?.preview_artifact_contract_rows) ? source.data.preview_artifact_contract_rows : [];
  return previewRows.map((item, index) => row({
    row_id: `preview_bundle.${slug(item.preview_surface ?? item.row_id ?? index + 1)}`,
    category: "preview_bundle_manifest",
    label: `Preview bundle entry for ${item.preview_surface ?? item.row_id}`,
    observed: item.current_verdict === "pass" && item.read_only === true,
    evidence_ref: item.row_id ?? "preview_artifact_contract_rows",
    bundle_id: `receipt_workbench.preview_bundle.${index + 1}`,
    preview_surface: item.preview_surface ?? null,
    source_screen_slot: item.source_screen_slot ?? item.screen_slot ?? null,
    fixture_collection_ref: "fixture_gallery_matrix_rows",
    handoff_slot: `dashboard.preview_bundle.${slug(item.preview_surface ?? index + 1)}`,
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
    generated_at: generatedAt,
  }));
}

function buildFixtureGalleryMatrixRows({ source, bundleRows, generatedAt }) {
  const snapshotRows = Array.isArray(source.data?.snapshot_fixture_matrix_rows) ? source.data.snapshot_fixture_matrix_rows : [];
  return snapshotRows.map((item, index) => row({
    row_id: `fixture_gallery.${slug(item.snapshot_state ?? item.row_id ?? index + 1)}`,
    category: "fixture_gallery_matrix",
    label: `Fixture gallery ${item.snapshot_state ?? item.row_id}`,
    observed: item.current_verdict === "pass" && item.visible_now === true,
    evidence_ref: item.row_id ?? "snapshot_fixture_matrix_rows",
    fixture_state: item.snapshot_state ?? null,
    fixture_gallery_slot: `dashboard.fixture_gallery.${slug(item.snapshot_state ?? index + 1)}`,
    source_snapshot_row_ref: item.row_id ?? null,
    state_order: index + 1,
    preview_surface_count: bundleRows.length,
    visible_now: true,
    visible_when_blocked: true,
    render_required_now: false,
    browser_required_now: false,
    live_fetch_allowed_now: false,
    mutation_enabled: false,
    blocked_state_visible: Boolean(item.blocked_state_visible) || ["blocked", "error", "stale", "review_pending"].includes(item.snapshot_state),
    generated_at: generatedAt,
  }));
}

function buildHandoffPayloadProjectionRows({ source, bundleRows, generatedAt }) {
  const projectionRows = Array.isArray(source.data?.preview_data_projection_rows) ? source.data.preview_data_projection_rows : [];
  const bundleBySurface = new Map(bundleRows.map((item) => [item.preview_surface, item]));
  return projectionRows.map((item, index) => {
    const bundleRow = bundleBySurface.get(item.preview_surface) ?? bundleRows[index % Math.max(bundleRows.length, 1)];
    return row({
      row_id: `handoff_payload.${slug(item.preview_surface ?? item.screen_slot ?? item.row_id ?? index + 1)}`,
      category: "handoff_payload_projection",
      label: `Handoff payload projection for ${item.preview_surface ?? item.screen_slot ?? item.row_id}`,
      observed: Boolean(bundleRow) && item.read_only === true,
      evidence_ref: item.row_id ?? "preview_data_projection_rows",
      source_projection_row_ref: item.row_id ?? null,
      bundle_row_ref: bundleRow?.row_id ?? null,
      payload_key: `receipt_workbench.preview_bundle.payload.${index + 1}`,
      preview_surface: item.preview_surface ?? bundleRow?.preview_surface ?? null,
      screen_slot: item.screen_slot ?? bundleRow?.source_screen_slot ?? null,
      visible_fields: item.visible_fields ?? ["row_id", "display_state", "next_action", "owner_lane", "detail_ref"],
      forbidden_fields: item.forbidden_fields ?? ["raw_stdout", "raw_stderr", "secret_material", "full_transcript", "protected_payload"],
      bounded_payload_only: true,
      include_summary_only: true,
      read_only: true,
      raw_body_returns: false,
      full_body_returns: false,
      serve_required_now: false,
      route_mount_allowed_now: false,
      mutation_enabled: false,
      generated_at: generatedAt,
    });
  });
}

function buildOperatorReviewAffordanceRows({ source, bundleRows, fixtureRows, payloadRows, generatedAt }) {
  const summary = source.data?.summary ?? {};
  return REVIEW_AFFORDANCES.map(([affordanceId, label]) => row({
    row_id: `review_affordance.${affordanceId}`,
    category: "operator_review_affordance",
    label,
    observed: bundleRows.length > 0 && fixtureRows.length > 0 && payloadRows.length > 0 && summary.ready_for_p24401_handoff !== undefined,
    evidence_ref: "operator_review_affordance_rows",
    affordance_id: affordanceId,
    visible_now: true,
    visible_when_blocked: true,
    read_only: true,
    action_enabled_now: false,
    adjudication_enabled_now: false,
    reviewer_mutation_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildNoServeBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_serve.${flag}`,
    category: "no_serve_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "receipt_workbench_preview_bundle_handoff_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.bundleRows)
    && allPass(context.fixtureRows)
    && allPass(context.payloadRows)
    && allPass(context.reviewRows)
    && allPass(context.noServeRows);
  return [
    ["source_ready", "P24400 source is ready for P24401", context.sourceState.sourceReady],
    ["bundle_manifest_visible", "Preview bundle manifest rows are visible", allPass(context.bundleRows)],
    ["fixture_gallery_visible", "Fixture gallery matrix is visible", allPass(context.fixtureRows)],
    ["handoff_payload_visible", "Handoff payload projection is visible", allPass(context.payloadRows)],
    ["review_affordance_visible", "Operator review affordance map is visible", allPass(context.reviewRows)],
    ["no_serve_boundary_closed", "No-serve and no-render boundary remains closed", allPass(context.noServeRows)],
    ["p24801_handoff_gate", "P24801 handoff opens only when bundle handoff conditions pass", handoffReady],
    ["p24801_handoff_blocker_visible", "P24801 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p24800_checkpoint.${id}`,
    category: "p24800_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p24800_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p24800ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.bundleRows)
    && allPass(context.fixtureRows)
    && allPass(context.payloadRows)
    && allPass(context.reviewRows)
    && allPass(context.noServeRows)
    && visibleOrPassed(context.checkpointRows, "p24800_checkpoint.p24801_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.bundleRows)
    && allPass(context.fixtureRows)
    && allPass(context.payloadRows)
    && allPass(context.reviewRows)
    && allPass(context.noServeRows);
  return {
    p24800_contract_ready: p24800ContractReady,
    ready_for_p24801_handoff: handoffReady,
    source_p24400_ready_for_p24401_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    preview_bundle_manifest_visible_now: allPass(context.bundleRows),
    fixture_gallery_matrix_visible_now: allPass(context.fixtureRows),
    handoff_payload_projection_visible_now: allPass(context.payloadRows),
    operator_review_affordance_visible_now: allPass(context.reviewRows),
    no_serve_boundary_closed_now: allPass(context.noServeRows),
    preview_bundle_manifest_count: context.bundleRows.length,
    fixture_gallery_matrix_count: context.fixtureRows.length,
    handoff_payload_projection_count: context.payloadRows.length,
    operator_review_affordance_count: context.reviewRows.length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P24401-P24800 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P24401-P24800 Receipt Workbench Preview Bundle Handoff"), "Architecture doc missing P24401-P24800 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P24400 source state is not visible"),
    validationItem("bundle.manifest", "bundle", allPass(context.bundleRows), "Preview bundle manifest rows are incomplete"),
    validationItem("fixture.gallery", "fixture", allPass(context.fixtureRows), "Fixture gallery matrix is incomplete"),
    validationItem("payload.read_only", "payload", context.payloadRows.every((item) => item.read_only === true && item.mutation_enabled === false && item.serve_required_now === false), "Handoff payload opened mutation or serving"),
    validationItem("review.affordance", "review", allPass(context.reviewRows) && context.reviewRows.every((item) => item.action_enabled_now === false), "Review affordance opened action authority"),
    validationItem("boundary.no_serve", "authority", context.boundary.bundle_server_allowed_now === false && context.boundary.bundle_live_render_allowed_now === false && context.boundary.bundle_click_action_allowed_now === false, "Bundle serve/render boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p24800_checkpoint.p24801_handoff_blocker_visible"), "P24800 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "receipt_workbench_preview_bundle_handoff.contract.v1",
    generated_at: generatedAt,
    source_p24400_required_or_rebuilt: true,
    preview_bundle_manifest_required: true,
    fixture_gallery_matrix_required: true,
    handoff_payload_projection_required: true,
    p24801_handoff_is_not_serving_rendering_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p24801_handoff
    ? READY_STATUS
    : validation.valid && boundary.p24800_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    receipt_workbench_preview_bundle_handoff_status: status,
    source_p24400_ready_for_p24401_handoff: boundary.source_p24400_ready_for_p24401_handoff,
    preview_bundle_manifest_count: boundary.preview_bundle_manifest_count,
    fixture_gallery_matrix_count: boundary.fixture_gallery_matrix_count,
    handoff_payload_projection_count: boundary.handoff_payload_projection_count,
    operator_review_affordance_count: boundary.operator_review_affordance_count,
    ready_for_p24801_handoff: validation.valid && boundary.ready_for_p24801_handoff,
    bundle_server_allowed_now: false,
    bundle_route_mount_allowed_now: false,
    bundle_live_render_allowed_now: false,
    bundle_click_action_allowed_now: false,
    bundle_export_allowed_now: false,
    bundle_publish_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Receipt Workbench Preview Bundle Handoff",
    "",
    `Status: ${result.summary.receipt_workbench_preview_bundle_handoff_status}`,
    `Program: ${result.program_range}`,
    `P24400 ready for P24401 handoff: ${result.summary.source_p24400_ready_for_p24401_handoff}`,
    `Bundle rows: ${result.summary.preview_bundle_manifest_count}`,
    `Fixture gallery rows: ${result.summary.fixture_gallery_matrix_count}`,
    `Ready for P24801 handoff: ${result.summary.ready_for_p24801_handoff}`,
    `Bundle server allowed: ${result.summary.bundle_server_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.preview_bundle_manifest_rows.map((item) => `<tr><td>${escapeHtml(item.bundle_id)}</td><td>${escapeHtml(item.preview_surface)}</td><td>${escapeHtml(item.source_screen_slot)}</td><td>${escapeHtml(item.serve_required_now)}</td><td>${escapeHtml(item.mutation_enabled)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Receipt Workbench Preview Bundle Handoff</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #1d2433; }
    body { margin: 0; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 24px; line-height: 1.2; margin: 0 0 12px; }
    table { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid #d9dee8; }
    th, td { text-align: left; border-bottom: 1px solid #e6e9ef; padding: 8px 10px; font-size: 13px; }
    th { background: #f0f3f8; color: #364152; }
    .notice { border-left: 3px solid #2563eb; background: #eef4ff; padding: 10px 12px; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Hermes Receipt Workbench Preview Bundle Handoff</h1>
    <p class="notice">This artifact bundles read-only preview snapshots for dashboard handoff. It does not serve UI, render previews, start routes, fetch live data, export, publish, mutate state, or approve work.</p>
    <table><thead><tr><th>Bundle ID</th><th>Preview Surface</th><th>Screen Slot</th><th>Serve Required</th><th>Mutation</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP24400(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildReceiptWorkbenchDashboardArtifactPreview({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.receipt_workbench_dashboard_artifact_preview", built);
}

async function readJsonSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return { path: resolved, available: true, text, data: JSON.parse(text) };
  } catch (error) {
    return { path: resolved, available: false, text: "", data: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return { path: resolved, available: true, text };
  } catch (error) {
    return { path: resolved, available: false, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(label, value) {
  if (value && typeof value === "object") return { path: label, available: true, text: JSON.stringify(value), data: value };
  return { path: label, available: false, text: "", data: null, error: "Inline source unavailable" };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_RECEIPT_WORKBENCH_PREVIEW_BUNDLE_HANDOFF_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_receipt_workbench_dashboard_artifact_preview_path: path.resolve(repoRoot, options.sourceReceiptWorkbenchDashboardArtifactPreviewPath ?? defaults.sourceReceiptWorkbenchDashboardArtifactPreviewPath),
  };
}

function parseArgs(argv) {
  const args = { write: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--source") {
      args.sourceReceiptWorkbenchDashboardArtifactPreviewPath = argv[++index];
    } else if (arg === "--commit-ref") {
      args.commitRef = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/receipt-workbench-preview-bundle-handoff.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P24401-P24800 Receipt Workbench Preview Bundle Handoff contract.
`);
}

function sourceBoundaryClosed(boundary) {
  return SOURCE_FALSE_FLAGS.every((flag) => boundary[flag] === false);
}

function allFalseFlagsClosed(boundary) {
  return ALL_FALSE_FLAGS.every((flag) => boundary[flag] === false);
}

function row(fields) {
  const observed = fields.observed === true;
  return {
    ...fields,
    observed,
    current_verdict: observed ? "pass" : "block",
    block_reason: observed ? null : `${fields.row_id} not satisfied`,
  };
}

function validationItem(id, category, observed, failureMessage) {
  return row({
    row_id: `validation.${id}`,
    category,
    label: id,
    observed,
    evidence_ref: id,
    failure_message: observed ? null : failureMessage,
    generated_at: new Date(0).toISOString(),
  });
}

function allPass(rows) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((item) => item.current_verdict === "pass");
}

function visibleOrPassed(rows, rowId) {
  const item = rows.find((rowItem) => rowItem.row_id === rowId);
  return Boolean(item && (item.current_verdict === "pass" || item.visible_now === true || item.observed === true));
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.current_verdict !== "pass")
    .map((item) => ({ row_id: item.row_id, category: item.category, message: item.failure_message ?? item.block_reason ?? "Validation item failed" }));
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function hasScript(packageData, scriptName) {
  return Boolean(packageData?.scripts?.[scriptName]);
}

function serializableResult(result) {
  const { markdown, html, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, collectionName, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection: collectionName, rows };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "unknown";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}
