import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS,
  buildPlatformReproducibilityOperatorReview,
} from "./platform-reproducibility-operator-review.mjs";

export const DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_OUT_DIR = "artifacts/platform-reproducibility-closeout/latest";
export const DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS = {
  ...DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS,
  reproducibilityOperatorReviewSchemaPath: DEFAULT_PLATFORM_REPRODUCIBILITY_OPERATOR_REVIEW_INPUTS.schemaPath,
  schemaPath: "schemas/platform-reproducibility-closeout.schema.json",
};

const SCHEMA_VERSION = "platform-reproducibility-closeout.v1";
const CAPABILITY_ID = "platform.reproducibility_closeout";
const PHASE_SLOT = "P360";
const PREVIOUS_PHASE_SLOT = "P359";
const NEXT_PHASE_SLOT = "P361";

const CLOSEOUT_COMMANDS = [
  ["P341", "platform:runtime-baseline", "npm run platform:runtime-baseline -- --check"],
  ["P342", "platform:drift-check", "npm run platform:drift-check -- --check"],
  ["P343", "platform:replay-window", "npm run platform:replay-window -- --check"],
  ["P344", "platform:operator-handoff", "npm run platform:operator-handoff -- --check"],
  ["P345", "platform:artifact-guard", "npm run platform:artifact-guard -- --check"],
  ["P346", "platform:provenance-ledger", "npm run platform:provenance-ledger -- --check"],
  ["P347", "platform:release-bundle-provenance", "npm run platform:release-bundle-provenance -- --check"],
  ["P348", "platform:signed-tag-provenance", "npm run platform:signed-tag-provenance -- --check"],
  ["P349", "platform:provenance-freeze-preflight", "npm run platform:provenance-freeze-preflight -- --check"],
  ["P350", "platform:provenance-freeze", "npm run platform:provenance-freeze -- --check"],
  ["P351", "platform:mac-windows-replay-notes", "npm run platform:mac-windows-replay-notes -- --check"],
  ["P352", "platform:lockfile-policy", "npm run platform:lockfile-policy -- --check"],
  ["P353", "platform:replay-handoff-map", "npm run platform:replay-handoff-map -- --check"],
  ["P354", "platform:replay-evidence-checklist", "npm run platform:replay-evidence-checklist -- --check"],
  ["P355", "platform:replay-handoff-closeout", "npm run platform:replay-handoff-closeout -- --check"],
  ["P356", "platform:reproducibility-check-registry", "npm run platform:reproducibility-check-registry -- --check"],
  ["P357", "platform:reproducibility-evidence-matrix", "npm run platform:reproducibility-evidence-matrix -- --check"],
  ["P358", "platform:reproducibility-proof-index", "npm run platform:reproducibility-proof-index -- --check"],
  ["P359", "platform:reproducibility-operator-review", "npm run platform:reproducibility-operator-review -- --check"],
  ["P360", "platform:reproducibility-closeout", "npm run platform:reproducibility-closeout -- --check"],
];

