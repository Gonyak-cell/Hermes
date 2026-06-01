import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainReviewFixtures,
} from "./trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS,
  secretScanRemediationReceiptChainSecretScanRemediationReceiptChainReviewSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_REVIEW_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures";
const PHASE_SLOT = "P467";
const PREVIOUS_PHASE_SLOT = "P466";
const NEXT_PHASE_SLOT = "P468";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review";
const SOURCE_REVIEW_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_human_review";
const SIGNOFF_LEDGER_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff";
const SIGNOFF_LEDGER_CHECKS = [
  "p466_review_ready",
  "review_packet_declared",
  "review_not_completed",
  "signoff_ledger_declared",
  "signoff_pending",
  "receipt_payload_absent",
  "approval_application_absent",
  "secret_material_boundary_stays_false",
  "trading_mutation_disabled",
];

export async function runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffLedgerFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffLedgerFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffLedgerFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt chain signoff ledger fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffLedgerFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const chainReview = await buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainReviewFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_schema_path,
    secretScanRemediationReceiptChainSecretScanAttentionSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_attention_schema_path,
    secretScanRemediationReceiptChainSecretScanFailClosedSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_fail_closed_schema_path,
    secretScanRemediationReceiptChainSecretScanRemediationSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_schema_path,
    controlPlaneHumanGateReceiptsPath: inputs.control_plane_human_gate_receipts_path,
    reviewDashboardPath: inputs.review_dashboard_path,
    controlPlaneActionPlanPath: inputs.control_plane_action_plan_path,
    secretScanRemediationReceiptChainSecretScanRemediationReceiptTemplateSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_template_schema_path,
    secretScanRemediationReceiptChainSecretScanRemediationReceiptIntakeSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_intake_schema_path,
    secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationRulesSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_rules_schema_path,
    secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_schema_path,
    secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceMergeSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_schema_path,
    secretScanRemediationReceiptChainSecretScanRemediationReceiptMergePreflightSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_merge_preflight_schema_path,
    secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationPacketSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_schema_path,
    secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalPlanSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_schema_path,
    secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalCloseoutSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_closeout_schema_path,
    secretScanRemediationReceiptChainSecretScanRemediationReceiptCloseoutSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_schema_path,
    secretScanRemediationReceiptChainSecretScanRemediationReceiptChainRegressionSchemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_schema_path,
    schemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_schema_path,
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
    trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_anchor: signoffAnchor,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_rows: signoffRows,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_gate_rows: signoffGateRows,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_boundary: signoffBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ chainReview, signoffRows, signoffGateRows, signoffBoundary, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures_id = result.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffLedgerFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-rows.v1", "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_rows", result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-gate-rows.v1", "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_gate_rows", result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-boundary.json"), result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffLedgerFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffLedgerFixtures(args);
    console.log(`Trading secret scan remediation receipt chain signoff ledger fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures_status}`);
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
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_review_fixtures_id: chainReview.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_fixtures_id,
    source_secret_scan_remediation_receipt_chain_review_status: chainReview.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_fixtures_status,
    source_hash: hashValue({
      id: chainReview.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_fixtures_id,
      status: chainReview.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_fixtures_status,
      review_rows: chainReview.summary.chain_review_row_count,
      review_gate_rows: chainReview.summary.chain_review_gate_count,
    }),
  };
}

