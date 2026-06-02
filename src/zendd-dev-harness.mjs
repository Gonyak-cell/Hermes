import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddBoundary } from "./zendd-boundary.mjs";

export const DEFAULT_ZENDD_DEV_HARNESS_OUT_DIR = "artifacts/zendd-dev-harness/latest";
export const DEFAULT_ZENDD_DEV_HARNESS_INPUTS = {
  schemaPath: "schemas/zendd-dev-harness.schema.json",
  phaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  packagePath: "package.json",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "project:zendd-dev-harness";
const BOUNDARY_COMMAND_NAME = "project:zendd-boundary";
const SCHEMA_VERSION = "zendd-dev-harness.v1";
const CAPABILITY_ID = "project.zendd.dev_harness";
const PHASE_RANGE = "P541-P560";
const PHASE_SLOT = "P541";
const PREVIOUS_PHASE_SLOT = "P540";
const NEXT_PHASE_SLOT = "P561";

export async function runZenddDevHarness(options = {}) {
  const result = await buildZenddDevHarness(options);
  if (options.write !== false) await writeZenddDevHarness(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Zendd dev harness failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildZenddDevHarness(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ZENDD_DEV_HARNESS_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const phaseLedger = await readTextSource(inputs.phase_ledger_path);
  const boundary = await buildZenddBoundary({
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    phaseLedgerPath: inputs.phase_ledger_path,
    write: false,
  });
  const profile = buildProjectDevProfile({ generatedAt, boundary });
  const workOrderPolicy = buildWorkOrderPolicy(generatedAt, boundary);
  const intakeRows = buildIntakeMappingRows();
  const laneRows = buildLanePolicyRows();
  const diffReviewPolicy = buildDiffReviewPolicy(generatedAt);
  const commandCandidateRows = buildTestCommandCandidateRows(boundary);
  const protectedRouteRows = buildProtectedRouteRows();
  const updatePacketTemplate = buildUpdatePacketTemplate(generatedAt);
  const operatorStatusRows = buildOperatorStatusRows(boundary);
  const mutationPreflight = buildMutationPreflight(generatedAt, boundary);
  const coverageRows = buildHermesFunctionCoverageRows();
  const anchor = buildAnchor({
    packageJson,
    phaseLedger,
    boundary,
    profile,
    workOrderPolicy,
    intakeRows,
    laneRows,
    commandCandidateRows,
    protectedRouteRows,
    coverageRows,
  });
  const gateRows = buildGateRows({
    packageJson,
    phaseLedger,
    boundary,
    profile,
    workOrderPolicy,
    intakeRows,
    laneRows,
    diffReviewPolicy,
    commandCandidateRows,
    protectedRouteRows,
    updatePacketTemplate,
    operatorStatusRows,
    mutationPreflight,
    coverageRows,
  });
  const validationItems = buildValidationItems({
    gateRows,
    profile,
    workOrderPolicy,
    laneRows,
    commandCandidateRows,
    protectedRouteRows,
    mutationPreflight,
    coverageRows,
  });
  const preliminaryValidation = summarizeValidation(validationItems);
  const summary = buildSummary({
    boundary,
    profile,
    intakeRows,
    laneRows,
    commandCandidateRows,
    protectedRouteRows,
    coverageRows,
    validation: preliminaryValidation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    zendd_dev_harness_id: `zendd-dev-harness.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    dev_harness_anchor: anchor,
    source_boundary_summary: boundary.summary,
    project_dev_profile: profile,
    work_order_policy: workOrderPolicy,
    intake_mapping_rows: intakeRows,
    lane_policy_rows: laneRows,
    diff_review_policy: diffReviewPolicy,
    test_command_candidate_rows: commandCandidateRows,
    protected_route_rows: protectedRouteRows,
    update_packet_template: updatePacketTemplate,
    operator_status_rows: operatorStatusRows,
    mutation_preflight: mutationPreflight,
    hermes_function_coverage_rows: coverageRows,
    dev_harness_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary,
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "zendd_dev_harness")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({
    boundary,
    profile,
    intakeRows,
    laneRows,
    commandCandidateRows,
    protectedRouteRows,
    coverageRows,
    validation: result.validation,
  });
  result.summary.zendd_dev_harness_id = result.zendd_dev_harness_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeZenddDevHarness(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "zendd-dev-harness.json"), serializableResult(result));
  await writeJson(path.join(outDir, "project-dev-profile.json"), result.project_dev_profile);
  await writeJson(path.join(outDir, "work-order-policy.json"), result.work_order_policy);
  await writeJson(path.join(outDir, "intake-mapping-rows.json"), collectionEnvelope("zendd-intake-mapping-rows.v1", "intake_mapping_rows", result.intake_mapping_rows, result.generated_at));
  await writeJson(path.join(outDir, "lane-policy-rows.json"), collectionEnvelope("zendd-lane-policy-rows.v1", "lane_policy_rows", result.lane_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "test-command-candidate-rows.json"), collectionEnvelope("zendd-test-command-candidate-rows.v1", "test_command_candidate_rows", result.test_command_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-route-rows.json"), collectionEnvelope("zendd-protected-route-rows.v1", "protected_route_rows", result.protected_route_rows, result.generated_at));
  await writeJson(path.join(outDir, "hermes-function-coverage-rows.json"), collectionEnvelope("zendd-hermes-function-coverage-rows.v1", "hermes_function_coverage_rows", result.hermes_function_coverage_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "zendd-dev-harness-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runZenddDevHarnessCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runZenddDevHarness(args);
    console.log(`Zendd dev harness ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.zendd_dev_harness_status}`);
    console.log(`Zendd path: ${result.summary.zendd_project_root}`);
    console.log(`Lane rows: ${result.summary.lane_policy_row_count}`);
    console.log(`Command candidates: ${result.summary.test_command_candidate_count}`);
    console.log(`Mutation allowed: ${result.summary.zendd_mutation_allowed}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildProjectDevProfile({ generatedAt, boundary }) {
  return {
    schema_version: "project-zendd-dev-profile.v1",
    phase_slot: "P541",
    project_id: "project.zendd",
    domain_pack_id: "law-firm",
    harness_mode: "read_only_dev_operations_adapter",
    external_project_root: boundary.project_zendd_registration.external_project_root,
    external_git_head_short: boundary.project_zendd_registration.external_git_head_short,
    supported_hermes_functions: [
      "issue_intake",
      "planning",
      "lane_modeling",
      "diff_review",
      "test_command_catalog",
      "release_note_planning",
      "rollback_planning",
      "technical_debt_tracking",
      "operator_status",
    ],
    zendd_mutation_allowed: false,
    worktree_creation_allowed: false,
    command_execution_allowed: false,
    raw_material_copy_allowed: false,
    protected_pass_allowed_without_receipt: false,
    profile_status: boundary.validation.valid && boundary.summary.zendd_boundary_status === "ready_for_zendd_dev_harness_adapter"
      ? "ready_read_only_dev_harness"
      : "documented_block_pending_boundary",
    next_allowed_action: "implement command evidence bridge before executing Zendd check commands",
    created_at: generatedAt,
  };
}

function buildWorkOrderPolicy(generatedAt, boundary) {
  return {
    schema_version: "zendd-work-order-policy.v1",
    phase_slot: "P542",
    project_id: "project.zendd",
    direct_edit_allowed: false,
    dirty_tree_review_required: boundary.source_setup_summary.dirty_tree_row_count > 0,
    required_fields: [
      "work_order_id",
      "project_id",
      "scope",
      "responsible_owner",
      "claim_id",
      "evidence_ref",
      "reviewer_ref_or_gate_ref",
      "next_allowed_action",
    ],
    protected_work_order_required_fields: [
      "human_receipt_ref",
      "receipt_owner",
      "receipt_status",
    ],
    mutation_preconditions: [
      "dirty_tree_review_receipt",
      "command_evidence_bridge",
      "diff_review_packet",
      "human_receipt_ref_when_protected",
    ],
    blocked_status_requires: ["block_reason", "responsible_owner", "next_allowed_action"],
    verdict: "pass",
    next_allowed_action: "create Zendd work order packet before any file mutation",
    created_at: generatedAt,
  };
}

function buildIntakeMappingRows() {
  const rows = [
    ["zendd.intake.vdr_request", "VDR upload, classification, and source-control request", "vdr_source", "law-firm"],
    ["zendd.intake.ldd_fact_issue", "LDD fact, issue, evidence span, or cross-document analysis request", "ldd_fact_issue", "law-firm"],
    ["zendd.intake.client_output", "Client-facing Korean report, memo, or export quality request", "client_output", "law-firm"],
    ["zendd.intake.backend_api", "FastAPI, database, migration, parser, or service request", "backend_api", "personal-dev"],
    ["zendd.intake.frontend_ui", "React UI, UX, table, or dashboard request", "frontend_ui", "personal-dev"],
    ["zendd.intake.electron_desktop", "Electron shell, installer, local app, or desktop workflow request", "desktop_app", "personal-dev"],
    ["zendd.intake.release_recovery", "Build, package, rollback, or recovery request", "release_recovery", "personal-dev"],
    ["zendd.intake.security_secret", "Secret, environment, parser sandbox, or document safety request", "security_boundary", "platform"],
  ];
  return rows.map(([intake_id, description, zendd_scope, owning_pack], index) => ({
    schema_version: "zendd-intake-mapping-row.v1",
    phase_slot: "P543",
    row_id: `zendd-intake.row.${String(index + 1).padStart(2, "0")}`,
    intake_id,
    description,
    zendd_scope,
    owning_pack,
    project_id_required: true,
    matter_id_required_when_legal: owning_pack === "law-firm",
    evidence_ref_required: true,
    protected_output_review_required: ["vdr_source", "ldd_fact_issue", "client_output", "release_recovery", "security_boundary"].includes(zendd_scope),
    next_allowed_action: "convert intake into Zendd work order packet",
  }));
}

function buildLanePolicyRows() {
  const rows = [
    ["lane.backend", "backend_api", "backend service/API changes", "diff_review_and_command_evidence_required"],
    ["lane.frontend", "frontend_ui", "frontend UI changes", "diff_review_and_command_evidence_required"],
    ["lane.electron", "desktop_app", "Electron shell and desktop packaging changes", "desktop_receipt_required"],
    ["lane.vdr", "vdr_source", "VDR routing/source-control changes", "human_receipt_required"],
    ["lane.ldd", "ldd_fact_issue", "LDD fact and issue engine changes", "human_receipt_required"],
    ["lane.client_output", "client_output", "Korean client-facing output changes", "human_receipt_required"],
    ["lane.release", "release_recovery", "build/release/recovery changes", "release_receipt_required"],
    ["lane.security", "security_boundary", "secret/parser/document safety changes", "security_receipt_required"],
  ];
  return rows.map(([lane_id, zendd_scope, description, gate_policy], index) => ({
    schema_version: "zendd-lane-policy-row.v1",
    phase_slot: "P544",
    row_id: `zendd-lane.row.${String(index + 1).padStart(2, "0")}`,
    lane_id,
    project_id: "project.zendd",
    zendd_scope,
    description,
    lane_creation_allowed_now: false,
    worktree_creation_allowed_now: false,
    direct_checkout_mutation_allowed: false,
    gate_policy,
    required_before_mutation: ["work_order_id", "dirty_tree_review", "diff_review_packet", "command_evidence_ref"],
    next_allowed_action: "materialize lane only after explicit work order and receipt gate",
  }));
}

function buildDiffReviewPolicy(generatedAt) {
  return {
    schema_version: "zendd-diff-review-policy.v1",
    phase_slot: "P545",
    project_id: "project.zendd",
    diff_review_required_before_mutation: true,
    generated_diff_without_work_order_allowed: false,
    raw_vdr_diff_allowed: false,
    secret_diff_allowed: false,
    required_review_packet_fields: [
      "work_order_id",
      "changed_paths",
      "path_classification",
      "evidence_ref",
      "reviewer_ref",
      "risk_level",
      "next_allowed_action",
    ],
    verdict: "pass",
    next_allowed_action: "create diff review adapter after command evidence bridge",
    created_at: generatedAt,
  };
}

function buildTestCommandCandidateRows(boundary) {
  const candidates = boundary.zendd_command_catalog_rows.filter((row) => row.command_classification === "check_mode_candidate");
  if (!candidates.length) {
    return [{
      schema_version: "zendd-test-command-candidate-row.v1",
      phase_slot: "P546",
      row_id: "zendd-test-command-candidate.none",
      script_name: "no_check_candidates_detected",
      package_path: null,
      command_scope: "none",
      execution_allowed_now: false,
      evidence_ref: null,
      verdict: "blocked_until_command_catalog_has_check_candidate",
      block_reason: "no_check_mode_candidate_detected",
      next_allowed_action: "classify Zendd test/lint/check commands before evidence bridge",
    }];
  }
  return candidates.map((row, index) => ({
    schema_version: "zendd-test-command-candidate-row.v1",
    phase_slot: "P546",
    row_id: `zendd-test-command-candidate.row.${String(index + 1).padStart(2, "0")}`,
    script_name: row.script_name,
    package_path: row.package_path,
    command_scope: row.command_scope,
    execution_allowed_now: false,
    evidence_ref: null,
    verdict: "candidate_not_executed",
    block_reason: "command_evidence_bridge_missing",
    next_allowed_action: "map command to evidence_ref before execution",
  }));
}

function buildProtectedRouteRows() {
  const rows = [
    ["protected.vdr_source", "VDR source/control changes", "human_receipt_ref", "raw_material_reference_policy"],
    ["protected.ldd_fact_issue", "LDD facts/issues/evidence spans", "human_receipt_ref", "fact_issue_review_gate"],
    ["protected.client_output", "client-facing Korean report/export", "human_receipt_ref", "client_output_gate"],
    ["protected.database_migration", "database migration or seed", "human_receipt_ref", "database_receipt_gate"],
    ["protected.release_package", "build/package/release/recovery", "human_receipt_ref", "release_recovery_gate"],
    ["protected.secret_boundary", "secret/env/parser safety", "security_receipt_ref", "secret_boundary_gate"],
    ["protected.physical_integration", "subtree/submodule/workspace move", "human_receipt_ref", "physical_integration_decision"],
  ];
  return rows.map(([route_id, description, required_receipt_type, hard_gate_ref], index) => ({
    schema_version: "zendd-protected-route-row.v1",
    phase_slot: "P547",
    row_id: `zendd-protected-route.row.${String(index + 1).padStart(2, "0")}`,
    route_id,
    project_id: "project.zendd",
    description,
    protected: true,
    pass_without_receipt_allowed: false,
    required_receipt_type,
    hard_gate_ref,
    current_verdict: "blocked_pending_human_receipt",
    block_reason: "protected_route_requires_evidence_gate_and_receipt",
    next_allowed_action: "collect evidence_ref reviewer_gate_ref and required receipt before PASS",
  }));
}

function buildUpdatePacketTemplate(generatedAt) {
  return {
    schema_version: "zendd-update-packet-template.v1",
    phase_slot: "P548",
    project_id: "project.zendd",
    required_fields: [
      "work_order_id",
      "request_summary",
      "zendd_scope",
      "affected_paths",
      "path_classification",
      "claim_id",
      "evidence_ref",
      "reviewer_ref_or_gate_ref",
      "human_receipt_ref_if_protected",
      "rollback_target",
      "next_allowed_action",
    ],
    forbidden_fields: ["raw_vdr_payload", "secret_value", "unscoped_client_material"],
    mutation_allowed_by_template: false,
    verdict: "pass",
    next_allowed_action: "instantiate update packet only after command evidence bridge",
    created_at: generatedAt,
  };
}

function buildOperatorStatusRows(boundary) {
  const rows = [
    ["zendd.status.boundary", boundary.summary.zendd_boundary_status, "boundary_verdict", "continue_to_dev_harness"],
    ["zendd.status.dirty_tree", String(boundary.source_setup_summary.dirty_tree_row_count), "dirty_tree_rows", "complete dirty-tree review receipt before mutation"],
    ["zendd.status.command_catalog", String(boundary.summary.command_catalog_row_count), "command_rows", "map check commands to evidence refs"],
    ["zendd.status.blocked_capabilities", String(boundary.summary.blocked_capability_count), "blocked_capabilities", "close bridge contracts by tranche"],
    ["zendd.status.receipt_boundary", "protected_pass_without_receipt=false", "receipt_gate", "bind human receipt bridge in P621-P640"],
  ];
  return rows.map(([status_id, value, status_type, next_allowed_action], index) => ({
    schema_version: "zendd-operator-status-row.v1",
    phase_slot: "P549",
    row_id: `zendd-operator-status.row.${String(index + 1).padStart(2, "0")}`,
    status_id,
    status_type,
    display_value: value,
    missing_evidence: status_type === "boundary_verdict" ? [] : ["evidence_ref"],
    block_reason: status_type === "boundary_verdict" ? null : "bridge_not_materialized",
    next_allowed_action,
  }));
}

function buildMutationPreflight(generatedAt, boundary) {
  return {
    schema_version: "zendd-mutation-preflight.v1",
    phase_slot: "P550",
    project_id: "project.zendd",
    mutation_allowed_now: false,
    worktree_creation_allowed_now: false,
    command_execution_allowed_now: false,
    dirty_tree_row_count: boundary.source_setup_summary.dirty_tree_row_count,
    required_to_unblock: [
      "explicit_user_work_order",
      "dirty_tree_review_receipt",
      "command_evidence_bridge",
      "diff_review_packet",
      "human_receipt_ref_when_protected",
    ],
    current_verdict: "blocked",
    block_reason: "dev_harness_is_read_only_until_evidence_bridge_and_work_order",
    responsible_owner: "integration_operator",
    next_allowed_action: "implement P561-P580 command evidence bridge",
    created_at: generatedAt,
  };
}

function buildHermesFunctionCoverageRows() {
  const rows = [
    ["issue_intake", "P551", "ready_read_only", "intake_mapping_rows", "convert Zendd request into work_order_packet"],
    ["planning", "P552", "ready_read_only", "update_packet_template", "produce scoped plan with evidence refs"],
    ["worktree_lanes", "P553", "blocked_pending_work_order", "lane_policy_rows", "wait for explicit work order and dirty-tree receipt"],
    ["diff_review", "P554", "blocked_pending_diff_adapter", "diff_review_policy", "create diff review adapter after evidence bridge"],
    ["tests", "P555", "blocked_pending_command_evidence_bridge", "test_command_candidate_rows", "map commands to evidence refs before execution"],
    ["pr_drafts", "P556", "blocked_pending_physical_strategy", "update_packet_template", "defer PR draft policy until integration strategy is chosen"],
    ["release_notes", "P557", "blocked_pending_release_recovery_bridge", "protected_route_rows", "defer to P681-P700 release/recovery bridge"],
    ["rollback_plans", "P558", "blocked_pending_recovery_bridge", "update_packet_template", "add rollback target in release/recovery bridge"],
    ["technical_debt", "P559", "ready_read_only", "intake_mapping_rows", "track as project.zendd work order without mutation"],
    ["operator_status", "P560", "ready_read_only", "operator_status_rows", "surface missing evidence and next action"],
  ];
  return rows.map(([function_id, phase_slot, current_verdict, evidence_surface, next_allowed_action], index) => ({
    schema_version: "zendd-hermes-function-coverage-row.v1",
    phase_slot,
    row_id: `zendd-hermes-function.row.${String(index + 1).padStart(2, "0")}`,
    function_id,
    project_id: "project.zendd",
    current_verdict,
    evidence_surface,
    pass_policy: "read_only_ready_or_documented_block_with_next_action",
    block_reason: current_verdict.startsWith("blocked") ? "bridge_or_receipt_not_materialized" : null,
    responsible_owner: "integration_operator",
    next_allowed_action,
  }));
}

function buildAnchor({ packageJson, phaseLedger, boundary, profile, workOrderPolicy, intakeRows, laneRows, commandCandidateRows, protectedRouteRows, coverageRows }) {
  return {
    schema_version: "zendd-dev-harness-anchor.v1",
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    boundary_command_name: BOUNDARY_COMMAND_NAME,
    package_json_hash: packageJson.content_hash,
    phase_ledger_hash: phaseLedger.content_hash,
    source_boundary_hash: hashValue(boundary.summary),
    project_dev_profile_hash: hashValue(profile),
    work_order_policy_hash: hashValue(workOrderPolicy),
    intake_mapping_hash: hashRows(intakeRows, ["intake_id", "zendd_scope", "owning_pack", "next_allowed_action"]),
    lane_policy_hash: hashRows(laneRows, ["lane_id", "zendd_scope", "lane_creation_allowed_now", "gate_policy"]),
    command_candidate_hash: hashRows(commandCandidateRows, ["script_name", "execution_allowed_now", "verdict", "next_allowed_action"]),
    protected_route_hash: hashRows(protectedRouteRows, ["route_id", "pass_without_receipt_allowed", "block_reason", "next_allowed_action"]),
    coverage_hash: hashRows(coverageRows, ["function_id", "current_verdict", "next_allowed_action"]),
  };
}

function buildGateRows({
  packageJson,
  phaseLedger,
  boundary,
  profile,
  workOrderPolicy,
  intakeRows,
  laneRows,
  diffReviewPolicy,
  commandCandidateRows,
  protectedRouteRows,
  updatePacketTemplate,
  operatorStatusRows,
  mutationPreflight,
  coverageRows,
}) {
  const scripts = packageJson.data?.scripts ?? {};
  return [
    gateRow("p541_dev_profile_registered", "P541", profile.profile_status === "ready_read_only_dev_harness" && !profile.zendd_mutation_allowed, "Zendd dev profile is read-only and registered.", "repair boundary before dev profile"),
    gateRow("p542_work_order_policy_requires_evidence_review_receipt", "P542", !workOrderPolicy.direct_edit_allowed && workOrderPolicy.required_fields.includes("evidence_ref") && workOrderPolicy.required_fields.includes("reviewer_ref_or_gate_ref") && workOrderPolicy.protected_work_order_required_fields.includes("human_receipt_ref"), "Work orders require evidence, review/gate, and protected receipts.", "add work order evidence/review/receipt requirements"),
    gateRow("p543_intake_mapping_complete", "P543", intakeRows.length >= 8 && intakeRows.every((row) => row.project_id_required && row.evidence_ref_required && row.next_allowed_action), "Zendd intake classes map to scoped work orders.", "complete intake mapping"),
    gateRow("p544_lane_policy_no_worktree_creation", "P544", laneRows.length >= 8 && laneRows.every((row) => !row.lane_creation_allowed_now && !row.worktree_creation_allowed_now && !row.direct_checkout_mutation_allowed), "Lane policies model Zendd work without creating worktrees.", "keep lane creation blocked until work order"),
    gateRow("p545_diff_review_before_mutation", "P545", diffReviewPolicy.diff_review_required_before_mutation && !diffReviewPolicy.generated_diff_without_work_order_allowed && !diffReviewPolicy.secret_diff_allowed, "Diff review is required before mutation and excludes secrets/raw VDR.", "create diff review packet before mutation"),
    gateRow("p546_test_command_candidates_catalog_only", "P546", commandCandidateRows.length >= 1 && commandCandidateRows.every((row) => !row.execution_allowed_now && row.evidence_ref === null && row.next_allowed_action), "Test/check commands are candidates only and not executed.", "create command evidence bridge"),
    gateRow("p547_protected_routes_receipt_gated", "P547", protectedRouteRows.length >= 7 && protectedRouteRows.every((row) => row.protected && !row.pass_without_receipt_allowed && row.block_reason && row.next_allowed_action), "Protected routes require evidence, hard gate, and receipt.", "bind human receipt bridge"),
    gateRow("p548_update_packet_template_has_fields", "P548", updatePacketTemplate.required_fields.includes("rollback_target") && updatePacketTemplate.forbidden_fields.includes("secret_value") && !updatePacketTemplate.mutation_allowed_by_template, "Update packet template includes rollback and forbids raw/secret fields.", "instantiate update packet after evidence bridge"),
    gateRow("p549_operator_status_has_next_actions", "P549", operatorStatusRows.length >= 5 && operatorStatusRows.every((row) => row.next_allowed_action), "Operator status rows expose missing evidence and next actions.", "surface dev harness status in operator bridge"),
    gateRow("p550_mutation_preflight_blocked", "P550", !mutationPreflight.mutation_allowed_now && mutationPreflight.current_verdict === "blocked" && mutationPreflight.block_reason && mutationPreflight.next_allowed_action, "Mutation preflight remains blocked with reason and next action.", "implement command evidence bridge"),
    gateRow("p551_p560_coverage_has_all_personal_dev_functions", "P551-P560", coverageRows.length >= 10 && coverageRows.every((row) => row.current_verdict && row.next_allowed_action && row.responsible_owner), "Hermes personal-dev functions are mapped to Zendd readiness or documented block.", "complete Hermes function coverage map"),
    gateRow("package_script_registered", "P560", typeof scripts[COMMAND_NAME] === "string", `${COMMAND_NAME} is registered in package.json.`, `add ${COMMAND_NAME} to package.json`),
    gateRow("phase_ledger_acceptance_declared", "P560", phaseLedger.available && phaseLedger.text.includes("P541-P560") && phaseLedger.text.includes(COMMAND_NAME), "P541-P560 phase ledger declares dev harness acceptance.", "record P541-P560 in phase ledger"),
    gateRow("boundary_chain_valid", "P560", boundary.validation.valid && boundary.summary.zendd_boundary_status === "ready_for_zendd_dev_harness_adapter", "P526-P540 boundary remains valid before dev harness.", "repair boundary validation before dev harness"),
  ];
}

function buildValidationItems({ gateRows, profile, workOrderPolicy, laneRows, commandCandidateRows, protectedRouteRows, mutationPreflight, coverageRows }) {
  const items = gateRows.map((row) => validationItem(row.gate_id, "dev_harness_gate", row.gate_status === "pass", row.message));
  items.push(validationItem("profile.zendd_mutation_allowed", "safety_boundary", profile.zendd_mutation_allowed === false, "Zendd dev profile does not permit mutation"));
  items.push(validationItem("profile.command_execution_allowed", "safety_boundary", profile.command_execution_allowed === false, "Zendd dev profile does not permit command execution"));
  items.push(validationItem("work_order.direct_edit_allowed", "safety_boundary", workOrderPolicy.direct_edit_allowed === false, "Direct edit is blocked"));
  items.push(validationItem("lanes.worktree_creation_allowed_now", "safety_boundary", laneRows.every((row) => row.worktree_creation_allowed_now === false), "Lane worktree creation remains blocked"));
  items.push(validationItem("commands.execution_allowed_now", "safety_boundary", commandCandidateRows.every((row) => row.execution_allowed_now === false), "Test command candidates are not executed"));
  items.push(validationItem("protected.pass_without_receipt_allowed", "receipt_boundary", protectedRouteRows.every((row) => row.pass_without_receipt_allowed === false), "Protected routes cannot PASS without receipt"));
  items.push(validationItem("mutation_preflight.current_verdict", "claim_boundary", mutationPreflight.current_verdict === "blocked" && mutationPreflight.next_allowed_action, "Mutation preflight is a documented block"));
  items.push(validationItem("coverage.next_allowed_action", "claim_boundary", coverageRows.every((row) => row.next_allowed_action && (row.current_verdict !== "blocked" || row.block_reason)), "Coverage rows include verdicts and next actions"));
  return items;
}

function buildSummary({ boundary, profile, intakeRows, laneRows, commandCandidateRows, protectedRouteRows, coverageRows, validation }) {
  return {
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    zendd_dev_harness_status: validation.valid
      ? "ready_for_command_evidence_bridge"
      : "documented_block_pending_dev_harness_gate",
    zendd_project_root: profile.external_project_root,
    zendd_git_head_short: profile.external_git_head_short,
    source_boundary_status: boundary.summary.zendd_boundary_status,
    domain_pack_id: profile.domain_pack_id,
    intake_mapping_row_count: intakeRows.length,
    lane_policy_row_count: laneRows.length,
    test_command_candidate_count: commandCandidateRows.length,
    protected_route_count: protectedRouteRows.length,
    hermes_function_coverage_count: coverageRows.length,
    ready_read_only_function_count: coverageRows.filter((row) => row.current_verdict === "ready_read_only").length,
    documented_block_function_count: coverageRows.filter((row) => row.current_verdict.startsWith("blocked")).length,
    zendd_mutation_allowed: profile.zendd_mutation_allowed,
    command_execution_allowed: profile.command_execution_allowed,
    worktree_creation_allowed: profile.worktree_creation_allowed,
    raw_material_copy_allowed: profile.raw_material_copy_allowed,
    protected_pass_allowed_without_receipt: profile.protected_pass_allowed_without_receipt,
    validation_error_count: validation.errors.length,
  };
}

function gateRow(gateId, phaseSlot, passed, message, nextAllowedAction) {
  return {
    schema_version: "zendd-dev-harness-gate-row.v1",
    gate_id: gateId,
    phase_slot: phaseSlot,
    gate_status: passed ? "pass" : "blocked",
    message,
    next_allowed_action: passed ? "continue_to_next_dev_harness_gate" : nextAllowedAction,
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
    schema_path: options.schemaPath ?? DEFAULT_ZENDD_DEV_HARNESS_INPUTS.schemaPath,
    phase_ledger_path: options.phaseLedgerPath ?? DEFAULT_ZENDD_DEV_HARNESS_INPUTS.phaseLedgerPath,
    package_path: options.packagePath ?? DEFAULT_ZENDD_DEV_HARNESS_INPUTS.packagePath,
    zendd_project_root: options.zenddProjectRoot ?? DEFAULT_ZENDD_DEV_HARNESS_INPUTS.zenddProjectRoot,
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

Creates the P541-P560 Zendd-Hermes read-only development harness adapter.
--check validates without writing artifacts.
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
    "# Zendd Dev Harness Summary",
    "",
    `- Status: ${summary.zendd_dev_harness_status}`,
    `- Phase: ${summary.phase_range}`,
    `- Zendd root: ${summary.zendd_project_root}`,
    `- Zendd HEAD: ${summary.zendd_git_head_short ?? "unavailable"}`,
    `- Domain pack: ${summary.domain_pack_id}`,
    `- Intake rows: ${summary.intake_mapping_row_count}`,
    `- Lane rows: ${summary.lane_policy_row_count}`,
    `- Command candidates: ${summary.test_command_candidate_count}`,
    `- Protected routes: ${summary.protected_route_count}`,
    `- Hermes function coverage rows: ${summary.hermes_function_coverage_count}`,
    `- Mutation allowed: ${summary.zendd_mutation_allowed}`,
    `- Command execution allowed: ${summary.command_execution_allowed}`,
    `- Worktree creation allowed: ${summary.worktree_creation_allowed}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "## Next Action",
    "",
    result.mutation_preflight.next_allowed_action,
    "",
  ].join("\n");
}
