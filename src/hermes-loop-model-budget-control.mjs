import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";
import { buildHermesLoopDagTopology } from "./hermes-loop-dag-topology.mjs";

export const DEFAULT_HERMES_LOOP_MODEL_BUDGET_OUT_DIR = "artifacts/hermes-loop-model-budget-control/latest";
export const DEFAULT_HERMES_LOOP_MODEL_BUDGET_INPUTS = {
  schemaPath: "schemas/hermes-loop-model-budget-control.schema.json",
  packagePath: "package.json",
  sourceSpecPath: "docs/hermes-loop-system-specification.md",
  roadmapDocPath: "docs/hermes-roadmap-p62401-p62800.md",
  architectureDocPath: "docs/architecture.md",
  sourceDagTopologyPath: "artifacts/hermes-loop-dag-topology/latest/hermes-loop-dag-topology.json",
};

const COMMAND_NAME = "platform:hermes-loop-model-budget-control";
const SCHEMA_VERSION = "hermes-loop-model-budget-control.v1";
const CAPABILITY_ID = "platform.hermes_loop_system_v1_1_model_budget_control";
const PROGRAM_RANGE = "P62401-P62800";
const SOURCE_PROGRAM_RANGE = "P62001-P62400";
const NEXT_PROGRAM_RANGE = "P62801-P63200";

const MODEL_ROUTE_FIELDS = [
  "`model_route_decision_id`",
  "`loop_run_id`",
  "`dag_node_id`",
  "`agent_role`",
  "`task_class`",
  "`risk_tier`",
  "`data_classification`",
  "`candidate_runtime_ids`",
  "`selected_runtime_id`",
  "`route_status`",
  "`route_mode`",
  "`external_transfer`",
  "`redaction_status`",
  "`required_gates`",
  "`estimated_quality_tier`",
  "`estimated_cost_tier`",
  "`route_blocker`",
];

const BUDGET_DECISION_FIELDS = [
  "`budget_decision_id`",
  "`loop_run_id`",
  "`dag_node_id`",
  "`model_route_decision_id`",
  "`max_usd`",
  "`estimated_usd`",
  "`observed_usd`",
  "`budget_margin_usd`",
  "`max_input_tokens`",
  "`max_output_tokens`",
  "`estimated_total_tokens`",
  "`observed_total_tokens`",
  "`max_runtime_seconds`",
  "`observed_runtime_seconds`",
  "`max_retry_count`",
  "`observed_retry_count`",
  "`max_verifier_pass_count`",
  "`observed_verifier_pass_count`",
  "`budget_status`",
  "`alert_status`",
  "`recommended_action`",
];

const ROUTE_GATE_POLICIES = [
  ["data_classification_gate", "data classification gate"],
  ["external_model_policy_gate", "external model policy gate"],
  ["redaction_gate", "redaction gate"],
  ["model_capability_gate", "model capability gate"],
  ["cost_tier_gate", "cost tier gate"],
  ["verifier_route_gate", "verifier route gate"],
  ["privileged_sensitive_review_or_deny", "P2 이상 또는 privileged/sensitive 자료는 external model route가 `review` 또는 `deny`로 남아야 한다"],
  ["external_model_policy_enforced", "external model policy enforced"],
];

const BUDGET_GUARDRAILS = [
  "max loop USD",
  "max node USD",
  "max total tokens",
  "max input tokens",
  "max output tokens",
  "max runtime seconds",
  "max retry count",
  "max verifier pass count",
  "warning threshold",
  "critical threshold",
  "unbudgeted route blocker",
  "token estimate exists before route execution",
];

const DOWNGRADE_STOP_POLICIES = [
  ["margin_blocks_high_cost", "budget margin이 부족하면 high-cost escalation은 block되고 cheaper route 또는 human gate가 next allowed action이 된다"],
  ["stop_loop", "stop loop"],
  ["downgrade_model_route", "downgrade model route"],
  ["reduce_context", "reduce context"],
  ["request_human_decision", "request human decision"],
  ["split_goal", "split goal"],
  ["defer_non_critical_node", "defer non-critical node"],
  ["expensive_model_escalation_gated", "expensive model escalation gated"],
  ["budget_exceeded_stops_or_downgrades", "budget exceeded loop stops or downgrades"],
];

