import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P44800_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewPacketCandidate,
} from "./work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-packet-candidate.mjs";

export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_API_OUT_DIR = "artifacts/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-api-read-model/latest";
export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_API_INPUTS = {
  schemaPath: "schemas/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-api-read-model.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p44801-p45200.md",
  architectureDocPath: "docs/architecture.md",
  sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewPacketCandidatePath: "artifacts/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-packet-candidate/latest/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-packet-candidate.json",
};

const COMMAND_NAME = "platform:work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-api-read-model";
const SCHEMA_VERSION = "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-api-read-model.v1";
const CAPABILITY_ID = "platform.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_read_model";
const PROGRAM_RANGE = "P44801-P45200";
const SOURCE_PROGRAM_RANGE = "P44401-P44800";
const READY_STATUS = "ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_read_model";
const BLOCK_PENDING_STATUS = "valid_block_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_read_model_pending";
const BLOCKED_STATUS = "blocked_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_read_model";

const PHASE_SPECS = [
  ["P44801-P44840", "P44800 Source Binding", "p44800_source_binding_rows"],
  ["P44841-P44900", "Implementation Review API Response Candidate", "implementation_review_api_response_candidate_rows"],
  ["P44901-P44960", "Implementation Review Route Contract", "implementation_review_route_contract_rows"],
  ["P44961-P45020", "Implementation Review UI Consumer Fixture", "implementation_review_ui_consumer_fixture_rows"],
  ["P45021-P45080", "Implementation Review Read-Only Payload Shape", "implementation_review_read_only_payload_shape_rows"],
  ["P45081-P45140", "No Mutation Review Execution Boundary", "no_mutation_review_execution_boundary_rows"],
  ["P45141-P45200", "P45200 Clean Checkpoint", "p45200_clean_checkpoint_rows"],
];

export const WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_API_FALSE_FLAGS = [
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_server_start_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_route_registration_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_runtime_route_execution_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_network_call_required_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_post_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_patch_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_put_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_delete_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_write_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_state_mutation_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_receipt_accept_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_receipt_create_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_reviewer_dispatch_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_claude_execution_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_human_adjudication_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_finding_resolution_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_review_completion_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_file_apply_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_file_write_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_generated_file_apply_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_build_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_browser_run_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_ui_mutation_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_fixture_persist_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_raw_payload_exposure_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_secret_read_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_approval_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_closeout_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_deployment_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_final_approval_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_production_pass_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_enterprise_trust_claim_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_human_gate_bypass_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_independent_review_bypass_allowed_now",
  "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([
  ...WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_API_FALSE_FLAGS,
  ...P44800_FALSE_FLAGS,
])];

export async function runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel(options = {}) {
  const result = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review API Read Model failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel(result, result.output_dir);
  return result;
}

