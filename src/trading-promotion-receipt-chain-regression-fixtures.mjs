import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_PROMOTION_RECEIPT_CLOSEOUT_FIXTURES_INPUTS,
  buildTradingPromotionReceiptCloseoutFixtures,
} from "./trading-promotion-receipt-closeout-fixtures.mjs";

export const DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REGRESSION_FIXTURES_OUT_DIR = "artifacts/trading-promotion-receipt-chain-regression-fixtures/latest";
export const DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_PROMOTION_RECEIPT_CLOSEOUT_FIXTURES_INPUTS,
  promotionReceiptCloseoutFixturesSchemaPath: DEFAULT_TRADING_PROMOTION_RECEIPT_CLOSEOUT_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-promotion-receipt-chain-regression-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-promotion-receipt-chain-regression-fixtures.v1";
const CAPABILITY_ID = "trading.promotion_receipt_chain_regression_fixtures";
const PHASE_SLOT = "P413";
const PREVIOUS_PHASE_SLOT = "P412";
const NEXT_PHASE_SLOT = "P414";
const READY_STATUS = "ready_for_trading_promotion_receipt_chain_regression";
const SOURCE_READY_STATUS = "ready_for_trading_promotion_receipt_chain_closeout_regression";
const CHAIN_PHASE_READY_STATUS = "ready_for_trading_promotion_receipt_chain_regression";

const CHAIN_PHASES = [
  ["P401", "trading:promotion-receipt-contract-fixtures", "workflow.trading.promotion_receipt_contract_fixtures.v1"],
  ["P402", "trading:promotion-completion-gate-fixtures", "workflow.trading.promotion_completion_gate_fixtures.v1"],
  ["P403", "trading:promotion-governance-readonly-fixtures", "workflow.trading.promotion_governance_readonly_fixtures.v1"],
  ["P404", "trading:promotion-receipt-intake-queue-fixtures", "workflow.trading.promotion_receipt_intake_queue_fixtures.v1"],
  ["P405", "trading:promotion-receipt-validation-rules-fixtures", "workflow.trading.promotion_receipt_validation_rules_fixtures.v1"],
  ["P406", "trading:promotion-receipt-workspace-fixtures", "workflow.trading.promotion_receipt_workspace_fixtures.v1"],
  ["P407", "trading:promotion-receipt-workspace-merge-fixtures", "workflow.trading.promotion_receipt_workspace_merge_fixtures.v1"],
  ["P408", "trading:promotion-receipt-merge-preflight-fixtures", "workflow.trading.promotion_receipt_merge_preflight_fixtures.v1"],
  ["P409", "trading:promotion-receipt-validation-packet-fixtures", "workflow.trading.promotion_receipt_validation_packet_fixtures.v1"],
  ["P410", "trading:promotion-receipt-approval-plan-fixtures", "workflow.trading.promotion_receipt_approval_plan_fixtures.v1"],
  ["P411", "trading:promotion-receipt-approval-closeout-fixtures", "workflow.trading.promotion_receipt_approval_closeout_fixtures.v1"],
  ["P412", "trading:promotion-receipt-closeout-fixtures", "workflow.trading.promotion_receipt_closeout_fixtures.v1"],
].map(([phaseSlot, packageScriptName, workflowId]) => ({ phaseSlot, packageScriptName, workflowId }));

