import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P37600_FALSE_FLAGS,
  buildWorkOsStaticBundleReviewPacketCandidate,
} from "./work-os-static-bundle-review-packet-candidate.mjs";

export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_API_OUT_DIR = "artifacts/work-os-static-bundle-review-api-read-model/latest";
export const DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_API_INPUTS = {
  schemaPath: "schemas/work-os-static-bundle-review-api-read-model.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p37601-p38000.md",
  architectureDocPath: "docs/architecture.md",
  sourceWorkOsStaticBundleReviewPacketCandidatePath: "artifacts/work-os-static-bundle-review-packet-candidate/latest/work-os-static-bundle-review-packet-candidate.json",
};

const COMMAND_NAME = "platform:work-os-static-bundle-review-api-read-model";
const SCHEMA_VERSION = "work-os-static-bundle-review-api-read-model.v1";
const CAPABILITY_ID = "platform.work_os_static_bundle_review_api_read_model";
const PROGRAM_RANGE = "P37601-P38000";
const SOURCE_PROGRAM_RANGE = "P37201-P37600";
const READY_STATUS = "ready_for_work_os_static_bundle_review_api_read_model";
const BLOCK_PENDING_STATUS = "valid_block_work_os_static_bundle_review_api_read_model_pending";
const BLOCKED_STATUS = "blocked_work_os_static_bundle_review_api_read_model";

const PHASE_SPECS = [
  ["P37601-P37640", "P37600 Source Binding", "p37600_source_binding_rows"],
  ["P37641-P37700", "Review Packet API Response Candidate", "static_bundle_review_api_response_rows"],
  ["P37701-P37760", "Review Packet UI Consumer Fixture", "review_packet_ui_consumer_fixture_rows"],
  ["P37761-P37820", "Review Packet Route Response Contract", "review_packet_route_response_contract_rows"],
  ["P37821-P37880", "No Receipt Accept API Write Boundary", "no_receipt_accept_api_write_boundary_rows"],
  ["P37881-P37940", "Review API Projection Wiring", "work_os_static_bundle_review_api_wiring_rows"],
  ["P37941-P38000", "P38000 Clean Checkpoint", "p38000_clean_checkpoint_rows"],
];

