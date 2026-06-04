import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformHumanApprovedLimitedExecution } from "./platform-human-approved-limited-execution.mjs";

export const DEFAULT_PLATFORM_CONTROLLED_WRITE_OPERATOR_CONSOLE_V2_OUT_DIR = "artifacts/platform-controlled-write-operator-console-v2/latest";
export const DEFAULT_PLATFORM_CONTROLLED_WRITE_OPERATOR_CONSOLE_V2_INPUTS = {
  schemaPath: "schemas/platform-controlled-write-operator-console-v2.schema.json",
  packagePath: "package.json",
  limitedExecutionLedgerPath: "docs/hermes-human-approved-limited-execution.md",
  controlledWriteLedgerPath: "docs/hermes-controlled-write-operator-console-v2.md",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p1200-p3200.md",
};

const COMMAND_NAME = "platform:controlled-write-operator-console-v2";
const SOURCE_COMMAND_NAME = "platform:human-approved-limited-execution";
const SCHEMA_VERSION = "platform-controlled-write-operator-console-v2.v1";
const CAPABILITY_ID = "platform.controlled_write_operator_console_v2";
const READY_STATUS = "ready_for_platform_controlled_write_operator_console_v2";
const SOURCE_READY_STATUS = "ready_for_platform_human_approved_limited_execution";
const PROGRAM_RANGE = "P2401-P2560";
const PHASE_RANGE = "P2401-P2560";
const PHASE_SLOT = "P2401";
const PREVIOUS_PHASE_SLOT = "P2400";
const NEXT_PHASE_SLOT = "P2561";

const COMPONENT_SPECS = [
  ["patch_candidate_contract", "Generated patch candidate contract"],
  ["diff_review_packet_contract", "Diff review packet and reviewer verdict contract"],
  ["human_receipt_apply_contract", "Human receipt apply contract"],
  ["post_apply_validation_contract", "Post-apply validation contract"],
  ["rollback_target_contract", "Rollback target and inverse patch contract"],
  ["operator_action_inbox_contract", "Operator action inbox and blocked reason projection contract"],
  ["pass_owner_visibility_contract", "PASS owner and final authority visibility contract"],
  ["event_plane_handoff_contract", "P2561 Memory Bank and event plane handoff contract"],
];

const PATCH_CANDIDATE_SPECS = [
  ["generated_patch_only", "Patch must be generated as a candidate artifact, not applied directly"],
  ["scoped_file_list", "Patch candidate must declare intended file scope"],
  ["intent_summary", "Patch candidate must state intent and non-goals"],
  ["risk_tier", "Patch candidate must declare risk tier and protected action class"],
  ["expected_artifacts", "Patch candidate must declare expected artifact and validation changes"],
  ["no_direct_apply", "Patch candidate must preserve direct-apply block by default"],
  ["patch_hash", "Patch candidate must be hash-addressable for review and rollback"],
];

const DIFF_REVIEW_SPECS = [
  ["diff_summary", "Diff packet must summarize touched files and behavioral surface"],
  ["touched_file_scope", "Diff packet must verify file scope against receipt scope"],
  ["semantic_risk_note", "Diff packet must include semantic risk and domain boundary note"],
  ["test_plan", "Diff packet must include pre/post validation plan"],
  ["rollback_plan", "Diff packet must include rollback target and recovery path"],
  ["reviewer_verdict", "Diff packet must bind reviewer PASS/BLOCK authority"],
];

const APPLY_RECEIPT_SPECS = [
  ["patch_apply_receipt", "Receipt for applying a generated patch candidate"],
  ["rollback_receipt", "Receipt for applying rollback or inverse patch"],
  ["protected_write_receipt", "Receipt for protected write or domain-sensitive mutation"],
  ["release_candidate_receipt", "Receipt for release-candidate state transition"],
  ["console_action_receipt", "Receipt for any operator console action route that mutates state"],
  ["emergency_revert_receipt", "Receipt for emergency revert with owner and closeout"],
];

const POST_APPLY_VALIDATION_SPECS = [
  ["git_diff_check", "git diff --check after patch application"],
  ["targeted_tests", "Targeted tests tied to diff packet"],
  ["validate_core", "Core contract validation after patch application"],
  ["platform_check", "Platform phase check after patch application"],
  ["secret_scan_gate", "Secret and raw material scan gate"],
  ["artifact_summary_check", "Artifact summary and evidence-ref verification"],
];

const ROLLBACK_SPECS = [
  ["pre_apply_snapshot", "Pre-apply status and artifact snapshot"],
  ["inverse_patch_plan", "Inverse patch or restore plan"],
  ["artifact_restore_plan", "Artifact restore and cleanup plan"],
  ["validation_recovery_plan", "Validation recovery plan after rollback"],
  ["receipt_revoke_path", "Receipt expiry, revoke, or emergency stop path"],
];

