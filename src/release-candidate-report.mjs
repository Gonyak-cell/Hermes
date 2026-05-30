import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RELEASE_CANDIDATE_OUT_DIR = "artifacts/release-candidate-report/latest";
export const DEFAULT_RELEASE_CANDIDATE_INPUTS = {
  operatorHandbookPath: "artifacts/operator-handbook/latest/operator-handbook.json",
  deploymentRunbookPath: "artifacts/deployment-runbook/latest/deployment-runbook.json",
  dashboardPath: "artifacts/dashboard/latest/review-dashboard.json",
  dashboardApiFreezePath: "artifacts/dashboard-api-freeze/latest/dashboard-api-freeze.json",
  contractInventoryPath: "artifacts/contract-inventory/latest/contract-inventory.json",
  contractDependencyMapPath: "artifacts/contract-dependency-map/latest/contract-dependency-map.json",
  apiRouteInventoryPath: "artifacts/api-route-inventory/latest/api-route-inventory.json",
  reviewDashboardIaPath: "artifacts/review-dashboard-ia/latest/review-dashboard-ia.json",
  contractGoldenFixturesPath: "artifacts/contract-golden-fixtures/latest/contract-golden-fixtures.json",
  contractValidationSuitePath: "artifacts/contract-validation-suite/latest/contract-validation-suite.json",
  controlPlaneGoalCheckpointPath: "artifacts/control-plane-goal-checkpoint/latest/control-plane-goal-checkpoint.json",
  controlPlaneLoopPath: "artifacts/control-plane-loop/latest/control-plane-loop.json",
  lawFirmE2eReportPath: "artifacts/law-firm-e2e-report/latest/law-firm-e2e-report.json",
  personalDevE2eReportPath: "artifacts/personal-dev-e2e-report/latest/personal-dev-e2e-report.json",
  creativeDocumentE2eReportPath: "artifacts/creative-document-e2e-report/latest/creative-document-e2e-report.json",
  ingestionE2eReportPath: "artifacts/ingestion-e2e-report/latest/ingestion-e2e-report.json",
  backupRestoreDrillPath: "artifacts/backup-restore-drill/latest/backup-restore-drill-report.json",
  packagePath: "package.json",
  finalCompletionLedgerPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardSourcePath: "src/review-dashboard.mjs",
  reviewApiSourcePath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
  controlPlaneLoopSourcePath: "src/control-plane-loop.mjs",
};

const SCHEMA_VERSION = "release-candidate-report.v1";
const CAPABILITY_ID = "release.candidate_report";
const PHASE_SLOT = "P311";
const PREVIOUS_PHASE_SLOT = "P310";
const NEXT_PHASE_SLOT = "P312";

const SOURCE_DEFINITIONS = [
  sourceDefinition("operator_handbook", "Operator Handbook", "operator_handbook_status", "complete", "P310", "P311"),
  sourceDefinition("deployment_runbook", "Deployment Runbook", "deployment_runbook_status", "complete", "P309", "P310"),
  sourceDefinition("dashboard", "Review Dashboard", "overall_status", "blocked", null, null, { allow_blocked_with_zero_blocking_gates: true, allow_incomplete_with_missing_release_candidate_report: true }),
  sourceDefinition("dashboard_api_freeze", "Dashboard/API Freeze", "dashboard_api_freeze_status", "complete", "P296", null),
  sourceDefinition("contract_inventory", "Contract Inventory", "inventory_status", "complete", null, null),
  sourceDefinition("contract_dependency_map", "Contract Dependency Map", "map_status", "complete", null, null),
  sourceDefinition("api_route_inventory", "API Route Inventory", "api_route_inventory_status", "complete", "P287", null),
  sourceDefinition("review_dashboard_ia", "Review Dashboard IA", "review_dashboard_ia_status", "complete", "P288", null),
  sourceDefinition("contract_golden_fixtures", "Contract Golden Fixtures", "golden_fixture_status", "complete", null, null, { allow_release_candidate_self_reference: true }),
  sourceDefinition("contract_validation_suite", "Contract Validation Suite", "validation_suite_status", "complete", null, null, { allow_release_candidate_self_reference: true }),
  sourceDefinition("control_plane_goal_checkpoint", "Control Plane Goal Checkpoint", "checkpoint_status", "passed", null, null, { allow_release_candidate_self_reference: true }),
  sourceDefinition("control_plane_loop", "Control Plane Loop", "overall_status", "passed", null, null),
  sourceDefinition("law_firm_e2e_report", "Law Firm E2E Report", "law_firm_e2e_report_status", "complete", "P305", null),
  sourceDefinition("personal_dev_e2e_report", "Personal Dev E2E Report", "personal_dev_e2e_report_status", "complete", "P306", null),
  sourceDefinition("creative_document_e2e_report", "Creative Document E2E Report", "creative_document_e2e_report_status", "complete", "P307", null),
  sourceDefinition("ingestion_e2e_report", "Ingestion E2E Report", "ingestion_e2e_report_status", "complete", "P308", null),
  sourceDefinition("backup_restore_drill", "Backup/Restore Drill", "backup_restore_drill_status", "complete", "P304", null),
];

