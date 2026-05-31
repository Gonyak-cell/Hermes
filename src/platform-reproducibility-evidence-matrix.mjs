import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS,
  buildPlatformReproducibilityCheckRegistry,
} from "./platform-reproducibility-check-registry.mjs";

export const DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_OUT_DIR = "artifacts/platform-reproducibility-evidence-matrix/latest";
export const DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS = {
  ...DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS,
  reproducibilityCheckRegistrySchemaPath: DEFAULT_PLATFORM_REPRODUCIBILITY_CHECK_REGISTRY_INPUTS.schemaPath,
  schemaPath: "schemas/platform-reproducibility-evidence-matrix.schema.json",
};

const SCHEMA_VERSION = "platform-reproducibility-evidence-matrix.v1";
const CAPABILITY_ID = "platform.reproducibility_evidence_matrix";
const PHASE_SLOT = "P357";
const PREVIOUS_PHASE_SLOT = "P356";
const NEXT_PHASE_SLOT = "P358";

const EVIDENCE_MATRIX_SPECS = [
  {
    rowKey: "runtime_dependency_sources",
    evidenceScope: "runtime_dependency_reproducibility",
    sourcePhaseSlots: ["P341", "P342"],
    supportingPackageScriptNames: ["platform:runtime-baseline", "platform:drift-check"],
    expectedEvidence: "Runtime baseline and drift check summaries with package/runtime fingerprints.",
  },
  {
    rowKey: "replay_operator_sources",
    evidenceScope: "replay_operator_readiness",
    sourcePhaseSlots: ["P343", "P344", "P345"],
    supportingPackageScriptNames: ["platform:replay-window", "platform:operator-handoff", "platform:artifact-guard"],
    expectedEvidence: "Replay windows, operator handoff packets, and artifact guard no-overwrite policy.",
  },
  {
    rowKey: "provenance_freeze_sources",
    evidenceScope: "provenance_freeze_readiness",
    sourcePhaseSlots: ["P346", "P347", "P348", "P349", "P350"],
    supportingPackageScriptNames: ["platform:provenance-ledger", "platform:release-bundle-provenance", "platform:signed-tag-provenance", "platform:provenance-freeze-preflight", "platform:provenance-freeze"],
    expectedEvidence: "P340 bundle provenance, release bundle policy, signed-tag policy, and freeze closeout rows.",
  },
  {
    rowKey: "replay_handoff_sources",
    evidenceScope: "cross_os_replay_handoff_readiness",
    sourcePhaseSlots: ["P351", "P352", "P353", "P354", "P355"],
    supportingPackageScriptNames: ["platform:mac-windows-replay-notes", "platform:lockfile-policy", "platform:replay-handoff-map", "platform:replay-evidence-checklist", "platform:replay-handoff-closeout"],
    expectedEvidence: "Mac/Windows replay notes, lockfile policy, handoff map, evidence checklist, and closeout readiness.",
  },
  {
    rowKey: "reproducibility_registry_source",
    evidenceScope: "p356_registry_readiness",
    sourcePhaseSlots: ["P356"],
    supportingPackageScriptNames: ["platform:reproducibility-check-registry"],
    expectedEvidence: "P341-P356 check registration rows and future release-chain bridge rows.",
  },
  {
    rowKey: "domain_pack_validation",
    evidenceScope: "domain_pack_registry_health",
    sourcePhaseSlots: [],
    supportingPackageScriptNames: ["packs:validate"],
    expectedEvidence: "Domain pack registry validation output with pack and capability counts.",
  },
  {
    rowKey: "contract_release_freeze",
    evidenceScope: "contract_release_readiness",
    sourcePhaseSlots: [],
    supportingPackageScriptNames: ["contracts:golden-fixtures", "contracts:validate", "release:freeze"],
    expectedEvidence: "Golden fixture, contract validation, and release freeze check summaries.",
  },
  {
    rowKey: "validate_test_control_loop",
    evidenceScope: "validation_test_control_plane",
    sourcePhaseSlots: [],
    supportingPackageScriptNames: ["validate", "test", "control-plane:loop"],
    expectedEvidence: "Full validation, local test, and control-plane loop summaries.",
  },
  {
    rowKey: "future_release_check_bridge",
    evidenceScope: "future_release_check_chain",
    sourcePhaseSlots: [],
    supportingPackageScriptNames: [],
    expectedEvidence: "P361-P380 trading, platform ops, and platform release-check bridge declarations.",
    futureReleaseBridgeRequired: true,
  },
  {
    rowKey: "human_review_note",
    evidenceScope: "human_review_closeout",
    sourcePhaseSlots: [],
    supportingPackageScriptNames: [],
    expectedEvidence: "Human review note before claiming reproducibility evidence complete.",
  },
];

