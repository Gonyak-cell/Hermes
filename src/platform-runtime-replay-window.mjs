import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_RUNTIME_DRIFT_INPUTS,
  buildPlatformRuntimeDriftCheck,
} from "./platform-runtime-drift.mjs";

export const DEFAULT_PLATFORM_RUNTIME_REPLAY_WINDOW_OUT_DIR = "artifacts/platform-runtime-replay-window/latest";
export const DEFAULT_PLATFORM_RUNTIME_REPLAY_WINDOW_INPUTS = {
  ...DEFAULT_PLATFORM_RUNTIME_DRIFT_INPUTS,
  driftSchemaPath: DEFAULT_PLATFORM_RUNTIME_DRIFT_INPUTS.schemaPath,
  schemaPath: "schemas/platform-runtime-replay-window.schema.json",
};

const SCHEMA_VERSION = "platform-runtime-replay-window.v1";
const CAPABILITY_ID = "platform.runtime_replay_window";
const PHASE_SLOT = "P343";
const PREVIOUS_PHASE_SLOT = "P342";
const NEXT_PHASE_SLOT = "P344";
const BASELINE_PHASE_SLOT = "P341";
const DRIFT_PHASE_SLOT = "P342";
const P340_BUNDLE_SHA256 = "1a1563a47e2f6704e0f25be56a4c74069863e97c6312e0b0348088ccd231051d";
const P340_HISTORY_BASELINE_COMMIT = "0abc97b";
const MAC_REPLAY_STABILIZATION_COMMIT = "8e4323d";

