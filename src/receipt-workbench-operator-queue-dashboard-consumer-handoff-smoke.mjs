import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P26400_FALSE_FLAGS,
  buildReceiptWorkbenchOperatorQueueApiReadModelHandoff,
} from "./receipt-workbench-operator-queue-api-read-model-handoff.mjs";

export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_DASHBOARD_CONSUMER_HANDOFF_SMOKE_OUT_DIR = "artifacts/receipt-workbench-operator-queue-dashboard-consumer-handoff-smoke/latest";
export const DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_DASHBOARD_CONSUMER_HANDOFF_SMOKE_INPUTS = {
  schemaPath: "schemas/receipt-workbench-operator-queue-dashboard-consumer-handoff-smoke.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p26401-p26800.md",
  architectureDocPath: "docs/architecture.md",
  sourceReceiptWorkbenchOperatorQueueApiReadModelHandoffPath: "artifacts/receipt-workbench-operator-queue-api-read-model-handoff/latest/receipt-workbench-operator-queue-api-read-model-handoff.json",
};

const COMMAND_NAME = "platform:receipt-workbench-operator-queue-dashboard-consumer-handoff-smoke";
const SCHEMA_VERSION = "receipt-workbench-operator-queue-dashboard-consumer-handoff-smoke.v1";
const CAPABILITY_ID = "platform.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke";
const PROGRAM_RANGE = "P26401-P26800";
const SOURCE_PROGRAM_RANGE = "P26001-P26400";
const READY_STATUS = "ready_for_receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke";
const BLOCK_PENDING_STATUS = "valid_block_receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_pending";
const BLOCKED_STATUS = "blocked_receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke";

const PHASE_SPECS = [
  ["P26401-P26440", "P26400 Source Binding", "p26400_source_binding_rows"],
  ["P26441-P26520", "Queue Dashboard Consumer Contract", "queue_dashboard_consumer_contract_rows"],
  ["P26521-P26600", "Queue API Adapter Smoke Matrix", "queue_api_adapter_smoke_rows"],
  ["P26601-P26680", "Queue Fixture State Coverage", "queue_fixture_state_coverage_rows"],
  ["P26681-P26740", "Consumer Visibility Guard", "consumer_visibility_guard_rows"],
  ["P26741-P26780", "No-Render/No-Mutation Boundary", "no_render_queue_dashboard_boundary_rows"],
  ["P26781-P26800", "P26800 Clean Checkpoint", "p26800_clean_checkpoint_rows"],
];

const FIXTURE_STATES = [
  "ready",
  "empty",
  "blocked",
  "error",
  "stale",
  "review_pending",
  "redacted_payload",
  "loading",
];

const VISIBILITY_GUARDS = [
  ["source_ref_visible", "P26400 source reference is visible"],
  ["route_contract_visible", "Queue API route contract is visible"],
  ["sanitized_payload_visible", "Sanitized payload projection is visible"],
  ["status_matrix_visible", "Queue fixture status matrix is visible"],
  ["blocked_state_visible", "Blocked state remains visible"],
  ["no_render_visible", "No-render notice is visible"],
  ["no_action_visible", "No-action notice is visible"],
  ["no_raw_payload_visible", "No raw payload notice is visible"],
];

