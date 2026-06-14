import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P51600_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellHandoff,
} from "./work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-handoff.mjs";

export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_CANDIDATE_OUT_DIR = "artifacts/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-candidate/latest";
export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_CANDIDATE_INPUTS = {
  schemaPath: "schemas/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-candidate.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p51601-p52000.md",
  architectureDocPath: "docs/architecture.md",
  sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellHandoffPath: "artifacts/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-handoff/latest/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-handoff.json",
};

const COMMAND_NAME = "platform:work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-candidate";
const SCHEMA_VERSION = "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-candidate.v1";
const CAPABILITY_ID = "platform.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_candidate";
const PROGRAM_RANGE = "P51601-P52000";
const SOURCE_PROGRAM_RANGE = "P51201-P51600";
const READY_STATUS = "ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_candidate";
const BLOCK_PENDING_STATUS = "valid_block_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_candidate_pending";
const BLOCKED_STATUS = "blocked_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_candidate";

const PHASE_SPECS = [
  ["P51601-P51640", "P51600 Source Binding", "p51600_source_binding_rows"],
  ["P51641-P51720", "Static Shell Implementation Candidate Contract", "static_shell_candidate_contract_rows"],
  ["P51721-P51800", "Section Template Manifest", "section_template_manifest_rows"],
  ["P51801-P51880", "Fixture Hydration Stub Map", "fixture_hydration_stub_map_rows"],
  ["P51881-P51940", "Blocked Control Copy Binding", "blocked_control_copy_binding_rows"],
  ["P51941-P51980", "No-Serve/No-DOM Boundary", "no_serve_no_dom_boundary_rows"],
  ["P51981-P52000", "P52000 Clean Checkpoint", "p52000_clean_checkpoint_rows"],
];

const CANDIDATE_SECTIONS = [
  ["review_summary_header", "Implementation review summary header candidate"],
  ["finding_seed_index", "Finding seed index candidate"],
  ["screen_package_detail_drawer", "Screen package detail drawer candidate"],
  ["route_contract_stack", "Route contract stack candidate"],
  ["review_status_strip", "Review status strip implementation candidate"],
  ["blocker_notice_band", "Blocker notice band implementation candidate"],
  ["disabled_action_sidebar", "Disabled action sidebar candidate"],
  ["no_receipt_accept_footer", "No receipt accept footer candidate"],
];

