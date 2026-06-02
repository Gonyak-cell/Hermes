import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT, buildZenddIntegrationSetup } from "./zendd-integration-setup.mjs";
import { buildZenddWorkOrderIntake } from "./zendd-work-order-intake.mjs";

export const DEFAULT_ZENDD_SAFE_PATCH_LANE_OUT_DIR = "artifacts/zendd-safe-patch-lane/latest";
export const DEFAULT_ZENDD_SAFE_PATCH_LANE_INPUTS = {
  schemaPath: "schemas/zendd-safe-patch-lane.schema.json",
  packagePath: "package.json",
  integrationPhaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  developmentPhaseLedgerPath: "docs/zendd-hermes-development-operations-phase-ledger.md",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-safe-patch-lane";
const WORK_ORDER_INTAKE_COMMAND_NAME = "project:zendd-work-order-intake";
const INTEGRATION_SETUP_COMMAND_NAME = "project:zendd-integration-setup";
const SCHEMA_VERSION = "zendd-safe-patch-lane.v1";
const CAPABILITY_ID = "project.zendd.safe_patch_lane";
const PHASE_RANGE = "P801-P820";
const PHASE_SLOT = "P801";
const PREVIOUS_PHASE_SLOT = "P800";
const NEXT_PHASE_SLOT = "P821";
const READY_STATUS = "ready_for_zendd_safe_patch_lane";

export async function runZenddSafePatchLane(options = {}) {
  const result = await buildZenddSafePatchLane(options);
  if (options.write !== false) await writeZenddSafePatchLane(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd safe patch lane failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddSafePatchLane(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_SAFE_PATCH_LANE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const developmentPhaseLedger = await readTextSource(inputs.development_phase_ledger_path);
  const workOrderIntake = await buildZenddWorkOrderIntake({
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
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

  const patchPolicy = buildPatchPolicy(generatedAt, workOrderIntake, integrationSetup);
  const candidateRows = buildPatchCandidateRows(workOrderIntake.work_order_rows, integrationSetup);
  const scopeRows = buildPatchScopeRows();
  const dirtyGuardRows = buildDirtyTreeGuardRows(integrationSetup);
  const preflightRows = buildPatchPreflightRows(candidateRows, scopeRows, dirtyGuardRows);
  const protectedBlockRows = buildProtectedPatchBlockRows(workOrderIntake.protected_work_order_block_rows, scopeRows);
  const closeoutRows = buildCloseoutRows({ workOrderIntake, integrationSetup, patchPolicy, candidateRows, scopeRows, dirtyGuardRows, preflightRows, protectedBlockRows });
  const anchor = buildAnchor({ packageJson, developmentPhaseLedger, workOrderIntake, integrationSetup, patchPolicy, candidateRows, scopeRows, dirtyGuardRows, preflightRows, protectedBlockRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, developmentPhaseLedger, workOrderIntake, integrationSetup, patchPolicy, candidateRows, scopeRows, dirtyGuardRows, preflightRows, protectedBlockRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, patchPolicy, candidateRows, scopeRows, dirtyGuardRows, preflightRows, protectedBlockRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_safe_patch_lane_id: `zendd-safe-patch-lane.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    safe_patch_lane_anchor: anchor,
    work_order_intake_summary: workOrderIntake.summary,
    integration_setup_summary: integrationSetup.summary,
    safe_patch_policy: patchPolicy,
    patch_candidate_rows: candidateRows,
    patch_scope_rows: scopeRows,
    dirty_tree_guard_rows: dirtyGuardRows,
    patch_preflight_rows: preflightRows,
    protected_patch_block_rows: protectedBlockRows,
    safe_patch_lane_closeout_rows: closeoutRows,
    safe_patch_lane_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ workOrderIntake, integrationSetup, candidateRows, scopeRows, dirtyGuardRows, preflightRows, protectedBlockRows, closeoutRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_safe_patch_lane")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ workOrderIntake, integrationSetup, candidateRows, scopeRows, dirtyGuardRows, preflightRows, protectedBlockRows, closeoutRows, validation: result.validation });
  result.summary.zendd_safe_patch_lane_id = result.zendd_safe_patch_lane_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddSafePatchLane(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-safe-patch-lane.json"), serializableResult(result));
  await writeJson(path.join(outDir, "safe-patch-policy.json"), result.safe_patch_policy);
  await writeJson(path.join(outDir, "patch-candidate-rows.json"), collectionEnvelope("zendd-patch-candidate-rows.v1", "patch_candidate_rows", result.patch_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "patch-scope-rows.json"), collectionEnvelope("zendd-patch-scope-rows.v1", "patch_scope_rows", result.patch_scope_rows, result.generated_at));
  await writeJson(path.join(outDir, "dirty-tree-guard-rows.json"), collectionEnvelope("zendd-dirty-tree-guard-rows.v1", "dirty_tree_guard_rows", result.dirty_tree_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "patch-preflight-rows.json"), collectionEnvelope("zendd-patch-preflight-rows.v1", "patch_preflight_rows", result.patch_preflight_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-patch-block-rows.json"), collectionEnvelope("zendd-protected-patch-block-rows.v1", "protected_patch_block_rows", result.protected_patch_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "safe-patch-lane-closeout-rows.json"), collectionEnvelope("zendd-safe-patch-lane-closeout-rows.v1", "safe_patch_lane_closeout_rows", result.safe_patch_lane_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "safe-patch-lane-gate-rows.json"), collectionEnvelope("zendd-safe-patch-lane-gate-rows.v1", "safe_patch_lane_gate_rows", result.safe_patch_lane_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-safe-patch-lane-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddSafePatchLaneCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddSafePatchLane(args);
    console.log(`Zendd safe patch lane ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_safe_patch_lane_status}`);
    console.log(`Patch candidates: ${result.summary.patch_candidate_count}`);
    console.log(`Allowed scopes: ${result.summary.allowed_patch_scope_count}`);
    console.log(`Protected blocks: ${result.summary.protected_patch_block_count}`);
    console.log(`Dirty tree rows observed: ${result.summary.dirty_tree_row_count}`);
    console.log(`File write executed: ${result.summary.file_write_executed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPatchPolicy(generatedAt, workOrderIntake, integrationSetup) {
  return {
    schema_version: "zendd-safe-patch-policy.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    project_id: "project.zendd",
    source_work_order_intake_ref: workOrderIntake.zendd_work_order_intake_id,
    source_integration_setup_ref: integrationSetup.zendd_integration_setup_id,
    patch_lane_state: "open_for_scoped_non_protected_patch_candidates",
    patch_candidate_review_allowed: true,
    planning_only_pass_required: true,
    automatic_patch_allowed_now: false,
    direct_unscoped_patch_allowed_now: false,
    file_write_executed_by_this_command: false,
    zendd_file_write_allowed_now: false,
    command_execution_allowed_now: false,
    raw_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    database_migration_allowed_now: false,
    release_package_allowed_now: false,
    receipt_application_allowed_now: false,
    protected_action_execution_allowed: false,
    future_scoped_patch_allowed_if: [
      "work_order_current_verdict_pass",
      "work_order_status_accepted_for_planning_only",
      "patch_scope_is_non_protected",
      "dirty_tree_guard_documented",
      "rollback_target_ref_present",
      "reviewer_ref_present",
      "hard_gate_ref_present",
      "operator_explicitly_requests_patch_application",
    ],
    next_allowed_action: "prepare P821-P840 command evidence bridge before executing Zendd verification commands",
    created_at: generatedAt,
  };
}

function buildPatchCandidateRows(workOrderRows, integrationSetup) {
  const dirtyTreeRef = integrationSetup.zendd_integration_setup_id;
  return workOrderRows.filter((row) => row.current_verdict === "pass" && row.work_order_status === "accepted_for_planning_only")
    .map((row, index) => ({
      schema_version: "zendd-patch-candidate-row.v1",
      phase_slot: "P803-P806",
      patch_candidate_id: `patch-candidate.zendd.${normalizeKey(row.request_type)}`,
      row_id: `zendd-patch-candidate.row.${String(index + 1).padStart(2, "0")}`,
      work_order_id: row.work_order_id,
      request_type: row.request_type,
      domain_area: row.domain_area,
      patch_candidate_status: "eligible_for_safe_patch_lane_review",
      non_protected_scope: true,
      protected_action_class: row.protected_action_class,
      evidence_ref: row.evidence_ref,
      reviewer_ref: row.reviewer_ref,
      hard_gate_ref: row.hard_gate_ref,
      rollback_target_ref: row.rollback_target_ref,
      dirty_tree_guard_ref: dirtyTreeRef,
      current_verdict: "pass",
      block_reason: null,
      file_write_executed_now: false,
      command_execution_allowed_now: false,
      automatic_patch_allowed_now: false,
      next_allowed_action: "draft a scoped patch proposal only after operator selects this candidate",
    }));
}

function buildPatchScopeRows() {
  const rows = [
    ["frontend_source_patch", "frontend/**", "pass", null, "allow only scoped UI/source patches after explicit operator selection"],
    ["backend_deterministic_service_patch", "backend/app/**", "pass", null, "allow only non-migration deterministic service patches after explicit operator selection"],
    ["electron_shell_patch", "electron/**", "pass", null, "allow only scoped Electron shell patches after explicit operator selection"],
    ["raw_vdr_or_client_material", "vdr/**, data/**, client-output/**", "blocked", "raw_vdr_or_client_material_scope_protected", "replace with stable refs and redacted summaries"],
    ["secret_or_env_file", ".env*, **/*.pem, **/*.key, **/*secret*", "blocked", "secret_scope_protected", "use secret handle evidence without reading raw values"],
    ["database_migration", "backend/alembic/**, **/migrations/**", "blocked", "database_migration_protected", "escalate to protected migration work order"],
    ["release_or_package", "dist/**, dist-electron/**, release/**, package scripts", "blocked", "release_package_protected", "defer to release candidate sandbox"],
    ["receipt_application", "receipts/**, approvals/**", "blocked", "receipt_application_protected", "queue receipt validation without applying effect"],
    ["physical_code_movement", "submodule, subtree, workspace move, directory move", "blocked", "physical_movement_protected", "keep external adapter selected"],
  ];
  return rows.map(([scopeId, pathPattern, verdict, blockReason, nextAllowedAction], index) => ({
    schema_version: "zendd-patch-scope-row.v1",
    phase_slot: "P807-P810",
    row_id: `zendd-patch-scope.row.${String(index + 1).padStart(2, "0")}`,
    scope_id: scopeId,
    path_pattern: pathPattern,
    scope_status: verdict === "pass" ? "eligible_for_future_scoped_patch" : "documented_block_protected_scope",
    current_verdict: verdict,
    block_reason: blockReason,
    responsible_owner: verdict === "blocked" ? "protected_action_operator" : "zendd_maintainer",
    eligible_for_future_scoped_write: verdict === "pass",
    file_write_executed_now: false,
    command_execution_allowed_now: false,
    rollback_target_ref: verdict === "pass" ? "rollback-target.zendd.safe_patch_lane" : `rollback-target.zendd.${normalizeKey(scopeId)}`,
    next_allowed_action: nextAllowedAction,
  }));
}

function buildDirtyTreeGuardRows(integrationSetup) {
  const dirtyRows = integrationSetup.dirty_tree_safety_inventory_rows.filter((row) => row.status_code !== "clean");
  const highRiskRows = dirtyRows.filter((row) => row.risk_level === "high" || row.risk_level === "critical");
  return [
    {
      schema_version: "zendd-dirty-tree-guard-row.v1",
      phase_slot: "P811-P812",
      row_id: "zendd-dirty-tree-guard.inventory",
      guard_id: "dirty_tree_inventory_documented",
      source_integration_setup_ref: integrationSetup.zendd_integration_setup_id,
      dirty_tree_row_count: dirtyRows.length,
      high_risk_dirty_tree_row_count: highRiskRows.length,
      current_verdict: "pass",
      block_reason: null,
      responsible_owner: "integration_operator",
      file_write_executed_now: false,
      next_allowed_action: "keep dirty tree inventory attached to every patch candidate",
    },
    {
      schema_version: "zendd-dirty-tree-guard-row.v1",
      phase_slot: "P811-P812",
      row_id: "zendd-dirty-tree-guard.unscoped-write",
      guard_id: "unscoped_write_blocked_when_dirty_tree_present",
      source_integration_setup_ref: integrationSetup.zendd_integration_setup_id,
      dirty_tree_row_count: dirtyRows.length,
      high_risk_dirty_tree_row_count: highRiskRows.length,
      current_verdict: dirtyRows.length > 0 ? "blocked" : "pass",
      block_reason: dirtyRows.length > 0 ? "dirty_tree_present_requires_scoped_patch_review" : null,
      responsible_owner: "integration_operator",
      file_write_executed_now: false,
      next_allowed_action: dirtyRows.length > 0 ? "select a scoped patch candidate and preserve rollback target before any future write" : "keep clean checkout guard attached before future write",
    },
  ];
}

function buildPatchPreflightRows(candidateRows, scopeRows, dirtyGuardRows) {
  const allowedScopeIds = scopeRows.filter((row) => row.current_verdict === "pass").map((row) => row.scope_id);
  return candidateRows.map((candidate, index) => ({
    schema_version: "zendd-patch-preflight-row.v1",
    phase_slot: "P813-P815",
    row_id: `zendd-patch-preflight.row.${String(index + 1).padStart(2, "0")}`,
    patch_candidate_id: candidate.patch_candidate_id,
    work_order_id: candidate.work_order_id,
    allowed_scope_refs: allowedScopeIds,
    evidence_ref: candidate.evidence_ref,
    reviewer_ref: candidate.reviewer_ref,
    hard_gate_ref: candidate.hard_gate_ref,
    rollback_target_ref: candidate.rollback_target_ref,
    dirty_tree_guard_refs: dirtyGuardRows.map((row) => row.guard_id),
    preflight_status: "ready_for_future_patch_proposal",
    current_verdict: "pass",
    patch_execution_allowed_now: false,
    file_write_executed_now: false,
    next_allowed_action: "bind future patch proposal to command evidence and diff review before applying",
  }));
}

function buildProtectedPatchBlockRows(protectedWorkOrderBlockRows, scopeRows) {
  const workOrderBlocks = protectedWorkOrderBlockRows.map((row, index) => ({
    schema_version: "zendd-protected-patch-block-row.v1",
    phase_slot: "P816-P818",
    row_id: `zendd-protected-patch-block.work-order.${String(index + 1).padStart(2, "0")}`,
    block_source: "protected_work_order",
    source_ref: row.work_order_id,
    protected_action_class: row.protected_action_class,
    current_verdict: "blocked",
    block_reason: row.block_reason,
    responsible_owner: row.responsible_owner,
    evidence_ref: row.evidence_ref,
    hard_gate_ref: row.hard_gate_ref,
    human_receipt_required: row.human_receipt_required,
    rollback_target_ref: row.rollback_target_ref,
    file_write_executed_now: false,
    next_allowed_action: row.next_allowed_action,
  }));
  const scopeBlocks = scopeRows.filter((row) => row.current_verdict === "blocked").map((row, index) => ({
    schema_version: "zendd-protected-patch-block-row.v1",
    phase_slot: "P816-P818",
    row_id: `zendd-protected-patch-block.scope.${String(index + 1).padStart(2, "0")}`,
    block_source: "protected_scope",
    source_ref: row.scope_id,
    protected_action_class: row.scope_id,
    current_verdict: "blocked",
    block_reason: row.block_reason,
    responsible_owner: row.responsible_owner,
    evidence_ref: `evidence.zendd.safe_patch_scope.${normalizeKey(row.scope_id)}`,
    hard_gate_ref: `hard-gate.zendd.safe_patch_scope.${normalizeKey(row.scope_id)}`,
    human_receipt_required: true,
    rollback_target_ref: row.rollback_target_ref,
    file_write_executed_now: false,
    next_allowed_action: row.next_allowed_action,
  }));
  return [...workOrderBlocks, ...scopeBlocks];
}

function buildCloseoutRows({ workOrderIntake, integrationSetup, patchPolicy, candidateRows, scopeRows, dirtyGuardRows, preflightRows, protectedBlockRows }) {
  const ready = workOrderIntake.validation.valid
    && workOrderIntake.summary.zendd_work_order_intake_status === "ready_for_zendd_work_order_intake"
    && integrationSetup.validation.valid
    && patchPolicy.patch_candidate_review_allowed
    && !patchPolicy.file_write_executed_by_this_command
    && candidateRows.length >= 1
    && candidateRows.every((row) => row.current_verdict === "pass" && !row.file_write_executed_now)
    && scopeRows.filter((row) => row.current_verdict === "pass").length >= 3
    && scopeRows.filter((row) => row.current_verdict === "blocked").length >= 5
    && dirtyGuardRows.every((row) => row.file_write_executed_now === false && row.next_allowed_action)
    && preflightRows.every((row) => row.current_verdict === "pass" && !row.patch_execution_allowed_now)
    && protectedBlockRows.length >= 10
    && protectedBlockRows.every(documentedProtectedBlock);
  return [{
    schema_version: "zendd-safe-patch-lane-closeout-row.v1",
    phase_slot: "P820",
    closeout_status: ready ? READY_STATUS : "blocked",
    safe_patch_lane_ready: ready,
    patch_candidate_review_allowed: true,
    patch_candidate_count: candidateRows.length,
    protected_patch_block_count: protectedBlockRows.length,
    file_write_executed_now: false,
    automatic_patch_allowed_now: false,
    command_execution_allowed_now: false,
    raw_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    protected_action_execution_allowed: false,
    next_integration_phase_slot: NEXT_PHASE_SLOT,
    next_allowed_action: "advance to P821-P840 command evidence bridge before executing Zendd checks",
  }];
}

function buildAnchor({ packageJson, developmentPhaseLedger, workOrderIntake, integrationSetup, patchPolicy, candidateRows, scopeRows, dirtyGuardRows, preflightRows, protectedBlockRows, closeoutRows }) {
  return {
    schema_version: "zendd-safe-patch-lane-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    work_order_intake_command_name: WORK_ORDER_INTAKE_COMMAND_NAME,
    integration_setup_command_name: INTEGRATION_SETUP_COMMAND_NAME,
    source_work_order_intake_ref: workOrderIntake.zendd_work_order_intake_id,
    source_work_order_intake_status: workOrderIntake.summary.zendd_work_order_intake_status,
    source_integration_setup_ref: integrationSetup.zendd_integration_setup_id,
    source_integration_setup_status: integrationSetup.summary.zendd_integration_setup_status,
    package_json_hash: packageJson.content_hash,
    development_phase_ledger_hash: developmentPhaseLedger.content_hash,
    safe_patch_policy_hash: hashValue(patchPolicy),
    patch_candidate_rows_hash: hashRows(candidateRows, ["patch_candidate_id", "current_verdict", "next_allowed_action"]),
    patch_scope_rows_hash: hashRows(scopeRows, ["scope_id", "current_verdict", "block_reason"]),
    dirty_tree_guard_rows_hash: hashRows(dirtyGuardRows, ["guard_id", "current_verdict", "block_reason"]),
    patch_preflight_rows_hash: hashRows(preflightRows, ["patch_candidate_id", "current_verdict", "patch_execution_allowed_now"]),
    protected_patch_block_rows_hash: hashRows(protectedBlockRows, ["source_ref", "block_reason", "next_allowed_action"]),
    closeout_rows_hash: hashRows(closeoutRows, ["closeout_status", "safe_patch_lane_ready", "next_allowed_action"]),
  };
}

function buildGateRows({ packageJson, developmentPhaseLedger, workOrderIntake, integrationSetup, patchPolicy, candidateRows, scopeRows, dirtyGuardRows, preflightRows, protectedBlockRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validateScript = scripts.validate ?? "";
  const allowedScopes = scopeRows.filter((row) => row.current_verdict === "pass");
  const blockedScopes = scopeRows.filter((row) => row.current_verdict === "blocked");
  return [
    gateRow("p801_work_order_intake_ready", "P801", workOrderIntake.validation.valid && workOrderIntake.summary.zendd_work_order_intake_status === "ready_for_zendd_work_order_intake", "P781-P800 work order intake is ready.", "repair P781-P800 work order intake"),
    gateRow("p802_dirty_tree_inventory_ready", "P802", integrationSetup.validation.valid && integrationSetup.dirty_tree_safety_inventory_rows.length > 0, "Zendd dirty tree inventory is available and read-only.", "repair P521 dirty tree inventory"),
    gateRow("p803_patch_policy_no_auto_write", "P803", patchPolicy.patch_candidate_review_allowed && !patchPolicy.automatic_patch_allowed_now && !patchPolicy.file_write_executed_by_this_command, "Safe patch policy opens review candidates without automatic writes.", "restore no-auto-write patch policy"),
    gateRow("p804_candidates_non_protected", "P804-P806", candidateRows.length >= 1 && candidateRows.every((row) => row.non_protected_scope && row.current_verdict === "pass" && !row.file_write_executed_now), "Only non-protected planning work orders become patch candidates.", "filter patch candidates to non-protected PASS work orders"),
    gateRow("p807_patch_scopes_partitioned", "P807-P810", allowedScopes.length >= 3 && blockedScopes.length >= 5 && blockedScopes.every((row) => row.block_reason), "Patch scopes are partitioned into eligible future scopes and documented protected blocks.", "complete patch scope partition"),
    gateRow("p811_dirty_tree_guard_documented", "P811-P812", dirtyGuardRows.length >= 2 && dirtyGuardRows.every((row) => row.next_allowed_action && !row.file_write_executed_now), "Dirty tree guards are documented without writes.", "complete dirty tree guard rows"),
    gateRow("p813_preflight_bound", "P813-P815", preflightRows.length === candidateRows.length && preflightRows.every(hasPreflightFields), "Patch preflight rows bind evidence, reviewer, gate, rollback, and dirty tree guard.", "complete patch preflight rows"),
    gateRow("p816_protected_patch_blocks", "P816-P818", protectedBlockRows.length >= 10 && protectedBlockRows.every(documentedProtectedBlock), "Protected patch scopes and work orders remain documented BLOCK.", "complete protected patch block rows"),
    gateRow("p819_no_execution", "P819", [...candidateRows, ...scopeRows, ...dirtyGuardRows, ...preflightRows, ...protectedBlockRows].every((row) => !row.file_write_executed_now) && !patchPolicy.command_execution_allowed_now && !patchPolicy.secret_read_allowed_now, "P801-P820 performs no Zendd writes, command execution, or secret reads.", "restore no-execution safe patch boundary"),
    gateRow("p820_closeout_ready", "P820", closeoutRows.every((row) => row.closeout_status === READY_STATUS && !row.file_write_executed_now), "P801-P820 closes with safe patch lane ready and no writes executed.", "complete safe patch lane closeout"),
    gateRow("package_script_registered", "P820", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("validate_chain_registered", "P820", validateScript.includes(`npm run ${COMMAND_NAME} -- --check`), `${COMMAND_NAME} is included in npm run validate.`, `add ${COMMAND_NAME} to validate chain`),
    gateRow("development_phase_ledger_declared", "P820", developmentPhaseLedger.available && developmentPhaseLedger.text.includes("P801-P820") && developmentPhaseLedger.text.includes(COMMAND_NAME), "Development operations phase ledger declares P801-P820.", "record P801-P820 in phase ledger"),
  ];
}

function buildValidationItems({ gateRows, patchPolicy, candidateRows, scopeRows, dirtyGuardRows, preflightRows, protectedBlockRows, closeoutRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "safe_patch_lane_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("policy.no_auto_write", "patch_policy_boundary", !patchPolicy.automatic_patch_allowed_now && !patchPolicy.file_write_executed_by_this_command && !patchPolicy.command_execution_allowed_now, "Patch policy blocks automatic write and command execution."));
  items.push(validationItem("candidates.non_protected_pass", "patch_candidate_boundary", candidateRows.every((row) => row.current_verdict === "pass" && row.non_protected_scope && !row.file_write_executed_now), "Patch candidates are non-protected PASS rows without writes."));
  items.push(validationItem("scopes.protected_blocked", "patch_scope_boundary", scopeRows.filter((row) => row.current_verdict === "blocked").every((row) => row.block_reason && row.rollback_target_ref), "Protected patch scopes are blocked with rollback targets."));
  items.push(validationItem("dirty_tree.guarded", "dirty_tree_boundary", dirtyGuardRows.every((row) => row.next_allowed_action && !row.file_write_executed_now), "Dirty tree guards are attached and non-mutating."));
  items.push(validationItem("preflight.no_execute", "preflight_boundary", preflightRows.every(hasPreflightFields), "Patch preflight rows do not allow execution."));
  items.push(validationItem("protected.documented_block", "protected_patch_boundary", protectedBlockRows.every(documentedProtectedBlock), "Protected patch blocks are documented."));
  items.push(validationItem("closeout.safe", "closeout_boundary", closeoutRows.every((row) => row.closeout_status === READY_STATUS && !row.file_write_executed_now && !row.protected_action_execution_allowed), "Closeout is ready without patch execution."));
  return items;
}

function buildSummary({ workOrderIntake, integrationSetup, candidateRows, scopeRows, dirtyGuardRows, preflightRows, protectedBlockRows, closeoutRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_safe_patch_lane_status: validation.valid ? READY_STATUS : "documented_block_pending_safe_patch_lane",
    source_work_order_intake_status: workOrderIntake.summary.zendd_work_order_intake_status,
    source_integration_setup_status: integrationSetup.summary.zendd_integration_setup_status,
    selected_integration_mode: workOrderIntake.summary.selected_integration_mode,
    dirty_tree_row_count: integrationSetup.summary.dirty_tree_row_count,
    high_risk_dirty_tree_row_count: integrationSetup.summary.high_risk_dirty_tree_row_count,
    patch_candidate_count: candidateRows.length,
    allowed_patch_scope_count: scopeRows.filter((row) => row.current_verdict === "pass").length,
    blocked_patch_scope_count: scopeRows.filter((row) => row.current_verdict === "blocked").length,
    dirty_tree_guard_count: dirtyGuardRows.length,
    patch_preflight_count: preflightRows.length,
    protected_patch_block_count: protectedBlockRows.length,
    safe_patch_lane_ready: closeoutRows.every((row) => row.safe_patch_lane_ready),
    patch_candidate_review_allowed: true,
    file_write_executed_now: false,
    automatic_patch_allowed_now: false,
    command_execution_allowed_now: false,
    raw_material_copy_allowed_now: false,
    secret_read_allowed_now: false,
    protected_action_execution_allowed: false,
    validation_error_count: validation.errors.length,
  };
}

function hasPreflightFields(row) {
  return Boolean(row.patch_candidate_id && row.work_order_id && row.evidence_ref && row.reviewer_ref && row.hard_gate_ref && row.rollback_target_ref)
    && Array.isArray(row.allowed_scope_refs)
    && row.allowed_scope_refs.length >= 1
    && Array.isArray(row.dirty_tree_guard_refs)
    && row.dirty_tree_guard_refs.length >= 1
    && row.current_verdict === "pass"
    && row.patch_execution_allowed_now === false
    && row.file_write_executed_now === false
    && Boolean(row.next_allowed_action);
}

function documentedProtectedBlock(row) {
  return row.current_verdict === "blocked"
    && Boolean(row.block_reason)
    && Boolean(row.responsible_owner)
    && Boolean(row.evidence_ref)
    && Boolean(row.hard_gate_ref)
    && row.human_receipt_required === true
    && Boolean(row.rollback_target_ref)
    && row.file_write_executed_now === false
    && Boolean(row.next_allowed_action);
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-safe-patch-lane-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_safe_patch_lane_gate" : nextAllowedAction,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_SAFE_PATCH_LANE_INPUTS.schemaPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_SAFE_PATCH_LANE_INPUTS.packagePath,
    integration_phase_ledger_path: options.integrationPhaseLedgerPath ?? DEFAULT_ZENDD_SAFE_PATCH_LANE_INPUTS.integrationPhaseLedgerPath,
    development_phase_ledger_path: options.developmentPhaseLedgerPath ?? DEFAULT_ZENDD_SAFE_PATCH_LANE_INPUTS.developmentPhaseLedgerPath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_SAFE_PATCH_LANE_INPUTS.zenddProjectRoot,
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

Creates the P801-P820 Zendd safe patch lane contract. --check validates without
writing artifacts, mutating Zendd, running Zendd commands, reading secrets,
copying raw VDR/client material, applying receipts, executing database
migrations, release/package actions, or protected recovery.
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
    "# Zendd Safe Patch Lane Summary",
    "",
    `- Status: ${summary.zendd_safe_patch_lane_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Patch candidates: ${summary.patch_candidate_count}`,
    `- Allowed scopes: ${summary.allowed_patch_scope_count}`,
    `- Blocked scopes: ${summary.blocked_patch_scope_count}`,
    `- Protected blocks: ${summary.protected_patch_block_count}`,
    `- Dirty tree rows: ${summary.dirty_tree_row_count}`,
    `- File write executed: ${summary.file_write_executed_now}`,
    `- Command execution allowed: ${summary.command_execution_allowed_now}`,
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
