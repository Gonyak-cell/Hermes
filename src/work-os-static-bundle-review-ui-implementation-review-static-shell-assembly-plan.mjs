import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P42400_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellCandidate,
} from "./work-os-static-bundle-review-ui-implementation-review-static-shell-candidate.mjs";

export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_ASSEMBLY_PLAN_OUT_DIR = "artifacts/work-os-static-bundle-review-ui-implementation-review-static-shell-assembly-plan/latest";
export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_ASSEMBLY_PLAN_INPUTS = {
  schemaPath: "schemas/work-os-static-bundle-review-ui-implementation-review-static-shell-assembly-plan.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p42401-p42800.md",
  architectureDocPath: "docs/architecture.md",
  sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellCandidatePath: "artifacts/work-os-static-bundle-review-ui-implementation-review-static-shell-candidate/latest/work-os-static-bundle-review-ui-implementation-review-static-shell-candidate.json",
};

const COMMAND_NAME = "platform:work-os-static-bundle-review-ui-implementation-review-static-shell-assembly-plan";
const SCHEMA_VERSION = "work-os-static-bundle-review-ui-implementation-review-static-shell-assembly-plan.v1";
const CAPABILITY_ID = "platform.work_os_static_bundle_review_ui_implementation_review_static_shell_assembly_plan";
const PROGRAM_RANGE = "P42401-P42800";
const SOURCE_PROGRAM_RANGE = "P42001-P42400";
const READY_STATUS = "ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_assembly_plan";
const BLOCK_PENDING_STATUS = "valid_block_work_os_static_bundle_review_ui_implementation_review_static_shell_assembly_plan_pending";
const BLOCKED_STATUS = "blocked_work_os_static_bundle_review_ui_implementation_review_static_shell_assembly_plan";

const PHASE_SPECS = [
  ["P42401-P42440", "P42400 Source Binding", "p42400_source_binding_rows"],
  ["P42441-P42520", "Static Shell Assembly Plan Contract", "static_shell_assembly_plan_contract_rows"],
  ["P42521-P42600", "Template Composition Manifest", "template_composition_manifest_rows"],
  ["P42601-P42680", "Read-Only State Slot Map", "read_only_state_slot_map_rows"],
  ["P42681-P42740", "Accessibility And Blocked Copy Guard", "accessibility_blocked_copy_guard_rows"],
  ["P42741-P42780", "No-Build/No-Render Boundary", "no_build_no_render_boundary_rows"],
  ["P42781-P42800", "P42800 Clean Checkpoint", "p42800_clean_checkpoint_rows"],
];

const ASSEMBLY_SECTIONS = [
  ["review_summary_header", "Implementation review summary header assembly plan"],
  ["finding_seed_index", "Finding seed index assembly plan"],
  ["screen_package_detail_drawer", "Screen package detail drawer assembly plan"],
  ["route_contract_stack", "Route contract stack assembly plan"],
  ["review_status_strip", "Review status strip assembly plan"],
  ["blocker_notice_band", "Blocker notice band assembly plan"],
  ["disabled_action_sidebar", "Disabled action sidebar assembly plan"],
  ["no_receipt_accept_footer", "No receipt accept footer assembly plan"],
];

