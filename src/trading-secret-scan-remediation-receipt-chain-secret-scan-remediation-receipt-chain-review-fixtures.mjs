import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainRegressionFixtures,
} from "./trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS,
  secretScanRemediationReceiptChainSecretScanRemediationReceiptChainRegressionSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_fixtures";
const PHASE_SLOT = "P466";
const PREVIOUS_PHASE_SLOT = "P465";
const NEXT_PHASE_SLOT = "P467";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression";
const CHAIN_REVIEW_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_human_review";
const COMMAND_NAME = "trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-fixtures";
const CHAIN_REVIEW_CHECKS = [
  "p465_regression_ready",
  "source_phase_script_registered",
  "source_phase_validation_chain_registered",
  "source_phase_ledger_acceptance_declared",
  "review_packet_declared",
  "human_review_pending",
  "receipt_payload_absent",
  "secret_material_boundary_stays_false",
  "trading_mutation_disabled",
];

export async function runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainReviewFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainReviewFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainReviewFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt chain review fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainReviewFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const chainRegression = await buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainRegressionFixtures({
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
    secretScanRemediationReceiptChainSecretScanRemediationReceiptCloseoutSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_schema_path,
    schemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const reviewRows = buildReviewRows(chainRegression);
  const coverage = buildCoverage({ chainRegression, reviewRows });
  const reviewAnchor = buildReviewAnchor(chainRegression, coverage);
  const reviewBoundary = buildReviewBoundary({ generatedAt, writeRequested: options.write !== false, chainRegression, reviewRows, coverage });
  const reviewGateRows = buildReviewGateRows({ chainRegression, packageJson, platformOpsLedger, reviewRows, reviewBoundary, coverage });
  const validationItems = buildValidationItems({ chainRegression, packageJson, platformOpsLedger, reviewRows, reviewGateRows, reviewBoundary, coverage });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ chainRegression, reviewRows, reviewGateRows, reviewBoundary, coverage, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_fixtures_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_anchor: reviewAnchor,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_rows: reviewRows,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_gate_rows: reviewGateRows,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_boundary: reviewBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ chainRegression, reviewRows, reviewGateRows, reviewBoundary, coverage, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_fixtures_id = result.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainReviewFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-rows.v1", "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_rows", result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-gate-rows.v1", "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_gate_rows", result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-boundary.json"), result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
      schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainReviewFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainReviewFixtures(args);
    console.log(`Trading secret scan remediation receipt chain review fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_fixtures_status}`);
    console.log(`Review rows: ${result.summary.ready_chain_review_row_count}/${result.summary.chain_review_row_count}`);
    console.log(`Review gates: ${result.summary.ready_chain_review_gate_count}/${result.summary.chain_review_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildReviewRows(chainRegression) {
  const sourceReady = chainRegression.validation.valid && chainRegression.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_fixtures_status === SOURCE_READY_STATUS;
  return chainRegression.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_rows.map((sourceRow, index) => {
    const reviewReady = sourceReady && sourceRow.chain_phase_status === SOURCE_READY_STATUS;
    const row = {
      schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-row.v1",
      secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review.row.${sourceRow.source_phase_slot.toLowerCase()}`,
      phase_slot: PHASE_SLOT,
      source_chain_regression_row_id: sourceRow.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_row_id,
      source_phase_slot: sourceRow.source_phase_slot,
      package_script_name: sourceRow.package_script_name,
      workflow_id: sourceRow.workflow_id,
      chain_review_status: reviewReady ? CHAIN_REVIEW_READY_STATUS : "blocked",
      source_chain_phase_status: sourceRow.chain_phase_status,
      source_secret_scan_remediation_receipt_chain_regression_status: chainRegression.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_fixtures_status,
      script_registered: sourceRow.script_registered,
      validation_chain_registered: sourceRow.validation_chain_registered,
      ledger_acceptance_declared: sourceRow.ledger_acceptance_declared,
      receipt_chain_regression_declared: sourceRow.receipt_chain_regression_declared,
      secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_declared: true,
      reviewer_role: "trading_secret_scan_operator",
      required_review_decision: "human_review_required_before_receipt_collection",
      review_completed: false,
      review_approval_applied: false,
      p455_p464_chain_ready: sourceRow.p455_p464_chain_ready,
      human_receipts_pending: sourceRow.human_receipts_pending,
      no_secret_material_read: sourceRow.no_secret_material_read,
      no_secret_or_trading_mutation: sourceRow.no_secret_or_trading_mutation,
      chain_review_checks: CHAIN_REVIEW_CHECKS,
      actor_workspace_input_present: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      ready_for_validation: false,
      ready_for_approval_application: false,
      receipt_received_by_review: false,
      receipt_validated_by_review: false,
      receipt_application_performed_by_review: false,
      approval_applied_by_review: false,
      secret_values_read_by_review: false,
      env_file_read_by_review: false,
      desktop_config_content_inspected_by_review: false,
      desktop_config_read_by_review: false,
      raw_secret_material_materialized_by_review: false,
      raw_secret_material_exposed_by_review: false,
      desktop_provider_key_visible_by_review: false,
      forbidden_receipt_fields_allowed_by_review: false,
      secret_scan_remediation_action_allowed_by_review: false,
      auto_fix_command_registered_by_review: false,
      auto_redaction_allowed_by_review: false,
      auto_deletion_allowed_by_review: false,
      auto_rotation_allowed_by_review: false,
      credential_lookup_allowed_by_review: false,
      command_execution_performed_by_review: false,
      artifact_read_performed_by_review: false,
      artifact_write_performed_by_review: false,
      protected_action_executed_by_review: false,
      broker_write_allowed_by_review: false,
      exchange_write_allowed_by_review: false,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_hash");
  });
}

