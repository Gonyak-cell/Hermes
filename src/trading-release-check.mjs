import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_TRADING_RELEASE_CHECK_OUT_DIR = "artifacts/trading-release-check/latest";
export const DEFAULT_TRADING_RELEASE_CHECK_INPUTS = {
  packagePath: "package.json",
  packManifestPath: "packs/trading/pack.json",
  capabilityManifestPath: "packs/trading/capabilities/research-backtest-paper.json",
  tradingPhaseLedgerPath: "docs/trading-pack-phase-ledger.md",
  platformOpsLedgerPath: "docs/platform-operations-stability-phase-ledger.md",
  schemaPath: "schemas/trading/trading-release-check.schema.json",
};

const SCHEMA_VERSION = "trading-release-check.v1";
const CAPABILITY_ID = "trading.release_check";
const PHASE_SLOT = "P361";
const PREVIOUS_PHASE_SLOT = "P360";
const NEXT_PHASE_SLOT = "P362";

const RELEASE_CHECK_COMMANDS = [
  commandSpec("contracts_golden_fixtures", "contract_validation", "contracts:golden-fixtures", "Golden fixture contract regression check."),
  commandSpec("contracts_validate", "contract_validation", "contracts:validate", "Contract validation suite check."),
  commandSpec("release_freeze", "release_freeze", "release:freeze", "Release freeze validation check."),
  commandSpec("trading_validate", "trading_validation", "trading:validate", "Trading pack schema, fixture, and safety validation."),
  commandSpec("trading_safety_check", "trading_no_write", "trading:safety-check", "Trading no-write safety boundary check."),
  commandSpec("trading_golden_fixtures", "trading_validation", "trading:golden-fixtures", "Trading golden fixture regression check."),
  commandSpec("trading_dashboard", "trading_no_write", "trading:dashboard", "Trading read-only dashboard/API stub check."),
  commandSpec("trading_strategy_taxonomy", "trading_validation", "trading:strategy-taxonomy", "Strategy taxonomy check."),
  commandSpec("trading_market_data_report", "trading_validation", "trading:market-data-report", "Market data report check."),
  commandSpec("trading_feature_report", "trading_validation", "trading:feature-report", "Feature report check."),
  commandSpec("trading_signal_report", "trading_validation", "trading:signal-report", "Signal report check."),
  commandSpec("trading_model_train_report", "trading_validation", "trading:model-train-report", "Model train report check."),
  commandSpec("trading_model_eval_report", "trading_validation", "trading:model-eval-report", "Model eval report check."),
  commandSpec("trading_backtest_report", "trading_validation", "trading:backtest-report", "Backtest report check."),
  commandSpec("trading_risk_check", "trading_no_write", "trading:risk-check", "Risk gate no-write check."),
  commandSpec("trading_paper_report", "trading_no_write", "trading:paper-report", "Paper trading report check."),
  commandSpec("trading_shadow_report", "trading_no_write", "trading:shadow-report", "Shadow-live read-only report check."),
  commandSpec("trading_execution_report", "trading_no_write", "trading:execution-report", "Execution boundary no-write check."),
  commandSpec("trading_limited_live_report", "trading_no_write", "trading:limited-live-report", "Limited-live disabled governance check."),
  commandSpec("trading_full_auto_report", "trading_no_write", "trading:full-auto-report", "Full-auto disabled governance check."),
];

