import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS,
  buildTradingPromotionCompletionGateFixtures,
} from "./trading-promotion-completion-gate-fixtures.mjs";

export const DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_OUT_DIR = "artifacts/trading-promotion-governance-readonly-fixtures/latest";
export const DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS,
  promotionCompletionGateFixturesSchemaPath: DEFAULT_TRADING_PROMOTION_COMPLETION_GATE_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-promotion-governance-readonly-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-promotion-governance-readonly-fixtures.v1";
const CAPABILITY_ID = "trading.promotion_governance_readonly_fixtures";
const PHASE_SLOT = "P403";
const PREVIOUS_PHASE_SLOT = "P402";
const NEXT_PHASE_SLOT = "P404";
const READY_STATUS = "ready_for_trading_promotion_governance_readonly_regression";
const SOURCE_READY_STATUS = "ready_for_trading_promotion_completion_gate_regression";
const REQUIRED_GOVERNANCE_KEYS = [
  "research_to_backtest_governance_readonly",
  "backtest_to_paper_governance_readonly",
  "paper_to_shadow_governance_readonly",
  "shadow_to_limited_live_governance_readonly",
  "limited_live_to_full_auto_governance_readonly",
  "full_auto_activation_governance_readonly",
];

export async function runTradingPromotionGovernanceReadonlyFixtures(options = {}) {
  const result = await buildTradingPromotionGovernanceReadonlyFixtures(options);
  if (options.write !== false) await writeTradingPromotionGovernanceReadonlyFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading promotion governance readonly fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingPromotionGovernanceReadonlyFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const promotionCompletionGateFixtures = await buildTradingPromotionCompletionGateFixtures({
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
    schemaPath: inputs.promotion_completion_gate_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const promotionGovernanceAnchor = buildPromotionGovernanceAnchor({ promotionCompletionGateFixtures });
  const promotionGovernanceRows = buildPromotionGovernanceRows(promotionCompletionGateFixtures.promotion_completion_stage_rows);
  const promotionGovernanceSummaryRows = buildPromotionGovernanceSummaryRows(promotionGovernanceRows);
  const promotionGovernanceBoundary = buildPromotionGovernanceBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    promotionCompletionGateFixtures,
    governanceRows: promotionGovernanceRows,
    summaryRows: promotionGovernanceSummaryRows,
  });
  const promotionGovernanceGateRows = buildPromotionGovernanceGateRows({
    promotionCompletionGateFixtures,
    packageJson,
    platformOpsLedger,
    governanceRows: promotionGovernanceRows,
    boundary: promotionGovernanceBoundary,
  });
  const validationItems = buildValidationItems({
    promotionCompletionGateFixtures,
    packageJson,
    platformOpsLedger,
    governanceRows: promotionGovernanceRows,
    summaryRows: promotionGovernanceSummaryRows,
    gateRows: promotionGovernanceGateRows,
    boundary: promotionGovernanceBoundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    promotionCompletionGateFixtures,
    governanceRows: promotionGovernanceRows,
    summaryRows: promotionGovernanceSummaryRows,
    gateRows: promotionGovernanceGateRows,
    boundary: promotionGovernanceBoundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_promotion_governance_readonly_fixtures_id: `trading-promotion-governance-readonly-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    promotion_governance_readonly_anchor: promotionGovernanceAnchor,
    promotion_governance_readonly_rows: promotionGovernanceRows,
    promotion_governance_readonly_summary_rows: promotionGovernanceSummaryRows,
    promotion_governance_readonly_gate_rows: promotionGovernanceGateRows,
    promotion_governance_readonly_boundary: promotionGovernanceBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_promotion_governance_readonly_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    promotionCompletionGateFixtures,
    governanceRows: promotionGovernanceRows,
    summaryRows: promotionGovernanceSummaryRows,
    gateRows: promotionGovernanceGateRows,
    boundary: promotionGovernanceBoundary,
    validation: result.validation,
  });
  result.summary.trading_promotion_governance_readonly_fixtures_id = result.trading_promotion_governance_readonly_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingPromotionGovernanceReadonlyFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-promotion-governance-readonly-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "promotion-governance-readonly-rows.json"), collectionEnvelope("trading-promotion-governance-readonly-rows.v1", "promotion_governance_readonly_rows", result.promotion_governance_readonly_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-governance-readonly-summary-rows.json"), collectionEnvelope("trading-promotion-governance-readonly-summary-rows.v1", "promotion_governance_readonly_summary_rows", result.promotion_governance_readonly_summary_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-governance-readonly-gate-rows.json"), collectionEnvelope("trading-promotion-governance-readonly-gate-rows.v1", "promotion_governance_readonly_gate_rows", result.promotion_governance_readonly_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-governance-readonly-boundary.json"), result.promotion_governance_readonly_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-promotion-governance-readonly-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingPromotionGovernanceReadonlyFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingPromotionGovernanceReadonlyFixtures(args);
    console.log(`Trading promotion governance readonly fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_promotion_governance_readonly_fixtures_status}`);
    console.log(`Governance rows: ${result.summary.ready_governance_row_count}/${result.summary.governance_row_count}`);
    console.log(`Real enablement count: ${result.summary.real_enablement_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPromotionGovernanceAnchor({ promotionCompletionGateFixtures }) {
  return {
    schema_version: "trading-promotion-governance-readonly-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_completion_gate_fixtures_id: promotionCompletionGateFixtures.trading_promotion_completion_gate_fixtures_id,
    source_promotion_completion_gate_status: promotionCompletionGateFixtures.summary.trading_promotion_completion_gate_fixtures_status,
    required_governance_row_count: REQUIRED_GOVERNANCE_KEYS.length,
    required_governance_keys: REQUIRED_GOVERNANCE_KEYS,
    source_hash: hashValue({
      id: promotionCompletionGateFixtures.trading_promotion_completion_gate_fixtures_id,
      status: promotionCompletionGateFixtures.summary.trading_promotion_completion_gate_fixtures_status,
      rows: REQUIRED_GOVERNANCE_KEYS,
    }),
  };
}

function buildPromotionGovernanceRows(stageRows) {
  return REQUIRED_GOVERNANCE_KEYS.map((rowKey, index) => {
    const stageRow = stageRows.find((row) => rowKey === row.row_key.replace("_completion_gate", "_governance_readonly"));
    const realEnablement = stageRow?.completion_claimed === true || stageRow?.completion_enablement_allowed === true || stageRow?.live_execution_allowed_by_stage === true;
    const row = {
      schema_version: "trading-promotion-governance-readonly-row.v1",
      promotion_governance_readonly_row_id: `trading-promotion-governance-readonly.row.${rowKey}`,
      phase_slot: PHASE_SLOT,
      row_key: rowKey,
      source_stage_row_key: stageRow?.row_key ?? "missing",
      from_stage: stageRow?.from_stage ?? "missing",
      to_stage: stageRow?.to_stage ?? "missing",
      receipt_contract_id: stageRow?.receipt_contract_id ?? "missing",
      source_governance_report_status: stageRow?.source_governance_report_status ?? "missing",
      governance_report_may_be_complete: stageRow?.governance_report_may_be_complete === true,
      governance_completion_readonly: true,
      governance_report_is_evidence_only: true,
      completion_gate_status: stageRow?.stage_completion_status ?? "missing",
      completion_blocked_without_receipt: stageRow?.completion_blocked_without_receipt === true,
      completion_claimed: stageRow?.completion_claimed === true,
      source_receipt_present: stageRow?.source_receipt_present === true,
      source_approval_applied: stageRow?.source_approval_applied === true,
      real_enablement_allowed: false,
      real_enablement_detected: realEnablement,
      governance_complete_with_real_enablement_false: stageRow?.governance_complete_with_real_enablement_false === true && !realEnablement,
      readonly_governance_status: stageRow?.stage_completion_status === "ready_blocking_completion" && !realEnablement ? "ready_readonly_governance" : "blocked",
      receipt_validation_performed_by_governance: false,
      receipt_application_performed_by_governance: false,
      command_execution_performed_by_governance: false,
      artifact_write_performed_by_governance: false,
      protected_action_executed_by_governance: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "promotion_governance_readonly_hash");
  });
}

function buildPromotionGovernanceSummaryRows(governanceRows) {
  return governanceRows.map((governanceRow, index) => {
    const row = {
      schema_version: "trading-promotion-governance-readonly-summary-row.v1",
      promotion_governance_readonly_summary_row_id: `trading-promotion-governance-readonly.summary.${governanceRow.row_key}`,
      phase_slot: PHASE_SLOT,
      row_key: governanceRow.row_key,
      from_stage: governanceRow.from_stage,
      to_stage: governanceRow.to_stage,
      source_governance_report_status: governanceRow.source_governance_report_status,
      governance_report_may_be_complete: governanceRow.governance_report_may_be_complete,
      governance_completion_readonly: governanceRow.governance_completion_readonly,
      governance_report_is_evidence_only: governanceRow.governance_report_is_evidence_only,
      completion_blocked_without_receipt: governanceRow.completion_blocked_without_receipt,
      real_enablement_allowed: governanceRow.real_enablement_allowed,
      real_enablement_detected: governanceRow.real_enablement_detected,
      governance_complete_with_real_enablement_false: governanceRow.governance_complete_with_real_enablement_false,
      summary_status: governanceRow.readonly_governance_status === "ready_readonly_governance" ? "readonly_governance_ready" : "blocked",
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "promotion_governance_readonly_summary_hash");
  });
}

function buildPromotionGovernanceBoundary({ generatedAt, writeRequested, promotionCompletionGateFixtures, governanceRows, summaryRows }) {
  const sourceSummary = promotionCompletionGateFixtures.summary;
  const realEnablementRows = governanceRows.filter((row) => row.real_enablement_detected);
  return {
    schema_version: "trading-promotion-governance-readonly-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    promotion_governance_readonly_artifact_write_requested: writeRequested,
    promotion_governance_execution_performed: false,
    required_governance_row_count: REQUIRED_GOVERNANCE_KEYS.length,
    governance_row_count: governanceRows.length,
    summary_row_count: summaryRows.length,
    ready_governance_row_count: governanceRows.filter((row) => row.readonly_governance_status === "ready_readonly_governance").length,
    source_promotion_completion_gate_status: sourceSummary.trading_promotion_completion_gate_fixtures_status,
    source_promotion_completion_gate_ready: promotionCompletionGateFixtures.validation.valid && sourceSummary.trading_promotion_completion_gate_fixtures_status === SOURCE_READY_STATUS,
    promotion_governance_rows_covered: governanceRows.length === REQUIRED_GOVERNANCE_KEYS.length && REQUIRED_GOVERNANCE_KEYS.every((rowKey) => governanceRows.some((row) => row.row_key === rowKey)),
    governance_reports_readonly: governanceRows.every((row) => row.governance_completion_readonly && row.governance_report_is_evidence_only),
    governance_reports_may_be_complete: governanceRows.every((row) => row.governance_report_may_be_complete),
    governance_reports_complete_with_real_enablement_false: sourceSummary.governance_reports_complete_with_real_enablement_false && governanceRows.every((row) => row.governance_complete_with_real_enablement_false),
    completion_gates_block_without_receipts: sourceSummary.completion_gates_block_without_receipts && governanceRows.every((row) => row.completion_blocked_without_receipt),
    real_enablement_count: realEnablementRows.length,
    real_enablement_refs: realEnablementRows.map((row) => row.row_key),
    completion_claim_count: sourceSummary.completion_claim_count,
    completion_claim_without_receipt_count: sourceSummary.completion_claim_without_receipt_count,
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

function buildPromotionGovernanceGateRows({ promotionCompletionGateFixtures, packageJson, platformOpsLedger, governanceRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p402_promotion_completion_gate_fixtures_ready", "P402 promotion completion gate fixtures source is ready.", promotionCompletionGateFixtures.validation.valid && promotionCompletionGateFixtures.summary.trading_promotion_completion_gate_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P403 trading promotion governance readonly fixtures command.", typeof scripts["trading:promotion-governance-readonly-fixtures"] === "string" && scripts["trading:promotion-governance-readonly-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P403 trading promotion governance readonly fixtures command.", validateScript.includes("npm run trading:promotion-governance-readonly-fixtures -- --check")),
    gateRow("p403_ledger_acceptance_declared", "P403 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P403: `trading:promotion-governance-readonly-fixtures`")),
    gateRow("required_promotion_governance_rows_declared", "Every P402 completion gate has a P403 governance-readonly row.", boundary.promotion_governance_rows_covered),
    gateRow("governance_reports_readonly", "Promotion governance reports are evidence-only and read-only.", boundary.governance_reports_readonly && governanceRows.every((row) => row.readonly_governance_status === "ready_readonly_governance")),
    gateRow("governance_complete_real_enablement_false", "Complete governance reports are allowed only while real promotion enablement remains false.", boundary.governance_reports_may_be_complete && boundary.governance_reports_complete_with_real_enablement_false && boundary.real_enablement_count === 0),
    gateRow("completion_gates_block_without_receipts", "Completion gates still block without independent receipts.", boundary.completion_gates_block_without_receipts && boundary.completion_claim_count === 0 && boundary.completion_claim_without_receipt_count === 0),
    gateRow("live_and_full_auto_enablement_blocked", "P403 governance rows do not enable shadow, limited-live, full-auto, live execution, order submission, broker writes, or exchange writes.", !boundary.shadow_live_enabled && !boundary.limited_live_enabled && !boundary.full_auto_enabled && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.live_execution_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed),
    gateRow("no_receipt_or_artifact_mutation", "P403 fixtures do not receive receipts, apply approvals, execute commands, write artifacts in --check, publish releases, run git, or execute protected actions.", !boundary.receipt_materialized && !boundary.receipt_validation_performed && !boundary.receipt_application_performed && !boundary.approval_applied && !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "promotion_governance_readonly_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-promotion-governance-readonly-gate-row.v1",
    promotion_governance_readonly_gate_row_id: `trading-promotion-governance-readonly-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_materialized_by_gate: false,
    governance_enablement_allowed_by_gate: false,
    promotion_enablement_allowed_by_gate: false,
    live_order_submission_allowed_by_gate: false,
    live_execution_allowed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
  };
}

function buildValidationItems({ promotionCompletionGateFixtures, packageJson, platformOpsLedger, governanceRows, summaryRows, gateRows, boundary }) {
  return [
    validationItem("source.promotion_completion_gate_fixtures", "p402_promotion_completion_gate_fixtures_ready", promotionCompletionGateFixtures.validation.valid && promotionCompletionGateFixtures.summary.trading_promotion_completion_gate_fixtures_status === SOURCE_READY_STATUS, "P402 promotion completion gate fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P403 promotion governance readonly fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("promotion_governance_readonly_rows", "promotion_governance_rows_ready", governanceRows.length === REQUIRED_GOVERNANCE_KEYS.length && governanceRows.every((row) => row.readonly_governance_status === "ready_readonly_governance"), "All P403 governance rows must be read-only and evidence-only."),
    validationItem("promotion_governance_readonly_summary_rows", "promotion_governance_summary_rows_ready", summaryRows.length === REQUIRED_GOVERNANCE_KEYS.length && summaryRows.every((row) => row.summary_status === "readonly_governance_ready"), "All P403 governance summary rows must show read-only governance readiness."),
    validationItem("promotion_governance_readonly_gate_rows", "promotion_governance_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P403 promotion governance readonly gates are ready."),
    validationItem("boundary.source_ready", "source_promotion_completion_gate_ready", boundary.source_promotion_completion_gate_ready, "Source P402 promotion completion gate fixtures must be ready."),
    validationItem("boundary.governance_rows_covered", "promotion_governance_rows_covered", boundary.promotion_governance_rows_covered && boundary.governance_reports_readonly, "All P403 governance rows must be covered and read-only."),
    validationItem("boundary.governance_complete_real_enablement_false", "governance_complete_real_enablement_false", boundary.governance_reports_may_be_complete && boundary.governance_reports_complete_with_real_enablement_false && boundary.real_enablement_count === 0, "Complete governance reports may exist only while real enablement is false."),
    validationItem("boundary.no_live_mutation", "no_trading_or_artifact_mutation", !boundary.shadow_live_enabled && !boundary.limited_live_enabled && !boundary.full_auto_enabled && !boundary.automatic_order_submission_allowed && !boundary.live_order_submission_allowed && !boundary.live_execution_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.release_check_execution_performed && !boundary.artifact_write_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed, "P403 governance readonly fixtures perform no trading, receipt, artifact, release, git, or protected mutation."),
  ];
}

function buildSummary({ promotionCompletionGateFixtures, governanceRows, summaryRows, gateRows, boundary, validation }) {
  return {
    trading_promotion_governance_readonly_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_completion_gate_status: promotionCompletionGateFixtures.summary.trading_promotion_completion_gate_fixtures_status,
    source_promotion_completion_gate_ready: boundary.source_promotion_completion_gate_ready,
    required_governance_row_count: REQUIRED_GOVERNANCE_KEYS.length,
    governance_row_count: governanceRows.length,
    ready_governance_row_count: boundary.ready_governance_row_count,
    summary_row_count: summaryRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    promotion_governance_rows_covered: boundary.promotion_governance_rows_covered,
    governance_reports_readonly: boundary.governance_reports_readonly,
    governance_reports_may_be_complete: boundary.governance_reports_may_be_complete,
    governance_reports_complete_with_real_enablement_false: boundary.governance_reports_complete_with_real_enablement_false,
    completion_gates_block_without_receipts: boundary.completion_gates_block_without_receipts,
    real_enablement_count: boundary.real_enablement_count,
    completion_claim_count: boundary.completion_claim_count,
    completion_claim_without_receipt_count: boundary.completion_claim_without_receipt_count,
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
    "# Trading Promotion Governance Readonly Fixtures",
    "",
    `Status: ${result.summary.trading_promotion_governance_readonly_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source completion gates: ${result.summary.source_promotion_completion_gate_status}`,
    `Governance rows: ${result.summary.ready_governance_row_count}/${result.summary.governance_row_count}`,
    `Real enablement count: ${result.summary.real_enablement_count}`,
    "",
    "## Governance Rows",
    "",
    ...result.promotion_governance_readonly_rows.map((row) => `- ${row.row_key}: ${row.readonly_governance_status}`),
    "",
    "## Gates",
    "",
    ...result.promotion_governance_readonly_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_OUT_DIR };
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
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-promotion-governance-readonly-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_OUT_DIR}
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
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS.platformOpsLedgerPath),
    trading_sample_path: path.resolve(options.tradingSamplePath ?? DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS.tradingSamplePath),
    backtest_validation_path: path.resolve(options.backtestValidationPath ?? DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS.backtestValidationPath),
    model_degradation_halt_fixtures_schema_path: path.resolve(options.modelDegradationHaltFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS.modelDegradationHaltFixturesSchemaPath),
    data_outage_halt_fixtures_schema_path: path.resolve(options.dataOutageHaltFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS.dataOutageHaltFixturesSchemaPath),
    promotion_receipt_contract_fixtures_schema_path: path.resolve(options.promotionReceiptContractFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS.promotionReceiptContractFixturesSchemaPath),
    promotion_completion_gate_fixtures_schema_path: path.resolve(options.promotionCompletionGateFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS.promotionCompletionGateFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS.executionEnginePath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS.riskEnginePath),
    signal_engine_path: path.resolve(options.signalEnginePath ?? DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS.signalEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS.modelImprovementPath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS.researchBacktestPaperPath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS.marketDataFeatureStorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_PROMOTION_GOVERNANCE_READONLY_FIXTURES_INPUTS.schemaPath),
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
    validation_item_id: `trading-promotion-governance-readonly-fixtures.${slugify(itemPath)}.${checkId}`,
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
