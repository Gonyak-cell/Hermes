import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS,
  buildPlatformReplayHandoffMap,
} from "./platform-replay-handoff-map.mjs";

export const DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_OUT_DIR = "artifacts/platform-replay-evidence-checklist/latest";
export const DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS = {
  ...DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS,
  replayHandoffMapSchemaPath: DEFAULT_PLATFORM_REPLAY_HANDOFF_MAP_INPUTS.schemaPath,
  schemaPath: "schemas/platform-replay-evidence-checklist.schema.json",
};

const SCHEMA_VERSION = "platform-replay-evidence-checklist.v1";
const CAPABILITY_ID = "platform.replay_evidence_checklist";
const PHASE_SLOT = "P354";
const PREVIOUS_PHASE_SLOT = "P353";
const NEXT_PHASE_SLOT = "P355";

const EVIDENCE_SPECS = [
  ["runtime_baseline_check", "current_runtime_dependency", "platform:runtime-baseline -- --check", true],
  ["runtime_drift_check", "current_runtime_dependency", "platform:drift-check -- --check", true],
  ["contract_release_checks", "contract_release_gate", "contracts golden, contracts validate, release freeze checks", true],
  ["validate_test_checks", "validation_and_tests", "npm run validate and npm test outputs", false],
  ["artifact_regeneration_receipt", "artifact_regeneration", "control-plane loop manual replay receipt when artifacts are regenerated", false],
  ["cross_os_history_review", "cross_os_history", "P340 history baseline and Mac replay stabilization review notes", false],
  ["trading_safety_checks", "trading_safety", "trading validate, safety-check, and full-auto disabled checks", true],
  ["human_review_note", "all_replay_scopes", "human review note before replay closeout", false],
];

