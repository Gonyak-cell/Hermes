import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS,
  buildTradingPromotionReceiptApprovalPlanFixtures,
} from "./trading-promotion-receipt-approval-plan-fixtures.mjs";

export const DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_OUT_DIR = "artifacts/trading-promotion-receipt-approval-closeout-fixtures/latest";
export const DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS,
  promotionReceiptApprovalPlanFixturesSchemaPath: DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-promotion-receipt-approval-closeout-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-promotion-receipt-approval-closeout-fixtures.v1";
const CAPABILITY_ID = "trading.promotion_receipt_approval_closeout_fixtures";
const PHASE_SLOT = "P411";
const PREVIOUS_PHASE_SLOT = "P410";
const NEXT_PHASE_SLOT = "P412";
const READY_STATUS = "ready_for_trading_promotion_receipt_approval_closeout_regression";
const SOURCE_READY_STATUS = "ready_for_trading_promotion_receipt_approval_plan_regression";
const APPROVAL_CLOSEOUT_READY_STATUS = "ready_for_future_promotion_receipt_approval_closeout";
const SOURCE_APPROVAL_PLAN_READY_STATUS = "ready_for_future_promotion_receipt_approval_plan";
const APPROVAL_CLOSEOUT_CHECKS = [
  "approval_plan_ready",
  "future_receipt_decision_allows_promotion",
  "reviewer_role_matches_plan",
  "promotion_stage_matches",
  "evidence_reference_confirmed",
  "blocker_note_resolved_or_recorded",
  "human_gate_application_future_only",
  "live_trading_boundary_stays_false",
];

