import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildReceiptCompletionOperatorWorkbench } from "./receipt-completion-operator-workbench.mjs";

export const DEFAULT_RECEIPT_WORKBENCH_API_READ_MODEL_OUT_DIR = "artifacts/receipt-workbench-api-read-model/latest";
export const DEFAULT_RECEIPT_WORKBENCH_API_READ_MODEL_INPUTS = {
  schemaPath: "schemas/receipt-workbench-api-read-model.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p22801-p23200.md",
  architectureDocPath: "docs/architecture.md",
  sourceReceiptCompletionOperatorWorkbenchPath: "artifacts/receipt-completion-operator-workbench/latest/receipt-completion-operator-workbench.json",
};

const COMMAND_NAME = "platform:receipt-workbench-api-read-model";
const SCHEMA_VERSION = "receipt-workbench-api-read-model.v1";
const CAPABILITY_ID = "platform.receipt_workbench_api_read_model";
const PROGRAM_RANGE = "P22801-P23200";
const SOURCE_PROGRAM_RANGE = "P22401-P22800";
const READY_STATUS = "ready_for_receipt_workbench_api_read_model";
const BLOCK_PENDING_STATUS = "valid_block_receipt_workbench_api_read_model_pending";
const BLOCKED_STATUS = "blocked_receipt_workbench_api_read_model";

const PHASE_SPECS = [
  ["P22801-P22840", "P22800 Source Binding", "p22800_source_binding_rows"],
  ["P22841-P22920", "Dashboard Read Model", "dashboard_read_model_rows"],
  ["P22921-P23000", "Read-Only API Projection", "read_only_api_projection_rows"],
  ["P23001-P23080", "Sanitized Field Map", "sanitized_field_map_rows"],
  ["P23081-P23140", "UI Status Summary", "ui_status_summary_rows"],
  ["P23141-P23180", "No-Route Boundary", "no_route_boundary_rows"],
  ["P23181-P23200", "P23200 Clean Checkpoint", "p23200_clean_checkpoint_rows"],
];

const API_ROUTE_SPECS = [
  ["/api/receipt-workbench/tasks", "tasks", "operator_workbench_task_rows"],
  ["/api/receipt-workbench/remediation-drafts", "remediation_drafts", "remediation_plan_draft_rows"],
  ["/api/receipt-workbench/evidence-requests", "evidence_requests", "evidence_request_packet_rows"],
  ["/api/receipt-workbench/review-router", "review_router", "review_escalation_router_rows"],
  ["/api/receipt-workbench/summary", "summary", "ui_status_summary_rows"],
];

const SANITIZED_FIELD_SPECS = [
  ["row_id", "Identifier field", true, false],
  ["receipt_type", "Receipt type field", true, false],
  ["task_state", "Task state field", true, false],
  ["next_action", "Next action field", true, false],
  ["owner_lane", "Owner lane field", true, false],
  ["required_evidence", "Required evidence field", true, false],
  ["evidence_ref", "Evidence reference field", true, false],
  ["route_ref", "Read-only route reference field", true, false],
  ["raw_stdout", "Raw stdout field", false, true],
  ["raw_stderr", "Raw stderr field", false, true],
  ["secret_material", "Secret material field", false, true],
  ["full_transcript", "Full transcript field", false, true],
  ["protected_payload", "Protected payload field", false, true],
];

const UI_STATUS_SPECS = [
  ["open_tasks", "Open read-only tasks are visible"],
  ["remediation_drafts", "Advisory remediation drafts are visible"],
  ["evidence_requests", "Evidence request packets are visible"],
  ["conditional_reviews", "Conditional review triggers are visible"],
  ["blockers_visible", "Blockers remain visible"],
  ["read_only_api_projection", "Read-only API projection is visible"],
  ["no_route_boundary", "No-route boundary is visible"],
];

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

