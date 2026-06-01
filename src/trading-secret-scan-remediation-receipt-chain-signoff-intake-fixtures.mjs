import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationReceiptChainSignoffTemplateFixtures,
} from "./trading-secret-scan-remediation-receipt-chain-signoff-template-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_INTAKE_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-chain-signoff-intake-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_INTAKE_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_INPUTS,
  secretScanRemediationReceiptChainSignoffTemplateSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_TEMPLATE_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-chain-signoff-intake-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-chain-signoff-intake-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_chain_signoff_intake_fixtures";
const PHASE_SLOT = "P443";
const PREVIOUS_PHASE_SLOT = "P442";
const NEXT_PHASE_SLOT = "P444";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_signoff_intake";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_signoff_template";
const SOURCE_TEMPLATE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_signoff_template";
const SIGNOFF_INTAKE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_signoff_intake";
const SIGNOFF_INTAKE_CHECKS = [
  "p442_signoff_template_ready",
  "signoff_template_row_declared",
  "signoff_template_not_materialized",
  "signoff_intake_queued",
  "signoff_receipt_not_received",
  "receipt_payload_absent",
  "approval_application_absent",
  "secret_material_boundary_stays_false",
  "trading_mutation_disabled",
];

export async function runTradingSecretScanRemediationReceiptChainSignoffIntakeFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptChainSignoffIntakeFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptChainSignoffIntakeFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt chain signoff intake fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptChainSignoffIntakeFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_INTAKE_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const signoffTemplate = await buildTradingSecretScanRemediationReceiptChainSignoffTemplateFixtures({
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
    secretScanRemediationReceiptChainSignoffTemplateSchemaPath: inputs.secret_scan_remediation_receipt_chain_signoff_template_schema_path,
    schemaPath: inputs.secret_scan_remediation_receipt_chain_signoff_template_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const intakeAnchor = buildIntakeAnchor(signoffTemplate);
  const intakeRows = buildIntakeRows(signoffTemplate);
  const intakeBoundary = buildIntakeBoundary({ generatedAt, writeRequested: options.write !== false, signoffTemplate, intakeRows });
  const intakeGateRows = buildIntakeGateRows({ signoffTemplate, packageJson, platformOpsLedger, intakeRows, intakeBoundary });
  const validationItems = buildValidationItems({ signoffTemplate, packageJson, platformOpsLedger, intakeRows, intakeGateRows, intakeBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ signoffTemplate, intakeRows, intakeGateRows, intakeBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_scan_remediation_receipt_chain_signoff_intake_fixtures_id: `trading-secret-scan-remediation-receipt-chain-signoff-intake-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_scan_remediation_receipt_chain_signoff_intake_anchor: intakeAnchor,
    secret_scan_remediation_receipt_chain_signoff_intake_rows: intakeRows,
    secret_scan_remediation_receipt_chain_signoff_intake_gate_rows: intakeGateRows,
    secret_scan_remediation_receipt_chain_signoff_intake_boundary: intakeBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_chain_signoff_intake_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ signoffTemplate, intakeRows, intakeGateRows, intakeBoundary, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_chain_signoff_intake_fixtures_id = result.trading_secret_scan_remediation_receipt_chain_signoff_intake_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptChainSignoffIntakeFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-chain-signoff-intake-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-signoff-intake-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-signoff-intake-rows.v1", "secret_scan_remediation_receipt_chain_signoff_intake_rows", result.secret_scan_remediation_receipt_chain_signoff_intake_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-signoff-intake-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-signoff-intake-gate-rows.v1", "secret_scan_remediation_receipt_chain_signoff_intake_gate_rows", result.secret_scan_remediation_receipt_chain_signoff_intake_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-signoff-intake-boundary.json"), result.secret_scan_remediation_receipt_chain_signoff_intake_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-remediation-receipt-chain-signoff-intake-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptChainSignoffIntakeFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptChainSignoffIntakeFixtures(args);
    console.log(`Trading secret scan remediation receipt chain signoff intake fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_signoff_intake_fixtures_status}`);
    console.log(`Signoff intakes: ${result.summary.ready_chain_signoff_intake_row_count}/${result.summary.chain_signoff_intake_row_count}`);
    console.log(`Intake gates: ${result.summary.ready_chain_signoff_intake_gate_count}/${result.summary.chain_signoff_intake_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildIntakeAnchor(signoffTemplate) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-signoff-intake-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_signoff_template_fixtures_id: signoffTemplate.trading_secret_scan_remediation_receipt_chain_signoff_template_fixtures_id,
    source_secret_scan_remediation_receipt_chain_signoff_template_status: signoffTemplate.summary.trading_secret_scan_remediation_receipt_chain_signoff_template_fixtures_status,
    source_hash: hashValue({
      id: signoffTemplate.trading_secret_scan_remediation_receipt_chain_signoff_template_fixtures_id,
      status: signoffTemplate.summary.trading_secret_scan_remediation_receipt_chain_signoff_template_fixtures_status,
      chain_signoff_templates: signoffTemplate.summary.chain_signoff_template_row_count,
      chain_signoff_template_gates: signoffTemplate.summary.chain_signoff_template_gate_count,
    }),
  };
}

function buildIntakeRows(signoffTemplate) {
  const sourceReady = signoffTemplate.validation.valid && signoffTemplate.summary.trading_secret_scan_remediation_receipt_chain_signoff_template_fixtures_status === SOURCE_READY_STATUS;
  return signoffTemplate.secret_scan_remediation_receipt_chain_signoff_template_rows.map((sourceRow, index) => {
    const intakeReady = sourceReady && sourceRow.chain_signoff_template_status === SOURCE_TEMPLATE_READY_STATUS;
    const row = {
      schema_version: "trading-secret-scan-remediation-receipt-chain-signoff-intake-row.v1",
      secret_scan_remediation_receipt_chain_signoff_intake_row_id: `trading-secret-scan-remediation-receipt-chain-signoff-intake.row.${sourceRow.source_phase_slot.toLowerCase()}`,
      phase_slot: PHASE_SLOT,
      source_chain_signoff_template_row_id: sourceRow.secret_scan_remediation_receipt_chain_signoff_template_row_id,
      source_chain_signoff_ledger_row_id: sourceRow.source_chain_signoff_ledger_row_id,
      source_chain_review_row_id: sourceRow.source_chain_review_row_id,
      source_phase_slot: sourceRow.source_phase_slot,
      package_script_name: sourceRow.package_script_name,
      workflow_id: sourceRow.workflow_id,
      chain_signoff_intake_status: intakeReady ? SIGNOFF_INTAKE_READY_STATUS : "blocked",
      source_chain_signoff_template_status: sourceRow.chain_signoff_template_status,
      source_chain_signoff_status: sourceRow.source_chain_signoff_status,
      source_chain_review_status: sourceRow.source_chain_review_status,
      source_secret_scan_remediation_receipt_chain_signoff_template_status: signoffTemplate.summary.trading_secret_scan_remediation_receipt_chain_signoff_template_fixtures_status,
      source_secret_scan_remediation_receipt_chain_signoff_ledger_status: sourceRow.source_secret_scan_remediation_receipt_chain_signoff_ledger_status,
      source_secret_scan_remediation_receipt_chain_review_status: sourceRow.source_secret_scan_remediation_receipt_chain_review_status,
      reviewer_role: sourceRow.reviewer_role,
      required_signoff_role: sourceRow.required_signoff_role,
      required_signoff_decision: sourceRow.required_signoff_decision,
      required_template_fields: sourceRow.required_template_fields,
      allowed_signoff_decisions: sourceRow.allowed_signoff_decisions,
      secret_scan_remediation_receipt_chain_review_declared: sourceRow.secret_scan_remediation_receipt_chain_review_declared,
      secret_scan_remediation_receipt_chain_signoff_ledger_declared: sourceRow.secret_scan_remediation_receipt_chain_signoff_ledger_declared,
      secret_scan_remediation_receipt_chain_signoff_template_declared: sourceRow.secret_scan_remediation_receipt_chain_signoff_template_declared,
      secret_scan_remediation_receipt_chain_signoff_intake_queued: true,
      signoff_template_materialized: sourceRow.signoff_template_materialized,
      signoff_receipt_received: false,
      review_completed: sourceRow.review_completed,
      review_approval_applied: sourceRow.review_approval_applied,
      signoff_completed: false,
      signoff_approval_applied: false,
      p429_p438_chain_ready: sourceRow.p429_p438_chain_ready,
      human_receipts_pending: sourceRow.human_receipts_pending,
      no_secret_material_read: sourceRow.no_secret_material_read,
      no_secret_or_trading_mutation: sourceRow.no_secret_or_trading_mutation,
      ready_for_human_input: intakeReady,
      chain_signoff_intake_checks: SIGNOFF_INTAKE_CHECKS,
      actor_workspace_input_present: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      ready_for_validation: false,
      ready_for_approval_application: false,
      receipt_received_by_intake: false,
      receipt_validated_by_intake: false,
      receipt_application_performed_by_intake: false,
      approval_applied_by_intake: false,
      secret_scan_remediation_action_allowed_by_intake: false,
      secret_values_read_by_intake: false,
      env_file_read_by_intake: false,
      desktop_config_content_inspected_by_intake: false,
      desktop_config_read_by_intake: false,
      credential_lookup_allowed_by_intake: false,
      command_execution_performed_by_intake: false,
      artifact_read_performed_by_intake: false,
      artifact_write_performed_by_intake: false,
      protected_action_executed_by_intake: false,
      automatic_order_submission_allowed_by_intake: false,
      live_execution_allowed_by_intake: false,
      broker_write_allowed_by_intake: false,
      exchange_write_allowed_by_intake: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Await external signoff input for ${sourceRow.package_script_name}; this intake row does not receive, validate, or apply it.`,
    };
    return withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_chain_signoff_intake_hash");
  });
}

function buildIntakeBoundary({ generatedAt, writeRequested, signoffTemplate, intakeRows }) {
  const sourceSummary = signoffTemplate.summary;
  const sourceReady = signoffTemplate.validation.valid && sourceSummary.trading_secret_scan_remediation_receipt_chain_signoff_template_fixtures_status === SOURCE_READY_STATUS;
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-signoff-intake-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_scan_remediation_receipt_chain_signoff_intake_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_receipt_chain_signoff_template_status: sourceSummary.trading_secret_scan_remediation_receipt_chain_signoff_template_fixtures_status,
    source_secret_scan_remediation_receipt_chain_signoff_template_ready: sourceReady,
    chain_signoff_intake_row_count: intakeRows.length,
    ready_chain_signoff_intake_row_count: intakeRows.filter((row) => row.chain_signoff_intake_status === SIGNOFF_INTAKE_READY_STATUS).length,
    signoff_template_consumed_in_memory: true,
    signoff_template_artifact_read_performed: false,
    secret_scan_remediation_receipt_chain_signoff_intake_queued: true,
    signoff_template_materialized: false,
    signoff_receipt_received: false,
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

function buildIntakeGateRows({ signoffTemplate, packageJson, platformOpsLedger, intakeRows, intakeBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const sourceRowsReady = signoffTemplate.secret_scan_remediation_receipt_chain_signoff_template_rows.length === 10 && signoffTemplate.secret_scan_remediation_receipt_chain_signoff_template_rows.every((row) => row.chain_signoff_template_status === SOURCE_TEMPLATE_READY_STATUS && row.secret_scan_remediation_receipt_chain_signoff_template_declared && !row.signoff_template_materialized && !row.signoff_completed && !row.signoff_approval_applied);
  const rows = [
    gateRow("p442_signoff_template_ready", "P442 secret scan remediation receipt chain signoff template source is ready.", signoffTemplate.validation.valid && signoffTemplate.summary.trading_secret_scan_remediation_receipt_chain_signoff_template_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P443 trading secret scan remediation receipt chain signoff intake fixtures command.", typeof scripts["trading:secret-scan-remediation-receipt-chain-signoff-intake-fixtures"] === "string" && scripts["trading:secret-scan-remediation-receipt-chain-signoff-intake-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P443 trading secret scan remediation receipt chain signoff intake fixtures command.", validateScript.includes("npm run trading:secret-scan-remediation-receipt-chain-signoff-intake-fixtures -- --check")),
    gateRow("p443_ledger_acceptance_declared", "P443 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P443: `trading:secret-scan-remediation-receipt-chain-signoff-intake-fixtures`")),
    gateRow("p442_template_rows_ready", "Every P442 secret scan remediation receipt chain signoff template row is ready and still unmaterialized.", sourceRowsReady),
    gateRow("chain_signoff_intakes_ready", "Every secret scan remediation receipt chain signoff intake row is awaiting external human input while no receipt is received.", intakeRows.length === 10 && intakeRows.every((row) => row.chain_signoff_intake_status === SIGNOFF_INTAKE_READY_STATUS && row.secret_scan_remediation_receipt_chain_signoff_intake_queued && row.ready_for_human_input && !row.signoff_receipt_received && !row.signoff_completed && !row.signoff_approval_applied && row.human_receipts_pending)),
    gateRow("intake_pending_no_receipt_received", "P443 queues signoff intake rows without receiving receipts, completing signoff, or applying approvals.", !intakeBoundary.signoff_receipt_received && !intakeBoundary.receipt_received && !intakeBoundary.signoff_completed && !intakeBoundary.signoff_approval_applied && intakeBoundary.human_review_required && !intakeBoundary.approval_applied),
    gateRow("no_secret_material_read", "P443 reads no secret values, env files, Desktop config content, or credentials.", intakeBoundary.no_secret_material_read && !intakeBoundary.secret_values_read && !intakeBoundary.env_file_read && !intakeBoundary.desktop_config_content_inspected && !intakeBoundary.desktop_config_read && !intakeBoundary.credential_lookup_allowed),
    gateRow("no_receipt_or_trading_mutation", "P443 does not receive, validate, apply, enable, execute, or mutate trading state.", intakeBoundary.no_secret_or_trading_mutation && !intakeBoundary.actor_workspace_input_present && !intakeBoundary.receipt_payload_present && !intakeBoundary.ready_for_validation && !intakeBoundary.ready_for_approval_application && !intakeBoundary.receipt_received && !intakeBoundary.receipt_validated && !intakeBoundary.receipt_application_performed && !intakeBoundary.approval_applied && !intakeBoundary.shadow_live_enabled && !intakeBoundary.limited_live_enabled && !intakeBoundary.full_auto_enabled && !intakeBoundary.automatic_order_submission_allowed && !intakeBoundary.live_order_submission_allowed && !intakeBoundary.secret_scan_remediation_action_allowed && !intakeBoundary.live_execution_allowed && !intakeBoundary.broker_write_allowed && !intakeBoundary.exchange_write_allowed),
    gateRow("no_command_or_artifact_mutation", "P443 signoff intake does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !intakeBoundary.command_execution_performed && !intakeBoundary.package_command_execution_performed && !intakeBoundary.release_check_execution_performed && !intakeBoundary.artifact_read_performed && !intakeBoundary.artifact_write_performed && !intakeBoundary.release_published && !intakeBoundary.git_operation_performed && !intakeBoundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_chain_signoff_intake_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-signoff-intake-gate-row.v1",
    secret_scan_remediation_receipt_chain_signoff_intake_gate_row_id: `trading-secret-scan-remediation-receipt-chain-signoff-intake-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    review_completed_by_intake: false,
    review_approval_applied_by_intake: false,
    signoff_completed_by_intake: false,
    signoff_approval_applied_by_intake: false,
    signoff_receipt_received_by_intake: false,
    actor_workspace_input_present_by_intake: false,
    receipt_payload_present_by_intake: false,
    ready_for_validation_by_intake: false,
    ready_for_approval_application_by_intake: false,
    receipt_received_by_intake: false,
    receipt_validated_by_intake: false,
    receipt_application_performed_by_intake: false,
    approval_applied_by_intake: false,
    secret_scan_remediation_action_allowed_by_intake: false,
    secret_values_read_by_intake: false,
    env_file_read_by_intake: false,
    desktop_config_content_inspected_by_intake: false,
    desktop_config_read_by_intake: false,
    credential_lookup_allowed_by_intake: false,
    command_execution_performed_by_intake: false,
    artifact_read_performed_by_intake: false,
    artifact_write_performed_by_intake: false,
    protected_action_executed_by_intake: false,
    automatic_order_submission_allowed_by_intake: false,
    live_execution_allowed_by_intake: false,
    broker_write_allowed_by_intake: false,
    exchange_write_allowed_by_intake: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ signoffTemplate, packageJson, platformOpsLedger, intakeRows, intakeGateRows, intakeBoundary }) {
  return [
    validationItem("source.secret_scan_remediation_receipt_chain_signoff_template", "p442_signoff_template_ready", signoffTemplate.validation.valid && signoffTemplate.summary.trading_secret_scan_remediation_receipt_chain_signoff_template_fixtures_status === SOURCE_READY_STATUS, "P442 secret scan remediation receipt chain signoff template fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P443 secret scan remediation receipt chain signoff intake fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("secret_scan_remediation_receipt_chain_signoff_intake_rows", "chain_signoff_intakes_ready", intakeRows.length === 10 && intakeRows.every((row) => row.chain_signoff_intake_status === SIGNOFF_INTAKE_READY_STATUS && row.secret_scan_remediation_receipt_chain_signoff_template_declared && row.secret_scan_remediation_receipt_chain_signoff_intake_queued && row.ready_for_human_input && !row.signoff_receipt_received && !row.signoff_completed && !row.signoff_approval_applied && !row.receipt_payload_present && !row.approval_applied_by_intake && !row.secret_values_read_by_intake && !row.credential_lookup_allowed_by_intake && row.p429_p438_chain_ready && row.human_receipts_pending && row.no_secret_material_read && row.no_secret_or_trading_mutation), "P429-P438 secret scan remediation receipt chain signoff intakes must be queued and pending human input."),
    validationItem("secret_scan_remediation_receipt_chain_signoff_intake_gate_rows", "chain_signoff_intake_gates_ready", intakeGateRows.length === 10 && intakeGateRows.every((row) => row.gate_status === "ready" && !row.signoff_receipt_received_by_intake && !row.signoff_completed_by_intake && !row.approval_applied_by_intake && !row.protected_action_executed_by_intake), "P443 secret scan remediation receipt chain signoff intake gates are ready."),
    validationItem("boundary.intake_pending", "intake_pending_no_receipt_received", intakeBoundary.read_only && intakeBoundary.report_only && intakeBoundary.signoff_template_consumed_in_memory && !intakeBoundary.signoff_template_artifact_read_performed && intakeBoundary.secret_scan_remediation_receipt_chain_signoff_intake_queued && !intakeBoundary.signoff_receipt_received && !intakeBoundary.review_completed && !intakeBoundary.review_approval_applied && !intakeBoundary.signoff_completed && !intakeBoundary.signoff_approval_applied && intakeBoundary.p429_p438_chain_ready && intakeBoundary.human_receipts_pending && intakeBoundary.human_review_required, "Secret scan remediation receipt chain signoff intakes remain queued and no receipt is received."),
    validationItem("boundary.no_secret_material_read", "no_secret_material_read", intakeBoundary.no_secret_material_read && !intakeBoundary.secret_values_read && !intakeBoundary.env_file_read && !intakeBoundary.desktop_config_content_inspected && !intakeBoundary.desktop_config_read && !intakeBoundary.credential_lookup_allowed, "P443 reads no secret material or credentials."),
    validationItem("boundary.no_receipt_or_trading_mutation", "no_receipt_or_trading_mutation", intakeBoundary.no_secret_or_trading_mutation && !intakeBoundary.actor_workspace_input_present && !intakeBoundary.receipt_input_file_materialized && !intakeBoundary.merged_receipt_input_materialized && !intakeBoundary.receipt_payload_present && !intakeBoundary.ready_for_validation && !intakeBoundary.ready_for_approval_application && !intakeBoundary.receipt_received && !intakeBoundary.receipt_validated && !intakeBoundary.receipt_application_performed && !intakeBoundary.approval_applied && !intakeBoundary.shadow_live_enabled && !intakeBoundary.limited_live_enabled && !intakeBoundary.full_auto_enabled && !intakeBoundary.automatic_order_submission_allowed && !intakeBoundary.live_order_submission_allowed && !intakeBoundary.secret_scan_remediation_action_allowed && !intakeBoundary.live_execution_allowed && !intakeBoundary.broker_write_allowed && !intakeBoundary.exchange_write_allowed, "P443 does not receive/apply receipts or enable trading mutation."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !intakeBoundary.command_execution_performed && !intakeBoundary.package_command_execution_performed && !intakeBoundary.release_check_execution_performed && !intakeBoundary.artifact_read_performed && !intakeBoundary.artifact_write_performed && !intakeBoundary.release_published && !intakeBoundary.git_operation_performed && !intakeBoundary.protected_action_executed, "P443 does not execute commands or read/write artifacts."),
    validationItem("boundary.no_source_receipt_or_approval", "no_source_receipt_or_approval", !intakeBoundary.source_receipt_present && !intakeBoundary.source_approval_applied, "P443 must not inherit pre-applied secret scan remediation receipts or approvals."),
  ];
}

function buildSummary({ signoffTemplate, intakeRows, intakeGateRows, intakeBoundary, validation }) {
  return {
    trading_secret_scan_remediation_receipt_chain_signoff_intake_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_signoff_template_status: signoffTemplate.summary.trading_secret_scan_remediation_receipt_chain_signoff_template_fixtures_status,
    source_secret_scan_remediation_receipt_chain_signoff_template_ready: intakeBoundary.source_secret_scan_remediation_receipt_chain_signoff_template_ready,
    chain_signoff_intake_row_count: intakeRows.length,
    ready_chain_signoff_intake_row_count: intakeBoundary.ready_chain_signoff_intake_row_count,
    chain_signoff_intake_gate_count: intakeGateRows.length,
    ready_chain_signoff_intake_gate_count: intakeGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: intakeBoundary.read_only,
    report_only: intakeBoundary.report_only,
    signoff_template_consumed_in_memory: intakeBoundary.signoff_template_consumed_in_memory,
    signoff_template_artifact_read_performed: intakeBoundary.signoff_template_artifact_read_performed,
    secret_scan_remediation_receipt_chain_signoff_intake_queued: intakeBoundary.secret_scan_remediation_receipt_chain_signoff_intake_queued,
    signoff_template_materialized: intakeBoundary.signoff_template_materialized,
    signoff_receipt_received: intakeBoundary.signoff_receipt_received,
    review_completed: intakeBoundary.review_completed,
    review_approval_applied: intakeBoundary.review_approval_applied,
    signoff_completed: intakeBoundary.signoff_completed,
    signoff_approval_applied: intakeBoundary.signoff_approval_applied,
    p429_p438_chain_ready: intakeBoundary.p429_p438_chain_ready,
    human_receipts_pending: intakeBoundary.human_receipts_pending,
    no_secret_material_read: intakeBoundary.no_secret_material_read,
    no_secret_or_trading_mutation: intakeBoundary.no_secret_or_trading_mutation,
    actor_workspace_input_present: intakeBoundary.actor_workspace_input_present,
    receipt_input_file_materialized: intakeBoundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: intakeBoundary.merged_receipt_input_materialized,
    receipt_payload_present: intakeBoundary.receipt_payload_present,
    ready_for_validation: intakeBoundary.ready_for_validation,
    ready_for_approval_application: intakeBoundary.ready_for_approval_application,
    receipt_received: intakeBoundary.receipt_received,
    receipt_validated: intakeBoundary.receipt_validated,
    receipt_application_performed: intakeBoundary.receipt_application_performed,
    approval_applied: intakeBoundary.approval_applied,
    source_receipt_present: intakeBoundary.source_receipt_present,
    source_approval_applied: intakeBoundary.source_approval_applied,
    real_enablement_count: intakeBoundary.real_enablement_count,
    shadow_live_enabled: intakeBoundary.shadow_live_enabled,
    limited_live_enabled: intakeBoundary.limited_live_enabled,
    full_auto_enabled: intakeBoundary.full_auto_enabled,
    automatic_order_submission_allowed: intakeBoundary.automatic_order_submission_allowed,
    live_order_submission_allowed: intakeBoundary.live_order_submission_allowed,
    secret_scan_remediation_action_allowed: intakeBoundary.secret_scan_remediation_action_allowed,
    live_execution_allowed: intakeBoundary.live_execution_allowed,
    secret_values_read: intakeBoundary.secret_values_read,
    env_file_read: intakeBoundary.env_file_read,
    desktop_config_content_inspected: intakeBoundary.desktop_config_content_inspected,
    desktop_config_read: intakeBoundary.desktop_config_read,
    credential_lookup_allowed: intakeBoundary.credential_lookup_allowed,
    broker_write_allowed: intakeBoundary.broker_write_allowed,
    exchange_write_allowed: intakeBoundary.exchange_write_allowed,
    command_execution_performed: intakeBoundary.command_execution_performed,
    package_command_execution_performed: intakeBoundary.package_command_execution_performed,
    release_check_execution_performed: intakeBoundary.release_check_execution_performed,
    artifact_read_performed: intakeBoundary.artifact_read_performed,
    artifact_write_performed: intakeBoundary.artifact_write_performed,
    release_published: intakeBoundary.release_published,
    git_operation_performed: intakeBoundary.git_operation_performed,
    protected_action_executed: intakeBoundary.protected_action_executed,
    human_review_required: intakeBoundary.human_review_required,
    human_signoff_required: intakeBoundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Trading Secret Scan Remediation Receipt Chain Signoff Intake Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_signoff_intake_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source signoff template: ${result.summary.source_secret_scan_remediation_receipt_chain_signoff_template_status}`,
    `Signoff intakes: ${result.summary.ready_chain_signoff_intake_row_count}/${result.summary.chain_signoff_intake_row_count}`,
    `Intake gates: ${result.summary.ready_chain_signoff_intake_gate_count}/${result.summary.chain_signoff_intake_gate_count}`,
    "",
    "## Signoff Intakes",
    "",
    ...result.secret_scan_remediation_receipt_chain_signoff_intake_rows.map((row) => `- ${row.source_phase_slot} ${row.package_script_name}: ${row.chain_signoff_intake_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_scan_remediation_receipt_chain_signoff_intake_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_INTAKE_FIXTURES_OUT_DIR };
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
    else if (arg === "--secret-scan-remediation-receipt-chain-signoff-template-schema") parsed.secretScanRemediationReceiptChainSignoffTemplateSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-chain-signoff-intake-fixtures.mjs [options]

Options:
  --out-dir <folder>                         Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_INTAKE_FIXTURES_OUT_DIR}
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
  --secret-scan-remediation-receipt-chain-signoff-template-schema <path>
                                             P442 secret scan remediation receipt chain signoff template fixtures schema path.
  --schema <path>                            Output schema path.
  --check                                    Validate only, do not write artifacts.
  -h, --help                                 Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_INTAKE_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_INTAKE_FIXTURES_INPUTS.platformOpsLedgerPath),
    secret_scan_remediation_receipt_workspace_schema_path: path.resolve(options.secretScanRemediationReceiptWorkspaceSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_INTAKE_FIXTURES_INPUTS.secretScanRemediationReceiptWorkspaceSchemaPath),
    secret_scan_remediation_receipt_workspace_merge_schema_path: path.resolve(options.secretScanRemediationReceiptWorkspaceMergeSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_INTAKE_FIXTURES_INPUTS.secretScanRemediationReceiptWorkspaceMergeSchemaPath),
    secret_scan_remediation_receipt_merge_preflight_schema_path: path.resolve(options.secretScanRemediationReceiptMergePreflightSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_INTAKE_FIXTURES_INPUTS.secretScanRemediationReceiptMergePreflightSchemaPath),
    secret_scan_remediation_receipt_validation_packet_schema_path: path.resolve(options.secretScanRemediationReceiptValidationPacketSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_INTAKE_FIXTURES_INPUTS.secretScanRemediationReceiptValidationPacketSchemaPath),
    secret_scan_remediation_receipt_approval_plan_schema_path: path.resolve(options.secretScanRemediationReceiptApprovalPlanSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_INTAKE_FIXTURES_INPUTS.secretScanRemediationReceiptApprovalPlanSchemaPath),
    secret_scan_remediation_receipt_approval_closeout_schema_path: path.resolve(options.secretScanRemediationReceiptApprovalCloseoutSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_INTAKE_FIXTURES_INPUTS.secretScanRemediationReceiptApprovalCloseoutSchemaPath),
    secret_scan_remediation_receipt_closeout_schema_path: path.resolve(options.secretScanRemediationReceiptCloseoutSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_INTAKE_FIXTURES_INPUTS.secretScanRemediationReceiptCloseoutSchemaPath),
    secret_scan_remediation_receipt_chain_regression_schema_path: path.resolve(options.secretScanRemediationReceiptChainRegressionSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_INTAKE_FIXTURES_INPUTS.secretScanRemediationReceiptChainRegressionSchemaPath),
    secret_scan_remediation_receipt_chain_review_schema_path: path.resolve(options.secretScanRemediationReceiptChainReviewSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_INTAKE_FIXTURES_INPUTS.secretScanRemediationReceiptChainReviewSchemaPath),
    secret_scan_remediation_receipt_chain_signoff_ledger_schema_path: path.resolve(options.secretScanRemediationReceiptChainSignoffLedgerSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_INTAKE_FIXTURES_INPUTS.secretScanRemediationReceiptChainSignoffLedgerSchemaPath),
    secret_scan_remediation_receipt_chain_signoff_template_schema_path: path.resolve(options.secretScanRemediationReceiptChainSignoffTemplateSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_INTAKE_FIXTURES_INPUTS.secretScanRemediationReceiptChainSignoffTemplateSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_INTAKE_FIXTURES_INPUTS.schemaPath),
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
