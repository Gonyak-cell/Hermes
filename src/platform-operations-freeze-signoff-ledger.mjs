import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATIONS_FREEZE_REVIEW_PACKET_INPUTS,
  buildPlatformOperationsFreezeReviewPacket,
} from "./platform-operations-freeze-review-packet.mjs";

export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_LEDGER_OUT_DIR = "artifacts/platform-operations-freeze-signoff-ledger/latest";
export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_LEDGER_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATIONS_FREEZE_REVIEW_PACKET_INPUTS,
  operationsFreezeReviewPacketSchemaPath: DEFAULT_PLATFORM_OPERATIONS_FREEZE_REVIEW_PACKET_INPUTS.schemaPath,
  schemaPath: "schemas/platform-operations-freeze-signoff-ledger.schema.json",
};

const COMMAND_NAME = "platform:operations-freeze-signoff-ledger";
const SCHEMA_VERSION = "platform-operations-freeze-signoff-ledger.v1";
const CAPABILITY_ID = "platform.operations_freeze_signoff_ledger";
const PHASE_SLOT = "P485";
const PREVIOUS_PHASE_SLOT = "P484";
const NEXT_PHASE_SLOT = "P486";
const REVIEW_PACKET_STATUS = "ready_for_operations_freeze_review_packet";
const SIGNOFF_LEDGER_STATUS = "ready_for_operations_freeze_signoff_ledger";

const SIGNOFF_ROLE_BY_ROW_KEY = {
  platform_release_check: "release_manager",
  trading_release_check: "trading_safety_reviewer",
  validate: "platform_operator",
  test: "qa_reviewer",
  contracts_validate: "contract_steward",
  release_freeze: "release_manager",
  control_plane_loop: "control_plane_operator",
};

