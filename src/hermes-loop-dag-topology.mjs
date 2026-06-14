import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";
import { buildHermesLoopContextMemoryGrounding } from "./hermes-loop-context-memory-grounding.mjs";

export const DEFAULT_HERMES_LOOP_DAG_TOPOLOGY_OUT_DIR = "artifacts/hermes-loop-dag-topology/latest";
export const DEFAULT_HERMES_LOOP_DAG_TOPOLOGY_INPUTS = {
  schemaPath: "schemas/hermes-loop-dag-topology.schema.json",
  packagePath: "package.json",
  sourceSpecPath: "docs/hermes-loop-system-specification.md",
  roadmapDocPath: "docs/hermes-roadmap-p62001-p62400.md",
  architectureDocPath: "docs/architecture.md",
  sourceContextMemoryPath: "artifacts/hermes-loop-context-memory-grounding/latest/hermes-loop-context-memory-grounding.json",
};

const COMMAND_NAME = "platform:hermes-loop-dag-topology";
const SCHEMA_VERSION = "hermes-loop-dag-topology.v1";
const CAPABILITY_ID = "platform.hermes_loop_system_v1_1_dag_topology";
const PROGRAM_RANGE = "P62001-P62400";
const SOURCE_PROGRAM_RANGE = "P61601-P62000";
const NEXT_PROGRAM_RANGE = "P62401-P62800";

const DAG_TOPOLOGY_ITEMS = [
  "root goal node",
  "worker node list",
  "verifier node list",
  "synthesis node",
  "shared blackboard",
  "model route node",
  "budget gate node",
  "human review gate node",
  "retry/correction edge",
  "terminal stop node",
  "bounded DAG contract",
  "swarm topology binding",
];

const DAG_NODE_FIELDS = [
  "node id",
  "input refs",
  "output refs",
  "worker or verifier role",
  "model route policy",
  "tool policy",
  "budget ceiling",
  "retry limit",
  "gate dependency",
  "stop condition",
  "node dependency",
  "graph validation",
];

const WORKER_VERIFIER_ROWS = [
  ["worker_output_candidate", "Worker는 artifact, draft, candidate"],
  ["verifier_reviews_goal_evidence_policy", "Verifier는 goal fit, evidence fit, policy fit, budget fit, model-route fit, stop condition"],
  ["verifier_no_source_mutation", "Verifier는 Worker에게 correction instruction을 낼 수 있지만 source mutation이나 final approval을 만들 수 없다"],
  ["verifier_result_normalized", "Verifier 결과는 normalized finding, gate result, next allowed action"],
  ["worker_no_final", "Worker는 자기 output을 final로 판정하지 않는다"],
  ["high_risk_requires_verifier", "high-risk worker output requires verifier"],
  ["accepted_after_verifier", "worker output은 verifier node를 통과해야 accepted candidate가 된다"],
];

const CORRECTION_RETRY_BUDGET_ROWS = [
  ["correction_edge_retry_limit", "correction edge는 retry limit를 가져야 한다"],
  ["unbounded_cycle_blocked", "graph는 무제한 cycle을 포함하지 않는다"],
  ["bounded_correction_edges_only", "bounded_correction_edges_only"],
  ["correction_consumes_retry_budget", "correction edge consumes retry/budget allowance"],
  ["structured_correction_instruction", "correction instruction이 구조화되어야 한다"],
  ["correction_worker_output_ref", "어떤 Worker output을 고치는지 명시해야 한다"],
  ["correction_scope_limited", "재작업 범위를 제한해야 한다"],
  ["existing_artifact_no_overwrite", "기존 artifact를 덮어쓰지 않아야 한다"],
  ["correction_reverified", "correction 후 다시 Verifier를 통과해야 한다"],
];

const TERMINAL_STOP_ROWS = [
  ["terminal_stop_node", "terminal stop node"],
  ["stop_condition_node", "stop condition node"],
  ["stop_budget_exceeded", "stop budget exceeded"],
  ["stop_goal_satisfied", "stop goal satisfied"],
  ["human_gate_no_auto_complete", "human gate가 필요한 node는 자동으로 completed가 될 수 없다"],
  ["stop_decision_field", "`stop_decision`"],
];

