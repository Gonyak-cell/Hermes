import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P43600_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellFilePlanCandidate,
} from "./work-os-static-bundle-review-ui-implementation-review-static-shell-file-plan-candidate.mjs";

export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_BINDING_CANDIDATE_OUT_DIR = "artifacts/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-binding-candidate/latest";
export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_BINDING_CANDIDATE_INPUTS = {
  schemaPath: "schemas/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-binding-candidate.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p43601-p44000.md",
  architectureDocPath: "docs/architecture.md",
  sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellFilePlanCandidatePath: "artifacts/work-os-static-bundle-review-ui-implementation-review-static-shell-file-plan-candidate/latest/work-os-static-bundle-review-ui-implementation-review-static-shell-file-plan-candidate.json",
};

const COMMAND_NAME = "platform:work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-binding-candidate";
const SCHEMA_VERSION = "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-binding-candidate.v1";
const CAPABILITY_ID = "platform.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_binding_candidate";
const PROGRAM_RANGE = "P43601-P44000";
const SOURCE_PROGRAM_RANGE = "P43201-P43600";
const READY_STATUS = "ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_binding_candidate";
const BLOCK_PENDING_STATUS = "valid_block_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_binding_candidate_pending";
const BLOCKED_STATUS = "blocked_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_binding_candidate";

const PHASE_SPECS = [
  ["P43601-P43640", "P43600 Source Binding", "p43600_source_binding_rows"],
  ["P43641-P43720", "Implementation Placement Candidate", "implementation_placement_candidate_rows"],
  ["P43721-P43800", "Component/Template Binding Candidate", "component_template_binding_candidate_rows"],
  ["P43801-P43880", "Read-Only Data Binding Candidate", "read_only_data_binding_candidate_rows"],
  ["P43881-P43940", "Visual Token Binding Candidate", "visual_token_binding_candidate_rows"],
  ["P43941-P43980", "Implementation No-Authority Boundary", "no_authority_boundary_rows"],
  ["P43981-P44000", "P44000 Clean Checkpoint", "p44000_clean_checkpoint_rows"],
];