const CONSOLE_ACTION_SPECS = [
  ["/api/operator/action-inbox", "action_inbox_rows"],
  ["/api/operator/missing-receipts", "missing_receipt_rows"],
  ["/api/operator/blocked-reasons", "blocked_reason_rows"],
  ["/api/operator/pass-owners", "pass_owner_rows"],
  ["/api/operator/diff-packets", "diff_review_packet_rows"],
  ["/api/operator/rollback-targets", "rollback_target_rows"],
  ["/api/operator/next-conditions", "memory_next_condition_rows"],
];

const PASS_OWNER_SPECS = [
  ["platform_runtime_owner", "Platform runtime and controlled write PASS owner"],
  ["domain_pack_owner", "Domain pack compatibility and rollout PASS owner"],
  ["legal_human_owner", "Legal-domain final work product owner"],
  ["release_human_owner", "Release and production readiness owner"],
  ["trading_safety_owner", "Trading safety and live-action owner"],
];

const HANDOFF_SPECS = [
  ["p2561_memory_event_plane", "P2561-P2720", "Memory Bank and event plane can consume patch, receipt, closeout, and operator action rows."],
  ["p2721_connector_governance", "P2721-P2880", "Connector governance can consume console action and raw-material block rows."],
  ["p3041_production_freeze", "P3041-P3200", "Production freeze can verify that writes were patch-first and human-approved."],
];

