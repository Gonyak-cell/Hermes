import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P41200_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewUiHandoffBundle,
} from "./work-os-static-bundle-review-ui-implementation-review-ui-handoff-bundle.mjs";

export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_LOCAL_UI_BINDING_SMOKE_OUT_DIR = "artifacts/work-os-static-bundle-review-ui-implementation-review-local-ui-binding-smoke/latest";
export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_LOCAL_UI_BINDING_SMOKE_INPUTS = {
  schemaPath: "schemas/work-os-static-bundle-review-ui-implementation-review-local-ui-binding-smoke.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p41201-p41600.md",
  architectureDocPath: "docs/architecture.md",
  sourceWorkOsStaticBundleReviewUiImplementationReviewUiHandoffBundlePath: "artifacts/work-os-static-bundle-review-ui-implementation-review-ui-handoff-bundle/latest/work-os-static-bundle-review-ui-implementation-review-ui-handoff-bundle.json",
};

const COMMAND_NAME = "platform:work-os-static-bundle-review-ui-implementation-review-local-ui-binding-smoke";
const SCHEMA_VERSION = "work-os-static-bundle-review-ui-implementation-review-local-ui-binding-smoke.v1";
const CAPABILITY_ID = "platform.work_os_static_bundle_review_ui_implementation_review_local_ui_binding_smoke";
const PROGRAM_RANGE = "P41201-P41600";
const SOURCE_PROGRAM_RANGE = "P40801-P41200";
const READY_STATUS = "ready_for_work_os_static_bundle_review_ui_implementation_review_local_ui_binding_smoke";
const BLOCK_PENDING_STATUS = "valid_block_work_os_static_bundle_review_ui_implementation_review_local_ui_binding_smoke_pending";
const BLOCKED_STATUS = "blocked_work_os_static_bundle_review_ui_implementation_review_local_ui_binding_smoke";

const PHASE_SPECS = [
  ["P41201-P41240", "P41200 Source Binding", "p41200_source_binding_rows"],
  ["P41241-P41320", "Local UI Binding Smoke Contract", "local_ui_binding_smoke_rows"],
  ["P41321-P41380", "Static Shell Binding Map", "static_shell_binding_map_rows"],
  ["P41381-P41440", "GET-Only Fixture Fetch Contract", "get_only_fixture_fetch_contract_rows"],
  ["P41441-P41500", "Visible Blocker/No-Action Projection", "visible_blocker_no_action_rows"],
  ["P41501-P41560", "No-Server/No-Browser Boundary", "no_server_no_browser_boundary_rows"],
  ["P41561-P41600", "P41600 Clean Checkpoint", "p41600_clean_checkpoint_rows"],
];

const BINDING_SMOKE_SLOTS = [
  ["review_summary", "Implementation review summary shell slot"],
  ["finding_seed_list", "Finding seed list shell slot"],
  ["screen_package_detail", "Screen package detail shell slot"],
  ["route_contract_panel", "Route contract panel shell slot"],
  ["review_status_panel", "Review status panel shell slot"],
  ["blocker_notice_panel", "Blocker notice panel shell slot"],
  ["disabled_action_panel", "Disabled action panel shell slot"],
  ["no_receipt_accept_panel", "No receipt accept panel shell slot"],
];

