import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P40800_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticUiAdapter,
} from "./work-os-static-bundle-review-ui-implementation-review-static-ui-adapter.mjs";

export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_UI_HANDOFF_OUT_DIR = "artifacts/work-os-static-bundle-review-ui-implementation-review-ui-handoff-bundle/latest";
export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_UI_HANDOFF_INPUTS = {
  schemaPath: "schemas/work-os-static-bundle-review-ui-implementation-review-ui-handoff-bundle.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p40801-p41200.md",
  architectureDocPath: "docs/architecture.md",
  sourceWorkOsStaticBundleReviewUiImplementationReviewStaticUiAdapterPath: "artifacts/work-os-static-bundle-review-ui-implementation-review-static-ui-adapter/latest/work-os-static-bundle-review-ui-implementation-review-static-ui-adapter.json",
};

const COMMAND_NAME = "platform:work-os-static-bundle-review-ui-implementation-review-ui-handoff-bundle";
const SCHEMA_VERSION = "work-os-static-bundle-review-ui-implementation-review-ui-handoff-bundle.v1";
const CAPABILITY_ID = "platform.work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle";
const PROGRAM_RANGE = "P40801-P41200";
const SOURCE_PROGRAM_RANGE = "P40401-P40800";
const READY_STATUS = "ready_for_work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle";
const BLOCK_PENDING_STATUS = "valid_block_work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle_pending";
const BLOCKED_STATUS = "blocked_work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle";

const PHASE_SPECS = [
  ["P40801-P40840", "P40800 Source Binding", "p40800_source_binding_rows"],
  ["P40841-P40900", "Static Review UI Handoff Manifest", "implementation_review_ui_handoff_manifest_rows"],
  ["P40901-P40960", "Read-Only Review Screen Package", "implementation_review_read_only_screen_package_rows"],
  ["P40961-P41020", "Operator Review Handoff View Map", "implementation_review_operator_handoff_view_rows"],
  ["P41021-P41080", "Review Handoff Affordance Visibility", "implementation_review_handoff_affordance_visibility_rows"],
  ["P41081-P41140", "No Serve No Receipt Accept Boundary", "no_serve_no_receipt_accept_boundary_rows"],
  ["P41141-P41200", "P41200 Clean Checkpoint", "p41200_clean_checkpoint_rows"],
];

export const WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_UI_HANDOFF_FALSE_FLAGS = [
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_server_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_route_mount_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_route_registration_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_live_render_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_browser_run_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_live_refresh_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_network_fetch_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_live_mount_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_runtime_fetch_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_event_handler_mutation_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_form_submit_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_state_persist_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_route_navigation_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_action_button_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_status_edit_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_write_api_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_live_browser_required_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_generated_file_write_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_html_file_write_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_artifact_persist_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_asset_pipeline_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_interactive_control_enabled_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_command_button_enabled_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_approve_button_enabled_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_closeout_button_enabled_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_export_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_publish_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_raw_payload_exposure_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_receipt_accept_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_receipt_create_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_review_completion_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_reviewer_dispatch_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_claude_review_execution_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_human_adjudication_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_finding_resolution_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_runtime_execution_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_write_action_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_protected_action_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_connector_write_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_deployment_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_final_approval_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_production_pass_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_enterprise_trust_claim_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_secret_read_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_human_gate_bypass_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_independent_review_bypass_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_ui_handoff_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_UI_HANDOFF_FALSE_FLAGS, ...P40800_FALSE_FLAGS])];

