import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MATTER_TIMELINE_OUT_DIR = "artifacts/matter-timeline/latest";
export const DEFAULT_MATTER_TIMELINE_INPUTS = {
  matterOsProfilePath: "artifacts/matter-os-profile/latest/matter-os-profile.json",
  matterFiles: [
    "examples/project-alpha-matter.json",
    "examples/project-beta-litigation-matter.json",
  ],
  outputCatalogPath: "artifacts/output-catalog/latest/output-catalog.json",
  deliveryQueuePath: "artifacts/delivery-queue/latest/protected-delivery-queue.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "matter-timeline.v1";
const SOURCE_OF_TRUTH = "matter_files_and_review_artifacts";
const EVENT_TYPES = ["meeting", "received", "submission", "deadline"];
const EVENT_TYPE_RANK = new Map(EVENT_TYPES.map((eventType, index) => [eventType, index]));

export async function runMatterTimeline(options = {}) {
  const result = await buildMatterTimeline(options);
  if (options.write !== false) await writeMatterTimeline(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Matter timeline validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildMatterTimeline(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MATTER_TIMELINE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const matterFileReads = sourceReads.filter((source) => source.source_kind === "matter_file");
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const matterOsProfile = sourceById.matter_os_profile;
  const outputCatalog = sourceById.output_catalog;
  const deliveryQueue = sourceById.delivery_queue;
  const profileByMatter = buildProfileByMatter(matterOsProfile);
  const deliveryByArtifactId = buildDeliveryByArtifactId(deliveryQueue);
  const events = buildMatterTimelineEvents({
    generatedAt,
    matterFileReads,
    outputCatalog,
    deliveryByArtifactId,
  });
  const matterTimelines = buildMatterTimelines(events, profileByMatter, generatedAt);
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    matterOsProfile,
    outputCatalog,
    deliveryQueue,
    matterFileReads,
    events,
    matterTimelines,
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
  const summary = summarizeMatterTimeline({
    matterOsProfile,
    outputCatalog,
    deliveryQueue,
    matterFileReads,
    events,
    matterTimelines,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    matter_timeline_id: `matter-timeline.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    matter_timeline_status: summary.matter_timeline_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    matter_timeline_contract: buildContract(generatedAt),
    matter_timeline_events: events,
    matter_timelines: matterTimelines,
    matter_timeline_desktop_boundary: desktopBoundary,
    matter_timeline_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderMatterTimelineMarkdown(result),
  };
}

export async function writeMatterTimeline(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableMatterTimeline(result);
  await writeJson(path.join(outDir, "matter-timeline.json"), serializable);
  await writeJson(path.join(outDir, "matter-timeline-events.json"), {
    schema_version: "matter-timeline-events.v1",
    generated_at: result.generated_at,
    timeline_event_count: result.matter_timeline_events.length,
    matter_timeline_events: result.matter_timeline_events,
  });
  await writeJson(path.join(outDir, "matter-timeline-matters.json"), {
    schema_version: "matter-timeline-matters.v1",
    generated_at: result.generated_at,
    matter_timeline_count: result.matter_timelines.length,
    matter_timelines: result.matter_timelines,
  });
  await writeJson(path.join(outDir, "matter-timeline-boundary.json"), {
    schema_version: "matter-timeline-boundary-artifact.v1",
    generated_at: result.generated_at,
    matter_timeline_desktop_boundary: result.matter_timeline_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "matter-timeline-validation-report.v1",
    generated_at: result.generated_at,
    matter_timeline_id: result.matter_timeline_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runMatterTimelineCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runMatterTimeline(args);
    console.log(`Matter timeline ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.matter_timeline_status}`);
    console.log(`Matters: ${result.summary.matter_timeline_count}`);
    console.log(`Events: ${result.summary.timeline_event_count}`);
    console.log(`Event types: meeting=${result.summary.meeting_event_count}, received=${result.summary.received_event_count}, submission=${result.summary.submission_event_count}, deadline=${result.summary.deadline_event_count}`);
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
    schema_version: "matter-timeline-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    timeline_rule: "meeting_received_submission_and_deadline_events_are_sorted_by_event_at_within_matter_id_scope",
    matter_boundary_rule: "every_event_carries_one_matter_id_and_never_merges_confidential_context_across_matters",
    attorney_review_rule: "timeline_events_are_operational_context_only_and_do_not_create_legal_or_client_facing_outputs",
    desktop_companion_rule: "desktop_companion_reads_timeline_events_and_boundary_status_only",
    mutation_policy: "this_artifact_does_not_write_matter_data_execute_runtime_actions_or_deliver_outputs",
    created_at: generatedAt,
  };
}

function buildMatterTimelineEvents({
  generatedAt,
  matterFileReads,
  outputCatalog,
  deliveryByArtifactId,
}) {
  const events = [];
  for (const matterRead of matterFileReads) {
    if (!matterRead.value?.matter_id) continue;
    events.push(...buildMatterFileEvents(matterRead, generatedAt));
  }
  events.push(...buildOutputSubmissionEvents(outputCatalog, deliveryByArtifactId, generatedAt));
  const sortedEvents = events.sort(compareEvents);
  return sortedEvents.map((event, index) => ({
    ...event,
    sequence_number: index + 1,
    sort_key: buildSortKey(event),
  }));
}

function buildMatterFileEvents(matterRead, generatedAt) {
  const matter = matterRead.value;
  const matterId = matter.matter_id;
  const sourcePath = matterRead.path;
  const owner = matter.matter_profile?.responsible_partner ?? matter.review_workflow?.default_reviewer ?? null;
  const defaultReviewStatus = matter.confidentiality?.human_approval_required === true ? "pending_review" : "internal_review";
  const events = [];

  for (const communication of matter.communications ?? []) {
    const eventType = classifyCommunicationEventType(communication);
    events.push(timelineEvent({
      generatedAt,
      matterId,
      eventType,
      eventSubtype: communication.source ?? "communication",
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath,
      sourceRecordId: communication.id,
      title: eventType === "meeting" ? `Meeting: ${communication.source ?? communication.id}` : `Received communication: ${communication.source ?? communication.id}`,
      summary: communication.summary ?? null,
      eventDate: communication.date,
      status: "recorded",
      reviewStatus: defaultReviewStatus,
      owner,
      confidence: "source_record",
      metadata: {
        pending_question_count: communication.pending_questions?.length ?? 0,
      },
    }));
  }

  for (const document of matter.documents ?? []) {
    if (document.status !== "received") continue;
    const eventDate = inferMatterDocumentDate(matter, document, generatedAt);
    events.push(timelineEvent({
      generatedAt,
      matterId,
      eventType: "received",
      eventSubtype: document.type ?? "document",
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath,
      sourceRecordId: document.id,
      title: `Received document: ${document.title ?? document.id}`,
      summary: document.issue ? `Issue tag: ${document.issue}` : null,
      eventDate,
      status: document.status,
      reviewStatus: defaultReviewStatus,
      owner,
      confidence: eventDate === generatedAt.slice(0, 10) ? "date_inferred" : "source_record",
      metadata: {
        document_type: document.type ?? null,
        issue: document.issue ?? null,
        inferred_date: !document.date,
      },
    }));
  }

  for (const deadline of matter.deadlines ?? []) {
    events.push(timelineEvent({
      generatedAt,
      matterId,
      eventType: "deadline",
      eventSubtype: deadline.type ?? "matter_deadline",
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath,
      sourceRecordId: deadline.id,
      title: deadline.title ?? deadline.id,
      summary: null,
      eventDate: deadline.date,
      status: "open",
      reviewStatus: defaultReviewStatus,
      owner: deadline.owner ?? owner,
      confidence: "source_record",
      metadata: {
        deadline_type: deadline.type ?? null,
      },
    }));
  }

  for (const task of matter.tasks ?? []) {
    if (!task.due) continue;
    events.push(timelineEvent({
      generatedAt,
      matterId,
      eventType: "deadline",
      eventSubtype: "task_due",
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath,
      sourceRecordId: task.id,
      title: task.title ?? task.id,
      summary: task.source ? `Source: ${task.source}` : null,
      eventDate: task.due,
      status: task.status ?? "open",
      reviewStatus: task.review_required === false ? "internal_review" : defaultReviewStatus,
      owner: task.owner ?? owner,
      confidence: "source_record",
      metadata: {
        review_required: task.review_required === true,
      },
    }));
  }

  for (const item of matter.deal_control?.vdr_requests ?? []) {
    if (!item.due) continue;
    events.push(timelineEvent({
      generatedAt,
      matterId,
      eventType: "deadline",
      eventSubtype: "vdr_request_due",
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath,
      sourceRecordId: item.id,
      title: item.title ?? item.id,
      summary: item.issue ? `Issue tag: ${item.issue}` : null,
      eventDate: item.due,
      status: item.status ?? "open",
      reviewStatus: defaultReviewStatus,
      owner: item.owner ?? owner,
      confidence: "source_record",
      metadata: {
        issue: item.issue ?? null,
      },
    }));
  }

  for (const item of matter.deal_control?.qa_items ?? []) {
    if (!item.due) continue;
    events.push(timelineEvent({
      generatedAt,
      matterId,
      eventType: "deadline",
      eventSubtype: "qa_due",
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath,
      sourceRecordId: item.id,
      title: item.question ?? item.id,
      summary: item.from && item.to ? `${item.from} to ${item.to}` : null,
      eventDate: item.due,
      status: item.status ?? "open",
      reviewStatus: defaultReviewStatus,
      owner: item.owner ?? owner,
      confidence: "source_record",
      metadata: {
        from: item.from ?? null,
        to: item.to ?? null,
      },
    }));
  }

  for (const item of matter.deal_control?.cp_checklist ?? []) {
    if (!item.due) continue;
    events.push(timelineEvent({
      generatedAt,
      matterId,
      eventType: "deadline",
      eventSubtype: "cp_checklist_due",
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath,
      sourceRecordId: item.id,
      title: item.title ?? item.id,
      summary: item.evidence ? `Evidence: ${item.evidence}` : null,
      eventDate: item.due,
      status: item.status ?? "open",
      reviewStatus: defaultReviewStatus,
      owner: item.owner ?? owner,
      confidence: "source_record",
      metadata: {
        evidence: item.evidence ?? null,
      },
    }));
  }

  if (matter.litigation_control?.next_filing) {
    events.push(timelineEvent({
      generatedAt,
      matterId,
      eventType: "submission",
      eventSubtype: "court_filing",
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath,
      sourceRecordId: "litigation_control.next_filing",
      title: "Next filing",
      summary: matter.litigation_control.forum ? `Forum: ${matter.litigation_control.forum}` : null,
      eventDate: matter.litigation_control.next_filing,
      status: "planned",
      reviewStatus: defaultReviewStatus,
      owner,
      confidence: "source_record",
      metadata: {
        forum: matter.litigation_control.forum ?? null,
        procedural_stage: matter.litigation_control.procedural_stage ?? null,
      },
    }));
  }

  for (const entry of matter.litigation_control?.chronology ?? []) {
    if (!entry.date || !isMeetingLike(entry.fact)) continue;
    events.push(timelineEvent({
      generatedAt,
      matterId,
      eventType: "meeting",
      eventSubtype: "chronology_fact",
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath,
      sourceRecordId: entry.source,
      title: "Chronology meeting fact",
      summary: entry.fact ?? null,
      eventDate: entry.date,
      status: entry.verified === true ? "verified" : "unverified",
      reviewStatus: defaultReviewStatus,
      owner,
      confidence: entry.verified === true ? "source_record" : "requires_review",
      metadata: {
        verified: entry.verified === true,
        chronology_source: entry.source ?? null,
      },
    }));
  }

  return events;
}

function buildOutputSubmissionEvents(outputCatalog, deliveryByArtifactId, generatedAt) {
  const events = [];
  for (const artifact of outputCatalog?.artifacts ?? []) {
    if (artifact.domain_pack !== "law-firm") continue;
    const delivery = deliveryByArtifactId.get(artifact.artifact_id);
    events.push(timelineEvent({
      generatedAt,
      matterId: artifact.matter_id,
      eventType: "submission",
      eventSubtype: artifact.delivery_state === "blocked_pending_approval" ? "attorney_review_packet" : "law_firm_output",
      sourceKind: "output_catalog",
      sourceId: artifact.source_id ?? "output_catalog",
      sourcePath: artifact.artifact_uri ?? null,
      sourceRecordId: artifact.artifact_id,
      title: artifact.metadata?.title ?? artifact.artifact_id,
      summary: delivery?.delivery_target ? `Delivery target: ${delivery.delivery_target}` : null,
      eventDate: artifact.created_at,
      status: artifact.status ?? "pending_review",
      reviewStatus: artifact.approval_status === "pending" ? "pending_review" : artifact.status ?? "pending_review",
      owner: null,
      confidence: "source_record",
      metadata: {
        domain_pack: artifact.domain_pack,
        capability_id: artifact.capability_id ?? null,
        workflow_run_id: artifact.workflow_run_id ?? null,
        artifact_type: artifact.artifact_type ?? null,
        delivery_state: artifact.delivery_state ?? null,
        delivery_status: delivery?.delivery_status ?? artifact.delivery_state ?? null,
        approval_id: artifact.approval_id ?? delivery?.required_approval_id ?? null,
        approval_status: artifact.approval_status ?? delivery?.approval_status ?? null,
        protected_action: delivery?.protected_action === true,
        delivery_executed: delivery?.delivery_status === "delivered",
      },
    }));
  }
  return events;
}

function buildMatterTimelines(events, profileByMatter, generatedAt) {
  const grouped = groupBy(events, "matter_id");
  const matterIds = unique([
    ...events.map((event) => event.matter_id),
    ...profileByMatter.keys(),
  ]).sort();
  return matterIds.map((matterId) => {
    const matterEvents = (grouped.get(matterId) ?? []).sort(compareEvents);
    const profile = profileByMatter.get(matterId);
    const eventTypeCounts = Object.fromEntries(EVENT_TYPES.map((eventType) => [
      eventType,
      matterEvents.filter((event) => event.event_type === eventType).length,
    ]));
    return {
      schema_version: "matter-timeline-matter.v1",
      matter_timeline_matter_id: `matter-timeline-matter.${slugify(matterId)}`,
      matter_id: matterId,
      profile_card_id: profile?.matter_os_profile_card_id ?? null,
      client_display_name: profile?.client_display_name ?? null,
      matter_number: profile?.matter_number ?? null,
      security_grade: profile?.security_grade ?? null,
      event_count: matterEvents.length,
      first_event_at: matterEvents[0]?.event_at ?? null,
      last_event_at: matterEvents.at(-1)?.event_at ?? null,
      event_type_counts: eventTypeCounts,
      attorney_review_required: true,
      human_review_required: true,
      legal_advice_provided: false,
      client_facing_output_generated: false,
      desktop_read_only: true,
      desktop_mutation_allowed: false,
      timeline_status: matterEvents.length > 0 && isTimelineSorted(matterEvents) ? "complete" : "pending_events",
      created_at: generatedAt,
    };
  }).sort(by("matter_timeline_matter_id"));
}

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "matter-timeline-desktop-boundary.v1",
    boundary_id: "matter-timeline-desktop-boundary.read-only",
    boundary_status: "enforced",
    read_only: true,
    mutation_allowed: false,
    source_of_truth: false,
    matter_data_write_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    legal_advice_allowed: false,
    client_facing_output_allowed_without_attorney_review: false,
    attorney_review_required: true,
    human_review_required: true,
    default_output_status: "pending_review",
    supported_event_types: EVENT_TYPES,
    created_at: generatedAt,
  };
}

function buildCheckpoints({
  sourceReads,
  packageJson,
  roadmapText,
  matterOsProfile,
  outputCatalog,
  deliveryQueue,
  matterFileReads,
  events,
  matterTimelines,
  desktopBoundary,
}) {
  const sourceAvailable = (sourceId) => sourceReads.find((source) => source.source_id === sourceId)?.available === true;
  const matterFileAvailableCount = matterFileReads.filter((source) => source.available).length;
  const matterFileWithMatterIdCount = matterFileReads.filter((source) => Boolean(source.value?.matter_id)).length;
  const eventTypeCounts = countEventTypes(events);
  const packageScriptPresent = Boolean(packageJson?.scripts?.["matter:timeline"]);
  const roadmapSlotDeclared = typeof roadmapText === "string" && /P233\s*\|\s*matter timeline/i.test(roadmapText);
  const lawFirmArtifactCount = outputCatalog?.summary?.by_domain_pack?.["law-firm"] ?? outputCatalog?.artifacts?.filter((artifact) => artifact.domain_pack === "law-firm").length ?? 0;
  const lawFirmDeliveryCount = deliveryQueue?.summary?.law_firm_action_count ?? deliveryQueue?.delivery_actions?.filter((action) => action.domain_pack === "law-firm").length ?? 0;

  return [
    checkpoint("source_matter_os_profile_available", sourceAvailable("matter_os_profile"), "Matter OS profile source is readable."),
    checkpoint("source_output_catalog_available", sourceAvailable("output_catalog"), "Output catalog source is readable."),
    checkpoint("source_delivery_queue_available", sourceAvailable("delivery_queue"), "Protected delivery queue source is readable."),
    checkpoint("source_matter_os_profile_complete", matterOsProfile?.summary?.matter_os_profile_status === "complete", "Matter OS profile source is complete."),
    checkpoint("source_output_catalog_contains_law_firm_outputs", lawFirmArtifactCount > 0, "Output catalog contains law-firm review artifacts."),
    checkpoint("source_delivery_queue_contains_law_firm_actions", lawFirmDeliveryCount > 0, "Protected delivery queue contains law-firm delivery actions."),
    checkpoint("matter_files_available", matterFileAvailableCount === matterFileReads.length && matterFileReads.length > 0, "Configured matter files are readable.", { passed_count: matterFileAvailableCount, expected_count: matterFileReads.length }),
    checkpoint("matter_files_scoped_by_matter_id", matterFileWithMatterIdCount === matterFileReads.length && matterFileReads.length > 0, "Every configured matter file carries matter_id.", { passed_count: matterFileWithMatterIdCount, expected_count: matterFileReads.length }),
    checkpoint("package_script_registered", packageScriptPresent, "package.json exposes matter:timeline."),
    checkpoint("roadmap_slot_declared", roadmapSlotDeclared, "P233 matter timeline planned slot is declared."),
    checkpoint("timeline_events_created", events.length > 0, "Matter timeline events are created."),
    checkpoint("meeting_events_created", eventTypeCounts.meeting > 0, "Meeting events are represented in the timeline.", { passed_count: eventTypeCounts.meeting, expected_count: 1 }),
    checkpoint("received_events_created", eventTypeCounts.received > 0, "Received communication/document events are represented in the timeline.", { passed_count: eventTypeCounts.received, expected_count: 1 }),
    checkpoint("submission_events_created", eventTypeCounts.submission > 0, "Submission/review packet events are represented in the timeline.", { passed_count: eventTypeCounts.submission, expected_count: 1 }),
    checkpoint("deadline_events_created", eventTypeCounts.deadline > 0, "Deadline events are represented in the timeline.", { passed_count: eventTypeCounts.deadline, expected_count: 1 }),
    checkpoint("timeline_events_sorted", isTimelineSorted(events), "Timeline events are sorted by event_at, matter_id, and source id."),
    checkpoint("timeline_events_scoped_by_matter_id", events.every((event) => Boolean(event.matter_id)), "Every timeline event is scoped by matter_id.", { passed_count: events.filter((event) => Boolean(event.matter_id)).length, expected_count: events.length }),
    checkpoint("matter_timeline_rows_created", matterTimelines.filter((timeline) => timeline.event_count > 0).length > 0, "At least one matter timeline row has events."),
    checkpoint("attorney_review_gate_preserved", events.every((event) => event.attorney_review_required === true), "Attorney review remains required for law-firm timeline context."),
    checkpoint("human_review_gate_preserved", events.every((event) => event.human_review_required === true), "Human review remains required for law-firm timeline context."),
    checkpoint("no_legal_or_client_facing_output", events.every((event) => event.legal_advice_provided === false && event.client_facing_output_generated === false), "Matter timeline does not provide legal advice or generate client-facing output."),
    checkpoint("desktop_boundary_enforced", desktopBoundary.read_only === true && desktopBoundary.mutation_allowed === false && desktopBoundary.source_of_truth === false, "Desktop boundary is read-only and not source of truth."),
  ];
}

function summarizeMatterTimeline({
  matterOsProfile,
  outputCatalog,
  deliveryQueue,
  matterFileReads,
  events,
  matterTimelines,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  const eventTypeCounts = countEventTypes(events);
  const failedCheckpointCount = checkpoints.filter((checkpoint) => checkpoint.status !== "passed").length;
  const sortedEventCount = isTimelineSorted(events) ? events.length : 0;
  const eventCount = events.length;
  const complete = validation.valid
    && failedCheckpointCount === 0
    && eventCount > 0
    && EVENT_TYPES.every((eventType) => eventTypeCounts[eventType] > 0)
    && sortedEventCount === eventCount
    && events.every((event) => Boolean(event.matter_id));
  return {
    matter_timeline_status: complete ? "complete" : "blocked",
    matter_timeline_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_matter_os_profile_status: matterOsProfile?.summary?.matter_os_profile_status ?? "unknown",
    source_output_catalog_status: outputCatalog?.schema_version === "output-artifact-catalog.v1" ? "complete" : "unknown",
    source_delivery_queue_status: deliveryQueue?.schema_version === "protected-delivery-queue.v1" ? "complete" : "unknown",
    matter_file_count: matterFileReads.length,
    available_matter_file_count: matterFileReads.filter((source) => source.available).length,
    matter_file_with_matter_id_count: matterFileReads.filter((source) => Boolean(source.value?.matter_id)).length,
    matter_timeline_count: matterTimelines.length,
    complete_matter_timeline_count: matterTimelines.filter((timeline) => timeline.timeline_status === "complete").length,
    timeline_event_count: eventCount,
    meeting_event_count: eventTypeCounts.meeting,
    received_event_count: eventTypeCounts.received,
    submission_event_count: eventTypeCounts.submission,
    deadline_event_count: eventTypeCounts.deadline,
    sorted_event_count: sortedEventCount,
    unsorted_event_count: eventCount - sortedEventCount,
    matter_id_scoped_event_count: events.filter((event) => Boolean(event.matter_id)).length,
    attorney_review_required_event_count: events.filter((event) => event.attorney_review_required === true).length,
    human_review_required_event_count: events.filter((event) => event.human_review_required === true).length,
    pending_review_submission_count: events.filter((event) => event.event_type === "submission" && event.review_status === "pending_review").length,
    blocked_delivery_submission_count: events.filter((event) => event.event_type === "submission" && String(event.metadata?.delivery_status ?? "").startsWith("blocked")).length,
    legal_advice_provided: events.some((event) => event.legal_advice_provided === true),
    client_facing_output_generated: events.some((event) => event.client_facing_output_generated === true),
    desktop_boundary_status: desktopBoundary.boundary_status,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_source_of_truth: desktopBoundary.source_of_truth,
    matter_data_write_allowed: desktopBoundary.matter_data_write_allowed,
    runtime_execution_allowed: desktopBoundary.runtime_execution_allowed,
    delivery_execution_allowed: desktopBoundary.delivery_execution_allowed,
    client_facing_output_allowed_without_attorney_review: desktopBoundary.client_facing_output_allowed_without_attorney_review,
    failed_checkpoint_count: failedCheckpointCount,
    validation_item_count: checkpoints.length,
    validation_error_count: validation.errors.length,
  };
}

function timelineEvent({
  generatedAt,
  matterId,
  eventType,
  eventSubtype,
  sourceKind,
  sourceId,
  sourcePath,
  sourceRecordId,
  title,
  summary,
  eventDate,
  status,
  reviewStatus,
  owner,
  confidence,
  metadata = {},
}) {
  const eventAt = normalizeEventAt(eventDate, generatedAt);
  const eventDateValue = eventAt.slice(0, 10);
  const eventId = `matter-timeline-event.${slugify(matterId)}.${slugify(eventType)}.${slugify(sourceKind)}.${slugify(sourceRecordId ?? title)}`;
  return {
    schema_version: "matter-timeline-event.v1",
    event_id: eventId,
    matter_id: matterId,
    event_type: eventType,
    event_subtype: eventSubtype,
    event_title: title,
    event_summary: summary,
    event_date: eventDateValue,
    event_at: eventAt,
    sequence_number: 0,
    sort_key: "",
    source_kind: sourceKind,
    source_id: sourceId,
    source_path: sourcePath,
    source_record_id: sourceRecordId ?? null,
    owner: owner ?? null,
    event_status: status ?? "recorded",
    review_status: reviewStatus ?? "pending_review",
    attorney_review_required: true,
    human_review_required: true,
    default_output_status: "pending_review",
    legal_advice_provided: false,
    client_facing_output_generated: false,
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    matter_data_write_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    confidence,
    created_at: generatedAt,
    metadata,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    attorney_review_required: true,
    human_review_required: true,
    matter_data_write_allowed: false,
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
  const sourceContracts = {};
  for (const source of sourceReads) {
    sourceContracts[source.source_id] = {
      schema_version: source.value?.schema_version ?? null,
      source_kind: source.source_kind,
      path: source.path,
      available: source.available,
      content_hash: source.content_hash,
      error: source.error,
    };
  }
  sourceContracts.package_json = {
    schema_version: null,
    path: packageJson.path,
    available: packageJson.available,
    content_hash: packageJson.content_hash,
    error: packageJson.error,
  };
  sourceContracts.roadmap = {
    schema_version: null,
    path: roadmapText.path,
    available: roadmapText.available,
    content_hash: roadmapText.content_hash,
    error: roadmapText.error,
  };
  return sourceContracts;
}

async function readSourceArtifacts(inputs) {
  const baseSources = await Promise.all([
    readJsonSource("matter_os_profile", inputs.matter_os_profile_path, "artifact"),
    readJsonSource("output_catalog", inputs.output_catalog_path, "artifact"),
    readJsonSource("delivery_queue", inputs.delivery_queue_path, "artifact"),
  ]);
  const matterSources = await Promise.all(inputs.matter_files.map((filePath, index) => readJsonSource(`matter_file_${index + 1}`, filePath, "matter_file")));
  return [...baseSources, ...matterSources];
}

async function readJsonSource(sourceId, configuredPath, sourceKind) {
  const sourcePath = path.resolve(configuredPath);
  try {
    const text = await readFile(sourcePath, "utf8");
    return {
      source_id: sourceId,
      source_kind: sourceKind,
      path: sourcePath,
      available: true,
      value: JSON.parse(text),
      content_hash: hashText(text),
      error: null,
    };
  } catch (error) {
    return {
      source_id: sourceId,
      source_kind: sourceKind,
      path: sourcePath,
      available: false,
      value: null,
      content_hash: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function readJsonOrError(configuredPath) {
  const sourcePath = path.resolve(configuredPath);
  try {
    const text = await readFile(sourcePath, "utf8");
    return {
      path: sourcePath,
      available: true,
      value: JSON.parse(text),
      content_hash: hashText(text),
      error: null,
    };
  } catch (error) {
    return {
      path: sourcePath,
      available: false,
      value: null,
      content_hash: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function readTextOrError(configuredPath) {
  const sourcePath = path.resolve(configuredPath);
  try {
    const text = await readFile(sourcePath, "utf8");
    return {
      path: sourcePath,
      available: true,
      value: text,
      content_hash: hashText(text),
      error: null,
    };
  } catch (error) {
    return {
      path: sourcePath,
      available: false,
      value: null,
      content_hash: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

function checkpoint(checkpointId, passed, message, extra = {}) {
  return {
    schema_version: "matter-timeline-checkpoint.v1",
    checkpoint_id: checkpointId,
    checkpoint_status: passed ? "passed" : "failed",
    status: passed ? "passed" : "failed",
    message,
    ...extra,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.path,
      message: item.message,
      status: item.status,
    }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function normalizeInputs(options) {
  return {
    matter_os_profile_path: path.resolve(options.matterOsProfilePath ?? DEFAULT_MATTER_TIMELINE_INPUTS.matterOsProfilePath),
    matter_files: normalizeMatterFiles(options.matterFiles ?? DEFAULT_MATTER_TIMELINE_INPUTS.matterFiles).map((filePath) => path.resolve(filePath)),
    output_catalog_path: path.resolve(options.outputCatalogPath ?? DEFAULT_MATTER_TIMELINE_INPUTS.outputCatalogPath),
    delivery_queue_path: path.resolve(options.deliveryQueuePath ?? DEFAULT_MATTER_TIMELINE_INPUTS.deliveryQueuePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_MATTER_TIMELINE_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_MATTER_TIMELINE_INPUTS.roadmapPath),
  };
}

function normalizeMatterFiles(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function parseArgs(argv) {
  const parsed = {};
  const matterFiles = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--matter-os-profile") parsed.matterOsProfilePath = argv[++index];
    else if (arg === "--matter-file") matterFiles.push(argv[++index]);
    else if (arg === "--matter-files") matterFiles.push(...normalizeMatterFiles(argv[++index]));
    else if (arg === "--output-catalog") parsed.outputCatalogPath = argv[++index];
    else if (arg === "--delivery-queue") parsed.deliveryQueuePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (matterFiles.length > 0) parsed.matterFiles = matterFiles;
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/matter-timeline.mjs [options]

Options:
  --check                              fail when validation errors exist
  --out-dir <path>                    output directory
  --matter-os-profile <path>          Matter OS profile path
  --matter-file <path>                matter file path; can be repeated
  --matter-files <a,b>                comma-separated matter file paths
  --output-catalog <path>             output artifact catalog path
  --delivery-queue <path>             protected delivery queue path
  --package <path>                    package.json path
  --roadmap <path>                    final phase ledger path
  --run-at <iso>                      deterministic generated_at timestamp
`);
}

function renderMatterTimelineMarkdown(result) {
  const lines = [];
  lines.push("# Matter Timeline");
  lines.push("");
  lines.push(`Generated at: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.matter_timeline_status}`);
  lines.push(`Matters: ${result.summary.complete_matter_timeline_count}/${result.summary.matter_timeline_count}`);
  lines.push(`Events: ${result.summary.timeline_event_count}`);
  lines.push(`Event types: meeting=${result.summary.meeting_event_count}, received=${result.summary.received_event_count}, submission=${result.summary.submission_event_count}, deadline=${result.summary.deadline_event_count}`);
  lines.push(`Sorted events: ${result.summary.sorted_event_count}/${result.summary.timeline_event_count}`);
  lines.push(`Desktop boundary: ${result.summary.desktop_boundary_status}, read-only=${result.summary.desktop_read_only}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("| Date | Matter | Type | Title | Status | Review |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const event of result.matter_timeline_events) {
    lines.push(`| ${event.event_date} | ${event.matter_id} | ${event.event_type} | ${event.event_title} | ${event.event_status} | ${event.review_status} |`);
  }
  lines.push("");
  lines.push("Human review note: Matter Timeline rows are operational context only. They do not provide legal advice, generate client-facing output, write matter data, execute runtime actions, or deliver outputs; attorney/human review remains required.");
  return `${lines.join("\n")}\n`;
}

function serializableMatterTimeline(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildProfileByMatter(matterOsProfile) {
  return new Map((matterOsProfile?.matter_os_profiles ?? []).map((profile) => [profile.matter_id, profile]));
}

function buildDeliveryByArtifactId(deliveryQueue) {
  return new Map((deliveryQueue?.delivery_actions ?? []).map((action) => [action.artifact_id, action]));
}

function classifyCommunicationEventType(communication) {
  return isMeetingLike(communication.source) || isMeetingLike(communication.summary) ? "meeting" : "received";
}

function inferMatterDocumentDate(matter, document, generatedAt) {
  if (document.date) return document.date;
  const chronologyEntry = (matter.litigation_control?.chronology ?? []).find((entry) => entry.source === document.id && entry.date);
  if (chronologyEntry?.date) return chronologyEntry.date;
  const communicationDate = (matter.communications ?? []).map((communication) => communication.date).filter(Boolean).sort()[0];
  return communicationDate ?? generatedAt.slice(0, 10);
}

function isMeetingLike(value) {
  return /\b(meeting|call|interview)\b/i.test(String(value ?? ""));
}

function countEventTypes(events) {
  return Object.fromEntries(EVENT_TYPES.map((eventType) => [
    eventType,
    events.filter((event) => event.event_type === eventType).length,
  ]));
}

function normalizeEventAt(value, generatedAt) {
  if (!value) return generatedAt;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00:00.000Z`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? generatedAt : date.toISOString();
}

function compareEvents(left, right) {
  return String(left.event_at).localeCompare(String(right.event_at))
    || (EVENT_TYPE_RANK.get(left.event_type) ?? 99) - (EVENT_TYPE_RANK.get(right.event_type) ?? 99)
    || String(left.matter_id).localeCompare(String(right.matter_id))
    || String(left.event_id).localeCompare(String(right.event_id));
}

function isTimelineSorted(events) {
  for (let index = 1; index < events.length; index += 1) {
    if (compareEvents(events[index - 1], events[index]) > 0) return false;
  }
  return true;
}

function buildSortKey(event) {
  return `${event.event_at}|${String(EVENT_TYPE_RANK.get(event.event_type) ?? 99).padStart(2, "0")}|${event.matter_id}|${event.event_id}`;
}

function hashText(text) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function dateStamp(isoDate) {
  return isoDate.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function slugify(value) {
  return String(value ?? "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))];
}

function groupBy(items, key) {
  const grouped = new Map();
  for (const item of items ?? []) {
    const value = item?.[key];
    if (!grouped.has(value)) grouped.set(value, []);
    grouped.get(value).push(item);
  }
  return grouped;
}

function by(key) {
  return (left, right) => String(left?.[key] ?? "").localeCompare(String(right?.[key] ?? ""));
}
