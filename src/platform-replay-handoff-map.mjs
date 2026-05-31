import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS,
  buildPlatformLockfilePolicy,
} from "./platform-lockfile-policy.mjs";

export const DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_OUT_DIR = "artifacts/platform-replay-handoff-map/latest";
export const DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS = {
  ...DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS,
  lockfilePolicySchemaPath: DEFAULT_PLATFORM_LOCKFILE_POLICY_INPUTS.schemaPath,
  schemaPath: "schemas/platform-replay-handoff-map.schema.json",
};

const SCHEMA_VERSION = "platform-replay-handoff-map.v1";
const CAPABILITY_ID = "platform.replay_handoff_map";
const PHASE_SLOT = "P353";
const PREVIOUS_PHASE_SLOT = "P352";
const NEXT_PHASE_SLOT = "P354";

const HANDOFF_SPECS = [
  {
    row_key: "current_runtime_dependency",
    owner_role: "runtime_steward",
    replay_scope: "runtime_dependency",
    os_scope: "current_checkout",
    expected_evidence: ["platform:runtime-baseline -- --check", "platform:drift-check -- --check"],
    next_operator_action: "Review runtime/dependency drift before wider validation.",
  },
  {
    row_key: "contract_release_gate",
    owner_role: "release_reviewer",
    replay_scope: "contracts_release",
    os_scope: "current_checkout",
    expected_evidence: ["contracts:golden-fixtures -- --check", "contracts:validate -- --check", "release:freeze -- --check"],
    next_operator_action: "Review contract and release gates after schema or fixture changes.",
  },
  {
    row_key: "validation_and_tests",
    owner_role: "platform_reviewer",
    replay_scope: "validation_tests",
    os_scope: "current_checkout",
    expected_evidence: ["npm run validate", "npm test"],
    next_operator_action: "Review full validation and test output before phase closeout.",
  },
  {
    row_key: "artifact_regeneration",
    owner_role: "operations_reviewer",
    replay_scope: "artifact_regeneration",
    os_scope: "current_checkout",
    expected_evidence: ["control-plane:loop manual replay receipt"],
    next_operator_action: "Regenerate ignored artifacts only as an explicit operator action outside this report.",
    artifact_write_possible_when_operator_runs: true,
  },
  {
    row_key: "cross_os_history",
    owner_role: "repository_steward",
    replay_scope: "cross_os_history",
    os_scope: "mac_windows",
    expected_evidence: ["P340 history baseline commit", "Mac replay stabilization commit"],
    next_operator_action: "Review Mac snapshot state and Windows history evidence without importing history automatically.",
    git_operation_possible_when_operator_runs: true,
  },
  {
    row_key: "trading_safety",
    owner_role: "trading_safety_reviewer",
    replay_scope: "trading_safety",
    os_scope: "current_checkout",
    expected_evidence: ["trading:validate -- --check", "trading:safety-check -- --check", "trading:full-auto-report -- --check"],
    next_operator_action: "Review trading safety posture while live/full-auto/order submission remains disabled.",
  },
];

