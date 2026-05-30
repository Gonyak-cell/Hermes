import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MATTER_COCKPIT_UI_OUT_DIR = "artifacts/matter-cockpit-ui/latest";
export const DEFAULT_MATTER_COCKPIT_UI_INPUTS = {
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
  matterCockpitPath: "artifacts/matter-cockpit/latest/matter-cockpit.json",
  matterOsProfilePath: "artifacts/matter-os-profile/latest/matter-os-profile.json",
  matterTimelinePath: "artifacts/matter-timeline/latest/matter-timeline.json",
  matterTaskBoardPath: "artifacts/matter-task-board/latest/matter-task-board.json",
  matterDocumentIndexPath: "artifacts/matter-document-index/latest/matter-document-index.json",
  evidenceViewerUiPath: "artifacts/evidence-viewer-ui/latest/evidence-viewer-ui.json",
  approvalQueueUiPath: "artifacts/approval-queue-ui/latest/approval-queue-ui.json",
  runLedgerViewerPath: "artifacts/run-ledger-viewer/latest/run-ledger-viewer.json",
};

const SCHEMA_VERSION = "matter-cockpit-ui.v1";
const CAPABILITY_ID = "desktop.matter_cockpit_ui";
const PHASE_SLOT = "P293";
const PREVIOUS_PHASE_SLOT = "P292";
const NEXT_PHASE_SLOT = "P294";
const PANEL_DEFINITIONS = [
  ["profile", "Profile", "Matter identity, client, counterparty, security, and owner summary."],
  ["timeline", "Timeline", "Matter timeline events from files and review artifacts."],
  ["tasks", "Tasks", "Read-only task board rows and workflow anchors."],
  ["documents", "Documents", "Document index rows without reading document content."],
  ["evidence", "Evidence", "Evidence viewer UI cards without evidence mutation or source reads."],
  ["approvals", "Approvals", "Human-gated approval queue rows without applying approvals."],
];