const NEGATIVE_FIXTURES = [
  "missing_p62000_context_memory_source",
  "p62000_validation_invalid",
  "missing_dag_topology_row",
  "missing_dag_node_dependency",
  "worker_self_verification",
  "verifier_final_approval",
  "correction_edge_without_retry_limit",
  "retry_without_budget_consumption",
  "unbounded_cycle",
  "missing_terminal_stop_node",
  "authority_carryover_true",
  "missing_p62401_handoff",
];

const EXTRA_FALSE_FLAGS = [
  "dag_runtime_execution_allowed_now",
  "worker_runtime_execution_allowed_now",
  "verifier_runtime_execution_allowed_now",
  "retry_execution_allowed_now",
  "source_mutation_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/hermes-loop-dag-topology.mjs"],
  ["syntax.script", "node --check scripts/hermes-loop-dag-topology.mjs"],
  ["unit.test", "node --test test/hermes-loop-dag-topology.test.mjs"],
  ["contract.check", "npm run platform:hermes-loop-dag-topology -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/hermes-loop-dag-topology.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runHermesLoopDagTopology(options = {}) {
  const result = await buildHermesLoopDagTopology(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Hermes Loop DAG topology failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeHermesLoopDagTopology(result, result.output_dir);
  return result;
}

export async function buildHermesLoopDagTopology(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HERMES_LOOP_DAG_TOPOLOGY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const sourceSpec = Object.prototype.hasOwnProperty.call(options, "sourceSpecText")
    ? normalizeInlineTextSource("inline.hermes_loop_system_specification", options.sourceSpecText)
    : await readTextSource(inputs.source_spec_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const sourceContextMemory = Object.prototype.hasOwnProperty.call(options, "sourceContextMemory")
    ? normalizeInlineJsonSource("inline.hermes_loop_context_memory_grounding", options.sourceContextMemory)
    : await readSourceContextMemory(inputs, generatedAt, options);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceRows = buildP62000SourceRows({ sourceContextMemory, generatedAt });
  const topologyRows = buildMarkerRows("dag_topology_contract", DAG_TOPOLOGY_ITEMS, sourceSpec, options.omitTopologyItem, generatedAt);
  const nodeRows = buildMarkerRows("dag_node_contract", DAG_NODE_FIELDS, sourceSpec, options.omitNodeField, generatedAt);
  const workerVerifierRows = buildTupleMarkerRows("worker_verifier_separation", WORKER_VERIFIER_ROWS, sourceSpec, options.omitWorkerVerifierRow, generatedAt);
  const correctionRows = buildTupleMarkerRows("correction_retry_budget", CORRECTION_RETRY_BUDGET_ROWS, sourceSpec, options.omitCorrectionRow, generatedAt);
  const stopRows = buildTupleMarkerRows("terminal_stop_node", TERMINAL_STOP_ROWS, sourceSpec, options.omitTerminalStopRow, generatedAt);
  const authorityRows = buildAuthorityRows({ sourceContextMemory, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationCommandRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, topologyRows, nodeRows, workerVerifierRows, correctionRows, stopRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, topologyRows, nodeRows, workerVerifierRows, correctionRows, stopRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows });
  const validationItems = buildValidationItems({ sourceRows, topologyRows, nodeRows, workerVerifierRows, correctionRows, stopRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary });
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
      p62000_context_memory_source_path: sourceContextMemory.path,
      source_commit_ref: commitRef || null,
    },
    hermes_loop_dag_topology_contract: {
      contract_id: "hermes_loop_system_v1_1_dag_topology",
      roadmap_phase: "Phase D: DAG and Worker/Verifier Topology",
      program_range: PROGRAM_RANGE,
      generated_at: generatedAt,
    },
    p62000_context_memory_source_rows: sourceRows,
    dag_topology_contract_rows: topologyRows,
    dag_node_contract_rows: nodeRows,
    worker_verifier_separation_rows: workerVerifierRows,
    correction_retry_budget_rows: correctionRows,
    terminal_stop_node_rows: stopRows,
    authority_boundary_carryover_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationCommandRows,
    hermes_loop_dag_topology_wiring_rows: wiringRows,
    p62400_closeout_rows: closeoutRows,
    p62401_next_phase_handoff_rows: handoffRows,
    hermes_loop_dag_topology_boundary: boundary,
    hermes_loop_dag_topology_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "hermes_loop_dag_topology")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.hermes_loop_dag_topology_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.hermes_loop_dag_topology_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeHermesLoopDagTopology(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "hermes-loop-dag-topology.json"), serializableResult(result));
  await writeJson(path.join(outDir, "dag-topology-contract-rows.json"), collectionEnvelope("dag-topology-contract-rows.v1", "dag_topology_contract_rows", result.dag_topology_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "dag-node-contract-rows.json"), collectionEnvelope("dag-node-contract-rows.v1", "dag_node_contract_rows", result.dag_node_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "worker-verifier-separation-rows.json"), collectionEnvelope("worker-verifier-separation-rows.v1", "worker_verifier_separation_rows", result.worker_verifier_separation_rows, result.generated_at));
  await writeJson(path.join(outDir, "correction-retry-budget-rows.json"), collectionEnvelope("correction-retry-budget-rows.v1", "correction_retry_budget_rows", result.correction_retry_budget_rows, result.generated_at));
  await writeJson(path.join(outDir, "terminal-stop-node-rows.json"), collectionEnvelope("terminal-stop-node-rows.v1", "terminal_stop_node_rows", result.terminal_stop_node_rows, result.generated_at));
  await writeJson(path.join(outDir, "p62400-closeout-rows.json"), collectionEnvelope("p62400-closeout-rows.v1", "p62400_closeout_rows", result.p62400_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "p62401-next-phase-handoff-rows.json"), collectionEnvelope("p62401-next-phase-handoff-rows.v1", "p62401_next_phase_handoff_rows", result.p62401_next_phase_handoff_rows, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHermesLoopDagTopologyCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runHermesLoopDagTopology(args);
  console.log(`Hermes Loop DAG topology ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.hermes_loop_dag_topology_status}`);
  console.log(`P62000 source ready: ${result.summary.p62000_source_ready_now}`);
  console.log(`DAG topology ready: ${result.summary.p62400_contract_ready}`);
  console.log(`Ready for ${NEXT_PROGRAM_RANGE}: ${result.summary.ready_for_p62401_handoff}`);
  console.log(`Worker runtime execution allowed: ${result.summary.worker_runtime_execution_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildP62000SourceRows({ sourceContextMemory, generatedAt }) {
  const summary = sourceContextMemory.data?.summary ?? {};
  const boundary = sourceContextMemory.data?.hermes_loop_context_memory_boundary ?? {};
  return [
    row("source.p62000_available", "p62000_context_memory_source", "P62000 context memory source available or rebuilt", sourceContextMemory.available === true, sourceContextMemory.path, generatedAt),
    row("source.p62000_program", "p62000_context_memory_source", "P62000 source program range matches", sourceContextMemory.data?.program_range === SOURCE_PROGRAM_RANGE, sourceContextMemory.path, generatedAt),
    row("source.p62000_validation", "p62000_context_memory_source", "P62000 source validation is valid", sourceContextMemory.data?.validation?.valid === true, sourceContextMemory.path, generatedAt),
    row("source.p62000_handoff", "p62000_context_memory_source", "P62000 is ready for P62001 handoff", summary.ready_for_p62001_handoff === true, sourceContextMemory.path, generatedAt),
    row("source.p62000_authority_closed", "p62000_context_memory_source", "P62000 authority boundary is closed", boundary.authority_boundary_carryover_closed_now === true, sourceContextMemory.path, generatedAt),
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

function buildAuthorityRows({ sourceContextMemory, overrides = {}, generatedAt }) {
  const sourceBoundary = sourceContextMemory.data?.hermes_loop_context_memory_boundary ?? {};
  const flags = [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS];
  return flags.map((flag) => {
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : sourceBoundary[flag] ?? false;
    return row(`authority.${flag}`, "authority_boundary_carryover", `${flag} carried over as false`, value === false, sourceContextMemory.path, generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks P62400 closeout`,
    true,
    "docs/hermes-roadmap-p62001-p62400.md",
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
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/hermes-loop-dag-topology.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P62001-P62400 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P62001-P62400") && roadmapDoc.text.includes("Negative fixtures"), "docs/hermes-roadmap-p62001-p62400.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture doc references P62001-P62400 DAG topology", architectureDoc.available && architectureDoc.text.includes("P62001-P62400"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, topologyRows, nodeRows, workerVerifierRows, correctionRows, stopRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p62400.p62000_source_ready", "P62000 source is valid and ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p62400.dag_topology", "DAG topology contract rows pass", topologyRows.every(pass), generatedAt),
    closeoutRow("p62400.dag_nodes", "DAG node contract rows pass", nodeRows.every(pass), generatedAt),
    closeoutRow("p62400.worker_verifier", "Worker/verifier separation rows pass", workerVerifierRows.every(pass), generatedAt),
    closeoutRow("p62400.correction_retry_budget", "Correction retry/budget rows pass", correctionRows.every(pass), generatedAt),
    closeoutRow("p62400.terminal_stop", "Terminal stop node rows pass", stopRows.every(pass), generatedAt),
    closeoutRow("p62400.authority_carryover", "Authority carryover remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p62400.negative_fixtures", "Negative fixture rows complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p62400.validation_commands", "Validation commands declared", validationCommandRows.length === VALIDATION_COMMANDS.length, generatedAt),
    closeoutRow("p62400.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, generatedAt }) {
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.p62401_next_source", "next_phase_handoff", `${NEXT_PROGRAM_RANGE} consumes DAG topology`, ready, "artifacts/hermes-loop-dag-topology/latest/hermes-loop-dag-topology.json", generatedAt, {
      next_allowed_action: ready ? "implement_model_routing_budget_control" : "resolve_p62400_closeout_blockers",
    }),
    row("handoff.phase_e_boundary", "next_phase_handoff", "Next phase starts model route and budget control without enabling runtime execution", true, "docs/hermes-loop-system-specification.md#phase-e", generatedAt),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, topologyRows, nodeRows, workerVerifierRows, correctionRows, stopRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows } = parts;
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    p62400_contract_ready: closeoutRows.every(pass),
    p62000_source_ready_now: sourceRows.every(pass),
    dag_topology_contract_ready_now: topologyRows.every(pass),
    dag_node_contract_ready_now: nodeRows.every(pass),
    worker_verifier_separation_ready_now: workerVerifierRows.every(pass),
    correction_retry_budget_ready_now: correctionRows.every(pass),
    terminal_stop_node_ready_now: stopRows.every(pass),
    authority_boundary_carryover_closed_now: authorityRows.every((item) => pass(item) && item.allowed_now === false),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationCommandRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p62401_handoff: handoffRows.every(pass),
    dag_topology_row_count: topologyRows.length,
    dag_node_row_count: nodeRows.length,
    worker_verifier_row_count: workerVerifierRows.length,
    correction_retry_budget_row_count: correctionRows.length,
    terminal_stop_row_count: stopRows.length,
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, topologyRows, nodeRows, workerVerifierRows, correctionRows, stopRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.p62000", "source_binding", sourceRows.every(pass), "P62000 source must be valid and ready"),
    validationItem("rows.dag_topology", "dag_topology", topologyRows.length === DAG_TOPOLOGY_ITEMS.length && topologyRows.every(pass), "DAG topology rows must pass"),
    validationItem("rows.dag_nodes", "dag_node", nodeRows.length === DAG_NODE_FIELDS.length && nodeRows.every(pass), "DAG node rows must pass"),
    validationItem("rows.worker_verifier", "worker_verifier", workerVerifierRows.length === WORKER_VERIFIER_ROWS.length && workerVerifierRows.every(pass), "Worker/verifier separation rows must pass"),
    validationItem("rows.correction_retry_budget", "correction_retry_budget", correctionRows.length === CORRECTION_RETRY_BUDGET_ROWS.length && correctionRows.every(pass), "Correction retry/budget rows must pass"),
    validationItem("rows.terminal_stop", "terminal_stop", stopRows.length === TERMINAL_STOP_ROWS.length && stopRows.every(pass), "Terminal stop rows must pass"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority carryover must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationCommandRows.length === VALIDATION_COMMANDS.length && validationCommandRows.every((item) => item.mutating === false), "Validation command rows must be non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P62400 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P62401 handoff rows must pass"),
    validationItem("boundary.ready", "boundary", boundary.p62400_contract_ready === true, "P62400 contract must be ready"),
    validationItem("boundary.worker_runtime_false", "authority_boundary", boundary.worker_runtime_execution_allowed_now === false, "Worker runtime execution must remain false"),
    validationItem("boundary.verifier_runtime_false", "authority_boundary", boundary.verifier_runtime_execution_allowed_now === false, "Verifier runtime execution must remain false"),
    validationItem("boundary.retry_execution_false", "authority_boundary", boundary.retry_execution_allowed_now === false, "Retry execution must remain false"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p62401_handoff
    ? "ready_for_p62401_handoff"
    : validation.valid
      ? "valid_block_p62401_handoff_pending"
      : "blocked_hermes_loop_dag_topology";
  return {
    hermes_loop_dag_topology_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p62000_source_ready_now: boundary.p62000_source_ready_now,
    p62400_contract_ready: boundary.p62400_contract_ready,
    ready_for_p62401_handoff: boundary.ready_for_p62401_handoff,
    dag_topology_row_count: boundary.dag_topology_row_count,
    dag_node_row_count: boundary.dag_node_row_count,
    worker_verifier_row_count: boundary.worker_verifier_row_count,
    correction_retry_budget_row_count: boundary.correction_retry_budget_row_count,
    terminal_stop_row_count: boundary.terminal_stop_row_count,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, boundary[flag]])),
  };
}

