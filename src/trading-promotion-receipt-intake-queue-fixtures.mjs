import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS,
  buildTradingPromotionGovernanceReadonlyFixtures,
} from "./trading-promotion-governance-readonly-fixtures.mjs";

export const DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_OUT_DIR = "artifacts/trading-promotion-receipt-intake-queue-fixtures/latest";
export const DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS,
  promotionGovernanceReadonlyFixturesSchemaPath: DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-promotion-receipt-intake-queue-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-promotion-receipt-intake-queue-fixtures.v1";
const CAPABILITY_ID = "trading.promotion_receipt_intake_queue_fixtures";
const PHASE_SLOT = "P404";
const PREVIOUS_PHASE_SLOT = "P403";
const NEXT_PHASE_SLOT = "P405";
const READY_STATUS = "ready_for_trading_promotion_receipt_intake_queue_regression";
const SOURCE_READY_STATUS = "ready_for_trading_promotion_governance_readonly_regression";
const REQUIRED_QUEUE_KEYS = [
  "research_to_backtest_receipt_intake_queue",
  "backtest_to_paper_receipt_intake_queue",
  "paper_to_shadow_receipt_intake_queue",
  "shadow_to_limited_live_receipt_intake_queue",
  "limited_live_to_full_auto_receipt_intake_queue",
  "full_auto_activation_receipt_intake_queue",
];

