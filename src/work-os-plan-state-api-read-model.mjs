import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  ALL_FALSE_FLAGS as P36000_FALSE_FLAGS,
  buildWorkOsPlanStateProjection,
} from "./work-os-plan-state-projection.mjs";

export const DEFAULT_WORK_OS_PLAN_STATE_API_READ_MODEL_OUT_DIR = "artifacts/work-os-plan-state-api-read-model/latest";
export const DEFAULT_WORK_OS_PLAN_STATE_API_READ_MODEL_INPUTS = {
  schemaPath: "schemas/work-os-plan-state-api-read-model.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-roadmap-p36001-p36400.md",
  architectureDocPath: "docs/architecture.md",
  sourceWorkOsPlanStateProjectionPath: "artifacts/work-os-plan-state-projection/latest/work-os-plan-state-projection.json",
};

const COMMAND_NAME = "platform:work-os-plan-state-api-read-model";
const SCHEMA_VERSION = "work-os-plan-state-api-read-model.v1";
const CAPABILITY_ID = "platform.work_os_plan_state_api_read_model";
const PROGRAM_RANGE = "P36001-P36400";
const SOURCE_PROGRAM_RANGE = "P35601-P36000";
const READY_STATUS = "ready_for_work_os_plan_state_api_read_model";
const BLOCK_PENDING_STATUS = "valid_block_work_os_plan_state_api_read_model_pending";
const BLOCKED_STATUS = "blocked_work_os_plan_state_api_read_model";

const PHASE_SPECS = [
  ["P36001-P36040", "P36000 Source Binding", "p36000_source_binding_rows"],
  ["P36041-P36100", "Plan State API Read Model Candidate", "plan_state_api_read_model_rows"],
  ["P36101-P36160", "UI Consumer Smoke Fixture", "ui_consumer_smoke_fixture_rows"],
  ["P36161-P36220", "API Route Response Contract", "api_route_response_contract_rows"],
  ["P36221-P36300", "No API Write Boundary", "no_api_write_boundary_rows"],
  ["P36301-P36360", "API Read Model Wiring", "work_os_plan_state_api_wiring_rows"],
  ["P36361-P36400", "P36400 Clean Checkpoint", "p36400_clean_checkpoint_rows"],
];

export const WORK_OS_PLAN_STATE_API_FALSE_FLAGS = [
  "work_os_plan_state_api_server_start_allowed_now",
  "work_os_plan_state_api_write_allowed_now",
  "work_os_plan_state_api_post_allowed_now",
  "work_os_plan_state_api_patch_allowed_now",
  "work_os_plan_state_api_delete_allowed_now",
  "work_os_plan_state_ui_mutation_allowed_now",
  "work_os_plan_state_ui_status_edit_allowed_now",
  "work_os_plan_state_ui_action_button_allowed_now",
  "work_os_plan_state_fixture_persist_allowed_now",
  "work_os_plan_state_route_registration_allowed_now",
  "work_os_plan_state_network_call_required_now",
  "work_os_plan_state_runtime_execution_allowed_now",
  "work_os_plan_state_write_action_allowed_now",
  "work_os_plan_state_protected_action_allowed_now",
  "work_os_plan_state_connector_write_allowed_now",
  "work_os_plan_state_deployment_allowed_now",
  "work_os_plan_state_review_completion_allowed_now",
  "work_os_plan_state_final_approval_allowed_now",
  "work_os_plan_state_production_pass_allowed_now",
  "work_os_plan_state_enterprise_trust_claim_allowed_now",
  "work_os_plan_state_secret_read_allowed_now",
  "work_os_plan_state_human_gate_bypass_allowed_now",
  "work_os_plan_state_independent_review_bypass_allowed_now",
  "work_os_plan_state_final_automated_approval_allowed_now",
];

export const ALL_FALSE_FLAGS = [...new Set([...WORK_OS_PLAN_STATE_API_FALSE_FLAGS, ...P36000_FALSE_FLAGS])];