export const WORK_OS_STATIC_BUNDLE_REVIEW_API_FALSE_FLAGS = [
  "work_os_static_bundle_review_api_server_start_allowed_now",
  "work_os_static_bundle_review_api_write_allowed_now",
  "work_os_static_bundle_review_api_post_allowed_now",
  "work_os_static_bundle_review_api_patch_allowed_now",
  "work_os_static_bundle_review_api_delete_allowed_now",
  "work_os_static_bundle_review_route_registration_allowed_now",
  "work_os_static_bundle_review_network_call_required_now",
  "work_os_static_bundle_review_ui_mutation_allowed_now",
  "work_os_static_bundle_review_ui_status_edit_allowed_now",
  "work_os_static_bundle_review_ui_action_button_allowed_now",
  "work_os_static_bundle_review_fixture_persist_allowed_now",
  "work_os_static_bundle_review_receipt_accept_allowed_now",
  "work_os_static_bundle_review_receipt_create_allowed_now",
  "work_os_static_bundle_review_completion_allowed_now",
  "work_os_static_bundle_reviewer_lane_dispatch_allowed_now",
  "work_os_static_bundle_claude_review_execution_allowed_now",
  "work_os_static_bundle_human_adjudication_allowed_now",
  "work_os_static_bundle_finding_resolution_allowed_now",
  "work_os_static_bundle_review_evidence_pass_allowed_now",
  "work_os_static_bundle_approval_allowed_now",
  "work_os_static_bundle_closeout_allowed_now",
  "work_os_static_bundle_runtime_execution_allowed_now",
  "work_os_static_bundle_write_action_allowed_now",
  "work_os_static_bundle_protected_action_allowed_now",
  "work_os_static_bundle_connector_write_allowed_now",
  "work_os_static_bundle_deployment_allowed_now",
  "work_os_static_bundle_final_approval_allowed_now",
  "work_os_static_bundle_production_pass_allowed_now",
  "work_os_static_bundle_enterprise_trust_claim_allowed_now",
  "work_os_static_bundle_secret_read_allowed_now",
  "work_os_static_bundle_human_gate_bypass_allowed_now",
  "work_os_static_bundle_independent_review_bypass_allowed_now",
  "work_os_static_bundle_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...WORK_OS_STATIC_BUNDLE_REVIEW_API_FALSE_FLAGS, ...P37600_FALSE_FLAGS])];

export async function runWorkOsStaticBundleReviewApiReadModel(options = {}) {
  const result = await buildWorkOsStaticBundleReviewApiReadModel(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS Static Bundle Review API Read Model failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeWorkOsStaticBundleReviewApiReadModel(result, result.output_dir);
  return result;
}

export async function buildWorkOsStaticBundleReviewApiReadModel(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_API_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "workOsStaticBundleReviewPacketCandidate")
    ? normalizeInlineJsonSource("inline.work_os_static_bundle_review_packet_candidate", options.workOsStaticBundleReviewPacketCandidate)
    : await readJsonOrBuildP37600(inputs.source_work_os_static_bundle_review_packet_candidate_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const apiRows = buildReviewApiResponseRows({ source, generatedAt });
  const fixtureRows = buildReviewUiConsumerFixtureRows({ source, apiRows, generatedAt });
  const routeRows = buildReviewRouteResponseContractRows({ apiRows, fixtureRows, generatedAt });
  const boundaryRows = buildNoReceiptAcceptApiWriteBoundaryRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const checkpointRows = buildCheckpointRows({ sourceState, apiRows, fixtureRows, routeRows, boundaryRows, wiringRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, apiRows, fixtureRows, routeRows, boundaryRows, wiringRows, checkpointRows });
  const validationItems = buildValidationItems({ phaseRows, sourceRows, apiRows, fixtureRows, routeRows, boundaryRows, wiringRows, checkpointRows, boundary });
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
      work_os_static_bundle_review_packet_candidate_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_work_os_static_bundle_review_summary: source.data?.summary ?? null,
    work_os_static_bundle_review_api_contract: buildContract(generatedAt),
    work_os_static_bundle_review_api_phase_rows: phaseRows,
    p37600_source_binding_rows: sourceRows,
    static_bundle_review_api_response_rows: apiRows,
    review_packet_ui_consumer_fixture_rows: fixtureRows,
    review_packet_route_response_contract_rows: routeRows,
    no_receipt_accept_api_write_boundary_rows: boundaryRows,
    work_os_static_bundle_review_api_wiring_rows: wiringRows,
    p38000_clean_checkpoint_rows: checkpointRows,
    work_os_static_bundle_review_api_boundary: boundary,
    work_os_static_bundle_review_api_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_static_bundle_review_api_read_model")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.work_os_static_bundle_review_api_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.work_os_static_bundle_review_api_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeWorkOsStaticBundleReviewApiReadModel(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-static-bundle-review-api-read-model.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p37600-source-binding-rows.json"), collectionEnvelope("p37600-source-binding-rows.v1", "p37600_source_binding_rows", result.p37600_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "static-bundle-review-api-response-rows.json"), collectionEnvelope("static-bundle-review-api-response-rows.v1", "static_bundle_review_api_response_rows", result.static_bundle_review_api_response_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-packet-ui-consumer-fixture-rows.json"), collectionEnvelope("review-packet-ui-consumer-fixture-rows.v1", "review_packet_ui_consumer_fixture_rows", result.review_packet_ui_consumer_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "review-packet-route-response-contract-rows.json"), collectionEnvelope("review-packet-route-response-contract-rows.v1", "review_packet_route_response_contract_rows", result.review_packet_route_response_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-receipt-accept-api-write-boundary-rows.json"), collectionEnvelope("no-receipt-accept-api-write-boundary-rows.v1", "no_receipt_accept_api_write_boundary_rows", result.no_receipt_accept_api_write_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-review-api-wiring-rows.json"), collectionEnvelope("work-os-static-bundle-review-api-wiring-rows.v1", "work_os_static_bundle_review_api_wiring_rows", result.work_os_static_bundle_review_api_wiring_rows, result.generated_at));
  await writeJson(path.join(outDir, "p38000-clean-checkpoint-rows.json"), collectionEnvelope("p38000-clean-checkpoint-rows.v1", "p38000_clean_checkpoint_rows", result.p38000_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-static-bundle-review-api-boundary.json"), result.work_os_static_bundle_review_api_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runWorkOsStaticBundleReviewApiReadModelCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runWorkOsStaticBundleReviewApiReadModel(args);
  console.log(`Work OS Static Bundle Review API Read Model ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.work_os_static_bundle_review_api_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P37600 ready for review API: ${result.summary.source_p37600_ready_for_review_api}`);
  console.log(`API responses: ${result.summary.static_bundle_review_api_response_count}`);
  console.log(`UI fixtures: ${result.summary.review_packet_ui_consumer_fixture_count}`);
  console.log(`Route contracts: ${result.summary.review_packet_route_response_contract_count}`);
  console.log(`Ready for static bundle review UI handoff: ${result.summary.ready_for_work_os_static_bundle_review_ui_handoff}`);
  console.log(`Review receipt accept allowed: ${result.summary.work_os_static_bundle_review_receipt_accept_allowed_now}`);
  console.log(`API write allowed: ${result.summary.work_os_static_bundle_review_api_write_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.work_os_static_bundle_review_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_work_os_review_request_handoff === true,
    status: summary.work_os_static_bundle_review_status ?? "missing",
    p37600ContractReady: boundary.p37600_contract_ready === true,
    packetVisible: boundary.static_bundle_review_packet_candidate_visible_now === true,
    evidenceVisible: boundary.review_evidence_summary_visible_now === true,
    findingVisible: boundary.finding_seed_visible_now === true,
    reviewerVisible: boundary.reviewer_lane_request_candidate_visible_now === true,
    noReviewCompletionClosed: boundary.no_review_completion_boundary_closed_now === true,
    wiringVisible: boundary.work_os_static_bundle_review_wiring_complete_now === true,
    boundaryClosed: P37600_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p37601-p38000.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P37600 review packet candidate source is available", sourceState.available],
    ["program_range", "P37600 source program range is P37201-P37600", sourceState.programRangeOk],
    ["validation_valid", "P37600 source validation is valid", sourceState.validationValid],
    ["review_api_handoff_open", "P37600 opened review request handoff", sourceState.sourceReady],
    ["p37600_contract_ready", "P37600 source contract is ready", sourceState.p37600ContractReady],
    ["packet_visible", "P37600 review packet candidates are visible", sourceState.packetVisible],
    ["evidence_visible", "P37600 review evidence summaries are visible", sourceState.evidenceVisible],
    ["finding_visible", "P37600 finding seeds are visible", sourceState.findingVisible],
    ["reviewer_visible", "P37600 reviewer lane request candidates are visible", sourceState.reviewerVisible],
    ["no_review_completion_closed", "P37600 no-review-completion boundary is closed", sourceState.noReviewCompletionClosed],
    ["review_wiring_visible", "P37600 review packet wiring is visible", sourceState.wiringVisible],
    ["commit_ref_present", "Current commit ref is present for review API read model", Boolean(commitRef)],
    ["source_blocker_visible", "P37600 source blocker is visible when review API handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p37600_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildReviewApiResponseRows({ source, generatedAt }) {
  const packetRows = source.data?.static_bundle_review_packet_candidate_rows ?? [];
  const evidenceRows = source.data?.review_evidence_summary_rows ?? [];
  const reviewerRows = source.data?.reviewer_lane_request_candidate_rows ?? [];
  return packetRows.map((packet) => {
    const evidence = evidenceRows.find((item) => item.request_id === packet.request_id);
    const reviewer = reviewerRows.find((item) => item.request_id === packet.request_id);
    return row({
      row_id: `static_bundle_review_api_response.${packet.request_id}`,
      category: "static_bundle_review_api_response",
      label: `Static bundle review API response candidate for ${packet.request_id}`,
      observed: Boolean(packet.request_id && packet.packet_visible_now === true && evidence && reviewer),
      evidence_ref: packet.row_id,
      request_id: packet.request_id,
      route_path: `/api/work-os/static-bundle-review/${packet.request_id}`,
      method: "GET",
      response_model_ref: `work_os.static_bundle_review.response.${packet.request_id}.candidate`,
      review_packet_ref: packet.review_packet_ref,
      evidence_summary_ref: evidence?.row_id ?? null,
      reviewer_lane_request_ref: reviewer?.row_id ?? null,
      expected_status: "blocked_review_packet_candidate_ready",
      read_only: true,
      api_server_start_allowed_now: false,
      route_registration_allowed_now: false,
      api_write_allowed_now: false,
      network_call_required_now: false,
      review_receipt_accept_allowed_now: false,
      review_completion_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildReviewUiConsumerFixtureRows({ source, apiRows, generatedAt }) {
  const findingRows = source.data?.finding_seed_rows ?? [];
  return apiRows.map((api) => {
    const findings = findingRows.filter((item) => item.request_id === api.request_id);
    return row({
      row_id: `review_packet_ui_consumer_fixture.${api.request_id}`,
      category: "review_packet_ui_consumer_fixture",
      label: `Review packet UI consumer fixture for ${api.request_id}`,
      observed: findings.length >= 3,
      evidence_ref: api.row_id,
      request_id: api.request_id,
      fixture_ref: `fixtures.work_os_static_bundle_review.${api.request_id}.smoke`,
      route_path: api.route_path,
      expected_status: api.expected_status,
      expected_finding_seed_count: findings.length,
      expected_visible_fields: ["request_id", "review_packet_ref", "evidence_summary_ref", "reviewer_lane_request_ref", "expected_status"],
      smoke_fixture_visible_now: true,
      fixture_persist_allowed_now: false,
      ui_mutation_allowed_now: false,
      ui_status_edit_allowed_now: false,
      ui_action_button_allowed_now: false,
      review_receipt_accept_allowed_now: false,
      reviewer_lane_dispatch_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildReviewRouteResponseContractRows({ apiRows, fixtureRows, generatedAt }) {
  return apiRows.map((api) => {
    const fixture = fixtureRows.find((item) => item.request_id === api.request_id);
    return row({
      row_id: `review_packet_route_response_contract.${api.request_id}`,
      category: "review_packet_route_response_contract",
      label: `Review packet route response contract for ${api.request_id}`,
      observed: Boolean(fixture && api.method === "GET"),
      evidence_ref: fixture?.row_id ?? api.row_id,
      request_id: api.request_id,
      route_path: api.route_path,
      allowed_methods: ["GET"],
      disallowed_methods: ["POST", "PATCH", "PUT", "DELETE"],
      response_model_ref: api.response_model_ref,
      route_contract_visible_now: true,
      api_post_allowed_now: false,
      api_patch_allowed_now: false,
      api_delete_allowed_now: false,
      api_write_allowed_now: false,
      review_receipt_accept_allowed_now: false,
      review_completion_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildNoReceiptAcceptApiWriteBoundaryRows(generatedAt) {
  const stateRows = [
    ["state.api_response_is_not_server_start", "Review API response candidate must not start an API server", true],
    ["state.route_contract_is_not_route_registration", "Review route contract candidate must not register runtime routes", true],
    ["state.ui_fixture_is_not_receipt_intake", "Review UI fixture must not accept review receipts", true],
    ["state.get_only_contract_blocks_write_and_receipt_accept", "GET-only contract must block write methods and receipt acceptance", true],
  ].map(([id, label, observed]) => row({
    row_id: `no_receipt_accept_api_write_boundary.${id}`,
    category: "no_receipt_accept_api_write_boundary",
    label,
    observed,
    evidence_ref: "work_os_static_bundle_review_api_boundary",
    generated_at: generatedAt,
  }));
  const boundaryRows = ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_receipt_accept_api_write_boundary.${flag}`,
    category: "no_receipt_accept_api_write_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "work_os_static_bundle_review_api_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
  return [...stateRows, ...boundaryRows];
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  return [
    ["package_script", "Package script is wired", hasScript(packageJson.data, COMMAND_NAME), "package.json"],
    ["validate_chain", "Validate chain includes P38000 check", packageJson.text.includes(`${COMMAND_NAME} -- --check`), "package.json"],
    ["schema_file", "Schema file is configured", packageJson.available, "schemas/work-os-static-bundle-review-api-read-model.schema.json"],
    ["roadmap_doc", "Roadmap documents all P37601-P38000 slices", PHASE_SPECS.every(([range]) => roadmapDoc.text.includes(range)), "docs/hermes-roadmap-p37601-p38000.md"],
    ["architecture_doc", "Architecture doc references P37601-P38000", architectureDoc.text.includes("P37601-P38000 Work OS Static Bundle Review API Read Model"), "docs/architecture.md"],
  ].map(([id, label, observed, evidenceRef]) => row({
    row_id: `work_os_static_bundle_review_api_wiring.${id}`,
    category: "work_os_static_bundle_review_api_wiring",
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
    && allPass(context.fixtureRows)
    && allPass(context.routeRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows);
  return [
    ["source_ready", "P37600 source is ready for review API read model handoff", context.sourceState.sourceReady],
    ["api_response_visible", "Review API response candidates are visible", allPass(context.apiRows)],
    ["ui_fixture_visible", "Review packet UI consumer fixtures are visible", allPass(context.fixtureRows)],
    ["route_contract_visible", "Review packet route response contracts are visible", allPass(context.routeRows)],
    ["no_receipt_accept_api_write_boundary_closed", "No-receipt-accept/API-write boundary stays closed", allPass(context.boundaryRows)],
    ["wiring_complete", "CLI, schema, package, roadmap, and architecture wiring are visible", allPass(context.wiringRows)],
    ["write_methods_blocked", "POST/PATCH/DELETE remain blocked", true],
    ["receipt_accept_blocked", "Review receipt acceptance remains blocked", true],
    ["reviewer_dispatch_blocked", "Reviewer dispatch remains blocked", true],
    ["review_api_handoff", "Review API handoff opens only as read-only metadata", ready],
  ].map(([id, label, observed]) => row({
    row_id: `p38000_checkpoint.${id}`,
    category: "p38000_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p38000_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p38000ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.apiRows)
    && allPass(context.fixtureRows)
    && allPass(context.routeRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows)
    && visibleOrPassed(context.checkpointRows, "p38000_checkpoint.write_methods_blocked")
    && visibleOrPassed(context.checkpointRows, "p38000_checkpoint.receipt_accept_blocked")
    && visibleOrPassed(context.checkpointRows, "p38000_checkpoint.reviewer_dispatch_blocked");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p38000ContractReady;
  return {
    p38000_contract_ready: p38000ContractReady,
    ready_for_work_os_static_bundle_review_ui_handoff: ready,
    source_p37600_ready_for_review_api: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    static_bundle_review_api_response_visible_now: allPass(context.apiRows),
    review_packet_ui_consumer_fixture_visible_now: allPass(context.fixtureRows),
    review_packet_route_response_contract_visible_now: allPass(context.routeRows),
    no_receipt_accept_api_write_boundary_closed_now: allPass(context.boundaryRows),
    work_os_static_bundle_review_api_wiring_complete_now: allPass(context.wiringRows),
    static_bundle_review_api_response_count: context.apiRows.length,
    review_packet_ui_consumer_fixture_count: context.fixtureRows.length,
    review_packet_route_response_contract_count: context.routeRows.length,
    api_write_allowed_count: context.routeRows.filter((item) => item.api_write_allowed_now === true).length,
    ui_mutation_allowed_count: context.fixtureRows.filter((item) => item.ui_mutation_allowed_now === true).length,
    server_start_allowed_count: context.apiRows.filter((item) => item.api_server_start_allowed_now === true).length,
    route_registration_allowed_count: context.apiRows.filter((item) => item.route_registration_allowed_now === true).length,
    review_receipt_accept_allowed_count: context.apiRows.filter((item) => item.review_receipt_accept_allowed_now === true).length
      + context.fixtureRows.filter((item) => item.review_receipt_accept_allowed_now === true).length
      + context.routeRows.filter((item) => item.review_receipt_accept_allowed_now === true).length,
    reviewer_dispatch_allowed_count: context.fixtureRows.filter((item) => item.reviewer_lane_dispatch_allowed_now === true).length,
    review_completion_allowed_count: context.apiRows.filter((item) => item.review_completion_allowed_now === true).length
      + context.routeRows.filter((item) => item.review_completion_allowed_now === true).length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  };
}

function buildValidationItems(context) {
  return [
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P37601-P38000 phase rows are incomplete"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P37600 source state is not visible"),
    validationItem("api.visible", "api", allPass(context.apiRows), "Review API response rows are incomplete"),
    validationItem("fixture.visible", "ui", allPass(context.fixtureRows), "Review UI consumer fixtures are incomplete"),
    validationItem("route.visible", "api", allPass(context.routeRows), "Review route response contracts are incomplete"),
    validationItem("boundary.visible", "authority", allPass(context.boundaryRows), "No-receipt-accept/API-write boundary rows are incomplete"),
    validationItem("wiring.complete", "wiring", allPass(context.wiringRows), "P37601-P38000 wiring is incomplete"),
    validationItem("no.server.start", "authority", context.apiRows.every((item) => item.api_server_start_allowed_now === false && item.route_registration_allowed_now === false), "API server start or route registration opened"),
    validationItem("get.only", "authority", context.routeRows.every((item) => Array.isArray(item.allowed_methods) && item.allowed_methods.length === 1 && item.allowed_methods[0] === "GET"), "Review API route contract is not GET-only"),
    validationItem("no.write.methods", "authority", context.routeRows.every((item) => item.api_post_allowed_now === false && item.api_patch_allowed_now === false && item.api_delete_allowed_now === false && item.api_write_allowed_now === false), "Write API method opened"),
    validationItem("no.ui.mutation", "authority", context.fixtureRows.every((item) => item.ui_mutation_allowed_now === false && item.ui_status_edit_allowed_now === false && item.ui_action_button_allowed_now === false), "Review UI mutation opened"),
    validationItem("no.receipt.accept", "authority", context.apiRows.every((item) => item.review_receipt_accept_allowed_now === false)
      && context.fixtureRows.every((item) => item.review_receipt_accept_allowed_now === false)
      && context.routeRows.every((item) => item.review_receipt_accept_allowed_now === false), "Review receipt acceptance opened"),
    validationItem("no.reviewer.dispatch", "authority", context.fixtureRows.every((item) => item.reviewer_lane_dispatch_allowed_now === false), "Reviewer lane dispatch opened"),
    validationItem("no.network.required", "authority", context.apiRows.every((item) => item.network_call_required_now === false), "Network call became required for review API candidate"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.write_methods_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p38000_checkpoint.write_methods_blocked"), "P38000 write method blocker checkpoint is not visible"),
    validationItem("checkpoint.receipt_accept_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p38000_checkpoint.receipt_accept_blocked"), "P38000 receipt accept blocker checkpoint is not visible"),
    validationItem("checkpoint.reviewer_dispatch_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p38000_checkpoint.reviewer_dispatch_blocked"), "P38000 reviewer dispatch blocker checkpoint is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "work_os_static_bundle_review_api_read_model.contract.v1",
    generated_at: generatedAt,
    source_p37600_required_or_rebuilt: true,
    review_api_response_candidate_required: true,
    ui_consumer_fixture_required: true,
    route_response_contract_required: true,
    no_receipt_accept_api_write_boundary_required: true,
    p38000_is_not_server_start_route_registration_api_write_review_receipt_accept_reviewer_dispatch_execution_approval_production_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_work_os_static_bundle_review_ui_handoff
    ? READY_STATUS
    : validation.valid && boundary.p38000_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    work_os_static_bundle_review_api_status: status,
    source_p37600_ready_for_review_api: boundary.source_p37600_ready_for_review_api,
    static_bundle_review_api_response_count: boundary.static_bundle_review_api_response_count,
    review_packet_ui_consumer_fixture_count: boundary.review_packet_ui_consumer_fixture_count,
    review_packet_route_response_contract_count: boundary.review_packet_route_response_contract_count,
    api_write_allowed_count: boundary.api_write_allowed_count,
    ui_mutation_allowed_count: boundary.ui_mutation_allowed_count,
    server_start_allowed_count: boundary.server_start_allowed_count,
    route_registration_allowed_count: boundary.route_registration_allowed_count,
    review_receipt_accept_allowed_count: boundary.review_receipt_accept_allowed_count,
    reviewer_dispatch_allowed_count: boundary.reviewer_dispatch_allowed_count,
    review_completion_allowed_count: boundary.review_completion_allowed_count,
    ready_for_work_os_static_bundle_review_ui_handoff: validation.valid && boundary.ready_for_work_os_static_bundle_review_ui_handoff,
    work_os_static_bundle_review_api_server_start_allowed_now: false,
    work_os_static_bundle_review_api_write_allowed_now: false,
    work_os_static_bundle_review_api_post_allowed_now: false,
    work_os_static_bundle_review_api_patch_allowed_now: false,
    work_os_static_bundle_review_api_delete_allowed_now: false,
    work_os_static_bundle_review_route_registration_allowed_now: false,
    work_os_static_bundle_review_network_call_required_now: false,
    work_os_static_bundle_review_ui_mutation_allowed_now: false,
    work_os_static_bundle_review_ui_status_edit_allowed_now: false,
    work_os_static_bundle_review_ui_action_button_allowed_now: false,
    work_os_static_bundle_review_receipt_accept_allowed_now: false,
    work_os_static_bundle_reviewer_lane_dispatch_allowed_now: false,
    work_os_static_bundle_claude_review_execution_allowed_now: false,
    work_os_static_bundle_review_completion_allowed_now: false,
    work_os_static_bundle_write_action_allowed_now: false,
    work_os_static_bundle_protected_action_allowed_now: false,
    work_os_static_bundle_final_approval_allowed_now: false,
    work_os_static_bundle_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Work OS Static Bundle Review API Read Model",
    "",
    `Status: ${result.summary.work_os_static_bundle_review_api_status}`,
    `Program: ${result.program_range}`,
    `P37600 ready for review API: ${result.summary.source_p37600_ready_for_review_api}`,
    `API responses: ${result.summary.static_bundle_review_api_response_count}`,
    `UI fixtures: ${result.summary.review_packet_ui_consumer_fixture_count}`,
    `Route contracts: ${result.summary.review_packet_route_response_contract_count}`,
    `Ready for static bundle review UI handoff: ${result.summary.ready_for_work_os_static_bundle_review_ui_handoff}`,
    `Review receipt accept allowed: ${result.summary.work_os_static_bundle_review_receipt_accept_allowed_now}`,
    `API write allowed: ${result.summary.work_os_static_bundle_review_api_write_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.review_packet_route_response_contract_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.route_path)}</td><td>${escapeHtml(item.allowed_methods.join(", "))}</td><td>${escapeHtml(item.review_receipt_accept_allowed_now)}</td><td>${escapeHtml(item.api_write_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Work OS Static Bundle Review API Read Model</title>
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
    <h1>Hermes Work OS Static Bundle Review API Read Model</h1>
    <p class="notice">This artifact defines read-only review packet API response candidates and UI consumer fixtures. It does not start a server, register routes, accept review receipts, dispatch reviewers, write API state, execute, deploy, approve, or claim production readiness.</p>
    <table><thead><tr><th>Request</th><th>Route</th><th>Allowed Methods</th><th>Receipt Accept</th><th>API Write</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP37600(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildWorkOsStaticBundleReviewPacketCandidate({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.work_os_static_bundle_review_packet_candidate", built);
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
  const defaults = DEFAULT_WORK_OS_STATIC_BUNDLE_REVIEW_API_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_work_os_static_bundle_review_packet_candidate_path: path.resolve(repoRoot, options.sourceWorkOsStaticBundleReviewPacketCandidatePath ?? defaults.sourceWorkOsStaticBundleReviewPacketCandidatePath),
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
      args.sourceWorkOsStaticBundleReviewPacketCandidatePath = argv[++index];
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
  console.log(`Usage: node scripts/work-os-static-bundle-review-api-read-model.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P37601-P38000 Work OS Static Bundle Review API Read Model.
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
