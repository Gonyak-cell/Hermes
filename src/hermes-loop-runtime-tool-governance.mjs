import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { HERMES_LOOP_AUTHORITY_FALSE_FLAGS } from "./hermes-loop-source-binding.mjs";
import { buildHermesLoopModelBudgetControl } from "./hermes-loop-model-budget-control.mjs";

export const DEFAULT_HERMES_LOOP_RUNTIME_TOOL_OUT_DIR = "artifacts/hermes-loop-runtime-tool-governance/latest";
export const DEFAULT_HERMES_LOOP_RUNTIME_TOOL_INPUTS = {
  schemaPath: "schemas/hermes-loop-runtime-tool-governance.schema.json",
  packagePath: "package.json",
  sourceSpecPath: "docs/hermes-loop-system-specification.md",
  roadmapDocPath: "docs/hermes-roadmap-p62801-p63200.md",
  architectureDocPath: "docs/architecture.md",
  sourceModelBudgetPath: "artifacts/hermes-loop-model-budget-control/latest/hermes-loop-model-budget-control.json",
};

const COMMAND_NAME = "platform:hermes-loop-runtime-tool-governance";
const SCHEMA_VERSION = "hermes-loop-runtime-tool-governance.v1";
const CAPABILITY_ID = "platform.hermes_loop_system_v1_1_runtime_tool_governance";
const PROGRAM_RANGE = "P62801-P63200";
const SOURCE_PROGRAM_RANGE = "P62401-P62800";
const NEXT_PROGRAM_RANGE = "P63201-P63600";

const RUNTIME_ADAPTER_ITEMS = [
  "adapter id",
  "runtime id",
  "risk level",
  "execution mode",
  "sandbox policy",
  "timeout and heartbeat",
  "workspace isolation",
  "command binding",
  "output contract",
  "output hash",
  "log capture",
  "artifact capture",
  "verification requirement",
  "acceptance authority",
  "runtime adapter binding",
];

const TOOL_POLICY_ITEMS = [
  "tool policy",
  "sandbox policy",
  "timeout",
  "redaction",
  "logging",
  "output contract",
  "deterministic script",
  "schema validator",
  "local artifact reader",
  "read-only API projector",
  "dashboard builder",
  "connector boundary checker",
  "runtime adapter",
  "receipt validator",
  "tool policy binding",
];

const COMMAND_ALLOWLIST_CANDIDATES = [
  "read-only source inspection",
  "schema validation",
  "deterministic check command",
  "dashboard build",
  "GET/HEAD-only API smoke",
  "review packet generation",
  "receipt template generation",
  "candidate diff projection",
  "no-op dry run",
  "command allowlist candidate",
];

const SANDBOX_TIMEOUT_LOG_ARTIFACT_ROWS = [
  "sandbox/timeout/log/artifact/cost contract",
  "sandbox policy",
  "timeout and heartbeat",
  "log capture",
  "artifact capture",
  "output hash",
  "`max_runtime_seconds`",
  "`observed_runtime_seconds`",
  "cost budget ledger binding",
];

const RUNTIME_VERIFICATION_GUARDS = [
  ["high_risk_runtime_requires_verification", "high-risk runtime requires verification"],
  ["untrusted_output_not_accepted", "untrusted output not accepted"],
  ["command_execution_still_false", "command execution still false unless explicitly matured"],
  ["mutating_command_blocked", "command execution that mutates source"],
  ["connector_write_blocked", "connector write"],
  ["secret_read_blocked", "secret read"],
  ["direct_file_write_blocked", "direct file write by default"],
  ["rollback_execution_blocked", "rollback execution"],
  ["mutating_api_not_default", "Mutating API는 기본 범위가 아니다"],
];

const NEGATIVE_FIXTURES = [
  "missing_p62800_model_budget_source",
  "p62800_validation_invalid",
  "missing_runtime_adapter_binding",
  "missing_tool_policy_binding",
  "command_allowlist_treated_as_executable",
  "sandbox_missing",
  "timeout_heartbeat_missing",
  "secret_read_allowed",
  "connector_write_allowed",
  "direct_file_write_allowed",
  "high_risk_runtime_without_verification",
  "authority_carryover_true",
  "missing_p63201_handoff",
];

