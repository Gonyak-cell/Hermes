import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";
import { buildHermesLoopOverlayContract } from "./hermes-loop-overlay-contract.mjs";

export const DEFAULT_HERMES_LOOP_AGENT_CONTROL_OUT_DIR = "artifacts/hermes-loop-agent-control-contract/latest";
export const DEFAULT_HERMES_LOOP_AGENT_CONTROL_INPUTS = {
  schemaPath: "schemas/hermes-loop-agent-control-contract.schema.json",
  packagePath: "package.json",
  sourceSpecPath: "docs/hermes-loop-system-specification.md",
  roadmapDocPath: "docs/hermes-roadmap-p60801-p61200.md",
  architectureDocPath: "docs/architecture.md",
  sourceOverlayPath: "artifacts/hermes-loop-overlay-contract/latest/hermes-loop-overlay-contract.json",
};

const COMMAND_NAME = "platform:hermes-loop-agent-control-contract";
const SCHEMA_VERSION = "hermes-loop-agent-control-contract.v1";
const CAPABILITY_ID = "platform.hermes_loop_system_v1_1_agent_control_contract";
const PROGRAM_RANGE = "P60801-P61200";
const SOURCE_PROGRAM_RANGE = "P60401-P60800";
const NEXT_PROGRAM_RANGE = "P61201-P61600";

const WORKER_RUN_FIELDS = [
  "worker_run_id",
  "loop_run_id",
  "dag_node_id",
  "worker_role",
  "input_refs",
  "output_refs",
  "artifact_hash",
  "model_route_ref",
  "budget_gate_ref",
  "tool_refs",
  "evidence_claim_refs",
  "uncertainty_flags",
  "revision_sequence",
  "verifier_required",
  "worker_status",
];

const VERIFIER_RUN_FIELDS = [
  "verifier_run_id",
  "loop_run_id",
  "dag_node_id",
  "verifier_type",
  "worker_run_ref",
  "reviewed_goal_ref",
  "reviewed_output_refs",
  "finding_refs",
  "correction_instruction",
  "gate_status",
  "budget_status",
  "model_route_status",
  "retry_decision",
  "stop_decision",
  "next_allowed_action",
  "verifier_status",
];

const MODEL_ROUTE_FIELDS = [
  "model_route_decision_id",
  "loop_run_id",
  "dag_node_id",
  "agent_role",
  "task_class",
  "risk_tier",
  "data_classification",
  "candidate_runtime_ids",
  "selected_runtime_id",
  "route_status",
  "route_mode",
  "external_transfer",
  "redaction_status",
  "required_gates",
  "estimated_quality_tier",
  "estimated_cost_tier",
  "route_blocker",
];

const BUDGET_FIELDS = [
  "budget_decision_id",
  "loop_run_id",
  "dag_node_id",
  "model_route_decision_id",
  "max_usd",
  "estimated_usd",
  "observed_usd",
  "budget_margin_usd",
  "max_input_tokens",
  "max_output_tokens",
  "estimated_total_tokens",
  "observed_total_tokens",
  "max_runtime_seconds",
  "observed_runtime_seconds",
  "max_retry_count",
  "observed_retry_count",
  "max_verifier_pass_count",
  "observed_verifier_pass_count",
  "budget_status",
  "alert_status",
  "recommended_action",
];

const GATE_FIELDS = [
  "gate_result_id",
  "loop_run_id",
  "gate_type",
  "gate_status",
  "required_evidence_refs",
  "observed_evidence_refs",
  "reviewer_ref",
  "hard_gate_ref",
  "receipt_ref",
  "acceptance_authority",
  "block_reason",
  "next_allowed_action",
];

const AUTHORITY_FIELDS = [
  "boundary_id",
  "loop_run_id",
  "runtime_execution_allowed_now",
  "write_action_allowed_now",
  "connector_ingestion_allowed_now",
  "connector_write_allowed_now",
  "raw_material_access_allowed_now",
  "cross_domain_access_allowed_now",
  "production_ready_allowed_now",
  "protected_closeout_allowed_now",
  "codex_final_approval_allowed",
  "claude_final_approval_allowed",
  "unsafe_flag_count",
];