function buildSignoffRows(chainReview) {
  const sourceReady = chainReview.validation.valid && chainReview.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_fixtures_status === SOURCE_READY_STATUS;
  return chainReview.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_rows.map((sourceRow, index) => {
    const signoffReady = sourceReady && sourceRow.chain_review_status === SOURCE_REVIEW_READY_STATUS;
    const row = {
      schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-row.v1",
      secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger.row.${sourceRow.source_phase_slot.toLowerCase()}`,
      phase_slot: PHASE_SLOT,
      source_chain_review_row_id: sourceRow.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_row_id,
      source_phase_slot: sourceRow.source_phase_slot,
      package_script_name: sourceRow.package_script_name,
      workflow_id: sourceRow.workflow_id,
      chain_signoff_status: signoffReady ? SIGNOFF_LEDGER_READY_STATUS : "blocked",
      source_chain_review_status: sourceRow.chain_review_status,
      source_secret_scan_remediation_receipt_chain_review_status: chainReview.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_fixtures_status,
      reviewer_role: sourceRow.reviewer_role,
      required_signoff_role: "trading_secret_scan_signoff_owner",
      required_signoff_decision: "signoff_required_before_receipt_collection",
      secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_declared: sourceRow.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_declared,
      secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_declared: true,
      review_completed: sourceRow.review_completed,
      review_approval_applied: sourceRow.review_approval_applied,
      signoff_completed: false,
      signoff_approval_applied: false,
      p455_p464_chain_ready: sourceRow.p455_p464_chain_ready,
      human_receipts_pending: sourceRow.human_receipts_pending,
      no_secret_material_read: sourceRow.no_secret_material_read,
      no_secret_or_trading_mutation: sourceRow.no_secret_or_trading_mutation,
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
      secret_values_read_by_signoff: false,
      env_file_read_by_signoff: false,
      desktop_config_content_inspected_by_signoff: false,
      desktop_config_read_by_signoff: false,
      raw_secret_material_materialized_by_signoff: false,
      raw_secret_material_exposed_by_signoff: false,
      desktop_provider_key_visible_by_signoff: false,
      forbidden_receipt_fields_allowed_by_signoff: false,
      secret_scan_remediation_action_allowed_by_signoff: false,
      auto_fix_command_registered_by_signoff: false,
      auto_redaction_allowed_by_signoff: false,
      auto_deletion_allowed_by_signoff: false,
      auto_rotation_allowed_by_signoff: false,
      credential_lookup_allowed_by_signoff: false,
      command_execution_performed_by_signoff: false,
      artifact_read_performed_by_signoff: false,
      artifact_write_performed_by_signoff: false,
      protected_action_executed_by_signoff: false,
      automatic_order_submission_allowed_by_signoff: false,
      live_execution_allowed_by_signoff: false,
      broker_write_allowed_by_signoff: false,
      exchange_write_allowed_by_signoff: false,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_hash");
  });
}

function buildSignoffBoundary({ generatedAt, writeRequested, chainReview, signoffRows }) {
  const sourceSummary = chainReview.summary;
  const sourceReady = chainReview.validation.valid && sourceSummary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_fixtures_status === SOURCE_READY_STATUS;
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_receipt_chain_review_status: sourceSummary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_fixtures_status,
    source_secret_scan_remediation_receipt_chain_review_ready: sourceReady,
    chain_signoff_row_count: signoffRows.length,
    ready_chain_signoff_row_count: signoffRows.filter((row) => row.chain_signoff_status === SIGNOFF_LEDGER_READY_STATUS).length,
    chain_review_consumed_in_memory: true,
    chain_review_artifact_read_performed: false,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_declared: true,
    review_completed: false,
    review_approval_applied: false,
    signoff_completed: false,
    signoff_approval_applied: false,
    p455_p464_chain_ready: sourceSummary.p455_p464_chain_ready,
    human_receipts_pending: sourceSummary.human_receipts_pending,
    no_secret_material_read: sourceSummary.no_secret_material_read,
    no_secret_or_trading_mutation: sourceSummary.no_secret_or_trading_mutation,
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
    source_receipt_present: sourceSummary.receipt_payload_present,
    source_approval_applied: sourceSummary.approval_applied,
    real_enablement_count: 0,
    shadow_live_enabled: false,
    limited_live_enabled: false,
    full_auto_enabled: false,
    automatic_order_submission_allowed: false,
    live_order_submission_allowed: false,
    live_execution_allowed: false,
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    desktop_config_read: false,
    raw_secret_material_materialized: false,
    raw_secret_material_exposed: false,
    desktop_provider_key_visible: false,
    forbidden_receipt_fields_allowed: false,
    secret_scan_remediation_action_allowed: false,
    auto_fix_command_registered: false,
    auto_redaction_allowed: false,
    auto_deletion_allowed: false,
    auto_rotation_allowed: false,
    credential_lookup_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    command_execution_performed: false,
    package_command_execution_performed: false,
    release_check_execution_performed: false,
    artifact_read_performed: false,
    artifact_write_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildSignoffGateRows({ chainReview, packageJson, platformOpsLedger, signoffRows, signoffBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const sourceRowsReady = chainReview.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_rows.length === 10 && chainReview.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_rows.every((row) => row.chain_review_status === SOURCE_REVIEW_READY_STATUS && row.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_declared && !row.review_completed && !row.review_approval_applied);
  const rows = [
    gateRow("p466_chain_review_ready", "P466 secret scan remediation receipt chain review source is ready.", chainReview.validation.valid && chainReview.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P467 trading secret scan remediation receipt chain signoff ledger fixtures command.", typeof scripts["trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-fixtures"] === "string" && scripts["trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P467 trading secret scan remediation receipt chain signoff ledger fixtures command.", validateScript.includes("npm run trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-fixtures -- --check")),
    gateRow("p467_ledger_acceptance_declared", "P467 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P467: `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-fixtures`")),
    gateRow("p466_review_rows_ready", "Every P466 secret scan remediation receipt chain review row is ready and still pending.", sourceRowsReady),
    gateRow("chain_signoff_rows_ready", "Every secret scan remediation receipt chain signoff row is ready while signoff remains pending.", signoffRows.length === 10 && signoffRows.every((row) => row.chain_signoff_status === SIGNOFF_LEDGER_READY_STATUS && row.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_declared && !row.signoff_completed && !row.signoff_approval_applied && row.human_receipts_pending)),
    gateRow("signoff_pending_not_applied", "P467 declares signoff ledger rows without completing signoff or applying approvals.", !signoffBoundary.signoff_completed && !signoffBoundary.signoff_approval_applied && signoffBoundary.human_review_required && !signoffBoundary.approval_applied),
    gateRow("no_secret_material_read", "P467 reads no secret values, env files, Desktop config content, raw secret material, provider keys, or credentials.", signoffBoundary.no_secret_material_read && !signoffBoundary.secret_values_read && !signoffBoundary.env_file_read && !signoffBoundary.desktop_config_content_inspected && !signoffBoundary.desktop_config_read && !signoffBoundary.raw_secret_material_materialized && !signoffBoundary.raw_secret_material_exposed && !signoffBoundary.desktop_provider_key_visible && !signoffBoundary.credential_lookup_allowed),
    gateRow("no_receipt_or_trading_mutation", "P467 does not receive, validate, apply, enable, execute, remediate, or mutate trading state.", signoffBoundary.no_secret_or_trading_mutation && !signoffBoundary.actor_workspace_input_present && !signoffBoundary.receipt_payload_present && !signoffBoundary.ready_for_validation && !signoffBoundary.ready_for_approval_application && !signoffBoundary.receipt_received && !signoffBoundary.receipt_validated && !signoffBoundary.receipt_application_performed && !signoffBoundary.approval_applied && !signoffBoundary.forbidden_receipt_fields_allowed && !signoffBoundary.secret_scan_remediation_action_allowed && !signoffBoundary.auto_fix_command_registered && !signoffBoundary.auto_redaction_allowed && !signoffBoundary.auto_deletion_allowed && !signoffBoundary.auto_rotation_allowed && !signoffBoundary.shadow_live_enabled && !signoffBoundary.limited_live_enabled && !signoffBoundary.full_auto_enabled && !signoffBoundary.automatic_order_submission_allowed && !signoffBoundary.live_order_submission_allowed && !signoffBoundary.live_execution_allowed && !signoffBoundary.broker_write_allowed && !signoffBoundary.exchange_write_allowed),
    gateRow("no_command_or_artifact_mutation", "P467 signoff ledger does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !signoffBoundary.command_execution_performed && !signoffBoundary.package_command_execution_performed && !signoffBoundary.release_check_execution_performed && !signoffBoundary.artifact_read_performed && !signoffBoundary.artifact_write_performed && !signoffBoundary.release_published && !signoffBoundary.git_operation_performed && !signoffBoundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-gate-row.v1",
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_gate_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-fixtures.gate.${rowKey}`,
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
    secret_values_read_by_signoff: false,
    env_file_read_by_signoff: false,
    desktop_config_content_inspected_by_signoff: false,
    desktop_config_read_by_signoff: false,
    raw_secret_material_materialized_by_signoff: false,
    raw_secret_material_exposed_by_signoff: false,
    desktop_provider_key_visible_by_signoff: false,
    forbidden_receipt_fields_allowed_by_signoff: false,
    secret_scan_remediation_action_allowed_by_signoff: false,
    auto_fix_command_registered_by_signoff: false,
    auto_redaction_allowed_by_signoff: false,
    auto_deletion_allowed_by_signoff: false,
    auto_rotation_allowed_by_signoff: false,
    credential_lookup_allowed_by_signoff: false,
    command_execution_performed_by_signoff: false,
    artifact_read_performed_by_signoff: false,
    artifact_write_performed_by_signoff: false,
    protected_action_executed_by_signoff: false,
    automatic_order_submission_allowed_by_signoff: false,
    live_execution_allowed_by_signoff: false,
    broker_write_allowed_by_signoff: false,
    exchange_write_allowed_by_signoff: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ chainReview, packageJson, platformOpsLedger, signoffRows, signoffGateRows, signoffBoundary }) {
  return [
    validationItem("source.secret_scan_remediation_receipt_chain_review", "p466_chain_review_ready", chainReview.validation.valid && chainReview.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_fixtures_status === SOURCE_READY_STATUS, "P466 secret scan remediation receipt chain review fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P467 secret scan remediation receipt chain signoff ledger fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_rows", "chain_signoff_rows_ready", signoffRows.length === 10 && signoffRows.every((row) => row.chain_signoff_status === SIGNOFF_LEDGER_READY_STATUS && row.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_declared && !row.signoff_completed && !row.signoff_approval_applied && !row.receipt_payload_present && !row.approval_applied_by_signoff && row.p455_p464_chain_ready && row.human_receipts_pending && row.no_secret_material_read && row.no_secret_or_trading_mutation && !row.secret_values_read_by_signoff && !row.raw_secret_material_materialized_by_signoff && !row.raw_secret_material_exposed_by_signoff && !row.desktop_provider_key_visible_by_signoff && !row.secret_scan_remediation_action_allowed_by_signoff && !row.credential_lookup_allowed_by_signoff), "P455-P464 secret scan remediation receipt chain signoff rows must be ready and pending signoff."),
    validationItem("secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_gate_rows", "chain_signoff_gates_ready", signoffGateRows.length >= 9 && signoffGateRows.every((row) => row.gate_status === "ready" && !row.signoff_completed_by_signoff && !row.approval_applied_by_signoff && !row.desktop_provider_key_visible_by_signoff && !row.secret_scan_remediation_action_allowed_by_signoff && !row.protected_action_executed_by_signoff), "P467 secret scan remediation receipt chain signoff gates are ready."),
    validationItem("boundary.signoff_pending", "signoff_pending_not_applied", signoffBoundary.read_only && signoffBoundary.report_only && signoffBoundary.chain_review_consumed_in_memory && !signoffBoundary.chain_review_artifact_read_performed && signoffBoundary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_declared && !signoffBoundary.review_completed && !signoffBoundary.review_approval_applied && !signoffBoundary.signoff_completed && !signoffBoundary.signoff_approval_applied && signoffBoundary.p455_p464_chain_ready && signoffBoundary.human_receipts_pending && signoffBoundary.human_review_required, "Secret scan remediation receipt chain signoff remains pending and unapplied."),
    validationItem("boundary.no_secret_material_read", "no_secret_material_read", signoffBoundary.no_secret_material_read && !signoffBoundary.secret_values_read && !signoffBoundary.env_file_read && !signoffBoundary.desktop_config_content_inspected && !signoffBoundary.desktop_config_read && !signoffBoundary.raw_secret_material_materialized && !signoffBoundary.raw_secret_material_exposed && !signoffBoundary.desktop_provider_key_visible && !signoffBoundary.credential_lookup_allowed, "P467 reads no secret material or credentials."),
    validationItem("boundary.no_receipt_or_trading_mutation", "no_receipt_or_trading_mutation", signoffBoundary.no_secret_or_trading_mutation && !signoffBoundary.actor_workspace_input_present && !signoffBoundary.receipt_input_file_materialized && !signoffBoundary.merged_receipt_input_materialized && !signoffBoundary.receipt_payload_present && !signoffBoundary.ready_for_validation && !signoffBoundary.ready_for_approval_application && !signoffBoundary.receipt_received && !signoffBoundary.receipt_validated && !signoffBoundary.receipt_application_performed && !signoffBoundary.approval_applied && !signoffBoundary.forbidden_receipt_fields_allowed && !signoffBoundary.secret_scan_remediation_action_allowed && !signoffBoundary.auto_fix_command_registered && !signoffBoundary.auto_redaction_allowed && !signoffBoundary.auto_deletion_allowed && !signoffBoundary.auto_rotation_allowed && !signoffBoundary.shadow_live_enabled && !signoffBoundary.limited_live_enabled && !signoffBoundary.full_auto_enabled && !signoffBoundary.automatic_order_submission_allowed && !signoffBoundary.live_order_submission_allowed && !signoffBoundary.live_execution_allowed && !signoffBoundary.broker_write_allowed && !signoffBoundary.exchange_write_allowed, "P467 does not receive/apply receipts or enable trading mutation."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !signoffBoundary.command_execution_performed && !signoffBoundary.package_command_execution_performed && !signoffBoundary.release_check_execution_performed && !signoffBoundary.artifact_read_performed && !signoffBoundary.artifact_write_performed && !signoffBoundary.release_published && !signoffBoundary.git_operation_performed && !signoffBoundary.protected_action_executed, "P467 does not execute commands or read/write artifacts."),
    validationItem("boundary.no_source_receipt_or_approval", "no_source_receipt_or_approval", !signoffBoundary.source_receipt_present && !signoffBoundary.source_approval_applied, "P467 must not inherit pre-applied secret scan remediation receipts or approvals."),
  ];
}

function buildSummary({ chainReview, signoffRows, signoffGateRows, signoffBoundary, validation }) {
  return {
    trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_review_status: chainReview.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_fixtures_status,
    source_secret_scan_remediation_receipt_chain_review_ready: signoffBoundary.source_secret_scan_remediation_receipt_chain_review_ready,
    chain_signoff_row_count: signoffRows.length,
    ready_chain_signoff_row_count: signoffBoundary.ready_chain_signoff_row_count,
    chain_signoff_gate_count: signoffGateRows.length,
    ready_chain_signoff_gate_count: signoffGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: signoffBoundary.read_only,
    report_only: signoffBoundary.report_only,
    chain_review_consumed_in_memory: signoffBoundary.chain_review_consumed_in_memory,
    chain_review_artifact_read_performed: signoffBoundary.chain_review_artifact_read_performed,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_declared: signoffBoundary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_declared,
    review_completed: signoffBoundary.review_completed,
    review_approval_applied: signoffBoundary.review_approval_applied,
    signoff_completed: signoffBoundary.signoff_completed,
    signoff_approval_applied: signoffBoundary.signoff_approval_applied,
    p455_p464_chain_ready: signoffBoundary.p455_p464_chain_ready,
    human_receipts_pending: signoffBoundary.human_receipts_pending,
    no_secret_material_read: signoffBoundary.no_secret_material_read,
    no_secret_or_trading_mutation: signoffBoundary.no_secret_or_trading_mutation,
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
    secret_values_read: signoffBoundary.secret_values_read,
    env_file_read: signoffBoundary.env_file_read,
    desktop_config_content_inspected: signoffBoundary.desktop_config_content_inspected,
    desktop_config_read: signoffBoundary.desktop_config_read,
    raw_secret_material_materialized: signoffBoundary.raw_secret_material_materialized,
    raw_secret_material_exposed: signoffBoundary.raw_secret_material_exposed,
    desktop_provider_key_visible: signoffBoundary.desktop_provider_key_visible,
    forbidden_receipt_fields_allowed: signoffBoundary.forbidden_receipt_fields_allowed,
    secret_scan_remediation_action_allowed: signoffBoundary.secret_scan_remediation_action_allowed,
    auto_fix_command_registered: signoffBoundary.auto_fix_command_registered,
    auto_redaction_allowed: signoffBoundary.auto_redaction_allowed,
    auto_deletion_allowed: signoffBoundary.auto_deletion_allowed,
    auto_rotation_allowed: signoffBoundary.auto_rotation_allowed,
    credential_lookup_allowed: signoffBoundary.credential_lookup_allowed,
    source_receipt_present: signoffBoundary.source_receipt_present,
    source_approval_applied: signoffBoundary.source_approval_applied,
    real_enablement_count: signoffBoundary.real_enablement_count,
    shadow_live_enabled: signoffBoundary.shadow_live_enabled,
    limited_live_enabled: signoffBoundary.limited_live_enabled,
    full_auto_enabled: signoffBoundary.full_auto_enabled,
    automatic_order_submission_allowed: signoffBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: signoffBoundary.live_order_submission_allowed,
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
    human_signoff_required: signoffBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Secret Scan Remediation Receipt Chain Secret Scan Remediation Receipt Chain Signoff Ledger Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source chain review: ${result.summary.source_secret_scan_remediation_receipt_chain_review_status}`,
    `Signoff rows: ${result.summary.ready_chain_signoff_row_count}/${result.summary.chain_signoff_row_count}`,
    `Signoff gates: ${result.summary.ready_chain_signoff_gate_count}/${result.summary.chain_signoff_gate_count}`,
    "",
    "## Signoff Rows",
    "",
    ...result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_rows.map((row) => `- ${row.source_phase_slot} ${row.package_script_name}: ${row.chain_signoff_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_OUT_DIR };
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
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-template-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptTemplateSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-intake-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptIntakeSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-validation-rules-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationRulesSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceMergeSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-merge-preflight-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptMergePreflightSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-validation-packet-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationPacketSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalPlanSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-closeout-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalCloseoutSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-closeout-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptCloseoutSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptChainRegressionSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptChainReviewSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-ledger-fixtures.mjs [options]

Options:
  --out-dir <folder>                                                       Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_OUT_DIR}
  --run-at <iso>                                                           Deterministic generated_at timestamp.
  --package <path>                                                         package.json path.
  --platform-ops-ledger <path>                                             P341-P500 platform operations ledger path.
  --secret-scan-remediation-receipt-chain-secret-scan-gate-fixtures-schema <path>
                                                                           P451 secret scan gate fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-attention-schema <path>
                                                                           P452 secret scan attention fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-fail-closed-schema <path>
                                                                           P453 secret scan fail-closed fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-schema <path>
                                                                           P454 secret scan remediation fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-template-schema <path>
                                                                           P455 receipt template fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-intake-schema <path>                   P456 receipt intake fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-validation-rules-schema <path>         P457 receipt validation rules fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-schema <path>                P458 receipt workspace fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-workspace-merge-schema <path>          P459 receipt workspace merge fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-merge-preflight-schema <path>          P460 receipt merge preflight fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-validation-packet-schema <path>        P461 receipt validation packet fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-plan-schema <path>            P462 receipt approval plan fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-approval-closeout-schema <path>        P463 receipt approval closeout fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-closeout-schema <path>                 P464 receipt closeout fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-regression-schema <path>         P465 receipt chain regression fixtures schema path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-review-schema <path>             P466 receipt chain review fixtures schema path.
  --review-dashboard <path>                                                Review Dashboard source path.
  --control-plane-action-plan <path>                                       Control-plane action plan source path.
  --control-plane-human-gate-receipts <path>                               Control-plane human gate receipts source path.
  --schema <path>                                                          Output schema path.
  --check                                                                  Validate only, do not write artifacts.
  -h, --help                                                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.platformOpsLedgerPath),
    control_plane_human_gate_receipts_path: path.resolve(options.controlPlaneHumanGateReceiptsPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.controlPlaneHumanGateReceiptsPath),
    secret_scan_remediation_receipt_chain_secret_scan_gate_fixtures_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanGateFixturesSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_attention_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanAttentionSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanAttentionSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_fail_closed_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanFailClosedSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanFailClosedSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationSchemaPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.reviewDashboardPath),
    control_plane_action_plan_path: path.resolve(options.controlPlaneActionPlanPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.controlPlaneActionPlanPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_template_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptTemplateSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptTemplateSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_intake_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptIntakeSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptIntakeSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_rules_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationRulesSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationRulesSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_workspace_merge_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceMergeSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptWorkspaceMergeSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_merge_preflight_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptMergePreflightSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptMergePreflightSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_validation_packet_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationPacketSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptValidationPacketSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_plan_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalPlanSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalPlanSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_approval_closeout_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalCloseoutSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptApprovalCloseoutSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_closeout_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptCloseoutSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_regression_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptChainRegressionSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptChainRegressionSchemaPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptChainReviewSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptChainReviewSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.schemaPath),
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
