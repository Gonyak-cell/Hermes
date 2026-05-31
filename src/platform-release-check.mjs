import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_PLATFORM_RELEASE_CHECK_OUT_DIR = "artifacts/platform-release-check/latest";
export const DEFAULT_PLATFORM_RELEASE_CHECK_INPUTS = {
  packagePath: "package.json",
  platformOpsLedgerPath: "docs/platform-operations-stability-phase-ledger.md",
  schemaPath: "schemas/platform-release-check.schema.json",
};

const SCHEMA_VERSION = "platform-release-check.v1";
const CAPABILITY_ID = "platform.release_check";
const PHASE_SLOT = "P363";
const PREVIOUS_PHASE_SLOT = "P362";
const NEXT_PHASE_SLOT = "P364";

const PLATFORM_RELEASE_CHECK_COMMANDS = [
  commandSpec("platform_ops_check", "platform_ops", "platform:ops-check", "check", ["run", "platform:ops-check", "--", "--check"], "Platform ops-check bridge."),
  commandSpec("trading_release_check", "trading_release", "trading:release-check", "check", ["run", "trading:release-check", "--", "--check"], "Trading release-check bridge."),
  commandSpec("repo_validate", "repo_validation", "validate", "validate", ["run", "validate"], "Repository validation chain."),
  commandSpec("repo_test", "repo_test", "test", "test", ["test"], "Repository test suite."),
  commandSpec("contracts_validate", "contract_release", "contracts:validate", "check", ["run", "contracts:validate", "--", "--check"], "Contract validation suite check."),
  commandSpec("release_freeze", "contract_release", "release:freeze", "check", ["run", "release:freeze", "--", "--check"], "Release freeze validation check."),
];

