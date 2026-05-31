import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_REPLAY_HANDOFF_CLOSEOUT_INPUTS,
  buildPlatformReplayHandoffCloseout,
} from "./platform-replay-handoff-closeout.mjs";

export const DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_OUT_DIR = "artifacts/platform-reproducibility-check-registry/latest";
export const DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS = {
  ...DEFAULT_PLATFORM_REPLAY_HANDOFF_CLOSEOUT_INPUTS,
  replayHandoffCloseoutSchemaPath: DEFAULT_PLATFORM_REPLAY_HANDOFF_CLOSEOUT_INPUTS.schemaPath,
  schemaPath: "schemas/platform-reproducibility-check-registry.schema.json",
};

const SCHEMA_VERSION = "platform-reproducibility-check-registry.v1";
const CAPABILITY_ID = "platform.reproducibility_check_registry";
const PHASE_SLOT = "P356";
const PREVIOUS_PHASE_SLOT = "P355";
const NEXT_PHASE_SLOT = "P357";

const REPRODUCIBILITY_CHECKS = [
  ["P341", "platform:runtime-baseline", "npm run platform:runtime-baseline -- --check", "runtime_dependency_baseline"],
  ["P342", "platform:drift-check", "npm run platform:drift-check -- --check", "runtime_dependency_drift"],
  ["P343", "platform:replay-window", "npm run platform:replay-window -- --check", "runtime_replay_window"],
  ["P344", "platform:operator-handoff", "npm run platform:operator-handoff -- --check", "operator_handoff"],
  ["P345", "platform:artifact-guard", "npm run platform:artifact-guard -- --check", "artifact_guard"],
  ["P346", "platform:provenance-ledger", "npm run platform:provenance-ledger -- --check", "provenance_ledger"],
  ["P347", "platform:release-bundle-provenance", "npm run platform:release-bundle-provenance -- --check", "release_bundle_provenance"],
  ["P348", "platform:signed-tag-provenance", "npm run platform:signed-tag-provenance -- --check", "signed_tag_provenance"],
  ["P349", "platform:provenance-freeze-preflight", "npm run platform:provenance-freeze-preflight -- --check", "provenance_freeze_preflight"],
  ["P350", "platform:provenance-freeze", "npm run platform:provenance-freeze -- --check", "provenance_freeze"],
  ["P351", "platform:mac-windows-replay-notes", "npm run platform:mac-windows-replay-notes -- --check", "cross_os_replay_notes"],
  ["P352", "platform:lockfile-policy", "npm run platform:lockfile-policy -- --check", "lockfile_policy"],
  ["P353", "platform:replay-handoff-map", "npm run platform:replay-handoff-map -- --check", "replay_handoff_map"],
  ["P354", "platform:replay-evidence-checklist", "npm run platform:replay-evidence-checklist -- --check", "replay_evidence_checklist"],
  ["P355", "platform:replay-handoff-closeout", "npm run platform:replay-handoff-closeout -- --check", "replay_handoff_closeout"],
  ["P356", "platform:reproducibility-check-registry", "npm run platform:reproducibility-check-registry -- --check", "reproducibility_check_registry"],
];

const FUTURE_RELEASE_CHECKS = [
  ["trading_release_check", "trading:release-check", "P361-P380", "Trading release-check composes the Trading Pack validation stack."],
  ["platform_ops_check", "platform:ops-check", "P361-P380", "Platform ops-check composes platform runtime, contract, control-plane, and registry health checks."],
  ["platform_release_check", "platform:release-check", "P361-P380", "Platform release-check composes platform, trading, validation, test, contract, and freeze checks."],
];

