import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_APPROVAL_CLOSEOUT_FIXTURES_INPUTS,
  buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffApprovalCloseoutFixtures,
} from "./trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-approval-closeout-fixtures.mjs";

export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_CLOSEOUT_FIXTURES_OUT_DIR = "artifacts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-fixtures/latest";
export const DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_CLOSEOUT_FIXTURES_INPUTS = {
  ...DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_APPROVAL_CLOSEOUT_FIXTURES_INPUTS,
  secretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffApprovalCloseoutSchemaPath: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_APPROVAL_CLOSEOUT_FIXTURES_INPUTS.schemaPath,
  schemaPath: "schemas/trading/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-fixtures.schema.json",
};

const SCHEMA_VERSION = "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-fixtures.v1";
const CAPABILITY_ID = "trading.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_fixtures";
const PHASE_SLOT = "P472";
const PREVIOUS_PHASE_SLOT = "P471";
const NEXT_PHASE_SLOT = "P473";
const READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout";
const SOURCE_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout";
const SOURCE_APPROVAL_CLOSEOUT_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout";
const SIGNOFF_CLOSEOUT_READY_STATUS = "ready_for_trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout";
const SIGNOFF_CLOSEOUT_CHECKS = [
  "p471_signoff_approval_closeout_ready",
  "signoff_approval_closeout_declared",
  "signoff_receipt_not_received",
  "signoff_closeout_declared",
  "validation_not_performed",
  "receipt_payload_absent",
  "approval_application_absent",
  "secret_material_boundary_stays_false",
  "trading_mutation_disabled",
];

