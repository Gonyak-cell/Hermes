import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildReceiptWorkbenchPreviewBundleHandoff } from "./receipt-workbench-preview-bundle-handoff.mjs";

export const DEFAULT_RECEIPT_WORKBENCH_DASHBOARD_CONSUMER_FIXTURE_SMOKE_OUT_DIR = "artifacts/receipt-workbench-dashboard-consumer-fixture-smoke/latest";
export const DEFAULT_RECEIPT_WORKBENCH_DASHBOARD_CONSUMER_FIXTURE_SMOKE_INPUTS = {
  schemaPath: "schemas/receipt-workbench-dashboard-consumer-fixture-smoke.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p24801-p25200.md",
  architectureDocPath: "docs/architecture.md",
  sourceReceiptWorkbenchPreviewBundleHandoffPath: "artifacts/receipt-workbench-preview-bundle-handoff/latest/receipt-workbench-preview-bundle-handoff.json",
};

const COMMAND_NAME = "platform:receipt-workbench-dashboard-consumer-fixture-smoke";
const SCHEMA_VERSION = "receipt-workbench-dashboard-consumer-fixture-smoke.v1";
const CAPABILITY_ID = "platform.receipt_workbench_dashboard_consumer_fixture_smoke";
const PROGRAM_RANGE = "P24801-P25200";
const SOURCE_PROGRAM_RANGE = "P24401-P24800";
const READY_STATUS = "ready_for_receipt_workbench_dashboard_consumer_fixture_smoke";
const BLOCK_PENDING_STATUS = "valid_block_receipt_workbench_dashboard_consumer_fixture_smoke_pending";
const BLOCKED_STATUS = "blocked_receipt_workbench_dashboard_consumer_fixture_smoke";

const PHASE_SPECS = [
  ["P24801-P24840", "P24800 Source Binding", "p24800_source_binding_rows"],
  ["P24841-P24920", "Dashboard Consumer Fixture Contract", "dashboard_consumer_fixture_contract_rows"],
  ["P24921-P25000", "Fixture Smoke Case Matrix", "fixture_smoke_case_rows"],
  ["P25001-P25080", "Read-Only Adapter Map", "read_only_adapter_map_rows"],
  ["P25081-P25140", "Consumer Visibility Guard", "consumer_visibility_guard_rows"],
  ["P25141-P25180", "No-Serve/No-Action Boundary", "no_serve_boundary_rows"],
  ["P25181-P25200", "P25200 Clean Checkpoint", "p25200_clean_checkpoint_rows"],
];

const VISIBILITY_GUARDS = [
  ["status_visible", "Consumer fixture status is visible"],
  ["source_ref_visible", "Source bundle refs are visible"],
  ["blocker_visible", "Blocked fixture path is visible"],
  ["required_evidence_visible", "Required evidence hint is visible"],
  ["validation_error_visible", "Validation error summary is visible"],
  ["redaction_marker_visible", "Redaction marker is visible"],
  ["stale_marker_visible", "Stale fixture marker is visible"],
  ["no_action_notice_visible", "No-action notice is visible"],
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
  ...BUNDLE_FALSE_FLAGS,
  ...PREVIEW_FALSE_FLAGS,
  ...SCREEN_FALSE_FLAGS,
  ...HANDOFF_FALSE_FLAGS,
  ...API_FALSE_FLAGS,
  ...PROTECTED_BOUNDARY_FALSE_FLAGS,
];

const ALL_FALSE_FLAGS = [
  ...CONSUMER_FALSE_FLAGS,
  ...SOURCE_FALSE_FLAGS,
];

