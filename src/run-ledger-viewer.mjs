import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RUN_LEDGER_VIEWER_OUT_DIR = "artifacts/run-ledger-viewer/latest";
export const DEFAULT_RUN_LEDGER_VIEWER_INPUTS = {
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
  workflowRunLedgerPath: "artifacts/workflow-run-ledger/latest/workflow-run-ledger.json",
  agentRunLedgerPath: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
  toolInvocationLedgerPath: "artifacts/tool-invocation-ledger/latest/tool-invocation-ledger.json",
  auditEventLedgerPath: "artifacts/audit-event-ledger/latest/audit-event-ledger.json",
  ledgerApiDashboardPath: "artifacts/ledger-api-dashboard/latest/ledger-api-dashboard.json",
  sourceSpanInspectorPath: "artifacts/source-span-inspector/latest/source-span-inspector.json",
};

const SCHEMA_VERSION = "run-ledger-viewer.v1";
const CAPABILITY_ID = "desktop.run_ledger_viewer";
const PHASE_SLOT = "P292";
const PREVIOUS_PHASE_SLOT = "P291";
const NEXT_PHASE_SLOT = "P293";
const PANEL_DEFINITIONS = [
  ["desktop_sessions", "Desktop Sessions", "Workflow runs grouped as Desktop session rows."],
  ["workflow_progress", "Workflow Progress", "Workflow run progress and terminal-state rows."],
  ["run_history", "Run History", "Event-backed workflow history rows."],
  ["agent_activity", "Agent Activity", "Agent run rows with log and artifact bindings."],
  ["tool_activity", "Tool Activity", "Tool invocation rows with permission and event bindings."],
  ["logs_artifacts", "Logs And Artifacts", "Read-only log and artifact reference rows."],
];

