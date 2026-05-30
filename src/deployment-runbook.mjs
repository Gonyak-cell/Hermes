import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_DEPLOYMENT_RUNBOOK_OUT_DIR = "artifacts/deployment-runbook/latest";
export const DEFAULT_DEPLOYMENT_RUNBOOK_INPUTS = {
  ingestionE2eReportPath: "artifacts/ingestion-e2e-report/latest/ingestion-e2e-report.json",
  dashboardApiFreezePath: "artifacts/dashboard-api-freeze/latest/dashboard-api-freeze.json",
  backupRestoreDrillPath: "artifacts/backup-restore-drill/latest/backup-restore-drill-report.json",
  runtimeFreezePath: "artifacts/runtime-freeze/latest/runtime-freeze.json",
  controlPlaneLoopPath: "artifacts/control-plane-loop/latest/control-plane-loop.json",
  rollbackPlanArtifactPath: "artifacts/rollback-plan-artifact/latest/rollback-plan-artifact.json",
  packagePath: "package.json",
  finalCompletionLedgerPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardSourcePath: "src/review-dashboard.mjs",
  reviewApiSourcePath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
  controlPlaneLoopSourcePath: "src/control-plane-loop.mjs",
};

const SCHEMA_VERSION = "deployment-runbook.v1";
const CAPABILITY_ID = "deployment.runbook";
const PHASE_SLOT = "P309";
const PREVIOUS_PHASE_SLOT = "P308";
const NEXT_PHASE_SLOT = "P310";

const SOURCE_DEFINITIONS = [
  sourceDefinition("ingestion_e2e_report", "Ingestion E2E Report", "ingestion_e2e_report_status", "complete", "P308", "P309"),
  sourceDefinition("dashboard_api_freeze", "Dashboard/API Freeze", "dashboard_api_freeze_status", "complete", "P296", "P297"),
  sourceDefinition("backup_restore_drill", "Backup/Restore Drill", "backup_restore_drill_status", "complete", "P304", "P305"),
  sourceDefinition("runtime_freeze", "Runtime Freeze", "runtime_freeze_status", "complete", null, null),
  sourceDefinition("control_plane_loop", "Control Plane Loop", "overall_status", "passed", null, null),
  sourceDefinition("rollback_plan_artifact", "Rollback Plan Artifact", "rollback_plan_artifact_status", "complete", null, null),
];

const REQUIRED_SCRIPTS = [
  "validate",
  "test",
  "contracts:inventory",
  "contracts:dependencies",
  "contracts:golden-fixtures",
  "contracts:validate",
  "dashboard:api-freeze",
  "dashboard:build",
  "api:smoke",
  "control-plane:goal-checkpoint",
  "control-plane:loop",
  "ingestion:e2e-report",
  "compliance:backup-restore-drill",
  "runtime:freeze",
  "personal-dev:rollback-plan",
  "deployment:runbook",
];

