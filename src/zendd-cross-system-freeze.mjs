import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddOperatorSurface } from "./zendd-operator-surface.mjs";
import { buildZenddReleaseRecovery } from "./zendd-release-recovery.mjs";

export const DEFAULT_ZENDD_CROSS_SYSTEM_FREEZE_OUT_DIR = "artifacts/zendd-cross-system-freeze/latest";
export const DEFAULT_ZENDD_CROSS_SYSTEM_FREEZE_INPUTS = {
  schemaPath: "schemas/zendd-cross-system-freeze.schema.json",
  phaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  packagePath: "package.json",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-cross-system-freeze";
const OPERATOR_SURFACE_COMMAND_NAME = "project:zendd-operator-surface";
const RELEASE_RECOVERY_COMMAND_NAME = "project:zendd-release-recovery";
const SCHEMA_VERSION = "zendd-cross-system-freeze.v1";
const CAPABILITY_ID = "project.zendd.cross_system_freeze";
const PHASE_RANGE = "P701-P720";
const PHASE_SLOT = "P701";
const PREVIOUS_PHASE_SLOT = "P700";
const NEXT_PHASE_SLOT = "P721";
const READY_STATUS = "ready_for_protected_action_rollback_hardening";

const PASS_WORDS = new Set(["pass", "passed", "complete", "completed", "ready", "done", "approved", "governance_complete"]);
const UNSAFE_TRUE_FLAGS = [
  "action_allowed_now",
  "release_execution_allowed_now",
  "package_build_allowed_now",
  "electron_package_allowed_now",
  "database_migration_allowed_now",
  "client_export_allowed_now",
  "rollback_execution_allowed_now",
  "recovery_execution_allowed_now",
  "release_or_recovery_execution_allowed_now",
  "receipt_payload_present",
  "receipt_materialized",
  "receipt_validated",
  "approval_applied",
  "pass_promoted",
  "mutation_allowed",
  "zendd_mutation_allowed",
  "raw_material_copy_allowed",
  "source_material_copy_allowed",
  "credential_read_allowed",
  "secret_value_read_allowed",
  "live_route_registered",
  "live_route_registration_allowed_now",
  "mutating_methods_allowed",
  "command_execution_allowed_now",
  "physical_code_move_allowed_now",
];

export async function runZenddCrossSystemFreeze(options = {}) {
  const result = await buildZenddCrossSystemFreeze(options);
  if (options.write !== false) await writeZenddCrossSystemFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd cross-system freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddCrossSystemFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_CROSS_SYSTEM_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const phaseLedger = await readTextSource(inputs.phase_ledger_path);
  const sourceOptions = {
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    phaseLedgerPath: inputs.phase_ledger_path,
    write: false,
  };
  const operatorSurface = await buildZenddOperatorSurface(sourceOptions);
  const releaseRecovery = await buildZenddReleaseRecovery(sourceOptions);
  const freezePolicy = buildFreezePolicy(generatedAt);
  const freezeClaimRows = buildFreezeClaimRows({ operatorSurface, releaseRecovery });
  const auditRows = buildAuditRows({ freezeClaimRows, releaseRecovery });
  const closeoutRows = buildCloseoutRows({ freezeClaimRows, auditRows, releaseRecovery });
  const anchor = buildAnchor({ packageJson, phaseLedger, operatorSurface, releaseRecovery, freezePolicy, freezeClaimRows, auditRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, phaseLedger, operatorSurface, releaseRecovery, freezePolicy, freezeClaimRows, auditRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, freezeClaimRows, auditRows, closeoutRows, releaseRecovery });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({ operatorSurface, releaseRecovery, freezeClaimRows, auditRows, closeoutRows, validation: preliminaryValidation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_cross_system_freeze_id: `zendd-cross-system-freeze.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    cross_system_freeze_anchor: anchor,
    operator_surface_summary: operatorSurface.summary,
    release_recovery_summary: releaseRecovery.summary,
    cross_system_freeze_policy: freezePolicy,
    cross_system_freeze_claim_rows: freezeClaimRows,
    cross_system_freeze_audit_rows: auditRows,
    cross_system_freeze_closeout_rows: closeoutRows,
    cross_system_freeze_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_cross_system_freeze")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ operatorSurface, releaseRecovery, freezeClaimRows, auditRows, closeoutRows, validation: result.validation });
  result.summary.zendd_cross_system_freeze_id = result.zendd_cross_system_freeze_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddCrossSystemFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-cross-system-freeze.json"), serializableResult(result));
  await writeJson(path.join(outDir, "cross-system-freeze-policy.json"), result.cross_system_freeze_policy);
  await writeJson(path.join(outDir, "cross-system-freeze-claim-rows.json"), collectionEnvelope("zendd-cross-system-freeze-claim-rows.v1", "cross_system_freeze_claim_rows", result.cross_system_freeze_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "cross-system-freeze-audit-rows.json"), collectionEnvelope("zendd-cross-system-freeze-audit-rows.v1", "cross_system_freeze_audit_rows", result.cross_system_freeze_audit_rows, result.generated_at));
  await writeJson(path.join(outDir, "cross-system-freeze-closeout-rows.json"), collectionEnvelope("zendd-cross-system-freeze-closeout-rows.v1", "cross_system_freeze_closeout_rows", result.cross_system_freeze_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "cross-system-freeze-gate-rows.json"), collectionEnvelope("zendd-cross-system-freeze-gate-rows.v1", "cross_system_freeze_gate_rows", result.cross_system_freeze_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-cross-system-freeze-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddCrossSystemFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddCrossSystemFreeze(args);
    console.log(`Zendd cross-system freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_cross_system_freeze_status}`);
    console.log(`Zendd path: ${result.summary.zendd_project_root}`);
    console.log(`Freeze claims: ${result.summary.freeze_claim_row_count}`);
    console.log(`Freeze PASS: ${result.summary.freeze_pass_count}`);
    console.log(`Documented BLOCK: ${result.summary.freeze_block_count}`);
    console.log(`Unsupported pass-like demotions: ${result.summary.unsupported_pass_like_demoted_count}`);
    console.log(`Unsafe true flags: ${result.summary.unsafe_true_flag_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildFreezePolicy(generatedAt) {
  return {
    schema_version: "zendd-cross-system-freeze-policy.v1",
    phase_slot: PHASE_SLOT,
    project_id: "project.zendd",
    final_verdict_formula: [
      "CLAIM",
      "EVIDENCE",
      "REVIEWER_OR_HARD_GATE",
      "HUMAN_RECEIPT_IF_PROTECTED",
      "PASS_OR_DOCUMENTED_BLOCK",
      "NEXT_ALLOWED_ACTION_IF_BLOCKED",
    ],
    pass_requires: ["evidence_ref", "reviewer_ref_or_hard_gate_ref", "human_receipt_ref_if_protected", "unsafe_flags_false"],
    blocked_requires: ["block_reason", "responsible_owner", "next_allowed_action", "documented_human_gate_if_protected"],
    pass_like_words_not_sufficient: ["complete", "ready", "done", "approved", "governance_complete"],
    release_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    physical_code_move_allowed_now: false,
    raw_material_copy_allowed_now: false,
    receipt_application_allowed_now: false,
    next_allowed_action: "keep Zendd external and harden protected action rollback gates before any release, rollback, or physical integration PASS",
    created_at: generatedAt,
  };
}

function buildFreezeClaimRows({ operatorSurface, releaseRecovery }) {
  const rows = [
    ...operatorSurface.zendd_operator_claim_rows.map((row) => sourceRecord("operator_surface", row.source_tranche, row.source_collection, row.source_row_id, row)),
    ...releaseRecovery.release_claim_rows.map((row) => sourceRecord("release_recovery", "P681-P700", "release_claim_rows", row.row_id, row)),
    ...releaseRecovery.recovery_scenario_rows.map((row) => sourceRecord("release_recovery", "P681-P700", "recovery_scenario_rows", row.row_id, row)),
    ...releaseRecovery.rollback_target_rows.map((row) => sourceRecord("release_recovery", "P681-P700", "rollback_target_rows", row.row_id, row)),
    ...releaseRecovery.protected_release_action_rows.map((row) => sourceRecord("release_recovery", "P681-P700", "protected_release_action_rows", row.row_id, row)),
    ...releaseRecovery.recovery_receipt_rows.map((row) => sourceRecord("release_recovery", "P681-P700", "recovery_receipt_rows", row.row_id, row)),
    ...releaseRecovery.release_recovery_closeout_rows.map((row) => sourceRecord("release_recovery", "P681-P700", "release_recovery_closeout_rows", row.row_id, row)),
    ...releaseRecovery.release_recovery_gate_rows.map((row) => sourceRecord("release_recovery", "P681-P700", "release_recovery_gate_rows", row.gate_id, row)),
  ];
  return rows.map((record, index) => normalizeFreezeClaimRow(record, index));
}

function sourceRecord(sourceSystem, sourcePhaseRange, sourceCollection, sourceRowId, row) {
  return { sourceSystem, sourcePhaseRange, sourceCollection, sourceRowId, row };
}

function normalizeFreezeClaimRow(record, index) {
  const row = record.row;
  const claimId = row.claim_id ?? row.action_id ?? row.scenario_id ?? row.rollback_target_ref ?? row.recovery_receipt_ref ?? row.gate_id ?? row.row_id ?? `claim.zendd.freeze.${index + 1}`;
  const sourceCurrentVerdict = row.current_verdict ?? row.gate_status ?? row.closeout_status ?? row.status ?? "documented";
  const sourceVerdictFamily = row.verdict_family ?? classifyVerdictFamily(sourceCurrentVerdict);
  const protectedClaim = Boolean(
    row.protected_claim === true
    || row.protected_release_claim === true
    || row.rollback_receipt_required === true
    || row.human_receipt_required === true
    || row.human_receipt_ref_required === true
    || row.pass_without_receipt_allowed === false
    || row.protected_pass_allowed_without_receipt === false
    || row.protected_output === true
    || row.protected === true
    || Boolean(row.recovery_receipt_ref)
  );
  const evidenceRefs = collectEvidenceRefs(row);
  const reviewerRef = row.reviewer_ref ?? row.reviewer_ref_or_gate_ref ?? null;
  const hardGateRef = row.hard_gate_ref ?? row.gate_ref ?? row.rollback_target_ref ?? (row.gate_id ? `gate.${row.gate_id}` : null);
  const humanReceiptRef = row.human_receipt_ref ?? row.recovery_receipt_ref ?? row.receipt_template_ref ?? row.human_receipt_ref_if_protected ?? null;
  const missingHumanReceipt = normalizeMissingHumanReceipt(row.missing_human_receipt, protectedClaim, humanReceiptRef);
  const documentedHumanGateRef = protectedClaim
    ? humanReceiptRef ?? (missingHumanReceipt ? `documented-missing-human-gate.${normalizeKey(claimId)}` : null)
    : null;
  const sourcePassLike = isPassLike(sourceCurrentVerdict, sourceVerdictFamily);
  const sourceBlockedLike = isBlockedLike(sourceCurrentVerdict, sourceVerdictFamily);
  const unsafeTrueFlags = collectUnsafeTrueFlags(row);
  const passAssessment = assessPass({ evidenceRefs, reviewerRef, hardGateRef, protectedClaim, humanReceiptRef, unsafeTrueFlags });
  const finalVerdict = sourcePassLike && passAssessment.passEligible ? "pass" : "blocked";
  const freezeBlockReason = finalVerdict === "pass"
    ? null
    : deriveFreezeBlockReason({ sourcePassLike, sourceBlockedLike, sourceCurrentVerdict, sourceBlockReason: row.block_reason, passAssessment, protectedClaim, documentedHumanGateRef });
  const responsibleOwner = row.responsible_owner ?? row.standard_owner ?? "integration_operator";
  const nextAllowedAction = finalVerdict === "pass"
    ? "continue_to_next_cross_system_freeze_gate"
    : deriveNextAllowedAction({ row, freezeBlockReason, protectedClaim });
  const documentedBlock = finalVerdict === "blocked"
    && Boolean(freezeBlockReason)
    && Boolean(responsibleOwner)
    && Boolean(nextAllowedAction)
    && (!protectedClaim || Boolean(documentedHumanGateRef));
  const supportedFinalState = finalVerdict === "pass" ? passAssessment.passEligible : documentedBlock;
  return {
    schema_version: "zendd-cross-system-freeze-claim-row.v1",
    phase_slot: "P702-P710",
    row_id: `zendd-cross-system-freeze-claim.row.${String(index + 1).padStart(4, "0")}`,
    project_id: "project.zendd",
    source_system: record.sourceSystem,
    source_phase_range: record.sourcePhaseRange,
    source_collection: record.sourceCollection,
    source_row_id: String(record.sourceRowId ?? claimId),
    claim_id: String(claimId),
    source_current_verdict: String(sourceCurrentVerdict),
    source_verdict_family: String(sourceVerdictFamily),
    source_pass_like: sourcePassLike,
    source_blocked_like: sourceBlockedLike,
    evidence_refs: evidenceRefs,
    reviewer_ref: reviewerRef,
    hard_gate_ref: hardGateRef,
    human_receipt_ref: humanReceiptRef,
    documented_human_gate_ref: documentedHumanGateRef,
    protected_claim: protectedClaim,
    missing_evidence: passAssessment.missingEvidence,
    missing_reviewer_or_gate: passAssessment.missingReviewerOrGate,
    missing_human_receipt: missingHumanReceipt,
    unsafe_true_flags: unsafeTrueFlags,
    unsafe_flags_false: unsafeTrueFlags.length === 0,
    pass_eligible: passAssessment.passEligible,
    freeze_verdict: finalVerdict,
    freeze_block_reason: freezeBlockReason,
    responsible_owner: responsibleOwner,
    next_allowed_action: nextAllowedAction,
    documented_block: documentedBlock,
    supported_final_state: supportedFinalState,
  };
}

function assessPass({ evidenceRefs, reviewerRef, hardGateRef, protectedClaim, humanReceiptRef, unsafeTrueFlags }) {
  const missingEvidence = evidenceRefs.length === 0 ? ["evidence_ref"] : [];
  const missingReviewerOrGate = !reviewerRef && !hardGateRef;
  const missingHumanReceipt = protectedClaim && !humanReceiptRef;
  return {
    missingEvidence,
    missingReviewerOrGate,
    missingHumanReceipt,
    passEligible: evidenceRefs.length > 0 && !missingReviewerOrGate && !missingHumanReceipt && unsafeTrueFlags.length === 0,
  };
}

function deriveFreezeBlockReason({ sourcePassLike, sourceBlockedLike, sourceCurrentVerdict, sourceBlockReason, passAssessment, protectedClaim, documentedHumanGateRef }) {
  if (sourcePassLike) {
    if (passAssessment.missingEvidence.length > 0) return "pass_claim_missing_evidence";
    if (passAssessment.missingReviewerOrGate) return "pass_claim_missing_reviewer_or_hard_gate";
    if (protectedClaim && !documentedHumanGateRef) return "protected_pass_missing_human_receipt";
    if (!passAssessment.passEligible) return "pass_claim_failed_freeze_formula";
  }
  if (sourceBlockedLike) return sourceBlockReason ?? "documented_block";
  if (String(sourceCurrentVerdict).includes("ready")) return "ready_wording_not_sufficient_for_pass";
  return "non_final_verdict_documented";
}

function deriveNextAllowedAction({ row, freezeBlockReason, protectedClaim }) {
  if (row.next_allowed_action) return row.next_allowed_action;
  if (freezeBlockReason === "pass_claim_missing_evidence") return "bind evidence_ref before treating source PASS as freeze PASS";
  if (freezeBlockReason === "pass_claim_missing_reviewer_or_hard_gate") return "bind reviewer_ref or hard_gate_ref before freeze PASS";
  if (freezeBlockReason === "protected_pass_missing_human_receipt" || protectedClaim) return "document protected human gate or receipt before freeze PASS";
  if (freezeBlockReason === "ready_wording_not_sufficient_for_pass") return "replace ready wording with evidence-backed PASS or documented BLOCK";
  return "document block reason, owner, and next allowed action before retrying freeze PASS";
}

function buildAuditRows({ freezeClaimRows, releaseRecovery }) {
  const passRows = freezeClaimRows.filter((row) => row.freeze_verdict === "pass");
  const blockRows = freezeClaimRows.filter((row) => row.freeze_verdict === "blocked");
  const unsupportedPassLikeRows = freezeClaimRows.filter((row) => row.source_pass_like && row.freeze_verdict === "blocked");
  const protectedRows = freezeClaimRows.filter((row) => row.protected_claim);
  const readyWordRows = freezeClaimRows.filter((row) => /ready|complete|done|approved|governance/i.test(row.source_current_verdict));
  const checks = [
    ["claim_evidence_review_receipt_formula", "P711", freezeClaimRows.every((row) => row.supported_final_state), "Every freeze claim is PASS-eligible or documented BLOCK.", "repair unsupported freeze claim rows"],
    ["unsupported_pass_like_demoted", "P712", unsupportedPassLikeRows.length > 0 && unsupportedPassLikeRows.every((row) => row.freeze_block_reason), "Self-reported PASS/ready words without formula support are demoted to BLOCK.", "demote unsupported pass-like rows"],
    ["pass_rows_have_evidence_review_gate", "P713", passRows.every((row) => row.evidence_refs.length > 0 && (row.reviewer_ref || row.hard_gate_ref)), "PASS rows have evidence and reviewer/hard gate refs.", "bind evidence and reviewer/gate before PASS"],
    ["protected_rows_document_human_gate", "P714", protectedRows.every((row) => !row.protected_claim || row.documented_human_gate_ref || row.freeze_verdict === "blocked"), "Protected rows expose receipt or documented human gate state.", "add documented human gate for protected rows"],
    ["block_rows_have_next_action", "P715", blockRows.every((row) => row.freeze_block_reason && row.responsible_owner && row.next_allowed_action), "BLOCK rows retain block reason, owner, and next allowed action.", "complete documented BLOCK fields"],
    ["unsafe_flags_false", "P716", freezeClaimRows.every((row) => row.unsafe_flags_false), "Unsafe route, command, receipt, release, rollback, and copy flags are false.", "disable unsafe true flags"],
    ["release_recovery_execution_disabled", "P717", !releaseRecovery.release_recovery_policy.release_execution_allowed_now && !releaseRecovery.release_recovery_policy.rollback_execution_allowed_now && !releaseRecovery.release_recovery_policy.recovery_execution_allowed_now, "Release, rollback, and recovery execution remain disabled.", "return release/recovery policy to disabled"],
    ["result_wording_not_enough", "P718", readyWordRows.every((row) => row.freeze_verdict === "blocked" || row.pass_eligible), "Ready/complete/done/approved wording is not accepted without formula support.", "bind evidence/reviewer/receipt or documented BLOCK"],
    ["physical_integration_still_blocked", "P719", releaseRecovery.protected_release_action_rows.some((row) => row.action_id === "protected-action.zendd.move_zendd_code_directory" && row.action_allowed_now === false), "Physical Zendd code movement remains a protected BLOCK.", "defer physical integration decision to the later integration tranche"],
  ];
  return checks.map(([audit_id, phase_slot, passed, message, next_allowed_action]) => ({
    schema_version: "zendd-cross-system-freeze-audit-row.v1",
    audit_id,
    phase_slot,
    audit_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_cross_system_freeze_audit" : next_allowed_action,
  }));
}

function buildCloseoutRows({ freezeClaimRows, auditRows, releaseRecovery }) {
  const ready = freezeClaimRows.every((row) => row.supported_final_state)
    && auditRows.every((row) => row.audit_status === "pass")
    && releaseRecovery.release_recovery_closeout_rows.every((row) => row.pass_promoted === false);
  return [{
    schema_version: "zendd-cross-system-freeze-closeout-row.v1",
    phase_slot: "P720",
    row_id: "zendd-cross-system-freeze-closeout.p720",
    project_id: "project.zendd",
    closeout_status: ready ? "ready_for_cross_system_freeze_closeout" : "blocked",
    freeze_claim_row_count: freezeClaimRows.length,
    freeze_pass_count: freezeClaimRows.filter((row) => row.freeze_verdict === "pass").length,
    freeze_block_count: freezeClaimRows.filter((row) => row.freeze_verdict === "blocked").length,
    unsupported_pass_like_demoted_count: freezeClaimRows.filter((row) => row.source_pass_like && row.freeze_verdict === "blocked").length,
    unsafe_true_flag_count: freezeClaimRows.reduce((count, row) => count + row.unsafe_true_flags.length, 0),
    release_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    physical_code_move_allowed_now: false,
    raw_material_copy_allowed_now: false,
    receipt_application_allowed_now: false,
    pass_promoted: false,
    next_integration_phase_slot: NEXT_PHASE_SLOT,
    next_allowed_action: "harden protected action rollback gates before physical Zendd integration decisions",
    read_only: true,
  }];
}

function buildAnchor({ packageJson, phaseLedger, operatorSurface, releaseRecovery, freezePolicy, freezeClaimRows, auditRows, closeoutRows }) {
  return {
    schema_version: "zendd-cross-system-freeze-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    operator_surface_command_name: OPERATOR_SURFACE_COMMAND_NAME,
    release_recovery_command_name: RELEASE_RECOVERY_COMMAND_NAME,
    source_operator_surface_id: operatorSurface.zendd_operator_surface_id,
    source_operator_surface_status: operatorSurface.summary.zendd_operator_surface_status,
    source_release_recovery_id: releaseRecovery.zendd_release_recovery_id,
    source_release_recovery_status: releaseRecovery.summary.zendd_release_recovery_status,
    package_json_hash: packageJson.content_hash,
    phase_ledger_hash: phaseLedger.content_hash,
    policy_hash: hashValue(freezePolicy),
    freeze_claim_rows_hash: hashRows(freezeClaimRows, ["claim_id", "source_current_verdict", "freeze_verdict", "freeze_block_reason", "next_allowed_action"]),
    audit_rows_hash: hashRows(auditRows, ["audit_id", "audit_status", "next_allowed_action"]),
    closeout_rows_hash: hashRows(closeoutRows, ["row_id", "closeout_status", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, phaseLedger, operatorSurface, releaseRecovery, freezePolicy, freezeClaimRows, auditRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  return [
    gateRow("p701_operator_surface_ready", "P701", operatorSurface.validation.valid && operatorSurface.summary.zendd_operator_surface_status === "ready_for_release_recovery_bridge", "P661-P680 operator surface is ready.", "repair operator surface before cross-system freeze"),
    gateRow("p701_release_recovery_ready", "P701", releaseRecovery.validation.valid && releaseRecovery.summary.zendd_release_recovery_status === "ready_for_cross_system_claim_freeze", "P681-P700 release/recovery bridge is ready.", "repair release/recovery bridge before cross-system freeze"),
    gateRow("p702_freeze_policy_declared", "P702", freezePolicy.pass_requires.length >= 4 && freezePolicy.blocked_requires.length >= 4, "Freeze policy declares PASS and documented BLOCK requirements.", "declare cross-system freeze policy"),
    gateRow("p703_claims_collected", "P703-P704", freezeClaimRows.length > operatorSurface.zendd_operator_claim_rows.length, "P521-P700 source claims are collected into freeze rows.", "collect operator and release/recovery rows"),
    gateRow("p705_unsupported_pass_demoted", "P705-P707", freezeClaimRows.filter((row) => row.source_pass_like && !row.pass_eligible).every((row) => row.freeze_verdict === "blocked" && row.freeze_block_reason), "Unsupported pass-like claims are demoted to documented BLOCK.", "demote unsupported pass-like claims"),
    gateRow("p708_blocks_documented", "P708-P710", freezeClaimRows.filter((row) => row.freeze_verdict === "blocked").every((row) => row.documented_block), "Blocked freeze rows retain reason, owner, next action, and protected human gate when needed.", "complete documented BLOCK rows"),
    gateRow("p711_audits_pass", "P711-P719", auditRows.every((row) => row.audit_status === "pass"), "Cross-system freeze audits pass.", "repair blocked freeze audit rows"),
    gateRow("p720_closeout_ready", "P720", closeoutRows.length === 1 && closeoutRows.every((row) => row.closeout_status === "ready_for_cross_system_freeze_closeout" && !row.pass_promoted), "Cross-system freeze closes without PASS promotion or execution.", "complete cross-system freeze closeout"),
    gateRow("package_script_registered", "P720", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("validate_chain_registered", "P720", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`), `${COMMAND_NAME} is included in npm run validate.`, `add ${COMMAND_NAME} to validate chain`),
    gateRow("phase_ledger_acceptance_declared", "P720", phaseLedger.available && phaseLedger.text.includes("P701-P720") && phaseLedger.text.includes(COMMAND_NAME), "P701-P720 phase ledger declares cross-system freeze acceptance.", "record P701-P720 in phase ledger"),
  ];
}

function buildValidationItems({ gateRows, freezeClaimRows, auditRows, closeoutRows, releaseRecovery }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "cross_system_freeze_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("freeze_claims.supported_final_state", "claim_boundary", freezeClaimRows.every((row) => row.supported_final_state), "Freeze claims are PASS-eligible or documented BLOCK"));
  items.push(validationItem("pass_claims.formula", "pass_boundary", freezeClaimRows.filter((row) => row.freeze_verdict === "pass").every((row) => row.pass_eligible), "PASS rows satisfy evidence/reviewer/receipt formula"));
  items.push(validationItem("blocked_claims.documented", "block_boundary", freezeClaimRows.filter((row) => row.freeze_verdict === "blocked").every((row) => row.documented_block), "BLOCK rows include reason, owner, and next action"));
  items.push(validationItem("unsafe_flags.false", "unsafe_boundary", freezeClaimRows.every((row) => row.unsafe_flags_false), "No unsafe true flags are present"));
  items.push(validationItem("release_recovery.no_execution", "release_boundary", !releaseRecovery.release_recovery_policy.release_execution_allowed_now && !releaseRecovery.release_recovery_policy.rollback_execution_allowed_now && !releaseRecovery.release_recovery_policy.recovery_execution_allowed_now, "Release/recovery execution stays disabled"));
  items.push(validationItem("audits.pass", "audit_boundary", auditRows.every((row) => row.audit_status === "pass"), "Freeze audit rows pass"));
  items.push(validationItem("closeout.no_promotion", "closeout_boundary", closeoutRows.every((row) => !row.pass_promoted && row.closeout_status === "ready_for_cross_system_freeze_closeout"), "Closeout does not promote PASS"));
  return items;
}

function buildSummary({ operatorSurface, releaseRecovery, freezeClaimRows, auditRows, closeoutRows, validation }) {
  const unsupportedDemoted = freezeClaimRows.filter((row) => row.source_pass_like && row.freeze_verdict === "blocked").length;
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_cross_system_freeze_status: validation.valid ? READY_STATUS : "documented_block_pending_cross_system_freeze",
    zendd_project_root: operatorSurface.summary.zendd_project_root,
    zendd_git_head_short: operatorSurface.summary.zendd_git_head_short,
    operator_surface_status: operatorSurface.summary.zendd_operator_surface_status,
    release_recovery_status: releaseRecovery.summary.zendd_release_recovery_status,
    freeze_claim_row_count: freezeClaimRows.length,
    freeze_pass_count: freezeClaimRows.filter((row) => row.freeze_verdict === "pass").length,
    freeze_block_count: freezeClaimRows.filter((row) => row.freeze_verdict === "blocked").length,
    unsupported_pass_like_demoted_count: unsupportedDemoted,
    protected_freeze_claim_count: freezeClaimRows.filter((row) => row.protected_claim).length,
    unsafe_true_flag_count: freezeClaimRows.reduce((count, row) => count + row.unsafe_true_flags.length, 0),
    audit_row_count: auditRows.length,
    closeout_row_count: closeoutRows.length,
    release_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    physical_code_move_allowed_now: false,
    raw_material_copy_allowed_now: false,
    receipt_application_allowed_now: false,
    pass_promoted: false,
    validation_error_count: validation.errors.length,
  };
}

function collectEvidenceRefs(row) {
  const refs = [];
  for (const field of [
    "evidence_ref",
    "command_evidence_ref",
    "release_evidence_ref",
    "rollback_evidence_ref",
    "review_evidence_ref",
    "source_evidence_ref",
    "citation_evidence_ref",
    "quality_evidence_ref",
    "operator_surface_ref",
    "rollback_target_ref",
  ]) {
    if (row[field]) refs.push(row[field]);
  }
  if (Array.isArray(row.evidence_refs)) refs.push(...row.evidence_refs);
  return [...new Set(refs.filter(Boolean).map(String))];
}

function collectUnsafeTrueFlags(row) {
  return UNSAFE_TRUE_FLAGS.filter((field) => row[field] === true);
}

function normalizeMissingHumanReceipt(value, protectedClaim, humanReceiptRef) {
  if (!protectedClaim || humanReceiptRef) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "boolean") return value;
  return true;
}

function isPassLike(value, family) {
  const normalized = normalizeKey(value);
  if (PASS_WORDS.has(normalized)) return true;
  if (String(family).toLowerCase() === "pass") return true;
  return /^ready/.test(normalized) || normalized.includes("ready_for") || normalized.includes("approved") || normalized.includes("complete");
}

function isBlockedLike(value, family) {
  const normalized = normalizeKey(value);
  if (String(family).toLowerCase() === "blocked") return true;
  return normalized.includes("block") || normalized.includes("fail") || normalized.includes("pending");
}

function classifyVerdictFamily(value) {
  if (isPassLike(value, "")) return "pass";
  if (isBlockedLike(value, "")) return "blocked";
  return normalizeKey(value) || "documented";
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-cross-system-freeze-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_cross_system_freeze_gate" : nextAllowedAction,
  };
}

function validationItem(pathValue, checkId, passed, message) {
  return {
    path: pathValue,
    check_id: checkId,
    status: passed ? "pass" : "fail",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "pass").map((item) => ({ path: item.path, message: item.message }));
  return { valid: errors.length === 0, errors };
}

function normalizeInputs(options) {
  return {
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_CROSS_SYSTEM_FREEZE_INPUTS.schemaPath,
    phase_ledger_path: options.phaseLedgerPath ?? DEFAULT_ZENDD_CROSS_SYSTEM_FREEZE_INPUTS.phaseLedgerPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_CROSS_SYSTEM_FREEZE_INPUTS.packagePath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_CROSS_SYSTEM_FREEZE_INPUTS.zenddProjectRoot,
  };
}

function parseArgs(argv) {
  const args = { write: true, check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--zendd-root") {
      args.zenddProjectRoot = argv[++index];
    } else if (arg === "--schema") {
      args.schemaPath = argv[++index];
    } else if (arg === "--phase-ledger") {
      args.phaseLedgerPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: npm run ${COMMAND_NAME} -- [--check] [--zendd-root <path>] [--out-dir <path>]

Creates the P701-P720 Zendd-Hermes cross-system claim freeze.
--check validates without executing Zendd commands, moving code, reading secrets,
copying raw VDR/client material, validating receipts, applying approvals,
running release/rollback, or promoting PASS.
`);
}

async function readJsonSource(filePath) {
  const source = await readTextSource(filePath);
  if (!source.available) return { ...source, data: null };
  try {
    return { ...source, data: JSON.parse(source.text) };
  } catch (error) {
    return { ...source, available: false, data: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const text = await readFile(resolved, "utf8");
    return {
      path: resolved,
      available: true,
      text,
      content_hash: hashValue(text),
    };
  } catch (error) {
    return {
      path: resolved,
      available: false,
      text: "",
      content_hash: null,
      error: error.message,
    };
  }
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    [`${key.slice(0, -1)}_count`]: rows.length,
    [key]: rows,
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashRows(rows, fields) {
  return hashValue(rows.map((row) => Object.fromEntries(fields.map((field) => [field, row[field] ?? null]))));
}

function hashValue(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}

function dateStamp(value) {
  return String(value).replace(/[-:]/g, "").replace(/\..*$/, "Z");
}

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# Zendd Cross-System Freeze Summary",
    "",
    `- Status: ${summary.zendd_cross_system_freeze_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Zendd root: ${summary.zendd_project_root}`,
    `- Zendd HEAD: ${summary.zendd_git_head_short ?? "unavailable"}`,
    `- Freeze claims: ${summary.freeze_claim_row_count}`,
    `- Freeze PASS: ${summary.freeze_pass_count}`,
    `- Documented BLOCK: ${summary.freeze_block_count}`,
    `- Unsupported pass-like demotions: ${summary.unsupported_pass_like_demoted_count}`,
    `- Protected freeze claims: ${summary.protected_freeze_claim_count}`,
    `- Unsafe true flags: ${summary.unsafe_true_flag_count}`,
    `- PASS promoted: ${summary.pass_promoted}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "## Next Action",
    "",
    "Harden protected action rollback gates before any Zendd release, rollback, receipt application, or physical code integration decision.",
    "",
  ].join("\n");
}
