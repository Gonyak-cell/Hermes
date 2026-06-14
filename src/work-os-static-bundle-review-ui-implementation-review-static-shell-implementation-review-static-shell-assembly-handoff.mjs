import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P47600_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlan,
} from "./work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-assembly-plan.mjs";

export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_ASSEMBLY_HANDOFF_OUT_DIR = "artifacts/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-assembly-handoff/latest";
export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_ASSEMBLY_HANDOFF_INPUTS = {
  schemaPath: "schemas/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-assembly-handoff.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p47601-p48000.md",
  architectureDocPath: "docs/architecture.md",
  sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlanPath: "artifacts/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-assembly-plan/latest/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-assembly-plan.json",
};

const COMMAND_NAME = "platform:work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-assembly-handoff";
const SCHEMA_VERSION = "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-assembly-handoff.v1";
const CAPABILITY_ID = "platform.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff";
const PROGRAM_RANGE = "P47601-P48000";
const SOURCE_PROGRAM_RANGE = "P47201-P47600";
const READY_STATUS = "ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff";
const BLOCK_PENDING_STATUS = "valid_block_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_pending";
const BLOCKED_STATUS = "blocked_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff";

const PHASE_SPECS = [
  ["P47601-P47640", "P47600 Source Binding", "p47600_source_binding_rows"],
  ["P47641-P47720", "Assembly Handoff Packet Contract", "assembly_handoff_packet_rows"],
  ["P47721-P47800", "Template Target Map", "template_target_map_rows"],
  ["P47801-P47880", "State And Copy Slot Binding Matrix", "state_copy_slot_binding_matrix_rows"],
  ["P47881-P47940", "Static Asset Hook Guard", "static_asset_hook_guard_rows"],
  ["P47941-P47980", "No-Apply/No-Build Boundary", "no_apply_no_build_boundary_rows"],
  ["P47981-P48000", "P48000 Clean Checkpoint", "p48000_clean_checkpoint_rows"],
];