export async function runDeploymentRunbook(options = {}) {
  const result = await buildDeploymentRunbook(options);
  if (options.write !== false) await writeDeploymentRunbook(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Deployment runbook validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildDeploymentRunbook(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DEPLOYMENT_RUNBOOK_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    ingestion_e2e_report: await readJsonSource(inputs.ingestion_e2e_report_path),
    dashboard_api_freeze: await readJsonSource(inputs.dashboard_api_freeze_path),
    backup_restore_drill: await readJsonSource(inputs.backup_restore_drill_path),
    runtime_freeze: await readJsonSource(inputs.runtime_freeze_path),
    control_plane_loop: await readJsonSource(inputs.control_plane_loop_path),
    rollback_plan_artifact: await readJsonSource(inputs.rollback_plan_artifact_path),
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
  const deploymentEnvironmentRows = buildDeploymentEnvironmentRows(sources, support, generatedAt);
  const deploymentCommandRows = buildDeploymentCommandRows(support, generatedAt);
  const deploymentChecklistRows = buildDeploymentChecklistRows(sources, deploymentEnvironmentRows, deploymentCommandRows, generatedAt);
  const rollbackProcedureRows = buildRollbackProcedureRows(sources, support, generatedAt);
  const gateResults = buildGateResults({ sourceStatuses, deploymentEnvironmentRows, deploymentCommandRows, deploymentChecklistRows, rollbackProcedureRows, generatedAt });
  const boundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({ support, sourceStatuses, deploymentEnvironmentRows, deploymentCommandRows, deploymentChecklistRows, rollbackProcedureRows, gateResults, boundary });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ sources, sourceStatuses, deploymentEnvironmentRows, deploymentCommandRows, deploymentChecklistRows, rollbackProcedureRows, gateResults, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    deployment_runbook_id: `deployment-runbook.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    source_statuses: sourceStatuses,
    deployment_runbook_contract: buildContract(generatedAt),
    deployment_environment_rows: deploymentEnvironmentRows,
    deployment_command_rows: deploymentCommandRows,
    deployment_checklist_rows: deploymentChecklistRows,
    rollback_procedure_rows: rollbackProcedureRows,
    deployment_gate_results: gateResults,
    deployment_runbook_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  result.summary.deployment_runbook_id = result.deployment_runbook_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeDeploymentRunbook(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = JSON.parse(JSON.stringify(result));
  delete serializable.markdown;
  await writeJson(path.join(outDir, "deployment-runbook.json"), serializable);
  await writeJson(path.join(outDir, "deployment-runbook-sources.json"), collectionEnvelope("deployment-runbook-sources.v1", "source_statuses", result.source_statuses, result.generated_at));
  await writeJson(path.join(outDir, "deployment-environments.json"), collectionEnvelope("deployment-environments.v1", "deployment_environment_rows", result.deployment_environment_rows, result.generated_at));
  await writeJson(path.join(outDir, "deployment-commands.json"), collectionEnvelope("deployment-commands.v1", "deployment_command_rows", result.deployment_command_rows, result.generated_at));
  await writeJson(path.join(outDir, "deployment-checklists.json"), collectionEnvelope("deployment-checklists.v1", "deployment_checklist_rows", result.deployment_checklist_rows, result.generated_at));
  await writeJson(path.join(outDir, "deployment-rollback-procedures.json"), collectionEnvelope("deployment-rollback-procedures.v1", "rollback_procedure_rows", result.rollback_procedure_rows, result.generated_at));
  await writeJson(path.join(outDir, "deployment-gate-results.json"), collectionEnvelope("deployment-gate-results.v1", "deployment_gate_results", result.deployment_gate_results, result.generated_at));
  await writeJson(path.join(outDir, "deployment-runbook-boundary.json"), result.deployment_runbook_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "deployment-runbook-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDeploymentRunbookCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runDeploymentRunbook(args);
    console.log(`Deployment runbook ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.deployment_runbook_status}`);
    console.log(`Environments: ${result.summary.ready_environment_count}/${result.summary.environment_count}`);
    console.log(`Commands documented: ${result.summary.documented_command_count}/${result.summary.command_count}`);
    console.log(`Rollback steps: ${result.summary.rollback_procedure_step_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "deployment-runbook-contract.v1",
    contract_id: SCHEMA_VERSION,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    deployment_scope: "local_dev_prod_like_desktop_companion_optional_and_rollback",
    source_of_truth: "deployment_runbook_phase_artifacts",
    execution_model: "deterministic_read_only_runbook",
    human_review_rule: "deployment, Desktop Companion enablement, rollback, protected operations, delivery, and client-facing use require explicit human approval",
    windows_baseline_rule: "P309 is valid only after the P308 Windows baseline stability posture is preserved",
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
    const row = {
      schema_version: "deployment-runbook-source-status.v1",
      source_status_id: `deployment-runbook.source.${definition.source_id}`,
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
      validation_error_count: validationErrorCount,
      failed_checkpoint_count: failedCheckpointCount,
      source_status: source?.available && actualStatus === definition.expected_status && phaseMatches && nextPhaseMatches && validationErrorCount === 0 && failedCheckpointCount === 0 ? "passed" : "failed",
      error: source?.error ?? null,
    };
    return { ...row, source_status_hash: sha256(row) };
  });
}

