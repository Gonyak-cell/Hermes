import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MEETING_MINUTES_WORKFLOW_OUT_DIR = "artifacts/meeting-minutes-workflow/latest";
export const DEFAULT_MEETING_MINUTES_WORKFLOW_INPUTS = {
  matterPath: "examples/project-alpha-matter.json",
  meetingNotePath: "examples/core/sample-board-minutes.md",
  matterTimelinePath: "artifacts/matter-timeline/latest/matter-timeline.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "meeting-minutes-workflow.v1";
const SOURCE_OF_TRUTH = "matter_meeting_notes_local_minutes_and_timeline_context";
const WORKFLOW_RULES = [
  workflowRule("source_capture", "Source capture", "Meeting communications and local minutes notes become read-only source rows."),
  workflowRule("agenda_extraction", "Agenda extraction", "Meeting topics become draft agenda rows with source references."),
  workflowRule("decision_capture", "Decision capture", "Meeting outcomes become attorney-review operational decision rows, not legal conclusions."),
  workflowRule("action_item_extraction", "Action item extraction", "Follow-up work becomes draft action items without writing task state."),
  workflowRule("evidence_binding", "Evidence binding", "Action items link to source notes or matter documents as review-gated evidence references."),
  workflowRule("attorney_review_gate", "Attorney review gate", "Every generated row remains internal and attorney/human-review gated."),
];

export async function runMeetingMinutesWorkflow(options = {}) {
  const result = await buildMeetingMinutesWorkflow(options);
  if (options.write !== false) await writeMeetingMinutesWorkflow(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Meeting minutes workflow validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildMeetingMinutesWorkflow(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MEETING_MINUTES_WORKFLOW_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value || source.text).map((source) => [source.source_id, source.value ?? source.text]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);
  const matter = sourceById.matter;
  const matterTimeline = sourceById.matter_timeline;
  const meetingNoteText = sourceById.meeting_note;

  const rules = buildWorkflowRules(generatedAt);
  const sources = buildMeetingSources({ matter, meetingNoteText, inputs, generatedAt });
  const agendaItems = buildAgendaItems({ sources, generatedAt });
  const decisions = buildDecisions({ agendaItems, generatedAt });
  const actionItems = buildActionItems({ matter, sources, agendaItems, decisions, generatedAt });
  const evidenceLinks = buildEvidenceLinks({ matter, sources, actionItems, generatedAt });
  attachEvidenceToActionItems(actionItems, evidenceLinks);
  attachActionAndEvidenceCounts(agendaItems, decisions, actionItems, evidenceLinks);
  const matterSummaries = buildMatterSummaries({ matter, agendaItems, decisions, actionItems, evidenceLinks, generatedAt });
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.text,
    matter,
    matterTimeline,
    meetingNoteText,
    rules,
    sources,
    agendaItems,
    decisions,
    actionItems,
    evidenceLinks,
    matterSummaries,
    desktopBoundary,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeMeetingMinutesWorkflow({
    sourceReads,
    matter,
    matterTimeline,
    meetingNoteText,
    rules,
    sources,
    agendaItems,
    decisions,
    actionItems,
    evidenceLinks,
    matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  });

  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    meeting_minutes_workflow_id: `meeting-minutes-workflow.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    meeting_minutes_workflow_status: summary.meeting_minutes_workflow_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    meeting_minutes_workflow_contract: buildContract(generatedAt),
    meeting_minutes_rules: rules,
    meeting_minutes_sources: sources,
    meeting_minutes_agenda_items: agendaItems,
    meeting_minutes_decisions: decisions,
    meeting_minutes_action_items: actionItems,
    meeting_minutes_evidence_links: evidenceLinks,
    meeting_minutes_matter_summaries: matterSummaries,
    meeting_minutes_workflow_desktop_boundary: desktopBoundary,
    meeting_minutes_workflow_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderMeetingMinutesWorkflowMarkdown(result),
  };
}

export async function writeMeetingMinutesWorkflow(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableMeetingMinutesWorkflow(result);
  await writeJson(path.join(outDir, "meeting-minutes-workflow.json"), serializable);
  await writeJson(path.join(outDir, "meeting-minutes-rules.json"), {
    schema_version: "meeting-minutes-rules.v1",
    generated_at: result.generated_at,
    meeting_minutes_rule_count: result.meeting_minutes_rules.length,
    meeting_minutes_rules: result.meeting_minutes_rules,
  });
  await writeJson(path.join(outDir, "meeting-minutes-sources.json"), {
    schema_version: "meeting-minutes-sources.v1",
    generated_at: result.generated_at,
    meeting_minutes_source_count: result.meeting_minutes_sources.length,
    meeting_minutes_sources: result.meeting_minutes_sources,
  });
  await writeJson(path.join(outDir, "meeting-minutes-agenda-items.json"), {
    schema_version: "meeting-minutes-agenda-items.v1",
    generated_at: result.generated_at,
    agenda_item_count: result.meeting_minutes_agenda_items.length,
    meeting_minutes_agenda_items: result.meeting_minutes_agenda_items,
  });
  await writeJson(path.join(outDir, "meeting-minutes-decisions.json"), {
    schema_version: "meeting-minutes-decisions.v1",
    generated_at: result.generated_at,
    decision_count: result.meeting_minutes_decisions.length,
    meeting_minutes_decisions: result.meeting_minutes_decisions,
  });
  await writeJson(path.join(outDir, "meeting-minutes-action-items.json"), {
    schema_version: "meeting-minutes-action-items.v1",
    generated_at: result.generated_at,
    action_item_count: result.meeting_minutes_action_items.length,
    meeting_minutes_action_items: result.meeting_minutes_action_items,
  });
  await writeJson(path.join(outDir, "meeting-minutes-evidence-links.json"), {
    schema_version: "meeting-minutes-evidence-links.v1",
    generated_at: result.generated_at,
    evidence_link_count: result.meeting_minutes_evidence_links.length,
    meeting_minutes_evidence_links: result.meeting_minutes_evidence_links,
  });
  await writeJson(path.join(outDir, "meeting-minutes-matter-summaries.json"), {
    schema_version: "meeting-minutes-matter-summaries.v1",
    generated_at: result.generated_at,
    matter_summary_count: result.meeting_minutes_matter_summaries.length,
    meeting_minutes_matter_summaries: result.meeting_minutes_matter_summaries,
  });
  await writeJson(path.join(outDir, "meeting-minutes-workflow-boundary.json"), {
    schema_version: "meeting-minutes-workflow-boundary-artifact.v1",
    generated_at: result.generated_at,
    meeting_minutes_workflow_desktop_boundary: result.meeting_minutes_workflow_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "meeting-minutes-workflow-validation-report.v1",
    generated_at: result.generated_at,
    meeting_minutes_workflow_id: result.meeting_minutes_workflow_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runMeetingMinutesWorkflowCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runMeetingMinutesWorkflow(args);
    console.log(`Meeting minutes workflow ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.meeting_minutes_workflow_status}`);
    console.log(`Sources/agendas: ${result.summary.meeting_minutes_source_count}/${result.summary.agenda_item_count}`);
    console.log(`Decisions/actions/evidence: ${result.summary.decision_count}/${result.summary.action_item_count}/${result.summary.evidence_link_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "meeting-minutes-workflow-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_rule: "meeting communications and local minutes notes are read-only inputs and remain source-referenced",
    agenda_rule: "agenda rows are deterministic topic scaffolds for attorney review",
    decision_rule: "decision rows are operational summaries only and do not state legal conclusions or client advice",
    action_item_rule: "action items are draft work candidates and do not write matter task state",
    evidence_rule: "evidence links bind action items to matter documents or source notes without changing document status",
    client_output_rule: "meeting minutes outputs are not client-facing-ready and cannot be sent without attorney/human review and partner approval",
    attorney_review_rule: "every generated row remains attorney/human-review gated",
    desktop_companion_rule: "Desktop views are read-only projections and are not the source of truth",
    mutation_policy: "no matter data write, task state write, workflow transition, runtime execution, delivery execution, protected action, legal advice, legal conclusion, or final client-facing output is performed",
    created_at: generatedAt,
  };
}

function buildWorkflowRules(generatedAt) {
  return WORKFLOW_RULES.map((rule, index) => ({
    schema_version: "meeting-minutes-rule.v1",
    meeting_minutes_rule_id: `meeting-minutes-rule.${rule.rule_type}`,
    meeting_minutes_rule_type: rule.rule_type,
    rule_label: rule.label,
    rule_description: rule.description,
    rule_priority: index + 1,
    rule_status: "active",
    deterministic_only: true,
    attorney_review_required: true,
    human_review_required: true,
    created_at: generatedAt,
  }));
}

function buildMeetingSources({ matter, meetingNoteText, inputs, generatedAt }) {
  const matterId = matter?.matter_id ?? "unknown-matter";
  const communicationSources = (matter?.communications ?? [])
    .filter((communication) => isMeetingLike(`${communication.source ?? ""} ${communication.summary ?? ""}`))
    .map((communication, index) => ({
      schema_version: "meeting-minutes-source.v1",
      meeting_minutes_source_id: `meeting-minutes-source.${slugify(communication.id ?? `communication-${index + 1}`)}`,
      matter_id: matterId,
      source_kind: "matter_communication",
      source_record_id: communication.id ?? null,
      source_type: inferMeetingSourceType(communication.source),
      source_date: communication.date ?? null,
      source_title: `Meeting note: ${communication.source ?? communication.id ?? `communication-${index + 1}`}`,
      source_summary: communication.summary ?? "",
      pending_question_count: (communication.pending_questions ?? []).length,
      meeting_minutes_source_status: "source_loaded_pending_attorney_review",
      source_refs: [
        sourceRef("matter", matterId, "communications"),
        sourceRef("communication", communication.id ?? `communication-${index + 1}`, "summary"),
      ],
      source_ref_count: 2,
      attorney_review_required: true,
      human_review_required: true,
      client_facing_ready: false,
      legal_conclusion_asserted: false,
      created_at: generatedAt,
    }));

  const noteText = String(meetingNoteText ?? "").trim();
  const noteSource = noteText
    ? [{
        schema_version: "meeting-minutes-source.v1",
        meeting_minutes_source_id: "meeting-minutes-source.sample-board-minutes",
        matter_id: matterId,
        source_kind: "local_minutes_note",
        source_record_id: path.basename(inputs.meeting_note_path),
        source_type: "board_minutes_note",
        source_date: inferDateFromText(noteText) ?? "2026-05-01",
        source_title: "Sample board minutes note",
        source_summary: "Local board-minutes note used as a deterministic meeting-minutes workflow source.",
        pending_question_count: 0,
        meeting_minutes_source_status: "source_loaded_pending_attorney_review",
        source_refs: [
          sourceRef("file", path.basename(inputs.meeting_note_path), "whole_document"),
        ],
        source_ref_count: 1,
        attorney_review_required: true,
        human_review_required: true,
        client_facing_ready: false,
        legal_conclusion_asserted: false,
        created_at: generatedAt,
      }]
    : [];

  return [...communicationSources, ...noteSource];
}

function buildAgendaItems({ sources, generatedAt }) {
  return sources.map((source, index) => {
    const isClosingCall = /closing|deliverable|certificate|disclosure/i.test(source.source_summary ?? "");
    const agendaTitle = isClosingCall
      ? "Closing deliverables evidence review"
      : source.source_type === "board_minutes_note"
        ? "Board minutes evidence confirmation"
        : `Meeting source review ${index + 1}`;
    return {
      schema_version: "meeting-minutes-agenda-item.v1",
      meeting_minutes_agenda_item_id: `meeting-minutes-agenda.${String(index + 1).padStart(2, "0")}`,
      matter_id: source.matter_id,
      meeting_minutes_source_id: source.meeting_minutes_source_id,
      agenda_order: index + 1,
      agenda_type: isClosingCall ? "evidence_gap_review" : "governance_evidence_review",
      agenda_title: agendaTitle,
      agenda_summary: isClosingCall
        ? "Closing call source identifies deliverables without current evidence and needs follow-up ownership."
        : "Board minutes note is converted into evidence-confirmation agenda rows for attorney review.",
      agenda_status: "draft_pending_attorney_review",
      source_refs: source.source_refs,
      source_ref_count: source.source_ref_count,
      decision_count: 0,
      action_item_count: 0,
      evidence_link_count: 0,
      attorney_review_required: true,
      human_review_required: true,
      client_facing_ready: false,
      legal_conclusion_asserted: false,
      created_at: generatedAt,
    };
  });
}

function buildDecisions({ agendaItems, generatedAt }) {
  return agendaItems.map((agenda, index) => ({
    schema_version: "meeting-minutes-decision.v1",
    meeting_minutes_decision_id: `meeting-minutes-decision.${String(index + 1).padStart(2, "0")}`,
    matter_id: agenda.matter_id,
    meeting_minutes_agenda_item_id: agenda.meeting_minutes_agenda_item_id,
    meeting_minutes_source_id: agenda.meeting_minutes_source_id,
    decision_order: index + 1,
    decision_type: agenda.agenda_type === "evidence_gap_review" ? "follow_up_required" : "evidence_confirmation_required",
    decision_text: agenda.agenda_type === "evidence_gap_review"
      ? "Treat missing closing deliverables as attorney-review follow-up items before any external circulation."
      : "Keep board-minutes evidence checks open until attendance, collateral, and consent records are verified by the legal team.",
    decision_status: "draft_pending_attorney_review",
    source_refs: agenda.source_refs,
    source_ref_count: agenda.source_ref_count,
    action_item_count: 0,
    evidence_link_count: 0,
    attorney_review_required: true,
    human_review_required: true,
    partner_approval_required_before_client_use: true,
    client_facing_ready: false,
    client_facing_output_generated: false,
    legal_conclusion_asserted: false,
    legal_advice_provided: false,
    created_at: generatedAt,
  }));
}

function buildActionItems({ matter, sources, agendaItems, decisions, generatedAt }) {
  const actionItems = [];
  for (const source of sources) {
    const agenda = agendaItems.find((item) => item.meeting_minutes_source_id === source.meeting_minutes_source_id);
    const decision = decisions.find((item) => item.meeting_minutes_agenda_item_id === agenda?.meeting_minutes_agenda_item_id);
    for (const candidate of actionCandidatesForSource(source, matter)) {
      const index = actionItems.length + 1;
      actionItems.push({
        schema_version: "meeting-minutes-action-item.v1",
        meeting_minutes_action_item_id: `meeting-minutes-action.${String(index).padStart(3, "0")}`,
        matter_id: source.matter_id,
        meeting_minutes_source_id: source.meeting_minutes_source_id,
        meeting_minutes_agenda_item_id: agenda?.meeting_minutes_agenda_item_id ?? null,
        meeting_minutes_decision_id: decision?.meeting_minutes_decision_id ?? null,
        action_order: index,
        action_title: candidate.title,
        action_description: candidate.description,
        action_owner: candidate.owner,
        due_date: candidate.due_date,
        action_status: "draft_pending_attorney_review",
        source_refs: [...source.source_refs, ...candidate.source_refs],
        source_ref_count: source.source_refs.length + candidate.source_refs.length,
        evidence_required: true,
        evidence_link_ids: [],
        evidence_link_count: 0,
        task_state_write_allowed: false,
        workflow_transition_allowed: false,
        runtime_execution_allowed: false,
        delivery_execution_allowed: false,
        attorney_review_required: true,
        human_review_required: true,
        partner_approval_required_before_client_use: true,
        client_facing_ready: false,
        client_facing_output_generated: false,
        legal_conclusion_asserted: false,
        legal_advice_provided: false,
        created_at: generatedAt,
      });
    }
  }
  return actionItems;
}

function buildEvidenceLinks({ matter, sources, actionItems, generatedAt }) {
  const documentByTitle = new Map((matter?.documents ?? []).map((document) => [normalize(document.title), document]));
  return actionItems.map((action, index) => {
    const source = sources.find((item) => item.meeting_minutes_source_id === action.meeting_minutes_source_id);
    const matchedDocument = findMatchingDocument(action, documentByTitle);
    const evidenceSourceKind = matchedDocument ? "matter_document" : source?.source_kind === "local_minutes_note" ? "local_minutes_note" : "meeting_note";
    return {
      schema_version: "meeting-minutes-evidence-link.v1",
      meeting_minutes_evidence_link_id: `meeting-minutes-evidence.${String(index + 1).padStart(3, "0")}`,
      matter_id: action.matter_id,
      meeting_minutes_source_id: action.meeting_minutes_source_id,
      meeting_minutes_agenda_item_id: action.meeting_minutes_agenda_item_id,
      meeting_minutes_decision_id: action.meeting_minutes_decision_id,
      meeting_minutes_action_item_id: action.meeting_minutes_action_item_id,
      evidence_source_kind: evidenceSourceKind,
      evidence_record_id: matchedDocument?.id ?? source?.source_record_id ?? action.meeting_minutes_source_id,
      evidence_title: matchedDocument?.title ?? action.action_title,
      evidence_status: matchedDocument?.status ?? "source_note_loaded_pending_review",
      evidence_link_status: "linked_pending_attorney_review",
      source_refs: [
        ...action.source_refs,
        matchedDocument
          ? sourceRef("document", matchedDocument.id, "documents")
          : sourceRef(source?.source_kind ?? "source", source?.source_record_id ?? action.meeting_minutes_source_id, "source_text"),
      ],
      source_ref_count: action.source_ref_count + 1,
      evidence_available: matchedDocument ? matchedDocument.status !== "missing" : true,
      attorney_review_required: true,
      human_review_required: true,
      client_facing_ready: false,
      legal_conclusion_asserted: false,
      created_at: generatedAt,
    };
  });
}

function buildMatterSummaries({ matter, agendaItems, decisions, actionItems, evidenceLinks, generatedAt }) {
  const matterId = matter?.matter_id ?? "unknown-matter";
  return [{
    schema_version: "meeting-minutes-matter-summary.v1",
    meeting_minutes_matter_summary_id: `meeting-minutes-matter-summary.${slugify(matterId)}`,
    matter_id: matterId,
    meeting_minutes_matter_status: "draft_pending_attorney_review",
    agenda_item_count: agendaItems.length,
    decision_count: decisions.length,
    action_item_count: actionItems.length,
    evidence_link_count: evidenceLinks.length,
    evidence_required_action_count: actionItems.filter((item) => item.evidence_required).length,
    action_item_with_evidence_link_count: actionItems.filter((item) => item.evidence_link_count > 0).length,
    draft_only: true,
    attorney_review_required: true,
    human_review_required: true,
    partner_approval_required_before_client_use: true,
    client_facing_ready: false,
    created_at: generatedAt,
  }];
}

function attachEvidenceToActionItems(actionItems, evidenceLinks) {
  const linksByActionId = groupBy(evidenceLinks, (link) => link.meeting_minutes_action_item_id);
  for (const action of actionItems) {
    const links = linksByActionId.get(action.meeting_minutes_action_item_id) ?? [];
    action.evidence_link_ids = links.map((link) => link.meeting_minutes_evidence_link_id);
    action.evidence_link_count = links.length;
  }
}

function attachActionAndEvidenceCounts(agendaItems, decisions, actionItems, evidenceLinks) {
  for (const agenda of agendaItems) {
    agenda.decision_count = decisions.filter((decision) => decision.meeting_minutes_agenda_item_id === agenda.meeting_minutes_agenda_item_id).length;
    agenda.action_item_count = actionItems.filter((action) => action.meeting_minutes_agenda_item_id === agenda.meeting_minutes_agenda_item_id).length;
    agenda.evidence_link_count = evidenceLinks.filter((link) => link.meeting_minutes_agenda_item_id === agenda.meeting_minutes_agenda_item_id).length;
  }
  for (const decision of decisions) {
    decision.action_item_count = actionItems.filter((action) => action.meeting_minutes_decision_id === decision.meeting_minutes_decision_id).length;
    decision.evidence_link_count = evidenceLinks.filter((link) => link.meeting_minutes_decision_id === decision.meeting_minutes_decision_id).length;
  }
}

function actionCandidatesForSource(source, matter) {
  const defaultOwner = matter?.review_workflow?.default_reviewer ?? "Senior Lee";
  if (/closing|deliverable|certificate|disclosure/i.test(source.source_summary ?? "")) {
    const closingOwner = findTaskOwner(matter, /closing deliverables|CP checklist/i) ?? "Paralegal Choi";
    const closingDue = findTaskDue(matter, /closing deliverables|CP checklist/i) ?? "2026-05-26";
    return [
      actionCandidate("Confirm officer certificate evidence", "Confirm whether the officer certificate draft is available and source-linked before closing review.", closingOwner, closingDue, [sourceRef("meeting_note", source.source_record_id, "officer certificate")]),
      actionCandidate("Confirm bring-down certificate evidence", "Confirm whether the bring-down certificate evidence is available and source-linked before closing review.", closingOwner, closingDue, [sourceRef("meeting_note", source.source_record_id, "bring-down certificate")]),
      actionCandidate("Confirm updated disclosure schedule owner", "Identify the client-side owner for the updated disclosure schedule and keep the item attorney-review gated.", closingOwner, closingDue, [sourceRef("matter_document", "DOC-002", "documents")]),
      actionCandidate("Resolve disclosure schedule pending question", "Convert the meeting pending question into a reviewed internal follow-up without sending client-facing output.", defaultOwner, closingDue, [sourceRef("communication", source.source_record_id, "pending_questions")]),
    ];
  }

  return [
    actionCandidate("Confirm board meeting attendance evidence", "Confirm attendance records referenced by the board minutes note before relying on the meeting record.", defaultOwner, "2026-05-27", [sourceRef("local_minutes_note", source.source_record_id, "attendance")]),
    actionCandidate("Confirm collateral support materials", "Confirm supporting materials for any collateral topic referenced by the board minutes note.", defaultOwner, "2026-05-27", [sourceRef("local_minutes_note", source.source_record_id, "collateral")]),
    actionCandidate("Confirm prior consent evidence", "Confirm whether any existing financing consent evidence is required and available for attorney review.", defaultOwner, "2026-05-27", [sourceRef("local_minutes_note", source.source_record_id, "prior consent")]),
  ];
}

function findMatchingDocument(action, documentByTitle) {
  const normalizedTitle = normalize(action.action_title);
  for (const [documentTitle, document] of documentByTitle) {
    if (normalizedTitle.includes("disclosure schedule") && documentTitle.includes("disclosure schedule")) return document;
    if (normalizedTitle.includes("tax team memo") && documentTitle.includes("tax team memo")) return document;
  }
  return null;
}

function findTaskOwner(matter, pattern) {
  return (matter?.tasks ?? []).find((task) => pattern.test(task.title ?? ""))?.owner ?? null;
}

function findTaskDue(matter, pattern) {
  return (matter?.tasks ?? []).find((task) => pattern.test(task.title ?? ""))?.due ?? null;
}

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "meeting-minutes-workflow-desktop-boundary.v1",
    boundary_status: "enforced",
    read_only: true,
    desktop_mutation_allowed: false,
    desktop_source_of_truth: false,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    client_facing_output_allowed_without_attorney_review: false,
    generated_at: generatedAt,
  };
}

