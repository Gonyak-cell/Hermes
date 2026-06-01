import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CLOSEOUT_INPUTS,
  buildPlatformOperationsFreezeReceiptCloseout,
} from "./platform-operations-freeze-receipt-closeout.mjs";

export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_OUT_DIR = "artifacts/platform-operations-freeze-receipt-chain-regression/latest";
export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CLOSEOUT_INPUTS,
  operationsFreezeReceiptCloseoutSchemaPath: DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CLOSEOUT_INPUTS.schemaPath,
  schemaPath: "schemas/platform-operations-freeze-receipt-chain-regression.schema.json",
};

const COMMAND_NAME = "platform:operations-freeze-receipt-chain-regression";
const SCHEMA_VERSION = "platform-operations-freeze-receipt-chain-regression.v1";
const CAPABILITY_ID = "platform.operations_freeze_receipt_chain_regression";
const PHASE_SLOT = "P499";
const PREVIOUS_PHASE_SLOT = "P498";
const NEXT_PHASE_SLOT = "P500";
const SOURCE_READY_STATUS = "ready_for_operations_freeze_receipt_chain_closeout";
const CHAIN_READY_STATUS = "ready_for_operations_freeze_receipt_chain_regression";
const PHASE_SPECS = [
  ["P481", "platform:operations-freeze-source-inventory"],
  ["P482", "platform:operations-freeze-command-matrix"],
  ["P483", "platform:operations-freeze-evidence-index"],
  ["P484", "platform:operations-freeze-review-packet"],
  ["P485", "platform:operations-freeze-signoff-ledger"],
  ["P486", "platform:operations-freeze-signoff-receipt-template"],
  ["P487", "platform:operations-freeze-signoff-receipt-intake"],
  ["P488", "platform:operations-freeze-signoff-closeout"],
  ["P489", "platform:operations-freeze-status-ledger"],
  ["P490", "platform:operations-freeze-receipt-queue"],
  ["P491", "platform:operations-freeze-receipt-validation-rules"],
  ["P492", "platform:operations-freeze-receipt-workspace"],
  ["P493", "platform:operations-freeze-receipt-workspace-merge"],
  ["P494", "platform:operations-freeze-receipt-merge-preflight"],
  ["P495", "platform:operations-freeze-receipt-validation-packet"],
  ["P496", "platform:operations-freeze-receipt-approval-plan"],
  ["P497", "platform:operations-freeze-receipt-approval-closeout"],
  ["P498", "platform:operations-freeze-receipt-closeout"],
].map(([phaseSlot, packageScriptName]) => ({ phaseSlot, packageScriptName }));