export async function runTradingReleaseCheck(options = {}) {
  const result = await buildTradingReleaseCheck(options);
  if (options.write !== false) await writeTradingReleaseCheck(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading release check failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingReleaseCheck(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_RELEASE_CHECK_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const packManifest = await readJsonSource(inputs.pack_manifest_path);
  const capabilityManifest = await readJsonSource(inputs.capability_manifest_path);
  const tradingPhaseLedger = await readTextSource(inputs.trading_phase_ledger_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const cwd = path.resolve(options.cwd ?? path.dirname(inputs.package_path));
  const sourceRows = buildSourceRows({
    packageJson,
    packManifest,
    capabilityManifest,
    tradingPhaseLedger,
    platformOpsLedger,
  });
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
    trading_release_check_id: `trading-release-check.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    release_check_anchor: {
      schema_version: "trading-release-check-anchor.v1",
      phase_slot: PHASE_SLOT,
      previous_phase_slot: PREVIOUS_PHASE_SLOT,
      next_phase_slot: NEXT_PHASE_SLOT,
      command_count: RELEASE_CHECK_COMMANDS.length,
      command_plan_hash: hashValue(RELEASE_CHECK_COMMANDS.map((spec) => ({
        row_key: spec.row_key,
        command_group: spec.command_group,
        package_script_name: spec.package_script_name,
        npm_args: spec.npm_args,
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
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_release_check") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceRows, commandRows, gateRows, boundary, validation: result.validation });
  result.summary.trading_release_check_id = result.trading_release_check_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingReleaseCheck(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "trading-release-check.json"), serializable);
  await writeJson(path.join(outDir, "release-check-command-rows.json"), collectionEnvelope("trading-release-check-command-rows.v1", "release_check_command_rows", result.release_check_command_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-gate-rows.json"), collectionEnvelope("trading-release-check-gate-rows.v1", "release_check_gate_rows", result.release_check_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-boundary.json"), result.release_check_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-release-check-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingReleaseCheckCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingReleaseCheck(args);
    console.log(`Trading release check ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_release_check_status}`);
    console.log(`Commands: ${result.summary.passed_command_count}/${result.summary.command_count}`);
    console.log(`Gates: ${result.summary.ready_release_check_gate_count}/${result.summary.release_check_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function commandSpec(rowKey, commandGroup, packageScriptName, description) {
  return {
    schema_version: "trading-release-check-command-spec.v1",
    row_key: rowKey,
    command_group: commandGroup,
    package_script_name: packageScriptName,
    check_command: `npm run ${packageScriptName} -- --check`,
    npm_args: ["run", packageScriptName, "--", "--check"],
    description,
  };
}

function buildSourceRows({ packageJson, packManifest, capabilityManifest, tradingPhaseLedger, platformOpsLedger }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const packSchemas = packManifest.data?.schemas ?? [];
  const workflows = packManifest.data?.workflows ?? [];
  const goldenCases = packManifest.data?.golden_cases ?? [];
  const entrypoints = capabilityManifest.data?.entrypoints ?? [];
  const capabilityGoldenCases = capabilityManifest.data?.golden_cases ?? [];
  const rows = [
    sourceRow("package_json_available", "package.json is readable.", packageJson.available),
    sourceRow("package_trading_release_check_registered", "package.json registers trading:release-check.", typeof scripts["trading:release-check"] === "string" && scripts["trading:release-check"].length > 0),
    sourceRow("package_validation_chain_registered", "Validation chain includes trading:release-check -- --check.", validateScript.includes("npm run trading:release-check -- --check")),
    sourceRow("pack_manifest_available", "Trading pack manifest is readable.", packManifest.available && packManifest.data?.pack_id === "trading"),
    sourceRow("pack_schema_registered", "Trading pack manifest registers the release-check schema.", packSchemas.includes("schemas/trading/trading-release-check.schema.json")),
    sourceRow("pack_workflow_registered", "Trading pack manifest registers the release-check workflow.", workflows.includes("workflow.trading.release_check.v1")),
    sourceRow("pack_golden_case_registered", "Trading pack manifest registers the P361 release-check golden case.", goldenCases.includes("golden.trading.release_check.p361")),
    sourceRow("capability_manifest_available", "Trading capability manifest is readable.", capabilityManifest.available && capabilityManifest.data?.domain_pack === "trading"),
    sourceRow("capability_entrypoint_registered", "Trading capability manifest registers trading:release-check.", entrypoints.some((entrypoint) => entrypoint.name === "trading:release-check")),
    sourceRow("capability_golden_case_registered", "Trading capability manifest registers the P361 release-check golden case.", capabilityGoldenCases.some((fixture) => fixture.case_id === "golden.trading.release_check.p361")),
    sourceRow("trading_phase_ledger_p340_baseline", "Trading ledger records the P340 completion baseline.", tradingPhaseLedger.available && tradingPhaseLedger.text.includes("P338-P340") && tradingPhaseLedger.text.includes("Trading Pack completion baseline")),
    sourceRow("platform_ops_ledger_p361_declared", "Platform operations ledger declares P361 trading release-check acceptance.", platformOpsLedger.available && platformOpsLedger.text.includes("P361: `trading:release-check`")),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "source_row_hash"));
}

function sourceRow(rowKey, description, passed) {
  return {
    schema_version: "trading-release-check-source-row.v1",
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
  for (let index = 0; index < RELEASE_CHECK_COMMANDS.length; index += 1) {
    const spec = RELEASE_CHECK_COMMANDS[index];
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
      schema_version: "trading-release-check-command-row.v1",
      release_check_command_row_id: `trading-release-check.command.${spec.row_key}`,
      phase_slot: PHASE_SLOT,
      row_key: spec.row_key,
      command_group: spec.command_group,
      package_script_name: spec.package_script_name,
      package_script_registered: packageScriptRegistered,
      check_command: spec.check_command,
      npm_args: spec.npm_args,
      description: spec.description,
      release_check_command_status: status,
      executed_by_release_check: executed,
      check_mode_used: spec.npm_args.includes("--check"),
      mutation_allowed_by_release_check: false,
      artifact_write_allowed_by_child_command: false,
      protected_action_allowed_by_release_check: false,
      trading_order_submission_allowed_by_release_check: false,
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
    schema_version: "trading-release-check-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    control_plane_only: true,
    command_execution_performed: executedCount > 0,
    release_check_execution_performed: executedCount > 0,
    child_commands_check_mode_only: commandRows.length > 0 && commandRows.every((row) => row.check_mode_used),
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
    human_review_note: "Operator must review the release-check summary before relying on release-facing or trading-facing outputs.",
  };
}

function buildGateRows({ sourceRows, commandRows, boundary }) {
  const rows = [
    gateRow("source_rows_ready", "P361 release-check sources are registered and ledger-backed.", sourceRows.every((row) => row.source_status === "ready")),
    gateRow("contract_release_stack_passed", "Contract validation and release freeze child checks pass.", groupRows(commandRows, ["contract_validation", "release_freeze"]).every((row) => row.release_check_command_status === "passed")),
    gateRow("trading_validation_stack_passed", "Trading validation child checks pass.", groupRows(commandRows, ["trading_validation"]).every((row) => row.release_check_command_status === "passed")),
    gateRow("trading_no_write_stack_passed", "Trading no-write child checks pass.", groupRows(commandRows, ["trading_no_write"]).every((row) => row.release_check_command_status === "passed")),
    gateRow("all_child_checks_passed", "All P361 child checks pass.", commandRows.length >= 20 && commandRows.every((row) => row.release_check_command_status === "passed")),
    gateRow("check_mode_only", "All child commands use --check and disallow artifact writes.", commandRows.every((row) => row.check_mode_used && row.artifact_write_allowed_by_child_command === false)),
    gateRow("no_trading_mutation", "Live trading, full-auto, order submission, broker writes, and exchange writes remain disabled.", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed),
    gateRow("no_protected_or_release_mutation", "Release check performs no dependency install, package/lockfile mutation, protected action, release publish, or git operation.", !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.protected_action_executed && !boundary.release_published && !boundary.git_operation_performed),
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
    schema_version: "trading-release-check-gate-row.v1",
    release_check_gate_row_id: `trading-release-check.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    protected_action_executed_by_release_check: false,
    trading_order_submission_performed_by_release_check: false,
    broker_write_performed_by_release_check: false,
    human_review_required: true,
  };
}

function buildValidationItems({ sourceRows, commandRows, gateRows, boundary }) {
  return [
    validationItem("source_rows", "source_rows_ready", sourceRows.length >= 12 && sourceRows.every((row) => row.source_status === "ready"), "Release-check source rows are ready."),
    validationItem("release_check_command_rows", "child_checks_passed", commandRows.length >= 20 && commandRows.every((row) => row.release_check_command_status === "passed" && row.executed_by_release_check && row.check_mode_used), "All child release-check commands pass in --check mode."),
    validationItem("release_check_gate_rows", "release_check_gates_ready", gateRows.length >= 9 && gateRows.every((row) => row.gate_status === "ready"), "Release-check gates are ready."),
    validationItem("boundary.command_execution", "release_check_executed", boundary.command_execution_performed && boundary.release_check_execution_performed, "Trading release-check executed its child command stack."),
    validationItem("boundary.child_no_write", "child_no_write_enforced", boundary.child_commands_check_mode_only && !boundary.child_artifact_write_allowed && !boundary.artifact_regeneration_performed, "Child commands run in check mode without artifact writes or regeneration."),
    validationItem("boundary.no_mutation", "no_protected_mutation", !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.protected_action_executed && !boundary.release_published && !boundary.git_operation_performed, "Release check performs no install, package, lockfile, protected, release, or git mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
    validationItem("boundary.review", "human_review_required", boundary.human_review_required && Boolean(boundary.human_review_note), "Human review note is present."),
  ];
}

function buildSummary({ sourceRows, commandRows, gateRows, boundary, validation }) {
  const passedCommands = commandRows.filter((row) => row.release_check_command_status === "passed");
  return {
    trading_release_check_status: validation.valid ? "complete" : "blocked",
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
    contract_release_command_count: groupRows(commandRows, ["contract_validation", "release_freeze"]).length,
    trading_command_count: groupRows(commandRows, ["trading_validation", "trading_no_write"]).length,
    release_check_gate_count: gateRows.length,
    ready_release_check_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    command_execution_performed: boundary.command_execution_performed,
    release_check_execution_performed: boundary.release_check_execution_performed,
    child_commands_check_mode_only: boundary.child_commands_check_mode_only,
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
    "# Trading Release Check",
    "",
    `Status: ${result.summary.trading_release_check_status}`,
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
  const parsed = { outDir: DEFAULT_TRADING_RELEASE_CHECK_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--pack-manifest") parsed.packManifestPath = argv[++index];
    else if (arg === "--capability-manifest") parsed.capabilityManifestPath = argv[++index];
    else if (arg === "--trading-phase-ledger") parsed.tradingPhaseLedgerPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-release-check.mjs [options]

Options:
  --out-dir <folder>            Output directory. Default: ${DEFAULT_TRADING_RELEASE_CHECK_OUT_DIR}
  --run-at <iso>                Deterministic generated_at timestamp.
  --package <path>              package.json path.
  --pack-manifest <path>        Trading pack manifest path.
  --capability-manifest <path>  Trading capability manifest path.
  --trading-phase-ledger <path> Trading P001-P340 ledger path.
  --platform-ops-ledger <path>  P341-P500 platform operations ledger path.
  --schema <path>               Output schema path.
  --cwd <path>                  Working directory for child npm commands.
  --check                       Execute child checks, validate only, do not write release-check artifacts.
  -h, --help                    Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_RELEASE_CHECK_INPUTS.packagePath),
    pack_manifest_path: path.resolve(options.packManifestPath ?? DEFAULT_TRADING_RELEASE_CHECK_INPUTS.packManifestPath),
    capability_manifest_path: path.resolve(options.capabilityManifestPath ?? DEFAULT_TRADING_RELEASE_CHECK_INPUTS.capabilityManifestPath),
    trading_phase_ledger_path: path.resolve(options.tradingPhaseLedgerPath ?? DEFAULT_TRADING_RELEASE_CHECK_INPUTS.tradingPhaseLedgerPath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_RELEASE_CHECK_INPUTS.platformOpsLedgerPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_RELEASE_CHECK_INPUTS.schemaPath),
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
    validation_item_id: `trading-release-check.${slugify(itemPath)}.${checkId}`,
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
