import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildNousOverlapAudit } from "./nous-overlap-audit.mjs";

export const DEFAULT_PLATFORM_NOUS_NON_ADOPTION_REVERSAL_OUT_DIR = "artifacts/platform-nous-non-adoption-reversal/latest";
export const DEFAULT_PLATFORM_NOUS_NON_ADOPTION_REVERSAL_INPUTS = {
  schemaPath: "schemas/platform-nous-non-adoption-reversal.schema.json",
  packagePath: "package.json",
  overlapAuditLedgerPath: "docs/nous-overlap-audit.md",
  reversalLedgerPath: "docs/nous-non-adoption-reversal.md",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p1200-p3200.md",
};

const COMMAND_NAME = "platform:nous-non-adoption-reversal";
const SOURCE_COMMAND_NAME = "platform:nous-overlap-audit";
const SCHEMA_VERSION = "platform-nous-non-adoption-reversal.v1";
const CAPABILITY_ID = "platform.nous_non_adoption_reversal";
const READY_STATUS = "ready_for_platform_nous_non_adoption_reversal";
const SOURCE_READY_STATUS = "ready_for_nous_overlap_audit";
const PROGRAM_RANGE = "P2041-P2120";
const PHASE_RANGE = "P2041-P2120";
const PHASE_SLOT = "P2041";
const PREVIOUS_PHASE_SLOT = "P2040";
const NEXT_PHASE_SLOT = "P2121";

const RESTORE_DECISION_SPECS = {
  p1201_agent_runtime_activation_bridge: ["restore_hermes_native", "runtime_activation_governance", "Restore as Hermes-owned receipt, policy, evidence, and runtime eligibility bridge."],
  p1221_approved_install_doctor_lane: ["restore_hermes_native", "install_doctor_health_evidence", "Restore as Hermes-owned install trust, doctor, health, and smoke evidence lane."],
  p1321_domain_agent_no_write_pilot: ["preserve_harness_native", "domain_policy_gate", "Preserve as domain authority and no-write policy classifier."],
  p1441_agent_operator_console_v0: ["restore_hermes_native", "operator_console_v2", "Restore as Hermes Operator Console v2 with PASS owner, block reason, receipt workspace, and action inbox."],
  p1501_kernel_contract_baseline: ["preserve_harness_native", "kernel_contracts", "Preserve as canonical claim/evidence/gate/check/receipt contract baseline."],
  p1561_kernel_spec_status_reconciliation: ["preserve_harness_native", "spec_status_reconciliation", "Preserve as spec/status drift and readiness reconciliation engine."],
  p1641_claim_evidence_gate_engine: ["preserve_harness_native", "claim_evidence_gate_engine", "Preserve as final PASS/BLOCK adjudicator."],
  p1721_artifact_check_receipt_engine: ["restore_hermes_native", "artifact_check_receipt_event_ledger", "Restore as full Hermes artifact, check, receipt, run, and event ledger."],
  p1801_kernel_projection_freeze: ["restore_hermes_native", "kernel_api_dashboard_projection", "Restore read-only projections first, then receipt-backed action inbox routes in later phases."],
  p1881_harness_native_cutover_adapter: ["restore_hermes_native", "harness_native_lane_control", "Restore lane policy, tool policy, MCP registry, job policy, and after-action evidence without enabling unchecked workers."],
  p1961_kernel_harness_native_cutover_freeze: ["preserve_harness_native", "kernel_cutover_checkpoint", "Preserve as P2040 checkpoint evidence."],
  p2041_limited_execution_program: ["reopen_as_planning_input", "limited_execution_lane", "Reopen as Hermes-native human-approved limited execution planning; execution remains disabled here."],
};

