import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATIONS_FREEZE_COMMAND_MATRIX_INPUTS,
  buildPlatformOperationsFreezeCommandMatrix,
} from "./platform-operations-freeze-command-matrix.mjs";

export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_EVIDENCE_INDEX_OUT_DIR = "artifacts/platform-operations-freeze-evidence-index/latest";
export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_EVIDENCE_INDEX_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATIONS_FREEZE_COMMAND_MATRIX_INPUTS,
  operationsFreezeCommandMatrixSchemaPath: DEFAULT_PLATFORM_OPERATIONS_FREEZE_COMMAND_MATRIX_INPUTS.schemaPath,
  schemaPath: "schemas/platform-operations-freeze-evidence-index.schema.json",
};

const COMMAND_NAME = "platform:operations-freeze-evidence-index";
const SCHEMA_VERSION = "platform-operations-freeze-evidence-index.v1";
const CAPABILITY_ID = "platform.operations_freeze_evidence_index";
const PHASE_SLOT = "P483";
const PREVIOUS_PHASE_SLOT = "P482";
const NEXT_PHASE_SLOT = "P484";
const COMMAND_MATRIX_STATUS = "ready_for_operations_freeze_command_matrix";
const EVIDENCE_INDEX_STATUS = "ready_for_operations_freeze_evidence_index";

const EVIDENCE_SPECS = [
  evidenceSpec("platform_release_check", "generated_report", "artifacts/platform-release-check/latest", "platform-release-check.json"),
  evidenceSpec("trading_release_check", "generated_report", "artifacts/trading-release-check/latest", "trading-release-check.json"),
  evidenceSpec("validate", "aggregate_command", null, null, "validate is an aggregate command chain; the evidence is the captured command result, not a generated report."),
  evidenceSpec("test", "test_runner", null, null, "npm test is a test runner; the evidence is the captured test result, not a generated report."),
  evidenceSpec("contracts_validate", "generated_report", "artifacts/contract-validation-suite/latest", "contract-validation-suite.json"),
  evidenceSpec("release_freeze", "generated_report", "artifacts/v1-freeze/latest", "v1-freeze.json"),
  evidenceSpec("control_plane_loop", "loop_report", "artifacts/control-plane-loop/latest", "control-plane-loop.json"),
];

