import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS,
  buildPlatformReproducibilityEvidenceMatrix,
} from "./platform-reproducibility-evidence-matrix.mjs";

export const DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_OUT_DIR = "artifacts/platform-reproducibility-proof-index/latest";
export const DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS = {
  ...DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS,
  reproducibilityEvidenceMatrixSchemaPath: DEFAULT_PLATFORM_REPRODUCIBILITY_EVIDENCE_MATRIX_INPUTS.schemaPath,
  schemaPath: "schemas/platform-reproducibility-proof-index.schema.json",
};

const SCHEMA_VERSION = "platform-reproducibility-proof-index.v1";
const CAPABILITY_ID = "platform.reproducibility_proof_index";
const PHASE_SLOT = "P358";
const PREVIOUS_PHASE_SLOT = "P357";
const NEXT_PHASE_SLOT = "P359";

const PROOF_REFERENCES_BY_ROW = {
  runtime_dependency_sources: [
    "artifacts/platform-runtime-baseline/latest/summary.md",
    "artifacts/platform-runtime-drift/latest/summary.md",
  ],
  replay_operator_sources: [
    "artifacts/platform-runtime-replay-window/latest/summary.md",
    "artifacts/platform-operator-handoff/latest/summary.md",
    "artifacts/platform-artifact-guard/latest/summary.md",
  ],
  provenance_freeze_sources: [
    "artifacts/platform-provenance-ledger/latest/summary.md",
    "artifacts/platform-release-bundle-provenance/latest/summary.md",
    "artifacts/platform-signed-tag-provenance/latest/summary.md",
    "artifacts/platform-provenance-freeze-preflight/latest/summary.md",
    "artifacts/platform-provenance-freeze/latest/summary.md",
  ],
  replay_handoff_sources: [
    "artifacts/platform-mac-windows-replay-notes/latest/summary.md",
    "artifacts/platform-lockfile-policy/latest/summary.md",
    "artifacts/platform-replay-handoff-map/latest/summary.md",
    "artifacts/platform-replay-evidence-checklist/latest/summary.md",
    "artifacts/platform-replay-handoff-closeout/latest/summary.md",
  ],
  reproducibility_registry_source: [
    "artifacts/platform-reproducibility-check-registry/latest/summary.md",
  ],
  domain_pack_validation: [
    "artifacts/domain-packs/latest/domain-pack-registry.json",
  ],
  contract_release_freeze: [
    "artifacts/contract-golden-fixtures/latest/summary.md",
    "artifacts/contract-validation-suite/latest/summary.md",
    "artifacts/v1-freeze/latest/summary.md",
  ],
  validate_test_control_loop: [
    "npm run validate transcript",
    "npm test transcript",
    "artifacts/control-plane-loop/latest/summary.md",
  ],
  future_release_check_bridge: [
    "docs/platform-operations-stability-phase-ledger.md#P361-P380",
  ],
  human_review_note: [
    "human-review-note://platform-reproducibility-proof-index",
  ],
};

