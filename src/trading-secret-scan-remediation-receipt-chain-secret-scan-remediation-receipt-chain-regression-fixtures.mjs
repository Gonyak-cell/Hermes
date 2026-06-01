import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CLOSEOUT_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptCloseoutFixtures,
} from "./trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-closeout-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CLOSEOUT_FIXTURES_INPUTS,
  secretScanRemediationReceiptChainSecretScanRemediationReceiptCloseoutSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CLOSEOUT_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_fixtures";
const PHASE_SLOT = "P465";
const PREVIOUS_PHASE_SLOT = "P464";
const NEXT_PHASE_SLOT = "P466";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression";
const COMMAND_NAME = "trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-fixtures";

const CHAIN_PHASES = [
  ["P455", "trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-template-fixtures", "workflow.trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_template_fixtures.v1"],
  ["P456", "trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-intake-fixtures", "workflow.trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_intake_fixtures.v1"],
  ["P457", "trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-validation-rules-fixtures", "workflow.trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_rules_fixtures.v1"],
  ["P458", "trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-fixtures", "workflow.trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_fixtures.v1"],
  ["P459", "trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-fixtures", "workflow.trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_fixtures.v1"],
  ["P460", "trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-merge-preflight-fixtures", "workflow.trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_merge_preflight_fixtures.v1"],
  ["P461", "trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-validation-packet-fixtures", "workflow.trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_fixtures.v1"],
  ["P462", "trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-fixtures", "workflow.trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_fixtures.v1"],
  ["P463", "trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-closeout-fixtures", "workflow.trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_closeout_fixtures.v1"],
  ["P464", "trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-closeout-fixtures", "workflow.trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_fixtures.v1"],
].map(([phaseSlot, packageScriptName, workflowId]) => ({ phaseSlot, packageScriptName, workflowId }));

