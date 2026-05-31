import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS,
  buildTradingPromotionReceiptIntakeQueueFixtures,
} from "./trading-promotion-receipt-intake-queue-fixtures.mjs";

export const DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_OUT_DIR = "artifacts/trading-promotion-receipt-validation-rules-fixtures/latest";
export const DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS,
  promotionReceiptIntakeQueueFixturesSchemaPath: DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-promotion-receipt-validation-rules-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-promotion-receipt-validation-rules-fixtures.v1";
const CAPABILITY_ID = "trading.promotion_receipt_validation_rules_fixtures";
const PHASE_SLOT = "P405";
const PREVIOUS_PHASE_SLOT = "P404";
const NEXT_PHASE_SLOT = "P406";
const READY_STATUS = "ready_for_trading_promotion_receipt_validation_rules_regression";
const SOURCE_READY_STATUS = "ready_for_trading_promotion_receipt_intake_queue_regression";
const REQUIRED_RECEIPT_FIELDS = [
  "receipt_id",
  "reviewer_role",
  "source_artifact_ref",
  "decision",
  "reviewed_at",
  "risk_acknowledgement",
  "protected_action_acknowledgement",
];
const ALLOWED_RECEIPT_DECISIONS = ["approved_for_next_stage", "return_with_blocker", "reject_promotion"];

