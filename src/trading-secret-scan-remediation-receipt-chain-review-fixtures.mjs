import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationReceiptChainRegressionFixtures,
} from "./trading-secret-scan-remediation-receipt-chain-regression-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-chain-review-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS,
  secretScanRemediationReceiptChainRegressionSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-chain-review-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-chain-review-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_chain_review_fixtures";
const PHASE_SLOT = "P440";
const PREVIOUS_PHASE_SLOT = "P439";
const NEXT_PHASE_SLOT = "P441";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_review";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_regression";
const CHAIN_REVIEW_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_human_review";
const COMMAND_NAME = "trading:secret-scan-remediation-receipt-chain-review-fixtures";
const CHAIN_REVIEW_CHECKS = [
  "p439_regression_ready",
  "source_phase_script_registered",
  "source_phase_validation_chain_registered",
  "source_phase_ledger_acceptance_declared",
  "review_packet_declared",
  "human_review_pending",
  "receipt_payload_absent",
  "secret_material_boundary_stays_false",
  "trading_mutation_disabled",
];

export async function runTradingSecretScanRemediationReceiptChainReviewFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptChainReviewFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptChainReviewFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt chain review fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptChainReviewFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const chainRegression = await buildTradingSecretScanRemediationReceiptChainRegressionFixtures({
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
    secretScanRemediationReceiptApprovalPlanSchemaPath: inputs.secret_scan_remediation_receipt_approval_plan_schema_path,
    secretScanRemediationReceiptApprovalCloseoutSchemaPath: inputs.secret_scan_remediation_receipt_approval_closeout_schema_path,
    secretScanRemediationReceiptCloseoutSchemaPath: inputs.secret_scan_remediation_receipt_closeout_schema_path,
    schemaPath: inputs.secret_scan_remediation_receipt_chain_regression_schema_path,
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
    trading_secret_scan_remediation_receipt_chain_review_fixtures_id: `trading-secret-scan-remediation-receipt-chain-review-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_scan_remediation_receipt_chain_review_anchor: reviewAnchor,
    secret_scan_remediation_receipt_chain_review_rows: reviewRows,
    secret_scan_remediation_receipt_chain_review_gate_rows: reviewGateRows,
    secret_scan_remediation_receipt_chain_review_boundary: reviewBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_chain_review_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ chainRegression, reviewRows, reviewGateRows, reviewBoundary, coverage, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_chain_review_fixtures_id = result.trading_secret_scan_remediation_receipt_chain_review_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptChainReviewFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-chain-review-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-review-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-review-rows.v1", "secret_scan_remediation_receipt_chain_review_rows", result.secret_scan_remediation_receipt_chain_review_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-review-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-review-gate-rows.v1", "secret_scan_remediation_receipt_chain_review_gate_rows", result.secret_scan_remediation_receipt_chain_review_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-review-boundary.json"), result.secret_scan_remediation_receipt_chain_review_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-remediation-receipt-chain-review-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptChainReviewFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptChainReviewFixtures(args);
    console.log(`Trading secret scan remediation receipt chain review fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_review_fixtures_status}`);
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
  const sourceReady = chainRegression.validation.valid && chainRegression.summary.trading_secret_scan_remediation_receipt_chain_regression_fixtures_status === SOURCE_READY_STATUS;
  return chainRegression.secret_scan_remediation_receipt_chain_regression_rows.map((sourceRow, index) => {
    const reviewReady = sourceReady && sourceRow.chain_phase_status === SOURCE_READY_STATUS;
    const row = {
      schema_version: "trading-secret-scan-remediation-receipt-chain-review-row.v1",
      secret_scan_remediation_receipt_chain_review_row_id: `trading-secret-scan-remediation-receipt-chain-review.row.${sourceRow.source_phase_slot.toLowerCase()}`,
      phase_slot: PHASE_SLOT,
      source_chain_regression_row_id: sourceRow.secret_scan_remediation_receipt_chain_regression_row_id,
      source_phase_slot: sourceRow.source_phase_slot,
      package_script_name: sourceRow.package_script_name,
      workflow_id: sourceRow.workflow_id,
      chain_review_status: reviewReady ? CHAIN_REVIEW_READY_STATUS : "blocked",
      source_chain_phase_status: sourceRow.chain_phase_status,
      source_secret_scan_remediation_receipt_chain_regression_status: chainRegression.summary.trading_secret_scan_remediation_receipt_chain_regression_fixtures_status,
      script_registered: sourceRow.script_registered,
      validation_chain_registered: sourceRow.validation_chain_registered,
      ledger_acceptance_declared: sourceRow.ledger_acceptance_declared,
      receipt_chain_regression_declared: sourceRow.receipt_chain_regression_declared,
      secret_scan_remediation_receipt_chain_review_declared: true,
      reviewer_role: "trading_secret_scan_operator",
      required_review_decision: "human_review_required_before_receipt_collection",
      review_completed: false,
      review_approval_applied: false,
      p429_p438_chain_ready: sourceRow.p429_p438_chain_ready,
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
    return withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_chain_review_hash");
  });
}

function buildCoverage({ chainRegression, reviewRows }) {
  const sourceReady = chainRegression.validation.valid && chainRegression.summary.trading_secret_scan_remediation_receipt_chain_regression_fixtures_status === SOURCE_READY_STATUS;
  return {
    p439_ready: sourceReady,
    expected_chain_review_row_count: chainRegression.summary.chain_phase_count,
    chain_review_row_count: reviewRows.length,
    ready_chain_review_row_count: reviewRows.filter((row) => row.chain_review_status === CHAIN_REVIEW_READY_STATUS).length,
    source_regression_rows_ready: chainRegression.secret_scan_remediation_receipt_chain_regression_rows.length === 10 && chainRegression.secret_scan_remediation_receipt_chain_regression_rows.every((row) => row.chain_phase_status === SOURCE_READY_STATUS && row.script_registered && row.validation_chain_registered && row.ledger_acceptance_declared),
    p429_p438_chain_ready: chainRegression.summary.p429_p438_chain_ready === true,
    human_receipts_pending: chainRegression.summary.human_receipts_pending === true,
    no_secret_material_read: chainRegression.summary.no_secret_material_read === true && reviewRows.every((row) => row.no_secret_material_read && !row.secret_values_read_by_review && !row.env_file_read_by_review && !row.desktop_config_content_inspected_by_review && !row.desktop_config_read_by_review),
    no_secret_or_trading_mutation: chainRegression.summary.no_secret_or_trading_mutation === true && reviewRows.every((row) => row.no_secret_or_trading_mutation && !row.credential_lookup_allowed_by_review && !row.broker_write_allowed_by_review && !row.exchange_write_allowed_by_review && !row.artifact_write_performed_by_review && !row.protected_action_executed_by_review),
  };
}

function buildReviewAnchor(chainRegression, coverage) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-review-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_regression_fixtures_id: chainRegression.trading_secret_scan_remediation_receipt_chain_regression_fixtures_id,
    source_secret_scan_remediation_receipt_chain_regression_status: chainRegression.summary.trading_secret_scan_remediation_receipt_chain_regression_fixtures_status,
    expected_chain_review_row_count: coverage.expected_chain_review_row_count,
    coverage_hash: hashValue(coverage),
    source_hash: hashValue({
      id: chainRegression.trading_secret_scan_remediation_receipt_chain_regression_fixtures_id,
      status: chainRegression.summary.trading_secret_scan_remediation_receipt_chain_regression_fixtures_status,
      chain_rows: chainRegression.summary.chain_phase_count,
      chain_gate_rows: chainRegression.summary.chain_gate_count,
    }),
  };
}

function buildReviewBoundary({ generatedAt, writeRequested, chainRegression, reviewRows, coverage }) {
  const sourceSummary = chainRegression.summary;
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-review-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_scan_remediation_receipt_chain_review_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_receipt_chain_regression_status: sourceSummary.trading_secret_scan_remediation_receipt_chain_regression_fixtures_status,
    source_secret_scan_remediation_receipt_chain_regression_ready: coverage.p439_ready,
    chain_review_row_count: reviewRows.length,
    ready_chain_review_row_count: coverage.ready_chain_review_row_count,
    chain_regression_consumed_in_memory: true,
    chain_regression_artifact_read_performed: false,
    secret_scan_remediation_receipt_chain_review_declared: true,
    review_completed: false,
    review_approval_applied: false,
    p429_p438_chain_ready: coverage.p429_p438_chain_ready,
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
    ["p439_chain_regression_ready", "P439 secret scan remediation receipt chain regression source is ready.", chainRegression.validation.valid && chainRegression.summary.trading_secret_scan_remediation_receipt_chain_regression_fixtures_status === SOURCE_READY_STATUS],
    ["platform_package_script_registered", "package.json registers the P440 trading secret scan remediation receipt chain review fixtures command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0],
    ["platform_validation_chain_registered", "Validation chain includes the P440 trading secret scan remediation receipt chain review fixtures command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)],
    ["p440_ledger_acceptance_declared", "P440 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P440: `trading:secret-scan-remediation-receipt-chain-review-fixtures`")],
    ["p429_p438_regression_rows_ready", "Every P429-P438 secret scan remediation receipt chain regression row is ready.", coverage.source_regression_rows_ready],
    ["chain_review_rows_ready", "Every secret scan remediation receipt chain review row is ready while review completion remains pending.", reviewRows.length === 10 && reviewRows.every((row) => row.chain_review_status === CHAIN_REVIEW_READY_STATUS && row.secret_scan_remediation_receipt_chain_review_declared && !row.review_completed && !row.review_approval_applied && row.human_receipts_pending)],
    ["human_review_pending_not_applied", "P440 declares human review packets without completing review or applying approvals.", !reviewBoundary.review_completed && !reviewBoundary.review_approval_applied && reviewBoundary.human_review_required && !reviewBoundary.approval_applied],
    ["no_receipt_payload_validation", "P440 does not receive, validate, apply, or convert receipt payloads into approval.", !reviewBoundary.actor_workspace_input_present && !reviewBoundary.receipt_payload_present && !reviewBoundary.ready_for_validation && !reviewBoundary.ready_for_approval_application && !reviewBoundary.receipt_received && !reviewBoundary.receipt_validated && !reviewBoundary.receipt_application_performed && !reviewBoundary.approval_applied],
    ["no_secret_material_read", "P440 reads no secret values, env files, or Desktop config content.", reviewBoundary.no_secret_material_read && !reviewBoundary.secret_values_read && !reviewBoundary.env_file_read && !reviewBoundary.desktop_config_content_inspected && !reviewBoundary.desktop_config_read],
    ["no_secret_or_trading_mutation", "P440 performs no credential lookup, trading writes, artifact mutation, release, git, or protected action.", reviewBoundary.no_secret_or_trading_mutation && !reviewBoundary.credential_lookup_allowed && !reviewBoundary.broker_write_allowed && !reviewBoundary.exchange_write_allowed && !reviewBoundary.artifact_write_performed && !reviewBoundary.protected_action_executed],
  ];
  return gateInputs.map(([rowKey, description, passed], index) => withOrdinalAndHash(gateRow(rowKey, description, passed), index, "secret_scan_remediation_receipt_chain_review_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-review-gate-row.v1",
    secret_scan_remediation_receipt_chain_review_gate_row_id: `trading-secret-scan-remediation-receipt-chain-review-fixtures.gate.${rowKey}`,
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
    validationItem("source.secret_scan_remediation_receipt_chain_regression", "p439_chain_regression_ready", chainRegression.validation.valid && chainRegression.summary.trading_secret_scan_remediation_receipt_chain_regression_fixtures_status === SOURCE_READY_STATUS, "P439 secret scan remediation receipt chain regression fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P440 secret scan remediation receipt chain review fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("secret_scan_remediation_receipt_chain_review_rows", "chain_review_rows_ready", reviewRows.length === 10 && reviewRows.every((row) => row.chain_review_status === CHAIN_REVIEW_READY_STATUS && row.script_registered && row.validation_chain_registered && row.ledger_acceptance_declared && row.secret_scan_remediation_receipt_chain_review_declared && !row.review_completed && !row.review_approval_applied && row.p429_p438_chain_ready && row.human_receipts_pending && row.no_secret_material_read && row.no_secret_or_trading_mutation && !row.receipt_payload_present && !row.approval_applied_by_review), "P429-P438 secret scan remediation receipt chain review rows must be ready and pending human review."),
    validationItem("secret_scan_remediation_receipt_chain_review_gate_rows", "chain_review_gates_ready", reviewGateRows.length >= 10 && reviewGateRows.every((row) => row.gate_status === "ready" && !row.review_completed_by_review && !row.approval_applied_by_review && !row.protected_action_executed_by_review), "P440 secret scan remediation receipt chain review gates are ready."),
    validationItem("coverage.source_regression_rows", "source_regression_rows_ready", coverage.source_regression_rows_ready, "P429-P438 regression rows must remain ready."),
    validationItem("boundary.review_pending", "review_pending_not_applied", reviewBoundary.read_only && reviewBoundary.report_only && reviewBoundary.chain_regression_consumed_in_memory && !reviewBoundary.chain_regression_artifact_read_performed && reviewBoundary.secret_scan_remediation_receipt_chain_review_declared && !reviewBoundary.review_completed && !reviewBoundary.review_approval_applied && reviewBoundary.p429_p438_chain_ready && reviewBoundary.human_receipts_pending && reviewBoundary.human_review_required, "Secret scan remediation receipt chain review remains pending and unapplied."),
    validationItem("boundary.no_receipt_payload_validation", "no_receipt_payload_validation", !reviewBoundary.actor_workspace_input_present && !reviewBoundary.receipt_input_file_materialized && !reviewBoundary.merged_receipt_input_materialized && !reviewBoundary.receipt_payload_present && !reviewBoundary.ready_for_validation && !reviewBoundary.ready_for_approval_application && !reviewBoundary.receipt_received && !reviewBoundary.receipt_validated && !reviewBoundary.receipt_application_performed && !reviewBoundary.approval_applied, "P440 does not receive/apply receipts."),
    validationItem("boundary.no_secret_or_trading_mutation", "no_secret_or_trading_mutation", reviewBoundary.no_secret_material_read && reviewBoundary.no_secret_or_trading_mutation && !reviewBoundary.secret_values_read && !reviewBoundary.env_file_read && !reviewBoundary.desktop_config_content_inspected && !reviewBoundary.desktop_config_read && !reviewBoundary.credential_lookup_allowed && !reviewBoundary.broker_write_allowed && !reviewBoundary.exchange_write_allowed && !reviewBoundary.command_execution_performed && !reviewBoundary.artifact_read_performed && !reviewBoundary.artifact_write_performed && !reviewBoundary.protected_action_executed, "P440 reads no secret material and performs no trading, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ chainRegression, reviewRows, reviewGateRows, reviewBoundary, coverage, validation }) {
  return {
    trading_secret_scan_remediation_receipt_chain_review_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_regression_status: chainRegression.summary.trading_secret_scan_remediation_receipt_chain_regression_fixtures_status,
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
    secret_scan_remediation_receipt_chain_review_declared: reviewBoundary.secret_scan_remediation_receipt_chain_review_declared,
    review_completed: reviewBoundary.review_completed,
    review_approval_applied: reviewBoundary.review_approval_applied,
    p429_p438_chain_ready: reviewBoundary.p429_p438_chain_ready,
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
    "# Trading Secret Scan Remediation Receipt Chain Review Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_review_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source chain regression: ${result.summary.source_secret_scan_remediation_receipt_chain_regression_status}`,
    `Review rows: ${result.summary.ready_chain_review_row_count}/${result.summary.chain_review_row_count}`,
    `Review gates: ${result.summary.ready_chain_review_gate_count}/${result.summary.chain_review_gate_count}`,
    "",
    "## Review Rows",
    "",
    ...result.secret_scan_remediation_receipt_chain_review_rows.map((row) => `- ${row.source_phase_slot} ${row.package_script_name}: ${row.chain_review_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_scan_remediation_receipt_chain_review_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_OUT_DIR };
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
    else if (arg === "--secret-scan-remediation-receipt-approval-closeout-schema") parsed.secretScanRemediationReceiptApprovalCloseoutSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-closeout-schema") parsed.secretScanRemediationReceiptCloseoutSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-regression-schema") parsed.secretScanRemediationReceiptChainRegressionSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-chain-review-fixtures.mjs [options]

Options:
  --out-dir <folder>                                                       Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_OUT_DIR}
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
  --secret-scan-remediation-receipt-approval-closeout-schema <path>        P437 receipt approval closeout fixtures schema path.
  --secret-scan-remediation-receipt-closeout-schema <path>                 P438 receipt closeout fixtures schema path.
  --secret-scan-remediation-receipt-chain-regression-schema <path>         P439 receipt chain regression fixtures schema path.
  --control-plane-human-gate-receipts <path>                               Control-plane human gate receipts source path.
  --schema <path>                                                          Output schema path.
  --check                                                                  Validate only, do not write artifacts.
  -h, --help                                                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.platformOpsLedgerPath),
    control_plane_human_gate_receipts_path: path.resolve(options.controlPlaneHumanGateReceiptsPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.controlPlaneHumanGateReceiptsPath),
    secret_scan_remediation_receipt_template_schema_path: path.resolve(options.secretScanRemediationReceiptTemplateSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptTemplateSchemaPath),
    secret_scan_remediation_receipt_intake_schema_path: path.resolve(options.secretScanRemediationReceiptIntakeSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptIntakeSchemaPath),
    secret_scan_remediation_receipt_validation_rules_schema_path: path.resolve(options.secretScanRemediationReceiptValidationRulesSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptValidationRulesSchemaPath),
    secret_scan_remediation_receipt_workspace_schema_path: path.resolve(options.secretScanRemediationReceiptWorkspaceSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptWorkspaceSchemaPath),
    secret_scan_remediation_receipt_workspace_merge_schema_path: path.resolve(options.secretScanRemediationReceiptWorkspaceMergeSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptWorkspaceMergeSchemaPath),
    secret_scan_remediation_receipt_merge_preflight_schema_path: path.resolve(options.secretScanRemediationReceiptMergePreflightSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptMergePreflightSchemaPath),
    secret_scan_remediation_receipt_validation_packet_schema_path: path.resolve(options.secretScanRemediationReceiptValidationPacketSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptValidationPacketSchemaPath),
    secret_scan_remediation_receipt_approval_plan_schema_path: path.resolve(options.secretScanRemediationReceiptApprovalPlanSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptApprovalPlanSchemaPath),
    secret_scan_remediation_receipt_approval_closeout_schema_path: path.resolve(options.secretScanRemediationReceiptApprovalCloseoutSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptApprovalCloseoutSchemaPath),
    secret_scan_remediation_receipt_closeout_schema_path: path.resolve(options.secretScanRemediationReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptCloseoutSchemaPath),
    secret_scan_remediation_receipt_chain_regression_schema_path: path.resolve(options.secretScanRemediationReceiptChainRegressionSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.secretScanRemediationReceiptChainRegressionSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.schemaPath),
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
