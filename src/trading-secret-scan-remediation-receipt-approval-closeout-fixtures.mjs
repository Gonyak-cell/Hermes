import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationReceiptApprovalPlanFixtures,
} from "./trading-secret-scan-remediation-receipt-approval-plan-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-approval-closeout-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS,
  secretScanRemediationReceiptApprovalPlanSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-approval-closeout-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-approval-closeout-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_approval_closeout_fixtures";
const PHASE_SLOT = "P437";
const PREVIOUS_PHASE_SLOT = "P436";
const NEXT_PHASE_SLOT = "P438";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_approval_closeout";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_approval_plan";
const SOURCE_ROW_READY_STATUS = "ready_for_future_secret_scan_remediation_receipt_approval_plan";
const CLOSEOUT_READY_STATUS = "ready_for_future_secret_scan_remediation_receipt_approval_closeout";
const COMMAND_NAME = "trading:secret-scan-remediation-receipt-approval-closeout-fixtures";
const APPROVAL_CLOSEOUT_CHECKS = [
  "approval_plan_ready",
  "future_receipt_decision_allows_closeout",
  "reviewer_role_matches_plan",
  "remediation_action_reference_confirmed",
  "external_removal_or_rotation_reference_confirmed",
  "clean_rerun_reference_confirmed",
  "human_gate_application_future_only",
  "secret_material_boundary_stays_false",
  "trading_write_boundary_stays_false",
  "protected_action_boundary_stays_false",
];

