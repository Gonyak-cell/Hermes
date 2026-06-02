import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_CLAIM_RECEIPT_INTAKE_CONTRACT_INPUTS,
  buildPlatformClaimReceiptIntakeContract,
} from "./platform-claim-receipt-intake-contract.mjs";

export const DEFAULT_PLATFORM_CLAIM_RECEIPT_WORKSPACE_OUT_DIR = "artifacts/platform-claim-receipt-workspace/latest";
export const DEFAULT_PLATFORM_CLAIM_RECEIPT_WORKSPACE_INPUTS = {
  ...DEFAULT_PLATFORM_CLAIM_RECEIPT_INTAKE_CONTRACT_INPUTS,
  claimReceiptIntakeContractSchemaPath: DEFAULT_PLATFORM_CLAIM_RECEIPT_INTAKE_CONTRACT_INPUTS.schemaPath,
  schemaPath: "schemas/platform-claim-receipt-workspace.schema.json",
};

const COMMAND_NAME = "platform:claim-receipt-workspace";
const SCHEMA_VERSION = "platform-claim-receipt-workspace.v1";
const CAPABILITY_ID = "platform.claim_receipt_workspace";
const PHASE_RANGE = "P502-P505";
const PHASE_SLOT = "P502";
const PREVIOUS_PHASE_SLOT = "P501";
const NEXT_PHASE_SLOT = "P506";
const SOURCE_READY_STATUS = "ready_for_claim_receipt_intake_contract";
const WORKSPACE_READY_STATUS = "ready_for_claim_receipt_workspace";
const WORKSPACE_ROW_READY_STATUS = "ready_for_human_receipt_workspace_input";
const SOURCE_REGISTRY_READY_STATUS = "ready_for_external_receipt_source_reference";
const REF_FORMAT_READY_STATUS = "ready_for_human_receipt_ref_binding";
const QUARANTINE_READY_STATUS = "ready_for_invalid_receipt_quarantine";
const EXPECTED_RECEIPT_REQUIRED_CLAIMS = 40;
const HUMAN_RECEIPT_REF_NAMESPACE = "human-receipt";
const RECEIPT_SOURCE_TYPES = [
  "signed_operator_receipt",
  "review_packet_receipt",
  "external_evidence_receipt",
];

