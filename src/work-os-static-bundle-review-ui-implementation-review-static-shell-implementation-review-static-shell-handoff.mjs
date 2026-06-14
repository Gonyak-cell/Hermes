import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P46400_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewLocalUiBindingSmoke,
} from "./work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-local-ui-binding-smoke.mjs";

export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_HANDOFF_OUT_DIR = "artifacts/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-handoff/latest";
export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_HANDOFF_INPUTS = {
  schemaPath: "schemas/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-handoff.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p46401-p46800.md",
  architectureDocPath: "docs/architecture.md",
  sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewLocalUiBindingSmokePath: "artifacts/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-local-ui-binding-smoke/latest/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-local-ui-binding-smoke.json",
};

const COMMAND_NAME = "platform:work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-handoff";
const SCHEMA_VERSION = "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-handoff.v1";
const CAPABILITY_ID = "platform.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff";
const PROGRAM_RANGE = "P46401-P46800";
const SOURCE_PROGRAM_RANGE = "P46001-P46400";
const READY_STATUS = "ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff";
const BLOCK_PENDING_STATUS = "valid_block_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_pending";
const BLOCKED_STATUS = "blocked_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff";

const PHASE_SPECS = [
  ["P46401-P46440", "P46400 Source Binding", "p46400_source_binding_rows"],
  ["P46441-P46520", "Static Shell Handoff Contract", "static_shell_handoff_contract_rows"],
  ["P46521-P46600", "Shell Section Binding Map", "shell_section_binding_map_rows"],
  ["P46601-P46680", "Fixture Slot Projection", "fixture_slot_projection_rows"],
  ["P46681-P46740", "Blocked State Copy Surface", "blocked_state_copy_surface_rows"],
  ["P46741-P46780", "No-Serve/No-Render Authority", "no_serve_no_render_authority_rows"],
  ["P46781-P46800", "P46800 Clean Checkpoint", "p46800_clean_checkpoint_rows"],
];

const SHELL_SECTIONS = [
  ["review_summary_header", "Implementation review summary header"],
  ["finding_seed_index", "Finding seed index"],
  ["screen_package_detail_drawer", "Screen package detail drawer"],
  ["route_contract_stack", "Route contract stack"],
  ["review_status_strip", "Review status strip"],
  ["blocker_notice_band", "Blocker notice band"],
  ["disabled_action_sidebar", "Disabled action sidebar"],
  ["no_receipt_accept_footer", "No receipt accept footer"],
];

