import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS,
  buildTradingPromotionReceiptChainRegressionFixtures,
} from "./trading-promotion-receipt-chain-regression-fixtures.mjs";

export const DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REVIEW_FIXTURES_OUT_DIR = "artifacts/trading-promotion-receipt-chain-review-fixtures/latest";
export const DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS,
  promotionReceiptChainRegressionFixturesSchemaPath: DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REGRESSION_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-promotion-receipt-chain-review-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-promotion-receipt-chain-review-fixtures.v1";
const CAPABILITY_ID = "trading.promotion_receipt_chain_review_fixtures";
const PHASE_SLOT = "P414";
const PREVIOUS_PHASE_SLOT = "P413";
const NEXT_PHASE_SLOT = "P415";
const READY_STATUS = "ready_for_trading_promotion_receipt_chain_review";
const SOURCE_READY_STATUS = "ready_for_trading_promotion_receipt_chain_regression";
const SOURCE_CHAIN_PHASE_READY_STATUS = "ready_for_trading_promotion_receipt_chain_regression";
const CHAIN_REVIEW_READY_STATUS = "ready_for_trading_promotion_receipt_chain_human_review";
const CHAIN_REVIEW_CHECKS = [
  "p413_regression_ready",
  "source_phase_script_registered",
  "source_phase_validation_chain_registered",
  "source_phase_ledger_acceptance_declared",
  "review_packet_declared",
  "human_review_pending",
  "receipt_payload_absent",
  "trading_mutation_disabled",
];

