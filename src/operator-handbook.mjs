import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_OPERATOR_HANDBOOK_OUT_DIR = "artifacts/operator-handbook/latest";
export const DEFAULT_OPERATOR_HANDBOOK_INPUTS = {
  deploymentRunbookPath: "artifacts/deployment-runbook/latest/deployment-runbook.json",
  approvalQueueUiPath: "artifacts/approval-queue-ui/latest/approval-queue-ui.json",
  matterCockpitUiPath: "artifacts/matter-cockpit-ui/latest/matter-cockpit-ui.json",
  policyViolationQueuePath: "artifacts/policy-violation-queue/latest/policy-violation-queue.json",
  backupRestoreDrillPath: "artifacts/backup-restore-drill/latest/backup-restore-drill-report.json",
  runLedgerViewerPath: "artifacts/run-ledger-viewer/latest/run-ledger-viewer.json",
  dashboardApiFreezePath: "artifacts/dashboard-api-freeze/latest/dashboard-api-freeze.json",
  reviewDashboardIaPath: "artifacts/review-dashboard-ia/latest/review-dashboard-ia.json",
  controlPlaneLoopPath: "artifacts/control-plane-loop/latest/control-plane-loop.json",
  humanGateReceiptDraftsPath: "artifacts/control-plane-human-gate-receipts/latest/control-plane-human-gate-receipt-drafts.json",
  workPacketReceiptDraftsPath: "artifacts/control-plane-work-packet-receipts/latest/control-plane-work-packet-receipt-drafts.json",
  humanReviewCompletionRunbookPath: "artifacts/human-review-cycle-receipt-completion-runbook/latest/human-review-cycle-receipt-completion-runbook.json",
  packagePath: "package.json",
  finalCompletionLedgerPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardSourcePath: "src/review-dashboard.mjs",
  reviewApiSourcePath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
  controlPlaneLoopSourcePath: "src/control-plane-loop.mjs",
};

const SCHEMA_VERSION = "operator-handbook.v1";
const CAPABILITY_ID = "operator.handbook";
const PHASE_SLOT = "P310";
const PREVIOUS_PHASE_SLOT = "P309";
const NEXT_PHASE_SLOT = "P311";

const SOURCE_DEFINITIONS = [
  sourceDefinition("deployment_runbook", "Deployment Runbook", "deployment_runbook_status", "complete", "P309", "P310"),
  sourceDefinition("approval_queue_ui", "Approval Queue UI", "approval_queue_ui_status", "complete", "P289", null),
  sourceDefinition("matter_cockpit_ui", "Matter Cockpit UI", "matter_cockpit_ui_status", "complete", "P293", null),
  sourceDefinition("policy_violation_queue", "Policy Violation Queue", "policy_violation_queue_status", "complete", "P294", null),
  sourceDefinition("backup_restore_drill", "Backup/Restore Drill", "backup_restore_drill_status", "complete", "P304", null),
  sourceDefinition("run_ledger_viewer", "Run Ledger Viewer", "run_ledger_viewer_status", "complete", "P292", null),
  sourceDefinition("dashboard_api_freeze", "Dashboard/API Freeze", "dashboard_api_freeze_status", "complete", "P296", null),
  sourceDefinition("review_dashboard_ia", "Review Dashboard IA", "review_dashboard_ia_status", "complete", "P288", null),
  sourceDefinition("control_plane_loop", "Control Plane Loop", "overall_status", "passed", null, null),
  sourceDefinition("human_gate_receipt_drafts", "Human Gate Receipt Drafts", "receipt_status", "pending_receipts", null, null),
  sourceDefinition("work_packet_receipt_drafts", "Work Packet Receipt Drafts", "receipt_status", "pending_receipts", null, null),
  sourceDefinition("human_review_completion_runbook", "Human Review Completion Runbook", "runbook_status", "pending_human_input", null, null),
];

const REQUIRED_SCRIPTS = [
  "operator:handbook",
  "deployment:runbook",
  "approval:queue-ui",
  "matter:cockpit-ui",
  "policy:violation-queue",
  "compliance:backup-restore-drill",
  "ledgers:run-viewer",
  "dashboard:ia",
  "dashboard:api-freeze",
  "dashboard:build",
  "api:smoke",
  "control-plane:goal-checkpoint",
  "control-plane:loop",
  "control-plane:human-gate-receipts",
  "control-plane:work-receipts",
  "control-plane:review-cycle:completion-runbook",
];