function buildCoverage({ chainRegression, reviewRows }) {
  const sourceReady = chainRegression.validation.valid && chainRegression.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_fixtures_status === SOURCE_READY_STATUS;
  return {
    p465_ready: sourceReady,
    expected_chain_review_row_count: chainRegression.summary.chain_phase_count,
    chain_review_row_count: reviewRows.length,
    ready_chain_review_row_count: reviewRows.filter((row) => row.chain_review_status === CHAIN_REVIEW_READY_STATUS).length,
    source_regression_rows_ready: chainRegression.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_rows.length === 10 && chainRegression.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_rows.every((row) => row.chain_phase_status === SOURCE_READY_STATUS && row.script_registered && row.validation_chain_registered && row.ledger_acceptance_declared),
    p455_p464_chain_ready: chainRegression.summary.p455_p464_chain_ready === true,
    human_receipts_pending: chainRegression.summary.human_receipts_pending === true,
    no_secret_material_read: chainRegression.summary.no_secret_material_read === true
      && chainRegression.summary.secret_values_read === false
      && chainRegression.summary.env_file_read === false
      && chainRegression.summary.desktop_config_content_inspected === false
      && chainRegression.summary.desktop_config_read === false
      && chainRegression.summary.raw_secret_material_materialized === false
      && chainRegression.summary.raw_secret_material_exposed === false
      && chainRegression.summary.desktop_provider_key_visible === false
      && reviewRows.every((row) => row.no_secret_material_read && !row.secret_values_read_by_review && !row.env_file_read_by_review && !row.desktop_config_content_inspected_by_review && !row.desktop_config_read_by_review && !row.raw_secret_material_materialized_by_review && !row.raw_secret_material_exposed_by_review && !row.desktop_provider_key_visible_by_review),
    no_secret_or_trading_mutation: chainRegression.summary.no_secret_or_trading_mutation === true
      && chainRegression.summary.forbidden_receipt_fields_allowed === false
      && chainRegression.summary.secret_scan_remediation_action_allowed === false
      && chainRegression.summary.auto_fix_command_registered === false
      && chainRegression.summary.auto_redaction_allowed === false
      && chainRegression.summary.auto_deletion_allowed === false
      && chainRegression.summary.auto_rotation_allowed === false
      && chainRegression.summary.credential_lookup_allowed === false
      && chainRegression.summary.broker_write_allowed === false
      && chainRegression.summary.exchange_write_allowed === false
      && chainRegression.summary.artifact_write_performed === false
      && chainRegression.summary.protected_action_executed === false
      && reviewRows.every((row) => row.no_secret_or_trading_mutation && !row.forbidden_receipt_fields_allowed_by_review && !row.secret_scan_remediation_action_allowed_by_review && !row.auto_fix_command_registered_by_review && !row.auto_redaction_allowed_by_review && !row.auto_deletion_allowed_by_review && !row.auto_rotation_allowed_by_review && !row.credential_lookup_allowed_by_review && !row.broker_write_allowed_by_review && !row.exchange_write_allowed_by_review && !row.artifact_write_performed_by_review && !row.protected_action_executed_by_review),
  };
}

