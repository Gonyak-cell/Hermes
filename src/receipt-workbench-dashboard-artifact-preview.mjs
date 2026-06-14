import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildReceiptWorkbenchOperatorDashboardScreenContract } from "./receipt-workbench-operator-dashboard-screen-contract.mjs";

export const DEFAULT_RECEIPT_WORKBENCH_DASHBOARD_ARTIFACT_PREVIEW_OUT_DIR = "artifacts/receipt-workbench-dashboard-artifact-preview/latest";
export const DEFAULT_RECEIPT_WORKBENCH_DASHBOARD_ARTIFACT_PREVIEW_INPUTS = {
  schemaPath: "schemas/receipt-workbench-dashboard-artifact-preview.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p24001-p24400.md",
  architectureDocPath: "docs/architecture.md",
  sourceReceiptWorkbenchOperatorDashboardScreenContractPath: "artifacts/receipt-workbench-operator-dashboard-screen-contract/latest/receipt-workbench-operator-dashboard-screen-contract.json",
};

const COMMAND_NAME = "platform:receipt-workbench-dashboard-artifact-preview";
const SCHEMA_VERSION = "receipt-workbench-dashboard-artifact-preview.v1";
const CAPABILITY_ID = "platform.receipt_workbench_dashboard_artifact_preview";
const PROGRAM_RANGE = "P24001-P24400";
const SOURCE_PROGRAM_RANGE = "P23601-P24000";
const READY_STATUS = "ready_for_receipt_workbench_dashboard_artifact_preview";
const BLOCK_PENDING_STATUS = "valid_block_receipt_workbench_dashboard_artifact_preview_pending";
const BLOCKED_STATUS = "blocked_receipt_workbench_dashboard_artifact_preview";

const PHASE_SPECS = [
  ["P24001-P24040", "P24000 Source Binding", "p24000_source_binding_rows"],
  ["P24041-P24120", "Preview Artifact Contract", "preview_artifact_contract_rows"],
  ["P24121-P24200", "Snapshot Fixture Matrix", "snapshot_fixture_matrix_rows"],
  ["P24201-P24280", "Preview Data Projection", "preview_data_projection_rows"],
  ["P24281-P24340", "Preview Safety Guard", "preview_safety_guard_rows"],
  ["P24341-P24380", "No-Render/No-Action Boundary", "no_render_boundary_rows"],
  ["P24381-P24400", "P24400 Clean Checkpoint", "p24400_clean_checkpoint_rows"],
];

const PREVIEW_SURFACE_SPECS = [
  ["status_preview", "Status Preview", "header_status"],
  ["summary_preview", "Summary Preview", "summary_bar"],
  ["task_preview", "Task List Preview", "task_list"],
  ["evidence_preview", "Evidence Panel Preview", "evidence_panel"],
  ["review_preview", "Review Panel Preview", "review_panel"],
  ["blocker_preview", "Blocker Banner Preview", "blocker_banner"],
  ["detail_preview", "Detail Panel Preview", "detail_panel"],
  ["next_action_preview", "Next Action Preview", "next_action_panel"],
];