export async function runTradingPromotionReceiptChainReviewFixtures(options = {}) {
  const result = await buildTradingPromotionReceiptChainReviewFixtures(options);
  if (options.write !== false) await writeTradingPromotionReceiptChainReviewFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading promotion receipt chain review fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingPromotionReceiptChainReviewFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REVIEW_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const chainRegression = await buildTradingPromotionReceiptChainRegressionFixtures({
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
    promotionReceiptCloseoutFixturesSchemaPath: inputs.promotion_receipt_closeout_fixtures_schema_path,
    schemaPath: inputs.promotion_receipt_chain_regression_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const reviewAnchor = buildReviewAnchor(chainRegression);
  const reviewRows = buildReviewRows(chainRegression);
  const reviewBoundary = buildReviewBoundary({ generatedAt, writeRequested: options.write !== false, chainRegression, reviewRows });
  const reviewGateRows = buildReviewGateRows({ chainRegression, packageJson, platformOpsLedger, reviewRows, reviewBoundary });
  const validationItems = buildValidationItems({ chainRegression, packageJson, platformOpsLedger, reviewRows, reviewGateRows, reviewBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ chainRegression, reviewRows, reviewGateRows, reviewBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_promotion_receipt_chain_review_fixtures_id: `trading-promotion-receipt-chain-review-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    promotion_receipt_chain_review_anchor: reviewAnchor,
    promotion_receipt_chain_review_rows: reviewRows,
    promotion_receipt_chain_review_gate_rows: reviewGateRows,
    promotion_receipt_chain_review_boundary: reviewBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_promotion_receipt_chain_review_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ chainRegression, reviewRows, reviewGateRows, reviewBoundary, validation: result.validation });
  result.summary.trading_promotion_receipt_chain_review_fixtures_id = result.trading_promotion_receipt_chain_review_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingPromotionReceiptChainReviewFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-promotion-receipt-chain-review-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "promotion-receipt-chain-review-rows.json"), collectionEnvelope("trading-promotion-receipt-chain-review-rows.v1", "promotion_receipt_chain_review_rows", result.promotion_receipt_chain_review_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-chain-review-gate-rows.json"), collectionEnvelope("trading-promotion-receipt-chain-review-gate-rows.v1", "promotion_receipt_chain_review_gate_rows", result.promotion_receipt_chain_review_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-chain-review-boundary.json"), result.promotion_receipt_chain_review_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-promotion-receipt-chain-review-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingPromotionReceiptChainReviewFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingPromotionReceiptChainReviewFixtures(args);
    console.log(`Trading promotion receipt chain review fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_promotion_receipt_chain_review_fixtures_status}`);
    console.log(`Review rows: ${result.summary.ready_chain_review_row_count}/${result.summary.chain_review_row_count}`);
    console.log(`Review gates: ${result.summary.ready_chain_review_gate_count}/${result.summary.chain_review_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildReviewAnchor(chainRegression) {
  return {
    schema_version: "trading-promotion-receipt-chain-review-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_chain_regression_fixtures_id: chainRegression.trading_promotion_receipt_chain_regression_fixtures_id,
    source_promotion_receipt_chain_regression_status: chainRegression.summary.trading_promotion_receipt_chain_regression_fixtures_status,
    source_hash: hashValue({
      id: chainRegression.trading_promotion_receipt_chain_regression_fixtures_id,
      status: chainRegression.summary.trading_promotion_receipt_chain_regression_fixtures_status,
      chain_rows: chainRegression.summary.chain_phase_count,
      chain_gate_rows: chainRegression.summary.chain_gate_count,
    }),
  };
}

function buildReviewRows(chainRegression) {
  const sourceReady = chainRegression.validation.valid && chainRegression.summary.trading_promotion_receipt_chain_regression_fixtures_status === SOURCE_READY_STATUS;
  return chainRegression.promotion_receipt_chain_regression_rows.map((sourceRow, index) => {
    const reviewReady = sourceReady && sourceRow.chain_phase_status === SOURCE_CHAIN_PHASE_READY_STATUS;
    const row = {
      schema_version: "trading-promotion-receipt-chain-review-row.v1",
      promotion_receipt_chain_review_row_id: `trading-promotion-receipt-chain-review.row.${sourceRow.source_phase_slot.toLowerCase()}`,
      phase_slot: PHASE_SLOT,
      source_chain_regression_row_id: sourceRow.promotion_receipt_chain_regression_row_id,
      source_phase_slot: sourceRow.source_phase_slot,
      package_script_name: sourceRow.package_script_name,
      workflow_id: sourceRow.workflow_id,
      chain_review_status: reviewReady ? CHAIN_REVIEW_READY_STATUS : "blocked",
      source_chain_phase_status: sourceRow.chain_phase_status,
      source_promotion_receipt_chain_regression_status: chainRegression.summary.trading_promotion_receipt_chain_regression_fixtures_status,
      script_registered: sourceRow.script_registered,
      validation_chain_registered: sourceRow.validation_chain_registered,
      ledger_acceptance_declared: sourceRow.ledger_acceptance_declared,
      receipt_chain_regression_declared: sourceRow.receipt_chain_regression_declared,
      promotion_receipt_chain_review_declared: true,
      reviewer_role: "trading_control_operator",
      required_review_decision: "human_review_required_before_receipt_collection",
      review_completed: false,
      review_approval_applied: false,
      p401_p412_chain_ready: sourceRow.p401_p412_chain_ready,
      human_receipts_pending: sourceRow.human_receipts_pending,
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
      promotion_enablement_allowed_by_review: false,
      command_execution_performed_by_review: false,
      artifact_read_performed_by_review: false,
      artifact_write_performed_by_review: false,
      protected_action_executed_by_review: false,
      automatic_order_submission_allowed_by_review: false,
      live_execution_allowed_by_review: false,
      broker_write_allowed_by_review: false,
      exchange_write_allowed_by_review: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "promotion_receipt_chain_review_hash");
  });
}

function buildReviewBoundary({ generatedAt, writeRequested, chainRegression, reviewRows }) {
  const sourceSummary = chainRegression.summary;
  const sourceReady = chainRegression.validation.valid && sourceSummary.trading_promotion_receipt_chain_regression_fixtures_status === SOURCE_READY_STATUS;
  return {
    schema_version: "trading-promotion-receipt-chain-review-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    promotion_receipt_chain_review_artifact_write_requested: writeRequested,
    source_promotion_receipt_chain_regression_status: sourceSummary.trading_promotion_receipt_chain_regression_fixtures_status,
    source_promotion_receipt_chain_regression_ready: sourceReady,
    chain_review_row_count: reviewRows.length,
    ready_chain_review_row_count: reviewRows.filter((row) => row.chain_review_status === CHAIN_REVIEW_READY_STATUS).length,
    chain_regression_consumed_in_memory: true,
    chain_regression_artifact_read_performed: false,
    promotion_receipt_chain_review_declared: true,
    review_completed: false,
    review_approval_applied: false,
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

function buildReviewGateRows({ chainRegression, packageJson, platformOpsLedger, reviewRows, reviewBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const sourceRowsReady = chainRegression.promotion_receipt_chain_regression_rows.length === 12 && chainRegression.promotion_receipt_chain_regression_rows.every((row) => row.chain_phase_status === SOURCE_CHAIN_PHASE_READY_STATUS && row.script_registered && row.validation_chain_registered && row.ledger_acceptance_declared);
  const rows = [
    gateRow("p413_chain_regression_ready", "P413 promotion receipt chain regression source is ready.", chainRegression.validation.valid && chainRegression.summary.trading_promotion_receipt_chain_regression_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P414 trading promotion receipt chain review fixtures command.", typeof scripts["trading:promotion-receipt-chain-review-fixtures"] === "string" && scripts["trading:promotion-receipt-chain-review-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P414 trading promotion receipt chain review fixtures command.", validateScript.includes("npm run trading:promotion-receipt-chain-review-fixtures -- --check")),
    gateRow("p414_ledger_acceptance_declared", "P414 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P414: `trading:promotion-receipt-chain-review-fixtures`")),
    gateRow("p401_p412_regression_rows_ready", "Every P401-P412 promotion receipt chain regression row is ready.", sourceRowsReady),
    gateRow("chain_review_rows_ready", "Every promotion receipt chain review row is ready while review completion remains pending.", reviewRows.length === 12 && reviewRows.every((row) => row.chain_review_status === CHAIN_REVIEW_READY_STATUS && row.promotion_receipt_chain_review_declared && !row.review_completed && !row.review_approval_applied && row.human_receipts_pending)),
    gateRow("human_review_pending_not_applied", "P414 declares human review packets without completing review or applying approvals.", !reviewBoundary.review_completed && !reviewBoundary.review_approval_applied && reviewBoundary.human_review_required && !reviewBoundary.approval_applied),
    gateRow("no_receipt_or_trading_mutation", "P414 does not receive, validate, apply, enable, execute, or mutate trading state.", !reviewBoundary.actor_workspace_input_present && !reviewBoundary.receipt_payload_present && !reviewBoundary.ready_for_validation && !reviewBoundary.ready_for_approval_application && !reviewBoundary.receipt_received && !reviewBoundary.receipt_validated && !reviewBoundary.receipt_application_performed && !reviewBoundary.approval_applied && !reviewBoundary.shadow_live_enabled && !reviewBoundary.limited_live_enabled && !reviewBoundary.full_auto_enabled && !reviewBoundary.automatic_order_submission_allowed && !reviewBoundary.live_order_submission_allowed && !reviewBoundary.live_promotion_allowed && !reviewBoundary.live_execution_allowed && !reviewBoundary.broker_write_allowed && !reviewBoundary.exchange_write_allowed),
    gateRow("no_command_or_artifact_mutation", "P414 review packets do not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !reviewBoundary.command_execution_performed && !reviewBoundary.package_command_execution_performed && !reviewBoundary.release_check_execution_performed && !reviewBoundary.artifact_read_performed && !reviewBoundary.artifact_write_performed && !reviewBoundary.release_published && !reviewBoundary.git_operation_performed && !reviewBoundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "promotion_receipt_chain_review_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-promotion-receipt-chain-review-gate-row.v1",
    promotion_receipt_chain_review_gate_row_id: `trading-promotion-receipt-chain-review-fixtures.gate.${rowKey}`,
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
    promotion_enablement_allowed_by_review: false,
    command_execution_performed_by_review: false,
    artifact_read_performed_by_review: false,
    artifact_write_performed_by_review: false,
    protected_action_executed_by_review: false,
    automatic_order_submission_allowed_by_review: false,
    live_execution_allowed_by_review: false,
    broker_write_allowed_by_review: false,
    exchange_write_allowed_by_review: false,
    human_review_required: true,
  };
}

function buildValidationItems({ chainRegression, packageJson, platformOpsLedger, reviewRows, reviewGateRows, reviewBoundary }) {
  return [
    validationItem("source.promotion_receipt_chain_regression", "p413_chain_regression_ready", chainRegression.validation.valid && chainRegression.summary.trading_promotion_receipt_chain_regression_fixtures_status === SOURCE_READY_STATUS, "P413 promotion receipt chain regression fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P414 promotion receipt chain review fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("promotion_receipt_chain_review_rows", "chain_review_rows_ready", reviewRows.length === 12 && reviewRows.every((row) => row.chain_review_status === CHAIN_REVIEW_READY_STATUS && row.script_registered && row.validation_chain_registered && row.ledger_acceptance_declared && row.promotion_receipt_chain_review_declared && !row.review_completed && !row.review_approval_applied && row.p401_p412_chain_ready && row.human_receipts_pending && !row.receipt_payload_present && !row.approval_applied_by_review), "P401-P412 promotion receipt chain review rows must be ready and pending human review."),
    validationItem("promotion_receipt_chain_review_gate_rows", "chain_review_gates_ready", reviewGateRows.length >= 9 && reviewGateRows.every((row) => row.gate_status === "ready" && !row.review_completed_by_review && !row.approval_applied_by_review && !row.protected_action_executed_by_review), "P414 promotion receipt chain review gates are ready."),
    validationItem("boundary.review_pending", "review_pending_not_applied", reviewBoundary.read_only && reviewBoundary.report_only && reviewBoundary.chain_regression_consumed_in_memory && !reviewBoundary.chain_regression_artifact_read_performed && reviewBoundary.promotion_receipt_chain_review_declared && !reviewBoundary.review_completed && !reviewBoundary.review_approval_applied && reviewBoundary.p401_p412_chain_ready && reviewBoundary.human_receipts_pending && reviewBoundary.human_review_required, "Promotion receipt chain review remains pending and unapplied."),
    validationItem("boundary.no_receipt_or_trading_mutation", "no_receipt_or_trading_mutation", !reviewBoundary.actor_workspace_input_present && !reviewBoundary.receipt_input_file_materialized && !reviewBoundary.merged_receipt_input_materialized && !reviewBoundary.receipt_payload_present && !reviewBoundary.ready_for_validation && !reviewBoundary.ready_for_approval_application && !reviewBoundary.receipt_received && !reviewBoundary.receipt_validated && !reviewBoundary.receipt_application_performed && !reviewBoundary.approval_applied && !reviewBoundary.shadow_live_enabled && !reviewBoundary.limited_live_enabled && !reviewBoundary.full_auto_enabled && !reviewBoundary.automatic_order_submission_allowed && !reviewBoundary.live_order_submission_allowed && !reviewBoundary.live_promotion_allowed && !reviewBoundary.live_execution_allowed && !reviewBoundary.broker_write_allowed && !reviewBoundary.exchange_write_allowed, "P414 does not receive/apply receipts or enable trading mutation."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !reviewBoundary.command_execution_performed && !reviewBoundary.package_command_execution_performed && !reviewBoundary.release_check_execution_performed && !reviewBoundary.artifact_read_performed && !reviewBoundary.artifact_write_performed && !reviewBoundary.release_published && !reviewBoundary.git_operation_performed && !reviewBoundary.protected_action_executed, "P414 does not execute commands or read/write artifacts."),
    validationItem("boundary.no_source_receipt_or_approval", "no_source_receipt_or_approval", !reviewBoundary.source_receipt_present && !reviewBoundary.source_approval_applied, "P414 must not inherit pre-applied promotion receipts or approvals."),
  ];
}

function buildSummary({ chainRegression, reviewRows, reviewGateRows, reviewBoundary, validation }) {
  return {
    trading_promotion_receipt_chain_review_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_chain_regression_status: chainRegression.summary.trading_promotion_receipt_chain_regression_fixtures_status,
    source_promotion_receipt_chain_regression_ready: reviewBoundary.source_promotion_receipt_chain_regression_ready,
    chain_review_row_count: reviewRows.length,
    ready_chain_review_row_count: reviewBoundary.ready_chain_review_row_count,
    chain_review_gate_count: reviewGateRows.length,
    ready_chain_review_gate_count: reviewGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: reviewBoundary.read_only,
    report_only: reviewBoundary.report_only,
    chain_regression_consumed_in_memory: reviewBoundary.chain_regression_consumed_in_memory,
    chain_regression_artifact_read_performed: reviewBoundary.chain_regression_artifact_read_performed,
    promotion_receipt_chain_review_declared: reviewBoundary.promotion_receipt_chain_review_declared,
    review_completed: reviewBoundary.review_completed,
    review_approval_applied: reviewBoundary.review_approval_applied,
    p401_p412_chain_ready: reviewBoundary.p401_p412_chain_ready,
    human_receipts_pending: reviewBoundary.human_receipts_pending,
    actor_workspace_input_present: reviewBoundary.actor_workspace_input_present,
    receipt_input_file_materialized: reviewBoundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: reviewBoundary.merged_receipt_input_materialized,
    receipt_payload_present: reviewBoundary.receipt_payload_present,
    ready_for_validation: reviewBoundary.ready_for_validation,
    ready_for_approval_application: reviewBoundary.ready_for_approval_application,
    receipt_received: reviewBoundary.receipt_received,
    receipt_validated: reviewBoundary.receipt_validated,
    receipt_application_performed: reviewBoundary.receipt_application_performed,
    approval_applied: reviewBoundary.approval_applied,
    source_receipt_present: reviewBoundary.source_receipt_present,
    source_approval_applied: reviewBoundary.source_approval_applied,
    real_enablement_count: reviewBoundary.real_enablement_count,
    shadow_live_enabled: reviewBoundary.shadow_live_enabled,
    limited_live_enabled: reviewBoundary.limited_live_enabled,
    full_auto_enabled: reviewBoundary.full_auto_enabled,
    automatic_order_submission_allowed: reviewBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: reviewBoundary.live_order_submission_allowed,
    live_promotion_allowed: reviewBoundary.live_promotion_allowed,
    live_execution_allowed: reviewBoundary.live_execution_allowed,
    broker_write_allowed: reviewBoundary.broker_write_allowed,
    exchange_write_allowed: reviewBoundary.exchange_write_allowed,
    command_execution_performed: reviewBoundary.command_execution_performed,
    package_command_execution_performed: reviewBoundary.package_command_execution_performed,
    release_check_execution_performed: reviewBoundary.release_check_execution_performed,
    artifact_read_performed: reviewBoundary.artifact_read_performed,
    artifact_write_performed: reviewBoundary.artifact_write_performed,
    release_published: reviewBoundary.release_published,
    git_operation_performed: reviewBoundary.git_operation_performed,
    protected_action_executed: reviewBoundary.protected_action_executed,
    human_review_required: reviewBoundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Promotion Receipt Chain Review Fixtures",
    "",
    `Status: ${result.summary.trading_promotion_receipt_chain_review_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source chain regression: ${result.summary.source_promotion_receipt_chain_regression_status}`,
    `Review rows: ${result.summary.ready_chain_review_row_count}/${result.summary.chain_review_row_count}`,
    `Review gates: ${result.summary.ready_chain_review_gate_count}/${result.summary.chain_review_gate_count}`,
    "",
    "## Review Rows",
    "",
    ...result.promotion_receipt_chain_review_rows.map((row) => `- ${row.source_phase_slot} ${row.package_script_name}: ${row.chain_review_status}`),
    "",
    "## Gates",
    "",
    ...result.promotion_receipt_chain_review_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REVIEW_FIXTURES_OUT_DIR };
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
    else if (arg === "--promotion-receipt-chain-regression-fixtures-schema") parsed.promotionReceiptChainRegressionFixturesSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-promotion-receipt-chain-review-fixtures.mjs [options]

Options:
  --out-dir <folder>                         Output directory. Default: ${DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REVIEW_FIXTURES_OUT_DIR}
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
  --promotion-receipt-chain-regression-fixtures-schema <path>
                                             P413 promotion receipt chain regression fixtures schema path.
  --schema <path>                            Output schema path.
  --check                                    Validate only, do not write artifacts.
  -h, --help                                 Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.platformOpsLedgerPath),
    promotion_receipt_workspace_fixtures_schema_path: path.resolve(options.promotionReceiptWorkspaceFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.promotionReceiptWorkspaceFixturesSchemaPath),
    promotion_receipt_workspace_merge_fixtures_schema_path: path.resolve(options.promotionReceiptWorkspaceMergeFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.promotionReceiptWorkspaceMergeFixturesSchemaPath),
    promotion_receipt_merge_preflight_fixtures_schema_path: path.resolve(options.promotionReceiptMergePreflightFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.promotionReceiptMergePreflightFixturesSchemaPath),
    promotion_receipt_validation_packet_fixtures_schema_path: path.resolve(options.promotionReceiptValidationPacketFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.promotionReceiptValidationPacketFixturesSchemaPath),
    promotion_receipt_approval_plan_fixtures_schema_path: path.resolve(options.promotionReceiptApprovalPlanFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.promotionReceiptApprovalPlanFixturesSchemaPath),
    promotion_receipt_approval_closeout_fixtures_schema_path: path.resolve(options.promotionReceiptApprovalCloseoutFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.promotionReceiptApprovalCloseoutFixturesSchemaPath),
    promotion_receipt_closeout_fixtures_schema_path: path.resolve(options.promotionReceiptCloseoutFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.promotionReceiptCloseoutFixturesSchemaPath),
    promotion_receipt_chain_regression_fixtures_schema_path: path.resolve(options.promotionReceiptChainRegressionFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.promotionReceiptChainRegressionFixturesSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.schemaPath),
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