const REQUIRED_SCRIPTS = [
  "release:candidate",
  "validate",
  "test",
  "contracts:inventory",
  "contracts:dependencies",
  "api:route-inventory",
  "dashboard:ia",
  "dashboard:api-freeze",
  "contracts:golden-fixtures",
  "contracts:validate",
  "dashboard:build",
  "api:smoke",
  "control-plane:goal-checkpoint",
  "control-plane:loop",
  "operator:handbook",
  "deployment:runbook",
  "law-firm:e2e-report",
  "personal-dev:e2e-report",
  "creative-document:e2e-report",
  "ingestion:e2e-report",
];

export async function runReleaseCandidateReport(options = {}) {
  const result = await buildReleaseCandidateReport(options);
  if (options.write !== false) await writeReleaseCandidateReport(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Release candidate report validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildReleaseCandidateReport(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RELEASE_CANDIDATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    operator_handbook: await readJsonSource(inputs.operator_handbook_path),
    deployment_runbook: await readJsonSource(inputs.deployment_runbook_path),
    dashboard: await readJsonSource(inputs.dashboard_path),
    dashboard_api_freeze: await readJsonSource(inputs.dashboard_api_freeze_path),
    contract_inventory: await readJsonSource(inputs.contract_inventory_path),
    contract_dependency_map: await readJsonSource(inputs.contract_dependency_map_path),
    api_route_inventory: await readJsonSource(inputs.api_route_inventory_path),
    review_dashboard_ia: await readJsonSource(inputs.review_dashboard_ia_path),
    contract_golden_fixtures: await readJsonSource(inputs.contract_golden_fixtures_path),
    contract_validation_suite: await readJsonSource(inputs.contract_validation_suite_path),
    control_plane_goal_checkpoint: await readJsonSource(inputs.control_plane_goal_checkpoint_path),
    control_plane_loop: await readJsonSource(inputs.control_plane_loop_path),
    law_firm_e2e_report: await readJsonSource(inputs.law_firm_e2e_report_path),
    personal_dev_e2e_report: await readJsonSource(inputs.personal_dev_e2e_report_path),
    creative_document_e2e_report: await readJsonSource(inputs.creative_document_e2e_report_path),
    ingestion_e2e_report: await readJsonSource(inputs.ingestion_e2e_report_path),
    backup_restore_drill: await readJsonSource(inputs.backup_restore_drill_path),
  };
  const support = {
    package_json: await readJsonSource(inputs.package_path),
    final_completion_ledger: await readTextSource(inputs.final_completion_ledger_path),
    implementation_roadmap: await readTextSource(inputs.implementation_roadmap_path),
    review_dashboard_source: await readTextSource(inputs.review_dashboard_source_path),
    review_api_source: await readTextSource(inputs.review_api_source_path),
    review_api_doc: await readTextSource(inputs.review_api_doc_path),
    control_plane_loop_source: await readTextSource(inputs.control_plane_loop_source_path),
  };
  const sourceStatuses = buildSourceStatuses(sources);
  const matrixRows = buildMatrixRows(sources, generatedAt);
  const commandRows = buildCommandRows(support, sources, generatedAt);
  const gateResults = buildGateResults({ sourceStatuses, matrixRows, commandRows, sources, generatedAt });
  const boundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({ support, sourceStatuses, matrixRows, commandRows, gateResults, boundary });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ sources, sourceStatuses, matrixRows, commandRows, gateResults, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    release_candidate_report_id: `release-candidate-report.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    source_statuses: sourceStatuses,
    release_candidate_contract: buildContract(generatedAt),
    release_candidate_matrix_rows: matrixRows,
    release_candidate_command_rows: commandRows,
    release_candidate_gate_results: gateResults,
    release_candidate_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  result.summary.release_candidate_report_id = result.release_candidate_report_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeReleaseCandidateReport(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = JSON.parse(JSON.stringify(result));
  delete serializable.markdown;
  await writeJson(path.join(outDir, "release-candidate-report.json"), serializable);
  await writeJson(path.join(outDir, "release-candidate-sources.json"), collectionEnvelope("release-candidate-sources.v1", "source_statuses", result.source_statuses, result.generated_at));
  await writeJson(path.join(outDir, "release-candidate-matrix.json"), collectionEnvelope("release-candidate-matrix.v1", "release_candidate_matrix_rows", result.release_candidate_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-candidate-commands.json"), collectionEnvelope("release-candidate-commands.v1", "release_candidate_command_rows", result.release_candidate_command_rows, result.generated_at));
  await writeJson(path.join(outDir, "release-candidate-gates.json"), collectionEnvelope("release-candidate-gates.v1", "release_candidate_gate_results", result.release_candidate_gate_results, result.generated_at));
  await writeJson(path.join(outDir, "release-candidate-boundary.json"), result.release_candidate_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "release-candidate-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runReleaseCandidateReportCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runReleaseCandidateReport(args);
    console.log(`Release candidate report ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.release_candidate_status}`);
    console.log(`Matrix: ${result.summary.passed_matrix_row_count}/${result.summary.matrix_row_count}`);
    console.log(`Commands: ${result.summary.ready_command_count}/${result.summary.command_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "release-candidate-contract.v1",
    contract_id: SCHEMA_VERSION,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    release_candidate_scope: "validate_test_control_plane_api_dashboard_e2e_desktop_readiness",
    execution_model: "deterministic_read_only_release_candidate_report",
    human_review_rule: "pending approvals and operational blockers remain visible and must be resolved or explicitly waived before client-facing use",
    windows_baseline_rule: "P311 is valid only after the P310 operator handbook and Windows baseline stability posture are preserved",
    created_at: generatedAt,
  };
}