function buildDeploymentEnvironmentRows(sources, support, generatedAt) {
  const scripts = support.package_json.data?.scripts ?? {};
  const ingestion = summaryOf(sources.ingestion_e2e_report.data);
  const dashboard = summaryOf(sources.dashboard_api_freeze.data);
  const backup = summaryOf(sources.backup_restore_drill.data);
  const runtime = summaryOf(sources.runtime_freeze.data);
  const loop = summaryOf(sources.control_plane_loop.data);
  const rollback = summaryOf(sources.rollback_plan_artifact.data);
  return [
    environmentRow({
      generatedAt,
      environmentId: "local",
      label: "Local Windows baseline",
      status: hasScripts(scripts, ["validate", "test", "dashboard:build", "api:smoke"]) && ingestion.ingestion_e2e_report_status === "complete",
      commandKeys: ["validate", "test", "dashboard_build", "api_smoke"],
      evidence: "Local verification uses validate, node test, dashboard build, and API smoke on the Windows baseline.",
    }),
    environmentRow({
      generatedAt,
      environmentId: "dev",
      label: "Development integration",
      status: hasScripts(scripts, ["contracts:inventory", "contracts:dependencies", "contracts:golden-fixtures", "contracts:validate", "control-plane:goal-checkpoint"]) && dashboard.dashboard_api_freeze_status === "complete",
      commandKeys: ["contracts_inventory", "contracts_dependencies", "contracts_golden_fixtures", "contracts_validate", "goal_checkpoint"],
      evidence: "Development integration is covered by contract inventory, dependency, fixture, regression, API freeze, and goal checkpoint commands.",
    }),
    environmentRow({
      generatedAt,
      environmentId: "prod_like",
      label: "Production-like dry run",
      status: hasScripts(scripts, ["ingestion:e2e-report", "compliance:backup-restore-drill", "runtime:freeze", "control-plane:loop"]) && backup.backup_restore_drill_status === "complete" && runtime.runtime_freeze_status === "complete" && loop.overall_status === "passed",
      commandKeys: ["ingestion_e2e_report", "backup_restore_drill", "runtime_freeze", "control_plane_loop"],
      evidence: "Production-like readiness is a dry-run envelope over ingestion E2E, backup/restore, runtime freeze, and control-plane loop.",
    }),
    environmentRow({
      generatedAt,
      environmentId: "desktop_companion_optional",
      label: "Optional Desktop Companion",
      status: dashboard.desktop_ready === true && dashboard.read_only === true && runtime.desktop_read_only === true && runtime.desktop_runtime_source_of_truth === false,
      commandKeys: ["dashboard_api_freeze", "dashboard_build", "api_smoke"],
      evidence: "Desktop Companion remains optional, read-only, not source of truth, and has no installer/gateway/runtime-control authority.",
      optional: true,
    }),
    environmentRow({
      generatedAt,
      environmentId: "rollback",
      label: "Rollback readiness",
      status: rollback.rollback_plan_artifact_status === "complete" && backup.backup_restore_drill_status === "complete" && rollback.rollback_execution_performed === false && backup.restore_execution_performed === false,
      commandKeys: ["rollback_plan", "backup_restore_drill"],
      evidence: "Rollback readiness is documented by human-gated rollback targets and dry-run backup/restore evidence; rollback is not executed.",
    }),
  ];
}

