import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS,
  buildTradingPromotionReceiptChainReviewFixtures,
} from "./trading-promotion-receipt-chain-review-fixtures.mjs";

export const DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_OUT_DIR = "artifacts/trading-promotion-receipt-chain-signoff-ledger-fixtures/latest";
export const DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS,
  promotionReceiptChainReviewFixturesSchemaPath: DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-promotion-receipt-chain-signoff-ledger-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-promotion-receipt-chain-signoff-ledger-fixtures.v1";
const CAPABILITY_ID = "trading.promotion_receipt_chain_signoff_ledger_fixtures";
const PHASE_SLOT = "P415";
const PREVIOUS_PHASE_SLOT = "P414";
const NEXT_PHASE_SLOT = "P416";
const READY_STATUS = "ready_for_trading_promotion_receipt_chain_signoff_ledger";
const SOURCE_READY_STATUS = "ready_for_trading_promotion_receipt_chain_review";
const SOURCE_REVIEW_READY_STATUS = "ready_for_trading_promotion_receipt_chain_human_review";
const SIGNOFF_LEDGER_READY_STATUS = "ready_for_trading_promotion_receipt_chain_signoff";
const SIGNOFF_LEDGER_CHECKS = [
  "p414_review_ready",
  "review_packet_declared",
  "review_not_completed",
  "signoff_ledger_declared",
  "signoff_pending",
  "receipt_payload_absent",
  "approval_application_absent",
  "trading_mutation_disabled",
];