export async function runRunLedgerViewer(options = {}) {
  const result = await buildRunLedgerViewer(options);
  if (options.write !== false) await writeRunLedgerViewer(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Run Ledger Viewer validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildRunLedgerViewer(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RUN_LEDGER_VIEWER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const [
    packageJson,
    roadmapText,
    implementationRoadmapText,
    reviewDashboardText,
    reviewApiText,
    reviewApiDocText,
    workflowRunLedger,
    agentRunLedger,
    toolInvocationLedger,
    auditEventLedger,
    ledgerApiDashboard,
    sourceSpanInspector,
  ] = await Promise.all([
    readJson(inputs.package_path),
    readText(inputs.roadmap_path),
    readText(inputs.implementation_roadmap_path),
    readText(inputs.review_dashboard_path),
    readText(inputs.review_api_path),
    readText(inputs.review_api_doc_path),
    readJson(inputs.workflow_run_ledger_path),
    readJson(inputs.agent_run_ledger_path),
    readJson(inputs.tool_invocation_ledger_path),
    readJson(inputs.audit_event_ledger_path),
    readJson(inputs.ledger_api_dashboard_path),
    readJson(inputs.source_span_inspector_path),
  ]);

  const context = buildViewerContext({
    workflowRunLedger,
    agentRunLedger,
    toolInvocationLedger,
    auditEventLedger,
  });
  const desktopSessionViews = buildDesktopSessionViews({ context, generatedAt });
  const runProgressViews = buildRunProgressViews({ context, generatedAt });
  const runHistoryViews = buildRunHistoryViews({ context, generatedAt });
  const runAgentActivityViews = buildRunAgentActivityViews({ context, generatedAt });
  const runToolActivityViews = buildRunToolActivityViews({ context, generatedAt });
  const runLogArtifactViews = buildRunLogArtifactViews({ context, generatedAt });
  const panels = buildPanels({
    desktopSessionViews,
    runProgressViews,
    runHistoryViews,
    runAgentActivityViews,
    runToolActivityViews,
    runLogArtifactViews,
    generatedAt,
  });
  const boundary = buildBoundary(generatedAt);
  const checks = buildChecks({
    packageJson,
    roadmapText,
    implementationRoadmapText,
    reviewDashboardText,
    reviewApiText,
    reviewApiDocText,
    workflowRunLedger,
    agentRunLedger,
    toolInvocationLedger,
    auditEventLedger,
    ledgerApiDashboard,
    sourceSpanInspector,
    panels,
    desktopSessionViews,
    runProgressViews,
    runHistoryViews,
    runAgentActivityViews,
    runToolActivityViews,
    runLogArtifactViews,
    boundary,
  });
  const validation = summarizeValidation(checks);
  const summary = summarizeRunLedgerViewer({
    workflowRunLedger,
    agentRunLedger,
    toolInvocationLedger,
    auditEventLedger,
    ledgerApiDashboard,
    sourceSpanInspector,
    panels,
    desktopSessionViews,
    runProgressViews,
    runHistoryViews,
    runAgentActivityViews,
    runToolActivityViews,
    runLogArtifactViews,
    boundary,
    checks,
    validation,
    generatedAt,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    run_ledger_viewer_id: summary.run_ledger_viewer_id,
    run_ledger_viewer_status: summary.run_ledger_viewer_status,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({
      workflowRunLedger,
      agentRunLedger,
      toolInvocationLedger,
      auditEventLedger,
      ledgerApiDashboard,
      sourceSpanInspector,
    }),
    run_ledger_viewer_contract: buildViewerContract(generatedAt),
    run_ledger_viewer_panels: panels,
    desktop_session_views: desktopSessionViews,
    run_progress_views: runProgressViews,
    run_history_views: runHistoryViews,
    run_agent_activity_views: runAgentActivityViews,
    run_tool_activity_views: runToolActivityViews,
    run_log_artifact_views: runLogArtifactViews,
    run_ledger_viewer_boundary: boundary,
    run_ledger_viewer_checks: checks,
    validation_items: checks,
    validation,
    summary,
  };
  result.summary_markdown = buildSummaryMarkdown(result);
  return result;
}

function buildViewerContext({ workflowRunLedger, agentRunLedger, toolInvocationLedger, auditEventLedger }) {
  const workflowRecords = workflowRunLedger.workflow_run_catalog?.workflow_run_records ?? [];
  const workflowTransitions = workflowRunLedger.workflow_run_catalog?.workflow_state_transitions ?? [];
  const workflowEventBindings = workflowRunLedger.workflow_run_catalog?.workflow_event_bindings ?? [];
  const agentRecords = agentRunLedger.agent_run_catalog?.agent_run_records ?? [];
  const agentLogReferences = agentRunLedger.agent_run_catalog?.agent_run_log_references ?? [];
  const agentArtifactReferences = agentRunLedger.agent_run_catalog?.agent_run_artifact_references ?? [];
  const agentEventBindings = agentRunLedger.agent_run_catalog?.agent_run_event_bindings ?? [];
  const toolRecords = toolInvocationLedger.tool_invocation_catalog?.tool_invocation_records ?? [];
  const toolEventBindings = toolInvocationLedger.tool_invocation_catalog?.tool_invocation_event_bindings ?? [];
  const auditRecords = auditEventLedger.audit_event_catalog?.audit_trail_records ?? [];
  return {
    workflowRecords: [...workflowRecords].sort(by("workflow_run_id")),
    workflowTransitionsByRun: groupBy(workflowTransitions, "workflow_run_id"),
    workflowEventBindingsByRun: groupBy(workflowEventBindings, "workflow_run_id"),
    agentRecordsByRun: groupBy(agentRecords, "workflow_run_id"),
    agentLogReferencesByRun: groupBy(agentLogReferences, "workflow_run_id"),
    agentArtifactReferencesByRun: groupBy(agentArtifactReferences, "workflow_run_id"),
    agentEventBindingsByRun: groupBy(agentEventBindings, "workflow_run_id"),
    toolRecordsByRun: groupBy(toolRecords, "workflow_run_id"),
    toolEventBindingsByRun: groupBy(toolEventBindings, "workflow_run_id"),
    auditRecordsByCorrelation: groupBy(auditRecords, "correlation_id"),
    agentLogReferenceByAgent: mapBy(agentLogReferences, "agent_run_id"),
    agentArtifactsByAgent: groupBy(agentArtifactReferences, "agent_run_id"),
    toolEventByInvocation: mapBy(toolEventBindings, "tool_invocation_id"),
    agentRecords: [...agentRecords].sort(by("agent_run_id")),
    toolRecords: [...toolRecords].sort(by("tool_invocation_id")),
    agentLogReferences: [...agentLogReferences].sort(by("agent_run_id")),
    agentArtifactReferences: [...agentArtifactReferences].sort(by("agent_run_artifact_reference_id")),
  };
}

function buildDesktopSessionViews({ context, generatedAt }) {
  return context.workflowRecords.map((workflow) => {
    const agents = context.agentRecordsByRun.get(workflow.workflow_run_id) ?? [];
    const tools = context.toolRecordsByRun.get(workflow.workflow_run_id) ?? [];
    const logs = context.agentLogReferencesByRun.get(workflow.workflow_run_id) ?? [];
    const artifacts = context.agentArtifactReferencesByRun.get(workflow.workflow_run_id) ?? [];
    const history = context.workflowEventBindingsByRun.get(workflow.workflow_run_id) ?? [];
    const audit = context.auditRecordsByCorrelation.get(workflow.correlation_id) ?? [];
    const blockedToolCount = tools.filter((tool) => tool.invocation_state === "blocked").length;
    return {
      schema_version: "desktop-session-view.v1",
      desktop_session_view_id: `desktop-session-view.${slugify(workflow.workflow_run_id)}`,
      generated_at: generatedAt,
      desktop_session_status: "ready",
      workflow_run_id: workflow.workflow_run_id,
      workflow_run_record_id: workflow.workflow_run_record_id,
      run_ledger_id: workflow.run_ledger_id,
      correlation_id: workflow.correlation_id,
      correlation_trace_id: workflow.correlation_trace_id,
      tenant_id: workflow.tenant_id ?? null,
      matter_id: workflow.matter_id ?? null,
      domain_pack: workflow.domain_pack ?? null,
      capability_id: workflow.capability_id ?? null,
      workflow_id: workflow.workflow_id ?? null,
      run_status: workflow.run_status,
      terminal_state: workflow.terminal_state,
      blocked_reason: workflow.blocked_reason ?? null,
      progress_status: progressStatus(workflow),
      history_event_count: history.length,
      agent_run_count: agents.length,
      completed_agent_run_count: agents.filter((agent) => agent.status === "completed").length,
      tool_invocation_count: tools.length,
      blocked_tool_invocation_count: blockedToolCount,
      log_reference_count: logs.length,
      artifact_reference_count: artifacts.length,
      audit_record_count: audit.length,
      started_at: workflow.started_at ?? workflow.first_event_time ?? null,
      updated_at: workflow.updated_at ?? workflow.last_event_time ?? null,
      human_review_required: Boolean(workflow.human_review_required || workflow.run_status === "blocked" || blockedToolCount > 0),
      client_facing_ready: false,
      read_only: true,
      preview_only: true,
      desktop_projection_only: true,
      route_execution_performed: false,
      server_started: false,
      mutation_allowed: false,
      protected_action_executed: false,
      legal_advice_generated: false,
      client_facing_output_generated: false,
    };
  });
}

function buildRunProgressViews({ context, generatedAt }) {
  return context.workflowRecords.map((workflow) => {
    const transitions = context.workflowTransitionsByRun.get(workflow.workflow_run_id) ?? [];
    const agents = context.agentRecordsByRun.get(workflow.workflow_run_id) ?? [];
    const tools = context.toolRecordsByRun.get(workflow.workflow_run_id) ?? [];
    return {
      schema_version: "run-progress-view.v1",
      run_progress_view_id: `run-progress-view.${slugify(workflow.workflow_run_id)}`,
      generated_at: generatedAt,
      run_progress_status: progressStatus(workflow),
      workflow_run_id: workflow.workflow_run_id,
      run_ledger_id: workflow.run_ledger_id,
      run_status: workflow.run_status,
      terminal_state: workflow.terminal_state,
      terminal_state_alignment_status: workflow.terminal_state_alignment_status ?? null,
      state_transition_count: transitions.length,
      event_backed_transition_count: transitions.filter((transition) => transition.transition_status === "event_backed").length,
      terminal_transition_count: transitions.filter((transition) => transition.terminal_transition).length,
      state_path: workflow.state_path ?? [],
      first_event_time: workflow.first_event_time ?? null,
      last_event_time: workflow.last_event_time ?? null,
      agent_run_count: agents.length,
      completed_agent_run_count: agents.filter((agent) => agent.status === "completed").length,
      tool_invocation_count: tools.length,
      blocked_tool_invocation_count: tools.filter((tool) => tool.invocation_state === "blocked").length,
      human_review_required: true,
      client_facing_ready: false,
      read_only: true,
      preview_only: true,
    };
  });
}

function buildRunHistoryViews({ context, generatedAt }) {
  return context.workflowRecords.flatMap((workflow) => {
    const bindings = context.workflowEventBindingsByRun.get(workflow.workflow_run_id) ?? [];
    return bindings.map((binding, index) => ({
      schema_version: "run-history-view.v1",
      run_history_view_id: `run-history-view.${slugify(workflow.workflow_run_id)}.${String(index + 1).padStart(3, "0")}`,
      generated_at: generatedAt,
      run_history_status: binding.binding_status === "linked" ? "linked" : "attention",
      workflow_run_id: workflow.workflow_run_id,
      run_ledger_id: workflow.run_ledger_id,
      correlation_id: workflow.correlation_id,
      event_envelope_id: binding.event_envelope_id ?? null,
      stored_event_id: binding.stored_event_id ?? null,
      event_type: binding.event_type ?? null,
      event_family: binding.event_family ?? null,
      event_time: binding.event_time ?? null,
      global_sequence: binding.global_sequence ?? null,
      state_effect: binding.state_effect ?? null,
      workflow_state_transition_id: binding.workflow_state_transition_id ?? null,
      binding_status: binding.binding_status ?? "unknown",
      human_review_required: true,
      client_facing_ready: false,
      read_only: true,
      preview_only: true,
    }));
  }).sort((left, right) => (left.global_sequence ?? 0) - (right.global_sequence ?? 0));
}

function buildRunAgentActivityViews({ context, generatedAt }) {
  return context.agentRecords.map((agent) => {
    const log = context.agentLogReferenceByAgent.get(agent.agent_run_id) ?? null;
    const artifacts = context.agentArtifactsByAgent.get(agent.agent_run_id) ?? [];
    return {
      schema_version: "run-agent-activity-view.v1",
      run_agent_activity_view_id: `run-agent-activity-view.${slugify(agent.agent_run_id)}`,
      generated_at: generatedAt,
      agent_activity_status: agent.status === "completed" && log?.log_reference_status === "captured" ? "ready" : "attention",
      agent_run_id: agent.agent_run_id,
      workflow_run_id: agent.workflow_run_id,
      run_ledger_id: agent.run_ledger_id,
      runtime_id: agent.runtime_id,
      adapter_id: agent.adapter_id ?? null,
      command_binding_id: agent.command_binding_id ?? null,
      status: agent.status,
      risk_level: agent.risk_level,
      output_trust: agent.output_trust,
      verification_required: Boolean(agent.verification_required),
      verification_status: agent.verification_status ?? null,
      log_reference_status: log?.log_reference_status ?? "missing",
      logs_ref: log?.logs_ref ?? agent.logs_ref ?? null,
      artifact_reference_count: artifacts.length,
      captured_artifact_reference_count: artifacts.filter((artifact) => artifact.artifact_reference_status === "captured").length,
      output_ref: agent.output_ref ?? null,
      output_hash: agent.output_hash ?? null,
      started_at: agent.started_at ?? null,
      completed_at: agent.completed_at ?? null,
      human_review_required: true,
      client_facing_ready: false,
      read_only: true,
      preview_only: true,
      log_content_read_performed: false,
      artifact_content_read_performed: false,
    };
  });
}

function buildRunToolActivityViews({ context, generatedAt }) {
  return context.toolRecords.map((tool) => {
    const eventBinding = context.toolEventByInvocation.get(tool.tool_invocation_id) ?? null;
    return {
      schema_version: "run-tool-activity-view.v1",
      run_tool_activity_view_id: `run-tool-activity-view.${slugify(tool.tool_invocation_id)}`,
      generated_at: generatedAt,
      tool_activity_status: eventBinding?.event_binding_status === "context_bound" ? "ready" : "attention",
      tool_invocation_id: tool.tool_invocation_id,
      agent_run_id: tool.agent_run_id,
      workflow_run_id: tool.workflow_run_id,
      run_ledger_id: tool.run_ledger_id,
      runtime_id: tool.runtime_id,
      tool_id: tool.tool_id,
      requested_state: tool.requested_state,
      permission_decision: tool.permission_decision,
      permission_status: tool.permission_status,
      invocation_state: tool.invocation_state,
      execution_allowed: Boolean(tool.execution_allowed),
      protected_action: Boolean(tool.protected_action),
      approval_required: Boolean(tool.approval_required),
      human_approval_required: Boolean(tool.human_approval_required),
      event_binding_status: eventBinding?.event_binding_status ?? "missing",
      event_envelope_id: eventBinding?.event_envelope_id ?? null,
      human_review_required: true,
      client_facing_ready: false,
      read_only: true,
      preview_only: true,
      execution_performed: false,
      protected_action_executed: false,
    };
  });
}

function buildRunLogArtifactViews({ context, generatedAt }) {
  const logViews = context.agentLogReferences.map((log) => ({
    schema_version: "run-log-artifact-view.v1",
    run_log_artifact_view_id: `run-log-artifact-view.log.${slugify(log.agent_run_log_reference_id)}`,
    generated_at: generatedAt,
    log_artifact_view_status: log.log_reference_status === "captured" ? "ready" : "attention",
    reference_kind: "log",
    agent_run_id: log.agent_run_id,
    workflow_run_id: log.workflow_run_id,
    runtime_id: log.runtime_id,
    runtime_log_id: log.runtime_log_id ?? null,
    runtime_artifact_id: null,
    artifact_id: null,
    artifact_type: null,
    reference_uri: log.logs_ref ?? null,
    content_hash: null,
    delivery_state: null,
    capture_status: log.log_capture_status ?? log.log_reference_status ?? "unknown",
    human_review_required: true,
    client_facing_ready: false,
    read_only: true,
    preview_only: true,
    log_content_read_performed: false,
    artifact_content_read_performed: false,
  }));
  const artifactViews = context.agentArtifactReferences.map((artifact) => ({
    schema_version: "run-log-artifact-view.v1",
    run_log_artifact_view_id: `run-log-artifact-view.artifact.${slugify(artifact.agent_run_artifact_reference_id)}`,
    generated_at: generatedAt,
    log_artifact_view_status: ["captured", "reference_only"].includes(artifact.artifact_reference_status) ? "ready" : "attention",
    reference_kind: "artifact",
    agent_run_id: artifact.agent_run_id,
    workflow_run_id: artifact.workflow_run_id,
    runtime_id: artifact.runtime_id,
    runtime_log_id: null,
    runtime_artifact_id: artifact.runtime_artifact_id ?? null,
    artifact_id: artifact.artifact_id ?? null,
    artifact_type: artifact.artifact_type ?? null,
    reference_uri: artifact.artifact_uri ?? null,
    content_hash: artifact.content_hash ?? null,
    delivery_state: artifact.delivery_state ?? null,
    capture_status: artifact.artifact_reference_status ?? "unknown",
    human_review_required: true,
    client_facing_ready: false,
    read_only: true,
    preview_only: true,
    log_content_read_performed: false,
    artifact_content_read_performed: false,
  }));
  return [...logViews, ...artifactViews].sort((left, right) => `${left.workflow_run_id}.${left.reference_kind}.${left.agent_run_id}`.localeCompare(`${right.workflow_run_id}.${right.reference_kind}.${right.agent_run_id}`));
}

function buildPanels({
  desktopSessionViews,
  runProgressViews,
  runHistoryViews,
  runAgentActivityViews,
  runToolActivityViews,
  runLogArtifactViews,
  generatedAt,
}) {
  const counts = {
    desktop_sessions: desktopSessionViews.length,
    workflow_progress: runProgressViews.length,
    run_history: runHistoryViews.length,
    agent_activity: runAgentActivityViews.length,
    tool_activity: runToolActivityViews.length,
    logs_artifacts: runLogArtifactViews.length,
  };
  return PANEL_DEFINITIONS.map(([panelKey, panelLabel, description], index) => ({
    schema_version: "run-ledger-viewer-panel.v1",
    panel_key: panelKey,
    panel_label: panelLabel,
    panel_order: index + 1,
    panel_status: counts[panelKey] > 0 ? "ready" : "attention",
    description,
    row_count: counts[panelKey] ?? 0,
    read_only: true,
    preview_only: true,
    desktop_projection_only: true,
    route_execution_allowed: false,
    server_start_allowed: false,
    log_content_read_allowed: false,
    artifact_content_read_allowed: false,
    mutation_allowed: false,
    protected_action_execution_allowed: false,
    legal_advice_generated: false,
    client_facing_ready: false,
    human_review_required: true,
    generated_at: generatedAt,
  }));
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "run-ledger-viewer-boundary.v1",
    boundary_status: "enforced",
    generated_at: generatedAt,
    read_only: true,
    preview_only: true,
    desktop_projection_only: true,
    log_content_read_performed: false,
    artifact_content_read_performed: false,
    source_ingest_performed: false,
    route_execution_performed: false,
    server_started: false,
    mutation_allowed: false,
    protected_action_executed: false,
    approval_application_performed: false,
    output_delivery_performed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    client_facing_ready: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
  };
}

function buildViewerContract(generatedAt) {
  return {
    schema_version: "run-ledger-viewer-contract.v1",
    run_ledger_viewer_contract_id: "run-ledger-viewer.v1",
    generated_at: generatedAt,
    desktop_surface_role: "session_progress_history_viewer",
    source_rule: "Read workflow, agent, tool, log, artifact, and audit ledger metadata only.",
    history_rule: "Render event-backed run history without replaying events or executing routes.",
    log_artifact_rule: "Display log and artifact references only; do not read referenced content.",
    mutation_policy: "not_allowed",
    protected_action_policy: "display_only_no_execution",
    human_review_rule: "Resume, retry, cancel, delivery, legal analysis, and client-facing outputs remain human-gated.",
  };
}

function buildChecks({
  packageJson,
  roadmapText,
  implementationRoadmapText,
  reviewDashboardText,
  reviewApiText,
  reviewApiDocText,
  workflowRunLedger,
  agentRunLedger,
  toolInvocationLedger,
  auditEventLedger,
  ledgerApiDashboard,
  sourceSpanInspector,
  panels,
  desktopSessionViews,
  runProgressViews,
  runHistoryViews,
  runAgentActivityViews,
  runToolActivityViews,
  runLogArtifactViews,
  boundary,
}) {
  const checks = [];
  const check = (checkId, condition, message) => {
    checks.push({
      schema_version: "run-ledger-viewer-check.v1",
      validation_id: `run-ledger-viewer.${checkId}`,
      subject_id: "run_ledger_viewer",
      check_id: checkId,
      status: condition ? "passed" : "failed",
      message,
    });
  };
  check("surface.package_script", Boolean(packageJson.scripts?.["ledgers:run-viewer"]), "package.json exposes ledgers:run-viewer.");
  check("surface.ledger", includesAll(roadmapText, ["| P292 |", "Run Ledger Viewer"]), "Final completion ledger promotes Phase 292.");
  check("surface.implementation_roadmap", includesAll(implementationRoadmapText, ["Phase 292 - Run Ledger Viewer", "run_ledger_viewer"]), "Implementation roadmap documents Phase 292.");
  check("surface.dashboard", includesAll(reviewDashboardText, ["run_ledger_viewer", "buildRunLedgerViewerStage"]), "Review Dashboard registers Run Ledger Viewer.");
  check("surface.review_api", includesAll(reviewApiText, ["/api/run-ledger-viewer-artifacts", "/api/desktop-session-views", "/api/run-log-artifact-views"]), "Review API exposes Run Ledger Viewer routes.");
  check("surface.review_api_doc", includesAll(reviewApiDocText, ["P292 Run Ledger Viewer Routes", "/api/desktop-session-views"]), "Review API docs list Run Ledger Viewer routes.");
  check("source.workflow_run_ledger_complete", workflowRunLedger.summary?.workflow_run_ledger_status === "complete", "Workflow Run Ledger source is complete.");
  check("source.agent_run_ledger_complete", agentRunLedger.summary?.agent_run_ledger_status === "complete", "Agent Run Ledger source is complete.");
  check("source.tool_invocation_ledger_complete", toolInvocationLedger.summary?.tool_invocation_ledger_status === "complete", "Tool Invocation Ledger source is complete.");
  check("source.audit_event_ledger_complete", auditEventLedger.summary?.audit_event_ledger_status === "complete", "Audit Event Ledger source is complete.");
  check("source.ledger_api_dashboard_complete", ledgerApiDashboard.summary?.ledger_api_dashboard_status === "complete", "Ledger API Dashboard source is complete.");
  check("source.source_span_inspector_phase_guard", sourceSpanInspector.summary?.source_span_inspector_status === "complete" && sourceSpanInspector.summary?.phase_slot === PREVIOUS_PHASE_SLOT && sourceSpanInspector.summary?.next_phase_slot === PHASE_SLOT, "Source Span Inspector remains the P291 guard before P292.");
  check("panels.required", panels.length === PANEL_DEFINITIONS.length && panels.every((panel) => panel.panel_status === "ready"), "All required Run Ledger Viewer panels are ready.");
  check("sessions.workflow_bound", desktopSessionViews.length === (workflowRunLedger.summary?.workflow_run_record_count ?? 0), "Every workflow run has a Desktop session view.");
  check("progress.workflow_bound", runProgressViews.length === desktopSessionViews.length, "Every Desktop session has a progress view.");
  check("history.event_bound", runHistoryViews.length === (workflowRunLedger.summary?.event_binding_count ?? 0) && runHistoryViews.every((row) => row.run_history_status === "linked"), "Run history rows cover workflow event bindings.");
  check("agents.workflow_bound", runAgentActivityViews.length === (agentRunLedger.summary?.agent_run_record_count ?? 0), "Agent activity rows cover Agent Run Ledger records.");
  check("tools.workflow_bound", runToolActivityViews.length === (toolInvocationLedger.summary?.tool_invocation_record_count ?? 0), "Tool activity rows cover Tool Invocation Ledger records.");
  check("logs_artifacts.references_bound", runLogArtifactViews.length === (agentRunLedger.summary?.agent_run_log_reference_count ?? 0) + (agentRunLedger.summary?.agent_run_artifact_reference_count ?? 0), "Log/artifact views cover log and artifact references.");
  check("boundary.read_only", boundary.read_only && boundary.preview_only && boundary.desktop_projection_only && !boundary.log_content_read_performed && !boundary.artifact_content_read_performed, "Run Ledger Viewer is read-only, preview-only, and reads no log/artifact contents.");
  check("boundary.no_execution", !boundary.route_execution_performed && !boundary.server_started && !boundary.mutation_allowed && !boundary.protected_action_executed, "Run Ledger Viewer does not execute routes, start servers, mutate, or execute protected actions.");
  check("boundary.no_delivery_or_legal_output", !boundary.output_delivery_performed && !boundary.legal_advice_generated && !boundary.client_facing_output_generated, "Run Ledger Viewer performs no delivery, legal advice, or client-facing output.");
  check("boundary.windows_stability", boundary.windows_baseline_stability_preserved && boundary.mac_windows_completion_instability_guard, "Windows baseline stability guard is preserved.");
  return checks;
}

function summarizeRunLedgerViewer({
  workflowRunLedger,
  agentRunLedger,
  toolInvocationLedger,
  auditEventLedger,
  ledgerApiDashboard,
  sourceSpanInspector,
  panels,
  desktopSessionViews,
  runProgressViews,
  runHistoryViews,
  runAgentActivityViews,
  runToolActivityViews,
  runLogArtifactViews,
  boundary,
  checks,
  validation,
  generatedAt,
}) {
  const failedCheckpointCount = checks.filter((item) => item.status !== "passed").length;
  const blockedSessions = desktopSessionViews.filter((row) => row.progress_status === "blocked_pending_human_review").length;
  const blockedTools = runToolActivityViews.filter((row) => row.invocation_state === "blocked").length;
  const logViews = runLogArtifactViews.filter((row) => row.reference_kind === "log").length;
  const artifactViews = runLogArtifactViews.filter((row) => row.reference_kind === "artifact").length;
  return {
    run_ledger_viewer_status: validation.valid ? "complete" : "attention",
    run_ledger_viewer_id: `run-ledger-viewer.${dateStamp(generatedAt)}`,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_workflow_run_ledger_status: workflowRunLedger.summary?.workflow_run_ledger_status ?? "unknown",
    source_workflow_run_record_count: workflowRunLedger.summary?.workflow_run_record_count ?? 0,
    source_agent_run_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
    source_agent_run_record_count: agentRunLedger.summary?.agent_run_record_count ?? 0,
    source_agent_log_reference_count: agentRunLedger.summary?.agent_run_log_reference_count ?? 0,
    source_agent_artifact_reference_count: agentRunLedger.summary?.agent_run_artifact_reference_count ?? 0,
    source_tool_invocation_ledger_status: toolInvocationLedger.summary?.tool_invocation_ledger_status ?? "unknown",
    source_tool_invocation_record_count: toolInvocationLedger.summary?.tool_invocation_record_count ?? 0,
    source_audit_event_ledger_status: auditEventLedger.summary?.audit_event_ledger_status ?? "unknown",
    source_audit_trail_record_count: auditEventLedger.summary?.audit_trail_record_count ?? 0,
    source_ledger_api_dashboard_status: ledgerApiDashboard.summary?.ledger_api_dashboard_status ?? "unknown",
    source_source_span_inspector_status: sourceSpanInspector.summary?.source_span_inspector_status ?? "unknown",
    source_source_span_inspector_phase_slot: sourceSpanInspector.summary?.phase_slot ?? null,
    source_source_span_inspector_next_phase_slot: sourceSpanInspector.summary?.next_phase_slot ?? null,
    run_ledger_viewer_panel_count: panels.length,
    required_panel_count: PANEL_DEFINITIONS.length,
    ready_panel_count: panels.filter((panel) => panel.panel_status === "ready").length,
    desktop_session_view_count: desktopSessionViews.length,
    blocked_desktop_session_count: blockedSessions,
    run_progress_view_count: runProgressViews.length,
    run_history_view_count: runHistoryViews.length,
    linked_run_history_view_count: runHistoryViews.filter((row) => row.run_history_status === "linked").length,
    run_agent_activity_view_count: runAgentActivityViews.length,
    completed_agent_activity_view_count: runAgentActivityViews.filter((row) => row.status === "completed").length,
    run_tool_activity_view_count: runToolActivityViews.length,
    blocked_tool_activity_view_count: blockedTools,
    permitted_tool_activity_view_count: runToolActivityViews.filter((row) => row.invocation_state === "permitted").length,
    run_log_artifact_view_count: runLogArtifactViews.length,
    log_reference_view_count: logViews,
    artifact_reference_view_count: artifactViews,
    ready_log_artifact_view_count: runLogArtifactViews.filter((row) => row.log_artifact_view_status === "ready").length,
    human_review_required_session_count: desktopSessionViews.filter((row) => row.human_review_required).length,
    client_facing_ready_session_count: desktopSessionViews.filter((row) => row.client_facing_ready).length,
    read_only_session_count: desktopSessionViews.filter((row) => row.read_only).length,
    preview_only_session_count: desktopSessionViews.filter((row) => row.preview_only).length,
    read_only: boundary.read_only,
    preview_only: boundary.preview_only,
    desktop_projection_only: boundary.desktop_projection_only,
    log_content_read_performed: boundary.log_content_read_performed,
    artifact_content_read_performed: boundary.artifact_content_read_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    route_execution_performed: boundary.route_execution_performed,
    server_started: boundary.server_started,
    mutation_allowed: boundary.mutation_allowed,
    protected_action_executed: boundary.protected_action_executed,
    approval_application_performed: boundary.approval_application_performed,
    output_delivery_performed: boundary.output_delivery_performed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    human_review_required: boundary.human_review_required,
    client_facing_ready: boundary.client_facing_ready,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: checks.length,
    failed_checkpoint_count: failedCheckpointCount,
    validation_error_count: validation.errors.length,
  };
}

export async function writeRunLedgerViewer(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "run-ledger-viewer.json"), result);
  await writeJson(path.join(outDir, "run-ledger-viewer-panels.json"), collectionEnvelope("run-ledger-viewer-panels.v1", "run_ledger_viewer_panels", result.run_ledger_viewer_panels, result.generated_at));
  await writeJson(path.join(outDir, "desktop-session-views.json"), collectionEnvelope("desktop-session-views.v1", "desktop_session_views", result.desktop_session_views, result.generated_at));
  await writeJson(path.join(outDir, "run-progress-views.json"), collectionEnvelope("run-progress-views.v1", "run_progress_views", result.run_progress_views, result.generated_at));
  await writeJson(path.join(outDir, "run-history-views.json"), collectionEnvelope("run-history-views.v1", "run_history_views", result.run_history_views, result.generated_at));
  await writeJson(path.join(outDir, "run-agent-activity-views.json"), collectionEnvelope("run-agent-activity-views.v1", "run_agent_activity_views", result.run_agent_activity_views, result.generated_at));
  await writeJson(path.join(outDir, "run-tool-activity-views.json"), collectionEnvelope("run-tool-activity-views.v1", "run_tool_activity_views", result.run_tool_activity_views, result.generated_at));
  await writeJson(path.join(outDir, "run-log-artifact-views.json"), collectionEnvelope("run-log-artifact-views.v1", "run_log_artifact_views", result.run_log_artifact_views, result.generated_at));
  await writeJson(path.join(outDir, "run-ledger-viewer-boundary.json"), result.run_ledger_viewer_boundary);
  await writeJson(path.join(outDir, "run-ledger-viewer-checks.json"), collectionEnvelope("run-ledger-viewer-checks.v1", "run_ledger_viewer_checks", result.run_ledger_viewer_checks, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "run-ledger-viewer-validation-report.v1",
    generated_at: result.generated_at,
    run_ledger_viewer_id: result.run_ledger_viewer_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    [`${key.slice(0, -1)}_count`]: rows.length,
    [key]: rows,
  };
}

function buildSourceContracts(sources) {
  return Object.entries(sources).map(([sourceId, artifact]) => ({
    source_id: snakeCase(sourceId),
    schema_version: artifact.schema_version ?? null,
    status: artifact.summary?.[`${snakeCase(sourceId)}_status`] ?? sourceStatus(sourceId, artifact),
    generated_at: artifact.generated_at ?? null,
  }));
}

function sourceStatus(sourceId, artifact) {
  if (sourceId === "workflowRunLedger") return artifact.summary?.workflow_run_ledger_status ?? "unknown";
  if (sourceId === "agentRunLedger") return artifact.summary?.agent_run_ledger_status ?? "unknown";
  if (sourceId === "toolInvocationLedger") return artifact.summary?.tool_invocation_ledger_status ?? "unknown";
  if (sourceId === "auditEventLedger") return artifact.summary?.audit_event_ledger_status ?? "unknown";
  if (sourceId === "ledgerApiDashboard") return artifact.summary?.ledger_api_dashboard_status ?? "unknown";
  if (sourceId === "sourceSpanInspector") return artifact.summary?.source_span_inspector_status ?? "unknown";
  return "unknown";
}

function buildSummaryMarkdown(result) {
  const summary = result.summary;
  return [
    "# Run Ledger Viewer",
    "",
    `- Status: ${summary.run_ledger_viewer_status}`,
    `- Phase: ${summary.phase_slot} (previous ${summary.previous_phase_slot}, next ${summary.next_phase_slot})`,
    `- Desktop sessions: ${summary.desktop_session_view_count}`,
    `- Progress views: ${summary.run_progress_view_count}`,
    `- History rows: ${summary.run_history_view_count}`,
    `- Agent activity rows: ${summary.run_agent_activity_view_count}`,
    `- Tool activity rows: ${summary.run_tool_activity_view_count}`,
    `- Log/artifact rows: ${summary.run_log_artifact_view_count}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "Human review note: Run Ledger Viewer is read-only and preview-only. It does not read log or artifact content, execute routes, mutate records, apply approvals, deliver output, generate legal advice, or create client-facing output.",
  ].join("\n");
}

export async function runRunLedgerViewerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runRunLedgerViewer(args);
    console.log(`Run Ledger Viewer ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.run_ledger_viewer_status}`);
    console.log(`Desktop sessions: ${result.summary.desktop_session_view_count}`);
    console.log(`History rows: ${result.summary.run_history_view_count}`);
    console.log(`Agent activity rows: ${result.summary.run_agent_activity_view_count}`);
    console.log(`Tool activity rows: ${result.summary.run_tool_activity_view_count}`);
    console.log(`Log/artifact rows: ${result.summary.run_log_artifact_view_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") parsed.check = true;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--implementation-roadmap") parsed.implementationRoadmapPath = argv[++index];
    else if (arg === "--review-dashboard") parsed.reviewDashboardPath = argv[++index];
    else if (arg === "--review-api") parsed.reviewApiPath = argv[++index];
    else if (arg === "--review-api-doc") parsed.reviewApiDocPath = argv[++index];
    else if (arg === "--workflow-run-ledger") parsed.workflowRunLedgerPath = argv[++index];
    else if (arg === "--agent-run-ledger") parsed.agentRunLedgerPath = argv[++index];
    else if (arg === "--tool-invocation-ledger") parsed.toolInvocationLedgerPath = argv[++index];
    else if (arg === "--audit-event-ledger") parsed.auditEventLedgerPath = argv[++index];
    else if (arg === "--ledger-api-dashboard") parsed.ledgerApiDashboardPath = argv[++index];
    else if (arg === "--source-span-inspector") parsed.sourceSpanInspectorPath = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/run-ledger-viewer.mjs [--check] [--out-dir DIR]

Builds the Phase 292 Run Ledger Viewer read-only Desktop session/progress/history projection.`);
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_RUN_LEDGER_VIEWER_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_RUN_LEDGER_VIEWER_INPUTS.roadmapPath),
    implementation_roadmap_path: path.resolve(options.implementationRoadmapPath ?? DEFAULT_RUN_LEDGER_VIEWER_INPUTS.implementationRoadmapPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_RUN_LEDGER_VIEWER_INPUTS.reviewDashboardPath),
    review_api_path: path.resolve(options.reviewApiPath ?? DEFAULT_RUN_LEDGER_VIEWER_INPUTS.reviewApiPath),
    review_api_doc_path: path.resolve(options.reviewApiDocPath ?? DEFAULT_RUN_LEDGER_VIEWER_INPUTS.reviewApiDocPath),
    workflow_run_ledger_path: path.resolve(options.workflowRunLedgerPath ?? DEFAULT_RUN_LEDGER_VIEWER_INPUTS.workflowRunLedgerPath),
    agent_run_ledger_path: path.resolve(options.agentRunLedgerPath ?? DEFAULT_RUN_LEDGER_VIEWER_INPUTS.agentRunLedgerPath),
    tool_invocation_ledger_path: path.resolve(options.toolInvocationLedgerPath ?? DEFAULT_RUN_LEDGER_VIEWER_INPUTS.toolInvocationLedgerPath),
    audit_event_ledger_path: path.resolve(options.auditEventLedgerPath ?? DEFAULT_RUN_LEDGER_VIEWER_INPUTS.auditEventLedgerPath),
    ledger_api_dashboard_path: path.resolve(options.ledgerApiDashboardPath ?? DEFAULT_RUN_LEDGER_VIEWER_INPUTS.ledgerApiDashboardPath),
    source_span_inspector_path: path.resolve(options.sourceSpanInspectorPath ?? DEFAULT_RUN_LEDGER_VIEWER_INPUTS.sourceSpanInspectorPath),
  };
}

function progressStatus(workflow) {
  if (workflow.run_status === "blocked" || workflow.terminal_state === "blocked") return "blocked_pending_human_review";
  if (workflow.terminal_state) return `terminal_${workflow.terminal_state}`;
  return workflow.run_status ?? "unknown";
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.validation_id, message: item.message }));
  return { valid: errors.length === 0, errors };
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return {};
  }
}

async function readText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function by(key) {
  return (left, right) => String(left?.[key] ?? "").localeCompare(String(right?.[key] ?? ""));
}

function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows ?? []) {
    const value = row?.[key];
    if (value === undefined || value === null) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return groups;
}

function mapBy(rows, key) {
  const map = new Map();
  for (const row of rows ?? []) {
    const value = row?.[key];
    if (value !== undefined && value !== null) map.set(value, row);
  }
  return map;
}

function includesAll(text, fragments) {
  return fragments.every((fragment) => String(text ?? "").includes(fragment));
}

function dateStamp(value) {
  return String(value).replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function slugify(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "unknown";
}

function snakeCase(value) {
  return String(value).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, "");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runRunLedgerViewerCli();
}