export async function runPlatformControlledWriteOperatorConsoleV2(options = {}) {
  const result = await buildPlatformControlledWriteOperatorConsoleV2(options);
  if (options.write !== false) await writePlatformControlledWriteOperatorConsoleV2(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform controlled write operator console v2 failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformControlledWriteOperatorConsoleV2(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_CONTROLLED_WRITE_OPERATOR_CONSOLE_V2_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const limitedExecutionLedger = await readTextSource(inputs.limited_execution_ledger_path);
  const controlledWriteLedger = await readTextSource(inputs.controlled_write_ledger_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const sourceLimitedExecution = options.sourceLimitedExecution ?? await buildPlatformHumanApprovedLimitedExecution({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    limitedExecutionLedgerPath: inputs.limited_execution_ledger_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    write: false,
  });

  const componentRows = buildComponentRows();
  const patchCandidateRows = buildPatchCandidateRows();
  const diffReviewRows = buildDiffReviewRows();
  const applyReceiptRows = buildApplyReceiptRows();
  const postApplyValidationRows = buildPostApplyValidationRows();
  const rollbackRows = buildRollbackRows();
  const consoleActionRows = buildConsoleActionRows();
  const passOwnerRows = buildPassOwnerRows();
  const handoffRows = buildHandoffRows();
  const anchor = buildAnchor({ packageJson, limitedExecutionLedger, controlledWriteLedger, roadmapDoc, sourceLimitedExecution, componentRows, patchCandidateRows, diffReviewRows, applyReceiptRows, postApplyValidationRows, rollbackRows, consoleActionRows, passOwnerRows, handoffRows });
  const manifest = buildManifest({ generatedAt, sourceLimitedExecution, componentRows, patchCandidateRows, diffReviewRows, applyReceiptRows, postApplyValidationRows, rollbackRows, consoleActionRows, passOwnerRows, handoffRows });
  const guardRows = buildGuardRows({ sourceLimitedExecution, componentRows, patchCandidateRows, diffReviewRows, applyReceiptRows, postApplyValidationRows, rollbackRows, consoleActionRows, passOwnerRows, handoffRows });
  const boundary = buildBoundary({ sourceLimitedExecution, componentRows, patchCandidateRows, diffReviewRows, applyReceiptRows, postApplyValidationRows, rollbackRows, consoleActionRows, passOwnerRows, handoffRows, guardRows });
  const validationItems = buildValidationItems({ packageJson, limitedExecutionLedger, controlledWriteLedger, roadmapDoc, sourceLimitedExecution, componentRows, patchCandidateRows, diffReviewRows, applyReceiptRows, postApplyValidationRows, rollbackRows, consoleActionRows, passOwnerRows, handoffRows, guardRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_controlled_write_operator_console_v2_id: `platform-controlled-write-operator-console-v2.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    controlled_write_operator_console_anchor: anchor,
    source_human_approved_limited_execution_summary: sourceLimitedExecution.summary,
    controlled_write_operator_console_manifest: manifest,
    controlled_write_component_rows: componentRows,
    patch_candidate_rows: patchCandidateRows,
    diff_review_packet_rows: diffReviewRows,
    patch_apply_receipt_rows: applyReceiptRows,
    post_apply_validation_rows: postApplyValidationRows,
    rollback_target_rows: rollbackRows,
    operator_console_action_rows: consoleActionRows,
    pass_owner_rows: passOwnerRows,
    controlled_write_handoff_rows: handoffRows,
    controlled_write_guard_rows: guardRows,
    controlled_write_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceLimitedExecution, componentRows, patchCandidateRows, diffReviewRows, applyReceiptRows, postApplyValidationRows, rollbackRows, consoleActionRows, passOwnerRows, handoffRows, guardRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_controlled_write_operator_console_v2")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceLimitedExecution, componentRows, patchCandidateRows, diffReviewRows, applyReceiptRows, postApplyValidationRows, rollbackRows, consoleActionRows, passOwnerRows, handoffRows, guardRows, boundary, validation: result.validation });
  result.summary.platform_controlled_write_operator_console_v2_id = result.platform_controlled_write_operator_console_v2_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformControlledWriteOperatorConsoleV2(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-controlled-write-operator-console-v2.json"), serializableResult(result));
  await writeJson(path.join(outDir, "controlled-write-operator-console-manifest.json"), result.controlled_write_operator_console_manifest);
  await writeJson(path.join(outDir, "controlled-write-component-rows.json"), collectionEnvelope("controlled-write-component-rows.v1", "controlled_write_component_rows", result.controlled_write_component_rows, result.generated_at));
  await writeJson(path.join(outDir, "patch-candidate-rows.json"), collectionEnvelope("patch-candidate-rows.v1", "patch_candidate_rows", result.patch_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "diff-review-packet-rows.json"), collectionEnvelope("diff-review-packet-rows.v1", "diff_review_packet_rows", result.diff_review_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "patch-apply-receipt-rows.json"), collectionEnvelope("patch-apply-receipt-rows.v1", "patch_apply_receipt_rows", result.patch_apply_receipt_rows, result.generated_at));
  await writeJson(path.join(outDir, "post-apply-validation-rows.json"), collectionEnvelope("post-apply-validation-rows.v1", "post_apply_validation_rows", result.post_apply_validation_rows, result.generated_at));
  await writeJson(path.join(outDir, "rollback-target-rows.json"), collectionEnvelope("rollback-target-rows.v1", "rollback_target_rows", result.rollback_target_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-console-action-rows.json"), collectionEnvelope("operator-console-action-rows.v1", "operator_console_action_rows", result.operator_console_action_rows, result.generated_at));
  await writeJson(path.join(outDir, "pass-owner-rows.json"), collectionEnvelope("pass-owner-rows.v1", "pass_owner_rows", result.pass_owner_rows, result.generated_at));
  await writeJson(path.join(outDir, "controlled-write-handoff-rows.json"), collectionEnvelope("controlled-write-handoff-rows.v1", "controlled_write_handoff_rows", result.controlled_write_handoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "controlled-write-guard-rows.json"), collectionEnvelope("controlled-write-guard-rows.v1", "controlled_write_guard_rows", result.controlled_write_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "controlled-write-boundary.json"), result.controlled_write_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-controlled-write-operator-console-v2-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformControlledWriteOperatorConsoleV2Cli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformControlledWriteOperatorConsoleV2(args);
    console.log(`Platform controlled write operator console v2 ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_controlled_write_operator_console_v2_status}`);
    console.log(`Components: ${result.summary.component_count}`);
    console.log(`Patch candidates: ${result.summary.patch_candidate_count}`);
    console.log(`Diff review packets: ${result.summary.diff_review_packet_count}`);
    console.log(`Patch apply receipts: ${result.summary.patch_apply_receipt_count}`);
    console.log(`Operator console actions: ${result.summary.operator_console_action_count}`);
    console.log(`PASS owners: ${result.summary.pass_owner_count}`);
    console.log(`P2561 handoff ready: ${result.summary.p2561_ready_as_next_goal}`);
    console.log(`Patch applied now: ${result.summary.patch_applied_now}`);
    console.log(`Write action allowed now: ${result.summary.write_action_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildComponentRows() {
  return COMPONENT_SPECS.map(([componentId, description], index) => passRow({
    schema_version: "controlled-write-component-row.v1",
    row_id: `controlled.write.component.row.${String(index + 1).padStart(2, "0")}`,
    component_id: componentId,
    component_status: "contract_ready",
    description,
    evidence_ref: `evidence.platform.controlled_write.component.${componentId}`,
    reviewer_ref: "reviewer.platform_controlled_write",
    hard_gate_ref: `gate.platform.controlled_write.component.${componentId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "preserve as controlled write and console v2 precondition",
  }));
}

function buildPatchCandidateRows() {
  return PATCH_CANDIDATE_SPECS.map(([patchCandidateId, description], index) => passRow({
    schema_version: "patch-candidate-row.v1",
    row_id: `patch.candidate.row.${String(index + 1).padStart(2, "0")}`,
    patch_candidate_id: patchCandidateId,
    patch_candidate_status: "candidate_contract",
    description,
    generated_patch_required: true,
    patch_generated_now: false,
    direct_apply_allowed_now: false,
    write_action_allowed_now: false,
    human_receipt_required_for_apply: true,
    diff_review_required: true,
    rollback_binding_required: true,
    evidence_ref: `evidence.platform.controlled_write.patch.${patchCandidateId}`,
    reviewer_ref: "reviewer.platform_controlled_write_patch",
    hard_gate_ref: `gate.platform.controlled_write.patch.${patchCandidateId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "generate only a patch candidate artifact, then route to diff review",
  }));
}

function buildDiffReviewRows() {
  return DIFF_REVIEW_SPECS.map(([diffReviewId, description], index) => passRow({
    schema_version: "diff-review-packet-row.v1",
    row_id: `diff.review.packet.row.${String(index + 1).padStart(2, "0")}`,
    diff_review_id: diffReviewId,
    diff_review_status: "required_before_apply",
    description,
    review_required: true,
    reviewer_verdict_required: true,
    review_completed_now: false,
    apply_allowed_without_review: false,
    evidence_ref: `evidence.platform.controlled_write.diff.${diffReviewId}`,
    reviewer_ref: "reviewer.platform_controlled_write_diff",
    hard_gate_ref: `gate.platform.controlled_write.diff.${diffReviewId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "complete diff review packet before any apply receipt is usable",
  }));
}

function buildApplyReceiptRows() {
  return APPLY_RECEIPT_SPECS.map(([receiptType, description], index) => passRow({
    schema_version: "patch-apply-receipt-row.v1",
    row_id: `patch.apply.receipt.row.${String(index + 1).padStart(2, "0")}`,
    receipt_type: receiptType,
    receipt_status: "required_before_patch_apply",
    description,
    human_receipt_required: true,
    receipt_applied_now: false,
    apply_enabled_by_receipt_now: false,
    protected_action_allowed_now: false,
    receipt_expiry_required: true,
    evidence_ref: `evidence.platform.controlled_write.receipt.${receiptType}`,
    reviewer_ref: "reviewer.platform_controlled_write_receipt",
    hard_gate_ref: `gate.platform.controlled_write.receipt.${receiptType}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "validate receipt only after patch candidate and diff packet are ready",
  }));
}

function buildPostApplyValidationRows() {
  return POST_APPLY_VALIDATION_SPECS.map(([validationId, description], index) => passRow({
    schema_version: "post-apply-validation-row.v1",
    row_id: `post.apply.validation.row.${String(index + 1).padStart(2, "0")}`,
    validation_id: validationId,
    validation_status: "required_after_patch_apply",
    description,
    post_apply_required: true,
    validation_run_now: false,
    pass_required_for_closeout: true,
    raw_output_allowed: false,
    evidence_ref: `evidence.platform.controlled_write.validation.${validationId}`,
    reviewer_ref: "reviewer.platform_controlled_write_validation",
    hard_gate_ref: `gate.platform.controlled_write.validation.${validationId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "run only after human-approved patch application",
  }));
}

function buildRollbackRows() {
  return ROLLBACK_SPECS.map(([rollbackId, description], index) => passRow({
    schema_version: "rollback-target-row.v1",
    row_id: `rollback.target.row.${String(index + 1).padStart(2, "0")}`,
    rollback_id: rollbackId,
    rollback_status: "required_before_patch_apply",
    description,
    rollback_target_required: true,
    inverse_patch_required: true,
    rollback_executed_now: false,
    rollback_requires_receipt: true,
    evidence_ref: `evidence.platform.controlled_write.rollback.${rollbackId}`,
    reviewer_ref: "reviewer.platform_controlled_write_rollback",
    hard_gate_ref: `gate.platform.controlled_write.rollback.${rollbackId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "bind rollback target before any apply receipt",
  }));
}

function buildConsoleActionRows() {
  return CONSOLE_ACTION_SPECS.map(([routePath, responseCollection], index) => passRow({
    schema_version: "operator-console-action-row.v1",
    row_id: `operator.console.action.row.${String(index + 1).padStart(2, "0")}`,
    route_path: routePath,
    method: "GET",
    response_collection: responseCollection,
    route_status: "read_only_projection_contract",
    action_inbox_visible: true,
    mutation_route: false,
    patch_apply_route: false,
    receipt_application_route: false,
    protected_action_route: false,
    server_started: false,
    evidence_ref: `evidence.platform.controlled_write.console.${String(index + 1).padStart(2, "0")}`,
    reviewer_ref: "reviewer.platform_controlled_write_console",
    hard_gate_ref: `gate.platform.controlled_write.console.${String(index + 1).padStart(2, "0")}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "project operator status without applying actions",
  }));
}

function buildPassOwnerRows() {
  return PASS_OWNER_SPECS.map(([passOwnerId, description], index) => passRow({
    schema_version: "pass-owner-row.v1",
    row_id: `pass.owner.row.${String(index + 1).padStart(2, "0")}`,
    pass_owner_id: passOwnerId,
    pass_owner_status: "required_for_final_pass",
    description,
    owner_required: true,
    agent_final_pass_allowed: false,
    human_final_authority_required: true,
    pass_visible_in_console: true,
    evidence_ref: `evidence.platform.controlled_write.pass_owner.${passOwnerId}`,
    reviewer_ref: "reviewer.platform_controlled_write_pass_owner",
    hard_gate_ref: `gate.platform.controlled_write.pass_owner.${passOwnerId}`,
    responsible_owner: passOwnerId,
    next_allowed_action: "display owner before PASS or protected action can proceed",
  }));
}

function buildHandoffRows() {
  return HANDOFF_SPECS.map(([handoffId, phaseRange, description], index) => passRow({
    schema_version: "controlled-write-handoff-row.v1",
    row_id: `controlled.write.handoff.row.${String(index + 1).padStart(2, "0")}`,
    handoff_id: handoffId,
    phase_range: phaseRange,
    handoff_status: "ready_as_input",
    description,
    event_plane_enabled_by_handoff: false,
    connector_write_enabled_by_handoff: false,
    production_ready_enabled_by_handoff: false,
    evidence_ref: `evidence.platform.controlled_write.handoff.${handoffId}`,
    reviewer_ref: "reviewer.platform_controlled_write_handoff",
    hard_gate_ref: `gate.platform.controlled_write.handoff.${handoffId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "consume in later phase without treating handoff as production permission",
  }));
}

function buildAnchor({ packageJson, limitedExecutionLedger, controlledWriteLedger, roadmapDoc, sourceLimitedExecution, componentRows, patchCandidateRows, diffReviewRows, applyReceiptRows, postApplyValidationRows, rollbackRows, consoleActionRows, passOwnerRows, handoffRows }) {
  return {
    schema_version: "controlled-write-operator-console-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    limited_execution_ledger_present: limitedExecutionLedger.available,
    controlled_write_ledger_present: controlledWriteLedger.available,
    roadmap_doc_present: roadmapDoc.available,
    source_limited_execution_status: sourceLimitedExecution.summary.platform_human_approved_limited_execution_status,
    source_runtime_execution_allowed_now: sourceLimitedExecution.summary.runtime_execution_allowed_now,
    source_write_action_allowed_now: sourceLimitedExecution.summary.write_action_allowed_now,
    component_count: componentRows.length,
    patch_candidate_count: patchCandidateRows.length,
    diff_review_packet_count: diffReviewRows.length,
    patch_apply_receipt_count: applyReceiptRows.length,
    post_apply_validation_count: postApplyValidationRows.length,
    rollback_target_count: rollbackRows.length,
    operator_console_action_count: consoleActionRows.length,
    pass_owner_count: passOwnerRows.length,
    handoff_count: handoffRows.length,
  };
}

function buildManifest({ generatedAt, sourceLimitedExecution, componentRows, patchCandidateRows, diffReviewRows, applyReceiptRows, postApplyValidationRows, rollbackRows, consoleActionRows, passOwnerRows, handoffRows }) {
  return {
    schema_version: "controlled-write-operator-console-manifest.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_limited_execution_status: sourceLimitedExecution.summary.platform_human_approved_limited_execution_status,
    component_count: componentRows.length,
    patch_candidate_count: patchCandidateRows.length,
    diff_review_packet_count: diffReviewRows.length,
    patch_apply_receipt_count: applyReceiptRows.length,
    post_apply_validation_count: postApplyValidationRows.length,
    rollback_target_count: rollbackRows.length,
    operator_console_action_count: consoleActionRows.length,
    pass_owner_count: passOwnerRows.length,
    handoff_count: handoffRows.length,
    controlled_write_contract_ready: true,
    operator_console_v2_projection_ready: true,
    patch_candidate_generation_allowed_with_receipt: true,
    next_allowed_action: "start P2561-P2720 Memory Bank, storage/event, and observability plane planning",
  };
}

function buildGuardRows({ sourceLimitedExecution, componentRows, patchCandidateRows, diffReviewRows, applyReceiptRows, postApplyValidationRows, rollbackRows, consoleActionRows, passOwnerRows, handoffRows }) {
  const guards = [
    ["source_limited_execution_ready", sourceLimitedExecution.summary.platform_human_approved_limited_execution_status === SOURCE_READY_STATUS, "Source limited execution contract must be ready"],
    ["source_still_no_write", sourceLimitedExecution.summary.write_action_allowed_now === false && sourceLimitedExecution.summary.command_executed_now === false, "Source must still prohibit write and must not have executed command now"],
    ["components_ready", componentRows.length === 8 && componentRows.every((row) => row.current_verdict === "pass"), "All controlled write components must pass"],
    ["patch_candidates_not_generated", patchCandidateRows.length === 7 && patchCandidateRows.every((row) => row.patch_generated_now === false && row.direct_apply_allowed_now === false), "Patch candidates must be contracts only"],
    ["diff_review_required", diffReviewRows.length === 6 && diffReviewRows.every((row) => row.review_required === true && row.apply_allowed_without_review === false), "Diff review packets must be required"],
    ["apply_receipts_not_applied", applyReceiptRows.length === 6 && applyReceiptRows.every((row) => row.human_receipt_required === true && row.receipt_applied_now === false), "Apply receipts must be required and not applied now"],
    ["post_apply_not_run", postApplyValidationRows.length === 6 && postApplyValidationRows.every((row) => row.post_apply_required === true && row.validation_run_now === false), "Post-apply validation must be required but not run now"],
    ["rollback_required", rollbackRows.length === 5 && rollbackRows.every((row) => row.rollback_target_required === true && row.rollback_executed_now === false), "Rollback target rows must exist"],
    ["console_read_only", consoleActionRows.length === 7 && consoleActionRows.every((row) => row.method === "GET" && row.mutation_route === false && row.server_started === false), "Operator console v2 projection must remain read-only"],
    ["pass_owners_human", passOwnerRows.length === 5 && passOwnerRows.every((row) => row.owner_required === true && row.agent_final_pass_allowed === false), "PASS owners must be human-owned"],
    ["handoffs_no_enablement", handoffRows.every((row) => row.event_plane_enabled_by_handoff === false && row.production_ready_enabled_by_handoff === false), "Handoffs must not enable event plane or production readiness"],
    ["no_patch_apply_or_write_enabled", true, "This contract does not generate or apply patches, mutate files, apply receipts, or open protected actions"],
  ];
  return guards.map(([guardId, pass, description], index) => ({
    schema_version: "controlled-write-guard-row.v1",
    row_id: `controlled.write.guard.row.${String(index + 1).padStart(2, "0")}`,
    guard_id: guardId,
    guard_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${guardId}`,
    evidence_ref: `evidence.platform.controlled_write.guard.${guardId}`,
    reviewer_ref: "reviewer.platform_controlled_write_guard",
    hard_gate_ref: `gate.platform.controlled_write.guard.${guardId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: pass ? "preserve guard evidence" : `repair ${guardId} before P2560 freeze`,
    current_verdict: pass ? "pass" : "blocked",
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ sourceLimitedExecution, componentRows, patchCandidateRows, diffReviewRows, applyReceiptRows, postApplyValidationRows, rollbackRows, consoleActionRows, passOwnerRows, handoffRows, guardRows }) {
  const unsafeFlags = [
    sourceLimitedExecution.summary.platform_human_approved_limited_execution_status !== SOURCE_READY_STATUS,
    sourceLimitedExecution.summary.write_action_allowed_now,
    sourceLimitedExecution.summary.command_executed_now,
    componentRows.some((row) => row.current_verdict !== "pass"),
    patchCandidateRows.some((row) => row.patch_generated_now || row.direct_apply_allowed_now || row.write_action_allowed_now),
    diffReviewRows.some((row) => !row.review_required || row.apply_allowed_without_review),
    applyReceiptRows.some((row) => row.receipt_applied_now || row.apply_enabled_by_receipt_now || row.protected_action_allowed_now),
    postApplyValidationRows.some((row) => !row.post_apply_required || row.validation_run_now || row.raw_output_allowed),
    rollbackRows.some((row) => !row.rollback_target_required || row.rollback_executed_now),
    consoleActionRows.some((row) => row.method !== "GET" || row.mutation_route || row.patch_apply_route || row.receipt_application_route || row.protected_action_route || row.server_started),
    passOwnerRows.some((row) => !row.owner_required || row.agent_final_pass_allowed || !row.human_final_authority_required),
    handoffRows.some((row) => row.event_plane_enabled_by_handoff || row.connector_write_enabled_by_handoff || row.production_ready_enabled_by_handoff),
    guardRows.some((row) => row.guard_status !== "ready"),
  ];
  return {
    schema_version: "controlled-write-boundary.v1",
    source_limited_execution_status: sourceLimitedExecution.summary.platform_human_approved_limited_execution_status,
    controlled_write_contract_ready: true,
    operator_console_v2_projection_ready: true,
    patch_candidate_generation_allowed_with_receipt: unsafeFlags.filter(Boolean).length === 0,
    patch_generated_now: false,
    patch_applied_now: false,
    mutation_performed: false,
    receipt_applied_now: false,
    post_apply_validation_run_now: false,
    rollback_executed_now: false,
    operator_mutation_route_enabled: false,
    server_started: false,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    direct_write_allowed_now: false,
    protected_action_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    raw_material_access_allowed_now: false,
    agent_final_pass_allowed_now: false,
    p2561_ready_as_next_goal: unsafeFlags.filter(Boolean).length === 0,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, limitedExecutionLedger, controlledWriteLedger, roadmapDoc, sourceLimitedExecution, componentRows, patchCandidateRows, diffReviewRows, applyReceiptRows, postApplyValidationRows, rollbackRows, consoleActionRows, passOwnerRows, handoffRows, guardRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json must register platform:controlled-write-operator-console-v2"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include platform:controlled-write-operator-console-v2 -- --check"),
    validationItem("source.limited_execution", "source_ready", sourceLimitedExecution.summary.platform_human_approved_limited_execution_status === SOURCE_READY_STATUS, "source limited execution must be ready"),
    validationItem("source.no_write", "source_ready", sourceLimitedExecution.summary.write_action_allowed_now === false && sourceLimitedExecution.summary.command_executed_now === false, "source must not enable write or execute command"),
    validationItem("ledger.limited_execution", "ledger", limitedExecutionLedger.available && limitedExecutionLedger.text.includes(SOURCE_COMMAND_NAME), "limited execution ledger must be present"),
    validationItem("ledger.controlled_write", "ledger", controlledWriteLedger.available && controlledWriteLedger.text.includes("P2401-P2560") && controlledWriteLedger.text.includes(COMMAND_NAME), "controlled write ledger must be present"),
    validationItem("roadmap.controlled_write", "roadmap", roadmapDoc.available && roadmapDoc.text.includes("P2401-P2560") && roadmapDoc.text.includes("Controlled Write and Operator Console v2"), "roadmap must reflect controlled write and operator console v2"),
    validationItem("components.count", "component_rows", componentRows.length === 8, "all controlled write component rows must exist"),
    validationItem("patch.count", "patch_candidate_rows", patchCandidateRows.length === 7, "all patch candidate rows must exist"),
    validationItem("diff.count", "diff_review_rows", diffReviewRows.length === 6, "all diff review packet rows must exist"),
    validationItem("receipt.count", "apply_receipt_rows", applyReceiptRows.length === 6, "all patch apply receipt rows must exist"),
    validationItem("post_apply.count", "post_apply_rows", postApplyValidationRows.length === 6, "all post-apply validation rows must exist"),
    validationItem("rollback.count", "rollback_rows", rollbackRows.length === 5, "all rollback target rows must exist"),
    validationItem("console.count", "console_rows", consoleActionRows.length === 7, "all operator console v2 route rows must exist"),
    validationItem("owners.count", "pass_owner_rows", passOwnerRows.length === 5, "all PASS owner rows must exist"),
    validationItem("handoffs.count", "handoff_rows", handoffRows.length === 3, "all controlled write handoff rows must exist"),
    validationItem("patch.no_apply", "unsafe_invariants", patchCandidateRows.every((row) => row.patch_generated_now === false && row.direct_apply_allowed_now === false && row.write_action_allowed_now === false), "patch candidates must not apply or write now"),
    validationItem("console.read_only", "unsafe_invariants", consoleActionRows.every((row) => row.method === "GET" && row.mutation_route === false && row.patch_apply_route === false), "operator console v2 must be read-only projection"),
    validationItem("receipts.not_applied", "unsafe_invariants", applyReceiptRows.every((row) => row.receipt_applied_now === false && row.apply_enabled_by_receipt_now === false), "apply receipts must not be applied now"),
    validationItem("guards.ready", "guard_rows", guardRows.every((row) => row.guard_status === "ready"), "all controlled write guards must be ready"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_write", "unsafe_invariants", boundary.patch_applied_now === false && boundary.write_action_allowed_now === false && boundary.direct_write_allowed_now === false, "controlled write contract must not apply patches or open writes now"),
  ];
}

function buildSummary({ sourceLimitedExecution, componentRows, patchCandidateRows, diffReviewRows, applyReceiptRows, postApplyValidationRows, rollbackRows, consoleActionRows, passOwnerRows, handoffRows, guardRows, boundary, validation }) {
  return {
    schema_version: "platform-controlled-write-operator-console-v2-summary.v1",
    platform_controlled_write_operator_console_v2_status: validation.valid && boundary.p2561_ready_as_next_goal ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_limited_execution_status: sourceLimitedExecution.summary.platform_human_approved_limited_execution_status,
    component_count: componentRows.length,
    patch_candidate_count: patchCandidateRows.length,
    diff_review_packet_count: diffReviewRows.length,
    patch_apply_receipt_count: applyReceiptRows.length,
    post_apply_validation_count: postApplyValidationRows.length,
    rollback_target_count: rollbackRows.length,
    operator_console_action_count: consoleActionRows.length,
    pass_owner_count: passOwnerRows.length,
    handoff_count: handoffRows.length,
    guard_count: guardRows.length,
    ready_guard_count: guardRows.filter((row) => row.guard_status === "ready").length,
    controlled_write_contract_ready: boundary.controlled_write_contract_ready,
    operator_console_v2_projection_ready: boundary.operator_console_v2_projection_ready,
    patch_candidate_generation_allowed_with_receipt: boundary.patch_candidate_generation_allowed_with_receipt,
    p2561_ready_as_next_goal: boundary.p2561_ready_as_next_goal,
    patch_generated_now: boundary.patch_generated_now,
    patch_applied_now: boundary.patch_applied_now,
    mutation_performed: boundary.mutation_performed,
    receipt_applied_now: boundary.receipt_applied_now,
    post_apply_validation_run_now: boundary.post_apply_validation_run_now,
    rollback_executed_now: boundary.rollback_executed_now,
    operator_mutation_route_enabled: boundary.operator_mutation_route_enabled,
    runtime_execution_allowed_now: boundary.runtime_execution_allowed_now,
    write_action_allowed_now: boundary.write_action_allowed_now,
    direct_write_allowed_now: boundary.direct_write_allowed_now,
    protected_action_execution_allowed_now: boundary.protected_action_execution_allowed_now,
    receipt_application_allowed_now: boundary.receipt_application_allowed_now,
    raw_material_access_allowed_now: boundary.raw_material_access_allowed_now,
    agent_final_pass_allowed_now: boundary.agent_final_pass_allowed_now,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function passRow(fields) {
  return {
    ...fields,
    current_verdict: "pass",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Platform Controlled Write and Operator Console v2",
    "",
    `Status: ${result.summary.platform_controlled_write_operator_console_v2_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Source limited execution status: ${result.summary.source_limited_execution_status}`,
    `Components: ${result.summary.component_count}`,
    `Patch candidates: ${result.summary.patch_candidate_count}`,
    `Diff review packets: ${result.summary.diff_review_packet_count}`,
    `Patch apply receipts: ${result.summary.patch_apply_receipt_count}`,
    `Post-apply validations: ${result.summary.post_apply_validation_count}`,
    `Rollback targets: ${result.summary.rollback_target_count}`,
    `Operator console actions: ${result.summary.operator_console_action_count}`,
    `PASS owners: ${result.summary.pass_owner_count}`,
    `P2561 ready as next goal: ${result.summary.p2561_ready_as_next_goal}`,
    `Patch candidate generation allowed with receipt: ${result.summary.patch_candidate_generation_allowed_with_receipt}`,
    `Patch generated now: ${result.summary.patch_generated_now}`,
    `Patch applied now: ${result.summary.patch_applied_now}`,
    `Write action allowed now: ${result.summary.write_action_allowed_now}`,
    `Direct write allowed now: ${result.summary.direct_write_allowed_now}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Start P2561-P2720 Memory Bank, Storage/Event, and Observability Plane. This program defines controlled write and operator console contracts, but it does not generate patches, apply patches, apply receipts, mutate files, start servers, or open protected actions.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_CONTROLLED_WRITE_OPERATOR_CONSOLE_V2_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    limited_execution_ledger_path: options.limitedExecutionLedgerPath ?? defaults.limitedExecutionLedgerPath,
    controlled_write_ledger_path: options.controlledWriteLedgerPath ?? defaults.controlledWriteLedgerPath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
  };
}

async function readJsonSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, data: JSON.parse(text) };
  } catch (error) {
    return { available: false, path: sourcePath, error: error.message };
  }
}

async function readTextSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, text };
  } catch (error) {
    return { available: false, path: sourcePath, text: "", error: error.message };
  }
}

function validationItem(item_id, category, passed, message) {
  return {
    item_id,
    category,
    status: passed ? "pass" : "error",
    message,
  };
}

function summarizeValidation(items) {
  return {
    valid: items.every((item) => item.status === "pass"),
    errors: items.filter((item) => item.status !== "pass").map((item) => ({ path: item.item_id, message: item.message })),
  };
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, collectionName, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection: collectionName,
    count: items.length,
    items,
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
    outDir: undefined,
    schemaPath: undefined,
    packagePath: undefined,
    limitedExecutionLedgerPath: undefined,
    controlledWriteLedgerPath: undefined,
    roadmapDocPath: undefined,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (arg === "--schema") {
      args.schemaPath = argv[index + 1];
      index += 1;
    } else if (arg === "--package") {
      args.packagePath = argv[index + 1];
      index += 1;
    } else if (arg === "--limited-execution-ledger") {
      args.limitedExecutionLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--controlled-write-ledger") {
      args.controlledWriteLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--roadmap-doc") {
      args.roadmapDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-controlled-write-operator-console-v2.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --limited-execution-ledger <path>
  --controlled-write-ledger <path>
  --roadmap-doc <path>            Long-range roadmap document path.
  --help                          Show this help.
`);
}