const API_EXTRA_FALSE_FLAGS = [
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

export async function runReceiptWorkbenchApiReadModel(options = {}) {
  const result = await buildReceiptWorkbenchApiReadModel(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Receipt Workbench API Read Model failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeReceiptWorkbenchApiReadModel(result, result.output_dir);
  return result;
}

export async function buildReceiptWorkbenchApiReadModel(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RECEIPT_WORKBENCH_API_READ_MODEL_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "receiptCompletionOperatorWorkbench")
    ? normalizeInlineJsonSource("inline.receipt_completion_operator_workbench", options.receiptCompletionOperatorWorkbench)
    : await readJsonOrBuildP22800(inputs.source_receipt_completion_operator_workbench_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const dashboardRows = buildDashboardReadModelRows({ source, generatedAt });
  const apiRows = buildApiProjectionRows(generatedAt);
  const fieldRows = buildSanitizedFieldRows(generatedAt);
  const uiRows = buildUiStatusRows({ source, dashboardRows, apiRows, fieldRows, generatedAt });
  const boundaryRows = buildNoRouteBoundaryRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, dashboardRows, apiRows, fieldRows, uiRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, dashboardRows, apiRows, fieldRows, uiRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, dashboardRows, apiRows, fieldRows, uiRows, boundaryRows, checkpointRows, boundary });
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
      receipt_completion_operator_workbench_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_receipt_completion_operator_workbench_summary: source.data?.summary ?? null,
    receipt_workbench_api_read_model_contract: buildContract(generatedAt),
    receipt_workbench_api_read_model_phase_rows: phaseRows,
    p22800_source_binding_rows: sourceRows,
    dashboard_read_model_rows: dashboardRows,
    read_only_api_projection_rows: apiRows,
    sanitized_field_map_rows: fieldRows,
    ui_status_summary_rows: uiRows,
    no_route_boundary_rows: boundaryRows,
    p23200_clean_checkpoint_rows: checkpointRows,
    receipt_workbench_api_read_model_boundary: boundary,
    receipt_workbench_api_read_model_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "receipt_workbench_api_read_model")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.receipt_workbench_api_read_model_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.receipt_workbench_api_read_model_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeReceiptWorkbenchApiReadModel(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "receipt-workbench-api-read-model.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p22800-source-binding-rows.json"), collectionEnvelope("p22800-source-binding-rows.v1", "p22800_source_binding_rows", result.p22800_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "dashboard-read-model-rows.json"), collectionEnvelope("dashboard-read-model-rows.v1", "dashboard_read_model_rows", result.dashboard_read_model_rows, result.generated_at));
  await writeJson(path.join(outDir, "read-only-api-projection-rows.json"), collectionEnvelope("read-only-api-projection-rows.v1", "read_only_api_projection_rows", result.read_only_api_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "sanitized-field-map-rows.json"), collectionEnvelope("sanitized-field-map-rows.v1", "sanitized_field_map_rows", result.sanitized_field_map_rows, result.generated_at));
  await writeJson(path.join(outDir, "ui-status-summary-rows.json"), collectionEnvelope("ui-status-summary-rows.v1", "ui_status_summary_rows", result.ui_status_summary_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-route-boundary-rows.json"), collectionEnvelope("no-route-boundary-rows.v1", "no_route_boundary_rows", result.no_route_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p23200-clean-checkpoint-rows.json"), collectionEnvelope("p23200-clean-checkpoint-rows.v1", "p23200_clean_checkpoint_rows", result.p23200_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-workbench-api-read-model-boundary.json"), result.receipt_workbench_api_read_model_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runReceiptWorkbenchApiReadModelCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runReceiptWorkbenchApiReadModel(args);
  console.log(`Receipt Workbench API Read Model ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.receipt_workbench_api_read_model_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P22800 ready for P22801 handoff: ${result.summary.source_p22800_ready_for_p22801_handoff}`);
  console.log(`Dashboard rows: ${result.summary.dashboard_read_model_count}`);
  console.log(`Read-only API routes: ${result.summary.read_only_api_projection_count}`);
  console.log(`Ready for P23201 handoff: ${result.summary.ready_for_p23201_handoff}`);
  console.log(`Server started: ${result.summary.server_started_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.receipt_completion_operator_workbench_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p22801_handoff === true,
    status: summary.receipt_completion_operator_workbench_status ?? "missing",
    p22800ContractReady: boundary.p22800_contract_ready === true,
    workbenchVisible: boundary.operator_workbench_task_queue_visible_now === true,
    remediationVisible: boundary.remediation_plan_drafts_visible_now === true,
    evidenceVisible: boundary.evidence_request_packets_visible_now === true,
    reviewVisible: boundary.review_escalation_router_visible_now === true,
    noApplyClosed: boundary.no_apply_boundary_closed_now === true,
    boundaryClosed: protectedBoundaryClosed(boundary),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p22801-p23200.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P22800 receipt completion operator workbench source is available", sourceState.available],
    ["program_range", "P22800 source program range is P22401-P22800", sourceState.programRangeOk],
    ["validation_valid", "P22800 source validation is valid", sourceState.validationValid],
    ["p22801_handoff_open", "P22800 source opened P22801 handoff", sourceState.sourceReady],
    ["p22800_contract_ready", "P22800 source contract is ready", sourceState.p22800ContractReady],
    ["workbench_visible", "P22800 operator workbench task queue is visible", sourceState.workbenchVisible],
    ["remediation_visible", "P22800 remediation drafts are visible", sourceState.remediationVisible],
    ["evidence_visible", "P22800 evidence requests are visible", sourceState.evidenceVisible],
    ["review_visible", "P22800 review router is visible", sourceState.reviewVisible],
    ["no_apply_closed", "P22800 no-apply boundary is closed", sourceState.noApplyClosed],
    ["commit_ref_present", "Current commit ref is present for API read model", Boolean(commitRef)],
    ["source_blocker_visible", "P22800 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p22800_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildDashboardReadModelRows({ source, generatedAt }) {
  const taskRows = Array.isArray(source.data?.operator_workbench_task_rows)
    ? source.data.operator_workbench_task_rows
    : [];
  const rows = taskRows.map((item, index) => row({
    row_id: `dashboard_read_model.${item.receipt_type ?? index + 1}`,
    category: "dashboard_read_model",
    label: `Dashboard read model for ${item.receipt_type ?? item.row_id}`,
    observed: true,
    evidence_ref: item.row_id ?? "operator_workbench_task_rows",
    receipt_type: item.receipt_type ?? null,
    model_order: index + 1,
    display_state: item.task_state ?? "unknown",
    next_action: item.next_action ?? null,
    owner_lane: item.owner_lane ?? "operator",
    required_evidence: item.required_evidence ?? "redacted_receipt_candidate",
    detail_ref: item.evidence_ref ?? item.row_id ?? "operator_workbench_task_rows",
    raw_body_returns: false,
    full_body_returns: false,
    write_enabled: false,
    generated_at: generatedAt,
  }));
  rows.push(row({
    row_id: "dashboard_read_model.blocker_visibility",
    category: "dashboard_read_model",
    label: "Dashboard blocker visibility row",
    observed: true,
    evidence_ref: "receipt_completion_operator_workbench_boundary",
    display_state: "blocker_visible",
    next_action: "resolve_missing_or_unaccepted_receipt_evidence",
    raw_body_returns: false,
    full_body_returns: false,
    write_enabled: false,
    generated_at: generatedAt,
  }));
  return rows;
}

function buildApiProjectionRows(generatedAt) {
  return API_ROUTE_SPECS.map(([route, projectionId, collectionRef], index) => row({
    row_id: `api_projection.${projectionId}`,
    category: "read_only_api_projection",
    label: `Read-only API projection for ${projectionId}`,
    observed: true,
    evidence_ref: collectionRef,
    route,
    method: "GET",
    head_allowed: true,
    read_only: true,
    route_order: index + 1,
    collection_ref: collectionRef,
    write_enabled: false,
    mutates_state: false,
    server_start_required_now: false,
    route_handler_registered_now: false,
    route_execution_allowed_now: false,
    raw_body_returns: false,
    full_body_returns: false,
    generated_at: generatedAt,
  }));
}

function buildSanitizedFieldRows(generatedAt) {
  return SANITIZED_FIELD_SPECS.map(([fieldName, label, exposedNow, sensitive]) => row({
    row_id: `sanitized_field.${fieldName}`,
    category: "sanitized_field_map",
    label,
    observed: true,
    evidence_ref: "sanitized_field_map_rows",
    field_name: fieldName,
    exposed_now: exposedNow,
    forbidden_sensitive_field: sensitive,
    raw_or_secret_material: sensitive,
    generated_at: generatedAt,
  }));
}

function buildUiStatusRows({ source, dashboardRows, apiRows, fieldRows, generatedAt }) {
  const summary = source.data?.summary ?? {};
  const safeFields = fieldRows.filter((item) => item.exposed_now === true).length;
  const blockedFields = fieldRows.filter((item) => item.exposed_now === false).length;
  const values = {
    open_tasks: summary.open_read_only_task_count ?? dashboardRows.filter((item) => item.display_state === "task_open_read_only").length,
    remediation_drafts: summary.remediation_plan_count ?? 0,
    evidence_requests: summary.evidence_request_count ?? 0,
    conditional_reviews: 2,
    blockers_visible: dashboardRows.some((item) => item.display_state === "blocker_visible") ? 1 : 0,
    read_only_api_projection: apiRows.length,
    no_route_boundary: 1,
  };
  return UI_STATUS_SPECS.map(([id, label]) => row({
    row_id: `ui_status.${id}`,
    category: "ui_status_summary",
    label,
    observed: true,
    evidence_ref: id === "read_only_api_projection" ? "read_only_api_projection_rows" : "dashboard_read_model_rows",
    status_key: id,
    status_value: values[id] ?? 0,
    safe_field_count: safeFields,
    blocked_sensitive_field_count: blockedFields,
    read_only: true,
    generated_at: generatedAt,
  }));
}

function buildNoRouteBoundaryRows(generatedAt) {
  return [
    ...PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => [flag, `${flag} remains false`]),
    ...API_EXTRA_FALSE_FLAGS.map((flag) => [flag, `${flag} remains false`]),
  ].map(([flag, label]) => row({
    row_id: `no_route.${flag}`,
    category: "no_route_boundary",
    label,
    observed: true,
    evidence_ref: "receipt_workbench_api_read_model_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.dashboardRows)
    && allPass(context.apiRows)
    && allPass(context.fieldRows)
    && allPass(context.uiRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P22800 source is ready for P22801", context.sourceState.sourceReady],
    ["dashboard_read_model_visible", "Dashboard read model is visible", allPass(context.dashboardRows)],
    ["api_projection_visible", "Read-only API projection is visible", allPass(context.apiRows)],
    ["sanitized_field_map_visible", "Sanitized field map is visible", allPass(context.fieldRows)],
    ["ui_status_visible", "UI status summary is visible", allPass(context.uiRows)],
    ["no_route_boundary_closed", "No-route boundary remains closed", allPass(context.boundaryRows)],
    ["p23201_handoff_gate", "P23201 handoff opens only when API read model readiness conditions pass", handoffReady],
    ["p23201_handoff_blocker_visible", "P23201 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p23200_checkpoint.${id}`,
    category: "p23200_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p23200_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p23200ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.dashboardRows)
    && allPass(context.apiRows)
    && allPass(context.fieldRows)
    && allPass(context.uiRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p23200_checkpoint.p23201_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.dashboardRows)
    && allPass(context.apiRows)
    && allPass(context.fieldRows)
    && allPass(context.uiRows)
    && allPass(context.boundaryRows);
  return {
    p23200_contract_ready: p23200ContractReady,
    ready_for_p23201_handoff: handoffReady,
    source_p22800_ready_for_p22801_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    dashboard_read_model_visible_now: allPass(context.dashboardRows),
    read_only_api_projection_visible_now: allPass(context.apiRows),
    sanitized_field_map_visible_now: allPass(context.fieldRows),
    ui_status_summary_visible_now: allPass(context.uiRows),
    no_route_boundary_closed_now: allPass(context.boundaryRows),
    dashboard_read_model_count: context.dashboardRows.length,
    read_only_api_projection_count: context.apiRows.length,
    sanitized_field_count: context.fieldRows.length,
    ui_status_summary_count: context.uiRows.length,
    safe_exposed_field_count: context.fieldRows.filter((item) => item.exposed_now === true).length,
    blocked_sensitive_field_count: context.fieldRows.filter((item) => item.exposed_now === false).length,
    ...Object.fromEntries(API_EXTRA_FALSE_FLAGS.map((flag) => [flag, false])),
    ...Object.fromEntries(PROTECTED_BOUNDARY_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P22801-P23200 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P22801-P23200 Receipt Workbench API Read Model"), "Architecture doc missing P22801-P23200 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P22800 source state is not visible"),
    validationItem("dashboard.read_model", "dashboard", allPass(context.dashboardRows), "Dashboard read model rows are missing"),
    validationItem("api.get_head_only", "api", context.apiRows.every((item) => item.method === "GET" && item.head_allowed === true && item.write_enabled === false), "API projection is not GET/HEAD-only"),
    validationItem("api.no_server", "api", context.apiRows.every((item) => item.server_start_required_now === false && item.route_handler_registered_now === false), "API projection opened server or route handler"),
    validationItem("fields.sanitized", "fields", context.fieldRows.filter((item) => item.raw_or_secret_material).every((item) => item.exposed_now === false), "Sensitive fields exposed"),
    validationItem("boundary.no_route", "authority", context.boundary.server_started_now === false && context.boundary.api_write_allowed_now === false, "Server or API write opened"),
    validationItem("authority.closed", "authority", protectedBoundaryClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p23200_checkpoint.p23201_handoff_blocker_visible"), "P23200 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "receipt_workbench_api_read_model.contract.v1",
    generated_at: generatedAt,
    source_p22800_required_or_rebuilt: true,
    dashboard_read_model_required: true,
    read_only_api_projection_required: true,
    sanitized_field_map_required: true,
    p23201_handoff_is_not_api_service_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p23201_handoff
    ? READY_STATUS
    : validation.valid && boundary.p23200_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    receipt_workbench_api_read_model_status: status,
    source_p22800_ready_for_p22801_handoff: boundary.source_p22800_ready_for_p22801_handoff,
    dashboard_read_model_count: boundary.dashboard_read_model_count,
    read_only_api_projection_count: boundary.read_only_api_projection_count,
    sanitized_field_count: boundary.sanitized_field_count,
    ui_status_summary_count: boundary.ui_status_summary_count,
    safe_exposed_field_count: boundary.safe_exposed_field_count,
    blocked_sensitive_field_count: boundary.blocked_sensitive_field_count,
    ready_for_p23201_handoff: validation.valid && boundary.ready_for_p23201_handoff,
    server_start_required_now: false,
    server_started_now: false,
    route_handler_registered_now: false,
    route_execution_allowed_now: false,
    api_write_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Receipt Workbench API Read Model",
    "",
    `Status: ${result.summary.receipt_workbench_api_read_model_status}`,
    `Program: ${result.program_range}`,
    `P22800 ready for P22801 handoff: ${result.summary.source_p22800_ready_for_p22801_handoff}`,
    `Dashboard rows: ${result.summary.dashboard_read_model_count}`,
    `Read-only API routes: ${result.summary.read_only_api_projection_count}`,
    `Ready for P23201 handoff: ${result.summary.ready_for_p23201_handoff}`,
    `Server started: ${result.summary.server_started_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.read_only_api_projection_rows.map((item) => `<tr><td>${escapeHtml(item.route)}</td><td>${escapeHtml(item.method)}</td><td>${escapeHtml(item.head_allowed)}</td><td>${escapeHtml(item.write_enabled)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Receipt Workbench API Read Model</title>
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
    <h1>Hermes Receipt Workbench API Read Model</h1>
    <p class="notice">This artifact declares dashboard-ready read rows and GET/HEAD-only API projections. It does not start a server, register route handlers, or allow mutations.</p>
    <table><thead><tr><th>Route</th><th>Method</th><th>HEAD</th><th>Write</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP22800(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildReceiptCompletionOperatorWorkbench({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.receipt_completion_operator_workbench", built);
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
  const defaults = DEFAULT_RECEIPT_WORKBENCH_API_READ_MODEL_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_receipt_completion_operator_workbench_path: path.resolve(repoRoot, options.sourceReceiptCompletionOperatorWorkbenchPath ?? defaults.sourceReceiptCompletionOperatorWorkbenchPath),
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
      args.sourceReceiptCompletionOperatorWorkbenchPath = argv[++index];
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

function protectedBoundaryClosed(boundary) {
  return PROTECTED_BOUNDARY_FALSE_FLAGS.every((flag) => boundary?.[flag] === false);
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName]);
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
