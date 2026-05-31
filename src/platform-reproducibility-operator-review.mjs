import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS,
  buildPlatformReproducibilityProofIndex,
} from "./platform-reproducibility-proof-index.mjs";

export const DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_OUT_DIR = "artifacts/platform-reproducibility-operator-review/latest";
export const DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS = {
  ...DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS,
  reproducibilityProofIndexSchemaPath: DEFAULT_PLATFORM_REPRODUCIBILITY_PROOF_INDEX_INPUTS.schemaPath,
  schemaPath: "schemas/platform-reproducibility-operator-review.schema.json",
};

const SCHEMA_VERSION = "platform-reproducibility-operator-review.v1";
const CAPABILITY_ID = "platform.reproducibility_operator_review";
const PHASE_SLOT = "P359";
const PREVIOUS_PHASE_SLOT = "P358";
const NEXT_PHASE_SLOT = "P360";

const REVIEW_ROLE_BY_SCOPE = {
  runtime_dependency_reproducibility: "platform_operator",
  replay_operator_readiness: "platform_operator",
  provenance_freeze_readiness: "release_manager",
  cross_os_replay_handoff_readiness: "platform_operator",
  p356_registry_readiness: "platform_operator",
  domain_pack_registry_health: "domain_pack_owner",
  contract_release_readiness: "release_manager",
  validation_test_control_plane: "qa_reviewer",
  future_release_check_chain: "platform_architect",
  human_review_closeout: "human_reviewer",
};

