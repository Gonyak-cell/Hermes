import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationReceiptChainSignoffLedgerFixtures,
} from "./trading-secret-scan-remediation-receipt-chain-signoff-ledger-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-chain-signoff-template-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS,
  secretScanRemediationReceiptChainSignoffLedgerSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_LEDGER_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-chain-signoff-template-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-chain-signoff-template-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_chain_signoff_template_fixtures";
const PHASE_SLOT = "P442";
const PREVIOUS_PHASE_SLOT = "P441";
const NEXT_PHASE_SLOT = "P443";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_signoff_template";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_signoff_ledger";
const SOURCE_SIGNOFF_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_signoff";
const SIGNOFF_TEMPLATE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_signoff_template";
const SIGNOFF_TEMPLATE_CHECKS = [
  "p441_signoff_ledger_ready",
  "signoff_ledger_row_declared",
  "signoff_not_completed",
  "signoff_template_declared",
  "signoff_template_materialization_pending",
  "receipt_payload_absent",
  "approval_application_absent",
  "secret_material_boundary_stays_false",
  "trading_mutation_disabled",
];

export async function runTradingSecretScanRemediationReceiptChainSignoffTemplateFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptChainSignoffTemplateFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptChainSignoffTemplateFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt chain signoff template fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptChainSignoffTemplateFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const signoffLedger = await buildTradingSecretScanRemediationReceiptChainSignoffLedgerFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    secretScanRemediationReceiptWorkspaceSchemaPath: inputs.secret_scan_remediation_receipt_workspace_schema_path,
    secretScanRemediationReceiptWorkspaceMergeSchemaPath: inputs.secret_scan_remediation_receipt_workspace_merge_schema_path,
    secretScanRemediationReceiptMergePreflightSchemaPath: inputs.secret_scan_remediation_receipt_merge_preflight_schema_path,
    secretScanRemediationReceiptValidationPacketSchemaPath: inputs.secret_scan_remediation_receipt_validation_packet_schema_path,
    secretScanRemediationReceiptApprovalPlanSchemaPath: inputs.secret_scan_remediation_receipt_approval_plan_schema_path,
    secretScanRemediationReceiptApprovalCloseoutSchemaPath: inputs.secret_scan_remediation_receipt_approval_closeout_schema_path,
    secretScanRemediationReceiptCloseoutSchemaPath: inputs.secret_scan_remediation_receipt_closeout_schema_path,
    secretScanRemediationReceiptChainRegressionSchemaPath: inputs.secret_scan_remediation_receipt_chain_regression_schema_path,
    secretScanRemediationReceiptChainReviewSchemaPath: inputs.secret_scan_remediation_receipt_chain_review_schema_path,
    secretScanRemediationReceiptChainSignoffLedgerSchemaPath: inputs.secret_scan_remediation_receipt_chain_signoff_ledger_schema_path,
    schemaPath: inputs.secret_scan_remediation_receipt_chain_signoff_ledger_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const templateAnchor = buildTemplateAnchor(signoffLedger);
  const templateRows = buildTemplateRows(signoffLedger);
  const templateBoundary = buildTemplateBoundary({ generatedAt, writeRequested: options.write !== false, signoffLedger, templateRows });
  const templateGateRows = buildTemplateGateRows({ signoffLedger, packageJson, platformOpsLedger, templateRows, templateBoundary });
  const validationItems = buildValidationItems({ signoffLedger, packageJson, platformOpsLedger, templateRows, templateGateRows, templateBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ signoffLedger, templateRows, templateGateRows, templateBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_scan_remediation_receipt_chain_signoff_template_fixtures_id: `trading-secret-scan-remediation-receipt-chain-signoff-template-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_scan_remediation_receipt_chain_signoff_template_anchor: templateAnchor,
    secret_scan_remediation_receipt_chain_signoff_template_rows: templateRows,
    secret_scan_remediation_receipt_chain_signoff_template_gate_rows: templateGateRows,
    secret_scan_remediation_receipt_chain_signoff_template_boundary: templateBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_chain_signoff_template_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ signoffLedger, templateRows, templateGateRows, templateBoundary, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_chain_signoff_template_fixtures_id = result.trading_secret_scan_remediation_receipt_chain_signoff_template_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptChainSignoffTemplateFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-chain-signoff-template-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-signoff-template-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-signoff-template-rows.v1", "secret_scan_remediation_receipt_chain_signoff_template_rows", result.secret_scan_remediation_receipt_chain_signoff_template_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-signoff-template-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-signoff-template-gate-rows.v1", "secret_scan_remediation_receipt_chain_signoff_template_gate_rows", result.secret_scan_remediation_receipt_chain_signoff_template_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-signoff-template-boundary.json"), result.secret_scan_remediation_receipt_chain_signoff_template_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-remediation-receipt-chain-signoff-template-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptChainSignoffTemplateFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptChainSignoffTemplateFixtures(args);
    console.log(`Trading secret scan remediation receipt chain signoff template fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_signoff_template_fixtures_status}`);
    console.log(`Signoff templates: ${result.summary.ready_chain_signoff_template_row_count}/${result.summary.chain_signoff_template_row_count}`);
    console.log(`Template gates: ${result.summary.ready_chain_signoff_template_gate_count}/${result.summary.chain_signoff_template_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildTemplateAnchor(signoffLedger) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-signoff-template-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures_id: signoffLedger.trading_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures_id,
    source_secret_scan_remediation_receipt_chain_signoff_ledger_status: signoffLedger.summary.trading_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures_status,
    source_hash: hashValue({
      id: signoffLedger.trading_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures_id,
      status: signoffLedger.summary.trading_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures_status,
      chain_signoff_rows: signoffLedger.summary.chain_signoff_row_count,
      chain_signoff_gate_rows: signoffLedger.summary.chain_signoff_gate_count,
    }),
  };
}

