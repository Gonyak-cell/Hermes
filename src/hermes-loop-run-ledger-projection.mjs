import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";
import { buildHermesLoopAgentControlContract } from "./hermes-loop-agent-control-contract.mjs";

export const DEFAULT_HERMES_LOOP_RUN_LEDGER_OUT_DIR = "artifacts/hermes-loop-run-ledger-projection/latest";
export const DEFAULT_HERMES_LOOP_RUN_LEDGER_INPUTS = {
  schemaPath: "schemas/hermes-loop-run-ledger-projection.schema.json",
  packagePath: "package.json",
  sourceSpecPath: "docs/hermes-loop-system-specification.md",
  roadmapDocPath: "docs/hermes-roadmap-p61201-p61600.md",
  architectureDocPath: "docs/architecture.md",
  sourceAgentControlPath: "artifacts/hermes-loop-agent-control-contract/latest/hermes-loop-agent-control-contract.json",
};

const COMMAND_NAME = "platform:hermes-loop-run-ledger-projection";
const SCHEMA_VERSION = "hermes-loop-run-ledger-projection.v1";
const CAPABILITY_ID = "platform.hermes_loop_system_v1_1_run_ledger_projection";
const PROGRAM_RANGE = "P61201-P61600";
const SOURCE_PROGRAM_RANGE = "P60801-P61200";
const NEXT_PROGRAM_RANGE = "P61601-P62000";

const TRIGGER_TYPES = [
  "manual operator request",
  "scheduled heartbeat",
  "source artifact change",
  "workflow run update",
  "evidence gap detected",
  "review receipt received",
  "human receipt received",
  "CI/GitHub evidence update",
  "connector boundary update",
  "memory recall candidate update",
  "stale handoff detected",
  "policy conflict detected",
];

const STATE_TRANSITIONS = [
  ["pending", "started"],
  ["context_building", "started"],
  ["planning", "started"],
  ["running", "started"],
  ["waiting_for_approval", "gated"],
  ["waiting_for_user_input", "waiting"],
  ["retrying", "started"],
  ["partially_completed", "waiting"],
  ["completed", "completed"],
  ["failed", "failed"],
  ["cancelled", "failed"],
  ["expired", "failed"],
  ["blocked", "gated"],
];

const GATE_BINDINGS = [
  "source exists",
  "schema valid",
  "domain boundary valid",
  "policy snapshot exists",
  "connector/write boundary closed",
  "DAG topology valid",
  "model route gate present",
  "budget gate present",
  "expected artifact exists",
  "validation command passed",
  "evidence refs complete",
  "review refs complete when required",
  "authority flags remain safe",
];

const BLOCKER_ACTIONS = [
  ["missing_source", "restore_source_ref_or_mark_blocked"],
  ["missing_evidence", "collect_required_evidence_ref"],
  ["missing_review_receipt", "prepare_read_only_review_packet"],
  ["missing_gate_result", "run_deterministic_gate_projection"],
  ["source_conflict_unresolved", "request_operator_source_resolution"],
  ["stale_source", "refresh_source_or_keep_stale_blocker"],
  ["authority_violation", "close_authority_flag_before_closeout"],
  ["budget_exceeded", "stop_or_downgrade_model_route"],
  ["model_route_denied", "select_allowed_model_route_or_human_gate"],
  ["terminal_alignment_missing", "recalculate_terminal_state_alignment"],
];

const AGENT_REF_TYPES = [
  "worker_run_refs",
  "verifier_run_refs",
  "model_route_refs",
  "budget_gate_refs",
  "evidence_refs",
  "review_refs",
  "gate_refs",
  "receipt_refs",
];

