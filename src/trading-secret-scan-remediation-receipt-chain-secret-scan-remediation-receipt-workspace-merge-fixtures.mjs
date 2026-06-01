import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceFixtures,
} from "./trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_MERGE_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_FIXTURES_INPUTS,
  secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_fixtures";
const PHASE_SLOT = "P459";
const PREVIOUS_PHASE_SLOT = "P458";
const NEXT_PHASE_SLOT = "P460";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace";
const COMMAND_NAME = "trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-fixtures";

export async function runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceMergeFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceMergeFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceMergeFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt chain secret scan remediation receipt workspace merge fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceMergeFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_MERGE_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const receiptWorkspace = await buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceFixtures({
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
    schemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const mergeRows = buildMergeRows(receiptWorkspace);
  const coverage = buildMergeCoverage({ receiptWorkspace, mergeRows });
  const anchor = buildMergeAnchor(receiptWorkspace, coverage);
  const boundary = buildMergeBoundary({ generatedAt, writeRequested: options.write !== false, receiptWorkspace, mergeRows, coverage });
  const gateRows = buildMergeGateRows({ receiptWorkspace, packageJson, platformOpsLedger, boundary, coverage });
  const validationItems = buildValidationItems({ receiptWorkspace, packageJson, platformOpsLedger, mergeRows, gateRows, boundary, coverage });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ receiptWorkspace, mergeRows, gateRows, boundary, coverage, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_fixtures_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_anchor: anchor,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_rows: mergeRows,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_gate_rows: gateRows,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ receiptWorkspace, mergeRows, gateRows, boundary, coverage, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_fixtures_id = result.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceMergeFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-rows.v1", "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_rows", result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-gate-rows.v1", "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_gate_rows", result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-boundary.json"), result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceMergeFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceMergeFixtures(args);
    console.log(`Trading secret scan remediation receipt chain secret scan remediation receipt workspace merge fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_fixtures_status}`);
    console.log(`Secret scan remediation receipt workspace merge rows: ${result.summary.ready_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_row_count}/${result.summary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_row_count}`);
    console.log(`Secret scan remediation receipt workspace merge gates: ${result.summary.ready_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_gate_count}/${result.summary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_gate_count}`);
    console.log(`Merged receipt input materialized: ${result.summary.merged_receipt_input_materialized}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildMergeRows(receiptWorkspace) {
  const sourceReady = receiptWorkspace.validation.valid && receiptWorkspace.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_fixtures_status === SOURCE_READY_STATUS;
  return receiptWorkspace.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_rows.map((workspaceRow, index) => {
    const mergeReady = sourceReady && workspaceRow.workspace_status === SOURCE_READY_STATUS;
    const row = {
      schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-row.v1",
      secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge.row.${workspaceRow.template_key}`,
      phase_slot: PHASE_SLOT,
      source_workspace_row_id: workspaceRow.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_row_id,
      source_validation_rule_row_id: workspaceRow.source_validation_rule_row_id,
      source_receipt_template_id: workspaceRow.source_receipt_template_id,
      template_key: workspaceRow.template_key,
      intake_key: workspaceRow.intake_key,
      merge_status: mergeReady ? READY_STATUS : "blocked",
      source_workspace_status: workspaceRow.workspace_status,
      external_human_workspace_reference: workspaceRow.external_human_workspace_reference,
      required_receipt_fields: workspaceRow.required_receipt_fields,
      allowed_outcomes: workspaceRow.allowed_outcomes,
      receipt_workspace_consumed_in_memory: true,
      receipt_workspace_artifact_read_performed_by_merge: false,
      actor_workspace_required: true,
      actor_workspace_file_read_by_merge: false,
      actor_workspace_payload_read_by_merge: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      merge_manifest_declared: true,
      merge_performed: false,
      ready_for_validation: false,
      receipt_received_by_merge: false,
      receipt_validated_by_merge: false,
      receipt_application_performed_by_merge: false,
      approval_applied_by_merge: false,
      secret_values_read_by_merge: false,
      env_file_read_by_merge: false,
      desktop_config_content_inspected_by_merge: false,
      desktop_config_read_by_merge: false,
      raw_secret_material_materialized_by_merge: false,
      raw_secret_material_exposed_by_merge: false,
      provider_key_material_present_by_merge: false,
      desktop_provider_key_visible_by_merge: false,
      forbidden_receipt_fields_allowed_by_merge: false,
      secret_scan_remediation_action_allowed_by_merge: false,
      auto_fix_command_registered_by_merge: false,
      auto_redaction_allowed_by_merge: false,
      auto_deletion_allowed_by_merge: false,
      auto_rotation_allowed_by_merge: false,
      credential_lookup_allowed_by_merge: false,
      plaintext_secret_allowed_by_merge: false,
      model_context_secret_allowed_by_merge: false,
      broker_write_allowed_by_merge: false,
      exchange_write_allowed_by_merge: false,
      command_execution_performed_by_merge: false,
      artifact_read_performed_by_merge: false,
      artifact_write_performed_by_merge: false,
      release_published_by_merge: false,
      git_operation_performed_by_merge: false,
      protected_action_executed_by_merge: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Future merge readiness is declared for ${workspaceRow.template_key}; actor workspace files and merged receipt inputs remain absent.`,
    };
    return withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_hash");
  });
}

function buildMergeCoverage({ receiptWorkspace, mergeRows }) {
  const sourceReady = receiptWorkspace.validation.valid && receiptWorkspace.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_fixtures_status === SOURCE_READY_STATUS;
  const workspaceRows = receiptWorkspace.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_rows ?? [];
  const allWorkspaceRowsCovered = workspaceRows.length > 0 && workspaceRows.every((workspaceRow) => mergeRows.some((row) => row.source_workspace_row_id === workspaceRow.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_row_id));
  const noMergeInputMaterialized = mergeRows.every((row) => row.receipt_workspace_artifact_read_performed_by_merge === false
    && row.actor_workspace_file_read_by_merge === false
    && row.actor_workspace_payload_read_by_merge === false
    && row.receipt_input_file_materialized === false
    && row.merged_receipt_input_materialized === false
    && row.receipt_payload_present === false
    && row.merge_performed === false
    && row.ready_for_validation === false
    && row.receipt_validated_by_merge === false
    && row.approval_applied_by_merge === false);
  const noSecretMaterialRead = receiptWorkspace.summary.no_secret_material_read === true
    && receiptWorkspace.summary.secret_values_read === false
    && receiptWorkspace.summary.env_file_read === false
    && receiptWorkspace.summary.desktop_config_content_inspected === false
    && receiptWorkspace.summary.desktop_config_read === false
    && receiptWorkspace.summary.desktop_provider_key_visible === false
    && mergeRows.every((row) => row.secret_values_read_by_merge === false
      && row.env_file_read_by_merge === false
      && row.desktop_config_content_inspected_by_merge === false
      && row.desktop_config_read_by_merge === false
      && row.desktop_provider_key_visible_by_merge === false);
  const noSecretOrTradingMutation = receiptWorkspace.summary.no_secret_or_trading_mutation === true
    && receiptWorkspace.summary.secret_scan_remediation_action_allowed === false
    && mergeRows.every((row) => row.auto_fix_command_registered_by_merge === false
      && row.secret_scan_remediation_action_allowed_by_merge === false
      && row.auto_redaction_allowed_by_merge === false
      && row.auto_deletion_allowed_by_merge === false
      && row.auto_rotation_allowed_by_merge === false
      && row.credential_lookup_allowed_by_merge === false
      && row.broker_write_allowed_by_merge === false
      && row.exchange_write_allowed_by_merge === false
      && row.command_execution_performed_by_merge === false
      && row.artifact_write_performed_by_merge === false
      && row.protected_action_executed_by_merge === false);
  return {
    p458_ready: sourceReady,
    source_workspace_row_count: workspaceRows.length,
    workspace_merge_row_count: mergeRows.length,
    expected_workspace_merge_row_count: workspaceRows.length,
    all_workspace_rows_covered: allWorkspaceRowsCovered,
    merge_rows_ready: mergeRows.every((row) => row.merge_status === READY_STATUS),
    merge_manifest_declared: mergeRows.every((row) => row.merge_manifest_declared === true),
    no_merge_input_materialized: noMergeInputMaterialized,
    no_secret_material_read: noSecretMaterialRead,
    no_secret_or_trading_mutation: noSecretOrTradingMutation,
  };
}

function buildMergeAnchor(receiptWorkspace, coverage) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_fixtures_id: receiptWorkspace.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_fixtures_id,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_status: receiptWorkspace.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_fixtures_status,
    expected_workspace_merge_row_count: coverage.expected_workspace_merge_row_count,
    coverage_hash: hashValue(coverage),
    source_hash: hashValue({
      id: receiptWorkspace.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_fixtures_id,
      status: receiptWorkspace.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_fixtures_status,
      workspace_rows: receiptWorkspace.summary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_row_count,
      gates: receiptWorkspace.summary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_gate_count,
    }),
  };
}

function buildMergeBoundary({ generatedAt, writeRequested, receiptWorkspace, mergeRows, coverage }) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_status: receiptWorkspace.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_fixtures_status,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_ready: coverage.p458_ready,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_row_count: mergeRows.length,
    ready_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_row_count: mergeRows.filter((row) => row.merge_status === READY_STATUS).length,
    all_workspace_rows_covered: coverage.all_workspace_rows_covered,
    receipt_workspace_consumed_in_memory: true,
    receipt_workspace_artifact_read_performed: false,
    merge_manifest_declared: coverage.merge_manifest_declared,
    actor_workspace_required: true,
    actor_workspace_file_read: false,
    actor_workspace_payload_read: false,
    receipt_input_file_materialized: false,
    merged_receipt_input_materialized: false,
    receipt_payload_present: false,
    merge_performed: false,
    ready_for_validation: false,
    receipt_received: false,
    receipt_validated: false,
    receipt_application_performed: false,
    receipt_applied: false,
    approval_applied: false,
    no_merge_input_materialized: coverage.no_merge_input_materialized,
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

function buildMergeGateRows({ receiptWorkspace, packageJson, platformOpsLedger, boundary, coverage }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const gateInputs = [
    ["p458_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_ready", "P458 secret scan remediation receipt chain secret scan remediation receipt workspace source is ready.", receiptWorkspace.validation.valid && receiptWorkspace.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_fixtures_status === SOURCE_READY_STATUS],
    ["platform_package_script_registered", "package.json registers the P459 trading secret scan remediation receipt chain secret scan remediation receipt workspace merge fixtures command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0],
    ["platform_validation_chain_registered", "Validation chain includes the P459 trading secret scan remediation receipt chain secret scan remediation receipt workspace merge fixtures command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)],
    ["p459_ledger_acceptance_declared", "P459 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P459: `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-fixtures`")],
    ["all_workspace_rows_covered", "Every P458 workspace row has a matching future merge row.", coverage.all_workspace_rows_covered],
    ["merge_rows_ready", "Future workspace merge rows are ready.", coverage.merge_rows_ready],
    ["merge_manifest_declared", "Merge manifests are declared without performing a merge.", coverage.merge_manifest_declared && !boundary.merge_performed],
    ["no_merge_input_materialized", "No actor workspace file, actor payload, receipt input, merged input, or receipt payload is materialized.", boundary.no_merge_input_materialized && !boundary.actor_workspace_file_read && !boundary.merged_receipt_input_materialized && !boundary.receipt_payload_present && !boundary.receipt_validated && !boundary.approval_applied],
    ["no_secret_material_read", "P459 reads no secret values, env files, Desktop config content, or Desktop provider keys.", boundary.no_secret_material_read && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read && !boundary.desktop_provider_key_visible],
    ["no_secret_or_trading_mutation", "P459 performs no remediation action, credential lookup, trading writes, artifact mutation, release, git, or protected action.", boundary.no_secret_or_trading_mutation && !boundary.secret_scan_remediation_action_allowed && !boundary.artifact_write_performed && !boundary.protected_action_executed],
  ];
  return gateInputs.map(([rowKey, description, passed], index) => withOrdinalAndHash(gateRow(rowKey, description, passed), index, "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-gate-row.v1",
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_gate_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    actor_workspace_file_read_by_merge: false,
    actor_workspace_payload_read_by_merge: false,
    receipt_input_file_materialized_by_merge: false,
    merged_receipt_input_materialized_by_merge: false,
    receipt_payload_present_by_merge: false,
    merge_performed_by_merge: false,
    ready_for_validation_by_merge: false,
    receipt_received_by_merge: false,
    receipt_validated_by_merge: false,
    approval_applied_by_merge: false,
    secret_values_read_by_merge: false,
    env_file_read_by_merge: false,
    desktop_config_content_inspected_by_merge: false,
    desktop_config_read_by_merge: false,
    desktop_provider_key_visible_by_merge: false,
    secret_scan_remediation_action_allowed_by_merge: false,
    command_execution_performed_by_merge: false,
    artifact_write_performed_by_merge: false,
    protected_action_executed_by_merge: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ receiptWorkspace, packageJson, platformOpsLedger, mergeRows, gateRows, boundary, coverage }) {
  return [
    validationItem("source.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace", "p458_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_ready", receiptWorkspace.validation.valid && receiptWorkspace.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_fixtures_status === SOURCE_READY_STATUS, "P458 secret scan remediation receipt chain secret scan remediation receipt workspace fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P459 secret scan remediation receipt chain secret scan remediation receipt workspace merge fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_rows", "merge_rows_ready", mergeRows.length === coverage.expected_workspace_merge_row_count && mergeRows.length === 5 && mergeRows.every((row) => row.merge_status === READY_STATUS), "All secret scan remediation receipt chain secret scan remediation receipt workspace merge rows must be ready."),
    validationItem("secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_gate_rows", "merge_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_merge), "P459 secret scan remediation receipt chain secret scan remediation receipt workspace merge gates are ready."),
    validationItem("coverage.workspace_rows", "all_workspace_rows_covered", coverage.all_workspace_rows_covered, "All P458 workspace rows must have merge rows."),
    validationItem("coverage.merge_manifest", "merge_manifest_declared", coverage.merge_manifest_declared, "Future merge manifests must be declared."),
    validationItem("boundary.no_merge_input", "no_merge_input_materialized", boundary.no_merge_input_materialized && !boundary.actor_workspace_file_read && !boundary.actor_workspace_payload_read && !boundary.receipt_input_file_materialized && !boundary.merged_receipt_input_materialized && !boundary.receipt_payload_present && !boundary.receipt_validated && !boundary.approval_applied, "P459 must not read actor workspace input or materialize merged receipt payloads."),
    validationItem("boundary.no_secret_material_read", "no_secret_material_read", boundary.no_secret_material_read && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read && !boundary.desktop_provider_key_visible, "P459 reads no secret values, env files, Desktop config content, or Desktop provider keys."),
    validationItem("boundary.no_mutation", "no_secret_or_trading_mutation", boundary.no_secret_or_trading_mutation && !boundary.secret_scan_remediation_action_allowed && !boundary.credential_lookup_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.artifact_write_performed && !boundary.protected_action_executed, "P459 performs no remediation action, credential lookup, trading mutation, artifact mutation, or protected action."),
  ];
}

function buildSummary({ receiptWorkspace, mergeRows, gateRows, boundary, coverage, validation }) {
  return {
    trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_status: receiptWorkspace.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_fixtures_status,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_ready: boundary.source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_ready,
    expected_workspace_merge_row_count: coverage.expected_workspace_merge_row_count,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_row_count: mergeRows.length,
    ready_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_row_count: boundary.ready_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_row_count,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_gate_count: gateRows.length,
    ready_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    all_workspace_rows_covered: boundary.all_workspace_rows_covered,
    merge_manifest_declared: boundary.merge_manifest_declared,
    no_merge_input_materialized: boundary.no_merge_input_materialized,
    no_secret_material_read: boundary.no_secret_material_read,
    no_secret_or_trading_mutation: boundary.no_secret_or_trading_mutation,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    actor_workspace_required: boundary.actor_workspace_required,
    actor_workspace_file_read: boundary.actor_workspace_file_read,
    actor_workspace_payload_read: boundary.actor_workspace_payload_read,
    receipt_input_file_materialized: boundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: boundary.merged_receipt_input_materialized,
    receipt_payload_present: boundary.receipt_payload_present,
    merge_performed: boundary.merge_performed,
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
    artifact_write_performed: boundary.artifact_write_performed,
    protected_action_executed: boundary.protected_action_executed,
    human_review_required: boundary.human_review_required,
    human_signoff_required: boundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Secret Scan Remediation Receipt Chain Secret Scan Remediation Receipt Workspace Merge Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source workspace: ${result.summary.source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_status}`,
    `Merge rows: ${result.summary.ready_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_row_count}/${result.summary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_row_count}`,
    `Merge gates: ${result.summary.ready_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_gate_count}/${result.summary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_gate_count}`,
    "",
    "## Rows",
    "",
    ...result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_rows.map((row) => `- ${row.template_key}: ${row.merge_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_MERGE_FIXTURES_OUT_DIR };
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
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-fixtures.mjs [options]

Options:
  --out-dir <folder>                                                   Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_MERGE_FIXTURES_OUT_DIR}
  --run-at <iso>                                                       Deterministic generated_at timestamp.
  --package <path>                                                     package.json path.
  --platform-ops-ledger <path>                                         P341-P500 platform operations ledger path.
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
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-intake-schema <path>               P456 receipt intake fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-validation-rules-schema <path>     P457 receipt validation rules fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-schema <path>            P458 receipt workspace fixtures schema path.
  --review-dashboard <path>                                            Review Dashboard source path.
  --control-plane-action-plan <path>                                   Control-plane action plan source path.
  --control-plane-human-gate-receipts <path>                           Control-plane human gate receipts source path.
  --schema <path>                                                      Output schema path.
  --check                                                              Validate only, do not write artifacts.
  -h, --help                                                           Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS.platformOpsLedgerPath),
    secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_attention_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanAttentionSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanAttentionSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_fail_closed_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanFailClosedSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanFailClosedSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationSchemaPath),
    control_plane_human_gate_receipts_path: path.resolve(options.controlPlaneHumanGateReceiptsPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS.controlPlaneHumanGateReceiptsPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS.reviewDashboardPath),
    control_plane_action_plan_path: path.resolve(options.controlPlaneActionPlanPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS.controlPlaneActionPlanPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_template_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptTemplateSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptTemplateSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_intake_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptIntakeSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptIntakeSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_rules_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationRulesSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationRulesSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS.schemaPath),
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
