import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATOR_HANDOFF_INPUTS,
  buildPlatformOperatorHandoff,
} from "./platform-operator-handoff.mjs";

export const DEFAULT_PLATFORM_ARTIFACT_GUARD_OUT_DIR = "artifacts/platform-artifact-guard/latest";
export const DEFAULT_PLATFORM_ARTIFACT_GUARD_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATOR_HANDOFF_INPUTS,
  gitignorePath: ".gitignore",
  operatorHandoffSchemaPath: DEFAULT_PLATFORM_OPERATOR_HANDOFF_INPUTS.schemaPath,
  schemaPath: "schemas/platform-artifact-guard.schema.json",
};

const SCHEMA_VERSION = "platform-artifact-guard.v1";
const CAPABILITY_ID = "platform.artifact_guard";
const PHASE_SLOT = "P345";
const PREVIOUS_PHASE_SLOT = "P344";
const NEXT_PHASE_SLOT = "P346";
const BASELINE_PHASE_SLOT = "P341";
const DRIFT_PHASE_SLOT = "P342";
const REPLAY_WINDOW_PHASE_SLOT = "P343";
const OPERATOR_HANDOFF_PHASE_SLOT = "P344";

export async function runPlatformArtifactGuard(options = {}) {
  const result = await buildPlatformArtifactGuard(options);
  if (options.write !== false) await writePlatformArtifactGuard(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform artifact guard failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformArtifactGuard(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_ARTIFACT_GUARD_OUT_DIR);
  const inputs = normalizeInputs(options);
  const operatorHandoff = await buildPlatformOperatorHandoff({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    packageLockPath: inputs.package_lock_path,
    nvmrcPath: inputs.nvmrc_path,
    nodeVersionPath: inputs.node_version_path,
    npmrcPath: inputs.npmrc_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    tradingPhaseLedgerPath: inputs.trading_phase_ledger_path,
    baselineSchemaPath: inputs.baseline_schema_path,
    driftSchemaPath: inputs.drift_schema_path,
    replayWindowSchemaPath: inputs.replay_window_schema_path,
    schemaPath: inputs.operator_handoff_schema_path,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const gitignore = await readTextSource(inputs.gitignore_path);
  const guardAnchor = buildGuardAnchor(operatorHandoff);
  const artifactGuardRows = buildArtifactGuardRows(inputs, gitignore);
  const checkModeRows = buildCheckModeRows(packageJson);
  const sourcePolicyRows = buildSourcePolicyRows(operatorHandoff, packageJson, gitignore);
  const artifactGuardBoundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    operatorHandoff,
    packageJson,
    gitignore,
    artifactGuardRows,
    checkModeRows,
    sourcePolicyRows,
    artifactGuardBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    operatorHandoff,
    artifactGuardRows,
    checkModeRows,
    sourcePolicyRows,
    artifactGuardBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_artifact_guard_id: `platform-artifact-guard.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    guard_anchor: guardAnchor,
    artifact_guard_rows: artifactGuardRows,
    check_mode_rows: checkModeRows,
    source_policy_rows: sourcePolicyRows,
    artifact_guard_boundary: artifactGuardBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_artifact_guard") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    operatorHandoff,
    artifactGuardRows,
    checkModeRows,
    sourcePolicyRows,
    artifactGuardBoundary,
    validation: result.validation,
  });
  result.summary.platform_artifact_guard_id = result.platform_artifact_guard_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformArtifactGuard(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "platform-artifact-guard.json"), serializable);
  await writeJson(path.join(outDir, "artifact-guard-rows.json"), collectionEnvelope("platform-artifact-guard-rows.v1", "artifact_guard_rows", result.artifact_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "check-mode-rows.json"), collectionEnvelope("platform-artifact-check-mode-rows.v1", "check_mode_rows", result.check_mode_rows, result.generated_at));
  await writeJson(path.join(outDir, "source-policy-rows.json"), collectionEnvelope("platform-artifact-source-policy-rows.v1", "source_policy_rows", result.source_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "artifact-guard-boundary.json"), result.artifact_guard_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-artifact-guard-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformArtifactGuardCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformArtifactGuard(args);
    console.log(`Platform artifact guard ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_artifact_guard_status}`);
    console.log(`Artifact rows: ${result.summary.guarded_artifact_row_count}/${result.summary.artifact_guard_row_count}`);
    console.log(`Check mode rows: ${result.summary.check_mode_ready_count}/${result.summary.check_mode_row_count}`);
    console.log(`Source policy rows: ${result.summary.source_policy_ready_count}/${result.summary.source_policy_row_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildGuardAnchor(operatorHandoff) {
  return {
    schema_version: "platform-artifact-guard-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    baseline_phase_slot: BASELINE_PHASE_SLOT,
    drift_phase_slot: DRIFT_PHASE_SLOT,
    replay_window_phase_slot: REPLAY_WINDOW_PHASE_SLOT,
    operator_handoff_phase_slot: OPERATOR_HANDOFF_PHASE_SLOT,
    source_operator_handoff_id: operatorHandoff.platform_operator_handoff_id,
    source_operator_handoff_status: operatorHandoff.summary.platform_operator_handoff_status,
    source_handoff_packet_count: operatorHandoff.summary.handoff_packet_count,
    source_operator_handoff_hash: hashValue({
      id: operatorHandoff.platform_operator_handoff_id,
      status: operatorHandoff.summary.platform_operator_handoff_status,
      packets: operatorHandoff.summary.handoff_packet_count,
    }),
  };
}

function buildArtifactGuardRows(inputs, gitignore) {
  const artifactIgnored = parseGitignore(gitignore.text ?? "").has("artifacts/");
  const rows = [
    artifactRow("runtime_baseline_artifacts", "P341 runtime baseline artifacts remain generated output.", "artifacts/platform-runtime-baseline/latest", "platform:runtime-baseline", artifactIgnored),
    artifactRow("runtime_drift_artifacts", "P342 runtime drift artifacts remain generated output.", "artifacts/platform-runtime-drift/latest", "platform:drift-check", artifactIgnored),
    artifactRow("replay_window_artifacts", "P343 replay-window artifacts remain generated output.", "artifacts/platform-runtime-replay-window/latest", "platform:replay-window", artifactIgnored),
    artifactRow("operator_handoff_artifacts", "P344 operator handoff artifacts remain generated output.", "artifacts/platform-operator-handoff/latest", "platform:operator-handoff", artifactIgnored),
    artifactRow("artifact_guard_artifacts", "P345 artifact guard artifacts remain generated output.", "artifacts/platform-artifact-guard/latest", "platform:artifact-guard", artifactIgnored),
  ];
  return rows.map((row, index) => withOrdinalAndHash({ ...row, gitignore_path: inputs.gitignore_path }, index, "artifact_guard_hash"));
}

function artifactRow(rowKey, description, artifactPath, packageScriptName, artifactIgnored) {
  return {
    schema_version: "platform-artifact-guard-row.v1",
    artifact_guard_row_id: `platform-artifact-guard.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    artifact_path: artifactPath,
    package_script_name: packageScriptName,
    artifact_guard_status: artifactIgnored ? "guarded" : "blocked",
    artifact_path_under_ignored_tree: artifactPath.startsWith("artifacts/"),
    artifact_tree_ignored_by_git: artifactIgnored,
    artifact_read_only_by_policy: true,
    source_mutation_allowed: false,
    check_mode_required_for_validation: true,
    human_review_required_for_artifact_mutation: true,
  };
}

function buildCheckModeRows(packageJson) {
  const scripts = packageJson.data?.scripts ?? {};
  const rows = [
    checkModeRow("platform:runtime-baseline", "npm run platform:runtime-baseline -- --check", scripts["platform:runtime-baseline"]),
    checkModeRow("platform:drift-check", "npm run platform:drift-check -- --check", scripts["platform:drift-check"]),
    checkModeRow("platform:replay-window", "npm run platform:replay-window -- --check", scripts["platform:replay-window"]),
    checkModeRow("platform:operator-handoff", "npm run platform:operator-handoff -- --check", scripts["platform:operator-handoff"]),
    checkModeRow("platform:artifact-guard", "npm run platform:artifact-guard -- --check", scripts["platform:artifact-guard"]),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "check_mode_hash"));
}

function checkModeRow(packageScriptName, checkCommand, scriptValue) {
  const scriptPresent = typeof scriptValue === "string" && scriptValue.startsWith("node scripts/");
  return {
    schema_version: "platform-artifact-check-mode-row.v1",
    check_mode_row_id: `platform-artifact-guard.check.${packageScriptName.replace(/:/g, "_")}`,
    phase_slot: PHASE_SLOT,
    package_script_name: packageScriptName,
    package_script_value: scriptValue ?? null,
    check_command: checkCommand,
    check_mode_status: scriptPresent ? "ready" : "blocked",
    package_script_present: scriptPresent,
    check_argument_required: true,
    check_overwrite_allowed: false,
    source_mutation_allowed: false,
    command_executed_by_report: false,
  };
}

function buildSourcePolicyRows(operatorHandoff, packageJson, gitignore) {
  const scripts = packageJson.data?.scripts ?? {};
  const gitignoreEntries = parseGitignore(gitignore.text ?? "");
  const rows = [
    sourcePolicyRow("operator_handoff_ready", "P344 operator handoff source must be ready before artifact guard closes drift-report phases.", operatorHandoff.summary.platform_operator_handoff_status === "ready", {
      actual_value: operatorHandoff.summary.platform_operator_handoff_status,
      expected_value: "ready",
    }),
    sourcePolicyRow("artifacts_ignored", ".gitignore keeps generated artifacts out of tracked source.", gitignoreEntries.has("artifacts/"), {
      actual_value: gitignoreEntries.has("artifacts/") ? "artifacts/" : null,
      expected_value: "artifacts/",
    }),
    sourcePolicyRow("platform_validate_chain_registered", "Validation chain includes the P341-P345 platform reproducibility checks.", validateScriptIncludesPlatformChecks(scripts.validate), {
      actual_value: scripts.validate ?? null,
      expected_value: "platform:runtime-baseline platform:drift-check platform:replay-window platform:operator-handoff platform:artifact-guard",
    }),
    sourcePolicyRow("desktop_boundary_preserved", "Desktop remains operator surface only.", operatorHandoff.summary.desktop_source_of_truth === false && operatorHandoff.summary.desktop_mutation_allowed === false, {
      actual_value: `source_of_truth=${operatorHandoff.summary.desktop_source_of_truth};mutation=${operatorHandoff.summary.desktop_mutation_allowed}`,
      expected_value: "source_of_truth=false;mutation=false",
    }),
    sourcePolicyRow("trading_boundary_preserved", "Trading live/full-auto/order submission and broker writes remain disabled.", operatorHandoff.summary.trading_live_enabled === false && operatorHandoff.summary.trading_full_auto_enabled === false && operatorHandoff.summary.trading_order_submission_allowed === false && operatorHandoff.summary.broker_write_allowed === false, {
      actual_value: `live=${operatorHandoff.summary.trading_live_enabled};full_auto=${operatorHandoff.summary.trading_full_auto_enabled};orders=${operatorHandoff.summary.trading_order_submission_allowed};broker=${operatorHandoff.summary.broker_write_allowed}`,
      expected_value: "live=false;full_auto=false;orders=false;broker=false",
    }),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "source_policy_hash"));
}

function sourcePolicyRow(rowKey, description, passed, details = {}) {
  return {
    schema_version: "platform-artifact-source-policy-row.v1",
    source_policy_row_id: `platform-artifact-guard.source.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    expected_value: details.expected_value ?? null,
    actual_value: details.actual_value ?? null,
    source_policy_status: passed ? "ready" : "blocked",
    source_mutation_allowed: false,
    human_review_required: true,
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "platform-artifact-guard-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    baseline_phase_slot: BASELINE_PHASE_SLOT,
    drift_phase_slot: DRIFT_PHASE_SLOT,
    replay_window_phase_slot: REPLAY_WINDOW_PHASE_SLOT,
    operator_handoff_phase_slot: OPERATOR_HANDOFF_PHASE_SLOT,
    read_only: true,
    report_only: true,
    command_execution_performed: false,
    dependency_install_performed: false,
    package_mutation_performed: false,
    lockfile_mutation_performed: false,
    artifact_overwrite_performed: false,
    artifact_regeneration_performed: false,
    git_operation_performed: false,
    release_published: false,
    recovery_execution_performed: false,
    protected_action_executed: false,
    approval_applied: false,
    desktop_source_of_truth: false,
    desktop_mutation_allowed: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    broker_write_allowed: false,
    human_review_required_for_artifact_mutation: true,
  };
}

function buildValidationItems({ operatorHandoff, packageJson, gitignore, artifactGuardRows, checkModeRows, sourcePolicyRows, artifactGuardBoundary }) {
  return [
    validationItem("source.operator_handoff", "p344_operator_handoff_ready", operatorHandoff.validation.valid && operatorHandoff.summary.platform_operator_handoff_status === "ready", "P344 operator handoff source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for platform script policy."),
    validationItem("source.gitignore", "gitignore_available", gitignore.available, ".gitignore is readable for artifact tree policy."),
    validationItem("artifact_guard_rows", "artifact_rows_guarded", artifactGuardRows.length >= 5 && artifactGuardRows.every((row) => row.artifact_guard_status === "guarded" && row.artifact_path_under_ignored_tree && row.artifact_read_only_by_policy), "P341-P345 artifacts are under the ignored artifacts tree and guarded by policy."),
    validationItem("check_mode_rows", "check_modes_registered", checkModeRows.length >= 5 && checkModeRows.every((row) => row.check_mode_status === "ready" && row.check_argument_required && !row.check_overwrite_allowed), "P341-P345 platform commands have check-mode rows registered."),
    validationItem("source_policy_rows", "source_policy_ready", sourcePolicyRows.length >= 5 && sourcePolicyRows.every((row) => row.source_policy_status === "ready" && row.source_mutation_allowed === false), "Source policy rows are ready and do not allow source mutation."),
    validationItem("boundary.read_only", "read_only_report", artifactGuardBoundary.read_only && artifactGuardBoundary.report_only && !artifactGuardBoundary.command_execution_performed && !artifactGuardBoundary.package_mutation_performed && !artifactGuardBoundary.artifact_overwrite_performed, "Artifact guard is read-only and does not overwrite artifacts."),
    validationItem("boundary.protected_actions", "no_protected_actions", !artifactGuardBoundary.protected_action_executed && !artifactGuardBoundary.approval_applied && !artifactGuardBoundary.recovery_execution_performed, "Artifact guard does not execute protected actions or apply approvals."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !artifactGuardBoundary.trading_live_enabled && !artifactGuardBoundary.trading_full_auto_enabled && !artifactGuardBoundary.trading_order_submission_allowed && !artifactGuardBoundary.broker_write_allowed, "Trading live/full-auto/order submission and broker writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only_boundary", !artifactGuardBoundary.desktop_source_of_truth && !artifactGuardBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ operatorHandoff, artifactGuardRows, checkModeRows, sourcePolicyRows, artifactGuardBoundary, validation }) {
  return {
    platform_artifact_guard_status: validation.valid ? "guarded" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    baseline_phase_slot: BASELINE_PHASE_SLOT,
    drift_phase_slot: DRIFT_PHASE_SLOT,
    replay_window_phase_slot: REPLAY_WINDOW_PHASE_SLOT,
    operator_handoff_phase_slot: OPERATOR_HANDOFF_PHASE_SLOT,
    source_operator_handoff_status: operatorHandoff.summary.platform_operator_handoff_status,
    artifact_guard_row_count: artifactGuardRows.length,
    guarded_artifact_row_count: artifactGuardRows.filter((row) => row.artifact_guard_status === "guarded").length,
    check_mode_row_count: checkModeRows.length,
    check_mode_ready_count: checkModeRows.filter((row) => row.check_mode_status === "ready").length,
    source_policy_row_count: sourcePolicyRows.length,
    source_policy_ready_count: sourcePolicyRows.filter((row) => row.source_policy_status === "ready").length,
    read_only: artifactGuardBoundary.read_only,
    report_only: artifactGuardBoundary.report_only,
    command_execution_performed: artifactGuardBoundary.command_execution_performed,
    dependency_install_performed: artifactGuardBoundary.dependency_install_performed,
    package_mutation_performed: artifactGuardBoundary.package_mutation_performed,
    lockfile_mutation_performed: artifactGuardBoundary.lockfile_mutation_performed,
    artifact_overwrite_performed: artifactGuardBoundary.artifact_overwrite_performed,
    artifact_regeneration_performed: artifactGuardBoundary.artifact_regeneration_performed,
    git_operation_performed: artifactGuardBoundary.git_operation_performed,
    release_published: artifactGuardBoundary.release_published,
    recovery_execution_performed: artifactGuardBoundary.recovery_execution_performed,
    protected_action_executed: artifactGuardBoundary.protected_action_executed,
    approval_applied: artifactGuardBoundary.approval_applied,
    desktop_source_of_truth: artifactGuardBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: artifactGuardBoundary.desktop_mutation_allowed,
    trading_live_enabled: artifactGuardBoundary.trading_live_enabled,
    trading_full_auto_enabled: artifactGuardBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: artifactGuardBoundary.trading_order_submission_allowed,
    broker_write_allowed: artifactGuardBoundary.broker_write_allowed,
    validation_error_count: validation.errors.length,
  };
}

function validateScriptIncludesPlatformChecks(validateScript = "") {
  return [
    "platform:runtime-baseline",
    "platform:drift-check",
    "platform:replay-window",
    "platform:operator-handoff",
    "platform:artifact-guard",
  ].every((scriptName) => validateScript.includes(scriptName));
}

function parseGitignore(text) {
  return new Set(text.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line && !line.startsWith("#")));
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
    "# Platform Artifact Guard",
    "",
    `Status: ${result.summary.platform_artifact_guard_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source operator handoff: ${result.summary.source_operator_handoff_status}`,
    `Artifact rows: ${result.summary.guarded_artifact_row_count}/${result.summary.artifact_guard_row_count}`,
    `Check mode rows: ${result.summary.check_mode_ready_count}/${result.summary.check_mode_row_count}`,
    `Source policy rows: ${result.summary.source_policy_ready_count}/${result.summary.source_policy_row_count}`,
    "",
    "## Artifact Rows",
    "",
    ...result.artifact_guard_rows.map((row) => `- ${row.row_key}: ${row.artifact_guard_status}`),
    "",
    "## Check Mode Rows",
    "",
    ...result.check_mode_rows.map((row) => `- ${row.package_script_name}: ${row.check_mode_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_ARTIFACT_GUARD_OUT_DIR };
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
    else if (arg === "--replay-window-schema") parsed.replayWindowSchemaPath = argv[++index];
    else if (arg === "--operator-handoff-schema") parsed.operatorHandoffSchemaPath = argv[++index];
    else if (arg === "--gitignore") parsed.gitignorePath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-artifact-guard.mjs [options]

Options:
  --out-dir <folder>                Output directory. Default: ${DEFAULT_PLATFORM_ARTIFACT_GUARD_OUT_DIR}
  --run-at <iso>                    Deterministic generated_at timestamp.
  --package <path>                  package.json path.
  --package-lock <path>             package-lock.json path.
  --nvmrc <path>                    .nvmrc path.
  --node-version <path>             .node-version path.
  --npmrc <path>                    .npmrc path.
  --platform-ops-ledger <path>      P341-P500 ledger path.
  --trading-phase-ledger <path>     Trading P001-P340 ledger path.
  --baseline-schema <path>          P341 runtime baseline schema path.
  --drift-schema <path>             P342 runtime drift schema path.
  --replay-window-schema <path>     P343 replay-window schema path.
  --operator-handoff-schema <path>  P344 operator handoff schema path.
  --gitignore <path>                .gitignore path.
  --schema <path>                   Output schema path.
  --check                           Validate only, do not write artifacts.
  -h, --help                        Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_ARTIFACT_GUARD_INPUTS.packagePath),
    package_lock_path: path.resolve(options.packageLockPath ?? DEFAULT_PLATFORM_ARTIFACT_GUARD_INPUTS.packageLockPath),
    nvmrc_path: path.resolve(options.nvmrcPath ?? DEFAULT_PLATFORM_ARTIFACT_GUARD_INPUTS.nvmrcPath),
    node_version_path: path.resolve(options.nodeVersionPath ?? DEFAULT_PLATFORM_ARTIFACT_GUARD_INPUTS.nodeVersionPath),
    npmrc_path: path.resolve(options.npmrcPath ?? DEFAULT_PLATFORM_ARTIFACT_GUARD_INPUTS.npmrcPath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_ARTIFACT_GUARD_INPUTS.platformOpsLedgerPath),
    trading_phase_ledger_path: path.resolve(options.tradingPhaseLedgerPath ?? DEFAULT_PLATFORM_ARTIFACT_GUARD_INPUTS.tradingPhaseLedgerPath),
    baseline_schema_path: path.resolve(options.baselineSchemaPath ?? DEFAULT_PLATFORM_ARTIFACT_GUARD_INPUTS.baselineSchemaPath),
    drift_schema_path: path.resolve(options.driftSchemaPath ?? DEFAULT_PLATFORM_ARTIFACT_GUARD_INPUTS.driftSchemaPath),
    replay_window_schema_path: path.resolve(options.replayWindowSchemaPath ?? DEFAULT_PLATFORM_ARTIFACT_GUARD_INPUTS.replayWindowSchemaPath),
    operator_handoff_schema_path: path.resolve(options.operatorHandoffSchemaPath ?? DEFAULT_PLATFORM_ARTIFACT_GUARD_INPUTS.operatorHandoffSchemaPath),
    gitignore_path: path.resolve(options.gitignorePath ?? DEFAULT_PLATFORM_ARTIFACT_GUARD_INPUTS.gitignorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_ARTIFACT_GUARD_INPUTS.schemaPath),
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
      text: null,
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
    validation_item_id: `platform-artifact-guard.${slugify(itemPath)}.${checkId}`,
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