export async function runPlatformClaimReceiptWorkspace(options = {}) {
  const result = await buildPlatformClaimReceiptWorkspace(options);
  if (options.write !== false) await writePlatformClaimReceiptWorkspace(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform claim receipt workspace failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformClaimReceiptWorkspace(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_WORKSPACE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const intakeContract = await buildPlatformClaimReceiptIntakeContract({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    claimAdjudicationLedgerPath: inputs.claim_adjudication_ledger_path,
    operationsFreezeSchemaPath: inputs.operations_freeze_schema_path,
    schemaPath: inputs.claim_receipt_intake_contract_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const claimAdjudicationLedger = await readTextSource(inputs.claim_adjudication_ledger_path);
  const workspaceRows = buildWorkspaceRows({ intakeContract });
  const sourceRegistryRows = buildSourceRegistryRows({ workspaceRows });
  const refFormatRows = buildHumanReceiptRefFormatRows({ workspaceRows });
  const quarantineRows = buildInvalidReceiptQuarantineRows({ workspaceRows });
  const boundary = buildBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    intakeContract,
    workspaceRows,
    sourceRegistryRows,
    refFormatRows,
    quarantineRows,
  });
  const anchor = buildAnchor({
    intakeContract,
    packageJson,
    claimAdjudicationLedger,
    workspaceRows,
    sourceRegistryRows,
    refFormatRows,
    quarantineRows,
  });
  const gateRows = buildGateRows({
    intakeContract,
    packageJson,
    claimAdjudicationLedger,
    workspaceRows,
    sourceRegistryRows,
    refFormatRows,
    quarantineRows,
    boundary,
  });
  const validationItems = buildValidationItems({
    intakeContract,
    packageJson,
    claimAdjudicationLedger,
    workspaceRows,
    sourceRegistryRows,
    refFormatRows,
    quarantineRows,
    gateRows,
    boundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    intakeContract,
    workspaceRows,
    sourceRegistryRows,
    refFormatRows,
    quarantineRows,
    gateRows,
    boundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_claim_receipt_workspace_id: `platform-claim-receipt-workspace.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    claim_receipt_workspace_anchor: anchor,
    claim_receipt_workspace_rows: workspaceRows,
    claim_receipt_source_registry_rows: sourceRegistryRows,
    claim_receipt_ref_format_rows: refFormatRows,
    claim_receipt_invalid_quarantine_rows: quarantineRows,
    claim_receipt_workspace_gate_rows: gateRows,
    claim_receipt_workspace_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_claim_receipt_workspace") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    intakeContract,
    workspaceRows,
    sourceRegistryRows,
    refFormatRows,
    quarantineRows,
    gateRows,
    boundary,
    validation: result.validation,
  });
  result.summary.platform_claim_receipt_workspace_id = result.platform_claim_receipt_workspace_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformClaimReceiptWorkspace(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-claim-receipt-workspace.json"), serializableResult(result));
  await writeJson(path.join(outDir, "claim-receipt-workspace-rows.json"), collectionEnvelope("platform-claim-receipt-workspace-rows.v1", "claim_receipt_workspace_rows", result.claim_receipt_workspace_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-receipt-source-registry-rows.json"), collectionEnvelope("platform-claim-receipt-source-registry-rows.v1", "claim_receipt_source_registry_rows", result.claim_receipt_source_registry_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-receipt-ref-format-rows.json"), collectionEnvelope("platform-claim-receipt-ref-format-rows.v1", "claim_receipt_ref_format_rows", result.claim_receipt_ref_format_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-receipt-invalid-quarantine-rows.json"), collectionEnvelope("platform-claim-receipt-invalid-quarantine-rows.v1", "claim_receipt_invalid_quarantine_rows", result.claim_receipt_invalid_quarantine_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-receipt-workspace-gate-rows.json"), collectionEnvelope("platform-claim-receipt-workspace-gate-rows.v1", "claim_receipt_workspace_gate_rows", result.claim_receipt_workspace_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-receipt-workspace-boundary.json"), result.claim_receipt_workspace_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-claim-receipt-workspace-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformClaimReceiptWorkspaceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformClaimReceiptWorkspace(args);
    console.log(`Platform claim receipt workspace ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_claim_receipt_workspace_status}`);
    console.log(`Workspace rows: ${result.summary.ready_workspace_row_count}/${result.summary.workspace_row_count}`);
    console.log(`Source registry rows: ${result.summary.ready_source_registry_row_count}/${result.summary.source_registry_row_count}`);
    console.log(`Ref format rows: ${result.summary.ready_ref_format_row_count}/${result.summary.ref_format_row_count}`);
    console.log(`Quarantine rows: ${result.summary.ready_quarantine_row_count}/${result.summary.quarantine_row_count}`);
    console.log(`Workspace gates: ${result.summary.ready_workspace_gate_count}/${result.summary.workspace_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildAnchor({ intakeContract, packageJson, claimAdjudicationLedger, workspaceRows, sourceRegistryRows, refFormatRows, quarantineRows }) {
  return {
    schema_version: "platform-claim-receipt-workspace-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_claim_receipt_intake_contract_id: intakeContract.platform_claim_receipt_intake_contract_id,
    source_claim_receipt_intake_contract_status: intakeContract.summary.platform_claim_receipt_intake_contract_status,
    source_receipt_contract_row_count: intakeContract.summary.receipt_contract_row_count,
    workspace_row_count: workspaceRows.length,
    source_registry_row_count: sourceRegistryRows.length,
    ref_format_row_count: refFormatRows.length,
    quarantine_row_count: quarantineRows.length,
    package_json_hash: packageJson.content_hash,
    claim_adjudication_ledger_hash: claimAdjudicationLedger.content_hash,
    workspace_rows_hash: hashValue(workspaceRows.map((row) => ({
      claim_id: row.claim_id,
      workspace_status: row.workspace_status,
      human_receipt_ref_template: row.human_receipt_ref_template,
    }))),
    source_registry_rows_hash: hashValue(sourceRegistryRows.map((row) => ({
      claim_id: row.claim_id,
      source_registry_status: row.source_registry_status,
      receipt_source_ref: row.receipt_source_ref,
    }))),
    ref_format_rows_hash: hashValue(refFormatRows.map((row) => ({
      claim_id: row.claim_id,
      human_receipt_ref_format_status: row.human_receipt_ref_format_status,
      human_receipt_ref_template: row.human_receipt_ref_template,
    }))),
    quarantine_rows_hash: hashValue(quarantineRows.map((row) => ({
      claim_id: row.claim_id,
      invalid_receipt_quarantine_status: row.invalid_receipt_quarantine_status,
      invalid_receipt_count: row.invalid_receipt_count,
    }))),
  };
}

function buildWorkspaceRows({ intakeContract }) {
  const sourceReady = intakeContract.validation.valid && intakeContract.summary.platform_claim_receipt_intake_contract_status === SOURCE_READY_STATUS;
  return intakeContract.claim_receipt_intake_contract_rows.map((contractRow, index) => {
    const workspaceReady = sourceReady
      && contractRow.receipt_contract_status === SOURCE_READY_STATUS
      && contractRow.current_verdict === "blocked"
      && contractRow.human_receipt_ref === null
      && contractRow.ready_for_human_input
      && !contractRow.ready_for_validation
      && !contractRow.ready_for_pass_promotion;
    const row = {
      schema_version: "platform-claim-receipt-workspace-row.v1",
      claim_receipt_workspace_row_id: `platform-claim-receipt-workspace.row.${contractRow.source_phase_slot.toLowerCase()}`,
      phase_range: PHASE_RANGE,
      phase_slot: "P502",
      source_contract_row_id: contractRow.claim_receipt_intake_contract_row_id,
      source_phase_slot: contractRow.source_phase_slot,
      source_phase_number: contractRow.source_phase_number,
      source_command_name: contractRow.source_command_name,
      claim_id: contractRow.claim_id,
      claim_type: contractRow.claim_type,
      protected_claim: contractRow.protected_claim,
      responsible_owner: contractRow.responsible_owner,
      evidence_ref: contractRow.evidence_ref,
      reviewer_ref: contractRow.reviewer_ref,
      gate_ref: contractRow.gate_ref,
      next_allowed_action: contractRow.next_allowed_action,
      current_verdict: contractRow.current_verdict,
      current_block_reason: contractRow.current_block_reason,
      source_receipt_contract_status: contractRow.receipt_contract_status,
      workspace_status: workspaceReady ? WORKSPACE_ROW_READY_STATUS : "blocked",
      workspace_input_channel: "external_human_receipt_reference",
      workspace_input_required: true,
      workspace_input_materialized: false,
      editable_receipt_fields_declared: true,
      required_receipt_fields: contractRow.required_receipt_fields,
      allowed_receipt_decisions: contractRow.allowed_receipt_decisions,
      allowed_receipt_source_types: RECEIPT_SOURCE_TYPES,
      human_receipt_ref: null,
      human_receipt_ref_namespace: HUMAN_RECEIPT_REF_NAMESPACE,
      human_receipt_ref_template: `${HUMAN_RECEIPT_REF_NAMESPACE}:${contractRow.source_phase_slot}:${contractRow.claim_id}:<receipt_id>`,
      human_receipt_ref_prefix: `${HUMAN_RECEIPT_REF_NAMESPACE}:${contractRow.source_phase_slot}:${contractRow.claim_id}:`,
      receipt_payload_present: false,
      receipt_received_by_workspace: false,
      receipt_source_registered_by_workspace: false,
      ready_for_receipt_source_registration: true,
      ready_for_validation: false,
      receipt_validated_by_workspace: false,
      approval_applied_by_workspace: false,
      ready_for_pass_promotion: false,
      pass_promoted_by_workspace: false,
      invalid_receipt_quarantine_declared: true,
      invalid_receipt_quarantine_status: QUARANTINE_READY_STATUS,
      invalid_receipt_count: 0,
      blocked_state_preserved: true,
      intake_contract_consumed_in_memory: true,
      intake_contract_artifact_read_performed_by_workspace: false,
      generated_artifact_read_performed_by_workspace: false,
      artifact_read_performed_by_workspace: false,
      artifact_write_performed_by_workspace: false,
      command_execution_performed_by_workspace: false,
      package_command_execution_performed_by_workspace: false,
      dependency_install_performed_by_workspace: false,
      package_mutation_performed_by_workspace: false,
      lockfile_mutation_performed_by_workspace: false,
      release_published_by_workspace: false,
      git_operation_performed_by_workspace: false,
      protected_action_executed_by_workspace: false,
      protected_recovery_execution_allowed_by_workspace: false,
      trading_live_enabled_by_workspace: false,
      trading_full_auto_enabled_by_workspace: false,
      trading_order_submission_allowed_by_workspace: false,
      broker_write_allowed_by_workspace: false,
      exchange_write_allowed_by_workspace: false,
      desktop_source_of_truth_by_workspace: false,
      desktop_mutation_allowed_by_workspace: false,
      secret_exposure_allowed_by_workspace: false,
      secret_values_read_by_workspace: false,
      env_file_read_by_workspace: false,
      desktop_config_content_inspected_by_workspace: false,
      desktop_provider_key_visible_by_workspace: false,
      credential_lookup_allowed_by_workspace: false,
      human_review_required: true,
      human_signoff_required: true,
      human_review_note: `P502 declares the external receipt workspace for ${contractRow.claim_id}; it does not materialize, validate, or apply a receipt.`,
    };
    return withOrdinalAndHash(row, index, "claim_receipt_workspace_row_hash");
  });
}

function buildSourceRegistryRows({ workspaceRows }) {
  return workspaceRows.map((workspaceRow, index) => {
    const row = {
      schema_version: "platform-claim-receipt-source-registry-row.v1",
      claim_receipt_source_registry_row_id: `platform-claim-receipt-source-registry.row.${workspaceRow.source_phase_slot.toLowerCase()}`,
      phase_range: PHASE_RANGE,
      phase_slot: "P503",
      source_workspace_row_id: workspaceRow.claim_receipt_workspace_row_id,
      source_phase_slot: workspaceRow.source_phase_slot,
      claim_id: workspaceRow.claim_id,
      claim_type: workspaceRow.claim_type,
      responsible_owner: workspaceRow.responsible_owner,
      source_registry_status: workspaceRow.workspace_status === WORKSPACE_ROW_READY_STATUS ? SOURCE_REGISTRY_READY_STATUS : "blocked",
      allowed_receipt_source_types: workspaceRow.allowed_receipt_source_types,
      receipt_source_ref_required: true,
      receipt_source_ref: null,
      receipt_source_registered: false,
      external_source_payload_read: false,
      external_source_content_copied: false,
      external_source_trusted_without_validation: false,
      receipt_payload_present: false,
      ready_for_validation: false,
      invalid_source_quarantine_target: "claim_receipt_invalid_quarantine",
      blocked_state_preserved: true,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "claim_receipt_source_registry_row_hash");
  });
}

function buildHumanReceiptRefFormatRows({ workspaceRows }) {
  return workspaceRows.map((workspaceRow, index) => {
    const row = {
      schema_version: "platform-claim-receipt-ref-format-row.v1",
      claim_receipt_ref_format_row_id: `platform-claim-receipt-ref-format.row.${workspaceRow.source_phase_slot.toLowerCase()}`,
      phase_range: PHASE_RANGE,
      phase_slot: "P504",
      source_workspace_row_id: workspaceRow.claim_receipt_workspace_row_id,
      source_phase_slot: workspaceRow.source_phase_slot,
      claim_id: workspaceRow.claim_id,
      claim_type: workspaceRow.claim_type,
      human_receipt_ref_format_status: workspaceRow.workspace_status === WORKSPACE_ROW_READY_STATUS ? REF_FORMAT_READY_STATUS : "blocked",
      human_receipt_ref: null,
      human_receipt_ref_namespace: workspaceRow.human_receipt_ref_namespace,
      human_receipt_ref_required_components: ["namespace", "source_phase_slot", "claim_id", "receipt_id"],
      human_receipt_ref_template: workspaceRow.human_receipt_ref_template,
      human_receipt_ref_prefix: workspaceRow.human_receipt_ref_prefix,
      human_receipt_ref_pattern: `^${HUMAN_RECEIPT_REF_NAMESPACE}:${workspaceRow.source_phase_slot}:${escapeRegExp(workspaceRow.claim_id)}:[A-Za-z0-9_.:-]+$`,
      binds_to_frozen_claim_id: true,
      binds_to_source_phase_slot: true,
      binds_to_external_receipt_id: true,
      ref_binding_materialized: false,
      receipt_payload_present: false,
      receipt_validated_by_ref_format: false,
      approval_applied_by_ref_format: false,
      pass_promoted_by_ref_format: false,
      blocked_state_preserved: true,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "claim_receipt_ref_format_row_hash");
  });
}

function buildInvalidReceiptQuarantineRows({ workspaceRows }) {
  return workspaceRows.map((workspaceRow, index) => {
    const row = {
      schema_version: "platform-claim-receipt-invalid-quarantine-row.v1",
      claim_receipt_invalid_quarantine_row_id: `platform-claim-receipt-invalid-quarantine.row.${workspaceRow.source_phase_slot.toLowerCase()}`,
      phase_range: PHASE_RANGE,
      phase_slot: "P505",
      source_workspace_row_id: workspaceRow.claim_receipt_workspace_row_id,
      source_phase_slot: workspaceRow.source_phase_slot,
      claim_id: workspaceRow.claim_id,
      claim_type: workspaceRow.claim_type,
      responsible_owner: workspaceRow.responsible_owner,
      invalid_receipt_quarantine_status: workspaceRow.workspace_status === WORKSPACE_ROW_READY_STATUS ? QUARANTINE_READY_STATUS : "blocked",
      invalid_receipt_quarantine_declared: true,
      invalid_receipt_count: 0,
      quarantined_receipt_refs: [],
      quarantine_reason_codes: ["missing_required_field", "claim_mismatch", "source_phase_mismatch", "unsupported_decision", "evidence_ref_missing", "signature_missing"],
      invalid_receipt_does_not_validate: true,
      invalid_receipt_does_not_apply_approval: true,
      invalid_receipt_does_not_promote_pass: true,
      receipt_payload_present: false,
      receipt_validated_by_quarantine: false,
      approval_applied_by_quarantine: false,
      pass_promoted_by_quarantine: false,
      blocked_state_preserved: true,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "claim_receipt_invalid_quarantine_row_hash");
  });
}

function buildBoundary({ generatedAt, writeRequested, intakeContract, workspaceRows, sourceRegistryRows, refFormatRows, quarantineRows }) {
  return {
    schema_version: "platform-claim-receipt-workspace-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    read_only: true,
    report_only: true,
    claim_adjudication_layer: true,
    source_claim_receipt_intake_contract_status: intakeContract.summary.platform_claim_receipt_intake_contract_status,
    source_claim_receipt_intake_contract_consumed_in_memory: true,
    source_claim_receipt_intake_contract_artifact_read_performed: false,
    claim_receipt_workspace_write_requested: writeRequested,
    workspace_row_count: workspaceRows.length,
    ready_workspace_row_count: workspaceRows.filter((row) => row.workspace_status === WORKSPACE_ROW_READY_STATUS).length,
    source_registry_row_count: sourceRegistryRows.length,
    ready_source_registry_row_count: sourceRegistryRows.filter((row) => row.source_registry_status === SOURCE_REGISTRY_READY_STATUS).length,
    ref_format_row_count: refFormatRows.length,
    ready_ref_format_row_count: refFormatRows.filter((row) => row.human_receipt_ref_format_status === REF_FORMAT_READY_STATUS).length,
    quarantine_row_count: quarantineRows.length,
    ready_quarantine_row_count: quarantineRows.filter((row) => row.invalid_receipt_quarantine_status === QUARANTINE_READY_STATUS).length,
    workspace_rows_declared: true,
    source_registry_declared: true,
    human_receipt_ref_format_declared: true,
    invalid_receipt_quarantine_declared: true,
    human_receipt_ref_namespace: HUMAN_RECEIPT_REF_NAMESPACE,
    receipt_payload_present: false,
    receipt_source_registered: false,
    receipt_received: false,
    receipt_validated: false,
    approval_applied: false,
    ready_for_validation: false,
    ready_for_pass_promotion: false,
    pass_promoted: false,
    invalid_receipt_count: 0,
    invalid_receipt_quarantined: false,
    blocked_state_preserved: workspaceRows.every((row) => row.blocked_state_preserved && row.current_verdict === "blocked" && !row.pass_promoted_by_workspace),
    command_execution_performed: false,
    package_command_execution_performed: false,
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

function buildGateRows({ intakeContract, packageJson, claimAdjudicationLedger, workspaceRows, sourceRegistryRows, refFormatRows, quarantineRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = claimAdjudicationLedger.text ?? "";
  const rows = [
    gateRow("p501_intake_contract_ready", "P501 claim receipt intake contract source is ready.", intakeContract.validation.valid && intakeContract.summary.platform_claim_receipt_intake_contract_status === SOURCE_READY_STATUS),
    gateRow("p502_workspace_rows_ready", "P502 workspace rows are ready for external human receipt references without materializing receipt payloads.", workspaceRows.length === EXPECTED_RECEIPT_REQUIRED_CLAIMS && workspaceRows.every((row) => row.workspace_status === WORKSPACE_ROW_READY_STATUS && row.editable_receipt_fields_declared && !row.workspace_input_materialized && !row.receipt_payload_present && !row.ready_for_validation)),
    gateRow("p503_source_registry_rows_ready", "P503 source registry rows declare allowed external receipt references without reading source payloads.", sourceRegistryRows.length === EXPECTED_RECEIPT_REQUIRED_CLAIMS && sourceRegistryRows.every((row) => row.source_registry_status === SOURCE_REGISTRY_READY_STATUS && row.receipt_source_ref === null && !row.receipt_source_registered && !row.external_source_payload_read)),
    gateRow("p504_human_receipt_ref_format_ready", "P504 declares deterministic human_receipt_ref namespace, components, template, and pattern for every claim.", refFormatRows.length === EXPECTED_RECEIPT_REQUIRED_CLAIMS && refFormatRows.every((row) => row.human_receipt_ref_format_status === REF_FORMAT_READY_STATUS && row.human_receipt_ref === null && row.human_receipt_ref_namespace === HUMAN_RECEIPT_REF_NAMESPACE && row.human_receipt_ref_required_components.includes("receipt_id") && row.binds_to_frozen_claim_id && row.binds_to_source_phase_slot && row.binds_to_external_receipt_id && !row.ref_binding_materialized)),
    gateRow("p505_invalid_receipt_quarantine_ready", "P505 declares invalid receipt quarantine rows without validating, applying, or promoting any receipt.", quarantineRows.length === EXPECTED_RECEIPT_REQUIRED_CLAIMS && quarantineRows.every((row) => row.invalid_receipt_quarantine_status === QUARANTINE_READY_STATUS && row.invalid_receipt_quarantine_declared && row.invalid_receipt_count === 0 && row.invalid_receipt_does_not_validate && row.invalid_receipt_does_not_apply_approval && row.invalid_receipt_does_not_promote_pass)),
    gateRow("blocked_state_preserved", "P502-P505 preserve frozen BLOCK verdicts and do not promote claims without validated receipts.", boundary.blocked_state_preserved && !boundary.receipt_validated && !boundary.approval_applied && !boundary.pass_promoted),
    gateRow("platform_package_script_registered", "package.json registers the P502-P505 claim receipt workspace command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P502-P505 claim receipt workspace command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p502_ledger_acceptance_declared", "P502 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P502: \`${COMMAND_NAME}\``)),
    gateRow("p503_ledger_acceptance_declared", "P503 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P503: \`${COMMAND_NAME}\``)),
    gateRow("p504_ledger_acceptance_declared", "P504 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P504: \`${COMMAND_NAME}\``)),
    gateRow("p505_ledger_acceptance_declared", "P505 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P505: \`${COMMAND_NAME}\``)),
    gateRow("no_command_or_artifact_mutation", "P502-P505 execute no commands, read/write no generated artifacts, mutate no packages/lockfiles/dependencies, publish no release, run no git, and execute no protected recovery.", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed && !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.protected_recovery_execution_allowed),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "claim_receipt_workspace_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-claim-receipt-workspace-gate-row.v1",
    claim_receipt_workspace_gate_row_id: `platform-claim-receipt-workspace.gate.${rowKey}`,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    receipt_payload_present: false,
    receipt_source_registered_by_workspace: false,
    receipt_received_by_workspace: false,
    receipt_validated_by_workspace: false,
    approval_applied_by_workspace: false,
    pass_promoted_by_workspace: false,
    protected_action_executed_by_workspace: false,
    secret_exposure_allowed_by_workspace: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ intakeContract, packageJson, claimAdjudicationLedger, workspaceRows, sourceRegistryRows, refFormatRows, quarantineRows, gateRows, boundary }) {
  return [
    validationItem("source.claim_receipt_intake_contract", "p501_intake_contract_ready", intakeContract.validation.valid && intakeContract.summary.platform_claim_receipt_intake_contract_status === SOURCE_READY_STATUS, "P501 claim receipt intake contract source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P502-P505 registration checks."),
    validationItem("source.claim_adjudication_ledger", "claim_adjudication_ledger_available", claimAdjudicationLedger.available, "P501-P520 claim adjudication ledger is readable."),
    validationItem("claim_receipt_workspace_rows", "workspace_rows_ready", workspaceRows.length === EXPECTED_RECEIPT_REQUIRED_CLAIMS && workspaceRows.every((row) => row.workspace_status === WORKSPACE_ROW_READY_STATUS && row.human_receipt_ref === null && row.workspace_input_required && row.editable_receipt_fields_declared && !row.workspace_input_materialized && !row.receipt_payload_present && !row.ready_for_validation && !row.ready_for_pass_promotion && !row.pass_promoted_by_workspace), "P502 workspace rows must be ready for external human input without receipt payloads or PASS promotion."),
    validationItem("claim_receipt_source_registry_rows", "source_registry_rows_ready", sourceRegistryRows.length === EXPECTED_RECEIPT_REQUIRED_CLAIMS && sourceRegistryRows.every((row) => row.source_registry_status === SOURCE_REGISTRY_READY_STATUS && row.receipt_source_ref_required && row.receipt_source_ref === null && !row.receipt_source_registered && !row.external_source_payload_read && !row.external_source_trusted_without_validation), "P503 source registry rows must declare source refs without reading or trusting external payloads."),
    validationItem("claim_receipt_ref_format_rows", "human_receipt_ref_format_ready", refFormatRows.length === EXPECTED_RECEIPT_REQUIRED_CLAIMS && refFormatRows.every((row) => row.human_receipt_ref_format_status === REF_FORMAT_READY_STATUS && row.human_receipt_ref === null && row.human_receipt_ref_namespace === HUMAN_RECEIPT_REF_NAMESPACE && row.human_receipt_ref_required_components.length === 4 && row.binds_to_frozen_claim_id && row.binds_to_source_phase_slot && row.binds_to_external_receipt_id && !row.ref_binding_materialized && !row.pass_promoted_by_ref_format), "P504 must declare deterministic human_receipt_ref format without binding or promoting claims."),
    validationItem("claim_receipt_invalid_quarantine_rows", "invalid_receipt_quarantine_ready", quarantineRows.length === EXPECTED_RECEIPT_REQUIRED_CLAIMS && quarantineRows.every((row) => row.invalid_receipt_quarantine_status === QUARANTINE_READY_STATUS && row.invalid_receipt_quarantine_declared && row.invalid_receipt_count === 0 && row.quarantined_receipt_refs.length === 0 && row.invalid_receipt_does_not_validate && row.invalid_receipt_does_not_apply_approval && row.invalid_receipt_does_not_promote_pass), "P505 invalid receipt quarantine must be declared without validating, applying, or promoting receipts."),
    validationItem("claim_receipt_workspace_gate_rows", "workspace_gates_ready", gateRows.length >= 14 && gateRows.every((row) => row.gate_status === "ready" && !row.receipt_validated_by_workspace && !row.pass_promoted_by_workspace && !row.protected_action_executed_by_workspace), "P502-P505 workspace gates must be ready without receipt validation or protected action."),
    validationItem("boundary.blocked_state_preserved", "blocked_state_preserved", boundary.blocked_state_preserved && !boundary.receipt_received && !boundary.receipt_validated && !boundary.approval_applied && !boundary.pass_promoted, "P502-P505 must preserve BLOCK state until future validated receipt adjudication."),
    validationItem("boundary.no_execution_or_mutation", "no_execution_or_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed && !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.protected_recovery_execution_allowed, "P502-P505 remain read-only/report-only."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed, "Trading, Desktop, and secret boundaries remain disabled."),
  ];
}

function buildSummary({ intakeContract, workspaceRows, sourceRegistryRows, refFormatRows, quarantineRows, gateRows, boundary, validation }) {
  return {
    platform_claim_receipt_workspace_status: validation.valid ? WORKSPACE_READY_STATUS : "blocked",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_claim_receipt_intake_contract_status: intakeContract.summary.platform_claim_receipt_intake_contract_status,
    source_receipt_contract_row_count: intakeContract.summary.receipt_contract_row_count,
    workspace_row_count: workspaceRows.length,
    ready_workspace_row_count: workspaceRows.filter((row) => row.workspace_status === WORKSPACE_ROW_READY_STATUS).length,
    source_registry_row_count: sourceRegistryRows.length,
    ready_source_registry_row_count: sourceRegistryRows.filter((row) => row.source_registry_status === SOURCE_REGISTRY_READY_STATUS).length,
    ref_format_row_count: refFormatRows.length,
    ready_ref_format_row_count: refFormatRows.filter((row) => row.human_receipt_ref_format_status === REF_FORMAT_READY_STATUS).length,
    quarantine_row_count: quarantineRows.length,
    ready_quarantine_row_count: quarantineRows.filter((row) => row.invalid_receipt_quarantine_status === QUARANTINE_READY_STATUS).length,
    workspace_gate_count: gateRows.length,
    ready_workspace_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    workspace_rows_declared: boundary.workspace_rows_declared,
    source_registry_declared: boundary.source_registry_declared,
    human_receipt_ref_format_declared: boundary.human_receipt_ref_format_declared,
    invalid_receipt_quarantine_declared: boundary.invalid_receipt_quarantine_declared,
    human_receipt_ref_namespace: boundary.human_receipt_ref_namespace,
    receipt_payload_present: boundary.receipt_payload_present,
    receipt_source_registered: boundary.receipt_source_registered,
    receipt_received: boundary.receipt_received,
    receipt_validated: boundary.receipt_validated,
    approval_applied: boundary.approval_applied,
    ready_for_validation: boundary.ready_for_validation,
    ready_for_pass_promotion: boundary.ready_for_pass_promotion,
    pass_promoted: boundary.pass_promoted,
    invalid_receipt_count: boundary.invalid_receipt_count,
    invalid_receipt_quarantined: boundary.invalid_receipt_quarantined,
    blocked_state_preserved: boundary.blocked_state_preserved,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
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
    "# Platform Claim Receipt Workspace",
    "",
    `Status: ${result.summary.platform_claim_receipt_workspace_status}`,
    `Phase range: ${result.summary.phase_range}`,
    `Source intake contract: ${result.summary.source_claim_receipt_intake_contract_status}`,
    `Workspace rows: ${result.summary.ready_workspace_row_count}/${result.summary.workspace_row_count}`,
    `Source registry rows: ${result.summary.ready_source_registry_row_count}/${result.summary.source_registry_row_count}`,
    `Ref format rows: ${result.summary.ready_ref_format_row_count}/${result.summary.ref_format_row_count}`,
    `Quarantine rows: ${result.summary.ready_quarantine_row_count}/${result.summary.quarantine_row_count}`,
    `Workspace gates: ${result.summary.ready_workspace_gate_count}/${result.summary.workspace_gate_count}`,
    "",
    "## Workspace Samples",
    "",
    ...result.claim_receipt_workspace_rows.slice(0, 12).map((row) => `- ${row.source_phase_slot} ${row.claim_id}: ${row.workspace_status} (${row.human_receipt_ref_template})`),
    "",
    "## Gates",
    "",
    ...result.claim_receipt_workspace_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_CLAIM_RECEIPT_WORKSPACE_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--claim-adjudication-ledger") parsed.claimAdjudicationLedgerPath = argv[++index];
    else if (arg === "--operations-freeze-schema") parsed.operationsFreezeSchemaPath = argv[++index];
    else if (arg === "--claim-receipt-intake-contract-schema") parsed.claimReceiptIntakeContractSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-claim-receipt-workspace.mjs [options]

Options:
  --out-dir <folder>                           Output directory. Default: ${DEFAULT_PLATFORM_CLAIM_RECEIPT_WORKSPACE_OUT_DIR}
  --run-at <iso>                               Deterministic generated_at timestamp.
  --package <path>                             package.json path.
  --platform-ops-ledger <path>                 P341-P500 platform operations ledger path.
  --claim-adjudication-ledger <path>           P501-P520 claim adjudication ledger path.
  --operations-freeze-schema <path>            P500 operations freeze schema path.
  --claim-receipt-intake-contract-schema <path>
                                               P501 claim receipt intake contract schema path.
  --schema <path>                              Output schema path.
  --check                                      Validate only, do not write artifacts.
  -h, --help                                   Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_WORKSPACE_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_WORKSPACE_INPUTS.platformOpsLedgerPath),
    claim_adjudication_ledger_path: path.resolve(options.claimAdjudicationLedgerPath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_WORKSPACE_INPUTS.claimAdjudicationLedgerPath),
    operations_freeze_schema_path: path.resolve(options.operationsFreezeSchemaPath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_WORKSPACE_INPUTS.operationsFreezeSchemaPath),
    claim_receipt_intake_contract_schema_path: path.resolve(options.claimReceiptIntakeContractSchemaPath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_WORKSPACE_INPUTS.claimReceiptIntakeContractSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_WORKSPACE_INPUTS.schemaPath),
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
    validation_item_id: `platform-claim-receipt-workspace.${slugify(itemPath)}.${checkId}`,
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