const CAPABILITY_RESTORE_SPECS = [
  ["hermes.runtime_api_control_plane", "P2121-P2240", "Restore runtime API control-plane contracts without starting a server in this tranche.", true, false],
  ["hermes.tool_gateway_policy", "P2121-P2240", "Restore tool gateway policy, allowlist, redaction, timeout, and evidence envelopes.", true, false],
  ["hermes.mcp_gateway_registry", "P2121-P2240", "Restore MCP registry and health evidence contracts without connecting live MCP servers here.", true, false],
  ["hermes.job_scheduler_ledger", "P2121-P2240", "Restore scheduled job ledger and pause/resume/run policy rows without running jobs here.", true, false],
  ["hermes.memory_bank", "P2561-P2720", "Restore Archive/Sync/Index/Search/Extract/Consolidate/Relate/Recall Memory Bank as Hermes-native.", false, false],
  ["hermes.operator_console_v2", "P2401-P2560", "Restore console action inbox, receipt workspace, PASS ownership, and gate visibility.", false, false],
  ["hermes.run_artifact_event_ledger", "P2561-P2720", "Restore append-only run, artifact, event, trace, audit, and cost ledgers.", false, false],
  ["hermes.limited_execution_lane", "P2241-P2400", "Restore human-approved allowlisted execution behind receipts, sandbox, redaction, timeout, and rollback.", true, false],
  ["hermes.controlled_write_lane", "P2401-P2560", "Restore generated patch, diff packet, human receipt apply, and post-apply validation.", true, true],
  ["hermes.connector_ingestion_lane", "P2721-P2880", "Restore connector ingestion, quarantine, classification, evidence spans, and retrieval-first recall.", false, false],
];

const HANDOFF_SPECS = [
  ["p2121_runtime_governance_restore", "P2121-P2240", "Restore Hermes runtime governance, API, MCP, tool, and job policy contracts."],
  ["p2241_limited_execution", "P2241-P2400", "Open limited execution only after human-approved receipt, hard hook, sandbox, timeout, redaction, and rollback gates."],
  ["p2401_controlled_write_console", "P2401-P2560", "Restore controlled write and Operator Console v2 without direct Agent final authority."],
  ["p2561_memory_event_plane", "P2561-P2720", "Restore Memory Bank, append-only event store, object store, trace, audit, and cost plane."],
  ["p2721_connectors_governance", "P2721-P2880", "Restore connector ingestion through quarantine, classification, evidence references, and policy gates."],
  ["p2881_domain_pack_ecosystem", "P2881-P3040", "Restore domain pack SDK, compatibility gate, contribution model, registry, and PASS owner contracts."],
  ["p3041_production_governance_freeze", "P3041-P3200", "Freeze L6 closed loop and L7 Work OS readiness without unsupported production claims."],
];