export async function runPlatformOperationsFreezeEvidenceIndex(options = {}) {
  const result = await buildPlatformOperationsFreezeEvidenceIndex(options);
  if (options.write !== false) await writePlatformOperationsFreezeEvidenceIndex(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operations freeze evidence index failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperationsFreezeEvidenceIndex(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_EVIDENCE_INDEX_OUT_DIR);
  const inputs = normalizeInputs(options);
  const commandMatrix = await buildPlatformOperationsFreezeCommandMatrix({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    operationsFreezeSourceInventorySchemaPath: inputs.operations_freeze_source_inventory_schema_path,
    schemaPath: inputs.operations_freeze_command_matrix_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const evidenceRows = buildEvidenceRows({ commandMatrix });
  const boundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const anchor = buildAnchor({ commandMatrix, packageJson, platformOpsLedger, evidenceRows });
  const gateRows = buildGateRows({ commandMatrix, scripts, validateScript, ledgerText: platformOpsLedger.text ?? "", evidenceRows, boundary });
  const validationItems = buildValidationItems({ commandMatrix, packageJson, platformOpsLedger, evidenceRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ commandMatrix, evidenceRows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operations_freeze_evidence_index_id: `platform-operations-freeze-evidence-index.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operations_freeze_evidence_index_anchor: anchor,
    operations_freeze_evidence_rows: evidenceRows,
    operations_freeze_evidence_gate_rows: gateRows,
    operations_freeze_evidence_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operations_freeze_evidence_index") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ commandMatrix, evidenceRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_operations_freeze_evidence_index_id = result.platform_operations_freeze_evidence_index_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperationsFreezeEvidenceIndex(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-operations-freeze-evidence-index.json"), serializableResult(result));
  await writeJson(path.join(outDir, "freeze-evidence-rows.json"), collectionEnvelope("platform-operations-freeze-evidence-rows.v1", "operations_freeze_evidence_rows", result.operations_freeze_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-evidence-gate-rows.json"), collectionEnvelope("platform-operations-freeze-evidence-gates.v1", "operations_freeze_evidence_gate_rows", result.operations_freeze_evidence_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-evidence-boundary.json"), result.operations_freeze_evidence_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operations-freeze-evidence-index-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperationsFreezeEvidenceIndexCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperationsFreezeEvidenceIndex(args);
    console.log(`Platform operations freeze evidence index ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operations_freeze_evidence_index_status}`);
    console.log(`Evidence rows: ${result.summary.ready_evidence_row_count}/${result.summary.evidence_row_count}`);
    console.log(`Freeze evidence gates: ${result.summary.ready_freeze_evidence_gate_count}/${result.summary.freeze_evidence_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function evidenceSpec(rowKey, evidenceKind, expectedArtifactDir, expectedReportFile, noArtifactReason = null) {
  return {
    row_key: rowKey,
    evidence_kind: evidenceKind,
    expected_artifact_dir: expectedArtifactDir,
    expected_report_file: expectedReportFile,
    no_artifact_reason: noArtifactReason,
  };
}

function buildAnchor({ commandMatrix, packageJson, platformOpsLedger, evidenceRows }) {
  return {
    schema_version: "platform-operations-freeze-evidence-index-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_command_matrix_id: commandMatrix.platform_operations_freeze_command_matrix_id,
    source_command_matrix_status: commandMatrix.summary.platform_operations_freeze_command_matrix_status,
    source_command_matrix_hash: hashValue({
      id: commandMatrix.platform_operations_freeze_command_matrix_id,
      status: commandMatrix.summary.platform_operations_freeze_command_matrix_status,
      command_rows: commandMatrix.summary.command_row_count,
      ready_command_rows: commandMatrix.summary.ready_command_row_count,
    }),
    package_json_hash: packageJson.content_hash,
    platform_ops_ledger_hash: platformOpsLedger.content_hash,
    evidence_index_hash: hashValue(evidenceRows.map((row) => ({
      row_key: row.row_key,
      evidence_status: row.evidence_status,
      expected_report_path: row.expected_report_path,
      human_review_evidence_slot: row.human_review_evidence_slot,
    }))),
  };
}

function buildEvidenceRows({ commandMatrix }) {
  const commandRowsByKey = new Map(commandMatrix.operations_freeze_command_matrix_rows.map((row) => [row.row_key, row]));
  const sourceReady = commandMatrix.validation.valid && commandMatrix.summary.platform_operations_freeze_command_matrix_status === COMMAND_MATRIX_STATUS;
  return EVIDENCE_SPECS.map((spec, index) => {
    const commandRow = commandRowsByKey.get(spec.row_key);
    const commandMatrixRowReady = commandRow?.command_matrix_status === "ready";
    const expectedReportPath = spec.expected_artifact_dir && spec.expected_report_file
      ? `${spec.expected_artifact_dir}/${spec.expected_report_file}`
      : null;
    const expectedArtifactDeclared = spec.expected_artifact_dir === null
      ? Boolean(spec.no_artifact_reason)
      : Boolean(spec.expected_artifact_dir && spec.expected_report_file && expectedReportPath);
    const evidencePathPolicy = expectedReportPath ? "generated_artifact_path_declared" : "command_result_capture_required";
    const evidencePathPolicySatisfied = expectedArtifactDeclared;
    const humanReviewEvidenceSlot = `operations-freeze.p483.${spec.row_key}.human-review`;
    const ready = sourceReady
      && commandMatrixRowReady
      && Boolean(commandRow?.package_script_registered)
      && Boolean(commandRow?.ledger_acceptance_declared)
      && Boolean(commandRow?.check_mode_policy_satisfied)
      && evidencePathPolicySatisfied
      && Boolean(humanReviewEvidenceSlot);
    const row = {
      schema_version: "platform-operations-freeze-evidence-row.v1",
      operations_freeze_evidence_row_id: `platform-operations-freeze-evidence-index.row.${spec.row_key}`,
      phase_slot: PHASE_SLOT,
      row_key: spec.row_key,
      command_role: commandRow?.command_role ?? null,
      package_script_name: commandRow?.package_script_name ?? null,
      invocation: commandRow?.invocation ?? null,
      evidence_kind: spec.evidence_kind,
      evidence_status: ready ? "ready" : "blocked",
      source_command_matrix_row_id: commandRow?.operations_freeze_command_matrix_row_id ?? null,
      command_matrix_row_ready: commandMatrixRowReady,
      package_script_registered: Boolean(commandRow?.package_script_registered),
      ledger_acceptance_declared: Boolean(commandRow?.ledger_acceptance_declared),
      check_mode_required: Boolean(commandRow?.check_mode_required),
      check_mode_policy_satisfied: Boolean(commandRow?.check_mode_policy_satisfied),
      expected_artifact_dir: spec.expected_artifact_dir,
      expected_report_file: spec.expected_report_file,
      expected_report_path: expectedReportPath,
      expected_artifact_declared: expectedArtifactDeclared,
      evidence_path_policy: evidencePathPolicy,
      evidence_path_policy_satisfied: evidencePathPolicySatisfied,
      no_artifact_reason: spec.no_artifact_reason,
      human_review_evidence_slot: humanReviewEvidenceSlot,
      human_review_required: true,
      human_signoff_required: true,
      command_execution_performed_by_index: false,
      package_command_execution_performed_by_index: false,
      generated_artifact_read_performed_by_index: false,
      artifact_write_performed_by_index: false,
      package_mutation_performed_by_index: false,
      lockfile_mutation_performed_by_index: false,
      release_published_by_index: false,
      git_operation_performed_by_index: false,
      protected_action_executed_by_index: false,
      protected_recovery_execution_allowed_by_index: false,
      trading_live_enabled_by_index: false,
      trading_full_auto_enabled_by_index: false,
      trading_order_submission_allowed_by_index: false,
      broker_write_allowed_by_index: false,
      exchange_write_allowed_by_index: false,
      desktop_source_of_truth_by_index: false,
      desktop_mutation_allowed_by_index: false,
      secret_exposure_allowed_by_index: false,
      secret_values_read_by_index: false,
      env_file_read_by_index: false,
      desktop_config_content_inspected_by_index: false,
      desktop_provider_key_visible_by_index: false,
      credential_lookup_allowed_by_index: false,
    };
    return withOrdinalAndHash(row, index, "operations_freeze_evidence_row_hash");
  });
}

function buildGateRows({ commandMatrix, scripts, validateScript, ledgerText, evidenceRows, boundary }) {
  const rows = [
    gateRow("p482_command_matrix_ready", "P482 operations freeze command matrix is ready.", commandMatrix.validation.valid && commandMatrix.summary.platform_operations_freeze_command_matrix_status === COMMAND_MATRIX_STATUS && commandMatrix.summary.ready_command_row_count === 7),
    gateRow("platform_package_script_registered", "package.json registers the P483 platform operations freeze evidence index command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P483 platform operations freeze evidence index command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p483_ledger_acceptance_declared", "P483 acceptance row is declared in the platform operations ledger.", ledgerText.includes(`P483: \`${COMMAND_NAME}\``)),
    gateRow("evidence_rows_ready", "All freeze acceptance command evidence rows are ready.", evidenceRows.length === EVIDENCE_SPECS.length && evidenceRows.every((row) => row.evidence_status === "ready")),
    gateRow("human_review_slots_declared", "Every evidence row has a human-review proof slot.", evidenceRows.every((row) => row.human_review_required && row.human_signoff_required && row.human_review_evidence_slot.startsWith("operations-freeze.p483."))),
    gateRow("no_generated_artifact_read_or_command_execution", "The evidence index executes no commands and reads no generated artifacts.", boundary.read_only && boundary.report_only && boundary.command_matrix_consumed_in_memory && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_write_performed),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operations_freeze_evidence_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-operations-freeze-evidence-gate-row.v1",
    operations_freeze_evidence_gate_row_id: `platform-operations-freeze-evidence-index.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    command_execution_performed_by_gate: false,
    package_command_execution_performed_by_gate: false,
    generated_artifact_read_performed_by_gate: false,
    artifact_write_performed_by_gate: false,
    package_mutation_performed_by_gate: false,
    lockfile_mutation_performed_by_gate: false,
    release_published_by_gate: false,
    git_operation_performed_by_gate: false,
    protected_action_executed_by_gate: false,
    protected_recovery_execution_allowed_by_gate: false,
    trading_live_enabled_by_gate: false,
    trading_full_auto_enabled_by_gate: false,
    trading_order_submission_allowed_by_gate: false,
    broker_write_allowed_by_gate: false,
    exchange_write_allowed_by_gate: false,
    desktop_source_of_truth_by_gate: false,
    desktop_mutation_allowed_by_gate: false,
    secret_exposure_allowed_by_gate: false,
    secret_values_read_by_gate: false,
    env_file_read_by_gate: false,
    desktop_config_content_inspected_by_gate: false,
    desktop_provider_key_visible_by_gate: false,
    credential_lookup_allowed_by_gate: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-operations-freeze-evidence-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    evidence_index_artifact_write_requested: writeRequested,
    command_matrix_consumed_in_memory: true,
    command_execution_performed: false,
    package_command_execution_performed: false,
    generated_artifact_read_performed: false,
    artifact_write_performed: false,
    dependency_install_performed: false,
    package_mutation_performed: false,
    lockfile_mutation_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    protected_recovery_execution_allowed: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    desktop_source_of_truth: false,
    desktop_mutation_allowed: false,
    secret_exposure_allowed: false,
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    desktop_provider_key_visible: false,
    credential_lookup_allowed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ commandMatrix, packageJson, platformOpsLedger, evidenceRows, gateRows, boundary }) {
  return [
    validationItem("source.operations_freeze_command_matrix", "p482_command_matrix_ready", commandMatrix.validation.valid && commandMatrix.summary.platform_operations_freeze_command_matrix_status === COMMAND_MATRIX_STATUS && commandMatrix.summary.ready_command_row_count === 7, "P482 command matrix must be ready before P483 evidence index."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P483 evidence index."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("operations_freeze_evidence_rows", "evidence_rows_ready", evidenceRows.length === EVIDENCE_SPECS.length && evidenceRows.every((row) => row.evidence_status === "ready" && row.human_review_evidence_slot), "Every freeze acceptance command must have a ready evidence row and human-review slot."),
    validationItem("operations_freeze_evidence_rows.path_policy", "evidence_path_policy_ready", evidenceRows.every((row) => row.evidence_path_policy_satisfied && row.expected_artifact_declared), "Every evidence row must declare either a generated report path or a command-result capture policy."),
    validationItem("operations_freeze_evidence_gate_rows", "freeze_evidence_gates_ready", gateRows.length >= 8 && gateRows.every((row) => row.gate_status === "ready" && !row.command_execution_performed_by_gate && !row.protected_action_executed_by_gate), "P483 evidence gates must be ready."),
    validationItem("boundary.no_execution", "no_execution", boundary.read_only && boundary.report_only && boundary.command_matrix_consumed_in_memory && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_write_performed, "P483 evidence index must not execute commands or read/write generated artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.protected_recovery_execution_allowed, "P483 evidence index must not mutate dependencies, package files, lockfiles, releases, git state, or protected recovery state."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed, "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled."),
  ];
}

function buildSummary({ commandMatrix, evidenceRows, gateRows, boundary, validation }) {
  return {
    platform_operations_freeze_evidence_index_status: validation.valid ? EVIDENCE_INDEX_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_command_matrix_status: commandMatrix.summary.platform_operations_freeze_command_matrix_status,
    source_command_matrix_row_count: commandMatrix.summary.command_row_count,
    source_command_matrix_ready_command_row_count: commandMatrix.summary.ready_command_row_count,
    evidence_row_count: evidenceRows.length,
    ready_evidence_row_count: evidenceRows.filter((row) => row.evidence_status === "ready").length,
    generated_report_evidence_row_count: evidenceRows.filter((row) => row.expected_report_path).length,
    command_result_capture_row_count: evidenceRows.filter((row) => !row.expected_report_path && row.no_artifact_reason).length,
    human_review_slot_count: evidenceRows.filter((row) => row.human_review_evidence_slot).length,
    freeze_evidence_gate_count: gateRows.length,
    ready_freeze_evidence_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    evidence_index_artifact_write_requested: boundary.evidence_index_artifact_write_requested,
    command_matrix_consumed_in_memory: boundary.command_matrix_consumed_in_memory,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
    generated_artifact_read_performed: boundary.generated_artifact_read_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    dependency_install_performed: boundary.dependency_install_performed,
    package_mutation_performed: boundary.package_mutation_performed,
    lockfile_mutation_performed: boundary.lockfile_mutation_performed,
    release_published: boundary.release_published,
    git_operation_performed: boundary.git_operation_performed,
    protected_action_executed: boundary.protected_action_executed,
    protected_recovery_execution_allowed: boundary.protected_recovery_execution_allowed,
    trading_live_enabled: boundary.trading_live_enabled,
    trading_full_auto_enabled: boundary.trading_full_auto_enabled,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    desktop_source_of_truth: boundary.desktop_source_of_truth,
    desktop_mutation_allowed: boundary.desktop_mutation_allowed,
    secret_exposure_allowed: boundary.secret_exposure_allowed,
    secret_values_read: boundary.secret_values_read,
    env_file_read: boundary.env_file_read,
    desktop_config_content_inspected: boundary.desktop_config_content_inspected,
    desktop_provider_key_visible: boundary.desktop_provider_key_visible,
    credential_lookup_allowed: boundary.credential_lookup_allowed,
    human_review_required: boundary.human_review_required,
    human_signoff_required: boundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Operations Freeze Evidence Index",
    "",
    `Status: ${result.summary.platform_operations_freeze_evidence_index_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source command matrix: ${result.summary.source_command_matrix_status}`,
    `Evidence rows: ${result.summary.ready_evidence_row_count}/${result.summary.evidence_row_count}`,
    `Freeze evidence gates: ${result.summary.ready_freeze_evidence_gate_count}/${result.summary.freeze_evidence_gate_count}`,
    "",
    "## Evidence Rows",
    "",
    ...result.operations_freeze_evidence_rows.map((row) => `- ${row.invocation}: ${row.evidence_status} (${row.expected_report_path ?? row.evidence_path_policy})`),
    "",
    "## Freeze Evidence Gates",
    "",
    ...result.operations_freeze_evidence_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATIONS_FREEZE_EVIDENCE_INDEX_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--source-inventory-schema") parsed.operationsFreezeSourceInventorySchemaPath = argv[++index];
    else if (arg === "--command-matrix-schema") parsed.operationsFreezeCommandMatrixSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operations-freeze-evidence-index.mjs [options]

Options:
  --out-dir <folder>                  Output directory. Default: ${DEFAULT_PLATFORM_OPERATIONS_FREEZE_EVIDENCE_INDEX_OUT_DIR}
  --run-at <iso>                      Deterministic generated_at timestamp.
  --package <path>                    package.json path.
  --platform-ops-ledger <path>        P341-P500 platform operations ledger path.
  --source-inventory-schema <path>    P481 source inventory schema path.
  --command-matrix-schema <path>      P482 command matrix schema path.
  --schema <path>                     Output schema path.
  --check                             Validate only, do not write artifacts.
  -h, --help                          Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_EVIDENCE_INDEX_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_EVIDENCE_INDEX_INPUTS.platformOpsLedgerPath),
    operations_freeze_source_inventory_schema_path: path.resolve(options.operationsFreezeSourceInventorySchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_EVIDENCE_INDEX_INPUTS.operationsFreezeSourceInventorySchemaPath),
    operations_freeze_command_matrix_schema_path: path.resolve(options.operationsFreezeCommandMatrixSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_EVIDENCE_INDEX_INPUTS.operationsFreezeCommandMatrixSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_EVIDENCE_INDEX_INPUTS.schemaPath),
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

async function readJsonSource(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return { path: filePath, available: true, data: JSON.parse(raw), content_hash: sha256(raw) };
  } catch (error) {
    return { path: filePath, available: false, data: null, content_hash: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, text, content_hash: sha256(text) };
  } catch (error) {
    return { path: filePath, available: false, text: "", content_hash: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `platform-operations-freeze-evidence-index.${slugify(itemPath)}.${checkId}`,
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

function withOrdinalAndHash(row, index, hashKey) {
  const rowWithOrdinal = { ...row, ordinal: index + 1 };
  return { ...rowWithOrdinal, [hashKey]: hashValue(rowWithOrdinal) };
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
