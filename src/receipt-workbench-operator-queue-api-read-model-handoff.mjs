import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P26000_FALSE_FLAGS,
  buildReceiptWorkbenchOperatorQueueStatusProjection,
} from "./receipt-workbench-operator-queue-status-projection.mjs";

export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_API_READ_MODEL_HANDOFF_OUT_DIR = "artifacts/receipt-workbench-operator-queue-api-read-model-handoff/latest";
export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_API_READ_MODEL_HANDOFF_INPUTS = {
  schemaPath: "schemas/receipt-workbench-operator-queue-api-read-model-handoff.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p26001-p26400.md",
  architectureDocPath: "docs/architecture.md",
  sourceReceiptWorkbenchOperatorQueueStatusProjectionPath: "artifacts/receipt-workbench-operator-queue-status-projection/latest/receipt-workbench-operator-queue-status-projection.json",
};

const COMMAND_NAME = "platform:receipt-workbench-operator-queue-api-read-model-handoff";
const SCHEMA_VERSION = "receipt-workbench-operator-queue-api-read-model-handoff.v1";
const CAPABILITY_ID = "platform.receipt_workbench_operator_queue_api_read_model_handoff";
const PROGRAM_RANGE = "P26001-P26400";
const SOURCE_PROGRAM_RANGE = "P25601-P26000";
const READY_STATUS = "ready_for_receipt_workbench_operator_queue_api_read_model_handoff";
const BLOCK_PENDING_STATUS = "valid_block_receipt_workbench_operator_queue_api_read_model_handoff_pending";
const BLOCKED_STATUS = "blocked_receipt_workbench_operator_queue_api_read_model_handoff";

const PHASE_SPECS = [
  ["P26001-P26040", "P26000 Source Binding", "p26000_source_binding_rows"],
  ["P26041-P26120", "Queue API Route Contract", "queue_api_route_contract_rows"],
  ["P26121-P26200", "Sanitized Queue Field Projection", "sanitized_queue_field_projection_rows"],
  ["P26201-P26280", "Queue API Status Matrix", "queue_api_status_matrix_rows"],
  ["P26281-P26340", "Operator Queue API Attention Guard", "operator_queue_api_attention_guard_rows"],
  ["P26341-P26380", "No-Serve/No-Action Boundary", "no_serve_queue_api_boundary_rows"],
  ["P26381-P26400", "P26400 Clean Checkpoint", "p26400_clean_checkpoint_rows"],
];

const ROUTE_SPECS = [
  ["/api/receipt-workbench/operator-queue/items", "queue_items", "operator_queue_item_rows"],
  ["/api/receipt-workbench/operator-queue/status", "queue_status", "queue_status_summary_rows"],
  ["/api/receipt-workbench/operator-queue/filters", "queue_filters", "read_only_queue_filter_rows"],
  ["/api/receipt-workbench/operator-queue/attention", "queue_attention", "operator_attention_guard_rows"],
  ["/api/receipt-workbench/operator-queue/summary", "queue_summary", "summary"],
  ["/api/receipt-workbench/operator-queue/boundary", "queue_boundary", "receipt_workbench_operator_queue_status_projection_boundary"],
];

const FIELD_SPECS = [
  ["row_id", "Stable row identifier", true],
  ["queue_item_id", "Queue item identifier", true],
  ["queue_status", "Read-only queue status", true],
  ["status_bucket", "Status bucket", true],
  ["preview_surface", "Preview surface", true],
  ["consumer_surface_slot", "Consumer surface slot", true],
  ["evidence_ref", "Evidence reference", true],
  ["source_readiness_row_ref", "Source readiness reference", true],
  ["required_evidence_ref", "Required evidence reference", true],
  ["next_action_ref", "Advisory next action reference", true],
  ["attention_level", "Operator attention level", true],
  ["visible_when_blocked", "Blocked-state visibility marker", true],
  ["raw_stdout", "Raw stdout", false],
  ["raw_stderr", "Raw stderr", false],
  ["raw_secret_material", "Raw secret material", false],
  ["full_transcript", "Full transcript", false],
  ["raw_queue_payload", "Raw queue payload", false],
  ["protected_payload", "Protected payload", false],
];

const ATTENTION_GUARDS = [
  ["route_contract_visible", "Queue API route contract is visible"],
  ["sanitized_fields_visible", "Sanitized field projection is visible"],
  ["status_matrix_visible", "Queue API status matrix is visible"],
  ["blocked_state_visible", "Blocked queue API state is visible"],
  ["source_ref_visible", "P26000 source reference is visible"],
  ["no_server_visible", "No-server notice is visible"],
  ["no_action_visible", "No-action notice is visible"],
  ["no_raw_payload_visible", "No raw payload notice is visible"],
];