const NEGATIVE_FIXTURES = [
  "missing_p61200_agent_control_source",
  "p61200_validation_invalid",
  "missing_trigger_mapping",
  "missing_state_transition_binding",
  "terminal_alignment_unchecked",
  "missing_gate_result_binding",
  "missing_blocker",
  "missing_next_allowed_action",
  "missing_worker_or_verifier_ref",
  "missing_model_or_budget_ref",
  "authority_carryover_true",
  "missing_p61601_handoff",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/hermes-loop-run-ledger-projection.mjs"],
  ["syntax.script", "node --check scripts/hermes-loop-run-ledger-projection.mjs"],
  ["unit.test", "node --test test/hermes-loop-run-ledger-projection.test.mjs"],
  ["contract.check", "npm run platform:hermes-loop-run-ledger-projection -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/hermes-loop-run-ledger-projection.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runHermesLoopRunLedgerProjection(options = {}) {
  const result = await buildHermesLoopRunLedgerProjection(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Hermes Loop run ledger projection failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeHermesLoopRunLedgerProjection(result, result.output_dir);
  return result;
}

export async function buildHermesLoopRunLedgerProjection(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HERMES_LOOP_RUN_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const sourceSpec = Object.prototype.hasOwnProperty.call(options, "sourceSpecText")
    ? normalizeInlineTextSource("inline.hermes_loop_system_specification", options.sourceSpecText)
    : await readTextSource(inputs.source_spec_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const sourceAgentControl = Object.prototype.hasOwnProperty.call(options, "sourceAgentControl")
    ? normalizeInlineJsonSource("inline.hermes_loop_agent_control_contract", options.sourceAgentControl)
    : await readSourceAgentControl(inputs, generatedAt, options);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceRows = buildP61200SourceRows({ sourceAgentControl, generatedAt });
  const triggerRows = buildTriggerRows({ sourceSpec, omitId: options.omitTrigger, generatedAt });
  const stateRows = buildStateRows({ sourceSpec, omitId: options.omitStateTransition, generatedAt });
  const gateRows = buildGateRows({ sourceSpec, omitId: options.omitGateBinding, generatedAt });
  const blockerRows = buildBlockerRows({ omitId: options.omitBlockerAction, generatedAt });
  const agentRefRows = buildAgentRefRows({ sourceSpec, omitId: options.omitAgentRef, generatedAt });
  const authorityRows = buildAuthorityRows({ sourceAgentControl, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationCommandRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, triggerRows, stateRows, gateRows, blockerRows, agentRefRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, triggerRows, stateRows, gateRows, blockerRows, agentRefRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows });
  const validationItems = buildValidationItems({ sourceRows, triggerRows, stateRows, gateRows, blockerRows, agentRefRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary });
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
      p61200_agent_control_source_path: sourceAgentControl.path,
      source_commit_ref: commitRef || null,
    },
    hermes_loop_run_ledger_contract: {
      contract_id: "hermes_loop_system_v1_1_run_ledger_projection",
      roadmap_phase: "Phase B: Loop Run Ledger Projection",
      program_range: PROGRAM_RANGE,
      generated_at: generatedAt,
    },
    p61200_agent_control_source_rows: sourceRows,
    source_event_to_loop_run_projection_rows: triggerRows,
    workflow_state_transition_binding_rows: stateRows,
    gate_result_binding_rows: gateRows,
    blocker_next_action_projection_rows: blockerRows,
    agent_ref_projection_rows: agentRefRows,
    authority_boundary_carryover_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationCommandRows,
    hermes_loop_run_ledger_wiring_rows: wiringRows,
    p61600_closeout_rows: closeoutRows,
    p61601_next_phase_handoff_rows: handoffRows,
    hermes_loop_run_ledger_boundary: boundary,
    hermes_loop_run_ledger_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "hermes_loop_run_ledger_projection")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.hermes_loop_run_ledger_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.hermes_loop_run_ledger_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeHermesLoopRunLedgerProjection(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "hermes-loop-run-ledger-projection.json"), serializableResult(result));
  await writeJson(path.join(outDir, "source-event-to-loop-run-projection-rows.json"), collectionEnvelope("source-event-to-loop-run-projection-rows.v1", "source_event_to_loop_run_projection_rows", result.source_event_to_loop_run_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "workflow-state-transition-binding-rows.json"), collectionEnvelope("workflow-state-transition-binding-rows.v1", "workflow_state_transition_binding_rows", result.workflow_state_transition_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "gate-result-binding-rows.json"), collectionEnvelope("gate-result-binding-rows.v1", "gate_result_binding_rows", result.gate_result_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "blocker-next-action-projection-rows.json"), collectionEnvelope("blocker-next-action-projection-rows.v1", "blocker_next_action_projection_rows", result.blocker_next_action_projection_rows, result.generated_at));
  await writeJson(path.join(outDir, "p61600-closeout-rows.json"), collectionEnvelope("p61600-closeout-rows.v1", "p61600_closeout_rows", result.p61600_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "p61601-next-phase-handoff-rows.json"), collectionEnvelope("p61601-next-phase-handoff-rows.v1", "p61601_next_phase_handoff_rows", result.p61601_next_phase_handoff_rows, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHermesLoopRunLedgerProjectionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runHermesLoopRunLedgerProjection(args);
  console.log(`Hermes Loop run ledger projection ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.hermes_loop_run_ledger_status}`);
  console.log(`P61200 source ready: ${result.summary.p61200_source_ready_now}`);
  console.log(`Run ledger ready: ${result.summary.p61600_contract_ready}`);
  console.log(`Ready for ${NEXT_PROGRAM_RANGE}: ${result.summary.ready_for_p61601_handoff}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildP61200SourceRows({ sourceAgentControl, generatedAt }) {
  const summary = sourceAgentControl.data?.summary ?? {};
  const boundary = sourceAgentControl.data?.hermes_loop_agent_control_boundary ?? {};
  return [
    row("source.p61200_available", "p61200_agent_control_source", "P61200 agent control source available or rebuilt", sourceAgentControl.available === true, sourceAgentControl.path, generatedAt),
    row("source.p61200_program", "p61200_agent_control_source", "P61200 source program range matches", sourceAgentControl.data?.program_range === SOURCE_PROGRAM_RANGE, sourceAgentControl.path, generatedAt),
    row("source.p61200_validation", "p61200_agent_control_source", "P61200 source validation is valid", sourceAgentControl.data?.validation?.valid === true, sourceAgentControl.path, generatedAt),
    row("source.p61200_handoff", "p61200_agent_control_source", "P61200 is ready for P61201 handoff", summary.ready_for_p61201_handoff === true, sourceAgentControl.path, generatedAt),
    row("source.p61200_authority_closed", "p61200_agent_control_source", "P61200 authority boundary is closed", boundary.authority_boundary_carryover_closed_now === true, sourceAgentControl.path, generatedAt),
  ];
}

function buildTriggerRows({ sourceSpec, omitId, generatedAt }) {
  const text = sourceSpec.text ?? "";
  return TRIGGER_TYPES.filter((trigger) => trigger !== omitId).map((trigger) => row(
    `trigger.${normalizeId(trigger)}`,
    "source_event_to_loop_run_projection",
    `${trigger} projects to a Loop Run candidate, not direct action`,
    text.includes(trigger),
    sourceSpec.path,
    generatedAt,
    { trigger_type: trigger, direct_action_allowed_now: false },
  ));
}

function buildStateRows({ sourceSpec, omitId, generatedAt }) {
  const text = sourceSpec.text ?? "";
  return STATE_TRANSITIONS.filter(([sourceState]) => sourceState !== omitId).map(([sourceState, hermesState]) => row(
    `state.${sourceState}`,
    "workflow_state_transition_binding",
    `${sourceState} maps to Hermes DSL ${hermesState}`,
    text.includes(`| \`${sourceState}\``) && text.includes(`| \`${hermesState}\``),
    sourceSpec.path,
    generatedAt,
    { source_state: sourceState, hermes_state: hermesState },
  ));
}