function buildReviewAnchor(chainRegression, coverage) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_regression_fixtures_id: chainRegression.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_fixtures_id,
    source_secret_scan_remediation_receipt_chain_regression_status: chainRegression.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_fixtures_status,
    expected_chain_review_row_count: coverage.expected_chain_review_row_count,
    coverage_hash: hashValue(coverage),
    source_hash: hashValue({
      id: chainRegression.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_fixtures_id,
      status: chainRegression.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_fixtures_status,
      chain_rows: chainRegression.summary.chain_phase_count,
      chain_gate_rows: chainRegression.summary.chain_gate_count,
    }),
  };
}

function buildReviewBoundary({ generatedAt, writeRequested, chainRegression, reviewRows, coverage }) {
  const sourceSummary = chainRegression.summary;
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_receipt_chain_regression_status: sourceSummary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_fixtures_status,
    source_secret_scan_remediation_receipt_chain_regression_ready: coverage.p465_ready,
    chain_review_row_count: reviewRows.length,
    ready_chain_review_row_count: coverage.ready_chain_review_row_count,
    chain_regression_consumed_in_memory: true,
    chain_regression_artifact_read_performed: false,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_declared: true,
    review_completed: false,
    review_approval_applied: false,
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

function buildReviewGateRows({ chainRegression, packageJson, platformOpsLedger, reviewRows, reviewBoundary, coverage }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const gateInputs = [
    ["p465_chain_regression_ready", "P465 secret scan remediation receipt chain regression source is ready.", chainRegression.validation.valid && chainRegression.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_fixtures_status === SOURCE_READY_STATUS],
    ["platform_package_script_registered", "package.json registers the P466 trading secret scan remediation receipt chain review fixtures command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0],
    ["platform_validation_chain_registered", "Validation chain includes the P466 trading secret scan remediation receipt chain review fixtures command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)],
    ["p466_ledger_acceptance_declared", "P466 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P466: `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-fixtures`")],
    ["p455_p464_regression_rows_ready", "Every P455-P464 secret scan remediation receipt chain regression row is ready.", coverage.source_regression_rows_ready],
    ["chain_review_rows_ready", "Every secret scan remediation receipt chain review row is ready while review completion remains pending.", reviewRows.length === 10 && reviewRows.every((row) => row.chain_review_status === CHAIN_REVIEW_READY_STATUS && row.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_declared && !row.review_completed && !row.review_approval_applied && row.human_receipts_pending)],
    ["human_review_pending_not_applied", "P466 declares human review packets without completing review or applying approvals.", !reviewBoundary.review_completed && !reviewBoundary.review_approval_applied && reviewBoundary.human_review_required && !reviewBoundary.approval_applied],
    ["no_receipt_payload_validation", "P466 does not receive, validate, apply, or convert receipt payloads into approval.", !reviewBoundary.actor_workspace_input_present && !reviewBoundary.receipt_payload_present && !reviewBoundary.ready_for_validation && !reviewBoundary.ready_for_approval_application && !reviewBoundary.receipt_received && !reviewBoundary.receipt_validated && !reviewBoundary.receipt_application_performed && !reviewBoundary.approval_applied],
    ["no_secret_material_read", "P466 reads no secret values, env files, Desktop config content, raw secret material, or Desktop provider keys.", reviewBoundary.no_secret_material_read && !reviewBoundary.secret_values_read && !reviewBoundary.env_file_read && !reviewBoundary.desktop_config_content_inspected && !reviewBoundary.desktop_config_read && !reviewBoundary.raw_secret_material_materialized && !reviewBoundary.raw_secret_material_exposed && !reviewBoundary.desktop_provider_key_visible],
    ["no_secret_or_trading_mutation", "P466 performs no remediation action, credential lookup, trading writes, artifact mutation, release, git, or protected action.", reviewBoundary.no_secret_or_trading_mutation && !reviewBoundary.forbidden_receipt_fields_allowed && !reviewBoundary.secret_scan_remediation_action_allowed && !reviewBoundary.auto_fix_command_registered && !reviewBoundary.auto_redaction_allowed && !reviewBoundary.auto_deletion_allowed && !reviewBoundary.auto_rotation_allowed && !reviewBoundary.credential_lookup_allowed && !reviewBoundary.broker_write_allowed && !reviewBoundary.exchange_write_allowed && !reviewBoundary.artifact_write_performed && !reviewBoundary.protected_action_executed],
  ];
  return gateInputs.map(([rowKey, description, passed], index) => withOrdinalAndHash(gateRow(rowKey, description, passed), index, "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-gate-row.v1",
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_gate_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    review_completed_by_review: false,
    review_approval_applied_by_review: false,
    actor_workspace_input_present_by_review: false,
    receipt_payload_present_by_review: false,
    ready_for_validation_by_review: false,
    ready_for_approval_application_by_review: false,
    receipt_received_by_review: false,
    receipt_validated_by_review: false,
    receipt_application_performed_by_review: false,
    approval_applied_by_review: false,
    secret_values_read_by_review: false,
    env_file_read_by_review: false,
    desktop_config_content_inspected_by_review: false,
    desktop_config_read_by_review: false,
    raw_secret_material_materialized_by_review: false,
    raw_secret_material_exposed_by_review: false,
    desktop_provider_key_visible_by_review: false,
    forbidden_receipt_fields_allowed_by_review: false,
    secret_scan_remediation_action_allowed_by_review: false,
    auto_fix_command_registered_by_review: false,
    auto_redaction_allowed_by_review: false,
    auto_deletion_allowed_by_review: false,
    auto_rotation_allowed_by_review: false,
    credential_lookup_allowed_by_review: false,
    command_execution_performed_by_review: false,
    artifact_read_performed_by_review: false,
    artifact_write_performed_by_review: false,
    protected_action_executed_by_review: false,
    broker_write_allowed_by_review: false,
    exchange_write_allowed_by_review: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ chainRegression, packageJson, platformOpsLedger, reviewRows, reviewGateRows, reviewBoundary, coverage }) {
  return [
    validationItem("source.secret_scan_remediation_receipt_chain_regression", "p465_chain_regression_ready", chainRegression.validation.valid && chainRegression.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_fixtures_status === SOURCE_READY_STATUS, "P465 secret scan remediation receipt chain regression fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P466 secret scan remediation receipt chain review fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_rows", "chain_review_rows_ready", reviewRows.length === 10 && reviewRows.every((row) => row.chain_review_status === CHAIN_REVIEW_READY_STATUS && row.script_registered && row.validation_chain_registered && row.ledger_acceptance_declared && row.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_declared && !row.review_completed && !row.review_approval_applied && row.p455_p464_chain_ready && row.human_receipts_pending && row.no_secret_material_read && row.no_secret_or_trading_mutation && !row.receipt_payload_present && !row.approval_applied_by_review && !row.desktop_provider_key_visible_by_review && !row.secret_scan_remediation_action_allowed_by_review), "P455-P464 secret scan remediation receipt chain review rows must be ready and pending human review."),
    validationItem("secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_gate_rows", "chain_review_gates_ready", reviewGateRows.length >= 10 && reviewGateRows.every((row) => row.gate_status === "ready" && !row.review_completed_by_review && !row.approval_applied_by_review && !row.desktop_provider_key_visible_by_review && !row.secret_scan_remediation_action_allowed_by_review && !row.protected_action_executed_by_review), "P466 secret scan remediation receipt chain review gates are ready."),
    validationItem("coverage.source_regression_rows", "source_regression_rows_ready", coverage.source_regression_rows_ready, "P455-P464 regression rows must remain ready."),
    validationItem("boundary.review_pending", "review_pending_not_applied", reviewBoundary.read_only && reviewBoundary.report_only && reviewBoundary.chain_regression_consumed_in_memory && !reviewBoundary.chain_regression_artifact_read_performed && reviewBoundary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_declared && !reviewBoundary.review_completed && !reviewBoundary.review_approval_applied && reviewBoundary.p455_p464_chain_ready && reviewBoundary.human_receipts_pending && reviewBoundary.human_review_required, "Secret scan remediation receipt chain review remains pending and unapplied."),
    validationItem("boundary.no_receipt_payload_validation", "no_receipt_payload_validation", !reviewBoundary.actor_workspace_input_present && !reviewBoundary.receipt_input_file_materialized && !reviewBoundary.merged_receipt_input_materialized && !reviewBoundary.receipt_payload_present && !reviewBoundary.ready_for_validation && !reviewBoundary.ready_for_approval_application && !reviewBoundary.receipt_received && !reviewBoundary.receipt_validated && !reviewBoundary.receipt_application_performed && !reviewBoundary.approval_applied, "P466 does not receive/apply receipts."),
    validationItem("boundary.no_secret_or_trading_mutation", "no_secret_or_trading_mutation", reviewBoundary.no_secret_material_read && reviewBoundary.no_secret_or_trading_mutation && !reviewBoundary.secret_values_read && !reviewBoundary.env_file_read && !reviewBoundary.desktop_config_content_inspected && !reviewBoundary.desktop_config_read && !reviewBoundary.raw_secret_material_materialized && !reviewBoundary.raw_secret_material_exposed && !reviewBoundary.desktop_provider_key_visible && !reviewBoundary.forbidden_receipt_fields_allowed && !reviewBoundary.secret_scan_remediation_action_allowed && !reviewBoundary.auto_fix_command_registered && !reviewBoundary.auto_redaction_allowed && !reviewBoundary.auto_deletion_allowed && !reviewBoundary.auto_rotation_allowed && !reviewBoundary.credential_lookup_allowed && !reviewBoundary.broker_write_allowed && !reviewBoundary.exchange_write_allowed && !reviewBoundary.command_execution_performed && !reviewBoundary.artifact_read_performed && !reviewBoundary.artifact_write_performed && !reviewBoundary.protected_action_executed, "P466 reads no secret material and performs no remediation, trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ chainRegression, reviewRows, reviewGateRows, reviewBoundary, coverage, validation }) {
  return {
    trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_regression_status: chainRegression.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_fixtures_status,
    source_secret_scan_remediation_receipt_chain_regression_ready: reviewBoundary.source_secret_scan_remediation_receipt_chain_regression_ready,
    expected_chain_review_row_count: coverage.expected_chain_review_row_count,
    chain_review_row_count: reviewRows.length,
    ready_chain_review_row_count: reviewBoundary.ready_chain_review_row_count,
    chain_review_gate_count: reviewGateRows.length,
    ready_chain_review_gate_count: reviewGateRows.filter((row) => row.gate_status === "ready").length,
    source_regression_rows_ready: coverage.source_regression_rows_ready,
    read_only: reviewBoundary.read_only,
    report_only: reviewBoundary.report_only,
    chain_regression_consumed_in_memory: reviewBoundary.chain_regression_consumed_in_memory,
    chain_regression_artifact_read_performed: reviewBoundary.chain_regression_artifact_read_performed,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_declared: reviewBoundary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_declared,
    review_completed: reviewBoundary.review_completed,
    review_approval_applied: reviewBoundary.review_approval_applied,
    p455_p464_chain_ready: reviewBoundary.p455_p464_chain_ready,
    human_receipts_pending: reviewBoundary.human_receipts_pending,
    no_secret_material_read: reviewBoundary.no_secret_material_read,
    no_secret_or_trading_mutation: reviewBoundary.no_secret_or_trading_mutation,
    actor_workspace_input_present: reviewBoundary.actor_workspace_input_present,
    receipt_input_file_materialized: reviewBoundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: reviewBoundary.merged_receipt_input_materialized,
    receipt_payload_present: reviewBoundary.receipt_payload_present,
    ready_for_validation: reviewBoundary.ready_for_validation,
    ready_for_approval_application: reviewBoundary.ready_for_approval_application,
    receipt_received: reviewBoundary.receipt_received,
    receipt_validated: reviewBoundary.receipt_validated,
    receipt_application_performed: reviewBoundary.receipt_application_performed,
    receipt_applied: reviewBoundary.receipt_applied,
    approval_applied: reviewBoundary.approval_applied,
    secret_values_read: reviewBoundary.secret_values_read,
    env_file_read: reviewBoundary.env_file_read,
    desktop_config_content_inspected: reviewBoundary.desktop_config_content_inspected,
    desktop_config_read: reviewBoundary.desktop_config_read,
    raw_secret_material_materialized: reviewBoundary.raw_secret_material_materialized,
    raw_secret_material_exposed: reviewBoundary.raw_secret_material_exposed,
    desktop_provider_key_visible: reviewBoundary.desktop_provider_key_visible,
    forbidden_receipt_fields_allowed: reviewBoundary.forbidden_receipt_fields_allowed,
    secret_scan_remediation_action_allowed: reviewBoundary.secret_scan_remediation_action_allowed,
    auto_fix_command_registered: reviewBoundary.auto_fix_command_registered,
    auto_redaction_allowed: reviewBoundary.auto_redaction_allowed,
    auto_deletion_allowed: reviewBoundary.auto_deletion_allowed,
    auto_rotation_allowed: reviewBoundary.auto_rotation_allowed,
    credential_lookup_allowed: reviewBoundary.credential_lookup_allowed,
    command_execution_performed: reviewBoundary.command_execution_performed,
    package_command_execution_performed: reviewBoundary.package_command_execution_performed,
    release_check_execution_performed: reviewBoundary.release_check_execution_performed,
    artifact_read_performed: reviewBoundary.artifact_read_performed,
    artifact_write_performed: reviewBoundary.artifact_write_performed,
    release_published: reviewBoundary.release_published,
    git_operation_performed: reviewBoundary.git_operation_performed,
    protected_action_executed: reviewBoundary.protected_action_executed,
    broker_write_allowed: reviewBoundary.broker_write_allowed,
    exchange_write_allowed: reviewBoundary.exchange_write_allowed,
    human_review_required: reviewBoundary.human_review_required,
    human_signoff_required: reviewBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Secret Scan Remediation Receipt Chain Secret Scan Remediation Receipt Chain Review Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source chain regression: ${result.summary.source_secret_scan_remediation_receipt_chain_regression_status}`,
    `Review rows: ${result.summary.ready_chain_review_row_count}/${result.summary.chain_review_row_count}`,
    `Review gates: ${result.summary.ready_chain_review_gate_count}/${result.summary.chain_review_gate_count}`,
    "",
    "## Review Rows",
    "",
    ...result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_rows.map((row) => `- ${row.source_phase_slot} ${row.package_script_name}: ${row.chain_review_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_OUT_DIR };
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
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptChainRegressionSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-fixtures.mjs [options]

Options:
  --out-dir <folder>                                                       Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_OUT_DIR}
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
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-schema <path>         P465 receipt chain regression fixtures schema path.
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
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.platformOpsLedgerPath),
    control_plane_human_gate_receipts_path: path.resolve(options.controlPlaneHumanGateReceiptsPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.controlPlaneHumanGateReceiptsPath),
    secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_attention_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanAttentionSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanAttentionSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_fail_closed_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanFailClosedSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanFailClosedSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationSchemaPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.reviewDashboardPath),
    control_plane_action_plan_path: path.resolve(options.controlPlaneActionPlanPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.controlPlaneActionPlanPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_template_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptTemplateSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptTemplateSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_intake_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptIntakeSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptIntakeSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_rules_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationRulesSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationRulesSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceMergeSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceMergeSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_merge_preflight_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptMergePreflightSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptMergePreflightSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationPacketSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationPacketSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalPlanSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalPlanSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_closeout_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalCloseoutSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalCloseoutSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptCloseoutSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptChainRegressionSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptChainRegressionSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.schemaPath),
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