function buildDeploymentCommandRows(support, generatedAt) {
  const scripts = support.package_json.data?.scripts ?? {};
  const commandDefs = [
    commandDef("validate", "local", "validate", "npm.cmd run validate"),
    commandDef("test", "local", "test", "npm.cmd test"),
    commandDef("dashboard_build", "local", "dashboard:build", "npm.cmd run dashboard:build"),
    commandDef("api_smoke", "local", "api:smoke", "npm.cmd run api:smoke"),
    commandDef("contracts_inventory", "dev", "contracts:inventory", "npm.cmd run contracts:inventory"),
    commandDef("contracts_dependencies", "dev", "contracts:dependencies", "npm.cmd run contracts:dependencies -- --check"),
    commandDef("contracts_golden_fixtures", "dev", "contracts:golden-fixtures", "npm.cmd run contracts:golden-fixtures -- --check"),
    commandDef("contracts_validate", "dev", "contracts:validate", "npm.cmd run contracts:validate -- --check"),
    commandDef("dashboard_api_freeze", "dev", "dashboard:api-freeze", "npm.cmd run dashboard:api-freeze -- --check"),
    commandDef("goal_checkpoint", "dev", "control-plane:goal-checkpoint", "npm.cmd run control-plane:goal-checkpoint"),
    commandDef("ingestion_e2e_report", "prod_like", "ingestion:e2e-report", "npm.cmd run ingestion:e2e-report -- --check"),
    commandDef("backup_restore_drill", "prod_like", "compliance:backup-restore-drill", "npm.cmd run compliance:backup-restore-drill -- --check"),
    commandDef("runtime_freeze", "prod_like", "runtime:freeze", "npm.cmd run runtime:freeze -- --check"),
    commandDef("control_plane_loop", "prod_like", "control-plane:loop", "npm.cmd run control-plane:loop"),
    commandDef("rollback_plan", "rollback", "personal-dev:rollback-plan", "npm.cmd run personal-dev:rollback-plan -- --check", true),
    commandDef("deployment_runbook", "all", "deployment:runbook", "npm.cmd run deployment:runbook -- --check"),
  ];
  return commandDefs.map((definition, index) => {
    const row = {
      schema_version: "deployment-command-row.v1",
      deployment_command_id: `deployment-runbook.command.${definition.command_key}`,
      ordinal: index + 1,
      command_key: definition.command_key,
      environment_id: definition.environment_id,
      package_script_name: definition.package_script_name,
      command: definition.command,
      command_status: scripts[definition.package_script_name] ? "documented" : "missing_script",
      command_executed: false,
      auto_execute_allowed: false,
      requires_human_approval: definition.requires_human_approval,
      protected_action_executed: false,
      external_network_access_performed: false,
      secret_material_required: false,
      generated_at: generatedAt,
    };
    return { ...row, command_hash: sha256(row) };
  });
}

function buildDeploymentChecklistRows(sources, environments, commands, generatedAt) {
  const dashboard = summaryOf(sources.dashboard_api_freeze.data);
  const runtime = summaryOf(sources.runtime_freeze.data);
  const checks = [
    checklist("source_baseline", "All deployment runbook sources are complete.", environments.every((row) => row.environment_status === "ready")),
    checklist("local_commands", "Local validate/test/dashboard/API smoke commands are documented.", commandsFor(commands, "local").every((row) => row.command_status === "documented")),
    checklist("dev_contracts", "Development contract, golden fixture, and checkpoint commands are documented.", commandsFor(commands, "dev").every((row) => row.command_status === "documented")),
    checklist("prod_like_dry_run", "Production-like runbook uses dry-run verification and control-plane loop, not deployment execution.", commandsFor(commands, "prod_like").every((row) => row.command_status === "documented" && row.command_executed === false)),
    checklist("desktop_read_only", "Optional Desktop Companion is read-only and not source of truth.", dashboard.desktop_ready === true && runtime.desktop_read_only === true && runtime.desktop_runtime_source_of_truth === false),
    checklist("rollback_human_gate", "Rollback procedures are documented and require human approval before execution.", commands.some((row) => row.command_key === "rollback_plan" && row.requires_human_approval && !row.command_executed)),
  ];
  return checks.map((item, index) => {
    const row = {
      schema_version: "deployment-checklist-row.v1",
      deployment_checklist_id: `deployment-runbook.checklist.${item.check_key}`,
      ordinal: index + 1,
      check_key: item.check_key,
      check_status: item.passed ? "passed" : "failed",
      check_description: item.description,
      generated_at: generatedAt,
    };
    return { ...row, checklist_hash: sha256(row) };
  });
}