export async function runPlatformOperationsFreezeSignoffLedger(options = {}) {
  const result = await buildPlatformOperationsFreezeSignoffLedger(options);
  if (options.write !== false) await writePlatformOperationsFreezeSignoffLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operations freeze signoff ledger failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperationsFreezeSignoffLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const reviewPacket = await buildPlatformOperationsFreezeReviewPacket({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    operationsFreezeSourceInventorySchemaPath: inputs.operations_freeze_source_inventory_schema_path,
    operationsFreezeCommandMatrixSchemaPath: inputs.operations_freeze_command_matrix_schema_path,
    operationsFreezeEvidenceIndexSchemaPath: inputs.operations_freeze_evidence_index_schema_path,
    schemaPath: inputs.operations_freeze_review_packet_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const signoffRows = buildSignoffRows({ reviewPacket });
  const boundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const anchor = buildAnchor({ reviewPacket, packageJson, platformOpsLedger, signoffRows });
  const gateRows = buildGateRows({
    reviewPacket,
    scripts,
    validateScript,
    ledgerText: platformOpsLedger.text ?? "",
    signoffRows,
    boundary,
  });
  const validationItems = buildValidationItems({ reviewPacket, packageJson, platformOpsLedger, signoffRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ reviewPacket, signoffRows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operations_freeze_signoff_ledger_id: `platform-operations-freeze-signoff-ledger.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operations_freeze_signoff_ledger_anchor: anchor,
    operations_freeze_signoff_rows: signoffRows,
    operations_freeze_signoff_gate_rows: gateRows,
    operations_freeze_signoff_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operations_freeze_signoff_ledger") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ reviewPacket, signoffRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_operations_freeze_signoff_ledger_id = result.platform_operations_freeze_signoff_ledger_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperationsFreezeSignoffLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-operations-freeze-signoff-ledger.json"), serializableResult(result));
  await writeJson(path.join(outDir, "freeze-signoff-ledger-rows.json"), collectionEnvelope("platform-operations-freeze-signoff-ledger-rows.v1", "operations_freeze_signoff_rows", result.operations_freeze_signoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-signoff-ledger-gate-rows.json"), collectionEnvelope("platform-operations-freeze-signoff-ledger-gates.v1", "operations_freeze_signoff_gate_rows", result.operations_freeze_signoff_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "freeze-signoff-ledger-boundary.json"), result.operations_freeze_signoff_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operations-freeze-signoff-ledger-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperationsFreezeSignoffLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperationsFreezeSignoffLedger(args);
    console.log(`Platform operations freeze signoff ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operations_freeze_signoff_ledger_status}`);
    console.log(`Signoff rows: ${result.summary.ready_signoff_row_count}/${result.summary.signoff_row_count}`);
    console.log(`Signoff gates: ${result.summary.ready_signoff_gate_count}/${result.summary.signoff_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildAnchor({ reviewPacket, packageJson, platformOpsLedger, signoffRows }) {
  return {
    schema_version: "platform-operations-freeze-signoff-ledger-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_review_packet_id: reviewPacket.platform_operations_freeze_review_packet_id,
    source_review_packet_status: reviewPacket.summary.platform_operations_freeze_review_packet_status,
    source_review_packet_hash: hashValue({
      id: reviewPacket.platform_operations_freeze_review_packet_id,
      status: reviewPacket.summary.platform_operations_freeze_review_packet_status,
      review_rows: reviewPacket.summary.review_packet_row_count,
      ready_review_rows: reviewPacket.summary.ready_review_packet_row_count,
    }),
    package_json_hash: packageJson.content_hash,
    platform_ops_ledger_hash: platformOpsLedger.content_hash,
    signoff_ledger_hash: hashValue(signoffRows.map((row) => ({
      row_key: row.source_evidence_row_key,
      signoff_status: row.signoff_status,
      required_signoff_role: row.required_signoff_role,
      expected_signoff_decision: row.expected_signoff_decision,
    }))),
  };
}

function buildSignoffRows({ reviewPacket }) {
  const sourceReady = reviewPacket.validation.valid && reviewPacket.summary.platform_operations_freeze_review_packet_status === REVIEW_PACKET_STATUS;
  return reviewPacket.operations_freeze_review_packet_rows.map((reviewRow, index) => {
    const signoffStatus = sourceReady && reviewRow.review_packet_status === "ready" ? "ready_for_human_signoff" : "blocked";
    const row = {
      schema_version: "platform-operations-freeze-signoff-ledger-row.v1",
      operations_freeze_signoff_row_id: `platform-operations-freeze-signoff-ledger.row.${reviewRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_review_packet_row_id: reviewRow.operations_freeze_review_packet_row_id,
      source_evidence_row_key: reviewRow.source_evidence_row_key,
      source_evidence_row_id: reviewRow.source_evidence_row_id,
      package_script_name: reviewRow.package_script_name,
      invocation: reviewRow.invocation,
      evidence_kind: reviewRow.evidence_kind,
      expected_report_path: reviewRow.expected_report_path,
      evidence_path_policy: reviewRow.evidence_path_policy,
      human_review_evidence_slot: reviewRow.human_review_evidence_slot,
      required_reviewer_role: reviewRow.required_reviewer_role,
      required_signoff_role: SIGNOFF_ROLE_BY_ROW_KEY[reviewRow.source_evidence_row_key] ?? reviewRow.required_reviewer_role,
      signoff_requirement_id: `operations-freeze-signoff.${slugify(reviewRow.package_script_name)}`,
      signoff_policy: "pending_human_signoff_required",
      expected_review_decision: reviewRow.expected_review_decision,
      expected_signoff_decision: "approve_ready_evidence_or_return_with_blocker",
      required_receipt_type: "human_operations_freeze_signoff_receipt",
      signoff_status: signoffStatus,
      source_review_packet_status: reviewRow.review_packet_status,
      source_evidence_status: reviewRow.source_evidence_status,
      command_matrix_row_ready: reviewRow.command_matrix_row_ready,
      evidence_path_policy_satisfied: reviewRow.evidence_path_policy_satisfied,
      review_packet_consumed_in_memory: true,
      review_packet_artifact_read_performed_by_ledger: false,
      review_completed_by_ledger: false,
      signoff_completed_by_ledger: false,
      approval_applied_by_ledger: false,
      receipt_materialized_by_ledger: false,
      receipt_received_by_ledger: false,
      command_execution_performed_by_ledger: false,
      package_command_execution_performed_by_ledger: false,
      acceptance_command_execution_performed_by_ledger: false,
      generated_artifact_read_performed_by_ledger: false,
      artifact_read_performed_by_ledger: false,
      artifact_write_performed_by_ledger: false,
      evidence_collected_by_ledger: false,
      dependency_install_performed_by_ledger: false,
      package_mutation_performed_by_ledger: false,
      lockfile_mutation_performed_by_ledger: false,
      release_published_by_ledger: false,
      git_operation_performed_by_ledger: false,
      protected_action_executed_by_ledger: false,
      protected_recovery_execution_allowed_by_ledger: false,
      trading_live_enabled_by_ledger: false,
      trading_full_auto_enabled_by_ledger: false,
      trading_order_submission_allowed_by_ledger: false,
      broker_write_allowed_by_ledger: false,
      exchange_write_allowed_by_ledger: false,
      desktop_source_of_truth_by_ledger: false,
      desktop_mutation_allowed_by_ledger: false,
      secret_exposure_allowed_by_ledger: false,
      secret_values_read_by_ledger: false,
      env_file_read_by_ledger: false,
      desktop_config_content_inspected_by_ledger: false,
      desktop_provider_key_visible_by_ledger: false,
      credential_lookup_allowed_by_ledger: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Human signoff receipt is required before treating ${reviewRow.invocation} as operations-freeze approved evidence.`,
    };
    return withOrdinalAndHash(row, index, "operations_freeze_signoff_row_hash");
  });
}

function buildGateRows({ reviewPacket, scripts, validateScript, ledgerText, signoffRows, boundary }) {
  const rows = [
    gateRow("p484_review_packet_ready", "P484 operations freeze review packet source is ready.", reviewPacket.validation.valid && reviewPacket.summary.platform_operations_freeze_review_packet_status === REVIEW_PACKET_STATUS && reviewPacket.summary.ready_review_packet_row_count === 7),
    gateRow("platform_package_script_registered", "package.json registers the P485 platform operations freeze signoff ledger command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P485 platform operations freeze signoff ledger command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p485_ledger_acceptance_declared", "P485 acceptance row is declared in the platform operations ledger.", ledgerText.includes(`P485: \`${COMMAND_NAME}\``)),
    gateRow("signoff_ledger_rows_ready", "All operations freeze signoff ledger rows are ready for human signoff.", signoffRows.length === 7 && signoffRows.every((row) => row.signoff_status === "ready_for_human_signoff")),
    gateRow("no_signoff_or_approval_application", "Signoff ledger records pending signoff without completing signoff, receiving receipts, completing review, or applying approval.", !boundary.signoff_completed && !boundary.approval_applied && !boundary.review_completed && !boundary.receipt_materialized && !boundary.receipt_received),
    gateRow("no_command_or_artifact_access", "Signoff ledger executes no commands and reads/writes no generated artifacts.", boundary.read_only && boundary.report_only && boundary.review_packet_consumed_in_memory && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.acceptance_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operations_freeze_signoff_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-operations-freeze-signoff-ledger-gate-row.v1",
    operations_freeze_signoff_gate_row_id: `platform-operations-freeze-signoff-ledger.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    review_completed_by_gate: false,
    signoff_completed_by_gate: false,
    approval_applied_by_gate: false,
    receipt_materialized_by_gate: false,
    receipt_received_by_gate: false,
    review_packet_artifact_read_performed_by_gate: false,
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
    schema_version: "platform-operations-freeze-signoff-ledger-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    signoff_ledger_artifact_write_requested: writeRequested,
    review_packet_consumed_in_memory: true,
    review_packet_artifact_read_performed: false,
    review_completed: false,
    signoff_completed: false,
    approval_applied: false,
    receipt_materialized: false,
    receipt_received: false,
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
    human_review_note: "Human signoff receipts must be collected outside P485 before any operations-freeze evidence is treated as signed off.",
  };
}

function buildValidationItems({ reviewPacket, packageJson, platformOpsLedger, signoffRows, gateRows, boundary }) {
  return [
    validationItem("source.operations_freeze_review_packet", "p484_review_packet_ready", reviewPacket.validation.valid && reviewPacket.summary.platform_operations_freeze_review_packet_status === REVIEW_PACKET_STATUS && reviewPacket.summary.ready_review_packet_row_count === 7, "P484 review packet must be ready before P485 signoff ledger."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P485 signoff ledger."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("operations_freeze_signoff_rows", "signoff_rows_ready", signoffRows.length === 7 && signoffRows.every((row) => row.signoff_status === "ready_for_human_signoff" && row.source_review_packet_status === "ready" && !row.signoff_completed_by_ledger && !row.approval_applied_by_ledger && !row.receipt_received_by_ledger && !row.command_execution_performed_by_ledger), "Every operations freeze signoff row must be ready and ledger-only."),
    validationItem("operations_freeze_signoff_gate_rows", "signoff_gates_ready", gateRows.length >= 8 && gateRows.every((row) => row.gate_status === "ready" && !row.signoff_completed_by_gate && !row.protected_action_executed_by_gate), "P485 operations freeze signoff gates must be ready and ledger-only."),
    validationItem("boundary.signoff_not_completed", "signoff_not_completed", boundary.read_only && boundary.report_only && boundary.review_packet_consumed_in_memory && !boundary.review_packet_artifact_read_performed && !boundary.review_completed && !boundary.signoff_completed && !boundary.approval_applied && !boundary.receipt_materialized && !boundary.receipt_received, "P485 signoff ledger consumes P484 in memory and does not complete review, signoff, approval, or receipt intake."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.acceptance_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed, "P485 signoff ledger does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.protected_recovery_execution_allowed, "P485 signoff ledger performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed, "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled."),
  ];
}

function buildSummary({ reviewPacket, signoffRows, gateRows, boundary, validation }) {
  return {
    platform_operations_freeze_signoff_ledger_status: validation.valid ? SIGNOFF_LEDGER_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_review_packet_status: reviewPacket.summary.platform_operations_freeze_review_packet_status,
    source_review_packet_row_count: reviewPacket.summary.review_packet_row_count,
    source_review_packet_ready_review_row_count: reviewPacket.summary.ready_review_packet_row_count,
    signoff_row_count: signoffRows.length,
    ready_signoff_row_count: signoffRows.filter((row) => row.signoff_status === "ready_for_human_signoff").length,
    signoff_gate_count: gateRows.length,
    ready_signoff_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    signoff_ledger_artifact_write_requested: boundary.signoff_ledger_artifact_write_requested,
    review_packet_consumed_in_memory: boundary.review_packet_consumed_in_memory,
    review_packet_artifact_read_performed: boundary.review_packet_artifact_read_performed,
    review_completed: boundary.review_completed,
    signoff_completed: boundary.signoff_completed,
    approval_applied: boundary.approval_applied,
    receipt_materialized: boundary.receipt_materialized,
    receipt_received: boundary.receipt_received,
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
    "# Platform Operations Freeze Signoff Ledger",
    "",
    `Status: ${result.summary.platform_operations_freeze_signoff_ledger_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source review packet: ${result.summary.source_review_packet_status}`,
    `Signoff rows: ${result.summary.ready_signoff_row_count}/${result.summary.signoff_row_count}`,
    `Signoff gates: ${result.summary.ready_signoff_gate_count}/${result.summary.signoff_gate_count}`,
    "",
    "## Signoff Rows",
    "",
    ...result.operations_freeze_signoff_rows.map((row) => `- ${row.invocation} (${row.required_signoff_role}): ${row.signoff_status}`),
    "",
    "## Signoff Gates",
    "",
    ...result.operations_freeze_signoff_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_LEDGER_OUT_DIR };
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
    else if (arg === "--review-packet-schema") parsed.operationsFreezeReviewPacketSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operations-freeze-signoff-ledger.mjs [options]

Options:
  --out-dir <folder>                  Output directory. Default: ${DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_LEDGER_OUT_DIR}
  --run-at <iso>                      Deterministic generated_at timestamp.
  --package <path>                    package.json path.
  --platform-ops-ledger <path>        P341-P500 platform operations ledger path.
  --source-inventory-schema <path>    P481 source inventory schema path.
  --command-matrix-schema <path>      P482 command matrix schema path.
  --evidence-index-schema <path>      P483 evidence index schema path.
  --review-packet-schema <path>       P484 review packet schema path.
  --schema <path>                     Output schema path.
  --check                             Validate only, do not write artifacts.
  -h, --help                          Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_LEDGER_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_LEDGER_INPUTS.platformOpsLedgerPath),
    operations_freeze_source_inventory_schema_path: path.resolve(options.operationsFreezeSourceInventorySchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_LEDGER_INPUTS.operationsFreezeSourceInventorySchemaPath),
    operations_freeze_command_matrix_schema_path: path.resolve(options.operationsFreezeCommandMatrixSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_LEDGER_INPUTS.operationsFreezeCommandMatrixSchemaPath),
    operations_freeze_evidence_index_schema_path: path.resolve(options.operationsFreezeEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_LEDGER_INPUTS.operationsFreezeEvidenceIndexSchemaPath),
    operations_freeze_review_packet_schema_path: path.resolve(options.operationsFreezeReviewPacketSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_LEDGER_INPUTS.operationsFreezeReviewPacketSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_SIGNOFF_LEDGER_INPUTS.schemaPath),
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
    validation_item_id: `platform-operations-freeze-signoff-ledger.${slugify(itemPath)}.${checkId}`,
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