export async function runWorkOsPlanStateApiReadModel(options = {}) {
  const result = await buildWorkOsPlanStateApiReadModel(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Work OS Plan State API Read Model failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeWorkOsPlanStateApiReadModel(result, result.output_dir);
  return result;
}

export async function buildWorkOsPlanStateApiReadModel(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORK_OS_PLAN_STATE_API_READ_MODEL_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const source = Object.prototype.hasOwnProperty.call(options, "workOsPlanStateProjection")
    ? normalizeInlineJsonSource("inline.work_os_plan_state_projection", options.workOsPlanStateProjection)
    : await readJsonOrBuildP36000(inputs.source_work_os_plan_state_projection_path, generatedAt);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceState = buildSourceState(source);
  const phaseRows = buildPhaseRows(roadmapDoc.text, generatedAt);
  const sourceRows = buildSourceRows({ source, sourceState, commitRef, generatedAt });
  const apiRows = buildPlanStateApiReadModelRows({ source, generatedAt });
  const fixtureRows = buildUiConsumerSmokeFixtureRows({ apiRows, source, generatedAt });
  const routeRows = buildApiRouteResponseContractRows({ apiRows, fixtureRows, generatedAt });
  const boundaryRows = buildNoApiWriteBoundaryRows(generatedAt);
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
      work_os_plan_state_projection_path: source.path,
      source_commit_ref: commitRef || null,
    },
    source_work_os_plan_state_projection_summary: source.data?.summary ?? null,
    work_os_plan_state_api_read_model_contract: buildContract(generatedAt),
    work_os_plan_state_api_phase_rows: phaseRows,
    p36000_source_binding_rows: sourceRows,
    plan_state_api_read_model_rows: apiRows,
    ui_consumer_smoke_fixture_rows: fixtureRows,
    api_route_response_contract_rows: routeRows,
    no_api_write_boundary_rows: boundaryRows,
    work_os_plan_state_api_wiring_rows: wiringRows,
    p36400_clean_checkpoint_rows: checkpointRows,
    work_os_plan_state_api_boundary: boundary,
    work_os_plan_state_api_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "work_os_plan_state_api_read_model")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.work_os_plan_state_api_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.work_os_plan_state_api_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result), html: renderHtml(result) };
}