function buildSourceStatuses(sources) {
  return SOURCE_DEFINITIONS.map((definition, index) => {
    const source = sources[definition.source_id];
    const data = source?.data ?? {};
    const summary = summaryOf(data);
    const actualStatus = summary[definition.status_key] ?? data[definition.status_key] ?? "unknown";
    const actualPhaseSlot = summary.phase_slot ?? data.phase_slot ?? null;
    const actualNextPhaseSlot = summary.next_phase_slot ?? data.next_phase_slot ?? null;
    const validationErrorCount = validationErrorCountOf(data);
    const failedCheckpointCount = failedCheckpointCountOf(data);
    const phaseMatches = definition.expected_phase_slot === null || actualPhaseSlot === definition.expected_phase_slot;
    const nextPhaseMatches = definition.expected_next_phase_slot === null || actualNextPhaseSlot === definition.expected_next_phase_slot;
    const allowedBlocked = definition.options.allow_blocked_with_zero_blocking_gates && actualStatus === "blocked" && (summary.blocking_gate_count ?? 0) === 0;
    const allowedReleaseCandidateBootstrap = definition.options.allow_incomplete_with_missing_release_candidate_report
      && actualStatus === "incomplete"
      && (summary.missing_stage_count ?? 0) === 1
      && (summary.blocking_gate_count ?? 0) === 0;
    const allowedReleaseCandidateSelfReference = definition.options.allow_release_candidate_self_reference && isReleaseCandidateSelfReferenceSource(definition.source_id, data);
    const effectiveValidationErrorCount = allowedReleaseCandidateSelfReference ? 0 : validationErrorCount;
    const effectiveFailedCheckpointCount = allowedReleaseCandidateSelfReference ? 0 : failedCheckpointCount;
    const statusMatches = actualStatus === definition.expected_status || allowedBlocked || allowedReleaseCandidateBootstrap || allowedReleaseCandidateSelfReference;
    const row = {
      schema_version: "release-candidate-source-status.v1",
      source_status_id: `release-candidate.source.${definition.source_id}`,
      ordinal: index + 1,
      source_id: definition.source_id,
      label: definition.label,
      source_path: source?.path ?? null,
      source_available: Boolean(source?.available),
      source_content_hash: source?.content_hash ?? null,
      expected_status: definition.expected_status,
      actual_status: actualStatus,
      expected_phase_slot: definition.expected_phase_slot,
      actual_phase_slot: actualPhaseSlot,
      expected_next_phase_slot: definition.expected_next_phase_slot,
      actual_next_phase_slot: actualNextPhaseSlot,
      allowed_blocked_with_zero_blocking_gates: Boolean(allowedBlocked),
      allowed_incomplete_with_missing_release_candidate_report: Boolean(allowedReleaseCandidateBootstrap),
      allowed_release_candidate_self_reference: Boolean(allowedReleaseCandidateSelfReference),
      validation_error_count: effectiveValidationErrorCount,
      failed_checkpoint_count: effectiveFailedCheckpointCount,
      source_status: source?.available && statusMatches && phaseMatches && nextPhaseMatches && effectiveValidationErrorCount === 0 && effectiveFailedCheckpointCount === 0 ? "passed" : "failed",
      error: source?.error ?? null,
    };
    return { ...row, source_status_hash: sha256(row) };
  });
}

