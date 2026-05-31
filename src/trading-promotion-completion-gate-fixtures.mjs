import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS,
  buildTradingPromotionReceiptContractFixtures,
} from "./trading-promotion-receipt-contract-fixtures.mjs";

export const DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_OUT_DIR = "artifacts/trading-promotion-completion-gate-fixtures/latest";
export const DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS,
  promotionReceiptContractFixturesSchemaPath: DEFAULT_TRADING_PROMOTION_RECEIPT_CONTRACT_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-promotion-completion-gate-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-promotion-completion-gate-fixtures.v1";
const CAPABILITY_ID = "trading.promotion_completion_gate_fixtures";
const PHASE_SLOT = "P402";
const PREVIOUS_PHASE_SLOT = "P401";
const NEXT_PHASE_SLOT = "P403";
const READY_STATUS = "ready_for_trading_promotion_completion_gate_regression";
const SOURCE_READY_STATUS = "ready_for_trading_promotion_receipt_contract_regression";
const REQUIRED_STAGE_KEYS = [
  "research_to_backtest_completion_gate",
  "backtest_to_paper_completion_gate",
  "paper_to_shadow_completion_gate",
  "shadow_to_limited_live_completion_gate",
  "limited_live_to_full_auto_completion_gate",
  "full_auto_activation_completion_gate",
];