export async function runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainRegressionFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainRegressionFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainRegressionFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt chain regression fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainRegressionFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const receiptCloseout = await buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptCloseoutFixtures({
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
    secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationPacketSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_schema_path,
    secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalPlanSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_schema_path,
    secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalCloseoutSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_closeout_schema_path,
    schemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const chainRows = buildChainRows({ receiptCloseout, packageJson, platformOpsLedger });
  const coverage = buildCoverage({ receiptCloseout, chainRows });
  const chainAnchor = buildChainAnchor(receiptCloseout, coverage);
  const chainBoundary = buildChainBoundary({ generatedAt, writeRequested: options.write !== false, receiptCloseout, chainRows, coverage });
  const chainGateRows = buildChainGateRows({ receiptCloseout, packageJson, platformOpsLedger, chainRows, chainBoundary, coverage });
  const validationItems = buildValidationItems({ receiptCloseout, packageJson, platformOpsLedger, chainRows, chainGateRows, chainBoundary, coverage });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ receiptCloseout, chainRows, chainGateRows, chainBoundary, coverage, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_fixtures_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_anchor: chainAnchor,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_rows: chainRows,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_gate_rows: chainGateRows,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_boundary: chainBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ receiptCloseout, chainRows, chainGateRows, chainBoundary, coverage, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_fixtures_id = result.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainRegressionFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-rows.v1", "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_rows", result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-gate-rows.v1", "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_gate_rows", result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-boundary.json"), result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainRegressionFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainRegressionFixtures(args);
    console.log(`Trading secret scan remediation receipt chain regression fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_fixtures_status}`);
    console.log(`Chain phases: ${result.summary.ready_chain_phase_count}/${result.summary.chain_phase_count}`);
    console.log(`Chain gates: ${result.summary.ready_chain_gate_count}/${result.summary.chain_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildChainRows({ receiptCloseout, packageJson, platformOpsLedger }) {
  const sourceReady = receiptCloseout.validation.valid && receiptCloseout.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_fixtures_status === SOURCE_READY_STATUS;
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  return CHAIN_PHASES.map((phase, index) => {
    const scriptRegistered = typeof scripts[phase.packageScriptName] === "string" && scripts[phase.packageScriptName].length > 0;
    const validationChainRegistered = validateScript.includes(`npm run ${phase.packageScriptName} -- --check`);
    const ledgerAcceptanceDeclared = ledgerText.includes(`${phase.phaseSlot}: \`${phase.packageScriptName}\``);
    const rowReady = sourceReady && scriptRegistered && validationChainRegistered && ledgerAcceptanceDeclared;
    const row = {
      schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-row.v1",
      secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression.row.${phase.phaseSlot.toLowerCase()}`,
      phase_slot: PHASE_SLOT,
      source_phase_slot: phase.phaseSlot,
      package_script_name: phase.packageScriptName,
      workflow_id: phase.workflowId,
      chain_phase_status: rowReady ? READY_STATUS : "blocked",
      source_receipt_closeout_status: receiptCloseout.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_fixtures_status,
      script_registered: scriptRegistered,
      validation_chain_registered: validationChainRegistered,
      ledger_acceptance_declared: ledgerAcceptanceDeclared,
      receipt_chain_regression_declared: true,
      p455_p464_chain_ready: receiptCloseout.summary.p455_p464_chain_ready === true,
      human_receipts_pending: receiptCloseout.summary.human_receipts_pending === true,
      no_secret_material_read: receiptCloseout.summary.no_secret_material_read === true,
      no_secret_or_trading_mutation: receiptCloseout.summary.no_secret_or_trading_mutation === true,
      actor_workspace_input_present: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      ready_for_validation: false,
      ready_for_approval_application: false,
      receipt_received_by_regression: false,
      receipt_validated_by_regression: false,
      receipt_application_performed_by_regression: false,
      approval_applied_by_regression: false,
      secret_values_read_by_regression: false,
      env_file_read_by_regression: false,
      desktop_config_content_inspected_by_regression: false,
      desktop_config_read_by_regression: false,
      raw_secret_material_materialized_by_regression: false,
      raw_secret_material_exposed_by_regression: false,
      desktop_provider_key_visible_by_regression: false,
      forbidden_receipt_fields_allowed_by_regression: false,
      secret_scan_remediation_action_allowed_by_regression: false,
      auto_fix_command_registered_by_regression: false,
      auto_redaction_allowed_by_regression: false,
      auto_deletion_allowed_by_regression: false,
      auto_rotation_allowed_by_regression: false,
      credential_lookup_allowed_by_regression: false,
      command_execution_performed_by_regression: false,
      artifact_read_performed_by_regression: false,
      artifact_write_performed_by_regression: false,
      protected_action_executed_by_regression: false,
      broker_write_allowed_by_regression: false,
      exchange_write_allowed_by_regression: false,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_hash");
  });
}

function buildCoverage({ receiptCloseout, chainRows }) {
  const sourceReady = receiptCloseout.validation.valid && receiptCloseout.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_fixtures_status === SOURCE_READY_STATUS;
  return {
    p464_ready: sourceReady,
    expected_chain_phase_count: CHAIN_PHASES.length,
    chain_phase_count: chainRows.length,
    ready_chain_phase_count: chainRows.filter((row) => row.chain_phase_status === READY_STATUS).length,
    all_scripts_registered: chainRows.every((row) => row.script_registered),
    all_validation_chain_registered: chainRows.every((row) => row.validation_chain_registered),
    all_ledger_acceptance_declared: chainRows.every((row) => row.ledger_acceptance_declared),
    p455_p464_chain_ready: receiptCloseout.summary.p455_p464_chain_ready === true,
    human_receipts_pending: receiptCloseout.summary.human_receipts_pending === true,
    no_secret_material_read: receiptCloseout.summary.no_secret_material_read === true
      && receiptCloseout.summary.secret_values_read === false
      && receiptCloseout.summary.env_file_read === false
      && receiptCloseout.summary.desktop_config_content_inspected === false
      && receiptCloseout.summary.desktop_config_read === false
      && receiptCloseout.summary.raw_secret_material_materialized === false
      && receiptCloseout.summary.raw_secret_material_exposed === false
      && receiptCloseout.summary.desktop_provider_key_visible === false
      && chainRows.every((row) => !row.secret_values_read_by_regression && !row.env_file_read_by_regression && !row.desktop_config_content_inspected_by_regression && !row.desktop_config_read_by_regression && !row.raw_secret_material_materialized_by_regression && !row.raw_secret_material_exposed_by_regression && !row.desktop_provider_key_visible_by_regression),
    no_secret_or_trading_mutation: receiptCloseout.summary.no_secret_or_trading_mutation === true
      && receiptCloseout.summary.secret_scan_remediation_action_allowed === false
      && receiptCloseout.summary.auto_fix_command_registered === false
      && receiptCloseout.summary.auto_redaction_allowed === false
      && receiptCloseout.summary.auto_deletion_allowed === false
      && receiptCloseout.summary.auto_rotation_allowed === false
      && receiptCloseout.summary.credential_lookup_allowed === false
      && receiptCloseout.summary.broker_write_allowed === false
      && receiptCloseout.summary.exchange_write_allowed === false
      && receiptCloseout.summary.artifact_write_performed === false
      && receiptCloseout.summary.protected_action_executed === false
      && chainRows.every((row) => !row.secret_scan_remediation_action_allowed_by_regression && !row.auto_fix_command_registered_by_regression && !row.auto_redaction_allowed_by_regression && !row.auto_deletion_allowed_by_regression && !row.auto_rotation_allowed_by_regression && !row.credential_lookup_allowed_by_regression && !row.broker_write_allowed_by_regression && !row.exchange_write_allowed_by_regression && !row.artifact_write_performed_by_regression && !row.protected_action_executed_by_regression),
  };
}

function buildChainAnchor(receiptCloseout, coverage) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_closeout_fixtures_id: receiptCloseout.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_fixtures_id,
    source_secret_scan_remediation_receipt_closeout_status: receiptCloseout.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_fixtures_status,
    expected_chain_phase_count: coverage.expected_chain_phase_count,
    coverage_hash: hashValue(coverage),
    source_hash: hashValue({
      id: receiptCloseout.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_fixtures_id,
      status: receiptCloseout.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_fixtures_status,
      receipt_closeout_rows: receiptCloseout.summary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_row_count,
      receipt_closeout_gate_rows: receiptCloseout.summary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_gate_count,
    }),
  };
}

function buildChainBoundary({ generatedAt, writeRequested, receiptCloseout, chainRows, coverage }) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_receipt_closeout_status: receiptCloseout.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_fixtures_status,
    source_secret_scan_remediation_receipt_closeout_ready: coverage.p464_ready,
    chain_phase_count: chainRows.length,
    ready_chain_phase_count: coverage.ready_chain_phase_count,
    receipt_closeout_consumed_in_memory: true,
    receipt_closeout_artifact_read_performed: false,
    receipt_chain_regression_declared: true,
    p455_p464_chain_ready: coverage.p455_p464_chain_ready,
    human_receipts_pending: coverage.human_receipts_pending,
    no_secret_material_read: coverage.no_secret_material_read,
    no_secret_or_trading_mutation: coverage.no_secret_or_trading_mutation,
    actor_workspace_input_present: false,
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
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    desktop_config_read: false,
    raw_secret_material_materialized: false,
    raw_secret_material_exposed: false,
    desktop_provider_key_visible: false,
    forbidden_receipt_fields_allowed: false,
    secret_scan_remediation_action_allowed: false,
    auto_fix_command_registered: false,
    auto_redaction_allowed: false,
    auto_deletion_allowed: false,
    auto_rotation_allowed: false,
    credential_lookup_allowed: false,
    command_execution_performed: false,
    package_command_execution_performed: false,
    release_check_execution_performed: false,
    artifact_read_performed: false,
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildChainGateRows({ receiptCloseout, packageJson, platformOpsLedger, chainRows, chainBoundary, coverage }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const gateInputs = [
    ["p464_receipt_closeout_ready", "P464 secret scan remediation receipt closeout source is ready.", receiptCloseout.validation.valid && receiptCloseout.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_fixtures_status === SOURCE_READY_STATUS],
    ["platform_package_script_registered", "package.json registers the P465 trading secret scan remediation receipt chain regression fixtures command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0],
    ["platform_validation_chain_registered", "Validation chain includes the P465 trading secret scan remediation receipt chain regression fixtures command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)],
    ["p465_ledger_acceptance_declared", "P465 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P465: `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-fixtures`")],
    ["p455_p464_scripts_registered", "Every P455-P464 secret scan remediation receipt command is registered in package.json.", coverage.all_scripts_registered],
    ["p455_p464_validation_chain_registered", "Every P455-P464 secret scan remediation receipt command is present in npm run validate.", coverage.all_validation_chain_registered],
    ["p455_p464_ledger_acceptance_declared", "Every P455-P464 secret scan remediation receipt acceptance row is present in the platform operations ledger.", coverage.all_ledger_acceptance_declared],
    ["receipt_chain_rows_ready", "Every P455-P464 secret scan remediation receipt chain regression row is ready.", chainRows.length === CHAIN_PHASES.length && chainRows.every((row) => row.chain_phase_status === READY_STATUS && row.receipt_chain_regression_declared && row.p455_p464_chain_ready && row.human_receipts_pending)],
    ["no_receipt_payload_validation", "P465 does not receive, validate, apply, or convert receipt payloads into approval.", !chainBoundary.actor_workspace_input_present && !chainBoundary.receipt_payload_present && !chainBoundary.ready_for_validation && !chainBoundary.ready_for_approval_application && !chainBoundary.receipt_received && !chainBoundary.receipt_validated && !chainBoundary.receipt_application_performed && !chainBoundary.approval_applied],
    ["no_secret_or_trading_mutation", "P465 reads no secret material and performs no remediation action, credential lookup, trading writes, artifact mutation, release, git, or protected action.", chainBoundary.no_secret_material_read && chainBoundary.no_secret_or_trading_mutation && !chainBoundary.secret_values_read && !chainBoundary.env_file_read && !chainBoundary.desktop_config_content_inspected && !chainBoundary.desktop_config_read && !chainBoundary.raw_secret_material_materialized && !chainBoundary.raw_secret_material_exposed && !chainBoundary.desktop_provider_key_visible && !chainBoundary.forbidden_receipt_fields_allowed && !chainBoundary.secret_scan_remediation_action_allowed && !chainBoundary.auto_fix_command_registered && !chainBoundary.auto_redaction_allowed && !chainBoundary.auto_deletion_allowed && !chainBoundary.auto_rotation_allowed && !chainBoundary.credential_lookup_allowed && !chainBoundary.broker_write_allowed && !chainBoundary.exchange_write_allowed && !chainBoundary.artifact_write_performed && !chainBoundary.protected_action_executed],
  ];
  return gateInputs.map(([rowKey, description, passed], index) => withOrdinalAndHash(gateRow(rowKey, description, passed), index, "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-gate-row.v1",
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_gate_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    actor_workspace_input_present_by_regression: false,
    receipt_payload_present_by_regression: false,
    ready_for_validation_by_regression: false,
    ready_for_approval_application_by_regression: false,
    receipt_received_by_regression: false,
    receipt_validated_by_regression: false,
    receipt_application_performed_by_regression: false,
    approval_applied_by_regression: false,
    secret_values_read_by_regression: false,
    env_file_read_by_regression: false,
    desktop_config_content_inspected_by_regression: false,
    desktop_config_read_by_regression: false,
    raw_secret_material_materialized_by_regression: false,
    raw_secret_material_exposed_by_regression: false,
    desktop_provider_key_visible_by_regression: false,
    forbidden_receipt_fields_allowed_by_regression: false,
    secret_scan_remediation_action_allowed_by_regression: false,
    auto_fix_command_registered_by_regression: false,
    auto_redaction_allowed_by_regression: false,
    auto_deletion_allowed_by_regression: false,
    auto_rotation_allowed_by_regression: false,
    credential_lookup_allowed_by_regression: false,
    command_execution_performed_by_regression: false,
    artifact_read_performed_by_regression: false,
    artifact_write_performed_by_regression: false,
    protected_action_executed_by_regression: false,
    broker_write_allowed_by_regression: false,
    exchange_write_allowed_by_regression: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ receiptCloseout, packageJson, platformOpsLedger, chainRows, chainGateRows, chainBoundary, coverage }) {
  return [
    validationItem("source.secret_scan_remediation_receipt_closeout", "p464_receipt_closeout_ready", receiptCloseout.validation.valid && receiptCloseout.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_fixtures_status === SOURCE_READY_STATUS, "P464 secret scan remediation receipt closeout fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P465 secret scan remediation receipt chain regression fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_rows", "chain_regression_rows_ready", chainRows.length === CHAIN_PHASES.length && chainRows.every((row) => row.chain_phase_status === READY_STATUS && row.script_registered && row.validation_chain_registered && row.ledger_acceptance_declared && row.receipt_chain_regression_declared && row.p455_p464_chain_ready && row.human_receipts_pending && row.no_secret_material_read && row.no_secret_or_trading_mutation && !row.receipt_payload_present && !row.desktop_provider_key_visible_by_regression && !row.secret_scan_remediation_action_allowed_by_regression && !row.approval_applied_by_regression), "P455-P464 secret scan remediation receipt chain rows must be ready and registered."),
    validationItem("secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_gate_rows", "chain_regression_gates_ready", chainGateRows.length >= 10 && chainGateRows.every((row) => row.gate_status === "ready" && !row.desktop_provider_key_visible_by_regression && !row.secret_scan_remediation_action_allowed_by_regression && !row.approval_applied_by_regression && !row.protected_action_executed_by_regression), "P465 secret scan remediation receipt chain regression gates are ready."),
    validationItem("coverage.p455_p464_registration", "p455_p464_registration_complete", coverage.all_scripts_registered && coverage.all_validation_chain_registered && coverage.all_ledger_acceptance_declared, "P455-P464 scripts, validation chain, and ledger rows must be complete."),
    validationItem("boundary.no_receipt_payload_validation", "no_receipt_payload_validation", chainBoundary.read_only && chainBoundary.report_only && chainBoundary.receipt_closeout_consumed_in_memory && !chainBoundary.receipt_closeout_artifact_read_performed && chainBoundary.receipt_chain_regression_declared && chainBoundary.p455_p464_chain_ready && chainBoundary.human_receipts_pending && !chainBoundary.actor_workspace_input_present && !chainBoundary.receipt_input_file_materialized && !chainBoundary.merged_receipt_input_materialized && !chainBoundary.receipt_payload_present && !chainBoundary.ready_for_validation && !chainBoundary.ready_for_approval_application && !chainBoundary.receipt_received && !chainBoundary.receipt_validated && !chainBoundary.receipt_application_performed && !chainBoundary.approval_applied, "Secret scan remediation receipt chain regression remains read-only and keeps receipts pending."),
    validationItem("boundary.no_secret_or_trading_mutation", "no_secret_or_trading_mutation", chainBoundary.no_secret_material_read && chainBoundary.no_secret_or_trading_mutation && !chainBoundary.secret_values_read && !chainBoundary.env_file_read && !chainBoundary.desktop_config_content_inspected && !chainBoundary.desktop_config_read && !chainBoundary.raw_secret_material_materialized && !chainBoundary.raw_secret_material_exposed && !chainBoundary.desktop_provider_key_visible && !chainBoundary.forbidden_receipt_fields_allowed && !chainBoundary.secret_scan_remediation_action_allowed && !chainBoundary.auto_fix_command_registered && !chainBoundary.auto_redaction_allowed && !chainBoundary.auto_deletion_allowed && !chainBoundary.auto_rotation_allowed && !chainBoundary.credential_lookup_allowed && !chainBoundary.broker_write_allowed && !chainBoundary.exchange_write_allowed && !chainBoundary.command_execution_performed && !chainBoundary.artifact_read_performed && !chainBoundary.artifact_write_performed && !chainBoundary.protected_action_executed, "P465 reads no secret material and performs no remediation, trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ receiptCloseout, chainRows, chainGateRows, chainBoundary, coverage, validation }) {
  return {
    trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_closeout_status: receiptCloseout.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_fixtures_status,
    source_secret_scan_remediation_receipt_closeout_ready: chainBoundary.source_secret_scan_remediation_receipt_closeout_ready,
    expected_chain_phase_count: coverage.expected_chain_phase_count,
    chain_phase_count: chainRows.length,
    ready_chain_phase_count: chainBoundary.ready_chain_phase_count,
    chain_gate_count: chainGateRows.length,
    ready_chain_gate_count: chainGateRows.filter((row) => row.gate_status === "ready").length,
    all_scripts_registered: coverage.all_scripts_registered,
    all_validation_chain_registered: coverage.all_validation_chain_registered,
    all_ledger_acceptance_declared: coverage.all_ledger_acceptance_declared,
    read_only: chainBoundary.read_only,
    report_only: chainBoundary.report_only,
    receipt_closeout_consumed_in_memory: chainBoundary.receipt_closeout_consumed_in_memory,
    receipt_closeout_artifact_read_performed: chainBoundary.receipt_closeout_artifact_read_performed,
    receipt_chain_regression_declared: chainBoundary.receipt_chain_regression_declared,
    p455_p464_chain_ready: chainBoundary.p455_p464_chain_ready,
    human_receipts_pending: chainBoundary.human_receipts_pending,
    no_secret_material_read: chainBoundary.no_secret_material_read,
    no_secret_or_trading_mutation: chainBoundary.no_secret_or_trading_mutation,
    actor_workspace_input_present: chainBoundary.actor_workspace_input_present,
    receipt_input_file_materialized: chainBoundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: chainBoundary.merged_receipt_input_materialized,
    receipt_payload_present: chainBoundary.receipt_payload_present,
    ready_for_validation: chainBoundary.ready_for_validation,
    ready_for_approval_application: chainBoundary.ready_for_approval_application,
    receipt_received: chainBoundary.receipt_received,
    receipt_validated: chainBoundary.receipt_validated,
    receipt_application_performed: chainBoundary.receipt_application_performed,
    receipt_applied: chainBoundary.receipt_applied,
    approval_applied: chainBoundary.approval_applied,
    secret_values_read: chainBoundary.secret_values_read,
    env_file_read: chainBoundary.env_file_read,
    desktop_config_content_inspected: chainBoundary.desktop_config_content_inspected,
    desktop_config_read: chainBoundary.desktop_config_read,
    raw_secret_material_materialized: chainBoundary.raw_secret_material_materialized,
    raw_secret_material_exposed: chainBoundary.raw_secret_material_exposed,
    desktop_provider_key_visible: chainBoundary.desktop_provider_key_visible,
    forbidden_receipt_fields_allowed: chainBoundary.forbidden_receipt_fields_allowed,
    secret_scan_remediation_action_allowed: chainBoundary.secret_scan_remediation_action_allowed,
    auto_fix_command_registered: chainBoundary.auto_fix_command_registered,
    auto_redaction_allowed: chainBoundary.auto_redaction_allowed,
    auto_deletion_allowed: chainBoundary.auto_deletion_allowed,
    auto_rotation_allowed: chainBoundary.auto_rotation_allowed,
    credential_lookup_allowed: chainBoundary.credential_lookup_allowed,
    command_execution_performed: chainBoundary.command_execution_performed,
    package_command_execution_performed: chainBoundary.package_command_execution_performed,
    release_check_execution_performed: chainBoundary.release_check_execution_performed,
    artifact_read_performed: chainBoundary.artifact_read_performed,
    artifact_write_performed: chainBoundary.artifact_write_performed,
    release_published: chainBoundary.release_published,
    git_operation_performed: chainBoundary.git_operation_performed,
    protected_action_executed: chainBoundary.protected_action_executed,
    broker_write_allowed: chainBoundary.broker_write_allowed,
    exchange_write_allowed: chainBoundary.exchange_write_allowed,
    human_review_required: chainBoundary.human_review_required,
    human_signoff_required: chainBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Secret Scan Remediation Receipt Chain Secret Scan Remediation Receipt Chain Regression Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source receipt closeout: ${result.summary.source_secret_scan_remediation_receipt_closeout_status}`,
    `Chain phases: ${result.summary.ready_chain_phase_count}/${result.summary.chain_phase_count}`,
    `Chain gates: ${result.summary.ready_chain_gate_count}/${result.summary.chain_gate_count}`,
    "",
    "## Chain Rows",
    "",
    ...result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_rows.map((row) => `- ${row.source_phase_slot} ${row.package_script_name}: ${row.chain_phase_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_OUT_DIR };
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
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalPlanSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-closeout-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalCloseoutSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-closeout-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptCloseoutSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-fixtures.mjs [options]

Options:
  --out-dir <folder>                                                       Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_OUT_DIR}
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
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-schema <path>            P462 receipt approval plan fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-closeout-schema <path>        P463 receipt approval closeout fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-closeout-schema <path>                 P464 receipt closeout fixtures schema path.
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
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.platformOpsLedgerPath),
    control_plane_human_gate_receipts_path: path.resolve(options.controlPlaneHumanGateReceiptsPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.controlPlaneHumanGateReceiptsPath),
    secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_attention_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanAttentionSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanAttentionSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_fail_closed_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanFailClosedSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanFailClosedSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationSchemaPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.reviewDashboardPath),
    control_plane_action_plan_path: path.resolve(options.controlPlaneActionPlanPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.controlPlaneActionPlanPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_template_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptTemplateSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptTemplateSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_intake_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptIntakeSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptIntakeSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_rules_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationRulesSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationRulesSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceMergeSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceMergeSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_merge_preflight_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptMergePreflightSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptMergePreflightSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationPacketSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationPacketSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalPlanSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalPlanSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_closeout_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalCloseoutSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalCloseoutSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptCloseoutSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.schemaPath),
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