export async function runTradingSecretScanRemediationReceiptApprovalCloseoutFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptApprovalCloseoutFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptApprovalCloseoutFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt approval closeout fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptApprovalCloseoutFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const approvalPlan = await buildTradingSecretScanRemediationReceiptApprovalPlanFixtures({
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
    secretScanRemediationReceiptMergePreflightSchemaPath: inputs.secret_scan_remediation_receipt_merge_preflight_schema_path,
    secretScanRemediationReceiptValidationPacketSchemaPath: inputs.secret_scan_remediation_receipt_validation_packet_schema_path,
    schemaPath: inputs.secret_scan_remediation_receipt_approval_plan_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const closeoutRows = buildCloseoutRows(approvalPlan);
  const coverage = buildCloseoutCoverage({ approvalPlan, closeoutRows });
  const anchor = buildCloseoutAnchor(approvalPlan, coverage);
  const boundary = buildCloseoutBoundary({ generatedAt, writeRequested: options.write !== false, approvalPlan, closeoutRows, coverage });
  const gateRows = buildCloseoutGateRows({ approvalPlan, packageJson, platformOpsLedger, boundary, coverage });
  const validationItems = buildValidationItems({ approvalPlan, packageJson, platformOpsLedger, closeoutRows, gateRows, boundary, coverage });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ approvalPlan, closeoutRows, gateRows, boundary, coverage, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_scan_remediation_receipt_approval_closeout_fixtures_id: `trading-secret-scan-remediation-receipt-approval-closeout-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_scan_remediation_receipt_approval_closeout_anchor: anchor,
    secret_scan_remediation_receipt_approval_closeout_rows: closeoutRows,
    secret_scan_remediation_receipt_approval_closeout_gate_rows: gateRows,
    secret_scan_remediation_receipt_approval_closeout_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_approval_closeout_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ approvalPlan, closeoutRows, gateRows, boundary, coverage, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_approval_closeout_fixtures_id = result.trading_secret_scan_remediation_receipt_approval_closeout_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptApprovalCloseoutFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-approval-closeout-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-approval-closeout-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-approval-closeout-rows.v1", "secret_scan_remediation_receipt_approval_closeout_rows", result.secret_scan_remediation_receipt_approval_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-approval-closeout-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-approval-closeout-gate-rows.v1", "secret_scan_remediation_receipt_approval_closeout_gate_rows", result.secret_scan_remediation_receipt_approval_closeout_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-approval-closeout-boundary.json"), result.secret_scan_remediation_receipt_approval_closeout_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-remediation-receipt-approval-closeout-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptApprovalCloseoutFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptApprovalCloseoutFixtures(args);
    console.log(`Trading secret scan remediation receipt approval closeout fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_approval_closeout_fixtures_status}`);
    console.log(`Secret scan remediation receipt approval closeout rows: ${result.summary.ready_secret_scan_remediation_receipt_approval_closeout_row_count}/${result.summary.secret_scan_remediation_receipt_approval_closeout_row_count}`);
    console.log(`Secret scan remediation receipt approval closeout gates: ${result.summary.ready_secret_scan_remediation_receipt_approval_closeout_gate_count}/${result.summary.secret_scan_remediation_receipt_approval_closeout_gate_count}`);
    console.log(`Receipt validated: ${result.summary.receipt_validated}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildCloseoutRows(approvalPlan) {
  const sourceReady = approvalPlan.validation.valid && approvalPlan.summary.trading_secret_scan_remediation_receipt_approval_plan_fixtures_status === SOURCE_READY_STATUS;
  return approvalPlan.secret_scan_remediation_receipt_approval_plan_rows.map((planRow, index) => {
    const closeoutReady = sourceReady && planRow.approval_plan_status === SOURCE_ROW_READY_STATUS;
    const row = {
      schema_version: "trading-secret-scan-remediation-receipt-approval-closeout-row.v1",
      secret_scan_remediation_receipt_approval_closeout_row_id: `trading-secret-scan-remediation-receipt-approval-closeout.row.${planRow.template_key}`,
      phase_slot: PHASE_SLOT,
      source_approval_plan_row_id: planRow.secret_scan_remediation_receipt_approval_plan_row_id,
      source_workspace_merge_row_id: planRow.source_workspace_merge_row_id,
      source_workspace_row_id: planRow.source_workspace_row_id,
      source_validation_rule_row_id: planRow.source_validation_rule_row_id,
      source_receipt_template_id: planRow.source_receipt_template_id,
      template_key: planRow.template_key,
      intake_key: planRow.intake_key,
      approval_closeout_status: closeoutReady ? CLOSEOUT_READY_STATUS : "blocked",
      source_approval_plan_status: planRow.approval_plan_status,
      external_human_workspace_reference: planRow.external_human_workspace_reference,
      required_receipt_fields: planRow.required_receipt_fields,
      allowed_outcomes: planRow.allowed_outcomes,
      receipt_approval_plan_consumed_in_memory: true,
      receipt_approval_plan_artifact_read_performed_by_closeout: false,
      actor_workspace_required: true,
      actor_workspace_input_present: false,
      actor_workspace_file_read_by_closeout: false,
      actor_workspace_payload_read_by_closeout: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      approval_closeout_declared: true,
      approval_closeout_checks: APPROVAL_CLOSEOUT_CHECKS,
      ready_for_validation: false,
      ready_for_approval_application: false,
      receipt_received_by_closeout: false,
      receipt_validated_by_closeout: false,
      receipt_application_performed_by_closeout: false,
      approval_applied_by_closeout: false,
      secret_values_read_by_closeout: false,
      env_file_read_by_closeout: false,
      desktop_config_content_inspected_by_closeout: false,
      desktop_config_read_by_closeout: false,
      raw_secret_material_materialized_by_closeout: false,
      raw_secret_material_exposed_by_closeout: false,
      provider_key_material_present_by_closeout: false,
      auto_fix_command_registered_by_closeout: false,
      auto_redaction_allowed_by_closeout: false,
      auto_deletion_allowed_by_closeout: false,
      auto_rotation_allowed_by_closeout: false,
      credential_lookup_allowed_by_closeout: false,
      plaintext_secret_allowed_by_closeout: false,
      model_context_secret_allowed_by_closeout: false,
      broker_write_allowed_by_closeout: false,
      exchange_write_allowed_by_closeout: false,
      command_execution_performed_by_closeout: false,
      package_command_execution_performed_by_closeout: false,
      release_check_execution_performed_by_closeout: false,
      artifact_read_performed_by_closeout: false,
      artifact_write_performed_by_closeout: false,
      release_published_by_closeout: false,
      git_operation_performed_by_closeout: false,
      protected_action_executed_by_closeout: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Future approval closeout is declared for ${planRow.template_key}; no receipt payload is validated or applied.`,
    };
    return withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_approval_closeout_hash");
  });
}

function buildCloseoutCoverage({ approvalPlan, closeoutRows }) {
  const sourceReady = approvalPlan.validation.valid && approvalPlan.summary.trading_secret_scan_remediation_receipt_approval_plan_fixtures_status === SOURCE_READY_STATUS;
  const planRows = approvalPlan.secret_scan_remediation_receipt_approval_plan_rows ?? [];
  const allApprovalPlanRowsCovered = planRows.length > 0 && planRows.every((planRow) => closeoutRows.some((row) => row.source_approval_plan_row_id === planRow.secret_scan_remediation_receipt_approval_plan_row_id));
  const noCloseoutInputMaterialized = closeoutRows.every((row) => row.receipt_approval_plan_artifact_read_performed_by_closeout === false
    && row.actor_workspace_file_read_by_closeout === false
    && row.actor_workspace_payload_read_by_closeout === false
    && row.actor_workspace_input_present === false
    && row.receipt_input_file_materialized === false
    && row.merged_receipt_input_materialized === false
    && row.receipt_payload_present === false
    && row.ready_for_validation === false
    && row.ready_for_approval_application === false
    && row.receipt_validated_by_closeout === false
    && row.approval_applied_by_closeout === false);
  const noSecretMaterialRead = approvalPlan.summary.no_secret_material_read === true
    && approvalPlan.summary.secret_values_read === false
    && approvalPlan.summary.env_file_read === false
    && approvalPlan.summary.desktop_config_content_inspected === false
    && approvalPlan.summary.desktop_config_read === false
    && closeoutRows.every((row) => row.secret_values_read_by_closeout === false
      && row.env_file_read_by_closeout === false
      && row.desktop_config_content_inspected_by_closeout === false
      && row.desktop_config_read_by_closeout === false);
  const noSecretOrTradingMutation = approvalPlan.summary.no_secret_or_trading_mutation === true
    && closeoutRows.every((row) => row.auto_fix_command_registered_by_closeout === false
      && row.auto_redaction_allowed_by_closeout === false
      && row.auto_deletion_allowed_by_closeout === false
      && row.auto_rotation_allowed_by_closeout === false
      && row.credential_lookup_allowed_by_closeout === false
      && row.broker_write_allowed_by_closeout === false
      && row.exchange_write_allowed_by_closeout === false
      && row.command_execution_performed_by_closeout === false
      && row.artifact_write_performed_by_closeout === false
      && row.protected_action_executed_by_closeout === false);
  return {
    p436_ready: sourceReady,
    source_approval_plan_row_count: planRows.length,
    approval_closeout_row_count: closeoutRows.length,
    expected_approval_closeout_row_count: planRows.length,
    all_approval_plan_rows_covered: allApprovalPlanRowsCovered,
    approval_closeout_rows_ready: closeoutRows.every((row) => row.approval_closeout_status === CLOSEOUT_READY_STATUS),
    approval_closeout_declared: closeoutRows.every((row) => row.approval_closeout_declared === true && row.approval_closeout_checks.length >= 8),
    no_closeout_input_materialized: noCloseoutInputMaterialized,
    no_secret_material_read: noSecretMaterialRead,
    no_secret_or_trading_mutation: noSecretOrTradingMutation,
  };
}

function buildCloseoutAnchor(approvalPlan, coverage) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-approval-closeout-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_approval_plan_fixtures_id: approvalPlan.trading_secret_scan_remediation_receipt_approval_plan_fixtures_id,
    source_secret_scan_remediation_receipt_approval_plan_status: approvalPlan.summary.trading_secret_scan_remediation_receipt_approval_plan_fixtures_status,
    expected_approval_closeout_row_count: coverage.expected_approval_closeout_row_count,
    coverage_hash: hashValue(coverage),
    source_hash: hashValue({
      id: approvalPlan.trading_secret_scan_remediation_receipt_approval_plan_fixtures_id,
      status: approvalPlan.summary.trading_secret_scan_remediation_receipt_approval_plan_fixtures_status,
      approval_plan_rows: approvalPlan.summary.secret_scan_remediation_receipt_approval_plan_row_count,
      gates: approvalPlan.summary.secret_scan_remediation_receipt_approval_plan_gate_count,
    }),
  };
}

function buildCloseoutBoundary({ generatedAt, writeRequested, approvalPlan, closeoutRows, coverage }) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-approval-closeout-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_scan_remediation_receipt_approval_closeout_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_receipt_approval_plan_status: approvalPlan.summary.trading_secret_scan_remediation_receipt_approval_plan_fixtures_status,
    source_secret_scan_remediation_receipt_approval_plan_ready: coverage.p436_ready,
    secret_scan_remediation_receipt_approval_closeout_row_count: closeoutRows.length,
    ready_secret_scan_remediation_receipt_approval_closeout_row_count: closeoutRows.filter((row) => row.approval_closeout_status === CLOSEOUT_READY_STATUS).length,
    all_approval_plan_rows_covered: coverage.all_approval_plan_rows_covered,
    receipt_approval_plan_consumed_in_memory: true,
    receipt_approval_plan_artifact_read_performed: false,
    approval_closeout_declared: coverage.approval_closeout_declared,
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
    no_closeout_input_materialized: coverage.no_closeout_input_materialized,
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

function buildCloseoutGateRows({ approvalPlan, packageJson, platformOpsLedger, boundary, coverage }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const gateInputs = [
    ["p436_secret_scan_remediation_receipt_approval_plan_ready", "P436 secret scan remediation receipt approval plan source is ready.", approvalPlan.validation.valid && approvalPlan.summary.trading_secret_scan_remediation_receipt_approval_plan_fixtures_status === SOURCE_READY_STATUS],
    ["platform_package_script_registered", "package.json registers the P437 trading secret scan remediation receipt approval closeout fixtures command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0],
    ["platform_validation_chain_registered", "Validation chain includes the P437 trading secret scan remediation receipt approval closeout fixtures command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)],
    ["p437_ledger_acceptance_declared", "P437 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P437: `trading:secret-scan-remediation-receipt-approval-closeout-fixtures`")],
    ["all_approval_plan_rows_covered", "Every P436 approval plan row has a matching future approval closeout row.", coverage.all_approval_plan_rows_covered],
    ["approval_closeout_rows_ready", "Future approval closeout rows are ready without validating payloads.", coverage.approval_closeout_rows_ready],
    ["approval_closeout_declared", "Approval closeout manifests are declared without validating receipts.", coverage.approval_closeout_declared && !boundary.ready_for_validation && !boundary.ready_for_approval_application && !boundary.receipt_validated],
    ["no_receipt_payload_validation", "No actor workspace file, actor payload, merged input, receipt payload, validation, or approval is performed.", boundary.no_closeout_input_materialized && !boundary.actor_workspace_file_read && !boundary.actor_workspace_payload_read && !boundary.merged_receipt_input_materialized && !boundary.receipt_payload_present && !boundary.ready_for_validation && !boundary.ready_for_approval_application && !boundary.receipt_validated && !boundary.approval_applied],
    ["no_secret_material_read", "P437 reads no secret values, env files, or Desktop config content.", boundary.no_secret_material_read && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read],
    ["no_secret_or_trading_mutation", "P437 performs no credential lookup, trading writes, artifact mutation, release, git, or protected action.", boundary.no_secret_or_trading_mutation && !boundary.artifact_write_performed && !boundary.protected_action_executed],
  ];
  return gateInputs.map(([rowKey, description, passed], index) => withOrdinalAndHash(gateRow(rowKey, description, passed), index, "secret_scan_remediation_receipt_approval_closeout_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-approval-closeout-gate-row.v1",
    secret_scan_remediation_receipt_approval_closeout_gate_row_id: `trading-secret-scan-remediation-receipt-approval-closeout-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    actor_workspace_file_read_by_closeout: false,
    actor_workspace_payload_read_by_closeout: false,
    actor_workspace_input_present_by_closeout: false,
    receipt_input_file_materialized_by_closeout: false,
    merged_receipt_input_materialized_by_closeout: false,
    receipt_payload_present_by_closeout: false,
    ready_for_validation_by_closeout: false,
    ready_for_approval_application_by_closeout: false,
    receipt_received_by_closeout: false,
    receipt_validated_by_closeout: false,
    receipt_application_performed_by_closeout: false,
    approval_applied_by_closeout: false,
    secret_values_read_by_closeout: false,
    env_file_read_by_closeout: false,
    desktop_config_content_inspected_by_closeout: false,
    desktop_config_read_by_closeout: false,
    command_execution_performed_by_closeout: false,
    artifact_read_performed_by_closeout: false,
    artifact_write_performed_by_closeout: false,
    protected_action_executed_by_closeout: false,
    broker_write_allowed_by_closeout: false,
    exchange_write_allowed_by_closeout: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ approvalPlan, packageJson, platformOpsLedger, closeoutRows, gateRows, boundary, coverage }) {
  return [
    validationItem("source.secret_scan_remediation_receipt_approval_plan", "p436_secret_scan_remediation_receipt_approval_plan_ready", approvalPlan.validation.valid && approvalPlan.summary.trading_secret_scan_remediation_receipt_approval_plan_fixtures_status === SOURCE_READY_STATUS, "P436 secret scan remediation receipt approval plan fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P437 secret scan remediation receipt approval closeout fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("secret_scan_remediation_receipt_approval_closeout_rows", "approval_closeout_rows_ready", closeoutRows.length === coverage.expected_approval_closeout_row_count && closeoutRows.length === 5 && closeoutRows.every((row) => row.approval_closeout_status === CLOSEOUT_READY_STATUS && row.approval_closeout_checks.length >= 8 && row.approval_closeout_declared), "All secret scan remediation receipt approval closeout rows must be ready without receipt payload validation."),
    validationItem("secret_scan_remediation_receipt_approval_closeout_gate_rows", "approval_closeout_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.ready_for_approval_application_by_closeout && !row.receipt_validated_by_closeout && !row.protected_action_executed_by_closeout), "P437 secret scan remediation receipt approval closeout gates are ready."),
    validationItem("coverage.approval_plan_rows", "all_approval_plan_rows_covered", coverage.all_approval_plan_rows_covered, "All P436 approval plan rows must have approval closeout rows."),
    validationItem("coverage.approval_closeout", "approval_closeout_declared", coverage.approval_closeout_declared, "Future approval closeout manifests must be declared."),
    validationItem("boundary.no_closeout_input", "no_closeout_input_materialized", boundary.no_closeout_input_materialized && !boundary.actor_workspace_input_present && !boundary.actor_workspace_file_read && !boundary.actor_workspace_payload_read && !boundary.receipt_input_file_materialized && !boundary.merged_receipt_input_materialized && !boundary.receipt_payload_present && !boundary.ready_for_validation && !boundary.ready_for_approval_application && !boundary.receipt_validated && !boundary.approval_applied, "P437 must not read actor workspace input or materialize/validate receipt payloads."),
    validationItem("boundary.no_secret_material_read", "no_secret_material_read", boundary.no_secret_material_read && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read, "P437 reads no secret values, env files, or Desktop config content."),
    validationItem("boundary.no_mutation", "no_secret_or_trading_mutation", boundary.no_secret_or_trading_mutation && !boundary.credential_lookup_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.artifact_write_performed && !boundary.protected_action_executed, "P437 performs no credential lookup, trading mutation, artifact mutation, or protected action."),
  ];
}

function buildSummary({ approvalPlan, closeoutRows, gateRows, boundary, coverage, validation }) {
  return {
    trading_secret_scan_remediation_receipt_approval_closeout_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_approval_plan_status: approvalPlan.summary.trading_secret_scan_remediation_receipt_approval_plan_fixtures_status,
    source_secret_scan_remediation_receipt_approval_plan_ready: boundary.source_secret_scan_remediation_receipt_approval_plan_ready,
    expected_approval_closeout_row_count: coverage.expected_approval_closeout_row_count,
    secret_scan_remediation_receipt_approval_closeout_row_count: closeoutRows.length,
    ready_secret_scan_remediation_receipt_approval_closeout_row_count: boundary.ready_secret_scan_remediation_receipt_approval_closeout_row_count,
    secret_scan_remediation_receipt_approval_closeout_gate_count: gateRows.length,
    ready_secret_scan_remediation_receipt_approval_closeout_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    all_approval_plan_rows_covered: boundary.all_approval_plan_rows_covered,
    approval_closeout_declared: boundary.approval_closeout_declared,
    no_closeout_input_materialized: boundary.no_closeout_input_materialized,
    no_secret_material_read: boundary.no_secret_material_read,
    no_secret_or_trading_mutation: boundary.no_secret_or_trading_mutation,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    receipt_approval_plan_consumed_in_memory: boundary.receipt_approval_plan_consumed_in_memory,
    receipt_approval_plan_artifact_read_performed: boundary.receipt_approval_plan_artifact_read_performed,
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
    "# Trading Secret Scan Remediation Receipt Approval Closeout Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_approval_closeout_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source approval plan: ${result.summary.source_secret_scan_remediation_receipt_approval_plan_status}`,
    `Approval closeout rows: ${result.summary.ready_secret_scan_remediation_receipt_approval_closeout_row_count}/${result.summary.secret_scan_remediation_receipt_approval_closeout_row_count}`,
    `Approval closeout gates: ${result.summary.ready_secret_scan_remediation_receipt_approval_closeout_gate_count}/${result.summary.secret_scan_remediation_receipt_approval_closeout_gate_count}`,
    "",
    "## Rows",
    "",
    ...result.secret_scan_remediation_receipt_approval_closeout_rows.map((row) => `- ${row.template_key}: ${row.approval_closeout_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_scan_remediation_receipt_approval_closeout_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_OUT_DIR };
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
    else if (arg === "--secret-scan-remediation-receipt-validation-packet-schema") parsed.secretScanRemediationReceiptValidationPacketSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-approval-plan-schema") parsed.secretScanRemediationReceiptApprovalPlanSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-approval-closeout-fixtures.mjs [options]

Options:
  --out-dir <folder>                                                       Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_OUT_DIR}
  --run-at <iso>                                                           Deterministic generated_at timestamp.
  --package <path>                                                         package.json path.
  --platform-ops-ledger <path>                                             P341-P500 platform operations ledger path.
  --secret-scan-remediation-receipt-template-schema <path>                 P429 receipt template fixtures schema path.
  --secret-scan-remediation-receipt-intake-schema <path>                   P430 receipt intake fixtures schema path.
  --secret-scan-remediation-receipt-validation-rules-schema <path>         P431 receipt validation rules fixtures schema path.
  --secret-scan-remediation-receipt-workspace-schema <path>                P432 receipt workspace fixtures schema path.
  --secret-scan-remediation-receipt-workspace-merge-schema <path>          P433 receipt workspace merge fixtures schema path.
  --secret-scan-remediation-receipt-merge-preflight-schema <path>          P434 receipt merge preflight fixtures schema path.
  --secret-scan-remediation-receipt-validation-packet-schema <path>        P435 receipt validation packet fixtures schema path.
  --secret-scan-remediation-receipt-approval-plan-schema <path>            P436 receipt approval plan fixtures schema path.
  --control-plane-human-gate-receipts <path>                               Control-plane human gate receipts source path.
  --schema <path>                                                          Output schema path.
  --check                                                                  Validate only, do not write artifacts.
  -h, --help                                                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.platformOpsLedgerPath),
    control_plane_human_gate_receipts_path: path.resolve(options.controlPlaneHumanGateReceiptsPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.controlPlaneHumanGateReceiptsPath),
    secret_scan_remediation_receipt_template_schema_path: path.resolve(options.secretScanRemediationReceiptTemplateSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.secretScanRemediationReceiptTemplateSchemaPath),
    secret_scan_remediation_receipt_intake_schema_path: path.resolve(options.secretScanRemediationReceiptIntakeSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.secretScanRemediationReceiptIntakeSchemaPath),
    secret_scan_remediation_receipt_validation_rules_schema_path: path.resolve(options.secretScanRemediationReceiptValidationRulesSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.secretScanRemediationReceiptValidationRulesSchemaPath),
    secret_scan_remediation_receipt_workspace_schema_path: path.resolve(options.secretScanRemediationReceiptWorkspaceSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.secretScanRemediationReceiptWorkspaceSchemaPath),
    secret_scan_remediation_receipt_workspace_merge_schema_path: path.resolve(options.secretScanRemediationReceiptWorkspaceMergeSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.secretScanRemediationReceiptWorkspaceMergeSchemaPath),
    secret_scan_remediation_receipt_merge_preflight_schema_path: path.resolve(options.secretScanRemediationReceiptMergePreflightSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.secretScanRemediationReceiptMergePreflightSchemaPath),
    secret_scan_remediation_receipt_validation_packet_schema_path: path.resolve(options.secretScanRemediationReceiptValidationPacketSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.secretScanRemediationReceiptValidationPacketSchemaPath),
    secret_scan_remediation_receipt_approval_plan_schema_path: path.resolve(options.secretScanRemediationReceiptApprovalPlanSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.secretScanRemediationReceiptApprovalPlanSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.schemaPath),
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