export async function runTradingPromotionReceiptIntakeQueueFixtures(options = {}) {
  const result = await buildTradingPromotionReceiptIntakeQueueFixtures(options);
  if (options.write !== false) await writeTradingPromotionReceiptIntakeQueueFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading promotion receipt intake queue fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingPromotionReceiptIntakeQueueFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const promotionGovernanceReadonlyFixtures = await buildTradingPromotionGovernanceReadonlyFixtures({
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
    schemaPath: inputs.promotion_governance_readonly_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const receiptIntakeAnchor = buildReceiptIntakeAnchor({ promotionGovernanceReadonlyFixtures });
  const receiptIntakeRows = buildReceiptIntakeRows(promotionGovernanceReadonlyFixtures.promotion_governance_readonly_rows, promotionGovernanceReadonlyFixtures.summary);
  const receiptIntakeSummaryRows = buildReceiptIntakeSummaryRows(receiptIntakeRows);
  const receiptIntakeBoundary = buildReceiptIntakeBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    promotionGovernanceReadonlyFixtures,
    receiptIntakeRows,
    summaryRows: receiptIntakeSummaryRows,
  });
  const receiptIntakeGateRows = buildReceiptIntakeGateRows({
    promotionGovernanceReadonlyFixtures,
    packageJson,
    platformOpsLedger,
    receiptIntakeRows,
    boundary: receiptIntakeBoundary,
  });
  const validationItems = buildValidationItems({
    promotionGovernanceReadonlyFixtures,
    packageJson,
    platformOpsLedger,
    receiptIntakeRows,
    summaryRows: receiptIntakeSummaryRows,
    gateRows: receiptIntakeGateRows,
    boundary: receiptIntakeBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    promotionGovernanceReadonlyFixtures,
    receiptIntakeRows,
    summaryRows: receiptIntakeSummaryRows,
    gateRows: receiptIntakeGateRows,
    boundary: receiptIntakeBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_promotion_receipt_intake_queue_fixtures_id: `trading-promotion-receipt-intake-queue-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    promotion_receipt_intake_queue_anchor: receiptIntakeAnchor,
    promotion_receipt_intake_queue_rows: receiptIntakeRows,
    promotion_receipt_intake_queue_summary_rows: receiptIntakeSummaryRows,
    promotion_receipt_intake_queue_gate_rows: receiptIntakeGateRows,
    promotion_receipt_intake_queue_boundary: receiptIntakeBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_promotion_receipt_intake_queue_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    promotionGovernanceReadonlyFixtures,
    receiptIntakeRows,
    summaryRows: receiptIntakeSummaryRows,
    gateRows: receiptIntakeGateRows,
    boundary: receiptIntakeBoundary,
    validation: result.validation,
  });
  result.summary.trading_promotion_receipt_intake_queue_fixtures_id = result.trading_promotion_receipt_intake_queue_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingPromotionReceiptIntakeQueueFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-promotion-receipt-intake-queue-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "promotion-receipt-intake-queue-rows.json"), collectionEnvelope("trading-promotion-receipt-intake-queue-rows.v1", "promotion_receipt_intake_queue_rows", result.promotion_receipt_intake_queue_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-intake-queue-summary-rows.json"), collectionEnvelope("trading-promotion-receipt-intake-queue-summary-rows.v1", "promotion_receipt_intake_queue_summary_rows", result.promotion_receipt_intake_queue_summary_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-intake-queue-gate-rows.json"), collectionEnvelope("trading-promotion-receipt-intake-queue-gate-rows.v1", "promotion_receipt_intake_queue_gate_rows", result.promotion_receipt_intake_queue_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-intake-queue-boundary.json"), result.promotion_receipt_intake_queue_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-promotion-receipt-intake-queue-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingPromotionReceiptIntakeQueueFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingPromotionReceiptIntakeQueueFixtures(args);
    console.log(`Trading promotion receipt intake queue fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_promotion_receipt_intake_queue_fixtures_status}`);
    console.log(`Receipt queue rows: ${result.summary.ready_receipt_intake_queue_row_count}/${result.summary.receipt_intake_queue_row_count}`);
    console.log(`Receipt payload present count: ${result.summary.receipt_payload_present_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildReceiptIntakeAnchor({ promotionGovernanceReadonlyFixtures }) {
  return {
    schema_version: "trading-promotion-receipt-intake-queue-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_governance_readonly_fixtures_id: promotionGovernanceReadonlyFixtures.trading_promotion_governance_readonly_fixtures_id,
    source_promotion_governance_readonly_status: promotionGovernanceReadonlyFixtures.summary.trading_promotion_governance_readonly_fixtures_status,
    required_receipt_intake_queue_row_count: REQUIRED_QUEUE_KEYS.length,
    required_receipt_intake_queue_keys: REQUIRED_QUEUE_KEYS,
    source_hash: hashValue({
      id: promotionGovernanceReadonlyFixtures.trading_promotion_governance_readonly_fixtures_id,
      status: promotionGovernanceReadonlyFixtures.summary.trading_promotion_governance_readonly_fixtures_status,
      rows: REQUIRED_QUEUE_KEYS,
    }),
  };
}

function buildReceiptIntakeRows(governanceRows, sourceSummary) {
  return REQUIRED_QUEUE_KEYS.map((rowKey, index) => {
    const governanceRow = governanceRows.find((row) => rowKey === row.row_key.replace("_governance_readonly", "_receipt_intake_queue"));
    const sourceReceiptSignal = sourceSummary.source_receipt_present === true || sourceSummary.source_approval_applied === true || sourceSummary.approval_applied === true;
    const realEnablement = governanceRow?.real_enablement_detected === true || sourceSummary.real_enablement_count > 0 || sourceSummary.shadow_live_enabled || sourceSummary.limited_live_enabled || sourceSummary.full_auto_enabled || sourceSummary.live_execution_allowed;
    const row = {
      schema_version: "trading-promotion-receipt-intake-queue-row.v1",
      promotion_receipt_intake_queue_row_id: `trading-promotion-receipt-intake-queue.row.${rowKey}`,
      phase_slot: PHASE_SLOT,
      row_key: rowKey,
      source_governance_row_key: governanceRow?.row_key ?? "missing",
      from_stage: governanceRow?.from_stage ?? "missing",
      to_stage: governanceRow?.to_stage ?? "missing",
      receipt_contract_id: governanceRow?.receipt_contract_id ?? "missing",
      source_readonly_governance_status: governanceRow?.readonly_governance_status ?? "missing",
      source_governance_report_is_evidence_only: governanceRow?.governance_report_is_evidence_only === true,
      source_governance_complete_with_real_enablement_false: governanceRow?.governance_complete_with_real_enablement_false === true,
      receipt_required: true,
      receipt_intake_queue_status: governanceRow?.readonly_governance_status === "ready_readonly_governance" && !sourceReceiptSignal && !realEnablement ? "queued_pending_human_receipt" : "blocked",
      receipt_payload_present: sourceReceiptSignal,
      receipt_input_materialized: false,
      receipt_input_read_performed: false,
      receipt_validation_performed: false,
      receipt_application_performed: false,
      approval_applied: false,
      promotion_enablement_allowed: false,
      live_order_submission_allowed: false,
      live_execution_allowed: false,
      command_execution_performed_by_intake: false,
      artifact_write_performed_by_intake: false,
      protected_action_executed_by_intake: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "promotion_receipt_intake_queue_hash");
  });
}

function buildReceiptIntakeSummaryRows(receiptIntakeRows) {
  return receiptIntakeRows.map((queueRow, index) => {
    const row = {
      schema_version: "trading-promotion-receipt-intake-queue-summary-row.v1",
      promotion_receipt_intake_queue_summary_row_id: `trading-promotion-receipt-intake-queue.summary.${queueRow.row_key}`,
      phase_slot: PHASE_SLOT,
      row_key: queueRow.row_key,
      from_stage: queueRow.from_stage,
      to_stage: queueRow.to_stage,
      receipt_contract_id: queueRow.receipt_contract_id,
      source_readonly_governance_status: queueRow.source_readonly_governance_status,
      receipt_required: queueRow.receipt_required,
      receipt_payload_present: queueRow.receipt_payload_present,
      receipt_validation_performed: queueRow.receipt_validation_performed,
      receipt_application_performed: queueRow.receipt_application_performed,
      promotion_enablement_allowed: queueRow.promotion_enablement_allowed,
      live_execution_allowed: queueRow.live_execution_allowed,
      summary_status: queueRow.receipt_intake_queue_status === "queued_pending_human_receipt" ? "pending_human_receipt_intake" : "blocked",
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "promotion_receipt_intake_queue_summary_hash");
  });
}

function buildReceiptIntakeBoundary({ generatedAt, writeRequested, promotionGovernanceReadonlyFixtures, receiptIntakeRows, summaryRows }) {
  const sourceSummary = promotionGovernanceReadonlyFixtures.summary;
  const receiptPayloadRows = receiptIntakeRows.filter((row) => row.receipt_payload_present);
  return {
    schema_version: "trading-promotion-receipt-intake-queue-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    promotion_receipt_intake_queue_artifact_write_requested: writeRequested,
    promotion_receipt_intake_execution_performed: false,
    required_receipt_intake_queue_row_count: REQUIRED_QUEUE_KEYS.length,
    receipt_intake_queue_row_count: receiptIntakeRows.length,
    summary_row_count: summaryRows.length,
    ready_receipt_intake_queue_row_count: receiptIntakeRows.filter((row) => row.receipt_intake_queue_status === "queued_pending_human_receipt").length,
    source_promotion_governance_readonly_status: sourceSummary.trading_promotion_governance_readonly_fixtures_status,
    source_promotion_governance_readonly_ready: promotionGovernanceReadonlyFixtures.validation.valid && sourceSummary.trading_promotion_governance_readonly_fixtures_status === SOURCE_READY_STATUS,
    receipt_intake_queue_rows_covered: receiptIntakeRows.length === REQUIRED_QUEUE_KEYS.length && REQUIRED_QUEUE_KEYS.every((rowKey) => receiptIntakeRows.some((row) => row.row_key === rowKey)),
    receipt_intake_queue_pending: receiptIntakeRows.every((row) => row.receipt_intake_queue_status === "queued_pending_human_receipt" && row.receipt_required),
    governance_reports_readonly: sourceSummary.governance_reports_readonly,
    governance_reports_complete_with_real_enablement_false: sourceSummary.governance_reports_complete_with_real_enablement_false,
    completion_gates_block_without_receipts: sourceSummary.completion_gates_block_without_receipts,
    real_enablement_count: sourceSummary.real_enablement_count,
    receipt_payload_present_count: receiptPayloadRows.length,
    receipt_payload_present_refs: receiptPayloadRows.map((row) => row.row_key),
    source_receipt_present: sourceSummary.source_receipt_present,
    source_approval_applied: sourceSummary.source_approval_applied,
    receipt_materialized: false,
    receipt_input_read_performed: false,
    receipt_validation_performed: false,
    receipt_application_performed: false,
    approval_applied: false,
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
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    human_review_required: true,
  };
}

function buildReceiptIntakeGateRows({ promotionGovernanceReadonlyFixtures, packageJson, platformOpsLedger, receiptIntakeRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p403_promotion_governance_readonly_fixtures_ready", "P403 promotion governance readonly source is ready.", promotionGovernanceReadonlyFixtures.validation.valid && promotionGovernanceReadonlyFixtures.summary.trading_promotion_governance_readonly_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P404 trading promotion receipt intake queue fixtures command.", typeof scripts["trading:promotion-receipt-intake-queue-fixtures"] === "string" && scripts["trading:promotion-receipt-intake-queue-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P404 trading promotion receipt intake queue fixtures command.", validateScript.includes("npm run trading:promotion-receipt-intake-queue-fixtures -- --check")),
    gateRow("p404_ledger_acceptance_declared", "P404 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P404: `trading:promotion-receipt-intake-queue-fixtures`")),
    gateRow("required_receipt_intake_queue_rows_declared", "Every P403 governance row has a P404 receipt intake queue row.", boundary.receipt_intake_queue_rows_covered),
    gateRow("receipt_intake_queue_pending", "All promotion receipt intake rows remain pending human receipt input.", boundary.receipt_intake_queue_pending && boundary.receipt_payload_present_count === 0),
    gateRow("governance_source_remains_readonly", "Receipt intake queue consumes read-only governance evidence without changing it.", boundary.governance_reports_readonly && boundary.governance_reports_complete_with_real_enablement_false),
    gateRow("no_receipt_validation_or_application", "P404 does not read, validate, apply, or materialize promotion receipt payloads.", !boundary.receipt_materialized && !boundary.receipt_input_read_performed && !boundary.receipt_validation_performed && !boundary.receipt_application_performed && !boundary.approval_applied),
    gateRow("live_and_full_auto_enablement_blocked", "P404 receipt intake queue does not enable shadow, limited-live, full-auto, live execution, order submission, broker writes, or exchange writes.", !boundary.shadow_live_enabled && !boundary.limited_live_enabled && !boundary.full_auto_enabled && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.live_execution_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed),
    gateRow("no_artifact_or_protected_mutation", "P404 fixtures do not execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "promotion_receipt_intake_queue_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-promotion-receipt-intake-queue-gate-row.v1",
    promotion_receipt_intake_queue_gate_row_id: `trading-promotion-receipt-intake-queue-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_materialized_by_gate: false,
    receipt_validation_performed_by_gate: false,
    receipt_application_performed_by_gate: false,
    promotion_enablement_allowed_by_gate: false,
    live_order_submission_allowed_by_gate: false,
    live_execution_allowed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ promotionGovernanceReadonlyFixtures, packageJson, platformOpsLedger, receiptIntakeRows, summaryRows, gateRows, boundary }) {
  return [
    validationItem("source.promotion_governance_readonly_fixtures", "p403_promotion_governance_readonly_fixtures_ready", promotionGovernanceReadonlyFixtures.validation.valid && promotionGovernanceReadonlyFixtures.summary.trading_promotion_governance_readonly_fixtures_status === SOURCE_READY_STATUS, "P403 promotion governance readonly fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P404 promotion receipt intake queue fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("promotion_receipt_intake_queue_rows", "receipt_intake_queue_rows_ready", receiptIntakeRows.length === REQUIRED_QUEUE_KEYS.length && receiptIntakeRows.every((row) => row.receipt_intake_queue_status === "queued_pending_human_receipt"), "All P404 receipt intake queue rows must be pending human receipt input."),
    validationItem("promotion_receipt_intake_queue_summary_rows", "receipt_intake_queue_summary_rows_ready", summaryRows.length === REQUIRED_QUEUE_KEYS.length && summaryRows.every((row) => row.summary_status === "pending_human_receipt_intake"), "All P404 receipt intake queue summary rows must show pending human receipt intake."),
    validationItem("promotion_receipt_intake_queue_gate_rows", "receipt_intake_queue_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P404 promotion receipt intake queue gates are ready."),
    validationItem("boundary.source_ready", "source_promotion_governance_readonly_ready", boundary.source_promotion_governance_readonly_ready, "Source P403 promotion governance readonly fixtures must be ready."),
    validationItem("boundary.receipt_intake_queue", "receipt_intake_queue_pending_without_payloads", boundary.receipt_intake_queue_rows_covered && boundary.receipt_intake_queue_pending && boundary.receipt_payload_present_count === 0, "P404 receipt intake queue must declare pending rows without receipt payloads."),
    validationItem("boundary.no_receipt_application", "no_receipt_validation_or_application", !boundary.source_receipt_present && !boundary.source_approval_applied && !boundary.receipt_materialized && !boundary.receipt_input_read_performed && !boundary.receipt_validation_performed && !boundary.receipt_application_performed && !boundary.approval_applied, "P404 must not consume, validate, or apply promotion receipts."),
    validationItem("boundary.no_live_mutation", "no_trading_or_artifact_mutation", !boundary.shadow_live_enabled && !boundary.limited_live_enabled && !boundary.full_auto_enabled && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.live_execution_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed, "P404 receipt intake queue fixtures perform no trading, receipt, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ promotionGovernanceReadonlyFixtures, receiptIntakeRows, summaryRows, gateRows, boundary, validation }) {
  return {
    trading_promotion_receipt_intake_queue_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_governance_readonly_status: promotionGovernanceReadonlyFixtures.summary.trading_promotion_governance_readonly_fixtures_status,
    source_promotion_governance_readonly_ready: boundary.source_promotion_governance_readonly_ready,
    required_receipt_intake_queue_row_count: REQUIRED_QUEUE_KEYS.length,
    receipt_intake_queue_row_count: receiptIntakeRows.length,
    ready_receipt_intake_queue_row_count: boundary.ready_receipt_intake_queue_row_count,
    summary_row_count: summaryRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    receipt_intake_queue_rows_covered: boundary.receipt_intake_queue_rows_covered,
    receipt_intake_queue_pending: boundary.receipt_intake_queue_pending,
    governance_reports_readonly: boundary.governance_reports_readonly,
    governance_reports_complete_with_real_enablement_false: boundary.governance_reports_complete_with_real_enablement_false,
    completion_gates_block_without_receipts: boundary.completion_gates_block_without_receipts,
    real_enablement_count: boundary.real_enablement_count,
    receipt_payload_present_count: boundary.receipt_payload_present_count,
    source_receipt_present: boundary.source_receipt_present,
    source_approval_applied: boundary.source_approval_applied,
    receipt_materialized: boundary.receipt_materialized,
    receipt_input_read_performed: boundary.receipt_input_read_performed,
    receipt_validation_performed: boundary.receipt_validation_performed,
    receipt_application_performed: boundary.receipt_application_performed,
    approval_applied: boundary.approval_applied,
    shadow_live_enabled: boundary.shadow_live_enabled,
    limited_live_enabled: boundary.limited_live_enabled,
    full_auto_enabled: boundary.full_auto_enabled,
    automatic_order_submission_allowed: boundary.automatic_order_submission_allowed,
    live_order_submission_allowed: boundary.live_order_submission_allowed,
    live_promotion_allowed: boundary.live_promotion_allowed,
    live_execution_allowed: boundary.live_execution_allowed,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
    release_check_execution_performed: boundary.release_check_execution_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    release_published: boundary.release_published,
    git_operation_performed: boundary.git_operation_performed,
    protected_action_executed: boundary.protected_action_executed,
    human_review_required: boundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Promotion Receipt Intake Queue Fixtures",
    "",
    `Status: ${result.summary.trading_promotion_receipt_intake_queue_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source governance: ${result.summary.source_promotion_governance_readonly_status}`,
    `Receipt queue rows: ${result.summary.ready_receipt_intake_queue_row_count}/${result.summary.receipt_intake_queue_row_count}`,
    `Receipt payload present count: ${result.summary.receipt_payload_present_count}`,
    "",
    "## Receipt Intake Queue Rows",
    "",
    ...result.promotion_receipt_intake_queue_rows.map((row) => `- ${row.row_key}: ${row.receipt_intake_queue_status}`),
    "",
    "## Gates",
    "",
    ...result.promotion_receipt_intake_queue_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-promotion-receipt-intake-queue-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_OUT_DIR}
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
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.platformOpsLedgerPath),
    trading_sample_path: path.resolve(options.tradingSamplePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.tradingSamplePath),
    backtest_validation_path: path.resolve(options.backtestValidationPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.backtestValidationPath),
    model_degradation_halt_fixtures_schema_path: path.resolve(options.modelDegradationHaltFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.modelDegradationHaltFixturesSchemaPath),
    data_outage_halt_fixtures_schema_path: path.resolve(options.dataOutageHaltFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.dataOutageHaltFixturesSchemaPath),
    promotion_receipt_contract_fixtures_schema_path: path.resolve(options.promotionReceiptContractFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.promotionReceiptContractFixturesSchemaPath),
    promotion_completion_gate_fixtures_schema_path: path.resolve(options.promotionCompletionGateFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.promotionCompletionGateFixturesSchemaPath),
    promotion_governance_readonly_fixtures_schema_path: path.resolve(options.promotionGovernanceReadonlyFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.promotionGovernanceReadonlyFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.executionEnginePath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.riskEnginePath),
    signal_engine_path: path.resolve(options.signalEnginePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.signalEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.modelImprovementPath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.researchBacktestPaperPath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.marketDataFeatureStorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_INTAKE_QUEUE_FIXTURES_INPUTS.schemaPath),
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