function buildRollbackProcedureRows(sources, support, generatedAt) {
  const rollback = summaryOf(sources.rollback_plan_artifact.data);
  const backup = summaryOf(sources.backup_restore_drill.data);
  const scripts = support.package_json.data?.scripts ?? {};
  const rows = [
    rollbackStep("confirm_human_approval", "Confirm explicit human approval before rollback, restore, delivery state changes, or protected operations.", true),
    rollbackStep("review_rollback_plan", "Review rollback commit/file/command targets from Rollback Plan Artifact.", rollback.rollback_plan_artifact_status === "complete" && (rollback.rollback_command_target_count ?? 0) > 0),
    rollbackStep("verify_backup_restore_dry_run", "Verify backup/restore dry-run evidence before any restore procedure.", backup.backup_restore_drill_status === "complete" && backup.restore_execution_performed === false),
    rollbackStep("rerun_validation_after_rollback", "After any human-approved rollback outside this runbook, rerun validate, tests, API smoke, and goal checkpoint.", hasScripts(scripts, ["validate", "test", "api:smoke", "control-plane:goal-checkpoint"])),
  ];
  return rows.map((item, index) => {
    const row = {
      schema_version: "rollback-procedure-row.v1",
      rollback_procedure_id: `deployment-runbook.rollback.${item.step_key}`,
      ordinal: index + 1,
      step_key: item.step_key,
      rollback_status: item.passed ? "documented" : "attention",
      procedure: item.procedure,
      requires_human_approval: true,
      rollback_execution_performed: false,
      protected_action_executed: false,
      generated_at: generatedAt,
    };
    return { ...row, rollback_hash: sha256(row) };
  });
}

function buildGateResults({ sourceStatuses, deploymentEnvironmentRows, deploymentCommandRows, deploymentChecklistRows, rollbackProcedureRows, generatedAt }) {
  const gates = [
    gate("sources", "All deployment runbook source artifacts are complete.", sourceStatuses.every((row) => row.source_status === "passed")),
    gate("environments", "Local, dev, prod-like, Desktop optional, and rollback environments are ready.", deploymentEnvironmentRows.every((row) => row.environment_status === "ready")),
    gate("commands", "Deployment commands are documented and not executed by the runbook.", deploymentCommandRows.every((row) => row.command_status === "documented" && !row.command_executed)),
    gate("checklist", "Deployment checklist rows pass.", deploymentChecklistRows.every((row) => row.check_status === "passed")),
    gate("rollback", "Rollback procedure rows are documented and human-gated.", rollbackProcedureRows.every((row) => row.rollback_status === "documented" && row.requires_human_approval && !row.rollback_execution_performed)),
  ];
  return gates.map((item, index) => {
    const row = {
      schema_version: "deployment-gate-result.v1",
      deployment_gate_result_id: `deployment-runbook.gate.${item.gate_id}`,
      ordinal: index + 1,
      gate_id: item.gate_id,
      gate_label: item.label,
      gate_status: item.passed ? "passed" : "failed",
      gate_violation: !item.passed,
      human_review_required: true,
      generated_at: generatedAt,
    };
    return { ...row, gate_result_hash: sha256(row) };
  });
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "deployment-runbook-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    read_only: true,
    report_only: true,
    runbook_only: true,
    source_artifact_read_performed: true,
    source_artifact_mutation_performed: false,
    deployment_execution_performed: false,
    local_execution_performed: false,
    prod_like_execution_performed: false,
    production_deployment_performed: false,
    desktop_companion_optional: true,
    desktop_companion_deployment_required: false,
    desktop_companion_deployment_optional: true,
    desktop_companion_deployment_performed: false,
    desktop_companion_install_performed: false,
    desktop_installer_execution_performed: false,
    desktop_gateway_execution_performed: false,
    desktop_installer_or_gateway_execution_performed: false,
    server_started: false,
    route_execution_performed: false,
    rollback_execution_performed: false,
    restore_execution_performed: false,
    command_execution_performed: false,
    git_command_executed: false,
    filesystem_mutation_performed: false,
    source_mutation_performed: false,
    protected_action_executed: false,
    external_network_access_performed: false,
    secret_material_read: false,
    provider_key_exposed: false,
    delivery_execution_performed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    client_facing_ready: false,
    human_review_required: true,
    attorney_review_required: true,
    approval_required_for_prod_like: true,
    approval_required_for_rollback: true,
    desktop_read_only: true,
    desktop_source_of_truth: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
  };
}

