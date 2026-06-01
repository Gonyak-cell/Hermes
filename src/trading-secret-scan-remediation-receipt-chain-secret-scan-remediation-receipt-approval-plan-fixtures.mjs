import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptValidationPacketFixtures,
} from "./trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-validation-packet-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS,
  secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationPacketSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_fixtures";
const PHASE_SLOT = "P462";
const PREVIOUS_PHASE_SLOT = "P461";
const NEXT_PHASE_SLOT = "P463";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet";
const SOURCE_ROW_READY_STATUS = "ready_for_future_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet";
const PLAN_READY_STATUS = "ready_for_future_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan";
const COMMAND_NAME = "trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-fixtures";
const APPROVAL_PLAN_CHECKS = [
  "validation_packet_ready",
  "future_receipt_decision_allows_closeout",
  "reviewer_role_matches_packet",
  "remediation_action_reference_confirmed",
  "external_removal_or_rotation_reference_confirmed",
  "clean_rerun_reference_confirmed",
  "human_gate_application_future_only",
  "secret_material_boundary_stays_false",
  "trading_write_boundary_stays_false",
  "protected_action_boundary_stays_false",
];

export async function runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalPlanFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalPlanFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalPlanFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt chain secret scan remediation receipt approval plan fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalPlanFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const validationPacket = await buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptValidationPacketFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_schema_path,
    secretScanRemediationReceiptChainSecretScanAttentionSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_attention_schema_path,
    secretScanRemediationReceiptChainSecretScanFailClosedSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_fail_closed_schema_path,
    secretScanRemediationReceiptChainSecretScanRemediationSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_schema_path,
    controlPlaneHumanGateReceiptsPath: inputs.control_plane_human_gate_receipts_path,
    reviewDashboardPath: inputs.review_dashboard_path,
    controlPlaneActionPlanPath: inputs.control_plane_action_plan_path,
    secretScanRemediationReceiptChainSecretScanRemediationReceiptTemplateSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_template_schema_path,
    secretScanRemediationReceiptChainSecretScanRemediationReceiptIntakeSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_intake_schema_path,
    secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationRulesSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_rules_schema_path,
    secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_schema_path,
    secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceMergeSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_schema_path,
    secretScanRemediationReceiptChainSecretScanRemediationReceiptMergePreflightSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_merge_preflight_schema_path,
    schemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const planRows = buildPlanRows(validationPacket);
  const coverage = buildPlanCoverage({ validationPacket, planRows });
  const anchor = buildPlanAnchor(validationPacket, coverage);
  const boundary = buildPlanBoundary({ generatedAt, writeRequested: options.write !== false, validationPacket, planRows, coverage });
  const gateRows = buildPlanGateRows({ validationPacket, packageJson, platformOpsLedger, boundary, coverage });
  const validationItems = buildValidationItems({ validationPacket, packageJson, platformOpsLedger, planRows, gateRows, boundary, coverage });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ validationPacket, planRows, gateRows, boundary, coverage, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_fixtures_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_anchor: anchor,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_rows: planRows,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_gate_rows: gateRows,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ validationPacket, planRows, gateRows, boundary, coverage, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_fixtures_id = result.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalPlanFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-rows.v1", "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_rows", result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-gate-rows.v1", "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_gate_rows", result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-boundary.json"), result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalPlanFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalPlanFixtures(args);
    console.log(`Trading secret scan remediation receipt chain secret scan remediation receipt approval plan fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_fixtures_status}`);
    console.log(`Secret scan remediation receipt approval plan rows: ${result.summary.ready_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_row_count}/${result.summary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_row_count}`);
    console.log(`Secret scan remediation receipt approval plan gates: ${result.summary.ready_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_gate_count}/${result.summary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_gate_count}`);
    console.log(`Receipt validated: ${result.summary.receipt_validated}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPlanRows(validationPacket) {
  const sourceReady = validationPacket.validation.valid && validationPacket.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_fixtures_status === SOURCE_READY_STATUS;
  return validationPacket.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_rows.map((packetRow, index) => {
    const planReady = sourceReady && packetRow.validation_packet_status === SOURCE_ROW_READY_STATUS;
    const row = {
      schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-row.v1",
      secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan.row.${packetRow.template_key}`,
      phase_slot: PHASE_SLOT,
      source_validation_packet_row_id: packetRow.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_row_id,
      source_workspace_merge_row_id: packetRow.source_workspace_merge_row_id,
      source_workspace_row_id: packetRow.source_workspace_row_id,
      source_validation_rule_row_id: packetRow.source_validation_rule_row_id,
      source_receipt_template_id: packetRow.source_receipt_template_id,
      template_key: packetRow.template_key,
      intake_key: packetRow.intake_key,
      approval_plan_status: planReady ? PLAN_READY_STATUS : "blocked",
      source_validation_packet_status: packetRow.validation_packet_status,
      external_human_workspace_reference: packetRow.external_human_workspace_reference,
      required_receipt_fields: packetRow.required_receipt_fields,
      allowed_outcomes: packetRow.allowed_outcomes,
      receipt_validation_packet_consumed_in_memory: true,
      receipt_validation_packet_artifact_read_performed_by_plan: false,
      actor_workspace_required: true,
      actor_workspace_input_present: false,
      actor_workspace_file_read_by_plan: false,
      actor_workspace_payload_read_by_plan: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      approval_plan_declared: true,
      approval_plan_checks: APPROVAL_PLAN_CHECKS,
      ready_for_validation: false,
      ready_for_approval_application: false,
      receipt_received_by_plan: false,
      receipt_validated_by_plan: false,
      receipt_application_performed_by_plan: false,
      approval_applied_by_plan: false,
      secret_values_read_by_plan: false,
      env_file_read_by_plan: false,
      desktop_config_content_inspected_by_plan: false,
      desktop_config_read_by_plan: false,
      raw_secret_material_materialized_by_plan: false,
      raw_secret_material_exposed_by_plan: false,
      provider_key_material_present_by_plan: false,
      desktop_provider_key_visible_by_plan: false,
      forbidden_receipt_fields_allowed_by_plan: false,
      secret_scan_remediation_action_allowed_by_plan: false,
      auto_fix_command_registered_by_plan: false,
      auto_redaction_allowed_by_plan: false,
      auto_deletion_allowed_by_plan: false,
      auto_rotation_allowed_by_plan: false,
      credential_lookup_allowed_by_plan: false,
      plaintext_secret_allowed_by_plan: false,
      model_context_secret_allowed_by_plan: false,
      broker_write_allowed_by_plan: false,
      exchange_write_allowed_by_plan: false,
      command_execution_performed_by_plan: false,
      package_command_execution_performed_by_plan: false,
      release_check_execution_performed_by_plan: false,
      artifact_read_performed_by_plan: false,
      artifact_write_performed_by_plan: false,
      release_published_by_plan: false,
      git_operation_performed_by_plan: false,
      protected_action_executed_by_plan: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Future approval plan is declared for ${packetRow.template_key}; no receipt payload is validated or applied.`,
    };
    return withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_hash");
  });
}

function buildPlanCoverage({ validationPacket, planRows }) {
  const sourceReady = validationPacket.validation.valid && validationPacket.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_fixtures_status === SOURCE_READY_STATUS;
  const packetRows = validationPacket.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_rows ?? [];
  const allValidationPacketRowsCovered = packetRows.length > 0 && packetRows.every((packetRow) => planRows.some((row) => row.source_validation_packet_row_id === packetRow.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_row_id));
  const noPlanInputMaterialized = planRows.every((row) => row.receipt_validation_packet_artifact_read_performed_by_plan === false
    && row.actor_workspace_file_read_by_plan === false
    && row.actor_workspace_payload_read_by_plan === false
    && row.actor_workspace_input_present === false
    && row.receipt_input_file_materialized === false
    && row.merged_receipt_input_materialized === false
    && row.receipt_payload_present === false
    && row.ready_for_validation === false
    && row.ready_for_approval_application === false
    && row.receipt_validated_by_plan === false
    && row.approval_applied_by_plan === false);
  const noSecretMaterialRead = validationPacket.summary.no_secret_material_read === true
    && validationPacket.summary.secret_values_read === false
    && validationPacket.summary.env_file_read === false
    && validationPacket.summary.desktop_config_content_inspected === false
    && validationPacket.summary.desktop_config_read === false
    && validationPacket.summary.desktop_provider_key_visible === false
    && planRows.every((row) => row.secret_values_read_by_plan === false
      && row.env_file_read_by_plan === false
      && row.desktop_config_content_inspected_by_plan === false
      && row.desktop_config_read_by_plan === false
      && row.desktop_provider_key_visible_by_plan === false);
  const noSecretOrTradingMutation = validationPacket.summary.no_secret_or_trading_mutation === true
    && validationPacket.summary.secret_scan_remediation_action_allowed === false
    && planRows.every((row) => row.auto_fix_command_registered_by_plan === false
      && row.secret_scan_remediation_action_allowed_by_plan === false
      && row.auto_redaction_allowed_by_plan === false
      && row.auto_deletion_allowed_by_plan === false
      && row.auto_rotation_allowed_by_plan === false
      && row.credential_lookup_allowed_by_plan === false
      && row.broker_write_allowed_by_plan === false
      && row.exchange_write_allowed_by_plan === false
      && row.command_execution_performed_by_plan === false
      && row.artifact_write_performed_by_plan === false
      && row.protected_action_executed_by_plan === false);
  return {
    p461_ready: sourceReady,
    source_validation_packet_row_count: packetRows.length,
    approval_plan_row_count: planRows.length,
    expected_approval_plan_row_count: packetRows.length,
    all_validation_packet_rows_covered: allValidationPacketRowsCovered,
    approval_plan_rows_ready: planRows.every((row) => row.approval_plan_status === PLAN_READY_STATUS),
    approval_plan_declared: planRows.every((row) => row.approval_plan_declared === true && row.approval_plan_checks.length >= 8),
    no_plan_input_materialized: noPlanInputMaterialized,
    no_secret_material_read: noSecretMaterialRead,
    no_secret_or_trading_mutation: noSecretOrTradingMutation,
  };
}

function buildPlanAnchor(validationPacket, coverage) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_fixtures_id: validationPacket.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_fixtures_id,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_status: validationPacket.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_fixtures_status,
    expected_approval_plan_row_count: coverage.expected_approval_plan_row_count,
    coverage_hash: hashValue(coverage),
    source_hash: hashValue({
      id: validationPacket.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_fixtures_id,
      status: validationPacket.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_fixtures_status,
      packet_rows: validationPacket.summary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_row_count,
      gates: validationPacket.summary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_gate_count,
    }),
  };
}

function buildPlanBoundary({ generatedAt, writeRequested, validationPacket, planRows, coverage }) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_status: validationPacket.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_fixtures_status,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_ready: coverage.p461_ready,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_row_count: planRows.length,
    ready_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_row_count: planRows.filter((row) => row.approval_plan_status === PLAN_READY_STATUS).length,
    all_validation_packet_rows_covered: coverage.all_validation_packet_rows_covered,
    receipt_validation_packet_consumed_in_memory: true,
    receipt_validation_packet_artifact_read_performed: false,
    approval_plan_declared: coverage.approval_plan_declared,
    actor_workspace_required: true,
    actor_workspace_input_present: false,
    actor_workspace_file_read: false,
    actor_workspace_payload_read: false,
    receipt_input_file_materialized: false,
    merged_receipt_input_materialized: false,
    receipt_payload_present: false,
    ready_for_validation: false,
    ready_for_approval_application: false,
    receipt_received: false,
    receipt_validated: false,
    receipt_application_performed: false,
    receipt_applied: false,
    approval_applied: false,
    no_plan_input_materialized: coverage.no_plan_input_materialized,
    no_secret_material_read: coverage.no_secret_material_read,
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    desktop_config_read: false,
    raw_secret_material_materialized: false,
    raw_secret_material_exposed: false,
    provider_key_material_present: false,
    desktop_provider_key_visible: false,
    forbidden_receipt_fields_allowed: false,
    no_secret_or_trading_mutation: coverage.no_secret_or_trading_mutation,
    secret_scan_remediation_action_allowed: false,
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

function buildPlanGateRows({ validationPacket, packageJson, platformOpsLedger, boundary, coverage }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const gateInputs = [
    ["p461_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_ready", "P461 secret scan remediation receipt chain secret scan remediation receipt validation packet source is ready.", validationPacket.validation.valid && validationPacket.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_fixtures_status === SOURCE_READY_STATUS],
    ["platform_package_script_registered", "package.json registers the P462 trading secret scan remediation receipt chain secret scan remediation receipt approval plan fixtures command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0],
    ["platform_validation_chain_registered", "Validation chain includes the P462 trading secret scan remediation receipt chain secret scan remediation receipt approval plan fixtures command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)],
    ["p462_ledger_acceptance_declared", "P462 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P462: `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-fixtures`")],
    ["all_validation_packet_rows_covered", "Every P461 validation packet row has a matching future approval plan row.", coverage.all_validation_packet_rows_covered],
    ["approval_plan_rows_ready", "Future approval plan rows are ready without validating payloads.", coverage.approval_plan_rows_ready],
    ["approval_plan_declared", "Approval plan manifests are declared without validating receipts.", coverage.approval_plan_declared && !boundary.ready_for_validation && !boundary.ready_for_approval_application && !boundary.receipt_validated],
    ["no_receipt_payload_validation", "No actor workspace file, actor payload, merged input, receipt payload, validation, or approval is performed.", boundary.no_plan_input_materialized && !boundary.actor_workspace_file_read && !boundary.actor_workspace_payload_read && !boundary.merged_receipt_input_materialized && !boundary.receipt_payload_present && !boundary.ready_for_validation && !boundary.ready_for_approval_application && !boundary.receipt_validated && !boundary.approval_applied],
    ["no_secret_material_read", "P462 reads no secret values, env files, Desktop config content, or Desktop provider keys.", boundary.no_secret_material_read && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read && !boundary.desktop_provider_key_visible],
    ["no_secret_or_trading_mutation", "P462 performs no remediation action, credential lookup, trading writes, artifact mutation, release, git, or protected action.", boundary.no_secret_or_trading_mutation && !boundary.secret_scan_remediation_action_allowed && !boundary.artifact_write_performed && !boundary.protected_action_executed],
  ];
  return gateInputs.map(([rowKey, description, passed], index) => withOrdinalAndHash(gateRow(rowKey, description, passed), index, "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-gate-row.v1",
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_gate_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    actor_workspace_file_read_by_plan: false,
    actor_workspace_payload_read_by_plan: false,
    actor_workspace_input_present_by_plan: false,
    receipt_input_file_materialized_by_plan: false,
    merged_receipt_input_materialized_by_plan: false,
    receipt_payload_present_by_plan: false,
    ready_for_validation_by_plan: false,
    ready_for_approval_application_by_plan: false,
    receipt_received_by_plan: false,
    receipt_validated_by_plan: false,
    receipt_application_performed_by_plan: false,
    approval_applied_by_plan: false,
    secret_values_read_by_plan: false,
    env_file_read_by_plan: false,
    desktop_config_content_inspected_by_plan: false,
    desktop_config_read_by_plan: false,
    desktop_provider_key_visible_by_plan: false,
    secret_scan_remediation_action_allowed_by_plan: false,
    command_execution_performed_by_plan: false,
    artifact_read_performed_by_plan: false,
    artifact_write_performed_by_plan: false,
    protected_action_executed_by_plan: false,
    broker_write_allowed_by_plan: false,
    exchange_write_allowed_by_plan: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ validationPacket, packageJson, platformOpsLedger, planRows, gateRows, boundary, coverage }) {
  return [
    validationItem("source.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet", "p461_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_ready", validationPacket.validation.valid && validationPacket.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_fixtures_status === SOURCE_READY_STATUS, "P461 secret scan remediation receipt chain secret scan remediation receipt validation packet fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P462 secret scan remediation receipt chain secret scan remediation receipt approval plan fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_rows", "approval_plan_rows_ready", planRows.length === coverage.expected_approval_plan_row_count && planRows.length === 5 && planRows.every((row) => row.approval_plan_status === PLAN_READY_STATUS && row.approval_plan_checks.length >= 8 && row.approval_plan_declared), "All secret scan remediation receipt chain secret scan remediation receipt approval plan rows must be ready without receipt payload validation."),
    validationItem("secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_gate_rows", "approval_plan_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.ready_for_approval_application_by_plan && !row.receipt_validated_by_plan && !row.protected_action_executed_by_plan), "P462 secret scan remediation receipt chain secret scan remediation receipt approval plan gates are ready."),
    validationItem("coverage.merge_packet_rows", "all_validation_packet_rows_covered", coverage.all_validation_packet_rows_covered, "All P461 validation packet rows must have approval plan rows."),
    validationItem("coverage.approval_plan", "approval_plan_declared", coverage.approval_plan_declared, "Future approval plan manifests must be declared."),
    validationItem("boundary.no_plan_input", "no_plan_input_materialized", boundary.no_plan_input_materialized && !boundary.actor_workspace_input_present && !boundary.actor_workspace_file_read && !boundary.actor_workspace_payload_read && !boundary.receipt_input_file_materialized && !boundary.merged_receipt_input_materialized && !boundary.receipt_payload_present && !boundary.ready_for_validation && !boundary.ready_for_approval_application && !boundary.receipt_validated && !boundary.approval_applied, "P462 must not read actor workspace input or materialize/validate receipt payloads."),
    validationItem("boundary.no_secret_material_read", "no_secret_material_read", boundary.no_secret_material_read && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read && !boundary.desktop_provider_key_visible, "P462 reads no secret values, env files, Desktop config content, or Desktop provider keys."),
    validationItem("boundary.no_mutation", "no_secret_or_trading_mutation", boundary.no_secret_or_trading_mutation && !boundary.secret_scan_remediation_action_allowed && !boundary.credential_lookup_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.artifact_write_performed && !boundary.protected_action_executed, "P462 performs no remediation action, credential lookup, trading mutation, artifact mutation, or protected action."),
  ];
}

function buildSummary({ validationPacket, planRows, gateRows, boundary, coverage, validation }) {
  return {
    trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_status: validationPacket.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_fixtures_status,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_ready: boundary.source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_ready,
    expected_approval_plan_row_count: coverage.expected_approval_plan_row_count,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_row_count: planRows.length,
    ready_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_row_count: boundary.ready_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_row_count,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_gate_count: gateRows.length,
    ready_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    all_validation_packet_rows_covered: boundary.all_validation_packet_rows_covered,
    approval_plan_declared: boundary.approval_plan_declared,
    no_plan_input_materialized: boundary.no_plan_input_materialized,
    no_secret_material_read: boundary.no_secret_material_read,
    no_secret_or_trading_mutation: boundary.no_secret_or_trading_mutation,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    receipt_validation_packet_consumed_in_memory: boundary.receipt_validation_packet_consumed_in_memory,
    receipt_validation_packet_artifact_read_performed: boundary.receipt_validation_packet_artifact_read_performed,
    actor_workspace_required: boundary.actor_workspace_required,
    actor_workspace_input_present: boundary.actor_workspace_input_present,
    actor_workspace_file_read: boundary.actor_workspace_file_read,
    actor_workspace_payload_read: boundary.actor_workspace_payload_read,
    receipt_input_file_materialized: boundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: boundary.merged_receipt_input_materialized,
    receipt_payload_present: boundary.receipt_payload_present,
    ready_for_validation: boundary.ready_for_validation,
    ready_for_approval_application: boundary.ready_for_approval_application,
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
    desktop_provider_key_visible: boundary.desktop_provider_key_visible,
    secret_scan_remediation_action_allowed: boundary.secret_scan_remediation_action_allowed,
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
    "# Trading Secret Scan Remediation Receipt Chain Secret Scan Remediation Receipt Approval Plan Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source validation packet: ${result.summary.source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_status}`,
    `Plan rows: ${result.summary.ready_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_row_count}/${result.summary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_row_count}`,
    `Plan gates: ${result.summary.ready_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_gate_count}/${result.summary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_gate_count}`,
    "",
    "## Rows",
    "",
    ...result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_rows.map((row) => `- ${row.template_key}: ${row.approval_plan_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-gate-fixtures-schema") parsed.secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-attention-schema") parsed.secretScanRemediationReceiptChainSecretScanAttentionSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-fail-closed-schema") parsed.secretScanRemediationReceiptChainSecretScanFailClosedSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-template-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptTemplateSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-intake-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptIntakeSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-validation-rules-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationRulesSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceMergeSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-merge-preflight-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptMergePreflightSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-validation-packet-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationPacketSchemaPath = argv[++index];
    else if (arg === "--review-dashboard") parsed.reviewDashboardPath = argv[++index];
    else if (arg === "--control-plane-action-plan") parsed.controlPlaneActionPlanPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-fixtures.mjs [options]

Options:
  --out-dir <folder>                                                       Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_OUT_DIR}
  --run-at <iso>                                                           Deterministic generated_at timestamp.
  --package <path>                                                         package.json path.
  --platform-ops-ledger <path>                                             P341-P500 platform operations ledger path.
  --secret-scan-remediation-receipt-chain-secret-scan-gate-fixtures-schema <path>
                                                                           P451 secret scan gate fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-attention-schema <path>
                                                                           P452 secret scan attention fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-fail-closed-schema <path>
                                                                           P453 secret scan fail-closed fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-schema <path>
                                                                           P454 secret scan remediation fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-template-schema <path>
                                                                           P455 receipt template fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-intake-schema <path>                   P456 receipt intake fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-validation-rules-schema <path>         P457 receipt validation rules fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-schema <path>                P458 receipt workspace fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-schema <path>          P459 receipt workspace merge fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-merge-preflight-schema <path>          P460 receipt merge preflight fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-validation-packet-schema <path>        P461 receipt validation packet fixtures schema path.
  --review-dashboard <path>                                                Review Dashboard source path.
  --control-plane-action-plan <path>                                       Control-plane action plan source path.
  --control-plane-human-gate-receipts <path>                               Control-plane human gate receipts source path.
  --schema <path>                                                          Output schema path.
  --check                                                                  Validate only, do not write artifacts.
  -h, --help                                                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.platformOpsLedgerPath),
    control_plane_human_gate_receipts_path: path.resolve(options.controlPlaneHumanGateReceiptsPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.controlPlaneHumanGateReceiptsPath),
    secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_attention_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanAttentionSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanAttentionSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_fail_closed_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanFailClosedSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanFailClosedSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationSchemaPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.reviewDashboardPath),
    control_plane_action_plan_path: path.resolve(options.controlPlaneActionPlanPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.controlPlaneActionPlanPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_template_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptTemplateSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptTemplateSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_intake_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptIntakeSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptIntakeSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_rules_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationRulesSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationRulesSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceMergeSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceMergeSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_merge_preflight_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptMergePreflightSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptMergePreflightSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationPacketSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationPacketSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.schemaPath),
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