export async function runTradingPromotionCompletionGateFixtures(options = {}) {
  const result = await buildTradingPromotionCompletionGateFixtures(options);
  if (options.write !== false) await writeTradingPromotionCompletionGateFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading promotion completion gate fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingPromotionCompletionGateFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const promotionReceiptContractFixtures = await buildTradingPromotionReceiptContractFixtures({
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
    schemaPath: inputs.promotion_receipt_contract_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const promotionCompletionAnchor = buildPromotionCompletionAnchor({ promotionReceiptContractFixtures });
  const promotionCompletionStageRows = buildPromotionCompletionStageRows(promotionReceiptContractFixtures.promotion_receipt_contract_rows);
  const promotionCompletionSummaryRows = buildPromotionCompletionSummaryRows(promotionCompletionStageRows);
  const promotionCompletionBoundary = buildPromotionCompletionBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    promotionReceiptContractFixtures,
    stageRows: promotionCompletionStageRows,
    summaryRows: promotionCompletionSummaryRows,
  });
  const promotionCompletionGateRows = buildPromotionCompletionGateRows({
    promotionReceiptContractFixtures,
    packageJson,
    platformOpsLedger,
    stageRows: promotionCompletionStageRows,
    boundary: promotionCompletionBoundary,
  });
  const validationItems = buildValidationItems({
    promotionReceiptContractFixtures,
    packageJson,
    platformOpsLedger,
    stageRows: promotionCompletionStageRows,
    summaryRows: promotionCompletionSummaryRows,
    gateRows: promotionCompletionGateRows,
    boundary: promotionCompletionBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    promotionReceiptContractFixtures,
    stageRows: promotionCompletionStageRows,
    summaryRows: promotionCompletionSummaryRows,
    gateRows: promotionCompletionGateRows,
    boundary: promotionCompletionBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_promotion_completion_gate_fixtures_id: `trading-promotion-completion-gate-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    promotion_completion_gate_anchor: promotionCompletionAnchor,
    promotion_completion_stage_rows: promotionCompletionStageRows,
    promotion_completion_summary_rows: promotionCompletionSummaryRows,
    promotion_completion_gate_rows: promotionCompletionGateRows,
    promotion_completion_boundary: promotionCompletionBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_promotion_completion_gate_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    promotionReceiptContractFixtures,
    stageRows: promotionCompletionStageRows,
    summaryRows: promotionCompletionSummaryRows,
    gateRows: promotionCompletionGateRows,
    boundary: promotionCompletionBoundary,
    validation: result.validation,
  });
  result.summary.trading_promotion_completion_gate_fixtures_id = result.trading_promotion_completion_gate_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingPromotionCompletionGateFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-promotion-completion-gate-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "promotion-completion-stage-rows.json"), collectionEnvelope("trading-promotion-completion-stage-rows.v1", "promotion_completion_stage_rows", result.promotion_completion_stage_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-completion-summary-rows.json"), collectionEnvelope("trading-promotion-completion-summary-rows.v1", "promotion_completion_summary_rows", result.promotion_completion_summary_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-completion-gate-rows.json"), collectionEnvelope("trading-promotion-completion-gate-rows.v1", "promotion_completion_gate_rows", result.promotion_completion_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-completion-boundary.json"), result.promotion_completion_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-promotion-completion-gate-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingPromotionCompletionGateFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingPromotionCompletionGateFixtures(args);
    console.log(`Trading promotion completion gate fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_promotion_completion_gate_fixtures_status}`);
    console.log(`Completion gates: ${result.summary.ready_stage_count}/${result.summary.stage_count}`);
    console.log(`Completion claims without receipt: ${result.summary.completion_claim_without_receipt_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPromotionCompletionAnchor({ promotionReceiptContractFixtures }) {
  return {
    schema_version: "trading-promotion-completion-gate-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_contract_fixtures_id: promotionReceiptContractFixtures.trading_promotion_receipt_contract_fixtures_id,
    source_promotion_receipt_contract_status: promotionReceiptContractFixtures.summary.trading_promotion_receipt_contract_fixtures_status,
    required_stage_count: REQUIRED_STAGE_KEYS.length,
    required_stage_keys: REQUIRED_STAGE_KEYS,
    source_hash: hashValue({
      id: promotionReceiptContractFixtures.trading_promotion_receipt_contract_fixtures_id,
      status: promotionReceiptContractFixtures.summary.trading_promotion_receipt_contract_fixtures_status,
      stages: REQUIRED_STAGE_KEYS,
    }),
  };
}

function buildPromotionCompletionStageRows(contractRows) {
  return REQUIRED_STAGE_KEYS.map((stageKey, index) => {
    const contractRow = contractRows.find((row) => stageKey === row.row_key.replace("_receipt_contract", "_completion_gate"));
    const completionClaimed = contractRow?.higher_stage_enablement_claimed === true;
    const sourceReceiptPresent = contractRow?.source_receipt_present === true || contractRow?.approval_receipt_present === true;
    const completionClaimWithoutReceipt = completionClaimed && !sourceReceiptPresent;
    const row = {
      schema_version: "trading-promotion-completion-stage-row.v1",
      promotion_completion_stage_row_id: `trading-promotion-completion-gate.stage.${stageKey}`,
      phase_slot: PHASE_SLOT,
      row_key: stageKey,
      source_contract_row_key: contractRow?.row_key ?? "missing",
      from_stage: contractRow?.from_stage ?? "missing",
      to_stage: contractRow?.to_stage ?? "missing",
      receipt_contract_id: contractRow?.receipt_contract_id ?? "missing",
      receipt_required: contractRow?.receipt_required === true,
      receipt_contract_independent: contractRow?.receipt_contract_independent === true,
      source_contract_status: contractRow?.contract_status ?? "missing",
      source_governance_report_status: contractRow?.source_governance_report_status ?? "missing",
      governance_report_may_be_complete: contractRow?.governance_report_may_be_complete === true,
      source_receipt_present: sourceReceiptPresent,
      source_approval_applied: contractRow?.source_approval_applied === true || contractRow?.approval_applied === true,
      completion_claimed: completionClaimed,
      completion_claim_without_receipt: completionClaimWithoutReceipt,
      completion_blocked_without_receipt: !sourceReceiptPresent,
      completion_enablement_allowed: false,
      governance_complete_with_real_enablement_false: contractRow?.governance_complete_with_real_enablement_false === true && !completionClaimed,
      stage_completion_status: contractRow?.contract_status === "ready_for_human_receipt" && !completionClaimed && !sourceReceiptPresent ? "ready_blocking_completion" : "blocked",
      receipt_validation_performed_by_stage: false,
      receipt_application_performed_by_stage: false,
      live_execution_allowed_by_stage: false,
      protected_action_executed_by_stage: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "promotion_completion_stage_hash");
  });
}

function buildPromotionCompletionSummaryRows(stageRows) {
  return stageRows.map((stageRow, index) => {
    const row = {
      schema_version: "trading-promotion-completion-summary-row.v1",
      promotion_completion_summary_row_id: `trading-promotion-completion-gate.summary.${stageRow.row_key}`,
      phase_slot: PHASE_SLOT,
      row_key: stageRow.row_key,
      from_stage: stageRow.from_stage,
      to_stage: stageRow.to_stage,
      receipt_contract_id: stageRow.receipt_contract_id,
      receipt_required: stageRow.receipt_required,
      source_receipt_present: stageRow.source_receipt_present,
      source_approval_applied: stageRow.source_approval_applied,
      completion_claimed: stageRow.completion_claimed,
      completion_claim_without_receipt: stageRow.completion_claim_without_receipt,
      completion_blocked_without_receipt: stageRow.completion_blocked_without_receipt,
      completion_enablement_allowed: stageRow.completion_enablement_allowed,
      governance_report_may_be_complete: stageRow.governance_report_may_be_complete,
      governance_complete_with_real_enablement_false: stageRow.governance_complete_with_real_enablement_false,
      summary_status: stageRow.stage_completion_status === "ready_blocking_completion" ? "completion_blocked_pending_receipt" : "blocked",
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "promotion_completion_summary_hash");
  });
}

function buildPromotionCompletionBoundary({ generatedAt, writeRequested, promotionReceiptContractFixtures, stageRows, summaryRows }) {
  const sourceSummary = promotionReceiptContractFixtures.summary;
  const completionClaimRows = stageRows.filter((row) => row.completion_claimed);
  const completionClaimWithoutReceiptRows = stageRows.filter((row) => row.completion_claim_without_receipt);
  return {
    schema_version: "trading-promotion-completion-gate-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    promotion_completion_artifact_write_requested: writeRequested,
    promotion_completion_execution_performed: false,
    required_stage_count: REQUIRED_STAGE_KEYS.length,
    stage_count: stageRows.length,
    summary_row_count: summaryRows.length,
    ready_stage_count: stageRows.filter((row) => row.stage_completion_status === "ready_blocking_completion").length,
    blocked_stage_count: stageRows.filter((row) => row.stage_completion_status !== "ready_blocking_completion").length,
    source_promotion_receipt_contract_status: sourceSummary.trading_promotion_receipt_contract_fixtures_status,
    source_promotion_receipt_contract_ready: promotionReceiptContractFixtures.validation.valid && sourceSummary.trading_promotion_receipt_contract_fixtures_status === SOURCE_READY_STATUS,
    promotion_completion_gates_covered: stageRows.length === REQUIRED_STAGE_KEYS.length && REQUIRED_STAGE_KEYS.every((rowKey) => stageRows.some((row) => row.row_key === rowKey)),
    receipt_required_for_every_completion_gate: stageRows.every((row) => row.receipt_required && row.receipt_contract_independent),
    completion_gates_block_without_receipts: stageRows.every((row) => row.completion_blocked_without_receipt && !row.completion_enablement_allowed),
    completion_claim_count: completionClaimRows.length,
    completion_claim_refs: completionClaimRows.map((row) => row.row_key),
    completion_claim_without_receipt_count: completionClaimWithoutReceiptRows.length,
    completion_claim_without_receipt_refs: completionClaimWithoutReceiptRows.map((row) => row.row_key),
    source_receipt_present: sourceSummary.source_receipt_present || stageRows.some((row) => row.source_receipt_present),
    source_approval_applied: sourceSummary.source_approval_applied || stageRows.some((row) => row.source_approval_applied),
    receipt_materialized: false,
    receipt_input_read_performed: false,
    receipt_validation_performed: false,
    receipt_application_performed: false,
    approval_applied: false,
    governance_reports_complete_with_real_enablement_false: sourceSummary.governance_reports_complete_with_real_enablement_false && stageRows.every((row) => row.governance_complete_with_real_enablement_false),
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

function buildPromotionCompletionGateRows({ promotionReceiptContractFixtures, packageJson, platformOpsLedger, stageRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p401_promotion_receipt_contract_fixtures_ready", "P401 promotion receipt contract fixtures source is ready.", promotionReceiptContractFixtures.validation.valid && promotionReceiptContractFixtures.summary.trading_promotion_receipt_contract_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P402 trading promotion completion gate fixtures command.", typeof scripts["trading:promotion-completion-gate-fixtures"] === "string" && scripts["trading:promotion-completion-gate-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P402 trading promotion completion gate fixtures command.", validateScript.includes("npm run trading:promotion-completion-gate-fixtures -- --check")),
    gateRow("p402_ledger_acceptance_declared", "P402 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P402: `trading:promotion-completion-gate-fixtures`")),
    gateRow("required_promotion_completion_gates_declared", "Every P401 promotion receipt contract has a P402 completion gate.", boundary.promotion_completion_gates_covered),
    gateRow("receipt_required_for_every_completion_gate", "Every completion gate requires an independent receipt contract.", boundary.receipt_required_for_every_completion_gate),
    gateRow("completion_gates_block_without_receipts", "Completion gates block promotion completion while receipts are absent.", boundary.completion_gates_block_without_receipts && stageRows.every((row) => row.stage_completion_status === "ready_blocking_completion")),
    gateRow("no_completion_claim_without_receipt", "No promotion stage is marked complete for enablement without a receipt.", boundary.completion_claim_count === 0 && boundary.completion_claim_without_receipt_count === 0 && !boundary.source_receipt_present && !boundary.source_approval_applied),
    gateRow("governance_complete_real_enablement_false", "Governance reports remain complete only as read-only control-plane state with real enablement false.", boundary.governance_reports_complete_with_real_enablement_false),
    gateRow("live_and_full_auto_enablement_blocked", "P402 completion gates do not enable shadow, limited-live, full-auto, live execution, order submission, broker writes, or exchange writes.", !boundary.shadow_live_enabled && !boundary.limited_live_enabled && !boundary.full_auto_enabled && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.live_execution_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed),
    gateRow("no_receipt_or_artifact_mutation", "P402 fixtures do not receive receipts, apply approvals, execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.receipt_materialized && !boundary.receipt_validation_performed && !boundary.receipt_application_performed && !boundary.approval_applied && !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "promotion_completion_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-promotion-completion-gate-row.v1",
    promotion_completion_gate_row_id: `trading-promotion-completion-gate-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_materialized_by_gate: false,
    completion_applied_by_gate: false,
    promotion_enablement_allowed_by_gate: false,
    live_order_submission_allowed_by_gate: false,
    live_execution_allowed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ promotionReceiptContractFixtures, packageJson, platformOpsLedger, stageRows, summaryRows, gateRows, boundary }) {
  return [
    validationItem("source.promotion_receipt_contract_fixtures", "p401_promotion_receipt_contract_fixtures_ready", promotionReceiptContractFixtures.validation.valid && promotionReceiptContractFixtures.summary.trading_promotion_receipt_contract_fixtures_status === SOURCE_READY_STATUS, "P401 promotion receipt contract fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P402 promotion completion gate fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("promotion_completion_stage_rows", "promotion_completion_stage_rows_ready", stageRows.length === REQUIRED_STAGE_KEYS.length && stageRows.every((row) => row.stage_completion_status === "ready_blocking_completion" && row.receipt_required), "All P402 promotion completion stage rows must block completion pending receipts."),
    validationItem("promotion_completion_summary_rows", "promotion_completion_summary_rows_ready", summaryRows.length === REQUIRED_STAGE_KEYS.length && summaryRows.every((row) => row.summary_status === "completion_blocked_pending_receipt" && row.completion_blocked_without_receipt), "All P402 promotion completion summary rows must block completion pending receipts."),
    validationItem("promotion_completion_gate_rows", "promotion_completion_gates_ready", gateRows.length >= 11 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P402 promotion completion gates are ready."),
    validationItem("boundary.source_ready", "source_promotion_receipt_contract_ready", boundary.source_promotion_receipt_contract_ready, "Source P401 promotion receipt contract fixtures must be ready."),
    validationItem("boundary.stage_coverage", "promotion_completion_gates_covered", boundary.promotion_completion_gates_covered && boundary.receipt_required_for_every_completion_gate, "All P402 completion gates must be declared and receipt-bound."),
    validationItem("boundary.no_completion_claim_without_receipt", "no_completion_claim_without_receipt", boundary.completion_claim_count === 0 && boundary.completion_claim_without_receipt_count === 0 && !boundary.source_receipt_present && !boundary.source_approval_applied, "Promotion completion claims must remain absent while receipts are absent."),
    validationItem("boundary.governance_complete_real_enablement_false", "governance_complete_real_enablement_false", boundary.governance_reports_complete_with_real_enablement_false, "Governance reports may be complete only while real enablement remains false."),
    validationItem("boundary.no_live_mutation", "no_trading_or_artifact_mutation", !boundary.shadow_live_enabled && !boundary.limited_live_enabled && !boundary.full_auto_enabled && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.live_execution_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed, "P402 completion gate fixtures perform no trading, receipt, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ promotionReceiptContractFixtures, stageRows, summaryRows, gateRows, boundary, validation }) {
  return {
    trading_promotion_completion_gate_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_contract_status: promotionReceiptContractFixtures.summary.trading_promotion_receipt_contract_fixtures_status,
    source_promotion_receipt_contract_ready: boundary.source_promotion_receipt_contract_ready,
    required_stage_count: REQUIRED_STAGE_KEYS.length,
    stage_count: stageRows.length,
    ready_stage_count: boundary.ready_stage_count,
    blocked_stage_count: boundary.blocked_stage_count,
    summary_row_count: summaryRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    promotion_completion_gates_covered: boundary.promotion_completion_gates_covered,
    receipt_required_for_every_completion_gate: boundary.receipt_required_for_every_completion_gate,
    completion_gates_block_without_receipts: boundary.completion_gates_block_without_receipts,
    completion_claim_count: boundary.completion_claim_count,
    completion_claim_without_receipt_count: boundary.completion_claim_without_receipt_count,
    source_receipt_present: boundary.source_receipt_present,
    source_approval_applied: boundary.source_approval_applied,
    receipt_materialized: boundary.receipt_materialized,
    receipt_input_read_performed: boundary.receipt_input_read_performed,
    receipt_validation_performed: boundary.receipt_validation_performed,
    receipt_application_performed: boundary.receipt_application_performed,
    approval_applied: boundary.approval_applied,
    governance_reports_complete_with_real_enablement_false: boundary.governance_reports_complete_with_real_enablement_false,
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
    "# Trading Promotion Completion Gate Fixtures",
    "",
    `Status: ${result.summary.trading_promotion_completion_gate_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source promotion receipt contracts: ${result.summary.source_promotion_receipt_contract_status}`,
    `Completion gates: ${result.summary.ready_stage_count}/${result.summary.stage_count}`,
    `Completion claims without receipt: ${result.summary.completion_claim_without_receipt_count}`,
    "",
    "## Stage Gates",
    "",
    ...result.promotion_completion_stage_rows.map((row) => `- ${row.row_key}: ${row.stage_completion_status}`),
    "",
    "## Gates",
    "",
    ...result.promotion_completion_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-promotion-completion-gate-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_OUT_DIR}
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
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS.platformOpsLedgerPath),
    trading_sample_path: path.resolve(options.tradingSamplePath ?? DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS.tradingSamplePath),
    backtest_validation_path: path.resolve(options.backtestValidationPath ?? DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS.backtestValidationPath),
    model_degradation_halt_fixtures_schema_path: path.resolve(options.modelDegradationHaltFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS.modelDegradationHaltFixturesSchemaPath),
    data_outage_halt_fixtures_schema_path: path.resolve(options.dataOutageHaltFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS.dataOutageHaltFixturesSchemaPath),
    promotion_receipt_contract_fixtures_schema_path: path.resolve(options.promotionReceiptContractFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS.promotionReceiptContractFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS.executionEnginePath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS.riskEnginePath),
    signal_engine_path: path.resolve(options.signalEnginePath ?? DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS.signalEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS.modelImprovementPath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS.researchBacktestPaperPath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS.marketDataFeatureStorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS.schemaPath),
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

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `trading-promotion-completion-gate-fixtures.${slugify(itemPath)}.${checkId}`,
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