export async function runPlatformOperationsFreezeReceiptChainRegression(options = {}) {
  const result = await buildPlatformOperationsFreezeReceiptChainRegression(options);
  if (options.write !== false) await writePlatformOperationsFreezeReceiptChainRegression(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operations freeze receipt chain regression failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperationsFreezeReceiptChainRegression(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const receiptCloseout = await buildPlatformOperationsFreezeReceiptCloseout({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    operationsFreezeSourceInventorySchemaPath: inputs.operations_freeze_source_inventory_schema_path,
    operationsFreezeCommandMatrixSchemaPath: inputs.operations_freeze_command_matrix_schema_path,
    operationsFreezeEvidenceIndexSchemaPath: inputs.operations_freeze_evidence_index_schema_path,
    operationsFreezeReviewPacketSchemaPath: inputs.operations_freeze_review_packet_schema_path,
    operationsFreezeSignoffLedgerSchemaPath: inputs.operations_freeze_signoff_ledger_schema_path,
    operationsFreezeSignoffReceiptTemplateSchemaPath: inputs.operations_freeze_signoff_receipt_template_schema_path,
    operationsFreezeSignoffReceiptIntakeSchemaPath: inputs.operations_freeze_signoff_receipt_intake_schema_path,
    operationsFreezeSignoffCloseoutSchemaPath: inputs.operations_freeze_signoff_closeout_schema_path,
    operationsFreezeStatusLedgerSchemaPath: inputs.operations_freeze_status_ledger_schema_path,
    operationsFreezeReceiptQueueSchemaPath: inputs.operations_freeze_receipt_queue_schema_path,
    operationsFreezeReceiptValidationRulesSchemaPath: inputs.operations_freeze_receipt_validation_rules_schema_path,
    operationsFreezeReceiptWorkspaceSchemaPath: inputs.operations_freeze_receipt_workspace_schema_path,
    operationsFreezeReceiptWorkspaceMergeSchemaPath: inputs.operations_freeze_receipt_workspace_merge_schema_path,
    operationsFreezeReceiptValidationPacketSchemaPath: inputs.operations_freeze_receipt_validation_packet_schema_path,
    operationsFreezeReceiptApprovalPlanSchemaPath: inputs.operations_freeze_receipt_approval_plan_schema_path,
    operationsFreezeReceiptApprovalCloseoutSchemaPath: inputs.operations_freeze_receipt_approval_closeout_schema_path,
    schemaPath: inputs.operations_freeze_receipt_closeout_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const chainRows = buildChainRows({ receiptCloseout, packageJson, platformOpsLedger });
  const boundary = buildBoundary({ generatedAt, writeRequested: options.write !== false, receiptCloseout, chainRows });
  const anchor = buildAnchor({ receiptCloseout, packageJson, platformOpsLedger, chainRows });
  const gateRows = buildGateRows({ receiptCloseout, packageJson, platformOpsLedger, chainRows, boundary });
  const validationItems = buildValidationItems({ receiptCloseout, packageJson, platformOpsLedger, chainRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ receiptCloseout, chainRows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operations_freeze_receipt_chain_regression_id: `platform-operations-freeze-receipt-chain-regression.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operations_freeze_receipt_chain_regression_anchor: anchor,
    operations_freeze_receipt_chain_regression_rows: chainRows,
    operations_freeze_receipt_chain_regression_gate_rows: gateRows,
    operations_freeze_receipt_chain_regression_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operations_freeze_receipt_chain_regression") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ receiptCloseout, chainRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_operations_freeze_receipt_chain_regression_id = result.platform_operations_freeze_receipt_chain_regression_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperationsFreezeReceiptChainRegression(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-operations-freeze-receipt-chain-regression.json"), serializableResult(result));
  await writeJson(path.join(outDir, "operations-freeze-receipt-chain-regression-rows.json"), collectionEnvelope("platform-operations-freeze-receipt-chain-regression-rows.v1", "operations_freeze_receipt_chain_regression_rows", result.operations_freeze_receipt_chain_regression_rows, result.generated_at));
  await writeJson(path.join(outDir, "operations-freeze-receipt-chain-regression-gate-rows.json"), collectionEnvelope("platform-operations-freeze-receipt-chain-regression-gate-rows.v1", "operations_freeze_receipt_chain_regression_gate_rows", result.operations_freeze_receipt_chain_regression_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "operations-freeze-receipt-chain-regression-boundary.json"), result.operations_freeze_receipt_chain_regression_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operations-freeze-receipt-chain-regression-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperationsFreezeReceiptChainRegressionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperationsFreezeReceiptChainRegression(args);
    console.log(`Platform operations freeze receipt chain regression ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operations_freeze_receipt_chain_regression_status}`);
    console.log(`Chain phases: ${result.summary.ready_chain_phase_count}/${result.summary.chain_phase_count}`);
    console.log(`Chain gates: ${result.summary.ready_chain_gate_count}/${result.summary.chain_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildAnchor({ receiptCloseout, packageJson, platformOpsLedger, chainRows }) {
  return {
    schema_version: "platform-operations-freeze-receipt-chain-regression-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_closeout_id: receiptCloseout.platform_operations_freeze_receipt_closeout_id,
    source_receipt_closeout_status: receiptCloseout.summary.platform_operations_freeze_receipt_closeout_status,
    source_receipt_closeout_hash: hashValue({
      id: receiptCloseout.platform_operations_freeze_receipt_closeout_id,
      status: receiptCloseout.summary.platform_operations_freeze_receipt_closeout_status,
      closeout_rows: receiptCloseout.summary.receipt_closeout_row_count,
      closeout_gates: receiptCloseout.summary.receipt_closeout_gate_count,
    }),
    package_json_hash: packageJson.content_hash,
    platform_ops_ledger_hash: platformOpsLedger.content_hash,
    chain_rows_hash: hashValue(chainRows.map((row) => ({
      source_phase_slot: row.source_phase_slot,
      package_script_name: row.package_script_name,
      chain_phase_status: row.chain_phase_status,
    }))),
  };
}

function buildChainRows({ receiptCloseout, packageJson, platformOpsLedger }) {
  const sourceReady = receiptCloseout.validation.valid && receiptCloseout.summary.platform_operations_freeze_receipt_closeout_status === SOURCE_READY_STATUS;
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  return PHASE_SPECS.map((phase, index) => {
    const scriptRegistered = typeof scripts[phase.packageScriptName] === "string" && scripts[phase.packageScriptName].length > 0;
    const validationChainRegistered = validateScript.includes(`npm run ${phase.packageScriptName} -- --check`);
    const ledgerAcceptanceDeclared = ledgerText.includes(`${phase.phaseSlot}: \`${phase.packageScriptName}\``);
    const rowReady = sourceReady && scriptRegistered && validationChainRegistered && ledgerAcceptanceDeclared;
    const row = {
      schema_version: "platform-operations-freeze-receipt-chain-regression-row.v1",
      operations_freeze_receipt_chain_regression_row_id: `platform-operations-freeze-receipt-chain-regression.row.${phase.phaseSlot.toLowerCase()}`,
      phase_slot: PHASE_SLOT,
      source_phase_slot: phase.phaseSlot,
      package_script_name: phase.packageScriptName,
      chain_phase_status: rowReady ? CHAIN_READY_STATUS : "blocked",
      source_receipt_closeout_status: receiptCloseout.summary.platform_operations_freeze_receipt_closeout_status,
      script_registered: scriptRegistered,
      validation_chain_registered: validationChainRegistered,
      ledger_acceptance_declared: ledgerAcceptanceDeclared,
      receipt_chain_regression_declared: true,
      p481_p498_chain_ready: receiptCloseout.summary.p481_p498_chain_ready,
      human_receipts_pending: receiptCloseout.summary.human_receipts_pending,
      actor_workspace_input_present: false,
      receipt_input_file_materialized: false,
      merged_receipt_input_materialized: false,
      receipt_payload_present: false,
      ready_for_validation: false,
      ready_for_approval_application: false,
      receipt_received_by_regression: false,
      receipt_validated_by_regression: false,
      signoff_completed_by_regression: false,
      approval_applied_by_regression: false,
      command_execution_performed_by_regression: false,
      package_command_execution_performed_by_regression: false,
      acceptance_command_execution_performed_by_regression: false,
      generated_artifact_read_performed_by_regression: false,
      artifact_read_performed_by_regression: false,
      artifact_write_performed_by_regression: false,
      dependency_install_performed_by_regression: false,
      package_mutation_performed_by_regression: false,
      lockfile_mutation_performed_by_regression: false,
      release_published_by_regression: false,
      git_operation_performed_by_regression: false,
      protected_action_executed_by_regression: false,
      protected_recovery_execution_allowed_by_regression: false,
      trading_live_enabled_by_regression: false,
      trading_full_auto_enabled_by_regression: false,
      trading_order_submission_allowed_by_regression: false,
      broker_write_allowed_by_regression: false,
      exchange_write_allowed_by_regression: false,
      desktop_source_of_truth_by_regression: false,
      desktop_mutation_allowed_by_regression: false,
      secret_exposure_allowed_by_regression: false,
      secret_values_read_by_regression: false,
      env_file_read_by_regression: false,
      desktop_config_content_inspected_by_regression: false,
      desktop_provider_key_visible_by_regression: false,
      credential_lookup_allowed_by_regression: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "operations_freeze_receipt_chain_regression_row_hash");
  });
}

function buildBoundary({ generatedAt, writeRequested, receiptCloseout, chainRows }) {
  const readyRows = chainRows.filter((row) => row.chain_phase_status === CHAIN_READY_STATUS).length;
  return {
    schema_version: "platform-operations-freeze-receipt-chain-regression-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    receipt_chain_regression_artifact_write_requested: writeRequested,
    source_receipt_closeout_status: receiptCloseout.summary.platform_operations_freeze_receipt_closeout_status,
    source_receipt_closeout_ready: receiptCloseout.validation.valid && receiptCloseout.summary.platform_operations_freeze_receipt_closeout_status === SOURCE_READY_STATUS,
    chain_phase_count: chainRows.length,
    ready_chain_phase_count: readyRows,
    receipt_closeout_consumed_in_memory: true,
    receipt_closeout_artifact_read_performed: false,
    receipt_chain_regression_declared: true,
    p481_p498_chain_ready: receiptCloseout.summary.p481_p498_chain_ready,
    human_receipts_pending: receiptCloseout.summary.human_receipts_pending,
    ready_for_p500_closeout: readyRows === PHASE_SPECS.length,
    actor_workspace_input_present: false,
    receipt_input_file_materialized: false,
    merged_receipt_input_materialized: false,
    receipt_payload_present: false,
    ready_for_validation: false,
    ready_for_approval_application: false,
    receipt_received: false,
    receipt_validated: false,
    signoff_completed: false,
    approval_applied: false,
    command_execution_performed: false,
    package_command_execution_performed: false,
    acceptance_command_execution_performed: false,
    generated_artifact_read_performed: false,
    artifact_read_performed: false,
    artifact_write_performed: false,
    dependency_install_performed: false,
    package_mutation_performed: false,
    lockfile_mutation_performed: false,
    release_published: false,
    git_operation_performed: false,
    protected_action_executed: false,
    protected_recovery_execution_allowed: false,
    trading_live_enabled: false,
    trading_full_auto_enabled: false,
    trading_order_submission_allowed: false,
    broker_write_allowed: false,
    exchange_write_allowed: false,
    desktop_source_of_truth: false,
    desktop_mutation_allowed: false,
    secret_exposure_allowed: false,
    secret_values_read: false,
    env_file_read: false,
    desktop_config_content_inspected: false,
    desktop_provider_key_visible: false,
    credential_lookup_allowed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildGateRows({ receiptCloseout, packageJson, platformOpsLedger, chainRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p498_receipt_closeout_ready", "P498 operations freeze receipt closeout source is ready.", receiptCloseout.validation.valid && receiptCloseout.summary.platform_operations_freeze_receipt_closeout_status === SOURCE_READY_STATUS && receiptCloseout.summary.ready_receipt_closeout_row_count === 7),
    gateRow("chain_phase_rows_ready", "Every P481-P498 operations freeze phase row is registered in scripts, validation, and ledger text.", chainRows.length === PHASE_SPECS.length && chainRows.every((row) => row.chain_phase_status === CHAIN_READY_STATUS)),
    gateRow("platform_package_script_registered", "package.json registers the P499 operations freeze receipt chain regression command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P499 operations freeze receipt chain regression command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p499_ledger_acceptance_declared", "P499 acceptance row is declared in the platform operations ledger.", ledgerText.includes(`P499: \`${COMMAND_NAME}\``)),
    gateRow("no_receipt_payload_or_approval", "P499 receives no payloads, validates no receipts, completes no signoff, and applies no approvals.", !boundary.actor_workspace_input_present && !boundary.receipt_input_file_materialized && !boundary.merged_receipt_input_materialized && !boundary.receipt_payload_present && !boundary.ready_for_validation && !boundary.ready_for_approval_application && !boundary.receipt_received && !boundary.receipt_validated && !boundary.signoff_completed && !boundary.approval_applied),
    gateRow("no_command_or_artifact_mutation", "P499 executes no commands, reads/writes no generated artifacts, mutates no packages/lockfiles/dependencies, publishes no release, runs no git, and executes no protected recovery.", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.acceptance_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed && !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.protected_recovery_execution_allowed),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed),
    gateRow("p500_closeout_handoff_ready", "P499 is ready to hand off to the final P500 operations freeze closeout.", boundary.ready_for_p500_closeout),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operations_freeze_receipt_chain_regression_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-operations-freeze-receipt-chain-regression-gate-row.v1",
    operations_freeze_receipt_chain_regression_gate_row_id: `platform-operations-freeze-receipt-chain-regression.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_payload_present_by_regression: false,
    ready_for_validation_by_regression: false,
    ready_for_approval_application_by_regression: false,
    receipt_received_by_regression: false,
    receipt_validated_by_regression: false,
    signoff_completed_by_regression: false,
    approval_applied_by_regression: false,
    command_execution_performed_by_regression: false,
    package_command_execution_performed_by_regression: false,
    acceptance_command_execution_performed_by_regression: false,
    generated_artifact_read_performed_by_regression: false,
    artifact_read_performed_by_regression: false,
    artifact_write_performed_by_regression: false,
    protected_action_executed_by_regression: false,
    protected_recovery_execution_allowed_by_regression: false,
    trading_order_submission_allowed_by_regression: false,
    broker_write_allowed_by_regression: false,
    exchange_write_allowed_by_regression: false,
    desktop_source_of_truth_by_regression: false,
    desktop_mutation_allowed_by_regression: false,
    secret_exposure_allowed_by_regression: false,
    secret_values_read_by_regression: false,
    env_file_read_by_regression: false,
    desktop_config_content_inspected_by_regression: false,
    desktop_provider_key_visible_by_regression: false,
    credential_lookup_allowed_by_regression: false,
    human_review_required: true,
  };
}

function buildValidationItems({ receiptCloseout, packageJson, platformOpsLedger, chainRows, gateRows, boundary }) {
  return [
    validationItem("source.operations_freeze_receipt_closeout", "p498_receipt_closeout_ready", receiptCloseout.validation.valid && receiptCloseout.summary.platform_operations_freeze_receipt_closeout_status === SOURCE_READY_STATUS, "P498 operations freeze receipt closeout source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P499 chain regression."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("operations_freeze_receipt_chain_regression_rows", "chain_phase_rows_ready", chainRows.length === PHASE_SPECS.length && chainRows.every((row) => row.chain_phase_status === CHAIN_READY_STATUS && row.script_registered && row.validation_chain_registered && row.ledger_acceptance_declared && row.receipt_chain_regression_declared && !row.receipt_payload_present && !row.ready_for_validation && !row.ready_for_approval_application && !row.approval_applied_by_regression && !row.acceptance_command_execution_performed_by_regression && !row.secret_exposure_allowed_by_regression), "P481-P498 chain regression rows must be registered and declarative only."),
    validationItem("operations_freeze_receipt_chain_regression_gate_rows", "chain_gates_ready", gateRows.length >= 9 && gateRows.every((row) => row.gate_status === "ready" && !row.approval_applied_by_regression && !row.acceptance_command_execution_performed_by_regression && !row.protected_action_executed_by_regression && !row.secret_exposure_allowed_by_regression), "P499 chain regression gates must be ready."),
    validationItem("boundary.no_receipt_payload", "no_receipt_payload", boundary.read_only && boundary.report_only && boundary.receipt_closeout_consumed_in_memory && !boundary.receipt_closeout_artifact_read_performed && boundary.receipt_chain_regression_declared && boundary.p481_p498_chain_ready && boundary.human_receipts_pending && boundary.ready_for_p500_closeout && !boundary.receipt_payload_present && !boundary.ready_for_validation && !boundary.ready_for_approval_application && !boundary.receipt_received && !boundary.receipt_validated && !boundary.signoff_completed && !boundary.approval_applied, "P499 records chain regression without receipt payloads or approval application."),
    validationItem("boundary.no_execution_or_mutation", "no_execution_or_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.acceptance_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed && !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.protected_recovery_execution_allowed, "P499 performs no command execution, artifact read/write, dependency/package/lockfile mutation, release, git, protected, or recovery action."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed, "Trading, Desktop, and secret boundaries remain disabled."),
  ];
}

function buildSummary({ receiptCloseout, chainRows, gateRows, boundary, validation }) {
  return {
    platform_operations_freeze_receipt_chain_regression_status: validation.valid ? CHAIN_READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_receipt_closeout_status: receiptCloseout.summary.platform_operations_freeze_receipt_closeout_status,
    chain_phase_count: chainRows.length,
    ready_chain_phase_count: chainRows.filter((row) => row.chain_phase_status === CHAIN_READY_STATUS).length,
    chain_gate_count: gateRows.length,
    ready_chain_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    receipt_closeout_consumed_in_memory: boundary.receipt_closeout_consumed_in_memory,
    receipt_closeout_artifact_read_performed: boundary.receipt_closeout_artifact_read_performed,
    receipt_chain_regression_declared: boundary.receipt_chain_regression_declared,
    p481_p498_chain_ready: boundary.p481_p498_chain_ready,
    human_receipts_pending: boundary.human_receipts_pending,
    ready_for_p500_closeout: boundary.ready_for_p500_closeout,
    actor_workspace_input_present: boundary.actor_workspace_input_present,
    receipt_input_file_materialized: boundary.receipt_input_file_materialized,
    merged_receipt_input_materialized: boundary.merged_receipt_input_materialized,
    receipt_payload_present: boundary.receipt_payload_present,
    ready_for_validation: boundary.ready_for_validation,
    ready_for_approval_application: boundary.ready_for_approval_application,
    receipt_received: boundary.receipt_received,
    receipt_validated: boundary.receipt_validated,
    signoff_completed: boundary.signoff_completed,
    approval_applied: boundary.approval_applied,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
    acceptance_command_execution_performed: boundary.acceptance_command_execution_performed,
    generated_artifact_read_performed: boundary.generated_artifact_read_performed,
    artifact_read_performed: boundary.artifact_read_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    dependency_install_performed: boundary.dependency_install_performed,
    package_mutation_performed: boundary.package_mutation_performed,
    lockfile_mutation_performed: boundary.lockfile_mutation_performed,
    release_published: boundary.release_published,
    git_operation_performed: boundary.git_operation_performed,
    protected_action_executed: boundary.protected_action_executed,
    protected_recovery_execution_allowed: boundary.protected_recovery_execution_allowed,
    trading_live_enabled: boundary.trading_live_enabled,
    trading_full_auto_enabled: boundary.trading_full_auto_enabled,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    broker_write_allowed: boundary.broker_write_allowed,
    exchange_write_allowed: boundary.exchange_write_allowed,
    desktop_source_of_truth: boundary.desktop_source_of_truth,
    desktop_mutation_allowed: boundary.desktop_mutation_allowed,
    secret_exposure_allowed: boundary.secret_exposure_allowed,
    secret_values_read: boundary.secret_values_read,
    env_file_read: boundary.env_file_read,
    desktop_config_content_inspected: boundary.desktop_config_content_inspected,
    desktop_provider_key_visible: boundary.desktop_provider_key_visible,
    credential_lookup_allowed: boundary.credential_lookup_allowed,
    human_review_required: boundary.human_review_required,
    human_signoff_required: boundary.human_signoff_required,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Operations Freeze Receipt Chain Regression",
    "",
    `Status: ${result.summary.platform_operations_freeze_receipt_chain_regression_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source receipt closeout: ${result.summary.source_receipt_closeout_status}`,
    `Chain phases: ${result.summary.ready_chain_phase_count}/${result.summary.chain_phase_count}`,
    `Chain gates: ${result.summary.ready_chain_gate_count}/${result.summary.chain_gate_count}`,
    "",
    "## Chain Rows",
    "",
    ...result.operations_freeze_receipt_chain_regression_rows.map((row) => `- ${row.source_phase_slot} ${row.package_script_name}: ${row.chain_phase_status}`),
    "",
    "## Gates",
    "",
    ...result.operations_freeze_receipt_chain_regression_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--source-inventory-schema") parsed.operationsFreezeSourceInventorySchemaPath = argv[++index];
    else if (arg === "--command-matrix-schema") parsed.operationsFreezeCommandMatrixSchemaPath = argv[++index];
    else if (arg === "--evidence-index-schema") parsed.operationsFreezeEvidenceIndexSchemaPath = argv[++index];
    else if (arg === "--review-packet-schema") parsed.operationsFreezeReviewPacketSchemaPath = argv[++index];
    else if (arg === "--signoff-ledger-schema") parsed.operationsFreezeSignoffLedgerSchemaPath = argv[++index];
    else if (arg === "--receipt-template-schema") parsed.operationsFreezeSignoffReceiptTemplateSchemaPath = argv[++index];
    else if (arg === "--receipt-intake-schema") parsed.operationsFreezeSignoffReceiptIntakeSchemaPath = argv[++index];
    else if (arg === "--signoff-closeout-schema") parsed.operationsFreezeSignoffCloseoutSchemaPath = argv[++index];
    else if (arg === "--status-ledger-schema") parsed.operationsFreezeStatusLedgerSchemaPath = argv[++index];
    else if (arg === "--receipt-queue-schema") parsed.operationsFreezeReceiptQueueSchemaPath = argv[++index];
    else if (arg === "--receipt-validation-rules-schema") parsed.operationsFreezeReceiptValidationRulesSchemaPath = argv[++index];
    else if (arg === "--receipt-workspace-schema") parsed.operationsFreezeReceiptWorkspaceSchemaPath = argv[++index];
    else if (arg === "--receipt-workspace-merge-schema") parsed.operationsFreezeReceiptWorkspaceMergeSchemaPath = argv[++index];
    else if (arg === "--receipt-validation-packet-schema") parsed.operationsFreezeReceiptValidationPacketSchemaPath = argv[++index];
    else if (arg === "--receipt-approval-plan-schema") parsed.operationsFreezeReceiptApprovalPlanSchemaPath = argv[++index];
    else if (arg === "--receipt-approval-closeout-schema") parsed.operationsFreezeReceiptApprovalCloseoutSchemaPath = argv[++index];
    else if (arg === "--receipt-closeout-schema") parsed.operationsFreezeReceiptCloseoutSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operations-freeze-receipt-chain-regression.mjs [options]

Options:
  --out-dir <folder>                       Output directory. Default: ${DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_OUT_DIR}
  --run-at <iso>                           Deterministic generated_at timestamp.
  --package <path>                         package.json path.
  --platform-ops-ledger <path>             P341-P500 platform operations ledger path.
  --source-inventory-schema <path>         P481 source inventory schema path.
  --command-matrix-schema <path>           P482 command matrix schema path.
  --evidence-index-schema <path>           P483 evidence index schema path.
  --review-packet-schema <path>            P484 review packet schema path.
  --signoff-ledger-schema <path>           P485 signoff ledger schema path.
  --receipt-template-schema <path>         P486 receipt template schema path.
  --receipt-intake-schema <path>           P487 receipt intake schema path.
  --signoff-closeout-schema <path>         P488 signoff closeout schema path.
  --status-ledger-schema <path>            P489 status ledger schema path.
  --receipt-queue-schema <path>            P490 receipt queue schema path.
  --receipt-validation-rules-schema <path> P491 receipt validation rules schema path.
  --receipt-workspace-schema <path>        P492 receipt workspace schema path.
  --receipt-workspace-merge-schema <path>  P493 receipt workspace merge schema path.
  --receipt-validation-packet-schema <path>
                                            P495 receipt validation packet schema path.
  --receipt-approval-plan-schema <path>    P496 receipt approval plan schema path.
  --receipt-approval-closeout-schema <path>
                                            P497 receipt approval closeout schema path.
  --receipt-closeout-schema <path>         P498 receipt closeout schema path.
  --schema <path>                          Output schema path.
  --check                                  Validate only, do not write artifacts.
  -h, --help                               Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.platformOpsLedgerPath),
    operations_freeze_source_inventory_schema_path: path.resolve(options.operationsFreezeSourceInventorySchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.operationsFreezeSourceInventorySchemaPath),
    operations_freeze_command_matrix_schema_path: path.resolve(options.operationsFreezeCommandMatrixSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.operationsFreezeCommandMatrixSchemaPath),
    operations_freeze_evidence_index_schema_path: path.resolve(options.operationsFreezeEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.operationsFreezeEvidenceIndexSchemaPath),
    operations_freeze_review_packet_schema_path: path.resolve(options.operationsFreezeReviewPacketSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.operationsFreezeReviewPacketSchemaPath),
    operations_freeze_signoff_ledger_schema_path: path.resolve(options.operationsFreezeSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.operationsFreezeSignoffLedgerSchemaPath),
    operations_freeze_signoff_receipt_template_schema_path: path.resolve(options.operationsFreezeSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.operationsFreezeSignoffReceiptTemplateSchemaPath),
    operations_freeze_signoff_receipt_intake_schema_path: path.resolve(options.operationsFreezeSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.operationsFreezeSignoffReceiptIntakeSchemaPath),
    operations_freeze_signoff_closeout_schema_path: path.resolve(options.operationsFreezeSignoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.operationsFreezeSignoffCloseoutSchemaPath),
    operations_freeze_status_ledger_schema_path: path.resolve(options.operationsFreezeStatusLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.operationsFreezeStatusLedgerSchemaPath),
    operations_freeze_receipt_queue_schema_path: path.resolve(options.operationsFreezeReceiptQueueSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.operationsFreezeReceiptQueueSchemaPath),
    operations_freeze_receipt_validation_rules_schema_path: path.resolve(options.operationsFreezeReceiptValidationRulesSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.operationsFreezeReceiptValidationRulesSchemaPath),
    operations_freeze_receipt_workspace_schema_path: path.resolve(options.operationsFreezeReceiptWorkspaceSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.operationsFreezeReceiptWorkspaceSchemaPath),
    operations_freeze_receipt_workspace_merge_schema_path: path.resolve(options.operationsFreezeReceiptWorkspaceMergeSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.operationsFreezeReceiptWorkspaceMergeSchemaPath),
    operations_freeze_receipt_validation_packet_schema_path: path.resolve(options.operationsFreezeReceiptValidationPacketSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.operationsFreezeReceiptValidationPacketSchemaPath),
    operations_freeze_receipt_approval_plan_schema_path: path.resolve(options.operationsFreezeReceiptApprovalPlanSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.operationsFreezeReceiptApprovalPlanSchemaPath),
    operations_freeze_receipt_approval_closeout_schema_path: path.resolve(options.operationsFreezeReceiptApprovalCloseoutSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.operationsFreezeReceiptApprovalCloseoutSchemaPath),
    operations_freeze_receipt_closeout_schema_path: path.resolve(options.operationsFreezeReceiptCloseoutSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.operationsFreezeReceiptCloseoutSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_RECEIPT_CHAIN_REGRESSION_INPUTS.schemaPath),
  };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    count: rows.length,
    [key]: rows,
  };
}

async function readJsonSource(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return { path: filePath, available: true, data: JSON.parse(raw), content_hash: sha256(raw) };
  } catch (error) {
    return { path: filePath, available: false, data: null, content_hash: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { path: filePath, available: true, text, content_hash: sha256(text) };
  } catch (error) {
    return { path: filePath, available: false, text: "", content_hash: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `platform-operations-freeze-receipt-chain-regression.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return { valid: errors.length === 0, errors };
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function withOrdinalAndHash(row, index, hashKey) {
  const rowWithOrdinal = { ...row, ordinal: index + 1 };
  return { ...rowWithOrdinal, [hashKey]: hashValue(rowWithOrdinal) };
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex")}`;
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function dateStamp(isoString) {
  return isoString.slice(0, 10).replace(/-/g, "");
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