export const LOCAL_UI_BINDING_FALSE_FLAGS = [
  "local_ui_server_start_allowed_now",
  "local_ui_route_registration_allowed_now",
  "local_ui_route_mount_allowed_now",
  "local_ui_route_execution_allowed_now",
  "local_ui_dom_render_allowed_now",
  "local_ui_browser_run_allowed_now",
  "local_ui_browser_smoke_allowed_now",
  "local_ui_live_refresh_allowed_now",
  "local_ui_network_fetch_allowed_now",
  "local_ui_click_action_allowed_now",
  "local_ui_keyboard_action_allowed_now",
  "local_ui_write_allowed_now",
  "local_ui_state_mutation_allowed_now",
  "local_ui_snapshot_capture_allowed_now",
  "local_ui_html_file_write_allowed_now",
  "local_ui_raw_payload_exposure_allowed_now",
  "local_ui_secret_exposure_allowed_now",
  "local_ui_command_button_enabled_now",
  "local_ui_approve_button_enabled_now",
  "local_ui_closeout_button_enabled_now",
  "local_ui_export_allowed_now",
  "local_ui_publish_allowed_now",
  "local_ui_final_approval_allowed_now",
  "local_ui_production_pass_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...LOCAL_UI_BINDING_FALSE_FLAGS, ...P41200_FALSE_FLAGS])];

export async function runWorkOsStaticBundleReviewUiImplementationReviewLocalUiBindingSmoke(options = {}) {
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewLocalUiBindingSmoke(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS Static Bundle Review UI Implementation Review Local UI Binding Smoke failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeWorkOsStaticBundleReviewUiImplementationReviewLocalUiBindingSmoke(result, result.output_dir);
  return result;
}

export async function buildWorkOsStaticBundleReviewUiImplementationReviewLocalUiBindingSmoke(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_LOCAL_UI_BINDING_SMOKE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "workOsStaticBundleReviewUiImplementationReviewUiHandoffBundle")
    ? normalizeInlineJsonSource("inline.work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle", options.workOsStaticBundleReviewUiImplementationReviewUiHandoffBundle)
    : await readJsonOrBuildP41200(inputs.source_work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const bindingRows = buildLocalUiBindingSmokeRows({ source, generatedAt });
  const shellRows = buildStaticShellBindingMapRows({ source, bindingRows, generatedAt });
  const fetchRows = buildGetOnlyFixtureFetchContractRows({ source, bindingRows, shellRows, generatedAt });
  const blockerRows = buildVisibleBlockerNoActionRows({ source, bindingRows, shellRows, fetchRows, generatedAt });
  const boundaryRows = buildNoServerNoBrowserBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, bindingRows, shellRows, fetchRows, blockerRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, bindingRows, shellRows, fetchRows, blockerRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, bindingRows, shellRows, fetchRows, blockerRows, boundaryRows, checkpointRows, boundary });
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
      work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle_summary: source.data?.summary ?? null,
    work_os_static_bundle_review_ui_implementation_review_local_ui_binding_smoke_contract: buildContract(generatedAt),
    work_os_static_bundle_review_ui_implementation_review_local_ui_binding_smoke_phase_rows: phaseRows,
    p41200_source_binding_rows: sourceRows,
    local_ui_binding_smoke_rows: bindingRows,
    static_shell_binding_map_rows: shellRows,
    get_only_fixture_fetch_contract_rows: fetchRows,
    visible_blocker_no_action_rows: blockerRows,
    no_server_no_browser_boundary_rows: boundaryRows,
    p41600_clean_checkpoint_rows: checkpointRows,
    work_os_static_bundle_review_ui_implementation_review_local_ui_binding_smoke_boundary: boundary,
    work_os_static_bundle_review_ui_implementation_review_local_ui_binding_smoke_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_static_bundle_review_ui_implementation_review_local_ui_binding_smoke")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.work_os_static_bundle_review_ui_implementation_review_local_ui_binding_smoke_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.work_os_static_bundle_review_ui_implementation_review_local_ui_binding_smoke_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeWorkOsStaticBundleReviewUiImplementationReviewLocalUiBindingSmoke(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-local-ui-binding-smoke.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p41200-source-binding-rows.json"), collectionEnvelope("p41200-source-binding-rows.v1", "p41200_source_binding_rows", result.p41200_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "local-ui-binding-smoke-rows.json"), collectionEnvelope("local-ui-binding-smoke-rows.v1", "local_ui_binding_smoke_rows", result.local_ui_binding_smoke_rows, result.generated_at));
  await writeJson(path.join(outDir, "static-shell-binding-map-rows.json"), collectionEnvelope("static-shell-binding-map-rows.v1", "static_shell_binding_map_rows", result.static_shell_binding_map_rows, result.generated_at));
  await writeJson(path.join(outDir, "get-only-fixture-fetch-contract-rows.json"), collectionEnvelope("get-only-fixture-fetch-contract-rows.v1", "get_only_fixture_fetch_contract_rows", result.get_only_fixture_fetch_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "visible-blocker-no-action-rows.json"), collectionEnvelope("visible-blocker-no-action-rows.v1", "visible_blocker_no_action_rows", result.visible_blocker_no_action_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-server-no-browser-boundary-rows.json"), collectionEnvelope("no-server-no-browser-boundary-rows.v1", "no_server_no_browser_boundary_rows", result.no_server_no_browser_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p41600-clean-checkpoint-rows.json"), collectionEnvelope("p41600-clean-checkpoint-rows.v1", "p41600_clean_checkpoint_rows", result.p41600_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-local-ui-binding-smoke-boundary.json"), result.work_os_static_bundle_review_ui_implementation_review_local_ui_binding_smoke_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runWorkOsStaticBundleReviewUiImplementationReviewLocalUiBindingSmokeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runWorkOsStaticBundleReviewUiImplementationReviewLocalUiBindingSmoke(args);
  console.log(`Work OS Static Bundle Review UI Implementation Review Local UI Binding Smoke ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_local_ui_binding_smoke_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P41200 ready for P41201 handoff: ${result.summary.source_p41200_ready_for_p41201_handoff}`);
  console.log(`Binding smoke rows: ${result.summary.local_ui_binding_smoke_count}`);
  console.log(`Static shell rows: ${result.summary.static_shell_binding_map_count}`);
  console.log(`GET-only fixture rows: ${result.summary.get_only_fixture_fetch_contract_count}`);
  console.log(`Ready for P41601 handoff: ${result.summary.ready_for_p41601_handoff}`);
  console.log(`Local UI server allowed: ${result.summary.local_ui_server_start_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.work_os_static_bundle_review_ui_implementation_review_ui_handoff_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle === true,
    status: summary.work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle_status ?? "missing",
    p41200ContractReady: boundary.p41200_contract_ready === true,
    uiHandoffBundleVisible: boundary.implementation_review_ui_handoff_manifest_visible_now === true,
    screenPackageVisible: boundary.implementation_review_read_only_screen_package_visible_now === true,
    handoffViewVisible: boundary.implementation_review_operator_handoff_view_visible_now === true,
    reviewAffordanceVisible: boundary.implementation_review_handoff_affordance_visibility_now === true,
    noServeNoRenderClosed: boundary.no_serve_no_receipt_accept_boundary_closed_now === true,
    boundaryClosed: P41200_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p41201-p41600.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P41200 implementation review UI handoff bundle source is available", sourceState.available],
    ["program_range", "P41200 source program range is P40801-P41200", sourceState.programRangeOk],
    ["validation_valid", "P41200 source validation is valid", sourceState.validationValid],
    ["p41201_handoff_open", "P41200 source opened P41201 handoff", sourceState.sourceReady],
    ["p41200_contract_ready", "P41200 source contract is ready", sourceState.p41200ContractReady],
    ["ui_handoff_bundle_visible", "P41200 UI handoff bundle rows are visible", sourceState.uiHandoffBundleVisible],
    ["screen_package_visible", "P41200 read-only screen package rows are visible", sourceState.screenPackageVisible],
    ["handoff_view_visible", "P41200 handoff view rows are visible", sourceState.handoffViewVisible],
    ["review_affordance_visible", "P41200 review affordance rows are visible", sourceState.reviewAffordanceVisible],
    ["no_serve_no_receipt_accept_closed", "P41200 no-serve/no-receipt-accept boundary is closed", sourceState.noServeNoRenderClosed],
    ["commit_ref_present", "Current commit ref is present for local UI binding smoke", Boolean(commitRef)],
    ["source_blocker_visible", "P41200 source blocker is visible when local UI binding is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p41200_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildLocalUiBindingSmokeRows({ source, generatedAt }) {
  const bundleRows = Array.isArray(source.data?.implementation_review_ui_handoff_manifest_rows) ? source.data.implementation_review_ui_handoff_manifest_rows : [];
  return BINDING_SMOKE_SLOTS.map(([slotId, label], index) => {
    const bundle = bundleRows[index % Math.max(bundleRows.length, 1)];
    return row({
      row_id: `local_ui_binding_smoke.${slotId}`,
      category: "local_ui_binding_smoke",
      label,
      observed: Boolean(bundle) && bundle.current_verdict === "pass" && bundle.manifest_visible_now === true,
      evidence_ref: bundle?.row_id ?? "implementation_review_ui_handoff_manifest_rows",
      binding_slot_id: slotId,
      source_bundle_ref: bundle?.row_id ?? null,
      source_collection: bundle?.source_collection ?? null,
      safe_dom_anchor: `#hermes-${slotId.replaceAll("_", "-")}`,
      local_fixture_ref: `fixtures.implementation_review.${slotId}`,
      visible_now: true,
      visible_when_blocked: true,
      read_only: true,
      server_start_allowed_now: false,
      route_registration_allowed_now: false,
      route_mount_allowed_now: false,
      route_execution_allowed_now: false,
      dom_render_allowed_now: false,
      browser_run_allowed_now: false,
      browser_smoke_allowed_now: false,
      network_fetch_allowed_now: false,
      click_action_allowed_now: false,
      keyboard_action_allowed_now: false,
      write_allowed_now: false,
      state_mutation_allowed_now: false,
      raw_payload_included: false,
      generated_at: generatedAt,
    });
  });
}

