import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS,
  buildPlatformReleaseCheckReceiptMergePreflight,
} from "./platform-release-check-receipt-merge-preflight.mjs";

export const DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_OUT_DIR = "artifacts/platform-release-check-receipt-validation-packet/latest";
export const DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS = {
  ...DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS,
  releaseCheckReceiptMergePreflightSchemaPath: DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_MERGE_PREFLIGHT_INPUTS.schemaPath,
  schemaPath: "schemas/platform-release-check-receipt-validation-packet.schema.json",
};

const SCHEMA_VERSION = "platform-release-check-receipt-validation-packet.v1";
const CAPABILITY_ID = "platform.release_check_receipt_validation_packet";
const PHASE_SLOT = "P377";
const PREVIOUS_PHASE_SLOT = "P376";
const NEXT_PHASE_SLOT = "P378";
const VALIDATION_PACKET_CHECKS = [
  "reviewer_id_present",
  "reviewed_at_iso_timestamp",
  "source_signoff_row_id_matches",
  "decision_allowed",
  "evidence_reference_present",
  "blocker_note_present",
];

export async function runPlatformReleaseCheckReceiptValidationPacket(options = {}) {
  const result = await buildPlatformReleaseCheckReceiptValidationPacket(options);
  if (options.write !== false) await writePlatformReleaseCheckReceiptValidationPacket(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform release-check receipt validation packet failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformReleaseCheckReceiptValidationPacket(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_OUT_DIR);
  const inputs = normalizeInputs(options);
  const mergePreflight = await buildPlatformReleaseCheckReceiptMergePreflight({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    tradingReleaseCheckDocPath: inputs.trading_release_check_doc_path,
    platformOpsCheckDocPath: inputs.platform_ops_check_doc_path,
    platformReleaseCheckDocPath: inputs.platform_release_check_doc_path,
    noWriteAuditDocPath: inputs.no_write_audit_doc_path,
    releaseCheckEvidenceIndexSchemaPath: inputs.release_check_evidence_index_schema_path,
    releaseCheckReviewPacketSchemaPath: inputs.release_check_review_packet_schema_path,
    releaseCheckSignoffLedgerSchemaPath: inputs.release_check_signoff_ledger_schema_path,
    releaseCheckSignoffReceiptTemplateSchemaPath: inputs.release_check_signoff_receipt_template_schema_path,
    releaseCheckSignoffReceiptIntakeSchemaPath: inputs.release_check_signoff_receipt_intake_schema_path,
    releaseCheckSignoffCloseoutSchemaPath: inputs.release_check_signoff_closeout_schema_path,
    releaseCheckStatusLedgerSchemaPath: inputs.release_check_status_ledger_schema_path,
    releaseCheckReceiptQueueSchemaPath: inputs.release_check_receipt_queue_schema_path,
    releaseCheckReceiptValidationRulesSchemaPath: inputs.release_check_receipt_validation_rules_schema_path,
    releaseCheckReceiptWorkspaceSchemaPath: inputs.release_check_receipt_workspace_schema_path,
    releaseCheckReceiptWorkspaceMergeSchemaPath: inputs.release_check_receipt_workspace_merge_schema_path,
    schemaPath: inputs.release_check_receipt_merge_preflight_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const packetAnchor = buildPacketAnchor(mergePreflight);
  const packetRows = buildPacketRows(mergePreflight);
  const packetBoundary = buildBoundary({ generatedAt, writeRequested: options.write !== false });
  const packetGateRows = buildPacketGateRows({ mergePreflight, packageJson, platformOpsLedger, packetRows, packetBoundary });
  const validationItems = buildValidationItems({ mergePreflight, packageJson, platformOpsLedger, packetRows, packetGateRows, packetBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ mergePreflight, packetRows, packetGateRows, packetBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_release_check_receipt_validation_packet_id: `platform-release-check-receipt-validation-packet.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    release_check_receipt_validation_packet_anchor: packetAnchor,
    release_check_receipt_validation_packet_rows: packetRows,
    release_check_receipt_validation_packet_gate_rows: packetGateRows,
    release_check_receipt_validation_packet_boundary: packetBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_release_check_receipt_validation_packet") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ mergePreflight, packetRows, packetGateRows, packetBoundary, validation: result.validation });
  result.summary.platform_release_check_receipt_validation_packet_id = result.platform_release_check_receipt_validation_packet_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformReleaseCheckReceiptValidationPacket(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-release-check-receipt-validation-packet.json"), serializableResult(result));
  await writeJson(path.join(outDir, "release-check-receipt-validation-packet-rows.json"), collectionEnvelope("platform-release-check-receipt-validation-packet-rows.v1", "release_check_receipt_validation_packet_rows", result.release_check_receipt_validation_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-receipt-validation-packet-gate-rows.json"), collectionEnvelope("platform-release-check-receipt-validation-packet-gate-rows.v1", "release_check_receipt_validation_packet_gate_rows", result.release_check_receipt_validation_packet_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-check-receipt-validation-packet-boundary.json"), result.release_check_receipt_validation_packet_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-release-check-receipt-validation-packet-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformReleaseCheckReceiptValidationPacketCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformReleaseCheckReceiptValidationPacket(args);
    console.log(`Platform release-check receipt validation packet ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_release_check_receipt_validation_packet_status}`);
    console.log(`Packet rows: ${result.summary.ready_packet_row_count}/${result.summary.packet_row_count}`);
    console.log(`Packet gates: ${result.summary.ready_packet_gate_count}/${result.summary.packet_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPacketAnchor(mergePreflight) {
  return {
    schema_version: "platform-release-check-receipt-validation-packet-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_merge_preflight_id: mergePreflight.platform_release_check_receipt_merge_preflight_id,
    source_receipt_merge_preflight_status: mergePreflight.summary.platform_release_check_receipt_merge_preflight_status,
    source_receipt_merge_preflight_hash: hashValue({
      id: mergePreflight.platform_release_check_receipt_merge_preflight_id,
      status: mergePreflight.summary.platform_release_check_receipt_merge_preflight_status,
      preflight_rows: mergePreflight.summary.preflight_row_count,
      preflight_gate_rows: mergePreflight.summary.preflight_gate_count,
    }),
  };
}

function buildPacketRows(mergePreflight) {
  const sourceReady = mergePreflight.validation.valid && mergePreflight.summary.platform_release_check_receipt_merge_preflight_status === "ready_for_future_receipt_merge_validation";
  return mergePreflight.release_check_receipt_merge_preflight_rows.map((preflightRow, index) => {
    const packetStatus = sourceReady && preflightRow.preflight_status === "ready_for_future_receipt_merge_validation" ? "ready_for_future_receipt_validation_packet" : "blocked";
    const row = {
      schema_version: "platform-release-check-receipt-validation-packet-row.v1",
      release_check_receipt_validation_packet_row_id: `platform-release-check-receipt-validation-packet.row.${preflightRow.source_evidence_row_key}`,
      phase_slot: PHASE_SLOT,
      source_merge_preflight_row_id: preflightRow.release_check_receipt_merge_preflight_row_id,
      source_evidence_row_key: preflightRow.source_evidence_row_key,
      queue_position: preflightRow.queue_position,
      package_script_name: preflightRow.package_script_name,
      required_reviewer_role: preflightRow.required_reviewer_role,
      validation_packet_status: packetStatus,
      source_merge_preflight_status: preflightRow.preflight_status,
      actor_workspace_required: true,
      actor_workspace_input_present: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      validation_packet_declared: true,
      validation_packet_checks: VALIDATION_PACKET_CHECKS,
      ready_for_validation: false,
      receipt_received_by_packet: false,
      receipt_validated_by_packet: false,
      signoff_completed_by_packet: false,
      approval_applied_by_packet: false,
      receipt_merge_preflight_consumed_in_memory: true,
      receipt_merge_preflight_artifact_read_performed_by_packet: false,
      command_execution_performed_by_packet: false,
      package_command_execution_performed_by_packet: false,
      release_check_execution_performed_by_packet: false,
      artifact_read_performed_by_packet: false,
      artifact_write_performed_by_packet: false,
      release_published_by_packet: false,
      git_operation_performed_by_packet: false,
      protected_action_executed_by_packet: false,
      trading_order_submission_performed_by_packet: false,
      desktop_source_of_truth_by_packet: false,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "release_check_receipt_validation_packet_row_hash");
  });
}

function buildPacketGateRows({ mergePreflight, packageJson, platformOpsLedger, packetRows, packetBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p376_receipt_merge_preflight_ready", "P376 release-check receipt merge preflight source is ready.", mergePreflight.validation.valid && mergePreflight.summary.platform_release_check_receipt_merge_preflight_status === "ready_for_future_receipt_merge_validation"),
    gateRow("platform_package_script_registered", "package.json registers the P377 release-check receipt validation packet command.", typeof scripts["platform:release-check-receipt-validation-packet"] === "string" && scripts["platform:release-check-receipt-validation-packet"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P377 release-check receipt validation packet.", validateScript.includes("npm run platform:release-check-receipt-validation-packet -- --check")),
    gateRow("p377_ledger_acceptance_declared", "P377 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P377: `platform:release-check-receipt-validation-packet`")),
    gateRow("validation_packet_rows_ready", "All release-check receipt validation packet rows are ready for future receipt validation packets.", packetRows.length >= 4 && packetRows.every((row) => row.validation_packet_status === "ready_for_future_receipt_validation_packet" && row.validation_packet_declared && row.actor_workspace_required && !row.actor_workspace_input_present && !row.merged_receipt_input_materialized && !row.ready_for_validation)),
    gateRow("no_receipt_payload_validation", "Validation packet does not read actor files, materialize merged receipt input, receive payloads, or validate receipts.", !packetBoundary.actor_workspace_input_present && !packetBoundary.merged_receipt_input_materialized && !packetBoundary.receipt_payload_present && !packetBoundary.receipt_received && !packetBoundary.receipt_validated && !packetBoundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "Validation packet does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !packetBoundary.command_execution_performed && !packetBoundary.artifact_read_performed && !packetBoundary.artifact_write_performed && !packetBoundary.release_published && !packetBoundary.git_operation_performed && !packetBoundary.protected_action_executed),
    gateRow("trading_and_desktop_boundaries_enforced", "Trading writes remain disabled and Desktop remains outside source-of-truth boundaries.", !packetBoundary.trading_live_enabled && !packetBoundary.trading_full_auto_enabled && !packetBoundary.trading_order_submission_allowed && !packetBoundary.desktop_source_of_truth),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "release_check_receipt_validation_packet_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-release-check-receipt-validation-packet-gate-row.v1",
    release_check_receipt_validation_packet_gate_row_id: `platform-release-check-receipt-validation-packet.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    actor_workspace_input_present_by_packet: false,
    merged_receipt_input_materialized_by_packet: false,
    receipt_payload_present_by_packet: false,
    ready_for_validation_by_packet: false,
    receipt_received_by_packet: false,
    receipt_validated_by_packet: false,
    signoff_completed_by_packet: false,
    approval_applied_by_packet: false,
    receipt_merge_preflight_artifact_read_performed_by_packet: false,
    command_execution_performed_by_packet: false,
    release_check_execution_performed_by_packet: false,
    artifact_read_performed_by_packet: false,
    artifact_write_performed_by_packet: false,
    release_published_by_packet: false,
    git_operation_performed_by_packet: false,
    protected_action_executed_by_packet: false,
    trading_order_submission_performed_by_packet: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildBoundary({ generatedAt, writeRequested }) {
  return {
    schema_version: "platform-release-check-receipt-validation-packet-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    receipt_validation_packet_artifact_write_requested: writeRequested,
    receipt_merge_preflight_consumed_in_memory: true,
    receipt_merge_preflight_artifact_read_performed: false,
    validation_packet_declared: true,
    actor_workspace_input_present: false,
    receipt_input_file_materialized: false,
    merged_receipt_input_materialized: false,
    receipt_payload_present: false,
    ready_for_validation: false,
    receipt_received: false,
    receipt_validated: false,
    signoff_completed: false,
    approval_applied: false,
    command_execution_performed: false,
    package_command_execution_performed: false,
    release_check_execution_performed: false,
    artifact_read_performed: false,
    artifact_write_performed: false,
    dependency_install_performed: false,
    package_mutation_performed: false,
    lockfile_mutation_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    desktop_source_of_truth: false,
    desktop_mutation_allowed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ mergePreflight, packageJson, platformOpsLedger, packetRows, packetGateRows, packetBoundary }) {
  return [
    validationItem("source.release_check_receipt_merge_preflight", "p376_receipt_merge_preflight_ready", mergePreflight.validation.valid && mergePreflight.summary.platform_release_check_receipt_merge_preflight_status === "ready_for_future_receipt_merge_validation", "P376 release-check receipt merge preflight source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P377 receipt validation packet checks."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("release_check_receipt_validation_packet_rows", "validation_packet_rows_ready", packetRows.length >= 4 && packetRows.every((row) => row.validation_packet_status === "ready_for_future_receipt_validation_packet" && row.validation_packet_declared && row.validation_packet_checks.length >= 6 && row.actor_workspace_required && !row.actor_workspace_input_present && !row.merged_receipt_input_materialized && !row.ready_for_validation), "Release-check receipt validation packet rows must be ready for future validation packets without payloads."),
    validationItem("release_check_receipt_validation_packet_gate_rows", "validation_packet_gates_ready", packetGateRows.length >= 8 && packetGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_packet && !row.protected_action_executed_by_packet), "P377 release-check receipt validation packet gates are ready."),
    validationItem("boundary.no_receipt_payload", "no_receipt_payload", packetBoundary.read_only && packetBoundary.report_only && packetBoundary.receipt_merge_preflight_consumed_in_memory && !packetBoundary.receipt_merge_preflight_artifact_read_performed && packetBoundary.validation_packet_declared && !packetBoundary.actor_workspace_input_present && !packetBoundary.receipt_input_file_materialized && !packetBoundary.merged_receipt_input_materialized && !packetBoundary.receipt_payload_present && !packetBoundary.ready_for_validation && !packetBoundary.receipt_received && !packetBoundary.receipt_validated && !packetBoundary.signoff_completed && !packetBoundary.approval_applied, "Release-check receipt validation packet declares packet rows without materializing or validating receipts."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !packetBoundary.command_execution_performed && !packetBoundary.package_command_execution_performed && !packetBoundary.release_check_execution_performed && !packetBoundary.artifact_read_performed && !packetBoundary.artifact_write_performed, "Release-check receipt validation packet does not execute commands or read/write artifacts."),
    validationItem("boundary.no_mutation", "no_mutation", !packetBoundary.dependency_install_performed && !packetBoundary.package_mutation_performed && !packetBoundary.lockfile_mutation_performed && !packetBoundary.release_published && !packetBoundary.git_operation_performed && !packetBoundary.protected_action_executed, "Release-check receipt validation packet performs no dependency, package, lockfile, release, git, or protected mutation."),
    validationItem("boundary.trading_disabled", "trading_disabled", !packetBoundary.trading_live_enabled && !packetBoundary.trading_full_auto_enabled && !packetBoundary.trading_order_submission_allowed && !packetBoundary.broker_write_allowed && !packetBoundary.exchange_write_allowed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
    validationItem("boundary.desktop_read_only", "desktop_read_only", !packetBoundary.desktop_source_of_truth && !packetBoundary.desktop_mutation_allowed, "Desktop remains a read-only operator surface."),
  ];
}

function buildSummary({ mergePreflight, packetRows, packetGateRows, packetBoundary, validation }) {
  return {
    platform_release_check_receipt_validation_packet_status: validation.valid ? "ready_for_future_receipt_validation_packet" : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_merge_preflight_status: mergePreflight.summary.platform_release_check_receipt_merge_preflight_status,
    packet_row_count: packetRows.length,
    ready_packet_row_count: packetRows.filter((row) => row.validation_packet_status === "ready_for_future_receipt_validation_packet").length,
    packet_gate_count: packetGateRows.length,
    ready_packet_gate_count: packetGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: packetBoundary.read_only,
    report_only: packetBoundary.report_only,
    receipt_merge_preflight_consumed_in_memory: packetBoundary.receipt_merge_preflight_consumed_in_memory,
    receipt_merge_preflight_artifact_read_performed: packetBoundary.receipt_merge_preflight_artifact_read_performed,
    validation_packet_declared: packetBoundary.validation_packet_declared,
    actor_workspace_input_present: packetBoundary.actor_workspace_input_present,
    receipt_input_file_materialized: packetBoundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: packetBoundary.merged_receipt_input_materialized,
    receipt_payload_present: packetBoundary.receipt_payload_present,
    ready_for_validation: packetBoundary.ready_for_validation,
    receipt_received: packetBoundary.receipt_received,
    receipt_validated: packetBoundary.receipt_validated,
    signoff_completed: packetBoundary.signoff_completed,
    approval_applied: packetBoundary.approval_applied,
    command_execution_performed: packetBoundary.command_execution_performed,
    package_command_execution_performed: packetBoundary.package_command_execution_performed,
    release_check_execution_performed: packetBoundary.release_check_execution_performed,
    artifact_read_performed: packetBoundary.artifact_read_performed,
    artifact_write_performed: packetBoundary.artifact_write_performed,
    dependency_install_performed: packetBoundary.dependency_install_performed,
    package_mutation_performed: packetBoundary.package_mutation_performed,
    lockfile_mutation_performed: packetBoundary.lockfile_mutation_performed,
    release_published: packetBoundary.release_published,
    git_operation_performed: packetBoundary.git_operation_performed,
    protected_action_executed: packetBoundary.protected_action_executed,
    trading_live_enabled: packetBoundary.trading_live_enabled,
    trading_full_auto_enabled: packetBoundary.trading_full_auto_enabled,
    trading_order_submission_allowed: packetBoundary.trading_order_submission_allowed,
    broker_write_allowed: packetBoundary.broker_write_allowed,
    exchange_write_allowed: packetBoundary.exchange_write_allowed,
    desktop_source_of_truth: packetBoundary.desktop_source_of_truth,
    desktop_mutation_allowed: packetBoundary.desktop_mutation_allowed,
    human_review_required: packetBoundary.human_review_required,
    human_signoff_required: packetBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Release-Check Receipt Validation Packet",
    "",
    `Status: ${result.summary.platform_release_check_receipt_validation_packet_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source receipt merge preflight: ${result.summary.source_receipt_merge_preflight_status}`,
    `Packet rows: ${result.summary.ready_packet_row_count}/${result.summary.packet_row_count}`,
    `Packet gates: ${result.summary.ready_packet_gate_count}/${result.summary.packet_gate_count}`,
    "",
    "## Packet Rows",
    "",
    ...result.release_check_receipt_validation_packet_rows.map((row) => `- ${row.package_script_name} (${row.required_reviewer_role}): ${row.validation_packet_status}`),
    "",
    "## Packet Gates",
    "",
    ...result.release_check_receipt_validation_packet_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--trading-release-check-doc") parsed.tradingReleaseCheckDocPath = argv[++index];
    else if (arg === "--platform-ops-check-doc") parsed.platformOpsCheckDocPath = argv[++index];
    else if (arg === "--platform-release-check-doc") parsed.platformReleaseCheckDocPath = argv[++index];
    else if (arg === "--no-write-audit-doc") parsed.noWriteAuditDocPath = argv[++index];
    else if (arg === "--release-check-evidence-index-schema") parsed.releaseCheckEvidenceIndexSchemaPath = argv[++index];
    else if (arg === "--release-check-review-packet-schema") parsed.releaseCheckReviewPacketSchemaPath = argv[++index];
    else if (arg === "--release-check-signoff-ledger-schema") parsed.releaseCheckSignoffLedgerSchemaPath = argv[++index];
    else if (arg === "--release-check-signoff-receipt-template-schema") parsed.releaseCheckSignoffReceiptTemplateSchemaPath = argv[++index];
    else if (arg === "--release-check-signoff-receipt-intake-schema") parsed.releaseCheckSignoffReceiptIntakeSchemaPath = argv[++index];
    else if (arg === "--release-check-signoff-closeout-schema") parsed.releaseCheckSignoffCloseoutSchemaPath = argv[++index];
    else if (arg === "--release-check-status-ledger-schema") parsed.releaseCheckStatusLedgerSchemaPath = argv[++index];
    else if (arg === "--release-check-receipt-queue-schema") parsed.releaseCheckReceiptQueueSchemaPath = argv[++index];
    else if (arg === "--release-check-receipt-validation-rules-schema") parsed.releaseCheckReceiptValidationRulesSchemaPath = argv[++index];
    else if (arg === "--release-check-receipt-workspace-schema") parsed.releaseCheckReceiptWorkspaceSchemaPath = argv[++index];
    else if (arg === "--release-check-receipt-workspace-merge-schema") parsed.releaseCheckReceiptWorkspaceMergeSchemaPath = argv[++index];
    else if (arg === "--release-check-receipt-merge-preflight-schema") parsed.releaseCheckReceiptMergePreflightSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-release-check-receipt-validation-packet.mjs [options]

Options:
  --out-dir <folder>                     Output directory. Default: ${DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_OUT_DIR}
  --run-at <iso>                         Deterministic generated_at timestamp.
  --package <path>                       package.json path.
  --platform-ops-ledger <path>           P341-P500 platform operations ledger path.
  --trading-release-check-doc <path>     Trading release-check doc path.
  --platform-ops-check-doc <path>        Platform ops-check doc path.
  --platform-release-check-doc <path>    Platform release-check doc path.
  --no-write-audit-doc <path>            Release-check no-write audit doc path.
  --release-check-evidence-index-schema <path>
                                         P365 evidence index schema path.
  --release-check-review-packet-schema <path>
                                         P366 review packet schema path.
  --release-check-signoff-ledger-schema <path>
                                         P367 signoff ledger schema path.
  --release-check-signoff-receipt-template-schema <path>
                                         P368 receipt template schema path.
  --release-check-signoff-receipt-intake-schema <path>
                                         P369 receipt intake schema path.
  --release-check-signoff-closeout-schema <path>
                                         P370 closeout schema path.
  --release-check-status-ledger-schema <path>
                                         P371 status ledger schema path.
  --release-check-receipt-queue-schema <path>
                                         P372 receipt queue schema path.
  --release-check-receipt-validation-rules-schema <path>
                                         P373 receipt validation rules schema path.
  --release-check-receipt-workspace-schema <path>
                                         P374 receipt workspace schema path.
  --release-check-receipt-workspace-merge-schema <path>
                                         P375 receipt workspace merge schema path.
  --release-check-receipt-merge-preflight-schema <path>
                                         P376 receipt merge preflight schema path.
  --schema <path>                        Output schema path.
  --check                                Validate only, do not write artifacts.
  -h, --help                             Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS.platformOpsLedgerPath),
    trading_release_check_doc_path: path.resolve(options.tradingReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS.tradingReleaseCheckDocPath),
    platform_ops_check_doc_path: path.resolve(options.platformOpsCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS.platformOpsCheckDocPath),
    platform_release_check_doc_path: path.resolve(options.platformReleaseCheckDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS.platformReleaseCheckDocPath),
    no_write_audit_doc_path: path.resolve(options.noWriteAuditDocPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS.noWriteAuditDocPath),
    release_check_evidence_index_schema_path: path.resolve(options.releaseCheckEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS.releaseCheckEvidenceIndexSchemaPath),
    release_check_review_packet_schema_path: path.resolve(options.releaseCheckReviewPacketSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS.releaseCheckReviewPacketSchemaPath),
    release_check_signoff_ledger_schema_path: path.resolve(options.releaseCheckSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS.releaseCheckSignoffLedgerSchemaPath),
    release_check_signoff_receipt_template_schema_path: path.resolve(options.releaseCheckSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS.releaseCheckSignoffReceiptTemplateSchemaPath),
    release_check_signoff_receipt_intake_schema_path: path.resolve(options.releaseCheckSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS.releaseCheckSignoffReceiptIntakeSchemaPath),
    release_check_signoff_closeout_schema_path: path.resolve(options.releaseCheckSignoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS.releaseCheckSignoffCloseoutSchemaPath),
    release_check_status_ledger_schema_path: path.resolve(options.releaseCheckStatusLedgerSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS.releaseCheckStatusLedgerSchemaPath),
    release_check_receipt_queue_schema_path: path.resolve(options.releaseCheckReceiptQueueSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS.releaseCheckReceiptQueueSchemaPath),
    release_check_receipt_validation_rules_schema_path: path.resolve(options.releaseCheckReceiptValidationRulesSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS.releaseCheckReceiptValidationRulesSchemaPath),
    release_check_receipt_workspace_schema_path: path.resolve(options.releaseCheckReceiptWorkspaceSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS.releaseCheckReceiptWorkspaceSchemaPath),
    release_check_receipt_workspace_merge_schema_path: path.resolve(options.releaseCheckReceiptWorkspaceMergeSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS.releaseCheckReceiptWorkspaceMergeSchemaPath),
    release_check_receipt_merge_preflight_schema_path: path.resolve(options.releaseCheckReceiptMergePreflightSchemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS.releaseCheckReceiptMergePreflightSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_RELEASE_CHECK_RECEIPT_VALIDATION_PACKET_INPUTS.schemaPath),
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
    validation_item_id: `platform-release-check-receipt-validation-packet.${slugify(itemPath)}.${checkId}`,
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
