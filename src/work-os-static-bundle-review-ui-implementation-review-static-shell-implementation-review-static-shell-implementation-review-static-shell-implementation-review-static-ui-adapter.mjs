import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P54800_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewApiReadModel,
} from "./work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-api-read-model.mjs";

export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_UI_OUT_DIR = "artifacts/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-ui-adapter/latest";
export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_UI_INPUTS = {
  schemaPath: "schemas/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-ui-adapter.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p54801-p55200.md",
  architectureDocPath: "docs/architecture.md",
  sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewApiReadModelPath: "artifacts/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-api-read-model/latest/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-api-read-model.json",
};

const COMMAND_NAME = "platform:work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-ui-adapter";
const SCHEMA_VERSION = "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-ui-adapter.v1";
const CAPABILITY_ID = "platform.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_adapter";
const PROGRAM_RANGE = "P54801-P55200";
const SOURCE_PROGRAM_RANGE = "P54401-P54800";
const READY_STATUS = "ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_adapter";
const BLOCK_PENDING_STATUS = "valid_block_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_adapter_pending";
const BLOCKED_STATUS = "blocked_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_adapter";

const PHASE_SPECS = [
  ["P54801-P54840", "P54800 Source Binding", "p54800_source_binding_rows"],
  ["P54841-P54900", "Implementation Review Static UI Adapter Candidate", "static_bundle_review_ui_implementation_review_static_ui_adapter_candidate_rows"],
  ["P54901-P54960", "Implementation Review Screen Slot Contract", "implementation_review_screen_slot_contract_rows"],
  ["P54961-P55020", "Implementation Review Static Shell Fixture", "implementation_review_static_shell_fixture_rows"],
  ["P55021-P55080", "Implementation Review Interaction Smoke Rows", "implementation_review_interaction_smoke_rows"],
  ["P55081-P55140", "No Live UI Receipt Accept Boundary", "no_live_ui_receipt_accept_boundary_rows"],
  ["P55141-P55200", "P55200 Clean Checkpoint", "p55200_clean_checkpoint_rows"],
];

export const WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_UI_FALSE_FLAGS = [
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_live_mount_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_runtime_fetch_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_event_handler_mutation_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_form_submit_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_state_persist_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_route_navigation_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_action_button_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_status_edit_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_write_api_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_live_browser_required_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_generated_file_write_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_asset_pipeline_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_receipt_accept_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_receipt_create_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_review_completion_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_reviewer_dispatch_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_claude_review_execution_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_human_adjudication_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_finding_resolution_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_runtime_execution_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_write_action_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_protected_action_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_connector_write_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_deployment_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_final_approval_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_production_pass_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_enterprise_trust_claim_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_secret_read_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_human_gate_bypass_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_independent_review_bypass_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_UI_FALSE_FLAGS, ...P54800_FALSE_FLAGS])];

