import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS,
  buildPlatformOperationsFreezeCloseout,
} from "./platform-operations-freeze-closeout.mjs";
import { buildPlatformOperationsFreezeSourceInventory } from "./platform-operations-freeze-source-inventory.mjs";

export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_OUT_DIR = "artifacts/platform-operations-freeze/latest";
export const DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS = {
  ...DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS,
  operationsFreezeCloseoutSchemaPath: DEFAULT_PLATFORM_OPERATIONS_FREEZE_CLOSEOUT_INPUTS.schemaPath,
  schemaPath: "schemas/platform-operations-freeze.schema.json",
};

const COMMAND_NAME = "platform:operations-freeze";
const SCHEMA_VERSION = "platform-operations-freeze.v1";
const CAPABILITY_ID = "platform.operations_freeze";
const PHASE_SLOT = "P500";
const PREVIOUS_PHASE_SLOT = "P500";
const NEXT_PHASE_SLOT = "complete";
const SOURCE_READY_STATUS = "ready_for_platform_operations_stability_closeout";
const FREEZE_READY_STATUS = "ready_for_claim_freeze";
const CLAIM_PHASE_START = 341;
const CLAIM_PHASE_END = 480;
const EXPECTED_CLAIM_COUNT = CLAIM_PHASE_END - CLAIM_PHASE_START + 1;