export async function runTradingPromotionReceiptApprovalCloseoutFixtures(options = {}) {
  const result = await buildTradingPromotionReceiptApprovalCloseoutFixtures(options);
  if (options.write !== false) await writeTradingPromotionReceiptApprovalCloseoutFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading promotion receipt approval closeout fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingPromotionReceiptApprovalCloseoutFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const approvalPlan = await buildTradingPromotionReceiptApprovalPlanFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    promotionReceiptWorkspaceFixturesSchemaPath: inputs.promotion_receipt_workspace_fixtures_schema_path,
    promotionReceiptWorkspaceMergeFixturesSchemaPath: inputs.promotion_receipt_workspace_merge_fixtures_schema_path,
    promotionReceiptMergePreflightFixturesSchemaPath: inputs.promotion_receipt_merge_preflight_fixtures_schema_path,
    promotionReceiptValidationPacketFixturesSchemaPath: inputs.promotion_receipt_validation_packet_fixtures_schema_path,
    schemaPath: inputs.promotion_receipt_approval_plan_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const closeoutAnchor = buildCloseoutAnchor(approvalPlan);
  const closeoutRows = buildCloseoutRows(approvalPlan);
  const closeoutBoundary = buildCloseoutBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    approvalPlan,
    closeoutRows,
  });
  const closeoutGateRows = buildCloseoutGateRows({ approvalPlan, packageJson, platformOpsLedger, closeoutRows, closeoutBoundary });
  const validationItems = buildValidationItems({ approvalPlan, packageJson, platformOpsLedger, closeoutRows, closeoutGateRows, closeoutBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ approvalPlan, closeoutRows, closeoutGateRows, closeoutBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_promotion_receipt_approval_closeout_fixtures_id: `trading-promotion-receipt-approval-closeout-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    promotion_receipt_approval_closeout_anchor: closeoutAnchor,
    promotion_receipt_approval_closeout_rows: closeoutRows,
    promotion_receipt_approval_closeout_gate_rows: closeoutGateRows,
    promotion_receipt_approval_closeout_boundary: closeoutBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_promotion_receipt_approval_closeout_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ approvalPlan, closeoutRows, closeoutGateRows, closeoutBoundary, validation: result.validation });
  result.summary.trading_promotion_receipt_approval_closeout_fixtures_id = result.trading_promotion_receipt_approval_closeout_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingPromotionReceiptApprovalCloseoutFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-promotion-receipt-approval-closeout-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "promotion-receipt-approval-closeout-rows.json"), collectionEnvelope("trading-promotion-receipt-approval-closeout-rows.v1", "promotion_receipt_approval_closeout_rows", result.promotion_receipt_approval_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-approval-closeout-gate-rows.json"), collectionEnvelope("trading-promotion-receipt-approval-closeout-gate-rows.v1", "promotion_receipt_approval_closeout_gate_rows", result.promotion_receipt_approval_closeout_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-approval-closeout-boundary.json"), result.promotion_receipt_approval_closeout_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-promotion-receipt-approval-closeout-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingPromotionReceiptApprovalCloseoutFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingPromotionReceiptApprovalCloseoutFixtures(args);
    console.log(`Trading promotion receipt approval closeout fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_promotion_receipt_approval_closeout_fixtures_status}`);
    console.log(`Approval closeout rows: ${result.summary.ready_approval_closeout_row_count}/${result.summary.approval_closeout_row_count}`);
    console.log(`Approval closeout gates: ${result.summary.ready_approval_closeout_gate_count}/${result.summary.approval_closeout_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildCloseoutAnchor(approvalPlan) {
  return {
    schema_version: "trading-promotion-receipt-approval-closeout-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_approval_plan_fixtures_id: approvalPlan.trading_promotion_receipt_approval_plan_fixtures_id,
    source_promotion_receipt_approval_plan_status: approvalPlan.summary.trading_promotion_receipt_approval_plan_fixtures_status,
    source_hash: hashValue({
      id: approvalPlan.trading_promotion_receipt_approval_plan_fixtures_id,
      status: approvalPlan.summary.trading_promotion_receipt_approval_plan_fixtures_status,
      approval_plan_rows: approvalPlan.summary.approval_plan_row_count,
      approval_plan_gate_rows: approvalPlan.summary.approval_plan_gate_count,
    }),
  };
}

function buildCloseoutRows(approvalPlan) {
  const sourceReady = approvalPlan.validation.valid && approvalPlan.summary.trading_promotion_receipt_approval_plan_fixtures_status === SOURCE_READY_STATUS;
  return approvalPlan.promotion_receipt_approval_plan_rows.map((planRow, index) => {
    const closeoutStatus = sourceReady && planRow.approval_plan_status === SOURCE_APPROVAL_PLAN_READY_STATUS ? APPROVAL_CLOSEOUT_READY_STATUS : "blocked";
    const row = {
      schema_version: "trading-promotion-receipt-approval-closeout-row.v1",
      promotion_receipt_approval_closeout_row_id: `trading-promotion-receipt-approval-closeout.row.${planRow.source_queue_row_key}`,
      phase_slot: PHASE_SLOT,
      source_approval_plan_row_id: planRow.promotion_receipt_approval_plan_row_id,
      source_queue_row_key: planRow.source_queue_row_key,
      from_stage: planRow.from_stage,
      to_stage: planRow.to_stage,
      receipt_contract_id: planRow.receipt_contract_id,
      approval_closeout_status: closeoutStatus,
      source_approval_plan_status: planRow.approval_plan_status,
      actor_workspace_required: true,
      actor_workspace_input_present: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      approval_closeout_declared: true,
      approval_closeout_checks: APPROVAL_CLOSEOUT_CHECKS,
      ready_for_validation: false,
      ready_for_approval_application: false,
      receipt_received_by_closeout: false,
      receipt_validated_by_closeout: false,
      receipt_application_performed_by_closeout: false,
      approval_applied_by_closeout: false,
      promotion_enablement_allowed_by_closeout: false,
      receipt_approval_plan_consumed_in_memory: true,
      receipt_approval_plan_artifact_read_performed_by_closeout: false,
      command_execution_performed_by_closeout: false,
      package_command_execution_performed_by_closeout: false,
      release_check_execution_performed_by_closeout: false,
      artifact_read_performed_by_closeout: false,
      artifact_write_performed_by_closeout: false,
      release_published_by_closeout: false,
      git_operation_performed_by_closeout: false,
      protected_action_executed_by_closeout: false,
      shadow_live_enabled_by_closeout: false,
      limited_live_enabled_by_closeout: false,
      full_auto_enabled_by_closeout: false,
      automatic_order_submission_allowed_by_closeout: false,
      live_order_submission_allowed_by_closeout: false,
      live_execution_allowed_by_closeout: false,
      broker_write_allowed_by_closeout: false,
      exchange_write_allowed_by_closeout: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "promotion_receipt_approval_closeout_hash");
  });
}

function buildCloseoutBoundary({ generatedAt, writeRequested, approvalPlan, closeoutRows }) {
  const sourceSummary = approvalPlan.summary;
  return {
    schema_version: "trading-promotion-receipt-approval-closeout-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    promotion_receipt_approval_closeout_artifact_write_requested: writeRequested,
    source_promotion_receipt_approval_plan_status: sourceSummary.trading_promotion_receipt_approval_plan_fixtures_status,
    source_promotion_receipt_approval_plan_ready: approvalPlan.validation.valid && sourceSummary.trading_promotion_receipt_approval_plan_fixtures_status === SOURCE_READY_STATUS,
    approval_closeout_row_count: closeoutRows.length,
    ready_approval_closeout_row_count: closeoutRows.filter((row) => row.approval_closeout_status === APPROVAL_CLOSEOUT_READY_STATUS).length,
    receipt_approval_plan_consumed_in_memory: true,
    receipt_approval_plan_artifact_read_performed: false,
    approval_closeout_declared: true,
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

function buildCloseoutGateRows({ approvalPlan, packageJson, platformOpsLedger, closeoutRows, closeoutBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p410_receipt_approval_plan_ready", "P410 promotion receipt approval plan source is ready.", approvalPlan.validation.valid && approvalPlan.summary.trading_promotion_receipt_approval_plan_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P411 trading promotion receipt approval closeout fixtures command.", typeof scripts["trading:promotion-receipt-approval-closeout-fixtures"] === "string" && scripts["trading:promotion-receipt-approval-closeout-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P411 trading promotion receipt approval closeout fixtures command.", validateScript.includes("npm run trading:promotion-receipt-approval-closeout-fixtures -- --check")),
    gateRow("p411_ledger_acceptance_declared", "P411 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P411: `trading:promotion-receipt-approval-closeout-fixtures`")),
    gateRow("approval_closeout_rows_ready", "All promotion receipt approval closeout rows are ready for future approval closeout.", closeoutRows.length === 6 && closeoutRows.every((row) => row.approval_closeout_status === APPROVAL_CLOSEOUT_READY_STATUS && row.approval_closeout_declared && row.actor_workspace_required && !row.actor_workspace_input_present && !row.merged_receipt_input_materialized && !row.receipt_payload_present && !row.ready_for_approval_application)),
    gateRow("no_receipt_payload_or_approval", "Approval closeout does not read actor files, materialize merged receipt input, receive payloads, validate receipts, or apply approvals.", !closeoutBoundary.actor_workspace_input_present && !closeoutBoundary.receipt_input_file_materialized && !closeoutBoundary.merged_receipt_input_materialized && !closeoutBoundary.receipt_payload_present && !closeoutBoundary.ready_for_validation && !closeoutBoundary.ready_for_approval_application && !closeoutBoundary.receipt_received && !closeoutBoundary.receipt_validated && !closeoutBoundary.receipt_application_performed && !closeoutBoundary.approval_applied),
    gateRow("live_and_full_auto_enablement_blocked", "P411 closeout does not enable shadow, limited-live, full-auto, live execution, order submission, broker writes, or exchange writes.", !closeoutBoundary.shadow_live_enabled && !closeoutBoundary.limited_live_enabled && !closeoutBoundary.full_auto_enabled && !closeoutBoundary.automatic_order_submission_allowed && !closeoutBoundary.live_order_submission_allowed && !closeoutBoundary.live_execution_allowed && !closeoutBoundary.broker_write_allowed && !closeoutBoundary.exchange_write_allowed),
    gateRow("no_command_or_artifact_mutation", "P411 closeout does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !closeoutBoundary.command_execution_performed && !closeoutBoundary.artifact_read_performed && !closeoutBoundary.artifact_write_performed && !closeoutBoundary.release_published && !closeoutBoundary.git_operation_performed && !closeoutBoundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "promotion_receipt_approval_closeout_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-promotion-receipt-approval-closeout-gate-row.v1",
    promotion_receipt_approval_closeout_gate_row_id: `trading-promotion-receipt-approval-closeout-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    actor_workspace_input_present_by_closeout: false,
    merged_receipt_input_materialized_by_closeout: false,
    receipt_payload_present_by_closeout: false,
    ready_for_validation_by_closeout: false,
    ready_for_approval_application_by_closeout: false,
    receipt_received_by_closeout: false,
    receipt_validated_by_closeout: false,
    receipt_application_performed_by_closeout: false,
    approval_applied_by_closeout: false,
    promotion_enablement_allowed_by_closeout: false,
    receipt_approval_plan_artifact_read_performed_by_closeout: false,
    command_execution_performed_by_closeout: false,
    release_check_execution_performed_by_closeout: false,
    artifact_read_performed_by_closeout: false,
    artifact_write_performed_by_closeout: false,
    release_published_by_closeout: false,
    git_operation_performed_by_closeout: false,
    protected_action_executed_by_closeout: false,
    automatic_order_submission_allowed_by_closeout: false,
    live_execution_allowed_by_closeout: false,
    broker_write_allowed_by_closeout: false,
    exchange_write_allowed_by_closeout: false,
    human_review_required: true,
  };
}

function buildValidationItems({ approvalPlan, packageJson, platformOpsLedger, closeoutRows, closeoutGateRows, closeoutBoundary }) {
  return [
    validationItem("source.promotion_receipt_approval_plan", "p410_receipt_approval_plan_ready", approvalPlan.validation.valid && approvalPlan.summary.trading_promotion_receipt_approval_plan_fixtures_status === SOURCE_READY_STATUS, "P410 promotion receipt approval plan fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P411 promotion receipt approval closeout fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("promotion_receipt_approval_closeout_rows", "approval_closeout_rows_ready", closeoutRows.length === 6 && closeoutRows.every((row) => row.approval_closeout_status === APPROVAL_CLOSEOUT_READY_STATUS && row.approval_closeout_declared && row.approval_closeout_checks.length >= 8 && row.actor_workspace_required && !row.actor_workspace_input_present && !row.merged_receipt_input_materialized && !row.ready_for_approval_application), "Promotion receipt approval closeout rows must be ready for future approval closeout without payloads."),
    validationItem("promotion_receipt_approval_closeout_gate_rows", "approval_closeout_gates_ready", closeoutGateRows.length >= 8 && closeoutGateRows.every((row) => row.gate_status === "ready" && !row.approval_applied_by_closeout && !row.protected_action_executed_by_closeout), "P411 promotion receipt approval closeout gates are ready."),
    validationItem("boundary.no_receipt_payload_or_approval", "no_receipt_payload_or_approval", closeoutBoundary.read_only && closeoutBoundary.report_only && closeoutBoundary.receipt_approval_plan_consumed_in_memory && !closeoutBoundary.receipt_approval_plan_artifact_read_performed && closeoutBoundary.approval_closeout_declared && !closeoutBoundary.actor_workspace_input_present && !closeoutBoundary.receipt_input_file_materialized && !closeoutBoundary.merged_receipt_input_materialized && !closeoutBoundary.receipt_payload_present && !closeoutBoundary.ready_for_validation && !closeoutBoundary.ready_for_approval_application && !closeoutBoundary.receipt_received && !closeoutBoundary.receipt_validated && !closeoutBoundary.receipt_application_performed && !closeoutBoundary.approval_applied, "Promotion receipt approval closeout declares closeout rows without materializing, validating, or applying receipts."),
    validationItem("boundary.no_source_receipt_or_approval", "no_source_receipt_or_approval", !closeoutBoundary.source_receipt_present && !closeoutBoundary.source_approval_applied, "P411 must not inherit pre-applied promotion receipts or approvals."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !closeoutBoundary.command_execution_performed && !closeoutBoundary.package_command_execution_performed && !closeoutBoundary.release_check_execution_performed && !closeoutBoundary.artifact_read_performed && !closeoutBoundary.artifact_write_performed, "Promotion receipt approval closeout does not execute commands or read/write artifacts."),
    validationItem("boundary.no_trading_mutation", "no_trading_mutation", !closeoutBoundary.shadow_live_enabled && !closeoutBoundary.limited_live_enabled && !closeoutBoundary.full_auto_enabled && !closeoutBoundary.automatic_order_submission_allowed && !closeoutBoundary.live_order_submission_allowed && !closeoutBoundary.live_execution_allowed && !closeoutBoundary.broker_write_allowed && !closeoutBoundary.exchange_write_allowed && !closeoutBoundary.release_published && !closeoutBoundary.git_operation_performed && !closeoutBoundary.protected_action_executed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
  ];
}

function buildSummary({ approvalPlan, closeoutRows, closeoutGateRows, closeoutBoundary, validation }) {
  return {
    trading_promotion_receipt_approval_closeout_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_approval_plan_status: approvalPlan.summary.trading_promotion_receipt_approval_plan_fixtures_status,
    source_promotion_receipt_approval_plan_ready: closeoutBoundary.source_promotion_receipt_approval_plan_ready,
    approval_closeout_row_count: closeoutRows.length,
    ready_approval_closeout_row_count: closeoutBoundary.ready_approval_closeout_row_count,
    approval_closeout_gate_count: closeoutGateRows.length,
    ready_approval_closeout_gate_count: closeoutGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: closeoutBoundary.read_only,
    report_only: closeoutBoundary.report_only,
    receipt_approval_plan_consumed_in_memory: closeoutBoundary.receipt_approval_plan_consumed_in_memory,
    receipt_approval_plan_artifact_read_performed: closeoutBoundary.receipt_approval_plan_artifact_read_performed,
    approval_closeout_declared: closeoutBoundary.approval_closeout_declared,
    actor_workspace_input_present: closeoutBoundary.actor_workspace_input_present,
    receipt_input_file_materialized: closeoutBoundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: closeoutBoundary.merged_receipt_input_materialized,
    receipt_payload_present: closeoutBoundary.receipt_payload_present,
    ready_for_validation: closeoutBoundary.ready_for_validation,
    ready_for_approval_application: closeoutBoundary.ready_for_approval_application,
    receipt_received: closeoutBoundary.receipt_received,
    receipt_validated: closeoutBoundary.receipt_validated,
    receipt_application_performed: closeoutBoundary.receipt_application_performed,
    approval_applied: closeoutBoundary.approval_applied,
    source_receipt_present: closeoutBoundary.source_receipt_present,
    source_approval_applied: closeoutBoundary.source_approval_applied,
    real_enablement_count: closeoutBoundary.real_enablement_count,
    shadow_live_enabled: closeoutBoundary.shadow_live_enabled,
    limited_live_enabled: closeoutBoundary.limited_live_enabled,
    full_auto_enabled: closeoutBoundary.full_auto_enabled,
    automatic_order_submission_allowed: closeoutBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: closeoutBoundary.live_order_submission_allowed,
    live_promotion_allowed: closeoutBoundary.live_promotion_allowed,
    live_execution_allowed: closeoutBoundary.live_execution_allowed,
    broker_write_allowed: closeoutBoundary.broker_write_allowed,
    exchange_write_allowed: closeoutBoundary.exchange_write_allowed,
    command_execution_performed: closeoutBoundary.command_execution_performed,
    package_command_execution_performed: closeoutBoundary.package_command_execution_performed,
    release_check_execution_performed: closeoutBoundary.release_check_execution_performed,
    artifact_read_performed: closeoutBoundary.artifact_read_performed,
    artifact_write_performed: closeoutBoundary.artifact_write_performed,
    release_published: closeoutBoundary.release_published,
    git_operation_performed: closeoutBoundary.git_operation_performed,
    protected_action_executed: closeoutBoundary.protected_action_executed,
    human_review_required: closeoutBoundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Promotion Receipt Approval Closeout Fixtures",
    "",
    `Status: ${result.summary.trading_promotion_receipt_approval_closeout_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source approval plan: ${result.summary.source_promotion_receipt_approval_plan_status}`,
    `Approval closeout rows: ${result.summary.ready_approval_closeout_row_count}/${result.summary.approval_closeout_row_count}`,
    `Approval closeout gates: ${result.summary.ready_approval_closeout_gate_count}/${result.summary.approval_closeout_gate_count}`,
    "",
    "## Approval Closeout Rows",
    "",
    ...result.promotion_receipt_approval_closeout_rows.map((row) => `- ${row.source_queue_row_key}: ${row.approval_closeout_status}`),
    "",
    "## Gates",
    "",
    ...result.promotion_receipt_approval_closeout_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_OUT_DIR };
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
  console.log(`Usage: node scripts/trading-promotion-receipt-approval-closeout-fixtures.mjs [options]

Options:
  --out-dir <folder>                         Output directory. Default: ${DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_OUT_DIR}
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
  --schema <path>                            Output schema path.
  --check                                    Validate only, do not write artifacts.
  -h, --help                                 Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.platformOpsLedgerPath),
    promotion_receipt_workspace_fixtures_schema_path: path.resolve(options.promotionReceiptWorkspaceFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.promotionReceiptWorkspaceFixturesSchemaPath),
    promotion_receipt_workspace_merge_fixtures_schema_path: path.resolve(options.promotionReceiptWorkspaceMergeFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.promotionReceiptWorkspaceMergeFixturesSchemaPath),
    promotion_receipt_merge_preflight_fixtures_schema_path: path.resolve(options.promotionReceiptMergePreflightFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.promotionReceiptMergePreflightFixturesSchemaPath),
    promotion_receipt_validation_packet_fixtures_schema_path: path.resolve(options.promotionReceiptValidationPacketFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.promotionReceiptValidationPacketFixturesSchemaPath),
    promotion_receipt_approval_plan_fixtures_schema_path: path.resolve(options.promotionReceiptApprovalPlanFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.promotionReceiptApprovalPlanFixturesSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.schemaPath),
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