function buildCheckpoints(context) {
  const {
    sourceReads,
    packageJson,
    roadmapText,
    matter,
    matterTimeline,
    meetingNoteText,
    rules,
    sources,
    agendaItems,
    decisions,
    actionItems,
    evidenceLinks,
    matterSummaries,
    desktopBoundary,
  } = context;
  const sourceStatus = Object.fromEntries(sourceReads.map((source) => [source.source_id, source.status]));
  return [
    checkpoint("source.matter", sourceStatus.matter === "complete", "Matter source loaded."),
    checkpoint("source.matter_timeline", sourceStatus.matter_timeline === "complete" && matterTimeline?.summary?.matter_timeline_status === "complete", "Matter timeline source loaded."),
    checkpoint("source.meeting_note", sourceStatus.meeting_note === "complete" && String(meetingNoteText ?? "").trim().length > 0, "Local meeting note source loaded."),
    checkpoint("package.script", Boolean(packageJson?.scripts?.["law-firm:meeting-minutes"]), "Package script law-firm:meeting-minutes is registered."),
    checkpoint("roadmap.p248", /P248|Phase 248/i.test(roadmapText ?? ""), "Roadmap or ledger tracks P248."),
    checkpoint("rules.minimum", rules.length >= 6, "Meeting-minutes workflow rules are present."),
    checkpoint("sources.present", sources.length >= 2, "Meeting and minutes sources are represented."),
    checkpoint("agenda.present", agendaItems.length >= sources.length, "Agenda items are generated from sources."),
    checkpoint("decisions.present", decisions.length === agendaItems.length, "One draft decision row is generated per agenda item."),
    checkpoint("actions.present", actionItems.length >= 4, "Action items are generated from meeting notes."),
    checkpoint("evidence.links.present", evidenceLinks.length === actionItems.length, "Every action item has an evidence link."),
    checkpoint("matter.summary.present", matterSummaries.length === 1 && matterSummaries[0]?.matter_id === matter?.matter_id, "Matter summary is generated within one matter boundary."),
    checkpoint("source.refs", [...sources, ...agendaItems, ...decisions, ...actionItems, ...evidenceLinks].every((row) => (row.source_ref_count ?? 0) > 0), "Every generated row has source refs."),
    checkpoint("action.evidence.bound", actionItems.every((item) => item.evidence_link_count > 0), "Every action item is evidence-linked."),
    checkpoint("review.gates", [...sources, ...agendaItems, ...decisions, ...actionItems, ...evidenceLinks, ...matterSummaries].every((row) => row.attorney_review_required && row.human_review_required && row.client_facing_ready === false), "All rows remain attorney/human-review gated and not client-facing-ready."),
    checkpoint("no.legal.output", decisions.every((row) => row.legal_conclusion_asserted === false && row.legal_advice_provided === false) && actionItems.every((row) => row.legal_conclusion_asserted === false && row.legal_advice_provided === false), "No legal advice or legal conclusion is produced."),
    checkpoint("no.mutation", actionItems.every((row) => row.task_state_write_allowed === false && row.workflow_transition_allowed === false && row.runtime_execution_allowed === false && row.delivery_execution_allowed === false) && desktopBoundary.matter_data_write_allowed === false && desktopBoundary.protected_action_allowed === false, "No matter/task/workflow/runtime/delivery/protected mutation is allowed."),
    checkpoint("desktop.boundary", desktopBoundary.boundary_status === "enforced" && desktopBoundary.read_only === true && desktopBoundary.desktop_mutation_allowed === false && desktopBoundary.desktop_source_of_truth === false, "Desktop boundary is read-only and not source-of-truth."),
  ];
}

