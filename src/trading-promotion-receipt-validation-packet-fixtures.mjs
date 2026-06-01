import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_PROMOTION_RECEIPT_MERGE_PREFLIGHT_FIXTURES_INPUTS,
  buildTradingPromotionReceiptMergePreflightFixtures,
} from "./trading-promotion-receipt-merge-preflight-fixtures.mjs";

export const DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_PACKET_FIXTURES_OUT_DIR = "artifacts/trading-promotion-receipt-validation-packet-fixtures/latest";
export const DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_PROMOTION_RECEIPT_MERGE_PREFLIGHT_FIXTURES_INPUTS,
  promotionReceiptMergePreflightFixturesSchemaPath: DEFAULT_TRADING_PROMOTION_RECEIPT_MERGE_PREFLIGHT_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-promotion-receipt-validation-packet-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-promotion-receipt-validation-packet-fixtures.v1";
const CAPABILITY_ID = "trading.promotion_receipt_validation_packet_fixtures";
const PHASE_SLOT = "P409";
const PREVIOUS_PHASE_SLOT = "P408";
const NEXT_PHASE_SLOT = "P410";
const READY_STATUS = "ready_for_trading_promotion_receipt_validation_packet_regression";
const SOURCE_READY_STATUS = "ready_for_trading_promotion_receipt_merge_preflight_regression";
const PACKET_READY_STATUS = "ready_for_future_promotion_receipt_validation_packet";
const VALIDATION_PACKET_CHECKS = [
  "reviewer_id_present",
  "reviewed_at_iso_timestamp",
  "source_queue_row_key_matches",
  "receipt_contract_id_matches",
  "promotion_stage_matches",
  "decision_allowed",
  "evidence_reference_present",
  "blocker_note_present",
];