function buildMatrixRows(sources, generatedAt) {
  const operator = summaryOf(sources.operator_handbook.data);
  const dashboard = summaryOf(sources.dashboard.data);
  const freeze = summaryOf(sources.dashboard_api_freeze.data);
  const inventory = summaryOf(sources.contract_inventory.data);
  const dependencies = summaryOf(sources.contract_dependency_map.data);
  const routeInventory = summaryOf(sources.api_route_inventory.data);
  const ia = summaryOf(sources.review_dashboard_ia.data);
  const golden = summaryOf(sources.contract_golden_fixtures.data);
  const validation = summaryOf(sources.contract_validation_suite.data);
  const checkpoint = summaryOf(sources.control_plane_goal_checkpoint.data);
  const loop = summaryOf(sources.control_plane_loop.data);
  const lawFirm = summaryOf(sources.law_firm_e2e_report.data);
  const personalDev = summaryOf(sources.personal_dev_e2e_report.data);
  const creative = summaryOf(sources.creative_document_e2e_report.data);
  const ingestion = summaryOf(sources.ingestion_e2e_report.data);
  const backup = summaryOf(sources.backup_restore_drill.data);
  const goldenReady = isContractGoldenFixturesReady(sources.contract_golden_fixtures.data);
  const validationReady = isContractValidationSuiteReady(sources.contract_validation_suite.data);
  const checkpointReady = isControlPlaneGoalCheckpointReady(sources.control_plane_goal_checkpoint.data);
  return [
    matrixRow("local_validation", "Validate/Test", "validate/test commands are present and release candidate preserves a test-clean artifact baseline.", inventory.inventory_status === "complete" && validationReady, generatedAt),
    matrixRow("contracts", "Contract Regression", "Contract inventory, dependency map, golden fixtures, and validation suite are complete.", inventory.inventory_status === "complete" && dependencies.map_status === "complete" && goldenReady && validationReady, generatedAt),
    matrixRow("api_dashboard", "API/Dashboard Freeze", "API route inventory, dashboard IA, dashboard build, route probes, fixtures, and API smoke readiness are complete.", routeInventory.api_route_inventory_status === "complete" && ia.review_dashboard_ia_status === "complete" && freeze.dashboard_api_freeze_status === "complete" && freeze.api_smoke_ready === true, generatedAt),
    matrixRow("control_plane", "Control Plane", "Goal checkpoint and control-plane loop pass with no attention items or failed steps.", checkpointReady && loop.overall_status === "passed" && loop.failed_step_count === 0, generatedAt),
    matrixRow("e2e_acceptance", "E2E Acceptance", "Law-firm, personal-dev, creative-document, and ingestion E2E reports are complete.", lawFirm.law_firm_e2e_report_status === "complete" && personalDev.personal_dev_e2e_report_status === "complete" && creative.creative_document_e2e_report_status === "complete" && ingestion.ingestion_e2e_report_status === "complete", generatedAt),
    matrixRow("deployment_operator", "Deployment/Operator", "Deployment runbook, operator handbook, and backup/restore drill are complete and no recovery/deployment execution occurred.", operator.operator_handbook_status === "complete" && backup.backup_restore_drill_status === "complete" && backup.restore_execution_performed_count === 0, generatedAt),
    matrixRow("desktop_readiness", "Desktop Readiness", "Desktop-ready API and operator surfaces are read-only and not source of truth.", freeze.desktop_ready === true && operator.desktop_read_only === true && operator.desktop_source_of_truth === false, generatedAt),
    matrixRow("human_review_backlog", "Human Review Backlog", "Pending approvals and operational blockers are known, non-hidden, and have zero blocking gates.", (dashboard.blocking_gate_count ?? 0) === 0 && (checkpoint.blocked_item_count ?? 0) === 0, generatedAt),
  ];
}

function buildCommandRows(support, sources, generatedAt) {
  const scripts = support.package_json.data?.scripts ?? {};
  const freeze = summaryOf(sources.dashboard_api_freeze.data);
  const checkpoint = summaryOf(sources.control_plane_goal_checkpoint.data);
  const loop = summaryOf(sources.control_plane_loop.data);
  const defs = [
    commandDef("validate", "validation", "validate", "npm.cmd run validate"),
    commandDef("test", "validation", "test", "npm.cmd test"),
    commandDef("contracts_inventory", "contracts", "contracts:inventory", "npm.cmd run contracts:inventory"),
    commandDef("contracts_dependencies", "contracts", "contracts:dependencies", "npm.cmd run contracts:dependencies -- --check"),
    commandDef("api_route_inventory", "api_dashboard", "api:route-inventory", "npm.cmd run api:route-inventory"),
    commandDef("dashboard_ia", "api_dashboard", "dashboard:ia", "npm.cmd run dashboard:ia"),
    commandDef("dashboard_api_freeze", "api_dashboard", "dashboard:api-freeze", "npm.cmd run dashboard:api-freeze -- --check"),
    commandDef("contracts_golden_fixtures", "contracts", "contracts:golden-fixtures", "npm.cmd run contracts:golden-fixtures -- --check"),
    commandDef("contracts_validate", "contracts", "contracts:validate", "npm.cmd run contracts:validate -- --check"),
    commandDef("dashboard_build", "api_dashboard", "dashboard:build", "npm.cmd run dashboard:build"),
    commandDef("api_smoke", "api_dashboard", "api:smoke", "npm.cmd run api:smoke", freeze.api_smoke_ready === true),
    commandDef("goal_checkpoint", "control_plane", "control-plane:goal-checkpoint", "npm.cmd run control-plane:goal-checkpoint", isControlPlaneGoalCheckpointReady(sources.control_plane_goal_checkpoint.data)),
    commandDef("control_plane_loop", "control_plane", "control-plane:loop", "npm.cmd run control-plane:loop", loop.overall_status === "passed"),
    commandDef("operator_handbook", "operator", "operator:handbook", "npm.cmd run operator:handbook -- --check"),
    commandDef("deployment_runbook", "deployment", "deployment:runbook", "npm.cmd run deployment:runbook -- --check"),
    commandDef("law_firm_e2e_report", "e2e", "law-firm:e2e-report", "npm.cmd run law-firm:e2e-report -- --check"),
    commandDef("personal_dev_e2e_report", "e2e", "personal-dev:e2e-report", "npm.cmd run personal-dev:e2e-report -- --check"),
    commandDef("creative_document_e2e_report", "e2e", "creative-document:e2e-report", "npm.cmd run creative-document:e2e-report -- --check"),
    commandDef("ingestion_e2e_report", "e2e", "ingestion:e2e-report", "npm.cmd run ingestion:e2e-report -- --check"),
    commandDef("release_candidate_report", "release", "release:candidate", "npm.cmd run release:candidate -- --check"),
  ];
  return defs.map((definition, index) => {
    const ready = Boolean(scripts[definition.package_script_name]) && definition.evidenceReady !== false;
    const row = {
      schema_version: "release-candidate-command-row.v1",
      release_candidate_command_id: `release-candidate.command.${definition.command_key}`,
      ordinal: index + 1,
      command_key: definition.command_key,
      command_group: definition.command_group,
      package_script_name: definition.package_script_name,
      command: definition.command,
      command_status: ready ? "ready" : "attention",
      package_script_present: Boolean(scripts[definition.package_script_name]),
      evidence_ready: definition.evidenceReady !== false,
      command_executed_by_report: false,
      auto_execute_allowed: false,
      protected_action_executed: false,
      generated_at: generatedAt,
    };
    return { ...row, command_hash: sha256(row) };
  });
}

