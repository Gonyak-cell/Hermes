import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS,
  buildTradingPromotionReceiptWorkspaceFixtures,
} from "./trading-promotion-receipt-workspace-fixtures.mjs";

export const DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_MERGE_FIXTURES_OUT_DIR = "artifacts/trading-promotion-receipt-workspace-merge-fixtures/latest";
export const DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS,
  promotionReceiptWorkspaceFixturesSchemaPath: DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-promotion-receipt-workspace-merge-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-promotion-receipt-workspace-merge-fixtures.v1";
const CAPABILITY_ID = "trading.promotion_receipt_workspace_merge_fixtures";
const PHASE_SLOT = "P407";
const PREVIOUS_PHASE_SLOT = "P406";
const NEXT_PHASE_SLOT = "P408";
const READY_STATUS = "ready_for_trading_promotion_receipt_workspace_merge_regression";
const SOURCE_READY_STATUS = "ready_for_trading_promotion_receipt_workspace_regression";

export async function runTradingPromotionReceiptWorkspaceMergeFixtures(options = {}) {
  const result = await buildTradingPromotionReceiptWorkspaceMergeFixtures(options);
  if (options.write !== false) await writeTradingPromotionReceiptWorkspaceMergeFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading promotion receipt workspace merge fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingPromotionReceiptWorkspaceMergeFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_MERGE_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const receiptWorkspace = await buildTradingPromotionReceiptWorkspaceFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    schemaPath: inputs.promotion_receipt_workspace_fixtures_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const mergeAnchor = buildMergeAnchor(receiptWorkspace);
  const mergeRows = buildMergeRows(receiptWorkspace);
  const mergeBoundary = buildMergeBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    receiptWorkspace,
    mergeRows,
  });
  const mergeGateRows = buildMergeGateRows({ receiptWorkspace, packageJson, platformOpsLedger, mergeRows, mergeBoundary });
  const validationItems = buildValidationItems({ receiptWorkspace, packageJson, platformOpsLedger, mergeRows, mergeGateRows, mergeBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ receiptWorkspace, mergeRows, mergeGateRows, mergeBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_promotion_receipt_workspace_merge_fixtures_id: `trading-promotion-receipt-workspace-merge-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    promotion_receipt_workspace_merge_anchor: mergeAnchor,
    promotion_receipt_workspace_merge_rows: mergeRows,
    promotion_receipt_workspace_merge_gate_rows: mergeGateRows,
    promotion_receipt_workspace_merge_boundary: mergeBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_promotion_receipt_workspace_merge_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ receiptWorkspace, mergeRows, mergeGateRows, mergeBoundary, validation: result.validation });
  result.summary.trading_promotion_receipt_workspace_merge_fixtures_id = result.trading_promotion_receipt_workspace_merge_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingPromotionReceiptWorkspaceMergeFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-promotion-receipt-workspace-merge-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "promotion-receipt-workspace-merge-rows.json"), collectionEnvelope("trading-promotion-receipt-workspace-merge-rows.v1", "promotion_receipt_workspace_merge_rows", result.promotion_receipt_workspace_merge_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-workspace-merge-gate-rows.json"), collectionEnvelope("trading-promotion-receipt-workspace-merge-gate-rows.v1", "promotion_receipt_workspace_merge_gate_rows", result.promotion_receipt_workspace_merge_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "promotion-receipt-workspace-merge-boundary.json"), result.promotion_receipt_workspace_merge_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-promotion-receipt-workspace-merge-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingPromotionReceiptWorkspaceMergeFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingPromotionReceiptWorkspaceMergeFixtures(args);
    console.log(`Trading promotion receipt workspace merge fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_promotion_receipt_workspace_merge_fixtures_status}`);
    console.log(`Merge rows: ${result.summary.ready_merge_row_count}/${result.summary.merge_row_count}`);
    console.log(`Merged receipt input materialized: ${result.summary.merged_receipt_input_materialized}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildMergeAnchor(receiptWorkspace) {
  return {
    schema_version: "trading-promotion-receipt-workspace-merge-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_workspace_fixtures_id: receiptWorkspace.trading_promotion_receipt_workspace_fixtures_id,
    source_promotion_receipt_workspace_status: receiptWorkspace.summary.trading_promotion_receipt_workspace_fixtures_status,
    source_hash: hashValue({
      id: receiptWorkspace.trading_promotion_receipt_workspace_fixtures_id,
      status: receiptWorkspace.summary.trading_promotion_receipt_workspace_fixtures_status,
      workspace_rows: receiptWorkspace.summary.workspace_row_count,
    }),
  };
}

function buildMergeRows(receiptWorkspace) {
  const sourceReady = receiptWorkspace.validation.valid && receiptWorkspace.summary.trading_promotion_receipt_workspace_fixtures_status === SOURCE_READY_STATUS;
  return receiptWorkspace.promotion_receipt_workspace_rows.map((workspaceRow, index) => {
    const mergeStatus = sourceReady && workspaceRow.workspace_status === "ready_for_human_receipt_input" ? "ready_for_future_receipt_merge" : "blocked";
    const row = {
      schema_version: "trading-promotion-receipt-workspace-merge-row.v1",
      promotion_receipt_workspace_merge_row_id: `trading-promotion-receipt-workspace-merge.row.${workspaceRow.source_queue_row_key}`,
      phase_slot: PHASE_SLOT,
      source_workspace_row_id: workspaceRow.promotion_receipt_workspace_row_id,
      source_queue_row_key: workspaceRow.source_queue_row_key,
      from_stage: workspaceRow.from_stage,
      to_stage: workspaceRow.to_stage,
      receipt_contract_id: workspaceRow.receipt_contract_id,
      merge_status: mergeStatus,
      source_workspace_status: workspaceRow.workspace_status,
      required_receipt_fields: workspaceRow.required_receipt_fields,
      allowed_receipt_decisions: workspaceRow.allowed_receipt_decisions,
      receipt_workspace_consumed_in_memory: true,
      receipt_workspace_artifact_read_performed_by_merge: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      merge_performed: false,
      ready_for_validation: false,
      receipt_received_by_merge: false,
      receipt_validated_by_merge: false,
      receipt_application_performed_by_merge: false,
      approval_applied_by_merge: false,
      promotion_enablement_allowed_by_merge: false,
      live_execution_allowed_by_merge: false,
      command_execution_performed_by_merge: false,
      artifact_read_performed_by_merge: false,
      artifact_write_performed_by_merge: false,
      protected_action_executed_by_merge: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "promotion_receipt_workspace_merge_hash");
  });
}

function buildMergeBoundary({ generatedAt, writeRequested, receiptWorkspace, mergeRows }) {
  const sourceSummary = receiptWorkspace.summary;
  return {
    schema_version: "trading-promotion-receipt-workspace-merge-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    promotion_receipt_workspace_merge_artifact_write_requested: writeRequested,
    promotion_receipt_workspace_merge_execution_performed: false,
    source_promotion_receipt_workspace_status: sourceSummary.trading_promotion_receipt_workspace_fixtures_status,
    source_promotion_receipt_workspace_ready: receiptWorkspace.validation.valid && sourceSummary.trading_promotion_receipt_workspace_fixtures_status === SOURCE_READY_STATUS,
    merge_row_count: mergeRows.length,
    ready_merge_row_count: mergeRows.filter((row) => row.merge_status === "ready_for_future_receipt_merge").length,
    receipt_workspace_consumed_in_memory: true,
    receipt_workspace_artifact_read_performed: false,
    merge_rows_declared: true,
    merged_receipt_input_materialized: false,
    receipt_payload_present: false,
    merge_performed: false,
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

function buildMergeGateRows({ receiptWorkspace, packageJson, platformOpsLedger, mergeRows, mergeBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p406_receipt_workspace_ready", "P406 promotion receipt workspace source is ready.", receiptWorkspace.validation.valid && receiptWorkspace.summary.trading_promotion_receipt_workspace_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P407 trading promotion receipt workspace merge fixtures command.", typeof scripts["trading:promotion-receipt-workspace-merge-fixtures"] === "string" && scripts["trading:promotion-receipt-workspace-merge-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P407 trading promotion receipt workspace merge fixtures command.", validateScript.includes("npm run trading:promotion-receipt-workspace-merge-fixtures -- --check")),
    gateRow("p407_ledger_acceptance_declared", "P407 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P407: `trading:promotion-receipt-workspace-merge-fixtures`")),
    gateRow("merge_rows_ready", "All promotion receipt workspace merge rows are ready for future merge.", mergeRows.length === 6 && mergeRows.every((row) => row.merge_status === "ready_for_future_receipt_merge" && !row.merged_receipt_input_materialized && !row.receipt_payload_present)),
    gateRow("no_receipt_input_merge", "Workspace merge declares future merge readiness without materializing or merging receipt inputs.", !mergeBoundary.merged_receipt_input_materialized && !mergeBoundary.receipt_payload_present && !mergeBoundary.merge_performed && !mergeBoundary.ready_for_validation && !mergeBoundary.receipt_received && !mergeBoundary.receipt_validated && !mergeBoundary.receipt_application_performed && !mergeBoundary.approval_applied),
    gateRow("live_and_full_auto_enablement_blocked", "P407 merge does not enable shadow, limited-live, full-auto, live execution, order submission, broker writes, or exchange writes.", !mergeBoundary.shadow_live_enabled && !mergeBoundary.limited_live_enabled && !mergeBoundary.full_auto_enabled && !mergeBoundary.automatic_order_submission_allowed && !mergeBoundary.live_order_submission_allowed && !mergeBoundary.live_execution_allowed && !mergeBoundary.broker_write_allowed && !mergeBoundary.exchange_write_allowed),
    gateRow("no_command_or_artifact_mutation", "P407 merge does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !mergeBoundary.command_execution_performed && !mergeBoundary.artifact_read_performed && !mergeBoundary.artifact_write_performed && !mergeBoundary.release_published && !mergeBoundary.git_operation_performed && !mergeBoundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "promotion_receipt_workspace_merge_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-promotion-receipt-workspace-merge-gate-row.v1",
    promotion_receipt_workspace_merge_gate_row_id: `trading-promotion-receipt-workspace-merge-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    merged_receipt_input_materialized_by_merge: false,
    receipt_payload_present_by_merge: false,
    merge_performed_by_merge: false,
    ready_for_validation_by_merge: false,
    receipt_validated_by_merge: false,
    approval_applied_by_merge: false,
    promotion_enablement_allowed_by_merge: false,
    live_execution_allowed_by_merge: false,
    protected_action_executed_by_merge: false,
    human_review_required: true,
  };
}

function buildValidationItems({ receiptWorkspace, packageJson, platformOpsLedger, mergeRows, mergeGateRows, mergeBoundary }) {
  return [
    validationItem("source.promotion_receipt_workspace", "p406_receipt_workspace_ready", receiptWorkspace.validation.valid && receiptWorkspace.summary.trading_promotion_receipt_workspace_fixtures_status === SOURCE_READY_STATUS, "P406 promotion receipt workspace fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P407 promotion receipt workspace merge fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("promotion_receipt_workspace_merge_rows", "merge_rows_ready", mergeRows.length === 6 && mergeRows.every((row) => row.merge_status === "ready_for_future_receipt_merge" && !row.merged_receipt_input_materialized && !row.receipt_payload_present && !row.merge_performed && !row.ready_for_validation), "Promotion receipt workspace merge rows must be ready without merged receipt inputs."),
    validationItem("promotion_receipt_workspace_merge_gate_rows", "merge_gates_ready", mergeGateRows.length >= 8 && mergeGateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_merge && !row.protected_action_executed_by_merge), "P407 promotion receipt workspace merge gates are ready."),
    validationItem("boundary.no_receipt_merge", "no_receipt_merge", mergeBoundary.read_only && mergeBoundary.report_only && mergeBoundary.receipt_workspace_consumed_in_memory && !mergeBoundary.receipt_workspace_artifact_read_performed && mergeBoundary.merge_rows_declared && !mergeBoundary.merged_receipt_input_materialized && !mergeBoundary.receipt_payload_present && !mergeBoundary.merge_performed && !mergeBoundary.ready_for_validation && !mergeBoundary.receipt_validated && !mergeBoundary.receipt_application_performed && !mergeBoundary.approval_applied, "Promotion receipt workspace merge declares future merge readiness without materializing or validating receipts."),
    validationItem("boundary.no_source_receipt_or_approval", "no_source_receipt_or_approval", !mergeBoundary.source_receipt_present && !mergeBoundary.source_approval_applied, "P407 must not inherit pre-applied promotion receipts or approvals."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !mergeBoundary.command_execution_performed && !mergeBoundary.package_command_execution_performed && !mergeBoundary.release_check_execution_performed && !mergeBoundary.artifact_read_performed && !mergeBoundary.artifact_write_performed, "Promotion receipt workspace merge does not execute commands or read/write artifacts."),
    validationItem("boundary.no_trading_mutation", "no_trading_mutation", !mergeBoundary.shadow_live_enabled && !mergeBoundary.limited_live_enabled && !mergeBoundary.full_auto_enabled && !mergeBoundary.automatic_order_submission_allowed && !mergeBoundary.live_order_submission_allowed && !mergeBoundary.live_execution_allowed && !mergeBoundary.broker_write_allowed && !mergeBoundary.exchange_write_allowed && !mergeBoundary.release_published && !mergeBoundary.git_operation_performed && !mergeBoundary.protected_action_executed, "Trading live/full-auto/order submission and broker/exchange writes remain disabled."),
  ];
}

function buildSummary({ receiptWorkspace, mergeRows, mergeGateRows, mergeBoundary, validation }) {
  return {
    trading_promotion_receipt_workspace_merge_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_promotion_receipt_workspace_status: receiptWorkspace.summary.trading_promotion_receipt_workspace_fixtures_status,
    source_promotion_receipt_workspace_ready: mergeBoundary.source_promotion_receipt_workspace_ready,
    merge_row_count: mergeRows.length,
    ready_merge_row_count: mergeBoundary.ready_merge_row_count,
    gate_count: mergeGateRows.length,
    ready_gate_count: mergeGateRows.filter((row) => row.gate_status === "ready").length,
    receipt_workspace_consumed_in_memory: mergeBoundary.receipt_workspace_consumed_in_memory,
    receipt_workspace_artifact_read_performed: mergeBoundary.receipt_workspace_artifact_read_performed,
    merge_rows_declared: mergeBoundary.merge_rows_declared,
    merged_receipt_input_materialized: mergeBoundary.merged_receipt_input_materialized,
    receipt_payload_present: mergeBoundary.receipt_payload_present,
    merge_performed: mergeBoundary.merge_performed,
    ready_for_validation: mergeBoundary.ready_for_validation,
    receipt_received: mergeBoundary.receipt_received,
    receipt_validated: mergeBoundary.receipt_validated,
    receipt_application_performed: mergeBoundary.receipt_application_performed,
    approval_applied: mergeBoundary.approval_applied,
    source_receipt_present: mergeBoundary.source_receipt_present,
    source_approval_applied: mergeBoundary.source_approval_applied,
    real_enablement_count: mergeBoundary.real_enablement_count,
    shadow_live_enabled: mergeBoundary.shadow_live_enabled,
    limited_live_enabled: mergeBoundary.limited_live_enabled,
    full_auto_enabled: mergeBoundary.full_auto_enabled,
    automatic_order_submission_allowed: mergeBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: mergeBoundary.live_order_submission_allowed,
    live_promotion_allowed: mergeBoundary.live_promotion_allowed,
    live_execution_allowed: mergeBoundary.live_execution_allowed,
    broker_write_allowed: mergeBoundary.broker_write_allowed,
    exchange_write_allowed: mergeBoundary.exchange_write_allowed,
    command_execution_performed: mergeBoundary.command_execution_performed,
    package_command_execution_performed: mergeBoundary.package_command_execution_performed,
    release_check_execution_performed: mergeBoundary.release_check_execution_performed,
    artifact_read_performed: mergeBoundary.artifact_read_performed,
    artifact_write_performed: mergeBoundary.artifact_write_performed,
    release_published: mergeBoundary.release_published,
    git_operation_performed: mergeBoundary.git_operation_performed,
    protected_action_executed: mergeBoundary.protected_action_executed,
    human_review_required: mergeBoundary.human_review_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Promotion Receipt Workspace Merge Fixtures",
    "",
    `Status: ${result.summary.trading_promotion_receipt_workspace_merge_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source workspace: ${result.summary.source_promotion_receipt_workspace_status}`,
    `Merge rows: ${result.summary.ready_merge_row_count}/${result.summary.merge_row_count}`,
    `Merged receipt input materialized: ${result.summary.merged_receipt_input_materialized}`,
    "",
    "## Merge Rows",
    "",
    ...result.promotion_receipt_workspace_merge_rows.map((row) => `- ${row.source_queue_row_key}: ${row.merge_status}`),
    "",
    "## Gates",
    "",
    ...result.promotion_receipt_workspace_merge_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_MERGE_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--promotion-receipt-workspace-fixtures-schema") parsed.promotionReceiptWorkspaceFixturesSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-promotion-receipt-workspace-merge-fixtures.mjs [options]

Options:
  --out-dir <folder>                         Output directory. Default: ${DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_MERGE_FIXTURES_OUT_DIR}
  --run-at <iso>                             Deterministic generated_at timestamp.
  --package <path>                           package.json path.
  --platform-ops-ledger <path>               P341-P500 platform operations ledger path.
  --promotion-receipt-workspace-fixtures-schema <path>
                                             P406 promotion receipt workspace fixtures schema path.
  --schema <path>                            Output schema path.
  --check                                    Validate only, do not write artifacts.
  -h, --help                                 Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS.platformOpsLedgerPath),
    promotion_receipt_workspace_fixtures_schema_path: path.resolve(options.promotionReceiptWorkspaceFixturesSchemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS.promotionReceiptWorkspaceFixturesSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_PROMOTION_RECEIPT_WORKSPACE_MERGE_FIXTURES_INPUTS.schemaPath),
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