export const QUEUE_API_FALSE_FLAGS = [
  "operator_queue_api_write_allowed_now",
  "operator_queue_api_mutating_method_allowed_now",
  "operator_queue_api_server_start_required_now",
  "operator_queue_api_server_started_now",
  "operator_queue_api_route_handler_registered_now",
  "operator_queue_api_route_execution_allowed_now",
  "operator_queue_api_live_fetch_allowed_now",
  "operator_queue_api_route_mount_allowed_now",
  "operator_queue_api_action_allowed_now",
  "operator_queue_api_approval_allowed_now",
  "operator_queue_api_closeout_allowed_now",
  "operator_queue_api_acceptance_allowed_now",
  "operator_queue_api_export_allowed_now",
  "operator_queue_api_publish_allowed_now",
  "operator_queue_api_final_approval_allowed_now",
  "operator_queue_api_production_pass_allowed_now",
  "raw_queue_payload_exposure_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...QUEUE_API_FALSE_FLAGS, ...P26000_FALSE_FLAGS])];

export async function runReceiptWorkbenchOperatorQueueApiReadModelHandoff(options = {}) {
  const result = await buildReceiptWorkbenchOperatorQueueApiReadModelHandoff(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Receipt Workbench Operator Queue API Read Model Handoff failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeReceiptWorkbenchOperatorQueueApiReadModelHandoff(result, result.output_dir);
  return result;
}

export async function buildReceiptWorkbenchOperatorQueueApiReadModelHandoff(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_API_READ_MODEL_HANDOFF_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "receiptWorkbenchOperatorQueueStatusProjection")
    ? normalizeInlineJsonSource("inline.receipt_workbench_operator_queue_status_projection", options.receiptWorkbenchOperatorQueueStatusProjection)
    : await readJsonOrBuildP26000(inputs.source_receipt_workbench_operator_queue_status_projection_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const routeRows = buildRouteRows(generatedAt);
  const fieldRows = buildFieldRows(generatedAt);
  const statusRows = buildStatusMatrixRows({ source, routeRows, generatedAt });
  const attentionRows = buildAttentionRows({ source, routeRows, fieldRows, statusRows, generatedAt });
  const boundaryRows = buildNoServeRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, routeRows, fieldRows, statusRows, attentionRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, routeRows, fieldRows, statusRows, attentionRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, routeRows, fieldRows, statusRows, attentionRows, boundaryRows, checkpointRows, boundary });
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
      receipt_workbench_operator_queue_status_projection_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_receipt_workbench_operator_queue_status_projection_summary: source.data?.summary ?? null,
    receipt_workbench_operator_queue_api_read_model_handoff_contract: buildContract(generatedAt),
    receipt_workbench_operator_queue_api_read_model_handoff_phase_rows: phaseRows,
    p26000_source_binding_rows: sourceRows,
    queue_api_route_contract_rows: routeRows,
    sanitized_queue_field_projection_rows: fieldRows,
    queue_api_status_matrix_rows: statusRows,
    operator_queue_api_attention_guard_rows: attentionRows,
    no_serve_queue_api_boundary_rows: boundaryRows,
    p26400_clean_checkpoint_rows: checkpointRows,
    receipt_workbench_operator_queue_api_read_model_handoff_boundary: boundary,
    receipt_workbench_operator_queue_api_read_model_handoff_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "receipt_workbench_operator_queue_api_read_model_handoff")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.receipt_workbench_operator_queue_api_read_model_handoff_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.receipt_workbench_operator_queue_api_read_model_handoff_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeReceiptWorkbenchOperatorQueueApiReadModelHandoff(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "receipt-workbench-operator-queue-api-read-model-handoff.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p26000-source-binding-rows.json"), collectionEnvelope("p26000-source-binding-rows.v1", "p26000_source_binding_rows", result.p26000_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "queue-api-route-contract-rows.json"), collectionEnvelope("queue-api-route-contract-rows.v1", "queue_api_route_contract_rows", result.queue_api_route_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "sanitized-queue-field-projection-rows.json"), collectionEnvelope("sanitized-queue-field-projection-rows.v1", "sanitized_queue_field_projection_rows", result.sanitized_queue_field_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "queue-api-status-matrix-rows.json"), collectionEnvelope("queue-api-status-matrix-rows.v1", "queue_api_status_matrix_rows", result.queue_api_status_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-queue-api-attention-guard-rows.json"), collectionEnvelope("operator-queue-api-attention-guard-rows.v1", "operator_queue_api_attention_guard_rows", result.operator_queue_api_attention_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-serve-queue-api-boundary-rows.json"), collectionEnvelope("no-serve-queue-api-boundary-rows.v1", "no_serve_queue_api_boundary_rows", result.no_serve_queue_api_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p26400-clean-checkpoint-rows.json"), collectionEnvelope("p26400-clean-checkpoint-rows.v1", "p26400_clean_checkpoint_rows", result.p26400_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-workbench-operator-queue-api-read-model-handoff-boundary.json"), result.receipt_workbench_operator_queue_api_read_model_handoff_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runReceiptWorkbenchOperatorQueueApiReadModelHandoffCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runReceiptWorkbenchOperatorQueueApiReadModelHandoff(args);
  console.log(`Receipt Workbench Operator Queue API Read Model Handoff ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.receipt_workbench_operator_queue_api_read_model_handoff_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P26000 ready for P26001 handoff: ${result.summary.source_p26000_ready_for_p26001_handoff}`);
  console.log(`Queue API routes: ${result.summary.queue_api_route_contract_count}`);
  console.log(`Sanitized fields: ${result.summary.sanitized_queue_field_projection_count}`);
  console.log(`Ready for P26401 handoff: ${result.summary.ready_for_p26401_handoff}`);
  console.log(`Server started: ${result.summary.operator_queue_api_server_started_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.receipt_workbench_operator_queue_status_projection_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p26001_handoff === true,
    status: summary.receipt_workbench_operator_queue_status_projection_status ?? "missing",
    p26000ContractReady: boundary.p26000_contract_ready === true,
    queueVisible: boundary.operator_queue_item_visible_now === true,
    statusVisible: boundary.queue_status_summary_visible_now === true,
    filterVisible: boundary.read_only_queue_filter_visible_now === true,
    attentionVisible: boundary.operator_attention_guard_visible_now === true,
    noQueueActionClosed: boundary.no_queue_action_boundary_closed_now === true,
    boundaryClosed: P26000_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p26001-p26400.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P26000 operator queue status projection source is available", sourceState.available],
    ["program_range", "P26000 source program range is P25601-P26000", sourceState.programRangeOk],
    ["validation_valid", "P26000 source validation is valid", sourceState.validationValid],
    ["p26001_handoff_open", "P26000 source opened P26001 handoff", sourceState.sourceReady],
    ["p26000_contract_ready", "P26000 source contract is ready", sourceState.p26000ContractReady],
    ["queue_items_visible", "P26000 queue items are visible", sourceState.queueVisible],
    ["status_summary_visible", "P26000 queue status summary is visible", sourceState.statusVisible],
    ["filter_map_visible", "P26000 read-only filter map is visible", sourceState.filterVisible],
    ["attention_guard_visible", "P26000 attention guard is visible", sourceState.attentionVisible],
    ["no_queue_action_closed", "P26000 no-queue-action boundary is closed", sourceState.noQueueActionClosed],
    ["commit_ref_present", "Current commit ref is present for queue API read-model handoff", Boolean(commitRef)],
    ["source_blocker_visible", "P26000 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p26000_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildRouteRows(generatedAt) {
  return ROUTE_SPECS.map(([routePath, routeId, sourceCollection]) => row({
    row_id: `queue_api_route.${routeId}`,
    category: "queue_api_route_contract",
    label: `Read-only route contract for ${routePath}`,
    observed: true,
    evidence_ref: "queue_api_route_contract_rows",
    route_id: `receipt_workbench.operator_queue.${routeId}`,
    route_path: routePath,
    source_collection: sourceCollection,
    method_allowlist: ["GET", "HEAD"],
    forbidden_methods: ["POST", "PUT", "PATCH", "DELETE"],
    response_model: "bounded_redacted_json",
    read_only: true,
    sanitized_payload_only: true,
    server_start_required_now: false,
    server_started_now: false,
    route_handler_registered_now: false,
    route_execution_allowed_now: false,
    route_mount_allowed_now: false,
    mutating_method_allowed_now: false,
    action_enabled_now: false,
    approval_allowed_now: false,
    closeout_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildFieldRows(generatedAt) {
  return FIELD_SPECS.map(([fieldName, label, exposed]) => row({
    row_id: `sanitized_field.${fieldName}`,
    category: "sanitized_queue_field_projection",
    label,
    observed: true,
    evidence_ref: "sanitized_queue_field_projection_rows",
    field_name: fieldName,
    exposed_in_api: exposed,
    forbidden_in_api: !exposed,
    redacted_or_omitted: !exposed,
    raw_material: !exposed,
    generated_at: generatedAt,
  }));
}

function buildStatusMatrixRows({ source, routeRows, generatedAt }) {
  const statusRows = Array.isArray(source.data?.queue_status_summary_rows) ? source.data.queue_status_summary_rows : [];
  return statusRows.map((item, index) => row({
    row_id: `queue_api_status.${slug(item.fixture_state ?? item.row_id ?? index + 1)}`,
    category: "queue_api_status_matrix",
    label: `Queue API status matrix for ${item.fixture_state ?? item.row_id}`,
    observed: item.current_verdict === "pass" && item.visible_now === true && routeRows.length >= ROUTE_SPECS.length,
    evidence_ref: item.row_id ?? "queue_status_summary_rows",
    source_status_row_ref: item.row_id ?? null,
    route_ref: "queue_api_route.queue_status",
    fixture_state: item.fixture_state ?? null,
    status_bucket: item.status_bucket ?? "attention",
    visible_now: true,
    bounded_result_only: true,
    live_fetch_allowed_now: false,
    action_enabled_now: false,
    mutation_enabled: false,
    generated_at: generatedAt,
  }));
}

function buildAttentionRows({ source, routeRows, fieldRows, statusRows, generatedAt }) {
  const summary = source.data?.summary ?? {};
  return ATTENTION_GUARDS.map(([guardId, label]) => row({
    row_id: `queue_api_attention.${guardId}`,
    category: "operator_queue_api_attention_guard",
    label,
    observed: routeRows.length >= ROUTE_SPECS.length && fieldRows.length >= FIELD_SPECS.length && statusRows.length > 0 && summary.ready_for_p26001_handoff !== undefined,
    evidence_ref: "operator_queue_api_attention_guard_rows",
    guard_id: guardId,
    visible_now: true,
    visible_when_blocked: true,
    read_only: true,
    server_started_now: false,
    action_enabled_now: false,
    approval_allowed_now: false,
    closeout_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildNoServeRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_serve_queue_api.${flag}`,
    category: "no_serve_queue_api_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "receipt_workbench_operator_queue_api_read_model_handoff_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildCheckpointRows(context) {
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.routeRows)
    && allPass(context.fieldRows)
    && allPass(context.statusRows)
    && allPass(context.attentionRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P26000 source is ready for P26001", context.sourceState.sourceReady],
    ["routes_visible", "GET/HEAD queue API route contract is visible", allPass(context.routeRows)],
    ["sanitized_fields_visible", "Sanitized queue field projection is visible", allPass(context.fieldRows)],
    ["status_matrix_visible", "Queue API status matrix is visible", allPass(context.statusRows)],
    ["attention_guard_visible", "Operator queue API attention guard is visible", allPass(context.attentionRows)],
    ["no_serve_boundary_closed", "No-serve/no-action boundary remains closed", allPass(context.boundaryRows)],
    ["p26401_handoff_gate", "P26401 handoff opens only when queue API read model conditions pass", handoffReady],
    ["p26401_handoff_blocker_visible", "P26401 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p26400_checkpoint.${id}`,
    category: "p26400_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p26400_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p26400ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.routeRows)
    && allPass(context.fieldRows)
    && allPass(context.statusRows)
    && allPass(context.attentionRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p26400_checkpoint.p26401_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.routeRows)
    && allPass(context.fieldRows)
    && allPass(context.statusRows)
    && allPass(context.attentionRows)
    && allPass(context.boundaryRows);
  return {
    p26400_contract_ready: p26400ContractReady,
    ready_for_p26401_handoff: handoffReady,
    source_p26000_ready_for_p26001_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    queue_api_route_contract_visible_now: allPass(context.routeRows),
    sanitized_queue_field_projection_visible_now: allPass(context.fieldRows),
    queue_api_status_matrix_visible_now: allPass(context.statusRows),
    operator_queue_api_attention_guard_visible_now: allPass(context.attentionRows),
    no_serve_queue_api_boundary_closed_now: allPass(context.boundaryRows),
    queue_api_route_contract_count: context.routeRows.length,
    sanitized_queue_field_projection_count: context.fieldRows.length,
    queue_api_status_matrix_count: context.statusRows.length,
    operator_queue_api_attention_guard_count: context.attentionRows.length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P26001-P26400 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P26001-P26400 Receipt Workbench Operator Queue API Read Model Handoff"), "Architecture doc missing P26001-P26400 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P26000 source state is not visible"),
    validationItem("routes.get_head_only", "api", context.routeRows.every((item) => item.method_allowlist.includes("GET") && item.method_allowlist.includes("HEAD") && item.mutating_method_allowed_now === false), "Queue API route contract opened mutating methods"),
    validationItem("fields.sanitized", "api", context.fieldRows.some((item) => item.forbidden_in_api === true && item.redacted_or_omitted === true) && context.fieldRows.every((item) => item.raw_material !== true || item.exposed_in_api === false), "Sanitized queue field projection exposed raw material"),
    validationItem("status.matrix", "api", allPass(context.statusRows), "Queue API status matrix is incomplete"),
    validationItem("attention.guard", "attention", allPass(context.attentionRows) && context.attentionRows.every((item) => item.action_enabled_now === false), "Operator queue API attention guard opened action authority"),
    validationItem("boundary.no_serve", "authority", context.boundary.operator_queue_api_server_started_now === false && context.boundary.operator_queue_api_route_execution_allowed_now === false && context.boundary.operator_queue_api_action_allowed_now === false, "Queue API no-serve boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p26400_checkpoint.p26401_handoff_blocker_visible"), "P26400 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "receipt_workbench_operator_queue_api_read_model_handoff.contract.v1",
    generated_at: generatedAt,
    source_p26000_required_or_rebuilt: true,
    queue_api_route_contract_required: true,
    sanitized_queue_field_projection_required: true,
    no_server_start_or_route_execution_authority: true,
    p26401_handoff_is_not_api_serving_action_approval_closeout_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p26401_handoff
    ? READY_STATUS
    : validation.valid && boundary.p26400_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    receipt_workbench_operator_queue_api_read_model_handoff_status: status,
    source_p26000_ready_for_p26001_handoff: boundary.source_p26000_ready_for_p26001_handoff,
    queue_api_route_contract_count: boundary.queue_api_route_contract_count,
    sanitized_queue_field_projection_count: boundary.sanitized_queue_field_projection_count,
    queue_api_status_matrix_count: boundary.queue_api_status_matrix_count,
    operator_queue_api_attention_guard_count: boundary.operator_queue_api_attention_guard_count,
    ready_for_p26401_handoff: validation.valid && boundary.ready_for_p26401_handoff,
    operator_queue_api_server_started_now: false,
    operator_queue_api_route_handler_registered_now: false,
    operator_queue_api_route_execution_allowed_now: false,
    operator_queue_api_write_allowed_now: false,
    operator_queue_api_action_allowed_now: false,
    operator_queue_api_approval_allowed_now: false,
    operator_queue_api_closeout_allowed_now: false,
    operator_queue_api_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Receipt Workbench Operator Queue API Read Model Handoff",
    "",
    `Status: ${result.summary.receipt_workbench_operator_queue_api_read_model_handoff_status}`,
    `Program: ${result.program_range}`,
    `P26000 ready for P26001 handoff: ${result.summary.source_p26000_ready_for_p26001_handoff}`,
    `Queue API routes: ${result.summary.queue_api_route_contract_count}`,
    `Sanitized fields: ${result.summary.sanitized_queue_field_projection_count}`,
    `Ready for P26401 handoff: ${result.summary.ready_for_p26401_handoff}`,
    `Server started: ${result.summary.operator_queue_api_server_started_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.queue_api_route_contract_rows.map((item) => `<tr><td>${escapeHtml(item.route_path)}</td><td>${escapeHtml(item.method_allowlist.join(", "))}</td><td>${escapeHtml(item.server_started_now)}</td><td>${escapeHtml(item.route_execution_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Receipt Workbench Operator Queue API Read Model Handoff</title>
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
    <h1>Hermes Receipt Workbench Operator Queue API Read Model Handoff</h1>
    <p class="notice">This artifact defines a read-only API shape only. It does not start a server, mount routes, execute handlers, fetch live data, mutate state, approve, close out, or claim production readiness.</p>
    <table><thead><tr><th>Route</th><th>Methods</th><th>Server Started</th><th>Route Execution</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP26000(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildReceiptWorkbenchOperatorQueueStatusProjection({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.receipt_workbench_operator_queue_status_projection", built);
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
  const defaults = DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_API_READ_MODEL_HANDOFF_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_receipt_workbench_operator_queue_status_projection_path: path.resolve(repoRoot, options.sourceReceiptWorkbenchOperatorQueueStatusProjectionPath ?? defaults.sourceReceiptWorkbenchOperatorQueueStatusProjectionPath),
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
      args.sourceReceiptWorkbenchOperatorQueueStatusProjectionPath = argv[++index];
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
  console.log(`Usage: node scripts/receipt-workbench-operator-queue-api-read-model-handoff.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P26001-P26400 Receipt Workbench Operator Queue API Read Model Handoff contract.
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

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "unknown";
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