const SEPARATION_MARKERS = [
  ["worker_candidate_only", "Worker output is candidate until verified", "Worker output은 verifier gate를 통과하기 전까지 `unverified_candidate`다"],
  ["worker_no_final", "Worker does not judge its own output final", "Worker는 자기 output을 final로 판정하지 않는다"],
  ["verifier_goal_evidence_policy", "Verifier checks goal, evidence, policy, budget, model route, stop condition", "goal, evidence, policy, budget, model route, stop condition"],
  ["verifier_no_final", "Verifier cannot final approve", "final approval을 만들 수 없다"],
  ["correction_structured", "Verifier correction must be structured", "correction instruction이 구조화되어야 한다"],
  ["revision_no_overwrite", "Worker revision must not overwrite previous artifact", "기존 artifact를 덮어쓰지 않아야 한다"],
];

const MODEL_BUDGET_MARKERS = [
  ["route_policy_gate", "Model route has data, redaction, capability, cost, verifier gates", "필수 gate"],
  ["budget_ceiling", "Budget control declares max cost/token/runtime/retry/verifier pass", "max loop USD"],
  ["budget_block_next_action", "Critical or blocked budget produces explicit next action", "Budget이 `critical` 또는 `blocked_*`이면 next allowed action"],
  ["token_estimate", "Token estimate exists before route execution", "input token estimate"],
  ["stop_conditions", "Stop conditions include budget, token, route, policy, human approval", "Loop는 다음 조건에서 자동으로 멈추거나 human gate로 이동"],
];

