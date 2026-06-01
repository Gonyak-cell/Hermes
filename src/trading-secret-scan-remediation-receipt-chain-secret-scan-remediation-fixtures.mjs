import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationReceiptChainSecretScanFailClosedFixtures,
} from "./trading-secret-scan-remediation-receipt-chain-secret-scan-fail-closed-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS,
  secretScanRemediationReceiptChainSecretScanFailClosedSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_FAIL_CLOSED_FIXTURES_INPUTS.schemaPath,
  reviewDashboardPath: "src/review-dashboard.mjs",
  controlPlaneActionPlanPath: "src/control-plane-action-plan.mjs",
  controlPlaneHumanGateReceiptsPath: "src/control-plane-human-gate-receipts.mjs",
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_fixtures";
const PHASE_SLOT = "P454";
const PREVIOUS_PHASE_SLOT = "P453";
const NEXT_PHASE_SLOT = "P455";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_fail_closed";
const COMMAND_NAME = "trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures";
const REQUIRED_ROW_KEYS = [
  "p453_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_ready",
  "dashboard_fix_action_registered",
  "dashboard_remediation_actions_non_protected",
  "action_plan_no_auto_secret_fix_command",
  "human_gate_receipts_keep_pending_manual",
  "remediation_no_auto_redaction_or_deletion",
  "remediation_no_secret_material_read",
  "remediation_no_trading_or_artifact_mutation",
];
const FORBIDDEN_SECRET_REMEDIATION_SCRIPTS = [
  "secret:rotate",
  "secrets:rotate",
  "secret:redact",
  "secrets:redact",
  "secret:delete",
  "secrets:delete",
  "secret:apply",
  "secrets:apply",
  "secret:fix",
  "secrets:fix",
  "secret-remediation-apply",
];
const FORBIDDEN_FIX_BLOCK_SNIPPETS = [
  "perform_manual_delivery_or_merge",
  "protected_action: true",
  "writeFile(",
  "unlink(",
  "rm(",
  "exec(",
  "delete_secret",
  "rotate_secret",
  "redact_secret",
  "apply_secret",
];