const NEGATIVE_FIXTURES = [
  "missing_p62400_dag_topology_source",
  "p62400_validation_invalid",
  "missing_model_route_decision_field",
  "missing_budget_decision_field",
  "external_model_route_auto_pass",
  "privileged_sensitive_route_without_review_or_deny",
  "expensive_model_escalation_without_gate",
  "budget_exceeded_but_loop_continues",
  "unbudgeted_route",
  "downgrade_or_stop_missing",
  "authority_carryover_true",
  "missing_p62801_handoff",
];

const EXTRA_FALSE_FLAGS = [
  "model_call_allowed_now",
  "runtime_model_selection_allowed_now",
  "high_cost_escalation_allowed_now",
  "budget_spend_allowed_now",
  "external_model_transfer_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/hermes-loop-model-budget-control.mjs"],
  ["syntax.script", "node --check scripts/hermes-loop-model-budget-control.mjs"],
  ["unit.test", "node --test test/hermes-loop-model-budget-control.test.mjs"],
  ["contract.check", "npm run platform:hermes-loop-model-budget-control -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/hermes-loop-model-budget-control.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runHermesLoopModelBudgetControl(options = {}) {
  const result = await buildHermesLoopModelBudgetControl(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Hermes Loop model budget control failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeHermesLoopModelBudgetControl(result, result.output_dir);
  return result;
}

export async function buildHermesLoopModelBudgetControl(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HERMES_LOOP_MODEL_BUDGET_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const sourceSpec = Object.prototype.hasOwnProperty.call(options, "sourceSpecText")
    ? normalizeInlineTextSource("inline.hermes_loop_system_specification", options.sourceSpecText)
    : await readTextSource(inputs.source_spec_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const sourceDagTopology = Object.prototype.hasOwnProperty.call(options, "sourceDagTopology")
    ? normalizeInlineJsonSource("inline.hermes_loop_dag_topology", options.sourceDagTopology)
    : await readSourceDagTopology(inputs, generatedAt, options);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceRows = buildP62400SourceRows({ sourceDagTopology, generatedAt });
  const modelRouteRows = buildMarkerRows("model_route_decision_contract", MODEL_ROUTE_FIELDS, sourceSpec, options.omitModelRouteField, generatedAt);
  const budgetRows = buildMarkerRows("budget_decision_contract", BUDGET_DECISION_FIELDS, sourceSpec, options.omitBudgetDecisionField, generatedAt);
  const routeGateRows = buildTupleMarkerRows("route_gate_policy", ROUTE_GATE_POLICIES, sourceSpec, options.omitRouteGate, generatedAt);
  const budgetGuardRows = buildMarkerRows("budget_guardrail", BUDGET_GUARDRAILS, sourceSpec, options.omitBudgetGuardrail, generatedAt);
  const downgradeStopRows = buildTupleMarkerRows("downgrade_stop_policy", DOWNGRADE_STOP_POLICIES, sourceSpec, options.omitDowngradeStopPolicy, generatedAt);
  const authorityRows = buildAuthorityRows({ sourceDagTopology, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationCommandRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, modelRouteRows, budgetRows, routeGateRows, budgetGuardRows, downgradeStopRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, modelRouteRows, budgetRows, routeGateRows, budgetGuardRows, downgradeStopRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows });
  const validationItems = buildValidationItems({ sourceRows, modelRouteRows, budgetRows, routeGateRows, budgetGuardRows, downgradeStopRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary });
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
      p62400_dag_topology_source_path: sourceDagTopology.path,
      source_commit_ref: commitRef || null,
    },
    hermes_loop_model_budget_contract: {
      contract_id: "hermes_loop_system_v1_1_model_budget_control",
      roadmap_phase: "Phase E: Model Routing and Budget Control",
      program_range: PROGRAM_RANGE,
      generated_at: generatedAt,
    },
    p62400_dag_topology_source_rows: sourceRows,
    model_route_decision_contract_rows: modelRouteRows,
    budget_decision_contract_rows: budgetRows,
    route_gate_policy_rows: routeGateRows,
    budget_guardrail_rows: budgetGuardRows,
    downgrade_stop_policy_rows: downgradeStopRows,
    authority_boundary_carryover_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationCommandRows,
    hermes_loop_model_budget_wiring_rows: wiringRows,
    p62800_closeout_rows: closeoutRows,
    p62801_next_phase_handoff_rows: handoffRows,
    hermes_loop_model_budget_boundary: boundary,
    hermes_loop_model_budget_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "hermes_loop_model_budget_control")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.hermes_loop_model_budget_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.hermes_loop_model_budget_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeHermesLoopModelBudgetControl(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "hermes-loop-model-budget-control.json"), serializableResult(result));
  await writeJson(path.join(outDir, "model-route-decision-contract-rows.json"), collectionEnvelope("model-route-decision-contract-rows.v1", "model_route_decision_contract_rows", result.model_route_decision_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "budget-decision-contract-rows.json"), collectionEnvelope("budget-decision-contract-rows.v1", "budget_decision_contract_rows", result.budget_decision_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "route-gate-policy-rows.json"), collectionEnvelope("route-gate-policy-rows.v1", "route_gate_policy_rows", result.route_gate_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "budget-guardrail-rows.json"), collectionEnvelope("budget-guardrail-rows.v1", "budget_guardrail_rows", result.budget_guardrail_rows, result.generated_at));
  await writeJson(path.join(outDir, "downgrade-stop-policy-rows.json"), collectionEnvelope("downgrade-stop-policy-rows.v1", "downgrade_stop_policy_rows", result.downgrade_stop_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "p62800-closeout-rows.json"), collectionEnvelope("p62800-closeout-rows.v1", "p62800_closeout_rows", result.p62800_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "p62801-next-phase-handoff-rows.json"), collectionEnvelope("p62801-next-phase-handoff-rows.v1", "p62801_next_phase_handoff_rows", result.p62801_next_phase_handoff_rows, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHermesLoopModelBudgetControlCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runHermesLoopModelBudgetControl(args);
  console.log(`Hermes Loop model budget control ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.hermes_loop_model_budget_status}`);
  console.log(`P62400 source ready: ${result.summary.p62400_source_ready_now}`);
  console.log(`Model budget ready: ${result.summary.p62800_contract_ready}`);
  console.log(`Ready for ${NEXT_PROGRAM_RANGE}: ${result.summary.ready_for_p62801_handoff}`);
  console.log(`Model call allowed: ${result.summary.model_call_allowed_now}`);
  console.log(`Budget spend allowed: ${result.summary.budget_spend_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildP62400SourceRows({ sourceDagTopology, generatedAt }) {
  const summary = sourceDagTopology.data?.summary ?? {};
  const boundary = sourceDagTopology.data?.hermes_loop_dag_topology_boundary ?? {};
  return [
    row("source.p62400_available", "p62400_dag_topology_source", "P62400 DAG topology source available or rebuilt", sourceDagTopology.available === true, sourceDagTopology.path, generatedAt),
    row("source.p62400_program", "p62400_dag_topology_source", "P62400 source program range matches", sourceDagTopology.data?.program_range === SOURCE_PROGRAM_RANGE, sourceDagTopology.path, generatedAt),
    row("source.p62400_validation", "p62400_dag_topology_source", "P62400 source validation is valid", sourceDagTopology.data?.validation?.valid === true, sourceDagTopology.path, generatedAt),
    row("source.p62400_handoff", "p62400_dag_topology_source", "P62400 is ready for P62401 handoff", summary.ready_for_p62401_handoff === true, sourceDagTopology.path, generatedAt),
    row("source.p62400_authority_closed", "p62400_dag_topology_source", "P62400 authority boundary is closed", boundary.authority_boundary_carryover_closed_now === true, sourceDagTopology.path, generatedAt),
  ];
}

function buildMarkerRows(category, markers, sourceSpec, omitId, generatedAt) {
  const text = sourceSpec.text ?? "";
  return markers.filter((marker) => marker !== omitId).map((marker) => row(
    `${category}.${normalizeId(marker)}`,
    category,
    `${marker} grounded`,
    text.includes(marker),
    sourceSpec.path,
    generatedAt,
    { marker },
  ));
}

function buildTupleMarkerRows(category, markers, sourceSpec, omitId, generatedAt) {
  const text = sourceSpec.text ?? "";
  return markers.filter(([rowId]) => rowId !== omitId).map(([rowId, marker]) => row(
    `${category}.${rowId}`,
    category,
    `${rowId} grounded`,
    text.includes(marker),
    sourceSpec.path,
    generatedAt,
    { marker },
  ));
}

function buildAuthorityRows({ sourceDagTopology, overrides = {}, generatedAt }) {
  const sourceBoundary = sourceDagTopology.data?.hermes_loop_dag_topology_boundary ?? {};
  const flags = [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS];
  return flags.map((flag) => {
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : sourceBoundary[flag] ?? false;
    return row(`authority.${flag}`, "authority_boundary_carryover", `${flag} carried over as false`, value === false, sourceDagTopology.path, generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks P62800 closeout`,
    true,
    "docs/hermes-roadmap-p62401-p62800.md",
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
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/hermes-loop-model-budget-control.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P62401-P62800 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P62401-P62800") && roadmapDoc.text.includes("Negative fixtures"), "docs/hermes-roadmap-p62401-p62800.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture doc references P62401-P62800 model budget control", architectureDoc.available && architectureDoc.text.includes("P62401-P62800"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, modelRouteRows, budgetRows, routeGateRows, budgetGuardRows, downgradeStopRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p62800.p62400_source_ready", "P62400 source is valid and ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p62800.model_route_decision", "Model route decision rows pass", modelRouteRows.every(pass), generatedAt),
    closeoutRow("p62800.budget_decision", "Budget decision rows pass", budgetRows.every(pass), generatedAt),
    closeoutRow("p62800.route_gate_policy", "Route gate policy rows pass", routeGateRows.every(pass), generatedAt),
    closeoutRow("p62800.budget_guardrails", "Budget guardrail rows pass", budgetGuardRows.every(pass), generatedAt),
    closeoutRow("p62800.downgrade_stop", "Downgrade/stop policy rows pass", downgradeStopRows.every(pass), generatedAt),
    closeoutRow("p62800.authority_carryover", "Authority carryover remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p62800.negative_fixtures", "Negative fixture rows complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p62800.validation_commands", "Validation commands declared", validationCommandRows.length === VALIDATION_COMMANDS.length, generatedAt),
    closeoutRow("p62800.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, generatedAt }) {
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.p62801_next_source", "next_phase_handoff", `${NEXT_PROGRAM_RANGE} consumes model budget control`, ready, "artifacts/hermes-loop-model-budget-control/latest/hermes-loop-model-budget-control.json", generatedAt, {
      next_allowed_action: ready ? "implement_runtime_tool_governance" : "resolve_p62800_closeout_blockers",
    }),
    row("handoff.phase_f_boundary", "next_phase_handoff", "Next phase starts runtime and tool governance without enabling runtime execution", true, "docs/hermes-loop-system-specification.md#phase-f", generatedAt),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, modelRouteRows, budgetRows, routeGateRows, budgetGuardRows, downgradeStopRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows } = parts;
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    p62800_contract_ready: closeoutRows.every(pass),
    p62400_source_ready_now: sourceRows.every(pass),
    model_route_decision_ready_now: modelRouteRows.every(pass),
    budget_decision_ready_now: budgetRows.every(pass),
    route_gate_policy_ready_now: routeGateRows.every(pass),
    budget_guardrail_ready_now: budgetGuardRows.every(pass),
    downgrade_stop_policy_ready_now: downgradeStopRows.every(pass),
    authority_boundary_carryover_closed_now: authorityRows.every((item) => pass(item) && item.allowed_now === false),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationCommandRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p62801_handoff: handoffRows.every(pass),
    model_route_row_count: modelRouteRows.length,
    budget_decision_row_count: budgetRows.length,
    route_gate_row_count: routeGateRows.length,
    budget_guardrail_row_count: budgetGuardRows.length,
    downgrade_stop_row_count: downgradeStopRows.length,
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, modelRouteRows, budgetRows, routeGateRows, budgetGuardRows, downgradeStopRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.p62400", "source_binding", sourceRows.every(pass), "P62400 source must be valid and ready"),
    validationItem("rows.model_route", "model_route", modelRouteRows.length === MODEL_ROUTE_FIELDS.length && modelRouteRows.every(pass), "Model route decision rows must pass"),
    validationItem("rows.budget_decision", "budget_decision", budgetRows.length === BUDGET_DECISION_FIELDS.length && budgetRows.every(pass), "Budget decision rows must pass"),
    validationItem("rows.route_gate", "route_gate", routeGateRows.length === ROUTE_GATE_POLICIES.length && routeGateRows.every(pass), "Route gate policy rows must pass"),
    validationItem("rows.budget_guardrail", "budget_guardrail", budgetGuardRows.length === BUDGET_GUARDRAILS.length && budgetGuardRows.every(pass), "Budget guardrail rows must pass"),
    validationItem("rows.downgrade_stop", "downgrade_stop", downgradeStopRows.length === DOWNGRADE_STOP_POLICIES.length && downgradeStopRows.every(pass), "Downgrade/stop policy rows must pass"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority carryover must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationCommandRows.length === VALIDATION_COMMANDS.length && validationCommandRows.every((item) => item.mutating === false), "Validation command rows must be non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P62800 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P62801 handoff rows must pass"),
    validationItem("boundary.ready", "boundary", boundary.p62800_contract_ready === true, "P62800 contract must be ready"),
    validationItem("boundary.model_call_false", "authority_boundary", boundary.model_call_allowed_now === false, "Model call must remain false"),
    validationItem("boundary.high_cost_false", "authority_boundary", boundary.high_cost_escalation_allowed_now === false, "High-cost escalation must remain false"),
    validationItem("boundary.budget_spend_false", "authority_boundary", boundary.budget_spend_allowed_now === false, "Budget spend must remain false"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p62801_handoff
    ? "ready_for_p62801_handoff"
    : validation.valid
      ? "valid_block_p62801_handoff_pending"
      : "blocked_hermes_loop_model_budget_control";
  return {
    hermes_loop_model_budget_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p62400_source_ready_now: boundary.p62400_source_ready_now,
    p62800_contract_ready: boundary.p62800_contract_ready,
    ready_for_p62801_handoff: boundary.ready_for_p62801_handoff,
    model_route_row_count: boundary.model_route_row_count,
    budget_decision_row_count: boundary.budget_decision_row_count,
    route_gate_row_count: boundary.route_gate_row_count,
    budget_guardrail_row_count: boundary.budget_guardrail_row_count,
    downgrade_stop_row_count: boundary.downgrade_stop_row_count,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, boundary[flag]])),
  };
}