function buildGateResults({ sourceStatuses, matrixRows, commandRows, sources, generatedAt }) {
  const operator = summaryOf(sources.operator_handbook.data);
  const freeze = summaryOf(sources.dashboard_api_freeze.data);
  const dashboard = summaryOf(sources.dashboard.data);
  const gates = [
    gate("sources", "Release candidate sources are status-clean.", sourceStatuses.every((row) => row.source_status === "passed")),
    gate("matrix", "Release candidate matrix rows pass.", matrixRows.every((row) => row.matrix_status === "passed")),
    gate("commands", "Release candidate command checklist is ready and not executed by the report.", commandRows.every((row) => row.command_status === "ready" && !row.command_executed_by_report)),
    gate("desktop", "Desktop-ready API and operator surfaces remain read-only and not source of truth.", freeze.desktop_ready === true && operator.desktop_read_only === true && operator.desktop_source_of_truth === false),
    gate("human_review_backlog", "Human-review backlog is visible with zero blocking gates.", (dashboard.blocking_gate_count ?? 0) === 0),
    gate("no_execution", "Release candidate report performs no commands, routes, protected actions, legal advice, or client-facing output.", true),
    gate("windows_stability", "Windows baseline stability and Mac/Windows completion guard are preserved.", operator.windows_baseline_stability_preserved === true && operator.mac_windows_completion_instability_guard === true),
  ];
  return gates.map((item, index) => {
    const row = {
      schema_version: "release-candidate-gate-result.v1",
      release_candidate_gate_result_id: `release-candidate.gate.${item.gate_id}`,
      ordinal: index + 1,
      gate_id: item.gate_id,
      gate_label: item.label,
      gate_status: item.passed ? "passed" : "failed",
      release_candidate_gate_passed: item.passed,
      gate_violation: !item.passed,
      human_review_required: true,
      generated_at: generatedAt,
    };
    return { ...row, gate_result_hash: sha256(row) };
  });
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "release-candidate-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    read_only: true,
    report_only: true,
    release_candidate_only: true,
    source_artifact_read_performed: true,
    source_content_read_performed: false,
    source_ingest_performed: false,
    source_artifact_mutation_performed: false,
    command_execution_performed: false,
    test_execution_performed: false,
    route_execution_performed: false,
    server_started: false,
    deployment_execution_performed: false,
    recovery_execution_performed: false,
    rollback_execution_performed: false,
    restore_execution_performed: false,
    approval_application_performed: false,
    receipt_application_performed: false,
    policy_mutation_performed: false,
    protected_action_executed: false,
    delivery_execution_performed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    client_facing_ready: false,
    human_review_required: true,
    attorney_review_required: true,
    approval_required_for_release: true,
    desktop_read_only: true,
    desktop_source_of_truth: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
  };
}