export async function runOperatorHandbook(options = {}) {
  const result = await buildOperatorHandbook(options);
  if (options.write !== false) await writeOperatorHandbook(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Operator handbook validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildOperatorHandbook(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_OPERATOR_HANDBOOK_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    deployment_runbook: await readJsonSource(inputs.deployment_runbook_path),
    approval_queue_ui: await readJsonSource(inputs.approval_queue_ui_path),
    matter_cockpit_ui: await readJsonSource(inputs.matter_cockpit_ui_path),
    policy_violation_queue: await readJsonSource(inputs.policy_violation_queue_path),
    backup_restore_drill: await readJsonSource(inputs.backup_restore_drill_path),
    run_ledger_viewer: await readJsonSource(inputs.run_ledger_viewer_path),
    dashboard_api_freeze: await readJsonSource(inputs.dashboard_api_freeze_path),
    review_dashboard_ia: await readJsonSource(inputs.review_dashboard_ia_path),
    control_plane_loop: await readJsonSource(inputs.control_plane_loop_path),
    human_gate_receipt_drafts: await readJsonSource(inputs.human_gate_receipt_drafts_path),
    work_packet_receipt_drafts: await readJsonSource(inputs.work_packet_receipt_drafts_path),
    human_review_completion_runbook: await readJsonSource(inputs.human_review_completion_runbook_path),
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
  const operatorSurfaceRows = buildOperatorSurfaceRows(sources, generatedAt);
  const operatorWorkflowRows = buildOperatorWorkflowRows(sources, support, generatedAt);
  const operatorScreenRows = buildOperatorScreenRows(sources, generatedAt);
  const operatorRecoveryRows = buildOperatorRecoveryRows(sources, generatedAt);
  const gateResults = buildGateResults({ sourceStatuses, operatorSurfaceRows, operatorWorkflowRows, operatorScreenRows, operatorRecoveryRows, generatedAt });
  const boundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({ support, sourceStatuses, operatorSurfaceRows, operatorWorkflowRows, operatorScreenRows, operatorRecoveryRows, gateResults, boundary });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ sources, sourceStatuses, operatorSurfaceRows, operatorWorkflowRows, operatorScreenRows, operatorRecoveryRows, gateResults, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    operator_handbook_id: `operator-handbook.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    source_statuses: sourceStatuses,
    operator_handbook_contract: buildContract(generatedAt),
    operator_surface_rows: operatorSurfaceRows,
    operator_workflow_rows: operatorWorkflowRows,
    operator_screen_rows: operatorScreenRows,
    operator_recovery_rows: operatorRecoveryRows,
    operator_gate_results: gateResults,
    operator_handbook_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  result.summary.operator_handbook_id = result.operator_handbook_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeOperatorHandbook(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = JSON.parse(JSON.stringify(result));
  delete serializable.markdown;
  await writeJson(path.join(outDir, "operator-handbook.json"), serializable);
  await writeJson(path.join(outDir, "operator-handbook-sources.json"), collectionEnvelope("operator-handbook-sources.v1", "source_statuses", result.source_statuses, result.generated_at));
  await writeJson(path.join(outDir, "operator-surfaces.json"), collectionEnvelope("operator-surfaces.v1", "operator_surface_rows", result.operator_surface_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-workflows.json"), collectionEnvelope("operator-workflows.v1", "operator_workflow_rows", result.operator_workflow_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-screens.json"), collectionEnvelope("operator-screens.v1", "operator_screen_rows", result.operator_screen_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-recovery-procedures.json"), collectionEnvelope("operator-recovery-procedures.v1", "operator_recovery_rows", result.operator_recovery_rows, result.generated_at));
  await writeJson(path.join(outDir, "operator-gates.json"), collectionEnvelope("operator-gates.v1", "operator_gate_results", result.operator_gate_results, result.generated_at));
  await writeJson(path.join(outDir, "operator-handbook-boundary.json"), result.operator_handbook_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "operator-handbook-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runOperatorHandbookCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runOperatorHandbook(args);
    console.log(`Operator handbook ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.operator_handbook_status}`);
    console.log(`Surfaces: ${result.summary.ready_surface_count}/${result.summary.surface_count}`);
    console.log(`Workflows: ${result.summary.documented_workflow_count}/${result.summary.workflow_count}`);
    console.log(`Screens: ${result.summary.ready_screen_count}/${result.summary.screen_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "operator-handbook-contract.v1",
    contract_id: SCHEMA_VERSION,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    operator_scope: "approval_receipt_policy_recovery_desktop_navigation",
    source_of_truth: "operator_handbook_phase_artifacts",
    execution_model: "deterministic_read_only_operator_handbook",
    human_review_rule: "approval, receipt completion, policy exceptions, recovery, protected actions, legal outputs, and client-facing outputs require explicit human review",
    windows_baseline_rule: "P310 preserves the accepted Windows baseline before Phase 217+ work continues toward P312",
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
      schema_version: "operator-handbook-source-status.v1",
      source_status_id: `operator-handbook.source.${definition.source_id}`,
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

function buildOperatorSurfaceRows(sources, generatedAt) {
  const approval = summaryOf(sources.approval_queue_ui.data);
  const policy = summaryOf(sources.policy_violation_queue.data);
  const backup = summaryOf(sources.backup_restore_drill.data);
  const runLedger = summaryOf(sources.run_ledger_viewer.data);
  const matter = summaryOf(sources.matter_cockpit_ui.data);
  const receipt = summaryOf(sources.human_review_completion_runbook.data);
  const approvalItemCount = approval.approval_queue_ui_item_count ?? approval.approval_queue_item_count ?? 0;
  const runLedgerPanelCount = runLedger.run_ledger_viewer_panel_count ?? runLedger.panel_count ?? 0;
  const matterPanelCount = matter.matter_cockpit_ui_panel_count ?? matter.panel_count ?? 0;
  const matterClientFacingReadyCount = matter.client_facing_ready_count ?? matter.client_facing_ready_row_count ?? 0;
  return [
    surfaceRow("approval", "Approval Review", "approval_queue_ui", approvalItemCount > 0 && approval.receipt_preview_available_count === approval.receipt_preview_count, "Review pending approvals, protected previews, and receipt previews without applying decisions.", approvalItemCount, generatedAt),
    surfaceRow("receipt", "Receipt Completion", "human_review_completion_runbook", receipt.pending_human_input_count > 0 && receipt.validation_error_count === 0, "Guide manual receipt completion for human gates and work packets; receipt edits remain manual.", receipt.pending_human_input_count ?? 0, generatedAt),
    surfaceRow("policy_violation", "Policy Violation Triage", "policy_violation_queue", policy.queue_item_count > 0 && policy.open_actor_action_count === policy.human_review_required_action_count, "Triage policy violations and holds as human-review actions without mutating policy state.", policy.queue_item_count ?? 0, generatedAt),
    surfaceRow("recovery", "Recovery Readiness", "backup_restore_drill", backup.restore_drill_row_count >= 5 && backup.restore_execution_performed === false, "Use backup/restore dry-run and deployment rollback documentation as recovery reference only.", backup.restore_drill_row_count ?? 0, generatedAt),
    surfaceRow("desktop_navigation", "Desktop Navigation", "run_ledger_viewer", runLedgerPanelCount >= 6 && runLedger.read_only === true, "Navigate run ledger, route inventory, and dashboard freeze surfaces as read-only Desktop operator context.", runLedgerPanelCount, generatedAt),
    surfaceRow("matter_context", "Matter Context", "matter_cockpit_ui", matterPanelCount >= 6 && matterClientFacingReadyCount === 0, "Use matter cockpit context for profile, task, document, evidence, and approval review without legal advice.", matterPanelCount, generatedAt),
  ];
}

function buildOperatorWorkflowRows(sources, support, generatedAt) {
  const scripts = support.package_json.data?.scripts ?? {};
  const approval = summaryOf(sources.approval_queue_ui.data);
  const humanGateDrafts = summaryOf(sources.human_gate_receipt_drafts.data);
  const workPacketDrafts = summaryOf(sources.work_packet_receipt_drafts.data);
  const policy = summaryOf(sources.policy_violation_queue.data);
  const backup = summaryOf(sources.backup_restore_drill.data);
  const dashboard = summaryOf(sources.dashboard_api_freeze.data);
  return [
    workflowRow("approval_review", "Open approval queue, inspect protected request preview, record decision only through approved human receipt/application flow.", ["approval:queue-ui"], (approval.approval_queue_ui_item_count ?? approval.approval_queue_item_count ?? 0) > 0, generatedAt),
    workflowRow("human_gate_receipts", "Use human gate receipt drafts to collect decisions, reviewer, reference, notes, and completed action refs before validation.", ["control-plane:human-gate-receipts", "control-plane:human-gate-receipts:validate"], humanGateDrafts.receipt_draft_count > 0, generatedAt),
    workflowRow("work_packet_receipts", "Use work packet receipt drafts to resolve or defer packets; protected packets require explicit authorized operator evidence.", ["control-plane:work-receipts", "control-plane:work-receipts:validate"], workPacketDrafts.receipt_draft_count > 0, generatedAt),
    workflowRow("policy_violation_triage", "Review policy violation and hold queues, assign actor actions, and keep policy mutation out of the handbook.", ["policy:violation-queue"], policy.human_review_required_action_count > 0, generatedAt),
    workflowRow("recovery_handoff", "Follow backup/restore dry-run evidence and deployment rollback procedures as human-gated recovery handoff, not execution.", ["compliance:backup-restore-drill", "deployment:runbook"], backup.restore_execution_performed === false, generatedAt),
    workflowRow("route_run_lookup", "Use dashboard IA/API freeze/run ledger viewer to locate route, run, artifact, and validation context without starting servers.", ["dashboard:ia", "dashboard:api-freeze", "ledgers:run-viewer"], dashboard.api_route_count > 0, generatedAt),
    workflowRow("operator_handbook_refresh", "Regenerate the operator handbook after upstream dashboard, receipt, policy, recovery, or loop artifacts change.", ["operator:handbook", "dashboard:build", "api:smoke"], scripts["operator:handbook"] && scripts["dashboard:build"] && scripts["api:smoke"], generatedAt),
  ].map((row) => ({
    ...row,
    required_package_scripts_present: row.required_package_scripts.every((script) => Boolean(scripts[script])),
    workflow_status: row.workflow_status === "documented" && row.required_package_scripts.every((script) => Boolean(scripts[script])) ? "documented" : "attention",
  }));
}

function buildOperatorScreenRows(sources, generatedAt) {
  return [
    screenRow("approval_queue_ui", "Approval Queue UI", "approval_queue_ui", "Open pending approvals, receipt previews, and protected request previews; do not apply approval decisions from the handbook.", sources.approval_queue_ui.available, generatedAt),
    screenRow("matter_cockpit_ui", "Matter Cockpit UI", "matter_cockpit_ui", "Use matter profile, timeline, tasks, documents, evidence, and approvals as read-only review context.", sources.matter_cockpit_ui.available, generatedAt),
    screenRow("policy_violation_queue", "Policy Violation Queue", "policy_violation_queue", "Review violations, holds, and actor actions; policy exceptions require separate human approval.", sources.policy_violation_queue.available, generatedAt),
    screenRow("run_ledger_viewer", "Run Ledger Viewer", "run_ledger_viewer", "Inspect run progress, history, agent/tool activity, and log/artifact references without reading hidden content.", sources.run_ledger_viewer.available, generatedAt),
    screenRow("dashboard_api_freeze", "Dashboard/API Freeze", "dashboard_api_freeze", "Use frozen route/probe/fixture coverage to confirm API surface stability.", sources.dashboard_api_freeze.available, generatedAt),
    screenRow("review_dashboard_ia", "Review Dashboard IA", "review_dashboard_ia", "Use dashboard IA sections and route bindings to navigate Desktop operator surfaces.", sources.review_dashboard_ia.available, generatedAt),
    screenRow("deployment_runbook", "Deployment Runbook", "deployment_runbook", "Use local/dev/prod-like/Desktop/rollback command and checklist documentation after human approval.", sources.deployment_runbook.available, generatedAt),
    screenRow("human_review_completion_runbook", "Human Review Completion Runbook", "human_review_completion_runbook", "Follow manual receipt completion steps; protected manual steps remain blocked until authorized.", sources.human_review_completion_runbook.available, generatedAt),
  ];
}

function buildOperatorRecoveryRows(sources, generatedAt) {
  const backup = summaryOf(sources.backup_restore_drill.data);
  const deployment = summaryOf(sources.deployment_runbook.data);
  const loop = summaryOf(sources.control_plane_loop.data);
  return [
    recoveryRow("backup_restore_dry_run", "Confirm backup/restore dry-run rows and source-of-truth gates before any recovery request.", backup.restore_drill_row_count >= 5 && backup.restore_execution_performed === false, generatedAt),
    recoveryRow("rollback_handoff", "Use deployment runbook rollback procedures as documentation; rollback execution requires explicit approval.", deployment.rollback_procedure_step_count >= 4 && deployment.rollback_execution_performed === false, generatedAt),
    recoveryRow("post_recovery_reverification", "After an approved external recovery action, rerun validate, test, dashboard/API, contracts, and control-plane checkpoint.", deployment.command_count >= 10 && deployment.command_execution_performed === false, generatedAt),
    recoveryRow("windows_baseline_recheck", "Preserve Windows baseline stability and Mac/Windows completion guard before marking Phase 217+ work complete.", deployment.windows_baseline_stability_preserved === true && deployment.mac_windows_completion_instability_guard === true && loop.overall_status === "passed", generatedAt),
  ];
}

function buildGateResults({ sourceStatuses, operatorSurfaceRows, operatorWorkflowRows, operatorScreenRows, operatorRecoveryRows, generatedAt }) {
  const gates = [
    gate("sources", "Operator handbook sources are available and status-clean.", sourceStatuses.every((row) => row.source_status === "passed")),
    gate("surfaces", "Operator surfaces are ready and human-review oriented.", operatorSurfaceRows.every((row) => row.surface_status === "ready")),
    gate("workflows", "Operator workflows are documented and backed by package scripts.", operatorWorkflowRows.every((row) => row.workflow_status === "documented")),
    gate("screens", "Operator screens are ready and read-only.", operatorScreenRows.every((row) => row.screen_status === "ready" && row.read_only)),
    gate("recovery", "Recovery procedures are documented, dry-run, and approval-gated.", operatorRecoveryRows.every((row) => row.recovery_status === "documented" && row.requires_human_approval && !row.recovery_execution_performed)),
    gate("no_execution", "Handbook does not execute approvals, receipts, policy changes, recovery, commands, routes, delivery, legal advice, or client output.", true),
    gate("human_review", "Human review and attorney review gates are preserved for legal or client-facing outcomes.", true),
    gate("windows_stability", "Windows baseline stability and Mac/Windows completion guard are preserved.", true),
  ];
  return gates.map((item, index) => {
    const row = {
      schema_version: "operator-gate-result.v1",
      operator_gate_result_id: `operator-handbook.gate.${item.gate_id}`,
      ordinal: index + 1,
      gate_id: item.gate_id,
      gate_label: item.label,
      gate_status: item.passed ? "passed" : "failed",
      operator_gate_passed: item.passed,
      gate_violation: !item.passed,
      human_review_required: true,
      generated_at: generatedAt,
    };
    return { ...row, gate_result_hash: sha256(row) };
  });
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "operator-handbook-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    read_only: true,
    handbook_only: true,
    report_only: true,
    desktop_operator_surface: true,
    desktop_read_only: true,
    desktop_source_of_truth: false,
    source_artifact_read_performed: true,
    source_content_read_performed: false,
    source_ingest_performed: false,
    source_artifact_mutation_performed: false,
    approval_application_performed: false,
    receipt_application_performed: false,
    policy_mutation_performed: false,
    recovery_execution_performed: false,
    rollback_execution_performed: false,
    restore_execution_performed: false,
    command_execution_performed: false,
    route_execution_performed: false,
    server_started: false,
    protected_action_executed: false,
    delivery_execution_performed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    client_facing_ready: false,
    human_review_required: true,
    attorney_review_required: true,
    approval_required_for_protected_actions: true,
    approval_required_for_recovery: true,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
  };
}

function buildValidationItems({ support, sourceStatuses, operatorSurfaceRows, operatorWorkflowRows, operatorScreenRows, operatorRecoveryRows, gateResults, boundary }) {
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
    validationItem("sources.clean", sourceStatuses.every((row) => row.source_status === "passed"), "All operator handbook sources are available and validation-clean."),
    validationItem("scripts.required", REQUIRED_SCRIPTS.every((script) => scripts[script]), "All operator handbook package scripts are present."),
    validationItem("surfaces.ready", operatorSurfaceRows.length >= 6 && operatorSurfaceRows.every((row) => row.surface_status === "ready"), "Approval, receipt, policy, recovery, Desktop navigation, and matter context surfaces are ready."),
    validationItem("workflows.documented", operatorWorkflowRows.length >= 7 && operatorWorkflowRows.every((row) => row.workflow_status === "documented"), "Operator workflows are documented and script-backed."),
    validationItem("screens.ready", operatorScreenRows.length >= 8 && operatorScreenRows.every((row) => row.screen_status === "ready" && row.read_only), "Operator screens are available and read-only."),
    validationItem("recovery.documented", operatorRecoveryRows.length >= 4 && operatorRecoveryRows.every((row) => row.recovery_status === "documented" && row.requires_human_approval && !row.recovery_execution_performed), "Recovery procedures are documented, dry-run, and approval-gated."),
    validationItem("gates.passed", gateResults.every((row) => row.operator_gate_passed && !row.gate_violation), "Operator handbook gates pass."),
    validationItem("boundary.no_execution", !boundary.approval_application_performed && !boundary.receipt_application_performed && !boundary.policy_mutation_performed && !boundary.recovery_execution_performed && !boundary.rollback_execution_performed && !boundary.restore_execution_performed && !boundary.command_execution_performed && !boundary.route_execution_performed && !boundary.server_started, "Handbook does not execute approvals, receipts, policy, recovery, commands, routes, or servers."),
    validationItem("boundary.no_delivery_or_legal_output", !boundary.protected_action_executed && !boundary.delivery_execution_performed && !boundary.legal_advice_generated && !boundary.client_facing_output_generated && !boundary.client_facing_ready, "Handbook does not execute protected actions, delivery, legal advice, or client-facing output."),
    validationItem("boundary.desktop_read_only", boundary.desktop_operator_surface && boundary.desktop_read_only && !boundary.desktop_source_of_truth && !boundary.source_content_read_performed && !boundary.source_ingest_performed, "Desktop operator surface remains read-only and not source of truth."),
    validationItem("boundary.windows_stability", boundary.windows_baseline_stability_preserved && boundary.mac_windows_completion_instability_guard, "Windows baseline stability guard is preserved."),
    validationItem("ledger.p310", text.final_completion_ledger.includes("| P310 |") && text.final_completion_ledger.includes("operator_handbook"), "Final completion ledger promotes P310 operator_handbook."),
    validationItem("roadmap.p310", text.implementation_roadmap.includes("## Phase 310") && text.implementation_roadmap.includes("operator_handbook"), "Implementation roadmap documents Phase 310."),
    validationItem("dashboard.integration", text.review_dashboard_source.includes("operator_handbook") && text.review_dashboard_source.includes("buildOperatorHandbookStage"), "Review Dashboard includes operator handbook source and stage."),
    validationItem("api.integration", text.review_api_source.includes("/api/operator-handbooks") && text.review_api_doc.includes("P310 Operator Handbook Routes"), "Review API exposes operator handbook routes."),
    validationItem("loop.integration", text.control_plane_loop_source.includes("operator_handbook") && text.control_plane_loop_source.includes("operator:handbook"), "Control Plane Loop runs operator handbook."),
  ];
}

function buildSummary({ sources, sourceStatuses, operatorSurfaceRows, operatorWorkflowRows, operatorScreenRows, operatorRecoveryRows, gateResults, boundary, validation }) {
  const deployment = summaryOf(sources.deployment_runbook.data);
  const approval = summaryOf(sources.approval_queue_ui.data);
  const matter = summaryOf(sources.matter_cockpit_ui.data);
  const policy = summaryOf(sources.policy_violation_queue.data);
  const backup = summaryOf(sources.backup_restore_drill.data);
  const runLedger = summaryOf(sources.run_ledger_viewer.data);
  const dashboard = summaryOf(sources.dashboard_api_freeze.data);
  const ia = summaryOf(sources.review_dashboard_ia.data);
  const loop = summaryOf(sources.control_plane_loop.data);
  const humanGateDrafts = summaryOf(sources.human_gate_receipt_drafts.data);
  const workPacketDrafts = summaryOf(sources.work_packet_receipt_drafts.data);
  const completionRunbook = summaryOf(sources.human_review_completion_runbook.data);
  const failedSourceStatusCount = sourceStatuses.filter((row) => row.source_status !== "passed").length;
  const failedGateCount = gateResults.filter((row) => row.gate_status !== "passed" || row.gate_violation).length;
  const readySurfaceCount = operatorSurfaceRows.filter((row) => row.surface_status === "ready").length;
  const documentedWorkflowCount = operatorWorkflowRows.filter((row) => row.workflow_status === "documented").length;
  const readyScreenCount = operatorScreenRows.filter((row) => row.screen_status === "ready").length;
  const documentedRecoveryCount = operatorRecoveryRows.filter((row) => row.recovery_status === "documented").length;
  return {
    ...boundary,
    schema_version: "operator-handbook-summary.v1",
    operator_handbook_status: failedSourceStatusCount === 0 && readySurfaceCount === operatorSurfaceRows.length && documentedWorkflowCount === operatorWorkflowRows.length && readyScreenCount === operatorScreenRows.length && documentedRecoveryCount === operatorRecoveryRows.length && failedGateCount === 0 && validation.errors.length === 0 ? "complete" : "attention",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_deployment_runbook_status: deployment.deployment_runbook_status ?? "unknown",
    source_deployment_runbook_phase_slot: deployment.phase_slot ?? null,
    source_deployment_runbook_next_phase_slot: deployment.next_phase_slot ?? null,
    source_approval_queue_ui_status: approval.approval_queue_ui_status ?? "unknown",
    source_matter_cockpit_ui_status: matter.matter_cockpit_ui_status ?? "unknown",
    source_policy_violation_queue_status: policy.policy_violation_queue_status ?? "unknown",
    source_backup_restore_drill_status: backup.backup_restore_drill_status ?? "unknown",
    source_run_ledger_viewer_status: runLedger.run_ledger_viewer_status ?? "unknown",
    source_dashboard_api_freeze_status: dashboard.dashboard_api_freeze_status ?? "unknown",
    source_review_dashboard_ia_status: ia.review_dashboard_ia_status ?? "unknown",
    source_control_plane_loop_status: loop.overall_status ?? "unknown",
    source_human_gate_receipt_status: humanGateDrafts.receipt_status ?? "unknown",
    source_work_packet_receipt_status: workPacketDrafts.receipt_status ?? "unknown",
    source_human_review_completion_runbook_status: completionRunbook.runbook_status ?? "unknown",
    source_status_count: sourceStatuses.length,
    passed_source_status_count: sourceStatuses.length - failedSourceStatusCount,
    failed_source_status_count: failedSourceStatusCount,
    surface_count: operatorSurfaceRows.length,
    ready_surface_count: readySurfaceCount,
    workflow_count: operatorWorkflowRows.length,
    documented_workflow_count: documentedWorkflowCount,
    screen_count: operatorScreenRows.length,
    ready_screen_count: readyScreenCount,
    recovery_step_count: operatorRecoveryRows.length,
    documented_recovery_step_count: documentedRecoveryCount,
    gate_result_count: gateResults.length,
    passed_gate_result_count: gateResults.length - failedGateCount,
    failed_gate_result_count: failedGateCount,
    gate_violation_count: gateResults.filter((row) => row.gate_violation).length,
    approval_queue_item_count: approval.approval_queue_ui_item_count ?? approval.approval_queue_item_count ?? 0,
    approval_receipt_preview_count: approval.receipt_preview_count ?? 0,
    approval_receipt_preview_available_count: approval.receipt_preview_available_count ?? 0,
    protected_request_preview_count: approval.protected_request_preview_count ?? 0,
    matter_cockpit_panel_count: matter.matter_cockpit_ui_panel_count ?? matter.panel_count ?? 0,
    matter_cockpit_client_facing_ready_count: matter.client_facing_ready_count ?? matter.client_facing_ready_row_count ?? 0,
    policy_queue_item_count: policy.queue_item_count ?? 0,
    policy_violation_item_count: policy.policy_violation_item_count ?? 0,
    policy_hold_item_count: policy.policy_hold_item_count ?? 0,
    policy_human_review_required_action_count: policy.human_review_required_action_count ?? 0,
    restore_drill_row_count: backup.restore_drill_row_count ?? 0,
    restore_execution_performed_count: backup.restore_execution_performed_count ?? (backup.restore_execution_performed ? 1 : 0),
    run_ledger_viewer_panel_count: runLedger.run_ledger_viewer_panel_count ?? runLedger.panel_count ?? 0,
    dashboard_api_route_count: dashboard.api_route_count ?? 0,
    review_dashboard_ia_route_binding_count: ia.dashboard_ia_route_binding_count ?? 0,
    control_plane_loop_passed_step_count: loop.passed_step_count ?? 0,
    control_plane_loop_failed_step_count: loop.failed_step_count ?? 0,
    human_gate_receipt_draft_count: humanGateDrafts.receipt_draft_count ?? 0,
    work_packet_receipt_draft_count: workPacketDrafts.receipt_draft_count ?? 0,
    receipt_completion_pending_human_input_count: completionRunbook.pending_human_input_count ?? 0,
    validation_item_count: validation.item_count,
    failed_checkpoint_count: validation.errors.length,
    validation_error_count: validation.errors.length,
  };
}

function surfaceRow(surfaceId, label, sourceId, ready, guidance, evidenceCount, generatedAt) {
  const row = {
    schema_version: "operator-surface-row.v1",
    operator_surface_id: `operator-handbook.surface.${surfaceId}`,
    surface_id: surfaceId,
    label,
    source_id: sourceId,
    surface_status: ready ? "ready" : "attention",
    evidence_count: evidenceCount,
    guidance,
    read_only: true,
    human_review_required: true,
    generated_at: generatedAt,
  };
  return { ...row, surface_hash: sha256(row) };
}

function workflowRow(workflowId, procedure, requiredPackageScripts, documented, generatedAt) {
  const row = {
    schema_version: "operator-workflow-row.v1",
    operator_workflow_id: `operator-handbook.workflow.${workflowId}`,
    workflow_id: workflowId,
    procedure,
    required_package_scripts: requiredPackageScripts,
    workflow_status: documented ? "documented" : "attention",
    read_only: true,
    human_review_required: true,
    protected_action_executed: false,
    generated_at: generatedAt,
  };
  return { ...row, workflow_hash: sha256(row) };
}

function screenRow(screenId, label, sourceId, operatorInstruction, ready, generatedAt) {
  const row = {
    schema_version: "operator-screen-row.v1",
    operator_screen_id: `operator-handbook.screen.${screenId}`,
    screen_id: screenId,
    label,
    source_id: sourceId,
    screen_status: ready ? "ready" : "attention",
    operator_instruction: operatorInstruction,
    read_only: true,
    route_execution_performed: false,
    server_started: false,
    generated_at: generatedAt,
  };
  return { ...row, screen_hash: sha256(row) };
}

function recoveryRow(stepKey, procedure, documented, generatedAt) {
  const row = {
    schema_version: "operator-recovery-row.v1",
    operator_recovery_id: `operator-handbook.recovery.${stepKey}`,
    step_key: stepKey,
    procedure,
    recovery_status: documented ? "documented" : "attention",
    requires_human_approval: true,
    recovery_execution_performed: false,
    rollback_execution_performed: false,
    restore_execution_performed: false,
    protected_action_executed: false,
    generated_at: generatedAt,
  };
  return { ...row, recovery_hash: sha256(row) };
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
    "# Operator Handbook",
    "",
    `- Status: ${summary.operator_handbook_status}`,
    `- Phase: ${summary.phase_slot} (previous ${summary.previous_phase_slot}, next ${summary.next_phase_slot})`,
    `- Surfaces: ${summary.ready_surface_count}/${summary.surface_count}`,
    `- Workflows: ${summary.documented_workflow_count}/${summary.workflow_count}`,
    `- Screens: ${summary.ready_screen_count}/${summary.screen_count}`,
    `- Recovery procedures: ${summary.documented_recovery_step_count}/${summary.recovery_step_count}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "This handbook is read-only. Approval application, receipt application, policy mutation, recovery, rollback, restore, command execution, route execution, server start, protected actions, delivery, legal advice, and client-facing output remain blocked until explicit human approval.",
  ].join("\n");
}

function sourceDefinition(sourceId, label, statusKey, expectedStatus, expectedPhaseSlot, expectedNextPhaseSlot) {
  return { source_id: sourceId, label, status_key: statusKey, expected_status: expectedStatus, expected_phase_slot: expectedPhaseSlot, expected_next_phase_slot: expectedNextPhaseSlot };
}

function normalizeInputs(options) {
  const normalized = {};
  for (const [key, defaultValue] of Object.entries(DEFAULT_OPERATOR_HANDBOOK_INPUTS)) {
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
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg.startsWith("--")) parsed[kebabToCamel(arg.slice(2))] = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log("Usage: node scripts/operator-handbook.mjs [--check] [--out-dir path]");
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
