import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildZenddActiveOperatorDashboard } from "./zendd-active-operator-dashboard.mjs";
import { buildZenddHumanReceiptIntake } from "./zendd-human-receipt-intake.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";

export const DEFAULT_ZENDD_DEVELOPMENT_FREEZE_COCKPIT_OUT_DIR = "artifacts/zendd-development-freeze-cockpit/latest";
export const DEFAULT_ZENDD_DEVELOPMENT_FREEZE_COCKPIT_INPUTS = {
  schemaPath: "schemas/zendd-development-freeze-cockpit.schema.json",
  packagePath: "package.json",
  integrationPhaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  developmentPhaseLedgerPath: "docs/zendd-hermes-development-operations-phase-ledger.md",
  designTokensPath: "configs/hermes/operator-design-tokens.json",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-development-freeze-cockpit";
const ACTIVE_DASHBOARD_COMMAND_NAME = "project:zendd-active-operator-dashboard";
const HUMAN_RECEIPT_INTAKE_COMMAND_NAME = "project:zendd-human-receipt-intake";
const SCHEMA_VERSION = "zendd-development-freeze-cockpit.v1";
const CAPABILITY_ID = "project.zendd.development_freeze_cockpit";
const PHASE_RANGE = "P981-P1000";
const PHASE_SLOT = "P981";
const PREVIOUS_PHASE_SLOT = "P980";
const NEXT_PHASE_SLOT = "P1001";
const READY_STATUS = "ready_for_zendd_development_freeze_cockpit";

export async function runZenddDevelopmentFreezeCockpit(options = {}) {
  const result = await buildZenddDevelopmentFreezeCockpit(options);
  if (options.write !== false) await writeZenddDevelopmentFreezeCockpit(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd development freeze cockpit failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddDevelopmentFreezeCockpit(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_DEVELOPMENT_FREEZE_COCKPIT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const developmentPhaseLedger = await readTextSource(inputs.development_phase_ledger_path);
  const commonOptions = {
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    integrationPhaseLedgerPath: inputs.integration_phase_ledger_path,
    developmentPhaseLedgerPath: inputs.development_phase_ledger_path,
    write: false,
  };
  const activeDashboard = await buildZenddActiveOperatorDashboard({
    ...commonOptions,
    designTokensPath: inputs.design_tokens_path,
  });
  const humanReceiptIntake = await buildZenddHumanReceiptIntake(commonOptions);

  const policy = buildFreezePolicy(generatedAt, activeDashboard, humanReceiptIntake);
  const claimRows = buildFreezeClaimRows({ activeDashboard, humanReceiptIntake });
  const cockpitPanelRows = buildFreezeCockpitPanelRows({ activeDashboard, claimRows });
  const adjudicationRows = buildFreezeAdjudicationRows(claimRows);
  const failClosedRows = buildFailClosedRows({ policy, activeDashboard, humanReceiptIntake, claimRows, cockpitPanelRows, adjudicationRows });
  const closeoutRows = buildCloseoutRows({ policy, activeDashboard, humanReceiptIntake, claimRows, cockpitPanelRows, adjudicationRows, failClosedRows });
  const anchor = buildAnchor({ packageJson, developmentPhaseLedger, activeDashboard, humanReceiptIntake, policy, claimRows, cockpitPanelRows, adjudicationRows, failClosedRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, developmentPhaseLedger, activeDashboard, humanReceiptIntake, policy, claimRows, cockpitPanelRows, adjudicationRows, failClosedRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, policy, claimRows, cockpitPanelRows, adjudicationRows, failClosedRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_development_freeze_cockpit_id: `zendd-development-freeze-cockpit.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    development_freeze_cockpit_anchor: anchor,
    source_active_operator_dashboard_summary: activeDashboard.summary,
    source_human_receipt_intake_summary: humanReceiptIntake.summary,
    development_freeze_policy: policy,
    development_freeze_claim_rows: claimRows,
    development_freeze_cockpit_panel_rows: cockpitPanelRows,
    development_freeze_adjudication_rows: adjudicationRows,
    development_freeze_fail_closed_rows: failClosedRows,
    development_freeze_closeout_rows: closeoutRows,
    development_freeze_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ activeDashboard, humanReceiptIntake, claimRows, cockpitPanelRows, adjudicationRows, failClosedRows, closeoutRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_development_freeze_cockpit")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ activeDashboard, humanReceiptIntake, claimRows, cockpitPanelRows, adjudicationRows, failClosedRows, closeoutRows, validation: result.validation });
  result.summary.zendd_development_freeze_cockpit_id = result.zendd_development_freeze_cockpit_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddDevelopmentFreezeCockpit(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-development-freeze-cockpit.json"), serializableResult(result));
  await writeJson(path.join(outDir, "development-freeze-policy.json"), result.development_freeze_policy);
  await writeJson(path.join(outDir, "development-freeze-claim-rows.json"), collectionEnvelope("zendd-development-freeze-claim-rows.v1", "development_freeze_claim_rows", result.development_freeze_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "development-freeze-cockpit-panel-rows.json"), collectionEnvelope("zendd-development-freeze-cockpit-panel-rows.v1", "development_freeze_cockpit_panel_rows", result.development_freeze_cockpit_panel_rows, result.generated_at));
  await writeJson(path.join(outDir, "development-freeze-adjudication-rows.json"), collectionEnvelope("zendd-development-freeze-adjudication-rows.v1", "development_freeze_adjudication_rows", result.development_freeze_adjudication_rows, result.generated_at));
  await writeJson(path.join(outDir, "development-freeze-fail-closed-rows.json"), collectionEnvelope("zendd-development-freeze-fail-closed-rows.v1", "development_freeze_fail_closed_rows", result.development_freeze_fail_closed_rows, result.generated_at));
  await writeJson(path.join(outDir, "development-freeze-closeout-rows.json"), collectionEnvelope("zendd-development-freeze-closeout-rows.v1", "development_freeze_closeout_rows", result.development_freeze_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "development-freeze-gate-rows.json"), collectionEnvelope("zendd-development-freeze-gate-rows.v1", "development_freeze_gate_rows", result.development_freeze_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-development-freeze-cockpit-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddDevelopmentFreezeCockpitCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddDevelopmentFreezeCockpit(args);
    console.log(`Zendd development freeze cockpit ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_development_freeze_cockpit_status}`);
    console.log(`Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.freeze_claim_count}`);
    console.log(`Panels: ${result.summary.cockpit_panel_count}`);
    console.log(`Unsafe flags: ${result.summary.unsafe_flag_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildFreezePolicy(generatedAt, activeDashboard, humanReceiptIntake) {
  return {
    schema_version: "zendd-development-freeze-policy.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    project_id: "project.zendd",
    source_active_operator_dashboard_ref: activeDashboard.zendd_active_operator_dashboard_id,
    source_human_receipt_intake_ref: humanReceiptIntake.zendd_human_receipt_intake_id,
    freeze_adjudication_surface_creation_allowed: true,
    pass_without_evidence_allowed: false,
    pass_without_reviewer_or_gate_allowed: false,
    protected_pass_without_human_receipt_allowed: false,
    unsafe_true_pass_allowed: false,
    blocked_without_reason_allowed: false,
    blocked_without_owner_allowed: false,
    blocked_without_next_action_allowed: false,
    undocumented_block_allowed: false,
    server_started: false,
    route_mutation_performed: false,
    command_execution_allowed_now: false,
    protected_action_execution_allowed_now: false,
    recovery_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    pass_promotion_allowed_now: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    raw_log_storage_allowed: false,
    secret_read_allowed_now: false,
    final_pass_requires: ["claim_id", "evidence_ref", "reviewer_ref", "hard_gate_ref", "unsafe_flags_false"],
    final_block_requires: ["claim_id", "block_reason", "responsible_owner", "next_allowed_action", "documented_block"],
    protected_claim_requires: ["human_receipt_ref", "documented_human_gate_ref"],
    next_allowed_action: "inspect PASS/BLOCK freeze rows and keep Zendd mutation disabled until a future explicit approved phase",
    created_at: generatedAt,
  };
}

function buildFreezeClaimRows({ activeDashboard, humanReceiptIntake }) {
  const passClaims = buildPhaseReadinessClaims({ activeDashboard, humanReceiptIntake });
  const missingClaims = activeDashboard.active_dashboard_missing_input_rows.map((row, index) => blockedClaim({
    index,
    sourceType: "missing_input",
    sourceRef: row.source_ref,
    claimId: `claim.zendd.freeze.missing_input.${String(index + 1).padStart(3, "0")}`,
    evidenceRef: row.evidence_ref ?? `evidence.zendd.freeze.missing_input.${String(index + 1).padStart(3, "0")}`,
    hardGateRef: row.hard_gate_ref,
    humanReceiptRef: row.human_receipt_ref,
    blockReason: row.block_reason,
    responsibleOwner: row.responsible_owner,
    nextAllowedAction: row.next_allowed_action,
  }));
  const nextActionClaims = activeDashboard.active_dashboard_next_action_rows
    .filter((row) => row.current_verdict === "blocked")
    .map((row, index) => blockedClaim({
      index: index + missingClaims.length,
      sourceType: "next_action",
      sourceRef: row.source_ref,
      claimId: `claim.zendd.freeze.next_action.${String(index + 1).padStart(3, "0")}`,
      evidenceRef: `evidence.zendd.freeze.next_action.${String(index + 1).padStart(3, "0")}`,
      hardGateRef: `gate.zendd.freeze.next_action.${String(index + 1).padStart(3, "0")}`,
      humanReceiptRef: `receipt.zendd.freeze.next_action.${String(index + 1).padStart(3, "0")}`,
      blockReason: row.block_reason,
      responsibleOwner: row.responsible_owner,
      nextAllowedAction: row.next_allowed_action,
    }));
  return [...passClaims, ...missingClaims, ...nextActionClaims].map((row, index) => ({
    ...row,
    row_id: `zendd-development-freeze-claim.row.${String(index + 1).padStart(3, "0")}`,
  }));
}

function buildPhaseReadinessClaims({ activeDashboard, humanReceiptIntake }) {
  const dashboard = activeDashboard.summary;
  const command = activeDashboard.source_command_evidence_execution_bridge_summary;
  const recovery = activeDashboard.source_recovery_incident_drafts_summary;
  const phases = [
    ["P761-P780", "frontend_operation_shell", dashboard.source_frontend_operation_shell_status, "ready_for_zendd_frontend_operation_shell"],
    ["P781-P800", "work_order_intake", dashboard.source_work_order_intake_status, "ready_for_zendd_work_order_intake"],
    ["P801-P820", "safe_patch_lane", command.source_safe_patch_lane_status, "ready_for_zendd_safe_patch_lane"],
    ["P821-P840", "command_evidence_execution_bridge", dashboard.source_command_evidence_execution_bridge_status, "ready_for_zendd_command_evidence_execution_bridge"],
    ["P841-P860", "protected_action_escalation", dashboard.source_protected_action_escalation_status, "ready_for_zendd_protected_action_escalation"],
    ["P861-P880", "diff_review_rollback_binding", recovery.source_diff_review_rollback_binding_status, "ready_for_zendd_diff_review_rollback_binding"],
    ["P881-P900", "release_candidate_sandbox", recovery.source_release_candidate_sandbox_status, "ready_for_zendd_release_candidate_sandbox"],
    ["P901-P920", "vdr_ldd_workflow_adapter", humanReceiptIntake.summary.source_vdr_ldd_workflow_adapter_status, "ready_for_zendd_vdr_ldd_workflow_adapter"],
    ["P921-P940", "human_receipt_intake", recovery.source_human_receipt_intake_status, "ready_for_zendd_human_receipt_intake"],
    ["P941-P960", "recovery_incident_drafts", dashboard.source_recovery_incident_drafts_status, "ready_for_zendd_recovery_incident_drafts"],
    ["P961-P980", "active_operator_dashboard", dashboard.zendd_active_operator_dashboard_status, "ready_for_zendd_active_operator_dashboard"],
  ];
  return phases.map(([phaseRange, key, observedStatus, expectedStatus], index) => {
    const pass = observedStatus === expectedStatus;
    return {
      schema_version: "zendd-development-freeze-claim-row.v1",
      phase_slot: phaseRange,
      project_id: "project.zendd",
      claim_id: `claim.zendd.freeze.phase.${key}`,
      claim_type: "phase_readiness",
      source_type: "phase_summary",
      source_ref: `phase-summary.zendd.${key}`,
      source_status: observedStatus,
      expected_status: expectedStatus,
      evidence_ref: `evidence.zendd.freeze.phase.${key}`,
      reviewer_ref: `review.zendd.freeze.phase.${key}`,
      hard_gate_ref: `gate.zendd.freeze.phase.${key}`,
      protected_claim: false,
      human_receipt_required: false,
      human_receipt_ref: null,
      documented_human_gate_ref: null,
      rollback_target_ref: `rollback-target.zendd.freeze.phase.${key}`,
      unsafe_flags_false: true,
      current_verdict: pass ? "pass" : "blocked",
      block_reason: pass ? null : "source_phase_not_ready",
      responsible_owner: "integration_operator",
      next_allowed_action: pass ? "continue_to_next_freeze_claim" : `repair ${phaseRange} source phase before freeze closeout`,
      ordinal: index + 1,
    };
  });
}

function blockedClaim({ index, sourceType, sourceRef, claimId, evidenceRef, hardGateRef, humanReceiptRef, blockReason, responsibleOwner, nextAllowedAction }) {
  return {
    schema_version: "zendd-development-freeze-claim-row.v1",
    phase_slot: "P986-P991",
    project_id: "project.zendd",
    claim_id: claimId,
    claim_type: "documented_block",
    source_type: sourceType,
    source_ref: sourceRef,
    source_status: "blocked",
    expected_status: "documented_block",
    evidence_ref: evidenceRef,
    reviewer_ref: `review.zendd.freeze.block.${String(index + 1).padStart(3, "0")}`,
    hard_gate_ref: hardGateRef ?? `gate.zendd.freeze.block.${String(index + 1).padStart(3, "0")}`,
    protected_claim: true,
    human_receipt_required: true,
    human_receipt_ref: humanReceiptRef ?? `receipt.zendd.freeze.block.${String(index + 1).padStart(3, "0")}`,
    documented_human_gate_ref: hardGateRef ?? `human-gate.zendd.freeze.block.${String(index + 1).padStart(3, "0")}`,
    rollback_target_ref: `rollback-target.zendd.freeze.block.${String(index + 1).padStart(3, "0")}`,
    unsafe_flags_false: true,
    current_verdict: "blocked",
    block_reason: blockReason ?? "claim_requires_evidence_review_receipt_or_operator_action",
    responsible_owner: responsibleOwner ?? "integration_operator",
    next_allowed_action: nextAllowedAction ?? "document next allowed action before reconsidering claim",
  };
}

function buildFreezeCockpitPanelRows({ activeDashboard, claimRows }) {
  const passCount = claimRows.filter((row) => row.current_verdict === "pass").length;
  const blockedCount = claimRows.filter((row) => row.current_verdict === "blocked").length;
  const panels = [
    ["freeze_status", "Freeze status", 1, "ready_for_review"],
    ["pass_claims", "PASS claims", passCount, "phase_readiness_pass"],
    ["documented_blocks", "Documented BLOCK claims", blockedCount, "blocked_claims"],
    ["missing_inputs", "Missing inputs", activeDashboard.summary.active_dashboard_missing_input_count, "missing_input_queue"],
    ["next_actions", "Next actions", activeDashboard.summary.active_dashboard_next_action_count, "next_action_queue"],
    ["unsafe_flags", "Unsafe flags", claimRows.filter((row) => row.unsafe_flags_false !== true).length, "unsafe_flags_false_required"],
  ];
  return panels.map(([panelId, title, displayCount, sourceCollection], index) => ({
    schema_version: "zendd-development-freeze-cockpit-panel-row.v1",
    phase_slot: "P992-P994",
    row_id: `zendd-development-freeze-cockpit-panel.row.${String(index + 1).padStart(2, "0")}`,
    panel_id: panelId,
    title,
    display_count: displayCount,
    source_collection: sourceCollection,
    panel_status: "ready_read_only",
    read_only: true,
    current_verdict: "pass",
    server_started: false,
    route_mutation_performed: false,
    pass_promotion_allowed_now: false,
    next_allowed_action: "inspect freeze panel without applying PASS or executing actions",
  }));
}

function buildFreezeAdjudicationRows(claimRows) {
  return claimRows.map((row, index) => {
    const passReady = documentedPass(row);
    const blockReady = documentedBlock(row);
    return {
      schema_version: "zendd-development-freeze-adjudication-row.v1",
      phase_slot: "P995-P997",
      row_id: `zendd-development-freeze-adjudication.row.${String(index + 1).padStart(3, "0")}`,
      project_id: "project.zendd",
      claim_id: row.claim_id,
      source_ref: row.source_ref,
      current_verdict: row.current_verdict,
      pass_condition_satisfied: passReady,
      block_condition_satisfied: blockReady,
      evidence_ref_present: Boolean(row.evidence_ref),
      reviewer_ref_present: Boolean(row.reviewer_ref),
      hard_gate_ref_present: Boolean(row.hard_gate_ref),
      protected_human_receipt_present: row.protected_claim ? Boolean(row.human_receipt_ref && row.documented_human_gate_ref) : true,
      rollback_target_ref_present: Boolean(row.rollback_target_ref),
      unsafe_flags_false: row.unsafe_flags_false === true,
      block_reason_present: row.current_verdict === "blocked" ? Boolean(row.block_reason) : true,
      responsible_owner_present: Boolean(row.responsible_owner),
      next_allowed_action_present: Boolean(row.next_allowed_action),
      final_adjudication_status: passReady || blockReady ? "adjudicated" : "blocked",
      next_allowed_action: passReady || blockReady ? "continue_to_freeze_closeout" : "repair claim adjudication fields",
    };
  });
}

function buildFailClosedRows({ policy, activeDashboard, humanReceiptIntake, claimRows, cockpitPanelRows, adjudicationRows }) {
  const rows = [
    ["active_dashboard_ready", activeDashboard.validation.valid && activeDashboard.summary.zendd_active_operator_dashboard_status === "ready_for_zendd_active_operator_dashboard", "P961-P980 active dashboard is ready.", "repair active dashboard"],
    ["human_receipt_intake_ready", humanReceiptIntake.validation.valid && humanReceiptIntake.summary.zendd_human_receipt_intake_status === "ready_for_zendd_human_receipt_intake", "P921-P940 human receipt intake is ready.", "repair human receipt intake"],
    ["all_claims_adjudicated", claimRows.length >= 20 && claimRows.every((row) => documentedPass(row) || documentedBlock(row)), "Every freeze claim is PASS or documented BLOCK.", "repair claim rows"],
    ["pass_claims_have_evidence_review_gate", claimRows.filter((row) => row.current_verdict === "pass").every(documentedPass), "PASS rows have evidence, reviewer, hard gate, rollback target, and unsafe false.", "repair PASS rows"],
    ["protected_blocks_have_receipts", claimRows.filter((row) => row.protected_claim).every((row) => Boolean(row.human_receipt_ref && row.documented_human_gate_ref)), "Protected blocked rows document human receipt and gate refs.", "repair protected blocked rows"],
    ["blocked_claims_documented", claimRows.filter((row) => row.current_verdict === "blocked").every(documentedBlock), "BLOCK rows have block reason, owner, and next action.", "repair BLOCK rows"],
    ["unsafe_true_cannot_pass", claimRows.every((row) => row.current_verdict !== "pass" || row.unsafe_flags_false === true), "No unsafe true row can PASS.", "restore unsafe freeze gate"],
    ["cockpit_panels_read_only", cockpitPanelRows.length >= 6 && cockpitPanelRows.every(documentedPanel), "Cockpit panels are read-only.", "repair cockpit panels"],
    ["adjudication_rows_ready", adjudicationRows.length === claimRows.length && adjudicationRows.every((row) => row.final_adjudication_status === "adjudicated"), "Adjudication rows are ready.", "repair adjudication rows"],
    ["no_freeze_mutation", noFreezeMutation(policy), "Freeze cockpit performs no mutation, execution, receipt application, pass promotion, raw copy, raw log storage, or secret read.", "restore freeze no-mutation policy"],
  ];
  return rows.map(([fixtureId, passed, message, nextAllowedAction], index) => ({
    schema_version: "zendd-development-freeze-fail-closed-row.v1",
    phase_slot: "P998-P999",
    row_id: `zendd-development-freeze-fail-closed.row.${String(index + 1).padStart(2, "0")}`,
    fixture_id: `fixture.zendd.development_freeze.${fixtureId}`,
    project_id: "project.zendd",
    fixture_status: passed ? "pass" : "blocked",
    server_started: false,
    route_mutation_performed: false,
    command_execution_allowed_now: false,
    protected_action_execution_allowed_now: false,
    recovery_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    pass_promotion_allowed_now: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    raw_log_storage_allowed: false,
    secret_read_allowed_now: false,
    message,
    next_allowed_action: passed ? "continue_to_next_development_freeze_fixture" : nextAllowedAction,
  }));
}

function buildCloseoutRows({ policy, activeDashboard, humanReceiptIntake, claimRows, cockpitPanelRows, adjudicationRows, failClosedRows }) {
  const passCount = claimRows.filter((row) => row.current_verdict === "pass").length;
  const blockedCount = claimRows.filter((row) => row.current_verdict === "blocked").length;
  const unsafeFlagCount = claimRows.filter((row) => row.unsafe_flags_false !== true).length;
  const ready = activeDashboard.validation.valid
    && activeDashboard.summary.zendd_active_operator_dashboard_status === "ready_for_zendd_active_operator_dashboard"
    && humanReceiptIntake.validation.valid
    && humanReceiptIntake.summary.zendd_human_receipt_intake_status === "ready_for_zendd_human_receipt_intake"
    && noFreezeMutation(policy)
    && claimRows.every((row) => documentedPass(row) || documentedBlock(row))
    && cockpitPanelRows.every(documentedPanel)
    && adjudicationRows.every((row) => row.final_adjudication_status === "adjudicated")
    && failClosedRows.every((row) => row.fixture_status === "pass");
  return [{
    schema_version: "zendd-development-freeze-closeout-row.v1",
    phase_slot: "P1000",
    row_id: "zendd-development-freeze-closeout.p1000",
    project_id: "project.zendd",
    closeout_status: ready ? READY_STATUS : "blocked",
    development_freeze_cockpit_ready: ready,
    freeze_claim_count: claimRows.length,
    pass_claim_count: passCount,
    blocked_claim_count: blockedCount,
    cockpit_panel_count: cockpitPanelRows.length,
    adjudication_row_count: adjudicationRows.length,
    unsafe_flag_count: unsafeFlagCount,
    server_started: false,
    route_mutation_performed: false,
    command_execution_allowed_now: false,
    protected_action_execution_allowed_now: false,
    recovery_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    pass_promotion_allowed_now: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    raw_log_storage_allowed: false,
    secret_read_allowed_now: false,
    next_integration_phase_slot: NEXT_PHASE_SLOT,
    next_allowed_action: "hold Zendd external adapter freeze; future work must open a new explicit approved phase",
  }];
}

function buildAnchor({ packageJson, developmentPhaseLedger, activeDashboard, humanReceiptIntake, policy, claimRows, cockpitPanelRows, adjudicationRows, failClosedRows, closeoutRows }) {
  return {
    schema_version: "zendd-development-freeze-cockpit-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    active_dashboard_command_name: ACTIVE_DASHBOARD_COMMAND_NAME,
    human_receipt_intake_command_name: HUMAN_RECEIPT_INTAKE_COMMAND_NAME,
    source_active_operator_dashboard_status: activeDashboard.summary.zendd_active_operator_dashboard_status,
    source_human_receipt_intake_status: humanReceiptIntake.summary.zendd_human_receipt_intake_status,
    package_json_hash: packageJson.content_hash,
    development_phase_ledger_hash: developmentPhaseLedger.content_hash,
    policy_hash: hashValue(policy),
    claim_rows_hash: hashRows(claimRows, ["claim_id", "current_verdict", "block_reason", "next_allowed_action"]),
    cockpit_panel_rows_hash: hashRows(cockpitPanelRows, ["panel_id", "display_count", "panel_status"]),
    adjudication_rows_hash: hashRows(adjudicationRows, ["claim_id", "final_adjudication_status", "unsafe_flags_false"]),
    fail_closed_rows_hash: hashRows(failClosedRows, ["fixture_id", "fixture_status", "message"]),
    closeout_rows_hash: hashRows(closeoutRows, ["closeout_status", "development_freeze_cockpit_ready", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, developmentPhaseLedger, activeDashboard, humanReceiptIntake, policy, claimRows, cockpitPanelRows, adjudicationRows, failClosedRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  return [
    gateRow("p981_active_dashboard_ready", "P981", activeDashboard.validation.valid && activeDashboard.summary.zendd_active_operator_dashboard_status === "ready_for_zendd_active_operator_dashboard", "P961-P980 active dashboard is ready.", "repair active dashboard"),
    gateRow("p982_human_receipt_source_ready", "P982", humanReceiptIntake.validation.valid && humanReceiptIntake.summary.zendd_human_receipt_intake_status === "ready_for_zendd_human_receipt_intake", "Human receipt source is ready.", "repair human receipt intake"),
    gateRow("p983_policy_freeze_only", "P983", policy.freeze_adjudication_surface_creation_allowed && noFreezeMutation(policy), "Freeze policy creates adjudication surface only.", "restore freeze policy"),
    gateRow("p984_phase_pass_claims", "P984-P985", claimRows.filter((row) => row.claim_type === "phase_readiness").every(documentedPass), "Phase readiness claims PASS with evidence, reviewer, gate, rollback, and unsafe false.", "repair phase readiness claims"),
    gateRow("p986_documented_blocks", "P986-P991", claimRows.filter((row) => row.current_verdict === "blocked").every(documentedBlock), "Blocked claims document reason, owner, receipt/gate when protected, rollback target, and next action.", "repair documented block rows"),
    gateRow("p992_cockpit_panels", "P992-P994", cockpitPanelRows.length >= 6 && cockpitPanelRows.every(documentedPanel), "Cockpit panels summarize PASS/BLOCK, missing inputs, next actions, and unsafe flags.", "repair cockpit panel rows"),
    gateRow("p995_adjudication_rows", "P995-P997", adjudicationRows.length === claimRows.length && adjudicationRows.every((row) => row.final_adjudication_status === "adjudicated"), "Every claim has adjudication row.", "repair adjudication rows"),
    gateRow("p998_fail_closed", "P998-P999", failClosedRows.length >= 10 && failClosedRows.every((row) => row.fixture_status === "pass"), "Fail-closed fixtures prove no evidence-less PASS, review-less PASS, receipt-less protected PASS, unsafe PASS, reasonless BLOCK, or actionless failure.", "repair fail-closed rows"),
    gateRow("p1000_closeout_ready", "P1000", closeoutRows.every((row) => row.closeout_status === READY_STATUS && row.development_freeze_cockpit_ready), "P981-P1000 closes with development freeze cockpit ready.", "complete freeze closeout"),
    gateRow("package_script_registered", "P1000", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("validate_chain_registered", "P1000", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`), `${COMMAND_NAME} is included in npm run validate.`, `add ${COMMAND_NAME} to validate chain`),
    gateRow("development_phase_ledger_declared", "P1000", developmentPhaseLedger.available && developmentPhaseLedger.text.includes("P981-P1000") && developmentPhaseLedger.text.includes(COMMAND_NAME), "Development operations phase ledger declares P981-P1000.", "record P981-P1000 in phase ledger"),
    gateRow("p1000_no_mutation", "P1000", noFreezeMutation(policy) && closeoutRows.every(noFreezeMutation), "Freeze cockpit performs no mutation or protected action.", "restore freeze cockpit boundary"),
  ];
}

function buildValidationItems({ gateRows, policy, claimRows, cockpitPanelRows, adjudicationRows, failClosedRows, closeoutRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "development_freeze_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.no_mutation", "freeze_boundary", noFreezeMutation(policy), "Freeze policy is no-mutation."));
  items.push(validationItem("claims.adjudicated", "freeze_claims", claimRows.every((row) => documentedPass(row) || documentedBlock(row)), "Every claim is PASS or documented BLOCK."));
  items.push(validationItem("claims.pass_fields", "freeze_claims", claimRows.filter((row) => row.current_verdict === "pass").every(documentedPass), "PASS claims have evidence, reviewer, hard gate, rollback target, and unsafe false."));
  items.push(validationItem("claims.block_fields", "freeze_claims", claimRows.filter((row) => row.current_verdict === "blocked").every(documentedBlock), "BLOCK claims have reason, owner, and next action."));
  items.push(validationItem("panels.ready", "freeze_cockpit", cockpitPanelRows.every(documentedPanel), "Cockpit panels are read-only."));
  items.push(validationItem("adjudication.ready", "freeze_cockpit", adjudicationRows.every((row) => row.final_adjudication_status === "adjudicated"), "Adjudication rows are ready."));
  items.push(validationItem("fail_closed.pass", "freeze_boundary", failClosedRows.every((row) => row.fixture_status === "pass"), "Fail-closed fixtures pass."));
  items.push(validationItem("closeout.ready", "closeout_boundary", closeoutRows.every((row) => row.closeout_status === READY_STATUS), "Closeout is ready."));
  return items;
}

function buildSummary({ activeDashboard, humanReceiptIntake, claimRows, cockpitPanelRows, adjudicationRows, failClosedRows, closeoutRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_development_freeze_cockpit_status: validation.valid ? READY_STATUS : "documented_block_pending_development_freeze_cockpit",
    source_active_operator_dashboard_status: activeDashboard.summary.zendd_active_operator_dashboard_status,
    source_human_receipt_intake_status: humanReceiptIntake.summary.zendd_human_receipt_intake_status,
    freeze_claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    cockpit_panel_count: cockpitPanelRows.length,
    adjudication_row_count: adjudicationRows.length,
    fail_closed_count: failClosedRows.length,
    development_freeze_cockpit_ready: closeoutRows.every((row) => row.development_freeze_cockpit_ready),
    unsafe_flag_count: claimRows.filter((row) => row.unsafe_flags_false !== true).length,
    server_started: false,
    route_mutation_performed: false,
    command_execution_allowed_now: false,
    protected_action_execution_allowed_now: false,
    recovery_execution_allowed_now: false,
    rollback_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    pass_promotion_allowed_now: false,
    raw_vdr_or_client_material_copy_allowed_now: false,
    raw_log_storage_allowed: false,
    secret_read_allowed_now: false,
    validation_error_count: validation.errors.length,
  };
}

function documentedPass(row) {
  return row.current_verdict === "pass"
    && Boolean(row.claim_id)
    && Boolean(row.evidence_ref)
    && Boolean(row.reviewer_ref)
    && Boolean(row.hard_gate_ref)
    && Boolean(row.rollback_target_ref)
    && row.unsafe_flags_false === true
    && (!row.protected_claim || Boolean(row.human_receipt_ref && row.documented_human_gate_ref));
}

function documentedBlock(row) {
  return row.current_verdict === "blocked"
    && Boolean(row.claim_id)
    && Boolean(row.block_reason)
    && Boolean(row.responsible_owner)
    && Boolean(row.next_allowed_action)
    && Boolean(row.rollback_target_ref)
    && row.unsafe_flags_false === true
    && (!row.protected_claim || Boolean(row.human_receipt_ref && row.documented_human_gate_ref));
}

function documentedPanel(row) {
  return row.panel_status === "ready_read_only"
    && row.read_only === true
    && row.current_verdict === "pass"
    && noFreezeMutation(row);
}

function noFreezeMutation(row) {
  return row.server_started !== true
    && row.route_mutation_performed !== true
    && row.command_execution_allowed_now !== true
    && row.protected_action_execution_allowed_now !== true
    && row.recovery_execution_allowed_now !== true
    && row.rollback_execution_allowed_now !== true
    && row.receipt_application_allowed_now !== true
    && row.pass_promotion_allowed_now !== true
    && row.raw_vdr_or_client_material_copy_allowed_now !== true
    && row.raw_log_storage_allowed !== true
    && row.secret_read_allowed_now !== true;
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-development-freeze-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_development_freeze_gate" : nextAllowedAction,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_DEVELOPMENT_FREEZE_COCKPIT_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_DEVELOPMENT_FREEZE_COCKPIT_INPUTS.packagePath,
    integration_phase_ledger_path: options.integrationPhaseLedgerPath ?? DEFAULT_ZENDD_DEVELOPMENT_FREEZE_COCKPIT_INPUTS.integrationPhaseLedgerPath,
    development_phase_ledger_path: options.developmentPhaseLedgerPath ?? DEFAULT_ZENDD_DEVELOPMENT_FREEZE_COCKPIT_INPUTS.developmentPhaseLedgerPath,
    design_tokens_path: options.designTokensPath ?? DEFAULT_ZENDD_DEVELOPMENT_FREEZE_COCKPIT_INPUTS.designTokensPath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_DEVELOPMENT_FREEZE_COCKPIT_INPUTS.zenddProjectRoot,
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
    } else if (arg === "--design-tokens") {
      args.designTokensPath = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: npm run ${COMMAND_NAME} -- [--check] [--zendd-root <path>] [--out-dir <path>]

Creates the P981-P1000 Zendd development freeze cockpit. --check verifies every
P761-P980 claim as PASS or documented BLOCK without executing commands,
recoveries, rollbacks, receipt application, PASS promotion, raw copy, raw log
storage, route mutation, server start, or secret reads.
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
    "# Zendd Development Freeze Cockpit Summary",
    "",
    `- Status: ${summary.zendd_development_freeze_cockpit_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Claims: pass ${summary.pass_claim_count}, blocked ${summary.blocked_claim_count}, total ${summary.freeze_claim_count}`,
    `- Cockpit panels: ${summary.cockpit_panel_count}`,
    `- Unsafe flags: ${summary.unsafe_flag_count}`,
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

function hashRows(rows, keys) {
  return hashValue(rows.map((row) => Object.fromEntries(keys.map((key) => [key, row[key]]))));
}

function hashValue(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}
