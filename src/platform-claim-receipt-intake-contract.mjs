import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS,
  buildPlatformOperationsFreeze,
} from "./platform-operations-freeze.mjs";

export const DEFAULT_PLATFORM_CLAIM_RECEIPT_INTAKE_CONTRACT_OUT_DIR = "artifacts/platform-claim-receipt-intake-contract/latest";
export const DEFAULT_PLATFORM_CLAIM_RECEIPT_INTAKE_CONTRACT_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS,
  operationsFreezeSchemaPath: DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.schemaPath,
  claimAdjudicationLedgerPath: "docs/platform-claim-adjudication-phase-ledger.md",
  schemaPath: "schemas/platform-claim-receipt-intake-contract.schema.json",
};

const COMMAND_NAME = "platform:claim-receipt-intake-contract";
const SCHEMA_VERSION = "platform-claim-receipt-intake-contract.v1";
const CAPABILITY_ID = "platform.claim_receipt_intake_contract";
const PHASE_SLOT = "P501";
const PREVIOUS_PHASE_SLOT = "P500";
const NEXT_PHASE_SLOT = "P502";
const SOURCE_READY_STATUS = "ready_for_claim_freeze";
const CONTRACT_READY_STATUS = "ready_for_claim_receipt_intake_contract";
const EXPECTED_RECEIPT_REQUIRED_CLAIMS = 40;
const REQUIRED_RECEIPT_FIELDS = [
  "receipt_id",
  "source_phase_slot",
  "claim_id",
  "claim_type",
  "receipt_actor",
  "receipt_decision",
  "receipt_evidence_refs",
  "receipt_signed_at",
  "receipt_status",
  "human_receipt_ref",
];