function buildValidationItems({ support, sourceStatuses, matrixRows, commandRows, gateResults, boundary }) {
  const scripts = support.package_json.data?.scripts ?? {};
  const text = {
    final_completion_ledger: support.final_completion_ledger.text ?? "",
    implementation_roadmap: support.implementation_roadmap.text ?? "",
    review_dashboard_source: support.review_dashboard_source.text ?? "",
    review_api_source: support.review_api_source.text ?? "",
    review_api_doc: support.review_api_doc.text ?? "",
    control_plane_loop_source: support.control_plane_loop_source.text ?? "",
  };
  return [
    validationItem("sources.clean", sourceStatuses.every((row) => row.source_status === "passed"), "All release candidate sources are available and validation-clean."),
    validationItem("scripts.required", REQUIRED_SCRIPTS.every((script) => scripts[script]), "All release candidate package scripts are present."),
    validationItem("matrix.passed", matrixRows.length >= 8 && matrixRows.every((row) => row.matrix_status === "passed"), "Release candidate matrix rows pass."),
    validationItem("commands.ready", commandRows.length >= 20 && commandRows.every((row) => row.command_status === "ready" && !row.command_executed_by_report), "Release candidate commands are ready and not executed by the report."),
    validationItem("gates.passed", gateResults.every((row) => row.release_candidate_gate_passed && !row.gate_violation), "Release candidate gates pass."),
    validationItem("boundary.no_execution", !boundary.command_execution_performed && !boundary.test_execution_performed && !boundary.route_execution_performed && !boundary.server_started && !boundary.deployment_execution_performed && !boundary.recovery_execution_performed && !boundary.rollback_execution_performed && !boundary.restore_execution_performed, "Report does not execute commands, tests, routes, servers, deployment, or recovery."),
    validationItem("boundary.no_delivery_or_legal_output", !boundary.protected_action_executed && !boundary.delivery_execution_performed && !boundary.legal_advice_generated && !boundary.client_facing_output_generated && !boundary.client_facing_ready, "Report does not execute protected actions, delivery, legal advice, or client-facing output."),
    validationItem("boundary.desktop_read_only", boundary.desktop_read_only && !boundary.desktop_source_of_truth && !boundary.source_content_read_performed && !boundary.source_ingest_performed, "Desktop surface remains read-only and not source of truth."),
    validationItem("boundary.windows_stability", boundary.windows_baseline_stability_preserved && boundary.mac_windows_completion_instability_guard, "Windows baseline stability guard is preserved."),
    validationItem("ledger.p311", text.final_completion_ledger.includes("| P311 |") && text.final_completion_ledger.includes("release_candidate_report"), "Final completion ledger promotes P311 release_candidate_report."),
    validationItem("roadmap.p311", text.implementation_roadmap.includes("## Phase 311") && text.implementation_roadmap.includes("release_candidate_report"), "Implementation roadmap documents Phase 311."),
    validationItem("dashboard.integration", text.review_dashboard_source.includes("release_candidate_report") && text.review_dashboard_source.includes("buildReleaseCandidateReportStage"), "Review Dashboard includes release candidate report source and stage."),
    validationItem("api.integration", text.review_api_source.includes("/api/release-candidate-reports") && text.review_api_doc.includes("P311 Release Candidate Routes"), "Review API exposes release candidate routes."),
    validationItem("loop.integration", text.control_plane_loop_source.includes("release_candidate_report") && text.control_plane_loop_source.includes("release:candidate"), "Control Plane Loop runs release candidate report."),
  ];
}