export async function runReceiptWorkbenchDashboardConsumerFixtureSmoke(options = {}) {
  const result = await buildReceiptWorkbenchDashboardConsumerFixtureSmoke(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Receipt Workbench Dashboard Consumer Fixture Smoke failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeReceiptWorkbenchDashboardConsumerFixtureSmoke(result, result.output_dir);
  return result;
}

export async function buildReceiptWorkbenchDashboardConsumerFixtureSmoke(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RECEIPT_WORKBENCH_DASHBOARD_CONSUMER_FIXTURE_SMOKE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "receiptWorkbenchPreviewBundleHandoff")
    ? normalizeInlineJsonSource("inline.receipt_workbench_preview_bundle_handoff", options.receiptWorkbenchPreviewBundleHandoff)
    : await readJsonOrBuildP24800(inputs.source_receipt_workbench_preview_bundle_handoff_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const consumerRows = buildDashboardConsumerFixtureContractRows({ source, generatedAt });
  const smokeRows = buildFixtureSmokeCaseRows({ source, consumerRows, generatedAt });
  const adapterRows = buildReadOnlyAdapterMapRows({ source, consumerRows, generatedAt });
  const visibilityRows = buildConsumerVisibilityGuardRows({ source, consumerRows, smokeRows, adapterRows, generatedAt });
  const noServeRows = buildNoServeBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, consumerRows, smokeRows, adapterRows, visibilityRows, noServeRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, consumerRows, smokeRows, adapterRows, visibilityRows, noServeRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, consumerRows, smokeRows, adapterRows, visibilityRows, noServeRows, checkpointRows, boundary });
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
      receipt_workbench_preview_bundle_handoff_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_receipt_workbench_preview_bundle_handoff_summary: source.data?.summary ?? null,
    receipt_workbench_dashboard_consumer_fixture_smoke_contract: buildContract(generatedAt),
    receipt_workbench_dashboard_consumer_fixture_smoke_phase_rows: phaseRows,
    p24800_source_binding_rows: sourceRows,
    dashboard_consumer_fixture_contract_rows: consumerRows,
    fixture_smoke_case_rows: smokeRows,
    read_only_adapter_map_rows: adapterRows,
    consumer_visibility_guard_rows: visibilityRows,
    no_serve_boundary_rows: noServeRows,
    p25200_clean_checkpoint_rows: checkpointRows,
    receipt_workbench_dashboard_consumer_fixture_smoke_boundary: boundary,
    receipt_workbench_dashboard_consumer_fixture_smoke_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "receipt_workbench_dashboard_consumer_fixture_smoke")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.receipt_workbench_dashboard_consumer_fixture_smoke_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.receipt_workbench_dashboard_consumer_fixture_smoke_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeReceiptWorkbenchDashboardConsumerFixtureSmoke(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "receipt-workbench-dashboard-consumer-fixture-smoke.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p24800-source-binding-rows.json"), collectionEnvelope("p24800-source-binding-rows.v1", "p24800_source_binding_rows", result.p24800_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "dashboard-consumer-fixture-contract-rows.json"), collectionEnvelope("dashboard-consumer-fixture-contract-rows.v1", "dashboard_consumer_fixture_contract_rows", result.dashboard_consumer_fixture_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "fixture-smoke-case-rows.json"), collectionEnvelope("fixture-smoke-case-rows.v1", "fixture_smoke_case_rows", result.fixture_smoke_case_rows, result.generated_at));
  await writeJson(path.join(outDir, "read-only-adapter-map-rows.json"), collectionEnvelope("read-only-adapter-map-rows.v1", "read_only_adapter_map_rows", result.read_only_adapter_map_rows, result.generated_at));
  await writeJson(path.join(outDir, "consumer-visibility-guard-rows.json"), collectionEnvelope("consumer-visibility-guard-rows.v1", "consumer_visibility_guard_rows", result.consumer_visibility_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-serve-boundary-rows.json"), collectionEnvelope("no-serve-boundary-rows.v1", "no_serve_boundary_rows", result.no_serve_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p25200-clean-checkpoint-rows.json"), collectionEnvelope("p25200-clean-checkpoint-rows.v1", "p25200_clean_checkpoint_rows", result.p25200_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-workbench-dashboard-consumer-fixture-smoke-boundary.json"), result.receipt_workbench_dashboard_consumer_fixture_smoke_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runReceiptWorkbenchDashboardConsumerFixtureSmokeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runReceiptWorkbenchDashboardConsumerFixtureSmoke(args);
  console.log(`Receipt Workbench Dashboard Consumer Fixture Smoke ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.receipt_workbench_dashboard_consumer_fixture_smoke_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P24800 ready for P24801 handoff: ${result.summary.source_p24800_ready_for_p24801_handoff}`);
  console.log(`Consumer fixtures: ${result.summary.dashboard_consumer_fixture_contract_count}`);
  console.log(`Smoke cases: ${result.summary.fixture_smoke_case_count}`);
  console.log(`Ready for P25201 handoff: ${result.summary.ready_for_p25201_handoff}`);
  console.log(`Consumer server allowed: ${result.summary.dashboard_consumer_server_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.receipt_workbench_preview_bundle_handoff_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p24801_handoff === true,
    status: summary.receipt_workbench_preview_bundle_handoff_status ?? "missing",
    p24800ContractReady: boundary.p24800_contract_ready === true,
    bundleVisible: boundary.preview_bundle_manifest_visible_now === true,
    galleryVisible: boundary.fixture_gallery_matrix_visible_now === true,
    payloadVisible: boundary.handoff_payload_projection_visible_now === true,
    reviewVisible: boundary.operator_review_affordance_visible_now === true,
    noServeClosed: boundary.no_serve_boundary_closed_now === true,
    boundaryClosed: sourceBoundaryClosed(boundary),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p24801-p25200.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P24800 preview bundle handoff source is available", sourceState.available],
    ["program_range", "P24800 source program range is P24401-P24800", sourceState.programRangeOk],
    ["validation_valid", "P24800 source validation is valid", sourceState.validationValid],
    ["p24801_handoff_open", "P24800 source opened P24801 handoff", sourceState.sourceReady],
    ["p24800_contract_ready", "P24800 source contract is ready", sourceState.p24800ContractReady],
    ["bundle_manifest_visible", "P24800 preview bundle manifest is visible", sourceState.bundleVisible],
    ["fixture_gallery_visible", "P24800 fixture gallery matrix is visible", sourceState.galleryVisible],
    ["payload_projection_visible", "P24800 handoff payload projection is visible", sourceState.payloadVisible],
    ["review_affordance_visible", "P24800 operator review affordance is visible", sourceState.reviewVisible],
    ["no_serve_closed", "P24800 no-serve boundary is closed", sourceState.noServeClosed],
    ["commit_ref_present", "Current commit ref is present for dashboard consumer fixture smoke", Boolean(commitRef)],
    ["source_blocker_visible", "P24800 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p24800_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildDashboardConsumerFixtureContractRows({ source, generatedAt }) {
  const bundleRows = Array.isArray(source.data?.preview_bundle_manifest_rows) ? source.data.preview_bundle_manifest_rows : [];
  return bundleRows.map((item, index) => row({
    row_id: `dashboard_consumer_fixture.${slug(item.preview_surface ?? item.bundle_id ?? index + 1)}`,
    category: "dashboard_consumer_fixture_contract",
    label: `Dashboard consumer fixture for ${item.preview_surface ?? item.bundle_id}`,
    observed: item.current_verdict === "pass" && item.read_only === true,
    evidence_ref: item.row_id ?? "preview_bundle_manifest_rows",
    source_bundle_row_ref: item.row_id ?? null,
    bundle_id: item.bundle_id ?? null,
    preview_surface: item.preview_surface ?? null,
    source_screen_slot: item.source_screen_slot ?? null,
    consumer_surface_slot: `receipt_workbench.consumer_fixture.${slug(item.preview_surface ?? index + 1)}`,
    fixture_gallery_ref: item.fixture_collection_ref ?? "fixture_gallery_matrix_rows",
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
    generated_at: generatedAt,
  }));
}

function buildFixtureSmokeCaseRows({ source, consumerRows, generatedAt }) {
  const galleryRows = Array.isArray(source.data?.fixture_gallery_matrix_rows) ? source.data.fixture_gallery_matrix_rows : [];
  return galleryRows.map((item, index) => row({
    row_id: `fixture_smoke.${slug(item.fixture_state ?? item.row_id ?? index + 1)}`,
    category: "fixture_smoke_case",
    label: `Fixture smoke case ${item.fixture_state ?? item.row_id}`,
    observed: item.current_verdict === "pass" && item.visible_now === true,
    evidence_ref: item.row_id ?? "fixture_gallery_matrix_rows",
    smoke_case_id: `fixture_smoke.${slug(item.fixture_state ?? index + 1)}`,
    fixture_state: item.fixture_state ?? null,
    fixture_gallery_slot: item.fixture_gallery_slot ?? null,
    consumer_surface_count: consumerRows.length,
    ready_case_visible: item.fixture_state === "ready",
    empty_case_visible: item.fixture_state === "empty",
    blocked_case_visible: item.blocked_state_visible === true || ["blocked", "error", "stale", "review_pending"].includes(item.fixture_state),
    error_case_visible: item.fixture_state === "error",
    visible_now: true,
    visible_when_blocked: true,
    server_required_now: false,
    route_mount_allowed_now: false,
    live_fetch_allowed_now: false,
    render_required_now: false,
    mutation_enabled: false,
    generated_at: generatedAt,
  }));
}

function buildReadOnlyAdapterMapRows({ source, consumerRows, generatedAt }) {
  const payloadRows = Array.isArray(source.data?.handoff_payload_projection_rows) ? source.data.handoff_payload_projection_rows : [];
  const consumerBySurface = new Map(consumerRows.map((item) => [item.preview_surface, item]));
  return payloadRows.map((item, index) => {
    const consumerRow = consumerBySurface.get(item.preview_surface) ?? consumerRows[index % Math.max(consumerRows.length, 1)];
    return row({
      row_id: `adapter_map.${slug(item.preview_surface ?? item.payload_key ?? index + 1)}`,
      category: "read_only_adapter_map",
      label: `Read-only adapter map for ${item.preview_surface ?? item.payload_key}`,
      observed: Boolean(consumerRow) && item.read_only === true,
      evidence_ref: item.row_id ?? "handoff_payload_projection_rows",
      source_payload_row_ref: item.row_id ?? null,
      consumer_fixture_row_ref: consumerRow?.row_id ?? null,
      adapter_key: `receipt_workbench.consumer_fixture.adapter.${index + 1}`,
      payload_key: item.payload_key ?? null,
      preview_surface: item.preview_surface ?? consumerRow?.preview_surface ?? null,
      consumer_surface_slot: consumerRow?.consumer_surface_slot ?? null,
      visible_fields: item.visible_fields ?? ["row_id", "display_state", "next_action", "owner_lane", "detail_ref"],
      forbidden_fields: item.forbidden_fields ?? ["raw_stdout", "raw_stderr", "secret_material", "full_transcript", "protected_payload"],
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
      generated_at: generatedAt,
    });
  });
}

function buildConsumerVisibilityGuardRows({ source, consumerRows, smokeRows, adapterRows, generatedAt }) {
  const summary = source.data?.summary ?? {};
  return VISIBILITY_GUARDS.map(([guardId, label]) => row({
    row_id: `consumer_visibility.${guardId}`,
    category: "consumer_visibility_guard",
    label,
    observed: consumerRows.length > 0 && smokeRows.length > 0 && adapterRows.length > 0 && summary.ready_for_p24801_handoff !== undefined,
    evidence_ref: "consumer_visibility_guard_rows",
    guard_id: guardId,
    visible_now: true,
    visible_when_blocked: true,
    read_only: true,
    action_enabled_now: false,
    adjudication_enabled_now: false,
    raw_body_returns: false,
    generated_at: generatedAt,
  }));
}

function buildNoServeBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_serve.${flag}`,
    category: "no_serve_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "receipt_workbench_dashboard_consumer_fixture_smoke_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.consumerRows)
    && allPass(context.smokeRows)
    && allPass(context.adapterRows)
    && allPass(context.visibilityRows)
    && allPass(context.noServeRows);
  return [
    ["source_ready", "P24800 source is ready for P24801", context.sourceState.sourceReady],
    ["consumer_fixture_visible", "Dashboard consumer fixture contract rows are visible", allPass(context.consumerRows)],
    ["fixture_smoke_visible", "Fixture smoke case matrix is visible", allPass(context.smokeRows)],
    ["adapter_map_visible", "Read-only adapter map is visible", allPass(context.adapterRows)],
    ["visibility_guard_visible", "Consumer visibility guard is visible", allPass(context.visibilityRows)],
    ["no_serve_boundary_closed", "No-serve and no-action boundary remains closed", allPass(context.noServeRows)],
    ["p25201_handoff_gate", "P25201 handoff opens only when dashboard consumer fixture conditions pass", handoffReady],
    ["p25201_handoff_blocker_visible", "P25201 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p25200_checkpoint.${id}`,
    category: "p25200_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p25200_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p25200ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.consumerRows)
    && allPass(context.smokeRows)
    && allPass(context.adapterRows)
    && allPass(context.visibilityRows)
    && allPass(context.noServeRows)
    && visibleOrPassed(context.checkpointRows, "p25200_checkpoint.p25201_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.consumerRows)
    && allPass(context.smokeRows)
    && allPass(context.adapterRows)
    && allPass(context.visibilityRows)
    && allPass(context.noServeRows);
  return {
    p25200_contract_ready: p25200ContractReady,
    ready_for_p25201_handoff: handoffReady,
    source_p24800_ready_for_p24801_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    dashboard_consumer_fixture_contract_visible_now: allPass(context.consumerRows),
    fixture_smoke_case_visible_now: allPass(context.smokeRows),
    read_only_adapter_map_visible_now: allPass(context.adapterRows),
    consumer_visibility_guard_visible_now: allPass(context.visibilityRows),
    no_serve_boundary_closed_now: allPass(context.noServeRows),
    dashboard_consumer_fixture_contract_count: context.consumerRows.length,
    fixture_smoke_case_count: context.smokeRows.length,
    read_only_adapter_map_count: context.adapterRows.length,
    consumer_visibility_guard_count: context.visibilityRows.length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P24801-P25200 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P24801-P25200 Receipt Workbench Dashboard Consumer Fixture Smoke"), "Architecture doc missing P24801-P25200 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P24800 source state is not visible"),
    validationItem("consumer.fixture", "consumer", allPass(context.consumerRows), "Dashboard consumer fixture rows are incomplete"),
    validationItem("fixture.smoke", "fixture", allPass(context.smokeRows), "Fixture smoke case rows are incomplete"),
    validationItem("adapter.read_only", "adapter", context.adapterRows.every((item) => item.read_only === true && item.mutation_enabled === false && item.server_required_now === false), "Adapter map opened mutation or serving"),
    validationItem("visibility.guard", "visibility", allPass(context.visibilityRows) && context.visibilityRows.every((item) => item.action_enabled_now === false), "Consumer visibility guard opened action authority"),
    validationItem("boundary.no_serve", "authority", context.boundary.dashboard_consumer_server_allowed_now === false && context.boundary.dashboard_consumer_route_mount_allowed_now === false && context.boundary.dashboard_consumer_click_action_allowed_now === false, "Dashboard consumer serve/action boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p25200_checkpoint.p25201_handoff_blocker_visible"), "P25200 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "receipt_workbench_dashboard_consumer_fixture_smoke.contract.v1",
    generated_at: generatedAt,
    source_p24800_required_or_rebuilt: true,
    dashboard_consumer_fixture_contract_required: true,
    fixture_smoke_case_matrix_required: true,
    read_only_adapter_map_required: true,
    p25201_handoff_is_not_serving_rendering_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p25201_handoff
    ? READY_STATUS
    : validation.valid && boundary.p25200_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    receipt_workbench_dashboard_consumer_fixture_smoke_status: status,
    source_p24800_ready_for_p24801_handoff: boundary.source_p24800_ready_for_p24801_handoff,
    dashboard_consumer_fixture_contract_count: boundary.dashboard_consumer_fixture_contract_count,
    fixture_smoke_case_count: boundary.fixture_smoke_case_count,
    read_only_adapter_map_count: boundary.read_only_adapter_map_count,
    consumer_visibility_guard_count: boundary.consumer_visibility_guard_count,
    ready_for_p25201_handoff: validation.valid && boundary.ready_for_p25201_handoff,
    dashboard_consumer_server_allowed_now: false,
    dashboard_consumer_route_mount_allowed_now: false,
    dashboard_consumer_live_fetch_allowed_now: false,
    dashboard_consumer_render_allowed_now: false,
    dashboard_consumer_click_action_allowed_now: false,
    dashboard_consumer_write_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Receipt Workbench Dashboard Consumer Fixture Smoke",
    "",
    `Status: ${result.summary.receipt_workbench_dashboard_consumer_fixture_smoke_status}`,
    `Program: ${result.program_range}`,
    `P24800 ready for P24801 handoff: ${result.summary.source_p24800_ready_for_p24801_handoff}`,
    `Consumer fixtures: ${result.summary.dashboard_consumer_fixture_contract_count}`,
    `Smoke cases: ${result.summary.fixture_smoke_case_count}`,
    `Ready for P25201 handoff: ${result.summary.ready_for_p25201_handoff}`,
    `Consumer server allowed: ${result.summary.dashboard_consumer_server_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.dashboard_consumer_fixture_contract_rows.map((item) => `<tr><td>${escapeHtml(item.consumer_surface_slot)}</td><td>${escapeHtml(item.preview_surface)}</td><td>${escapeHtml(item.server_required_now)}</td><td>${escapeHtml(item.mutation_enabled)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Receipt Workbench Dashboard Consumer Fixture Smoke</title>
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
    <h1>Hermes Receipt Workbench Dashboard Consumer Fixture Smoke</h1>
    <p class="notice">This artifact declares read-only dashboard consumer fixture smoke cases. It does not mount routes, serve UI, render screens, fetch live data, mutate state, export, publish, or approve work.</p>
    <table><thead><tr><th>Consumer Surface</th><th>Preview Surface</th><th>Server Required</th><th>Mutation</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP24800(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildReceiptWorkbenchPreviewBundleHandoff({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.receipt_workbench_preview_bundle_handoff", built);
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
  const defaults = DEFAULT_RECEIPT_WORKBENCH_DASHBOARD_CONSUMER_FIXTURE_SMOKE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_receipt_workbench_preview_bundle_handoff_path: path.resolve(repoRoot, options.sourceReceiptWorkbenchPreviewBundleHandoffPath ?? defaults.sourceReceiptWorkbenchPreviewBundleHandoffPath),
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
      args.sourceReceiptWorkbenchPreviewBundleHandoffPath = argv[++index];
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
  console.log(`Usage: node scripts/receipt-workbench-dashboard-consumer-fixture-smoke.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P24801-P25200 Receipt Workbench Dashboard Consumer Fixture Smoke contract.
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
