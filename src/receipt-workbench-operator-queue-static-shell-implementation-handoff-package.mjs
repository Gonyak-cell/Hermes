import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P30800_FALSE_FLAGS,
  buildReceiptWorkbenchOperatorQueueStaticShellImplementationBindingCandidate,
} from "./receipt-workbench-operator-queue-static-shell-implementation-binding-candidate.mjs";

export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_STATIC_SHELL_IMPLEMENTATION_HANDOFF_PACKAGE_OUT_DIR = "artifacts/receipt-workbench-operator-queue-static-shell-implementation-handoff-package/latest";
export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_STATIC_SHELL_IMPLEMENTATION_HANDOFF_PACKAGE_INPUTS = {
  schemaPath: "schemas/receipt-workbench-operator-queue-static-shell-implementation-handoff-package.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p30801-p31200.md",
  architectureDocPath: "docs/architecture.md",
  sourceReceiptWorkbenchOperatorQueueStaticShellImplementationBindingCandidatePath: "artifacts/receipt-workbench-operator-queue-static-shell-implementation-binding-candidate/latest/receipt-workbench-operator-queue-static-shell-implementation-binding-candidate.json",
};

const COMMAND_NAME = "platform:receipt-workbench-operator-queue-static-shell-implementation-handoff-package";
const SCHEMA_VERSION = "receipt-workbench-operator-queue-static-shell-implementation-handoff-package.v1";
const CAPABILITY_ID = "platform.receipt_workbench_operator_queue_static_shell_implementation_handoff_package";
const PROGRAM_RANGE = "P30801-P31200";
const SOURCE_PROGRAM_RANGE = "P30401-P30800";
const READY_STATUS = "ready_for_receipt_workbench_operator_queue_static_shell_implementation_handoff_package";
const BLOCK_PENDING_STATUS = "valid_block_receipt_workbench_operator_queue_static_shell_implementation_handoff_package_pending";
const BLOCKED_STATUS = "blocked_receipt_workbench_operator_queue_static_shell_implementation_handoff_package";

const PHASE_SPECS = [
  ["P30801-P30840", "P30800 Source Binding", "p30800_source_binding_rows"],
  ["P30841-P30920", "Handoff Package Candidate", "handoff_package_candidate_rows"],
  ["P30921-P31000", "Implementation File Manifest Candidate", "implementation_file_manifest_candidate_rows"],
  ["P31001-P31080", "Fixture/Smoke Plan Candidate", "fixture_smoke_plan_candidate_rows"],
  ["P31081-P31140", "Reviewer Handoff Note Candidate", "reviewer_handoff_note_candidate_rows"],
  ["P31141-P31180", "No-Implementation Boundary", "no_implementation_boundary_rows"],
  ["P31181-P31200", "P31200 Clean Checkpoint", "p31200_clean_checkpoint_rows"],
];