const NEGATIVE_FIXTURES = [
  "missing_p60800_overlay_source",
  "p60800_validation_invalid",
  "missing_worker_run_field",
  "missing_verifier_run_field",
  "missing_model_route_field",
  "missing_budget_decision_field",
  "missing_gate_result_field",
  "missing_authority_boundary_field",
  "worker_self_approval",
  "verifier_final_approval",
  "high_cost_route_without_budget_gate",
  "budget_exceeded_but_loop_continues",
  "authority_carryover_true",
  "missing_p61201_handoff",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/hermes-loop-agent-control-contract.mjs"],
  ["syntax.script", "node --check scripts/hermes-loop-agent-control-contract.mjs"],
  ["unit.test", "node --test test/hermes-loop-agent-control-contract.test.mjs"],
  ["contract.check", "npm run platform:hermes-loop-agent-control-contract -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/hermes-loop-agent-control-contract.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runHermesLoopAgentControlContract(options = {}) {
  const result = await buildHermesLoopAgentControlContract(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Hermes Loop agent control contract failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeHermesLoopAgentControlContract(result, result.output_dir);
  return result;
}

export async function buildHermesLoopAgentControlContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HERMES_LOOP_AGENT_CONTROL_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const sourceSpec = Object.prototype.hasOwnProperty.call(options, "sourceSpecText")
    ? normalizeInlineTextSource("inline.hermes_loop_system_specification", options.sourceSpecText)
    : await readTextSource(inputs.source_spec_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const sourceOverlay = Object.prototype.hasOwnProperty.call(options, "sourceOverlay")
    ? normalizeInlineJsonSource("inline.hermes_loop_overlay_contract", options.sourceOverlay)
    : await readSourceOverlay(inputs, generatedAt, options);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceRows = buildP60800SourceRows({ sourceOverlay, generatedAt });
  const workerRows = buildFieldRows("worker_run", WORKER_RUN_FIELDS, sourceSpec, options.omitWorkerField, generatedAt);
  const verifierRows = buildFieldRows("verifier_run", VERIFIER_RUN_FIELDS, sourceSpec, options.omitVerifierField, generatedAt);
  const modelRouteRows = buildFieldRows("model_route_decision", MODEL_ROUTE_FIELDS, sourceSpec, options.omitModelRouteField, generatedAt);
  const budgetRows = buildFieldRows("budget_decision", BUDGET_FIELDS, sourceSpec, options.omitBudgetField, generatedAt);
  const gateRows = buildFieldRows("gate_result", GATE_FIELDS, sourceSpec, options.omitGateField, generatedAt);
  const authoritySchemaRows = buildFieldRows("authority_boundary_schema", AUTHORITY_FIELDS, sourceSpec, options.omitAuthorityField, generatedAt);
  const separationRows = buildMarkerRows("worker_verifier_separation", SEPARATION_MARKERS, sourceSpec, options.omitSeparationMarker, generatedAt);
  const modelBudgetRows = buildMarkerRows("model_budget_control", MODEL_BUDGET_MARKERS, sourceSpec, options.omitModelBudgetMarker, generatedAt);
  const authorityRows = buildAuthorityRows({ sourceOverlay, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationCommandRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, workerRows, verifierRows, modelRouteRows, budgetRows, gateRows, authoritySchemaRows, separationRows, modelBudgetRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, workerRows, verifierRows, modelRouteRows, budgetRows, gateRows, authoritySchemaRows, separationRows, modelBudgetRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows });
  const validationItems = buildValidationItems({ sourceRows, workerRows, verifierRows, modelRouteRows, budgetRows, gateRows, authoritySchemaRows, separationRows, modelBudgetRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary });
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
      p60800_overlay_source_path: sourceOverlay.path,
      source_commit_ref: commitRef || null,
    },
    hermes_loop_agent_control_contract: {
      contract_id: "hermes_loop_system_v1_1_agent_control_contract",
      program_range: PROGRAM_RANGE,
      source_program_range: SOURCE_PROGRAM_RANGE,
      next_phase: "Phase B: Loop Run Ledger Projection",
      generated_at: generatedAt,
    },
    p60800_overlay_source_rows: sourceRows,
    worker_run_schema_rows: workerRows,
    verifier_run_schema_rows: verifierRows,
    model_route_decision_schema_rows: modelRouteRows,
    budget_decision_schema_rows: budgetRows,
    gate_result_schema_rows: gateRows,
    authority_boundary_schema_rows: authoritySchemaRows,
    worker_verifier_separation_rows: separationRows,
    model_budget_control_rows: modelBudgetRows,
    authority_boundary_carryover_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationCommandRows,
    hermes_loop_agent_control_wiring_rows: wiringRows,
    p61200_closeout_rows: closeoutRows,
    p61201_next_phase_handoff_rows: handoffRows,
    hermes_loop_agent_control_boundary: boundary,
    hermes_loop_agent_control_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };

  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "hermes_loop_agent_control_contract")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.hermes_loop_agent_control_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.hermes_loop_agent_control_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeHermesLoopAgentControlContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "hermes-loop-agent-control-contract.json"), serializableResult(result));
  await writeJson(path.join(outDir, "worker-run-schema-rows.json"), collectionEnvelope("worker-run-schema-rows.v1", "worker_run_schema_rows", result.worker_run_schema_rows, result.generated_at));
  await writeJson(path.join(outDir, "verifier-run-schema-rows.json"), collectionEnvelope("verifier-run-schema-rows.v1", "verifier_run_schema_rows", result.verifier_run_schema_rows, result.generated_at));
  await writeJson(path.join(outDir, "model-route-decision-schema-rows.json"), collectionEnvelope("model-route-decision-schema-rows.v1", "model_route_decision_schema_rows", result.model_route_decision_schema_rows, result.generated_at));
  await writeJson(path.join(outDir, "budget-decision-schema-rows.json"), collectionEnvelope("budget-decision-schema-rows.v1", "budget_decision_schema_rows", result.budget_decision_schema_rows, result.generated_at));
  await writeJson(path.join(outDir, "p61200-closeout-rows.json"), collectionEnvelope("p61200-closeout-rows.v1", "p61200_closeout_rows", result.p61200_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "p61201-next-phase-handoff-rows.json"), collectionEnvelope("p61201-next-phase-handoff-rows.v1", "p61201_next_phase_handoff_rows", result.p61201_next_phase_handoff_rows, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHermesLoopAgentControlContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runHermesLoopAgentControlContract(args);
  console.log(`Hermes Loop agent control contract ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.hermes_loop_agent_control_status}`);
  console.log(`P60800 source ready: ${result.summary.p60800_source_ready_now}`);
  console.log(`Agent control ready: ${result.summary.p61200_contract_ready}`);
  console.log(`Ready for ${NEXT_PROGRAM_RANGE}: ${result.summary.ready_for_p61201_handoff}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildP60800SourceRows({ sourceOverlay, generatedAt }) {
  const summary = sourceOverlay.data?.summary ?? {};
  const boundary = sourceOverlay.data?.hermes_loop_overlay_boundary ?? {};
  return [
    row("source.p60800_available", "p60800_overlay_source", "P60800 overlay source available or rebuilt", sourceOverlay.available === true, sourceOverlay.path, generatedAt),
    row("source.p60800_program", "p60800_overlay_source", "P60800 source program range matches", sourceOverlay.data?.program_range === SOURCE_PROGRAM_RANGE, sourceOverlay.path, generatedAt),
    row("source.p60800_validation", "p60800_overlay_source", "P60800 source validation is valid", sourceOverlay.data?.validation?.valid === true, sourceOverlay.path, generatedAt),
    row("source.p60800_handoff", "p60800_overlay_source", "P60800 is ready for P60801 handoff", summary.ready_for_p60801_handoff === true, sourceOverlay.path, generatedAt),
    row("source.p60800_authority_closed", "p60800_overlay_source", "P60800 authority boundary is closed", boundary.authority_boundary_carryover_closed_now === true, sourceOverlay.path, generatedAt),
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

function buildMarkerRows(category, markers, sourceSpec, omitId, generatedAt) {
  const text = sourceSpec.text ?? "";
  return markers.filter(([markerId]) => markerId !== omitId).map(([markerId, label, marker]) => row(
    `${category}.${markerId}`,
    category,
    label,
    text.includes(marker),
    sourceSpec.path,
    generatedAt,
    { marker_id: markerId },
  ));
}

function buildAuthorityRows({ sourceOverlay, overrides = {}, generatedAt }) {
  const sourceBoundary = sourceOverlay.data?.hermes_loop_overlay_boundary ?? {};
  return HERMES_LOOP_AUTHORITY_FALSE_FLAGS.map((flag) => {
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : sourceBoundary[flag] ?? false;
    return row(`authority.${flag}`, "authority_boundary_carryover", `${flag} carried over as false`, value === false, sourceOverlay.path, generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks P61200 closeout`,
    true,
    "docs/hermes-roadmap-p60801-p61200.md",
    generatedAt,
    { fixture_id: fixtureId, expected_verdict: "block" },
  ));
}

