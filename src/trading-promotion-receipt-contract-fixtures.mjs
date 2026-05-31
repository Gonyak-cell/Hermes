import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_INPUTS,
  buildTradingDataOutageHaltFixtures,
} from "./trading-data-outage-halt-fixtures.mjs";

export const DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_OUT_DIR = "artifacts/trading-promotion-receipt-contract-fixtures/latest";
export const DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_INPUTS,
  dataOutageHaltFixturesSchemaPath: DEFAULT_TRADING_DATA_OUTAGE_HALT_FIXTURES_INPUTS.schemaPath,
  tradingSamplePath: "examples/trading/research-backtest-paper-sample.json",
  backtestValidationPath: "examples/trading/backtest-validation.json",
  schemaPath: "schemas/trading/trading-promotion-receipt-contract-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-promotion-receipt-contract-fixtures.v1";
const CAPABILITY_ID = "trading.promotion_receipt_contract_fixtures";
const PHASE_SLOT = "P401";
const PREVIOUS_PHASE_SLOT = "P400";
const NEXT_PHASE_SLOT = "P402";
const READY_STATUS = "ready_for_trading_promotion_receipt_contract_regression";
const SOURCE_READY_STATUS = "ready_for_trading_data_outage_halt_regression";
const REQUIRED_CONTRACT_KEYS = [
  "research_to_backtest_receipt_contract",
  "backtest_to_paper_receipt_contract",
  "paper_to_shadow_receipt_contract",
  "shadow_to_limited_live_receipt_contract",
  "limited_live_to_full_auto_receipt_contract",
  "full_auto_activation_receipt_contract",
];
const RECEIPT_CONTRACT_VERSION = "human_approval_receipt.v1";