export async function runPlatformClaimReceiptIntakeContract(options = {}) {
  const result = await buildPlatformClaimReceiptIntakeContract(options);
  if (options.write !== false) await writePlatformClaimReceiptIntakeContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform claim receipt intake contract failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformClaimReceiptIntakeContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_INTAKE_CONTRACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const operationsFreeze = await buildPlatformOperationsFreeze({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    schemaPath: inputs.operations_freeze_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const claimAdjudicationLedger = await readTextSource(inputs.claim_adjudication_ledger_path);
  const receiptContractRows = buildReceiptContractRows({ operationsFreeze });
  const boundary = buildBoundary({ generatedAt, writeRequested: options.write !== false, operationsFreeze, receiptContractRows });
  const anchor = buildAnchor({ operationsFreeze, packageJson, claimAdjudicationLedger, receiptContractRows });
  const gateRows = buildGateRows({ operationsFreeze, packageJson, claimAdjudicationLedger, receiptContractRows, boundary });
  const validationItems = buildValidationItems({ operationsFreeze, packageJson, claimAdjudicationLedger, receiptContractRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ operationsFreeze, receiptContractRows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_claim_receipt_intake_contract_id: `platform-claim-receipt-intake-contract.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    claim_receipt_intake_anchor: anchor,
    claim_receipt_intake_contract_rows: receiptContractRows,
    claim_receipt_intake_gate_rows: gateRows,
    claim_receipt_intake_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_claim_receipt_intake_contract") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ operationsFreeze, receiptContractRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_claim_receipt_intake_contract_id = result.platform_claim_receipt_intake_contract_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformClaimReceiptIntakeContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-claim-receipt-intake-contract.json"), serializableResult(result));
  await writeJson(path.join(outDir, "claim-receipt-intake-contract-rows.json"), collectionEnvelope("platform-claim-receipt-intake-contract-rows.v1", "claim_receipt_intake_contract_rows", result.claim_receipt_intake_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-receipt-intake-gate-rows.json"), collectionEnvelope("platform-claim-receipt-intake-gate-rows.v1", "claim_receipt_intake_gate_rows", result.claim_receipt_intake_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-receipt-intake-boundary.json"), result.claim_receipt_intake_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-claim-receipt-intake-contract-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformClaimReceiptIntakeContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformClaimReceiptIntakeContract(args);
    console.log(`Platform claim receipt intake contract ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_claim_receipt_intake_contract_status}`);
    console.log(`Receipt contracts: ${result.summary.ready_receipt_contract_row_count}/${result.summary.receipt_contract_row_count}`);
    console.log(`Contract gates: ${result.summary.ready_contract_gate_count}/${result.summary.contract_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildAnchor({ operationsFreeze, packageJson, claimAdjudicationLedger, receiptContractRows }) {
  return {
    schema_version: "platform-claim-receipt-intake-contract-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_operations_freeze_id: operationsFreeze.platform_operations_freeze_id,
    source_operations_freeze_status: operationsFreeze.summary.platform_operations_freeze_status,
    source_claim_count: operationsFreeze.summary.claim_count,
    source_blocked_claim_count: operationsFreeze.summary.blocked_claim_count,
    source_human_receipt_required_count: receiptContractRows.length,
    package_json_hash: packageJson.content_hash,
    claim_adjudication_ledger_hash: claimAdjudicationLedger.content_hash,
    receipt_contract_rows_hash: hashValue(receiptContractRows.map((row) => ({
      source_phase_slot: row.source_phase_slot,
      claim_id: row.claim_id,
      receipt_contract_status: row.receipt_contract_status,
      current_verdict: row.current_verdict,
    }))),
  };
}

function buildReceiptContractRows({ operationsFreeze }) {
  const sourceReady = operationsFreeze.validation.valid && operationsFreeze.summary.platform_operations_freeze_status === SOURCE_READY_STATUS;
  return operationsFreeze.operations_freeze_claim_registry_rows
    .filter((claimRow) => claimRow.human_receipt_required)
    .map((claimRow, index) => {
      const contractReady = sourceReady
        && claimRow.verdict === "blocked"
        && claimRow.block_reason === "missing_human_receipt"
        && claimRow.documented_human_gate
        && claimRow.next_allowed_action;
      const row = {
        schema_version: "platform-claim-receipt-intake-contract-row.v1",
        claim_receipt_intake_contract_row_id: `platform-claim-receipt-intake-contract.row.${claimRow.source_phase_slot.toLowerCase()}`,
        phase_slot: PHASE_SLOT,
        source_claim_row_id: claimRow.operations_freeze_claim_registry_row_id,
        source_phase_slot: claimRow.source_phase_slot,
        source_phase_number: claimRow.source_phase_number,
        source_command_name: claimRow.source_command_name,
        claim_id: claimRow.claim_id,
        claim_type: claimRow.claim_type,
        protected_claim: claimRow.protected_claim,
        responsible_owner: claimRow.responsible_owner,
        documented_human_gate: claimRow.documented_human_gate,
        evidence_ref: claimRow.evidence_ref,
        reviewer_ref: claimRow.reviewer_ref,
        gate_ref: claimRow.gate_ref,
        human_receipt_required: true,
        human_receipt_ref: null,
        current_verdict: claimRow.current_verdict,
        current_block_reason: claimRow.block_reason,
        next_allowed_action: claimRow.next_allowed_action,
        target_verdict_after_valid_receipt: "pass_candidate",
        receipt_contract_status: contractReady ? CONTRACT_READY_STATUS : "blocked",
        required_receipt_fields: REQUIRED_RECEIPT_FIELDS,
        required_receipt_field_count: REQUIRED_RECEIPT_FIELDS.length,
        allowed_receipt_decisions: ["approve_claim_pass_candidate", "return_with_missing_evidence", "keep_blocked"],
        required_evidence_ref_policy: "receipt must bind external human receipt evidence to the frozen claim_id and source_phase_slot",
        receipt_input_contract_declared: true,
        receipt_payload_present: false,
        human_receipt_pending: true,
        ready_for_human_input: true,
        ready_for_validation: false,
        ready_for_pass_promotion: false,
        pass_promoted_by_contract: false,
        blocked_state_preserved: true,
        operations_freeze_consumed_in_memory: true,
        operations_freeze_artifact_read_performed_by_contract: false,
        command_execution_performed_by_contract: false,
        package_command_execution_performed_by_contract: false,
        acceptance_command_execution_performed_by_contract: false,
        generated_artifact_read_performed_by_contract: false,
        artifact_read_performed_by_contract: false,
        artifact_write_performed_by_contract: false,
        dependency_install_performed_by_contract: false,
        package_mutation_performed_by_contract: false,
        lockfile_mutation_performed_by_contract: false,
        release_published_by_contract: false,
        git_operation_performed_by_contract: false,
        protected_action_executed_by_contract: false,
        protected_recovery_execution_allowed_by_contract: false,
        trading_live_enabled_by_contract: false,
        trading_full_auto_enabled_by_contract: false,
        trading_order_submission_allowed_by_contract: false,
        broker_write_allowed_by_contract: false,
        exchange_write_allowed_by_contract: false,
        desktop_source_of_truth_by_contract: false,
        desktop_mutation_allowed_by_contract: false,
        secret_exposure_allowed_by_contract: false,
        secret_values_read_by_contract: false,
        env_file_read_by_contract: false,
        desktop_config_content_inspected_by_contract: false,
        desktop_provider_key_visible_by_contract: false,
        credential_lookup_allowed_by_contract: false,
        human_review_required: true,
        human_signoff_required: true,
        human_review_note: `P501 declares the receipt contract for ${claimRow.claim_id}; it does not receive the receipt or promote the claim.`,
      };
      return withOrdinalAndHash(row, index, "claim_receipt_intake_contract_row_hash");
    });
}

function buildBoundary({ generatedAt, writeRequested, operationsFreeze, receiptContractRows }) {
  return {
    schema_version: "platform-claim-receipt-intake-contract-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    claim_adjudication_layer: true,
    source_operations_freeze_status: operationsFreeze.summary.platform_operations_freeze_status,
    source_claim_freeze_consumed_in_memory: true,
    source_claim_freeze_artifact_read_performed: false,
    claim_receipt_intake_contract_write_requested: writeRequested,
    receipt_contract_row_count: receiptContractRows.length,
    ready_receipt_contract_row_count: receiptContractRows.filter((row) => row.receipt_contract_status === CONTRACT_READY_STATUS).length,
    required_receipt_field_count: REQUIRED_RECEIPT_FIELDS.length,
    receipt_input_contract_declared: receiptContractRows.every((row) => row.receipt_input_contract_declared),
    human_receipt_pending: true,
    ready_for_human_input: true,
    ready_for_validation: false,
    ready_for_pass_promotion: false,
    receipt_payload_present: false,
    receipt_received: false,
    receipt_validated: false,
    approval_applied: false,
    pass_promoted: false,
    blocked_state_preserved: receiptContractRows.every((row) => row.blocked_state_preserved && row.current_verdict === "blocked" && !row.pass_promoted_by_contract),
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

function buildGateRows({ operationsFreeze, packageJson, claimAdjudicationLedger, receiptContractRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = claimAdjudicationLedger.text ?? "";
  const rows = [
    gateRow("p500_claim_freeze_ready", "P500 claim freeze source is ready and still preserves human-receipt BLOCK claims.", operationsFreeze.validation.valid && operationsFreeze.summary.platform_operations_freeze_status === SOURCE_READY_STATUS && operationsFreeze.summary.claim_count === 140 && operationsFreeze.summary.blocked_claim_count === EXPECTED_RECEIPT_REQUIRED_CLAIMS),
    gateRow("receipt_contract_rows_ready", "Every human-receipt-required P500 BLOCK claim has a P501 intake contract row.", receiptContractRows.length === EXPECTED_RECEIPT_REQUIRED_CLAIMS && receiptContractRows.every((row) => row.receipt_contract_status === CONTRACT_READY_STATUS)),
    gateRow("required_receipt_fields_declared", "Every intake contract declares the stable fields required to create human_receipt_ref later.", receiptContractRows.every((row) => REQUIRED_RECEIPT_FIELDS.every((field) => row.required_receipt_fields.includes(field)) && row.required_receipt_field_count === REQUIRED_RECEIPT_FIELDS.length)),
    gateRow("blocked_state_preserved", "P501 preserves BLOCK verdicts and does not promote claims without a validated receipt.", boundary.blocked_state_preserved && !boundary.pass_promoted && !boundary.ready_for_pass_promotion),
    gateRow("platform_package_script_registered", "package.json registers the P501 claim receipt intake contract command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P501 claim receipt intake contract command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p501_ledger_acceptance_declared", "P501 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P501: \`${COMMAND_NAME}\``)),
    gateRow("p501_p520_tranche_declared", "Claim adjudication ledger declares the P501-P520 human receipt realization tranche.", ledgerText.includes("P501-P520") && ledgerText.includes("Claim Adjudication and Human Receipt Realization")),
    gateRow("no_command_or_artifact_mutation", "P501 executes no commands, reads/writes no generated artifacts, mutates no packages/lockfiles/dependencies, publishes no release, runs no git, and executes no protected recovery.", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.acceptance_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed && !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.protected_recovery_execution_allowed),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "claim_receipt_intake_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-claim-receipt-intake-contract-gate-row.v1",
    claim_receipt_intake_gate_row_id: `platform-claim-receipt-intake-contract.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_payload_present: false,
    receipt_received_by_contract: false,
    receipt_validated_by_contract: false,
    pass_promoted_by_contract: false,
    protected_action_executed_by_contract: false,
    secret_exposure_allowed_by_contract: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ operationsFreeze, packageJson, claimAdjudicationLedger, receiptContractRows, gateRows, boundary }) {
  return [
    validationItem("source.operations_freeze", "p500_claim_freeze_ready", operationsFreeze.validation.valid && operationsFreeze.summary.platform_operations_freeze_status === SOURCE_READY_STATUS, "P500 claim freeze source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P501 registration checks."),
    validationItem("source.claim_adjudication_ledger", "claim_adjudication_ledger_available", claimAdjudicationLedger.available, "P501-P520 claim adjudication ledger is readable."),
    validationItem("claim_receipt_intake_contract_rows", "receipt_contract_rows_ready", receiptContractRows.length === EXPECTED_RECEIPT_REQUIRED_CLAIMS && receiptContractRows.every((row) => row.receipt_contract_status === CONTRACT_READY_STATUS && row.human_receipt_required && row.human_receipt_ref === null && row.receipt_input_contract_declared && row.human_receipt_pending && row.ready_for_human_input && !row.ready_for_validation && !row.ready_for_pass_promotion && !row.pass_promoted_by_contract), "All P500 human-receipt BLOCK claims must be represented as pending P501 intake contracts."),
    validationItem("claim_receipt_intake_contract_rows.required_fields", "required_receipt_fields_declared", receiptContractRows.every((row) => REQUIRED_RECEIPT_FIELDS.every((field) => row.required_receipt_fields.includes(field)) && row.allowed_receipt_decisions.includes("approve_claim_pass_candidate") && row.allowed_receipt_decisions.includes("keep_blocked")), "P501 contract rows must declare stable required receipt fields and allowed decisions."),
    validationItem("claim_receipt_intake_gate_rows", "contract_gates_ready", gateRows.length >= 10 && gateRows.every((row) => row.gate_status === "ready" && !row.receipt_received_by_contract && !row.receipt_validated_by_contract && !row.pass_promoted_by_contract), "P501 contract gates must be ready without receiving or validating receipts."),
    validationItem("boundary.blocked_state_preserved", "blocked_state_preserved", boundary.blocked_state_preserved && !boundary.receipt_received && !boundary.receipt_validated && !boundary.approval_applied && !boundary.pass_promoted, "P501 must preserve BLOCK state until a future validated receipt is supplied."),
    validationItem("boundary.no_execution_or_mutation", "no_execution_or_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.acceptance_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed && !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.protected_recovery_execution_allowed, "P501 remains read-only/report-only."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed, "Trading, Desktop, and secret boundaries remain disabled."),
  ];
}

function buildSummary({ operationsFreeze, receiptContractRows, gateRows, boundary, validation }) {
  return {
    platform_claim_receipt_intake_contract_status: validation.valid ? CONTRACT_READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_operations_freeze_status: operationsFreeze.summary.platform_operations_freeze_status,
    source_claim_count: operationsFreeze.summary.claim_count,
    source_blocked_claim_count: operationsFreeze.summary.blocked_claim_count,
    receipt_contract_row_count: receiptContractRows.length,
    ready_receipt_contract_row_count: receiptContractRows.filter((row) => row.receipt_contract_status === CONTRACT_READY_STATUS).length,
    contract_gate_count: gateRows.length,
    ready_contract_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    required_receipt_field_count: REQUIRED_RECEIPT_FIELDS.length,
    human_receipt_pending: boundary.human_receipt_pending,
    ready_for_human_input: boundary.ready_for_human_input,
    ready_for_validation: boundary.ready_for_validation,
    ready_for_pass_promotion: boundary.ready_for_pass_promotion,
    receipt_received: boundary.receipt_received,
    receipt_validated: boundary.receipt_validated,
    approval_applied: boundary.approval_applied,
    pass_promoted: boundary.pass_promoted,
    blocked_state_preserved: boundary.blocked_state_preserved,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
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
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Claim Receipt Intake Contract",
    "",
    `Status: ${result.summary.platform_claim_receipt_intake_contract_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source freeze: ${result.summary.source_operations_freeze_status}`,
    `Receipt contracts: ${result.summary.ready_receipt_contract_row_count}/${result.summary.receipt_contract_row_count}`,
    `Contract gates: ${result.summary.ready_contract_gate_count}/${result.summary.contract_gate_count}`,
    "",
    "## Contract Samples",
    "",
    ...result.claim_receipt_intake_contract_rows.slice(0, 12).map((row) => `- ${row.source_phase_slot} ${row.claim_id}: ${row.receipt_contract_status} (${row.current_block_reason})`),
    "",
    "## Gates",
    "",
    ...result.claim_receipt_intake_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_CLAIM_RECEIPT_INTAKE_CONTRACT_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--claim-adjudication-ledger") parsed.claimAdjudicationLedgerPath = argv[++index];
    else if (arg === "--operations-freeze-schema") parsed.operationsFreezeSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-claim-receipt-intake-contract.mjs [options]

Options:
  --out-dir <folder>                     Output directory. Default: ${DEFAULT_PLATFORM_CLAIM_RECEIPT_INTAKE_CONTRACT_OUT_DIR}
  --run-at <iso>                         Deterministic generated_at timestamp.
  --package <path>                       package.json path.
  --platform-ops-ledger <path>           P341-P500 platform operations ledger path.
  --claim-adjudication-ledger <path>     P501-P520 claim adjudication ledger path.
  --operations-freeze-schema <path>      P500 operations freeze schema path.
  --schema <path>                        Output schema path.
  --check                                Validate only, do not write artifacts.
  -h, --help                             Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_INTAKE_CONTRACT_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_INTAKE_CONTRACT_INPUTS.platformOpsLedgerPath),
    claim_adjudication_ledger_path: path.resolve(options.claimAdjudicationLedgerPath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_INTAKE_CONTRACT_INPUTS.claimAdjudicationLedgerPath),
    operations_freeze_schema_path: path.resolve(options.operationsFreezeSchemaPath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_INTAKE_CONTRACT_INPUTS.operationsFreezeSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_INTAKE_CONTRACT_INPUTS.schemaPath),
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
    const text = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      data: JSON.parse(text),
      content_hash: hashValue(JSON.parse(text)),
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      data: null,
      content_hash: null,
      error: error.message,
    };
  }
}

async function readTextSource(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      text,
      content_hash: hashText(text),
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      text: "",
      content_hash: null,
      error: error.message,
    };
  }
}

function validationItem(itemPath, checkId, passed, message) {
  return {
    validation_item_id: `platform-claim-receipt-intake-contract.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({ path: item.path, message: item.message }));
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
  };
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function withOrdinalAndHash(row, index, hashKey) {
  const ordinal = index + 1;
  const withOrdinal = { ...row, ordinal };
  return { ...withOrdinal, [hashKey]: hashValue(withOrdinal) };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
}

function dateStamp(isoString) {
  return isoString.slice(0, 10).replaceAll("-", "");
}

function slugify(value) {
  return String(value).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "root";
}