export const STATIC_SHELL_ASSEMBLY_PLAN_FALSE_FLAGS = [
  "static_shell_assembly_plan_build_allowed_now",
  "static_shell_assembly_plan_server_start_allowed_now",
  "static_shell_assembly_plan_route_registration_allowed_now",
  "static_shell_assembly_plan_route_mount_allowed_now",
  "static_shell_assembly_plan_route_execution_allowed_now",
  "static_shell_assembly_plan_dom_render_allowed_now",
  "static_shell_assembly_plan_browser_run_allowed_now",
  "static_shell_assembly_plan_browser_smoke_allowed_now",
  "static_shell_assembly_plan_live_refresh_allowed_now",
  "static_shell_assembly_plan_network_fetch_allowed_now",
  "static_shell_assembly_plan_client_hydration_allowed_now",
  "static_shell_assembly_plan_click_action_allowed_now",
  "static_shell_assembly_plan_keyboard_action_allowed_now",
  "static_shell_assembly_plan_write_allowed_now",
  "static_shell_assembly_plan_state_mutation_allowed_now",
  "static_shell_assembly_plan_snapshot_capture_allowed_now",
  "static_shell_assembly_plan_html_file_write_allowed_now",
  "static_shell_assembly_plan_raw_payload_exposure_allowed_now",
  "static_shell_assembly_plan_secret_exposure_allowed_now",
  "static_shell_assembly_plan_command_button_enabled_now",
  "static_shell_assembly_plan_approve_button_enabled_now",
  "static_shell_assembly_plan_closeout_button_enabled_now",
  "static_shell_assembly_plan_export_allowed_now",
  "static_shell_assembly_plan_publish_allowed_now",
  "static_shell_assembly_plan_final_approval_allowed_now",
  "static_shell_assembly_plan_production_pass_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...STATIC_SHELL_ASSEMBLY_PLAN_FALSE_FLAGS, ...P42400_FALSE_FLAGS])];

export async function runWorkOsStaticBundleReviewUiImplementationReviewStaticShellAssemblyPlan(options = {}) {
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellAssemblyPlan(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS Static Bundle Review UI Implementation Review Static Shell Assembly Plan failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeWorkOsStaticBundleReviewUiImplementationReviewStaticShellAssemblyPlan(result, result.output_dir);
  return result;
}

export async function buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellAssemblyPlan(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_ASSEMBLY_PLAN_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "workOsStaticBundleReviewUiImplementationReviewStaticShellCandidate")
    ? normalizeInlineJsonSource("inline.work_os_static_bundle_review_ui_implementation_review_static_shell_candidate", options.workOsStaticBundleReviewUiImplementationReviewStaticShellCandidate)
    : await readJsonOrBuildP42400(inputs.source_work_os_static_bundle_review_ui_implementation_review_static_shell_candidate_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const assemblyRows = buildStaticShellAssemblyPlanContractRows({ source, generatedAt });
  const compositionRows = buildTemplateCompositionManifestRows({ source, assemblyRows, generatedAt });
  const stateRows = buildReadOnlyStateSlotMapRows({ source, assemblyRows, compositionRows, generatedAt });
  const guardRows = buildAccessibilityBlockedCopyGuardRows({ source, assemblyRows, compositionRows, stateRows, generatedAt });
  const boundaryRows = buildNoBuildNoRenderBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, assemblyRows, compositionRows, stateRows, guardRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, assemblyRows, compositionRows, stateRows, guardRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, assemblyRows, compositionRows, stateRows, guardRows, boundaryRows, checkpointRows, boundary });
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
      work_os_static_bundle_review_ui_implementation_review_static_shell_candidate_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_work_os_static_bundle_review_ui_implementation_review_static_shell_candidate_summary: source.data?.summary ?? null,
    work_os_static_bundle_review_ui_implementation_review_static_shell_assembly_plan_contract: buildContract(generatedAt),
    work_os_static_bundle_review_ui_implementation_review_static_shell_assembly_plan_phase_rows: phaseRows,
    p42400_source_binding_rows: sourceRows,
    static_shell_assembly_plan_contract_rows: assemblyRows,
    template_composition_manifest_rows: compositionRows,
    read_only_state_slot_map_rows: stateRows,
    accessibility_blocked_copy_guard_rows: guardRows,
    no_build_no_render_boundary_rows: boundaryRows,
    p42800_clean_checkpoint_rows: checkpointRows,
    work_os_static_bundle_review_ui_implementation_review_static_shell_assembly_plan_boundary: boundary,
    work_os_static_bundle_review_ui_implementation_review_static_shell_assembly_plan_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_static_bundle_review_ui_implementation_review_static_shell_assembly_plan")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.work_os_static_bundle_review_ui_implementation_review_static_shell_assembly_plan_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.work_os_static_bundle_review_ui_implementation_review_static_shell_assembly_plan_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeWorkOsStaticBundleReviewUiImplementationReviewStaticShellAssemblyPlan(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-assembly-plan.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p42400-source-binding-rows.json"), collectionEnvelope("p42400-source-binding-rows.v1", "p42400_source_binding_rows", result.p42400_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "static-shell-assembly-plan-contract-rows.json"), collectionEnvelope("static-shell-assembly-plan-contract-rows.v1", "static_shell_assembly_plan_contract_rows", result.static_shell_assembly_plan_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "template-composition-manifest-rows.json"), collectionEnvelope("template-composition-manifest-rows.v1", "template_composition_manifest_rows", result.template_composition_manifest_rows, result.generated_at));
  await writeJson(path.join(outDir, "read-only-state-slot-map-rows.json"), collectionEnvelope("read-only-state-slot-map-rows.v1", "read_only_state_slot_map_rows", result.read_only_state_slot_map_rows, result.generated_at));
  await writeJson(path.join(outDir, "accessibility-blocked-copy-guard-rows.json"), collectionEnvelope("accessibility-blocked-copy-guard-rows.v1", "accessibility_blocked_copy_guard_rows", result.accessibility_blocked_copy_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-build-no-render-boundary-rows.json"), collectionEnvelope("no-build-no-render-boundary-rows.v1", "no_build_no_render_boundary_rows", result.no_build_no_render_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p42800-clean-checkpoint-rows.json"), collectionEnvelope("p42800-clean-checkpoint-rows.v1", "p42800_clean_checkpoint_rows", result.p42800_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-assembly-plan-boundary.json"), result.work_os_static_bundle_review_ui_implementation_review_static_shell_assembly_plan_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runWorkOsStaticBundleReviewUiImplementationReviewStaticShellAssemblyPlanCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runWorkOsStaticBundleReviewUiImplementationReviewStaticShellAssemblyPlan(args);
  console.log(`Work OS Static Bundle Review UI Implementation Review Static Shell Assembly Plan ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_assembly_plan_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P42400 ready for P42401 handoff: ${result.summary.source_p42400_ready_for_p42401_handoff}`);
  console.log(`Assembly rows: ${result.summary.static_shell_assembly_plan_contract_count}`);
  console.log(`Composition rows: ${result.summary.template_composition_manifest_count}`);
  console.log(`State slot rows: ${result.summary.read_only_state_slot_map_count}`);
  console.log(`Ready for P42801 handoff: ${result.summary.ready_for_p42801_handoff}`);
  console.log(`Build allowed: ${result.summary.static_shell_assembly_plan_build_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.work_os_static_bundle_review_ui_implementation_review_static_shell_candidate_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p42401_handoff === true,
    status: summary.work_os_static_bundle_review_ui_implementation_review_static_shell_candidate_status ?? "missing",
    p42400ContractReady: boundary.p42400_contract_ready === true,
    candidateVisible: boundary.static_shell_candidate_contract_visible_now === true,
    templateManifestVisible: boundary.section_template_manifest_visible_now === true,
    hydrationStubVisible: boundary.fixture_hydration_stub_map_visible_now === true,
    blockedCopyVisible: boundary.blocked_control_copy_binding_visible_now === true,
    noServeNoDomClosed: boundary.no_serve_no_dom_boundary_closed_now === true,
    boundaryClosed: P42400_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p42401-p42800.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P42400 implementation review static shell candidate source is available", sourceState.available],
    ["program_range", "P42400 source program range is P42001-P42400", sourceState.programRangeOk],
    ["validation_valid", "P42400 source validation is valid", sourceState.validationValid],
    ["p42401_handoff_open", "P42400 source opened P42401 handoff", sourceState.sourceReady],
    ["p42400_contract_ready", "P42400 source contract is ready", sourceState.p42400ContractReady],
    ["candidate_visible", "P42400 static shell candidate rows are visible", sourceState.candidateVisible],
    ["template_manifest_visible", "P42400 section template manifest rows are visible", sourceState.templateManifestVisible],
    ["hydration_stub_visible", "P42400 fixture hydration stub rows are visible", sourceState.hydrationStubVisible],
    ["blocked_copy_visible", "P42400 blocked control copy rows are visible", sourceState.blockedCopyVisible],
    ["no_serve_no_dom_closed", "P42400 no-serve/no-DOM boundary is closed", sourceState.noServeNoDomClosed],
    ["commit_ref_present", "Current commit ref is present for static shell assembly plan", Boolean(commitRef)],
    ["source_blocker_visible", "P42400 source blocker is visible when assembly plan is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p42400_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildStaticShellAssemblyPlanContractRows({ source, generatedAt }) {
  const candidateRows = Array.isArray(source.data?.static_shell_candidate_contract_rows) ? source.data.static_shell_candidate_contract_rows : [];
  return ASSEMBLY_SECTIONS.map(([sectionId, label], index) => {
    const candidate = candidateRows[index % Math.max(candidateRows.length, 1)];
    return row({
      row_id: `static_shell_assembly_plan_contract.${sectionId}`,
      category: "static_shell_assembly_plan_contract",
      label,
      observed: Boolean(candidate) && candidate.current_verdict === "pass" && candidate.static_metadata_only === true,
      evidence_ref: candidate?.row_id ?? "static_shell_candidate_contract_rows",
      assembly_plan_id: `assembly_plan.implementation_review.${sectionId}`,
      shell_section_id: sectionId,
      source_candidate_ref: candidate?.row_id ?? null,
      safe_dom_anchor: candidate?.safe_dom_anchor ?? `#hermes-${sectionId.replaceAll("_", "-")}`,
      assembly_metadata_only: true,
      build_allowed_now: false,
      server_start_allowed_now: false,
      route_registration_allowed_now: false,
      route_mount_allowed_now: false,
      route_execution_allowed_now: false,
      dom_render_allowed_now: false,
      browser_run_allowed_now: false,
      browser_smoke_allowed_now: false,
      client_hydration_allowed_now: false,
      click_action_allowed_now: false,
      keyboard_action_allowed_now: false,
      write_allowed_now: false,
      state_mutation_allowed_now: false,
      html_file_write_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildTemplateCompositionManifestRows({ source, assemblyRows, generatedAt }) {
  const templateRows = Array.isArray(source.data?.section_template_manifest_rows) ? source.data.section_template_manifest_rows : [];
  return assemblyRows.map((assembly, index) => {
    const template = templateRows[index % Math.max(templateRows.length, 1)];
    return row({
      row_id: `template_composition_manifest.${assembly.shell_section_id}`,
      category: "template_composition_manifest",
      label: `Template composition manifest for ${assembly.shell_section_id}`,
      observed: assembly.current_verdict === "pass" && Boolean(template) && template.template_kind === "static_section_metadata",
      evidence_ref: template?.row_id ?? assembly.row_id,
      composition_id: `composition.implementation_review.${assembly.shell_section_id}`,
      assembly_plan_ref: assembly.row_id,
      source_template_ref: template?.row_id ?? null,
      template_id: template?.template_id ?? `template.implementation_review.${assembly.shell_section_id}`,
      composition_region_id: `region.implementation_review.${index + 1}`,
      safe_dom_anchor: assembly.safe_dom_anchor,
      build_allowed_now: false,
      html_file_write_allowed_now: false,
      dom_render_allowed_now: false,
      browser_run_allowed_now: false,
      write_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildReadOnlyStateSlotMapRows({ source, assemblyRows, compositionRows, generatedAt }) {
  const hydrationRows = Array.isArray(source.data?.fixture_hydration_stub_map_rows) ? source.data.fixture_hydration_stub_map_rows : [];
  return assemblyRows.map((assembly, index) => {
    const composition = compositionRows[index % Math.max(compositionRows.length, 1)];
    const hydration = hydrationRows[index % Math.max(hydrationRows.length, 1)];
    return row({
      row_id: `read_only_state_slot_map.${assembly.shell_section_id}`,
      category: "read_only_state_slot_map",
      label: `Read-only state slot map for ${assembly.shell_section_id}`,
      observed: assembly.current_verdict === "pass" && Boolean(composition) && Boolean(hydration) && hydration.allowed_methods?.includes("GET"),
      evidence_ref: hydration?.row_id ?? composition?.row_id ?? assembly.row_id,
      state_slot_id: `state_slot.implementation_review.${assembly.shell_section_id}`,
      assembly_plan_ref: assembly.row_id,
      composition_ref: composition?.row_id ?? null,
      hydration_stub_ref: hydration?.row_id ?? null,
      fixture_state: hydration?.fixture_state ?? null,
      allowed_methods: ["GET", "HEAD"],
      read_only: true,
      client_hydration_allowed_now: false,
      live_fetch_allowed_now: false,
      network_fetch_allowed_now: false,
      mutating_methods_allowed_now: false,
      route_execution_allowed_now: false,
      raw_payload_included: false,
      generated_at: generatedAt,
    });
  });
}

function buildAccessibilityBlockedCopyGuardRows({ source, assemblyRows, compositionRows, stateRows, generatedAt }) {
  const copyRows = Array.isArray(source.data?.blocked_control_copy_binding_rows) ? source.data.blocked_control_copy_binding_rows : [];
  return assemblyRows.map((assembly, index) => {
    const composition = compositionRows[index % Math.max(compositionRows.length, 1)];
    const state = stateRows[index % Math.max(stateRows.length, 1)];
    const copy = copyRows[index % Math.max(copyRows.length, 1)];
    return row({
      row_id: `accessibility_blocked_copy_guard.${assembly.shell_section_id}`,
      category: "accessibility_blocked_copy_guard",
      label: `Accessibility and blocked copy guard for ${assembly.shell_section_id}`,
      observed: Boolean(assembly) && Boolean(composition) && Boolean(state) && Boolean(copy),
      evidence_ref: copy?.row_id ?? state?.row_id ?? assembly.row_id,
      assembly_plan_ref: assembly.row_id,
      composition_ref: composition?.row_id ?? null,
      state_slot_ref: state?.row_id ?? null,
      source_copy_ref: copy?.row_id ?? null,
      aria_label_ref: `a11y.implementation_review.${assembly.shell_section_id}.label`,
      blocker_copy_ref: copy?.blocker_copy_ref ?? null,
      no_action_copy_ref: copy?.no_action_copy_ref ?? null,
      disabled_control_copy_ref: `copy.implementation_review.${assembly.shell_section_id}.disabled_controls`,
      visible_now: true,
      visible_when_blocked: true,
      advisory_only: true,
      command_button_enabled_now: false,
      approve_button_enabled_now: false,
      closeout_button_enabled_now: false,
      click_action_allowed_now: false,
      keyboard_action_allowed_now: false,
      write_allowed_now: false,
      state_mutation_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildNoBuildNoRenderBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_build_no_render.${flag}`,
    category: "no_build_no_render_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "work_os_static_bundle_review_ui_implementation_review_static_shell_assembly_plan_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.assemblyRows)
    && allPass(context.compositionRows)
    && allPass(context.stateRows)
    && allPass(context.guardRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P42400 source is ready for P42401", context.sourceState.sourceReady],
    ["assembly_plan_visible", "Static shell assembly plan rows are visible", allPass(context.assemblyRows)],
    ["template_composition_visible", "Template composition manifest rows are visible", allPass(context.compositionRows)],
    ["state_slot_visible", "Read-only state slot rows are visible", allPass(context.stateRows)],
    ["accessibility_guard_visible", "Accessibility and blocked copy guard rows are visible", allPass(context.guardRows)],
    ["no_build_no_render_boundary_closed", "No-build/no-render boundary remains closed", allPass(context.boundaryRows)],
    ["p42801_handoff_gate", "P42801 handoff opens only when static shell assembly plan conditions pass", handoffReady],
    ["p42801_handoff_blocker_visible", "P42801 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p42800_checkpoint.${id}`,
    category: "p42800_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p42800_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p42800ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.assemblyRows)
    && allPass(context.compositionRows)
    && allPass(context.stateRows)
    && allPass(context.guardRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p42800_checkpoint.p42801_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.assemblyRows)
    && allPass(context.compositionRows)
    && allPass(context.stateRows)
    && allPass(context.guardRows)
    && allPass(context.boundaryRows);
  return {
    p42800_contract_ready: p42800ContractReady,
    ready_for_p42801_handoff: handoffReady,
    source_p42400_ready_for_p42401_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    static_shell_assembly_plan_contract_visible_now: allPass(context.assemblyRows),
    template_composition_manifest_visible_now: allPass(context.compositionRows),
    read_only_state_slot_map_visible_now: allPass(context.stateRows),
    accessibility_blocked_copy_guard_visible_now: allPass(context.guardRows),
    no_build_no_render_boundary_closed_now: allPass(context.boundaryRows),
    static_shell_assembly_plan_contract_count: context.assemblyRows.length,
    template_composition_manifest_count: context.compositionRows.length,
    read_only_state_slot_map_count: context.stateRows.length,
    accessibility_blocked_copy_guard_count: context.guardRows.length,
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
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P42401-P42800 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P42401-P42800 Work OS Static Bundle Review UI Implementation Review Static Shell Assembly Plan"), "Architecture doc missing P42401-P42800 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P42400 source state is not visible"),
    validationItem("assembly.plan", "static_shell_assembly_plan", allPass(context.assemblyRows), "Static shell assembly plan rows are incomplete"),
    validationItem("template.composition", "static_shell_assembly_plan", allPass(context.compositionRows), "Template composition manifest rows are incomplete"),
    validationItem("state.slot", "static_shell_assembly_plan", allPass(context.stateRows), "Read-only state slot rows are incomplete"),
    validationItem("accessibility.guard", "static_shell_assembly_plan", allPass(context.guardRows), "Accessibility and blocked copy guard rows are incomplete"),
    validationItem("boundary.no_build_no_render", "authority", context.boundary.static_shell_assembly_plan_build_allowed_now === false && context.boundary.static_shell_assembly_plan_dom_render_allowed_now === false && context.boundary.static_shell_assembly_plan_html_file_write_allowed_now === false, "Static shell assembly no-build/no-render boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p42800_checkpoint.p42801_handoff_blocker_visible"), "P42800 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "work_os_static_bundle_review_ui_implementation_review_static_shell_assembly_plan.contract.v1",
    generated_at: generatedAt,
    source_p42400_required_or_rebuilt: true,
    static_shell_assembly_plan_contract_required: true,
    template_composition_manifest_required: true,
    read_only_state_slot_map_required: true,
    accessibility_blocked_copy_guard_required: true,
    no_build_no_render_boundary_required: true,
    p42801_handoff_is_not_build_route_dom_browser_action_write_approval_closeout_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p42801_handoff
    ? READY_STATUS
    : validation.valid && boundary.p42800_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    work_os_static_bundle_review_ui_implementation_review_static_shell_assembly_plan_status: status,
    source_p42400_ready_for_p42401_handoff: boundary.source_p42400_ready_for_p42401_handoff,
    static_shell_assembly_plan_contract_count: boundary.static_shell_assembly_plan_contract_count,
    template_composition_manifest_count: boundary.template_composition_manifest_count,
    read_only_state_slot_map_count: boundary.read_only_state_slot_map_count,
    accessibility_blocked_copy_guard_count: boundary.accessibility_blocked_copy_guard_count,
    ready_for_p42801_handoff: validation.valid && boundary.ready_for_p42801_handoff,
    static_shell_assembly_plan_build_allowed_now: false,
    static_shell_assembly_plan_route_execution_allowed_now: false,
    static_shell_assembly_plan_dom_render_allowed_now: false,
    static_shell_assembly_plan_browser_run_allowed_now: false,
    static_shell_assembly_plan_client_hydration_allowed_now: false,
    static_shell_assembly_plan_network_fetch_allowed_now: false,
    static_shell_assembly_plan_click_action_allowed_now: false,
    static_shell_assembly_plan_write_allowed_now: false,
    static_shell_assembly_plan_state_mutation_allowed_now: false,
    static_shell_assembly_plan_html_file_write_allowed_now: false,
    static_shell_assembly_plan_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Work OS Static Bundle Review UI Implementation Review Static Shell Assembly Plan",
    "",
    `Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_assembly_plan_status}`,
    `Program: ${result.program_range}`,
    `P42400 ready for P42401 handoff: ${result.summary.source_p42400_ready_for_p42401_handoff}`,
    `Assembly rows: ${result.summary.static_shell_assembly_plan_contract_count}`,
    `Composition rows: ${result.summary.template_composition_manifest_count}`,
    `State slot rows: ${result.summary.read_only_state_slot_map_count}`,
    `Ready for P42801 handoff: ${result.summary.ready_for_p42801_handoff}`,
    `Build allowed: ${result.summary.static_shell_assembly_plan_build_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.static_shell_assembly_plan_contract_rows.map((item) => `<tr><td>${escapeHtml(item.shell_section_id)}</td><td>${escapeHtml(item.safe_dom_anchor)}</td><td>${escapeHtml(item.build_allowed_now)}</td><td>${escapeHtml(item.dom_render_allowed_now)}</td><td>${escapeHtml(item.html_file_write_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Work OS Static Bundle Review UI Implementation Review Static Shell Assembly Plan</title>
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
    <h1>Hermes Work OS Static Bundle Review UI Implementation Review Static Shell Assembly Plan</h1>
    <p class="notice">This artifact defines static shell assembly metadata only. It does not build UI assets, write HTML files, start servers, register routes, render DOM, run browsers, hydrate client state, click actions, mutate state, approve, close out, export, publish, or claim production readiness.</p>
    <table><thead><tr><th>Section</th><th>Safe DOM Anchor</th><th>Build</th><th>DOM Render</th><th>HTML Write</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP42400(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellCandidate({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.work_os_static_bundle_review_ui_implementation_review_static_shell_candidate", built);
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
  const defaults = DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_ASSEMBLY_PLAN_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_work_os_static_bundle_review_ui_implementation_review_static_shell_candidate_path: path.resolve(repoRoot, options.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellCandidatePath ?? defaults.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellCandidatePath),
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
      args.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellCandidatePath = argv[++index];
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
  console.log(`Usage: node scripts/work-os-static-bundle-review-ui-implementation-review-static-shell-assembly-plan.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P42401-P42800 Work OS Static Bundle Review UI Implementation Review Static Shell Assembly Plan.
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