export async function runTradingPromotionReceiptChainRegressionFixtures(options = {}) {
  const result = await buildTradingPromotionReceiptChainRegressionFixtures(options);
  if (options.write !== false) await writeTradingPromotionReceiptChainRegressionFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading promotion receipt chain regression fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingPromotionReceiptChainRegressionFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REGRESSION_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const receiptCloseout = await buildTradingPromotionReceiptCloseoutFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    promotionReceiptWorkspaceFixturesSchemaPath: inputs.promotion_receipt_workspace_fixtures_schema_path,
    promotionReceiptWorkspaceMergeFixturesSchemaPath: inputs.promotion_receipt_workspace_merge_fixtures_schema_path,
    promotionReceiptMergePreflightFixturesSchemaPath: inputs.promotion_receipt_merge_preflight_fixtures_schema_path,
    promotionReceiptValidationPacketFixturesSchemaPath: inputs.promotion_receipt_validation_packet_fixtures_schema_path,
    promotionReceiptApprovalPlanFixturesSchemaPath: inputs.promotion_receipt_approval_plan_fixtures_schema_path,
    promotionReceiptApprovalCloseoutFixturesSchemaPath: inputs.promotion_receipt_approval_closeout_fixtures_schema_path,
    schemaPath: inputs.promotion_receipt_closeout_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const chainAnchor = buildChainAnchor(receiptCloseout);
  const chainRows = buildChainRows({ receiptCloseout, packageJson, platformOpsLedger });
  const chainBoundary = buildChainBoundary({ generatedAt, writeRequested: options.write !== false, receiptCloseout, chainRows });
  const chainGateRows = buildChainGateRows({ receiptCloseout, packageJson, platformOpsLedger, chainRows, chainBoundary });
  const validationItems = buildValidationItems({ receiptCloseout, packageJson, platformOpsLedger, chainRows, chainGateRows, chainBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ receiptCloseout, chainRows, chainGateRows, chainBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_promotion_receipt_chain_regression_fixtures_id: `trading-promotion-receipt-chain-regression-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    promotion_receipt_chain_regression_anchor: chainAnchor,
    promotion_receipt_chain_regression_rows: chainRows,
    promotion_receipt_chain_regression_gate_rows: chainGateRows,
    promotion_receipt_chain_regression_boundary: chainBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_promotion_receipt_chain_regression_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ receiptCloseout, chainRows, chainGateRows, chainBoundary, validation: result.validation });
  result.summary.trading_promotion_receipt_chain_regression_fixtures_id = result.trading_promotion_receipt_chain_regression_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingPromotionReceiptChainRegressionFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-promotion-receipt-chain-regression-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "promotion-receipt-chain-regression-rows.json"), collectionEnvelope("trading-promotion-receipt-chain-regression-rows.v1", "promotion_receipt_chain_regression_rows", result.promotion_receipt_chain_regression_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-chain-regression-gate-rows.json"), collectionEnvelope("trading-promotion-receipt-chain-regression-gate-rows.v1", "promotion_receipt_chain_regression_gate_rows", result.promotion_receipt_chain_regression_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-chain-regression-boundary.json"), result.promotion_receipt_chain_regression_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-promotion-receipt-chain-regression-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingPromotionReceiptChainRegressionFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingPromotionReceiptChainRegressionFixtures(args);
    console.log(`Trading promotion receipt chain regression fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_promotion_receipt_chain_regression_fixtures_status}`);
    console.log(`Chain phases: ${result.summary.ready_chain_phase_count}/${result.summary.chain_phase_count}`);
    console.log(`Chain gates: ${result.summary.ready_chain_gate_count}/${result.summary.chain_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildChainAnchor(receiptCloseout) {
  return {
    schema_version: "trading-promotion-receipt-chain-regression-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_closeout_fixtures_id: receiptCloseout.trading_promotion_receipt_closeout_fixtures_id,
    source_promotion_receipt_closeout_status: receiptCloseout.summary.trading_promotion_receipt_closeout_fixtures_status,
    source_hash: hashValue({
      id: receiptCloseout.trading_promotion_receipt_closeout_fixtures_id,
      status: receiptCloseout.summary.trading_promotion_receipt_closeout_fixtures_status,
      receipt_closeout_rows: receiptCloseout.summary.receipt_closeout_row_count,
      receipt_closeout_gate_rows: receiptCloseout.summary.receipt_closeout_gate_count,
    }),
  };
}

function buildChainRows({ receiptCloseout, packageJson, platformOpsLedger }) {
  const sourceReady = receiptCloseout.validation.valid && receiptCloseout.summary.trading_promotion_receipt_closeout_fixtures_status === SOURCE_READY_STATUS;
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  return CHAIN_PHASES.map((phase, index) => {
    const scriptRegistered = typeof scripts[phase.packageScriptName] === "string" && scripts[phase.packageScriptName].length > 0;
    const validationChainRegistered = validateScript.includes(`npm run ${phase.packageScriptName} -- --check`);
    const ledgerAcceptanceDeclared = ledgerText.includes(`${phase.phaseSlot}: \`${phase.packageScriptName}\``);
    const rowReady = sourceReady && scriptRegistered && validationChainRegistered && ledgerAcceptanceDeclared;
    const row = {
      schema_version: "trading-promotion-receipt-chain-regression-row.v1",
      promotion_receipt_chain_regression_row_id: `trading-promotion-receipt-chain-regression.row.${phase.phaseSlot.toLowerCase()}`,
      phase_slot: PHASE_SLOT,
      source_phase_slot: phase.phaseSlot,
      package_script_name: phase.packageScriptName,
      workflow_id: phase.workflowId,
      chain_phase_status: rowReady ? CHAIN_PHASE_READY_STATUS : "blocked",
      source_receipt_closeout_status: receiptCloseout.summary.trading_promotion_receipt_closeout_fixtures_status,
      source_promotion_receipt_closeout_status: receiptCloseout.summary.trading_promotion_receipt_closeout_fixtures_status,
      script_registered: scriptRegistered,
      validation_chain_registered: validationChainRegistered,
      ledger_acceptance_declared: ledgerAcceptanceDeclared,
      receipt_chain_regression_declared: true,
      p401_p412_chain_ready: receiptCloseout.summary.p401_p412_chain_ready === true,
      human_receipts_pending: receiptCloseout.summary.human_receipts_pending === true,
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
      promotion_enablement_allowed_by_regression: false,
      command_execution_performed_by_regression: false,
      artifact_read_performed_by_regression: false,
      artifact_write_performed_by_regression: false,
      protected_action_executed_by_regression: false,
      automatic_order_submission_allowed_by_regression: false,
      live_execution_allowed_by_regression: false,
      broker_write_allowed_by_regression: false,
      exchange_write_allowed_by_regression: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "promotion_receipt_chain_regression_hash");
  });
}

function buildChainBoundary({ generatedAt, writeRequested, receiptCloseout, chainRows }) {
  const sourceSummary = receiptCloseout.summary;
  const sourceReady = receiptCloseout.validation.valid && sourceSummary.trading_promotion_receipt_closeout_fixtures_status === SOURCE_READY_STATUS;
  return {
    schema_version: "trading-promotion-receipt-chain-regression-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    promotion_receipt_chain_regression_artifact_write_requested: writeRequested,
    source_promotion_receipt_closeout_status: sourceSummary.trading_promotion_receipt_closeout_fixtures_status,
    source_promotion_receipt_closeout_ready: sourceReady,
    chain_phase_count: chainRows.length,
    ready_chain_phase_count: chainRows.filter((row) => row.chain_phase_status === CHAIN_PHASE_READY_STATUS).length,
    receipt_closeout_consumed_in_memory: true,
    receipt_closeout_artifact_read_performed: false,
    receipt_chain_regression_declared: true,
    p401_p412_chain_ready: sourceSummary.p401_p412_chain_ready,
    human_receipts_pending: sourceSummary.human_receipts_pending,
    actor_workspace_input_present: false,
    receipt_input_file_materialized: false,
    merged_receipt_input_materialized: false,
    receipt_payload_present: false,
    ready_for_validation: false,
    ready_for_approval_application: false,
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

function buildChainGateRows({ receiptCloseout, packageJson, platformOpsLedger, chainRows, chainBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p412_receipt_closeout_ready", "P412 promotion receipt closeout source is ready.", receiptCloseout.validation.valid && receiptCloseout.summary.trading_promotion_receipt_closeout_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P413 trading promotion receipt chain regression fixtures command.", typeof scripts["trading:promotion-receipt-chain-regression-fixtures"] === "string" && scripts["trading:promotion-receipt-chain-regression-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P413 trading promotion receipt chain regression fixtures command.", validateScript.includes("npm run trading:promotion-receipt-chain-regression-fixtures -- --check")),
    gateRow("p413_ledger_acceptance_declared", "P413 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P413: `trading:promotion-receipt-chain-regression-fixtures`")),
    gateRow("p401_p412_scripts_registered", "Every P401-P412 promotion receipt command is registered in package.json.", chainRows.length === CHAIN_PHASES.length && chainRows.every((row) => row.script_registered)),
    gateRow("p401_p412_validation_chain_registered", "Every P401-P412 promotion receipt command is present in npm run validate.", chainRows.length === CHAIN_PHASES.length && chainRows.every((row) => row.validation_chain_registered)),
    gateRow("p401_p412_ledger_acceptance_declared", "Every P401-P412 promotion receipt acceptance row is present in the platform operations ledger.", chainRows.length === CHAIN_PHASES.length && chainRows.every((row) => row.ledger_acceptance_declared)),
    gateRow("receipt_chain_rows_ready", "Every P401-P412 promotion receipt chain regression row is ready.", chainRows.length === CHAIN_PHASES.length && chainRows.every((row) => row.chain_phase_status === CHAIN_PHASE_READY_STATUS && row.receipt_chain_regression_declared && row.p401_p412_chain_ready && row.human_receipts_pending)),
    gateRow("no_receipt_or_trading_mutation", "P413 does not receive, validate, apply, enable, execute, or mutate trading state.", !chainBoundary.actor_workspace_input_present && !chainBoundary.receipt_payload_present && !chainBoundary.ready_for_validation && !chainBoundary.ready_for_approval_application && !chainBoundary.receipt_received && !chainBoundary.receipt_validated && !chainBoundary.receipt_application_performed && !chainBoundary.approval_applied && !chainBoundary.shadow_live_enabled && !chainBoundary.limited_live_enabled && !chainBoundary.full_auto_enabled && !chainBoundary.automatic_order_submission_allowed && !chainBoundary.live_order_submission_allowed && !chainBoundary.live_promotion_allowed && !chainBoundary.live_execution_allowed && !chainBoundary.broker_write_allowed && !chainBoundary.exchange_write_allowed && !chainBoundary.command_execution_performed && !chainBoundary.artifact_read_performed && !chainBoundary.artifact_write_performed && !chainBoundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "promotion_receipt_chain_regression_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-promotion-receipt-chain-regression-gate-row.v1",
    promotion_receipt_chain_regression_gate_row_id: `trading-promotion-receipt-chain-regression-fixtures.gate.${rowKey}`,
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
    promotion_enablement_allowed_by_regression: false,
    command_execution_performed_by_regression: false,
    artifact_read_performed_by_regression: false,
    artifact_write_performed_by_regression: false,
    protected_action_executed_by_regression: false,
    automatic_order_submission_allowed_by_regression: false,
    live_execution_allowed_by_regression: false,
    broker_write_allowed_by_regression: false,
    exchange_write_allowed_by_regression: false,
    human_review_required: true,
  };
}

function buildValidationItems({ receiptCloseout, packageJson, platformOpsLedger, chainRows, chainGateRows, chainBoundary }) {
  return [
    validationItem("source.promotion_receipt_closeout", "p412_receipt_closeout_ready", receiptCloseout.validation.valid && receiptCloseout.summary.trading_promotion_receipt_closeout_fixtures_status === SOURCE_READY_STATUS, "P412 promotion receipt closeout fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P413 promotion receipt chain regression fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("promotion_receipt_chain_regression_rows", "chain_regression_rows_ready", chainRows.length === CHAIN_PHASES.length && chainRows.every((row) => row.chain_phase_status === CHAIN_PHASE_READY_STATUS && row.script_registered && row.validation_chain_registered && row.ledger_acceptance_declared && row.receipt_chain_regression_declared && row.p401_p412_chain_ready && row.human_receipts_pending && !row.receipt_payload_present && !row.approval_applied_by_regression), "P401-P412 promotion receipt chain rows must be ready and registered."),
    validationItem("promotion_receipt_chain_regression_gate_rows", "chain_regression_gates_ready", chainGateRows.length >= 9 && chainGateRows.every((row) => row.gate_status === "ready" && !row.approval_applied_by_regression && !row.protected_action_executed_by_regression), "P413 promotion receipt chain regression gates are ready."),
    validationItem("boundary.no_receipt_or_trading_mutation", "no_receipt_or_trading_mutation", chainBoundary.read_only && chainBoundary.report_only && chainBoundary.receipt_closeout_consumed_in_memory && !chainBoundary.receipt_closeout_artifact_read_performed && chainBoundary.receipt_chain_regression_declared && chainBoundary.p401_p412_chain_ready && chainBoundary.human_receipts_pending && !chainBoundary.actor_workspace_input_present && !chainBoundary.receipt_input_file_materialized && !chainBoundary.merged_receipt_input_materialized && !chainBoundary.receipt_payload_present && !chainBoundary.ready_for_validation && !chainBoundary.ready_for_approval_application && !chainBoundary.receipt_received && !chainBoundary.receipt_validated && !chainBoundary.receipt_application_performed && !chainBoundary.approval_applied && !chainBoundary.shadow_live_enabled && !chainBoundary.limited_live_enabled && !chainBoundary.full_auto_enabled && !chainBoundary.automatic_order_submission_allowed && !chainBoundary.live_order_submission_allowed && !chainBoundary.live_promotion_allowed && !chainBoundary.live_execution_allowed && !chainBoundary.broker_write_allowed && !chainBoundary.exchange_write_allowed && !chainBoundary.command_execution_performed && !chainBoundary.artifact_read_performed && !chainBoundary.artifact_write_performed && !chainBoundary.protected_action_executed, "Promotion receipt chain regression remains read-only and non-mutating."),
    validationItem("boundary.no_source_receipt_or_approval", "no_source_receipt_or_approval", !chainBoundary.source_receipt_present && !chainBoundary.source_approval_applied, "P413 must not inherit pre-applied promotion receipts or approvals."),
  ];
}

function buildSummary({ receiptCloseout, chainRows, chainGateRows, chainBoundary, validation }) {
  return {
    trading_promotion_receipt_chain_regression_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_closeout_status: receiptCloseout.summary.trading_promotion_receipt_closeout_fixtures_status,
    source_promotion_receipt_closeout_ready: chainBoundary.source_promotion_receipt_closeout_ready,
    chain_phase_count: chainRows.length,
    ready_chain_phase_count: chainBoundary.ready_chain_phase_count,
    chain_gate_count: chainGateRows.length,
    ready_chain_gate_count: chainGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: chainBoundary.read_only,
    report_only: chainBoundary.report_only,
    receipt_closeout_consumed_in_memory: chainBoundary.receipt_closeout_consumed_in_memory,
    receipt_closeout_artifact_read_performed: chainBoundary.receipt_closeout_artifact_read_performed,
    receipt_chain_regression_declared: chainBoundary.receipt_chain_regression_declared,
    p401_p412_chain_ready: chainBoundary.p401_p412_chain_ready,
    human_receipts_pending: chainBoundary.human_receipts_pending,
    actor_workspace_input_present: chainBoundary.actor_workspace_input_present,
    receipt_input_file_materialized: chainBoundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: chainBoundary.merged_receipt_input_materialized,
    receipt_payload_present: chainBoundary.receipt_payload_present,
    ready_for_validation: chainBoundary.ready_for_validation,
    ready_for_approval_application: chainBoundary.ready_for_approval_application,
    receipt_received: chainBoundary.receipt_received,
    receipt_validated: chainBoundary.receipt_validated,
    receipt_application_performed: chainBoundary.receipt_application_performed,
    approval_applied: chainBoundary.approval_applied,
    source_receipt_present: chainBoundary.source_receipt_present,
    source_approval_applied: chainBoundary.source_approval_applied,
    real_enablement_count: chainBoundary.real_enablement_count,
    shadow_live_enabled: chainBoundary.shadow_live_enabled,
    limited_live_enabled: chainBoundary.limited_live_enabled,
    full_auto_enabled: chainBoundary.full_auto_enabled,
    automatic_order_submission_allowed: chainBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: chainBoundary.live_order_submission_allowed,
    live_promotion_allowed: chainBoundary.live_promotion_allowed,
    live_execution_allowed: chainBoundary.live_execution_allowed,
    broker_write_allowed: chainBoundary.broker_write_allowed,
    exchange_write_allowed: chainBoundary.exchange_write_allowed,
    command_execution_performed: chainBoundary.command_execution_performed,
    package_command_execution_performed: chainBoundary.package_command_execution_performed,
    release_check_execution_performed: chainBoundary.release_check_execution_performed,
    artifact_read_performed: chainBoundary.artifact_read_performed,
    artifact_write_performed: chainBoundary.artifact_write_performed,
    release_published: chainBoundary.release_published,
    git_operation_performed: chainBoundary.git_operation_performed,
    protected_action_executed: chainBoundary.protected_action_executed,
    human_review_required: chainBoundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Promotion Receipt Chain Regression Fixtures",
    "",
    `Status: ${result.summary.trading_promotion_receipt_chain_regression_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source receipt closeout: ${result.summary.source_promotion_receipt_closeout_status}`,
    `Chain phases: ${result.summary.ready_chain_phase_count}/${result.summary.chain_phase_count}`,
    `Chain gates: ${result.summary.ready_chain_gate_count}/${result.summary.chain_gate_count}`,
    "",
    "## Chain Rows",
    "",
    ...result.promotion_receipt_chain_regression_rows.map((row) => `- ${row.source_phase_slot} ${row.package_script_name}: ${row.chain_phase_status}`),
    "",
    "## Gates",
    "",
    ...result.promotion_receipt_chain_regression_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REGRESSION_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--promotion-receipt-workspace-fixtures-schema") parsed.promotionReceiptWorkspaceFixturesSchemaPath = argv[++index];
    else if (arg === "--promotion-receipt-workspace-merge-fixtures-schema") parsed.promotionReceiptWorkspaceMergeFixturesSchemaPath = argv[++index];
    else if (arg === "--promotion-receipt-merge-preflight-fixtures-schema") parsed.promotionReceiptMergePreflightFixturesSchemaPath = argv[++index];
    else if (arg === "--promotion-receipt-validation-packet-fixtures-schema") parsed.promotionReceiptValidationPacketFixturesSchemaPath = argv[++index];
    else if (arg === "--promotion-receipt-approval-plan-fixtures-schema") parsed.promotionReceiptApprovalPlanFixturesSchemaPath = argv[++index];
    else if (arg === "--promotion-receipt-approval-closeout-fixtures-schema") parsed.promotionReceiptApprovalCloseoutFixturesSchemaPath = argv[++index];
    else if (arg === "--promotion-receipt-closeout-fixtures-schema") parsed.promotionReceiptCloseoutFixturesSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-promotion-receipt-chain-regression-fixtures.mjs [options]

Options:
  --out-dir <folder>                         Output directory. Default: ${DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REGRESSION_FIXTURES_OUT_DIR}
  --run-at <iso>                             Deterministic generated_at timestamp.
  --package <path>                           package.json path.
  --platform-ops-ledger <path>               P341-P500 platform operations ledger path.
  --promotion-receipt-workspace-fixtures-schema <path>
                                             P406 promotion receipt workspace fixtures schema path.
  --promotion-receipt-workspace-merge-fixtures-schema <path>
                                             P407 promotion receipt workspace merge fixtures schema path.
  --promotion-receipt-merge-preflight-fixtures-schema <path>
                                             P408 promotion receipt merge preflight fixtures schema path.
  --promotion-receipt-validation-packet-fixtures-schema <path>
                                             P409 promotion receipt validation packet fixtures schema path.
  --promotion-receipt-approval-plan-fixtures-schema <path>
                                             P410 promotion receipt approval plan fixtures schema path.
  --promotion-receipt-approval-closeout-fixtures-schema <path>
                                             P411 promotion receipt approval closeout fixtures schema path.
  --promotion-receipt-closeout-fixtures-schema <path>
                                             P412 promotion receipt closeout fixtures schema path.
  --schema <path>                            Output schema path.
  --check                                    Validate only, do not write artifacts.
  -h, --help                                 Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.platformOpsLedgerPath),
    promotion_receipt_workspace_fixtures_schema_path: path.resolve(options.promotionReceiptWorkspaceFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.promotionReceiptWorkspaceFixturesSchemaPath),
    promotion_receipt_workspace_merge_fixtures_schema_path: path.resolve(options.promotionReceiptWorkspaceMergeFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.promotionReceiptWorkspaceMergeFixturesSchemaPath),
    promotion_receipt_merge_preflight_fixtures_schema_path: path.resolve(options.promotionReceiptMergePreflightFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.promotionReceiptMergePreflightFixturesSchemaPath),
    promotion_receipt_validation_packet_fixtures_schema_path: path.resolve(options.promotionReceiptValidationPacketFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.promotionReceiptValidationPacketFixturesSchemaPath),
    promotion_receipt_approval_plan_fixtures_schema_path: path.resolve(options.promotionReceiptApprovalPlanFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.promotionReceiptApprovalPlanFixturesSchemaPath),
    promotion_receipt_approval_closeout_fixtures_schema_path: path.resolve(options.promotionReceiptApprovalCloseoutFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.promotionReceiptApprovalCloseoutFixturesSchemaPath),
    promotion_receipt_closeout_fixtures_schema_path: path.resolve(options.promotionReceiptCloseoutFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.promotionReceiptCloseoutFixturesSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.schemaPath),
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
