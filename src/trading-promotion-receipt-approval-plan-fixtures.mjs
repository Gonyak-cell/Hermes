import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS,
  buildTradingPromotionReceiptValidationPacketFixtures,
} from "./trading-promotion-receipt-validation-packet-fixtures.mjs";

export const DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_PLAN_FIXTURES_OUT_DIR = "artifacts/trading-promotion-receipt-approval-plan-fixtures/latest";
export const DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS,
  promotionReceiptValidationPacketFixturesSchemaPath: DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-promotion-receipt-approval-plan-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-promotion-receipt-approval-plan-fixtures.v1";
const CAPABILITY_ID = "trading.promotion_receipt_approval_plan_fixtures";
const PHASE_SLOT = "P410";
const PREVIOUS_PHASE_SLOT = "P409";
const NEXT_PHASE_SLOT = "P411";
const READY_STATUS = "ready_for_trading_promotion_receipt_approval_plan_regression";
const SOURCE_READY_STATUS = "ready_for_trading_promotion_receipt_validation_packet_regression";
const APPROVAL_PLAN_READY_STATUS = "ready_for_future_promotion_receipt_approval_plan";
const APPROVAL_PLAN_CHECKS = [
  "validation_packet_ready",
  "future_receipt_decision_allows_promotion",
  "reviewer_role_matches_packet",
  "promotion_stage_matches",
  "evidence_reference_confirmed",
  "blocker_note_resolved_or_recorded",
  "human_gate_application_future_only",
  "live_trading_boundary_stays_false",
];