export async function runPlatformReproducibilityCloseout(options = {}) {
  const result = await buildPlatformReproducibilityCloseout(options);
  if (options.write !== false) await writePlatformReproducibilityCloseout(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform reproducibility closeout failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReproducibilityCloseout(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const operatorReview = await buildPlatformReproducibilityOperatorReview({
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
    reproducibilityProofIndexSchemaPath: inputs.reproducibility_proof_index_schema_path,
    gitignorePath: inputs.gitignore_path,
    schemaPath: inputs.reproducibility_operator_review_schema_path,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const closeoutAnchor = buildCloseoutAnchor(operatorReview);
  const closeoutRows = buildCloseoutRows({ operatorReview, packageJson });
  const closeoutGateRows = buildCloseoutGateRows({ operatorReview, packageJson, platformOpsLedger, closeoutRows });
  const closeoutBoundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    operatorReview,
    packageJson,
    platformOpsLedger,
    closeoutRows,
    closeoutGateRows,
    closeoutBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ operatorReview, closeoutRows, closeoutGateRows, closeoutBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_reproducibility_closeout_id: `platform-reproducibility-closeout.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    reproducibility_closeout_anchor: closeoutAnchor,
    reproducibility_closeout_rows: closeoutRows,
    reproducibility_closeout_gate_rows: closeoutGateRows,
    reproducibility_closeout_boundary: closeoutBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_reproducibility_closeout") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ operatorReview, closeoutRows, closeoutGateRows, closeoutBoundary, validation: result.validation });
  result.summary.platform_reproducibility_closeout_id = result.platform_reproducibility_closeout_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReproducibilityCloseout(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResult(result);
  await writeJson(path.join(outDir, "platform-reproducibility-closeout.json"), serializable);
  await writeJson(path.join(outDir, "reproducibility-closeout-rows.json"), collectionEnvelope("platform-reproducibility-closeout-rows.v1", "reproducibility_closeout_rows", result.reproducibility_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "reproducibility-closeout-gate-rows.json"), collectionEnvelope("platform-reproducibility-closeout-gate-rows.v1", "reproducibility_closeout_gate_rows", result.reproducibility_closeout_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "reproducibility-closeout-boundary.json"), result.reproducibility_closeout_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-reproducibility-closeout-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReproducibilityCloseoutCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReproducibilityCloseout(args);
    console.log(`Platform reproducibility closeout ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_reproducibility_closeout_status}`);
    console.log(`Closeout rows: ${result.summary.ready_reproducibility_closeout_count}/${result.summary.reproducibility_closeout_count}`);
    console.log(`Closeout gates: ${result.summary.ready_reproducibility_closeout_gate_count}/${result.summary.reproducibility_closeout_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildCloseoutAnchor(operatorReview) {
  return {
    schema_version: "platform-reproducibility-closeout-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_reproducibility_operator_review_id: operatorReview.platform_reproducibility_operator_review_id,
    source_reproducibility_operator_review_status: operatorReview.summary.platform_reproducibility_operator_review_status,
    source_reproducibility_operator_review_hash: hashValue({
      id: operatorReview.platform_reproducibility_operator_review_id,
      status: operatorReview.summary.platform_reproducibility_operator_review_status,
      review_rows: operatorReview.summary.operator_review_count,
      gate_rows: operatorReview.summary.operator_review_gate_count,
    }),
  };
}

function buildCloseoutRows({ operatorReview, packageJson }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const sourceReady = operatorReview.validation.valid && operatorReview.summary.platform_reproducibility_operator_review_status === "ready";
  return CLOSEOUT_COMMANDS.map(([sourcePhaseSlot, packageScriptName, checkCommand], index) => {
    const packageScriptRegistered = typeof scripts[packageScriptName] === "string" && scripts[packageScriptName].length > 0;
    const validationChainRegistered = validateScript.includes(checkCommand);
    const closeoutStatus = sourceReady && packageScriptRegistered && validationChainRegistered ? "ready" : "blocked";
    const row = {
      schema_version: "platform-reproducibility-closeout-row.v1",
      reproducibility_closeout_row_id: `platform-reproducibility-closeout.row.${sourcePhaseSlot.toLowerCase()}`,
      phase_slot: PHASE_SLOT,
      source_phase_slot: sourcePhaseSlot,
      package_script_name: packageScriptName,
      check_command: checkCommand,
      reproducibility_closeout_status: closeoutStatus,
      package_script_registered: packageScriptRegistered,
      validation_chain_registered: validationChainRegistered,
      command_execution_performed_by_report: false,
      release_check_execution_performed_by_report: false,
      review_completed_by_report: false,
      approval_applied_by_report: false,
      artifact_regeneration_performed_by_report: false,
      protected_action_executed_by_report: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "reproducibility_closeout_hash");
  });
}

function buildCloseoutGateRows({ operatorReview, packageJson, platformOpsLedger, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p359_operator_review_ready", "P359 reproducibility operator review source is ready.", operatorReview.validation.valid && operatorReview.summary.platform_reproducibility_operator_review_status === "ready"),
    gateRow("platform_package_script_registered", "package.json registers the P360 reproducibility closeout command.", typeof scripts["platform:reproducibility-closeout"] === "string" && scripts["platform:reproducibility-closeout"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P360 reproducibility closeout.", validateScript.includes("npm run platform:reproducibility-closeout -- --check")),
    gateRow("p360_ledger_acceptance_declared", "P360 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P360: `platform:reproducibility-closeout`")),
    gateRow("p341_p360_closeout_rows_ready", "All P341-P360 reproducibility closeout rows are ready.", closeoutRows.length >= 20 && closeoutRows.every((row) => row.reproducibility_closeout_status === "ready")),
    gateRow("no_execution_or_approval", "Closeout records readiness without executing checks, applying approvals, or protected actions.", true),
    gateRow("p361_p380_next_range_declared", "P361-P380 unified platform and trading checks remain declared.", ledgerText.includes("P361-P380") && ledgerText.includes("trading:release-check") && ledgerText.includes("platform:ops-check") && ledgerText.includes("platform:release-check")),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "reproducibility_closeout_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-reproducibility-closeout-gate-row.v1",
    reproducibility_closeout_gate_row_id: `platform-reproducibility-closeout.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    command_execution_performed_by_report: false,
    release_check_execution_performed_by_report: false,
    review_completed_by_report: false,
    approval_applied_by_report: false,
    artifact_regeneration_performed_by_report: false,
    git_operation_performed_by_report: false,
    protected_action_executed_by_report: false,
    trading_order_submission_performed_by_report: false,
    human_review_required: true,
  };
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "platform-reproducibility-closeout-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    command_execution_performed: false,
    release_check_execution_performed: false,
    review_completed: false,
    approval_applied: false,
    proof_materialized: false,
    artifact_read_performed: false,
    evidence_collected: false,
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

function buildValidationItems({ operatorReview, packageJson, platformOpsLedger, closeoutRows, closeoutGateRows, closeoutBoundary }) {
  return [
    validationItem("source.reproducibility_operator_review", "p359_operator_review_ready", operatorReview.validation.valid && operatorReview.summary.platform_reproducibility_operator_review_status === "ready", "P359 reproducibility operator review source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P360 closeout checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("reproducibility_closeout_rows", "closeout_rows_ready", closeoutRows.length >= 20 && closeoutRows.every((row) => row.reproducibility_closeout_status === "ready" && !row.command_execution_performed_by_report && !row.approval_applied_by_report), "P341-P360 reproducibility closeout rows are ready and report-only."),
    validationItem("reproducibility_closeout_gate_rows", "closeout_gates_ready", closeoutGateRows.length >= 7 && closeoutGateRows.every((row) => row.gate_status === "ready" && !row.command_execution_performed_by_report && !row.protected_action_executed_by_report), "P360 reproducibility closeout gates are ready and report-only."),
    validationItem("boundary.read_only", "read_only_report", closeoutBoundary.read_only && closeoutBoundary.report_only && !closeoutBoundary.command_execution_performed && !closeoutBoundary.release_check_execution_performed && !closeoutBoundary.review_completed && !closeoutBoundary.approval_applied && !closeoutBoundary.artifact_overwrite_performed, "Reproducibility closeout is read-only and does not run checks, apply approval, complete review, or overwrite artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !closeoutBoundary.artifact_regeneration_performed && !closeoutBoundary.history_import_performed && !closeoutBoundary.repository_checkout_changed && !closeoutBoundary.git_operation_performed && !closeoutBoundary.protected_action_executed, "Reproducibility closeout performs no artifact, history, checkout, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled_boundary", !closeoutBoundary.trading_live_enabled && !closeoutBoundary.trading_full_auto_enabled && !closeoutBoundary.trading_order_submission_allowed && !closeoutBoundary.broker_write_allowed, "Trading live/full-auto/order submission and broker writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only_boundary", !closeoutBoundary.desktop_source_of_truth && !closeoutBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ operatorReview, closeoutRows, closeoutGateRows, closeoutBoundary, validation }) {
  return {
    platform_reproducibility_closeout_status: validation.valid ? "ready" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_reproducibility_operator_review_status: operatorReview.summary.platform_reproducibility_operator_review_status,
    reproducibility_closeout_count: closeoutRows.length,
    ready_reproducibility_closeout_count: closeoutRows.filter((row) => row.reproducibility_closeout_status === "ready").length,
    reproducibility_closeout_gate_count: closeoutGateRows.length,
    ready_reproducibility_closeout_gate_count: closeoutGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: closeoutBoundary.read_only,
    report_only: closeoutBoundary.report_only,
    command_execution_performed: closeoutBoundary.command_execution_performed,
    release_check_execution_performed: closeoutBoundary.release_check_execution_performed,
    review_completed: closeoutBoundary.review_completed,
    approval_applied: closeoutBoundary.approval_applied,
    proof_materialized: closeoutBoundary.proof_materialized,
    artifact_read_performed: closeoutBoundary.artifact_read_performed,
    evidence_collected: closeoutBoundary.evidence_collected,
    dependency_install_performed: closeoutBoundary.dependency_install_performed,
    package_mutation_performed: closeoutBoundary.package_mutation_performed,
    lockfile_mutation_performed: closeoutBoundary.lockfile_mutation_performed,
    artifact_overwrite_performed: closeoutBoundary.artifact_overwrite_performed,
    artifact_regeneration_performed: closeoutBoundary.artifact_regeneration_performed,
    history_import_performed: closeoutBoundary.history_import_performed,
    repository_checkout_changed: closeoutBoundary.repository_checkout_changed,
    git_operation_performed: closeoutBoundary.git_operation_performed,
    release_published: closeoutBoundary.release_published,
    recovery_execution_performed: closeoutBoundary.recovery_execution_performed,
    protected_action_executed: closeoutBoundary.protected_action_executed,
    desktop_source_of_truth: closeoutBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: closeoutBoundary.desktop_mutation_allowed,
    trading_live_enabled: closeoutBoundary.trading_live_enabled,
    trading_full_auto_enabled: closeoutBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: closeoutBoundary.trading_order_submission_allowed,
    broker_write_allowed: closeoutBoundary.broker_write_allowed,
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
    "# Platform Reproducibility Closeout",
    "",
    `Status: ${result.summary.platform_reproducibility_closeout_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source reproducibility operator review: ${result.summary.source_reproducibility_operator_review_status}`,
    `Closeout rows: ${result.summary.ready_reproducibility_closeout_count}/${result.summary.reproducibility_closeout_count}`,
    `Closeout gates: ${result.summary.ready_reproducibility_closeout_gate_count}/${result.summary.reproducibility_closeout_gate_count}`,
    "",
    "## Closeout Rows",
    "",
    ...result.reproducibility_closeout_rows.map((row) => `- ${row.source_phase_slot} ${row.package_script_name}: ${row.reproducibility_closeout_status}`),
    "",
    "## Closeout Gates",
    "",
    ...result.reproducibility_closeout_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_OUT_DIR };
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
    else if (arg === "--reproducibility-operator-review-schema") parsed.reproducibilityOperatorReviewSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/platform-reproducibility-closeout.mjs [options]

Options:
  --out-dir <folder>                    Output directory. Default: ${DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_OUT_DIR}
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
  --reproducibility-operator-review-schema <path> P359 operator review schema path.
  --gitignore <path>                    .gitignore path.
  --schema <path>                       Output schema path.
  --check                               Validate only, do not write artifacts.
  -h, --help                            Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.packagePath),
    package_lock_path: path.resolve(options.packageLockPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.packageLockPath),
    nvmrc_path: path.resolve(options.nvmrcPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.nvmrcPath),
    node_version_path: path.resolve(options.nodeVersionPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.nodeVersionPath),
    npmrc_path: path.resolve(options.npmrcPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.npmrcPath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.platformOpsLedgerPath),
    trading_phase_ledger_path: path.resolve(options.tradingPhaseLedgerPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.tradingPhaseLedgerPath),
    baseline_schema_path: path.resolve(options.baselineSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.baselineSchemaPath),
    drift_schema_path: path.resolve(options.driftSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.driftSchemaPath),
    replay_window_schema_path: path.resolve(options.replayWindowSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.replayWindowSchemaPath),
    operator_handoff_schema_path: path.resolve(options.operatorHandoffSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.operatorHandoffSchemaPath),
    artifact_guard_schema_path: path.resolve(options.artifactGuardSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.artifactGuardSchemaPath),
    provenance_ledger_schema_path: path.resolve(options.provenanceLedgerSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.provenanceLedgerSchemaPath),
    release_bundle_provenance_schema_path: path.resolve(options.releaseBundleProvenanceSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.releaseBundleProvenanceSchemaPath),
    signed_tag_provenance_schema_path: path.resolve(options.signedTagProvenanceSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.signedTagProvenanceSchemaPath),
    provenance_freeze_preflight_schema_path: path.resolve(options.provenanceFreezePreflightSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.provenanceFreezePreflightSchemaPath),
    provenance_freeze_schema_path: path.resolve(options.provenanceFreezeSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.provenanceFreezeSchemaPath),
    mac_windows_replay_notes_schema_path: path.resolve(options.macWindowsReplayNotesSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.macWindowsReplayNotesSchemaPath),
    lockfile_policy_schema_path: path.resolve(options.lockfilePolicySchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.lockfilePolicySchemaPath),
    replay_handoff_map_schema_path: path.resolve(options.replayHandoffMapSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.replayHandoffMapSchemaPath),
    replay_evidence_checklist_schema_path: path.resolve(options.replayEvidenceChecklistSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.replayEvidenceChecklistSchemaPath),
    replay_handoff_closeout_schema_path: path.resolve(options.replayHandoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.replayHandoffCloseoutSchemaPath),
    reproducibility_check_registry_schema_path: path.resolve(options.reproducibilityCheckRegistrySchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.reproducibilityCheckRegistrySchemaPath),
    reproducibility_evidence_matrix_schema_path: path.resolve(options.reproducibilityEvidenceMatrixSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.reproducibilityEvidenceMatrixSchemaPath),
    reproducibility_proof_index_schema_path: path.resolve(options.reproducibilityProofIndexSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.reproducibilityProofIndexSchemaPath),
    reproducibility_operator_review_schema_path: path.resolve(options.reproducibilityOperatorReviewSchemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.reproducibilityOperatorReviewSchemaPath),
    gitignore_path: path.resolve(options.gitignorePath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.gitignorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_REPRODUCIBILITY_CLOSEOUT_INPUTS.schemaPath),
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
    validation_item_id: `platform-reproducibility-closeout.${slugify(itemPath)}.${checkId}`,
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