export async function runPlatformRuntimeReplayWindow(options = {}) {
  const result = await buildPlatformRuntimeReplayWindow(options);
  if (options.write !== false) await writePlatformRuntimeReplayWindow(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform runtime replay window failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformRuntimeReplayWindow(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RUNTIME_REPLAY_WINDOW_OUT_DIR);
  const inputs = normalizeInputs(options);
  const drift = await buildPlatformRuntimeDriftCheck({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    packageLockPath: inputs.package_lock_path,
    nvmrcPath: inputs.nvmrc_path,
    nodeVersionPath: inputs.node_version_path,
    npmrcPath: inputs.npmrc_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    tradingPhaseLedgerPath: inputs.trading_phase_ledger_path,
    baselineSchemaPath: inputs.baseline_schema_path,
    schemaPath: inputs.drift_schema_path,
  });
  const replayAnchor = buildReplayAnchor(drift);
  const replayWindows = buildReplayWindows();
  const replayCommandRows = buildReplayCommandRows(replayWindows);
  const operatorHandoffRows = buildOperatorHandoffRows(replayWindows);
  const replayBoundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    drift,
    replayWindows,
    replayCommandRows,
    operatorHandoffRows,
    replayBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    drift,
    replayWindows,
    replayCommandRows,
    operatorHandoffRows,
    replayBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_runtime_replay_window_id: `platform-runtime-replay-window.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    replay_anchor: replayAnchor,
    replay_windows: replayWindows,
    replay_command_rows: replayCommandRows,
    operator_handoff_rows: operatorHandoffRows,
    runtime_replay_boundary: replayBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_runtime_replay_window") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    drift,
    replayWindows,
    replayCommandRows,
    operatorHandoffRows,
    replayBoundary,
    validation: result.validation,
  });
  result.summary.platform_runtime_replay_window_id = result.platform_runtime_replay_window_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformRuntimeReplayWindow(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "platform-runtime-replay-window.json"), serializable);
  await writeJson(path.join(outDir, "replay-windows.json"), collectionEnvelope("platform-runtime-replay-windows.v1", "replay_windows", result.replay_windows, result.generated_at));
  await writeJson(path.join(outDir, "replay-command-rows.json"), collectionEnvelope("platform-runtime-replay-command-rows.v1", "replay_command_rows", result.replay_command_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-handoff-rows.json"), collectionEnvelope("platform-runtime-operator-handoff-rows.v1", "operator_handoff_rows", result.operator_handoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "runtime-replay-boundary.json"), result.runtime_replay_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-runtime-replay-window-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformRuntimeReplayWindowCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformRuntimeReplayWindow(args);
    console.log(`Platform runtime replay window ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_runtime_replay_window_status}`);
    console.log(`Replay windows: ${result.summary.ready_replay_window_count}/${result.summary.replay_window_count}`);
    console.log(`Replay commands: ${result.summary.ready_replay_command_count}/${result.summary.replay_command_count}`);
    console.log(`Executed by report: ${result.summary.executed_command_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildReplayAnchor(drift) {
  return {
    schema_version: "platform-runtime-replay-anchor.v1",
    phase_slot: PHASE_SLOT,
    baseline_phase_slot: BASELINE_PHASE_SLOT,
    drift_phase_slot: DRIFT_PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    p340_verified_bundle_sha256: P340_BUNDLE_SHA256,
    p340_history_baseline_commit: P340_HISTORY_BASELINE_COMMIT,
    mac_replay_stabilization_commit: MAC_REPLAY_STABILIZATION_COMMIT,
    source_drift_check_id: drift.platform_runtime_drift_check_id,
    source_drift_status: drift.summary.platform_runtime_drift_status,
    source_drifted_row_count: drift.summary.drifted_row_count,
    source_drift_hash: hashValue({
      id: drift.platform_runtime_drift_check_id,
      status: drift.summary.platform_runtime_drift_status,
      rows: drift.summary.total_drift_row_count,
      drifted: drift.summary.drifted_row_count,
    }),
  };
}

function buildReplayWindows() {
  return [
    replayWindow("current_runtime_dependency", "Current runtime/dependency replay", "Re-run the P341 baseline and P342 drift gates against the current checkout before wider validation.", ["runtime_baseline_check", "runtime_drift_check"], {
      replay_scope: "runtime_dependency",
      os_scope: "current_checkout",
      requires_clean_worktree_review: true,
    }),
    replayWindow("contract_release_gate", "Contract and release replay", "Re-run contract golden fixtures, contract validation, and release freeze checks to catch schema or artifact-order drift.", ["contract_golden_check", "contract_validation_check", "release_freeze_check"], {
      replay_scope: "contracts_release",
      os_scope: "current_checkout",
      requires_clean_worktree_review: true,
    }),
    replayWindow("validation_and_tests", "Validation and regression replay", "Re-run the full validation chain and Node test suite with platform drift checks registered.", ["validate_chain_check", "node_test_check"], {
      replay_scope: "validation_tests",
      os_scope: "current_checkout",
      requires_clean_worktree_review: true,
    }),
    replayWindow("artifact_regeneration", "Artifact regeneration replay", "Use the control-plane loop only as an explicit operator replay step when ignored artifact trees need regeneration.", ["control_plane_loop_manual_replay"], {
      replay_scope: "artifact_regeneration",
      os_scope: "current_checkout",
      requires_clean_worktree_review: false,
      artifact_write_possible_when_operator_runs: true,
    }),
    replayWindow("cross_os_history", "Cross-OS history replay", "Keep Windows history-bundle import and Mac stabilization evidence separate from current runtime drift checks.", ["history_bundle_review", "mac_replay_commit_review"], {
      replay_scope: "cross_os_history",
      os_scope: "mac_windows",
      requires_clean_worktree_review: true,
    }),
    replayWindow("trading_safety", "Trading safety replay", "Re-run Trading validation and safety checks while preserving disabled live/full-auto/order-submission posture.", ["trading_validate_check", "trading_safety_check", "trading_full_auto_check"], {
      replay_scope: "trading_safety",
      os_scope: "current_checkout",
      requires_clean_worktree_review: true,
    }),
  ].map((row, index) => withOrdinalAndHash(row, index, "replay_window_hash"));
}

function replayWindow(windowKey, title, description, commandKeys, details = {}) {
  return {
    schema_version: "platform-runtime-replay-window-row.v1",
    replay_window_id: `platform-runtime-replay-window.${windowKey}`,
    phase_slot: PHASE_SLOT,
    baseline_phase_slot: BASELINE_PHASE_SLOT,
    replay_window_key: windowKey,
    title,
    description,
    replay_scope: details.replay_scope,
    os_scope: details.os_scope,
    command_keys: commandKeys,
    command_count: commandKeys.length,
    replay_window_status: "ready",
    requires_clean_worktree_review: details.requires_clean_worktree_review,
    artifact_write_possible_when_operator_runs: details.artifact_write_possible_when_operator_runs ?? false,
    executed_by_report: false,
    mutation_allowed_by_report: false,
    human_review_required: true,
  };
}

function buildReplayCommandRows(replayWindows) {
  const commandSpecs = [
    commandSpec("runtime_baseline_check", "current_runtime_dependency", "npm run platform:runtime-baseline -- --check", "P341 runtime baseline gate.", { check_mode_required: true }),
    commandSpec("runtime_drift_check", "current_runtime_dependency", "npm run platform:drift-check -- --check", "P342 runtime/dependency drift gate.", { check_mode_required: true }),
    commandSpec("contract_golden_check", "contract_release_gate", "npm run contracts:golden-fixtures -- --check", "Contract golden fixture replay gate.", { check_mode_required: true }),
    commandSpec("contract_validation_check", "contract_release_gate", "npm run contracts:validate -- --check", "Contract regression replay gate.", { check_mode_required: true }),
    commandSpec("release_freeze_check", "contract_release_gate", "npm run release:freeze -- --check", "Release freeze replay gate.", { check_mode_required: true }),
    commandSpec("validate_chain_check", "validation_and_tests", "npm run validate", "Full validation chain with platform drift registered.", { check_mode_required: false }),
    commandSpec("node_test_check", "validation_and_tests", "npm test", "Node harness regression replay.", { check_mode_required: false }),
    commandSpec("control_plane_loop_manual_replay", "artifact_regeneration", "npm run control-plane:loop", "Manual artifact regeneration replay when ignored outputs are missing.", { check_mode_required: false, artifact_write_possible_when_operator_runs: true }),
    commandSpec("history_bundle_review", "cross_os_history", "review Hermes-P340-history.bundle before importing history", "Human-reviewed Windows history bundle replay decision.", { shell_command: false, git_operation_if_operator_runs: true }),
    commandSpec("mac_replay_commit_review", "cross_os_history", "git show --stat 8e4323d", "Mac replay stabilization evidence review.", { shell_command: true, git_operation_if_operator_runs: false }),
    commandSpec("trading_validate_check", "trading_safety", "npm run trading:validate -- --check", "Trading pack validation replay gate.", { check_mode_required: true }),
    commandSpec("trading_safety_check", "trading_safety", "npm run trading:safety-check -- --check", "Trading no-write safety replay gate.", { check_mode_required: true }),
    commandSpec("trading_full_auto_check", "trading_safety", "npm run trading:full-auto-report -- --check", "Trading full-auto disabled posture replay gate.", { check_mode_required: true }),
  ];
  const replayWindowKeys = new Set(replayWindows.map((window) => window.replay_window_key));
  return commandSpecs.map((row, index) => {
    const withStatus = {
      ...row,
      phase_slot: PHASE_SLOT,
      baseline_phase_slot: BASELINE_PHASE_SLOT,
      replay_window_known: replayWindowKeys.has(row.replay_window_key),
      replay_command_status: replayWindowKeys.has(row.replay_window_key) ? "ready" : "blocked",
      executed_by_report: false,
      mutation_allowed_by_report: false,
      dependency_install_performed_by_report: false,
      package_mutation_performed_by_report: false,
      git_operation_performed_by_report: false,
      protected_action_executed_by_report: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(withStatus, index, "replay_command_hash");
  });
}

function commandSpec(commandKey, replayWindowKey, command, purpose, options = {}) {
  return {
    schema_version: "platform-runtime-replay-command-row.v1",
    replay_command_id: `platform-runtime-replay-command.${commandKey}`,
    command_key: commandKey,
    replay_window_key: replayWindowKey,
    command,
    purpose,
    shell_command: options.shell_command ?? true,
    check_mode_required: options.check_mode_required ?? false,
    artifact_write_possible_when_operator_runs: options.artifact_write_possible_when_operator_runs ?? false,
    git_operation_if_operator_runs: options.git_operation_if_operator_runs ?? false,
  };
}

function buildOperatorHandoffRows(replayWindows) {
  return replayWindows.map((window, index) => {
    const row = {
      schema_version: "platform-runtime-operator-handoff-row.v1",
      operator_handoff_id: `platform-runtime-operator-handoff.${window.replay_window_key}`,
      phase_slot: PHASE_SLOT,
      replay_window_key: window.replay_window_key,
      handoff_status: "ready",
      handoff_note: handoffNote(window.replay_window_key),
      source_of_truth: "repository_and_generated_artifacts",
      desktop_source_of_truth: false,
      command_execution_allowed_by_report: false,
      protected_action_allowed_by_report: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "operator_handoff_hash");
  });
}

function handoffNote(windowKey) {
  const notes = {
    current_runtime_dependency: "Use first when runtime files, package metadata, or lockfile policy changed.",
    contract_release_gate: "Use after schema, fixture, release, or generated contract source changes.",
    validation_and_tests: "Use before phase closeout to prove the registered validation and test path is green.",
    artifact_regeneration: "Use only when ignored artifact trees are absent or stale; this report does not run regeneration.",
    cross_os_history: "Use when reconciling Mac snapshot state with Windows bundle history.",
    trading_safety: "Use whenever Trading pack sources or safety posture are touched.",
  };
  return notes[windowKey] ?? "Operator review required before replay.";
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "platform-runtime-replay-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    baseline_phase_slot: BASELINE_PHASE_SLOT,
    drift_phase_slot: DRIFT_PHASE_SLOT,
    read_only: true,
    report_only: true,
    command_execution_performed: false,
    dependency_install_performed: false,
    package_mutation_performed: false,
    lockfile_mutation_performed: false,
    artifact_regeneration_performed: false,
    git_operation_performed: false,
    git_tag_created: false,
    release_published: false,
    recovery_execution_performed: false,
    protected_action_executed: false,
    desktop_source_of_truth: false,
    desktop_mutation_allowed: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    broker_write_allowed: false,
    human_review_required_for_replay: true,
  };
}

function buildValidationItems({ drift, replayWindows, replayCommandRows, operatorHandoffRows, replayBoundary }) {
  return [
    validationItem("source.platform_runtime_drift", "p342_drift_stable", drift.validation.valid && drift.summary.platform_runtime_drift_status === "stable" && drift.summary.drifted_row_count === 0, "P342 drift check must be stable before replay windows are ready."),
    validationItem("replay_windows", "replay_windows_ready", replayWindows.length >= 6 && replayWindows.every((row) => row.replay_window_status === "ready" && row.executed_by_report === false && row.mutation_allowed_by_report === false), "Replay windows are ready and report-only."),
    validationItem("replay_commands", "replay_commands_ready", replayCommandRows.length >= 13 && replayCommandRows.every((row) => row.replay_command_status === "ready" && row.executed_by_report === false && row.mutation_allowed_by_report === false), "Replay command rows are ready and not executed by the report."),
    validationItem("operator_handoff", "operator_handoff_ready", operatorHandoffRows.length === replayWindows.length && operatorHandoffRows.every((row) => row.handoff_status === "ready" && row.human_review_required && row.command_execution_allowed_by_report === false), "Operator handoff rows are human-review gated."),
    validationItem("boundary.read_only", "read_only_report", replayBoundary.read_only && replayBoundary.report_only && !replayBoundary.command_execution_performed && !replayBoundary.dependency_install_performed && !replayBoundary.package_mutation_performed && !replayBoundary.artifact_regeneration_performed, "Replay window report is read-only and does not execute commands."),
    validationItem("boundary.git_release", "no_git_or_release_mutation", !replayBoundary.git_operation_performed && !replayBoundary.git_tag_created && !replayBoundary.release_published, "Replay window report does not mutate git or release state."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !replayBoundary.trading_live_enabled && !replayBoundary.trading_full_auto_enabled && !replayBoundary.trading_order_submission_allowed && !replayBoundary.broker_write_allowed, "Trading live/full-auto/order submission and broker writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only_boundary", !replayBoundary.desktop_source_of_truth && !replayBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ drift, replayWindows, replayCommandRows, operatorHandoffRows, replayBoundary, validation }) {
  return {
    platform_runtime_replay_window_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    baseline_phase_slot: BASELINE_PHASE_SLOT,
    drift_phase_slot: DRIFT_PHASE_SLOT,
    source_drift_status: drift.summary.platform_runtime_drift_status,
    source_drifted_row_count: drift.summary.drifted_row_count,
    replay_window_count: replayWindows.length,
    ready_replay_window_count: replayWindows.filter((row) => row.replay_window_status === "ready").length,
    replay_command_count: replayCommandRows.length,
    ready_replay_command_count: replayCommandRows.filter((row) => row.replay_command_status === "ready").length,
    executed_command_count: replayCommandRows.filter((row) => row.executed_by_report).length,
    check_mode_command_count: replayCommandRows.filter((row) => row.check_mode_required).length,
    manual_only_command_count: replayCommandRows.filter((row) => !row.check_mode_required).length,
    operator_handoff_count: operatorHandoffRows.length,
    human_review_handoff_count: operatorHandoffRows.filter((row) => row.human_review_required).length,
    read_only: replayBoundary.read_only,
    report_only: replayBoundary.report_only,
    command_execution_performed: replayBoundary.command_execution_performed,
    dependency_install_performed: replayBoundary.dependency_install_performed,
    package_mutation_performed: replayBoundary.package_mutation_performed,
    lockfile_mutation_performed: replayBoundary.lockfile_mutation_performed,
    artifact_regeneration_performed: replayBoundary.artifact_regeneration_performed,
    git_operation_performed: replayBoundary.git_operation_performed,
    release_published: replayBoundary.release_published,
    recovery_execution_performed: replayBoundary.recovery_execution_performed,
    protected_action_executed: replayBoundary.protected_action_executed,
    desktop_source_of_truth: replayBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: replayBoundary.desktop_mutation_allowed,
    trading_live_enabled: replayBoundary.trading_live_enabled,
    trading_full_auto_enabled: replayBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: replayBoundary.trading_order_submission_allowed,
    broker_write_allowed: replayBoundary.broker_write_allowed,
    validation_error_count: validation.errors.length,
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

function renderMarkdown(result) {
  const lines = [
    "# Platform Runtime Replay Window",
    "",
    `Status: ${result.summary.platform_runtime_replay_window_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source drift status: ${result.summary.source_drift_status}`,
    `Replay windows: ${result.summary.ready_replay_window_count}/${result.summary.replay_window_count}`,
    `Replay commands: ${result.summary.ready_replay_command_count}/${result.summary.replay_command_count}`,
    `Executed by report: ${result.summary.executed_command_count}`,
    "",
    "## Replay Windows",
    "",
    ...result.replay_windows.map((row) => `- ${row.replay_window_key}: ${row.replay_window_status} (${row.command_count} command rows)`),
    "",
    "## Operator Handoff",
    "",
    ...result.operator_handoff_rows.map((row) => `- ${row.replay_window_key}: ${row.handoff_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RUNTIME_REPLAY_WINDOW_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--package-lock") parsed.packageLockPath = argv[++index];
    else if (arg === "--nvmrc") parsed.nvmrcPath = argv[++index];
    else if (arg === "--node-version") parsed.nodeVersionPath = argv[++index];
    else if (arg === "--npmrc") parsed.npmrcPath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--trading-phase-ledger") parsed.tradingPhaseLedgerPath = argv[++index];
    else if (arg === "--baseline-schema") parsed.baselineSchemaPath = argv[++index];
    else if (arg === "--drift-schema") parsed.driftSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-runtime-replay-window.mjs [options]

Options:
  --out-dir <folder>              Output directory. Default: ${DEFAULT_PLATFORM_RUNTIME_REPLAY_WINDOW_OUT_DIR}
  --run-at <iso>                  Deterministic generated_at timestamp.
  --package <path>                package.json path.
  --package-lock <path>           package-lock.json path.
  --nvmrc <path>                  .nvmrc path.
  --node-version <path>           .node-version path.
  --npmrc <path>                  .npmrc path.
  --platform-ops-ledger <path>    P341-P500 ledger path.
  --trading-phase-ledger <path>   Trading P001-P340 ledger path.
  --baseline-schema <path>        P341 runtime baseline schema path.
  --drift-schema <path>           P342 runtime drift schema path.
  --schema <path>                 Output schema path.
  --check                         Validate only, do not write artifacts.
  -h, --help                      Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RUNTIME_REPLAY_WINDOW_INPUTS.packagePath),
    package_lock_path: path.resolve(options.packageLockPath ?? DEFAULT_PLATFORM_RUNTIME_REPLAY_WINDOW_INPUTS.packageLockPath),
    nvmrc_path: path.resolve(options.nvmrcPath ?? DEFAULT_PLATFORM_RUNTIME_REPLAY_WINDOW_INPUTS.nvmrcPath),
    node_version_path: path.resolve(options.nodeVersionPath ?? DEFAULT_PLATFORM_RUNTIME_REPLAY_WINDOW_INPUTS.nodeVersionPath),
    npmrc_path: path.resolve(options.npmrcPath ?? DEFAULT_PLATFORM_RUNTIME_REPLAY_WINDOW_INPUTS.npmrcPath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RUNTIME_REPLAY_WINDOW_INPUTS.platformOpsLedgerPath),
    trading_phase_ledger_path: path.resolve(options.tradingPhaseLedgerPath ?? DEFAULT_PLATFORM_RUNTIME_REPLAY_WINDOW_INPUTS.tradingPhaseLedgerPath),
    baseline_schema_path: path.resolve(options.baselineSchemaPath ?? DEFAULT_PLATFORM_RUNTIME_REPLAY_WINDOW_INPUTS.baselineSchemaPath),
    drift_schema_path: path.resolve(options.driftSchemaPath ?? DEFAULT_PLATFORM_RUNTIME_REPLAY_WINDOW_INPUTS.driftSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RUNTIME_REPLAY_WINDOW_INPUTS.schemaPath),
  };
}

function withOrdinalAndHash(row, index, hashKey) {
  const rowWithOrdinal = { ...row, ordinal: index + 1 };
  return { ...rowWithOrdinal, [hashKey]: hashValue(rowWithOrdinal) };
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

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `platform-runtime-replay-window.${slugify(itemPath)}.${checkId}`,
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

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