function buildValidationItems({ support, sourceStatuses, deploymentEnvironmentRows, deploymentCommandRows, deploymentChecklistRows, rollbackProcedureRows, gateResults, boundary }) {
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
    validationItem("sources.clean", sourceStatuses.every((row) => row.source_status === "passed"), "All deployment runbook sources are complete and validation-clean."),
    validationItem("scripts.required", REQUIRED_SCRIPTS.every((script) => scripts[script]), "All deployment runbook package scripts are present."),
    validationItem("environments.ready", deploymentEnvironmentRows.length >= 5 && deploymentEnvironmentRows.every((row) => row.environment_status === "ready"), "Local/dev/prod-like/Desktop/rollback environments are ready."),
    validationItem("commands.documented", deploymentCommandRows.length >= 15 && deploymentCommandRows.every((row) => row.command_status === "documented" && !row.command_executed), "Deployment commands are documented and not executed."),
    validationItem("checklist.passed", deploymentChecklistRows.every((row) => row.check_status === "passed"), "Deployment checklist rows pass."),
    validationItem("rollback.documented", rollbackProcedureRows.length >= 4 && rollbackProcedureRows.every((row) => row.rollback_status === "documented" && row.requires_human_approval && !row.rollback_execution_performed), "Rollback procedure is documented and human-gated."),
    validationItem("gates.passed", gateResults.every((row) => row.gate_status === "passed" && !row.gate_violation), "Deployment runbook gates pass."),
    validationItem("boundary.no_execution", !boundary.deployment_execution_performed && !boundary.local_execution_performed && !boundary.prod_like_execution_performed && !boundary.production_deployment_performed && !boundary.desktop_companion_deployment_performed && !boundary.desktop_companion_install_performed && !boundary.desktop_installer_execution_performed && !boundary.desktop_gateway_execution_performed && !boundary.rollback_execution_performed && !boundary.restore_execution_performed && !boundary.command_execution_performed, "Runbook does not execute deployment, install, rollback, restore, or commands."),
    validationItem("boundary.no_delivery_or_legal_output", !boundary.protected_action_executed && !boundary.delivery_execution_performed && !boundary.legal_advice_generated && !boundary.client_facing_output_generated && !boundary.client_facing_ready, "Runbook does not execute protected actions, delivery, legal advice, or client-facing output."),
    validationItem("boundary.desktop_read_only", boundary.desktop_companion_optional && boundary.desktop_companion_deployment_optional && !boundary.desktop_companion_deployment_required && boundary.desktop_read_only && !boundary.desktop_source_of_truth && !boundary.desktop_installer_execution_performed && !boundary.desktop_gateway_execution_performed && !boundary.desktop_installer_or_gateway_execution_performed, "Desktop Companion remains optional, read-only, and not source of truth."),
    validationItem("boundary.windows_stability", boundary.windows_baseline_stability_preserved && boundary.mac_windows_completion_instability_guard, "Windows baseline stability guard is preserved."),
    validationItem("ledger.p309", text.final_completion_ledger.includes("| P309 |") && text.final_completion_ledger.includes("deployment_runbook"), "Final completion ledger promotes P309 deployment_runbook."),
    validationItem("roadmap.p309", text.implementation_roadmap.includes("## Phase 309") && text.implementation_roadmap.includes("deployment_runbook"), "Implementation roadmap documents Phase 309."),
    validationItem("dashboard.integration", text.review_dashboard_source.includes("deployment_runbook") && text.review_dashboard_source.includes("buildDeploymentRunbookStage"), "Review Dashboard includes deployment runbook source and stage."),
    validationItem("api.integration", text.review_api_source.includes("/api/deployment-runbooks") && text.review_api_doc.includes("P309 Deployment Runbook Routes"), "Review API exposes deployment runbook routes."),
    validationItem("loop.integration", text.control_plane_loop_source.includes("deployment_runbook") && text.control_plane_loop_source.includes("deployment:runbook"), "Control Plane Loop runs deployment runbook."),
  ];
}