const EXTRA_FALSE_FLAGS = [
  "command_execution_allowed_now",
  "tool_invocation_allowed_now",
  "secret_read_allowed_now",
  "rollback_execution_allowed_now",
  "api_mutation_allowed_now",
  "direct_file_write_allowed_now",
];

const VALIDATION_COMMANDS = [
  ["syntax.src", "node --check src/hermes-loop-runtime-tool-governance.mjs"],
  ["syntax.script", "node --check scripts/hermes-loop-runtime-tool-governance.mjs"],
  ["unit.test", "node --test test/hermes-loop-runtime-tool-governance.test.mjs"],
  ["contract.check", "npm run platform:hermes-loop-runtime-tool-governance -- --check"],
  ["package.schema.json", "node -e 'JSON.parse(require(\"node:fs\").readFileSync(\"package.json\", \"utf8\")); JSON.parse(require(\"node:fs\").readFileSync(\"schemas/hermes-loop-runtime-tool-governance.schema.json\", \"utf8\"));'"],
  ["diff.check", "git diff --check"],
];

export async function runHermesLoopRuntimeToolGovernance(options = {}) {
  const result = await buildHermesLoopRuntimeToolGovernance(options);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Hermes Loop runtime tool governance failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  if (!options.check && options.write !== false) await writeHermesLoopRuntimeToolGovernance(result, result.output_dir);
  return result;
}