export async function runPlatformReplayEvidenceChecklist(options = {}) {
  const result = await buildPlatformReplayEvidenceChecklist(options);
  if (options.write !== false) await writePlatformReplayEvidenceChecklist(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform replay evidence checklist failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReplayEvidenceChecklist(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_OUT_DIR);
  const inputs = normalizeInputs(options);
  const replayHandoffMap = await buildPlatformReplayHandoffMap({
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
    lockfilePolicySchemaPath: inputs.lockfile_policy_schema_path,
    gitignorePath: inputs.gitignore_path,
    schemaPath: inputs.replay_handoff_map_schema_path,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const replayEvidenceAnchor = buildReplayEvidenceAnchor(replayHandoffMap);
  const replayEvidenceRows = buildReplayEvidenceRows(replayHandoffMap);
  const replayEvidenceGateRows = buildReplayEvidenceGateRows({ packageJson, platformOpsLedger, replayEvidenceRows, replayHandoffMap });
  const replayEvidenceBoundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    replayHandoffMap,
    packageJson,
    platformOpsLedger,
    replayEvidenceRows,
    replayEvidenceGateRows,
    replayEvidenceBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    replayHandoffMap,
    replayEvidenceRows,
    replayEvidenceGateRows,
    replayEvidenceBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_replay_evidence_checklist_id: `platform-replay-evidence-checklist.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    replay_evidence_anchor: replayEvidenceAnchor,
    replay_evidence_rows: replayEvidenceRows,
    replay_evidence_gate_rows: replayEvidenceGateRows,
    replay_evidence_boundary: replayEvidenceBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_replay_evidence_checklist") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    replayHandoffMap,
    replayEvidenceRows,
    replayEvidenceGateRows,
    replayEvidenceBoundary,
    validation: result.validation,
  });
  result.summary.platform_replay_evidence_checklist_id = result.platform_replay_evidence_checklist_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReplayEvidenceChecklist(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "platform-replay-evidence-checklist.json"), serializable);
  await writeJson(path.join(outDir, "replay-evidence-rows.json"), collectionEnvelope("platform-replay-evidence-rows.v1", "replay_evidence_rows", result.replay_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "replay-evidence-gate-rows.json"), collectionEnvelope("platform-replay-evidence-gate-rows.v1", "replay_evidence_gate_rows", result.replay_evidence_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "replay-evidence-boundary.json"), result.replay_evidence_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-replay-evidence-checklist-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReplayEvidenceChecklistCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReplayEvidenceChecklist(args);
    console.log(`Platform replay evidence checklist ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_replay_evidence_checklist_status}`);
    console.log(`Evidence rows: ${result.summary.ready_replay_evidence_count}/${result.summary.replay_evidence_count}`);
    console.log(`Evidence gates: ${result.summary.ready_replay_evidence_gate_count}/${result.summary.replay_evidence_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildReplayEvidenceAnchor(replayHandoffMap) {
  return {
    schema_version: "platform-replay-evidence-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_replay_handoff_map_id: replayHandoffMap.platform_replay_handoff_map_id,
    source_replay_handoff_map_status: replayHandoffMap.summary.platform_replay_handoff_map_status,
    source_replay_handoff_map_hash: hashValue({
      id: replayHandoffMap.platform_replay_handoff_map_id,
      status: replayHandoffMap.summary.platform_replay_handoff_map_status,
      handoff_rows: replayHandoffMap.summary.replay_handoff_count,
      gate_rows: replayHandoffMap.summary.replay_handoff_gate_count,
    }),
  };
}

function buildReplayEvidenceRows(replayHandoffMap) {
  const sourceReady = replayHandoffMap.validation.valid && replayHandoffMap.summary.platform_replay_handoff_map_status === "ready";
  return EVIDENCE_SPECS.map(([rowKey, replayScope, expectedEvidence, checkModePreferred], index) => {
    const row = {
      schema_version: "platform-replay-evidence-row.v1",
      replay_evidence_row_id: `platform-replay-evidence.row.${rowKey}`,
      phase_slot: PHASE_SLOT,
      row_key: rowKey,
      replay_scope: replayScope,
      expected_evidence: expectedEvidence,
      check_mode_preferred: checkModePreferred,
      replay_evidence_status: sourceReady ? "ready" : "blocked",
      evidence_collected_by_report: false,
      command_execution_performed_by_report: false,
      artifact_regeneration_performed_by_report: false,
      protected_action_executed_by_report: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "replay_evidence_hash");
  });
}

function buildReplayEvidenceGateRows({ packageJson, platformOpsLedger, replayEvidenceRows, replayHandoffMap }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p353_replay_handoff_map_ready", "P353 replay handoff map source is ready.", replayHandoffMap.validation.valid && replayHandoffMap.summary.platform_replay_handoff_map_status === "ready"),
    gateRow("platform_package_script_registered", "package.json registers the P354 replay evidence checklist command.", typeof scripts["platform:replay-evidence-checklist"] === "string" && scripts["platform:replay-evidence-checklist"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P354 replay evidence checklist.", validateScript.includes("npm run platform:replay-evidence-checklist -- --check")),
    gateRow("p354_ledger_acceptance_declared", "P354 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P354: `platform:replay-evidence-checklist`")),
    gateRow("replay_evidence_rows_ready", "All replay evidence rows are ready.", replayEvidenceRows.length >= 8 && replayEvidenceRows.every((row) => row.replay_evidence_status === "ready")),
    gateRow("no_evidence_collection_execution", "Evidence checklist collects no evidence and executes no commands.", true),
    gateRow("p355_next_phase_reserved", "P355 remains reserved for replay handoff closeout.", ledgerText.includes("P355") && ledgerText.includes("replay handoff")),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "replay_evidence_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-replay-evidence-gate-row.v1",
    replay_evidence_gate_row_id: `platform-replay-evidence.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    evidence_collected_by_report: false,
    command_execution_performed_by_report: false,
    artifact_regeneration_performed_by_report: false,
    git_operation_performed_by_report: false,
    protected_action_executed_by_report: false,
    trading_order_submission_performed_by_report: false,
    human_review_required: true,
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "platform-replay-evidence-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    evidence_collected: false,
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

function buildValidationItems({ replayHandoffMap, packageJson, platformOpsLedger, replayEvidenceRows, replayEvidenceGateRows, replayEvidenceBoundary }) {
  return [
    validationItem("source.replay_handoff_map", "p353_replay_handoff_map_ready", replayHandoffMap.validation.valid && replayHandoffMap.summary.platform_replay_handoff_map_status === "ready", "P353 replay handoff map source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P354 validation-chain checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("replay_evidence_rows", "replay_evidence_rows_ready", replayEvidenceRows.length >= 8 && replayEvidenceRows.every((row) => row.replay_evidence_status === "ready" && !row.evidence_collected_by_report && !row.command_execution_performed_by_report), "Replay evidence rows are ready and report-only."),
    validationItem("replay_evidence_gate_rows", "replay_evidence_gates_ready", replayEvidenceGateRows.length >= 7 && replayEvidenceGateRows.every((row) => row.gate_status === "ready" && !row.evidence_collected_by_report && !row.command_execution_performed_by_report), "P354 replay evidence gates are ready and report-only."),
    validationItem("boundary.read_only", "read_only_report", replayEvidenceBoundary.read_only && replayEvidenceBoundary.report_only && !replayEvidenceBoundary.evidence_collected && !replayEvidenceBoundary.command_execution_performed && !replayEvidenceBoundary.artifact_overwrite_performed, "Replay evidence checklist is read-only and does not collect evidence or overwrite artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !replayEvidenceBoundary.artifact_regeneration_performed && !replayEvidenceBoundary.history_import_performed && !replayEvidenceBoundary.repository_checkout_changed && !replayEvidenceBoundary.git_operation_performed && !replayEvidenceBoundary.protected_action_executed, "Replay evidence checklist performs no artifact, history, checkout, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !replayEvidenceBoundary.trading_live_enabled && !replayEvidenceBoundary.trading_full_auto_enabled && !replayEvidenceBoundary.trading_order_submission_allowed && !replayEvidenceBoundary.broker_write_allowed, "Trading live/full-auto/order submission and broker writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only_boundary", !replayEvidenceBoundary.desktop_source_of_truth && !replayEvidenceBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ replayHandoffMap, replayEvidenceRows, replayEvidenceGateRows, replayEvidenceBoundary, validation }) {
  return {
    platform_replay_evidence_checklist_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_replay_handoff_map_status: replayHandoffMap.summary.platform_replay_handoff_map_status,
    replay_evidence_count: replayEvidenceRows.length,
    ready_replay_evidence_count: replayEvidenceRows.filter((row) => row.replay_evidence_status === "ready").length,
    replay_evidence_gate_count: replayEvidenceGateRows.length,
    ready_replay_evidence_gate_count: replayEvidenceGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: replayEvidenceBoundary.read_only,
    report_only: replayEvidenceBoundary.report_only,
    evidence_collected: replayEvidenceBoundary.evidence_collected,
    command_execution_performed: replayEvidenceBoundary.command_execution_performed,
    dependency_install_performed: replayEvidenceBoundary.dependency_install_performed,
    package_mutation_performed: replayEvidenceBoundary.package_mutation_performed,
    lockfile_mutation_performed: replayEvidenceBoundary.lockfile_mutation_performed,
    artifact_overwrite_performed: replayEvidenceBoundary.artifact_overwrite_performed,
    artifact_regeneration_performed: replayEvidenceBoundary.artifact_regeneration_performed,
    history_import_performed: replayEvidenceBoundary.history_import_performed,
    repository_checkout_changed: replayEvidenceBoundary.repository_checkout_changed,
    git_operation_performed: replayEvidenceBoundary.git_operation_performed,
    release_published: replayEvidenceBoundary.release_published,
    recovery_execution_performed: replayEvidenceBoundary.recovery_execution_performed,
    protected_action_executed: replayEvidenceBoundary.protected_action_executed,
    approval_applied: replayEvidenceBoundary.approval_applied,
    desktop_source_of_truth: replayEvidenceBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: replayEvidenceBoundary.desktop_mutation_allowed,
    trading_live_enabled: replayEvidenceBoundary.trading_live_enabled,
    trading_full_auto_enabled: replayEvidenceBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: replayEvidenceBoundary.trading_order_submission_allowed,
    broker_write_allowed: replayEvidenceBoundary.broker_write_allowed,
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
    "# Platform Replay Evidence Checklist",
    "",
    `Status: ${result.summary.platform_replay_evidence_checklist_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source replay handoff map: ${result.summary.source_replay_handoff_map_status}`,
    `Evidence rows: ${result.summary.ready_replay_evidence_count}/${result.summary.replay_evidence_count}`,
    `Evidence gates: ${result.summary.ready_replay_evidence_gate_count}/${result.summary.replay_evidence_gate_count}`,
    "",
    "## Evidence Rows",
    "",
    ...result.replay_evidence_rows.map((row) => `- ${row.row_key}: ${row.replay_evidence_status}`),
    "",
    "## Evidence Gates",
    "",
    ...result.replay_evidence_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_OUT_DIR };
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
    else if (arg === "--replay-handoff-map-schema") parsed.replayHandoffMapSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/platform-replay-evidence-checklist.mjs [options]

Options:
  --out-dir <folder>                    Output directory. Default: ${DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_OUT_DIR}
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
  --replay-handoff-map-schema <path>    P353 replay handoff map schema path.
  --gitignore <path>                    .gitignore path.
  --schema <path>                       Output schema path.
  --check                               Validate only, do not write artifacts.
  -h, --help                            Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.packagePath),
    package_lock_path: path.resolve(options.packageLockPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.packageLockPath),
    nvmrc_path: path.resolve(options.nvmrcPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.nvmrcPath),
    node_version_path: path.resolve(options.nodeVersionPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.nodeVersionPath),
    npmrc_path: path.resolve(options.npmrcPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.npmrcPath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.platformOpsLedgerPath),
    trading_phase_ledger_path: path.resolve(options.tradingPhaseLedgerPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.tradingPhaseLedgerPath),
    baseline_schema_path: path.resolve(options.baselineSchemaPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.baselineSchemaPath),
    drift_schema_path: path.resolve(options.driftSchemaPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.driftSchemaPath),
    replay_window_schema_path: path.resolve(options.replayWindowSchemaPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.replayWindowSchemaPath),
    operator_handoff_schema_path: path.resolve(options.operatorHandoffSchemaPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.operatorHandoffSchemaPath),
    artifact_guard_schema_path: path.resolve(options.artifactGuardSchemaPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.artifactGuardSchemaPath),
    provenance_ledger_schema_path: path.resolve(options.provenanceLedgerSchemaPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.provenanceLedgerSchemaPath),
    release_bundle_provenance_schema_path: path.resolve(options.releaseBundleProvenanceSchemaPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.releaseBundleProvenanceSchemaPath),
    signed_tag_provenance_schema_path: path.resolve(options.signedTagProvenanceSchemaPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.signedTagProvenanceSchemaPath),
    provenance_freeze_preflight_schema_path: path.resolve(options.provenanceFreezePreflightSchemaPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.provenanceFreezePreflightSchemaPath),
    provenance_freeze_schema_path: path.resolve(options.provenanceFreezeSchemaPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.provenanceFreezeSchemaPath),
    mac_windows_replay_notes_schema_path: path.resolve(options.macWindowsReplayNotesSchemaPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.macWindowsReplayNotesSchemaPath),
    lockfile_policy_schema_path: path.resolve(options.lockfilePolicySchemaPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.lockfilePolicySchemaPath),
    replay_handoff_map_schema_path: path.resolve(options.replayHandoffMapSchemaPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.replayHandoffMapSchemaPath),
    gitignore_path: path.resolve(options.gitignorePath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.gitignorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_REPLAY_EVIDENCE_CHECKLIST_INPUTS.schemaPath),
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
    validation_item_id: `platform-replay-evidence-checklist.${slugify(itemPath)}.${checkId}`,
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