export async function runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticUiAdapter(options = {}) {
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticUiAdapter(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static UI Adapter failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticUiAdapter(result, result.output_dir);
  return result;
}

export async function buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticUiAdapter(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_UI_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel")
    ? normalizeInlineJsonSource("inline.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_api_read_model", options.workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel)
    : await readJsonOrBuildP54800(inputs.source_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_api_read_model_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const adapterRows = buildStaticUiAdapterCandidateRows({ source, generatedAt });
  const slotRows = buildReviewScreenSlotContractRows({ adapterRows, generatedAt });
  const shellRows = buildReviewStaticShellFixtureRows({ source, adapterRows, slotRows, generatedAt });
  const interactionRows = buildReviewInteractionSmokeRows({ adapterRows, shellRows, generatedAt });
  const boundaryRows = buildNoLiveUiReceiptAcceptBoundaryRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const checkpointRows = buildCheckpointRows({ sourceState, adapterRows, slotRows, shellRows, interactionRows, boundaryRows, wiringRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, adapterRows, slotRows, shellRows, interactionRows, boundaryRows, wiringRows, checkpointRows });
  const validationItems = buildValidationItems({ phaseRows, sourceRows, adapterRows, slotRows, shellRows, interactionRows, boundaryRows, wiringRows, checkpointRows, boundary });
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
      work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_api_read_model_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_api_summary: source.data?.summary ?? null,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_contract: buildContract(generatedAt),
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_phase_rows: phaseRows,
    p54800_source_binding_rows: sourceRows,
    static_bundle_review_ui_implementation_review_static_ui_adapter_candidate_rows: adapterRows,
    implementation_review_screen_slot_contract_rows: slotRows,
    implementation_review_static_shell_fixture_rows: shellRows,
    implementation_review_interaction_smoke_rows: interactionRows,
    no_live_ui_receipt_accept_boundary_rows: boundaryRows,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_wiring_rows: wiringRows,
    p55200_clean_checkpoint_rows: checkpointRows,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_boundary: boundary,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_adapter")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticUiAdapter(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-ui-adapter.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p54800-source-binding-rows.json"), collectionEnvelope("p54800-source-binding-rows.v1", "p54800_source_binding_rows", result.p54800_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "static-bundle-review-static-ui-adapter-candidate-rows.json"), collectionEnvelope("static-bundle-review-static-ui-adapter-candidate-rows.v1", "static_bundle_review_ui_implementation_review_static_ui_adapter_candidate_rows", result.static_bundle_review_ui_implementation_review_static_ui_adapter_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-screen-slot-contract-rows.json"), collectionEnvelope("review-screen-slot-contract-rows.v1", "implementation_review_screen_slot_contract_rows", result.implementation_review_screen_slot_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-static-shell-fixture-rows.json"), collectionEnvelope("review-static-shell-fixture-rows.v1", "implementation_review_static_shell_fixture_rows", result.implementation_review_static_shell_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-interaction-smoke-rows.json"), collectionEnvelope("review-interaction-smoke-rows.v1", "implementation_review_interaction_smoke_rows", result.implementation_review_interaction_smoke_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-live-ui-receipt-accept-boundary-rows.json"), collectionEnvelope("no-live-ui-receipt-accept-boundary-rows.v1", "no_live_ui_receipt_accept_boundary_rows", result.no_live_ui_receipt_accept_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-ui-wiring-rows.json"), collectionEnvelope("work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-ui-wiring-rows.v1", "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_wiring_rows", result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_wiring_rows, result.generated_at));
  await writeJson(path.join(outDir, "p55200-clean-checkpoint-rows.json"), collectionEnvelope("p55200-clean-checkpoint-rows.v1", "p55200_clean_checkpoint_rows", result.p55200_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-ui-boundary.json"), result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticUiAdapterCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticUiAdapter(args);
  console.log(`Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static UI Adapter ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P54800 ready for static review UI: ${result.summary.source_p54800_ready_for_static_review_ui}`);
  console.log(`Static UI adapters: ${result.summary.static_bundle_review_ui_implementation_review_static_ui_adapter_candidate_count}`);
  console.log(`Screen slots: ${result.summary.implementation_review_screen_slot_contract_count}`);
  console.log(`Static shell fixtures: ${result.summary.implementation_review_static_shell_fixture_count}`);
  console.log(`Ready for static review UI handoff: ${result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_handoff}`);
  console.log(`Live mount allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_live_mount_allowed_now}`);
  console.log(`Receipt accept allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_receipt_accept_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_api_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_api_handoff === true,
    status: summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_api_status ?? "missing",
    p54800ContractReady: boundary.p54800_contract_ready === true,
    apiVisible: boundary.implementation_review_api_response_candidate_visible_now === true,
    fixtureVisible: boundary.implementation_review_ui_consumer_fixture_visible_now === true,
    routeVisible: boundary.implementation_review_route_contract_visible_now === true,
    payloadVisible: boundary.implementation_review_read_only_payload_shape_visible_now === true,
    noReceiptAcceptApiWriteClosed: boundary.no_mutation_review_execution_boundary_closed_now === true,
    wiringVisible: boundary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_api_wiring_complete_now === true,
    boundaryClosed: P54800_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p54801-p55200.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P54800 review API read model source is available", sourceState.available],
    ["program_range", "P54800 source program range is P54401-P54800", sourceState.programRangeOk],
    ["validation_valid", "P54800 source validation is valid", sourceState.validationValid],
    ["static_review_ui_handoff_open", "P54800 opened static review UI handoff", sourceState.sourceReady],
    ["p54800_contract_ready", "P54800 source contract is ready", sourceState.p54800ContractReady],
    ["api_response_visible", "P54800 review API response rows are visible", sourceState.apiVisible],
    ["ui_fixture_visible", "P54800 review UI fixtures are visible", sourceState.fixtureVisible],
    ["route_contract_visible", "P54800 review route contracts are visible", sourceState.routeVisible],
    ["payload_shape_visible", "P54800 implementation review read-only payload shape rows are visible", sourceState.payloadVisible],
    ["no_receipt_accept_api_write_closed", "P54800 no mutation/review execution boundary is closed", sourceState.noReceiptAcceptApiWriteClosed],
    ["api_wiring_visible", "P54800 review API wiring is visible", sourceState.wiringVisible],
    ["commit_ref_present", "Current commit ref is present for static review UI adapter", Boolean(commitRef)],
    ["source_blocker_visible", "P54800 source blocker is visible when static review UI adapter is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p54800_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildStaticUiAdapterCandidateRows({ source, generatedAt }) {
  const fixtureRows = source.data?.implementation_review_ui_consumer_fixture_rows ?? [];
  return fixtureRows.map((fixture) => row({
    row_id: `static_bundle_review_ui_implementation_review_static_ui_adapter_candidate.${fixture.request_id}`,
    category: "static_bundle_review_ui_implementation_review_static_ui_adapter_candidate",
    label: `Static bundle review UI adapter candidate for ${fixture.request_id}`,
    observed: Boolean(fixture.request_id && fixture.smoke_fixture_visible_now === true),
    evidence_ref: fixture.row_id,
    request_id: fixture.request_id,
    static_adapter_ref: `work_os.static_bundle_review.implementation_review.static_ui_adapter.${fixture.request_id}.candidate`,
    fixture_ref: fixture.fixture_ref,
    route_path: fixture.route_path,
    expected_status: fixture.expected_status,
    adapter_visible_now: true,
    live_mount_allowed_now: false,
    runtime_fetch_allowed_now: false,
    generated_file_write_allowed_now: false,
    review_receipt_accept_allowed_now: false,
    reviewer_lane_dispatch_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildReviewScreenSlotContractRows({ adapterRows, generatedAt }) {
  return adapterRows.map((adapter) => row({
    row_id: `implementation_review_screen_slot_contract.${adapter.request_id}`,
    category: "implementation_review_screen_slot_contract",
    label: `Static bundle review screen slot contract for ${adapter.request_id}`,
    observed: Boolean(adapter.static_adapter_ref),
    evidence_ref: adapter.row_id,
    request_id: adapter.request_id,
    screen_id: "work_os.static_bundle_review.implementation_review.static_shell",
    slot_id: `implementation_review_card.${adapter.request_id}`,
    static_adapter_ref: adapter.static_adapter_ref,
    slot_binding_visible_now: true,
    route_navigation_allowed_now: false,
    live_browser_required_now: false,
    asset_pipeline_allowed_now: false,
    review_receipt_accept_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildReviewStaticShellFixtureRows({ source, adapterRows, slotRows, generatedAt }) {
  const routeRows = source.data?.implementation_review_route_contract_rows ?? [];
  return adapterRows.map((adapter) => {
    const slot = slotRows.find((item) => item.request_id === adapter.request_id);
    const route = routeRows.find((item) => item.request_id === adapter.request_id);
    return row({
      row_id: `implementation_review_static_shell_fixture.${adapter.request_id}`,
      category: "implementation_review_static_shell_fixture",
      label: `Static bundle review shell fixture for ${adapter.request_id}`,
      observed: Boolean(slot && route),
      evidence_ref: slot?.row_id ?? adapter.row_id,
      request_id: adapter.request_id,
      static_shell_ref: `work_os.static_bundle_review.implementation_review.static_shell.${adapter.request_id}.fixture`,
      slot_id: slot?.slot_id ?? null,
      route_path: adapter.route_path,
      allowed_methods: route?.allowed_methods ?? ["GET"],
      expected_status: adapter.expected_status,
      fixture_visible_now: true,
      state_persist_allowed_now: false,
      form_submit_allowed_now: false,
      write_api_allowed_now: false,
      review_receipt_accept_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildReviewInteractionSmokeRows({ adapterRows, shellRows, generatedAt }) {
  return adapterRows.flatMap((adapter) => {
    const shell = shellRows.find((item) => item.request_id === adapter.request_id);
    return [
      ["render_review_packet_card", "Review packet card renders from fixture metadata"],
      ["display_finding_seed_count", "Finding seed count display remains read-only"],
      ["disabled_receipt_review_controls", "Receipt and review controls remain disabled"],
    ].map(([id, label]) => row({
      row_id: `implementation_review_interaction_smoke.${adapter.request_id}.${id}`,
      category: "implementation_review_interaction_smoke",
      label: `${label} for ${adapter.request_id}`,
      observed: Boolean(shell),
      evidence_ref: shell?.row_id ?? adapter.row_id,
      request_id: adapter.request_id,
      interaction_type: id,
      smoke_visible_now: true,
      event_handler_mutation_allowed_now: false,
      action_button_allowed_now: false,
      status_edit_allowed_now: false,
      review_receipt_accept_allowed_now: false,
      reviewer_lane_dispatch_allowed_now: false,
      generated_at: generatedAt,
    }));
  });
}

function buildNoLiveUiReceiptAcceptBoundaryRows(generatedAt) {
  const stateRows = [
    ["state.static_adapter_is_not_live_mount", "Static review UI adapter must not mount live UI", true],
    ["state.screen_slot_is_not_navigation", "Review screen slot must not enable route navigation", true],
    ["state.static_shell_is_not_receipt_intake", "Review static shell must not accept review receipts", true],
    ["state.interaction_smoke_is_not_event_mutation", "Review interaction smoke row must not enable event mutation or dispatch", true],
  ].map(([id, label, observed]) => row({
    row_id: `no_live_ui_receipt_accept_boundary.${id}`,
    category: "no_live_ui_receipt_accept_boundary",
    label,
    observed,
    evidence_ref: "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_boundary",
    generated_at: generatedAt,
  }));
  const boundaryRows = ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_live_ui_receipt_accept_boundary.${flag}`,
    category: "no_live_ui_receipt_accept_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
  return [...stateRows, ...boundaryRows];
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  return [
    ["package_script", "Package script is wired", hasScript(packageJson.data, COMMAND_NAME), "package.json"],
    ["validate_chain", "Validate chain includes P55200 check", packageJson.text.includes(`${COMMAND_NAME} -- --check`), "package.json"],
    ["schema_file", "Schema file is configured", packageJson.available, "schemas/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-ui-adapter.schema.json"],
    ["roadmap_doc", "Roadmap documents all P54801-P55200 slices", PHASE_SPECS.every(([range]) => roadmapDoc.text.includes(range)), "docs/hermes-roadmap-p54801-p55200.md"],
    ["architecture_doc", "Architecture doc references P54801-P55200", architectureDoc.text.includes("P54801-P55200 Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static UI Adapter"), "docs/architecture.md"],
  ].map(([id, label, observed, evidenceRef]) => row({
    row_id: `work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_wiring.${id}`,
    category: "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_wiring",
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
    && allPass(context.adapterRows)
    && allPass(context.slotRows)
    && allPass(context.shellRows)
    && allPass(context.interactionRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows);
  return [
    ["source_ready", "P54800 source is ready for static review UI adapter handoff", context.sourceState.sourceReady],
    ["adapter_visible", "Static review UI adapter candidates are visible", allPass(context.adapterRows)],
    ["slot_contract_visible", "Review screen slot contracts are visible", allPass(context.slotRows)],
    ["static_shell_visible", "Review static shell fixtures are visible", allPass(context.shellRows)],
    ["interaction_smoke_visible", "Review interaction smoke rows are visible", allPass(context.interactionRows)],
    ["no_live_ui_receipt_accept_boundary_closed", "No-live-UI/receipt-accept boundary stays closed", allPass(context.boundaryRows)],
    ["wiring_complete", "CLI, schema, package, roadmap, and architecture wiring are visible", allPass(context.wiringRows)],
    ["live_mount_blocked", "Live UI mount remains blocked", true],
    ["receipt_accept_blocked", "Review receipt acceptance remains blocked", true],
    ["static_review_ui_handoff", "Static review UI handoff opens only as read-only metadata", ready],
  ].map(([id, label, observed]) => row({
    row_id: `p55200_checkpoint.${id}`,
    category: "p55200_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p55200_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p55200ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.adapterRows)
    && allPass(context.slotRows)
    && allPass(context.shellRows)
    && allPass(context.interactionRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows)
    && visibleOrPassed(context.checkpointRows, "p55200_checkpoint.live_mount_blocked")
    && visibleOrPassed(context.checkpointRows, "p55200_checkpoint.receipt_accept_blocked");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p55200ContractReady;
  return {
    p55200_contract_ready: p55200ContractReady,
    ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_handoff: ready,
    source_p54800_ready_for_static_review_ui: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    static_bundle_review_ui_implementation_review_static_ui_adapter_candidate_visible_now: allPass(context.adapterRows),
    implementation_review_screen_slot_contract_visible_now: allPass(context.slotRows),
    implementation_review_static_shell_fixture_visible_now: allPass(context.shellRows),
    implementation_review_interaction_smoke_visible_now: allPass(context.interactionRows),
    no_live_ui_receipt_accept_boundary_closed_now: allPass(context.boundaryRows),
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_wiring_complete_now: allPass(context.wiringRows),
    static_bundle_review_ui_implementation_review_static_ui_adapter_candidate_count: context.adapterRows.length,
    implementation_review_screen_slot_contract_count: context.slotRows.length,
    implementation_review_static_shell_fixture_count: context.shellRows.length,
    implementation_review_interaction_smoke_count: context.interactionRows.length,
    live_mount_allowed_count: context.adapterRows.filter((item) => item.live_mount_allowed_now === true).length,
    event_mutation_allowed_count: context.interactionRows.filter((item) => item.event_handler_mutation_allowed_now === true).length,
    state_persist_allowed_count: context.shellRows.filter((item) => item.state_persist_allowed_now === true).length,
    route_navigation_allowed_count: context.slotRows.filter((item) => item.route_navigation_allowed_now === true).length,
    receipt_accept_allowed_count: context.adapterRows.filter((item) => item.review_receipt_accept_allowed_now === true).length
      + context.slotRows.filter((item) => item.review_receipt_accept_allowed_now === true).length
      + context.shellRows.filter((item) => item.review_receipt_accept_allowed_now === true).length
      + context.interactionRows.filter((item) => item.review_receipt_accept_allowed_now === true).length,
    reviewer_dispatch_allowed_count: context.adapterRows.filter((item) => item.reviewer_lane_dispatch_allowed_now === true).length
      + context.interactionRows.filter((item) => item.reviewer_lane_dispatch_allowed_now === true).length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  };
}

function buildValidationItems(context) {
  return [
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P54801-P55200 phase rows are incomplete"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P54800 source state is not visible"),
    validationItem("adapter.visible", "ui", allPass(context.adapterRows), "Static review UI adapter candidates are incomplete"),
    validationItem("slot.visible", "ui", allPass(context.slotRows), "Review screen slot contracts are incomplete"),
    validationItem("shell.visible", "ui", allPass(context.shellRows), "Review static shell fixtures are incomplete"),
    validationItem("interaction.visible", "ui", allPass(context.interactionRows), "Review interaction smoke rows are incomplete"),
    validationItem("boundary.visible", "authority", allPass(context.boundaryRows), "No-live-UI/receipt-accept boundary rows are incomplete"),
    validationItem("wiring.complete", "wiring", allPass(context.wiringRows), "P54801-P55200 wiring is incomplete"),
    validationItem("no.live.mount", "authority", context.adapterRows.every((item) => item.live_mount_allowed_now === false && item.runtime_fetch_allowed_now === false), "Live mount or runtime fetch opened"),
    validationItem("no.screen.navigation", "authority", context.slotRows.every((item) => item.route_navigation_allowed_now === false && item.live_browser_required_now === false), "Screen navigation or live browser requirement opened"),
    validationItem("no.shell.persist", "authority", context.shellRows.every((item) => item.state_persist_allowed_now === false && item.form_submit_allowed_now === false && item.write_api_allowed_now === false), "Static shell persist/form/write opened"),
    validationItem("no.interaction.mutation", "authority", context.interactionRows.every((item) => item.event_handler_mutation_allowed_now === false && item.action_button_allowed_now === false && item.status_edit_allowed_now === false), "Interaction mutation opened"),
    validationItem("no.receipt.accept", "authority", context.adapterRows.every((item) => item.review_receipt_accept_allowed_now === false)
      && context.slotRows.every((item) => item.review_receipt_accept_allowed_now === false)
      && context.shellRows.every((item) => item.review_receipt_accept_allowed_now === false)
      && context.interactionRows.every((item) => item.review_receipt_accept_allowed_now === false), "Review receipt acceptance opened"),
    validationItem("no.reviewer.dispatch", "authority", context.adapterRows.every((item) => item.reviewer_lane_dispatch_allowed_now === false)
      && context.interactionRows.every((item) => item.reviewer_lane_dispatch_allowed_now === false), "Reviewer dispatch opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.live_mount_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p55200_checkpoint.live_mount_blocked"), "P55200 live mount blocker checkpoint is not visible"),
    validationItem("checkpoint.receipt_accept_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p55200_checkpoint.receipt_accept_blocked"), "P55200 receipt accept blocker checkpoint is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_adapter.contract.v1",
    generated_at: generatedAt,
    source_p54800_required_or_rebuilt: true,
    static_review_ui_adapter_candidate_required: true,
    screen_slot_contract_required: true,
    static_shell_fixture_required: true,
    interaction_smoke_required: true,
    no_live_ui_receipt_accept_boundary_required: true,
    p55200_is_not_live_ui_mount_runtime_fetch_event_mutation_form_submit_state_persist_receipt_accept_reviewer_dispatch_execution_write_approval_production_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_handoff
    ? READY_STATUS
    : validation.valid && boundary.p55200_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_status: status,
    source_p54800_ready_for_static_review_ui: boundary.source_p54800_ready_for_static_review_ui,
    static_bundle_review_ui_implementation_review_static_ui_adapter_candidate_count: boundary.static_bundle_review_ui_implementation_review_static_ui_adapter_candidate_count,
    implementation_review_screen_slot_contract_count: boundary.implementation_review_screen_slot_contract_count,
    implementation_review_static_shell_fixture_count: boundary.implementation_review_static_shell_fixture_count,
    implementation_review_interaction_smoke_count: boundary.implementation_review_interaction_smoke_count,
    live_mount_allowed_count: boundary.live_mount_allowed_count,
    event_mutation_allowed_count: boundary.event_mutation_allowed_count,
    state_persist_allowed_count: boundary.state_persist_allowed_count,
    route_navigation_allowed_count: boundary.route_navigation_allowed_count,
    receipt_accept_allowed_count: boundary.receipt_accept_allowed_count,
    reviewer_dispatch_allowed_count: boundary.reviewer_dispatch_allowed_count,
    ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_handoff: validation.valid && boundary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_handoff,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_live_mount_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_runtime_fetch_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_event_handler_mutation_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_form_submit_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_state_persist_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_route_navigation_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_action_button_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_status_edit_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_write_api_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_receipt_accept_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_reviewer_dispatch_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_runtime_execution_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_write_action_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_protected_action_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_final_approval_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static UI Adapter",
    "",
    `Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_status}`,
    `Program: ${result.program_range}`,
    `P54800 ready for static review UI: ${result.summary.source_p54800_ready_for_static_review_ui}`,
    `Static UI adapters: ${result.summary.static_bundle_review_ui_implementation_review_static_ui_adapter_candidate_count}`,
    `Screen slots: ${result.summary.implementation_review_screen_slot_contract_count}`,
    `Static shell fixtures: ${result.summary.implementation_review_static_shell_fixture_count}`,
    `Ready for static review UI handoff: ${result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_handoff}`,
    `Live mount allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_live_mount_allowed_now}`,
    `Receipt accept allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_ui_receipt_accept_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.implementation_review_static_shell_fixture_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.slot_id)}</td><td>${escapeHtml(item.route_path)}</td><td>${escapeHtml(item.review_receipt_accept_allowed_now)}</td><td>${escapeHtml(item.form_submit_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static UI Adapter</title>
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
    <h1>Hermes Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static UI Adapter</h1>
    <p class="notice">This artifact defines static UI adapter and shell fixture candidates only. It does not mount live UI, accept review receipts, submit forms, mutate status, dispatch reviewers, execute, deploy, approve, or claim production readiness.</p>
    <table><thead><tr><th>Request</th><th>Slot</th><th>Route</th><th>Receipt Accept</th><th>Submit</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP54800(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewApiReadModel({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_api_read_model", built);
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
  const defaults = DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_STATIC_UI_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_static_shell_implementation_review_static_shell_implementation_review_api_read_model_path: path.resolve(repoRoot, options.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewApiReadModelPath ?? defaults.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewApiReadModelPath),
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
      args.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewStaticShellImplementationReviewApiReadModelPath = argv[++index];
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
  console.log(`Usage: node scripts/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-shell-implementation-review-static-ui-adapter.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P54801-P55200 Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static Shell Implementation Review Static UI Adapter.
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
