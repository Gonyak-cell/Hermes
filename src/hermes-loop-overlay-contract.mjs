import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  HERMES_LOOP_AUTHORITY_FALSE_FLAGS,
  buildHermesLoopSourceBinding,
} from "./hermes-loop-source-binding.mjs";

export const DEFAULT_HERMES_LOOP_OVERLAY_CONTRACT_OUT_DIR = "artifacts/hermes-loop-overlay-contract/latest";
export const DEFAULT_HERMES_LOOP_OVERLAY_CONTRACT_INPUTS = {
  schemaPath: "schemas/hermes-loop-overlay-contract.schema.json",
  packagePath: "package.json",
  sourceSpecPath: "docs/hermes-loop-system-specification.md",
  roadmapDocPath: "docs/hermes-roadmap-p60401-p60800.md",
  architectureDocPath: "docs/architecture.md",
  sourceBindingPath: "artifacts/hermes-loop-source-binding/latest/hermes-loop-source-binding.json",
};

const COMMAND_NAME = "platform:hermes-loop-overlay-contract";
const SCHEMA_VERSION = "hermes-loop-overlay-contract.v1";
const CAPABILITY_ID = "platform.hermes_loop_system_v1_1_overlay_contract";
const PROGRAM_RANGE = "P60401-P60800";
const SOURCE_PROGRAM_RANGE = "P60001-P60400";
const NEXT_PROGRAM_RANGE = "P60801-P61200";

const LOOP_DEFINITION_FIELDS = [
  "schema_version",
  "loop_definition_id",
  "loop_name",
  "loop_version",
  "owner_engine",
  "responsible_owner",
  "applicable_projects",
  "applicable_domain_packs",
  "capability_id",
  "workflow_id",
  "trigger_policy",
  "source_contracts",
  "context_policy",
  "runtime_policy",
  "tool_policy",
  "verification_policy",
  "human_gate_policy",
  "memory_policy",
  "evidence_policy",
  "retry_policy",
  "timeout_policy",
  "cost_policy",
  "boundary_policy",
  "exit_conditions",
  "validation_chain",
];

const LOOP_RUN_FIELDS = [
  "loop_run_id",
  "loop_definition_id",
  "run_ledger_id",
  "correlation_id",
  "correlation_trace_id",
  "project_id",
  "domain_pack",
  "workflow_run_id",
  "source_event_ids",
  "policy_snapshot_id",
  "state_path",
  "current_state",
  "terminal_state",
  "source_refs",
  "evidence_refs",
  "review_refs",
  "gate_refs",
  "receipt_refs",
  "blocked_reason",
  "next_allowed_action",
  "authority_flags",
  "validation_result",
  "recorded_at",
];

const LOOP_DAG_FIELDS = [
  "dag_id",
  "loop_run_id",
  "root_goal_ref",
  "node_count",
  "edge_count",
  "nodes",
  "edges",
  "topology_ref",
  "shared_blackboard_ref",
  "cycle_policy",
  "dynamic_edge_policy",
  "max_retry_depth",
  "max_verifier_pass_count",
  "terminal_node_ids",
  "human_gate_node_ids",
  "dag_status",
  "blocked_reason",
];

const CONCEPT_MAPPINGS = [
  "Loop Definition",
  "Loop Run",
  "Step Run",
  "Trigger",
  "Context Builder",
  "Planning Agent",
  "Execution Engine",
  "Tool Gateway",
  "Verification Layer",
  "Worker Agent",
  "Verifier Agent",
  "DAG/workflow graph",
  "Model Routing",
  "Budget Control",
  "Human Approval",
  "Memory Manager",
  "Dashboard",
];

const STATE_MAPPINGS = [
  "pending",
  "context_building",
  "planning",
  "running",
  "waiting_for_approval",
  "waiting_for_user_input",
  "retrying",
  "partially_completed",
  "completed",
  "failed",
  "cancelled",
  "expired",
  "blocked",
];