function buildValidationCommandRows(generatedAt) {
  return VALIDATION_COMMANDS.map(([commandId, command]) => row(`validation_command.${commandId}`, "validation_command", command, true, command, generatedAt, {
    command_id: commandId,
    mutating: false,
  }));
}

function buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt }) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/hermes-loop-agent-control-contract.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P60801-P61200 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P60801-P61200") && roadmapDoc.text.includes("Negative fixtures"), "docs/hermes-roadmap-p60801-p61200.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture doc references P60801-P61200 agent control contract", architectureDoc.available && architectureDoc.text.includes("P60801-P61200"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, workerRows, verifierRows, modelRouteRows, budgetRows, gateRows, authoritySchemaRows, separationRows, modelBudgetRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p61200.p60800_source_ready", "P60800 overlay source is valid and ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p61200.worker_run_fields", "WorkerRun required field rows pass", workerRows.every(pass), generatedAt),
    closeoutRow("p61200.verifier_run_fields", "VerifierRun required field rows pass", verifierRows.every(pass), generatedAt),
    closeoutRow("p61200.model_route_fields", "ModelRouteDecision field rows pass", modelRouteRows.every(pass), generatedAt),
    closeoutRow("p61200.budget_decision_fields", "BudgetDecision field rows pass", budgetRows.every(pass), generatedAt),
    closeoutRow("p61200.gate_result_fields", "GateResult field rows pass", gateRows.every(pass), generatedAt),
    closeoutRow("p61200.authority_boundary_schema_fields", "AuthorityBoundary schema field rows pass", authoritySchemaRows.every(pass), generatedAt),
    closeoutRow("p61200.worker_verifier_separation", "Worker/verifier separation rows pass", separationRows.every(pass), generatedAt),
    closeoutRow("p61200.model_budget_control", "Model route and budget control rows pass", modelBudgetRows.every(pass), generatedAt),
    closeoutRow("p61200.authority_carryover", "Authority carryover remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p61200.negative_fixtures", "Negative fixture rows complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p61200.validation_commands", "Validation commands declared", validationCommandRows.length === VALIDATION_COMMANDS.length, generatedAt),
    closeoutRow("p61200.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, generatedAt }) {
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.p61201_next_source", "next_phase_handoff", `${NEXT_PROGRAM_RANGE} consumes agent control schema family rows`, ready, "artifacts/hermes-loop-agent-control-contract/latest/hermes-loop-agent-control-contract.json", generatedAt, {
      next_allowed_action: ready ? "implement_loop_run_ledger_projection" : "resolve_p61200_closeout_blockers",
    }),
    row("handoff.phase_b_boundary", "next_phase_handoff", "Next phase starts Phase B without opening execution authority", true, "docs/hermes-loop-system-specification.md#phase-b", generatedAt),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, workerRows, verifierRows, modelRouteRows, budgetRows, gateRows, authoritySchemaRows, separationRows, modelBudgetRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows } = parts;
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    p61200_contract_ready: closeoutRows.every(pass),
    p60800_source_ready_now: sourceRows.every(pass),
    worker_run_schema_rows_ready_now: workerRows.every(pass),
    verifier_run_schema_rows_ready_now: verifierRows.every(pass),
    model_route_decision_schema_rows_ready_now: modelRouteRows.every(pass),
    budget_decision_schema_rows_ready_now: budgetRows.every(pass),
    gate_result_schema_rows_ready_now: gateRows.every(pass),
    authority_boundary_schema_rows_ready_now: authoritySchemaRows.every(pass),
    worker_verifier_separation_ready_now: separationRows.every(pass),
    model_budget_control_ready_now: modelBudgetRows.every(pass),
    authority_boundary_carryover_closed_now: authorityRows.every((item) => pass(item) && item.allowed_now === false),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationCommandRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p61201_handoff: handoffRows.every(pass),
    worker_run_schema_row_count: workerRows.length,
    verifier_run_schema_row_count: verifierRows.length,
    model_route_decision_schema_row_count: modelRouteRows.length,
    budget_decision_schema_row_count: budgetRows.length,
    gate_result_schema_row_count: gateRows.length,
    authority_boundary_schema_row_count: authoritySchemaRows.length,
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, workerRows, verifierRows, modelRouteRows, budgetRows, gateRows, authoritySchemaRows, separationRows, modelBudgetRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.p60800", "source_binding", sourceRows.every(pass), "P60800 overlay source must be valid and ready"),
    validationItem("rows.worker", "schema_projection", workerRows.length === WORKER_RUN_FIELDS.length && workerRows.every(pass), "WorkerRun field rows must pass"),
    validationItem("rows.verifier", "schema_projection", verifierRows.length === VERIFIER_RUN_FIELDS.length && verifierRows.every(pass), "VerifierRun field rows must pass"),
    validationItem("rows.model_route", "schema_projection", modelRouteRows.length === MODEL_ROUTE_FIELDS.length && modelRouteRows.every(pass), "ModelRouteDecision field rows must pass"),
    validationItem("rows.budget", "schema_projection", budgetRows.length === BUDGET_FIELDS.length && budgetRows.every(pass), "BudgetDecision field rows must pass"),
    validationItem("rows.gate", "schema_projection", gateRows.length === GATE_FIELDS.length && gateRows.every(pass), "GateResult field rows must pass"),
    validationItem("rows.authority_schema", "schema_projection", authoritySchemaRows.length === AUTHORITY_FIELDS.length && authoritySchemaRows.every(pass), "AuthorityBoundary field rows must pass"),
    validationItem("rows.separation", "worker_verifier", separationRows.length === SEPARATION_MARKERS.length && separationRows.every(pass), "Worker/verifier separation rows must pass"),
    validationItem("rows.model_budget", "model_budget", modelBudgetRows.length === MODEL_BUDGET_MARKERS.length && modelBudgetRows.every(pass), "Model/budget control rows must pass"),
    validationItem("rows.authority", "authority_boundary", authorityRows.length === HERMES_LOOP_AUTHORITY_FALSE_FLAGS.length && authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority carryover must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationCommandRows.length === VALIDATION_COMMANDS.length && validationCommandRows.every((item) => item.mutating === false), "Validation command rows must be non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P61200 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P61201 handoff rows must pass"),
    validationItem("boundary.ready", "boundary", boundary.p61200_contract_ready === true, "P61200 contract must be ready"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p61201_handoff
    ? "ready_for_p61201_handoff"
    : validation.valid
      ? "valid_block_p61201_handoff_pending"
      : "blocked_hermes_loop_agent_control_contract";
  return {
    hermes_loop_agent_control_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p60800_source_ready_now: boundary.p60800_source_ready_now,
    p61200_contract_ready: boundary.p61200_contract_ready,
    ready_for_p61201_handoff: boundary.ready_for_p61201_handoff,
    authority_boundary_carryover_closed_now: boundary.authority_boundary_carryover_closed_now,
    worker_run_schema_row_count: boundary.worker_run_schema_row_count,
    verifier_run_schema_row_count: boundary.verifier_run_schema_row_count,
    model_route_decision_schema_row_count: boundary.model_route_decision_schema_row_count,
    budget_decision_schema_row_count: boundary.budget_decision_schema_row_count,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries(HERMES_LOOP_AUTHORITY_FALSE_FLAGS.map((flag) => [flag, boundary[flag]])),
  };
}