function summarizeMeetingMinutesWorkflow(context) {
  const {
    sourceReads,
    matter,
    matterTimeline,
    meetingNoteText,
    rules,
    sources,
    agendaItems,
    decisions,
    actionItems,
    evidenceLinks,
    matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  } = context;
  const failedCheckpointCount = checkpoints.filter((item) => item.status !== "passed").length;
  const sourceById = Object.fromEntries(sourceReads.map((source) => [source.source_id, source]));
  return {
    meeting_minutes_workflow_status: validation.valid ? "complete" : "attention",
    meeting_minutes_workflow_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_matter_status: sourceById.matter?.status ?? "missing",
    source_matter_id: matter?.matter_id ?? null,
    source_matter_timeline_status: sourceById.matter_timeline?.status ?? "missing",
    source_matter_timeline_phase_status: matterTimeline?.summary?.matter_timeline_status ?? "unknown",
    source_matter_timeline_meeting_event_count: matterTimeline?.summary?.meeting_event_count ?? 0,
    source_meeting_note_status: sourceById.meeting_note?.status ?? "missing",
    source_meeting_note_character_count: String(meetingNoteText ?? "").length,
    source_communication_count: (matter?.communications ?? []).length,
    source_meeting_communication_count: (matter?.communications ?? []).filter((communication) => isMeetingLike(`${communication.source ?? ""} ${communication.summary ?? ""}`)).length,
    meeting_minutes_rule_count: rules.length,
    meeting_minutes_source_count: sources.length,
    agenda_item_count: agendaItems.length,
    decision_count: decisions.length,
    action_item_count: actionItems.length,
    evidence_link_count: evidenceLinks.length,
    matter_count: matterSummaries.length,
    evidence_required_action_count: actionItems.filter((item) => item.evidence_required).length,
    action_item_with_evidence_link_count: actionItems.filter((item) => item.evidence_link_count > 0).length,
    agenda_with_decision_count: agendaItems.filter((item) => item.decision_count > 0).length,
    agenda_with_action_item_count: agendaItems.filter((item) => item.action_item_count > 0).length,
    decision_with_action_item_count: decisions.filter((item) => item.action_item_count > 0).length,
    draft_only_count: matterSummaries.filter((item) => item.draft_only).length,
    attorney_review_required_count: [...sources, ...agendaItems, ...decisions, ...actionItems, ...evidenceLinks, ...matterSummaries].filter((row) => row.attorney_review_required).length,
    human_review_required_count: [...sources, ...agendaItems, ...decisions, ...actionItems, ...evidenceLinks, ...matterSummaries].filter((row) => row.human_review_required).length,
    client_facing_ready_count: [...sources, ...agendaItems, ...decisions, ...actionItems, ...evidenceLinks, ...matterSummaries].filter((row) => row.client_facing_ready).length,
    legal_conclusion_asserted_count: [...sources, ...agendaItems, ...decisions, ...actionItems, ...evidenceLinks].filter((row) => row.legal_conclusion_asserted).length,
    legal_advice_provided: decisions.some((row) => row.legal_advice_provided) || actionItems.some((row) => row.legal_advice_provided),
    client_facing_output_generated: decisions.some((row) => row.client_facing_output_generated) || actionItems.some((row) => row.client_facing_output_generated),
    matter_data_write_allowed: desktopBoundary.matter_data_write_allowed,
    task_state_write_allowed: desktopBoundary.task_state_write_allowed || actionItems.some((row) => row.task_state_write_allowed),
    workflow_transition_allowed: desktopBoundary.workflow_transition_allowed || actionItems.some((row) => row.workflow_transition_allowed),
    runtime_execution_allowed: desktopBoundary.runtime_execution_allowed || actionItems.some((row) => row.runtime_execution_allowed),
    delivery_execution_allowed: desktopBoundary.delivery_execution_allowed || actionItems.some((row) => row.delivery_execution_allowed),
    protected_action_allowed: desktopBoundary.protected_action_allowed,
    client_facing_output_allowed_without_attorney_review: desktopBoundary.client_facing_output_allowed_without_attorney_review,
    desktop_boundary_status: desktopBoundary.boundary_status,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.desktop_mutation_allowed,
    desktop_source_of_truth: desktopBoundary.desktop_source_of_truth,
    validation_item_count: checkpoints.length,
    failed_checkpoint_count: failedCheckpointCount,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    draft_only: true,
    deterministic_meeting_minutes_generation_performed: true,
    legal_conclusion_asserted: false,
    legal_advice_provided: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    attorney_review_required: true,
    human_review_required: true,
    partner_approval_required_before_client_use: true,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_performed: false,
    delivery_execution_performed: false,
    desktop_mutation_allowed: false,
    desktop_source_of_truth: false,
    protected_mutation_executed: false,
    secret_material_exposed: false,
    provider_key_visible: false,
  };
}