export async function buildHermesLoopRuntimeToolGovernance(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HERMES_LOOP_RUNTIME_TOOL_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const sourceSpec = Object.prototype.hasOwnProperty.call(options, "sourceSpecText")
    ? normalizeInlineTextSource("inline.hermes_loop_system_specification", options.sourceSpecText)
    : await readTextSource(inputs.source_spec_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const sourceModelBudget = Object.prototype.hasOwnProperty.call(options, "sourceModelBudget")
    ? normalizeInlineJsonSource("inline.hermes_loop_model_budget_control", options.sourceModelBudget)
    : await readSourceModelBudget(inputs, generatedAt, options);
  const commitRef = Object.prototype.hasOwnProperty.call(options, "commitRef")
    ? String(options.commitRef ?? "")
    : readGitCommitRef(inputs.repo_root);

  const sourceRows = buildP62800SourceRows({ sourceModelBudget, generatedAt });
  const runtimeRows = buildMarkerRows("runtime_adapter_contract", RUNTIME_ADAPTER_ITEMS, sourceSpec, options.omitRuntimeAdapterItem, generatedAt);
  const toolPolicyRows = buildMarkerRows("tool_policy_contract", TOOL_POLICY_ITEMS, sourceSpec, options.omitToolPolicyItem, generatedAt);
  const commandRows = buildMarkerRows("command_allowlist_candidate", COMMAND_ALLOWLIST_CANDIDATES, sourceSpec, options.omitCommandAllowlistCandidate, generatedAt);
  const sandboxRows = buildMarkerRows("sandbox_timeout_log_artifact", SANDBOX_TIMEOUT_LOG_ARTIFACT_ROWS, sourceSpec, options.omitSandboxRow, generatedAt);
  const runtimeGuardRows = buildTupleMarkerRows("runtime_verification_guard", RUNTIME_VERIFICATION_GUARDS, sourceSpec, options.omitRuntimeGuard, generatedAt);
  const authorityRows = buildAuthorityRows({ sourceModelBudget, overrides: options.authorityOverrides, generatedAt });
  const negativeRows = buildNegativeRows({ omitId: options.omitNegativeFixtureId, generatedAt });
  const validationCommandRows = buildValidationCommandRows(generatedAt);
  const wiringRows = buildWiringRows({ packageJson, roadmapDoc, architectureDoc, generatedAt });
  const closeoutRows = buildCloseoutRows({ sourceRows, runtimeRows, toolPolicyRows, commandRows, sandboxRows, runtimeGuardRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt });
  const handoffRows = buildHandoffRows({ closeoutRows, generatedAt });
  const boundary = buildBoundary({ sourceRows, runtimeRows, toolPolicyRows, commandRows, sandboxRows, runtimeGuardRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows });
  const validationItems = buildValidationItems({ sourceRows, runtimeRows, toolPolicyRows, commandRows, sandboxRows, runtimeGuardRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary });
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
      p62800_model_budget_source_path: sourceModelBudget.path,
      source_commit_ref: commitRef || null,
    },
    hermes_loop_runtime_tool_contract: {
      contract_id: "hermes_loop_system_v1_1_runtime_tool_governance",
      roadmap_phase: "Phase F: Runtime and Tool Governance",
      program_range: PROGRAM_RANGE,
      generated_at: generatedAt,
    },
    p62800_model_budget_source_rows: sourceRows,
    runtime_adapter_contract_rows: runtimeRows,
    tool_policy_contract_rows: toolPolicyRows,
    command_allowlist_candidate_rows: commandRows,
    sandbox_timeout_log_artifact_rows: sandboxRows,
    runtime_verification_guard_rows: runtimeGuardRows,
    authority_boundary_carryover_rows: authorityRows,
    negative_fixture_contract_rows: negativeRows,
    validation_command_rows: validationCommandRows,
    hermes_loop_runtime_tool_wiring_rows: wiringRows,
    p63200_closeout_rows: closeoutRows,
    p63201_next_phase_handoff_rows: handoffRows,
    hermes_loop_runtime_tool_boundary: boundary,
    hermes_loop_runtime_tool_validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "hermes_loop_runtime_tool_governance")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.hermes_loop_runtime_tool_validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.hermes_loop_runtime_tool_validation_items);
  result.summary = buildSummary({ boundary, validation: result.validation });
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeHermesLoopRuntimeToolGovernance(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "hermes-loop-runtime-tool-governance.json"), serializableResult(result));
  await writeJson(path.join(outDir, "runtime-adapter-contract-rows.json"), collectionEnvelope("runtime-adapter-contract-rows.v1", "runtime_adapter_contract_rows", result.runtime_adapter_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "tool-policy-contract-rows.json"), collectionEnvelope("tool-policy-contract-rows.v1", "tool_policy_contract_rows", result.tool_policy_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "command-allowlist-candidate-rows.json"), collectionEnvelope("command-allowlist-candidate-rows.v1", "command_allowlist_candidate_rows", result.command_allowlist_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "sandbox-timeout-log-artifact-rows.json"), collectionEnvelope("sandbox-timeout-log-artifact-rows.v1", "sandbox_timeout_log_artifact_rows", result.sandbox_timeout_log_artifact_rows, result.generated_at));
  await writeJson(path.join(outDir, "runtime-verification-guard-rows.json"), collectionEnvelope("runtime-verification-guard-rows.v1", "runtime_verification_guard_rows", result.runtime_verification_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "p63200-closeout-rows.json"), collectionEnvelope("p63200-closeout-rows.v1", "p63200_closeout_rows", result.p63200_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "p63201-next-phase-handoff-rows.json"), collectionEnvelope("p63201-next-phase-handoff-rows.v1", "p63201_next_phase_handoff_rows", result.p63201_next_phase_handoff_rows, result.generated_at));
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHermesLoopRuntimeToolGovernanceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return null;
  }
  const result = await runHermesLoopRuntimeToolGovernance(args);
  console.log(`Hermes Loop runtime tool governance ${args.check ? "validated" : "written"} at ${result.output_dir}`);
  console.log(`Program: ${result.program_range}`);
  console.log(`Status: ${result.summary.hermes_loop_runtime_tool_status}`);
  console.log(`P62800 source ready: ${result.summary.p62800_source_ready_now}`);
  console.log(`Runtime tool ready: ${result.summary.p63200_contract_ready}`);
  console.log(`Ready for ${NEXT_PROGRAM_RANGE}: ${result.summary.ready_for_p63201_handoff}`);
  console.log(`Command execution allowed: ${result.summary.command_execution_allowed_now}`);
  console.log(`Tool invocation allowed: ${result.summary.tool_invocation_allowed_now}`);
  console.log(`Secret read allowed: ${result.summary.secret_read_allowed_now}`);
  console.log(`Production PASS enabled: ${result.summary.production_pass_enabled}`);
  console.log(`Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`);
  console.log(`Validation errors: ${result.validation.error_count}`);
  return result;
}