export async function buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_API_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewPacketCandidate")
    ? normalizeInlineJsonSource("inline.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_packet_candidate", options.workOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewPacketCandidate)
    : await readJsonOrBuildP44800(inputs.source_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_packet_candidate_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const apiRows = buildImplementationReviewApiResponseCandidateRows({ source, generatedAt });
  const routeRows = buildImplementationReviewRouteContractRows({ apiRows, generatedAt });
  const fixtureRows = buildImplementationReviewUiConsumerFixtureRows({ source, apiRows, routeRows, generatedAt });
  const payloadRows = buildImplementationReviewReadOnlyPayloadShapeRows({ source, apiRows, routeRows, fixtureRows, generatedAt });
  const boundaryRows = buildNoMutationReviewExecutionBoundaryRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const checkpointRows = buildCheckpointRows({ sourceState, apiRows, routeRows, fixtureRows, payloadRows, boundaryRows, wiringRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, apiRows, routeRows, fixtureRows, payloadRows, boundaryRows, wiringRows, checkpointRows });
  const validationItems = buildValidationItems({ phaseRows, sourceRows, apiRows, routeRows, fixtureRows, payloadRows, boundaryRows, wiringRows, checkpointRows, boundary });
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
      work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_packet_candidate_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_packet_candidate_summary: source.data?.summary ?? null,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_contract: buildContract(generatedAt),
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_phase_rows: phaseRows,
    p44800_source_binding_rows: sourceRows,
    implementation_review_api_response_candidate_rows: apiRows,
    implementation_review_route_contract_rows: routeRows,
    implementation_review_ui_consumer_fixture_rows: fixtureRows,
    implementation_review_read_only_payload_shape_rows: payloadRows,
    no_mutation_review_execution_boundary_rows: boundaryRows,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_wiring_rows: wiringRows,
    p45200_clean_checkpoint_rows: checkpointRows,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_boundary: boundary,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_read_model")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-api-read-model.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p44800-source-binding-rows.json"), collectionEnvelope("p44800-source-binding-rows.v1", "p44800_source_binding_rows", result.p44800_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "implementation-review-api-response-candidate-rows.json"), collectionEnvelope("implementation-review-api-response-candidate-rows.v1", "implementation_review_api_response_candidate_rows", result.implementation_review_api_response_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "implementation-review-route-contract-rows.json"), collectionEnvelope("implementation-review-route-contract-rows.v1", "implementation_review_route_contract_rows", result.implementation_review_route_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "implementation-review-ui-consumer-fixture-rows.json"), collectionEnvelope("implementation-review-ui-consumer-fixture-rows.v1", "implementation_review_ui_consumer_fixture_rows", result.implementation_review_ui_consumer_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "implementation-review-read-only-payload-shape-rows.json"), collectionEnvelope("implementation-review-read-only-payload-shape-rows.v1", "implementation_review_read_only_payload_shape_rows", result.implementation_review_read_only_payload_shape_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-mutation-review-execution-boundary-rows.json"), collectionEnvelope("no-mutation-review-execution-boundary-rows.v1", "no_mutation_review_execution_boundary_rows", result.no_mutation_review_execution_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-api-wiring-rows.json"), collectionEnvelope("work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-api-wiring-rows.v1", "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_wiring_rows", result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_wiring_rows, result.generated_at));
  await writeJson(path.join(outDir, "p45200-clean-checkpoint-rows.json"), collectionEnvelope("p45200-clean-checkpoint-rows.v1", "p45200_clean_checkpoint_rows", result.p45200_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-api-boundary.json"), result.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModelCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewApiReadModel(args);
  console.log(`Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review API Read Model ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P44800 ready for implementation review API: ${result.summary.source_p44800_ready_for_implementation_review_api}`);
  console.log(`API responses: ${result.summary.implementation_review_api_response_candidate_count}`);
  console.log(`Route contracts: ${result.summary.implementation_review_route_contract_count}`);
  console.log(`UI fixtures: ${result.summary.implementation_review_ui_consumer_fixture_count}`);
  console.log(`Payload shapes: ${result.summary.implementation_review_read_only_payload_shape_count}`);
  console.log(`Ready for implementation review API handoff: ${result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_handoff}`);
  console.log(`API write allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_write_allowed_now}`);
  console.log(`Review execution allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_claude_execution_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.work_os_static_bundle_review_ui_implementation_review_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_work_os_static_bundle_review_ui_implementation_review_request_handoff === true,
    status: summary.work_os_static_bundle_review_ui_implementation_review_status ?? "missing",
    p44800ContractReady: boundary.p44800_contract_ready === true,
    packetVisible: boundary.implementation_review_packet_candidate_visible_now === true,
    evidenceVisible: boundary.implementation_review_evidence_summary_visible_now === true,
    findingVisible: boundary.implementation_finding_seed_visible_now === true,
    reviewerVisible: boundary.implementation_reviewer_lane_request_candidate_visible_now === true,
    noReviewCompletionClosed: boundary.no_review_completion_boundary_closed_now === true,
    wiringVisible: boundary.work_os_static_bundle_review_ui_implementation_review_wiring_complete_now === true,
    boundaryClosed: P44800_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p44801-p45200.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P44800 implementation review packet candidate source is available", sourceState.available],
    ["program_range", "P44800 source program range is P44401-P44800", sourceState.programRangeOk],
    ["validation_valid", "P44800 source validation is valid", sourceState.validationValid],
    ["implementation_review_api_open", "P44800 opened implementation review API metadata", sourceState.sourceReady],
    ["p44800_contract_ready", "P44800 source contract is ready", sourceState.p44800ContractReady],
    ["packet_visible", "P44800 implementation review packet candidates are visible", sourceState.packetVisible],
    ["evidence_visible", "P44800 implementation review evidence summary rows are visible", sourceState.evidenceVisible],
    ["finding_visible", "P44800 implementation finding seed rows are visible", sourceState.findingVisible],
    ["reviewer_visible", "P44800 implementation reviewer lane request candidates are visible", sourceState.reviewerVisible],
    ["no_review_completion_closed", "P44800 no-review-completion boundary is closed", sourceState.noReviewCompletionClosed],
    ["review_wiring_visible", "P44800 review packet wiring is visible", sourceState.wiringVisible],
    ["commit_ref_present", "Current commit ref is present for implementation review API read model", Boolean(commitRef)],
    ["source_blocker_visible", "P44800 source blocker is visible when implementation review API handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p44800_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildImplementationReviewApiResponseCandidateRows({ source, generatedAt }) {
  const packetRows = source.data?.implementation_review_packet_candidate_rows ?? [];
  const evidenceRows = source.data?.implementation_review_evidence_summary_rows ?? [];
  const findingRows = source.data?.implementation_finding_seed_rows ?? [];
  const reviewerRows = source.data?.implementation_reviewer_lane_request_candidate_rows ?? [];
  return packetRows.map((packet) => {
    const evidence = evidenceRows.find((item) => item.request_id === packet.request_id);
    const reviewer = reviewerRows.find((item) => item.request_id === packet.request_id);
    const findings = findingRows.filter((item) => item.request_id === packet.request_id);
    return row({
      row_id: `implementation_review_api_response_candidate.${packet.request_id}`,
      category: "implementation_review_api_response_candidate",
      label: `Implementation review API response candidate for ${packet.request_id}`,
      observed: Boolean(packet.request_id && packet.packet_visible_now === true && evidence && reviewer && findings.length >= 4),
      evidence_ref: packet.row_id,
      request_id: packet.request_id,
      route_path: `/api/work-os/static-bundle-review/implementation-review/${safePathSegment(packet.request_id)}`,
      method: "GET",
      response_model_ref: `work_os.static_bundle_review.implementation_review.response.${safePathSegment(packet.request_id)}.candidate`,
      implementation_review_packet_ref: packet.implementation_review_packet_ref,
      implementation_evidence_summary_ref: evidence?.row_id ?? null,
      implementation_reviewer_lane_request_ref: reviewer?.row_id ?? null,
      implementation_finding_seed_refs: findings.map((item) => item.row_id),
      expected_status: "blocked_implementation_review_packet_candidate_ready",
      read_only: true,
      api_server_start_allowed_now: false,
      route_registration_allowed_now: false,
      runtime_route_execution_allowed_now: false,
      network_call_required_now: false,
      api_write_allowed_now: false,
      review_receipt_accept_allowed_now: false,
      review_completion_allowed_now: false,
      claude_review_execution_allowed_now: false,
      raw_payload_exposure_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildImplementationReviewRouteContractRows({ apiRows, generatedAt }) {
  return apiRows.map((api) => row({
    row_id: `implementation_review_route_contract.${api.request_id}`,
    category: "implementation_review_route_contract",
    label: `Implementation review route contract for ${api.request_id}`,
    observed: api.method === "GET" && api.read_only === true,
    evidence_ref: api.row_id,
    request_id: api.request_id,
    route_path: api.route_path,
    allowed_methods: ["GET"],
    disallowed_methods: ["POST", "PATCH", "PUT", "DELETE"],
    response_model_ref: api.response_model_ref,
    route_contract_visible_now: true,
    api_server_start_allowed_now: false,
    route_registration_allowed_now: false,
    runtime_route_execution_allowed_now: false,
    api_post_allowed_now: false,
    api_patch_allowed_now: false,
    api_put_allowed_now: false,
    api_delete_allowed_now: false,
    api_write_allowed_now: false,
    api_state_mutation_allowed_now: false,
    review_receipt_accept_allowed_now: false,
    review_completion_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildImplementationReviewUiConsumerFixtureRows({ source, apiRows, routeRows, generatedAt }) {
  const packetRows = source.data?.implementation_review_packet_candidate_rows ?? [];
  return apiRows.map((api) => {
    const route = routeRows.find((item) => item.request_id === api.request_id);
    const packet = packetRows.find((item) => item.request_id === api.request_id);
    return row({
      row_id: `implementation_review_ui_consumer_fixture.${api.request_id}`,
      category: "implementation_review_ui_consumer_fixture",
      label: `Implementation review UI consumer fixture for ${api.request_id}`,
      observed: Boolean(route && packet),
      evidence_ref: route?.row_id ?? api.row_id,
      request_id: api.request_id,
      fixture_ref: `fixtures.work_os_static_bundle_review.implementation_review.${safePathSegment(api.request_id)}.read_only`,
      route_path: api.route_path,
      expected_status: api.expected_status,
      expected_visible_fields: [
        "request_id",
        "implementation_review_packet_ref",
        "implementation_evidence_summary_ref",
        "implementation_reviewer_lane_request_ref",
        "implementation_finding_seed_refs",
        "expected_status",
      ],
      source_component_path_ref: packet?.component_path_ref ?? null,
      source_test_path_ref: packet?.test_path_ref ?? null,
      source_style_path_ref: packet?.style_path_ref ?? null,
      smoke_fixture_visible_now: true,
      fixture_persist_allowed_now: false,
      ui_mutation_allowed_now: false,
      ui_status_edit_allowed_now: false,
      ui_action_button_allowed_now: false,
      review_receipt_accept_allowed_now: false,
      reviewer_lane_dispatch_allowed_now: false,
      claude_review_execution_allowed_now: false,
      finding_resolution_allowed_now: false,
      file_apply_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildImplementationReviewReadOnlyPayloadShapeRows({ source, apiRows, routeRows, fixtureRows, generatedAt }) {
  const evidenceRows = source.data?.implementation_review_evidence_summary_rows ?? [];
  return apiRows.map((api) => {
    const route = routeRows.find((item) => item.request_id === api.request_id);
    const fixture = fixtureRows.find((item) => item.request_id === api.request_id);
    const evidence = evidenceRows.find((item) => item.request_id === api.request_id);
    return row({
      row_id: `implementation_review_read_only_payload_shape.${api.request_id}`,
      category: "implementation_review_read_only_payload_shape",
      label: `Read-only implementation review payload shape for ${api.request_id}`,
      observed: Boolean(route && fixture && evidence),
      evidence_ref: fixture?.row_id ?? api.row_id,
      request_id: api.request_id,
      payload_shape_ref: `payload.work_os.static_bundle_review.implementation_review.${safePathSegment(api.request_id)}.read_only`,
      response_model_ref: api.response_model_ref,
      route_contract_ref: route?.row_id ?? null,
      fixture_ref: fixture?.fixture_ref ?? null,
      source_evidence_ref_count: evidence?.source_evidence_refs?.length ?? 0,
      finding_seed_count: api.implementation_finding_seed_refs.length,
      allowed_payload_fields: [
        "request_id",
        "route_path",
        "expected_status",
        "implementation_review_packet_ref",
        "implementation_evidence_summary_ref",
        "implementation_reviewer_lane_request_ref",
        "implementation_finding_seed_refs",
        "allowed_methods",
        "blocked_authority",
      ],
      read_only_payload_visible_now: true,
      raw_payload_exposure_allowed_now: false,
      secret_read_allowed_now: false,
      api_state_mutation_allowed_now: false,
      review_receipt_accept_allowed_now: false,
      review_completion_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildNoMutationReviewExecutionBoundaryRows(generatedAt) {
  const stateRows = [
    ["state.api_response_is_not_server_start", "Implementation review API response candidate must not start a server", true],
    ["state.route_contract_is_not_runtime_registration", "Implementation review route contract must not register or execute runtime routes", true],
    ["state.ui_fixture_is_not_receipt_intake", "Implementation review UI fixture must not accept review receipts", true],
    ["state.payload_shape_is_not_raw_exposure", "Read-only payload shape must not expose raw payloads or secrets", true],
    ["state.review_api_is_not_claude_execution", "Implementation review API read model must not dispatch or execute Claude review", true],
    ["state.read_model_is_not_file_apply", "Implementation review read model must not write, apply, build, run, approve, or close out work", true],
  ].map(([id, label, observed]) => row({
    row_id: `no_mutation_review_execution_boundary.${id}`,
    category: "no_mutation_review_execution_boundary",
    label,
    observed,
    evidence_ref: "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_boundary",
    generated_at: generatedAt,
  }));
  const boundaryRows = ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_mutation_review_execution_boundary.${flag}`,
    category: "no_mutation_review_execution_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
  return [...stateRows, ...boundaryRows];
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  return [
    ["package_script", "Package script is wired", hasScript(packageJson.data, COMMAND_NAME), "package.json"],
    ["validate_chain", "Validate chain includes P45200 check", packageJson.text.includes(`${COMMAND_NAME} -- --check`), "package.json"],
    ["schema_file", "Schema file is configured", packageJson.available, "schemas/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-api-read-model.schema.json"],
    ["roadmap_doc", "Roadmap documents all P44801-P45200 slices", PHASE_SPECS.every(([range]) => roadmapDoc.text.includes(range)), "docs/hermes-roadmap-p44801-p45200.md"],
    ["architecture_doc", "Architecture doc references P44801-P45200", architectureDoc.text.includes("P44801-P45200 Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review API Read Model"), "docs/architecture.md"],
  ].map(([id, label, observed, evidenceRef]) => row({
    row_id: `work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_wiring.${id}`,
    category: "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_wiring",
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
    && allPass(context.apiRows)
    && allPass(context.routeRows)
    && allPass(context.fixtureRows)
    && allPass(context.payloadRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows);
  return [
    ["source_ready", "P44800 source is ready for implementation review API read model handoff", context.sourceState.sourceReady],
    ["api_response_visible", "Implementation review API response candidates are visible", allPass(context.apiRows)],
    ["route_contract_visible", "Implementation review route contracts are visible", allPass(context.routeRows)],
    ["ui_fixture_visible", "Implementation review UI consumer fixtures are visible", allPass(context.fixtureRows)],
    ["payload_shape_visible", "Implementation review read-only payload shapes are visible", allPass(context.payloadRows)],
    ["no_mutation_review_execution_boundary_closed", "No-mutation/review-execution boundary stays closed", allPass(context.boundaryRows)],
    ["wiring_complete", "CLI, schema, package, roadmap, and architecture wiring are visible", allPass(context.wiringRows)],
    ["api_write_blocked", "API write and route runtime execution remain blocked", true],
    ["receipt_accept_blocked", "Review receipt creation and acceptance remain blocked", true],
    ["review_execution_blocked", "Reviewer dispatch and Claude execution remain blocked", true],
    ["raw_payload_secret_blocked", "Raw payload and secret exposure remain blocked", true],
    ["file_apply_blocked", "File write/apply/build/browser run remain blocked", true],
    ["p45200_api_handoff", "P45200 implementation review API handoff opens only as read-only metadata", ready],
  ].map(([id, label, observed]) => row({
    row_id: `p45200_checkpoint.${id}`,
    category: "p45200_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p45200_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p45200ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.apiRows)
    && allPass(context.routeRows)
    && allPass(context.fixtureRows)
    && allPass(context.payloadRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows)
    && visibleOrPassed(context.checkpointRows, "p45200_checkpoint.api_write_blocked")
    && visibleOrPassed(context.checkpointRows, "p45200_checkpoint.receipt_accept_blocked")
    && visibleOrPassed(context.checkpointRows, "p45200_checkpoint.review_execution_blocked")
    && visibleOrPassed(context.checkpointRows, "p45200_checkpoint.raw_payload_secret_blocked")
    && visibleOrPassed(context.checkpointRows, "p45200_checkpoint.file_apply_blocked");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p45200ContractReady;
  return {
    p45200_contract_ready: p45200ContractReady,
    ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_handoff: ready,
    source_p44800_ready_for_implementation_review_api: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    implementation_review_api_response_candidate_visible_now: allPass(context.apiRows),
    implementation_review_route_contract_visible_now: allPass(context.routeRows),
    implementation_review_ui_consumer_fixture_visible_now: allPass(context.fixtureRows),
    implementation_review_read_only_payload_shape_visible_now: allPass(context.payloadRows),
    no_mutation_review_execution_boundary_closed_now: allPass(context.boundaryRows),
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_wiring_complete_now: allPass(context.wiringRows),
    implementation_review_api_response_candidate_count: context.apiRows.length,
    implementation_review_route_contract_count: context.routeRows.length,
    implementation_review_ui_consumer_fixture_count: context.fixtureRows.length,
    implementation_review_read_only_payload_shape_count: context.payloadRows.length,
    api_write_allowed_count: context.routeRows.filter((item) => item.api_write_allowed_now === true || item.api_post_allowed_now === true || item.api_patch_allowed_now === true || item.api_put_allowed_now === true || item.api_delete_allowed_now === true).length,
    api_server_start_allowed_count: context.apiRows.filter((item) => item.api_server_start_allowed_now === true || item.route_registration_allowed_now === true || item.runtime_route_execution_allowed_now === true).length
      + context.routeRows.filter((item) => item.api_server_start_allowed_now === true || item.route_registration_allowed_now === true || item.runtime_route_execution_allowed_now === true).length,
    api_state_mutation_allowed_count: context.routeRows.filter((item) => item.api_state_mutation_allowed_now === true).length
      + context.payloadRows.filter((item) => item.api_state_mutation_allowed_now === true).length,
    ui_mutation_allowed_count: context.fixtureRows.filter((item) => item.ui_mutation_allowed_now === true || item.ui_status_edit_allowed_now === true || item.ui_action_button_allowed_now === true).length,
    review_receipt_accept_allowed_count: context.apiRows.filter((item) => item.review_receipt_accept_allowed_now === true).length
      + context.routeRows.filter((item) => item.review_receipt_accept_allowed_now === true).length
      + context.fixtureRows.filter((item) => item.review_receipt_accept_allowed_now === true).length
      + context.payloadRows.filter((item) => item.review_receipt_accept_allowed_now === true).length,
    reviewer_dispatch_allowed_count: context.fixtureRows.filter((item) => item.reviewer_lane_dispatch_allowed_now === true || item.claude_review_execution_allowed_now === true).length
      + context.apiRows.filter((item) => item.claude_review_execution_allowed_now === true).length,
    review_completion_allowed_count: context.apiRows.filter((item) => item.review_completion_allowed_now === true).length
      + context.routeRows.filter((item) => item.review_completion_allowed_now === true).length
      + context.payloadRows.filter((item) => item.review_completion_allowed_now === true).length,
    raw_payload_exposure_allowed_count: context.apiRows.filter((item) => item.raw_payload_exposure_allowed_now === true).length
      + context.payloadRows.filter((item) => item.raw_payload_exposure_allowed_now === true || item.secret_read_allowed_now === true).length,
    file_apply_allowed_count: context.fixtureRows.filter((item) => item.file_apply_allowed_now === true).length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  };
}

function buildValidationItems(context) {
  return [
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P44801-P45200 phase rows are incomplete"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P44800 source state is not visible"),
    validationItem("api.visible", "api", allPass(context.apiRows), "Implementation review API response candidates are incomplete"),
    validationItem("route.visible", "api", allPass(context.routeRows), "Implementation review route contracts are incomplete"),
    validationItem("fixture.visible", "ui", allPass(context.fixtureRows), "Implementation review UI consumer fixtures are incomplete"),
    validationItem("payload.visible", "api", allPass(context.payloadRows), "Implementation review read-only payload shapes are incomplete"),
    validationItem("boundary.visible", "authority", allPass(context.boundaryRows), "No-mutation/review-execution boundary rows are incomplete"),
    validationItem("wiring.complete", "wiring", allPass(context.wiringRows), "P44801-P45200 wiring is incomplete"),
    validationItem("get.only", "authority", context.routeRows.every((item) => Array.isArray(item.allowed_methods) && item.allowed_methods.length === 1 && item.allowed_methods[0] === "GET"), "Implementation review API route contract is not GET-only"),
    validationItem("no.server.start", "authority", context.apiRows.every((item) => item.api_server_start_allowed_now === false && item.route_registration_allowed_now === false && item.runtime_route_execution_allowed_now === false)
      && context.routeRows.every((item) => item.api_server_start_allowed_now === false && item.route_registration_allowed_now === false && item.runtime_route_execution_allowed_now === false), "Server start or route execution opened"),
    validationItem("no.api.write", "authority", context.routeRows.every((item) => item.api_post_allowed_now === false && item.api_patch_allowed_now === false && item.api_put_allowed_now === false && item.api_delete_allowed_now === false && item.api_write_allowed_now === false && item.api_state_mutation_allowed_now === false), "API write or state mutation opened"),
    validationItem("no.ui.mutation", "authority", context.fixtureRows.every((item) => item.ui_mutation_allowed_now === false && item.ui_status_edit_allowed_now === false && item.ui_action_button_allowed_now === false), "Implementation review UI mutation opened"),
    validationItem("no.receipt.accept", "authority", context.apiRows.every((item) => item.review_receipt_accept_allowed_now === false)
      && context.routeRows.every((item) => item.review_receipt_accept_allowed_now === false)
      && context.fixtureRows.every((item) => item.review_receipt_accept_allowed_now === false)
      && context.payloadRows.every((item) => item.review_receipt_accept_allowed_now === false), "Review receipt acceptance opened"),
    validationItem("no.review.execution", "authority", context.apiRows.every((item) => item.claude_review_execution_allowed_now === false)
      && context.fixtureRows.every((item) => item.reviewer_lane_dispatch_allowed_now === false && item.claude_review_execution_allowed_now === false), "Reviewer dispatch or Claude execution opened"),
    validationItem("no.raw.secret", "authority", context.apiRows.every((item) => item.raw_payload_exposure_allowed_now === false)
      && context.payloadRows.every((item) => item.raw_payload_exposure_allowed_now === false && item.secret_read_allowed_now === false), "Raw payload or secret exposure opened"),
    validationItem("no.file.apply", "authority", context.fixtureRows.every((item) => item.file_apply_allowed_now === false), "File apply opened through API fixture"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.api_write_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p45200_checkpoint.api_write_blocked"), "P45200 API write blocker checkpoint is not visible"),
    validationItem("checkpoint.review_execution_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p45200_checkpoint.review_execution_blocked"), "P45200 review execution blocker checkpoint is not visible"),
    validationItem("checkpoint.raw_payload_secret_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p45200_checkpoint.raw_payload_secret_blocked"), "P45200 raw payload/secret blocker checkpoint is not visible"),
    validationItem("checkpoint.file_apply_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p45200_checkpoint.file_apply_blocked"), "P45200 file apply blocker checkpoint is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_read_model.contract.v1",
    generated_at: generatedAt,
    source_p44800_required_or_rebuilt: true,
    implementation_review_api_response_candidate_required: true,
    implementation_review_route_contract_required: true,
    implementation_review_ui_consumer_fixture_required: true,
    implementation_review_read_only_payload_shape_required: true,
    no_mutation_review_execution_boundary_required: true,
    p45200_is_not_api_server_route_registration_api_write_review_receipt_accept_reviewer_dispatch_claude_execution_finding_resolution_file_apply_approval_production_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_handoff
    ? READY_STATUS
    : validation.valid && boundary.p45200_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_status: status,
    source_p44800_ready_for_implementation_review_api: boundary.source_p44800_ready_for_implementation_review_api,
    implementation_review_api_response_candidate_count: boundary.implementation_review_api_response_candidate_count,
    implementation_review_route_contract_count: boundary.implementation_review_route_contract_count,
    implementation_review_ui_consumer_fixture_count: boundary.implementation_review_ui_consumer_fixture_count,
    implementation_review_read_only_payload_shape_count: boundary.implementation_review_read_only_payload_shape_count,
    api_write_allowed_count: boundary.api_write_allowed_count,
    api_server_start_allowed_count: boundary.api_server_start_allowed_count,
    api_state_mutation_allowed_count: boundary.api_state_mutation_allowed_count,
    ui_mutation_allowed_count: boundary.ui_mutation_allowed_count,
    review_receipt_accept_allowed_count: boundary.review_receipt_accept_allowed_count,
    reviewer_dispatch_allowed_count: boundary.reviewer_dispatch_allowed_count,
    review_completion_allowed_count: boundary.review_completion_allowed_count,
    raw_payload_exposure_allowed_count: boundary.raw_payload_exposure_allowed_count,
    file_apply_allowed_count: boundary.file_apply_allowed_count,
    ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_handoff: validation.valid && boundary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_handoff,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_server_start_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_route_registration_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_runtime_route_execution_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_network_call_required_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_post_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_patch_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_put_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_delete_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_write_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_state_mutation_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_receipt_accept_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_receipt_create_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_reviewer_dispatch_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_claude_execution_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_human_adjudication_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_finding_resolution_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_review_completion_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_file_apply_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_file_write_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_generated_file_apply_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_build_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_browser_run_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_ui_mutation_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_raw_payload_exposure_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_secret_read_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_final_approval_allowed_now: false,
    work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review API Read Model",
    "",
    `Status: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_status}`,
    `Program: ${result.program_range}`,
    `P44800 ready for implementation review API: ${result.summary.source_p44800_ready_for_implementation_review_api}`,
    `API responses: ${result.summary.implementation_review_api_response_candidate_count}`,
    `Route contracts: ${result.summary.implementation_review_route_contract_count}`,
    `UI fixtures: ${result.summary.implementation_review_ui_consumer_fixture_count}`,
    `Payload shapes: ${result.summary.implementation_review_read_only_payload_shape_count}`,
    `Ready for implementation review API handoff: ${result.summary.ready_for_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_handoff}`,
    `API write allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_write_allowed_now}`,
    `Review execution allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_claude_execution_allowed_now}`,
    `Raw payload exposure allowed: ${result.summary.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_api_raw_payload_exposure_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.implementation_review_route_contract_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.route_path)}</td><td>${escapeHtml(item.allowed_methods.join(", "))}</td><td>${escapeHtml(item.api_write_allowed_now)}</td><td>${escapeHtml(item.review_receipt_accept_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review API Read Model</title>
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
    <h1>Hermes Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review API Read Model</h1>
    <p class="notice">This artifact defines read-only implementation review API response candidates, route contracts, UI consumer fixtures, and payload shapes. It does not start a server, register routes, accept receipts, dispatch reviewers, execute Claude review, expose raw payloads, mutate UI/API state, apply files, approve, close out, deploy, or claim production readiness.</p>
    <table><thead><tr><th>Request</th><th>Route</th><th>Allowed Methods</th><th>API Write</th><th>Receipt Accept</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP44800(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewPacketCandidate({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_packet_candidate", built);
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
  const defaults = DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_UI_IMPLEMENTATION_REVIEW_STATIC_SHELL_IMPLEMENTATION_REVIEW_API_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_work_os_static_bundle_review_ui_implementation_review_static_shell_implementation_review_packet_candidate_path: path.resolve(repoRoot, options.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewPacketCandidatePath ?? defaults.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewPacketCandidatePath),
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
      args.sourceWorkOsStaticBundleReviewUiImplementationReviewStaticShellImplementationReviewPacketCandidatePath = argv[++index];
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
  console.log(`Usage: node scripts/work-os-static-bundle-review-ui-implementation-review-static-shell-implementation-review-api-read-model.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P44801-P45200 Work OS Static Bundle Review UI Implementation Review Static Shell Implementation Review API Read Model.
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
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "request";
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
