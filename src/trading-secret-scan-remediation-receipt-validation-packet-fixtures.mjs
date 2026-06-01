import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_MERGE_PREFLIGHT_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationReceiptMergePreflightFixtures,
} from "./trading-secret-scan-remediation-receipt-merge-preflight-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_PACKET_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-validation-packet-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_MERGE_PREFLIGHT_FIXTURES_INPUTS,
  secretScanRemediationReceiptMergePreflightSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_MERGE_PREFLIGHT_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-validation-packet-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-validation-packet-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_validation_packet_fixtures";
const PHASE_SLOT = "P435";
const PREVIOUS_PHASE_SLOT = "P434";
const NEXT_PHASE_SLOT = "P436";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_validation_packet";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_merge_preflight";
const SOURCE_ROW_READY_STATUS = "ready_for_future_secret_scan_remediation_receipt_validation";
const PACKET_READY_STATUS = "ready_for_future_secret_scan_remediation_receipt_validation_packet";
const COMMAND_NAME = "trading:secret-scan-remediation-receipt-validation-packet-fixtures";
const VALIDATION_PACKET_CHECKS = [
  "reviewer_id_present",
  "reviewed_at_iso_timestamp",
  "source_template_key_matches",
  "source_intake_key_matches",
  "receipt_template_id_matches",
  "remediation_action_reference_present",
  "external_removal_or_rotation_reference_present",
  "clean_rerun_reference_present",
  "human_closeout_decision_allowed",
  "evidence_reference_present",
];

