import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS,
  buildTradingPromotionReceiptWorkspaceMergeFixtures,
} from "./trading-promotion-receipt-workspace-merge-fixtures.mjs";

export const DEFAULT_TRADING_PROMOTION_RECEIPT_MERGE_PREFLIGHT_FIXTURES_OUT_DIR = "artifacts/trading-promotion-receipt-merge-preflight-fixtures/latest";
export const DEFAULT_TRADING_PROMOTION_RECEIPT_MERGE_PREFLIGHT_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS,
  promotionReceiptWorkspaceMergeFixturesSchemaPath: DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-promotion-receipt-merge-preflight-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-promotion-receipt-merge-preflight-fixtures.v1";
const CAPABILITY_ID = "trading.promotion_receipt_merge_preflight_fixtures";
const PHASE_SLOT = "P408";
const PREVIOUS_PHASE_SLOT = "P407";
const NEXT_PHASE_SLOT = "P409";
const READY_STATUS = "ready_for_trading_promotion_receipt_merge_preflight_regression";
const SOURCE_READY_STATUS = "ready_for_trading_promotion_receipt_workspace_merge_regression";
const PREFLIGHT_READY_STATUS = "ready_for_future_promotion_receipt_merge_validation";
const FUTURE_VALIDATION_CHECKS = [
  "reviewer_id_present",
  "reviewed_at_iso_timestamp",
  "source_queue_row_key_matches",
  "receipt_contract_id_matches",
  "promotion_stage_matches",
  "decision_allowed",
  "evidence_reference_present",
  "blocker_note_present",
];

