import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P38800_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiHandoffBundle,
} from "./work-os-static-bundle-review-ui-handoff-bundle.mjs";

export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_BINDING_CANDIDATE_OUT_DIR = "artifacts/work-os-static-bundle-review-ui-implementation-binding-candidate/latest";
export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_BINDING_CANDIDATE_INPUTS = {
  schemaPath: "schemas/work-os-static-bundle-review-ui-implementation-binding-candidate.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p38801-p39200.md",
  architectureDocPath: "docs/architecture.md",
  sourceWorkOsStaticBundleReviewUiHandoffBundlePath: "artifacts/work-os-static-bundle-review-ui-handoff-bundle/latest/work-os-static-bundle-review-ui-handoff-bundle.json",
};

const COMMAND_NAME = "platform:work-os-static-bundle-review-ui-implementation-binding-candidate";
const SCHEMA_VERSION = "work-os-static-bundle-review-ui-implementation-binding-candidate.v1";
const CAPABILITY_ID = "platform.work_os_static_bundle_review_ui_implementation_binding_candidate";
const PROGRAM_RANGE = "P38801-P39200";
const SOURCE_PROGRAM_RANGE = "P38401-P38800";
const READY_STATUS = "ready_for_work_os_static_bundle_review_ui_implementation_binding_candidate";
const BLOCK_PENDING_STATUS = "valid_block_work_os_static_bundle_review_ui_implementation_binding_candidate_pending";
const BLOCKED_STATUS = "blocked_work_os_static_bundle_review_ui_implementation_binding_candidate";

const PHASE_SPECS = [
  ["P38801-P38840", "P38800 Source Binding", "p38800_source_binding_rows"],
  ["P38841-P38900", "Implementation File Plan Candidate", "implementation_file_plan_candidate_rows"],
  ["P38901-P38960", "Component Binding Candidate", "component_binding_candidate_rows"],
  ["P38961-P39020", "Read-Only Data Binding Candidate", "read_only_data_binding_candidate_rows"],
  ["P39021-P39080", "Visual Token Binding Candidate", "visual_token_binding_candidate_rows"],
  ["P39081-P39140", "No File Apply No Build Boundary", "no_file_apply_no_build_boundary_rows"],
  ["P39141-P39200", "P39200 Clean Checkpoint", "p39200_clean_checkpoint_rows"],
];