export async function runMatterCockpitUi(options = {}) {
  const result = await buildMatterCockpitUi(options);
  if (options.write !== false) await writeMatterCockpitUi(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Matter Cockpit UI validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildMatterCockpitUi(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MATTER_COCKPIT_UI_OUT_DIR);
  const inputs = normalizeInputs(options);
  const [
    packageJson,
    roadmapText,
    implementationRoadmapText,
    reviewDashboardText,
    reviewApiText,
    reviewApiDocText,
    matterCockpit,
    matterOsProfile,
    matterTimeline,
    matterTaskBoard,
    matterDocumentIndex,
    evidenceViewerUi,
    approvalQueueUi,
    runLedgerViewer,
  ] = await Promise.all([
    readJson(inputs.package_path),
    readText(inputs.roadmap_path),
    readText(inputs.implementation_roadmap_path),
    readText(inputs.review_dashboard_path),
    readText(inputs.review_api_path),
    readText(inputs.review_api_doc_path),
    readJson(inputs.matter_cockpit_path),
    readJson(inputs.matter_os_profile_path),
    readJson(inputs.matter_timeline_path),
    readJson(inputs.matter_task_board_path),
    readJson(inputs.matter_document_index_path),
    readJson(inputs.evidence_viewer_ui_path),
    readJson(inputs.approval_queue_ui_path),
    readJson(inputs.run_ledger_viewer_path),
  ]);

  const context = buildCockpitContext({
    matterCockpit,
    matterOsProfile,
    matterTimeline,
    matterTaskBoard,
    matterDocumentIndex,
    evidenceViewerUi,
    approvalQueueUi,
    runLedgerViewer,
  });
  const profileCards = buildProfileCards({ context, generatedAt });
  const timelineRows = buildTimelineRows({ context, generatedAt });
  const taskRows = buildTaskRows({ context, generatedAt });
  const documentRows = buildDocumentRows({ context, generatedAt });
  const evidenceRows = buildEvidenceRows({ context, generatedAt });
  const approvalRows = buildApprovalRows({ context, generatedAt });
  const panels = buildPanels({
    profileCards,
    timelineRows,
    taskRows,
    documentRows,
    evidenceRows,
    approvalRows,
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
    matterCockpit,
    matterOsProfile,
    matterTimeline,
    matterTaskBoard,
    matterDocumentIndex,
    evidenceViewerUi,
    approvalQueueUi,
    runLedgerViewer,
    panels,
    profileCards,
    timelineRows,
    taskRows,
    documentRows,
    evidenceRows,
    approvalRows,
    boundary,
  });
  const validation = summarizeValidation(checks);
  const summary = summarizeMatterCockpitUi({
    matterCockpit,
    matterOsProfile,
    matterTimeline,
    matterTaskBoard,
    matterDocumentIndex,
    evidenceViewerUi,
    approvalQueueUi,
    runLedgerViewer,
    panels,
    profileCards,
    timelineRows,
    taskRows,
    documentRows,
    evidenceRows,
    approvalRows,
    boundary,
    checks,
    validation,
    generatedAt,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    matter_cockpit_ui_id: summary.matter_cockpit_ui_id,
    matter_cockpit_ui_status: summary.matter_cockpit_ui_status,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({
      matterCockpit,
      matterOsProfile,
      matterTimeline,
      matterTaskBoard,
      matterDocumentIndex,
      evidenceViewerUi,
      approvalQueueUi,
      runLedgerViewer,
    }),
    matter_cockpit_ui_contract: buildCockpitContract(generatedAt),
    matter_cockpit_ui_panels: panels,
    matter_cockpit_profile_cards: profileCards,
    matter_cockpit_timeline_rows: timelineRows,
    matter_cockpit_task_rows: taskRows,
    matter_cockpit_document_rows: documentRows,
    matter_cockpit_evidence_rows: evidenceRows,
    matter_cockpit_approval_rows: approvalRows,
    matter_cockpit_ui_boundary: boundary,
    matter_cockpit_ui_checks: checks,
    validation_items: checks,
    validation,
    summary,
  };
  result.summary_markdown = buildSummaryMarkdown(result);
  return result;
}

function buildCockpitContext({
  matterCockpit,
  matterOsProfile,
  matterTimeline,
  matterTaskBoard,
  matterDocumentIndex,
  evidenceViewerUi,
  approvalQueueUi,
  runLedgerViewer,
}) {
  const matters = [...(matterCockpit.matters ?? [])].sort(by("matter_id"));
  const profiles = matterOsProfile.matter_os_profiles ?? [];
  const displayFields = matterOsProfile.matter_os_display_fields ?? [];
  const timelineEvents = matterTimeline.matter_timeline_events ?? [];
  const timelines = matterTimeline.matter_timelines ?? [];
  const tasks = matterTaskBoard.task_records ?? [];
  const workflowBindings = matterTaskBoard.workflow_bindings ?? [];
  const documents = matterDocumentIndex.document_records ?? [];
  const evidenceCards = evidenceViewerUi.evidence_viewer_ui_cards ?? [];
  const approvals = approvalQueueUi.approval_queue_ui_items ?? [];
  const sessions = runLedgerViewer.desktop_session_views ?? [];
  return {
    matters,
    profilesByMatter: mapBy(profiles, "matter_id"),
    displayFieldsByMatter: mapBy(displayFields, "matter_id"),
    timelinesByMatter: mapBy(timelines, "matter_id"),
    timelineEvents: [...timelineEvents].sort(byTimeThenId("event_at", "event_id")),
    timelineEventsByMatter: groupBy(timelineEvents, "matter_id"),
    tasks: [...tasks].sort(by("task_id")),
    tasksByMatter: groupBy(tasks, "matter_id"),
    workflowBindingByTask: mapBy(workflowBindings, "task_id"),
    documents: [...documents].sort(by("document_id")),
    documentsByMatter: groupBy(documents, "matter_id"),
    evidenceCards: [...evidenceCards].sort(by("evidence_viewer_ui_card_id")),
    evidenceCardsByMatter: groupBy(evidenceCards, "matter_id"),
    approvals: [...approvals].sort(by("approval_queue_ui_item_id")),
    approvalsByMatter: groupBy(approvals, "matter_id"),
    sessionsByMatter: groupBy(sessions, "matter_id"),
  };
}

function buildProfileCards({ context, generatedAt }) {
  return context.matters.map((matter) => {
    const profile = context.profilesByMatter.get(matter.matter_id);
    const display = context.displayFieldsByMatter.get(matter.matter_id);
    const timeline = context.timelinesByMatter.get(matter.matter_id);
    const timelineEvents = context.timelineEventsByMatter.get(matter.matter_id) ?? [];
    const tasks = context.tasksByMatter.get(matter.matter_id) ?? [];
    const documents = context.documentsByMatter.get(matter.matter_id) ?? [];
    const evidenceCards = context.evidenceCardsByMatter.get(matter.matter_id) ?? [];
    const approvals = context.approvalsByMatter.get(matter.matter_id) ?? [];
    const sessions = context.sessionsByMatter.get(matter.matter_id) ?? [];
    return {
      schema_version: "matter-cockpit-profile-card.v1",
      matter_cockpit_profile_card_id: `matter-cockpit-profile.${slugify(matter.matter_key ?? matter.matter_id)}`,
      generated_at: generatedAt,
      profile_card_status: profile ? "complete" : "summary_only",
      matter_key: matter.matter_key,
      tenant_id: matter.tenant_id,
      matter_id: matter.matter_id,
      matter_label: profile?.matter_name ?? matter.matter_label ?? display?.matter_number ?? matter.matter_id,
      matter_status: profile?.matter_status ?? matter.status,
      client_display_name: profile?.client_display_name ?? display?.client ?? null,
      counterparty_display_names: profile?.counterparty_display_names ?? (display?.counterparty ? [display.counterparty] : []),
      matter_number: profile?.matter_number ?? display?.matter_number ?? null,
      practice_area: profile?.practice_area ?? matter.domain_packs?.[0] ?? null,
      security_grade: profile?.security_grade ?? display?.security_grade ?? null,
      responsible_owner: profile?.responsible_owner ?? display?.responsible_owner ?? null,
      domain_packs: matter.domain_packs ?? [],
      classifications: matter.classifications ?? [],
      timeline_event_count: timeline?.event_count ?? timelineEvents.length,
      task_count: tasks.length,
      document_count: documents.length,
      evidence_card_count: evidenceCards.length,
      approval_item_count: approvals.length,
      desktop_session_count: sessions.length,
      pending_approval_count: matter.pending_approval_count ?? approvals.filter((item) => item.item_status === "pending").length,
      blocked_delivery_count: matter.blocked_delivery_count ?? 0,
      latest_activity_at: matter.latest_activity_at ?? timeline?.last_event_at ?? null,
      attorney_review_required: true,
      human_review_required: true,
      client_facing_ready: false,
      read_only: true,
      preview_only: true,
      mutation_allowed: false,
      protected_action_executed: false,
    };
  });
}

function buildTimelineRows({ context, generatedAt }) {
  return context.timelineEvents.map((event) => ({
    schema_version: "matter-cockpit-timeline-row.v1",
    matter_cockpit_timeline_row_id: `matter-cockpit-timeline.${slugify(event.event_id)}`,
    generated_at: generatedAt,
    timeline_row_status: "ready",
    matter_id: event.matter_id,
    event_id: event.event_id,
    event_type: event.event_type,
    event_subtype: event.event_subtype ?? null,
    event_title: event.event_title,
    event_summary: event.event_summary ?? null,
    event_at: event.event_at ?? event.event_date ?? null,
    sequence_number: event.sequence_number ?? null,
    source_kind: event.source_kind ?? null,
    source_id: event.source_id ?? null,
    source_record_id: event.source_record_id ?? null,
    attorney_review_required: Boolean(event.attorney_review_required ?? true),
    human_review_required: Boolean(event.human_review_required ?? true),
    client_facing_ready: false,
    read_only: true,
    preview_only: true,
    mutation_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
  }));
}

function buildTaskRows({ context, generatedAt }) {
  return context.tasks.map((task) => {
    const binding = context.workflowBindingByTask.get(task.task_id);
    return {
      schema_version: "matter-cockpit-task-row.v1",
      matter_cockpit_task_row_id: `matter-cockpit-task.${slugify(task.task_id)}`,
      generated_at: generatedAt,
      task_row_status: "ready",
      task_id: task.task_id,
      matter_id: task.matter_id,
      task_category: task.task_category,
      task_title: task.task_title,
      task_owner: task.task_owner,
      due_date: task.due_date ?? null,
      due_status: task.due_status ?? null,
      task_status: task.task_status,
      task_column_id: task.task_column_id,
      workflow_binding_status: binding?.workflow_binding_status ?? task.workflow_binding_status ?? null,
      workflow_run_id: binding?.workflow_run_id ?? task.workflow_run_id ?? null,
      source_kind: task.source_kind ?? null,
      source_id: task.source_id ?? null,
      source_record_id: task.source_record_id ?? null,
      attorney_review_required: Boolean(task.attorney_review_required ?? true),
      human_review_required: Boolean(task.human_review_required ?? true),
      client_facing_ready: false,
      read_only: true,
      preview_only: true,
      task_state_write_allowed: false,
      workflow_transition_allowed: false,
      mutation_allowed: false,
      protected_action_executed: false,
    };
  });
}

function buildDocumentRows({ context, generatedAt }) {
  return context.documents.map((document) => ({
    schema_version: "matter-cockpit-document-row.v1",
    matter_cockpit_document_row_id: `matter-cockpit-document.${slugify(document.document_id)}`,
    generated_at: generatedAt,
    document_row_status: "ready",
    document_id: document.document_id,
    matter_id: document.matter_id,
    document_family_id: document.document_family_id,
    document_role: document.document_role,
    document_title: document.document_title,
    document_type: document.document_type,
    version_label: document.version_label ?? null,
    version_number: document.version_number ?? null,
    document_status: document.document_status,
    document_at: document.document_at ?? document.document_date ?? null,
    is_latest: Boolean(document.is_latest),
    source_kind: document.source_kind ?? null,
    source_id: document.source_id ?? null,
    source_record_id: document.source_record_id ?? null,
    attorney_review_required: Boolean(document.attorney_review_required ?? true),
    human_review_required: Boolean(document.human_review_required ?? true),
    client_facing_ready: false,
    read_only: true,
    preview_only: true,
    document_content_read_performed: false,
    document_mutation_allowed: false,
    delivery_execution_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
  }));
}

function buildEvidenceRows({ context, generatedAt }) {
  return context.evidenceCards.map((card) => ({
    schema_version: "matter-cockpit-evidence-row.v1",
    matter_cockpit_evidence_row_id: `matter-cockpit-evidence.${slugify(card.evidence_viewer_ui_card_id)}`,
    generated_at: generatedAt,
    evidence_row_status: card.card_status ?? "ready",
    evidence_viewer_ui_card_id: card.evidence_viewer_ui_card_id,
    evidence_id: card.evidence_id,
    matter_id: card.matter_id,
    tenant_id: card.tenant_id ?? null,
    evidence_type: card.evidence_type ?? null,
    classification: card.classification ?? null,
    review_status: card.review_status ?? null,
    reliability: card.reliability ?? null,
    verification_state: card.verification_state ?? null,
    privilege_flag: card.privilege_flag ?? null,
    source_span_count: card.source_span_count ?? (card.source_span_id ? 1 : 0),
    citation_count: card.citation_count ?? (card.citation_id ? 1 : 0),
    coverage_status: card.coverage_status ?? null,
    human_review_required: Boolean(card.human_review_required ?? true),
    client_facing_ready: false,
    read_only: true,
    preview_only: true,
    source_file_content_read_performed: false,
    source_ingest_performed: false,
    evidence_mutation_allowed: false,
    citation_approval_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
  }));
}

function buildApprovalRows({ context, generatedAt }) {
  return context.approvals.map((item) => ({
    schema_version: "matter-cockpit-approval-row.v1",
    matter_cockpit_approval_row_id: `matter-cockpit-approval.${slugify(item.approval_queue_ui_item_id)}`,
    generated_at: generatedAt,
    approval_row_status: "ready",
    approval_queue_ui_item_id: item.approval_queue_ui_item_id,
    source_stage: item.source_stage,
    source_item_id: item.source_item_id,
    source_item_type: item.source_item_type,
    item_status: item.item_status,
    display_status: item.display_status,
    priority: item.priority,
    title: item.title,
    reason: item.reason ?? null,
    subject_ref: item.subject_ref ?? null,
    matter_id: item.matter_id ?? null,
    classification: item.classification ?? null,
    required_actor: item.required_actor ?? null,
    required_decision: item.required_decision ?? null,
    human_review_required: true,
    client_facing_ready: false,
    read_only: true,
    preview_only: true,
    approval_application_allowed: false,
    receipt_application_allowed: false,
    protected_action_execution_allowed: false,
    mutation_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
  }));
}

function buildPanels({ profileCards, timelineRows, taskRows, documentRows, evidenceRows, approvalRows, generatedAt }) {
  const counts = {
    profile: profileCards.length,
    timeline: timelineRows.length,
    tasks: taskRows.length,
    documents: documentRows.length,
    evidence: evidenceRows.length,
    approvals: approvalRows.length,
  };
  return PANEL_DEFINITIONS.map(([panelKey, panelLabel, description], index) => ({
    schema_version: "matter-cockpit-ui-panel.v1",
    panel_key: panelKey,
    panel_label: panelLabel,
    panel_order: index + 1,
    panel_status: "ready",
    description,
    row_count: counts[panelKey] ?? 0,
    read_only: true,
    preview_only: true,
    ui_projection_only: true,
    document_content_read_allowed: false,
    source_file_content_read_allowed: false,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    evidence_mutation_allowed: false,
    approval_application_allowed: false,
    delivery_execution_allowed: false,
    route_execution_allowed: false,
    server_start_allowed: false,
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
    schema_version: "matter-cockpit-ui-boundary.v1",
    boundary_status: "enforced",
    generated_at: generatedAt,
    read_only: true,
    preview_only: true,
    ui_projection_only: true,
    document_content_read_performed: false,
    source_file_content_read_performed: false,
    source_ingest_performed: false,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    document_mutation_allowed: false,
    evidence_mutation_allowed: false,
    citation_approval_performed: false,
    approval_application_performed: false,
    receipt_application_performed: false,
    delivery_execution_performed: false,
    route_execution_performed: false,
    server_started: false,
    mutation_allowed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    client_facing_ready: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
  };
}

function buildCockpitContract(generatedAt) {
  return {
    schema_version: "matter-cockpit-ui-contract.v1",
    matter_cockpit_ui_contract_id: "matter-cockpit-ui.v1",
    generated_at: generatedAt,
    desktop_surface_role: "matter_profile_timeline_tasks_documents_evidence_approvals_viewer",
    source_rule: "Read matter cockpit, profile, timeline, task, document index, evidence UI, approval UI, and run viewer metadata only.",
    document_rule: "Display document index metadata only; do not read document contents.",
    evidence_rule: "Display Evidence Viewer UI metadata only; do not mutate evidence or read source file contents.",
    approval_rule: "Display approval rows only; do not apply approvals, receipts, deliveries, or protected actions.",
    human_review_rule: "Matter updates, task state transitions, evidence decisions, approvals, legal analysis, and client-facing output remain human-gated.",
  };
}

function buildChecks({
  packageJson,
  roadmapText,
  implementationRoadmapText,
  reviewDashboardText,
  reviewApiText,
  reviewApiDocText,
  matterCockpit,
  matterOsProfile,
  matterTimeline,
  matterTaskBoard,
  matterDocumentIndex,
  evidenceViewerUi,
  approvalQueueUi,
  runLedgerViewer,
  panels,
  profileCards,
  timelineRows,
  taskRows,
  documentRows,
  evidenceRows,
  approvalRows,
  boundary,
}) {
  const checks = [];
  const check = (checkId, condition, message) => {
    checks.push({
      schema_version: "matter-cockpit-ui-check.v1",
      validation_id: `matter-cockpit-ui.${checkId}`,
      subject_id: "matter_cockpit_ui",
      check_id: checkId,
      status: condition ? "passed" : "failed",
      message,
    });
  };
  check("surface.package_script", Boolean(packageJson.scripts?.["matter:cockpit-ui"]), "package.json exposes matter:cockpit-ui.");
  check("surface.ledger", includesAll(roadmapText, ["| P293 |", "Matter Cockpit UI"]), "Final completion ledger promotes Phase 293.");
  check("surface.implementation_roadmap", includesAll(implementationRoadmapText, ["Phase 293 - Matter Cockpit UI", "matter_cockpit_ui"]), "Implementation roadmap documents Phase 293.");
  check("surface.dashboard", includesAll(reviewDashboardText, ["matter_cockpit_ui", "buildMatterCockpitUiStage"]), "Review Dashboard registers Matter Cockpit UI.");
  check("surface.review_api", includesAll(reviewApiText, ["/api/matter-cockpit-ui-artifacts", "/api/matter-cockpit-profile-cards", "/api/matter-cockpit-approval-rows"]), "Review API exposes Matter Cockpit UI routes.");
  check("surface.review_api_doc", includesAll(reviewApiDocText, ["P293 Matter Cockpit UI Routes", "/api/matter-cockpit-profile-cards"]), "Review API docs list Matter Cockpit UI routes.");
  check("source.matter_cockpit_complete", (matterCockpit.summary?.matter_count ?? 0) > 0, "Legacy Matter Cockpit source has matter rows.");
  check("source.matter_os_profile_complete", matterOsProfile.summary?.matter_os_profile_status === "complete", "Matter OS Profile source is complete.");
  check("source.matter_timeline_complete", matterTimeline.summary?.matter_timeline_status === "complete", "Matter Timeline source is complete.");
  check("source.matter_task_board_complete", matterTaskBoard.summary?.matter_task_board_status === "complete", "Matter Task Board source is complete.");
  check("source.matter_document_index_complete", matterDocumentIndex.summary?.matter_document_index_status === "complete", "Matter Document Index source is complete.");
  check("source.evidence_viewer_ui_complete", evidenceViewerUi.summary?.evidence_viewer_ui_status === "complete", "Evidence Viewer UI source is complete.");
  check("source.approval_queue_ui_complete", approvalQueueUi.summary?.approval_queue_ui_status === "complete", "Approval Queue UI source is complete.");
  check("source.run_ledger_viewer_phase_guard", runLedgerViewer.summary?.run_ledger_viewer_status === "complete" && runLedgerViewer.summary?.phase_slot === PREVIOUS_PHASE_SLOT && runLedgerViewer.summary?.next_phase_slot === PHASE_SLOT, "Run Ledger Viewer remains the P292 guard before P293.");
  check("panels.required", panels.length === PANEL_DEFINITIONS.length && panels.every((panel) => panel.panel_status === "ready"), "All required Matter Cockpit UI panels are ready.");
  check("profile.matter_bound", profileCards.length === (matterCockpit.summary?.matter_count ?? 0), "Every matter has a profile card row.");
  check("timeline.event_bound", timelineRows.length === (matterTimeline.summary?.timeline_event_count ?? 0), "Timeline rows cover Matter Timeline events.");
  check("tasks.record_bound", taskRows.length === (matterTaskBoard.summary?.task_record_count ?? 0), "Task rows cover Matter Task Board records.");
  check("documents.record_bound", documentRows.length === (matterDocumentIndex.summary?.document_record_count ?? 0), "Document rows cover Matter Document Index records.");
  check("evidence.card_bound", evidenceRows.length === (evidenceViewerUi.summary?.evidence_viewer_ui_card_count ?? 0), "Evidence rows cover Evidence Viewer UI cards.");
  check("approvals.item_bound", approvalRows.length === (approvalQueueUi.summary?.approval_queue_ui_item_count ?? 0), "Approval rows cover Approval Queue UI items.");
  check("boundary.read_only", boundary.read_only && boundary.preview_only && boundary.ui_projection_only && !boundary.document_content_read_performed && !boundary.source_file_content_read_performed, "Matter Cockpit UI is read-only and preview-only.");
  check("boundary.no_mutation", !boundary.matter_data_write_allowed && !boundary.task_state_write_allowed && !boundary.document_mutation_allowed && !boundary.evidence_mutation_allowed && !boundary.mutation_allowed, "Matter Cockpit UI does not mutate matter, task, document, or evidence state.");
  check("boundary.no_execution_or_approval", !boundary.approval_application_performed && !boundary.receipt_application_performed && !boundary.delivery_execution_performed && !boundary.route_execution_performed && !boundary.server_started && !boundary.protected_action_executed, "Matter Cockpit UI applies no approvals, receipts, deliveries, routes, servers, or protected actions.");
  check("boundary.no_legal_or_client_output", !boundary.legal_advice_generated && !boundary.client_facing_output_generated && boundary.human_review_required && !boundary.client_facing_ready, "Matter Cockpit UI produces no legal advice or client-facing output.");
  check("boundary.windows_stability", boundary.windows_baseline_stability_preserved && boundary.mac_windows_completion_instability_guard, "Windows baseline stability guard is preserved.");
  return checks;
}

function summarizeMatterCockpitUi({
  matterCockpit,
  matterOsProfile,
  matterTimeline,
  matterTaskBoard,
  matterDocumentIndex,
  evidenceViewerUi,
  approvalQueueUi,
  runLedgerViewer,
  panels,
  profileCards,
  timelineRows,
  taskRows,
  documentRows,
  evidenceRows,
  approvalRows,
  boundary,
  checks,
  validation,
  generatedAt,
}) {
  const allRows = [...profileCards, ...timelineRows, ...taskRows, ...documentRows, ...evidenceRows, ...approvalRows];
  return {
    matter_cockpit_ui_status: validation.valid ? "complete" : "attention",
    matter_cockpit_ui_id: `matter-cockpit-ui.${dateStamp(generatedAt)}`,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_matter_cockpit_status: (matterCockpit.summary?.matter_count ?? 0) > 0 ? "complete" : "unknown",
    source_matter_count: matterCockpit.summary?.matter_count ?? 0,
    source_blocked_matter_count: matterCockpit.summary?.blocked_matter_count ?? 0,
    source_pending_approval_count: matterCockpit.summary?.pending_approval_count ?? 0,
    source_matter_os_profile_status: matterOsProfile.summary?.matter_os_profile_status ?? "unknown",
    source_matter_os_profile_count: matterOsProfile.summary?.matter_os_profile_count ?? 0,
    source_matter_timeline_status: matterTimeline.summary?.matter_timeline_status ?? "unknown",
    source_timeline_event_count: matterTimeline.summary?.timeline_event_count ?? 0,
    source_matter_task_board_status: matterTaskBoard.summary?.matter_task_board_status ?? "unknown",
    source_task_record_count: matterTaskBoard.summary?.task_record_count ?? 0,
    source_matter_document_index_status: matterDocumentIndex.summary?.matter_document_index_status ?? "unknown",
    source_document_record_count: matterDocumentIndex.summary?.document_record_count ?? 0,
    source_evidence_viewer_ui_status: evidenceViewerUi.summary?.evidence_viewer_ui_status ?? "unknown",
    source_evidence_viewer_ui_phase_slot: evidenceViewerUi.summary?.phase_slot ?? null,
    source_evidence_viewer_ui_card_count: evidenceViewerUi.summary?.evidence_viewer_ui_card_count ?? 0,
    source_approval_queue_ui_status: approvalQueueUi.summary?.approval_queue_ui_status ?? "unknown",
    source_approval_queue_ui_phase_slot: approvalQueueUi.summary?.phase_slot ?? null,
    source_approval_queue_ui_item_count: approvalQueueUi.summary?.approval_queue_ui_item_count ?? 0,
    source_run_ledger_viewer_status: runLedgerViewer.summary?.run_ledger_viewer_status ?? "unknown",
    source_run_ledger_viewer_phase_slot: runLedgerViewer.summary?.phase_slot ?? null,
    source_run_ledger_viewer_next_phase_slot: runLedgerViewer.summary?.next_phase_slot ?? null,
    matter_cockpit_ui_panel_count: panels.length,
    required_panel_count: PANEL_DEFINITIONS.length,
    ready_panel_count: panels.filter((panel) => panel.panel_status === "ready").length,
    profile_card_count: profileCards.length,
    complete_profile_card_count: profileCards.filter((row) => row.profile_card_status === "complete").length,
    summary_only_profile_card_count: profileCards.filter((row) => row.profile_card_status === "summary_only").length,
    blocked_profile_card_count: profileCards.filter((row) => row.matter_status === "blocked").length,
    timeline_row_count: timelineRows.length,
    task_row_count: taskRows.length,
    overdue_task_row_count: taskRows.filter((row) => row.due_status === "overdue").length,
    in_review_task_row_count: taskRows.filter((row) => row.task_column_id === "in_review").length,
    document_row_count: documentRows.length,
    latest_document_row_count: documentRows.filter((row) => row.is_latest).length,
    pending_review_document_row_count: documentRows.filter((row) => row.document_status === "pending_review").length,
    evidence_row_count: evidenceRows.length,
    human_review_required_evidence_row_count: evidenceRows.filter((row) => row.human_review_required).length,
    approval_row_count: approvalRows.length,
    pending_approval_row_count: approvalRows.filter((row) => row.item_status === "pending").length,
    high_priority_approval_row_count: approvalRows.filter((row) => ["critical", "high"].includes(row.priority)).length,
    read_only_row_count: allRows.filter((row) => row.read_only).length,
    preview_only_row_count: allRows.filter((row) => row.preview_only).length,
    human_review_required_row_count: allRows.filter((row) => row.human_review_required).length,
    client_facing_ready_row_count: allRows.filter((row) => row.client_facing_ready).length,
    read_only: boundary.read_only,
    preview_only: boundary.preview_only,
    ui_projection_only: boundary.ui_projection_only,
    document_content_read_performed: boundary.document_content_read_performed,
    source_file_content_read_performed: boundary.source_file_content_read_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    matter_data_write_allowed: boundary.matter_data_write_allowed,
    task_state_write_allowed: boundary.task_state_write_allowed,
    document_mutation_allowed: boundary.document_mutation_allowed,
    evidence_mutation_allowed: boundary.evidence_mutation_allowed,
    citation_approval_performed: boundary.citation_approval_performed,
    approval_application_performed: boundary.approval_application_performed,
    receipt_application_performed: boundary.receipt_application_performed,
    delivery_execution_performed: boundary.delivery_execution_performed,
    route_execution_performed: boundary.route_execution_performed,
    server_started: boundary.server_started,
    mutation_allowed: boundary.mutation_allowed,
    protected_action_executed: boundary.protected_action_executed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    human_review_required: boundary.human_review_required,
    client_facing_ready: boundary.client_facing_ready,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: checks.length,
    failed_checkpoint_count: checks.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
  };
}

export async function writeMatterCockpitUi(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "matter-cockpit-ui.json"), result);
  await writeJson(path.join(outDir, "matter-cockpit-ui-panels.json"), collectionEnvelope("matter-cockpit-ui-panels.v1", "matter_cockpit_ui_panels", result.matter_cockpit_ui_panels, result.generated_at));
  await writeJson(path.join(outDir, "matter-cockpit-profile-cards.json"), collectionEnvelope("matter-cockpit-profile-cards.v1", "matter_cockpit_profile_cards", result.matter_cockpit_profile_cards, result.generated_at));
  await writeJson(path.join(outDir, "matter-cockpit-timeline-rows.json"), collectionEnvelope("matter-cockpit-timeline-rows.v1", "matter_cockpit_timeline_rows", result.matter_cockpit_timeline_rows, result.generated_at));
  await writeJson(path.join(outDir, "matter-cockpit-task-rows.json"), collectionEnvelope("matter-cockpit-task-rows.v1", "matter_cockpit_task_rows", result.matter_cockpit_task_rows, result.generated_at));
  await writeJson(path.join(outDir, "matter-cockpit-document-rows.json"), collectionEnvelope("matter-cockpit-document-rows.v1", "matter_cockpit_document_rows", result.matter_cockpit_document_rows, result.generated_at));
  await writeJson(path.join(outDir, "matter-cockpit-evidence-rows.json"), collectionEnvelope("matter-cockpit-evidence-rows.v1", "matter_cockpit_evidence_rows", result.matter_cockpit_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "matter-cockpit-approval-rows.json"), collectionEnvelope("matter-cockpit-approval-rows.v1", "matter_cockpit_approval_rows", result.matter_cockpit_approval_rows, result.generated_at));
  await writeJson(path.join(outDir, "matter-cockpit-ui-boundary.json"), result.matter_cockpit_ui_boundary);
  await writeJson(path.join(outDir, "matter-cockpit-ui-checks.json"), collectionEnvelope("matter-cockpit-ui-checks.v1", "matter_cockpit_ui_checks", result.matter_cockpit_ui_checks, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "matter-cockpit-ui-validation-report.v1",
    generated_at: result.generated_at,
    matter_cockpit_ui_id: result.matter_cockpit_ui_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

function buildSourceContracts(sources) {
  return Object.entries(sources).map(([sourceId, artifact]) => ({
    source_id: snakeCase(sourceId),
    schema_version: artifact.schema_version ?? null,
    status: sourceStatus(sourceId, artifact),
    generated_at: artifact.generated_at ?? null,
  }));
}

function sourceStatus(sourceId, artifact) {
  if (sourceId === "matterCockpit") return (artifact.summary?.matter_count ?? 0) > 0 ? "complete" : "unknown";
  if (sourceId === "matterOsProfile") return artifact.summary?.matter_os_profile_status ?? "unknown";
  if (sourceId === "matterTimeline") return artifact.summary?.matter_timeline_status ?? "unknown";
  if (sourceId === "matterTaskBoard") return artifact.summary?.matter_task_board_status ?? "unknown";
  if (sourceId === "matterDocumentIndex") return artifact.summary?.matter_document_index_status ?? "unknown";
  if (sourceId === "evidenceViewerUi") return artifact.summary?.evidence_viewer_ui_status ?? "unknown";
  if (sourceId === "approvalQueueUi") return artifact.summary?.approval_queue_ui_status ?? "unknown";
  if (sourceId === "runLedgerViewer") return artifact.summary?.run_ledger_viewer_status ?? "unknown";
  return "unknown";
}

function summarizeValidation(checks) {
  const errors = checks
    .filter((check) => check.status !== "passed")
    .map((check) => ({ path: check.check_id, message: check.message }));
  return { valid: errors.length === 0, errors };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    [`${key.slice(0, -1)}_count`]: rows.length,
    [key]: rows,
  };
}

function buildSummaryMarkdown(result) {
  const summary = result.summary;
  return [
    "# Matter Cockpit UI",
    "",
    `- Status: ${summary.matter_cockpit_ui_status}`,
    `- Phase: ${summary.phase_slot} (previous ${summary.previous_phase_slot}, next ${summary.next_phase_slot})`,
    `- Profile cards: ${summary.profile_card_count}`,
    `- Timeline rows: ${summary.timeline_row_count}`,
    `- Task rows: ${summary.task_row_count}`,
    `- Document rows: ${summary.document_row_count}`,
    `- Evidence rows: ${summary.evidence_row_count}`,
    `- Approval rows: ${summary.approval_row_count}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "Human review note: Matter Cockpit UI is read-only and preview-only. It does not read document or source file content, mutate matter/task/document/evidence state, apply approvals, execute delivery, generate legal advice, or create client-facing output.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  return {
    package_path: path.resolve(options.packagePath ?? DEFAULT_MATTER_COCKPIT_UI_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_MATTER_COCKPIT_UI_INPUTS.roadmapPath),
    implementation_roadmap_path: path.resolve(options.implementationRoadmapPath ?? DEFAULT_MATTER_COCKPIT_UI_INPUTS.implementationRoadmapPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_MATTER_COCKPIT_UI_INPUTS.reviewDashboardPath),
    review_api_path: path.resolve(options.reviewApiPath ?? DEFAULT_MATTER_COCKPIT_UI_INPUTS.reviewApiPath),
    review_api_doc_path: path.resolve(options.reviewApiDocPath ?? DEFAULT_MATTER_COCKPIT_UI_INPUTS.reviewApiDocPath),
    matter_cockpit_path: path.resolve(options.matterCockpitPath ?? DEFAULT_MATTER_COCKPIT_UI_INPUTS.matterCockpitPath),
    matter_os_profile_path: path.resolve(options.matterOsProfilePath ?? DEFAULT_MATTER_COCKPIT_UI_INPUTS.matterOsProfilePath),
    matter_timeline_path: path.resolve(options.matterTimelinePath ?? DEFAULT_MATTER_COCKPIT_UI_INPUTS.matterTimelinePath),
    matter_task_board_path: path.resolve(options.matterTaskBoardPath ?? DEFAULT_MATTER_COCKPIT_UI_INPUTS.matterTaskBoardPath),
    matter_document_index_path: path.resolve(options.matterDocumentIndexPath ?? DEFAULT_MATTER_COCKPIT_UI_INPUTS.matterDocumentIndexPath),
    evidence_viewer_ui_path: path.resolve(options.evidenceViewerUiPath ?? DEFAULT_MATTER_COCKPIT_UI_INPUTS.evidenceViewerUiPath),
    approval_queue_ui_path: path.resolve(options.approvalQueueUiPath ?? DEFAULT_MATTER_COCKPIT_UI_INPUTS.approvalQueueUiPath),
    run_ledger_viewer_path: path.resolve(options.runLedgerViewerPath ?? DEFAULT_MATTER_COCKPIT_UI_INPUTS.runLedgerViewerPath),
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function mapBy(items, key) {
  return new Map(items.filter((item) => item?.[key] != null).map((item) => [item[key], item]));
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = item?.[key] ?? "unknown";
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
}

function by(key) {
  return (left, right) => String(left?.[key] ?? "").localeCompare(String(right?.[key] ?? ""));
}

function byTimeThenId(timeKey, idKey) {
  return (left, right) => {
    const timeCompare = String(left?.[timeKey] ?? "").localeCompare(String(right?.[timeKey] ?? ""));
    if (timeCompare !== 0) return timeCompare;
    return String(left?.[idKey] ?? "").localeCompare(String(right?.[idKey] ?? ""));
  };
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

function slugify(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function snakeCase(value) {
  return String(value).replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`).replace(/^_/, "");
}

function dateStamp(isoString) {
  return isoString.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseArgs(argv) {
  const parsed = { outDir: DEFAULT_MATTER_COCKPIT_UI_OUT_DIR };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--matter-cockpit") parsed.matterCockpitPath = argv[++index];
    else if (arg === "--matter-os-profile") parsed.matterOsProfilePath = argv[++index];
    else if (arg === "--matter-timeline") parsed.matterTimelinePath = argv[++index];
    else if (arg === "--matter-task-board") parsed.matterTaskBoardPath = argv[++index];
    else if (arg === "--matter-document-index") parsed.matterDocumentIndexPath = argv[++index];
    else if (arg === "--evidence-viewer-ui") parsed.evidenceViewerUiPath = argv[++index];
    else if (arg === "--approval-queue-ui") parsed.approvalQueueUiPath = argv[++index];
    else if (arg === "--run-ledger-viewer") parsed.runLedgerViewerPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/matter-cockpit-ui.mjs [options]

Options:
  --check                         Fail if validation checks fail.
  --matter-cockpit <path>         matter-cockpit.json path.
  --matter-os-profile <path>      matter-os-profile.json path.
  --matter-timeline <path>        matter-timeline.json path.
  --matter-task-board <path>      matter-task-board.json path.
  --matter-document-index <path>  matter-document-index.json path.
  --evidence-viewer-ui <path>     evidence-viewer-ui.json path.
  --approval-queue-ui <path>      approval-queue-ui.json path.
  --run-ledger-viewer <path>      run-ledger-viewer.json path.
  --out-dir <folder>              Output directory.
  --run-at <iso>                  Deterministic generated_at timestamp.
  -h, --help                      Show this help.
`);
}

export async function runMatterCockpitUiCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  const result = await runMatterCockpitUi(args);
  console.log(`Matter Cockpit UI validated at ${result.output_dir}`);
  console.log(`Status: ${result.summary.matter_cockpit_ui_status}`);
  console.log(`Profile cards: ${result.summary.profile_card_count}`);
  console.log(`Timeline rows: ${result.summary.timeline_row_count}`);
  console.log(`Task rows: ${result.summary.task_row_count}`);
  console.log(`Document rows: ${result.summary.document_row_count}`);
  console.log(`Evidence rows: ${result.summary.evidence_row_count}`);
  console.log(`Approval rows: ${result.summary.approval_row_count}`);
  console.log(`Validation errors: ${result.summary.validation_error_count}`);
}