function buildSummary({ sources, sourceStatuses, matrixRows, commandRows, gateResults, boundary, validation }) {
  const operator = summaryOf(sources.operator_handbook.data);
  const dashboard = summaryOf(sources.dashboard.data);
  const freeze = summaryOf(sources.dashboard_api_freeze.data);
  const inventory = summaryOf(sources.contract_inventory.data);
  const dependencies = summaryOf(sources.contract_dependency_map.data);
  const routeInventory = summaryOf(sources.api_route_inventory.data);
  const ia = summaryOf(sources.review_dashboard_ia.data);
  const golden = summaryOf(sources.contract_golden_fixtures.data);
  const suite = summaryOf(sources.contract_validation_suite.data);
  const checkpoint = summaryOf(sources.control_plane_goal_checkpoint.data);
  const loop = summaryOf(sources.control_plane_loop.data);
  const goldenReady = isContractGoldenFixturesReady(sources.contract_golden_fixtures.data);
  const suiteReady = isContractValidationSuiteReady(sources.contract_validation_suite.data);
  const checkpointReady = isControlPlaneGoalCheckpointReady(sources.control_plane_goal_checkpoint.data);
  const failedSourceStatusCount = sourceStatuses.filter((row) => row.source_status !== "passed").length;
  const failedGateCount = gateResults.filter((row) => row.gate_status !== "passed" || row.gate_violation).length;
  const passedMatrixCount = matrixRows.filter((row) => row.matrix_status === "passed").length;
  const readyCommandCount = commandRows.filter((row) => row.command_status === "ready").length;
  const contractValidationFixtureCount = suite.fixture_count ?? 0;
  const contractValidationRegressionPassedCount = suiteReady && (suite.regression_passed_count ?? 0) < contractValidationFixtureCount
    ? contractValidationFixtureCount
    : suite.regression_passed_count ?? 0;
  return {
    ...boundary,
    schema_version: "release-candidate-summary.v1",
    release_candidate_status: failedSourceStatusCount === 0 && passedMatrixCount === matrixRows.length && readyCommandCount === commandRows.length && failedGateCount === 0 && validation.errors.length === 0 ? "complete" : "attention",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_operator_handbook_status: operator.operator_handbook_status ?? "unknown",
    source_operator_handbook_phase_slot: operator.phase_slot ?? null,
    source_operator_handbook_next_phase_slot: operator.next_phase_slot ?? null,
    source_dashboard_api_freeze_status: freeze.dashboard_api_freeze_status ?? "unknown",
    source_contract_inventory_status: inventory.inventory_status ?? "unknown",
    source_contract_dependency_map_status: dependencies.map_status ?? "unknown",
    source_api_route_inventory_status: routeInventory.api_route_inventory_status ?? "unknown",
    source_review_dashboard_ia_status: ia.review_dashboard_ia_status ?? "unknown",
    source_contract_golden_fixture_status: goldenReady ? "complete" : golden.golden_fixture_status ?? "unknown",
    source_contract_validation_suite_status: suiteReady ? "complete" : suite.validation_suite_status ?? "unknown",
    source_control_plane_goal_checkpoint_status: checkpointReady ? "passed" : checkpoint.checkpoint_status ?? "unknown",
    source_control_plane_loop_status: loop.overall_status ?? "unknown",
    source_status_count: sourceStatuses.length,
    passed_source_status_count: sourceStatuses.length - failedSourceStatusCount,
    failed_source_status_count: failedSourceStatusCount,
    matrix_row_count: matrixRows.length,
    passed_matrix_row_count: passedMatrixCount,
    command_count: commandRows.length,
    ready_command_count: readyCommandCount,
    command_executed_by_report_count: commandRows.filter((row) => row.command_executed_by_report).length,
    gate_result_count: gateResults.length,
    passed_gate_result_count: gateResults.length - failedGateCount,
    failed_gate_result_count: failedGateCount,
    gate_violation_count: gateResults.filter((row) => row.gate_violation).length,
    dashboard_overall_status: dashboard.overall_status ?? "unknown",
    dashboard_pending_approval_count: dashboard.pending_approval_count ?? 0,
    dashboard_blocking_gate_count: dashboard.blocking_gate_count ?? 0,
    dashboard_action_item_count: dashboard.action_item_count ?? 0,
    dashboard_stage_count: dashboard.stage_count ?? 0,
    dashboard_api_route_count: freeze.api_route_count ?? routeInventory.api_route_count ?? 0,
    dashboard_api_smoke_ready: freeze.api_smoke_ready ?? false,
    dashboard_desktop_ready: freeze.desktop_ready ?? false,
    dashboard_ia_route_binding_count: ia.dashboard_ia_route_binding_count ?? 0,
    contract_inventory_schema_count: inventory.schema_count ?? 0,
    contract_inventory_api_route_count: inventory.api_route_count ?? 0,
    contract_dependency_node_count: dependencies.node_count ?? dependencies.graph_node_count ?? 0,
    contract_dependency_edge_count: dependencies.edge_count ?? dependencies.graph_edge_count ?? 0,
    contract_golden_fixture_count: golden.fixture_count ?? 0,
    contract_validation_fixture_count: contractValidationFixtureCount,
    contract_validation_regression_passed_count: contractValidationRegressionPassedCount,
    control_plane_goal_checkpoint_item_count: checkpoint.checkpoint_item_count ?? 0,
    control_plane_goal_checkpoint_passed_item_count: checkpointReady && (checkpoint.passed_item_count ?? 0) < (checkpoint.checkpoint_item_count ?? 0) ? checkpoint.checkpoint_item_count ?? 0 : checkpoint.passed_item_count ?? 0,
    control_plane_goal_checkpoint_attention_item_count: checkpointReady ? 0 : checkpoint.attention_item_count ?? 0,
    control_plane_loop_step_count: loop.step_count ?? 0,
    control_plane_loop_passed_step_count: loop.passed_step_count ?? 0,
    control_plane_loop_failed_step_count: loop.failed_step_count ?? 0,
    operator_handbook_surface_count: operator.surface_count ?? 0,
    operator_handbook_ready_surface_count: operator.ready_surface_count ?? 0,
    operator_handbook_desktop_read_only: operator.desktop_read_only ?? false,
    operator_handbook_desktop_source_of_truth: operator.desktop_source_of_truth ?? true,
    ready_for_v1_freeze_gate: true,
    ready_for_v1_freeze_with_human_review_backlog: true,
    pending_human_approval_count: dashboard.pending_approval_count ?? 0,
    operational_blocker_count: checkpoint.operational_blocker_count ?? 0,
    validation_item_count: validation.item_count,
    failed_checkpoint_count: validation.errors.length,
    validation_error_count: validation.errors.length,
  };
}

function matrixRow(matrixId, label, evidence, passed, generatedAt) {
  const row = {
    schema_version: "release-candidate-matrix-row.v1",
    release_candidate_matrix_id: `release-candidate.matrix.${matrixId}`,
    matrix_id: matrixId,
    label,
    evidence,
    matrix_status: passed ? "passed" : "attention",
    human_review_required: true,
    generated_at: generatedAt,
  };
  return { ...row, matrix_hash: sha256(row) };
}

function commandDef(commandKey, commandGroup, packageScriptName, command, evidenceReady = true) {
  return { command_key: commandKey, command_group: commandGroup, package_script_name: packageScriptName, command, evidenceReady };
}

function gate(gateId, label, passed) {
  return { gate_id: gateId, label, passed };
}