export const STATIC_SHELL_IMPLEMENTATION_HANDOFF_PACKAGE_FALSE_FLAGS = [
  "static_shell_implementation_handoff_package_file_create_allowed_now",
  "static_shell_implementation_handoff_package_file_write_allowed_now",
  "static_shell_implementation_handoff_package_template_apply_allowed_now",
  "static_shell_implementation_handoff_package_template_write_allowed_now",
  "static_shell_implementation_handoff_package_component_write_allowed_now",
  "static_shell_implementation_handoff_package_fixture_execution_allowed_now",
  "static_shell_implementation_handoff_package_css_write_allowed_now",
  "static_shell_implementation_handoff_package_asset_import_allowed_now",
  "static_shell_implementation_handoff_package_asset_build_allowed_now",
  "static_shell_implementation_handoff_package_build_allowed_now",
  "static_shell_implementation_handoff_package_server_start_allowed_now",
  "static_shell_implementation_handoff_package_route_registration_allowed_now",
  "static_shell_implementation_handoff_package_route_mount_allowed_now",
  "static_shell_implementation_handoff_package_route_execution_allowed_now",
  "static_shell_implementation_handoff_package_dom_render_allowed_now",
  "static_shell_implementation_handoff_package_browser_run_allowed_now",
  "static_shell_implementation_handoff_package_browser_smoke_allowed_now",
  "static_shell_implementation_handoff_package_visual_smoke_execution_allowed_now",
  "static_shell_implementation_handoff_package_screenshot_capture_allowed_now",
  "static_shell_implementation_handoff_package_client_hydration_allowed_now",
  "static_shell_implementation_handoff_package_live_refresh_allowed_now",
  "static_shell_implementation_handoff_package_network_fetch_allowed_now",
  "static_shell_implementation_handoff_package_click_action_allowed_now",
  "static_shell_implementation_handoff_package_keyboard_action_allowed_now",
  "static_shell_implementation_handoff_package_command_button_enabled_now",
  "static_shell_implementation_handoff_package_approve_button_enabled_now",
  "static_shell_implementation_handoff_package_closeout_button_enabled_now",
  "static_shell_implementation_handoff_package_state_mutation_allowed_now",
  "static_shell_implementation_handoff_package_write_allowed_now",
  "static_shell_implementation_handoff_package_html_file_write_allowed_now",
  "static_shell_implementation_handoff_package_raw_payload_exposure_allowed_now",
  "static_shell_implementation_handoff_package_secret_exposure_allowed_now",
  "static_shell_implementation_handoff_package_export_allowed_now",
  "static_shell_implementation_handoff_package_publish_allowed_now",
  "static_shell_implementation_handoff_package_review_completion_allowed_now",
  "static_shell_implementation_handoff_package_final_approval_allowed_now",
  "static_shell_implementation_handoff_package_production_pass_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...STATIC_SHELL_IMPLEMENTATION_HANDOFF_PACKAGE_FALSE_FLAGS, ...P30800_FALSE_FLAGS])];

export async function runReceiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackage(options = {}) {
  const result = await buildReceiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackage(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Receipt Workbench Operator Queue Static Shell Implementation Handoff Package failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeReceiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackage(result, result.output_dir);
  return result;
}

export async function buildReceiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackage(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_STATIC_SHELL_IMPLEMENTATION_HANDOFF_PACKAGE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "receiptWorkbenchOperatorQueueStaticShellImplementationBindingCandidate")
    ? normalizeInlineJsonSource("inline.receipt_workbench_operator_queue_static_shell_implementation_binding_candidate", options.receiptWorkbenchOperatorQueueStaticShellImplementationBindingCandidate)
    : await readJsonOrBuildP30800(inputs.source_receipt_workbench_operator_queue_static_shell_implementation_binding_candidate_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const handoffRows = buildHandoffPackageCandidateRows({ source, generatedAt });
  const manifestRows = buildImplementationFileManifestCandidateRows({ source, handoffRows, generatedAt });
  const smokeRows = buildFixtureSmokePlanCandidateRows({ source, handoffRows, manifestRows, generatedAt });
  const reviewerRows = buildReviewerHandoffNoteCandidateRows({ source, handoffRows, manifestRows, smokeRows, generatedAt });
  const boundaryRows = buildNoImplementationBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, handoffRows, manifestRows, smokeRows, reviewerRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, handoffRows, manifestRows, smokeRows, reviewerRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, handoffRows, manifestRows, smokeRows, reviewerRows, boundaryRows, checkpointRows, boundary });
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
      receipt_workbench_operator_queue_static_shell_implementation_binding_candidate_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_receipt_workbench_operator_queue_static_shell_implementation_binding_candidate_summary: source.data?.summary ?? null,
    receipt_workbench_operator_queue_static_shell_implementation_handoff_package_contract: buildContract(generatedAt),
    receipt_workbench_operator_queue_static_shell_implementation_handoff_package_phase_rows: phaseRows,
    p30800_source_binding_rows: sourceRows,
    handoff_package_candidate_rows: handoffRows,
    implementation_file_manifest_candidate_rows: manifestRows,
    fixture_smoke_plan_candidate_rows: smokeRows,
    reviewer_handoff_note_candidate_rows: reviewerRows,
    no_implementation_boundary_rows: boundaryRows,
    p31200_clean_checkpoint_rows: checkpointRows,
    receipt_workbench_operator_queue_static_shell_implementation_handoff_package_boundary: boundary,
    receipt_workbench_operator_queue_static_shell_implementation_handoff_package_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "receipt_workbench_operator_queue_static_shell_implementation_handoff_package")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.receipt_workbench_operator_queue_static_shell_implementation_handoff_package_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.receipt_workbench_operator_queue_static_shell_implementation_handoff_package_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeReceiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackage(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "receipt-workbench-operator-queue-static-shell-implementation-handoff-package.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p30800-source-binding-rows.json"), collectionEnvelope("p30800-source-binding-rows.v1", "p30800_source_binding_rows", result.p30800_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "handoff-package-candidate-rows.json"), collectionEnvelope("handoff-package-candidate-rows.v1", "handoff_package_candidate_rows", result.handoff_package_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "implementation-file-manifest-candidate-rows.json"), collectionEnvelope("implementation-file-manifest-candidate-rows.v1", "implementation_file_manifest_candidate_rows", result.implementation_file_manifest_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "fixture-smoke-plan-candidate-rows.json"), collectionEnvelope("fixture-smoke-plan-candidate-rows.v1", "fixture_smoke_plan_candidate_rows", result.fixture_smoke_plan_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "reviewer-handoff-note-candidate-rows.json"), collectionEnvelope("reviewer-handoff-note-candidate-rows.v1", "reviewer_handoff_note_candidate_rows", result.reviewer_handoff_note_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-implementation-boundary-rows.json"), collectionEnvelope("no-implementation-boundary-rows.v1", "no_implementation_boundary_rows", result.no_implementation_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p31200-clean-checkpoint-rows.json"), collectionEnvelope("p31200-clean-checkpoint-rows.v1", "p31200_clean_checkpoint_rows", result.p31200_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-workbench-operator-queue-static-shell-implementation-handoff-package-boundary.json"), result.receipt_workbench_operator_queue_static_shell_implementation_handoff_package_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runReceiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackageCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runReceiptWorkbenchOperatorQueueStaticShellImplementationHandoffPackage(args);
  console.log(`Receipt Workbench Operator Queue Static Shell Implementation Handoff Package ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.receipt_workbench_operator_queue_static_shell_implementation_handoff_package_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P30800 ready for P30801 handoff: ${result.summary.source_p30800_ready_for_p30801_handoff}`);
  console.log(`Handoff package rows: ${result.summary.handoff_package_candidate_count}`);
  console.log(`Manifest rows: ${result.summary.implementation_file_manifest_candidate_count}`);
  console.log(`Fixture/smoke rows: ${result.summary.fixture_smoke_plan_candidate_count}`);
  console.log(`Reviewer handoff rows: ${result.summary.reviewer_handoff_note_candidate_count}`);
  console.log(`Ready for P31201 handoff: ${result.summary.ready_for_p31201_handoff}`);
  console.log(`File write allowed: ${result.summary.static_shell_implementation_handoff_package_file_write_allowed_now}`);
  console.log(`Browser run allowed: ${result.summary.static_shell_implementation_handoff_package_browser_run_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.receipt_workbench_operator_queue_static_shell_implementation_binding_candidate_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p30801_handoff === true,
    status: summary.receipt_workbench_operator_queue_static_shell_implementation_binding_candidate_status ?? "missing",
    p30800ContractReady: boundary.p30800_contract_ready === true,
    placementVisible: boundary.implementation_placement_candidate_visible_now === true,
    componentVisible: boundary.component_template_binding_candidate_visible_now === true,
    dataVisible: boundary.read_only_data_binding_candidate_visible_now === true,
    tokenVisible: boundary.visual_token_binding_candidate_visible_now === true,
    noAuthorityClosed: boundary.no_authority_boundary_closed_now === true,
    boundaryClosed: P30800_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p30801-p31200.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P30800 operator queue static shell implementation binding candidate source is available", sourceState.available],
    ["program_range", "P30800 source program range is P30401-P30800", sourceState.programRangeOk],
    ["validation_valid", "P30800 source validation is valid", sourceState.validationValid],
    ["p30801_handoff_open", "P30800 source opened P30801 handoff", sourceState.sourceReady],
    ["p30800_contract_ready", "P30800 source contract is ready", sourceState.p30800ContractReady],
    ["implementation_placement_visible", "P30800 implementation placement rows are visible", sourceState.placementVisible],
    ["component_template_visible", "P30800 component/template binding rows are visible", sourceState.componentVisible],
    ["read_only_data_visible", "P30800 read-only data binding rows are visible", sourceState.dataVisible],
    ["visual_token_visible", "P30800 visual token binding rows are visible", sourceState.tokenVisible],
    ["no_authority_closed", "P30800 no-authority boundary is closed", sourceState.noAuthorityClosed],
    ["commit_ref_present", "Current commit ref is present for static shell implementation handoff package", Boolean(commitRef)],
    ["source_blocker_visible", "P30800 source blocker is visible when implementation handoff package is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p30800_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildHandoffPackageCandidateRows({ source, generatedAt }) {
  const placementRows = Array.isArray(source.data?.implementation_placement_candidate_rows) ? source.data.implementation_placement_candidate_rows : [];
  const componentRows = Array.isArray(source.data?.component_template_binding_candidate_rows) ? source.data.component_template_binding_candidate_rows : [];
  const dataRows = Array.isArray(source.data?.read_only_data_binding_candidate_rows) ? source.data.read_only_data_binding_candidate_rows : [];
  const tokenRows = Array.isArray(source.data?.visual_token_binding_candidate_rows) ? source.data.visual_token_binding_candidate_rows : [];
  return placementRows.map((placement, index) => {
    const component = componentRows[index % Math.max(componentRows.length, 1)];
    const data = dataRows[index % Math.max(dataRows.length, 1)];
    const token = tokenRows[index % Math.max(tokenRows.length, 1)];
    return row({
      row_id: `handoff_package_candidate.${placement.shell_section_id}`,
      category: "handoff_package_candidate",
      label: `Implementation handoff package candidate for ${placement.shell_section_id}`,
      observed: placement.current_verdict === "pass" && component?.current_verdict === "pass" && data?.current_verdict === "pass" && token?.current_verdict === "pass",
      evidence_ref: placement.row_id,
      shell_section_id: placement.shell_section_id,
      implementation_placement_candidate_ref: placement.row_id,
      component_template_binding_candidate_ref: component?.row_id ?? null,
      read_only_data_binding_candidate_ref: data?.row_id ?? null,
      visual_token_binding_candidate_ref: token?.row_id ?? null,
      component_slot_hint: placement.component_slot_hint,
      candidate_path_hint: placement.candidate_path_hint,
      route_hint: placement.route_hint,
      api_projection_ref: data?.api_projection_ref ?? null,
      design_token_hook: token?.design_token_hook ?? null,
      component_class_hook: token?.component_class_hook ?? null,
      handoff_metadata_only: true,
      file_create_allowed_now: false,
      file_write_allowed_now: false,
      build_allowed_now: false,
      dom_render_allowed_now: false,
      browser_run_allowed_now: false,
      review_completion_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildImplementationFileManifestCandidateRows({ source, handoffRows, generatedAt }) {
  const componentRows = Array.isArray(source.data?.component_template_binding_candidate_rows) ? source.data.component_template_binding_candidate_rows : [];
  return handoffRows.map((handoff, index) => {
    const component = componentRows[index % Math.max(componentRows.length, 1)];
    return row({
      row_id: `implementation_file_manifest_candidate.${handoff.shell_section_id}`,
      category: "implementation_file_manifest_candidate",
      label: `Implementation file manifest candidate for ${handoff.shell_section_id}`,
      observed: handoff.current_verdict === "pass" && component?.component_template_metadata_only === true,
      evidence_ref: component?.row_id ?? handoff.row_id,
      handoff_package_candidate_ref: handoff.row_id,
      shell_section_id: handoff.shell_section_id,
      target_file_path_hint: handoff.candidate_path_hint,
      export_name_hint: handoff.component_slot_hint,
      component_role: component?.component_role ?? `operator_queue.${handoff.shell_section_id}.read_only_section`,
      fixture_ref_hint: `fixture.operator_queue.${handoff.shell_section_id}.read_only`,
      token_ref_hint: handoff.design_token_hook,
      manifest_metadata_only: true,
      file_create_allowed_now: false,
      file_write_allowed_now: false,
      component_write_allowed_now: false,
      template_apply_allowed_now: false,
      build_allowed_now: false,
      export_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildFixtureSmokePlanCandidateRows({ source, handoffRows, manifestRows, generatedAt }) {
  const dataRows = Array.isArray(source.data?.read_only_data_binding_candidate_rows) ? source.data.read_only_data_binding_candidate_rows : [];
  return handoffRows.map((handoff, index) => {
    const manifest = manifestRows[index % Math.max(manifestRows.length, 1)];
    const data = dataRows[index % Math.max(dataRows.length, 1)];
    return row({
      row_id: `fixture_smoke_plan_candidate.${handoff.shell_section_id}`,
      category: "fixture_smoke_plan_candidate",
      label: `Fixture and smoke plan candidate for ${handoff.shell_section_id}`,
      observed: handoff.current_verdict === "pass" && manifest?.current_verdict === "pass" && data?.read_only === true,
      evidence_ref: data?.row_id ?? manifest?.row_id ?? handoff.row_id,
      handoff_package_candidate_ref: handoff.row_id,
      implementation_file_manifest_candidate_ref: manifest?.row_id ?? null,
      source_read_only_data_binding_candidate_ref: data?.row_id ?? null,
      shell_section_id: handoff.shell_section_id,
      fixture_ref_hint: manifest?.fixture_ref_hint ?? `fixture.operator_queue.${handoff.shell_section_id}.read_only`,
      expected_state_refs: [
        `state.operator_queue.${handoff.shell_section_id}.empty`,
        `state.operator_queue.${handoff.shell_section_id}.loading`,
        `state.operator_queue.${handoff.shell_section_id}.blocked`,
      ],
      smoke_command_hint: `npm run platform:receipt-workbench-operator-queue-static-shell-implementation-handoff-package -- --check`,
      fixture_smoke_metadata_only: true,
      fixture_execution_allowed_now: false,
      browser_run_allowed_now: false,
      browser_smoke_allowed_now: false,
      visual_smoke_execution_allowed_now: false,
      screenshot_capture_allowed_now: false,
      network_fetch_allowed_now: false,
      client_hydration_allowed_now: false,
      build_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildReviewerHandoffNoteCandidateRows({ source, handoffRows, manifestRows, smokeRows, generatedAt }) {
  const tokenRows = Array.isArray(source.data?.visual_token_binding_candidate_rows) ? source.data.visual_token_binding_candidate_rows : [];
  return handoffRows.map((handoff, index) => {
    const manifest = manifestRows[index % Math.max(manifestRows.length, 1)];
    const smoke = smokeRows[index % Math.max(smokeRows.length, 1)];
    const token = tokenRows[index % Math.max(tokenRows.length, 1)];
    return row({
      row_id: `reviewer_handoff_note_candidate.${handoff.shell_section_id}`,
      category: "reviewer_handoff_note_candidate",
      label: `Reviewer handoff note candidate for ${handoff.shell_section_id}`,
      observed: handoff.current_verdict === "pass" && manifest?.current_verdict === "pass" && smoke?.current_verdict === "pass",
      evidence_ref: smoke?.row_id ?? manifest?.row_id ?? handoff.row_id,
      handoff_package_candidate_ref: handoff.row_id,
      implementation_file_manifest_candidate_ref: manifest?.row_id ?? null,
      fixture_smoke_plan_candidate_ref: smoke?.row_id ?? null,
      source_visual_token_binding_candidate_ref: token?.row_id ?? null,
      shell_section_id: handoff.shell_section_id,
      reviewer_context_refs: [
        handoff.component_slot_hint,
        handoff.api_projection_ref,
        token?.component_class_hook ?? handoff.component_class_hook,
      ].filter(Boolean),
      blocked_authority_note: "Metadata handoff only; reviewer may inspect but cannot approve, mutate, apply, build, render, or close out this package.",
      reviewer_handoff_metadata_only: true,
      review_completion_allowed_now: false,
      reviewer_mutation_allowed_now: false,
      final_approval_allowed_now: false,
      production_pass_allowed_now: false,
      enterprise_trust_claim_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildNoImplementationBoundaryRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_implementation.${flag}`,
    category: "no_implementation_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "receipt_workbench_operator_queue_static_shell_implementation_handoff_package_boundary",
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
    && allPass(context.manifestRows)
    && allPass(context.smokeRows)
    && allPass(context.reviewerRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P30800 source is ready for P30801", context.sourceState.sourceReady],
    ["handoff_package_visible", "Handoff package candidate rows are visible", allPass(context.handoffRows)],
    ["implementation_file_manifest_visible", "Implementation file manifest candidate rows are visible", allPass(context.manifestRows)],
    ["fixture_smoke_plan_visible", "Fixture/smoke plan candidate rows are visible", allPass(context.smokeRows)],
    ["reviewer_handoff_note_visible", "Reviewer handoff note candidate rows are visible", allPass(context.reviewerRows)],
    ["no_implementation_boundary_closed", "No-implementation boundary remains closed", allPass(context.boundaryRows)],
    ["p31201_handoff_gate", "P31201 handoff opens only when static shell implementation handoff package conditions pass", handoffReady],
    ["p31201_handoff_blocker_visible", "P31201 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p31200_checkpoint.${id}`,
    category: "p31200_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p31200_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p31200ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.handoffRows)
    && allPass(context.manifestRows)
    && allPass(context.smokeRows)
    && allPass(context.reviewerRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p31200_checkpoint.p31201_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.handoffRows)
    && allPass(context.manifestRows)
    && allPass(context.smokeRows)
    && allPass(context.reviewerRows)
    && allPass(context.boundaryRows);
  return {
    p31200_contract_ready: p31200ContractReady,
    ready_for_p31201_handoff: handoffReady,
    source_p30800_ready_for_p30801_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    handoff_package_candidate_visible_now: allPass(context.handoffRows),
    implementation_file_manifest_candidate_visible_now: allPass(context.manifestRows),
    fixture_smoke_plan_candidate_visible_now: allPass(context.smokeRows),
    reviewer_handoff_note_candidate_visible_now: allPass(context.reviewerRows),
    no_implementation_boundary_closed_now: allPass(context.boundaryRows),
    handoff_package_candidate_count: context.handoffRows.length,
    implementation_file_manifest_candidate_count: context.manifestRows.length,
    fixture_smoke_plan_candidate_count: context.smokeRows.length,
    reviewer_handoff_note_candidate_count: context.reviewerRows.length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P30801-P31200 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P30801-P31200 Receipt Workbench Operator Queue Static Shell Implementation Handoff Package"), "Architecture doc missing P30801-P31200 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P30800 source state is not visible"),
    validationItem("handoff.package", "implementation_handoff_package", allPass(context.handoffRows), "Handoff package candidate rows are incomplete"),
    validationItem("file.manifest", "implementation_handoff_package", allPass(context.manifestRows), "Implementation file manifest candidate rows are incomplete"),
    validationItem("fixture.smoke", "implementation_handoff_package", allPass(context.smokeRows), "Fixture/smoke plan candidate rows are incomplete"),
    validationItem("reviewer.handoff", "implementation_handoff_package", allPass(context.reviewerRows), "Reviewer handoff note candidate rows are incomplete"),
    validationItem("boundary.no_implementation", "authority", context.boundary.static_shell_implementation_handoff_package_file_write_allowed_now === false && context.boundary.static_shell_implementation_handoff_package_browser_run_allowed_now === false && context.boundary.static_shell_implementation_handoff_package_review_completion_allowed_now === false, "Implementation handoff package authority boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p31200_checkpoint.p31201_handoff_blocker_visible"), "P31200 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "receipt_workbench_operator_queue_static_shell_implementation_handoff_package.contract.v1",
    generated_at: generatedAt,
    source_p30800_required_or_rebuilt: true,
    handoff_package_candidate_required: true,
    implementation_file_manifest_candidate_required: true,
    fixture_smoke_plan_candidate_required: true,
    reviewer_handoff_note_candidate_required: true,
    no_implementation_boundary_required: true,
    p31201_handoff_is_not_file_create_write_apply_component_write_fixture_run_build_route_dom_browser_hydration_action_review_completion_approval_closeout_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p31201_handoff
    ? READY_STATUS
    : validation.valid && boundary.p31200_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    receipt_workbench_operator_queue_static_shell_implementation_handoff_package_status: status,
    source_p30800_ready_for_p30801_handoff: boundary.source_p30800_ready_for_p30801_handoff,
    handoff_package_candidate_count: boundary.handoff_package_candidate_count,
    implementation_file_manifest_candidate_count: boundary.implementation_file_manifest_candidate_count,
    fixture_smoke_plan_candidate_count: boundary.fixture_smoke_plan_candidate_count,
    reviewer_handoff_note_candidate_count: boundary.reviewer_handoff_note_candidate_count,
    ready_for_p31201_handoff: validation.valid && boundary.ready_for_p31201_handoff,
    static_shell_implementation_handoff_package_file_create_allowed_now: false,
    static_shell_implementation_handoff_package_file_write_allowed_now: false,
    static_shell_implementation_handoff_package_template_apply_allowed_now: false,
    static_shell_implementation_handoff_package_component_write_allowed_now: false,
    static_shell_implementation_handoff_package_fixture_execution_allowed_now: false,
    static_shell_implementation_handoff_package_build_allowed_now: false,
    static_shell_implementation_handoff_package_dom_render_allowed_now: false,
    static_shell_implementation_handoff_package_browser_run_allowed_now: false,
    static_shell_implementation_handoff_package_browser_smoke_allowed_now: false,
    static_shell_implementation_handoff_package_visual_smoke_execution_allowed_now: false,
    static_shell_implementation_handoff_package_screenshot_capture_allowed_now: false,
    static_shell_implementation_handoff_package_client_hydration_allowed_now: false,
    static_shell_implementation_handoff_package_network_fetch_allowed_now: false,
    static_shell_implementation_handoff_package_click_action_allowed_now: false,
    static_shell_implementation_handoff_package_write_allowed_now: false,
    static_shell_implementation_handoff_package_state_mutation_allowed_now: false,
    static_shell_implementation_handoff_package_review_completion_allowed_now: false,
    static_shell_implementation_handoff_package_final_approval_allowed_now: false,
    static_shell_implementation_handoff_package_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Receipt Workbench Operator Queue Static Shell Implementation Handoff Package",
    "",
    `Status: ${result.summary.receipt_workbench_operator_queue_static_shell_implementation_handoff_package_status}`,
    `Program: ${result.program_range}`,
    `P30800 ready for P30801 handoff: ${result.summary.source_p30800_ready_for_p30801_handoff}`,
    `Handoff package rows: ${result.summary.handoff_package_candidate_count}`,
    `Manifest rows: ${result.summary.implementation_file_manifest_candidate_count}`,
    `Fixture/smoke rows: ${result.summary.fixture_smoke_plan_candidate_count}`,
    `Reviewer handoff rows: ${result.summary.reviewer_handoff_note_candidate_count}`,
    `Ready for P31201 handoff: ${result.summary.ready_for_p31201_handoff}`,
    `File write allowed: ${result.summary.static_shell_implementation_handoff_package_file_write_allowed_now}`,
    `Browser run allowed: ${result.summary.static_shell_implementation_handoff_package_browser_run_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.handoff_package_candidate_rows.map((item) => `<tr><td>${escapeHtml(item.shell_section_id)}</td><td>${escapeHtml(item.component_slot_hint)}</td><td>${escapeHtml(item.api_projection_ref)}</td><td>${escapeHtml(item.file_write_allowed_now)}</td><td>${escapeHtml(item.browser_run_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Receipt Workbench Operator Queue Static Shell Implementation Handoff Package</title>
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
    <h1>Hermes Receipt Workbench Operator Queue Static Shell Implementation Handoff Package</h1>
    <p class="notice">This artifact defines implementation handoff package metadata only. It does not create files, write components, apply templates, run fixtures, build UI assets, start servers, register routes, render DOM, run browsers, capture screenshots, hydrate client state, fetch network data, click actions, mutate state, complete review, approve, close out, export, publish, or claim production readiness.</p>
    <table><thead><tr><th>Section</th><th>Component Slot</th><th>Read Model</th><th>Write</th><th>Browser</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP30800(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildReceiptWorkbenchOperatorQueueStaticShellImplementationBindingCandidate({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.receipt_workbench_operator_queue_static_shell_implementation_binding_candidate", built);
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
  const defaults = DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_STATIC_SHELL_IMPLEMENTATION_HANDOFF_PACKAGE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_receipt_workbench_operator_queue_static_shell_implementation_binding_candidate_path: path.resolve(repoRoot, options.sourceReceiptWorkbenchOperatorQueueStaticShellImplementationBindingCandidatePath ?? defaults.sourceReceiptWorkbenchOperatorQueueStaticShellImplementationBindingCandidatePath),
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
      args.sourceReceiptWorkbenchOperatorQueueStaticShellImplementationBindingCandidatePath = argv[++index];
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
  console.log(`Usage: node scripts/receipt-workbench-operator-queue-static-shell-implementation-handoff-package.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P30801-P31200 Receipt Workbench Operator Queue Static Shell Implementation Handoff Package.
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