export const STATIC_SHELL_ASSEMBLY_HANDOFF_FALSE_FLAGS = [
  "static_shell_assembly_handoff_apply_allowed_now",
  "static_shell_assembly_handoff_file_write_allowed_now",
  "static_shell_assembly_handoff_template_write_allowed_now",
  "static_shell_assembly_handoff_css_write_allowed_now",
  "static_shell_assembly_handoff_asset_import_allowed_now",
  "static_shell_assembly_handoff_asset_build_allowed_now",
  "static_shell_assembly_handoff_build_allowed_now",
  "static_shell_assembly_handoff_server_start_allowed_now",
  "static_shell_assembly_handoff_route_registration_allowed_now",
  "static_shell_assembly_handoff_route_mount_allowed_now",
  "static_shell_assembly_handoff_route_execution_allowed_now",
  "static_shell_assembly_handoff_dom_render_allowed_now",
  "static_shell_assembly_handoff_browser_run_allowed_now",
  "static_shell_assembly_handoff_browser_smoke_allowed_now",
  "static_shell_assembly_handoff_client_hydration_allowed_now",
  "static_shell_assembly_handoff_live_refresh_allowed_now",
  "static_shell_assembly_handoff_network_fetch_allowed_now",
  "static_shell_assembly_handoff_click_action_allowed_now",
  "static_shell_assembly_handoff_keyboard_action_allowed_now",
  "static_shell_assembly_handoff_command_button_enabled_now",
  "static_shell_assembly_handoff_approve_button_enabled_now",
  "static_shell_assembly_handoff_closeout_button_enabled_now",
  "static_shell_assembly_handoff_state_mutation_allowed_now",
  "static_shell_assembly_handoff_write_allowed_now",
  "static_shell_assembly_handoff_snapshot_capture_allowed_now",
  "static_shell_assembly_handoff_html_file_write_allowed_now",
  "static_shell_assembly_handoff_raw_payload_exposure_allowed_now",
  "static_shell_assembly_handoff_secret_exposure_allowed_now",
  "static_shell_assembly_handoff_export_allowed_now",
  "static_shell_assembly_handoff_publish_allowed_now",
  "static_shell_assembly_handoff_final_approval_allowed_now",
  "static_shell_assembly_handoff_production_pass_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...STATIC_SHELL_ASSEMBLY_HANDOFF_FALSE_FLAGS, ...P47600_FALSE_FLAGS])];

export async function runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff(options = {}) {
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Assembly Handoff failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff(result, result.output_dir);
  return result;
}

export async function buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_ASSEMBLY_HANDOFF_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlan")
    ? normalizeInlineJsonSource("inline.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_plan", options.workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlan)
    : await readJsonOrBuildP47600(inputs.source_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_plan_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const handoffRows = buildAssemblyHandoffPacketRows({ source, generatedAt });
  const targetRows = buildTemplateTargetMapRows({ source, handoffRows, generatedAt });
  const bindingRows = buildStateCopySlotBindingMatrixRows({ source, handoffRows, targetRows, generatedAt });
  const assetRows = buildStaticAssetHookGuardRows({ handoffRows, targetRows, bindingRows, generatedAt });
  const boundaryRows = buildNoApplyNoBuildBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, handoffRows, targetRows, bindingRows, assetRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, handoffRows, targetRows, bindingRows, assetRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, handoffRows, targetRows, bindingRows, assetRows, boundaryRows, checkpointRows, boundary });
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
      work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_plan_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_plan_summary: source.data?.summary ?? null,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_contract: buildContract(generatedAt),
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_phase_rows: phaseRows,
    p47600_source_binding_rows: sourceRows,
    assembly_handoff_packet_rows: handoffRows,
    template_target_map_rows: targetRows,
    state_copy_slot_binding_matrix_rows: bindingRows,
    static_asset_hook_guard_rows: assetRows,
    no_apply_no_build_boundary_rows: boundaryRows,
    p48000_clean_checkpoint_rows: checkpointRows,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_boundary: boundary,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-assembly-handoff.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p47600-source-binding-rows.json"), collectionEnvelope("p47600-source-binding-rows.v1", "p47600_source_binding_rows", result.p47600_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "assembly-handoff-packet-rows.json"), collectionEnvelope("assembly-handoff-packet-rows.v1", "assembly_handoff_packet_rows", result.assembly_handoff_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "template-target-map-rows.json"), collectionEnvelope("template-target-map-rows.v1", "template_target_map_rows", result.template_target_map_rows, result.generated_at));
  await writeJson(path.join(outDir, "state-copy-slot-binding-matrix-rows.json"), collectionEnvelope("state-copy-slot-binding-matrix-rows.v1", "state_copy_slot_binding_matrix_rows", result.state_copy_slot_binding_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "static-asset-hook-guard-rows.json"), collectionEnvelope("static-asset-hook-guard-rows.v1", "static_asset_hook_guard_rows", result.static_asset_hook_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-apply-no-build-boundary-rows.json"), collectionEnvelope("no-apply-no-build-boundary-rows.v1", "no_apply_no_build_boundary_rows", result.no_apply_no_build_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p48000-clean-checkpoint-rows.json"), collectionEnvelope("p48000-clean-checkpoint-rows.v1", "p48000_clean_checkpoint_rows", result.p48000_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-assembly-handoff-boundary.json"), result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoffCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellAssemblyHandoff(args);
  console.log(`Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Assembly Handoff ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P47600 ready for P47601 handoff: ${result.summary.source_p47600_ready_for_p47601_handoff}`);
  console.log(`Handoff packet rows: ${result.summary.assembly_handoff_packet_count}`);
  console.log(`Template target rows: ${result.summary.template_target_map_count}`);
  console.log(`State/copy binding rows: ${result.summary.state_copy_slot_binding_matrix_count}`);
  console.log(`Static asset hook rows: ${result.summary.static_asset_hook_guard_count}`);
  console.log(`Ready for P48001 handoff: ${result.summary.ready_for_p48001_handoff}`);
  console.log(`Apply allowed: ${result.summary.static_shell_assembly_handoff_apply_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_plan_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p47601_handoff === true,
    status: summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_plan_status ?? "missing",
    p47600ContractReady: boundary.p47600_contract_ready === true,
    assemblyPlanVisible: boundary.static_shell_assembly_plan_contract_visible_now === true,
    templateCompositionVisible: boundary.template_composition_manifest_visible_now === true,
    readOnlyStateSlotVisible: boundary.read_only_state_slot_map_visible_now === true,
    accessibilityBlockedCopyVisible: boundary.accessibility_blocked_copy_guard_visible_now === true,
    noBuildNoRenderClosed: boundary.no_build_no_render_boundary_closed_now === true,
    boundaryClosed: P47600_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p47601-p48000.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P47600 implementation review static shell assembly plan source is available", sourceState.available],
    ["program_range", "P47600 source program range is P47201-P47600", sourceState.programRangeOk],
    ["validation_valid", "P47600 source validation is valid", sourceState.validationValid],
    ["p47601_handoff_open", "P47600 source opened P47601 handoff", sourceState.sourceReady],
    ["p47600_contract_ready", "P47600 source contract is ready", sourceState.p47600ContractReady],
    ["assembly_plan_visible", "P47600 static shell assembly plan rows are visible", sourceState.assemblyPlanVisible],
    ["template_composition_visible", "P47600 template composition rows are visible", sourceState.templateCompositionVisible],
    ["state_slot_visible", "P47600 read-only state slot rows are visible", sourceState.readOnlyStateSlotVisible],
    ["blocked_copy_guard_visible", "P47600 accessibility and blocked copy guard rows are visible", sourceState.accessibilityBlockedCopyVisible],
    ["no_build_no_render_closed", "P47600 no-build/no-render boundary is closed", sourceState.noBuildNoRenderClosed],
    ["commit_ref_present", "Current commit ref is present for static shell assembly handoff", Boolean(commitRef)],
    ["source_blocker_visible", "P47600 source blocker is visible when assembly handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p47600_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildAssemblyHandoffPacketRows({ source, generatedAt }) {
  const assemblyRows = Array.isArray(source.data?.static_shell_assembly_plan_contract_rows) ? source.data.static_shell_assembly_plan_contract_rows : [];
  return assemblyRows.map((assembly, index) => row({
    row_id: `assembly_handoff_packet.${assembly.shell_section_id ?? index + 1}`,
    category: "assembly_handoff_packet",
    label: `Assembly handoff packet for ${assembly.shell_section_id ?? `section_${index + 1}`}`,
    observed: assembly.current_verdict === "pass" && assembly.assembly_metadata_only === true,
    evidence_ref: assembly.row_id,
    handoff_packet_id: `handoff_packet.implementation_review.${assembly.shell_section_id ?? index + 1}`,
    assembly_plan_ref: assembly.row_id,
    shell_section_id: assembly.shell_section_id ?? `section_${index + 1}`,
    safe_dom_anchor: assembly.safe_dom_anchor,
    handoff_metadata_only: true,
    apply_allowed_now: false,
    file_write_allowed_now: false,
    template_write_allowed_now: false,
    css_write_allowed_now: false,
    build_allowed_now: false,
    dom_render_allowed_now: false,
    client_hydration_allowed_now: false,
    click_action_allowed_now: false,
    write_allowed_now: false,
    state_mutation_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildTemplateTargetMapRows({ source, handoffRows, generatedAt }) {
  const compositionRows = Array.isArray(source.data?.template_composition_manifest_rows) ? source.data.template_composition_manifest_rows : [];
  return handoffRows.map((handoff, index) => {
    const composition = compositionRows[index % Math.max(compositionRows.length, 1)];
    return row({
      row_id: `template_target_map.${handoff.shell_section_id}`,
      category: "template_target_map",
      label: `Template target map for ${handoff.shell_section_id}`,
      observed: handoff.current_verdict === "pass" && Boolean(composition) && composition.current_verdict === "pass",
      evidence_ref: composition?.row_id ?? handoff.row_id,
      handoff_packet_ref: handoff.row_id,
      source_composition_ref: composition?.row_id ?? null,
      shell_section_id: handoff.shell_section_id,
      target_path_hint: `implementation-review/static-shell/${handoff.shell_section_id}.fragment.html`,
      data_attribute_contract: `data-hermes-section=${handoff.shell_section_id}`,
      safe_dom_anchor: handoff.safe_dom_anchor,
      target_metadata_only: true,
      apply_allowed_now: false,
      file_write_allowed_now: false,
      template_write_allowed_now: false,
      html_file_write_allowed_now: false,
      build_allowed_now: false,
      dom_render_allowed_now: false,
      write_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildStateCopySlotBindingMatrixRows({ source, handoffRows, targetRows, generatedAt }) {
  const stateRows = Array.isArray(source.data?.read_only_state_slot_map_rows) ? source.data.read_only_state_slot_map_rows : [];
  const copyRows = Array.isArray(source.data?.accessibility_blocked_copy_guard_rows) ? source.data.accessibility_blocked_copy_guard_rows : [];
  return handoffRows.map((handoff, index) => {
    const target = targetRows[index % Math.max(targetRows.length, 1)];
    const state = stateRows[index % Math.max(stateRows.length, 1)];
    const copy = copyRows[index % Math.max(copyRows.length, 1)];
    return row({
      row_id: `state_copy_slot_binding_matrix.${handoff.shell_section_id}`,
      category: "state_copy_slot_binding_matrix",
      label: `State and copy slot binding matrix for ${handoff.shell_section_id}`,
      observed: handoff.current_verdict === "pass" && Boolean(target) && state?.read_only === true && copy?.advisory_only === true,
      evidence_ref: state?.row_id ?? copy?.row_id ?? handoff.row_id,
      handoff_packet_ref: handoff.row_id,
      template_target_ref: target?.row_id ?? null,
      state_slot_ref: state?.row_id ?? null,
      copy_guard_ref: copy?.row_id ?? null,
      shell_section_id: handoff.shell_section_id,
      aria_label_ref: copy?.aria_label_ref ?? null,
      blocker_copy_ref: copy?.blocker_copy_ref ?? null,
      no_action_copy_ref: copy?.no_action_copy_ref ?? null,
      allowed_methods: ["GET", "HEAD"],
      read_only: true,
      advisory_only: true,
      raw_payload_included: false,
      client_hydration_allowed_now: false,
      network_fetch_allowed_now: false,
      click_action_allowed_now: false,
      keyboard_action_allowed_now: false,
      state_mutation_allowed_now: false,
      write_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildStaticAssetHookGuardRows({ handoffRows, targetRows, bindingRows, generatedAt }) {
  return handoffRows.map((handoff, index) => {
    const target = targetRows[index % Math.max(targetRows.length, 1)];
    const binding = bindingRows[index % Math.max(bindingRows.length, 1)];
    return row({
      row_id: `static_asset_hook_guard.${handoff.shell_section_id}`,
      category: "static_asset_hook_guard",
      label: `Static asset and design-token hook guard for ${handoff.shell_section_id}`,
      observed: handoff.current_verdict === "pass" && target?.current_verdict === "pass" && binding?.current_verdict === "pass",
      evidence_ref: binding?.row_id ?? target?.row_id ?? handoff.row_id,
      handoff_packet_ref: handoff.row_id,
      template_target_ref: target?.row_id ?? null,
      binding_matrix_ref: binding?.row_id ?? null,
      css_scope_hook: `hermes-implementation-review-${handoff.shell_section_id.replaceAll("_", "-")}`,
      design_token_hook: `token.implementation_review.${handoff.shell_section_id}`,
      asset_manifest_ref: `asset_manifest.implementation_review.${handoff.shell_section_id}.metadata_only`,
      static_asset_metadata_only: true,
      asset_import_allowed_now: false,
      asset_build_allowed_now: false,
      css_write_allowed_now: false,
      file_write_allowed_now: false,
      build_allowed_now: false,
      dom_render_allowed_now: false,
      browser_run_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildNoApplyNoBuildBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_apply_no_build.${flag}`,
    category: "no_apply_no_build_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.handoffRows)
    && allPass(context.targetRows)
    && allPass(context.bindingRows)
    && allPass(context.assetRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P47600 source is ready for P47601", context.sourceState.sourceReady],
    ["handoff_packet_visible", "Assembly handoff packet rows are visible", allPass(context.handoffRows)],
    ["template_target_visible", "Template target map rows are visible", allPass(context.targetRows)],
    ["state_copy_binding_visible", "State/copy slot binding matrix rows are visible", allPass(context.bindingRows)],
    ["static_asset_hook_visible", "Static asset hook guard rows are visible", allPass(context.assetRows)],
    ["no_apply_no_build_boundary_closed", "No-apply/no-build boundary remains closed", allPass(context.boundaryRows)],
    ["p48001_handoff_gate", "P48001 handoff opens only when static shell assembly handoff conditions pass", handoffReady],
    ["p48001_handoff_blocker_visible", "P48001 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p48000_checkpoint.${id}`,
    category: "p48000_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p48000_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p48000ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.handoffRows)
    && allPass(context.targetRows)
    && allPass(context.bindingRows)
    && allPass(context.assetRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p48000_checkpoint.p48001_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.handoffRows)
    && allPass(context.targetRows)
    && allPass(context.bindingRows)
    && allPass(context.assetRows)
    && allPass(context.boundaryRows);
  return {
    p48000_contract_ready: p48000ContractReady,
    ready_for_p48001_handoff: handoffReady,
    source_p47600_ready_for_p47601_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    assembly_handoff_packet_visible_now: allPass(context.handoffRows),
    template_target_map_visible_now: allPass(context.targetRows),
    state_copy_slot_binding_matrix_visible_now: allPass(context.bindingRows),
    static_asset_hook_guard_visible_now: allPass(context.assetRows),
    no_apply_no_build_boundary_closed_now: allPass(context.boundaryRows),
    assembly_handoff_packet_count: context.handoffRows.length,
    template_target_map_count: context.targetRows.length,
    state_copy_slot_binding_matrix_count: context.bindingRows.length,
    static_asset_hook_guard_count: context.assetRows.length,
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
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P47601-P48000 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P47601-P48000 Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Assembly Handoff"), "Architecture doc missing P47601-P48000 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P47600 source state is not visible"),
    validationItem("handoff.packet", "static_shell_assembly_handoff", allPass(context.handoffRows), "Assembly handoff packet rows are incomplete"),
    validationItem("template.target", "static_shell_assembly_handoff", allPass(context.targetRows), "Template target map rows are incomplete"),
    validationItem("state.copy.binding", "static_shell_assembly_handoff", allPass(context.bindingRows), "State/copy slot binding matrix rows are incomplete"),
    validationItem("asset.guard", "static_shell_assembly_handoff", allPass(context.assetRows), "Static asset hook guard rows are incomplete"),
    validationItem("boundary.no_apply_no_build", "authority", context.boundary.static_shell_assembly_handoff_apply_allowed_now === false && context.boundary.static_shell_assembly_handoff_build_allowed_now === false && context.boundary.static_shell_assembly_handoff_file_write_allowed_now === false, "Static shell assembly handoff no-apply/no-build boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p48000_checkpoint.p48001_handoff_blocker_visible"), "P48000 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff.contract.v1",
    generated_at: generatedAt,
    source_p47600_required_or_rebuilt: true,
    assembly_handoff_packet_required: true,
    template_target_map_required: true,
    state_copy_slot_binding_matrix_required: true,
    static_asset_hook_guard_required: true,
    no_apply_no_build_boundary_required: true,
    p48001_handoff_is_not_apply_build_route_dom_browser_action_write_approval_closeout_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p48001_handoff
    ? READY_STATUS
    : validation.valid && boundary.p48000_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_status: status,
    source_p47600_ready_for_p47601_handoff: boundary.source_p47600_ready_for_p47601_handoff,
    assembly_handoff_packet_count: boundary.assembly_handoff_packet_count,
    template_target_map_count: boundary.template_target_map_count,
    state_copy_slot_binding_matrix_count: boundary.state_copy_slot_binding_matrix_count,
    static_asset_hook_guard_count: boundary.static_asset_hook_guard_count,
    ready_for_p48001_handoff: validation.valid && boundary.ready_for_p48001_handoff,
    static_shell_assembly_handoff_apply_allowed_now: false,
    static_shell_assembly_handoff_file_write_allowed_now: false,
    static_shell_assembly_handoff_template_write_allowed_now: false,
    static_shell_assembly_handoff_css_write_allowed_now: false,
    static_shell_assembly_handoff_asset_import_allowed_now: false,
    static_shell_assembly_handoff_asset_build_allowed_now: false,
    static_shell_assembly_handoff_build_allowed_now: false,
    static_shell_assembly_handoff_route_execution_allowed_now: false,
    static_shell_assembly_handoff_dom_render_allowed_now: false,
    static_shell_assembly_handoff_browser_run_allowed_now: false,
    static_shell_assembly_handoff_client_hydration_allowed_now: false,
    static_shell_assembly_handoff_network_fetch_allowed_now: false,
    static_shell_assembly_handoff_click_action_allowed_now: false,
    static_shell_assembly_handoff_write_allowed_now: false,
    static_shell_assembly_handoff_state_mutation_allowed_now: false,
    static_shell_assembly_handoff_html_file_write_allowed_now: false,
    static_shell_assembly_handoff_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Assembly Handoff",
    "",
    `Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_handoff_status}`,
    `Program: ${result.program_range}`,
    `P47600 ready for P47601 handoff: ${result.summary.source_p47600_ready_for_p47601_handoff}`,
    `Handoff packet rows: ${result.summary.assembly_handoff_packet_count}`,
    `Template target rows: ${result.summary.template_target_map_count}`,
    `State/copy binding rows: ${result.summary.state_copy_slot_binding_matrix_count}`,
    `Static asset hook rows: ${result.summary.static_asset_hook_guard_count}`,
    `Ready for P48001 handoff: ${result.summary.ready_for_p48001_handoff}`,
    `Apply allowed: ${result.summary.static_shell_assembly_handoff_apply_allowed_now}`,
    `Build allowed: ${result.summary.static_shell_assembly_handoff_build_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.assembly_handoff_packet_rows.map((item) => `<tr><td>${escapeHtml(item.shell_section_id)}</td><td>${escapeHtml(item.safe_dom_anchor)}</td><td>${escapeHtml(item.apply_allowed_now)}</td><td>${escapeHtml(item.build_allowed_now)}</td><td>${escapeHtml(item.file_write_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Assembly Handoff</title>
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
    <h1>Hermes Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Assembly Handoff</h1>
    <p class="notice">This artifact defines handoff metadata only. It does not apply templates, write files, import assets, build UI assets, start servers, register routes, render DOM, run browsers, hydrate client state, click actions, mutate state, approve, close out, export, publish, or claim production readiness.</p>
    <table><thead><tr><th>Section</th><th>Safe DOM Anchor</th><th>Apply</th><th>Build</th><th>File Write</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP47600(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlan({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_plan", built);
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
  const defaults = DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_ASSEMBLY_HANDOFF_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_assembly_plan_path: path.resolve(repoRoot, options.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlanPath ?? defaults.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlanPath),
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
      args.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellAssemblyPlanPath = argv[++index];
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
  console.log(`Usage: node scripts/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-assembly-handoff.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P47601-P48000 Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Assembly Handoff.
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}