export async function runTradingSecretScanRemediationReceiptValidationPacketFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptValidationPacketFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptValidationPacketFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt validation packet fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptValidationPacketFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_PACKET_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const mergePreflight = await buildTradingSecretScanRemediationReceiptMergePreflightFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    controlPlaneHumanGateReceiptsPath: inputs.control_plane_human_gate_receipts_path,
    secretScanRemediationReceiptTemplateSchemaPath: inputs.secret_scan_remediation_receipt_template_schema_path,
    secretScanRemediationReceiptIntakeSchemaPath: inputs.secret_scan_remediation_receipt_intake_schema_path,
    secretScanRemediationReceiptValidationRulesSchemaPath: inputs.secret_scan_remediation_receipt_validation_rules_schema_path,
    secretScanRemediationReceiptWorkspaceSchemaPath: inputs.secret_scan_remediation_receipt_workspace_schema_path,
    secretScanRemediationReceiptWorkspaceMergeSchemaPath: inputs.secret_scan_remediation_receipt_workspace_merge_schema_path,
    schemaPath: inputs.secret_scan_remediation_receipt_merge_preflight_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const packetRows = buildPacketRows(mergePreflight);
  const coverage = buildPacketCoverage({ mergePreflight, packetRows });
  const anchor = buildPacketAnchor(mergePreflight, coverage);
  const boundary = buildPacketBoundary({ generatedAt, writeRequested: options.write !== false, mergePreflight, packetRows, coverage });
  const gateRows = buildPacketGateRows({ mergePreflight, packageJson, platformOpsLedger, boundary, coverage });
  const validationItems = buildValidationItems({ mergePreflight, packageJson, platformOpsLedger, packetRows, gateRows, boundary, coverage });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ mergePreflight, packetRows, gateRows, boundary, coverage, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_scan_remediation_receipt_validation_packet_fixtures_id: `trading-secret-scan-remediation-receipt-validation-packet-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_scan_remediation_receipt_validation_packet_anchor: anchor,
    secret_scan_remediation_receipt_validation_packet_rows: packetRows,
    secret_scan_remediation_receipt_validation_packet_gate_rows: gateRows,
    secret_scan_remediation_receipt_validation_packet_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_validation_packet_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ mergePreflight, packetRows, gateRows, boundary, coverage, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_validation_packet_fixtures_id = result.trading_secret_scan_remediation_receipt_validation_packet_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptValidationPacketFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-validation-packet-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-validation-packet-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-validation-packet-rows.v1", "secret_scan_remediation_receipt_validation_packet_rows", result.secret_scan_remediation_receipt_validation_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-validation-packet-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-validation-packet-gate-rows.v1", "secret_scan_remediation_receipt_validation_packet_gate_rows", result.secret_scan_remediation_receipt_validation_packet_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-validation-packet-boundary.json"), result.secret_scan_remediation_receipt_validation_packet_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-remediation-receipt-validation-packet-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptValidationPacketFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptValidationPacketFixtures(args);
    console.log(`Trading secret scan remediation receipt validation packet fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_validation_packet_fixtures_status}`);
    console.log(`Secret scan remediation receipt validation packet rows: ${result.summary.ready_secret_scan_remediation_receipt_validation_packet_row_count}/${result.summary.secret_scan_remediation_receipt_validation_packet_row_count}`);
    console.log(`Secret scan remediation receipt validation packet gates: ${result.summary.ready_secret_scan_remediation_receipt_validation_packet_gate_count}/${result.summary.secret_scan_remediation_receipt_validation_packet_gate_count}`);
    console.log(`Receipt validated: ${result.summary.receipt_validated}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPacketRows(mergePreflight) {
  const sourceReady = mergePreflight.validation.valid && mergePreflight.summary.trading_secret_scan_remediation_receipt_merge_preflight_fixtures_status === SOURCE_READY_STATUS;
  return mergePreflight.secret_scan_remediation_receipt_merge_preflight_rows.map((preflightRow, index) => {
    const packetReady = sourceReady && preflightRow.preflight_status === SOURCE_ROW_READY_STATUS;
    const row = {
      schema_version: "trading-secret-scan-remediation-receipt-validation-packet-row.v1",
      secret_scan_remediation_receipt_validation_packet_row_id: `trading-secret-scan-remediation-receipt-validation-packet.row.${preflightRow.template_key}`,
      phase_slot: PHASE_SLOT,
      source_merge_preflight_row_id: preflightRow.secret_scan_remediation_receipt_merge_preflight_row_id,
      source_workspace_merge_row_id: preflightRow.source_workspace_merge_row_id,
      source_workspace_row_id: preflightRow.source_workspace_row_id,
      source_validation_rule_row_id: preflightRow.source_validation_rule_row_id,
      source_receipt_template_id: preflightRow.source_receipt_template_id,
      template_key: preflightRow.template_key,
      intake_key: preflightRow.intake_key,
      validation_packet_status: packetReady ? PACKET_READY_STATUS : "blocked",
      source_merge_preflight_status: preflightRow.preflight_status,
      external_human_workspace_reference: preflightRow.external_human_workspace_reference,
      required_receipt_fields: preflightRow.required_receipt_fields,
      allowed_outcomes: preflightRow.allowed_outcomes,
      receipt_merge_preflight_consumed_in_memory: true,
      receipt_merge_preflight_artifact_read_performed_by_packet: false,
      actor_workspace_required: true,
      actor_workspace_input_present: false,
      actor_workspace_file_read_by_packet: false,
      actor_workspace_payload_read_by_packet: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      validation_packet_declared: true,
      validation_packet_checks: VALIDATION_PACKET_CHECKS,
      ready_for_validation: false,
      receipt_received_by_packet: false,
      receipt_validated_by_packet: false,
      receipt_application_performed_by_packet: false,
      approval_applied_by_packet: false,
      secret_values_read_by_packet: false,
      env_file_read_by_packet: false,
      desktop_config_content_inspected_by_packet: false,
      desktop_config_read_by_packet: false,
      raw_secret_material_materialized_by_packet: false,
      raw_secret_material_exposed_by_packet: false,
      provider_key_material_present_by_packet: false,
      auto_fix_command_registered_by_packet: false,
      auto_redaction_allowed_by_packet: false,
      auto_deletion_allowed_by_packet: false,
      auto_rotation_allowed_by_packet: false,
      credential_lookup_allowed_by_packet: false,
      plaintext_secret_allowed_by_packet: false,
      model_context_secret_allowed_by_packet: false,
      broker_write_allowed_by_packet: false,
      exchange_write_allowed_by_packet: false,
      command_execution_performed_by_packet: false,
      package_command_execution_performed_by_packet: false,
      release_check_execution_performed_by_packet: false,
      artifact_read_performed_by_packet: false,
      artifact_write_performed_by_packet: false,
      release_published_by_packet: false,
      git_operation_performed_by_packet: false,
      protected_action_executed_by_packet: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Future validation packet is declared for ${preflightRow.template_key}; no receipt payload is validated or applied.`,
    };
    return withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_validation_packet_hash");
  });
}

function buildPacketCoverage({ mergePreflight, packetRows }) {
  const sourceReady = mergePreflight.validation.valid && mergePreflight.summary.trading_secret_scan_remediation_receipt_merge_preflight_fixtures_status === SOURCE_READY_STATUS;
  const preflightRows = mergePreflight.secret_scan_remediation_receipt_merge_preflight_rows ?? [];
  const allMergePreflightRowsCovered = preflightRows.length > 0 && preflightRows.every((preflightRow) => packetRows.some((row) => row.source_merge_preflight_row_id === preflightRow.secret_scan_remediation_receipt_merge_preflight_row_id));
  const noPacketInputMaterialized = packetRows.every((row) => row.receipt_merge_preflight_artifact_read_performed_by_packet === false
    && row.actor_workspace_file_read_by_packet === false
    && row.actor_workspace_payload_read_by_packet === false
    && row.actor_workspace_input_present === false
    && row.receipt_input_file_materialized === false
    && row.merged_receipt_input_materialized === false
    && row.receipt_payload_present === false
    && row.ready_for_validation === false
    && row.receipt_validated_by_packet === false
    && row.approval_applied_by_packet === false);
  const noSecretMaterialRead = mergePreflight.summary.no_secret_material_read === true
    && mergePreflight.summary.secret_values_read === false
    && mergePreflight.summary.env_file_read === false
    && mergePreflight.summary.desktop_config_content_inspected === false
    && mergePreflight.summary.desktop_config_read === false
    && packetRows.every((row) => row.secret_values_read_by_packet === false
      && row.env_file_read_by_packet === false
      && row.desktop_config_content_inspected_by_packet === false
      && row.desktop_config_read_by_packet === false);
  const noSecretOrTradingMutation = mergePreflight.summary.no_secret_or_trading_mutation === true
    && packetRows.every((row) => row.auto_fix_command_registered_by_packet === false
      && row.auto_redaction_allowed_by_packet === false
      && row.auto_deletion_allowed_by_packet === false
      && row.auto_rotation_allowed_by_packet === false
      && row.credential_lookup_allowed_by_packet === false
      && row.broker_write_allowed_by_packet === false
      && row.exchange_write_allowed_by_packet === false
      && row.command_execution_performed_by_packet === false
      && row.artifact_write_performed_by_packet === false
      && row.protected_action_executed_by_packet === false);
  return {
    p434_ready: sourceReady,
    source_merge_preflight_row_count: preflightRows.length,
    validation_packet_row_count: packetRows.length,
    expected_validation_packet_row_count: preflightRows.length,
    all_merge_preflight_rows_covered: allMergePreflightRowsCovered,
    validation_packet_rows_ready: packetRows.every((row) => row.validation_packet_status === PACKET_READY_STATUS),
    validation_packet_declared: packetRows.every((row) => row.validation_packet_declared === true && row.validation_packet_checks.length >= 8),
    no_packet_input_materialized: noPacketInputMaterialized,
    no_secret_material_read: noSecretMaterialRead,
    no_secret_or_trading_mutation: noSecretOrTradingMutation,
  };
}

function buildPacketAnchor(mergePreflight, coverage) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-validation-packet-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_merge_preflight_fixtures_id: mergePreflight.trading_secret_scan_remediation_receipt_merge_preflight_fixtures_id,
    source_secret_scan_remediation_receipt_merge_preflight_status: mergePreflight.summary.trading_secret_scan_remediation_receipt_merge_preflight_fixtures_status,
    expected_validation_packet_row_count: coverage.expected_validation_packet_row_count,
    coverage_hash: hashValue(coverage),
    source_hash: hashValue({
      id: mergePreflight.trading_secret_scan_remediation_receipt_merge_preflight_fixtures_id,
      status: mergePreflight.summary.trading_secret_scan_remediation_receipt_merge_preflight_fixtures_status,
      preflight_rows: mergePreflight.summary.secret_scan_remediation_receipt_merge_preflight_row_count,
      gates: mergePreflight.summary.secret_scan_remediation_receipt_merge_preflight_gate_count,
    }),
  };
}

function buildPacketBoundary({ generatedAt, writeRequested, mergePreflight, packetRows, coverage }) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-validation-packet-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_scan_remediation_receipt_validation_packet_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_receipt_merge_preflight_status: mergePreflight.summary.trading_secret_scan_remediation_receipt_merge_preflight_fixtures_status,
    source_secret_scan_remediation_receipt_merge_preflight_ready: coverage.p434_ready,
    secret_scan_remediation_receipt_validation_packet_row_count: packetRows.length,
    ready_secret_scan_remediation_receipt_validation_packet_row_count: packetRows.filter((row) => row.validation_packet_status === PACKET_READY_STATUS).length,
    all_merge_preflight_rows_covered: coverage.all_merge_preflight_rows_covered,
    receipt_merge_preflight_consumed_in_memory: true,
    receipt_merge_preflight_artifact_read_performed: false,
    validation_packet_declared: coverage.validation_packet_declared,
    actor_workspace_required: true,
    actor_workspace_input_present: false,
    actor_workspace_file_read: false,
    actor_workspace_payload_read: false,
    receipt_input_file_materialized: false,
    merged_receipt_input_materialized: false,
    receipt_payload_present: false,
    ready_for_validation: false,
    receipt_received: false,
    receipt_validated: false,
    receipt_application_performed: false,
    receipt_applied: false,
    approval_applied: false,
    no_packet_input_materialized: coverage.no_packet_input_materialized,
    no_secret_material_read: coverage.no_secret_material_read,
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    desktop_config_read: false,
    raw_secret_material_materialized: false,
    raw_secret_material_exposed: false,
    provider_key_material_present: false,
    no_secret_or_trading_mutation: coverage.no_secret_or_trading_mutation,
    auto_fix_command_registered: false,
    auto_redaction_allowed: false,
    auto_deletion_allowed: false,
    auto_rotation_allowed: false,
    credential_lookup_allowed: false,
    plaintext_secret_allowed: false,
    model_context_secret_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    command_execution_performed: false,
    package_command_execution_performed: false,
    release_check_execution_performed: false,
    artifact_read_performed: false,
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildPacketGateRows({ mergePreflight, packageJson, platformOpsLedger, boundary, coverage }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const gateInputs = [
    ["p434_secret_scan_remediation_receipt_merge_preflight_ready", "P434 secret scan remediation receipt merge preflight source is ready.", mergePreflight.validation.valid && mergePreflight.summary.trading_secret_scan_remediation_receipt_merge_preflight_fixtures_status === SOURCE_READY_STATUS],
    ["platform_package_script_registered", "package.json registers the P435 trading secret scan remediation receipt validation packet fixtures command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0],
    ["platform_validation_chain_registered", "Validation chain includes the P435 trading secret scan remediation receipt validation packet fixtures command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)],
    ["p435_ledger_acceptance_declared", "P435 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P435: `trading:secret-scan-remediation-receipt-validation-packet-fixtures`")],
    ["all_merge_preflight_rows_covered", "Every P434 merge preflight row has a matching future validation packet row.", coverage.all_merge_preflight_rows_covered],
    ["validation_packet_rows_ready", "Future validation packet rows are ready without validating payloads.", coverage.validation_packet_rows_ready],
    ["validation_packet_declared", "Validation packet manifests are declared without validating receipts.", coverage.validation_packet_declared && !boundary.ready_for_validation && !boundary.receipt_validated],
    ["no_receipt_payload_validation", "No actor workspace file, actor payload, merged input, receipt payload, validation, or approval is performed.", boundary.no_packet_input_materialized && !boundary.actor_workspace_file_read && !boundary.actor_workspace_payload_read && !boundary.merged_receipt_input_materialized && !boundary.receipt_payload_present && !boundary.ready_for_validation && !boundary.receipt_validated && !boundary.approval_applied],
    ["no_secret_material_read", "P435 reads no secret values, env files, or Desktop config content.", boundary.no_secret_material_read && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read],
    ["no_secret_or_trading_mutation", "P435 performs no credential lookup, trading writes, artifact mutation, release, git, or protected action.", boundary.no_secret_or_trading_mutation && !boundary.artifact_write_performed && !boundary.protected_action_executed],
  ];
  return gateInputs.map(([rowKey, description, passed], index) => withOrdinalAndHash(gateRow(rowKey, description, passed), index, "secret_scan_remediation_receipt_validation_packet_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-validation-packet-gate-row.v1",
    secret_scan_remediation_receipt_validation_packet_gate_row_id: `trading-secret-scan-remediation-receipt-validation-packet-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    actor_workspace_file_read_by_packet: false,
    actor_workspace_payload_read_by_packet: false,
    actor_workspace_input_present_by_packet: false,
    receipt_input_file_materialized_by_packet: false,
    merged_receipt_input_materialized_by_packet: false,
    receipt_payload_present_by_packet: false,
    ready_for_validation_by_packet: false,
    receipt_received_by_packet: false,
    receipt_validated_by_packet: false,
    receipt_application_performed_by_packet: false,
    approval_applied_by_packet: false,
    secret_values_read_by_packet: false,
    env_file_read_by_packet: false,
    desktop_config_content_inspected_by_packet: false,
    desktop_config_read_by_packet: false,
    command_execution_performed_by_packet: false,
    artifact_read_performed_by_packet: false,
    artifact_write_performed_by_packet: false,
    protected_action_executed_by_packet: false,
    broker_write_allowed_by_packet: false,
    exchange_write_allowed_by_packet: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ mergePreflight, packageJson, platformOpsLedger, packetRows, gateRows, boundary, coverage }) {
  return [
    validationItem("source.secret_scan_remediation_receipt_merge_preflight", "p434_secret_scan_remediation_receipt_merge_preflight_ready", mergePreflight.validation.valid && mergePreflight.summary.trading_secret_scan_remediation_receipt_merge_preflight_fixtures_status === SOURCE_READY_STATUS, "P434 secret scan remediation receipt merge preflight fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P435 secret scan remediation receipt validation packet fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("secret_scan_remediation_receipt_validation_packet_rows", "validation_packet_rows_ready", packetRows.length === coverage.expected_validation_packet_row_count && packetRows.length === 5 && packetRows.every((row) => row.validation_packet_status === PACKET_READY_STATUS && row.validation_packet_checks.length >= 8 && row.validation_packet_declared), "All secret scan remediation receipt validation packet rows must be ready without receipt payload validation."),
    validationItem("secret_scan_remediation_receipt_validation_packet_gate_rows", "validation_packet_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_packet && !row.protected_action_executed_by_packet), "P435 secret scan remediation receipt validation packet gates are ready."),
    validationItem("coverage.merge_preflight_rows", "all_merge_preflight_rows_covered", coverage.all_merge_preflight_rows_covered, "All P434 merge preflight rows must have validation packet rows."),
    validationItem("coverage.validation_packet", "validation_packet_declared", coverage.validation_packet_declared, "Future validation packet manifests must be declared."),
    validationItem("boundary.no_packet_input", "no_packet_input_materialized", boundary.no_packet_input_materialized && !boundary.actor_workspace_input_present && !boundary.actor_workspace_file_read && !boundary.actor_workspace_payload_read && !boundary.receipt_input_file_materialized && !boundary.merged_receipt_input_materialized && !boundary.receipt_payload_present && !boundary.ready_for_validation && !boundary.receipt_validated && !boundary.approval_applied, "P435 must not read actor workspace input or materialize/validate receipt payloads."),
    validationItem("boundary.no_secret_material_read", "no_secret_material_read", boundary.no_secret_material_read && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read, "P435 reads no secret values, env files, or Desktop config content."),
    validationItem("boundary.no_mutation", "no_secret_or_trading_mutation", boundary.no_secret_or_trading_mutation && !boundary.credential_lookup_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.artifact_write_performed && !boundary.protected_action_executed, "P435 performs no credential lookup, trading mutation, artifact mutation, or protected action."),
  ];
}

function buildSummary({ mergePreflight, packetRows, gateRows, boundary, coverage, validation }) {
  return {
    trading_secret_scan_remediation_receipt_validation_packet_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_merge_preflight_status: mergePreflight.summary.trading_secret_scan_remediation_receipt_merge_preflight_fixtures_status,
    source_secret_scan_remediation_receipt_merge_preflight_ready: boundary.source_secret_scan_remediation_receipt_merge_preflight_ready,
    expected_validation_packet_row_count: coverage.expected_validation_packet_row_count,
    secret_scan_remediation_receipt_validation_packet_row_count: packetRows.length,
    ready_secret_scan_remediation_receipt_validation_packet_row_count: boundary.ready_secret_scan_remediation_receipt_validation_packet_row_count,
    secret_scan_remediation_receipt_validation_packet_gate_count: gateRows.length,
    ready_secret_scan_remediation_receipt_validation_packet_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    all_merge_preflight_rows_covered: boundary.all_merge_preflight_rows_covered,
    validation_packet_declared: boundary.validation_packet_declared,
    no_packet_input_materialized: boundary.no_packet_input_materialized,
    no_secret_material_read: boundary.no_secret_material_read,
    no_secret_or_trading_mutation: boundary.no_secret_or_trading_mutation,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    receipt_merge_preflight_consumed_in_memory: boundary.receipt_merge_preflight_consumed_in_memory,
    receipt_merge_preflight_artifact_read_performed: boundary.receipt_merge_preflight_artifact_read_performed,
    actor_workspace_required: boundary.actor_workspace_required,
    actor_workspace_input_present: boundary.actor_workspace_input_present,
    actor_workspace_file_read: boundary.actor_workspace_file_read,
    actor_workspace_payload_read: boundary.actor_workspace_payload_read,
    receipt_input_file_materialized: boundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: boundary.merged_receipt_input_materialized,
    receipt_payload_present: boundary.receipt_payload_present,
    ready_for_validation: boundary.ready_for_validation,
    receipt_received: boundary.receipt_received,
    receipt_validated: boundary.receipt_validated,
    receipt_application_performed: boundary.receipt_application_performed,
    receipt_applied: boundary.receipt_applied,
    approval_applied: boundary.approval_applied,
    secret_values_read: boundary.secret_values_read,
    env_file_read: boundary.env_file_read,
    desktop_config_content_inspected: boundary.desktop_config_content_inspected,
    desktop_config_read: boundary.desktop_config_read,
    raw_secret_material_materialized: boundary.raw_secret_material_materialized,
    raw_secret_material_exposed: boundary.raw_secret_material_exposed,
    provider_key_material_present: boundary.provider_key_material_present,
    auto_fix_command_registered: boundary.auto_fix_command_registered,
    auto_redaction_allowed: boundary.auto_redaction_allowed,
    auto_deletion_allowed: boundary.auto_deletion_allowed,
    auto_rotation_allowed: boundary.auto_rotation_allowed,
    credential_lookup_allowed: boundary.credential_lookup_allowed,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    command_execution_performed: boundary.command_execution_performed,
    artifact_read_performed: boundary.artifact_read_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    protected_action_executed: boundary.protected_action_executed,
    human_review_required: boundary.human_review_required,
    human_signoff_required: boundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Secret Scan Remediation Receipt Validation Packet Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_validation_packet_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source merge preflight: ${result.summary.source_secret_scan_remediation_receipt_merge_preflight_status}`,
    `Packet rows: ${result.summary.ready_secret_scan_remediation_receipt_validation_packet_row_count}/${result.summary.secret_scan_remediation_receipt_validation_packet_row_count}`,
    `Packet gates: ${result.summary.ready_secret_scan_remediation_receipt_validation_packet_gate_count}/${result.summary.secret_scan_remediation_receipt_validation_packet_gate_count}`,
    "",
    "## Rows",
    "",
    ...result.secret_scan_remediation_receipt_validation_packet_rows.map((row) => `- ${row.template_key}: ${row.validation_packet_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_scan_remediation_receipt_validation_packet_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_PACKET_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-template-schema") parsed.secretScanRemediationReceiptTemplateSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-intake-schema") parsed.secretScanRemediationReceiptIntakeSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-validation-rules-schema") parsed.secretScanRemediationReceiptValidationRulesSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-workspace-schema") parsed.secretScanRemediationReceiptWorkspaceSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-workspace-merge-schema") parsed.secretScanRemediationReceiptWorkspaceMergeSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-merge-preflight-schema") parsed.secretScanRemediationReceiptMergePreflightSchemaPath = argv[++index];
    else if (arg === "--control-plane-human-gate-receipts") parsed.controlPlaneHumanGateReceiptsPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else {
      parsed.__passthrough ??= [];
      parsed.__passthrough.push(arg);
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-validation-packet-fixtures.mjs [options]

Options:
  --out-dir <folder>                                                       Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_PACKET_FIXTURES_OUT_DIR}
  --run-at <iso>                                                           Deterministic generated_at timestamp.
  --package <path>                                                         package.json path.
  --platform-ops-ledger <path>                                             P341-P500 platform operations ledger path.
  --secret-scan-remediation-receipt-template-schema <path>                 P429 receipt template fixtures schema path.
  --secret-scan-remediation-receipt-intake-schema <path>                   P430 receipt intake fixtures schema path.
  --secret-scan-remediation-receipt-validation-rules-schema <path>         P431 receipt validation rules fixtures schema path.
  --secret-scan-remediation-receipt-workspace-schema <path>                P432 receipt workspace fixtures schema path.
  --secret-scan-remediation-receipt-workspace-merge-schema <path>          P433 receipt workspace merge fixtures schema path.
  --secret-scan-remediation-receipt-merge-preflight-schema <path>          P434 receipt merge preflight fixtures schema path.
  --control-plane-human-gate-receipts <path>                               Control-plane human gate receipts source path.
  --schema <path>                                                          Output schema path.
  --check                                                                  Validate only, do not write artifacts.
  -h, --help                                                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS.platformOpsLedgerPath),
    control_plane_human_gate_receipts_path: path.resolve(options.controlPlaneHumanGateReceiptsPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS.controlPlaneHumanGateReceiptsPath),
    secret_scan_remediation_receipt_template_schema_path: path.resolve(options.secretScanRemediationReceiptTemplateSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS.secretScanRemediationReceiptTemplateSchemaPath),
    secret_scan_remediation_receipt_intake_schema_path: path.resolve(options.secretScanRemediationReceiptIntakeSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS.secretScanRemediationReceiptIntakeSchemaPath),
    secret_scan_remediation_receipt_validation_rules_schema_path: path.resolve(options.secretScanRemediationReceiptValidationRulesSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS.secretScanRemediationReceiptValidationRulesSchemaPath),
    secret_scan_remediation_receipt_workspace_schema_path: path.resolve(options.secretScanRemediationReceiptWorkspaceSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS.secretScanRemediationReceiptWorkspaceSchemaPath),
    secret_scan_remediation_receipt_workspace_merge_schema_path: path.resolve(options.secretScanRemediationReceiptWorkspaceMergeSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS.secretScanRemediationReceiptWorkspaceMergeSchemaPath),
    secret_scan_remediation_receipt_merge_preflight_schema_path: path.resolve(options.secretScanRemediationReceiptMergePreflightSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS.secretScanRemediationReceiptMergePreflightSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS.schemaPath),
  };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, count: rows.length, [key]: rows };
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function withOrdinalAndHash(row, index, hashField) {
  const withoutHash = { ...row, ordinal: index + 1 };
  return { ...withoutHash, [hashField]: hashValue(withoutHash) };
}

function validationItem(pathValue, rule, passed, message) {
  return { path: pathValue, rule, status: passed ? "passed" : "failed", message };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({ path: item.path, message: item.message, rule: item.rule }));
  return { valid: errors.length === 0, error_count: errors.length, errors };
}

async function readJsonSource(filePath) {
  try {
    return { path: path.resolve(filePath), available: true, data: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return { path: path.resolve(filePath), available: false, error: error.message, data: null };
  }
}

async function readTextSource(filePath) {
  try {
    return { path: path.resolve(filePath), available: true, text: await readFile(filePath, "utf8") };
  } catch (error) {
    return { path: path.resolve(filePath), available: false, error: error.message, text: "" };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dateStamp(isoDate) {
  return isoDate.slice(0, 10).replaceAll("-", "");
}
