import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformOperationsFreeze } from "./platform-operations-freeze.mjs";
import {
  DEFAULT_PLATFORM_CLAIM_OPERATOR_SURFACE_INPUTS,
  buildPlatformClaimOperatorSurface,
} from "./platform-claim-operator-surface.mjs";

export const DEFAULT_PLATFORM_CLAIM_RECEIPT_VERDICT_REFRESH_OUT_DIR = "artifacts/platform-claim-receipt-verdict-refresh/latest";
export const DEFAULT_PLATFORM_CLAIM_RECEIPT_VERDICT_REFRESH_INPUTS = {
  ...DEFAULT_PLATFORM_CLAIM_OPERATOR_SURFACE_INPUTS,
  claimOperatorSurfaceSchemaPath: DEFAULT_PLATFORM_CLAIM_OPERATOR_SURFACE_INPUTS.schemaPath,
  claimReceiptInputPath: "artifacts/platform-claim-receipts/latest/claim-receipts.json",
  schemaPath: "schemas/platform-claim-receipt-verdict-refresh.schema.json",
};

const COMMAND_NAME = "platform:claim-receipt-verdict-refresh";
const SCHEMA_VERSION = "platform-claim-receipt-verdict-refresh.v1";
const CAPABILITY_ID = "platform.claim_receipt_verdict_refresh";
const PHASE_RANGE = "P516-P520";
const PHASE_SLOT = "P516";
const PREVIOUS_PHASE_SLOT = "P515";
const NEXT_PHASE_SLOT = "complete";
const OPERATIONS_FREEZE_READY_STATUS = "ready_for_claim_freeze";
const OPERATOR_SURFACE_READY_STATUS = "ready_for_claim_operator_surface";
const READY_STATUS = "ready_for_claim_receipt_verdict_refresh";
const VALIDATION_READY_STATUS = "ready_for_claim_receipt_validation_refresh";
const BINDING_READY_STATUS = "ready_for_claim_receipt_binding_refresh";
const PASS_CANDIDATE_READY_STATUS = "ready_for_receipt_backed_pass_candidate_plan";
const BLOCK_RETENTION_READY_STATUS = "ready_for_documented_block_retention";
const CLOSEOUT_READY_STATUS = "ready_for_claim_adjudication_closeout";
const EXPECTED_BLOCKED_CLAIMS = 40;

