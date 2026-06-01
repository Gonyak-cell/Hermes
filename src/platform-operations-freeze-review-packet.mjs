import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATIONS_FREEZE_EVIDENCE_INDEX_INPUTS,
  buildPlatformOperationsFreezeEvidenceIndex,
} from "./platform-operations-freeze-evidence-index.mjs";

export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_REVIEW_PACKET_OUT_DIR = "artifacts/platform-operations-freeze-review-packet/latest";
export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_REVIEW_PACKET_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATIONS_FREEZE_EVIDENCE_INDEX_INPUTS,
  operationsFreezeEvidenceIndexSchemaPath: DEFAULT_PLATFORM_OPERATIONS_FREEZE_EVIDENCE_INDEX_INPUTS.schemaPath,
  schemaPath: "schemas/platform-operations-freeze-review-packet.schema.json",
};

const COMMAND_NAME = "platform:operations-freeze-review-packet";
const SCHEMA_VERSION = "platform-operations-freeze-review-packet.v1";
const CAPABILITY_ID = "platform.operations_freeze_review_packet";
const PHASE_SLOT = "P484";
const PREVIOUS_PHASE_SLOT = "P483";
const NEXT_PHASE_SLOT = "P485";
const EVIDENCE_INDEX_STATUS = "ready_for_operations_freeze_evidence_index";
const REVIEW_PACKET_STATUS = "ready_for_operations_freeze_review_packet";

const REVIEW_ROLE_BY_ROW_KEY = {
  platform_release_check: "release_manager",
  trading_release_check: "trading_safety_reviewer",
  validate: "platform_operator",
  test: "qa_reviewer",
  contracts_validate: "contract_steward",
  release_freeze: "release_manager",
  control_plane_loop: "control_plane_operator",
};