export async function runPlatformReproducibilityEvidenceMatrix(options = {}) {
  const result = await buildPlatformReproducibilityEvidenceMatrix(options);
  if (options.write !== false) await writePlatformReproducibilityEvidenceMatrix(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform reproducibility evidence matrix failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReproducibilityEvidenceMatrix(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_OUT_DIR);
  const inputs = normalizeInputs(options);
  const reproducibilityCheckRegistry = await buildPlatformReproducibilityCheckRegistry({
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
    replayHandoffCloseoutSchemaPath: inputs.replay_handoff_closeout_schema_path,
    gitignorePath: inputs.gitignore_path,
    schemaPath: inputs.reproducibility_check_registry_schema_path,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const matrixAnchor = buildMatrixAnchor(reproducibilityCheckRegistry);
  const evidenceMatrixRows = buildEvidenceMatrixRows({ packageJson, reproducibilityCheckRegistry });
  const evidenceGateRows = buildEvidenceGateRows({
    reproducibilityCheckRegistry,
    packageJson,
    platformOpsLedger,
    evidenceMatrixRows,
  });
  const evidenceBoundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    reproducibilityCheckRegistry,
    packageJson,
    platformOpsLedger,
    evidenceMatrixRows,
    evidenceGateRows,
    evidenceBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    reproducibilityCheckRegistry,
    evidenceMatrixRows,
    evidenceGateRows,
    evidenceBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_reproducibility_evidence_matrix_id: `platform-reproducibility-evidence-matrix.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    reproducibility_evidence_anchor: matrixAnchor,
    reproducibility_evidence_rows: evidenceMatrixRows,
    reproducibility_evidence_gate_rows: evidenceGateRows,
    reproducibility_evidence_boundary: evidenceBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_reproducibility_evidence_matrix") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    reproducibilityCheckRegistry,
    evidenceMatrixRows,
    evidenceGateRows,
    evidenceBoundary,
    validation: result.validation,
  });
  result.summary.platform_reproducibility_evidence_matrix_id = result.platform_reproducibility_evidence_matrix_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReproducibilityEvidenceMatrix(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "platform-reproducibility-evidence-matrix.json"), serializable);
  await writeJson(path.join(outDir, "reproducibility-evidence-rows.json"), collectionEnvelope("platform-reproducibility-evidence-rows.v1", "reproducibility_evidence_rows", result.reproducibility_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "reproducibility-evidence-gate-rows.json"), collectionEnvelope("platform-reproducibility-evidence-gate-rows.v1", "reproducibility_evidence_gate_rows", result.reproducibility_evidence_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "reproducibility-evidence-boundary.json"), result.reproducibility_evidence_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-reproducibility-evidence-matrix-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReproducibilityEvidenceMatrixCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReproducibilityEvidenceMatrix(args);
    console.log(`Platform reproducibility evidence matrix ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_reproducibility_evidence_matrix_status}`);
    console.log(`Evidence rows: ${result.summary.ready_reproducibility_evidence_count}/${result.summary.reproducibility_evidence_count}`);
    console.log(`Evidence gates: ${result.summary.ready_reproducibility_evidence_gate_count}/${result.summary.reproducibility_evidence_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildMatrixAnchor(reproducibilityCheckRegistry) {
  return {
    schema_version: "platform-reproducibility-evidence-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_reproducibility_check_registry_id: reproducibilityCheckRegistry.platform_reproducibility_check_registry_id,
    source_reproducibility_check_registry_status: reproducibilityCheckRegistry.summary.platform_reproducibility_check_registry_status,
    source_reproducibility_check_registry_hash: hashValue({
      id: reproducibilityCheckRegistry.platform_reproducibility_check_registry_id,
      status: reproducibilityCheckRegistry.summary.platform_reproducibility_check_registry_status,
      reproducibility_checks: reproducibilityCheckRegistry.summary.reproducibility_check_count,
      release_chain_bridges: reproducibilityCheckRegistry.summary.release_chain_bridge_count,
    }),
  };
}

function buildEvidenceMatrixRows({ packageJson, reproducibilityCheckRegistry }) {
  const scripts = packageJson.data?.scripts ?? {};
  const sourceReady = reproducibilityCheckRegistry.validation.valid && reproducibilityCheckRegistry.summary.platform_reproducibility_check_registry_status === "ready";
  const readyPhaseSlots = new Set(
    reproducibilityCheckRegistry.reproducibility_check_rows
      .filter((row) => row.reproducibility_check_status === "ready")
      .map((row) => row.source_phase_slot),
  );
  const futureReleaseBridgeReady = reproducibilityCheckRegistry.release_chain_bridge_rows.every((row) => row.release_chain_bridge_status === "ready");
  return EVIDENCE_MATRIX_SPECS.map((spec, index) => {
    const sourcePhaseSlotsReady = spec.sourcePhaseSlots.every((phaseSlot) => readyPhaseSlots.has(phaseSlot));
    const supportingScriptsRegistered = spec.supportingPackageScriptNames.every((scriptName) => typeof scripts[scriptName] === "string" && scripts[scriptName].length > 0);
    const futureBridgeRequired = spec.futureReleaseBridgeRequired === true;
    const evidenceReady = sourceReady && sourcePhaseSlotsReady && supportingScriptsRegistered && (!futureBridgeRequired || futureReleaseBridgeReady);
    const row = {
      schema_version: "platform-reproducibility-evidence-row.v1",
      reproducibility_evidence_row_id: `platform-reproducibility-evidence-matrix.row.${spec.rowKey}`,
      phase_slot: PHASE_SLOT,
      row_key: spec.rowKey,
      evidence_scope: spec.evidenceScope,
      expected_evidence: spec.expectedEvidence,
      source_phase_slots: spec.sourcePhaseSlots,
      source_phase_slots_ready: sourcePhaseSlotsReady,
      supporting_package_script_names: spec.supportingPackageScriptNames,
      supporting_package_scripts_registered: supportingScriptsRegistered,
      future_release_bridge_required: futureBridgeRequired,
      future_release_bridge_ready: futureReleaseBridgeReady,
      reproducibility_evidence_status: evidenceReady ? "ready" : "blocked",
      evidence_collected_by_report: false,
      command_execution_performed_by_report: false,
      release_check_execution_performed_by_report: false,
      artifact_regeneration_performed_by_report: false,
      protected_action_executed_by_report: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "reproducibility_evidence_hash");
  });
}

function buildEvidenceGateRows({ reproducibilityCheckRegistry, packageJson, platformOpsLedger, evidenceMatrixRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p356_registry_ready", "P356 reproducibility check registry source is ready.", reproducibilityCheckRegistry.validation.valid && reproducibilityCheckRegistry.summary.platform_reproducibility_check_registry_status === "ready"),
    gateRow("platform_package_script_registered", "package.json registers the P357 reproducibility evidence matrix command.", typeof scripts["platform:reproducibility-evidence-matrix"] === "string" && scripts["platform:reproducibility-evidence-matrix"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P357 reproducibility evidence matrix.", validateScript.includes("npm run platform:reproducibility-evidence-matrix -- --check")),
    gateRow("p357_ledger_acceptance_declared", "P357 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P357: `platform:reproducibility-evidence-matrix`")),
    gateRow("reproducibility_evidence_rows_ready", "All reproducibility evidence expectation rows are ready.", evidenceMatrixRows.length >= 10 && evidenceMatrixRows.every((row) => row.reproducibility_evidence_status === "ready")),
    gateRow("future_release_check_bridge_preserved", "Future release-check bridge remains declared and no future release-check command is executed.", reproducibilityCheckRegistry.release_chain_bridge_rows.length >= 3 && reproducibilityCheckRegistry.release_chain_bridge_rows.every((row) => row.release_chain_bridge_status === "ready" && row.package_script_required_now === false)),
    gateRow("no_evidence_collection_execution", "Evidence matrix records expectations without collecting evidence or running commands.", true),
    gateRow("p358_next_phase_reserved", "P358-P360 remains reserved for reproducibility proof, operator review, and closeout checks.", ledgerText.includes("P358-P360") && ledgerText.includes("reproducibility")),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "reproducibility_evidence_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-reproducibility-evidence-gate-row.v1",
    reproducibility_evidence_gate_row_id: `platform-reproducibility-evidence-matrix.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    evidence_collected_by_report: false,
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
    schema_version: "platform-reproducibility-evidence-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    evidence_collected: false,
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

function buildValidationItems({ reproducibilityCheckRegistry, packageJson, platformOpsLedger, evidenceMatrixRows, evidenceGateRows, evidenceBoundary }) {
  return [
    validationItem("source.reproducibility_check_registry", "p356_registry_ready", reproducibilityCheckRegistry.validation.valid && reproducibilityCheckRegistry.summary.platform_reproducibility_check_registry_status === "ready", "P356 reproducibility check registry source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P357 evidence matrix checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("reproducibility_evidence_rows", "evidence_rows_ready", evidenceMatrixRows.length >= 10 && evidenceMatrixRows.every((row) => row.reproducibility_evidence_status === "ready" && !row.evidence_collected_by_report && !row.command_execution_performed_by_report), "Reproducibility evidence expectation rows are ready and report-only."),
    validationItem("reproducibility_evidence_gate_rows", "evidence_gates_ready", evidenceGateRows.length >= 8 && evidenceGateRows.every((row) => row.gate_status === "ready" && !row.evidence_collected_by_report && !row.command_execution_performed_by_report), "P357 reproducibility evidence gates are ready and report-only."),
    validationItem("boundary.read_only", "read_only_report", evidenceBoundary.read_only && evidenceBoundary.report_only && !evidenceBoundary.evidence_collected && !evidenceBoundary.command_execution_performed && !evidenceBoundary.release_check_execution_performed && !evidenceBoundary.artifact_overwrite_performed, "Reproducibility evidence matrix is read-only and does not collect evidence, run checks, or overwrite artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !evidenceBoundary.artifact_regeneration_performed && !evidenceBoundary.history_import_performed && !evidenceBoundary.repository_checkout_changed && !evidenceBoundary.git_operation_performed && !evidenceBoundary.protected_action_executed, "Reproducibility evidence matrix performs no artifact, history, checkout, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !evidenceBoundary.trading_live_enabled && !evidenceBoundary.trading_full_auto_enabled && !evidenceBoundary.trading_order_submission_allowed && !evidenceBoundary.broker_write_allowed, "Trading live/full-auto/order submission and broker writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only_boundary", !evidenceBoundary.desktop_source_of_truth && !evidenceBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ reproducibilityCheckRegistry, evidenceMatrixRows, evidenceGateRows, evidenceBoundary, validation }) {
  return {
    platform_reproducibility_evidence_matrix_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_reproducibility_check_registry_status: reproducibilityCheckRegistry.summary.platform_reproducibility_check_registry_status,
    reproducibility_evidence_count: evidenceMatrixRows.length,
    ready_reproducibility_evidence_count: evidenceMatrixRows.filter((row) => row.reproducibility_evidence_status === "ready").length,
    reproducibility_evidence_gate_count: evidenceGateRows.length,
    ready_reproducibility_evidence_gate_count: evidenceGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: evidenceBoundary.read_only,
    report_only: evidenceBoundary.report_only,
    evidence_collected: evidenceBoundary.evidence_collected,
    command_execution_performed: evidenceBoundary.command_execution_performed,
    release_check_execution_performed: evidenceBoundary.release_check_execution_performed,
    dependency_install_performed: evidenceBoundary.dependency_install_performed,
    package_mutation_performed: evidenceBoundary.package_mutation_performed,
    lockfile_mutation_performed: evidenceBoundary.lockfile_mutation_performed,
    artifact_overwrite_performed: evidenceBoundary.artifact_overwrite_performed,
    artifact_regeneration_performed: evidenceBoundary.artifact_regeneration_performed,
    history_import_performed: evidenceBoundary.history_import_performed,
    repository_checkout_changed: evidenceBoundary.repository_checkout_changed,
    git_operation_performed: evidenceBoundary.git_operation_performed,
    release_published: evidenceBoundary.release_published,
    recovery_execution_performed: evidenceBoundary.recovery_execution_performed,
    protected_action_executed: evidenceBoundary.protected_action_executed,
    approval_applied: evidenceBoundary.approval_applied,
    desktop_source_of_truth: evidenceBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: evidenceBoundary.desktop_mutation_allowed,
    trading_live_enabled: evidenceBoundary.trading_live_enabled,
    trading_full_auto_enabled: evidenceBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: evidenceBoundary.trading_order_submission_allowed,
    broker_write_allowed: evidenceBoundary.broker_write_allowed,
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
    "# Platform Reproducibility Evidence Matrix",
    "",
    `Status: ${result.summary.platform_reproducibility_evidence_matrix_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source reproducibility check registry: ${result.summary.source_reproducibility_check_registry_status}`,
    `Evidence rows: ${result.summary.ready_reproducibility_evidence_count}/${result.summary.reproducibility_evidence_count}`,
    `Evidence gates: ${result.summary.ready_reproducibility_evidence_gate_count}/${result.summary.reproducibility_evidence_gate_count}`,
    "",
    "## Evidence Rows",
    "",
    ...result.reproducibility_evidence_rows.map((row) => `- ${row.row_key}: ${row.reproducibility_evidence_status}`),
    "",
    "## Evidence Gates",
    "",
    ...result.reproducibility_evidence_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_OUT_DIR };
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
    else if (arg === "--reproducibility-check-registry-schema") parsed.reproducibilityCheckRegistrySchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/platform-reproducibility-evidence-matrix.mjs [options]

Options:
  --out-dir <folder>                    Output directory. Default: ${DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_OUT_DIR}
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
  --reproducibility-check-registry-schema <path> P356 check registry schema path.
  --gitignore <path>                    .gitignore path.
  --schema <path>                       Output schema path.
  --check                               Validate only, do not write artifacts.
  -h, --help                            Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.packagePath),
    package_lock_path: path.resolve(options.packageLockPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.packageLockPath),
    nvmrc_path: path.resolve(options.nvmrcPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.nvmrcPath),
    node_version_path: path.resolve(options.nodeVersionPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.nodeVersionPath),
    npmrc_path: path.resolve(options.npmrcPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.npmrcPath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.platformOpsLedgerPath),
    trading_phase_ledger_path: path.resolve(options.tradingPhaseLedgerPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.tradingPhaseLedgerPath),
    baseline_schema_path: path.resolve(options.baselineSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.baselineSchemaPath),
    drift_schema_path: path.resolve(options.driftSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.driftSchemaPath),
    replay_window_schema_path: path.resolve(options.replayWindowSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.replayWindowSchemaPath),
    operator_handoff_schema_path: path.resolve(options.operatorHandoffSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.operatorHandoffSchemaPath),
    artifact_guard_schema_path: path.resolve(options.artifactGuardSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.artifactGuardSchemaPath),
    provenance_ledger_schema_path: path.resolve(options.provenanceLedgerSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.provenanceLedgerSchemaPath),
    release_bundle_provenance_schema_path: path.resolve(options.releaseBundleProvenanceSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.releaseBundleProvenanceSchemaPath),
    signed_tag_provenance_schema_path: path.resolve(options.signedTagProvenanceSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.signedTagProvenanceSchemaPath),
    provenance_freeze_preflight_schema_path: path.resolve(options.provenanceFreezePreflightSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.provenanceFreezePreflightSchemaPath),
    provenance_freeze_schema_path: path.resolve(options.provenanceFreezeSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.provenanceFreezeSchemaPath),
    mac_windows_replay_notes_schema_path: path.resolve(options.macWindowsReplayNotesSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.macWindowsReplayNotesSchemaPath),
    lockfile_policy_schema_path: path.resolve(options.lockfilePolicySchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.lockfilePolicySchemaPath),
    replay_handoff_map_schema_path: path.resolve(options.replayHandoffMapSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.replayHandoffMapSchemaPath),
    replay_evidence_checklist_schema_path: path.resolve(options.replayEvidenceChecklistSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.replayEvidenceChecklistSchemaPath),
    replay_handoff_closeout_schema_path: path.resolve(options.replayHandoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.replayHandoffCloseoutSchemaPath),
    reproducibility_check_registry_schema_path: path.resolve(options.reproducibilityCheckRegistrySchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.reproducibilityCheckRegistrySchemaPath),
    gitignore_path: path.resolve(options.gitignorePath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.gitignorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.schemaPath),
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
    validation_item_id: `platform-reproducibility-evidence-matrix.${slugify(itemPath)}.${checkId}`,
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