function buildSummary({ sources, sourceStatuses, deploymentEnvironmentRows, deploymentCommandRows, deploymentChecklistRows, rollbackProcedureRows, gateResults, boundary, validation }) {
  const ingestion = summaryOf(sources.ingestion_e2e_report.data);
  const dashboard = summaryOf(sources.dashboard_api_freeze.data);
  const backup = summaryOf(sources.backup_restore_drill.data);
  const runtime = summaryOf(sources.runtime_freeze.data);
  const loop = summaryOf(sources.control_plane_loop.data);
  const rollback = summaryOf(sources.rollback_plan_artifact.data);
  const failedSourceStatusCount = sourceStatuses.filter((row) => row.source_status !== "passed").length;
  const failedGateCount = gateResults.filter((row) => row.gate_status !== "passed" || row.gate_violation).length;
  const readyEnvironmentCount = deploymentEnvironmentRows.filter((row) => row.environment_status === "ready").length;
  const documentedCommandCount = deploymentCommandRows.filter((row) => row.command_status === "documented").length;
  return {
    ...boundary,
    schema_version: "deployment-runbook-summary.v1",
    deployment_runbook_status: failedSourceStatusCount === 0 && readyEnvironmentCount === deploymentEnvironmentRows.length && documentedCommandCount === deploymentCommandRows.length && failedGateCount === 0 && validation.errors.length === 0 ? "complete" : "attention",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_ingestion_e2e_report_status: ingestion.ingestion_e2e_report_status ?? "unknown",
    source_ingestion_e2e_report_phase_slot: ingestion.phase_slot ?? null,
    source_ingestion_e2e_report_next_phase_slot: ingestion.next_phase_slot ?? null,
    source_dashboard_api_freeze_status: dashboard.dashboard_api_freeze_status ?? "unknown",
    source_backup_restore_drill_status: backup.backup_restore_drill_status ?? "unknown",
    source_runtime_freeze_status: runtime.runtime_freeze_status ?? "unknown",
    source_control_plane_loop_status: loop.overall_status ?? "unknown",
    source_rollback_plan_artifact_status: rollback.rollback_plan_artifact_status ?? "unknown",
    source_status_count: sourceStatuses.length,
    passed_source_status_count: sourceStatuses.length - failedSourceStatusCount,
    failed_source_status_count: failedSourceStatusCount,
    environment_count: deploymentEnvironmentRows.length,
    ready_environment_count: readyEnvironmentCount,
    local_environment_ready_count: countEnvironment(deploymentEnvironmentRows, "local"),
    dev_environment_ready_count: countEnvironment(deploymentEnvironmentRows, "dev"),
    prod_like_environment_ready_count: countEnvironment(deploymentEnvironmentRows, "prod_like"),
    desktop_companion_environment_ready_count: countEnvironment(deploymentEnvironmentRows, "desktop_companion_optional"),
    rollback_environment_ready_count: countEnvironment(deploymentEnvironmentRows, "rollback"),
    command_count: deploymentCommandRows.length,
    documented_command_count: documentedCommandCount,
    command_executed_count: deploymentCommandRows.filter((row) => row.command_executed).length,
    auto_execute_allowed_count: deploymentCommandRows.filter((row) => row.auto_execute_allowed).length,
    human_approval_required_command_count: deploymentCommandRows.filter((row) => row.requires_human_approval).length,
    checklist_row_count: deploymentChecklistRows.length,
    passed_checklist_row_count: deploymentChecklistRows.filter((row) => row.check_status === "passed").length,
    rollback_procedure_step_count: rollbackProcedureRows.length,
    documented_rollback_procedure_step_count: rollbackProcedureRows.filter((row) => row.rollback_status === "documented").length,
    human_review_required_rollback_count: rollbackProcedureRows.filter((row) => row.requires_human_approval).length,
    rollback_execution_performed_count: rollbackProcedureRows.filter((row) => row.rollback_execution_performed).length,
    gate_result_count: gateResults.length,
    passed_gate_result_count: gateResults.length - failedGateCount,
    failed_gate_result_count: failedGateCount,
    gate_violation_count: gateResults.filter((row) => row.gate_violation).length,
    dashboard_api_route_count: dashboard.api_route_count ?? 0,
    dashboard_desktop_ready: dashboard.desktop_ready ?? false,
    runtime_desktop_read_only: runtime.desktop_read_only ?? false,
    runtime_desktop_source_of_truth: runtime.desktop_runtime_source_of_truth ?? true,
    backup_restore_dry_run_only: backup.dry_run_only ?? false,
    backup_restore_execution_performed: backup.restore_execution_performed ?? false,
    rollback_plan_command_target_count: rollback.rollback_command_target_count ?? 0,
    rollback_plan_execution_performed: rollback.rollback_execution_performed ?? false,
    control_plane_loop_passed_step_count: loop.passed_step_count ?? 0,
    control_plane_loop_failed_step_count: loop.failed_step_count ?? 0,
    local_dev_prod_like_command_coverage_complete: deploymentEnvironmentRows.filter((row) => ["local", "dev", "prod_like"].includes(row.environment_id)).every((row) => row.environment_status === "ready"),
    rollback_procedure_documented: rollbackProcedureRows.every((row) => row.rollback_status === "documented"),
    validation_item_count: validation.item_count,
    failed_checkpoint_count: validation.errors.length,
    validation_error_count: validation.errors.length,
  };
}