export async function runTradingPromotionReceiptChainSignoffLedgerFixtures(options = {}) {
  const result = await buildTradingPromotionReceiptChainSignoffLedgerFixtures(options);
  if (options.write !== false) await writeTradingPromotionReceiptChainSignoffLedgerFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading promotion receipt chain signoff ledger fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingPromotionReceiptChainSignoffLedgerFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const chainReview = await buildTradingPromotionReceiptChainReviewFixtures({
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
    promotionReceiptChainRegressionFixturesSchemaPath: inputs.promotion_receipt_chain_regression_fixtures_schema_path,
    schemaPath: inputs.promotion_receipt_chain_review_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const signoffAnchor = buildSignoffAnchor(chainReview);
  const signoffRows = buildSignoffRows(chainReview);
  const signoffBoundary = buildSignoffBoundary({ generatedAt, writeRequested: options.write !== false, chainReview, signoffRows });
  const signoffGateRows = buildSignoffGateRows({ chainReview, packageJson, platformOpsLedger, signoffRows, signoffBoundary });
  const validationItems = buildValidationItems({ chainReview, packageJson, platformOpsLedger, signoffRows, signoffGateRows, signoffBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ chainReview, signoffRows, signoffGateRows, signoffBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_promotion_receipt_chain_signoff_ledger_fixtures_id: `trading-promotion-receipt-chain-signoff-ledger-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    promotion_receipt_chain_signoff_ledger_anchor: signoffAnchor,
    promotion_receipt_chain_signoff_ledger_rows: signoffRows,
    promotion_receipt_chain_signoff_ledger_gate_rows: signoffGateRows,
    promotion_receipt_chain_signoff_ledger_boundary: signoffBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_promotion_receipt_chain_signoff_ledger_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ chainReview, signoffRows, signoffGateRows, signoffBoundary, validation: result.validation });
  result.summary.trading_promotion_receipt_chain_signoff_ledger_fixtures_id = result.trading_promotion_receipt_chain_signoff_ledger_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingPromotionReceiptChainSignoffLedgerFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-promotion-receipt-chain-signoff-ledger-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "promotion-receipt-chain-signoff-ledger-rows.json"), collectionEnvelope("trading-promotion-receipt-chain-signoff-ledger-rows.v1", "promotion_receipt_chain_signoff_ledger_rows", result.promotion_receipt_chain_signoff_ledger_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-chain-signoff-ledger-gate-rows.json"), collectionEnvelope("trading-promotion-receipt-chain-signoff-ledger-gate-rows.v1", "promotion_receipt_chain_signoff_ledger_gate_rows", result.promotion_receipt_chain_signoff_ledger_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-chain-signoff-ledger-boundary.json"), result.promotion_receipt_chain_signoff_ledger_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-promotion-receipt-chain-signoff-ledger-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingPromotionReceiptChainSignoffLedgerFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingPromotionReceiptChainSignoffLedgerFixtures(args);
    console.log(`Trading promotion receipt chain signoff ledger fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_promotion_receipt_chain_signoff_ledger_fixtures_status}`);
    console.log(`Signoff rows: ${result.summary.ready_chain_signoff_row_count}/${result.summary.chain_signoff_row_count}`);
    console.log(`Signoff gates: ${result.summary.ready_chain_signoff_gate_count}/${result.summary.chain_signoff_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildSignoffAnchor(chainReview) {
  return {
    schema_version: "trading-promotion-receipt-chain-signoff-ledger-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_chain_review_fixtures_id: chainReview.trading_promotion_receipt_chain_review_fixtures_id,
    source_promotion_receipt_chain_review_status: chainReview.summary.trading_promotion_receipt_chain_review_fixtures_status,
    source_hash: hashValue({
      id: chainReview.trading_promotion_receipt_chain_review_fixtures_id,
      status: chainReview.summary.trading_promotion_receipt_chain_review_fixtures_status,
      review_rows: chainReview.summary.chain_review_row_count,
      review_gate_rows: chainReview.summary.chain_review_gate_count,
    }),
  };
}

function buildSignoffRows(chainReview) {
  const sourceReady = chainReview.validation.valid && chainReview.summary.trading_promotion_receipt_chain_review_fixtures_status === SOURCE_READY_STATUS;
  return chainReview.promotion_receipt_chain_review_rows.map((sourceRow, index) => {
    const signoffReady = sourceReady && sourceRow.chain_review_status === SOURCE_REVIEW_READY_STATUS;
    const row = {
      schema_version: "trading-promotion-receipt-chain-signoff-ledger-row.v1",
      promotion_receipt_chain_signoff_ledger_row_id: `trading-promotion-receipt-chain-signoff-ledger.row.${sourceRow.source_phase_slot.toLowerCase()}`,
      phase_slot: PHASE_SLOT,
      source_chain_review_row_id: sourceRow.promotion_receipt_chain_review_row_id,
      source_phase_slot: sourceRow.source_phase_slot,
      package_script_name: sourceRow.package_script_name,
      workflow_id: sourceRow.workflow_id,
      chain_signoff_status: signoffReady ? SIGNOFF_LEDGER_READY_STATUS : "blocked",
      source_chain_review_status: sourceRow.chain_review_status,
      source_promotion_receipt_chain_review_status: chainReview.summary.trading_promotion_receipt_chain_review_fixtures_status,
      reviewer_role: sourceRow.reviewer_role,
      required_signoff_role: "trading_control_signoff_owner",
      required_signoff_decision: "signoff_required_before_receipt_collection",
      promotion_receipt_chain_review_declared: sourceRow.promotion_receipt_chain_review_declared,
      promotion_receipt_chain_signoff_ledger_declared: true,
      review_completed: sourceRow.review_completed,
      review_approval_applied: sourceRow.review_approval_applied,
      signoff_completed: false,
      signoff_approval_applied: false,
      p401_p412_chain_ready: sourceRow.p401_p412_chain_ready,
      human_receipts_pending: sourceRow.human_receipts_pending,
      chain_signoff_checks: SIGNOFF_LEDGER_CHECKS,
      actor_workspace_input_present: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      ready_for_validation: false,
      ready_for_approval_application: false,
      receipt_received_by_signoff: false,
      receipt_validated_by_signoff: false,
      receipt_application_performed_by_signoff: false,
      approval_applied_by_signoff: false,
      promotion_enablement_allowed_by_signoff: false,
      command_execution_performed_by_signoff: false,
      artifact_read_performed_by_signoff: false,
      artifact_write_performed_by_signoff: false,
      protected_action_executed_by_signoff: false,
      automatic_order_submission_allowed_by_signoff: false,
      live_execution_allowed_by_signoff: false,
      broker_write_allowed_by_signoff: false,
      exchange_write_allowed_by_signoff: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "promotion_receipt_chain_signoff_ledger_hash");
  });
}

function buildSignoffBoundary({ generatedAt, writeRequested, chainReview, signoffRows }) {
  const sourceSummary = chainReview.summary;
  const sourceReady = chainReview.validation.valid && sourceSummary.trading_promotion_receipt_chain_review_fixtures_status === SOURCE_READY_STATUS;
  return {
    schema_version: "trading-promotion-receipt-chain-signoff-ledger-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    promotion_receipt_chain_signoff_ledger_artifact_write_requested: writeRequested,
    source_promotion_receipt_chain_review_status: sourceSummary.trading_promotion_receipt_chain_review_fixtures_status,
    source_promotion_receipt_chain_review_ready: sourceReady,
    chain_signoff_row_count: signoffRows.length,
    ready_chain_signoff_row_count: signoffRows.filter((row) => row.chain_signoff_status === SIGNOFF_LEDGER_READY_STATUS).length,
    chain_review_consumed_in_memory: true,
    chain_review_artifact_read_performed: false,
    promotion_receipt_chain_signoff_ledger_declared: true,
    review_completed: false,
    review_approval_applied: false,
    signoff_completed: false,
    signoff_approval_applied: false,
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

function buildSignoffGateRows({ chainReview, packageJson, platformOpsLedger, signoffRows, signoffBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const sourceRowsReady = chainReview.promotion_receipt_chain_review_rows.length === 12 && chainReview.promotion_receipt_chain_review_rows.every((row) => row.chain_review_status === SOURCE_REVIEW_READY_STATUS && row.promotion_receipt_chain_review_declared && !row.review_completed && !row.review_approval_applied);
  const rows = [
    gateRow("p414_chain_review_ready", "P414 promotion receipt chain review source is ready.", chainReview.validation.valid && chainReview.summary.trading_promotion_receipt_chain_review_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P415 trading promotion receipt chain signoff ledger fixtures command.", typeof scripts["trading:promotion-receipt-chain-signoff-ledger-fixtures"] === "string" && scripts["trading:promotion-receipt-chain-signoff-ledger-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P415 trading promotion receipt chain signoff ledger fixtures command.", validateScript.includes("npm run trading:promotion-receipt-chain-signoff-ledger-fixtures -- --check")),
    gateRow("p415_ledger_acceptance_declared", "P415 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P415: `trading:promotion-receipt-chain-signoff-ledger-fixtures`")),
    gateRow("p414_review_rows_ready", "Every P414 promotion receipt chain review row is ready and still pending.", sourceRowsReady),
    gateRow("chain_signoff_rows_ready", "Every promotion receipt chain signoff row is ready while signoff remains pending.", signoffRows.length === 12 && signoffRows.every((row) => row.chain_signoff_status === SIGNOFF_LEDGER_READY_STATUS && row.promotion_receipt_chain_signoff_ledger_declared && !row.signoff_completed && !row.signoff_approval_applied && row.human_receipts_pending)),
    gateRow("signoff_pending_not_applied", "P415 declares signoff ledger rows without completing signoff or applying approvals.", !signoffBoundary.signoff_completed && !signoffBoundary.signoff_approval_applied && signoffBoundary.human_review_required && !signoffBoundary.approval_applied),
    gateRow("no_receipt_or_trading_mutation", "P415 does not receive, validate, apply, enable, execute, or mutate trading state.", !signoffBoundary.actor_workspace_input_present && !signoffBoundary.receipt_payload_present && !signoffBoundary.ready_for_validation && !signoffBoundary.ready_for_approval_application && !signoffBoundary.receipt_received && !signoffBoundary.receipt_validated && !signoffBoundary.receipt_application_performed && !signoffBoundary.approval_applied && !signoffBoundary.shadow_live_enabled && !signoffBoundary.limited_live_enabled && !signoffBoundary.full_auto_enabled && !signoffBoundary.automatic_order_submission_allowed && !signoffBoundary.live_order_submission_allowed && !signoffBoundary.live_promotion_allowed && !signoffBoundary.live_execution_allowed && !signoffBoundary.broker_write_allowed && !signoffBoundary.exchange_write_allowed),
    gateRow("no_command_or_artifact_mutation", "P415 signoff ledger does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !signoffBoundary.command_execution_performed && !signoffBoundary.package_command_execution_performed && !signoffBoundary.release_check_execution_performed && !signoffBoundary.artifact_read_performed && !signoffBoundary.artifact_write_performed && !signoffBoundary.release_published && !signoffBoundary.git_operation_performed && !signoffBoundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "promotion_receipt_chain_signoff_ledger_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-promotion-receipt-chain-signoff-ledger-gate-row.v1",
    promotion_receipt_chain_signoff_ledger_gate_row_id: `trading-promotion-receipt-chain-signoff-ledger-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    review_completed_by_signoff: false,
    review_approval_applied_by_signoff: false,
    signoff_completed_by_signoff: false,
    signoff_approval_applied_by_signoff: false,
    actor_workspace_input_present_by_signoff: false,
    receipt_payload_present_by_signoff: false,
    ready_for_validation_by_signoff: false,
    ready_for_approval_application_by_signoff: false,
    receipt_received_by_signoff: false,
    receipt_validated_by_signoff: false,
    receipt_application_performed_by_signoff: false,
    approval_applied_by_signoff: false,
    promotion_enablement_allowed_by_signoff: false,
    command_execution_performed_by_signoff: false,
    artifact_read_performed_by_signoff: false,
    artifact_write_performed_by_signoff: false,
    protected_action_executed_by_signoff: false,
    automatic_order_submission_allowed_by_signoff: false,
    live_execution_allowed_by_signoff: false,
    broker_write_allowed_by_signoff: false,
    exchange_write_allowed_by_signoff: false,
    human_review_required: true,
  };
}

function buildValidationItems({ chainReview, packageJson, platformOpsLedger, signoffRows, signoffGateRows, signoffBoundary }) {
  return [
    validationItem("source.promotion_receipt_chain_review", "p414_chain_review_ready", chainReview.validation.valid && chainReview.summary.trading_promotion_receipt_chain_review_fixtures_status === SOURCE_READY_STATUS, "P414 promotion receipt chain review fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P415 promotion receipt chain signoff ledger fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("promotion_receipt_chain_signoff_ledger_rows", "chain_signoff_rows_ready", signoffRows.length === 12 && signoffRows.every((row) => row.chain_signoff_status === SIGNOFF_LEDGER_READY_STATUS && row.promotion_receipt_chain_signoff_ledger_declared && !row.signoff_completed && !row.signoff_approval_applied && !row.receipt_payload_present && !row.approval_applied_by_signoff && row.p401_p412_chain_ready && row.human_receipts_pending), "P401-P412 promotion receipt chain signoff rows must be ready and pending signoff."),
    validationItem("promotion_receipt_chain_signoff_ledger_gate_rows", "chain_signoff_gates_ready", signoffGateRows.length >= 9 && signoffGateRows.every((row) => row.gate_status === "ready" && !row.signoff_completed_by_signoff && !row.approval_applied_by_signoff && !row.protected_action_executed_by_signoff), "P415 promotion receipt chain signoff gates are ready."),
    validationItem("boundary.signoff_pending", "signoff_pending_not_applied", signoffBoundary.read_only && signoffBoundary.report_only && signoffBoundary.chain_review_consumed_in_memory && !signoffBoundary.chain_review_artifact_read_performed && signoffBoundary.promotion_receipt_chain_signoff_ledger_declared && !signoffBoundary.review_completed && !signoffBoundary.review_approval_applied && !signoffBoundary.signoff_completed && !signoffBoundary.signoff_approval_applied && signoffBoundary.p401_p412_chain_ready && signoffBoundary.human_receipts_pending && signoffBoundary.human_review_required, "Promotion receipt chain signoff remains pending and unapplied."),
    validationItem("boundary.no_receipt_or_trading_mutation", "no_receipt_or_trading_mutation", !signoffBoundary.actor_workspace_input_present && !signoffBoundary.receipt_input_file_materialized && !signoffBoundary.merged_receipt_input_materialized && !signoffBoundary.receipt_payload_present && !signoffBoundary.ready_for_validation && !signoffBoundary.ready_for_approval_application && !signoffBoundary.receipt_received && !signoffBoundary.receipt_validated && !signoffBoundary.receipt_application_performed && !signoffBoundary.approval_applied && !signoffBoundary.shadow_live_enabled && !signoffBoundary.limited_live_enabled && !signoffBoundary.full_auto_enabled && !signoffBoundary.automatic_order_submission_allowed && !signoffBoundary.live_order_submission_allowed && !signoffBoundary.live_promotion_allowed && !signoffBoundary.live_execution_allowed && !signoffBoundary.broker_write_allowed && !signoffBoundary.exchange_write_allowed, "P415 does not receive/apply receipts or enable trading mutation."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !signoffBoundary.command_execution_performed && !signoffBoundary.package_command_execution_performed && !signoffBoundary.release_check_execution_performed && !signoffBoundary.artifact_read_performed && !signoffBoundary.artifact_write_performed && !signoffBoundary.release_published && !signoffBoundary.git_operation_performed && !signoffBoundary.protected_action_executed, "P415 does not execute commands or read/write artifacts."),
    validationItem("boundary.no_source_receipt_or_approval", "no_source_receipt_or_approval", !signoffBoundary.source_receipt_present && !signoffBoundary.source_approval_applied, "P415 must not inherit pre-applied promotion receipts or approvals."),
  ];
}

function buildSummary({ chainReview, signoffRows, signoffGateRows, signoffBoundary, validation }) {
  return {
    trading_promotion_receipt_chain_signoff_ledger_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_chain_review_status: chainReview.summary.trading_promotion_receipt_chain_review_fixtures_status,
    source_promotion_receipt_chain_review_ready: signoffBoundary.source_promotion_receipt_chain_review_ready,
    chain_signoff_row_count: signoffRows.length,
    ready_chain_signoff_row_count: signoffBoundary.ready_chain_signoff_row_count,
    chain_signoff_gate_count: signoffGateRows.length,
    ready_chain_signoff_gate_count: signoffGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: signoffBoundary.read_only,
    report_only: signoffBoundary.report_only,
    chain_review_consumed_in_memory: signoffBoundary.chain_review_consumed_in_memory,
    chain_review_artifact_read_performed: signoffBoundary.chain_review_artifact_read_performed,
    promotion_receipt_chain_signoff_ledger_declared: signoffBoundary.promotion_receipt_chain_signoff_ledger_declared,
    review_completed: signoffBoundary.review_completed,
    review_approval_applied: signoffBoundary.review_approval_applied,
    signoff_completed: signoffBoundary.signoff_completed,
    signoff_approval_applied: signoffBoundary.signoff_approval_applied,
    p401_p412_chain_ready: signoffBoundary.p401_p412_chain_ready,
    human_receipts_pending: signoffBoundary.human_receipts_pending,
    actor_workspace_input_present: signoffBoundary.actor_workspace_input_present,
    receipt_input_file_materialized: signoffBoundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: signoffBoundary.merged_receipt_input_materialized,
    receipt_payload_present: signoffBoundary.receipt_payload_present,
    ready_for_validation: signoffBoundary.ready_for_validation,
    ready_for_approval_application: signoffBoundary.ready_for_approval_application,
    receipt_received: signoffBoundary.receipt_received,
    receipt_validated: signoffBoundary.receipt_validated,
    receipt_application_performed: signoffBoundary.receipt_application_performed,
    approval_applied: signoffBoundary.approval_applied,
    source_receipt_present: signoffBoundary.source_receipt_present,
    source_approval_applied: signoffBoundary.source_approval_applied,
    real_enablement_count: signoffBoundary.real_enablement_count,
    shadow_live_enabled: signoffBoundary.shadow_live_enabled,
    limited_live_enabled: signoffBoundary.limited_live_enabled,
    full_auto_enabled: signoffBoundary.full_auto_enabled,
    automatic_order_submission_allowed: signoffBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: signoffBoundary.live_order_submission_allowed,
    live_promotion_allowed: signoffBoundary.live_promotion_allowed,
    live_execution_allowed: signoffBoundary.live_execution_allowed,
    broker_write_allowed: signoffBoundary.broker_write_allowed,
    exchange_write_allowed: signoffBoundary.exchange_write_allowed,
    command_execution_performed: signoffBoundary.command_execution_performed,
    package_command_execution_performed: signoffBoundary.package_command_execution_performed,
    release_check_execution_performed: signoffBoundary.release_check_execution_performed,
    artifact_read_performed: signoffBoundary.artifact_read_performed,
    artifact_write_performed: signoffBoundary.artifact_write_performed,
    release_published: signoffBoundary.release_published,
    git_operation_performed: signoffBoundary.git_operation_performed,
    protected_action_executed: signoffBoundary.protected_action_executed,
    human_review_required: signoffBoundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Promotion Receipt Chain Signoff Ledger Fixtures",
    "",
    `Status: ${result.summary.trading_promotion_receipt_chain_signoff_ledger_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source chain review: ${result.summary.source_promotion_receipt_chain_review_status}`,
    `Signoff rows: ${result.summary.ready_chain_signoff_row_count}/${result.summary.chain_signoff_row_count}`,
    `Signoff gates: ${result.summary.ready_chain_signoff_gate_count}/${result.summary.chain_signoff_gate_count}`,
    "",
    "## Signoff Rows",
    "",
    ...result.promotion_receipt_chain_signoff_ledger_rows.map((row) => `- ${row.source_phase_slot} ${row.package_script_name}: ${row.chain_signoff_status}`),
    "",
    "## Gates",
    "",
    ...result.promotion_receipt_chain_signoff_ledger_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_OUT_DIR };
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
    else if (arg === "--promotion-receipt-chain-review-fixtures-schema") parsed.promotionReceiptChainReviewFixturesSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-promotion-receipt-chain-signoff-ledger-fixtures.mjs [options]

Options:
  --out-dir <folder>                         Output directory. Default: ${DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_OUT_DIR}
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
  --promotion-receipt-chain-review-fixtures-schema <path>
                                             P414 promotion receipt chain review fixtures schema path.
  --schema <path>                            Output schema path.
  --check                                    Validate only, do not write artifacts.
  -h, --help                                 Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.platformOpsLedgerPath),
    promotion_receipt_workspace_fixtures_schema_path: path.resolve(options.promotionReceiptWorkspaceFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.promotionReceiptWorkspaceFixturesSchemaPath),
    promotion_receipt_workspace_merge_fixtures_schema_path: path.resolve(options.promotionReceiptWorkspaceMergeFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.promotionReceiptWorkspaceMergeFixturesSchemaPath),
    promotion_receipt_merge_preflight_fixtures_schema_path: path.resolve(options.promotionReceiptMergePreflightFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.promotionReceiptMergePreflightFixturesSchemaPath),
    promotion_receipt_validation_packet_fixtures_schema_path: path.resolve(options.promotionReceiptValidationPacketFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.promotionReceiptValidationPacketFixturesSchemaPath),
    promotion_receipt_approval_plan_fixtures_schema_path: path.resolve(options.promotionReceiptApprovalPlanFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.promotionReceiptApprovalPlanFixturesSchemaPath),
    promotion_receipt_approval_closeout_fixtures_schema_path: path.resolve(options.promotionReceiptApprovalCloseoutFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.promotionReceiptApprovalCloseoutFixturesSchemaPath),
    promotion_receipt_closeout_fixtures_schema_path: path.resolve(options.promotionReceiptCloseoutFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.promotionReceiptCloseoutFixturesSchemaPath),
    promotion_receipt_chain_regression_fixtures_schema_path: path.resolve(options.promotionReceiptChainRegressionFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.promotionReceiptChainRegressionFixturesSchemaPath),
    promotion_receipt_chain_review_fixtures_schema_path: path.resolve(options.promotionReceiptChainReviewFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.promotionReceiptChainReviewFixturesSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.schemaPath),
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