const SNAPSHOT_STATES = [
  ["ready", "Ready snapshot is available"],
  ["empty", "Empty snapshot is available"],
  ["loading", "Loading snapshot is available without live fetch"],
  ["error", "Error snapshot is available"],
  ["blocked", "Blocked snapshot is available"],
  ["stale", "Stale snapshot is available"],
  ["review_pending", "Review-pending snapshot is available"],
  ["redacted_payload", "Redacted payload snapshot is available"],
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

const ALL_FALSE_FLAGS = [
  ...PREVIEW_FALSE_FLAGS,
  ...SCREEN_FALSE_FLAGS,
  ...HANDOFF_FALSE_FLAGS,
  ...API_FALSE_FLAGS,
  ...PROTECTED_BOUNDARY_FALSE_FLAGS,
];

export async function runReceiptWorkbenchDashboardArtifactPreview(options = {}) {
  const result = await buildReceiptWorkbenchDashboardArtifactPreview(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Receipt Workbench Dashboard Artifact Preview failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeReceiptWorkbenchDashboardArtifactPreview(result, result.output_dir);
  return result;
}

export async function buildReceiptWorkbenchDashboardArtifactPreview(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RECEIPT_WORKBENCH_DASHBOARD_ARTIFACT_PREVIEW_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "receiptWorkbenchOperatorDashboardScreenContract")
    ? normalizeInlineJsonSource("inline.receipt_workbench_operator_dashboard_screen_contract", options.receiptWorkbenchOperatorDashboardScreenContract)
    : await readJsonOrBuildP24000(inputs.source_receipt_workbench_operator_dashboard_screen_contract_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const previewRows = buildPreviewArtifactContractRows({ source, generatedAt });
  const snapshotRows = buildSnapshotFixtureMatrixRows(generatedAt);
  const projectionRows = buildPreviewDataProjectionRows({ source, previewRows, generatedAt });
  const safetyRows = buildPreviewSafetyGuardRows({ source, previewRows, snapshotRows, projectionRows, generatedAt });
  const noRenderRows = buildNoRenderBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, previewRows, snapshotRows, projectionRows, safetyRows, noRenderRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, previewRows, snapshotRows, projectionRows, safetyRows, noRenderRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, previewRows, snapshotRows, projectionRows, safetyRows, noRenderRows, checkpointRows, boundary });
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
      receipt_workbench_operator_dashboard_screen_contract_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_receipt_workbench_operator_dashboard_screen_contract_summary: source.data?.summary ?? null,
    receipt_workbench_dashboard_artifact_preview_contract: buildContract(generatedAt),
    receipt_workbench_dashboard_artifact_preview_phase_rows: phaseRows,
    p24000_source_binding_rows: sourceRows,
    preview_artifact_contract_rows: previewRows,
    snapshot_fixture_matrix_rows: snapshotRows,
    preview_data_projection_rows: projectionRows,
    preview_safety_guard_rows: safetyRows,
    no_render_boundary_rows: noRenderRows,
    p24400_clean_checkpoint_rows: checkpointRows,
    receipt_workbench_dashboard_artifact_preview_boundary: boundary,
    receipt_workbench_dashboard_artifact_preview_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "receipt_workbench_dashboard_artifact_preview")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.receipt_workbench_dashboard_artifact_preview_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.receipt_workbench_dashboard_artifact_preview_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeReceiptWorkbenchDashboardArtifactPreview(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "receipt-workbench-dashboard-artifact-preview.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p24000-source-binding-rows.json"), collectionEnvelope("p24000-source-binding-rows.v1", "p24000_source_binding_rows", result.p24000_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "preview-artifact-contract-rows.json"), collectionEnvelope("preview-artifact-contract-rows.v1", "preview_artifact_contract_rows", result.preview_artifact_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "snapshot-fixture-matrix-rows.json"), collectionEnvelope("snapshot-fixture-matrix-rows.v1", "snapshot_fixture_matrix_rows", result.snapshot_fixture_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "preview-data-projection-rows.json"), collectionEnvelope("preview-data-projection-rows.v1", "preview_data_projection_rows", result.preview_data_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "preview-safety-guard-rows.json"), collectionEnvelope("preview-safety-guard-rows.v1", "preview_safety_guard_rows", result.preview_safety_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-render-boundary-rows.json"), collectionEnvelope("no-render-boundary-rows.v1", "no_render_boundary_rows", result.no_render_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p24400-clean-checkpoint-rows.json"), collectionEnvelope("p24400-clean-checkpoint-rows.v1", "p24400_clean_checkpoint_rows", result.p24400_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-workbench-dashboard-artifact-preview-boundary.json"), result.receipt_workbench_dashboard_artifact_preview_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runReceiptWorkbenchDashboardArtifactPreviewCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runReceiptWorkbenchDashboardArtifactPreview(args);
  console.log(`Receipt Workbench Dashboard Artifact Preview ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.receipt_workbench_dashboard_artifact_preview_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P24000 ready for P24001 handoff: ${result.summary.source_p24000_ready_for_p24001_handoff}`);
  console.log(`Preview surfaces: ${result.summary.preview_artifact_contract_count}`);
  console.log(`Snapshot fixtures: ${result.summary.snapshot_fixture_matrix_count}`);
  console.log(`Ready for P24401 handoff: ${result.summary.ready_for_p24401_handoff}`);
  console.log(`Preview render server allowed: ${result.summary.preview_render_server_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.receipt_workbench_operator_dashboard_screen_contract_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p24001_handoff === true,
    status: summary.receipt_workbench_operator_dashboard_screen_contract_status ?? "missing",
    p24000ContractReady: boundary.p24000_contract_ready === true,
    screenVisible: boundary.operator_dashboard_screen_contract_visible_now === true,
    interactionVisible: boundary.interaction_state_checklist_visible_now === true,
    bindingVisible: boundary.read_only_data_binding_visible_now === true,
    resilienceVisible: boundary.screen_resilience_guard_visible_now === true,
    noActionClosed: boundary.no_action_boundary_closed_now === true,
    boundaryClosed: sourceBoundaryClosed(boundary),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p24001-p24400.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P24000 operator dashboard screen contract source is available", sourceState.available],
    ["program_range", "P24000 source program range is P23601-P24000", sourceState.programRangeOk],
    ["validation_valid", "P24000 source validation is valid", sourceState.validationValid],
    ["p24001_handoff_open", "P24000 source opened P24001 handoff", sourceState.sourceReady],
    ["p24000_contract_ready", "P24000 source contract is ready", sourceState.p24000ContractReady],
    ["screen_contract_visible", "P24000 operator dashboard screen contract is visible", sourceState.screenVisible],
    ["interaction_state_visible", "P24000 interaction state checklist is visible", sourceState.interactionVisible],
    ["data_binding_visible", "P24000 read-only data binding is visible", sourceState.bindingVisible],
    ["resilience_guard_visible", "P24000 screen resilience guard is visible", sourceState.resilienceVisible],
    ["no_action_closed", "P24000 no-action boundary is closed", sourceState.noActionClosed],
    ["commit_ref_present", "Current commit ref is present for artifact preview", Boolean(commitRef)],
    ["source_blocker_visible", "P24000 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p24000_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildPreviewArtifactContractRows({ source, generatedAt }) {
  const screenRows = Array.isArray(source.data?.operator_dashboard_screen_contract_rows) ? source.data.operator_dashboard_screen_contract_rows : [];
  const screenBySlot = new Map(screenRows.map((item) => [item.screen_slot, item]));
  return PREVIEW_SURFACE_SPECS.map(([previewSurface, label, screenSlot], index) => {
    const screenRow = screenBySlot.get(screenSlot);
    return row({
      row_id: `preview_artifact.${previewSurface}`,
      category: "preview_artifact_contract",
      label,
      observed: Boolean(screenRow?.visible_now),
      evidence_ref: screenRow?.row_id ?? "operator_dashboard_screen_contract_rows",
      preview_surface: previewSurface,
      source_screen_slot: screenSlot,
      screen_slot: screenSlot,
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
      generated_at: generatedAt,
    });
  });
}

function buildSnapshotFixtureMatrixRows(generatedAt) {
  return SNAPSHOT_STATES.map(([snapshotState, label]) => row({
    row_id: `snapshot_fixture.${snapshotState}`,
    category: "snapshot_fixture_matrix",
    label,
    observed: true,
    evidence_ref: "snapshot_fixture_matrix_rows",
    snapshot_state: snapshotState,
    fixture_kind: "bounded_read_only_preview_snapshot",
    visible_now: true,
    render_required_now: false,
    browser_required_now: false,
    live_fetch_allowed_now: false,
    mutation_enabled: false,
    blocked_state_visible: ["blocked", "error", "stale", "review_pending"].includes(snapshotState),
    generated_at: generatedAt,
  }));
}

function buildPreviewDataProjectionRows({ source, previewRows, generatedAt }) {
  const bindingRows = Array.isArray(source.data?.read_only_data_binding_rows) ? source.data.read_only_data_binding_rows : [];
  const previewBySlot = new Map(previewRows.map((item) => [item.screen_slot, item]));
  return bindingRows.map((item, index) => {
    const previewRow = previewBySlot.get(item.screen_slot) ?? previewRows[index % Math.max(previewRows.length, 1)];
    return row({
      row_id: `preview_projection.${slug(item.screen_slot ?? item.row_id ?? index + 1)}`,
      category: "preview_data_projection",
      label: `Preview data projection for ${item.screen_slot ?? item.row_id}`,
      observed: Boolean(previewRow) && item.read_only === true,
      evidence_ref: item.row_id ?? "read_only_data_binding_rows",
      source_binding_row_ref: item.row_id ?? null,
      preview_surface: previewRow?.preview_surface ?? null,
      screen_slot: item.screen_slot ?? previewRow?.screen_slot ?? null,
      visible_fields: item.visible_fields ?? ["row_id", "display_state", "next_action", "owner_lane", "detail_ref"],
      forbidden_fields: item.forbidden_fields ?? ["raw_stdout", "raw_stderr", "secret_material", "full_transcript", "protected_payload"],
      bounded_payload_only: true,
      read_only: true,
      raw_body_returns: false,
      full_body_returns: false,
      mutation_enabled: false,
      render_required_now: false,
      browser_required_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildPreviewSafetyGuardRows({ source, previewRows, snapshotRows, projectionRows, generatedAt }) {
  const summary = source.data?.summary ?? {};
  const guards = [
    ["bounded_payload_guard", "All preview contract and projection rows are bounded payload only", previewRows.every((item) => item.bounded_payload_only === true) && projectionRows.every((item) => item.bounded_payload_only === true)],
    ["redaction_guard", "Preview projection forbids raw, secret, full transcript, and protected payload fields", projectionRows.every((item) => item.forbidden_fields?.includes("secret_material") && item.raw_body_returns === false)],
    ["no_raw_guard", "Preview artifacts never return raw or full bodies", previewRows.every((item) => item.raw_body_returns === false && item.full_body_returns === false)],
    ["hidden_blocker_guard", "Blocked snapshot path is explicitly visible", snapshotRows.some((item) => item.snapshot_state === "blocked" && item.visible_now === true)],
    ["stale_fixture_guard", "Stale snapshot path is explicitly visible", snapshotRows.some((item) => item.snapshot_state === "stale" && item.visible_now === true)],
    ["no_render_guard", "Preview contract requires no render server or browser run", previewRows.every((item) => item.render_required_now === false && item.browser_required_now === false) && snapshotRows.every((item) => item.render_required_now === false)],
    ["no_export_guard", "Preview contract does not open export or publish authority", true],
    ["no_action_guard", "Preview projection is read-only and mutation disabled", projectionRows.every((item) => item.read_only === true && item.mutation_enabled === false) && summary.ready_for_p24001_handoff !== undefined],
  ];
  return guards.map(([id, label, observed]) => row({
    row_id: `preview_safety.${id}`,
    category: "preview_safety_guard",
    label,
    observed,
    evidence_ref: "preview_safety_guard_rows",
    guard_id: id,
    generated_at: generatedAt,
  }));
}

function buildNoRenderBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_render.${flag}`,
    category: "no_render_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "receipt_workbench_dashboard_artifact_preview_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.previewRows)
    && allPass(context.snapshotRows)
    && allPass(context.projectionRows)
    && allPass(context.safetyRows)
    && allPass(context.noRenderRows);
  return [
    ["source_ready", "P24000 source is ready for P24001", context.sourceState.sourceReady],
    ["preview_contract_visible", "Preview artifact contract rows are visible", allPass(context.previewRows)],
    ["snapshot_fixtures_visible", "Snapshot fixture matrix is visible", allPass(context.snapshotRows)],
    ["data_projection_visible", "Preview data projection is visible", allPass(context.projectionRows)],
    ["safety_guard_visible", "Preview safety guard is visible", allPass(context.safetyRows)],
    ["no_render_boundary_closed", "No-render and no-action boundary remains closed", allPass(context.noRenderRows)],
    ["p24401_handoff_gate", "P24401 handoff opens only when preview conditions pass", handoffReady],
    ["p24401_handoff_blocker_visible", "P24401 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p24400_checkpoint.${id}`,
    category: "p24400_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p24400_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p24400ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.previewRows)
    && allPass(context.snapshotRows)
    && allPass(context.projectionRows)
    && allPass(context.safetyRows)
    && allPass(context.noRenderRows)
    && visibleOrPassed(context.checkpointRows, "p24400_checkpoint.p24401_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.previewRows)
    && allPass(context.snapshotRows)
    && allPass(context.projectionRows)
    && allPass(context.safetyRows)
    && allPass(context.noRenderRows);
  return {
    p24400_contract_ready: p24400ContractReady,
    ready_for_p24401_handoff: handoffReady,
    source_p24000_ready_for_p24001_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    preview_artifact_contract_visible_now: allPass(context.previewRows),
    snapshot_fixture_matrix_visible_now: allPass(context.snapshotRows),
    preview_data_projection_visible_now: allPass(context.projectionRows),
    preview_safety_guard_visible_now: allPass(context.safetyRows),
    no_render_boundary_closed_now: allPass(context.noRenderRows),
    preview_artifact_contract_count: context.previewRows.length,
    snapshot_fixture_matrix_count: context.snapshotRows.length,
    preview_data_projection_count: context.projectionRows.length,
    preview_safety_guard_count: context.safetyRows.length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P24001-P24400 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P24001-P24400 Receipt Workbench Dashboard Artifact Preview"), "Architecture doc missing P24001-P24400 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P24000 source state is not visible"),
    validationItem("preview.contract", "preview", allPass(context.previewRows), "Preview artifact contract rows are incomplete"),
    validationItem("snapshot.fixtures", "snapshot", context.snapshotRows.length >= SNAPSHOT_STATES.length && allPass(context.snapshotRows), "Snapshot fixture matrix is incomplete"),
    validationItem("projection.read_only", "projection", context.projectionRows.every((item) => item.read_only === true && item.mutation_enabled === false && item.render_required_now === false), "Preview projection opened mutation or render"),
    validationItem("safety.guards", "safety", allPass(context.safetyRows), "Preview safety guards are incomplete"),
    validationItem("boundary.no_render", "authority", context.boundary.preview_render_server_allowed_now === false && context.boundary.preview_live_data_fetch_allowed_now === false && context.boundary.preview_screenshot_capture_allowed_now === false, "Preview render boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p24400_checkpoint.p24401_handoff_blocker_visible"), "P24400 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "receipt_workbench_dashboard_artifact_preview.contract.v1",
    generated_at: generatedAt,
    source_p24000_required_or_rebuilt: true,
    preview_artifact_contract_required: true,
    snapshot_fixture_matrix_required: true,
    preview_data_projection_required: true,
    p24401_handoff_is_not_ui_rendering_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p24401_handoff
    ? READY_STATUS
    : validation.valid && boundary.p24400_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    receipt_workbench_dashboard_artifact_preview_status: status,
    source_p24000_ready_for_p24001_handoff: boundary.source_p24000_ready_for_p24001_handoff,
    preview_artifact_contract_count: boundary.preview_artifact_contract_count,
    snapshot_fixture_matrix_count: boundary.snapshot_fixture_matrix_count,
    preview_data_projection_count: boundary.preview_data_projection_count,
    preview_safety_guard_count: boundary.preview_safety_guard_count,
    ready_for_p24401_handoff: validation.valid && boundary.ready_for_p24401_handoff,
    preview_render_server_allowed_now: false,
    preview_browser_run_allowed_now: false,
    preview_click_action_allowed_now: false,
    preview_live_data_fetch_allowed_now: false,
    preview_export_allowed_now: false,
    preview_publish_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Receipt Workbench Dashboard Artifact Preview",
    "",
    `Status: ${result.summary.receipt_workbench_dashboard_artifact_preview_status}`,
    `Program: ${result.program_range}`,
    `P24000 ready for P24001 handoff: ${result.summary.source_p24000_ready_for_p24001_handoff}`,
    `Preview surfaces: ${result.summary.preview_artifact_contract_count}`,
    `Snapshot fixtures: ${result.summary.snapshot_fixture_matrix_count}`,
    `Ready for P24401 handoff: ${result.summary.ready_for_p24401_handoff}`,
    `Preview render server allowed: ${result.summary.preview_render_server_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.preview_artifact_contract_rows.map((item) => `<tr><td>${escapeHtml(item.preview_surface)}</td><td>${escapeHtml(item.source_screen_slot)}</td><td>${escapeHtml(item.render_required_now)}</td><td>${escapeHtml(item.mutation_enabled)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Receipt Workbench Dashboard Artifact Preview</title>
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
    <h1>Hermes Receipt Workbench Dashboard Artifact Preview</h1>
    <p class="notice">This artifact declares read-only dashboard preview snapshots. It does not render UI, start a server, run a browser, fetch live data, export files, publish, or enable clicks.</p>
    <table><thead><tr><th>Preview Surface</th><th>Source Screen Slot</th><th>Render Required</th><th>Mutation</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP24000(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildReceiptWorkbenchOperatorDashboardScreenContract({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.receipt_workbench_operator_dashboard_screen_contract", built);
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
  const defaults = DEFAULT_RECEIPT_WORKBENCH_DASHBOARD_ARTIFACT_PREVIEW_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_receipt_workbench_operator_dashboard_screen_contract_path: path.resolve(repoRoot, options.sourceReceiptWorkbenchOperatorDashboardScreenContractPath ?? defaults.sourceReceiptWorkbenchOperatorDashboardScreenContractPath),
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
      args.sourceReceiptWorkbenchOperatorDashboardScreenContractPath = argv[++index];
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
  console.log(`Usage: node scripts/receipt-workbench-dashboard-artifact-preview.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P24001-P24400 Receipt Workbench Dashboard Artifact Preview contract.
`);
}

function sourceBoundaryClosed(boundary) {
  return [...SCREEN_FALSE_FLAGS, ...HANDOFF_FALSE_FLAGS, ...API_FALSE_FLAGS, ...PROTECTED_BOUNDARY_FALSE_FLAGS].every((flag) => boundary[flag] === false);
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