async function readSourceDagTopology(inputs, generatedAt, options) {
  const existing = await readJsonSource(inputs.source_dag_topology_path);
  if (existing.available) return existing;
  const rebuilt = await buildHermesLoopDagTopology({
    runAt: generatedAt,
    write: false,
    repoRoot: inputs.repo_root,
    sourceSpecPath: inputs.source_spec_path,
    packagePath: inputs.package_path,
    commitRef: options.commitRef,
  });
  return normalizeInlineJsonSource("rebuilt.hermes_loop_dag_topology", rebuilt);
}

function renderMarkdown(result) {
  return [
    `# Hermes Loop Model Budget Control ${result.program_range}`,
    "",
    `- status: ${result.summary.hermes_loop_model_budget_status}`,
    `- p62400_source_ready_now: ${result.summary.p62400_source_ready_now}`,
    `- p62800_contract_ready: ${result.summary.p62800_contract_ready}`,
    `- ready_for_p62801_handoff: ${result.summary.ready_for_p62801_handoff}`,
    `- model_call_allowed_now: ${result.summary.model_call_allowed_now}`,
    `- high_cost_escalation_allowed_now: ${result.summary.high_cost_escalation_allowed_now}`,
    `- budget_spend_allowed_now: ${result.summary.budget_spend_allowed_now}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p62801_handoff
      ? "Implement P62801-P63200 Runtime and Tool Governance with allowlist, timeout, redaction, and no-write boundaries."
      : "Resolve P62800 source, route, budget, gate, downgrade/stop, authority, wiring, or handoff blockers before P62801.",
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
      marker: extra.marker,
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
  return row(rowId, "p62800_closeout", label, observed, "artifacts/hermes-loop-model-budget-control/latest/hermes-loop-model-budget-control.json", generatedAt);
}

function pass(item) {
  return item.current_verdict === "pass";
}

function validationItem(id, category, passed, message) {
  return { validation_id: id, category, passed: passed === true, severity: passed === true ? "info" : "error", message: passed === true ? `${id} passed` : message };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.passed !== true);
  return { valid: errors.length === 0, error_count: errors.length, errors: errors.map((item) => ({ path: item.validation_id, message: item.message, category: item.category })) };
}

function normalizeInputs(options) {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const defaults = DEFAULT_HERMES_LOOP_MODEL_BUDGET_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    source_spec_path: path.resolve(repoRoot, options.sourceSpecPath ?? defaults.sourceSpecPath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_dag_topology_path: path.resolve(repoRoot, options.sourceDagTopologyPath ?? defaults.sourceDagTopologyPath),
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
    else if (arg === "--source-dag-topology") args.sourceDagTopologyPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source-dag-topology PATH]`);
}

function readGitCommitRef(repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
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