export async function runPlatformReproducibilityCheckRegistry(options = {}) {
  const result = await buildPlatformReproducibilityCheckRegistry(options);
  if (options.write !== false) await writePlatformReproducibilityCheckRegistry(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform reproducibility check registry failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReproducibilityCheckRegistry(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const replayHandoffCloseout = await buildPlatformReplayHandoffCloseout({
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
    replayHandoffMapSchemaPath: inputs.replay_handoff_map_schema_path,
    replayEvidenceChecklistSchemaPath: inputs.replay_evidence_checklist_schema_path,
    gitignorePath: inputs.gitignore_path,
    schemaPath: inputs.replay_handoff_closeout_schema_path,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const registryAnchor = buildRegistryAnchor(replayHandoffCloseout);
  const reproducibilityCheckRows = buildReproducibilityCheckRows({ packageJson, replayHandoffCloseout });
  const releaseChainBridgeRows = buildReleaseChainBridgeRows({ platformOpsLedger });
  const reproducibilityGateRows = buildReproducibilityGateRows({
    replayHandoffCloseout,
    packageJson,
    platformOpsLedger,
    reproducibilityCheckRows,
    releaseChainBridgeRows,
  });
  const reproducibilityBoundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    replayHandoffCloseout,
    packageJson,
    platformOpsLedger,
    reproducibilityCheckRows,
    releaseChainBridgeRows,
    reproducibilityGateRows,
    reproducibilityBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    replayHandoffCloseout,
    reproducibilityCheckRows,
    releaseChainBridgeRows,
    reproducibilityGateRows,
    reproducibilityBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_reproducibility_check_registry_id: `platform-reproducibility-check-registry.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    reproducibility_registry_anchor: registryAnchor,
    reproducibility_check_rows: reproducibilityCheckRows,
    release_chain_bridge_rows: releaseChainBridgeRows,
    reproducibility_gate_rows: reproducibilityGateRows,
    reproducibility_boundary: reproducibilityBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_reproducibility_check_registry") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    replayHandoffCloseout,
    reproducibilityCheckRows,
    releaseChainBridgeRows,
    reproducibilityGateRows,
    reproducibilityBoundary,
    validation: result.validation,
  });
  result.summary.platform_reproducibility_check_registry_id = result.platform_reproducibility_check_registry_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReproducibilityCheckRegistry(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "platform-reproducibility-check-registry.json"), serializable);
  await writeJson(path.join(outDir, "reproducibility-check-rows.json"), collectionEnvelope("platform-reproducibility-check-rows.v1", "reproducibility_check_rows", result.reproducibility_check_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-chain-bridge-rows.json"), collectionEnvelope("platform-release-chain-bridge-rows.v1", "release_chain_bridge_rows", result.release_chain_bridge_rows, result.generated_at));
  await writeJson(path.join(outDir, "reproducibility-gate-rows.json"), collectionEnvelope("platform-reproducibility-gate-rows.v1", "reproducibility_gate_rows", result.reproducibility_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "reproducibility-boundary.json"), result.reproducibility_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-reproducibility-check-registry-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReproducibilityCheckRegistryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReproducibilityCheckRegistry(args);
    console.log(`Platform reproducibility check registry ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_reproducibility_check_registry_status}`);
    console.log(`Reproducibility checks: ${result.summary.ready_reproducibility_check_count}/${result.summary.reproducibility_check_count}`);
    console.log(`Release-chain bridges: ${result.summary.ready_release_chain_bridge_count}/${result.summary.release_chain_bridge_count}`);
    console.log(`Registry gates: ${result.summary.ready_reproducibility_gate_count}/${result.summary.reproducibility_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildRegistryAnchor(replayHandoffCloseout) {
  return {
    schema_version: "platform-reproducibility-check-registry-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_replay_handoff_closeout_id: replayHandoffCloseout.platform_replay_handoff_closeout_id,
    source_replay_handoff_closeout_status: replayHandoffCloseout.summary.platform_replay_handoff_closeout_status,
    source_replay_handoff_closeout_hash: hashValue({
      id: replayHandoffCloseout.platform_replay_handoff_closeout_id,
      status: replayHandoffCloseout.summary.platform_replay_handoff_closeout_status,
      closeout_rows: replayHandoffCloseout.summary.closeout_count,
      gate_rows: replayHandoffCloseout.summary.closeout_gate_count,
    }),
  };
}

function buildReproducibilityCheckRows({ packageJson, replayHandoffCloseout }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const sourceReady = replayHandoffCloseout.validation.valid && replayHandoffCloseout.summary.platform_replay_handoff_closeout_status === "ready";
  return REPRODUCIBILITY_CHECKS.map(([sourcePhaseSlot, packageScriptName, checkCommand, checkScope], index) => {
    const packageScriptRegistered = typeof scripts[packageScriptName] === "string" && scripts[packageScriptName].length > 0;
    const validationChainRegistered = validateScript.includes(checkCommand);
    const checkStatus = sourceReady && packageScriptRegistered && validationChainRegistered ? "ready" : "blocked";
    const row = {
      schema_version: "platform-reproducibility-check-row.v1",
      reproducibility_check_row_id: `platform-reproducibility-check-registry.row.${sourcePhaseSlot.toLowerCase()}`,
      phase_slot: PHASE_SLOT,
      source_phase_slot: sourcePhaseSlot,
      check_scope: checkScope,
      package_script_name: packageScriptName,
      check_command: checkCommand,
      reproducibility_check_status: checkStatus,
      package_script_registered: packageScriptRegistered,
      validation_chain_registered: validationChainRegistered,
      check_mode_required: true,
      command_execution_performed_by_report: false,
      artifact_regeneration_performed_by_report: false,
      protected_action_executed_by_report: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "reproducibility_check_hash");
  });
}

function buildReleaseChainBridgeRows({ platformOpsLedger }) {
  const ledgerText = platformOpsLedger.text ?? "";
  return FUTURE_RELEASE_CHECKS.map(([rowKey, packageScriptName, targetPhaseRange, description], index) => {
    const ledgerDeclared = ledgerText.includes(packageScriptName) && ledgerText.includes(targetPhaseRange);
    const row = {
      schema_version: "platform-release-chain-bridge-row.v1",
      release_chain_bridge_row_id: `platform-reproducibility-check-registry.release.${rowKey}`,
      phase_slot: PHASE_SLOT,
      row_key: rowKey,
      package_script_name: packageScriptName,
      target_phase_range: targetPhaseRange,
      description,
      release_chain_bridge_status: ledgerDeclared ? "ready" : "blocked",
      ledger_declared: ledgerDeclared,
      package_script_required_now: false,
      release_check_execution_performed_by_report: false,
      command_execution_performed_by_report: false,
      protected_action_executed_by_report: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "release_chain_bridge_hash");
  });
}

function buildReproducibilityGateRows({ replayHandoffCloseout, packageJson, platformOpsLedger, reproducibilityCheckRows, releaseChainBridgeRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p355_replay_handoff_closeout_ready", "P355 replay handoff closeout source is ready.", replayHandoffCloseout.validation.valid && replayHandoffCloseout.summary.platform_replay_handoff_closeout_status === "ready"),
    gateRow("platform_package_script_registered", "package.json registers the P356 reproducibility check registry command.", typeof scripts["platform:reproducibility-check-registry"] === "string" && scripts["platform:reproducibility-check-registry"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P356 reproducibility check registry.", validateScript.includes("npm run platform:reproducibility-check-registry -- --check")),
    gateRow("p356_ledger_acceptance_declared", "P356 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P356: `platform:reproducibility-check-registry`")),
    gateRow("reproducibility_checks_registered", "P341-P356 reproducibility checks are registered in package scripts and validation.", reproducibilityCheckRows.length >= 16 && reproducibilityCheckRows.every((row) => row.reproducibility_check_status === "ready")),
    gateRow("future_release_check_bridge_declared", "Future P361-P380 release-check bridge remains declared without requiring future scripts now.", releaseChainBridgeRows.length >= 3 && releaseChainBridgeRows.every((row) => row.release_chain_bridge_status === "ready" && row.package_script_required_now === false)),
    gateRow("p357_next_phase_reserved", "P357 owns reproducibility evidence matrix, P358 owns proof index, and P359-P360 remains reserved.", ledgerText.includes("P357: `platform:reproducibility-evidence-matrix`") && ledgerText.includes("P358: `platform:reproducibility-proof-index`") && ledgerText.includes("P359-P360") && ledgerText.includes("reproducibility")),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "reproducibility_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-reproducibility-gate-row.v1",
    reproducibility_gate_row_id: `platform-reproducibility-check-registry.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    command_execution_performed_by_report: false,
    release_check_execution_performed_by_report: false,
    artifact_regeneration_performed_by_report: false,
    git_operation_performed_by_report: false,
    protected_action_executed_by_report: false,
    trading_order_submission_performed_by_report: false,
    human_review_required: true,
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "platform-reproducibility-check-registry-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    command_execution_performed: false,
    release_check_execution_performed: false,
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
    human_review_required_for_reproducibility: true,
  };
}

function buildValidationItems({ replayHandoffCloseout, packageJson, platformOpsLedger, reproducibilityCheckRows, releaseChainBridgeRows, reproducibilityGateRows, reproducibilityBoundary }) {
  return [
    validationItem("source.replay_handoff_closeout", "p355_replay_handoff_closeout_ready", replayHandoffCloseout.validation.valid && replayHandoffCloseout.summary.platform_replay_handoff_closeout_status === "ready", "P355 replay handoff closeout source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P356 reproducibility check registration."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("reproducibility_check_rows", "reproducibility_checks_ready", reproducibilityCheckRows.length >= 16 && reproducibilityCheckRows.every((row) => row.reproducibility_check_status === "ready" && row.check_mode_required && !row.command_execution_performed_by_report), "P341-P356 reproducibility check rows are registered and report-only."),
    validationItem("release_chain_bridge_rows", "future_release_bridge_ready", releaseChainBridgeRows.length >= 3 && releaseChainBridgeRows.every((row) => row.release_chain_bridge_status === "ready" && !row.package_script_required_now && !row.release_check_execution_performed_by_report), "Future release-check bridge rows are declared without requiring future scripts now."),
    validationItem("reproducibility_gate_rows", "reproducibility_gates_ready", reproducibilityGateRows.length >= 7 && reproducibilityGateRows.every((row) => row.gate_status === "ready" && !row.command_execution_performed_by_report), "P356 reproducibility registry gates are ready and report-only."),
    validationItem("boundary.read_only", "read_only_report", reproducibilityBoundary.read_only && reproducibilityBoundary.report_only && !reproducibilityBoundary.command_execution_performed && !reproducibilityBoundary.release_check_execution_performed && !reproducibilityBoundary.artifact_overwrite_performed, "Reproducibility registry is read-only and does not run checks or overwrite artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !reproducibilityBoundary.artifact_regeneration_performed && !reproducibilityBoundary.history_import_performed && !reproducibilityBoundary.repository_checkout_changed && !reproducibilityBoundary.git_operation_performed && !reproducibilityBoundary.protected_action_executed, "Reproducibility registry performs no artifact, history, checkout, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !reproducibilityBoundary.trading_live_enabled && !reproducibilityBoundary.trading_full_auto_enabled && !reproducibilityBoundary.trading_order_submission_allowed && !reproducibilityBoundary.broker_write_allowed, "Trading live/full-auto/order submission and broker writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only_boundary", !reproducibilityBoundary.desktop_source_of_truth && !reproducibilityBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ replayHandoffCloseout, reproducibilityCheckRows, releaseChainBridgeRows, reproducibilityGateRows, reproducibilityBoundary, validation }) {
  return {
    platform_reproducibility_check_registry_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_replay_handoff_closeout_status: replayHandoffCloseout.summary.platform_replay_handoff_closeout_status,
    reproducibility_check_count: reproducibilityCheckRows.length,
    ready_reproducibility_check_count: reproducibilityCheckRows.filter((row) => row.reproducibility_check_status === "ready").length,
    release_chain_bridge_count: releaseChainBridgeRows.length,
    ready_release_chain_bridge_count: releaseChainBridgeRows.filter((row) => row.release_chain_bridge_status === "ready").length,
    reproducibility_gate_count: reproducibilityGateRows.length,
    ready_reproducibility_gate_count: reproducibilityGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: reproducibilityBoundary.read_only,
    report_only: reproducibilityBoundary.report_only,
    command_execution_performed: reproducibilityBoundary.command_execution_performed,
    release_check_execution_performed: reproducibilityBoundary.release_check_execution_performed,
    dependency_install_performed: reproducibilityBoundary.dependency_install_performed,
    package_mutation_performed: reproducibilityBoundary.package_mutation_performed,
    lockfile_mutation_performed: reproducibilityBoundary.lockfile_mutation_performed,
    artifact_overwrite_performed: reproducibilityBoundary.artifact_overwrite_performed,
    artifact_regeneration_performed: reproducibilityBoundary.artifact_regeneration_performed,
    history_import_performed: reproducibilityBoundary.history_import_performed,
    repository_checkout_changed: reproducibilityBoundary.repository_checkout_changed,
    git_operation_performed: reproducibilityBoundary.git_operation_performed,
    release_published: reproducibilityBoundary.release_published,
    recovery_execution_performed: reproducibilityBoundary.recovery_execution_performed,
    protected_action_executed: reproducibilityBoundary.protected_action_executed,
    approval_applied: reproducibilityBoundary.approval_applied,
    desktop_source_of_truth: reproducibilityBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: reproducibilityBoundary.desktop_mutation_allowed,
    trading_live_enabled: reproducibilityBoundary.trading_live_enabled,
    trading_full_auto_enabled: reproducibilityBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: reproducibilityBoundary.trading_order_submission_allowed,
    broker_write_allowed: reproducibilityBoundary.broker_write_allowed,
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
    "# Platform Reproducibility Check Registry",
    "",
    `Status: ${result.summary.platform_reproducibility_check_registry_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source replay handoff closeout: ${result.summary.source_replay_handoff_closeout_status}`,
    `Reproducibility checks: ${result.summary.ready_reproducibility_check_count}/${result.summary.reproducibility_check_count}`,
    `Release-chain bridges: ${result.summary.ready_release_chain_bridge_count}/${result.summary.release_chain_bridge_count}`,
    `Registry gates: ${result.summary.ready_reproducibility_gate_count}/${result.summary.reproducibility_gate_count}`,
    "",
    "## Reproducibility Checks",
    "",
    ...result.reproducibility_check_rows.map((row) => `- ${row.source_phase_slot} ${row.package_script_name}: ${row.reproducibility_check_status}`),
    "",
    "## Release-Chain Bridges",
    "",
    ...result.release_chain_bridge_rows.map((row) => `- ${row.package_script_name}: ${row.release_chain_bridge_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_OUT_DIR };
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
    else if (arg === "--replay-evidence-checklist-schema") parsed.replayEvidenceChecklistSchemaPath = argv[++index];
    else if (arg === "--replay-handoff-closeout-schema") parsed.replayHandoffCloseoutSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/platform-reproducibility-check-registry.mjs [options]

Options:
  --out-dir <folder>                    Output directory. Default: ${DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_OUT_DIR}
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
  --replay-evidence-checklist-schema <path> P354 replay evidence checklist schema path.
  --replay-handoff-closeout-schema <path> P355 replay handoff closeout schema path.
  --gitignore <path>                    .gitignore path.
  --schema <path>                       Output schema path.
  --check                               Validate only, do not write artifacts.
  -h, --help                            Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.packagePath),
    package_lock_path: path.resolve(options.packageLockPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.packageLockPath),
    nvmrc_path: path.resolve(options.nvmrcPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.nvmrcPath),
    node_version_path: path.resolve(options.nodeVersionPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.nodeVersionPath),
    npmrc_path: path.resolve(options.npmrcPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.npmrcPath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.platformOpsLedgerPath),
    trading_phase_ledger_path: path.resolve(options.tradingPhaseLedgerPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.tradingPhaseLedgerPath),
    baseline_schema_path: path.resolve(options.baselineSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.baselineSchemaPath),
    drift_schema_path: path.resolve(options.driftSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.driftSchemaPath),
    replay_window_schema_path: path.resolve(options.replayWindowSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.replayWindowSchemaPath),
    operator_handoff_schema_path: path.resolve(options.operatorHandoffSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.operatorHandoffSchemaPath),
    artifact_guard_schema_path: path.resolve(options.artifactGuardSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.artifactGuardSchemaPath),
    provenance_ledger_schema_path: path.resolve(options.provenanceLedgerSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.provenanceLedgerSchemaPath),
    release_bundle_provenance_schema_path: path.resolve(options.releaseBundleProvenanceSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.releaseBundleProvenanceSchemaPath),
    signed_tag_provenance_schema_path: path.resolve(options.signedTagProvenanceSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.signedTagProvenanceSchemaPath),
    provenance_freeze_preflight_schema_path: path.resolve(options.provenanceFreezePreflightSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.provenanceFreezePreflightSchemaPath),
    provenance_freeze_schema_path: path.resolve(options.provenanceFreezeSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.provenanceFreezeSchemaPath),
    mac_windows_replay_notes_schema_path: path.resolve(options.macWindowsReplayNotesSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.macWindowsReplayNotesSchemaPath),
    lockfile_policy_schema_path: path.resolve(options.lockfilePolicySchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.lockfilePolicySchemaPath),
    replay_handoff_map_schema_path: path.resolve(options.replayHandoffMapSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.replayHandoffMapSchemaPath),
    replay_evidence_checklist_schema_path: path.resolve(options.replayEvidenceChecklistSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.replayEvidenceChecklistSchemaPath),
    replay_handoff_closeout_schema_path: path.resolve(options.replayHandoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.replayHandoffCloseoutSchemaPath),
    gitignore_path: path.resolve(options.gitignorePath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.gitignorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.schemaPath),
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
    validation_item_id: `platform-reproducibility-check-registry.${slugify(itemPath)}.${checkId}`,
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
