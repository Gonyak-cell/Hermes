import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_PROVENANCE_FREEZE_INPUTS,
  buildPlatformProvenanceFreeze,
} from "./platform-provenance-freeze.mjs";

export const DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_OUT_DIR = "artifacts/platform-mac-windows-replay-notes/latest";
export const DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS = {
  ...DEFAULT_PLATFORM_PROVENANCE_FREEZE_INPUTS,
  provenanceFreezeSchemaPath: DEFAULT_PLATFORM_PROVENANCE_FREEZE_INPUTS.schemaPath,
  schemaPath: "schemas/platform-mac-windows-replay-notes.schema.json",
};

const SCHEMA_VERSION = "platform-mac-windows-replay-notes.v1";
const CAPABILITY_ID = "platform.mac_windows_replay_notes";
const PHASE_SLOT = "P351";
const PREVIOUS_PHASE_SLOT = "P350";
const NEXT_PHASE_SLOT = "P352";
const P340_BUNDLE_SHA256 = "1a1563a47e2f6704e0f25be56a4c74069863e97c6312e0b0348088ccd231051d";
const P340_HISTORY_BASELINE_COMMIT = "0abc97b";
const MAC_REPLAY_STABILIZATION_COMMIT = "8e4323d";

export async function runPlatformMacWindowsReplayNotes(options = {}) {
  const result = await buildPlatformMacWindowsReplayNotes(options);
  if (options.write !== false) await writePlatformMacWindowsReplayNotes(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform Mac/Windows replay notes failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformMacWindowsReplayNotes(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const provenanceFreeze = await buildPlatformProvenanceFreeze({
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
    gitignorePath: inputs.gitignore_path,
    schemaPath: inputs.provenance_freeze_schema_path,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const replayNotesAnchor = buildReplayNotesAnchor(provenanceFreeze);
  const replayNoteRows = buildReplayNoteRows({ platformOpsLedger, provenanceFreeze });
  const replayGateRows = buildReplayGateRows({ packageJson, platformOpsLedger, provenanceFreeze, replayNoteRows });
  const replayNotesBoundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    provenanceFreeze,
    packageJson,
    platformOpsLedger,
    replayNoteRows,
    replayGateRows,
    replayNotesBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    provenanceFreeze,
    replayNoteRows,
    replayGateRows,
    replayNotesBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_mac_windows_replay_notes_id: `platform-mac-windows-replay-notes.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    replay_notes_anchor: replayNotesAnchor,
    replay_note_rows: replayNoteRows,
    replay_gate_rows: replayGateRows,
    mac_windows_replay_boundary: replayNotesBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_mac_windows_replay_notes") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    provenanceFreeze,
    replayNoteRows,
    replayGateRows,
    replayNotesBoundary,
    validation: result.validation,
  });
  result.summary.platform_mac_windows_replay_notes_id = result.platform_mac_windows_replay_notes_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformMacWindowsReplayNotes(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "platform-mac-windows-replay-notes.json"), serializable);
  await writeJson(path.join(outDir, "replay-note-rows.json"), collectionEnvelope("platform-mac-windows-replay-note-rows.v1", "replay_note_rows", result.replay_note_rows, result.generated_at));
  await writeJson(path.join(outDir, "replay-gate-rows.json"), collectionEnvelope("platform-mac-windows-replay-gate-rows.v1", "replay_gate_rows", result.replay_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "mac-windows-replay-boundary.json"), result.mac_windows_replay_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-mac-windows-replay-notes-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformMacWindowsReplayNotesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformMacWindowsReplayNotes(args);
    console.log(`Platform Mac/Windows replay notes ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_mac_windows_replay_notes_status}`);
    console.log(`Replay notes: ${result.summary.ready_replay_note_count}/${result.summary.replay_note_count}`);
    console.log(`Replay gates: ${result.summary.ready_replay_gate_count}/${result.summary.replay_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildReplayNotesAnchor(provenanceFreeze) {
  return {
    schema_version: "platform-mac-windows-replay-notes-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_provenance_freeze_id: provenanceFreeze.platform_provenance_freeze_id,
    source_provenance_freeze_status: provenanceFreeze.summary.platform_provenance_freeze_status,
    p340_verified_bundle_sha256: P340_BUNDLE_SHA256,
    p340_history_baseline_commit: P340_HISTORY_BASELINE_COMMIT,
    mac_replay_stabilization_commit: MAC_REPLAY_STABILIZATION_COMMIT,
    source_provenance_freeze_hash: hashValue({
      id: provenanceFreeze.platform_provenance_freeze_id,
      status: provenanceFreeze.summary.platform_provenance_freeze_status,
      closure_rows: provenanceFreeze.summary.freeze_closure_count,
      gate_rows: provenanceFreeze.summary.freeze_gate_count,
    }),
  };
}

function buildReplayNoteRows({ platformOpsLedger, provenanceFreeze }) {
  const ledgerText = platformOpsLedger.text ?? "";
  const sourceReady = provenanceFreeze.validation.valid && provenanceFreeze.summary.platform_provenance_freeze_status === "ready";
  const rows = [
    noteRow("p340_verified_transfer_bundle", "Verified P340 transfer bundle hash is recorded for Mac replay context.", ledgerText.includes(P340_BUNDLE_SHA256), { evidence_value: P340_BUNDLE_SHA256 }),
    noteRow("windows_history_bundle_review", "Windows history-bundle import remains a human-reviewed history decision, not an automatic replay action.", ledgerText.includes(P340_HISTORY_BASELINE_COMMIT), { evidence_value: P340_HISTORY_BASELINE_COMMIT }),
    noteRow("mac_replay_stabilization_commit", "Mac replay stabilization commit is recorded as evidence, not a command to rerun.", ledgerText.includes(MAC_REPLAY_STABILIZATION_COMMIT), { evidence_value: MAC_REPLAY_STABILIZATION_COMMIT }),
    noteRow("cross_os_history_separation", "Cross-OS history replay stays separate from current runtime drift checks.", ledgerText.includes("cross-OS history"), { evidence_value: "cross-OS history" }),
    noteRow("artifact_regeneration_manual_only", "Ignored artifact regeneration remains an explicit operator replay step only.", ledgerText.includes("artifact-regeneration") || ledgerText.includes("artifact regeneration"), { evidence_value: "artifact regeneration" }),
    noteRow("lockfile_policy_handoff", "Lockfile policy remains documented for the P351-P355 operator handoff sequence without lockfile mutation.", ledgerText.includes("lockfile policy"), { evidence_value: "lockfile policy" }),
  ];
  return rows.map((row, index) => withOrdinalAndHash({ ...row, replay_note_status: sourceReady && row.replay_note_status === "ready" ? "ready" : "blocked" }, index, "replay_note_hash"));
}

function noteRow(rowKey, description, passed, details = {}) {
  return {
    schema_version: "platform-mac-windows-replay-note-row.v1",
    replay_note_row_id: `platform-mac-windows-replay-notes.note.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    replay_note_status: passed ? "ready" : "blocked",
    os_scope: "mac_windows",
    note_only: true,
    history_import_performed_by_report: false,
    repository_checkout_changed_by_report: false,
    lockfile_mutation_performed_by_report: false,
    artifact_regeneration_performed_by_report: false,
    command_execution_performed_by_report: false,
    human_review_required: true,
    ...details,
  };
}

function buildReplayGateRows({ packageJson, platformOpsLedger, provenanceFreeze, replayNoteRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const commandRegistered = typeof scripts["platform:mac-windows-replay-notes"] === "string" && scripts["platform:mac-windows-replay-notes"].length > 0;
  const validateRegistered = validateScript.includes("npm run platform:mac-windows-replay-notes -- --check");
  const rows = [
    gateRow("p350_provenance_freeze_ready", "P350 provenance freeze source is ready.", provenanceFreeze.validation.valid && provenanceFreeze.summary.platform_provenance_freeze_status === "ready"),
    gateRow("platform_package_script_registered", "package.json registers the P351 Mac/Windows replay notes command.", commandRegistered),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P351 Mac/Windows replay notes check.", validateRegistered),
    gateRow("p351_ledger_acceptance_declared", "P351 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P351: `platform:mac-windows-replay-notes`")),
    gateRow("replay_notes_ready", "All Mac/Windows replay note rows are ready.", replayNoteRows.length >= 6 && replayNoteRows.every((row) => row.replay_note_status === "ready")),
    gateRow("no_cross_os_mutation", "Replay notes perform no history import, checkout change, artifact regeneration, or lockfile mutation.", true),
    gateRow("p352_next_phase_reserved", "P352 remains reserved for lockfile policy detail.", ledgerText.includes("P352") && ledgerText.includes("lockfile")),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "replay_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-mac-windows-replay-gate-row.v1",
    replay_gate_row_id: `platform-mac-windows-replay-notes.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    command_execution_performed_by_report: false,
    history_import_performed_by_report: false,
    repository_checkout_changed_by_report: false,
    lockfile_mutation_performed_by_report: false,
    artifact_regeneration_performed_by_report: false,
    protected_action_executed_by_report: false,
    human_review_required: true,
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "platform-mac-windows-replay-boundary.v1",
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

function buildValidationItems({ provenanceFreeze, packageJson, platformOpsLedger, replayNoteRows, replayGateRows, replayNotesBoundary }) {
  return [
    validationItem("source.provenance_freeze", "p350_provenance_freeze_ready", provenanceFreeze.validation.valid && provenanceFreeze.summary.platform_provenance_freeze_status === "ready", "P350 provenance freeze source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P351 validation-chain checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("replay_note_rows", "replay_notes_ready", replayNoteRows.length >= 6 && replayNoteRows.every((row) => row.replay_note_status === "ready" && row.note_only && !row.history_import_performed_by_report && !row.lockfile_mutation_performed_by_report), "Mac/Windows replay notes are ready and note-only."),
    validationItem("replay_gate_rows", "replay_gates_ready", replayGateRows.length >= 7 && replayGateRows.every((row) => row.gate_status === "ready" && !row.history_import_performed_by_report && !row.lockfile_mutation_performed_by_report), "P351 replay note gates are ready and report-only."),
    validationItem("boundary.read_only", "read_only_report", replayNotesBoundary.read_only && replayNotesBoundary.report_only && !replayNotesBoundary.command_execution_performed && !replayNotesBoundary.package_mutation_performed && !replayNotesBoundary.artifact_overwrite_performed, "Mac/Windows replay notes are read-only and do not overwrite artifacts."),
    validationItem("boundary.no_cross_os_mutation", "no_cross_os_mutation", !replayNotesBoundary.history_import_performed && !replayNotesBoundary.repository_checkout_changed && !replayNotesBoundary.lockfile_mutation_performed && !replayNotesBoundary.artifact_regeneration_performed, "Replay notes do not import history, change checkout state, mutate lockfiles, or regenerate artifacts."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !replayNotesBoundary.trading_live_enabled && !replayNotesBoundary.trading_full_auto_enabled && !replayNotesBoundary.trading_order_submission_allowed && !replayNotesBoundary.broker_write_allowed, "Trading live/full-auto/order submission and broker writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only_boundary", !replayNotesBoundary.desktop_source_of_truth && !replayNotesBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ provenanceFreeze, replayNoteRows, replayGateRows, replayNotesBoundary, validation }) {
  return {
    platform_mac_windows_replay_notes_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_provenance_freeze_status: provenanceFreeze.summary.platform_provenance_freeze_status,
    replay_note_count: replayNoteRows.length,
    ready_replay_note_count: replayNoteRows.filter((row) => row.replay_note_status === "ready").length,
    replay_gate_count: replayGateRows.length,
    ready_replay_gate_count: replayGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: replayNotesBoundary.read_only,
    report_only: replayNotesBoundary.report_only,
    command_execution_performed: replayNotesBoundary.command_execution_performed,
    dependency_install_performed: replayNotesBoundary.dependency_install_performed,
    package_mutation_performed: replayNotesBoundary.package_mutation_performed,
    lockfile_mutation_performed: replayNotesBoundary.lockfile_mutation_performed,
    artifact_overwrite_performed: replayNotesBoundary.artifact_overwrite_performed,
    artifact_regeneration_performed: replayNotesBoundary.artifact_regeneration_performed,
    history_import_performed: replayNotesBoundary.history_import_performed,
    repository_checkout_changed: replayNotesBoundary.repository_checkout_changed,
    git_operation_performed: replayNotesBoundary.git_operation_performed,
    release_published: replayNotesBoundary.release_published,
    recovery_execution_performed: replayNotesBoundary.recovery_execution_performed,
    protected_action_executed: replayNotesBoundary.protected_action_executed,
    approval_applied: replayNotesBoundary.approval_applied,
    desktop_source_of_truth: replayNotesBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: replayNotesBoundary.desktop_mutation_allowed,
    trading_live_enabled: replayNotesBoundary.trading_live_enabled,
    trading_full_auto_enabled: replayNotesBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: replayNotesBoundary.trading_order_submission_allowed,
    broker_write_allowed: replayNotesBoundary.broker_write_allowed,
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
    "# Platform Mac/Windows Replay Notes",
    "",
    `Status: ${result.summary.platform_mac_windows_replay_notes_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source provenance freeze: ${result.summary.source_provenance_freeze_status}`,
    `Replay notes: ${result.summary.ready_replay_note_count}/${result.summary.replay_note_count}`,
    `Replay gates: ${result.summary.ready_replay_gate_count}/${result.summary.replay_gate_count}`,
    "",
    "## Replay Notes",
    "",
    ...result.replay_note_rows.map((row) => `- ${row.row_key}: ${row.replay_note_status}`),
    "",
    "## Replay Gates",
    "",
    ...result.replay_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_OUT_DIR };
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
  console.log(`Usage: node scripts/platform-mac-windows-replay-notes.mjs [options]

Options:
  --out-dir <folder>                    Output directory. Default: ${DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_OUT_DIR}
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
  --gitignore <path>                    .gitignore path.
  --schema <path>                       Output schema path.
  --check                               Validate only, do not write artifacts.
  -h, --help                            Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.packagePath),
    package_lock_path: path.resolve(options.packageLockPath ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.packageLockPath),
    nvmrc_path: path.resolve(options.nvmrcPath ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.nvmrcPath),
    node_version_path: path.resolve(options.nodeVersionPath ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.nodeVersionPath),
    npmrc_path: path.resolve(options.npmrcPath ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.npmrcPath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.platformOpsLedgerPath),
    trading_phase_ledger_path: path.resolve(options.tradingPhaseLedgerPath ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.tradingPhaseLedgerPath),
    baseline_schema_path: path.resolve(options.baselineSchemaPath ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.baselineSchemaPath),
    drift_schema_path: path.resolve(options.driftSchemaPath ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.driftSchemaPath),
    replay_window_schema_path: path.resolve(options.replayWindowSchemaPath ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.replayWindowSchemaPath),
    operator_handoff_schema_path: path.resolve(options.operatorHandoffSchemaPath ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.operatorHandoffSchemaPath),
    artifact_guard_schema_path: path.resolve(options.artifactGuardSchemaPath ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.artifactGuardSchemaPath),
    provenance_ledger_schema_path: path.resolve(options.provenanceLedgerSchemaPath ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.provenanceLedgerSchemaPath),
    release_bundle_provenance_schema_path: path.resolve(options.releaseBundleProvenanceSchemaPath ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.releaseBundleProvenanceSchemaPath),
    signed_tag_provenance_schema_path: path.resolve(options.signedTagProvenanceSchemaPath ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.signedTagProvenanceSchemaPath),
    provenance_freeze_preflight_schema_path: path.resolve(options.provenanceFreezePreflightSchemaPath ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.provenanceFreezePreflightSchemaPath),
    provenance_freeze_schema_path: path.resolve(options.provenanceFreezeSchemaPath ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.provenanceFreezeSchemaPath),
    gitignore_path: path.resolve(options.gitignorePath ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.gitignorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_MAC_WINDOWS_REPLAY_NOTES_INPUTS.schemaPath),
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
    validation_item_id: `platform-mac-windows-replay-notes.${slugify(itemPath)}.${checkId}`,
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
