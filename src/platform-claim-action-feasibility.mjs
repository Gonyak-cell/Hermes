import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_CLAIM_RECEIPT_WORKSPACE_INPUTS,
  buildPlatformClaimReceiptWorkspace,
} from "./platform-claim-receipt-workspace.mjs";

export const DEFAULT_PLATFORM_CLAIM_ACTION_FEASIBILITY_OUT_DIR = "artifacts/platform-claim-action-feasibility/latest";
export const DEFAULT_PLATFORM_CLAIM_ACTION_FEASIBILITY_INPUTS = {
  ...DEFAULT_PLATFORM_CLAIM_RECEIPT_WORKSPACE_INPUTS,
  claimReceiptWorkspaceSchemaPath: DEFAULT_PLATFORM_CLAIM_RECEIPT_WORKSPACE_INPUTS.schemaPath,
  schemaPath: "schemas/platform-claim-action-feasibility.schema.json",
};

const COMMAND_NAME = "platform:claim-action-feasibility";
const SCHEMA_VERSION = "platform-claim-action-feasibility.v1";
const CAPABILITY_ID = "platform.claim_action_feasibility";
const PHASE_RANGE = "P506-P510";
const PHASE_SLOT = "P506";
const PREVIOUS_PHASE_SLOT = "P505";
const NEXT_PHASE_SLOT = "P511";
const SOURCE_READY_STATUS = "ready_for_claim_receipt_workspace";
const READY_STATUS = "ready_for_claim_action_feasibility";
const CLASSIFICATION_READY_STATUS = "ready_for_next_allowed_action_classification";
const OWNER_READY_STATUS = "ready_for_claim_action_owner_preflight";
const PROTECTED_BOUNDARY_READY_STATUS = "ready_for_claim_action_protected_boundary";
const EVIDENCE_GAP_READY_STATUS = "ready_for_claim_action_evidence_gap_index";
const CLOSEOUT_READY_STATUS = "ready_for_claim_action_fail_closed_closeout";
const EXPECTED_BLOCKED_CLAIMS = 40;
const ALLOWED_OWNERS = ["approval_owner", "recovery_owner"];
const ACTION_PATTERN = /^collect external human receipt for (?<target_command_name>\S+) from (?<responsible_owner>\S+) and rerun (?<rerun_command>platform:operations-freeze -- --check)$/;