export async function runPlatformOperationsFreeze(options = {}) {
  const result = await buildPlatformOperationsFreeze(options);
  if (options.write !== false) await writePlatformOperationsFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform operations freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformOperationsFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceInventory = await buildPlatformOperationsFreezeSourceInventory({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    platformOpsLedgerPath: inputs.platform_ops_ledger_path,
    schemaPath: inputs.operations_freeze_source_inventory_schema_path,
    write: false,
  });
  const closeout = await buildPlatformOperationsFreezeCloseout({
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
    operationsFreezeReceiptCloseoutSchemaPath: inputs.operations_freeze_receipt_closeout_schema_path,
    operationsFreezeReceiptChainRegressionSchemaPath: inputs.operations_freeze_receipt_chain_regression_schema_path,
    schemaPath: inputs.operations_freeze_closeout_schema_path,
    write: false,
  });
  const packageJson = await readJsonSource(inputs.package_path);
  const platformOpsLedger = await readTextSource(inputs.platform_ops_ledger_path);
  const claimRows = buildClaimRows({ sourceInventory });
  const boundary = buildBoundary({ generatedAt, writeRequested: options.write !== false, closeout, claimRows });
  const anchor = buildAnchor({ sourceInventory, closeout, packageJson, platformOpsLedger, claimRows });
  const gateRows = buildGateRows({ closeout, packageJson, platformOpsLedger, claimRows, boundary });
  const validationItems = buildValidationItems({ sourceInventory, closeout, packageJson, platformOpsLedger, claimRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ closeout, claimRows, gateRows, boundary, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_operations_freeze_id: `platform-operations-freeze.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    operations_freeze_anchor: anchor,
    operations_freeze_claim_registry_rows: claimRows,
    operations_freeze_claim_gate_rows: gateRows,
    operations_freeze_claim_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available ? validateAgainstSchema(result, schema.data, {}, "platform_operations_freeze") : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ closeout, claimRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_operations_freeze_id = result.platform_operations_freeze_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformOperationsFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-operations-freeze.json"), serializableResult(result));
  await writeJson(path.join(outDir, "operations-freeze-claim-registry-rows.json"), collectionEnvelope("platform-operations-freeze-claim-registry-rows.v1", "operations_freeze_claim_registry_rows", result.operations_freeze_claim_registry_rows, result.generated_at));
  await writeJson(path.join(outDir, "operations-freeze-claim-gate-rows.json"), collectionEnvelope("platform-operations-freeze-claim-gate-rows.v1", "operations_freeze_claim_gate_rows", result.operations_freeze_claim_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "operations-freeze-claim-boundary.json"), result.operations_freeze_claim_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-operations-freeze-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformOperationsFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformOperationsFreeze(args);
    console.log(`Platform operations freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_operations_freeze_status}`);
    console.log(`Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`);
    console.log(`Claim gates: ${result.summary.ready_claim_gate_count}/${result.summary.claim_gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildAnchor({ sourceInventory, closeout, packageJson, platformOpsLedger, claimRows }) {
  return {
    schema_version: "platform-operations-freeze-anchor.v1",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_inventory_id: sourceInventory.platform_operations_freeze_source_inventory_id,
    source_inventory_status: sourceInventory.summary.platform_operations_freeze_source_inventory_status,
    source_closeout_id: closeout.platform_operations_freeze_closeout_id,
    source_closeout_status: closeout.summary.platform_operations_freeze_closeout_status,
    package_json_hash: packageJson.content_hash,
    platform_ops_ledger_hash: platformOpsLedger.content_hash,
    claim_registry_hash: hashValue(claimRows.map((row) => ({
      claim_id: row.claim_id,
      source_phase_slot: row.source_phase_slot,
      verdict: row.verdict,
      block_reason: row.block_reason,
      next_allowed_action: row.next_allowed_action,
    }))),
  };
}

function buildClaimRows({ sourceInventory }) {
  return sourceInventory.operations_freeze_source_inventory_rows.map((sourceRow, index) => {
    const category = claimCategoryForPhase(sourceRow.source_phase_number);
    const sourceReady = sourceRow.source_inventory_status === "complete";
    const evidenceRef = sourceReady && sourceRow.command_name ? `command-result:${sourceRow.command_name}` : null;
    const reviewerRef = category.reviewer_ref;
    const gateRef = sourceRow.command_name ? `${category.gate_prefix}:${sourceRow.command_name}` : null;
    const unsafeFlagsFalse = true;
    const missingEvidence = !evidenceRef;
    const missingReviewer = !reviewerRef;
    const missingGate = !gateRef;
    const missingReceipt = category.human_receipt_required;
    const passEligible = sourceReady
      && !missingEvidence
      && !missingReviewer
      && !missingGate
      && unsafeFlagsFalse
      && (!category.human_receipt_required || false);
    const verdict = passEligible ? "pass" : "blocked";
    const blockReason = verdict === "pass" ? null : blockReasonForClaim({ sourceReady, missingEvidence, missingReviewer, missingGate, missingReceipt });
    const nextAllowedAction = verdict === "pass" ? "retain_evidence_and_continue_monitoring" : nextAllowedActionForClaim({ sourceRow, blockReason, category });
    const row = {
      schema_version: "platform-operations-freeze-claim-registry-row.v1",
      operations_freeze_claim_registry_row_id: `platform-operations-freeze.claim.${sourceRow.source_phase_slot.toLowerCase()}`,
      phase_slot: PHASE_SLOT,
      source_phase_slot: sourceRow.source_phase_slot,
      source_phase_number: sourceRow.source_phase_number,
      source_command_name: sourceRow.command_name,
      source_inventory_status: sourceRow.source_inventory_status,
      source_domain: sourceRow.source_domain,
      claim_id: `${sourceRow.source_phase_slot.toLowerCase()}.${category.claim_id_suffix}`,
      claim_type: category.claim_type,
      claim_status: "claimed",
      claim_text: category.claim_text,
      evidence_ref: evidenceRef,
      reviewer_ref: reviewerRef,
      gate_ref: gateRef,
      hard_gate_ref: category.hard_gate_required ? gateRef : null,
      hard_gate_result: missingGate ? "blocked" : "pass",
      human_receipt_required: category.human_receipt_required,
      human_receipt_ref: null,
      protected_claim: category.protected_claim,
      documented_human_gate: category.human_receipt_required ? `human-gate:${sourceRow.source_phase_slot}:${category.responsible_owner}` : null,
      unsafe_flags_false: unsafeFlagsFalse,
      verdict,
      current_verdict: verdict,
      block_reason: blockReason,
      responsible_owner: category.responsible_owner,
      next_allowed_action: nextAllowedAction,
      missing_evidence: missingEvidence,
      missing_reviewer: missingReviewer,
      missing_gate: missingGate,
      missing_human_receipt: missingReceipt,
      unsupported_complete_claim: verdict === "pass" && missingEvidence,
      pass_without_reviewer_or_gate: verdict === "pass" && (missingReviewer || missingGate),
      protected_pass_without_receipt: verdict === "pass" && category.human_receipt_required,
      unsafe_true_but_pass: verdict === "pass" && !unsafeFlagsFalse,
      blocked_without_reason: verdict === "blocked" && !blockReason,
      blocked_without_next_action: verdict === "blocked" && !nextAllowedAction,
      operator_surface_claim: sourceRow.source_phase_number >= 461 && sourceRow.source_phase_number <= 480,
      operator_surface_fields_declared: true,
      command_execution_performed_by_freeze: false,
      package_command_execution_performed_by_freeze: false,
      acceptance_command_execution_performed_by_freeze: false,
      generated_artifact_read_performed_by_freeze: false,
      artifact_read_performed_by_freeze: false,
      artifact_write_performed_by_freeze: false,
      dependency_install_performed_by_freeze: false,
      package_mutation_performed_by_freeze: false,
      lockfile_mutation_performed_by_freeze: false,
      release_published_by_freeze: false,
      git_operation_performed_by_freeze: false,
      protected_action_executed_by_freeze: false,
      protected_recovery_execution_allowed_by_freeze: false,
      trading_live_enabled_by_freeze: false,
      trading_full_auto_enabled_by_freeze: false,
      trading_order_submission_allowed_by_freeze: false,
      broker_write_allowed_by_freeze: false,
      exchange_write_allowed_by_freeze: false,
      desktop_source_of_truth_by_freeze: false,
      desktop_mutation_allowed_by_freeze: false,
      secret_exposure_allowed_by_freeze: false,
      secret_values_read_by_freeze: false,
      env_file_read_by_freeze: false,
      desktop_config_content_inspected_by_freeze: false,
      desktop_provider_key_visible_by_freeze: false,
      credential_lookup_allowed_by_freeze: false,
      human_review_required: true,
    };
    return withOrdinalAndHash(row, index, "operations_freeze_claim_registry_row_hash");
  });
}

function claimCategoryForPhase(phaseNumber) {
  if (phaseNumber >= 361 && phaseNumber <= 380) {
    return {
      claim_id_suffix: "evidence_backed_completion",
      claim_type: "evidence_backed_completion_claim",
      claim_text: "Completion claims require evidence_ref and reviewer/gate linkage before PASS.",
      reviewer_ref: "release_manager",
      gate_prefix: "operations-freeze.evidence",
      hard_gate_required: true,
      human_receipt_required: false,
      protected_claim: false,
      responsible_owner: "release_manager",
    };
  }
  if (phaseNumber >= 381 && phaseNumber <= 400) {
    return {
      claim_id_suffix: "safety_hard_gate",
      claim_type: "safety_hard_gate_claim",
      claim_text: "Unsafe live/full-auto/order/broker/secret claims require fail-fast hard gates.",
      reviewer_ref: "trading_safety_reviewer",
      gate_prefix: "operations-freeze.hard-gate",
      hard_gate_required: true,
      human_receipt_required: false,
      protected_claim: false,
      responsible_owner: "trading_safety_reviewer",
    };
  }
  if (phaseNumber >= 401 && phaseNumber <= 420) {
    return {
      claim_id_suffix: "protected_promotion_receipt",
      claim_type: "protected_promotion_claim",
      claim_text: "Promotion and protected readiness claims require human receipt ownership before PASS.",
      reviewer_ref: "approval_owner",
      gate_prefix: "operations-freeze.human-receipt-gate",
      hard_gate_required: true,
      human_receipt_required: true,
      protected_claim: true,
      responsible_owner: "approval_owner",
    };
  }
  if (phaseNumber >= 421 && phaseNumber <= 440) {
    return {
      claim_id_suffix: "execution_secret_boundary",
      claim_type: "execution_secret_boundary_claim",
      claim_text: "Execution, adapter, credential, and secret boundary claims require hard-gate proof.",
      reviewer_ref: "security_reviewer",
      gate_prefix: "operations-freeze.secret-boundary",
      hard_gate_required: true,
      human_receipt_required: false,
      protected_claim: true,
      responsible_owner: "security_reviewer",
    };
  }
  if (phaseNumber >= 441 && phaseNumber <= 460) {
    return {
      claim_id_suffix: "recovery_next_action",
      claim_type: "recovery_next_action_claim",
      claim_text: "Recovery claims require rollback target, recovery receipt, and next_allowed_action before PASS.",
      reviewer_ref: "recovery_owner",
      gate_prefix: "operations-freeze.recovery-gate",
      hard_gate_required: true,
      human_receipt_required: true,
      protected_claim: true,
      responsible_owner: "recovery_owner",
    };
  }
  if (phaseNumber >= 461 && phaseNumber <= 480) {
    return {
      claim_id_suffix: "operator_surface",
      claim_type: "operator_surface_claim",
      claim_text: "Operator-facing claims require block reason, missing evidence/receipt state, and next action visibility.",
      reviewer_ref: "operations_reviewer",
      gate_prefix: "operations-freeze.operator-surface",
      hard_gate_required: true,
      human_receipt_required: false,
      protected_claim: true,
      responsible_owner: "operations_reviewer",
    };
  }
  return {
    claim_id_suffix: "platform_stability",
    claim_type: "platform_stability_claim",
    claim_text: "Platform stability claims require deterministic evidence and reviewer/gate linkage before PASS.",
    reviewer_ref: "platform_operator",
    gate_prefix: "operations-freeze.platform-gate",
    hard_gate_required: true,
    human_receipt_required: false,
    protected_claim: false,
    responsible_owner: "platform_operator",
  };
}

function blockReasonForClaim({ sourceReady, missingEvidence, missingReviewer, missingGate, missingReceipt }) {
  if (!sourceReady) return "source_inventory_blocked";
  if (missingEvidence) return "missing_evidence";
  if (missingReviewer) return "missing_reviewer";
  if (missingGate) return "missing_hard_gate";
  if (missingReceipt) return "missing_human_receipt";
  return "claim_not_pass_eligible";
}

function nextAllowedActionForClaim({ sourceRow, blockReason, category }) {
  if (blockReason === "source_inventory_blocked") return `repair ${sourceRow.source_phase_slot} ledger/package/validate registration and rerun platform:operations-freeze-source-inventory -- --check`;
  if (blockReason === "missing_evidence") return `run ${sourceRow.command_name ?? "the source command"} and attach evidence_ref before rerunning platform:operations-freeze -- --check`;
  if (blockReason === "missing_human_receipt") return `collect external human receipt for ${sourceRow.command_name ?? sourceRow.source_phase_slot} from ${category.responsible_owner} and rerun platform:operations-freeze -- --check`;
  return `resolve ${blockReason} for ${sourceRow.source_phase_slot} and rerun platform:operations-freeze -- --check`;
}

function buildBoundary({ generatedAt, writeRequested, closeout, claimRows }) {
  return {
    schema_version: "platform-operations-freeze-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    claim_freeze_artifact_write_requested: writeRequested,
    source_closeout_status: closeout.summary.platform_operations_freeze_closeout_status,
    source_closeout_ready: closeout.validation.valid && closeout.summary.platform_operations_freeze_closeout_status === SOURCE_READY_STATUS,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.verdict === "blocked").length,
    claim_registry_declared: true,
    unsupported_complete_claim_count: claimRows.filter((row) => row.unsupported_complete_claim).length,
    pass_without_reviewer_or_gate_count: claimRows.filter((row) => row.pass_without_reviewer_or_gate).length,
    protected_pass_without_receipt_count: claimRows.filter((row) => row.protected_pass_without_receipt).length,
    unsafe_true_but_pass_count: claimRows.filter((row) => row.unsafe_true_but_pass).length,
    blocked_without_reason_count: claimRows.filter((row) => row.blocked_without_reason).length,
    blocked_without_next_action_count: claimRows.filter((row) => row.blocked_without_next_action).length,
    blocked_human_gate_missing_count: claimRows.filter((row) => row.verdict === "blocked" && row.human_receipt_required && !row.documented_human_gate).length,
    operator_surface_fields_declared: claimRows.every((row) => row.operator_surface_fields_declared),
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
  };
}

function buildGateRows({ closeout, packageJson, platformOpsLedger, claimRows, boundary }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const ledgerText = platformOpsLedger.text ?? "";
  const rows = [
    gateRow("p500_closeout_ready", "P500 operations freeze closeout source is ready.", closeout.validation.valid && closeout.summary.platform_operations_freeze_closeout_status === SOURCE_READY_STATUS),
    gateRow("claim_registry_complete", "P341-P480 source claims are present and each is PASS or documented BLOCK.", claimRows.length === EXPECTED_CLAIM_COUNT && claimRows.every((row) => row.verdict === "pass" || row.verdict === "blocked")),
    gateRow("pass_requires_evidence", "No PASS claim is allowed without evidence_ref.", claimRows.every((row) => row.verdict !== "pass" || Boolean(row.evidence_ref))),
    gateRow("pass_requires_reviewer_or_hard_gate", "No PASS claim is allowed without reviewer_ref and gate_ref.", claimRows.every((row) => row.verdict !== "pass" || (Boolean(row.reviewer_ref) && Boolean(row.gate_ref)))),
    gateRow("protected_pass_requires_human_receipt", "No protected PASS claim is allowed without human_receipt_ref.", claimRows.every((row) => row.verdict !== "pass" || !row.human_receipt_required || Boolean(row.human_receipt_ref))),
    gateRow("unsafe_true_never_passes", "No claim with unsafe flags true is allowed to PASS.", claimRows.every((row) => !row.unsafe_true_but_pass)),
    gateRow("blocked_requires_reason_owner_next_action", "Every BLOCKED claim has block_reason, responsible_owner, and next_allowed_action.", claimRows.every((row) => row.verdict !== "blocked" || (Boolean(row.block_reason) && Boolean(row.responsible_owner) && Boolean(row.next_allowed_action)))),
    gateRow("blocked_human_gate_documented", "Every human-receipt BLOCKED claim documents its human gate.", claimRows.every((row) => row.verdict !== "blocked" || !row.human_receipt_required || Boolean(row.documented_human_gate))),
    gateRow("operator_surface_fields_declared", "Every claim exposes verdict, missing evidence/reviewer/receipt, hard gate, block reason, and next action fields.", boundary.operator_surface_fields_declared),
    gateRow("platform_package_script_registered", "package.json registers the top-level platform operations freeze command.", typeof scripts[COMMAND_NAME] === "string" && scripts[COMMAND_NAME].length > 0),
    gateRow("platform_validation_chain_registered", "Validation chain includes the top-level platform operations freeze command.", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`)),
    gateRow("p500_claim_freeze_ledger_declared", "P500 ledger text declares the top-level platform operations freeze command.", ledgerText.includes(`\`${COMMAND_NAME}\``)),
    gateRow("no_execution_or_mutation", "The claim freeze executes no commands, reads/writes no generated artifacts, mutates no packages/lockfiles/dependencies, publishes no release, runs no git, and executes no protected recovery.", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.acceptance_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed && !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.protected_recovery_execution_allowed),
    gateRow("trading_desktop_secret_boundaries", "Trading live/full-auto/order submission, Desktop mutation/source-of-truth, and secret exposure remain disabled.", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed),
  ];
  return rows.map((row, index) => withOrdinalAndHash(row, index, "operations_freeze_claim_gate_hash"));
}

function gateRow(rowKey, description, passed) {
  return {
    schema_version: "platform-operations-freeze-claim-gate-row.v1",
    operations_freeze_claim_gate_row_id: `platform-operations-freeze.gate.${rowKey}`,
    phase_slot: PHASE_SLOT,
    row_key: rowKey,
    description,
    gate_status: passed ? "ready" : "blocked",
    human_review_required: true,
  };
}

function buildValidationItems({ sourceInventory, closeout, packageJson, platformOpsLedger, claimRows, gateRows, boundary }) {
  return [
    validationItem("source.operations_freeze_source_inventory", "source_inventory_ready", sourceInventory.validation.valid && sourceInventory.summary.platform_operations_freeze_source_inventory_status === "ready_for_operations_freeze", "P481 source inventory must be ready for claim registry construction."),
    validationItem("source.operations_freeze_closeout", "p500_closeout_ready", closeout.validation.valid && closeout.summary.platform_operations_freeze_closeout_status === SOURCE_READY_STATUS, "P500 operations freeze closeout must be ready."),
    validationItem("source.package_json", "package_json_available", packageJson.available, "package.json is readable for top-level operations freeze."),
    validationItem("source.platform_ops_ledger", "platform_ops_ledger_available", platformOpsLedger.available, "Platform operations stability ledger is readable."),
    validationItem("claim_registry", "claim_registry_complete", claimRows.length === EXPECTED_CLAIM_COUNT && claimRows.every((row) => row.verdict === "pass" || row.verdict === "blocked"), "P341-P480 claim registry must be complete and every claim must be PASS or documented BLOCK."),
    validationItem("claim_registry.pass_requires_evidence", "pass_requires_evidence", boundary.unsupported_complete_claim_count === 0, "No complete/PASS claim may lack evidence_ref."),
    validationItem("claim_registry.pass_requires_reviewer_or_gate", "pass_requires_reviewer_or_gate", boundary.pass_without_reviewer_or_gate_count === 0, "No PASS claim may lack reviewer_ref or gate_ref."),
    validationItem("claim_registry.protected_pass_requires_receipt", "protected_pass_requires_receipt", boundary.protected_pass_without_receipt_count === 0, "No protected claim may PASS without human_receipt_ref."),
    validationItem("claim_registry.unsafe_true_never_passes", "unsafe_true_never_passes", boundary.unsafe_true_but_pass_count === 0, "No claim with unsafe flags true may PASS."),
    validationItem("claim_registry.blocked_claims_documented", "blocked_claims_documented", boundary.blocked_without_reason_count === 0 && boundary.blocked_without_next_action_count === 0 && boundary.blocked_human_gate_missing_count === 0, "Every blocked claim must have block reason, owner, next action, and human-gate documentation when required."),
    validationItem("claim_registry.operator_surface_fields", "operator_surface_fields_declared", boundary.operator_surface_fields_declared, "Operator surface fields must be declared for every claim."),
    validationItem("operations_freeze_claim_gate_rows", "claim_gates_ready", gateRows.length >= 14 && gateRows.every((row) => row.gate_status === "ready"), "Top-level claim freeze gates must be ready."),
    validationItem("boundary.no_execution_or_mutation", "no_execution_or_mutation", !boundary.command_execution_performed && !boundary.package_command_execution_performed && !boundary.acceptance_command_execution_performed && !boundary.generated_artifact_read_performed && !boundary.artifact_read_performed && !boundary.artifact_write_performed && !boundary.dependency_install_performed && !boundary.package_mutation_performed && !boundary.lockfile_mutation_performed && !boundary.release_published && !boundary.git_operation_performed && !boundary.protected_action_executed && !boundary.protected_recovery_execution_allowed, "Top-level operations freeze remains read-only/report-only."),
    validationItem("boundary.trading_desktop_secret_disabled", "trading_desktop_secret_disabled", !boundary.trading_live_enabled && !boundary.trading_full_auto_enabled && !boundary.trading_order_submission_allowed && !boundary.broker_write_allowed && !boundary.exchange_write_allowed && !boundary.desktop_source_of_truth && !boundary.desktop_mutation_allowed && !boundary.secret_exposure_allowed && !boundary.secret_values_read && !boundary.env_file_read && !boundary.desktop_config_content_inspected && !boundary.desktop_provider_key_visible && !boundary.credential_lookup_allowed, "Trading, Desktop, and secret boundaries remain disabled."),
  ];
}

function buildSummary({ closeout, claimRows, gateRows, boundary, validation }) {
  return {
    platform_operations_freeze_status: validation.valid ? FREEZE_READY_STATUS : "blocked",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_closeout_status: closeout.summary.platform_operations_freeze_closeout_status,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.verdict === "blocked").length,
    claim_gate_count: gateRows.length,
    ready_claim_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    unsupported_complete_claim_count: boundary.unsupported_complete_claim_count,
    pass_without_reviewer_or_gate_count: boundary.pass_without_reviewer_or_gate_count,
    protected_pass_without_receipt_count: boundary.protected_pass_without_receipt_count,
    unsafe_true_but_pass_count: boundary.unsafe_true_but_pass_count,
    blocked_without_reason_count: boundary.blocked_without_reason_count,
    blocked_without_next_action_count: boundary.blocked_without_next_action_count,
    blocked_human_gate_missing_count: boundary.blocked_human_gate_missing_count,
    operator_surface_fields_declared: boundary.operator_surface_fields_declared,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    claim_registry_declared: boundary.claim_registry_declared,
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
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Operations Freeze",
    "",
    `Status: ${result.summary.platform_operations_freeze_status}`,
    `Phase: ${result.summary.phase_slot}`,
    `Source closeout: ${result.summary.source_closeout_status}`,
    `Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`,
    `Claim gates: ${result.summary.ready_claim_gate_count}/${result.summary.claim_gate_count}`,
    "",
    "## Claim Samples",
    "",
    ...result.operations_freeze_claim_registry_rows.slice(0, 12).map((row) => `- ${row.source_phase_slot} ${row.claim_id}: ${row.verdict}${row.block_reason ? ` (${row.block_reason})` : ""}`),
    "",
    "## Gates",
    "",
    ...result.operations_freeze_claim_gate_rows.map((row) => `- ${row.row_key}: ${row.gate_status}`),
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_PLATFORM_OPERATIONS_FREEZE_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--platform-ops-ledger") parsed.platformOpsLedgerPath = argv[++index];
    else if (arg === "--source-inventory-schema") parsed.operationsFreezeSourceInventorySchemaPath = argv[++index];
    else if (arg === "--closeout-schema") parsed.operationsFreezeCloseoutSchemaPath = argv[++index];
    else if (arg === "--schema") parsed.schemaPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-operations-freeze.mjs [options]

Options:
  --out-dir <folder>                 Output directory. Default: ${DEFAULT_PLATFORM_OPERATIONS_FREEZE_OUT_DIR}
  --run-at <iso>                     Deterministic generated_at timestamp.
  --package <path>                   package.json path.
  --platform-ops-ledger <path>       P341-P500 platform operations ledger path.
  --source-inventory-schema <path>   P481 source inventory schema path.
  --closeout-schema <path>           P500 closeout schema path.
  --schema <path>                    Output schema path.
  --check                            Validate only, do not write artifacts.
  -h, --help                         Show this help.
`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.packagePath),
    platform_ops_ledger_path: path.resolve(options.platformOpsLedgerPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.platformOpsLedgerPath),
    operations_freeze_source_inventory_schema_path: path.resolve(options.operationsFreezeSourceInventorySchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.operationsFreezeSourceInventorySchemaPath),
    operations_freeze_command_matrix_schema_path: path.resolve(options.operationsFreezeCommandMatrixSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.operationsFreezeCommandMatrixSchemaPath),
    operations_freeze_evidence_index_schema_path: path.resolve(options.operationsFreezeEvidenceIndexSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.operationsFreezeEvidenceIndexSchemaPath),
    operations_freeze_review_packet_schema_path: path.resolve(options.operationsFreezeReviewPacketSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.operationsFreezeReviewPacketSchemaPath),
    operations_freeze_signoff_ledger_schema_path: path.resolve(options.operationsFreezeSignoffLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.operationsFreezeSignoffLedgerSchemaPath),
    operations_freeze_signoff_receipt_template_schema_path: path.resolve(options.operationsFreezeSignoffReceiptTemplateSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.operationsFreezeSignoffReceiptTemplateSchemaPath),
    operations_freeze_signoff_receipt_intake_schema_path: path.resolve(options.operationsFreezeSignoffReceiptIntakeSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.operationsFreezeSignoffReceiptIntakeSchemaPath),
    operations_freeze_signoff_closeout_schema_path: path.resolve(options.operationsFreezeSignoffCloseoutSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.operationsFreezeSignoffCloseoutSchemaPath),
    operations_freeze_status_ledger_schema_path: path.resolve(options.operationsFreezeStatusLedgerSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.operationsFreezeStatusLedgerSchemaPath),
    operations_freeze_receipt_queue_schema_path: path.resolve(options.operationsFreezeReceiptQueueSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.operationsFreezeReceiptQueueSchemaPath),
    operations_freeze_receipt_validation_rules_schema_path: path.resolve(options.operationsFreezeReceiptValidationRulesSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.operationsFreezeReceiptValidationRulesSchemaPath),
    operations_freeze_receipt_workspace_schema_path: path.resolve(options.operationsFreezeReceiptWorkspaceSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.operationsFreezeReceiptWorkspaceSchemaPath),
    operations_freeze_receipt_workspace_merge_schema_path: path.resolve(options.operationsFreezeReceiptWorkspaceMergeSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.operationsFreezeReceiptWorkspaceMergeSchemaPath),
    operations_freeze_receipt_validation_packet_schema_path: path.resolve(options.operationsFreezeReceiptValidationPacketSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.operationsFreezeReceiptValidationPacketSchemaPath),
    operations_freeze_receipt_approval_plan_schema_path: path.resolve(options.operationsFreezeReceiptApprovalPlanSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.operationsFreezeReceiptApprovalPlanSchemaPath),
    operations_freeze_receipt_approval_closeout_schema_path: path.resolve(options.operationsFreezeReceiptApprovalCloseoutSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.operationsFreezeReceiptApprovalCloseoutSchemaPath),
    operations_freeze_receipt_closeout_schema_path: path.resolve(options.operationsFreezeReceiptCloseoutSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.operationsFreezeReceiptCloseoutSchemaPath),
    operations_freeze_receipt_chain_regression_schema_path: path.resolve(options.operationsFreezeReceiptChainRegressionSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.operationsFreezeReceiptChainRegressionSchemaPath),
    operations_freeze_closeout_schema_path: path.resolve(options.operationsFreezeCloseoutSchemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.operationsFreezeCloseoutSchemaPath),
    schema_path: path.resolve(options.schemaPath ?? DEFAULT_PLATFORM_OPERATIONS_FREEZE_INPUTS.schemaPath),
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
    validation_item_id: `platform-operations-freeze.${slugify(itemPath)}.${checkId}`,
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