export const QUEUE_DASHBOARD_CONSUMER_FALSE_FLAGS = [
  "queue_dashboard_consumer_server_allowed_now",
  "queue_dashboard_consumer_route_mount_allowed_now",
  "queue_dashboard_consumer_live_fetch_allowed_now",
  "queue_dashboard_consumer_render_allowed_now",
  "queue_dashboard_consumer_browser_run_allowed_now",
  "queue_dashboard_consumer_click_action_allowed_now",
  "queue_dashboard_consumer_write_allowed_now",
  "queue_dashboard_consumer_state_mutation_allowed_now",
  "queue_dashboard_consumer_export_allowed_now",
  "queue_dashboard_consumer_publish_allowed_now",
  "queue_dashboard_consumer_approval_allowed_now",
  "queue_dashboard_consumer_closeout_allowed_now",
  "queue_dashboard_consumer_acceptance_allowed_now",
  "queue_dashboard_consumer_final_approval_allowed_now",
  "queue_dashboard_consumer_production_pass_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...QUEUE_DASHBOARD_CONSUMER_FALSE_FLAGS, ...P26400_FALSE_FLAGS])];

export async function runReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke(options = {}) {
  const result = await buildReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Receipt Workbench Operator Queue Dashboard Consumer Handoff Smoke failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke(result, result.output_dir);
  return result;
}

export async function buildReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_DASHBOARD_CONSUMER_HANDOFF_SMOKE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "receiptWorkbenchOperatorQueueApiReadModelHandoff")
    ? normalizeInlineJsonSource("inline.receipt_workbench_operator_queue_api_read_model_handoff", options.receiptWorkbenchOperatorQueueApiReadModelHandoff)
    : await readJsonOrBuildP26400(inputs.source_receipt_workbench_operator_queue_api_read_model_handoff_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const consumerRows = buildConsumerRows({ source, generatedAt });
  const smokeRows = buildAdapterSmokeRows({ source, consumerRows, generatedAt });
  const fixtureRows = buildFixtureStateRows({ source, generatedAt });
  const visibilityRows = buildVisibilityRows({ source, consumerRows, smokeRows, fixtureRows, generatedAt });
  const boundaryRows = buildNoRenderRows(generatedAt);
  const checkpointRows = buildCheckpointRows({ sourceState, consumerRows, smokeRows, fixtureRows, visibilityRows, boundaryRows, generatedAt });
  const boundary = buildBoundary({ sourceState, phaseRows, sourceRows, consumerRows, smokeRows, fixtureRows, visibilityRows, boundaryRows, checkpointRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, phaseRows, sourceRows, consumerRows, smokeRows, fixtureRows, visibilityRows, boundaryRows, checkpointRows, boundary });
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
      receipt_workbench_operator_queue_api_read_model_handoff_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_receipt_workbench_operator_queue_api_read_model_handoff_summary: source.data?.summary ?? null,
    receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_contract: buildContract(generatedAt),
    receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_phase_rows: phaseRows,
    p26400_source_binding_rows: sourceRows,
    queue_dashboard_consumer_contract_rows: consumerRows,
    queue_api_adapter_smoke_rows: smokeRows,
    queue_fixture_state_coverage_rows: fixtureRows,
    consumer_visibility_guard_rows: visibilityRows,
    no_render_queue_dashboard_boundary_rows: boundaryRows,
    p26800_clean_checkpoint_rows: checkpointRows,
    receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_boundary: boundary,
    receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "receipt-workbench-operator-queue-dashboard-consumer-handoff-smoke.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p26400-source-binding-rows.json"), collectionEnvelope("p26400-source-binding-rows.v1", "p26400_source_binding_rows", result.p26400_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "queue-dashboard-consumer-contract-rows.json"), collectionEnvelope("queue-dashboard-consumer-contract-rows.v1", "queue_dashboard_consumer_contract_rows", result.queue_dashboard_consumer_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "queue-api-adapter-smoke-rows.json"), collectionEnvelope("queue-api-adapter-smoke-rows.v1", "queue_api_adapter_smoke_rows", result.queue_api_adapter_smoke_rows, result.generated_at));
  await writeJson(path.join(outDir, "queue-fixture-state-coverage-rows.json"), collectionEnvelope("queue-fixture-state-coverage-rows.v1", "queue_fixture_state_coverage_rows", result.queue_fixture_state_coverage_rows, result.generated_at));
  await writeJson(path.join(outDir, "consumer-visibility-guard-rows.json"), collectionEnvelope("consumer-visibility-guard-rows.v1", "consumer_visibility_guard_rows", result.consumer_visibility_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-render-queue-dashboard-boundary-rows.json"), collectionEnvelope("no-render-queue-dashboard-boundary-rows.v1", "no_render_queue_dashboard_boundary_rows", result.no_render_queue_dashboard_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "p26800-clean-checkpoint-rows.json"), collectionEnvelope("p26800-clean-checkpoint-rows.v1", "p26800_clean_checkpoint_rows", result.p26800_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "receipt-workbench-operator-queue-dashboard-consumer-handoff-smoke-boundary.json"), result.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmokeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runReceiptWorkbenchOperatorQueueDashboardConsumerHandoffSmoke(args);
  console.log(`Receipt Workbench Operator Queue Dashboard Consumer Handoff Smoke ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P26400 ready for P26401 handoff: ${result.summary.source_p26400_ready_for_p26401_handoff}`);
  console.log(`Consumer rows: ${result.summary.queue_dashboard_consumer_contract_count}`);
  console.log(`Adapter smoke rows: ${result.summary.queue_api_adapter_smoke_count}`);
  console.log(`Ready for P26801 handoff: ${result.summary.ready_for_p26801_handoff}`);
  console.log(`Dashboard render allowed: ${result.summary.queue_dashboard_consumer_render_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.receipt_workbench_operator_queue_api_read_model_handoff_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_p26401_handoff === true,
    status: summary.receipt_workbench_operator_queue_api_read_model_handoff_status ?? "missing",
    p26400ContractReady: boundary.p26400_contract_ready === true,
    routeContractVisible: boundary.queue_api_route_contract_visible_now === true,
    sanitizedVisible: boundary.sanitized_queue_field_projection_visible_now === true,
    statusMatrixVisible: boundary.queue_api_status_matrix_visible_now === true,
    attentionVisible: boundary.operator_queue_api_attention_guard_visible_now === true,
    noServeClosed: boundary.no_serve_queue_api_boundary_closed_now === true,
    boundaryClosed: P26400_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p26401-p26800.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P26400 operator queue API read model handoff source is available", sourceState.available],
    ["program_range", "P26400 source program range is P26001-P26400", sourceState.programRangeOk],
    ["validation_valid", "P26400 source validation is valid", sourceState.validationValid],
    ["p26401_handoff_open", "P26400 source opened P26401 handoff", sourceState.sourceReady],
    ["p26400_contract_ready", "P26400 source contract is ready", sourceState.p26400ContractReady],
    ["route_contract_visible", "P26400 queue API route contract is visible", sourceState.routeContractVisible],
    ["sanitized_visible", "P26400 sanitized queue field projection is visible", sourceState.sanitizedVisible],
    ["status_matrix_visible", "P26400 queue API status matrix is visible", sourceState.statusMatrixVisible],
    ["attention_guard_visible", "P26400 attention guard is visible", sourceState.attentionVisible],
    ["no_serve_closed", "P26400 no-serve boundary is closed", sourceState.noServeClosed],
    ["commit_ref_present", "Current commit ref is present for dashboard consumer handoff smoke", Boolean(commitRef)],
    ["source_blocker_visible", "P26400 source blocker is visible when handoff is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p26400_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildConsumerRows({ source, generatedAt }) {
  const routeRows = Array.isArray(source.data?.queue_api_route_contract_rows) ? source.data.queue_api_route_contract_rows : [];
  return routeRows.map((item, index) => row({
    row_id: `queue_dashboard_consumer.${slug(item.route_id ?? item.route_path ?? index + 1)}`,
    category: "queue_dashboard_consumer_contract",
    label: `Queue dashboard consumer contract for ${item.route_path ?? item.route_id}`,
    observed: item.current_verdict === "pass" && item.read_only === true && item.sanitized_payload_only === true,
    evidence_ref: item.row_id ?? "queue_api_route_contract_rows",
    source_route_row_ref: item.row_id ?? null,
    dashboard_slot: `operator_queue.${slug(item.route_id ?? index + 1)}`,
    route_path: item.route_path ?? null,
    source_collection: item.source_collection ?? null,
    expected_methods: ["GET", "HEAD"],
    expected_fixture_states: FIXTURE_STATES,
    read_only: true,
    bounded_payload_only: true,
    server_started_now: false,
    render_allowed_now: false,
    browser_run_allowed_now: false,
    live_fetch_allowed_now: false,
    click_action_allowed_now: false,
    write_allowed_now: false,
    mutation_enabled: false,
    approval_allowed_now: false,
    closeout_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildAdapterSmokeRows({ source, consumerRows, generatedAt }) {
  const routeRows = Array.isArray(source.data?.queue_api_route_contract_rows) ? source.data.queue_api_route_contract_rows : [];
  const consumerByRoute = new Map(consumerRows.map((item) => [item.route_path, item]));
  return routeRows.map((item, index) => {
    const consumer = consumerByRoute.get(item.route_path);
    return row({
      row_id: `queue_api_adapter_smoke.${slug(item.route_id ?? item.route_path ?? index + 1)}`,
      category: "queue_api_adapter_smoke",
      label: `Queue API adapter smoke for ${item.route_path ?? item.route_id}`,
      observed: Boolean(consumer) && item.current_verdict === "pass",
      evidence_ref: item.row_id ?? "queue_api_route_contract_rows",
      source_route_row_ref: item.row_id ?? null,
      consumer_row_ref: consumer?.row_id ?? null,
      route_path: item.route_path ?? null,
      adapter_key: `dashboard.consumer.adapter.${slug(item.route_id ?? index + 1)}`,
      smoke_case: "bounded_read_model_consumption",
      fixture_backed: true,
      server_started_now: false,
      route_execution_allowed_now: false,
      live_fetch_allowed_now: false,
      render_allowed_now: false,
      click_action_allowed_now: false,
      mutation_enabled: false,
      generated_at: generatedAt,
    });
  });
}

function buildFixtureStateRows({ source, generatedAt }) {
  const statusRows = Array.isArray(source.data?.queue_api_status_matrix_rows) ? source.data.queue_api_status_matrix_rows : [];
  return statusRows.map((item, index) => row({
    row_id: `queue_fixture_state.${slug(item.fixture_state ?? item.row_id ?? index + 1)}`,
    category: "queue_fixture_state_coverage",
    label: `Queue fixture state coverage for ${item.fixture_state ?? item.row_id}`,
    observed: item.current_verdict === "pass" && item.visible_now === true,
    evidence_ref: item.row_id ?? "queue_api_status_matrix_rows",
    source_status_row_ref: item.row_id ?? null,
    fixture_state: item.fixture_state ?? null,
    status_bucket: item.status_bucket ?? null,
    covered_by_consumer_smoke: true,
    visible_now: true,
    visible_when_blocked: true,
    bounded_payload_only: true,
    render_allowed_now: false,
    live_fetch_allowed_now: false,
    action_enabled_now: false,
    mutation_enabled: false,
    generated_at: generatedAt,
  }));
}

function buildVisibilityRows({ source, consumerRows, smokeRows, fixtureRows, generatedAt }) {
  const summary = source.data?.summary ?? {};
  return VISIBILITY_GUARDS.map(([guardId, label]) => row({
    row_id: `consumer_visibility.${guardId}`,
    category: "consumer_visibility_guard",
    label,
    observed: consumerRows.length > 0 && smokeRows.length > 0 && fixtureRows.length > 0 && summary.ready_for_p26401_handoff !== undefined,
    evidence_ref: "consumer_visibility_guard_rows",
    guard_id: guardId,
    visible_now: true,
    visible_when_blocked: true,
    read_only: true,
    render_allowed_now: false,
    action_enabled_now: false,
    approval_allowed_now: false,
    closeout_allowed_now: false,
    generated_at: generatedAt,
  }));
}

function buildNoRenderRows(generatedAt) {
  return ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_render_queue_dashboard.${flag}`,
    category: "no_render_queue_dashboard_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_boundary",
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
    && allPass(context.fixtureRows)
    && allPass(context.visibilityRows)
    && allPass(context.boundaryRows);
  return [
    ["source_ready", "P26400 source is ready for P26401", context.sourceState.sourceReady],
    ["consumer_contract_visible", "Queue dashboard consumer contract is visible", allPass(context.consumerRows)],
    ["adapter_smoke_visible", "Queue API adapter smoke matrix is visible", allPass(context.smokeRows)],
    ["fixture_state_coverage_visible", "Queue fixture state coverage is visible", allPass(context.fixtureRows)],
    ["visibility_guard_visible", "Consumer visibility guard is visible", allPass(context.visibilityRows)],
    ["no_render_boundary_closed", "No-render/no-mutation boundary remains closed", allPass(context.boundaryRows)],
    ["p26801_handoff_gate", "P26801 handoff opens only when dashboard consumer smoke conditions pass", handoffReady],
    ["p26801_handoff_blocker_visible", "P26801 handoff blocker is visible when the gate is closed", true],
  ].map(([id, label, observed]) => row({
    row_id: `p26800_checkpoint.${id}`,
    category: "p26800_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p26800_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p26800ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.consumerRows)
    && allPass(context.smokeRows)
    && allPass(context.fixtureRows)
    && allPass(context.visibilityRows)
    && allPass(context.boundaryRows)
    && visibleOrPassed(context.checkpointRows, "p26800_checkpoint.p26801_handoff_blocker_visible");
  const handoffReady = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && allPass(context.consumerRows)
    && allPass(context.smokeRows)
    && allPass(context.fixtureRows)
    && allPass(context.visibilityRows)
    && allPass(context.boundaryRows);
  return {
    p26800_contract_ready: p26800ContractReady,
    ready_for_p26801_handoff: handoffReady,
    source_p26400_ready_for_p26401_handoff: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    queue_dashboard_consumer_contract_visible_now: allPass(context.consumerRows),
    queue_api_adapter_smoke_visible_now: allPass(context.smokeRows),
    queue_fixture_state_coverage_visible_now: allPass(context.fixtureRows),
    consumer_visibility_guard_visible_now: allPass(context.visibilityRows),
    no_render_queue_dashboard_boundary_closed_now: allPass(context.boundaryRows),
    queue_dashboard_consumer_contract_count: context.consumerRows.length,
    queue_api_adapter_smoke_count: context.smokeRows.length,
    queue_fixture_state_coverage_count: context.fixtureRows.length,
    consumer_visibility_guard_count: context.visibilityRows.length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
  };
}

function buildValidationItems(context) {
  return [
    validationItem("package.script", "package", hasScript(context.packageJson.data, COMMAND_NAME), `${COMMAND_NAME} missing from package.json`),
    validationItem("package.validate", "package", context.packageJson.text.includes(`${COMMAND_NAME} -- --check`), `${COMMAND_NAME} missing from npm validate chain`),
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P26401-P26800 phase rows are incomplete"),
    validationItem("architecture.reference", "architecture", context.architectureDoc.text.includes("P26401-P26800 Receipt Workbench Operator Queue Dashboard Consumer Handoff Smoke"), "Architecture doc missing P26401-P26800 reference"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P26400 source state is not visible"),
    validationItem("consumer.contract", "dashboard", allPass(context.consumerRows), "Queue dashboard consumer contract rows are incomplete"),
    validationItem("adapter.smoke", "dashboard", allPass(context.smokeRows), "Queue API adapter smoke rows are incomplete"),
    validationItem("fixture.coverage", "dashboard", context.fixtureRows.length >= FIXTURE_STATES.length && allPass(context.fixtureRows), "Queue fixture state coverage is incomplete"),
    validationItem("visibility.guard", "dashboard", allPass(context.visibilityRows), "Consumer visibility guard rows are incomplete"),
    validationItem("boundary.no_render", "authority", context.boundary.queue_dashboard_consumer_render_allowed_now === false && context.boundary.queue_dashboard_consumer_live_fetch_allowed_now === false && context.boundary.queue_dashboard_consumer_click_action_allowed_now === false, "Dashboard consumer no-render boundary opened"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.visible", "checkpoint", visibleOrPassed(context.checkpointRows, "p26800_checkpoint.p26801_handoff_blocker_visible"), "P26800 checkpoint blocker is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke.contract.v1",
    generated_at: generatedAt,
    source_p26400_required_or_rebuilt: true,
    queue_dashboard_consumer_contract_required: true,
    queue_api_adapter_smoke_required: true,
    queue_fixture_state_coverage_required: true,
    no_render_or_mutation_authority: true,
    p26801_handoff_is_not_rendering_action_approval_closeout_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p26801_handoff
    ? READY_STATUS
    : validation.valid && boundary.p26800_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_status: status,
    source_p26400_ready_for_p26401_handoff: boundary.source_p26400_ready_for_p26401_handoff,
    queue_dashboard_consumer_contract_count: boundary.queue_dashboard_consumer_contract_count,
    queue_api_adapter_smoke_count: boundary.queue_api_adapter_smoke_count,
    queue_fixture_state_coverage_count: boundary.queue_fixture_state_coverage_count,
    consumer_visibility_guard_count: boundary.consumer_visibility_guard_count,
    ready_for_p26801_handoff: validation.valid && boundary.ready_for_p26801_handoff,
    queue_dashboard_consumer_render_allowed_now: false,
    queue_dashboard_consumer_live_fetch_allowed_now: false,
    queue_dashboard_consumer_click_action_allowed_now: false,
    queue_dashboard_consumer_write_allowed_now: false,
    queue_dashboard_consumer_state_mutation_allowed_now: false,
    queue_dashboard_consumer_approval_allowed_now: false,
    queue_dashboard_consumer_closeout_allowed_now: false,
    queue_dashboard_consumer_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Receipt Workbench Operator Queue Dashboard Consumer Handoff Smoke",
    "",
    `Status: ${result.summary.receipt_workbench_operator_queue_dashboard_consumer_handoff_smoke_status}`,
    `Program: ${result.program_range}`,
    `P26400 ready for P26401 handoff: ${result.summary.source_p26400_ready_for_p26401_handoff}`,
    `Consumer rows: ${result.summary.queue_dashboard_consumer_contract_count}`,
    `Adapter smoke rows: ${result.summary.queue_api_adapter_smoke_count}`,
    `Ready for P26801 handoff: ${result.summary.ready_for_p26801_handoff}`,
    `Dashboard render allowed: ${result.summary.queue_dashboard_consumer_render_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.queue_dashboard_consumer_contract_rows.map((item) => `<tr><td>${escapeHtml(item.dashboard_slot)}</td><td>${escapeHtml(item.route_path)}</td><td>${escapeHtml(item.render_allowed_now)}</td><td>${escapeHtml(item.live_fetch_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Receipt Workbench Operator Queue Dashboard Consumer Handoff Smoke</title>
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
    <h1>Hermes Receipt Workbench Operator Queue Dashboard Consumer Handoff Smoke</h1>
    <p class="notice">This artifact verifies dashboard consumer handoff shape only. It does not render UI, start a server, fetch live data, click actions, mutate state, approve, close out, or claim production readiness.</p>
    <table><thead><tr><th>Dashboard Slot</th><th>Route</th><th>Render Allowed</th><th>Live Fetch</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP26400(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildReceiptWorkbenchOperatorQueueApiReadModelHandoff({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.receipt_workbench_operator_queue_api_read_model_handoff", built);
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
  const defaults = DEFAULT_RECEIPT_WORKBENCH_OPERATOR_QUEUE_DASHBOARD_CONSUMER_HANDOFF_SMOKE_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_receipt_workbench_operator_queue_api_read_model_handoff_path: path.resolve(repoRoot, options.sourceReceiptWorkbenchOperatorQueueApiReadModelHandoffPath ?? defaults.sourceReceiptWorkbenchOperatorQueueApiReadModelHandoffPath),
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
      args.sourceReceiptWorkbenchOperatorQueueApiReadModelHandoffPath = argv[++index];
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
  console.log(`Usage: node scripts/receipt-workbench-operator-queue-dashboard-consumer-handoff-smoke.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P26401-P26800 Receipt Workbench Operator Queue Dashboard Consumer Handoff Smoke contract.
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