const NEGATIVE_FIXTURES = [
  "missing_p60400_source_binding",
  "p60400_validation_invalid",
  "p60400_not_ready_for_handoff",
  "missing_loop_definition_required_field",
  "missing_loop_run_required_field",
  "missing_loop_dag_required_field",
  "missing_existing_concept_mapping",
  "missing_state_mapping",
  "authority_carryover_true",
  "unbounded_dag_cycle_allowed",
  "missing_p60801_handoff",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/hermes-loop-overlay-contract.mjs"],
  ["syntax.script", "node --check scripts/hermes-loop-overlay-contract.mjs"],
  ["unit.test", "node --test test/hermes-loop-overlay-contract.test.mjs"],
  ["contract.check", "npm run platform:hermes-loop-overlay-contract -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/hermes-loop-overlay-contract.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runHermesLoopOverlayContract(options = {}) {
  const result = await buildHermesLoopOverlayContract(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Hermes Loop overlay contract failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeHermesLoopOverlayContract(result, result.output_dir);
  return result;
}

export async function buildHermesLoopOverlayContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HERMES_LOOP_OVERLAY_CONTRACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const sourceSpec = Object.prototype.hasOwnProperty.call(options, "sourceSpecText")
    ? normalizeInlineTextSource("inline.hermes_loop_system_specification", options.sourceSpecText)
    : await readTextSource(inputs.source_spec_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const sourceBinding = Object.prototype.hasOwnProperty.call(options, "sourceBinding")
    ? normalizeInlineJsonSource("inline.hermes_loop_source_binding", options.sourceBinding)
    : await readSourceBinding(inputs, generatedAt, options);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceRows = buildP60400SourceRows({ sourceBinding, generatedAt });
  const definitionRows = buildFieldRows("loop_definition", LOOP_DEFINITION_FIELDS, sourceSpec, options.omitDefinitionField, generatedAt);
  const runRows = buildFieldRows("loop_run", LOOP_RUN_FIELDS, sourceSpec, options.omitRunField, generatedAt);
  const dagRows = buildFieldRows("loop_dag", LOOP_DAG_FIELDS, sourceSpec, options.omitDagField, generatedAt);
  const conceptRows = buildMappingRows("concept_mapping", CONCEPT_MAPPINGS, sourceSpec, options.omitConceptMapping, generatedAt);
  const stateRows = buildMappingRows("state_mapping", STATE_MAPPINGS, sourceSpec, options.omitStateMapping, generatedAt);
  const authorityRows = buildAuthorityCarryoverRows({ sourceBinding, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeFixtureRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationCommandRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, definitionRows, runRows, dagRows, conceptRows, stateRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, definitionRows, runRows, dagRows, conceptRows, stateRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows });
  const validationItems = buildValidationItems({ sourceRows, definitionRows, runRows, dagRows, conceptRows, stateRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_refs: {
      hermes_loop_system_specification_path: sourceSpec.path,
      p60400_source_binding_path: sourceBinding.path,
      p60400_source_commit_ref: sourceBinding.data?.source_refs?.source_commit_ref ?? null,
      source_commit_ref: commitRef || null,
    },
    hermes_loop_overlay_contract: {
      contract_id: "hermes_loop_system_v1_1_overlay_contract",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      required_rows: [
        "loop_definition_schema_rows",
        "loop_run_schema_rows",
        "loop_dag_schema_rows",
        "existing_mapping_projection_rows",
        "state_mapping_projection_rows",
        "authority_boundary_carryover_rows",
      ],
      generated_at: generatedAt,
    },
    p60400_source_binding_rows: sourceRows,
    loop_definition_schema_rows: definitionRows,
    loop_run_schema_rows: runRows,
    loop_dag_schema_rows: dagRows,
    existing_mapping_projection_rows: conceptRows,
    state_mapping_projection_rows: stateRows,
    authority_boundary_carryover_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationCommandRows,
    hermes_loop_overlay_wiring_rows: wiringRows,
    p60800_closeout_rows: closeoutRows,
    p60801_next_phase_handoff_rows: handoffRows,
    hermes_loop_overlay_boundary: boundary,
    hermes_loop_overlay_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "hermes_loop_overlay_contract")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.hermes_loop_overlay_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.hermes_loop_overlay_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeHermesLoopOverlayContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "hermes-loop-overlay-contract.json"), serializableResult(result));
  await writeJson(path.join(outDir, "loop-definition-schema-rows.json"), collectionEnvelope("loop-definition-schema-rows.v1", "loop_definition_schema_rows", result.loop_definition_schema_rows, result.generated_at));
  await writeJson(path.join(outDir, "loop-run-schema-rows.json"), collectionEnvelope("loop-run-schema-rows.v1", "loop_run_schema_rows", result.loop_run_schema_rows, result.generated_at));
  await writeJson(path.join(outDir, "loop-dag-schema-rows.json"), collectionEnvelope("loop-dag-schema-rows.v1", "loop_dag_schema_rows", result.loop_dag_schema_rows, result.generated_at));
  await writeJson(path.join(outDir, "authority-boundary-carryover-rows.json"), collectionEnvelope("authority-boundary-carryover-rows.v1", "authority_boundary_carryover_rows", result.authority_boundary_carryover_rows, result.generated_at));
  await writeJson(path.join(outDir, "p60800-closeout-rows.json"), collectionEnvelope("p60800-closeout-rows.v1", "p60800_closeout_rows", result.p60800_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "p60801-next-phase-handoff-rows.json"), collectionEnvelope("p60801-next-phase-handoff-rows.v1", "p60801_next_phase_handoff_rows", result.p60801_next_phase_handoff_rows, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHermesLoopOverlayContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runHermesLoopOverlayContract(args);
  console.log(`Hermes Loop overlay contract ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.hermes_loop_overlay_status}`);
  console.log(`P60400 source ready: ${result.summary.p60400_source_ready_now}`);
  console.log(`Overlay contract ready: ${result.summary.p60800_contract_ready}`);
  console.log(`Ready for ${NEXT_PROGRAM_RANGE}: ${result.summary.ready_for_p60801_handoff}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildP60400SourceRows({ sourceBinding, generatedAt }) {
  const summary = sourceBinding.data?.summary ?? {};
  const boundary = sourceBinding.data?.hermes_loop_source_binding_boundary ?? {};
  return [
    row("source.p60400_available", "p60400_source_binding", "P60400 source binding artifact available or rebuilt", sourceBinding.available === true, sourceBinding.path, generatedAt),
    row("source.p60400_program", "p60400_source_binding", "P60400 source program range matches", sourceBinding.data?.program_range === SOURCE_PROGRAM_RANGE, sourceBinding.path, generatedAt),
    row("source.p60400_validation", "p60400_source_binding", "P60400 source validation is valid", sourceBinding.data?.validation?.valid === true, sourceBinding.path, generatedAt),
    row("source.p60400_handoff", "p60400_source_binding", "P60400 is ready for P60401 handoff", summary.ready_for_p60401_handoff === true, sourceBinding.path, generatedAt),
    row("source.p60400_authority_closed", "p60400_source_binding", "P60400 authority boundary is closed", boundary.authority_boundary_closed_now === true, sourceBinding.path, generatedAt),
  ];
}

function buildFieldRows(category, fields, sourceSpec, omitField, generatedAt) {
  const text = sourceSpec.text ?? "";
  return fields.filter((field) => field !== omitField).map((field) => row(
    `${category}.${field}`,
    `${category}_schema`,
    `${field} required by ${category}`,
    text.includes(`\`${field}\``) || text.includes(`"${field}"`),
    sourceSpec.path,
    generatedAt,
    { field_name: field },
  ));
}

function buildMappingRows(category, mappings, sourceSpec, omitMapping, generatedAt) {
  const text = sourceSpec.text ?? "";
  return mappings.filter((mapping) => mapping !== omitMapping).map((mapping) => row(
    `${category}.${normalizeId(mapping)}`,
    category,
    `${mapping} mapping visible`,
    text.includes(mapping),
    sourceSpec.path,
    generatedAt,
    { mapping_key: mapping },
  ));
}

function buildAuthorityCarryoverRows({ sourceBinding, overrides = {}, generatedAt }) {
  const sourceBoundary = sourceBinding.data?.hermes_loop_source_binding_boundary ?? {};
  return HERMES_LOOP_AUTHORITY_FALSE_FLAGS.map((flag) => {
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : sourceBoundary[flag] ?? false;
    return row(
      `authority.${flag}`,
      "authority_boundary_carryover",
      `${flag} carried over as false`,
      value === false,
      sourceBinding.path,
      generatedAt,
      { authority_flag: flag, allowed_now: value === false ? false : value },
    );
  });
}

function buildNegativeFixtureRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks P60800 closeout`,
    true,
    "docs/hermes-roadmap-p60401-p60800.md",
    generatedAt,
    { fixture_id: fixtureId, expected_verdict: "block" },
  ));
}

function buildValidationCommandRows(generatedAt) {
  return VALIDATION_COMMANDS.map(([commandId, command]) => row(
    `validation_command.${commandId}`,
    "validation_command",
    command,
    true,
    command,
    generatedAt,
    { command_id: commandId, mutating: false },
  ));
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/hermes-loop-overlay-contract.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P60401-P60800 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P60401-P60800") && roadmapDoc.text.includes("Negative fixtures"), "docs/hermes-roadmap-p60401-p60800.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture doc references P60401-P60800 overlay contract", architectureDoc.available && architectureDoc.text.includes("P60401-P60800"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows({ sourceRows, definitionRows, runRows, dagRows, conceptRows, stateRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt }) {
  return [
    closeoutRow("p60800.p60400_source_ready", "P60400 source binding is valid and ready", sourceRows.every((item) => item.current_verdict === "pass"), generatedAt),
    closeoutRow("p60800.loop_definition_fields", "LoopDefinition required field rows pass", definitionRows.every((item) => item.current_verdict === "pass"), generatedAt),
    closeoutRow("p60800.loop_run_fields", "LoopRun required field rows pass", runRows.every((item) => item.current_verdict === "pass"), generatedAt),
    closeoutRow("p60800.loop_dag_fields", "LoopDAG required field rows pass", dagRows.every((item) => item.current_verdict === "pass"), generatedAt),
    closeoutRow("p60800.concept_mapping", "Existing Hermes concept mapping rows pass", conceptRows.every((item) => item.current_verdict === "pass"), generatedAt),
    closeoutRow("p60800.state_mapping", "State mapping rows pass", stateRows.every((item) => item.current_verdict === "pass"), generatedAt),
    closeoutRow("p60800.authority_carryover", "Authority carryover remains false", authorityRows.every((item) => item.current_verdict === "pass" && item.allowed_now === false), generatedAt),
    closeoutRow("p60800.negative_fixture_contract", "Negative fixture contract rows complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p60800.validation_commands", "Validation commands declared", validationCommandRows.length === VALIDATION_COMMANDS.length, generatedAt),
    closeoutRow("p60800.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every((item) => item.current_verdict === "pass"), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, generatedAt }) {
  const ready = closeoutRows.every((item) => item.current_verdict === "pass");
  return [
    row("handoff.p60801_next_source", "next_phase_handoff", `${NEXT_PROGRAM_RANGE} consumes LoopDefinition/Run/DAG overlay rows`, ready, "artifacts/hermes-loop-overlay-contract/latest/hermes-loop-overlay-contract.json", generatedAt, {
      next_allowed_action: ready ? "implement_worker_verifier_model_route_budget_rows" : "resolve_p60800_closeout_blockers",
    }),
    row("handoff.p60801_authority_boundary", "next_phase_handoff", "Next phase must preserve false authority carryover", true, "authority_boundary_carryover_rows", generatedAt),
  ];
}

function buildBoundary({ sourceRows, definitionRows, runRows, dagRows, conceptRows, stateRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows }) {
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    p60800_contract_ready: closeoutRows.every((item) => item.current_verdict === "pass"),
    p60400_source_ready_now: sourceRows.every((item) => item.current_verdict === "pass"),
    loop_definition_schema_rows_ready_now: definitionRows.every((item) => item.current_verdict === "pass"),
    loop_run_schema_rows_ready_now: runRows.every((item) => item.current_verdict === "pass"),
    loop_dag_schema_rows_ready_now: dagRows.every((item) => item.current_verdict === "pass"),
    existing_mapping_projection_ready_now: conceptRows.every((item) => item.current_verdict === "pass"),
    state_mapping_projection_ready_now: stateRows.every((item) => item.current_verdict === "pass"),
    authority_boundary_carryover_closed_now: authorityRows.every((item) => item.current_verdict === "pass" && item.allowed_now === false),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationCommandRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every((item) => item.current_verdict === "pass"),
    ready_for_p60801_handoff: handoffRows.every((item) => item.current_verdict === "pass"),
    loop_definition_schema_row_count: definitionRows.length,
    loop_run_schema_row_count: runRows.length,
    loop_dag_schema_row_count: dagRows.length,
    concept_mapping_row_count: conceptRows.length,
    state_mapping_row_count: stateRows.length,
    authority_boundary_carryover_row_count: authorityRows.length,
    negative_fixture_contract_row_count: negativeRows.length,
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems({ sourceRows, definitionRows, runRows, dagRows, conceptRows, stateRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary }) {
  return [
    validationItem("source.p60400", "source_binding", sourceRows.every((item) => item.current_verdict === "pass"), "P60400 source binding must be valid and ready"),
    validationItem("rows.loop_definition", "schema_projection", definitionRows.length === LOOP_DEFINITION_FIELDS.length && definitionRows.every((item) => item.current_verdict === "pass"), "LoopDefinition field rows must pass"),
    validationItem("rows.loop_run", "schema_projection", runRows.length === LOOP_RUN_FIELDS.length && runRows.every((item) => item.current_verdict === "pass"), "LoopRun field rows must pass"),
    validationItem("rows.loop_dag", "schema_projection", dagRows.length === LOOP_DAG_FIELDS.length && dagRows.every((item) => item.current_verdict === "pass"), "LoopDAG field rows must pass"),
    validationItem("rows.concept_mapping", "mapping_projection", conceptRows.length === CONCEPT_MAPPINGS.length && conceptRows.every((item) => item.current_verdict === "pass"), "Concept mapping rows must pass"),
    validationItem("rows.state_mapping", "mapping_projection", stateRows.length === STATE_MAPPINGS.length && stateRows.every((item) => item.current_verdict === "pass"), "State mapping rows must pass"),
    validationItem("rows.authority", "authority_boundary", authorityRows.length === HERMES_LOOP_AUTHORITY_FALSE_FLAGS.length && authorityRows.every((item) => item.current_verdict === "pass" && item.allowed_now === false), "Authority carryover must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationCommandRows.length === VALIDATION_COMMANDS.length && validationCommandRows.every((item) => item.mutating === false), "Validation command rows must be non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every((item) => item.current_verdict === "pass"), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every((item) => item.current_verdict === "pass"), "P60800 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every((item) => item.current_verdict === "pass"), "P60801 handoff rows must pass"),
    validationItem("boundary.ready", "boundary", boundary.p60800_contract_ready === true, "P60800 contract must be ready"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p60801_handoff
    ? "ready_for_p60801_handoff"
    : validation.valid
      ? "valid_block_p60801_handoff_pending"
      : "blocked_hermes_loop_overlay_contract";
  return {
    hermes_loop_overlay_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p60400_source_ready_now: boundary.p60400_source_ready_now,
    p60800_contract_ready: boundary.p60800_contract_ready,
    ready_for_p60801_handoff: boundary.ready_for_p60801_handoff,
    authority_boundary_carryover_closed_now: boundary.authority_boundary_carryover_closed_now,
    loop_definition_schema_row_count: boundary.loop_definition_schema_row_count,
    loop_run_schema_row_count: boundary.loop_run_schema_row_count,
    loop_dag_schema_row_count: boundary.loop_dag_schema_row_count,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries(HERMES_LOOP_AUTHORITY_FALSE_FLAGS.map((flag) => [flag, boundary[flag]])),
  };
}

async function readSourceBinding(inputs, generatedAt, options) {
  const existing = await readJsonSource(inputs.source_binding_path);
  if (existing.available) return existing;
  const rebuilt = await buildHermesLoopSourceBinding({
    runAt: generatedAt,
    write: false,
    repoRoot: inputs.repo_root,
    sourceSpecPath: inputs.source_spec_path,
    schemaPath: "schemas/hermes-loop-source-binding.schema.json",
    packagePath: inputs.package_path,
    commitRef: options.commitRef,
  });
  return normalizeInlineJsonSource("rebuilt.hermes_loop_source_binding", rebuilt);
}

function renderMarkdown(result) {
  return [
    `# Hermes Loop Overlay Contract ${result.program_range}`,
    "",
    `- status: ${result.summary.hermes_loop_overlay_status}`,
    `- p60400_source_ready_now: ${result.summary.p60400_source_ready_now}`,
    `- p60800_contract_ready: ${result.summary.p60800_contract_ready}`,
    `- ready_for_p60801_handoff: ${result.summary.ready_for_p60801_handoff}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    `- final_approval_enabled: ${result.summary.final_approval_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p60801_handoff
      ? "Implement P60801-P61200 WorkerRun, VerifierRun, ModelRouteDecision, and BudgetDecision schema projection rows."
      : "Resolve P60800 source, schema, mapping, authority, wiring, or handoff blockers before P60801.",
    "",
  ].join("\n");
}