async function readSourceContextMemory(inputs, generatedAt, options) {
  const existing = await readJsonSource(inputs.source_context_memory_path);
  if (existing.available) return existing;
  const rebuilt = await buildHermesLoopContextMemoryGrounding({
    runAt: generatedAt,
    write: false,
    repoRoot: inputs.repo_root,
    sourceSpecPath: inputs.source_spec_path,
    packagePath: inputs.package_path,
    commitRef: options.commitRef,
  });
  return normalizeInlineJsonSource("rebuilt.hermes_loop_context_memory_grounding", rebuilt);
}

function renderMarkdown(result) {
  return [
    `# Hermes Loop DAG Topology ${result.program_range}`,
    "",
    `- status: ${result.summary.hermes_loop_dag_topology_status}`,
    `- p62000_source_ready_now: ${result.summary.p62000_source_ready_now}`,
    `- p62400_contract_ready: ${result.summary.p62400_contract_ready}`,
    `- ready_for_p62401_handoff: ${result.summary.ready_for_p62401_handoff}`,
    `- worker_runtime_execution_allowed_now: ${result.summary.worker_runtime_execution_allowed_now}`,
    `- verifier_runtime_execution_allowed_now: ${result.summary.verifier_runtime_execution_allowed_now}`,
    `- retry_execution_allowed_now: ${result.summary.retry_execution_allowed_now}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p62401_handoff
      ? "Implement P62401-P62800 Model Routing and Budget Control with route gates, downgrade policy, budget ceilings, and stop conditions."
      : "Resolve P62400 source, topology, node, worker/verifier, correction, stop, authority, wiring, or handoff blockers before P62401.",
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
  return row(rowId, "p62400_closeout", label, observed, "artifacts/hermes-loop-dag-topology/latest/hermes-loop-dag-topology.json", generatedAt);
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
  const defaults = DEFAULT_HERMES_LOOP_DAG_TOPOLOGY_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    source_spec_path: path.resolve(repoRoot, options.sourceSpecPath ?? defaults.sourceSpecPath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_context_memory_path: path.resolve(repoRoot, options.sourceContextMemoryPath ?? defaults.sourceContextMemoryPath),
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
    else if (arg === "--source-context-memory") args.sourceContextMemoryPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source-context-memory PATH]`);
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