export async function runTradingPromotionReceiptMergePreflightFixtures(options = {}) {
  const result = await buildTradingPromotionReceiptMergePreflightFixtures(options);
  if (options.write !== false) await writeTradingPromotionReceiptMergePreflightFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading promotion receipt merge preflight fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingPromotionReceiptMergePreflightFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_PROMOTION_RECEIPT_MERGE_PREFLIGHT_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const workspaceMerge = await buildTradingPromotionReceiptWorkspaceMergeFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    promotionReceiptWorkspaceFixturesSchemaPath: inputs.promotion_receipt_workspace_fixtures_schema_path,
    schemaPath: inputs.promotion_receipt_workspace_merge_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const preflightAnchor = buildPreflightAnchor(workspaceMerge);
  const preflightRows = buildPreflightRows(workspaceMerge);
  const preflightBoundary = buildPreflightBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    workspaceMerge,
    preflightRows,
  });
  const preflightGateRows = buildPreflightGateRows({ workspaceMerge, packageJson, platformOpsLedger, preflightRows, preflightBoundary });
  const validationItems = buildValidationItems({ workspaceMerge, packageJson, platformOpsLedger, preflightRows, preflightGateRows, preflightBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ workspaceMerge, preflightRows, preflightGateRows, preflightBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_promotion_receipt_merge_preflight_fixtures_id: `trading-promotion-receipt-merge-preflight-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    promotion_receipt_merge_preflight_anchor: preflightAnchor,
    promotion_receipt_merge_preflight_rows: preflightRows,
    promotion_receipt_merge_preflight_gate_rows: preflightGateRows,
    promotion_receipt_merge_preflight_boundary: preflightBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_promotion_receipt_merge_preflight_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ workspaceMerge, preflightRows, preflightGateRows, preflightBoundary, validation: result.validation });
  result.summary.trading_promotion_receipt_merge_preflight_fixtures_id = result.trading_promotion_receipt_merge_preflight_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingPromotionReceiptMergePreflightFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-promotion-receipt-merge-preflight-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "promotion-receipt-merge-preflight-rows.json"), collectionEnvelope("trading-promotion-receipt-merge-preflight-rows.v1", "promotion_receipt_merge_preflight_rows", result.promotion_receipt_merge_preflight_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-merge-preflight-gate-rows.json"), collectionEnvelope("trading-promotion-receipt-merge-preflight-gate-rows.v1", "promotion_receipt_merge_preflight_gate_rows", result.promotion_receipt_merge_preflight_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-merge-preflight-boundary.json"), result.promotion_receipt_merge_preflight_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-promotion-receipt-merge-preflight-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingPromotionReceiptMergePreflightFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingPromotionReceiptMergePreflightFixtures(args);
    console.log(`Trading promotion receipt merge preflight fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_promotion_receipt_merge_preflight_fixtures_status}`);
    console.log(`Preflight rows: ${result.summary.ready_preflight_row_count}/${result.summary.preflight_row_count}`);
    console.log(`Preflight gates: ${result.summary.ready_preflight_gate_count}/${result.summary.preflight_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPreflightAnchor(workspaceMerge) {
  return {
    schema_version: "trading-promotion-receipt-merge-preflight-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_workspace_merge_fixtures_id: workspaceMerge.trading_promotion_receipt_workspace_merge_fixtures_id,
    source_promotion_receipt_workspace_merge_status: workspaceMerge.summary.trading_promotion_receipt_workspace_merge_fixtures_status,
    source_hash: hashValue({
      id: workspaceMerge.trading_promotion_receipt_workspace_merge_fixtures_id,
      status: workspaceMerge.summary.trading_promotion_receipt_workspace_merge_fixtures_status,
      merge_rows: workspaceMerge.summary.merge_row_count,
      merge_gate_rows: workspaceMerge.summary.gate_count,
    }),
  };
}

function buildPreflightRows(workspaceMerge) {
  const sourceReady = workspaceMerge.validation.valid && workspaceMerge.summary.trading_promotion_receipt_workspace_merge_fixtures_status === SOURCE_READY_STATUS;
  return workspaceMerge.promotion_receipt_workspace_merge_rows.map((mergeRow, index) => {
    const preflightStatus = sourceReady && mergeRow.merge_status === "ready_for_future_receipt_merge" ? PREFLIGHT_READY_STATUS : "blocked";
    const row = {
      schema_version: "trading-promotion-receipt-merge-preflight-row.v1",
      promotion_receipt_merge_preflight_row_id: `trading-promotion-receipt-merge-preflight.row.${mergeRow.source_queue_row_key}`,
      phase_slot: PHASE_SLOT,
      source_workspace_merge_row_id: mergeRow.promotion_receipt_workspace_merge_row_id,
      source_queue_row_key: mergeRow.source_queue_row_key,
      from_stage: mergeRow.from_stage,
      to_stage: mergeRow.to_stage,
      receipt_contract_id: mergeRow.receipt_contract_id,
      preflight_status: preflightStatus,
      source_workspace_merge_status: mergeRow.merge_status,
      actor_workspace_required: true,
      actor_workspace_input_present: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      merge_validation_preflight_declared: true,
      future_validation_checks: FUTURE_VALIDATION_CHECKS,
      ready_for_validation: false,
      receipt_received_by_preflight: false,
      receipt_validated_by_preflight: false,
      receipt_application_performed_by_preflight: false,
      approval_applied_by_preflight: false,
      promotion_enablement_allowed_by_preflight: false,
      receipt_workspace_merge_consumed_in_memory: true,
      receipt_workspace_merge_artifact_read_performed_by_preflight: false,
      command_execution_performed_by_preflight: false,
      package_command_execution_performed_by_preflight: false,
      release_check_execution_performed_by_preflight: false,
      artifact_read_performed_by_preflight: false,
      artifact_write_performed_by_preflight: false,
      release_published_by_preflight: false,
      git_operation_performed_by_preflight: false,
      protected_action_executed_by_preflight: false,
      shadow_live_enabled_by_preflight: false,
      limited_live_enabled_by_preflight: false,
      full_auto_enabled_by_preflight: false,
      automatic_order_submission_allowed_by_preflight: false,
      live_order_submission_allowed_by_preflight: false,
      live_execution_allowed_by_preflight: false,
      broker_write_allowed_by_preflight: false,
      exchange_write_allowed_by_preflight: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "promotion_receipt_merge_preflight_hash");
  });
}

function buildPreflightBoundary({ generatedAt, writeRequested, workspaceMerge, preflightRows }) {
  const sourceSummary = workspaceMerge.summary;
  return {
    schema_version: "trading-promotion-receipt-merge-preflight-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    promotion_receipt_merge_preflight_artifact_write_requested: writeRequested,
    source_promotion_receipt_workspace_merge_status: sourceSummary.trading_promotion_receipt_workspace_merge_fixtures_status,
    source_promotion_receipt_workspace_merge_ready: workspaceMerge.validation.valid && sourceSummary.trading_promotion_receipt_workspace_merge_fixtures_status === SOURCE_READY_STATUS,
    preflight_row_count: preflightRows.length,
    ready_preflight_row_count: preflightRows.filter((row) => row.preflight_status === PREFLIGHT_READY_STATUS).length,
    receipt_workspace_merge_consumed_in_memory: true,
    receipt_workspace_merge_artifact_read_performed: false,
    merge_validation_preflight_declared: true,
    actor_workspace_input_present: false,
    receipt_input_file_materialized: false,
    merged_receipt_input_materialized: false,
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

function buildPreflightGateRows({ workspaceMerge, packageJson, platformOpsLedger, preflightRows, preflightBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p407_receipt_workspace_merge_ready", "P407 promotion receipt workspace merge source is ready.", workspaceMerge.validation.valid && workspaceMerge.summary.trading_promotion_receipt_workspace_merge_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P408 trading promotion receipt merge preflight fixtures command.", typeof scripts["trading:promotion-receipt-merge-preflight-fixtures"] === "string" && scripts["trading:promotion-receipt-merge-preflight-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P408 trading promotion receipt merge preflight fixtures command.", validateScript.includes("npm run trading:promotion-receipt-merge-preflight-fixtures -- --check")),
    gateRow("p408_ledger_acceptance_declared", "P408 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P408: `trading:promotion-receipt-merge-preflight-fixtures`")),
    gateRow("preflight_rows_ready", "All promotion receipt merge preflight rows are ready for future validation.", preflightRows.length === 6 && preflightRows.every((row) => row.preflight_status === PREFLIGHT_READY_STATUS && row.merge_validation_preflight_declared && row.actor_workspace_required && !row.actor_workspace_input_present && !row.merged_receipt_input_materialized && !row.receipt_payload_present && !row.ready_for_validation)),
    gateRow("no_receipt_payload_validation", "Preflight does not read actor files, materialize merged receipt input, receive payloads, or validate receipts.", !preflightBoundary.actor_workspace_input_present && !preflightBoundary.receipt_input_file_materialized && !preflightBoundary.merged_receipt_input_materialized && !preflightBoundary.receipt_payload_present && !preflightBoundary.ready_for_validation && !preflightBoundary.receipt_received && !preflightBoundary.receipt_validated && !preflightBoundary.receipt_application_performed && !preflightBoundary.approval_applied),
    gateRow("live_and_full_auto_enablement_blocked", "P408 preflight does not enable shadow, limited-live, full-auto, live execution, order submission, broker writes, or exchange writes.", !preflightBoundary.shadow_live_enabled && !preflightBoundary.limited_live_enabled && !preflightBoundary.full_auto_enabled && !preflightBoundary.automatic_order_submission_allowed && !preflightBoundary.live_order_submission_allowed && !preflightBoundary.live_execution_allowed && !preflightBoundary.broker_write_allowed && !preflightBoundary.exchange_write_allowed),
    gateRow("no_command_or_artifact_mutation", "P408 preflight does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !preflightBoundary.command_execution_performed && !preflightBoundary.artifact_read_performed && !preflightBoundary.artifact_write_performed && !preflightBoundary.release_published && !preflightBoundary.git_operation_performed && !preflightBoundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "promotion_receipt_merge_preflight_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-promotion-receipt-merge-preflight-gate-row.v1",
    promotion_receipt_merge_preflight_gate_row_id: `trading-promotion-receipt-merge-preflight-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    actor_workspace_input_present_by_preflight: false,
    merged_receipt_input_materialized_by_preflight: false,
    receipt_payload_present_by_preflight: false,
    ready_for_validation_by_preflight: false,
    receipt_received_by_preflight: false,
    receipt_validated_by_preflight: false,
    receipt_application_performed_by_preflight: false,
    approval_applied_by_preflight: false,
    promotion_enablement_allowed_by_preflight: false,
    receipt_workspace_merge_artifact_read_performed_by_preflight: false,
    command_execution_performed_by_preflight: false,
    release_check_execution_performed_by_preflight: false,
    artifact_read_performed_by_preflight: false,
    artifact_write_performed_by_preflight: false,
    release_published_by_preflight: false,
    git_operation_performed_by_preflight: false,
    protected_action_executed_by_preflight: false,
    automatic_order_submission_allowed_by_preflight: false,
    live_execution_allowed_by_preflight: false,
    broker_write_allowed_by_preflight: false,
    exchange_write_allowed_by_preflight: false,
    human_review_required: true,
  };
}

function buildValidationItems({ workspaceMerge, packageJson, platformOpsLedger, preflightRows, preflightGateRows, preflightBoundary }) {
  return [
    validationItem("source.promotion_receipt_workspace_merge", "p407_receipt_workspace_merge_ready", workspaceMerge.validation.valid && workspaceMerge.summary.trading_promotion_receipt_workspace_merge_fixtures_status === SOURCE_READY_STATUS, "P407 promotion receipt workspace merge fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P408 promotion receipt merge preflight fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("promotion_receipt_merge_preflight_rows", "preflight_rows_ready", preflightRows.length === 6 && preflightRows.every((row) => row.preflight_status === PREFLIGHT_READY_STATUS && row.merge_validation_preflight_declared && row.future_validation_checks.length >= 8 && row.actor_workspace_required && !row.actor_workspace_input_present && !row.merged_receipt_input_materialized && !row.ready_for_validation), "Promotion receipt merge preflight rows must be ready for future validation without payloads."),
    validationItem("promotion_receipt_merge_preflight_gate_rows", "preflight_gates_ready", preflightGateRows.length >= 8 && preflightGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_preflight && !row.protected_action_executed_by_preflight), "P408 promotion receipt merge preflight gates are ready."),
    validationItem("boundary.no_receipt_payload", "no_receipt_payload", preflightBoundary.read_only && preflightBoundary.report_only && preflightBoundary.receipt_workspace_merge_consumed_in_memory && !preflightBoundary.receipt_workspace_merge_artifact_read_performed && preflightBoundary.merge_validation_preflight_declared && !preflightBoundary.actor_workspace_input_present && !preflightBoundary.receipt_input_file_materialized && !preflightBoundary.merged_receipt_input_materialized && !preflightBoundary.receipt_payload_present && !preflightBoundary.ready_for_validation && !preflightBoundary.receipt_received && !preflightBoundary.receipt_validated && !preflightBoundary.receipt_application_performed && !preflightBoundary.approval_applied, "Promotion receipt merge preflight declares validation preflight rows without materializing or validating receipts."),
    validationItem("boundary.no_source_receipt_or_approval", "no_source_receipt_or_approval", !preflightBoundary.source_receipt_present && !preflightBoundary.source_approval_applied, "P408 must not inherit pre-applied promotion receipts or approvals."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !preflightBoundary.command_execution_performed && !preflightBoundary.package_command_execution_performed && !preflightBoundary.release_check_execution_performed && !preflightBoundary.artifact_read_performed && !preflightBoundary.artifact_write_performed, "Promotion receipt merge preflight does not execute commands or read/write artifacts."),
    validationItem("boundary.no_trading_mutation", "no_trading_mutation", !preflightBoundary.shadow_live_enabled && !preflightBoundary.limited_live_enabled && !preflightBoundary.full_auto_enabled && !preflightBoundary.automatic_order_submission_allowed && !preflightBoundary.live_order_submission_allowed && !preflightBoundary.live_execution_allowed && !preflightBoundary.broker_write_allowed && !preflightBoundary.exchange_write_allowed && !preflightBoundary.release_published && !preflightBoundary.git_operation_performed && !preflightBoundary.protected_action_executed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
  ];
}

function buildSummary({ workspaceMerge, preflightRows, preflightGateRows, preflightBoundary, validation }) {
  return {
    trading_promotion_receipt_merge_preflight_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_workspace_merge_status: workspaceMerge.summary.trading_promotion_receipt_workspace_merge_fixtures_status,
    source_promotion_receipt_workspace_merge_ready: preflightBoundary.source_promotion_receipt_workspace_merge_ready,
    preflight_row_count: preflightRows.length,
    ready_preflight_row_count: preflightBoundary.ready_preflight_row_count,
    preflight_gate_count: preflightGateRows.length,
    ready_preflight_gate_count: preflightGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: preflightBoundary.read_only,
    report_only: preflightBoundary.report_only,
    receipt_workspace_merge_consumed_in_memory: preflightBoundary.receipt_workspace_merge_consumed_in_memory,
    receipt_workspace_merge_artifact_read_performed: preflightBoundary.receipt_workspace_merge_artifact_read_performed,
    merge_validation_preflight_declared: preflightBoundary.merge_validation_preflight_declared,
    actor_workspace_input_present: preflightBoundary.actor_workspace_input_present,
    receipt_input_file_materialized: preflightBoundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: preflightBoundary.merged_receipt_input_materialized,
    receipt_payload_present: preflightBoundary.receipt_payload_present,
    ready_for_validation: preflightBoundary.ready_for_validation,
    receipt_received: preflightBoundary.receipt_received,
    receipt_validated: preflightBoundary.receipt_validated,
    receipt_application_performed: preflightBoundary.receipt_application_performed,
    approval_applied: preflightBoundary.approval_applied,
    source_receipt_present: preflightBoundary.source_receipt_present,
    source_approval_applied: preflightBoundary.source_approval_applied,
    real_enablement_count: preflightBoundary.real_enablement_count,
    shadow_live_enabled: preflightBoundary.shadow_live_enabled,
    limited_live_enabled: preflightBoundary.limited_live_enabled,
    full_auto_enabled: preflightBoundary.full_auto_enabled,
    automatic_order_submission_allowed: preflightBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: preflightBoundary.live_order_submission_allowed,
    live_promotion_allowed: preflightBoundary.live_promotion_allowed,
    live_execution_allowed: preflightBoundary.live_execution_allowed,
    broker_write_allowed: preflightBoundary.broker_write_allowed,
    exchange_write_allowed: preflightBoundary.exchange_write_allowed,
    command_execution_performed: preflightBoundary.command_execution_performed,
    package_command_execution_performed: preflightBoundary.package_command_execution_performed,
    release_check_execution_performed: preflightBoundary.release_check_execution_performed,
    artifact_read_performed: preflightBoundary.artifact_read_performed,
    artifact_write_performed: preflightBoundary.artifact_write_performed,
    release_published: preflightBoundary.release_published,
    git_operation_performed: preflightBoundary.git_operation_performed,
    protected_action_executed: preflightBoundary.protected_action_executed,
    human_review_required: preflightBoundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Promotion Receipt Merge Preflight Fixtures",
    "",
    `Status: ${result.summary.trading_promotion_receipt_merge_preflight_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source workspace merge: ${result.summary.source_promotion_receipt_workspace_merge_status}`,
    `Preflight rows: ${result.summary.ready_preflight_row_count}/${result.summary.preflight_row_count}`,
    `Preflight gates: ${result.summary.ready_preflight_gate_count}/${result.summary.preflight_gate_count}`,
    "",
    "## Preflight Rows",
    "",
    ...result.promotion_receipt_merge_preflight_rows.map((row) => `- ${row.source_queue_row_key}: ${row.preflight_status}`),
    "",
    "## Gates",
    "",
    ...result.promotion_receipt_merge_preflight_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_PROMOTION_RECEIPT_MERGE_PREFLIGHT_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--promotion-receipt-workspace-fixtures-schema") parsed.promotionReceiptWorkspaceFixturesSchemaPath = argv[++index];
    else if (arg === "--promotion-receipt-workspace-merge-fixtures-schema") parsed.promotionReceiptWorkspaceMergeFixturesSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-promotion-receipt-merge-preflight-fixtures.mjs [options]

Options:
  --out-dir <folder>                         Output directory. Default: ${DEFAULT_TRADING_PROMOTION_RECEIPT_MERGE_PREFLIGHT_FIXTURES_OUT_DIR}
  --run-at <iso>                             Deterministic generated_at timestamp.
  --package <path>                           package.json path.
  --platform-ops-ledger <path>               P341-P500 platform operations ledger path.
  --promotion-receipt-workspace-fixtures-schema <path>
                                             P406 promotion receipt workspace fixtures schema path.
  --promotion-receipt-workspace-merge-fixtures-schema <path>
                                             P407 promotion receipt workspace merge fixtures schema path.
  --schema <path>                            Output schema path.
  --check                                    Validate only, do not write artifacts.
  -h, --help                                 Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_MERGE_PREFLIGHT_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_MERGE_PREFLIGHT_FIXTURES_INPUTS.platformOpsLedgerPath),
    promotion_receipt_workspace_fixtures_schema_path: path.resolve(options.promotionReceiptWorkspaceFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_MERGE_PREFLIGHT_FIXTURES_INPUTS.promotionReceiptWorkspaceFixturesSchemaPath),
    promotion_receipt_workspace_merge_fixtures_schema_path: path.resolve(options.promotionReceiptWorkspaceMergeFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_MERGE_PREFLIGHT_FIXTURES_INPUTS.promotionReceiptWorkspaceMergeFixturesSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_MERGE_PREFLIGHT_FIXTURES_INPUTS.schemaPath),
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