export async function runTradingPromotionReceiptValidationRulesFixtures(options = {}) {
  const result = await buildTradingPromotionReceiptValidationRulesFixtures(options);
  if (options.write !== false) await writeTradingPromotionReceiptValidationRulesFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading promotion receipt validation rules fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingPromotionReceiptValidationRulesFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const receiptIntakeQueue = await buildTradingPromotionReceiptIntakeQueueFixtures({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    tradingSamplePath: inputs.trading_sample_path,
    backtestValidationPath: inputs.backtest_validation_path,
    limitedLivePath: inputs.limited_live_path,
    fullAutoPath: inputs.full_auto_path,
    paperShadowPath: inputs.paper_shadow_path,
    executionEnginePath: inputs.execution_engine_path,
    riskEnginePath: inputs.risk_engine_path,
    signalEnginePath: inputs.signal_engine_path,
    modelImprovementPath: inputs.model_improvement_path,
    researchBacktestPaperPath: inputs.research_backtest_paper_path,
    marketDataFeatureStorePath: inputs.market_data_feature_store_path,
    modelDegradationHaltFixturesSchemaPath: inputs.model_degradation_halt_fixtures_schema_path,
    dataOutageHaltFixturesSchemaPath: inputs.data_outage_halt_fixtures_schema_path,
    promotionReceiptContractFixturesSchemaPath: inputs.promotion_receipt_contract_fixtures_schema_path,
    promotionCompletionGateFixturesSchemaPath: inputs.promotion_completion_gate_fixtures_schema_path,
    promotionGovernanceReadonlyFixturesSchemaPath: inputs.promotion_governance_readonly_fixtures_schema_path,
    schemaPath: inputs.promotion_receipt_intake_queue_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const rulesAnchor = buildRulesAnchor(receiptIntakeQueue);
  const ruleRows = buildRuleRows(receiptIntakeQueue);
  const rulesSummaryRows = buildRulesSummaryRows(ruleRows);
  const rulesBoundary = buildRulesBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    receiptIntakeQueue,
    ruleRows,
    summaryRows: rulesSummaryRows,
  });
  const rulesGateRows = buildRulesGateRows({ receiptIntakeQueue, packageJson, platformOpsLedger, ruleRows, rulesBoundary });
  const validationItems = buildValidationItems({ receiptIntakeQueue, packageJson, platformOpsLedger, ruleRows, summaryRows: rulesSummaryRows, rulesGateRows, rulesBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ receiptIntakeQueue, ruleRows, summaryRows: rulesSummaryRows, rulesGateRows, rulesBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_promotion_receipt_validation_rules_fixtures_id: `trading-promotion-receipt-validation-rules-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    promotion_receipt_validation_rules_anchor: rulesAnchor,
    promotion_receipt_validation_rule_rows: ruleRows,
    promotion_receipt_validation_rule_summary_rows: rulesSummaryRows,
    promotion_receipt_validation_rules_gate_rows: rulesGateRows,
    promotion_receipt_validation_rules_boundary: rulesBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_promotion_receipt_validation_rules_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ receiptIntakeQueue, ruleRows, summaryRows: rulesSummaryRows, rulesGateRows, rulesBoundary, validation: result.validation });
  result.summary.trading_promotion_receipt_validation_rules_fixtures_id = result.trading_promotion_receipt_validation_rules_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingPromotionReceiptValidationRulesFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-promotion-receipt-validation-rules-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "promotion-receipt-validation-rule-rows.json"), collectionEnvelope("trading-promotion-receipt-validation-rule-rows.v1", "promotion_receipt_validation_rule_rows", result.promotion_receipt_validation_rule_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-validation-rule-summary-rows.json"), collectionEnvelope("trading-promotion-receipt-validation-rule-summary-rows.v1", "promotion_receipt_validation_rule_summary_rows", result.promotion_receipt_validation_rule_summary_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-validation-rules-gate-rows.json"), collectionEnvelope("trading-promotion-receipt-validation-rules-gate-rows.v1", "promotion_receipt_validation_rules_gate_rows", result.promotion_receipt_validation_rules_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-validation-rules-boundary.json"), result.promotion_receipt_validation_rules_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-promotion-receipt-validation-rules-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingPromotionReceiptValidationRulesFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingPromotionReceiptValidationRulesFixtures(args);
    console.log(`Trading promotion receipt validation rules fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_promotion_receipt_validation_rules_fixtures_status}`);
    console.log(`Rule rows: ${result.summary.ready_rule_row_count}/${result.summary.rule_row_count}`);
    console.log(`Receipt payload present: ${result.summary.receipt_payload_present}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildRulesAnchor(receiptIntakeQueue) {
  return {
    schema_version: "trading-promotion-receipt-validation-rules-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_intake_queue_fixtures_id: receiptIntakeQueue.trading_promotion_receipt_intake_queue_fixtures_id,
    source_promotion_receipt_intake_queue_status: receiptIntakeQueue.summary.trading_promotion_receipt_intake_queue_fixtures_status,
    required_receipt_field_count: REQUIRED_RECEIPT_FIELDS.length,
    allowed_receipt_decision_count: ALLOWED_RECEIPT_DECISIONS.length,
    source_hash: hashValue({
      id: receiptIntakeQueue.trading_promotion_receipt_intake_queue_fixtures_id,
      status: receiptIntakeQueue.summary.trading_promotion_receipt_intake_queue_fixtures_status,
      queue_rows: receiptIntakeQueue.summary.receipt_intake_queue_row_count,
    }),
  };
}

function buildRuleRows(receiptIntakeQueue) {
  const sourceReady = receiptIntakeQueue.validation.valid && receiptIntakeQueue.summary.trading_promotion_receipt_intake_queue_fixtures_status === SOURCE_READY_STATUS;
  return receiptIntakeQueue.promotion_receipt_intake_queue_rows.map((queueRow, index) => {
    const ruleStatus = sourceReady && queueRow.receipt_intake_queue_status === "queued_pending_human_receipt" ? "ready_for_future_receipt_validation" : "blocked";
    const row = {
      schema_version: "trading-promotion-receipt-validation-rule-row.v1",
      promotion_receipt_validation_rule_row_id: `trading-promotion-receipt-validation-rules.row.${queueRow.row_key}`,
      phase_slot: PHASE_SLOT,
      source_receipt_intake_queue_row_id: queueRow.promotion_receipt_intake_queue_row_id,
      source_queue_row_key: queueRow.row_key,
      from_stage: queueRow.from_stage,
      to_stage: queueRow.to_stage,
      receipt_contract_id: queueRow.receipt_contract_id,
      source_receipt_intake_queue_status: queueRow.receipt_intake_queue_status,
      receipt_validation_rule_status: ruleStatus,
      required_receipt_fields: REQUIRED_RECEIPT_FIELDS,
      allowed_receipt_decisions: ALLOWED_RECEIPT_DECISIONS,
      future_receipt_validation_required: true,
      receipt_payload_present: false,
      ready_to_validate_receipt_payload: false,
      receipt_received_by_rules: false,
      receipt_validated_by_rules: false,
      receipt_application_performed_by_rules: false,
      approval_applied_by_rules: false,
      promotion_enablement_allowed_by_rules: false,
      live_order_submission_allowed_by_rules: false,
      live_execution_allowed_by_rules: false,
      receipt_queue_consumed_in_memory: true,
      receipt_queue_artifact_read_performed_by_rules: false,
      command_execution_performed_by_rules: false,
      artifact_read_performed_by_rules: false,
      artifact_write_performed_by_rules: false,
      protected_action_executed_by_rules: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "promotion_receipt_validation_rule_hash");
  });
}

function buildRulesSummaryRows(ruleRows) {
  return ruleRows.map((ruleRow, index) => {
    const row = {
      schema_version: "trading-promotion-receipt-validation-rule-summary-row.v1",
      promotion_receipt_validation_rule_summary_row_id: `trading-promotion-receipt-validation-rules.summary.${ruleRow.source_queue_row_key}`,
      phase_slot: PHASE_SLOT,
      source_queue_row_key: ruleRow.source_queue_row_key,
      from_stage: ruleRow.from_stage,
      to_stage: ruleRow.to_stage,
      receipt_contract_id: ruleRow.receipt_contract_id,
      receipt_validation_rule_status: ruleRow.receipt_validation_rule_status,
      required_receipt_field_count: ruleRow.required_receipt_fields.length,
      allowed_receipt_decision_count: ruleRow.allowed_receipt_decisions.length,
      future_receipt_validation_required: ruleRow.future_receipt_validation_required,
      receipt_payload_present: ruleRow.receipt_payload_present,
      receipt_validated_by_rules: ruleRow.receipt_validated_by_rules,
      approval_applied_by_rules: ruleRow.approval_applied_by_rules,
      promotion_enablement_allowed_by_rules: ruleRow.promotion_enablement_allowed_by_rules,
      summary_status: ruleRow.receipt_validation_rule_status === "ready_for_future_receipt_validation" ? "future_receipt_validation_rules_ready" : "blocked",
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "promotion_receipt_validation_rule_summary_hash");
  });
}

function buildRulesBoundary({ generatedAt, writeRequested, receiptIntakeQueue, ruleRows, summaryRows }) {
  const sourceSummary = receiptIntakeQueue.summary;
  return {
    schema_version: "trading-promotion-receipt-validation-rules-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    promotion_receipt_validation_rules_artifact_write_requested: writeRequested,
    promotion_receipt_validation_rules_execution_performed: false,
    source_promotion_receipt_intake_queue_status: sourceSummary.trading_promotion_receipt_intake_queue_fixtures_status,
    source_promotion_receipt_intake_queue_ready: receiptIntakeQueue.validation.valid && sourceSummary.trading_promotion_receipt_intake_queue_fixtures_status === SOURCE_READY_STATUS,
    rule_row_count: ruleRows.length,
    summary_row_count: summaryRows.length,
    ready_rule_row_count: ruleRows.filter((row) => row.receipt_validation_rule_status === "ready_for_future_receipt_validation").length,
    validation_rules_declared: true,
    future_receipt_validation_required: true,
    required_receipt_field_count: REQUIRED_RECEIPT_FIELDS.length,
    allowed_receipt_decision_count: ALLOWED_RECEIPT_DECISIONS.length,
    receipt_queue_consumed_in_memory: true,
    receipt_queue_artifact_read_performed: false,
    receipt_payload_present: false,
    ready_to_validate_receipt_payload: false,
    receipt_received: false,
    receipt_validated: false,
    receipt_application_performed: false,
    approval_applied: false,
    source_receipt_present: sourceSummary.source_receipt_present,
    source_approval_applied: sourceSummary.source_approval_applied,
    real_enablement_count: sourceSummary.real_enablement_count,
    shadow_live_enabled: sourceSummary.shadow_live_enabled,
    limited_live_enabled: sourceSummary.limited_live_enabled,
    full_auto_enabled: sourceSummary.full_auto_enabled,
    automatic_order_submission_allowed: sourceSummary.automatic_order_submission_allowed,
    live_order_submission_allowed: sourceSummary.live_order_submission_allowed,
    live_promotion_allowed: sourceSummary.live_promotion_allowed,
    live_execution_allowed: sourceSummary.live_execution_allowed,
    broker_write_allowed: sourceSummary.broker_write_allowed,
    exchange_write_allowed: sourceSummary.exchange_write_allowed,
    command_execution_performed: false,
    package_command_execution_performed: false,
    release_check_execution_performed: false,
    artifact_read_performed: false,
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    human_review_required: true,
  };
}

function buildRulesGateRows({ receiptIntakeQueue, packageJson, platformOpsLedger, ruleRows, rulesBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p404_receipt_intake_queue_ready", "P404 promotion receipt intake queue source is ready.", receiptIntakeQueue.validation.valid && receiptIntakeQueue.summary.trading_promotion_receipt_intake_queue_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P405 trading promotion receipt validation rules fixtures command.", typeof scripts["trading:promotion-receipt-validation-rules-fixtures"] === "string" && scripts["trading:promotion-receipt-validation-rules-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P405 trading promotion receipt validation rules fixtures command.", validateScript.includes("npm run trading:promotion-receipt-validation-rules-fixtures -- --check")),
    gateRow("p405_ledger_acceptance_declared", "P405 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P405: `trading:promotion-receipt-validation-rules-fixtures`")),
    gateRow("validation_rule_rows_ready", "All promotion receipt validation rule rows are ready for future receipt validation.", ruleRows.length === 6 && ruleRows.every((row) => row.receipt_validation_rule_status === "ready_for_future_receipt_validation" && row.future_receipt_validation_required)),
    gateRow("receipt_fields_and_decisions_declared", "Validation rules declare required receipt fields and allowed decisions for every promotion stage.", ruleRows.every((row) => REQUIRED_RECEIPT_FIELDS.every((field) => row.required_receipt_fields.includes(field)) && ALLOWED_RECEIPT_DECISIONS.every((decision) => row.allowed_receipt_decisions.includes(decision)))),
    gateRow("no_receipt_payload_validation", "Validation rules declare future checks without receiving or validating receipt payloads.", !rulesBoundary.receipt_payload_present && !rulesBoundary.ready_to_validate_receipt_payload && !rulesBoundary.receipt_received && !rulesBoundary.receipt_validated && !rulesBoundary.receipt_application_performed && !rulesBoundary.approval_applied),
    gateRow("live_and_full_auto_enablement_blocked", "P405 rules do not enable shadow, limited-live, full-auto, live execution, order submission, broker writes, or exchange writes.", !rulesBoundary.shadow_live_enabled && !rulesBoundary.limited_live_enabled && !rulesBoundary.full_auto_enabled && !rulesBoundary.automatic_order_submission_allowed && !rulesBoundary.live_order_submission_allowed && !rulesBoundary.live_execution_allowed && !rulesBoundary.broker_write_allowed && !rulesBoundary.exchange_write_allowed),
    gateRow("no_command_or_artifact_mutation", "P405 rules do not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !rulesBoundary.command_execution_performed && !rulesBoundary.artifact_read_performed && !rulesBoundary.artifact_write_performed && !rulesBoundary.release_published && !rulesBoundary.git_operation_performed && !rulesBoundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "promotion_receipt_validation_rules_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-promotion-receipt-validation-rules-gate-row.v1",
    promotion_receipt_validation_rules_gate_row_id: `trading-promotion-receipt-validation-rules-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_payload_present_by_rules: false,
    receipt_validated_by_rules: false,
    receipt_application_performed_by_rules: false,
    approval_applied_by_rules: false,
    promotion_enablement_allowed_by_rules: false,
    live_order_submission_allowed_by_rules: false,
    live_execution_allowed_by_rules: false,
    protected_action_executed_by_rules: false,
    human_review_required: true,
  };
}

function buildValidationItems({ receiptIntakeQueue, packageJson, platformOpsLedger, ruleRows, summaryRows, rulesGateRows, rulesBoundary }) {
  return [
    validationItem("source.promotion_receipt_intake_queue", "p404_receipt_intake_queue_ready", receiptIntakeQueue.validation.valid && receiptIntakeQueue.summary.trading_promotion_receipt_intake_queue_fixtures_status === SOURCE_READY_STATUS, "P404 promotion receipt intake queue fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P405 promotion receipt validation rules fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("promotion_receipt_validation_rule_rows", "validation_rule_rows_ready", ruleRows.length === 6 && ruleRows.every((row) => row.receipt_validation_rule_status === "ready_for_future_receipt_validation" && row.future_receipt_validation_required && !row.receipt_payload_present && !row.ready_to_validate_receipt_payload && REQUIRED_RECEIPT_FIELDS.every((field) => row.required_receipt_fields.includes(field)) && ALLOWED_RECEIPT_DECISIONS.every((decision) => row.allowed_receipt_decisions.includes(decision))), "Promotion receipt validation rule rows must declare future validation requirements without receipt payloads."),
    validationItem("promotion_receipt_validation_rule_summary_rows", "validation_rule_summary_rows_ready", summaryRows.length === 6 && summaryRows.every((row) => row.summary_status === "future_receipt_validation_rules_ready"), "Promotion receipt validation rule summary rows must be ready."),
    validationItem("promotion_receipt_validation_rules_gate_rows", "rule_gates_ready", rulesGateRows.length >= 9 && rulesGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_rules && !row.protected_action_executed_by_rules), "P405 promotion receipt validation rules gates are ready."),
    validationItem("boundary.no_receipt_payload", "no_receipt_payload", rulesBoundary.read_only && rulesBoundary.report_only && rulesBoundary.receipt_queue_consumed_in_memory && !rulesBoundary.receipt_queue_artifact_read_performed && rulesBoundary.validation_rules_declared && rulesBoundary.future_receipt_validation_required && !rulesBoundary.receipt_payload_present && !rulesBoundary.ready_to_validate_receipt_payload && !rulesBoundary.receipt_received && !rulesBoundary.receipt_validated && !rulesBoundary.receipt_application_performed && !rulesBoundary.approval_applied, "Promotion receipt validation rules declare future requirements without validating receipts."),
    validationItem("boundary.no_source_receipt_or_approval", "no_source_receipt_or_approval", !rulesBoundary.source_receipt_present && !rulesBoundary.source_approval_applied, "P405 must not inherit pre-applied promotion receipts or approvals."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !rulesBoundary.command_execution_performed && !rulesBoundary.package_command_execution_performed && !rulesBoundary.release_check_execution_performed && !rulesBoundary.artifact_read_performed && !rulesBoundary.artifact_write_performed, "Promotion receipt validation rules do not execute commands or read/write artifacts."),
    validationItem("boundary.no_trading_mutation", "no_trading_mutation", !rulesBoundary.shadow_live_enabled && !rulesBoundary.limited_live_enabled && !rulesBoundary.full_auto_enabled && !rulesBoundary.automatic_order_submission_allowed && !rulesBoundary.live_order_submission_allowed && !rulesBoundary.live_execution_allowed && !rulesBoundary.broker_write_allowed && !rulesBoundary.exchange_write_allowed && !rulesBoundary.release_published && !rulesBoundary.git_operation_performed && !rulesBoundary.protected_action_executed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
  ];
}

function buildSummary({ receiptIntakeQueue, ruleRows, summaryRows, rulesGateRows, rulesBoundary, validation }) {
  return {
    trading_promotion_receipt_validation_rules_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_intake_queue_status: receiptIntakeQueue.summary.trading_promotion_receipt_intake_queue_fixtures_status,
    source_promotion_receipt_intake_queue_ready: rulesBoundary.source_promotion_receipt_intake_queue_ready,
    rule_row_count: ruleRows.length,
    ready_rule_row_count: rulesBoundary.ready_rule_row_count,
    summary_row_count: summaryRows.length,
    gate_count: rulesGateRows.length,
    ready_gate_count: rulesGateRows.filter((row) => row.gate_status === "ready").length,
    validation_rules_declared: rulesBoundary.validation_rules_declared,
    future_receipt_validation_required: rulesBoundary.future_receipt_validation_required,
    required_receipt_field_count: rulesBoundary.required_receipt_field_count,
    allowed_receipt_decision_count: rulesBoundary.allowed_receipt_decision_count,
    receipt_queue_consumed_in_memory: rulesBoundary.receipt_queue_consumed_in_memory,
    receipt_queue_artifact_read_performed: rulesBoundary.receipt_queue_artifact_read_performed,
    receipt_payload_present: rulesBoundary.receipt_payload_present,
    ready_to_validate_receipt_payload: rulesBoundary.ready_to_validate_receipt_payload,
    receipt_received: rulesBoundary.receipt_received,
    receipt_validated: rulesBoundary.receipt_validated,
    receipt_application_performed: rulesBoundary.receipt_application_performed,
    approval_applied: rulesBoundary.approval_applied,
    source_receipt_present: rulesBoundary.source_receipt_present,
    source_approval_applied: rulesBoundary.source_approval_applied,
    real_enablement_count: rulesBoundary.real_enablement_count,
    shadow_live_enabled: rulesBoundary.shadow_live_enabled,
    limited_live_enabled: rulesBoundary.limited_live_enabled,
    full_auto_enabled: rulesBoundary.full_auto_enabled,
    automatic_order_submission_allowed: rulesBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: rulesBoundary.live_order_submission_allowed,
    live_promotion_allowed: rulesBoundary.live_promotion_allowed,
    live_execution_allowed: rulesBoundary.live_execution_allowed,
    broker_write_allowed: rulesBoundary.broker_write_allowed,
    exchange_write_allowed: rulesBoundary.exchange_write_allowed,
    command_execution_performed: rulesBoundary.command_execution_performed,
    package_command_execution_performed: rulesBoundary.package_command_execution_performed,
    release_check_execution_performed: rulesBoundary.release_check_execution_performed,
    artifact_read_performed: rulesBoundary.artifact_read_performed,
    artifact_write_performed: rulesBoundary.artifact_write_performed,
    release_published: rulesBoundary.release_published,
    git_operation_performed: rulesBoundary.git_operation_performed,
    protected_action_executed: rulesBoundary.protected_action_executed,
    human_review_required: rulesBoundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Promotion Receipt Validation Rules Fixtures",
    "",
    `Status: ${result.summary.trading_promotion_receipt_validation_rules_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source intake queue: ${result.summary.source_promotion_receipt_intake_queue_status}`,
    `Rule rows: ${result.summary.ready_rule_row_count}/${result.summary.rule_row_count}`,
    `Receipt payload present: ${result.summary.receipt_payload_present}`,
    "",
    "## Rule Rows",
    "",
    ...result.promotion_receipt_validation_rule_rows.map((row) => `- ${row.source_queue_row_key}: ${row.receipt_validation_rule_status}`),
    "",
    "## Gates",
    "",
    ...result.promotion_receipt_validation_rules_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--trading-sample") parsed.tradingSamplePath = argv[++index];
    else if (arg === "--backtest-validation") parsed.backtestValidationPath = argv[++index];
    else if (arg === "--limited-live") parsed.limitedLivePath = argv[++index];
    else if (arg === "--full-auto") parsed.fullAutoPath = argv[++index];
    else if (arg === "--paper-shadow") parsed.paperShadowPath = argv[++index];
    else if (arg === "--execution-engine") parsed.executionEnginePath = argv[++index];
    else if (arg === "--risk-engine") parsed.riskEnginePath = argv[++index];
    else if (arg === "--signal-engine") parsed.signalEnginePath = argv[++index];
    else if (arg === "--model-improvement") parsed.modelImprovementPath = argv[++index];
    else if (arg === "--research-backtest-paper") parsed.researchBacktestPaperPath = argv[++index];
    else if (arg === "--market-data-feature-store") parsed.marketDataFeatureStorePath = argv[++index];
    else if (arg === "--model-degradation-halt-fixtures-schema") parsed.modelDegradationHaltFixturesSchemaPath = argv[++index];
    else if (arg === "--data-outage-halt-fixtures-schema") parsed.dataOutageHaltFixturesSchemaPath = argv[++index];
    else if (arg === "--promotion-receipt-contract-fixtures-schema") parsed.promotionReceiptContractFixturesSchemaPath = argv[++index];
    else if (arg === "--promotion-completion-gate-fixtures-schema") parsed.promotionCompletionGateFixturesSchemaPath = argv[++index];
    else if (arg === "--promotion-governance-readonly-fixtures-schema") parsed.promotionGovernanceReadonlyFixturesSchemaPath = argv[++index];
    else if (arg === "--promotion-receipt-intake-queue-fixtures-schema") parsed.promotionReceiptIntakeQueueFixturesSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-promotion-receipt-validation-rules-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_OUT_DIR}
  --run-at <iso>                           Deterministic generated_at timestamp.
  --package <path>                         package.json path.
  --platform-ops-ledger <path>             P341-P500 platform operations ledger path.
  --trading-sample <path>                  Research/backtest/paper sample artifact path.
  --backtest-validation <path>             Backtest validation artifact path.
  --limited-live <path>                    Limited-live governance artifact path.
  --full-auto <path>                       Full-auto governance artifact path.
  --paper-shadow <path>                    Paper/shadow governance artifact path.
  --execution-engine <path>                Execution engine artifact path.
  --risk-engine <path>                     Risk engine artifact path.
  --signal-engine <path>                   Signal engine artifact path.
  --model-improvement <path>               Model-improvement layer artifact path.
  --research-backtest-paper <path>         Research/backtest/paper sample artifact path for source P400.
  --market-data-feature-store <path>       Market-data feature store artifact path.
  --model-degradation-halt-fixtures-schema <path>
                                           P399 model degradation halt fixtures schema path.
  --data-outage-halt-fixtures-schema <path>
                                           P400 data outage halt fixtures schema path.
  --promotion-receipt-contract-fixtures-schema <path>
                                           P401 promotion receipt contract fixtures schema path.
  --promotion-completion-gate-fixtures-schema <path>
                                           P402 promotion completion gate fixtures schema path.
  --promotion-governance-readonly-fixtures-schema <path>
                                           P403 promotion governance readonly fixtures schema path.
  --promotion-receipt-intake-queue-fixtures-schema <path>
                                           P404 promotion receipt intake queue fixtures schema path.
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.platformOpsLedgerPath),
    trading_sample_path: path.resolve(options.tradingSamplePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.tradingSamplePath),
    backtest_validation_path: path.resolve(options.backtestValidationPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.backtestValidationPath),
    model_degradation_halt_fixtures_schema_path: path.resolve(options.modelDegradationHaltFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.modelDegradationHaltFixturesSchemaPath),
    data_outage_halt_fixtures_schema_path: path.resolve(options.dataOutageHaltFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.dataOutageHaltFixturesSchemaPath),
    promotion_receipt_contract_fixtures_schema_path: path.resolve(options.promotionReceiptContractFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.promotionReceiptContractFixturesSchemaPath),
    promotion_completion_gate_fixtures_schema_path: path.resolve(options.promotionCompletionGateFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.promotionCompletionGateFixturesSchemaPath),
    promotion_governance_readonly_fixtures_schema_path: path.resolve(options.promotionGovernanceReadonlyFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.promotionGovernanceReadonlyFixturesSchemaPath),
    promotion_receipt_intake_queue_fixtures_schema_path: path.resolve(options.promotionReceiptIntakeQueueFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.promotionReceiptIntakeQueueFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.executionEnginePath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.riskEnginePath),
    signal_engine_path: path.resolve(options.signalEnginePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.signalEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.modelImprovementPath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.researchBacktestPaperPath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.marketDataFeatureStorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.schemaPath),
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

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function withOrdinalAndHash(row, index, hashField) {
  const withoutHash = {
    ...row,
    ordinal: index + 1,
  };
  return {
    ...withoutHash,
    [hashField]: hashValue(withoutHash),
  };
}

function validationItem(pathValue, rule, passed, message) {
  return {
    path: pathValue,
    rule,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({ path: item.path, message: item.message, rule: item.rule }));
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
  };
}

async function readJsonSource(filePath) {
  try {
    return {
      path: path.resolve(filePath),
      available: true,
      data: JSON.parse(await readFile(filePath, "utf8")),
    };
  } catch (error) {
    return {
      path: path.resolve(filePath),
      available: false,
      error: error.message,
      data: null,
    };
  }
}

async function readTextSource(filePath) {
  try {
    return {
      path: path.resolve(filePath),
      available: true,
      text: await readFile(filePath, "utf8"),
    };
  } catch (error) {
    return {
      path: path.resolve(filePath),
      available: false,
      error: error.message,
      text: "",
    };
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