export const STATIC_SHELL_IMPLEMENTATION_BINDING_CANDIDATE_FALSE_FLAGS = [
  "static_shell_implementation_binding_candidate_file_create_allowed_now",
  "static_shell_implementation_binding_candidate_file_write_allowed_now",
  "static_shell_implementation_binding_candidate_template_apply_allowed_now",
  "static_shell_implementation_binding_candidate_template_write_allowed_now",
  "static_shell_implementation_binding_candidate_component_write_allowed_now",
  "static_shell_implementation_binding_candidate_css_write_allowed_now",
  "static_shell_implementation_binding_candidate_asset_import_allowed_now",
  "static_shell_implementation_binding_candidate_asset_build_allowed_now",
  "static_shell_implementation_binding_candidate_build_allowed_now",
  "static_shell_implementation_binding_candidate_server_start_allowed_now",
  "static_shell_implementation_binding_candidate_route_registration_allowed_now",
  "static_shell_implementation_binding_candidate_route_mount_allowed_now",
  "static_shell_implementation_binding_candidate_route_execution_allowed_now",
  "static_shell_implementation_binding_candidate_dom_render_allowed_now",
  "static_shell_implementation_binding_candidate_browser_run_allowed_now",
  "static_shell_implementation_binding_candidate_browser_smoke_allowed_now",
  "static_shell_implementation_binding_candidate_client_hydration_allowed_now",
  "static_shell_implementation_binding_candidate_live_refresh_allowed_now",
  "static_shell_implementation_binding_candidate_network_fetch_allowed_now",
  "static_shell_implementation_binding_candidate_snapshot_capture_allowed_now",
  "static_shell_implementation_binding_candidate_click_action_allowed_now",
  "static_shell_implementation_binding_candidate_keyboard_action_allowed_now",
  "static_shell_implementation_binding_candidate_command_button_enabled_now",
  "static_shell_implementation_binding_candidate_approve_button_enabled_now",
  "static_shell_implementation_binding_candidate_closeout_button_enabled_now",
  "static_shell_implementation_binding_candidate_state_mutation_allowed_now",
  "static_shell_implementation_binding_candidate_write_allowed_now",
  "static_shell_implementation_binding_candidate_html_file_write_allowed_now",
  "static_shell_implementation_binding_candidate_raw_payload_exposure_allowed_now",
  "static_shell_implementation_binding_candidate_secret_exposure_allowed_now",
  "static_shell_implementation_binding_candidate_export_allowed_now",
  "static_shell_implementation_binding_candidate_publish_allowed_now",
  "static_shell_implementation_binding_candidate_final_approval_allowed_now",
  "static_shell_implementation_binding_candidate_production_pass_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...STATIC_SHELL_IMPLEMENTATION_BINDING_CANDIDATE_FALSE_FLAGS, ...P43600_FALSE_FLAGS])];

export async function runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationBindingCandidate(options = {}) {
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationBindingCandidate(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Binding Candidate failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationBindingCandidate(result, result.output_dir);
  return result;
}

export async function buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationBindingCandidate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_BINDING_CANDIDATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "workOsStaticBundleReviewUiImplementationReviewStaticShellFilePlanCandidate")
    ? normalizeInlineJsonSource("inline.work_os_static_bundle_review_ui_implementation_review_static_shell_file_plan_candidate", options.workOsStaticBundleReviewUiImplementationReviewStaticShellFilePlanCandidate)
    : await readJsonOrBuildP43600(inputs.source_work_os_static_bundle_review_ui_implementation_review_static_shell_file_plan_candidate_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const placementRows = buildImplementationPlacementCandidateRows({ source, generatedAt });
  const componentRows = buildComponentTemplateBindingCandidateRows({ source, placementRows, generatedAt });
  const dataRows = buildReadOnlyDataBindingCandidateRows({ source, placementRows, componentRows, generatedAt });
  const tokenRows = buildVisualTokenBindingCandidateRows({ source, placementRows, componentRows, dataRows, generatedAt });
  const boundaryRows = buildNoAuthorityBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, placementRows, componentRows, dataRows, tokenRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, placementRows, componentRows, dataRows, tokenRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, placementRows, componentRows, dataRows, tokenRows, boundaryRows, checkpointRows, boundary });
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
      work_os_static_bundle_review_ui_implementation_review_static_shell_file_plan_candidate_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_work_os_static_bundle_review_ui_implementation_review_static_shell_file_plan_candidate_summary: source.data?.summary ?? null,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_binding_candidate_contract: buildContract(generatedAt),
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_binding_candidate_phase_rows: phaseRows,
    p43600_source_binding_rows: sourceRows,
    implementation_placement_candidate_rows: placementRows,
    component_template_binding_candidate_rows: componentRows,
    read_only_data_binding_candidate_rows: dataRows,
    visual_token_binding_candidate_rows: tokenRows,
    no_authority_boundary_rows: boundaryRows,
    p44000_clean_checkpoint_rows: checkpointRows,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_binding_candidate_boundary: boundary,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_binding_candidate_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_binding_candidate")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_binding_candidate_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_binding_candidate_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationBindingCandidate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-binding-candidate.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p43600-source-binding-rows.json"), collectionEnvelope("p43600-source-binding-rows.v1", "p43600_source_binding_rows", result.p43600_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "implementation-placement-candidate-rows.json"), collectionEnvelope("implementation-placement-candidate-rows.v1", "implementation_placement_candidate_rows", result.implementation_placement_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "component-template-binding-candidate-rows.json"), collectionEnvelope("component-template-binding-candidate-rows.v1", "component_template_binding_candidate_rows", result.component_template_binding_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "read-only-data-binding-candidate-rows.json"), collectionEnvelope("read-only-data-binding-candidate-rows.v1", "read_only_data_binding_candidate_rows", result.read_only_data_binding_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "visual-token-binding-candidate-rows.json"), collectionEnvelope("visual-token-binding-candidate-rows.v1", "visual_token_binding_candidate_rows", result.visual_token_binding_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-authority-boundary-rows.json"), collectionEnvelope("no-authority-boundary-rows.v1", "no_authority_boundary_rows", result.no_authority_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p44000-clean-checkpoint-rows.json"), collectionEnvelope("p44000-clean-checkpoint-rows.v1", "p44000_clean_checkpoint_rows", result.p44000_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-binding-candidate-boundary.json"), result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_binding_candidate_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationBindingCandidateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationBindingCandidate(args);
  console.log(`Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Binding Candidate ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_binding_candidate_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P43600 ready for P43601 handoff: ${result.summary.source_p43600_ready_for_p43601_handoff}`);
  console.log(`Implementation placement rows: ${result.summary.implementation_placement_candidate_count}`);
  console.log(`Component/template rows: ${result.summary.component_template_binding_candidate_count}`);
  console.log(`Read-only data rows: ${result.summary.read_only_data_binding_candidate_count}`);
  console.log(`Visual token rows: ${result.summary.visual_token_binding_candidate_count}`);
  console.log(`Ready for P44001 handoff: ${result.summary.ready_for_p44001_handoff}`);
  console.log(`File write allowed: ${result.summary.static_shell_implementation_binding_candidate_file_write_allowed_now}`);
  console.log(`Build allowed: ${result.summary.static_shell_implementation_binding_candidate_build_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.work_os_static_bundle_review_ui_implementation_review_static_shell_file_plan_candidate_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p43601_handoff === true,
    status: summary.work_os_static_bundle_review_ui_implementation_review_static_shell_file_plan_candidate_status ?? "missing",
    p43600ContractReady: boundary.p43600_contract_ready === true,
    filePlanVisible: boundary.static_shell_file_plan_candidate_visible_now === true,
    templateFileTargetVisible: boundary.template_file_target_candidate_visible_now === true,
    stateCopyIntegrationVisible: boundary.state_copy_integration_candidate_visible_now === true,
    assetTokenVisible: boundary.asset_token_candidate_visible_now === true,
    noWriteNoBuildClosed: boundary.no_write_no_build_boundary_closed_now === true,
    boundaryClosed: P43600_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p43601-p44000.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P43600 implementation review static shell file plan candidate source is available", sourceState.available],
    ["program_range", "P43600 source program range is P43201-P43600", sourceState.programRangeOk],
    ["validation_valid", "P43600 source validation is valid", sourceState.validationValid],
    ["p43601_handoff_open", "P43600 source opened P43601 handoff", sourceState.sourceReady],
    ["p43600_contract_ready", "P43600 source contract is ready", sourceState.p43600ContractReady],
    ["file_plan_visible", "P43600 file plan candidate rows are visible", sourceState.filePlanVisible],
    ["template_file_target_visible", "P43600 template file target candidate rows are visible", sourceState.templateFileTargetVisible],
    ["state_copy_integration_visible", "P43600 state/copy integration candidate rows are visible", sourceState.stateCopyIntegrationVisible],
    ["asset_token_visible", "P43600 asset/token candidate rows are visible", sourceState.assetTokenVisible],
    ["no_write_no_build_closed", "P43600 no-write/no-build boundary is closed", sourceState.noWriteNoBuildClosed],
    ["commit_ref_present", "Current commit ref is present for static shell implementation binding candidate", Boolean(commitRef)],
    ["source_blocker_visible", "P43600 source blocker is visible when implementation binding candidate is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p43600_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildImplementationPlacementCandidateRows({ source, generatedAt }) {
  const filePlanRows = Array.isArray(source.data?.static_shell_file_plan_candidate_rows) ? source.data.static_shell_file_plan_candidate_rows : [];
  return filePlanRows.map((filePlan, index) => {
    const sectionId = filePlan.shell_section_id ?? `section_${index + 1}`;
    return row({
      row_id: `implementation_placement_candidate.${sectionId}`,
      category: "implementation_placement_candidate",
      label: `Implementation placement candidate for ${sectionId}`,
      observed: filePlan.current_verdict === "pass" && filePlan.file_plan_metadata_only === true && filePlan.file_create_allowed_now === false && filePlan.file_write_allowed_now === false,
      evidence_ref: filePlan.row_id,
      source_file_plan_candidate_ref: filePlan.row_id,
      implementation_binding_candidate_id: `implementation_binding.implementation_review.${sectionId}`,
      shell_section_id: sectionId,
      candidate_path_hint: filePlan.candidate_path_hint,
      component_slot_hint: `WorkOsImplementationReview${toPascal(sectionId)}Slot`,
      route_hint: `/work-os/implementation-review#${toKebab(sectionId)}`,
      safe_dom_anchor: filePlan.safe_dom_anchor ?? `data-hermes-section="${sectionId}"`,
      implementation_metadata_only: true,
      file_create_allowed_now: false,
      file_write_allowed_now: false,
      component_write_allowed_now: false,
      route_registration_allowed_now: false,
      route_mount_allowed_now: false,
      route_execution_allowed_now: false,
      dom_render_allowed_now: false,
      build_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildComponentTemplateBindingCandidateRows({ source, placementRows, generatedAt }) {
  const templateRows = Array.isArray(source.data?.template_file_target_candidate_rows) ? source.data.template_file_target_candidate_rows : [];
  return placementRows.map((placement, index) => {
    const template = templateRows[index % Math.max(templateRows.length, 1)];
    return row({
      row_id: `component_template_binding_candidate.${placement.shell_section_id}`,
      category: "component_template_binding_candidate",
      label: `Component/template binding candidate for ${placement.shell_section_id}`,
      observed: placement.current_verdict === "pass" && Boolean(template) && template.current_verdict === "pass" && template.file_write_allowed_now === false,
      evidence_ref: template?.row_id ?? placement.row_id,
      implementation_placement_candidate_ref: placement.row_id,
      source_template_file_target_candidate_ref: template?.row_id ?? null,
      shell_section_id: placement.shell_section_id,
      component_role: `implementation_review.${placement.shell_section_id}.read_only_section`,
      component_slot_hint: placement.component_slot_hint,
      target_path_hint: template?.target_path_hint ?? placement.candidate_path_hint,
      data_attribute_contract: template?.data_attribute_contract ?? `data-hermes-section=${placement.shell_section_id}`,
      empty_state_copy_ref: `copy.implementation_review.${placement.shell_section_id}.empty`,
      loading_state_copy_ref: `copy.implementation_review.${placement.shell_section_id}.loading`,
      blocked_state_copy_ref: `copy.implementation_review.${placement.shell_section_id}.blocked`,
      component_template_metadata_only: true,
      template_apply_allowed_now: false,
      template_write_allowed_now: false,
      component_write_allowed_now: false,
      html_file_write_allowed_now: false,
      dom_render_allowed_now: false,
      build_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildReadOnlyDataBindingCandidateRows({ source, placementRows, componentRows, generatedAt }) {
  const integrationRows = Array.isArray(source.data?.state_copy_integration_candidate_rows) ? source.data.state_copy_integration_candidate_rows : [];
  return placementRows.map((placement, index) => {
    const component = componentRows[index % Math.max(componentRows.length, 1)];
    const integration = integrationRows[index % Math.max(integrationRows.length, 1)];
    return row({
      row_id: `read_only_data_binding_candidate.${placement.shell_section_id}`,
      category: "read_only_data_binding_candidate",
      label: `Read-only data binding candidate for ${placement.shell_section_id}`,
      observed: placement.current_verdict === "pass" && component?.current_verdict === "pass" && integration?.read_only === true && integration?.advisory_only === true,
      evidence_ref: integration?.row_id ?? component?.row_id ?? placement.row_id,
      implementation_placement_candidate_ref: placement.row_id,
      component_template_binding_candidate_ref: component?.row_id ?? null,
      source_state_copy_integration_candidate_ref: integration?.row_id ?? null,
      shell_section_id: placement.shell_section_id,
      api_projection_ref: `read_model.implementation_review.${placement.shell_section_id}.summary`,
      summary_field_refs: [
        `summary.implementation_review.${placement.shell_section_id}.status`,
        `summary.implementation_review.${placement.shell_section_id}.count`,
        `summary.implementation_review.${placement.shell_section_id}.blocked_reason`,
      ],
      allowed_methods: ["GET", "HEAD"],
      read_only: true,
      advisory_only: true,
      raw_payload_included: false,
      network_fetch_allowed_now: false,
      client_hydration_allowed_now: false,
      live_refresh_allowed_now: false,
      state_mutation_allowed_now: false,
      click_action_allowed_now: false,
      keyboard_action_allowed_now: false,
      write_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildVisualTokenBindingCandidateRows({ source, placementRows, componentRows, dataRows, generatedAt }) {
  const assetRows = Array.isArray(source.data?.asset_token_candidate_rows) ? source.data.asset_token_candidate_rows : [];
  return placementRows.map((placement, index) => {
    const component = componentRows[index % Math.max(componentRows.length, 1)];
    const data = dataRows[index % Math.max(dataRows.length, 1)];
    const asset = assetRows[index % Math.max(assetRows.length, 1)];
    return row({
      row_id: `visual_token_binding_candidate.${placement.shell_section_id}`,
      category: "visual_token_binding_candidate",
      label: `Visual token binding candidate for ${placement.shell_section_id}`,
      observed: placement.current_verdict === "pass" && component?.current_verdict === "pass" && data?.current_verdict === "pass" && asset?.asset_token_metadata_only === true,
      evidence_ref: asset?.row_id ?? data?.row_id ?? placement.row_id,
      implementation_placement_candidate_ref: placement.row_id,
      component_template_binding_candidate_ref: component?.row_id ?? null,
      read_only_data_binding_candidate_ref: data?.row_id ?? null,
      source_asset_token_candidate_ref: asset?.row_id ?? null,
      shell_section_id: placement.shell_section_id,
      css_scope_hook: asset?.css_scope_hook ?? `hermes-implementation-review-${toKebab(placement.shell_section_id)}`,
      design_token_hook: asset?.design_token_hook ?? `token.implementation_review.${placement.shell_section_id}`,
      component_class_hook: `hermes-ir-${toKebab(placement.shell_section_id)}`,
      icon_slot_hint: `icon.implementation_review.${placement.shell_section_id}.metadata_only`,
      asset_manifest_ref: asset?.asset_manifest_ref ?? `asset_manifest.implementation_review.${placement.shell_section_id}.metadata_only`,
      visual_token_metadata_only: true,
      css_write_allowed_now: false,
      asset_import_allowed_now: false,
      asset_build_allowed_now: false,
      file_write_allowed_now: false,
      build_allowed_now: false,
      dom_render_allowed_now: false,
      browser_run_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildNoAuthorityBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_authority.${flag}`,
    category: "no_authority_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_binding_candidate_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.placementRows)
    && allPass(context.componentRows)
    && allPass(context.dataRows)
    && allPass(context.tokenRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P43600 source is ready for P43601", context.sourceState.sourceReady],
    ["implementation_placement_visible", "Implementation placement candidate rows are visible", allPass(context.placementRows)],
    ["component_template_binding_visible", "Component/template binding candidate rows are visible", allPass(context.componentRows)],
    ["read_only_data_binding_visible", "Read-only data binding candidate rows are visible", allPass(context.dataRows)],
    ["visual_token_binding_visible", "Visual token binding candidate rows are visible", allPass(context.tokenRows)],
    ["no_authority_boundary_closed", "No-authority boundary remains closed", allPass(context.boundaryRows)],
    ["p44001_handoff_gate", "P44001 handoff opens only when static shell implementation binding candidate conditions pass", handoffReady],
    ["p44001_handoff_blocker_visible", "P44001 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p44000_checkpoint.${id}`,
    category: "p44000_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p44000_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p44000ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.placementRows)
    && allPass(context.componentRows)
    && allPass(context.dataRows)
    && allPass(context.tokenRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p44000_checkpoint.p44001_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.placementRows)
    && allPass(context.componentRows)
    && allPass(context.dataRows)
    && allPass(context.tokenRows)
    && allPass(context.boundaryRows);
  return {
    p44000_contract_ready: p44000ContractReady,
    ready_for_p44001_handoff: handoffReady,
    source_p43600_ready_for_p43601_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    implementation_placement_candidate_visible_now: allPass(context.placementRows),
    component_template_binding_candidate_visible_now: allPass(context.componentRows),
    read_only_data_binding_candidate_visible_now: allPass(context.dataRows),
    visual_token_binding_candidate_visible_now: allPass(context.tokenRows),
    no_authority_boundary_closed_now: allPass(context.boundaryRows),
    implementation_placement_candidate_count: context.placementRows.length,
    component_template_binding_candidate_count: context.componentRows.length,
    read_only_data_binding_candidate_count: context.dataRows.length,
    visual_token_binding_candidate_count: context.tokenRows.length,
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    final_automated_approval_allowed: false,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P43601-P44000 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P43601-P44000 Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Binding Candidate"), "Architecture doc missing P43601-P44000 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P43600 source state is not visible"),
    validationItem("implementation.placement", "implementation_binding_candidate", allPass(context.placementRows), "Implementation placement candidate rows are incomplete"),
    validationItem("component.template", "implementation_binding_candidate", allPass(context.componentRows), "Component/template binding candidate rows are incomplete"),
    validationItem("data.read_only", "implementation_binding_candidate", allPass(context.dataRows), "Read-only data binding candidate rows are incomplete"),
    validationItem("visual.token", "implementation_binding_candidate", allPass(context.tokenRows), "Visual token binding candidate rows are incomplete"),
    validationItem("boundary.no_authority", "authority", context.boundary.static_shell_implementation_binding_candidate_file_write_allowed_now === false && context.boundary.static_shell_implementation_binding_candidate_build_allowed_now === false && context.boundary.static_shell_implementation_binding_candidate_dom_render_allowed_now === false, "Implementation binding no-authority boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p44000_checkpoint.p44001_handoff_blocker_visible"), "P44000 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_binding_candidate.contract.v1",
    generated_at: generatedAt,
    source_p43600_required_or_rebuilt: true,
    implementation_placement_candidate_required: true,
    component_template_binding_candidate_required: true,
    read_only_data_binding_candidate_required: true,
    visual_token_binding_candidate_required: true,
    no_authority_boundary_required: true,
    p44001_handoff_is_not_file_create_write_apply_component_write_build_route_dom_browser_hydration_action_approval_closeout_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p44001_handoff
    ? READY_STATUS
    : validation.valid && boundary.p44000_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_binding_candidate_status: status,
    source_p43600_ready_for_p43601_handoff: boundary.source_p43600_ready_for_p43601_handoff,
    implementation_placement_candidate_count: boundary.implementation_placement_candidate_count,
    component_template_binding_candidate_count: boundary.component_template_binding_candidate_count,
    read_only_data_binding_candidate_count: boundary.read_only_data_binding_candidate_count,
    visual_token_binding_candidate_count: boundary.visual_token_binding_candidate_count,
    ready_for_p44001_handoff: validation.valid && boundary.ready_for_p44001_handoff,
    static_shell_implementation_binding_candidate_file_create_allowed_now: false,
    static_shell_implementation_binding_candidate_file_write_allowed_now: false,
    static_shell_implementation_binding_candidate_template_apply_allowed_now: false,
    static_shell_implementation_binding_candidate_template_write_allowed_now: false,
    static_shell_implementation_binding_candidate_component_write_allowed_now: false,
    static_shell_implementation_binding_candidate_css_write_allowed_now: false,
    static_shell_implementation_binding_candidate_asset_import_allowed_now: false,
    static_shell_implementation_binding_candidate_asset_build_allowed_now: false,
    static_shell_implementation_binding_candidate_build_allowed_now: false,
    static_shell_implementation_binding_candidate_route_execution_allowed_now: false,
    static_shell_implementation_binding_candidate_dom_render_allowed_now: false,
    static_shell_implementation_binding_candidate_browser_run_allowed_now: false,
    static_shell_implementation_binding_candidate_client_hydration_allowed_now: false,
    static_shell_implementation_binding_candidate_network_fetch_allowed_now: false,
    static_shell_implementation_binding_candidate_click_action_allowed_now: false,
    static_shell_implementation_binding_candidate_write_allowed_now: false,
    static_shell_implementation_binding_candidate_state_mutation_allowed_now: false,
    static_shell_implementation_binding_candidate_html_file_write_allowed_now: false,
    static_shell_implementation_binding_candidate_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Binding Candidate",
    "",
    `Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_binding_candidate_status}`,
    `Program: ${result.program_range}`,
    `P43600 ready for P43601 handoff: ${result.summary.source_p43600_ready_for_p43601_handoff}`,
    `Implementation placement rows: ${result.summary.implementation_placement_candidate_count}`,
    `Component/template rows: ${result.summary.component_template_binding_candidate_count}`,
    `Read-only data rows: ${result.summary.read_only_data_binding_candidate_count}`,
    `Visual token rows: ${result.summary.visual_token_binding_candidate_count}`,
    `Ready for P44001 handoff: ${result.summary.ready_for_p44001_handoff}`,
    `File write allowed: ${result.summary.static_shell_implementation_binding_candidate_file_write_allowed_now}`,
    `Build allowed: ${result.summary.static_shell_implementation_binding_candidate_build_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.implementation_placement_candidate_rows.map((item) => `<tr><td>${escapeHtml(item.shell_section_id)}</td><td>${escapeHtml(item.component_slot_hint)}</td><td>${escapeHtml(item.candidate_path_hint)}</td><td>${escapeHtml(item.file_write_allowed_now)}</td><td>${escapeHtml(item.dom_render_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Binding Candidate</title>
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
    <h1>Hermes Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Binding Candidate</h1>
    <p class="notice">This artifact defines implementation binding metadata only. It does not create files, write components, apply templates, import assets, build UI assets, start servers, register routes, render DOM, run browsers, hydrate client state, fetch network data, click actions, mutate state, approve, close out, export, publish, or claim production readiness.</p>
    <table><thead><tr><th>Section</th><th>Component Slot</th><th>Candidate Path</th><th>Write</th><th>Render</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP43600(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellFilePlanCandidate({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.work_os_static_bundle_review_ui_implementation_review_static_shell_file_plan_candidate", built);
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
  const defaults = DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_BINDING_CANDIDATE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_work_os_static_bundle_review_ui_implementation_review_static_shell_file_plan_candidate_path: path.resolve(repoRoot, options.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellFilePlanCandidatePath ?? defaults.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellFilePlanCandidatePath),
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
      args.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellFilePlanCandidatePath = argv[++index];
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
  console.log(`Usage: node scripts/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-binding-candidate.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P43601-P44000 Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Binding Candidate.
`);
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

function toKebab(value) {
  return String(value).replaceAll("_", "-").replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
}

function toPascal(value) {
  return String(value)
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
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