export async function runTradingPromotionReceiptContractFixtures(options = {}) {
  const result = await buildTradingPromotionReceiptContractFixtures(options);
  if (options.write !== false) await writeTradingPromotionReceiptContractFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading promotion receipt contract fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingPromotionReceiptContractFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const dataOutageHaltFixtures = await buildTradingDataOutageHaltFixtures({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
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
    schemaPath: inputs.data_outage_halt_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const tradingSample = await readJsonSource(inputs.trading_sample_path);
  const modelImprovement = await readJsonSource(inputs.model_improvement_path);
  const backtestValidation = await readJsonSource(inputs.backtest_validation_path);
  const paperShadow = await readJsonSource(inputs.paper_shadow_path);
  const limitedLive = await readJsonSource(inputs.limited_live_path);
  const fullAuto = await readJsonSource(inputs.full_auto_path);
  const promotionReceiptAnchor = buildPromotionReceiptAnchor({ dataOutageHaltFixtures });
  const promotionReceiptContractRows = buildPromotionReceiptContractRows({
    tradingSample: tradingSample.data,
    modelImprovement: modelImprovement.data,
    backtestValidation: backtestValidation.data,
    paperShadow: paperShadow.data,
    limitedLive: limitedLive.data,
    fullAuto: fullAuto.data,
  });
  const promotionReceiptSummaryRows = buildPromotionReceiptSummaryRows(promotionReceiptContractRows);
  const promotionReceiptBoundary = buildPromotionReceiptBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    dataOutageHaltFixtures,
    contractRows: promotionReceiptContractRows,
    summaryRows: promotionReceiptSummaryRows,
  });
  const promotionReceiptGateRows = buildPromotionReceiptGateRows({
    dataOutageHaltFixtures,
    packageJson,
    platformOpsLedger,
    tradingSample,
    modelImprovement,
    backtestValidation,
    paperShadow,
    limitedLive,
    fullAuto,
    contractRows: promotionReceiptContractRows,
    boundary: promotionReceiptBoundary,
  });
  const validationItems = buildValidationItems({
    dataOutageHaltFixtures,
    packageJson,
    platformOpsLedger,
    tradingSample,
    modelImprovement,
    backtestValidation,
    paperShadow,
    limitedLive,
    fullAuto,
    contractRows: promotionReceiptContractRows,
    summaryRows: promotionReceiptSummaryRows,
    gateRows: promotionReceiptGateRows,
    boundary: promotionReceiptBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    dataOutageHaltFixtures,
    contractRows: promotionReceiptContractRows,
    summaryRows: promotionReceiptSummaryRows,
    gateRows: promotionReceiptGateRows,
    boundary: promotionReceiptBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_promotion_receipt_contract_fixtures_id: `trading-promotion-receipt-contract-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    promotion_receipt_contract_anchor: promotionReceiptAnchor,
    promotion_receipt_contract_rows: promotionReceiptContractRows,
    promotion_receipt_summary_rows: promotionReceiptSummaryRows,
    promotion_receipt_gate_rows: promotionReceiptGateRows,
    promotion_receipt_boundary: promotionReceiptBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_promotion_receipt_contract_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    dataOutageHaltFixtures,
    contractRows: promotionReceiptContractRows,
    summaryRows: promotionReceiptSummaryRows,
    gateRows: promotionReceiptGateRows,
    boundary: promotionReceiptBoundary,
    validation: result.validation,
  });
  result.summary.trading_promotion_receipt_contract_fixtures_id = result.trading_promotion_receipt_contract_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingPromotionReceiptContractFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-promotion-receipt-contract-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "promotion-receipt-contract-rows.json"), collectionEnvelope("trading-promotion-receipt-contract-rows.v1", "promotion_receipt_contract_rows", result.promotion_receipt_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-summary-rows.json"), collectionEnvelope("trading-promotion-receipt-summary-rows.v1", "promotion_receipt_summary_rows", result.promotion_receipt_summary_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-gate-rows.json"), collectionEnvelope("trading-promotion-receipt-gate-rows.v1", "promotion_receipt_gate_rows", result.promotion_receipt_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-boundary.json"), result.promotion_receipt_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-promotion-receipt-contract-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingPromotionReceiptContractFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingPromotionReceiptContractFixtures(args);
    console.log(`Trading promotion receipt contract fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_promotion_receipt_contract_fixtures_status}`);
    console.log(`Receipt contracts: ${result.summary.ready_contract_count}/${result.summary.contract_count}`);
    console.log(`Unsafe promotion receipt signals: ${result.summary.unsafe_promotion_receipt_signal_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPromotionReceiptAnchor({ dataOutageHaltFixtures }) {
  return {
    schema_version: "trading-promotion-receipt-contract-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_data_outage_halt_fixtures_id: dataOutageHaltFixtures.trading_data_outage_halt_fixtures_id,
    source_data_outage_halt_status: dataOutageHaltFixtures.summary.trading_data_outage_halt_fixtures_status,
    required_contract_count: REQUIRED_CONTRACT_KEYS.length,
    required_contract_keys: REQUIRED_CONTRACT_KEYS,
    source_hash: hashValue({
      id: dataOutageHaltFixtures.trading_data_outage_halt_fixtures_id,
      status: dataOutageHaltFixtures.summary.trading_data_outage_halt_fixtures_status,
      contracts: REQUIRED_CONTRACT_KEYS,
    }),
  };
}

function buildPromotionReceiptContractRows({ tradingSample, modelImprovement, backtestValidation, paperShadow, limitedLive, fullAuto }) {
  const modelCandidate = Array.isArray(modelImprovement?.promotion_candidates) ? modelImprovement.promotion_candidates[0] : null;
  const samplePromotion = valueAt(tradingSample, ["contract_examples", "trading-promotion"]);
  const samplePaperTrade = valueAt(tradingSample, ["contract_examples", "trading-paper-trade"]);
  const sampleBacktest = valueAt(tradingSample, ["contract_examples", "trading-backtest"]);
  const rows = [
    promotionReceiptContractRow("research_to_backtest_receipt_contract", {
      fromStage: "research",
      toStage: "backtest",
      sourceArtifactId: "trading_sample_pack",
      sourceEvidencePath: "stage_policy.research_to_backtest",
      governanceReportStatus: "active",
      expectedReviewerRole: "research_reviewer",
      conditions: [
        observedCondition("sample.stage_policy.research", valueAt(tradingSample, ["stage_policy", "research"]), "active"),
        observedCondition("sample.stage_policy.backtest", valueAt(tradingSample, ["stage_policy", "backtest"]), "active"),
        observedCondition("sample.safety_policy.human_approval_required_for_promotion", valueAt(tradingSample, ["safety_policy", "human_approval_required_for_promotion"]), true),
        observedCondition("sample.contract_examples.trading-backtest.promotion_candidate", valueAt(sampleBacktest, ["promotion_candidate"]), false),
        observedCondition("sample.safety_policy.live_trading_enabled", valueAt(tradingSample, ["safety_policy", "live_trading_enabled"]), false),
      ],
    }),
    promotionReceiptContractRow("backtest_to_paper_receipt_contract", {
      fromStage: "backtest",
      toStage: "paper",
      sourceArtifactId: "model_improvement_and_backtest_validation",
      sourceEvidencePath: "promotion_candidates[0].promotion_artifact",
      governanceReportStatus: valueAt(modelImprovement, ["model_improvement_status"]),
      expectedReviewerRole: "model_and_backtest_reviewer",
      conditions: [
        observedCondition("model_improvement.promotion_candidates[0].promotion_artifact.from_stage", valueAt(modelCandidate, ["promotion_artifact", "from_stage"]), "backtest"),
        observedCondition("model_improvement.promotion_candidates[0].promotion_artifact.to_stage", valueAt(modelCandidate, ["promotion_artifact", "to_stage"]), "paper"),
        observedCondition("model_improvement.promotion_candidates[0].promotion_artifact.decision", valueAt(modelCandidate, ["promotion_artifact", "decision"]), "pending_human_review"),
        observedCondition("model_improvement.promotion_candidates[0].promotion_artifact.human_approval_required", valueAt(modelCandidate, ["promotion_artifact", "human_approval_required"]), true),
        observedCondition("model_improvement.promotion_candidates[0].promotion_artifact.live_promotion_allowed", valueAt(modelCandidate, ["promotion_artifact", "live_promotion_allowed"]), false),
        observedCondition("backtest_validation.promotion_boundary.promotion_candidate_generated", valueAt(backtestValidation, ["promotion_boundary", "promotion_candidate_generated"]), false),
        observedCondition("backtest_validation.promotion_boundary.live_promotion_allowed", valueAt(backtestValidation, ["promotion_boundary", "live_promotion_allowed"]), false),
        observedCondition("sample.contract_examples.trading-paper-trade.promotion_status", valueAt(samplePaperTrade, ["promotion_status"]), "not_eligible"),
      ],
    }),
    promotionReceiptContractRow("paper_to_shadow_receipt_contract", {
      fromStage: "paper",
      toStage: "shadow_live",
      sourceArtifactId: "paper_shadow_live",
      sourceEvidencePath: "promotion_criteria_to_shadow",
      governanceReportStatus: valueAt(paperShadow, ["paper_shadow_status"]),
      expectedReviewerRole: "paper_shadow_reviewer",
      conditions: [
        observedCondition("paper_shadow.promotion_criteria_to_shadow.decision", valueAt(paperShadow, ["promotion_criteria_to_shadow", "decision"]), "pending_human_review"),
        observedCondition("paper_shadow.promotion_criteria_to_shadow.human_approval_required", valueAt(paperShadow, ["promotion_criteria_to_shadow", "human_approval_required"]), true),
        observedCondition("paper_shadow.promotion_criteria_to_shadow.shadow_live_enabled", valueAt(paperShadow, ["promotion_criteria_to_shadow", "shadow_live_enabled"]), false),
        observedCondition("paper_shadow.dashboard_api_stub.disabled_routes.shadow_enable_live", hasDisabledRoute(valueAt(paperShadow, ["dashboard_api_stub", "disabled_routes"]), "/api/trading/shadow/enable-live"), true),
        observedCondition("paper_shadow.safety_boundary.live_execution_allowed", valueAt(paperShadow, ["safety_boundary", "live_execution_allowed"]), false),
      ],
    }),
    promotionReceiptContractRow("shadow_to_limited_live_receipt_contract", {
      fromStage: "shadow_live",
      toStage: "limited_live",
      sourceArtifactId: "paper_shadow_live",
      sourceEvidencePath: "promotion_criteria_to_limited_live",
      governanceReportStatus: valueAt(paperShadow, ["paper_shadow_status"]),
      expectedReviewerRole: "limited_live_reviewer",
      conditions: [
        observedCondition("paper_shadow.promotion_criteria_to_limited_live.decision", valueAt(paperShadow, ["promotion_criteria_to_limited_live", "decision"]), "blocked"),
        observedCondition("paper_shadow.promotion_criteria_to_limited_live.human_approval_required", valueAt(paperShadow, ["promotion_criteria_to_limited_live", "human_approval_required"]), true),
        observedCondition("paper_shadow.promotion_criteria_to_limited_live.limited_live_enabled", valueAt(paperShadow, ["promotion_criteria_to_limited_live", "limited_live_enabled"]), false),
        observedCondition("limited_live.safety_boundary.explicit_human_approval_required", valueAt(limitedLive, ["safety_boundary", "explicit_human_approval_required"]), true),
        observedCondition("limited_live.safety_boundary.approval_receipt_present", valueAt(limitedLive, ["safety_boundary", "approval_receipt_present"]), false),
        observedCondition("limited_live.safety_boundary.limited_live_enabled", valueAt(limitedLive, ["safety_boundary", "limited_live_enabled"]), false),
      ],
    }),
    promotionReceiptContractRow("limited_live_to_full_auto_receipt_contract", {
      fromStage: "limited_live",
      toStage: "full_auto",
      sourceArtifactId: "limited_live_governance",
      sourceEvidencePath: "promotion_criteria_to_full_auto",
      governanceReportStatus: valueAt(limitedLive, ["limited_live_status"]),
      expectedReviewerRole: "full_auto_reviewer",
      conditions: [
        observedCondition("limited_live.promotion_criteria_to_full_auto.decision", valueAt(limitedLive, ["promotion_criteria_to_full_auto", "decision"]), "blocked"),
        observedCondition("limited_live.promotion_criteria_to_full_auto.human_approval_required", valueAt(limitedLive, ["promotion_criteria_to_full_auto", "human_approval_required"]), true),
        observedCondition("limited_live.promotion_criteria_to_full_auto.full_auto_enabled", valueAt(limitedLive, ["promotion_criteria_to_full_auto", "full_auto_enabled"]), false),
        observedCondition("limited_live.safety_boundary.approval_receipt_present", valueAt(limitedLive, ["safety_boundary", "approval_receipt_present"]), false),
        observedCondition("limited_live.safety_boundary.full_auto_promotion_allowed", valueAt(limitedLive, ["safety_boundary", "full_auto_promotion_allowed"]), false),
        observedCondition("full_auto.safety_boundary.full_auto_enabled", valueAt(fullAuto, ["safety_boundary", "full_auto_enabled"]), false),
      ],
    }),
    promotionReceiptContractRow("full_auto_activation_receipt_contract", {
      fromStage: "full_auto",
      toStage: "full_auto_activation",
      sourceArtifactId: "full_auto_governance",
      sourceEvidencePath: "full_auto_approval_checklist",
      governanceReportStatus: valueAt(fullAuto, ["full_auto_status"]),
      expectedReviewerRole: "full_auto_activation_reviewer",
      conditions: [
        observedCondition("full_auto.full_auto_approval_checklist.approval_required", valueAt(fullAuto, ["full_auto_approval_checklist", "approval_required"]), true),
        observedCondition("full_auto.full_auto_approval_checklist.approval_receipt_present", valueAt(fullAuto, ["full_auto_approval_checklist", "approval_receipt_present"]), false),
        observedCondition("full_auto.full_auto_approval_checklist.decision", valueAt(fullAuto, ["full_auto_approval_checklist", "decision"]), "blocked"),
        observedCondition("full_auto.safety_boundary.full_auto_enabled", valueAt(fullAuto, ["safety_boundary", "full_auto_enabled"]), false),
        observedCondition("full_auto.safety_boundary.automatic_order_submission_allowed", valueAt(fullAuto, ["safety_boundary", "automatic_order_submission_allowed"]), false),
        observedCondition("full_auto.safety_boundary.live_order_submission_allowed", valueAt(fullAuto, ["safety_boundary", "live_order_submission_allowed"]), false),
        observedCondition("full_auto.safety_boundary.live_execution_allowed", valueAt(fullAuto, ["safety_boundary", "live_execution_allowed"]) ?? false, false),
        observedCondition("full_auto.safety_boundary.broker_write_allowed", valueAt(fullAuto, ["safety_boundary", "broker_write_allowed"]), false),
        observedCondition("full_auto.safety_boundary.exchange_write_allowed", valueAt(fullAuto, ["safety_boundary", "exchange_write_allowed"]), false),
      ],
    }),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "promotion_receipt_contract_hash"));
}

function promotionReceiptContractRow(rowKey, { fromStage, toStage, sourceArtifactId, sourceEvidencePath, governanceReportStatus, expectedReviewerRole, conditions }) {
  const allConditionsPresent = conditions.every((condition) => condition.condition_present);
  const unsafeConditions = conditions.filter((condition) => condition.observed_value !== condition.expected_safe_value);
  const sourceReceiptPresent = conditions.some((condition) => condition.condition_path.includes("approval_receipt_present") && condition.observed_value === true);
  const sourceApprovalApplied = conditions.some((condition) => condition.condition_path.endsWith(".decision") && condition.observed_value === "approved");
  const higherStageEnablementClaimed = unsafeConditions.some((condition) => enablementConditionPath(condition.condition_path));
  const contractStatus = allConditionsPresent && unsafeConditions.length === 0 ? "ready_for_human_receipt" : "blocked";
  return {
    schema_version: "trading-promotion-receipt-contract-row.v1",
    promotion_receipt_contract_row_id: `trading-promotion-receipt-contract.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    from_stage: fromStage,
    to_stage: toStage,
    receipt_contract_id: `trading_promotion_receipt.${fromStage}_to_${toStage}.v1`,
    receipt_contract_version: RECEIPT_CONTRACT_VERSION,
    receipt_contract_independent: true,
    independent_from_other_stages: true,
    required_receipt_fields: ["receipt_id", "reviewer_role", "source_artifact_ref", "decision", "reviewed_at", "risk_acknowledgement", "protected_action_acknowledgement"],
    expected_reviewer_role: expectedReviewerRole,
    source_artifact_id: sourceArtifactId,
    source_evidence_path: sourceEvidencePath,
    source_governance_report_status: governanceReportStatus,
    observed_conditions: conditions,
    observed_condition_count: conditions.length,
    all_conditions_present: allConditionsPresent,
    unsafe_promotion_receipt_signal_detected: unsafeConditions.length > 0,
    unsafe_condition_refs: unsafeConditions.map((condition) => condition.condition_path),
    receipt_required: true,
    approval_receipt_present: false,
    source_receipt_present: sourceReceiptPresent,
    approval_applied: false,
    source_approval_applied: sourceApprovalApplied,
    promotion_enablement_allowed: false,
    higher_stage_enablement_claimed: higherStageEnablementClaimed,
    higher_stage_completion_claim_without_receipt: higherStageEnablementClaimed && !sourceReceiptPresent,
    governance_report_may_be_complete: governanceReportStatus === "complete" || governanceReportStatus === "active",
    governance_complete_with_real_enablement_false: !higherStageEnablementClaimed,
    receipt_status: "missing_pending_human_input",
    contract_status: contractStatus,
    command_execution_performed_by_contract: false,
    artifact_write_performed_by_contract: false,
    protected_action_executed_by_contract: false,
    human_review_required: true,
  };
}

function observedCondition(conditionPath, observedValue, expectedSafeValue) {
  return {
    condition_path: conditionPath,
    expected_safe_value: expectedSafeValue,
    observed_value: observedValue,
    condition_present: typeof observedValue === "boolean" || typeof observedValue === "string" || typeof observedValue === "number",
    unsafe_when_not_safe: true,
  };
}

function buildPromotionReceiptSummaryRows(contractRows) {
  return contractRows.map((contractRow, index) => {
    const row = {
      schema_version: "trading-promotion-receipt-summary-row.v1",
      promotion_receipt_summary_row_id: `trading-promotion-receipt-contract.summary.${contractRow.row_key}`,
      phase_slot: PHASE_SLOT,
      row_key: contractRow.row_key,
      from_stage: contractRow.from_stage,
      to_stage: contractRow.to_stage,
      receipt_contract_id: contractRow.receipt_contract_id,
      source_artifact_id: contractRow.source_artifact_id,
      source_governance_report_status: contractRow.source_governance_report_status,
      receipt_required: contractRow.receipt_required,
      approval_receipt_present: contractRow.approval_receipt_present,
      source_receipt_present: contractRow.source_receipt_present,
      approval_applied: contractRow.approval_applied,
      source_approval_applied: contractRow.source_approval_applied,
      promotion_enablement_allowed: contractRow.promotion_enablement_allowed,
      higher_stage_enablement_claimed: contractRow.higher_stage_enablement_claimed,
      higher_stage_completion_claim_without_receipt: contractRow.higher_stage_completion_claim_without_receipt,
      governance_report_may_be_complete: contractRow.governance_report_may_be_complete,
      governance_complete_with_real_enablement_false: contractRow.governance_complete_with_real_enablement_false,
      summary_status: contractRow.contract_status === "ready_for_human_receipt" ? "receipt_contract_ready" : "blocked",
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "promotion_receipt_summary_hash");
  });
}

function buildPromotionReceiptBoundary({ generatedAt, writeRequested, dataOutageHaltFixtures, contractRows, summaryRows }) {
  const unsafeRows = contractRows.filter((row) => row.unsafe_promotion_receipt_signal_detected);
  const receiptContractIds = contractRows.map((row) => row.receipt_contract_id);
  const duplicateReceiptContractIds = receiptContractIds.filter((contractId, index) => receiptContractIds.indexOf(contractId) !== index);
  const sourceBoundary = dataOutageHaltFixtures.summary;
  return {
    schema_version: "trading-promotion-receipt-contract-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    promotion_receipt_contract_artifact_write_requested: writeRequested,
    promotion_receipt_contract_execution_performed: false,
    required_contract_count: REQUIRED_CONTRACT_KEYS.length,
    contract_count: contractRows.length,
    summary_row_count: summaryRows.length,
    ready_contract_count: contractRows.filter((row) => row.contract_status === "ready_for_human_receipt").length,
    independent_receipt_contract_count: contractRows.filter((row) => row.receipt_contract_independent).length,
    duplicate_receipt_contract_ids: [...new Set(duplicateReceiptContractIds)],
    unsafe_promotion_receipt_signal_count: unsafeRows.length,
    unsafe_promotion_receipt_signal_refs: unsafeRows.map((row) => row.row_key),
    promotion_receipt_contracts_covered: contractRows.length === REQUIRED_CONTRACT_KEYS.length && REQUIRED_CONTRACT_KEYS.every((rowKey) => contractRows.some((row) => row.row_key === rowKey)),
    source_data_outage_halt_status: sourceBoundary.trading_data_outage_halt_fixtures_status,
    source_data_outage_halt_ready: dataOutageHaltFixtures.validation.valid && sourceBoundary.trading_data_outage_halt_fixtures_status === SOURCE_READY_STATUS,
    independent_receipt_contracts_declared: contractRows.length === REQUIRED_CONTRACT_KEYS.length && contractRows.every((row) => row.receipt_contract_independent && row.independent_from_other_stages) && duplicateReceiptContractIds.length === 0,
    receipt_materialized: false,
    receipt_input_read_performed: false,
    receipt_validation_performed: false,
    receipt_application_performed: false,
    source_receipt_present: contractRows.some((row) => row.source_receipt_present),
    source_approval_applied: contractRows.some((row) => row.source_approval_applied),
    approval_applied: contractRows.some((row) => row.approval_applied),
    higher_stage_enablement_claimed: contractRows.some((row) => row.higher_stage_enablement_claimed),
    higher_stage_completion_claim_without_receipt: contractRows.some((row) => row.higher_stage_completion_claim_without_receipt),
    governance_reports_complete_with_real_enablement_false: contractRows.every((row) => row.governance_report_may_be_complete && row.governance_complete_with_real_enablement_false),
    receipt_contracts_ready_for_human_input: contractRows.every((row) => row.contract_status === "ready_for_human_receipt" && row.receipt_required && !row.approval_receipt_present && !row.approval_applied),
    human_approval_missing_from_source: contractRows.some((row) => row.observed_conditions.some((condition) => condition.condition_path.includes("human_approval_required") && condition.observed_value !== true)),
    promotion_candidate_generated: observedUnsafeCondition(contractRows, "promotion_candidate_generated"),
    shadow_live_enabled: observedUnsafeCondition(contractRows, "shadow_live_enabled"),
    limited_live_enabled: sourceBoundary.limited_live_enabled || observedUnsafeCondition(contractRows, "limited_live_enabled"),
    full_auto_enabled: sourceBoundary.full_auto_enabled || observedUnsafeCondition(contractRows, "full_auto_enabled"),
    automatic_order_submission_allowed: sourceBoundary.automatic_order_submission_allowed || observedUnsafeCondition(contractRows, "automatic_order_submission_allowed"),
    live_order_submission_allowed: sourceBoundary.live_order_submission_allowed || observedUnsafeCondition(contractRows, "live_order_submission_allowed"),
    live_promotion_allowed: observedUnsafeCondition(contractRows, "live_promotion_allowed"),
    live_execution_allowed: sourceBoundary.live_execution_allowed || observedUnsafeCondition(contractRows, "live_execution_allowed"),
    broker_write_allowed: sourceBoundary.broker_write_allowed || observedUnsafeCondition(contractRows, "broker_write_allowed"),
    exchange_write_allowed: sourceBoundary.exchange_write_allowed || observedUnsafeCondition(contractRows, "exchange_write_allowed"),
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

function observedUnsafeCondition(contractRows, token) {
  return contractRows
    .flatMap((row) => row.observed_conditions)
    .some((condition) => condition.condition_path.includes(token) && condition.observed_value !== condition.expected_safe_value);
}

function enablementConditionPath(conditionPath) {
  return [
    "promotion_candidate",
    "live_promotion_allowed",
    "shadow_live_enabled",
    "limited_live_enabled",
    "full_auto_enabled",
    "automatic_order_submission_allowed",
    "live_order_submission_allowed",
    "live_execution_allowed",
    "broker_write_allowed",
    "exchange_write_allowed",
  ].some((token) => conditionPath.includes(token));
}

function buildPromotionReceiptGateRows({ dataOutageHaltFixtures, packageJson, platformOpsLedger, tradingSample, modelImprovement, backtestValidation, paperShadow, limitedLive, fullAuto, contractRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p400_data_outage_halt_fixtures_ready", "P400 data outage halt fixtures source is ready.", dataOutageHaltFixtures.validation.valid && dataOutageHaltFixtures.summary.trading_data_outage_halt_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P401 trading promotion receipt contract fixtures command.", typeof scripts["trading:promotion-receipt-contract-fixtures"] === "string" && scripts["trading:promotion-receipt-contract-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P401 trading promotion receipt contract fixtures command.", validateScript.includes("npm run trading:promotion-receipt-contract-fixtures -- --check")),
    gateRow("p401_ledger_acceptance_declared", "P401 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P401: `trading:promotion-receipt-contract-fixtures`")),
    gateRow("promotion_receipt_sources_readable", "All promotion receipt source artifacts are readable.", tradingSample.available && modelImprovement.available && backtestValidation.available && paperShadow.available && limitedLive.available && fullAuto.available),
    gateRow("required_promotion_receipt_contracts_declared", "All required promotion receipt contracts are declared.", boundary.promotion_receipt_contracts_covered),
    gateRow("promotion_receipt_contracts_independent", "Every promotion stage has a unique independent receipt contract.", boundary.independent_receipt_contracts_declared),
    gateRow("promotion_receipt_contracts_ready_for_human_input", "Receipt contracts are ready for future human input without materializing or applying receipts.", boundary.receipt_contracts_ready_for_human_input && !boundary.receipt_materialized && !boundary.receipt_input_read_performed && !boundary.receipt_application_performed),
    gateRow("governance_complete_real_enablement_false", "Governance reports may be complete while real promotion enablement remains false.", boundary.governance_reports_complete_with_real_enablement_false),
    gateRow("higher_stage_enablement_blocked_without_receipt", "Higher-stage enablement cannot be claimed without a required receipt.", !boundary.higher_stage_enablement_claimed && !boundary.higher_stage_completion_claim_without_receipt && !boundary.source_receipt_present && !boundary.source_approval_applied),
    gateRow("live_and_full_auto_enablement_blocked", "Promotion receipt contracts do not enable shadow, limited-live, full-auto, live execution, order submission, broker writes, or exchange writes.", !boundary.shadow_live_enabled && !boundary.limited_live_enabled && !boundary.full_auto_enabled && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.live_execution_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed),
    gateRow("no_receipt_or_artifact_mutation", "P401 fixtures do not receive receipts, execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.receipt_materialized && !boundary.receipt_validation_performed && !boundary.receipt_application_performed && !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "promotion_receipt_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-promotion-receipt-contract-gate-row.v1",
    promotion_receipt_gate_row_id: `trading-promotion-receipt-contract-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_materialized_by_gate: false,
    approval_applied_by_gate: false,
    promotion_enablement_allowed_by_gate: false,
    live_order_submission_allowed_by_gate: false,
    live_execution_allowed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ dataOutageHaltFixtures, packageJson, platformOpsLedger, tradingSample, modelImprovement, backtestValidation, paperShadow, limitedLive, fullAuto, contractRows, summaryRows, gateRows, boundary }) {
  return [
    validationItem("source.data_outage_halt_fixtures", "p400_data_outage_halt_fixtures_ready", dataOutageHaltFixtures.validation.valid && dataOutageHaltFixtures.summary.trading_data_outage_halt_fixtures_status === SOURCE_READY_STATUS, "P400 data outage halt fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P401 promotion receipt contract fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.promotion_receipt_sources", "promotion_receipt_sources_available", tradingSample.available && modelImprovement.available && backtestValidation.available && paperShadow.available && limitedLive.available && fullAuto.available, "Promotion receipt source artifacts are readable."),
    validationItem("promotion_receipt_contract_rows", "required_promotion_receipt_contracts_ready", contractRows.length === REQUIRED_CONTRACT_KEYS.length && contractRows.every((row) => row.contract_status === "ready_for_human_receipt" && row.receipt_required && row.receipt_contract_independent), "All required promotion receipt contracts must be independent and ready for human input."),
    validationItem("promotion_receipt_summary_rows", "promotion_receipt_summary_rows_ready", summaryRows.length === REQUIRED_CONTRACT_KEYS.length && summaryRows.every((row) => row.summary_status === "receipt_contract_ready" && row.governance_complete_with_real_enablement_false), "Promotion receipt summary rows must be ready and keep real enablement false."),
    validationItem("promotion_receipt_gate_rows", "promotion_receipt_gates_ready", gateRows.length >= 12 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P401 promotion receipt gates are ready."),
    validationItem("boundary.source_ready", "source_data_outage_halt_ready", boundary.source_data_outage_halt_ready, "Source P400 data outage halt fixtures must be ready."),
    validationItem("boundary.contract_coverage", "promotion_receipt_contracts_covered", boundary.promotion_receipt_contracts_covered && boundary.independent_receipt_contracts_declared, "All P401 receipt contracts must be declared and independent."),
    validationItem("boundary.no_source_receipt_or_approval", "no_source_receipt_or_approval_applied", !boundary.source_receipt_present && !boundary.source_approval_applied && !boundary.approval_applied, "P401 must not consume or apply promotion receipts."),
    validationItem("boundary.no_higher_stage_enablement", "higher_stage_enablement_blocked_without_receipt", !boundary.higher_stage_enablement_claimed && !boundary.higher_stage_completion_claim_without_receipt, "Higher-stage promotion enablement must stay blocked without receipts."),
    validationItem("boundary.governance_complete_real_enablement_false", "governance_complete_real_enablement_false", boundary.governance_reports_complete_with_real_enablement_false, "Governance reports may be complete only while real enablement remains false."),
    validationItem("boundary.no_live_mutation", "no_trading_or_artifact_mutation", !boundary.shadow_live_enabled && !boundary.limited_live_enabled && !boundary.full_auto_enabled && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.live_execution_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed, "P401 promotion receipt contract fixtures perform no trading, receipt, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ dataOutageHaltFixtures, contractRows, summaryRows, gateRows, boundary, validation }) {
  return {
    trading_promotion_receipt_contract_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_data_outage_halt_status: dataOutageHaltFixtures.summary.trading_data_outage_halt_fixtures_status,
    source_data_outage_halt_ready: boundary.source_data_outage_halt_ready,
    required_contract_count: REQUIRED_CONTRACT_KEYS.length,
    contract_count: contractRows.length,
    ready_contract_count: boundary.ready_contract_count,
    independent_receipt_contract_count: boundary.independent_receipt_contract_count,
    summary_row_count: summaryRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    unsafe_promotion_receipt_signal_count: boundary.unsafe_promotion_receipt_signal_count,
    promotion_receipt_contracts_covered: boundary.promotion_receipt_contracts_covered,
    independent_receipt_contracts_declared: boundary.independent_receipt_contracts_declared,
    receipt_contracts_ready_for_human_input: boundary.receipt_contracts_ready_for_human_input,
    receipt_materialized: boundary.receipt_materialized,
    receipt_input_read_performed: boundary.receipt_input_read_performed,
    receipt_validation_performed: boundary.receipt_validation_performed,
    receipt_application_performed: boundary.receipt_application_performed,
    source_receipt_present: boundary.source_receipt_present,
    source_approval_applied: boundary.source_approval_applied,
    approval_applied: boundary.approval_applied,
    higher_stage_enablement_claimed: boundary.higher_stage_enablement_claimed,
    higher_stage_completion_claim_without_receipt: boundary.higher_stage_completion_claim_without_receipt,
    governance_reports_complete_with_real_enablement_false: boundary.governance_reports_complete_with_real_enablement_false,
    human_approval_missing_from_source: boundary.human_approval_missing_from_source,
    promotion_candidate_generated: boundary.promotion_candidate_generated,
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
    "# Trading Promotion Receipt Contract Fixtures",
    "",
    `Status: ${result.summary.trading_promotion_receipt_contract_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source data outage halt: ${result.summary.source_data_outage_halt_status}`,
    `Receipt contracts: ${result.summary.ready_contract_count}/${result.summary.contract_count}`,
    `Unsafe promotion receipt signals: ${result.summary.unsafe_promotion_receipt_signal_count}`,
    "",
    "## Contracts",
    "",
    ...result.promotion_receipt_contract_rows.map((row) => `- ${row.row_key}: ${row.contract_status}`),
    "",
    "## Gates",
    "",
    ...result.promotion_receipt_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-promotion-receipt-contract-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_OUT_DIR}
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
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS.platformOpsLedgerPath),
    trading_sample_path: path.resolve(options.tradingSamplePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS.tradingSamplePath),
    backtest_validation_path: path.resolve(options.backtestValidationPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS.backtestValidationPath),
    model_degradation_halt_fixtures_schema_path: path.resolve(options.modelDegradationHaltFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS.modelDegradationHaltFixturesSchemaPath),
    data_outage_halt_fixtures_schema_path: path.resolve(options.dataOutageHaltFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS.dataOutageHaltFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS.executionEnginePath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS.riskEnginePath),
    signal_engine_path: path.resolve(options.signalEnginePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS.signalEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS.modelImprovementPath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS.researchBacktestPaperPath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS.marketDataFeatureStorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS.schemaPath),
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

function valueAt(source, keys) {
  return keys.reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), source);
}

function hasDisabledRoute(routes, targetPath) {
  return Array.isArray(routes) && routes.some((route) => route?.method === "POST" && route?.path === targetPath);
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `trading-promotion-receipt-contract-fixtures.${slugify(itemPath)}.${checkId}`,
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