function buildGateRows({ sourceSpec, omitId, generatedAt }) {
  const text = sourceSpec.text ?? "";
  return GATE_BINDINGS.filter((gate) => gate !== omitId).map((gate) => row(
    `gate.${normalizeId(gate)}`,
    "gate_result_binding",
    `${gate} gate binding visible`,
    text.includes(gate),
    sourceSpec.path,
    generatedAt,
    { gate_key: gate },
  ));
}

function buildBlockerRows({ omitId, generatedAt }) {
  return BLOCKER_ACTIONS.filter(([blocker]) => blocker !== omitId).map(([blocker, action]) => row(
    `blocker.${blocker}`,
    "blocker_next_action_projection",
    `${blocker} has next allowed action ${action}`,
    Boolean(action),
    "docs/hermes-loop-system-specification.md#phase-b",
    generatedAt,
    { blocker_id: blocker, projected_next_allowed_action: action },
  ));
}

function buildAgentRefRows({ sourceSpec, omitId, generatedAt }) {
  const text = sourceSpec.text ?? "";
  return AGENT_REF_TYPES.filter((refType) => refType !== omitId).map((refType) => row(
    `agent_ref.${refType}`,
    "agent_ref_projection",
    `${refType} is part of Loop Run ledger projection`,
    text.includes(`\`${refType}\``) || text.includes(`"${refType}"`),
    sourceSpec.path,
    generatedAt,
    { ref_type: refType },
  ));
}