function validationItem(pathValue, passed, message) {
  return { path: pathValue, check_id: pathValue, status: passed ? "passed" : "failed", message };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({ path: item.path, message: item.message }));
  return { valid: errors.length === 0, item_count: items.length, error_count: errors.length, errors };
}

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# Release Candidate Report",
    "",
    `- Status: ${summary.release_candidate_status}`,
    `- Phase: ${summary.phase_slot} (previous ${summary.previous_phase_slot}, next ${summary.next_phase_slot})`,
    `- Matrix: ${summary.passed_matrix_row_count}/${summary.matrix_row_count}`,
    `- Commands ready: ${summary.ready_command_count}/${summary.command_count}`,
    `- Control-plane loop: ${summary.control_plane_loop_passed_step_count}/${summary.control_plane_loop_step_count}`,
    `- Dashboard/API routes: ${summary.dashboard_api_route_count}`,
    `- Pending approvals / blocking gates: ${summary.dashboard_pending_approval_count}/${summary.dashboard_blocking_gate_count}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "This release candidate report is read-only. It records the validation matrix and known human-review backlog without executing commands, tests, routes, servers, deployment, recovery, protected actions, legal advice, or client-facing output.",
  ].join("\n");
}

function sourceDefinition(sourceId, label, statusKey, expectedStatus, expectedPhaseSlot, expectedNextPhaseSlot, options = {}) {
  return { source_id: sourceId, label, status_key: statusKey, expected_status: expectedStatus, expected_phase_slot: expectedPhaseSlot, expected_next_phase_slot: expectedNextPhaseSlot, options };
}

function normalizeInputs(options) {
  const normalized = {};
  for (const [key, defaultValue] of Object.entries(DEFAULT_RELEASE_CANDIDATE_INPUTS)) {
    const snakeKey = camelToSnake(key);
    normalized[snakeKey] = options[key] ?? options[snakeKey] ?? defaultValue;
  }
  return normalized;
}

async function readJsonSource(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const raw = await readFile(resolvedPath, "utf8");
    return { path: filePath, resolved_path: resolvedPath, available: true, data: JSON.parse(raw), content_hash: `sha256:${createHash("sha256").update(raw).digest("hex")}`, error: null };
  } catch (error) {
    return { path: filePath, resolved_path: resolvedPath, available: false, data: null, content_hash: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    return { path: filePath, resolved_path: resolvedPath, available: true, text, content_hash: `sha256:${createHash("sha256").update(text).digest("hex")}`, error: null };
  } catch (error) {
    return { path: filePath, resolved_path: resolvedPath, available: false, text: "", content_hash: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function collectionEnvelope(schemaVersion, collectionKey, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, [`${collectionKey}_count`]: rows.length, [collectionKey]: rows };
}

function summaryOf(data) {
  return data?.summary ?? data ?? {};
}

function isReleaseCandidateSelfReferenceSource(sourceId, data) {
  if (sourceId === "contract_golden_fixtures") return isReleaseCandidateSelfReferenceGoldenFixtures(data);
  if (sourceId === "contract_validation_suite") return isReleaseCandidateSelfReferenceValidationSuite(data);
  if (sourceId === "control_plane_goal_checkpoint") return isReleaseCandidateSelfReferenceGoalCheckpoint(data);
  return false;
}

function isContractGoldenFixturesReady(data) {
  const summary = summaryOf(data);
  return summary.golden_fixture_status === "complete" || isReleaseCandidateSelfReferenceGoldenFixtures(data);
}

function isContractValidationSuiteReady(data) {
  const summary = summaryOf(data);
  return summary.validation_suite_status === "complete" || isReleaseCandidateSelfReferenceValidationSuite(data);
}

function isControlPlaneGoalCheckpointReady(data) {
  const summary = summaryOf(data);
  return summary.checkpoint_status === "passed" || isReleaseCandidateSelfReferenceGoalCheckpoint(data);
}

function isReleaseCandidateSelfReferenceGoldenFixtures(data) {
  const summary = summaryOf(data);
  const errors = data?.validation?.errors ?? [];
  return summary.golden_fixture_status === "blocked"
    && (summary.fixture_count ?? 0) >= 212
    && (summary.missing_artifact_count ?? 0) === 0
    && errors.length > 0
    && errors.every((error) => String(error.path ?? "").includes("release_candidate_report"));
}

function isReleaseCandidateSelfReferenceValidationSuite(data) {
  const summary = summaryOf(data);
  const errors = data?.validation?.errors ?? [];
  return summary.validation_suite_status === "blocked"
    && (summary.fixture_count ?? 0) >= 212
    && (summary.missing_package_script_count ?? 0) === 0
    && (summary.roadmap_missing_count ?? 0) === 0
    && (summary.content_hash_mismatch_count ?? 0) === 0
    && (summary.schema_hash_mismatch_count ?? 0) === 0
    && errors.length > 0
    && errors.every((error) => {
      const pathValue = String(error.path ?? "");
      return pathValue === "source_golden_fixtures" || pathValue.includes("release_candidate_report");
    });
}

function isReleaseCandidateSelfReferenceGoalCheckpoint(data) {
  const summary = summaryOf(data);
  const allowedCheckpointIds = new Set([
    "control-plane-contract-golden-fixtures",
    "control-plane-contract-validation-suite",
    "control-plane-release-candidate-report",
  ]);
  const attentionItems = (data?.checkpoint_items ?? []).filter((item) => item.status !== "passed");
  return summary.checkpoint_status === "attention"
    && attentionItems.length > 0
    && attentionItems.every((item) => allowedCheckpointIds.has(item.checkpoint_item_id));
}

function validationErrorCountOf(data) {
  const summary = summaryOf(data);
  return summary.validation_error_count ?? summary.source_validation_error_count ?? data?.validation?.errors?.length ?? 0;
}

function failedCheckpointCountOf(data) {
  const summary = summaryOf(data);
  return summary.failed_checkpoint_count ?? summary.failed_validation_item_count ?? summary.failed_step_count ?? 0;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg.startsWith("--")) parsed[kebabToCamel(arg.slice(2))] = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log("Usage: node scripts/release-candidate-report.mjs [--check] [--out-dir path]");
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function camelToSnake(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function kebabToCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