export async function runTradingSecretScanRemediationReceiptChainSecretScanRemediationFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptChainSecretScanRemediationFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptChainSecretScanRemediationFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt chain secret scan remediation fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptChainSecretScanRemediationFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const secretScanRemediationReceiptChainSecretScanFailClosed = await buildTradingSecretScanRemediationReceiptChainSecretScanFailClosedFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_schema_path,
    secretScanRemediationReceiptChainSecretScanAttentionSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_attention_schema_path,
    schemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_fail_closed_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const reviewDashboard = await readTextSource(inputs.review_dashboard_path);
  const controlPlaneActionPlan = await readTextSource(inputs.control_plane_action_plan_path);
  const controlPlaneHumanGateReceipts = await readTextSource(inputs.control_plane_human_gate_receipts_path);
  const sources = { packageJson, platformOpsLedger, reviewDashboard, controlPlaneActionPlan, controlPlaneHumanGateReceipts };
  const sourceReady = secretScanRemediationReceiptChainSecretScanFailClosed.validation.valid && secretScanRemediationReceiptChainSecretScanFailClosed.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures_status === SOURCE_READY_STATUS;
  const coverage = buildRemediationCoverage({ secretScanRemediationReceiptChainSecretScanFailClosed, sources });
  const anchor = buildRemediationAnchor(secretScanRemediationReceiptChainSecretScanFailClosed, coverage);
  const rows = buildRemediationRows({ sourceReady, secretScanRemediationReceiptChainSecretScanFailClosed, coverage });
  const boundary = buildRemediationBoundary({ generatedAt, writeRequested: options.write !== false, sourceReady, secretScanRemediationReceiptChainSecretScanFailClosed, rows, coverage });
  const gateRows = buildRemediationGateRows({ secretScanRemediationReceiptChainSecretScanFailClosed, packageJson, platformOpsLedger, rows, boundary });
  const validationItems = buildValidationItems({ secretScanRemediationReceiptChainSecretScanFailClosed, sources, rows, gateRows, boundary, coverage });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ secretScanRemediationReceiptChainSecretScanFailClosed, rows, gateRows, boundary, coverage, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_fixtures_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_scan_remediation_anchor: anchor,
    secret_scan_remediation_rows: rows,
    secret_scan_remediation_gate_rows: gateRows,
    secret_scan_remediation_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ secretScanRemediationReceiptChainSecretScanFailClosed, rows, gateRows, boundary, coverage, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_fixtures_id = result.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptChainSecretScanRemediationFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-scan-remediation-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-rows.v1", "secret_scan_remediation_rows", result.secret_scan_remediation_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-gate-rows.v1", "secret_scan_remediation_gate_rows", result.secret_scan_remediation_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-boundary.json"), result.secret_scan_remediation_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptChainSecretScanRemediationFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptChainSecretScanRemediationFixtures(args);
    console.log(`Trading secret scan remediation receipt chain secret scan remediation fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_fixtures_status}`);
    console.log(`Secret scan remediation rows: ${result.summary.ready_secret_scan_remediation_row_count}/${result.summary.secret_scan_remediation_row_count}`);
    console.log(`Secret scan remediation gates: ${result.summary.ready_secret_scan_remediation_gate_count}/${result.summary.secret_scan_remediation_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildRemediationCoverage({ secretScanRemediationReceiptChainSecretScanFailClosed, sources }) {
  const packageScripts = sources.packageJson.data?.scripts ?? {};
  const dashboardText = sources.reviewDashboard.text ?? "";
  const secretsFixBlock = extractBetween(dashboardText, "for (const error of artifacts.secrets_scan_gate?.validation?.errors ?? [])", "for (const error of artifacts.retention_deletion_policy?.validation?.errors ?? [])");
  const actionPlanText = sources.controlPlaneActionPlan.text ?? "";
  const humanGateReceiptsText = sources.controlPlaneHumanGateReceipts.text ?? "";
  const forbiddenSecretScripts = Object.keys(packageScripts).filter((scriptName) => FORBIDDEN_SECRET_REMEDIATION_SCRIPTS.includes(scriptName));
  return {
    p453_ready: secretScanRemediationReceiptChainSecretScanFailClosed.validation.valid && secretScanRemediationReceiptChainSecretScanFailClosed.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures_status === SOURCE_READY_STATUS,
    dashboard_fix_action_registered: includesAll(secretsFixBlock, [
      "source_stage: \"secrets_scan_gate\"",
      "title: \"Fix Secrets Scan Gate\"",
      "fix_secrets_scan_gate",
      "rerun_secrets_scan_gate",
      "rebuild_dashboard",
    ]),
    dashboard_remediation_actions_non_protected: secretsFixBlock.length > 0 && !includesAny(secretsFixBlock, FORBIDDEN_FIX_BLOCK_SNIPPETS),
    action_plan_no_auto_secret_fix_command: includesAll(actionPlanText, ["const ACTION_COMMANDS", "ACTION_COMMANDS[action] ?? []"])
      && !hasActionCommandMapping(actionPlanText, "fix_secrets_scan_gate")
      && !hasActionCommandMapping(actionPlanText, "rerun_secrets_scan_gate")
      && !includesAny(actionPlanText, ["delete_secret", "rotate_secret", "redact_secret", "apply_secret"]),
    human_gate_receipts_keep_pending_manual: includesAll(humanGateReceiptsText, [
      "Pending rows do not close gates and do not trigger protected actions.",
      "protected_action_reference",
      "completed_action_refs",
    ]),
    forbidden_secret_remediation_script_count: forbiddenSecretScripts.length,
    forbidden_secret_remediation_scripts: forbiddenSecretScripts,
    remediation_no_auto_redaction_or_deletion: forbiddenSecretScripts.length === 0 && !includesAny(secretsFixBlock, ["delete", "rotate", "redact", "apply_secret"]),
    no_secret_material_read: secretScanRemediationReceiptChainSecretScanFailClosed.summary.no_secret_material_read === true
      && secretScanRemediationReceiptChainSecretScanFailClosed.summary.secret_values_read === false
      && secretScanRemediationReceiptChainSecretScanFailClosed.summary.env_file_read === false
      && secretScanRemediationReceiptChainSecretScanFailClosed.summary.desktop_config_content_inspected === false
      && secretScanRemediationReceiptChainSecretScanFailClosed.summary.desktop_config_read === false
      && secretScanRemediationReceiptChainSecretScanFailClosed.summary.desktop_provider_key_visible === false
      && secretScanRemediationReceiptChainSecretScanFailClosed.summary.secret_scan_remediation_action_allowed === false,
    no_secret_or_trading_mutation: secretScanRemediationReceiptChainSecretScanFailClosed.summary.no_secret_or_trading_mutation === true
      && secretScanRemediationReceiptChainSecretScanFailClosed.summary.secret_scan_remediation_action_allowed === false
      && secretScanRemediationReceiptChainSecretScanFailClosed.summary.credential_lookup_allowed === false
      && secretScanRemediationReceiptChainSecretScanFailClosed.summary.broker_write_allowed === false
      && secretScanRemediationReceiptChainSecretScanFailClosed.summary.exchange_write_allowed === false
      && secretScanRemediationReceiptChainSecretScanFailClosed.summary.command_execution_performed === false
      && secretScanRemediationReceiptChainSecretScanFailClosed.summary.artifact_write_performed === false
      && secretScanRemediationReceiptChainSecretScanFailClosed.summary.protected_action_executed === false,
  };
}

function buildRemediationAnchor(secretScanRemediationReceiptChainSecretScanFailClosed, coverage) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures_id: secretScanRemediationReceiptChainSecretScanFailClosed.trading_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures_id,
    source_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_status: secretScanRemediationReceiptChainSecretScanFailClosed.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures_status,
    required_row_count: REQUIRED_ROW_KEYS.length,
    required_row_keys: REQUIRED_ROW_KEYS,
    coverage_hash: hashValue(coverage),
    source_hash: hashValue({
      id: secretScanRemediationReceiptChainSecretScanFailClosed.trading_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures_id,
      status: secretScanRemediationReceiptChainSecretScanFailClosed.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures_status,
      row_count: secretScanRemediationReceiptChainSecretScanFailClosed.summary.secret_scan_fail_closed_row_count,
      gate_count: secretScanRemediationReceiptChainSecretScanFailClosed.summary.secret_scan_fail_closed_gate_count,
    }),
  };
}

function buildRemediationRows({ sourceReady, secretScanRemediationReceiptChainSecretScanFailClosed, coverage }) {
  const rowInputs = [
    remediationRowInput("p453_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_ready", "trading_secret_scan_remediation_receipt_chain_secret_scan_fail_closed", "summary", [
      condition("source.trading_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures_status", secretScanRemediationReceiptChainSecretScanFailClosed.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures_status, SOURCE_READY_STATUS),
      condition("source.ready_secret_scan_fail_closed_row_count", secretScanRemediationReceiptChainSecretScanFailClosed.summary.ready_secret_scan_fail_closed_row_count, 8),
      condition("source.all_gate_rows_fail_closed", secretScanRemediationReceiptChainSecretScanFailClosed.summary.all_gate_rows_fail_closed, true),
      condition("source.no_secret_material_read", secretScanRemediationReceiptChainSecretScanFailClosed.summary.no_secret_material_read, true),
      condition("source.no_secret_or_trading_mutation", secretScanRemediationReceiptChainSecretScanFailClosed.summary.no_secret_or_trading_mutation, true),
      condition("source.secret_scan_remediation_action_allowed", secretScanRemediationReceiptChainSecretScanFailClosed.summary.secret_scan_remediation_action_allowed, false),
      condition("source.desktop_provider_key_visible", secretScanRemediationReceiptChainSecretScanFailClosed.summary.desktop_provider_key_visible, false),
    ]),
    remediationRowInput("dashboard_fix_action_registered", "review_dashboard", "action_items", [
      condition("dashboard.fix_action_registered", coverage.dashboard_fix_action_registered, true),
    ]),
    remediationRowInput("dashboard_remediation_actions_non_protected", "review_dashboard", "recommended_actions", [
      condition("dashboard.remediation_actions_non_protected", coverage.dashboard_remediation_actions_non_protected, true),
    ]),
    remediationRowInput("action_plan_no_auto_secret_fix_command", "control_plane_action_plan", "ACTION_COMMANDS", [
      condition("action_plan.no_auto_secret_fix_command", coverage.action_plan_no_auto_secret_fix_command, true),
    ]),
    remediationRowInput("human_gate_receipts_keep_pending_manual", "control_plane_human_gate_receipts", "receipt_input_draft", [
      condition("human_gate.pending_rows_do_not_trigger_actions", coverage.human_gate_receipts_keep_pending_manual, true),
    ]),
    remediationRowInput("remediation_no_auto_redaction_or_deletion", "package_json", "scripts", [
      condition("package.forbidden_secret_remediation_script_count", coverage.forbidden_secret_remediation_script_count, 0),
      condition("remediation.no_auto_redaction_or_deletion", coverage.remediation_no_auto_redaction_or_deletion, true),
    ]),
    remediationRowInput("remediation_no_secret_material_read", "secret_scan_remediation_boundary", "boundary", [
      condition("boundary.no_secret_material_read", coverage.no_secret_material_read, true),
    ]),
    remediationRowInput("remediation_no_trading_or_artifact_mutation", "secret_scan_remediation_boundary", "boundary", [
      condition("boundary.no_secret_or_trading_mutation", coverage.no_secret_or_trading_mutation, true),
    ]),
  ];
  return rowInputs.map((input, index) => buildRemediationRow(input, sourceReady, index));
}

function remediationRowInput(rowKey, artifactId, evidencePath, observedConditions) {
  return { rowKey, artifactId, evidencePath, observedConditions };
}

function buildRemediationRow(input, sourceReady, index) {
  const unsafeConditions = input.observedConditions.filter((item) => item.observed_value !== item.expected_safe_value || !item.condition_present);
  const rowReady = sourceReady && unsafeConditions.length === 0;
  const row = {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-row.v1",
    secret_scan_remediation_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation.row.${input.rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: input.rowKey,
    artifact_id: input.artifactId,
    evidence_path: input.evidencePath,
    observed_conditions: input.observedConditions,
    observed_condition_count: input.observedConditions.length,
    unsafe_condition_refs: unsafeConditions.map((item) => item.condition_path),
    secret_scan_remediation_status: rowReady ? READY_STATUS : "blocked",
    source_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_ready: sourceReady,
    remediation_action_registered: rowReady,
    remediation_action_advisory_only: rowReady,
    auto_fix_command_registered: false,
    auto_redaction_allowed: false,
    auto_deletion_allowed: false,
    auto_rotation_allowed: false,
    raw_secret_material_materialized: false,
    raw_secret_material_exposed: false,
    provider_key_material_present: false,
    environment_dump_present: false,
    desktop_provider_key_visible: false,
    secret_scan_remediation_action_allowed: false,
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    desktop_config_read: false,
    credential_lookup_allowed: false,
    plaintext_secret_allowed: false,
    model_context_secret_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    command_execution_performed: false,
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
  return withOrdinalAndHash(row, index, "secret_scan_remediation_hash");
}

function buildRemediationBoundary({ generatedAt, writeRequested, sourceReady, secretScanRemediationReceiptChainSecretScanFailClosed, rows, coverage }) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_scan_remediation_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_status: secretScanRemediationReceiptChainSecretScanFailClosed.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures_status,
    source_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_ready: sourceReady,
    secret_scan_remediation_row_count: rows.length,
    ready_secret_scan_remediation_row_count: rows.filter((row) => row.secret_scan_remediation_status === READY_STATUS).length,
    dashboard_fix_action_registered: coverage.dashboard_fix_action_registered,
    dashboard_remediation_actions_non_protected: coverage.dashboard_remediation_actions_non_protected,
    action_plan_no_auto_secret_fix_command: coverage.action_plan_no_auto_secret_fix_command,
    human_gate_receipts_keep_pending_manual: coverage.human_gate_receipts_keep_pending_manual,
    forbidden_secret_remediation_script_count: coverage.forbidden_secret_remediation_script_count,
    remediation_no_auto_redaction_or_deletion: coverage.remediation_no_auto_redaction_or_deletion,
    no_secret_material_read: coverage.no_secret_material_read,
    no_secret_or_trading_mutation: coverage.no_secret_or_trading_mutation,
    auto_fix_command_registered: false,
    auto_redaction_allowed: false,
    auto_deletion_allowed: false,
    auto_rotation_allowed: false,
    raw_secret_material_materialized: false,
    raw_secret_material_exposed: false,
    provider_key_material_present: false,
    environment_dump_present: false,
    desktop_provider_key_visible: false,
    secret_scan_remediation_action_allowed: false,
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    desktop_config_read: false,
    credential_lookup_allowed: false,
    plaintext_secret_allowed: false,
    model_context_secret_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    command_execution_performed: false,
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildRemediationGateRows({ secretScanRemediationReceiptChainSecretScanFailClosed, packageJson, platformOpsLedger, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const gateInputs = [
    ["p453_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_ready", "P453 secret scan remediation receipt chain secret scan fail-closed source is ready.", secretScanRemediationReceiptChainSecretScanFailClosed.validation.valid && secretScanRemediationReceiptChainSecretScanFailClosed.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures_status === SOURCE_READY_STATUS],
    ["platform_package_script_registered", "package.json registers the P454 trading secret scan remediation fixtures command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0],
    ["platform_validation_chain_registered", "Validation chain includes the P454 trading secret scan remediation fixtures command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)],
    ["p454_ledger_acceptance_declared", "P454 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P454: `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures`")],
    ["dashboard_fix_action_registered", "Review Dashboard exposes the Secrets Scan Gate remediation action.", boundary.dashboard_fix_action_registered],
    ["dashboard_remediation_actions_non_protected", "Dashboard remediation actions are advisory and non-protected.", boundary.dashboard_remediation_actions_non_protected],
    ["action_plan_no_auto_secret_fix_command", "Control-plane action plan does not auto-map secret fix actions to commands.", boundary.action_plan_no_auto_secret_fix_command],
    ["human_gate_receipts_keep_pending_manual", "Human gate receipts keep pending rows manual and non-triggering.", boundary.human_gate_receipts_keep_pending_manual],
    ["remediation_no_auto_redaction_or_deletion", "No automatic secret redaction, deletion, rotation, or apply scripts are registered.", boundary.remediation_no_auto_redaction_or_deletion],
    ["no_secret_or_trading_mutation", "P454 performs no secret reads, secret remediation action, credential lookup, trading writes, artifact mutation, release, git, or protected action.", boundary.no_secret_material_read && boundary.no_secret_or_trading_mutation && !boundary.secret_scan_remediation_action_allowed && !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.protected_action_executed],
  ];
  return gateInputs.map(([rowKey, description, passed], index) => withOrdinalAndHash(gateRow(rowKey, description, passed), index, "secret_scan_remediation_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-gate-row.v1",
    secret_scan_remediation_gate_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    auto_fix_command_registered_by_gate: false,
    auto_redaction_allowed_by_gate: false,
    auto_deletion_allowed_by_gate: false,
    auto_rotation_allowed_by_gate: false,
    raw_secret_material_materialized_by_gate: false,
    raw_secret_material_exposed_by_gate: false,
    provider_key_material_present_by_gate: false,
    environment_dump_present_by_gate: false,
    secret_scan_remediation_action_allowed_by_gate: false,
    secret_values_read_by_gate: false,
    env_file_read_by_gate: false,
    desktop_config_content_inspected_by_gate: false,
    desktop_config_read_by_gate: false,
    credential_lookup_allowed_by_gate: false,
    plaintext_secret_allowed_by_gate: false,
    broker_write_allowed_by_gate: false,
    exchange_write_allowed_by_gate: false,
    command_execution_performed_by_gate: false,
    artifact_write_performed_by_gate: false,
    protected_action_executed_by_gate: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ secretScanRemediationReceiptChainSecretScanFailClosed, sources, rows, gateRows, boundary, coverage }) {
  return [
    validationItem("source.secret_scan_remediation_receipt_chain_secret_scan_fail_closed", "p453_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_ready", secretScanRemediationReceiptChainSecretScanFailClosed.validation.valid && secretScanRemediationReceiptChainSecretScanFailClosed.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures_status === SOURCE_READY_STATUS, "P453 secret scan remediation receipt chain secret scan fail-closed fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", sources.packageJson.available, "package.json is readable for P454 secret scan remediation fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", sources.platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("source.review_dashboard", "review_dashboard_available", sources.reviewDashboard.available, "Review Dashboard source is readable."),
    validationItem("source.control_plane_action_plan", "control_plane_action_plan_available", sources.controlPlaneActionPlan.available, "Control-plane action plan source is readable."),
    validationItem("source.control_plane_human_gate_receipts", "control_plane_human_gate_receipts_available", sources.controlPlaneHumanGateReceipts.available, "Control-plane human gate receipt source is readable."),
    validationItem("secret_scan_remediation_rows", "secret_scan_remediation_rows_ready", rows.length === REQUIRED_ROW_KEYS.length && REQUIRED_ROW_KEYS.every((rowKey) => rows.some((row) => row.row_key === rowKey)) && rows.every((row) => row.secret_scan_remediation_status === READY_STATUS), "All secret scan remediation rows must be ready."),
    validationItem("secret_scan_remediation_gate_rows", "secret_scan_remediation_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.protected_action_executed_by_gate), "P454 secret scan remediation gates are ready."),
    validationItem("coverage.dashboard_fix_action", "dashboard_fix_action_registered", coverage.dashboard_fix_action_registered, "Dashboard must expose the Secrets Scan Gate fix action."),
    validationItem("coverage.dashboard_non_protected", "dashboard_remediation_actions_non_protected", coverage.dashboard_remediation_actions_non_protected, "Dashboard remediation actions must remain advisory and non-protected."),
    validationItem("coverage.action_plan_no_auto_command", "action_plan_no_auto_secret_fix_command", coverage.action_plan_no_auto_secret_fix_command, "Control-plane action plan must not auto-map secret fix actions to commands."),
    validationItem("coverage.human_receipts", "human_gate_receipts_keep_pending_manual", coverage.human_gate_receipts_keep_pending_manual, "Human gate receipts must keep pending rows manual and non-triggering."),
    validationItem("coverage.no_auto_redaction", "remediation_no_auto_redaction_or_deletion", coverage.remediation_no_auto_redaction_or_deletion && coverage.forbidden_secret_remediation_script_count === 0, "No automatic secret redaction, deletion, rotation, or apply scripts are allowed."),
    validationItem("boundary.no_secret_material_read", "no_secret_material_read", boundary.no_secret_material_read && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_config_read && !boundary.desktop_provider_key_visible, "P454 reads no secret values, env files, Desktop config content, or Desktop provider keys."),
    validationItem("boundary.no_mutation", "no_secret_or_trading_mutation", boundary.no_secret_or_trading_mutation && !boundary.secret_scan_remediation_action_allowed && !boundary.credential_lookup_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.command_execution_performed && !boundary.artifact_write_performed && !boundary.protected_action_executed, "P454 performs no secret remediation action, credential lookup, trading mutation, artifact mutation, or protected action."),
  ];
}

function buildSummary({ secretScanRemediationReceiptChainSecretScanFailClosed, rows, gateRows, boundary, coverage, validation }) {
  return {
    trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_status: secretScanRemediationReceiptChainSecretScanFailClosed.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_fixtures_status,
    source_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_ready: boundary.source_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_ready,
    required_row_count: REQUIRED_ROW_KEYS.length,
    secret_scan_remediation_row_count: rows.length,
    ready_secret_scan_remediation_row_count: boundary.ready_secret_scan_remediation_row_count,
    secret_scan_remediation_gate_count: gateRows.length,
    ready_secret_scan_remediation_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    dashboard_fix_action_registered: boundary.dashboard_fix_action_registered,
    dashboard_remediation_actions_non_protected: boundary.dashboard_remediation_actions_non_protected,
    action_plan_no_auto_secret_fix_command: boundary.action_plan_no_auto_secret_fix_command,
    human_gate_receipts_keep_pending_manual: boundary.human_gate_receipts_keep_pending_manual,
    forbidden_secret_remediation_script_count: boundary.forbidden_secret_remediation_script_count,
    remediation_no_auto_redaction_or_deletion: boundary.remediation_no_auto_redaction_or_deletion,
    no_secret_material_read: boundary.no_secret_material_read,
    no_secret_or_trading_mutation: boundary.no_secret_or_trading_mutation,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    auto_fix_command_registered: boundary.auto_fix_command_registered,
    auto_redaction_allowed: boundary.auto_redaction_allowed,
    auto_deletion_allowed: boundary.auto_deletion_allowed,
    auto_rotation_allowed: boundary.auto_rotation_allowed,
    raw_secret_material_materialized: boundary.raw_secret_material_materialized,
    raw_secret_material_exposed: boundary.raw_secret_material_exposed,
    provider_key_material_present: boundary.provider_key_material_present,
    environment_dump_present: boundary.environment_dump_present,
    desktop_provider_key_visible: boundary.desktop_provider_key_visible,
    secret_scan_remediation_action_allowed: boundary.secret_scan_remediation_action_allowed,
    secret_values_read: boundary.secret_values_read,
    env_file_read: boundary.env_file_read,
    desktop_config_content_inspected: boundary.desktop_config_content_inspected,
    desktop_config_read: boundary.desktop_config_read,
    credential_lookup_allowed: boundary.credential_lookup_allowed,
    plaintext_secret_allowed: boundary.plaintext_secret_allowed,
    model_context_secret_allowed: boundary.model_context_secret_allowed,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    command_execution_performed: boundary.command_execution_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    protected_action_executed: boundary.protected_action_executed,
    human_review_required: boundary.human_review_required,
    human_signoff_required: boundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Secret Scan Remediation Receipt Chain Secret Scan Remediation Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source secret scan remediation receipt chain secret scan fail-closed: ${result.summary.source_secret_scan_remediation_receipt_chain_secret_scan_fail_closed_status}`,
    `Secret scan remediation rows: ${result.summary.ready_secret_scan_remediation_row_count}/${result.summary.secret_scan_remediation_row_count}`,
    `Secret scan remediation gates: ${result.summary.ready_secret_scan_remediation_gate_count}/${result.summary.secret_scan_remediation_gate_count}`,
    "",
    "## Rows",
    "",
    ...result.secret_scan_remediation_rows.map((row) => `- ${row.row_key}: ${row.secret_scan_remediation_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_scan_remediation_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-gate-fixtures-schema") parsed.secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-attention-schema") parsed.secretScanRemediationReceiptChainSecretScanAttentionSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-fail-closed-schema") parsed.secretScanRemediationReceiptChainSecretScanFailClosedSchemaPath = argv[++index];
    else if (arg === "--review-dashboard") parsed.reviewDashboardPath = argv[++index];
    else if (arg === "--control-plane-action-plan") parsed.controlPlaneActionPlanPath = argv[++index];
    else if (arg === "--control-plane-human-gate-receipts") parsed.controlPlaneHumanGateReceiptsPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-fixtures.mjs [options]

Options:
  --out-dir <folder>                           Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_FIXTURES_OUT_DIR}
  --run-at <iso>                               Deterministic generated_at timestamp.
  --package <path>                             package.json path.
  --platform-ops-ledger <path>                 P341-P500 platform operations ledger path.
  --secret-scan-remediation-receipt-chain-secret-scan-gate-fixtures-schema <path>
                                               P451 secret scan gate fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-attention-schema <path>
                                               P452 secret scan attention fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-fail-closed-schema <path>
                                               P453 secret scan fail-closed fixtures schema path.
  --review-dashboard <path>                    Review Dashboard source path.
  --control-plane-action-plan <path>           Control-plane action plan source path.
  --control-plane-human-gate-receipts <path>   Control-plane human gate receipts source path.
  --schema <path>                              Output schema path.
  --check                                      Validate only, do not write artifacts.
  -h, --help                                   Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_FIXTURES_INPUTS.platformOpsLedgerPath),
    secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_attention_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanAttentionSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanAttentionSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_fail_closed_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanFailClosedSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanFailClosedSchemaPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_FIXTURES_INPUTS.reviewDashboardPath),
    control_plane_action_plan_path: path.resolve(options.controlPlaneActionPlanPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_FIXTURES_INPUTS.controlPlaneActionPlanPath),
    control_plane_human_gate_receipts_path: path.resolve(options.controlPlaneHumanGateReceiptsPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_FIXTURES_INPUTS.controlPlaneHumanGateReceiptsPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_FIXTURES_INPUTS.schemaPath),
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

function condition(conditionPath, observedValue, expectedSafeValue) {
  return {
    condition_path: conditionPath,
    expected_safe_value: expectedSafeValue,
    observed_value: observedValue,
    condition_present: typeof observedValue === "boolean" || typeof observedValue === "string" || typeof observedValue === "number",
    unsafe_when_not_safe: true,
  };
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

function includesAll(text, snippets) {
  return snippets.every((snippet) => text.includes(snippet));
}

function includesAny(text, snippets) {
  return snippets.some((snippet) => text.includes(snippet));
}

function hasActionCommandMapping(text, actionName) {
  return new RegExp(`["']?${actionName}["']?\\s*:`).test(text);
}

function extractBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) return "";
  const end = text.indexOf(endMarker, start + startMarker.length);
  return end === -1 ? text.slice(start) : text.slice(start, end);
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dateStamp(isoDate) {
  return isoDate.slice(0, 10).replaceAll("-", "");
}