export async function runTradingPromotionReceiptValidationPacketFixtures(options = {}) {
  const result = await buildTradingPromotionReceiptValidationPacketFixtures(options);
  if (options.write !== false) await writeTradingPromotionReceiptValidationPacketFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading promotion receipt validation packet fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingPromotionReceiptValidationPacketFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_PACKET_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const mergePreflight = await buildTradingPromotionReceiptMergePreflightFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    promotionReceiptWorkspaceFixturesSchemaPath: inputs.promotion_receipt_workspace_fixtures_schema_path,
    promotionReceiptWorkspaceMergeFixturesSchemaPath: inputs.promotion_receipt_workspace_merge_fixtures_schema_path,
    schemaPath: inputs.promotion_receipt_merge_preflight_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const packetAnchor = buildPacketAnchor(mergePreflight);
  const packetRows = buildPacketRows(mergePreflight);
  const packetBoundary = buildPacketBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    mergePreflight,
    packetRows,
  });
  const packetGateRows = buildPacketGateRows({ mergePreflight, packageJson, platformOpsLedger, packetRows, packetBoundary });
  const validationItems = buildValidationItems({ mergePreflight, packageJson, platformOpsLedger, packetRows, packetGateRows, packetBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ mergePreflight, packetRows, packetGateRows, packetBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_promotion_receipt_validation_packet_fixtures_id: `trading-promotion-receipt-validation-packet-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    promotion_receipt_validation_packet_anchor: packetAnchor,
    promotion_receipt_validation_packet_rows: packetRows,
    promotion_receipt_validation_packet_gate_rows: packetGateRows,
    promotion_receipt_validation_packet_boundary: packetBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_promotion_receipt_validation_packet_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ mergePreflight, packetRows, packetGateRows, packetBoundary, validation: result.validation });
  result.summary.trading_promotion_receipt_validation_packet_fixtures_id = result.trading_promotion_receipt_validation_packet_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingPromotionReceiptValidationPacketFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-promotion-receipt-validation-packet-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "promotion-receipt-validation-packet-rows.json"), collectionEnvelope("trading-promotion-receipt-validation-packet-rows.v1", "promotion_receipt_validation_packet_rows", result.promotion_receipt_validation_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-validation-packet-gate-rows.json"), collectionEnvelope("trading-promotion-receipt-validation-packet-gate-rows.v1", "promotion_receipt_validation_packet_gate_rows", result.promotion_receipt_validation_packet_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-validation-packet-boundary.json"), result.promotion_receipt_validation_packet_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-promotion-receipt-validation-packet-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingPromotionReceiptValidationPacketFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingPromotionReceiptValidationPacketFixtures(args);
    console.log(`Trading promotion receipt validation packet fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_promotion_receipt_validation_packet_fixtures_status}`);
    console.log(`Packet rows: ${result.summary.ready_packet_row_count}/${result.summary.packet_row_count}`);
    console.log(`Packet gates: ${result.summary.ready_packet_gate_count}/${result.summary.packet_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPacketAnchor(mergePreflight) {
  return {
    schema_version: "trading-promotion-receipt-validation-packet-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_merge_preflight_fixtures_id: mergePreflight.trading_promotion_receipt_merge_preflight_fixtures_id,
    source_promotion_receipt_merge_preflight_status: mergePreflight.summary.trading_promotion_receipt_merge_preflight_fixtures_status,
    source_hash: hashValue({
      id: mergePreflight.trading_promotion_receipt_merge_preflight_fixtures_id,
      status: mergePreflight.summary.trading_promotion_receipt_merge_preflight_fixtures_status,
      preflight_rows: mergePreflight.summary.preflight_row_count,
      preflight_gate_rows: mergePreflight.summary.preflight_gate_count,
    }),
  };
}

function buildPacketRows(mergePreflight) {
  const sourceReady = mergePreflight.validation.valid && mergePreflight.summary.trading_promotion_receipt_merge_preflight_fixtures_status === SOURCE_READY_STATUS;
  return mergePreflight.promotion_receipt_merge_preflight_rows.map((preflightRow, index) => {
    const packetStatus = sourceReady && preflightRow.preflight_status === "ready_for_future_promotion_receipt_merge_validation" ? PACKET_READY_STATUS : "blocked";
    const row = {
      schema_version: "trading-promotion-receipt-validation-packet-row.v1",
      promotion_receipt_validation_packet_row_id: `trading-promotion-receipt-validation-packet.row.${preflightRow.source_queue_row_key}`,
      phase_slot: PHASE_SLOT,
      source_merge_preflight_row_id: preflightRow.promotion_receipt_merge_preflight_row_id,
      source_queue_row_key: preflightRow.source_queue_row_key,
      from_stage: preflightRow.from_stage,
      to_stage: preflightRow.to_stage,
      receipt_contract_id: preflightRow.receipt_contract_id,
      validation_packet_status: packetStatus,
      source_merge_preflight_status: preflightRow.preflight_status,
      actor_workspace_required: true,
      actor_workspace_input_present: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      validation_packet_declared: true,
      validation_packet_checks: VALIDATION_PACKET_CHECKS,
      ready_for_validation: false,
      receipt_received_by_packet: false,
      receipt_validated_by_packet: false,
      receipt_application_performed_by_packet: false,
      approval_applied_by_packet: false,
      promotion_enablement_allowed_by_packet: false,
      receipt_merge_preflight_consumed_in_memory: true,
      receipt_merge_preflight_artifact_read_performed_by_packet: false,
      command_execution_performed_by_packet: false,
      package_command_execution_performed_by_packet: false,
      release_check_execution_performed_by_packet: false,
      artifact_read_performed_by_packet: false,
      artifact_write_performed_by_packet: false,
      release_published_by_packet: false,
      git_operation_performed_by_packet: false,
      protected_action_executed_by_packet: false,
      shadow_live_enabled_by_packet: false,
      limited_live_enabled_by_packet: false,
      full_auto_enabled_by_packet: false,
      automatic_order_submission_allowed_by_packet: false,
      live_order_submission_allowed_by_packet: false,
      live_execution_allowed_by_packet: false,
      broker_write_allowed_by_packet: false,
      exchange_write_allowed_by_packet: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "promotion_receipt_validation_packet_hash");
  });
}

function buildPacketBoundary({ generatedAt, writeRequested, mergePreflight, packetRows }) {
  const sourceSummary = mergePreflight.summary;
  return {
    schema_version: "trading-promotion-receipt-validation-packet-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    promotion_receipt_validation_packet_artifact_write_requested: writeRequested,
    source_promotion_receipt_merge_preflight_status: sourceSummary.trading_promotion_receipt_merge_preflight_fixtures_status,
    source_promotion_receipt_merge_preflight_ready: mergePreflight.validation.valid && sourceSummary.trading_promotion_receipt_merge_preflight_fixtures_status === SOURCE_READY_STATUS,
    packet_row_count: packetRows.length,
    ready_packet_row_count: packetRows.filter((row) => row.validation_packet_status === PACKET_READY_STATUS).length,
    receipt_merge_preflight_consumed_in_memory: true,
    receipt_merge_preflight_artifact_read_performed: false,
    validation_packet_declared: true,
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

function buildPacketGateRows({ mergePreflight, packageJson, platformOpsLedger, packetRows, packetBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p408_receipt_merge_preflight_ready", "P408 promotion receipt merge preflight source is ready.", mergePreflight.validation.valid && mergePreflight.summary.trading_promotion_receipt_merge_preflight_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P409 trading promotion receipt validation packet fixtures command.", typeof scripts["trading:promotion-receipt-validation-packet-fixtures"] === "string" && scripts["trading:promotion-receipt-validation-packet-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P409 trading promotion receipt validation packet fixtures command.", validateScript.includes("npm run trading:promotion-receipt-validation-packet-fixtures -- --check")),
    gateRow("p409_ledger_acceptance_declared", "P409 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P409: `trading:promotion-receipt-validation-packet-fixtures`")),
    gateRow("validation_packet_rows_ready", "All promotion receipt validation packet rows are ready for future validation packets.", packetRows.length === 6 && packetRows.every((row) => row.validation_packet_status === PACKET_READY_STATUS && row.validation_packet_declared && row.actor_workspace_required && !row.actor_workspace_input_present && !row.merged_receipt_input_materialized && !row.receipt_payload_present && !row.ready_for_validation)),
    gateRow("no_receipt_payload_validation", "Validation packet does not read actor files, materialize merged receipt input, receive payloads, or validate receipts.", !packetBoundary.actor_workspace_input_present && !packetBoundary.receipt_input_file_materialized && !packetBoundary.merged_receipt_input_materialized && !packetBoundary.receipt_payload_present && !packetBoundary.ready_for_validation && !packetBoundary.receipt_received && !packetBoundary.receipt_validated && !packetBoundary.receipt_application_performed && !packetBoundary.approval_applied),
    gateRow("live_and_full_auto_enablement_blocked", "P409 packet does not enable shadow, limited-live, full-auto, live execution, order submission, broker writes, or exchange writes.", !packetBoundary.shadow_live_enabled && !packetBoundary.limited_live_enabled && !packetBoundary.full_auto_enabled && !packetBoundary.automatic_order_submission_allowed && !packetBoundary.live_order_submission_allowed && !packetBoundary.live_execution_allowed && !packetBoundary.broker_write_allowed && !packetBoundary.exchange_write_allowed),
    gateRow("no_command_or_artifact_mutation", "P409 packet does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !packetBoundary.command_execution_performed && !packetBoundary.artifact_read_performed && !packetBoundary.artifact_write_performed && !packetBoundary.release_published && !packetBoundary.git_operation_performed && !packetBoundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "promotion_receipt_validation_packet_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-promotion-receipt-validation-packet-gate-row.v1",
    promotion_receipt_validation_packet_gate_row_id: `trading-promotion-receipt-validation-packet-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    actor_workspace_input_present_by_packet: false,
    merged_receipt_input_materialized_by_packet: false,
    receipt_payload_present_by_packet: false,
    ready_for_validation_by_packet: false,
    receipt_received_by_packet: false,
    receipt_validated_by_packet: false,
    receipt_application_performed_by_packet: false,
    approval_applied_by_packet: false,
    promotion_enablement_allowed_by_packet: false,
    receipt_merge_preflight_artifact_read_performed_by_packet: false,
    command_execution_performed_by_packet: false,
    release_check_execution_performed_by_packet: false,
    artifact_read_performed_by_packet: false,
    artifact_write_performed_by_packet: false,
    release_published_by_packet: false,
    git_operation_performed_by_packet: false,
    protected_action_executed_by_packet: false,
    automatic_order_submission_allowed_by_packet: false,
    live_execution_allowed_by_packet: false,
    broker_write_allowed_by_packet: false,
    exchange_write_allowed_by_packet: false,
    human_review_required: true,
  };
}

function buildValidationItems({ mergePreflight, packageJson, platformOpsLedger, packetRows, packetGateRows, packetBoundary }) {
  return [
    validationItem("source.promotion_receipt_merge_preflight", "p408_receipt_merge_preflight_ready", mergePreflight.validation.valid && mergePreflight.summary.trading_promotion_receipt_merge_preflight_fixtures_status === SOURCE_READY_STATUS, "P408 promotion receipt merge preflight fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P409 promotion receipt validation packet fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("promotion_receipt_validation_packet_rows", "validation_packet_rows_ready", packetRows.length === 6 && packetRows.every((row) => row.validation_packet_status === PACKET_READY_STATUS && row.validation_packet_declared && row.validation_packet_checks.length >= 8 && row.actor_workspace_required && !row.actor_workspace_input_present && !row.merged_receipt_input_materialized && !row.ready_for_validation), "Promotion receipt validation packet rows must be ready for future validation packets without payloads."),
    validationItem("promotion_receipt_validation_packet_gate_rows", "validation_packet_gates_ready", packetGateRows.length >= 8 && packetGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_packet && !row.protected_action_executed_by_packet), "P409 promotion receipt validation packet gates are ready."),
    validationItem("boundary.no_receipt_payload", "no_receipt_payload", packetBoundary.read_only && packetBoundary.report_only && packetBoundary.receipt_merge_preflight_consumed_in_memory && !packetBoundary.receipt_merge_preflight_artifact_read_performed && packetBoundary.validation_packet_declared && !packetBoundary.actor_workspace_input_present && !packetBoundary.receipt_input_file_materialized && !packetBoundary.merged_receipt_input_materialized && !packetBoundary.receipt_payload_present && !packetBoundary.ready_for_validation && !packetBoundary.receipt_received && !packetBoundary.receipt_validated && !packetBoundary.receipt_application_performed && !packetBoundary.approval_applied, "Promotion receipt validation packet declares packet rows without materializing or validating receipts."),
    validationItem("boundary.no_source_receipt_or_approval", "no_source_receipt_or_approval", !packetBoundary.source_receipt_present && !packetBoundary.source_approval_applied, "P409 must not inherit pre-applied promotion receipts or approvals."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !packetBoundary.command_execution_performed && !packetBoundary.package_command_execution_performed && !packetBoundary.release_check_execution_performed && !packetBoundary.artifact_read_performed && !packetBoundary.artifact_write_performed, "Promotion receipt validation packet does not execute commands or read/write artifacts."),
    validationItem("boundary.no_trading_mutation", "no_trading_mutation", !packetBoundary.shadow_live_enabled && !packetBoundary.limited_live_enabled && !packetBoundary.full_auto_enabled && !packetBoundary.automatic_order_submission_allowed && !packetBoundary.live_order_submission_allowed && !packetBoundary.live_execution_allowed && !packetBoundary.broker_write_allowed && !packetBoundary.exchange_write_allowed && !packetBoundary.release_published && !packetBoundary.git_operation_performed && !packetBoundary.protected_action_executed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
  ];
}

function buildSummary({ mergePreflight, packetRows, packetGateRows, packetBoundary, validation }) {
  return {
    trading_promotion_receipt_validation_packet_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_merge_preflight_status: mergePreflight.summary.trading_promotion_receipt_merge_preflight_fixtures_status,
    source_promotion_receipt_merge_preflight_ready: packetBoundary.source_promotion_receipt_merge_preflight_ready,
    packet_row_count: packetRows.length,
    ready_packet_row_count: packetBoundary.ready_packet_row_count,
    packet_gate_count: packetGateRows.length,
    ready_packet_gate_count: packetGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: packetBoundary.read_only,
    report_only: packetBoundary.report_only,
    receipt_merge_preflight_consumed_in_memory: packetBoundary.receipt_merge_preflight_consumed_in_memory,
    receipt_merge_preflight_artifact_read_performed: packetBoundary.receipt_merge_preflight_artifact_read_performed,
    validation_packet_declared: packetBoundary.validation_packet_declared,
    actor_workspace_input_present: packetBoundary.actor_workspace_input_present,
    receipt_input_file_materialized: packetBoundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: packetBoundary.merged_receipt_input_materialized,
    receipt_payload_present: packetBoundary.receipt_payload_present,
    ready_for_validation: packetBoundary.ready_for_validation,
    receipt_received: packetBoundary.receipt_received,
    receipt_validated: packetBoundary.receipt_validated,
    receipt_application_performed: packetBoundary.receipt_application_performed,
    approval_applied: packetBoundary.approval_applied,
    source_receipt_present: packetBoundary.source_receipt_present,
    source_approval_applied: packetBoundary.source_approval_applied,
    real_enablement_count: packetBoundary.real_enablement_count,
    shadow_live_enabled: packetBoundary.shadow_live_enabled,
    limited_live_enabled: packetBoundary.limited_live_enabled,
    full_auto_enabled: packetBoundary.full_auto_enabled,
    automatic_order_submission_allowed: packetBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: packetBoundary.live_order_submission_allowed,
    live_promotion_allowed: packetBoundary.live_promotion_allowed,
    live_execution_allowed: packetBoundary.live_execution_allowed,
    broker_write_allowed: packetBoundary.broker_write_allowed,
    exchange_write_allowed: packetBoundary.exchange_write_allowed,
    command_execution_performed: packetBoundary.command_execution_performed,
    package_command_execution_performed: packetBoundary.package_command_execution_performed,
    release_check_execution_performed: packetBoundary.release_check_execution_performed,
    artifact_read_performed: packetBoundary.artifact_read_performed,
    artifact_write_performed: packetBoundary.artifact_write_performed,
    release_published: packetBoundary.release_published,
    git_operation_performed: packetBoundary.git_operation_performed,
    protected_action_executed: packetBoundary.protected_action_executed,
    human_review_required: packetBoundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Promotion Receipt Validation Packet Fixtures",
    "",
    `Status: ${result.summary.trading_promotion_receipt_validation_packet_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source merge preflight: ${result.summary.source_promotion_receipt_merge_preflight_status}`,
    `Packet rows: ${result.summary.ready_packet_row_count}/${result.summary.packet_row_count}`,
    `Packet gates: ${result.summary.ready_packet_gate_count}/${result.summary.packet_gate_count}`,
    "",
    "## Packet Rows",
    "",
    ...result.promotion_receipt_validation_packet_rows.map((row) => `- ${row.source_queue_row_key}: ${row.validation_packet_status}`),
    "",
    "## Gates",
    "",
    ...result.promotion_receipt_validation_packet_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_PACKET_FIXTURES_OUT_DIR };
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
  console.log(`Usage: node scripts/trading-promotion-receipt-validation-packet-fixtures.mjs [options]

Options:
  --out-dir <folder>                         Output directory. Default: ${DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_PACKET_FIXTURES_OUT_DIR}
  --run-at <iso>                             Deterministic generated_at timestamp.
  --package <path>                           package.json path.
  --platform-ops-ledger <path>               P341-P500 platform operations ledger path.
  --promotion-receipt-workspace-fixtures-schema <path>
                                             P406 promotion receipt workspace fixtures schema path.
  --promotion-receipt-workspace-merge-fixtures-schema <path>
                                             P407 promotion receipt workspace merge fixtures schema path.
  --promotion-receipt-merge-preflight-fixtures-schema <path>
                                             P408 promotion receipt merge preflight fixtures schema path.
  --schema <path>                            Output schema path.
  --check                                    Validate only, do not write artifacts.
  -h, --help                                 Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS.platformOpsLedgerPath),
    promotion_receipt_workspace_fixtures_schema_path: path.resolve(options.promotionReceiptWorkspaceFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS.promotionReceiptWorkspaceFixturesSchemaPath),
    promotion_receipt_workspace_merge_fixtures_schema_path: path.resolve(options.promotionReceiptWorkspaceMergeFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS.promotionReceiptWorkspaceMergeFixturesSchemaPath),
    promotion_receipt_merge_preflight_fixtures_schema_path: path.resolve(options.promotionReceiptMergePreflightFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS.promotionReceiptMergePreflightFixturesSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_VALIDATION_PACKET_FIXTURES_INPUTS.schemaPath),
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