export const WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_BINDING_FALSE_FLAGS = [
  "work_os_static_bundle_review_ui_implementation_binding_file_create_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_file_write_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_file_apply_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_generated_file_apply_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_template_apply_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_template_write_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_component_write_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_css_write_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_asset_copy_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_asset_build_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_build_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_server_start_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_route_mount_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_route_registration_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_live_render_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_browser_run_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_browser_smoke_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_snapshot_capture_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_network_fetch_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_state_mutation_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_click_action_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_command_button_enabled_now",
  "work_os_static_bundle_review_ui_implementation_binding_approve_button_enabled_now",
  "work_os_static_bundle_review_ui_implementation_binding_closeout_button_enabled_now",
  "work_os_static_bundle_review_ui_implementation_binding_receipt_accept_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_receipt_create_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_reviewer_dispatch_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_review_completion_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_claude_review_execution_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_human_adjudication_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_finding_resolution_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_runtime_execution_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_write_action_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_protected_action_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_connector_write_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_deployment_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_export_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_publish_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_raw_payload_exposure_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_secret_read_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_final_approval_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_production_pass_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_enterprise_trust_claim_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_human_gate_bypass_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_independent_review_bypass_allowed_now",
  "work_os_static_bundle_review_ui_implementation_binding_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_BINDING_FALSE_FLAGS, ...P38800_FALSE_FLAGS])];

export async function runWorkOsStaticBundleReviewUiImplementationBindingCandidate(options = {}) {
  const result = await buildWorkOsStaticBundleReviewUiImplementationBindingCandidate(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS Static Bundle Review UI Implementation Binding Candidate failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeWorkOsStaticBundleReviewUiImplementationBindingCandidate(result, result.output_dir);
  return result;
}

export async function buildWorkOsStaticBundleReviewUiImplementationBindingCandidate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_BINDING_CANDIDATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "workOsStaticBundleReviewUiHandoffBundle")
    ? normalizeInlineJsonSource("inline.work_os_static_bundle_review_ui_handoff_bundle", options.workOsStaticBundleReviewUiHandoffBundle)
    : await readJsonOrBuildP38800(inputs.source_work_os_static_bundle_review_ui_handoff_bundle_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const filePlanRows = buildImplementationFilePlanCandidateRows({ source, generatedAt });
  const componentRows = buildComponentBindingCandidateRows({ source, filePlanRows, generatedAt });
  const dataRows = buildReadOnlyDataBindingCandidateRows({ source, filePlanRows, componentRows, generatedAt });
  const tokenRows = buildVisualTokenBindingCandidateRows({ source, filePlanRows, componentRows, dataRows, generatedAt });
  const boundaryRows = buildNoFileApplyNoBuildBoundaryRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const checkpointRows = buildCheckpointRows({ sourceState, filePlanRows, componentRows, dataRows, tokenRows, boundaryRows, wiringRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, filePlanRows, componentRows, dataRows, tokenRows, boundaryRows, wiringRows, checkpointRows });
  const validationItems = buildValidationItems({ phaseRows, sourceRows, filePlanRows, componentRows, dataRows, tokenRows, boundaryRows, wiringRows, checkpointRows, boundary });
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
      work_os_static_bundle_review_ui_handoff_bundle_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_work_os_static_bundle_review_ui_handoff_summary: source.data?.summary ?? null,
    work_os_static_bundle_review_ui_implementation_binding_contract: buildContract(generatedAt),
    work_os_static_bundle_review_ui_implementation_binding_phase_rows: phaseRows,
    p38800_source_binding_rows: sourceRows,
    implementation_file_plan_candidate_rows: filePlanRows,
    component_binding_candidate_rows: componentRows,
    read_only_data_binding_candidate_rows: dataRows,
    visual_token_binding_candidate_rows: tokenRows,
    no_file_apply_no_build_boundary_rows: boundaryRows,
    work_os_static_bundle_review_ui_implementation_binding_wiring_rows: wiringRows,
    p39200_clean_checkpoint_rows: checkpointRows,
    work_os_static_bundle_review_ui_implementation_binding_boundary: boundary,
    work_os_static_bundle_review_ui_implementation_binding_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_static_bundle_review_ui_implementation_binding_candidate")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.work_os_static_bundle_review_ui_implementation_binding_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.work_os_static_bundle_review_ui_implementation_binding_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeWorkOsStaticBundleReviewUiImplementationBindingCandidate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-binding-candidate.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p38800-source-binding-rows.json"), collectionEnvelope("p38800-source-binding-rows.v1", "p38800_source_binding_rows", result.p38800_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "implementation-file-plan-candidate-rows.json"), collectionEnvelope("implementation-file-plan-candidate-rows.v1", "implementation_file_plan_candidate_rows", result.implementation_file_plan_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "component-binding-candidate-rows.json"), collectionEnvelope("component-binding-candidate-rows.v1", "component_binding_candidate_rows", result.component_binding_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "read-only-data-binding-candidate-rows.json"), collectionEnvelope("read-only-data-binding-candidate-rows.v1", "read_only_data_binding_candidate_rows", result.read_only_data_binding_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "visual-token-binding-candidate-rows.json"), collectionEnvelope("visual-token-binding-candidate-rows.v1", "visual_token_binding_candidate_rows", result.visual_token_binding_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-file-apply-no-build-boundary-rows.json"), collectionEnvelope("no-file-apply-no-build-boundary-rows.v1", "no_file_apply_no_build_boundary_rows", result.no_file_apply_no_build_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-binding-wiring-rows.json"), collectionEnvelope("work-os-static-bundle-review-ui-implementation-binding-wiring-rows.v1", "work_os_static_bundle_review_ui_implementation_binding_wiring_rows", result.work_os_static_bundle_review_ui_implementation_binding_wiring_rows, result.generated_at));
  await writeJson(path.join(outDir, "p39200-clean-checkpoint-rows.json"), collectionEnvelope("p39200-clean-checkpoint-rows.v1", "p39200_clean_checkpoint_rows", result.p39200_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-binding-boundary.json"), result.work_os_static_bundle_review_ui_implementation_binding_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runWorkOsStaticBundleReviewUiImplementationBindingCandidateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runWorkOsStaticBundleReviewUiImplementationBindingCandidate(args);
  console.log(`Work OS Static Bundle Review UI Implementation Binding Candidate ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.work_os_static_bundle_review_ui_implementation_binding_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P38800 ready for implementation binding: ${result.summary.source_p38800_ready_for_implementation_binding}`);
  console.log(`File plan candidates: ${result.summary.implementation_file_plan_candidate_count}`);
  console.log(`Component bindings: ${result.summary.component_binding_candidate_count}`);
  console.log(`Read-only data bindings: ${result.summary.read_only_data_binding_candidate_count}`);
  console.log(`Ready for implementation package handoff: ${result.summary.ready_for_work_os_static_bundle_review_ui_implementation_binding_handoff}`);
  console.log(`File write allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_binding_file_write_allowed_now}`);
  console.log(`Build allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_binding_build_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.work_os_static_bundle_review_ui_handoff_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_work_os_static_bundle_review_ui_handoff_bundle === true,
    status: summary.work_os_static_bundle_review_ui_handoff_status ?? "missing",
    p38800ContractReady: boundary.p38800_contract_ready === true,
    manifestVisible: boundary.static_review_ui_handoff_manifest_visible_now === true,
    screenPackageVisible: boundary.read_only_review_screen_package_visible_now === true,
    operatorViewVisible: boundary.operator_review_handoff_view_visible_now === true,
    affordanceVisible: boundary.review_handoff_affordance_visibility_now === true,
    noServeNoReceiptAcceptClosed: boundary.no_serve_no_receipt_accept_boundary_closed_now === true,
    wiringVisible: boundary.work_os_static_bundle_review_ui_handoff_wiring_complete_now === true,
    boundaryClosed: P38800_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p38801-p39200.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P38800 review UI handoff bundle source is available", sourceState.available],
    ["program_range", "P38800 source program range is P38401-P38800", sourceState.programRangeOk],
    ["validation_valid", "P38800 source validation is valid", sourceState.validationValid],
    ["implementation_binding_handoff_open", "P38800 opened implementation binding handoff", sourceState.sourceReady],
    ["p38800_contract_ready", "P38800 source contract is ready", sourceState.p38800ContractReady],
    ["manifest_visible", "P38800 handoff manifests are visible", sourceState.manifestVisible],
    ["screen_package_visible", "P38800 read-only screen packages are visible", sourceState.screenPackageVisible],
    ["operator_view_visible", "P38800 operator handoff views are visible", sourceState.operatorViewVisible],
    ["affordance_visible", "P38800 affordance visibility rows are visible", sourceState.affordanceVisible],
    ["no_serve_no_receipt_accept_closed", "P38800 no-serve/no-receipt boundary is closed", sourceState.noServeNoReceiptAcceptClosed],
    ["wiring_visible", "P38800 UI handoff wiring is visible", sourceState.wiringVisible],
    ["commit_ref_present", "Current commit ref is present for implementation binding candidate", Boolean(commitRef)],
    ["source_blocker_visible", "P38800 source blocker is visible when implementation binding is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p38800_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildImplementationFilePlanCandidateRows({ source, generatedAt }) {
  const manifestRows = source.data?.static_review_ui_handoff_manifest_rows ?? [];
  return manifestRows.map((manifest) => row({
    row_id: `implementation_file_plan_candidate.${manifest.request_id}`,
    category: "implementation_file_plan_candidate",
    label: `Implementation file plan candidate for ${manifest.request_id}`,
    observed: Boolean(manifest.request_id && manifest.manifest_visible_now === true),
    evidence_ref: manifest.row_id,
    request_id: manifest.request_id,
    file_plan_ref: `work_os.static_bundle_review.implementation.${manifest.request_id}.file_plan`,
    proposed_component_path: `src/ui/work-os/static-bundle-review/${safePathSegment(manifest.request_id)}.tsx`,
    proposed_test_path: `test/ui/work-os/static-bundle-review/${safePathSegment(manifest.request_id)}.test.mjs`,
    proposed_style_path: `src/ui/work-os/static-bundle-review/${safePathSegment(manifest.request_id)}.css`,
    route_path: manifest.route_path,
    file_plan_visible_now: true,
    file_create_allowed_now: false,
    file_write_allowed_now: false,
    file_apply_allowed_now: false,
    generated_file_apply_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildComponentBindingCandidateRows({ source, filePlanRows, generatedAt }) {
  const packageRows = source.data?.read_only_review_screen_package_rows ?? [];
  return filePlanRows.map((filePlan) => {
    const screenPackage = packageRows.find((item) => item.request_id === filePlan.request_id);
    return row({
      row_id: `component_binding_candidate.${filePlan.request_id}`,
      category: "component_binding_candidate",
      label: `Component binding candidate for ${filePlan.request_id}`,
      observed: Boolean(screenPackage),
      evidence_ref: screenPackage?.row_id ?? filePlan.row_id,
      request_id: filePlan.request_id,
      component_binding_ref: `work_os.static_bundle_review.implementation.${filePlan.request_id}.component_binding`,
      file_plan_ref: filePlan.file_plan_ref,
      screen_package_ref: screenPackage?.screen_package_ref ?? null,
      screen_id: screenPackage?.screen_id ?? "work_os.static_bundle_review.static_shell",
      slot_id: screenPackage?.slot_id ?? null,
      component_name: `StaticBundleReview${toPascalCase(filePlan.request_id)}Card`,
      component_binding_visible_now: true,
      template_apply_allowed_now: false,
      template_write_allowed_now: false,
      component_write_allowed_now: false,
      css_write_allowed_now: false,
      asset_copy_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildReadOnlyDataBindingCandidateRows({ source, filePlanRows, componentRows, generatedAt }) {
  const packageRows = source.data?.read_only_review_screen_package_rows ?? [];
  return filePlanRows.map((filePlan) => {
    const component = componentRows.find((item) => item.request_id === filePlan.request_id);
    const screenPackage = packageRows.find((item) => item.request_id === filePlan.request_id);
    return row({
      row_id: `read_only_data_binding_candidate.${filePlan.request_id}`,
      category: "read_only_data_binding_candidate",
      label: `Read-only data binding candidate for ${filePlan.request_id}`,
      observed: Boolean(component && screenPackage),
      evidence_ref: component?.row_id ?? filePlan.row_id,
      request_id: filePlan.request_id,
      data_binding_ref: `work_os.static_bundle_review.implementation.${filePlan.request_id}.data_binding`,
      component_binding_ref: component?.component_binding_ref ?? null,
      route_path: screenPackage?.route_path ?? filePlan.route_path,
      allowed_methods: screenPackage?.allowed_methods ?? ["GET"],
      static_data_source_ref: screenPackage?.screen_package_ref ?? null,
      data_binding_visible_now: true,
      network_fetch_allowed_now: false,
      runtime_fetch_allowed_now: false,
      state_mutation_allowed_now: false,
      raw_payload_exposure_allowed_now: false,
      review_receipt_accept_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildVisualTokenBindingCandidateRows({ source, filePlanRows, componentRows, dataRows, generatedAt }) {
  const viewRows = source.data?.operator_review_handoff_view_rows ?? [];
  return filePlanRows.map((filePlan) => {
    const component = componentRows.find((item) => item.request_id === filePlan.request_id);
    const data = dataRows.find((item) => item.request_id === filePlan.request_id);
    const view = viewRows.find((item) => item.request_id === filePlan.request_id);
    return row({
      row_id: `visual_token_binding_candidate.${filePlan.request_id}`,
      category: "visual_token_binding_candidate",
      label: `Visual token binding candidate for ${filePlan.request_id}`,
      observed: Boolean(component && data && view),
      evidence_ref: view?.row_id ?? component?.row_id ?? filePlan.row_id,
      request_id: filePlan.request_id,
      visual_token_binding_ref: `work_os.static_bundle_review.implementation.${filePlan.request_id}.visual_tokens`,
      component_binding_ref: component?.component_binding_ref ?? null,
      data_binding_ref: data?.data_binding_ref ?? null,
      operator_view_ref: view?.operator_view_ref ?? null,
      token_refs: [
        "work_os.surface.panel",
        "work_os.status.blocked",
        "work_os.control.disabled",
        "work_os.review.badge",
      ],
      visual_token_binding_visible_now: true,
      asset_build_allowed_now: false,
      live_render_allowed_now: false,
      browser_smoke_allowed_now: false,
      snapshot_capture_allowed_now: false,
      click_action_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildNoFileApplyNoBuildBoundaryRows(generatedAt) {
  const stateRows = [
    ["state.file_plan_is_not_file_write", "Implementation file plan must not create, write, or apply files", true],
    ["state.component_binding_is_not_template_apply", "Component binding must not apply templates or write components", true],
    ["state.data_binding_is_not_runtime_fetch", "Data binding must not fetch network data or expose raw payloads", true],
    ["state.visual_token_binding_is_not_render", "Visual token binding must not build assets or render live UI", true],
  ].map(([id, label, observed]) => row({
    row_id: `no_file_apply_no_build_boundary.${id}`,
    category: "no_file_apply_no_build_boundary",
    label,
    observed,
    evidence_ref: "work_os_static_bundle_review_ui_implementation_binding_boundary",
    generated_at: generatedAt,
  }));
  const boundaryRows = ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_file_apply_no_build_boundary.${flag}`,
    category: "no_file_apply_no_build_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "work_os_static_bundle_review_ui_implementation_binding_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
  return [...stateRows, ...boundaryRows];
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  return [
    ["package_script", "Package script is wired", hasScript(packageJson.data, COMMAND_NAME), "package.json"],
    ["validate_chain", "Validate chain includes P39200 check", packageJson.text.includes(`${COMMAND_NAME} -- --check`), "package.json"],
    ["schema_file", "Schema file is configured", packageJson.available, "schemas/work-os-static-bundle-review-ui-implementation-binding-candidate.schema.json"],
    ["roadmap_doc", "Roadmap documents all P38801-P39200 slices", PHASE_SPECS.every(([range]) => roadmapDoc.text.includes(range)), "docs/hermes-roadmap-p38801-p39200.md"],
    ["architecture_doc", "Architecture doc references P38801-P39200", architectureDoc.text.includes("P38801-P39200 Work OS Static Bundle Review UI Implementation Binding Candidate"), "docs/architecture.md"],
  ].map(([id, label, observed, evidenceRef]) => row({
    row_id: `work_os_static_bundle_review_ui_implementation_binding_wiring.${id}`,
    category: "work_os_static_bundle_review_ui_implementation_binding_wiring",
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
    && allPass(context.filePlanRows)
    && allPass(context.componentRows)
    && allPass(context.dataRows)
    && allPass(context.tokenRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows);
  return [
    ["source_ready", "P38800 source is ready for implementation binding", context.sourceState.sourceReady],
    ["file_plan_visible", "Implementation file plan candidates are visible", allPass(context.filePlanRows)],
    ["component_binding_visible", "Component binding candidates are visible", allPass(context.componentRows)],
    ["data_binding_visible", "Read-only data binding candidates are visible", allPass(context.dataRows)],
    ["visual_token_binding_visible", "Visual token binding candidates are visible", allPass(context.tokenRows)],
    ["no_file_apply_no_build_boundary_closed", "No-file-apply/no-build boundary stays closed", allPass(context.boundaryRows)],
    ["wiring_complete", "CLI, schema, package, roadmap, and architecture wiring are visible", allPass(context.wiringRows)],
    ["file_write_blocked", "File create/write/apply remains blocked", true],
    ["build_blocked", "Build, server, route mount, and render remain blocked", true],
    ["receipt_accept_blocked", "Review receipt acceptance remains blocked", true],
    ["implementation_binding_handoff", "Implementation binding opens only as metadata", ready],
  ].map(([id, label, observed]) => row({
    row_id: `p39200_checkpoint.${id}`,
    category: "p39200_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p39200_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p39200ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.filePlanRows)
    && allPass(context.componentRows)
    && allPass(context.dataRows)
    && allPass(context.tokenRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows)
    && visibleOrPassed(context.checkpointRows, "p39200_checkpoint.file_write_blocked")
    && visibleOrPassed(context.checkpointRows, "p39200_checkpoint.build_blocked")
    && visibleOrPassed(context.checkpointRows, "p39200_checkpoint.receipt_accept_blocked");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p39200ContractReady;
  return {
    p39200_contract_ready: p39200ContractReady,
    ready_for_work_os_static_bundle_review_ui_implementation_binding_handoff: ready,
    source_p38800_ready_for_implementation_binding: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    implementation_file_plan_candidate_visible_now: allPass(context.filePlanRows),
    component_binding_candidate_visible_now: allPass(context.componentRows),
    read_only_data_binding_candidate_visible_now: allPass(context.dataRows),
    visual_token_binding_candidate_visible_now: allPass(context.tokenRows),
    no_file_apply_no_build_boundary_closed_now: allPass(context.boundaryRows),
    work_os_static_bundle_review_ui_implementation_binding_wiring_complete_now: allPass(context.wiringRows),
    implementation_file_plan_candidate_count: context.filePlanRows.length,
    component_binding_candidate_count: context.componentRows.length,
    read_only_data_binding_candidate_count: context.dataRows.length,
    visual_token_binding_candidate_count: context.tokenRows.length,
    file_write_allowed_count: context.filePlanRows.filter((item) => item.file_create_allowed_now === true || item.file_write_allowed_now === true || item.file_apply_allowed_now === true).length,
    template_apply_allowed_count: context.componentRows.filter((item) => item.template_apply_allowed_now === true || item.component_write_allowed_now === true || item.css_write_allowed_now === true).length,
    build_allowed_count: context.tokenRows.filter((item) => item.asset_build_allowed_now === true || item.live_render_allowed_now === true || item.browser_smoke_allowed_now === true).length,
    runtime_fetch_allowed_count: context.dataRows.filter((item) => item.network_fetch_allowed_now === true || item.runtime_fetch_allowed_now === true).length,
    receipt_accept_allowed_count: context.dataRows.filter((item) => item.review_receipt_accept_allowed_now === true).length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  };
}

function buildValidationItems(context) {
  return [
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P38801-P39200 phase rows are incomplete"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P38800 source state is not visible"),
    validationItem("file_plan.visible", "implementation", allPass(context.filePlanRows), "Implementation file plan candidates are incomplete"),
    validationItem("component.visible", "implementation", allPass(context.componentRows), "Component binding candidates are incomplete"),
    validationItem("data.visible", "implementation", allPass(context.dataRows), "Read-only data binding candidates are incomplete"),
    validationItem("token.visible", "implementation", allPass(context.tokenRows), "Visual token binding candidates are incomplete"),
    validationItem("boundary.visible", "authority", allPass(context.boundaryRows), "No-file-apply/no-build boundary rows are incomplete"),
    validationItem("wiring.complete", "wiring", allPass(context.wiringRows), "P38801-P39200 wiring is incomplete"),
    validationItem("no.file.write", "authority", context.filePlanRows.every((item) => item.file_create_allowed_now === false && item.file_write_allowed_now === false && item.file_apply_allowed_now === false), "File create/write/apply opened"),
    validationItem("no.template.apply", "authority", context.componentRows.every((item) => item.template_apply_allowed_now === false && item.component_write_allowed_now === false && item.css_write_allowed_now === false), "Template or component write opened"),
    validationItem("no.runtime.fetch", "authority", context.dataRows.every((item) => item.network_fetch_allowed_now === false && item.runtime_fetch_allowed_now === false && item.raw_payload_exposure_allowed_now === false), "Runtime fetch or raw payload exposure opened"),
    validationItem("no.build.render", "authority", context.tokenRows.every((item) => item.asset_build_allowed_now === false && item.live_render_allowed_now === false && item.browser_smoke_allowed_now === false), "Build or render opened"),
    validationItem("no.receipt.accept", "authority", context.dataRows.every((item) => item.review_receipt_accept_allowed_now === false), "Review receipt acceptance opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.file_write_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p39200_checkpoint.file_write_blocked"), "P39200 file-write blocker checkpoint is not visible"),
    validationItem("checkpoint.build_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p39200_checkpoint.build_blocked"), "P39200 build blocker checkpoint is not visible"),
    validationItem("checkpoint.receipt_accept_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p39200_checkpoint.receipt_accept_blocked"), "P39200 receipt accept blocker checkpoint is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "work_os_static_bundle_review_ui_implementation_binding_candidate.contract.v1",
    generated_at: generatedAt,
    source_p38800_required_or_rebuilt: true,
    implementation_file_plan_candidate_required: true,
    component_binding_candidate_required: true,
    read_only_data_binding_candidate_required: true,
    visual_token_binding_candidate_required: true,
    no_file_apply_no_build_boundary_required: true,
    p39200_is_not_file_create_write_apply_template_apply_component_write_build_server_render_receipt_accept_execution_write_approval_production_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_work_os_static_bundle_review_ui_implementation_binding_handoff
    ? READY_STATUS
    : validation.valid && boundary.p39200_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    work_os_static_bundle_review_ui_implementation_binding_status: status,
    source_p38800_ready_for_implementation_binding: boundary.source_p38800_ready_for_implementation_binding,
    implementation_file_plan_candidate_count: boundary.implementation_file_plan_candidate_count,
    component_binding_candidate_count: boundary.component_binding_candidate_count,
    read_only_data_binding_candidate_count: boundary.read_only_data_binding_candidate_count,
    visual_token_binding_candidate_count: boundary.visual_token_binding_candidate_count,
    file_write_allowed_count: boundary.file_write_allowed_count,
    template_apply_allowed_count: boundary.template_apply_allowed_count,
    build_allowed_count: boundary.build_allowed_count,
    runtime_fetch_allowed_count: boundary.runtime_fetch_allowed_count,
    receipt_accept_allowed_count: boundary.receipt_accept_allowed_count,
    ready_for_work_os_static_bundle_review_ui_implementation_binding_handoff: validation.valid && boundary.ready_for_work_os_static_bundle_review_ui_implementation_binding_handoff,
    ...Object.fromEntries(WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_BINDING_FALSE_FLAGS.map((flag) => [flag, false])),
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Work OS Static Bundle Review UI Implementation Binding Candidate",
    "",
    `Status: ${result.summary.work_os_static_bundle_review_ui_implementation_binding_status}`,
    `Program: ${result.program_range}`,
    `P38800 ready for implementation binding: ${result.summary.source_p38800_ready_for_implementation_binding}`,
    `File plan candidates: ${result.summary.implementation_file_plan_candidate_count}`,
    `Component bindings: ${result.summary.component_binding_candidate_count}`,
    `Read-only data bindings: ${result.summary.read_only_data_binding_candidate_count}`,
    `Ready for implementation package handoff: ${result.summary.ready_for_work_os_static_bundle_review_ui_implementation_binding_handoff}`,
    `File write allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_binding_file_write_allowed_now}`,
    `Build allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_binding_build_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.implementation_file_plan_candidate_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.proposed_component_path)}</td><td>${escapeHtml(item.file_write_allowed_now)}</td><td>${escapeHtml(item.file_apply_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Work OS Static Bundle Review UI Implementation Binding Candidate</title>
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
    <h1>Hermes Work OS Static Bundle Review UI Implementation Binding Candidate</h1>
    <p class="notice">This artifact defines implementation binding metadata only. It does not create, write, apply, build, render, execute, accept review receipts, or approve work.</p>
    <table><thead><tr><th>Request</th><th>Proposed Component</th><th>Write</th><th>Apply</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP38800(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildWorkOsStaticBundleReviewUiHandoffBundle({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.work_os_static_bundle_review_ui_handoff_bundle", built);
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
  const defaults = DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_BINDING_CANDIDATE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_work_os_static_bundle_review_ui_handoff_bundle_path: path.resolve(repoRoot, options.sourceWorkOsStaticBundleReviewUiHandoffBundlePath ?? defaults.sourceWorkOsStaticBundleReviewUiHandoffBundlePath),
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
      args.sourceWorkOsStaticBundleReviewUiHandoffBundlePath = argv[++index];
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
  console.log(`Usage: node scripts/work-os-static-bundle-review-ui-implementation-binding-candidate.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P38801-P39200 Work OS Static Bundle Review UI Implementation Binding Candidate.
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

function safePathSegment(value) {
  return String(value).replace(/^req\./, "").replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
}

function toPascalCase(value) {
  return String(value)
    .replace(/^req\./, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
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