export const STATIC_SHELL_HANDOFF_FALSE_FLAGS = [
  "static_shell_server_start_allowed_now",
  "static_shell_route_registration_allowed_now",
  "static_shell_route_mount_allowed_now",
  "static_shell_route_execution_allowed_now",
  "static_shell_dom_render_allowed_now",
  "static_shell_browser_run_allowed_now",
  "static_shell_browser_smoke_allowed_now",
  "static_shell_live_refresh_allowed_now",
  "static_shell_network_fetch_allowed_now",
  "static_shell_click_action_allowed_now",
  "static_shell_keyboard_action_allowed_now",
  "static_shell_write_allowed_now",
  "static_shell_state_mutation_allowed_now",
  "static_shell_snapshot_capture_allowed_now",
  "static_shell_html_file_write_allowed_now",
  "static_shell_raw_payload_exposure_allowed_now",
  "static_shell_secret_exposure_allowed_now",
  "static_shell_command_button_enabled_now",
  "static_shell_approve_button_enabled_now",
  "static_shell_closeout_button_enabled_now",
  "static_shell_export_allowed_now",
  "static_shell_publish_allowed_now",
  "static_shell_final_approval_allowed_now",
  "static_shell_production_pass_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...STATIC_SHELL_HANDOFF_FALSE_FLAGS, ...P46400_FALSE_FLAGS])];

export async function runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellHandoff(options = {}) {
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellHandoff(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Handoff failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellHandoff(result, result.output_dir);
  return result;
}

export async function buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellHandoff(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_HANDOFF_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewLocalUiBindingSmoke")
    ? normalizeInlineJsonSource("inline.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_local_ui_binding_smoke", options.workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewLocalUiBindingSmoke)
    : await readJsonOrBuildP46400(inputs.source_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_local_ui_binding_smoke_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const handoffRows = buildStaticShellHandoffContractRows({ source, generatedAt });
  const sectionRows = buildShellSectionBindingMapRows({ source, handoffRows, generatedAt });
  const fixtureRows = buildFixtureSlotProjectionRows({ source, handoffRows, sectionRows, generatedAt });
  const copyRows = buildBlockedStateCopySurfaceRows({ source, handoffRows, sectionRows, fixtureRows, generatedAt });
  const authorityRows = buildNoServeNoRenderAuthorityRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, handoffRows, sectionRows, fixtureRows, copyRows, authorityRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, handoffRows, sectionRows, fixtureRows, copyRows, authorityRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, handoffRows, sectionRows, fixtureRows, copyRows, authorityRows, checkpointRows, boundary });
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
      work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_local_ui_binding_smoke_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_local_ui_binding_smoke_summary: source.data?.summary ?? null,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_contract: buildContract(generatedAt),
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_phase_rows: phaseRows,
    p46400_source_binding_rows: sourceRows,
    static_shell_handoff_contract_rows: handoffRows,
    shell_section_binding_map_rows: sectionRows,
    fixture_slot_projection_rows: fixtureRows,
    blocked_state_copy_surface_rows: copyRows,
    no_serve_no_render_authority_rows: authorityRows,
    p46800_clean_checkpoint_rows: checkpointRows,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_boundary: boundary,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellHandoff(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-handoff.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p46400-source-binding-rows.json"), collectionEnvelope("p46400-source-binding-rows.v1", "p46400_source_binding_rows", result.p46400_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "static-shell-handoff-contract-rows.json"), collectionEnvelope("static-shell-handoff-contract-rows.v1", "static_shell_handoff_contract_rows", result.static_shell_handoff_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "shell-section-binding-map-rows.json"), collectionEnvelope("shell-section-binding-map-rows.v1", "shell_section_binding_map_rows", result.shell_section_binding_map_rows, result.generated_at));
  await writeJson(path.join(outDir, "fixture-slot-projection-rows.json"), collectionEnvelope("fixture-slot-projection-rows.v1", "fixture_slot_projection_rows", result.fixture_slot_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "blocked-state-copy-surface-rows.json"), collectionEnvelope("blocked-state-copy-surface-rows.v1", "blocked_state_copy_surface_rows", result.blocked_state_copy_surface_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-serve-no-render-authority-rows.json"), collectionEnvelope("no-serve-no-render-authority-rows.v1", "no_serve_no_render_authority_rows", result.no_serve_no_render_authority_rows, result.generated_at));
  await writeJson(path.join(outDir, "p46800-clean-checkpoint-rows.json"), collectionEnvelope("p46800-clean-checkpoint-rows.v1", "p46800_clean_checkpoint_rows", result.p46800_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-handoff-boundary.json"), result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellHandoffCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellHandoff(args);
  console.log(`Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Handoff ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P46400 ready for P46401 handoff: ${result.summary.source_p46400_ready_for_p46401_handoff}`);
  console.log(`Static shell handoff rows: ${result.summary.static_shell_handoff_contract_count}`);
  console.log(`Shell section rows: ${result.summary.shell_section_binding_map_count}`);
  console.log(`Fixture projection rows: ${result.summary.fixture_slot_projection_count}`);
  console.log(`Ready for P46801 handoff: ${result.summary.ready_for_p46801_handoff}`);
  console.log(`Static shell server allowed: ${result.summary.static_shell_server_start_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_local_ui_binding_smoke_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p46401_handoff === true,
    status: summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_local_ui_binding_smoke_status ?? "missing",
    p46400ContractReady: boundary.p46400_contract_ready === true,
    bindingSmokeVisible: boundary.local_ui_binding_smoke_visible_now === true,
    staticShellBindingVisible: boundary.static_shell_binding_map_visible_now === true,
    fixtureFetchVisible: boundary.get_only_fixture_fetch_contract_visible_now === true,
    blockerNoActionVisible: boundary.visible_blocker_no_action_visible_now === true,
    noServerNoBrowserClosed: boundary.no_server_no_browser_boundary_closed_now === true,
    boundaryClosed: P46400_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p46401-p46800.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P46400 implementation review local UI binding smoke source is available", sourceState.available],
    ["program_range", "P46400 source program range is P46001-P46400", sourceState.programRangeOk],
    ["validation_valid", "P46400 source validation is valid", sourceState.validationValid],
    ["p46401_handoff_open", "P46400 source opened P46401 handoff", sourceState.sourceReady],
    ["p46400_contract_ready", "P46400 source contract is ready", sourceState.p46400ContractReady],
    ["binding_smoke_visible", "P46400 local UI binding smoke rows are visible", sourceState.bindingSmokeVisible],
    ["static_shell_binding_visible", "P46400 static shell binding map rows are visible", sourceState.staticShellBindingVisible],
    ["fixture_fetch_visible", "P46400 GET-only fixture fetch rows are visible", sourceState.fixtureFetchVisible],
    ["blocker_no_action_visible", "P46400 blocker/no-action rows are visible", sourceState.blockerNoActionVisible],
    ["no_server_no_browser_closed", "P46400 no-server/no-browser boundary is closed", sourceState.noServerNoBrowserClosed],
    ["commit_ref_present", "Current commit ref is present for static shell handoff", Boolean(commitRef)],
    ["source_blocker_visible", "P46400 source blocker is visible when static shell handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p46400_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildStaticShellHandoffContractRows({ source, generatedAt }) {
  const bindingRows = Array.isArray(source.data?.local_ui_binding_smoke_rows) ? source.data.local_ui_binding_smoke_rows : [];
  return SHELL_SECTIONS.map(([sectionId, label], index) => {
    const binding = bindingRows[index % Math.max(bindingRows.length, 1)];
    return row({
      row_id: `static_shell_handoff_contract.${sectionId}`,
      category: "static_shell_handoff_contract",
      label,
      observed: Boolean(binding) && binding.current_verdict === "pass" && binding.read_only === true,
      evidence_ref: binding?.row_id ?? "local_ui_binding_smoke_rows",
      shell_section_id: sectionId,
      binding_slot_ref: binding?.row_id ?? null,
      safe_dom_anchor: binding?.safe_dom_anchor ?? `#hermes-${sectionId.replaceAll("_", "-")}`,
      static_shell_ref: `static_shell.implementation_review.${sectionId}`,
      read_only: true,
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
      generated_at: generatedAt,
    });
  });
}

function buildShellSectionBindingMapRows({ source, handoffRows, generatedAt }) {
  const shellRows = Array.isArray(source.data?.static_shell_binding_map_rows) ? source.data.static_shell_binding_map_rows : [];
  return handoffRows.map((handoff, index) => {
    const shell = shellRows[index % Math.max(shellRows.length, 1)];
    return row({
      row_id: `shell_section_binding_map.${handoff.shell_section_id}`,
      category: "shell_section_binding_map",
      label: `Shell section binding map for ${handoff.shell_section_id}`,
      observed: handoff.current_verdict === "pass" && Boolean(shell) && shell.static_shell_only === true,
      evidence_ref: shell?.row_id ?? handoff.row_id,
      shell_section_id: handoff.shell_section_id,
      handoff_contract_ref: handoff.row_id,
      source_shell_binding_ref: shell?.row_id ?? null,
      shell_slot_id: shell?.shell_slot_id ?? `shell.implementation_review.${handoff.shell_section_id}`,
      safe_dom_anchor: handoff.safe_dom_anchor,
      allowed_methods: ["GET", "HEAD"],
      static_shell_only: true,
      route_hint: shell?.route_hint ?? `/work-os/implementation-review/${handoff.shell_section_id}`,
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

function buildFixtureSlotProjectionRows({ source, handoffRows, sectionRows, generatedAt }) {
  const fixtureRows = Array.isArray(source.data?.get_only_fixture_fetch_contract_rows) ? source.data.get_only_fixture_fetch_contract_rows : [];
  return handoffRows.map((handoff, index) => {
    const section = sectionRows[index % Math.max(sectionRows.length, 1)];
    const fixture = fixtureRows[index % Math.max(fixtureRows.length, 1)];
    return row({
      row_id: `fixture_slot_projection.${handoff.shell_section_id}`,
      category: "fixture_slot_projection",
      label: `Fixture slot projection for ${handoff.shell_section_id}`,
      observed: handoff.current_verdict === "pass" && Boolean(section) && Boolean(fixture) && fixture.allowed_methods?.includes("GET"),
      evidence_ref: fixture?.row_id ?? section?.row_id ?? handoff.row_id,
      fixture_slot_id: `fixture_slot.implementation_review.${handoff.shell_section_id}`,
      handoff_contract_ref: handoff.row_id,
      shell_section_ref: section?.row_id ?? null,
      fixture_fetch_ref: fixture?.row_id ?? null,
      fixture_state: fixture?.fixture_state ?? null,
      allowed_methods: ["GET", "HEAD"],
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

function buildBlockedStateCopySurfaceRows({ source, handoffRows, sectionRows, fixtureRows, generatedAt }) {
  const copySourceRows = Array.isArray(source.data?.visible_blocker_no_action_rows) ? source.data.visible_blocker_no_action_rows : [];
  return handoffRows.map((handoff, index) => {
    const section = sectionRows[index % Math.max(sectionRows.length, 1)];
    const fixture = fixtureRows[index % Math.max(fixtureRows.length, 1)];
    const copySource = copySourceRows[index % Math.max(copySourceRows.length, 1)];
    return row({
      row_id: `blocked_state_copy_surface.${handoff.shell_section_id}`,
      category: "blocked_state_copy_surface",
      label: `Blocked state copy surface for ${handoff.shell_section_id}`,
      observed: Boolean(handoff) && Boolean(section) && Boolean(fixture) && Boolean(copySource),
      evidence_ref: copySource?.row_id ?? fixture?.row_id ?? handoff.row_id,
      shell_section_ref: section?.row_id ?? null,
      fixture_slot_ref: fixture?.row_id ?? null,
      source_no_action_ref: copySource?.row_id ?? null,
      blocker_copy_ref: `copy.implementation_review.${handoff.shell_section_id}.blocker`,
      no_action_copy_ref: `copy.implementation_review.${handoff.shell_section_id}.no_action`,
      redaction_copy_ref: `copy.implementation_review.${handoff.shell_section_id}.redaction`,
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

function buildNoServeNoRenderAuthorityRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_serve_no_render.${flag}`,
    category: "no_serve_no_render_authority",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_boundary",
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
    && allPass(context.sectionRows)
    && allPass(context.fixtureRows)
    && allPass(context.copyRows)
    && allPass(context.authorityRows);
  return [
    ["source_ready", "P46400 source is ready for P46401", context.sourceState.sourceReady],
    ["static_shell_handoff_visible", "Static shell handoff contract rows are visible", allPass(context.handoffRows)],
    ["shell_section_binding_visible", "Shell section binding rows are visible", allPass(context.sectionRows)],
    ["fixture_slot_projection_visible", "Fixture slot projection rows are visible", allPass(context.fixtureRows)],
    ["blocked_state_copy_visible", "Blocked state copy rows are visible", allPass(context.copyRows)],
    ["no_serve_no_render_authority_closed", "No-serve/no-render authority remains closed", allPass(context.authorityRows)],
    ["p46801_handoff_gate", "P46801 handoff opens only when static shell handoff conditions pass", handoffReady],
    ["p46801_handoff_blocker_visible", "P46801 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p46800_checkpoint.${id}`,
    category: "p46800_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p46800_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p46800ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.handoffRows)
    && allPass(context.sectionRows)
    && allPass(context.fixtureRows)
    && allPass(context.copyRows)
    && allPass(context.authorityRows)
    && visibleOrPassed(context.checkpointRows, "p46800_checkpoint.p46801_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.handoffRows)
    && allPass(context.sectionRows)
    && allPass(context.fixtureRows)
    && allPass(context.copyRows)
    && allPass(context.authorityRows);
  return {
    p46800_contract_ready: p46800ContractReady,
    ready_for_p46801_handoff: handoffReady,
    source_p46400_ready_for_p46401_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    static_shell_handoff_contract_visible_now: allPass(context.handoffRows),
    shell_section_binding_map_visible_now: allPass(context.sectionRows),
    fixture_slot_projection_visible_now: allPass(context.fixtureRows),
    blocked_state_copy_surface_visible_now: allPass(context.copyRows),
    no_serve_no_render_authority_closed_now: allPass(context.authorityRows),
    static_shell_handoff_contract_count: context.handoffRows.length,
    shell_section_binding_map_count: context.sectionRows.length,
    fixture_slot_projection_count: context.fixtureRows.length,
    blocked_state_copy_surface_count: context.copyRows.length,
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
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P46401-P46800 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P46401-P46800 Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Handoff"), "Architecture doc missing P46401-P46800 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P46400 source state is not visible"),
    validationItem("static_shell.handoff", "static_shell", allPass(context.handoffRows), "Static shell handoff contract rows are incomplete"),
    validationItem("shell.section", "static_shell", allPass(context.sectionRows), "Shell section binding rows are incomplete"),
    validationItem("fixture.slot", "static_shell", allPass(context.fixtureRows), "Fixture slot projection rows are incomplete"),
    validationItem("blocked.copy", "static_shell", allPass(context.copyRows), "Blocked state copy rows are incomplete"),
    validationItem("boundary.no_serve_no_render", "authority", context.boundary.static_shell_server_start_allowed_now === false && context.boundary.static_shell_dom_render_allowed_now === false && context.boundary.static_shell_browser_run_allowed_now === false, "Static shell no-serve/no-render boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p46800_checkpoint.p46801_handoff_blocker_visible"), "P46800 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff.contract.v1",
    generated_at: generatedAt,
    source_p46400_required_or_rebuilt: true,
    static_shell_handoff_contract_required: true,
    shell_section_binding_map_required: true,
    fixture_slot_projection_required: true,
    blocked_state_copy_surface_required: true,
    no_serve_no_render_authority: true,
    p46801_handoff_is_not_server_route_dom_browser_action_write_approval_closeout_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p46801_handoff
    ? READY_STATUS
    : validation.valid && boundary.p46800_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_status: status,
    source_p46400_ready_for_p46401_handoff: boundary.source_p46400_ready_for_p46401_handoff,
    static_shell_handoff_contract_count: boundary.static_shell_handoff_contract_count,
    shell_section_binding_map_count: boundary.shell_section_binding_map_count,
    fixture_slot_projection_count: boundary.fixture_slot_projection_count,
    blocked_state_copy_surface_count: boundary.blocked_state_copy_surface_count,
    ready_for_p46801_handoff: validation.valid && boundary.ready_for_p46801_handoff,
    static_shell_server_start_allowed_now: false,
    static_shell_route_execution_allowed_now: false,
    static_shell_dom_render_allowed_now: false,
    static_shell_browser_run_allowed_now: false,
    static_shell_browser_smoke_allowed_now: false,
    static_shell_live_refresh_allowed_now: false,
    static_shell_network_fetch_allowed_now: false,
    static_shell_click_action_allowed_now: false,
    static_shell_write_allowed_now: false,
    static_shell_state_mutation_allowed_now: false,
    static_shell_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Handoff",
    "",
    `Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_handoff_status}`,
    `Program: ${result.program_range}`,
    `P46400 ready for P46401 handoff: ${result.summary.source_p46400_ready_for_p46401_handoff}`,
    `Static shell handoff rows: ${result.summary.static_shell_handoff_contract_count}`,
    `Shell section rows: ${result.summary.shell_section_binding_map_count}`,
    `Fixture projection rows: ${result.summary.fixture_slot_projection_count}`,
    `Ready for P46801 handoff: ${result.summary.ready_for_p46801_handoff}`,
    `Static shell server allowed: ${result.summary.static_shell_server_start_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.static_shell_handoff_contract_rows.map((item) => `<tr><td>${escapeHtml(item.shell_section_id)}</td><td>${escapeHtml(item.safe_dom_anchor)}</td><td>${escapeHtml(item.server_start_allowed_now)}</td><td>${escapeHtml(item.dom_render_allowed_now)}</td><td>${escapeHtml(item.browser_run_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Handoff</title>
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
    <h1>Hermes Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Handoff</h1>
    <p class="notice">This artifact defines static shell handoff metadata only. It does not start servers, register routes, render DOM, run browsers, fetch live data, click actions, mutate state, approve, close out, export, publish, or claim production readiness.</p>
    <table><thead><tr><th>Shell Section</th><th>Safe DOM Anchor</th><th>Server</th><th>DOM Render</th><th>Browser</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP46400(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewLocalUiBindingSmoke({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_local_ui_binding_smoke", built);
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
  const defaults = DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_HANDOFF_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_local_ui_binding_smoke_path: path.resolve(repoRoot, options.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewLocalUiBindingSmokePath ?? defaults.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewLocalUiBindingSmokePath),
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
      args.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewLocalUiBindingSmokePath = argv[++index];
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
  console.log(`Usage: node scripts/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-handoff.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P46401-P46800 Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Handoff.
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