export async function runPlatformOperationsFreezeReviewPacket(options = {}) {
  const result = await buildPlatformOperationsFreezeReviewPacket(options);
  if (options.write !== false) await writePlatformOperationsFreezeReviewPacket(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operations freeze review packet failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperationsFreezeReviewPacket(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_REVIEW_PACKET_OUT_DIR);
  const inputs = normalizeInputs(options);
  const evidenceIndex = await buildPlatformOperationsFreezeEvidenceIndex({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    operationsFreezeSourceInventorySchemaPath: inputs.operations_freeze_source_inventory_schema_path,
    operationsFreezeCommandMatrixSchemaPath: inputs.operations_freeze_command_matrix_schema_path,
    schemaPath: inputs.operations_freeze_evidence_index_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const reviewRows = buildReviewRows({ evidenceIndex });
  const boundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const anchor = buildAnchor({ evidenceIndex, packageJson, platformOpsLedger, reviewRows });
  const gateRows = buildGateRows({ evidenceIndex, scripts, validateScript, ledgerText: platformOpsLedger.text ?? "", reviewRows, boundary });
  const validationItems = buildValidationItems({ evidenceIndex, packageJson, platformOpsLedger, reviewRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ evidenceIndex, reviewRows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operations_freeze_review_packet_id: `platform-operations-freeze-review-packet.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operations_freeze_review_packet_anchor: anchor,
    operations_freeze_review_packet_rows: reviewRows,
    operations_freeze_review_packet_gate_rows: gateRows,
    operations_freeze_review_packet_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operations_freeze_review_packet") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ evidenceIndex, reviewRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_operations_freeze_review_packet_id = result.platform_operations_freeze_review_packet_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperationsFreezeReviewPacket(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-operations-freeze-review-packet.json"), serializableResult(result));
  await writeJson(path.join(outDir, "freeze-review-packet-rows.json"), collectionEnvelope("platform-operations-freeze-review-packet-rows.v1", "operations_freeze_review_packet_rows", result.operations_freeze_review_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-review-packet-gate-rows.json"), collectionEnvelope("platform-operations-freeze-review-packet-gates.v1", "operations_freeze_review_packet_gate_rows", result.operations_freeze_review_packet_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-review-packet-boundary.json"), result.operations_freeze_review_packet_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operations-freeze-review-packet-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperationsFreezeReviewPacketCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperationsFreezeReviewPacket(args);
    console.log(`Platform operations freeze review packet ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operations_freeze_review_packet_status}`);
    console.log(`Review rows: ${result.summary.ready_review_packet_row_count}/${result.summary.review_packet_row_count}`);
    console.log(`Review gates: ${result.summary.ready_review_packet_gate_count}/${result.summary.review_packet_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildAnchor({ evidenceIndex, packageJson, platformOpsLedger, reviewRows }) {
  return {
    schema_version: "platform-operations-freeze-review-packet-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_evidence_index_id: evidenceIndex.platform_operations_freeze_evidence_index_id,
    source_evidence_index_status: evidenceIndex.summary.platform_operations_freeze_evidence_index_status,
    source_evidence_index_hash: hashValue({
      id: evidenceIndex.platform_operations_freeze_evidence_index_id,
      status: evidenceIndex.summary.platform_operations_freeze_evidence_index_status,
      evidence_rows: evidenceIndex.summary.evidence_row_count,
      ready_evidence_rows: evidenceIndex.summary.ready_evidence_row_count,
    }),
    package_json_hash: packageJson.content_hash,
    platform_ops_ledger_hash: platformOpsLedger.content_hash,
    review_packet_hash: hashValue(reviewRows.map((row) => ({
      row_key: row.source_evidence_row_key,
      review_packet_status: row.review_packet_status,
      required_reviewer_role: row.required_reviewer_role,
      expected_review_decision: row.expected_review_decision,
    }))),
  };
}

function buildReviewRows({ evidenceIndex }) {
  const sourceReady = evidenceIndex.validation.valid && evidenceIndex.summary.platform_operations_freeze_evidence_index_status === EVIDENCE_INDEX_STATUS;
  return evidenceIndex.operations_freeze_evidence_rows.map((evidenceRow, index) => {
    const packetStatus = sourceReady && evidenceRow.evidence_status === "ready" ? "ready" : "blocked";
    const row = {
      schema_version: "platform-operations-freeze-review-packet-row.v1",
      operations_freeze_review_packet_row_id: `platform-operations-freeze-review-packet.row.${evidenceRow.row_key}`,
      phase_slot: PHASE_SLOT,
      source_evidence_row_key: evidenceRow.row_key,
      source_evidence_row_id: evidenceRow.operations_freeze_evidence_row_id,
      package_script_name: evidenceRow.package_script_name,
      invocation: evidenceRow.invocation,
      evidence_kind: evidenceRow.evidence_kind,
      expected_report_path: evidenceRow.expected_report_path,
      evidence_path_policy: evidenceRow.evidence_path_policy,
      human_review_evidence_slot: evidenceRow.human_review_evidence_slot,
      required_reviewer_role: REVIEW_ROLE_BY_ROW_KEY[evidenceRow.row_key] ?? "platform_operator",
      expected_review_decision: "accept_ready_evidence_or_return_with_blocker",
      review_packet_status: packetStatus,
      source_evidence_status: evidenceRow.evidence_status,
      command_matrix_row_ready: evidenceRow.command_matrix_row_ready,
      evidence_path_policy_satisfied: evidenceRow.evidence_path_policy_satisfied,
      evidence_index_consumed_in_memory: true,
      review_completed_by_packet: false,
      approval_applied_by_packet: false,
      evidence_index_artifact_read_performed_by_packet: false,
      command_execution_performed_by_packet: false,
      package_command_execution_performed_by_packet: false,
      acceptance_command_execution_performed_by_packet: false,
      generated_artifact_read_performed_by_packet: false,
      artifact_read_performed_by_packet: false,
      artifact_write_performed_by_packet: false,
      evidence_collected_by_packet: false,
      package_mutation_performed_by_packet: false,
      lockfile_mutation_performed_by_packet: false,
      release_published_by_packet: false,
      git_operation_performed_by_packet: false,
      protected_action_executed_by_packet: false,
      protected_recovery_execution_allowed_by_packet: false,
      trading_live_enabled_by_packet: false,
      trading_full_auto_enabled_by_packet: false,
      trading_order_submission_allowed_by_packet: false,
      broker_write_allowed_by_packet: false,
      exchange_write_allowed_by_packet: false,
      desktop_source_of_truth_by_packet: false,
      desktop_mutation_allowed_by_packet: false,
      secret_exposure_allowed_by_packet: false,
      secret_values_read_by_packet: false,
      env_file_read_by_packet: false,
      desktop_config_content_inspected_by_packet: false,
      desktop_provider_key_visible_by_packet: false,
      credential_lookup_allowed_by_packet: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Review ${evidenceRow.invocation} evidence slot ${evidenceRow.human_review_evidence_slot} and latest operator-run output before treating this freeze command as approved.`,
    };
    return withOrdinalAndHash(row, index, "operations_freeze_review_packet_row_hash");
  });
}

function buildGateRows({ evidenceIndex, scripts, validateScript, ledgerText, reviewRows, boundary }) {
  const rows = [
    gateRow("p483_evidence_index_ready", "P483 operations freeze evidence index source is ready.", evidenceIndex.validation.valid && evidenceIndex.summary.platform_operations_freeze_evidence_index_status === EVIDENCE_INDEX_STATUS && evidenceIndex.summary.ready_evidence_row_count === 7),
    gateRow("platform_package_script_registered", "package.json registers the P484 platform operations freeze review packet command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P484 platform operations freeze review packet command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p484_ledger_acceptance_declared", "P484 acceptance row is declared in the platform operations ledger.", ledgerText.includes(`P484: \`${COMMAND_NAME}\``)),
    gateRow("review_packet_rows_ready", "All operations freeze review packet rows are ready.", reviewRows.length === 7 && reviewRows.every((row) => row.review_packet_status === "ready")),
    gateRow("no_review_or_approval_application", "Review packet records required review without completing review or applying approval.", !boundary.review_completed && !boundary.approval_applied),
    gateRow("no_command_or_artifact_access", "Review packet executes no commands and reads/writes no generated artifacts.", boundary.read_only && boundary.report_only && boundary.evidence_index_consumed_in_memory && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.acceptance_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operations_freeze_review_packet_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-operations-freeze-review-packet-gate-row.v1",
    operations_freeze_review_packet_gate_row_id: `platform-operations-freeze-review-packet.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    review_completed_by_gate: false,
    approval_applied_by_gate: false,
    evidence_index_artifact_read_performed_by_gate: false,
    command_execution_performed_by_gate: false,
    package_command_execution_performed_by_gate: false,
    acceptance_command_execution_performed_by_gate: false,
    generated_artifact_read_performed_by_gate: false,
    artifact_read_performed_by_gate: false,
    artifact_write_performed_by_gate: false,
    release_published_by_gate: false,
    git_operation_performed_by_gate: false,
    protected_action_executed_by_gate: false,
    protected_recovery_execution_allowed_by_gate: false,
    trading_order_submission_performed_by_gate: false,
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
    schema_version: "platform-operations-freeze-review-packet-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    review_packet_artifact_write_requested: writeRequested,
    review_completed: false,
    approval_applied: false,
    evidence_index_consumed_in_memory: true,
    evidence_index_artifact_read_performed: false,
    evidence_collected: false,
    command_execution_performed: false,
    package_command_execution_performed: false,
    acceptance_command_execution_performed: false,
    generated_artifact_read_performed: false,
    artifact_read_performed: false,
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
    human_review_note: "An operator must review P484 packet rows and the latest acceptance-command outputs before relying on them as operations-freeze readiness evidence.",
  };
}

function buildValidationItems({ evidenceIndex, packageJson, platformOpsLedger, reviewRows, gateRows, boundary }) {
  return [
    validationItem("source.operations_freeze_evidence_index", "p483_evidence_index_ready", evidenceIndex.validation.valid && evidenceIndex.summary.platform_operations_freeze_evidence_index_status === EVIDENCE_INDEX_STATUS && evidenceIndex.summary.ready_evidence_row_count === 7, "P483 evidence index must be ready before P484 review packet."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P484 review packet."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("operations_freeze_review_packet_rows", "review_packet_rows_ready", reviewRows.length === 7 && reviewRows.every((row) => row.review_packet_status === "ready" && row.source_evidence_status === "ready" && row.evidence_path_policy_satisfied && !row.review_completed_by_packet && !row.approval_applied_by_packet && !row.command_execution_performed_by_packet), "Every operations freeze review packet row must be ready and report-only."),
    validationItem("operations_freeze_review_packet_gate_rows", "review_packet_gates_ready", gateRows.length >= 8 && gateRows.every((row) => row.gate_status === "ready" && !row.approval_applied_by_gate && !row.protected_action_executed_by_gate), "P484 operations freeze review packet gates must be ready and report-only."),
    validationItem("boundary.review_not_completed", "review_not_completed", boundary.read_only && boundary.report_only && !boundary.review_completed && !boundary.approval_applied && boundary.evidence_index_consumed_in_memory && !boundary.evidence_index_artifact_read_performed, "P484 review packet consumes P483 in memory and does not complete review or apply approval."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.acceptance_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed, "P484 review packet does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.protected_recovery_execution_allowed, "P484 review packet performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed, "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled."),
  ];
}

function buildSummary({ evidenceIndex, reviewRows, gateRows, boundary, validation }) {
  return {
    platform_operations_freeze_review_packet_status: validation.valid ? REVIEW_PACKET_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_evidence_index_status: evidenceIndex.summary.platform_operations_freeze_evidence_index_status,
    source_evidence_index_row_count: evidenceIndex.summary.evidence_row_count,
    source_evidence_index_ready_evidence_row_count: evidenceIndex.summary.ready_evidence_row_count,
    review_packet_row_count: reviewRows.length,
    ready_review_packet_row_count: reviewRows.filter((row) => row.review_packet_status === "ready").length,
    review_packet_gate_count: gateRows.length,
    ready_review_packet_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    review_packet_artifact_write_requested: boundary.review_packet_artifact_write_requested,
    review_completed: boundary.review_completed,
    approval_applied: boundary.approval_applied,
    evidence_index_consumed_in_memory: boundary.evidence_index_consumed_in_memory,
    evidence_index_artifact_read_performed: boundary.evidence_index_artifact_read_performed,
    evidence_collected: boundary.evidence_collected,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
    acceptance_command_execution_performed: boundary.acceptance_command_execution_performed,
    generated_artifact_read_performed: boundary.generated_artifact_read_performed,
    artifact_read_performed: boundary.artifact_read_performed,
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
    "# Platform Operations Freeze Review Packet",
    "",
    `Status: ${result.summary.platform_operations_freeze_review_packet_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source evidence index: ${result.summary.source_evidence_index_status}`,
    `Review rows: ${result.summary.ready_review_packet_row_count}/${result.summary.review_packet_row_count}`,
    `Review gates: ${result.summary.ready_review_packet_gate_count}/${result.summary.review_packet_gate_count}`,
    "",
    "## Review Rows",
    "",
    ...result.operations_freeze_review_packet_rows.map((row) => `- ${row.invocation} (${row.required_reviewer_role}): ${row.review_packet_status}`),
    "",
    "## Review Gates",
    "",
    ...result.operations_freeze_review_packet_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATIONS_FREEZE_REVIEW_PACKET_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--source-inventory-schema") parsed.operationsFreezeSourceInventorySchemaPath = argv[++index];
    else if (arg === "--command-matrix-schema") parsed.operationsFreezeCommandMatrixSchemaPath = argv[++index];
    else if (arg === "--evidence-index-schema") parsed.operationsFreezeEvidenceIndexSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operations-freeze-review-packet.mjs [options]

Options:
  --out-dir <folder>                  Output directory. Default: ${DEFAULT_PLATFORM_OPERATIONS_FREEZE_REVIEW_PACKET_OUT_DIR}
  --run-at <iso>                      Deterministic generated_at timestamp.
  --package <path>                    package.json path.
  --platform-ops-ledger <path>        P341-P500 platform operations ledger path.
  --source-inventory-schema <path>    P481 source inventory schema path.
  --command-matrix-schema <path>      P482 command matrix schema path.
  --evidence-index-schema <path>      P483 evidence index schema path.
  --schema <path>                     Output schema path.
  --check                             Validate only, do not write artifacts.
  -h, --help                          Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_REVIEW_PACKET_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_REVIEW_PACKET_INPUTS.platformOpsLedgerPath),
    operations_freeze_source_inventory_schema_path: path.resolve(options.operationsFreezeSourceInventorySchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_REVIEW_PACKET_INPUTS.operationsFreezeSourceInventorySchemaPath),
    operations_freeze_command_matrix_schema_path: path.resolve(options.operationsFreezeCommandMatrixSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_REVIEW_PACKET_INPUTS.operationsFreezeCommandMatrixSchemaPath),
    operations_freeze_evidence_index_schema_path: path.resolve(options.operationsFreezeEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_REVIEW_PACKET_INPUTS.operationsFreezeEvidenceIndexSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_REVIEW_PACKET_INPUTS.schemaPath),
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
    validation_item_id: `platform-operations-freeze-review-packet.${slugify(itemPath)}.${checkId}`,
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