export async function runPlatformReproducibilityOperatorReview(options = {}) {
  const result = await buildPlatformReproducibilityOperatorReview(options);
  if (options.write !== false) await writePlatformReproducibilityOperatorReview(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform reproducibility operator review failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReproducibilityOperatorReview(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_OUT_DIR);
  const inputs = normalizeInputs(options);
  const proofIndex = await buildPlatformReproducibilityProofIndex({
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
    reproducibilityEvidenceMatrixSchemaPath: inputs.reproducibility_evidence_matrix_schema_path,
    gitignorePath: inputs.gitignore_path,
    schemaPath: inputs.reproducibility_proof_index_schema_path,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const reviewAnchor = buildReviewAnchor(proofIndex);
  const reviewRows = buildReviewRows(proofIndex);
  const reviewGateRows = buildReviewGateRows({ proofIndex, packageJson, platformOpsLedger, reviewRows });
  const reviewBoundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    proofIndex,
    packageJson,
    platformOpsLedger,
    reviewRows,
    reviewGateRows,
    reviewBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ proofIndex, reviewRows, reviewGateRows, reviewBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_reproducibility_operator_review_id: `platform-reproducibility-operator-review.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    reproducibility_operator_review_anchor: reviewAnchor,
    reproducibility_operator_review_rows: reviewRows,
    reproducibility_operator_review_gate_rows: reviewGateRows,
    reproducibility_operator_review_boundary: reviewBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_reproducibility_operator_review") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ proofIndex, reviewRows, reviewGateRows, reviewBoundary, validation: result.validation });
  result.summary.platform_reproducibility_operator_review_id = result.platform_reproducibility_operator_review_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReproducibilityOperatorReview(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "platform-reproducibility-operator-review.json"), serializable);
  await writeJson(path.join(outDir, "reproducibility-operator-review-rows.json"), collectionEnvelope("platform-reproducibility-operator-review-rows.v1", "reproducibility_operator_review_rows", result.reproducibility_operator_review_rows, result.generated_at));
  await writeJson(path.join(outDir, "reproducibility-operator-review-gate-rows.json"), collectionEnvelope("platform-reproducibility-operator-review-gate-rows.v1", "reproducibility_operator_review_gate_rows", result.reproducibility_operator_review_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "reproducibility-operator-review-boundary.json"), result.reproducibility_operator_review_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-reproducibility-operator-review-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReproducibilityOperatorReviewCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReproducibilityOperatorReview(args);
    console.log(`Platform reproducibility operator review ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_reproducibility_operator_review_status}`);
    console.log(`Review rows: ${result.summary.ready_operator_review_count}/${result.summary.operator_review_count}`);
    console.log(`Review gates: ${result.summary.ready_operator_review_gate_count}/${result.summary.operator_review_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildReviewAnchor(proofIndex) {
  return {
    schema_version: "platform-reproducibility-operator-review-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_reproducibility_proof_index_id: proofIndex.platform_reproducibility_proof_index_id,
    source_reproducibility_proof_index_status: proofIndex.summary.platform_reproducibility_proof_index_status,
    source_reproducibility_proof_index_hash: hashValue({
      id: proofIndex.platform_reproducibility_proof_index_id,
      status: proofIndex.summary.platform_reproducibility_proof_index_status,
      proof_rows: proofIndex.summary.reproducibility_proof_count,
      gate_rows: proofIndex.summary.reproducibility_proof_gate_count,
    }),
  };
}

function buildReviewRows(proofIndex) {
  const sourceReady = proofIndex.validation.valid && proofIndex.summary.platform_reproducibility_proof_index_status === "ready";
  return proofIndex.reproducibility_proof_rows.map((proofRow, index) => {
    const operatorRole = REVIEW_ROLE_BY_SCOPE[proofRow.evidence_scope] ?? "platform_operator";
    const reviewStatus = sourceReady && proofRow.reproducibility_proof_status === "ready" ? "ready" : "blocked";
    const row = {
      schema_version: "platform-reproducibility-operator-review-row.v1",
      reproducibility_operator_review_row_id: `platform-reproducibility-operator-review.row.${proofRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_evidence_row_key: proofRow.source_evidence_row_key,
      evidence_scope: proofRow.evidence_scope,
      expected_proof_references: proofRow.expected_proof_references,
      expected_proof_reference_count: proofRow.expected_proof_reference_count,
      operator_role: operatorRole,
      expected_review_decision: "accept_ready_or_return_with_blocker",
      operator_review_status: reviewStatus,
      source_proof_status: proofRow.reproducibility_proof_status,
      review_completed_by_report: false,
      approval_applied_by_report: false,
      proof_materialized_by_report: false,
      artifact_read_performed_by_report: false,
      evidence_collected_by_report: false,
      command_execution_performed_by_report: false,
      release_check_execution_performed_by_report: false,
      protected_action_executed_by_report: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "operator_review_hash");
  });
}

function buildReviewGateRows({ proofIndex, packageJson, platformOpsLedger, reviewRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p358_proof_index_ready", "P358 reproducibility proof index source is ready.", proofIndex.validation.valid && proofIndex.summary.platform_reproducibility_proof_index_status === "ready"),
    gateRow("platform_package_script_registered", "package.json registers the P359 reproducibility operator review command.", typeof scripts["platform:reproducibility-operator-review"] === "string" && scripts["platform:reproducibility-operator-review"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P359 reproducibility operator review.", validateScript.includes("npm run platform:reproducibility-operator-review -- --check")),
    gateRow("p359_ledger_acceptance_declared", "P359 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P359: `platform:reproducibility-operator-review`")),
    gateRow("operator_review_rows_ready", "All reproducibility operator review rows are ready.", reviewRows.length >= 10 && reviewRows.every((row) => row.operator_review_status === "ready")),
    gateRow("no_approval_or_protected_action", "Operator review records review requirements without applying approvals or protected actions.", true),
    gateRow("p360_next_phase_reserved", "P360 remains reserved for reproducibility closeout.", ledgerText.includes("P360") && ledgerText.includes("reproducibility closeout")),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operator_review_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-reproducibility-operator-review-gate-row.v1",
    reproducibility_operator_review_gate_row_id: `platform-reproducibility-operator-review.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    review_completed_by_report: false,
    approval_applied_by_report: false,
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
    schema_version: "platform-reproducibility-operator-review-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    review_completed: false,
    approval_applied: false,
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
    desktop_source_of_truth: false,
    desktop_mutation_allowed: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    broker_write_allowed: false,
    human_review_required_for_reproducibility: true,
  };
}

function buildValidationItems({ proofIndex, packageJson, platformOpsLedger, reviewRows, reviewGateRows, reviewBoundary }) {
  return [
    validationItem("source.reproducibility_proof_index", "p358_proof_index_ready", proofIndex.validation.valid && proofIndex.summary.platform_reproducibility_proof_index_status === "ready", "P358 reproducibility proof index source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P359 operator review checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("reproducibility_operator_review_rows", "operator_review_rows_ready", reviewRows.length >= 10 && reviewRows.every((row) => row.operator_review_status === "ready" && !row.review_completed_by_report && !row.approval_applied_by_report && !row.command_execution_performed_by_report), "Reproducibility operator review rows are ready and report-only."),
    validationItem("reproducibility_operator_review_gate_rows", "operator_review_gates_ready", reviewGateRows.length >= 7 && reviewGateRows.every((row) => row.gate_status === "ready" && !row.approval_applied_by_report && !row.protected_action_executed_by_report), "P359 reproducibility operator review gates are ready and report-only."),
    validationItem("boundary.read_only", "read_only_report", reviewBoundary.read_only && reviewBoundary.report_only && !reviewBoundary.review_completed && !reviewBoundary.approval_applied && !reviewBoundary.proof_materialized && !reviewBoundary.artifact_read_performed && !reviewBoundary.command_execution_performed && !reviewBoundary.artifact_overwrite_performed, "Reproducibility operator review is read-only and does not complete review, apply approval, materialize proof, read artifacts, run checks, or overwrite artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !reviewBoundary.artifact_regeneration_performed && !reviewBoundary.history_import_performed && !reviewBoundary.repository_checkout_changed && !reviewBoundary.git_operation_performed && !reviewBoundary.protected_action_executed, "Reproducibility operator review performs no artifact, history, checkout, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !reviewBoundary.trading_live_enabled && !reviewBoundary.trading_full_auto_enabled && !reviewBoundary.trading_order_submission_allowed && !reviewBoundary.broker_write_allowed, "Trading live/full-auto/order submission and broker writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only_boundary", !reviewBoundary.desktop_source_of_truth && !reviewBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ proofIndex, reviewRows, reviewGateRows, reviewBoundary, validation }) {
  return {
    platform_reproducibility_operator_review_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_reproducibility_proof_index_status: proofIndex.summary.platform_reproducibility_proof_index_status,
    operator_review_count: reviewRows.length,
    ready_operator_review_count: reviewRows.filter((row) => row.operator_review_status === "ready").length,
    operator_review_gate_count: reviewGateRows.length,
    ready_operator_review_gate_count: reviewGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: reviewBoundary.read_only,
    report_only: reviewBoundary.report_only,
    review_completed: reviewBoundary.review_completed,
    approval_applied: reviewBoundary.approval_applied,
    proof_materialized: reviewBoundary.proof_materialized,
    artifact_read_performed: reviewBoundary.artifact_read_performed,
    evidence_collected: reviewBoundary.evidence_collected,
    command_execution_performed: reviewBoundary.command_execution_performed,
    release_check_execution_performed: reviewBoundary.release_check_execution_performed,
    dependency_install_performed: reviewBoundary.dependency_install_performed,
    package_mutation_performed: reviewBoundary.package_mutation_performed,
    lockfile_mutation_performed: reviewBoundary.lockfile_mutation_performed,
    artifact_overwrite_performed: reviewBoundary.artifact_overwrite_performed,
    artifact_regeneration_performed: reviewBoundary.artifact_regeneration_performed,
    history_import_performed: reviewBoundary.history_import_performed,
    repository_checkout_changed: reviewBoundary.repository_checkout_changed,
    git_operation_performed: reviewBoundary.git_operation_performed,
    release_published: reviewBoundary.release_published,
    recovery_execution_performed: reviewBoundary.recovery_execution_performed,
    protected_action_executed: reviewBoundary.protected_action_executed,
    desktop_source_of_truth: reviewBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: reviewBoundary.desktop_mutation_allowed,
    trading_live_enabled: reviewBoundary.trading_live_enabled,
    trading_full_auto_enabled: reviewBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: reviewBoundary.trading_order_submission_allowed,
    broker_write_allowed: reviewBoundary.broker_write_allowed,
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
    "# Platform Reproducibility Operator Review",
    "",
    `Status: ${result.summary.platform_reproducibility_operator_review_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source reproducibility proof index: ${result.summary.source_reproducibility_proof_index_status}`,
    `Review rows: ${result.summary.ready_operator_review_count}/${result.summary.operator_review_count}`,
    `Review gates: ${result.summary.ready_operator_review_gate_count}/${result.summary.operator_review_gate_count}`,
    "",
    "## Review Rows",
    "",
    ...result.reproducibility_operator_review_rows.map((row) => `- ${row.source_evidence_row_key} (${row.operator_role}): ${row.operator_review_status}`),
    "",
    "## Review Gates",
    "",
    ...result.reproducibility_operator_review_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_OUT_DIR };
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
    else if (arg === "--reproducibility-proof-index-schema") parsed.reproducibilityProofIndexSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/platform-reproducibility-operator-review.mjs [options]

Options:
  --out-dir <folder>                    Output directory. Default: ${DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_OUT_DIR}
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
  --reproducibility-proof-index-schema <path> P358 proof index schema path.
  --gitignore <path>                    .gitignore path.
  --schema <path>                       Output schema path.
  --check                               Validate only, do not write artifacts.
  -h, --help                            Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.packagePath),
    package_lock_path: path.resolve(options.packageLockPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.packageLockPath),
    nvmrc_path: path.resolve(options.nvmrcPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.nvmrcPath),
    node_version_path: path.resolve(options.nodeVersionPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.nodeVersionPath),
    npmrc_path: path.resolve(options.npmrcPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.npmrcPath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.platformOpsLedgerPath),
    trading_phase_ledger_path: path.resolve(options.tradingPhaseLedgerPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.tradingPhaseLedgerPath),
    baseline_schema_path: path.resolve(options.baselineSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.baselineSchemaPath),
    drift_schema_path: path.resolve(options.driftSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.driftSchemaPath),
    replay_window_schema_path: path.resolve(options.replayWindowSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.replayWindowSchemaPath),
    operator_handoff_schema_path: path.resolve(options.operatorHandoffSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.operatorHandoffSchemaPath),
    artifact_guard_schema_path: path.resolve(options.artifactGuardSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.artifactGuardSchemaPath),
    provenance_ledger_schema_path: path.resolve(options.provenanceLedgerSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.provenanceLedgerSchemaPath),
    release_bundle_provenance_schema_path: path.resolve(options.releaseBundleProvenanceSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.releaseBundleProvenanceSchemaPath),
    signed_tag_provenance_schema_path: path.resolve(options.signedTagProvenanceSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.signedTagProvenanceSchemaPath),
    provenance_freeze_preflight_schema_path: path.resolve(options.provenanceFreezePreflightSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.provenanceFreezePreflightSchemaPath),
    provenance_freeze_schema_path: path.resolve(options.provenanceFreezeSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.provenanceFreezeSchemaPath),
    mac_windows_replay_notes_schema_path: path.resolve(options.macWindowsReplayNotesSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.macWindowsReplayNotesSchemaPath),
    lockfile_policy_schema_path: path.resolve(options.lockfilePolicySchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.lockfilePolicySchemaPath),
    replay_handoff_map_schema_path: path.resolve(options.replayHandoffMapSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.replayHandoffMapSchemaPath),
    replay_evidence_checklist_schema_path: path.resolve(options.replayEvidenceChecklistSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.replayEvidenceChecklistSchemaPath),
    replay_handoff_closeout_schema_path: path.resolve(options.replayHandoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.replayHandoffCloseoutSchemaPath),
    reproducibility_check_registry_schema_path: path.resolve(options.reproducibilityCheckRegistrySchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.reproducibilityCheckRegistrySchemaPath),
    reproducibility_evidence_matrix_schema_path: path.resolve(options.reproducibilityEvidenceMatrixSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.reproducibilityEvidenceMatrixSchemaPath),
    reproducibility_proof_index_schema_path: path.resolve(options.reproducibilityProofIndexSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.reproducibilityProofIndexSchemaPath),
    gitignore_path: path.resolve(options.gitignorePath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.gitignorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.schemaPath),
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
    validation_item_id: `platform-reproducibility-operator-review.${slugify(itemPath)}.${checkId}`,
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