function buildStaticShellBindingMapRows({ source, bindingRows, generatedAt }) {
  const adapterRows = Array.isArray(source.data?.implementation_review_read_only_screen_package_rows) ? source.data.implementation_review_read_only_screen_package_rows : [];
  return bindingRows.map((binding, index) => {
    const adapter = adapterRows[index % Math.max(adapterRows.length, 1)];
    return row({
      row_id: `static_shell_binding_map.${binding.binding_slot_id}`,
      category: "static_shell_binding_map",
      label: `Static shell binding map for ${binding.binding_slot_id}`,
      observed: binding.current_verdict === "pass" && Boolean(adapter) && adapter.allowed_methods?.includes("GET"),
      evidence_ref: adapter?.row_id ?? binding.row_id,
      shell_slot_id: `shell.implementation_review.${binding.binding_slot_id}`,
      binding_slot_ref: binding.row_id,
      adapter_manifest_ref: adapter?.row_id ?? null,
      route_hint: adapter?.route_path ?? `/work-os/implementation-review/${binding.binding_slot_id}`,
      screen_package_ref: adapter?.screen_package_ref ?? null,
      screen_id: adapter?.screen_id ?? null,
      slot_id: adapter?.slot_id ?? null,
      safe_dom_anchor: binding.safe_dom_anchor,
      allowed_methods: ["GET", "HEAD"],
      static_shell_only: true,
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

function buildGetOnlyFixtureFetchContractRows({ source, bindingRows, shellRows, generatedAt }) {
  const viewRows = Array.isArray(source.data?.implementation_review_operator_handoff_view_rows) ? source.data.implementation_review_operator_handoff_view_rows : [];
  return bindingRows.map((binding, index) => {
    const shell = shellRows[index % Math.max(shellRows.length, 1)];
    const view = viewRows[index % Math.max(viewRows.length, 1)];
    return row({
      row_id: `get_only_fixture_fetch_contract.${binding.binding_slot_id}`,
      category: "get_only_fixture_fetch_contract",
      label: `GET-only fixture fetch contract for ${binding.binding_slot_id}`,
      observed: binding.current_verdict === "pass" && Boolean(shell) && Boolean(view),
      evidence_ref: view?.row_id ?? shell?.row_id ?? binding.row_id,
      fixture_fetch_id: `fixture_fetch.implementation_review.${binding.binding_slot_id}`,
      binding_slot_ref: binding.row_id,
      shell_binding_ref: shell?.row_id ?? null,
      handoff_view_ref: view?.row_id ?? null,
      fixture_state: view?.fixture_state ?? null,
      allowed_methods: ["GET", "HEAD"],
      mutating_methods_allowed_now: false,
      live_fetch_allowed_now: false,
      network_fetch_allowed_now: false,
      route_execution_allowed_now: false,
      raw_payload_included: false,
      secret_exposure_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildVisibleBlockerNoActionRows({ source, bindingRows, shellRows, fetchRows, generatedAt }) {
  const reviewRows = Array.isArray(source.data?.implementation_review_handoff_affordance_visibility_rows) ? source.data.implementation_review_handoff_affordance_visibility_rows : [];
  return BINDING_SMOKE_SLOTS.map(([slotId, label], index) => {
    const binding = bindingRows[index % Math.max(bindingRows.length, 1)];
    const shell = shellRows[index % Math.max(shellRows.length, 1)];
    const fetch = fetchRows[index % Math.max(fetchRows.length, 1)];
    const review = reviewRows[index % Math.max(reviewRows.length, 1)];
    return row({
      row_id: `visible_blocker_no_action.${slotId}`,
      category: "visible_blocker_no_action",
      label: `${label} blocker and no-action projection`,
      observed: Boolean(binding) && Boolean(shell) && Boolean(fetch) && Boolean(review),
      evidence_ref: review?.row_id ?? fetch?.row_id ?? binding?.row_id ?? "implementation_review_handoff_affordance_visibility_rows",
      binding_slot_ref: binding?.row_id ?? null,
      shell_binding_ref: shell?.row_id ?? null,
      fixture_fetch_ref: fetch?.row_id ?? null,
      review_affordance_ref: review?.row_id ?? null,
      visible_now: true,
      visible_when_blocked: true,
      blocker_visible_now: true,
      no_action_notice_visible_now: true,
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

function buildNoServerNoBrowserBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_server_no_browser.${flag}`,
    category: "no_server_no_browser_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "work_os_static_bundle_review_ui_implementation_review_local_ui_binding_smoke_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.bindingRows)
    && allPass(context.shellRows)
    && allPass(context.fetchRows)
    && allPass(context.blockerRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P41200 source is ready for P41201", context.sourceState.sourceReady],
    ["binding_smoke_visible", "Local UI binding smoke rows are visible", allPass(context.bindingRows)],
    ["static_shell_binding_visible", "Static shell binding map rows are visible", allPass(context.shellRows)],
    ["get_only_fixture_fetch_visible", "GET-only fixture fetch rows are visible", allPass(context.fetchRows)],
    ["visible_blocker_no_action_visible", "Visible blocker/no-action rows are visible", allPass(context.blockerRows)],
    ["no_server_no_browser_boundary_closed", "No-server/no-browser boundary remains closed", allPass(context.boundaryRows)],
    ["p41601_handoff_gate", "P41601 handoff opens only when local UI binding smoke conditions pass", handoffReady],
    ["p41601_handoff_blocker_visible", "P41601 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p41600_checkpoint.${id}`,
    category: "p41600_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p41600_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p41600ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.bindingRows)
    && allPass(context.shellRows)
    && allPass(context.fetchRows)
    && allPass(context.blockerRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p41600_checkpoint.p41601_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.bindingRows)
    && allPass(context.shellRows)
    && allPass(context.fetchRows)
    && allPass(context.blockerRows)
    && allPass(context.boundaryRows);
  return {
    p41600_contract_ready: p41600ContractReady,
    ready_for_p41601_handoff: handoffReady,
    source_p41200_ready_for_p41201_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    local_ui_binding_smoke_visible_now: allPass(context.bindingRows),
    static_shell_binding_map_visible_now: allPass(context.shellRows),
    get_only_fixture_fetch_contract_visible_now: allPass(context.fetchRows),
    visible_blocker_no_action_visible_now: allPass(context.blockerRows),
    no_server_no_browser_boundary_closed_now: allPass(context.boundaryRows),
    local_ui_binding_smoke_count: context.bindingRows.length,
    static_shell_binding_map_count: context.shellRows.length,
    get_only_fixture_fetch_contract_count: context.fetchRows.length,
    visible_blocker_no_action_count: context.blockerRows.length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
    deployment_allowed_now: false,
    release_approval_allowed_now: false,
    production_pass_enabled: false,
    enterprise_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    protected_closeout_enabled: false,
    final_automated_approval_allowed: false,
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P41201-P41600 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P41201-P41600 Work OS Static Bundle Review UI Implementation Review Local UI Binding Smoke"), "Architecture doc missing P41201-P41600 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P41200 source state is not visible"),
    validationItem("binding.smoke", "local_ui_binding", allPass(context.bindingRows), "Local UI binding smoke rows are incomplete"),
    validationItem("shell.binding", "local_ui_binding", allPass(context.shellRows), "Static shell binding map rows are incomplete"),
    validationItem("fixture.fetch", "local_ui_binding", allPass(context.fetchRows), "GET-only fixture fetch rows are incomplete"),
    validationItem("blocker.no_action", "local_ui_binding", allPass(context.blockerRows), "Visible blocker/no-action rows are incomplete"),
    validationItem("boundary.no_server_no_browser", "authority", context.boundary.local_ui_server_start_allowed_now === false && context.boundary.local_ui_dom_render_allowed_now === false && context.boundary.local_ui_browser_run_allowed_now === false, "Local UI no-server/no-browser boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p41600_checkpoint.p41601_handoff_blocker_visible"), "P41600 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "work_os_static_bundle_review_ui_implementation_review_local_ui_binding_smoke.contract.v1",
    generated_at: generatedAt,
    source_p41200_required_or_rebuilt: true,
    local_ui_binding_smoke_required: true,
    static_shell_binding_map_required: true,
    get_only_fixture_fetch_contract_required: true,
    visible_blocker_no_action_required: true,
    no_server_no_browser_authority: true,
    p41601_handoff_is_not_server_route_dom_browser_action_write_approval_closeout_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p41601_handoff
    ? READY_STATUS
    : validation.valid && boundary.p41600_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    work_os_static_bundle_review_ui_implementation_review_local_ui_binding_smoke_status: status,
    source_p41200_ready_for_p41201_handoff: boundary.source_p41200_ready_for_p41201_handoff,
    local_ui_binding_smoke_count: boundary.local_ui_binding_smoke_count,
    static_shell_binding_map_count: boundary.static_shell_binding_map_count,
    get_only_fixture_fetch_contract_count: boundary.get_only_fixture_fetch_contract_count,
    visible_blocker_no_action_count: boundary.visible_blocker_no_action_count,
    ready_for_p41601_handoff: validation.valid && boundary.ready_for_p41601_handoff,
    local_ui_server_start_allowed_now: false,
    local_ui_route_execution_allowed_now: false,
    local_ui_dom_render_allowed_now: false,
    local_ui_browser_run_allowed_now: false,
    local_ui_browser_smoke_allowed_now: false,
    local_ui_live_refresh_allowed_now: false,
    local_ui_network_fetch_allowed_now: false,
    local_ui_click_action_allowed_now: false,
    local_ui_write_allowed_now: false,
    local_ui_state_mutation_allowed_now: false,
    local_ui_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Work OS Static Bundle Review UI Implementation Review Local UI Binding Smoke",
    "",
    `Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_local_ui_binding_smoke_status}`,
    `Program: ${result.program_range}`,
    `P41200 ready for P41201 handoff: ${result.summary.source_p41200_ready_for_p41201_handoff}`,
    `Binding smoke rows: ${result.summary.local_ui_binding_smoke_count}`,
    `Static shell rows: ${result.summary.static_shell_binding_map_count}`,
    `GET-only fixture rows: ${result.summary.get_only_fixture_fetch_contract_count}`,
    `Ready for P41601 handoff: ${result.summary.ready_for_p41601_handoff}`,
    `Local UI server allowed: ${result.summary.local_ui_server_start_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.local_ui_binding_smoke_rows.map((item) => `<tr><td>${escapeHtml(item.binding_slot_id)}</td><td>${escapeHtml(item.safe_dom_anchor)}</td><td>${escapeHtml(item.server_start_allowed_now)}</td><td>${escapeHtml(item.dom_render_allowed_now)}</td><td>${escapeHtml(item.browser_run_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Work OS Static Bundle Review UI Implementation Review Local UI Binding Smoke</title>
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
    <h1>Hermes Work OS Static Bundle Review UI Implementation Review Local UI Binding Smoke</h1>
    <p class="notice">This artifact defines local UI binding smoke metadata only. It does not start servers, register routes, render DOM, run browsers, fetch live data, click actions, mutate state, approve, close out, export, publish, or claim production readiness.</p>
    <table><thead><tr><th>Binding Slot</th><th>Safe DOM Anchor</th><th>Server</th><th>DOM Render</th><th>Browser</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP41200(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildWorkOsStaticBundleReviewUiImplementationReviewUiHandoffBundle({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle", built);
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
  const defaults = DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_LOCAL_UI_BINDING_SMOKE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_work_os_static_bundle_review_ui_implementation_review_ui_handoff_bundle_path: path.resolve(repoRoot, options.sourceWorkOsStaticBundleReviewUiImplementationReviewUiHandoffBundlePath ?? defaults.sourceWorkOsStaticBundleReviewUiImplementationReviewUiHandoffBundlePath),
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
      args.sourceWorkOsStaticBundleReviewUiImplementationReviewUiHandoffBundlePath = argv[++index];
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
  console.log(`Usage: node scripts/work-os-static-bundle-review-ui-implementation-review-local-ui-binding-smoke.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P41201-P41600 Work OS Static Bundle Review UI Implementation Review Local UI Binding Smoke.
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