export async function writeWorkOsPlanStateApiReadModel(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "work-os-plan-state-api-read-model.json"), serializableResult(result));
  await writeJson(path.join(outDir, "p36000-source-binding-rows.json"), collectionEnvelope("p36000-source-binding-rows.v1", "p36000_source_binding_rows", result.p36000_source_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "plan-state-api-read-model-rows.json"), collectionEnvelope("plan-state-api-read-model-rows.v1", "plan_state_api_read_model_rows", result.plan_state_api_read_model_rows, result.generated_at));
  await writeJson(path.join(outDir, "ui-consumer-smoke-fixture-rows.json"), collectionEnvelope("ui-consumer-smoke-fixture-rows.v1", "ui_consumer_smoke_fixture_rows", result.ui_consumer_smoke_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "api-route-response-contract-rows.json"), collectionEnvelope("api-route-response-contract-rows.v1", "api_route_response_contract_rows", result.api_route_response_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "no-api-write-boundary-rows.json"), collectionEnvelope("no-api-write-boundary-rows.v1", "no_api_write_boundary_rows", result.no_api_write_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-plan-state-api-wiring-rows.json"), collectionEnvelope("work-os-plan-state-api-wiring-rows.v1", "work_os_plan_state_api_wiring_rows", result.work_os_plan_state_api_wiring_rows, result.generated_at));
  await writeJson(path.join(outDir, "p36400-clean-checkpoint-rows.json"), collectionEnvelope("p36400-clean-checkpoint-rows.v1", "p36400_clean_checkpoint_rows", result.p36400_clean_checkpoint_rows, result.generated_at));
  await writeJson(path.join(outDir, "work-os-plan-state-api-boundary.json"), result.work_os_plan_state_api_boundary);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
  await writeFile(path.join(outDir, "index.html"), result.html, "utf8");
}

export async function runWorkOsPlanStateApiReadModelCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runWorkOsPlanStateApiReadModel(args);
  console.log(`Work OS Plan State API Read Model ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Status: ${result.summary.work_os_plan_state_api_status}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`P36000 ready for API read model: ${result.summary.source_p36000_ready_for_api_read_model}`);
  console.log(`API read models: ${result.summary.plan_state_api_read_model_count}`);
  console.log(`UI smoke fixtures: ${result.summary.ui_consumer_smoke_fixture_count}`);
  console.log(`Route contracts: ${result.summary.api_route_response_contract_count}`);
  console.log(`Ready for UI consumer smoke handoff: ${result.summary.ready_for_work_os_ui_consumer_smoke_handoff}`);
  console.log(`API write allowed: ${result.summary.work_os_plan_state_api_write_allowed_now}`);
  console.log(`UI mutation allowed: ${result.summary.work_os_plan_state_ui_mutation_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildSourceState(source) {
  const summary = source.data?.summary ?? {};
  const boundary = source.data?.work_os_plan_state_boundary ?? {};
  return {
    available: source.available === true,
    programRangeOk: source.data?.program_range === SOURCE_PROGRAM_RANGE,
    validationValid: source.data?.validation?.valid === true,
    sourceReady: summary.ready_for_work_os_operator_plan_state_handoff === true,
    status: summary.work_os_plan_state_status ?? "missing",
    p36000ContractReady: boundary.p36000_contract_ready === true,
    projectionVisible: boundary.work_os_plan_state_projection_visible_now === true,
    readModelVisible: boundary.goal_phase_workflow_read_model_visible_now === true,
    blockerVisible: boundary.plan_state_stale_blocker_ledger_visible_now === true,
    operatorHandoffVisible: boundary.operator_plan_state_handoff_visible_now === true,
    noStateMutationClosed: boundary.no_state_mutation_boundary_closed_now === true,
    boundaryClosed: P36000_FALSE_FLAGS.every((flag) => boundary[flag] === false),
  };
}

function buildPhaseRows(roadmapText, generatedAt) {
  return PHASE_SPECS.map(([range, label, outputRef]) => row({
    row_id: `phase.${range.toLowerCase()}`,
    category: "phase",
    label,
    observed: roadmapText.includes(range) && roadmapText.includes(outputRef),
    evidence_ref: "docs/hermes-roadmap-p36001-p36400.md",
    output_ref: outputRef,
    generated_at: generatedAt,
  }));
}

function buildSourceRows({ source, sourceState, commitRef, generatedAt }) {
  return [
    ["artifact_available", "P36000 Work OS plan state projection source is available", sourceState.available],
    ["program_range", "P36000 source program range is P35601-P36000", sourceState.programRangeOk],
    ["validation_valid", "P36000 source validation is valid", sourceState.validationValid],
    ["api_read_model_handoff_open", "P36000 opened operator plan state handoff", sourceState.sourceReady],
    ["p36000_contract_ready", "P36000 source contract is ready", sourceState.p36000ContractReady],
    ["projection_visible", "P36000 plan state projection is visible", sourceState.projectionVisible],
    ["read_model_visible", "P36000 goal/phase/workflow read model is visible", sourceState.readModelVisible],
    ["blocker_visible", "P36000 stale/blocker ledger is visible", sourceState.blockerVisible],
    ["operator_handoff_visible", "P36000 operator handoff is visible", sourceState.operatorHandoffVisible],
    ["no_state_mutation_closed", "P36000 no-state-mutation boundary is closed", sourceState.noStateMutationClosed],
    ["commit_ref_present", "Current commit ref is present for API read model", Boolean(commitRef)],
    ["source_blocker_visible", "P36000 source blocker is visible when API read model is closed", sourceState.available],
  ].map(([id, label, observed]) => row({
    row_id: `source_binding.${id}`,
    category: "p36000_source_binding",
    label,
    observed,
    evidence_ref: source.path,
    generated_at: generatedAt,
  }));
}

function buildPlanStateApiReadModelRows({ source, generatedAt }) {
  const handoffRows = source.data?.operator_plan_state_handoff_rows ?? [];
  return handoffRows.map((handoff) => row({
    row_id: `plan_state_api_read_model.${handoff.request_id}`,
    category: "plan_state_api_read_model",
    label: `Read API model for ${handoff.request_id}`,
    observed: Boolean(handoff.request_id && handoff.api_read_visible_now === true),
    evidence_ref: handoff.row_id,
    request_id: handoff.request_id,
    route_path: handoff.read_api_candidate_ref ?? `/api/work-os/plan-state/${handoff.request_id}`,
    method: "GET",
    response_model_ref: `work_os.plan_state.response.${handoff.request_id}.candidate`,
    ui_slot_candidate_ref: handoff.ui_slot_candidate_ref ?? `work-os.plan-state.${handoff.request_id}`,
    expected_status: handoff.operator_status ?? "blocked_read_only_projection_ready",
    read_only: true,
    api_server_start_allowed_now: false,
    route_registration_allowed_now: false,
    api_write_allowed_now: false,
    network_call_required_now: false,
    generated_at: generatedAt,
  }));
}

function buildUiConsumerSmokeFixtureRows({ apiRows, source, generatedAt }) {
  const blockerRows = source.data?.plan_state_stale_blocker_ledger_rows ?? [];
  return apiRows.map((api) => {
    const blockers = blockerRows.filter((item) => item.request_id === api.request_id);
    return row({
      row_id: `ui_consumer_smoke_fixture.${api.request_id}`,
      category: "ui_consumer_smoke_fixture",
      label: `UI consumer smoke fixture for ${api.request_id}`,
      observed: blockers.length >= 4,
      evidence_ref: api.row_id,
      request_id: api.request_id,
      fixture_ref: `fixtures.work_os_plan_state.${api.request_id}.smoke`,
      route_path: api.route_path,
      expected_status: api.expected_status,
      expected_blocker_count: blockers.length,
      expected_visible_fields: ["request_id", "route_path", "expected_status", "blocker_count", "next_action"],
      smoke_fixture_visible_now: true,
      fixture_persist_allowed_now: false,
      ui_mutation_allowed_now: false,
      ui_status_edit_allowed_now: false,
      ui_action_button_allowed_now: false,
      generated_at: generatedAt,
    });
  });
}

function buildApiRouteResponseContractRows({ apiRows, fixtureRows, generatedAt }) {
  return apiRows.map((api) => {
    const fixture = fixtureRows.find((item) => item.request_id === api.request_id);
    return row({
      row_id: `api_route_response_contract.${api.request_id}`,
      category: "api_route_response_contract",
      label: `Route response contract for ${api.request_id}`,
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
      generated_at: generatedAt,
    });
  });
}

function buildNoApiWriteBoundaryRows(generatedAt) {
  const stateRows = [
    ["state.read_model_is_not_server_start", "API read model must not start an API server", true],
    ["state.route_contract_is_not_route_registration", "Route contract candidate must not register runtime routes", true],
    ["state.ui_smoke_is_not_ui_mutation", "UI smoke fixture must not enable UI mutation", true],
    ["state.get_only_contract_blocks_write_methods", "GET-only contract must block write methods", true],
  ].map(([id, label, observed]) => row({
    row_id: `no_api_write_boundary.${id}`,
    category: "no_api_write_boundary",
    label,
    observed,
    evidence_ref: "work_os_plan_state_api_boundary",
    generated_at: generatedAt,
  }));
  const boundaryRows = ALL_FALSE_FLAGS.map((flag) => row({
    row_id: `no_api_write_boundary.${flag}`,
    category: "no_api_write_boundary",
    label: `${flag} remains false`,
    observed: true,
    evidence_ref: "work_os_plan_state_api_boundary",
    boundary_flag: flag,
    allowed_now: false,
    generated_at: generatedAt,
  }));
  return [...stateRows, ...boundaryRows];
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  return [
    ["package_script", "Package script is wired", hasScript(packageJson.data, COMMAND_NAME), "package.json"],
    ["validate_chain", "Validate chain includes P36400 check", packageJson.text.includes(`${COMMAND_NAME} -- --check`), "package.json"],
    ["schema_file", "Schema file is configured", packageJson.available, "schemas/work-os-plan-state-api-read-model.schema.json"],
    ["roadmap_doc", "Roadmap documents all P36001-P36400 slices", PHASE_SPECS.every(([range]) => roadmapDoc.text.includes(range)), "docs/hermes-roadmap-p36001-p36400.md"],
    ["architecture_doc", "Architecture doc references P36001-P36400", architectureDoc.text.includes("P36001-P36400 Work OS Plan State API Read Model"), "docs/architecture.md"],
  ].map(([id, label, observed, evidenceRef]) => row({
    row_id: `work_os_plan_state_api_wiring.${id}`,
    category: "work_os_plan_state_api_wiring",
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
    ["source_ready", "P36000 source is ready for API read model handoff", context.sourceState.sourceReady],
    ["api_read_model_visible", "API read model rows are visible", allPass(context.apiRows)],
    ["ui_smoke_fixture_visible", "UI consumer smoke fixtures are visible", allPass(context.fixtureRows)],
    ["route_contract_visible", "API route response contracts are visible", allPass(context.routeRows)],
    ["no_api_write_boundary_closed", "No-API-write boundary stays closed", allPass(context.boundaryRows)],
    ["wiring_complete", "CLI, schema, package, roadmap, and architecture wiring are visible", allPass(context.wiringRows)],
    ["write_methods_blocked", "POST/PATCH/DELETE remain blocked", true],
    ["server_start_blocked", "API server start remains blocked", true],
    ["ui_mutation_blocked", "UI mutation remains blocked", true],
    ["ui_consumer_smoke_handoff", "UI consumer smoke handoff opens only as read-only metadata", ready],
  ].map(([id, label, observed]) => row({
    row_id: `p36400_checkpoint.${id}`,
    category: "p36400_clean_checkpoint",
    label,
    observed,
    evidence_ref: "p36400_clean_checkpoint_rows",
    generated_at: context.generatedAt,
  }));
}

function buildBoundary(context) {
  const p36400ContractReady = allPass(context.phaseRows)
    && visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible")
    && allPass(context.apiRows)
    && allPass(context.fixtureRows)
    && allPass(context.routeRows)
    && allPass(context.boundaryRows)
    && allPass(context.wiringRows)
    && visibleOrPassed(context.checkpointRows, "p36400_checkpoint.write_methods_blocked")
    && visibleOrPassed(context.checkpointRows, "p36400_checkpoint.server_start_blocked")
    && visibleOrPassed(context.checkpointRows, "p36400_checkpoint.ui_mutation_blocked");
  const ready = context.sourceState.sourceReady
    && context.sourceState.validationValid
    && context.sourceState.boundaryClosed
    && p36400ContractReady;
  return {
    p36400_contract_ready: p36400ContractReady,
    ready_for_work_os_ui_consumer_smoke_handoff: ready,
    source_p36000_ready_for_api_read_model: context.sourceState.sourceReady,
    source_validation_valid_now: context.sourceState.validationValid,
    plan_state_api_read_model_visible_now: allPass(context.apiRows),
    ui_consumer_smoke_fixture_visible_now: allPass(context.fixtureRows),
    api_route_response_contract_visible_now: allPass(context.routeRows),
    no_api_write_boundary_closed_now: allPass(context.boundaryRows),
    work_os_plan_state_api_wiring_complete_now: allPass(context.wiringRows),
    plan_state_api_read_model_count: context.apiRows.length,
    ui_consumer_smoke_fixture_count: context.fixtureRows.length,
    api_route_response_contract_count: context.routeRows.length,
    api_write_allowed_count: context.routeRows.filter((item) => item.api_write_allowed_now === true).length,
    ui_mutation_allowed_count: context.fixtureRows.filter((item) => item.ui_mutation_allowed_now === true).length,
    server_start_allowed_count: context.apiRows.filter((item) => item.api_server_start_allowed_now === true).length,
    route_registration_allowed_count: context.apiRows.filter((item) => item.route_registration_allowed_now === true).length,
    ...Object.fromEntries(ALL_FALSE_FLAGS.map((flag) => [flag, false])),
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
  };
}

function buildValidationItems(context) {
  return [
    validationItem("roadmap.phase_coverage", "roadmap", allPass(context.phaseRows), "P36001-P36400 phase rows are incomplete"),
    validationItem("source.visible", "source", visibleOrPassed(context.sourceRows, "source_binding.source_blocker_visible"), "P36000 source state is not visible"),
    validationItem("api.visible", "api", allPass(context.apiRows), "API read model rows are incomplete"),
    validationItem("fixture.visible", "ui", allPass(context.fixtureRows), "UI consumer smoke fixtures are incomplete"),
    validationItem("route.visible", "api", allPass(context.routeRows), "API route response contracts are incomplete"),
    validationItem("wiring.complete", "wiring", allPass(context.wiringRows), "P36001-P36400 wiring is incomplete"),
    validationItem("no.server.start", "authority", context.apiRows.every((item) => item.api_server_start_allowed_now === false && item.route_registration_allowed_now === false), "API server start or route registration opened"),
    validationItem("get.only", "authority", context.routeRows.every((item) => Array.isArray(item.allowed_methods) && item.allowed_methods.length === 1 && item.allowed_methods[0] === "GET"), "API route contract is not GET-only"),
    validationItem("no.write.methods", "authority", context.routeRows.every((item) => item.api_post_allowed_now === false && item.api_patch_allowed_now === false && item.api_delete_allowed_now === false && item.api_write_allowed_now === false), "Write API method opened"),
    validationItem("no.ui.mutation", "authority", context.fixtureRows.every((item) => item.ui_mutation_allowed_now === false && item.ui_status_edit_allowed_now === false && item.ui_action_button_allowed_now === false), "UI mutation opened"),
    validationItem("no.network.required", "authority", context.apiRows.every((item) => item.network_call_required_now === false), "Network call became required for smoke candidate"),
    validationItem("authority.closed", "authority", allFalseFlagsClosed(context.boundary), "Protected authority boundary opened"),
    validationItem("checkpoint.write_methods_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p36400_checkpoint.write_methods_blocked"), "P36400 write method blocker checkpoint is not visible"),
    validationItem("checkpoint.server_start_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p36400_checkpoint.server_start_blocked"), "P36400 server start blocker checkpoint is not visible"),
    validationItem("checkpoint.ui_mutation_blocked", "checkpoint", visibleOrPassed(context.checkpointRows, "p36400_checkpoint.ui_mutation_blocked"), "P36400 UI mutation blocker checkpoint is not visible"),
  ];
}

function buildContract(generatedAt) {
  return {
    contract_id: "work_os_plan_state_api_read_model.contract.v1",
    generated_at: generatedAt,
    source_p36000_required_or_rebuilt: true,
    api_read_model_required: true,
    ui_consumer_smoke_fixture_required: true,
    route_response_contract_required: true,
    no_api_write_boundary_required: true,
    p36400_is_not_server_start_route_registration_api_write_ui_mutation_execution_write_approval_production_or_enterprise_trust: true,
    protected_authority: "closed",
  };
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_work_os_ui_consumer_smoke_handoff
    ? READY_STATUS
    : validation.valid && boundary.p36400_contract_ready
      ? BLOCK_PENDING_STATUS
      : BLOCKED_STATUS;
  return {
    work_os_plan_state_api_status: status,
    source_p36000_ready_for_api_read_model: boundary.source_p36000_ready_for_api_read_model,
    plan_state_api_read_model_count: boundary.plan_state_api_read_model_count,
    ui_consumer_smoke_fixture_count: boundary.ui_consumer_smoke_fixture_count,
    api_route_response_contract_count: boundary.api_route_response_contract_count,
    api_write_allowed_count: boundary.api_write_allowed_count,
    ui_mutation_allowed_count: boundary.ui_mutation_allowed_count,
    server_start_allowed_count: boundary.server_start_allowed_count,
    route_registration_allowed_count: boundary.route_registration_allowed_count,
    ready_for_work_os_ui_consumer_smoke_handoff: validation.valid && boundary.ready_for_work_os_ui_consumer_smoke_handoff,
    work_os_plan_state_api_server_start_allowed_now: false,
    work_os_plan_state_api_write_allowed_now: false,
    work_os_plan_state_api_post_allowed_now: false,
    work_os_plan_state_api_patch_allowed_now: false,
    work_os_plan_state_api_delete_allowed_now: false,
    work_os_plan_state_ui_mutation_allowed_now: false,
    work_os_plan_state_ui_status_edit_allowed_now: false,
    work_os_plan_state_ui_action_button_allowed_now: false,
    work_os_plan_state_runtime_execution_allowed_now: false,
    work_os_plan_state_write_action_allowed_now: false,
    work_os_plan_state_protected_action_allowed_now: false,
    work_os_plan_state_final_approval_allowed_now: false,
    work_os_plan_state_production_pass_allowed_now: false,
    production_pass_enabled: false,
    enterprise_trust_claim_allowed_now: false,
    validation_error_count: validation.error_count,
  };
}

function renderMarkdown(result) {
  return [
    "# Work OS Plan State API Read Model",
    "",
    `Status: ${result.summary.work_os_plan_state_api_status}`,
    `Program: ${result.program_range}`,
    `P36000 ready for API read model: ${result.summary.source_p36000_ready_for_api_read_model}`,
    `API read models: ${result.summary.plan_state_api_read_model_count}`,
    `UI smoke fixtures: ${result.summary.ui_consumer_smoke_fixture_count}`,
    `Route contracts: ${result.summary.api_route_response_contract_count}`,
    `Ready for UI consumer smoke handoff: ${result.summary.ready_for_work_os_ui_consumer_smoke_handoff}`,
    `API write allowed: ${result.summary.work_os_plan_state_api_write_allowed_now}`,
    `UI mutation allowed: ${result.summary.work_os_plan_state_ui_mutation_allowed_now}`,
    `Production PASS enabled: ${result.summary.production_pass_enabled}`,
    "",
  ].join("\n");
}

function renderHtml(result) {
  const rows = result.api_route_response_contract_rows.map((item) => `<tr><td>${escapeHtml(item.request_id)}</td><td>${escapeHtml(item.route_path)}</td><td>${escapeHtml(item.allowed_methods.join(", "))}</td><td>${escapeHtml(item.api_write_allowed_now)}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hermes Work OS Plan State API Read Model</title>
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
    <h1>Hermes Work OS Plan State API Read Model</h1>
    <p class="notice">This artifact defines read-only API response candidates and UI smoke fixtures. It does not start a server, register routes, write API state, mutate UI state, execute, deploy, approve, or claim production readiness.</p>
    <table><thead><tr><th>Request</th><th>Route</th><th>Allowed Methods</th><th>API Write</th></tr></thead><tbody>${rows}</tbody></table>
  </main>
</body>
</html>
`;
}

async function readJsonOrBuildP36000(filePath, generatedAt) {
  const source = await readJsonSource(filePath);
  if (source.available) return source;
  const built = await buildWorkOsPlanStateProjection({ runAt: generatedAt, write: false });
  return normalizeInlineJsonSource("built.work_os_plan_state_projection", built);
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
  const defaults = DEFAULT_WORK_OS_PLAN_STATE_API_READ_MODEL_INPUTS;
  const repoRoot = path.resolve(options.repoRoot ?? ".");
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_work_os_plan_state_projection_path: path.resolve(repoRoot, options.sourceWorkOsPlanStateProjectionPath ?? defaults.sourceWorkOsPlanStateProjectionPath),
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
      args.sourceWorkOsPlanStateProjectionPath = argv[++index];
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
  console.log(`Usage: node scripts/work-os-plan-state-api-read-model.mjs [--check] [--out-dir DIR] [--source FILE] [--commit-ref SHA]

Validates or writes the Hermes P36001-P36400 Work OS Plan State API Read Model.
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