function row(rowId, category, label, observed, evidenceRef, generatedAt, extra = {}) {
  const passed = observed === true;
  return {
    row_id: rowId,
    category,
    label,
    observed: passed,
    current_verdict: passed ? "pass" : "block",
    evidence_ref: evidenceRef,
    output_ref: extra.output_ref ?? null,
    block_reason: passed ? null : extra.block_reason ?? `${rowId}.blocked`,
    next_allowed_action: extra.next_allowed_action ?? (passed ? "continue_contract_buildout" : "resolve_blocker_before_closeout"),
    generated_at: generatedAt,
    ...withoutUndefined({
      field_name: extra.field_name,
      mapping_key: extra.mapping_key,
      authority_flag: extra.authority_flag,
      allowed_now: extra.allowed_now,
      fixture_id: extra.fixture_id,
      expected_verdict: extra.expected_verdict,
      command_id: extra.command_id,
      mutating: extra.mutating,
    }),
  };
}

function closeoutRow(rowId, label, observed, generatedAt) {
  return row(rowId, "p60800_closeout", label, observed, "artifacts/hermes-loop-overlay-contract/latest/hermes-loop-overlay-contract.json", generatedAt);
}

function validationItem(id, category, passed, message) {
  return {
    validation_id: id,
    category,
    passed: passed === true,
    severity: passed === true ? "info" : "error",
    message: passed === true ? `${id} passed` : message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.passed !== true);
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors: errors.map((item) => ({ path: item.validation_id, message: item.message, category: item.category })),
  };
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_HERMES_LOOP_OVERLAY_CONTRACT_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    source_spec_path: path.resolve(repoRoot, options.sourceSpecPath ?? defaults.sourceSpecPath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_binding_path: path.resolve(repoRoot, options.sourceBindingPath ?? defaults.sourceBindingPath),
  };
}

async function readJsonSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, data: JSON.parse(text), text };
  } catch (error) {
    return { path: filePath, available: false, data: null, text: "", error: error.message };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, text };
  } catch (error) {
    return { path: filePath, available: false, text: "", error: error.message };
  }
}

function normalizeInlineJsonSource(sourceId, data) {
  return { path: sourceId, available: true, data, text: JSON.stringify(data) };
}

function normalizeInlineTextSource(sourceId, text) {
  return { path: sourceId, available: true, text: String(text ?? "") };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") args.check = true;
    else if (arg === "--write") args.write = true;
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--source-binding") args.sourceBindingPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source-binding PATH]`);
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

function collectionEnvelope(schemaVersion, collectionName, rows, generatedAt) {
  return { schema_version: schemaVersion, collection: collectionName, generated_at: generatedAt, rows };
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeId(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}