export async function runPlatformNousNonAdoptionReversal(options = {}) {
  const result = await buildPlatformNousNonAdoptionReversal(options);
  if (options.write !== false) await writePlatformNousNonAdoptionReversal(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform Nous non-adoption reversal failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformNousNonAdoptionReversal(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_NOUS_NON_ADOPTION_REVERSAL_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const overlapAuditLedger = await readTextSource(inputs.overlap_audit_ledger_path);
  const reversalLedger = await readTextSource(inputs.reversal_ledger_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const sourceNousOverlapAudit = options.sourceNousOverlapAudit ?? await buildNousOverlapAudit({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    overlapAuditLedgerPath: inputs.overlap_audit_ledger_path,
    write: false,
  });

  const anchor = buildAnchor({ packageJson, overlapAuditLedger, reversalLedger, roadmapDoc, sourceNousOverlapAudit });
  const adoptionDecision = buildAdoptionDecision(sourceNousOverlapAudit);
  const restorationRows = buildRestorationRows(sourceNousOverlapAudit);
  const capabilityRows = buildCapabilityRows();
  const handoffRows = buildHandoffRows();
  const guardRows = buildGuardRows({ restorationRows, capabilityRows, handoffRows });
  const boundary = buildBoundary({ sourceNousOverlapAudit, adoptionDecision, restorationRows, capabilityRows, handoffRows, guardRows });
  const validationItems = buildValidationItems({ packageJson, overlapAuditLedger, reversalLedger, roadmapDoc, sourceNousOverlapAudit, adoptionDecision, restorationRows, capabilityRows, handoffRows, guardRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_nous_non_adoption_reversal_id: `platform-nous-non-adoption-reversal.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    reversal_anchor: anchor,
    source_nous_overlap_audit_summary: sourceNousOverlapAudit.summary,
    nous_non_adoption_decision: adoptionDecision,
    surface_restoration_rows: restorationRows,
    restored_capability_rows: capabilityRows,
    next_phase_handoff_rows: handoffRows,
    reversal_guard_rows: guardRows,
    reversal_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceNousOverlapAudit, adoptionDecision, restorationRows, capabilityRows, handoffRows, guardRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_nous_non_adoption_reversal")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceNousOverlapAudit, adoptionDecision, restorationRows, capabilityRows, handoffRows, guardRows, boundary, validation: result.validation });
  result.summary.platform_nous_non_adoption_reversal_id = result.platform_nous_non_adoption_reversal_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformNousNonAdoptionReversal(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-nous-non-adoption-reversal.json"), serializableResult(result));
  await writeJson(path.join(outDir, "nous-non-adoption-decision.json"), result.nous_non_adoption_decision);
  await writeJson(path.join(outDir, "surface-restoration-rows.json"), collectionEnvelope("surface-restoration-rows.v1", "surface_restoration_rows", result.surface_restoration_rows, result.generated_at));
  await writeJson(path.join(outDir, "restored-capability-rows.json"), collectionEnvelope("restored-capability-rows.v1", "restored_capability_rows", result.restored_capability_rows, result.generated_at));
  await writeJson(path.join(outDir, "next-phase-handoff-rows.json"), collectionEnvelope("next-phase-handoff-rows.v1", "next_phase_handoff_rows", result.next_phase_handoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "reversal-guard-rows.json"), collectionEnvelope("reversal-guard-rows.v1", "reversal_guard_rows", result.reversal_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "reversal-boundary.json"), result.reversal_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-nous-non-adoption-reversal-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformNousNonAdoptionReversalCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformNousNonAdoptionReversal(args);
    console.log(`Platform Nous non-adoption reversal ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_nous_non_adoption_reversal_status}`);
    console.log(`Nous adopted: ${result.summary.nous_adopted}`);
    console.log(`Surfaces restored: ${result.summary.surface_restoration_count}`);
    console.log(`Capabilities restored: ${result.summary.restored_capability_count}`);
    console.log(`Next phase handoffs: ${result.summary.next_phase_handoff_count}`);
    console.log(`Runtime execution allowed now: ${result.summary.runtime_execution_allowed_now}`);
    console.log(`Write action allowed now: ${result.summary.write_action_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildAnchor({ packageJson, overlapAuditLedger, reversalLedger, roadmapDoc, sourceNousOverlapAudit }) {
  return {
    schema_version: "nous-non-adoption-reversal-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    overlap_audit_ledger_present: overlapAuditLedger.available,
    reversal_ledger_present: reversalLedger.available,
    roadmap_doc_present: roadmapDoc.available,
    source_nous_overlap_audit_status: sourceNousOverlapAudit.summary.nous_overlap_audit_status,
    source_surface_count: sourceNousOverlapAudit.summary.surface_count,
    source_blocked_next_phase_count: sourceNousOverlapAudit.summary.blocked_next_phase_count,
  };
}

function buildAdoptionDecision(sourceNousOverlapAudit) {
  return {
    schema_version: "nous-non-adoption-decision.v1",
    nous_adopted: false,
    source_nous_overlap_audit_status: sourceNousOverlapAudit.summary.nous_overlap_audit_status,
    source_p2041_suspension_was_true: sourceNousOverlapAudit.summary.p2041_suspended_pending_nous_overlap_audit === true,
    source_audit_future_policy_status: "superseded_by_nous_non_adoption",
    hermes_native_runtime_restore_planned: true,
    hermes_native_runtime_restore_allowed_now: true,
    p2041_reopened_as_hermes_native_planning: true,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    agent_final_pass_allowed_now: false,
    evidence_ref: "evidence.platform.nous_non_adoption.decision",
    reviewer_ref: "reviewer.platform_runtime_owner",
    hard_gate_ref: "gate.platform.nous_non_adoption.decision",
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "implement P2121-P2240 Hermes Runtime Governance Restore before opening execution",
    current_verdict: "pass",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function buildRestorationRows(sourceNousOverlapAudit) {
  return sourceNousOverlapAudit.harness_surface_classification_rows.map((sourceRow, index) => {
    const [restoreDecision, restoredFunction, restoreReason] = RESTORE_DECISION_SPECS[sourceRow.surface_id] ?? ["review_required", "unknown", "Surface requires manual restoration review."];
    return passRow({
      schema_version: "surface-restoration-row.v1",
      row_id: `surface.restoration.row.${String(index + 1).padStart(2, "0")}`,
      surface_id: sourceRow.surface_id,
      phase_range: sourceRow.phase_range,
      surface_name: sourceRow.surface_name,
      previous_classification: sourceRow.classification,
      restore_decision: restoreDecision,
      restored_function: restoredFunction,
      restore_reason: restoreReason,
      nous_adopted: false,
      hermes_native_owner: "platform_runtime_owner",
      execution_allowed_now: false,
      write_action_allowed_now: false,
      protected_action_allowed_now: false,
      requires_evidence: true,
      requires_reviewer: true,
      requires_hard_gate: true,
      evidence_ref: `evidence.platform.nous_non_adoption.surface.${sourceRow.surface_id}`,
      reviewer_ref: "reviewer.platform_runtime_restore",
      hard_gate_ref: `gate.platform.nous_non_adoption.surface.${sourceRow.surface_id}`,
      responsible_owner: "platform_runtime_owner",
      next_allowed_action: "use as P2121-P3200 restoration input only",
    });
  });
}

function buildCapabilityRows() {
  return CAPABILITY_RESTORE_SPECS.map(([capabilityId, targetPhaseRange, restoreReason, requiresReceipt, requiresRollback], index) => passRow({
    schema_version: "restored-capability-row.v1",
    row_id: `restored.capability.row.${String(index + 1).padStart(2, "0")}`,
    capability_id: capabilityId,
    target_phase_range: targetPhaseRange,
    restore_status: "planned_not_enabled",
    restore_reason: restoreReason,
    nous_adopted: false,
    hermes_native_owner: "platform_runtime_owner",
    requires_receipt: requiresReceipt,
    requires_rollback: requiresRollback,
    requires_evidence: true,
    requires_reviewer: true,
    requires_hard_gate: true,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_allowed_now: false,
    evidence_ref: `evidence.platform.nous_non_adoption.capability.${capabilityId}`,
    reviewer_ref: "reviewer.platform_runtime_restore",
    hard_gate_ref: `gate.platform.nous_non_adoption.capability.${capabilityId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: `implement ${targetPhaseRange} before enabling ${capabilityId}`,
  }));
}

function buildHandoffRows() {
  return HANDOFF_SPECS.map(([handoffId, phaseRange, description], index) => passRow({
    schema_version: "next-phase-handoff-row.v1",
    row_id: `next.phase.handoff.row.${String(index + 1).padStart(2, "0")}`,
    handoff_id: handoffId,
    phase_range: phaseRange,
    handoff_status: "planned_not_enabled",
    description,
    execution_enabled_by_handoff: false,
    write_enabled_by_handoff: false,
    protected_action_enabled_by_handoff: false,
    evidence_ref: `evidence.platform.nous_non_adoption.handoff.${handoffId}`,
    reviewer_ref: "reviewer.platform_runtime_restore",
    hard_gate_ref: `gate.platform.nous_non_adoption.handoff.${handoffId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "consume in order after P2041-P2120 reversal is frozen",
  }));
}

function buildGuardRows({ restorationRows, capabilityRows, handoffRows }) {
  const guards = [
    ["source_audit_superseded", true, "Prior Nous overlap future policy is superseded by non-adoption"],
    ["all_surfaces_mapped", restorationRows.length === 12 && restorationRows.every((row) => row.restore_decision !== "review_required"), "All prior surfaces must be mapped to Hermes-native restoration"],
    ["capabilities_planned_not_enabled", capabilityRows.length === 10 && capabilityRows.every((row) => row.restore_status === "planned_not_enabled"), "Restored capabilities must be planned but not enabled"],
    ["handoffs_planned_not_enabled", handoffRows.length === 7 && handoffRows.every((row) => row.handoff_status === "planned_not_enabled"), "Next phase handoffs must be planned but not enabled"],
    ["runtime_execution_closed", capabilityRows.every((row) => row.runtime_execution_allowed_now === false), "Runtime execution must remain closed"],
    ["write_action_closed", capabilityRows.every((row) => row.write_action_allowed_now === false), "Write actions must remain closed"],
    ["protected_action_closed", capabilityRows.every((row) => row.protected_action_allowed_now === false), "Protected actions must remain closed"],
    ["receipt_application_closed", true, "Receipt application is not opened by reversal"],
  ];
  return guards.map(([guardId, pass, description], index) => ({
    schema_version: "reversal-guard-row.v1",
    row_id: `reversal.guard.row.${String(index + 1).padStart(2, "0")}`,
    guard_id: guardId,
    guard_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${guardId}`,
    evidence_ref: `evidence.platform.nous_non_adoption.guard.${guardId}`,
    reviewer_ref: "reviewer.platform_runtime_restore",
    hard_gate_ref: `gate.platform.nous_non_adoption.guard.${guardId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: pass ? "preserve guard evidence" : `repair ${guardId} before P2120 freeze`,
    current_verdict: pass ? "pass" : "blocked",
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ sourceNousOverlapAudit, adoptionDecision, restorationRows, capabilityRows, handoffRows, guardRows }) {
  const unsafeFlags = [
    sourceNousOverlapAudit.summary.nous_overlap_audit_status !== SOURCE_READY_STATUS,
    adoptionDecision.nous_adopted !== false,
    adoptionDecision.hermes_native_runtime_restore_planned !== true,
    adoptionDecision.runtime_execution_allowed_now,
    adoptionDecision.write_action_allowed_now,
    adoptionDecision.protected_action_execution_allowed_now,
    adoptionDecision.receipt_application_allowed_now,
    adoptionDecision.agent_final_pass_allowed_now,
    restorationRows.some((row) => row.current_verdict !== "pass"),
    restorationRows.some((row) => row.execution_allowed_now || row.write_action_allowed_now || row.protected_action_allowed_now),
    capabilityRows.some((row) => row.runtime_execution_allowed_now || row.write_action_allowed_now || row.protected_action_allowed_now),
    handoffRows.some((row) => row.execution_enabled_by_handoff || row.write_enabled_by_handoff || row.protected_action_enabled_by_handoff),
    guardRows.some((row) => row.guard_status !== "ready"),
  ];
  return {
    schema_version: "nous-non-adoption-reversal-boundary.v1",
    source_nous_overlap_audit_status: sourceNousOverlapAudit.summary.nous_overlap_audit_status,
    nous_adopted: false,
    source_p2041_suspension_superseded: true,
    hermes_native_runtime_restore_planned: true,
    p2041_reopened_as_hermes_native_planning: true,
    p2121_ready_as_next_goal: unsafeFlags.filter(Boolean).length === 0,
    server_started: false,
    mutation_performed: false,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    raw_material_access_allowed_now: false,
    agent_final_pass_allowed_now: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, overlapAuditLedger, reversalLedger, roadmapDoc, sourceNousOverlapAudit, adoptionDecision, restorationRows, capabilityRows, handoffRows, guardRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json must register platform:nous-non-adoption-reversal"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include platform:nous-non-adoption-reversal -- --check"),
    validationItem("source.overlap_audit", "source_ready", sourceNousOverlapAudit.summary.nous_overlap_audit_status === SOURCE_READY_STATUS, "source Nous overlap audit must be ready"),
    validationItem("ledger.overlap_audit", "ledger", overlapAuditLedger.available && overlapAuditLedger.text.includes("P2041-P2120") && overlapAuditLedger.text.includes(SOURCE_COMMAND_NAME), "source overlap audit ledger must be present"),
    validationItem("ledger.reversal", "ledger", reversalLedger.available && reversalLedger.text.includes("Nous is not adopted") && reversalLedger.text.includes(COMMAND_NAME), "reversal ledger must declare Nous non-adoption"),
    validationItem("roadmap.non_adoption", "roadmap", roadmapDoc.available && roadmapDoc.text.includes("Nous is not adopted") && roadmapDoc.text.includes("P2041-P2120"), "roadmap must reflect Nous non-adoption"),
    validationItem("decision.nous_false", "decision", adoptionDecision.nous_adopted === false && adoptionDecision.source_audit_future_policy_status === "superseded_by_nous_non_adoption", "decision must set Nous adopted false and supersede future audit policy"),
    validationItem("restoration.count", "surface_rows", restorationRows.length === 12, "all source surfaces must be restored or preserved"),
    validationItem("restoration.no_adapter_only", "surface_rows", restorationRows.every((row) => ["restore_hermes_native", "preserve_harness_native", "reopen_as_planning_input"].includes(row.restore_decision)), "no restored row may remain adapter-only or dropped"),
    validationItem("capabilities.count", "capability_rows", capabilityRows.length === 10 && capabilityRows.every((row) => row.restore_status === "planned_not_enabled"), "all restored capabilities must be planned but not enabled"),
    validationItem("handoffs.count", "handoff_rows", handoffRows.length === 7 && handoffRows.every((row) => row.handoff_status === "planned_not_enabled"), "all next phase handoffs must be planned but not enabled"),
    validationItem("guards.ready", "guard_rows", guardRows.every((row) => row.guard_status === "ready"), "all reversal guards must be ready"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_execution", "unsafe_invariants", boundary.runtime_execution_allowed_now === false && boundary.write_action_allowed_now === false, "reversal must not enable runtime or write"),
  ];
}

function buildSummary({ sourceNousOverlapAudit, adoptionDecision, restorationRows, capabilityRows, handoffRows, guardRows, boundary, validation }) {
  return {
    schema_version: "platform-nous-non-adoption-reversal-summary.v1",
    platform_nous_non_adoption_reversal_status: validation.valid && boundary.p2121_ready_as_next_goal ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_nous_overlap_audit_status: sourceNousOverlapAudit.summary.nous_overlap_audit_status,
    source_p2041_suspension_superseded: boundary.source_p2041_suspension_superseded,
    nous_adopted: adoptionDecision.nous_adopted,
    hermes_native_runtime_restore_planned: adoptionDecision.hermes_native_runtime_restore_planned,
    p2041_reopened_as_hermes_native_planning: boundary.p2041_reopened_as_hermes_native_planning,
    surface_restoration_count: restorationRows.length,
    restored_surface_count: restorationRows.filter((row) => row.restore_decision === "restore_hermes_native").length,
    preserved_surface_count: restorationRows.filter((row) => row.restore_decision === "preserve_harness_native").length,
    reopened_surface_count: restorationRows.filter((row) => row.restore_decision === "reopen_as_planning_input").length,
    restored_capability_count: capabilityRows.length,
    next_phase_handoff_count: handoffRows.length,
    guard_count: guardRows.length,
    ready_guard_count: guardRows.filter((row) => row.guard_status === "ready").length,
    runtime_execution_allowed_now: boundary.runtime_execution_allowed_now,
    write_action_allowed_now: boundary.write_action_allowed_now,
    protected_action_execution_allowed_now: boundary.protected_action_execution_allowed_now,
    receipt_application_allowed_now: boundary.receipt_application_allowed_now,
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
    "# Platform Nous Non-Adoption Reversal",
    "",
    `Status: ${result.summary.platform_nous_non_adoption_reversal_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Source Nous overlap audit status: ${result.summary.source_nous_overlap_audit_status}`,
    `Nous adopted: ${result.summary.nous_adopted}`,
    `Source P2041 suspension superseded: ${result.summary.source_p2041_suspension_superseded}`,
    `Hermes-native runtime restore planned: ${result.summary.hermes_native_runtime_restore_planned}`,
    `Surface restoration rows: ${result.summary.surface_restoration_count}`,
    `Restored capabilities: ${result.summary.restored_capability_count}`,
    `Next phase handoffs: ${result.summary.next_phase_handoff_count}`,
    `Runtime execution allowed now: ${result.summary.runtime_execution_allowed_now}`,
    `Write action allowed now: ${result.summary.write_action_allowed_now}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Start P2121-P2240 Hermes Runtime Governance Restore. This reversal does not enable runtime execution, write action, protected action, receipt application, or Agent final PASS.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_NOUS_NON_ADOPTION_REVERSAL_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    overlap_audit_ledger_path: options.overlapAuditLedgerPath ?? defaults.overlapAuditLedgerPath,
    reversal_ledger_path: options.reversalLedgerPath ?? defaults.reversalLedgerPath,
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
    overlapAuditLedgerPath: undefined,
    reversalLedgerPath: undefined,
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
    } else if (arg === "--overlap-audit-ledger") {
      args.overlapAuditLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--reversal-ledger") {
      args.reversalLedgerPath = argv[index + 1];
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
  console.log(`Usage: node scripts/platform-nous-non-adoption-reversal.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --overlap-audit-ledger <path>   Source Nous overlap audit ledger path.
  --reversal-ledger <path>        Non-adoption reversal ledger path.
  --roadmap-doc <path>            Long-range roadmap document path.
  --help                          Show this help.
`);
}