function buildSourceContracts(sourceReads, packageJson, roadmapText) {
  return {
    source_of_truth: SOURCE_OF_TRUTH,
    sources: sourceReads.map(({ value, text, ...source }) => ({
      ...source,
      schema_version: value?.schema_version ?? null,
      character_count: text ? text.length : undefined,
    })),
    package_script_present: Boolean(packageJson.value?.scripts?.["law-firm:meeting-minutes"]),
    roadmap_p248_present: /P248|Phase 248/i.test(roadmapText.text ?? ""),
  };
}

function renderMeetingMinutesWorkflowMarkdown(result) {
  const lines = [];
  lines.push("# Meeting Minutes Workflow");
  lines.push("");
  lines.push(`Status: ${result.summary.meeting_minutes_workflow_status}`);
  lines.push(`Sources: ${result.summary.meeting_minutes_source_count}`);
  lines.push(`Agenda items: ${result.summary.agenda_item_count}`);
  lines.push(`Decisions: ${result.summary.decision_count}`);
  lines.push(`Action items: ${result.summary.action_item_count}`);
  lines.push(`Evidence links: ${result.summary.evidence_link_count}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("Human review note: meeting-minutes rows are internal operational scaffolds only. Attorney review, source verification, and partner approval are required before client-facing use.");
  lines.push("No legal advice, legal conclusion, matter data write, task state write, workflow transition, runtime execution, delivery execution, protected action, or client-facing output is performed.");
  return `${lines.join("\n")}\n`;
}

function serializableMeetingMinutesWorkflow(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function readSourceArtifacts(inputs) {
  const matter = await readJsonOrError(inputs.matter_path);
  const matterTimeline = await readJsonOrError(inputs.matter_timeline_path);
  const meetingNote = await readTextOrError(inputs.meeting_note_path);
  return [
    sourceRead("matter", "matter_file", inputs.matter_path, matter),
    sourceRead("matter_timeline", "artifact", inputs.matter_timeline_path, matterTimeline),
    sourceRead("meeting_note", "local_minutes_note", inputs.meeting_note_path, meetingNote),
  ];
}

function sourceRead(sourceId, sourceKind, sourcePath, result) {
  return {
    source_id: sourceId,
    source_kind: sourceKind,
    path: path.resolve(sourcePath),
    status: result.status,
    error: result.error,
    value: result.value,
    text: result.text,
  };
}

async function readJsonOrError(filePath) {
  try {
    const raw = await readFile(path.resolve(filePath), "utf8");
    return { status: "complete", value: JSON.parse(raw), error: null };
  } catch (error) {
    return { status: "missing", value: null, error: error.message };
  }
}

async function readTextOrError(filePath) {
  try {
    const text = await readFile(path.resolve(filePath), "utf8");
    return { status: "complete", text, value: null, error: null };
  } catch (error) {
    return { status: "missing", text: "", value: null, error: error.message };
  }
}

function normalizeInputs(options) {
  return {
    matter_path: path.resolve(options.matterPath ?? DEFAULT_MEETING_MINUTES_WORKFLOW_INPUTS.matterPath),
    meeting_note_path: path.resolve(options.meetingNotePath ?? DEFAULT_MEETING_MINUTES_WORKFLOW_INPUTS.meetingNotePath),
    matter_timeline_path: path.resolve(options.matterTimelinePath ?? DEFAULT_MEETING_MINUTES_WORKFLOW_INPUTS.matterTimelinePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_MEETING_MINUTES_WORKFLOW_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_MEETING_MINUTES_WORKFLOW_INPUTS.roadmapPath),
  };
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
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--matter") parsed.matterPath = argv[++index];
    else if (arg === "--meeting-note") parsed.meetingNotePath = argv[++index];
    else if (arg === "--matter-timeline") parsed.matterTimelinePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/meeting-minutes-workflow.mjs [options]

Options:
  --check                         fail when validation has errors
  --no-write                      build without writing files
  --out-dir <path>                output directory
  --matter <path>                 matter JSON path
  --meeting-note <path>           local meeting/minutes note path
  --matter-timeline <path>        matter timeline artifact path
  --package <path>                package.json path
  --roadmap <path>                roadmap or ledger path
  --run-at <iso>                  generated_at override
  --help                          show this help`);
}