function buildAuthorityRows({ sourceAgentControl, overrides = {}, generatedAt }) {
  const sourceBoundary = sourceAgentControl.data?.hermes_loop_agent_control_boundary ?? {};
  return HERMES_LOOP_AUTHORITY_FALSE_FLAGS.map((flag) => {
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : sourceBoundary[flag] ?? false;
    return row(`authority.${flag}`, "authority_boundary_carryover", `${flag} carried over as false`, value === false, sourceAgentControl.path, generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks P61600 closeout`,
    true,
    "docs/hermes-roadmap-p61201-p61600.md",
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
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/hermes-loop-run-ledger-projection.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P61201-P61600 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P61201-P61600") && roadmapDoc.text.includes("Negative fixtures"), "docs/hermes-roadmap-p61201-p61600.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture doc references P61201-P61600 run ledger projection", architectureDoc.available && architectureDoc.text.includes("P61201-P61600"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, triggerRows, stateRows, gateRows, blockerRows, agentRefRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p61600.p61200_source_ready", "P61200 source is valid and ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p61600.trigger_projection", "Trigger to Loop Run projection rows pass", triggerRows.every(pass), generatedAt),
    closeoutRow("p61600.state_transition_binding", "Workflow state transition rows pass", stateRows.every(pass), generatedAt),
    closeoutRow("p61600.gate_binding", "Gate result binding rows pass", gateRows.every(pass), generatedAt),
    closeoutRow("p61600.blocker_next_action", "Blocker and next allowed action rows pass", blockerRows.every(pass), generatedAt),
    closeoutRow("p61600.agent_refs", "Agent/reference projection rows pass", agentRefRows.every(pass), generatedAt),
    closeoutRow("p61600.authority_carryover", "Authority carryover remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p61600.negative_fixtures", "Negative fixture rows complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p61600.validation_commands", "Validation commands declared", validationCommandRows.length === VALIDATION_COMMANDS.length, generatedAt),
    closeoutRow("p61600.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, generatedAt }) {
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.p61601_next_source", "next_phase_handoff", `${NEXT_PROGRAM_RANGE} consumes Loop Run ledger projection`, ready, "artifacts/hermes-loop-run-ledger-projection/latest/hermes-loop-run-ledger-projection.json", generatedAt, {
      next_allowed_action: ready ? "implement_context_memory_grounding" : "resolve_p61600_closeout_blockers",
    }),
    row("handoff.phase_c_boundary", "next_phase_handoff", "Next phase starts context and memory grounding without raw exposure", true, "docs/hermes-loop-system-specification.md#phase-c", generatedAt),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, triggerRows, stateRows, gateRows, blockerRows, agentRefRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows } = parts;
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    p61600_contract_ready: closeoutRows.every(pass),
    p61200_source_ready_now: sourceRows.every(pass),
    source_event_to_loop_run_projection_ready_now: triggerRows.every(pass),
    workflow_state_transition_binding_ready_now: stateRows.every(pass),
    gate_result_binding_ready_now: gateRows.every(pass),
    blocker_next_action_projection_ready_now: blockerRows.every(pass),
    agent_ref_projection_ready_now: agentRefRows.every(pass),
    authority_boundary_carryover_closed_now: authorityRows.every((item) => pass(item) && item.allowed_now === false),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationCommandRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p61601_handoff: handoffRows.every(pass),
    trigger_projection_row_count: triggerRows.length,
    state_transition_row_count: stateRows.length,
    gate_binding_row_count: gateRows.length,
    blocker_next_action_row_count: blockerRows.length,
    agent_ref_row_count: agentRefRows.length,
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, triggerRows, stateRows, gateRows, blockerRows, agentRefRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.p61200", "source_binding", sourceRows.every(pass), "P61200 source must be valid and ready"),
    validationItem("rows.triggers", "projection", triggerRows.length === TRIGGER_TYPES.length && triggerRows.every(pass), "Trigger rows must pass"),
    validationItem("rows.states", "projection", stateRows.length === STATE_TRANSITIONS.length && stateRows.every(pass), "State transition rows must pass"),
    validationItem("rows.gates", "projection", gateRows.length === GATE_BINDINGS.length && gateRows.every(pass), "Gate binding rows must pass"),
    validationItem("rows.blockers", "projection", blockerRows.length === BLOCKER_ACTIONS.length && blockerRows.every(pass), "Blocker next action rows must pass"),
    validationItem("rows.agent_refs", "projection", agentRefRows.length === AGENT_REF_TYPES.length && agentRefRows.every(pass), "Agent ref rows must pass"),
    validationItem("rows.authority", "authority_boundary", authorityRows.length === HERMES_LOOP_AUTHORITY_FALSE_FLAGS.length && authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority carryover must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationCommandRows.length === VALIDATION_COMMANDS.length && validationCommandRows.every((item) => item.mutating === false), "Validation command rows must be non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P61600 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P61601 handoff rows must pass"),
    validationItem("boundary.ready", "boundary", boundary.p61600_contract_ready === true, "P61600 contract must be ready"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p61601_handoff
    ? "ready_for_p61601_handoff"
    : validation.valid
      ? "valid_block_p61601_handoff_pending"
      : "blocked_hermes_loop_run_ledger_projection";
  return {
    hermes_loop_run_ledger_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p61200_source_ready_now: boundary.p61200_source_ready_now,
    p61600_contract_ready: boundary.p61600_contract_ready,
    ready_for_p61601_handoff: boundary.ready_for_p61601_handoff,
    trigger_projection_row_count: boundary.trigger_projection_row_count,
    state_transition_row_count: boundary.state_transition_row_count,
    gate_binding_row_count: boundary.gate_binding_row_count,
    blocker_next_action_row_count: boundary.blocker_next_action_row_count,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries(HERMES_LOOP_AUTHORITY_FALSE_FLAGS.map((flag) => [flag, boundary[flag]])),
  };
}

async function readSourceAgentControl(inputs, generatedAt, options) {
  const existing = await readJsonSource(inputs.source_agent_control_path);
  if (existing.available) return existing;
  const rebuilt = await buildHermesLoopAgentControlContract({
    runAt: generatedAt,
    write: false,
    repoRoot: inputs.repo_root,
    sourceSpecPath: inputs.source_spec_path,
    packagePath: inputs.package_path,
    commitRef: options.commitRef,
  });
  return normalizeInlineJsonSource("rebuilt.hermes_loop_agent_control_contract", rebuilt);
}

function renderMarkdown(result) {
  return [
    `# Hermes Loop Run Ledger Projection ${result.program_range}`,
    "",
    `- status: ${result.summary.hermes_loop_run_ledger_status}`,
    `- p61200_source_ready_now: ${result.summary.p61200_source_ready_now}`,
    `- p61600_contract_ready: ${result.summary.p61600_contract_ready}`,
    `- ready_for_p61601_handoff: ${result.summary.ready_for_p61601_handoff}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    `- final_approval_enabled: ${result.summary.final_approval_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p61601_handoff
      ? "Implement P61601-P62000 Context and Memory Grounding with citation/source span and stale/conflict/domain guards."
      : "Resolve P61600 source, trigger, state, gate, blocker, authority, wiring, or handoff blockers before P61601.",
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
      trigger_type: extra.trigger_type,
      direct_action_allowed_now: extra.direct_action_allowed_now,
      source_state: extra.source_state,
      hermes_state: extra.hermes_state,
      gate_key: extra.gate_key,
      blocker_id: extra.blocker_id,
      projected_next_allowed_action: extra.projected_next_allowed_action,
      ref_type: extra.ref_type,
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
  return row(rowId, "p61600_closeout", label, observed, "artifacts/hermes-loop-run-ledger-projection/latest/hermes-loop-run-ledger-projection.json", generatedAt);
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
  const defaults = DEFAULT_HERMES_LOOP_RUN_LEDGER_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    source_spec_path: path.resolve(repoRoot, options.sourceSpecPath ?? defaults.sourceSpecPath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_agent_control_path: path.resolve(repoRoot, options.sourceAgentControlPath ?? defaults.sourceAgentControlPath),
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
    else if (arg === "--source-agent-control") args.sourceAgentControlPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source-agent-control PATH]`);
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