function buildP62800SourceRows({ sourceModelBudget, generatedAt }) {
  const summary = sourceModelBudget.data?.summary ?? {};
  const boundary = sourceModelBudget.data?.hermes_loop_model_budget_boundary ?? {};
  return [
    row("source.p62800_available", "p62800_model_budget_source", "P62800 model budget source available or rebuilt", sourceModelBudget.available === true, sourceModelBudget.path, generatedAt),
    row("source.p62800_program", "p62800_model_budget_source", "P62800 source program range matches", sourceModelBudget.data?.program_range === SOURCE_PROGRAM_RANGE, sourceModelBudget.path, generatedAt),
    row("source.p62800_validation", "p62800_model_budget_source", "P62800 source validation is valid", sourceModelBudget.data?.validation?.valid === true, sourceModelBudget.path, generatedAt),
    row("source.p62800_handoff", "p62800_model_budget_source", "P62800 is ready for P62801 handoff", summary.ready_for_p62801_handoff === true, sourceModelBudget.path, generatedAt),
    row("source.p62800_authority_closed", "p62800_model_budget_source", "P62800 authority boundary is closed", boundary.authority_boundary_carryover_closed_now === true, sourceModelBudget.path, generatedAt),
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

function buildAuthorityRows({ sourceModelBudget, overrides = {}, generatedAt }) {
  const sourceBoundary = sourceModelBudget.data?.hermes_loop_model_budget_boundary ?? {};
  const flags = [...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS];
  return flags.map((flag) => {
    const value = Object.prototype.hasOwnProperty.call(overrides, flag) ? overrides[flag] : sourceBoundary[flag] ?? false;
    return row(`authority.${flag}`, "authority_boundary_carryover", `${flag} carried over as false`, value === false, sourceModelBudget.path, generatedAt, {
      authority_flag: flag,
      allowed_now: value === false ? false : value,
    });
  });
}

function buildNegativeRows({ omitId, generatedAt }) {
  return NEGATIVE_FIXTURES.filter((fixtureId) => fixtureId !== omitId).map((fixtureId) => row(
    `negative_fixture.${fixtureId}`,
    "negative_fixture_contract",
    `${fixtureId} blocks P63200 closeout`,
    true,
    "docs/hermes-roadmap-p62801-p63200.md",
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
    row("wiring.package_script", "wiring", `${COMMAND_NAME} script registered`, scripts[COMMAND_NAME] === "node scripts/hermes-loop-runtime-tool-governance.mjs", "package.json", generatedAt),
    row("wiring.roadmap_doc", "wiring", "P62801-P63200 roadmap doc includes required plan fields", roadmapDoc.available && roadmapDoc.text.includes("P62801-P63200") && roadmapDoc.text.includes("Negative fixtures"), "docs/hermes-roadmap-p62801-p63200.md", generatedAt),
    row("wiring.architecture_doc", "wiring", "Architecture doc references P62801-P63200 runtime tool governance", architectureDoc.available && architectureDoc.text.includes("P62801-P63200"), "docs/architecture.md", generatedAt),
  ];
}

function buildCloseoutRows(parts) {
  const { sourceRows, runtimeRows, toolPolicyRows, commandRows, sandboxRows, runtimeGuardRows, authorityRows, negativeRows, validationCommandRows, wiringRows, generatedAt } = parts;
  return [
    closeoutRow("p63200.p62800_source_ready", "P62800 source is valid and ready", sourceRows.every(pass), generatedAt),
    closeoutRow("p63200.runtime_adapter", "Runtime adapter contract rows pass", runtimeRows.every(pass), generatedAt),
    closeoutRow("p63200.tool_policy", "Tool policy contract rows pass", toolPolicyRows.every(pass), generatedAt),
    closeoutRow("p63200.command_allowlist", "Command allowlist candidate rows pass", commandRows.every(pass), generatedAt),
    closeoutRow("p63200.sandbox_timeout_log_artifact", "Sandbox/timeout/log/artifact rows pass", sandboxRows.every(pass), generatedAt),
    closeoutRow("p63200.runtime_verification_guards", "Runtime verification guard rows pass", runtimeGuardRows.every(pass), generatedAt),
    closeoutRow("p63200.authority_carryover", "Authority carryover remains false", authorityRows.every((item) => pass(item) && item.allowed_now === false), generatedAt),
    closeoutRow("p63200.negative_fixtures", "Negative fixture rows complete", negativeRows.length === NEGATIVE_FIXTURES.length, generatedAt),
    closeoutRow("p63200.validation_commands", "Validation commands declared", validationCommandRows.length === VALIDATION_COMMANDS.length, generatedAt),
    closeoutRow("p63200.wiring_complete", "Package, roadmap, and architecture wiring complete", wiringRows.every(pass), generatedAt),
  ];
}

function buildHandoffRows({ closeoutRows, generatedAt }) {
  const ready = closeoutRows.every(pass);
  return [
    row("handoff.p63201_next_source", "next_phase_handoff", `${NEXT_PROGRAM_RANGE} consumes runtime tool governance`, ready, "artifacts/hermes-loop-runtime-tool-governance/latest/hermes-loop-runtime-tool-governance.json", generatedAt, {
      next_allowed_action: ready ? "implement_review_human_gate_integration" : "resolve_p63200_closeout_blockers",
    }),
    row("handoff.phase_g_boundary", "next_phase_handoff", "Next phase starts review and human gate integration without granting final approval", true, "docs/hermes-loop-system-specification.md#phase-g", generatedAt),
  ];
}

function buildBoundary(parts) {
  const { sourceRows, runtimeRows, toolPolicyRows, commandRows, sandboxRows, runtimeGuardRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows } = parts;
  const authority = Object.fromEntries(authorityRows.map((item) => [item.authority_flag, item.allowed_now]));
  const boundary = {
    p63200_contract_ready: closeoutRows.every(pass),
    p62800_source_ready_now: sourceRows.every(pass),
    runtime_adapter_contract_ready_now: runtimeRows.every(pass),
    tool_policy_contract_ready_now: toolPolicyRows.every(pass),
    command_allowlist_candidate_ready_now: commandRows.every(pass),
    sandbox_timeout_log_artifact_ready_now: sandboxRows.every(pass),
    runtime_verification_guard_ready_now: runtimeGuardRows.every(pass),
    authority_boundary_carryover_closed_now: authorityRows.every((item) => pass(item) && item.allowed_now === false),
    negative_fixture_contract_visible_now: negativeRows.length === NEGATIVE_FIXTURES.length,
    validation_commands_declared_now: validationCommandRows.length === VALIDATION_COMMANDS.length,
    wiring_complete_now: wiringRows.every(pass),
    ready_for_p63201_handoff: handoffRows.every(pass),
    runtime_adapter_row_count: runtimeRows.length,
    tool_policy_row_count: toolPolicyRows.length,
    command_allowlist_row_count: commandRows.length,
    sandbox_timeout_log_artifact_row_count: sandboxRows.length,
    runtime_guard_row_count: runtimeGuardRows.length,
    ...authority,
  };
  boundary.production_pass_enabled = boundary.production_pass_allowed_now;
  boundary.enterprise_pass_enabled = boundary.enterprise_pass_allowed_now;
  boundary.final_approval_enabled = boundary.codex_final_approval_allowed || boundary.claude_final_approval_allowed || boundary.final_automated_approval_allowed_now;
  return boundary;
}

function buildValidationItems(parts) {
  const { sourceRows, runtimeRows, toolPolicyRows, commandRows, sandboxRows, runtimeGuardRows, authorityRows, negativeRows, validationCommandRows, wiringRows, closeoutRows, handoffRows, boundary } = parts;
  return [
    validationItem("source.p62800", "source_binding", sourceRows.every(pass), "P62800 source must be valid and ready"),
    validationItem("rows.runtime_adapter", "runtime_adapter", runtimeRows.length === RUNTIME_ADAPTER_ITEMS.length && runtimeRows.every(pass), "Runtime adapter rows must pass"),
    validationItem("rows.tool_policy", "tool_policy", toolPolicyRows.length === TOOL_POLICY_ITEMS.length && toolPolicyRows.every(pass), "Tool policy rows must pass"),
    validationItem("rows.command_allowlist", "command_allowlist", commandRows.length === COMMAND_ALLOWLIST_CANDIDATES.length && commandRows.every(pass), "Command allowlist candidate rows must pass"),
    validationItem("rows.sandbox", "sandbox", sandboxRows.length === SANDBOX_TIMEOUT_LOG_ARTIFACT_ROWS.length && sandboxRows.every(pass), "Sandbox/timeout/log/artifact rows must pass"),
    validationItem("rows.runtime_guard", "runtime_guard", runtimeGuardRows.length === RUNTIME_VERIFICATION_GUARDS.length && runtimeGuardRows.every(pass), "Runtime guard rows must pass"),
    validationItem("rows.authority", "authority_boundary", authorityRows.every((item) => pass(item) && item.allowed_now === false), "Authority carryover must remain false"),
    validationItem("rows.negative_fixtures", "negative_fixture", negativeRows.length === NEGATIVE_FIXTURES.length, "Negative fixture rows must be complete"),
    validationItem("rows.validation_commands", "validation", validationCommandRows.length === VALIDATION_COMMANDS.length && validationCommandRows.every((item) => item.mutating === false), "Validation command rows must be non-mutating"),
    validationItem("rows.wiring", "wiring", wiringRows.every(pass), "Package, roadmap, and architecture wiring must pass"),
    validationItem("rows.closeout", "closeout", closeoutRows.every(pass), "P63200 closeout rows must pass"),
    validationItem("rows.handoff", "handoff", handoffRows.every(pass), "P63201 handoff rows must pass"),
    validationItem("boundary.ready", "boundary", boundary.p63200_contract_ready === true, "P63200 contract must be ready"),
    validationItem("boundary.command_execution_false", "authority_boundary", boundary.command_execution_allowed_now === false, "Command execution must remain false"),
    validationItem("boundary.tool_invocation_false", "authority_boundary", boundary.tool_invocation_allowed_now === false, "Tool invocation must remain false"),
    validationItem("boundary.secret_read_false", "authority_boundary", boundary.secret_read_allowed_now === false, "Secret read must remain false"),
    validationItem("boundary.direct_file_write_false", "authority_boundary", boundary.direct_file_write_allowed_now === false, "Direct file write must remain false"),
    validationItem("boundary.production_false", "authority_boundary", boundary.production_pass_enabled === false, "Production PASS must remain false"),
    validationItem("boundary.enterprise_false", "authority_boundary", boundary.enterprise_pass_enabled === false, "Enterprise PASS must remain false"),
    validationItem("boundary.final_approval_false", "authority_boundary", boundary.final_approval_enabled === false, "Codex/Claude/final automated approval must remain false"),
  ];
}

function buildSummary({ boundary, validation }) {
  const status = validation.valid && boundary.ready_for_p63201_handoff
    ? "ready_for_p63201_handoff"
    : validation.valid
      ? "valid_block_p63201_handoff_pending"
      : "blocked_hermes_loop_runtime_tool_governance";
  return {
    hermes_loop_runtime_tool_status: status,
    program_range: PROGRAM_RANGE,
    source_program_range: SOURCE_PROGRAM_RANGE,
    next_program_range: NEXT_PROGRAM_RANGE,
    p62800_source_ready_now: boundary.p62800_source_ready_now,
    p63200_contract_ready: boundary.p63200_contract_ready,
    ready_for_p63201_handoff: boundary.ready_for_p63201_handoff,
    runtime_adapter_row_count: boundary.runtime_adapter_row_count,
    tool_policy_row_count: boundary.tool_policy_row_count,
    command_allowlist_row_count: boundary.command_allowlist_row_count,
    sandbox_timeout_log_artifact_row_count: boundary.sandbox_timeout_log_artifact_row_count,
    runtime_guard_row_count: boundary.runtime_guard_row_count,
    validation_error_count: validation.error_count,
    production_pass_enabled: boundary.production_pass_enabled,
    enterprise_pass_enabled: boundary.enterprise_pass_enabled,
    final_approval_enabled: boundary.final_approval_enabled,
    ...Object.fromEntries([...HERMES_LOOP_AUTHORITY_FALSE_FLAGS, ...EXTRA_FALSE_FLAGS].map((flag) => [flag, boundary[flag]])),
  };
}

async function readSourceModelBudget(inputs, generatedAt, options) {
  const existing = await readJsonSource(inputs.source_model_budget_path);
  if (existing.available) return existing;
  const rebuilt = await buildHermesLoopModelBudgetControl({
    runAt: generatedAt,
    write: false,
    repoRoot: inputs.repo_root,
    sourceSpecPath: inputs.source_spec_path,
    packagePath: inputs.package_path,
    commitRef: options.commitRef,
  });
  return normalizeInlineJsonSource("rebuilt.hermes_loop_model_budget_control", rebuilt);
}

function renderMarkdown(result) {
  return [
    `# Hermes Loop Runtime Tool Governance ${result.program_range}`,
    "",
    `- status: ${result.summary.hermes_loop_runtime_tool_status}`,
    `- p62800_source_ready_now: ${result.summary.p62800_source_ready_now}`,
    `- p63200_contract_ready: ${result.summary.p63200_contract_ready}`,
    `- ready_for_p63201_handoff: ${result.summary.ready_for_p63201_handoff}`,
    `- command_execution_allowed_now: ${result.summary.command_execution_allowed_now}`,
    `- tool_invocation_allowed_now: ${result.summary.tool_invocation_allowed_now}`,
    `- secret_read_allowed_now: ${result.summary.secret_read_allowed_now}`,
    `- direct_file_write_allowed_now: ${result.summary.direct_file_write_allowed_now}`,
    `- production_pass_enabled: ${result.summary.production_pass_enabled}`,
    `- enterprise_pass_enabled: ${result.summary.enterprise_pass_enabled}`,
    "",
    "## Next Allowed Action",
    "",
    result.summary.ready_for_p63201_handoff
      ? "Implement P63201-P63600 Review and Human Gate Integration with review receipts, human gate candidates, and no-final-approval boundary."
      : "Resolve P63200 source, runtime, tool policy, allowlist, sandbox, guard, authority, wiring, or handoff blockers before P63201.",
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
  return row(rowId, "p63200_closeout", label, observed, "artifacts/hermes-loop-runtime-tool-governance/latest/hermes-loop-runtime-tool-governance.json", generatedAt);
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
  const defaults = DEFAULT_HERMES_LOOP_RUNTIME_TOOL_INPUTS;
  return {
    repo_root: repoRoot,
    schema_path: path.resolve(repoRoot, options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(repoRoot, options.packagePath ?? defaults.packagePath),
    source_spec_path: path.resolve(repoRoot, options.sourceSpecPath ?? defaults.sourceSpecPath),
    roadmap_doc_path: path.resolve(repoRoot, options.roadmapDocPath ?? defaults.roadmapDocPath),
    architecture_doc_path: path.resolve(repoRoot, options.architectureDocPath ?? defaults.architectureDocPath),
    source_model_budget_path: path.resolve(repoRoot, options.sourceModelBudgetPath ?? defaults.sourceModelBudgetPath),
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
    else if (arg === "--source-model-budget") args.sourceModelBudgetPath = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source-model-budget PATH]`);
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