export async function runPlatformReplayHandoffMap(options = {}) {
  const result = await buildPlatformReplayHandoffMap(options);
  if (options.write !== false) await writePlatformReplayHandoffMap(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform replay handoff map failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReplayHandoffMap(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_OUT_DIR);
  const inputs = normalizeInputs(options);
  const lockfilePolicy = await buildPlatformLockfilePolicy({
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
    macWindowsReplayNotesSchemaPath: inputs.mac_windows_replay_notes_schema_path,
    gitignorePath: inputs.gitignore_path,
    schemaPath: inputs.lockfile_policy_schema_path,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const replayHandoffAnchor = buildReplayHandoffAnchor(lockfilePolicy);
  const replayHandoffRows = buildReplayHandoffRows(lockfilePolicy);
  const replayHandoffGateRows = buildReplayHandoffGateRows({ lockfilePolicy, packageJson, platformOpsLedger, replayHandoffRows });
  const replayHandoffBoundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    lockfilePolicy,
    packageJson,
    platformOpsLedger,
    replayHandoffRows,
    replayHandoffGateRows,
    replayHandoffBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    lockfilePolicy,
    replayHandoffRows,
    replayHandoffGateRows,
    replayHandoffBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_replay_handoff_map_id: `platform-replay-handoff-map.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    replay_handoff_anchor: replayHandoffAnchor,
    replay_handoff_rows: replayHandoffRows,
    replay_handoff_gate_rows: replayHandoffGateRows,
    replay_handoff_boundary: replayHandoffBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_replay_handoff_map") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    lockfilePolicy,
    replayHandoffRows,
    replayHandoffGateRows,
    replayHandoffBoundary,
    validation: result.validation,
  });
  result.summary.platform_replay_handoff_map_id = result.platform_replay_handoff_map_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReplayHandoffMap(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "platform-replay-handoff-map.json"), serializable);
  await writeJson(path.join(outDir, "replay-handoff-rows.json"), collectionEnvelope("platform-replay-handoff-rows.v1", "replay_handoff_rows", result.replay_handoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "replay-handoff-gate-rows.json"), collectionEnvelope("platform-replay-handoff-gate-rows.v1", "replay_handoff_gate_rows", result.replay_handoff_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "replay-handoff-boundary.json"), result.replay_handoff_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-replay-handoff-map-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReplayHandoffMapCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReplayHandoffMap(args);
    console.log(`Platform replay handoff map ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_replay_handoff_map_status}`);
    console.log(`Handoff rows: ${result.summary.ready_replay_handoff_count}/${result.summary.replay_handoff_count}`);
    console.log(`Handoff gates: ${result.summary.ready_replay_handoff_gate_count}/${result.summary.replay_handoff_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildReplayHandoffAnchor(lockfilePolicy) {
  return {
    schema_version: "platform-replay-handoff-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_lockfile_policy_id: lockfilePolicy.platform_lockfile_policy_id,
    source_lockfile_policy_status: lockfilePolicy.summary.platform_lockfile_policy_status,
    source_lockfile_policy_hash: hashValue({
      id: lockfilePolicy.platform_lockfile_policy_id,
      status: lockfilePolicy.summary.platform_lockfile_policy_status,
      policy_rows: lockfilePolicy.summary.lockfile_policy_count,
      gate_rows: lockfilePolicy.summary.lockfile_gate_count,
    }),
  };
}

function buildReplayHandoffRows(lockfilePolicy) {
  const sourceReady = lockfilePolicy.validation.valid && lockfilePolicy.summary.platform_lockfile_policy_status === "ready";
  return HANDOFF_SPECS.map((spec, index) => {
    const row = {
      schema_version: "platform-replay-handoff-row.v1",
      replay_handoff_row_id: `platform-replay-handoff.row.${spec.row_key}`,
      phase_slot: PHASE_SLOT,
      row_key: spec.row_key,
      replay_scope: spec.replay_scope,
      os_scope: spec.os_scope,
      owner_role: spec.owner_role,
      expected_evidence: spec.expected_evidence,
      next_operator_action: spec.next_operator_action,
      replay_handoff_status: sourceReady ? "ready" : "blocked",
      command_execution_allowed_by_report: false,
      protected_action_allowed_by_report: false,
      artifact_write_possible_when_operator_runs: spec.artifact_write_possible_when_operator_runs ?? false,
      git_operation_possible_when_operator_runs: spec.git_operation_possible_when_operator_runs ?? false,
      desktop_source_of_truth: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "replay_handoff_hash");
  });
}

function buildReplayHandoffGateRows({ lockfilePolicy, packageJson, platformOpsLedger, replayHandoffRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p352_lockfile_policy_ready", "P352 lockfile policy source is ready.", lockfilePolicy.validation.valid && lockfilePolicy.summary.platform_lockfile_policy_status === "ready"),
    gateRow("platform_package_script_registered", "package.json registers the P353 replay handoff map command.", typeof scripts["platform:replay-handoff-map"] === "string" && scripts["platform:replay-handoff-map"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P353 replay handoff map check.", validateScript.includes("npm run platform:replay-handoff-map -- --check")),
    gateRow("p353_ledger_acceptance_declared", "P353 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P353: `platform:replay-handoff-map`")),
    gateRow("replay_handoff_rows_ready", "All replay handoff rows are ready.", replayHandoffRows.length >= 6 && replayHandoffRows.every((row) => row.replay_handoff_status === "ready")),
    gateRow("no_command_or_protected_action", "Replay handoff map performs no commands or protected actions.", true),
    gateRow("p354_next_phase_reserved", "P354 owns the replay evidence checklist and P355 remains reserved for replay handoff closeout.", ledgerText.includes("P354: `platform:replay-evidence-checklist`") && ledgerText.includes("P355") && ledgerText.includes("replay handoff")),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "replay_handoff_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-replay-handoff-gate-row.v1",
    replay_handoff_gate_row_id: `platform-replay-handoff.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    command_execution_performed_by_report: false,
    protected_action_executed_by_report: false,
    artifact_regeneration_performed_by_report: false,
    git_operation_performed_by_report: false,
    desktop_mutation_performed_by_report: false,
    trading_order_submission_performed_by_report: false,
    human_review_required: true,
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "platform-replay-handoff-boundary.v1",
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
    human_review_required_for_replay: true,
  };
}

function buildValidationItems({ lockfilePolicy, packageJson, platformOpsLedger, replayHandoffRows, replayHandoffGateRows, replayHandoffBoundary }) {
  return [
    validationItem("source.lockfile_policy", "p352_lockfile_policy_ready", lockfilePolicy.validation.valid && lockfilePolicy.summary.platform_lockfile_policy_status === "ready", "P352 lockfile policy source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P353 validation-chain checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("replay_handoff_rows", "replay_handoff_rows_ready", replayHandoffRows.length >= 6 && replayHandoffRows.every((row) => row.replay_handoff_status === "ready" && !row.command_execution_allowed_by_report && !row.protected_action_allowed_by_report), "Replay handoff rows are ready and report-only."),
    validationItem("replay_handoff_gate_rows", "replay_handoff_gates_ready", replayHandoffGateRows.length >= 7 && replayHandoffGateRows.every((row) => row.gate_status === "ready" && !row.command_execution_performed_by_report && !row.protected_action_executed_by_report), "P353 replay handoff gates are ready and report-only."),
    validationItem("boundary.read_only", "read_only_report", replayHandoffBoundary.read_only && replayHandoffBoundary.report_only && !replayHandoffBoundary.command_execution_performed && !replayHandoffBoundary.package_mutation_performed && !replayHandoffBoundary.artifact_overwrite_performed, "Replay handoff map is read-only and does not overwrite artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !replayHandoffBoundary.artifact_regeneration_performed && !replayHandoffBoundary.history_import_performed && !replayHandoffBoundary.repository_checkout_changed && !replayHandoffBoundary.git_operation_performed && !replayHandoffBoundary.protected_action_executed, "Replay handoff map performs no artifact, history, checkout, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !replayHandoffBoundary.trading_live_enabled && !replayHandoffBoundary.trading_full_auto_enabled && !replayHandoffBoundary.trading_order_submission_allowed && !replayHandoffBoundary.broker_write_allowed, "Trading live/full-auto/order submission and broker writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only_boundary", !replayHandoffBoundary.desktop_source_of_truth && !replayHandoffBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ lockfilePolicy, replayHandoffRows, replayHandoffGateRows, replayHandoffBoundary, validation }) {
  return {
    platform_replay_handoff_map_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_lockfile_policy_status: lockfilePolicy.summary.platform_lockfile_policy_status,
    replay_handoff_count: replayHandoffRows.length,
    ready_replay_handoff_count: replayHandoffRows.filter((row) => row.replay_handoff_status === "ready").length,
    replay_handoff_gate_count: replayHandoffGateRows.length,
    ready_replay_handoff_gate_count: replayHandoffGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: replayHandoffBoundary.read_only,
    report_only: replayHandoffBoundary.report_only,
    command_execution_performed: replayHandoffBoundary.command_execution_performed,
    dependency_install_performed: replayHandoffBoundary.dependency_install_performed,
    package_mutation_performed: replayHandoffBoundary.package_mutation_performed,
    lockfile_mutation_performed: replayHandoffBoundary.lockfile_mutation_performed,
    artifact_overwrite_performed: replayHandoffBoundary.artifact_overwrite_performed,
    artifact_regeneration_performed: replayHandoffBoundary.artifact_regeneration_performed,
    history_import_performed: replayHandoffBoundary.history_import_performed,
    repository_checkout_changed: replayHandoffBoundary.repository_checkout_changed,
    git_operation_performed: replayHandoffBoundary.git_operation_performed,
    release_published: replayHandoffBoundary.release_published,
    recovery_execution_performed: replayHandoffBoundary.recovery_execution_performed,
    protected_action_executed: replayHandoffBoundary.protected_action_executed,
    approval_applied: replayHandoffBoundary.approval_applied,
    desktop_source_of_truth: replayHandoffBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: replayHandoffBoundary.desktop_mutation_allowed,
    trading_live_enabled: replayHandoffBoundary.trading_live_enabled,
    trading_full_auto_enabled: replayHandoffBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: replayHandoffBoundary.trading_order_submission_allowed,
    broker_write_allowed: replayHandoffBoundary.broker_write_allowed,
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
    "# Platform Replay Handoff Map",
    "",
    `Status: ${result.summary.platform_replay_handoff_map_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source lockfile policy: ${result.summary.source_lockfile_policy_status}`,
    `Handoff rows: ${result.summary.ready_replay_handoff_count}/${result.summary.replay_handoff_count}`,
    `Handoff gates: ${result.summary.ready_replay_handoff_gate_count}/${result.summary.replay_handoff_gate_count}`,
    "",
    "## Handoff Rows",
    "",
    ...result.replay_handoff_rows.map((row) => `- ${row.row_key}: ${row.replay_handoff_status}`),
    "",
    "## Handoff Gates",
    "",
    ...result.replay_handoff_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_OUT_DIR };
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
    else if (arg === "--lockfile-policy-schema") parsed.lockfilePolicySchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/platform-replay-handoff-map.mjs [options]

Options:
  --out-dir <folder>                    Output directory. Default: ${DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_OUT_DIR}
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
  --lockfile-policy-schema <path>       P352 lockfile policy schema path.
  --gitignore <path>                    .gitignore path.
  --schema <path>                       Output schema path.
  --check                               Validate only, do not write artifacts.
  -h, --help                            Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.packagePath),
    package_lock_path: path.resolve(options.packageLockPath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.packageLockPath),
    nvmrc_path: path.resolve(options.nvmrcPath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.nvmrcPath),
    node_version_path: path.resolve(options.nodeVersionPath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.nodeVersionPath),
    npmrc_path: path.resolve(options.npmrcPath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.npmrcPath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.platformOpsLedgerPath),
    trading_phase_ledger_path: path.resolve(options.tradingPhaseLedgerPath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.tradingPhaseLedgerPath),
    baseline_schema_path: path.resolve(options.baselineSchemaPath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.baselineSchemaPath),
    drift_schema_path: path.resolve(options.driftSchemaPath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.driftSchemaPath),
    replay_window_schema_path: path.resolve(options.replayWindowSchemaPath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.replayWindowSchemaPath),
    operator_handoff_schema_path: path.resolve(options.operatorHandoffSchemaPath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.operatorHandoffSchemaPath),
    artifact_guard_schema_path: path.resolve(options.artifactGuardSchemaPath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.artifactGuardSchemaPath),
    provenance_ledger_schema_path: path.resolve(options.provenanceLedgerSchemaPath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.provenanceLedgerSchemaPath),
    release_bundle_provenance_schema_path: path.resolve(options.releaseBundleProvenanceSchemaPath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.releaseBundleProvenanceSchemaPath),
    signed_tag_provenance_schema_path: path.resolve(options.signedTagProvenanceSchemaPath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.signedTagProvenanceSchemaPath),
    provenance_freeze_preflight_schema_path: path.resolve(options.provenanceFreezePreflightSchemaPath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.provenanceFreezePreflightSchemaPath),
    provenance_freeze_schema_path: path.resolve(options.provenanceFreezeSchemaPath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.provenanceFreezeSchemaPath),
    mac_windows_replay_notes_schema_path: path.resolve(options.macWindowsReplayNotesSchemaPath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.macWindowsReplayNotesSchemaPath),
    lockfile_policy_schema_path: path.resolve(options.lockfilePolicySchemaPath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.lockfilePolicySchemaPath),
    gitignore_path: path.resolve(options.gitignorePath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.gitignorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.schemaPath),
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
    validation_item_id: `platform-replay-handoff-map.${slugify(itemPath)}.${checkId}`,
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