export async function runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffCloseoutFixtures(options = {}) {
  const result = await buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffCloseoutFixtures(options);
  if (options.write !== false) await writeTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffCloseoutFixtures(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Trading secret scan remediation receipt chain secret scan remediation receipt chain signoff closeout fixtures failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffCloseoutFixtures(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_CLOSEOUT_FIXTURES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const signoffApprovalCloseout = await buildTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffApprovalCloseoutFixtures({
    ...options,
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    schemaPath: inputs.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const intakeAnchor = buildIntakeAnchor(signoffApprovalCloseout);
  const intakeRows = buildIntakeRows(signoffApprovalCloseout);
  const intakeBoundary = buildIntakeBoundary({ generatedAt, writeRequested: options.write !== false, signoffApprovalCloseout, intakeRows });
  const intakeGateRows = buildIntakeGateRows({ signoffApprovalCloseout, packageJson, platformOpsLedger, intakeRows, intakeBoundary });
  const validationItems = buildValidationItems({ signoffApprovalCloseout, packageJson, platformOpsLedger, intakeRows, intakeGateRows, intakeBoundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ signoffApprovalCloseout, intakeRows, intakeGateRows, intakeBoundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_fixtures_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-fixtures.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_anchor: intakeAnchor,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_rows: intakeRows,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_gate_rows: intakeGateRows,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_boundary: intakeBoundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_fixtures") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ signoffApprovalCloseout, intakeRows, intakeGateRows, intakeBoundary, validation: result.validation });
  result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_fixtures_id = result.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_fixtures_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffCloseoutFixtures(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-fixtures.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-rows.v1", "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_rows", result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-gate-rows.json"), collectionEnvelope("trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-gate-rows.v1", "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_gate_rows", result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-boundary.json"), result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-fixtures-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffCloseoutFixturesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTradingSecretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffCloseoutFixtures(args);
    console.log(`Trading secret scan remediation receipt chain secret scan remediation receipt chain signoff closeout fixtures ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_fixtures_status}`);
    console.log(`Signoff closeout rows: ${result.summary.ready_chain_signoff_closeout_row_count}/${result.summary.chain_signoff_closeout_row_count}`);
    console.log(`Signoff closeout gates: ${result.summary.ready_chain_signoff_closeout_gate_count}/${result.summary.chain_signoff_closeout_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildIntakeAnchor(signoffApprovalCloseout) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-fixtures-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_fixtures_id: signoffApprovalCloseout.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_fixtures_id,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_status: signoffApprovalCloseout.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_fixtures_status,
    source_hash: hashValue({
      id: signoffApprovalCloseout.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_fixtures_id,
      status: signoffApprovalCloseout.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_fixtures_status,
      chain_signoff_approval_closeouts: signoffApprovalCloseout.summary.chain_signoff_approval_closeout_row_count,
      chain_signoff_approval_closeout_gates: signoffApprovalCloseout.summary.chain_signoff_approval_closeout_gate_count,
    }),
  };
}

function buildIntakeRows(signoffApprovalCloseout) {
  const sourceReady = signoffApprovalCloseout.validation.valid && signoffApprovalCloseout.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_fixtures_status === SOURCE_READY_STATUS;
  return signoffApprovalCloseout.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_rows.map((sourceRow, index) => {
    const closeoutReady = sourceReady && sourceRow.chain_signoff_approval_closeout_status === SOURCE_APPROVAL_CLOSEOUT_READY_STATUS;
    const row = {
      schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-row.v1",
      secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout.row.${sourceRow.source_phase_slot.toLowerCase()}`,
      phase_slot: PHASE_SLOT,
      source_chain_signoff_approval_closeout_row_id: sourceRow.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_row_id,
      source_chain_signoff_validation_rules_row_id: sourceRow.source_chain_signoff_validation_rules_row_id,
      source_chain_signoff_intake_row_id: sourceRow.source_chain_signoff_intake_row_id,
      source_chain_signoff_template_row_id: sourceRow.source_chain_signoff_template_row_id,
      source_chain_signoff_ledger_row_id: sourceRow.source_chain_signoff_ledger_row_id,
      source_chain_review_row_id: sourceRow.source_chain_review_row_id,
      source_phase_slot: sourceRow.source_phase_slot,
      package_script_name: sourceRow.package_script_name,
      workflow_id: sourceRow.workflow_id,
      chain_signoff_closeout_status: closeoutReady ? SIGNOFF_CLOSEOUT_READY_STATUS : "blocked",
      source_chain_signoff_approval_closeout_status: sourceRow.chain_signoff_approval_closeout_status,
      source_chain_signoff_validation_rules_status: sourceRow.source_chain_signoff_validation_rules_status,
      source_chain_signoff_intake_status: sourceRow.source_chain_signoff_intake_status,
      source_chain_signoff_template_status: sourceRow.source_chain_signoff_template_status,
      source_chain_signoff_status: sourceRow.source_chain_signoff_status,
      source_chain_review_status: sourceRow.source_chain_review_status,
      source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_status: signoffApprovalCloseout.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_fixtures_status,
      source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_validation_rules_status: sourceRow.source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_validation_rules_status,
      source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_intake_status: sourceRow.source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_intake_status,
      source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_template_status: sourceRow.source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_template_status,
      source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_status: sourceRow.source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_status,
      source_secret_scan_remediation_receipt_chain_review_status: sourceRow.source_secret_scan_remediation_receipt_chain_review_status,
      reviewer_role: sourceRow.reviewer_role,
      required_signoff_role: sourceRow.required_signoff_role,
      required_signoff_decision: sourceRow.required_signoff_decision,
      required_template_fields: sourceRow.required_template_fields,
      allowed_signoff_decisions: sourceRow.allowed_signoff_decisions,
      secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_declared: sourceRow.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_review_declared,
      secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_declared: sourceRow.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_ledger_declared,
      secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_template_declared: sourceRow.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_template_declared,
      secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_intake_queued: sourceRow.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_intake_queued,
      secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_validation_rules_declared: sourceRow.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_validation_rules_declared,
      secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_declared: sourceRow.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_declared,
      secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_declared: true,
      signoff_template_materialized: sourceRow.signoff_template_materialized,
      signoff_receipt_received: false,
      signoff_validation_performed: false,
      approval_closeout_completed: false,
      signoff_closeout_completed: false,
      required_validation_rules: sourceRow.required_validation_rules,
      review_completed: sourceRow.review_completed,
      review_approval_applied: sourceRow.review_approval_applied,
      signoff_completed: false,
      signoff_approval_applied: false,
      p455_p464_chain_ready: sourceRow.p455_p464_chain_ready,
      human_receipts_pending: sourceRow.human_receipts_pending,
      no_secret_material_read: sourceRow.no_secret_material_read,
      no_secret_or_trading_mutation: sourceRow.no_secret_or_trading_mutation,
      ready_for_human_input: sourceRow.ready_for_human_input,
      chain_signoff_closeout_checks: SIGNOFF_CLOSEOUT_CHECKS,
      actor_workspace_input_present: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      ready_for_validation: false,
      ready_for_approval_application: false,
      receipt_received_by_closeout: false,
      receipt_validated_by_closeout: false,
      receipt_application_performed_by_closeout: false,
      approval_applied_by_closeout: false,
      secret_scan_remediation_action_allowed_by_closeout: false,
      secret_values_read_by_closeout: false,
      env_file_read_by_closeout: false,
      desktop_config_content_inspected_by_closeout: false,
      desktop_config_read_by_closeout: false,
      raw_secret_material_materialized_by_closeout: false,
      raw_secret_material_exposed_by_closeout: false,
      desktop_provider_key_visible_by_closeout: false,
      forbidden_receipt_fields_allowed_by_closeout: false,
      auto_fix_command_registered_by_closeout: false,
      auto_redaction_allowed_by_closeout: false,
      auto_deletion_allowed_by_closeout: false,
      auto_rotation_allowed_by_closeout: false,
      credential_lookup_allowed_by_closeout: false,
      command_execution_performed_by_closeout: false,
      artifact_read_performed_by_closeout: false,
      artifact_write_performed_by_closeout: false,
      protected_action_executed_by_closeout: false,
      automatic_order_submission_allowed_by_closeout: false,
      live_execution_allowed_by_closeout: false,
      broker_write_allowed_by_closeout: false,
      exchange_write_allowed_by_closeout: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `Signoff closeout is declared for future signoff receipts for ${sourceRow.package_script_name}; this row does not receive, validate, or apply them.`,
    };
    return withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_hash");
  });
}

function buildIntakeBoundary({ generatedAt, writeRequested, signoffApprovalCloseout, intakeRows }) {
  const sourceSummary = signoffApprovalCloseout.summary;
  const sourceReady = signoffApprovalCloseout.validation.valid && sourceSummary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_fixtures_status === SOURCE_READY_STATUS;
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-fixtures-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_artifact_write_requested: writeRequested,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_status: sourceSummary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_fixtures_status,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_ready: sourceReady,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_validation_rules_status: sourceSummary.source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_validation_rules_status,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_validation_rules_ready: sourceSummary.source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_validation_rules_ready,
    chain_signoff_closeout_row_count: intakeRows.length,
    ready_chain_signoff_closeout_row_count: intakeRows.filter((row) => row.chain_signoff_closeout_status === SIGNOFF_CLOSEOUT_READY_STATUS).length,
    signoff_approval_closeout_consumed_in_memory: true,
    signoff_approval_closeout_artifact_read_performed: false,
    signoff_validation_rules_consumed_in_memory: sourceSummary.signoff_validation_rules_consumed_in_memory,
    signoff_validation_rules_artifact_read_performed: sourceSummary.signoff_validation_rules_artifact_read_performed,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_declared: true,
    signoff_template_materialized: false,
    signoff_receipt_received: false,
    signoff_validation_performed: false,
    approval_closeout_completed: false,
    signoff_closeout_completed: false,
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
    raw_secret_material_materialized: false,
    raw_secret_material_exposed: false,
    desktop_provider_key_visible: false,
    forbidden_receipt_fields_allowed: false,
    auto_fix_command_registered: false,
    auto_redaction_allowed: false,
    auto_deletion_allowed: false,
    auto_rotation_allowed: false,
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

function buildIntakeGateRows({ signoffApprovalCloseout, packageJson, platformOpsLedger, intakeRows, intakeBoundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const sourceRowsReady = signoffApprovalCloseout.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_rows.length === 10 && signoffApprovalCloseout.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_rows.every((row) => row.chain_signoff_approval_closeout_status === SOURCE_APPROVAL_CLOSEOUT_READY_STATUS && row.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_declared && row.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_validation_rules_declared && !row.signoff_validation_performed && !row.signoff_receipt_received && !row.approval_closeout_completed && !row.signoff_completed && !row.signoff_approval_applied && !row.raw_secret_material_materialized_by_approval_closeout && !row.raw_secret_material_exposed_by_approval_closeout && !row.desktop_provider_key_visible_by_approval_closeout && !row.forbidden_receipt_fields_allowed_by_approval_closeout && !row.secret_scan_remediation_action_allowed_by_approval_closeout && !row.auto_fix_command_registered_by_approval_closeout && !row.auto_redaction_allowed_by_approval_closeout && !row.auto_deletion_allowed_by_approval_closeout && !row.auto_rotation_allowed_by_approval_closeout && !row.credential_lookup_allowed_by_approval_closeout && row.no_secret_material_read && row.no_secret_or_trading_mutation);
  const rows = [
    gateRow("p471_signoff_approval_closeout_ready", "P471 secret scan remediation receipt chain secret scan remediation receipt chain signoff approval closeout source is ready.", signoffApprovalCloseout.validation.valid && signoffApprovalCloseout.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_fixtures_status === SOURCE_READY_STATUS),
    gateRow("platform_package_script_registered", "package.json registers the P472 trading secret scan remediation receipt chain secret scan remediation receipt chain signoff closeout fixtures command.", typeof scripts["trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-fixtures"] === "string" && scripts["trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-fixtures"].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P472 trading secret scan remediation receipt chain secret scan remediation receipt chain signoff closeout fixtures command.", validateScript.includes("npm run trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-fixtures -- --check")),
    gateRow("p472_ledger_acceptance_declared", "P472 acceptance row is declared in the platform operations ledger.", ledgerText.includes("P472: `trading:secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-fixtures`")),
    gateRow("p471_approval_closeout_rows_ready", "Every P471 secret scan remediation receipt chain secret scan remediation receipt chain signoff approval closeout row is declared and still has no receipt.", sourceRowsReady),
    gateRow("chain_signoff_closeout_ready", "Every secret scan remediation receipt chain secret scan remediation receipt chain signoff closeout row declares closeout readiness while no receipt is received.", intakeRows.length === 10 && intakeRows.every((row) => row.chain_signoff_closeout_status === SIGNOFF_CLOSEOUT_READY_STATUS && row.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_declared && row.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_declared && !row.signoff_validation_performed && !row.signoff_receipt_received && !row.approval_closeout_completed && !row.signoff_closeout_completed && !row.signoff_completed && !row.signoff_approval_applied && row.human_receipts_pending && row.no_secret_material_read && row.no_secret_or_trading_mutation && row.required_validation_rules.length >= 5)),
    gateRow("closeout_pending_no_receipt_received", "P472 declares signoff closeout without receiving receipts, validating signoffs, completing signoff, or applying approvals.", !intakeBoundary.signoff_receipt_received && !intakeBoundary.signoff_validation_performed && !intakeBoundary.approval_closeout_completed && !intakeBoundary.signoff_closeout_completed && !intakeBoundary.receipt_received && !intakeBoundary.signoff_completed && !intakeBoundary.signoff_approval_applied && intakeBoundary.human_review_required && !intakeBoundary.approval_applied),
    gateRow("no_secret_material_read", "P472 reads no secret values, env files, Desktop config content, raw secret material, provider keys, or credentials.", intakeBoundary.no_secret_material_read && !intakeBoundary.secret_values_read && !intakeBoundary.env_file_read && !intakeBoundary.desktop_config_content_inspected && !intakeBoundary.desktop_config_read && !intakeBoundary.raw_secret_material_materialized && !intakeBoundary.raw_secret_material_exposed && !intakeBoundary.desktop_provider_key_visible && !intakeBoundary.credential_lookup_allowed),
    gateRow("no_receipt_or_trading_mutation", "P472 does not receive, validate, apply, enable, execute, remediate, or mutate trading state.", intakeBoundary.no_secret_or_trading_mutation && !intakeBoundary.actor_workspace_input_present && !intakeBoundary.receipt_payload_present && !intakeBoundary.ready_for_validation && !intakeBoundary.ready_for_approval_application && !intakeBoundary.receipt_received && !intakeBoundary.receipt_validated && !intakeBoundary.receipt_application_performed && !intakeBoundary.approval_applied && !intakeBoundary.forbidden_receipt_fields_allowed && !intakeBoundary.shadow_live_enabled && !intakeBoundary.limited_live_enabled && !intakeBoundary.full_auto_enabled && !intakeBoundary.automatic_order_submission_allowed && !intakeBoundary.live_order_submission_allowed && !intakeBoundary.secret_scan_remediation_action_allowed && !intakeBoundary.auto_fix_command_registered && !intakeBoundary.auto_redaction_allowed && !intakeBoundary.auto_deletion_allowed && !intakeBoundary.auto_rotation_allowed && !intakeBoundary.live_execution_allowed && !intakeBoundary.broker_write_allowed && !intakeBoundary.exchange_write_allowed),
    gateRow("no_command_or_artifact_mutation", "P472 signoff closeout does not execute commands, read/write artifacts, publish releases, run git, or execute protected actions.", !intakeBoundary.command_execution_performed && !intakeBoundary.package_command_execution_performed && !intakeBoundary.release_check_execution_performed && !intakeBoundary.artifact_read_performed && !intakeBoundary.artifact_write_performed && !intakeBoundary.release_published && !intakeBoundary.git_operation_performed && !intakeBoundary.protected_action_executed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-gate-row.v1",
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_gate_row_id: `trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-fixtures.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    review_completed_by_closeout: false,
    review_approval_applied_by_closeout: false,
    signoff_completed_by_closeout: false,
    signoff_approval_applied_by_closeout: false,
    signoff_receipt_received_by_closeout: false,
    signoff_validation_performed_by_closeout: false,
    actor_workspace_input_present_by_closeout: false,
    receipt_payload_present_by_closeout: false,
    ready_for_validation_by_closeout: false,
    ready_for_approval_application_by_closeout: false,
    receipt_received_by_closeout: false,
    receipt_validated_by_closeout: false,
    receipt_application_performed_by_closeout: false,
    approval_applied_by_closeout: false,
    secret_scan_remediation_action_allowed_by_closeout: false,
    secret_values_read_by_closeout: false,
    env_file_read_by_closeout: false,
    desktop_config_content_inspected_by_closeout: false,
    desktop_config_read_by_closeout: false,
    raw_secret_material_materialized_by_closeout: false,
    raw_secret_material_exposed_by_closeout: false,
    desktop_provider_key_visible_by_closeout: false,
    forbidden_receipt_fields_allowed_by_closeout: false,
    auto_fix_command_registered_by_closeout: false,
    auto_redaction_allowed_by_closeout: false,
    auto_deletion_allowed_by_closeout: false,
    auto_rotation_allowed_by_closeout: false,
    credential_lookup_allowed_by_closeout: false,
    command_execution_performed_by_closeout: false,
    artifact_read_performed_by_closeout: false,
    artifact_write_performed_by_closeout: false,
    protected_action_executed_by_closeout: false,
    automatic_order_submission_allowed_by_closeout: false,
    live_execution_allowed_by_closeout: false,
    broker_write_allowed_by_closeout: false,
    exchange_write_allowed_by_closeout: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ signoffApprovalCloseout, packageJson, platformOpsLedger, intakeRows, intakeGateRows, intakeBoundary }) {
  return [
    validationItem("source.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout", "p471_signoff_approval_closeout_ready", signoffApprovalCloseout.validation.valid && signoffApprovalCloseout.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_fixtures_status === SOURCE_READY_STATUS, "P471 secret scan remediation receipt chain secret scan remediation receipt chain signoff approval closeout fixtures must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P472 secret scan remediation receipt chain secret scan remediation receipt chain signoff closeout fixtures."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_rows", "chain_signoff_closeout_ready", intakeRows.length === 10 && intakeRows.every((row) => row.chain_signoff_closeout_status === SIGNOFF_CLOSEOUT_READY_STATUS && row.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_template_declared && row.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_intake_queued && row.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_validation_rules_declared && row.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_declared && row.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_declared && !row.signoff_validation_performed && !row.signoff_receipt_received && !row.approval_closeout_completed && !row.signoff_closeout_completed && !row.signoff_completed && !row.signoff_approval_applied && !row.receipt_payload_present && !row.approval_applied_by_closeout && !row.secret_values_read_by_closeout && !row.raw_secret_material_materialized_by_closeout && !row.raw_secret_material_exposed_by_closeout && !row.desktop_provider_key_visible_by_closeout && !row.forbidden_receipt_fields_allowed_by_closeout && !row.secret_scan_remediation_action_allowed_by_closeout && !row.auto_fix_command_registered_by_closeout && !row.auto_redaction_allowed_by_closeout && !row.auto_deletion_allowed_by_closeout && !row.auto_rotation_allowed_by_closeout && !row.credential_lookup_allowed_by_closeout && row.required_validation_rules.length >= 5 && row.p455_p464_chain_ready && row.human_receipts_pending && row.no_secret_material_read && row.no_secret_or_trading_mutation), "P455-P464 secret scan remediation receipt chain secret scan remediation receipt chain signoff closeout must be declared while receipts remain absent."),
    validationItem("secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_gate_rows", "chain_signoff_closeout_gates_ready", intakeGateRows.length === 10 && intakeGateRows.every((row) => row.gate_status === "ready" && !row.signoff_receipt_received_by_closeout && !row.signoff_validation_performed_by_closeout && !row.signoff_completed_by_closeout && !row.approval_applied_by_closeout && !row.secret_values_read_by_closeout && !row.raw_secret_material_materialized_by_closeout && !row.raw_secret_material_exposed_by_closeout && !row.desktop_provider_key_visible_by_closeout && !row.forbidden_receipt_fields_allowed_by_closeout && !row.secret_scan_remediation_action_allowed_by_closeout && !row.credential_lookup_allowed_by_closeout && !row.protected_action_executed_by_closeout), "P472 secret scan remediation receipt chain secret scan remediation receipt chain signoff closeout gates are ready."),
    validationItem("boundary.closeout_pending", "closeout_pending_no_receipt_received", intakeBoundary.read_only && intakeBoundary.report_only && intakeBoundary.signoff_approval_closeout_consumed_in_memory && !intakeBoundary.signoff_approval_closeout_artifact_read_performed && intakeBoundary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_declared && !intakeBoundary.signoff_validation_performed && !intakeBoundary.signoff_receipt_received && !intakeBoundary.approval_closeout_completed && !intakeBoundary.signoff_closeout_completed && !intakeBoundary.review_completed && !intakeBoundary.review_approval_applied && !intakeBoundary.signoff_completed && !intakeBoundary.signoff_approval_applied && intakeBoundary.p455_p464_chain_ready && intakeBoundary.human_receipts_pending && intakeBoundary.human_review_required, "Secret scan remediation receipt chain signoff closeout rows are declared and no receipt is received."),
    validationItem("boundary.no_secret_material_read", "no_secret_material_read", intakeBoundary.no_secret_material_read && !intakeBoundary.secret_values_read && !intakeBoundary.env_file_read && !intakeBoundary.desktop_config_content_inspected && !intakeBoundary.desktop_config_read && !intakeBoundary.raw_secret_material_materialized && !intakeBoundary.raw_secret_material_exposed && !intakeBoundary.desktop_provider_key_visible && !intakeBoundary.credential_lookup_allowed, "P472 reads no secret material or credentials."),
    validationItem("boundary.no_receipt_or_trading_mutation", "no_receipt_or_trading_mutation", intakeBoundary.no_secret_or_trading_mutation && !intakeBoundary.actor_workspace_input_present && !intakeBoundary.receipt_input_file_materialized && !intakeBoundary.merged_receipt_input_materialized && !intakeBoundary.receipt_payload_present && !intakeBoundary.ready_for_validation && !intakeBoundary.ready_for_approval_application && !intakeBoundary.receipt_received && !intakeBoundary.receipt_validated && !intakeBoundary.receipt_application_performed && !intakeBoundary.approval_applied && !intakeBoundary.forbidden_receipt_fields_allowed && !intakeBoundary.shadow_live_enabled && !intakeBoundary.limited_live_enabled && !intakeBoundary.full_auto_enabled && !intakeBoundary.automatic_order_submission_allowed && !intakeBoundary.live_order_submission_allowed && !intakeBoundary.secret_scan_remediation_action_allowed && !intakeBoundary.auto_fix_command_registered && !intakeBoundary.auto_redaction_allowed && !intakeBoundary.auto_deletion_allowed && !intakeBoundary.auto_rotation_allowed && !intakeBoundary.live_execution_allowed && !intakeBoundary.broker_write_allowed && !intakeBoundary.exchange_write_allowed, "P472 does not receive/apply receipts or enable trading mutation."),
    validationItem("boundary.no_execution_or_artifacts", "no_execution_or_artifacts", !intakeBoundary.command_execution_performed && !intakeBoundary.package_command_execution_performed && !intakeBoundary.release_check_execution_performed && !intakeBoundary.artifact_read_performed && !intakeBoundary.artifact_write_performed && !intakeBoundary.release_published && !intakeBoundary.git_operation_performed && !intakeBoundary.protected_action_executed, "P472 does not execute commands or read/write artifacts."),
    validationItem("boundary.no_source_receipt_or_approval", "no_source_receipt_or_approval", !intakeBoundary.source_receipt_present && !intakeBoundary.source_approval_applied, "P472 must not inherit pre-applied secret scan remediation receipts or approvals."),
  ];
}

function buildSummary({ signoffApprovalCloseout, intakeRows, intakeGateRows, intakeBoundary, validation }) {
  return {
    trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_fixtures_status: validation.valid ? READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_status: signoffApprovalCloseout.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_fixtures_status,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_ready: intakeBoundary.source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_ready,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_validation_rules_status: intakeBoundary.source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_validation_rules_status,
    source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_validation_rules_ready: intakeBoundary.source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_validation_rules_ready,
    chain_signoff_closeout_row_count: intakeRows.length,
    ready_chain_signoff_closeout_row_count: intakeBoundary.ready_chain_signoff_closeout_row_count,
    chain_signoff_closeout_gate_count: intakeGateRows.length,
    ready_chain_signoff_closeout_gate_count: intakeGateRows.filter((row) => row.gate_status === "ready").length,
    read_only: intakeBoundary.read_only,
    report_only: intakeBoundary.report_only,
    signoff_approval_closeout_consumed_in_memory: intakeBoundary.signoff_approval_closeout_consumed_in_memory,
    signoff_approval_closeout_artifact_read_performed: intakeBoundary.signoff_approval_closeout_artifact_read_performed,
    signoff_validation_rules_consumed_in_memory: intakeBoundary.signoff_validation_rules_consumed_in_memory,
    signoff_validation_rules_artifact_read_performed: intakeBoundary.signoff_validation_rules_artifact_read_performed,
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_declared: intakeBoundary.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_declared,
    signoff_template_materialized: intakeBoundary.signoff_template_materialized,
    signoff_receipt_received: intakeBoundary.signoff_receipt_received,
    signoff_validation_performed: intakeBoundary.signoff_validation_performed,
    approval_closeout_completed: intakeBoundary.approval_closeout_completed,
    signoff_closeout_completed: intakeBoundary.signoff_closeout_completed,
    review_completed: intakeBoundary.review_completed,
    review_approval_applied: intakeBoundary.review_approval_applied,
    signoff_completed: intakeBoundary.signoff_completed,
    signoff_approval_applied: intakeBoundary.signoff_approval_applied,
    p455_p464_chain_ready: intakeBoundary.p455_p464_chain_ready,
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
    raw_secret_material_materialized: intakeBoundary.raw_secret_material_materialized,
    raw_secret_material_exposed: intakeBoundary.raw_secret_material_exposed,
    desktop_provider_key_visible: intakeBoundary.desktop_provider_key_visible,
    forbidden_receipt_fields_allowed: intakeBoundary.forbidden_receipt_fields_allowed,
    auto_fix_command_registered: intakeBoundary.auto_fix_command_registered,
    auto_redaction_allowed: intakeBoundary.auto_redaction_allowed,
    auto_deletion_allowed: intakeBoundary.auto_deletion_allowed,
    auto_rotation_allowed: intakeBoundary.auto_rotation_allowed,
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
    "# Trading Secret Scan Remediation Receipt Chain Secret Scan Remediation Receipt Chain Signoff Closeout Fixtures",
    "",
    `Status: ${result.summary.trading_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_fixtures_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source signoff approval closeout: ${result.summary.source_secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_status}`,
    `Signoff closeout rows: ${result.summary.ready_chain_signoff_closeout_row_count}/${result.summary.chain_signoff_closeout_row_count}`,
    `Signoff closeout gates: ${result.summary.ready_chain_signoff_closeout_gate_count}/${result.summary.chain_signoff_closeout_gate_count}`,
    "",
    "## Signoff Closeout",
    "",
    ...result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_rows.map((row) => `- ${row.source_phase_slot} ${row.package_script_name}: ${row.chain_signoff_closeout_status}`),
    "",
    "## Gates",
    "",
    ...result.secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_closeout_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_CLOSEOUT_FIXTURES_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-approval-closeout-schema") parsed.secretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffApprovalCloseoutSchemaPath = argv[++index];
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
  console.log(`Usage: node scripts/trading-secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-closeout-fixtures.mjs [options]

Options:
  --out-dir <folder>                         Output directory. Default: ${DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_CLOSEOUT_FIXTURES_OUT_DIR}
  --run-at <iso>                             Deterministic generated_at timestamp.
  --package <path>                           package.json path.
  --platform-ops-ledger <path>               P341-P500 platform operations ledger path.
  --secret-scan-remediation-receipt-chain-secret-scan-remediation-receipt-chain-signoff-approval-closeout-schema <path>
                                             P471 secret scan remediation receipt chain secret scan remediation receipt chain signoff approval closeout fixtures schema path.
  --schema <path>                            Output schema path.
  --check                                    Validate only, do not write artifacts.
  -h, --help                                 Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_CLOSEOUT_FIXTURES_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_CLOSEOUT_FIXTURES_INPUTS.platformOpsLedgerPath),
    secret_scan_remediation_receipt_chain_secret_scan_remediation_receipt_chain_signoff_approval_closeout_schema_path: path.resolve(options.secretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffApprovalCloseoutSchemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_CLOSEOUT_FIXTURES_INPUTS.secretScanRemediationReceiptChainSecretScanRemediationReceiptChainSignoffApprovalCloseoutSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_TRADING_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SECRET_SCAN_REMEDIATION_RECEIPT_CHAIN_SIGNOFF_CLOSEOUT_FIXTURES_INPUTS.schemaPath),
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