async function readSourceOverlay(inputs, generatedAt, options) {
  const existing = await readJsonSource(inputs.source_overlay_path);
  if (existing.available) return existing;
  const rebuilt = await buildHermesLoopOverlayContract({
    runAt: generatedAt,
    write: false,
    repoRoot: inputs.repo_root,
    sourceSpecPath: inputs.source_spec_path,
    packagePath: inputs.package_path,
    commitRef: options.commitRef,
  });
  return normalizeInlineJsonSource("rebuilt.hermes_loop_overlay_contract", rebuilt);
}

function renderMarkdown(result) {
  return [
    `# Hermes Loop Agent Control Contract ${result.program_range}`,
    "",
    `- status: ${result.summary.hermes_loop_agent_control_status}`,
    `- p60800_source_ready_now: ${result.summary.p60800_source_ready_now}`,
    `- p61200_contract_ready: ${result.summary.p61200_contract_ready}`,
    `- ready_for_p61201_handoff: ${result.summary.ready_for_p61201_handoff}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    `- final_approval_enabled: ${result.summary.final_approval_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p61201_handoff
      ? "Implement P61201-P61600 Loop Run Ledger Projection and source-event to loop-run blocker/next-action binding."
      : "Resolve P61200 source, schema, worker/verifier, model/budget, authority, wiring, or handoff blockers before P61201.",
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
      marker_id: extra.marker_id,
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
  return row(rowId, "p61200_closeout", label, observed, "artifacts/hermes-loop-agent-control-contract/latest/hermes-loop-agent-control-contract.json", generatedAt);
}

function pass(item) {
  return item.current_verdict === "pass";
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
  const defaults = DEFAULT_HERMES_LOOP_AGENT_CONTROL_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    source_spec_path: path.resolve(repoRoot, options.sourceSpecPath ?? defaults.sourceSpecPath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_overlay_path: path.resolve(repoRoot, options.sourceOverlayPath ?? defaults.sourceOverlayPath),
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
    else if (arg === "--source-overlay") args.sourceOverlayPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source-overlay PATH]`);
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

function withoutUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}
