import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS,
  buildTradingPromotionReceiptValidationRulesFixtures,
} from "./trading-promotion-receipt-validation-rules-fixtures.mjs";

export const DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_OUT_DIR = "artifacts/trading-promotion-receipt-workspace-fixtures/latest";
export const DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS,
  promotionReceiptValidationRulesFixturesSchemaPath: DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_RULES_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-promotion-receipt-workspace-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-promotion-receipt-workspace-fixtures.v1";
const CAPABILITY_ID = "trading.promotion_receipt_workspace_fixtures";
const PHASE_SLOT = "P406";
const PREVIOUS_PHASE_SLOT = "P405";
const NEXT_PHASE_SLOT = "P407";
const READY_STATUS = "ready_for_trading_promotion_receipt_workspace_regression";
const SOURCE_READY_STATUS = "ready_for_trading_promotion_receipt_validation_rules_regression";

export async function runTradingPromotionReceiptWorkspaceFixtures(options = {}) {
  const result = await buildTradingPromotionReceiptWorkspaceFixtures(options);
  if (options.write !== false) await writeTradingPromotionReceiptWorkspaceFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading promotion receipt workspace fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingPromotionReceiptWorkspaceFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const validationRules = await buildTradingPromotionReceiptValidationRulesFixtures({
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
    promotionReceiptIntakeQueueFixturesSchemaPath: inputs.promotion_receipt_intake_queue_fixtures_schema_path,
    schemaPath: inputs.promotion_receipt_validation_rules_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const workspaceAnchor = buildWorkspaceAnchor(validationRules);
  const workspaceRows = buildWorkspaceRows(validationRules);
  const workspaceBoundary = buildWorkspaceBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    validationRules,
    workspaceRows,
  });
  const workspaceGateRows = buildWorkspaceGateRows({ validationRules, packageJson, platformOpsLedger, workspaceRows, workspaceBoundary });
  const validationItems = buildValidationItems({ validationRules, packageJson, platformOpsLedger, workspaceRows, workspaceGateRows, workspaceBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ validationRules, workspaceRows, workspaceGateRows, workspaceBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_promotion_receipt_workspace_fixtures_id: `trading-promotion-receipt-workspace-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    promotion_receipt_workspace_anchor: workspaceAnchor,
    promotion_receipt_workspace_rows: workspaceRows,
    promotion_receipt_workspace_gate_rows: workspaceGateRows,
    promotion_receipt_workspace_boundary: workspaceBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_promotion_receipt_workspace_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ validationRules, workspaceRows, workspaceGateRows, workspaceBoundary, validation: result.validation });
  result.summary.trading_promotion_receipt_workspace_fixtures_id = result.trading_promotion_receipt_workspace_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingPromotionReceiptWorkspaceFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-promotion-receipt-workspace-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "promotion-receipt-workspace-rows.json"), collectionEnvelope("trading-promotion-receipt-workspace-rows.v1", "promotion_receipt_workspace_rows", result.promotion_receipt_workspace_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-workspace-gate-rows.json"), collectionEnvelope("trading-promotion-receipt-workspace-gate-rows.v1", "promotion_receipt_workspace_gate_rows", result.promotion_receipt_workspace_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-workspace-boundary.json"), result.promotion_receipt_workspace_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-promotion-receipt-workspace-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingPromotionReceiptWorkspaceFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingPromotionReceiptWorkspaceFixtures(args);
    console.log(`Trading promotion receipt workspace fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_promotion_receipt_workspace_fixtures_status}`);
    console.log(`Workspace rows: ${result.summary.ready_workspace_row_count}/${result.summary.workspace_row_count}`);
    console.log(`Receipt input materialized: ${result.summary.receipt_input_file_materialized}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildWorkspaceAnchor(validationRules) {
  return {
    schema_version: "trading-promotion-receipt-workspace-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_validation_rules_fixtures_id: validationRules.trading_promotion_receipt_validation_rules_fixtures_id,
    source_promotion_receipt_validation_rules_status: validationRules.summary.trading_promotion_receipt_validation_rules_fixtures_status,
    source_hash: hashValue({
      id: validationRules.trading_promotion_receipt_validation_rules_fixtures_id,
      status: validationRules.summary.trading_promotion_receipt_validation_rules_fixtures_status,
      rule_rows: validationRules.summary.rule_row_count,
    }),
  };
}

function buildWorkspaceRows(validationRules) {
  const sourceReady = validationRules.validation.valid && validationRules.summary.trading_promotion_receipt_validation_rules_fixtures_status === SOURCE_READY_STATUS;
  return validationRules.promotion_receipt_validation_rule_rows.map((ruleRow, index) => {
    const workspaceStatus = sourceReady && ruleRow.receipt_validation_rule_status === "ready_for_future_receipt_validation" ? "ready_for_human_receipt_input" : "blocked";
    const row = {
      schema_version: "trading-promotion-receipt-workspace-row.v1",
      promotion_receipt_workspace_row_id: `trading-promotion-receipt-workspace.row.${ruleRow.source_queue_row_key}`,
      phase_slot: PHASE_SLOT,
      source_validation_rule_row_id: ruleRow.promotion_receipt_validation_rule_row_id,
      source_queue_row_key: ruleRow.source_queue_row_key,
      from_stage: ruleRow.from_stage,
      to_stage: ruleRow.to_stage,
      receipt_contract_id: ruleRow.receipt_contract_id,
      workspace_status: workspaceStatus,
      source_receipt_validation_rule_status: ruleRow.receipt_validation_rule_status,
      required_receipt_fields: ruleRow.required_receipt_fields,
      allowed_receipt_decisions: ruleRow.allowed_receipt_decisions,
      editable_receipt_fields_declared: true,
      receipt_input_file_materialized: false,
      receipt_payload_present: false,
      ready_for_validation: false,
      receipt_received_by_workspace: false,
      receipt_validated_by_workspace: false,
      receipt_application_performed_by_workspace: false,
      approval_applied_by_workspace: false,
      promotion_enablement_allowed_by_workspace: false,
      live_order_submission_allowed_by_workspace: false,
      live_execution_allowed_by_workspace: false,
      validation_rules_consumed_in_memory: true,
      validation_rules_artifact_read_performed_by_workspace: false,
      command_execution_performed_by_workspace: false,
      artifact_read_performed_by_workspace: false,
      artifact_write_performed_by_workspace: false,
      protected_action_executed_by_workspace: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "promotion_receipt_workspace_hash");
  });
}

function buildWorkspaceBoundary({ generatedAt, writeRequested, validationRules, workspaceRows }) {
  const sourceSummary = validationRules.summary;
  return {
    schema_version: "trading-promotion-receipt-workspace-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    promotion_receipt_workspace_artifact_write_requested: writeRequested,
    promotion_receipt_workspace_execution_performed: false,
    source_promotion_receipt_validation_rules_status: sourceSummary.trading_promotion_receipt_validation_rules_fixtures_status,
    source_promotion_receipt_validation_rules_ready: validationRules.validation.valid && sourceSummary.trading_promotion_receipt_validation_rules_fixtures_status === SOURCE_READY_STATUS,
    workspace_row_count: workspaceRows.length,
    ready_workspace_row_count: workspaceRows.filter((row) => row.workspace_status === "ready_for_human_receipt_input").length,
    validation_rules_consumed_in_memory: true,
    validation_rules_artifact_read_performed: false,
    workspace_rows_declared: true,
    editable_receipt_fields_declared: true,
    receipt_input_file_materialized: false,
    receipt_payload_present: false,
    ready_for_validation: false,
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

function buildWorkspaceGateRows({ validationRules, packageJson, platformOpsLedger, workspaceRows, workspaceBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p405_receipt_validation_rules_ready", "P405 promotion receipt validation rules source is ready.", validationRules.validation.valid && validationRules.summary.trading_promotion_receipt_validation_rules_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P406 trading promotion receipt workspace fixtures command.", typeof scripts["trading:promotion-receipt-workspace-fixtures"] === "string" && scripts["trading:promotion-receipt-workspace-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P406 trading promotion receipt workspace fixtures command.", validateScript.includes("npm run trading:promotion-receipt-workspace-fixtures -- --check")),
    gateRow("p406_ledger_acceptance_declared", "P406 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P406: `trading:promotion-receipt-workspace-fixtures`")),
    gateRow("workspace_rows_ready", "All promotion receipt workspace rows are ready for human input.", workspaceRows.length === 6 && workspaceRows.every((row) => row.workspace_status === "ready_for_human_receipt_input" && row.editable_receipt_fields_declared && !row.receipt_input_file_materialized && !row.receipt_payload_present && !row.ready_for_validation)),
    gateRow("no_receipt_payload_materialization", "Workspace declares editable fields without materializing receipt input files or receiving payloads.", workspaceBoundary.editable_receipt_fields_declared && !workspaceBoundary.receipt_input_file_materialized && !workspaceBoundary.receipt_payload_present && !workspaceBoundary.ready_for_validation && !workspaceBoundary.receipt_received && !workspaceBoundary.receipt_validated && !workspaceBoundary.receipt_application_performed && !workspaceBoundary.approval_applied),
    gateRow("live_and_full_auto_enablement_blocked", "P406 workspace does not enable shadow, limited-live, full-auto, live execution, order submission, broker writes, or exchange writes.", !workspaceBoundary.shadow_live_enabled && !workspaceBoundary.limited_live_enabled && !workspaceBoundary.full_auto_enabled && !workspaceBoundary.automatic_order_submission_allowed && !workspaceBoundary.live_order_submission_allowed && !workspaceBoundary.live_execution_allowed && !workspaceBoundary.broker_write_allowed && !workspaceBoundary.exchange_write_allowed),
    gateRow("no_command_or_artifact_mutation", "P406 workspace does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !workspaceBoundary.command_execution_performed && !workspaceBoundary.artifact_read_performed && !workspaceBoundary.artifact_write_performed && !workspaceBoundary.release_published && !workspaceBoundary.git_operation_performed && !workspaceBoundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "promotion_receipt_workspace_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-promotion-receipt-workspace-gate-row.v1",
    promotion_receipt_workspace_gate_row_id: `trading-promotion-receipt-workspace-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_input_file_materialized_by_workspace: false,
    receipt_payload_present_by_workspace: false,
    ready_for_validation_by_workspace: false,
    receipt_validated_by_workspace: false,
    receipt_application_performed_by_workspace: false,
    approval_applied_by_workspace: false,
    promotion_enablement_allowed_by_workspace: false,
    live_execution_allowed_by_workspace: false,
    protected_action_executed_by_workspace: false,
    human_review_required: true,
  };
}

function buildValidationItems({ validationRules, packageJson, platformOpsLedger, workspaceRows, workspaceGateRows, workspaceBoundary }) {
  return [
    validationItem("source.promotion_receipt_validation_rules", "p405_receipt_validation_rules_ready", validationRules.validation.valid && validationRules.summary.trading_promotion_receipt_validation_rules_fixtures_status === SOURCE_READY_STATUS, "P405 promotion receipt validation rules fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P406 promotion receipt workspace fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("promotion_receipt_workspace_rows", "workspace_rows_ready", workspaceRows.length === 6 && workspaceRows.every((row) => row.workspace_status === "ready_for_human_receipt_input" && row.editable_receipt_fields_declared && !row.receipt_input_file_materialized && !row.receipt_payload_present && !row.ready_for_validation), "Promotion receipt workspace rows must be ready for human input without payloads."),
    validationItem("promotion_receipt_workspace_gate_rows", "workspace_gates_ready", workspaceGateRows.length >= 8 && workspaceGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_workspace && !row.protected_action_executed_by_workspace), "P406 promotion receipt workspace gates are ready."),
    validationItem("boundary.no_receipt_payload", "no_receipt_payload", workspaceBoundary.read_only && workspaceBoundary.report_only && workspaceBoundary.validation_rules_consumed_in_memory && !workspaceBoundary.validation_rules_artifact_read_performed && workspaceBoundary.workspace_rows_declared && workspaceBoundary.editable_receipt_fields_declared && !workspaceBoundary.receipt_input_file_materialized && !workspaceBoundary.receipt_payload_present && !workspaceBoundary.ready_for_validation && !workspaceBoundary.receipt_received && !workspaceBoundary.receipt_validated && !workspaceBoundary.receipt_application_performed && !workspaceBoundary.approval_applied, "Promotion receipt workspace declares human input rows without materializing or validating receipts."),
    validationItem("boundary.no_source_receipt_or_approval", "no_source_receipt_or_approval", !workspaceBoundary.source_receipt_present && !workspaceBoundary.source_approval_applied, "P406 must not inherit pre-applied promotion receipts or approvals."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !workspaceBoundary.command_execution_performed && !workspaceBoundary.package_command_execution_performed && !workspaceBoundary.release_check_execution_performed && !workspaceBoundary.artifact_read_performed && !workspaceBoundary.artifact_write_performed, "Promotion receipt workspace does not execute commands or read/write artifacts."),
    validationItem("boundary.no_trading_mutation", "no_trading_mutation", !workspaceBoundary.shadow_live_enabled && !workspaceBoundary.limited_live_enabled && !workspaceBoundary.full_auto_enabled && !workspaceBoundary.automatic_order_submission_allowed && !workspaceBoundary.live_order_submission_allowed && !workspaceBoundary.live_execution_allowed && !workspaceBoundary.broker_write_allowed && !workspaceBoundary.exchange_write_allowed && !workspaceBoundary.release_published && !workspaceBoundary.git_operation_performed && !workspaceBoundary.protected_action_executed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
  ];
}

function buildSummary({ validationRules, workspaceRows, workspaceGateRows, workspaceBoundary, validation }) {
  return {
    trading_promotion_receipt_workspace_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_validation_rules_status: validationRules.summary.trading_promotion_receipt_validation_rules_fixtures_status,
    source_promotion_receipt_validation_rules_ready: workspaceBoundary.source_promotion_receipt_validation_rules_ready,
    workspace_row_count: workspaceRows.length,
    ready_workspace_row_count: workspaceBoundary.ready_workspace_row_count,
    gate_count: workspaceGateRows.length,
    ready_gate_count: workspaceGateRows.filter((row) => row.gate_status === "ready").length,
    validation_rules_consumed_in_memory: workspaceBoundary.validation_rules_consumed_in_memory,
    validation_rules_artifact_read_performed: workspaceBoundary.validation_rules_artifact_read_performed,
    workspace_rows_declared: workspaceBoundary.workspace_rows_declared,
    editable_receipt_fields_declared: workspaceBoundary.editable_receipt_fields_declared,
    receipt_input_file_materialized: workspaceBoundary.receipt_input_file_materialized,
    receipt_payload_present: workspaceBoundary.receipt_payload_present,
    ready_for_validation: workspaceBoundary.ready_for_validation,
    receipt_received: workspaceBoundary.receipt_received,
    receipt_validated: workspaceBoundary.receipt_validated,
    receipt_application_performed: workspaceBoundary.receipt_application_performed,
    approval_applied: workspaceBoundary.approval_applied,
    source_receipt_present: workspaceBoundary.source_receipt_present,
    source_approval_applied: workspaceBoundary.source_approval_applied,
    real_enablement_count: workspaceBoundary.real_enablement_count,
    shadow_live_enabled: workspaceBoundary.shadow_live_enabled,
    limited_live_enabled: workspaceBoundary.limited_live_enabled,
    full_auto_enabled: workspaceBoundary.full_auto_enabled,
    automatic_order_submission_allowed: workspaceBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: workspaceBoundary.live_order_submission_allowed,
    live_promotion_allowed: workspaceBoundary.live_promotion_allowed,
    live_execution_allowed: workspaceBoundary.live_execution_allowed,
    broker_write_allowed: workspaceBoundary.broker_write_allowed,
    exchange_write_allowed: workspaceBoundary.exchange_write_allowed,
    command_execution_performed: workspaceBoundary.command_execution_performed,
    package_command_execution_performed: workspaceBoundary.package_command_execution_performed,
    release_check_execution_performed: workspaceBoundary.release_check_execution_performed,
    artifact_read_performed: workspaceBoundary.artifact_read_performed,
    artifact_write_performed: workspaceBoundary.artifact_write_performed,
    release_published: workspaceBoundary.release_published,
    git_operation_performed: workspaceBoundary.git_operation_performed,
    protected_action_executed: workspaceBoundary.protected_action_executed,
    human_review_required: workspaceBoundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Promotion Receipt Workspace Fixtures",
    "",
    `Status: ${result.summary.trading_promotion_receipt_workspace_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source validation rules: ${result.summary.source_promotion_receipt_validation_rules_status}`,
    `Workspace rows: ${result.summary.ready_workspace_row_count}/${result.summary.workspace_row_count}`,
    `Receipt input materialized: ${result.summary.receipt_input_file_materialized}`,
    "",
    "## Workspace Rows",
    "",
    ...result.promotion_receipt_workspace_rows.map((row) => `- ${row.source_queue_row_key}: ${row.workspace_status}`),
    "",
    "## Gates",
    "",
    ...result.promotion_receipt_workspace_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_OUT_DIR };
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
    else if (arg === "--promotion-receipt-validation-rules-fixtures-schema") parsed.promotionReceiptValidationRulesFixturesSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/trading-promotion-receipt-workspace-fixtures.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_OUT_DIR}
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
  --promotion-receipt-validation-rules-fixtures-schema <path>
                                           P405 promotion receipt validation rules fixtures schema path.
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.platformOpsLedgerPath),
    trading_sample_path: path.resolve(options.tradingSamplePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.tradingSamplePath),
    backtest_validation_path: path.resolve(options.backtestValidationPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.backtestValidationPath),
    model_degradation_halt_fixtures_schema_path: path.resolve(options.modelDegradationHaltFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.modelDegradationHaltFixturesSchemaPath),
    data_outage_halt_fixtures_schema_path: path.resolve(options.dataOutageHaltFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.dataOutageHaltFixturesSchemaPath),
    promotion_receipt_contract_fixtures_schema_path: path.resolve(options.promotionReceiptContractFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.promotionReceiptContractFixturesSchemaPath),
    promotion_completion_gate_fixtures_schema_path: path.resolve(options.promotionCompletionGateFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.promotionCompletionGateFixturesSchemaPath),
    promotion_governance_readonly_fixtures_schema_path: path.resolve(options.promotionGovernanceReadonlyFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.promotionGovernanceReadonlyFixturesSchemaPath),
    promotion_receipt_intake_queue_fixtures_schema_path: path.resolve(options.promotionReceiptIntakeQueueFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.promotionReceiptIntakeQueueFixturesSchemaPath),
    promotion_receipt_validation_rules_fixtures_schema_path: path.resolve(options.promotionReceiptValidationRulesFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.promotionReceiptValidationRulesFixturesSchemaPath),
    limited_live_path: path.resolve(options.limitedLivePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.limitedLivePath),
    full_auto_path: path.resolve(options.fullAutoPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.fullAutoPath),
    paper_shadow_path: path.resolve(options.paperShadowPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.paperShadowPath),
    execution_engine_path: path.resolve(options.executionEnginePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.executionEnginePath),
    risk_engine_path: path.resolve(options.riskEnginePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.riskEnginePath),
    signal_engine_path: path.resolve(options.signalEnginePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.signalEnginePath),
    model_improvement_path: path.resolve(options.modelImprovementPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.modelImprovementPath),
    research_backtest_paper_path: path.resolve(options.researchBacktestPaperPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.researchBacktestPaperPath),
    market_data_feature_store_path: path.resolve(options.marketDataFeatureStorePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.marketDataFeatureStorePath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.schemaPath),
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