export async function runPlatformReleaseCheck(options = {}) {
  const result = await buildPlatformReleaseCheck(options);
  if (options.write !== false) await writePlatformReleaseCheck(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform release check failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReleaseCheck(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RELEASE_CHECK_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const cwd = path.resolve(options.cwd ?? path.dirname(inputs.package_path));
  const sourceRows = buildSourceRows({ packageJson, platformOpsLedger });
  const commandRows = await buildCommandRows({
    packageJson,
    execute: options.execute !== false,
    runner: options.runner ?? spawnNpmCommand,
    cwd,
  });
  const boundary = buildBoundary({ generatedAt, commandRows, writeRequested: options.write !== false });
  const gateRows = buildGateRows({ sourceRows, commandRows, boundary });
  const validationItems = buildValidationItems({ sourceRows, commandRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ sourceRows, commandRows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_release_check_id: `platform-release-check.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    release_check_anchor: {
      schema_version: "platform-release-check-anchor.v1",
      phase_slot: PHASE_SLOT,
      previous_phase_slot: PREVIOUS_PHASE_SLOT,
      next_phase_slot: NEXT_PHASE_SLOT,
      command_count: PLATFORM_RELEASE_CHECK_COMMANDS.length,
      command_plan_hash: hashValue(PLATFORM_RELEASE_CHECK_COMMANDS.map((spec) => ({
        row_key: spec.row_key,
        command_group: spec.command_group,
        package_script_name: spec.package_script_name,
        npm_args: spec.npm_args,
        guard_mode: spec.guard_mode,
      }))),
    },
    source_rows: sourceRows,
    release_check_command_rows: commandRows,
    release_check_gate_rows: gateRows,
    release_check_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_release_check") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceRows, commandRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_release_check_id = result.platform_release_check_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReleaseCheck(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "platform-release-check.json"), serializable);
  await writeJson(path.join(outDir, "release-check-command-rows.json"), collectionEnvelope("platform-release-check-command-rows.v1", "release_check_command_rows", result.release_check_command_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-gate-rows.json"), collectionEnvelope("platform-release-check-gate-rows.v1", "release_check_gate_rows", result.release_check_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-boundary.json"), result.release_check_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-release-check-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReleaseCheckCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReleaseCheck(args);
    console.log(`Platform release check ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_release_check_status}`);
    console.log(`Commands: ${result.summary.passed_command_count}/${result.summary.command_count}`);
    console.log(`Gates: ${result.summary.ready_release_check_gate_count}/${result.summary.release_check_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function commandSpec(rowKey, commandGroup, packageScriptName, guardMode, npmArgs, description) {
  return {
    schema_version: "platform-release-check-command-spec.v1",
    row_key: rowKey,
    command_group: commandGroup,
    package_script_name: packageScriptName,
    guard_mode: guardMode,
    check_command: npmArgs.includes("--check") ? `npm run ${packageScriptName} -- --check` : packageScriptName === "test" ? "npm test" : `npm run ${packageScriptName}`,
    npm_args: npmArgs,
    description,
  };
}

function buildSourceRows({ packageJson, platformOpsLedger }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const rows = [
    sourceRow("package_json_available", "package.json is readable.", packageJson.available),
    sourceRow("package_platform_release_check_registered", "package.json registers platform:release-check.", typeof scripts["platform:release-check"] === "string" && scripts["platform:release-check"].length > 0),
    sourceRow("package_platform_ops_check_registered", "package.json registers platform:ops-check.", typeof scripts["platform:ops-check"] === "string" && scripts["platform:ops-check"].length > 0),
    sourceRow("package_trading_release_check_registered", "package.json registers trading:release-check.", typeof scripts["trading:release-check"] === "string" && scripts["trading:release-check"].length > 0),
    sourceRow("package_validate_registered", "package.json registers validate.", typeof scripts.validate === "string" && scripts.validate.length > 0),
    sourceRow("package_test_registered", "package.json registers test.", typeof scripts.test === "string" && scripts.test.length > 0),
    sourceRow("package_contracts_validate_registered", "package.json registers contracts:validate.", typeof scripts["contracts:validate"] === "string" && scripts["contracts:validate"].length > 0),
    sourceRow("package_release_freeze_registered", "package.json registers release:freeze.", typeof scripts["release:freeze"] === "string" && scripts["release:freeze"].length > 0),
    sourceRow("package_validation_chain_non_recursive", "Validation chain does not call platform:release-check recursively.", !validateScript.includes("platform:release-check")),
    sourceRow("platform_ops_ledger_p363_declared", "Platform operations ledger declares P363 platform release-check acceptance.", platformOpsLedger.available && platformOpsLedger.text.includes("P363: `platform:release-check`")),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "source_row_hash"));
}

function sourceRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-check-source-row.v1",
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    source_status: passed ? "ready" : "blocked",
    human_review_required: true,
  };
}

async function buildCommandRows({ packageJson, execute, runner, cwd }) {
  const scripts = packageJson.data?.scripts ?? {};
  const rows = [];
  for (let index = 0; index < PLATFORM_RELEASE_CHECK_COMMANDS.length; index += 1) {
    const spec = PLATFORM_RELEASE_CHECK_COMMANDS[index];
    const packageScriptRegistered = typeof scripts[spec.package_script_name] === "string" && scripts[spec.package_script_name].length > 0;
    let execution = {
      exit_code: null,
      signal: null,
      stdout: "",
      stderr: "",
      duration_ms: 0,
      error_message: null,
    };
    let status = "blocked";
    let executed = false;
    if (packageScriptRegistered && execute) {
      executed = true;
      execution = normalizeExecutionResult(await runner(spec, { cwd }));
      status = execution.exit_code === 0 ? "passed" : "failed";
    } else if (packageScriptRegistered) {
      status = "planned";
    }
    const row = {
      schema_version: "platform-release-check-command-row.v1",
      release_check_command_row_id: `platform-release-check.command.${spec.row_key}`,
      phase_slot: PHASE_SLOT,
      row_key: spec.row_key,
      command_group: spec.command_group,
      package_script_name: spec.package_script_name,
      package_script_registered: packageScriptRegistered,
      guard_mode: spec.guard_mode,
      check_command: spec.check_command,
      npm_args: spec.npm_args,
      description: spec.description,
      release_check_command_status: status,
      executed_by_release_check: executed,
      check_mode_used: spec.guard_mode === "check",
      validation_mode_used: spec.guard_mode === "validate",
      test_mode_used: spec.guard_mode === "test",
      child_command_guarded: true,
      mutation_allowed_by_release_check: false,
      artifact_write_allowed_by_child_command: false,
      protected_action_allowed_by_release_check: false,
      release_publication_allowed_by_release_check: false,
      git_operation_allowed_by_release_check: false,
      trading_order_submission_allowed_by_release_check: false,
      broker_write_allowed_by_release_check: false,
      exchange_write_allowed_by_release_check: false,
      exit_code: execution.exit_code,
      signal: execution.signal,
      duration_ms: execution.duration_ms,
      stdout_hash: hashValue(execution.stdout ?? ""),
      stderr_hash: hashValue(execution.stderr ?? ""),
      stdout_tail: tailString(execution.stdout ?? ""),
      stderr_tail: tailString(execution.stderr ?? ""),
      error_message: execution.error_message,
      human_review_required: true,
    };
    rows.push(withOrdinalAndHash(row, index, "release_check_command_hash"));
  }
  return rows;
}

async function spawnNpmCommand(spec, { cwd }) {
  const startedAt = Date.now();
  return await new Promise((resolve) => {
    const child = spawn("npm", spec.npm_args, {
      cwd,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      resolve({
        exitCode: 1,
        signal: null,
        stdout,
        stderr: `${stderr}${error.message}\n`,
        durationMs: Date.now() - startedAt,
        errorMessage: error.message,
      });
    });
    child.on("close", (code, signal) => {
      resolve({
        exitCode: code ?? 1,
        signal,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
        errorMessage: null,
      });
    });
  });
}

function normalizeExecutionResult(result) {
  return {
    exit_code: Number(result.exit_code ?? result.exitCode ?? result.code ?? 1),
    signal: result.signal ?? null,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    duration_ms: Number(result.duration_ms ?? result.durationMs ?? 0),
    error_message: result.error_message ?? result.errorMessage ?? null,
  };
}

function buildBoundary({ generatedAt, commandRows, writeRequested }) {
  const executedCount = commandRows.filter((row) => row.executed_by_release_check).length;
  return {
    schema_version: "platform-release-check-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    control_plane_only: true,
    command_execution_performed: executedCount > 0,
    package_command_execution_performed: executedCount > 0,
    release_check_execution_performed: executedCount > 0,
    child_commands_guarded: commandRows.length > 0 && commandRows.every((row) => row.child_command_guarded && !row.artifact_write_allowed_by_child_command),
    release_check_artifact_write_requested: writeRequested,
    child_artifact_write_allowed: false,
    dependency_install_performed: false,
    package_mutation_performed: false,
    lockfile_mutation_performed: false,
    artifact_regeneration_performed: false,
    protected_action_executed: false,
    approval_applied: false,
    release_published: false,
    git_operation_performed: false,
    external_service_called_by_release_check: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    automatic_order_submission_allowed: false,
    live_order_submission_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    desktop_source_of_truth: false,
    human_review_required: true,
    human_review_note: "Operator must review the platform release-check summary before relying on release-facing or trading-facing outputs.",
  };
}

function buildGateRows({ sourceRows, commandRows, boundary }) {
  const rows = [
    gateRow("source_rows_ready", "P363 release-check sources are registered and ledger-backed.", sourceRows.every((row) => row.source_status === "ready")),
    gateRow("platform_ops_stack_passed", "Platform ops-check child command passes.", groupRows(commandRows, ["platform_ops"]).every((row) => row.release_check_command_status === "passed")),
    gateRow("trading_release_stack_passed", "Trading release-check child command passes.", groupRows(commandRows, ["trading_release"]).every((row) => row.release_check_command_status === "passed")),
    gateRow("repo_validation_and_tests_passed", "Repository validate and test child commands pass.", groupRows(commandRows, ["repo_validation", "repo_test"]).every((row) => row.release_check_command_status === "passed")),
    gateRow("contract_release_stack_passed", "Contract validation and release freeze child commands pass.", groupRows(commandRows, ["contract_release"]).every((row) => row.release_check_command_status === "passed")),
    gateRow("all_child_checks_passed", "All P363 child commands pass.", commandRows.length >= 6 && commandRows.every((row) => row.release_check_command_status === "passed")),
    gateRow("validate_chain_non_recursive", "npm run validate does not recursively call platform:release-check.", sourceRows.some((row) => row.row_key === "package_validation_chain_non_recursive" && row.source_status === "ready")),
    gateRow("child_commands_guarded", "Child commands are guarded from artifact writes, protected actions, release publication, git, and trading writes.", boundary.child_commands_guarded && !boundary.child_artifact_write_allowed),
    gateRow("no_protected_or_release_mutation", "Release check performs no dependency install, package/lockfile mutation, protected action, release publish, or git operation.", !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.protected_action_executed && !boundary.release_published && !boundary.git_operation_performed),
    gateRow("trading_disabled_boundary", "Live trading, full-auto, order submission, broker writes, and exchange writes remain disabled.", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed),
    gateRow("human_review_note_present", "Human review note is present for release-facing and trading-facing use.", Boolean(boundary.human_review_note)),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "release_check_gate_hash"));
}

function groupRows(commandRows, groups) {
  const groupSet = new Set(groups);
  return commandRows.filter((row) => groupSet.has(row.command_group));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-check-gate-row.v1",
    release_check_gate_row_id: `platform-release-check.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    protected_action_executed_by_release_check: false,
    release_published_by_release_check: false,
    git_operation_performed_by_release_check: false,
    trading_order_submission_performed_by_release_check: false,
    broker_write_performed_by_release_check: false,
    exchange_write_performed_by_release_check: false,
    human_review_required: true,
  };
}

function buildValidationItems({ sourceRows, commandRows, gateRows, boundary }) {
  return [
    validationItem("source_rows", "source_rows_ready", sourceRows.length >= 10 && sourceRows.every((row) => row.source_status === "ready"), "Platform release-check source rows are ready."),
    validationItem("release_check_command_rows", "child_commands_passed", commandRows.length >= 6 && commandRows.every((row) => row.release_check_command_status === "passed" && row.executed_by_release_check && row.child_command_guarded), "All platform release-check child commands pass."),
    validationItem("release_check_gate_rows", "release_check_gates_ready", gateRows.length >= 11 && gateRows.every((row) => row.gate_status === "ready"), "Platform release-check gates are ready."),
    validationItem("boundary.command_execution", "release_check_executed", boundary.command_execution_performed && boundary.package_command_execution_performed && boundary.release_check_execution_performed, "Platform release-check executed its child command stack."),
    validationItem("boundary.child_commands_guarded", "child_commands_guarded", boundary.child_commands_guarded && !boundary.child_artifact_write_allowed, "Child commands remain guarded from artifact writes."),
    validationItem("boundary.no_mutation", "no_protected_mutation", !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.protected_action_executed && !boundary.release_published && !boundary.git_operation_performed, "Release check performs no install, package, lockfile, protected, release, or git mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
    validationItem("boundary.review", "human_review_required", boundary.human_review_required && Boolean(boundary.human_review_note), "Human review note is present."),
  ];
}

function buildSummary({ sourceRows, commandRows, gateRows, boundary, validation }) {
  const passedCommands = commandRows.filter((row) => row.release_check_command_status === "passed");
  return {
    platform_release_check_status: validation.valid ? "complete" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_row_count: sourceRows.length,
    ready_source_row_count: sourceRows.filter((row) => row.source_status === "ready").length,
    command_count: commandRows.length,
    passed_command_count: passedCommands.length,
    failed_command_count: commandRows.filter((row) => row.release_check_command_status === "failed").length,
    blocked_command_count: commandRows.filter((row) => row.release_check_command_status === "blocked").length,
    check_mode_command_count: commandRows.filter((row) => row.check_mode_used).length,
    validation_mode_command_count: commandRows.filter((row) => row.validation_mode_used).length,
    test_mode_command_count: commandRows.filter((row) => row.test_mode_used).length,
    platform_command_count: groupRows(commandRows, ["platform_ops"]).length,
    trading_command_count: groupRows(commandRows, ["trading_release"]).length,
    repo_command_count: groupRows(commandRows, ["repo_validation", "repo_test"]).length,
    contract_release_command_count: groupRows(commandRows, ["contract_release"]).length,
    release_check_gate_count: gateRows.length,
    ready_release_check_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
    release_check_execution_performed: boundary.release_check_execution_performed,
    child_commands_guarded: boundary.child_commands_guarded,
    release_check_artifact_write_requested: boundary.release_check_artifact_write_requested,
    child_artifact_write_allowed: boundary.child_artifact_write_allowed,
    dependency_install_performed: boundary.dependency_install_performed,
    package_mutation_performed: boundary.package_mutation_performed,
    lockfile_mutation_performed: boundary.lockfile_mutation_performed,
    artifact_regeneration_performed: boundary.artifact_regeneration_performed,
    protected_action_executed: boundary.protected_action_executed,
    release_published: boundary.release_published,
    git_operation_performed: boundary.git_operation_performed,
    trading_live_enabled: boundary.trading_live_enabled,
    trading_full_auto_enabled: boundary.trading_full_auto_enabled,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    automatic_order_submission_allowed: boundary.automatic_order_submission_allowed,
    live_order_submission_allowed: boundary.live_order_submission_allowed,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    desktop_source_of_truth: boundary.desktop_source_of_truth,
    human_review_required: boundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Release Check",
    "",
    `Status: ${result.summary.platform_release_check_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Commands: ${result.summary.passed_command_count}/${result.summary.command_count}`,
    `Gates: ${result.summary.ready_release_check_gate_count}/${result.summary.release_check_gate_count}`,
    `Trading live enabled: ${result.summary.trading_live_enabled}`,
    `Full-auto enabled: ${result.summary.trading_full_auto_enabled}`,
    "",
    "## Command Rows",
    "",
    ...result.release_check_command_rows.map((row) => `- ${row.package_script_name}: ${row.release_check_command_status}`),
    "",
    "## Gate Rows",
    "",
    ...result.release_check_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RELEASE_CHECK_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--cwd") parsed.cwd = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-release-check.mjs [options]

Options:
  --out-dir <folder>            Output directory. Default: ${DEFAULT_PLATFORM_RELEASE_CHECK_OUT_DIR}
  --run-at <iso>                Deterministic generated_at timestamp.
  --package <path>              package.json path.
  --platform-ops-ledger <path>  P341-P500 platform operations ledger path.
  --schema <path>               Output schema path.
  --cwd <path>                  Working directory for child npm commands.
  --check                       Execute child checks, validate only, do not write release-check artifacts.
  -h, --help                    Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_INPUTS.platformOpsLedgerPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_INPUTS.schemaPath),
  };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    count: rows.length,
    [key]: rows,
  };
}

async function readJsonSource(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      data: JSON.parse(raw),
      content_hash: sha256(raw),
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      data: null,
      content_hash: null,
      error: error.message,
    };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      text,
      content_hash: sha256(text),
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      text: "",
      content_hash: null,
      error: error.message,
    };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `platform-release-check.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return { valid: errors.length === 0, errors };
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function withOrdinalAndHash(row, index, hashKey) {
  const rowWithOrdinal = { ...row, ordinal: index + 1 };
  return { ...rowWithOrdinal, [hashKey]: hashValue(rowWithOrdinal) };
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function dateStamp(isoString) {
  return isoString.slice(0, 10).replace(/-/g, "");
}

function tailString(value, maxLength = 1200) {
  const stringValue = String(value ?? "");
  if (stringValue.length <= maxLength) return stringValue;
  return stringValue.slice(-maxLength);
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