export async function runTradingPromotionReceiptApprovalPlanFixtures(options = {}) {
  const result = await buildTradingPromotionReceiptApprovalPlanFixtures(options);
  if (options.write !== false) await writeTradingPromotionReceiptApprovalPlanFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading promotion receipt approval plan fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingPromotionReceiptApprovalPlanFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_PLAN_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const validationPacket = await buildTradingPromotionReceiptValidationPacketFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    promotionReceiptWorkspaceFixturesSchemaPath: inputs.promotion_receipt_workspace_fixtures_schema_path,
    promotionReceiptWorkspaceMergeFixturesSchemaPath: inputs.promotion_receipt_workspace_merge_fixtures_schema_path,
    promotionReceiptMergePreflightFixturesSchemaPath: inputs.promotion_receipt_merge_preflight_fixtures_schema_path,
    schemaPath: inputs.promotion_receipt_validation_packet_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const planAnchor = buildPlanAnchor(validationPacket);
  const planRows = buildPlanRows(validationPacket);
  const planBoundary = buildPlanBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    validationPacket,
    planRows,
  });
  const planGateRows = buildPlanGateRows({ validationPacket, packageJson, platformOpsLedger, planRows, planBoundary });
  const validationItems = buildValidationItems({ validationPacket, packageJson, platformOpsLedger, planRows, planGateRows, planBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ validationPacket, planRows, planGateRows, planBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_promotion_receipt_approval_plan_fixtures_id: `trading-promotion-receipt-approval-plan-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    promotion_receipt_approval_plan_anchor: planAnchor,
    promotion_receipt_approval_plan_rows: planRows,
    promotion_receipt_approval_plan_gate_rows: planGateRows,
    promotion_receipt_approval_plan_boundary: planBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_promotion_receipt_approval_plan_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ validationPacket, planRows, planGateRows, planBoundary, validation: result.validation });
  result.summary.trading_promotion_receipt_approval_plan_fixtures_id = result.trading_promotion_receipt_approval_plan_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingPromotionReceiptApprovalPlanFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-promotion-receipt-approval-plan-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "promotion-receipt-approval-plan-rows.json"), collectionEnvelope("trading-promotion-receipt-approval-plan-rows.v1", "promotion_receipt_approval_plan_rows", result.promotion_receipt_approval_plan_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-approval-plan-gate-rows.json"), collectionEnvelope("trading-promotion-receipt-approval-plan-gate-rows.v1", "promotion_receipt_approval_plan_gate_rows", result.promotion_receipt_approval_plan_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-approval-plan-boundary.json"), result.promotion_receipt_approval_plan_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-promotion-receipt-approval-plan-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingPromotionReceiptApprovalPlanFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingPromotionReceiptApprovalPlanFixtures(args);
    console.log(`Trading promotion receipt approval plan fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_promotion_receipt_approval_plan_fixtures_status}`);
    console.log(`Approval plan rows: ${result.summary.ready_approval_plan_row_count}/${result.summary.approval_plan_row_count}`);
    console.log(`Approval plan gates: ${result.summary.ready_approval_plan_gate_count}/${result.summary.approval_plan_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPlanAnchor(validationPacket) {
  return {
    schema_version: "trading-promotion-receipt-approval-plan-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_validation_packet_fixtures_id: validationPacket.trading_promotion_receipt_validation_packet_fixtures_id,
    source_promotion_receipt_validation_packet_status: validationPacket.summary.trading_promotion_receipt_validation_packet_fixtures_status,
    source_hash: hashValue({
      id: validationPacket.trading_promotion_receipt_validation_packet_fixtures_id,
      status: validationPacket.summary.trading_promotion_receipt_validation_packet_fixtures_status,
      packet_rows: validationPacket.summary.packet_row_count,
      packet_gate_rows: validationPacket.summary.packet_gate_count,
    }),
  };
}

function buildPlanRows(validationPacket) {
  const sourceReady = validationPacket.validation.valid && validationPacket.summary.trading_promotion_receipt_validation_packet_fixtures_status === SOURCE_READY_STATUS;
  return validationPacket.promotion_receipt_validation_packet_rows.map((packetRow, index) => {
    const planStatus = sourceReady && packetRow.validation_packet_status === "ready_for_future_promotion_receipt_validation_packet" ? APPROVAL_PLAN_READY_STATUS : "blocked";
    const row = {
      schema_version: "trading-promotion-receipt-approval-plan-row.v1",
      promotion_receipt_approval_plan_row_id: `trading-promotion-receipt-approval-plan.row.${packetRow.source_queue_row_key}`,
      phase_slot: PHASE_SLOT,
      source_validation_packet_row_id: packetRow.promotion_receipt_validation_packet_row_id,
      source_queue_row_key: packetRow.source_queue_row_key,
      from_stage: packetRow.from_stage,
      to_stage: packetRow.to_stage,
      receipt_contract_id: packetRow.receipt_contract_id,
      approval_plan_status: planStatus,
      source_validation_packet_status: packetRow.validation_packet_status,
      actor_workspace_required: true,
      actor_workspace_input_present: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      approval_plan_declared: true,
      approval_plan_checks: APPROVAL_PLAN_CHECKS,
      ready_for_validation: false,
      ready_for_approval_application: false,
      receipt_received_by_plan: false,
      receipt_validated_by_plan: false,
      receipt_application_performed_by_plan: false,
      approval_applied_by_plan: false,
      promotion_enablement_allowed_by_plan: false,
      receipt_validation_packet_consumed_in_memory: true,
      receipt_validation_packet_artifact_read_performed_by_plan: false,
      command_execution_performed_by_plan: false,
      package_command_execution_performed_by_plan: false,
      release_check_execution_performed_by_plan: false,
      artifact_read_performed_by_plan: false,
      artifact_write_performed_by_plan: false,
      release_published_by_plan: false,
      git_operation_performed_by_plan: false,
      protected_action_executed_by_plan: false,
      shadow_live_enabled_by_plan: false,
      limited_live_enabled_by_plan: false,
      full_auto_enabled_by_plan: false,
      automatic_order_submission_allowed_by_plan: false,
      live_order_submission_allowed_by_plan: false,
      live_execution_allowed_by_plan: false,
      broker_write_allowed_by_plan: false,
      exchange_write_allowed_by_plan: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "promotion_receipt_approval_plan_hash");
  });
}

function buildPlanBoundary({ generatedAt, writeRequested, validationPacket, planRows }) {
  const sourceSummary = validationPacket.summary;
  return {
    schema_version: "trading-promotion-receipt-approval-plan-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    promotion_receipt_approval_plan_artifact_write_requested: writeRequested,
    source_promotion_receipt_validation_packet_status: sourceSummary.trading_promotion_receipt_validation_packet_fixtures_status,
    source_promotion_receipt_validation_packet_ready: validationPacket.validation.valid && sourceSummary.trading_promotion_receipt_validation_packet_fixtures_status === SOURCE_READY_STATUS,
    approval_plan_row_count: planRows.length,
    ready_approval_plan_row_count: planRows.filter((row) => row.approval_plan_status === APPROVAL_PLAN_READY_STATUS).length,
    receipt_validation_packet_consumed_in_memory: true,
    receipt_validation_packet_artifact_read_performed: false,
    approval_plan_declared: true,
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

function buildPlanGateRows({ validationPacket, packageJson, platformOpsLedger, planRows, planBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p409_receipt_validation_packet_ready", "P409 promotion receipt validation packet source is ready.", validationPacket.validation.valid && validationPacket.summary.trading_promotion_receipt_validation_packet_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P410 trading promotion receipt approval plan fixtures command.", typeof scripts["trading:promotion-receipt-approval-plan-fixtures"] === "string" && scripts["trading:promotion-receipt-approval-plan-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P410 trading promotion receipt approval plan fixtures command.", validateScript.includes("npm run trading:promotion-receipt-approval-plan-fixtures -- --check")),
    gateRow("p410_ledger_acceptance_declared", "P410 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P410: `trading:promotion-receipt-approval-plan-fixtures`")),
    gateRow("approval_plan_rows_ready", "All promotion receipt approval plan rows are ready for future approval planning.", planRows.length === 6 && planRows.every((row) => row.approval_plan_status === APPROVAL_PLAN_READY_STATUS && row.approval_plan_declared && row.actor_workspace_required && !row.actor_workspace_input_present && !row.merged_receipt_input_materialized && !row.receipt_payload_present && !row.ready_for_approval_application)),
    gateRow("no_receipt_payload_or_approval", "Approval plan does not read actor files, materialize merged receipt input, receive payloads, validate receipts, or apply approvals.", !planBoundary.actor_workspace_input_present && !planBoundary.receipt_input_file_materialized && !planBoundary.merged_receipt_input_materialized && !planBoundary.receipt_payload_present && !planBoundary.ready_for_validation && !planBoundary.ready_for_approval_application && !planBoundary.receipt_received && !planBoundary.receipt_validated && !planBoundary.receipt_application_performed && !planBoundary.approval_applied),
    gateRow("live_and_full_auto_enablement_blocked", "P410 plan does not enable shadow, limited-live, full-auto, live execution, order submission, broker writes, or exchange writes.", !planBoundary.shadow_live_enabled && !planBoundary.limited_live_enabled && !planBoundary.full_auto_enabled && !planBoundary.automatic_order_submission_allowed && !planBoundary.live_order_submission_allowed && !planBoundary.live_execution_allowed && !planBoundary.broker_write_allowed && !planBoundary.exchange_write_allowed),
    gateRow("no_command_or_artifact_mutation", "P410 plan does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !planBoundary.command_execution_performed && !planBoundary.artifact_read_performed && !planBoundary.artifact_write_performed && !planBoundary.release_published && !planBoundary.git_operation_performed && !planBoundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "promotion_receipt_approval_plan_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-promotion-receipt-approval-plan-gate-row.v1",
    promotion_receipt_approval_plan_gate_row_id: `trading-promotion-receipt-approval-plan-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    actor_workspace_input_present_by_plan: false,
    merged_receipt_input_materialized_by_plan: false,
    receipt_payload_present_by_plan: false,
    ready_for_validation_by_plan: false,
    ready_for_approval_application_by_plan: false,
    receipt_received_by_plan: false,
    receipt_validated_by_plan: false,
    receipt_application_performed_by_plan: false,
    approval_applied_by_plan: false,
    promotion_enablement_allowed_by_plan: false,
    receipt_validation_packet_artifact_read_performed_by_plan: false,
    command_execution_performed_by_plan: false,
    release_check_execution_performed_by_plan: false,
    artifact_read_performed_by_plan: false,
    artifact_write_performed_by_plan: false,
    release_published_by_plan: false,
    git_operation_performed_by_plan: false,
    protected_action_executed_by_plan: false,
    automatic_order_submission_allowed_by_plan: false,
    live_execution_allowed_by_plan: false,
    broker_write_allowed_by_plan: false,
    exchange_write_allowed_by_plan: false,
    human_review_required: true,
  };
}

function buildValidationItems({ validationPacket, packageJson, platformOpsLedger, planRows, planGateRows, planBoundary }) {
  return [
    validationItem("source.promotion_receipt_validation_packet", "p409_receipt_validation_packet_ready", validationPacket.validation.valid && validationPacket.summary.trading_promotion_receipt_validation_packet_fixtures_status === SOURCE_READY_STATUS, "P409 promotion receipt validation packet fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P410 promotion receipt approval plan fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("promotion_receipt_approval_plan_rows", "approval_plan_rows_ready", planRows.length === 6 && planRows.every((row) => row.approval_plan_status === APPROVAL_PLAN_READY_STATUS && row.approval_plan_declared && row.approval_plan_checks.length >= 8 && row.actor_workspace_required && !row.actor_workspace_input_present && !row.merged_receipt_input_materialized && !row.ready_for_approval_application), "Promotion receipt approval plan rows must be ready for future approval planning without payloads."),
    validationItem("promotion_receipt_approval_plan_gate_rows", "approval_plan_gates_ready", planGateRows.length >= 8 && planGateRows.every((row) => row.gate_status === "ready" && !row.approval_applied_by_plan && !row.protected_action_executed_by_plan), "P410 promotion receipt approval plan gates are ready."),
    validationItem("boundary.no_receipt_payload_or_approval", "no_receipt_payload_or_approval", planBoundary.read_only && planBoundary.report_only && planBoundary.receipt_validation_packet_consumed_in_memory && !planBoundary.receipt_validation_packet_artifact_read_performed && planBoundary.approval_plan_declared && !planBoundary.actor_workspace_input_present && !planBoundary.receipt_input_file_materialized && !planBoundary.merged_receipt_input_materialized && !planBoundary.receipt_payload_present && !planBoundary.ready_for_validation && !planBoundary.ready_for_approval_application && !planBoundary.receipt_received && !planBoundary.receipt_validated && !planBoundary.receipt_application_performed && !planBoundary.approval_applied, "Promotion receipt approval plan declares plan rows without materializing, validating, or applying receipts."),
    validationItem("boundary.no_source_receipt_or_approval", "no_source_receipt_or_approval", !planBoundary.source_receipt_present && !planBoundary.source_approval_applied, "P410 must not inherit pre-applied promotion receipts or approvals."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !planBoundary.command_execution_performed && !planBoundary.package_command_execution_performed && !planBoundary.release_check_execution_performed && !planBoundary.artifact_read_performed && !planBoundary.artifact_write_performed, "Promotion receipt approval plan does not execute commands or read/write artifacts."),
    validationItem("boundary.no_trading_mutation", "no_trading_mutation", !planBoundary.shadow_live_enabled && !planBoundary.limited_live_enabled && !planBoundary.full_auto_enabled && !planBoundary.automatic_order_submission_allowed && !planBoundary.live_order_submission_allowed && !planBoundary.live_execution_allowed && !planBoundary.broker_write_allowed && !planBoundary.exchange_write_allowed && !planBoundary.release_published && !planBoundary.git_operation_performed && !planBoundary.protected_action_executed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
  ];
}

function buildSummary({ validationPacket, planRows, planGateRows, planBoundary, validation }) {
  return {
    trading_promotion_receipt_approval_plan_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_validation_packet_status: validationPacket.summary.trading_promotion_receipt_validation_packet_fixtures_status,
    source_promotion_receipt_validation_packet_ready: planBoundary.source_promotion_receipt_validation_packet_ready,
    approval_plan_row_count: planRows.length,
    ready_approval_plan_row_count: planBoundary.ready_approval_plan_row_count,
    approval_plan_gate_count: planGateRows.length,
    ready_approval_plan_gate_count: planGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: planBoundary.read_only,
    report_only: planBoundary.report_only,
    receipt_validation_packet_consumed_in_memory: planBoundary.receipt_validation_packet_consumed_in_memory,
    receipt_validation_packet_artifact_read_performed: planBoundary.receipt_validation_packet_artifact_read_performed,
    approval_plan_declared: planBoundary.approval_plan_declared,
    actor_workspace_input_present: planBoundary.actor_workspace_input_present,
    receipt_input_file_materialized: planBoundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: planBoundary.merged_receipt_input_materialized,
    receipt_payload_present: planBoundary.receipt_payload_present,
    ready_for_validation: planBoundary.ready_for_validation,
    ready_for_approval_application: planBoundary.ready_for_approval_application,
    receipt_received: planBoundary.receipt_received,
    receipt_validated: planBoundary.receipt_validated,
    receipt_application_performed: planBoundary.receipt_application_performed,
    approval_applied: planBoundary.approval_applied,
    source_receipt_present: planBoundary.source_receipt_present,
    source_approval_applied: planBoundary.source_approval_applied,
    real_enablement_count: planBoundary.real_enablement_count,
    shadow_live_enabled: planBoundary.shadow_live_enabled,
    limited_live_enabled: planBoundary.limited_live_enabled,
    full_auto_enabled: planBoundary.full_auto_enabled,
    automatic_order_submission_allowed: planBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: planBoundary.live_order_submission_allowed,
    live_promotion_allowed: planBoundary.live_promotion_allowed,
    live_execution_allowed: planBoundary.live_execution_allowed,
    broker_write_allowed: planBoundary.broker_write_allowed,
    exchange_write_allowed: planBoundary.exchange_write_allowed,
    command_execution_performed: planBoundary.command_execution_performed,
    package_command_execution_performed: planBoundary.package_command_execution_performed,
    release_check_execution_performed: planBoundary.release_check_execution_performed,
    artifact_read_performed: planBoundary.artifact_read_performed,
    artifact_write_performed: planBoundary.artifact_write_performed,
    release_published: planBoundary.release_published,
    git_operation_performed: planBoundary.git_operation_performed,
    protected_action_executed: planBoundary.protected_action_executed,
    human_review_required: planBoundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Promotion Receipt Approval Plan Fixtures",
    "",
    `Status: ${result.summary.trading_promotion_receipt_approval_plan_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source validation packet: ${result.summary.source_promotion_receipt_validation_packet_status}`,
    `Approval plan rows: ${result.summary.ready_approval_plan_row_count}/${result.summary.approval_plan_row_count}`,
    `Approval plan gates: ${result.summary.ready_approval_plan_gate_count}/${result.summary.approval_plan_gate_count}`,
    "",
    "## Approval Plan Rows",
    "",
    ...result.promotion_receipt_approval_plan_rows.map((row) => `- ${row.source_queue_row_key}: ${row.approval_plan_status}`),
    "",
    "## Gates",
    "",
    ...result.promotion_receipt_approval_plan_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_PLAN_FIXTURES_OUT_DIR };
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
  console.log(`Usage: node scripts/trading-promotion-receipt-approval-plan-fixtures.mjs [options]

Options:
  --out-dir <folder>                         Output directory. Default: ${DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_PLAN_FIXTURES_OUT_DIR}
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
  --schema <path>                            Output schema path.
  --check                                    Validate only, do not write artifacts.
  -h, --help                                 Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.platformOpsLedgerPath),
    promotion_receipt_workspace_fixtures_schema_path: path.resolve(options.promotionReceiptWorkspaceFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.promotionReceiptWorkspaceFixturesSchemaPath),
    promotion_receipt_workspace_merge_fixtures_schema_path: path.resolve(options.promotionReceiptWorkspaceMergeFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.promotionReceiptWorkspaceMergeFixturesSchemaPath),
    promotion_receipt_merge_preflight_fixtures_schema_path: path.resolve(options.promotionReceiptMergePreflightFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.promotionReceiptMergePreflightFixturesSchemaPath),
    promotion_receipt_validation_packet_fixtures_schema_path: path.resolve(options.promotionReceiptValidationPacketFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.promotionReceiptValidationPacketFixturesSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_APPROVAL_PLAN_FIXTURES_INPUTS.schemaPath),
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