function environmentRow({ generatedAt, environmentId, label, status, commandKeys, evidence, optional = false }) {
  const row = {
    schema_version: "deployment-environment-row.v1",
    deployment_environment_id: `deployment-runbook.environment.${environmentId}`,
    environment_id: environmentId,
    label,
    environment_status: status ? "ready" : "attention",
    optional,
    command_keys: commandKeys,
    command_count: commandKeys.length,
    deployment_execution_performed: false,
    human_review_required: true,
    evidence,
    generated_at: generatedAt,
  };
  return { ...row, environment_hash: sha256(row) };
}

function commandDef(commandKey, environmentId, packageScriptName, command, requiresHumanApproval = false) {
  return { command_key: commandKey, environment_id: environmentId, package_script_name: packageScriptName, command, requires_human_approval: requiresHumanApproval };
}

function checklist(checkKey, description, passed) {
  return { check_key: checkKey, description, passed };
}

function rollbackStep(stepKey, procedure, passed) {
  return { step_key: stepKey, procedure, passed };
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
    "# Deployment Runbook",
    "",
    `- Status: ${summary.deployment_runbook_status}`,
    `- Phase: ${summary.phase_slot} (previous ${summary.previous_phase_slot}, next ${summary.next_phase_slot})`,
    `- Environments: ${summary.ready_environment_count}/${summary.environment_count}`,
    `- Commands documented: ${summary.documented_command_count}/${summary.command_count}`,
    `- Rollback procedures: ${summary.documented_rollback_procedure_step_count}/${summary.rollback_procedure_step_count}`,
    `- Desktop Companion optional/read-only: ${summary.desktop_companion_optional}/${summary.desktop_read_only}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "This runbook is read-only. Deployment, Desktop installation, server start, route execution, rollback, restore, protected actions, delivery, legal advice, and client-facing output remain blocked until explicit human approval.",
  ].join("\n");
}

function commandsFor(commands, environmentId) {
  return commands.filter((row) => row.environment_id === environmentId);
}

function countEnvironment(rows, environmentId) {
  return rows.filter((row) => row.environment_id === environmentId && row.environment_status === "ready").length;
}

function hasScripts(scripts, names) {
  return names.every((name) => Boolean(scripts[name]));
}

function sourceDefinition(sourceId, label, statusKey, expectedStatus, expectedPhaseSlot, expectedNextPhaseSlot) {
  return { source_id: sourceId, label, status_key: statusKey, expected_status: expectedStatus, expected_phase_slot: expectedPhaseSlot, expected_next_phase_slot: expectedNextPhaseSlot };
}

function normalizeInputs(options) {
  const normalized = {};
  for (const [key, defaultValue] of Object.entries(DEFAULT_DEPLOYMENT_RUNBOOK_INPUTS)) {
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
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg.startsWith("--")) parsed[kebabToCamel(arg.slice(2))] = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log("Usage: node scripts/deployment-runbook.mjs [--check] [--out-dir path]\n\nWith --check, validates without writing artifacts.");
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
