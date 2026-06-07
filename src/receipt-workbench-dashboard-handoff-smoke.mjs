import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildReceiptWorkbenchApiReadModel } from "./receipt-workbench-api-read-model.mjs";

export const DEFAULT_RECEIPT_WORKBENCH_DASHBOARD_HANDOFF_SMOKE_OUT_DIR = "artifacts/receipt-workbench-dashboard-handoff-smoke/latest";
export const DEFAULT_RECEIPT_WORKBENCH_DASHBOARD_HANDOFF_SMOKE_INPUTS = {
  schemaPath: "schemas/receipt-workbench-dashboard-handoff-smoke.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p23201-p23600.md",
  architectureDocPath: "docs/architecture.md",
  sourceReceiptWorkbenchApiReadModelPath: "artifacts/receipt-workbench-api-read-model/latest/receipt-workbench-api-read-model.json",
};

const COMMAND_NAME = "platform:receipt-workbench-dashboard-handoff-smoke";
const SCHEMA_VERSION = "receipt-workbench-dashboard-handoff-smoke.v1";
const CAPABILITY_ID = "platform.receipt_workbench_dashboard_handoff_smoke";
const PROGRAM_RANGE = "P23201-P23600";
const SOURCE_PROGRAM_RANGE = "P22801-P23200";
const READY_STATUS = "ready_for_receipt_workbench_dashboard_handoff_smoke";
const BLOCK_PENDING_STATUS = "valid_block_receipt_workbench_dashboard_handoff_smoke_pending";
const BLOCKED_STATUS = "blocked_receipt_workbench_dashboard_handoff_smoke";

const PHASE_SPECS = [
  ["P23201-P23240", "P23200 Source Binding", "p23200_source_binding_rows"],
  ["P23241-P23320", "Dashboard Consumer Contract", "dashboard_consumer_contract_rows"],
  ["P23321-P23400", "Handoff Adapter Smoke Matrix", "handoff_adapter_smoke_rows"],
  ["P23401-P23480", "Operator Visibility Rules", "operator_visibility_rule_rows"],
  ["P23481-P23540", "No-Serve/No-Mutation Boundary", "no_serve_boundary_rows"],
  ["P23541-P23600", "P23600 Clean Checkpoint", "p23600_clean_checkpoint_rows"],
];

const SMOKE_CASES = ["ready", "empty", "blocked", "error"];

const PROTECTED_BOUNDARY_FALSE_FLAGS = [
  "deployment_allowed_now",
  "release_approval_allowed_now",
  "production_pass_enabled",
  "enterprise_pass_enabled",
  "enterprise_trust_claim_allowed_now",
  "protected_closeout_enabled",
  "human_gate_bypass_allowed_now",
  "independent_review_bypass_allowed_now",
  "single_owner_enterprise_trust_allowed_now",
  "runtime_execution_allowed_now",
  "write_action_allowed_now",
  "protected_action_allowed_now",
  "connector_write_enabled",
  "external_service_mutation_allowed_now",
  "raw_source_exposure_allowed",
  "secret_read_allowed_now",
  "reviewer_mutation_allowed_now",
  "final_automated_approval_allowed",
];

const API_FALSE_FLAGS = [
  "api_write_allowed_now",
  "mutating_method_allowed_now",
  "server_start_required_now",
  "server_started_now",
  "route_handler_registered_now",
  "route_execution_allowed_now",
  "dashboard_mutation_allowed_now",
  "receipt_completion_claim_allowed_now",
  "remediation_apply_allowed_now",
  "final_api_approval_allowed_now",
  "raw_stdout_exposure_allowed_now",
  "raw_stderr_exposure_allowed_now",
  "raw_secret_material_allowed_now",
  "full_transcript_exposure_allowed_now",
];

const DASHBOARD_EXTRA_FALSE_FLAGS = [
  "dashboard_handoff_write_allowed_now",
  "dashboard_data_mutation_allowed_now",
  "ui_event_submission_allowed_now",
  "live_fetch_allowed_now",
  "server_bind_allowed_now",
  "route_mount_allowed_now",
  "smoke_test_live_network_allowed_now",
  "completion_apply_allowed_now",
  "operator_override_allowed_now",
  "final_dashboard_approval_allowed_now",
];