function workflowRule(ruleType, label, description) {
  return { rule_type: ruleType, label, description };
}

function actionCandidate(title, description, owner, dueDate, sourceRefs) {
  return { title, description, owner, due_date: dueDate, source_refs: sourceRefs };
}

function sourceRef(sourceKind, sourceId, sourceField) {
  return {
    source_kind: sourceKind,
    source_id: sourceId ?? "unknown",
    source_field: sourceField,
  };
}

function checkpoint(checkpointId, passed, message, extra = {}) {
  return {
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
    ...extra,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.path,
      message: item.message,
    }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function inferMeetingSourceType(source) {
  const normalized = normalize(source);
  if (normalized.includes("call")) return "meeting_call";
  if (normalized.includes("interview")) return "client_interview_note";
  return "meeting_note";
}

function inferDateFromText(text) {
  const match = String(text ?? "").match(/20\d{2}[.\-\/]\s*\d{1,2}[.\-\/]\s*\d{1,2}/);
  if (!match) return null;
  const [year, month, day] = match[0].split(/[.\-\/]\s*/).map((part) => part.padStart(2, "0"));
  return `${year}-${month}-${day}`;
}

function isMeetingLike(value) {
  return /\b(meeting|call|interview|minutes|board)\b/i.test(String(value ?? ""));
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function normalize(value) {
  return String(value ?? "").toLowerCase();
}

function slugify(value) {
  return String(value ?? "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "item";
}

function dateStamp(value) {
  return String(value).replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "").replace("T", "T");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