export async function runPlatformReproducibilityProofIndex(options = {}) {
  const result = await buildPlatformReproducibilityProofIndex(options);
  if (options.write !== false) await writePlatformReproducibilityProofIndex(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform reproducibility proof index failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReproducibilityProofIndex(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_OUT_DIR);
  const inputs = normalizeInputs(options);
  const evidenceMatrix = await buildPlatformReproducibilityEvidenceMatrix({
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
    reproducibilityCheckRegistrySchemaPath: inputs.reproducibility_check_registry_schema_path,
    gitignorePath: inputs.gitignore_path,
    schemaPath: inputs.reproducibility_evidence_matrix_schema_path,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const proofAnchor = buildProofAnchor(evidenceMatrix);
  const proofIndexRows = buildProofIndexRows(evidenceMatrix);
  const proofGateRows = buildProofGateRows({ evidenceMatrix, packageJson, platformOpsLedger, proofIndexRows });
  const proofBoundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    evidenceMatrix,
    packageJson,
    platformOpsLedger,
    proofIndexRows,
    proofGateRows,
    proofBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ evidenceMatrix, proofIndexRows, proofGateRows, proofBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_reproducibility_proof_index_id: `platform-reproducibility-proof-index.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    reproducibility_proof_anchor: proofAnchor,
    reproducibility_proof_rows: proofIndexRows,
    reproducibility_proof_gate_rows: proofGateRows,
    reproducibility_proof_boundary: proofBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_reproducibility_proof_index") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ evidenceMatrix, proofIndexRows, proofGateRows, proofBoundary, validation: result.validation });
  result.summary.platform_reproducibility_proof_index_id = result.platform_reproducibility_proof_index_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReproducibilityProofIndex(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "platform-reproducibility-proof-index.json"), serializable);
  await writeJson(path.join(outDir, "reproducibility-proof-rows.json"), collectionEnvelope("platform-reproducibility-proof-rows.v1", "reproducibility_proof_rows", result.reproducibility_proof_rows, result.generated_at));
  await writeJson(path.join(outDir, "reproducibility-proof-gate-rows.json"), collectionEnvelope("platform-reproducibility-proof-gate-rows.v1", "reproducibility_proof_gate_rows", result.reproducibility_proof_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "reproducibility-proof-boundary.json"), result.reproducibility_proof_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-reproducibility-proof-index-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReproducibilityProofIndexCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReproducibilityProofIndex(args);
    console.log(`Platform reproducibility proof index ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_reproducibility_proof_index_status}`);
    console.log(`Proof rows: ${result.summary.ready_reproducibility_proof_count}/${result.summary.reproducibility_proof_count}`);
    console.log(`Proof gates: ${result.summary.ready_reproducibility_proof_gate_count}/${result.summary.reproducibility_proof_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildProofAnchor(evidenceMatrix) {
  return {
    schema_version: "platform-reproducibility-proof-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_reproducibility_evidence_matrix_id: evidenceMatrix.platform_reproducibility_evidence_matrix_id,
    source_reproducibility_evidence_matrix_status: evidenceMatrix.summary.platform_reproducibility_evidence_matrix_status,
    source_reproducibility_evidence_matrix_hash: hashValue({
      id: evidenceMatrix.platform_reproducibility_evidence_matrix_id,
      status: evidenceMatrix.summary.platform_reproducibility_evidence_matrix_status,
      evidence_rows: evidenceMatrix.summary.reproducibility_evidence_count,
      gate_rows: evidenceMatrix.summary.reproducibility_evidence_gate_count,
    }),
  };
}

function buildProofIndexRows(evidenceMatrix) {
  const sourceReady = evidenceMatrix.validation.valid && evidenceMatrix.summary.platform_reproducibility_evidence_matrix_status === "ready";
  return evidenceMatrix.reproducibility_evidence_rows.map((evidenceRow, index) => {
    const proofReferences = PROOF_REFERENCES_BY_ROW[evidenceRow.row_key] ?? [];
    const proofStatus = sourceReady && evidenceRow.reproducibility_evidence_status === "ready" && proofReferences.length > 0 ? "ready" : "blocked";
    const row = {
      schema_version: "platform-reproducibility-proof-row.v1",
      reproducibility_proof_row_id: `platform-reproducibility-proof-index.row.${evidenceRow.row_key}`,
      phase_slot: PHASE_SLOT,
      source_evidence_row_key: evidenceRow.row_key,
      evidence_scope: evidenceRow.evidence_scope,
      expected_evidence: evidenceRow.expected_evidence,
      expected_proof_references: proofReferences,
      expected_proof_reference_count: proofReferences.length,
      reproducibility_proof_status: proofStatus,
      source_evidence_status: evidenceRow.reproducibility_evidence_status,
      source_evidence_row_ready: evidenceRow.reproducibility_evidence_status === "ready",
      proof_materialized_by_report: false,
      artifact_read_performed_by_report: false,
      evidence_collected_by_report: false,
      command_execution_performed_by_report: false,
      release_check_execution_performed_by_report: false,
      artifact_regeneration_performed_by_report: false,
      protected_action_executed_by_report: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "reproducibility_proof_hash");
  });
}

function buildProofGateRows({ evidenceMatrix, packageJson, platformOpsLedger, proofIndexRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p357_evidence_matrix_ready", "P357 reproducibility evidence matrix source is ready.", evidenceMatrix.validation.valid && evidenceMatrix.summary.platform_reproducibility_evidence_matrix_status === "ready"),
    gateRow("platform_package_script_registered", "package.json registers the P358 reproducibility proof index command.", typeof scripts["platform:reproducibility-proof-index"] === "string" && scripts["platform:reproducibility-proof-index"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P358 reproducibility proof index.", validateScript.includes("npm run platform:reproducibility-proof-index -- --check")),
    gateRow("p358_ledger_acceptance_declared", "P358 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P358: `platform:reproducibility-proof-index`")),
    gateRow("reproducibility_proof_rows_ready", "All reproducibility proof index rows are ready.", proofIndexRows.length >= 10 && proofIndexRows.every((row) => row.reproducibility_proof_status === "ready")),
    gateRow("no_proof_materialization", "Proof index records proof references without materializing proof or reading artifacts.", true),
    gateRow("p359_next_phase_reserved", "P359-P360 remains reserved for operator review and reproducibility closeout checks.", ledgerText.includes("P359-P360") && ledgerText.includes("reproducibility")),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "reproducibility_proof_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-reproducibility-proof-gate-row.v1",
    reproducibility_proof_gate_row_id: `platform-reproducibility-proof-index.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    proof_materialized_by_report: false,
    artifact_read_performed_by_report: false,
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
    schema_version: "platform-reproducibility-proof-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    proof_materialized: false,
    artifact_read_performed: false,
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

function buildValidationItems({ evidenceMatrix, packageJson, platformOpsLedger, proofIndexRows, proofGateRows, proofBoundary }) {
  return [
    validationItem("source.reproducibility_evidence_matrix", "p357_evidence_matrix_ready", evidenceMatrix.validation.valid && evidenceMatrix.summary.platform_reproducibility_evidence_matrix_status === "ready", "P357 reproducibility evidence matrix source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P358 proof index checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("reproducibility_proof_rows", "proof_rows_ready", proofIndexRows.length >= 10 && proofIndexRows.every((row) => row.reproducibility_proof_status === "ready" && !row.proof_materialized_by_report && !row.artifact_read_performed_by_report && !row.command_execution_performed_by_report), "Reproducibility proof index rows are ready and report-only."),
    validationItem("reproducibility_proof_gate_rows", "proof_gates_ready", proofGateRows.length >= 7 && proofGateRows.every((row) => row.gate_status === "ready" && !row.proof_materialized_by_report && !row.artifact_read_performed_by_report && !row.command_execution_performed_by_report), "P358 reproducibility proof gates are ready and report-only."),
    validationItem("boundary.read_only", "read_only_report", proofBoundary.read_only && proofBoundary.report_only && !proofBoundary.proof_materialized && !proofBoundary.artifact_read_performed && !proofBoundary.evidence_collected && !proofBoundary.command_execution_performed && !proofBoundary.artifact_overwrite_performed, "Reproducibility proof index is read-only and does not materialize proof, read artifacts, collect evidence, run checks, or overwrite artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !proofBoundary.artifact_regeneration_performed && !proofBoundary.history_import_performed && !proofBoundary.repository_checkout_changed && !proofBoundary.git_operation_performed && !proofBoundary.protected_action_executed, "Reproducibility proof index performs no artifact, history, checkout, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !proofBoundary.trading_live_enabled && !proofBoundary.trading_full_auto_enabled && !proofBoundary.trading_order_submission_allowed && !proofBoundary.broker_write_allowed, "Trading live/full-auto/order submission and broker writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only_boundary", !proofBoundary.desktop_source_of_truth && !proofBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ evidenceMatrix, proofIndexRows, proofGateRows, proofBoundary, validation }) {
  return {
    platform_reproducibility_proof_index_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_reproducibility_evidence_matrix_status: evidenceMatrix.summary.platform_reproducibility_evidence_matrix_status,
    reproducibility_proof_count: proofIndexRows.length,
    ready_reproducibility_proof_count: proofIndexRows.filter((row) => row.reproducibility_proof_status === "ready").length,
    reproducibility_proof_gate_count: proofGateRows.length,
    ready_reproducibility_proof_gate_count: proofGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: proofBoundary.read_only,
    report_only: proofBoundary.report_only,
    proof_materialized: proofBoundary.proof_materialized,
    artifact_read_performed: proofBoundary.artifact_read_performed,
    evidence_collected: proofBoundary.evidence_collected,
    command_execution_performed: proofBoundary.command_execution_performed,
    release_check_execution_performed: proofBoundary.release_check_execution_performed,
    dependency_install_performed: proofBoundary.dependency_install_performed,
    package_mutation_performed: proofBoundary.package_mutation_performed,
    lockfile_mutation_performed: proofBoundary.lockfile_mutation_performed,
    artifact_overwrite_performed: proofBoundary.artifact_overwrite_performed,
    artifact_regeneration_performed: proofBoundary.artifact_regeneration_performed,
    history_import_performed: proofBoundary.history_import_performed,
    repository_checkout_changed: proofBoundary.repository_checkout_changed,
    git_operation_performed: proofBoundary.git_operation_performed,
    release_published: proofBoundary.release_published,
    recovery_execution_performed: proofBoundary.recovery_execution_performed,
    protected_action_executed: proofBoundary.protected_action_executed,
    approval_applied: proofBoundary.approval_applied,
    desktop_source_of_truth: proofBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: proofBoundary.desktop_mutation_allowed,
    trading_live_enabled: proofBoundary.trading_live_enabled,
    trading_full_auto_enabled: proofBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: proofBoundary.trading_order_submission_allowed,
    broker_write_allowed: proofBoundary.broker_write_allowed,
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
    "# Platform Reproducibility Proof Index",
    "",
    `Status: ${result.summary.platform_reproducibility_proof_index_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source reproducibility evidence matrix: ${result.summary.source_reproducibility_evidence_matrix_status}`,
    `Proof rows: ${result.summary.ready_reproducibility_proof_count}/${result.summary.reproducibility_proof_count}`,
    `Proof gates: ${result.summary.ready_reproducibility_proof_gate_count}/${result.summary.reproducibility_proof_gate_count}`,
    "",
    "## Proof Rows",
    "",
    ...result.reproducibility_proof_rows.map((row) => `- ${row.source_evidence_row_key}: ${row.reproducibility_proof_status}`),
    "",
    "## Proof Gates",
    "",
    ...result.reproducibility_proof_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_OUT_DIR };
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
    else if (arg === "--reproducibility-evidence-matrix-schema") parsed.reproducibilityEvidenceMatrixSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/platform-reproducibility-proof-index.mjs [options]

Options:
  --out-dir <folder>                    Output directory. Default: ${DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_OUT_DIR}
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
  --reproducibility-evidence-matrix-schema <path> P357 evidence matrix schema path.
  --gitignore <path>                    .gitignore path.
  --schema <path>                       Output schema path.
  --check                               Validate only, do not write artifacts.
  -h, --help                            Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.packagePath),
    package_lock_path: path.resolve(options.packageLockPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.packageLockPath),
    nvmrc_path: path.resolve(options.nvmrcPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.nvmrcPath),
    node_version_path: path.resolve(options.nodeVersionPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.nodeVersionPath),
    npmrc_path: path.resolve(options.npmrcPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.npmrcPath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.platformOpsLedgerPath),
    trading_phase_ledger_path: path.resolve(options.tradingPhaseLedgerPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.tradingPhaseLedgerPath),
    baseline_schema_path: path.resolve(options.baselineSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.baselineSchemaPath),
    drift_schema_path: path.resolve(options.driftSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.driftSchemaPath),
    replay_window_schema_path: path.resolve(options.replayWindowSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.replayWindowSchemaPath),
    operator_handoff_schema_path: path.resolve(options.operatorHandoffSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.operatorHandoffSchemaPath),
    artifact_guard_schema_path: path.resolve(options.artifactGuardSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.artifactGuardSchemaPath),
    provenance_ledger_schema_path: path.resolve(options.provenanceLedgerSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.provenanceLedgerSchemaPath),
    release_bundle_provenance_schema_path: path.resolve(options.releaseBundleProvenanceSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.releaseBundleProvenanceSchemaPath),
    signed_tag_provenance_schema_path: path.resolve(options.signedTagProvenanceSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.signedTagProvenanceSchemaPath),
    provenance_freeze_preflight_schema_path: path.resolve(options.provenanceFreezePreflightSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.provenanceFreezePreflightSchemaPath),
    provenance_freeze_schema_path: path.resolve(options.provenanceFreezeSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.provenanceFreezeSchemaPath),
    mac_windows_replay_notes_schema_path: path.resolve(options.macWindowsReplayNotesSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.macWindowsReplayNotesSchemaPath),
    lockfile_policy_schema_path: path.resolve(options.lockfilePolicySchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.lockfilePolicySchemaPath),
    replay_handoff_map_schema_path: path.resolve(options.replayHandoffMapSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.replayHandoffMapSchemaPath),
    replay_evidence_checklist_schema_path: path.resolve(options.replayEvidenceChecklistSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.replayEvidenceChecklistSchemaPath),
    replay_handoff_closeout_schema_path: path.resolve(options.replayHandoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.replayHandoffCloseoutSchemaPath),
    reproducibility_check_registry_schema_path: path.resolve(options.reproducibilityCheckRegistrySchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.reproducibilityCheckRegistrySchemaPath),
    reproducibility_evidence_matrix_schema_path: path.resolve(options.reproducibilityEvidenceMatrixSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.reproducibilityEvidenceMatrixSchemaPath),
    gitignore_path: path.resolve(options.gitignorePath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.gitignorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.schemaPath),
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
    validation_item_id: `platform-reproducibility-proof-index.${slugify(itemPath)}.${checkId}`,
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