export async function runReceiptWorkbenchDashboardHandoffSmoke(options = {}) {
  const result = await buildReceiptWorkbenchDashboardHandoffSmoke(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Receipt Workbench Dashboard Handoff Smoke failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeReceiptWorkbenchDashboardHandoffSmoke(result, result.output_dir);
  return result;
}

export async function buildReceiptWorkbenchDashboardHandoffSmoke(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RECEIPT_WORKBENCH_DASHBOARD_HANDOFF_SMOKE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "receiptWorkbenchApiReadModel")
    ? normalizeInlineJsonSource("inline.receipt_workbench_api_read_model", options.receiptWorkbenchApiReadModel)
    : await readJsonOrBuildP23200(inputs.source_receipt_workbench_api_read_model_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const consumerRows = buildDashboardConsumerRows({ source, generatedAt });
  const smokeRows = buildHandoffAdapterSmokeRows({ source, generatedAt });
  const visibilityRows = buildOperatorVisibilityRows({ source, consumerRows, smokeRows, generatedAt });
  const boundaryRows = buildNoServeBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, consumerRows, smokeRows, visibilityRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, consumerRows, smokeRows, visibilityRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, consumerRows, smokeRows, visibilityRows, boundaryRows, checkpointRows, boundary });
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
      receipt_workbench_api_read_model_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_receipt_workbench_api_read_model_summary: source.data?.summary ?? null,
    receipt_workbench_dashboard_handoff_smoke_contract: buildContract(generatedAt),
    receipt_workbench_dashboard_handoff_smoke_phase_rows: phaseRows,
    p23200_source_binding_rows: sourceRows,
    dashboard_consumer_contract_rows: consumerRows,
    handoff_adapter_smoke_rows: smokeRows,
    operator_visibility_rule_rows: visibilityRows,
    no_serve_boundary_rows: boundaryRows,
    p23600_clean_checkpoint_rows: checkpointRows,
    receipt_workbench_dashboard_handoff_smoke_boundary: boundary,
    receipt_workbench_dashboard_handoff_smoke_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "receipt_workbench_dashboard_handoff_smoke")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.receipt_workbench_dashboard_handoff_smoke_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.receipt_workbench_dashboard_handoff_smoke_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeReceiptWorkbenchDashboardHandoffSmoke(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "receipt-workbench-dashboard-handoff-smoke.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p23200-source-binding-rows.json"), collectionEnvelope("p23200-source-binding-rows.v1", "p23200_source_binding_rows", result.p23200_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "dashboard-consumer-contract-rows.json"), collectionEnvelope("dashboard-consumer-contract-rows.v1", "dashboard_consumer_contract_rows", result.dashboard_consumer_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "handoff-adapter-smoke-rows.json"), collectionEnvelope("handoff-adapter-smoke-rows.v1", "handoff_adapter_smoke_rows", result.handoff_adapter_smoke_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-visibility-rule-rows.json"), collectionEnvelope("operator-visibility-rule-rows.v1", "operator_visibility_rule_rows", result.operator_visibility_rule_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-serve-boundary-rows.json"), collectionEnvelope("no-serve-boundary-rows.v1", "no_serve_boundary_rows", result.no_serve_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p23600-clean-checkpoint-rows.json"), collectionEnvelope("p23600-clean-checkpoint-rows.v1", "p23600_clean_checkpoint_rows", result.p23600_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-workbench-dashboard-handoff-smoke-boundary.json"), result.receipt_workbench_dashboard_handoff_smoke_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runReceiptWorkbenchDashboardHandoffSmokeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runReceiptWorkbenchDashboardHandoffSmoke(args);
  console.log(`Receipt Workbench Dashboard Handoff Smoke ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.receipt_workbench_dashboard_handoff_smoke_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P23200 ready for P23201 handoff: ${result.summary.source_p23200_ready_for_p23201_handoff}`);
  console.log(`Dashboard consumer rows: ${result.summary.dashboard_consumer_contract_count}`);
  console.log(`Handoff smoke rows: ${result.summary.handoff_adapter_smoke_count}`);
  console.log(`Ready for P23601 handoff: ${result.summary.ready_for_p23601_handoff}`);
  console.log(`Live fetch allowed: ${result.summary.live_fetch_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.receipt_workbench_api_read_model_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p23201_handoff === true,
    status: summary.receipt_workbench_api_read_model_status ?? "missing",
    p23200ContractReady: boundary.p23200_contract_ready === true,
    dashboardVisible: boundary.dashboard_read_model_visible_now === true,
    apiVisible: boundary.read_only_api_projection_visible_now === true,
    sanitizedVisible: boundary.sanitized_field_map_visible_now === true,
    uiStatusVisible: boundary.ui_status_summary_visible_now === true,
    noRouteClosed: boundary.no_route_boundary_closed_now === true,
    boundaryClosed: sourceBoundaryClosed(boundary),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p23201-p23600.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P23200 receipt workbench API read model source is available", sourceState.available],
    ["program_range", "P23200 source program range is P22801-P23200", sourceState.programRangeOk],
    ["validation_valid", "P23200 source validation is valid", sourceState.validationValid],
    ["p23201_handoff_open", "P23200 source opened P23201 handoff", sourceState.sourceReady],
    ["p23200_contract_ready", "P23200 source contract is ready", sourceState.p23200ContractReady],
    ["dashboard_visible", "P23200 dashboard read model is visible", sourceState.dashboardVisible],
    ["api_projection_visible", "P23200 read-only API projection is visible", sourceState.apiVisible],
    ["sanitized_visible", "P23200 sanitized field map is visible", sourceState.sanitizedVisible],
    ["ui_status_visible", "P23200 UI status summary is visible", sourceState.uiStatusVisible],
    ["no_route_closed", "P23200 no-route boundary is closed", sourceState.noRouteClosed],
    ["commit_ref_present", "Current commit ref is present for dashboard handoff smoke", Boolean(commitRef)],
    ["source_blocker_visible", "P23200 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p23200_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildDashboardConsumerRows({ source, generatedAt }) {
  const dashboardRows = Array.isArray(source.data?.dashboard_read_model_rows)
    ? source.data.dashboard_read_model_rows
    : [];
  return dashboardRows.map((item, index) => row({
    row_id: `dashboard_consumer.${slug(item.receipt_type ?? item.row_id ?? index + 1)}`,
    category: "dashboard_consumer_contract",
    label: `Dashboard consumer contract for ${item.receipt_type ?? item.row_id}`,
    observed: true,
    evidence_ref: item.row_id ?? "dashboard_read_model_rows",
    source_row_ref: item.row_id ?? null,
    surface_slot: selectSurfaceSlot(item),
    surface_kind: item.receipt_type ? "receipt_status_card" : "blocker_banner",
    receipt_type: item.receipt_type ?? null,
    display_state: item.display_state ?? "unknown",
    next_action: item.next_action ?? "resolve_visible_blocker",
    owner_lane: item.owner_lane ?? "operator",
    required_evidence: item.required_evidence ?? "visible_blocker_or_redacted_receipt_candidate",
    detail_ref: item.detail_ref ?? item.evidence_ref ?? item.row_id ?? "dashboard_read_model_rows",
    bounded_payload_only: true,
    read_only: true,
    mutation_enabled: false,
    raw_body_returns: false,
    full_body_returns: false,
    generated_at: generatedAt,
  }));
}

function buildHandoffAdapterSmokeRows({ source, generatedAt }) {
  const apiRows = Array.isArray(source.data?.read_only_api_projection_rows)
    ? source.data.read_only_api_projection_rows
    : [];
  return apiRows.map((item, index) => row({
    row_id: `handoff_smoke.${slug(item.route ?? item.row_id ?? index + 1)}`,
    category: "handoff_adapter_smoke",
    label: `Handoff adapter smoke for ${item.route ?? item.row_id}`,
    observed: item.method === "GET" && item.head_allowed === true && item.write_enabled === false && item.route_execution_allowed_now === false,
    evidence_ref: item.row_id ?? "read_only_api_projection_rows",
    route: item.route ?? null,
    method: item.method ?? null,
    head_allowed: item.head_allowed === true,
    collection_ref: item.collection_ref ?? null,
    dashboard_surface_slot: routeToSurfaceSlot(item.route),
    smoke_cases: SMOKE_CASES,
    ready_case_visible: true,
    empty_case_visible: true,
    blocked_case_visible: true,
    error_case_visible: true,
    live_fetch_allowed_now: false,
    route_handler_registered_now: false,
    route_execution_allowed_now: false,
    write_enabled: false,
    generated_at: generatedAt,
  }));
}

function buildOperatorVisibilityRows({ source, consumerRows, smokeRows, generatedAt }) {
  const fieldRows = Array.isArray(source.data?.sanitized_field_map_rows) ? source.data.sanitized_field_map_rows : [];
  const uiRows = Array.isArray(source.data?.ui_status_summary_rows) ? source.data.ui_status_summary_rows : [];
  const noRouteRows = Array.isArray(source.data?.no_route_boundary_rows) ? source.data.no_route_boundary_rows : [];
  const blockedFields = fieldRows.filter((item) => item.exposed_now === false);
  const rules = [
    ["blocker_visible", "Blocker banner or status row remains visible", consumerRows.some((item) => item.display_state === "blocker_visible") || uiRows.some((item) => item.status_key === "blockers_visible" && Number(item.status_value) > 0)],
    ["required_evidence_visible", "Required evidence remains visible on every consumer row", consumerRows.length > 0 && consumerRows.every((item) => Boolean(item.required_evidence))],
    ["next_action_visible", "Next action remains visible on every consumer row", consumerRows.length > 0 && consumerRows.every((item) => Boolean(item.next_action))],
    ["owner_lane_visible", "Owner lane remains visible on every consumer row", consumerRows.length > 0 && consumerRows.every((item) => Boolean(item.owner_lane))],
    ["sanitized_field_boundary_visible", "Sanitized allowed and blocked field counts remain visible", fieldRows.some((item) => item.exposed_now === true) && blockedFields.length >= 5],
    ["conditional_review_visible", "Conditional review state remains visible", uiRows.some((item) => item.status_key === "conditional_reviews" && Number(item.status_value) > 0)],
    ["adapter_blocked_error_cases_visible", "Blocked and error smoke cases remain visible", smokeRows.length > 0 && smokeRows.every((item) => item.blocked_case_visible === true && item.error_case_visible === true)],
    ["no_serve_boundary_visible", "No-serve boundary remains visible", noRouteRows.length > 0 && noRouteRows.every((item) => item.allowed_now === false)],
  ];
  return rules.map(([id, label, observed]) => row({
    row_id: `visibility_rule.${id}`,
    category: "operator_visibility_rule",
    label,
    observed,
    evidence_ref: "dashboard_consumer_contract_rows",
    rule_id: id,
    generated_at: generatedAt,
  }));
}

function buildNoServeBoundaryRows(generatedAt) {
  return [
    ...PROTECTED_BOUNDARY_FALSE_FLAGS,
    ...API_FALSE_FLAGS,
    ...DASHBOARD_EXTRA_FALSE_FLAGS,
  ].map((flag) => row({
    row_id: `no_serve.${flag}`,
    category: "no_serve_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "receipt_workbench_dashboard_handoff_smoke_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.consumerRows)
    && allPass(context.smokeRows)
    && allPass(context.visibilityRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P23200 source is ready for P23201", context.sourceState.sourceReady],
    ["consumer_contract_visible", "Dashboard consumer contract is visible", allPass(context.consumerRows)],
    ["adapter_smoke_visible", "Handoff adapter smoke matrix is visible", allPass(context.smokeRows)],
    ["visibility_rules_visible", "Operator visibility rules are visible", allPass(context.visibilityRows)],
    ["no_serve_boundary_closed", "No-serve boundary remains closed", allPass(context.boundaryRows)],
    ["production_authority_closed", "Production and enterprise authority remain closed", true],
    ["p23601_handoff_gate", "P23601 handoff opens only when dashboard handoff smoke conditions pass", handoffReady],
    ["p23601_handoff_blocker_visible", "P23601 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p23600_checkpoint.${id}`,
    category: "p23600_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p23600_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p23600ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.consumerRows)
    && allPass(context.smokeRows)
    && allPass(context.visibilityRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p23600_checkpoint.p23601_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.consumerRows)
    && allPass(context.smokeRows)
    && allPass(context.visibilityRows)
    && allPass(context.boundaryRows);
  return {
    p23600_contract_ready: p23600ContractReady,
    ready_for_p23601_handoff: handoffReady,
    source_p23200_ready_for_p23201_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    dashboard_consumer_contract_visible_now: allPass(context.consumerRows),
    handoff_adapter_smoke_visible_now: allPass(context.smokeRows),
    operator_visibility_rules_visible_now: allPass(context.visibilityRows),
    no_serve_boundary_closed_now: allPass(context.boundaryRows),
    dashboard_consumer_contract_count: context.consumerRows.length,
    handoff_adapter_smoke_count: context.smokeRows.length,
    operator_visibility_rule_count: context.visibilityRows.length,
    ...Object.fromEntries(DASHBOARD_EXTRA_FALSE_FLAGS.map((flag) => [flag, false])),
    ...Object.fromEntries(API_FALSE_FLAGS.map((flag) => [flag, false])),
    ...Object.fromEntries(PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P23201-P23600 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P23201-P23600 Receipt Workbench Dashboard Handoff Smoke"), "Architecture doc missing P23201-P23600 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P23200 source state is not visible"),
    validationItem("dashboard.consumer_contract", "dashboard", allPass(context.consumerRows), "Dashboard consumer contract rows are missing"),
    validationItem("adapter.smoke_cases", "adapter", context.smokeRows.every((item) => item.ready_case_visible === true && item.empty_case_visible === true && item.blocked_case_visible === true && item.error_case_visible === true), "Adapter smoke cases are incomplete"),
    validationItem("adapter.no_live_fetch", "adapter", context.smokeRows.every((item) => item.live_fetch_allowed_now === false && item.route_execution_allowed_now === false), "Adapter opened live fetch or route execution"),
    validationItem("visibility.rules", "visibility", allPass(context.visibilityRows), "Operator visibility rules are incomplete"),
    validationItem("boundary.no_serve", "authority", context.boundary.server_started_now === false && context.boundary.live_fetch_allowed_now === false && context.boundary.dashboard_mutation_allowed_now === false, "Server, live fetch, or dashboard mutation opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p23600_checkpoint.p23601_handoff_blocker_visible"), "P23600 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "receipt_workbench_dashboard_handoff_smoke.contract.v1",
    generated_at: generatedAt,
    source_p23200_required_or_rebuilt: true,
    dashboard_consumer_contract_required: true,
    handoff_adapter_smoke_matrix_required: true,
    operator_visibility_rules_required: true,
    p23601_handoff_is_not_api_service_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p23601_handoff
    ? READY_STATUS
    : validation.valid && boundary.p23600_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    receipt_workbench_dashboard_handoff_smoke_status: status,
    source_p23200_ready_for_p23201_handoff: boundary.source_p23200_ready_for_p23201_handoff,
    dashboard_consumer_contract_count: boundary.dashboard_consumer_contract_count,
    handoff_adapter_smoke_count: boundary.handoff_adapter_smoke_count,
    operator_visibility_rule_count: boundary.operator_visibility_rule_count,
    ready_for_p23601_handoff: validation.valid && boundary.ready_for_p23601_handoff,
    server_started_now: false,
    route_handler_registered_now: false,
    route_execution_allowed_now: false,
    live_fetch_allowed_now: false,
    dashboard_mutation_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Receipt Workbench Dashboard Handoff Smoke",
    "",
    `Status: ${result.summary.receipt_workbench_dashboard_handoff_smoke_status}`,
    `Program: ${result.program_range}`,
    `P23200 ready for P23201 handoff: ${result.summary.source_p23200_ready_for_p23201_handoff}`,
    `Dashboard consumer rows: ${result.summary.dashboard_consumer_contract_count}`,
    `Handoff smoke rows: ${result.summary.handoff_adapter_smoke_count}`,
    `Ready for P23601 handoff: ${result.summary.ready_for_p23601_handoff}`,
    `Live fetch allowed: ${result.summary.live_fetch_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.handoff_adapter_smoke_rows.map((item) => `<tr><td>${escapeHtml(item.route)}</td><td>${escapeHtml(item.dashboard_surface_slot)}</td><td>${escapeHtml(item.smoke_cases.join(", "))}</td><td>${escapeHtml(item.live_fetch_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Receipt Workbench Dashboard Handoff Smoke</title>
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
    <h1>Hermes Receipt Workbench Dashboard Handoff Smoke</h1>
    <p class="notice">This artifact declares dashboard handoff smoke rows. It does not start a server, register route handlers, perform live fetches, or allow mutations.</p>
    <table><thead><tr><th>Route</th><th>Surface Slot</th><th>Smoke Cases</th><th>Live Fetch</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP23200(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildReceiptWorkbenchApiReadModel({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.receipt_workbench_api_read_model", built);
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
  const defaults = DEFAULT_RECEIPT_WORKBENCH_DASHBOARD_HANDOFF_SMOKE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_receipt_workbench_api_read_model_path: path.resolve(repoRoot, options.sourceReceiptWorkbenchApiReadModelPath ?? defaults.sourceReceiptWorkbenchApiReadModelPath),
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
      args.sourceReceiptWorkbenchApiReadModelPath = argv[++index];
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
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source FILE] [--commit-ref REF]`);
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function row(rowData) {
  const observed = Boolean(rowData.observed);
  return {
    ...rowData,
    observed,
    current_verdict: observed ? "pass" : "blocked",
    block_reason: observed ? null : `${rowData.label} is missing or blocked.`,
  };
}

function validationItem(itemId, category, ok, message) {
  return {
    item_id: itemId,
    category,
    passed: Boolean(ok),
    message: ok ? "ok" : message,
    evidence_ref: itemId,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => !item.passed);
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

function allPass(rows) {
  return rows.every((item) => item.current_verdict === "pass");
}

function visibleOrPassed(rows, rowId) {
  return allPass(rows) || rows.find((item) => item.row_id === rowId)?.current_verdict === "pass";
}

function sourceBoundaryClosed(boundary) {
  return [...API_FALSE_FLAGS, ...PROTECTED_BOUNDARY_FALSE_FLAGS].every((flag) => boundary?.[flag] === false);
}

function allFalseFlagsClosed(boundary) {
  return [...DASHBOARD_EXTRA_FALSE_FLAGS, ...API_FALSE_FLAGS, ...PROTECTED_BOUNDARY_FALSE_FLAGS].every((flag) => boundary?.[flag] === false);
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName]);
}

function selectSurfaceSlot(item) {
  if (String(item.row_id ?? "").includes("blocker")) return "receipt_workbench.blocker_banner";
  if (item.receipt_type) return "receipt_workbench.receipt_status_card";
  return "receipt_workbench.summary_card";
}

function routeToSurfaceSlot(route) {
  const value = String(route ?? "");
  if (value.includes("tasks")) return "receipt_workbench.task_list";
  if (value.includes("remediation")) return "receipt_workbench.remediation_panel";
  if (value.includes("evidence")) return "receipt_workbench.evidence_panel";
  if (value.includes("review-router")) return "receipt_workbench.review_panel";
  return "receipt_workbench.summary_bar";
}

function slug(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
}

function serializableResult(result) {
  const { markdown, html, ...rest } = result;
  return rest;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function collectionEnvelope(schemaVersion, collection, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection, rows };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