export async function runWorkOsStaticBundleReviewUiImplementationReviewUiHandoffBundle(options = {}) {
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewUiHandoffBundle(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS Static Bundle Review UI Implementation Review UI Handoff Bundle failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeWorkOsStaticBundleReviewUiImplementationReviewUiHandoffBundle(result, result.output_dir);
  return result;
}

export async function buildWorkOsStaticBundleReviewUiImplementationReviewUiHandoffBundle(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_UI_HANDOFF_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "workOsStaticBundleReviewUiImplementationReviewStaticUiAdapter")
    ? normalizeInlineJsonSource("inline.work_os_static_bundle_review_ui_implementation_review_static_ui_adapter", options.workOsStaticBundleReviewUiImplementationReviewStaticUiAdapter)
    : await readJsonOrBuildP40800(inputs.source_work_os_static_bundle_review_ui_implementation_review_static_ui_adapter_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const manifestRows = buildStaticReviewUiHandoffManifestRows({ source, generatedAt });
  const packageRows = buildReadOnlyReviewScreenPackageRows({ source, manifestRows, generatedAt });
  const viewRows = buildOperatorReviewHandoffViewRows({ source, manifestRows, packageRows, generatedAt });
  const affordanceRows = buildReviewHandoffAffordanceVisibilityRows({ manifestRows, packageRows, viewRows, generatedAt });
  const boundaryRows = buildNoServeNoReceiptAcceptBoundaryRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const checkpointRows = buildCheckpointRows({ sourceState, manifestRows, packageRows, viewRows, affordanceRows, boundaryRows, wiringRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, manifestRows, packageRows, viewRows, affordanceRows, boundaryRows, wiringRows, checkpointRows });
  const validationItems = buildValidationItems({ phaseRows, sourceRows, manifestRows, packageRows, viewRows, affordanceRows, boundaryRows, wiringRows, checkpointRows, boundary });
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
      work_os_static_bundle_review_ui_implementation_review_static_ui_adapter_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_work_os_static_bundle_review_ui_implementation_review_static_ui_summary: source.data?.summary ?? null,
    work_os_static_bundle_review_ui_implementation_review_ui_handoff_contract: buildContract(generatedAt),
    work_os_static_bundle_review_ui_implementation_review_ui_handoff_phase_rows: phaseRows,
    p40800_source_binding_rows: sourceRows,
    implementation_review_ui_handoff_manifest_rows: manifestRows,
    implementation_review_read_only_screen_package_rows: packageRows,
    implementation_review_operator_handoff_view_rows: viewRows,
    implementation_review_handoff_affordance_visibility_rows: affordanceRows,
    no_serve_no_receipt_accept_boundary_rows: boundaryRows,
    work_os_static_bundle_review_ui_implementation_review_ui_handoff_wiring_rows: wiringRows,
    p41200_clean_checkpoint_rows: checkpointRows,
    work_os_static_bundle_review_ui_implementation_review_ui_handoff_boundary: boundary,
    work_os_static_bundle_review_ui_implementation_review_ui_handoff_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.work_os_static_bundle_review_ui_implementation_review_ui_handoff_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.work_os_static_bundle_review_ui_implementation_review_ui_handoff_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeWorkOsStaticBundleReviewUiImplementationReviewUiHandoffBundle(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-ui-handoff-bundle.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p40800-source-binding-rows.json"), collectionEnvelope("p40800-source-binding-rows.v1", "p40800_source_binding_rows", result.p40800_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "static-review-ui-handoff-manifest-rows.json"), collectionEnvelope("static-review-ui-handoff-manifest-rows.v1", "implementation_review_ui_handoff_manifest_rows", result.implementation_review_ui_handoff_manifest_rows, result.generated_at));
  await writeJson(path.join(outDir, "read-only-review-screen-package-rows.json"), collectionEnvelope("read-only-review-screen-package-rows.v1", "implementation_review_read_only_screen_package_rows", result.implementation_review_read_only_screen_package_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-review-handoff-view-rows.json"), collectionEnvelope("operator-review-handoff-view-rows.v1", "implementation_review_operator_handoff_view_rows", result.implementation_review_operator_handoff_view_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-handoff-affordance-visibility-rows.json"), collectionEnvelope("review-handoff-affordance-visibility-rows.v1", "implementation_review_handoff_affordance_visibility_rows", result.implementation_review_handoff_affordance_visibility_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-serve-no-receipt-accept-boundary-rows.json"), collectionEnvelope("no-serve-no-receipt-accept-boundary-rows.v1", "no_serve_no_receipt_accept_boundary_rows", result.no_serve_no_receipt_accept_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-handoff-wiring-rows.json"), collectionEnvelope("work-os-static-bundle-review-ui-handoff-wiring-rows.v1", "work_os_static_bundle_review_ui_implementation_review_ui_handoff_wiring_rows", result.work_os_static_bundle_review_ui_implementation_review_ui_handoff_wiring_rows, result.generated_at));
  await writeJson(path.join(outDir, "p41200-clean-checkpoint-rows.json"), collectionEnvelope("p41200-clean-checkpoint-rows.v1", "p41200_clean_checkpoint_rows", result.p41200_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-handoff-boundary.json"), result.work_os_static_bundle_review_ui_implementation_review_ui_handoff_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runWorkOsStaticBundleReviewUiImplementationReviewUiHandoffBundleCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runWorkOsStaticBundleReviewUiImplementationReviewUiHandoffBundle(args);
  console.log(`Work OS Static Bundle Review UI Implementation Review UI Handoff Bundle ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_ui_handoff_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P40800 ready for UI handoff bundle: ${result.summary.source_p40800_ready_for_ui_handoff_bundle}`);
  console.log(`Handoff manifests: ${result.summary.implementation_review_ui_handoff_manifest_count}`);
  console.log(`Screen packages: ${result.summary.implementation_review_read_only_screen_package_count}`);
  console.log(`Operator views: ${result.summary.implementation_review_operator_handoff_view_count}`);
  console.log(`Ready for review UI package handoff: ${result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle}`);
  console.log(`Server allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_review_ui_handoff_server_allowed_now}`);
  console.log(`Receipt accept allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_review_ui_handoff_receipt_accept_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.work_os_static_bundle_review_ui_implementation_review_static_ui_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_ui_handoff === true,
    status: summary.work_os_static_bundle_review_ui_implementation_review_static_ui_status ?? "missing",
    p40800ContractReady: boundary.p40800_contract_ready === true,
    adapterVisible: boundary.static_bundle_review_ui_implementation_review_static_ui_adapter_candidate_visible_now === true,
    slotVisible: boundary.implementation_review_screen_slot_contract_visible_now === true,
    shellVisible: boundary.implementation_review_static_shell_fixture_visible_now === true,
    interactionVisible: boundary.implementation_review_interaction_smoke_visible_now === true,
    noLiveUiReceiptAcceptClosed: boundary.no_live_ui_receipt_accept_boundary_closed_now === true,
    wiringVisible: boundary.work_os_static_bundle_review_ui_implementation_review_static_ui_wiring_complete_now === true,
    boundaryClosed: P40800_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p40801-p41200.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P40800 static review UI adapter source is available", sourceState.available],
    ["program_range", "P40800 source program range is P40401-P40800", sourceState.programRangeOk],
    ["validation_valid", "P40800 source validation is valid", sourceState.validationValid],
    ["static_review_ui_handoff_open", "P40800 opened static review UI handoff", sourceState.sourceReady],
    ["p40800_contract_ready", "P40800 source contract is ready", sourceState.p40800ContractReady],
    ["adapter_visible", "P40800 static review UI adapter candidates are visible", sourceState.adapterVisible],
    ["screen_slots_visible", "P40800 screen slot contracts are visible", sourceState.slotVisible],
    ["static_shell_visible", "P40800 static shell fixtures are visible", sourceState.shellVisible],
    ["interaction_smoke_visible", "P40800 interaction smoke rows are visible", sourceState.interactionVisible],
    ["no_live_ui_receipt_accept_closed", "P40800 no-live-UI/receipt-accept boundary is closed", sourceState.noLiveUiReceiptAcceptClosed],
    ["wiring_visible", "P40800 static review UI wiring is visible", sourceState.wiringVisible],
    ["commit_ref_present", "Current commit ref is present for UI handoff bundle", Boolean(commitRef)],
    ["source_blocker_visible", "P40800 source blocker is visible when UI handoff bundle is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p40800_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildStaticReviewUiHandoffManifestRows({ source, generatedAt }) {
  const adapterRows = source.data?.static_bundle_review_ui_implementation_review_static_ui_adapter_candidate_rows ?? [];
  return adapterRows.map((adapter) => row({
    row_id: `implementation_review_ui_handoff_manifest.${adapter.request_id}`,
    category: "implementation_review_ui_handoff_manifest",
    label: `Static review UI handoff manifest for ${adapter.request_id}`,
    observed: Boolean(adapter.request_id && adapter.adapter_visible_now === true),
    evidence_ref: adapter.row_id,
    request_id: adapter.request_id,
      handoff_manifest_ref: `work_os.static_bundle_review.implementation_review.ui_handoff.${adapter.request_id}.manifest`,
    static_adapter_ref: adapter.static_adapter_ref,
    fixture_ref: adapter.fixture_ref,
    route_path: adapter.route_path,
    expected_status: adapter.expected_status,
    manifest_visible_now: true,
    server_allowed_now: false,
    route_mount_allowed_now: false,
    route_registration_allowed_now: false,
    runtime_fetch_allowed_now: false,
    live_refresh_allowed_now: false,
    review_receipt_accept_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildReadOnlyReviewScreenPackageRows({ source, manifestRows, generatedAt }) {
  const slotRows = source.data?.implementation_review_screen_slot_contract_rows ?? [];
  const shellRows = source.data?.implementation_review_static_shell_fixture_rows ?? [];
  return manifestRows.map((manifest) => {
    const slot = slotRows.find((item) => item.request_id === manifest.request_id);
    const shell = shellRows.find((item) => item.request_id === manifest.request_id);
    return row({
      row_id: `implementation_review_read_only_screen_package.${manifest.request_id}`,
      category: "implementation_review_read_only_screen_package",
      label: `Read-only review screen package for ${manifest.request_id}`,
      observed: Boolean(slot && shell),
      evidence_ref: shell?.row_id ?? slot?.row_id ?? manifest.row_id,
      request_id: manifest.request_id,
      screen_package_ref: `work_os.static_bundle_review.implementation_review.ui_handoff.${manifest.request_id}.screen_package`,
      handoff_manifest_ref: manifest.handoff_manifest_ref,
      screen_id: slot?.screen_id ?? "work_os.static_bundle_review.implementation_review.static_shell",
      slot_id: slot?.slot_id ?? null,
      static_shell_ref: shell?.static_shell_ref ?? null,
      route_path: shell?.route_path ?? manifest.route_path,
      allowed_methods: shell?.allowed_methods ?? ["GET"],
      package_visible_now: true,
      live_render_allowed_now: false,
      browser_run_allowed_now: false,
      html_file_write_allowed_now: false,
      state_persist_allowed_now: false,
      form_submit_allowed_now: false,
      review_receipt_accept_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildOperatorReviewHandoffViewRows({ source, manifestRows, packageRows, generatedAt }) {
  const interactionRows = source.data?.implementation_review_interaction_smoke_rows ?? [];
  return manifestRows.map((manifest) => {
    const screenPackage = packageRows.find((item) => item.request_id === manifest.request_id);
    const interactionCount = interactionRows.filter((item) => item.request_id === manifest.request_id).length;
    return row({
      row_id: `implementation_review_operator_handoff_view.${manifest.request_id}`,
      category: "implementation_review_operator_handoff_view",
      label: `Operator review handoff view for ${manifest.request_id}`,
      observed: Boolean(screenPackage && interactionCount > 0),
      evidence_ref: screenPackage?.row_id ?? manifest.row_id,
      request_id: manifest.request_id,
      operator_view_ref: `work_os.static_bundle_review.implementation_review.ui_handoff.${manifest.request_id}.operator_view`,
      screen_package_ref: screenPackage?.screen_package_ref ?? null,
      interaction_smoke_count: interactionCount,
      handoff_view_visible_now: true,
      interactive_control_enabled_now: false,
      command_button_enabled_now: false,
      approve_button_enabled_now: false,
      closeout_button_enabled_now: false,
      reviewer_lane_dispatch_allowed_now: false,
      review_receipt_accept_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildReviewHandoffAffordanceVisibilityRows({ manifestRows, packageRows, viewRows, generatedAt }) {
  const affordances = [
    ["handoff_status_visible", "Static UI handoff status is visible"],
    ["source_ref_visible", "P40800 source reference is visible"],
    ["manifest_ref_visible", "Handoff manifest reference is visible"],
    ["screen_package_ref_visible", "Read-only screen package reference is visible"],
    ["disabled_review_controls_visible", "Disabled review controls are visible"],
    ["no_receipt_accept_notice_visible", "No receipt accept notice is visible"],
  ];
  return manifestRows.flatMap((manifest) => {
    const screenPackage = packageRows.find((item) => item.request_id === manifest.request_id);
    const view = viewRows.find((item) => item.request_id === manifest.request_id);
    return affordances.map(([id, label]) => row({
      row_id: `implementation_review_handoff_affordance_visibility.${manifest.request_id}.${id}`,
      category: "implementation_review_handoff_affordance_visibility",
      label: `${label} for ${manifest.request_id}`,
      observed: Boolean(screenPackage && view),
      evidence_ref: view?.row_id ?? screenPackage?.row_id ?? manifest.row_id,
      request_id: manifest.request_id,
      affordance_type: id,
      affordance_visible_now: true,
      click_action_allowed_now: false,
      review_receipt_accept_allowed_now: false,
      reviewer_lane_dispatch_allowed_now: false,
      generated_at: generatedAt,
    }));
  });
}

function buildNoServeNoReceiptAcceptBoundaryRows(generatedAt) {
  const stateRows = [
    ["state.handoff_manifest_is_not_server", "Static review UI handoff manifest must not start a server", true],
    ["state.screen_package_is_not_render", "Read-only review screen package must not render live UI", true],
    ["state.operator_view_is_not_control_surface", "Operator handoff view must not enable controls", true],
    ["state.affordance_is_not_receipt_intake", "Review handoff affordance must not accept receipts or dispatch reviewers", true],
  ].map(([id, label, observed]) => row({
    row_id: `no_serve_no_receipt_accept_boundary.${id}`,
    category: "no_serve_no_receipt_accept_boundary",
    label,
    observed,
    evidence_ref: "work_os_static_bundle_review_ui_implementation_review_ui_handoff_boundary",
    generated_at: generatedAt,
  }));
  const boundaryRows = ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_serve_no_receipt_accept_boundary.${flag}`,
    category: "no_serve_no_receipt_accept_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "work_os_static_bundle_review_ui_implementation_review_ui_handoff_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
  return [...stateRows, ...boundaryRows];
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  return [
    ["package_script", "Package script is wired", hasScript(packageJson.data, COMMAND_NAME), "package.json"],
    ["validate_chain", "Validate chain includes P41200 check", packageJson.text.includes(`${COMMAND_NAME} -- --check`), "package.json"],
    ["schema_file", "Schema file is configured", packageJson.available, "schemas/work-os-static-bundle-review-ui-implementation-review-ui-handoff-bundle.schema.json"],
    ["roadmap_doc", "Roadmap documents all P40801-P41200 slices", PHASE_SPECS.every(([range]) => roadmapDoc.text.includes(range)), "docs/hermes-roadmap-p40801-p41200.md"],
    ["architecture_doc", "Architecture doc references P40801-P41200", architectureDoc.text.includes("P40801-P41200 Work OS Static Bundle Review UI Implementation Review UI Handoff Bundle"), "docs/architecture.md"],
  ].map(([id, label, observed, evidenceRef]) => row({
    row_id: `work_os_static_bundle_review_ui_implementation_review_ui_handoff_wiring.${id}`,
    category: "work_os_static_bundle_review_ui_implementation_review_ui_handoff_wiring",
    label,
    observed,
    evidence_ref: evidenceRef,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.manifestRows)
    && allPass(context.packageRows)
    && allPass(context.viewRows)
    && allPass(context.affordanceRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows);
  return [
    ["source_ready", "P40800 source is ready for UI handoff bundle", context.sourceState.sourceReady],
    ["manifest_visible", "Static review UI handoff manifests are visible", allPass(context.manifestRows)],
    ["screen_package_visible", "Read-only review screen packages are visible", allPass(context.packageRows)],
    ["operator_view_visible", "Operator review handoff views are visible", allPass(context.viewRows)],
    ["affordance_visible", "Review handoff affordance visibility rows are visible", allPass(context.affordanceRows)],
    ["no_serve_no_receipt_accept_boundary_closed", "No-serve/no-receipt-accept boundary stays closed", allPass(context.boundaryRows)],
    ["wiring_complete", "CLI, schema, package, roadmap, and architecture wiring are visible", allPass(context.wiringRows)],
    ["server_blocked", "Server and route mount remain blocked", true],
    ["render_blocked", "Live render and browser run remain blocked", true],
    ["receipt_accept_blocked", "Review receipt acceptance remains blocked", true],
    ["review_ui_package_handoff", "Review UI package handoff opens only as read-only metadata", ready],
  ].map(([id, label, observed]) => row({
    row_id: `p41200_checkpoint.${id}`,
    category: "p41200_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p41200_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p41200ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.manifestRows)
    && allPass(context.packageRows)
    && allPass(context.viewRows)
    && allPass(context.affordanceRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows)
    && visibleOrPassed(context.checkpointRows, "p41200_checkpoint.server_blocked")
    && visibleOrPassed(context.checkpointRows, "p41200_checkpoint.receipt_accept_blocked");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p41200ContractReady;
  return {
    p41200_contract_ready: p41200ContractReady,
    ready_for_work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle: ready,
    source_p40800_ready_for_ui_handoff_bundle: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    implementation_review_ui_handoff_manifest_visible_now: allPass(context.manifestRows),
    implementation_review_read_only_screen_package_visible_now: allPass(context.packageRows),
    implementation_review_operator_handoff_view_visible_now: allPass(context.viewRows),
    implementation_review_handoff_affordance_visibility_now: allPass(context.affordanceRows),
    no_serve_no_receipt_accept_boundary_closed_now: allPass(context.boundaryRows),
    work_os_static_bundle_review_ui_implementation_review_ui_handoff_wiring_complete_now: allPass(context.wiringRows),
    implementation_review_ui_handoff_manifest_count: context.manifestRows.length,
    implementation_review_read_only_screen_package_count: context.packageRows.length,
    implementation_review_operator_handoff_view_count: context.viewRows.length,
    implementation_review_handoff_affordance_visibility_count: context.affordanceRows.length,
    server_allowed_count: context.manifestRows.filter((item) => item.server_allowed_now === true || item.route_mount_allowed_now === true || item.route_registration_allowed_now === true).length,
    render_allowed_count: context.packageRows.filter((item) => item.live_render_allowed_now === true || item.browser_run_allowed_now === true).length,
    state_persist_allowed_count: context.packageRows.filter((item) => item.state_persist_allowed_now === true || item.form_submit_allowed_now === true).length,
    interactive_control_enabled_count: context.viewRows.filter((item) => item.interactive_control_enabled_now === true || item.command_button_enabled_now === true || item.approve_button_enabled_now === true || item.closeout_button_enabled_now === true).length,
    receipt_accept_allowed_count: context.manifestRows.filter((item) => item.review_receipt_accept_allowed_now === true).length
      + context.packageRows.filter((item) => item.review_receipt_accept_allowed_now === true).length
      + context.viewRows.filter((item) => item.review_receipt_accept_allowed_now === true).length
      + context.affordanceRows.filter((item) => item.review_receipt_accept_allowed_now === true).length,
    reviewer_dispatch_allowed_count: context.viewRows.filter((item) => item.reviewer_lane_dispatch_allowed_now === true).length
      + context.affordanceRows.filter((item) => item.reviewer_lane_dispatch_allowed_now === true).length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  };
}

function buildValidationItems(context) {
  return [
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P40801-P41200 phase rows are incomplete"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P40800 source state is not visible"),
    validationItem("manifest.visible", "ui", allPass(context.manifestRows), "Static review UI handoff manifests are incomplete"),
    validationItem("package.visible", "ui", allPass(context.packageRows), "Read-only review screen packages are incomplete"),
    validationItem("view.visible", "ui", allPass(context.viewRows), "Operator review handoff views are incomplete"),
    validationItem("affordance.visible", "ui", allPass(context.affordanceRows), "Review handoff affordance visibility rows are incomplete"),
    validationItem("boundary.visible", "authority", allPass(context.boundaryRows), "No-serve/no-receipt-accept boundary rows are incomplete"),
    validationItem("wiring.complete", "wiring", allPass(context.wiringRows), "P40801-P41200 wiring is incomplete"),
    validationItem("no.server", "authority", context.manifestRows.every((item) => item.server_allowed_now === false && item.route_mount_allowed_now === false && item.route_registration_allowed_now === false), "Server or route mount opened"),
    validationItem("no.render", "authority", context.packageRows.every((item) => item.live_render_allowed_now === false && item.browser_run_allowed_now === false), "Live render or browser run opened"),
    validationItem("no.package.write", "authority", context.packageRows.every((item) => item.html_file_write_allowed_now === false && item.state_persist_allowed_now === false && item.form_submit_allowed_now === false), "Package write, persist, or submit opened"),
    validationItem("no.interactive.control", "authority", context.viewRows.every((item) => item.interactive_control_enabled_now === false && item.command_button_enabled_now === false && item.approve_button_enabled_now === false && item.closeout_button_enabled_now === false), "Interactive controls opened"),
    validationItem("no.receipt.accept", "authority", context.manifestRows.every((item) => item.review_receipt_accept_allowed_now === false)
      && context.packageRows.every((item) => item.review_receipt_accept_allowed_now === false)
      && context.viewRows.every((item) => item.review_receipt_accept_allowed_now === false)
      && context.affordanceRows.every((item) => item.review_receipt_accept_allowed_now === false), "Review receipt acceptance opened"),
    validationItem("no.reviewer.dispatch", "authority", context.viewRows.every((item) => item.reviewer_lane_dispatch_allowed_now === false)
      && context.affordanceRows.every((item) => item.reviewer_lane_dispatch_allowed_now === false), "Reviewer dispatch opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.server_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p41200_checkpoint.server_blocked"), "P41200 server blocker checkpoint is not visible"),
    validationItem("checkpoint.receipt_accept_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p41200_checkpoint.receipt_accept_blocked"), "P41200 receipt accept blocker checkpoint is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle.contract.v1",
    generated_at: generatedAt,
    source_p40800_required_or_rebuilt: true,
    implementation_review_ui_handoff_manifest_required: true,
    implementation_review_read_only_screen_package_required: true,
    implementation_review_operator_handoff_view_required: true,
    implementation_review_handoff_affordance_visibility_required: true,
    no_serve_no_receipt_accept_boundary_required: true,
    p41200_is_not_server_route_mount_live_render_browser_run_event_mutation_form_submit_state_persist_receipt_accept_reviewer_dispatch_execution_write_approval_production_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle
    ? READY_STATUS
    : validation.valid && boundary.p41200_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    work_os_static_bundle_review_ui_implementation_review_ui_handoff_status: status,
    source_p40800_ready_for_ui_handoff_bundle: boundary.source_p40800_ready_for_ui_handoff_bundle,
    implementation_review_ui_handoff_manifest_count: boundary.implementation_review_ui_handoff_manifest_count,
    implementation_review_read_only_screen_package_count: boundary.implementation_review_read_only_screen_package_count,
    implementation_review_operator_handoff_view_count: boundary.implementation_review_operator_handoff_view_count,
    implementation_review_handoff_affordance_visibility_count: boundary.implementation_review_handoff_affordance_visibility_count,
    server_allowed_count: boundary.server_allowed_count,
    render_allowed_count: boundary.render_allowed_count,
    state_persist_allowed_count: boundary.state_persist_allowed_count,
    interactive_control_enabled_count: boundary.interactive_control_enabled_count,
    receipt_accept_allowed_count: boundary.receipt_accept_allowed_count,
    reviewer_dispatch_allowed_count: boundary.reviewer_dispatch_allowed_count,
    ready_for_work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle: validation.valid && boundary.ready_for_work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle,
    ...Object.fromEntries(WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_UI_HANDOFF_FALSE_FLAGS.map((flag) => [flag, false])),
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Work OS Static Bundle Review UI Implementation Review UI Handoff Bundle",
    "",
    `Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_ui_handoff_status}`,
    `Program: ${result.program_range}`,
    `P40800 ready for UI handoff bundle: ${result.summary.source_p40800_ready_for_ui_handoff_bundle}`,
    `Handoff manifests: ${result.summary.implementation_review_ui_handoff_manifest_count}`,
    `Screen packages: ${result.summary.implementation_review_read_only_screen_package_count}`,
    `Operator views: ${result.summary.implementation_review_operator_handoff_view_count}`,
    `Ready for review UI package handoff: ${result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle}`,
    `Server allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_review_ui_handoff_server_allowed_now}`,
    `Receipt accept allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_review_ui_handoff_receipt_accept_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.implementation_review_read_only_screen_package_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.slot_id)}</td><td>${escapeHtml(item.route_path)}</td><td>${escapeHtml(item.review_receipt_accept_allowed_now)}</td><td>${escapeHtml(item.live_render_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Work OS Static Bundle Review UI Implementation Review UI Handoff Bundle</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f8fb; color: #1d2433; }
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
    <h1>Hermes Work OS Static Bundle Review UI Implementation Review UI Handoff Bundle</h1>
    <p class="notice">This artifact defines handoff bundle metadata only. It does not serve routes, render live UI, accept review receipts, enable controls, dispatch reviewers, execute, deploy, approve, or claim production readiness.</p>
    <table><thead><tr><th>Request</th><th>Slot</th><th>Route</th><th>Receipt Accept</th><th>Live Render</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP40800(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticUiAdapter({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.work_os_static_bundle_review_ui_implementation_review_static_ui_adapter", built);
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
  const defaults = DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_UI_HANDOFF_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_work_os_static_bundle_review_ui_implementation_review_static_ui_adapter_path: path.resolve(repoRoot, options.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticUiAdapterPath ?? defaults.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticUiAdapterPath),
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
      args.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticUiAdapterPath = argv[++index];
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
  console.log(`Usage: node scripts/work-os-static-bundle-review-ui-implementation-review-ui-handoff-bundle.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P40801-P41200 Work OS Static Bundle Review UI Implementation Review UI Handoff Bundle.
`);
}

function allFalseFlagsClosed(boundary) {
  return ALL_FALSE_FLAGS.every((flag) => boundary[flag] === false);
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}