export async function runPlatformClaimActionFeasibility(options = {}) {
  const result = await buildPlatformClaimActionFeasibility(options);
  if (options.write !== false) await writePlatformClaimActionFeasibility(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform claim action feasibility failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformClaimActionFeasibility(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_CLAIM_ACTION_FEASIBILITY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const claimReceiptWorkspace = await buildPlatformClaimReceiptWorkspace({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    claimAdjudicationLedgerPath: inputs.claim_adjudication_ledger_path,
    operationsFreezeSchemaPath: inputs.operations_freeze_schema_path,
    claimReceiptIntakeContractSchemaPath: inputs.claim_receipt_intake_contract_schema_path,
    schemaPath: inputs.claim_receipt_workspace_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const claimAdjudicationLedger = await readTextSource(inputs.claim_adjudication_ledger_path);
  const scripts = packageJson.data?.scripts ?? {};
  const classificationRows = buildActionClassificationRows({ claimReceiptWorkspace, scripts });
  const ownerPreflightRows = buildOwnerPreflightRows({ classificationRows });
  const protectedBoundaryRows = buildProtectedBoundaryRows({ classificationRows });
  const evidenceGapRows = buildEvidenceGapRows({ classificationRows });
  const closeoutRows = buildCloseoutRows({
    classificationRows,
    ownerPreflightRows,
    protectedBoundaryRows,
    evidenceGapRows,
  });
  const boundary = buildBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    claimReceiptWorkspace,
    classificationRows,
    ownerPreflightRows,
    protectedBoundaryRows,
    evidenceGapRows,
    closeoutRows,
  });
  const anchor = buildAnchor({
    claimReceiptWorkspace,
    packageJson,
    claimAdjudicationLedger,
    classificationRows,
    ownerPreflightRows,
    protectedBoundaryRows,
    evidenceGapRows,
    closeoutRows,
  });
  const gateRows = buildGateRows({
    claimReceiptWorkspace,
    packageJson,
    claimAdjudicationLedger,
    classificationRows,
    ownerPreflightRows,
    protectedBoundaryRows,
    evidenceGapRows,
    closeoutRows,
    boundary,
  });
  const validationItems = buildValidationItems({
    claimReceiptWorkspace,
    packageJson,
    claimAdjudicationLedger,
    classificationRows,
    ownerPreflightRows,
    protectedBoundaryRows,
    evidenceGapRows,
    closeoutRows,
    gateRows,
    boundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    claimReceiptWorkspace,
    classificationRows,
    ownerPreflightRows,
    protectedBoundaryRows,
    evidenceGapRows,
    closeoutRows,
    gateRows,
    boundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_claim_action_feasibility_id: `platform-claim-action-feasibility.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    claim_action_feasibility_anchor: anchor,
    claim_action_classification_rows: classificationRows,
    claim_action_owner_preflight_rows: ownerPreflightRows,
    claim_action_protected_boundary_rows: protectedBoundaryRows,
    claim_action_evidence_gap_rows: evidenceGapRows,
    claim_action_fail_closed_rows: closeoutRows,
    claim_action_feasibility_gate_rows: gateRows,
    claim_action_feasibility_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_claim_action_feasibility") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    claimReceiptWorkspace,
    classificationRows,
    ownerPreflightRows,
    protectedBoundaryRows,
    evidenceGapRows,
    closeoutRows,
    gateRows,
    boundary,
    validation: result.validation,
  });
  result.summary.platform_claim_action_feasibility_id = result.platform_claim_action_feasibility_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformClaimActionFeasibility(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-claim-action-feasibility.json"), serializableResult(result));
  await writeJson(path.join(outDir, "claim-action-classification-rows.json"), collectionEnvelope("platform-claim-action-classification-rows.v1", "claim_action_classification_rows", result.claim_action_classification_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-action-owner-preflight-rows.json"), collectionEnvelope("platform-claim-action-owner-preflight-rows.v1", "claim_action_owner_preflight_rows", result.claim_action_owner_preflight_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-action-protected-boundary-rows.json"), collectionEnvelope("platform-claim-action-protected-boundary-rows.v1", "claim_action_protected_boundary_rows", result.claim_action_protected_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-action-evidence-gap-rows.json"), collectionEnvelope("platform-claim-action-evidence-gap-rows.v1", "claim_action_evidence_gap_rows", result.claim_action_evidence_gap_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-action-fail-closed-rows.json"), collectionEnvelope("platform-claim-action-fail-closed-rows.v1", "claim_action_fail_closed_rows", result.claim_action_fail_closed_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-action-feasibility-gate-rows.json"), collectionEnvelope("platform-claim-action-feasibility-gate-rows.v1", "claim_action_feasibility_gate_rows", result.claim_action_feasibility_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-action-feasibility-boundary.json"), result.claim_action_feasibility_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-claim-action-feasibility-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformClaimActionFeasibilityCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformClaimActionFeasibility(args);
    console.log(`Platform claim action feasibility ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_claim_action_feasibility_status}`);
    console.log(`Classification rows: ${result.summary.ready_action_classification_row_count}/${result.summary.action_classification_row_count}`);
    console.log(`Owner preflight rows: ${result.summary.ready_owner_preflight_row_count}/${result.summary.owner_preflight_row_count}`);
    console.log(`Protected boundary rows: ${result.summary.ready_protected_boundary_row_count}/${result.summary.protected_boundary_row_count}`);
    console.log(`Evidence gap rows: ${result.summary.ready_evidence_gap_row_count}/${result.summary.evidence_gap_row_count}`);
    console.log(`Fail-closed rows: ${result.summary.ready_fail_closed_row_count}/${result.summary.fail_closed_row_count}`);
    console.log(`Action gates: ${result.summary.ready_action_gate_count}/${result.summary.action_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildAnchor({ claimReceiptWorkspace, packageJson, claimAdjudicationLedger, classificationRows, ownerPreflightRows, protectedBoundaryRows, evidenceGapRows, closeoutRows }) {
  return {
    schema_version: "platform-claim-action-feasibility-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_claim_receipt_workspace_id: claimReceiptWorkspace.platform_claim_receipt_workspace_id,
    source_claim_receipt_workspace_status: claimReceiptWorkspace.summary.platform_claim_receipt_workspace_status,
    source_workspace_row_count: claimReceiptWorkspace.summary.workspace_row_count,
    action_classification_row_count: classificationRows.length,
    owner_preflight_row_count: ownerPreflightRows.length,
    protected_boundary_row_count: protectedBoundaryRows.length,
    evidence_gap_row_count: evidenceGapRows.length,
    fail_closed_row_count: closeoutRows.length,
    package_json_hash: packageJson.content_hash,
    claim_adjudication_ledger_hash: claimAdjudicationLedger.content_hash,
    action_classification_rows_hash: hashRows(classificationRows, ["claim_id", "target_command_name", "classification_status"]),
    owner_preflight_rows_hash: hashRows(ownerPreflightRows, ["claim_id", "responsible_owner", "owner_preflight_status"]),
    protected_boundary_rows_hash: hashRows(protectedBoundaryRows, ["claim_id", "protected_boundary_status", "current_execution_allowed"]),
    evidence_gap_rows_hash: hashRows(evidenceGapRows, ["claim_id", "evidence_gap_status", "evidence_gap_open"]),
    fail_closed_rows_hash: hashRows(closeoutRows, ["claim_id", "fail_closed_status", "current_claim_status_after_closeout"]),
  };
}

function buildActionClassificationRows({ claimReceiptWorkspace, scripts }) {
  const sourceReady = claimReceiptWorkspace.validation.valid && claimReceiptWorkspace.summary.platform_claim_receipt_workspace_status === SOURCE_READY_STATUS;
  return claimReceiptWorkspace.claim_receipt_workspace_rows.map((workspaceRow, index) => {
    const parsed = parseNextAllowedAction(workspaceRow.next_allowed_action);
    const targetCommandName = parsed?.target_command_name ?? null;
    const actionOwner = parsed?.responsible_owner ?? null;
    const rerunCommand = parsed?.rerun_command ?? null;
    const targetPackageScriptRegistered = Boolean(targetCommandName && scripts[targetCommandName]);
    const rerunPackageScriptRegistered = typeof scripts["platform:operations-freeze"] === "string";
    const ownerMatches = actionOwner === workspaceRow.responsible_owner;
    const checkModeOnly = rerunCommand === "platform:operations-freeze -- --check";
    const unsafeEnablementRequested = detectUnsafeEnablement(workspaceRow.next_allowed_action);
    const classificationReady = sourceReady
      && workspaceRow.workspace_status === "ready_for_human_receipt_workspace_input"
      && workspaceRow.current_verdict === "blocked"
      && Boolean(parsed)
      && targetPackageScriptRegistered
      && rerunPackageScriptRegistered
      && ownerMatches
      && checkModeOnly
      && !unsafeEnablementRequested;
    const row = {
      schema_version: "platform-claim-action-classification-row.v1",
      claim_action_classification_row_id: `platform-claim-action-classification.row.${workspaceRow.source_phase_slot.toLowerCase()}`,
      phase_range: PHASE_RANGE,
      phase_slot: "P506",
      source_workspace_row_id: workspaceRow.claim_receipt_workspace_row_id,
      source_phase_slot: workspaceRow.source_phase_slot,
      source_phase_number: workspaceRow.source_phase_number,
      source_command_name: workspaceRow.source_command_name,
      claim_id: workspaceRow.claim_id,
      claim_type: workspaceRow.claim_type,
      protected_claim: workspaceRow.protected_claim,
      responsible_owner: workspaceRow.responsible_owner,
      reviewer_ref: workspaceRow.reviewer_ref,
      gate_ref: workspaceRow.gate_ref,
      evidence_ref: workspaceRow.evidence_ref,
      next_allowed_action: workspaceRow.next_allowed_action,
      current_verdict: workspaceRow.current_verdict,
      current_block_reason: workspaceRow.current_block_reason,
      classification_status: classificationReady ? CLASSIFICATION_READY_STATUS : "blocked",
      action_family: parsed ? "collect_external_human_receipt_then_rerun_freeze_check" : "unclassified",
      target_command_name: targetCommandName,
      target_package_script_registered: targetPackageScriptRegistered,
      rerun_command: rerunCommand,
      rerun_package_script_name: "platform:operations-freeze",
      rerun_package_script_registered: rerunPackageScriptRegistered,
      rerun_check_mode_only: checkModeOnly,
      action_owner_from_text: actionOwner,
      action_owner_matches_responsible_owner: ownerMatches,
      external_human_receipt_collection_required: true,
      human_receipt_ref_required_before_action: true,
      receipt_source_ref_required_before_action: true,
      current_execution_allowed: false,
      execution_feasible_after_valid_receipt: classificationReady,
      unsafe_enablement_requested: unsafeEnablementRequested,
      blocked_state_preserved: true,
      workspace_consumed_in_memory: true,
      workspace_artifact_read_performed_by_classification: false,
      command_execution_performed_by_classification: false,
      package_command_execution_performed_by_classification: false,
      artifact_read_performed_by_classification: false,
      artifact_write_performed_by_classification: false,
      protected_action_executed_by_classification: false,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "claim_action_classification_row_hash");
  });
}

function buildOwnerPreflightRows({ classificationRows }) {
  return classificationRows.map((classificationRow, index) => {
    const allowedOwner = ALLOWED_OWNERS.includes(classificationRow.responsible_owner);
    const reviewerMatchesOwner = classificationRow.reviewer_ref === classificationRow.responsible_owner;
    const ownerReady = classificationRow.classification_status === CLASSIFICATION_READY_STATUS
      && allowedOwner
      && reviewerMatchesOwner
      && classificationRow.action_owner_matches_responsible_owner;
    const row = {
      schema_version: "platform-claim-action-owner-preflight-row.v1",
      claim_action_owner_preflight_row_id: `platform-claim-action-owner-preflight.row.${classificationRow.source_phase_slot.toLowerCase()}`,
      phase_range: PHASE_RANGE,
      phase_slot: "P507",
      source_classification_row_id: classificationRow.claim_action_classification_row_id,
      source_phase_slot: classificationRow.source_phase_slot,
      claim_id: classificationRow.claim_id,
      claim_type: classificationRow.claim_type,
      responsible_owner: classificationRow.responsible_owner,
      reviewer_ref: classificationRow.reviewer_ref,
      owner_preflight_status: ownerReady ? OWNER_READY_STATUS : "blocked",
      allowed_owner: allowedOwner,
      reviewer_matches_owner: reviewerMatchesOwner,
      owner_receipt_required: true,
      owner_receipt_present: false,
      owner_ack_required: true,
      owner_ack_present: false,
      human_receipt_ref_required_before_action: true,
      current_execution_allowed: false,
      execution_feasible_after_valid_receipt: ownerReady,
      fail_closed_until_owner_receipt: true,
      blocked_state_preserved: true,
      command_execution_performed_by_owner_preflight: false,
      protected_action_executed_by_owner_preflight: false,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "claim_action_owner_preflight_row_hash");
  });
}

function buildProtectedBoundaryRows({ classificationRows }) {
  return classificationRows.map((classificationRow, index) => {
    const boundaryReady = classificationRow.classification_status === CLASSIFICATION_READY_STATUS
      && classificationRow.protected_claim
      && classificationRow.rerun_check_mode_only
      && !classificationRow.unsafe_enablement_requested
      && !classificationRow.current_execution_allowed;
    const row = {
      schema_version: "platform-claim-action-protected-boundary-row.v1",
      claim_action_protected_boundary_row_id: `platform-claim-action-protected-boundary.row.${classificationRow.source_phase_slot.toLowerCase()}`,
      phase_range: PHASE_RANGE,
      phase_slot: "P508",
      source_classification_row_id: classificationRow.claim_action_classification_row_id,
      source_phase_slot: classificationRow.source_phase_slot,
      claim_id: classificationRow.claim_id,
      claim_type: classificationRow.claim_type,
      target_command_name: classificationRow.target_command_name,
      rerun_command: classificationRow.rerun_command,
      protected_claim: classificationRow.protected_claim,
      protected_boundary_status: boundaryReady ? PROTECTED_BOUNDARY_READY_STATUS : "blocked",
      target_command_is_prior_evidence_only: true,
      rerun_command_check_only: classificationRow.rerun_check_mode_only,
      current_execution_allowed: false,
      future_rerun_allowed_after_valid_receipt: boundaryReady,
      package_command_execution_allowed_now: false,
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
      fail_closed_until_valid_receipt: true,
      blocked_state_preserved: true,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "claim_action_protected_boundary_row_hash");
  });
}

function buildEvidenceGapRows({ classificationRows }) {
  return classificationRows.map((classificationRow, index) => {
    const evidenceRefPresent = typeof classificationRow.evidence_ref === "string" && classificationRow.evidence_ref.startsWith("command-result:");
    const humanReceiptGateRefPresent = typeof classificationRow.gate_ref === "string" && classificationRow.gate_ref.includes("human-receipt-gate");
    const recoveryGateRefPresent = typeof classificationRow.gate_ref === "string" && classificationRow.gate_ref.includes("recovery-gate");
    const claimGateRefPresent = humanReceiptGateRefPresent || recoveryGateRefPresent;
    const reviewerRefPresent = Boolean(classificationRow.reviewer_ref);
    const gapReady = classificationRow.classification_status === CLASSIFICATION_READY_STATUS
      && evidenceRefPresent
      && claimGateRefPresent
      && reviewerRefPresent;
    const row = {
      schema_version: "platform-claim-action-evidence-gap-row.v1",
      claim_action_evidence_gap_row_id: `platform-claim-action-evidence-gap.row.${classificationRow.source_phase_slot.toLowerCase()}`,
      phase_range: PHASE_RANGE,
      phase_slot: "P509",
      source_classification_row_id: classificationRow.claim_action_classification_row_id,
      source_phase_slot: classificationRow.source_phase_slot,
      claim_id: classificationRow.claim_id,
      claim_type: classificationRow.claim_type,
      evidence_ref: classificationRow.evidence_ref,
      gate_ref: classificationRow.gate_ref,
      reviewer_ref: classificationRow.reviewer_ref,
      evidence_gap_status: gapReady ? EVIDENCE_GAP_READY_STATUS : "blocked",
      evidence_gap_open: true,
      command_result_evidence_ref_present: evidenceRefPresent,
      claim_gate_ref_present: claimGateRefPresent,
      human_receipt_gate_ref_present: humanReceiptGateRefPresent,
      recovery_gate_ref_present: recoveryGateRefPresent,
      reviewer_ref_present: reviewerRefPresent,
      missing_human_receipt_ref: true,
      missing_receipt_source_ref: true,
      missing_validated_receipt_payload: true,
      required_gap_resolution: "bind external receipt_source_ref and human_receipt_ref before any PASS candidate refresh",
      current_execution_allowed: false,
      execution_feasible_after_valid_receipt: gapReady,
      fail_closed_until_evidence_gap_resolved: true,
      blocked_state_preserved: true,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "claim_action_evidence_gap_row_hash");
  });
}

function buildCloseoutRows({ classificationRows, ownerPreflightRows, protectedBoundaryRows, evidenceGapRows }) {
  return classificationRows.map((classificationRow, index) => {
    const ownerRow = ownerPreflightRows[index];
    const protectedRow = protectedBoundaryRows[index];
    const evidenceRow = evidenceGapRows[index];
    const closeoutReady = classificationRow.classification_status === CLASSIFICATION_READY_STATUS
      && ownerRow.owner_preflight_status === OWNER_READY_STATUS
      && protectedRow.protected_boundary_status === PROTECTED_BOUNDARY_READY_STATUS
      && evidenceRow.evidence_gap_status === EVIDENCE_GAP_READY_STATUS;
    const row = {
      schema_version: "platform-claim-action-fail-closed-row.v1",
      claim_action_fail_closed_row_id: `platform-claim-action-fail-closed.row.${classificationRow.source_phase_slot.toLowerCase()}`,
      phase_range: PHASE_RANGE,
      phase_slot: "P510",
      source_phase_slot: classificationRow.source_phase_slot,
      claim_id: classificationRow.claim_id,
      claim_type: classificationRow.claim_type,
      responsible_owner: classificationRow.responsible_owner,
      target_command_name: classificationRow.target_command_name,
      rerun_command: classificationRow.rerun_command,
      fail_closed_status: closeoutReady ? CLOSEOUT_READY_STATUS : "blocked",
      classification_ready: classificationRow.classification_status === CLASSIFICATION_READY_STATUS,
      owner_preflight_ready: ownerRow.owner_preflight_status === OWNER_READY_STATUS,
      protected_boundary_ready: protectedRow.protected_boundary_status === PROTECTED_BOUNDARY_READY_STATUS,
      evidence_gap_index_ready: evidenceRow.evidence_gap_status === EVIDENCE_GAP_READY_STATUS,
      current_claim_status_after_closeout: "documented_block",
      current_execution_allowed: false,
      action_feasible_after_valid_receipt: closeoutReady,
      fail_closed_until_valid_receipt: true,
      fail_closed_until_owner_receipt: true,
      fail_closed_until_evidence_gap_resolved: true,
      next_adjudication_phase_slot: NEXT_PHASE_SLOT,
      blocked_state_preserved: true,
      receipt_validated: false,
      approval_applied: false,
      pass_promoted: false,
      command_execution_performed_by_closeout: false,
      protected_action_executed_by_closeout: false,
      human_review_required: true,
      human_signoff_required: true,
    };
    return withOrdinalAndHash(row, index, "claim_action_fail_closed_row_hash");
  });
}

function buildBoundary({ generatedAt, writeRequested, claimReceiptWorkspace, classificationRows, ownerPreflightRows, protectedBoundaryRows, evidenceGapRows, closeoutRows }) {
  return {
    schema_version: "platform-claim-action-feasibility-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    read_only: true,
    report_only: true,
    claim_adjudication_layer: true,
    source_claim_receipt_workspace_status: claimReceiptWorkspace.summary.platform_claim_receipt_workspace_status,
    source_claim_receipt_workspace_consumed_in_memory: true,
    source_claim_receipt_workspace_artifact_read_performed: false,
    claim_action_feasibility_write_requested: writeRequested,
    action_classification_row_count: classificationRows.length,
    ready_action_classification_row_count: classificationRows.filter((row) => row.classification_status === CLASSIFICATION_READY_STATUS).length,
    owner_preflight_row_count: ownerPreflightRows.length,
    ready_owner_preflight_row_count: ownerPreflightRows.filter((row) => row.owner_preflight_status === OWNER_READY_STATUS).length,
    protected_boundary_row_count: protectedBoundaryRows.length,
    ready_protected_boundary_row_count: protectedBoundaryRows.filter((row) => row.protected_boundary_status === PROTECTED_BOUNDARY_READY_STATUS).length,
    evidence_gap_row_count: evidenceGapRows.length,
    ready_evidence_gap_row_count: evidenceGapRows.filter((row) => row.evidence_gap_status === EVIDENCE_GAP_READY_STATUS).length,
    fail_closed_row_count: closeoutRows.length,
    ready_fail_closed_row_count: closeoutRows.filter((row) => row.fail_closed_status === CLOSEOUT_READY_STATUS).length,
    action_classification_declared: true,
    owner_preflight_declared: true,
    protected_boundary_declared: true,
    evidence_gap_index_declared: true,
    fail_closed_closeout_declared: true,
    target_package_script_registered_count: classificationRows.filter((row) => row.target_package_script_registered).length,
    check_mode_rerun_count: classificationRows.filter((row) => row.rerun_check_mode_only).length,
    open_evidence_gap_count: evidenceGapRows.filter((row) => row.evidence_gap_open).length,
    documented_block_retained_count: closeoutRows.filter((row) => row.current_claim_status_after_closeout === "documented_block").length,
    fail_closed_claim_count: closeoutRows.filter((row) => row.fail_closed_until_valid_receipt && row.fail_closed_until_owner_receipt && row.fail_closed_until_evidence_gap_resolved).length,
    current_action_execution_allowed: false,
    future_action_feasible_after_valid_receipt: closeoutRows.every((row) => row.action_feasible_after_valid_receipt),
    receipt_payload_present: false,
    receipt_source_registered: false,
    receipt_received: false,
    receipt_validated: false,
    approval_applied: false,
    ready_for_pass_promotion: false,
    pass_promoted: false,
    blocked_state_preserved: closeoutRows.every((row) => row.blocked_state_preserved && row.current_claim_status_after_closeout === "documented_block" && !row.pass_promoted),
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

function buildGateRows({ claimReceiptWorkspace, packageJson, claimAdjudicationLedger, classificationRows, ownerPreflightRows, protectedBoundaryRows, evidenceGapRows, closeoutRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = claimAdjudicationLedger.text ?? "";
  const rows = [
    gateRow("p502_p505_claim_receipt_workspace_ready", "P502-P505 claim receipt workspace source is ready.", claimReceiptWorkspace.validation.valid && claimReceiptWorkspace.summary.platform_claim_receipt_workspace_status === SOURCE_READY_STATUS),
    gateRow("p506_action_classification_rows_ready", "P506 classifies every documented BLOCK next_allowed_action without executing it.", classificationRows.length === EXPECTED_BLOCKED_CLAIMS && classificationRows.every((row) => row.classification_status === CLASSIFICATION_READY_STATUS && !row.current_execution_allowed)),
    gateRow("p507_owner_preflight_rows_ready", "P507 confirms every action is still owned and fail-closed pending owner receipt.", ownerPreflightRows.length === EXPECTED_BLOCKED_CLAIMS && ownerPreflightRows.every((row) => row.owner_preflight_status === OWNER_READY_STATUS && row.allowed_owner && row.reviewer_matches_owner && !row.owner_receipt_present && !row.current_execution_allowed)),
    gateRow("p508_protected_boundary_rows_ready", "P508 confirms protected action boundaries remain disabled and only check-mode reruns can be considered after valid receipt.", protectedBoundaryRows.length === EXPECTED_BLOCKED_CLAIMS && protectedBoundaryRows.every((row) => row.protected_boundary_status === PROTECTED_BOUNDARY_READY_STATUS && row.rerun_command_check_only && !row.current_execution_allowed && !row.protected_action_executed)),
    gateRow("p509_evidence_gap_rows_ready", "P509 indexes receipt evidence gaps while preserving command-result evidence and claim gates.", evidenceGapRows.length === EXPECTED_BLOCKED_CLAIMS && evidenceGapRows.every((row) => row.evidence_gap_status === EVIDENCE_GAP_READY_STATUS && row.evidence_gap_open && row.missing_human_receipt_ref && row.missing_receipt_source_ref && !row.current_execution_allowed)),
    gateRow("p510_fail_closed_rows_ready", "P510 closes feasibility as documented BLOCK until valid receipt, owner receipt, and evidence gaps are resolved.", closeoutRows.length === EXPECTED_BLOCKED_CLAIMS && closeoutRows.every((row) => row.fail_closed_status === CLOSEOUT_READY_STATUS && row.current_claim_status_after_closeout === "documented_block" && row.fail_closed_until_valid_receipt && !row.current_execution_allowed && !row.pass_promoted)),
    gateRow("target_and_rerun_commands_registered", "Every target command and check-mode rerun command is registered in package.json.", boundary.target_package_script_registered_count === EXPECTED_BLOCKED_CLAIMS && boundary.check_mode_rerun_count === EXPECTED_BLOCKED_CLAIMS),
    gateRow("blocked_state_preserved", "P506-P510 preserve documented BLOCK and do not promote claims without validated receipts.", boundary.blocked_state_preserved && boundary.documented_block_retained_count === EXPECTED_BLOCKED_CLAIMS && !boundary.pass_promoted && !boundary.ready_for_pass_promotion),
    gateRow("current_action_execution_disabled", "P506-P510 do not execute next_allowed_action, package commands, protected actions, or rerun commands.", !boundary.current_action_execution_allowed && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.protected_action_executed),
    gateRow("platform_package_script_registered", "package.json registers the P506-P510 claim action feasibility command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P506-P510 claim action feasibility command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p506_ledger_acceptance_declared", "P506 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P506: \`${COMMAND_NAME}\``)),
    gateRow("p507_ledger_acceptance_declared", "P507 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P507: \`${COMMAND_NAME}\``)),
    gateRow("p508_ledger_acceptance_declared", "P508 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P508: \`${COMMAND_NAME}\``)),
    gateRow("p509_ledger_acceptance_declared", "P509 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P509: \`${COMMAND_NAME}\``)),
    gateRow("p510_ledger_acceptance_declared", "P510 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P510: \`${COMMAND_NAME}\``)),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "claim_action_feasibility_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-claim-action-feasibility-gate-row.v1",
    claim_action_feasibility_gate_row_id: `platform-claim-action-feasibility.gate.${rowKey}`,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    current_action_execution_allowed: false,
    receipt_payload_present: false,
    receipt_received_by_feasibility: false,
    receipt_validated_by_feasibility: false,
    approval_applied_by_feasibility: false,
    pass_promoted_by_feasibility: false,
    protected_action_executed_by_feasibility: false,
    secret_exposure_allowed_by_feasibility: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ claimReceiptWorkspace, packageJson, claimAdjudicationLedger, classificationRows, ownerPreflightRows, protectedBoundaryRows, evidenceGapRows, closeoutRows, gateRows, boundary }) {
  return [
    validationItem("source.claim_receipt_workspace", "p502_p505_claim_receipt_workspace_ready", claimReceiptWorkspace.validation.valid && claimReceiptWorkspace.summary.platform_claim_receipt_workspace_status === SOURCE_READY_STATUS, "P502-P505 claim receipt workspace source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for P506-P510 registration and command checks."),
    validationItem("source.claim_adjudication_ledger", "claim_adjudication_ledger_available", claimAdjudicationLedger.available, "P501-P520 claim adjudication ledger is readable."),
    validationItem("claim_action_classification_rows", "classification_rows_ready", classificationRows.length === EXPECTED_BLOCKED_CLAIMS && classificationRows.every((row) => row.classification_status === CLASSIFICATION_READY_STATUS && row.action_family === "collect_external_human_receipt_then_rerun_freeze_check" && row.target_package_script_registered && row.rerun_package_script_registered && row.rerun_check_mode_only && row.external_human_receipt_collection_required && !row.current_execution_allowed), "P506 must classify every next_allowed_action as receipt collection plus check-mode freeze rerun without execution."),
    validationItem("claim_action_owner_preflight_rows", "owner_preflight_rows_ready", ownerPreflightRows.length === EXPECTED_BLOCKED_CLAIMS && ownerPreflightRows.every((row) => row.owner_preflight_status === OWNER_READY_STATUS && row.allowed_owner && row.reviewer_matches_owner && row.owner_receipt_required && !row.owner_receipt_present && row.fail_closed_until_owner_receipt && !row.current_execution_allowed), "P507 owner preflight must be ready and fail-closed until owner receipt exists."),
    validationItem("claim_action_protected_boundary_rows", "protected_boundary_rows_ready", protectedBoundaryRows.length === EXPECTED_BLOCKED_CLAIMS && protectedBoundaryRows.every((row) => row.protected_boundary_status === PROTECTED_BOUNDARY_READY_STATUS && row.protected_claim && row.rerun_command_check_only && !row.current_execution_allowed && !row.package_command_execution_allowed_now && !row.protected_action_executed && !row.trading_order_submission_allowed && !row.secret_exposure_allowed), "P508 protected boundaries must remain disabled."),
    validationItem("claim_action_evidence_gap_rows", "evidence_gap_rows_ready", evidenceGapRows.length === EXPECTED_BLOCKED_CLAIMS && evidenceGapRows.every((row) => row.evidence_gap_status === EVIDENCE_GAP_READY_STATUS && row.evidence_gap_open && row.command_result_evidence_ref_present && row.claim_gate_ref_present && row.missing_human_receipt_ref && row.missing_receipt_source_ref && row.fail_closed_until_evidence_gap_resolved), "P509 must index evidence gaps while fail-closing action execution."),
    validationItem("claim_action_fail_closed_rows", "fail_closed_rows_ready", closeoutRows.length === EXPECTED_BLOCKED_CLAIMS && closeoutRows.every((row) => row.fail_closed_status === CLOSEOUT_READY_STATUS && row.current_claim_status_after_closeout === "documented_block" && row.action_feasible_after_valid_receipt && row.fail_closed_until_valid_receipt && !row.current_execution_allowed && !row.pass_promoted), "P510 must close feasibility as documented BLOCK until valid receipts resolve gaps."),
    validationItem("claim_action_feasibility_gate_rows", "action_gates_ready", gateRows.length >= 17 && gateRows.every((row) => row.gate_status === "ready" && !row.current_action_execution_allowed && !row.receipt_validated_by_feasibility && !row.pass_promoted_by_feasibility && !row.protected_action_executed_by_feasibility), "P506-P510 gates must be ready without execution or PASS promotion."),
    validationItem("boundary.blocked_state_preserved", "blocked_state_preserved", boundary.blocked_state_preserved && boundary.documented_block_retained_count === EXPECTED_BLOCKED_CLAIMS && !boundary.receipt_validated && !boundary.approval_applied && !boundary.pass_promoted, "P506-P510 must preserve documented BLOCK state."),
    validationItem("boundary.no_execution_or_mutation", "no_execution_or_mutation", !boundary.current_action_execution_allowed && !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed && !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.protected_recovery_execution_allowed, "P506-P510 remain read-only/report-only."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed, "Trading, Desktop, and secret boundaries remain disabled."),
  ];
}

function buildSummary({ claimReceiptWorkspace, classificationRows, ownerPreflightRows, protectedBoundaryRows, evidenceGapRows, closeoutRows, gateRows, boundary, validation }) {
  return {
    platform_claim_action_feasibility_status: validation.valid ? READY_STATUS : "blocked",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_claim_receipt_workspace_status: claimReceiptWorkspace.summary.platform_claim_receipt_workspace_status,
    source_workspace_row_count: claimReceiptWorkspace.summary.workspace_row_count,
    action_classification_row_count: classificationRows.length,
    ready_action_classification_row_count: classificationRows.filter((row) => row.classification_status === CLASSIFICATION_READY_STATUS).length,
    owner_preflight_row_count: ownerPreflightRows.length,
    ready_owner_preflight_row_count: ownerPreflightRows.filter((row) => row.owner_preflight_status === OWNER_READY_STATUS).length,
    protected_boundary_row_count: protectedBoundaryRows.length,
    ready_protected_boundary_row_count: protectedBoundaryRows.filter((row) => row.protected_boundary_status === PROTECTED_BOUNDARY_READY_STATUS).length,
    evidence_gap_row_count: evidenceGapRows.length,
    ready_evidence_gap_row_count: evidenceGapRows.filter((row) => row.evidence_gap_status === EVIDENCE_GAP_READY_STATUS).length,
    fail_closed_row_count: closeoutRows.length,
    ready_fail_closed_row_count: closeoutRows.filter((row) => row.fail_closed_status === CLOSEOUT_READY_STATUS).length,
    action_gate_count: gateRows.length,
    ready_action_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    action_classification_declared: boundary.action_classification_declared,
    owner_preflight_declared: boundary.owner_preflight_declared,
    protected_boundary_declared: boundary.protected_boundary_declared,
    evidence_gap_index_declared: boundary.evidence_gap_index_declared,
    fail_closed_closeout_declared: boundary.fail_closed_closeout_declared,
    target_package_script_registered_count: boundary.target_package_script_registered_count,
    check_mode_rerun_count: boundary.check_mode_rerun_count,
    open_evidence_gap_count: boundary.open_evidence_gap_count,
    documented_block_retained_count: boundary.documented_block_retained_count,
    fail_closed_claim_count: boundary.fail_closed_claim_count,
    current_action_execution_allowed: boundary.current_action_execution_allowed,
    future_action_feasible_after_valid_receipt: boundary.future_action_feasible_after_valid_receipt,
    receipt_payload_present: boundary.receipt_payload_present,
    receipt_source_registered: boundary.receipt_source_registered,
    receipt_received: boundary.receipt_received,
    receipt_validated: boundary.receipt_validated,
    approval_applied: boundary.approval_applied,
    ready_for_pass_promotion: boundary.ready_for_pass_promotion,
    pass_promoted: boundary.pass_promoted,
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
    "# Platform Claim Action Feasibility",
    "",
    `Status: ${result.summary.platform_claim_action_feasibility_status}`,
    `Phase range: ${result.summary.phase_range}`,
    `Source workspace: ${result.summary.source_claim_receipt_workspace_status}`,
    `Classification rows: ${result.summary.ready_action_classification_row_count}/${result.summary.action_classification_row_count}`,
    `Owner preflight rows: ${result.summary.ready_owner_preflight_row_count}/${result.summary.owner_preflight_row_count}`,
    `Protected boundary rows: ${result.summary.ready_protected_boundary_row_count}/${result.summary.protected_boundary_row_count}`,
    `Evidence gap rows: ${result.summary.ready_evidence_gap_row_count}/${result.summary.evidence_gap_row_count}`,
    `Fail-closed rows: ${result.summary.ready_fail_closed_row_count}/${result.summary.fail_closed_row_count}`,
    `Action gates: ${result.summary.ready_action_gate_count}/${result.summary.action_gate_count}`,
    "",
    "## Action Samples",
    "",
    ...result.claim_action_classification_rows.slice(0, 12).map((row) => `- ${row.source_phase_slot} ${row.claim_id}: ${row.classification_status} (${row.target_command_name})`),
    "",
    "## Gates",
    "",
    ...result.claim_action_feasibility_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_CLAIM_ACTION_FEASIBILITY_OUT_DIR };
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
    else if (arg === "--claim-receipt-workspace-schema") parsed.claimReceiptWorkspaceSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-claim-action-feasibility.mjs [options]

Options:
  --out-dir <folder>                           Output directory. Default: ${DEFAULT_PLATFORM_CLAIM_ACTION_FEASIBILITY_OUT_DIR}
  --run-at <iso>                               Deterministic generated_at timestamp.
  --package <path>                             package.json path.
  --platform-ops-ledger <path>                 P341-P500 platform operations ledger path.
  --claim-adjudication-ledger <path>           P501-P520 claim adjudication ledger path.
  --operations-freeze-schema <path>            P500 operations freeze schema path.
  --claim-receipt-intake-contract-schema <path>
                                               P501 claim receipt intake contract schema path.
  --claim-receipt-workspace-schema <path>      P502-P505 claim receipt workspace schema path.
  --schema <path>                              Output schema path.
  --check                                      Validate only, do not write artifacts.
  -h, --help                                   Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_CLAIM_ACTION_FEASIBILITY_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_CLAIM_ACTION_FEASIBILITY_INPUTS.platformOpsLedgerPath),
    claim_adjudication_ledger_path: path.resolve(options.claimAdjudicationLedgerPath ?? DEFAULT_PLATFORM_CLAIM_ACTION_FEASIBILITY_INPUTS.claimAdjudicationLedgerPath),
    operations_freeze_schema_path: path.resolve(options.operationsFreezeSchemaPath ?? DEFAULT_PLATFORM_CLAIM_ACTION_FEASIBILITY_INPUTS.operationsFreezeSchemaPath),
    claim_receipt_intake_contract_schema_path: path.resolve(options.claimReceiptIntakeContractSchemaPath ?? DEFAULT_PLATFORM_CLAIM_ACTION_FEASIBILITY_INPUTS.claimReceiptIntakeContractSchemaPath),
    claim_receipt_workspace_schema_path: path.resolve(options.claimReceiptWorkspaceSchemaPath ?? DEFAULT_PLATFORM_CLAIM_ACTION_FEASIBILITY_INPUTS.claimReceiptWorkspaceSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_CLAIM_ACTION_FEASIBILITY_INPUTS.schemaPath),
  };
}

function parseNextAllowedAction(actionText) {
  const match = ACTION_PATTERN.exec(actionText ?? "");
  return match?.groups ?? null;
}

function detectUnsafeEnablement(actionText) {
  const normalized = String(actionText ?? "").toLowerCase();
  return [
    "enable live",
    "enable full auto",
    "submit order",
    "place order",
    "broker write",
    "exchange write",
    "read secret",
    "credential lookup",
    "read .env",
    "desktop mutation",
  ].some((phrase) => normalized.includes(phrase));
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
    validation_item_id: `platform-claim-action-feasibility.${slugify(itemPath)}.${checkId}`,
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

function hashRows(rows, keys) {
  return hashValue(rows.map((row) => Object.fromEntries(keys.map((key) => [key, row[key]]))));
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