export async function runPlatformClaimReceiptVerdictRefresh(options = {}) {
  const result = await buildPlatformClaimReceiptVerdictRefresh(options);
  if (options.write !== false) await writePlatformClaimReceiptVerdictRefresh(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform claim receipt verdict refresh failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformClaimReceiptVerdictRefresh(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_VERDICT_REFRESH_OUT_DIR);
  const inputs = normalizeInputs(options);
  const operationsFreeze = await buildPlatformOperationsFreeze({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    schemaPath: inputs.operations_freeze_schema_path,
    write: false,
  });
  const claimOperatorSurface = await buildPlatformClaimOperatorSurface({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    claimAdjudicationLedgerPath: inputs.claim_adjudication_ledger_path,
    operationsFreezeSchemaPath: inputs.operations_freeze_schema_path,
    claimReceiptIntakeContractSchemaPath: inputs.claim_receipt_intake_contract_schema_path,
    claimReceiptWorkspaceSchemaPath: inputs.claim_receipt_workspace_schema_path,
    claimActionFeasibilitySchemaPath: inputs.claim_action_feasibility_schema_path,
    reviewApiSourcePath: inputs.review_api_source_path,
    reviewDashboardSourcePath: inputs.review_dashboard_source_path,
    reviewApiDocPath: inputs.review_api_doc_path,
    schemaPath: inputs.claim_operator_surface_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const claimAdjudicationLedger = await readTextSource(inputs.claim_adjudication_ledger_path);
  const receiptInput = await readJsonSource(inputs.claim_receipt_input_path);
  const receiptRows = extractReceiptRows(receiptInput.data);
  const blockedClaims = (operationsFreeze.operations_freeze_claim_registry_rows ?? []).filter((row) => row.verdict === "blocked");
  const receiptValidationRows = buildReceiptValidationRows({ blockedClaims, receiptRows });
  const bindingRows = buildReceiptBindingRows({ receiptValidationRows });
  const passCandidateRows = buildPassCandidateRows({ receiptValidationRows, bindingRows });
  const blockRetentionRows = buildBlockRetentionRows({ blockedClaims, passCandidateRows });
  const closeoutRows = buildCloseoutRows({
    receiptValidationRows,
    bindingRows,
    passCandidateRows,
    blockRetentionRows,
  });
  const boundary = buildBoundary({
    generatedAt,
    writeRequested: options.write !== false,
    operationsFreeze,
    claimOperatorSurface,
    receiptInput,
    blockedClaims,
    receiptValidationRows,
    bindingRows,
    passCandidateRows,
    blockRetentionRows,
    closeoutRows,
  });
  const anchor = buildAnchor({
    operationsFreeze,
    claimOperatorSurface,
    packageJson,
    claimAdjudicationLedger,
    receiptInput,
    receiptRows,
    receiptValidationRows,
    bindingRows,
    passCandidateRows,
    blockRetentionRows,
    closeoutRows,
  });
  const gateRows = buildGateRows({
    operationsFreeze,
    claimOperatorSurface,
    packageJson,
    claimAdjudicationLedger,
    receiptValidationRows,
    bindingRows,
    passCandidateRows,
    blockRetentionRows,
    closeoutRows,
    boundary,
  });
  const validationItems = buildValidationItems({
    operationsFreeze,
    claimOperatorSurface,
    packageJson,
    claimAdjudicationLedger,
    receiptValidationRows,
    bindingRows,
    passCandidateRows,
    blockRetentionRows,
    closeoutRows,
    gateRows,
    boundary,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    operationsFreeze,
    claimOperatorSurface,
    receiptInput,
    receiptRows,
    receiptValidationRows,
    bindingRows,
    passCandidateRows,
    blockRetentionRows,
    closeoutRows,
    gateRows,
    boundary,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_claim_receipt_verdict_refresh_id: `platform-claim-receipt-verdict-refresh.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    claim_receipt_verdict_refresh_anchor: anchor,
    claim_receipt_validation_rows: receiptValidationRows,
    claim_receipt_binding_rows: bindingRows,
    claim_pass_candidate_rows: passCandidateRows,
    claim_documented_block_retention_rows: blockRetentionRows,
    claim_adjudication_closeout_rows: closeoutRows,
    claim_receipt_verdict_refresh_gate_rows: gateRows,
    claim_receipt_verdict_refresh_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_claim_receipt_verdict_refresh") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    operationsFreeze,
    claimOperatorSurface,
    receiptInput,
    receiptRows,
    receiptValidationRows,
    bindingRows,
    passCandidateRows,
    blockRetentionRows,
    closeoutRows,
    gateRows,
    boundary,
    validation: result.validation,
  });
  result.summary.platform_claim_receipt_verdict_refresh_id = result.platform_claim_receipt_verdict_refresh_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformClaimReceiptVerdictRefresh(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-claim-receipt-verdict-refresh.json"), serializableResult(result));
  await writeJson(path.join(outDir, "claim-receipt-validation-rows.json"), collectionEnvelope("platform-claim-receipt-validation-rows.v1", "claim_receipt_validation_rows", result.claim_receipt_validation_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-receipt-binding-rows.json"), collectionEnvelope("platform-claim-receipt-binding-rows.v1", "claim_receipt_binding_rows", result.claim_receipt_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-pass-candidate-rows.json"), collectionEnvelope("platform-claim-pass-candidate-rows.v1", "claim_pass_candidate_rows", result.claim_pass_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-documented-block-retention-rows.json"), collectionEnvelope("platform-claim-documented-block-retention-rows.v1", "claim_documented_block_retention_rows", result.claim_documented_block_retention_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-adjudication-closeout-rows.json"), collectionEnvelope("platform-claim-adjudication-closeout-rows.v1", "claim_adjudication_closeout_rows", result.claim_adjudication_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-receipt-verdict-refresh-gate-rows.json"), collectionEnvelope("platform-claim-receipt-verdict-refresh-gate-rows.v1", "claim_receipt_verdict_refresh_gate_rows", result.claim_receipt_verdict_refresh_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "claim-receipt-verdict-refresh-boundary.json"), result.claim_receipt_verdict_refresh_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-claim-receipt-verdict-refresh-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformClaimReceiptVerdictRefreshCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformClaimReceiptVerdictRefresh(args);
    console.log(`Platform claim receipt verdict refresh ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_claim_receipt_verdict_refresh_status}`);
    console.log(`Receipt validation rows: ${result.summary.ready_receipt_validation_row_count}/${result.summary.receipt_validation_row_count}`);
    console.log(`Binding rows: ${result.summary.ready_receipt_binding_row_count}/${result.summary.receipt_binding_row_count}`);
    console.log(`PASS candidates: ${result.summary.pass_candidate_count}`);
    console.log(`Documented BLOCK retained: ${result.summary.documented_block_retained_count}`);
    console.log(`Closeout gates: ${result.summary.ready_verdict_refresh_gate_count}/${result.summary.verdict_refresh_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildAnchor({ operationsFreeze, claimOperatorSurface, packageJson, claimAdjudicationLedger, receiptInput, receiptRows, receiptValidationRows, bindingRows, passCandidateRows, blockRetentionRows, closeoutRows }) {
  return {
    schema_version: "platform-claim-receipt-verdict-refresh-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_operations_freeze_id: operationsFreeze.platform_operations_freeze_id,
    source_operations_freeze_status: operationsFreeze.summary.platform_operations_freeze_status,
    source_claim_operator_surface_id: claimOperatorSurface.platform_claim_operator_surface_id,
    source_claim_operator_surface_status: claimOperatorSurface.summary.platform_claim_operator_surface_status,
    claim_receipt_input_available: receiptInput.available,
    input_receipt_count: receiptRows.length,
    receipt_validation_row_count: receiptValidationRows.length,
    receipt_binding_row_count: bindingRows.length,
    pass_candidate_row_count: passCandidateRows.length,
    block_retention_row_count: blockRetentionRows.length,
    closeout_row_count: closeoutRows.length,
    package_json_hash: packageJson.content_hash,
    claim_adjudication_ledger_hash: claimAdjudicationLedger.content_hash,
    receipt_input_hash: receiptInput.content_hash,
    receipt_validation_rows_hash: hashRows(receiptValidationRows, ["claim_id", "receipt_validation_status", "validated_receipt"]),
    receipt_binding_rows_hash: hashRows(bindingRows, ["claim_id", "receipt_binding_status", "receipt_to_claim_binding_valid"]),
    pass_candidate_rows_hash: hashRows(passCandidateRows, ["claim_id", "pass_candidate_status", "pass_candidate"]),
    block_retention_rows_hash: hashRows(blockRetentionRows, ["claim_id", "block_retention_status", "retained_verdict"]),
  };
}

function buildReceiptValidationRows({ blockedClaims, receiptRows }) {
  const receiptByClaim = new Map();
  for (const receipt of receiptRows) {
    const key = receiptKey(receipt);
    if (key && !receiptByClaim.has(key)) receiptByClaim.set(key, receipt);
  }
  return blockedClaims.map((claim, index) => {
    const receipt = receiptByClaim.get(receiptKey(claim)) ?? null;
    const validation = validateReceiptForClaim(receipt, claim);
    const row = {
      schema_version: "platform-claim-receipt-validation-row.v1",
      claim_receipt_validation_row_id: `platform-claim-receipt-validation.row.${claim.source_phase_slot.toLowerCase()}`,
      phase_range: PHASE_RANGE,
      phase_slot: "P516",
      source_phase_slot: claim.source_phase_slot,
      source_phase_number: claim.source_phase_number,
      source_command_name: claim.source_command_name,
      claim_id: claim.claim_id,
      claim_type: claim.claim_type,
      responsible_owner: claim.responsible_owner,
      protected_claim: claim.protected_claim,
      current_verdict: claim.current_verdict,
      current_block_reason: claim.block_reason,
      next_allowed_action: claim.next_allowed_action,
      receipt_id: receipt?.receipt_id ?? null,
      human_receipt_ref: receipt?.human_receipt_ref ?? null,
      receipt_source_ref: receipt?.receipt_source_ref ?? null,
      receipt_actor: receipt?.receipt_actor ?? null,
      receipt_decision: receipt?.receipt_decision ?? null,
      receipt_status: receipt?.receipt_status ?? null,
      receipt_signed_at: receipt?.receipt_signed_at ?? null,
      receipt_evidence_refs: Array.isArray(receipt?.receipt_evidence_refs) ? receipt.receipt_evidence_refs : [],
      receipt_payload_present: Boolean(receipt),
      receipt_validation_status: validation.status,
      receipt_required_fields_present: validation.requiredFieldsPresent,
      receipt_claim_matches_frozen_claim: validation.claimMatches,
      human_receipt_ref_format_valid: validation.refFormatValid,
      receipt_decision_approves_pass_candidate: validation.decisionApproves,
      receipt_evidence_refs_present: validation.evidenceRefsPresent,
      validated_receipt: validation.validatedReceipt,
      invalid_receipt_quarantined: validation.invalidReceiptQuarantined,
      ready_for_binding_validation: validation.validatedReceipt,
      ready_for_pass_candidate_evaluation: validation.validatedReceipt,
      receipt_auto_created_by_harness: false,
      claim_verdict_mutation_performed: false,
      pass_promotion_performed: false,
      protected_action_executed: false,
      blocked_state_preserved: !validation.validatedReceipt,
      read_only: true,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "claim_receipt_validation_row_hash");
  });
}

function buildReceiptBindingRows({ receiptValidationRows }) {
  return receiptValidationRows.map((validationRow, index) => {
    const bindingValid = validationRow.validated_receipt
      && validationRow.receipt_claim_matches_frozen_claim
      && validationRow.human_receipt_ref_format_valid;
    const row = {
      schema_version: "platform-claim-receipt-binding-row.v1",
      claim_receipt_binding_row_id: `platform-claim-receipt-binding.row.${validationRow.source_phase_slot.toLowerCase()}`,
      phase_range: PHASE_RANGE,
      phase_slot: "P517",
      source_validation_row_id: validationRow.claim_receipt_validation_row_id,
      source_phase_slot: validationRow.source_phase_slot,
      source_phase_number: validationRow.source_phase_number,
      claim_id: validationRow.claim_id,
      claim_type: validationRow.claim_type,
      human_receipt_ref: validationRow.human_receipt_ref,
      receipt_source_ref: validationRow.receipt_source_ref,
      receipt_binding_status: bindingValid
        ? "bound_to_frozen_claim"
        : validationRow.receipt_payload_present
          ? "binding_blocked_invalid_receipt"
          : "waiting_for_receipt_binding",
      frozen_claim_row_present: true,
      receipt_payload_present: validationRow.receipt_payload_present,
      validated_receipt: validationRow.validated_receipt,
      binds_to_frozen_claim_id: bindingValid,
      binds_to_source_phase_slot: bindingValid,
      receipt_to_claim_binding_valid: bindingValid,
      binding_validation_failed_closed: !bindingValid,
      ready_for_pass_candidate_evaluation: bindingValid,
      claim_verdict_mutation_performed: false,
      pass_promotion_performed: false,
      protected_action_executed: false,
      read_only: true,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "claim_receipt_binding_row_hash");
  });
}

function buildPassCandidateRows({ receiptValidationRows, bindingRows }) {
  const bindingByClaim = new Map(bindingRows.map((row) => [row.claim_id, row]));
  return receiptValidationRows.map((validationRow, index) => {
    const bindingRow = bindingByClaim.get(validationRow.claim_id);
    const passCandidate = Boolean(
      validationRow.validated_receipt
      && validationRow.receipt_decision_approves_pass_candidate
      && bindingRow?.receipt_to_claim_binding_valid,
    );
    const row = {
      schema_version: "platform-claim-pass-candidate-row.v1",
      claim_pass_candidate_row_id: `platform-claim-pass-candidate.row.${validationRow.source_phase_slot.toLowerCase()}`,
      phase_range: PHASE_RANGE,
      phase_slot: "P518",
      source_validation_row_id: validationRow.claim_receipt_validation_row_id,
      source_binding_row_id: bindingRow?.claim_receipt_binding_row_id ?? null,
      source_phase_slot: validationRow.source_phase_slot,
      source_phase_number: validationRow.source_phase_number,
      claim_id: validationRow.claim_id,
      claim_type: validationRow.claim_type,
      current_verdict: validationRow.current_verdict,
      refreshed_verdict: passCandidate ? "pass_candidate" : "blocked",
      pass_candidate_status: passCandidate ? PASS_CANDIDATE_READY_STATUS : "blocked_until_valid_receipt",
      validated_receipt: validationRow.validated_receipt,
      receipt_to_claim_binding_valid: Boolean(bindingRow?.receipt_to_claim_binding_valid),
      receipt_decision_approves_pass_candidate: validationRow.receipt_decision_approves_pass_candidate,
      pass_candidate: passCandidate,
      pass_candidate_reason: passCandidate ? "validated_human_receipt_bound_to_claim" : "missing_validated_human_receipt",
      pass_without_valid_receipt: passCandidate && !validationRow.validated_receipt,
      pass_without_receipt_binding: passCandidate && !bindingRow?.receipt_to_claim_binding_valid,
      pass_promotion_planned: passCandidate,
      pass_promotion_performed: false,
      claim_registry_mutation_performed: false,
      protected_action_executed: false,
      trading_order_submission_allowed: false,
      desktop_mutation_allowed: false,
      secret_exposure_allowed: false,
      read_only: true,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "claim_pass_candidate_row_hash");
  });
}

function buildBlockRetentionRows({ blockedClaims, passCandidateRows }) {
  const candidateByClaim = new Map(passCandidateRows.map((row) => [row.claim_id, row]));
  return blockedClaims.map((claim, index) => {
    const candidate = candidateByClaim.get(claim.claim_id);
    const retained = !candidate?.pass_candidate;
    const row = {
      schema_version: "platform-claim-documented-block-retention-row.v1",
      claim_documented_block_retention_row_id: `platform-claim-documented-block-retention.row.${claim.source_phase_slot.toLowerCase()}`,
      phase_range: PHASE_RANGE,
      phase_slot: "P519",
      source_phase_slot: claim.source_phase_slot,
      source_phase_number: claim.source_phase_number,
      source_command_name: claim.source_command_name,
      claim_id: claim.claim_id,
      claim_type: claim.claim_type,
      responsible_owner: claim.responsible_owner,
      protected_claim: claim.protected_claim,
      retained_verdict: retained ? "blocked" : "pass_candidate",
      block_retention_status: retained ? BLOCK_RETENTION_READY_STATUS : "released_to_receipt_backed_pass_candidate",
      documented_block_retained: retained,
      current_block_reason: claim.block_reason,
      next_allowed_action: claim.next_allowed_action,
      owner_and_next_action_retained: Boolean(claim.responsible_owner && claim.next_allowed_action),
      pass_candidate: Boolean(candidate?.pass_candidate),
      pass_without_valid_receipt: Boolean(candidate?.pass_without_valid_receipt),
      pass_promotion_performed: false,
      claim_registry_mutation_performed: false,
      protected_action_executed: false,
      read_only: true,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "claim_documented_block_retention_row_hash");
  });
}

function buildCloseoutRows({ receiptValidationRows, bindingRows, passCandidateRows, blockRetentionRows }) {
  const passCandidateCount = passCandidateRows.filter((row) => row.pass_candidate).length;
  const retainedBlockCount = blockRetentionRows.filter((row) => row.documented_block_retained).length;
  const passWithoutValidReceiptCount = passCandidateRows.filter((row) => row.pass_without_valid_receipt || row.pass_without_receipt_binding).length;
  const ready = receiptValidationRows.length === EXPECTED_BLOCKED_CLAIMS
    && bindingRows.length === EXPECTED_BLOCKED_CLAIMS
    && passCandidateRows.length === EXPECTED_BLOCKED_CLAIMS
    && blockRetentionRows.length === EXPECTED_BLOCKED_CLAIMS
    && passCandidateCount + retainedBlockCount === EXPECTED_BLOCKED_CLAIMS
    && passWithoutValidReceiptCount === 0;
  const row = {
    schema_version: "platform-claim-adjudication-closeout-row.v1",
    claim_adjudication_closeout_row_id: "platform-claim-adjudication-closeout.p520",
    phase_range: PHASE_RANGE,
    phase_slot: "P520",
    row_key: "p520_claim_adjudication_closeout",
    closeout_status: ready ? CLOSEOUT_READY_STATUS : "blocked",
    validated_receipt_count: receiptValidationRows.filter((item) => item.validated_receipt).length,
    bound_receipt_count: bindingRows.filter((item) => item.receipt_to_claim_binding_valid).length,
    pass_candidate_count: passCandidateCount,
    documented_block_retained_count: retainedBlockCount,
    pass_without_valid_receipt_count: passWithoutValidReceiptCount,
    pass_promotion_performed: false,
    claim_registry_mutation_performed: false,
    receipt_auto_created_by_harness: false,
    protected_action_executed: false,
    final_adjudication_phase_slot: "P520",
    read_only: true,
    human_review_required: true,
  };
  return [withOrdinalAndHash(row, 0, "claim_adjudication_closeout_row_hash")];
}

function buildBoundary({ generatedAt, writeRequested, operationsFreeze, claimOperatorSurface, receiptInput, blockedClaims, receiptValidationRows, bindingRows, passCandidateRows, blockRetentionRows, closeoutRows }) {
  const passCandidateCount = passCandidateRows.filter((row) => row.pass_candidate).length;
  const documentedBlockRetainedCount = blockRetentionRows.filter((row) => row.documented_block_retained).length;
  return {
    schema_version: "platform-claim-receipt-verdict-refresh-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    read_only: true,
    report_only: true,
    claim_adjudication_layer: true,
    source_operations_freeze_status: operationsFreeze.summary.platform_operations_freeze_status,
    source_claim_operator_surface_status: claimOperatorSurface.summary.platform_claim_operator_surface_status,
    claim_receipt_verdict_refresh_write_requested: writeRequested,
    claim_receipt_input_available: receiptInput.available,
    source_blocked_claim_count: blockedClaims.length,
    receipt_validation_row_count: receiptValidationRows.length,
    ready_receipt_validation_row_count: receiptValidationRows.length,
    receipt_binding_row_count: bindingRows.length,
    ready_receipt_binding_row_count: bindingRows.length,
    pass_candidate_row_count: passCandidateRows.length,
    block_retention_row_count: blockRetentionRows.length,
    closeout_row_count: closeoutRows.length,
    validated_receipt_count: receiptValidationRows.filter((row) => row.validated_receipt).length,
    invalid_receipt_count: receiptValidationRows.filter((row) => row.invalid_receipt_quarantined).length,
    bound_receipt_count: bindingRows.filter((row) => row.receipt_to_claim_binding_valid).length,
    pass_candidate_count: passCandidateCount,
    documented_block_retained_count: documentedBlockRetainedCount,
    pass_without_valid_receipt_count: passCandidateRows.filter((row) => row.pass_without_valid_receipt || row.pass_without_receipt_binding).length,
    claims_without_validated_receipt_remain_blocked: documentedBlockRetainedCount + passCandidateCount === EXPECTED_BLOCKED_CLAIMS,
    receipt_auto_created_by_harness: false,
    receipt_source_registered_by_harness: false,
    claim_registry_mutation_performed: false,
    source_claim_registry_mutated: false,
    command_execution_performed: false,
    package_command_execution_performed: false,
    server_started: false,
    route_mutation_performed: false,
    generated_artifact_read_performed: false,
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

function buildGateRows({ operationsFreeze, claimOperatorSurface, packageJson, claimAdjudicationLedger, receiptValidationRows, bindingRows, passCandidateRows, blockRetentionRows, closeoutRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = claimAdjudicationLedger.text ?? "";
  const rows = [
    gateRow("p500_claim_freeze_ready", "P500 frozen claim registry source is ready.", operationsFreeze.validation.valid && operationsFreeze.summary.platform_operations_freeze_status === OPERATIONS_FREEZE_READY_STATUS),
    gateRow("p511_p515_operator_surface_ready", "P511-P515 operator claim surface is ready.", claimOperatorSurface.validation.valid && claimOperatorSurface.summary.platform_claim_operator_surface_status === OPERATOR_SURFACE_READY_STATUS),
    gateRow("p516_receipt_validation_rows_ready", "P516 receipt validation rows cover every documented BLOCK claim.", receiptValidationRows.length === EXPECTED_BLOCKED_CLAIMS),
    gateRow("p517_receipt_binding_rows_ready", "P517 receipt-to-claim binding rows cover every documented BLOCK claim.", bindingRows.length === EXPECTED_BLOCKED_CLAIMS),
    gateRow("p518_pass_candidate_rows_ready", "P518 pass-candidate rows cannot mark PASS without validated receipts.", passCandidateRows.length === EXPECTED_BLOCKED_CLAIMS && passCandidateRows.every((row) => !row.pass_candidate || (row.validated_receipt && row.receipt_to_claim_binding_valid && row.receipt_decision_approves_pass_candidate))),
    gateRow("p519_block_retention_rows_ready", "P519 block-retention rows preserve claims without validated receipts.", blockRetentionRows.length === EXPECTED_BLOCKED_CLAIMS && blockRetentionRows.every((row) => row.pass_candidate || (row.documented_block_retained && row.owner_and_next_action_retained))),
    gateRow("p520_closeout_ready", "P520 closeout balances PASS candidates and retained BLOCK claims.", closeoutRows.length === 1 && closeoutRows.every((row) => row.closeout_status === CLOSEOUT_READY_STATUS && row.pass_without_valid_receipt_count === 0)),
    gateRow("platform_package_script_registered", "package.json registers the P516-P520 claim receipt verdict refresh command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the P516-P520 claim receipt verdict refresh command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p516_ledger_acceptance_declared", "P516 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P516: \`${COMMAND_NAME}\``)),
    gateRow("p517_ledger_acceptance_declared", "P517 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P517: \`${COMMAND_NAME}\``)),
    gateRow("p518_ledger_acceptance_declared", "P518 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P518: \`${COMMAND_NAME}\``)),
    gateRow("p519_ledger_acceptance_declared", "P519 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P519: \`${COMMAND_NAME}\``)),
    gateRow("p520_ledger_acceptance_declared", "P520 acceptance row is declared in the claim adjudication ledger.", ledgerText.includes(`P520: \`${COMMAND_NAME}\``)),
    gateRow("no_receipt_auto_creation", "Harness does not auto-create human receipts.", !boundary.receipt_auto_created_by_harness && !boundary.receipt_source_registered_by_harness),
    gateRow("no_pass_without_valid_receipt", "No PASS candidate exists without validated receipt and binding.", boundary.pass_without_valid_receipt_count === 0),
    gateRow("no_execution_or_mutation", "Verdict refresh remains read-only/report-only without source registry mutation.", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.server_started && !boundary.route_mutation_performed && !boundary.artifact_write_performed && !boundary.package_mutation_performed && !boundary.claim_registry_mutation_performed && !boundary.protected_action_executed),
    gateRow("trading_desktop_secret_boundaries", "Trading, Desktop, and secret boundaries remain disabled.", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "claim_receipt_verdict_refresh_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-claim-receipt-verdict-refresh-gate-row.v1",
    claim_receipt_verdict_refresh_gate_row_id: `platform-claim-receipt-verdict-refresh.gate.${rowKey}`,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    read_only: true,
    receipt_auto_created_by_harness: false,
    pass_promoted_without_receipt: false,
    claim_registry_mutation_performed: false,
    protected_action_executed: false,
    secret_exposure_allowed: false,
    human_review_required: true,
    human_signoff_required: true,
  };
}

function buildValidationItems({ operationsFreeze, claimOperatorSurface, packageJson, claimAdjudicationLedger, receiptValidationRows, bindingRows, passCandidateRows, blockRetentionRows, closeoutRows, gateRows, boundary }) {
  return [
    validationItem("source.operations_freeze", "p500_claim_freeze_ready", operationsFreeze.validation.valid && operationsFreeze.summary.platform_operations_freeze_status === OPERATIONS_FREEZE_READY_STATUS, "P500 claim freeze source must be ready."),
    validationItem("source.claim_operator_surface", "p511_p515_operator_surface_ready", claimOperatorSurface.validation.valid && claimOperatorSurface.summary.platform_claim_operator_surface_status === OPERATOR_SURFACE_READY_STATUS, "P511-P515 operator surface source must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable."),
    validationItem("source.claim_adjudication_ledger", "claim_adjudication_ledger_available", claimAdjudicationLedger.available, "P501-P520 claim adjudication ledger is readable."),
    validationItem("claim_receipt_validation_rows", "receipt_validation_rows_ready", receiptValidationRows.length === EXPECTED_BLOCKED_CLAIMS, "P516 receipt validation rows must cover all documented BLOCK claims."),
    validationItem("claim_receipt_binding_rows", "receipt_binding_rows_ready", bindingRows.length === EXPECTED_BLOCKED_CLAIMS, "P517 binding rows must cover all documented BLOCK claims."),
    validationItem("claim_pass_candidate_rows", "pass_candidate_rows_ready", passCandidateRows.length === EXPECTED_BLOCKED_CLAIMS && passCandidateRows.every((row) => !row.pass_candidate || (row.validated_receipt && row.receipt_to_claim_binding_valid && row.receipt_decision_approves_pass_candidate)), "P518 PASS candidates must be receipt-backed."),
    validationItem("claim_documented_block_retention_rows", "block_retention_rows_ready", blockRetentionRows.length === EXPECTED_BLOCKED_CLAIMS && blockRetentionRows.every((row) => row.pass_candidate || (row.documented_block_retained && row.owner_and_next_action_retained)), "P519 documented BLOCK rows must be retained when receipt is missing."),
    validationItem("claim_adjudication_closeout_rows", "claim_adjudication_closeout_ready", closeoutRows.length === 1 && closeoutRows.every((row) => row.closeout_status === CLOSEOUT_READY_STATUS && row.pass_without_valid_receipt_count === 0), "P520 closeout must be ready."),
    validationItem("claim_receipt_verdict_refresh_gate_rows", "verdict_refresh_gates_ready", gateRows.length >= 18 && gateRows.every((row) => row.gate_status === "ready" && !row.pass_promoted_without_receipt && !row.protected_action_executed), "P516-P520 gates must be ready."),
    validationItem("boundary.no_receipt_auto_creation", "no_receipt_auto_creation", !boundary.receipt_auto_created_by_harness && !boundary.receipt_source_registered_by_harness, "Human receipts must not be auto-created."),
    validationItem("boundary.no_pass_without_valid_receipt", "no_pass_without_valid_receipt", boundary.pass_without_valid_receipt_count === 0, "PASS candidates must require validated receipt and binding."),
    validationItem("boundary.no_execution_or_mutation", "no_execution_or_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.server_started && !boundary.route_mutation_performed && !boundary.artifact_write_performed && !boundary.package_mutation_performed && !boundary.claim_registry_mutation_performed && !boundary.protected_action_executed, "P516-P520 remain read-only/report-only."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed, "Trading, Desktop, and secret boundaries remain disabled."),
  ];
}

function buildSummary({ operationsFreeze, claimOperatorSurface, receiptInput, receiptRows, receiptValidationRows, bindingRows, passCandidateRows, blockRetentionRows, closeoutRows, gateRows, boundary, validation }) {
  return {
    platform_claim_receipt_verdict_refresh_status: validation.valid ? READY_STATUS : "blocked",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_operations_freeze_status: operationsFreeze.summary.platform_operations_freeze_status,
    source_claim_operator_surface_status: claimOperatorSurface.summary.platform_claim_operator_surface_status,
    source_claim_count: operationsFreeze.summary.claim_count,
    source_blocked_claim_count: operationsFreeze.summary.blocked_claim_count,
    source_pass_claim_count: operationsFreeze.summary.pass_claim_count,
    claim_receipt_input_available: receiptInput.available,
    input_receipt_count: receiptRows.length,
    receipt_validation_row_count: receiptValidationRows.length,
    ready_receipt_validation_row_count: receiptValidationRows.length,
    receipt_binding_row_count: bindingRows.length,
    ready_receipt_binding_row_count: bindingRows.length,
    pass_candidate_row_count: passCandidateRows.length,
    ready_pass_candidate_row_count: passCandidateRows.length,
    block_retention_row_count: blockRetentionRows.length,
    ready_block_retention_row_count: blockRetentionRows.length,
    closeout_row_count: closeoutRows.length,
    ready_closeout_row_count: closeoutRows.filter((row) => row.closeout_status === CLOSEOUT_READY_STATUS).length,
    verdict_refresh_gate_count: gateRows.length,
    ready_verdict_refresh_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    validated_receipt_count: boundary.validated_receipt_count,
    invalid_receipt_count: boundary.invalid_receipt_count,
    bound_receipt_count: boundary.bound_receipt_count,
    pass_candidate_count: boundary.pass_candidate_count,
    documented_block_retained_count: boundary.documented_block_retained_count,
    pass_without_valid_receipt_count: boundary.pass_without_valid_receipt_count,
    claims_without_validated_receipt_remain_blocked: boundary.claims_without_validated_receipt_remain_blocked,
    receipt_auto_created_by_harness: boundary.receipt_auto_created_by_harness,
    receipt_source_registered_by_harness: boundary.receipt_source_registered_by_harness,
    claim_registry_mutation_performed: boundary.claim_registry_mutation_performed,
    source_claim_registry_mutated: boundary.source_claim_registry_mutated,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    command_execution_performed: boundary.command_execution_performed,
    package_command_execution_performed: boundary.package_command_execution_performed,
    server_started: boundary.server_started,
    route_mutation_performed: boundary.route_mutation_performed,
    artifact_write_performed: boundary.artifact_write_performed,
    package_mutation_performed: boundary.package_mutation_performed,
    protected_action_executed: boundary.protected_action_executed,
    trading_order_submission_allowed: boundary.trading_order_submission_allowed,
    desktop_mutation_allowed: boundary.desktop_mutation_allowed,
    secret_exposure_allowed: boundary.secret_exposure_allowed,
    validation_error_count: validation.errors.length,
  };
}

function validateReceiptForClaim(receipt, claim) {
  if (!receipt) {
    return {
      status: "waiting_for_external_receipt",
      requiredFieldsPresent: false,
      claimMatches: false,
      refFormatValid: false,
      decisionApproves: false,
      evidenceRefsPresent: false,
      validatedReceipt: false,
      invalidReceiptQuarantined: false,
    };
  }
  const requiredFieldsPresent = Boolean(
    receipt.receipt_id
    && receipt.claim_id
    && receipt.source_phase_slot
    && receipt.human_receipt_ref
    && receipt.receipt_source_ref
    && receipt.receipt_actor
    && receipt.receipt_decision
    && receipt.receipt_status
    && receipt.receipt_signed_at,
  );
  const claimMatches = receipt.claim_id === claim.claim_id && receipt.source_phase_slot === claim.source_phase_slot;
  const refFormatValid = typeof receipt.human_receipt_ref === "string"
    && receipt.human_receipt_ref.startsWith(`human-receipt:${claim.source_phase_slot}:${claim.claim_id}:`);
  const decisionApproves = receipt.receipt_decision === "approve_claim_pass_candidate";
  const evidenceRefsPresent = Array.isArray(receipt.receipt_evidence_refs) && receipt.receipt_evidence_refs.length > 0;
  const statusValid = receipt.receipt_status === "validated";
  const validatedReceipt = requiredFieldsPresent && claimMatches && refFormatValid && decisionApproves && evidenceRefsPresent && statusValid;
  return {
    status: validatedReceipt ? "validated_for_claim_adjudication" : "quarantined_invalid_receipt",
    requiredFieldsPresent,
    claimMatches,
    refFormatValid,
    decisionApproves,
    evidenceRefsPresent,
    validatedReceipt,
    invalidReceiptQuarantined: !validatedReceipt,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Claim Receipt Verdict Refresh",
    "",
    `Status: ${result.summary.platform_claim_receipt_verdict_refresh_status}`,
    `Phase range: ${result.summary.phase_range}`,
    `Validated receipts: ${result.summary.validated_receipt_count}`,
    `PASS candidates: ${result.summary.pass_candidate_count}`,
    `Documented BLOCK retained: ${result.summary.documented_block_retained_count}`,
    `Gates: ${result.summary.ready_verdict_refresh_gate_count}/${result.summary.verdict_refresh_gate_count}`,
    "",
    "## Closeout",
    "",
    ...result.claim_adjudication_closeout_rows.map((row) => `- ${row.row_key}: ${row.closeout_status}, PASS candidates ${row.pass_candidate_count}, retained BLOCK ${row.documented_block_retained_count}`),
    "",
    "## Gates",
    "",
    ...result.claim_receipt_verdict_refresh_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function extractReceiptRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.receipts)) return data.receipts;
  if (Array.isArray(data.claim_receipts)) return data.claim_receipts;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function receiptKey(row) {
  if (!row?.source_phase_slot || !row?.claim_id) return null;
  return `${row.source_phase_slot}:${row.claim_id}`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_CLAIM_RECEIPT_VERDICT_REFRESH_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--claim-adjudication-ledger") parsed.claimAdjudicationLedgerPath = argv[++index];
    else if (arg === "--claim-receipt-input") parsed.claimReceiptInputPath = argv[++index];
    else if (arg === "--operations-freeze-schema") parsed.operationsFreezeSchemaPath = argv[++index];
    else if (arg === "--claim-receipt-intake-contract-schema") parsed.claimReceiptIntakeContractSchemaPath = argv[++index];
    else if (arg === "--claim-receipt-workspace-schema") parsed.claimReceiptWorkspaceSchemaPath = argv[++index];
    else if (arg === "--claim-action-feasibility-schema") parsed.claimActionFeasibilitySchemaPath = argv[++index];
    else if (arg === "--claim-operator-surface-schema") parsed.claimOperatorSurfaceSchemaPath = argv[++index];
    else if (arg === "--review-api-source") parsed.reviewApiSourcePath = argv[++index];
    else if (arg === "--review-dashboard-source") parsed.reviewDashboardSourcePath = argv[++index];
    else if (arg === "--review-api-doc") parsed.reviewApiDocPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-claim-receipt-verdict-refresh.mjs [options]

Options:
  --out-dir <folder>                           Output directory. Default: ${DEFAULT_PLATFORM_CLAIM_RECEIPT_VERDICT_REFRESH_OUT_DIR}
  --run-at <iso>                               Deterministic generated_at timestamp.
  --package <path>                             package.json path.
  --platform-ops-ledger <path>                 P341-P500 platform operations ledger path.
  --claim-adjudication-ledger <path>           P501-P520 claim adjudication ledger path.
  --claim-receipt-input <path>                 Optional external claim receipt input JSON path.
  --operations-freeze-schema <path>            P500 operations freeze schema path.
  --claim-receipt-intake-contract-schema <path>
                                               P501 claim receipt intake contract schema path.
  --claim-receipt-workspace-schema <path>      P502-P505 claim receipt workspace schema path.
  --claim-action-feasibility-schema <path>     P506-P510 claim action feasibility schema path.
  --claim-operator-surface-schema <path>       P511-P515 claim operator surface schema path.
  --review-api-source <path>                   Review API source path.
  --review-dashboard-source <path>             Review Dashboard source path.
  --review-api-doc <path>                      Review API docs path.
  --schema <path>                              Output schema path.
  --check                                      Validate only, do not write artifacts.
  -h, --help                                   Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_VERDICT_REFRESH_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_VERDICT_REFRESH_INPUTS.platformOpsLedgerPath),
    claim_adjudication_ledger_path: path.resolve(options.claimAdjudicationLedgerPath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_VERDICT_REFRESH_INPUTS.claimAdjudicationLedgerPath),
    claim_receipt_input_path: path.resolve(options.claimReceiptInputPath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_VERDICT_REFRESH_INPUTS.claimReceiptInputPath),
    operations_freeze_schema_path: path.resolve(options.operationsFreezeSchemaPath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_VERDICT_REFRESH_INPUTS.operationsFreezeSchemaPath),
    claim_receipt_intake_contract_schema_path: path.resolve(options.claimReceiptIntakeContractSchemaPath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_VERDICT_REFRESH_INPUTS.claimReceiptIntakeContractSchemaPath),
    claim_receipt_workspace_schema_path: path.resolve(options.claimReceiptWorkspaceSchemaPath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_VERDICT_REFRESH_INPUTS.claimReceiptWorkspaceSchemaPath),
    claim_action_feasibility_schema_path: path.resolve(options.claimActionFeasibilitySchemaPath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_VERDICT_REFRESH_INPUTS.claimActionFeasibilitySchemaPath),
    claim_operator_surface_schema_path: path.resolve(options.claimOperatorSurfaceSchemaPath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_VERDICT_REFRESH_INPUTS.claimOperatorSurfaceSchemaPath),
    review_api_source_path: path.resolve(options.reviewApiSourcePath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_VERDICT_REFRESH_INPUTS.reviewApiSourcePath),
    review_dashboard_source_path: path.resolve(options.reviewDashboardSourcePath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_VERDICT_REFRESH_INPUTS.reviewDashboardSourcePath),
    review_api_doc_path: path.resolve(options.reviewApiDocPath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_VERDICT_REFRESH_INPUTS.reviewApiDocPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_CLAIM_RECEIPT_VERDICT_REFRESH_INPUTS.schemaPath),
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
    const data = JSON.parse(text);
    return {
      path: filePath,
      available: true,
      data,
      content_hash: hashValue(data),
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

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function validationItem(pathName, check, passed, message) {
  return {
    path: pathName,
    check,
    passed,
    message: passed ? "ok" : message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => !item.passed)
    .map((item) => ({ path: item.path, message: item.message, check: item.check }));
  return { valid: errors.length === 0, errors };
}

function withOrdinalAndHash(row, index, hashField) {
  const withOrdinal = { ...row, ordinal: index + 1 };
  return { ...withOrdinal, [hashField]: hashValue(withOrdinal) };
}

function hashRows(rows, keys) {
  return hashValue(rows.map((row) => Object.fromEntries(keys.map((key) => [key, row[key]]))));
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}
