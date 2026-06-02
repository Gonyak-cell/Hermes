import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT, buildZenddIntegrationSetup } from "./zendd-integration-setup.mjs";
import { buildZenddSafePatchLane } from "./zendd-safe-patch-lane.mjs";
import { buildZenddProtectedActionEscalation } from "./zendd-protected-action-escalation.mjs";

export const DEFAULT_ZENDD_DIFF_REVIEW_ROLLBACK_BINDING_OUT_DIR = "artifacts/zendd-diff-review-rollback-binding/latest";
export const DEFAULT_ZENDD_DIFF_REVIEW_ROLLBACK_BINDING_INPUTS = {
  schemaPath: "schemas/zendd-diff-review-rollback-binding.schema.json",
  packagePath: "package.json",
  integrationPhaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  developmentPhaseLedgerPath: "docs/zendd-hermes-development-operations-phase-ledger.md",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-diff-review-rollback-binding";
const SAFE_PATCH_LANE_COMMAND_NAME = "project:zendd-safe-patch-lane";
const PROTECTED_ACTION_ESCALATION_COMMAND_NAME = "project:zendd-protected-action-escalation";
const INTEGRATION_SETUP_COMMAND_NAME = "project:zendd-integration-setup";
const SCHEMA_VERSION = "zendd-diff-review-rollback-binding.v1";
const CAPABILITY_ID = "project.zendd.diff_review_rollback_binding";
const PHASE_RANGE = "P861-P880";
const PHASE_SLOT = "P861";
const PREVIOUS_PHASE_SLOT = "P860";
const NEXT_PHASE_SLOT = "P881";
const READY_STATUS = "ready_for_zendd_diff_review_rollback_binding";

export async function runZenddDiffReviewRollbackBinding(options = {}) {
  const result = await buildZenddDiffReviewRollbackBinding(options);
  if (options.write !== false) await writeZenddDiffReviewRollbackBinding(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd diff review rollback binding failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddDiffReviewRollbackBinding(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_DIFF_REVIEW_ROLLBACK_BINDING_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const developmentPhaseLedger = await readTextSource(inputs.development_phase_ledger_path);
  const protectedEscalation = await buildZenddProtectedActionEscalation({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    integrationPhaseLedgerPath: inputs.integration_phase_ledger_path,
    developmentPhaseLedgerPath: inputs.development_phase_ledger_path,
    write: false,
  });
  const safePatchLane = await buildZenddSafePatchLane({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    integrationPhaseLedgerPath: inputs.integration_phase_ledger_path,
    developmentPhaseLedgerPath: inputs.development_phase_ledger_path,
    write: false,
  });
  const integrationSetup = await buildZenddIntegrationSetup({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    phaseLedgerPath: inputs.integration_phase_ledger_path,
    write: false,
  });

  const policy = buildDiffReviewPolicy(generatedAt, protectedEscalation, safePatchLane, integrationSetup);
  const diffRows = buildDiffInventoryRows(integrationSetup);
  const packetRows = buildDiffReviewPacketRows(diffRows);
  const rollbackRows = buildRollbackBindingRows(packetRows);
  const protectedBlockRows = buildProtectedDiffBlockRows(diffRows);
  const failClosedRows = buildFailClosedRows({ policy, protectedEscalation, safePatchLane, integrationSetup, diffRows, packetRows, rollbackRows, protectedBlockRows });
  const closeoutRows = buildCloseoutRows({ protectedEscalation, safePatchLane, integrationSetup, policy, diffRows, packetRows, rollbackRows, protectedBlockRows, failClosedRows });
  const anchor = buildAnchor({ packageJson, developmentPhaseLedger, protectedEscalation, safePatchLane, integrationSetup, policy, diffRows, packetRows, rollbackRows, protectedBlockRows, failClosedRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, developmentPhaseLedger, protectedEscalation, safePatchLane, integrationSetup, policy, diffRows, packetRows, rollbackRows, protectedBlockRows, failClosedRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, policy, diffRows, packetRows, rollbackRows, protectedBlockRows, failClosedRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_diff_review_rollback_binding_id: `zendd-diff-review-rollback-binding.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    diff_review_rollback_binding_anchor: anchor,
    source_protected_action_escalation_summary: protectedEscalation.summary,
    source_safe_patch_lane_summary: safePatchLane.summary,
    source_integration_setup_summary: integrationSetup.summary,
    diff_review_policy: policy,
    diff_inventory_rows: diffRows,
    diff_review_packet_rows: packetRows,
    rollback_binding_rows: rollbackRows,
    protected_diff_block_rows: protectedBlockRows,
    diff_review_fail_closed_rows: failClosedRows,
    diff_review_closeout_rows: closeoutRows,
    diff_review_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ protectedEscalation, safePatchLane, integrationSetup, diffRows, packetRows, rollbackRows, protectedBlockRows, failClosedRows, closeoutRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_diff_review_rollback_binding")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ protectedEscalation, safePatchLane, integrationSetup, diffRows, packetRows, rollbackRows, protectedBlockRows, failClosedRows, closeoutRows, validation: result.validation });
  result.summary.zendd_diff_review_rollback_binding_id = result.zendd_diff_review_rollback_binding_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddDiffReviewRollbackBinding(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-diff-review-rollback-binding.json"), serializableResult(result));
  await writeJson(path.join(outDir, "diff-review-policy.json"), result.diff_review_policy);
  await writeJson(path.join(outDir, "diff-inventory-rows.json"), collectionEnvelope("zendd-diff-inventory-rows.v1", "diff_inventory_rows", result.diff_inventory_rows, result.generated_at));
  await writeJson(path.join(outDir, "diff-review-packet-rows.json"), collectionEnvelope("zendd-diff-review-packet-rows.v1", "diff_review_packet_rows", result.diff_review_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "rollback-binding-rows.json"), collectionEnvelope("zendd-rollback-binding-rows.v1", "rollback_binding_rows", result.rollback_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-diff-block-rows.json"), collectionEnvelope("zendd-protected-diff-block-rows.v1", "protected_diff_block_rows", result.protected_diff_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "diff-review-fail-closed-rows.json"), collectionEnvelope("zendd-diff-review-fail-closed-rows.v1", "diff_review_fail_closed_rows", result.diff_review_fail_closed_rows, result.generated_at));
  await writeJson(path.join(outDir, "diff-review-closeout-rows.json"), collectionEnvelope("zendd-diff-review-closeout-rows.v1", "diff_review_closeout_rows", result.diff_review_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "diff-review-gate-rows.json"), collectionEnvelope("zendd-diff-review-gate-rows.v1", "diff_review_gate_rows", result.diff_review_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-diff-review-rollback-binding-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddDiffReviewRollbackBindingCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddDiffReviewRollbackBinding(args);
    console.log(`Zendd diff review rollback binding ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_diff_review_rollback_binding_status}`);
    console.log(`Dirty diff rows: ${result.summary.dirty_diff_row_count}`);
    console.log(`Review packets: ${result.summary.diff_review_packet_count}`);
    console.log(`Rollback bindings: ${result.summary.rollback_binding_count}`);
    console.log(`Protected diff blocks: ${result.summary.protected_diff_block_count}`);
    console.log(`Diff apply allowed: ${result.summary.diff_apply_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildDiffReviewPolicy(generatedAt, protectedEscalation, safePatchLane, integrationSetup) {
  return {
    schema_version: "zendd-diff-review-policy.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    project_id: "project.zendd",
    source_protected_action_escalation_ref: protectedEscalation.zendd_protected_action_escalation_id,
    source_safe_patch_lane_ref: safePatchLane.zendd_safe_patch_lane_id,
    source_integration_setup_ref: integrationSetup.zendd_integration_setup_id,
    review_packet_creation_allowed: true,
    rollback_binding_required: true,
    diff_apply_allowed_now: false,
    zendd_file_write_allowed_now: false,
    command_execution_allowed_now: false,
    protected_action_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    rollback_execution_allowed_now: false,
    raw_diff_storage_allowed: false,
    raw_file_content_read_allowed: false,
    raw_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    unreviewed_diff_pass_allowed: false,
    protected_path_pass_allowed_without_receipt: false,
    diff_pass_requires: [
      "diff_ref",
      "evidence_ref",
      "reviewer_ref",
      "hard_gate_ref",
      "rollback_target_ref",
      "human_receipt_ref_when_protected",
    ],
    blocked_status_requires: ["block_reason", "responsible_owner", "rollback_target_ref", "next_allowed_action"],
    next_allowed_action: "review diff packets and keep rollback targets bound before any future patch application",
    created_at: generatedAt,
  };
}

function buildDiffInventoryRows(integrationSetup) {
  return integrationSetup.dirty_tree_safety_inventory_rows.map((row, index) => {
    const dirty = row.status_code !== "clean";
    const key = normalizeKey(`${index + 1}.${row.path ?? row.row_id}`);
    const classification = effectivePathClassification(row.path, row.path_classification ?? "unclassified_external_change");
    const changeScope = changeScopeForPath(row.path, classification);
    const protectedPath = dirty && protectedPathForDiff(row.path, classification, changeScope);
    const humanReceiptRequired = dirty && (row.human_review_required || protectedPath);
    return {
      schema_version: "zendd-diff-inventory-row.v1",
      phase_slot: "P863-P866",
      row_id: `zendd-diff-inventory.row.${String(index + 1).padStart(4, "0")}`,
      project_id: "project.zendd",
      diff_ref: dirty ? `diff.zendd.${key}` : "diff.zendd.clean_worktree",
      source_dirty_tree_row_id: row.row_id,
      status_code: row.status_code,
      path: row.path,
      path_classification: classification,
      risk_level: row.risk_level ?? "high",
      change_scope: changeScope,
      protected_path: protectedPath,
      human_review_required: Boolean(row.human_review_required),
      human_receipt_required: humanReceiptRequired,
      human_receipt_ref: humanReceiptRequired ? `receipt.zendd.diff_review.${key}` : null,
      raw_file_content_read: false,
      raw_diff_storage_allowed: false,
      raw_material_copy_allowed_now: false,
      secret_read_allowed_now: false,
      diff_apply_allowed_now: false,
      zendd_file_write_allowed_now: false,
      command_execution_allowed_now: false,
      evidence_ref: dirty ? `evidence.zendd.diff_inventory.${key}` : "evidence.zendd.diff_inventory.clean_worktree",
      reviewer_ref: dirty ? `review.zendd.diff.${key}` : "review.zendd.diff.clean_worktree",
      hard_gate_ref: dirty ? `hard-gate.zendd.diff.${key}` : "hard-gate.zendd.diff.clean_worktree",
      rollback_target_ref: dirty ? `rollback-target.zendd.diff.${key}` : "rollback-target.zendd.clean_worktree.baseline",
      current_verdict: dirty ? "blocked" : "pass",
      block_reason: dirty ? "unreviewed_diff_requires_review_packet_and_rollback_binding" : null,
      responsible_owner: responsibleOwnerForDiff(classification, changeScope),
      next_allowed_action: dirty
        ? nextAllowedActionForDiff(classification, changeScope)
        : "continue with clean external checkout metadata",
    };
  });
}

function buildDiffReviewPacketRows(diffRows) {
  return diffRows.filter((row) => row.status_code !== "clean").map((row, index) => ({
    schema_version: "zendd-diff-review-packet-row.v1",
    phase_slot: "P867-P870",
    row_id: `zendd-diff-review-packet.row.${String(index + 1).padStart(4, "0")}`,
    project_id: "project.zendd",
    diff_review_packet_ref: `packet.zendd.diff_review.${normalizeKey(row.diff_ref)}`,
    diff_ref: row.diff_ref,
    source_diff_inventory_row_id: row.row_id,
    path: row.path,
    path_classification: row.path_classification,
    change_scope: row.change_scope,
    protected_path: row.protected_path,
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    human_receipt_required: true,
    human_receipt_ref: row.human_receipt_ref ?? `receipt.zendd.diff_review.${normalizeKey(row.diff_ref)}`,
    rollback_target_ref: row.rollback_target_ref,
    packet_status: "pending_human_review",
    review_status: "pending_human_review",
    raw_file_content_read: false,
    raw_diff_payload_stored: false,
    raw_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    diff_apply_allowed_now: false,
    zendd_file_write_allowed_now: false,
    command_execution_allowed_now: false,
    pass_candidate_allowed_now: false,
    current_verdict: "blocked",
    block_reason: "diff_review_not_completed",
    responsible_owner: row.responsible_owner,
    next_allowed_action: "complete human diff review, preserve rollback target, and keep patch application disabled",
  }));
}

function buildRollbackBindingRows(packetRows) {
  return packetRows.map((row, index) => ({
    schema_version: "zendd-rollback-binding-row.v1",
    phase_slot: "P871-P873",
    row_id: `zendd-rollback-binding.row.${String(index + 1).padStart(4, "0")}`,
    project_id: "project.zendd",
    rollback_binding_ref: `rollback-binding.zendd.diff.${normalizeKey(row.diff_ref)}`,
    diff_review_packet_ref: row.diff_review_packet_ref,
    diff_ref: row.diff_ref,
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    rollback_target_ref: row.rollback_target_ref,
    rollback_target_status: "bound_pending_review",
    rollback_execution_allowed_now: false,
    zendd_file_write_allowed_now: false,
    diff_apply_allowed_now: false,
    current_verdict: "pass",
    block_reason: null,
    responsible_owner: row.responsible_owner,
    next_allowed_action: "keep rollback target attached until reviewed patch is explicitly applied in a later phase",
  }));
}

function buildProtectedDiffBlockRows(diffRows) {
  return diffRows.filter((row) => row.status_code !== "clean" && row.protected_path).map((row, index) => ({
    schema_version: "zendd-protected-diff-block-row.v1",
    phase_slot: "P874-P877",
    row_id: `zendd-protected-diff-block.row.${String(index + 1).padStart(4, "0")}`,
    project_id: "project.zendd",
    protected_diff_block_ref: `block.zendd.protected_diff.${normalizeKey(row.diff_ref)}`,
    diff_ref: row.diff_ref,
    source_diff_inventory_row_id: row.row_id,
    path: row.path,
    path_classification: row.path_classification,
    change_scope: row.change_scope,
    risk_level: row.risk_level,
    protected_path: true,
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    documented_human_gate_ref: row.human_receipt_ref ?? `receipt.zendd.protected_diff.${normalizeKey(row.diff_ref)}`,
    human_receipt_required: true,
    rollback_target_ref: row.rollback_target_ref,
    raw_file_content_read: false,
    raw_diff_payload_stored: false,
    raw_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    diff_apply_allowed_now: false,
    zendd_file_write_allowed_now: false,
    command_execution_allowed_now: false,
    current_verdict: "blocked",
    block_reason: blockReasonForProtectedDiff(row.path_classification, row.change_scope),
    responsible_owner: row.responsible_owner,
    next_allowed_action: nextAllowedActionForDiff(row.path_classification, row.change_scope),
  }));
}

function buildFailClosedRows({ policy, protectedEscalation, safePatchLane, integrationSetup, diffRows, packetRows, rollbackRows, protectedBlockRows }) {
  const dirtyRows = diffRows.filter((row) => row.status_code !== "clean");
  const packetRefs = new Set(packetRows.map((row) => row.diff_ref));
  const rollbackRefs = new Set(rollbackRows.map((row) => row.diff_ref));
  const allRows = [...diffRows, ...packetRows, ...rollbackRows, ...protectedBlockRows];
  const rows = [
    ["source_protected_escalation_ready", protectedEscalation.validation.valid && protectedEscalation.summary.zendd_protected_action_escalation_status === "ready_for_zendd_protected_action_escalation", "P841-P860 protected action escalation is ready.", "repair protected action escalation"],
    ["source_safe_patch_lane_ready", safePatchLane.validation.valid && safePatchLane.summary.zendd_safe_patch_lane_status === "ready_for_zendd_safe_patch_lane", "P801-P820 safe patch lane is ready.", "repair safe patch lane"],
    ["dirty_tree_inventory_attached", integrationSetup.validation.valid && integrationSetup.dirty_tree_safety_inventory_rows.length > 0, "Dirty tree inventory is attached by metadata only.", "repair integration dirty tree inventory"],
    ["no_raw_content_or_diff_read", allRows.every(noRawReadOrStoredDiff) && !policy.raw_diff_storage_allowed && !policy.raw_file_content_read_allowed, "No raw file content or raw diff payload is read or stored.", "restore metadata-only diff review"],
    ["dirty_diffs_have_review_packets", dirtyRows.every((row) => packetRefs.has(row.diff_ref)), "Every dirty diff has a review packet.", "create missing review packets"],
    ["review_packets_blocked", packetRows.every(documentedReviewPacket), "Review packets remain blocked pending human review.", "block unreviewed diff packets"],
    ["rollback_targets_bound", packetRows.every((row) => rollbackRefs.has(row.diff_ref)) && rollbackRows.every(documentedRollbackBinding), "Every review packet has a rollback target binding.", "bind rollback targets"],
    ["protected_diffs_documented_block", protectedBlockRows.every(documentedProtectedBlock), "Protected diffs are documented BLOCK rows.", "document protected diff blocks"],
    ["no_execution_or_write", noExecutionAllowed(policy) && allRows.every(noRowExecution), "No diff apply, file write, command execution, receipt application, rollback, raw copy, or secret read is allowed.", "restore no-execution policy"],
    ["blocked_rows_have_next_action", [...diffRows.filter((row) => row.current_verdict === "blocked"), ...packetRows, ...protectedBlockRows].every(documentedBlock), "Every blocked diff row has owner, block reason, rollback target, and next action.", "complete blocked diff next actions"],
  ];
  return rows.map(([fixtureId, passed, message, nextAllowedAction], index) => ({
    schema_version: "zendd-diff-review-fail-closed-row.v1",
    phase_slot: "P878-P879",
    row_id: `zendd-diff-review-fail-closed.row.${String(index + 1).padStart(2, "0")}`,
    fixture_id: `fixture.zendd.diff_review.${fixtureId}`,
    project_id: "project.zendd",
    fixture_status: passed ? "pass" : "blocked",
    diff_apply_allowed_now: false,
    zendd_file_write_allowed_now: false,
    command_execution_allowed_now: false,
    protected_action_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    rollback_execution_allowed_now: false,
    raw_diff_storage_allowed: false,
    raw_file_content_read_allowed: false,
    raw_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    message,
    next_allowed_action: passed ? "continue_to_next_diff_review_fixture" : nextAllowedAction,
  }));
}

function buildCloseoutRows({ protectedEscalation, safePatchLane, integrationSetup, policy, diffRows, packetRows, rollbackRows, protectedBlockRows, failClosedRows }) {
  const dirtyRows = diffRows.filter((row) => row.status_code !== "clean");
  const packetRefs = new Set(packetRows.map((row) => row.diff_ref));
  const rollbackRefs = new Set(rollbackRows.map((row) => row.diff_ref));
  const ready = protectedEscalation.validation.valid
    && protectedEscalation.summary.zendd_protected_action_escalation_status === "ready_for_zendd_protected_action_escalation"
    && safePatchLane.validation.valid
    && safePatchLane.summary.zendd_safe_patch_lane_status === "ready_for_zendd_safe_patch_lane"
    && integrationSetup.validation.valid
    && policy.review_packet_creation_allowed
    && noExecutionAllowed(policy)
    && dirtyRows.every((row) => packetRefs.has(row.diff_ref))
    && packetRows.every(documentedReviewPacket)
    && packetRows.every((row) => rollbackRefs.has(row.diff_ref))
    && rollbackRows.every(documentedRollbackBinding)
    && protectedBlockRows.every(documentedProtectedBlock)
    && failClosedRows.every((row) => row.fixture_status === "pass");
  return [{
    schema_version: "zendd-diff-review-closeout-row.v1",
    phase_slot: "P880",
    row_id: "zendd-diff-review-closeout.p880",
    project_id: "project.zendd",
    closeout_status: ready ? READY_STATUS : "blocked",
    diff_review_rollback_binding_ready: ready,
    dirty_diff_row_count: dirtyRows.length,
    diff_review_packet_count: packetRows.length,
    rollback_binding_count: rollbackRows.length,
    protected_diff_block_count: protectedBlockRows.length,
    diff_apply_allowed_now: false,
    zendd_file_write_allowed_now: false,
    command_execution_allowed_now: false,
    protected_action_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    rollback_execution_allowed_now: false,
    raw_diff_storage_allowed: false,
    raw_file_content_read_allowed: false,
    raw_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    next_integration_phase_slot: NEXT_PHASE_SLOT,
    next_allowed_action: "advance to P881-P900 release candidate sandbox without applying Zendd diffs",
  }];
}

function buildAnchor({ packageJson, developmentPhaseLedger, protectedEscalation, safePatchLane, integrationSetup, policy, diffRows, packetRows, rollbackRows, protectedBlockRows, failClosedRows, closeoutRows }) {
  return {
    schema_version: "zendd-diff-review-rollback-binding-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    safe_patch_lane_command_name: SAFE_PATCH_LANE_COMMAND_NAME,
    protected_action_escalation_command_name: PROTECTED_ACTION_ESCALATION_COMMAND_NAME,
    integration_setup_command_name: INTEGRATION_SETUP_COMMAND_NAME,
    source_protected_action_escalation_ref: protectedEscalation.zendd_protected_action_escalation_id,
    source_protected_action_escalation_status: protectedEscalation.summary.zendd_protected_action_escalation_status,
    source_safe_patch_lane_ref: safePatchLane.zendd_safe_patch_lane_id,
    source_safe_patch_lane_status: safePatchLane.summary.zendd_safe_patch_lane_status,
    source_integration_setup_ref: integrationSetup.zendd_integration_setup_id,
    source_integration_setup_status: integrationSetup.summary.zendd_integration_setup_status,
    package_json_hash: packageJson.content_hash,
    development_phase_ledger_hash: developmentPhaseLedger.content_hash,
    policy_hash: hashValue(policy),
    diff_inventory_rows_hash: hashRows(diffRows, ["diff_ref", "status_code", "path_classification", "current_verdict"]),
    diff_review_packet_rows_hash: hashRows(packetRows, ["diff_review_packet_ref", "packet_status", "current_verdict"]),
    rollback_binding_rows_hash: hashRows(rollbackRows, ["rollback_binding_ref", "rollback_target_ref", "rollback_execution_allowed_now"]),
    protected_diff_block_rows_hash: hashRows(protectedBlockRows, ["protected_diff_block_ref", "block_reason", "next_allowed_action"]),
    fail_closed_rows_hash: hashRows(failClosedRows, ["fixture_id", "fixture_status", "message"]),
    closeout_rows_hash: hashRows(closeoutRows, ["closeout_status", "diff_review_rollback_binding_ready", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, developmentPhaseLedger, protectedEscalation, safePatchLane, integrationSetup, policy, diffRows, packetRows, rollbackRows, protectedBlockRows, failClosedRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const dirtyRows = diffRows.filter((row) => row.status_code !== "clean");
  const packetRefs = new Set(packetRows.map((row) => row.diff_ref));
  const rollbackRefs = new Set(rollbackRows.map((row) => row.diff_ref));
  return [
    gateRow("p861_protected_escalation_ready", "P861", protectedEscalation.validation.valid && protectedEscalation.summary.zendd_protected_action_escalation_status === "ready_for_zendd_protected_action_escalation", "P841-P860 protected action escalation is ready.", "repair protected action escalation"),
    gateRow("p862_safe_patch_and_inventory_ready", "P862", safePatchLane.validation.valid && integrationSetup.validation.valid, "Safe patch lane and dirty tree inventory sources are ready.", "repair safe patch lane or integration setup"),
    gateRow("p863_policy_freezes_raw_and_execution", "P863", policy.review_packet_creation_allowed && noExecutionAllowed(policy) && !policy.raw_diff_storage_allowed && !policy.raw_file_content_read_allowed, "Diff review policy allows packets only and blocks raw/execution paths.", "restore diff review policy"),
    gateRow("p864_dirty_inventory_metadata_only", "P864", diffRows.length >= 1 && diffRows.every(documentedDiffInventory), "Diff inventory rows use dirty tree metadata only and do not read raw diffs.", "complete diff inventory rows"),
    gateRow("p865_unreviewed_diffs_blocked", "P865-P866", dirtyRows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.rollback_target_ref), "Unreviewed dirty diffs are blocked with rollback targets.", "block dirty diffs before review"),
    gateRow("p867_review_packets_created", "P867-P870", dirtyRows.every((row) => packetRefs.has(row.diff_ref)) && packetRows.every(documentedReviewPacket), "Every dirty diff has a blocked review packet.", "create missing diff review packets"),
    gateRow("p871_rollback_bindings_created", "P871-P873", packetRows.every((row) => rollbackRefs.has(row.diff_ref)) && rollbackRows.every(documentedRollbackBinding), "Every review packet has a rollback target binding.", "create rollback binding rows"),
    gateRow("p874_protected_diffs_blocked", "P874-P877", protectedBlockRows.every(documentedProtectedBlock), "Protected diffs remain documented BLOCK rows.", "document protected diff blocks"),
    gateRow("p878_fail_closed", "P878-P879", failClosedRows.length >= 10 && failClosedRows.every((row) => row.fixture_status === "pass"), "Fail-closed fixtures prove no raw, no execution, and complete blocked next actions.", "complete fail-closed fixtures"),
    gateRow("p879_no_execution_or_write", "P879", noExecutionAllowed(policy) && [...diffRows, ...packetRows, ...rollbackRows, ...protectedBlockRows].every(noRowExecution), "P861-P880 performs no Zendd writes, command execution, diff apply, rollback, raw copy, or secret reads.", "restore no-execution diff review boundary"),
    gateRow("p880_closeout_ready", "P880", closeoutRows.every((row) => row.closeout_status === READY_STATUS && !row.diff_apply_allowed_now), "P861-P880 closes with diff review rollback binding ready.", "complete diff review closeout"),
    gateRow("package_script_registered", "P880", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("validate_chain_registered", "P880", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`), `${COMMAND_NAME} is included in npm run validate.`, `add ${COMMAND_NAME} to validate chain`),
    gateRow("development_phase_ledger_declared", "P880", developmentPhaseLedger.available && developmentPhaseLedger.text.includes("P861-P880") && developmentPhaseLedger.text.includes(COMMAND_NAME), "Development operations phase ledger declares P861-P880.", "record P861-P880 in phase ledger"),
  ];
}

function buildValidationItems({ gateRows, policy, diffRows, packetRows, rollbackRows, protectedBlockRows, failClosedRows, closeoutRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "diff_review_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.no_execution", "diff_review_boundary", noExecutionAllowed(policy), "Diff review policy keeps execution disabled."));
  items.push(validationItem("policy.no_raw", "diff_review_boundary", !policy.raw_diff_storage_allowed && !policy.raw_file_content_read_allowed && !policy.raw_material_copy_allowed_now && !policy.secret_read_allowed_now, "Diff review policy keeps raw diff, raw file, raw material, and secret access disabled."));
  items.push(validationItem("diff_inventory.documented", "diff_inventory_boundary", diffRows.every(documentedDiffInventory), "Diff inventory rows are documented with evidence, gate, rollback, and next action."));
  items.push(validationItem("packets.blocked", "diff_review_boundary", packetRows.every(documentedReviewPacket), "Review packets are blocked pending human review."));
  items.push(validationItem("rollback.bound", "rollback_boundary", rollbackRows.every(documentedRollbackBinding), "Rollback bindings are documented and future-only."));
  items.push(validationItem("protected.documented_block", "protected_diff_boundary", protectedBlockRows.every(documentedProtectedBlock), "Protected diff blocks are documented."));
  items.push(validationItem("fail_closed.pass", "diff_review_boundary", failClosedRows.every((row) => row.fixture_status === "pass"), "Fail-closed fixtures pass."));
  items.push(validationItem("closeout.ready", "closeout_boundary", closeoutRows.every((row) => row.closeout_status === READY_STATUS && !row.diff_apply_allowed_now), "Closeout is ready without applying diffs."));
  return items;
}

function buildSummary({ protectedEscalation, safePatchLane, integrationSetup, diffRows, packetRows, rollbackRows, protectedBlockRows, failClosedRows, closeoutRows, validation }) {
  const dirtyRows = diffRows.filter((row) => row.status_code !== "clean");
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_diff_review_rollback_binding_status: validation.valid ? READY_STATUS : "documented_block_pending_diff_review_rollback_binding",
    source_protected_action_escalation_status: protectedEscalation.summary.zendd_protected_action_escalation_status,
    source_safe_patch_lane_status: safePatchLane.summary.zendd_safe_patch_lane_status,
    source_integration_setup_status: integrationSetup.summary.zendd_integration_setup_status,
    dirty_tree_row_count: integrationSetup.summary.dirty_tree_row_count,
    dirty_diff_row_count: dirtyRows.length,
    diff_inventory_row_count: diffRows.length,
    diff_review_packet_count: packetRows.length,
    rollback_binding_count: rollbackRows.length,
    protected_diff_block_count: protectedBlockRows.length,
    diff_review_fail_closed_count: failClosedRows.length,
    diff_review_closeout_ready: closeoutRows.every((row) => row.diff_review_rollback_binding_ready),
    diff_apply_allowed_now: false,
    zendd_file_write_allowed_now: false,
    command_execution_allowed_now: false,
    protected_action_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    rollback_execution_allowed_now: false,
    raw_diff_storage_allowed: false,
    raw_file_content_read_allowed: false,
    raw_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    validation_error_count: validation.errors.length,
  };
}

function documentedDiffInventory(row) {
  const common = Boolean(row.diff_ref)
    && Boolean(row.evidence_ref)
    && Boolean(row.reviewer_ref)
    && Boolean(row.hard_gate_ref)
    && Boolean(row.rollback_target_ref)
    && row.raw_file_content_read === false
    && row.raw_diff_storage_allowed === false
    && row.raw_material_copy_allowed_now === false
    && row.secret_read_allowed_now === false
    && row.diff_apply_allowed_now === false
    && row.zendd_file_write_allowed_now === false
    && row.command_execution_allowed_now === false
    && Boolean(row.responsible_owner)
    && Boolean(row.next_allowed_action);
  if (row.status_code === "clean") return common && row.current_verdict === "pass";
  return common
    && row.current_verdict === "blocked"
    && Boolean(row.block_reason);
}

function documentedReviewPacket(row) {
  return row.current_verdict === "blocked"
    && row.packet_status === "pending_human_review"
    && row.review_status === "pending_human_review"
    && row.human_receipt_required === true
    && row.raw_file_content_read === false
    && row.raw_diff_payload_stored === false
    && row.raw_material_copy_allowed_now === false
    && row.secret_read_allowed_now === false
    && row.diff_apply_allowed_now === false
    && row.zendd_file_write_allowed_now === false
    && row.command_execution_allowed_now === false
    && row.pass_candidate_allowed_now === false
    && Boolean(row.diff_review_packet_ref)
    && Boolean(row.evidence_ref)
    && Boolean(row.reviewer_ref)
    && Boolean(row.hard_gate_ref)
    && Boolean(row.human_receipt_ref)
    && Boolean(row.rollback_target_ref)
    && Boolean(row.block_reason)
    && Boolean(row.responsible_owner)
    && Boolean(row.next_allowed_action);
}

function documentedRollbackBinding(row) {
  return row.current_verdict === "pass"
    && row.rollback_target_status === "bound_pending_review"
    && row.rollback_execution_allowed_now === false
    && row.zendd_file_write_allowed_now === false
    && row.diff_apply_allowed_now === false
    && Boolean(row.rollback_binding_ref)
    && Boolean(row.diff_review_packet_ref)
    && Boolean(row.diff_ref)
    && Boolean(row.evidence_ref)
    && Boolean(row.reviewer_ref)
    && Boolean(row.hard_gate_ref)
    && Boolean(row.rollback_target_ref)
    && Boolean(row.responsible_owner)
    && Boolean(row.next_allowed_action);
}

function documentedProtectedBlock(row) {
  return row.current_verdict === "blocked"
    && row.protected_path === true
    && row.human_receipt_required === true
    && row.raw_file_content_read === false
    && row.raw_diff_payload_stored === false
    && row.raw_material_copy_allowed_now === false
    && row.secret_read_allowed_now === false
    && row.diff_apply_allowed_now === false
    && row.zendd_file_write_allowed_now === false
    && row.command_execution_allowed_now === false
    && Boolean(row.protected_diff_block_ref)
    && Boolean(row.diff_ref)
    && Boolean(row.evidence_ref)
    && Boolean(row.reviewer_ref)
    && Boolean(row.hard_gate_ref)
    && Boolean(row.documented_human_gate_ref)
    && Boolean(row.rollback_target_ref)
    && Boolean(row.block_reason)
    && Boolean(row.responsible_owner)
    && Boolean(row.next_allowed_action);
}

function documentedBlock(row) {
  return row.current_verdict === "blocked"
    && Boolean(row.block_reason)
    && Boolean(row.responsible_owner)
    && Boolean(row.rollback_target_ref)
    && Boolean(row.next_allowed_action);
}

function noRawReadOrStoredDiff(row) {
  return row.raw_file_content_read !== true
    && row.raw_file_content_read_allowed !== true
    && row.raw_diff_storage_allowed !== true
    && row.raw_diff_payload_stored !== true
    && row.raw_material_copy_allowed_now !== true
    && row.secret_read_allowed_now !== true;
}

function noRowExecution(row) {
  return row.diff_apply_allowed_now !== true
    && row.zendd_file_write_allowed_now !== true
    && row.command_execution_allowed_now !== true
    && row.protected_action_execution_allowed_now !== true
    && row.receipt_application_allowed_now !== true
    && row.rollback_execution_allowed_now !== true
    && row.raw_material_copy_allowed_now !== true
    && row.secret_read_allowed_now !== true;
}

function noExecutionAllowed(policy) {
  return policy.diff_apply_allowed_now === false
    && policy.zendd_file_write_allowed_now === false
    && policy.command_execution_allowed_now === false
    && policy.protected_action_execution_allowed_now === false
    && policy.receipt_application_allowed_now === false
    && policy.rollback_execution_allowed_now === false
    && policy.raw_material_copy_allowed_now === false
    && policy.secret_read_allowed_now === false;
}

function changeScopeForPath(pathValue, classification) {
  const lower = String(pathValue ?? "").toLowerCase();
  if (classification === "clean_worktree") return "clean_worktree";
  if (classification === "secret_or_environment_candidate") return "secret_or_env";
  if (classification === "domain_data_or_document_artifact") return "raw_material_or_document";
  if (classification === "generated_or_dependency_artifact") return "generated_or_dependency";
  if (/(^|\/)(alembic|migrations)(\/|$)|migration/.test(lower)) return "database_migration";
  if (/(^|\/)(dist|dist-electron|release|installer)(\/|$)/.test(lower)) return "release_or_package";
  if (/(^|\/)(receipts|approvals)(\/|$)/.test(lower)) return "receipt_or_approval";
  if (/(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|uv\.lock|poetry\.lock)$/.test(lower)) return "dependency_or_lockfile";
  if (lower.startsWith("frontend/")) return "frontend_source";
  if (lower.startsWith("backend/")) return "backend_source";
  if (lower.startsWith("electron/")) return "electron_source";
  if (lower.startsWith("scripts/")) return "script_source";
  if (lower.startsWith("docs/")) return "docs";
  if (classification === "source_or_test_change") return "source_or_test";
  return "unclassified";
}

function effectivePathClassification(pathValue, classification) {
  const lower = String(pathValue ?? "").toLowerCase();
  if (/(^|\/)(\.env|.*\.pem|.*\.key|.*secret.*|.*credential.*)/.test(lower)) return "secret_or_environment_candidate";
  if (/^(vdr|data|client-output|client_output)\//.test(lower) || /\.(csv|xlsx|xls|xlsm|docx|pptx|pdf|hwp|hwpx)$/i.test(String(pathValue ?? ""))) return "domain_data_or_document_artifact";
  if (/(^|\/)(node_modules|__pycache__|\.pytest_cache|dist|dist-electron|coverage|build|\.cache)(\/|$)/.test(lower) || /\.(log|tmp|cache)$/.test(lower)) return "generated_or_dependency_artifact";
  return classification;
}

function protectedPathForDiff(pathValue, classification, changeScope) {
  if (["secret_or_environment_candidate", "domain_data_or_document_artifact", "generated_or_dependency_artifact", "unclassified_external_change"].includes(classification)) return true;
  return ["database_migration", "release_or_package", "receipt_or_approval", "dependency_or_lockfile", "unclassified"].includes(changeScope)
    || /(^|\/)(\.env|.*secret.*|.*credential.*)/i.test(String(pathValue ?? ""));
}

function blockReasonForProtectedDiff(classification, changeScope) {
  if (classification === "secret_or_environment_candidate") return "secret_or_environment_diff_requires_user_triage";
  if (classification === "domain_data_or_document_artifact") return "raw_domain_material_diff_requires_reference_only_review";
  if (classification === "generated_or_dependency_artifact") return "generated_artifact_diff_excluded_from_patch_lane";
  if (changeScope === "database_migration") return "database_migration_diff_requires_protected_action_escalation";
  if (changeScope === "release_or_package") return "release_package_diff_requires_artifact_sandbox";
  if (changeScope === "receipt_or_approval") return "receipt_application_diff_requires_human_gate";
  if (changeScope === "dependency_or_lockfile") return "dependency_or_lockfile_diff_requires_command_evidence";
  if (classification === "unclassified_external_change" || changeScope === "unclassified") return "unclassified_diff_requires_classification";
  return "protected_diff_requires_human_review";
}

function responsibleOwnerForDiff(classification, changeScope) {
  if (classification === "secret_or_environment_candidate") return "security_operator";
  if (classification === "domain_data_or_document_artifact") return "legal_domain_operator";
  if (["database_migration", "release_or_package", "receipt_or_approval", "dependency_or_lockfile"].includes(changeScope)) return "protected_action_operator";
  return "zendd_maintainer";
}

function nextAllowedActionForDiff(classification, changeScope) {
  if (classification === "secret_or_environment_candidate") return "triage secret or environment candidate without reading raw values";
  if (classification === "domain_data_or_document_artifact") return "bind raw material by redacted evidence_ref and keep Hermes reference-only";
  if (classification === "generated_or_dependency_artifact") return "confirm ignore policy and exclude generated artifact from patch lane";
  if (changeScope === "database_migration") return "open protected migration work order with human receipt and rollback target";
  if (changeScope === "release_or_package") return "move to release candidate sandbox before any package action";
  if (changeScope === "receipt_or_approval") return "queue receipt validation without applying receipt effects";
  if (changeScope === "dependency_or_lockfile") return "attach command evidence before dependency or lockfile change can pass";
  if (classification === "unclassified_external_change" || changeScope === "unclassified") return "classify path and create review packet before any mutation";
  return "review diff packet and keep rollback target bound before any patch application";
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-diff-review-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_diff_review_gate" : nextAllowedAction,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_DIFF_REVIEW_ROLLBACK_BINDING_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_DIFF_REVIEW_ROLLBACK_BINDING_INPUTS.packagePath,
    integration_phase_ledger_path: options.integrationPhaseLedgerPath ?? DEFAULT_ZENDD_DIFF_REVIEW_ROLLBACK_BINDING_INPUTS.integrationPhaseLedgerPath,
    development_phase_ledger_path: options.developmentPhaseLedgerPath ?? DEFAULT_ZENDD_DIFF_REVIEW_ROLLBACK_BINDING_INPUTS.developmentPhaseLedgerPath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_DIFF_REVIEW_ROLLBACK_BINDING_INPUTS.zenddProjectRoot,
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
    } else if (arg === "--integration-ledger") {
      args.integrationPhaseLedgerPath = argv[++index];
    } else if (arg === "--development-ledger") {
      args.developmentPhaseLedgerPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: npm run ${COMMAND_NAME} -- [--check] [--zendd-root <path>] [--out-dir <path>]

Creates the P861-P880 Zendd diff review and rollback binding contract. --check
validates without reading raw diffs, storing raw file content, applying Zendd
diffs, writing Zendd files, running Zendd commands, applying receipts, executing
rollback, copying raw VDR/client material, reading secrets, or moving code.
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

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# Zendd Diff Review Rollback Binding Summary",
    "",
    `- Status: ${summary.zendd_diff_review_rollback_binding_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Dirty diff rows: ${summary.dirty_diff_row_count}`,
    `- Review packets: ${summary.diff_review_packet_count}`,
    `- Rollback bindings: ${summary.rollback_binding_count}`,
    `- Protected diff blocks: ${summary.protected_diff_block_count}`,
    `- Diff apply allowed: ${summary.diff_apply_allowed_now}`,
    `- Raw diff storage allowed: ${summary.raw_diff_storage_allowed}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
  ].join("\n");
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

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function dateStamp(value) {
  return String(value).replace(/[-:]/g, "").replace(/\..*$/, "Z");
}