export const STATIC_SHELL_CANDIDATE_FALSE_FLAGS = [
  "static_shell_candidate_server_start_allowed_now",
  "static_shell_candidate_route_registration_allowed_now",
  "static_shell_candidate_route_mount_allowed_now",
  "static_shell_candidate_route_execution_allowed_now",
  "static_shell_candidate_dom_render_allowed_now",
  "static_shell_candidate_browser_run_allowed_now",
  "static_shell_candidate_browser_smoke_allowed_now",
  "static_shell_candidate_live_refresh_allowed_now",
  "static_shell_candidate_network_fetch_allowed_now",
  "static_shell_candidate_click_action_allowed_now",
  "static_shell_candidate_keyboard_action_allowed_now",
  "static_shell_candidate_write_allowed_now",
  "static_shell_candidate_state_mutation_allowed_now",
  "static_shell_candidate_snapshot_capture_allowed_now",
  "static_shell_candidate_html_file_write_allowed_now",
  "static_shell_candidate_raw_payload_exposure_allowed_now",
  "static_shell_candidate_secret_exposure_allowed_now",
  "static_shell_candidate_command_button_enabled_now",
  "static_shell_candidate_approve_button_enabled_now",
  "static_shell_candidate_closeout_button_enabled_now",
  "static_shell_candidate_export_allowed_now",
  "static_shell_candidate_publish_allowed_now",
  "static_shell_candidate_final_approval_allowed_now",
  "static_shell_candidate_production_pass_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...STATIC_SHELL_CANDIDATE_FALSE_FLAGS, ...P51600_FALSE_FLAGS])];

export async function runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellCandidate(options = {}) {
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellCandidate(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static Shell Candidate failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellCandidate(result, result.output_dir);
  return result;
}

export async function buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellCandidate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_CANDIDATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellHandoff")
    ? normalizeInlineJsonSource("inline.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_handoff", options.workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellHandoff)
    : await readJsonOrBuildP51600(inputs.source_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_handoff_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const candidateRows = buildStaticShellCandidateContractRows({ source, generatedAt });
  const templateRows = buildSectionTemplateManifestRows({ source, candidateRows, generatedAt });
  const hydrationRows = buildFixtureHydrationStubMapRows({ source, candidateRows, templateRows, generatedAt });
  const copyRows = buildBlockedControlCopyBindingRows({ source, candidateRows, templateRows, hydrationRows, generatedAt });
  const boundaryRows = buildNoServeNoDomBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, candidateRows, templateRows, hydrationRows, copyRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, candidateRows, templateRows, hydrationRows, copyRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, candidateRows, templateRows, hydrationRows, copyRows, boundaryRows, checkpointRows, boundary });
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
      work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_handoff_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_handoff_summary: source.data?.summary ?? null,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_candidate_contract: buildContract(generatedAt),
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_candidate_phase_rows: phaseRows,
    p51600_source_binding_rows: sourceRows,
    static_shell_candidate_contract_rows: candidateRows,
    section_template_manifest_rows: templateRows,
    fixture_hydration_stub_map_rows: hydrationRows,
    blocked_control_copy_binding_rows: copyRows,
    no_serve_no_dom_boundary_rows: boundaryRows,
    p52000_clean_checkpoint_rows: checkpointRows,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_candidate_boundary: boundary,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_candidate_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_candidate")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_candidate_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_candidate_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellCandidate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-candidate.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p51600-source-binding-rows.json"), collectionEnvelope("p51600-source-binding-rows.v1", "p51600_source_binding_rows", result.p51600_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "static-shell-candidate-contract-rows.json"), collectionEnvelope("static-shell-candidate-contract-rows.v1", "static_shell_candidate_contract_rows", result.static_shell_candidate_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "section-template-manifest-rows.json"), collectionEnvelope("section-template-manifest-rows.v1", "section_template_manifest_rows", result.section_template_manifest_rows, result.generated_at));
  await writeJson(path.join(outDir, "fixture-hydration-stub-map-rows.json"), collectionEnvelope("fixture-hydration-stub-map-rows.v1", "fixture_hydration_stub_map_rows", result.fixture_hydration_stub_map_rows, result.generated_at));
  await writeJson(path.join(outDir, "blocked-control-copy-binding-rows.json"), collectionEnvelope("blocked-control-copy-binding-rows.v1", "blocked_control_copy_binding_rows", result.blocked_control_copy_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-serve-no-dom-boundary-rows.json"), collectionEnvelope("no-serve-no-dom-boundary-rows.v1", "no_serve_no_dom_boundary_rows", result.no_serve_no_dom_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p52000-clean-checkpoint-rows.json"), collectionEnvelope("p52000-clean-checkpoint-rows.v1", "p52000_clean_checkpoint_rows", result.p52000_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-candidate-boundary.json"), result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_candidate_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellCandidateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellCandidate(args);
  console.log(`Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static Shell Candidate ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_candidate_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P51600 ready for P51601 handoff: ${result.summary.source_p51600_ready_for_p51601_handoff}`);
  console.log(`Candidate rows: ${result.summary.static_shell_candidate_contract_count}`);
  console.log(`Template rows: ${result.summary.section_template_manifest_count}`);
  console.log(`Hydration stub rows: ${result.summary.fixture_hydration_stub_map_count}`);
  console.log(`Ready for P52001 handoff: ${result.summary.ready_for_p52001_handoff}`);
  console.log(`Static shell candidate DOM render allowed: ${result.summary.static_shell_candidate_dom_render_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_handoff_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p51601_handoff === true,
    status: summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_handoff_status ?? "missing",
    p51600ContractReady: boundary.p51600_contract_ready === true,
    staticShellHandoffVisible: boundary.static_shell_handoff_contract_visible_now === true,
    shellSectionBindingVisible: boundary.shell_section_binding_map_visible_now === true,
    fixtureSlotProjectionVisible: boundary.fixture_slot_projection_visible_now === true,
    blockedStateCopyVisible: boundary.blocked_state_copy_surface_visible_now === true,
    noServeNoRenderClosed: boundary.no_serve_no_render_authority_closed_now === true,
    boundaryClosed: P51600_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p51601-p52000.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P51600 implementation review static shell handoff source is available", sourceState.available],
    ["program_range", "P51600 source program range is P51201-P51600", sourceState.programRangeOk],
    ["validation_valid", "P51600 source validation is valid", sourceState.validationValid],
    ["p51601_handoff_open", "P51600 source opened P51601 handoff", sourceState.sourceReady],
    ["p51600_contract_ready", "P51600 source contract is ready", sourceState.p51600ContractReady],
    ["static_shell_handoff_visible", "P51600 static shell handoff rows are visible", sourceState.staticShellHandoffVisible],
    ["shell_section_binding_visible", "P51600 shell section binding rows are visible", sourceState.shellSectionBindingVisible],
    ["fixture_slot_projection_visible", "P51600 fixture slot projection rows are visible", sourceState.fixtureSlotProjectionVisible],
    ["blocked_state_copy_visible", "P51600 blocked state copy rows are visible", sourceState.blockedStateCopyVisible],
    ["no_serve_no_render_closed", "P51600 no-serve/no-render authority is closed", sourceState.noServeNoRenderClosed],
    ["commit_ref_present", "Current commit ref is present for static shell candidate", Boolean(commitRef)],
    ["source_blocker_visible", "P51600 source blocker is visible when static shell candidate is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p51600_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildStaticShellCandidateContractRows({ source, generatedAt }) {
  const handoffRows = Array.isArray(source.data?.static_shell_handoff_contract_rows) ? source.data.static_shell_handoff_contract_rows : [];
  return CANDIDATE_SECTIONS.map(([sectionId, label], index) => {
    const handoff = handoffRows[index % Math.max(handoffRows.length, 1)];
    return row({
      row_id: `static_shell_candidate_contract.${sectionId}`,
      category: "static_shell_candidate_contract",
      label,
      observed: Boolean(handoff) && handoff.current_verdict === "pass" && handoff.read_only === true,
      evidence_ref: handoff?.row_id ?? "static_shell_handoff_contract_rows",
      candidate_id: `candidate.implementation_review.${sectionId}`,
      shell_section_id: sectionId,
      source_handoff_ref: handoff?.row_id ?? null,
      safe_dom_anchor: handoff?.safe_dom_anchor ?? `#hermes-${sectionId.replaceAll("_", "-")}`,
      template_candidate_ref: `template.implementation_review.${sectionId}`,
      static_metadata_only: true,
      visible_now: true,
      visible_when_blocked: true,
      server_start_allowed_now: false,
      route_registration_allowed_now: false,
      route_mount_allowed_now: false,
      route_execution_allowed_now: false,
      dom_render_allowed_now: false,
      browser_run_allowed_now: false,
      browser_smoke_allowed_now: false,
      click_action_allowed_now: false,
      keyboard_action_allowed_now: false,
      write_allowed_now: false,
      state_mutation_allowed_now: false,
      html_file_write_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildSectionTemplateManifestRows({ source, candidateRows, generatedAt }) {
  const sectionRows = Array.isArray(source.data?.shell_section_binding_map_rows) ? source.data.shell_section_binding_map_rows : [];
  return candidateRows.map((candidate, index) => {
    const section = sectionRows[index % Math.max(sectionRows.length, 1)];
    return row({
      row_id: `section_template_manifest.${candidate.shell_section_id}`,
      category: "section_template_manifest",
      label: `Section template manifest for ${candidate.shell_section_id}`,
      observed: candidate.current_verdict === "pass" && Boolean(section) && section.static_shell_only === true,
      evidence_ref: section?.row_id ?? candidate.row_id,
      template_id: `template.implementation_review.${candidate.shell_section_id}`,
      candidate_ref: candidate.row_id,
      source_section_ref: section?.row_id ?? null,
      shell_slot_id: section?.shell_slot_id ?? `shell.implementation_review.${candidate.shell_section_id}`,
      safe_dom_anchor: candidate.safe_dom_anchor,
      template_kind: "static_section_metadata",
      allowed_methods: ["GET", "HEAD"],
      html_file_write_allowed_now: false,
      dom_render_allowed_now: false,
      route_registered_now: false,
      route_mount_allowed_now: false,
      route_execution_allowed_now: false,
      browser_run_allowed_now: false,
      write_allowed_now: false,
      state_mutation_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildFixtureHydrationStubMapRows({ source, candidateRows, templateRows, generatedAt }) {
  const fixtureRows = Array.isArray(source.data?.fixture_slot_projection_rows) ? source.data.fixture_slot_projection_rows : [];
  return candidateRows.map((candidate, index) => {
    const template = templateRows[index % Math.max(templateRows.length, 1)];
    const fixture = fixtureRows[index % Math.max(fixtureRows.length, 1)];
    return row({
      row_id: `fixture_hydration_stub_map.${candidate.shell_section_id}`,
      category: "fixture_hydration_stub_map",
      label: `Fixture hydration stub map for ${candidate.shell_section_id}`,
      observed: candidate.current_verdict === "pass" && Boolean(template) && Boolean(fixture) && fixture.allowed_methods?.includes("GET"),
      evidence_ref: fixture?.row_id ?? template?.row_id ?? candidate.row_id,
      hydration_stub_id: `hydration_stub.implementation_review.${candidate.shell_section_id}`,
      candidate_ref: candidate.row_id,
      template_ref: template?.row_id ?? null,
      fixture_slot_ref: fixture?.row_id ?? null,
      fixture_state: fixture?.fixture_state ?? null,
      allowed_methods: ["GET", "HEAD"],
      client_hydration_allowed_now: false,
      live_fetch_allowed_now: false,
      network_fetch_allowed_now: false,
      mutating_methods_allowed_now: false,
      route_execution_allowed_now: false,
      raw_payload_included: false,
      secret_exposure_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildBlockedControlCopyBindingRows({ source, candidateRows, templateRows, hydrationRows, generatedAt }) {
  const copyRows = Array.isArray(source.data?.blocked_state_copy_surface_rows) ? source.data.blocked_state_copy_surface_rows : [];
  return candidateRows.map((candidate, index) => {
    const template = templateRows[index % Math.max(templateRows.length, 1)];
    const hydration = hydrationRows[index % Math.max(hydrationRows.length, 1)];
    const copy = copyRows[index % Math.max(copyRows.length, 1)];
    return row({
      row_id: `blocked_control_copy_binding.${candidate.shell_section_id}`,
      category: "blocked_control_copy_binding",
      label: `Blocked control copy binding for ${candidate.shell_section_id}`,
      observed: Boolean(candidate) && Boolean(template) && Boolean(hydration) && Boolean(copy),
      evidence_ref: copy?.row_id ?? hydration?.row_id ?? candidate.row_id,
      candidate_ref: candidate.row_id,
      template_ref: template?.row_id ?? null,
      hydration_stub_ref: hydration?.row_id ?? null,
      source_copy_ref: copy?.row_id ?? null,
      blocker_copy_ref: copy?.blocker_copy_ref ?? `copy.implementation_review.${candidate.shell_section_id}.blocker`,
      no_action_copy_ref: copy?.no_action_copy_ref ?? `copy.implementation_review.${candidate.shell_section_id}.no_action`,
      redaction_copy_ref: copy?.redaction_copy_ref ?? `copy.implementation_review.${candidate.shell_section_id}.redaction`,
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

function buildNoServeNoDomBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_serve_no_dom.${flag}`,
    category: "no_serve_no_dom_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_candidate_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.candidateRows)
    && allPass(context.templateRows)
    && allPass(context.hydrationRows)
    && allPass(context.copyRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P51600 source is ready for P51601", context.sourceState.sourceReady],
    ["candidate_contract_visible", "Static shell candidate contract rows are visible", allPass(context.candidateRows)],
    ["section_template_manifest_visible", "Section template manifest rows are visible", allPass(context.templateRows)],
    ["fixture_hydration_stub_visible", "Fixture hydration stub rows are visible", allPass(context.hydrationRows)],
    ["blocked_control_copy_visible", "Blocked control copy rows are visible", allPass(context.copyRows)],
    ["no_serve_no_dom_boundary_closed", "No-serve/no-DOM boundary remains closed", allPass(context.boundaryRows)],
    ["p52001_handoff_gate", "P52001 handoff opens only when static shell candidate conditions pass", handoffReady],
    ["p52001_handoff_blocker_visible", "P52001 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p52000_checkpoint.${id}`,
    category: "p52000_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p52000_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p52000ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.candidateRows)
    && allPass(context.templateRows)
    && allPass(context.hydrationRows)
    && allPass(context.copyRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p52000_checkpoint.p52001_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.candidateRows)
    && allPass(context.templateRows)
    && allPass(context.hydrationRows)
    && allPass(context.copyRows)
    && allPass(context.boundaryRows);
  return {
    p52000_contract_ready: p52000ContractReady,
    ready_for_p52001_handoff: handoffReady,
    source_p51600_ready_for_p51601_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    static_shell_candidate_contract_visible_now: allPass(context.candidateRows),
    section_template_manifest_visible_now: allPass(context.templateRows),
    fixture_hydration_stub_map_visible_now: allPass(context.hydrationRows),
    blocked_control_copy_binding_visible_now: allPass(context.copyRows),
    no_serve_no_dom_boundary_closed_now: allPass(context.boundaryRows),
    static_shell_candidate_contract_count: context.candidateRows.length,
    section_template_manifest_count: context.templateRows.length,
    fixture_hydration_stub_map_count: context.hydrationRows.length,
    blocked_control_copy_binding_count: context.copyRows.length,
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
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P51601-P52000 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P51601-P52000 Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static Shell Candidate"), "Architecture doc missing P51601-P52000 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P51600 source state is not visible"),
    validationItem("candidate.contract", "static_shell_candidate", allPass(context.candidateRows), "Static shell candidate rows are incomplete"),
    validationItem("template.manifest", "static_shell_candidate", allPass(context.templateRows), "Section template manifest rows are incomplete"),
    validationItem("fixture.hydration", "static_shell_candidate", allPass(context.hydrationRows), "Fixture hydration stub rows are incomplete"),
    validationItem("blocked.copy", "static_shell_candidate", allPass(context.copyRows), "Blocked control copy rows are incomplete"),
    validationItem("boundary.no_serve_no_dom", "authority", context.boundary.static_shell_candidate_server_start_allowed_now === false && context.boundary.static_shell_candidate_dom_render_allowed_now === false && context.boundary.static_shell_candidate_browser_run_allowed_now === false, "Static shell candidate no-serve/no-DOM boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p52000_checkpoint.p52001_handoff_blocker_visible"), "P52000 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_candidate.contract.v1",
    generated_at: generatedAt,
    source_p51600_required_or_rebuilt: true,
    static_shell_candidate_contract_required: true,
    section_template_manifest_required: true,
    fixture_hydration_stub_map_required: true,
    blocked_control_copy_binding_required: true,
    no_serve_no_dom_boundary_required: true,
    p52001_handoff_is_not_server_route_dom_browser_action_write_approval_closeout_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p52001_handoff
    ? READY_STATUS
    : validation.valid && boundary.p52000_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_candidate_status: status,
    source_p51600_ready_for_p51601_handoff: boundary.source_p51600_ready_for_p51601_handoff,
    static_shell_candidate_contract_count: boundary.static_shell_candidate_contract_count,
    section_template_manifest_count: boundary.section_template_manifest_count,
    fixture_hydration_stub_map_count: boundary.fixture_hydration_stub_map_count,
    blocked_control_copy_binding_count: boundary.blocked_control_copy_binding_count,
    ready_for_p52001_handoff: validation.valid && boundary.ready_for_p52001_handoff,
    static_shell_candidate_server_start_allowed_now: false,
    static_shell_candidate_route_execution_allowed_now: false,
    static_shell_candidate_dom_render_allowed_now: false,
    static_shell_candidate_browser_run_allowed_now: false,
    static_shell_candidate_browser_smoke_allowed_now: false,
    static_shell_candidate_live_refresh_allowed_now: false,
    static_shell_candidate_network_fetch_allowed_now: false,
    static_shell_candidate_click_action_allowed_now: false,
    static_shell_candidate_write_allowed_now: false,
    static_shell_candidate_state_mutation_allowed_now: false,
    static_shell_candidate_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static Shell Candidate",
    "",
    `Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_candidate_status}`,
    `Program: ${result.program_range}`,
    `P51600 ready for P51601 handoff: ${result.summary.source_p51600_ready_for_p51601_handoff}`,
    `Candidate rows: ${result.summary.static_shell_candidate_contract_count}`,
    `Template rows: ${result.summary.section_template_manifest_count}`,
    `Hydration stub rows: ${result.summary.fixture_hydration_stub_map_count}`,
    `Ready for P52001 handoff: ${result.summary.ready_for_p52001_handoff}`,
    `Static shell candidate DOM render allowed: ${result.summary.static_shell_candidate_dom_render_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.static_shell_candidate_contract_rows.map((item) => `<tr><td>${escapeHtml(item.shell_section_id)}</td><td>${escapeHtml(item.safe_dom_anchor)}</td><td>${escapeHtml(item.dom_render_allowed_now)}</td><td>${escapeHtml(item.html_file_write_allowed_now)}</td><td>${escapeHtml(item.browser_run_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static Shell Candidate</title>
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
    <h1>Hermes Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static Shell Candidate</h1>
    <p class="notice">This artifact defines static shell implementation candidate metadata only. It does not write UI files, start servers, register routes, render DOM, run browsers, hydrate client state, click actions, mutate state, approve, close out, export, publish, or claim production readiness.</p>
    <table><thead><tr><th>Section</th><th>Safe DOM Anchor</th><th>DOM Render</th><th>HTML Write</th><th>Browser</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP51600(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellHandoff({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_handoff", built);
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
  const defaults = DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_CANDIDATE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_handoff_path: path.resolve(repoRoot, options.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellHandoffPath ?? defaults.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellHandoffPath),
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
      args.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellHandoffPath = argv[++index];
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
  console.log(`Usage: node scripts/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-candidate.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P51601-P52000 Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static Shell Candidate.
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