function buildTemplateRows(signoffLedger) {
  const sourceReady = signoffLedger.validation.valid && signoffLedger.summary.trading_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures_status === SOURCE_READY_STATUS;
  return signoffLedger.secret_scan_remediation_receipt_chain_signoff_ledger_rows.map((sourceRow, index) => {
    const templateReady = sourceReady && sourceRow.chain_signoff_status === SOURCE_SIGNOFF_READY_STATUS;
    const row = {
      schema_version: "trading-secret-scan-remediation-receipt-chain-signoff-template-row.v1",
      secret_scan_remediation_receipt_chain_signoff_template_row_id: `trading-secret-scan-remediation-receipt-chain-signoff-template.row.${sourceRow.source_phase_slot.toLowerCase()}`,
      phase_slot: PHASE_SLOT,
      source_chain_signoff_ledger_row_id: sourceRow.secret_scan_remediation_receipt_chain_signoff_ledger_row_id,
      source_chain_review_row_id: sourceRow.source_chain_review_row_id,
      source_phase_slot: sourceRow.source_phase_slot,
      package_script_name: sourceRow.package_script_name,
      workflow_id: sourceRow.workflow_id,
      chain_signoff_template_status: templateReady ? SIGNOFF_TEMPLATE_READY_STATUS : "blocked",
      source_chain_signoff_status: sourceRow.chain_signoff_status,
      source_chain_review_status: sourceRow.source_chain_review_status,
      source_secret_scan_remediation_receipt_chain_signoff_ledger_status: signoffLedger.summary.trading_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures_status,
      source_secret_scan_remediation_receipt_chain_review_status: sourceRow.source_secret_scan_remediation_receipt_chain_review_status,
      reviewer_role: sourceRow.reviewer_role,
      required_signoff_role: sourceRow.required_signoff_role,
      required_signoff_decision: sourceRow.required_signoff_decision,
      required_template_fields: [
        "signoff_owner_id",
        "signed_at",
        "source_chain_signoff_ledger_row_id",
        "decision",
        "evidence_reference",
        "blocker_note",
      ],
      allowed_signoff_decisions: ["signoff_ready", "return_with_blocker"],
      secret_scan_remediation_receipt_chain_review_declared: sourceRow.secret_scan_remediation_receipt_chain_review_declared,
      secret_scan_remediation_receipt_chain_signoff_ledger_declared: sourceRow.secret_scan_remediation_receipt_chain_signoff_ledger_declared,
      secret_scan_remediation_receipt_chain_signoff_template_declared: true,
      signoff_template_materialized: false,
      review_completed: sourceRow.review_completed,
      review_approval_applied: sourceRow.review_approval_applied,
      signoff_completed: false,
      signoff_approval_applied: false,
      p429_p438_chain_ready: sourceRow.p429_p438_chain_ready,
      human_receipts_pending: sourceRow.human_receipts_pending,
      no_secret_material_read: sourceRow.no_secret_material_read,
      no_secret_or_trading_mutation: sourceRow.no_secret_or_trading_mutation,
      chain_signoff_template_checks: SIGNOFF_TEMPLATE_CHECKS,
      actor_workspace_input_present: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      ready_for_validation: false,
      ready_for_approval_application: false,
      receipt_received_by_template: false,
      receipt_validated_by_template: false,
      receipt_application_performed_by_template: false,
      approval_applied_by_template: false,
      secret_scan_remediation_action_allowed_by_template: false,
      secret_values_read_by_template: false,
      env_file_read_by_template: false,
      desktop_config_content_inspected_by_template: false,
      desktop_config_read_by_template: false,
      credential_lookup_allowed_by_template: false,
      command_execution_performed_by_template: false,
      artifact_read_performed_by_template: false,
      artifact_write_performed_by_template: false,
      protected_action_executed_by_template: false,
      automatic_order_submission_allowed_by_template: false,
      live_execution_allowed_by_template: false,
      broker_write_allowed_by_template: false,
      exchange_write_allowed_by_template: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Fill this signoff template externally before ${sourceRow.package_script_name} can collect a secret scan remediation receipt.`,
    };
    return withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_chain_signoff_template_hash");
  });
}

function buildTemplateBoundary({ generatedAt, writeRequested, signoffLedger, templateRows }) {
  const sourceSummary = signoffLedger.summary;
  const sourceReady = signoffLedger.validation.valid && sourceSummary.trading_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures_status === SOURCE_READY_STATUS;
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-signoff-template-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_scan_remediation_receipt_chain_signoff_template_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_receipt_chain_signoff_ledger_status: sourceSummary.trading_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures_status,
    source_secret_scan_remediation_receipt_chain_signoff_ledger_ready: sourceReady,
    chain_signoff_template_row_count: templateRows.length,
    ready_chain_signoff_template_row_count: templateRows.filter((row) => row.chain_signoff_template_status === SIGNOFF_TEMPLATE_READY_STATUS).length,
    signoff_ledger_consumed_in_memory: true,
    signoff_ledger_artifact_read_performed: false,
    secret_scan_remediation_receipt_chain_signoff_template_declared: true,
    signoff_template_materialized: false,
    review_completed: false,
    review_approval_applied: false,
    signoff_completed: false,
    signoff_approval_applied: false,
    p429_p438_chain_ready: sourceSummary.p429_p438_chain_ready,
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
    source_receipt_present: sourceSummary.source_receipt_present,
    source_approval_applied: sourceSummary.source_approval_applied,
    real_enablement_count: sourceSummary.real_enablement_count,
    shadow_live_enabled: sourceSummary.shadow_live_enabled,
    limited_live_enabled: sourceSummary.limited_live_enabled,
    full_auto_enabled: sourceSummary.full_auto_enabled,
    automatic_order_submission_allowed: sourceSummary.automatic_order_submission_allowed,
    live_order_submission_allowed: sourceSummary.live_order_submission_allowed,
    secret_scan_remediation_action_allowed: false,
    live_execution_allowed: sourceSummary.live_execution_allowed,
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    desktop_config_read: false,
    credential_lookup_allowed: false,
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
    human_signoff_required: true,
  };
}

function buildTemplateGateRows({ signoffLedger, packageJson, platformOpsLedger, templateRows, templateBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const sourceRowsReady = signoffLedger.secret_scan_remediation_receipt_chain_signoff_ledger_rows.length === 10 && signoffLedger.secret_scan_remediation_receipt_chain_signoff_ledger_rows.every((row) => row.chain_signoff_status === SOURCE_SIGNOFF_READY_STATUS && row.secret_scan_remediation_receipt_chain_signoff_ledger_declared && !row.signoff_completed && !row.signoff_approval_applied);
  const rows = [
    gateRow("p441_signoff_ledger_ready", "P441 secret scan remediation receipt chain signoff ledger source is ready.", signoffLedger.validation.valid && signoffLedger.summary.trading_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P442 trading secret scan remediation receipt chain signoff template fixtures command.", typeof scripts["trading:secret-scan-remediation-receipt-chain-signoff-template-fixtures"] === "string" && scripts["trading:secret-scan-remediation-receipt-chain-signoff-template-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P442 trading secret scan remediation receipt chain signoff template fixtures command.", validateScript.includes("npm run trading:secret-scan-remediation-receipt-chain-signoff-template-fixtures -- --check")),
    gateRow("p442_ledger_acceptance_declared", "P442 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P442: `trading:secret-scan-remediation-receipt-chain-signoff-template-fixtures`")),
    gateRow("p441_signoff_rows_ready", "Every P441 secret scan remediation receipt chain signoff row is ready and still pending.", sourceRowsReady),
    gateRow("chain_signoff_templates_ready", "Every secret scan remediation receipt chain signoff template row is ready while template materialization remains pending.", templateRows.length === 10 && templateRows.every((row) => row.chain_signoff_template_status === SIGNOFF_TEMPLATE_READY_STATUS && row.secret_scan_remediation_receipt_chain_signoff_template_declared && !row.signoff_template_materialized && !row.signoff_completed && !row.signoff_approval_applied && row.human_receipts_pending)),
    gateRow("template_pending_not_materialized", "P442 declares signoff templates without materializing receipts, completing signoff, or applying approvals.", !templateBoundary.signoff_template_materialized && !templateBoundary.signoff_completed && !templateBoundary.signoff_approval_applied && templateBoundary.human_review_required && !templateBoundary.approval_applied),
    gateRow("no_secret_material_read", "P442 reads no secret values, env files, Desktop config content, or credentials.", templateBoundary.no_secret_material_read && !templateBoundary.secret_values_read && !templateBoundary.env_file_read && !templateBoundary.desktop_config_content_inspected && !templateBoundary.desktop_config_read && !templateBoundary.credential_lookup_allowed),
    gateRow("no_receipt_or_trading_mutation", "P442 does not receive, validate, apply, enable, execute, or mutate trading state.", templateBoundary.no_secret_or_trading_mutation && !templateBoundary.actor_workspace_input_present && !templateBoundary.receipt_payload_present && !templateBoundary.ready_for_validation && !templateBoundary.ready_for_approval_application && !templateBoundary.receipt_received && !templateBoundary.receipt_validated && !templateBoundary.receipt_application_performed && !templateBoundary.approval_applied && !templateBoundary.shadow_live_enabled && !templateBoundary.limited_live_enabled && !templateBoundary.full_auto_enabled && !templateBoundary.automatic_order_submission_allowed && !templateBoundary.live_order_submission_allowed && !templateBoundary.secret_scan_remediation_action_allowed && !templateBoundary.live_execution_allowed && !templateBoundary.broker_write_allowed && !templateBoundary.exchange_write_allowed),
    gateRow("no_command_or_artifact_mutation", "P442 signoff template does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !templateBoundary.command_execution_performed && !templateBoundary.package_command_execution_performed && !templateBoundary.release_check_execution_performed && !templateBoundary.artifact_read_performed && !templateBoundary.artifact_write_performed && !templateBoundary.release_published && !templateBoundary.git_operation_performed && !templateBoundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_chain_signoff_template_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-signoff-template-gate-row.v1",
    secret_scan_remediation_receipt_chain_signoff_template_gate_row_id: `trading-secret-scan-remediation-receipt-chain-signoff-template-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    review_completed_by_template: false,
    review_approval_applied_by_template: false,
    signoff_completed_by_template: false,
    signoff_approval_applied_by_template: false,
    signoff_template_materialized_by_template: false,
    actor_workspace_input_present_by_template: false,
    receipt_payload_present_by_template: false,
    ready_for_validation_by_template: false,
    ready_for_approval_application_by_template: false,
    receipt_received_by_template: false,
    receipt_validated_by_template: false,
    receipt_application_performed_by_template: false,
    approval_applied_by_template: false,
    secret_scan_remediation_action_allowed_by_template: false,
    secret_values_read_by_template: false,
    env_file_read_by_template: false,
    desktop_config_content_inspected_by_template: false,
    desktop_config_read_by_template: false,
    credential_lookup_allowed_by_template: false,
    command_execution_performed_by_template: false,
    artifact_read_performed_by_template: false,
    artifact_write_performed_by_template: false,
    protected_action_executed_by_template: false,
    automatic_order_submission_allowed_by_template: false,
    live_execution_allowed_by_template: false,
    broker_write_allowed_by_template: false,
    exchange_write_allowed_by_template: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ signoffLedger, packageJson, platformOpsLedger, templateRows, templateGateRows, templateBoundary }) {
  return [
    validationItem("source.secret_scan_remediation_receipt_chain_signoff_ledger", "p441_signoff_ledger_ready", signoffLedger.validation.valid && signoffLedger.summary.trading_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures_status === SOURCE_READY_STATUS, "P441 secret scan remediation receipt chain signoff ledger fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P442 secret scan remediation receipt chain signoff template fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("secret_scan_remediation_receipt_chain_signoff_template_rows", "chain_signoff_templates_ready", templateRows.length === 10 && templateRows.every((row) => row.chain_signoff_template_status === SIGNOFF_TEMPLATE_READY_STATUS && row.secret_scan_remediation_receipt_chain_signoff_ledger_declared && row.secret_scan_remediation_receipt_chain_signoff_template_declared && !row.signoff_template_materialized && !row.signoff_completed && !row.signoff_approval_applied && !row.receipt_payload_present && !row.approval_applied_by_template && !row.secret_values_read_by_template && !row.credential_lookup_allowed_by_template && row.p429_p438_chain_ready && row.human_receipts_pending && row.no_secret_material_read && row.no_secret_or_trading_mutation), "P429-P438 secret scan remediation receipt chain signoff templates must be ready and pending materialization."),
    validationItem("secret_scan_remediation_receipt_chain_signoff_template_gate_rows", "chain_signoff_template_gates_ready", templateGateRows.length === 10 && templateGateRows.every((row) => row.gate_status === "ready" && !row.signoff_template_materialized_by_template && !row.signoff_completed_by_template && !row.approval_applied_by_template && !row.protected_action_executed_by_template), "P442 secret scan remediation receipt chain signoff template gates are ready."),
    validationItem("boundary.template_pending", "template_pending_not_materialized", templateBoundary.read_only && templateBoundary.report_only && templateBoundary.signoff_ledger_consumed_in_memory && !templateBoundary.signoff_ledger_artifact_read_performed && templateBoundary.secret_scan_remediation_receipt_chain_signoff_template_declared && !templateBoundary.signoff_template_materialized && !templateBoundary.review_completed && !templateBoundary.review_approval_applied && !templateBoundary.signoff_completed && !templateBoundary.signoff_approval_applied && templateBoundary.p429_p438_chain_ready && templateBoundary.human_receipts_pending && templateBoundary.human_review_required, "Secret scan remediation receipt chain signoff templates remain pending and unmaterialized."),
    validationItem("boundary.no_secret_material_read", "no_secret_material_read", templateBoundary.no_secret_material_read && !templateBoundary.secret_values_read && !templateBoundary.env_file_read && !templateBoundary.desktop_config_content_inspected && !templateBoundary.desktop_config_read && !templateBoundary.credential_lookup_allowed, "P442 reads no secret material or credentials."),
    validationItem("boundary.no_receipt_or_trading_mutation", "no_receipt_or_trading_mutation", templateBoundary.no_secret_or_trading_mutation && !templateBoundary.actor_workspace_input_present && !templateBoundary.receipt_input_file_materialized && !templateBoundary.merged_receipt_input_materialized && !templateBoundary.receipt_payload_present && !templateBoundary.ready_for_validation && !templateBoundary.ready_for_approval_application && !templateBoundary.receipt_received && !templateBoundary.receipt_validated && !templateBoundary.receipt_application_performed && !templateBoundary.approval_applied && !templateBoundary.shadow_live_enabled && !templateBoundary.limited_live_enabled && !templateBoundary.full_auto_enabled && !templateBoundary.automatic_order_submission_allowed && !templateBoundary.live_order_submission_allowed && !templateBoundary.secret_scan_remediation_action_allowed && !templateBoundary.live_execution_allowed && !templateBoundary.broker_write_allowed && !templateBoundary.exchange_write_allowed, "P442 does not receive/apply receipts or enable trading mutation."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !templateBoundary.command_execution_performed && !templateBoundary.package_command_execution_performed && !templateBoundary.release_check_execution_performed && !templateBoundary.artifact_read_performed && !templateBoundary.artifact_write_performed && !templateBoundary.release_published && !templateBoundary.git_operation_performed && !templateBoundary.protected_action_executed, "P442 does not execute commands or read/write artifacts."),
    validationItem("boundary.no_source_receipt_or_approval", "no_source_receipt_or_approval", !templateBoundary.source_receipt_present && !templateBoundary.source_approval_applied, "P442 must not inherit pre-applied secret scan remediation receipts or approvals."),
  ];
}

function buildSummary({ signoffLedger, templateRows, templateGateRows, templateBoundary, validation }) {
  return {
    trading_secret_scan_remediation_receipt_chain_signoff_template_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_signoff_ledger_status: signoffLedger.summary.trading_secret_scan_remediation_receipt_chain_signoff_ledger_fixtures_status,
    source_secret_scan_remediation_receipt_chain_signoff_ledger_ready: templateBoundary.source_secret_scan_remediation_receipt_chain_signoff_ledger_ready,
    chain_signoff_template_row_count: templateRows.length,
    ready_chain_signoff_template_row_count: templateBoundary.ready_chain_signoff_template_row_count,
    chain_signoff_template_gate_count: templateGateRows.length,
    ready_chain_signoff_template_gate_count: templateGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: templateBoundary.read_only,
    report_only: templateBoundary.report_only,
    signoff_ledger_consumed_in_memory: templateBoundary.signoff_ledger_consumed_in_memory,
    signoff_ledger_artifact_read_performed: templateBoundary.signoff_ledger_artifact_read_performed,
    secret_scan_remediation_receipt_chain_signoff_template_declared: templateBoundary.secret_scan_remediation_receipt_chain_signoff_template_declared,
    signoff_template_materialized: templateBoundary.signoff_template_materialized,
    review_completed: templateBoundary.review_completed,
    review_approval_applied: templateBoundary.review_approval_applied,
    signoff_completed: templateBoundary.signoff_completed,
    signoff_approval_applied: templateBoundary.signoff_approval_applied,
    p429_p438_chain_ready: templateBoundary.p429_p438_chain_ready,
    human_receipts_pending: templateBoundary.human_receipts_pending,
    no_secret_material_read: templateBoundary.no_secret_material_read,
    no_secret_or_trading_mutation: templateBoundary.no_secret_or_trading_mutation,
    actor_workspace_input_present: templateBoundary.actor_workspace_input_present,
    receipt_input_file_materialized: templateBoundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: templateBoundary.merged_receipt_input_materialized,
    receipt_payload_present: templateBoundary.receipt_payload_present,
    ready_for_validation: templateBoundary.ready_for_validation,
    ready_for_approval_application: templateBoundary.ready_for_approval_application,
    receipt_received: templateBoundary.receipt_received,
    receipt_validated: templateBoundary.receipt_validated,
    receipt_application_performed: templateBoundary.receipt_application_performed,
    approval_applied: templateBoundary.approval_applied,
    source_receipt_present: templateBoundary.source_receipt_present,
    source_approval_applied: templateBoundary.source_approval_applied,
    real_enablement_count: templateBoundary.real_enablement_count,
    shadow_live_enabled: templateBoundary.shadow_live_enabled,
    limited_live_enabled: templateBoundary.limited_live_enabled,
    full_auto_enabled: templateBoundary.full_auto_enabled,
    automatic_order_submission_allowed: templateBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: templateBoundary.live_order_submission_allowed,
    secret_scan_remediation_action_allowed: templateBoundary.secret_scan_remediation_action_allowed,
    live_execution_allowed: templateBoundary.live_execution_allowed,
    secret_values_read: templateBoundary.secret_values_read,
    env_file_read: templateBoundary.env_file_read,
    desktop_config_content_inspected: templateBoundary.desktop_config_content_inspected,
    desktop_config_read: templateBoundary.desktop_config_read,
    credential_lookup_allowed: templateBoundary.credential_lookup_allowed,
    broker_write_allowed: templateBoundary.broker_write_allowed,
    exchange_write_allowed: templateBoundary.exchange_write_allowed,
    command_execution_performed: templateBoundary.command_execution_performed,
    package_command_execution_performed: templateBoundary.package_command_execution_performed,
    release_check_execution_performed: templateBoundary.release_check_execution_performed,
    artifact_read_performed: templateBoundary.artifact_read_performed,
    artifact_write_performed: templateBoundary.artifact_write_performed,
    release_published: templateBoundary.release_published,
    git_operation_performed: templateBoundary.git_operation_performed,
    protected_action_executed: templateBoundary.protected_action_executed,
    human_review_required: templateBoundary.human_review_required,
    human_signoff_required: templateBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Secret Scan Remediation Receipt Chain Signoff Template Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_signoff_template_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source signoff ledger: ${result.summary.source_secret_scan_remediation_receipt_chain_signoff_ledger_status}`,
    `Signoff templates: ${result.summary.ready_chain_signoff_template_row_count}/${result.summary.chain_signoff_template_row_count}`,
    `Template gates: ${result.summary.ready_chain_signoff_template_gate_count}/${result.summary.chain_signoff_template_gate_count}`,
    "",
    "## Signoff Templates",
    "",
    ...result.secret_scan_remediation_receipt_chain_signoff_template_rows.map((row) => `- ${row.source_phase_slot} ${row.package_script_name}: ${row.chain_signoff_template_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_scan_remediation_receipt_chain_signoff_template_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-workspace-schema") parsed.secretScanRemediationReceiptWorkspaceSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-workspace-merge-schema") parsed.secretScanRemediationReceiptWorkspaceMergeSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-merge-preflight-schema") parsed.secretScanRemediationReceiptMergePreflightSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-validation-packet-schema") parsed.secretScanRemediationReceiptValidationPacketSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-approval-plan-schema") parsed.secretScanRemediationReceiptApprovalPlanSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-approval-closeout-schema") parsed.secretScanRemediationReceiptApprovalCloseoutSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-closeout-schema") parsed.secretScanRemediationReceiptCloseoutSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-regression-schema") parsed.secretScanRemediationReceiptChainRegressionSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-review-schema") parsed.secretScanRemediationReceiptChainReviewSchemaPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-signoff-ledger-schema") parsed.secretScanRemediationReceiptChainSignoffLedgerSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-chain-signoff-template-fixtures.mjs [options]

Options:
  --out-dir <folder>                         Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_OUT_DIR}
  --run-at <iso>                             Deterministic generated_at timestamp.
  --package <path>                           package.json path.
  --platform-ops-ledger <path>               P341-P500 platform operations ledger path.
  --secret-scan-remediation-receipt-workspace-schema <path>
                                             P432 secret scan remediation receipt workspace fixtures schema path.
  --secret-scan-remediation-receipt-workspace-merge-schema <path>
                                             P433 secret scan remediation receipt workspace merge fixtures schema path.
  --secret-scan-remediation-receipt-merge-preflight-schema <path>
                                             P434 secret scan remediation receipt merge preflight fixtures schema path.
  --secret-scan-remediation-receipt-validation-packet-schema <path>
                                             P435 secret scan remediation receipt validation packet fixtures schema path.
  --secret-scan-remediation-receipt-approval-plan-schema <path>
                                             P436 secret scan remediation receipt approval plan fixtures schema path.
  --secret-scan-remediation-receipt-approval-closeout-schema <path>
                                             P437 secret scan remediation receipt approval closeout fixtures schema path.
  --secret-scan-remediation-receipt-closeout-schema <path>
                                             P438 secret scan remediation receipt closeout fixtures schema path.
  --secret-scan-remediation-receipt-chain-regression-schema <path>
                                             P439 secret scan remediation receipt chain regression fixtures schema path.
  --secret-scan-remediation-receipt-chain-review-schema <path>
                                             P440 secret scan remediation receipt chain review fixtures schema path.
  --secret-scan-remediation-receipt-chain-signoff-ledger-schema <path>
                                             P441 secret scan remediation receipt chain signoff ledger fixtures schema path.
  --schema <path>                            Output schema path.
  --check                                    Validate only, do not write artifacts.
  -h, --help                                 Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_INPUTS.platformOpsLedgerPath),
    secret_scan_remediation_receipt_workspace_schema_path: path.resolve(options.secretScanRemediationReceiptWorkspaceSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_INPUTS.secretScanRemediationReceiptWorkspaceSchemaPath),
    secret_scan_remediation_receipt_workspace_merge_schema_path: path.resolve(options.secretScanRemediationReceiptWorkspaceMergeSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_INPUTS.secretScanRemediationReceiptWorkspaceMergeSchemaPath),
    secret_scan_remediation_receipt_merge_preflight_schema_path: path.resolve(options.secretScanRemediationReceiptMergePreflightSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_INPUTS.secretScanRemediationReceiptMergePreflightSchemaPath),
    secret_scan_remediation_receipt_validation_packet_schema_path: path.resolve(options.secretScanRemediationReceiptValidationPacketSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_INPUTS.secretScanRemediationReceiptValidationPacketSchemaPath),
    secret_scan_remediation_receipt_approval_plan_schema_path: path.resolve(options.secretScanRemediationReceiptApprovalPlanSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_INPUTS.secretScanRemediationReceiptApprovalPlanSchemaPath),
    secret_scan_remediation_receipt_approval_closeout_schema_path: path.resolve(options.secretScanRemediationReceiptApprovalCloseoutSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_INPUTS.secretScanRemediationReceiptApprovalCloseoutSchemaPath),
    secret_scan_remediation_receipt_closeout_schema_path: path.resolve(options.secretScanRemediationReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_INPUTS.secretScanRemediationReceiptCloseoutSchemaPath),
    secret_scan_remediation_receipt_chain_regression_schema_path: path.resolve(options.secretScanRemediationReceiptChainRegressionSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_INPUTS.secretScanRemediationReceiptChainRegressionSchemaPath),
    secret_scan_remediation_receipt_chain_review_schema_path: path.resolve(options.secretScanRemediationReceiptChainReviewSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_INPUTS.secretScanRemediationReceiptChainReviewSchemaPath),
    secret_scan_remediation_receipt_chain_signoff_ledger_schema_path: path.resolve(options.secretScanRemediationReceiptChainSignoffLedgerSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_INPUTS.secretScanRemediationReceiptChainSignoffLedgerSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_INPUTS.schemaPath),
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
