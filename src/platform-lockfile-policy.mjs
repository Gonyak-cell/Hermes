import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS,
  buildPlatformMacWindowsReplayNotes,
} from "./platform-mac-windows-replay-notes.mjs";

export const DEFAULT_PLATFORM_LOCKFILE_POLICY_OUT_DIR = "artifacts/platform-lockfile-policy/latest";
export const DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS = {
  ...DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS,
  macWindowsReplayNotesSchemaPath: DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.schemaPath,
  schemaPath: "schemas/platform-lockfile-policy.schema.json",
};

const SCHEMA_VERSION = "platform-lockfile-policy.v1";
const CAPABILITY_ID = "platform.lockfile_policy";
const PHASE_SLOT = "P352";
const PREVIOUS_PHASE_SLOT = "P351";
const NEXT_PHASE_SLOT = "P353";
const PINNED_PACKAGE_MANAGER = "npm@11.12.1";

export async function runPlatformLockfilePolicy(options = {}) {
  const result = await buildPlatformLockfilePolicy(options);
  if (options.write !== false) await writePlatformLockfilePolicy(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform lockfile policy failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformLockfilePolicy(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const macWindowsReplayNotes = await buildPlatformMacWindowsReplayNotes({
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
    operatorHandoffSchemaPath: inputs.operator_handoff_schema_path,
    artifactGuardSchemaPath: inputs.artifact_guard_schema_path,
    provenanceLedgerSchemaPath: inputs.provenance_ledger_schema_path,
    releaseBundleProvenanceSchemaPath: inputs.release_bundle_provenance_schema_path,
    signedTagProvenanceSchemaPath: inputs.signed_tag_provenance_schema_path,
    provenanceFreezePreflightSchemaPath: inputs.provenance_freeze_preflight_schema_path,
    provenanceFreezeSchemaPath: inputs.provenance_freeze_schema_path,
    gitignorePath: inputs.gitignore_path,
    schemaPath: inputs.mac_windows_replay_notes_schema_path,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const packageLock = await readJsonSource(inputs.package_lock_path);
  const npmrc = await readTextSource(inputs.npmrc_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const lockfilePolicyAnchor = buildLockfilePolicyAnchor(macWindowsReplayNotes);
  const lockfilePolicyRows = buildLockfilePolicyRows({ macWindowsReplayNotes, npmrc, packageJson, packageLock });
  const lockfileGateRows = buildLockfileGateRows({ lockfilePolicyRows, macWindowsReplayNotes, packageJson, platformOpsLedger });
  const lockfilePolicyBoundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    macWindowsReplayNotes,
    packageJson,
    packageLock,
    npmrc,
    platformOpsLedger,
    lockfilePolicyRows,
    lockfileGateRows,
    lockfilePolicyBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    macWindowsReplayNotes,
    lockfilePolicyRows,
    lockfileGateRows,
    lockfilePolicyBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_lockfile_policy_id: `platform-lockfile-policy.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    lockfile_policy_anchor: lockfilePolicyAnchor,
    lockfile_policy_rows: lockfilePolicyRows,
    lockfile_gate_rows: lockfileGateRows,
    lockfile_policy_boundary: lockfilePolicyBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_lockfile_policy") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    macWindowsReplayNotes,
    lockfilePolicyRows,
    lockfileGateRows,
    lockfilePolicyBoundary,
    validation: result.validation,
  });
  result.summary.platform_lockfile_policy_id = result.platform_lockfile_policy_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformLockfilePolicy(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "platform-lockfile-policy.json"), serializable);
  await writeJson(path.join(outDir, "lockfile-policy-rows.json"), collectionEnvelope("platform-lockfile-policy-rows.v1", "lockfile_policy_rows", result.lockfile_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "lockfile-gate-rows.json"), collectionEnvelope("platform-lockfile-gate-rows.v1", "lockfile_gate_rows", result.lockfile_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "lockfile-policy-boundary.json"), result.lockfile_policy_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-lockfile-policy-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformLockfilePolicyCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformLockfilePolicy(args);
    console.log(`Platform lockfile policy ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_lockfile_policy_status}`);
    console.log(`Policy rows: ${result.summary.ready_lockfile_policy_count}/${result.summary.lockfile_policy_count}`);
    console.log(`Lockfile gates: ${result.summary.ready_lockfile_gate_count}/${result.summary.lockfile_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildLockfilePolicyAnchor(macWindowsReplayNotes) {
  return {
    schema_version: "platform-lockfile-policy-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_mac_windows_replay_notes_id: macWindowsReplayNotes.platform_mac_windows_replay_notes_id,
    source_mac_windows_replay_notes_status: macWindowsReplayNotes.summary.platform_mac_windows_replay_notes_status,
    source_mac_windows_replay_notes_hash: hashValue({
      id: macWindowsReplayNotes.platform_mac_windows_replay_notes_id,
      status: macWindowsReplayNotes.summary.platform_mac_windows_replay_notes_status,
      note_rows: macWindowsReplayNotes.summary.replay_note_count,
      gate_rows: macWindowsReplayNotes.summary.replay_gate_count,
    }),
  };
}

function buildLockfilePolicyRows({ macWindowsReplayNotes, npmrc, packageJson, packageLock }) {
  const sourceReady = macWindowsReplayNotes.validation.valid && macWindowsReplayNotes.summary.platform_mac_windows_replay_notes_status === "ready";
  const npmrcFlags = parseNpmrc(npmrc.text ?? "");
  const packageJsonData = packageJson.data ?? {};
  const packageLockData = packageLock.data ?? {};
  const rootLockPackage = packageLockData.packages?.[""] ?? {};
  const rows = [
    policyRow("package_lock_present", "package-lock.json is committed for deterministic npm installs.", packageLock.available, { expected_value: "package-lock.json", actual_value: packageLock.available ? packageLock.path : null }),
    policyRow("lockfile_version_modern", "package-lock.json uses npm lockfile version 3 or newer.", Number(packageLockData.lockfileVersion ?? 0) >= 3, { expected_value: ">=3", actual_value: packageLockData.lockfileVersion ?? null }),
    policyRow("lockfile_root_matches_package", "Lockfile root package name and version match package.json.", rootLockPackage.name === packageJsonData.name && rootLockPackage.version === packageJsonData.version, { expected_value: `${packageJsonData.name ?? ""}@${packageJsonData.version ?? ""}`, actual_value: `${rootLockPackage.name ?? ""}@${rootLockPackage.version ?? ""}` }),
    policyRow("package_manager_pinned", "package.json pins the package manager used to interpret the lockfile.", packageJsonData.packageManager === PINNED_PACKAGE_MANAGER, { expected_value: PINNED_PACKAGE_MANAGER, actual_value: packageJsonData.packageManager ?? null }),
    policyRow("npmrc_package_lock_enabled", ".npmrc keeps package-lock generation enabled.", npmrcFlags["package-lock"] === "true", { expected_value: "true", actual_value: npmrcFlags["package-lock"] ?? null }),
    policyRow("lockfile_change_human_review", "Any future lockfile change requires human review and a dedicated replay note.", true, { expected_value: "human-review", actual_value: "human-review" }),
  ];
  return rows.map((row, index) => withOrdinalAndHash({ ...row, lockfile_policy_status: sourceReady && row.lockfile_policy_status === "ready" ? "ready" : "blocked" }, index, "lockfile_policy_hash"));
}

function policyRow(rowKey, description, passed, details = {}) {
  return {
    schema_version: "platform-lockfile-policy-row.v1",
    lockfile_policy_row_id: `platform-lockfile-policy.row.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    lockfile_policy_status: passed ? "ready" : "blocked",
    lockfile_required: true,
    dependency_install_performed_by_report: false,
    lockfile_mutation_performed_by_report: false,
    package_mutation_performed_by_report: false,
    command_execution_performed_by_report: false,
    human_review_required: true,
    ...details,
  };
}

function buildLockfileGateRows({ lockfilePolicyRows, macWindowsReplayNotes, packageJson, platformOpsLedger }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p351_replay_notes_ready", "P351 Mac/Windows replay notes source is ready.", macWindowsReplayNotes.validation.valid && macWindowsReplayNotes.summary.platform_mac_windows_replay_notes_status === "ready"),
    gateRow("platform_package_script_registered", "package.json registers the P352 lockfile policy command.", typeof scripts["platform:lockfile-policy"] === "string" && scripts["platform:lockfile-policy"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P352 lockfile policy check.", validateScript.includes("npm run platform:lockfile-policy -- --check")),
    gateRow("p352_ledger_acceptance_declared", "P352 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P352: `platform:lockfile-policy`")),
    gateRow("lockfile_policy_rows_ready", "All lockfile policy rows are ready.", lockfilePolicyRows.length >= 6 && lockfilePolicyRows.every((row) => row.lockfile_policy_status === "ready")),
    gateRow("no_install_or_lockfile_mutation", "Lockfile policy performs no dependency install, package mutation, or lockfile mutation.", true),
    gateRow("p353_next_phase_reserved", "P353 owns the replay handoff map and P354 owns the replay evidence checklist.", ledgerText.includes("P353: `platform:replay-handoff-map`") && ledgerText.includes("P354: `platform:replay-evidence-checklist`")),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "lockfile_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-lockfile-gate-row.v1",
    lockfile_gate_row_id: `platform-lockfile-policy.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    command_execution_performed_by_report: false,
    dependency_install_performed_by_report: false,
    package_mutation_performed_by_report: false,
    lockfile_mutation_performed_by_report: false,
    artifact_regeneration_performed_by_report: false,
    protected_action_executed_by_report: false,
    human_review_required: true,
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "platform-lockfile-policy-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    command_execution_performed: false,
    dependency_install_performed: false,
    package_mutation_performed: false,
    lockfile_mutation_performed: false,
    artifact_overwrite_performed: false,
    artifact_regeneration_performed: false,
    history_import_performed: false,
    repository_checkout_changed: false,
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
    human_review_required_for_lockfile_change: true,
  };
}

function buildValidationItems({ macWindowsReplayNotes, packageJson, packageLock, npmrc, platformOpsLedger, lockfilePolicyRows, lockfileGateRows, lockfilePolicyBoundary }) {
  return [
    validationItem("source.mac_windows_replay_notes", "p351_mac_windows_replay_notes_ready", macWindowsReplayNotes.validation.valid && macWindowsReplayNotes.summary.platform_mac_windows_replay_notes_status === "ready", "P351 Mac/Windows replay notes source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for lockfile policy."),
    validationItem("source.package_lock", "package_lock_available", packageLock.available, "package-lock.json is readable for lockfile policy."),
    validationItem("source.npmrc", "npmrc_available", npmrc.available, ".npmrc is readable for package-lock policy."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("lockfile_policy_rows", "lockfile_policy_rows_ready", lockfilePolicyRows.length >= 6 && lockfilePolicyRows.every((row) => row.lockfile_policy_status === "ready" && !row.dependency_install_performed_by_report && !row.lockfile_mutation_performed_by_report), "Lockfile policy rows are ready and report-only."),
    validationItem("lockfile_gate_rows", "lockfile_gates_ready", lockfileGateRows.length >= 7 && lockfileGateRows.every((row) => row.gate_status === "ready" && !row.dependency_install_performed_by_report && !row.lockfile_mutation_performed_by_report), "P352 lockfile gates are ready and report-only."),
    validationItem("boundary.read_only", "read_only_report", lockfilePolicyBoundary.read_only && lockfilePolicyBoundary.report_only && !lockfilePolicyBoundary.command_execution_performed && !lockfilePolicyBoundary.package_mutation_performed && !lockfilePolicyBoundary.artifact_overwrite_performed, "Lockfile policy is read-only and does not overwrite artifacts."),
    validationItem("boundary.no_lockfile_mutation", "no_lockfile_mutation", !lockfilePolicyBoundary.dependency_install_performed && !lockfilePolicyBoundary.package_mutation_performed && !lockfilePolicyBoundary.lockfile_mutation_performed && !lockfilePolicyBoundary.artifact_regeneration_performed, "Lockfile policy does not install dependencies, mutate package files, mutate lockfiles, or regenerate artifacts."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !lockfilePolicyBoundary.trading_live_enabled && !lockfilePolicyBoundary.trading_full_auto_enabled && !lockfilePolicyBoundary.trading_order_submission_allowed && !lockfilePolicyBoundary.broker_write_allowed, "Trading live/full-auto/order submission and broker writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only_boundary", !lockfilePolicyBoundary.desktop_source_of_truth && !lockfilePolicyBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ macWindowsReplayNotes, lockfilePolicyRows, lockfileGateRows, lockfilePolicyBoundary, validation }) {
  return {
    platform_lockfile_policy_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_mac_windows_replay_notes_status: macWindowsReplayNotes.summary.platform_mac_windows_replay_notes_status,
    lockfile_policy_count: lockfilePolicyRows.length,
    ready_lockfile_policy_count: lockfilePolicyRows.filter((row) => row.lockfile_policy_status === "ready").length,
    lockfile_gate_count: lockfileGateRows.length,
    ready_lockfile_gate_count: lockfileGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: lockfilePolicyBoundary.read_only,
    report_only: lockfilePolicyBoundary.report_only,
    command_execution_performed: lockfilePolicyBoundary.command_execution_performed,
    dependency_install_performed: lockfilePolicyBoundary.dependency_install_performed,
    package_mutation_performed: lockfilePolicyBoundary.package_mutation_performed,
    lockfile_mutation_performed: lockfilePolicyBoundary.lockfile_mutation_performed,
    artifact_overwrite_performed: lockfilePolicyBoundary.artifact_overwrite_performed,
    artifact_regeneration_performed: lockfilePolicyBoundary.artifact_regeneration_performed,
    history_import_performed: lockfilePolicyBoundary.history_import_performed,
    repository_checkout_changed: lockfilePolicyBoundary.repository_checkout_changed,
    git_operation_performed: lockfilePolicyBoundary.git_operation_performed,
    release_published: lockfilePolicyBoundary.release_published,
    recovery_execution_performed: lockfilePolicyBoundary.recovery_execution_performed,
    protected_action_executed: lockfilePolicyBoundary.protected_action_executed,
    approval_applied: lockfilePolicyBoundary.approval_applied,
    desktop_source_of_truth: lockfilePolicyBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: lockfilePolicyBoundary.desktop_mutation_allowed,
    trading_live_enabled: lockfilePolicyBoundary.trading_live_enabled,
    trading_full_auto_enabled: lockfilePolicyBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: lockfilePolicyBoundary.trading_order_submission_allowed,
    broker_write_allowed: lockfilePolicyBoundary.broker_write_allowed,
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
    "# Platform Lockfile Policy",
    "",
    `Status: ${result.summary.platform_lockfile_policy_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source Mac/Windows replay notes: ${result.summary.source_mac_windows_replay_notes_status}`,
    `Policy rows: ${result.summary.ready_lockfile_policy_count}/${result.summary.lockfile_policy_count}`,
    `Lockfile gates: ${result.summary.ready_lockfile_gate_count}/${result.summary.lockfile_gate_count}`,
    "",
    "## Policy Rows",
    "",
    ...result.lockfile_policy_rows.map((row) => `- ${row.row_key}: ${row.lockfile_policy_status}`),
    "",
    "## Lockfile Gates",
    "",
    ...result.lockfile_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_LOCKFILE_POLICY_OUT_DIR };
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
    else if (arg === "--artifact-guard-schema") parsed.artifactGuardSchemaPath = argv[++index];
    else if (arg === "--provenance-ledger-schema") parsed.provenanceLedgerSchemaPath = argv[++index];
    else if (arg === "--release-bundle-provenance-schema") parsed.releaseBundleProvenanceSchemaPath = argv[++index];
    else if (arg === "--signed-tag-provenance-schema") parsed.signedTagProvenanceSchemaPath = argv[++index];
    else if (arg === "--provenance-freeze-preflight-schema") parsed.provenanceFreezePreflightSchemaPath = argv[++index];
    else if (arg === "--provenance-freeze-schema") parsed.provenanceFreezeSchemaPath = argv[++index];
    else if (arg === "--mac-windows-replay-notes-schema") parsed.macWindowsReplayNotesSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/platform-lockfile-policy.mjs [options]

Options:
  --out-dir <folder>                    Output directory. Default: ${DEFAULT_PLATFORM_LOCKFILE_POLICY_OUT_DIR}
  --run-at <iso>                        Deterministic generated_at timestamp.
  --package <path>                      package.json path.
  --package-lock <path>                 package-lock.json path.
  --nvmrc <path>                        .nvmrc path.
  --node-version <path>                 .node-version path.
  --npmrc <path>                        .npmrc path.
  --platform-ops-ledger <path>          P341-P500 ledger path.
  --trading-phase-ledger <path>         Trading P001-P340 ledger path.
  --baseline-schema <path>              P341 runtime baseline schema path.
  --drift-schema <path>                 P342 runtime drift schema path.
  --replay-window-schema <path>         P343 replay-window schema path.
  --operator-handoff-schema <path>      P344 operator handoff schema path.
  --artifact-guard-schema <path>        P345 artifact guard schema path.
  --provenance-ledger-schema <path>     P346 provenance ledger schema path.
  --release-bundle-provenance-schema <path> P347 release bundle provenance schema path.
  --signed-tag-provenance-schema <path> P348 signed-tag provenance schema path.
  --provenance-freeze-preflight-schema <path> P349 provenance freeze preflight schema path.
  --provenance-freeze-schema <path>     P350 provenance freeze schema path.
  --mac-windows-replay-notes-schema <path> P351 Mac/Windows replay notes schema path.
  --gitignore <path>                    .gitignore path.
  --schema <path>                       Output schema path.
  --check                               Validate only, do not write artifacts.
  -h, --help                            Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.packagePath),
    package_lock_path: path.resolve(options.packageLockPath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.packageLockPath),
    nvmrc_path: path.resolve(options.nvmrcPath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.nvmrcPath),
    node_version_path: path.resolve(options.nodeVersionPath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.nodeVersionPath),
    npmrc_path: path.resolve(options.npmrcPath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.npmrcPath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.platformOpsLedgerPath),
    trading_phase_ledger_path: path.resolve(options.tradingPhaseLedgerPath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.tradingPhaseLedgerPath),
    baseline_schema_path: path.resolve(options.baselineSchemaPath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.baselineSchemaPath),
    drift_schema_path: path.resolve(options.driftSchemaPath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.driftSchemaPath),
    replay_window_schema_path: path.resolve(options.replayWindowSchemaPath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.replayWindowSchemaPath),
    operator_handoff_schema_path: path.resolve(options.operatorHandoffSchemaPath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.operatorHandoffSchemaPath),
    artifact_guard_schema_path: path.resolve(options.artifactGuardSchemaPath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.artifactGuardSchemaPath),
    provenance_ledger_schema_path: path.resolve(options.provenanceLedgerSchemaPath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.provenanceLedgerSchemaPath),
    release_bundle_provenance_schema_path: path.resolve(options.releaseBundleProvenanceSchemaPath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.releaseBundleProvenanceSchemaPath),
    signed_tag_provenance_schema_path: path.resolve(options.signedTagProvenanceSchemaPath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.signedTagProvenanceSchemaPath),
    provenance_freeze_preflight_schema_path: path.resolve(options.provenanceFreezePreflightSchemaPath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.provenanceFreezePreflightSchemaPath),
    provenance_freeze_schema_path: path.resolve(options.provenanceFreezeSchemaPath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.provenanceFreezeSchemaPath),
    mac_windows_replay_notes_schema_path: path.resolve(options.macWindowsReplayNotesSchemaPath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.macWindowsReplayNotesSchemaPath),
    gitignore_path: path.resolve(options.gitignorePath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.gitignorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.schemaPath),
  };
}

function parseNpmrc(text) {
  return Object.fromEntries(text.split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const [key, ...rest] = line.split("=");
      return [key.trim(), rest.join("=").trim()];
    }));
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
    validation_item_id: `platform-lockfile-policy.${slugify(itemPath)}.${checkId}`,
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
